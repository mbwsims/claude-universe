import { describe, it, expect } from 'vitest';
import { computeRiskScore } from './scoring.js';
import type { FileMetrics } from './file-metrics.js';
import type { ChurnResult } from './churn.js';

function makeMetrics(overrides: Partial<FileMetrics> = {}): FileMetrics {
  return {
    lineCount: 100,
    functionCount: 5,
    maxNestingDepth: 2,
    importCount: 3,
    ...overrides,
  };
}

function makeChurn(overrides: Partial<ChurnResult> = {}): ChurnResult {
  return {
    changes: 5,
    authors: 1,
    period: '6 months',
    ...overrides,
  };
}

describe('computeRiskScore', () => {
  it('returns Low for small, stable, uncoupled file', () => {
    const result = computeRiskScore(makeMetrics(), makeChurn(), 0);
    expect(result.risk).toBe('Low');
    expect(result.score).toBeLessThan(25);
  });

  it('returns Critical for large, churny, highly-coupled file', () => {
    const result = computeRiskScore(
      makeMetrics({ lineCount: 800, functionCount: 30, maxNestingDepth: 8, importCount: 20 }),
      makeChurn({ changes: 40, authors: 6 }),
      15,
    );
    expect(result.risk).toBe('Critical');
    expect(result.score).toBeGreaterThanOrEqual(75);
  });

  it('returns Medium for moderate complexity with some churn', () => {
    const result = computeRiskScore(
      makeMetrics({ lineCount: 250, functionCount: 10, maxNestingDepth: 3, importCount: 8 }),
      makeChurn({ changes: 10, authors: 2 }),
      3,
    );
    expect(result.risk).toBe('Medium');
    expect(result.score).toBeGreaterThanOrEqual(25);
    expect(result.score).toBeLessThan(50);
  });

  it('exposes breakdown with complexity, churn, coupling sub-scores', () => {
    const result = computeRiskScore(makeMetrics(), makeChurn(), 5);
    expect(result.breakdown).toHaveProperty('complexityScore');
    expect(result.breakdown).toHaveProperty('churnScore');
    expect(result.breakdown).toHaveProperty('couplingScore');
    expect(typeof result.breakdown.complexityScore).toBe('number');
  });

  it('weights churn 40%, complexity 40%, coupling 20%', () => {
    // Zero everything except coupling
    const result = computeRiskScore(
      makeMetrics({ lineCount: 0, functionCount: 0, maxNestingDepth: 0, importCount: 0 }),
      makeChurn({ changes: 0, authors: 0 }),
      10,
    );
    // Coupling score should be 100 (10/10 * 100), weighted 20% = 20 points
    expect(result.score).toBe(20);
    expect(result.breakdown.couplingScore).toBe(100);
  });
});
