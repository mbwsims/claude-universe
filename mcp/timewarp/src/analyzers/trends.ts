/**
 * timewarp_trends — Trend computation for growth rates and acceleration.
 *
 * Uses child_process.execFile (promisified) for all git commands.
 * Samples files at multiple time points, computes growth rates,
 * detects acceleration patterns, and projects future size.
 */

import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { discoverSourceFiles } from './discovery.js';
import { gitRun, type GitResult } from '../../../shared/git-utils.js';

const execFile = promisify(execFileCb);

interface Sample {
  date: string;
  lines: number;
  functions: number;
}

interface GrowthInfo {
  linesPerMonth: number;
  percentPerMonth: number;
  pattern: 'accelerating' | 'linear' | 'decelerating' | 'flat';
}

interface ChurnInfo {
  firstHalf: number;
  secondHalf: number;
  pattern: 'accelerating' | 'linear' | 'decelerating' | 'flat';
}

interface Projection {
  linesIn3Months: number;
  linesIn6Months: number;
  crossesThreshold: { threshold: number; inMonths: number } | null;
}

export interface FileTrend {
  file: string;
  samples: Sample[];
  growth: GrowthInfo;
  churn: ChurnInfo;
  projection: Projection;
}

export type TrendsResult = FileTrend[];

const FUNCTION_PATTERNS = [
  // JavaScript/TypeScript
  /\bfunction\s+\w+/g,
  /\b(const|let|var)\s+\w+\s*=\s*(async\s+)?\(/g,
  /\b(export\s+)?(async\s+)?function\b/g,
  // Python
  /\bdef\s+\w+/g,
  // Rust
  /\bfn\s+\w+/g,
  // Go
  /\bfunc\s+/g,
  // Ruby
  /\bdef\s+\w+/g,
  // Java/Kotlin
  /\b(public|private|protected)\s+(static\s+)?\w+\s+\w+\s*\(/g,
];

function countFunctions(content: string): number {
  const lines = content.split('\n');
  let count = 0;
  const seen = new Set<number>();

  for (const pattern of FUNCTION_PATTERNS) {
    for (let i = 0; i < lines.length; i++) {
      if (seen.has(i)) continue;
      const resetPattern = new RegExp(pattern.source, pattern.flags);
      if (resetPattern.test(lines[i])) {
        seen.add(i);
        count++;
      }
    }
  }

  return count;
}

async function getTopChangedFiles(
  months: number,
  cwd: string,
): Promise<string[]> {
  const since = `${months} months ago`;
  const args = ['log', '--format=format:', '--name-only', `--since=${since}`];
  const result = await gitRun(args, cwd);
  if (!result.ok) return [];
  const files = result.stdout.trim().split('\n').filter(Boolean);

  const counts = new Map<string, number>();
  for (const file of files) {
    counts.set(file, (counts.get(file) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([file]) => file);
}

async function getCommitAtDate(
  targetDate: string,
  file: string,
  cwd: string,
): Promise<string | null> {
  const args = [
    'log',
    '--format=%H',
    `--before=${targetDate}`,
    '-1',
    '--',
    file,
  ];
  const result = await gitRun(args, cwd);
  if (!result.ok) return null;
  const hash = result.stdout.trim();
  return hash || null;
}

async function getFileAtCommit(
  hash: string,
  file: string,
  cwd: string,
): Promise<string | null> {
  try {
    const { stdout } = await execFile(
      'git',
      ['show', `${hash}:${file}`],
      { cwd, maxBuffer: 10 * 1024 * 1024 },
    );
    return stdout;
  } catch {
    return null;
  }
}

async function getCommitCountInRange(
  sinceDate: string,
  untilDate: string,
  file: string,
  cwd: string,
): Promise<number> {
  const args = [
    'log',
    '--oneline',
    `--since=${sinceDate}`,
    `--until=${untilDate}`,
    '--',
    file,
  ];
  const result = await gitRun(args, cwd);
  if (!result.ok) return 0;
  return result.stdout.trim().split('\n').filter(Boolean).length;
}

function computeSampleDates(months: number): string[] {
  const now = new Date();
  const numSamples = Math.max(3, Math.min(months + 1, 7));
  const dates: string[] = [];

  for (let i = 0; i < numSamples; i++) {
    const sampleDate = new Date(now);
    const monthsBack = Math.round((months * (numSamples - 1 - i)) / (numSamples - 1));
    sampleDate.setMonth(sampleDate.getMonth() - monthsBack);
    dates.push(sampleDate.toISOString().split('T')[0]);
  }

  return dates;
}

function detectGrowthPattern(
  samples: Sample[],
  months: number,
): 'accelerating' | 'linear' | 'decelerating' | 'flat' {
  if (samples.length < 3) return 'flat';

  const earliest = samples[0].lines;
  const latest = samples[samples.length - 1].lines;
  const totalGrowth = latest - earliest;
  const totalGrowthPercent = earliest > 0 ? (totalGrowth / earliest) * 100 : 0;

  // If total growth is less than 15%, classify as flat (constant threshold)
  if (Math.abs(totalGrowthPercent) < 15) return 'flat';

  const midIndex = Math.floor(samples.length / 2);
  const midLines = samples[midIndex].lines;

  const firstHalfGrowth = midLines - earliest;
  const secondHalfGrowth = latest - midLines;

  // Avoid division by zero
  if (firstHalfGrowth === 0 && secondHalfGrowth === 0) return 'flat';
  if (firstHalfGrowth === 0) return 'accelerating';

  const ratio = secondHalfGrowth / firstHalfGrowth;

  if (ratio > 1.5) return 'accelerating';
  if (ratio < 0.7) return 'decelerating';
  return 'linear';
}

function detectChurnPattern(
  firstHalf: number,
  secondHalf: number,
): 'accelerating' | 'linear' | 'decelerating' | 'flat' {
  if (firstHalf === 0 && secondHalf === 0) return 'flat';
  if (firstHalf === 0) return 'accelerating';

  // Low-count guard BEFORE ratio check — with fewer than 3 commits in each
  // half, the ratio is meaningless noise.
  if (firstHalf < 3 && secondHalf < 3) return 'flat';

  const ratio = secondHalf / firstHalf;

  if (ratio > 1.5) return 'accelerating';
  if (ratio < 0.7) return 'decelerating';
  return 'linear';
}

async function analyzeFileTrend(
  file: string,
  months: number,
  cwd: string,
): Promise<FileTrend | null> {
  const sampleDates = computeSampleDates(months);
  const samples: Sample[] = [];

  for (const date of sampleDates) {
    const hash = await getCommitAtDate(date, file, cwd);
    if (!hash) continue;

    const content = await getFileAtCommit(hash, file, cwd);
    if (content === null) continue;

    const lines = content.split('\n').length;
    const functions = countFunctions(content);

    samples.push({ date, lines, functions });
  }

  if (samples.length < 2) return null;

  const earliest = samples[0];
  const latest = samples[samples.length - 1];
  const linesGrowth = latest.lines - earliest.lines;
  const linesPerMonth = Math.round((linesGrowth / Math.max(months, 1)) * 10) / 10;
  const percentPerMonth =
    earliest.lines > 0
      ? Math.round(((linesGrowth / earliest.lines) * 100) / Math.max(months, 1) * 10) / 10
      : 0;

  const growthPattern = detectGrowthPattern(samples, months);

  // Churn analysis: commits in first half vs second half
  const now = new Date();
  const start = new Date(now);
  start.setMonth(start.getMonth() - months);
  const mid = new Date(now);
  mid.setMonth(mid.getMonth() - Math.round(months / 2));

  const startStr = start.toISOString().split('T')[0];
  const midStr = mid.toISOString().split('T')[0];
  const nowStr = now.toISOString().split('T')[0];

  const [firstHalfCommits, secondHalfCommits] = await Promise.all([
    getCommitCountInRange(startStr, midStr, file, cwd),
    getCommitCountInRange(midStr, nowStr, file, cwd),
  ]);

  const churnPattern = detectChurnPattern(firstHalfCommits, secondHalfCommits);

  // Projection — use exponential model for accelerating files, linear otherwise
  const currentLines = latest.lines;
  let linesIn3Months: number;
  let linesIn6Months: number;

  if (growthPattern === 'accelerating' && percentPerMonth > 0) {
    // Exponential projection: current * (1 + rate)^months
    const monthlyRate = percentPerMonth / 100;
    linesIn3Months = Math.round(currentLines * Math.pow(1 + monthlyRate, 3));
    linesIn6Months = Math.round(currentLines * Math.pow(1 + monthlyRate, 6));
  } else {
    linesIn3Months = Math.round(currentLines + linesPerMonth * 3);
    linesIn6Months = Math.round(currentLines + linesPerMonth * 6);
  }

  // Threshold crossing: common thresholds
  const thresholds = [300, 500, 750, 1000, 1500, 2000];
  let crossesThreshold: { threshold: number; inMonths: number } | null = null;

  if (linesPerMonth > 0) {
    for (const threshold of thresholds) {
      if (currentLines < threshold) {
        const monthsToThreshold = Math.ceil((threshold - currentLines) / linesPerMonth);
        if (monthsToThreshold <= 12) {
          crossesThreshold = { threshold, inMonths: monthsToThreshold };
          break;
        }
      }
    }
  }

  return {
    file,
    samples,
    growth: {
      linesPerMonth,
      percentPerMonth,
      pattern: growthPattern,
    },
    churn: {
      firstHalf: firstHalfCommits,
      secondHalf: secondHalfCommits,
      pattern: churnPattern,
    },
    projection: {
      linesIn3Months,
      linesIn6Months,
      crossesThreshold,
    },
  };
}

export async function analyzeTrends(
  args: { file?: string; months?: number },
  cwd: string,
): Promise<TrendsResult> {
  const months = args.months ?? 6;

  let filesToAnalyze: string[];

  if (args.file) {
    filesToAnalyze = [args.file];
  } else {
    // Get top 20 most-changed files, filtered to source files
    const topChanged = await getTopChangedFiles(months, cwd);
    const sourceFiles = new Set(await discoverSourceFiles(cwd));
    filesToAnalyze = topChanged.filter((f) => sourceFiles.has(f));

    if (filesToAnalyze.length === 0) {
      filesToAnalyze = topChanged.slice(0, 20);
    }
  }

  // Process files in parallel batches of 5
  const BATCH_SIZE = 5;
  const results: FileTrend[] = [];

  for (let i = 0; i < filesToAnalyze.length; i += BATCH_SIZE) {
    const batch = filesToAnalyze.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((file) => analyzeFileTrend(file, months, cwd)),
    );
    for (const trend of batchResults) {
      if (trend) {
        results.push(trend);
      }
    }
  }

  // Sort by absolute growth rate descending
  results.sort((a, b) => Math.abs(b.growth.linesPerMonth) - Math.abs(a.growth.linesPerMonth));

  return results;
}

// Test-only exports
export const detectGrowthPatternForTest = detectGrowthPattern;
export const detectChurnPatternForTest = detectChurnPattern;
export const analyzeFileTrendForTest = analyzeFileTrend;
