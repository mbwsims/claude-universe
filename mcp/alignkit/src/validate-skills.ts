import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { glob } from 'tinyglobby';

import { checkConformance, checkToolDeclarations, type RuleVerdict } from './analyzers/conformance.js';
import type { Diagnostic } from './analyzers/diagnostics.js';
import { runDiagnostics } from './analyzers/diagnostics.js';
import { parseRules, type InstructionFile, type ParsedRule } from './analyzers/discovery.js';

const ALLOWED_TOOLS_MARKER = 'allowed-tools';
const SKILL_PATTERNS = [
  'skills/**/SKILL.md',
  '.claude/skills/**/SKILL.md',
];
const IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/.git/**',
];

export interface SkillValidationSummary {
  ok: boolean;
  errorCount: number;
  toolDeclarationViolationCount: number;
  warningCount: number;
  filesScanned: number;
}

export interface SkillValidationResult {
  summary: SkillValidationSummary;
  diagnostics: Diagnostic[];
  toolDeclarationViolations: RuleVerdict[];
  conformanceWarnings: RuleVerdict[];
}

function isToolDeclarationViolation(verdict: RuleVerdict): boolean {
  return verdict.verdict === 'violates' && verdict.evidence.includes(ALLOWED_TOOLS_MARKER);
}

async function discoverSkillFiles(cwd: string): Promise<InstructionFile[]> {
  const relativePaths = await glob(SKILL_PATTERNS, {
    cwd,
    ignore: IGNORE_PATTERNS,
    absolute: false,
    dot: true,
  });

  const uniquePaths = [...new Set(relativePaths)].sort();
  const files: InstructionFile[] = [];

  for (const relativePath of uniquePaths) {
    const absolutePath = join(cwd, relativePath);
    try {
      const content = await readFile(absolutePath, 'utf-8');
      files.push({
        relativePath,
        absolutePath,
        content,
        type: 'skill',
      });
    } catch {
      // Skip unreadable files.
    }
  }

  return files;
}

export async function validateSkills(targetDir: string): Promise<SkillValidationResult> {
  const cwd = resolve(targetDir);
  const skillFiles = await discoverSkillFiles(cwd);
  const allRules: ParsedRule[] = [];

  for (const file of skillFiles) {
    allRules.push(...parseRules(file.content, file.relativePath));
  }

  const diagnostics = runDiagnostics(allRules, skillFiles);
  const conformanceResults = await checkConformance(allRules, cwd);
  const toolDeclarationResults = checkToolDeclarations(skillFiles);
  const allVerdicts = [...conformanceResults, ...toolDeclarationResults];

  const errorCount = diagnostics.filter(diagnostic => diagnostic.severity === 'error').length;
  const toolDeclarationViolations = allVerdicts.filter(isToolDeclarationViolation);
  const conformanceWarnings = allVerdicts.filter(
    verdict => verdict.verdict === 'violates' && !isToolDeclarationViolation(verdict)
  );
  const warningCount = diagnostics.filter(diagnostic => diagnostic.severity === 'warning').length
    + conformanceWarnings.length;

  return {
    summary: {
      ok: errorCount === 0 && toolDeclarationViolations.length === 0,
      errorCount,
      toolDeclarationViolationCount: toolDeclarationViolations.length,
      warningCount,
      filesScanned: skillFiles.length,
    },
    diagnostics,
    toolDeclarationViolations,
    conformanceWarnings,
  };
}

export function formatSkillValidationDetails(result: SkillValidationResult): string[] {
  const lines: string[] = [];

  if (result.summary.errorCount > 0) {
    lines.push('Metadata errors:');
    for (const diagnostic of result.diagnostics.filter(entry => entry.severity === 'error')) {
      lines.push(`- ${diagnostic.sourceFile}:${diagnostic.line} ${diagnostic.code} ${diagnostic.message}`);
    }
  }

  if (result.summary.toolDeclarationViolationCount > 0) {
    lines.push('Tool declaration violations:');
    for (const verdict of result.toolDeclarationViolations) {
      lines.push(`- ${verdict.text} — ${verdict.evidence}`);
    }
  }

  if (result.summary.warningCount > 0) {
    lines.push('Warnings:');
    for (const diagnostic of result.diagnostics.filter(entry => entry.severity === 'warning')) {
      lines.push(`- ${diagnostic.sourceFile}:${diagnostic.line} ${diagnostic.code} ${diagnostic.message}`);
    }
    for (const verdict of result.conformanceWarnings) {
      lines.push(`- ${verdict.text} — ${verdict.evidence}`);
    }
  }

  return lines;
}

export async function runSkillValidationCli(
  targetDir: string,
  stdout: Pick<NodeJS.WriteStream, 'write'> = process.stdout,
  stderr: Pick<NodeJS.WriteStream, 'write'> = process.stderr,
): Promise<number> {
  const result = await validateSkills(targetDir);
  stdout.write(`${JSON.stringify(result.summary, null, 2)}\n`);

  const detailLines = formatSkillValidationDetails(result);
  if (detailLines.length > 0) {
    stderr.write(`${detailLines.join('\n')}\n`);
  }

  return result.summary.ok ? 0 : 1;
}
