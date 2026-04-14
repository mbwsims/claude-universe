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
  - mcp__timewarp__timewarp_trends
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

**Period parsing guidance:**
- Relative sprint-length periods like "last sprint" or "last 2 weeks" → `--since="14 days ago"`
- "this month" → `--since="{YYYY-MM}-01"`
- "since Monday" → calculate the most recent Monday date
- Month names ("march", "february") → `--since="{YYYY}-{MM}-01" --until="{YYYY}-{MM+1}-01"`
- Relative N-day windows like "last 7 days" or "last 30 days" → `--since="{N} days ago"`
- ISO dates ("2025-01-01") → pass through directly to `--since`

### 2. Gather History

**With timewarp-mcp (preferred):** Call `timewarp_history` with the period to get structured
commit data — counts, authors, file changes, commit classifications.

If the most active files need extra trajectory context, call `timewarp_trends` on those
files before finalizing the focus-area summary.

**Without timewarp-mcp:** Run git log manually:
```bash
git log --oneline --since="{date}" --format="%h|%an|%s" | head -200
git log --since="{date}" --format=format: --name-only | sort | uniq -c | sort -rn | head -20
```

### 3. Classify and Group

Group commits by theme using commit message analysis (see `references/recap-patterns.md`):
- **Features** — new functionality added
- **Fixes** — bugs resolved
- **Tests** — test additions or modifications without corresponding feature/fix
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
- {capability added} ({files involved})

### Fixes
- {bug eliminated} ({files involved})

### Refactors
- {structural change} ({files involved})

### Focus Areas
{Top 3-5 directories by commit count, with what happened in each}

### Neglected Areas
{Directories with zero activity that may need attention}

### Contributors
{Who worked on what — brief, not a full attribution}
```

**Save results** to `.timewarp/recap-{date}.json` with structured data for other skills
and future runs. Use this JSON schema:

```json
{
  "period": { "since": "YYYY-MM-DD", "until": "YYYY-MM-DD" },
  "commits": { "total": 0, "byClassification": { "feature": 0, "fix": 0, "test": 0, "refactor": 0, "chore": 0, "docs": 0, "other": 0 } },
  "focusAreas": [{ "directory": "src/auth/", "commits": 12, "summary": "..." }],
  "neglectedAreas": [{ "directory": "src/legacy/", "lastCommit": "YYYY-MM-DD" }],
  "contributors": [{ "name": "...", "commits": 0, "areas": ["src/auth/"] }]
}
```

> **`.timewarp/` directory:** Create the directory if it doesn't exist. Results older than
> 30 days are stale — prefer re-running the analysis over consuming old data. Other
> Timewarp skills may read these files to cross-reference findings (e.g., `/forecast`
> checks for drift data on trending files).

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
