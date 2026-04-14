/**
 * Shared discovery constants and utilities used by all MCP servers.
 */

import { readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';

export const IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/.git/**',
  '**/vendor/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/__pycache__/**',
  '**/*.egg-info/**',
  '**/target/**',
  '**/.venv/**',
  '**/venv/**',
  '**/test-fixtures/**',
];

export const SOURCE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.rs', '.rb', '.java', '.kt',
]);

export const TEST_PATTERNS = [
  /\.(test|spec)\./,
  /__tests__\//,
  /(?:^|\/)test_\w+\.py$/,
  /(?:^|\/)conftest\.py$/,
  /_test\.go$/,
];

export function isTestFile(filePath: string): boolean {
  return TEST_PATTERNS.some(re => re.test(filePath));
}

export function isDeclarationFile(filePath: string): boolean {
  return filePath.endsWith('.d.ts');
}

function normalizePath(filePath: string): string {
  return filePath.split('\\').join('/');
}

function shouldIgnorePath(filePath: string): boolean {
  const segments = normalizePath(filePath).split('/').filter(Boolean);

  return segments.some(segment =>
    segment === 'node_modules' ||
    segment === 'dist' ||
    segment === 'build' ||
    segment === 'coverage' ||
    segment === '.git' ||
    segment === 'vendor' ||
    segment === '.next' ||
    segment === '.nuxt' ||
    segment === '__pycache__' ||
    segment === 'target' ||
    segment === '.venv' ||
    segment === 'venv' ||
    segment === 'test-fixtures' ||
    segment.endsWith('.egg-info'),
  );
}

async function walkFiles(cwd: string, relativeDir = ''): Promise<string[]> {
  const absoluteDir = relativeDir ? join(cwd, relativeDir) : cwd;
  const entries = await readdir(absoluteDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const relativePath = normalizePath(relativeDir ? join(relativeDir, entry.name) : entry.name);

    if (shouldIgnorePath(relativePath)) {
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...await walkFiles(cwd, relativePath));
      continue;
    }

    if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return files;
}

/**
 * Discover source files in a project, excluding tests, declaration files,
 * and common non-source directories.
 */
export async function discoverSourceFiles(cwd: string): Promise<string[]> {
  const allFiles = await walkFiles(cwd);

  return allFiles.filter(
    (f: string) => SOURCE_EXTENSIONS.has(extname(f)) && !isTestFile(f) && !isDeclarationFile(f),
  );
}
