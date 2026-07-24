import { describe, expect, it } from 'vitest';
import {
  medianTrackedToEstimateRatio,
  ratioByLabel,
  type EstimationSample,
} from '@/domain/estimation/estimation-samples';

function sample(overrides: Partial<EstimationSample>): EstimationSample {
  return {
    title: 'Card',
    column: 'Terminada',
    done: true,
    project: 'Core Tasks',
    labels: [],
    estimatedHours: 1,
    trackedHours: 1,
    recent: false,
    ...overrides,
  };
}

describe('medianTrackedToEstimateRatio', () => {
  it('returns null with no samples', () => {
    expect(medianTrackedToEstimateRatio([])).toBeNull();
  });

  it('computes the median of per-card ratios', () => {
    const samples = [
      sample({ estimatedHours: 2, trackedHours: 1 }), // 0.5
      sample({ estimatedHours: 2, trackedHours: 2 }), // 1
      sample({ estimatedHours: 2, trackedHours: 4 }), // 2
    ];
    expect(medianTrackedToEstimateRatio(samples)).toBe(1);
  });

  it('weighs recent cards twice so they pull the median toward them', () => {
    const samples = [
      sample({ estimatedHours: 1, trackedHours: 1 }), // 1, old
      sample({ estimatedHours: 1, trackedHours: 0.2, recent: true }), // 0.2, recent
    ];
    // Unweighted median of [0.2, 1] would be 0.6; weighting the recent sample twice
    // ([0.2, 0.2, 1]) pulls the median down to the recent ratio.
    expect(medianTrackedToEstimateRatio(samples)).toBe(0.2);
  });
});

describe('ratioByLabel', () => {
  it('excludes labels below the minimum sample count', () => {
    const samples = [
      sample({ labels: ['dev'], estimatedHours: 1, trackedHours: 0.5 }),
      sample({ labels: ['dev'], estimatedHours: 1, trackedHours: 0.5 }),
    ];
    expect(ratioByLabel(samples, 5)).toEqual({});
  });

  it('includes labels once they reach the minimum sample count', () => {
    const devSamples = Array.from({ length: 5 }, () =>
      sample({ labels: ['dev'], estimatedHours: 1, trackedHours: 0.5 }),
    );
    expect(ratioByLabel(devSamples, 5)).toEqual({ dev: 0.5 });
  });

  it('buckets a card under every label it carries', () => {
    const samples = Array.from({ length: 5 }, () =>
      sample({ labels: ['dev', 'infra'], estimatedHours: 1, trackedHours: 2 }),
    );
    expect(ratioByLabel(samples, 5)).toEqual({ dev: 2, infra: 2 });
  });
});
