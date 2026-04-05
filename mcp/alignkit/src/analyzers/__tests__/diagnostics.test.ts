import { describe, it, expect } from 'vitest';
import { runDiagnostics, type Diagnostic } from '../diagnostics.js';
import type { ParsedRule } from '../discovery.js';

function makeRule(text: string, overrides: Partial<ParsedRule> = {}): ParsedRule {
  return {
    text,
    section: null,
    line: 1,
    sourceFile: 'CLAUDE.md',
    ...overrides,
  };
}

describe('VAGUE diagnostic', () => {
  it('flags rules with "try to"', () => {
    const rules = [makeRule('Try to write tests when possible')];
    const diags = runDiagnostics(rules, []);
    const vague = diags.filter(d => d.code === 'VAGUE');
    expect(vague).toHaveLength(1);
    expect(vague[0].ruleText).toBe('Try to write tests when possible');
  });

  it('flags rules with "when possible"', () => {
    const rules = [makeRule('Use named exports when possible')];
    const diags = runDiagnostics(rules, []);
    const vague = diags.filter(d => d.code === 'VAGUE');
    expect(vague).toHaveLength(1);
  });

  it('flags rules with "generally"', () => {
    const rules = [makeRule('Generally prefer functional components')];
    const diags = runDiagnostics(rules, []);
    const vague = diags.filter(d => d.code === 'VAGUE');
    expect(vague).toHaveLength(1);
  });

  it('flags rules with "consider"', () => {
    const rules = [makeRule('Consider adding error handling')];
    const diags = runDiagnostics(rules, []);
    const vague = diags.filter(d => d.code === 'VAGUE');
    expect(vague).toHaveLength(1);
  });

  it('flags rules with "as needed"', () => {
    const rules = [makeRule('Add documentation as needed')];
    const diags = runDiagnostics(rules, []);
    const vague = diags.filter(d => d.code === 'VAGUE');
    expect(vague).toHaveLength(1);
  });

  it('flags rules with "should probably"', () => {
    const rules = [makeRule('You should probably run tests first')];
    const diags = runDiagnostics(rules, []);
    const vague = diags.filter(d => d.code === 'VAGUE');
    expect(vague).toHaveLength(1);
  });

  it('does not flag concrete rules', () => {
    const rules = [makeRule('Run `vitest run` before every commit')];
    const diags = runDiagnostics(rules, []);
    const vague = diags.filter(d => d.code === 'VAGUE');
    expect(vague).toHaveLength(0);
  });
});

describe('CONFLICT diagnostic', () => {
  it('detects "always X" vs "never X" conflicts', () => {
    const rules = [
      makeRule('Always use default exports', { line: 1 }),
      makeRule('Never use default exports', { line: 5 }),
    ];
    const diags = runDiagnostics(rules, []);
    const conflicts = diags.filter(d => d.code === 'CONFLICT');
    expect(conflicts.length).toBeGreaterThanOrEqual(1);
  });

  it('does not flag unrelated always/never rules', () => {
    const rules = [
      makeRule('Always run tests before committing', { line: 1 }),
      makeRule('Never use var declarations', { line: 5 }),
    ];
    const diags = runDiagnostics(rules, []);
    const conflicts = diags.filter(d => d.code === 'CONFLICT');
    expect(conflicts).toHaveLength(0);
  });
});

describe('REDUNDANT diagnostic', () => {
  it('detects highly similar rules', () => {
    const rules = [
      makeRule('Use absolute imports for all source files', { line: 1 }),
      makeRule('Always use absolute imports in source files', { line: 5 }),
    ];
    const diags = runDiagnostics(rules, []);
    const redundant = diags.filter(d => d.code === 'REDUNDANT');
    expect(redundant.length).toBeGreaterThanOrEqual(1);
  });

  it('does not flag different rules', () => {
    const rules = [
      makeRule('Use absolute imports', { line: 1 }),
      makeRule('Run tests before committing', { line: 5 }),
    ];
    const diags = runDiagnostics(rules, []);
    const redundant = diags.filter(d => d.code === 'REDUNDANT');
    expect(redundant).toHaveLength(0);
  });
});

describe('ORDERING diagnostic', () => {
  it('flags tool constraints appearing after style rules', () => {
    const rules = [
      makeRule('Use camelCase for variables', { line: 1, section: 'Style' }),
      makeRule('ALWAYS run vitest run before committing', { line: 20, section: 'Process' }),
    ];
    const diags = runDiagnostics(rules, []);
    const ordering = diags.filter(d => d.code === 'ORDERING');
    expect(ordering.length).toBeGreaterThanOrEqual(1);
  });
});

describe('PLACEMENT diagnostic', () => {
  it('flags file-pattern rules that belong in .claude/rules/', () => {
    const rules = [
      makeRule('In test files, always use describe/it blocks', {
        sourceFile: 'CLAUDE.md',
      }),
    ];
    const diags = runDiagnostics(rules, []);
    const placement = diags.filter(d => d.code === 'PLACEMENT');
    expect(placement.length).toBeGreaterThanOrEqual(1);
    expect(placement[0].suggestion).toContain('.claude/rules/');
  });

  it('flags automation rules that should be hooks', () => {
    const rules = [
      makeRule('Always run eslint --fix after editing TypeScript files', {
        sourceFile: 'CLAUDE.md',
      }),
    ];
    const diags = runDiagnostics(rules, []);
    const placement = diags.filter(d => d.code === 'PLACEMENT');
    expect(placement.length).toBeGreaterThanOrEqual(1);
    expect(placement[0].suggestion).toContain('hook');
  });
});

describe('WEAK_EMPHASIS diagnostic', () => {
  it('flags tool constraints without emphasis', () => {
    const rules = [
      makeRule('Run tests before committing'),
    ];
    const diags = runDiagnostics(rules, []);
    const weak = diags.filter(d => d.code === 'WEAK_EMPHASIS');
    expect(weak.length).toBeGreaterThanOrEqual(1);
  });

  it('does not flag rules with ALWAYS/NEVER/MUST', () => {
    const rules = [
      makeRule('ALWAYS run tests before committing'),
    ];
    const diags = runDiagnostics(rules, []);
    const weak = diags.filter(d => d.code === 'WEAK_EMPHASIS');
    expect(weak).toHaveLength(0);
  });
});

describe('METADATA diagnostic', () => {
  it('flags agent files missing required frontmatter fields', () => {
    const rules: ParsedRule[] = [];
    const files = [{
      relativePath: '.claude/agents/broken.md',
      absolutePath: '/fake/.claude/agents/broken.md',
      content: '# No frontmatter agent\n\n- Do stuff',
      type: 'agent' as const,
    }];
    const diags = runDiagnostics(rules, files);
    const meta = diags.filter(d => d.code === 'METADATA');
    expect(meta.length).toBeGreaterThanOrEqual(1);
  });

  it('does not flag agent files with valid frontmatter', () => {
    const rules: ParsedRule[] = [];
    const files = [{
      relativePath: '.claude/agents/valid.md',
      absolutePath: '/fake/.claude/agents/valid.md',
      content: '---\nname: valid\ndescription: A valid agent\nmodel: sonnet\n---\n\n# Valid Agent\n\n- Do stuff',
      type: 'agent' as const,
    }];
    const diags = runDiagnostics(rules, files);
    const meta = diags.filter(d => d.code === 'METADATA');
    expect(meta).toHaveLength(0);
  });

  it('flags skill files missing required frontmatter fields', () => {
    const rules: ParsedRule[] = [];
    const files = [{
      relativePath: '.claude/skills/broken/SKILL.md',
      absolutePath: '/fake/.claude/skills/broken/SKILL.md',
      content: '# No frontmatter skill\n\n- Step one',
      type: 'skill' as const,
    }];
    const diags = runDiagnostics(rules, files);
    const meta = diags.filter(d => d.code === 'METADATA');
    expect(meta.length).toBeGreaterThanOrEqual(1);
  });
});

describe('ORDERING diagnostic — cross-file scoping', () => {
  it('does not flag tool constraint in file B when style rule is in file A', () => {
    const rules = [
      makeRule('Use camelCase for variables', { line: 5, sourceFile: 'CLAUDE.md' }),
      makeRule('Run vitest before committing', { line: 10, sourceFile: '.claude/rules/testing.md' }),
    ];
    const diags = runDiagnostics(rules, []);
    const ordering = diags.filter(d => d.code === 'ORDERING');
    expect(ordering).toHaveLength(0);
  });

  it('still flags tool constraint after style rule within same file', () => {
    const rules = [
      makeRule('Use camelCase for variables', { line: 5, sourceFile: 'CLAUDE.md' }),
      makeRule('Run vitest before committing', { line: 10, sourceFile: 'CLAUDE.md' }),
    ];
    const diags = runDiagnostics(rules, []);
    const ordering = diags.filter(d => d.code === 'ORDERING');
    expect(ordering).toHaveLength(1);
  });
});

describe('runDiagnostics summary', () => {
  it('returns structured summary with totals by code and severity', () => {
    const rules = [
      makeRule('Try to write tests when possible', { line: 1 }),
      makeRule('Always use default exports', { line: 3 }),
      makeRule('Never use default exports', { line: 5 }),
    ];
    const result = runDiagnostics(rules, []);
    // Should have at least VAGUE (1) and CONFLICT (1)
    expect(result.length).toBeGreaterThanOrEqual(2);
    // Each diagnostic has the required shape
    for (const d of result) {
      expect(d).toHaveProperty('code');
      expect(d).toHaveProperty('severity');
      expect(d).toHaveProperty('message');
      expect(d).toHaveProperty('ruleText');
      expect(['warning', 'error']).toContain(d.severity);
    }
  });
});
