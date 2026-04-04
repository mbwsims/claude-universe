import { describe, it, expect } from 'vitest';
import {
  scoreAssertionDepth,
  scoreErrorTesting,
  scoreMockHealth,
  scoreSpecClarity,
  computeOverallGrade,
  valueToGrade,
} from '../scoring.js';

describe('scoreAssertionDepth', () => {
  it('returns null for zero total assertions', () => {
    expect(scoreAssertionDepth({ count: 0, total: 0, locations: [] })).toBeNull();
  });

  it('returns A for zero shallow assertions', () => {
    expect(scoreAssertionDepth({ count: 0, total: 10, locations: [] })).toBe('A');
  });

  it('returns F for nearly all shallow', () => {
    expect(scoreAssertionDepth({ count: 9, total: 10, locations: [] })).toBe('F');
  });

  it('returns C range for 40% shallow', () => {
    const grade = scoreAssertionDepth({ count: 4, total: 10, locations: [] });
    expect(grade).toBe('C+');
  });
});

describe('scoreErrorTesting', () => {
  it('returns null when no throwable operations', () => {
    expect(scoreErrorTesting({
      throwable: 0, tested: 0, ratio: 1,
      throwableLocations: [], errorTestLocations: [],
    })).toBeNull();
  });

  it('returns A for full coverage', () => {
    expect(scoreErrorTesting({
      throwable: 5, tested: 5, ratio: 1,
      throwableLocations: [], errorTestLocations: [],
    })).toBe('A');
  });

  it('returns F for zero coverage with throwable ops', () => {
    expect(scoreErrorTesting({
      throwable: 5, tested: 0, ratio: 0,
      throwableLocations: [], errorTestLocations: [],
    })).toBe('F');
  });
});

describe('scoreMockHealth', () => {
  it('returns A for no mocks at all', () => {
    expect(scoreMockHealth({
      total: 0, boundary: 0, internal: 0, setupPercent: 0, mocks: [],
    })).toBe('A');
  });

  it('returns A for boundary-only mocks with low setup', () => {
    expect(scoreMockHealth({
      total: 3, boundary: 3, internal: 0, setupPercent: 15, mocks: [],
    })).toBe('A');
  });

  it('returns A- for boundary-only mocks with moderate setup (21-30%)', () => {
    expect(scoreMockHealth({
      total: 3, boundary: 3, internal: 0, setupPercent: 25, mocks: [],
    })).toBe('A-');
  });

  it('downgrades for internal mocks', () => {
    const grade = scoreMockHealth({
      total: 4, boundary: 2, internal: 2, setupPercent: 15, mocks: [],
    });
    expect(['B-', 'C+', 'C']).toContain(grade);
  });
});

describe('scoreSpecClarity', () => {
  it('returns null for zero test names', () => {
    expect(scoreSpecClarity({ total: 0, vague: 0, vagueNames: [] })).toBeNull();
  });

  it('returns A for zero vague names', () => {
    expect(scoreSpecClarity({ total: 10, vague: 0, vagueNames: [] })).toBe('A');
  });

  it('returns F for all vague names', () => {
    expect(scoreSpecClarity({ total: 10, vague: 10, vagueNames: [] })).toBe('F');
  });
});

describe('computeOverallGrade', () => {
  it('caps at C when error testing is F', () => {
    const grade = computeOverallGrade({
      assertionDepth: 'A',
      inputCoverage: null,
      errorTesting: 'F',
      mockHealth: 'A',
      specClarity: 'A',
      independence: null,
    });
    expect(grade).toBe('C');
  });

  it('caps at C+ when assertion depth is C or worse', () => {
    const grade = computeOverallGrade({
      assertionDepth: 'C',
      inputCoverage: null,
      errorTesting: 'A',
      mockHealth: 'A',
      specClarity: 'A',
      independence: null,
    });
    expect(grade).toBe('C+');
  });

  it('returns A for all-A dimensions', () => {
    const grade = computeOverallGrade({
      assertionDepth: 'A',
      inputCoverage: null,
      errorTesting: 'A',
      mockHealth: 'A',
      specClarity: 'A',
      independence: null,
    });
    expect(grade).toBe('A');
  });

  it('returns C when no measurable dimensions', () => {
    const grade = computeOverallGrade({
      assertionDepth: null,
      inputCoverage: null,
      errorTesting: null,
      mockHealth: null,
      specClarity: null,
      independence: null,
    });
    expect(grade).toBe('C');
  });
});

describe('valueToGrade', () => {
  it('maps 4.0 to A', () => {
    expect(valueToGrade(4.0)).toBe('A');
  });

  it('maps 0 to F', () => {
    expect(valueToGrade(0)).toBe('F');
  });

  it('maps 3.0 to B', () => {
    expect(valueToGrade(3.0)).toBe('B');
  });
});
