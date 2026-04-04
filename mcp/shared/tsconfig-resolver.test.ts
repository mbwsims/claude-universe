import { describe, it, expect } from 'vitest';
import { parseTsconfig, resolveAliasedImport } from './tsconfig-resolver.js';
import { join } from 'node:path';

const FIXTURE_DIR = join(import.meta.dirname, '..', 'test-fixtures');

describe('parseTsconfig', () => {
  it('parses paths and baseUrl from fixture tsconfig', async () => {
    const result = await parseTsconfig(FIXTURE_DIR);
    expect(result).toEqual({
      baseUrl: '.',
      paths: {
        '@/*': ['src/*'],
        '@db/*': ['src/db/*'],
        '@services/*': ['src/services/*'],
      },
    });
  });

  it('returns null for directory without tsconfig', async () => {
    const result = await parseTsconfig('/tmp/nonexistent-dir-12345');
    expect(result).toBeNull();
  });
});

describe('resolveAliasedImport', () => {
  it('resolves @/ alias to src/', () => {
    const result = resolveAliasedImport(
      '@/utils/helpers',
      { '@/*': ['src/*'] },
      '.'
    );
    expect(result).toBe('src/utils/helpers');
  });

  it('resolves @db/ alias to src/db/', () => {
    const result = resolveAliasedImport(
      '@db/connection',
      { '@db/*': ['src/db/*'] },
      '.'
    );
    expect(result).toBe('src/db/connection');
  });

  it('resolves @services/ alias', () => {
    const result = resolveAliasedImport(
      '@services/user-service',
      { '@services/*': ['src/services/*'] },
      '.'
    );
    expect(result).toBe('src/services/user-service');
  });

  it('returns null for non-aliased relative import', () => {
    const result = resolveAliasedImport(
      './helpers',
      { '@/*': ['src/*'] },
      '.'
    );
    expect(result).toBeNull();
  });

  it('returns null for node_modules import', () => {
    const result = resolveAliasedImport(
      'lodash',
      { '@/*': ['src/*'] },
      '.'
    );
    expect(result).toBeNull();
  });

  it('handles baseUrl prefix correctly', () => {
    const result = resolveAliasedImport(
      '@/db/connection',
      { '@/*': ['src/*'] },
      'app'
    );
    expect(result).toBe('app/src/db/connection');
  });

  it('handles paths with multiple mapping targets (uses first)', () => {
    const result = resolveAliasedImport(
      '@/foo',
      { '@/*': ['src/*', 'lib/*'] },
      '.'
    );
    expect(result).toBe('src/foo');
  });
});
