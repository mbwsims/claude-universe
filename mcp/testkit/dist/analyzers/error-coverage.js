/**
 * Analyzes error test coverage by comparing throwable operations in source
 * to error assertions in tests.
 */
// Patterns that indicate a function can throw/reject
const THROWABLE_PATTERNS = [
    /\bthrow\s+new\b/,
    /\bthrow\s+\w/,
    /Promise\.reject\(/,
    /\.reject\(/,
];
// Patterns that indicate an error is being tested
const ERROR_TEST_PATTERNS = [
    /\.toThrow\(/,
    /\.toThrowError\(/,
    /\.rejects\./,
    /expect\.unreachable/,
    /\.toThrow\(\)/,
];
export function analyzeErrorCoverage(sourceContent, testContent) {
    const sourceLines = sourceContent.split('\n');
    const testLines = testContent.split('\n');
    const throwableLocations = [];
    const errorTestLocations = [];
    // Count throwable operations in source
    for (let i = 0; i < sourceLines.length; i++) {
        const line = sourceLines[i];
        for (const pattern of THROWABLE_PATTERNS) {
            if (pattern.test(line)) {
                throwableLocations.push({ line: i + 1, text: line.trim() });
                break;
            }
        }
    }
    // Count error assertions in tests
    for (let i = 0; i < testLines.length; i++) {
        const line = testLines[i];
        for (const pattern of ERROR_TEST_PATTERNS) {
            if (pattern.test(line)) {
                errorTestLocations.push({ line: i + 1, text: line.trim() });
                break;
            }
        }
    }
    const throwable = throwableLocations.length;
    const tested = errorTestLocations.length;
    return {
        throwable,
        tested,
        ratio: throwable === 0 ? 1 : tested / throwable,
        throwableLocations,
        errorTestLocations,
    };
}
//# sourceMappingURL=error-coverage.js.map