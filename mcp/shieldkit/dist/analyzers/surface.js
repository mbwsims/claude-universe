/**
 * Attack surface mapper.
 *
 * Discovers API endpoints, .env files, database access files,
 * and checks for auth protection and gitignore coverage.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { discoverRouteFiles, discoverEnvFiles, discoverDbFiles, detectFramework, checkGitignore, } from './discovery.js';
import { analyzeAuth } from './missing-auth.js';
export async function analyzeSurface(cwd) {
    const [routeFiles, envFiles, dbFiles, framework] = await Promise.all([
        discoverRouteFiles(cwd),
        discoverEnvFiles(cwd),
        discoverDbFiles(cwd),
        detectFramework(cwd),
    ]);
    // Check auth for each route file
    const endpoints = [];
    for (const routeFile of routeFiles) {
        try {
            const content = await readFile(join(cwd, routeFile), 'utf-8');
            const hasAuth = analyzeAuth(content);
            endpoints.push({ path: routeFile, hasAuth });
        }
        catch {
            endpoints.push({ path: routeFile, hasAuth: false });
        }
    }
    // Check gitignore for each env file
    const envFileInfos = [];
    for (const envFile of envFiles) {
        const gitignored = await checkGitignore(cwd, envFile);
        envFileInfos.push({ path: envFile, gitignored });
    }
    return {
        endpoints,
        envFiles: envFileInfos,
        dbAccessFiles: dbFiles.length,
        framework,
    };
}
//# sourceMappingURL=surface.js.map