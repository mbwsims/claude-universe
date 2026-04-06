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

| Command | When to use | What it does |
|---------|------------|-------------|
| `/discover` | "What conventions does my code follow?" | Infer rules from code patterns |
| `/lint-rules` | "Is my CLAUDE.md any good?" | Check instruction file quality |
| `/check-rules` | "Are the rules being followed?" | Verify codebase conformance |

Agent: **"review my CLAUDE.md"** runs all three as a comprehensive instruction audit.

## Diagnose — testing intelligence

| Command | When to use | What it does |
|---------|------------|-------------|
| `/test` | "Write tests for this" | Generate tests autonomously |
| `/test-review` | "How good are these tests?" | Grade a test file across 6 dimensions |
| `/test-plan` | "What should I test?" | Plan test strategy before writing code |

Agent: **"audit my tests"** runs a project-wide test quality assessment.

## Shield — security intelligence

| Command | When to use | What it does |
|---------|------------|-------------|
| `/scan` | "Is anything vulnerable?" | Automated pattern scan across the project |
| `/security-review` | "Is this specific code safe?" | Deep code review with data flow tracing |
| `/threat-model` | "What could go wrong with this feature?" | STRIDE risk assessment at design level |

Agent: **"security audit"** runs all three as a comprehensive assessment.

## Survey — codebase intelligence

| Command | When to use | What it does |
|---------|------------|-------------|
| `/map` | "What's the architecture?" | Map layers, boundaries, dependencies |
| `/trace` | "How does this feature work?" | Follow a feature through the codebase |
| `/hotspots` | "Where are the risky areas?" | Find high-risk files (churn x complexity) |
| `/impact` | "What breaks if I change this?" | Check blast radius before editing a file |
| `/explain` | "What does this file do?" | Explain purpose, history, things to know |

Agent: **"help me understand this codebase"** produces a full onboarding report.

## Timewarp — temporal intelligence

| Command | When to use | What it does |
|---------|------------|-------------|
| `/recap` | "What changed recently?" | Summarize recent changes across the codebase |
| `/drift` | "Has this module lost focus?" | Detect purpose shifts over time |
| `/dissect` | "Why is this file so complex?" | Trace when and why complexity was added |
| `/forecast` | "What's about to become a problem?" | Predict files on concerning trajectories |
| `/rewind` | "What did this look like before?" | Compare a file now vs. a point in history |

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
