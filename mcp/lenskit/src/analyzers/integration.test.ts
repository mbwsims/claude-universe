import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { discoverSourceFiles } from './discovery.js';
import { analyzeFileMetrics } from './file-metrics.js';
import { analyzeTestCoverage } from './test-coverage.js';
import { buildImportIndex, lookupCoupling } from './coupling.js';
import { analyzeGraph } from './graph.js';
import { analyzeTool } from '../mcp/tools/analyze.js';
import { statusTool } from '../mcp/tools/status.js';

const FIXTURE_DIR = join(import.meta.dirname, '..', '..', '..', 'test-fixtures');

describe('integration: fixture project analysis', () => {
  it('discovers expected source files from fixture project', async () => {
    const files = await discoverSourceFiles(FIXTURE_DIR);
    // Fixture project has: index.ts, utils/helpers.ts, utils/format.ts,
    // services/user-service.ts, services/auth-service.ts, db/connection.ts,
    // db/user-repository.ts, routes/user-routes.ts, routes/admin-routes.ts,
    // middleware/auth-middleware.ts, config.ts, py/utils.py, py/api.py, py/models.py
    expect(files.length).toBeGreaterThanOrEqual(10);

    // Should include TypeScript files
    expect(files.some(f => f.includes('utils/helpers.ts'))).toBe(true);
    expect(files.some(f => f.includes('services/user-service.ts'))).toBe(true);

    // Should include Python files
    expect(files.some(f => f.includes('py/utils.py'))).toBe(true);
    expect(files.some(f => f.includes('py/api.py'))).toBe(true);

    // Should NOT include test files
    expect(files.every(f => !f.includes('test_utils.py'))).toBe(true);
    expect(files.every(f => !f.includes('.test.ts'))).toBe(true);
  });

  it('analyzes file metrics for a TypeScript file', async () => {
    const metrics = await analyzeFileMetrics('src/services/user-service.ts', FIXTURE_DIR);
    expect(metrics.lineCount).toBeGreaterThan(10);
    expect(metrics.functionCount).toBeGreaterThan(0);
    expect(metrics.importCount).toBeGreaterThan(0);
  });

  it('analyzes file metrics for a Python file', async () => {
    const metrics = await analyzeFileMetrics('src/py/utils.py', FIXTURE_DIR);
    expect(metrics.lineCount).toBeGreaterThan(5);
    expect(metrics.functionCount).toBeGreaterThan(0);
  });

  it('detects test coverage for files with tests', async () => {
    // helpers.ts should have tests/helpers.test.ts (flat tests/ dir)
    const result = await analyzeTestCoverage('src/utils/helpers.ts', FIXTURE_DIR);
    expect(result.hasTests).toBe(true);
    expect(result.testPath).toBeDefined();
  });

  it('detects Python test coverage', async () => {
    // utils.py should have test_utils.py
    const result = await analyzeTestCoverage('src/py/utils.py', FIXTURE_DIR);
    expect(result.hasTests).toBe(true);
    expect(result.testPath).toContain('test_utils.py');
  });

  it('builds import index and looks up coupling', async () => {
    const files = await discoverSourceFiles(FIXTURE_DIR);
    const index = await buildImportIndex(FIXTURE_DIR, files);
    expect(index.size).toBeGreaterThan(0);

    // user-repository.ts is imported by user-service.ts
    const repoResult = lookupCoupling('src/db/user-repository.ts', index);
    expect(repoResult.importerCount).toBeGreaterThan(0);
  });

  it('builds dependency graph with edges and layer classifications', async () => {
    const graph = await analyzeGraph(FIXTURE_DIR);
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.edges.length).toBeGreaterThan(0);

    // Should have some hub files (files imported by multiple others)
    // user-repository.ts is imported by both services
    expect(graph.hubs.length).toBeGreaterThan(0);
  });

  it('runs full analyze tool in batch mode', async () => {
    const result = await analyzeTool({}, FIXTURE_DIR);
    expect(result.files.length).toBeGreaterThan(0);
    expect(result.summary.totalFiles).toBeGreaterThan(0);
    expect(result.summary.avgRiskScore).toBeGreaterThanOrEqual(0);
    expect(result.summary.topRiskFiles.length).toBeGreaterThan(0);
  });

  it('runs status tool and returns all fields', async () => {
    const status = await statusTool(FIXTURE_DIR);
    expect(status.fileCount).toBeGreaterThan(0);
    expect(status.topHotspots).toBeDefined();
    expect(status.circularDepCount).toBeGreaterThanOrEqual(0);
    expect(status.hubCount).toBeGreaterThanOrEqual(0);
    expect(typeof status.testCoverageRatio).toBe('number');
    expect(status.testCoverageDisclaimer).toContain('naming conventions');
    expect(status.quickSummary.length).toBeGreaterThan(0);
  });
});
