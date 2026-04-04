/**
 * scoring.ts -- Compute complexity/risk score for a file.
 *
 * Combines multiple signals (line count, function count, nesting depth,
 * churn, coupling) into a single risk score and classification.
 */
/**
 * Compute a complexity sub-score from file metrics (0-100).
 */
function computeComplexityScore(metrics) {
    // Line count contribution: files over 300 lines start scoring higher
    const linePenalty = Math.min(metrics.lineCount / 500, 1) * 30;
    // Function count: many functions = higher complexity
    const funcPenalty = Math.min(metrics.functionCount / 20, 1) * 25;
    // Nesting depth: deep nesting is a strong complexity signal
    const nestPenalty = Math.min(metrics.maxNestingDepth / 6, 1) * 30;
    // Import count: many imports = more coupling surface
    const importPenalty = Math.min(metrics.importCount / 15, 1) * 15;
    return linePenalty + funcPenalty + nestPenalty + importPenalty;
}
/**
 * Compute a churn sub-score (0-100).
 * High churn = frequently changing = higher risk.
 */
function computeChurnScore(churn) {
    // Change frequency: files changing more than 20 times in 6 months are hot
    const changePenalty = Math.min(churn.changes / 30, 1) * 60;
    // Multiple authors: more authors = coordination risk
    const authorPenalty = Math.min(churn.authors / 5, 1) * 40;
    return changePenalty + authorPenalty;
}
/**
 * Compute a coupling sub-score (0-100).
 * Many importers = high coupling = risky to change.
 */
function computeCouplingScore(importerCount) {
    return Math.min(importerCount / 10, 1) * 100;
}
/**
 * Combine all signals into a final risk score.
 *
 * Weights: churn (40%), complexity (40%), coupling (20%).
 */
export function computeRiskScore(metrics, churn, importerCount) {
    const complexityScore = computeComplexityScore(metrics);
    const churnScore = computeChurnScore(churn);
    const couplingScore = computeCouplingScore(importerCount);
    const score = Math.round(churnScore * 0.4 + complexityScore * 0.4 + couplingScore * 0.2);
    let risk;
    if (score >= 75) {
        risk = 'Critical';
    }
    else if (score >= 50) {
        risk = 'High';
    }
    else if (score >= 25) {
        risk = 'Medium';
    }
    else {
        risk = 'Low';
    }
    return {
        score,
        risk,
        breakdown: {
            complexityScore: Math.round(complexityScore),
            churnScore: Math.round(churnScore),
            couplingScore: Math.round(couplingScore),
        },
    };
}
//# sourceMappingURL=scoring.js.map