/**
 * file-metrics.ts -- Compute file-level complexity metrics.
 *
 * Returns line count, function count, max nesting depth, and import count.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface FileMetrics {
  lineCount: number;
  functionCount: number;
  maxNestingDepth: number;
  importCount: number;
}

const FUNCTION_PATTERNS = [
  /^export\s+function\s/,
  /^export\s+async\s+function\s/,
  /^export\s+const\s+\w+\s*=/,
  /^export\s+class\s/,
  /^export\s+default\s+function/,
  /^export\s+default\s+class/,
  /^module\.exports\s*=/,
  /^exports\.\w+\s*=/,
  /^def\s+\w+/,
  /^async\s+def\s+\w+/,
  /^func\s+\w+/,
  /^fn\s+\w+/,
  /^pub\s+fn\s+\w+/,
  /^pub\s+async\s+fn\s+\w+/,
  /^public\s+(static\s+)?\w+\s+\w+\s*\(/,
  /^private\s+(static\s+)?\w+\s+\w+\s*\(/,
  /^protected\s+(static\s+)?\w+\s+\w+\s*\(/,
];

const IMPORT_PATTERNS = [
  /^import\s/,
  /^import\(/,
  /\brequire\s*\(/,
  /^from\s+\S+\s+import/,
];

function countFunctions(lines: string[]): number {
  let count = 0;
  for (const line of lines) {
    const trimmed = line.trimStart();
    if (FUNCTION_PATTERNS.some((re) => re.test(trimmed))) {
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

function computeMaxNestingDepth(lines: string[]): number {
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
        // Check if this is another function or top-level statement
        if (FUNCTION_PATTERNS.some((re) => re.test(trimmed)) || indent < functionBaseIndent) {
          inFunction = false;
          continue;
        }
      }

      const depth = Math.floor((indent - functionBaseIndent) / indentStep);
      if (depth > maxDepth) {
        maxDepth = depth;
      }
    }
  }

  return maxDepth;
}

export async function analyzeFileMetrics(filePath: string, cwd: string): Promise<FileMetrics> {
  const fullPath = join(cwd, filePath);
  const content = await readFile(fullPath, 'utf-8');
  const lines = content.split('\n');

  return {
    lineCount: lines.length,
    functionCount: countFunctions(lines),
    maxNestingDepth: computeMaxNestingDepth(lines),
    importCount: countImports(lines),
  };
}
