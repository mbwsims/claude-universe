/**
 * shieldkit_surface -- Attack surface mapping for the whole project.
 *
 * Discovers API routes, env files, and database access points.
 * Checks auth protection and gitignore coverage.
 */

import { join } from 'node:path';
import { analyzeSurface, type SurfaceResult } from '../../analyzers/surface.js';

export async function surfaceTool(cwd: string, directory?: string): Promise<SurfaceResult> {
  const targetCwd = directory ? join(cwd, directory) : cwd;
  return analyzeSurface(targetCwd);
}
