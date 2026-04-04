/**
 * testkit_map -- Test-to-source coverage mapping.
 *
 * Discovers all test files, maps them to source files, identifies untested
 * source files, and classifies them by criticality.
 */

import { buildSourceMapping, type SourceMapping } from '../../analyzers/discovery.js';

export interface MapResult {
  framework: string | null;
  testFiles: number;
  sourceFiles: number;
  coverageRatio: number;
  mapped: Array<{ test: string; source: string | null }>;
  untested: Array<{ path: string; priority: 'high' | 'medium' | 'low'; reason: string }>;
}

export async function mapTool(cwd: string): Promise<MapResult> {
  const mapping = await buildSourceMapping(cwd);

  return {
    framework: mapping.framework,
    testFiles: mapping.testFiles.length,
    sourceFiles: mapping.sourceFiles.length,
    coverageRatio: mapping.coverageRatio,
    mapped: mapping.testFiles.map(t => ({
      test: t.path,
      source: t.sourcePath,
    })),
    untested: mapping.untested,
  };
}
