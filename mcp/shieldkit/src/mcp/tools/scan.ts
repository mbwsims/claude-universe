/**
 * shieldkit_scan -- Deterministic pattern detection across source files.
 *
 * Runs all security analyzers against source files and returns
 * structured findings with severity classifications.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { discoverSourceFiles, discoverRouteFiles } from '../../analyzers/discovery.js';
import { analyzeSqlInjection, type SqlInjectionResult } from '../../analyzers/sql-injection.js';
import { isRouteFile, analyzeAuth, analyzeHandlerAuth, buildMissingAuthResult, type MissingAuthResult, type HandlerAuthLocation } from '../../analyzers/missing-auth.js';
import { analyzeHardcodedSecrets, type HardcodedSecretsResult } from '../../analyzers/hardcoded-secrets.js';
import { analyzeDangerousFunctions, type DangerousFunctionsResult } from '../../analyzers/dangerous-functions.js';
import { analyzeCorsConfig, type CorsConfigResult } from '../../analyzers/cors-config.js';
import { buildScoringResult, type ScoringResult } from '../../analyzers/scoring.js';

interface FileMissingAuth {
  isRouteFile: boolean;
  hasAuth: boolean;
  handlers: HandlerAuthLocation[];
}

interface FileFindings {
  path: string;
  sqlInjection: SqlInjectionResult;
  hardcodedSecrets: HardcodedSecretsResult;
  dangerousFunctions: DangerousFunctionsResult;
  corsConfig: CorsConfigResult;
  missingAuth?: FileMissingAuth;
}

interface ScanResult {
  files: FileFindings[];
  missingAuth: MissingAuthResult;
  scoring: ScoringResult;
  summary: {
    totalFiles: number;
    filesWithFindings: number;
    riskLevel: string;
  };
}

async function scanFile(filePath: string, cwd: string): Promise<FileFindings> {
  const fullPath = join(cwd, filePath);
  const content = await readFile(fullPath, 'utf-8');

  const findings: FileFindings = {
    path: filePath,
    sqlInjection: analyzeSqlInjection(content, filePath),
    hardcodedSecrets: analyzeHardcodedSecrets(content, filePath),
    dangerousFunctions: analyzeDangerousFunctions(content, filePath),
    corsConfig: analyzeCorsConfig(content),
  };

  // Add auth info for route files
  if (isRouteFile(filePath)) {
    const handlerResults = analyzeHandlerAuth(content);
    findings.missingAuth = {
      isRouteFile: true,
      hasAuth: analyzeAuth(content),
      handlers: handlerResults.map(h => ({
        file: filePath,
        handler: h.name,
        hasAuth: h.hasAuth,
        line: h.startLine,
      })),
    };
  }

  return findings;
}

export async function scanTool(args: { file?: string }, cwd: string): Promise<ScanResult> {
  let filePaths: string[];

  if (args.file) {
    filePaths = [args.file];
  } else {
    // Discover source files and route files in parallel
    const [sourceFiles, discoveredRouteFiles] = await Promise.all([
      discoverSourceFiles(cwd),
      discoverRouteFiles(cwd),
    ]);

    // Merge route files into source files (avoid duplicates)
    const sourceSet = new Set(sourceFiles);
    for (const rf of discoveredRouteFiles) {
      sourceSet.add(rf);
    }
    filePaths = [...sourceSet];
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

  // Scan all files (each file is read once, not twice)
  const files = await Promise.all(
    filePaths.map(p => scanFile(p, cwd))
  );

  // Build missing auth result from the per-file auth info
  const authResults: Array<{ path: string; hasAuth: boolean }> = [];
  const allHandlers: HandlerAuthLocation[] = [];
  for (const f of files) {
    if (f.missingAuth) {
      authResults.push({ path: f.path, hasAuth: f.missingAuth.hasAuth });
      allHandlers.push(...f.missingAuth.handlers);
    }
  }
  const missingAuth = buildMissingAuthResult(authResults, allHandlers);

  // Aggregate counts for scoring
  const analyzerCounts: Record<string, number> = {
    'sql-injection': files.reduce((sum, f) => sum + f.sqlInjection.count, 0),
    'hardcoded-secrets': files.reduce((sum, f) => sum + f.hardcodedSecrets.count, 0),
    'dangerous-functions': files.reduce((sum, f) => sum + f.dangerousFunctions.count, 0),
    'cors-config': files.reduce((sum, f) => sum + f.corsConfig.count, 0),
    'missing-auth': missingAuth.unprotected,
  };

  const scoring = buildScoringResult(analyzerCounts);

  // Count files with findings -- includes missing auth
  const filesWithFindings = files.filter(f =>
    f.sqlInjection.count > 0 ||
    f.hardcodedSecrets.count > 0 ||
    f.dangerousFunctions.count > 0 ||
    f.corsConfig.count > 0 ||
    (f.missingAuth && !f.missingAuth.hasAuth)
  ).length;

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
