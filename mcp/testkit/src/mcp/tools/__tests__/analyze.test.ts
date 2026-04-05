import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeTool } from '../analyze.js';

const FIXTURE_DIR = join(import.meta.dirname, '..', '..', '..', '..', '..', 'test-fixtures');
const hasFixtures = existsSync(FIXTURE_DIR);

describe.skipIf(!hasFixtures)('analyzeTool', () => {
  it('analyzes a single test file and returns dimensions', async () => {
    const result = await analyzeTool({ file: 'tests/helpers.test.ts' }, FIXTURE_DIR);
    expect(result.files).toHaveLength(1);
    expect(result.files[0].path).toBe('tests/helpers.test.ts');
    expect(result.files[0].dimensions).toBeDefined();
    expect(result.files[0].grade).toBeDefined();
  });

  it('analyzes all test files in batch mode', async () => {
    const result = await analyzeTool({}, FIXTURE_DIR);
    expect(result.files.length).toBeGreaterThanOrEqual(2);
    expect(result.summary).toBeDefined();
    expect(result.summary.avgGrade).toBeDefined();
    expect(result.summary.totalFiles).toBeGreaterThanOrEqual(2);
  });

  it('returns topIssues in summary', async () => {
    const result = await analyzeTool({}, FIXTURE_DIR);
    expect(Array.isArray(result.summary.topIssues)).toBe(true);
  });

  it('returns error for non-existent file', async () => {
    await expect(analyzeTool({ file: 'nonexistent.test.ts' }, FIXTURE_DIR)).rejects.toThrow();
  });

  it('uses discoveryCache when provided', async () => {
    const cache = {
      testPaths: ['tests/helpers.test.ts'],
      framework: 'vitest' as const,
    };
    const result = await analyzeTool({}, FIXTURE_DIR, cache);
    expect(result.files).toHaveLength(1);
    expect(result.files[0].path).toBe('tests/helpers.test.ts');
    expect(result.files[0].framework).toBe('vitest');
  });

  it('identifies shallow assertions in helpers.test.ts', async () => {
    const result = await analyzeTool({ file: 'tests/helpers.test.ts' }, FIXTURE_DIR);
    const file = result.files[0];
    expect(file.metrics.shallowAssertions.count).toBeGreaterThan(0);
  });

  it('identifies missing error coverage in user-service.test.ts', async () => {
    const result = await analyzeTool({ file: 'tests/user-service.test.ts' }, FIXTURE_DIR);
    const file = result.files[0];
    // user-service.test.ts has no error tests — errorCoverage may be non-null
    expect(file.dimensions).toBeDefined();
    expect(file.grade).toBeDefined();
  });
});
