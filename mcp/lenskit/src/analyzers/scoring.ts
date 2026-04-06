/**
 * scoring.ts -- Compute complexity/risk score for a file.
 *
 * Combines multiple signals (line count, function count, nesting depth,
 * churn, coupling) into a single risk score and classification.
 */

import type { FileMetrics } from './file-metrics.js';
import type { ChurnResult } from './churn.js';

export type RiskLevel = 'Critical' | 'High' | 'Medium' | 'Low';

export interface ScoreResult {
  score: number;
  risk: RiskLevel;
  breakdown: {
    complexityScore: number;
    churnScore: number;
    couplingScore: number;
  };
}

/**
 * Compute a complexity sub-score from file metrics (0-100).
 *
 * Threshold rationale:
 * - 500 lines: files above this are consistently harder to reason about in one
 *   session. The penalty ramps linearly from 0 at 0 lines to max at 500.
 * - 20 functions: beyond this, a file likely has multiple responsibilities.
 * - 6 nesting depth: deeper nesting correlates strongly with cyclomatic complexity.
 *   Most well-structured functions stay under 4 levels.
 * - 15 imports: high import count signals coupling surface — more things that can
 *   change and break this file.
 */
function computeComplexityScore(metrics: FileMetrics): number {
  // Line count contribution: files over 300 lines start scoring higher
  const linePenalty = Math.min(metrics.lineCount / 500, 1) * 30;

  // Function count: many functions = higher complexity
  const funcPenalty = Math.min(metrics.functionCount / 20, 1) * 25;

  // Nesting depth: deep nesting is a strong complexity signal
  const nestPenalty = Math.min(metrics.maxNestingDepth / 6, 1) * 30;

  // Import count: many imports = more coupling surface
  const importPenalty = Math.min(metrics.importCount / 15, 1) * 15;

  return linePenalty + funcPenalty + nestPenalty + importPenalty;
}

/**
 * Compute a churn sub-score (0-100).
 * High churn = frequently changing = higher risk.
 */
function computeChurnScore(churn: ChurnResult): number {
  // Change frequency: files changing 30+ times in 6 months saturate the churn score
  const changePenalty = Math.min(churn.changes / 30, 1) * 60;

  // Multiple authors: more authors = coordination risk
  const authorPenalty = Math.min(churn.authors / 5, 1) * 40;

  return changePenalty + authorPenalty;
}

/**
 * Compute a coupling sub-score (0-100).
 * Many importers = high coupling = risky to change.
 */
function computeCouplingScore(importerCount: number): number {
  return Math.min(importerCount / 10, 1) * 100;
}

/**
 * Combine all signals into a final risk score.
 *
 * Weights: churn (40%), complexity (40%), coupling (20%).
 */
export function computeRiskScore(
  metrics: FileMetrics,
  churn: ChurnResult,
  importerCount: number
): ScoreResult {
  const complexityScore = computeComplexityScore(metrics);
  const churnScore = computeChurnScore(churn);
  const couplingScore = computeCouplingScore(importerCount);

  const score = Math.round(
    churnScore * 0.4 + complexityScore * 0.4 + couplingScore * 0.2
  );

  let risk: RiskLevel;
  if (score >= 75) {
    risk = 'Critical';
  } else if (score >= 50) {
    risk = 'High';
  } else if (score >= 25) {
    risk = 'Medium';
  } else {
    risk = 'Low';
  }

  return {
    score,
    risk,
    breakdown: {
      complexityScore: Math.round(complexityScore),
      churnScore: Math.round(churnScore),
      couplingScore: Math.round(couplingScore),
    },
  };
}
