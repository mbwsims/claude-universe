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
 * Strip comments from source code using a string-aware state machine.
 * Handles JS/TS (//, /* ... *​/), and Python (#) comment styles.
 * Preserves line count by emitting newlines for block comment content.
 * Correctly skips comment-like tokens inside string literals.
 *
 * Canonical version: mcp/shared/strip-comments.ts — keep in sync.
 */
function stripComments(content: string): string {
  const len = content.length;
  const result: string[] = [];
  let i = 0;

  while (i < len) {
    const ch = content[i];

    // String literals — skip through, preserving content
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      result.push(ch);
      i++;
      while (i < len && content[i] !== quote) {
        if (content[i] === '\\') {
          result.push(content[i]);
          i++;
          if (i < len) {
            result.push(content[i]);
            i++;
          }
        } else if (content[i] === '\n' && quote !== '`') {
          // Unterminated string on this line — break to avoid runaway
          break;
        } else {
          result.push(content[i]);
          i++;
        }
      }
      if (i < len && content[i] === quote) {
        result.push(content[i]); // closing quote
        i++;
      }
      continue;
    }

    // Block comments /* ... */
    if (ch === '/' && i + 1 < len && content[i + 1] === '*') {
      i += 2;
      let newlineCount = 0;
      while (i < len && !(content[i] === '*' && i + 1 < len && content[i + 1] === '/')) {
        if (content[i] === '\n') newlineCount++;
        i++;
      }
      if (i < len) i += 2; // skip */
      for (let n = 0; n < newlineCount; n++) result.push('\n');
      continue;
    }

    // Single-line comments //
    if (ch === '/' && i + 1 < len && content[i + 1] === '/') {
      i += 2;
      while (i < len && content[i] !== '\n') i++;
      continue;
    }

    // Python/shell comments #
    if (ch === '#') {
      i++;
      while (i < len && content[i] !== '\n') i++;
      continue;
    }

    result.push(ch);
    i++;
  }

  return result.join('');
}

/**
 * Patterns that indicate a line is ordinary JS/TS code rather than SQL.
 * When a line matches one of these, a single SQL keyword hit (e.g. "from"
 * inside an import statement) should not be treated as SQL context.
 */
const JS_SAFE_PATTERNS = [
  /\bimport\b.*\bfrom\b/,   // ES module imports
  /\bexport\b.*\bfrom\b/,   // ES re-exports
  /\bArray\.from\b/,         // Array.from()
  /\.join\s*\(/,             // Array.join()
  /\brequire\s*\(/,          // CommonJS require()
];

function isJsSafeContext(line: string): boolean {
  return JS_SAFE_PATTERNS.some(p => p.test(line));
}

/**
 * Count distinct SQL keywords on a single line.
 */
function sqlKeywordCount(line: string): number {
  const matches = line.match(/\b(SELECT|INSERT|UPDATE|DELETE|WHERE|FROM|JOIN)\b/gi);
  return matches ? matches.length : 0;
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
      // Skip JS-idiomatic lines that happen to contain one SQL keyword
      if (isJsSafeContext(line) || sqlKeywordCount(line) < 2) {
        // Not enough SQL signal — skip
      } else {
        reportedLines.add(lineNum);
        locations.push({
          line: lineNum,
          text: originalLine.trim(),
          pattern: 'template-literal-interpolation',
        });
        continue;
      }
    }

    // String concatenation with SQL keywords
    if (SQL_KEYWORDS.test(line) && /["']\s*\+\s*\w+/.test(line)) {
      // Skip JS-idiomatic lines that happen to contain one SQL keyword
      if (isJsSafeContext(line) || sqlKeywordCount(line) < 2) {
        // Not enough SQL signal — skip
      } else {
        reportedLines.add(lineNum);
        locations.push({
          line: lineNum,
          text: originalLine.trim(),
          pattern: 'string-concatenation',
        });
        continue;
      }
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
