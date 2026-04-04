---
name: test-plan
description: >-
  This skill should be used when the user asks to "plan tests", "what should I test",
  "what tests do I need", "test plan for", "testing strategy for", "test matrix for",
  "what cases should I cover", "help me plan tests", mentions "/test-plan", or wants to
  understand what tests are needed before writing any test code.
allowed-tools:
  - Read
  - Glob
  - Grep
  - mcp__testkit__testkit_map
argument-hint: "[file-or-function]"
---

# Test Plan

Produce a structured test plan without writing any test code. Analyze the target code,
decompose its input space, recommend test architecture, and identify mock boundaries.
The output is a table that reveals gaps in the developer's mental model of what needs
testing.

Useful for:
- Planning before writing tests
- Reviewing whether existing tests have coverage gaps
- Understanding what a function's test suite SHOULD look like
- Sharing with a team to align on testing expectations

## Workflow

### 1. Read the Target

If `testkit_map` is available, call it to understand which functions already have tests
and which need plans. This avoids planning for code that's already well-tested.

Read the code to be tested. If a specific function was named, focus on that. If a file or
module was named, analyze each exported function/class.

### 2. Extract the Contract

For each function/class, document:

- **Signature**: Parameters with types and constraints
- **Returns**: What it returns, including all possible shapes
- **Throws**: What errors it can produce and under what conditions
- **Side effects**: Database writes, network calls, file operations, state mutations, events

### 3. Decompose the Input Space

Apply input space analysis (see `skills/test/references/input-space-analysis.md`
for the full methodology) to produce a table for each function:

```
### Input Space — {functionName}({params})

| Category | Input | Expected | Priority |
|----------|-------|----------|----------|
| Canonical | {typical valid input} | {expected output} | must |
| Empty | {empty/zero variant} | {error or default} | must |
| Boundary | {at threshold} | {edge behavior} | must |
| Null | {null/undefined} | {error} | must |
| Invalid | {wrong type/value} | {error} | should |
| Adversarial | {attack input} | {safe handling} | should |
| Combinatorial | {conflicting options} | {defined behavior} | nice |
```

Mark each row:
- **must** — Core behavior that absolutely needs a test
- **should** — Important edge case, should be tested for production code
- **nice** — Nice to have, test if time permits

### 4. Recommend Test Architecture

Based on the code archetype (see `skills/test/references/test-architecture.md`):

- **Pure function** → Unit tests only, no mocks
- **Stateful service** → Integration tests with real storage
- **API handler** → Integration test of request/response cycle
- **UI component** → Behavioral tests (render + interact + assert)
- **Event handler** → Direct handler tests with crafted events

### 5. Identify Mock Boundaries

Explicitly state:
- What to mock (external systems: database, network, filesystem, clock)
- What NOT to mock (your own modules, internal logic)
- Whether integration testing is preferable to mocking

### 6. Present the Plan

**Output format:**

```
## Test Plan — {function/module name}

### Contract
{Summary of what the code promises}

### Input Space
{Table from step 3}

### Architecture
{Unit / Integration / Both — and why}

### Mock Boundary
- Mock: {list of external dependencies to mock}
- Real: {list of internal modules to test through}

### Summary
{N} tests planned: {n} must, {n} should, {n} nice-to-have
```

For a module with multiple functions, produce one plan per function, then a summary of
total tests planned.

## Guidelines

- The plan should be actionable. Someone should be able to hand it to a developer (or to
  `/test`) and get a complete test suite written from it.
- Prioritize ruthlessly. Every function does NOT need adversarial tests. Focus "must" on
  the inputs that are most likely to cause real bugs.
- If the function is trivial (one-liner, no branching), say so. Not everything needs 12
  test cases.
- For functions that are already well-tested, note what's covered and what's missing rather
  than producing a full plan from scratch.

## Related Skills

- **`/test`** — Hand the plan to `/test` to generate the actual test code
- **`/test-review`** — Use to grade existing tests against the plan

## Additional Resources

- **`references/plan-templates.md`** — Pre-filled input space templates by code archetype
