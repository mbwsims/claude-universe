/**
 * lenskit_analyze -- File-level metrics for complexity and risk assessment.
 *
 * Single-file mode: analyzes one file with per-file git/grep calls.
 * Batch mode (no file arg): discovers all files, builds shared indexes
 * for coupling and churn (O(N) instead of O(N^2)), then scores each file.
 */
import { type FileMetrics } from '../../analyzers/file-metrics.js';
import { type CouplingResult } from '../../analyzers/coupling.js';
import { type ChurnResult } from '../../analyzers/churn.js';
import { type TestCoverageResult } from '../../analyzers/test-coverage.js';
import { type ScoreResult } from '../../analyzers/scoring.js';
interface FileAnalysis {
    path: string;
    metrics: FileMetrics;
    coupling: CouplingResult;
    churn: ChurnResult;
    testCoverage: TestCoverageResult;
    riskScore: ScoreResult;
}
export interface AnalyzeResult {
    files: FileAnalysis[];
    summary: {
        totalFiles: number;
        avgRiskScore: number;
        topRiskFiles: Array<{
            path: string;
            score: number;
            risk: string;
        }>;
    };
}
export declare function analyzeTool(args: {
    file?: string;
}, cwd: string): Promise<AnalyzeResult>;
export {};
