/**
 * Source file discovery for temporal analysis.
 * Finds source files excluding common non-source directories.
 */
import { extname } from 'node:path';
import { globby } from 'globby';
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
function isTestFile(filePath) {
    return /\.(test|spec)\./.test(filePath) || filePath.includes('__tests__');
}
function isDeclarationFile(filePath) {
    return filePath.endsWith('.d.ts');
}
export async function discoverSourceFiles(cwd) {
    const allFiles = await globby(['**/*'], {
        cwd,
        ignore: IGNORE_PATTERNS,
        absolute: false,
    });
    return allFiles.filter((f) => SOURCE_EXTENSIONS.has(extname(f)) &&
        !isTestFile(f) &&
        !isDeclarationFile(f));
}
//# sourceMappingURL=discovery.js.map