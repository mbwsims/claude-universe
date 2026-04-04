/**
 * test-coverage.ts -- Check if a source file has corresponding tests.
 *
 * Looks for common test file naming conventions adjacent to or
 * within __tests__ directories.
 */
export interface TestCoverageResult {
    hasTests: boolean;
    testPath: string | null;
}
export declare function analyzeTestCoverage(filePath: string, cwd: string): Promise<TestCoverageResult>;
