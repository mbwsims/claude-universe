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
 */
export async function batchAnalyzeChurn(cwd: string): Promise<Map<string, ChurnResult>> {
  const results = new Map<string, ChurnResult>();

  // One git log for all file change counts
  let changesByFile = new Map<string, number>();
  try {
    const { stdout } = await execFile(
      'git',
      ['log', '--format=format:', '--name-only', '--since=6 months ago'],
      { cwd, maxBuffer: 50 * 1024 * 1024 }
    );
    for (const line of stdout.split('\n')) {
      const trimmed = line.trim();
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
        if (!authorsByFile.has(trimmed)) {
          authorsByFile.set(trimmed, new Set());
        }
        authorsByFile.get(trimmed)!.add(currentAuthor);
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

  return results;
}
