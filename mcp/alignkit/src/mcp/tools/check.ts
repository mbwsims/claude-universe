/**
 * alignkit_local_check -- Conformance checking (no session history).
 *
 * For each instruction rule, classifies by type and runs verifiable
 * checks against the codebase. Returns structured verdicts with evidence.
 */

import { discoverInstructionFiles, parseRules, type ParsedRule } from '../../analyzers/discovery.js';
import { checkConformance, type RuleVerdict } from '../../analyzers/conformance.js';

export interface CheckResult {
  rules: RuleVerdict[];
  summary: {
    totalRules: number;
    conforms: number;
    violates: number;
    unverifiable: number;
  };
}

export async function checkTool(args: { file?: string }, cwd: string): Promise<CheckResult> {
  const instructionFiles = await discoverInstructionFiles(cwd);

  if (instructionFiles.length === 0) {
    return {
      rules: [],
      summary: { totalRules: 0, conforms: 0, violates: 0, unverifiable: 0 },
    };
  }

  // If a specific file was requested, filter to it
  const filesToAnalyze = args.file
    ? instructionFiles.filter(f => f.relativePath === args.file || f.absolutePath === args.file)
    : instructionFiles;

  // Parse rules from all files
  const allRules: ParsedRule[] = [];
  for (const file of filesToAnalyze) {
    const rules = parseRules(file.content, file.relativePath);
    allRules.push(...rules);
  }

  // Run conformance checks
  const verdicts = await checkConformance(allRules, cwd);

  // Build summary
  const summary = {
    totalRules: verdicts.length,
    conforms: verdicts.filter(v => v.verdict === 'conforms').length,
    violates: verdicts.filter(v => v.verdict === 'violates').length,
    unverifiable: verdicts.filter(v => v.verdict === 'unverifiable').length,
  };

  return { rules: verdicts, summary };
}
