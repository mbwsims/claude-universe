/**
 * testkit_analyze — Deterministic test quality analysis.
 *
 * Analyzes test files for shallow assertions, error coverage, mock health,
 * and name quality. Returns structured metrics and dimension scores.
 */
import { analyzeShallowAssertions } from '../../analyzers/shallow-assertions.js';
import { analyzeErrorCoverage } from '../../analyzers/error-coverage.js';
import { analyzeMockHealth } from '../../analyzers/mock-health.js';
import { analyzeNameQuality } from '../../analyzers/name-quality.js';
import { type DimensionScores, type Grade } from '../../analyzers/scoring.js';
interface FileAnalysis {
    path: string;
    sourcePath: string | null;
    framework: string | null;
    metrics: {
        shallowAssertions: ReturnType<typeof analyzeShallowAssertions>;
        errorCoverage: ReturnType<typeof analyzeErrorCoverage> | null;
        mockHealth: ReturnType<typeof analyzeMockHealth>;
        nameQuality: ReturnType<typeof analyzeNameQuality>;
    };
    dimensions: DimensionScores;
    grade: Grade;
    diagnostics: string[];
}
interface AnalyzeResult {
    files: FileAnalysis[];
    summary: {
        totalFiles: number;
        avgGrade: Grade;
        topIssues: string[];
    };
}
export declare function analyzeTool(args: {
    file?: string;
}, cwd: string): Promise<AnalyzeResult>;
export {};
