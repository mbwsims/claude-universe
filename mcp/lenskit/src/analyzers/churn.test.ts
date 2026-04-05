import { describe, it, expect } from 'vitest';
import { normalizePath, batchAnalyzeChurn } from './churn.js';
import { join } from 'node:path';

const FIXTURE_DIR = join(import.meta.dirname, '..', '..', '..', 'test-fixtures');

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

  it('warns when >80% files show zero churn', async () => {
    // In a freshly initialized repo, most files will show zero churn
    // unless setup-git-history.sh was run.
    // This test verifies the warning mechanism exists.
    const results = await batchAnalyzeChurn(FIXTURE_DIR);
    // The function should return results with a warning property
    // when too many files have zero churn
    const zeroChurnCount = Array.from(results.values()).filter(r => r.changes === 0).length;
    const totalCount = results.size;
    if (totalCount > 0 && zeroChurnCount / totalCount > 0.8) {
      // Expected: the warning should be attached or logged
      // We'll check the return type for the warning flag
      expect((results as any).__zeroChurnWarning).toBeDefined();
    }
  });
});
