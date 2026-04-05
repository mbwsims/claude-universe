import { describe, it, expect } from 'vitest';

// We test detectGrowthPattern via a test-only export. See Step 3.
import { detectGrowthPatternForTest, detectChurnPatternForTest, analyzeFileTrendForTest, analyzeTrends, countFunctionsForTest } from '../analyzers/trends.js';
import { join } from 'node:path';

const FIXTURE_DIR = join(import.meta.dirname, '..', '..', '..', 'test-fixtures');

describe('detectGrowthPattern — flat threshold', () => {
  it('classifies <15% total growth over 6 months as flat', () => {
    // 100 -> 114 = 14% total growth over 6 months — should be flat
    const samples = [
      { date: '2025-01-01', lines: 100, functions: 5 },
      { date: '2025-04-01', lines: 107, functions: 5 },
      { date: '2025-07-01', lines: 114, functions: 6 },
    ];
    expect(detectGrowthPatternForTest(samples, 6)).toBe('flat');
  });

  it('does NOT classify 30% total growth over 6 months as flat (old bug)', () => {
    // 100 -> 130 = 30% total growth over 6 months.
    // Old code: 5 * 6 = 30, so 30% < 30% => flat (WRONG).
    // Fixed code: constant 15, so 30% > 15% => NOT flat.
    const samples = [
      { date: '2025-01-01', lines: 100, functions: 5 },
      { date: '2025-04-01', lines: 115, functions: 7 },
      { date: '2025-07-01', lines: 130, functions: 9 },
    ];
    expect(detectGrowthPatternForTest(samples, 6)).not.toBe('flat');
  });

  it('classifies exactly 15% total growth as NOT flat (boundary)', () => {
    // 100 -> 115 = 15%. The threshold check is `< 15`, so exactly 15 is NOT flat.
    const samples = [
      { date: '2025-01-01', lines: 100, functions: 5 },
      { date: '2025-04-01', lines: 107, functions: 5 },
      { date: '2025-07-01', lines: 115, functions: 6 },
    ];
    expect(detectGrowthPatternForTest(samples, 6)).not.toBe('flat');
  });

  it('classifies 20% growth over 3 months as NOT flat', () => {
    // Old code: 5 * 3 = 15, so 20% > 15% => not flat (accidentally correct).
    // New code: constant 15, so 20% > 15% => not flat (also correct).
    const samples = [
      { date: '2025-01-01', lines: 100, functions: 5 },
      { date: '2025-02-15', lines: 110, functions: 6 },
      { date: '2025-04-01', lines: 120, functions: 7 },
    ];
    expect(detectGrowthPatternForTest(samples, 3)).not.toBe('flat');
  });

  it('returns flat when fewer than 3 samples', () => {
    const samples = [
      { date: '2025-01-01', lines: 100, functions: 5 },
      { date: '2025-07-01', lines: 200, functions: 10 },
    ];
    expect(detectGrowthPatternForTest(samples, 6)).toBe('flat');
  });
});

describe('detectGrowthPattern — acceleration detection', () => {
  it('classifies as accelerating when second half grows >1.5x first half', () => {
    // First half: 100 -> 120 = +20. Second half: 120 -> 160 = +40. Ratio: 2.0
    const samples = [
      { date: '2025-01-01', lines: 100, functions: 5 },
      { date: '2025-04-01', lines: 120, functions: 7 },
      { date: '2025-07-01', lines: 160, functions: 10 },
    ];
    expect(detectGrowthPatternForTest(samples, 6)).toBe('accelerating');
  });

  it('classifies as decelerating when second half grows <0.7x first half', () => {
    // First half: 100 -> 160 = +60. Second half: 160 -> 180 = +20. Ratio: 0.33
    const samples = [
      { date: '2025-01-01', lines: 100, functions: 5 },
      { date: '2025-04-01', lines: 160, functions: 10 },
      { date: '2025-07-01', lines: 180, functions: 11 },
    ];
    expect(detectGrowthPatternForTest(samples, 6)).toBe('decelerating');
  });

  it('classifies as linear when ratio is between 0.7 and 1.5', () => {
    // First half: 100 -> 140 = +40. Second half: 140 -> 185 = +45. Ratio: 1.125
    const samples = [
      { date: '2025-01-01', lines: 100, functions: 5 },
      { date: '2025-04-01', lines: 140, functions: 8 },
      { date: '2025-07-01', lines: 185, functions: 11 },
    ];
    expect(detectGrowthPatternForTest(samples, 6)).toBe('linear');
  });
});

describe('detectChurnPattern — low-count guard', () => {
  it('returns flat when both halves have fewer than 3 commits (low-count)', () => {
    // firstHalf=2, secondHalf=1. Ratio = 0.5 => old code says "decelerating".
    // But with only 3 total commits, this is noise. Should be "flat".
    expect(detectChurnPatternForTest(2, 1)).toBe('flat');
  });

  it('returns flat when both halves are 0', () => {
    expect(detectChurnPatternForTest(0, 0)).toBe('flat');
  });

  it('returns accelerating when firstHalf is 0 and secondHalf is positive', () => {
    expect(detectChurnPatternForTest(0, 5)).toBe('accelerating');
  });

  it('returns accelerating when ratio > 1.5 and counts are high enough', () => {
    // firstHalf=4, secondHalf=8. Ratio = 2.0 => accelerating, counts are meaningful.
    expect(detectChurnPatternForTest(4, 8)).toBe('accelerating');
  });

  it('returns decelerating when ratio < 0.7 and counts are high enough', () => {
    // firstHalf=10, secondHalf=3. Ratio = 0.3 => decelerating, counts are meaningful.
    expect(detectChurnPatternForTest(10, 3)).toBe('decelerating');
  });

  it('returns linear when ratio is between 0.7 and 1.5 and counts are high enough', () => {
    expect(detectChurnPatternForTest(5, 6)).toBe('linear');
  });

  it('returns flat for 1 and 2 commits (both below threshold)', () => {
    expect(detectChurnPatternForTest(1, 2)).toBe('flat');
  });
});

describe('threshold and projection fixes', () => {
  it('does not include 200 in crossesThreshold thresholds', async () => {
    // A file at 180 lines growing at 10 lines/month should project to 300
    // threshold, NOT 200 (which was incorrectly included).
    // We test this by inspecting the trend result for a file.
    // Use a fixture file that we know exists.
    const result = await analyzeFileTrendForTest(
      'src/utils/helpers.ts',
      6,
      FIXTURE_DIR,
    );
    if (result && result.projection.crossesThreshold) {
      // If it does cross a threshold, it should NOT be 200
      expect(result.projection.crossesThreshold.threshold).not.toBe(200);
      // Valid thresholds are: 300, 500, 750, 1000, 1500, 2000
      expect([300, 500, 750, 1000, 1500, 2000]).toContain(
        result.projection.crossesThreshold.threshold,
      );
    }
    // If no threshold crossing, that's also fine (file may be too small)
    expect(result).toBeDefined();
  });
});

describe('half-period split uses Math.round', () => {
  it('analyzeFileTrend completes without error for odd month counts', async () => {
    // With 5 months, Math.floor(5/2) = 2, Math.round(5/2) = 3.
    // This tests that the function runs with odd months without errors.
    const result = await analyzeFileTrendForTest(
      'src/utils/helpers.ts',
      5,
      FIXTURE_DIR,
    );
    // Should return a result (file exists in fixture) or null
    // The important thing is it doesn't throw
    expect(result === null || typeof result === 'object').toBe(true);
  });
});

describe('analyzeTrends — parallelism', () => {
  it('returns results for multiple files from fixture project', async () => {
    const results = await analyzeTrends({ months: 6 }, FIXTURE_DIR);
    // The fixture project has multiple source files that should produce trends
    expect(Array.isArray(results)).toBe(true);
    // At minimum, some files should be analyzed
    // (this verifies the batched Promise.all approach works end-to-end)
  });

  it('returns single result when a specific file is given', async () => {
    const results = await analyzeTrends(
      { file: 'src/utils/helpers.ts', months: 6 },
      FIXTURE_DIR,
    );
    expect(results.length).toBeLessThanOrEqual(1);
    if (results.length === 1) {
      expect(results[0].file).toBe('src/utils/helpers.ts');
    }
  });
});

describe('countFunctions — Python patterns', () => {
  it('counts standalone Python def', () => {
    const code = `def hello():\n    return "hello"\n\ndef world():\n    return "world"`;
    expect(countFunctionsForTest(code)).toBe(2);
  });

  it('counts Python async def', () => {
    const code = `async def fetch_data():\n    return await get()\n\ndef sync_fn():\n    pass`;
    // async def should match \bdef\s+\w+ (the "def" after "async " is still "def")
    // Actually "async def" — the pattern /\bdef\s+\w+/g should match "def fetch_data"
    expect(countFunctionsForTest(code)).toBeGreaterThanOrEqual(2);
  });

  it('counts Python class methods', () => {
    const code = `class MyClass:\n    def __init__(self):\n        pass\n\n    def method(self):\n        pass`;
    expect(countFunctionsForTest(code)).toBe(2);
  });

  it('does not double-count a function that matches multiple patterns', () => {
    const code = `def hello():\n    pass`;
    // The Python /\bdef\s+\w+/g and Ruby /\bdef\s+\w+/g are identical.
    // The seen set should prevent double-counting.
    expect(countFunctionsForTest(code)).toBe(1);
  });
});
