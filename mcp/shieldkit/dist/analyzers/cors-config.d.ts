/**
 * CORS misconfiguration analyzer.
 *
 * Detects overly permissive CORS configurations such as wildcard origins
 * and cors({ origin: '*' }) or cors({ origin: true }).
 */
export interface CorsConfigLocation {
    line: number;
    text: string;
}
export interface CorsConfigResult {
    count: number;
    locations: CorsConfigLocation[];
}
export declare function analyzeCorsConfig(content: string): CorsConfigResult;
