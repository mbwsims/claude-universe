---
name: orbit
description: >-
  Run for repo-wide or diff-wide readiness sweeps: "/orbit", "/orbit pr", "/orbit deep",
  "/orbit quick", "audit this project", "project-wide review", "is this PR ready overall",
  or "combined security, tests, codebase, evolution, and instruction review". Use this for
  broad multi-system assessment, not for a single-file review or a one-domain question.
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
| Quick | Status tools only, inline | ~10 sec | "Is anything broken?" |
| Standard (default) | Dispatches `orbit-orchestrator` subagent | ~30-90 sec | "What should I know?" |
| Deep | Dispatches all 5 full-phase agents in parallel | ~5-15 min | "Comprehensive audit" |

Standard is the daily-driver default. It dispatches a single orchestrator subagent
that runs MCP tools across all areas and verifies top findings by reading code.
Subagent dispatch gives fresh tool manifest access, bypassing ToolSearch deferral
that can affect inline execution.

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

If any MCP tool call returns an error, note the specific tool failure in the report
and continue with the tools that do work. Never report a bundled MCP as "not installed".

### Step 3: Deep analysis (skip if `quick`)

If the user passed `quick`, skip this step entirely and go to Step 4.

For items flagged in Step 2, do targeted deeper analysis. This is NOT dispatching full
agents — it's inline, file-scoped reads on flagged items only:

- **Shield findings** → Read the flagged file. Trace the data flow from user input to the
  vulnerability site. Is the input actually user-controlled? Is there sanitization upstream?
  Classify as confirmed, likely, or false positive.

- **Test gaps** → Inspect the changed production file when tests were not updated. What does it do? Is it
  logic that genuinely needs tests, or is it configuration/wiring? Flag business-critical
  mutation logic as high priority.

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

Use the same entry format as Critical, but for non-blocking issues that still need action.

### Info

Use the same entry format as Critical, but for observations that are useful context only.

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

Quick mode runs inline in the user's current turn. If some MCP tools aren't in
the tool manifest (deferred by ToolSearch), attempt the calls anyway — if they
fail, fall back to native tools (git, Grep, Read) for those areas. Be transparent
about which areas used MCP vs native. Never report bundled MCPs as "not
installed" — they ship with claude-universe.

For a more thorough analysis that guarantees fresh MCP tool access, use `/orbit`
(Standard mode, dispatches the orchestrator subagent) or `/orbit deep` (full
agent audit).

## Standard Mode

Standard mode is the default when users run `/orbit` with no arguments. It
dispatches the `orbit-orchestrator` subagent to run MCP tools and do inline
verification in a fresh context. Expected runtime: 30-90 seconds on a medium
project.

### Why subagent dispatch?

When Claude Code has many plugins installed, MCP tool schemas can be deferred by
ToolSearch, and the current turn's tool manifest may not include every bundled
claude-universe MCP tool. Dispatching `orbit-orchestrator` as a subagent gives
it a fresh tool manifest initialized from its own frontmatter — all bundled MCP
tools are available to the orchestrator regardless of what's in the parent
turn's manifest.

### Dispatch

Use the Agent tool to launch `universe:orbit-orchestrator` with a prompt
describing the user's scope. Example:

- No arguments → prompt: "Run Standard mode orbit across all 5 areas (security,
  tests, code, evolution, instructions). Return the full dashboard."
- `/orbit security tests` → prompt: "Run Standard mode orbit scoped to security
  and tests only. Return the dashboard covering just those areas."

The orchestrator runs the 4-step process (gather → verify → cross-reference →
synthesize) autonomously and returns a complete dashboard. Your job is to
dispatch it once and render its output directly — do NOT reformat or condense
the orchestrator's response, it's already been synthesized for the user.

### If the orchestrator agent is unavailable

If `universe:orbit-orchestrator` can't be dispatched for any reason (agent not
registered, Agent tool unavailable, etc.), fall back to running the MCP tools
inline yourself:

1. Attempt to invoke each area's MCP tools directly. Tools not in the current
   manifest may be deferred — if they return an error, note the failure and
   continue.
2. For areas where MCP tools aren't available, use native tools (git log, Grep,
   Read, Glob) to produce the best analysis you can.
3. Be transparent in the dashboard about which areas used MCP tools vs native
   fallback. Never report bundled MCPs as "not installed" — they ship with the
   plugin.
4. At the bottom of the dashboard, note: "Orbit orchestrator dispatch failed —
   used inline fallback. Check `/plugin` Errors tab if MCP tools should be
   available."

The fallback is honest degradation, not deception. Real findings from native
tools beat fake findings from fabricated MCP output.

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
- **Be honest about gaps.** If an MCP tool call returns an error, say so. Don't
  fabricate results for missing areas.
- **Never report bundled MCPs as "not installed".** The Navigate/Diagnose/Shield/
  Survey/Timewarp MCP servers all ship with claude-universe. In Standard mode,
  dispatching `universe:orbit-orchestrator` gives you fresh tool access. If MCP
  tools still fail, it's a runtime startup issue (check `/plugin` Errors tab),
  not a missing install.
- **Quick is a glance, Standard is a check, Deep is an audit.** Pick the right level:
  Quick for "is anything broken right now", Standard for "what should I know about
  this codebase", Deep for "comprehensive audit with cross-cutting findings".
- **Standard mode dispatches an orchestrator subagent.** Don't run Standard mode
  inline in the user's turn — dispatch `universe:orbit-orchestrator` via the
  Agent tool and render its output directly. Inline execution is subject to
  ToolSearch deferral; subagent dispatch gets a fresh tool manifest.
- **PR mode is diff-scoped.** `/orbit pr` analyzes only changed files on the branch.
  See the PR Mode section for PR-specific workflow and guidelines.
