/**
 * SQL injection analyzer.
 *
 * Detects string interpolation in SQL contexts: template literals with
 * SQL keywords and ${} interpolation, string concatenation with SQL keywords,
 * Python f-strings, and Python format strings with SQL keywords.
 *
 * Excludes: test files, comments, parameterized queries.
 */

export interface SqlInjectionLocation {
  line: number;
  text: string;
  pattern: string;
}

export interface SqlInjectionResult {
  count: number;
  locations: SqlInjectionLocation[];
}

const SQL_KEYWORDS = /\b(SELECT|INSERT|UPDATE|DELETE|WHERE|FROM|JOIN)\b/i;

const TEST_FILE_PATTERNS = [
  /\.(test|spec)\.(ts|js|tsx|jsx|mjs|cjs)$/,
  /\/__tests__\//,
  /\/test\//,
  /\.test\.py$/,
  /test_\w+\.py$/,
];

/**
 * Check if a file is a test file that should be excluded from analysis.
 */
function isTestFile(filePath: string): boolean {
  return TEST_FILE_PATTERNS.some(p => p.test(filePath));
}

/**
 * Strip comments from source content.
 * Handles: // single-line, multi-line comment blocks, # Python single-line
 */
// Canonical version: mcp/shared/strip-comments.ts
function stripComments(content: string): string {
  // Remove multi-line comments
  let result = content.replace(/\/\*[\s\S]*?\*\//g, (match) => {
    // Preserve line count by replacing with same number of newlines
    return match.replace(/[^\n]/g, ' ');
  });

  // Remove single-line comments (// ...) and Python comments (# ...)
  result = result.replace(/\/\/.*$/gm, (match) => ' '.repeat(match.length));
  result = result.replace(/(?<=^|\s)#.*$/gm, (match) => ' '.repeat(match.length));

  return result;
}

/**
 * Check if a line contains a parameterized query pattern,
 * which means the SQL is safe even though it uses interpolation-like syntax.
 */
function isParameterizedQuery(line: string): boolean {
  // JS/TS: db.query("...", [params]) or .execute("...", [...])
  if (/\.\s*(query|execute)\s*\([^)]*,\s*\[/.test(line)) return true;
  // Python: cursor.execute("...", [params]) or cursor.execute("...", (params))
  if (/\.execute\s*\([^)]*,\s*[\[(]/.test(line)) return true;
  // Prisma, Knex, Sequelize-style ORM
  if (/\.(findMany|findOne|findUnique|findFirst|where|select)\s*\(/.test(line)) return true;
  return false;
}

export function analyzeSqlInjection(content: string, filePath?: string): SqlInjectionResult {
  // Skip test files
  if (filePath && isTestFile(filePath)) {
    return { count: 0, locations: [] };
  }

  // Strip comments before analysis
  const strippedContent = stripComments(content);
  const lines = strippedContent.split('\n');
  const locations: SqlInjectionLocation[] = [];
  const reportedLines = new Set<number>();

  // Use original lines for display text
  const originalLines = content.split('\n');

  // Pass 1: Multi-line template literal detection
  const templateBlocks = findTemplateBlocks(strippedContent);
  for (const block of templateBlocks) {
    if (SQL_KEYWORDS.test(block.text) && /\$\{/.test(block.text)) {
      const blockLines = block.text.split('\n');
      for (let j = 0; j < blockLines.length; j++) {
        if (/\$\{/.test(blockLines[j])) {
          const lineNum = block.startLine + j;
          if (!reportedLines.has(lineNum)) {
            // Check this is not a parameterized query
            const fullLine = originalLines[lineNum - 1] ?? blockLines[j];
            if (!isParameterizedQuery(fullLine)) {
              reportedLines.add(lineNum);
              locations.push({
                line: lineNum,
                text: (originalLines[lineNum - 1] ?? blockLines[j]).trim(),
                pattern: 'template-literal-interpolation',
              });
            }
          }
        }
      }
    }
  }

  // Pass 2: Single-line detection
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const originalLine = originalLines[i] ?? line;

    if (reportedLines.has(lineNum)) continue;
    if (isParameterizedQuery(originalLine)) continue;

    // Single-line template literal with SQL + interpolation
    if (SQL_KEYWORDS.test(line) && /\$\{/.test(line) && /`/.test(line)) {
      reportedLines.add(lineNum);
      locations.push({
        line: lineNum,
        text: originalLine.trim(),
        pattern: 'template-literal-interpolation',
      });
      continue;
    }

    // String concatenation with SQL keywords
    if (SQL_KEYWORDS.test(line) && /["']\s*\+\s*\w+/.test(line)) {
      reportedLines.add(lineNum);
      locations.push({
        line: lineNum,
        text: originalLine.trim(),
        pattern: 'string-concatenation',
      });
      continue;
    }

    // Concatenation on the variable side
    if (SQL_KEYWORDS.test(line) && /\w+\s*\+\s*["']/.test(line)) {
      if (/\w+\s*\+\s*["'][^"']*\b(SELECT|INSERT|UPDATE|DELETE|WHERE|FROM|JOIN)\b/i.test(line) ||
          /\b(SELECT|INSERT|UPDATE|DELETE|WHERE|FROM|JOIN)\b[^"']*["']\s*\+\s*\w+/i.test(line)) {
        reportedLines.add(lineNum);
        locations.push({
          line: lineNum,
          text: originalLine.trim(),
          pattern: 'string-concatenation',
        });
      }
      continue;
    }

    // Python f-string with SQL keywords and {variable}
    if (SQL_KEYWORDS.test(line) && /f["']/.test(line) && /\{[^}]+\}/.test(line)) {
      reportedLines.add(lineNum);
      locations.push({
        line: lineNum,
        text: originalLine.trim(),
        pattern: 'python-f-string-interpolation',
      });
      continue;
    }

    // Python %-format with SQL keywords
    if (SQL_KEYWORDS.test(line) && /%s/.test(line) && /["']\s*%\s*\w+/.test(line)) {
      reportedLines.add(lineNum);
      locations.push({
        line: lineNum,
        text: originalLine.trim(),
        pattern: 'python-format-interpolation',
      });
      continue;
    }
  }

  locations.sort((a, b) => a.line - b.line);

  return {
    count: locations.length,
    locations,
  };
}

/** Extract template literal blocks with their start line numbers. */
function findTemplateBlocks(content: string): Array<{ text: string; startLine: number }> {
  const blocks: Array<{ text: string; startLine: number }> = [];
  let i = 0;
  let lineNum = 1;

  while (i < content.length) {
    if (content[i] === '\n') {
      lineNum++;
      i++;
      continue;
    }

    if (content[i] === '`') {
      const startLine = lineNum;
      let blockText = '`';
      i++;

      // Walk through the template literal, tracking ${} depth
      let braceDepth = 0;

      while (i < content.length) {
        // Handle escape sequences
        if (content[i] === '\\') {
          blockText += content[i] + (content[i + 1] ?? '');
          i += 2;
          continue;
        }

        // Track ${} nesting
        if (content[i] === '$' && content[i + 1] === '{' && braceDepth === 0) {
          braceDepth = 1;
          blockText += '${';
          i += 2;
          continue;
        }

        if (braceDepth > 0) {
          if (content[i] === '{') {
            braceDepth++;
          } else if (content[i] === '}') {
            braceDepth--;
          }
          // Inside ${}, backticks are nested template literals -- skip them
          if (content[i] === '`') {
            blockText += '`';
            i++;
            // Walk through the nested template literal
            let nestedBraceDepth = 0;
            while (i < content.length) {
              if (content[i] === '\\') {
                blockText += content[i] + (content[i + 1] ?? '');
                i += 2;
                continue;
              }
              if (content[i] === '$' && content[i + 1] === '{') {
                nestedBraceDepth++;
                blockText += '${';
                i += 2;
                continue;
              }
              if (nestedBraceDepth > 0 && content[i] === '}') {
                nestedBraceDepth--;
              }
              if (content[i] === '`' && nestedBraceDepth === 0) {
                blockText += '`';
                i++;
                break;
              }
              if (content[i] === '\n') lineNum++;
              blockText += content[i];
              i++;
            }
            continue;
          }

          if (content[i] === '\n') lineNum++;
          blockText += content[i];
          i++;
          continue;
        }

        // Outside ${}, a backtick closes the template literal
        if (content[i] === '`') {
          blockText += '`';
          i++;
          break;
        }

        if (content[i] === '\n') lineNum++;
        blockText += content[i];
        i++;
      }

      // Only include multi-line blocks (single-line handled by Pass 2)
      if (blockText.includes('\n')) {
        blocks.push({ text: blockText, startLine });
      }
    } else {
      i++;
    }
  }

  return blocks;
}
