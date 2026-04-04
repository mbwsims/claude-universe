/**
 * lenskit_status -- Quick project health summary.
 *
 * Combines analyze + graph results into a scannable overview with
 * top hotspots, circular dependency count, hub count, and test coverage ratio.
 */

import { analyzeTool } from './analyze.js';
import { graphTool } from './graph.js';

export interface StatusResult {
  fileCount: number;
  topHotspots: Array<{ path: string; score: number; risk: string }>;
  circularDepCount: number;
  hubCount: number;
  testCoverageRatio: number;
  quickSummary: string;
}

export async function statusTool(cwd: string): Promise<StatusResult> {
  const [analyzeResult, graphResult] = await Promise.all([
    analyzeTool({}, cwd),
    graphTool(cwd),
  ]);

  const fileCount = analyzeResult.summary.totalFiles;

  // Top 5 hotspots by risk score
  const topHotspots = analyzeResult.summary.topRiskFiles.slice(0, 5);

  const circularDepCount = graphResult.circularDeps.length;
  const hubCount = graphResult.hubs.length;

  // Test coverage ratio: files with tests / total files
  const filesWithTests = analyzeResult.files.filter((f) => f.testCoverage.hasTests).length;
  const testCoverageRatio = fileCount > 0 ? filesWithTests / fileCount : 0;

  // Build a human-readable summary
  const parts: string[] = [];
  parts.push(`${fileCount} source files analyzed`);
  parts.push(`Avg risk score: ${analyzeResult.summary.avgRiskScore}/100`);
  parts.push(`Test coverage: ${Math.round(testCoverageRatio * 100)}%`);
  parts.push(`${circularDepCount} circular dependency chain(s)`);
  parts.push(`${hubCount} hub file(s)`);

  if (topHotspots.length > 0) {
    parts.push(`Top hotspot: ${topHotspots[0].path} (score: ${topHotspots[0].score}, ${topHotspots[0].risk})`);
  }

  return {
    fileCount,
    topHotspots,
    circularDepCount,
    hubCount,
    testCoverageRatio: Math.round(testCoverageRatio * 100) / 100,
    quickSummary: parts.join(' | '),
  };
}
