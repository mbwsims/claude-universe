/**
 * shieldkit_scan -- Deterministic pattern detection across source files.
 *
 * Runs all security analyzers against source files and returns
 * structured findings with severity classifications.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { discoverSourceFiles, discoverRouteFiles } from '../../analyzers/discovery.js';
import { analyzeSqlInjection } from '../../analyzers/sql-injection.js';
import { isRouteFile, analyzeAuth, buildMissingAuthResult } from '../../analyzers/missing-auth.js';
import { analyzeHardcodedSecrets } from '../../analyzers/hardcoded-secrets.js';
import { analyzeDangerousFunctions } from '../../analyzers/dangerous-functions.js';
import { analyzeCorsConfig } from '../../analyzers/cors-config.js';
import { buildScoringResult } from '../../analyzers/scoring.js';
async function scanFile(filePath, cwd) {
    const fullPath = join(cwd, filePath);
    const content = await readFile(fullPath, 'utf-8');
    return {
        path: filePath,
        sqlInjection: analyzeSqlInjection(content),
        hardcodedSecrets: analyzeHardcodedSecrets(content, filePath),
        dangerousFunctions: analyzeDangerousFunctions(content),
        corsConfig: analyzeCorsConfig(content),
    };
}
export async function scanTool(args, cwd) {
    let filePaths;
    if (args.file) {
        filePaths = [args.file];
    }
    else {
        filePaths = await discoverSourceFiles(cwd);
    }
    if (filePaths.length === 0) {
        const emptyAuth = buildMissingAuthResult([]);
        const scoring = buildScoringResult({});
        return {
            files: [],
            missingAuth: emptyAuth,
            scoring,
            summary: {
                totalFiles: 0,
                filesWithFindings: 0,
                riskLevel: 'clean',
            },
        };
    }
    // Scan all files
    const files = await Promise.all(filePaths.map(p => scanFile(p, cwd)));
    // Run missing auth analysis on route files
    const routeFiles = args.file
        ? filePaths.filter(isRouteFile)
        : await discoverRouteFiles(cwd);
    const authResults = [];
    for (const routeFile of routeFiles) {
        try {
            const content = await readFile(join(cwd, routeFile), 'utf-8');
            authResults.push({ path: routeFile, hasAuth: analyzeAuth(content) });
        }
        catch {
            authResults.push({ path: routeFile, hasAuth: false });
        }
    }
    const missingAuth = buildMissingAuthResult(authResults);
    // Aggregate counts for scoring
    const analyzerCounts = {
        'sql-injection': files.reduce((sum, f) => sum + f.sqlInjection.count, 0),
        'hardcoded-secrets': files.reduce((sum, f) => sum + f.hardcodedSecrets.count, 0),
        'dangerous-functions': files.reduce((sum, f) => sum + f.dangerousFunctions.count, 0),
        'cors-config': files.reduce((sum, f) => sum + f.corsConfig.count, 0),
        'missing-auth': missingAuth.unprotected,
    };
    const scoring = buildScoringResult(analyzerCounts);
    const filesWithFindings = files.filter(f => f.sqlInjection.count > 0 ||
        f.hardcodedSecrets.count > 0 ||
        f.dangerousFunctions.count > 0 ||
        f.corsConfig.count > 0).length;
    return {
        files,
        missingAuth,
        scoring,
        summary: {
            totalFiles: files.length,
            filesWithFindings,
            riskLevel: scoring.riskLevel,
        },
    };
}
//# sourceMappingURL=scan.js.map