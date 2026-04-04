/**
 * Analyzes mock usage patterns: boundary vs internal mocking, mock setup percentage.
 */
// Known external/boundary packages
const BOUNDARY_PATTERNS = [
    /^node:/,
    /^fs$/,
    /^path$/,
    /^http$/,
    /^https$/,
    /^crypto$/,
    /^axios/,
    /^node-fetch/,
    /^pg$/,
    /^mysql/,
    /^mongodb/,
    /^mongoose/,
    /^redis/,
    /^ioredis/,
    /^@prisma/,
    /^prisma/,
    /^@aws-sdk/,
    /^@google-cloud/,
    /^@azure/,
    /^stripe/,
    /^twilio/,
    /^nodemailer/,
    /^@sendgrid/,
    /^firebase/,
    /^@supabase/,
];
// Patterns that identify mock setup lines
const MOCK_SETUP_PATTERNS = [
    /jest\.mock\(/,
    /vi\.mock\(/,
    /jest\.fn\(/,
    /vi\.fn\(/,
    /\.mockImplementation\(/,
    /\.mockReturnValue\(/,
    /\.mockResolvedValue\(/,
    /\.mockRejectedValue\(/,
    /\.mockReturnValueOnce\(/,
    /\.mockResolvedValueOnce\(/,
    /\.mockRejectedValueOnce\(/,
    /jest\.spyOn\(/,
    /vi\.spyOn\(/,
];
// Extract module path from jest.mock('path') or vi.mock('path')
const MOCK_CALL_REGEX = /(?:jest|vi)\.mock\(\s*['"`]([^'"`]+)['"`]/;
function isBoundaryModule(modulePath) {
    return BOUNDARY_PATTERNS.some(pattern => pattern.test(modulePath));
}
function isRelativeImport(modulePath) {
    return modulePath.startsWith('.') || modulePath.startsWith('/');
}
export function analyzeMockHealth(content) {
    const lines = content.split('\n');
    const mocks = [];
    let mockSetupLines = 0;
    let nonEmptyLines = 0;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (trimmed.length > 0)
            nonEmptyLines++;
        // Count mock setup lines
        for (const pattern of MOCK_SETUP_PATTERNS) {
            if (pattern.test(line)) {
                mockSetupLines++;
                break;
            }
        }
        // Extract mock module paths
        const match = MOCK_CALL_REGEX.exec(line);
        if (match) {
            const modulePath = match[1];
            const type = isRelativeImport(modulePath) && !isBoundaryModule(modulePath)
                ? 'internal'
                : 'boundary';
            mocks.push({ line: i + 1, path: modulePath, type });
        }
    }
    const boundary = mocks.filter(m => m.type === 'boundary').length;
    const internal = mocks.filter(m => m.type === 'internal').length;
    return {
        total: mocks.length,
        boundary,
        internal,
        setupPercent: nonEmptyLines === 0 ? 0 : Math.round((mockSetupLines / nonEmptyLines) * 100),
        mocks,
    };
}
//# sourceMappingURL=mock-health.js.map