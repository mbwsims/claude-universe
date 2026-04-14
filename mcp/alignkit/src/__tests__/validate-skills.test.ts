import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import { validateSkills } from '../validate-skills.js';

const TMP_DIR = join(import.meta.dirname, '..', '..', 'tmp', 'validate-skills-test');

function resetTmpDir() {
  rmSync(TMP_DIR, { recursive: true, force: true });
  mkdirSync(TMP_DIR, { recursive: true });
}

function writeRepoFile(relativePath: string, content: string) {
  const absolutePath = join(TMP_DIR, relativePath);
  mkdirSync(join(absolutePath, '..'), { recursive: true });
  writeFileSync(absolutePath, content);
}

beforeEach(() => {
  resetTmpDir();
});

afterEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

describe('validateSkills', () => {
  it('returns the pinned JSON summary shape and keeps plain conformance violations as warnings', async () => {
    writeRepoFile('skills/trace/SKILL.md', [
      '---',
      'name: trace',
      'description: Trace a request through the codebase when the user asks for end-to-end flow analysis.',
      'allowed-tools:',
      '  - Read',
      '  - mcp__lenskit__lenskit_graph',
      '---',
      '',
      '# Trace',
      '',
      'Use `lenskit_graph` to inspect the dependency graph.',
      '',
      '- Run vitest before committing',
    ].join('\n'));

    writeRepoFile('package.json', JSON.stringify({
      name: 'fixture',
      private: true,
      scripts: {},
    }, null, 2));

    const result = await validateSkills(TMP_DIR);

    expect(result.summary).toEqual({
      ok: true,
      errorCount: 0,
      toolDeclarationViolationCount: 0,
      warningCount: 2,
      filesScanned: 1,
    });
  });

  it('fails when skill metadata errors are present', async () => {
    writeRepoFile('skills/broken/SKILL.md', [
      '---',
      'name: broken',
      '---',
      '',
      '# Broken',
      '',
      'Missing the required description field.',
    ].join('\n'));

    const result = await validateSkills(TMP_DIR);

    expect(result.summary.ok).toBe(false);
    expect(result.summary.errorCount).toBe(1);
    expect(result.summary.toolDeclarationViolationCount).toBe(0);
    expect(result.summary.warningCount).toBe(0);
    expect(result.summary.filesScanned).toBe(1);
  });

  it('fails when skill tool declarations drift from the body', async () => {
    writeRepoFile('skills/test/SKILL.md', [
      '---',
      'name: test',
      'description: Generate tests when the user explicitly asks for test authoring.',
      'allowed-tools:',
      '  - Read',
      '  - mcp__lenskit__lenskit_graph',
      '---',
      '',
      '# Test',
      '',
      'Read the project and decide what to cover.',
    ].join('\n'));

    const result = await validateSkills(TMP_DIR);

    expect(result.summary.ok).toBe(false);
    expect(result.summary.errorCount).toBe(0);
    expect(result.summary.toolDeclarationViolationCount).toBe(1);
    expect(result.summary.warningCount).toBe(0);
    expect(result.summary.filesScanned).toBe(1);
  });
});
