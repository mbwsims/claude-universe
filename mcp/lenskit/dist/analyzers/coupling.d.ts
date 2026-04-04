/**
 * coupling.ts -- Measure how connected a file is.
 *
 * Two modes:
 * - analyzeCoupling(file, cwd): scans all files to find importers (for single-file analysis)
 * - buildImportIndex(cwd): reads all files once and builds a lookup table (for batch analysis)
 */
export interface CouplingResult {
    importerCount: number;
    importers: string[];
}
/**
 * Build a shared import index for all files in the project.
 * Returns a map: filePath -> list of raw import path strings.
 * Call this once, then use lookupCoupling() for each file.
 */
export declare function buildImportIndex(cwd: string, files?: string[]): Promise<Map<string, string[]>>;
/**
 * Look up coupling for a file using a pre-built import index.
 * O(N) where N is the number of files (just scanning the index).
 */
export declare function lookupCoupling(filePath: string, importIndex: Map<string, string[]>): CouplingResult;
/**
 * Single-file coupling analysis (discovers + reads all files).
 * Use for single-file analysis only. For batch, use buildImportIndex + lookupCoupling.
 */
export declare function analyzeCoupling(filePath: string, cwd: string): Promise<CouplingResult>;
