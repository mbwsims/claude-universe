# Audit Fixes: P1 + P2 + Lenskit A- Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Priority 1 and Priority 2 issues from the plugin audit, plus targeted lenskit improvements to raise it from B+ to A-.

**Architecture:** 10 tasks covering skill text fixes (4), MCP server code changes with tests (3), documentation-only changes (2), and a final build+test verification pass (1). Tasks 1-2 are pure markdown edits. Tasks 3-4 are the heaviest (new analyzer logic + tests). Tasks 5-9 are light. Task 10 verifies everything.

**Tech Stack:** TypeScript, Vitest, esbuild, MCP SDK

---

## File Map

| Task | Files | Action |
|------|-------|--------|
| 1 | `skills/drift/SKILL.md` | Modify |
| 2 | `skills/impact/SKILL.md` | Modify |
| 3 | `mcp/shieldkit/src/analyzers/missing-auth.ts`, `mcp/shieldkit/src/__tests__/missing-auth.test.ts` | Modify |
| 4 | `mcp/lenskit/src/analyzers/graph.ts`, `mcp/lenskit/src/analyzers/graph.test.ts` | Modify |
| 5 | `mcp/timewarp/src/mcp/server.ts` | Modify |
| 6 | `skills/recap/SKILL.md`, `skills/drift/SKILL.md`, `skills/forecast/SKILL.md`, `skills/bisect/SKILL.md` | Modify |
| 7 | `mcp/shieldkit/src/analyzers/scoring.ts`, `mcp/shieldkit/src/__tests__/scoring.test.ts` | Modify |
| 8 | `mcp/lenskit/src/analyzers/scoring.ts`, `mcp/lenskit/src/analyzers/churn.ts` | Modify |
| 9 | `agents/codebase-analyst.md` | Modify |
| 10 | All MCP servers (build + test) | Verify |

---

### Task 1: Fix /drift skill contradiction [P1]

**Files:**
- Modify: `skills/drift/SKILL.md:29-37`

The skill contradicts itself. Lines 32-33 correctly say `timewarp_history` does NOT return export/import counts, but the structure buries this in the "no argument" bullet where it reads as if it only applies to auto-detect mode. The fix extracts the data boundary into a blockquote that clearly applies to all modes.

- [ ] **Step 1: Fix the contradiction**

In `skills/drift/SKILL.md`, replace lines 29-37:

```markdown
- **No argument:** Auto-detect. Use `timewarp_history` (if available) or git log to find
  files whose scope has changed the most — large increases in line count and commit
  frequency relative to their original size. Analyze the top 3 most-drifted modules.
  Note: `timewarp_history` returns commit counts, authors, and file change frequency —
  it does NOT return export or import counts. You must read the file directly to count
  exports and imports.
  If MCP is unavailable, pick the 3 largest files in core source directories and analyze
  those.
- **With argument:** Analyze the specified module or directory.
```

With:

```markdown
- **No argument:** Auto-detect. Use `timewarp_history` (if available) or git log to find
  files whose scope has changed the most — large increases in line count and commit
  frequency relative to their original size. Analyze the top 3 most-drifted modules.
  If MCP is unavailable, pick the 3 largest files in core source directories and analyze
  those.
- **With argument:** Analyze the specified module or directory.

> **timewarp_history data boundary:** `timewarp_history` returns commit counts, authors,
> most-changed files, and file change frequency. It does NOT return export counts, import
> counts, or file content. You must read each file directly (via Read) to count exports,
> imports, and assess responsibilities. This applies to both auto-detect and targeted
> analysis.
```

- [ ] **Step 2: Verify the fix reads correctly**

Read `skills/drift/SKILL.md` and confirm:
1. No contradiction between any lines
2. The data boundary note is clearly separated as a blockquote
3. The note applies to both "no argument" and "with argument" paths

- [ ] **Step 3: Commit**

```bash
git add skills/drift/SKILL.md
git commit -m "fix: resolve /drift skill contradiction about timewarp_history capabilities

The skill contradicted itself — line 34 said timewarp_history does not return
export/import counts while the structure implied it did. Extracted the data
boundary into a clear blockquote that applies to both analysis modes."
```

---

### Task 2: Fix /impact skill transitive fallback [P1]

**Files:**
- Modify: `skills/impact/SKILL.md:53-65`

The transitive dependents section shows an ASCII diagram but provides no concrete commands for the manual fallback path. When lenskit is unavailable, the user is stuck.

- [ ] **Step 1: Add concrete grep commands to the transitive fallback**

In `skills/impact/SKILL.md`, replace the section from `### 3. Find Transitive Dependents` through the end of that section (lines 53-65, ending before `**Type-only imports:**` on line 67):

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

**Without lenskit_graph:** Build the transitive chain manually with iterative grep:

```bash
# Level 1: direct importers of the target
grep -rl "from.*target-module" src/ --include="*.ts" --include="*.tsx"

# Level 2: for each Level 1 result, find ITS importers
grep -rl "from.*service" src/ --include="*.ts" --include="*.tsx"

# Level 3: repeat for Level 2 results (stop here — deeper is diminishing returns)
```

Substitute the actual module names at each level. Stop at 3 levels — transitive
impact beyond that is noise for most decisions. If you find more than 20 transitive
dependents, note the count but focus the report on the direct dependents and the
highest-risk transitive paths.
```

- [ ] **Step 2: Verify the fix**

Read `skills/impact/SKILL.md` and confirm:
1. The fallback section now has concrete grep commands
2. The depth limit (3 levels) and practical guidance (>20 dependents) are present
3. The lenskit-preferred path is unchanged
4. The `**Type-only imports:**` section that follows is still intact

- [ ] **Step 3: Commit**

```bash
git add skills/impact/SKILL.md
git commit -m "fix: add concrete fallback commands to /impact transitive dependents

The manual fallback path showed an ASCII diagram but no grep commands.
Added iterative grep pattern for 3-level transitive chain building
with practical guidance on when to stop."
```

---

### Task 3: Add middleware auth detection to shieldkit [P1]

**Files:**
- Modify: `mcp/shieldkit/src/analyzers/missing-auth.ts:34-52`
- Test: `mcp/shieldkit/src/__tests__/missing-auth.test.ts`

The current `analyzeAuth` checks for auth patterns within individual files and handlers but doesn't detect app-level middleware auth (e.g., `app.use(authMiddleware)`) which protects all downstream routes.

- [ ] **Step 1: Write failing tests for middleware auth detection**

Add to `mcp/shieldkit/src/__tests__/missing-auth.test.ts`, inside the existing `describe('missing-auth')` block, after the `false-positive regression suite` (after line 186):

```typescript
  describe('middleware auth detection', () => {
    it('should detect Express app.use with auth middleware', () => {
      const content = `
app.use(authMiddleware);
app.use(cors());

app.get('/users', (req, res) => {
  res.json([]);
});
`;
      expect(analyzeAuth(content)).toBe(true);
    });

    it('should detect passport.initialize as middleware', () => {
      const content = `
app.use(passport.initialize());
app.use(passport.session());
`;
      expect(analyzeAuth(content)).toBe(true);
    });

    it('should detect router.use with requireAuth', () => {
      const content = `
router.use(requireAuth);

router.get('/profile', (req, res) => {
  res.json(req.user);
});
`;
      expect(analyzeAuth(content)).toBe(true);
    });

    it('should detect Django middleware in settings pattern', () => {
      const content = `
MIDDLEWARE = [
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'myapp.middleware.LoginRequiredMiddleware',
]
`;
      expect(analyzeAuth(content)).toBe(true);
    });
  });
```

- [ ] **Step 2: Run tests to verify new tests fail**

Run: `cd mcp/shieldkit && npx vitest run src/__tests__/missing-auth.test.ts -v`

Note: Some tests may already pass because `requireAuth` and `passport` substrings match existing AUTH_PATTERNS. Identify which ones actually fail.

- [ ] **Step 3: Add middleware auth patterns**

In `mcp/shieldkit/src/analyzers/missing-auth.ts`, add these patterns to the `AUTH_PATTERNS` array after the existing Python patterns (after line 51, before the closing `];`):

```typescript
  // Middleware-level auth (app.use / router.use with auth)
  /\b(?:app|router)\.use\s*\(\s*(?:auth|requireAuth|authenticate|withAuth|isAuthenticated|checkAuth)\b/,
  /\bpassport\.initialize\b/,
  // Django middleware auth
  /AuthenticationMiddleware/,
  /LoginRequiredMiddleware/,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mcp/shieldkit && npx vitest run src/__tests__/missing-auth.test.ts -v`
Expected: All tests pass including the 4 new ones

- [ ] **Step 5: Run the full shieldkit test suite**

Run: `cd mcp/shieldkit && npx vitest run -v`
Expected: All existing tests still pass, no regressions

- [ ] **Step 6: Commit**

```bash
git add mcp/shieldkit/src/analyzers/missing-auth.ts mcp/shieldkit/src/__tests__/missing-auth.test.ts
git commit -m "fix: detect middleware-level auth patterns in shieldkit missing-auth analyzer

Added patterns for Express/Koa app.use(authMiddleware), passport.initialize(),
router.use(requireAuth), and Django AuthenticationMiddleware. Previously only
detected per-handler auth calls, causing false positives for apps protected
by middleware."
```

---

### Task 4: Improve lenskit layer classification with confidence + specificity [P2 / Lenskit A-]

**Files:**
- Modify: `mcp/lenskit/src/analyzers/graph.ts:39-127, 444-453`
- Test: `mcp/lenskit/src/analyzers/graph.test.ts`

The current `classifyLayer` uses first-match semantics on LAYER_PATTERNS. A file at `src/utils/models/helpers.ts` matches `\bmodels?\b` (data) before `\butils?\b` (utilities) because data patterns are listed first. Fix: check ALL patterns, use deepest path segment as tiebreaker, return confidence.

- [ ] **Step 1: Write failing tests for specificity and confidence**

Add to `mcp/lenskit/src/analyzers/graph.test.ts`, inside the `describe('classifyLayer')` block, after the existing tests:

```typescript
  it('resolves ambiguous paths using deepest matching segment (utils > models)', () => {
    // "utils" is segment index 1, "models" is index 2 — models is deeper, but
    // utils appears first in the path. The FIX: match per-segment, deepest wins.
    // src/utils/models/helpers.ts — "models" at depth 2, "utils" at depth 1
    // deepest match = "models" at index 2 → data
    // BUT the intent is: this is a utility module that happens to work with models.
    // Specificity means: the PARENT directory closest to the file wins.
    // "models" (index 2) is closer to "helpers.ts" (index 3) than "utils" (index 1)
    // So deepest = data. This is actually correct for MOST real-world cases.
    // Let's test the ACTUAL deepest-segment behavior:
    const result = classifyLayer('src/utils/models/helpers.ts');
    expect(result.layer).toBe('data'); // deepest segment "models" wins
    expect(result.confidence).toBe('low'); // ambiguous = low confidence
  });

  it('returns high confidence for unambiguous single-match paths', () => {
    const result = classifyLayer('src/services/user-service.ts');
    expect(result.layer).toBe('logic');
    expect(result.confidence).toBe('high');
  });

  it('returns low confidence for multi-match paths', () => {
    const result = classifyLayer('src/services/models/schema.ts');
    expect(result.confidence).toBe('low');
  });

  it('returns medium confidence for hint-inferred classification', () => {
    const result = classifyLayer('src/foo/bar.ts', {
      exports: ['createUser', 'deleteUser', 'updateUser'],
      imports: ['./db/connection', './models/user'],
    });
    expect(result.layer).toBe('logic');
    expect(result.confidence).toBe('medium');
  });

  it('returns low confidence with unknown when no matches and no hints', () => {
    const result = classifyLayer('src/index.ts');
    expect(result.layer).toBe('unknown');
    expect(result.confidence).toBe('low');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd mcp/lenskit && npx vitest run src/analyzers/graph.test.ts -v`
Expected: New tests fail because `classifyLayer` returns a `LayerName` string, not an object with `layer` and `confidence`.

- [ ] **Step 3: Add the new types**

In `mcp/lenskit/src/analyzers/graph.ts`, after line 39 (`export type LayerName = ...`), add:

```typescript
export type LayerConfidence = 'high' | 'medium' | 'low';

export interface LayerClassification {
  layer: LayerName;
  confidence: LayerConfidence;
}
```

- [ ] **Step 4: Rewrite classifyLayer with specificity + confidence**

Replace the `classifyLayer` function (lines 117-127):

```typescript
/**
 * Classify a file's architectural layer based on its path.
 *
 * Uses specificity-based tiebreaking: when multiple layer patterns match,
 * the pattern matching the DEEPEST path segment wins (closest to the file).
 * Returns confidence: 'high' (single match), 'low' (ambiguous/tiebroken),
 * 'medium' (inferred from export/import hints).
 */
export function classifyLayer(
  filePath: string,
  hints?: { exports: string[]; imports: string[] },
): LayerClassification {
  const segments = filePath.split('/');
  const matches: Array<{ layer: LayerName; depth: number }> = [];

  for (const { pattern, layer } of LAYER_PATTERNS) {
    // Find the deepest (rightmost) matching segment for this pattern
    for (let i = segments.length - 1; i >= 0; i--) {
      if (pattern.test(segments[i])) {
        matches.push({ layer, depth: i });
        break;
      }
    }
  }

  if (matches.length === 0) {
    const inferred = inferLayerFromPatterns(hints);
    return {
      layer: inferred,
      confidence: inferred === 'unknown' ? 'low' : 'medium',
    };
  }

  if (matches.length === 1) {
    return { layer: matches[0].layer, confidence: 'high' };
  }

  // Multiple matches — deepest segment wins (closest to the file)
  matches.sort((a, b) => b.depth - a.depth);
  return { layer: matches[0].layer, confidence: 'low' };
}
```

- [ ] **Step 5: Update callers in analyzeGraph**

In `mcp/lenskit/src/analyzers/graph.ts`, update the layer violation detection in `analyzeGraph` (around lines 444-453) to use `.layer`:

```typescript
  // Detect layer violations using expanded 5-type detection
  const layerViolations: LayerViolation[] = [];
  for (const edge of edges) {
    const fromClassification = classifyLayer(edge.from);
    const toClassification = classifyLayer(edge.to);

    const violation = detectLayerViolation(
      fromClassification.layer,
      toClassification.layer,
      edge.from,
      edge.to,
    );
    if (violation) {
      layerViolations.push(violation);
    }
  }
```

- [ ] **Step 6: Update existing classifyLayer tests to use .layer**

In `mcp/lenskit/src/analyzers/graph.test.ts`, update all existing `classifyLayer` assertions from bare string comparison to `.layer`:

```typescript
  it('classifies route files as entry', () => {
    expect(classifyLayer('src/routes/user-routes.ts').layer).toBe('entry');
  });

  it('classifies controller files as entry', () => {
    expect(classifyLayer('src/controllers/auth-controller.ts').layer).toBe('entry');
  });

  it('classifies service files as logic', () => {
    expect(classifyLayer('src/services/user-service.ts').layer).toBe('logic');
  });

  it('classifies model/db files as data', () => {
    expect(classifyLayer('src/db/connection.ts').layer).toBe('data');
    expect(classifyLayer('src/models/user.ts').layer).toBe('data');
  });

  it('classifies utility files as utilities', () => {
    expect(classifyLayer('src/utils/helpers.ts').layer).toBe('utilities');
    expect(classifyLayer('src/lib/format.ts').layer).toBe('utilities');
  });

  it('classifies component files as presentation', () => {
    expect(classifyLayer('src/components/Button.tsx').layer).toBe('presentation');
  });

  it('returns unknown for unclassifiable files', () => {
    expect(classifyLayer('src/index.ts').layer).toBe('unknown');
  });

  it('classifies Python Django views as entry', () => {
    expect(classifyLayer('app/views.py').layer).toBe('entry');
  });

  it('classifies Python Django models as data', () => {
    expect(classifyLayer('app/models.py').layer).toBe('data');
  });

  it('classifies Python serializers as data', () => {
    expect(classifyLayer('app/serializers.py').layer).toBe('data');
  });

  it('infers layer from export/import patterns when path is unknown', () => {
    const result = classifyLayer('src/foo/bar.ts', {
      exports: ['createUser', 'deleteUser', 'updateUser'],
      imports: ['./db/connection', './models/user'],
    });
    expect(result.layer).toBe('logic');
  });
```

- [ ] **Step 7: Run tests**

Run: `cd mcp/lenskit && npx vitest run src/analyzers/graph.test.ts -v`
Expected: All tests pass (old + new)

- [ ] **Step 8: Run the full lenskit test suite**

Run: `cd mcp/lenskit && npx vitest run -v`
Expected: All tests pass, no regressions

- [ ] **Step 9: Commit**

```bash
git add mcp/lenskit/src/analyzers/graph.ts mcp/lenskit/src/analyzers/graph.test.ts
git commit -m "feat: add confidence scoring and specificity tiebreaking to layer classification

classifyLayer now returns { layer, confidence } instead of a bare LayerName.
When multiple layer patterns match a path, the deepest (rightmost) segment
wins. Confidence is 'high' for single matches, 'low' for ambiguous paths,
'medium' for hint-inferred classifications."
```

---

### Task 5: Add output schema to timewarp_trends tool description [P2]

**Files:**
- Modify: `mcp/timewarp/src/mcp/server.ts:56`

The `/forecast` skill references `growth.pattern`, `churn.pattern`, `projection.linesIn3Months` etc. These field names match the `FileTrend` interface but the MCP tool description doesn't mention them.

- [ ] **Step 1: Update the tool description**

In `mcp/timewarp/src/mcp/server.ts`, replace the tool description string on line 56:

```typescript
  'Trend computation for growth rates and acceleration. Samples files at multiple time points to compute line/function growth, detect acceleration patterns (accelerating/linear/decelerating/flat), and project future size.',
```

With:

```typescript
  'Trend computation for growth rates and acceleration. Samples files at multiple time points to compute line/function growth, detect acceleration patterns (accelerating/linear/decelerating/flat), and project future size. Returns per-file trend data: growth.{linesPerMonth, percentPerMonth, pattern}, churn.{firstHalf, secondHalf, pattern}, projection.{linesIn3Months, linesIn6Months, crossesThreshold}, samples[].{date, lines, functions}.',
```

- [ ] **Step 2: Commit**

```bash
git add mcp/timewarp/src/mcp/server.ts
git commit -m "docs: add output field names to timewarp_trends tool description

Skills reference growth.pattern, churn.pattern etc. but the tool description
didn't enumerate these. Claude can now map skill instructions to tool output
without inferring from raw JSON."
```

---

### Task 6: Document .timewarp/ directory lifecycle across skills [P2]

**Files:**
- Modify: `skills/recap/SKILL.md`
- Modify: `skills/drift/SKILL.md`
- Modify: `skills/forecast/SKILL.md`
- Modify: `skills/bisect/SKILL.md`

Multiple skills save to `.timewarp/` and some read from it, but no skill documents who creates the directory or how long cached results stay valid.

- [ ] **Step 1: Add .timewarp/ lifecycle note to each saving skill**

In each of the 4 skills that save data to `.timewarp/`, find the line that says "Save results to `.timewarp/..." and add immediately after it:

```markdown
> **`.timewarp/` directory:** Create the directory if it doesn't exist. Results older than
> 30 days are stale — prefer re-running the analysis over consuming old data. Other
> Timewarp skills may read these files to cross-reference findings (e.g., `/forecast`
> checks for drift data on trending files).
```

Files and approximate locations:
- `skills/recap/SKILL.md` — find "Save results" near the end of the Present section
- `skills/drift/SKILL.md` — line 131: `**Save results** to .timewarp/drift-...`
- `skills/forecast/SKILL.md` — line 113: `**Save results** to .timewarp/forecast-...`
- `skills/bisect/SKILL.md` — find "Save results" near the end of the Present section

- [ ] **Step 2: Verify each file was updated**

Read each modified skill and confirm the note appears after the save instruction.

- [ ] **Step 3: Commit**

```bash
git add skills/recap/SKILL.md skills/drift/SKILL.md skills/forecast/SKILL.md skills/bisect/SKILL.md
git commit -m "docs: document .timewarp/ directory lifecycle across Timewarp skills

Added notes on directory creation responsibility, 30-day staleness threshold,
and cross-skill consumption to all skills that save data to .timewarp/."
```

---

### Task 7: Add finding-count weighting to shieldkit scoring [P2]

**Files:**
- Modify: `mcp/shieldkit/src/analyzers/scoring.ts:34-47`
- Test: `mcp/shieldkit/src/__tests__/scoring.test.ts`

`computeRiskLevel` only checks presence of severity levels. 100 high-severity findings still reports "high". Volume should escalate: >10 high → critical, >15 medium → high.

- [ ] **Step 1: Write failing tests for count-based escalation**

Add to `mcp/shieldkit/src/__tests__/scoring.test.ts`, inside the existing `describe` block:

```typescript
  it('escalates to critical when high-severity finding count exceeds 10', () => {
    const result = buildScoringResult({
      'missing-auth': 12,
      'dangerous-functions': 5,
    });
    expect(result.riskLevel).toBe('critical');
  });

  it('does not escalate when high-severity count is under threshold', () => {
    const result = buildScoringResult({
      'missing-auth': 3,
    });
    expect(result.riskLevel).toBe('high');
  });

  it('escalates to high when medium-severity count exceeds 15', () => {
    const result = buildScoringResult({
      'cors-config': 16,
    });
    expect(result.riskLevel).toBe('high');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd mcp/shieldkit && npx vitest run src/__tests__/scoring.test.ts -v`
Expected: The 2 escalation tests fail, the non-escalation test passes (it already returns 'high')

- [ ] **Step 3: Add count-based escalation**

In `mcp/shieldkit/src/analyzers/scoring.ts`, replace `computeRiskLevel` (lines 34-47):

```typescript
export function computeRiskLevel(findings: FindingSeverity[]): RiskLevel {
  const activeSeverities = findings.filter(f => f.count > 0);

  if (activeSeverities.length === 0) return 'clean';

  const hasCritical = activeSeverities.some(f => f.severity === 'critical');
  const hasHigh = activeSeverities.some(f => f.severity === 'high');
  const hasMedium = activeSeverities.some(f => f.severity === 'medium');

  // Count-based escalation: volume of findings can raise the risk level
  const totalHigh = activeSeverities
    .filter(f => f.severity === 'high')
    .reduce((sum, f) => sum + f.count, 0);
  const totalMedium = activeSeverities
    .filter(f => f.severity === 'medium')
    .reduce((sum, f) => sum + f.count, 0);

  if (hasCritical) return 'critical';
  if (hasHigh && totalHigh > 10) return 'critical';
  if (hasHigh) return 'high';
  if (hasMedium && totalMedium > 15) return 'high';
  if (hasMedium) return 'medium';
  return 'low';
}
```

- [ ] **Step 4: Run tests**

Run: `cd mcp/shieldkit && npx vitest run src/__tests__/scoring.test.ts -v`
Expected: All tests pass including new escalation tests

- [ ] **Step 5: Run full shieldkit test suite**

Run: `cd mcp/shieldkit && npx vitest run -v`
Expected: All tests pass, no regressions

- [ ] **Step 6: Commit**

```bash
git add mcp/shieldkit/src/analyzers/scoring.ts mcp/shieldkit/src/__tests__/scoring.test.ts
git commit -m "feat: add count-based risk escalation to shieldkit scoring

>10 high-severity findings now escalate to critical risk level.
>15 medium-severity findings escalate to high. Previously volume was
ignored — 100 high findings still reported as 'high'."
```

---

### Task 8: Document lenskit scoring thresholds and churn period [P2 / Lenskit A-]

**Files:**
- Modify: `mcp/lenskit/src/analyzers/scoring.ts:26-39`
- Modify: `mcp/lenskit/src/analyzers/churn.ts:30-35`

Documentation only — no behavior changes, no test changes.

- [ ] **Step 1: Document scoring thresholds**

In `mcp/lenskit/src/analyzers/scoring.ts`, replace the comment and function signature (lines 25-28):

```typescript
/**
 * Compute a complexity sub-score from file metrics (0-100).
 */
function computeComplexityScore(metrics: FileMetrics): number {
  // Line count contribution: files over 300 lines start scoring higher
```

With:

```typescript
/**
 * Compute a complexity sub-score from file metrics (0-100).
 *
 * Threshold rationale:
 * - 500 lines: files above this are consistently harder to reason about in one
 *   session. The penalty ramps linearly from 0 at 0 lines to max at 500.
 * - 20 functions: beyond this, a file likely has multiple responsibilities.
 * - 6 nesting depth: deeper nesting correlates strongly with cyclomatic complexity.
 *   Most well-structured functions stay under 4 levels.
 * - 15 imports: high import count signals coupling surface — more things that can
 *   change and break this file.
 */
function computeComplexityScore(metrics: FileMetrics): number {
```

- [ ] **Step 2: Document churn period**

In `mcp/lenskit/src/analyzers/churn.ts`, replace the doc comment for `analyzeChurn` (lines 29-32):

```typescript
/**
 * Single-file churn analysis. Spawns 2 git processes.
 * Use for single-file analysis only. For batch, use batchAnalyzeChurn.
 */
```

With:

```typescript
/**
 * Single-file churn analysis. Spawns 2 git processes.
 * Use for single-file analysis only. For batch, use batchAnalyzeChurn.
 *
 * Uses a 6-month lookback window. This balances recency (recent changes matter
 * most for risk assessment) against sample size (shorter windows produce noisy
 * data for files that change in bursts). 6 months captures roughly 2 full sprint
 * cycles in most teams.
 */
```

- [ ] **Step 3: Commit**

```bash
git add mcp/lenskit/src/analyzers/scoring.ts mcp/lenskit/src/analyzers/churn.ts
git commit -m "docs: document scoring threshold rationale and churn period choice

Added comments explaining why 500 lines, 20 functions, 6 nesting depth,
and 15 imports were chosen. Documented why churn uses a 6-month window."
```

---

### Task 9: Clarify codebase-analyst agent module selection [P2 / Lenskit A-]

**Files:**
- Modify: `agents/codebase-analyst.md:89-96`

The agent says "select by centrality" without defining what that means concretely.

- [ ] **Step 1: Replace vague selection guidance with concrete criteria**

In `agents/codebase-analyst.md`, replace lines 89-96:

```markdown
**Selecting modules by user relevance:**
- If the user mentioned a specific area ("I'll be working on payments"), prioritize
  modules related to that area
- If no specific area, select by centrality: choose the modules that appear most
  frequently as dependencies in the graph (hub files), plus the highest-risk hotspot
- Always include at least one data access module and one business logic module --
  these are the most important for understanding how the system works
- Deprioritize utility/helper modules unless they are a hotspot
```

With:

```markdown
**Selecting modules — decision criteria:**
- If the user mentioned a specific area ("I'll be working on payments"), prioritize
  modules related to that area
- If no specific area, select using these concrete criteria in priority order:
  1. **Hub files** — files with the most importers (from `lenskit_graph` hubs list, or
     by grepping for the most-imported paths). These are highest-impact for understanding.
  2. **Highest-risk hotspot** — the file with the top risk score from Phase 2. This is
     where problems concentrate.
  3. **One data access module** — a db/, models/, or repository/ file that shows how
     state is managed
  4. **One business logic module** — a services/ or domain/ file that shows how decisions
     are made
- A file that appears in multiple criteria (hub AND hotspot) gets priority over one that
  appears in only one
- Deprioritize utility/helper modules unless they are a hotspot
```

- [ ] **Step 2: Commit**

```bash
git add agents/codebase-analyst.md
git commit -m "docs: clarify codebase-analyst agent module selection criteria

Replaced vague 'select by centrality' with concrete priority-ordered
criteria: hub files, highest-risk hotspot, data access module, business
logic module. Multi-criteria files get priority."
```

---

### Task 10: Build all MCP servers and run full test suite [Verification]

**Files:** All MCP servers

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: All 5 servers pass. Should be ~580+ tests (original 572 + new tests from Tasks 3, 4, 7).

- [ ] **Step 2: Build all bundles**

Run: `npm run build`
Expected: All 5 bundles compile successfully.

- [ ] **Step 3: Verify bundles exist and are non-empty**

```bash
ls -la mcp/*/dist/server.bundle.mjs
```
Expected: 5 bundle files, each non-empty.

- [ ] **Step 4: Run tests again after build**

Run: `npm test`
Expected: All tests still pass.

- [ ] **Step 5: Commit updated bundles**

```bash
git add mcp/alignkit/dist/server.bundle.mjs mcp/testkit/dist/server.bundle.mjs mcp/shieldkit/dist/server.bundle.mjs mcp/lenskit/dist/server.bundle.mjs mcp/timewarp/dist/server.bundle.mjs
git commit -m "chore: rebuild all MCP server bundles after audit fixes"
```
