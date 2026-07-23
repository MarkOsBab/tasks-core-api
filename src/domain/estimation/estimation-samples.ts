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
}

export const ESTIMATION_SAMPLES = 30;

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
      column: { select: { name: true, isTerminal: true } },
      project: { select: { name: true, deletedAt: true } },
      labels: { select: { name: true, deletedAt: true } },
      timeEntries: {
        where: { deletedAt: null },
        select: { startedAt: true, endedAt: true },
      },
    },
  });
  return tasks
    .map((task) => ({
      title: task.title,
      column: task.column.name,
      done: task.column.isTerminal,
      project: task.project && !task.project.deletedAt ? task.project.name : null,
      labels: task.labels.filter((l) => !l.deletedAt).map((l) => l.name),
      estimatedHours: Number(task.estimatedHours),
      trackedHours: closedTrackedHours(task.timeEntries),
    }))
    .filter((sample) => sample.estimatedHours > 0 && sample.trackedHours > 0);
}

/** Median of per-card tracked/estimated ratios (robust to outliers); <1 = estimates ran high. */
export function medianTrackedToEstimateRatio(samples: EstimationSample[]): number | null {
  const ratios = samples
    .map((sample) => sample.trackedHours / sample.estimatedHours)
    .sort((a, b) => a - b);
  if (ratios.length === 0) return null;
  const median =
    ratios.length % 2 === 1
      ? ratios[(ratios.length - 1) / 2]
      : (ratios[ratios.length / 2 - 1] + ratios[ratios.length / 2]) / 2;
  return Math.round(median * 100) / 100;
}
