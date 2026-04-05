---
name: explain
description: >-
  This skill should be used when the user asks to "explain this code", "explain this module",
  "what does this do", "why is it structured this way", "help me understand this",
  "walk me through this file", "what's the history of this", mentions "/explain", or wants
  a deep explanation of a module or file combining code reading with git history.
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - mcp__lenskit__lenskit_analyze
  - mcp__lenskit__lenskit_graph
argument-hint: "[file-or-module]"
---

# Explain Module

Produce a deep explanation of a file or module that goes beyond "what it does" to "why it's
structured this way." Combines code reading with git history to understand the decisions,
evolution, and context behind the code.

Most code explanations are shallow — they describe WHAT each function does. Developers
already know that. What they need is: why was this decision made? What constraints shaped
this structure? What should I know before changing this?

## Workflow

### 0. Gather Metrics (if available)

If `lenskit_analyze` is available, call it on the target file to get quantitative context:
churn (how often it changes), author count (how many contributors), complexity metrics,
and importer count. Use these to inform the explanation — a file with high churn and many
authors has a different story than a stable single-author module.

If `lenskit_graph` is also available, call it to understand the target file's position
in the dependency graph: what imports it (dependents), what it imports (dependencies),
whether it's involved in any circular dependencies, and its layer classification. This
structural context enriches the "Architecture" section of the explanation.

If unavailable, gather this context manually from git history in step 2.

### 1. Read the Code

Read the target file thoroughly. Understand:
- **Purpose**: What problem does this module solve?
- **Public API**: What does it export? What's the interface?
- **Internal structure**: How is it organized? What patterns does it use?
- **Dependencies**: What does it import? What does it depend on?
- **Complexity**: Where is the tricky logic? What's non-obvious?

### 2. Read the History

Use git to understand how this file evolved:

```bash
# When was it created? How has it changed?
git log --oneline --follow -- {file}

# Who has worked on it?
git log --format='%an' -- {file} | sort | uniq -c | sort -rn

# What were the most significant changes?
git log --oneline --diff-filter=M -- {file} | head -10
```

Look for:
- **Major refactors**: Commits that changed the structure significantly
- **Bug fixes**: What bugs were found? They reveal fragile areas
- **Feature additions**: How the module grew over time
- **Author patterns**: Who owns this code? Multiple authors = potential inconsistency

**Files with no git history:** If `git log` returns nothing (file was just created, or
the repo was initialized with a single commit containing all files), note this. For new
files, focus entirely on code structure and design decisions visible in the code itself.
For "big bang" initial commits, check if the commit message or PR description provides
context about the migration or initial design.

### 3. Read the Context

Understand the module in context:
- What imports it? (Grep for imports)
- What does it import? (Read import statements)
- Is there a test file? What does it reveal about expected behavior?
- Is there related documentation? (README, comments, JSDoc)

### 4. Synthesize

Combine code reading + history + context into a structured explanation.

**Report format:**

```
## Explanation — {file}

### Purpose
{1-2 sentences: what this module does and why it exists}

### Key Concepts
{Explain the core abstractions, patterns, or decisions. Not a function-by-function
walkthrough — focus on the big picture and non-obvious details.}

### Architecture
{How this module fits into the broader codebase. What layer is it? What does it
depend on? What depends on it?}

### History & Evolution
{Key changes from git log. How it got to its current shape.
Recent changes that are relevant to understanding the current state.}

### Things to Know Before Changing
{Non-obvious gotchas, fragile areas, implicit assumptions, related code that
might need to change in tandem. This is the highest-value section.}
```

## Guidelines

- **"Things to Know Before Changing" is the most important section.** This is what
  differentiates a lenskit explanation from `cat file.ts`. Focus on non-obvious gotchas,
  implicit coupling, and fragile areas.
- Don't describe every function. Describe the module's PURPOSE, PATTERNS, and PITFALLS.
- Use git history selectively. Recent commits and large refactors are informative. Hundreds
  of minor commits are noise.
- If the code is straightforward and has no tricky parts, say so. Not every file needs a
  deep explanation.

## Related Skills

- **`/impact`** — Check blast radius before changing the module
- **`/hotspots`** — See if this module is a high-risk area

## Additional Resources

- **`references/explanation-patterns.md`** — Patterns for explaining different code
  archetypes (services, utilities, configuration, UI components)
