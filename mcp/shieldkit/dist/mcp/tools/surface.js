/**
 * shieldkit_surface -- Attack surface mapping for the whole project.
 *
 * Discovers API routes, env files, and database access points.
 * Checks auth protection and gitignore coverage.
 */
import { analyzeSurface } from '../../analyzers/surface.js';
export async function surfaceTool(cwd) {
    return analyzeSurface(cwd);
}
//# sourceMappingURL=surface.js.map