import { beforeAll, describe, it, expect } from 'vitest';
import { normalizePath, batchAnalyzeChurn } from './churn.js';
import { join } from 'node:path';
import { ensureFixtureGitHistory } from '../../../shared/test-fixture-git.js';

const FIXTURE_DIR = join(import.meta.dirname, '..', '..', '..', 'test-fixtures');

beforeAll(async () => {
  await ensureFixtureGitHistory(FIXTURE_DIR);
});

describe('normalizePath', () => {
  it('strips leading ./ from paths', () => {
    expect(normalizePath('./src/index.ts')).toBe('src/index.ts');
  });

  it('leaves clean paths unchanged', () => {
    expect(normalizePath('src/index.ts')).toBe('src/index.ts');
  });

  it('strips multiple leading ./ occurrences', () => {
    expect(normalizePath('././src/index.ts')).toBe('src/index.ts');
  });

  it('handles empty string', () => {
    expect(normalizePath('')).toBe('');
  });

  it('normalizes backslashes to forward slashes', () => {
    expect(normalizePath('src\\utils\\helpers.ts')).toBe('src/utils/helpers.ts');
  });
});

describe('batchAnalyzeChurn', () => {
  it('returns a map with file paths as keys', async () => {
    const results = await batchAnalyzeChurn(FIXTURE_DIR);
    // The fixture project should have git history (set up in Phase 0)
    expect(results).toBeInstanceOf(Map);
  });

  it('returns ChurnResult values with expected shape', async () => {
    const results = await batchAnalyzeChurn(FIXTURE_DIR);
    for (const [, result] of results) {
      expect(result).toHaveProperty('changes');
      expect(result).toHaveProperty('authors');
      expect(result).toHaveProperty('period', '6 months');
    }
  });
});
