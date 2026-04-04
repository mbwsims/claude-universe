/**
 * churn.ts -- Git history analysis.
 *
 * Two modes:
 * - analyzeChurn(file, cwd): runs 2 git commands for one file
 * - batchAnalyzeChurn(cwd): runs 1 git command and parses results for all files
 */
export interface ChurnResult {
    changes: number;
    authors: number;
    period: string;
}
/**
 * Single-file churn analysis. Spawns 2 git processes.
 * Use for single-file analysis only. For batch, use batchAnalyzeChurn.
 */
export declare function analyzeChurn(filePath: string, cwd: string): Promise<ChurnResult>;
/**
 * Batch churn analysis. Runs 2 git commands total (not 2N), then indexes results.
 * Returns a map: filePath -> ChurnResult.
 */
export declare function batchAnalyzeChurn(cwd: string): Promise<Map<string, ChurnResult>>;
