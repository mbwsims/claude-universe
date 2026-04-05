/**
 * Runs diagnostic checks on parsed instruction rules.
 *
 * Diagnostic codes:
 * - VAGUE: weasel words or hedging language
 * - CONFLICT: contradicting rules
 * - REDUNDANT: near-duplicate rules
 * - ORDERING: high-priority rules buried late
 * - PLACEMENT: rules that belong in a different mechanism
 * - WEAK_EMPHASIS: critical rules missing emphasis markers
 * - METADATA: malformed frontmatter in agent/skill files
 */

import type { ParsedRule, InstructionFile } from './discovery.js';

export type DiagnosticCode =
  | 'VAGUE'
  | 'CONFLICT'
  | 'REDUNDANT'
  | 'ORDERING'
  | 'PLACEMENT'
  | 'WEAK_EMPHASIS'
  | 'METADATA';

export type Severity = 'warning' | 'error';

export interface Diagnostic {
  code: DiagnosticCode;
  severity: Severity;
  message: string;
  ruleText: string;
  line: number;
  sourceFile: string;
  suggestion?: string;
  relatedRuleText?: string;
}

// --- VAGUE detection ---

const VAGUE_PATTERNS: RegExp[] = [
  /\btry to\b/i,
  /\bwhen possible\b/i,
  /\bgenerally\b/i,
  /\bconsider\b/i,
  /\bas needed\b/i,
  /\bshould probably\b/i,
  /\bwhere appropriate\b/i,
  /\bif applicable\b/i,
  /\bwhen appropriate\b/i,
  /\bideally\b/i,
  /\bpreferable\b/i,
];

function detectVague(rules: ParsedRule[]): Diagnostic[] {
  const results: Diagnostic[] = [];
  for (const rule of rules) {
    for (const pattern of VAGUE_PATTERNS) {
      if (pattern.test(rule.text)) {
        results.push({
          code: 'VAGUE',
          severity: 'warning',
          message: `Rule uses hedging language ("${rule.text.match(pattern)?.[0]}"): be specific about what to do and when`,
          ruleText: rule.text,
          line: rule.line,
          sourceFile: rule.sourceFile,
        });
        break; // One VAGUE per rule
      }
    }
  }
  return results;
}

// --- CONFLICT detection ---

function extractAction(text: string): string | null {
  // Normalize: strip emphasis markers, lowercase
  const normalized = text.replace(/\b(ALWAYS|NEVER|MUST|MUST NOT)\b/gi, '').trim().toLowerCase();
  // Extract the core verb + object: "use default exports" from "Always use default exports"
  const words = normalized.split(/\s+/).filter(w => w.length > 2);
  return words.slice(0, 5).join(' ') || null;
}

function detectConflicts(rules: ParsedRule[]): Diagnostic[] {
  const results: Diagnostic[] = [];
  const alwaysRules: Array<{ rule: ParsedRule; action: string }> = [];
  const neverRules: Array<{ rule: ParsedRule; action: string }> = [];

  for (const rule of rules) {
    const text = rule.text;
    if (/\balways\b/i.test(text)) {
      const action = extractAction(text);
      if (action) alwaysRules.push({ rule, action });
    }
    if (/\bnever\b/i.test(text) || /\bmust not\b/i.test(text) || /\bdon'?t\b/i.test(text)) {
      const action = extractAction(text);
      if (action) neverRules.push({ rule, action });
    }
  }

  for (const a of alwaysRules) {
    for (const n of neverRules) {
      // Check word overlap between the two actions
      const aWords = new Set(a.action.split(/\s+/));
      const nWords = new Set(n.action.split(/\s+/));
      const overlap = [...aWords].filter(w => nWords.has(w));
      const overlapRatio = overlap.length / Math.min(aWords.size, nWords.size);

      if (overlapRatio >= 0.6) {
        results.push({
          code: 'CONFLICT',
          severity: 'warning',
          message: `Potential conflict: "${a.rule.text}" vs "${n.rule.text}"`,
          ruleText: a.rule.text,
          relatedRuleText: n.rule.text,
          line: a.rule.line,
          sourceFile: a.rule.sourceFile,
        });
      }
    }
  }

  return results;
}

// --- REDUNDANT detection ---

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2);
}

function tokenOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter(w => setB.has(w));
  return intersection.length / Math.min(setA.size, setB.size);
}

function detectRedundant(rules: ParsedRule[]): Diagnostic[] {
  const results: Diagnostic[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const key = `${i}-${j}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const tokensA = tokenize(rules[i].text);
      const tokensB = tokenize(rules[j].text);
      const overlap = tokenOverlap(tokensA, tokensB);

      if (overlap >= 0.7) {
        results.push({
          code: 'REDUNDANT',
          severity: 'warning',
          message: `Redundant: "${rules[i].text}" and "${rules[j].text}" have ${Math.round(overlap * 100)}% overlap`,
          ruleText: rules[i].text,
          relatedRuleText: rules[j].text,
          line: rules[i].line,
          sourceFile: rules[i].sourceFile,
          suggestion: 'Merge into a single, stronger rule to save token budget',
        });
      }
    }
  }

  return results;
}

// --- ORDERING detection ---

const TOOL_CONSTRAINT_PATTERNS = [
  /\brun\b.*\b(vitest|jest|pytest|cargo test|go test|npm test|eslint|prettier|tsc)\b/i,
  /\bbefore\s+(committing|pushing|merging|deploying)\b/i,
  /\bafter\s+(editing|creating|modifying|deleting)\b/i,
];

const STYLE_PATTERNS = [
  /\b(camelCase|PascalCase|kebab-case|snake_case)\b/i,
  /\bindentation\b/i,
  /\bsemicolon/i,
  /\bquotes?\b/i,
];

function isToolConstraint(text: string): boolean {
  return TOOL_CONSTRAINT_PATTERNS.some(p => p.test(text));
}

function isStyleRule(text: string): boolean {
  return STYLE_PATTERNS.some(p => p.test(text));
}

function detectOrdering(rules: ParsedRule[]): Diagnostic[] {
  const results: Diagnostic[] = [];

  // Find tool constraints that appear after style rules
  let firstStyleLine = Infinity;
  for (const rule of rules) {
    if (isStyleRule(rule.text) && rule.line < firstStyleLine) {
      firstStyleLine = rule.line;
    }
  }

  for (const rule of rules) {
    if (isToolConstraint(rule.text) && rule.line > firstStyleLine) {
      results.push({
        code: 'ORDERING',
        severity: 'warning',
        message: `Tool constraint rule appears after style rules (line ${rule.line}). Move it earlier for higher priority.`,
        ruleText: rule.text,
        line: rule.line,
        sourceFile: rule.sourceFile,
        suggestion: 'Move tool constraints and process ordering rules to the top of the file',
      });
    }
  }

  return results;
}

// --- PLACEMENT detection ---

const SCOPED_RULE_PATTERNS = [
  /\bin test files?\b/i,
  /\bin component/i,
  /\bin (?:API |api )routes?\b/i,
  /\bfor \*\.test\./i,
  /\bfor test files/i,
];

const HOOK_PATTERNS = [
  /\balways run\b.+\bafter\b/i,
  /\balways run\b.+\bbefore\b/i,
  /\bautomatically\b/i,
  /\brun .+ after editing/i,
  /\brun .+ before committing/i,
];

function detectPlacement(rules: ParsedRule[]): Diagnostic[] {
  const results: Diagnostic[] = [];

  for (const rule of rules) {
    // Only flag rules in CLAUDE.md (not already in .claude/rules/)
    if (rule.sourceFile !== 'CLAUDE.md') continue;

    for (const pattern of SCOPED_RULE_PATTERNS) {
      if (pattern.test(rule.text)) {
        results.push({
          code: 'PLACEMENT',
          severity: 'warning',
          message: `Rule applies to specific file patterns and would be better in .claude/rules/ with a glob`,
          ruleText: rule.text,
          line: rule.line,
          sourceFile: rule.sourceFile,
          suggestion: 'Move to .claude/rules/ with an appropriate glob pattern to save CLAUDE.md token budget',
        });
        break;
      }
    }

    for (const pattern of HOOK_PATTERNS) {
      if (pattern.test(rule.text)) {
        // Don't double-report if already caught by scoped-rule
        if (!results.some(r => r.ruleText === rule.text && r.code === 'PLACEMENT')) {
          results.push({
            code: 'PLACEMENT',
            severity: 'warning',
            message: `Rule describes deterministic automation and would be better as a hook`,
            ruleText: rule.text,
            line: rule.line,
            sourceFile: rule.sourceFile,
            suggestion: 'Convert to a Claude Code hook (PreToolUse or PostToolUse) for guaranteed enforcement',
          });
        }
        break;
      }
    }
  }

  return results;
}

// --- WEAK_EMPHASIS detection ---

const EMPHASIS_MARKERS = /\b(MUST|NEVER|ALWAYS|IMPORTANT|CRITICAL|REQUIRED)\b/;

function detectWeakEmphasis(rules: ParsedRule[]): Diagnostic[] {
  const results: Diagnostic[] = [];

  for (const rule of rules) {
    if (isToolConstraint(rule.text) && !EMPHASIS_MARKERS.test(rule.text)) {
      results.push({
        code: 'WEAK_EMPHASIS',
        severity: 'warning',
        message: `High-priority rule lacks emphasis markers (MUST, NEVER, ALWAYS)`,
        ruleText: rule.text,
        line: rule.line,
        sourceFile: rule.sourceFile,
        suggestion: `Add emphasis: "${rule.text}" -> "ALWAYS ${rule.text.charAt(0).toLowerCase()}${rule.text.slice(1)}"`,
      });
    }
  }

  return results;
}

// --- METADATA detection ---

interface FrontmatterResult {
  hasFrontmatter: boolean;
  fields: Record<string, string>;
}

function parseFrontmatter(content: string): FrontmatterResult {
  const lines = content.split('\n');
  if (lines[0]?.trim() !== '---') {
    return { hasFrontmatter: false, fields: {} };
  }

  const fields: Record<string, string> = {};
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      return { hasFrontmatter: true, fields };
    }
    const match = lines[i].match(/^(\w[\w-]*)\s*:\s*(.+)$/);
    if (match) {
      fields[match[1]] = match[2].trim();
    }
  }

  return { hasFrontmatter: false, fields: {} }; // Unclosed frontmatter
}

function detectMetadata(files: InstructionFile[]): Diagnostic[] {
  const results: Diagnostic[] = [];

  for (const file of files) {
    if (file.type === 'agent') {
      const fm = parseFrontmatter(file.content);
      const requiredFields = ['name', 'description', 'model'];
      if (!fm.hasFrontmatter) {
        results.push({
          code: 'METADATA',
          severity: 'error',
          message: `Agent file "${file.relativePath}" is missing frontmatter (requires name, description, model)`,
          ruleText: '',
          line: 1,
          sourceFile: file.relativePath,
        });
      } else {
        for (const field of requiredFields) {
          if (!fm.fields[field]) {
            results.push({
              code: 'METADATA',
              severity: 'error',
              message: `Agent file "${file.relativePath}" is missing required frontmatter field: ${field}`,
              ruleText: '',
              line: 1,
              sourceFile: file.relativePath,
            });
          }
        }
      }
    }

    if (file.type === 'skill') {
      const fm = parseFrontmatter(file.content);
      const requiredFields = ['name', 'description'];
      if (!fm.hasFrontmatter) {
        results.push({
          code: 'METADATA',
          severity: 'error',
          message: `Skill file "${file.relativePath}" is missing frontmatter (requires name, description)`,
          ruleText: '',
          line: 1,
          sourceFile: file.relativePath,
        });
      } else {
        for (const field of requiredFields) {
          if (!fm.fields[field]) {
            results.push({
              code: 'METADATA',
              severity: 'error',
              message: `Skill file "${file.relativePath}" is missing required frontmatter field: ${field}`,
              ruleText: '',
              line: 1,
              sourceFile: file.relativePath,
            });
          }
        }
      }
    }
  }

  return results;
}

// --- Main entry point ---

export function runDiagnostics(rules: ParsedRule[], files: InstructionFile[]): Diagnostic[] {
  return [
    ...detectVague(rules),
    ...detectConflicts(rules),
    ...detectRedundant(rules),
    ...detectOrdering(rules),
    ...detectPlacement(rules),
    ...detectWeakEmphasis(rules),
    ...detectMetadata(files),
  ];
}
