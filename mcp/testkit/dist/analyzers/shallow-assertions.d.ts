/**
 * Detects shallow assertions that pass for wrong values.
 */
export interface ShallowAssertionResult {
    count: number;
    total: number;
    locations: Array<{
        line: number;
        text: string;
        kind: string;
    }>;
}
export declare function analyzeShallowAssertions(content: string): ShallowAssertionResult;
