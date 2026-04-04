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
export declare function classifySeverity(analyzer: string): Severity;
export declare function computeRiskLevel(findings: FindingSeverity[]): RiskLevel;
export declare function buildScoringResult(analyzerCounts: Record<string, number>): ScoringResult;
