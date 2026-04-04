/**
 * Analyzes test name quality -- whether names read as specifications or are vague.
 */
export interface NameQualityResult {
    total: number;
    vague: number;
    vagueNames: Array<{
        line: number;
        name: string;
        reason: string;
    }>;
}
export declare function analyzeNameQuality(content: string): NameQualityResult;
