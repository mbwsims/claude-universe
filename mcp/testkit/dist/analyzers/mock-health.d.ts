/**
 * Analyzes mock usage patterns: boundary vs internal mocking, mock setup percentage.
 */
export interface MockHealthResult {
    total: number;
    boundary: number;
    internal: number;
    setupPercent: number;
    mocks: Array<{
        line: number;
        path: string;
        type: 'boundary' | 'internal';
    }>;
}
export declare function analyzeMockHealth(content: string): MockHealthResult;
