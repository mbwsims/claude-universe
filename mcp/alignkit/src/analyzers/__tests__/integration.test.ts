import { describe, it, expect } from 'vitest';
import { lintTool } from '../../mcp/tools/lint.js';
import { checkTool } from '../../mcp/tools/check.js';
import { statusTool } from '../../mcp/tools/status.js';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

// Path to the Phase 0 test fixture project
const FIXTURE_DIR = join(import.meta.dirname, '..', '..', '..', '..', 'test-fixtures');

// Skip integration tests if fixture doesn't exist yet (Phase 0 not complete)
const fixtureExists = existsSync(join(FIXTURE_DIR, 'CLAUDE.md'));

describe.skipIf(!fixtureExists)('Integration: lintTool against test fixture', () => {
  it('discovers the CLAUDE.md file', async () => {
    const result = await lintTool({}, FIXTURE_DIR);
    expect(result.files.length).toBeGreaterThanOrEqual(1);
    const claudeMd = result.files.find(f => f.path === 'CLAUDE.md');
    expect(claudeMd).toBeDefined();
  });

  it('parses rules from CLAUDE.md', async () => {
    const result = await lintTool({}, FIXTURE_DIR);
    expect(result.summary.totalRules).toBeGreaterThanOrEqual(10);
  });

  it('detects VAGUE diagnostics', async () => {
    const result = await lintTool({}, FIXTURE_DIR);
    const vague = result.diagnostics.filter(d => d.code === 'VAGUE');
    expect(vague.length).toBeGreaterThanOrEqual(1);
    // "Try to write clean code when possible" should be flagged
    expect(vague.some(d => d.ruleText.includes('Try to'))).toBe(true);
  });

  it('returns diagnostics array (may include REDUNDANT)', async () => {
    const result = await lintTool({}, FIXTURE_DIR);
    // The fixture has similar but not identical rules; REDUNDANT detection uses 70% overlap
    // threshold so these may or may not trigger depending on tokenization
    expect(Array.isArray(result.diagnostics)).toBe(true);
    expect(result.summary.totalDiagnostics).toBeGreaterThanOrEqual(3);
  });

  it('detects PLACEMENT diagnostics', async () => {
    const result = await lintTool({}, FIXTURE_DIR);
    const placement = result.diagnostics.filter(d => d.code === 'PLACEMENT');
    expect(placement.length).toBeGreaterThanOrEqual(1);
    // "In test files" rule should suggest .claude/rules/
    expect(placement.some(d => d.suggestion?.includes('.claude/rules/'))).toBe(true);
  });

  it('detects WEAK_EMPHASIS diagnostics', async () => {
    const result = await lintTool({}, FIXTURE_DIR);
    const weak = result.diagnostics.filter(d => d.code === 'WEAK_EMPHASIS');
    expect(weak.length).toBeGreaterThanOrEqual(1);
  });

  it('returns proper summary structure', async () => {
    const result = await lintTool({}, FIXTURE_DIR);
    expect(result.summary).toHaveProperty('totalFiles');
    expect(result.summary).toHaveProperty('totalRules');
    expect(result.summary).toHaveProperty('totalDiagnostics');
    expect(result.summary).toHaveProperty('byCode');
    expect(result.summary).toHaveProperty('bySeverity');
    expect(result.summary.totalDiagnostics).toBe(result.diagnostics.length);
  });

  it('accepts a specific file argument', async () => {
    const result = await lintTool({ file: 'CLAUDE.md' }, FIXTURE_DIR);
    expect(result.files).toHaveLength(1);
    expect(result.files[0].path).toBe('CLAUDE.md');
  });
});

describe.skipIf(!fixtureExists)('Integration: checkTool against test fixture', () => {
  it('returns verdicts for each rule', async () => {
    const result = await checkTool({}, FIXTURE_DIR);
    expect(result.rules.length).toBeGreaterThanOrEqual(10);
  });

  it('classifies config rules and checks them', async () => {
    const result = await checkTool({}, FIXTURE_DIR);
    const strictRule = result.rules.find(r => r.text.includes('strict'));
    expect(strictRule).toBeDefined();
    // Fixture has strict: true in tsconfig
    expect(strictRule!.verdict).toBe('conforms');
  });

  it('marks style rules as unverifiable', async () => {
    const result = await checkTool({}, FIXTURE_DIR);
    const styleRule = result.rules.find(r => r.text.includes('Handle errors properly'));
    expect(styleRule).toBeDefined();
    expect(styleRule!.verdict).toBe('unverifiable');
  });

  it('returns proper summary counts', async () => {
    const result = await checkTool({}, FIXTURE_DIR);
    expect(result.summary.totalRules).toBe(result.rules.length);
    expect(result.summary.conforms + result.summary.violates + result.summary.unverifiable)
      .toBe(result.summary.totalRules);
  });
});

describe.skipIf(!fixtureExists)('Integration: statusTool against test fixture', () => {
  it('returns combined lint + check summary', async () => {
    const result = await statusTool(FIXTURE_DIR);
    expect(result.instructionFiles).toBeGreaterThanOrEqual(1);
    expect(result.totalRules).toBeGreaterThanOrEqual(10);
    expect(result.lintIssues).toBeGreaterThanOrEqual(1);
    expect(result.conformance).toHaveProperty('conforms');
    expect(result.conformance).toHaveProperty('violates');
    expect(result.conformance).toHaveProperty('unverifiable');
  });

  it('produces a human-readable quickSummary', async () => {
    const result = await statusTool(FIXTURE_DIR);
    expect(result.quickSummary).toContain('instruction file');
    expect(result.quickSummary).toContain('rule');
    expect(result.quickSummary).toContain('Lint');
    expect(result.quickSummary).toContain('Conformance');
  });
});
