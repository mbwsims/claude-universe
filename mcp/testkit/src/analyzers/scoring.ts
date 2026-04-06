/**
 * Computes letter grades from analyzer metrics, calibrated to the testkit scoring rubric.
 */

import type { ShallowAssertionResult } from './shallow-assertions.js';
import type { ErrorCoverageResult } from './error-coverage.js';
import type { MockHealthResult } from './mock-health.js';
import type { NameQualityResult } from './name-quality.js';

export type Grade = 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F';

export interface DimensionScores {
  assertionDepth: Grade | null;
  inputCoverage: null;      // requires semantic analysis
  errorTesting: Grade | null;
  mockHealth: Grade | null;
  specClarity: Grade | null;
  independence: null;        // requires semantic analysis
}

export function scoreAssertionDepth(result: ShallowAssertionResult): Grade | null {
  if (result.total === 0) return null;

  const shallowPercent = (result.count / result.total) * 100;

  if (shallowPercent === 0) return 'A';
  if (shallowPercent <= 5) return 'A-';
  if (shallowPercent <= 10) return 'B+';
  if (shallowPercent <= 20) return 'B';
  if (shallowPercent <= 30) return 'B-';
  if (shallowPercent <= 40) return 'C+';
  if (shallowPercent <= 50) return 'C';
  if (shallowPercent <= 65) return 'C-';
  if (shallowPercent <= 80) return 'D';
  return 'F';
}

export function scoreErrorTesting(result: ErrorCoverageResult): Grade | null {
  if (result.throwable === 0) return null; // no throwable ops, dimension N/A

  if (result.ratio >= 1.0) return 'A';
  if (result.ratio >= 0.85) return 'A-';
  if (result.ratio >= 0.7) return 'B+';
  if (result.ratio >= 0.6) return 'B';
  if (result.ratio >= 0.5) return 'B-';
  if (result.ratio >= 0.4) return 'C+';
  if (result.ratio >= 0.25) return 'C';
  if (result.ratio >= 0.1) return 'C-';
  if (result.ratio > 0) return 'D';
  return 'F';
}

export function scoreMockHealth(result: MockHealthResult): Grade | null {
  if (result.total === 0) return 'A'; // no mocks needed is ideal

  const hasInternal = result.internal > 0;
  const highSetup = result.setupPercent > 30;

  if (!hasInternal && result.setupPercent <= 20) return 'A';
  if (!hasInternal && !highSetup) return 'A-'; // 21-30% setup, all boundary
  if (result.internal <= 1 && !highSetup) return 'B+';
  if (result.internal <= 1) return 'B';
  if (result.internal <= 2 && !highSetup) return 'B-';
  if (result.internal <= 2) return 'C+';
  if (!highSetup) return 'C';
  if (result.setupPercent <= 50) return 'C-';
  if (result.setupPercent <= 70) return 'D';
  return 'F';
}

export function scoreSpecClarity(result: NameQualityResult): Grade | null {
  if (result.total === 0) return null;

  const vaguePercent = (result.vague / result.total) * 100;

  if (vaguePercent === 0) return 'A';
  if (vaguePercent <= 5) return 'A-';
  if (vaguePercent <= 10) return 'B+';
  if (vaguePercent <= 15) return 'B';
  if (vaguePercent <= 25) return 'B-';
  if (vaguePercent <= 35) return 'C+';
  if (vaguePercent <= 50) return 'C';
  if (vaguePercent <= 65) return 'C-';
  if (vaguePercent <= 80) return 'D';
  return 'F';
}

export const GRADE_VALUES: Record<Grade, number> = {
  'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'B-': 2.7,
  'C+': 2.3, 'C': 2.0, 'C-': 1.7, 'D': 1.0, 'F': 0.0,
};

const VALUE_TO_GRADE: Array<[number, Grade]> = [
  [3.85, 'A'], [3.5, 'A-'], [3.15, 'B+'], [2.85, 'B'], [2.5, 'B-'],
  [2.15, 'C+'], [1.85, 'C'], [1.5, 'C-'], [0.5, 'D'], [0, 'F'],
];

export function valueToGrade(value: number): Grade {
  for (const [threshold, grade] of VALUE_TO_GRADE) {
    if (value >= threshold) return grade;
  }
  return 'F';
}

/**
 * Compute the overall grade from dimension scores using a weighted average.
 *
 * Null dimensions are excluded from the calculation entirely -- they do not
 * count as zero. This means a project with only one measurable dimension will
 * be graded on that dimension alone, not penalized for unmeasurable ones.
 *
 * The `inputCoverage` and `independence` dimensions are always null because
 * they require semantic analysis that the deterministic analyzer cannot perform.
 *
 * Grade caps (hard limits that override the weighted average):
 * - errorTesting === 'F' (zero error tests) -> capped at C
 * - assertionDepth <= C (>40% shallow) -> capped at C+
 * - mockHealth <= D (>50% mock setup lines) -> capped at C
 */
export function computeOverallGrade(dimensions: DimensionScores): Grade {
  // Weighted scoring: error testing highest, then assertion depth
  const weights: Array<{ key: keyof DimensionScores; weight: number }> = [
    { key: 'errorTesting', weight: 3 },
    { key: 'assertionDepth', weight: 2.5 },
    { key: 'mockHealth', weight: 1.5 },
    { key: 'specClarity', weight: 1 },
  ];

  let totalWeight = 0;
  let totalValue = 0;

  for (const { key, weight } of weights) {
    const grade = dimensions[key];
    if (grade !== null) {
      totalWeight += weight;
      totalValue += GRADE_VALUES[grade] * weight;
    }
  }

  if (totalWeight === 0) return 'C'; // no measurable dimensions

  let overall = valueToGrade(totalValue / totalWeight);

  // Grade caps from the scoring rubric
  // Only F (no error tests at all) triggers the C cap.
  // D means SOME error tests exist -- it drags down the average but doesn't hard-cap.
  if (dimensions.errorTesting === 'F') {
    const cap: Grade = 'C';
    if (GRADE_VALUES[overall] > GRADE_VALUES[cap]) overall = cap;
  }

  if (dimensions.assertionDepth !== null) {
    const shallowGrade = dimensions.assertionDepth;
    if (GRADE_VALUES[shallowGrade] <= GRADE_VALUES['C']) {
      const cap = 'C+';
      if (GRADE_VALUES[overall] > GRADE_VALUES[cap]) overall = cap;
    }
  }

  if (dimensions.mockHealth !== null) {
    const mockGrade = dimensions.mockHealth;
    if (GRADE_VALUES[mockGrade] <= GRADE_VALUES['D']) {
      const cap = 'C';
      if (GRADE_VALUES[overall] > GRADE_VALUES[cap]) overall = cap;
    }
  }

  return overall;
}
