/**
 * lenskit_status -- Quick project health summary.
 *
 * Lightweight probe using only file discovery (glob + filter).
 * Does NOT run the full analysis or graph pipeline.
 * For detailed metrics, use lenskit_analyze and lenskit_graph.
 */

import { discoverSourceFiles, isTestFile, IGNORE_PATTERNS, SOURCE_EXTENSIONS } from '../../analyzers/discovery.js';
import { glob } from 'tinyglobby';
import { extname } from 'node:path';

export interface StatusResult {
  fileCount: number;
  testFileCount: number;
  testCoverageRatio: number;
  testCoverageDisclaimer: string;
  quickSummary: string;
}

export async function statusTool(cwd: string): Promise<StatusResult> {
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
    'It does not verify that tests actually exercise the source file. Actual coverage may be lower.';

  const parts: string[] = [];
  parts.push(`${fileCount} source files`);
  parts.push(`${testFileCount} test files`);
  parts.push(`Test coverage: ~${Math.round(testCoverageRatio * 100)}%`);
  parts.push('Use lenskit_analyze for risk scores and lenskit_graph for dependency analysis');

  return {
    fileCount,
    testFileCount,
    testCoverageRatio,
    testCoverageDisclaimer,
    quickSummary: parts.join(' | '),
  };
}
