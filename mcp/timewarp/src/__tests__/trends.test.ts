import { describe, it, expect } from 'vitest';

// We test detectGrowthPattern via a test-only export. See Step 3.
import { detectGrowthPatternForTest } from '../analyzers/trends.js';

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
