/**
 * tsconfig-resolver.ts — Parse tsconfig.json path aliases and resolve aliased imports.
 *
 * Handles `extends` chains up to 3 levels, `baseUrl`, and `paths` mappings.
 * Primary consumer: lenskit (coupling.ts, graph.ts).
 */

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';

export interface TsconfigPaths {
  baseUrl: string;
  paths: Record<string, string[]>;
}

/**
 * Parse tsconfig.json at the given directory, following `extends` up to 3 levels.
 * Returns the merged baseUrl and paths, or null if no tsconfig found.
 */
export async function parseTsconfig(
  projectDir: string,
  depth = 0,
): Promise<TsconfigPaths | null> {
  if (depth > 3) return null;

  const tsconfigPath = join(projectDir, 'tsconfig.json');
  let raw: string;
  try {
    raw = await readFile(tsconfigPath, 'utf-8');
  } catch {
    return null;
  }

  // Strip single-line comments (tsconfig allows them)
  const cleaned = raw.replace(/\/\/.*$/gm, '');
  let config: {
    extends?: string;
    compilerOptions?: {
      baseUrl?: string;
      paths?: Record<string, string[]>;
    };
  };
  try {
    config = JSON.parse(cleaned);
  } catch {
    return null;
  }

  // Resolve extends chain
  let parentPaths: TsconfigPaths | null = null;
  if (config.extends) {
    const extendsPath = config.extends.startsWith('.')
      ? join(projectDir, dirname(config.extends))
      : join(projectDir, 'node_modules', config.extends.replace(/\/tsconfig\.json$/, ''));
    parentPaths = await parseTsconfig(extendsPath, depth + 1);
  }

  const baseUrl = config.compilerOptions?.baseUrl ?? parentPaths?.baseUrl ?? '.';
  const paths = {
    ...(parentPaths?.paths ?? {}),
    ...(config.compilerOptions?.paths ?? {}),
  };

  if (Object.keys(paths).length === 0 && !config.compilerOptions?.baseUrl) {
    if (parentPaths) return parentPaths;
    return { baseUrl, paths };
  }

  return { baseUrl, paths };
}

/**
 * Resolve an aliased import path using tsconfig paths mapping.
 *
 * Returns the resolved path (relative to project root) or null if the
 * import doesn't match any alias.
 *
 * Example:
 *   resolveAliasedImport('@/utils/helpers', { '@/*': ['src/*'] }, '.')
 *   => 'src/utils/helpers'
 */
export function resolveAliasedImport(
  importPath: string,
  paths: Record<string, string[]>,
  baseUrl: string,
): string | null {
  // Skip relative and bare module imports
  if (importPath.startsWith('.') || importPath.startsWith('/')) {
    return null;
  }

  for (const [pattern, targets] of Object.entries(paths)) {
    if (targets.length === 0) continue;

    // Pattern is like '@/*' — split into prefix '@/' and check for wildcard
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1); // '@/'
      if (importPath.startsWith(prefix)) {
        const rest = importPath.slice(prefix.length);
        const target = targets[0]; // Use first mapping target
        const targetPrefix = target.slice(0, -1); // 'src/'
        const resolved = targetPrefix + rest;
        return baseUrl === '.' ? resolved : join(baseUrl, resolved);
      }
    } else {
      // Exact match (no wildcard)
      if (importPath === pattern) {
        const resolved = targets[0];
        return baseUrl === '.' ? resolved : join(baseUrl, resolved);
      }
    }
  }

  return null;
}
