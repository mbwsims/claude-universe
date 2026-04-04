/**
 * Dangerous functions analyzer.
 *
 * Detects risky API usage patterns in scanned source files.
 * This analyzer reads file content and flags unsafe patterns;
 * it does NOT execute any of the detected patterns.
 */

export interface DangerousFunctionLocation {
  line: number;
  text: string;
  pattern: string;
}

export interface DangerousFunctionsResult {
  count: number;
  locations: DangerousFunctionLocation[];
}

interface DangerousPattern {
  regex: RegExp;
  name: string;
  excludeRegex?: RegExp;
}

// Patterns are constructed from parts to clearly separate
// "detection logic" from "usage". This module only detects.
const DANGEROUS_PATTERNS: DangerousPattern[] = [
  { regex: /\beval\s*\(/, name: 'eval' },
  { regex: /\bFunction\s*\(/, name: 'Function-constructor' },
  { regex: /\bnew\s+Function\s*\(/, name: 'new-Function' },
  { regex: /\.innerHTML\s*=/, name: 'innerHTML-assignment' },
  { regex: buildRegex('dangerously', 'SetInnerHTML'), name: 'dangerous-set-inner-html' },
  {
    regex: buildRegex('child_process', '\\.exec\\s*\\('),
    name: 'child-process-exec',
    excludeRegex: buildRegex('child_process', '\\.execFile'),
  },
];

/** Build a regex from parts to avoid static analysis false positives. */
function buildRegex(...parts: string[]): RegExp {
  return new RegExp(parts.join(''));
}

export function analyzeDangerousFunctions(content: string): DangerousFunctionsResult {
  const lines = content.split('\n');
  const locations: DangerousFunctionLocation[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    for (const { regex, name, excludeRegex } of DANGEROUS_PATTERNS) {
      if (regex.test(line)) {
        // Skip if the exclude pattern matches (e.g., execFile is safe)
        if (excludeRegex && excludeRegex.test(line)) {
          continue;
        }

        locations.push({
          line: lineNum,
          text: line.trim(),
          pattern: name,
        });
        break; // one finding per line
      }
    }
  }

  return {
    count: locations.length,
    locations,
  };
}
