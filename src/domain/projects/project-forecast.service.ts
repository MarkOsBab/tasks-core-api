import { prisma } from '@/lib/prisma';
import { dmy } from '@/resources/serialize';
import {
  loadEstimationSamples,
  medianTrackedToEstimateRatio,
  type EstimationSample,
} from '../estimation/estimation-samples';

// Data-driven delivery forecast for one project — plain math over the DB, no LLM (same
// invariant as the MCP read tools): remaining estimated hours corrected by the real
// tracked/estimated ratio of past cards, projected over the recent tracking velocity.

const VELOCITY_WINDOW_DAYS = 14;
const MIN_LABEL_SAMPLES = 3;

export interface ProjectForecast {
  openTasks: number;
  estimatedOpenTasks: number; // open tasks that carry an estimate (the rest are invisible hours)
  remainingEstimatedHours: number;
  medianTrackedToEstimateRatio: number | null; // global signal, shared with the AI generator
  ratioByLabel: Record<string, number>; // labels with >= MIN_LABEL_SAMPLES calibration samples
  correctedRemainingHours: number; // remaining × ratio (1 when no history yet)
  recentVelocityHoursPerDay: number; // closed tracked hours on this project, last 14 days / 14
  projectedFinishDate: string | null; // d/m/Y; null when there is no recent velocity
  confidence: 'low' | 'medium' | 'high';
  notes: string[]; // human-readable caveats (unestimated cards, no velocity...)
}

export type ProjectForecastResult =
  | { available: true; forecast: ProjectForecast }
  | { available: false; reason: string };

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function ratioByLabel(samples: EstimationSample[]): Record<string, number> {
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
    if (bucket.length < MIN_LABEL_SAMPLES) continue;
    const median = medianTrackedToEstimateRatio(bucket);
    if (median !== null) result[label] = median;
  }
  return result;
}

class ProjectForecastService {
  async build(projectId: bigint): Promise<ProjectForecastResult> {
    const [openTasks, samples, recentTracked] = await Promise.all([
      prisma.task.findMany({
        where: { projectId, deletedAt: null, column: { isTerminal: false } },
        select: { estimatedHours: true },
      }),
      loadEstimationSamples(),
      prisma.timeEntry.aggregate({
        _sum: { durationSeconds: true },
        where: {
          deletedAt: null,
          endedAt: { not: null },
          startedAt: { gte: new Date(Date.now() - VELOCITY_WINDOW_DAYS * 24 * 3600 * 1000) },
          task: { projectId, deletedAt: null },
        },
      }),
    ]);

    if (openTasks.length === 0) {
      return { available: false, reason: 'No open tasks: nothing left to forecast.' };
    }

    const estimated = openTasks.filter((t) => t.estimatedHours !== null);
    const remaining = estimated.reduce((sum, t) => sum + Number(t.estimatedHours), 0);
    if (estimated.length === 0 || remaining <= 0) {
      return {
        available: false,
        reason: `None of the ${openTasks.length} open task(s) carry estimatedHours: estimate them first (the /groom-backlog skill can).`,
      };
    }

    const ratio = medianTrackedToEstimateRatio(samples);
    const corrected = round1(remaining * (ratio ?? 1));
    // Two decimals: real velocities on small teams are fractions of an hour per day.
    const velocity =
      Math.round(((recentTracked._sum.durationSeconds ?? 0) / 3600 / VELOCITY_WINDOW_DAYS) * 100) /
      100;

    const notes: string[] = [];
    if (estimated.length < openTasks.length) {
      notes.push(
        `${openTasks.length - estimated.length} open task(s) have no estimate and are NOT included in the projection.`,
      );
    }
    if (ratio === null) notes.push('No calibration history yet: the raw estimates are used as-is.');
    if (velocity <= 0) {
      notes.push(
        `No tracked time in the last ${VELOCITY_WINDOW_DAYS} days: no finish date can be projected.`,
      );
    }

    const projectedFinish =
      velocity > 0
        ? dmy(new Date(Date.now() + (corrected / velocity) * 24 * 3600 * 1000))
        : null;

    const confidence: ProjectForecast['confidence'] =
      samples.length >= 10 && velocity > 0 ? 'high' : samples.length >= MIN_LABEL_SAMPLES ? 'medium' : 'low';

    return {
      available: true,
      forecast: {
        openTasks: openTasks.length,
        estimatedOpenTasks: estimated.length,
        remainingEstimatedHours: round1(remaining),
        medianTrackedToEstimateRatio: ratio,
        ratioByLabel: ratioByLabel(samples),
        correctedRemainingHours: corrected,
        recentVelocityHoursPerDay: velocity,
        projectedFinishDate: projectedFinish,
        confidence,
        notes,
      },
    };
  }
}

export const projectForecastService = new ProjectForecastService();
