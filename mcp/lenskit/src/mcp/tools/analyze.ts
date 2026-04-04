/**
 * lenskit_analyze -- File-level metrics for complexity and risk assessment.
 *
 * Single-file mode: analyzes one file with per-file git/grep calls.
 * Batch mode (no file arg): discovers all files, builds shared indexes
 * for coupling and churn (O(N) instead of O(N^2)), then scores each file.
 */

import { analyzeFileMetrics, type FileMetrics } from '../../analyzers/file-metrics.js';
import { analyzeCoupling, buildImportIndex, lookupCoupling, type CouplingResult } from '../../analyzers/coupling.js';
import { analyzeChurn, batchAnalyzeChurn, type ChurnResult } from '../../analyzers/churn.js';
import { analyzeTestCoverage, type TestCoverageResult } from '../../analyzers/test-coverage.js';
import { computeRiskScore, type ScoreResult } from '../../analyzers/scoring.js';
import { discoverSourceFiles } from '../../analyzers/discovery.js';

interface FileAnalysis {
  path: string;
  metrics: FileMetrics;
  coupling: CouplingResult;
  churn: ChurnResult;
  testCoverage: TestCoverageResult;
  riskScore: ScoreResult;
}

export interface AnalyzeResult {
  files: FileAnalysis[];
  summary: {
    totalFiles: number;
    avgRiskScore: number;
    topRiskFiles: Array<{ path: string; score: number; risk: string }>;
  };
}

/** Single-file analysis — uses per-file git/grep calls. */
async function analyzeSingleFile(filePath: string, cwd: string): Promise<FileAnalysis> {
  const [metrics, coupling, churn, testCoverage] = await Promise.all([
    analyzeFileMetrics(filePath, cwd),
    analyzeCoupling(filePath, cwd),
    analyzeChurn(filePath, cwd),
    analyzeTestCoverage(filePath, cwd),
  ]);

  const riskScore = computeRiskScore(metrics, churn, coupling.importerCount);

  return { path: filePath, metrics, coupling, churn, testCoverage, riskScore };
}

/** Batch analysis — builds shared indexes first, then looks up per file. O(N) total. */
async function analyzeBatch(filePaths: string[], cwd: string): Promise<FileAnalysis[]> {
  // Build shared indexes once (the expensive part, but only done once)
  const [importIndex, churnIndex] = await Promise.all([
    buildImportIndex(cwd, filePaths),
    batchAnalyzeChurn(cwd),
  ]);

  // Now analyze each file using the pre-built indexes (cheap lookups)
  const results = await Promise.all(
    filePaths.map(async (filePath) => {
      const [metrics, testCoverage] = await Promise.all([
        analyzeFileMetrics(filePath, cwd),
        analyzeTestCoverage(filePath, cwd),
      ]);

      const coupling = lookupCoupling(filePath, importIndex);
      const churn = churnIndex.get(filePath) ?? { changes: 0, authors: 0, period: '6 months' };
      const riskScore = computeRiskScore(metrics, churn, coupling.importerCount);

      return { path: filePath, metrics, coupling, churn, testCoverage, riskScore };
    })
  );

  return results;
}

export async function analyzeTool(args: { file?: string }, cwd: string): Promise<AnalyzeResult> {
  // Single-file mode
  if (args.file) {
    const file = await analyzeSingleFile(args.file, cwd);
    return {
      files: [file],
      summary: {
        totalFiles: 1,
        avgRiskScore: file.riskScore.score,
        topRiskFiles: [{ path: file.path, score: file.riskScore.score, risk: file.riskScore.risk }],
      },
    };
  }

  // Batch mode — all files
  const filePaths = await discoverSourceFiles(cwd);

  if (filePaths.length === 0) {
    return {
      files: [],
      summary: { totalFiles: 0, avgRiskScore: 0, topRiskFiles: [] },
    };
  }

  const files = await analyzeBatch(filePaths, cwd);

  const avgRiskScore = Math.round(
    files.reduce((sum, f) => sum + f.riskScore.score, 0) / files.length
  );

  const topRiskFiles = files
    .map((f) => ({ path: f.path, score: f.riskScore.score, risk: f.riskScore.risk }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return {
    files,
    summary: { totalFiles: files.length, avgRiskScore, topRiskFiles },
  };
}
