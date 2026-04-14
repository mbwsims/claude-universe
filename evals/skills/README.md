# Skill Evals

This directory contains committed review fixtures for the highest-priority Claude Universe
commands.

Each JSON file captures:

- `command`: the skill under review
- `intent`: the user outcome the skill is supposed to serve
- `shouldTrigger`: prompts that should activate the skill
- `shouldNotTrigger`: prompts that should stay with another command or no skill
- `smokeWorkflow`: one representative end-to-end use case
- `comparisonNotes`: only for commands where baseline-vs-skill framing matters

These fixtures are documentation and review artifacts for this first pass. They are meant to
make trigger scope and intended behavior explicit before an automated LLM harness exists.

Use them alongside:

- `npm run test:skills` for frontmatter/tool-declaration validation
- manual Claude Code checks for trigger behavior on the listed prompts

See [`follow-up.md`](./follow-up.md) for additional trigger-cleanup candidates that were audited
but intentionally left out of scope in this pass.
