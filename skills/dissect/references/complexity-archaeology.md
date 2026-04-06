# Complexity Archaeology

Methodology for tracing how files became complex: identifying structural commits, reading
commit context, and assessing whether complexity is still load-bearing.

## Identifying Structural Commits

Not every commit matters. A file with 200 commits might have 8-10 that actually changed
its shape. The rest are bug fixes, formatting, and tweaks.

### Structural (analyze these)

A commit is structural if it:
- Added or removed functions/classes/methods
- Changed the number of parameters on a public function
- Added a new dependency (import)
- Introduced a new branching pattern (new if/switch/match blocks)
- Added a new error handling layer (try/catch, Result type)
- Extracted or inlined code (moved between files)
- Changed the module's public API (exports)

**Detection:** Look at `git log --stat` — structural commits tend to have a high ratio of
additions to deletions (adding new code) or balanced adds/deletes (restructuring). Pure
additions of 50+ lines are almost always structural. Use 50 lines as the threshold for
identifying structural commits (consistent with dissect skill's filter of >20 lines for
"significant" and 50+ lines for "almost always structural").

### Cosmetic (skip these)

A commit is cosmetic if it:
- Only changes formatting, whitespace, or indentation
- Only renames variables without changing logic
- Only reorders imports or sorts declarations
- Only updates comments or documentation
- Only changes string literals or messages

**Detection:** Small diffs (< 10 lines changed) or diffs where every change is on the same
type of line (all import lines, all comment lines).

Additionally, always exclude these files from complexity analysis:
- Binary files (images, compiled output, fonts)
- Lock files (package-lock.json, yarn.lock, Cargo.lock, go.sum, poetry.lock)
- Generated files (*.min.js, *.bundle.js, migrations with timestamps)
- These files can have large diffs but carry no architectural signal

### Ambiguous

Bug fixes can be structural or cosmetic:
- Adding a null check: cosmetic (1 line, doesn't change architecture)
- Adding an entire error handling path: structural (new code flow)
- Wrapping code in try/catch: structural (changes control flow)

When ambiguous, include the commit if the diff is > 10 lines.

## Reading Commit Context

### From the Commit Message

Good commit messages tell you WHY:
- "Add rate limiting to prevent abuse" → security requirement
- "Extract email service from user controller" → architectural cleanup
- "Support bulk operations for admin dashboard" → feature requirement

Poor commit messages require inference:
- "fix" → look at the diff to understand what was broken
- "update" → look at what changed to infer the motivation
- "WIP" → this was rushed; the complexity may be accidental

### From Surrounding Commits

If the commit message is unhelpful, check:
- The commits immediately before and after (same branch of work?)
- Whether a PR or merge commit wraps this commit (PR title is often more descriptive)
- Whether an issue number is referenced anywhere in the branch

### From the Diff Itself

The diff tells you WHAT even when the message doesn't tell you WHY:
- New imports suggest new capabilities (database → now does data access)
- New error types suggest new failure modes being handled
- New parameters suggest the function's contract expanded
- New branches (if/else) suggest new cases being handled

## Assessing Load-Bearing Complexity

For each layer of complexity, ask: is this still necessary?

### Definitely Load-Bearing

- Complexity that handles known edge cases with comments explaining them
- Error handling for errors that still occur (check: is the error type still thrown?)
- Business rules that match current product requirements
- Performance optimizations with benchmarks or production metrics justifying them
- Security checks (auth, validation, sanitization) — these are almost always load-bearing

### Potentially Vestigial

- Workarounds for library bugs that may be fixed in newer versions
  Check: has the dependency been updated since this workaround was added?
- Compatibility code for old API versions that may no longer be supported
  Check: is the old API version still in use?
- Feature flags for features that are fully shipped
  Check: is the flag still configurable, or always on?
- Defensive code for "impossible" states that may actually be impossible
  Check: can you find any code path that triggers this condition?
- Abstraction layers added "for future flexibility" that never got used
  Check: is there more than one implementation of the abstraction?

### Unknown (Flag for Investigation)

- Complexity with no comments and unclear commit messages
- Code that looks unnecessary but might handle a subtle edge case
- Defensive programming that might be needed but might be paranoia

For unknown complexity, recommend investigation rather than removal:
"This error handling was added in commit {hash} but the commit message doesn't explain why.
Worth investigating whether the error condition can still occur."

## Refactoring Signals

After the archaeology is complete, look for these patterns that suggest refactoring is safe:

1. **Vestigial complexity > 20% of file** — significant dead weight worth removing
2. **Multiple independent concerns** — the file does 3+ unrelated things (split candidate)
3. **Complexity concentrated in one function** — one 100-line function in a 200-line file
   (extract candidate)
4. **Layers of workarounds** — patches on patches suggest the original design doesn't fit
   the current requirements (redesign candidate)
5. **All complexity from one period** — added in a rush (e.g., one week, many commits) and
   may not have been well-designed (review candidate)
