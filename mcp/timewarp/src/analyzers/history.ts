/**
 * timewarp_history — Git history analysis for a file or the whole project.
 *
 * Uses child_process.execFile (promisified) for all git commands.
 * Analyzes commit frequency, authors, classification, most-changed files,
 * and optional size-over-time tracking for a specific file.
 */

import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);

interface AuthorInfo {
  name: string;
  commits: number;
}

interface FileChangeInfo {
  file: string;
  changes: number;
}

interface SizeSnapshot {
  date: string;
  lines: number;
}

interface CommitClassification {
  feature: number;
  fix: number;
  refactor: number;
  chore: number;
  docs: number;
  other: number;
}

export interface HistoryResult {
  period: { since: string; until: string };
  commits: { total: number; frequency: number; unit: string };
  authors: AuthorInfo[];
  classification: CommitClassification;
  mostChanged: FileChangeInfo[];
  sizeOverTime?: SizeSnapshot[];
}

function classifyMessage(message: string): keyof CommitClassification {
  const lower = message.toLowerCase().trim();

  // Feature patterns — word-boundary guards prevent mid-word matches
  if (
    lower.startsWith('feat') ||
    /\b(add|implement|introduce|create|new|support|enable|allow)\b/.test(lower)
  ) {
    return 'feature';
  }

  // Fix patterns — includes issue-closing references
  if (
    lower.startsWith('fix') ||
    /\b(bug|resolve|patch|correct|repair)\b/.test(lower) ||
    /\b(closes|fixes)\s+#\d+/.test(lower)
  ) {
    return 'fix';
  }

  // Refactor patterns — includes "clean up" as two words and "optimize"
  if (
    lower.startsWith('refactor') ||
    /\b(refactor|restructure|simplify|extract|reorganize|optimize)\b/.test(lower) ||
    /\bclean\s*up\b/.test(lower)
  ) {
    return 'refactor';
  }

  // Chore patterns
  if (
    lower.startsWith('chore') ||
    lower.startsWith('build') ||
    lower.startsWith('ci') ||
    lower.startsWith('deps') ||
    /\b(update dep|upgrade|bump)\b/.test(lower)
  ) {
    return 'chore';
  }

  // Docs patterns
  if (lower.startsWith('docs') || lower.startsWith('doc:') || /\b(readme|documentation|changelog)\b/.test(lower)) {
    return 'docs';
  }

  return 'other';
}

function computeMonthsDiff(sinceDate: string, untilDate: string): number {
  const since = new Date(sinceDate);
  const until = new Date(untilDate);
  const months =
    (until.getFullYear() - since.getFullYear()) * 12 +
    (until.getMonth() - since.getMonth());
  return Math.max(months, 1);
}

async function gitRun(
  args: string[],
  cwd: string,
): Promise<string> {
  try {
    const { stdout } = await execFile('git', args, { cwd, maxBuffer: 10 * 1024 * 1024 });
    return stdout;
  } catch {
    return '';
  }
}

async function getCommitMessages(
  since: string,
  cwd: string,
  file?: string,
): Promise<string[]> {
  const args = ['log', '--format=%s', `--since=${since}`];
  if (file) {
    args.push('--', file);
  }
  const stdout = await gitRun(args, cwd);
  return stdout.trim().split('\n').filter(Boolean);
}

async function getCommitCount(
  since: string,
  cwd: string,
  file?: string,
): Promise<number> {
  const args = ['log', '--oneline', `--since=${since}`];
  if (file) {
    args.push('--', file);
  }
  const stdout = await gitRun(args, cwd);
  return stdout.trim().split('\n').filter(Boolean).length;
}

async function getAuthors(
  since: string,
  cwd: string,
  file?: string,
): Promise<AuthorInfo[]> {
  const args = ['log', '--format=%an', `--since=${since}`];
  if (file) {
    args.push('--', file);
  }
  const stdout = await gitRun(args, cwd);
  const names = stdout.trim().split('\n').filter(Boolean);

  const counts = new Map<string, number>();
  for (const name of names) {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([name, commits]) => ({ name, commits }))
    .sort((a, b) => b.commits - a.commits);
}

async function getMostChangedFiles(
  since: string,
  cwd: string,
): Promise<FileChangeInfo[]> {
  const args = ['log', '--format=format:', '--name-only', `--since=${since}`];
  const stdout = await gitRun(args, cwd);
  const files = stdout.trim().split('\n').filter(Boolean);

  const counts = new Map<string, number>();
  for (const file of files) {
    counts.set(file, (counts.get(file) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([file, changes]) => ({ file, changes }))
    .sort((a, b) => b.changes - a.changes)
    .slice(0, 20);
}

async function getSizeOverTime(
  since: string,
  file: string,
  cwd: string,
): Promise<SizeSnapshot[]> {
  // Get recent commit hashes that touched this file
  const args = [
    'log',
    '--format=%H %aI',
    `--since=${since}`,
    '--',
    file,
  ];
  const stdout = await gitRun(args, cwd);
  const entries = stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [hash, ...dateParts] = line.split(' ');
      return { hash, date: dateParts.join(' ') };
    });

  if (entries.length === 0) return [];

  // Take up to 10 most recent significant commits, evenly spaced
  const selected =
    entries.length <= 10
      ? entries
      : entries.filter(
          (_, i) => i % Math.ceil(entries.length / 10) === 0 || i === entries.length - 1,
        );

  const snapshots: SizeSnapshot[] = [];
  for (const entry of selected) {
    try {
      const { stdout: fileContent } = await execFile(
        'git',
        ['show', `${entry.hash}:${file}`],
        { cwd, maxBuffer: 10 * 1024 * 1024 },
      );
      const lines = fileContent.split('\n').length;
      snapshots.push({
        date: entry.date.split('T')[0],
        lines,
      });
    } catch {
      // File may not exist at this commit
    }
  }

  // Return in chronological order (oldest first)
  return snapshots.reverse();
}

export async function analyzeHistory(
  args: { file?: string; since?: string },
  cwd: string,
): Promise<HistoryResult> {
  const since = args.since ?? '6 months ago';

  // Resolve the "since" date for the output period
  const sinceOutput = await gitRun(
    ['log', '--format=%aI', `--since=${since}`, '--reverse', '-1'],
    cwd,
  );
  const sinceDate = sinceOutput.trim().split('T')[0] || new Date(
    Date.now() - 6 * 30 * 24 * 60 * 60 * 1000,
  ).toISOString().split('T')[0];
  const untilDate = new Date().toISOString().split('T')[0];

  const [total, authors, messages, mostChanged] = await Promise.all([
    getCommitCount(since, cwd, args.file),
    getAuthors(since, cwd, args.file),
    getCommitMessages(since, cwd, args.file),
    getMostChangedFiles(since, cwd),
  ]);

  // Classification
  const classification: CommitClassification = {
    feature: 0,
    fix: 0,
    refactor: 0,
    chore: 0,
    docs: 0,
    other: 0,
  };
  for (const msg of messages) {
    classification[classifyMessage(msg)]++;
  }

  const months = computeMonthsDiff(sinceDate, untilDate);
  const frequency = Math.round((total / months) * 10) / 10;

  const result: HistoryResult = {
    period: { since: sinceDate, until: untilDate },
    commits: { total, frequency, unit: 'per month' },
    authors,
    classification,
    mostChanged,
  };

  // If a specific file is provided, get size-over-time data
  if (args.file) {
    result.sizeOverTime = await getSizeOverTime(since, args.file, cwd);
  }

  return result;
}

// Test-only export — allows unit tests to exercise classifyMessage directly.
// Not part of the public API.
export const classifyMessageForTest = classifyMessage;
