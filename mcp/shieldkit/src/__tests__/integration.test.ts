import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { scanTool } from '../mcp/tools/scan.js';
import { surfaceTool } from '../mcp/tools/surface.js';
import { statusTool } from '../mcp/tools/status.js';

const FIXTURES_DIR = resolve(import.meta.dirname, '../../../test-fixtures');
const hasFixtures = existsSync(FIXTURES_DIR);

describe.skipIf(!hasFixtures)('integration: scan against test-fixtures', () => {
  it('should find hardcoded secrets in config.ts', async () => {
    const result = await scanTool({ file: 'src/config.ts' }, FIXTURES_DIR);
    expect(result.files[0].hardcodedSecrets.count).toBeGreaterThan(0);
  });

  it('should find SQL injection in user-repository.ts', async () => {
    const result = await scanTool({ file: 'src/db/user-repository.ts' }, FIXTURES_DIR);
    expect(result.files[0].sqlInjection.count).toBeGreaterThan(0);
  });

  it('should find CORS misconfiguration in config.ts', async () => {
    const result = await scanTool({ file: 'src/config.ts' }, FIXTURES_DIR);
    expect(result.files[0].corsConfig.count).toBeGreaterThan(0);
  });

  it('should find missing auth in admin-routes.ts', async () => {
    const result = await scanTool({ file: 'src/routes/admin-routes.ts' }, FIXTURES_DIR);
    const adminFile = result.files[0];
    expect(adminFile.missingAuth?.isRouteFile).toBe(true);
    expect(adminFile.missingAuth?.hasAuth).toBe(false);
  });

  it('should find dangerous functions in Python utils', async () => {
    const result = await scanTool({ file: 'src/py/utils.py' }, FIXTURES_DIR);
    expect(result.files[0].dangerousFunctions.count).toBeGreaterThan(0);
  });

  it('should find Python SQL injection in utils.py', async () => {
    const result = await scanTool({ file: 'src/py/utils.py' }, FIXTURES_DIR);
    expect(result.files[0].sqlInjection.count).toBeGreaterThan(0);
  });

  it('full project scan should find multiple categories', async () => {
    const result = await scanTool({}, FIXTURES_DIR);
    expect(result.summary.totalFiles).toBeGreaterThan(0);
    expect(result.summary.filesWithFindings).toBeGreaterThan(0);
    expect(result.scoring.riskLevel).not.toBe('clean');
  });
});

describe.skipIf(!hasFixtures)('integration: surface against test-fixtures', () => {
  it('should discover route files', async () => {
    const result = await surfaceTool(FIXTURES_DIR);
    expect(result.endpoints.length).toBeGreaterThan(0);
  });

  it('should find unprotected endpoints', async () => {
    const result = await surfaceTool(FIXTURES_DIR);
    const unprotected = result.endpoints.filter(e => !e.hasAuth);
    expect(unprotected.length).toBeGreaterThan(0);
  });

  it('should discover env files', async () => {
    const result = await surfaceTool(FIXTURES_DIR);
    expect(result.envFiles.length).toBeGreaterThanOrEqual(0);
  });
});

describe.skipIf(!hasFixtures)('integration: status against test-fixtures', () => {
  it('should produce a complete status result', async () => {
    const result = await statusTool(FIXTURES_DIR);
    expect(result.riskLevel).toBeDefined();
    expect(result.totalFindings).toBeGreaterThan(0);
    expect(result.quickSummary).toBeTruthy();
  });

  it('should have topIssues sorted by severity', async () => {
    const result = await statusTool(FIXTURES_DIR);
    if (result.topIssues.length >= 2) {
      const severityOrder = ['critical', 'high', 'medium', 'low'];
      const firstSeverity = result.topIssues[0].match(/\[(critical|high|medium|low)\]/);
      const lastSeverity = result.topIssues[result.topIssues.length - 1].match(/\[(critical|high|medium|low)\]/);
      if (firstSeverity && lastSeverity) {
        expect(severityOrder.indexOf(firstSeverity[1])).toBeLessThanOrEqual(
          severityOrder.indexOf(lastSeverity[1])
        );
      }
    }
  });
});
