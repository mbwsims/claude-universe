import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { classifyRule, checkConformance, checkToolDeclarations, type RuleVerdict } from '../conformance.js';
import type { ParsedRule, InstructionFile } from '../discovery.js';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';

const TMP_DIR = join(import.meta.dirname, '..', '..', '..', '__test-tmp-conformance');

function makeRule(text: string, overrides: Partial<ParsedRule> = {}): ParsedRule {
  return {
    text,
    section: null,
    line: 1,
    sourceFile: 'CLAUDE.md',
    ...overrides,
  };
}

function setupFixture() {
  rmSync(TMP_DIR, { recursive: true, force: true });
  mkdirSync(join(TMP_DIR, 'src', 'utils'), { recursive: true });
  mkdirSync(join(TMP_DIR, 'src', 'services'), { recursive: true });
  mkdirSync(join(TMP_DIR, 'src', 'components'), { recursive: true });
  mkdirSync(join(TMP_DIR, 'tests'), { recursive: true });

  // Source files with named exports (no default exports)
  writeFileSync(join(TMP_DIR, 'src', 'utils', 'helpers.ts'), [
    'export function slugify(text: string): string {',
    '  return text.toLowerCase().replace(/\\s+/g, "-");',
    '}',
    '',
    'export function truncate(text: string, max: number): string {',
    '  return text.length > max ? text.slice(0, max) + "..." : text;',
    '}',
  ].join('\n'));

  writeFileSync(join(TMP_DIR, 'src', 'services', 'user-service.ts'), [
    'export class UserService {',
    '  async getUser(id: string) {',
    '    return { id, name: "Alice" };',
    '  }',
    '}',
  ].join('\n'));

  // A component WITH a default export (violation for "no default exports")
  writeFileSync(join(TMP_DIR, 'src', 'components', 'Button.tsx'), [
    'const Button = () => <button>Click</button>;',
    'export default Button;',
  ].join('\n'));

  // Test file in correct location (co-located)
  writeFileSync(join(TMP_DIR, 'src', 'utils', 'helpers.test.ts'), [
    'import { describe, it, expect } from "vitest";',
    'import { slugify } from "./helpers";',
    '',
    'describe("slugify", () => {',
    '  it("converts spaces to hyphens", () => {',
    '    expect(slugify("hello world")).toBe("hello-world");',
    '  });',
    '});',
  ].join('\n'));

  // Test file in wrong location (NOT co-located)
  writeFileSync(join(TMP_DIR, 'tests', 'user-service.test.ts'), [
    'import { describe, it, expect } from "vitest";',
    '',
    'describe("UserService", () => {',
    '  it("exists", () => {',
    '    expect(true).toBe(true);',
    '  });',
    '});',
  ].join('\n'));

  // tsconfig with strict mode
  writeFileSync(join(TMP_DIR, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      strict: true,
      target: 'ES2022',
      module: 'NodeNext',
    },
  }, null, 2));

  // package.json
  writeFileSync(join(TMP_DIR, 'package.json'), JSON.stringify({
    name: 'test-project',
    devDependencies: { vitest: '^3.0.0' },
  }, null, 2));
}

function cleanupFixture() {
  rmSync(TMP_DIR, { recursive: true, force: true });
}

describe('classifyRule', () => {
  it('classifies file structure rules', () => {
    expect(classifyRule('Place test files next to source files')).toBe('file-structure');
  });

  it('classifies import/dependency rules', () => {
    expect(classifyRule('Use absolute imports for all source files')).toBe('import-dependency');
  });

  it('classifies tool constraint rules', () => {
    expect(classifyRule('Run vitest run before committing')).toBe('tool-constraint');
  });

  it('classifies naming convention rules', () => {
    expect(classifyRule('Use PascalCase for React components')).toBe('naming');
  });

  it('classifies architecture boundary rules', () => {
    expect(classifyRule('Components must not import from db/ directly')).toBe('architecture');
  });

  it('classifies config requirement rules', () => {
    expect(classifyRule('Use strict TypeScript mode')).toBe('config');
  });

  it('classifies style/behavioral rules as unverifiable', () => {
    expect(classifyRule('Write clean, readable code')).toBe('style');
  });
});

describe('checkConformance', () => {
  beforeAll(() => setupFixture());
  afterAll(() => cleanupFixture());

  it('checks config rules against real config files', async () => {
    const rules = [makeRule('Use strict TypeScript mode')];
    const results = await checkConformance(rules, TMP_DIR);
    expect(results).toHaveLength(1);
    expect(results[0].verdict).toBe('conforms');
    expect(results[0].evidence).toContain('strict');
  });

  it('marks style rules as unverifiable', async () => {
    const rules = [makeRule('Write clean, readable code')];
    const results = await checkConformance(rules, TMP_DIR);
    expect(results).toHaveLength(1);
    expect(results[0].verdict).toBe('unverifiable');
  });

  it('detects import pattern violations via grep', async () => {
    const rules = [makeRule('Never use default exports')];
    const results = await checkConformance(rules, TMP_DIR);
    expect(results).toHaveLength(1);
    expect(results[0].verdict).toBe('violates');
    expect(results[0].evidence).toContain('Button.tsx');
  });

  it('returns evidence for each checked rule', async () => {
    const rules = [makeRule('Use strict TypeScript mode')];
    const results = await checkConformance(rules, TMP_DIR);
    expect(results[0]).toHaveProperty('text');
    expect(results[0]).toHaveProperty('verdict');
    expect(results[0]).toHaveProperty('evidence');
  });
});

function makeSkill(content: string, relativePath = '.claude/skills/test/SKILL.md'): InstructionFile {
  return {
    relativePath,
    absolutePath: `/fake/${relativePath}`,
    content,
    type: 'skill',
  };
}

describe('checkToolDeclarations', () => {
  it('passes when declared MCP tools are referenced in body', () => {
    const skill = makeSkill([
      '---',
      'name: test',
      'description: test skill',
      'allowed-tools:',
      '  - Read',
      '  - mcp__lenskit__lenskit_graph',
      '---',
      '',
      'Call `lenskit_graph` to get the dependency graph.',
    ].join('\n'));
    const verdicts = checkToolDeclarations([skill]);
    expect(verdicts.filter(v => v.verdict === 'violates')).toHaveLength(0);
  });

  it('flags declared MCP tool not referenced in body', () => {
    const skill = makeSkill([
      '---',
      'name: test',
      'description: test skill',
      'allowed-tools:',
      '  - Read',
      '  - mcp__lenskit__lenskit_graph',
      '  - mcp__lenskit__lenskit_analyze',
      '---',
      '',
      'Call `lenskit_graph` to get the dependency graph.',
    ].join('\n'));
    const verdicts = checkToolDeclarations([skill]);
    const violations = verdicts.filter(v => v.verdict === 'violates');
    expect(violations).toHaveLength(1);
    expect(violations[0].evidence).toContain('lenskit_analyze');
  });

  it('flags MCP tool used in body but not declared', () => {
    const skill = makeSkill([
      '---',
      'name: test',
      'description: test skill',
      'allowed-tools:',
      '  - Read',
      '---',
      '',
      'Use mcp__shieldkit__shieldkit_scan to find vulnerabilities.',
    ].join('\n'));
    const verdicts = checkToolDeclarations([skill]);
    const violations = verdicts.filter(v => v.verdict === 'violates');
    expect(violations).toHaveLength(1);
    expect(violations[0].evidence).toContain('shieldkit_scan');
  });

  it('flags built-in tool referenced in body but not declared', () => {
    const skill = makeSkill([
      '---',
      'name: test',
      'description: test skill',
      'allowed-tools:',
      '  - Read',
      '---',
      '',
      'Use Grep to search for patterns, then use WebSearch for docs.',
    ].join('\n'));
    const verdicts = checkToolDeclarations([skill]);
    const violations = verdicts.filter(v => v.verdict === 'violates');
    expect(violations.some(v => v.evidence.includes('Grep'))).toBe(true);
    expect(violations.some(v => v.evidence.includes('WebSearch'))).toBe(true);
  });

  it('does NOT flag built-in tools for direction (a) — implicit usage is expected', () => {
    const skill = makeSkill([
      '---',
      'name: test',
      'description: test skill',
      'allowed-tools:',
      '  - Read',
      '  - Glob',
      '  - Grep',
      '  - Bash',
      '---',
      '',
      'Analyze the project files.',
    ].join('\n'));
    const verdicts = checkToolDeclarations([skill]);
    expect(verdicts.filter(v => v.verdict === 'violates')).toHaveLength(0);
  });

  it('skips non-skill files', () => {
    const ruleFile: InstructionFile = {
      relativePath: '.claude/rules/test.md',
      absolutePath: '/fake/.claude/rules/test.md',
      content: '---\nname: test\n---\n\nSome rule content.',
      type: 'rule',
    };
    const verdicts = checkToolDeclarations([ruleFile]);
    expect(verdicts).toHaveLength(0);
  });

  it('skips skills without allowed-tools', () => {
    const skill = makeSkill([
      '---',
      'name: test',
      'description: test skill',
      '---',
      '',
      'Use mcp__lenskit__lenskit_graph for analysis.',
    ].join('\n'));
    const verdicts = checkToolDeclarations([skill]);
    expect(verdicts).toHaveLength(0);
  });

  it('matches MCP tools by full name in body', () => {
    const skill = makeSkill([
      '---',
      'name: test',
      'description: test skill',
      'allowed-tools:',
      '  - mcp__lenskit__lenskit_graph',
      '---',
      '',
      'Call mcp__lenskit__lenskit_graph to get data.',
    ].join('\n'));
    const verdicts = checkToolDeclarations([skill]);
    expect(verdicts.filter(v => v.verdict === 'violates')).toHaveLength(0);
  });
});
