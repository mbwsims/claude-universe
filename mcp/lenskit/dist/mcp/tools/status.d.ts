/**
 * lenskit_status -- Quick project health summary.
 *
 * Combines analyze + graph results into a scannable overview with
 * top hotspots, circular dependency count, hub count, and test coverage ratio.
 */
export interface StatusResult {
    fileCount: number;
    topHotspots: Array<{
        path: string;
        score: number;
        risk: string;
    }>;
    circularDepCount: number;
    hubCount: number;
    testCoverageRatio: number;
    quickSummary: string;
}
export declare function statusTool(cwd: string): Promise<StatusResult>;
