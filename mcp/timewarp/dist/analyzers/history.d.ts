/**
 * timewarp_history — Git history analysis for a file or the whole project.
 *
 * Uses child_process.execFile (promisified) for all git commands.
 * Analyzes commit frequency, authors, classification, most-changed files,
 * and optional size-over-time tracking for a specific file.
 */
interface AuthorInfo {
    name: string;
    commits: number;
}
interface FileChangeInfo {
    file: string;
    changes: number;
}
interface SizeSnapshot {
    date: string;
    lines: number;
}
interface CommitClassification {
    feature: number;
    fix: number;
    refactor: number;
    chore: number;
    docs: number;
    other: number;
}
export interface HistoryResult {
    period: {
        since: string;
        until: string;
    };
    commits: {
        total: number;
        frequency: number;
        unit: string;
    };
    authors: AuthorInfo[];
    classification: CommitClassification;
    mostChanged: FileChangeInfo[];
    sizeOverTime?: SizeSnapshot[];
}
export declare function analyzeHistory(args: {
    file?: string;
    since?: string;
}, cwd: string): Promise<HistoryResult>;
export {};
