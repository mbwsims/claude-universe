/**
 * File discovery utilities for security scanning.
 *
 * Discovers source files, route files, env files, and detects frameworks.
 */
export declare function discoverSourceFiles(cwd: string): Promise<string[]>;
export declare function discoverRouteFiles(cwd: string): Promise<string[]>;
export declare function discoverEnvFiles(cwd: string): Promise<string[]>;
export declare function discoverDbFiles(cwd: string): Promise<string[]>;
export declare function detectFramework(cwd: string): Promise<string | null>;
export declare function checkGitignore(cwd: string, filePath: string): Promise<boolean>;
