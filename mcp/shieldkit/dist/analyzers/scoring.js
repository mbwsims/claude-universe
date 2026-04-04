/**
 * Severity scoring for security findings.
 *
 * Classifies findings by severity and computes overall risk level.
 */
const SEVERITY_MAP = {
    'hardcoded-secrets': 'critical',
    'sql-injection': 'critical',
    'missing-auth': 'high',
    'dangerous-functions': 'high',
    'cors-config': 'medium',
};
export function classifySeverity(analyzer) {
    return SEVERITY_MAP[analyzer] ?? 'low';
}
export function computeRiskLevel(findings) {
    const activeSeverities = findings.filter(f => f.count > 0);
    if (activeSeverities.length === 0)
        return 'clean';
    const hasCritical = activeSeverities.some(f => f.severity === 'critical');
    const hasHigh = activeSeverities.some(f => f.severity === 'high');
    const hasMedium = activeSeverities.some(f => f.severity === 'medium');
    if (hasCritical)
        return 'critical';
    if (hasHigh)
        return 'high';
    if (hasMedium)
        return 'medium';
    return 'low';
}
export function buildScoringResult(analyzerCounts) {
    const findings = Object.entries(analyzerCounts).map(([analyzer, count]) => ({
        analyzer,
        severity: classifySeverity(analyzer),
        count,
    }));
    const riskLevel = computeRiskLevel(findings);
    // Build summary
    const totalFindings = findings.reduce((sum, f) => sum + f.count, 0);
    const criticalCount = findings.filter(f => f.severity === 'critical').reduce((s, f) => s + f.count, 0);
    const highCount = findings.filter(f => f.severity === 'high').reduce((s, f) => s + f.count, 0);
    const parts = [];
    parts.push(`Risk level: ${riskLevel}`);
    parts.push(`${totalFindings} total finding(s)`);
    if (criticalCount > 0)
        parts.push(`${criticalCount} critical`);
    if (highCount > 0)
        parts.push(`${highCount} high`);
    return {
        findings,
        riskLevel,
        summary: parts.join(' | '),
    };
}
//# sourceMappingURL=scoring.js.map