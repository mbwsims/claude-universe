/**
 * Dangerous functions analyzer.
 *
 * Detects risky API usage patterns in scanned source files.
 * This analyzer reads file content and flags unsafe patterns;
 * it does NOT execute any of the detected patterns.
 */
export interface DangerousFunctionLocation {
    line: number;
    text: string;
    pattern: string;
}
export interface DangerousFunctionsResult {
    count: number;
    locations: DangerousFunctionLocation[];
}
export declare function analyzeDangerousFunctions(content: string): DangerousFunctionsResult;
