/**
 * testkit_status -- Quick project test health summary.
 *
 * Combines analyze + map results into a scannable overview.
 */
export interface StatusResult {
    framework: string | null;
    overallGrade: string;
    testFiles: number;
    sourceFiles: number;
    coverageRatio: number;
    untestedHighPriority: number;
    topIssues: string[];
    quickSummary: string;
}
export declare function statusTool(cwd: string): Promise<StatusResult>;
