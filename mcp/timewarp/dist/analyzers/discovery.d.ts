/**
 * Source file discovery for temporal analysis.
 * Finds source files excluding common non-source directories.
 */
export declare function discoverSourceFiles(cwd: string): Promise<string[]>;
