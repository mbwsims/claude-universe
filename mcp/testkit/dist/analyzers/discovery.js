/**
 * Test file discovery, source mapping, and framework detection.
 */
import { readFile } from 'node:fs/promises';
import { join, dirname, basename, extname } from 'node:path';
import { existsSync } from 'node:fs';
import { globby } from 'globby';
const TEST_PATTERNS = [
    '**/*.test.*',
    '**/*.spec.*',
    '**/__tests__/**/*.*',
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
];
const MEDIUM_CRITICALITY_PATTERNS = [
    /service/i, /controller/i, /handler/i, /resolver/i,
    /repository/i, /store/i, /model/i,
    /api/i, /route/i, /endpoint/i,
    /database/i, /db/i, /query/i,
    /cache/i,
];
function classifyCriticality(filePath) {
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
function isTestFile(filePath) {
    const name = basename(filePath);
    return /\.(test|spec)\./.test(name) || filePath.includes('__tests__');
}
export function inferSourcePath(testPath, cwd) {
    const dir = dirname(testPath);
    const name = basename(testPath);
    const match = name.match(/^(.+)\.(test|spec)(\.[^.]+)$/);
    if (!match)
        return null;
    const sourceName = `${match[1]}${match[3]}`;
    const candidates = [];
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
export async function discoverTestFiles(cwd) {
    return globby(TEST_PATTERNS, {
        cwd,
        ignore: IGNORE_PATTERNS,
        absolute: false,
    });
}
export async function discoverSourceFiles(cwd) {
    const allFiles = await globby(['**/*'], {
        cwd,
        ignore: [...IGNORE_PATTERNS, ...TEST_PATTERNS, '**/*.d.ts', '**/types/**'],
        absolute: false,
    });
    return allFiles.filter(f => SOURCE_EXTENSIONS.has(extname(f)));
}
export async function detectFramework(cwd) {
    const configPatterns = {
        'vitest.config.*': 'vitest',
        'jest.config.*': 'jest',
        'pytest.ini': 'pytest',
        'pyproject.toml': 'pytest',
        'Cargo.toml': 'cargo-test',
        'go.mod': 'go-test',
    };
    for (const [pattern, framework] of Object.entries(configPatterns)) {
        const matches = await globby(pattern, { cwd, ignore: IGNORE_PATTERNS });
        if (matches.length > 0)
            return framework;
    }
    // Check package.json for test framework deps
    try {
        const pkgContent = await readFile(join(cwd, 'package.json'), 'utf-8');
        const pkg = JSON.parse(pkgContent);
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (allDeps.vitest)
            return 'vitest';
        if (allDeps.jest)
            return 'jest';
        if (allDeps.mocha)
            return 'mocha';
        if (allDeps.ava)
            return 'ava';
        if (allDeps.tap)
            return 'tap';
    }
    catch {
        // no package.json
    }
    return null;
}
export async function buildSourceMapping(cwd) {
    const [testFilePaths, sourceFilePaths, framework] = await Promise.all([
        discoverTestFiles(cwd),
        discoverSourceFiles(cwd),
        detectFramework(cwd),
    ]);
    const testFiles = testFilePaths.map(path => ({
        path,
        sourcePath: inferSourcePath(path, cwd),
    }));
    // Find untested source files
    const testedSources = new Set(testFiles
        .map(t => t.sourcePath)
        .filter((p) => p !== null));
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
//# sourceMappingURL=discovery.js.map