---
name: recap
description: >-
  This skill should be used when the user asks "what happened recently", "what changed",
  "catch me up", "recap the codebase", "what landed this week", "what's been going on",
  "summarize recent changes", mentions "/recap", or wants to understand recent codebase
  activity and what areas got attention or were neglected.
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - mcp__timewarp__timewarp_history
argument-hint: "[period]"
---

# Recap

Summarize what happened in the codebase over a time period. Not a git log — an intelligent
summary: what features landed, what got fixed, what areas got attention, and what was
neglected. A developer returning from vacation runs this and is caught up in 2 minutes.

## Workflow

### 1. Determine Period

- **No argument:** Default to last 2 weeks
- **With argument:** Parse the period — "last sprint", "this month", "since Monday",
  "march", "last 30 days"

### 2. Gather History

**With timewarp-mcp (preferred):** Call `timewarp_history` with the period to get structured
commit data — counts, authors, file changes, commit classifications.

**Without timewarp-mcp:** Run git log manually:
```bash
git log --oneline --since="{date}" --format="%h|%an|%s" | head -200
git log --since="{date}" --format=format: --name-only | sort | uniq -c | sort -rn | head -20
```

### 3. Classify and Group

Group commits by theme using commit message analysis (see `references/recap-patterns.md`):
- **Features** — new functionality added
- **Fixes** — bugs resolved
- **Refactors** — structural improvements without behavior change
- **Chores** — dependency updates, config changes, CI tweaks
- **Docs** — documentation changes

For each theme, note: which areas of the codebase were involved.

### 4. Identify Focus and Neglect

- **Focus areas:** Directories/modules with the most commits. What was the team working on?
- **Neglected areas:** Directories with zero commits in the period that previously had
  activity. Are these stable or forgotten?
- **Contributor patterns:** Who worked on what? Is knowledge concentrating or spreading?

### 5. Check for Cached Results

Before presenting, check `.timewarp/` for existing results from other skills that provide
useful context — forecast data (are any changed files on concerning trajectories?), drift
reports (did recent changes worsen any drift?).

### 6. Present and Save

**Report format:**

```
## Recap — {period}

{n} commits by {n} contributors

### Features
- {feature description} ({files involved})
- ...

### Fixes
- {bug description} ({files involved})
- ...

### Refactors
- {refactor description} ({files involved})

### Focus Areas
{Top 3-5 directories by commit count, with what happened in each}

### Neglected Areas
{Directories with zero activity that may need attention}

### Contributors
{Who worked on what — brief, not a full attribution}
```

**Save results** to `.timewarp/recap-{date}.json` with structured data (commit counts,
classifications, focus areas) for other skills and future runs.

## Guidelines

- Lead with what matters: features and fixes first, chores last.
- Be opinionated about what's important. 50 dependency update commits are "dependency
  updates" in one line, not 50 entries.
- "Neglected areas" is not an accusation — frame it as "areas that may need attention"
  or "stable areas with no recent changes."
- If the project is new (< 1 month of history), say so and adjust expectations.

## Related Skills

- **`/drift`** — Check if recent changes worsened architectural drift
- **`/forecast`** — See if changed files are on concerning trajectories

## Additional Resources

- **`references/recap-patterns.md`** — Commit classification methodology and neglect detection
