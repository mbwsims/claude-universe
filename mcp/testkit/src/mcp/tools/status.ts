/**
 * testkit_status -- Quick project test health summary.
 *
 * Combines analyze + map results into a scannable overview.
 * Runs discovery once and shares results with both analyze and map tools
 * to avoid redundant filesystem scanning.
 */

import { discoverTestFiles, detectFramework } from '../../analyzers/discovery.js';
import { analyzeTool, type DiscoveryCache } from './analyze.js';
import { mapTool } from './map.js';

export interface StatusResult {
  framework: string | null;
  overallGrade: string;
  testFiles: number;
  sourceFiles: number;
  coverageRatio: number;
  untestedHighPriority: number;
  topIssues: string[];
  quickSummary: string;
}

export async function statusTool(cwd: string): Promise<StatusResult> {
  // Run discovery once and share results with both tools
  const [testPaths, framework] = await Promise.all([
    discoverTestFiles(cwd),
    detectFramework(cwd),
  ]);

  const discoveryCache: DiscoveryCache = { testPaths, framework };

  const [analyzeResult, mapResult] = await Promise.all([
    analyzeTool({}, cwd, discoveryCache),
    mapTool(cwd, discoveryCache),
  ]);

  const untestedHighPriority = mapResult.untested.filter(u => u.priority === 'high').length;

  // Build a human-readable summary
  const parts: string[] = [];
  parts.push(`${mapResult.testFiles} test files covering ${mapResult.sourceFiles} source files`);
  parts.push(`Overall grade: ${analyzeResult.summary.avgGrade}`);
  parts.push(`Coverage ratio: ${Math.round(mapResult.coverageRatio * 100)}%`);

  if (untestedHighPriority > 0) {
    parts.push(`${untestedHighPriority} high-priority source file(s) have no tests`);
  }

  if (analyzeResult.summary.topIssues.length > 0) {
    parts.push(`Top issue: ${analyzeResult.summary.topIssues[0]}`);
  }

  return {
    framework: mapResult.framework ?? framework,
    overallGrade: analyzeResult.summary.avgGrade,
    testFiles: mapResult.testFiles,
    sourceFiles: mapResult.sourceFiles,
    coverageRatio: mapResult.coverageRatio,
    untestedHighPriority,
    topIssues: analyzeResult.summary.topIssues,
    quickSummary: parts.join(' | '),
  };
}
