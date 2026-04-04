/**
 * shieldkit_status -- Quick security health combining scan + surface.
 *
 * Provides a single overview of the project's security posture.
 */

import { scanTool } from './scan.js';
import { surfaceTool } from './surface.js';

export interface StatusResult {
  framework: string | null;
  riskLevel: string;
  totalFindings: number;
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  endpoints: number;
  unprotectedEndpoints: number;
  envFiles: number;
  ungitignored: number;
  dbAccessFiles: number;
  topIssues: string[];
  quickSummary: string;
}

export async function statusTool(cwd: string): Promise<StatusResult> {
  const [scanResult, surfaceResult] = await Promise.all([
    scanTool({}, cwd),
    surfaceTool(cwd),
  ]);

  const criticalFindings = scanResult.scoring.findings
    .filter(f => f.severity === 'critical')
    .reduce((s, f) => s + f.count, 0);

  const highFindings = scanResult.scoring.findings
    .filter(f => f.severity === 'high')
    .reduce((s, f) => s + f.count, 0);

  const mediumFindings = scanResult.scoring.findings
    .filter(f => f.severity === 'medium')
    .reduce((s, f) => s + f.count, 0);

  const totalFindings = scanResult.scoring.findings
    .reduce((s, f) => s + f.count, 0);

  const unprotectedEndpoints = surfaceResult.endpoints.filter(e => !e.hasAuth).length;
  const ungitignored = surfaceResult.envFiles.filter(e => !e.gitignored).length;

  // Build top issues
  const topIssues: string[] = [];
  for (const finding of scanResult.scoring.findings) {
    if (finding.count > 0) {
      topIssues.push(`${finding.analyzer}: ${finding.count} finding(s) [${finding.severity}]`);
    }
  }
  if (unprotectedEndpoints > 0) {
    topIssues.push(`${unprotectedEndpoints} endpoint(s) without auth middleware`);
  }
  if (ungitignored > 0) {
    topIssues.push(`${ungitignored} .env file(s) not in .gitignore`);
  }

  // Build summary
  const parts: string[] = [];
  parts.push(`Risk: ${scanResult.scoring.riskLevel}`);
  parts.push(`${totalFindings} finding(s)`);
  parts.push(`${surfaceResult.endpoints.length} endpoint(s)`);
  if (unprotectedEndpoints > 0) {
    parts.push(`${unprotectedEndpoints} unprotected`);
  }
  if (surfaceResult.framework) {
    parts.push(`Framework: ${surfaceResult.framework}`);
  }

  return {
    framework: surfaceResult.framework,
    riskLevel: scanResult.scoring.riskLevel,
    totalFindings,
    criticalFindings,
    highFindings,
    mediumFindings,
    endpoints: surfaceResult.endpoints.length,
    unprotectedEndpoints,
    envFiles: surfaceResult.envFiles.length,
    ungitignored,
    dbAccessFiles: surfaceResult.dbAccessFiles,
    topIssues,
    quickSummary: parts.join(' | '),
  };
}
