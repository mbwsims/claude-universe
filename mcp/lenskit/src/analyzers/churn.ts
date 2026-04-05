/**
 * churn.ts -- Git history analysis.
 *
 * Two modes:
 * - analyzeChurn(file, cwd): runs 2 git commands for one file
 * - batchAnalyzeChurn(cwd): runs 1 git command and parses results for all files
 */

import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);

/**
 * Normalize a file path by stripping leading ./ and converting backslashes.
 * Git and globby can return paths in different formats.
 */
export function normalizePath(p: string): string {
  let result = p.replace(/\\/g, '/');
  while (result.startsWith('./')) {
    result = result.slice(2);
  }
  return result;
}

export interface ChurnResult {
  changes: number;
  authors: number;
  period: string;
}

/**
 * Single-file churn analysis. Spawns 2 git processes.
 * Use for single-file analysis only. For batch, use batchAnalyzeChurn.
 */
export async function analyzeChurn(filePath: string, cwd: string): Promise<ChurnResult> {
  let changes = 0;
  let authors = 0;

  try {
    const { stdout: logOutput } = await execFile(
      'git',
      ['log', '--oneline', '--since=6 months ago', '--', filePath],
      { cwd }
    );
    changes = logOutput.trim() === '' ? 0 : logOutput.trim().split('\n').length;
  } catch {
    changes = 0;
  }

  try {
    const { stdout: authorOutput } = await execFile(
      'git',
      ['log', '--format=%an', '--since=6 months ago', '--', filePath],
      { cwd }
    );
    const authorLines = authorOutput.trim() === '' ? [] : authorOutput.trim().split('\n');
    authors = new Set(authorLines).size;
  } catch {
    authors = 0;
  }

  return { changes, authors, period: '6 months' };
}

/**
 * Batch churn analysis. Runs 2 git commands total (not 2N), then indexes results.
 * Returns a map: filePath -> ChurnResult.
 * Attaches __zeroChurnWarning to the map if >80% of files show zero churn.
 */
export async function batchAnalyzeChurn(cwd: string): Promise<Map<string, ChurnResult>> {
  const results = new Map<string, ChurnResult>() as Map<string, ChurnResult> & { __zeroChurnWarning?: string };

  // One git log for all file change counts
  let changesByFile = new Map<string, number>();
  try {
    const { stdout } = await execFile(
      'git',
      ['log', '--format=format:', '--name-only', '--since=6 months ago'],
      { cwd, maxBuffer: 50 * 1024 * 1024 }
    );
    for (const line of stdout.split('\n')) {
      const trimmed = normalizePath(line.trim());
      if (trimmed === '') continue;
      changesByFile.set(trimmed, (changesByFile.get(trimmed) ?? 0) + 1);
    }
  } catch {
    // Not a git repo
  }

  // One git log for all author counts per file
  let authorsByFile = new Map<string, Set<string>>();
  try {
    const { stdout } = await execFile(
      'git',
      ['log', '--format=COMMIT_SEP %an', '--name-only', '--since=6 months ago'],
      { cwd, maxBuffer: 50 * 1024 * 1024 }
    );
    let currentAuthor = '';
    for (const line of stdout.split('\n')) {
      const trimmed = line.trim();
      if (trimmed === '') continue;
      if (trimmed.startsWith('COMMIT_SEP ')) {
        currentAuthor = trimmed.slice('COMMIT_SEP '.length);
        continue;
      }
      if (currentAuthor && trimmed !== '') {
        const normalized = normalizePath(trimmed);
        if (!authorsByFile.has(normalized)) {
          authorsByFile.set(normalized, new Set());
        }
        authorsByFile.get(normalized)!.add(currentAuthor);
      }
    }
  } catch {
    // Not a git repo
  }

  // Merge into results
  const allFiles = new Set([...changesByFile.keys(), ...authorsByFile.keys()]);
  for (const file of allFiles) {
    results.set(file, {
      changes: changesByFile.get(file) ?? 0,
      authors: authorsByFile.get(file)?.size ?? 0,
      period: '6 months',
    });
  }

  // Sanity check: warn if >80% files show zero churn
  const totalFiles = results.size;
  if (totalFiles > 0) {
    const zeroChurnCount = Array.from(results.values()).filter(r => r.changes === 0).length;
    if (zeroChurnCount / totalFiles > 0.8) {
      (results as any).__zeroChurnWarning =
        `Warning: ${Math.round((zeroChurnCount / totalFiles) * 100)}% of files show zero churn. ` +
        `This may indicate git history is not being parsed correctly, or the project is very new.`;
    }
  }

  return results;
}
