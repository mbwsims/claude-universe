---
name: orbit
description: >-
  This skill should be used when the user asks to "review the whole project", "full project
  review", "audit everything", "orbit the project", "orbit security and tests", "quick orbit",
  "run all agents", "check everything", "review security and tests together", "review my PR",
  "is my PR ready", "check my branch", "pr review", "orbit pr", mentions "/orbit" or "/orbit pr",
  or wants a combined assessment across any combination of security, tests, code quality,
  evolution, and instructions. Supports PR mode for diff-aware branch analysis, scoping to
  specific areas, and quick mode for fast MCP-only health checks.
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Agent
  - mcp__shieldkit__shieldkit_status
  - mcp__shieldkit__shieldkit_scan
  - mcp__shieldkit__shieldkit_surface
  - mcp__testkit__testkit_status
  - mcp__testkit__testkit_map
  - mcp__testkit__testkit_analyze
  - mcp__lenskit__lenskit_status
  - mcp__lenskit__lenskit_analyze
  - mcp__lenskit__lenskit_graph
  - mcp__timewarp__timewarp_history
  - mcp__timewarp__timewarp_trends
  - mcp__alignkit_local__alignkit_local_status
  - mcp__alignkit_local__alignkit_local_lint
  - mcp__alignkit_local__alignkit_local_check
argument-hint: "[pr [--base branch] | quick | deep] [scope: all|security|tests|code|evolution|instructions]"
---

# Orbit

High-altitude sweep of the project. Dispatches agents in parallel across selected areas,
collects results, and synthesizes a unified report with cross-cutting observations.

## Argument Parsing

Parse the user's input to determine **mode** and **scope**:

**Mode** — check keywords in this order:
- `pr` keyword present → **PR mode** (diff-aware branch analysis — see PR Mode below)
- `deep` keyword present → **Deep mode** (full agent dispatch, ~5-15 minutes)
- `quick` keyword present → **Quick mode** (status tools only, ~10 seconds)
- No mode keyword → **Standard mode** (default: status + primary analysis tools, ~30-60 seconds)

**The three modes:**

| Mode | What it runs | How long | Answers |
|------|-------------|----------|---------|
| Quick | Status tools only (one per area) | ~10 sec | "Is anything broken?" |
| Standard (default) | Status + primary analysis tools per area | ~30-60 sec | "What should I know?" |
| Deep | All 5 agents in parallel with full phases | ~5-15 min | "Comprehensive audit" |

Standard is the daily-driver default — it produces real findings without the overhead
of agent dispatch. Use Quick for a 10-second glance. Use Deep when you want the full
audit with cross-cutting observations.

**PR mode arguments** (only when `pr` detected):
- `--base {branch}` → compare against that branch instead of `main`
- `quick` → MCP-only fast scan, skip deep analysis on flagged items
- Scope keywords are **ignored** in PR mode — it checks all systems based on file type

**Scope** (for Quick, Standard, and Deep modes) — match any of these keywords (multiple allowed):

| Keyword | Aliases | Quick (1 tool) | Standard (2-3 tools) | Deep (agent) |
|---------|---------|---------------|---------------------|--------------|
| `security` | `sec`, `shield` | `shieldkit_status` | `shieldkit_status` + `shieldkit_scan` + `shieldkit_surface` | security-auditor |
| `tests` | `test`, `testing`, `diagnose` | `testkit_status` | `testkit_status` + `testkit_map` + `testkit_analyze` | test-auditor |
| `code` | `codebase`, `architecture`, `survey` | `lenskit_status` | `lenskit_status` + `lenskit_analyze` + `lenskit_graph` | codebase-analyst |
| `evolution` | `temporal`, `timewarp`, `history` | `timewarp_history` | `timewarp_history` + `timewarp_trends` | evolution-analyst |
| `instructions` | `rules`, `navigate`, `claude-md` | `alignkit_local_status` | `alignkit_local_status` + `alignkit_local_lint` + `alignkit_local_check` | instruction-advisor |
| `all` | (no scope args defaults to all) | all status tools | all status + analysis tools | all 5 agents |

If no scope keywords are found, default to all areas. Combined with the default Standard
mode, `/orbit` with no arguments runs status + primary analysis tools across all 5
systems in parallel — the daily-driver dashboard.

## PR Mode

Analyzes only the files changed on the current branch vs. a base branch. Runs focused
checks through all 5 systems on just the diff. This is the daily-driver command — fast,
scoped, answers "is my PR ready?"

### Step 1: Gather the diff

Run:

```bash
git diff --name-status main...HEAD
```

(Replace `main` with the `--base` value if provided.)

If the command fails (e.g., branch has no common ancestor with base), tell the user and
suggest they specify the correct base branch with `--base`.

Parse the output and classify each file:

**Source files** — any file not matching test or instruction patterns below.

**Test files** — match any of: `*.test.*`, `*.spec.*`, files under `__tests__/`, `test_*.py`,
`*_test.py`, `*_test.go`, files under `tests/` whose name starts with `test_`.

**Instruction files** — match any of: `CLAUDE.md`, `.claude.local.md`, files under
`.claude/rules/`, `.claude/agents/`, `.claude/skills/`.

Filter out deleted files (status `D`). Treat renamed files (status `R`) as modified.
Ignore copy (`C`) and type-change (`T`) statuses if they appear. Track counts of added
(`A`) vs modified (`M`) for the report header.

If there are no changed files (branch is up to date with base), say so and exit.

### Step 2: Quick scan (MCP calls)

For each changed file, run the appropriate MCP tools. **Launch all calls in parallel**
(multiple tool calls in a single message).

| File type | MCP tool | What it checks |
|-----------|----------|----------------|
| Source file | `shieldkit_scan` with `file` param | New vulnerabilities |
| Source file | `lenskit_analyze` with `file` param | Impact — is this a high-coupling hub? |
| Source file | `timewarp_trends` with `file` param | Accelerating complexity? |
| Test file | `testkit_analyze` with `file` param | Test quality — shallow assertions, coverage gaps |
| Instruction file | `alignkit_local_lint` with `file` param | Instruction quality |

After the per-file calls complete, also run:
- `testkit_map` — to find source files that changed but have NO corresponding test file
  changes. Flag untested modifications.
- `alignkit_local_check` — to check if any changes violate documented rules.

For newly added files (status `A`), skip `timewarp_trends` — there is no history to analyze.

If any MCP tool fails or is unavailable, note it as "skipped" in the report and continue
with the tools that do work.

### Step 3: Deep analysis (skip if `quick`)

If the user passed `quick`, skip this step entirely and go to Step 4.

For items flagged in Step 2, do targeted deeper analysis. This is NOT dispatching full
agents — it's inline, file-scoped reads on flagged items only:

- **Shield findings** → Read the flagged file. Trace the data flow from user input to the
  vulnerability site. Is the input actually user-controlled? Is there sanitization upstream?
  Classify as confirmed, likely, or false positive.

- **Test gaps** → Read the source file that lacks test changes. What does it do? Is it
  logic that genuinely needs tests, or is it configuration/wiring? If it's auth, payment,
  or data mutation logic, flag as high priority.

- **Impact concerns** → For files where `lenskit_analyze` shows high coupling (many
  importers), use Grep to find the actual import sites. Are the changes to the file's
  public interface, or internal-only? Internal changes with high coupling are fine.

- **Rule violations** → Read the rule that was violated and the code that violates it.
  Is the violation real? Does the code need to change, or does the rule need updating?

### Step 4: Synthesize the PR readiness report

Produce this output:

```
# PR Review — {branch-name} → {base-branch}

{n} files changed ({added} added, {modified} modified, {deleted} deleted)

## Readiness

| Check | Status | Finding |
|-------|--------|---------|
| Security | {pass/warn/fail} | {one-line summary or "No issues"} |
| Test coverage | {pass/warn/fail} | {one-line summary or "All changes tested"} |
| Code quality | {pass/warn/fail} | {one-line summary or "No concerns"} |
| Complexity trends | {pass/warn/fail} | {one-line summary or "Stable"} |
| Rule conformance | {pass/warn/fail} | {one-line summary or "All rules followed"} |

## Issues

{Ordered by severity. Each cites a specific changed file and line.}

### Critical

1. **{Issue}** — `{file}:{line}`
   {What's wrong and how to fix it}

### Warning

1. **{Issue}** — `{file}:{line}`
   {What's wrong and how to fix it}

### Info

1. **{Issue}** — `{file}:{line}`
   {Observation, not blocking}

{Omit severity sections with no issues.}

## Missing Tests

{Source files that were modified but have no corresponding test file changes.
Order by criticality:
- HIGH: auth, payment, security, data mutation logic
- MEDIUM: business logic, API handlers
- LOW: config, types, utilities

If all modified source files have corresponding test changes, say "All modified source
files have corresponding test changes."}

## Good Patterns

{What the PR does well — acknowledge secure patterns, thorough tests, good structure.
If nothing stands out, omit this section entirely rather than manufacturing praise.}

## Verdict

{One sentence: "Ready to merge" / "Ready after addressing N issues" / "Needs work: {what}"}
```

**Status assignment rules:**
- `pass` — no findings, or only informational notes
- `warn` — findings exist but none are critical/blocking
- `fail` — critical findings that should be fixed before merge

### PR Mode Guidelines

- **Scope is the point.** Only analyze changed files. Never expand to the full project.
- **Parallel MCP calls.** Launch all per-file tool calls in a single message, not sequentially.
- **Be specific.** Every issue must cite a file and line from the diff. No generic advice.
- **Deep mode is targeted.** Step 3 reads flagged files — it does NOT dispatch agents or
  run full project sweeps.
- **Acknowledge good work.** If the PR is clean, say so. Don't manufacture issues.
- **Quick is fast.** When `quick` is passed, produce the report from MCP data alone. Users
  run quick to get a 30-second answer, not a 5-minute analysis.

## Quick Mode

Quick mode runs ONLY the status tool for each selected area — the fastest possible
glance. Triggered by the `quick` keyword. Launch all status tool calls **in parallel**
(multiple tool calls in a single message). Then synthesize into a minimal dashboard:

```
# Orbit — {project name} (quick glance)

| Area | Status | Top Signal |
|------|--------|-----------|
| Security | {risk level} | {top issue} |
| Tests | {grade} | {coverage ratio} |
| Code | {avg risk} | {file count + risk summary} |
| Evolution | {trend} | {commit frequency} |
| Instructions | {issue count} | {top diagnostic} |

Run `/orbit` for a fuller dashboard with detailed findings, or `/orbit deep` for a full audit.
```

Skip any area whose MCP tools are unavailable — note it as "skipped (MCP unavailable)."

## Standard Mode

Standard mode is the default when users run `/orbit` with no arguments. It runs MCP
tools, then does inline verification and intelligent synthesis — producing real
findings you can trust without dispatching full agents. Expected runtime: 30-90 seconds
on a medium project.

### Step 1: Gather MCP Data (parallel)

Launch ALL tool calls across all selected areas **in parallel** (multiple tool calls
in a single message). The table in Argument Parsing shows which tools to run per area.

### Step 2: Verify and Interpret (the intelligence layer)

This is what makes Standard mode actually useful rather than just an MCP data dump.
After the tools return, do inline verification work — this is NOT agent dispatch,
it's targeted reading in the current context.

For each area, identify the top 2-3 concerning findings from the MCP results, then
**read the actual code** to verify or contextualize them:

- **Security** — For each critical/high finding from `shieldkit_scan`, read the file
  and trace the data flow. Is the input actually user-controlled? Is there
  sanitization upstream the tool missed? Classify as confirmed, likely, or false
  positive. Do NOT include false positives in the dashboard.

- **Tests** — For the lowest-grade test files from `testkit_analyze`, read the test
  content. Is it genuinely shallow, or does it use a pattern the tool doesn't
  understand? For untested source files from `testkit_map`, read the source to
  assess criticality (auth/payment/data mutation = high, config/types = low).

- **Code** — For the highest-risk files from `lenskit_analyze`, read the file to
  see what's driving the score. Is it inherent complexity (parser, state machine)
  or accidental complexity (god module, copy-pasted logic)? Note which kind.

- **Evolution** — For accelerating files from `timewarp_trends`, read the recent
  commits to see what's driving the growth. Is it a new feature being actively
  developed (expected) or scope creep on an old module (concerning)?

- **Instructions** — For the top diagnostics from `alignkit_local_lint`, read the
  actual rules to verify they're really problematic in context. Vague rules can
  be legitimate when the project's conventions require flexibility.

**Budget guidance:** Read at most 2-3 files per area. If a finding is obviously
valid from the tool output alone, don't read the file. The goal is verification,
not re-analysis. Total file reads should stay under 10-15 across all areas.

**Verify by reading, not by executing.** Use Read, Grep, and Glob only during
verification. Do NOT write or run ad-hoc scripts (Python, Node, shell one-liners)
to test regex behavior, execute exploit payloads, or validate sanitizer logic.
This triggers permission prompts and isn't needed — read the code and reason
about it.

### Step 3: Cross-Reference

Look across areas for connections the individual tools can't see:
- Security finding + low test coverage on the same file → higher priority
- Hotspot + accelerating complexity + recent edits → refactor candidate
- Missing test + critical code path (auth/payment) → blocking gap
- Rule violation + area where tools found related issues → systemic pattern

These are only real if they show up in the data. Don't invent connections.

### Step 4: Synthesize the Dashboard

Produce the output using VERIFIED findings (from Step 2) and CROSS-REFERENCED
patterns (from Step 3), not just raw MCP output:

```
# Orbit — {project name}

## Dashboard

| Area | Status | Key Findings |
|------|--------|-------------|
| Security | {risk level} | {top 2 issues from scan results} |
| Tests | {grade} | {coverage ratio + top gap from analyze + map} |
| Code | {avg risk} | {top hotspot + circular dep count from analyze + graph} |
| Evolution | {trend} | {growth pattern + commit frequency from history + trends} |
| Instructions | {issue count} | {top diagnostic + conformance status from lint + check} |

## Details

{For each area: 3-5 bullet points from the combined MCP tool results. Include
concrete findings with file paths and line numbers where available.}

## Cross-Cutting Signals

{Light version of Deep mode's cross-cutting observations — only flag patterns that
are clearly visible from the MCP data without needing agent reasoning. Examples:
"auth.ts has both security findings and low test coverage", "billing.ts is a
hotspot AND accelerating". If nothing stands out, omit this section.}

## Suggested Next Steps

{Based on findings, suggest the most useful follow-up:
- `/orbit deep {area}` for areas with concerning signals
- `/orbit pr` if the user is about to merge a branch
- A specific system command (e.g. `/security-review`) for a single file}
```

Skip any area whose MCP tools are unavailable — note it as "skipped (MCP unavailable)."

## Deep Mode

Deep mode is triggered by the `deep` keyword (e.g., `/orbit deep`, `/orbit deep security tests`).
It dispatches the selected agents **in parallel** using the Agent tool. Each agent runs
its full multi-phase process autonomously. This takes several minutes — it's the
comprehensive audit, not the daily check.

### Dispatch

For each selected scope, launch an Agent with:
- `subagent_type`: the agent name (e.g., `universe:security-auditor`)
- A prompt that says: "Perform a comprehensive {area} audit of this project. Follow your
  full multi-phase process and return the complete report."

**Launch ALL selected agents in a single message** (parallel dispatch). Do not wait for
one agent to finish before launching the next.

Example for `/orbit security tests`:
```
Agent 1: "Perform a comprehensive security audit of this project..."
Agent 2: "Perform a comprehensive test quality audit of this project..."
```

### Synthesis

After all agents return, produce a unified report:

```
# Orbit — {project name}

## Dashboard

| Area | Risk | Findings | Top Issue |
|------|------|----------|-----------|
| Security | {risk level} | {n} findings | {highest severity issue} |
| Tests | {grade} | {n} gaps | {worst criticality gap} |
| Code | {risk level} | {n} hotspots | {top hotspot} |
| Evolution | {trend} | {n} drifting | {worst drift} |
| Instructions | {score} | {n} issues | {top quality issue} |

{Only include rows for areas that were in scope}

## Cross-Cutting Observations

Look for patterns that span multiple areas:

- **Hotspot + weak tests:** Files flagged as code hotspots that also have low test quality
- **Security + evolution:** Modules with security findings that are also drifting or accelerating
- **Instruction gaps:** Areas where findings suggest missing CLAUDE.md rules
- **Test + security overlap:** Security-critical code paths with insufficient test coverage

Only include cross-cutting observations where you found real correlations. Do not
manufacture connections that don't exist in the data.

## {Area 1} — {summary}

{Agent report, condensed to key findings. Include:}
- Top 3-5 findings with severity
- Risk level / grade
- Top recommendation

## {Area 2} — {summary}
...

## Action Plan

{Prioritized list combining the most important recommendations from all areas.
Order by: severity x effort. Critical security issues first, then test gaps on
critical code, then structural improvements.}

1. {Most urgent action}
2. {Next action}
3. ...
```

## Guidelines

- **Parallel is the point.** In every mode, launch tool calls and agent dispatches
  simultaneously (multiple in a single message), never sequentially. The whole value
  of `/orbit` is running multiple audits concurrently.
- **Default to Standard mode across all areas.** If the user just says `/orbit` with
  no arguments, immediately run Standard mode across all 5 systems. Do not ask what
  they want to review — produce the dashboard first, let them narrow scope or
  escalate to Deep/PR mode from there.
- **Condense agent reports.** In Deep mode, each agent produces a full report — your
  job is to extract the key findings, not reproduce the entire output.
- **Cross-cutting is the unique value.** Individual agents can't see across domains.
  The synthesis section is where `/orbit` provides insight no single tool can.
- **Be honest about gaps.** If an agent or MCP tool was unavailable, say so. Don't
  fabricate results for missing areas.
- **Quick is a glance, Standard is a check, Deep is an audit.** Pick the right level:
  Quick for "is anything broken right now", Standard for "what should I know about
  this codebase", Deep for "comprehensive audit with cross-cutting findings".
- **Standard mode must verify, not just aggregate.** The difference between Standard
  and Quick is that Standard reads the actual code for top findings to confirm
  they're real. Never ship a Standard report that's just MCP output reformatted —
  that's Quick mode. Standard means Claude did the intelligence work.
- **PR mode is diff-scoped.** `/orbit pr` analyzes only changed files on the branch.
  See the PR Mode section for PR-specific workflow and guidelines.
