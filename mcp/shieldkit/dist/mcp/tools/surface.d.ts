/**
 * shieldkit_surface -- Attack surface mapping for the whole project.
 *
 * Discovers API routes, env files, and database access points.
 * Checks auth protection and gitignore coverage.
 */
import { type SurfaceResult } from '../../analyzers/surface.js';
export declare function surfaceTool(cwd: string): Promise<SurfaceResult>;
