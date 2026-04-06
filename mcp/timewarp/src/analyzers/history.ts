/**
 * timewarp_history — Git history analysis for a file or the whole project.
 *
 * Uses child_process.execFile (promisified) for all git commands.
 * Analyzes commit frequency, authors, classification, most-changed files,
 * and optional size-over-time tracking for a specific file.
 */

import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { gitRun, type GitResult } from '../../../shared/git-utils.js';

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

  // 1. Check conventional-commit prefixes — require colon or paren delimiter
  if (lower.startsWith('feat:') || lower.startsWith('feat(')) return 'feature';
  if (lower.startsWith('fix:') || lower.startsWith('fix(')) return 'fix';
  if (lower.startsWith('refactor:') || lower.startsWith('refactor(')) return 'refactor';
  if (
    lower.startsWith('chore:') || lower.startsWith('chore(') ||
    lower.startsWith('build:') || lower.startsWith('build(') ||
    lower.startsWith('ci:') || lower.startsWith('ci(') ||
    lower.startsWith('deps:') || lower.startsWith('deps(')
  ) {
    return 'chore';
  }
  if (lower.startsWith('docs:') || lower.startsWith('docs(') || lower.startsWith('doc:')) return 'docs';

  // 2. Keyword-based patterns — word-boundary guards prevent mid-word matches
  if (/\b(add|implement|introduce|create|new|support|enable|allow)\b/.test(lower)) {
    return 'feature';
  }

  if (
    /\bfix(ed|es|ing)?\b(?!:|\()/.test(lower) ||
    /\b(bug|resolve|patch|correct|repair)\b/.test(lower) ||
    /\b(closes|fixes)\s+#\d+/.test(lower)
  ) {
    return 'fix';
  }

  if (
    /\b(refactor|restructure|simplify|extract|reorganize|optimize)\b/.test(lower) ||
    /\bclean\s*up\b/.test(lower)
  ) {
    return 'refactor';
  }

  if (/\b(update dep|upgrade|bump)\b/.test(lower)) {
    return 'chore';
  }

  if (/\b(readme|documentation|changelog)\b/.test(lower)) {
    return 'docs';
  }

  return 'other';
}

const CONFIG_FILE_PATTERNS = [
  /^package\.json$/,
  /^package-lock\.json$/,
  /^yarn\.lock$/,
  /^\.eslintrc/,
  /^\.prettierrc/,
  /^tsconfig.*\.json$/,
  /^\.github\//,
  /^Cargo\.lock$/,
  /^go\.sum$/,
];

const DOC_FILE_PATTERNS = [
  /\.md$/,
  /^docs\//,
  /^CHANGELOG/,
];

function classifyWithFileFallback(
  message: string,
  files: string[],
): keyof CommitClassification {
  const messageResult = classifyMessage(message);
  if (messageResult !== 'other') return messageResult;

  // File-based fallback when message is ambiguous
  if (files.length === 0) return 'other';

  const allConfig = files.every((f) => CONFIG_FILE_PATTERNS.some((p) => p.test(f)));
  if (allConfig) return 'chore';

  const allDocs = files.every((f) => DOC_FILE_PATTERNS.some((p) => p.test(f)));
  if (allDocs) return 'docs';

  return 'other';
}

function computeMonthsDiff(sinceDate: string, untilDate: string): number {
  const since = new Date(sinceDate);
  const until = new Date(untilDate);

  // Whole calendar months between the two dates
  let months =
    (until.getFullYear() - since.getFullYear()) * 12 +
    (until.getMonth() - since.getMonth());

  // Subtract 1 if the day-of-month hasn't been reached yet in the final month.
  // E.g. Jan 31 -> Feb 1: months=1 calendar, but day 1 < day 31, so subtract 1 => 0.
  if (until.getDate() < since.getDate()) {
    months -= 1;
  }

  return Math.max(months, 1);
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
  const result = await gitRun(args, cwd);
  if (!result.ok) return 0;
  return result.stdout.trim().split('\n').filter(Boolean).length;
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
  const result = await gitRun(args, cwd);
  if (!result.ok) return [];
  const names = result.stdout.trim().split('\n').filter(Boolean);

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
  const result = await gitRun(args, cwd);
  if (!result.ok) return [];
  const files = result.stdout.trim().split('\n').filter(Boolean);

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
  const result = await gitRun(args, cwd);
  if (!result.ok) return [];
  const entries = result.stdout
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

async function getCommitMessagesWithFiles(
  since: string,
  cwd: string,
  file?: string,
): Promise<Array<{ message: string; files: string[] }>> {
  const args = ['log', '--format=---COMMIT---%n%s', '--name-only', `--since=${since}`];
  if (file) {
    args.push('--', file);
  }
  const result = await gitRun(args, cwd);
  if (!result.ok) return [];

  const commits: Array<{ message: string; files: string[] }> = [];
  const chunks = result.stdout.split('---COMMIT---').filter(Boolean);
  for (const chunk of chunks) {
    const lines = chunk.trim().split('\n').filter(Boolean);
    if (lines.length === 0) continue;
    commits.push({
      message: lines[0],
      files: lines.slice(1),
    });
  }
  return commits;
}

export async function analyzeHistory(
  args: { file?: string; since?: string },
  cwd: string,
): Promise<HistoryResult> {
  const since = args.since ?? '6 months ago';

  // Resolve the "since" date for the output period
  const sinceResult = await gitRun(
    ['log', '--format=%aI', `--since=${since}`, '--reverse', '-1'],
    cwd,
  );
  const sinceDate = (sinceResult.ok ? sinceResult.stdout.trim().split('T')[0] : '') || new Date(
    Date.now() - 6 * 30 * 24 * 60 * 60 * 1000,
  ).toISOString().split('T')[0];
  const untilDate = new Date().toISOString().split('T')[0];

  // Skip expensive whole-project getMostChangedFiles when analyzing a single file
  const [total, authors, commitsWithFiles, mostChanged] = await Promise.all([
    getCommitCount(since, cwd, args.file),
    getAuthors(since, cwd, args.file),
    getCommitMessagesWithFiles(since, cwd, args.file),
    args.file ? Promise.resolve([] as FileChangeInfo[]) : getMostChangedFiles(since, cwd),
  ]);

  // Classification with file-based fallback for ambiguous messages
  const classification: CommitClassification = {
    feature: 0,
    fix: 0,
    refactor: 0,
    chore: 0,
    docs: 0,
    other: 0,
  };
  for (const commit of commitsWithFiles) {
    classification[classifyWithFileFallback(commit.message, commit.files)]++;
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
export const computeMonthsDiffForTest = computeMonthsDiff;
export const classifyWithFileFallbackForTest = classifyWithFileFallback;
