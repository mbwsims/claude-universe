# Phase 2: Diagnose (testkit) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Diagnose subsystem (testkit MCP server, 3 skills, 1 agent, 7 references) from B+ to A by fixing analyzer bugs, adding Python support, improving skill/agent/reference content, and adding comprehensive test coverage.

**Architecture:** Six task groups executed sequentially: (1) fix MCP analyzer bugs and add comment stripping, (2) add Python language support across all analyzers, (3) fix the status tool to share discovery, (4) fix skill and agent content, (5) fix all 7 reference files, (6) add new tests and fix existing ones. All analyzer changes follow TDD -- write the failing test first, then implement the fix.

**Tech Stack:** TypeScript (ES2022, NodeNext), vitest, globby, Markdown (skill/agent/reference files)

---

### Task 1: Fix `shallow-assertions.ts` -- remove false-positive patterns and add comment stripping

**Files:**
- Modify: `mcp/testkit/src/analyzers/__tests__/shallow-assertions.test.ts`
- Modify: `mcp/testkit/src/analyzers/shallow-assertions.ts`

The current `SHALLOW_PATTERNS` array includes `toBeNull()` and `toBeUndefined()`. These are NOT shallow assertions -- they test for a specific value (null or undefined). Remove them. Also, the analyzer currently counts assertions inside comments (e.g. `// expect(x).toBeDefined()` in a code example), which inflates counts. Add comment stripping before analysis.

- [ ] **Step 1: Write test -- toBeNull should NOT be flagged as shallow**

In `mcp/testkit/src/analyzers/__tests__/shallow-assertions.test.ts`, add this test inside the existing `describe('analyzeShallowAssertions', ...)` block, after the last existing `it(...)` test (after the "reports correct line numbers" test at line 91):

```typescript
  it('does not flag toBeNull as shallow since it tests a specific value', () => {
    const content = `
      expect(result).toBeNull();
      expect(other).toBe(42);
    `;
    const result = analyzeShallowAssertions(content);
    expect(result.count).toBe(0);
    expect(result.total).toBe(2);
  });
```

Run: `cd mcp/testkit && npx vitest run src/analyzers/__tests__/shallow-assertions.test.ts 2>&1 | tail -20`
Expected: FAIL -- currently `toBeNull()` IS in `SHALLOW_PATTERNS`, so `count` will be 1, not 0.

- [ ] **Step 2: Write test -- toBeUndefined should NOT be flagged as shallow**

In the same test file, add after the previous test:

```typescript
  it('does not flag toBeUndefined as shallow since it tests a specific value', () => {
    const content = `
      expect(result).toBeUndefined();
      expect(other).toBe('hello');
    `;
    const result = analyzeShallowAssertions(content);
    expect(result.count).toBe(0);
    expect(result.total).toBe(2);
  });
```

Run: `cd mcp/testkit && npx vitest run src/analyzers/__tests__/shallow-assertions.test.ts 2>&1 | tail -20`
Expected: FAIL -- `toBeUndefined()` IS in `SHALLOW_PATTERNS`.

- [ ] **Step 3: Write test -- assertions inside comments should be ignored**

Add after the previous test:

```typescript
  it('ignores assertions inside single-line comments', () => {
    const content = `
      // expect(result).toBeDefined(); -- this is a comment
      expect(value).toBe(42);
    `;
    const result = analyzeShallowAssertions(content);
    expect(result.count).toBe(0);
    expect(result.total).toBe(1);
  });

  it('ignores assertions inside multi-line block comments', () => {
    const content = `
      /* expect(result).toBeTruthy(); */
      expect(value).toEqual({ id: '1' });
    `;
    const result = analyzeShallowAssertions(content);
    expect(result.count).toBe(0);
    expect(result.total).toBe(1);
  });
```

Run: `cd mcp/testkit && npx vitest run src/analyzers/__tests__/shallow-assertions.test.ts 2>&1 | tail -20`
Expected: FAIL -- comment stripping does not exist yet, so commented-out assertions are still counted.

- [ ] **Step 4: Implement -- remove toBeNull and toBeUndefined from SHALLOW_PATTERNS**

In `mcp/testkit/src/analyzers/shallow-assertions.ts`, replace the `SHALLOW_PATTERNS` array (lines 11-17):

**Current:**
```typescript
const SHALLOW_PATTERNS: Array<{ regex: RegExp; kind: string }> = [
  { regex: /\.toBeDefined\(\)/g, kind: 'toBeDefined' },
  { regex: /\.toBeTruthy\(\)/g, kind: 'toBeTruthy' },
  { regex: /\.toBeFalsy\(\)/g, kind: 'toBeFalsy' },
  { regex: /\.toBeNull\(\)/g, kind: 'toBeNull' },
  { regex: /\.toBeUndefined\(\)/g, kind: 'toBeUndefined' },
];
```

**Replace with:**
```typescript
// toBeNull() and toBeUndefined() are NOT shallow -- they assert a specific value.
// Only patterns that pass for ANY non-null/non-undefined value are shallow.
const SHALLOW_PATTERNS: Array<{ regex: RegExp; kind: string }> = [
  { regex: /\.toBeDefined\(\)/g, kind: 'toBeDefined' },
  { regex: /\.toBeTruthy\(\)/g, kind: 'toBeTruthy' },
  { regex: /\.toBeFalsy\(\)/g, kind: 'toBeFalsy' },
];
```

- [ ] **Step 5: Implement -- add comment stripping helper and use it in analyzeShallowAssertions**

In `mcp/testkit/src/analyzers/shallow-assertions.ts`, add this function before the `analyzeShallowAssertions` function:

```typescript
/** Strip single-line (//) and multi-line block comments from source text. */
function stripComments(content: string): string {
  // Remove block comments (non-greedy, handles multi-line)
  let stripped = content.replace(/\/\*[\s\S]*?\*\//g, (match) => {
    // Preserve line count by replacing with same number of newlines
    const newlines = match.split('\n').length - 1;
    return '\n'.repeat(newlines);
  });
  // Remove single-line comments
  stripped = stripped.replace(/\/\/.*$/gm, '');
  return stripped;
}
```

Then modify the `analyzeShallowAssertions` function to strip comments at the start. Replace line 23:

**Current:**
```typescript
export function analyzeShallowAssertions(content: string): ShallowAssertionResult {
  const lines = content.split('\n');
```

**Replace with:**
```typescript
export function analyzeShallowAssertions(content: string): ShallowAssertionResult {
  const lines = stripComments(content).split('\n');
```

- [ ] **Step 6: Update existing test that asserted toBeNull as shallow**

The existing test "handles multiple shallow assertions on different lines" (lines 68-79) asserts that `toBeNull()` counts as shallow. Update it.

**Current (lines 68-79):**
```typescript
  it('handles multiple shallow assertions on different lines', () => {
    const content = `
      expect(a).toBeDefined();
      expect(b).toBeTruthy();
      expect(c).toBeNull();
      expect(d).toEqual('real value');
    `;
    const result = analyzeShallowAssertions(content);
    expect(result.count).toBe(3);
    expect(result.total).toBe(4);
    expect(result.locations.map(l => l.line)).toEqual([2, 3, 4]);
  });
```

**Replace with:**
```typescript
  it('handles multiple shallow assertions on different lines', () => {
    const content = `
      expect(a).toBeDefined();
      expect(b).toBeTruthy();
      expect(c).toBeNull();
      expect(d).toEqual('real value');
    `;
    const result = analyzeShallowAssertions(content);
    // toBeNull is NOT shallow -- only toBeDefined and toBeTruthy are
    expect(result.count).toBe(2);
    expect(result.total).toBe(4);
    expect(result.locations.map(l => l.line)).toEqual([2, 3]);
  });
```

- [ ] **Step 7: Verify all tests pass**

Run: `cd mcp/testkit && npx vitest run src/analyzers/__tests__/shallow-assertions.test.ts 2>&1 | tail -20`
Expected: All tests pass including new ones.

- [ ] **Step 8: Commit**

```bash
cd mcp/testkit && git add src/analyzers/shallow-assertions.ts src/analyzers/__tests__/shallow-assertions.test.ts
git commit -m "fix(testkit): remove toBeNull/toBeUndefined from shallow patterns, add comment stripping"
```

---

### Task 2: Fix `error-coverage.ts` -- escape dot in regex and add comment stripping

**Files:**
- Modify: `mcp/testkit/src/analyzers/__tests__/error-coverage.test.ts`
- Modify: `mcp/testkit/src/analyzers/error-coverage.ts`

The regex `/.reject\(/` on line 19 has an unescaped dot, matching things like `xreject(` or `_reject(`. The correct pattern is `/\.reject\(/`. Also need comment stripping to avoid counting throwable patterns in comments.

- [ ] **Step 1: Write test -- unescaped dot causes false positive on `.reject(`**

In `mcp/testkit/src/analyzers/__tests__/error-coverage.test.ts`, add a new test after the last existing test (after the "does not flag bare reject()" test at line 86):

```typescript
  it('does not flag methods ending in reject like onReject as throwable', () => {
    const source = `
      function onReject(reason) {
        console.log(reason);
      }
      onReject('something');
    `;
    const test = `test('x', () => {});`;
    const result = analyzeErrorCoverage(source, test);
    expect(result.throwable).toBe(0);
  });
```

Run: `cd mcp/testkit && npx vitest run src/analyzers/__tests__/error-coverage.test.ts 2>&1 | tail -20`
Expected: FAIL -- the unescaped dot in `/.reject\(/` matches `onReject(` because the `.` matches `n`.

- [ ] **Step 2: Write test -- commented-out throw should not be counted**

Add after the previous test:

```typescript
  it('ignores throwable operations inside comments', () => {
    const source = `
      // throw new Error('old code');
      /* throw new Error('disabled'); */
      return 'ok';
    `;
    const test = `test('x', () => {});`;
    const result = analyzeErrorCoverage(source, test);
    expect(result.throwable).toBe(0);
  });

  it('ignores error test patterns inside comments in test file', () => {
    const source = `throw new Error('fail');`;
    const test = `
      // expect(() => fn()).toThrow('old');
      /* .rejects.toThrow() */
      test('x', () => {});
    `;
    const result = analyzeErrorCoverage(source, test);
    expect(result.tested).toBe(0);
  });
```

Run: `cd mcp/testkit && npx vitest run src/analyzers/__tests__/error-coverage.test.ts 2>&1 | tail -20`
Expected: FAIL -- no comment stripping exists.

- [ ] **Step 3: Implement -- fix the regex and add comment stripping**

In `mcp/testkit/src/analyzers/error-coverage.ts`, add the `stripComments` helper before `analyzeErrorCoverage` and fix the regex. Replace lines 14-36 (everything from `// Patterns that indicate` through the function signature):

**Current:**
```typescript
// Patterns that indicate a function can throw/reject
const THROWABLE_PATTERNS = [
  /\bthrow\s+new\b/,
  /\bthrow\s+\w/,
  /Promise\.reject\(/,
  /\.reject\(/,
];

// Patterns that indicate an error is being tested
const ERROR_TEST_PATTERNS = [
  /\.toThrow\(/,
  /\.toThrowError\(/,
  /\.rejects\./,
  /expect\.unreachable/,
  /\.toThrow\(\)/,
];

export function analyzeErrorCoverage(
  sourceContent: string,
  testContent: string
): ErrorCoverageResult {
  const sourceLines = sourceContent.split('\n');
  const testLines = testContent.split('\n');
```

**Replace with:**
```typescript
// Patterns that indicate a function can throw/reject
const THROWABLE_PATTERNS = [
  /\bthrow\s+new\b/,
  /\bthrow\s+\w/,
  /Promise\.reject\(/,
  /\.reject\(/,        // escaped dot -- only matches .reject(, not onReject(
];

// Patterns that indicate an error is being tested
const ERROR_TEST_PATTERNS = [
  /\.toThrow\(/,
  /\.toThrowError\(/,
  /\.rejects\./,
  /expect\.unreachable/,
  /\.toThrow\(\)/,
];

/** Strip single-line (//) and multi-line block comments from source text. */
function stripComments(content: string): string {
  // Remove block comments (non-greedy, handles multi-line)
  let stripped = content.replace(/\/\*[\s\S]*?\*\//g, (match) => {
    const newlines = match.split('\n').length - 1;
    return '\n'.repeat(newlines);
  });
  // Remove single-line comments
  stripped = stripped.replace(/\/\/.*$/gm, '');
  return stripped;
}

export function analyzeErrorCoverage(
  sourceContent: string,
  testContent: string
): ErrorCoverageResult {
  const sourceLines = stripComments(sourceContent).split('\n');
  const testLines = stripComments(testContent).split('\n');
```

Note: The regex `/.reject\(/` displayed in the source read shows `\/\.reject\(/` which may already have the escaped dot. If the test in Step 1 passes (meaning the dot IS already escaped), the regex fix is a no-op. The comment stripping is the critical change.

- [ ] **Step 4: Verify all tests pass**

Run: `cd mcp/testkit && npx vitest run src/analyzers/__tests__/error-coverage.test.ts 2>&1 | tail -20`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
cd mcp/testkit && git add src/analyzers/error-coverage.ts src/analyzers/__tests__/error-coverage.test.ts
git commit -m "fix(testkit): add comment stripping to error-coverage analyzer, verify regex escaping"
```

---

### Task 3: Fix `name-quality.ts` -- lower word count threshold and remove 'handles' from generics

**Files:**
- Modify: `mcp/testkit/src/analyzers/__tests__/name-quality.test.ts`
- Modify: `mcp/testkit/src/analyzers/name-quality.ts`

The word count threshold of 4 is too aggressive -- `test('rejects empty email')` is 3 words and is a perfectly good test name. Also, `'handles'` is in GENERIC_TERMS but it is commonly used in legitimate test names like `'handles concurrent requests gracefully'`. Also add a domain-specific word heuristic: names containing words like camelCase identifiers, technical terms, or domain nouns (e.g., `ValidationError`, `userId`, `OAuth`) should get a pass even if short.

- [ ] **Step 1: Write test -- 3-word name with domain specificity should NOT be flagged**

In `mcp/testkit/src/analyzers/__tests__/name-quality.test.ts`, add after the last test:

```typescript
  it('does not flag 3-word test names that contain domain-specific terms', () => {
    const content = `
      test('rejects empty email', () => {});
      test('validates OAuth token', () => {});
      test('handles ConnectionError gracefully', () => {});
    `;
    const result = analyzeNameQuality(content);
    expect(result.total).toBe(3);
    expect(result.vague).toBe(0);
  });
```

Run: `cd mcp/testkit && npx vitest run src/analyzers/__tests__/name-quality.test.ts 2>&1 | tail -20`
Expected: FAIL -- all 3 names have fewer than 4 words (current threshold), so all are flagged as vague.

- [ ] **Step 2: Write test -- 'handles' should no longer be generic**

Add after the previous test:

```typescript
  it('does not treat handles as a generic term', () => {
    const content = `test('handles concurrent requests without data loss', () => {});`;
    const result = analyzeNameQuality(content);
    expect(result.total).toBe(1);
    expect(result.vague).toBe(0);
  });
```

Run: `cd mcp/testkit && npx vitest run src/analyzers/__tests__/name-quality.test.ts 2>&1 | tail -20`
Expected: This might pass already since the name is 6 words with non-generic content. But the test documents the intent.

- [ ] **Step 3: Write test -- 2-word names should still be flagged**

Add after the previous test:

```typescript
  it('still flags 2-word names as too short', () => {
    const content = `test('it works', () => {});`;
    const result = analyzeNameQuality(content);
    expect(result.vague).toBe(1);
    expect(result.vagueNames[0].reason).toBe('fewer than 3 words');
  });
```

Run: `cd mcp/testkit && npx vitest run src/analyzers/__tests__/name-quality.test.ts 2>&1 | tail -20`
Expected: FAIL -- the current reason string says 'fewer than 4 words', not 'fewer than 3 words'.

- [ ] **Step 4: Write test -- domain-specific word heuristic**

Add after the previous test:

```typescript
  it('considers camelCase words as domain-specific and does not flag short names with them', () => {
    const content = `
      test('returns userId correctly', () => {});
      test('throws ValidationError', () => {});
    `;
    const result = analyzeNameQuality(content);
    expect(result.total).toBe(2);
    expect(result.vague).toBe(0);
  });
```

Run: `cd mcp/testkit && npx vitest run src/analyzers/__tests__/name-quality.test.ts 2>&1 | tail -20`
Expected: FAIL -- no domain-specific heuristic exists.

- [ ] **Step 5: Implement -- lower threshold, remove 'handles', add specificity heuristic**

In `mcp/testkit/src/analyzers/name-quality.ts`, make these changes:

**Replace lines 11-16 (GENERIC_TERMS):**

**Current:**
```typescript
const GENERIC_TERMS = new Set([
  'works', 'correct', 'correctly', 'properly', 'right',
  'good', 'fine', 'ok', 'okay', 'test', 'tests',
  'handles', 'check', 'checks', 'verify', 'verifies',
]);
```

**Replace with:**
```typescript
const GENERIC_TERMS = new Set([
  'works', 'correct', 'correctly', 'properly', 'right',
  'good', 'fine', 'ok', 'okay', 'test', 'tests',
  'check', 'checks', 'verify', 'verifies',
  // Note: 'handles' removed -- it is commonly used in legitimate descriptive names
  // like 'handles concurrent requests gracefully'
]);
```

**Replace the `isVagueName` function (lines 20-48):**

**Current:**
```typescript
function isVagueName(name: string): { vague: boolean; reason: string } {
  const words = name.split(/\s+/).filter(w => w.length > 0);

  // Too short
  if (words.length < 4) {
    return { vague: true, reason: 'fewer than 4 words' };
  }

  // Numbered test names
  if (/^test\s*\d+$/i.test(name.trim())) {
    return { vague: true, reason: 'numbered test name' };
  }

  // All words are generic
  const nonGenericWords = words.filter(w => !GENERIC_TERMS.has(w.toLowerCase()));
  if (nonGenericWords.length <= 1) {
    return { vague: true, reason: 'mostly generic terms' };
  }

  // Starts with "should" + only generic words
  if (words[0].toLowerCase() === 'should' && words.length <= 3) {
    const rest = words.slice(1);
    if (rest.every(w => GENERIC_TERMS.has(w.toLowerCase()))) {
      return { vague: true, reason: 'vague "should" pattern' };
    }
  }

  return { vague: false, reason: '' };
}
```

**Replace with:**
```typescript
/**
 * Heuristic: a word is "domain-specific" if it contains camelCase, PascalCase,
 * or is a known technical term pattern (e.g., contains uppercase mid-word,
 * contains digits mid-word like 'base64', or is longer than 8 chars).
 */
function isDomainSpecificWord(word: string): boolean {
  // camelCase or PascalCase: has an uppercase letter after a lowercase letter
  if (/[a-z][A-Z]/.test(word)) return true;
  // PascalCase: starts uppercase and has another uppercase or lowercase transition
  if (/^[A-Z][a-z]+[A-Z]/.test(word)) return true;
  // Contains digits mid-word (e.g., 'base64', 'utf8')
  if (/[a-zA-Z]\d/.test(word) || /\d[a-zA-Z]/.test(word)) return true;
  return false;
}

function isVagueName(name: string): { vague: boolean; reason: string } {
  const words = name.split(/\s+/).filter(w => w.length > 0);

  // Numbered test names (check first -- always vague regardless of length)
  if (/^test\s*\d+$/i.test(name.trim())) {
    return { vague: true, reason: 'numbered test name' };
  }

  // Too short -- but allow 3-word names if they contain domain-specific words
  if (words.length < 3) {
    return { vague: true, reason: 'fewer than 3 words' };
  }

  if (words.length === 3) {
    // 3-word names are acceptable if at least one word is domain-specific
    const hasDomainWord = words.some(w => isDomainSpecificWord(w));
    const nonGenericWords = words.filter(w => !GENERIC_TERMS.has(w.toLowerCase()));
    if (!hasDomainWord && nonGenericWords.length <= 1) {
      return { vague: true, reason: 'fewer than 3 non-generic words' };
    }
    // 3 words with at least 2 non-generic words or a domain-specific word: OK
  }

  // All words are generic
  const nonGenericWords = words.filter(w => !GENERIC_TERMS.has(w.toLowerCase()));
  if (nonGenericWords.length <= 1) {
    return { vague: true, reason: 'mostly generic terms' };
  }

  // Starts with "should" + only generic words
  if (words[0].toLowerCase() === 'should' && words.length <= 3) {
    const rest = words.slice(1);
    if (rest.every(w => GENERIC_TERMS.has(w.toLowerCase()))) {
      return { vague: true, reason: 'vague "should" pattern' };
    }
  }

  return { vague: false, reason: '' };
}
```

- [ ] **Step 6: Update existing test that asserts 'fewer than 4 words'**

In `mcp/testkit/src/analyzers/__tests__/name-quality.test.ts`, update the test on lines 23-27:

**Current:**
```typescript
  it('flags names with fewer than 4 words', () => {
    const content = `test('it works', () => {});`;
    const result = analyzeNameQuality(content);
    expect(result.vague).toBe(1);
    expect(result.vagueNames[0].reason).toBe('fewer than 4 words');
  });
```

**Replace with:**
```typescript
  it('flags names with fewer than 3 words', () => {
    const content = `test('it works', () => {});`;
    const result = analyzeNameQuality(content);
    expect(result.vague).toBe(1);
    expect(result.vagueNames[0].reason).toBe('fewer than 3 words');
  });
```

- [ ] **Step 7: Verify all tests pass**

Run: `cd mcp/testkit && npx vitest run src/analyzers/__tests__/name-quality.test.ts 2>&1 | tail -20`
Expected: All tests pass including new ones.

- [ ] **Step 8: Commit**

```bash
cd mcp/testkit && git add src/analyzers/name-quality.ts src/analyzers/__tests__/name-quality.test.ts
git commit -m "fix(testkit): lower word threshold to 3, remove handles from generics, add domain-specificity heuristic"
```

---

### Task 4: Fix `scoring.ts` -- correct error-testing cap and mock-health cap

**Files:**
- Modify: `mcp/testkit/src/analyzers/__tests__/scoring.test.ts`
- Modify: `mcp/testkit/src/analyzers/scoring.ts`

Two bugs: (1) The error-testing cap triggers on both F AND D, but per the rubric, only F (no error tests at all) should cap at C. D means some error tests exist. (2) Document null dimension handling with JSDoc.

- [ ] **Step 1: Write test -- error testing D should NOT cap the overall grade**

In `mcp/testkit/src/analyzers/__tests__/scoring.test.ts`, add after the "returns C when no measurable dimensions" test:

```typescript
  it('does NOT cap at C when error testing is D (some tests exist)', () => {
    const grade = computeOverallGrade({
      assertionDepth: 'A',
      inputCoverage: null,
      errorTesting: 'D',
      mockHealth: 'A',
      specClarity: 'A',
      independence: null,
    });
    // D error testing drags the average down but should not trigger the C cap.
    // Only F (zero error tests) triggers the cap per the rubric.
    expect(grade).not.toBe('C');
    // With weights: errorTesting(D=1.0)*3 + assertionDepth(A=4.0)*2.5 + mockHealth(A=4.0)*1.5 + specClarity(A=4.0)*1
    // = 3.0 + 10.0 + 6.0 + 4.0 = 23.0 / 8.0 = 2.875 -> B
    expect(grade).toBe('B');
  });
```

Run: `cd mcp/testkit && npx vitest run src/analyzers/__tests__/scoring.test.ts 2>&1 | tail -20`
Expected: FAIL -- current code caps at C when error testing is D.

- [ ] **Step 2: Write test -- document null dimension handling**

Add to the `describe('computeOverallGrade', ...)` block:

```typescript
  it('handles mix of null and non-null dimensions correctly', () => {
    // When a dimension is null, it is excluded from the weighted average
    // (not counted as zero -- it simply reduces the denominator)
    const grade = computeOverallGrade({
      assertionDepth: null,
      inputCoverage: null,
      errorTesting: 'A',
      mockHealth: null,
      specClarity: null,
      independence: null,
    });
    // Only errorTesting is non-null. A = 4.0. Average = 4.0 / 1 = 4.0 -> A
    expect(grade).toBe('A');
  });
```

Run: `cd mcp/testkit && npx vitest run src/analyzers/__tests__/scoring.test.ts 2>&1 | tail -20`
Expected: This should pass with existing code since null dimensions are already skipped.

- [ ] **Step 3: Write test -- mock health cap at D or worse**

Add to the same describe block:

```typescript
  it('caps at C when mock health is D or worse (excessive mock setup)', () => {
    const grade = computeOverallGrade({
      assertionDepth: 'A',
      inputCoverage: null,
      errorTesting: 'A',
      mockHealth: 'D',
      specClarity: 'A',
      independence: null,
    });
    expect(grade).toBe('C');
  });

  it('does NOT cap when mock health is C- (moderate issues, not excessive)', () => {
    const grade = computeOverallGrade({
      assertionDepth: 'A',
      inputCoverage: null,
      errorTesting: 'A',
      mockHealth: 'C-',
      specClarity: 'A',
      independence: null,
    });
    // C- mock health should drag average down but not trigger the hard cap
    expect(grade).not.toBe('C');
  });
```

- [ ] **Step 4: Implement -- fix the error testing cap in computeOverallGrade**

In `mcp/testkit/src/analyzers/scoring.ts`, replace lines 129-133:

**Current:**
```typescript
  // Grade caps from the scoring rubric
  if (dimensions.errorTesting === 'F' || dimensions.errorTesting === 'D') {
    const cap = 'C';
    if (GRADE_VALUES[overall] > GRADE_VALUES[cap]) overall = cap;
  }
```

**Replace with:**
```typescript
  // Grade caps from the scoring rubric
  // Only F (no error tests at all) triggers the C cap.
  // D means SOME error tests exist -- it drags down the average but doesn't hard-cap.
  if (dimensions.errorTesting === 'F') {
    const cap: Grade = 'C';
    if (GRADE_VALUES[overall] > GRADE_VALUES[cap]) overall = cap;
  }
```

- [ ] **Step 5: Add JSDoc comment for null dimension handling**

In the same file, add a comment above `computeOverallGrade`. Replace line 105:

**Current:**
```typescript
export function computeOverallGrade(dimensions: DimensionScores): Grade {
```

**Replace with:**
```typescript
/**
 * Compute the overall grade from dimension scores using a weighted average.
 *
 * Null dimensions are excluded from the calculation entirely -- they do not
 * count as zero. This means a project with only one measurable dimension will
 * be graded on that dimension alone, not penalized for unmeasurable ones.
 *
 * The `inputCoverage` and `independence` dimensions are always null because
 * they require semantic analysis that the deterministic analyzer cannot perform.
 *
 * Grade caps (hard limits that override the weighted average):
 * - errorTesting === 'F' (zero error tests) -> capped at C
 * - assertionDepth <= C (>40% shallow) -> capped at C+
 * - mockHealth <= D (>50% mock setup lines) -> capped at C
 */
export function computeOverallGrade(dimensions: DimensionScores): Grade {
```

- [ ] **Step 6: Verify all tests pass**

Run: `cd mcp/testkit && npx vitest run src/analyzers/__tests__/scoring.test.ts 2>&1 | tail -20`
Expected: All tests pass including new ones.

- [ ] **Step 7: Commit**

```bash
cd mcp/testkit && git add src/analyzers/scoring.ts src/analyzers/__tests__/scoring.test.ts
git commit -m "fix(testkit): only cap at C for F error-testing (not D), document null dimension handling"
```

---

### Task 5: Fix `discovery.ts` -- remove types exclusion and add Python detection

**Files:**
- Modify: `mcp/testkit/src/analyzers/discovery.ts`
- Create: `mcp/testkit/src/analyzers/__tests__/discovery.test.ts`

Five fixes: (1) Remove `**/types/**` from source file exclusions -- type definition files may contain runtime code. (2) Add Python test file detection (`test_*.py`, `*_test.py`). (3) Add Python source file detection patterns. (4) Improve pytest/unittest framework detection. (5) Add `admin` to HIGH_CRITICALITY_PATTERNS and `queue/worker/job` to MEDIUM_CRITICALITY_PATTERNS.

- [ ] **Step 1: Create the discovery test file with path inference tests**

Create `mcp/testkit/src/analyzers/__tests__/discovery.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { inferSourcePath, classifyCriticality, isTestFile } from '../discovery.js';

describe('inferSourcePath', () => {
  it('infers source from .test. file in same directory', () => {
    const result = inferSourcePath('src/utils/helper.test.ts');
    expect(result).toBe('src/utils/helper.ts');
  });

  it('infers source from .spec. file in same directory', () => {
    const result = inferSourcePath('src/utils/helper.spec.ts');
    expect(result).toBe('src/utils/helper.ts');
  });

  it('infers source from __tests__ directory to parent', () => {
    const result = inferSourcePath('src/utils/__tests__/helper.test.ts');
    expect(result).toBe('src/utils/__tests__/helper.ts');
  });

  it('returns null for files that do not match test naming patterns', () => {
    const result = inferSourcePath('src/utils/helper.ts');
    expect(result).toBeNull();
  });

  it('handles .tsx test files', () => {
    const result = inferSourcePath('src/components/Button.test.tsx');
    expect(result).toBe('src/components/Button.tsx');
  });

  it('handles .js test files', () => {
    const result = inferSourcePath('src/utils/helper.test.js');
    expect(result).toBe('src/utils/helper.js');
  });

  it('infers source from tests/ to src/ directory mirror', () => {
    const result = inferSourcePath('tests/utils/helper.test.ts');
    expect(result).toBe('tests/utils/helper.ts');
  });

  it('handles Python test files with test_ prefix', () => {
    const result = inferSourcePath('tests/test_utils.py');
    expect(result).toBe('tests/utils.py');
  });

  it('handles Python test files with _test suffix', () => {
    const result = inferSourcePath('tests/utils_test.py');
    expect(result).toBe('tests/utils.py');
  });
});

describe('classifyCriticality', () => {
  it('classifies auth files as high priority', () => {
    const result = classifyCriticality('src/services/auth-service.ts');
    expect(result.priority).toBe('high');
  });

  it('classifies payment files as high priority', () => {
    const result = classifyCriticality('src/services/payment-processor.ts');
    expect(result.priority).toBe('high');
  });

  it('classifies security files as high priority', () => {
    const result = classifyCriticality('src/middleware/security.ts');
    expect(result.priority).toBe('high');
  });

  it('classifies webhook files as high priority', () => {
    const result = classifyCriticality('src/routes/webhook-handler.ts');
    expect(result.priority).toBe('high');
  });

  it('classifies admin files as high priority', () => {
    const result = classifyCriticality('src/routes/admin-panel.ts');
    expect(result.priority).toBe('high');
  });

  it('classifies service files as medium priority', () => {
    const result = classifyCriticality('src/services/user-service.ts');
    expect(result.priority).toBe('medium');
  });

  it('classifies controller files as medium priority', () => {
    const result = classifyCriticality('src/controllers/user-controller.ts');
    expect(result.priority).toBe('medium');
  });

  it('classifies queue files as medium priority', () => {
    const result = classifyCriticality('src/queue/email-queue.ts');
    expect(result.priority).toBe('medium');
  });

  it('classifies worker files as medium priority', () => {
    const result = classifyCriticality('src/workers/email-worker.ts');
    expect(result.priority).toBe('medium');
  });

  it('classifies job files as medium priority', () => {
    const result = classifyCriticality('src/jobs/cleanup-job.ts');
    expect(result.priority).toBe('medium');
  });

  it('classifies utility files as low priority', () => {
    const result = classifyCriticality('src/utils/format.ts');
    expect(result.priority).toBe('low');
  });

  it('classifies unknown files as low priority', () => {
    const result = classifyCriticality('src/lib/helpers.ts');
    expect(result.priority).toBe('low');
  });
});

describe('isTestFile', () => {
  it('detects .test. files as test files', () => {
    expect(isTestFile('src/utils/helper.test.ts')).toBe(true);
  });

  it('detects .spec. files as test files', () => {
    expect(isTestFile('src/utils/helper.spec.ts')).toBe(true);
  });

  it('detects __tests__ directory files as test files', () => {
    expect(isTestFile('src/utils/__tests__/helper.ts')).toBe(true);
  });

  it('does not flag regular source files as test files', () => {
    expect(isTestFile('src/utils/helper.ts')).toBe(false);
  });

  it('detects Python test_ prefix files as test files', () => {
    expect(isTestFile('tests/test_utils.py')).toBe(true);
  });

  it('detects Python _test suffix files as test files', () => {
    expect(isTestFile('tests/utils_test.py')).toBe(true);
  });
});
```

Run: `cd mcp/testkit && npx vitest run src/analyzers/__tests__/discovery.test.ts 2>&1 | tail -20`
Expected: FAIL -- `classifyCriticality` and `isTestFile` are not exported, Python patterns not supported, `admin`/`queue`/`worker`/`job` patterns don't exist yet.

- [ ] **Step 2: Implement all discovery.ts changes**

In `mcp/testkit/src/analyzers/discovery.ts`, make these changes:

**2a. Add Python test patterns to TEST_PATTERNS (lines 23-27):**

**Current:**
```typescript
const TEST_PATTERNS = [
  '**/*.test.*',
  '**/*.spec.*',
  '**/__tests__/**/*.*',
];
```

**Replace with:**
```typescript
const TEST_PATTERNS = [
  '**/*.test.*',
  '**/*.spec.*',
  '**/__tests__/**/*.*',
  '**/test_*.py',
  '**/*_test.py',
];
```

**2b. Remove `'**/types/**'` from discoverSourceFiles ignore patterns (lines 137-143):**

**Current:**
```typescript
export async function discoverSourceFiles(cwd: string): Promise<string[]> {
  const allFiles = await globby(['**/*'], {
    cwd,
    ignore: [...IGNORE_PATTERNS, ...TEST_PATTERNS, '**/*.d.ts', '**/types/**'],
    absolute: false,
  });
```

**Replace with:**
```typescript
export async function discoverSourceFiles(cwd: string): Promise<string[]> {
  const allFiles = await globby(['**/*'], {
    cwd,
    // Note: **/types/** removed -- type files may contain runtime code
    ignore: [...IGNORE_PATTERNS, ...TEST_PATTERNS, '**/*.d.ts'],
    absolute: false,
  });
```

**2c. Add `admin` to HIGH_CRITICALITY_PATTERNS (lines 45-54):**

**Current:**
```typescript
const HIGH_CRITICALITY_PATTERNS = [
  /auth/i, /login/i, /session/i, /token/i,
  /payment/i, /billing/i, /checkout/i, /charge/i, /invoice/i,
  /security/i, /permission/i, /access/i, /rbac/i, /acl/i,
  /middleware/i,
  /migrat/i,
  /password/i, /credential/i, /secret/i,
  /encrypt/i, /decrypt/i, /hash/i,
  /webhook/i,
];
```

**Replace with:**
```typescript
const HIGH_CRITICALITY_PATTERNS = [
  /auth/i, /login/i, /session/i, /token/i,
  /payment/i, /billing/i, /checkout/i, /charge/i, /invoice/i,
  /security/i, /permission/i, /access/i, /rbac/i, /acl/i,
  /middleware/i,
  /migrat/i,
  /password/i, /credential/i, /secret/i,
  /encrypt/i, /decrypt/i, /hash/i,
  /webhook/i,
  /admin/i,
];
```

**2d. Add `queue/worker/job` to MEDIUM_CRITICALITY_PATTERNS (lines 56-63):**

**Current:**
```typescript
const MEDIUM_CRITICALITY_PATTERNS = [
  /service/i, /controller/i, /handler/i, /resolver/i,
  /repository/i, /store/i, /model/i,
  /api/i, /route/i, /endpoint/i,
  /database/i, /db/i, /query/i,
  /cache/i,
];
```

**Replace with:**
```typescript
const MEDIUM_CRITICALITY_PATTERNS = [
  /service/i, /controller/i, /handler/i, /resolver/i,
  /repository/i, /store/i, /model/i,
  /api/i, /route/i, /endpoint/i,
  /database/i, /db/i, /query/i,
  /cache/i,
  /queue/i, /worker/i, /job/i,
];
```

**2e. Export `classifyCriticality` and `isTestFile` for testability (lines 64 and 84):**

Change line 64 from:
```typescript
function classifyCriticality(filePath: string): { priority: 'high' | 'medium' | 'low'; reason: string } {
```
To:
```typescript
export function classifyCriticality(filePath: string): { priority: 'high' | 'medium' | 'low'; reason: string } {
```

Change line 84 from:
```typescript
function isTestFile(filePath: string): boolean {
```
To:
```typescript
export function isTestFile(filePath: string): boolean {
```

**2f. Add Python test file detection to `isTestFile`:**

**Current:**
```typescript
export function isTestFile(filePath: string): boolean {
  const name = basename(filePath);
  return /\.(test|spec)\./.test(name) || filePath.includes('__tests__');
}
```

**Replace with:**
```typescript
export function isTestFile(filePath: string): boolean {
  const name = basename(filePath);
  return /\.(test|spec)\./.test(name)
    || filePath.includes('__tests__')
    || /^test_.*\.py$/.test(name)
    || /.*_test\.py$/.test(name);
}
```

**2g. Add Python test file mapping to `inferSourcePath`. Replace the entire function (lines 89-126):**

**Current:**
```typescript
export function inferSourcePath(testPath: string, cwd?: string): string | null {
  const dir = dirname(testPath);
  const name = basename(testPath);

  const match = name.match(/^(.+)\.(test|spec)(\.[^.]+)$/);
  if (!match) return null;

  const sourceName = `${match[1]}${match[3]}`;
  const candidates: string[] = [];

  // Same directory
  candidates.push(join(dir, sourceName));

  // If in __tests__, try parent directory
  if (dir.includes('__tests__')) {
    const parentDir = dir.replace(/__tests__\/?/, '');
    candidates.push(join(parentDir, sourceName));
  }

  // Try tests/ -> src/ directory mirror
  if (dir.startsWith('test') || dir.startsWith('tests')) {
    const srcDir = dir.replace(/^tests?/, 'src');
    candidates.push(join(srcDir, sourceName));
  }

  // If cwd provided, verify existence and return first match
  if (cwd) {
    for (const candidate of candidates) {
      if (existsSync(join(cwd, candidate))) {
        return candidate;
      }
    }
    return null;
  }

  // Without cwd, return best guess (first candidate)
  return candidates[0];
}
```

**Replace with:**
```typescript
export function inferSourcePath(testPath: string, cwd?: string): string | null {
  const dir = dirname(testPath);
  const name = basename(testPath);

  // Standard JS/TS test naming: foo.test.ts -> foo.ts, foo.spec.tsx -> foo.tsx
  const jsMatch = name.match(/^(.+)\.(test|spec)(\.[^.]+)$/);

  // Python test naming: test_foo.py -> foo.py, foo_test.py -> foo.py
  const pyTestPrefixMatch = name.match(/^test_(.+\.py)$/);
  const pyTestSuffixMatch = name.match(/^(.+)_test(\.py)$/);

  let sourceName: string | null = null;

  if (jsMatch) {
    sourceName = `${jsMatch[1]}${jsMatch[3]}`;
  } else if (pyTestPrefixMatch) {
    sourceName = pyTestPrefixMatch[1];
  } else if (pyTestSuffixMatch) {
    sourceName = `${pyTestSuffixMatch[1]}${pyTestSuffixMatch[2]}`;
  }

  if (!sourceName) return null;

  const candidates: string[] = [];

  // Same directory
  candidates.push(join(dir, sourceName));

  // If in __tests__, try parent directory
  if (dir.includes('__tests__')) {
    const parentDir = dir.replace(/__tests__\/?/, '');
    candidates.push(join(parentDir, sourceName));
  }

  // Try tests/ -> src/ directory mirror
  if (dir.startsWith('test') || dir.startsWith('tests')) {
    const srcDir = dir.replace(/^tests?/, 'src');
    candidates.push(join(srcDir, sourceName));
  }

  // If cwd provided, verify existence and return first match
  if (cwd) {
    for (const candidate of candidates) {
      if (existsSync(join(cwd, candidate))) {
        return candidate;
      }
    }
    return null;
  }

  // Without cwd, return best guess (first candidate)
  return candidates[0];
}
```

**2h. Add improved pytest/unittest detection to `detectFramework`. Replace the entire function (lines 146-177):**

**Current:**
```typescript
export async function detectFramework(cwd: string): Promise<string | null> {
  const configPatterns: Record<string, string> = {
    'vitest.config.*': 'vitest',
    'jest.config.*': 'jest',
    'pytest.ini': 'pytest',
    'pyproject.toml': 'pytest',
    'Cargo.toml': 'cargo-test',
    'go.mod': 'go-test',
  };

  for (const [pattern, framework] of Object.entries(configPatterns)) {
    const matches = await globby(pattern, { cwd, ignore: IGNORE_PATTERNS });
    if (matches.length > 0) return framework;
  }

  // Check package.json for test framework deps
  try {
    const pkgContent = await readFile(join(cwd, 'package.json'), 'utf-8');
    const pkg = JSON.parse(pkgContent);
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (allDeps.vitest) return 'vitest';
    if (allDeps.jest) return 'jest';
    if (allDeps.mocha) return 'mocha';
    if (allDeps.ava) return 'ava';
    if (allDeps.tap) return 'tap';
  } catch {
    // no package.json
  }

  return null;
}
```

**Replace with:**
```typescript
export async function detectFramework(cwd: string): Promise<string | null> {
  const configPatterns: Record<string, string> = {
    'vitest.config.*': 'vitest',
    'jest.config.*': 'jest',
    'pytest.ini': 'pytest',
    'setup.cfg': 'pytest',       // setup.cfg can contain [tool:pytest]
    'Cargo.toml': 'cargo-test',
    'go.mod': 'go-test',
  };

  for (const [pattern, framework] of Object.entries(configPatterns)) {
    const matches = await globby(pattern, { cwd, ignore: IGNORE_PATTERNS });
    if (matches.length > 0) return framework;
  }

  // Check pyproject.toml for pytest or unittest config
  try {
    const pyprojectContent = await readFile(join(cwd, 'pyproject.toml'), 'utf-8');
    if (pyprojectContent.includes('[tool.pytest') || pyprojectContent.includes('pytest')) {
      return 'pytest';
    }
  } catch {
    // no pyproject.toml
  }

  // Check package.json for test framework deps
  try {
    const pkgContent = await readFile(join(cwd, 'package.json'), 'utf-8');
    const pkg = JSON.parse(pkgContent);
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (allDeps.vitest) return 'vitest';
    if (allDeps.jest) return 'jest';
    if (allDeps.mocha) return 'mocha';
    if (allDeps.ava) return 'ava';
    if (allDeps.tap) return 'tap';
  } catch {
    // no package.json
  }

  // Check for Python test files as a fallback for pytest detection
  const pyTestFiles = await globby(['**/test_*.py', '**/*_test.py'], {
    cwd,
    ignore: IGNORE_PATTERNS,
  });
  if (pyTestFiles.length > 0) {
    // Check if any test file imports unittest
    try {
      for (const testFile of pyTestFiles.slice(0, 5)) {
        const content = await readFile(join(cwd, testFile), 'utf-8');
        if (content.includes('import unittest') || content.includes('from unittest')) {
          return 'unittest';
        }
      }
    } catch {
      // file read error
    }
    return 'pytest'; // default Python test framework
  }

  return null;
}
```

- [ ] **Step 3: Verify all discovery tests pass**

Run: `cd mcp/testkit && npx vitest run src/analyzers/__tests__/discovery.test.ts 2>&1 | tail -20`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
cd mcp/testkit && git add src/analyzers/discovery.ts src/analyzers/__tests__/discovery.test.ts
git commit -m "feat(testkit): add Python test detection, export classifyCriticality, add admin/queue/worker/job patterns, remove types exclusion"
```

---

### Task 6: Add Python pattern support to `shallow-assertions.ts`

**Files:**
- Modify: `mcp/testkit/src/analyzers/__tests__/shallow-assertions.test.ts`
- Modify: `mcp/testkit/src/analyzers/shallow-assertions.ts`

Add detection for Python shallow assertion patterns: bare `assert result` (no comparison operator) and `assert result is not None` (existence check equivalent to toBeDefined).

- [ ] **Step 1: Write tests for Python shallow patterns**

In `mcp/testkit/src/analyzers/__tests__/shallow-assertions.test.ts`, add a new describe block at the end (after the closing `});` of the existing describe):

```typescript
describe('analyzeShallowAssertions — Python patterns', () => {
  it('detects bare assert as shallow', () => {
    const content = `
      def test_user_creation():
          result = create_user("alice")
          assert result
    `;
    const result = analyzeShallowAssertions(content);
    expect(result.count).toBe(1);
    expect(result.locations[0].kind).toBe('bareAssert');
  });

  it('does not flag assert with comparison as shallow', () => {
    const content = `
      def test_user_creation():
          result = create_user("alice")
          assert result == {"name": "alice"}
          assert result.name == "alice"
          assert len(result) == 1
    `;
    const result = analyzeShallowAssertions(content);
    expect(result.count).toBe(0);
  });

  it('detects assert is not None as shallow', () => {
    const content = `
      def test_user_exists():
          user = get_user("alice")
          assert user is not None
    `;
    const result = analyzeShallowAssertions(content);
    expect(result.count).toBe(1);
    expect(result.locations[0].kind).toBe('assertIsNotNone');
  });

  it('counts Python assert statements in total assertion count', () => {
    const content = `
      def test_example():
          assert result
          assert value == 42
          assert name == "alice"
    `;
    const result = analyzeShallowAssertions(content);
    expect(result.total).toBeGreaterThanOrEqual(3);
    expect(result.count).toBe(1);  // only 'assert result' is shallow
  });

  it('does not flag assert with in operator as shallow', () => {
    const content = `
      def test_membership():
          assert "alice" in users
          assert key in config
    `;
    const result = analyzeShallowAssertions(content);
    expect(result.count).toBe(0);
  });

  it('does not flag assert with not or negation as shallow', () => {
    const content = `
      def test_not_equal():
          assert result != "error"
          assert not is_empty(data)
    `;
    const result = analyzeShallowAssertions(content);
    expect(result.count).toBe(0);
  });
});
```

Run: `cd mcp/testkit && npx vitest run src/analyzers/__tests__/shallow-assertions.test.ts 2>&1 | tail -20`
Expected: FAIL -- no Python pattern support exists.

- [ ] **Step 2: Implement Python shallow patterns**

In `mcp/testkit/src/analyzers/shallow-assertions.ts`, add Python-specific patterns. After the `BARE_CALLED_REGEX` line (line 20), add:

```typescript
// Python shallow patterns:
// - bare `assert result` with no comparison operator (==, !=, >, <, >=, <=, in, not, is)
// - `assert X is not None` is the Python equivalent of toBeDefined()
const PYTHON_SHALLOW_PATTERNS: Array<{ regex: RegExp; kind: string }> = [
  // Matches `assert <expr>` where <expr> has NO comparison operator and is NOT `not ...`
  // This catches `assert result`, `assert user`, but not `assert result == 42`
  { regex: /^\s*assert\s+(?!not\b)[a-zA-Z_]\w*(\.[a-zA-Z_]\w*)*\s*$/g, kind: 'bareAssert' },
  // Matches `assert X is not None`
  { regex: /^\s*assert\s+.+\s+is\s+not\s+None\s*$/g, kind: 'assertIsNotNone' },
];

// Python total assertion count: any line starting with `assert `
const PYTHON_ASSERT_REGEX = /^\s*assert\s+/g;
```

Then replace the `analyzeShallowAssertions` function body (everything inside the function):

**Current function body:**
```typescript
export function analyzeShallowAssertions(content: string): ShallowAssertionResult {
  const lines = stripComments(content).split('\n');
  const locations: ShallowAssertionResult['locations'] = [];
  let totalAssertions = 0;

  // Count total expect() calls as denominator
  for (const line of lines) {
    const expectMatches = line.match(/expect\(/g);
    if (expectMatches) totalAssertions += expectMatches.length;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const { regex, kind } of SHALLOW_PATTERNS) {
      regex.lastIndex = 0;
      if (regex.test(line)) {
        locations.push({ line: i + 1, text: line.trim(), kind });
      }
    }

    BARE_CALLED_REGEX.lastIndex = 0;
    if (BARE_CALLED_REGEX.test(line)) {
      locations.push({ line: i + 1, text: line.trim(), kind: 'bareToHaveBeenCalled' });
    }
  }

  return {
    count: locations.length,
    total: totalAssertions,
    locations,
  };
}
```

**Replace with:**
```typescript
export function analyzeShallowAssertions(content: string): ShallowAssertionResult {
  const lines = stripComments(content).split('\n');
  const locations: ShallowAssertionResult['locations'] = [];
  let totalAssertions = 0;

  // Count total assertions as denominator (JS expect() + Python assert)
  for (const line of lines) {
    const expectMatches = line.match(/expect\(/g);
    if (expectMatches) totalAssertions += expectMatches.length;

    PYTHON_ASSERT_REGEX.lastIndex = 0;
    if (PYTHON_ASSERT_REGEX.test(line)) totalAssertions++;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // JS/TS shallow patterns
    for (const { regex, kind } of SHALLOW_PATTERNS) {
      regex.lastIndex = 0;
      if (regex.test(line)) {
        locations.push({ line: i + 1, text: line.trim(), kind });
      }
    }

    BARE_CALLED_REGEX.lastIndex = 0;
    if (BARE_CALLED_REGEX.test(line)) {
      locations.push({ line: i + 1, text: line.trim(), kind: 'bareToHaveBeenCalled' });
    }

    // Python shallow patterns
    for (const { regex, kind } of PYTHON_SHALLOW_PATTERNS) {
      regex.lastIndex = 0;
      if (regex.test(line)) {
        locations.push({ line: i + 1, text: line.trim(), kind });
      }
    }
  }

  return {
    count: locations.length,
    total: totalAssertions,
    locations,
  };
}
```

- [ ] **Step 3: Verify all tests pass**

Run: `cd mcp/testkit && npx vitest run src/analyzers/__tests__/shallow-assertions.test.ts 2>&1 | tail -20`
Expected: All tests pass including Python pattern tests.

- [ ] **Step 4: Commit**

```bash
cd mcp/testkit && git add src/analyzers/shallow-assertions.ts src/analyzers/__tests__/shallow-assertions.test.ts
git commit -m "feat(testkit): add Python shallow assertion detection (bare assert, assert is not None)"
```

---

### Task 7: Add Python pattern support to `error-coverage.ts`

**Files:**
- Modify: `mcp/testkit/src/analyzers/__tests__/error-coverage.test.ts`
- Modify: `mcp/testkit/src/analyzers/error-coverage.ts`

Add Python throwable patterns (`raise`, `raise ValueError`) and Python error test patterns (`pytest.raises`, `with self.assertRaises`).

- [ ] **Step 1: Write tests for Python error patterns**

In `mcp/testkit/src/analyzers/__tests__/error-coverage.test.ts`, add a new describe block at the end:

```typescript
describe('analyzeErrorCoverage — Python patterns', () => {
  it('detects raise as throwable', () => {
    const source = `
      def validate(email):
          if not email:
              raise ValueError("Email required")
    `;
    const test = `def test_x(): pass`;
    const result = analyzeErrorCoverage(source, test);
    expect(result.throwable).toBe(1);
    expect(result.throwableLocations[0].text).toContain('raise');
  });

  it('detects bare raise (re-raise) as throwable', () => {
    const source = `
      try:
          do_something()
      except Exception:
          raise
    `;
    const test = `def test_x(): pass`;
    const result = analyzeErrorCoverage(source, test);
    expect(result.throwable).toBe(1);
  });

  it('detects pytest.raises in test as error test', () => {
    const source = `raise ValueError("bad")`;
    const test = `
      def test_validation():
          with pytest.raises(ValueError):
              validate("")
    `;
    const result = analyzeErrorCoverage(source, test);
    expect(result.tested).toBe(1);
  });

  it('detects self.assertRaises in test as error test', () => {
    const source = `raise ValueError("bad")`;
    const test = `
      def test_validation(self):
          with self.assertRaises(ValueError):
              validate("")
    `;
    const result = analyzeErrorCoverage(source, test);
    expect(result.tested).toBe(1);
  });

  it('calculates correct ratio for Python code', () => {
    const source = `
      def process(data):
          if not data:
              raise ValueError("empty data")
          if data.get("type") not in ["a", "b"]:
              raise TypeError("invalid type")
          return transform(data)
    `;
    const test = `
      def test_empty_data():
          with pytest.raises(ValueError):
              process({})
    `;
    const result = analyzeErrorCoverage(source, test);
    expect(result.throwable).toBe(2);
    expect(result.tested).toBe(1);
    expect(result.ratio).toBe(0.5);
  });
});
```

Run: `cd mcp/testkit && npx vitest run src/analyzers/__tests__/error-coverage.test.ts 2>&1 | tail -20`
Expected: FAIL -- no Python pattern support exists.

- [ ] **Step 2: Implement Python patterns**

In `mcp/testkit/src/analyzers/error-coverage.ts`, add Python patterns to the existing arrays.

**Replace the THROWABLE_PATTERNS array with:**
```typescript
// Patterns that indicate a function can throw/reject
const THROWABLE_PATTERNS = [
  /\bthrow\s+new\b/,
  /\bthrow\s+\w/,
  /Promise\.reject\(/,
  /\.reject\(/,
  // Python: raise SomeError(...) or bare raise (re-raise)
  /\braise\s+\w/,
  /\braise\s*$/,
];
```

**Replace the ERROR_TEST_PATTERNS array with:**
```typescript
// Patterns that indicate an error is being tested
const ERROR_TEST_PATTERNS = [
  /\.toThrow\(/,
  /\.toThrowError\(/,
  /\.rejects\./,
  /expect\.unreachable/,
  /\.toThrow\(\)/,
  // Python: pytest.raises(ExceptionType) or self.assertRaises(ExceptionType)
  /pytest\.raises\(/,
  /self\.assertRaises\(/,
  /assertRaises\(/,
];
```

- [ ] **Step 3: Verify all tests pass**

Run: `cd mcp/testkit && npx vitest run src/analyzers/__tests__/error-coverage.test.ts 2>&1 | tail -20`
Expected: All tests pass including Python pattern tests.

- [ ] **Step 4: Commit**

```bash
cd mcp/testkit && git add src/analyzers/error-coverage.ts src/analyzers/__tests__/error-coverage.test.ts
git commit -m "feat(testkit): add Python error coverage detection (raise, pytest.raises, assertRaises)"
```

---

### Task 8: Add Python pattern support to `name-quality.ts`

**Files:**
- Modify: `mcp/testkit/src/analyzers/__tests__/name-quality.test.ts`
- Modify: `mcp/testkit/src/analyzers/name-quality.ts`

Add Python test name extraction: `def test_` prefix with underscores as word separators.

- [ ] **Step 1: Write tests for Python test names**

In `mcp/testkit/src/analyzers/__tests__/name-quality.test.ts`, add a new describe block at the end:

```typescript
describe('analyzeNameQuality — Python patterns', () => {
  it('extracts Python test names from def test_ prefix', () => {
    const content = `
      def test_rejects_empty_email_with_validation_error():
          pass

      def test_returns_empty_list_when_no_results():
          pass
    `;
    const result = analyzeNameQuality(content);
    expect(result.total).toBe(2);
    expect(result.vague).toBe(0);
  });

  it('flags short Python test names', () => {
    const content = `
      def test_it():
          pass
    `;
    const result = analyzeNameQuality(content);
    expect(result.total).toBe(1);
    expect(result.vague).toBe(1);
  });

  it('flags generic Python test names', () => {
    const content = `
      def test_works_correctly():
          pass
    `;
    const result = analyzeNameQuality(content);
    expect(result.total).toBe(1);
    expect(result.vague).toBe(1);
  });

  it('does not flag descriptive Python test names', () => {
    const content = `
      def test_create_user_returns_valid_id():
          pass

      def test_delete_user_raises_not_found_error():
          pass
    `;
    const result = analyzeNameQuality(content);
    expect(result.total).toBe(2);
    expect(result.vague).toBe(0);
  });

  it('handles Python test class methods', () => {
    const content = `
    class TestUserService:
        def test_creates_user_with_valid_email(self):
            pass
    `;
    const result = analyzeNameQuality(content);
    expect(result.total).toBe(1);
    expect(result.vague).toBe(0);
  });
});
```

Run: `cd mcp/testkit && npx vitest run src/analyzers/__tests__/name-quality.test.ts 2>&1 | tail -20`
Expected: FAIL -- no Python test name extraction exists.

- [ ] **Step 2: Implement Python test name extraction**

In `mcp/testkit/src/analyzers/name-quality.ts`, add a Python test name regex after the existing `TEST_NAME_REGEX` (line 18):

```typescript
// Match Python test functions: def test_something_descriptive(self?):
const PYTHON_TEST_NAME_REGEX = /def\s+(test_\w+)\s*\(/g;
```

Then modify the for loop inside `analyzeNameQuality` to also extract Python names.

**Current (lines 55-68):**
```typescript
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    TEST_NAME_REGEX.lastIndex = 0;
    let match;

    while ((match = TEST_NAME_REGEX.exec(line)) !== null) {
      total++;
      const name = match[1];
      const result = isVagueName(name);
      if (result.vague) {
        vagueNames.push({ line: i + 1, name, reason: result.reason });
      }
    }
  }
```

**Replace with:**
```typescript
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // JS/TS: test('name') or it('name')
    TEST_NAME_REGEX.lastIndex = 0;
    let match;
    while ((match = TEST_NAME_REGEX.exec(line)) !== null) {
      total++;
      const name = match[1];
      const result = isVagueName(name);
      if (result.vague) {
        vagueNames.push({ line: i + 1, name, reason: result.reason });
      }
    }

    // Python: def test_name_with_underscores(
    PYTHON_TEST_NAME_REGEX.lastIndex = 0;
    while ((match = PYTHON_TEST_NAME_REGEX.exec(line)) !== null) {
      total++;
      // Convert test_name_with_underscores to "name with underscores" for quality check
      const rawName = match[1];
      const name = rawName.replace(/^test_/, '').replace(/_/g, ' ');
      const result = isVagueName(name);
      if (result.vague) {
        vagueNames.push({ line: i + 1, name: rawName, reason: result.reason });
      }
    }
  }
```

- [ ] **Step 3: Verify all tests pass**

Run: `cd mcp/testkit && npx vitest run src/analyzers/__tests__/name-quality.test.ts 2>&1 | tail -20`
Expected: All tests pass including Python pattern tests.

- [ ] **Step 4: Commit**

```bash
cd mcp/testkit && git add src/analyzers/name-quality.ts src/analyzers/__tests__/name-quality.test.ts
git commit -m "feat(testkit): add Python test name quality analysis (def test_ extraction)"
```

---

### Task 9: Fix `tools/status.ts` -- share discovery results

**Files:**
- Modify: `mcp/testkit/src/mcp/tools/status.ts`
- Modify: `mcp/testkit/src/mcp/tools/analyze.ts`
- Modify: `mcp/testkit/src/mcp/tools/map.ts`

Currently `statusTool` calls both `analyzeTool` and `mapTool` in parallel. Each internally runs `discoverTestFiles` and `detectFramework`, meaning discovery runs twice. Extract shared discovery and pass it through.

- [ ] **Step 1: Add an optional discovery cache parameter to analyzeTool**

In `mcp/testkit/src/mcp/tools/analyze.ts`, modify the function signature and body.

Add this interface after the existing interfaces (after `AnalyzeResult`):

```typescript
export interface DiscoveryCache {
  testPaths: string[];
  framework: string | null;
}
```

**Replace the function signature (line 132):**

**Current:**
```typescript
export async function analyzeTool(args: { file?: string }, cwd: string): Promise<AnalyzeResult> {
```

**Replace with:**
```typescript
export async function analyzeTool(
  args: { file?: string },
  cwd: string,
  discoveryCache?: DiscoveryCache,
): Promise<AnalyzeResult> {
```

**Replace lines 133-140:**

**Current:**
```typescript
  const framework = await detectFramework(cwd);

  let testPaths: string[];
  if (args.file) {
    testPaths = [args.file];
  } else {
    testPaths = await discoverTestFiles(cwd);
  }
```

**Replace with:**
```typescript
  const framework = discoveryCache?.framework ?? await detectFramework(cwd);

  let testPaths: string[];
  if (args.file) {
    testPaths = [args.file];
  } else {
    testPaths = discoveryCache?.testPaths ?? await discoverTestFiles(cwd);
  }
```

- [ ] **Step 2: Add an optional discovery cache parameter to mapTool**

In `mcp/testkit/src/mcp/tools/map.ts`, add the import for DiscoveryCache:

**Current:**
```typescript
import { buildSourceMapping, type SourceMapping } from '../../analyzers/discovery.js';
```

**Replace with:**
```typescript
import { buildSourceMapping, type SourceMapping } from '../../analyzers/discovery.js';
import type { DiscoveryCache } from './analyze.js';
```

**Replace the function signature (line 19):**

**Current:**
```typescript
export async function mapTool(cwd: string): Promise<MapResult> {
```

**Replace with:**
```typescript
export async function mapTool(cwd: string, _discoveryCache?: DiscoveryCache): Promise<MapResult> {
```

The `_discoveryCache` parameter is accepted for API consistency but `buildSourceMapping` handles its own discovery. This enables future optimization where `buildSourceMapping` can accept cached data.

- [ ] **Step 3: Refactor statusTool to run discovery once**

Replace the entire contents of `mcp/testkit/src/mcp/tools/status.ts`:

**Current:**
```typescript
/**
 * testkit_status -- Quick project test health summary.
 *
 * Combines analyze + map results into a scannable overview.
 */

import { analyzeTool } from './analyze.js';
import { mapTool } from './map.js';

export interface StatusResult {
  framework: string | null;
  overallGrade: string;
  testFiles: number;
  sourceFiles: number;
  coverageRatio: number;
  untestedHighPriority: number;
  topIssues: string[];
  quickSummary: string;
}

export async function statusTool(cwd: string): Promise<StatusResult> {
  const [analyzeResult, mapResult] = await Promise.all([
    analyzeTool({}, cwd),
    mapTool(cwd),
  ]);

  const untestedHighPriority = mapResult.untested.filter(u => u.priority === 'high').length;

  // Build a human-readable summary
  const parts: string[] = [];
  parts.push(`${mapResult.testFiles} test files covering ${mapResult.sourceFiles} source files`);
  parts.push(`Overall grade: ${analyzeResult.summary.avgGrade}`);
  parts.push(`Coverage ratio: ${Math.round(mapResult.coverageRatio * 100)}%`);

  if (untestedHighPriority > 0) {
    parts.push(`${untestedHighPriority} high-priority source file(s) have no tests`);
  }

  if (analyzeResult.summary.topIssues.length > 0) {
    parts.push(`Top issue: ${analyzeResult.summary.topIssues[0]}`);
  }

  return {
    framework: mapResult.framework,
    overallGrade: analyzeResult.summary.avgGrade,
    testFiles: mapResult.testFiles,
    sourceFiles: mapResult.sourceFiles,
    coverageRatio: mapResult.coverageRatio,
    untestedHighPriority,
    topIssues: analyzeResult.summary.topIssues,
    quickSummary: parts.join(' | '),
  };
}
```

**Replace with:**
```typescript
/**
 * testkit_status -- Quick project test health summary.
 *
 * Combines analyze + map results into a scannable overview.
 * Runs discovery once and shares results with both analyze and map tools
 * to avoid redundant filesystem scanning.
 */

import { discoverTestFiles, detectFramework } from '../../analyzers/discovery.js';
import { analyzeTool, type DiscoveryCache } from './analyze.js';
import { mapTool } from './map.js';

export interface StatusResult {
  framework: string | null;
  overallGrade: string;
  testFiles: number;
  sourceFiles: number;
  coverageRatio: number;
  untestedHighPriority: number;
  topIssues: string[];
  quickSummary: string;
}

export async function statusTool(cwd: string): Promise<StatusResult> {
  // Run discovery once and share results with both tools
  const [testPaths, framework] = await Promise.all([
    discoverTestFiles(cwd),
    detectFramework(cwd),
  ]);

  const discoveryCache: DiscoveryCache = { testPaths, framework };

  const [analyzeResult, mapResult] = await Promise.all([
    analyzeTool({}, cwd, discoveryCache),
    mapTool(cwd, discoveryCache),
  ]);

  const untestedHighPriority = mapResult.untested.filter(u => u.priority === 'high').length;

  // Build a human-readable summary
  const parts: string[] = [];
  parts.push(`${mapResult.testFiles} test files covering ${mapResult.sourceFiles} source files`);
  parts.push(`Overall grade: ${analyzeResult.summary.avgGrade}`);
  parts.push(`Coverage ratio: ${Math.round(mapResult.coverageRatio * 100)}%`);

  if (untestedHighPriority > 0) {
    parts.push(`${untestedHighPriority} high-priority source file(s) have no tests`);
  }

  if (analyzeResult.summary.topIssues.length > 0) {
    parts.push(`Top issue: ${analyzeResult.summary.topIssues[0]}`);
  }

  return {
    framework: mapResult.framework ?? framework,
    overallGrade: analyzeResult.summary.avgGrade,
    testFiles: mapResult.testFiles,
    sourceFiles: mapResult.sourceFiles,
    coverageRatio: mapResult.coverageRatio,
    untestedHighPriority,
    topIssues: analyzeResult.summary.topIssues,
    quickSummary: parts.join(' | '),
  };
}
```

- [ ] **Step 4: Verify build passes**

Run: `cd mcp/testkit && npx tsc --noEmit 2>&1 | tail -20`
Expected: No type errors.

- [ ] **Step 5: Verify all existing tests still pass**

Run: `cd mcp/testkit && npx vitest run 2>&1 | tail -20`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
cd mcp/testkit && git add src/mcp/tools/status.ts src/mcp/tools/analyze.ts src/mcp/tools/map.ts
git commit -m "perf(testkit): share discovery results between analyze and map in status tool"
```

---

### Task 10: Fix `/test` skill content

**Files:**
- Modify: `skills/test/SKILL.md`

Three fixes: (1) Add explicit `testkit_map` call instruction in the Detect Context phase. (2) Add fallback for environments without a test runner. (3) Add scope guard for framework setup side quest.

- [ ] **Step 1: Add testkit_map call, runner fallback, and scope guard**

In `skills/test/SKILL.md`, replace the "### 1. Detect Context (silently)" section (lines 29-49):

**Current:**
```markdown
### 1. Detect Context (silently)

Do all of this automatically without asking the user:

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
```

**Replace with:**
```markdown
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
```

- [ ] **Step 2: Verify the SKILL.md frontmatter is intact**

Run: `head -5 skills/test/SKILL.md`
Expected: YAML frontmatter starts with `---` and includes `name: test`.

- [ ] **Step 3: Commit**

```bash
git add skills/test/SKILL.md
git commit -m "fix(skill): add testkit_map call, runner fallback, and scope guard to /test skill"
```

---

### Task 11: Fix `/test-review` skill content

**Files:**
- Modify: `skills/test-review/SKILL.md`

Two fixes: (1) Resolve multiple-file ambiguity -- review the most recently modified file. (2) Fix cross-skill reference to use concepts, not file paths.

- [ ] **Step 1: Fix the multiple-file ambiguity in step 1**

In `skills/test-review/SKILL.md`, replace lines 37-42 (the "### 1. Identify Target" section):

**Current:**
```markdown
### 1. Identify Target

If a test file was specified, read it. Otherwise, discover test files using Glob:
`**/*.test.*`, `**/*.spec.*`, `**/__tests__/**`.

If multiple test files are found and none was specified, ask which to review — or review
the most recently modified one.
```

**Replace with:**
```markdown
### 1. Identify Target

If a test file was specified, read it. Otherwise, discover test files using Glob:
`**/*.test.*`, `**/*.spec.*`, `**/__tests__/**`.

If multiple test files are found and none was specified, review the most recently modified
test file. Use `ls -t` or equivalent to determine modification order. Do not ask the user
to choose — pick the most recent one and note it: "Reviewing {filename} (most recently
modified test file). Specify a file to review a different one."
```

- [ ] **Step 2: Fix cross-skill reference to use concepts, not paths**

In the same file, replace the "Dimension 2: Input Coverage" bullet points (lines 66-69):

**Current:**
```markdown
**Dimension 2: Input Coverage**
- Does the test suite cover more than the happy path?
- Check: are there tests for empty input, null, boundary values, invalid input?
- Compare the tested inputs against the input space from
  `skills/test/references/input-space-analysis.md`
```

**Replace with:**
```markdown
**Dimension 2: Input Coverage**
- Does the test suite cover more than the happy path?
- Check: are there tests for empty input, null, boundary values, invalid input?
- Compare against input space categories: canonical, empty, boundary, null, invalid,
  adversarial. Each parameter should have test coverage for at least the "must" categories
  (canonical + empty + boundary + one error case).
```

- [ ] **Step 3: Commit**

```bash
git add skills/test-review/SKILL.md
git commit -m "fix(skill): resolve multiple-file ambiguity and fix cross-skill reference in /test-review"
```

---

### Task 12: Fix `/test-plan` skill content

**Files:**
- Modify: `skills/test-plan/SKILL.md`

Three fixes: (1) Add `testkit_map` unavailability fallback message. (2) Align category names with input-space-analysis.md. (3) Add triviality guidance.

- [ ] **Step 1: Add testkit_map fallback message**

In `skills/test-plan/SKILL.md`, replace the "### 1. Read the Target" section (lines 31-35):

**Current:**
```markdown
### 1. Read the Target

If `testkit_map` is available, call it to understand which functions already have tests
and which need plans. This avoids planning for code that's already well-tested.

Read the code to be tested. If a specific function was named, focus on that. If a file or
module was named, analyze each exported function/class.
```

**Replace with:**
```markdown
### 1. Read the Target

If `testkit_map` is available, call it to understand which functions already have tests
and which need plans. This avoids planning for code that's already well-tested.

If `testkit_map` is unavailable, note: "Running without testkit-mcp — discovering test
coverage manually. Install the testkit MCP server for automated coverage mapping." Then
manually Glob for existing test files and read them to understand current coverage.

Read the code to be tested. If a specific function was named, focus on that. If a file or
module was named, analyze each exported function/class.
```

- [ ] **Step 2: Add category mapping note after the input space table**

In the input space table template section, after the closing code fence of the table (after the line with `| Combinatorial | ...`), add a mapping note. Replace lines 52-66:

**Current:**
```markdown
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
```

**Replace with:**
```markdown
```
### Input Space — {functionName}({params})

| Category | Input | Expected | Priority |
|----------|-------|----------|----------|
| Canonical | {typical valid input} | {expected output} | must |
| Empty | {empty/zero variant} | {error or default} | must |
| Boundary | {at threshold} | {edge behavior} | must |
| Null | {null/undefined/None} | {error} | must |
| Invalid | {wrong type/value} | {error} | should |
| Adversarial | {attack input} | {safe handling} | should |
| Combinatorial | {conflicting options} | {defined behavior} | nice |
```

Categories map to the reference type tables: Strings (empty, whitespace, unicode,
special chars), Numbers (zero, negative, NaN, float precision), Arrays (empty, single,
large, nulls), Objects (empty, missing keys, extra keys, wrong types), Dates (epoch,
DST, leap year), Async (resolve, reject, timeout, cancel), Stateful (initial, mutated,
concurrent).
```

- [ ] **Step 3: Add triviality guidance**

In the "## Guidelines" section (lines 117-125), replace:

**Current:**
```markdown
## Guidelines

- The plan should be actionable. Someone should be able to hand it to a developer (or to
  `/test`) and get a complete test suite written from it.
- Prioritize ruthlessly. Every function does NOT need adversarial tests. Focus "must" on
  the inputs that are most likely to cause real bugs.
- If the function is trivial (one-liner, no branching), say so. Not everything needs 12
  test cases.
- For functions that are already well-tested, note what's covered and what's missing rather
  than producing a full plan from scratch.
```

**Replace with:**
```markdown
## Guidelines

- The plan should be actionable. Someone should be able to hand it to a developer (or to
  `/test`) and get a complete test suite written from it.
- Prioritize ruthlessly. Every function does NOT need adversarial tests. Focus "must" on
  the inputs that are most likely to cause real bugs.
- **Triviality check:** If the function is trivial (one-liner, no branching, pure getter,
  simple delegation), say so explicitly: "This function is trivial — 1-2 tests are
  sufficient (canonical + one edge case). Do not over-plan." Not everything needs 12
  test cases. A simple `formatDate` function needs 3 tests, not 15.
- For functions that are already well-tested, note what's covered and what's missing rather
  than producing a full plan from scratch.
```

- [ ] **Step 4: Commit**

```bash
git add skills/test-plan/SKILL.md
git commit -m "fix(skill): add testkit_map fallback, align categories, add triviality guidance to /test-plan"
```

---

### Task 13: Fix `test-auditor` agent

**Files:**
- Modify: `agents/test-auditor.md`

Four fixes: (1) Add `testkit_status` call as Phase 0 for quick initial read. (2) Reconcile criticality table with reference (add `admin`, `queue/worker/job`). (3) Add file selection heuristic for Phase 4.5. (4) Add fallback note placeholder in report template.

- [ ] **Step 1: Add testkit_status as Phase 0**

In `agents/test-auditor.md`, add a new phase after the line `## Process` (line 27) and before `### Phase 1: Discovery` (line 29). Insert:

```markdown

### Phase 0: Quick Health Check

Call `testkit_status` first for an immediate overview: overall grade, test file count,
source file count, coverage ratio, untested high-priority files, and top issues. This
gives you a baseline before deep analysis.

If `testkit_status` is unavailable, skip to Phase 1.

```

- [ ] **Step 2: Reconcile criticality table with reference**

Replace the criticality table in "### Phase 3: Criticality Assessment". Find the table with columns Criticality, Pattern, Test quality floor and replace:

**Current:**
```markdown
| Criticality | Pattern | Test quality floor |
|------------|---------|-------------------|
| **Critical** | auth, payment, security, middleware, migrations, encryption, webhooks, data mutations, permissions | Must be A or B |
| **Important** | core business logic, API handlers, services, controllers, repositories, database queries | Should be B or better |
| **Standard** | utilities, helpers, formatters, config, types, constants | C is acceptable |
```

**Replace with:**
```markdown
| Criticality | Pattern | Test quality floor |
|------------|---------|-------------------|
| **Critical** | auth, payment, security, middleware, migrations, encryption, webhooks, data mutations, permissions, admin | Must be A or B |
| **Important** | core business logic, API handlers, services, controllers, repositories, database queries, queue, worker, job, validators, schemas | Should be B or better |
| **Standard** | utilities, helpers, formatters, config, types, constants | C is acceptable |
```

- [ ] **Step 3: Add file selection heuristic for Phase 4.5**

In "### Phase 4.5: Code Pattern Discovery", find the text "Sample 8-12 source files (prioritizing critical and important files) and look for:" and insert after "look for:" and before the first bullet point:

```markdown

**File selection heuristic:** From `testkit_map` results (or manual discovery), select:
- All untested files classified as "high" priority (up to 5)
- The 3-4 tested files with the worst grades from Phase 2
- 2-3 files from the most active directories (highest recent commit count)

If more than 12 files, cap at 12 and note which were skipped.

```

- [ ] **Step 4: Add fallback note placeholder in report template**

In "### Phase 6: Report", in the report template, find the line `- **Untested critical files**: {n}` and add after it:

```markdown

> **Note:** {If testkit-mcp was unavailable, add: "This audit was performed without the
> testkit MCP server. Metrics are based on manual code reading and may be less precise than
> automated analysis. Install testkit-mcp for future audits."}
```

- [ ] **Step 5: Commit**

```bash
git add agents/test-auditor.md
git commit -m "fix(agent): add testkit_status Phase 0, reconcile criticality, add file heuristic and fallback to test-auditor"
```

---

### Task 14: Fix `assertion-depth.md` reference

**Files:**
- Modify: `skills/test/references/assertion-depth.md`

Two additions: (1) Python patterns section. (2) Snapshot assertion discussion.

- [ ] **Step 1: Add Python patterns section**

In `skills/test/references/assertion-depth.md`, add after the "## Boolean Return Values" section (after line 177, the line ending with `expect(isExpired).toBe(false)` and its closing code fence) and before "## HTTP Response Assertions" (line 179):

```markdown

## Python Assertion Patterns

**Shallow:**
```python
assert result
assert user is not None
assert len(items)
```

**Why it's shallow:** `assert result` passes for ANY truthy value. If the function returns
an error string instead of a user object, the test still passes. `assert user is not None`
is the Python equivalent of `toBeDefined()` -- it only proves existence, not correctness.

**Deep:**
```python
assert result == {"id": "123", "name": "Alice", "role": "member"}
assert user.email == "alice@example.com"
assert len(items) == 3
assert items[0]["name"] == "Alice"
```

**For errors (pytest):**
```python
# Shallow:
with pytest.raises(Exception):
    validate("")

# Deep:
with pytest.raises(ValueError, match="Email is required"):
    validate("")
```

**For errors (unittest):**
```python
# Shallow:
self.assertRaises(Exception, validate, "")

# Deep:
with self.assertRaises(ValueError) as ctx:
    validate("")
self.assertEqual(str(ctx.exception), "Email is required")
```

```

- [ ] **Step 2: Add snapshot assertion discussion**

At the end of the file, before the "## The Assertion Depth Checklist" section (line 209), add:

```markdown

## Snapshot Assertions

**Shallow usage:**
```
expect(result).toMatchSnapshot()
```

**Why it can be shallow:** Snapshot tests verify that output hasn't CHANGED, not that it's
CORRECT. If the initial snapshot captured wrong output, the test locks in the bug. Snapshot
updates (`--update-snapshot`) can silently accept regressions.

**When snapshots ARE appropriate:**
- Large output where manual assertion is impractical (rendered HTML, serialized configs)
- Output stability matters more than output correctness (API response shape)
- Combined with at least ONE explicit assertion on the critical field

**Deep snapshot usage:**
```
// Explicit assertion on the critical value
expect(result.status).toBe("success")
expect(result.user.email).toBe("alice@example.com")
// Snapshot for the full shape (catches unexpected changes)
expect(result).toMatchSnapshot()
```

**Rule of thumb:** Never use a snapshot as the ONLY assertion. Always pair it with at least
one explicit value assertion on the most important field.

```

- [ ] **Step 3: Commit**

```bash
git add skills/test/references/assertion-depth.md
git commit -m "fix(ref): add Python patterns and snapshot discussion to assertion-depth.md"
```

---

### Task 15: Fix `input-space-analysis.md` reference

**Files:**
- Modify: `skills/test/references/input-space-analysis.md`

Two additions: (1) Complete the Dates section with DST detail. (2) Add File/Buffer type section.

- [ ] **Step 1: Expand DST rows in Dates table**

In `skills/test/references/input-space-analysis.md`, replace the Dates table (lines 78-89):

**Current:**
```markdown
## Dates

| Category | Test Values |
|----------|-------------|
| Canonical | Valid recent date |
| Epoch | `new Date(0)` — January 1, 1970 |
| Far future | `new Date("9999-12-31")` — overflow potential |
| Far past | `new Date("0001-01-01")` |
| Invalid date | `new Date("not-a-date")` — produces `Invalid Date` |
| Timezone boundary | Midnight UTC vs local time |
| DST transition | Dates during daylight saving time changes |
| Leap year | February 29 on leap year, invalid Feb 29 on non-leap year |
| ISO string vs Date object | `"2024-01-15"` vs `new Date("2024-01-15")` |
```

**Replace with:**
```markdown
## Dates

| Category | Test Values |
|----------|-------------|
| Canonical | Valid recent date |
| Epoch | `new Date(0)` -- January 1, 1970 |
| Far future | `new Date("9999-12-31")` -- overflow potential |
| Far past | `new Date("0001-01-01")` |
| Invalid date | `new Date("not-a-date")` -- produces `Invalid Date` |
| Timezone boundary | Midnight UTC vs local time -- a date that is "today" in one timezone and "yesterday" in another |
| DST spring forward | `2024-03-10T02:30:00` US Eastern -- this time does not exist (clocks skip from 2:00 to 3:00). Functions computing duration across this boundary lose an hour. |
| DST fall back | `2024-11-03T01:30:00` US Eastern -- this time occurs TWICE. Ambiguous without explicit offset. |
| Leap year | February 29 on leap year, invalid Feb 29 on non-leap year |
| Leap second | `2016-12-31T23:59:60Z` -- most parsers reject this but some APIs return it |
| ISO string vs Date object | `"2024-01-15"` vs `new Date("2024-01-15")` |
```

- [ ] **Step 2: Add File/Buffer type section**

After the "## Async Code" section (after line 103, the last row of the Async table) and before "## Stateful Code" (line 105), add:

```markdown

## Files / Buffers

| Category | Test Values |
|----------|-------------|
| Canonical | Valid file of expected type and reasonable size |
| Empty file | 0-byte file or empty Buffer -- triggers different code paths |
| Very large | File exceeding expected max size (e.g., 100MB+) -- memory/performance |
| Wrong type | PDF when image expected, text when binary expected |
| Corrupted | Valid header but truncated or corrupted body |
| Malicious filename | `../../etc/passwd`, `file.jpg.exe`, `file\x00.txt` |
| Binary with BOM | UTF-8 BOM (`\xEF\xBB\xBF`) at start -- breaks naive text parsing |
| No extension | File without extension -- type detection from content |
| Symlink | Symlink to valid file, symlink to missing file, circular symlink |
| Permissions | File exists but is not readable (EACCES) |

```

- [ ] **Step 3: Commit**

```bash
git add skills/test/references/input-space-analysis.md
git commit -m "fix(ref): complete DST rows and add File/Buffer type section to input-space-analysis.md"
```

---

### Task 16: Fix `domain-strategies.md` reference

**Files:**
- Modify: `skills/test/references/domain-strategies.md`

Two additions: (1) OAuth flow table. (2) Background Jobs table.

- [ ] **Step 1: Add OAuth flow section**

In `skills/test/references/domain-strategies.md`, add after the "## Authentication & Authorization" section (after the **Mock boundary** paragraph, before "## Pagination"). Find the line "**Mock boundary:** Mock the token verification library's key/secret, but test the actual" and after that paragraph, add:

```markdown

## OAuth / Third-Party Auth Flows

**Beyond redirect -- test the exchange and token lifecycle:**

| Scenario | What to test |
|----------|-------------|
| Valid auth code exchange | Code exchanged for tokens -> access token + refresh token returned |
| Expired auth code | Code used after expiry window -> error, not tokens |
| Reused auth code | Same code submitted twice -> second attempt rejected |
| Invalid redirect URI | Redirect URI doesn't match registered URI -> error |
| Token refresh | Valid refresh token -> new access token issued |
| Expired refresh token | Refresh token past expiry -> force re-authentication |
| Revoked token | Token explicitly revoked -> subsequent API calls fail with 401 |
| Scope mismatch | Token has `read` scope, request needs `write` -> 403 |
| State parameter | Missing or mismatched state parameter -> reject (CSRF protection) |
| Provider down | OAuth provider unreachable -> graceful error, not crash |

**Common mistake:** Only testing the happy path (code exchange works, token refresh works).
OAuth has many failure modes that attackers specifically target -- expired codes, reused
codes, scope escalation, missing state parameters.

**Mock boundary:** Mock the HTTP calls to the OAuth provider. Test your own code's handling
of every response type the provider can return (success, error, timeout, malformed).

```

- [ ] **Step 2: Add Background Jobs section**

At the end of the file, after the "## Database Transactions" section, add:

```markdown

## Background Jobs / Queue Workers

**Beyond enqueue -- test the full job lifecycle:**

| Scenario | What to test |
|----------|-------------|
| Successful processing | Job enqueued -> worker processes -> job marked complete |
| Job failure | Processing throws -> job marked failed with error details |
| Retry on failure | Failed job retried up to max retries -> succeeds on retry N |
| Max retries exhausted | Job fails max times -> moved to dead letter queue, not retried |
| Duplicate job | Same job enqueued twice -> processed once (idempotency) |
| Job timeout | Processing exceeds time limit -> job killed, marked as timed out |
| Concurrent workers | Two workers pick up same job -> only one processes it |
| Priority ordering | High-priority job enqueued after low-priority -> processed first |
| Graceful shutdown | Worker receives shutdown signal mid-job -> completes current job, stops accepting new |
| Poison message | Malformed job payload -> rejected without crashing worker |
| Dependent jobs | Job B depends on Job A completing -> B waits, processes after A |

**Common mistake:** Only testing that jobs are enqueued and processed in the happy path.
Queue systems have complex failure, retry, and concurrency semantics that are invisible
until production load hits.

**Mock boundary:** Mock the queue transport (Redis, SQS, RabbitMQ) but test the actual
job handler logic with real data. For retry tests, mock the transport to simulate failures.
```

- [ ] **Step 3: Commit**

```bash
git add skills/test/references/domain-strategies.md
git commit -m "fix(ref): add OAuth flow and Background Jobs tables to domain-strategies.md"
```

---

### Task 17: Fix `test-architecture.md` reference

**Files:**
- Modify: `skills/test/references/test-architecture.md`

Two additions: (1) CLI Commands example block. (2) GraphQL archetype.

- [ ] **Step 1: Add CLI Commands example block**

In `skills/test/references/test-architecture.md`, the "### CLI Commands" section (lines 141-149) exists but has no example structure. Replace the entire section:

**Current:**
```markdown
### CLI Commands

**Test approach:** Test the command handler with parsed arguments.

**Why:** Argument parsing is the framework's job. The handler logic is yours. Test with
various argument combinations and verify output + side effects.

**Mock boundary:** Mock filesystem operations and network calls. Use real argument objects.
```

**Replace with:**
```markdown
### CLI Commands

**Test approach:** Test the command handler with parsed arguments.

**Why:** Argument parsing is the framework's job. The handler logic is yours. Test with
various argument combinations and verify output + side effects.

**Mock boundary:** Mock filesystem operations and network calls. Use real argument objects.

**Example structure:**
```
describe("deploy command", () => {
  test("deploys to staging with default options", async () => {
    const output = await runCommand("deploy", { env: "staging" })
    expect(output.exitCode).toBe(0)
    expect(output.stdout).toContain("Deployed to staging")
  })

  test("rejects unknown environment", async () => {
    const output = await runCommand("deploy", { env: "invalid" })
    expect(output.exitCode).toBe(1)
    expect(output.stderr).toContain("Unknown environment: invalid")
  })

  test("requires --force for production deploy", async () => {
    const output = await runCommand("deploy", { env: "production" })
    expect(output.exitCode).toBe(1)
    expect(output.stderr).toContain("Use --force for production")
  })

  test("dry-run prints plan without deploying", async () => {
    const output = await runCommand("deploy", { env: "staging", dryRun: true })
    expect(output.stdout).toContain("DRY RUN")
    expect(mockDeploy).not.toHaveBeenCalled()
  })
})
```
```

- [ ] **Step 2: Add GraphQL archetype**

After the "### Middleware / Interceptors" section and before "### CLI Commands", add:

```markdown

### GraphQL Resolvers

**Test approach:** Test resolvers as functions with parent, args, and context. For complex
queries, integration test through the full GraphQL schema.

**Why:** Resolvers are the business logic layer of a GraphQL API. Testing through HTTP adds
unnecessary complexity -- test the resolver function directly for unit tests, and use
`graphql()` for integration tests of query composition.

**Mock boundary:** Mock data sources in context (database, REST APIs). For integration tests,
use a real schema with test data sources.

**Example structure:**
```
describe("User resolver", () => {
  test("resolves user by ID", async () => {
    const user = await resolvers.Query.user(
      null,
      { id: "123" },
      { dataSources: { users: mockUserDS } }
    )
    expect(user).toEqual({ id: "123", name: "Alice", email: "alice@example.com" })
  })

  test("returns null for non-existent user", async () => {
    const user = await resolvers.Query.user(
      null,
      { id: "nonexistent" },
      { dataSources: { users: mockUserDS } }
    )
    expect(user).toBeNull()
  })

  test("nested field resolver loads related data", async () => {
    const result = await graphql({
      schema,
      source: '{ user(id: "123") { name posts { title } } }',
      contextValue: { dataSources: testSources },
    })
    expect(result.errors).toBeUndefined()
    expect(result.data.user.posts).toHaveLength(2)
    expect(result.data.user.posts[0].title).toBe("First Post")
  })

  test("authorization check on admin-only field", async () => {
    const result = await graphql({
      schema,
      source: '{ user(id: "123") { email secretField } }',
      contextValue: { dataSources: testSources, viewer: regularUser },
    })
    expect(result.errors[0].message).toContain("Not authorized")
  })
})
```

```

- [ ] **Step 3: Commit**

```bash
git add skills/test/references/test-architecture.md
git commit -m "fix(ref): add CLI Commands example block and GraphQL archetype to test-architecture.md"
```

---

### Task 18: Fix `scoring-rubric.md` reference

**Files:**
- Modify: `skills/test-review/references/scoring-rubric.md`

Two additions: (1) Document null dimensions. (2) Add numeric weights.

- [ ] **Step 1: Add null dimension documentation and numeric weights**

In `skills/test-review/references/scoring-rubric.md`, replace the "## Overall Grade Calculation" section (lines 73-88):

**Current:**
```markdown
## Overall Grade Calculation

The overall grade is NOT a simple average. Weight by importance:

1. **Error testing** (highest weight) — Missing error tests is the most common cause of
   production bugs. A test suite with no error tests cannot score above C overall.
2. **Assertion depth** — Shallow assertions give false confidence. Many shallow assertions
   pulls the grade down significantly.
3. **Input coverage** — Happy-path-only coverage misses the bugs that matter.
4. **Mock health** — Over-mocking means tests prove nothing about real behavior.
5. **Specification clarity** — Important for maintainability but doesn't directly affect
   bug-catching ability.
6. **Independence** — Important for reliability but rarely causes production bugs directly.

**Grade caps:**
- No error tests at all → overall capped at C
- More than 50% shallow assertions → overall capped at C+
- Everything mocked (>50% mock setup) → overall capped at C
```

**Replace with:**
```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add skills/test-review/references/scoring-rubric.md
git commit -m "fix(ref): document null dimensions and add numeric weights to scoring-rubric.md"
```

---

### Task 19: Fix `plan-templates.md` reference

**Files:**
- Modify: `skills/test-plan/references/plan-templates.md`

Two additions: (1) Webhook Handler template. (2) Auth/Token template.

- [ ] **Step 1: Add Webhook Handler and Auth/Token templates**

At the end of `skills/test-plan/references/plan-templates.md`, add:

```markdown

## Template: Webhook Handler

For endpoints that receive webhook events from external services (Stripe, GitHub, etc.).

| Category | Input | Expected | Priority |
|----------|-------|----------|----------|
| Valid event + valid signature | Known event type, correct HMAC | processed, 200 response | must |
| Invalid signature | Wrong HMAC / missing signature header | 401, event NOT processed | must |
| Unknown event type | Valid signature, unrecognized event type | acknowledged (200), no processing | must |
| Malformed payload | Valid signature, invalid JSON body | 400, event NOT processed | must |
| Replay attack | Valid signature, timestamp too old | rejected (stale timestamp) | should |
| Duplicate event | Same event ID delivered twice | processed once (idempotency) | should |
| Missing required fields | Valid event type, payload missing expected fields | error logged, graceful handling | should |
| Out-of-order events | Event B arrives before Event A | handled correctly or queued | should |
| Payload too large | Event body exceeds size limit | 413, not processed | nice |
| Concurrent identical events | Same event arrives simultaneously | only one processes | nice |

## Template: Auth/Token Handler

For functions that issue, verify, refresh, or revoke authentication tokens.

| Category | Input | Expected | Priority |
|----------|-------|----------|----------|
| Valid credentials | Correct username + password | token issued with correct claims | must |
| Invalid password | Correct username, wrong password | authentication error, no token | must |
| Non-existent user | Username not in system | same error as invalid password (no enumeration) | must |
| Token verification -- valid | Well-formed, unexpired token | decoded claims returned | must |
| Token verification -- expired | Token past expiry time | expiration error | must |
| Token verification -- malformed | Random string, truncated token | verification error | must |
| Token verification -- wrong key | Valid structure, signed with wrong key | signature error | must |
| Token refresh -- valid | Unexpired refresh token | new access token issued | should |
| Token refresh -- expired | Refresh token past expiry | re-authentication required | should |
| Token refresh -- revoked | Refresh token explicitly revoked | rejected, re-auth required | should |
| Token revocation | Valid token revoked | subsequent verification fails | should |
| Empty credentials | Empty string username or password | validation error | must |
| SQL injection in username | `admin' OR 1=1 --` | rejected safely | should |
| Concurrent token refresh | Two refresh requests with same token | one succeeds, one fails | nice |
```

- [ ] **Step 2: Commit**

```bash
git add skills/test-plan/references/plan-templates.md
git commit -m "fix(ref): add Webhook Handler and Auth/Token templates to plan-templates.md"
```

---

### Task 20: Fix `criticality-patterns.md` reference

**Files:**
- Modify: `skills/test-review/references/criticality-patterns.md`

Add `admin` to Critical file path patterns. Add `queue/worker/job` and `validator/schema` to Important file path patterns.

- [ ] **Step 1: Add admin to Critical file path patterns**

In `skills/test-review/references/criticality-patterns.md`, find the Critical section file path patterns (lines 14-22) and add `admin`. Replace:

**Current:**
```markdown
**File path patterns:**
- `**/auth/**`, `**/login/**`, `**/session/**`, `**/token/**`
- `**/payment/**`, `**/billing/**`, `**/checkout/**`, `**/charge/**`, `**/invoice/**`
- `**/security/**`, `**/permission/**`, `**/access/**`, `**/rbac/**`, `**/acl/**`
- `**/middleware/**` (request pipeline — affects all routes)
- `**/migrat**` (database migrations — irreversible in production)
- `**/password/**`, `**/credential/**`, `**/secret/**`
- `**/encrypt**`, `**/decrypt**`, `**/hash**`
- `**/webhook**` (public-facing, adversarial input)
```

**Replace with:**
```markdown
**File path patterns:**
- `**/auth/**`, `**/login/**`, `**/session/**`, `**/token/**`
- `**/payment/**`, `**/billing/**`, `**/checkout/**`, `**/charge/**`, `**/invoice/**`
- `**/security/**`, `**/permission/**`, `**/access/**`, `**/rbac/**`, `**/acl/**`
- `**/middleware/**` (request pipeline -- affects all routes)
- `**/migrat**` (database migrations -- irreversible in production)
- `**/password/**`, `**/credential/**`, `**/secret/**`
- `**/encrypt**`, `**/decrypt**`, `**/hash**`
- `**/webhook**` (public-facing, adversarial input)
- `**/admin/**` (elevated privileges, dangerous operations)
```

- [ ] **Step 2: Add queue/worker/job and validator/schema to Important file path patterns**

In the Important section, find the file path patterns (lines 40-45) and replace:

**Current:**
```markdown
**File path patterns:**
- `**/service**`, `**/controller**`, `**/handler**`, `**/resolver**`
- `**/repository**`, `**/store**`, `**/model**`
- `**/api/**`, `**/route**`, `**/endpoint**`
- `**/database/**`, `**/db/**`, `**/query**`
- `**/cache**`
```

**Replace with:**
```markdown
**File path patterns:**
- `**/service**`, `**/controller**`, `**/handler**`, `**/resolver**`
- `**/repository**`, `**/store**`, `**/model**`
- `**/api/**`, `**/route**`, `**/endpoint**`
- `**/database/**`, `**/db/**`, `**/query**`
- `**/cache**`
- `**/queue**`, `**/worker**`, `**/job**`
- `**/validator**`, `**/schema**`
```

- [ ] **Step 3: Commit**

```bash
git add skills/test-review/references/criticality-patterns.md
git commit -m "fix(ref): add admin to Critical, add queue/worker/job paths to Important in criticality-patterns.md"
```

---

### Task 21: Run all tests and verify everything passes

**Files:** None (verification only)

- [ ] **Step 1: Run the full testkit test suite**

Run: `cd mcp/testkit && npx vitest run 2>&1`
Expected: All test files pass:
- `shallow-assertions.test.ts` (original 10 + 6 new = ~16 tests)
- `error-coverage.test.ts` (original 7 + 5 new = ~12 tests)
- `name-quality.test.ts` (original 8 + 8 new = ~16 tests)
- `scoring.test.ts` (original 13 + 4 new = ~17 tests)
- `mock-health.test.ts` (original 8 tests, unchanged)
- `discovery.test.ts` (new file, ~22 tests)

Total: approximately 91 tests.

- [ ] **Step 2: Run typecheck**

Run: `cd mcp/testkit && npx tsc --noEmit 2>&1`
Expected: No type errors.

- [ ] **Step 3: Build the project**

Run: `cd mcp/testkit && npm run build 2>&1`
Expected: Clean build, dist/ directory updated.

- [ ] **Step 4: Fix any failures**

If any test fails:
1. Read the error message
2. Identify whether the test expectation or the implementation is wrong
3. Fix the issue
4. Re-run the failing test file
5. Re-run the full suite

If any type errors:
1. Read the error
2. Fix the type issue (usually a missing import or wrong type annotation)
3. Re-run typecheck

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
cd mcp/testkit && git add -A
git commit -m "fix(testkit): resolve test/build issues from Phase 2 integration"
```
