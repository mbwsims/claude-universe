---
name: rewind
description: >-
  This skill should be used when the user asks "show me the old version", "what did this
  look like before", "rewind this file", "compare to the old version", "what changed and why",
  "show me the history of this file", mentions "/rewind", or wants to see a historical
  version of a file with annotated explanations of what changed.
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - mcp__timewarp__timewarp_history
argument-hint: "<file> [period]"
---

# Rewind

Show me this code as it was, and explain what changed. Not a raw diff — an annotated
evolution that explains WHY each change was made, which changes were intentional design
decisions, and which were accumulated patches.

## Workflow

### 1. Parse Arguments

- **File is required.** If not provided, ask the user which file to rewind.
- **Period is optional.** Default: 3 months ago. Accepts: "3 months ago", "6 months ago",
  "before the auth refactor", a commit hash, a date.

### 2. Find the Historical Version

```bash
# Find the commit closest to the requested time
git log --oneline --before="{date}" -1 -- {file}

# Or if a commit hash was given, use it directly
git show {commit}:{file}
```

If the file didn't exist at the requested time, find the earliest version:
```bash
git log --oneline --diff-filter=A --follow -- {file}
```

### 3. Read Both Versions

Read the historical version and the current version. Note:
- Lines added, removed, modified
- Functions added or removed
- Imports added or removed
- Structural changes (reorganization, new classes, extracted helpers)

### 4. Annotate the Differences

For each significant change between the two versions, find the commit(s) that introduced
it and explain WHY:

```bash
# Find commits between the two points
git log --oneline {old-commit}..HEAD -- {file}
```

Classify each change:
- **Intentional design decision** — planned feature, deliberate refactor, architectural change
- **Bug fix** — correcting broken behavior (note what was broken)
- **Accumulated patch** — small fixes layered on without holistic rethinking
- **Dependency-driven** — changed because a dependency changed
- **Unknown** — commit message doesn't explain the reasoning

### 5. Present

**Report format:**

```
## Rewind — {file}

**Then:** {date/commit} ({lines} lines, {functions} functions)
**Now:** {lines} lines, {functions} functions
**Changes:** +{added} -{removed} lines across {n} commits

### Summary
{2-3 sentences: what's fundamentally different and why}

### Key Changes

1. **{Change description}** (commit {hash}, {date})
   Type: {design decision / bug fix / accumulated patch / dependency-driven}
   Why: {from commit message / PR context / inferred}
   Lines: +{n} -{n}

2. **{Change description}** ...

### What Stayed the Same
{What hasn't changed — core API, fundamental approach, key abstractions.
This is useful for understanding what's stable vs volatile.}

### Observations
{Any patterns: "most changes are bug fixes in the validation logic, suggesting
it's under-tested" or "the core algorithm hasn't changed, just the interfaces around it"}
```

## Guidelines

- Annotate the IMPORTANT changes, not every single diff line. Group related changes
  (multiple commits fixing the same bug) into single entries.
- "Unknown" is an honest annotation. If the commit message says "fix" with no context,
  don't fabricate an explanation.
- "What Stayed the Same" is as valuable as what changed — it tells the developer what
  they can trust as stable.
- If very little changed, say so. "This file is remarkably stable — 3 minor fixes in
  6 months" is a useful finding.

## Related Skills

- **`/bisect`** — For deeper analysis of HOW a specific complexity layer was added
- **lenskit `/explain`** — For understanding the current code in full context
