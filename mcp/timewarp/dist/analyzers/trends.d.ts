/**
 * timewarp_trends — Trend computation for growth rates and acceleration.
 *
 * Uses child_process.execFile (promisified) for all git commands.
 * Samples files at multiple time points, computes growth rates,
 * detects acceleration patterns, and projects future size.
 */
interface Sample {
    date: string;
    lines: number;
    functions: number;
}
interface GrowthInfo {
    linesPerMonth: number;
    percentPerMonth: number;
    pattern: 'accelerating' | 'linear' | 'decelerating' | 'flat';
}
interface ChurnInfo {
    firstHalf: number;
    secondHalf: number;
    pattern: 'accelerating' | 'linear' | 'decelerating' | 'flat';
}
interface Projection {
    linesIn3Months: number;
    linesIn6Months: number;
    crossesThreshold: {
        threshold: number;
        inMonths: number;
    } | null;
}
export interface FileTrend {
    file: string;
    samples: Sample[];
    growth: GrowthInfo;
    churn: ChurnInfo;
    projection: Projection;
}
export type TrendsResult = FileTrend[];
export declare function analyzeTrends(args: {
    file?: string;
    months?: number;
}, cwd: string): Promise<TrendsResult>;
export {};
