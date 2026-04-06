/**
 * Shared discovery constants and utilities used by all MCP servers.
 */

import { extname } from 'node:path';
import { glob } from 'tinyglobby';

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

/**
 * Discover source files in a project, excluding tests, declaration files,
 * and common non-source directories.
 */
export async function discoverSourceFiles(cwd: string): Promise<string[]> {
  const allFiles = await glob(['**/*'], {
    cwd,
    ignore: IGNORE_PATTERNS,
    absolute: false,
  });

  return allFiles.filter(
    f => SOURCE_EXTENSIONS.has(extname(f)) && !isTestFile(f) && !isDeclarationFile(f),
  );
}
