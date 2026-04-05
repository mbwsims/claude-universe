import { describe, it, expect } from 'vitest';

// We test the ignore patterns by importing the constant.
// Since IGNORE_PATTERNS is a module-level const (not exported), we test
// indirectly through the discoverSourceFiles function.
import { discoverSourceFiles } from '../analyzers/discovery.js';
import { join } from 'node:path';

const FIXTURE_DIR = join(import.meta.dirname, '..', '..', '..', 'test-fixtures');

describe('discoverSourceFiles — Python detection', () => {
  it('discovers .py files in fixture project', async () => {
    const files = await discoverSourceFiles(FIXTURE_DIR);
    const pyFiles = files.filter((f) => f.endsWith('.py'));
    expect(pyFiles.length).toBeGreaterThan(0);
  });

  it('excludes Python test files (test_*.py)', async () => {
    const files = await discoverSourceFiles(FIXTURE_DIR);
    const testPrefixFiles = files.filter(
      (f) => f.endsWith('.py') && /(?:^|\/)test_\w+\.py$/.test(f),
    );
    expect(testPrefixFiles).toHaveLength(0);
  });

  it('excludes .d.ts files', async () => {
    const files = await discoverSourceFiles(FIXTURE_DIR);
    const dtsFiles = files.filter((f) => f.endsWith('.d.ts'));
    expect(dtsFiles.length).toBe(0);
  });
});

describe('discoverSourceFiles — ignore patterns', () => {
  it('excludes node_modules', async () => {
    const files = await discoverSourceFiles(FIXTURE_DIR);
    const nodeModFiles = files.filter((f) => f.includes('node_modules'));
    expect(nodeModFiles.length).toBe(0);
  });

  it('excludes dist directory', async () => {
    const files = await discoverSourceFiles(FIXTURE_DIR);
    const distFiles = files.filter((f) => f.startsWith('dist/'));
    expect(distFiles.length).toBe(0);
  });

  it('returns only files with recognized source extensions', async () => {
    const files = await discoverSourceFiles(FIXTURE_DIR);
    const validExtensions = [
      '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
      '.py', '.go', '.rs', '.rb', '.java', '.kt',
    ];
    for (const file of files) {
      const ext = file.substring(file.lastIndexOf('.'));
      expect(validExtensions).toContain(ext);
    }
  });
});
