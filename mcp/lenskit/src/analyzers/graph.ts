/**
 * graph.ts -- Dependency graph analysis.
 *
 * Parses import statements across all source files to build a directed
 * dependency graph. Detects circular dependencies, hub/leaf files,
 * layer classifications, and layer violations.
 */

import { readFile } from 'node:fs/promises';
import { join, dirname, extname, relative } from 'node:path';
import { discoverSourceFiles } from './discovery.js';
import { parseTsconfig, resolveAliasedImport, type TsconfigPaths } from '../../../shared/tsconfig-resolver.js';

export interface GraphEdge {
  from: string;
  to: string;
}

export interface HubFile {
  file: string;
  importerCount: number;
}

export interface LayerViolation {
  file: string;
  imports: string;
  violation: string;
}

export interface GraphResult {
  nodes: string[];
  edges: GraphEdge[];
  circularDeps: string[][];
  hubs: HubFile[];
  leaves: string[];
  layerViolations: LayerViolation[];
}

export type LayerName = 'entry' | 'logic' | 'data' | 'utilities' | 'presentation' | 'unknown';

export type ImportKind = 'value' | 'type' | 'side-effect';

export interface ImportInfo {
  path: string;
  kind: ImportKind;
}

const LAYER_PATTERNS: Array<{ pattern: RegExp; layer: LayerName }> = [
  // Entry points
  { pattern: /\broutes?\b/i, layer: 'entry' },
  { pattern: /\bpages?\b/i, layer: 'entry' },
  { pattern: /\bcontrollers?\b/i, layer: 'entry' },
  { pattern: /\bhandlers?\b/i, layer: 'entry' },
  // Python Django entry points
  { pattern: /\bviews?\b/i, layer: 'entry' },
  { pattern: /\burls?\b/i, layer: 'entry' },
  // Logic
  { pattern: /\bservices?\b/i, layer: 'logic' },
  { pattern: /\buse[_-]?cases?\b/i, layer: 'logic' },
  { pattern: /\bdomain\b/i, layer: 'logic' },
  // Data
  { pattern: /\bdb\b/i, layer: 'data' },
  { pattern: /\bmodels?\b/i, layer: 'data' },
  { pattern: /\bschemas?\b/i, layer: 'data' },
  { pattern: /\brepository\b/i, layer: 'data' },
  { pattern: /\brepositories\b/i, layer: 'data' },
  // Python Django data
  { pattern: /\bserializers?\b/i, layer: 'data' },
  { pattern: /\bmigrations?\b/i, layer: 'data' },
  // Utilities
  { pattern: /\butils?\b/i, layer: 'utilities' },
  { pattern: /\blib\b/i, layer: 'utilities' },
  { pattern: /\bhelpers?\b/i, layer: 'utilities' },
  // Presentation
  { pattern: /\bcomponents?\b/i, layer: 'presentation' },
  // Note: views is classified as entry (Django) above -- presentation is for UI components
  { pattern: /\btemplates?\b/i, layer: 'presentation' },
];

// Layer dependency rules: lower layers should NOT import from higher layers
// Order from top to bottom: entry > logic > data, utilities is cross-cutting, presentation is top
const LAYER_RANK: Record<LayerName, number> = {
  entry: 4,
  presentation: 4,
  logic: 3,
  data: 2,
  utilities: 1,
  unknown: 0,
};

/** Heuristic: infer layer from export/import patterns when path classification is unknown. */
function inferLayerFromPatterns(hints?: { exports: string[]; imports: string[] }): LayerName {
  if (!hints) return 'unknown';

  const { exports: exps, imports: imps } = hints;

  // If it imports data-layer modules and exports functions, it's likely logic
  const importsData = imps.some(i =>
    /\b(db|models?|repository|repositories|schemas?)\b/i.test(i)
  );
  const exportsActions = exps.some(e =>
    /^(create|update|delete|get|find|fetch|process|handle|validate)/i.test(e)
  );
  if (importsData && exportsActions) return 'logic';

  // If it exports many small pure functions, it's likely utilities
  const allLowerCamel = exps.every(e => /^[a-z]/.test(e));
  if (allLowerCamel && exps.length >= 3) return 'utilities';

  return 'unknown';
}

/**
 * Classify a file's architectural layer based on its path.
 * Optionally accepts export/import hints for unknown-path inference.
 */
export function classifyLayer(
  filePath: string,
  hints?: { exports: string[]; imports: string[] },
): LayerName {
  for (const { pattern, layer } of LAYER_PATTERNS) {
    if (pattern.test(filePath)) {
      return layer;
    }
  }
  return inferLayerFromPatterns(hints);
}

/**
 * Detect if an import between two layers is a violation.
 * Returns a LayerViolation or null if the import is valid.
 *
 * 5 violation types:
 * 1. Utility importing from higher layers (logic, entry, presentation)
 * 2. Data importing from higher layers (logic, entry, presentation)
 * 3. Logic importing from entry/presentation layer
 * 4. Presentation importing directly from data layer (should go through logic)
 * 5. Any layer importing from unknown when the unknown is inferred as higher
 */
export function detectLayerViolation(
  fromLayer: LayerName,
  toLayer: LayerName,
  fromFile: string,
  toFile: string,
): LayerViolation | null {
  // Skip unknown layers and same-layer imports
  if (fromLayer === 'unknown' || toLayer === 'unknown') return null;
  if (fromLayer === toLayer) return null;

  const fromRank = LAYER_RANK[fromLayer];
  const toRank = LAYER_RANK[toLayer];

  // 1. Utilities should not import from any higher layer
  if (fromLayer === 'utilities' && toRank > fromRank) {
    return {
      file: fromFile,
      imports: toFile,
      violation: `Utility file imports from ${toLayer} layer (utilities should be dependency-free)`,
    };
  }

  // 2. Data layer should not import from logic, entry, or presentation
  if (fromLayer === 'data' && toRank > fromRank) {
    return {
      file: fromFile,
      imports: toFile,
      violation: `Data layer file imports from ${toLayer} layer (data should not depend on higher layers)`,
    };
  }

  // 3. Logic layer should not import from entry or presentation
  if (fromLayer === 'logic' && (toLayer === 'entry' || toLayer === 'presentation')) {
    return {
      file: fromFile,
      imports: toFile,
      violation: `Logic layer file imports from ${toLayer} layer (business logic should not depend on entry/presentation)`,
    };
  }

  // 4. Presentation should not import directly from data layer (should go through logic)
  if (fromLayer === 'presentation' && toLayer === 'data') {
    return {
      file: fromFile,
      imports: toFile,
      violation: `Presentation layer imports directly from data layer (should use logic/service layer as intermediary)`,
    };
  }

  return null;
}

/**
 * Extract import target paths from file content.
 * Returns import info with path and kind (value, type, or side-effect).
 */
export function extractImports(content: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trimStart();

    // Type-only import: import type { Foo } from 'path'
    const typeMatch = trimmed.match(/^import\s+type\s+.*?from\s+['"]([^'"]+)['"]/);
    if (typeMatch) {
      imports.push({ path: typeMatch[1], kind: 'type' });
      continue;
    }

    // Side-effect import: import 'path' (no bindings)
    const sideEffectMatch = trimmed.match(/^import\s+['"]([^'"]+)['"]\s*;?\s*$/);
    if (sideEffectMatch) {
      imports.push({ path: sideEffectMatch[1], kind: 'side-effect' });
      continue;
    }

    // ES import: import ... from 'path'  /  export ... from 'path'
    const esMatch = trimmed.match(/(?:import|export)\s+.*?from\s+['"]([^'"]+)['"]/);
    if (esMatch) {
      imports.push({ path: esMatch[1], kind: 'value' });
      continue;
    }

    // Dynamic import: import('path')
    const dynamicMatch = trimmed.match(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/);
    if (dynamicMatch) {
      imports.push({ path: dynamicMatch[1], kind: 'value' });
      continue;
    }

    // CommonJS: require('path')
    const cjsMatch = trimmed.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
    if (cjsMatch) {
      imports.push({ path: cjsMatch[1], kind: 'value' });
      continue;
    }

    // Python: from path import ... / import path
    const pyFromMatch = trimmed.match(/^from\s+(\S+)\s+import/);
    if (pyFromMatch) {
      imports.push({ path: pyFromMatch[1], kind: 'value' });
      continue;
    }
    const pyImportMatch = trimmed.match(/^import\s+(\S+)/);
    if (pyImportMatch && !trimmed.match(/^import\s+.*?from/)) {
      imports.push({ path: pyImportMatch[1], kind: 'value' });
      continue;
    }
  }

  return imports;
}

/**
 * Try to resolve an import to a project file path.
 * Handles relative imports and tsconfig path aliases.
 * Returns null if it's an external module or unresolvable.
 */
export function resolveImport(
  importPath: string,
  importerPath: string,
  fileSet: Set<string>,
  tsconfigPaths?: TsconfigPaths | null,
): string | null {
  // 1. Try tsconfig alias resolution first (highest-impact change)
  if (tsconfigPaths && tsconfigPaths.paths && !importPath.startsWith('.') && !importPath.startsWith('/')) {
    const aliasResolved = resolveAliasedImport(
      importPath,
      tsconfigPaths.paths,
      tsconfigPaths.baseUrl,
    );
    if (aliasResolved) {
      // Try to find the aliased path in the file set
      const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.rb', '.java'];
      for (const ext of extensions) {
        const candidate = aliasResolved + ext;
        if (fileSet.has(candidate)) {
          return candidate;
        }
      }
      // Try index files
      for (const ext of extensions) {
        const indexCandidate = join(aliasResolved, 'index' + ext);
        if (fileSet.has(indexCandidate)) {
          return indexCandidate;
        }
      }
    }
  }

  // 2. Skip external/node modules (that didn't match any alias)
  if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
    return null;
  }

  // 3. Resolve relative imports
  const importerDir = dirname(importerPath);
  const resolved = join(importerDir, importPath);

  // Try exact match first, then with extensions
  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.rb', '.java'];
  for (const ext of extensions) {
    const candidate = resolved + ext;
    if (fileSet.has(candidate)) {
      return candidate;
    }
  }

  // Try index files
  for (const ext of extensions) {
    const indexCandidate = join(resolved, 'index' + ext);
    if (fileSet.has(indexCandidate)) {
      return indexCandidate;
    }
  }

  return null;
}

/**
 * Detect circular dependencies using DFS with recursion stack.
 * Finds cycles of any length.
 */
function detectCircularDeps(
  adjacency: Map<string, string[]>
): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const stack = new Set<string>();
  const path: string[] = [];
  const seenCycles = new Set<string>();

  function dfs(node: string): void {
    visited.add(node);
    stack.add(node);
    path.push(node);

    for (const dep of adjacency.get(node) ?? []) {
      if (!visited.has(dep)) {
        dfs(dep);
      } else if (stack.has(dep)) {
        // Found a cycle — extract it from the path
        const cycleStart = path.indexOf(dep);
        const cycle = path.slice(cycleStart);
        // Deduplicate: normalize by sorting a copy for the key
        const cycleKey = [...cycle].sort().join('|');
        if (!seenCycles.has(cycleKey)) {
          seenCycles.add(cycleKey);
          cycles.push(cycle);
        }
      }
    }

    path.pop();
    stack.delete(node);
  }

  for (const node of adjacency.keys()) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return cycles;
}

export async function analyzeGraph(cwd: string): Promise<GraphResult> {
  const files = await discoverSourceFiles(cwd);
  const fileSet = new Set(files);

  // Try to load tsconfig for alias resolution
  let tsconfigPaths: TsconfigPaths | null = null;
  try {
    tsconfigPaths = await parseTsconfig(cwd);
  } catch {
    // No tsconfig or parse error -- continue without alias resolution
  }

  const edges: GraphEdge[] = [];
  const adjacency = new Map<string, string[]>();
  const importerCount = new Map<string, number>();

  // Initialize
  for (const file of files) {
    adjacency.set(file, []);
    importerCount.set(file, 0);
  }

  // Parse imports and build graph
  for (const file of files) {
    const fullPath = join(cwd, file);
    let content: string;
    try {
      content = await readFile(fullPath, 'utf-8');
    } catch {
      continue;
    }

    const rawImports = extractImports(content);
    const deps = adjacency.get(file) ?? [];

    for (const imp of rawImports) {
      const resolved = resolveImport(imp.path, file, fileSet, tsconfigPaths);
      if (resolved && resolved !== file) {
        edges.push({ from: file, to: resolved });
        deps.push(resolved);
        importerCount.set(resolved, (importerCount.get(resolved) ?? 0) + 1);
      }
    }

    adjacency.set(file, deps);
  }

  // Detect circular dependencies
  const circularDeps = detectCircularDeps(adjacency);

  // Identify hub files (top 10 by importer count)
  const hubs = Array.from(importerCount.entries())
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([file, count]) => ({ file, importerCount: count }));

  // Identify leaf files (zero importers)
  const leaves = Array.from(importerCount.entries())
    .filter(([, count]) => count === 0)
    .map(([file]) => file);

  // Detect layer violations using expanded 5-type detection
  const layerViolations: LayerViolation[] = [];
  for (const edge of edges) {
    const fromLayer = classifyLayer(edge.from);
    const toLayer = classifyLayer(edge.to);

    const violation = detectLayerViolation(fromLayer, toLayer, edge.from, edge.to);
    if (violation) {
      layerViolations.push(violation);
    }
  }

  return {
    nodes: files,
    edges,
    circularDeps,
    hubs,
    leaves,
    layerViolations,
  };
}
