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

type LayerName = 'entry' | 'logic' | 'data' | 'utilities' | 'presentation' | 'unknown';

const LAYER_PATTERNS: Array<{ pattern: RegExp; layer: LayerName }> = [
  { pattern: /\broutes?\b/i, layer: 'entry' },
  { pattern: /\bpages?\b/i, layer: 'entry' },
  { pattern: /\bcontrollers?\b/i, layer: 'entry' },
  { pattern: /\bhandlers?\b/i, layer: 'entry' },
  { pattern: /\bservices?\b/i, layer: 'logic' },
  { pattern: /\bdb\b/i, layer: 'data' },
  { pattern: /\bmodels?\b/i, layer: 'data' },
  { pattern: /\bschemas?\b/i, layer: 'data' },
  { pattern: /\brepository\b/i, layer: 'data' },
  { pattern: /\brepositories\b/i, layer: 'data' },
  { pattern: /\butils?\b/i, layer: 'utilities' },
  { pattern: /\blib\b/i, layer: 'utilities' },
  { pattern: /\bhelpers?\b/i, layer: 'utilities' },
  { pattern: /\bcomponents?\b/i, layer: 'presentation' },
  { pattern: /\bviews?\b/i, layer: 'presentation' },
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

function classifyLayer(filePath: string): LayerName {
  for (const { pattern, layer } of LAYER_PATTERNS) {
    if (pattern.test(filePath)) {
      return layer;
    }
  }
  return 'unknown';
}

/**
 * Extract import target paths from file content.
 * Returns raw import strings (not resolved).
 */
function extractImports(content: string): string[] {
  const imports: string[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trimStart();

    // ES import: import ... from 'path'
    const esMatch = trimmed.match(/(?:import|export)\s+.*?from\s+['"]([^'"]+)['"]/);
    if (esMatch) {
      imports.push(esMatch[1]);
      continue;
    }

    // Dynamic import: import('path')
    const dynamicMatch = trimmed.match(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/);
    if (dynamicMatch) {
      imports.push(dynamicMatch[1]);
      continue;
    }

    // CommonJS: require('path')
    const cjsMatch = trimmed.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
    if (cjsMatch) {
      imports.push(cjsMatch[1]);
      continue;
    }

    // Python: from path import ... / import path
    const pyFromMatch = trimmed.match(/^from\s+(\S+)\s+import/);
    if (pyFromMatch) {
      imports.push(pyFromMatch[1]);
      continue;
    }
    const pyImportMatch = trimmed.match(/^import\s+(\S+)/);
    if (pyImportMatch && !trimmed.match(/^import\s+.*?from/)) {
      imports.push(pyImportMatch[1]);
      continue;
    }
  }

  return imports;
}

/**
 * Try to resolve a relative import to a project file path.
 * Returns null if it's an external module or unresolvable.
 */
function resolveImport(
  importPath: string,
  importerPath: string,
  fileSet: Set<string>
): string | null {
  // Skip external/node modules
  if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
    return null;
  }

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
      const resolved = resolveImport(imp, file, fileSet);
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

  // Detect layer violations
  const layerViolations: LayerViolation[] = [];
  for (const edge of edges) {
    const fromLayer = classifyLayer(edge.from);
    const toLayer = classifyLayer(edge.to);

    // Skip unknown layers and same-layer imports
    if (fromLayer === 'unknown' || toLayer === 'unknown') continue;
    if (fromLayer === toLayer) continue;

    // Utilities should not import from higher layers
    if (fromLayer === 'utilities' && LAYER_RANK[toLayer] > LAYER_RANK[fromLayer]) {
      layerViolations.push({
        file: edge.from,
        imports: edge.to,
        violation: `Utility file imports from ${toLayer} layer`,
      });
    }

    // Data layer should not import from logic or entry
    if (fromLayer === 'data' && LAYER_RANK[toLayer] > LAYER_RANK[fromLayer]) {
      layerViolations.push({
        file: edge.from,
        imports: edge.to,
        violation: `Data layer file imports from ${toLayer} layer`,
      });
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
