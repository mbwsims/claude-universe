import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { discoverInstructionFiles, parseRules } from '../discovery.js';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';

const TMP_DIR = join(import.meta.dirname, '..', '..', '..', '__test-tmp-discovery');

function setupFixture() {
  rmSync(TMP_DIR, { recursive: true, force: true });
  mkdirSync(join(TMP_DIR, '.claude', 'rules'), { recursive: true });
  mkdirSync(join(TMP_DIR, '.claude', 'agents'), { recursive: true });
  mkdirSync(join(TMP_DIR, '.claude', 'skills', 'test-skill'), { recursive: true });

  writeFileSync(join(TMP_DIR, 'CLAUDE.md'), [
    '# Project Instructions',
    '',
    '## Code Style',
    '',
    '- Use TypeScript strict mode',
    '- Always use named exports',
    '- No default exports except in pages/',
    '',
    '## Testing',
    '',
    '1. Run `vitest run` before committing',
    '2. Write tests for all new functions',
    '3. Use describe/it blocks, not standalone test()',
  ].join('\n'));

  writeFileSync(join(TMP_DIR, '.claude', 'rules', 'test-patterns.md'), [
    '---',
    'globs: "**/*.test.ts"',
    '---',
    '',
    '- Co-locate test files next to source',
    '- Use vi.fn() for mocks, not manual stubs',
  ].join('\n'));

  writeFileSync(join(TMP_DIR, '.claude', 'agents', 'reviewer.md'), [
    '---',
    'name: reviewer',
    'description: Reviews code for quality',
    'model: sonnet',
    '---',
    '',
    '# Code Reviewer',
    '',
    '- Check for proper error handling',
    '- Verify type safety',
  ].join('\n'));

  writeFileSync(join(TMP_DIR, '.claude', 'skills', 'test-skill', 'SKILL.md'), [
    '---',
    'name: test-skill',
    'description: A test skill',
    '---',
    '',
    '# Test Skill',
    '',
    '- Step one of the skill',
    '- Step two of the skill',
  ].join('\n'));
}

function cleanupFixture() {
  rmSync(TMP_DIR, { recursive: true, force: true });
}

describe('discoverInstructionFiles', () => {
  beforeAll(() => setupFixture());
  afterAll(() => cleanupFixture());

  it('finds CLAUDE.md at project root', async () => {
    const files = await discoverInstructionFiles(TMP_DIR);
    const paths = files.map(f => f.relativePath);
    expect(paths).toContain('CLAUDE.md');
  });

  it('finds files in .claude/rules/', async () => {
    const files = await discoverInstructionFiles(TMP_DIR);
    const paths = files.map(f => f.relativePath);
    expect(paths).toContain('.claude/rules/test-patterns.md');
  });

  it('finds files in .claude/agents/', async () => {
    const files = await discoverInstructionFiles(TMP_DIR);
    const paths = files.map(f => f.relativePath);
    expect(paths).toContain('.claude/agents/reviewer.md');
  });

  it('finds SKILL.md files in .claude/skills/', async () => {
    const files = await discoverInstructionFiles(TMP_DIR);
    const paths = files.map(f => f.relativePath);
    expect(paths).toContain('.claude/skills/test-skill/SKILL.md');
  });

  it('returns content for each file', async () => {
    const files = await discoverInstructionFiles(TMP_DIR);
    const claudeMd = files.find(f => f.relativePath === 'CLAUDE.md');
    expect(claudeMd).toBeDefined();
    expect(claudeMd!.content).toContain('Use TypeScript strict mode');
  });

  it('returns empty array when no instruction files exist', async () => {
    const emptyDir = join(TMP_DIR, '__empty');
    mkdirSync(emptyDir, { recursive: true });
    const files = await discoverInstructionFiles(emptyDir);
    expect(files).toEqual([]);
    rmSync(emptyDir, { recursive: true });
  });
});

describe('parseRules', () => {
  it('extracts bullet-point rules from markdown', () => {
    const content = [
      '# Section',
      '',
      '- Rule one',
      '- Rule two',
      '- Rule three',
    ].join('\n');
    const rules = parseRules(content);
    expect(rules).toHaveLength(3);
    expect(rules[0].text).toBe('Rule one');
    expect(rules[1].text).toBe('Rule two');
    expect(rules[2].text).toBe('Rule three');
  });

  it('extracts numbered-list rules', () => {
    const content = [
      '# Testing',
      '',
      '1. Run vitest before committing',
      '2. Write tests for new functions',
    ].join('\n');
    const rules = parseRules(content);
    expect(rules).toHaveLength(2);
    expect(rules[0].text).toBe('Run vitest before committing');
    expect(rules[1].text).toBe('Write tests for new functions');
  });

  it('assigns section headings to rules', () => {
    const content = [
      '## Code Style',
      '',
      '- Use strict mode',
      '',
      '## Testing',
      '',
      '- Run tests first',
    ].join('\n');
    const rules = parseRules(content);
    expect(rules[0].section).toBe('Code Style');
    expect(rules[1].section).toBe('Testing');
  });

  it('tracks line numbers for each rule', () => {
    const content = [
      '# Header',        // line 1
      '',                 // line 2
      '- First rule',    // line 3
      '',                 // line 4
      '- Second rule',   // line 5
    ].join('\n');
    const rules = parseRules(content);
    expect(rules[0].line).toBe(3);
    expect(rules[1].line).toBe(5);
  });

  it('strips frontmatter before parsing', () => {
    const content = [
      '---',
      'globs: "*.ts"',
      '---',
      '',
      '- Actual rule',
    ].join('\n');
    const rules = parseRules(content);
    expect(rules).toHaveLength(1);
    expect(rules[0].text).toBe('Actual rule');
  });

  it('returns empty array for file with no rules', () => {
    const content = [
      '# Just a header',
      '',
      'Some paragraph text without rules.',
    ].join('\n');
    const rules = parseRules(content);
    expect(rules).toEqual([]);
  });

  it('handles multi-line rules (continuation indented lines)', () => {
    const content = [
      '- First rule that spans',
      '  multiple lines here',
      '- Second rule',
    ].join('\n');
    const rules = parseRules(content);
    expect(rules).toHaveLength(2);
    expect(rules[0].text).toBe('First rule that spans multiple lines here');
  });
});
