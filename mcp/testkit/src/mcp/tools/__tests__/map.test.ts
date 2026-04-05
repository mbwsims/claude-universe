import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { mapTool } from '../map.js';

const FIXTURE_DIR = join(import.meta.dirname, '..', '..', '..', '..', '..', 'test-fixtures');
const hasFixtures = existsSync(FIXTURE_DIR);

describe.skipIf(!hasFixtures)('mapTool', () => {
  it('discovers test and source files', async () => {
    const result = await mapTool(FIXTURE_DIR);
    expect(result.testFiles).toBeGreaterThanOrEqual(2);
    expect(result.sourceFiles).toBeGreaterThanOrEqual(5);
  });

  it('maps test files to source files', async () => {
    const result = await mapTool(FIXTURE_DIR);
    expect(result.mapped.length).toBeGreaterThanOrEqual(2);
    // helpers.test.ts should map to a source file
    const helpersMapping = result.mapped.find(m => m.test.includes('helpers'));
    expect(helpersMapping).toBeDefined();
  });

  it('identifies untested files with priority', async () => {
    const result = await mapTool(FIXTURE_DIR);
    expect(result.untested.length).toBeGreaterThan(0);
    for (const u of result.untested) {
      expect(['high', 'medium', 'low']).toContain(u.priority);
      expect(u.path).toBeTruthy();
    }
  });

  it('computes coverage ratio', async () => {
    const result = await mapTool(FIXTURE_DIR);
    expect(result.coverageRatio).toBeGreaterThanOrEqual(0);
    expect(result.coverageRatio).toBeLessThanOrEqual(1);
  });

  it('returns framework detection result', async () => {
    const result = await mapTool(FIXTURE_DIR);
    // The fixture project uses vitest
    expect(result.framework).toBeDefined();
  });

  it('uses discoveryCache when provided', async () => {
    const cache = {
      testPaths: ['tests/helpers.test.ts'],
      framework: 'vitest' as const,
    };
    const result = await mapTool(FIXTURE_DIR, cache);
    // With only one test path in cache, should see fewer mapped files
    expect(result.framework).toBe('vitest');
    expect(result.testFiles).toBe(1);
  });

  it('includes untested reason for each untested file', async () => {
    const result = await mapTool(FIXTURE_DIR);
    for (const u of result.untested) {
      expect(u.reason).toBeTruthy();
    }
  });

  it('marks auth-related files as high priority untested', async () => {
    const result = await mapTool(FIXTURE_DIR);
    // auth-service.ts and auth-middleware.ts should be high priority
    const highPriority = result.untested.filter(u => u.priority === 'high');
    expect(highPriority.length).toBeGreaterThan(0);
    const authFile = highPriority.find(u => u.path.includes('auth'));
    expect(authFile).toBeDefined();
  });
});
