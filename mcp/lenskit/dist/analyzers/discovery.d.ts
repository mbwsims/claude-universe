/**
 * discovery.ts -- Find all source files in a project.
 *
 * Globs for source files, excluding build artifacts, test files, and
 * type declaration files.
 */
export declare function discoverSourceFiles(cwd: string): Promise<string[]>;
