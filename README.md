# Claude Universe

Project-wide PR readiness, targeted test authoring, security review, architecture tracing,
and code evolution analysis for Claude Code.

Claude Universe packages 20 commands across 5 systems so you can answer questions like:

- Is this PR ready overall?
- What tests should exist, and can Claude write them?
- Is this code exploitable?
- What is the blast radius of this change?
- Which files are drifting or getting worse over time?

[claudeuniverse.com](https://claudeuniverse.com)

## Start here

Use these entry points first:

| Command | Outcome |
|---------|---------|
| `/orbit` | Repo-wide health sweep across tests, security, codebase risk, evolution, and instructions |
| `/orbit pr` | Diff-aware PR readiness review focused on changed files |
| `/test` | New tests written for a file, function, or module |
| `/security-review` | Attacker-minded review of a specific file or change set |
| `/trace` | End-to-end feature/data flow from entry point to storage |

You can also scope `/orbit`, for example `/orbit security tests`.

## Install

Run these once inside a Claude Code session:

```text
/plugin marketplace add mbwsims/claude-universe
```

```text
/plugin install universe@claude-universe
```

After that, the plugin is available in every session.

## Why Skills + MCP

Claude Universe combines two layers:

- **Skills** define the workflow: when to use a command, what steps to follow, and how to
  reason about the result.
- **Bundled MCP servers** provide deterministic analysis: dependency graphs, risk scores,
  security checks, test metrics, and temporal history.

That split matters. The MCP layer gives Claude computed data it cannot reliably derive by
reading files one at a time, while the skills layer turns that data into repeatable reviews,
traces, and recommendations.

Every command still has a manual fallback using Read, Glob, Grep, and Bash when MCP data is
unavailable.

## Validation

This repo now ships a dedicated skill validation path:

```bash
npm run test:skills
```

It validates the checked-in `skills/**/SKILL.md` inventory for:

- required frontmatter
- tool-declaration drift between `allowed-tools` and the skill body
- warning-level lint/conformance issues reported for review

Trigger and smoke-review fixtures for the highest-priority commands live under
[`evals/skills/`](./evals/skills/README.md).

## The Systems

| System | Domain | Commands |
|--------|--------|----------|
| **Navigate** | Instruction intelligence | `/discover` `/lint-rules` `/check-rules` |
| **Diagnose** | Testing intelligence | `/test` `/test-review` `/test-plan` |
| **Shield** | Security intelligence | `/scan` `/threat-model` `/security-review` |
| **Survey** | Codebase intelligence | `/trace` `/hotspots` `/impact` `/explain` `/map` |
| **Timewarp** | Temporal intelligence | `/recap` `/drift` `/dissect` `/forecast` `/rewind` |

## What Each System Does

**Navigate** extracts the rules the project actually follows, lints instruction quality, and
checks whether the codebase conforms to those rules.

**Diagnose** writes stronger tests, reviews existing tests, and plans coverage using input-space
analysis and assertion-depth checks.

**Shield** looks for exploitability: vulnerabilities, threat models, and security-focused code
review.

**Survey** maps architecture, traces feature flows, identifies hotspots, and estimates blast
radius before code changes land.

**Timewarp** uses history and trend analysis to explain recent changes, detect drift, and flag
files that are on concerning trajectories.

## Agents

Each system includes an autonomous agent for deeper analysis:

| Agent | System | Purpose |
|-------|--------|---------|
| instruction-advisor | Navigate | Full instruction file audit |
| test-auditor | Diagnose | Project-wide test quality audit with criticality weighting |
| security-auditor | Shield | Comprehensive security audit with data flow tracing |
| codebase-analyst | Survey | Architecture mapping with health assessment |
| evolution-analyst | Timewarp | Temporal health report with drift and forecasting |

## MCP Servers

Five bundled MCP servers activate automatically:

| System | What it computes |
|--------|------------------|
| Navigate | Instruction parsing, diagnostics, conformance checking |
| Diagnose | Shallow assertions, error coverage, mock health, test mapping |
| Shield | SQL injection, hardcoded secrets, missing auth, CORS, dangerous functions |
| Survey | Dependency graphs, file metrics, churn analysis, coupling, risk scoring |
| Timewarp | Commit history, growth trends, churn trends |

These servers matter most on large codebases where batch analysis and computed metrics are
worth more than asking Claude to inspect files manually.

## Language Support

**MCP server analysis**

- **JavaScript / TypeScript** — full support, including tsconfig path alias resolution
- **Python** — function detection, import parsing, test framework detection, and security patterns

**Skill-guided analysis**

- **Any language Claude can read** — the command methodologies still apply even when MCP data
  falls back to manual analysis

## Related Plugin

The Navigate system is also available as a standalone plugin:
[alignkit](https://github.com/mbwsims/alignkit-plugin)

## License

MIT
