/**
 * file-metrics.ts -- Compute file-level complexity metrics.
 *
 * Returns line count, function count, max nesting depth, and import count.
 */

import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

export interface FileMetrics {
  lineCount: number;
  functionCount: number;
  maxNestingDepth: number;
  importCount: number;
}

const BRACE_LANGUAGES = new Set(['ts', 'tsx', 'js', 'jsx', 'java', 'go', 'rs']);

const FUNCTION_PATTERNS = [
  /^export\s+function\s/,
  /^export\s+async\s+function\s/,
  /^export\s+const\s+\w+\s*=/,
  /^export\s+class\s/,
  /^export\s+default\s+function/,
  /^export\s+default\s+class/,
  /^module\.exports\s*=/,
  /^exports\.\w+\s*=/,
  // Non-exported arrow functions: const name = (...) => or const name = async (...) =>
  /^(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\(?.*\)?\s*=>/,
  // Python
  /^def\s+\w+/,
  /^async\s+def\s+\w+/,
  // Go: func Name(
  /^func\s+\w+/,
  // Go receiver methods: func (r *Type) Name(
  /^func\s+\([^)]+\)\s+\w+/,
  // Rust
  /^fn\s+\w+/,
  /^pub\s+fn\s+\w+/,
  /^pub\s+async\s+fn\s+\w+/,
  // Java with access modifiers
  /^public\s+(static\s+)?\w+\s+\w+\s*\(/,
  /^private\s+(static\s+)?\w+\s+\w+\s*\(/,
  /^protected\s+(static\s+)?\w+\s+\w+\s*\(/,
  // Java without access modifiers (package-private): Type name(
  // Exclude common keywords that could false-positive (return, if, for, while, etc.)
  /^(?!return\b|if\b|for\b|while\b|switch\b|catch\b|else\b|new\b|throw\b|yield\b|await\b|delete\b|typeof\b|import\b|export\b|class\b|const\b|let\b|var\b)\w+\s+\w+\s*\([^)]*\)\s*\{?\s*$/,
];

/** Additional Python-specific patterns (methods inside classes). */
const PYTHON_METHOD_PATTERNS = [
  /^\s+def\s+\w+\s*\(self/,
  /^\s+def\s+\w+\s*\(cls/,
  /^\s+async\s+def\s+\w+\s*\(self/,
];

const IMPORT_PATTERNS = [
  /^import\s/,
  /^import\(/,
  /\brequire\s*\(/,
  /^from\s+\S+\s+import/,
];

export function countFunctions(lines: string[], lang?: string): number {
  let count = 0;
  for (const line of lines) {
    const trimmed = line.trimStart();
    if (FUNCTION_PATTERNS.some((re) => re.test(trimmed))) {
      count++;
      continue;
    }
    // Python class methods (indented def with self/cls)
    if ((lang === 'py' || !lang) && PYTHON_METHOD_PATTERNS.some((re) => re.test(line))) {
      count++;
    }
  }
  return count;
}

function countImports(lines: string[]): number {
  let count = 0;
  for (const line of lines) {
    const trimmed = line.trimStart();
    if (IMPORT_PATTERNS.some((re) => re.test(trimmed))) {
      count++;
    }
  }
  return count;
}

function detectIndentStep(lines: string[]): number {
  const indents = new Set<number>();
  for (const line of lines) {
    if (line.trim() === '') continue;
    const indent = line.length - line.trimStart().length;
    if (indent > 0) indents.add(indent);
  }
  // Find the smallest non-zero indent difference
  const sorted = Array.from(indents).sort((a, b) => a - b);
  if (sorted.length < 2) return sorted[0] ?? 2;
  let minStep = sorted[1] - sorted[0];
  for (let i = 2; i < sorted.length; i++) {
    const step = sorted[i] - sorted[i - 1];
    if (step > 0 && step < minStep) minStep = step;
  }
  return minStep || 2;
}

/**
 * Strip string literals and comments from a line to avoid counting braces inside them.
 * This is a simplification -- handles single/double-quoted strings and // comments.
 */
function stripStringsAndComments(line: string): string {
  // Remove single-line comments
  let result = line.replace(/\/\/.*$/, '');
  // Remove string literals (simple approach: remove "..." and '...' but not escaped quotes)
  result = result.replace(/"(?:[^"\\]|\\.)*"/g, '""');
  result = result.replace(/'(?:[^'\\]|\\.)*'/g, "''");
  result = result.replace(/`(?:[^`\\]|\\.)*`/g, '``');
  return result;
}

/**
 * Compute max nesting depth using brace counting.
 * Used for JS/TS/Java/Go/Rust where {} delimits blocks.
 * Depth is relative to function-level braces (the outermost { in a function body is depth 0).
 */
function computeBraceNestingDepth(lines: string[]): number {
  let maxDepth = 0;
  let braceDepth = 0;
  let functionBaseDepth = -1;
  let inFunction = false;

  for (const line of lines) {
    const trimmed = line.trimStart();
    if (trimmed === '' || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      continue;
    }

    // Detect function start
    if (!inFunction && FUNCTION_PATTERNS.some((re) => re.test(trimmed))) {
      // The opening brace might be on this line or the next
      inFunction = true;
      functionBaseDepth = braceDepth;
    }

    const cleaned = stripStringsAndComments(trimmed);

    for (const ch of cleaned) {
      if (ch === '{') {
        braceDepth++;
        if (inFunction) {
          // functionBaseDepth is braceDepth BEFORE the function declaration.
          // The function's own { pushes to functionBaseDepth + 1 = nesting level 0.
          // The first if/for { pushes to functionBaseDepth + 2 = nesting level 1.
          // nesting = braceDepth - functionBaseDepth - 1:
          //   function { => 0 (function body itself, not counted as nesting)
          //   if {       => 1
          //   for {      => 2
          const nesting = braceDepth - functionBaseDepth - 1;
          if (nesting > maxDepth) {
            maxDepth = nesting;
          }
        }
      } else if (ch === '}') {
        braceDepth--;
        if (inFunction && braceDepth <= functionBaseDepth) {
          // Left the function body
          inFunction = false;
          functionBaseDepth = -1;
        }
      }
    }
  }

  return maxDepth;
}

/** Indent-based nesting depth -- used for Python and as fallback. */
function computeIndentNestingDepth(lines: string[]): number {
  let maxDepth = 0;
  let inFunction = false;
  let functionBaseIndent = 0;
  const indentStep = detectIndentStep(lines);

  for (const line of lines) {
    if (line.trim() === '') continue;

    const indent = line.length - line.trimStart().length;
    const trimmed = line.trimStart();

    // Detect function start
    if (FUNCTION_PATTERNS.some((re) => re.test(trimmed))) {
      inFunction = true;
      functionBaseIndent = indent;
      continue;
    }

    if (inFunction) {
      // Reset on a line at or before base indent (next top-level declaration)
      if (indent <= functionBaseIndent && trimmed !== '' && !trimmed.startsWith('//') && !trimmed.startsWith('#') && !trimmed.startsWith('*')) {
        if (FUNCTION_PATTERNS.some((re) => re.test(trimmed)) || indent < functionBaseIndent) {
          inFunction = false;
          continue;
        }
      }

      // Depth relative to the function body (one indent level deeper than declaration).
      // Function body itself (functionBaseIndent + indentStep) = nesting 0.
      // First nested block (functionBaseIndent + 2*indentStep) = nesting 1.
      const depth = Math.floor((indent - functionBaseIndent) / indentStep) - 1;
      if (depth > maxDepth) {
        maxDepth = depth;
      }
    }
  }

  return maxDepth;
}

/**
 * Compute max nesting depth.
 * Uses brace counting for JS/TS/Java/Go/Rust.
 * Uses indent-based detection for Python (and as fallback).
 */
export function computeMaxNestingDepth(lines: string[], lang?: string): number {
  if (lang && BRACE_LANGUAGES.has(lang)) {
    return computeBraceNestingDepth(lines);
  }

  if (lang === 'py') {
    return computeIndentNestingDepth(lines);
  }

  // If lang is unknown, try to detect: if file has braces, use brace counting
  const hasBraces = lines.some(l => l.includes('{'));
  if (hasBraces) {
    return computeBraceNestingDepth(lines);
  }

  return computeIndentNestingDepth(lines);
}

/** Detect language from file extension. */
function detectLang(filePath: string): string | undefined {
  const ext = extname(filePath).slice(1); // remove leading dot
  if (['ts', 'tsx', 'js', 'jsx'].includes(ext)) return ext;
  if (ext === 'py') return 'py';
  if (ext === 'go') return 'go';
  if (ext === 'rs') return 'rs';
  if (ext === 'java') return 'java';
  if (ext === 'rb') return 'rb';
  return undefined;
}

export async function analyzeFileMetrics(filePath: string, cwd: string): Promise<FileMetrics> {
  const fullPath = join(cwd, filePath);
  const content = await readFile(fullPath, 'utf-8');
  const lines = content.split('\n');
  const lang = detectLang(filePath);

  return {
    lineCount: lines.length,
    functionCount: countFunctions(lines, lang),
    maxNestingDepth: computeMaxNestingDepth(lines, lang),
    importCount: countImports(lines),
  };
}
