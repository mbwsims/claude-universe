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
 * Combine all signals into a final risk score.
 *
 * Weights: churn (40%), complexity (40%), coupling (20%).
 */
export declare function computeRiskScore(metrics: FileMetrics, churn: ChurnResult, importerCount: number): ScoreResult;
