/**
 * Strip single-line (//) and multi-line block comments from source text.
 * Preserves line count by replacing block comment content with newlines,
 * so line numbers in analysis results remain accurate.
 */
export function stripComments(content: string): string {
  // Remove block comments (non-greedy, handles multi-line)
  let stripped = content.replace(/\/\*[\s\S]*?\*\//g, (match) => {
    // Preserve line count by replacing with same number of newlines
    const newlines = match.split('\n').length - 1;
    return '\n'.repeat(newlines);
  });
  // Remove single-line comments
  stripped = stripped.replace(/\/\/.*$/gm, '');
  return stripped;
}
