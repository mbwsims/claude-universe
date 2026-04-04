# Diagnostic Codes Reference

Each diagnostic returned by `alignkit_lint` has a code, severity, and message. Use this
reference to understand what each code means and how to advise the user.

## VAGUE (warning)

**Meaning:** The rule uses weasel words or hedging language that makes it ambiguous.
Common triggers: "try to", "when possible", "generally", "consider", "as needed",
"appropriate", "should probably".

**How to advise:** Suggest a concrete rewrite that eliminates ambiguity. Replace hedging
with specific conditions or thresholds.

- Bad: "Try to write tests when possible"
- Good: "Write tests for all new functions. Skip only for generated code."

## CONFLICT (warning)

**Meaning:** Two rules appear to contradict each other. Detected by matching opposing
patterns: "always X" vs "never X", "must" vs "must not" for related actions.

**How to advise:** Read both rules carefully. Determine if they genuinely conflict or
if they apply to different scopes. If genuinely conflicting, suggest removing one or
adding scope qualifiers. If false positive (different contexts), note that they don't
actually conflict.

**Note:** The conflict detector has known false positives — it matches keyword patterns
across unrelated rules. Use judgment about whether the conflict is real.

## REDUNDANT (warning)

**Meaning:** Two rules have high text similarity (>70% token overlap) and likely say
the same thing in different words.

**How to advise:** Suggest merging into a single, stronger rule that preserves all
constraints from both originals. Note the token savings from consolidation.

## ORDERING (warning)

**Meaning:** A high-priority rule (tool constraint, process ordering) appears late in
the file. Rules earlier in the file get more attention from the agent.

**How to advise:** Suggest moving the rule to the top of its section or to an earlier
section. High-priority categories in order: tool constraints, process ordering, code
structure, meta, style guidance, behavioral.

## PLACEMENT (warning)

**Meaning:** A rule would be better served by a different mechanism than a CLAUDE.md
line. The diagnostic includes a `placement` object with the suggested target.

**Targets and what they mean:**

- **scoped-rule**: Rule applies to specific file patterns. Move to `.claude/rules/`
  with a glob pattern in the filename (e.g., `.claude/rules/test-*.md`). Saves token
  budget and applies automatically to matching files.

- **hook**: Rule describes deterministic automation (e.g., "always run lint after
  editing"). Convert to a Claude Code hook (PreToolUse, PostToolUse, etc.) for
  guaranteed enforcement without using instruction budget.

- **skill**: Rule describes a reusable multi-step workflow (e.g., "when deploying,
  first run tests, then build, then deploy"). Move to `.claude/skills/` as a
  specialized skill that activates on demand.

- **subagent**: Rule describes a specialized autonomous task (e.g., "when reviewing
  code, check for security issues, performance problems, and style violations").
  Move to `.claude/agents/` as a subagent.

**How to advise:** Explain the specific mechanism and why it's better. "This rule
checks file paths, so it belongs in `.claude/rules/` where it auto-applies to matching
files and doesn't consume your CLAUDE.md token budget."

## LINTER_JOB (warning)

**Meaning:** The rule describes something that should be enforced by a linter or
formatter, not by an instruction file. Examples: "Use 2-space indentation",
"Always add semicolons", "Sort imports alphabetically".

**How to advise:** Suggest configuring the appropriate tool (ESLint, Prettier,
rustfmt, etc.) instead. These tools provide deterministic enforcement that's faster
and more reliable than instruction-based enforcement. The rule wastes token budget.

## WEAK_EMPHASIS (warning)

**Meaning:** A high-priority rule (tool constraint, process ordering) lacks emphasis
markers. Critical rules should use MUST, NEVER, ALWAYS, IMPORTANT, or CRITICAL to
signal their importance to the agent.

**How to advise:** Suggest adding emphasis. "Run tests before committing" →
"ALWAYS run tests before committing." Only apply to genuinely critical rules — not
every rule needs emphasis.

## METADATA (error)

**Meaning:** An instruction file has invalid or missing metadata. For agent files:
missing required frontmatter fields. For skill files: missing SKILL.md or invalid
frontmatter. For instruction files: structural issues.

**How to advise:** Show the specific metadata issue and what needs to be fixed.
This is typically a formatting/structural fix, not a content issue.

---

The following codes are NOT returned by `alignkit_lint`. They are produced by the CLI's
`--deep` mode. In this plugin, the equivalent analysis is performed directly in steps 3-5
of the workflow. These codes are documented here for reference only.

## EFFECTIVENESS (warning)

**Meaning:** Deep analysis rated the rule as MEDIUM or LOW effectiveness.

**How to advise:** Check the message for the specific reason. Common reasons:
- "Claude already knows this from reading the code" → suggest removal (REMOVE)
- "References tools not in project" → suggest updating or removing
- "Too vague to be actionable" → suggest concrete rewrite

## COVERAGE_GAP (warning)

**Meaning:** Deep analysis identified a missing area of coverage. Only present
when deep analysis has been run.

**How to advise:** Present the suggested rule text and the evidence for why
it's needed.

## CONSOLIDATION (warning)

**Meaning:** Deep analysis identified rules that could merge. Only present when
deep analysis has been run.

**How to advise:** Show the merge suggestion with the original rules and the
proposed merged text.

## REWRITE (warning)

**Meaning:** Deep analysis produced a suggested rewrite for a LOW-effectiveness
or vague rule. Only present when deep analysis has been run.

**How to advise:** Present the rewrite alongside the original. If the suggested
rewrite is "REMOVE", recommend deleting the rule entirely.

## STALE (warning)

**Meaning:** A rule references a version number that may be outdated.

**How to advise:** Verify the current version and suggest updating the rule,
or removing the version reference if the rule should be version-agnostic.
