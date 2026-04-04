/**
 * Missing auth analyzer.
 *
 * Detects route handler files that lack auth function calls near the top.
 * Checks for common auth patterns in files matching route/handler conventions.
 */
const AUTH_PATTERNS = [
    /\bgetSession\b/,
    /\bgetUser\b/,
    /\bverifyToken\b/,
    /\bauthenticate\b/,
    /\brequireAuth\b/,
    /\bwithAuth\b/,
    /\bisAuthenticated\b/,
    /\bcheckAuth\b/,
];
const ROUTE_FILE_PATTERNS = [
    /route\.(ts|js|tsx|jsx)$/,
    /handler\.(ts|js|tsx|jsx)$/,
    /controller\.(ts|js|tsx|jsx)$/,
    /[/\\]routes[/\\]/,
    /[/\\]api[/\\]/,
    /[/\\]controllers[/\\]/,
];
export function isRouteFile(filePath) {
    return ROUTE_FILE_PATTERNS.some(p => p.test(filePath));
}
export function analyzeAuth(content) {
    // Check if any auth function calls appear in the file
    return AUTH_PATTERNS.some(p => p.test(content));
}
export function buildMissingAuthResult(files) {
    const unprotected = files.filter(f => !f.hasAuth).length;
    return {
        total: files.length,
        unprotected,
        locations: files.map(f => ({ file: f.path, hasAuth: f.hasAuth })),
    };
}
//# sourceMappingURL=missing-auth.js.map