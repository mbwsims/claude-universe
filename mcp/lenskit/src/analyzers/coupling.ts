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

/** Extract all import paths from a file's content. */
function extractImportPaths(content: string): string[] {
  const paths: string[] = [];
  for (const line of content.split('\n')) {
    const trimmed = line.trimStart();
    if (!(trimmed.startsWith('import ') || trimmed.includes('require(') || trimmed.startsWith('from '))) {
      continue;
    }
    const pathMatch = trimmed.match(/['"`]([^'"`]+)['"`]/);
    if (pathMatch) {
      paths.push(pathMatch[1]);
    }
  }
  return paths;
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
 */
export function lookupCoupling(
  filePath: string,
  importIndex: Map<string, string[]>
): CouplingResult {
  const targetModuleName = getModuleName(filePath);
  const targetModuleNoExt = targetModuleName.replace(/\.[^.]+$/, '');
  const targetBaseName = basename(targetModuleNoExt);
  const importers: string[] = [];

  for (const [otherFile, importPaths] of importIndex) {
    if (otherFile === filePath) continue;

    const importerDir = dirname(otherFile);
    const relPath = relative(importerDir, targetModuleName);
    const normalizedRel = relPath.startsWith('.') ? relPath : './' + relPath;
    const normalizedRelNoExt = normalizedRel.replace(/\.[^.]+$/, '');

    const patterns = [normalizedRelNoExt, targetModuleNoExt].filter(p => p.length > 0);

    for (const importPath of importPaths) {
      const importPathNoExt = importPath.replace(/\.[^.]+$/, '');
      let found = false;
      for (const pattern of patterns) {
        if (importPathNoExt === pattern || importPathNoExt.endsWith('/' + basename(pattern))) {
          found = true;
          break;
        }
      }
      if (found) {
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
export async function analyzeCoupling(filePath: string, cwd: string): Promise<CouplingResult> {
  const index = await buildImportIndex(cwd);
  return lookupCoupling(filePath, index);
}
