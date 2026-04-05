---
name: hotspots
description: >-
  This skill should be used when the user asks to "find hotspots", "what are the riskiest
  files", "where do bugs hide", "churn analysis", "which files change most", "find risky
  code", "technical debt hotspots", mentions "/hotspots", or wants to identify the highest-risk
  areas of their codebase based on change frequency, complexity, and coupling.
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - mcp__lenskit__lenskit_analyze
  - mcp__lenskit__lenskit_status
  - mcp__lenskit__lenskit_graph
argument-hint: "[directory]"
---

# Hotspots

Find the riskiest files in the codebase — the ones where bugs are most likely to hide.
Risk correlates with: high change frequency (churn), high complexity, many dependencies,
and multiple authors.

A file that changes every week, has 500 lines of complex logic, and is imported by 20
other files is a ticking time bomb. This skill finds those files.

## Workflow

### 0. Deterministic Analysis (if available)

If `lenskit_analyze` is available, call it without a file argument to get project-wide
metrics — churn, complexity, coupling, and risk scores for all source files. Use these
as the foundation for hotspot ranking, supplementing with qualitative assessment.

If unavailable, perform full manual analysis as described below.

### 0.5. Quick Health Probe

If `lenskit_status` is available, call it FIRST before the detailed analysis. It returns
in seconds and gives you:
- Total file count and average risk score (calibration: is this a large/complex project?)
- Top 5 hotspots (you may already have your answer)
- Circular dependency count (structural issue to note)
- Test coverage ratio (context for risk assessment)

If the status result already provides a clear answer (e.g., obvious top hotspots with
high risk scores), you may skip the manual git analysis and jump to presenting findings.

### 1. Measure Churn

Use git history to find files that change most frequently:

```bash
git log --format=format: --name-only --since="6 months ago" | sort | uniq -c | sort -rn | head -30
```

This gives the top 30 most-changed files in the last 6 months. High churn = high risk.

**Filtering churn results:**
- Exclude lock files and generated code: `grep -v -E '(package-lock|yarn.lock|pnpm-lock|\.generated\.|\.min\.)'`
- Focus on source files only: `grep -E '\.(ts|tsx|js|jsx|py|go|rs|java)$'`
- For monorepos, scope to a specific package: add `-- packages/my-package/` to the git log command

Also check for files with many different authors (indicates shared/critical code):

```bash
git log --format='%an' --since="6 months ago" -- {file} | sort -u | wc -l
```

### 2. Measure Complexity

For each high-churn file, assess complexity:
- **Line count**: Files over 300 lines are harder to reason about
- **Function count**: Files with many exported functions have broad surface area
- **Nesting depth**: Deeply nested conditionals indicate complex logic
- **Cyclomatic complexity**: Count decision points (if, switch, ternary, catch, &&, ||)

Read the file and make a qualitative assessment if quantitative tools aren't available.

### 3. Measure Coupling

For each high-churn file, check how many other files depend on it:

```bash
grep -rl "from.*{module-name}" src/ | wc -l
```

High import count = wide blast radius. Changes to this file affect many others.

### 4. Score and Rank

Combine the signals into a risk score:

| Signal | Weight | Why |
|--------|--------|-----|
| Churn (changes/month) | High | Files that change often have more opportunities for bugs |
| Complexity (lines, nesting) | High | Complex code is harder to change safely |
| Coupling (dependents) | Medium | High-coupling amplifies the impact of bugs |
| Authors (distinct contributors) | Low | Many authors = inconsistent patterns |

Rank files by combined risk. The top 5-10 are the hotspots.

**Amplify with graph data:** If `lenskit_graph` is available, check whether any hotspot
is also a hub file (high importer count) or part of a circular dependency. Hub status
amplifies risk — a complex, high-churn file that 15 other files depend on is a higher
priority than one with zero importers.

### 5. Present Findings

**Report format:**

```
## Hotspots — {project}

Analyzed {n} files over {timeframe}

### Top Hotspots

| Rank | File | Churn | Size | Dependents | Risk |
|------|------|-------|------|------------|------|
| 1 | src/lib/auth.ts | 24 changes | 342 lines | 18 importers | Critical |
| 2 | src/app/api/orders/route.ts | 19 changes | 287 lines | 3 importers | High |
| 3 | ... |

### Hotspot Details

**#1: src/lib/auth.ts** — Critical Risk
- Changed 24 times in 6 months by 4 different authors
- 342 lines with 12 exported functions
- Imported by 18 other files
- Suggestion: This file does too much. Consider splitting auth verification,
  session management, and token handling into separate modules.

**#2: src/app/api/orders/route.ts** — High Risk
- ...

### Cool Spots (Low Risk, Stable)
{Note 2-3 files that are stable, simple, and well-isolated — positive examples}
```

## Monorepo Guidance

For monorepos with multiple packages:
- Run analysis scoped to each package separately: `lenskit_analyze` on each package root
- Compare hotspot scores ACROSS packages to find the worst areas
- Note cross-package dependencies (a hotspot in a shared package affects all consumers)
- If a shared package has high churn, it's a higher-priority hotspot than a leaf package
  with the same churn score

## Related Skills

- **`/impact`** — Check blast radius before touching a hotspot
- **`/map`** — Understand overall architecture context

## Guidelines

- Focus on source files, not config or generated files. Filter out `node_modules/`,
  `package-lock.json`, migration files, etc.
- A file that changes often but is small and simple (e.g., `constants.ts`) is not a
  hotspot. Churn alone is not risk — churn x complexity is.
- Include "cool spots" — stable, well-structured files that are positive examples.
  This makes the report balanced and gives the team good patterns to follow.
- If git history is short (new project), note this and focus on complexity/coupling instead.
