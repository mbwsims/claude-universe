import { describe, it, expect } from 'vitest';
import { checkGitignore } from '../analyzers/discovery.js';

describe('discovery', () => {
  describe('checkGitignore', () => {
    it('should handle ** glob patterns', async () => {
      const { mkdtemp, writeFile, mkdir } = await import('node:fs/promises');
      const { join } = await import('node:path');
      const { tmpdir } = await import('node:os');

      const dir = await mkdtemp(join(tmpdir(), 'shieldkit-test-'));
      await writeFile(join(dir, '.gitignore'), '**/*.log\n');
      await mkdir(join(dir, 'logs'), { recursive: true });

      const result = await checkGitignore(dir, 'logs/server.log');
      expect(result).toBe(true);
    });

    it('should handle negation patterns', async () => {
      const { mkdtemp, writeFile } = await import('node:fs/promises');
      const { join } = await import('node:path');
      const { tmpdir } = await import('node:os');

      const dir = await mkdtemp(join(tmpdir(), 'shieldkit-test-'));
      await writeFile(join(dir, '.gitignore'), '*.env\n!.env.example\n');

      const envResult = await checkGitignore(dir, '.env');
      expect(envResult).toBe(true);

      const exampleResult = await checkGitignore(dir, '.env.example');
      expect(exampleResult).toBe(false);
    });

    it('should handle directory patterns with **', async () => {
      const { mkdtemp, writeFile } = await import('node:fs/promises');
      const { join } = await import('node:path');
      const { tmpdir } = await import('node:os');

      const dir = await mkdtemp(join(tmpdir(), 'shieldkit-test-'));
      await writeFile(join(dir, '.gitignore'), '**/node_modules/\n');

      const result = await checkGitignore(dir, 'packages/web/node_modules/foo.js');
      expect(result).toBe(true);
    });

    it('should return false for non-ignored files', async () => {
      const { mkdtemp, writeFile } = await import('node:fs/promises');
      const { join } = await import('node:path');
      const { tmpdir } = await import('node:os');

      const dir = await mkdtemp(join(tmpdir(), 'shieldkit-test-'));
      await writeFile(join(dir, '.gitignore'), 'node_modules/\n.env\n');

      const result = await checkGitignore(dir, 'src/index.ts');
      expect(result).toBe(false);
    });
  });
});
