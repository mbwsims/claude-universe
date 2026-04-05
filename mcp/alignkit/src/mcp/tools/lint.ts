/**
 * alignkit_local_lint -- Static instruction quality analysis.
 *
 * Discovers instruction files, parses rules, runs diagnostics,
 * and returns structured results.
 */

import { discoverInstructionFiles, parseRules, type InstructionFile, type ParsedRule } from '../../analyzers/discovery.js';
import { runDiagnostics, type Diagnostic, type DiagnosticCode, type Severity } from '../../analyzers/diagnostics.js';

export interface LintResult {
  files: Array<{
    path: string;
    type: string;
    ruleCount: number;
  }>;
  rules: ParsedRule[];
  diagnostics: Diagnostic[];
  summary: {
    totalFiles: number;
    totalRules: number;
    totalDiagnostics: number;
    byCode: Record<string, number>;
    bySeverity: Record<Severity, number>;
  };
}

export async function lintTool(args: { file?: string }, cwd: string): Promise<LintResult> {
  const instructionFiles = await discoverInstructionFiles(cwd);

  if (instructionFiles.length === 0) {
    return {
      files: [],
      rules: [],
      diagnostics: [],
      summary: {
        totalFiles: 0,
        totalRules: 0,
        totalDiagnostics: 0,
        byCode: {},
        bySeverity: { warning: 0, error: 0 },
      },
    };
  }

  // If a specific file was requested, filter to it
  const filesToAnalyze = args.file
    ? instructionFiles.filter(f => f.relativePath === args.file || f.absolutePath === args.file)
    : instructionFiles;

  if (filesToAnalyze.length === 0 && args.file) {
    return {
      files: [],
      rules: [],
      diagnostics: [],
      summary: {
        totalFiles: 0,
        totalRules: 0,
        totalDiagnostics: 0,
        byCode: {},
        bySeverity: { warning: 0, error: 0 },
      },
    };
  }

  // Parse rules from all files
  const allRules: ParsedRule[] = [];
  for (const file of filesToAnalyze) {
    const rules = parseRules(file.content, file.relativePath);
    allRules.push(...rules);
  }

  // Run diagnostics
  const diagnostics = runDiagnostics(allRules, filesToAnalyze);

  // Build summary
  const byCode: Record<string, number> = {};
  const bySeverity: Record<Severity, number> = { warning: 0, error: 0 };

  for (const diag of diagnostics) {
    byCode[diag.code] = (byCode[diag.code] ?? 0) + 1;
    bySeverity[diag.severity]++;
  }

  return {
    files: filesToAnalyze.map(f => ({
      path: f.relativePath,
      type: f.type,
      ruleCount: allRules.filter(r => r.sourceFile === f.relativePath).length,
    })),
    rules: allRules,
    diagnostics,
    summary: {
      totalFiles: filesToAnalyze.length,
      totalRules: allRules.length,
      totalDiagnostics: diagnostics.length,
      byCode,
      bySeverity,
    },
  };
}
