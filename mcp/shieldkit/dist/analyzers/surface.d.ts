/**
 * Attack surface mapper.
 *
 * Discovers API endpoints, .env files, database access files,
 * and checks for auth protection and gitignore coverage.
 */
export interface EndpointInfo {
    path: string;
    hasAuth: boolean;
}
export interface EnvFileInfo {
    path: string;
    gitignored: boolean;
}
export interface SurfaceResult {
    endpoints: EndpointInfo[];
    envFiles: EnvFileInfo[];
    dbAccessFiles: number;
    framework: string | null;
}
export declare function analyzeSurface(cwd: string): Promise<SurfaceResult>;
