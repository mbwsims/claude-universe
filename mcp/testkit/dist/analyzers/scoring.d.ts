/**
 * Computes letter grades from analyzer metrics, calibrated to the testkit scoring rubric.
 */
import type { ShallowAssertionResult } from './shallow-assertions.js';
import type { ErrorCoverageResult } from './error-coverage.js';
import type { MockHealthResult } from './mock-health.js';
import type { NameQualityResult } from './name-quality.js';
export type Grade = 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F';
export interface DimensionScores {
    assertionDepth: Grade | null;
    inputCoverage: null;
    errorTesting: Grade | null;
    mockHealth: Grade | null;
    specClarity: Grade | null;
    independence: null;
}
export declare function scoreAssertionDepth(result: ShallowAssertionResult): Grade | null;
export declare function scoreErrorTesting(result: ErrorCoverageResult): Grade | null;
export declare function scoreMockHealth(result: MockHealthResult): Grade | null;
export declare function scoreSpecClarity(result: NameQualityResult): Grade | null;
export declare const GRADE_VALUES: Record<Grade, number>;
export declare function valueToGrade(value: number): Grade;
export declare function computeOverallGrade(dimensions: DimensionScores): Grade;
