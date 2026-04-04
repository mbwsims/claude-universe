/**
 * File discovery utilities for security scanning.
 *
 * Discovers source files, route files, env files, and detects frameworks.
 */

import { readFile } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import { globby } from 'globby';

const IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/.git/**',
  '**/vendor/**',
  '**/.next/**',
  '**/.nuxt/**',
];

const SOURCE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.rs', '.rb', '.java', '.kt',
]);

const TEST_PATTERNS = [
  '**/*.test.*',
  '**/*.spec.*',
  '**/__tests__/**/*.*',
];

export async function discoverSourceFiles(cwd: string): Promise<string[]> {
  const allFiles = await globby(['**/*'], {
    cwd,
    ignore: [...IGNORE_PATTERNS, ...TEST_PATTERNS, '**/*.d.ts'],
    absolute: false,
  });

  return allFiles.filter(f => SOURCE_EXTENSIONS.has(extname(f)));
}

export async function discoverRouteFiles(cwd: string): Promise<string[]> {
  const patterns = [
    '**/app/api/**/route.{ts,js,tsx,jsx}',
    '**/pages/api/**/*.{ts,js,tsx,jsx}',
    '**/routes/**/*.{ts,js,tsx,jsx}',
    '**/controllers/**/*.{ts,js,tsx,jsx}',
    '**/*controller.{ts,js}',
    '**/*handler.{ts,js}',
    '**/*route.{ts,js}',
  ];

  return globby(patterns, {
    cwd,
    ignore: IGNORE_PATTERNS,
    absolute: false,
  });
}

export async function discoverEnvFiles(cwd: string): Promise<string[]> {
  return globby(['.env', '.env.*', '**/.env', '**/.env.*'], {
    cwd,
    ignore: IGNORE_PATTERNS,
    absolute: false,
    dot: true,
  });
}

export async function discoverDbFiles(cwd: string): Promise<string[]> {
  const allSource = await discoverSourceFiles(cwd);
  const dbFiles: string[] = [];

  for (const file of allSource) {
    try {
      const content = await readFile(join(cwd, file), 'utf-8');
      const hasDbAccess =
        /\b(prisma|knex|sequelize|typeorm|mongoose|mongodb|pg\.query|mysql|sqlite|drizzle)\b/i.test(content) ||
        /\b(createConnection|getRepository|getConnection|query\(|\.execute\()\b/.test(content);
      if (hasDbAccess) {
        dbFiles.push(file);
      }
    } catch {
      // skip unreadable files
    }
  }

  return dbFiles;
}

export async function detectFramework(cwd: string): Promise<string | null> {
  // Check for framework config files
  const configPatterns: Record<string, string> = {
    'next.config.*': 'nextjs',
    'nuxt.config.*': 'nuxt',
    'svelte.config.*': 'sveltekit',
    'remix.config.*': 'remix',
    'astro.config.*': 'astro',
    'vite.config.*': 'vite',
  };

  for (const [pattern, framework] of Object.entries(configPatterns)) {
    const matches = await globby(pattern, { cwd, ignore: IGNORE_PATTERNS });
    if (matches.length > 0) return framework;
  }

  // Check package.json for framework deps
  try {
    const pkgContent = await readFile(join(cwd, 'package.json'), 'utf-8');
    const pkg = JSON.parse(pkgContent);
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (allDeps.next) return 'nextjs';
    if (allDeps.nuxt) return 'nuxt';
    if (allDeps['@sveltejs/kit']) return 'sveltekit';
    if (allDeps['@remix-run/node'] || allDeps['@remix-run/react']) return 'remix';
    if (allDeps.express) return 'express';
    if (allDeps.fastify) return 'fastify';
    if (allDeps.koa) return 'koa';
    if (allDeps.hono) return 'hono';
  } catch {
    // no package.json
  }

  return null;
}

export async function checkGitignore(cwd: string, filePath: string): Promise<boolean> {
  try {
    const gitignoreContent = await readFile(join(cwd, '.gitignore'), 'utf-8');
    const lines = gitignoreContent.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    const fileName = basename(filePath);

    for (const pattern of lines) {
      // Exact match
      if (pattern === filePath || pattern === fileName) return true;
      // .env patterns
      if (pattern === '.env' && (filePath === '.env' || filePath.endsWith('/.env'))) return true;
      if (pattern === '.env*' || pattern === '.env.*') {
        if (fileName.startsWith('.env')) return true;
      }
      // Simple glob: *.ext matches by extension
      if (pattern.startsWith('*.')) {
        const ext = pattern.slice(1); // e.g., ".log"
        if (fileName.endsWith(ext)) return true;
      }
      // Directory pattern: dir/ matches anything inside
      if (pattern.endsWith('/') && filePath.startsWith(pattern.slice(0, -1))) return true;
    }
  } catch {
    // no .gitignore
  }

  return false;
}
