/**
 * coupling.ts -- Measure how connected a file is.
 *
 * Two modes:
 * - analyzeCoupling(file, cwd): scans all files to find importers (for single-file analysis)
 * - buildImportIndex(cwd): reads all files once and builds a lookup table (for batch analysis)
 */

import { readFile } from 'node:fs/promises';
import { join, relative, dirname, basename, extname } from 'node:path';
import { discoverSourceFiles } from './discovery.js';
import { extractImports } from './graph.js';
import { resolveAliasedImport, type TsconfigPaths } from '../../../shared/tsconfig-resolver.js';

export interface CouplingResult {
  importerCount: number;
  importers: string[];
}

function getModuleName(filePath: string): string {
  const ext = extname(filePath);
  const base = basename(filePath, ext);
  if (base === 'index') {
    return dirname(filePath);
  }
  return filePath.replace(ext, '');
}

/** Extract all import paths from a file's content using the shared graph parser. */
function extractImportPaths(content: string): string[] {
  return extractImports(content).map(i => i.path);
}

/**
 * Build a shared import index for all files in the project.
 * Returns a map: filePath -> list of raw import path strings.
 * Call this once, then use lookupCoupling() for each file.
 */
export async function buildImportIndex(
  cwd: string,
  files?: string[]
): Promise<Map<string, string[]>> {
  const allFiles = files ?? await discoverSourceFiles(cwd);
  const index = new Map<string, string[]>();

  await Promise.all(
    allFiles.map(async (filePath) => {
      try {
        const content = await readFile(join(cwd, filePath), 'utf-8');
        index.set(filePath, extractImportPaths(content));
      } catch {
        index.set(filePath, []);
      }
    })
  );

  return index;
}

/**
 * Look up coupling for a file using a pre-built import index.
 * O(N) where N is the number of files (just scanning the index).
 *
 * Optional tsconfigPaths enables resolution of aliased imports (e.g., @/utils/helpers).
 */
export function lookupCoupling(
  filePath: string,
  importIndex: Map<string, string[]>,
  tsconfigPaths?: TsconfigPaths | null,
): CouplingResult {
  const targetModuleName = getModuleName(filePath);
  const targetModuleNoExt = targetModuleName.replace(/\.[^.]+$/, '');
  const importers: string[] = [];

  for (const [otherFile, importPaths] of importIndex) {
    if (otherFile === filePath) continue;

    const importerDir = dirname(otherFile);

    for (const importPath of importPaths) {
      let resolved = false;

      // 1. Try tsconfig alias resolution
      if (tsconfigPaths && tsconfigPaths.paths) {
        const aliasResolved = resolveAliasedImport(
          importPath,
          tsconfigPaths.paths,
          tsconfigPaths.baseUrl,
        );
        if (aliasResolved) {
          const aliasNoExt = aliasResolved.replace(/\.[^.]+$/, '');
          if (aliasNoExt === targetModuleNoExt) {
            resolved = true;
          }
        }
      }

      // 2. Try relative import resolution
      if (!resolved) {
        // Only strip known file extensions, not parts of identifiers like "-service"
        const importPathNoExt = importPath.replace(/\.(ts|tsx|js|jsx|py|go|rs|rb|java|mjs|cjs)$/, '');

        // Resolve relative imports to absolute project paths
        if (importPath.startsWith('.') || importPath.startsWith('/')) {
          const resolvedPath = join(importerDir, importPathNoExt);
          const normalizedResolved = resolvedPath.replace(/\\/g, '/');
          if (normalizedResolved === targetModuleNoExt) {
            resolved = true;
          }
        }

        // 3. Try Python relative imports (dot notation)
        if (!resolved && importPath.startsWith('.') && !importPath.startsWith('./') && !importPath.startsWith('../')) {
          // Python: .models means ./models, ..utils means ../utils
          const dots = importPath.match(/^(\.+)/);
          if (dots) {
            const dotCount = dots[1].length;
            const modulePart = importPath.slice(dotCount);
            // One dot = same directory, two dots = parent directory, etc.
            let pythonDir = importerDir;
            for (let i = 1; i < dotCount; i++) {
              pythonDir = dirname(pythonDir);
            }
            const pythonResolved = join(pythonDir, modulePart).replace(/\\/g, '/');
            const targetNoExtNoPy = targetModuleNoExt.replace(/\.py$/, '');
            if (pythonResolved === targetNoExtNoPy || pythonResolved === targetModuleNoExt) {
              resolved = true;
            }
          }
        }
      }

      if (resolved) {
        importers.push(otherFile);
        break;
      }
    }
  }

  return {
    importerCount: importers.length,
    importers,
  };
}

/**
 * Single-file coupling analysis (discovers + reads all files).
 * Use for single-file analysis only. For batch, use buildImportIndex + lookupCoupling.
 */
export async function analyzeCoupling(
  filePath: string,
  cwd: string,
  tsconfigPaths?: TsconfigPaths | null,
): Promise<CouplingResult> {
  const index = await buildImportIndex(cwd);
  return lookupCoupling(filePath, index, tsconfigPaths);
}
