/**
 * test-coverage.ts -- Check if a source file has corresponding tests.
 *
 * Looks for common test file naming conventions adjacent to or
 * within __tests__ directories.
 */
import { access } from 'node:fs/promises';
import { join, dirname, basename, extname } from 'node:path';
async function fileExists(path) {
    try {
        await access(path);
        return true;
    }
    catch {
        return false;
    }
}
export async function analyzeTestCoverage(filePath, cwd) {
    const ext = extname(filePath);
    const base = basename(filePath, ext);
    const dir = dirname(filePath);
    // Candidate test file patterns
    const candidates = [
        join(dir, `${base}.test${ext}`),
        join(dir, `${base}.spec${ext}`),
        join(dir, '__tests__', `${base}${ext}`),
        join(dir, '__tests__', `${base}.test${ext}`),
        join(dir, '__tests__', `${base}.spec${ext}`),
    ];
    for (const candidate of candidates) {
        const fullPath = join(cwd, candidate);
        if (await fileExists(fullPath)) {
            return { hasTests: true, testPath: candidate };
        }
    }
    return { hasTests: false, testPath: null };
}
//# sourceMappingURL=test-coverage.js.map