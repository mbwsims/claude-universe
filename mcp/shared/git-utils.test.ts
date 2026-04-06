import { describe, it, expect } from 'vitest';
import { gitRun } from './git-utils.js';
import { join } from 'node:path';

const FIXTURE_DIR = join(import.meta.dirname, '..', 'test-fixtures');

describe('gitRun', () => {
  it('returns ok with stdout for valid git command', async () => {
    const result = await gitRun(['log', '--oneline', '-1'], FIXTURE_DIR);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.stdout.trim().length).toBeGreaterThan(0);
    }
  });

  it('returns ok with stdout for git status', async () => {
    const result = await gitRun(['status', '--short'], FIXTURE_DIR);
    expect(result.ok).toBe(true);
  });

  it('returns failure for invalid git command', async () => {
    const result = await gitRun(['not-a-real-command'], FIXTURE_DIR);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it('returns failure for non-git directory', async () => {
    const result = await gitRun(['log', '--oneline', '-1'], '/tmp');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('not a git repository');
    }
  });

  it('returns failure for nonexistent directory', async () => {
    const result = await gitRun(['status'], '/tmp/nonexistent-dir-99999');
    expect(result.ok).toBe(false);
  });

  it('captures multi-line stdout', async () => {
    const result = await gitRun(['log', '--oneline', '-5'], FIXTURE_DIR);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const lines = result.stdout.trim().split('\n');
      expect(lines.length).toBeGreaterThanOrEqual(5);
    }
  });
});
