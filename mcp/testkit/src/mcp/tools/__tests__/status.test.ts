import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { statusTool } from '../status.js';

const FIXTURE_DIR = join(import.meta.dirname, '..', '..', '..', '..', '..', 'test-fixtures');
const hasFixtures = existsSync(FIXTURE_DIR);

describe.skipIf(!hasFixtures)('statusTool', () => {
  it('returns overall grade and file counts', async () => {
    const result = await statusTool(FIXTURE_DIR);
    expect(result.overallGrade).toBeDefined();
    expect(result.testFiles).toBeGreaterThanOrEqual(2);
    expect(result.sourceFiles).toBeGreaterThanOrEqual(5);
  });

  it('computes coverage ratio', async () => {
    const result = await statusTool(FIXTURE_DIR);
    expect(result.coverageRatio).toBeGreaterThanOrEqual(0);
    expect(result.coverageRatio).toBeLessThanOrEqual(1);
  });

  it('identifies untested high-priority files', async () => {
    const result = await statusTool(FIXTURE_DIR);
    expect(typeof result.untestedHighPriority).toBe('number');
    // fixture has auth-service.ts and auth-middleware.ts untested
    expect(result.untestedHighPriority).toBeGreaterThan(0);
  });

  it('produces a human-readable quickSummary', async () => {
    const result = await statusTool(FIXTURE_DIR);
    expect(result.quickSummary).toContain('test files');
    expect(result.quickSummary).toContain('Overall grade');
  });

  it('returns topIssues array', async () => {
    const result = await statusTool(FIXTURE_DIR);
    expect(Array.isArray(result.topIssues)).toBe(true);
  });

  it('returns framework detection result', async () => {
    const result = await statusTool(FIXTURE_DIR);
    expect(result.framework).toBeDefined();
  });

  it('quickSummary includes coverage ratio', async () => {
    const result = await statusTool(FIXTURE_DIR);
    expect(result.quickSummary).toContain('Coverage ratio');
  });

  it('topIssues reflects fixture test quality problems', async () => {
    const result = await statusTool(FIXTURE_DIR);
    // helpers.test.ts and user-service.test.ts both have shallow assertions
    const hasShallowIssue = result.topIssues.some(i => i.toLowerCase().includes('shallow'));
    expect(hasShallowIssue).toBe(true);
  });
});
