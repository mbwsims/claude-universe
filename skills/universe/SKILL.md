---
name: universe
description: >-
  This skill should be used when the user asks "what commands are available", "list commands",
  "what can this plugin do", "help", "show me the commands", "what is claude universe",
  "how do I use this", mentions "/universe", or wants to see an overview of all available
  commands and systems.
allowed-tools: []
---

# Claude Universe

5 systems, 19 commands. Just describe what you need — you don't have to memorize commands.

## Navigate — instruction intelligence

| Command | What it does |
|---------|-------------|
| `/discover` | Find unwritten conventions in your code and suggest rules |
| `/lint-rules` | Check instruction file quality (CLAUDE.md, rules, skills) |
| `/check-rules` | Verify whether the codebase actually follows the rules |

Agent: **"review my CLAUDE.md"** runs all three as a comprehensive instruction audit.

## Diagnose — testing intelligence

| Command | What it does |
|---------|-------------|
| `/test` | Write tests that catch real bugs — runs autonomously |
| `/test-review` | Grade an existing test file across 6 quality dimensions |
| `/test-plan` | Plan what to test before writing code |

Agent: **"audit my tests"** runs a project-wide test quality assessment.

## Shield — security intelligence

| Command | What it does |
|---------|-------------|
| `/scan` | Find vulnerabilities: injection, secrets, missing auth, CORS |
| `/security-review` | Attacker-minded code review with data flow tracing |
| `/threat-model` | STRIDE threat model for a feature or system |

Agent: **"security audit"** maps the attack surface and scans everything.

## Survey — codebase intelligence

| Command | What it does |
|---------|-------------|
| `/map` | Map the architecture: layers, boundaries, dependencies |
| `/trace` | Follow a feature through the codebase end to end |
| `/hotspots` | Find high-risk files (churn x complexity) |
| `/impact` | Check blast radius before changing a file |
| `/explain` | Explain a module: purpose, history, things to know |

Agent: **"help me understand this codebase"** produces a full onboarding report.

## Timewarp — temporal intelligence

| Command | What it does |
|---------|-------------|
| `/recap` | Summarize recent changes across the codebase |
| `/drift` | Detect modules that have shifted from their original purpose |
| `/dissect` | Find when and why a file became complex |
| `/forecast` | Predict which files are about to become problems |
| `/rewind` | Compare a file now vs. a point in history |

Agent: **"how has this project evolved"** produces a full temporal health report.

## Automatic checks

A background hook runs after every file edit, detecting the type and running the
appropriate check. You don't need to invoke anything — it nudges when it finds issues.

## Tips

- **You don't need slash commands.** Describe what you need in plain English and the
  right command activates automatically.
- **Start broad, then narrow.** Use `/map` or an agent first, then drill into specific
  commands for areas that need attention.
- **Commands compose.** Each command's output suggests related commands for natural
  follow-up workflows.
