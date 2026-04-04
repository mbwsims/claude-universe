/**
 * Detects shallow assertions that pass for wrong values.
 */

export interface ShallowAssertionResult {
  count: number;
  total: number;
  locations: Array<{ line: number; text: string; kind: string }>;
}

const SHALLOW_PATTERNS: Array<{ regex: RegExp; kind: string }> = [
  { regex: /\.toBeDefined\(\)/g, kind: 'toBeDefined' },
  { regex: /\.toBeTruthy\(\)/g, kind: 'toBeTruthy' },
  { regex: /\.toBeFalsy\(\)/g, kind: 'toBeFalsy' },
  { regex: /\.toBeNull\(\)/g, kind: 'toBeNull' },
  { regex: /\.toBeUndefined\(\)/g, kind: 'toBeUndefined' },
];

// toHaveBeenCalled() without argument verification — bare call assertion
const BARE_CALLED_REGEX = /\.toHaveBeenCalled\(\)/g;

export function analyzeShallowAssertions(content: string): ShallowAssertionResult {
  const lines = content.split('\n');
  const locations: ShallowAssertionResult['locations'] = [];
  let totalAssertions = 0;

  // Count total expect() calls as denominator
  for (const line of lines) {
    const expectMatches = line.match(/expect\(/g);
    if (expectMatches) totalAssertions += expectMatches.length;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

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
  }

  return {
    count: locations.length,
    total: totalAssertions,
    locations,
  };
}
