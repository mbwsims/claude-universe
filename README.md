# Claude Universe

Five systems. One plugin. 19 commands, 5 agents, zero dependencies.

[claudeuniverse.com](https://claudeuniverse.com)

```bash
claude plugin add mbwsims/claude-universe
```

## The Systems

| System | Domain | Commands |
|--------|--------|----------|
| **Navigate** (alignkit) | Instruction intelligence | `/discover` `/lint` `/check` |
| **Diagnose** (testkit) | Testing intelligence | `/test` `/test-review` `/test-plan` |
| **Shield** (shieldkit) | Security intelligence | `/scan` `/threat-model` `/security-review` |
| **Survey** (lenskit) | Codebase intelligence | `/trace` `/hotspots` `/impact` `/explain` `/map` |
| **Timewarp** | Temporal intelligence | `/recap` `/drift` `/bisect` `/forecast` `/rewind` |

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

## Agents

Each system includes an autonomous agent for comprehensive analysis:

| Agent | System | Purpose |
|-------|--------|---------|
| instruction-advisor | Navigate | Full instruction file audit |
| test-auditor | Diagnose | Project-wide test quality audit with criticality weighting |
| security-auditor | Shield | Comprehensive security audit with data flow tracing |
| codebase-analyst | Survey | Architecture mapping with health assessment |
| evolution-analyst | Timewarp | Temporal health report with drift and forecasting |

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

Every command works immediately with no setup. Four bundled MCP servers provide
deterministic analysis (pattern matching, dependency graphs, trend computation) and
activate automatically when the plugin is installed.

For enhanced instruction tracking across sessions, optionally install the `alignkit`
npm package: `npm install -g alignkit`.

## Individual systems

Each system is also available as a standalone plugin:

- [alignkit](https://github.com/mbwsims/alignkit-plugin) — Navigate
- [testkit](https://github.com/mbwsims/testkit-plugin) — Diagnose
- [shieldkit](https://github.com/mbwsims/shieldkit-plugin) — Shield
- [lenskit](https://github.com/mbwsims/lenskit-plugin) — Survey
- [timewarp](https://github.com/mbwsims/timewarp-plugin) — Timewarp

## License

MIT
