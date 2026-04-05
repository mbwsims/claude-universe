/**
 * discovery.ts -- Find all source files in a project.
 *
 * Globs for source files, excluding build artifacts, test files, and
 * type declaration files.
 */

import { globby } from 'globby';

const SOURCE_EXTENSIONS = [
  '**/*.ts',
  '**/*.tsx',
  '**/*.js',
  '**/*.jsx',
  '**/*.py',
  '**/*.go',
  '**/*.rs',
  '**/*.rb',
  '**/*.java',
];

const IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.git/**',
  '**/vendor/**',
  '**/coverage/**',
  // Type declaration files (moved from TEST_PATTERNS -- these are not tests)
  '**/*.d.ts',
];

const TEST_PATTERNS = [
  // JS/TS test patterns
  /\.test\.\w+$/,
  /\.spec\.\w+$/,
  /_test\.\w+$/,
  /_spec\.\w+$/,
  /__tests__\//,
  // Python test patterns
  /(?:^|\/)test_\w+\.py$/,
  /(?:^|\/)conftest\.py$/,
  // Go test pattern
  /_test\.go$/,
];

export async function discoverSourceFiles(cwd: string): Promise<string[]> {
  const paths = await globby(SOURCE_EXTENSIONS, {
    cwd,
    ignore: IGNORE_PATTERNS,
    gitignore: true,
  });

  return paths.filter((p) => !TEST_PATTERNS.some((re) => re.test(p)));
}
