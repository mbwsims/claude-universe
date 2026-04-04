/**
 * Hardcoded secrets analyzer.
 *
 * Detects secret values committed in source code such as passwords,
 * API keys, tokens, and known key prefixes.
 */
const SECRET_PATTERNS = [
    { regex: /password\s*=\s*["']/, name: 'password-assignment' },
    { regex: /apiKey\s*=\s*["']/, name: 'api-key-assignment' },
    { regex: /secret\s*=\s*["']/, name: 'secret-assignment' },
    { regex: /token\s*=\s*["']/, name: 'token-assignment' },
    { regex: /Bearer\s+[A-Za-z0-9]/, name: 'bearer-token' },
    { regex: /sk-[A-Za-z0-9]/, name: 'openai-secret-key' },
    { regex: /pk_[A-Za-z0-9]/, name: 'stripe-publishable-key' },
    { regex: /AKIA[A-Z0-9]/, name: 'aws-access-key' },
];
const EXCLUDE_FILE_PATTERNS = [
    /\.(test|spec)\.(ts|js|tsx|jsx|mjs|cjs)$/,
    /\/__tests__\//,
    /\.env\.example$/,
];
const EXCLUDE_LINE_PATTERNS = [
    /TODO/i,
    /placeholder/i,
];
export function isExcludedFile(filePath) {
    return EXCLUDE_FILE_PATTERNS.some(p => p.test(filePath));
}
export function analyzeHardcodedSecrets(content, filePath) {
    // Skip excluded file types
    if (filePath && isExcludedFile(filePath)) {
        return { count: 0, locations: [] };
    }
    const lines = content.split('\n');
    const locations = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;
        // Skip lines with exclusion markers
        if (EXCLUDE_LINE_PATTERNS.some(p => p.test(line))) {
            continue;
        }
        for (const { regex, name } of SECRET_PATTERNS) {
            if (regex.test(line)) {
                locations.push({
                    line: lineNum,
                    text: line.trim(),
                    pattern: name,
                });
                break; // one finding per line
            }
        }
    }
    return {
        count: locations.length,
        locations,
    };
}
//# sourceMappingURL=hardcoded-secrets.js.map