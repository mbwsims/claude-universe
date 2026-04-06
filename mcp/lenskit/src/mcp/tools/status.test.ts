import { describe, it, expect } from 'vitest';
import { statusTool } from './status.js';
import type { DetailedStatusResult } from './status.js';

// Use the plugin's own mcp/lenskit directory as a known codebase
const TEST_CWD = process.cwd();

describe('statusTool', () => {
  describe('default (lightweight) mode', () => {
    it('returns base fields only', async () => {
      const result = await statusTool(TEST_CWD);
      expect(result).toHaveProperty('fileCount');
      expect(result).toHaveProperty('testFileCount');
      expect(result).toHaveProperty('testCoverageRatio');
      expect(result).toHaveProperty('testCoverageDisclaimer');
      expect(result).toHaveProperty('quickSummary');
      expect(typeof result.fileCount).toBe('number');
      expect(typeof result.testFileCount).toBe('number');
      expect(typeof result.testCoverageRatio).toBe('number');
    });

    it('does NOT return detailed fields', async () => {
      const result = await statusTool(TEST_CWD);
      expect(result).not.toHaveProperty('avgRiskScore');
      expect(result).not.toHaveProperty('topRiskFiles');
      expect(result).not.toHaveProperty('circularDepCount');
      expect(result).not.toHaveProperty('hubCount');
    });

    it('returns same as detailed=false', async () => {
      const defaultResult = await statusTool(TEST_CWD);
      const falseResult = await statusTool(TEST_CWD, false);
      expect(defaultResult.fileCount).toBe(falseResult.fileCount);
      expect(defaultResult.testFileCount).toBe(falseResult.testFileCount);
      expect(falseResult).not.toHaveProperty('avgRiskScore');
    });
  });

  describe('detailed mode', () => {
    it('returns all base fields plus detailed fields', async () => {
      const result = await statusTool(TEST_CWD, true) as DetailedStatusResult;
      // Base fields
      expect(typeof result.fileCount).toBe('number');
      expect(typeof result.testFileCount).toBe('number');
      expect(typeof result.testCoverageRatio).toBe('number');
      expect(typeof result.testCoverageDisclaimer).toBe('string');
      expect(typeof result.quickSummary).toBe('string');
      // Detailed fields
      expect(typeof result.avgRiskScore).toBe('number');
      expect(Array.isArray(result.topRiskFiles)).toBe(true);
      expect(typeof result.circularDepCount).toBe('number');
      expect(typeof result.hubCount).toBe('number');
    });

    it('topRiskFiles entries have path, score, and risk', async () => {
      const result = await statusTool(TEST_CWD, true) as DetailedStatusResult;
      if (result.topRiskFiles.length > 0) {
        const first = result.topRiskFiles[0];
        expect(typeof first.path).toBe('string');
        expect(typeof first.score).toBe('number');
        expect(typeof first.risk).toBe('string');
      }
    });

    it('quickSummary includes risk and dep info', async () => {
      const result = await statusTool(TEST_CWD, true) as DetailedStatusResult;
      expect(result.quickSummary).toContain('Avg risk');
      expect(result.quickSummary).toContain('circular deps');
      expect(result.quickSummary).toContain('hubs');
    });
  });
});
