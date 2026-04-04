/**
 * testkit_analyze — Deterministic test quality analysis.
 *
 * Analyzes test files for shallow assertions, error coverage, mock health,
 * and name quality. Returns structured metrics and dimension scores.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { analyzeShallowAssertions } from '../../analyzers/shallow-assertions.js';
import { analyzeErrorCoverage } from '../../analyzers/error-coverage.js';
import { analyzeMockHealth } from '../../analyzers/mock-health.js';
import { analyzeNameQuality } from '../../analyzers/name-quality.js';
import {
  scoreAssertionDepth,
  scoreErrorTesting,
  scoreMockHealth,
  scoreSpecClarity,
  computeOverallGrade,
  valueToGrade,
  GRADE_VALUES,
  type DimensionScores,
  type Grade,
} from '../../analyzers/scoring.js';
import { discoverTestFiles, detectFramework, inferSourcePath } from '../../analyzers/discovery.js';

interface FileAnalysis {
  path: string;
  sourcePath: string | null;
  framework: string | null;
  metrics: {
    shallowAssertions: ReturnType<typeof analyzeShallowAssertions>;
    errorCoverage: ReturnType<typeof analyzeErrorCoverage> | null;
    mockHealth: ReturnType<typeof analyzeMockHealth>;
    nameQuality: ReturnType<typeof analyzeNameQuality>;
  };
  dimensions: DimensionScores;
  grade: Grade;
  diagnostics: string[];
}

interface AnalyzeResult {
  files: FileAnalysis[];
  summary: {
    totalFiles: number;
    avgGrade: Grade;
    topIssues: string[];
  };
}

async function analyzeFile(testPath: string, cwd: string, framework: string | null): Promise<FileAnalysis> {
  const fullPath = join(cwd, testPath);
  const testContent = await readFile(fullPath, 'utf-8');

  const sourcePath = inferSourcePath(testPath, cwd);
  let sourceContent: string | null = null;

  if (sourcePath) {
    try {
      sourceContent = await readFile(join(cwd, sourcePath), 'utf-8');
    } catch {
      // source file not readable
    }
  }

  const shallowAssertions = analyzeShallowAssertions(testContent);
  const errorCoverage = sourceContent
    ? analyzeErrorCoverage(sourceContent, testContent)
    : null;
  const mockHealth = analyzeMockHealth(testContent);
  const nameQuality = analyzeNameQuality(testContent);

  const dimensions: DimensionScores = {
    assertionDepth: scoreAssertionDepth(shallowAssertions),
    inputCoverage: null,
    errorTesting: errorCoverage ? scoreErrorTesting(errorCoverage) : null,
    mockHealth: scoreMockHealth(mockHealth),
    specClarity: scoreSpecClarity(nameQuality),
    independence: null,
  };

  const grade = computeOverallGrade(dimensions);

  // Generate diagnostics
  const diagnostics: string[] = [];

  if (shallowAssertions.count > 0) {
    diagnostics.push(
      `${shallowAssertions.count} shallow assertion(s) of ${shallowAssertions.total} total`
    );
  }

  if (errorCoverage && errorCoverage.throwable > 0 && errorCoverage.tested === 0) {
    diagnostics.push(
      `${errorCoverage.throwable} throwable operation(s) with zero error tests`
    );
  } else if (errorCoverage && errorCoverage.ratio < 0.5) {
    diagnostics.push(
      `Error test coverage: ${errorCoverage.tested}/${errorCoverage.throwable} throwable operations tested`
    );
  }

  if (mockHealth.internal > 0) {
    diagnostics.push(
      `${mockHealth.internal} internal module mock(s) (should mock at boundary only)`
    );
  }

  if (mockHealth.setupPercent > 30) {
    diagnostics.push(
      `${mockHealth.setupPercent}% of file is mock setup (threshold: 30%)`
    );
  }

  if (nameQuality.vague > 0) {
    diagnostics.push(
      `${nameQuality.vague} vague test name(s) of ${nameQuality.total} total`
    );
  }

  return {
    path: testPath,
    sourcePath,
    framework,
    metrics: { shallowAssertions, errorCoverage, mockHealth, nameQuality },
    dimensions,
    grade,
    diagnostics,
  };
}

export async function analyzeTool(args: { file?: string }, cwd: string): Promise<AnalyzeResult> {
  const framework = await detectFramework(cwd);

  let testPaths: string[];
  if (args.file) {
    testPaths = [args.file];
  } else {
    testPaths = await discoverTestFiles(cwd);
  }

  if (testPaths.length === 0) {
    return {
      files: [],
      summary: {
        totalFiles: 0,
        avgGrade: 'F',
        topIssues: ['No test files found in the project'],
      },
    };
  }

  const files = await Promise.all(
    testPaths.map(p => analyzeFile(p, cwd, framework))
  );

  // Compute average grade
  const gradeSum = files.reduce((sum, f) => sum + GRADE_VALUES[f.grade], 0);
  const avgGrade = valueToGrade(gradeSum / files.length);

  // Aggregate top issues
  const issueCounts = new Map<string, number>();
  for (const file of files) {
    for (const diag of file.diagnostics) {
      // Normalize to issue type
      const type = diag.includes('shallow') ? 'Shallow assertions'
        : diag.includes('error test') ? 'Missing error tests'
        : diag.includes('throwable') ? 'Missing error tests'
        : diag.includes('internal module') ? 'Internal module mocking'
        : diag.includes('mock setup') ? 'Excessive mock setup'
        : diag.includes('vague') ? 'Vague test names'
        : diag;
      issueCounts.set(type, (issueCounts.get(type) ?? 0) + 1);
    }
  }

  const topIssues = Array.from(issueCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, count]) => `${type} (${count} file${count > 1 ? 's' : ''})`);

  return { files, summary: { totalFiles: files.length, avgGrade, topIssues } };
}
