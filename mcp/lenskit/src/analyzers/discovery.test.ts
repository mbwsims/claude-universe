import { describe, it, expect } from 'vitest';
import { discoverSourceFiles } from './discovery.js';
import { join } from 'node:path';

const FIXTURE_DIR = join(import.meta.dirname, '..', '..', '..', 'test-fixtures');

describe('discoverSourceFiles', () => {
  it('discovers TypeScript source files from fixture project', async () => {
    const files = await discoverSourceFiles(FIXTURE_DIR);
    expect(files.some(f => f.endsWith('.ts'))).toBe(true);
  });

  it('discovers Python source files', async () => {
    const files = await discoverSourceFiles(FIXTURE_DIR);
    expect(files.some(f => f.endsWith('.py'))).toBe(true);
  });

  it('excludes test files (*.test.ts, *.spec.ts)', async () => {
    const files = await discoverSourceFiles(FIXTURE_DIR);
    expect(files.every(f => !f.match(/\.test\.\w+$/))).toBe(true);
    expect(files.every(f => !f.match(/\.spec\.\w+$/))).toBe(true);
  });

  it('excludes Python test files (test_*.py)', async () => {
    const files = await discoverSourceFiles(FIXTURE_DIR);
    const pyTestFiles = files.filter(f => {
      const name = f.split('/').pop() ?? '';
      return name.startsWith('test_') && name.endsWith('.py');
    });
    expect(pyTestFiles).toEqual([]);
  });

  it('excludes .d.ts declaration files', async () => {
    const files = await discoverSourceFiles(FIXTURE_DIR);
    expect(files.every(f => !f.endsWith('.d.ts'))).toBe(true);
  });

  it('excludes __tests__ directory contents', async () => {
    const files = await discoverSourceFiles(FIXTURE_DIR);
    expect(files.every(f => !f.includes('__tests__'))).toBe(true);
  });

  it('excludes node_modules', async () => {
    const files = await discoverSourceFiles(FIXTURE_DIR);
    expect(files.every(f => !f.includes('node_modules'))).toBe(true);
  });
});
