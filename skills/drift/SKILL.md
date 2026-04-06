---
name: drift
description: >-
  This skill should be used when the user asks "has this module drifted", "is this code
  still doing what it was designed for", "scope creep analysis", "architectural drift",
  "what was this originally for", "how has this changed over time", mentions "/drift",
  or wants to detect when code has quietly evolved away from its original purpose.
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - mcp__timewarp__timewarp_history
  - mcp__timewarp__timewarp_trends
argument-hint: "[module-or-directory]"
---

# Drift

Detect architectural drift — when code quietly evolves away from its original purpose.
A utility module that accumulated business logic. A handler that grew a database layer.
A focused service that became a god object. Drift is invisible in any single commit but
obvious when you compare the first version to the current one.

## Workflow

### 1. Identify Target

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

### 2. Understand What It IS (Current State)

Read the current code. Document:
- **Purpose now:** What does this module currently do?
- **Exports:** What does it expose? How many functions/classes/types?
- **Imports:** What does it depend on? How many external dependencies?
- **Responsibilities:** List the distinct concerns it handles
- **Size:** Line count, function count

### 3. Understand What It WAS (Original State)

Use git to find the earliest meaningful version:

```bash
# Find the first commit that created/significantly shaped this file
git log --oneline --diff-filter=A --follow -- {file}
git log --oneline --reverse --follow -- {file} | head -5
```

Read the file at that early commit:
```bash
git show {early-commit}:{file}
```

Document the same attributes: purpose, exports, imports, responsibilities, size.

### 4. Measure the Drift

Compare original vs current across dimensions (see `references/drift-patterns.md`):

| Dimension | Original | Current | Drift |
|-----------|----------|---------|-------|
| Purpose | {original purpose} | {current purpose} | {shifted/same} |
| Exports | {n} | {n} | {growth %} |
| Imports | {n} | {n} | {growth %} |
| Responsibilities | {n} | {n} | {scope creep?} |
| Lines | {n} | {n} | {growth %} |

Classify the drift type:
- **Scope creep** — took on responsibilities beyond its original purpose
- **Layer violation** — crossed architectural boundaries (utility became service)
- **God module** — became a catch-all that does too many things
- **Purpose shift** — original purpose is gone, replaced by something different

### 5. Identify Key Drift Commits

Find the commits that shifted the boundary:
```bash
git log --oneline --stat --follow -- {file}
```

Look for commits with large diffs that added new concerns rather than extending existing
ones. For the top 3-5 drift commits, note WHAT was added and WHY (from commit message).

### 6. Check for Cached Data

Read `.timewarp/` for existing forecast or trend data on this module. If forecast shows
this module's complexity is accelerating, note it — drift + growth acceleration is a
strong signal that intervention is needed.

### 7. Present and Save

**Report format:**

```
## Drift Report — {module}

**Drift Level: {Significant / Moderate / Minimal}**

### Then vs Now

| Dimension | Original ({date}) | Current | Change |
|-----------|-------------------|---------|--------|
| Purpose | {description} | {description} | {shifted/same} |
| Exports | {n} | {n} | +{n}% |
| Imports | {n} | {n} | +{n}% |
| Lines | {n} | {n} | +{n}% |

### Drift Type
{Classification: scope creep / layer violation / god module / purpose shift}
{Explanation of how and why}

### Key Drift Commits
1. **{hash}** ({date}) — {what was added and why}
2. **{hash}** ({date}) — {what was added and why}
3. ...

### Recommendations
- {Specific recommendation: split, refactor, accept and document, etc.}
- {If forecast data exists: trend context}
```

**Save results** to `.timewarp/drift-{module}-{date}.json`.

> **`.timewarp/` directory:** Create the directory if it doesn't exist. Results older than
> 30 days are stale — prefer re-running the analysis over consuming old data. Other
> Timewarp skills may read these files to cross-reference findings (e.g., `/forecast`
> checks for drift data on trending files).

### Cross-Kit Degradation

When `timewarp_history` is unavailable, degrade gracefully:
1. Use `git log --oneline --stat` to identify files with the most commits
2. Use `git log --reverse --follow -- {file}` to find the first version
3. Read the file at the earliest commit via `git show {hash}:{file}`
4. Count exports, imports, lines, and responsibilities manually from the file content
5. All drift classification and quantification works identically — only the data
   gathering step changes

## Guidelines

- Drift is not always bad. A module that grew because the domain grew is natural evolution.
  Only flag drift where the module is doing things it shouldn't — things that belong elsewhere.
- Compare against the ORIGINAL purpose, not your idea of what it should be. The code's
  history tells you what it was designed for.
- Include the key commits that caused drift — this tells the user WHO made these decisions
  and WHY, which is essential context for deciding whether to reverse them.
- If a module has barely changed since creation, say so. "Minimal drift — this module is
  doing what it was designed for" is a valuable finding.

## Related Skills

- **`/dissect`** — Trace when specific complexity was added to a drifted module
- **`/forecast`** — See if the drift is accelerating
- **lenskit `/map`** — Understand where the module fits in the architecture

## Additional Resources

- **`references/drift-patterns.md`** — Common drift types with detection strategies
