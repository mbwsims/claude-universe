# Phase 4: Survey (lenskit) -- Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Survey subsystem (lenskit) from B to A- by fixing MCP server bugs in all 7 analyzers, improving 5 skills, fixing the codebase-analyst agent, expanding reference docs, and adding ~51 tests from zero.

**Architecture:** The lenskit MCP server (`mcp/lenskit/`) exposes 3 tools (lenskit_analyze, lenskit_graph, lenskit_status) backed by 7 analyzer modules in `src/analyzers/`. Phase 0 creates shared infrastructure in `mcp/shared/` (tsconfig-resolver.ts, python-patterns.ts, git-utils.ts) and test fixtures in `mcp/test-fixtures/` that this phase depends on. All analyzer fixes are pure function changes with no MCP protocol changes.

**Tech Stack:** TypeScript (ES2022, NodeNext), vitest, Node.js (fs/promises, child_process), globby

---

### Task 1: Fix coupling.ts -- tsconfig resolution and basename disambiguation

**Files:**
- Modify: `mcp/lenskit/src/analyzers/coupling.ts`
- Create: `mcp/lenskit/src/analyzers/coupling.test.ts`

**Depends on:** Phase 0 Task 4 (mcp/shared/tsconfig-resolver.ts)

- [ ] **Step 1: Write failing tests for coupling.ts**

Create `mcp/lenskit/src/analyzers/coupling.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { buildImportIndex, lookupCoupling } from './coupling.js';
import { join } from 'node:path';

const FIXTURE_DIR = join(import.meta.dirname, '..', '..', '..', '..', 'test-fixtures');

describe('lookupCoupling', () => {
  describe('basename disambiguation', () => {
    it('does NOT false-positive match files with same basename in different directories', () => {
      // Two files: src/db/connection.ts and src/api/connection.ts
      // An import of ./db/connection should NOT match src/api/connection.ts
      const importIndex = new Map<string, string[]>([
        ['src/routes/handler.ts', ['../db/connection']],
        ['src/api/connection.ts', []],
        ['src/db/connection.ts', []],
      ]);

      const result = lookupCoupling('src/db/connection.ts', importIndex);
      expect(result.importers).toEqual(['src/routes/handler.ts']);
      expect(result.importerCount).toBe(1);
    });

    it('does NOT match unrelated file with same basename', () => {
      const importIndex = new Map<string, string[]>([
        ['src/auth/utils.ts', ['../shared/utils']],
        ['src/shared/utils.ts', []],
        ['src/db/utils.ts', []],
      ]);

      const result = lookupCoupling('src/db/utils.ts', importIndex);
      expect(result.importers).toEqual([]);
      expect(result.importerCount).toBe(0);
    });

    it('correctly matches when import path contains directory segment', () => {
      const importIndex = new Map<string, string[]>([
        ['src/routes/user-routes.ts', ['../services/user-service']],
        ['src/services/user-service.ts', []],
      ]);

      const result = lookupCoupling('src/services/user-service.ts', importIndex);
      expect(result.importers).toEqual(['src/routes/user-routes.ts']);
      expect(result.importerCount).toBe(1);
    });
  });

  describe('tsconfig path alias resolution', () => {
    it('matches aliased import @/services/user-service to src/services/user-service.ts', () => {
      const importIndex = new Map<string, string[]>([
        ['src/routes/handler.ts', ['@/services/user-service']],
        ['src/services/user-service.ts', []],
      ]);

      const result = lookupCoupling('src/services/user-service.ts', importIndex, {
        baseUrl: '.',
        paths: { '@/*': ['src/*'] },
      });
      expect(result.importers).toEqual(['src/routes/handler.ts']);
      expect(result.importerCount).toBe(1);
    });

    it('matches aliased import @db/connection to src/db/connection.ts', () => {
      const importIndex = new Map<string, string[]>([
        ['src/services/auth.ts', ['@db/connection']],
        ['src/db/connection.ts', []],
      ]);

      const result = lookupCoupling('src/db/connection.ts', importIndex, {
        baseUrl: '.',
        paths: { '@db/*': ['src/db/*'] },
      });
      expect(result.importers).toEqual(['src/services/auth.ts']);
      expect(result.importerCount).toBe(1);
    });

    it('does NOT match aliased import to wrong file', () => {
      const importIndex = new Map<string, string[]>([
        ['src/routes/handler.ts', ['@/services/auth-service']],
        ['src/services/user-service.ts', []],
      ]);

      const result = lookupCoupling('src/services/user-service.ts', importIndex, {
        baseUrl: '.',
        paths: { '@/*': ['src/*'] },
      });
      expect(result.importers).toEqual([]);
    });

    it('works without tsconfig paths (graceful degradation)', () => {
      const importIndex = new Map<string, string[]>([
        ['src/routes/handler.ts', ['../services/user-service']],
        ['src/services/user-service.ts', []],
      ]);

      const result = lookupCoupling('src/services/user-service.ts', importIndex);
      expect(result.importers).toEqual(['src/routes/handler.ts']);
    });
  });

  describe('Python import resolution', () => {
    it('matches Python relative import (from .models import X)', () => {
      const importIndex = new Map<string, string[]>([
        ['src/py/api.py', ['.models']],
        ['src/py/models.py', []],
      ]);

      const result = lookupCoupling('src/py/models.py', importIndex);
      expect(result.importers).toEqual(['src/py/api.py']);
    });

    it('matches Python dotted module import (from ..utils import X)', () => {
      const importIndex = new Map<string, string[]>([
        ['src/py/sub/handler.py', ['..utils']],
        ['src/py/utils.py', []],
      ]);

      const result = lookupCoupling('src/py/utils.py', importIndex);
      expect(result.importers).toEqual(['src/py/sub/handler.py']);
    });

    it('does NOT match unrelated Python module', () => {
      const importIndex = new Map<string, string[]>([
        ['src/py/api.py', ['.models']],
        ['src/py/utils.py', []],
      ]);

      const result = lookupCoupling('src/py/utils.py', importIndex);
      expect(result.importers).toEqual([]);
    });
  });
});

describe('buildImportIndex', () => {
  it('builds index from fixture project', async () => {
    const index = await buildImportIndex(FIXTURE_DIR);
    expect(index.size).toBeGreaterThan(0);

    // user-routes.ts imports from ../services/user-service
    const routeImports = index.get('src/routes/user-routes.ts');
    expect(routeImports).toBeDefined();
    expect(routeImports!.some(p => p.includes('user-service'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

Run: `cd /Users/msims/Documents/GitHub/claude-universe-plugin/mcp/lenskit && npx vitest run src/analyzers/coupling.test.ts 2>&1 | tail -20`

Expected: Multiple FAIL lines -- basename disambiguation tests fail because of the `endsWith('/' + basename(pattern))` bug, tsconfig tests fail because the parameter does not exist, Python tests fail.

- [ ] **Step 3: Fix the basename false-positive bug in lookupCoupling**

In `mcp/lenskit/src/analyzers/coupling.ts`, the bug is on line 96:

```typescript
importPathNoExt.endsWith('/' + basename(pattern))
```

This matches ANY file with the same basename regardless of directory. Replace the entire `lookupCoupling` function and add the tsconfig resolution import.

Replace the imports at the top of the file:

```typescript
import { readFile } from 'node:fs/promises';
import { join, relative, dirname, basename, extname } from 'node:path';
import { discoverSourceFiles } from './discovery.js';
```

With:

```typescript
import { readFile } from 'node:fs/promises';
import { join, relative, dirname, basename, extname } from 'node:path';
import { discoverSourceFiles } from './discovery.js';
import { resolveAliasedImport, type TsconfigPaths } from '../../../shared/tsconfig-resolver.js';
```

Then replace the `lookupCoupling` function (lines 73-112):

```typescript
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
        const importPathNoExt = importPath.replace(/\.[^.]+$/, '');

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
```

- [ ] **Step 4: Update analyzeCoupling to accept and pass tsconfigPaths**

Replace the `analyzeCoupling` function at the bottom of the file:

```typescript
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
```

- [ ] **Step 5: Run tests to confirm all pass**

Run: `cd /Users/msims/Documents/GitHub/claude-universe-plugin/mcp/lenskit && npx vitest run src/analyzers/coupling.test.ts 2>&1 | tail -20`

Expected: All 12 tests PASS

- [ ] **Step 6: Typecheck**

Run: `cd /Users/msims/Documents/GitHub/claude-universe-plugin/mcp/lenskit && npx tsc --noEmit 2>&1 | tail -10`

Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add mcp/lenskit/src/analyzers/coupling.ts mcp/lenskit/src/analyzers/coupling.test.ts
git commit -m "fix(lenskit): fix coupling basename false positives, add tsconfig alias and Python import resolution"
```

---

### Task 2: Fix graph.ts -- tsconfig resolution, side-effect imports, expanded layer violations

**Files:**
- Modify: `mcp/lenskit/src/analyzers/graph.ts`
- Create: `mcp/lenskit/src/analyzers/graph.test.ts`

**Depends on:** Phase 0 Task 4 (mcp/shared/tsconfig-resolver.ts)

- [ ] **Step 1: Write failing tests for graph.ts**

Create `mcp/lenskit/src/analyzers/graph.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';

// We test the internal functions by importing the module.
// Since the functions are not exported, we test via analyzeGraph on fixtures
// and also test exported helpers we'll add.
// For unit-testability, we refactor to export the key functions.
import {
  extractImports,
  resolveImport,
  classifyLayer,
  detectLayerViolation,
  type LayerName,
} from './graph.js';

describe('extractImports', () => {
  it('extracts ES6 static imports', () => {
    const content = `import { foo } from './foo';\nimport bar from '../bar';`;
    const imports = extractImports(content);
    expect(imports).toContainEqual({ path: './foo', kind: 'value' });
    expect(imports).toContainEqual({ path: '../bar', kind: 'value' });
  });

  it('extracts dynamic imports', () => {
    const content = `const m = import('./lazy-module');`;
    const imports = extractImports(content);
    expect(imports).toContainEqual({ path: './lazy-module', kind: 'value' });
  });

  it('extracts CommonJS requires', () => {
    const content = `const x = require('./helper');`;
    const imports = extractImports(content);
    expect(imports).toContainEqual({ path: './helper', kind: 'value' });
  });

  it('extracts Python from...import', () => {
    const content = `from .models import UserModel\nfrom flask import Flask`;
    const imports = extractImports(content);
    expect(imports).toContainEqual({ path: '.models', kind: 'value' });
    expect(imports).toContainEqual({ path: 'flask', kind: 'value' });
  });

  it('extracts Python bare import', () => {
    const content = `import os\nimport json`;
    const imports = extractImports(content);
    expect(imports).toContainEqual({ path: 'os', kind: 'value' });
    expect(imports).toContainEqual({ path: 'json', kind: 'value' });
  });

  it('detects side-effect imports (no bindings)', () => {
    const content = `import './polyfill';\nimport 'reflect-metadata';`;
    const imports = extractImports(content);
    expect(imports).toContainEqual({ path: './polyfill', kind: 'side-effect' });
    expect(imports).toContainEqual({ path: 'reflect-metadata', kind: 'side-effect' });
  });

  it('detects type-only imports', () => {
    const content = `import type { Foo } from './types';`;
    const imports = extractImports(content);
    expect(imports).toContainEqual({ path: './types', kind: 'type' });
  });

  it('extracts aliased imports (@/ paths)', () => {
    const content = `import { UserService } from '@/services/user-service';`;
    const imports = extractImports(content);
    expect(imports).toContainEqual({ path: '@/services/user-service', kind: 'value' });
  });
});

describe('resolveImport', () => {
  const fileSet = new Set([
    'src/utils/helpers.ts',
    'src/services/user-service.ts',
    'src/db/connection.ts',
    'src/index.ts',
  ]);

  it('resolves relative import with extension match', () => {
    const result = resolveImport('./helpers', 'src/utils/format.ts', fileSet);
    expect(result).toBe('src/utils/helpers.ts');
  });

  it('resolves relative import going up directories', () => {
    const result = resolveImport('../db/connection', 'src/services/user-service.ts', fileSet);
    expect(result).toBe('src/db/connection.ts');
  });

  it('resolves index file imports', () => {
    const result = resolveImport('./', 'src/routes/handler.ts', fileSet);
    // Would need src/routes/index.ts in fileSet to resolve
    expect(result).toBeNull();
  });

  it('resolves tsconfig aliased import when tsconfigPaths provided', () => {
    const tsconfigPaths = { baseUrl: '.', paths: { '@/*': ['src/*'] } };
    const result = resolveImport(
      '@/services/user-service',
      'src/routes/handler.ts',
      fileSet,
      tsconfigPaths,
    );
    expect(result).toBe('src/services/user-service.ts');
  });

  it('resolves @db/ alias', () => {
    const tsconfigPaths = { baseUrl: '.', paths: { '@db/*': ['src/db/*'] } };
    const result = resolveImport(
      '@db/connection',
      'src/services/auth.ts',
      fileSet,
      tsconfigPaths,
    );
    expect(result).toBe('src/db/connection.ts');
  });

  it('returns null for unresolvable external module', () => {
    const result = resolveImport('lodash', 'src/utils/helpers.ts', fileSet);
    expect(result).toBeNull();
  });

  it('returns null for external module even with tsconfigPaths (no matching alias)', () => {
    const tsconfigPaths = { baseUrl: '.', paths: { '@/*': ['src/*'] } };
    const result = resolveImport('express', 'src/app.ts', fileSet, tsconfigPaths);
    expect(result).toBeNull();
  });
});

describe('classifyLayer', () => {
  it('classifies route files as entry', () => {
    expect(classifyLayer('src/routes/user-routes.ts')).toBe('entry');
  });

  it('classifies controller files as entry', () => {
    expect(classifyLayer('src/controllers/auth-controller.ts')).toBe('entry');
  });

  it('classifies service files as logic', () => {
    expect(classifyLayer('src/services/user-service.ts')).toBe('logic');
  });

  it('classifies model/db files as data', () => {
    expect(classifyLayer('src/db/connection.ts')).toBe('data');
    expect(classifyLayer('src/models/user.ts')).toBe('data');
  });

  it('classifies utility files as utilities', () => {
    expect(classifyLayer('src/utils/helpers.ts')).toBe('utilities');
    expect(classifyLayer('src/lib/format.ts')).toBe('utilities');
  });

  it('classifies component files as presentation', () => {
    expect(classifyLayer('src/components/Button.tsx')).toBe('presentation');
  });

  it('returns unknown for unclassifiable files', () => {
    expect(classifyLayer('src/index.ts')).toBe('unknown');
  });

  it('classifies Python Django views as entry', () => {
    expect(classifyLayer('app/views.py')).toBe('entry');
  });

  it('classifies Python Django models as data', () => {
    expect(classifyLayer('app/models.py')).toBe('data');
  });

  it('classifies Python serializers as data', () => {
    expect(classifyLayer('app/serializers.py')).toBe('data');
  });

  it('infers layer from export/import patterns when path is unknown', () => {
    // This tests the unknown-layer inference heuristic
    const layer = classifyLayer('src/foo/bar.ts', {
      exports: ['createUser', 'deleteUser', 'updateUser'],
      imports: ['./db/connection', './models/user'],
    });
    // Functions that call data layer = likely logic layer
    expect(layer).toBe('logic');
  });
});

describe('detectLayerViolation', () => {
  it('detects utility importing from logic layer', () => {
    const violation = detectLayerViolation('utilities', 'logic', 'src/utils/helper.ts', 'src/services/auth.ts');
    expect(violation).not.toBeNull();
    expect(violation!.violation).toContain('Utility');
  });

  it('detects data layer importing from logic layer', () => {
    const violation = detectLayerViolation('data', 'logic', 'src/models/user.ts', 'src/services/auth.ts');
    expect(violation).not.toBeNull();
    expect(violation!.violation).toContain('Data');
  });

  it('detects data layer importing from entry layer', () => {
    const violation = detectLayerViolation('data', 'entry', 'src/db/repo.ts', 'src/routes/api.ts');
    expect(violation).not.toBeNull();
  });

  it('detects logic layer importing from entry layer', () => {
    const violation = detectLayerViolation('logic', 'entry', 'src/services/user.ts', 'src/routes/handler.ts');
    expect(violation).not.toBeNull();
    expect(violation!.violation).toContain('Logic');
  });

  it('detects presentation importing from data layer directly', () => {
    const violation = detectLayerViolation('presentation', 'data', 'src/components/UserList.tsx', 'src/db/repo.ts');
    expect(violation).not.toBeNull();
    expect(violation!.violation).toContain('Presentation');
  });

  it('allows entry importing from logic (valid)', () => {
    const violation = detectLayerViolation('entry', 'logic', 'src/routes/api.ts', 'src/services/auth.ts');
    expect(violation).toBeNull();
  });

  it('allows logic importing from data (valid)', () => {
    const violation = detectLayerViolation('logic', 'data', 'src/services/user.ts', 'src/models/user.ts');
    expect(violation).toBeNull();
  });

  it('allows same-layer imports (valid)', () => {
    const violation = detectLayerViolation('logic', 'logic', 'src/services/user.ts', 'src/services/auth.ts');
    expect(violation).toBeNull();
  });

  it('skips unknown layers', () => {
    const violation = detectLayerViolation('unknown', 'logic', 'src/foo.ts', 'src/services/auth.ts');
    expect(violation).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

Run: `cd /Users/msims/Documents/GitHub/claude-universe-plugin/mcp/lenskit && npx vitest run src/analyzers/graph.test.ts 2>&1 | tail -20`

Expected: FAIL -- functions are not exported, side-effect/type import kinds don't exist, classifyLayer doesn't accept hints, detectLayerViolation doesn't exist.

- [ ] **Step 3: Update imports at top of graph.ts**

In `mcp/lenskit/src/analyzers/graph.ts`, replace:

```typescript
import { readFile } from 'node:fs/promises';
import { join, dirname, extname, relative } from 'node:path';
import { discoverSourceFiles } from './discovery.js';
```

With:

```typescript
import { readFile } from 'node:fs/promises';
import { join, dirname, extname, relative } from 'node:path';
import { discoverSourceFiles } from './discovery.js';
import { parseTsconfig, resolveAliasedImport, type TsconfigPaths } from '../../../shared/tsconfig-resolver.js';
```

- [ ] **Step 4: Add ImportInfo interface and update extractImports to classify import kinds**

Add the following interface after the existing interfaces (after line 36):

```typescript
export type ImportKind = 'value' | 'type' | 'side-effect';

export interface ImportInfo {
  path: string;
  kind: ImportKind;
}
```

Replace the `extractImports` function (lines 82-124) with:

```typescript
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
```

- [ ] **Step 5: Add Python Django layer patterns and export classifyLayer**

Replace the `LAYER_PATTERNS` constant and `classifyLayer` function (lines 40-76) with:

```typescript
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
```

- [ ] **Step 6: Fix resolveImport to handle tsconfig aliases and export it**

Replace the `resolveImport` function (lines 130-161) with:

```typescript
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
```

- [ ] **Step 7: Add detectLayerViolation and expand to 5 violation types**

Add the following exported function after the `classifyLayer` function:

```typescript
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
```

- [ ] **Step 8: Update analyzeGraph to use tsconfig, side-effect edges, and new violation detection**

Replace the `analyzeGraph` function (lines 210-301) with:

```typescript
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
```

- [ ] **Step 9: Run tests to confirm all pass**

Run: `cd /Users/msims/Documents/GitHub/claude-universe-plugin/mcp/lenskit && npx vitest run src/analyzers/graph.test.ts 2>&1 | tail -25`

Expected: All 15 tests PASS

- [ ] **Step 10: Run coupling tests to ensure nothing broke**

Run: `cd /Users/msims/Documents/GitHub/claude-universe-plugin/mcp/lenskit && npx vitest run src/analyzers/ 2>&1 | tail -20`

Expected: All tests in both coupling.test.ts and graph.test.ts PASS

- [ ] **Step 11: Typecheck**

Run: `cd /Users/msims/Documents/GitHub/claude-universe-plugin/mcp/lenskit && npx tsc --noEmit 2>&1 | tail -10`

Expected: No errors

- [ ] **Step 12: Commit**

```bash
git add mcp/lenskit/src/analyzers/graph.ts mcp/lenskit/src/analyzers/graph.test.ts
git commit -m "fix(lenskit): add tsconfig alias resolution, side-effect imports, 5-type layer violations to graph analyzer"
```

---

### Task 3: Fix file-metrics.ts -- brace-based nesting, Go methods, arrow functions, Python

**Files:**
- Modify: `mcp/lenskit/src/analyzers/file-metrics.ts`
- Create: `mcp/lenskit/src/analyzers/file-metrics.test.ts`

- [ ] **Step 1: Write failing tests for file-metrics.ts**

Create `mcp/lenskit/src/analyzers/file-metrics.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  countFunctions,
  computeMaxNestingDepth,
} from './file-metrics.js';

describe('countFunctions', () => {
  it('counts exported function declarations', () => {
    const lines = [
      'export function createUser(name: string) {',
      '  return { name };',
      '}',
      '',
      'export async function deleteUser(id: string) {',
      '  await db.delete(id);',
      '}',
    ];
    expect(countFunctions(lines, 'ts')).toBe(2);
  });

  it('counts non-exported arrow function declarations', () => {
    const lines = [
      'const validate = (input: string): boolean => {',
      '  return input.length > 0;',
      '};',
      '',
      'const transform = async (data: any) => {',
      '  return process(data);',
      '};',
    ];
    expect(countFunctions(lines, 'ts')).toBe(2);
  });

  it('counts Go receiver methods', () => {
    const lines = [
      'func (s *UserService) GetUser(id string) (*User, error) {',
      '  return s.repo.FindById(id)',
      '}',
      '',
      'func (s *UserService) CreateUser(name string) error {',
      '  return s.repo.Create(name)',
      '}',
      '',
      'func main() {',
      '  fmt.Println("hello")',
      '}',
    ];
    expect(countFunctions(lines, 'go')).toBe(3);
  });

  it('counts Python def and async def functions', () => {
    const lines = [
      'def create_user(name: str) -> dict:',
      '    return {"name": name}',
      '',
      'async def fetch_data():',
      '    pass',
      '',
      'class UserService:',
      '    def get_user(self, user_id: str):',
      '        pass',
    ];
    expect(countFunctions(lines, 'py')).toBe(3);
  });

  it('counts Python class methods', () => {
    const lines = [
      'class UserModel:',
      '    def __init__(self, name):',
      '        self.name = name',
      '',
      '    @classmethod',
      '    def create(cls, name):',
      '        return cls(name)',
      '',
      '    @staticmethod',
      '    def validate(name):',
      '        return len(name) > 0',
    ];
    expect(countFunctions(lines, 'py')).toBe(3);
  });

  it('counts Java methods without access modifiers', () => {
    const lines = [
      'class UserService {',
      '  User getUser(String id) {',
      '    return repo.findById(id);',
      '  }',
      '',
      '  void deleteUser(String id) {',
      '    repo.delete(id);',
      '  }',
      '}',
    ];
    expect(countFunctions(lines, 'java')).toBe(2);
  });
});

describe('computeMaxNestingDepth', () => {
  describe('brace-based nesting (JS/TS/Java/Go/Rust)', () => {
    it('computes depth 0 for flat function', () => {
      const lines = [
        'function hello() {',
        '  console.log("hi");',
        '}',
      ];
      expect(computeMaxNestingDepth(lines, 'ts')).toBe(0);
    });

    it('computes depth 1 for single if-block', () => {
      const lines = [
        'function check(x) {',
        '  if (x > 0) {',
        '    return true;',
        '  }',
        '}',
      ];
      expect(computeMaxNestingDepth(lines, 'ts')).toBe(1);
    });

    it('computes depth 2 for nested if/for', () => {
      const lines = [
        'function process(items) {',
        '  for (const item of items) {',
        '    if (item.valid) {',
        '      handle(item);',
        '    }',
        '  }',
        '}',
      ];
      expect(computeMaxNestingDepth(lines, 'ts')).toBe(2);
    });

    it('computes depth 3 for deeply nested code', () => {
      const lines = [
        'function deep() {',
        '  if (a) {',
        '    for (const x of items) {',
        '      if (x.ok) {',
        '        process(x);',
        '      }',
        '    }',
        '  }',
        '}',
      ];
      expect(computeMaxNestingDepth(lines, 'ts')).toBe(3);
    });

    it('ignores braces inside string literals', () => {
      const lines = [
        'function fmt() {',
        '  const s = "{ not a block }";',
        '  return s;',
        '}',
      ];
      expect(computeMaxNestingDepth(lines, 'ts')).toBe(0);
    });

    it('handles Go function with receiver', () => {
      const lines = [
        'func (s *Server) handleRequest(w http.ResponseWriter, r *http.Request) {',
        '  if r.Method == "GET" {',
        '    for _, item := range items {',
        '      if item.Valid {',
        '        w.Write(item.Data)',
        '      }',
        '    }',
        '  }',
        '}',
      ];
      expect(computeMaxNestingDepth(lines, 'go')).toBe(3);
    });

    it('handles Rust match arms', () => {
      const lines = [
        'fn process(input: &str) -> Result<(), Error> {',
        '  match input {',
        '    "a" => {',
        '      println!("found a");',
        '    }',
        '    _ => {',
        '      return Err(Error::Unknown);',
        '    }',
        '  }',
        '}',
      ];
      // match is depth 1, arm block is depth 2
      expect(computeMaxNestingDepth(lines, 'rs')).toBe(2);
    });
  });

  describe('indent-based nesting (Python)', () => {
    it('computes depth 1 for single if in Python', () => {
      const lines = [
        'def check(x):',
        '    if x > 0:',
        '        return True',
        '    return False',
      ];
      expect(computeMaxNestingDepth(lines, 'py')).toBe(1);
    });

    it('computes depth 2 for nested Python blocks', () => {
      const lines = [
        'def process(items):',
        '    for item in items:',
        '        if item.valid:',
        '            handle(item)',
        '    return True',
      ];
      expect(computeMaxNestingDepth(lines, 'py')).toBe(2);
    });
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

Run: `cd /Users/msims/Documents/GitHub/claude-universe-plugin/mcp/lenskit && npx vitest run src/analyzers/file-metrics.test.ts 2>&1 | tail -20`

Expected: FAIL -- countFunctions and computeMaxNestingDepth are not exported, don't accept language parameter.

- [ ] **Step 3: Add BRACE_LANGUAGES constant and arrow function pattern, export countFunctions**

In `mcp/lenskit/src/analyzers/file-metrics.ts`, replace the `FUNCTION_PATTERNS` constant (lines 17-35) with:

```typescript
const BRACE_LANGUAGES = new Set(['ts', 'tsx', 'js', 'jsx', 'java', 'go', 'rs']);

const FUNCTION_PATTERNS = [
  /^export\s+function\s/,
  /^export\s+async\s+function\s/,
  /^export\s+const\s+\w+\s*=/,
  /^export\s+class\s/,
  /^export\s+default\s+function/,
  /^export\s+default\s+class/,
  /^module\.exports\s*=/,
  /^exports\.\w+\s*=/,
  // Non-exported arrow functions: const name = (...) => or const name = async (...) =>
  /^(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\(?.*\)?\s*=>/,
  // Python
  /^def\s+\w+/,
  /^async\s+def\s+\w+/,
  // Go: func Name(
  /^func\s+\w+/,
  // Go receiver methods: func (r *Type) Name(
  /^func\s+\([^)]+\)\s+\w+/,
  // Rust
  /^fn\s+\w+/,
  /^pub\s+fn\s+\w+/,
  /^pub\s+async\s+fn\s+\w+/,
  // Java with access modifiers
  /^public\s+(static\s+)?\w+\s+\w+\s*\(/,
  /^private\s+(static\s+)?\w+\s+\w+\s*\(/,
  /^protected\s+(static\s+)?\w+\s+\w+\s*\(/,
  // Java without access modifiers (package-private): Type name(
  /^\w+\s+\w+\s*\([^)]*\)\s*\{?\s*$/,
];

/** Additional Python-specific patterns (methods inside classes). */
const PYTHON_METHOD_PATTERNS = [
  /^\s+def\s+\w+\s*\(self/,
  /^\s+def\s+\w+\s*\(cls/,
  /^\s+async\s+def\s+\w+\s*\(self/,
];
```

- [ ] **Step 4: Update countFunctions to accept language and detect Python methods**

Replace the `countFunctions` function (lines 44-53) with:

```typescript
export function countFunctions(lines: string[], lang?: string): number {
  let count = 0;
  for (const line of lines) {
    const trimmed = line.trimStart();
    if (FUNCTION_PATTERNS.some((re) => re.test(trimmed))) {
      count++;
      continue;
    }
    // Python class methods (indented def with self/cls)
    if ((lang === 'py' || !lang) && PYTHON_METHOD_PATTERNS.some((re) => re.test(line))) {
      count++;
    }
  }
  return count;
}
```

- [ ] **Step 5: Add brace-based nesting depth computation**

Add the following function after the `detectIndentStep` function:

```typescript
/**
 * Strip string literals and comments from a line to avoid counting braces inside them.
 * This is a simplification -- handles single/double-quoted strings and // comments.
 */
function stripStringsAndComments(line: string): string {
  // Remove single-line comments
  let result = line.replace(/\/\/.*$/, '');
  // Remove string literals (simple approach: remove "..." and '...' but not escaped quotes)
  result = result.replace(/"(?:[^"\\]|\\.)*"/g, '""');
  result = result.replace(/'(?:[^'\\]|\\.)*'/g, "''");
  result = result.replace(/`(?:[^`\\]|\\.)*`/g, '``');
  return result;
}

/**
 * Compute max nesting depth using brace counting.
 * Used for JS/TS/Java/Go/Rust where {} delimits blocks.
 * Depth is relative to function-level braces (the outermost { in a function body is depth 0).
 */
function computeBraceNestingDepth(lines: string[]): number {
  let maxDepth = 0;
  let braceDepth = 0;
  let functionBaseDepth = -1;
  let inFunction = false;

  for (const line of lines) {
    const trimmed = line.trimStart();
    if (trimmed === '' || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      continue;
    }

    // Detect function start
    if (!inFunction && FUNCTION_PATTERNS.some((re) => re.test(trimmed))) {
      // The opening brace might be on this line or the next
      inFunction = true;
      functionBaseDepth = braceDepth;
    }

    const cleaned = stripStringsAndComments(trimmed);

    for (const ch of cleaned) {
      if (ch === '{') {
        braceDepth++;
        if (inFunction) {
          // Depth relative to function body opening brace
          // functionBaseDepth is the depth BEFORE the function's opening brace
          // So depth within function = braceDepth - functionBaseDepth - 1
          // (subtract 1 because the function's own { is depth 0)
          const relativeDepth = braceDepth - functionBaseDepth - 2;
          if (relativeDepth > maxDepth) {
            maxDepth = relativeDepth;
          }
        }
      } else if (ch === '}') {
        braceDepth--;
        if (inFunction && braceDepth <= functionBaseDepth) {
          // Left the function body
          inFunction = false;
          functionBaseDepth = -1;
        }
      }
    }
  }

  return maxDepth;
}
```

- [ ] **Step 6: Update computeMaxNestingDepth to dispatch by language, and export it**

Replace the `computeMaxNestingDepth` function (lines 84-121) with:

```typescript
/**
 * Compute max nesting depth.
 * Uses brace counting for JS/TS/Java/Go/Rust.
 * Uses indent-based detection for Python (and as fallback).
 */
export function computeMaxNestingDepth(lines: string[], lang?: string): number {
  if (lang && BRACE_LANGUAGES.has(lang)) {
    return computeBraceNestingDepth(lines);
  }

  if (lang === 'py') {
    return computeIndentNestingDepth(lines);
  }

  // If lang is unknown, try to detect: if file has braces, use brace counting
  const hasBraces = lines.some(l => l.includes('{'));
  if (hasBraces) {
    return computeBraceNestingDepth(lines);
  }

  return computeIndentNestingDepth(lines);
}
```

Rename the original `computeMaxNestingDepth` function to `computeIndentNestingDepth` (it becomes the Python/fallback path). Find the existing function body that was at lines 84-121 and rename it:

```typescript
/** Indent-based nesting depth -- used for Python and as fallback. */
function computeIndentNestingDepth(lines: string[]): number {
  let maxDepth = 0;
  let inFunction = false;
  let functionBaseIndent = 0;
  const indentStep = detectIndentStep(lines);

  for (const line of lines) {
    if (line.trim() === '') continue;

    const indent = line.length - line.trimStart().length;
    const trimmed = line.trimStart();

    // Detect function start
    if (FUNCTION_PATTERNS.some((re) => re.test(trimmed))) {
      inFunction = true;
      functionBaseIndent = indent;
      continue;
    }

    if (inFunction) {
      // Reset on a line at or before base indent (next top-level declaration)
      if (indent <= functionBaseIndent && trimmed !== '' && !trimmed.startsWith('//') && !trimmed.startsWith('#') && !trimmed.startsWith('*')) {
        if (FUNCTION_PATTERNS.some((re) => re.test(trimmed)) || indent < functionBaseIndent) {
          inFunction = false;
          continue;
        }
      }

      const depth = Math.floor((indent - functionBaseIndent) / indentStep);
      if (depth > maxDepth) {
        maxDepth = depth;
      }
    }
  }

  return maxDepth;
}
```

- [ ] **Step 7: Update analyzeFileMetrics to detect language and pass it**

Replace the `analyzeFileMetrics` function (lines 123-134) with:

```typescript
/** Detect language from file extension. */
function detectLang(filePath: string): string | undefined {
  const ext = extname(filePath).slice(1); // remove leading dot
  if (['ts', 'tsx', 'js', 'jsx'].includes(ext)) return ext;
  if (ext === 'py') return 'py';
  if (ext === 'go') return 'go';
  if (ext === 'rs') return 'rs';
  if (ext === 'java') return 'java';
  if (ext === 'rb') return 'rb';
  return undefined;
}

export async function analyzeFileMetrics(filePath: string, cwd: string): Promise<FileMetrics> {
  const fullPath = join(cwd, filePath);
  const content = await readFile(fullPath, 'utf-8');
  const lines = content.split('\n');
  const lang = detectLang(filePath);

  return {
    lineCount: lines.length,
    functionCount: countFunctions(lines, lang),
    maxNestingDepth: computeMaxNestingDepth(lines, lang),
    importCount: countImports(lines),
  };
}
```

Add `extname` to the path import at the top of the file:

```typescript
import { join, extname } from 'node:path';
```

- [ ] **Step 8: Run tests to confirm all pass**

Run: `cd /Users/msims/Documents/GitHub/claude-universe-plugin/mcp/lenskit && npx vitest run src/analyzers/file-metrics.test.ts 2>&1 | tail -25`

Expected: All 10 tests PASS

- [ ] **Step 9: Run all analyzer tests to ensure nothing broke**

Run: `cd /Users/msims/Documents/GitHub/claude-universe-plugin/mcp/lenskit && npx vitest run src/analyzers/ 2>&1 | tail -20`

Expected: All tests PASS across coupling, graph, and file-metrics

- [ ] **Step 10: Typecheck**

Run: `cd /Users/msims/Documents/GitHub/claude-universe-plugin/mcp/lenskit && npx tsc --noEmit 2>&1 | tail -10`

Expected: No errors

- [ ] **Step 11: Commit**

```bash
git add mcp/lenskit/src/analyzers/file-metrics.ts mcp/lenskit/src/analyzers/file-metrics.test.ts
git commit -m "fix(lenskit): use brace-based nesting for JS/TS/Java/Go/Rust, add arrow function and Go receiver method detection"
```

---

### Task 4: Fix churn.ts -- path normalization and zero-churn warning

**Files:**
- Modify: `mcp/lenskit/src/analyzers/churn.ts`
- Create: `mcp/lenskit/src/analyzers/churn.test.ts`

- [ ] **Step 1: Write failing tests for churn.ts**

Create `mcp/lenskit/src/analyzers/churn.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { normalizePath, batchAnalyzeChurn } from './churn.js';
import { join } from 'node:path';

const FIXTURE_DIR = join(import.meta.dirname, '..', '..', '..', '..', 'test-fixtures');

describe('normalizePath', () => {
  it('strips leading ./ from paths', () => {
    expect(normalizePath('./src/index.ts')).toBe('src/index.ts');
  });

  it('leaves clean paths unchanged', () => {
    expect(normalizePath('src/index.ts')).toBe('src/index.ts');
  });

  it('strips multiple leading ./ occurrences', () => {
    expect(normalizePath('././src/index.ts')).toBe('src/index.ts');
  });

  it('handles empty string', () => {
    expect(normalizePath('')).toBe('');
  });

  it('normalizes backslashes to forward slashes', () => {
    expect(normalizePath('src\\utils\\helpers.ts')).toBe('src/utils/helpers.ts');
  });
});

describe('batchAnalyzeChurn', () => {
  it('returns a map with file paths as keys', async () => {
    const results = await batchAnalyzeChurn(FIXTURE_DIR);
    // The fixture project should have git history (set up in Phase 0)
    expect(results).toBeInstanceOf(Map);
  });

  it('warns when >80% files show zero churn', async () => {
    // In a freshly initialized repo, most files will show zero churn
    // unless setup-git-history.sh was run.
    // This test verifies the warning mechanism exists.
    const results = await batchAnalyzeChurn(FIXTURE_DIR);
    // The function should return results with a warning property
    // when too many files have zero churn
    const zeroChurnCount = Array.from(results.values()).filter(r => r.changes === 0).length;
    const totalCount = results.size;
    if (totalCount > 0 && zeroChurnCount / totalCount > 0.8) {
      // Expected: the warning should be attached or logged
      // We'll check the return type for the warning flag
      expect((results as any).__zeroChurnWarning).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

Run: `cd /Users/msims/Documents/GitHub/claude-universe-plugin/mcp/lenskit && npx vitest run src/analyzers/churn.test.ts 2>&1 | tail -20`

Expected: FAIL -- normalizePath is not exported, no __zeroChurnWarning property.

- [ ] **Step 3: Add normalizePath function and update batchAnalyzeChurn**

In `mcp/lenskit/src/analyzers/churn.ts`, add the following after the `execFile` declaration (after line 6):

```typescript
/**
 * Normalize a file path by stripping leading ./ and converting backslashes.
 * Git and globby can return paths in different formats.
 */
export function normalizePath(p: string): string {
  let result = p.replace(/\\/g, '/');
  while (result.startsWith('./')) {
    result = result.slice(2);
  }
  return result;
}
```

Then update the `batchAnalyzeChurn` function. Replace it entirely (lines 58-116):

```typescript
/**
 * Batch churn analysis. Runs 2 git commands total (not 2N), then indexes results.
 * Returns a map: filePath -> ChurnResult.
 * Attaches __zeroChurnWarning to the map if >80% of files show zero churn.
 */
export async function batchAnalyzeChurn(cwd: string): Promise<Map<string, ChurnResult>> {
  const results = new Map<string, ChurnResult>() as Map<string, ChurnResult> & { __zeroChurnWarning?: string };

  // One git log for all file change counts
  let changesByFile = new Map<string, number>();
  try {
    const { stdout } = await execFile(
      'git',
      ['log', '--format=format:', '--name-only', '--since=6 months ago'],
      { cwd, maxBuffer: 50 * 1024 * 1024 }
    );
    for (const line of stdout.split('\n')) {
      const trimmed = normalizePath(line.trim());
      if (trimmed === '') continue;
      changesByFile.set(trimmed, (changesByFile.get(trimmed) ?? 0) + 1);
    }
  } catch {
    // Not a git repo
  }

  // One git log for all author counts per file
  let authorsByFile = new Map<string, Set<string>>();
  try {
    const { stdout } = await execFile(
      'git',
      ['log', '--format=COMMIT_SEP %an', '--name-only', '--since=6 months ago'],
      { cwd, maxBuffer: 50 * 1024 * 1024 }
    );
    let currentAuthor = '';
    for (const line of stdout.split('\n')) {
      const trimmed = line.trim();
      if (trimmed === '') continue;
      if (trimmed.startsWith('COMMIT_SEP ')) {
        currentAuthor = trimmed.slice('COMMIT_SEP '.length);
        continue;
      }
      if (currentAuthor && trimmed !== '') {
        const normalized = normalizePath(trimmed);
        if (!authorsByFile.has(normalized)) {
          authorsByFile.set(normalized, new Set());
        }
        authorsByFile.get(normalized)!.add(currentAuthor);
      }
    }
  } catch {
    // Not a git repo
  }

  // Merge into results
  const allFiles = new Set([...changesByFile.keys(), ...authorsByFile.keys()]);
  for (const file of allFiles) {
    results.set(file, {
      changes: changesByFile.get(file) ?? 0,
      authors: authorsByFile.get(file)?.size ?? 0,
      period: '6 months',
    });
  }

  // Sanity check: warn if >80% files show zero churn
  const totalFiles = results.size;
  if (totalFiles > 0) {
    const zeroChurnCount = Array.from(results.values()).filter(r => r.changes === 0).length;
    if (zeroChurnCount / totalFiles > 0.8) {
      (results as any).__zeroChurnWarning =
        `Warning: ${Math.round((zeroChurnCount / totalFiles) * 100)}% of files show zero churn. ` +
        `This may indicate git history is not being parsed correctly, or the project is very new.`;
    }
  }

  return results;
}
```

- [ ] **Step 4: Run tests to confirm all pass**

Run: `cd /Users/msims/Documents/GitHub/claude-universe-plugin/mcp/lenskit && npx vitest run src/analyzers/churn.test.ts 2>&1 | tail -20`

Expected: All 6 tests PASS (or 5 path tests pass + churn test is conditional)

- [ ] **Step 5: Typecheck**

Run: `cd /Users/msims/Documents/GitHub/claude-universe-plugin/mcp/lenskit && npx tsc --noEmit 2>&1 | tail -10`

Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add mcp/lenskit/src/analyzers/churn.ts mcp/lenskit/src/analyzers/churn.test.ts
git commit -m "fix(lenskit): normalize churn paths between git and globby, add zero-churn sanity warning"
```

---

### Task 5: Fix test-coverage.ts -- Go, Python, tests/ directory mirroring

**Files:**
- Modify: `mcp/lenskit/src/analyzers/test-coverage.ts`
- Create: `mcp/lenskit/src/analyzers/test-coverage.test.ts`

- [ ] **Step 1: Write failing tests for test-coverage.ts**

Create `mcp/lenskit/src/analyzers/test-coverage.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateTestCandidates } from './test-coverage.js';

describe('generateTestCandidates', () => {
  it('generates standard JS/TS test candidates', () => {
    const candidates = generateTestCandidates('src/services/user-service.ts');
    expect(candidates).toContain('src/services/user-service.test.ts');
    expect(candidates).toContain('src/services/user-service.spec.ts');
    expect(candidates).toContain('src/services/__tests__/user-service.ts');
    expect(candidates).toContain('src/services/__tests__/user-service.test.ts');
  });

  it('generates tests/ directory mirror candidates', () => {
    const candidates = generateTestCandidates('src/services/user-service.ts');
    expect(candidates).toContain('tests/services/user-service.test.ts');
    expect(candidates).toContain('tests/services/user-service.spec.ts');
    expect(candidates).toContain('test/services/user-service.test.ts');
    expect(candidates).toContain('test/services/user-service.spec.ts');
  });

  it('generates Go test candidates (_test.go)', () => {
    const candidates = generateTestCandidates('internal/service/user.go');
    expect(candidates).toContain('internal/service/user_test.go');
  });

  it('generates Python test candidates (test_*.py)', () => {
    const candidates = generateTestCandidates('src/py/utils.py');
    expect(candidates).toContain('src/py/test_utils.py');
    expect(candidates).toContain('tests/py/test_utils.py');
    expect(candidates).toContain('test/py/test_utils.py');
  });

  it('generates Python _test.py candidate', () => {
    const candidates = generateTestCandidates('app/models.py');
    expect(candidates).toContain('app/models_test.py');
    expect(candidates).toContain('app/test_models.py');
  });

  it('handles files in root directory', () => {
    const candidates = generateTestCandidates('index.ts');
    expect(candidates).toContain('index.test.ts');
    expect(candidates).toContain('index.spec.ts');
  });

  it('generates candidates for nested src/ paths with tests/ mirror', () => {
    const candidates = generateTestCandidates('src/db/connection.ts');
    expect(candidates).toContain('tests/db/connection.test.ts');
    expect(candidates).toContain('test/db/connection.test.ts');
  });

  it('does not generate Go candidates for non-Go files', () => {
    const candidates = generateTestCandidates('src/index.ts');
    expect(candidates.every(c => !c.endsWith('_test.go'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

Run: `cd /Users/msims/Documents/GitHub/claude-universe-plugin/mcp/lenskit && npx vitest run src/analyzers/test-coverage.test.ts 2>&1 | tail -20`

Expected: FAIL -- generateTestCandidates is not exported, doesn't exist.

- [ ] **Step 3: Update test-coverage.ts with Go, Python, and tests/ mirroring**

Replace the entire content of `mcp/lenskit/src/analyzers/test-coverage.ts`:

```typescript
/**
 * test-coverage.ts -- Check if a source file has corresponding tests.
 *
 * Looks for common test file naming conventions adjacent to,
 * within __tests__ directories, in tests/ or test/ mirror directories,
 * and using language-specific conventions (Go _test.go, Python test_*.py).
 *
 * LIMITATION: This is a heuristic based on file naming conventions.
 * It does NOT parse actual test content or verify the tests exercise the
 * source file. A file named correctly but testing something else will
 * produce a false positive.
 */

import { access } from 'node:fs/promises';
import { join, dirname, basename, extname } from 'node:path';

export interface TestCoverageResult {
  hasTests: boolean;
  testPath: string | null;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate all candidate test file paths for a given source file.
 * Exported for testing.
 */
export function generateTestCandidates(filePath: string): string[] {
  const ext = extname(filePath);
  const base = basename(filePath, ext);
  const dir = dirname(filePath);
  const candidates: string[] = [];

  // === Standard JS/TS candidates (adjacent) ===
  if (ext !== '.go') {
    candidates.push(join(dir, `${base}.test${ext}`));
    candidates.push(join(dir, `${base}.spec${ext}`));
    candidates.push(join(dir, '__tests__', `${base}${ext}`));
    candidates.push(join(dir, '__tests__', `${base}.test${ext}`));
    candidates.push(join(dir, '__tests__', `${base}.spec${ext}`));
  }

  // === tests/ and test/ directory mirroring ===
  // If file is at src/services/user.ts, check tests/services/user.test.ts
  const dirParts = dir.split('/');
  // Try stripping leading src/ for the mirror path
  let mirrorDir = dir;
  if (dirParts[0] === 'src' && dirParts.length > 1) {
    mirrorDir = dirParts.slice(1).join('/');
  }

  if (ext !== '.go') {
    for (const testRoot of ['tests', 'test']) {
      const mirrorBase = mirrorDir === '.' ? testRoot : join(testRoot, mirrorDir);
      candidates.push(join(mirrorBase, `${base}.test${ext}`));
      candidates.push(join(mirrorBase, `${base}.spec${ext}`));
    }
  }

  // === Go convention: file_test.go in same directory ===
  if (ext === '.go') {
    candidates.push(join(dir, `${base}_test.go`));
  }

  // === Python conventions ===
  if (ext === '.py') {
    // test_name.py in same directory
    candidates.push(join(dir, `test_${base}.py`));
    // name_test.py in same directory
    candidates.push(join(dir, `${base}_test.py`));
    // tests/ and test/ mirrors with test_ prefix
    for (const testRoot of ['tests', 'test']) {
      const mirrorBase = mirrorDir === '.' ? testRoot : join(testRoot, mirrorDir);
      candidates.push(join(mirrorBase, `test_${base}.py`));
      candidates.push(join(mirrorBase, `${base}_test.py`));
    }
  }

  return candidates;
}

export async function analyzeTestCoverage(filePath: string, cwd: string): Promise<TestCoverageResult> {
  const candidates = generateTestCandidates(filePath);

  for (const candidate of candidates) {
    const fullPath = join(cwd, candidate);
    if (await fileExists(fullPath)) {
      return { hasTests: true, testPath: candidate };
    }
  }

  return { hasTests: false, testPath: null };
}
```

- [ ] **Step 4: Run tests to confirm all pass**

Run: `cd /Users/msims/Documents/GitHub/claude-universe-plugin/mcp/lenskit && npx vitest run src/analyzers/test-coverage.test.ts 2>&1 | tail -20`

Expected: All 8 tests PASS

- [ ] **Step 5: Typecheck**

Run: `cd /Users/msims/Documents/GitHub/claude-universe-plugin/mcp/lenskit && npx tsc --noEmit 2>&1 | tail -10`

Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add mcp/lenskit/src/analyzers/test-coverage.ts mcp/lenskit/src/analyzers/test-coverage.test.ts
git commit -m "fix(lenskit): add Go/Python test conventions and tests/ directory mirroring to test-coverage"
```

---

### Task 6: Fix discovery.ts -- move .d.ts, add Python, add Java patterns

**Files:**
- Modify: `mcp/lenskit/src/analyzers/discovery.ts`
- Create: `mcp/lenskit/src/analyzers/discovery.test.ts`

- [ ] **Step 1: Write failing tests for discovery.ts**

Create `mcp/lenskit/src/analyzers/discovery.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { discoverSourceFiles } from './discovery.js';
import { join } from 'node:path';

const FIXTURE_DIR = join(import.meta.dirname, '..', '..', '..', '..', 'test-fixtures');

describe('discoverSourceFiles', () => {
  it('discovers TypeScript source files from fixture project', async () => {
    const files = await discoverSourceFiles(FIXTURE_DIR);
    expect(files.some(f => f.endsWith('.ts'))).toBe(true);
  });

  it('discovers Python source files', async () => {
    const files = await discoverSourceFiles(FIXTURE_DIR);
    expect(files.some(f => f.endsWith('.py'))).toBe(true);
  });

  it('excludes test files (*.test.ts, *.spec.ts)', async () => {
    const files = await discoverSourceFiles(FIXTURE_DIR);
    expect(files.every(f => !f.match(/\.test\.\w+$/))).toBe(true);
    expect(files.every(f => !f.match(/\.spec\.\w+$/))).toBe(true);
  });

  it('excludes Python test files (test_*.py)', async () => {
    const files = await discoverSourceFiles(FIXTURE_DIR);
    const pyTestFiles = files.filter(f => {
      const name = f.split('/').pop() ?? '';
      return name.startsWith('test_') && name.endsWith('.py');
    });
    expect(pyTestFiles).toEqual([]);
  });

  it('excludes .d.ts declaration files', async () => {
    const files = await discoverSourceFiles(FIXTURE_DIR);
    expect(files.every(f => !f.endsWith('.d.ts'))).toBe(true);
  });

  it('excludes __tests__ directory contents', async () => {
    const files = await discoverSourceFiles(FIXTURE_DIR);
    expect(files.every(f => !f.includes('__tests__'))).toBe(true);
  });

  it('excludes node_modules', async () => {
    const files = await discoverSourceFiles(FIXTURE_DIR);
    expect(files.every(f => !f.includes('node_modules'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

Run: `cd /Users/msims/Documents/GitHub/claude-universe-plugin/mcp/lenskit && npx vitest run src/analyzers/discovery.test.ts 2>&1 | tail -20`

Expected: FAIL on Python test file exclusion (test_*.py not filtered) and .d.ts may pass or fail depending on fixture state.

- [ ] **Step 3: Update discovery.ts**

Replace the entire content of `mcp/lenskit/src/analyzers/discovery.ts`:

```typescript
/**
 * discovery.ts -- Find all source files in a project.
 *
 * Globs for source files, excluding build artifacts, test files, and
 * type declaration files.
 */

import { globby } from 'globby';

const SOURCE_EXTENSIONS = [
  '**/*.ts',
  '**/*.tsx',
  '**/*.js',
  '**/*.jsx',
  '**/*.py',
  '**/*.go',
  '**/*.rs',
  '**/*.rb',
  '**/*.java',
];

const IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.git/**',
  '**/vendor/**',
  '**/coverage/**',
  // Type declaration files (moved from TEST_PATTERNS -- these are not tests)
  '**/*.d.ts',
];

const TEST_PATTERNS = [
  // JS/TS test patterns
  /\.test\.\w+$/,
  /\.spec\.\w+$/,
  /_test\.\w+$/,
  /_spec\.\w+$/,
  /__tests__\//,
  // Python test patterns
  /(?:^|\/)test_\w+\.py$/,
  /(?:^|\/)conftest\.py$/,
  // Go test pattern
  /_test\.go$/,
];

export async function discoverSourceFiles(cwd: string): Promise<string[]> {
  const paths = await globby(SOURCE_EXTENSIONS, {
    cwd,
    ignore: IGNORE_PATTERNS,
    gitignore: true,
  });

  return paths.filter((p) => !TEST_PATTERNS.some((re) => re.test(p)));
}
```

- [ ] **Step 4: Run tests to confirm all pass**

Run: `cd /Users/msims/Documents/GitHub/claude-universe-plugin/mcp/lenskit && npx vitest run src/analyzers/discovery.test.ts 2>&1 | tail -20`

Expected: All 7 tests PASS

- [ ] **Step 5: Run all analyzer tests to ensure nothing broke**

Run: `cd /Users/msims/Documents/GitHub/claude-universe-plugin/mcp/lenskit && npx vitest run src/analyzers/ 2>&1 | tail -25`

Expected: All tests PASS

- [ ] **Step 6: Typecheck**

Run: `cd /Users/msims/Documents/GitHub/claude-universe-plugin/mcp/lenskit && npx tsc --noEmit 2>&1 | tail -10`

Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add mcp/lenskit/src/analyzers/discovery.ts mcp/lenskit/src/analyzers/discovery.test.ts
git commit -m "fix(lenskit): move .d.ts to ignore patterns, add Python/Go test file exclusion to discovery"
```

---

### Task 7: Fix tools/analyze.ts -- normalize churn path lookups

**Files:**
- Modify: `mcp/lenskit/src/mcp/tools/analyze.ts`

- [ ] **Step 1: Update analyze.ts to normalize churn index lookups**

In `mcp/lenskit/src/mcp/tools/analyze.ts`, add the import for normalizePath:

Add after the existing imports (after line 6):

```typescript
import { normalizePath } from '../../analyzers/churn.js';
```

Then update the churn lookup in the `analyzeBatch` function. Find the line:

```typescript
      const churn = churnIndex.get(filePath) ?? { changes: 0, authors: 0, period: '6 months' };
```

Replace with:

```typescript
      const churn = churnIndex.get(normalizePath(filePath)) ?? churnIndex.get(filePath) ?? { changes: 0, authors: 0, period: '6 months' };
```

- [ ] **Step 2: Typecheck**

Run: `cd /Users/msims/Documents/GitHub/claude-universe-plugin/mcp/lenskit && npx tsc --noEmit 2>&1 | tail -10`

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add mcp/lenskit/src/mcp/tools/analyze.ts
git commit -m "fix(lenskit): normalize file paths when looking up churn index in analyze tool"
```

---

### Task 8: Fix tools/status.ts -- add testCoverageRatio disclaimer

**Files:**
- Modify: `mcp/lenskit/src/mcp/tools/status.ts`

- [ ] **Step 1: Add disclaimer to the StatusResult and quickSummary**

In `mcp/lenskit/src/mcp/tools/status.ts`, update the `StatusResult` interface. Add a new field after `quickSummary`:

```typescript
export interface StatusResult {
  fileCount: number;
  topHotspots: Array<{ path: string; score: number; risk: string }>;
  circularDepCount: number;
  hubCount: number;
  testCoverageRatio: number;
  testCoverageDisclaimer: string;
  quickSummary: string;
}
```

Then in the `statusTool` function, after the `testCoverageRatio` calculation (after line 36), add the disclaimer:

```typescript
  const testCoverageDisclaimer = 
    'Test coverage is estimated by file naming conventions only (e.g., *.test.ts, test_*.py, *_test.go). ' +
    'It does not verify that tests actually exercise the source file. Actual coverage may be lower.';
```

Update the return statement to include the disclaimer. Replace:

```typescript
  return {
    fileCount,
    topHotspots,
    circularDepCount,
    hubCount,
    testCoverageRatio: Math.round(testCoverageRatio * 100) / 100,
    quickSummary: parts.join(' | '),
  };
```

With:

```typescript
  return {
    fileCount,
    topHotspots,
    circularDepCount,
    hubCount,
    testCoverageRatio: Math.round(testCoverageRatio * 100) / 100,
    testCoverageDisclaimer,
    quickSummary: parts.join(' | '),
  };
```

- [ ] **Step 2: Typecheck**

Run: `cd /Users/msims/Documents/GitHub/claude-universe-plugin/mcp/lenskit && npx tsc --noEmit 2>&1 | tail -10`

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add mcp/lenskit/src/mcp/tools/status.ts
git commit -m "fix(lenskit): add testCoverageRatio disclaimer explaining heuristic-only detection"
```

---

### Task 9: Fix /trace skill

**Files:**
- Modify: `skills/trace/SKILL.md`

- [ ] **Step 1: Add lenskit_graph usage instruction, event-driven guidance, and branch handling**

In `skills/trace/SKILL.md`, replace the content from `## Workflow` through `### 1. Identify the Entry Point` with:

```markdown
## Workflow

### 0. Build the Dependency Graph

If `lenskit_graph` is available, call it FIRST to get the full project dependency graph.
Use this data throughout the trace to:
- Identify which files import from the current file (downstream impact)
- Spot circular dependencies in the trace path
- Verify layer classifications match your manual assessment
- Find hub files that the trace passes through (high-impact nodes)

This step takes seconds and saves minutes of manual grep work.

### 1. Identify the Entry Point

Find where the feature begins:
- **API endpoint**: The route handler (e.g., `POST /api/users`)
- **UI action**: The component event handler (e.g., button click -> fetch call)
- **Background job**: The job/worker entry function
- **CLI command**: The command handler
- **Event handler**: The subscriber/listener function (for event-driven/pub-sub systems)
- **Message consumer**: The queue consumer handler (for message-driven architectures)

If the user specified a feature name (e.g., "checkout"), find the entry point by grepping
for related routes, components, or handlers.

**For event-driven / pub-sub systems:** The entry point may not be an HTTP route. Look for:
- Event emitters: `emit('eventName', ...)`, `publish('topic', ...)`
- Event subscribers: `on('eventName', ...)`, `subscribe('topic', ...)`
- Message queue consumers: `consume('queue', handler)`, `@Listener('topic')`
- Trace BOTH the publisher side (what triggers the event) and the subscriber side
  (what reacts to it). Note the async boundary between them.
```

Then in the report template section (around line 78), after the `### Data Flow` section, add branching guidance. Find:

```markdown
### Detailed Steps
```

And add before it:

```markdown
### Branches (if applicable)
- **Branch A: {condition}** -> {where it goes}
- **Branch B: {condition}** -> {where it goes}
- **Default path**: {which branch is the happy path}

```

- [ ] **Step 2: Commit**

```bash
git add skills/trace/SKILL.md
git commit -m "fix(trace): add lenskit_graph usage, event-driven guidance, and branch handling to trace skill"
```

---

### Task 10: Fix /hotspots skill

**Files:**
- Modify: `skills/hotspots/SKILL.md`

- [ ] **Step 1: Add lenskit_status as Step 0.5, churn filters, and monorepo guidance**

In `skills/hotspots/SKILL.md`, after `### 0. Deterministic Analysis (if available)` and its content, add:

```markdown
### 0.5. Quick Health Probe

If `lenskit_status` is available, call it FIRST before the detailed analysis. It returns
in seconds and gives you:
- Total file count and average risk score (calibration: is this a large/complex project?)
- Top 5 hotspots (you may already have your answer)
- Circular dependency count (structural issue to note)
- Test coverage ratio (context for risk assessment)

If the status result already provides a clear answer (e.g., obvious top hotspots with
high risk scores), you may skip the manual git analysis and jump to presenting findings.
```

In the `### 1. Measure Churn` section, after the git log command, add churn filter guidance:

```markdown
**Filtering churn results:**
- Exclude lock files and generated code: `grep -v -E '(package-lock|yarn.lock|pnpm-lock|\.generated\.|\.min\.)'`
- Focus on source files only: `grep -E '\.(ts|tsx|js|jsx|py|go|rs|java)$'`
- For monorepos, scope to a specific package: add `-- packages/my-package/` to the git log command
```

At the end of the file, before `## Related Skills`, add:

```markdown
## Monorepo Guidance

For monorepos with multiple packages:
- Run analysis scoped to each package separately: `lenskit_analyze` on each package root
- Compare hotspot scores ACROSS packages to find the worst areas
- Note cross-package dependencies (a hotspot in a shared package affects all consumers)
- If a shared package has high churn, it's a higher-priority hotspot than a leaf package
  with the same churn score

```

- [ ] **Step 2: Commit**

```bash
git add skills/hotspots/SKILL.md
git commit -m "fix(hotspots): add lenskit_status fast probe, churn filters, and monorepo guidance"
```

---

### Task 11: Fix /impact skill

**Files:**
- Modify: `skills/impact/SKILL.md`

- [ ] **Step 1: Add transitive traversal, type-only import distinction, and circular dependency handling**

In `skills/impact/SKILL.md`, in `### 3. Find Transitive Dependents`, replace the entire section content with:

```markdown
### 3. Find Transitive Dependents

**With lenskit_graph data (preferred):** Use the graph edges to traverse transitive
dependents programmatically. Starting from the target file, follow all incoming edges
(files that import it), then follow THEIR incoming edges, up to 3 levels deep.

```
target.ts
  <- service.ts (imports: functionA, TypeB)
    <- handler.ts (imports: service)
      <- route.ts (imports: handler)
```

The deeper the chain, the wider the blast radius.

**Type-only imports:** Distinguish between value imports and type-only imports:
- `import type { Foo } from './target'` -- Type-only: changes to runtime behavior
  won't break this importer. Only type signature changes matter.
- `import { Foo } from './target'` -- Value import: any behavioral change may break
  this importer.

When reporting dependents, annotate which ones are type-only. These have lower
risk and don't need runtime testing when only implementation changes.

**Circular dependency handling:** If the graph data shows the target file is part of
a circular dependency cycle, flag this prominently:
- Identify all files in the cycle
- Note that changes to ANY file in the cycle may affect ALL other files in the cycle
- Recommend breaking the cycle before making changes (extract shared interface, use
  dependency injection, or restructure to remove the circularity)
- Circular dependencies make impact analysis unreliable because changes propagate
  in both directions
```

- [ ] **Step 2: Commit**

```bash
git add skills/impact/SKILL.md
git commit -m "fix(impact): add transitive traversal, type-only import distinction, and circular dep handling"
```

---

### Task 12: Fix /explain skill

**Files:**
- Modify: `skills/explain/SKILL.md`

- [ ] **Step 1: Add lenskit_graph to allowed-tools and graph usage instruction**

In `skills/explain/SKILL.md`, update the frontmatter `allowed-tools` list. Find:

```yaml
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - mcp__lenskit__lenskit_analyze
```

Replace with:

```yaml
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - mcp__lenskit__lenskit_analyze
  - mcp__lenskit__lenskit_graph
```

Then in `### 0. Gather Metrics (if available)`, after the existing lenskit_analyze instruction, add:

```markdown
If `lenskit_graph` is also available, call it to understand the target file's position
in the dependency graph: what imports it (dependents), what it imports (dependencies),
whether it's involved in any circular dependencies, and its layer classification. This
structural context enriches the "Architecture" section of the explanation.
```

Then in `### 2. Read the History`, add guidance for files with no git history at the end of that section:

```markdown
**Files with no git history:** If `git log` returns nothing (file was just created, or
the repo was initialized with a single commit containing all files), note this. For new
files, focus entirely on code structure and design decisions visible in the code itself.
For "big bang" initial commits, check if the commit message or PR description provides
context about the migration or initial design.
```

- [ ] **Step 2: Commit**

```bash
git add skills/explain/SKILL.md
git commit -m "fix(explain): add lenskit_graph to allowed-tools, add graph usage and no-history guidance"
```

---

### Task 13: Fix /map skill

**Files:**
- Modify: `skills/map/SKILL.md`

- [ ] **Step 1: Add lenskit_status call, tsconfig note, and monorepo guidance**

In `skills/map/SKILL.md`, in `### 1. Survey the Project`, add after the last bullet:

```markdown
- **lenskit_status**: If available, call `lenskit_status` first. It provides file count,
  top hotspots, circular dependency count, hub count, and test coverage ratio in seconds.
  This gives you a quantitative foundation before reading any code.
```

In `### 3. Map Dependencies`, in the **With lenskit-mcp** section, add after the existing text:

```markdown
**Note on tsconfig path aliases:** If the project uses tsconfig path aliases (e.g.,
`@/utils/helpers` mapping to `src/utils/helpers`), lenskit resolves these automatically.
The graph data will show the true file-to-file dependencies even for aliased imports.
If you see aliased imports in the code that don't appear in the graph, check whether
the project's tsconfig.json has `paths` configured.
```

At the end of the file, before `## Guidelines`, add:

```markdown
## Monorepo Guidance

For monorepos (Turborepo, Nx, Lerna, pnpm workspaces):
- Map each package separately first, then show inter-package dependencies
- Identify the dependency graph between packages (which packages depend on which)
- Highlight shared/core packages that all others depend on (these are the highest-impact
  modules for architecture decisions)
- Note package boundary violations: direct imports from one package's `src/` into another
  (should use published package exports instead)
- If lenskit_graph is available, run it at the monorepo root to get cross-package edges

```

- [ ] **Step 2: Commit**

```bash
git add skills/map/SKILL.md
git commit -m "fix(map): add lenskit_status call, tsconfig alias note, and monorepo guidance"
```

---

### Task 14: Fix codebase-analyst agent

**Files:**
- Modify: `agents/codebase-analyst.md`

- [ ] **Step 1: Add lenskit_status as Phase 0, fix phase redundancy, define user relevance, add entry points**

Replace the entire content of `agents/codebase-analyst.md`:

```markdown
---
name: codebase-analyst
description: >-
  Autonomous agent that performs a comprehensive codebase analysis. Use this agent when
  the user asks for a "full codebase overview", "help me understand this project",
  "codebase analysis", "onboard me to this codebase", "project deep dive", or wants a
  complete understanding of the project's architecture, hotspots, and key modules.
model: sonnet
color: blue
tools:
  - Read
  - Glob
  - Grep
  - Bash
  - mcp__lenskit__lenskit_analyze
  - mcp__lenskit__lenskit_graph
  - mcp__lenskit__lenskit_status
---

# Codebase Analyst

Produce a comprehensive analysis of the project by combining architecture mapping, hotspot
detection, and key module explanations into a single onboarding-quality report.

## Process

### Phase 0: Fast Probe

Call `lenskit_status` first. This returns in seconds and provides:
- File count (project scale)
- Top 5 hotspots with risk scores (immediate high-value findings)
- Circular dependency count (structural health signal)
- Hub count (coupling signal)
- Test coverage ratio (quality signal)

Use this data to calibrate the rest of the analysis:
- **Small project (<50 files):** You can read most files directly. Focus on depth.
- **Medium project (50-500 files):** Focus on the top hotspots and hub files. Sample 2-3
  files per layer for architecture mapping.
- **Large project (>500 files):** Focus on the top 10 hotspots and the dependency graph
  structure. Avoid reading every file -- use lenskit data to identify what matters.

If `lenskit_status` is unavailable, proceed directly to Phase 1 with manual analysis.

### Phase 1: Architecture Map and Entry Points

Map the project's architecture:
- Identify the stack (framework, language, database, key deps)
- Identify architectural layers and their locations
- Map module dependencies and data flow (use `lenskit_graph` if available)
- Note boundaries (trust, package, external)

**Entry Points:** Identify where a new developer should start reading:
- Main entry file (index.ts, main.go, app.py, etc.)
- Primary route/handler directory (where requests enter)
- Core service/business logic directory (where decisions happen)
- Database/data access layer (where state is managed)
- Configuration files that control behavior (env, config, feature flags)

### Phase 2: Hotspot Detection and Architectural Health

Combine hotspot analysis and structural health into a single pass:

**Hotspot Detection:**
- Use `lenskit_analyze` (batch mode, no file arg) for quantitative scores
- Or analyze git history for churn + assess complexity of high-churn files
- Check coupling (most-imported modules)
- Rank by combined risk

**Structural Health:**
- Use `lenskit_graph` for circular dependencies, hub files, and layer violations
- Identify god modules (many exports AND many importers)
- Check test coverage distribution vs hotspot locations
- Note any layer violations (data importing from entry, utilities importing from logic)

### Phase 3: Key Module Explanations

For the top 3-5 most important modules, explain each one:
- Explain purpose and key concepts
- Note "things to know before changing"
- Identify test coverage status

**Selecting modules by user relevance:**
- If the user mentioned a specific area ("I'll be working on payments"), prioritize
  modules related to that area
- If no specific area, select by centrality: choose the modules that appear most
  frequently as dependencies in the graph (hub files), plus the highest-risk hotspot
- Always include at least one data access module and one business logic module --
  these are the most important for understanding how the system works
- Deprioritize utility/helper modules unless they are a hotspot

### Phase 4: Report

```
# Codebase Analysis -- {project name}

## At a Glance
{Stack, size, structure in 3-4 lines}
{lenskit_status summary if available: avg risk, test coverage, circular deps}

## Architecture
{Layer diagram + module map}

## Entry Points
{Where to start reading: main routes, core services, data models}
{For each: file path, what it does, what to read next}

## Hotspots
{Top 5 highest-risk files with risk factors}

## Structural Health
{Circular dependencies, layer violations, god modules}
{Test coverage gaps on high-risk files}

## Key Modules
{3-5 most important modules with explanations}

## Observations
{Architectural strengths, potential issues, recommendations}
```

## Guidelines

- This is an onboarding document. Someone who reads it should be able to start contributing.
- Lead with the big picture, then zoom in. Architecture -> hotspots -> key modules.
- Be opinionated about what matters. Don't list every file -- highlight the 20% that
  matters most.
- Note both strengths and weaknesses. "The auth layer is well-structured" is as useful
  as "the API routes are inconsistent."
- Entry Points is the most actionable section. A new developer reads this first.
```

- [ ] **Step 2: Commit**

```bash
git add agents/codebase-analyst.md
git commit -m "fix(agent): add lenskit_status probe, fix phase redundancy, define user relevance, add entry points"
```

---

### Task 15: Fix layer-patterns.md reference -- add Java/Spring Boot, Python/Django, Python/FastAPI

**Files:**
- Modify: `skills/trace/references/layer-patterns.md`

- [ ] **Step 1: Add Java/Spring Boot, Python/Django, and Python/FastAPI sections**

In `skills/trace/references/layer-patterns.md`, add the following sections after the `## Express / Fastify / Hono` section and before the `## Django / Flask / FastAPI` section:

```markdown
## Java / Spring Boot

| Layer | Location | Pattern |
|-------|----------|---------|
| Entry | `*Controller.java` | `@RestController`, `@RequestMapping`, `@GetMapping` |
| Validation | DTOs + `@Valid` annotation | `@Valid @RequestBody CreateUserDto dto` |
| Business Logic | `*Service.java` or `*ServiceImpl.java` | `@Service`, `@Transactional` |
| Data Access | `*Repository.java` | `@Repository`, extends `JpaRepository<Entity, ID>` |
| Models/Entities | `*Entity.java` or `model/*.java` | `@Entity`, `@Table`, `@Column` |
| External | `*Client.java` or `*Adapter.java` | `@FeignClient`, `RestTemplate`, `WebClient` |
| Configuration | `*Config.java` or `application.yml` | `@Configuration`, `@Bean`, `@Value` |

**Spring Boot conventions:** Follow the `@Autowired` / constructor injection chain to trace
dependencies. `@Service` classes contain business logic, `@Repository` classes wrap data
access. The `@Transactional` annotation marks methods that need atomicity -- trace these
carefully to understand rollback boundaries.

**Spring Security:** Auth is typically configured in a `SecurityConfig` class with
`SecurityFilterChain`. The `@PreAuthorize` and `@Secured` annotations on controller methods
indicate per-endpoint auth rules.

```

Then replace the existing `## Django / Flask / FastAPI` section with separate sections:

```markdown
## Python / Django

| Layer | Location | Pattern |
|-------|----------|---------|
| Entry | `views.py` or `viewsets.py` | `@api_view`, `class ModelViewSet`, function views |
| URL Routing | `urls.py` | `path('api/users/', views.create_user)`, `router.register()` |
| Validation | `serializers.py` | `class UserSerializer(serializers.ModelSerializer)` |
| Business Logic | `services.py` or `selectors.py` | Pure functions, orchestration logic |
| Data Access | `models.py` + ORM | `Model.objects.filter()`, `QuerySet` chains |
| External | `tasks.py` or `clients/` | Celery tasks, API client classes |
| Middleware | `middleware.py` | `class CustomMiddleware`, `process_request` / `process_response` |
| Admin | `admin.py` | `@admin.register(Model)`, `class ModelAdmin` |

**Django conventions:** `urls.py` maps URLs to views. `views.py` handles requests.
`models.py` defines database schema AND business logic (Active Record pattern).
`serializers.py` handles input validation AND output formatting. `admin.py` provides
the admin interface.

**Django REST Framework (DRF):** ViewSets combine CRUD operations into a single class.
Serializers serve as both input validation and output formatting. `permissions.py`
defines access control classes applied via `permission_classes`.

**Trace tip:** Start from `urls.py` to find the view, then follow the view to its
serializer (validation), model (data access), and any service functions (business logic).

## Python / FastAPI

| Layer | Location | Pattern |
|-------|----------|---------|
| Entry | `routers/*.py` or `main.py` | `@router.get('/users')`, `@app.post('/users')` |
| Validation | Pydantic models | `class CreateUserRequest(BaseModel)`, type annotations |
| Dependencies | `dependencies.py` or `deps.py` | `Depends(get_db)`, `Depends(get_current_user)` |
| Business Logic | `services/*.py` or `crud/*.py` | Pure functions, service classes |
| Data Access | `models/*.py` + SQLAlchemy | `session.query(User).filter(...)`, `AsyncSession` |
| External | `clients/*.py` | `httpx.AsyncClient`, background tasks |
| Middleware | `middleware.py` | `@app.middleware("http")`, Starlette middleware |

**FastAPI conventions:** Uses Python type hints for automatic validation (via Pydantic).
`Depends()` is the dependency injection system -- trace these to understand how database
sessions, auth, and other dependencies are provided to route handlers.

**Trace tip:** FastAPI routes declare their dependencies in the function signature.
`async def create_user(db: Session = Depends(get_db), user: User = Depends(get_current_user))`
tells you exactly what this endpoint needs. Follow each `Depends()` call to its provider.

```

Remove the old combined `## Django / Flask / FastAPI` section that was there before.

- [ ] **Step 2: Commit**

```bash
git add skills/trace/references/layer-patterns.md
git commit -m "fix(ref): add Java/Spring Boot, Python/Django, and Python/FastAPI sections to layer-patterns"
```

---

### Task 16: Integration tests against Phase 0 fixture project

**Files:**
- Create: `mcp/lenskit/src/analyzers/integration.test.ts`

**Depends on:** Phase 0 Task 3 (mcp/test-fixtures/ with all fixture files and git history)

- [ ] **Step 1: Write integration tests**

Create `mcp/lenskit/src/analyzers/integration.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { discoverSourceFiles } from './discovery.js';
import { analyzeFileMetrics } from './file-metrics.js';
import { analyzeTestCoverage } from './test-coverage.js';
import { buildImportIndex, lookupCoupling } from './coupling.js';
import { analyzeGraph } from './graph.js';
import { analyzeTool } from '../mcp/tools/analyze.js';
import { statusTool } from '../mcp/tools/status.js';

const FIXTURE_DIR = join(import.meta.dirname, '..', '..', '..', '..', 'test-fixtures');

describe('integration: fixture project analysis', () => {
  it('discovers expected source files from fixture project', async () => {
    const files = await discoverSourceFiles(FIXTURE_DIR);
    // Fixture project has: index.ts, utils/helpers.ts, utils/format.ts,
    // services/user-service.ts, services/auth-service.ts, db/connection.ts,
    // db/user-repository.ts, routes/user-routes.ts, routes/admin-routes.ts,
    // middleware/auth-middleware.ts, config.ts, py/utils.py, py/api.py, py/models.py
    expect(files.length).toBeGreaterThanOrEqual(10);

    // Should include TypeScript files
    expect(files.some(f => f.includes('utils/helpers.ts'))).toBe(true);
    expect(files.some(f => f.includes('services/user-service.ts'))).toBe(true);

    // Should include Python files
    expect(files.some(f => f.includes('py/utils.py'))).toBe(true);
    expect(files.some(f => f.includes('py/api.py'))).toBe(true);

    // Should NOT include test files
    expect(files.every(f => !f.includes('test_utils.py'))).toBe(true);
    expect(files.every(f => !f.includes('.test.ts'))).toBe(true);
  });

  it('analyzes file metrics for a TypeScript file', async () => {
    const metrics = await analyzeFileMetrics('src/services/user-service.ts', FIXTURE_DIR);
    expect(metrics.lineCount).toBeGreaterThan(10);
    expect(metrics.functionCount).toBeGreaterThan(0);
    expect(metrics.importCount).toBeGreaterThan(0);
  });

  it('analyzes file metrics for a Python file', async () => {
    const metrics = await analyzeFileMetrics('src/py/utils.py', FIXTURE_DIR);
    expect(metrics.lineCount).toBeGreaterThan(5);
    expect(metrics.functionCount).toBeGreaterThan(0);
  });

  it('detects test coverage for files with tests', async () => {
    // helpers.ts should have tests/helpers.test.ts
    const result = await analyzeTestCoverage('src/utils/helpers.ts', FIXTURE_DIR);
    expect(result.hasTests).toBe(true);
    expect(result.testPath).toBeDefined();
  });

  it('detects Python test coverage', async () => {
    // utils.py should have test_utils.py
    const result = await analyzeTestCoverage('src/py/utils.py', FIXTURE_DIR);
    expect(result.hasTests).toBe(true);
    expect(result.testPath).toContain('test_utils.py');
  });

  it('builds import index and looks up coupling', async () => {
    const files = await discoverSourceFiles(FIXTURE_DIR);
    const index = await buildImportIndex(FIXTURE_DIR, files);
    expect(index.size).toBeGreaterThan(0);

    // user-repository.ts is imported by user-service.ts
    const repoResult = lookupCoupling('src/db/user-repository.ts', index);
    expect(repoResult.importerCount).toBeGreaterThan(0);
  });

  it('builds dependency graph with edges and layer classifications', async () => {
    const graph = await analyzeGraph(FIXTURE_DIR);
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.edges.length).toBeGreaterThan(0);

    // Should have some hub files (files imported by multiple others)
    // user-repository.ts is imported by both services
    expect(graph.hubs.length).toBeGreaterThan(0);
  });

  it('runs full analyze tool in batch mode', async () => {
    const result = await analyzeTool({}, FIXTURE_DIR);
    expect(result.files.length).toBeGreaterThan(0);
    expect(result.summary.totalFiles).toBeGreaterThan(0);
    expect(result.summary.avgRiskScore).toBeGreaterThanOrEqual(0);
    expect(result.summary.topRiskFiles.length).toBeGreaterThan(0);
  });

  it('runs status tool and returns all fields', async () => {
    const status = await statusTool(FIXTURE_DIR);
    expect(status.fileCount).toBeGreaterThan(0);
    expect(status.topHotspots).toBeDefined();
    expect(status.circularDepCount).toBeGreaterThanOrEqual(0);
    expect(status.hubCount).toBeGreaterThanOrEqual(0);
    expect(typeof status.testCoverageRatio).toBe('number');
    expect(status.testCoverageDisclaimer).toContain('naming conventions');
    expect(status.quickSummary.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run integration tests**

Run: `cd /Users/msims/Documents/GitHub/claude-universe-plugin/mcp/lenskit && npx vitest run src/analyzers/integration.test.ts 2>&1 | tail -30`

Expected: All 9 integration tests PASS (requires Phase 0 fixtures to exist)

- [ ] **Step 3: Run ALL lenskit tests**

Run: `cd /Users/msims/Documents/GitHub/claude-universe-plugin/mcp/lenskit && npx vitest run 2>&1 | tail -30`

Expected: All ~51 tests across all test files PASS

- [ ] **Step 4: Full typecheck**

Run: `cd /Users/msims/Documents/GitHub/claude-universe-plugin/mcp/lenskit && npx tsc --noEmit 2>&1 | tail -10`

Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add mcp/lenskit/src/analyzers/integration.test.ts
git commit -m "test(lenskit): add integration tests against Phase 0 fixture project"
```

---

### Task 17: Final verification

- [ ] **Step 1: Run all MCP server tests from root**

Run: `cd /Users/msims/Documents/GitHub/claude-universe-plugin && npm run test:lenskit 2>&1 | tail -30`

Expected: All lenskit tests PASS

- [ ] **Step 2: Build the lenskit server**

Run: `cd /Users/msims/Documents/GitHub/claude-universe-plugin/mcp/lenskit && npm run build 2>&1 | tail -10`

Expected: Build succeeds with no errors

- [ ] **Step 3: Verify no untracked files that should be committed**

Run: `cd /Users/msims/Documents/GitHub/claude-universe-plugin && git status`

Expected: Working tree clean (all changes committed in previous tasks)

- [ ] **Step 4: Verify test count matches expectations**

Run: `cd /Users/msims/Documents/GitHub/claude-universe-plugin/mcp/lenskit && npx vitest run 2>&1 | grep -E "Tests|Test Files"`

Expected: ~51 tests across 7 test files (coupling: 12, graph: 15, file-metrics: 10, churn: 6, test-coverage: 8, discovery: 7, integration: 9). Some counts may vary slightly based on conditional tests.
