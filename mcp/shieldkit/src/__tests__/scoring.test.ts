import { describe, it, expect } from 'vitest';
import {
  classifySeverity,
  computeRiskLevel,
  buildScoringResult,
  buildScoringResultFromFindings,
  type FindingSeverity,
} from '../analyzers/scoring.js';

describe('scoring', () => {
  describe('classifySeverity (backward compat)', () => {
    it('should classify hardcoded-secrets as critical', () => {
      expect(classifySeverity('hardcoded-secrets')).toBe('critical');
    });

    it('should classify unknown analyzers as low', () => {
      expect(classifySeverity('unknown-thing')).toBe('low');
    });
  });

  describe('computeRiskLevel', () => {
    it('should return clean when no findings have counts', () => {
      const findings: FindingSeverity[] = [
        { analyzer: 'sql-injection', severity: 'critical', count: 0 },
      ];
      expect(computeRiskLevel(findings)).toBe('clean');
    });

    it('should return critical when any critical findings exist', () => {
      const findings: FindingSeverity[] = [
        { analyzer: 'sql-injection', severity: 'critical', count: 1 },
        { analyzer: 'cors-config', severity: 'medium', count: 3 },
      ];
      expect(computeRiskLevel(findings)).toBe('critical');
    });

    it('should return high when high but no critical', () => {
      const findings: FindingSeverity[] = [
        { analyzer: 'dangerous-functions', severity: 'high', count: 2 },
        { analyzer: 'cors-config', severity: 'medium', count: 1 },
      ];
      expect(computeRiskLevel(findings)).toBe('high');
    });
  });

  describe('buildScoringResult (flat per-analyzer)', () => {
    it('should build scoring from analyzer counts', () => {
      const result = buildScoringResult({
        'sql-injection': 2,
        'cors-config': 1,
      });
      expect(result.riskLevel).toBe('critical');
      expect(result.findings).toHaveLength(2);
    });

    it('escalates to critical when high-severity finding count exceeds 10', () => {
      const result = buildScoringResult({
        'missing-auth': 12,
        'dangerous-functions': 5,
      });
      expect(result.riskLevel).toBe('critical');
    });

    it('does not escalate when high-severity count is under threshold', () => {
      const result = buildScoringResult({
        'missing-auth': 3,
      });
      expect(result.riskLevel).toBe('high');
    });

    it('escalates to high when medium-severity count exceeds 15', () => {
      const result = buildScoringResult({
        'cors-config': 16,
      });
      expect(result.riskLevel).toBe('high');
    });
  });

  describe('buildScoringResultFromFindings (per-finding severity)', () => {
    it('should aggregate per-finding severities', () => {
      const result = buildScoringResultFromFindings([
        { analyzer: 'dangerous-functions', severity: 'critical', count: 1 },
        { analyzer: 'dangerous-functions', severity: 'high', count: 2 },
        { analyzer: 'dangerous-functions', severity: 'medium', count: 3 },
        { analyzer: 'sql-injection', severity: 'critical', count: 1 },
      ]);
      expect(result.riskLevel).toBe('critical');
      expect(result.findings).toHaveLength(4);
    });

    it('should sort findings by severity in summary', () => {
      const result = buildScoringResultFromFindings([
        { analyzer: 'cors-config', severity: 'medium', count: 5 },
        { analyzer: 'eval', severity: 'critical', count: 1 },
      ]);
      expect(result.summary).toContain('critical');
    });
  });
});
