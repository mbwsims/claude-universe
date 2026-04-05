import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const FIXTURES_DIR = resolve(import.meta.dirname, '../../../../test-fixtures');
const hasFixtures = existsSync(FIXTURES_DIR);

describe('tools/status', () => {
  describe('topIssues sorted by severity', () => {
    it.skipIf(!hasFixtures)('should sort topIssues with critical first', async () => {
      const { statusTool } = await import('../mcp/tools/status.js');
      const result = await statusTool(FIXTURES_DIR);

      if (result.topIssues.length >= 2) {
        // Find severity brackets in the topIssues strings
        const severityOrder = ['critical', 'high', 'medium', 'low'];
        const issueSeverities = result.topIssues.map(issue => {
          const match = issue.match(/\[(critical|high|medium|low)\]/);
          return match ? severityOrder.indexOf(match[1]) : 999;
        });

        // Verify sorted (each severity index should be <= the next)
        for (let i = 1; i < issueSeverities.length; i++) {
          if (issueSeverities[i] !== 999 && issueSeverities[i - 1] !== 999) {
            expect(issueSeverities[i - 1]).toBeLessThanOrEqual(issueSeverities[i]);
          }
        }
      }
    });
  });

  describe('empty project', () => {
    it('should handle empty project', async () => {
      const { statusTool } = await import('../mcp/tools/status.js');
      const { mkdtemp } = await import('node:fs/promises');
      const { tmpdir } = await import('node:os');
      const { join } = await import('node:path');

      const dir = await mkdtemp(join(tmpdir(), 'shieldkit-empty-'));
      const result = await statusTool(dir);
      expect(result.riskLevel).toBe('clean');
      expect(result.totalFindings).toBe(0);
      expect(result.topIssues).toHaveLength(0);
    });
  });
});
