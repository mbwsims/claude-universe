---
name: check-rules
description: >-
  This skill should be used when the user asks to "check adherence", "check rule adherence",
  "are my rules being followed", "is Claude following my instructions", "how effective is my
  CLAUDE.md", "rule compliance", "instruction effectiveness", "how are my rules performing",
  "which rules are being violated", "audit my rules", "check my CLAUDE.md",
  mentions "/check-rules",
  or wants to know whether their coding agent instruction rules are actually being followed
  across Claude Code sessions.
allowed-tools:
  - mcp__alignkit__alignkit_check
  - mcp__alignkit__alignkit_status
  - mcp__alignkit_local__alignkit_local_check
  - mcp__alignkit_local__alignkit_local_status
  - Read
  - Glob
  - Grep
argument-hint: "[file]"
---

# Check Adherence

Verify whether the project's instruction rules are actually being followed. Works in two modes:

- **Conformance mode** (default, no dependencies): Reads the codebase directly and checks each
  rule against the current code. Answers: "Does the code match the rules right now?"

- **Adherence mode** (with alignkit npm package): Analyzes Claude Code session history to track
  rule compliance across sessions over time, with trend data and persistent history.
  Answers: "Is Claude following the rules while working?"

## Workflow

### 1. Gather Data

Call `alignkit_local_check` first (bundled, conformance-only). For session-based adherence
tracking, also call `alignkit_check` if available. Pass the `file` argument if the user
specified one; otherwise omit it for auto-discovery. Optionally pass `since_days` to
`alignkit_check` to narrow the analysis window.

**If neither tool is available**, perform a **manual conformance check** -- verify whether
the codebase currently complies with each rule by reading the code directly.

**Conformance check procedure:**

1. Locate any instruction files present in the repo
2. Classify each rule by verification strategy:

   | Rule Type | How to Verify | Example |
   |-----------|--------------|---------|
   | **File structure** | Glob for expected paths/patterns | "Tests in `__tests__/`" → glob for test files, check locations |
   | **Import/dependency** | Grep source files for import patterns | "Use absolute imports" → grep for `../` in imports |
   | **Tool constraint** | Check config files and scripts | "Run vitest" → check package.json scripts, vitest.config |
   | **Naming convention** | List files and grep declarations | "PascalCase components" → list component files, check names |
   | **Architecture boundary** | Grep for cross-boundary imports | "No db imports in components" → grep component dir for db imports |
   | **Config requirement** | Read config files directly | "Strict TypeScript" → read tsconfig.json strict field |
   | **Style/behavioral** | Mark as Unverifiable | "Keep code clean" → cannot verify from code alone |

3. For each verifiable rule, search the codebase with Read, Glob, and Grep. Collect:
   - **Evidence count**: how many files/instances checked
   - **Compliance count**: how many comply
   - **Violations**: specific file paths and line numbers that deviate
4. Render a verdict: **Conforms**, **Violates**, or **Unverifiable**
5. Present results using the conformance report format below

**Conformance report format:**

```
## Conformance Report — {file}

{n} rules checked · {n} conform · {n} violate · {n} unverifiable

| Rule | Verdict | Evidence |
|------|---------|----------|
| "Use absolute imports" | Conforms | 0 relative imports in 34 source files |
| "Tests next to source" | Violates | 3 test files in wrong location (list below) |
| "Use meaningful names" | Unverifiable | Style rule — requires human review |

### Violations

1. **"{rule text}"** — {violation count} instances
   - `src/utils/helper.test.ts` should be `src/utils/__tests__/helper.test.ts`
   - ...

### Unverifiable Rules

{List rules that can't be checked from code alone. Suggest rewrites that would
make them verifiable, or note they require manual review.}
```

6. Note to the user: "This is a point-in-time conformance check against the current
   codebase. For tracking adherence *across sessions over time*, install alignkit
   (`npm install -g alignkit`) to unlock full `/check-rules` capabilities."

Conformance checking answers "does the code match the rules right now?" — genuinely
useful for catching drift. Session-based adherence tracking answers "is Claude following
the rules while working?" — useful for catching behavioral patterns over time.

If no sessions or history exist (tool is available but returns zero sessions), explain that
adherence tracking builds over time as the user works with Claude Code. Suggest checking
back after several sessions.

### 2. Present the Adherence Overview

Format results as a structured report. Start with a summary line, then a status breakdown,
then detailed analysis of problem areas.

**Report format:**

```
## Adherence Report — {file}

{sessionCount} sessions analyzed · {total rules} rules tracked · {overall}% adherence

| Status            | Count |
|-------------------|-------|
| Fully followed    | {n}   |
| Partial adherence | {n}   |
| Never triggered   | {n}   |
| Unresolved        | {n}   |
```

Then list rules needing attention, ordered by severity (lowest adherence first):

```
### Rules Needing Attention

1. **"{rule text}"** — {adherence}% ({followed}/{resolved} sessions)
   {One-line analysis: why it's low and what to do}

2. **"{rule text}"** — never triggered ({sessionCount} sessions)
   {Assessment: still relevant or should be removed?}
```

### 3. Evaluate Unresolved Rules

This is the core value — replacing the paid `--deep` flag. For each unresolved rule, the
`alignkit_check` response includes session action summaries: bash commands run, files written,
files edited. Examine this evidence to determine whether the rule was followed.

For each unresolved rule (evaluate the 8 with the most associated session action data):

1. Read the rule text — understand what behavior it requires
2. Examine session actions — look for evidence of compliance or violation
3. Render a verdict: **Followed**, **Violated**, or **Inconclusive**
4. Cite specific evidence supporting the verdict

Present evaluations in a clean table:

```
### Deep Evaluation — Unresolved Rules

| Rule | Verdict | Evidence |
|------|---------|----------|
| "Always run tests..." | Followed | test commands in 4/5 sessions |
| "Use strict types..." | Violated | no type-check commands found |
| "Follow naming..." | Inconclusive | style rules not observable from actions |
```

If more than 8 unresolved rules exist, prioritize the 8 highest-impact unresolved rules
(those with the most associated session action data). Note the remainder: "{N} additional
unresolved rules not evaluated in this pass -- these had less session evidence available."
Do not tell the user to run `/check-rules` again for more. The 8 with the most evidence are the
most meaningful to evaluate.

Consult `references/evaluation-guide.md` for detailed evaluation patterns and common evidence
indicators.

### 4. Recommendations

Close with 2-4 specific, actionable recommendations prioritized by impact. Reference actual
rule text in every recommendation. Avoid generic advice.

Consult `references/evaluation-guide.md` for recommendation patterns by rule outcome
(violated, never-triggered, inconclusive).

### 5. Trend (When Available)

Call `alignkit_status` (or `alignkit_local_status` if using the local server) to get summary
data. Include a trend line when the data warrants it:

```
**Trend:** {up|down|stable} over {sessionCount} sessions
```

Only include when 5+ sessions exist and the trend is **meaningful**: at least 10 percentage
points change over 5+ sessions. A shift from 72% to 74% over 6 sessions is "stable", not
"up". A shift from 65% to 78% over 5 sessions is genuinely "up".

For conformance-only mode (no session history), call `alignkit_local_status` and report the
current lint + conformance snapshot instead of a trend.

## Guidelines

- Present data honestly — if adherence is low, say so directly
- Distinguish "rule is being violated" from "rule can't be measured" — different situations
  requiring different responses
- Never fabricate evidence — if actions don't clearly indicate compliance, mark Inconclusive
- Keep the report scannable — follow the structured format consistently
- Structure the report so the summary alone conveys whether instructions are working

## Related Skills

- **`/discover`** — Use when you need to author missing conventions before auditing adherence
- **`/lint-rules`** — Use to improve the quality of rules before checking adherence

## Additional Resources

- **`references/evaluation-guide.md`** — Detailed patterns for evaluating unresolved rules,
  common evidence indicators, and edge case handling
