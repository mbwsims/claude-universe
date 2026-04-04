/**
 * shieldkit_status -- Quick security health combining scan + surface.
 *
 * Provides a single overview of the project's security posture.
 */
export interface StatusResult {
    framework: string | null;
    riskLevel: string;
    totalFindings: number;
    criticalFindings: number;
    highFindings: number;
    mediumFindings: number;
    endpoints: number;
    unprotectedEndpoints: number;
    envFiles: number;
    ungitignored: number;
    dbAccessFiles: number;
    topIssues: string[];
    quickSummary: string;
}
export declare function statusTool(cwd: string): Promise<StatusResult>;
