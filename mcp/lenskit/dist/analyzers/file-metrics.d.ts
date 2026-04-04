/**
 * file-metrics.ts -- Compute file-level complexity metrics.
 *
 * Returns line count, function count, max nesting depth, and import count.
 */
export interface FileMetrics {
    lineCount: number;
    functionCount: number;
    maxNestingDepth: number;
    importCount: number;
}
export declare function analyzeFileMetrics(filePath: string, cwd: string): Promise<FileMetrics>;
