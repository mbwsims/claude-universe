/**
 * testkit_map -- Test-to-source coverage mapping.
 *
 * Discovers all test files, maps them to source files, identifies untested
 * source files, and classifies them by criticality.
 */

import { buildSourceMapping, type SourceMapping } from '../../analyzers/discovery.js';
import type { DiscoveryCache } from './analyze.js';

export interface MapResult {
  framework: string | null;
  testFiles: number;
  sourceFiles: number;
  coverageRatio: number;
  coverageDisclaimer: string;
  mapped: Array<{ test: string; source: string | null }>;
  untested: Array<{ path: string; priority: 'high' | 'medium' | 'low'; reason: string }>;
}

export async function mapTool(cwd: string, discoveryCache?: DiscoveryCache): Promise<MapResult> {
  const mapping = await buildSourceMapping(cwd, discoveryCache);

  return {
    framework: mapping.framework,
    testFiles: mapping.testFiles.length,
    sourceFiles: mapping.sourceFiles.length,
    coverageRatio: mapping.coverageRatio,
    coverageDisclaimer:
      'Coverage is measured by verified source mapping: each test file is mapped to a specific ' +
      'source file by path resolution. Only successfully mapped pairs count. This may undercount ' +
      'if test naming conventions differ from source paths. lenskit_status uses file-name convention ' +
      'matching which typically reports a higher ratio.',
    mapped: mapping.testFiles.map(t => ({
      test: t.path,
      source: t.sourcePath,
    })),
    untested: mapping.untested,
  };
}
