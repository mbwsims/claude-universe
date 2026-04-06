/**
 * git-utils.ts — Shared git command wrapper with structured error handling.
 *
 * Returns a discriminated union instead of silently returning empty strings.
 * Callers choose to degrade gracefully, but the failure reason is captured
 * and reportable.
 *
 * Uses execFile (array-based args, no shell) — never exec.
 *
 * Used by timewarp (history.ts, trends.ts) and lenskit (churn.ts).
 */

import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

const execFilePromise = promisify(execFileCb);

export type GitResult =
  | { ok: true; stdout: string }
  | { ok: false; reason: string };

/**
 * Run a git command and return structured result.
 *
 * @param args - Arguments to pass to `git` (e.g. `['log', '--oneline', '-5']`)
 * @param cwd - Working directory for the git command
 * @param maxBuffer - Max stdout buffer in bytes (default 10MB)
 */
export async function gitRun(
  args: string[],
  cwd: string,
  maxBuffer = 10 * 1024 * 1024,
): Promise<GitResult> {
  try {
    const { stdout } = await execFilePromise('git', args, { cwd, maxBuffer });
    return { ok: true, stdout };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Normalize common git errors for easier matching
    const reason = message.toLowerCase().includes('not a git repository')
      ? 'not a git repository'
      : message;
    return { ok: false, reason };
  }
}
