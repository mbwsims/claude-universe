# Phase 6: Cross-Cutting — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finalize the A-range upgrade by updating the hook with an availability probe, updating README for Python support and new architecture, registering alignkit-local in .mcp.json, and bumping plugin.json to 0.4.0.

**Architecture:** Four independent changes to cross-cutting files that reference work completed in Phases 0-5. The hook gets smarter about MCP availability. Documentation reflects the new capabilities honestly.

**Tech Stack:** JSON, Markdown

**Prerequisites:** All of Phases 0-5 must be complete before starting this phase.

---

### Task 1: Upgrade hook with availability probe

**Files:**
- Modify: `hooks/hooks.json`

The current hook blindly tries MCP tool calls for every file edit, potentially failing 5 times per edit if servers aren't available. The upgrade adds a single probe call first — if it succeeds, use tools for all checks; if it fails, skip all tool attempts and use manual checks only.

Additionally, instruction file checks should prefer `alignkit_local_lint` (the new bundled server from Phase 1) over the external `alignkit_lint`.

- [ ] **Step 1: Replace the hook prompt**

Replace the entire `prompt` value in `hooks/hooks.json` with:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Determine the type of file just modified, then run the appropriate check. Only ONE check should fire per edit — pick the first match.\n\n**Availability probe:** Before any MCP call, try `lenskit_status` as a probe. If it returns a result, MCP tools are available this session — use them for all checks below. If it fails or times out, MCP tools are unavailable — use manual checks only for every category below. This single probe replaces 5 potential failures.\n\n**1. Instruction file** (CLAUDE.md, .claude.local.md, .claude/rules/*, .claude/agents/*, .claude/skills/*)\nIf MCP available: call `alignkit_local_lint` (preferred) or fall back to `alignkit_lint`. Surface the 1-3 most important findings.\nIf MCP unavailable: do a quick manual check for conflicting rules or vague language.\nIf no issues, say nothing.\n\n**2. Test file** (*.test.*, *.spec.*, __tests__/*, test_*.py, *_test.py)\nIf MCP available: call `testkit_analyze` with the file. Surface the most important issue (shallow assertions, missing error tests).\nIf MCP unavailable: spot-check for toBeDefined/toBeTruthy and missing error tests. For Python: check for bare `assert` without specific comparison.\nIf no issues, say nothing.\n\n**3. Security-critical file** (API route handlers, auth code, database queries, config with secrets, Python views with @app.route)\nIf MCP available: call `shieldkit_scan` with the file. Surface the most important finding.\nIf MCP unavailable: check for: missing auth at handler top, user input in queries without parameterization, missing ownership checks, Python f-strings with SQL keywords.\nIf no issues, say nothing.\n\n**4. Any source file**\nIf MCP available: call `lenskit_analyze` with the file. If the file has >5 importers, note: \"This file has {N} dependents — consider running /impact before further changes.\"\nThen call `timewarp_trends` with the file. If the file shows accelerating complexity, note: \"This file's complexity has grown {rate}% recently. Run /forecast for trend analysis.\"\nIf MCP unavailable: skip both checks.\n\n**5. None of the above** — do nothing.\n\nIf you already surfaced the same warning for this exact file earlier in this session, say nothing. Keep all output to 1-2 sentences maximum."
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 2: Validate JSON syntax**

Run: `node -e "JSON.parse(require('fs').readFileSync('hooks/hooks.json','utf8')); console.log('Valid JSON')"`
Expected: "Valid JSON"

- [ ] **Step 3: Commit**

```bash
git add hooks/hooks.json
git commit -m "feat: add MCP availability probe to hook, prefer alignkit-local, add Python patterns"
```

---

### Task 2: Update README

**Files:**
- Modify: `README.md`

Add language support section, MCP availability note, and update Navigate section for the new bundled + external architecture.

- [ ] **Step 1: Replace README.md content**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README for Python support, 6 MCP servers, and availability fallback"
```

---

### Task 3: Update .mcp.json

**Files:**
- Modify: `.mcp.json`

Add the new `alignkit-local` bundled server entry. Pin the external `alignkit-mcp` version.

- [ ] **Step 1: Replace .mcp.json content**

```json
{
  "mcpServers": {
    "alignkit-local": {
      "command": "node",
      "args": ["mcp/alignkit/dist/mcp/server.js"]
    },
    "testkit": {
      "command": "node",
      "args": ["mcp/testkit/dist/mcp/server.js"]
    },
    "shieldkit": {
      "command": "node",
      "args": ["mcp/shieldkit/dist/mcp/server.js"]
    },
    "lenskit": {
      "command": "node",
      "args": ["mcp/lenskit/dist/mcp/server.js"]
    },
    "timewarp": {
      "command": "node",
      "args": ["mcp/timewarp/dist/mcp/server.js"]
    },
    "alignkit": {
      "command": "npx",
      "args": ["-y", "alignkit-mcp@0.3.0"]
    }
  }
}
```

- [ ] **Step 2: Validate JSON syntax**

Run: `node -e "JSON.parse(require('fs').readFileSync('.mcp.json','utf8')); console.log('Valid JSON')"`
Expected: "Valid JSON"

- [ ] **Step 3: Commit**

```bash
git add .mcp.json
git commit -m "feat: add alignkit-local to .mcp.json, pin external alignkit-mcp version"
```

---

### Task 4: Update plugin.json

**Files:**
- Modify: `.claude-plugin/plugin.json`

Bump version to 0.4.0. Update description for Python support and 6 MCP servers.

- [ ] **Step 1: Replace plugin.json content**

```json
{
  "name": "claude-universe",
  "version": "0.4.0",
  "description": "Five intelligence systems in one install. Align instructions, test behavior, shield against attacks, understand your codebase, and analyze its evolution. 19 commands, 5 agents, 6 MCP servers. JavaScript/TypeScript and Python analysis.",
  "author": {
    "name": "Matt Sims",
    "url": "https://github.com/mbwsims"
  },
  "homepage": "https://github.com/mbwsims/claude-universe-plugin",
  "repository": "https://github.com/mbwsims/claude-universe-plugin",
  "license": "MIT",
  "keywords": [
    "alignkit",
    "testkit",
    "shieldkit",
    "lenskit",
    "timewarp",
    "instruction-quality",
    "testing",
    "security",
    "codebase-intelligence",
    "temporal",
    "evolution",
    "forecast",
    "python",
    "typescript",
    "claude-code"
  ]
}
```

- [ ] **Step 2: Validate JSON syntax**

Run: `node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/plugin.json','utf8')); console.log('Valid JSON')"`
Expected: "Valid JSON"

- [ ] **Step 3: Commit**

```bash
git add .claude-plugin/plugin.json
git commit -m "chore: bump to 0.4.0, update description for Python support and 6 MCP servers"
```

---

### Task 5: Final verification

**Files:** (no new files)

- [ ] **Step 1: Verify all MCP servers build**

Run: `npm run build 2>&1 | tail -20`
Expected: Clean build for all servers (testkit, shieldkit, lenskit, timewarp, alignkit)

- [ ] **Step 2: Run full test suite**

Run: `npm test 2>&1 | tail -30`
Expected: All tests pass across all servers (~265 tests total)

- [ ] **Step 3: Verify .mcp.json references valid paths**

Run: `node -e "const cfg = JSON.parse(require('fs').readFileSync('.mcp.json','utf8')); for (const [name, srv] of Object.entries(cfg.mcpServers)) { if (srv.args?.[0]?.startsWith('mcp/')) { const exists = require('fs').existsSync(srv.args[0]); console.log(name + ': ' + (exists ? 'OK' : 'MISSING: ' + srv.args[0])); } else { console.log(name + ': external'); } }"`
Expected: All bundled servers show "OK", alignkit shows "external"

- [ ] **Step 4: Verify plugin.json is valid**

Run: `node -e "const p = JSON.parse(require('fs').readFileSync('.claude-plugin/plugin.json','utf8')); console.log(p.name + '@' + p.version)"`
Expected: `claude-universe@0.4.0`

- [ ] **Step 5: Verify hook JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('hooks/hooks.json','utf8')); console.log('Hook JSON valid')"`
Expected: "Hook JSON valid"

- [ ] **Step 6: Final commit if any fixes were needed**

Only if steps 1-5 revealed issues:

```bash
git add -A
git commit -m "fix: resolve cross-cutting integration issues"
```
