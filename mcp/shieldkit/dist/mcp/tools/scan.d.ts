/**
 * shieldkit_scan -- Deterministic pattern detection across source files.
 *
 * Runs all security analyzers against source files and returns
 * structured findings with severity classifications.
 */
import { type SqlInjectionResult } from '../../analyzers/sql-injection.js';
import { type MissingAuthResult } from '../../analyzers/missing-auth.js';
import { type HardcodedSecretsResult } from '../../analyzers/hardcoded-secrets.js';
import { type DangerousFunctionsResult } from '../../analyzers/dangerous-functions.js';
import { type CorsConfigResult } from '../../analyzers/cors-config.js';
import { type ScoringResult } from '../../analyzers/scoring.js';
interface FileFindings {
    path: string;
    sqlInjection: SqlInjectionResult;
    hardcodedSecrets: HardcodedSecretsResult;
    dangerousFunctions: DangerousFunctionsResult;
    corsConfig: CorsConfigResult;
}
interface ScanResult {
    files: FileFindings[];
    missingAuth: MissingAuthResult;
    scoring: ScoringResult;
    summary: {
        totalFiles: number;
        filesWithFindings: number;
        riskLevel: string;
    };
}
export declare function scanTool(args: {
    file?: string;
}, cwd: string): Promise<ScanResult>;
export {};
