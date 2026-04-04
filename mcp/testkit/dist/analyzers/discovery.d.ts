/**
 * Test file discovery, source mapping, and framework detection.
 */
export interface TestFile {
    path: string;
    sourcePath: string | null;
}
export interface SourceMapping {
    framework: string | null;
    testFiles: TestFile[];
    sourceFiles: string[];
    untested: Array<{
        path: string;
        priority: 'high' | 'medium' | 'low';
        reason: string;
    }>;
    coverageRatio: number;
}
export declare function inferSourcePath(testPath: string, cwd?: string): string | null;
export declare function discoverTestFiles(cwd: string): Promise<string[]>;
export declare function discoverSourceFiles(cwd: string): Promise<string[]>;
export declare function detectFramework(cwd: string): Promise<string | null>;
export declare function buildSourceMapping(cwd: string): Promise<SourceMapping>;
