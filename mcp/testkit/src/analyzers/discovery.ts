/**
 * Test file discovery, source mapping, and framework detection.
 */

import { readFile } from 'node:fs/promises';
import { join, dirname, basename, extname } from 'node:path';
import { existsSync } from 'node:fs';
import { globby } from 'globby';

export interface TestFile {
  path: string;
  sourcePath: string | null;
}

export interface SourceMapping {
  framework: string | null;
  testFiles: TestFile[];
  sourceFiles: string[];
  untested: Array<{ path: string; priority: 'high' | 'medium' | 'low'; reason: string }>;
  coverageRatio: number;
}

const TEST_PATTERNS = [
  '**/*.test.*',
  '**/*.spec.*',
  '**/__tests__/**/*.*',
  '**/test_*.py',
  '**/*_test.py',
];

const IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/.git/**',
  '**/vendor/**',
  '**/.next/**',
  '**/.nuxt/**',
];

const SOURCE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.rs', '.rb', '.java', '.kt',
]);

const HIGH_CRITICALITY_PATTERNS = [
  /auth/i, /login/i, /session/i, /token/i,
  /payment/i, /billing/i, /checkout/i, /charge/i, /invoice/i,
  /security/i, /permission/i, /access/i, /rbac/i, /acl/i,
  /middleware/i,
  /migrat/i,
  /password/i, /credential/i, /secret/i,
  /encrypt/i, /decrypt/i, /hash/i,
  /webhook/i,
  /admin/i,
];

const MEDIUM_CRITICALITY_PATTERNS = [
  /service/i, /controller/i, /handler/i, /resolver/i,
  /repository/i, /store/i, /model/i,
  /api/i, /route/i, /endpoint/i,
  /database/i, /db/i, /query/i,
  /cache/i,
  /queue/i, /worker/i, /job/i,
];

export function classifyCriticality(filePath: string): { priority: 'high' | 'medium' | 'low'; reason: string } {
  const name = basename(filePath);
  const dir = dirname(filePath);
  const combined = `${dir}/${name}`;

  for (const pattern of HIGH_CRITICALITY_PATTERNS) {
    if (pattern.test(combined)) {
      return { priority: 'high', reason: `matches critical pattern: ${pattern.source}` };
    }
  }

  for (const pattern of MEDIUM_CRITICALITY_PATTERNS) {
    if (pattern.test(combined)) {
      return { priority: 'medium', reason: `matches business logic pattern: ${pattern.source}` };
    }
  }

  return { priority: 'low', reason: 'utility or helper file' };
}

export function isTestFile(filePath: string): boolean {
  const name = basename(filePath);
  return /\.(test|spec)\./.test(name)
    || filePath.includes('__tests__')
    || /^test_.*\.py$/.test(name)
    || /.*_test\.py$/.test(name);
}

export function inferSourcePath(testPath: string, cwd?: string): string | null {
  const dir = dirname(testPath);
  const name = basename(testPath);

  // Standard JS/TS test naming: foo.test.ts -> foo.ts, foo.spec.tsx -> foo.tsx
  const jsMatch = name.match(/^(.+)\.(test|spec)(\.[^.]+)$/);

  // Python test naming: test_foo.py -> foo.py, foo_test.py -> foo.py
  const pyTestPrefixMatch = name.match(/^test_(.+\.py)$/);
  const pyTestSuffixMatch = name.match(/^(.+)_test(\.py)$/);

  let sourceName: string | null = null;

  if (jsMatch) {
    sourceName = `${jsMatch[1]}${jsMatch[3]}`;
  } else if (pyTestPrefixMatch) {
    sourceName = pyTestPrefixMatch[1];
  } else if (pyTestSuffixMatch) {
    sourceName = `${pyTestSuffixMatch[1]}${pyTestSuffixMatch[2]}`;
  }

  if (!sourceName) return null;

  const candidates: string[] = [];

  // Same directory
  candidates.push(join(dir, sourceName));

  // If in __tests__, try parent directory
  if (dir.includes('__tests__')) {
    const parentDir = dir.replace(/__tests__\/?/, '');
    candidates.push(join(parentDir, sourceName));
  }

  // Try tests/ -> src/ directory mirror
  if (dir.startsWith('test') || dir.startsWith('tests')) {
    const srcDir = dir.replace(/^tests?/, 'src');
    candidates.push(join(srcDir, sourceName));
  }

  // If cwd provided, verify existence and return first match
  if (cwd) {
    for (const candidate of candidates) {
      if (existsSync(join(cwd, candidate))) {
        return candidate;
      }
    }
    return null;
  }

  // Without cwd, return best guess (first candidate)
  return candidates[0];
}

export async function discoverTestFiles(cwd: string): Promise<string[]> {
  return globby(TEST_PATTERNS, {
    cwd,
    ignore: IGNORE_PATTERNS,
    absolute: false,
  });
}

export async function discoverSourceFiles(cwd: string): Promise<string[]> {
  const allFiles = await globby(['**/*'], {
    cwd,
    // Note: **/types/** removed -- type files may contain runtime code
    ignore: [...IGNORE_PATTERNS, ...TEST_PATTERNS, '**/*.d.ts'],
    absolute: false,
  });

  return allFiles.filter(f => SOURCE_EXTENSIONS.has(extname(f)));
}

export async function detectFramework(cwd: string): Promise<string | null> {
  const configPatterns: Record<string, string> = {
    'vitest.config.*': 'vitest',
    'jest.config.*': 'jest',
    'pytest.ini': 'pytest',
    'setup.cfg': 'pytest',       // setup.cfg can contain [tool:pytest]
    'Cargo.toml': 'cargo-test',
    'go.mod': 'go-test',
  };

  for (const [pattern, framework] of Object.entries(configPatterns)) {
    const matches = await globby(pattern, { cwd, ignore: IGNORE_PATTERNS });
    if (matches.length > 0) return framework;
  }

  // Check pyproject.toml for pytest or unittest config
  try {
    const pyprojectContent = await readFile(join(cwd, 'pyproject.toml'), 'utf-8');
    if (pyprojectContent.includes('[tool.pytest') || pyprojectContent.includes('pytest')) {
      return 'pytest';
    }
  } catch {
    // no pyproject.toml
  }

  // Check package.json for test framework deps
  try {
    const pkgContent = await readFile(join(cwd, 'package.json'), 'utf-8');
    const pkg = JSON.parse(pkgContent);
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (allDeps.vitest) return 'vitest';
    if (allDeps.jest) return 'jest';
    if (allDeps.mocha) return 'mocha';
    if (allDeps.ava) return 'ava';
    if (allDeps.tap) return 'tap';
  } catch {
    // no package.json
  }

  // Check for Python test files as a fallback for pytest detection
  const pyTestFiles = await globby(['**/test_*.py', '**/*_test.py'], {
    cwd,
    ignore: IGNORE_PATTERNS,
  });
  if (pyTestFiles.length > 0) {
    // Check if any test file imports unittest
    try {
      for (const testFile of pyTestFiles.slice(0, 5)) {
        const content = await readFile(join(cwd, testFile), 'utf-8');
        if (content.includes('import unittest') || content.includes('from unittest')) {
          return 'unittest';
        }
      }
    } catch {
      // file read error
    }
    return 'pytest'; // default Python test framework
  }

  return null;
}

export async function buildSourceMapping(cwd: string): Promise<SourceMapping> {
  const [testFilePaths, sourceFilePaths, framework] = await Promise.all([
    discoverTestFiles(cwd),
    discoverSourceFiles(cwd),
    detectFramework(cwd),
  ]);

  const testFiles: TestFile[] = testFilePaths.map(path => ({
    path,
    sourcePath: inferSourcePath(path, cwd),
  }));

  // Find untested source files
  const testedSources = new Set(
    testFiles
      .map(t => t.sourcePath)
      .filter((p): p is string => p !== null)
  );

  const untested = sourceFilePaths
    .filter(s => !isTestFile(s) && !testedSources.has(s))
    .map(path => ({
      path,
      ...classifyCriticality(path),
    }))
    // Sort: high first, then medium, then low
    .sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.priority] - order[b.priority];
    });

  const coverageRatio = sourceFilePaths.length === 0
    ? 0
    : testedSources.size / sourceFilePaths.length;

  return {
    framework,
    testFiles,
    sourceFiles: sourceFilePaths,
    untested,
    coverageRatio: Math.round(coverageRatio * 1000) / 1000,
  };
}
