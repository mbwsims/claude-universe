# Scoring Rubric

Grading methodology for test reviews. Each dimension is scored A-F, then combined into an
overall grade.

## Per-Dimension Scoring

### A (Excellent)

No issues found in this dimension. The tests demonstrate mastery.

- **Assertion depth**: All assertions are on specific values. No `toBeDefined()` or
  `toBeTruthy()` for checking return values.
- **Input coverage**: Happy path + empty/null + boundary + at least one error input tested.
- **Error testing**: Every throwable operation has a corresponding error test with specific
  error type and message.
- **Mock health**: Mocks only at external boundaries. Mock shapes match real dependency
  contracts. Mock setup is less than 20% of the file.
- **Specification clarity**: Every test name reads as a requirement. Someone could
  reconstruct the function's contract from test names alone.
- **Independence**: No shared mutable state. Each test could run in isolation.

### B (Good)

Minor gaps that are unlikely to let bugs through but could be improved.

- **Assertion depth**: 1-2 shallow assertions in the file, rest are deep.
- **Input coverage**: Happy path + some edge cases, but missing one category (e.g., no
  boundary tests or no null tests).
- **Error testing**: Most throwable operations covered, one gap. Error assertions are
  mostly specific.
- **Mock health**: Mocks are reasonable but one internal module is mocked unnecessarily.
- **Specification clarity**: Most names are good, 1-2 are vague.
- **Independence**: Mostly independent, minor shared state that doesn't cause issues.

### C (Functional)

Tests exist and verify basic behavior, but have gaps that could let real bugs through.

- **Assertion depth**: 30-50% of assertions are shallow.
- **Input coverage**: Happy path only, with maybe one error case.
- **Error testing**: Some error tests exist but fewer than half the throwable operations
  are covered. Error assertions are generic (`.toThrow()` without specifics).
- **Mock health**: Over-mocking present. Some internal modules mocked. Mock shapes may
  be incomplete.
- **Specification clarity**: Mix of good and vague names.
- **Independence**: Some shared state, tests mostly work in any order.

### D (Weak)

Tests provide minimal confidence. Significant blind spots.

- **Assertion depth**: Majority of assertions are shallow. Many `toBeDefined()`.
- **Input coverage**: Only the most obvious happy path tested.
- **Error testing**: Zero or one error test for multiple throwable operations.
- **Mock health**: Mock zoo — more mock setup than assertions.
- **Specification clarity**: Most names are vague or generic.
- **Independence**: Tests have order dependencies or shared mutable state.

### F (Failing)

Tests give false confidence. They pass but prove almost nothing.

- **Assertion depth**: Nearly all assertions are shallow — tests pass for wrong values.
- **Input coverage**: Single happy-path test per function.
- **Error testing**: No error tests at all.
- **Mock health**: Everything is mocked, including internal logic.
- **Specification clarity**: Names like "test 1", "it works", "should work".
- **Independence**: Significant state leakage between tests.

## Overall Grade Calculation

The overall grade is NOT a simple average. Weight by importance:

| Dimension | Weight | Rationale |
|-----------|--------|-----------|
| Error testing | 3.0 | Missing error tests is the #1 cause of production bugs |
| Assertion depth | 2.5 | Shallow assertions give false confidence |
| Mock health | 1.5 | Over-mocking means tests prove nothing about real behavior |
| Specification clarity | 1.0 | Important for maintainability, less for bug-catching |
| Input coverage | -- | Semantic only (not measured by testkit_analyze) |
| Independence | -- | Semantic only (not measured by testkit_analyze) |

The weighted GPA is computed as: `sum(grade_value * weight) / sum(weights)` where grade
values are: A=4.0, A-=3.7, B+=3.3, B=3.0, B-=2.7, C+=2.3, C=2.0, C-=1.7, D=1.0, F=0.0.

**Null dimensions:** When the testkit analyzer cannot measure a dimension (e.g., no
throwable operations means error testing is null, no test names means spec clarity is
null), that dimension is EXCLUDED from the weighted average -- it does not count as zero.
This means a project where error testing is not applicable (no throwable code) will be
graded on the remaining dimensions, not penalized for the unmeasurable one.

Input coverage and independence are ALWAYS null in the deterministic analyzer because they
require semantic analysis. When reviewing manually, score these dimensions and factor them
into the overall grade using professional judgment.

**Grade caps (hard limits that override the weighted average):**
- No error tests at all (error testing = F) -> overall capped at C
- More than 50% shallow assertions (assertion depth <= C) -> overall capped at C+
- Everything mocked (>50% mock setup, mock health = D or worse) -> overall capped at C

## One-Line Summaries by Grade

- **A**: Comprehensive — tests catch edge cases and error paths with precision
- **A-**: Strong — minor gaps but thorough coverage of important paths
- **B+**: Good — covers main scenarios, a few edges cases missing
- **B**: Solid — reliable for happy path, some gaps in error testing
- **B-**: Decent — works but could catch more bugs
- **C+**: Functional but misses real bugs — edge cases and errors undertested
- **C**: Basic — verifies obvious behavior only
- **C-**: Minimal — passes but proves little
- **D**: Weak — significant blind spots, low confidence
- **F**: False confidence — tests pass but catch nothing
