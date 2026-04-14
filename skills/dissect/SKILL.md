---
name: dissect
description: >-
  This skill should be used when the user asks "when did this get complicated", "why is
  this file so complex", "how did this evolve", "complexity history", "trace the evolution",
  "what happened to this code", "dissect this file", mentions "/dissect", or wants to understand how a file or
  function became complex by tracing its evolution through git history.
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - mcp__timewarp__timewarp_history
  - mcp__timewarp__timewarp_trends
argument-hint: "[file-or-function]"
---

# Dissect

Trace the evolution of a file from simple to complex. Identify the moments where complexity
was added,
understand WHY it was added, and assess whether each layer is still necessary. Essential
for refactoring: you need to understand the history before you can safely simplify.

## Workflow

### 1. Identify Target

- **No argument:** Auto-detect. Use `timewarp_trends` (if available) to find the file with
  the steepest complexity growth. If MCP is unavailable, find the largest source file
  (by line count, excluding generated/vendor files) and dissect that.
- **With argument:** Bisect the specified file. If a function name is given, focus on that
  function's evolution within the file.

### 2. Read Current State

Read the file now. Assess:
- Total lines, function count, nesting depth
- What's the most complex section? (deepest nesting, longest function, most branches)
- Which obligations make that complexity necessary? (business rules, error handling, compatibility, etc.)

**Function-level tracking:** If a specific function was requested, isolate its evolution:
1. Find the function in the current file (by name, signature, or line range)
2. Use `git log -L :{function_name}:{file}` to get the function's commit history
3. For each structural commit, extract only the function's code at that point
4. Track the function's line count, parameter count, nesting depth, and branch count
   independently from the rest of the file

### 3. Walk the History

Find the structural commits — the ones that significantly changed the file's shape:

If `timewarp_history` is available, call it first to get the commit frequency, author mix,
and most-changed-file context before diving into raw git output.

```bash
# All commits touching this file, with stats
git log --oneline --stat --follow -- {file}
```

Filter for commits that changed the file significantly (added >20 lines, changed function
count, restructured). Ignore cosmetic commits (formatting, renames, import reordering).

For the 5-8 most significant structural commits, read the file at each point:
```bash
git show {commit}:{file}
```

**History bound:** If the file has more than 50 structural commits, focus on the 5 most
recent plus the initial creation. Note: "Full archaeology would require deeper analysis —
focused on the most recent evolution." For files older than 2 years, consider narrowing
the analysis window to the last 12 months unless the user specifically wants full history.

See `references/complexity-archaeology.md` for methodology on identifying structural vs
cosmetic commits.

### 4. Build the Evolution Timeline

For each structural commit, document:
- **What changed:** What was added, removed, or restructured
- **Why:** From the commit message, PR title, or surrounding commits
- **Complexity impact:** Did this make the file simpler or more complex?
- **Still necessary?** Is the reason for this complexity still valid?

Look for:
- Complexity that was added for a feature that was later removed (vestigial)
- Workarounds for bugs that have since been fixed upstream
- Defensive code for edge cases that may no longer exist
- Layers of abstraction added "for future use" that never materialized

### 5. Check for Cached Data

Read `.timewarp/` for existing drift or forecast data on this file. If drift data shows
this file has shifted purpose, that context helps explain the complexity — it may be complex
because it's doing things it wasn't designed for.

### 6. Present and Save

**Report format:**

```
## Bisect — {file}

**Current state:** {lines} lines, {functions} functions, max nesting depth {n}
**Created:** {date} at {lines} lines

### Evolution Timeline

| Date | Commit | Change | Why | Still needed? |
|------|--------|--------|-----|---------------|
| {date} | {hash} | Created with {n} lines, {purpose} | Initial implementation | Yes |
| {date} | {hash} | Added {feature}, +{n} lines | {commit message context} | Yes |
| {date} | {hash} | Added error handling for {case} | Bug fix #{n} | Probably |
| {date} | {hash} | Added {compatibility layer} | {reason} | No — {reason obsolete} |
| {date} | {hash} | Refactored {section} | Performance | Yes |

### Complexity Assessment

**Justified complexity:** {what complexity exists for good reasons}

**Potentially vestigial:**
- {complexity layer} added in {commit} for {reason} — reason may no longer apply because {evidence}
- ...

### Refactoring Opportunities

1. **{specific opportunity}** — {what to simplify and why it's safe}
   Estimated reduction: ~{n} lines
2. ...
```

**Save results** to `.timewarp/dissect-{sanitized-file}-{date}.json`.

> **`.timewarp/` directory:** Create the directory if it doesn't exist. Results older than
> 30 days are stale — prefer re-running the analysis over consuming old data. Other
> Timewarp skills may read these files to cross-reference findings (e.g., `/forecast`
> checks for drift data on trending files).

**Path sanitization for cache filenames:** Replace `/` with `--` and remove leading dots.
Example: `src/services/auth-service.ts` becomes `src--services--auth-service.ts`.
This prevents accidentally creating nested directories in the cache.

## Guidelines

- Focus on STRUCTURAL commits, not every commit. A file with 200 commits might have only
  8-10 that actually changed its shape. The rest are bug fixes and tweaks.
- "Still necessary?" is the highest-value column. Be honest but cautious — if you're not
  sure whether complexity is still needed, say "unclear" rather than "no."
- Don't recommend removing complexity you don't fully understand. Flag it as "worth
  investigating" and let the developer decide.
- If the file has been simple and stable throughout its history, say so. Not every file
  has a complexity story.

## Related Skills

- **`/drift`** — Understand if the file's purpose has shifted (explains WHY it got complex)
- **`/rewind`** — See a specific historical version in detail
- **lenskit `/explain`** — Explain the current code and its constraints in detail

## Additional Resources

- **`references/complexity-archaeology.md`** — Identifying structural commits, reading
  commit context, assessing whether complexity is load-bearing
