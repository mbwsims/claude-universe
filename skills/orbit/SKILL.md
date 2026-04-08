---
name: orbit
description: >-
  This skill should be used when the user asks for a "project review", "full review",
  "review everything", "how's my project", "project health", "audit everything",
  "orbit the project", "orbit security and tests", "quick orbit", "project dashboard",
  "run all agents", "check everything", mentions "/orbit", or wants a combined assessment
  across any combination of security, tests, code quality, evolution, and instructions.
  Supports scoping to specific areas and quick mode for fast MCP-only checks.
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
argument-hint: "[scope: all|security|tests|code|evolution|instructions] [quick]"
---

# Orbit

High-altitude sweep of the project. Dispatches agents in parallel across selected areas,
collects results, and synthesizes a unified report with cross-cutting observations.

## Argument Parsing

Parse the user's input to determine **mode** and **scope**:

**Mode:**
- `quick` keyword present → **Quick mode** (MCP tools only, fast dashboard)
- No `quick` keyword → **Deep mode** (full agent dispatch with all phases)

**Scope** — match any of these keywords (multiple allowed):

| Keyword | Aliases | Deep: Agent | Quick: MCP tools |
|---------|---------|-------------|-----------------|
| `security` | `sec`, `shield` | security-auditor | `shieldkit_status` + `shieldkit_scan` |
| `tests` | `test`, `testing`, `diagnose` | test-auditor | `testkit_status` + `testkit_map` |
| `code` | `codebase`, `architecture`, `survey` | codebase-analyst | `lenskit_status` + `lenskit_graph` |
| `evolution` | `temporal`, `timewarp`, `history` | evolution-analyst | `timewarp_history` + `timewarp_trends` |
| `instructions` | `rules`, `navigate`, `claude-md` | instruction-advisor | `alignkit_local_status` + `alignkit_local_lint` |
| `all` | (no args also defaults to all) | all 5 agents | all status + primary tools |

If no scope keywords are found and no arguments given, ask the user what they want to review.

## Quick Mode

Call the MCP tools for all selected scopes **in parallel** (multiple tool calls in a single
message). Then synthesize into a dashboard:

```
# Orbit — {project name} (quick)

## Dashboard

| Area | Status | Key Finding |
|------|--------|-------------|
| Security | {risk level} | {top issue from shieldkit_status} |
| Tests | {grade} | {coverage ratio + top gap from testkit_status} |
| Code | {avg risk} | {top hotspot from lenskit_status} |
| Evolution | {trend} | {growth pattern from timewarp_trends} |
| Instructions | {issue count} | {top diagnostic from alignkit_local_lint} |

## Details

{For each area: 3-5 bullet points from the MCP tool results}

## Suggested Deep Dives

{Based on findings, suggest which areas warrant a full `/orbit` (deep mode)}
```

Skip any area whose MCP tools are unavailable — note it as "skipped (MCP unavailable)."

## Deep Mode

Dispatch the selected agents **in parallel** using the Agent tool. Each agent runs its
full multi-phase process autonomously.

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

- **Parallel is the point.** Always dispatch agents simultaneously, never sequentially.
  The whole value of `/orbit` is running multiple audits concurrently.
- **Condense agent reports.** Each agent produces a full report — your job is to extract
  the key findings, not reproduce the entire output. Link to the full report if the user
  wants details.
- **Cross-cutting is the unique value.** Individual agents can't see across domains.
  The synthesis section is where `/orbit` provides insight no single agent can.
- **Be honest about gaps.** If an agent or MCP tool was unavailable, say so. Don't
  fabricate results for missing areas.
- **Quick mode is a dashboard, not an audit.** Quick mode provides a snapshot for
  "how's the project looking?" — it's not a substitute for deep mode. If quick mode
  reveals concerning signals, suggest running deep mode on those areas.
- **Default to all.** If the user just says `/orbit` with no arguments, default to
  all areas rather than asking. They can narrow down after seeing the dashboard.
