/**
 * Strip comments from source code using a string-aware state machine.
 * Handles JS/TS (//, /* ... *‍/) and Python (#) comment styles.
 * Preserves line count by emitting newlines for block comment content.
 * Correctly skips comment-like tokens inside string literals.
 */
export function stripComments(content: string): string {
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
