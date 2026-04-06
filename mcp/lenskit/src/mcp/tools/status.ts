/**
 * lenskit_status -- Quick project health summary.
 *
 * Lightweight probe using only file discovery (glob + filter).
 * With detailed=true, also runs analyze + graph for rich metrics.
 */

import { isTestFile, IGNORE_PATTERNS, SOURCE_EXTENSIONS } from '../../analyzers/discovery.js';
import { glob } from 'tinyglobby';
import { extname } from 'node:path';
import { analyzeTool } from './analyze.js';
import { graphTool } from './graph.js';

export interface StatusResult {
  fileCount: number;
  testFileCount: number;
  testCoverageRatio: number;
  testCoverageDisclaimer: string;
  quickSummary: string;
}

export interface DetailedStatusResult extends StatusResult {
  avgRiskScore: number;
  topRiskFiles: Array<{ path: string; score: number; risk: string }>;
  circularDepCount: number;
  hubCount: number;
}

export async function statusTool(cwd: string, detailed?: boolean): Promise<StatusResult | DetailedStatusResult> {
  // Single glob pass — discover all files, then partition
  const allFiles = await glob(['**/*'], {
    cwd,
    ignore: IGNORE_PATTERNS,
    absolute: false,
  });

  const sourceFiles: string[] = [];
  const testFiles: string[] = [];

  for (const f of allFiles) {
    const ext = extname(f);
    if (!SOURCE_EXTENSIONS.has(ext)) continue;
    if (f.endsWith('.d.ts')) continue;

    if (isTestFile(f)) {
      testFiles.push(f);
    } else {
      sourceFiles.push(f);
    }
  }

  const fileCount = sourceFiles.length;
  const testFileCount = testFiles.length;
  const testCoverageRatio = fileCount > 0
    ? Math.round((testFileCount / fileCount) * 100) / 100
    : 0;

  const testCoverageDisclaimer =
    'Test coverage is estimated by file naming conventions only (e.g., *.test.ts, test_*.py, *_test.go). ' +
    'It does not verify that tests actually exercise the source file. Use testkit_map for verified source mapping.';

  const summaryParts: string[] = [];
  summaryParts.push(`${fileCount} source files`);
  summaryParts.push(`${testFileCount} test files`);
  summaryParts.push(`Test coverage: ~${Math.round(testCoverageRatio * 100)}%`);

  const baseResult: StatusResult = {
    fileCount,
    testFileCount,
    testCoverageRatio,
    testCoverageDisclaimer,
    quickSummary: '',
  };

  if (!detailed) {
    summaryParts.push('Use lenskit_status with detailed=true, or lenskit_analyze/lenskit_graph for full metrics');
    baseResult.quickSummary = summaryParts.join(' | ');
    return baseResult;
  }

  // Detailed mode: run analyze + graph in parallel
  const [analyzeResult, graphResult] = await Promise.all([
    analyzeTool({}, cwd),
    graphTool(cwd),
  ]);

  summaryParts.push(`Avg risk: ${analyzeResult.summary.avgRiskScore}`);
  summaryParts.push(`${graphResult.circularDeps.length} circular deps`);
  summaryParts.push(`${graphResult.hubs.length} hubs`);
  baseResult.quickSummary = summaryParts.join(' | ');

  return {
    ...baseResult,
    avgRiskScore: analyzeResult.summary.avgRiskScore,
    topRiskFiles: analyzeResult.summary.topRiskFiles,
    circularDepCount: graphResult.circularDeps.length,
    hubCount: graphResult.hubs.length,
  };
}
