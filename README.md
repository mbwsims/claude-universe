# Claude Universe

The deep analysis toolkit for Claude Code.

5 systems, 19 commands, 1 universe.

[claudeuniverse.com](https://claudeuniverse.com)

Run these once inside a Claude Code session (`claude` in your terminal):

```
/plugin marketplace add mbwsims/claude-universe
/plugin install universe@claude-universe
```

The plugin is available in every session after that.


## The Systems

| System | Domain | Commands |
|--------|--------|----------|
| **Navigate** | Instruction intelligence | `/discover` `/lint-rules` `/check-rules` |
| **Diagnose** | Testing intelligence | `/test` `/test-review` `/test-plan` |
| **Shield** | Security intelligence | `/scan` `/threat-model` `/security-review` |
| **Survey** | Codebase intelligence | `/trace` `/hotspots` `/impact` `/explain` `/map` |
| **Timewarp** | Temporal intelligence | `/recap` `/drift` `/dissect` `/forecast` `/rewind` |

Commands are prefixed with `universe:` (e.g. `/universe:scan`). You can also just
describe what you need in plain English, the right command activates automatically.

## What each system does

**Navigate** — Extract the standards. Discover your project's unwritten conventions,
lint instruction quality, and check whether the codebase actually follows the rules.

**Diagnose** — Pressure the behavior. Write tests that catch real bugs through input
space analysis and deep assertions, not just happy path coverage.

**Shield** — Model the attacks. Find vulnerabilities, build STRIDE threat models,
and trace untrusted input through code to determine exploitability.

**Survey** — See the blast radius. Trace features through layers, find hotspots,
map architecture, and understand impact before changing code.

**Timewarp** — Trace the evolution. Detect architectural drift, forecast which files
are about to become problems, and recap recent changes across the codebase.


## How it works

Each command combines two layers: MCP servers handle the quantitative
analysis (pattern matching, dependency graphs, scoring), and skills guide
Claude's reasoning with structured methodology and domain expertise. The
skills are what make the output consistently deeper than asking Claude
the same question directly.

For enhanced instruction tracking across sessions, the external [alignkit](https://github.com/mbwsims/alignkit) MCP
server provides session-based adherence data. It activates automatically via the
plugin's `.mcp.json` configuration.


## Language support

**MCP server analysis** (deterministic pattern matching, dependency graphs, trend computation):
- **JavaScript / TypeScript** — full support including tsconfig path alias resolution
- **Python** — function detection, import parsing, test frameworks (pytest, unittest), security patterns (f-string injection, dangerous functions)
- Support for more languages coming soon...

**Skill-guided analysis** (Claude reads and reasons about code):
- **Any language** — all 19 commands work with any language Claude can read

The MCP servers provide structured data that skills use to guide analysis. When MCP
servers aren't available (e.g., in restricted environments), every skill falls back
to manual analysis using Glob, Grep, and Read.


## Agents

Each system includes an autonomous agent for comprehensive analysis:

| Agent | System | Purpose |
|-------|--------|---------|
| instruction-advisor | Navigate | Full instruction file audit |
| test-auditor | Diagnose | Project-wide test quality audit with criticality weighting |
| security-auditor | Shield | Comprehensive security audit with data flow tracing |
| codebase-analyst | Survey | Architecture mapping with health assessment |
| evolution-analyst | Timewarp | Temporal health report with drift and forecasting |


## MCP servers

Five bundled MCP servers provide deterministic analysis and activate automatically
with zero setup:

| System | What it computes |
|--------|-----------------|
| Navigate | Instruction parsing, diagnostic detection, conformance checking |
| Diagnose | Shallow assertion detection, error coverage ratios, mock health, test mapping |
| Shield | SQL injection, hardcoded secrets, missing auth, CORS, dangerous functions |
| Survey | Dependency graphs, file metrics, churn analysis, coupling, risk scoring |
| Timewarp | Commit history analysis, growth/churn trend computation |

Every command works without MCP servers. Each has a manual fallback using Glob,
Grep, and Read. But MCP servers add a layer that Claude's reasoning alone can't
replicate:

- **Deterministic** — same patterns checked the same way every time, not dependent
  on what Claude notices in a given run
- **Batch** — scores every file in a project in one pass with shared indexes, instead
  of Claude reading files one at a time and burning context
- **Computed** — growth rate acceleration, entropy-based secret detection, weighted
  risk scores. Metrics Claude won't compute manually.

The fallbacks however are a real safety net, not a degraded mode. For small projects or
single-file analysis, they're often sufficient. MCP servers matter most on larger
codebases where batch analysis and quantitative scoring justify the tooling.


## Automatic checks

A combined hook runs after every file edit, detecting the file type and running the
appropriate check:

- **Instruction files** — lints for quality issues
- **Test files** — flags shallow assertions and missing error tests
- **Security-critical files** — spots missing auth, injection risks, ownership gaps
- **High-impact files** — warns when editing files with many dependents
- **Trending files** — flags files with accelerating complexity growth

All checks are 1-2 sentences. They nudge, not nag.


## Navigate standalone

The Navigate system is also available as a standalone plugin:
[alignkit](https://github.com/mbwsims/alignkit-plugin)


## License

MIT
