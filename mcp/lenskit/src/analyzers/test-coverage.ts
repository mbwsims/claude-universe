/**
 * test-coverage.ts -- Check if a source file has corresponding tests.
 *
 * Looks for common test file naming conventions adjacent to,
 * within __tests__ directories, in tests/ or test/ mirror directories,
 * and using language-specific conventions (Go _test.go, Python test_*.py).
 *
 * LIMITATION: This is a heuristic based on file naming conventions.
 * It does NOT parse actual test content or verify the tests exercise the
 * source file. A file named correctly but testing something else will
 * produce a false positive.
 */

import { access } from 'node:fs/promises';
import { join, dirname, basename, extname } from 'node:path';

export interface TestCoverageResult {
  hasTests: boolean;
  testPath: string | null;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate all candidate test file paths for a given source file.
 * Exported for testing.
 */
export function generateTestCandidates(filePath: string): string[] {
  const ext = extname(filePath);
  const base = basename(filePath, ext);
  const dir = dirname(filePath);
  const candidates: string[] = [];

  // === Standard JS/TS candidates (adjacent) ===
  if (ext !== '.go') {
    candidates.push(join(dir, `${base}.test${ext}`));
    candidates.push(join(dir, `${base}.spec${ext}`));
    candidates.push(join(dir, '__tests__', `${base}${ext}`));
    candidates.push(join(dir, '__tests__', `${base}.test${ext}`));
    candidates.push(join(dir, '__tests__', `${base}.spec${ext}`));
  }

  // === tests/ and test/ directory mirroring ===
  // If file is at src/services/user.ts, check tests/services/user.test.ts
  const dirParts = dir.split('/');
  // Try stripping leading src/ for the mirror path
  let mirrorDir = dir;
  if (dirParts[0] === 'src' && dirParts.length > 1) {
    mirrorDir = dirParts.slice(1).join('/');
  }

  if (ext !== '.go') {
    for (const testRoot of ['tests', 'test']) {
      const mirrorBase = mirrorDir === '.' ? testRoot : join(testRoot, mirrorDir);
      candidates.push(join(mirrorBase, `${base}.test${ext}`));
      candidates.push(join(mirrorBase, `${base}.spec${ext}`));
    }
  }

  // === Go convention: file_test.go in same directory ===
  if (ext === '.go') {
    candidates.push(join(dir, `${base}_test.go`));
  }

  // === Python conventions ===
  if (ext === '.py') {
    // test_name.py in same directory
    candidates.push(join(dir, `test_${base}.py`));
    // name_test.py in same directory
    candidates.push(join(dir, `${base}_test.py`));
    // tests/ and test/ mirrors with test_ prefix
    for (const testRoot of ['tests', 'test']) {
      const mirrorBase = mirrorDir === '.' ? testRoot : join(testRoot, mirrorDir);
      candidates.push(join(mirrorBase, `test_${base}.py`));
      candidates.push(join(mirrorBase, `${base}_test.py`));
    }
  }

  return candidates;
}

export async function analyzeTestCoverage(filePath: string, cwd: string): Promise<TestCoverageResult> {
  const candidates = generateTestCandidates(filePath);

  for (const candidate of candidates) {
    const fullPath = join(cwd, candidate);
    if (await fileExists(fullPath)) {
      return { hasTests: true, testPath: candidate };
    }
  }

  return { hasTests: false, testPath: null };
}
