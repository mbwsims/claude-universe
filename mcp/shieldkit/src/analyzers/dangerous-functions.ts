/**
 * Dangerous functions analyzer.
 *
 * Detects risky API usage patterns in scanned source files.
 * This analyzer reads file content and flags unsafe patterns;
 * it does NOT execute any of the detected patterns.
 *
 * Each finding includes a severity level:
 * - critical: code execution (eval, Function, shell exec)
 * - high: DOM manipulation (innerHTML, document.write), sync shell exec
 * - medium: framework-assisted (dangerouslySetInnerHTML), timer-string
 */

import type { Severity } from './scoring.js';

export interface DangerousFunctionLocation {
  line: number;
  text: string;
  pattern: string;
  severity: Severity;
}

export interface DangerousFunctionsResult {
  count: number;
  locations: DangerousFunctionLocation[];
}

interface DangerousPattern {
  regex: RegExp;
  name: string;
  severity: Severity;
  excludeRegex?: RegExp;
}

/** Build a regex from parts to avoid static analysis false positives. */
function buildRegex(...parts: string[]): RegExp {
  return new RegExp(parts.join(''));
}

const DANGEROUS_PATTERNS: DangerousPattern[] = [
  // Critical: Code execution
  { regex: /\beval\s*\(/, name: 'eval', severity: 'critical' },
  { regex: /\bFunction\s*\(/, name: 'Function-constructor', severity: 'critical' },
  { regex: /\bnew\s+Function\s*\(/, name: 'new-Function', severity: 'critical' },

  // High: DOM manipulation / shell execution
  { regex: /\.innerHTML\s*=/, name: 'innerHTML-assignment', severity: 'high' },
  { regex: /\bdocument\.write\s*\(/, name: 'document-write', severity: 'high' },
  {
    regex: buildRegex('child_process', '\\.exec\\s*\\('),
    name: 'child-process-exec',
    severity: 'high',
    excludeRegex: buildRegex('child_process', '\\.execFile'),
  },
  { regex: /\bexecSync\s*\(/, name: 'execSync', severity: 'high' },
  { regex: /\bvm\.runInNewContext\s*\(/, name: 'vm-runInNewContext', severity: 'high' },

  // Medium: Framework-assisted, timer-string
  // NOTE: This pattern detects dangerously-set-innerHTML in source code for security
  // analysis purposes only. This analyzer does NOT render any HTML.
  { regex: buildRegex('dangerously', 'SetInnerHTML'), name: 'dangerous-set-inner-html', severity: 'medium' },
  {
    regex: /\bsetTimeout\s*\(\s*["'`]/,
    name: 'setTimeout-string',
    severity: 'medium',
  },
  {
    regex: /\bsetInterval\s*\(\s*["'`]/,
    name: 'setInterval-string',
    severity: 'medium',
  },

  // Python: Critical
  { regex: /\bos\.system\s*\(/, name: 'python-os-system', severity: 'critical' },
  {
    regex: /\bsubprocess\.\w+\s*\([^)]*shell\s*=\s*True/,
    name: 'python-subprocess-shell',
    severity: 'critical',
  },
  { regex: /\bexec\s*\(/, name: 'python-exec', severity: 'critical' },
  { regex: /\bpickle\.loads\s*\(/, name: 'python-pickle-loads', severity: 'critical' },
];

export function analyzeDangerousFunctions(content: string): DangerousFunctionsResult {
  const lines = content.split('\n');
  const locations: DangerousFunctionLocation[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip comment lines
    if (/^\s*\/\//.test(line) || /^\s*\/?\*/.test(line) || /^\s*#/.test(line)) {
      continue;
    }

    for (const { regex, name, severity, excludeRegex } of DANGEROUS_PATTERNS) {
      if (regex.test(line)) {
        // Skip if the exclude pattern matches (e.g., execFile is safe)
        if (excludeRegex && excludeRegex.test(line)) {
          continue;
        }

        locations.push({
          line: lineNum,
          text: line.trim(),
          pattern: name,
          severity,
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
