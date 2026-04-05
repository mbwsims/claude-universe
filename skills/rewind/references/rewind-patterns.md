# Rewind Patterns

Methodology for annotating file evolution: classifying changes, writing useful annotations,
and detecting stability.

## Change Classification Rubric

When annotating changes between the historical and current version, classify each change:

### Intentional Design Decision

**Indicators:**
- Commit message references a ticket, RFC, or design doc
- Change introduces a new abstraction, pattern, or architecture
- Multiple files changed together in a coordinated way
- PR/merge commit with descriptive title

**Annotation style:** "Deliberate change: {what} for {why}. Part of {initiative/ticket}."

### Bug Fix

**Indicators:**
- Commit message starts with "fix" or references a bug
- Change adds a guard, null check, or edge case handler
- Small, focused change that doesn't alter the module's structure
- Often accompanied by a test addition

**Annotation style:** "Bug fix: {what was broken}. Fixed by {what was added}."

### Accumulated Patch

**Indicators:**
- Multiple small changes to the same area across different commits
- No single commit fully addresses the concern — each is a partial fix
- Code grows more complex without becoming more capable
- Often no test changes accompany the patches

**Annotation style:** "Accumulated patch: {n} commits modifying {area}. Each adds
{type of change} without rethinking the approach."

### Dependency-Driven

**Indicators:**
- Import statements changed
- API calls updated to match new library signatures
- Type definitions updated for new library types
- Often accompanied by package.json changes in the same commit

**Annotation style:** "Dependency update: {library} {old-version} to {new-version}.
Required changes to {what was affected}."

### Unknown

**Indicators:**
- Commit message is unhelpful ("fix", "update", "WIP")
- Change doesn't clearly fit other categories
- No PR context available

**Annotation style:** "Unknown motivation: {what changed}. Commit {hash} provides no
context. Worth investigating if this area needs modification."

## Annotation Methodology

### Selecting the Top 8-10 Changes

When a file has many changes, prioritize annotations for:
1. Changes that altered the file's public API (exports, function signatures)
2. Changes that added new dependencies (imports)
3. Changes with the largest diff (most lines added/removed)
4. Changes that introduced new control flow (branches, error handling)
5. Changes that affect the most critical code paths

### Writing Good Annotations

Each annotation should answer:
- **What:** One sentence describing the change
- **Why:** From the commit message, PR, or inference
- **Impact:** How this change affected the file's complexity or capability
- **Lines:** Rough line count change (+N / -N)

### Grouping Related Commits

Commits that form a single logical change should be grouped:
- Same author, within 24 hours, same area of the file
- Sequential commits that build on each other (Part 1/Part 2)
- A commit and its immediate "fix typo" or "fix tests" follow-up

Present grouped commits as a single annotation with all commit hashes listed.

## "What Stayed the Same" Detection

This section is as valuable as the changes — it tells the developer what's stable and
trustworthy.

### Detection Method

1. **Core function signatures:** Compare the function names and parameter lists between
   historical and current versions. Functions that exist in both with the same signature
   are stable.

2. **Import stability:** Compare import statements. Imports present in both versions
   indicate stable dependencies.

3. **Structural patterns:** If the file used a specific pattern (e.g., class hierarchy,
   functional composition, middleware chain) in both versions, that pattern is stable.

4. **Constants and configuration:** Values that haven't changed are load-bearing —
   they represent decisions that have held up.

### Presenting Stability

Frame stability as a positive finding:
- "The core {pattern/API/approach} has remained unchanged across {n} commits and {months}
  months, suggesting it's well-designed for its purpose."
- "The following {n} functions have the same signature as {months} ago: {list}. These are
  the file's stable foundation."
- "Despite {n} changes elsewhere, the {section} has been untouched — it's either well-built
  or forgotten. Check: {how to determine which}."
