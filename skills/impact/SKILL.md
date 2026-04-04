---
name: impact
description: >-
  This skill should be used when the user asks to "check the impact", "what will break if
  I change this", "blast radius", "impact analysis", "what depends on this", "who imports
  this", "is it safe to change this", mentions "/impact", or wants to understand the
  consequences of modifying a specific file or function before making changes.
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - mcp__lenskit__lenskit_graph
  - mcp__lenskit__lenskit_analyze
argument-hint: "[file]"
---

# Impact Analysis

Before changing a file, understand the blast radius. What depends on it? What tests cover
it? What breaks if you change its API? This skill prevents the "I changed one file and
broke 12 others" problem.

## Workflow

### 1. Identify the Target

Read the target file. Understand what it exports:
- Functions, classes, types, constants
- Default export vs named exports
- What interface does it expose to consumers?

### 2. Find Direct Dependents

**With lenskit-mcp (preferred):** Call `lenskit_graph` to get the full dependency graph.
Extract direct and transitive dependents from the graph data. Also call `lenskit_analyze`
on the target file for metrics (churn, complexity, coupling).

**Without lenskit-mcp:** Grep manually:

Grep for files that import from the target:

```bash
grep -rl "from.*{module-path}" src/
```

For each importer, note WHAT they import (which specific exports they use).

### 3. Find Transitive Dependents

For each direct dependent, check if IT is imported by other files. Build a dependency
chain up to 3 levels deep:

```
target.ts
  ← service.ts (imports: functionA, TypeB)
    ← handler.ts (imports: service)
      ← route.ts (imports: handler)
```

The deeper the chain, the wider the blast radius.

### 4. Find Test Coverage

Search for tests that cover the target file:
- Direct test file: `{name}.test.ts`, `{name}.spec.ts`
- Tests that import the target
- Integration tests that exercise the target indirectly

Note: if there are NO tests covering the target, that's a critical finding — changes
are unprotected.

### 5. Assess Risk by Export

For each export from the target file:

| Export | Importers | Tests | Risk |
|--------|-----------|-------|------|
| `functionA` | 8 files | 3 tests | High — widely used, partially tested |
| `TypeB` | 12 files | N/A (type) | Medium — type change affects many files |
| `CONSTANT_C` | 2 files | 0 tests | Low — few users, but untested |

### 6. Present the Analysis

**Report format:**

```
## Impact Analysis — {file}

### Exports
{List of everything this file exports}

### Dependency Graph

{file}
  ← {n} direct importers
    ← {n} transitive (2 levels deep)

### Direct Dependents

| File | Imports | Has Tests |
|------|---------|-----------|
| src/api/handler.ts | functionA, TypeB | Yes |
| src/lib/service.ts | functionA | No |
| ... |

### Test Coverage
- Direct tests: {file or "none"}
- Tests importing this file: {count}
- Untested dependents: {list}

### Risk Assessment

**Safe to change:**
- Internal implementation (no API change) — {n} dependents unaffected
- TypeB (only used as type annotation) — compile-time check catches issues

**Risky to change:**
- functionA signature — 8 files depend on current API, 3 are untested
- Default export — if renamed, all {n} importers break

### Recommendations
{What to do before making changes: add tests, update dependents, etc.}
```

## Related Skills

- **`/hotspots`** — Check if the file is already a high-risk area
- **`/explain`** — Deep understanding of a module before changing it

## Guidelines

- Be specific about WHAT each dependent imports. A file that only imports a type is less
  affected than one that calls a function.
- Note the difference between implementation changes (safe — internal logic, same API)
  and interface changes (risky — signature, return type, behavior change).
- If the file has zero dependents, it's a leaf node — changes are safe by default.
- If the file has zero test coverage, flag this prominently. Any change to untested code
  is higher risk.
