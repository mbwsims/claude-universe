/**
 * Analyzes error test coverage by comparing throwable operations in source
 * to error assertions in tests.
 */
export interface ErrorCoverageResult {
    throwable: number;
    tested: number;
    ratio: number;
    throwableLocations: Array<{
        line: number;
        text: string;
    }>;
    errorTestLocations: Array<{
        line: number;
        text: string;
    }>;
}
export declare function analyzeErrorCoverage(sourceContent: string, testContent: string): ErrorCoverageResult;
