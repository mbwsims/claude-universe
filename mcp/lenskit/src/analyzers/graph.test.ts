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
