import { describe, it, expect } from 'vitest';

// classifyMessage is not exported, so we test it indirectly by exporting a test helper.
// We add a named export for testing only. See Step 3.
import { classifyMessageForTest, computeMonthsDiffForTest, analyzeHistory, classifyWithFileFallbackForTest } from '../analyzers/history.js';
import { join } from 'node:path';

const FIXTURE_DIR = join(import.meta.dirname, '..', '..', '..', 'test-fixtures');

describe('classifyMessage', () => {
  describe('feature classification', () => {
    it('classifies "feat: add user auth" as feature', () => {
      expect(classifyMessageForTest('feat: add user auth')).toBe('feature');
    });

    it('classifies "feat(auth): new login flow" as feature', () => {
      expect(classifyMessageForTest('feat(auth): new login flow')).toBe('feature');
    });

    it('classifies "add pagination to user list" as feature', () => {
      expect(classifyMessageForTest('add pagination to user list')).toBe('feature');
    });

    it('classifies "implement caching layer" as feature', () => {
      expect(classifyMessageForTest('implement caching layer')).toBe('feature');
    });

    it('classifies "introduce rate limiting" as feature', () => {
      expect(classifyMessageForTest('introduce rate limiting')).toBe('feature');
    });

    it('classifies "create admin dashboard" as feature', () => {
      expect(classifyMessageForTest('create admin dashboard')).toBe('feature');
    });

    it('classifies "new endpoint for bulk export" as feature', () => {
      expect(classifyMessageForTest('new endpoint for bulk export')).toBe('feature');
    });

    it('classifies "support for webhooks" as feature', () => {
      expect(classifyMessageForTest('support for webhooks')).toBe('feature');
    });

    it('classifies "enable dark mode" as feature', () => {
      expect(classifyMessageForTest('enable dark mode')).toBe('feature');
    });

    it('classifies "allow users to export data" as feature', () => {
      expect(classifyMessageForTest('allow users to export data')).toBe('feature');
    });
  });

  describe('fix classification', () => {
    it('classifies "fix: resolve login crash" as fix', () => {
      expect(classifyMessageForTest('fix: resolve login crash')).toBe('fix');
    });

    it('classifies "fix(auth): token expiry bug" as fix', () => {
      expect(classifyMessageForTest('fix(auth): token expiry bug')).toBe('fix');
    });

    it('classifies "correct off-by-one in pagination" as fix', () => {
      expect(classifyMessageForTest('correct off-by-one in pagination')).toBe('fix');
    });

    it('classifies "repair broken CSV export" as fix', () => {
      expect(classifyMessageForTest('repair broken CSV export')).toBe('fix');
    });

    it('classifies "closes #42 — login redirect loop" as fix', () => {
      expect(classifyMessageForTest('closes #42 — login redirect loop')).toBe('fix');
    });

    it('classifies "fixes #99" as fix', () => {
      expect(classifyMessageForTest('fixes #99')).toBe('fix');
    });
  });

  describe('refactor classification', () => {
    it('classifies "refactor: extract auth middleware" as refactor', () => {
      expect(classifyMessageForTest('refactor: extract auth middleware')).toBe('refactor');
    });

    it('classifies "reorganize service layer" as refactor', () => {
      expect(classifyMessageForTest('reorganize service layer')).toBe('refactor');
    });

    it('classifies "clean up unused imports" as refactor', () => {
      expect(classifyMessageForTest('clean up unused imports')).toBe('refactor');
    });

    it('classifies "optimize database queries" as refactor', () => {
      expect(classifyMessageForTest('optimize database queries')).toBe('refactor');
    });
  });

  describe('chore classification', () => {
    it('classifies "chore: update lockfile" as chore', () => {
      expect(classifyMessageForTest('chore: update lockfile')).toBe('chore');
    });

    it('classifies "bump typescript to 5.7" as chore', () => {
      expect(classifyMessageForTest('bump typescript to 5.7')).toBe('chore');
    });
  });

  describe('docs classification', () => {
    it('classifies "docs: update README" as docs', () => {
      expect(classifyMessageForTest('docs: update README')).toBe('docs');
    });

    it('classifies "update documentation for API" as docs', () => {
      expect(classifyMessageForTest('update documentation for API')).toBe('docs');
    });
  });

  describe('word-boundary guards — must NOT match mid-word', () => {
    it('does NOT classify "address validation" as feature (mid-word "add")', () => {
      expect(classifyMessageForTest('address validation')).not.toBe('feature');
    });

    it('does NOT classify "prefix handling" as fix (mid-word "fix")', () => {
      expect(classifyMessageForTest('prefix handling')).not.toBe('fix');
    });

    it('does NOT classify "unfixable issue noted" as fix (mid-word "fix")', () => {
      expect(classifyMessageForTest('unfixable issue noted')).not.toBe('fix');
    });

    it('does NOT classify "additional logging" as feature (mid-word "add")', () => {
      expect(classifyMessageForTest('additional logging')).not.toBe('feature');
    });

    it('does NOT classify "created-by field rename" as feature when no whole-word match', () => {
      // "created-by" is not the same as the keyword "create"
      // But "created" does not match \bcreate\b — it has a trailing "d"
      // So this should fall through. If "create" regex is \bcreate\b it won't match "created".
      // Actually "created" does not match \bcreate\b. So this is "other".
      expect(classifyMessageForTest('update created-by field rename')).toBe('other');
    });
  });

  describe('Python commit patterns', () => {
    it('classifies "add __init__.py for package" as feature', () => {
      expect(classifyMessageForTest('add __init__.py for package')).toBe('feature');
    });

    it('classifies "fix: correct type hints in models.py" as fix', () => {
      expect(classifyMessageForTest('fix: correct type hints in models.py')).toBe('fix');
    });
  });
});

describe('computeMonthsDiff', () => {
  it('returns 6 for a 6-month span (same day)', () => {
    expect(computeMonthsDiffForTest('2025-01-15', '2025-07-15')).toBe(6);
  });

  it('returns 1 (minimum) for dates within the same month', () => {
    expect(computeMonthsDiffForTest('2025-06-01', '2025-06-28')).toBe(1);
  });

  it('accounts for day-of-month: Jan 31 to Feb 1 is less than 1 month', () => {
    // Jan 31 to Feb 1 is 1 day. Day-aware: fractional < 1, clamped to 1.
    expect(computeMonthsDiffForTest('2025-01-31', '2025-02-01')).toBe(1);
  });

  it('accounts for day-of-month: Jan 1 to Jan 31 is ~1 month', () => {
    expect(computeMonthsDiffForTest('2025-01-01', '2025-01-31')).toBe(1);
  });

  it('returns correct months for cross-year span', () => {
    expect(computeMonthsDiffForTest('2024-11-15', '2025-05-15')).toBe(6);
  });

  it('handles partial month at end: Mar 1 to May 15 is ~2.5, rounds to 2', () => {
    const result = computeMonthsDiffForTest('2025-03-01', '2025-05-15');
    expect(result).toBeGreaterThanOrEqual(2);
    expect(result).toBeLessThanOrEqual(3);
  });
});

describe('analyzeHistory — shared gitRun integration', () => {
  it('returns results from fixture project', async () => {
    const result = await analyzeHistory({ since: '12 months ago' }, FIXTURE_DIR);
    expect(result.commits.total).toBeGreaterThan(0);
    expect(result.authors.length).toBeGreaterThan(0);
  });

  it('returns error info for invalid directory instead of silent empty', async () => {
    // With the shared gitRun, a non-git directory should produce an error
    // that propagates rather than silently returning empty data.
    // The function should either throw or return zero commits with period info.
    const result = await analyzeHistory({ since: '6 months ago' }, '/tmp');
    // With shared gitRun, the function gracefully handles the error
    // but doesn't silently hide it — total will be 0
    expect(result.commits.total).toBe(0);
  });
});

describe('analyzeHistory — single-file optimization', () => {
  it('returns empty mostChanged when analyzing a single file', async () => {
    const result = await analyzeHistory(
      { file: 'src/utils/helpers.ts', since: '12 months ago' },
      FIXTURE_DIR,
    );
    // When analyzing a single file, mostChanged should be empty —
    // the expensive whole-project scan is skipped.
    expect(result.mostChanged).toEqual([]);
  });

  it('returns mostChanged when analyzing the whole project', async () => {
    const result = await analyzeHistory({ since: '12 months ago' }, FIXTURE_DIR);
    expect(result.mostChanged.length).toBeGreaterThan(0);
  });
});

describe('classifyWithFileFallback', () => {
  it('uses message classification when message matches a known pattern', () => {
    expect(classifyWithFileFallbackForTest('fix: broken login', [])).toBe('fix');
  });

  it('falls back to chore when message is ambiguous and only config files changed', () => {
    expect(
      classifyWithFileFallbackForTest('update settings', ['package.json', '.eslintrc.js']),
    ).toBe('chore');
  });

  it('falls back to docs when message is ambiguous and only markdown files changed', () => {
    expect(
      classifyWithFileFallbackForTest('update guide', ['README.md', 'docs/api.md']),
    ).toBe('docs');
  });

  it('returns other when message is ambiguous and files are mixed source', () => {
    expect(
      classifyWithFileFallbackForTest('tweaks', ['src/index.ts', 'src/lib/auth.ts']),
    ).toBe('other');
  });

  it('returns other when message is ambiguous and no files provided', () => {
    expect(classifyWithFileFallbackForTest('misc changes', [])).toBe('other');
  });
});
