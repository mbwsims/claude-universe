/**
 * Severity scoring for security findings.
 *
 * Classifies findings by severity and computes overall risk level.
 */

export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'clean';

export interface FindingSeverity {
  analyzer: string;
  severity: Severity;
  count: number;
}

export interface ScoringResult {
  findings: FindingSeverity[];
  riskLevel: RiskLevel;
  summary: string;
}

const SEVERITY_MAP: Record<string, Severity> = {
  'hardcoded-secrets': 'critical',
  'sql-injection': 'critical',
  'missing-auth': 'high',
  'dangerous-functions': 'high',
  'cors-config': 'medium',
};

export function classifySeverity(analyzer: string): Severity {
  return SEVERITY_MAP[analyzer] ?? 'low';
}

export function computeRiskLevel(findings: FindingSeverity[]): RiskLevel {
  const activeSeverities = findings.filter(f => f.count > 0);

  if (activeSeverities.length === 0) return 'clean';

  const hasCritical = activeSeverities.some(f => f.severity === 'critical');
  const hasHigh = activeSeverities.some(f => f.severity === 'high');
  const hasMedium = activeSeverities.some(f => f.severity === 'medium');

  if (hasCritical) return 'critical';
  if (hasHigh) return 'high';
  if (hasMedium) return 'medium';
  return 'low';
}

export function buildScoringResult(analyzerCounts: Record<string, number>): ScoringResult {
  const findings: FindingSeverity[] = Object.entries(analyzerCounts).map(
    ([analyzer, count]) => ({
      analyzer,
      severity: classifySeverity(analyzer),
      count,
    })
  );

  const riskLevel = computeRiskLevel(findings);

  // Build summary
  const totalFindings = findings.reduce((sum, f) => sum + f.count, 0);
  const criticalCount = findings.filter(f => f.severity === 'critical').reduce((s, f) => s + f.count, 0);
  const highCount = findings.filter(f => f.severity === 'high').reduce((s, f) => s + f.count, 0);

  const parts: string[] = [];
  parts.push(`Risk level: ${riskLevel}`);
  parts.push(`${totalFindings} total finding(s)`);
  if (criticalCount > 0) parts.push(`${criticalCount} critical`);
  if (highCount > 0) parts.push(`${highCount} high`);

  return {
    findings,
    riskLevel,
    summary: parts.join(' | '),
  };
}

/**
 * Build scoring result from pre-classified per-finding severity data.
 * Used when analyzers provide their own severity per finding
 * (e.g., dangerous-functions with critical/high/medium per pattern).
 */
export function buildScoringResultFromFindings(findings: FindingSeverity[]): ScoringResult {
  const riskLevel = computeRiskLevel(findings);

  const totalFindings = findings.reduce((sum, f) => sum + f.count, 0);
  const criticalCount = findings.filter(f => f.severity === 'critical').reduce((s, f) => s + f.count, 0);
  const highCount = findings.filter(f => f.severity === 'high').reduce((s, f) => s + f.count, 0);

  const parts: string[] = [];
  parts.push(`Risk level: ${riskLevel}`);
  parts.push(`${totalFindings} total finding(s)`);
  if (criticalCount > 0) parts.push(`${criticalCount} critical`);
  if (highCount > 0) parts.push(`${highCount} high`);

  return {
    findings,
    riskLevel,
    summary: parts.join(' | '),
  };
}
