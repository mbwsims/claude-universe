---
name: test
description: >-
  Use when the user wants new tests authored for a specific file, function, or module:
  "write tests", "add tests", "generate tests for", "test this function", "test this file",
  or "/test". This skill writes high-quality tests; it is not the default for running an
  existing test suite, debugging a failing test run, or reviewing current tests.
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Write
  - Edit
  - mcp__testkit__testkit_map
argument-hint: "[file-or-function]"
---

# Test

Generate tests that catch real bugs. Runs autonomously — detects the framework, analyzes
the code, and writes the test file. No intermediate questions or planning steps.

Complements the superpowers TDD skill. If TDD discipline is active (red-green-refactor
cycle), defer to superpowers for the PROCESS of when to write vs. run vs. refactor. This
skill provides the CONTENT — what to test, how to assert, what edge cases to consider.

## Workflow

Run all phases in sequence without stopping for user input.

### 1. Detect Context (silently)

Do all of this automatically without asking the user:

- **Call `testkit_map`**: If the testkit MCP server is available, call `testkit_map` first.
  It returns the project's test framework, all test files mapped to source files, untested
  source files ranked by criticality, and a coverage ratio. Use this data to skip manual
  discovery and focus on what matters.
  - If `testkit_map` is unavailable, perform manual discovery as described below.
- **Find the target**: If a file was specified, use it. If not, infer from conversation
  context (last file discussed, last file edited). If truly ambiguous, ask — but this
  should be rare.
- **Detect the framework**: Check `package.json` scripts, config files (`vitest.config.*`,
  `jest.config.*`, `pytest.ini`, `Cargo.toml`), or existing test files. Match the project's
  conventions (describe/it vs test, file naming, directory structure).
- **Find existing tests**: Check if a test file already exists for this target. If so,
  read it — build on what's there rather than starting from scratch.
- **Check for a plan**: If a `/test-plan` output exists earlier in the conversation, use
  it as the blueprint and implement every "must" and "should" row.

If no test framework exists at all, pick the standard one for the stack (vitest for
TypeScript, pytest for Python, go test for Go) and set it up.

> **Scope guard — framework setup:** If you need to set up a test framework from scratch,
> do only the minimum: install the package, create a minimal config file, verify it runs.
> Do NOT refactor the project's build system, add CI configuration, or configure coverage
> tools. Those are separate concerns. Write the tests and move on.

> **Fallback — no test runner available:** If the test runner cannot be executed (e.g.,
> missing dependencies, Docker-only environment, or CI-only test setup), write the test
> file anyway and note at the end: "Tests written but not verified — run `{command}` to
> execute." Do not block on runner availability.

### 2. Analyze the Code (internally)

Read the target and extract:
- **Contract**: What it promises — inputs, outputs, errors, side effects
- **Input space**: Systematically enumerate categories per parameter (canonical, empty,
  boundary, invalid, null, adversarial). Use `references/input-space-analysis.md`.
- **Test architecture**: Pure function → unit test. Stateful/external → integration.
  Use `references/test-architecture.md`.
- **Mock boundaries**: Mock external systems only. Never mock your own modules.
- **Domain patterns**: Check `references/domain-strategies.md` for auth, pagination,
  file upload, webhooks, etc.

Do NOT present the analysis to the user or ask for confirmation. This is internal
reasoning that produces better tests. The user sees the output — the tests.

### 3. Write the Tests

Write the complete test file following these rules:

**Assert VALUES, not existence.**
- Never: `expect(result).toBeDefined()`, `expect(result).toBeTruthy()`
- Always: `expect(result).toEqual({ id: '123', name: 'Alice', role: 'admin' })`

**Assert EFFECTS, not internals.**
- Never: `expect(mockService.save).toHaveBeenCalled()`
- Always: `expect(await db.users.findById('123')).toEqual(expectedUser)`

**Test names are specifications.**
- Never: `test('it works')`, `test('test createUser')`
- Always: `test('rejects empty email with ValidationError')`

**Error tests are first-class.** For every success path, write at least one corresponding
failure test. Assert specific error type AND message.

**One behavior per test.** Each test verifies one input-to-output mapping.

Consult `references/assertion-depth.md` for deep assertion patterns.

**Organize the test file as:** setup → happy path → error paths → edge cases → cleanup.

### 4. Write the File and Verify

Write the test file to the appropriate location (match the project's convention for test
file placement — co-located, `__tests__/`, or `test/` directory).

Then run the tests:
```bash
# Detect and run the appropriate test command
npm test -- --run {test-file}  # or vitest run, pytest, go test, etc.
```

If tests fail due to implementation issues (not test issues), note what needs fixing.
If tests fail due to test issues, fix the tests.

## Output

Write the test file directly. After writing, provide a brief summary:

```
Wrote {n} tests to {test-file-path}
  {n} happy path · {n} error paths · {n} edge cases
  {pass/fail status if tests were run}
```

No input space tables, no planning artifacts, no intermediate steps shown to the user
unless they asked for them (use `/test-plan` for that).

## Guidelines

- **Just work.** Detect everything from context. Don't ask questions that can be answered
  by reading the project.
- **Build on existing tests.** If a test file exists, add to it — don't overwrite.
- **Match project conventions.** Import style, test structure, naming patterns, file location
  should all match what the project already does.
- **Be thorough but not exhaustive.** Cover must-have cases (happy path, error paths,
  key boundaries). Skip adversarial/combinatorial unless the code is security-critical
  or user-facing.
- **Run the tests.** Verify they pass. Fix issues before presenting as done.

## Related Skills

- **`/test-plan`** — Plan what to test without writing code (the "thinking step" extracted)
- **`/test-review`** — Grade existing tests and find gaps

## Additional Resources

- **`references/input-space-analysis.md`** — Input categories by data type
- **`references/assertion-depth.md`** — Shallow-to-deep assertion upgrades
- **`references/test-architecture.md`** — Unit vs. integration decision framework
- **`references/domain-strategies.md`** — Domain-specific testing strategies
