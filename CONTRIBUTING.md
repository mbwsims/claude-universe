# Contributing

## Skill validation

This repo ships a dedicated skill validation path:

```bash
npm run test:skills
```

It validates the checked-in `skills/**/SKILL.md` inventory for:

- required frontmatter
- tool-declaration drift between `allowed-tools` and the skill body
- warning-level lint/conformance issues reported for review

Trigger and smoke-review fixtures for the highest-priority commands live under
[`evals/skills/`](./evals/skills/README.md).
