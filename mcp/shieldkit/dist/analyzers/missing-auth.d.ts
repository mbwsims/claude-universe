/**
 * Missing auth analyzer.
 *
 * Detects route handler files that lack auth function calls near the top.
 * Checks for common auth patterns in files matching route/handler conventions.
 */
export interface MissingAuthLocation {
    file: string;
    hasAuth: boolean;
}
export interface MissingAuthResult {
    total: number;
    unprotected: number;
    locations: MissingAuthLocation[];
}
export declare function isRouteFile(filePath: string): boolean;
export declare function analyzeAuth(content: string): boolean;
export declare function buildMissingAuthResult(files: Array<{
    path: string;
    hasAuth: boolean;
}>): MissingAuthResult;
