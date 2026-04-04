/**
 * SQL injection analyzer.
 *
 * Detects string interpolation in SQL contexts: template literals with
 * SQL keywords and ${} interpolation, and string concatenation with
 * SQL keywords and variables.
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

export function analyzeSqlInjection(content: string): SqlInjectionResult {
  const lines = content.split('\n');
  const locations: SqlInjectionLocation[] = [];
  const reportedLines = new Set<number>();

  // Pass 1: Multi-line template literal detection
  // Finds backtick strings spanning multiple lines that contain both SQL keywords
  // and interpolation -- the most common real-world pattern
  const templateBlocks = findTemplateBlocks(content);
  for (const block of templateBlocks) {
    if (SQL_KEYWORDS.test(block.text) && /\$\{/.test(block.text)) {
      // Report the line(s) with interpolation
      const blockLines = block.text.split('\n');
      for (let j = 0; j < blockLines.length; j++) {
        if (/\$\{/.test(blockLines[j])) {
          const lineNum = block.startLine + j;
          if (!reportedLines.has(lineNum)) {
            reportedLines.add(lineNum);
            locations.push({
              line: lineNum,
              text: blockLines[j].trim(),
              pattern: 'template-literal-interpolation',
            });
          }
        }
      }
    }
  }

  // Pass 2: Single-line detection
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    if (reportedLines.has(lineNum)) continue;

    // Single-line template literal with SQL + interpolation
    if (SQL_KEYWORDS.test(line) && /\$\{/.test(line) && /`/.test(line)) {
      reportedLines.add(lineNum);
      locations.push({
        line: lineNum,
        text: line.trim(),
        pattern: 'template-literal-interpolation',
      });
      continue;
    }

    // String concatenation with SQL keywords
    if (SQL_KEYWORDS.test(line) && /["']\s*\+\s*\w+/.test(line)) {
      reportedLines.add(lineNum);
      locations.push({
        line: lineNum,
        text: line.trim(),
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
          text: line.trim(),
          pattern: 'string-concatenation',
        });
      }
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

      // Walk through the template literal
      while (i < content.length && content[i] !== '`') {
        if (content[i] === '\\') {
          blockText += content[i] + (content[i + 1] ?? '');
          i += 2;
          continue;
        }
        if (content[i] === '\n') lineNum++;
        blockText += content[i];
        i++;
      }

      if (i < content.length) {
        blockText += '`';
        i++; // skip closing backtick
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
