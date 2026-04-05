import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { classifyRule, checkConformance, type RuleVerdict } from '../conformance.js';
import type { ParsedRule } from '../discovery.js';
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
