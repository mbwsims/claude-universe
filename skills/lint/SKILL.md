---
name: lint
description: >-
  This skill should be used when the user asks to "lint instructions", "lint my CLAUDE.md",
  "check instruction quality", "review my rules", "analyze my CLAUDE.md", "find issues in my
  instructions", "improve my rules", "instruction quality", mentions "/lint", or wants to
  check the quality of their coding agent instruction files (CLAUDE.md, .cursorrules, AGENTS.md,
  .claude/rules/, .claude/agents/, .claude/skills/).
allowed-tools:
  - mcp__alignkit__alignkit_lint
  - Read
  - Glob
  - Grep
argument-hint: "[file]"
---

# Lint Instructions

Analyze instruction files for quality issues: vague rules, conflicts, redundancies, ordering
problems, misplaced rules, weak emphasis, and token budget. Then provide deep effectiveness
ratings, coverage gap detection, and consolidation suggestions.

Works out of the box with no dependencies. If the alignkit npm package is installed, analysis
is enhanced with precise token counts and exhaustive deterministic static analyzers.

## Workflow

### 1. Run Static Analysis

Call the `alignkit_lint` tool. Pass the `file` argument if the user specified one; otherwise
omit it for auto-discovery of instruction files.

If no instruction files are found, explain that the project has no CLAUDE.md or similar
files and suggest creating one.

**If `alignkit_lint` is unavailable** (MCP server not running or alignkit not installed),
perform manual analysis instead:

1. Find instruction files using Glob: `**/CLAUDE.md`, `.claude/rules/**/*.md`, etc.
2. Read each file and parse rules (lines starting with `-` or numbered items under headings)
3. Collect project context: read `package.json` for dependencies, `tsconfig.json` for config,
   list top-level directories for structure
4. Apply the analysis methodology from steps 2-5 below using this manually gathered data
5. Note to the user: "Running without alignkit — token counts are estimated. Install
   alignkit (`npm install -g alignkit`) for precise analysis and adherence tracking via `/check`."

### 2. Present the Issues Summary

Start with the quick wins (returned by the tool), then the full diagnostic breakdown.

**Report format:**

```
## Instruction Lint — {file}

{ruleCount} rules · {tokenAnalysis.tokenCount} tokens ({tokenAnalysis.contextWindowPercent}% of context)

### Quick Wins

{List each quickWin item — these are pre-prioritized and actionable}

### Issues by Type

| Issue | Count | Severity |
|-------|-------|----------|
| Vague rules | {n} | warning |
| Conflicting rules | {n} | warning |
| Redundant rules | {n} | warning |
| Ordering issues | {n} | warning |
| Placement suggestions | {n} | warning |
| Weak emphasis | {n} | warning |
| Linter-job rules | {n} | warning |
| Metadata issues | {n} | error |
```

Then list each diagnostic with the specific rule text and actionable guidance.

For placement suggestions, be specific about where the rule should move:
- `scoped-rule` → "Move to `.claude/rules/` with a glob pattern"
- `hook` → "Convert to a Claude Code hook for automated enforcement"
- `skill` → "Move to `.claude/skills/` as a reusable workflow"
- `subagent` → "Move to `.claude/agents/` as a specialized agent"

Consult `references/diagnostic-codes.md` for the full list of diagnostic codes, their
meanings, and how to advise on each.

### 3. Deep Effectiveness Analysis

Using the `projectContext` from the lint results (dependencies, tsconfig, directory tree),
rate each rule as HIGH, MEDIUM, or LOW effectiveness per the methodology in
`references/deep-analysis-guide.md`. Present only MEDIUM and LOW rules:

```
### Effectiveness Issues

| Rule | Rating | Reason |
|------|--------|--------|
| "Follow best practices" | LOW | Too vague — rewrite with specific practices |
| "Use React hooks" | LOW | No React in dependencies |
| "Handle errors properly" | LOW | Claude knows this — remove to save tokens |
| "Run vitest" | MEDIUM | Good but should specify flags: `vitest run` |
```

For each LOW rule, provide a concrete suggested rewrite or recommend removal with "REMOVE"
if the rule wastes instruction budget (e.g., things Claude already knows).

Consult `references/deep-analysis-guide.md` for detailed effectiveness evaluation methodology.

### 4. Coverage Gap Detection

Analyze the project context to identify 3-5 important behaviors NOT covered by existing rules.
See `references/deep-analysis-guide.md` for detection methodology. Each gap must reference
specific evidence from the project.

Present as:

```
### Coverage Gaps

1. **Database migrations** — Prisma is in dependencies but no rules about migration
   workflow. Suggested rule: "Run `npx prisma migrate dev` after schema changes.
   Never edit migration files directly."

2. **Test organization** — Tests exist in `__tests__/` but no rule about test
   co-location or naming. Suggested rule: "Place test files adjacent to source
   files using `*.test.ts` naming."
```

Each gap must reference specific evidence from the project (real dependency names, real
directory paths). Never suggest gaps for technologies not present.

### 5. Consolidation Opportunities

Identify groups of related rules that can merge into fewer, stronger rules to save tokens.

Look for:
- Rules that say similar things with different wording
- Rules that cover related concerns and could be combined
- Rules that are subsets of other rules

Present as:

```
### Consolidation Opportunities

1. **Merge 3 rules about imports** (~45 tokens saved)
   - "Use absolute imports"
   - "Import from index files"
   - "No circular imports"
   → **"Use absolute imports from index files. No circular dependencies."**
```

The merged text must preserve all original constraints.

## Guidelines

- Start with quick wins — these are the highest-value, lowest-effort improvements
- Be specific in rewrites — reference actual project directories, dependencies, and patterns
- Token budget matters — every rule costs context window. Flag rules that waste budget
- Placement advice is actionable — don't just say "move this" without saying where
- Coverage gaps must be evidence-based — only suggest rules for technologies actually present

## Related Skills

- **`/discover`** — Use to find conventions in the codebase that should become rules
- **`/check`** — Use to verify whether the rules are actually being followed

## Additional Resources

- **`references/diagnostic-codes.md`** — Full reference for all diagnostic codes and how to
  advise on each
- **`references/deep-analysis-guide.md`** — Detailed methodology for effectiveness ratings,
  coverage gap detection, and consolidation analysis
