# Test Smell Catalog

Test smells organized by review dimension. Each smell includes what to look for, why it
matters, and how to fix it.

## Assertion Depth Smells

### Existence Assertion

**Detection:** `expect(result).toBeDefined()`, `expect(result).toBeTruthy()`,
`expect(result).not.toBeNull()`

**Why it's a problem:** Passes for ANY non-null value. If the function returns the wrong
user, wrong amount, or wrong status, the test still passes.

**Fix:** Replace with specific value assertion. `expect(result).toEqual(expectedValue)`.

### Bare toHaveBeenCalled

**Detection:** `expect(mock).toHaveBeenCalled()` without argument verification.

**Why it's a problem:** Proves the function was called, but not with the right arguments.
The function could be called with completely wrong data and the test passes.

**Fix:** Use `toHaveBeenCalledWith(specificArgs)` and `toHaveBeenCalledTimes(expectedN)`.

### Length-Only Array Assertion

**Detection:** `expect(results).toHaveLength(N)` as the ONLY array assertion.

**Why it's a problem:** The array has the right number of items, but they could be the
wrong items entirely.

**Fix:** Assert on the actual items: `expect(results).toEqual([...expectedItems])`.

### Status-Only HTTP Assertion

**Detection:** `expect(response.status).toBe(200)` with no body assertion.

**Why it's a problem:** A 200 response with wrong data, wrong headers, or empty body still
passes.

**Fix:** Assert status AND body: `expect(await response.json()).toEqual(expectedBody)`.

## Input Coverage Smells

### Happy Path Tunnel Vision

**Detection:** All test inputs are canonical valid values. No tests for empty, null,
boundary, or invalid inputs.

**Why it's a problem:** The function works for normal inputs — but most bugs are in edge
cases. Empty strings, null values, and boundary conditions are where code breaks.

**Fix:** Apply input space analysis. Add empty/zero, null, boundary, and at least one
invalid input test per function.

### Single Example Per Category

**Detection:** One test for a whole category of inputs (e.g., one "invalid email" test
when there are multiple ways an email can be invalid).

**Why it's a problem:** Tests one failure mode but misses others. Email can be invalid
because: missing @, no domain, empty string, null, too long, contains spaces.

**Fix:** Test the most important 2-3 sub-cases within each category.

### No Boundary Tests

**Detection:** No tests at exact threshold values. If a function accepts 1-100, no tests
for 0, 1, 100, 101.

**Why it's a problem:** Off-by-one errors are among the most common bugs. `<` vs `<=`
differences only show up at exact boundaries.

**Fix:** For every threshold or limit, test: just below, exactly at, just above.

## Error Testing Smells

### Missing Error Tests

**Detection:** Source code has `throw`, `reject`, error returns, or validation checks.
Test file has zero tests that assert on errors.

**Why it's a problem:** Error paths are untested. If someone refactors error handling,
there's no test to catch regressions. More importantly, if error handling is MISSING,
there's no test to reveal it.

**Fix:** For each throwable operation, add at least one test that triggers the error and
asserts on the specific error type and message.

### Generic Error Assertion

**Detection:** `expect(() => fn()).toThrow()` without specifying what error.

**Why it's a problem:** Any error satisfies the assertion — even the wrong error. The
function could throw a TypeError from a typo in the code and the test still passes.

**Fix:** Assert specific error type: `.toThrow(ValidationError)` AND specific message:
`.toThrow("Email is required")`.

### Swallowed Errors

**Detection:** try/catch in test that catches errors without re-throwing or asserting.
```
try { await fn(); } catch (e) { /* test "passes" */ }
```

**Why it's a problem:** The test always passes. If the function throws unexpectedly, the
catch swallows it. If the function doesn't throw when it should, the test also "passes."

**Fix:** Remove the catch. Let the test framework handle unexpected errors. For expected
errors, use the framework's error assertion: `expect(() => fn()).toThrow(Expected)`.

## Mock Health Smells

### Mock Zoo

**Detection:** More than 30% of the test file is mock setup (jest.mock, vi.mock,
mockImplementation, mockReturnValue, etc.).

**Why it's a problem:** When you mock too much, you're testing your mocks, not your code.
The test "passes" because your mock returns what you told it to — it doesn't prove the
real system works.

**Design feedback:** This usually means the code under test has too many dependencies.
Consider dependency injection or extracting pure logic from the coupled code.

### Incomplete Mock Shape

**Detection:** Mock returns a partial shape that doesn't match the real dependency's return
type. E.g., mocking a function that returns `{ data, metadata, error }` with just `{ data }`.

**Why it's a problem:** Code that accesses `metadata` or checks `error` works in the test
(accessing undefined doesn't crash in JS) but fails in production with real data.

**Fix:** Mock the FULL return shape, including fields your test doesn't directly check.

### Internal Module Mocking

**Detection:** `jest.mock("../utils/helper")` or `vi.mock("@/lib/validator")` — mocking
your own code, not external boundaries.

**Why it's a problem:** You're testing that module A calls module B correctly, but not that
module B works. Integration between your own modules is exactly what tests should verify.

**Fix:** Only mock at external boundaries: network, database, filesystem, clock, randomness.
Let your own modules interact for real.

## Specification Clarity Smells

### Vague Test Names

**Detection:** Test names like `"it works"`, `"test 1"`, `"should handle correctly"`,
`"returns expected value"`.

**Why it's a problem:** You can't read the test names and understand the contract. When a
test fails, the name doesn't tell you what broke.

**Fix:** Test names should be specifications: `"rejects empty email with ValidationError"`,
`"returns empty array when search matches nothing"`, `"applies 20% discount for gold members"`.

### Duplicated Context in Names

**Detection:** All test names start with the same prefix that's already in the describe
block. `describe("createUser") → test("createUser returns user")`.

**Why it's a problem:** Noise. The describe block already provides context.

**Fix:** Test names should describe the specific behavior, not repeat the function name.

## Independence Smells

### Shared Mutable State

**Detection:** Variables declared outside test blocks that are mutated inside them.
`let counter = 0;` at describe level, incremented in tests.

**Why it's a problem:** Tests depend on execution order. Reordering or running a subset
produces different results.

**Fix:** Each test sets up its own state. Use `beforeEach` for shared setup that creates
FRESH state, not accumulated state.

### Missing Cleanup

**Detection:** Database records, files, or global state created in tests but not cleaned
up in afterEach/afterAll.

**Why it's a problem:** State leaks between tests. A test that creates user "alice" may
cause a subsequent test to fail with "duplicate email."

**Fix:** Clean up in `afterEach`. Or use transactions that roll back after each test.

### Test Order Dependency

**Detection:** Test B only passes when test A runs first (because A creates state B needs).

**Why it's a problem:** Tests should be runnable independently and in any order.

**Fix:** Each test creates its own preconditions. If B needs a user, B creates the user
in its own setup.
