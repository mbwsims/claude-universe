---
name: discover
description: >-
  This skill should be used when the user asks to "discover conventions", "find conventions",
  "infer rules from code", "what conventions does my project follow", "reverse engineer my rules",
  "discover patterns", "what rules should I add", "analyze my codebase for conventions",
  "generate rules from code", mentions "/discover", or wants to find unwritten conventions
  in their codebase that should become instruction rules.
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
argument-hint: "[focus-area]"
---

# Discover Conventions

Reverse-engineer the conventions a project actually follows by analyzing the codebase.
Every project has unwritten rules — import patterns, naming conventions, error handling
styles, testing approaches, architectural boundaries. This skill makes them explicit
and actionable as instruction rules.

Works with zero dependencies. No alignkit installation needed.

## Why This Matters

Most CLAUDE.md files document what the developer *intended*. The codebase reveals what
actually *happened*. Conventions that exist in practice but not in instructions are
invisible to Claude — it may follow them by accident in one session and violate them in
the next. Discovering and codifying these conventions makes Claude's behavior consistent.

## Workflow

### 1. Scope the Analysis

If the user specified a focus area (e.g., "imports", "testing", "API routes"), narrow
the analysis to that domain. Otherwise, run a broad analysis across all convention
categories.

Read the existing instruction files (CLAUDE.md, .claude/rules/*) first to avoid
suggesting rules that already exist.

### 2. Gather Project Context

Collect foundational data about the project:

- **package.json** (or equivalent): dependencies, scripts, project type
- **Config files**: tsconfig.json, .eslintrc, .prettierrc, pyproject.toml, Cargo.toml, etc.
- **Directory structure**: top-level layout, key directories, naming patterns
- **Entry points**: main source directories, routing structure

### 3. Sample Source Files

Read a representative sample of source files across the project. Do not read every file —
sample strategically:

- 8-12 source files from different directories and purposes
- 2-3 test files (if they exist)
- 2-3 config/setup files
- API routes or handlers (if they exist)

The goal is coverage of different parts of the codebase, not exhaustiveness.

### 4. Analyze Convention Categories

For each category in `references/convention-categories.md`, look for consistent patterns
across the sampled files. A convention must appear in **most or all** sampled files to
qualify — a pattern in 2 out of 10 files is not a convention.

For each discovered convention:
1. Identify the pattern (what is consistently done)
2. Count the evidence (how many files follow this pattern)
3. Check for exceptions (any files that deviate — and whether the deviation is intentional)
4. Draft a candidate rule (concrete, actionable, paste-ready)

### 5. Present Discoveries

Format discoveries as a numbered list with evidence. Group by category.

**Report format:**

```
## Discovered Conventions — {project name}

{n} conventions found across {n files sampled} files

### Import & Module Patterns

1. **{Pattern name}** — {brief description of what's consistent}
   Suggested rule: "{concrete, paste-ready rule text}"
   Evidence: {specific files, counts, or grep results}

2. ...

### Code Structure

3. **{Pattern name}** — ...

### Error Handling

4. ...
```

**For each discovery, include:**
- A short descriptive title
- The suggested rule in quotes (ready to paste into CLAUDE.md)
- Specific evidence: file paths, line numbers, counts, or grep results
- Note any exceptions found
- A value tag: **high**, **medium**, or **low**

**Value filtering — this is critical:**

Before including a convention, ask: "If Claude violated this, would it cause a real problem?"

- **High value**: Violations cause bugs, inconsistency, or architectural damage. Architecture
  boundaries (components must not import from db), security patterns (auth guards, ownership
  checks), API contracts (error response shapes), import conventions that affect build/tooling.
  **Always include these.**

- **Medium value**: Violations cause inconsistency but not breakage. Naming conventions,
  type organization, export style. Include these but mark as medium.

- **Low value — OMIT THESE**: Patterns Claude would follow anyway from reading existing code
  (function vs arrow syntax, where props are defined, logging format). Also omit implementation
  details that describe HOW something was built rather than a rule to follow (e.g., "SSE uses
  TextEncoder" is an implementation detail, not a convention). Also omit patterns that might
  be gaps rather than intentional choices (e.g., "no Zod for API inputs" might mean they
  haven't added it yet, not that it's a convention to avoid it).

**Aim for 8-12 high/medium conventions, not 17+ with filler.** Fewer, stronger rules are
more valuable than a comprehensive list that dilutes signal.

### Handling Special Cases

**Projects with no existing CLAUDE.md:**
When no instruction files exist, this is a greenfield opportunity. Focus on the highest-value
conventions first:
1. Architecture boundaries (import restrictions, layer separation)
2. Error handling patterns (consistent shapes, validation approaches)
3. Testing conventions (framework, file location, assertion style)

After presenting discoveries, offer to create a new CLAUDE.md with the selected rules
organized by category. Use this structure:
```
# Project Instructions

## Architecture
{architecture boundary rules}

## Code Style
{naming, import, export rules}

## Testing
{test framework, file location, assertion rules}

## Workflow
{tool constraints, process rules}
```

**Small projects (fewer than 8 source files):**
Reduce sampling -- read all source files instead of a sample. Adjust evidence thresholds
downward since the sample IS the population:
- 100% consistency: Strong convention (all files follow it)
- 75%+ consistency: Likely convention (most files follow it)
- Below 75%: Not enough evidence with such a small sample

Note to the user: "This is a small project -- conventions may solidify as it grows.
These rules reflect what exists now."

### 6. Offer to Apply

After presenting discoveries, offer to add selected rules to CLAUDE.md:

```
Add rules: [1] [2] [3] [all] — or specify which to add
```

If the user selects rules, add them to the appropriate section of CLAUDE.md. If no
CLAUDE.md exists, create one with the selected rules organized by category.

When adding rules, place them in the most appropriate location:
- General conventions → CLAUDE.md under a "Conventions" heading
- Path-specific rules → `.claude/rules/` with appropriate glob patterns
- Rules that should be automated → note they'd work well as hooks

## Guidelines

- **Evidence threshold** -- use a tiered approach:
  - **90%+ consistency**: Strong convention, high-confidence rule. Include with full confidence.
  - **70-89% consistency**: Likely convention with exceptions. Include but explicitly note the
    exceptions found and whether they appear intentional.
  - **Below 70%**: Not a convention -- do not report it. This is noise, not signal.
- **Not already documented**: Skip conventions that are already in CLAUDE.md or .claude/rules/.
  The value is finding what's MISSING.
- **Actionable rules only**: Every suggested rule must be something Claude can act on.
  "The codebase uses React" is a fact, not a convention. "Use functional components with
  hooks — no class components" is actionable.
- **Respect exceptions**: If a convention has legitimate exceptions (e.g., "no default exports
  except Next.js pages"), capture the exception in the rule.
- **Count, don't guess**: Always cite specific numbers. "All 12 API routes" is credible.
  "The project generally follows..." is vague.

## Related Skills

- **`/lint`** — After adding discovered conventions to CLAUDE.md, use `/lint` to check
  the overall quality of the instruction file
- **`/check`** — Use to verify whether discovered conventions are actually being followed

## Additional Resources

- **`references/convention-categories.md`** — Detailed list of convention categories to
  analyze, with specific patterns to look for and grep commands for detection
