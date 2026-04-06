# Claude Universe

5 systems, 19 commands, 1 universe.

[claudeuniverse.com](https://claudeuniverse.com)

```bash
claude plugin add mbwsims/claude-universe
```

Run `/universe` to see all commands, or just describe what you need in plain English.

## The Systems

| System | Domain | Commands |
|--------|--------|----------|
| **Navigate** (alignkit) | Instruction intelligence | `/discover` `/lint-rules` `/check-rules` |
| **Diagnose** (testkit) | Testing intelligence | `/test` `/test-review` `/test-plan` |
| **Shield** (shieldkit) | Security intelligence | `/scan` `/threat-model` `/security-review` |
| **Survey** (lenskit) | Codebase intelligence | `/trace` `/hotspots` `/impact` `/explain` `/map` |
| **Timewarp** | Temporal intelligence | `/recap` `/drift` `/dissect` `/forecast` `/rewind` |

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

## Language support

**MCP server analysis** (deterministic pattern matching, dependency graphs, trend computation):
- **JavaScript / TypeScript** — full support including tsconfig path alias resolution
- **Python** — function detection, import parsing, test frameworks (pytest, unittest), security patterns (f-string injection, dangerous functions)

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

Six MCP servers provide deterministic analysis and activate automatically:

| Server | Type | Tools |
|--------|------|-------|
| alignkit-local | Bundled | `alignkit_local_lint`, `alignkit_local_check`, `alignkit_local_status` |
| testkit | Bundled | `testkit_analyze`, `testkit_map`, `testkit_status` |
| shieldkit | Bundled | `shieldkit_scan`, `shieldkit_surface`, `shieldkit_status` |
| lenskit | Bundled | `lenskit_analyze`, `lenskit_graph`, `lenskit_status` |
| timewarp | Bundled | `timewarp_history`, `timewarp_trends` |
| alignkit | External | `alignkit_lint`, `alignkit_check`, `alignkit_status` |

The five bundled servers run locally with zero setup. The external `alignkit` server
provides session-based adherence tracking across conversations (requires npm).

When MCP servers are unavailable, every command gracefully falls back to manual
analysis. A single availability probe in the post-edit hook prevents cascading
failures.

## Automatic checks

A combined hook runs after every file edit, detecting the file type and running the
appropriate check:

- **Instruction files** — lints for quality issues
- **Test files** — flags shallow assertions and missing error tests
- **Security-critical files** — spots missing auth, injection risks, ownership gaps
- **High-impact files** — warns when editing files with many dependents
- **Trending files** — flags files with accelerating complexity growth

All checks are 1-2 sentences. They nudge, not nag.

## How it works

Every command works immediately with no setup. Five bundled MCP servers provide
deterministic analysis (pattern matching, dependency graphs, trend computation) and
activate automatically when the plugin is installed.

For enhanced instruction tracking across sessions, the external `alignkit` MCP
server provides session-based adherence data. It activates automatically via the
plugin's `.mcp.json` configuration.

## Individual systems

Each system is also available as a standalone plugin:

- [alignkit](https://github.com/mbwsims/alignkit-plugin) — Navigate
- [testkit](https://github.com/mbwsims/testkit-plugin) — Diagnose
- [shieldkit](https://github.com/mbwsims/shieldkit-plugin) — Shield
- [lenskit](https://github.com/mbwsims/lenskit-plugin) — Survey
- [timewarp](https://github.com/mbwsims/timewarp-plugin) — Timewarp

## License

MIT
