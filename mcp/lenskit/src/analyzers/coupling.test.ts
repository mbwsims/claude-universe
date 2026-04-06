import { describe, it, expect } from 'vitest';
import { buildImportIndex, lookupCoupling } from './coupling.js';
import { join } from 'node:path';

const FIXTURE_DIR = join(import.meta.dirname, '..', '..', '..', 'test-fixtures');

describe('lookupCoupling', () => {
  describe('basename disambiguation', () => {
    it('does NOT false-positive match files with same basename in different directories', () => {
      // Two files: src/db/connection.ts and src/api/connection.ts
      // An import of ./db/connection should NOT match src/api/connection.ts
      const importIndex = new Map<string, string[]>([
        ['src/routes/handler.ts', ['../db/connection']],
        ['src/api/connection.ts', []],
        ['src/db/connection.ts', []],
      ]);

      const result = lookupCoupling('src/db/connection.ts', importIndex);
      expect(result.importers).toEqual(['src/routes/handler.ts']);
      expect(result.importerCount).toBe(1);
    });

    it('does NOT match unrelated file with same basename', () => {
      const importIndex = new Map<string, string[]>([
        ['src/auth/utils.ts', ['../shared/utils']],
        ['src/shared/utils.ts', []],
        ['src/db/utils.ts', []],
      ]);

      const result = lookupCoupling('src/db/utils.ts', importIndex);
      expect(result.importers).toEqual([]);
      expect(result.importerCount).toBe(0);
    });

    it('correctly matches when import path contains directory segment', () => {
      const importIndex = new Map<string, string[]>([
        ['src/routes/user-routes.ts', ['../services/user-service']],
        ['src/services/user-service.ts', []],
      ]);

      const result = lookupCoupling('src/services/user-service.ts', importIndex);
      expect(result.importers).toEqual(['src/routes/user-routes.ts']);
      expect(result.importerCount).toBe(1);
    });
  });

  describe('tsconfig path alias resolution', () => {
    it('matches aliased import @/services/user-service to src/services/user-service.ts', () => {
      const importIndex = new Map<string, string[]>([
        ['src/routes/handler.ts', ['@/services/user-service']],
        ['src/services/user-service.ts', []],
      ]);

      const result = lookupCoupling('src/services/user-service.ts', importIndex, {
        baseUrl: '.',
        paths: { '@/*': ['src/*'] },
      });
      expect(result.importers).toEqual(['src/routes/handler.ts']);
      expect(result.importerCount).toBe(1);
    });

    it('matches aliased import @db/connection to src/db/connection.ts', () => {
      const importIndex = new Map<string, string[]>([
        ['src/services/auth.ts', ['@db/connection']],
        ['src/db/connection.ts', []],
      ]);

      const result = lookupCoupling('src/db/connection.ts', importIndex, {
        baseUrl: '.',
        paths: { '@db/*': ['src/db/*'] },
      });
      expect(result.importers).toEqual(['src/services/auth.ts']);
      expect(result.importerCount).toBe(1);
    });

    it('does NOT match aliased import to wrong file', () => {
      const importIndex = new Map<string, string[]>([
        ['src/routes/handler.ts', ['@/services/auth-service']],
        ['src/services/user-service.ts', []],
      ]);

      const result = lookupCoupling('src/services/user-service.ts', importIndex, {
        baseUrl: '.',
        paths: { '@/*': ['src/*'] },
      });
      expect(result.importers).toEqual([]);
    });

    it('works without tsconfig paths (graceful degradation)', () => {
      const importIndex = new Map<string, string[]>([
        ['src/routes/handler.ts', ['../services/user-service']],
        ['src/services/user-service.ts', []],
      ]);

      const result = lookupCoupling('src/services/user-service.ts', importIndex);
      expect(result.importers).toEqual(['src/routes/handler.ts']);
    });
  });

  describe('Python import resolution', () => {
    it('matches Python relative import (from .models import X)', () => {
      const importIndex = new Map<string, string[]>([
        ['src/py/api.py', ['.models']],
        ['src/py/models.py', []],
      ]);

      const result = lookupCoupling('src/py/models.py', importIndex);
      expect(result.importers).toEqual(['src/py/api.py']);
    });

    it('matches Python dotted module import (from ..utils import X)', () => {
      const importIndex = new Map<string, string[]>([
        ['src/py/sub/handler.py', ['..utils']],
        ['src/py/utils.py', []],
      ]);

      const result = lookupCoupling('src/py/utils.py', importIndex);
      expect(result.importers).toEqual(['src/py/sub/handler.py']);
    });

    it('does NOT match unrelated Python module', () => {
      const importIndex = new Map<string, string[]>([
        ['src/py/api.py', ['.models']],
        ['src/py/utils.py', []],
      ]);

      const result = lookupCoupling('src/py/utils.py', importIndex);
      expect(result.importers).toEqual([]);
    });
  });
});

describe('buildImportIndex', () => {
  it('builds index from fixture project', async () => {
    const index = await buildImportIndex(FIXTURE_DIR);
    expect(index.size).toBeGreaterThan(0);

    // user-routes.ts imports from ../services/user-service
    const routeImports = index.get('src/routes/user-routes.ts');
    expect(routeImports).toBeDefined();
    expect(routeImports!.some(p => p.includes('user-service'))).toBe(true);
  });
});
