import { describe, it, expect } from 'vitest';

/**
 * Integration test for scan tool.
 * Tests the exported scanTool against real filesystem fixture data.
 * Requires Phase 0 test-fixtures to be present at mcp/test-fixtures/.
 *
 * If test-fixtures are not present, these tests are skipped.
 */

import { scanTool } from '../mcp/tools/scan.js';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const FIXTURES_DIR = resolve(import.meta.dirname, '../../../test-fixtures');
const hasFixtures = existsSync(FIXTURES_DIR);

describe('tools/scan', () => {
  describe('filesWithFindings count includes missing-auth', () => {
    it.skipIf(!hasFixtures)('should count route files with missing auth in filesWithFindings', async () => {
      const result = await scanTool({}, FIXTURES_DIR);
      // Route files with missing auth should be counted
      expect(result.summary.filesWithFindings).toBeGreaterThan(0);
    });
  });

  describe('single-file scan', () => {
    it.skipIf(!hasFixtures)('should scan a single file', async () => {
      const result = await scanTool({ file: 'src/config.ts' }, FIXTURES_DIR);
      expect(result.summary.totalFiles).toBe(1);
      expect(result.files).toHaveLength(1);
      expect(result.files[0].path).toBe('src/config.ts');
    });
  });

  describe('empty project', () => {
    it('should handle empty file list gracefully', async () => {
      const { mkdtemp } = await import('node:fs/promises');
      const { tmpdir } = await import('node:os');
      const { join } = await import('node:path');

      const dir = await mkdtemp(join(tmpdir(), 'shieldkit-empty-'));
      const result = await scanTool({}, dir);
      expect(result.summary.totalFiles).toBe(0);
      expect(result.summary.filesWithFindings).toBe(0);
      expect(result.scoring.riskLevel).toBe('clean');
    });
  });

  describe('FileFindings includes missingAuth', () => {
    it.skipIf(!hasFixtures)('should include missingAuth info in per-file findings for route files', async () => {
      const result = await scanTool({}, FIXTURES_DIR);
      // Route files should have a missingAuth field
      const routeFiles = result.files.filter(f =>
        f.path.includes('route') || f.path.includes('api') || f.path.includes('controller')
      );
      for (const rf of routeFiles) {
        expect(rf).toHaveProperty('missingAuth');
      }
    });
  });
});
