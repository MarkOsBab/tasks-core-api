import { prisma } from '@/lib/prisma';

// Estimation ground truth shared by the AI draft generator (snapshot `estimation` block) and the
// project forecast: cards that carry BOTH an estimate and real closed tracked time. Cards in the
// review column count too — moving to done often lags the finish, and waiting would starve the
// calibration of exactly the freshest signal. No LLM here: plain math over the DB.

export interface EstimationSample {
  title: string;
  column: string;
  done: boolean;
  project: string | null;
  labels: string[];
  estimatedHours: number;
  trackedHours: number;
  // Card last touched within RECENT_WINDOW_DAYS — weighted more in the ratio (AI-assisted pace
  // keeps improving, so a card from today is a better predictor than one from months ago).
  recent: boolean;
}

export const ESTIMATION_SAMPLES = 30;
export const RECENT_WINDOW_DAYS = 30;
export const MIN_LABEL_SAMPLES = 5;

function closedTrackedHours(entries: { startedAt: Date; endedAt: Date | null }[]): number {
  let seconds = 0;
  for (const entry of entries) {
    if (entry.endedAt) {
      seconds += Math.max(0, (entry.endedAt.getTime() - entry.startedAt.getTime()) / 1000);
    }
  }
  return Math.round((seconds / 3600) * 10) / 10;
}

export async function loadEstimationSamples(limit = ESTIMATION_SAMPLES): Promise<EstimationSample[]> {
  const tasks = await prisma.task.findMany({
    where: {
      deletedAt: null,
      estimatedHours: { not: null },
      timeEntries: { some: { deletedAt: null, endedAt: { not: null } } },
    },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    select: {
      title: true,
      estimatedHours: true,
      updatedAt: true,
      column: { select: { name: true, isTerminal: true } },
      project: { select: { name: true, deletedAt: true } },
      labels: { select: { name: true, deletedAt: true } },
      timeEntries: {
        where: { deletedAt: null },
        select: { startedAt: true, endedAt: true },
      },
    },
  });
  const recentCutoff = Date.now() - RECENT_WINDOW_DAYS * 24 * 3600 * 1000;
  return tasks
    .map((task) => ({
      title: task.title,
      column: task.column.name,
      done: task.column.isTerminal,
      project: task.project && !task.project.deletedAt ? task.project.name : null,
      labels: task.labels.filter((l) => !l.deletedAt).map((l) => l.name),
      estimatedHours: Number(task.estimatedHours),
      trackedHours: closedTrackedHours(task.timeEntries),
      recent: (task.updatedAt?.getTime() ?? 0) >= recentCutoff,
    }))
    .filter((sample) => sample.estimatedHours > 0 && sample.trackedHours > 0);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid =
    sorted.length % 2 === 1
      ? sorted[(sorted.length - 1) / 2]
      : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  return Math.round(mid * 100) / 100;
}

// Median of per-card tracked/estimated ratios (robust to outliers, <1 = estimates ran high); recent cards count twice so the ratio tracks the current AI-assisted pace.
export function medianTrackedToEstimateRatio(samples: EstimationSample[]): number | null {
  const ratios: number[] = [];
  for (const sample of samples) {
    const ratio = sample.trackedHours / sample.estimatedHours;
    ratios.push(ratio);
    if (sample.recent) ratios.push(ratio);
  }
  return median(ratios);
}

/** Per-label median ratio, only for labels with >= minSamples calibration cards; global fallback is the caller's job. */
export function ratioByLabel(
  samples: EstimationSample[],
  minSamples = MIN_LABEL_SAMPLES,
): Record<string, number> {
  const byLabel = new Map<string, EstimationSample[]>();
  for (const sample of samples) {
    for (const label of sample.labels) {
      const bucket = byLabel.get(label) ?? [];
      bucket.push(sample);
      byLabel.set(label, bucket);
    }
  }
  const result: Record<string, number> = {};
  for (const [label, bucket] of byLabel) {
    if (bucket.length < minSamples) continue;
    const ratio = medianTrackedToEstimateRatio(bucket);
    if (ratio !== null) result[label] = ratio;
  }
  return result;
}
