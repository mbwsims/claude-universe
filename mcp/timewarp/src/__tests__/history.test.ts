import { describe, it, expect } from 'vitest';

// classifyMessage is not exported, so we test it indirectly by exporting a test helper.
// We add a named export for testing only. See Step 3.
import { classifyMessageForTest } from '../analyzers/history.js';

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
