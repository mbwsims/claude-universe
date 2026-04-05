/**
 * File discovery utilities for security scanning.
 *
 * Discovers source files, route files, env files, and detects frameworks.
 */

import { readFile } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import { globby } from 'globby';

// Canonical version: mcp/shared/discovery.ts — keep in sync
const IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/.git/**',
  '**/vendor/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/test-fixtures/**',
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
    // Python route files
    '**/views.py',
    '**/routes.py',
    '**/api.py',
    '**/urls.py',
    '**/routes/**/*.py',
    '**/api/**/*.py',
    '**/views/**/*.py',
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
        // JS/TS patterns
        /\b(prisma|knex|sequelize|typeorm|mongoose|mongodb|pg\.query|mysql|sqlite|drizzle)\b/i.test(content) ||
        /\b(createConnection|getRepository|getConnection|query\(|\.execute\()\b/.test(content) ||
        // Python patterns
        /\b(sqlalchemy|django\.db|psycopg2|pymysql|sqlite3|peewee|tortoise)\b/i.test(content) ||
        /\b(cursor\.execute|session\.query|\.objects\.(filter|get|all|create))\b/.test(content);
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
  // Check for framework config files in parallel
  const configPatterns: Record<string, string> = {
    'next.config.*': 'nextjs',
    'nuxt.config.*': 'nuxt',
    'svelte.config.*': 'sveltekit',
    'remix.config.*': 'remix',
    'astro.config.*': 'astro',
    'vite.config.*': 'vite',
    // Python frameworks
    'manage.py': 'django',
    'wsgi.py': 'flask',
  };

  const results = await Promise.all(
    Object.entries(configPatterns).map(async ([pattern, framework]) => {
      const matches = await globby(pattern, { cwd, ignore: IGNORE_PATTERNS });
      return { framework, found: matches.length > 0 };
    })
  );

  for (const { framework, found } of results) {
    if (found) return framework;
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

  // Check requirements.txt for Python frameworks
  try {
    const reqContent = await readFile(join(cwd, 'requirements.txt'), 'utf-8');
    if (/^django\b/im.test(reqContent)) return 'django';
    if (/^flask\b/im.test(reqContent)) return 'flask';
    if (/^fastapi\b/im.test(reqContent)) return 'fastapi';
  } catch {
    // no requirements.txt
  }

  return null;
}

export async function checkGitignore(cwd: string, filePath: string): Promise<boolean> {
  try {
    const gitignoreContent = await readFile(join(cwd, '.gitignore'), 'utf-8');
    const rawLines = gitignoreContent.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    const fileName = basename(filePath);

    // Separate negation patterns from regular patterns
    const patterns: Array<{ pattern: string; negated: boolean }> = rawLines.map(line => {
      if (line.startsWith('!')) {
        return { pattern: line.slice(1), negated: true };
      }
      return { pattern: line, negated: false };
    });

    let ignored = false;

    for (const { pattern, negated } of patterns) {
      const matches = matchGitignorePattern(pattern, filePath, fileName);
      if (matches) {
        ignored = !negated;
      }
    }

    return ignored;
  } catch {
    // no .gitignore
  }

  return false;
}

/**
 * Match a single .gitignore pattern against a file path.
 * Supports: exact match, *.ext, dir/, ** globs, .env patterns.
 */
function matchGitignorePattern(pattern: string, filePath: string, fileName: string): boolean {
  // Exact match
  if (pattern === filePath || pattern === fileName) return true;

  // .env patterns
  if (pattern === '.env' && (filePath === '.env' || filePath.endsWith('/.env'))) return true;
  if (pattern === '.env*' || pattern === '.env.*') {
    if (fileName.startsWith('.env')) return true;
  }

  // *.ext -- matches by extension anywhere
  if (pattern.startsWith('*.')) {
    const ext = pattern.slice(1);
    if (fileName.endsWith(ext)) return true;
  }

  // Directory pattern: dir/ matches anything inside
  if (pattern.endsWith('/')) {
    const dirName = pattern.slice(0, -1);
    if (filePath.startsWith(dirName + '/') || filePath.includes('/' + dirName + '/')) return true;
  }

  // ** glob patterns
  if (pattern.includes('**')) {
    // For directory patterns like **/node_modules/, match anything inside
    let matchPattern = pattern;
    let isDir = false;
    if (matchPattern.endsWith('/')) {
      matchPattern = matchPattern.slice(0, -1);
      isDir = true;
    }

    const regexStr = matchPattern
      .replace(/\./g, '\\.')
      .replace(/\*\*\//g, '(.*/)?')
      .replace(/\*\*/g, '.*')
      .replace(/(?<!\.)\*/g, '[^/]*');
    // For dir patterns, match anything that starts with this path
    const fullRegexStr = isDir ? `^${regexStr}(/.*)?$` : `^${regexStr}$`;
    const regex = new RegExp(fullRegexStr);
    if (regex.test(filePath)) return true;

    // Also try matching against just the filename for patterns like **/*.log
    if (!isDir && regex.test(fileName)) return true;

    // Try matching with and without leading path segments
    const segments = filePath.split('/');
    for (let i = 0; i < segments.length; i++) {
      const subPath = segments.slice(i).join('/');
      if (regex.test(subPath)) return true;
    }
  }

  // Simple directory match without trailing slash
  if (!pattern.includes('/') && !pattern.includes('*') && !pattern.includes('.')) {
    if (filePath.startsWith(pattern + '/') || filePath.includes('/' + pattern + '/')) return true;
  }

  return false;
}
