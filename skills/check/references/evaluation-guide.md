# Evaluation Guide — Unresolved Rules

When `alignkit_check` returns unresolved rules, it includes session action summaries for each
session: bash commands executed, files written, and files edited. Use these to determine
whether each rule was followed.

## Evidence Patterns by Rule Category

### Tool Constraint Rules

Rules that require or prohibit specific tools or commands.

**Examples:** "Always run tests before committing", "Never force push to main",
"Run lint before pushing"

**What to look for:**
- Bash commands: search for test runners (vitest, jest, pytest, cargo test, go test, npm test),
  linters (eslint, prettier, clippy), build tools (tsc, cargo build), git commands
- Command ordering: test commands should appear before git commit in the same session
- Prohibited commands: git push --force, git push -f, rm -rf, DROP TABLE

**Verdict patterns:**
- Followed: Required command found in most sessions where relevant actions occurred
- Violated: Required command absent in sessions where it should have run
- Inconclusive: Sessions too short or don't involve relevant actions

### Code Structure Rules

Rules about file organization, naming conventions, imports.

**Examples:** "Use absolute imports", "Put tests next to source files",
"Name components with PascalCase"

**What to look for:**
- Written files: check file paths for naming patterns, directory placement
- Edited files: check which files were modified together (test files alongside source)
- File extensions: .test.ts next to .ts, .spec.js next to .js

**Verdict patterns:**
- Followed: File paths consistently match the required pattern
- Violated: Files created in wrong locations or with wrong naming
- Inconclusive: Most code structure rules require reading file contents, not just paths

### Process Ordering Rules

Rules about workflow sequences.

**Examples:** "Create a plan before implementing", "Write tests before code",
"Review changes before committing"

**What to look for:**
- Bash command sequences: order of operations within a session
- File write sequences: test files created before or after source files
- Git operations: commit messages, branch creation, PR creation

**Verdict patterns:**
- Followed: Actions appear in the required order
- Violated: Actions appear out of order or required steps are missing
- Inconclusive: Session actions don't reveal enough about sequencing

### Style Guidance Rules

Rules about code style, formatting, documentation.

**Examples:** "Use meaningful variable names", "Add JSDoc to public APIs",
"Follow REST naming conventions"

**What to look for:**
- These rules are almost always Inconclusive from session actions alone
- File writes to config files (.eslintrc, .prettierrc) might indicate style tooling
- Bash commands running formatters (prettier --write, cargo fmt) indicate compliance

**Verdict patterns:**
- Typically Inconclusive — style rules are best verified by reading actual code
- Exception: if the rule is about tooling (e.g., "run prettier"), check bash commands

### Behavioral Rules

Rules about communication, process, decision-making.

**Examples:** "Ask before deleting files", "Explain changes in commit messages",
"Don't modify files outside the project"

**What to look for:**
- Git commit messages (if visible in bash output)
- File edit paths: are they all within the project directory?
- Destructive commands: rm, git reset, file overwrites

**Verdict patterns:**
- Followed: Behavioral evidence aligns with the rule
- Violated: Clear counter-evidence (files deleted without discussion, terse commits)
- Inconclusive: Most behavioral rules are hard to verify from actions

## Making Verdicts

### Threshold for "Followed"

A rule is Followed when evidence suggests compliance in the majority of relevant sessions.
A single session where the rule wasn't relevant (e.g., no tests needed in a docs-only session)
should not count as a violation.

### Threshold for "Violated"

A rule is Violated when clear counter-evidence exists in multiple sessions, or when a critical
rule is violated even once (e.g., force-pushing to main).

### When to Use "Inconclusive"

Use Inconclusive when:
- The rule concerns code quality that can't be observed from actions (naming, style, patterns)
- Sessions don't contain relevant actions to evaluate
- Evidence is ambiguous (could indicate either compliance or violation)

Do not stretch thin evidence into a Followed or Violated verdict. Honest uncertainty is more
valuable than false confidence.

## Recommendation Patterns

### For Violated Rules

Ask: is the rule impractical, or is it being ignored?

- **Impractical**: The rule asks for something that doesn't fit the actual workflow. Suggest
  rewording or scoping (e.g., "run tests before committing" → "run tests before committing
  code changes" to exclude doc-only commits).
- **Ignored**: The rule is reasonable but not being followed. Suggest adding emphasis
  (MUST/NEVER), moving it higher in the file, or converting to a hook for automated
  enforcement.

### For Never-Triggered Rules

Ask: is the rule about work that hasn't happened yet, or is it irrelevant?

- **Not yet relevant**: The rule covers a scenario that hasn't occurred in the analyzed
  sessions. Keep it but note it's untested.
- **Likely irrelevant**: The rule covers a scenario that's unlikely to occur given the
  project's actual workflow. Suggest removing to reduce token budget.

### For Inconclusive Rules

Ask: can the rule be rewritten to be more observable?

- **Yes**: Suggest a concrete rewrite. "Write clean code" → "Run eslint --fix before
  committing." The rewritten rule becomes auto-verifiable.
- **No**: Some rules are inherently subjective. Note this honestly and suggest the user
  evaluate compliance manually during code review.
