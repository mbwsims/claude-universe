/**
 * Detects shallow assertions that pass for wrong values.
 */

import { stripComments } from './strip-comments.js';

export interface ShallowAssertionResult {
  count: number;
  total: number;
  locations: Array<{ line: number; text: string; kind: string }>;
}

// toBeNull() and toBeUndefined() are NOT shallow -- they assert a specific value.
// Only patterns that pass for ANY non-null/non-undefined value are shallow.
const SHALLOW_PATTERNS: Array<{ regex: RegExp; kind: string }> = [
  { regex: /\.toBeDefined\(\)/g, kind: 'toBeDefined' },
  { regex: /\.toBeTruthy\(\)/g, kind: 'toBeTruthy' },
  { regex: /\.toBeFalsy\(\)/g, kind: 'toBeFalsy' },
];

// toHaveBeenCalled() without argument verification — bare call assertion
const BARE_CALLED_REGEX = /\.toHaveBeenCalled\(\)/g;

// Python shallow patterns:
// - bare `assert result` with no comparison operator (==, !=, >, <, >=, <=, in, not, is)
// - `assert X is not None` is the Python equivalent of toBeDefined()
const PYTHON_SHALLOW_PATTERNS: Array<{ regex: RegExp; kind: string }> = [
  // Matches `assert <expr>` where <expr> has NO comparison operator and is NOT `not ...`
  // This catches `assert result`, `assert user`, but not `assert result == 42`
  { regex: /^\s*assert\s+(?!not\b)[a-zA-Z_]\w*(\.[a-zA-Z_]\w*)*\s*$/g, kind: 'bareAssert' },
  // Matches `assert X is not None`
  { regex: /^\s*assert\s+.+\s+is\s+not\s+None\s*$/g, kind: 'assertIsNotNone' },
];

// Python total assertion count: any line starting with `assert `
const PYTHON_ASSERT_REGEX = /^\s*assert\s+/g;

export function analyzeShallowAssertions(content: string): ShallowAssertionResult {
  const lines = stripComments(content).split('\n');
  const locations: ShallowAssertionResult['locations'] = [];
  let totalAssertions = 0;

  // Count total assertions as denominator (JS expect() + Python assert)
  for (const line of lines) {
    const expectMatches = line.match(/expect\(/g);
    if (expectMatches) totalAssertions += expectMatches.length;

    PYTHON_ASSERT_REGEX.lastIndex = 0;
    if (PYTHON_ASSERT_REGEX.test(line)) totalAssertions++;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // JS/TS shallow patterns
    for (const { regex, kind } of SHALLOW_PATTERNS) {
      regex.lastIndex = 0;
      if (regex.test(line)) {
        locations.push({ line: i + 1, text: line.trim(), kind });
      }
    }

    BARE_CALLED_REGEX.lastIndex = 0;
    if (BARE_CALLED_REGEX.test(line)) {
      locations.push({ line: i + 1, text: line.trim(), kind: 'bareToHaveBeenCalled' });
    }

    // Python shallow patterns
    for (const { regex, kind } of PYTHON_SHALLOW_PATTERNS) {
      regex.lastIndex = 0;
      if (regex.test(line)) {
        locations.push({ line: i + 1, text: line.trim(), kind });
      }
    }
  }

  return {
    count: locations.length,
    total: totalAssertions,
    locations,
  };
}
