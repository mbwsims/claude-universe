/**
 * Strip single-line and block comments from source code.
 * Used by multiple analyzers to avoid false positives in commented-out code.
 */
export function stripComments(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
    .replace(/\/\/.*$/gm, '')            // single-line comments
    .replace(/#.*$/gm, '');              // Python/shell comments
}
