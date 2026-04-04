/**
 * SQL injection analyzer.
 *
 * Detects string interpolation in SQL contexts: template literals with
 * SQL keywords and ${} interpolation, and string concatenation with
 * SQL keywords and variables.
 */
export interface SqlInjectionLocation {
    line: number;
    text: string;
    pattern: string;
}
export interface SqlInjectionResult {
    count: number;
    locations: SqlInjectionLocation[];
}
export declare function analyzeSqlInjection(content: string): SqlInjectionResult;
