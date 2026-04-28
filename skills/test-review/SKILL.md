---
name: test-review
description: >-
  This skill should be used when the user asks to "review my tests", "are these tests good",
  "check my test quality", "audit these tests", "grade my tests", "test quality check",
  "are these tests testing the right things", "test coverage quality", mentions "/test-review",
  or wants to evaluate the quality of existing test files.
allowed-tools:
  - Read
  - Glob
  - Grep
  - mcp__testkit__testkit_analyze
argument-hint: "[test-file]"
---

# Test Review

Evaluate existing tests for quality issues that let bugs through. Grades test files on six
dimensions and produces a scorecard with specific, actionable findings — not generic advice.

This is not about code style or formatting. It is about whether the tests actually catch bugs.

## Workflow

### 0. Deterministic Analysis (if available)

Call `testkit_analyze` with the target test file. If available, use the structured metrics
(shallow assertion count, error coverage ratio, mock health, name quality) as the foundation
for dimension scoring in step 3. Supplement with semantic analysis for dimensions the tool
cannot measure (input coverage, independence).

If `testkit_analyze` is unavailable, perform full manual analysis as described below.
Note to the user: "Running without testkit-mcp — analysis is based on code reading.
Install testkit-mcp (`npm install -g testkit-mcp`) for precise metrics."

### 1. Identify Target

If a test file was specified, read it. Otherwise, discover test files using Glob:
`**/*.test.*`, `**/*.spec.*`, `**/__tests__/**`.

If multiple test files are found and none was specified, review the most recently modified
test file. Use `ls -t` or equivalent to determine modification order. Do not ask the user
to choose — pick the most recent one and note it: "Reviewing {filename} (most recently
modified test file). Specify a file to review a different one."

### 2. Read the Test and Its Source

Read both:
1. The review target spec
2. The code under test (infer from imports, file naming, or directory structure)

Understanding the source code's contract is essential for evaluating whether the tests
cover the right things.

### 3. Evaluate Six Dimensions

Score each dimension using letter grades (A through F, with + and - for fine-grained
distinctions). Consult `references/smell-catalog.md` for detection patterns and
`references/scoring-rubric.md` for calibration.

**Dimension 1: Assertion Depth**
- Are assertions on specific values or just existence?
- Count: `toBeDefined`, `toBeTruthy`, `toHaveBeenCalled` without arguments
- Each shallow assertion is a potential false-pass

**Dimension 2: Input Coverage**
- Does the reviewed file cover more than the happy path?
- Check: are there tests for empty input, null, boundary values, invalid input?
- Compare against input space categories: canonical, empty, boundary, null, invalid,
  adversarial. Each parameter should have test coverage for at least the "must" categories
  (canonical + empty + boundary + one error case).

**Dimension 3: Error Testing**
- For each function in the source that can throw/reject, is there a corresponding error test?
- Count throwable functions vs error tests. Ratio below 1:1 is a gap.
- Are error assertions specific (type + message) or generic (just `.toThrow()`)?

**Dimension 4: Mock Health**
- Are mocks minimal (external boundaries only) or pervasive (mocking internal modules)?
- Do mocks preserve the contract of the mocked dependency (realistic return shapes)?
- What percentage of the spec is mock setup vs actual assertions?

**Dimension 5: Specification Clarity**
- Do test names read as requirements? ("rejects empty email with ValidationError")
- Or are they vague? ("test1", "it works", "should handle error")
- Can someone read ONLY the test names and understand the full contract?

**Dimension 6: Independence**
- Can tests run in any order without affecting results?
- Is there shared mutable state (global variables, uncleared database state)?
- Does `beforeEach` properly reset state, or does it accumulate?

### 3b. Compare Against Plan (if available)

If a /test-plan was produced for this code earlier in the conversation:
- Check each "must" row in the plan's input space table
- Mark which rows have corresponding tests and which are missing
- Add missing plan items to the Priority Fixes section as:
  "Missing from plan: {category} — {input} → {expected}"

This catches the gap between "what we planned to test" and "what we actually tested."

### 4. Produce the Scorecard

**Report format:**

```
## Test Review — {test-file-name}

**Grade: {letter}** — {one-line summary}

| Dimension | Score | Finding |
|-----------|-------|---------|
| Assertion depth | {A-F} | {specific finding with count} |
| Input coverage | {A-F} | {what's missing} |
| Error testing | {A-F} | {count of gaps} |
| Mock health | {A-F} | {assessment} |
| Specification clarity | {A-F} | {assessment} |
| Independence | {A-F} | {assessment} |

### Priority Fixes

1. **{file}:{line}** — {specific issue}
   {What to change and why — what bugs this would catch}

2. **Missing: {category}** — {what tests don't exist}
   {Specific test cases to add}

3. ...
```

### 5. Suggest Missing Tests

After the scorecard, list the most important tests that don't exist yet. These should be
concrete — specific input values, specific expected outputs, specific error types. Not
"add more edge case tests" but "add a test for empty email that expects ValidationError."

## Guidelines

- Grade honestly. Most test files Claude reviews will score B or C — that's expected.
  A-grade test suites are rare.
- Every finding must cite a specific line number or specific missing test case.
- Don't spend findings on stylistic cleanup — this review is about bug-catching quality.
- If the reviewed spec is genuinely good (comprehensive coverage, deep assertions), say so.
  Don't invent problems.
- The grade should be useful: someone should be able to look at "C+" and know "functional
  but has gaps that could let bugs through."

## Related Skills

- **`/test`** — Use to fix issues found in the review
- **`/test-plan`** — Use to identify missing coverage categories before adding tests

## Additional Resources

- **`references/smell-catalog.md`** — Test smells organized by dimension with detection
  patterns, fixes, and before/after examples
- **`references/scoring-rubric.md`** — Grading methodology with calibrated examples at
  each grade level
