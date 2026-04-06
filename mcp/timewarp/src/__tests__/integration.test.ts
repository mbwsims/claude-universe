import { describe, it, expect } from 'vitest';
import { analyzeHistory } from '../analyzers/history.js';
import { analyzeTrends } from '../analyzers/trends.js';
import { discoverSourceFiles } from '../analyzers/discovery.js';
import { join } from 'node:path';

const FIXTURE_DIR = join(import.meta.dirname, '..', '..', '..', 'test-fixtures');

describe('integration — fixture project', () => {
  describe('history analysis', () => {
    it('finds all 15 commits in fixture project', async () => {
      const result = await analyzeHistory({ since: '2 years ago' }, FIXTURE_DIR);
      expect(result.commits.total).toBe(15);
    });

    it('classifies fixture commits correctly', async () => {
      const result = await analyzeHistory({ since: '2 years ago' }, FIXTURE_DIR);
      const c = result.classification;
      // Fixture commits:
      // 1: "chore: initial project setup" => chore
      // 2-8: "feat: ..." => feature (7 feat commits)
      // 9: "feat: add initial test suite" => feature
      // 10: "feat: add Python API and utilities" => feature
      // 11: "fix: handle empty token string..." => fix
      // 12: "refactor: optimize slugify..." => refactor
      // 13: "feat: add pagination..." => feature
      // 14: "fix: add rate limiting..." => fix
      // 15: "chore: bump dependency versions" => chore
      expect(c.feature).toBeGreaterThanOrEqual(8);
      expect(c.fix).toBeGreaterThanOrEqual(2);
      expect(c.refactor).toBeGreaterThanOrEqual(1);
      expect(c.chore).toBeGreaterThanOrEqual(2);
    });

    it('identifies authors in fixture project', async () => {
      const result = await analyzeHistory({ since: '2 years ago' }, FIXTURE_DIR);
      expect(result.authors.length).toBeGreaterThan(0);
    });

    it('returns mostChanged files for whole-project analysis', async () => {
      const result = await analyzeHistory({ since: '2 years ago' }, FIXTURE_DIR);
      expect(result.mostChanged.length).toBeGreaterThan(0);
    });

    it('returns empty mostChanged for single-file analysis', async () => {
      const result = await analyzeHistory(
        { file: 'src/utils/helpers.ts', since: '2 years ago' },
        FIXTURE_DIR,
      );
      expect(result.mostChanged).toEqual([]);
    });

    it('returns period information', async () => {
      const result = await analyzeHistory({ since: '2 years ago' }, FIXTURE_DIR);
      expect(result.period.since).toBeTruthy();
      expect(result.period.until).toBeTruthy();
    });
  });

  describe('trends analysis', () => {
    it('analyzes trends for fixture files', async () => {
      const results = await analyzeTrends({ months: 12 }, FIXTURE_DIR);
      expect(Array.isArray(results)).toBe(true);
    });

    it('returns growth data for a specific file', async () => {
      const results = await analyzeTrends(
        { file: 'src/utils/helpers.ts', months: 12 },
        FIXTURE_DIR,
      );
      if (results.length > 0) {
        const trend = results[0];
        expect(trend.file).toBe('src/utils/helpers.ts');
        expect(trend.growth).toBeDefined();
        expect(trend.churn).toBeDefined();
        expect(trend.projection).toBeDefined();
        expect(trend.samples.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('projections do not use 200-line threshold', async () => {
      const results = await analyzeTrends({ months: 12 }, FIXTURE_DIR);
      for (const trend of results) {
        if (trend.projection.crossesThreshold) {
          expect(trend.projection.crossesThreshold.threshold).not.toBe(200);
        }
      }
    });
  });

  describe('discovery', () => {
    it('discovers TypeScript source files in fixture project', async () => {
      const files = await discoverSourceFiles(FIXTURE_DIR);
      const tsFiles = files.filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'));
      expect(tsFiles.length).toBeGreaterThan(0);
    });

    it('discovers Python source files in fixture project', async () => {
      const files = await discoverSourceFiles(FIXTURE_DIR);
      const pyFiles = files.filter((f) => f.endsWith('.py'));
      expect(pyFiles.length).toBeGreaterThan(0);
    });

    it('excludes test files', async () => {
      const files = await discoverSourceFiles(FIXTURE_DIR);
      const testFiles = files.filter(
        (f) => f.includes('.test.') || f.includes('.spec.') || f.includes('__tests__'),
      );
      expect(testFiles.length).toBe(0);
    });
  });
});
