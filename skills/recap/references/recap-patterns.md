# Recap Patterns

Methodology for classifying commits, grouping by theme, and detecting neglect.

## Commit Classification

Classify commits by analyzing their message. Check in order — first match wins.

### Feature Commits

**Message patterns:**
- Starts with `feat:`, `feat(`, `feature:`
- Contains: "add", "implement", "introduce", "create", "new"
- Contains: "support for", "enable", "allow"

**Exclude if also contains:** "fix", "bug", "broken", "revert"

### Fix Commits

**Message patterns:**
- Starts with `fix:`, `fix(`, `bugfix:`
- Contains: "fix", "bug", "resolve", "patch", "correct", "repair"
- Contains: "issue #", "closes #", "fixes #"

### Refactor Commits

**Message patterns:**
- Starts with `refactor:`, `refactor(`
- Contains: "refactor", "restructure", "reorganize", "simplify", "extract", "split"
- Contains: "clean up", "cleanup", "improve", "optimize"

**Exclude if also contains:** "fix", "bug", "feat"

### Chore Commits

**Message patterns:**
- Starts with `chore:`, `chore(`, `build:`, `ci:`, `deps:`
- Contains: "update dep", "upgrade", "bump", "version", "config", "lint"
- File is: package.json, package-lock.json, yarn.lock, Cargo.lock, go.sum, .github/*

### Doc Commits

**Message patterns:**
- Starts with `docs:`, `doc:`
- Contains: "readme", "documentation", "changelog", "comment"
- File is: *.md, docs/*, CHANGELOG

### Ambiguous Commits

If no pattern matches clearly, classify by the FILES changed:
- Only test files → "test" (subtype of feature or fix)
- Only config files → "chore"
- Mix of source + test → "feature" (likely a feature with tests)
- Single file → check the diff: more additions = feature, more modifications = fix

## Grouping by Theme

After classification, group commits that relate to the same feature or area:

1. Group by directory — commits touching the same module are likely related
2. Group by time — commits within the same day by the same author are likely one unit of work
3. Group by message — commits referencing the same issue number or feature name

Present groups as single entries: "Added user authentication (8 commits, src/auth/)"
rather than listing 8 individual commits.

## Neglect Detection

A directory is potentially neglected if:
- It had commits in the 6 months BEFORE the recap period
- It had ZERO commits during the recap period
- It contains source files (not just config or generated code)

**Not neglected (stable):** Directories that are intentionally finished:
- Configuration that rarely changes (unless it should change — e.g., outdated config)
- Utility modules that are complete and well-tested
- Generated code directories

**Distinguish:** "No changes because it's stable" vs "no changes because it's forgotten."
Check: does the directory have open issues? Does it have TODO comments? Is it referenced
by code that IS changing? If so, it may be genuinely neglected rather than stable.

## Contributor Analysis

For the recap period, identify:
- **Active contributors:** Who committed code?
- **Focus areas:** What did each person work on? (map author → directories)
- **Knowledge concentration:** Are some areas only touched by one person? (bus factor)
- **New areas:** Did anyone start working on a part of the codebase they hadn't touched before?

Keep this brief — 2-3 sentences, not a full attribution report.

## Period Parsing

When the user specifies a recap period, parse it into git's `--since` format:

| User input | Git since value |
|-----------|----------------|
| "last sprint" | "14 days ago" |
| "this month" | First day of current month (YYYY-MM-01) |
| "since Monday" | Most recent Monday's date |
| "march" / "february" | YYYY-MM-01 to YYYY-(MM+1)-01 |
| "last 30 days" | "30 days ago" |
| ISO date | Pass through directly |

If the period is ambiguous, default to 2 weeks and note the assumption.

## Merge Commit Handling

Merge commits require special attention during classification:

- **Squash merges:** Treat the merge commit's message as the canonical classification.
  The individual commits in the branch are already summarized.
- **Non-squash merges:** The merge commit itself is typically "chore" (merge action).
  Classify the individual commits within the merge separately.
- **Detection:** Merge commits have 2+ parents. Check with `git log --merges`.
- **Avoid double-counting:** When iterating commits, decide whether to count merge
  commits OR their constituent commits, not both.
