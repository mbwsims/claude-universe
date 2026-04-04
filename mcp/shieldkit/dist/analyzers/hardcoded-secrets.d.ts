/**
 * Hardcoded secrets analyzer.
 *
 * Detects secret values committed in source code such as passwords,
 * API keys, tokens, and known key prefixes.
 */
export interface HardcodedSecretLocation {
    line: number;
    text: string;
    pattern: string;
}
export interface HardcodedSecretsResult {
    count: number;
    locations: HardcodedSecretLocation[];
}
export declare function isExcludedFile(filePath: string): boolean;
export declare function analyzeHardcodedSecrets(content: string, filePath?: string): HardcodedSecretsResult;
