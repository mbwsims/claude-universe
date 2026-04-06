/**
 * alignkit_local_status -- Quick summary combining lint + check counts.
 */

import { lintTool } from './lint.js';
import { checkTool } from './check.js';

export interface StatusResult {
  instructionFiles: number;
  totalRules: number;
  lintIssues: number;
  lintErrors: number;
  lintWarnings: number;
  conformance: {
    conforms: number;
    violates: number;
    unverifiable: number;
  };
  quickSummary: string;
}

export async function statusTool(cwd: string): Promise<StatusResult> {
  const [lintResult, checkResult] = await Promise.all([
    lintTool({}, cwd),
    checkTool({}, cwd),
  ]);

  const parts: string[] = [];
  parts.push(`${lintResult.summary.totalFiles} instruction file(s), ${lintResult.summary.totalRules} rule(s)`);
  parts.push(`Lint: ${lintResult.summary.totalDiagnostics} issue(s) (${lintResult.summary.bySeverity.error} errors, ${lintResult.summary.bySeverity.warning} warnings)`);
  parts.push(`Conformance: ${checkResult.summary.conforms} conform, ${checkResult.summary.violates} violate, ${checkResult.summary.unverifiable} unverifiable`);

  return {
    instructionFiles: lintResult.summary.totalFiles,
    totalRules: lintResult.summary.totalRules,
    lintIssues: lintResult.summary.totalDiagnostics,
    lintErrors: lintResult.summary.bySeverity.error,
    lintWarnings: lintResult.summary.bySeverity.warning,
    conformance: {
      conforms: checkResult.summary.conforms,
      violates: checkResult.summary.violates,
      unverifiable: checkResult.summary.unverifiable,
    },
    quickSummary: parts.join(' | '),
  };
}
