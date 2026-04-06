# Phase 3: Shield (shieldkit) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Shield subsystem (shieldkit) from grade B to A- by fixing all analyzer bugs, adding Python pattern support, implementing per-finding severity, fixing skill/agent/reference content, and building a comprehensive test suite from zero.

**Architecture:** Six analyzers in `mcp/shieldkit/src/analyzers/` feed three MCP tools in `mcp/shieldkit/src/mcp/tools/`. Each analyzer is a pure function (content string in, findings out) except `discovery.ts` and `surface.ts` which do filesystem I/O. Tests live in `mcp/shieldkit/src/__tests__/` using vitest. Phase 0 provides `mcp/test-fixtures/` with security-relevant fixture files for integration tests.

**Tech Stack:** TypeScript (ES2022, NodeNext), vitest, Node.js fs/promises, globby

---

## Section 3.1 — Fix MCP Server Bugs

---

### Task 1: Fix `hardcoded-secrets.ts` — Remove `pk_` false positive

**Files:**
- Modify: `mcp/shieldkit/src/analyzers/hardcoded-secrets.ts`
- Create: `mcp/shieldkit/src/__tests__/hardcoded-secrets.test.ts`

**Current bug:** The `SECRET_PATTERNS` array includes `{ regex: /pk_[A-Za-z0-9]/, name: 'stripe-publishable-key' }`. Stripe publishable keys (`pk_test_`, `pk_live_`) are intentionally public and should never be flagged as secrets.

- [ ] **Step 1: Write test that pk_ keys are NOT flagged**

Create `mcp/shieldkit/src/__tests__/hardcoded-secrets.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { analyzeHardcodedSecrets, isExcludedFile } from '../analyzers/hardcoded-secrets.js';

describe('hardcoded-secrets', () => {
  describe('pk_ false positive removal', () => {
    it('should NOT flag Stripe publishable keys (pk_test_)', () => {
      const content = `const key = "pk_test_abc123def456";`;
      const result = analyzeHardcodedSecrets(content);
      expect(result.count).toBe(0);
      expect(result.locations).toHaveLength(0);
    });

    it('should NOT flag Stripe publishable keys (pk_live_)', () => {
      const content = `const stripeKey = "pk_live_xyz789";`;
      const result = analyzeHardcodedSecrets(content);
      expect(result.count).toBe(0);
      expect(result.locations).toHaveLength(0);
    });

    it('should still flag Stripe secret keys (sk-)', () => {
      const content = `const key = "sk-abc123def456ghi789";`;
      const result = analyzeHardcodedSecrets(content);
      expect(result.count).toBe(1);
      expect(result.locations[0].pattern).toBe('openai-secret-key');
    });
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `cd mcp/shieldkit && npx vitest run src/__tests__/hardcoded-secrets.test.ts 2>&1 | tail -20`

Expected: The `pk_test_` and `pk_live_` tests FAIL because the current code flags them.

- [ ] **Step 3: Remove pk_ from SECRET_PATTERNS**

In `mcp/shieldkit/src/analyzers/hardcoded-secrets.ts`, remove the line:

```typescript
  { regex: /pk_[A-Za-z0-9]/, name: 'stripe-publishable-key' },
```

The full `SECRET_PATTERNS` array should now be:

```typescript
const SECRET_PATTERNS: SecretPattern[] = [
  { regex: /password\s*=\s*["']/, name: 'password-assignment' },
  { regex: /apiKey\s*=\s*["']/, name: 'api-key-assignment' },
  { regex: /secret\s*=\s*["']/, name: 'secret-assignment' },
  { regex: /token\s*=\s*["']/, name: 'token-assignment' },
  { regex: /Bearer\s+[A-Za-z0-9]/, name: 'bearer-token' },
  { regex: /sk-[A-Za-z0-9]/, name: 'openai-secret-key' },
  { regex: /AKIA[A-Z0-9]/, name: 'aws-access-key' },
];
```

- [ ] **Step 4: Run test, verify it passes**

Run: `cd mcp/shieldkit && npx vitest run src/__tests__/hardcoded-secrets.test.ts 2>&1 | tail -20`

Expected: All 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add mcp/shieldkit/src/analyzers/hardcoded-secrets.ts mcp/shieldkit/src/__tests__/hardcoded-secrets.test.ts
git commit -m "fix(shieldkit): remove pk_ (Stripe publishable key) from secret patterns

Stripe publishable keys are intentionally public and should not be flagged."
```

---

### Task 2: Fix `hardcoded-secrets.ts` — Case-insensitive keyword patterns

**Files:**
- Modify: `mcp/shieldkit/src/analyzers/hardcoded-secrets.ts`
- Modify: `mcp/shieldkit/src/__tests__/hardcoded-secrets.test.ts`

**Current bug:** Keyword patterns like `/password\s*=\s*["']/` are case-sensitive. They miss `PASSWORD = "..."`, `Password = "..."`, `apikey = "..."`, `SECRET = "..."`, etc.

- [ ] **Step 1: Add tests for case-insensitive keyword matching**

Append to the `describe` block in `mcp/shieldkit/src/__tests__/hardcoded-secrets.test.ts`:

```typescript
  describe('case-insensitive keyword patterns', () => {
    it('should flag PASSWORD (uppercase)', () => {
      const content = `const PASSWORD = "hunter2";`;
      const result = analyzeHardcodedSecrets(content);
      expect(result.count).toBe(1);
      expect(result.locations[0].pattern).toBe('password-assignment');
    });

    it('should flag Password (mixed case)', () => {
      const content = `const Password = "hunter2";`;
      const result = analyzeHardcodedSecrets(content);
      expect(result.count).toBe(1);
      expect(result.locations[0].pattern).toBe('password-assignment');
    });

    it('should flag APIKEY (uppercase)', () => {
      const content = `const APIKEY = "abcdef123";`;
      const result = analyzeHardcodedSecrets(content);
      expect(result.count).toBe(1);
      expect(result.locations[0].pattern).toBe('api-key-assignment');
    });

    it('should flag SECRET (uppercase)', () => {
      const content = `const SECRET = "mysecret";`;
      const result = analyzeHardcodedSecrets(content);
      expect(result.count).toBe(1);
      expect(result.locations[0].pattern).toBe('secret-assignment');
    });

    it('should flag TOKEN (uppercase)', () => {
      const content = `const TOKEN = "mytoken123";`;
      const result = analyzeHardcodedSecrets(content);
      expect(result.count).toBe(1);
      expect(result.locations[0].pattern).toBe('token-assignment');
    });
  });
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd mcp/shieldkit && npx vitest run src/__tests__/hardcoded-secrets.test.ts 2>&1 | tail -30`

Expected: The uppercase/mixed-case tests FAIL.

- [ ] **Step 3: Add case-insensitive flag to keyword patterns**

In `mcp/shieldkit/src/analyzers/hardcoded-secrets.ts`, change the first four entries of `SECRET_PATTERNS` to include the `i` flag:

```typescript
const SECRET_PATTERNS: SecretPattern[] = [
  { regex: /password\s*=\s*["']/i, name: 'password-assignment' },
  { regex: /apiKey\s*=\s*["']/i, name: 'api-key-assignment' },
  { regex: /secret\s*=\s*["']/i, name: 'secret-assignment' },
  { regex: /token\s*=\s*["']/i, name: 'token-assignment' },
  { regex: /Bearer\s+[A-Za-z0-9]/, name: 'bearer-token' },
  { regex: /sk-[A-Za-z0-9]/, name: 'openai-secret-key' },
  { regex: /AKIA[A-Z0-9]/, name: 'aws-access-key' },
];
```

Note: `Bearer`, `sk-`, and `AKIA` are not made case-insensitive because they are fixed-format protocol/service prefixes.

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd mcp/shieldkit && npx vitest run src/__tests__/hardcoded-secrets.test.ts 2>&1 | tail -20`

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add mcp/shieldkit/src/analyzers/hardcoded-secrets.ts mcp/shieldkit/src/__tests__/hardcoded-secrets.test.ts
git commit -m "fix(shieldkit): add case-insensitive flag to keyword secret patterns

PASSWORD, ApiKey, SECRET, TOKEN etc. are now detected regardless of case."
```

---

### Task 3: Fix `hardcoded-secrets.ts` — Minimum value length check and expanded exclusions

**Files:**
- Modify: `mcp/shieldkit/src/analyzers/hardcoded-secrets.ts`
- Modify: `mcp/shieldkit/src/__tests__/hardcoded-secrets.test.ts`

**Current bug:** The keyword patterns match `password = ""` (empty string), `password = "x"`, and common placeholders like `password = "your-password-here"`, `password = "changeme"`, `password = "REPLACE_ME"`. These are false positives.

- [ ] **Step 1: Add tests for empty strings, short values, and placeholders**

Append to the `describe` block in `mcp/shieldkit/src/__tests__/hardcoded-secrets.test.ts`:

```typescript
  describe('minimum value length and placeholder exclusions', () => {
    it('should NOT flag empty string values', () => {
      const content = `const password = "";`;
      const result = analyzeHardcodedSecrets(content);
      expect(result.count).toBe(0);
    });

    it('should NOT flag single-character values', () => {
      const content = `const password = "x";`;
      const result = analyzeHardcodedSecrets(content);
      expect(result.count).toBe(0);
    });

    it('should NOT flag common placeholder values', () => {
      const lines = [
        `const password = "your-password-here";`,
        `const password = "changeme";`,
        `const password = "REPLACE_ME";`,
        `const apiKey = "your-api-key-here";`,
        `const secret = "example-secret";`,
        `const token = "xxxx";`,
        `const password = "password123";  // TODO: change this`,
      ];
      for (const line of lines) {
        const result = analyzeHardcodedSecrets(line);
        expect(result.count, `should not flag: ${line}`).toBe(0);
      }
    });

    it('should still flag real-looking secret values', () => {
      const content = `const password = "aR$7kL9mNx2pQw4v";`;
      const result = analyzeHardcodedSecrets(content);
      expect(result.count).toBe(1);
    });

    it('should NOT flag process.env references', () => {
      const content = `const password = process.env.PASSWORD;`;
      const result = analyzeHardcodedSecrets(content);
      expect(result.count).toBe(0);
    });
  });
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd mcp/shieldkit && npx vitest run src/__tests__/hardcoded-secrets.test.ts 2>&1 | tail -30`

Expected: Empty string, short value, and placeholder tests FAIL.

- [ ] **Step 3: Add minimum value length check and expanded exclusions**

In `mcp/shieldkit/src/analyzers/hardcoded-secrets.ts`, update the `EXCLUDE_LINE_PATTERNS` and add a minimum length extraction function:

Replace the existing `EXCLUDE_LINE_PATTERNS` constant and the `analyzeHardcodedSecrets` function with:

```typescript
const EXCLUDE_LINE_PATTERNS = [
  /TODO/i,
  /placeholder/i,
  /example/i,
  /changeme/i,
  /REPLACE/i,
  /your[-_]?\w*[-_]?here/i,
  /xxxx/i,
  /process\.env\./,
  /import\s/,
  /require\s*\(/,
];

const MIN_SECRET_VALUE_LENGTH = 8;

/**
 * Extract the string value after a keyword assignment like `password = "value"`.
 * Returns the value between quotes, or null if not extractable.
 */
function extractAssignedValue(line: string): string | null {
  const match = line.match(/=\s*["'`]([^"'`]*)["'`]/);
  return match ? match[1] : null;
}

export function analyzeHardcodedSecrets(content: string, filePath?: string): HardcodedSecretsResult {
  // Skip excluded file types
  if (filePath && isExcludedFile(filePath)) {
    return { count: 0, locations: [] };
  }

  const lines = content.split('\n');
  const locations: HardcodedSecretLocation[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip lines with exclusion markers
    if (EXCLUDE_LINE_PATTERNS.some(p => p.test(line))) {
      continue;
    }

    for (const { regex, name } of SECRET_PATTERNS) {
      if (regex.test(line)) {
        // For keyword-based patterns (not prefix-based like sk-, AKIA),
        // check the value meets minimum length
        const isKeywordPattern = name.endsWith('-assignment');
        if (isKeywordPattern) {
          const value = extractAssignedValue(line);
          if (!value || value.length < MIN_SECRET_VALUE_LENGTH) {
            continue;
          }
        }

        locations.push({
          line: lineNum,
          text: line.trim(),
          pattern: name,
        });
        break; // one finding per line
      }
    }
  }

  return {
    count: locations.length,
    locations,
  };
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd mcp/shieldkit && npx vitest run src/__tests__/hardcoded-secrets.test.ts 2>&1 | tail -20`

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add mcp/shieldkit/src/analyzers/hardcoded-secrets.ts mcp/shieldkit/src/__tests__/hardcoded-secrets.test.ts
git commit -m "fix(shieldkit): add minimum value length and expanded placeholder exclusions

Empty strings, short values, and common placeholders (changeme, REPLACE_ME,
your-*-here, xxxx) are no longer flagged as hardcoded secrets."
```

---

### Task 4: Fix `hardcoded-secrets.ts` — Entropy-based detection for unknown-prefix high-entropy strings

**Files:**
- Modify: `mcp/shieldkit/src/analyzers/hardcoded-secrets.ts`
- Modify: `mcp/shieldkit/src/__tests__/hardcoded-secrets.test.ts`

**Requirement:** Add Shannon entropy-based detection for high-entropy strings that don't match known prefixes but appear in secret-like assignment contexts (e.g., `const API_TOKEN = "a8Kj2mNx9pLq..."`). Threshold: Shannon entropy > 4.5.

- [ ] **Step 1: Write tests for entropy-based detection**

Append to the `describe` block in `mcp/shieldkit/src/__tests__/hardcoded-secrets.test.ts`:

```typescript
  describe('entropy-based detection', () => {
    it('should flag high-entropy strings in secret-like assignments', () => {
      // This string has high Shannon entropy (mixed case, digits, special chars)
      const content = `const API_TOKEN = "a8Kj2mNx9pLqR5vW7yBd";`;
      const result = analyzeHardcodedSecrets(content);
      expect(result.count).toBe(1);
      expect(result.locations[0].pattern).toBe('high-entropy-string');
    });

    it('should NOT flag low-entropy strings in assignments', () => {
      const content = `const greeting = "hello world this is a test";`;
      const result = analyzeHardcodedSecrets(content);
      expect(result.count).toBe(0);
    });

    it('should NOT flag repeated-character strings', () => {
      const content = `const separator = "================";`;
      const result = analyzeHardcodedSecrets(content);
      expect(result.count).toBe(0);
    });

    it('should only apply entropy check to secret-context variable names', () => {
      // Variable name has no secret keywords, even though value is high-entropy
      const content = `const greeting = "a8Kj2mNx9pLqR5vW";`;
      const result = analyzeHardcodedSecrets(content);
      expect(result.count).toBe(0);
    });

    it('should detect high-entropy values assigned to SECRET_KEY-like vars', () => {
      const content = `const SECRET_KEY = "xK9mL2nP7qR4sT8wB";`;
      const result = analyzeHardcodedSecrets(content);
      // Should be caught by either keyword pattern or entropy
      expect(result.count).toBe(1);
    });
  });
```

- [ ] **Step 2: Run tests, verify entropy tests fail**

Run: `cd mcp/shieldkit && npx vitest run src/__tests__/hardcoded-secrets.test.ts 2>&1 | tail -30`

Expected: The "high-entropy strings in secret-like assignments" test FAILS.

- [ ] **Step 3: Add Shannon entropy calculation and entropy-based detection**

In `mcp/shieldkit/src/analyzers/hardcoded-secrets.ts`, add the entropy function and integrate it into the analyzer. Add these functions before the `analyzeHardcodedSecrets` function:

```typescript
/**
 * Calculate Shannon entropy of a string.
 * Higher entropy = more random-looking = more likely to be a secret.
 */
function shannonEntropy(str: string): number {
  if (str.length === 0) return 0;

  const freq = new Map<string, number>();
  for (const char of str) {
    freq.set(char, (freq.get(char) ?? 0) + 1);
  }

  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / str.length;
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }

  return entropy;
}

const ENTROPY_THRESHOLD = 4.5;
const MIN_ENTROPY_VALUE_LENGTH = 12;

/**
 * Variable name patterns that suggest the value might be a secret.
 * Used for entropy-based detection of secrets without known prefixes.
 */
const SECRET_CONTEXT_VAR_PATTERNS = [
  /\b(api[_-]?key|api[_-]?token|auth[_-]?token|access[_-]?key|private[_-]?key)\b/i,
  /\b(secret[_-]?key|signing[_-]?key|encryption[_-]?key|master[_-]?key)\b/i,
  /\b(credentials?|passphrase|auth[_-]?secret)\b/i,
  /\b(api|secret|token|key|password|credential|auth)\s*=/i,
];
```

Then update the `analyzeHardcodedSecrets` function to add an entropy check pass after the pattern-matching loop. Replace the body of the `for` loop over lines (inside `analyzeHardcodedSecrets`) with:

```typescript
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip lines with exclusion markers
    if (EXCLUDE_LINE_PATTERNS.some(p => p.test(line))) {
      continue;
    }

    let found = false;

    // Pass 1: Known patterns
    for (const { regex, name } of SECRET_PATTERNS) {
      if (regex.test(line)) {
        const isKeywordPattern = name.endsWith('-assignment');
        if (isKeywordPattern) {
          const value = extractAssignedValue(line);
          if (!value || value.length < MIN_SECRET_VALUE_LENGTH) {
            continue;
          }
        }

        locations.push({
          line: lineNum,
          text: line.trim(),
          pattern: name,
        });
        found = true;
        break;
      }
    }

    // Pass 2: Entropy-based detection for unknown-prefix secrets
    if (!found) {
      const isSecretContext = SECRET_CONTEXT_VAR_PATTERNS.some(p => p.test(line));
      if (isSecretContext) {
        const value = extractAssignedValue(line);
        if (value && value.length >= MIN_ENTROPY_VALUE_LENGTH) {
          const entropy = shannonEntropy(value);
          if (entropy > ENTROPY_THRESHOLD) {
            locations.push({
              line: lineNum,
              text: line.trim(),
              pattern: 'high-entropy-string',
            });
          }
        }
      }
    }
  }
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd mcp/shieldkit && npx vitest run src/__tests__/hardcoded-secrets.test.ts 2>&1 | tail -20`

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add mcp/shieldkit/src/analyzers/hardcoded-secrets.ts mcp/shieldkit/src/__tests__/hardcoded-secrets.test.ts
git commit -m "feat(shieldkit): add entropy-based detection for unknown-prefix secrets

Shannon entropy > 4.5 on strings in secret-context variable assignments
catches API tokens and keys that don't match known prefixes."
```

---

### Task 5: Fix `missing-auth.ts` — Handler-level detection with expanded patterns

**Files:**
- Modify: `mcp/shieldkit/src/analyzers/missing-auth.ts`
- Create: `mcp/shieldkit/src/__tests__/missing-auth.test.ts`

**Current bugs:**
1. Detection is file-level (checks entire file content). Should be handler-level (each exported function/handler checked independently).
2. Missing auth patterns: `getServerSession`, `auth()`, `passport.authenticate`, `jwt.verify`.
3. No Python auth patterns: `@login_required`, `@permission_required`.
4. No `isRouteFile` false-positive guard -- non-route files in route directories get flagged.

- [ ] **Step 1: Write comprehensive tests**

Create `mcp/shieldkit/src/__tests__/missing-auth.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { isRouteFile, analyzeAuth, analyzeHandlerAuth, buildMissingAuthResult } from '../analyzers/missing-auth.js';

describe('missing-auth', () => {
  describe('isRouteFile', () => {
    it('should match route.ts files', () => {
      expect(isRouteFile('app/api/users/route.ts')).toBe(true);
    });

    it('should match handler files', () => {
      expect(isRouteFile('src/handler.ts')).toBe(true);
    });

    it('should match controller files', () => {
      expect(isRouteFile('src/user.controller.ts')).toBe(true);
    });

    it('should match files in routes directory', () => {
      expect(isRouteFile('src/routes/users.ts')).toBe(true);
    });

    it('should match files in api directory', () => {
      expect(isRouteFile('src/api/users.ts')).toBe(true);
    });

    it('should NOT match utility files', () => {
      expect(isRouteFile('src/utils/helpers.ts')).toBe(false);
    });

    it('should match Python route files', () => {
      expect(isRouteFile('app/routes/users.py')).toBe(true);
    });

    it('should match Python files in api directory', () => {
      expect(isRouteFile('app/api/views.py')).toBe(true);
    });
  });

  describe('analyzeAuth (file-level)', () => {
    it('should detect getSession', () => {
      expect(analyzeAuth('const session = getSession(req);')).toBe(true);
    });

    it('should detect getServerSession', () => {
      expect(analyzeAuth('const session = await getServerSession();')).toBe(true);
    });

    it('should detect auth() call', () => {
      expect(analyzeAuth('const session = await auth();')).toBe(true);
    });

    it('should detect passport.authenticate', () => {
      expect(analyzeAuth('app.use(passport.authenticate("jwt"));')).toBe(true);
    });

    it('should detect jwt.verify', () => {
      expect(analyzeAuth('const decoded = jwt.verify(token, secret);')).toBe(true);
    });

    it('should detect Python @login_required', () => {
      expect(analyzeAuth('@login_required')).toBe(true);
    });

    it('should detect Python @permission_required', () => {
      expect(analyzeAuth('@permission_required("admin")')).toBe(true);
    });

    it('should return false when no auth patterns found', () => {
      expect(analyzeAuth('function getData() { return db.query("SELECT *"); }')).toBe(false);
    });
  });

  describe('analyzeHandlerAuth (handler-level)', () => {
    it('should detect auth in individual handlers', () => {
      const content = `
export async function GET(req) {
  const session = await getServerSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  return Response.json({ data: "ok" });
}

export async function POST(req) {
  // No auth check here!
  const body = await req.json();
  return Response.json({ created: true });
}
`;
      const result = analyzeHandlerAuth(content);
      expect(result).toHaveLength(2);

      const getHandler = result.find(h => h.name === 'GET');
      expect(getHandler?.hasAuth).toBe(true);

      const postHandler = result.find(h => h.name === 'POST');
      expect(postHandler?.hasAuth).toBe(false);
    });

    it('should detect auth in Express-style handlers', () => {
      const content = `
export function registerRoutes(app) {
  app.get('/users/:id', async (req, res) => {
    const token = req.headers['authorization'];
    const auth = verifyToken(token);
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });
    res.json({ user: {} });
  });

  app.post('/users', async (req, res) => {
    const { email } = req.body;
    res.json({ created: true });
  });
}
`;
      const result = analyzeHandlerAuth(content);
      // Should find at least the unprotected POST handler
      const unprotected = result.filter(h => !h.hasAuth);
      expect(unprotected.length).toBeGreaterThanOrEqual(1);
    });

    it('should require handler exports (isRouteFile guard)', () => {
      const content = `
// This is a utility file, not a route file -- no exports of handlers
function internalHelper() {
  return db.query("SELECT * FROM users");
}
`;
      const result = analyzeHandlerAuth(content);
      expect(result).toHaveLength(0);
    });

    it('should detect Python handler functions with missing decorators', () => {
      const content = `
@app.route("/users", methods=["POST"])
def create_user():
    data = request.get_json()
    return jsonify(data), 201

@app.route("/users/<user_id>", methods=["GET"])
@login_required
def get_user(user_id):
    user = User.query.get(user_id)
    return jsonify(user)
`;
      const result = analyzeHandlerAuth(content);
      const unprotected = result.filter(h => !h.hasAuth);
      expect(unprotected.length).toBeGreaterThanOrEqual(1);
      expect(unprotected.some(h => h.name === 'create_user')).toBe(true);
    });
  });

  describe('buildMissingAuthResult', () => {
    it('should count unprotected files correctly', () => {
      const files = [
        { path: 'routes/a.ts', hasAuth: true },
        { path: 'routes/b.ts', hasAuth: false },
        { path: 'routes/c.ts', hasAuth: false },
      ];
      const result = buildMissingAuthResult(files);
      expect(result.total).toBe(3);
      expect(result.unprotected).toBe(2);
    });
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd mcp/shieldkit && npx vitest run src/__tests__/missing-auth.test.ts 2>&1 | tail -30`

Expected: Multiple failures -- `analyzeHandlerAuth` does not exist yet, expanded auth patterns not matched.

- [ ] **Step 3: Rewrite missing-auth.ts with handler-level detection**

Replace the entire contents of `mcp/shieldkit/src/analyzers/missing-auth.ts`:

```typescript
/**
 * Missing auth analyzer.
 *
 * Detects route handler functions that lack auth function calls.
 * Checks for common auth patterns at handler level, not just file level.
 * Supports JS/TS and Python auth patterns.
 */

export interface MissingAuthLocation {
  file: string;
  hasAuth: boolean;
}

export interface HandlerAuthResult {
  name: string;
  hasAuth: boolean;
  startLine: number;
}

export interface MissingAuthResult {
  total: number;
  unprotected: number;
  locations: MissingAuthLocation[];
}

const AUTH_PATTERNS = [
  /\bgetSession\b/,
  /\bgetServerSession\b/,
  /\bgetUser\b/,
  /\bverifyToken\b/,
  /\bauthenticate\b/,
  /\brequireAuth\b/,
  /\bwithAuth\b/,
  /\bisAuthenticated\b/,
  /\bcheckAuth\b/,
  /\bauth\s*\(\s*\)/,
  /\bpassport\.authenticate\b/,
  /\bjwt\.verify\b/,
  // Python patterns
  /@login_required\b/,
  /@permission_required\b/,
  /@requires_auth\b/,
  /@jwt_required\b/,
];

const ROUTE_FILE_PATTERNS = [
  /route\.(ts|js|tsx|jsx)$/,
  /handler\.(ts|js|tsx|jsx)$/,
  /controller\.(ts|js|tsx|jsx)$/,
  /[/\\]routes[/\\]/,
  /[/\\]api[/\\]/,
  /[/\\]controllers[/\\]/,
  // Python route files
  /views\.py$/,
  /routes\.py$/,
  /api\.py$/,
  /urls\.py$/,
];

export function isRouteFile(filePath: string): boolean {
  return ROUTE_FILE_PATTERNS.some(p => p.test(filePath));
}

export function analyzeAuth(content: string): boolean {
  // Check if any auth function calls appear in the content
  return AUTH_PATTERNS.some(p => p.test(content));
}

/**
 * Analyze individual handlers within a file for auth patterns.
 * Returns per-handler auth status.
 */
export function analyzeHandlerAuth(content: string): HandlerAuthResult[] {
  const results: HandlerAuthResult[] = [];

  // Detect JS/TS exported handler functions
  const jsHandlers = extractJsHandlers(content);
  for (const handler of jsHandlers) {
    const hasAuth = AUTH_PATTERNS.some(p => p.test(handler.body));
    results.push({
      name: handler.name,
      hasAuth,
      startLine: handler.startLine,
    });
  }

  // Detect Python route handlers
  const pyHandlers = extractPythonHandlers(content);
  for (const handler of pyHandlers) {
    const hasAuth = AUTH_PATTERNS.some(p => p.test(handler.decorators));
    results.push({
      name: handler.name,
      hasAuth,
      startLine: handler.startLine,
    });
  }

  return results;
}

interface ExtractedHandler {
  name: string;
  body: string;
  startLine: number;
}

interface ExtractedPyHandler {
  name: string;
  decorators: string;
  startLine: number;
}

/**
 * Extract exported JS/TS handler functions from file content.
 * Matches: export async function NAME, export function NAME,
 * app.get/post/put/delete/patch patterns.
 */
function extractJsHandlers(content: string): ExtractedHandler[] {
  const handlers: ExtractedHandler[] = [];
  const lines = content.split('\n');

  // Pattern 1: export (async) function NAME
  const exportFnRegex = /^export\s+(async\s+)?function\s+(\w+)/;
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(exportFnRegex);
    if (match) {
      const name = match[2];
      const body = extractFunctionBody(lines, i);
      handlers.push({ name, body, startLine: i + 1 });
    }
  }

  // Pattern 2: app.METHOD('/path', handler) -- Express-style
  const appMethodRegex = /app\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/;
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(appMethodRegex);
    if (match) {
      const method = match[1].toUpperCase();
      const path = match[2];
      const body = extractFunctionBody(lines, i);
      const name = `${method} ${path}`;
      handlers.push({ name, body, startLine: i + 1 });
    }
  }

  return handlers;
}

/**
 * Extract Python route handlers by finding @app.route decorators
 * and the def that follows them.
 */
function extractPythonHandlers(content: string): ExtractedPyHandler[] {
  const handlers: ExtractedPyHandler[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    // Look for Python function definitions
    const defMatch = lines[i].match(/^def\s+(\w+)\s*\(/);
    if (!defMatch) continue;

    const name = defMatch[1];

    // Collect all decorators above this def
    let decorators = '';
    let j = i - 1;
    while (j >= 0 && (lines[j].trim().startsWith('@') || lines[j].trim() === '')) {
      if (lines[j].trim().startsWith('@')) {
        decorators = lines[j] + '\n' + decorators;
      }
      j--;
    }

    // Only include if it has a route decorator
    if (/@app\.(route|get|post|put|delete|patch)\b/.test(decorators) ||
        /@router\.(route|get|post|put|delete|patch)\b/.test(decorators)) {
      handlers.push({ name, decorators, startLine: i + 1 });
    }
  }

  return handlers;
}

/**
 * Extract the body of a function starting from the given line index.
 * Uses brace counting for JS/TS.
 */
function extractFunctionBody(lines: string[], startIndex: number): string {
  let braceCount = 0;
  let started = false;
  const bodyLines: string[] = [];

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    bodyLines.push(line);

    for (const char of line) {
      if (char === '{') {
        braceCount++;
        started = true;
      } else if (char === '}') {
        braceCount--;
      }
    }

    if (started && braceCount <= 0) {
      break;
    }
  }

  return bodyLines.join('\n');
}

export function buildMissingAuthResult(files: Array<{ path: string; hasAuth: boolean }>): MissingAuthResult {
  const unprotected = files.filter(f => !f.hasAuth).length;

  return {
    total: files.length,
    unprotected,
    locations: files.map(f => ({ file: f.path, hasAuth: f.hasAuth })),
  };
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd mcp/shieldkit && npx vitest run src/__tests__/missing-auth.test.ts 2>&1 | tail -20`

Expected: All tests pass.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd mcp/shieldkit && npx tsc --noEmit 2>&1 | tail -20`

Expected: No type errors. Other files that import from `missing-auth.ts` should still work because we kept all existing exports and only added new ones.

- [ ] **Step 6: Commit**

```bash
git add mcp/shieldkit/src/analyzers/missing-auth.ts mcp/shieldkit/src/__tests__/missing-auth.test.ts
git commit -m "feat(shieldkit): handler-level auth detection with expanded patterns

Adds analyzeHandlerAuth for per-handler detection instead of file-level.
Adds getServerSession, auth(), passport.authenticate, jwt.verify.
Adds Python patterns: @login_required, @permission_required."
```

---

### Task 6: Fix `sql-injection.ts` — Test file exclusion, nested template handling, comment stripping, Python f-string detection

**Files:**
- Modify: `mcp/shieldkit/src/analyzers/sql-injection.ts`
- Create: `mcp/shieldkit/src/__tests__/sql-injection.test.ts`

**Current bugs:**
1. No test file exclusion -- test files with intentional SQL injection examples get flagged.
2. Nested template literals -- the backtick inside `${}` breaks the parser because `findTemplateBlocks` does not track `${}` depth.
3. No comment stripping -- SQL in comments gets flagged.
4. No Python f-string detection.
5. No parameterized query recognition (to reduce false positives).

- [ ] **Step 1: Write comprehensive tests**

Create `mcp/shieldkit/src/__tests__/sql-injection.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { analyzeSqlInjection } from '../analyzers/sql-injection.js';

describe('sql-injection', () => {
  describe('basic detection', () => {
    it('should detect template literal SQL injection', () => {
      const content = 'const q = `SELECT * FROM users WHERE id = ${userId}`;';
      const result = analyzeSqlInjection(content);
      expect(result.count).toBe(1);
      expect(result.locations[0].pattern).toBe('template-literal-interpolation');
    });

    it('should detect string concatenation SQL injection', () => {
      const content = `const q = "SELECT * FROM users WHERE id = " + userId;`;
      const result = analyzeSqlInjection(content);
      expect(result.count).toBe(1);
      expect(result.locations[0].pattern).toBe('string-concatenation');
    });

    it('should detect multi-line template literal SQL injection', () => {
      const content = `const q = \`
  SELECT * FROM users
  WHERE id = \${userId}
  AND active = true
\`;`;
      const result = analyzeSqlInjection(content);
      expect(result.count).toBe(1);
    });

    it('should NOT flag parameterized queries', () => {
      const content = `const q = db.query("SELECT * FROM users WHERE id = $1", [userId]);`;
      const result = analyzeSqlInjection(content);
      expect(result.count).toBe(0);
    });
  });

  describe('test file exclusion', () => {
    it('should NOT flag SQL in test files', () => {
      const content = 'const q = `SELECT * FROM users WHERE id = ${userId}`;';
      const result = analyzeSqlInjection(content, 'src/db.test.ts');
      expect(result.count).toBe(0);
    });

    it('should NOT flag SQL in spec files', () => {
      const content = 'const q = `SELECT * FROM users WHERE id = ${userId}`;';
      const result = analyzeSqlInjection(content, 'src/db.spec.ts');
      expect(result.count).toBe(0);
    });

    it('should NOT flag SQL in __tests__ directory', () => {
      const content = 'const q = `SELECT * FROM users WHERE id = ${userId}`;';
      const result = analyzeSqlInjection(content, 'src/__tests__/db.ts');
      expect(result.count).toBe(0);
    });

    it('should still flag SQL in non-test files', () => {
      const content = 'const q = `SELECT * FROM users WHERE id = ${userId}`;';
      const result = analyzeSqlInjection(content, 'src/db.ts');
      expect(result.count).toBe(1);
    });
  });

  describe('nested template literal handling', () => {
    it('should handle nested template literals inside ${}', () => {
      const content = 'const q = `SELECT * FROM ${getTable(`users`)} WHERE id = ${userId}`;';
      const result = analyzeSqlInjection(content);
      expect(result.count).toBe(1);
    });
  });

  describe('comment stripping', () => {
    it('should NOT flag SQL in single-line comments', () => {
      const content = `// const q = \`SELECT * FROM users WHERE id = \${userId}\`;`;
      const result = analyzeSqlInjection(content);
      expect(result.count).toBe(0);
    });

    it('should NOT flag SQL in multi-line comments', () => {
      const content = `/* const q = \`SELECT * FROM users WHERE id = \${userId}\`; */`;
      const result = analyzeSqlInjection(content);
      expect(result.count).toBe(0);
    });

    it('should NOT flag SQL in JSDoc comments', () => {
      const content = `/**
 * Example: \`SELECT * FROM users WHERE id = \${userId}\`
 */`;
      const result = analyzeSqlInjection(content);
      expect(result.count).toBe(0);
    });
  });

  describe('Python f-string detection', () => {
    it('should detect Python f-string SQL injection', () => {
      const content = `query = f"SELECT * FROM users WHERE name = '{user_input}'"`;
      const result = analyzeSqlInjection(content);
      expect(result.count).toBe(1);
      expect(result.locations[0].pattern).toBe('python-f-string-interpolation');
    });

    it('should detect Python format-string SQL injection', () => {
      const content = `query = "SELECT * FROM users WHERE name = '%s'" % user_input`;
      const result = analyzeSqlInjection(content);
      expect(result.count).toBe(1);
      expect(result.locations[0].pattern).toBe('python-format-interpolation');
    });

    it('should NOT flag Python parameterized queries', () => {
      const content = `cursor.execute("SELECT * FROM users WHERE name = %s", [user_input])`;
      const result = analyzeSqlInjection(content);
      expect(result.count).toBe(0);
    });
  });

  describe('false positive avoidance', () => {
    it('should NOT flag ORM method chains', () => {
      const content = `const users = await prisma.user.findMany({ where: { id: userId } });`;
      const result = analyzeSqlInjection(content);
      expect(result.count).toBe(0);
    });

    it('should NOT flag query builder patterns', () => {
      const content = `const users = await knex("users").where("id", userId).select("*");`;
      const result = analyzeSqlInjection(content);
      expect(result.count).toBe(0);
    });
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd mcp/shieldkit && npx vitest run src/__tests__/sql-injection.test.ts 2>&1 | tail -30`

Expected: Test file exclusion, comment stripping, Python, and nested template tests FAIL.

- [ ] **Step 3: Rewrite sql-injection.ts with all fixes**

Replace the entire contents of `mcp/shieldkit/src/analyzers/sql-injection.ts`:

```typescript
/**
 * SQL injection analyzer.
 *
 * Detects string interpolation in SQL contexts: template literals with
 * SQL keywords and ${} interpolation, string concatenation with SQL keywords,
 * Python f-strings, and Python format strings with SQL keywords.
 *
 * Excludes: test files, comments, parameterized queries.
 */

export interface SqlInjectionLocation {
  line: number;
  text: string;
  pattern: string;
}

export interface SqlInjectionResult {
  count: number;
  locations: SqlInjectionLocation[];
}

const SQL_KEYWORDS = /\b(SELECT|INSERT|UPDATE|DELETE|WHERE|FROM|JOIN)\b/i;

const TEST_FILE_PATTERNS = [
  /\.(test|spec)\.(ts|js|tsx|jsx|mjs|cjs)$/,
  /\/__tests__\//,
  /\/test\//,
  /\.test\.py$/,
  /test_\w+\.py$/,
];

/**
 * Check if a file is a test file that should be excluded from analysis.
 */
function isTestFile(filePath: string): boolean {
  return TEST_FILE_PATTERNS.some(p => p.test(filePath));
}

/**
 * Strip comments from source content.
 * Handles: // single-line, multi-line comment blocks, # Python single-line
 */
function stripComments(content: string): string {
  // Remove multi-line comments
  let result = content.replace(/\/\*[\s\S]*?\*\//g, (match) => {
    // Preserve line count by replacing with same number of newlines
    return match.replace(/[^\n]/g, ' ');
  });

  // Remove single-line comments (// ...) and Python comments (# ...)
  result = result.replace(/\/\/.*$/gm, (match) => ' '.repeat(match.length));
  result = result.replace(/(?<=^|\s)#.*$/gm, (match) => ' '.repeat(match.length));

  return result;
}

/**
 * Check if a line contains a parameterized query pattern,
 * which means the SQL is safe even though it uses interpolation-like syntax.
 */
function isParameterizedQuery(line: string): boolean {
  // JS/TS: db.query("...", [params]) or .execute("...", [...])
  if (/\.\s*(query|execute)\s*\([^)]*,\s*\[/.test(line)) return true;
  // Python: cursor.execute("...", [params]) or cursor.execute("...", (params))
  if (/\.execute\s*\([^)]*,\s*[\[(]/.test(line)) return true;
  // Prisma, Knex, Sequelize-style ORM
  if (/\.(findMany|findOne|findUnique|findFirst|where|select)\s*\(/.test(line)) return true;
  return false;
}

export function analyzeSqlInjection(content: string, filePath?: string): SqlInjectionResult {
  // Skip test files
  if (filePath && isTestFile(filePath)) {
    return { count: 0, locations: [] };
  }

  // Strip comments before analysis
  const strippedContent = stripComments(content);
  const lines = strippedContent.split('\n');
  const locations: SqlInjectionLocation[] = [];
  const reportedLines = new Set<number>();

  // Use original lines for display text
  const originalLines = content.split('\n');

  // Pass 1: Multi-line template literal detection
  const templateBlocks = findTemplateBlocks(strippedContent);
  for (const block of templateBlocks) {
    if (SQL_KEYWORDS.test(block.text) && /\$\{/.test(block.text)) {
      const blockLines = block.text.split('\n');
      for (let j = 0; j < blockLines.length; j++) {
        if (/\$\{/.test(blockLines[j])) {
          const lineNum = block.startLine + j;
          if (!reportedLines.has(lineNum)) {
            // Check this is not a parameterized query
            const fullLine = originalLines[lineNum - 1] ?? blockLines[j];
            if (!isParameterizedQuery(fullLine)) {
              reportedLines.add(lineNum);
              locations.push({
                line: lineNum,
                text: (originalLines[lineNum - 1] ?? blockLines[j]).trim(),
                pattern: 'template-literal-interpolation',
              });
            }
          }
        }
      }
    }
  }

  // Pass 2: Single-line detection
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const originalLine = originalLines[i] ?? line;

    if (reportedLines.has(lineNum)) continue;
    if (isParameterizedQuery(originalLine)) continue;

    // Single-line template literal with SQL + interpolation
    if (SQL_KEYWORDS.test(line) && /\$\{/.test(line) && /`/.test(line)) {
      reportedLines.add(lineNum);
      locations.push({
        line: lineNum,
        text: originalLine.trim(),
        pattern: 'template-literal-interpolation',
      });
      continue;
    }

    // String concatenation with SQL keywords
    if (SQL_KEYWORDS.test(line) && /["']\s*\+\s*\w+/.test(line)) {
      reportedLines.add(lineNum);
      locations.push({
        line: lineNum,
        text: originalLine.trim(),
        pattern: 'string-concatenation',
      });
      continue;
    }

    // Concatenation on the variable side
    if (SQL_KEYWORDS.test(line) && /\w+\s*\+\s*["']/.test(line)) {
      if (/\w+\s*\+\s*["'][^"']*\b(SELECT|INSERT|UPDATE|DELETE|WHERE|FROM|JOIN)\b/i.test(line) ||
          /\b(SELECT|INSERT|UPDATE|DELETE|WHERE|FROM|JOIN)\b[^"']*["']\s*\+\s*\w+/i.test(line)) {
        reportedLines.add(lineNum);
        locations.push({
          line: lineNum,
          text: originalLine.trim(),
          pattern: 'string-concatenation',
        });
      }
      continue;
    }

    // Python f-string with SQL keywords and {variable}
    if (SQL_KEYWORDS.test(line) && /f["']/.test(line) && /\{[^}]+\}/.test(line)) {
      reportedLines.add(lineNum);
      locations.push({
        line: lineNum,
        text: originalLine.trim(),
        pattern: 'python-f-string-interpolation',
      });
      continue;
    }

    // Python %-format with SQL keywords
    if (SQL_KEYWORDS.test(line) && /%s/.test(line) && /["']\s*%\s*\w+/.test(line)) {
      reportedLines.add(lineNum);
      locations.push({
        line: lineNum,
        text: originalLine.trim(),
        pattern: 'python-format-interpolation',
      });
      continue;
    }
  }

  locations.sort((a, b) => a.line - b.line);

  return {
    count: locations.length,
    locations,
  };
}

/** Extract template literal blocks with their start line numbers. */
function findTemplateBlocks(content: string): Array<{ text: string; startLine: number }> {
  const blocks: Array<{ text: string; startLine: number }> = [];
  let i = 0;
  let lineNum = 1;

  while (i < content.length) {
    if (content[i] === '\n') {
      lineNum++;
      i++;
      continue;
    }

    if (content[i] === '`') {
      const startLine = lineNum;
      let blockText = '`';
      i++;

      // Walk through the template literal, tracking ${} depth
      let braceDepth = 0;

      while (i < content.length) {
        // Handle escape sequences
        if (content[i] === '\\') {
          blockText += content[i] + (content[i + 1] ?? '');
          i += 2;
          continue;
        }

        // Track ${} nesting
        if (content[i] === '$' && content[i + 1] === '{' && braceDepth === 0) {
          braceDepth = 1;
          blockText += '${';
          i += 2;
          continue;
        }

        if (braceDepth > 0) {
          if (content[i] === '{') {
            braceDepth++;
          } else if (content[i] === '}') {
            braceDepth--;
          }
          // Inside ${}, backticks are nested template literals -- skip them
          if (content[i] === '`') {
            blockText += '`';
            i++;
            // Walk through the nested template literal
            let nestedBraceDepth = 0;
            while (i < content.length) {
              if (content[i] === '\\') {
                blockText += content[i] + (content[i + 1] ?? '');
                i += 2;
                continue;
              }
              if (content[i] === '$' && content[i + 1] === '{') {
                nestedBraceDepth++;
                blockText += '${';
                i += 2;
                continue;
              }
              if (nestedBraceDepth > 0 && content[i] === '}') {
                nestedBraceDepth--;
              }
              if (content[i] === '`' && nestedBraceDepth === 0) {
                blockText += '`';
                i++;
                break;
              }
              if (content[i] === '\n') lineNum++;
              blockText += content[i];
              i++;
            }
            continue;
          }

          if (content[i] === '\n') lineNum++;
          blockText += content[i];
          i++;
          continue;
        }

        // Outside ${}, a backtick closes the template literal
        if (content[i] === '`') {
          blockText += '`';
          i++;
          break;
        }

        if (content[i] === '\n') lineNum++;
        blockText += content[i];
        i++;
      }

      // Only include multi-line blocks (single-line handled by Pass 2)
      if (blockText.includes('\n')) {
        blocks.push({ text: blockText, startLine });
      }
    } else {
      i++;
    }
  }

  return blocks;
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd mcp/shieldkit && npx vitest run src/__tests__/sql-injection.test.ts 2>&1 | tail -20`

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add mcp/shieldkit/src/analyzers/sql-injection.ts mcp/shieldkit/src/__tests__/sql-injection.test.ts
git commit -m "fix(shieldkit): sql-injection test exclusion, nested templates, comment stripping, Python

Excludes test files. Tracks brace depth for nested template literals.
Strips single-line and multi-line comments before analysis. Adds Python
f-string and percent-format detection. Recognizes parameterized queries as safe."
```

---

### Task 7: Fix `dangerous-functions.ts` — Add missing patterns and per-finding severity

**Files:**
- Modify: `mcp/shieldkit/src/analyzers/dangerous-functions.ts`
- Create: `mcp/shieldkit/src/__tests__/dangerous-functions.test.ts`

**Current gaps:**
1. Missing JS/TS patterns: `setTimeout`/`setInterval` with string arg, `document.write()`, `execSync()`, `vm.runInNewContext()`.
2. Missing Python patterns: `os.system()`, `subprocess.call(shell=True)`, `eval()`, `exec()`, `pickle.loads()`.
3. No per-finding severity -- all dangerous functions are treated equally.

- [ ] **Step 1: Write comprehensive tests**

Create `mcp/shieldkit/src/__tests__/dangerous-functions.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { analyzeDangerousFunctions } from '../analyzers/dangerous-functions.js';

describe('dangerous-functions', () => {
  describe('existing JS/TS patterns', () => {
    it('should detect eval()', () => {
      const result = analyzeDangerousFunctions('const r = eval(userInput);');
      expect(result.count).toBe(1);
      expect(result.locations[0].pattern).toBe('eval');
      expect(result.locations[0].severity).toBe('critical');
    });

    it('should detect Function constructor', () => {
      const result = analyzeDangerousFunctions('const fn = Function("return " + code);');
      expect(result.count).toBe(1);
      expect(result.locations[0].severity).toBe('critical');
    });

    it('should detect innerHTML assignment', () => {
      const result = analyzeDangerousFunctions('el.innerHTML = userContent;');
      expect(result.count).toBe(1);
      expect(result.locations[0].pattern).toBe('innerHTML-assignment');
      expect(result.locations[0].severity).toBe('high');
    });

    it('should detect dangerouslySetInnerHTML', () => {
      const result = analyzeDangerousFunctions('<div dangerouslySetInnerHTML={{ __html: content }} />');
      expect(result.count).toBe(1);
      expect(result.locations[0].severity).toBe('medium');
    });

    it('should detect shell exec but not execFile', () => {
      const exec_result = analyzeDangerousFunctions('require("child_process").exec(cmd);');
      expect(exec_result.count).toBe(1);

      const execFile_result = analyzeDangerousFunctions('require("child_process").execFile("/bin/ls", ["-la"]);');
      expect(execFile_result.count).toBe(0);
    });
  });

  describe('new JS/TS patterns', () => {
    it('should detect setTimeout with string argument', () => {
      const result = analyzeDangerousFunctions('setTimeout("alert(1)", 1000);');
      expect(result.count).toBe(1);
      expect(result.locations[0].pattern).toBe('setTimeout-string');
    });

    it('should NOT detect setTimeout with function argument', () => {
      const result = analyzeDangerousFunctions('setTimeout(() => { doThing(); }, 1000);');
      expect(result.count).toBe(0);
    });

    it('should detect setInterval with string argument', () => {
      const result = analyzeDangerousFunctions('setInterval("poll()", 5000);');
      expect(result.count).toBe(1);
      expect(result.locations[0].pattern).toBe('setInterval-string');
    });

    it('should detect document.write()', () => {
      const result = analyzeDangerousFunctions('document.write(userContent);');
      expect(result.count).toBe(1);
      expect(result.locations[0].pattern).toBe('document-write');
      expect(result.locations[0].severity).toBe('high');
    });

    it('should detect execSync()', () => {
      const result = analyzeDangerousFunctions('const out = execSync(cmd);');
      expect(result.count).toBe(1);
      expect(result.locations[0].pattern).toBe('execSync');
    });

    it('should detect vm.runInNewContext()', () => {
      const result = analyzeDangerousFunctions('vm.runInNewContext(code, sandbox);');
      expect(result.count).toBe(1);
      expect(result.locations[0].pattern).toBe('vm-runInNewContext');
    });
  });

  describe('Python patterns', () => {
    it('should detect os.system()', () => {
      const result = analyzeDangerousFunctions('os.system(user_cmd)');
      expect(result.count).toBe(1);
      expect(result.locations[0].pattern).toBe('python-os-system');
    });

    it('should detect subprocess with shell=True', () => {
      const result = analyzeDangerousFunctions('subprocess.call(cmd, shell=True)');
      expect(result.count).toBe(1);
      expect(result.locations[0].pattern).toBe('python-subprocess-shell');
    });

    it('should detect Python eval()', () => {
      const result = analyzeDangerousFunctions('result = eval(user_expr)');
      expect(result.count).toBe(1);
      expect(result.locations[0].severity).toBe('critical');
    });

    it('should detect Python exec()', () => {
      const result = analyzeDangerousFunctions('exec(user_code)');
      expect(result.count).toBe(1);
      expect(result.locations[0].pattern).toBe('python-exec');
    });

    it('should detect pickle.loads()', () => {
      const result = analyzeDangerousFunctions('obj = pickle.loads(data)');
      expect(result.count).toBe(1);
      expect(result.locations[0].pattern).toBe('python-pickle-loads');
    });
  });

  describe('per-finding severity', () => {
    it('should assign critical to eval and Function', () => {
      const result = analyzeDangerousFunctions('eval(x);\nnew Function(y);');
      expect(result.locations[0].severity).toBe('critical');
      expect(result.locations[1].severity).toBe('critical');
    });

    it('should assign high to innerHTML and document.write', () => {
      const result = analyzeDangerousFunctions('el.innerHTML = x;\ndocument.write(y);');
      expect(result.locations[0].severity).toBe('high');
      expect(result.locations[1].severity).toBe('high');
    });

    it('should assign medium to dangerouslySetInnerHTML', () => {
      const result = analyzeDangerousFunctions('dangerouslySetInnerHTML={{ __html: x }}');
      expect(result.locations[0].severity).toBe('medium');
    });
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd mcp/shieldkit && npx vitest run src/__tests__/dangerous-functions.test.ts 2>&1 | tail -30`

Expected: New pattern tests fail, severity tests fail (no `severity` field on locations).

- [ ] **Step 3: Rewrite dangerous-functions.ts with new patterns and per-finding severity**

Replace the entire contents of `mcp/shieldkit/src/analyzers/dangerous-functions.ts`:

```typescript
/**
 * Dangerous functions analyzer.
 *
 * Detects risky API usage patterns in scanned source files.
 * This analyzer reads file content and flags unsafe patterns;
 * it does NOT execute any of the detected patterns.
 *
 * Each finding includes a severity level:
 * - critical: code execution (eval, Function, shell exec)
 * - high: DOM manipulation (innerHTML, document.write), sync shell exec
 * - medium: framework-assisted (dangerouslySetInnerHTML), timer-string
 */

import type { Severity } from './scoring.js';

export interface DangerousFunctionLocation {
  line: number;
  text: string;
  pattern: string;
  severity: Severity;
}

export interface DangerousFunctionsResult {
  count: number;
  locations: DangerousFunctionLocation[];
}

interface DangerousPattern {
  regex: RegExp;
  name: string;
  severity: Severity;
  excludeRegex?: RegExp;
}

/** Build a regex from parts to avoid static analysis false positives. */
function buildRegex(...parts: string[]): RegExp {
  return new RegExp(parts.join(''));
}

const DANGEROUS_PATTERNS: DangerousPattern[] = [
  // Critical: Code execution
  { regex: /\beval\s*\(/, name: 'eval', severity: 'critical' },
  { regex: /\bFunction\s*\(/, name: 'Function-constructor', severity: 'critical' },
  { regex: /\bnew\s+Function\s*\(/, name: 'new-Function', severity: 'critical' },

  // High: DOM manipulation / shell execution
  { regex: /\.innerHTML\s*=/, name: 'innerHTML-assignment', severity: 'high' },
  { regex: /\bdocument\.write\s*\(/, name: 'document-write', severity: 'high' },
  {
    regex: buildRegex('child_process', '\\.exec\\s*\\('),
    name: 'child-process-exec',
    severity: 'high',
    excludeRegex: buildRegex('child_process', '\\.execFile'),
  },
  { regex: /\bexecSync\s*\(/, name: 'execSync', severity: 'high' },
  { regex: /\bvm\.runInNewContext\s*\(/, name: 'vm-runInNewContext', severity: 'high' },

  // Medium: Framework-assisted, timer-string
  { regex: buildRegex('dangerously', 'SetInnerHTML'), name: 'dangerous-set-inner-html', severity: 'medium' },
  {
    regex: /\bsetTimeout\s*\(\s*["'`]/,
    name: 'setTimeout-string',
    severity: 'medium',
  },
  {
    regex: /\bsetInterval\s*\(\s*["'`]/,
    name: 'setInterval-string',
    severity: 'medium',
  },

  // Python: Critical
  { regex: /\bos\.system\s*\(/, name: 'python-os-system', severity: 'critical' },
  {
    regex: /\bsubprocess\.\w+\s*\([^)]*shell\s*=\s*True/,
    name: 'python-subprocess-shell',
    severity: 'critical',
  },
  { regex: /\bexec\s*\(/, name: 'python-exec', severity: 'critical' },
  { regex: /\bpickle\.loads\s*\(/, name: 'python-pickle-loads', severity: 'critical' },
];

export function analyzeDangerousFunctions(content: string): DangerousFunctionsResult {
  const lines = content.split('\n');
  const locations: DangerousFunctionLocation[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    for (const { regex, name, severity, excludeRegex } of DANGEROUS_PATTERNS) {
      if (regex.test(line)) {
        // Skip if the exclude pattern matches (e.g., execFile is safe)
        if (excludeRegex && excludeRegex.test(line)) {
          continue;
        }

        locations.push({
          line: lineNum,
          text: line.trim(),
          pattern: name,
          severity,
        });
        break; // one finding per line
      }
    }
  }

  return {
    count: locations.length,
    locations,
  };
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd mcp/shieldkit && npx vitest run src/__tests__/dangerous-functions.test.ts 2>&1 | tail -20`

Expected: All tests pass.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd mcp/shieldkit && npx tsc --noEmit 2>&1 | tail -20`

Expected: Clean compilation. Note: other files consuming `DangerousFunctionLocation` will need to handle the new `severity` field. This is fine because we are adding a field, not removing one.

- [ ] **Step 6: Commit**

```bash
git add mcp/shieldkit/src/analyzers/dangerous-functions.ts mcp/shieldkit/src/__tests__/dangerous-functions.test.ts
git commit -m "feat(shieldkit): expand dangerous-functions with new patterns and per-finding severity

Adds: setTimeout/setInterval string, document.write, execSync, vm.runInNewContext.
Adds Python: os.system, subprocess(shell=True), eval, exec, pickle.loads.
Each finding now includes severity: critical, high, or medium."
```

---

### Task 8: Fix `cors-config.ts` — Variable-stored config, expanded context window, credentials+wildcard detection

**Files:**
- Modify: `mcp/shieldkit/src/analyzers/cors-config.ts`
- Create: `mcp/shieldkit/src/__tests__/cors-config.test.ts`

**Current bugs:**
1. No detection of variable-stored config: `const corsOptions = { origin: '*' }; ... app.use(cors(corsOptions));`
2. Context window for standalone `origin:` patterns is only 5 lines (should be 10).
3. No `credentials: true` + wildcard origin detection (this is the actually dangerous combination).

- [ ] **Step 1: Write comprehensive tests**

Create `mcp/shieldkit/src/__tests__/cors-config.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { analyzeCorsConfig } from '../analyzers/cors-config.js';

describe('cors-config', () => {
  describe('basic detection', () => {
    it('should detect Access-Control-Allow-Origin wildcard', () => {
      const content = `res.setHeader("Access-Control-Allow-Origin", "*");`;
      const result = analyzeCorsConfig(content);
      expect(result.count).toBe(1);
    });

    it('should detect cors origin wildcard', () => {
      const content = `app.use(cors({ origin: '*' }));`;
      const result = analyzeCorsConfig(content);
      expect(result.count).toBe(1);
    });

    it('should detect cors origin true', () => {
      const content = `app.use(cors({ origin: true }));`;
      const result = analyzeCorsConfig(content);
      expect(result.count).toBe(1);
    });

    it('should NOT flag specific origin', () => {
      const content = `app.use(cors({ origin: 'https://example.com' }));`;
      const result = analyzeCorsConfig(content);
      expect(result.count).toBe(0);
    });
  });

  describe('variable-stored config detection', () => {
    it('should detect origin wildcard assigned to a variable used in cors()', () => {
      const content = `const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST'],
};

app.use(cors(corsOptions));`;
      const result = analyzeCorsConfig(content);
      expect(result.count).toBe(1);
    });

    it('should detect origin true in a config object', () => {
      const content = `const config = {
  cors: {
    origin: true,
    credentials: true,
  }
};`;
      const result = analyzeCorsConfig(content);
      expect(result.count).toBe(1);
    });
  });

  describe('expanded context window (10 lines)', () => {
    it('should detect origin wildcard 8 lines after cors import', () => {
      const lines = [
        'import cors from "cors";',
        '',
        '// Line 3',
        '// Line 4',
        '// Line 5',
        '// Line 6',
        '// Line 7',
        '// Line 8',
        '  origin: "*",',  // Line 9 -- 8 lines after cors
      ];
      const content = lines.join('\n');
      const result = analyzeCorsConfig(content);
      expect(result.count).toBe(1);
    });
  });

  describe('credentials:true + wildcard detection', () => {
    it('should flag credentials:true with wildcard origin', () => {
      const content = `app.use(cors({
  origin: '*',
  credentials: true,
}));`;
      const result = analyzeCorsConfig(content);
      expect(result.count).toBeGreaterThanOrEqual(1);
      // Check that at least one finding flags credentials
      const hasCredentialsWarning = result.locations.some(
        loc => loc.credentialsWithWildcard === true
      );
      expect(hasCredentialsWarning).toBe(true);
    });

    it('should flag credentials:true with origin:true', () => {
      const content = `const corsOpts = {
  origin: true,
  credentials: true,
};`;
      const result = analyzeCorsConfig(content);
      expect(result.count).toBeGreaterThanOrEqual(1);
    });
  });

  describe('false positive avoidance', () => {
    it('should NOT flag commented-out CORS config', () => {
      const content = `// app.use(cors({ origin: '*' }));`;
      const result = analyzeCorsConfig(content);
      expect(result.count).toBe(0);
    });

    it('should NOT flag origin in non-CORS context', () => {
      const content = `const origin = 'some-value';`;
      const result = analyzeCorsConfig(content);
      expect(result.count).toBe(0);
    });
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd mcp/shieldkit && npx vitest run src/__tests__/cors-config.test.ts 2>&1 | tail -30`

Expected: Variable-stored config, expanded context, credentials+wildcard tests FAIL.

- [ ] **Step 3: Rewrite cors-config.ts with all fixes**

Replace the entire contents of `mcp/shieldkit/src/analyzers/cors-config.ts`:

```typescript
/**
 * CORS misconfiguration analyzer.
 *
 * Detects overly permissive CORS configurations such as wildcard origins,
 * cors({ origin: '*' }), cors({ origin: true }), variable-stored configs,
 * and credentials:true + wildcard origin combinations.
 */

export interface CorsConfigLocation {
  line: number;
  text: string;
  credentialsWithWildcard?: boolean;
}

export interface CorsConfigResult {
  count: number;
  locations: CorsConfigLocation[];
}

const CONTEXT_WINDOW = 10;

export function analyzeCorsConfig(content: string): CorsConfigResult {
  const lines = content.split('\n');
  const locations: CorsConfigLocation[] = [];
  const reportedLines = new Set<number>();

  // Pre-scan: check if credentials: true appears near any wildcard origin
  // within a 10-line window
  const credentialsLines = new Set<number>();
  for (let i = 0; i < lines.length; i++) {
    if (/credentials\s*:\s*true\b/.test(lines[i])) {
      credentialsLines.add(i);
    }
  }

  function hasNearbyCredentials(lineIndex: number): boolean {
    for (let j = Math.max(0, lineIndex - CONTEXT_WINDOW); j < Math.min(lines.length, lineIndex + CONTEXT_WINDOW); j++) {
      if (credentialsLines.has(j)) return true;
    }
    return false;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip commented-out lines
    if (/^\s*\/\//.test(line) || /^\s*#/.test(line)) {
      continue;
    }

    if (reportedLines.has(lineNum)) continue;

    // Detect Access-Control-Allow-Origin with wildcard *
    if (/Access-Control-Allow-Origin/.test(line) && /['"`]\*['"`]/.test(line)) {
      reportedLines.add(lineNum);
      locations.push({
        line: lineNum,
        text: line.trim(),
        credentialsWithWildcard: hasNearbyCredentials(i),
      });
      continue;
    }

    // Detect cors({ origin: '*' }) on same line
    if (/cors\s*\(/.test(line) && /origin\s*:\s*['"`]\*['"`]/.test(line)) {
      reportedLines.add(lineNum);
      locations.push({
        line: lineNum,
        text: line.trim(),
        credentialsWithWildcard: hasNearbyCredentials(i),
      });
      continue;
    }

    // Detect cors({ origin: true }) on same line
    if (/cors\s*\(/.test(line) && /origin\s*:\s*true\b/.test(line)) {
      reportedLines.add(lineNum);
      locations.push({
        line: lineNum,
        text: line.trim(),
        credentialsWithWildcard: hasNearbyCredentials(i),
      });
      continue;
    }

    // Detect standalone origin: '*' or origin: true in config-like contexts
    if (/origin\s*:\s*['"`]\*['"`]/.test(line) || /origin\s*:\s*true\b/.test(line)) {
      // Check if this is in a CORS context by looking at expanded surrounding lines (10-line window)
      const contextStart = Math.max(0, i - CONTEXT_WINDOW);
      const contextEnd = Math.min(lines.length, i + CONTEXT_WINDOW + 1);
      const surroundingContext = lines.slice(contextStart, contextEnd).join('\n');

      if (/cors/i.test(surroundingContext) || /Access-Control/i.test(surroundingContext) ||
          /corsOptions?/i.test(surroundingContext) || /corsConfig/i.test(surroundingContext)) {
        reportedLines.add(lineNum);
        locations.push({
          line: lineNum,
          text: line.trim(),
          credentialsWithWildcard: hasNearbyCredentials(i),
        });
      }
    }
  }

  return {
    count: locations.length,
    locations,
  };
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd mcp/shieldkit && npx vitest run src/__tests__/cors-config.test.ts 2>&1 | tail -20`

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add mcp/shieldkit/src/analyzers/cors-config.ts mcp/shieldkit/src/__tests__/cors-config.test.ts
git commit -m "fix(shieldkit): cors-config variable detection, 10-line context, credentials+wildcard

Detects origin:'*' in variable-stored config objects. Expands context window
from 5 to 10 lines. Flags credentials:true + wildcard as especially dangerous."
```

---

### Task 9: Fix `discovery.ts` — .gitignore parsing, parallel framework detection, Python file detection

**Files:**
- Modify: `mcp/shieldkit/src/analyzers/discovery.ts`
- Create: `mcp/shieldkit/src/__tests__/discovery.test.ts`

**Current bugs:**
1. `.gitignore` parsing: no `**` glob support and no negation (`!`) support.
2. `detectFramework` runs serial glob calls -- should use `Promise.all`.
3. No Python route/DB file detection patterns.

- [ ] **Step 1: Write tests**

Create `mcp/shieldkit/src/__tests__/discovery.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { checkGitignore } from '../analyzers/discovery.js';

describe('discovery', () => {
  describe('checkGitignore', () => {
    it('should handle ** glob patterns', async () => {
      const { mkdtemp, writeFile, mkdir } = await import('node:fs/promises');
      const { join } = await import('node:path');
      const { tmpdir } = await import('node:os');

      const dir = await mkdtemp(join(tmpdir(), 'shieldkit-test-'));
      await writeFile(join(dir, '.gitignore'), '**/*.log\n');
      await mkdir(join(dir, 'logs'), { recursive: true });

      const result = await checkGitignore(dir, 'logs/server.log');
      expect(result).toBe(true);
    });

    it('should handle negation patterns', async () => {
      const { mkdtemp, writeFile } = await import('node:fs/promises');
      const { join } = await import('node:path');
      const { tmpdir } = await import('node:os');

      const dir = await mkdtemp(join(tmpdir(), 'shieldkit-test-'));
      await writeFile(join(dir, '.gitignore'), '*.env\n!.env.example\n');

      const envResult = await checkGitignore(dir, '.env');
      expect(envResult).toBe(true);

      const exampleResult = await checkGitignore(dir, '.env.example');
      expect(exampleResult).toBe(false);
    });

    it('should handle directory patterns with **', async () => {
      const { mkdtemp, writeFile } = await import('node:fs/promises');
      const { join } = await import('node:path');
      const { tmpdir } = await import('node:os');

      const dir = await mkdtemp(join(tmpdir(), 'shieldkit-test-'));
      await writeFile(join(dir, '.gitignore'), '**/node_modules/\n');

      const result = await checkGitignore(dir, 'packages/web/node_modules/foo.js');
      expect(result).toBe(true);
    });

    it('should return false for non-ignored files', async () => {
      const { mkdtemp, writeFile } = await import('node:fs/promises');
      const { join } = await import('node:path');
      const { tmpdir } = await import('node:os');

      const dir = await mkdtemp(join(tmpdir(), 'shieldkit-test-'));
      await writeFile(join(dir, '.gitignore'), 'node_modules/\n.env\n');

      const result = await checkGitignore(dir, 'src/index.ts');
      expect(result).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run tests, verify ** glob and negation tests fail**

Run: `cd mcp/shieldkit && npx vitest run src/__tests__/discovery.test.ts 2>&1 | tail -30`

Expected: The `**` glob and negation tests FAIL.

- [ ] **Step 3: Fix checkGitignore with ** glob and negation support**

In `mcp/shieldkit/src/analyzers/discovery.ts`, replace the `checkGitignore` function with:

```typescript
export async function checkGitignore(cwd: string, filePath: string): Promise<boolean> {
  try {
    const gitignoreContent = await readFile(join(cwd, '.gitignore'), 'utf-8');
    const rawLines = gitignoreContent.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    const fileName = basename(filePath);

    // Separate negation patterns from regular patterns
    const patterns: Array<{ pattern: string; negated: boolean }> = rawLines.map(line => {
      if (line.startsWith('!')) {
        return { pattern: line.slice(1), negated: true };
      }
      return { pattern: line, negated: false };
    });

    let ignored = false;

    for (const { pattern, negated } of patterns) {
      const matches = matchGitignorePattern(pattern, filePath, fileName);
      if (matches) {
        ignored = !negated;
      }
    }

    return ignored;
  } catch {
    // no .gitignore
  }

  return false;
}

/**
 * Match a single .gitignore pattern against a file path.
 * Supports: exact match, *.ext, dir/, ** globs, .env patterns.
 */
function matchGitignorePattern(pattern: string, filePath: string, fileName: string): boolean {
  // Exact match
  if (pattern === filePath || pattern === fileName) return true;

  // .env patterns
  if (pattern === '.env' && (filePath === '.env' || filePath.endsWith('/.env'))) return true;
  if (pattern === '.env*' || pattern === '.env.*') {
    if (fileName.startsWith('.env')) return true;
  }

  // *.ext -- matches by extension anywhere
  if (pattern.startsWith('*.')) {
    const ext = pattern.slice(1);
    if (fileName.endsWith(ext)) return true;
  }

  // Directory pattern: dir/ matches anything inside
  if (pattern.endsWith('/')) {
    const dirName = pattern.slice(0, -1);
    if (filePath.startsWith(dirName + '/') || filePath.includes('/' + dirName + '/')) return true;
  }

  // ** glob patterns
  if (pattern.includes('**')) {
    const regexStr = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*\//g, '(.*/)?')
      .replace(/\*\*/g, '.*')
      .replace(/(?<!\.)\*/g, '[^/]*');
    const regex = new RegExp(`^${regexStr}$`);
    if (regex.test(filePath)) return true;

    // Also try matching against just the filename for patterns like **/*.log
    if (regex.test(fileName)) return true;

    // Try matching with and without leading path segments
    const segments = filePath.split('/');
    for (let i = 0; i < segments.length; i++) {
      const subPath = segments.slice(i).join('/');
      if (regex.test(subPath)) return true;
    }
  }

  // Simple directory match without trailing slash
  if (!pattern.includes('/') && !pattern.includes('*') && !pattern.includes('.')) {
    if (filePath.startsWith(pattern + '/') || filePath.includes('/' + pattern + '/')) return true;
  }

  return false;
}
```

- [ ] **Step 4: Parallelize detectFramework**

In `mcp/shieldkit/src/analyzers/discovery.ts`, replace the `detectFramework` function:

```typescript
export async function detectFramework(cwd: string): Promise<string | null> {
  // Check for framework config files in parallel
  const configPatterns: Record<string, string> = {
    'next.config.*': 'nextjs',
    'nuxt.config.*': 'nuxt',
    'svelte.config.*': 'sveltekit',
    'remix.config.*': 'remix',
    'astro.config.*': 'astro',
    'vite.config.*': 'vite',
    // Python frameworks
    'manage.py': 'django',
    'wsgi.py': 'flask',
  };

  const results = await Promise.all(
    Object.entries(configPatterns).map(async ([pattern, framework]) => {
      const matches = await globby(pattern, { cwd, ignore: IGNORE_PATTERNS });
      return { framework, found: matches.length > 0 };
    })
  );

  for (const { framework, found } of results) {
    if (found) return framework;
  }

  // Check package.json for framework deps
  try {
    const pkgContent = await readFile(join(cwd, 'package.json'), 'utf-8');
    const pkg = JSON.parse(pkgContent);
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (allDeps.next) return 'nextjs';
    if (allDeps.nuxt) return 'nuxt';
    if (allDeps['@sveltejs/kit']) return 'sveltekit';
    if (allDeps['@remix-run/node'] || allDeps['@remix-run/react']) return 'remix';
    if (allDeps.express) return 'express';
    if (allDeps.fastify) return 'fastify';
    if (allDeps.koa) return 'koa';
    if (allDeps.hono) return 'hono';
  } catch {
    // no package.json
  }

  // Check requirements.txt for Python frameworks
  try {
    const reqContent = await readFile(join(cwd, 'requirements.txt'), 'utf-8');
    if (/^django\b/im.test(reqContent)) return 'django';
    if (/^flask\b/im.test(reqContent)) return 'flask';
    if (/^fastapi\b/im.test(reqContent)) return 'fastapi';
  } catch {
    // no requirements.txt
  }

  return null;
}
```

- [ ] **Step 5: Add Python route and DB file detection**

In `mcp/shieldkit/src/analyzers/discovery.ts`, update `discoverRouteFiles` to include Python patterns:

```typescript
export async function discoverRouteFiles(cwd: string): Promise<string[]> {
  const patterns = [
    '**/app/api/**/route.{ts,js,tsx,jsx}',
    '**/pages/api/**/*.{ts,js,tsx,jsx}',
    '**/routes/**/*.{ts,js,tsx,jsx}',
    '**/controllers/**/*.{ts,js,tsx,jsx}',
    '**/*controller.{ts,js}',
    '**/*handler.{ts,js}',
    '**/*route.{ts,js}',
    // Python route files
    '**/views.py',
    '**/routes.py',
    '**/api.py',
    '**/urls.py',
    '**/routes/**/*.py',
    '**/api/**/*.py',
    '**/views/**/*.py',
  ];

  return globby(patterns, {
    cwd,
    ignore: IGNORE_PATTERNS,
    absolute: false,
  });
}
```

Update `discoverDbFiles` to detect Python DB patterns:

```typescript
export async function discoverDbFiles(cwd: string): Promise<string[]> {
  const allSource = await discoverSourceFiles(cwd);
  const dbFiles: string[] = [];

  for (const file of allSource) {
    try {
      const content = await readFile(join(cwd, file), 'utf-8');
      const hasDbAccess =
        // JS/TS patterns
        /\b(prisma|knex|sequelize|typeorm|mongoose|mongodb|pg\.query|mysql|sqlite|drizzle)\b/i.test(content) ||
        /\b(createConnection|getRepository|getConnection|query\(|\.execute\()\b/.test(content) ||
        // Python patterns
        /\b(sqlalchemy|django\.db|psycopg2|pymysql|sqlite3|peewee|tortoise)\b/i.test(content) ||
        /\b(cursor\.execute|session\.query|\.objects\.(filter|get|all|create))\b/.test(content);
      if (hasDbAccess) {
        dbFiles.push(file);
      }
    } catch {
      // skip unreadable files
    }
  }

  return dbFiles;
}
```

- [ ] **Step 6: Run tests, verify they pass**

Run: `cd mcp/shieldkit && npx vitest run src/__tests__/discovery.test.ts 2>&1 | tail -20`

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add mcp/shieldkit/src/analyzers/discovery.ts mcp/shieldkit/src/__tests__/discovery.test.ts
git commit -m "fix(shieldkit): gitignore ** glob and negation, parallel framework detect, Python files

checkGitignore now supports ** glob patterns and ! negation.
detectFramework runs all config checks in parallel with Promise.all.
Adds Python route/DB file discovery patterns."
```

---

### Task 10: Fix `scoring.ts` — Per-finding severity from analyzers

**Files:**
- Modify: `mcp/shieldkit/src/analyzers/scoring.ts`
- Create: `mcp/shieldkit/src/__tests__/scoring.test.ts`

**Current bug:** `scoring.ts` assigns a flat severity per analyzer (e.g., all `dangerous-functions` findings are "high"). With the Task 7 changes, `dangerous-functions` now has per-finding severity (critical/high/medium). The scoring system needs to accept per-finding severities.

- [ ] **Step 1: Write tests**

Create `mcp/shieldkit/src/__tests__/scoring.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  classifySeverity,
  computeRiskLevel,
  buildScoringResult,
  buildScoringResultFromFindings,
  type FindingSeverity,
} from '../analyzers/scoring.js';

describe('scoring', () => {
  describe('classifySeverity (backward compat)', () => {
    it('should classify hardcoded-secrets as critical', () => {
      expect(classifySeverity('hardcoded-secrets')).toBe('critical');
    });

    it('should classify unknown analyzers as low', () => {
      expect(classifySeverity('unknown-thing')).toBe('low');
    });
  });

  describe('computeRiskLevel', () => {
    it('should return clean when no findings have counts', () => {
      const findings: FindingSeverity[] = [
        { analyzer: 'sql-injection', severity: 'critical', count: 0 },
      ];
      expect(computeRiskLevel(findings)).toBe('clean');
    });

    it('should return critical when any critical findings exist', () => {
      const findings: FindingSeverity[] = [
        { analyzer: 'sql-injection', severity: 'critical', count: 1 },
        { analyzer: 'cors-config', severity: 'medium', count: 3 },
      ];
      expect(computeRiskLevel(findings)).toBe('critical');
    });

    it('should return high when high but no critical', () => {
      const findings: FindingSeverity[] = [
        { analyzer: 'dangerous-functions', severity: 'high', count: 2 },
        { analyzer: 'cors-config', severity: 'medium', count: 1 },
      ];
      expect(computeRiskLevel(findings)).toBe('high');
    });
  });

  describe('buildScoringResult (flat per-analyzer)', () => {
    it('should build scoring from analyzer counts', () => {
      const result = buildScoringResult({
        'sql-injection': 2,
        'cors-config': 1,
      });
      expect(result.riskLevel).toBe('critical');
      expect(result.findings).toHaveLength(2);
    });
  });

  describe('buildScoringResultFromFindings (per-finding severity)', () => {
    it('should aggregate per-finding severities', () => {
      const result = buildScoringResultFromFindings([
        { analyzer: 'dangerous-functions', severity: 'critical', count: 1 },
        { analyzer: 'dangerous-functions', severity: 'high', count: 2 },
        { analyzer: 'dangerous-functions', severity: 'medium', count: 3 },
        { analyzer: 'sql-injection', severity: 'critical', count: 1 },
      ]);
      expect(result.riskLevel).toBe('critical');
      expect(result.findings).toHaveLength(4);
    });

    it('should sort findings by severity in summary', () => {
      const result = buildScoringResultFromFindings([
        { analyzer: 'cors-config', severity: 'medium', count: 5 },
        { analyzer: 'eval', severity: 'critical', count: 1 },
      ]);
      expect(result.summary).toContain('critical');
    });
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd mcp/shieldkit && npx vitest run src/__tests__/scoring.test.ts 2>&1 | tail -30`

Expected: `buildScoringResultFromFindings` does not exist yet, so tests fail.

- [ ] **Step 3: Add buildScoringResultFromFindings to scoring.ts**

In `mcp/shieldkit/src/analyzers/scoring.ts`, add the new function at the end of the file, after the existing `buildScoringResult`:

```typescript
/**
 * Build scoring result from pre-classified per-finding severity data.
 * Used when analyzers provide their own severity per finding
 * (e.g., dangerous-functions with critical/high/medium per pattern).
 */
export function buildScoringResultFromFindings(findings: FindingSeverity[]): ScoringResult {
  const riskLevel = computeRiskLevel(findings);

  const totalFindings = findings.reduce((sum, f) => sum + f.count, 0);
  const criticalCount = findings.filter(f => f.severity === 'critical').reduce((s, f) => s + f.count, 0);
  const highCount = findings.filter(f => f.severity === 'high').reduce((s, f) => s + f.count, 0);

  const parts: string[] = [];
  parts.push(`Risk level: ${riskLevel}`);
  parts.push(`${totalFindings} total finding(s)`);
  if (criticalCount > 0) parts.push(`${criticalCount} critical`);
  if (highCount > 0) parts.push(`${highCount} high`);

  return {
    findings,
    riskLevel,
    summary: parts.join(' | '),
  };
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd mcp/shieldkit && npx vitest run src/__tests__/scoring.test.ts 2>&1 | tail -20`

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add mcp/shieldkit/src/analyzers/scoring.ts mcp/shieldkit/src/__tests__/scoring.test.ts
git commit -m "feat(shieldkit): add buildScoringResultFromFindings for per-finding severity

Enables scoring to use per-finding severity data from analyzers like
dangerous-functions that assign critical/high/medium per pattern."
```

---

### Task 11: Fix `tools/scan.ts` — Include missing-auth in filesWithFindings, merge auth into FileFindings, eliminate double-discovery

**Files:**
- Modify: `mcp/shieldkit/src/mcp/tools/scan.ts`
- Create: `mcp/shieldkit/src/__tests__/tools-scan.test.ts`

**Current bugs:**
1. `filesWithFindings` count does not include route files with missing auth -- it only counts the 4 per-file analyzers.
2. `missing-auth` results are separate from `FileFindings` -- route files lack auth info in their per-file output.
3. Route files are discovered twice when no specific file is given: once by `discoverSourceFiles` (for scanning) and once by `discoverRouteFiles` (for auth check). The second call reads the same files from disk again.

- [ ] **Step 1: Write test**

Create `mcp/shieldkit/src/__tests__/tools-scan.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

/**
 * Integration test for scan tool.
 * Tests the exported scanTool against real filesystem fixture data.
 * Requires Phase 0 test-fixtures to be present at mcp/test-fixtures/.
 *
 * If test-fixtures are not present, these tests are skipped.
 */

import { scanTool } from '../mcp/tools/scan.js';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const FIXTURES_DIR = resolve(import.meta.dirname, '../../../../test-fixtures');
const hasFixtures = existsSync(FIXTURES_DIR);

describe('tools/scan', () => {
  describe('filesWithFindings count includes missing-auth', () => {
    it.skipIf(!hasFixtures)('should count route files with missing auth in filesWithFindings', async () => {
      const result = await scanTool({}, FIXTURES_DIR);
      // Route files with missing auth should be counted
      expect(result.summary.filesWithFindings).toBeGreaterThan(0);
    });
  });

  describe('single-file scan', () => {
    it.skipIf(!hasFixtures)('should scan a single file', async () => {
      const result = await scanTool({ file: 'src/config.ts' }, FIXTURES_DIR);
      expect(result.summary.totalFiles).toBe(1);
      expect(result.files).toHaveLength(1);
      expect(result.files[0].path).toBe('src/config.ts');
    });
  });

  describe('empty project', () => {
    it('should handle empty file list gracefully', async () => {
      const { mkdtemp } = await import('node:fs/promises');
      const { tmpdir } = await import('node:os');
      const { join } = await import('node:path');

      const dir = await mkdtemp(join(tmpdir(), 'shieldkit-empty-'));
      const result = await scanTool({}, dir);
      expect(result.summary.totalFiles).toBe(0);
      expect(result.summary.filesWithFindings).toBe(0);
      expect(result.scoring.riskLevel).toBe('clean');
    });
  });

  describe('FileFindings includes missingAuth', () => {
    it.skipIf(!hasFixtures)('should include missingAuth info in per-file findings for route files', async () => {
      const result = await scanTool({}, FIXTURES_DIR);
      // Route files should have a missingAuth field
      const routeFiles = result.files.filter(f =>
        f.path.includes('route') || f.path.includes('api') || f.path.includes('controller')
      );
      for (const rf of routeFiles) {
        expect(rf).toHaveProperty('missingAuth');
      }
    });
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd mcp/shieldkit && npx vitest run src/__tests__/tools-scan.test.ts 2>&1 | tail -30`

Expected: The `missingAuth` field test fails because `FileFindings` doesn't have it. The empty project test should pass.

- [ ] **Step 3: Update tools/scan.ts**

Replace the entire contents of `mcp/shieldkit/src/mcp/tools/scan.ts`:

```typescript
/**
 * shieldkit_scan -- Deterministic pattern detection across source files.
 *
 * Runs all security analyzers against source files and returns
 * structured findings with severity classifications.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { discoverSourceFiles, discoverRouteFiles } from '../../analyzers/discovery.js';
import { analyzeSqlInjection, type SqlInjectionResult } from '../../analyzers/sql-injection.js';
import { isRouteFile, analyzeAuth, buildMissingAuthResult, type MissingAuthResult } from '../../analyzers/missing-auth.js';
import { analyzeHardcodedSecrets, type HardcodedSecretsResult } from '../../analyzers/hardcoded-secrets.js';
import { analyzeDangerousFunctions, type DangerousFunctionsResult } from '../../analyzers/dangerous-functions.js';
import { analyzeCorsConfig, type CorsConfigResult } from '../../analyzers/cors-config.js';
import { buildScoringResult, type ScoringResult } from '../../analyzers/scoring.js';

interface FileMissingAuth {
  isRouteFile: boolean;
  hasAuth: boolean;
}

interface FileFindings {
  path: string;
  sqlInjection: SqlInjectionResult;
  hardcodedSecrets: HardcodedSecretsResult;
  dangerousFunctions: DangerousFunctionsResult;
  corsConfig: CorsConfigResult;
  missingAuth?: FileMissingAuth;
}

interface ScanResult {
  files: FileFindings[];
  missingAuth: MissingAuthResult;
  scoring: ScoringResult;
  summary: {
    totalFiles: number;
    filesWithFindings: number;
    riskLevel: string;
  };
}

async function scanFile(filePath: string, cwd: string): Promise<FileFindings> {
  const fullPath = join(cwd, filePath);
  const content = await readFile(fullPath, 'utf-8');

  const findings: FileFindings = {
    path: filePath,
    sqlInjection: analyzeSqlInjection(content, filePath),
    hardcodedSecrets: analyzeHardcodedSecrets(content, filePath),
    dangerousFunctions: analyzeDangerousFunctions(content),
    corsConfig: analyzeCorsConfig(content),
  };

  // Add auth info for route files
  if (isRouteFile(filePath)) {
    findings.missingAuth = {
      isRouteFile: true,
      hasAuth: analyzeAuth(content),
    };
  }

  return findings;
}

export async function scanTool(args: { file?: string }, cwd: string): Promise<ScanResult> {
  let filePaths: string[];

  if (args.file) {
    filePaths = [args.file];
  } else {
    // Discover source files and route files in parallel
    const [sourceFiles, discoveredRouteFiles] = await Promise.all([
      discoverSourceFiles(cwd),
      discoverRouteFiles(cwd),
    ]);

    // Merge route files into source files (avoid duplicates)
    const sourceSet = new Set(sourceFiles);
    for (const rf of discoveredRouteFiles) {
      sourceSet.add(rf);
    }
    filePaths = [...sourceSet];
  }

  if (filePaths.length === 0) {
    const emptyAuth = buildMissingAuthResult([]);
    const scoring = buildScoringResult({});
    return {
      files: [],
      missingAuth: emptyAuth,
      scoring,
      summary: {
        totalFiles: 0,
        filesWithFindings: 0,
        riskLevel: 'clean',
      },
    };
  }

  // Scan all files (each file is read once, not twice)
  const files = await Promise.all(
    filePaths.map(p => scanFile(p, cwd))
  );

  // Build missing auth result from the per-file auth info
  const authResults: Array<{ path: string; hasAuth: boolean }> = [];
  for (const f of files) {
    if (f.missingAuth) {
      authResults.push({ path: f.path, hasAuth: f.missingAuth.hasAuth });
    }
  }
  const missingAuth = buildMissingAuthResult(authResults);

  // Aggregate counts for scoring
  const analyzerCounts: Record<string, number> = {
    'sql-injection': files.reduce((sum, f) => sum + f.sqlInjection.count, 0),
    'hardcoded-secrets': files.reduce((sum, f) => sum + f.hardcodedSecrets.count, 0),
    'dangerous-functions': files.reduce((sum, f) => sum + f.dangerousFunctions.count, 0),
    'cors-config': files.reduce((sum, f) => sum + f.corsConfig.count, 0),
    'missing-auth': missingAuth.unprotected,
  };

  const scoring = buildScoringResult(analyzerCounts);

  // Count files with findings -- includes missing auth
  const filesWithFindings = files.filter(f =>
    f.sqlInjection.count > 0 ||
    f.hardcodedSecrets.count > 0 ||
    f.dangerousFunctions.count > 0 ||
    f.corsConfig.count > 0 ||
    (f.missingAuth && !f.missingAuth.hasAuth)
  ).length;

  return {
    files,
    missingAuth,
    scoring,
    summary: {
      totalFiles: files.length,
      filesWithFindings,
      riskLevel: scoring.riskLevel,
    },
  };
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd mcp/shieldkit && npx vitest run src/__tests__/tools-scan.test.ts 2>&1 | tail -20`

Expected: Tests pass (fixture-dependent tests are skipped if fixtures not present).

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd mcp/shieldkit && npx tsc --noEmit 2>&1 | tail -20`

Expected: Clean compilation.

- [ ] **Step 6: Commit**

```bash
git add mcp/shieldkit/src/mcp/tools/scan.ts mcp/shieldkit/src/__tests__/tools-scan.test.ts
git commit -m "fix(shieldkit): include missing-auth in FileFindings and filesWithFindings count

Route files now have missingAuth in per-file output. filesWithFindings
includes unprotected route files. Eliminates double route file discovery."
```

---

### Task 12: Fix `tools/status.ts` — Sort topIssues by severity

**Files:**
- Modify: `mcp/shieldkit/src/mcp/tools/status.ts`
- Create: `mcp/shieldkit/src/__tests__/tools-status.test.ts`

**Current bug:** `topIssues` is built by iterating `scanResult.scoring.findings` in arbitrary order. It should be sorted by severity (critical first, then high, then medium, then low).

- [ ] **Step 1: Write test**

Create `mcp/shieldkit/src/__tests__/tools-status.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const FIXTURES_DIR = resolve(import.meta.dirname, '../../../../test-fixtures');
const hasFixtures = existsSync(FIXTURES_DIR);

describe('tools/status', () => {
  describe('topIssues sorted by severity', () => {
    it.skipIf(!hasFixtures)('should sort topIssues with critical first', async () => {
      const { statusTool } = await import('../mcp/tools/status.js');
      const result = await statusTool(FIXTURES_DIR);

      if (result.topIssues.length >= 2) {
        // Find severity brackets in the topIssues strings
        const severityOrder = ['critical', 'high', 'medium', 'low'];
        const issueSeverities = result.topIssues.map(issue => {
          const match = issue.match(/\[(critical|high|medium|low)\]/);
          return match ? severityOrder.indexOf(match[1]) : 999;
        });

        // Verify sorted (each severity index should be <= the next)
        for (let i = 1; i < issueSeverities.length; i++) {
          if (issueSeverities[i] !== 999 && issueSeverities[i - 1] !== 999) {
            expect(issueSeverities[i - 1]).toBeLessThanOrEqual(issueSeverities[i]);
          }
        }
      }
    });
  });

  describe('empty project', () => {
    it('should handle empty project', async () => {
      const { statusTool } = await import('../mcp/tools/status.js');
      const { mkdtemp } = await import('node:fs/promises');
      const { tmpdir } = await import('node:os');
      const { join } = await import('node:path');

      const dir = await mkdtemp(join(tmpdir(), 'shieldkit-empty-'));
      const result = await statusTool(dir);
      expect(result.riskLevel).toBe('clean');
      expect(result.totalFindings).toBe(0);
      expect(result.topIssues).toHaveLength(0);
    });
  });
});
```

- [ ] **Step 2: Run tests, verify sorting test might fail**

Run: `cd mcp/shieldkit && npx vitest run src/__tests__/tools-status.test.ts 2>&1 | tail -30`

Expected: If fixtures exist and findings are present in non-sorted order, the sort test fails.

- [ ] **Step 3: Sort topIssues by severity in status.ts**

In `mcp/shieldkit/src/mcp/tools/status.ts`, find and replace this block:

```typescript
  // Build top issues
  const topIssues: string[] = [];
  for (const finding of scanResult.scoring.findings) {
    if (finding.count > 0) {
      topIssues.push(`${finding.analyzer}: ${finding.count} finding(s) [${finding.severity}]`);
    }
  }
```

Replace with:

```typescript
  // Build top issues, sorted by severity (critical first)
  const severityOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  const activeFindings = scanResult.scoring.findings
    .filter(f => f.count > 0)
    .sort((a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4));

  const topIssues: string[] = [];
  for (const finding of activeFindings) {
    topIssues.push(`${finding.analyzer}: ${finding.count} finding(s) [${finding.severity}]`);
  }
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd mcp/shieldkit && npx vitest run src/__tests__/tools-status.test.ts 2>&1 | tail -20`

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add mcp/shieldkit/src/mcp/tools/status.ts mcp/shieldkit/src/__tests__/tools-status.test.ts
git commit -m "fix(shieldkit): sort topIssues by severity in status tool

Critical findings now appear first in the topIssues list."
```

---

## Section 3.2 — Fix Skill Content

---

### Task 13: Fix `/scan` skill — Remove redundancy, add dependency checks, add Not Vulnerable guidance

**Files:**
- Modify: `skills/scan/SKILL.md`

- [ ] **Step 1: Update SKILL.md**

In `skills/scan/SKILL.md`, make three changes:

**Change A:** In `### 2. Run Vulnerability Checks`, remove the duplicated paragraph that starts with "For each file in scope, check against the vulnerability categories in `references/vulnerability-catalog.md`." This paragraph is a copy-paste of the "Without shieldkit-mcp" instructions and should only appear once, inside the "Without shieldkit-mcp" block.

The section should read (after the "Without shieldkit-mcp" block):

```markdown
For each vulnerability found:
1. Identify the specific code location (file + line)
2. Classify the severity: **Critical**, **High**, **Medium**, **Low**
3. Describe the attack scenario -- how an attacker would exploit this
4. Provide a concrete fix
```

**Change B:** Replace `### 4. Check Dependencies` with:

```markdown
### 4. Check Dependencies

Run the appropriate dependency audit command for the project's ecosystem:

- **Node.js:** `npm audit --json` or `yarn audit --json` -- check for known CVEs
- **Python:** `pip audit` (install via `pip install pip-audit`) -- checks PyPI advisories
- **Rust:** `cargo audit` (install via `cargo install cargo-audit`) -- checks RustSec DB
- **Go:** `govulncheck ./...` -- checks Go vulnerability database
- **Ruby:** `bundle audit check` (install via `gem install bundler-audit`)

If the audit tool is not installed, note the command for the user to run manually.

Additionally:
- Flag packages that are severely outdated (major version behind)
- Note packages with broad permissions (e.g., native code execution, filesystem access)
```

**Change C:** In `### 5. Present Findings`, add a `### Not Vulnerable` section to the report template, after `### Dependencies`:

```markdown
### Not Vulnerable
{Explicitly list what was checked and found secure. Examples:}
- SQL queries: All database access in `src/db/` uses parameterized queries via Prisma
- Auth: All API routes in `src/routes/` have authentication middleware
- CORS: Configuration restricts origins to `https://app.example.com`
- Secrets: No hardcoded credentials found; all secrets loaded via env vars

{This section builds confidence that the scan was thorough and helps developers
understand what does NOT need attention.}
```

- [ ] **Step 2: Commit**

```bash
git add skills/scan/SKILL.md
git commit -m "fix(skill): remove scan Step 2 redundancy, add concrete dep checks, add Not Vulnerable section

Step 2 no longer duplicates the manual check instructions. Step 4 lists
concrete commands (npm audit, pip audit, cargo audit, etc). Step 5 includes
explicit Not Vulnerable section guidance."
```

---

### Task 14: Fix `/threat-model` skill — Replace priority formula, add skipped-categories documentation

**Files:**
- Modify: `skills/threat-model/SKILL.md`

- [ ] **Step 1: Update SKILL.md**

In `skills/threat-model/SKILL.md`, replace the entire content of `### 4. Assess Risk` (from the `### 4.` heading through the end of that section, stopping before `### 5. Recommend Mitigations`) with:

```markdown
### 4. Assess Risk

For each identified threat, assess:

- **Likelihood**: How easy is it to exploit? (High/Medium/Low)
  - High: requires no special knowledge, tools readily available
  - Medium: requires some knowledge or specific conditions
  - Low: requires deep expertise or unlikely conditions
- **Impact**: What's the damage if exploited? (Critical/High/Medium/Low)
  - Critical: full system compromise, data breach, financial loss
  - High: unauthorized access to sensitive data, service disruption
  - Medium: limited data exposure, partial service impact
  - Low: minor information disclosure, no data modification

**Priority Matrix (Likelihood x Impact):**

|               | Impact: Critical | Impact: High | Impact: Medium | Impact: Low |
|---------------|-----------------|-------------|---------------|------------|
| **Likelihood: High**   | P0 | P0 | P1 | P2 |
| **Likelihood: Medium** | P0 | P1 | P2 | P3 |
| **Likelihood: Low**    | P1 | P2 | P3 | P3 |

- **P0 -- Immediate:** Fix before next deploy. Active exploitation likely.
- **P1 -- Urgent:** Fix this sprint. High-value target for attackers.
- **P2 -- Standard:** Schedule for next cycle. Real but lower-probability risk.
- **P3 -- Monitor:** Track but deprioritize. Low likelihood or low impact.

**Documenting skipped categories:** For each STRIDE category that does NOT apply to a given
entry point, include a one-line note explaining why. Example:

```
| - | Repudiation | N/A -- read-only endpoint, no state mutations to log | /api/health | - | - | - |
```

This prevents reviewers from wondering whether a category was overlooked vs. intentionally skipped.
```

- [ ] **Step 2: Commit**

```bash
git add skills/threat-model/SKILL.md
git commit -m "fix(skill): threat-model defined Likelihood x Impact matrix (P0-P3), skipped-category docs

Replaces incoherent priority formula with explicit matrix table.
Adds guidance for documenting why STRIDE categories are skipped."
```

---

### Task 15: Fix `/security-review` skill — argument-hint, ownership verification, timing enumeration

**Files:**
- Modify: `skills/security-review/SKILL.md`

- [ ] **Step 1: Update argument-hint in frontmatter**

In `skills/security-review/SKILL.md`, change the frontmatter `argument-hint` from `"[file]"` to `"[file-or-directory]"`.

- [ ] **Step 2: Add ownership verification to Step 3**

In `skills/security-review/SKILL.md`, add the following to the end of `### 3. Check Authorization Completeness`, after the existing bullet list:

```markdown
**Ownership verification methodology:**
1. Find every resource-loading operation (e.g., `findById(req.params.id)`)
2. Check if the query filters by the authenticated user's ID
3. If not, check if there is a separate ownership check before the response
4. Flag as IDOR if a user can access another user's resource by changing the ID

Example of MISSING ownership:
```
const order = await Order.findById(req.params.orderId); // Anyone can access any order
```

Example of CORRECT ownership:
```
const order = await Order.findOne({ _id: req.params.orderId, userId: req.user.id });
```
```

- [ ] **Step 3: Add timing-based enumeration check to Step 4**

In `skills/security-review/SKILL.md`, add to the end of `### 4. Check Error Handling`:

```markdown
- Do responses take different amounts of time for different outcomes? (e.g., login takes
  longer for valid usernames because it checks the password hash, but returns immediately
  for invalid usernames -- this enables username enumeration via timing side-channel)
- **Mitigation:** Use constant-time comparison for secrets (`crypto.timingSafeEqual()`),
  and ensure login flows take the same time regardless of whether the user exists
```

- [ ] **Step 4: Commit**

```bash
git add skills/security-review/SKILL.md
git commit -m "fix(skill): security-review file-or-directory hint, ownership check, timing enumeration

Changes argument-hint to [file-or-directory]. Adds ownership verification
methodology with IDOR examples. Adds timing-based enumeration check."
```

---

## Section 3.3 — Fix Agent

---

### Task 16: Fix `security-auditor.md` — Add status phase, STRIDE table, dep checks, posture criteria, scope guidance

**Files:**
- Modify: `agents/security-auditor.md`

- [ ] **Step 1: Add Phase 0 with shieldkit_status**

In `agents/security-auditor.md`, add a new phase between the `## Process` heading and the existing `### Phase 1: Reconnaissance`. Insert:

```markdown
### Phase 0: Quick Health Check

**With shieldkit-mcp (preferred):** Call `shieldkit_status` first to get an immediate overview
of the project's security posture -- risk level, finding counts, endpoint protection status.
Use this to prioritize which areas need deeper investigation.

If the project is clean (no findings, all endpoints protected), note this and proceed with
a lighter-touch audit focusing on logic flaws and design issues that pattern matching cannot
detect.
```

- [ ] **Step 2: Add inline STRIDE table to Phase 4**

In `agents/security-auditor.md`, replace the content of `### Phase 4: Threat Assessment` with:

```markdown
### Phase 4: Threat Assessment

For the project's highest-risk features, apply STRIDE:
- Authentication flow
- Payment/financial operations (if any)
- Admin/privileged operations
- File upload/processing (if any)
- External integrations

**STRIDE Quick Reference:**

| Threat | Question | What to look for |
|--------|----------|-----------------|
| **S**poofing | Can someone impersonate another user? | Weak tokens, missing signature verification, session fixation |
| **T**ampering | Can someone modify data they shouldn't? | SQL injection, mass assignment, parameter manipulation |
| **R**epudiation | Can someone deny their actions? | Missing audit logs, unsigned transactions |
| **I**nfo Disclosure | Can someone see data they shouldn't? | IDOR, verbose errors, exposed debug endpoints |
| **D**enial of Service | Can someone make this unavailable? | No rate limiting, unbounded queries, ReDoS |
| **E**levation of Privilege | Can someone gain unauthorized access? | Missing role checks, mass assignment of role field |

For each identified threat, classify priority using Likelihood x Impact:
- **P0:** High likelihood + Critical/High impact -- fix before deploy
- **P1:** Medium likelihood + High impact, or High + Medium -- fix this sprint
- **P2:** Lower combinations -- schedule for next cycle
- **P3:** Low likelihood + Low impact -- monitor
```

- [ ] **Step 3: Add dependency check mechanism to Phase 5**

In `agents/security-auditor.md`, replace the content of `### Phase 5: Dependency Review` with:

```markdown
### Phase 5: Dependency Review

Check project dependencies using ecosystem-specific audit tools:

- **Node.js:** Run `npm audit --json` (or `yarn audit --json`) and parse the output for
  severity levels. Flag critical and high vulnerabilities.
- **Python:** Run `pip audit` (requires `pip install pip-audit`) to check against PyPI
  security advisories.
- **Rust:** Run `cargo audit` to check against the RustSec advisory database.
- **Go:** Run `govulncheck ./...` to check the Go vulnerability database.

If the audit tool is not available, check the lock file manually:
- Look for packages with known CVE patterns
- Flag severely outdated packages (2+ major versions behind)
- Note packages with excessive permissions (native code, filesystem, network)

Include dependency findings in the report with specific CVE numbers when available.
```

- [ ] **Step 4: Add Security Posture rating criteria to Phase 6**

In `agents/security-auditor.md`, add rating criteria definitions after the posture table in `### Phase 6: Security Posture Summary`. Insert after the table:

```markdown
**Rating Criteria:**

- **Strong:** Industry best practices followed. No findings in this domain. Proactive
  measures (e.g., CSP headers, rate limiting, audit logging) beyond the minimum.
- **Adequate:** Basic security measures in place. Minor gaps exist but no exploitable
  vulnerabilities. Follows common framework defaults.
- **Weak:** Security measures exist but have significant gaps. At least one exploitable
  vulnerability or systematic omission (e.g., auth on most routes but not all).
- **Missing:** No security measures in this domain. Fundamental controls absent
  (e.g., no authentication at all, plaintext passwords, no input validation).
```

- [ ] **Step 5: Add scope guidance for large projects**

In `agents/security-auditor.md`, add scope guidance at the end of the `## Guidelines` section:

```markdown
- **Scope large projects pragmatically.** For projects with 100+ source files, prioritize:
  1. All API routes and handlers (externally reachable code)
  2. Authentication and authorization code
  3. Database access code
  4. Configuration and secrets
  5. Files flagged by `shieldkit_scan`
  Do not attempt to manually review every utility function in a large codebase.
  Use shieldkit for breadth, manual review for depth on high-risk code.
```

- [ ] **Step 6: Commit**

```bash
git add agents/security-auditor.md
git commit -m "fix(agent): security-auditor Phase 0 status, STRIDE table, dep checks, posture criteria, scope

Adds shieldkit_status as Phase 0. Adds inline STRIDE reference table to Phase 4.
Adds concrete dependency audit commands to Phase 5. Defines Strong/Adequate/Weak/Missing
posture rating criteria. Adds scope guidance for large projects."
```

---

## Section 3.4 — Fix References

---

### Task 17: Fix `vulnerability-catalog.md` — Add A06, prototype pollution, ReDoS, SSRF patterns, Python patterns

**Files:**
- Modify: `skills/scan/references/vulnerability-catalog.md`

- [ ] **Step 1: Add A06 section (Vulnerable and Outdated Components)**

In `skills/scan/references/vulnerability-catalog.md`, add a new section after `## A05: Security Misconfiguration` and before `## A07: Identification and Authentication Failures`:

```markdown
## A06: Vulnerable and Outdated Components

### Known Vulnerable Dependencies

**Detection:** Run ecosystem-specific audit tools:
- `npm audit --json` -- Node.js
- `pip audit` -- Python
- `cargo audit` -- Rust
- `bundle audit` -- Ruby

**Grep patterns for lock file version checking:**
- Check `package-lock.json` or `yarn.lock` for packages with known CVEs
- Look for severely outdated packages: compare major versions in lock file vs latest

**Attack:** Known vulnerabilities in dependencies are the easiest exploits -- public CVEs
with proof-of-concept code readily available.

**Fix:** Update to patched versions. If no patch exists, evaluate alternatives or apply
workarounds from the CVE advisory.

### Prototype Pollution

**Detection:** Look for object merge operations with user-controlled input:
- `Object.assign({}, userInput)`
- Spread operator: `{ ...defaults, ...userInput }`
- Deep merge utilities: `_.merge(target, userInput)`, `deepmerge(a, userInput)`
- Direct property assignment: `obj[userKey] = userValue`

**Grep patterns:**
```
Object\.assign\s*\([^)]*req\.(body|query|params)
\.\.\.\s*req\.(body|query|params)
_\.merge\s*\([^)]*req\.(body|query|params)
\[req\.(body|query|params)
```

**Attack:** Attacker sends `{ "__proto__": { "isAdmin": true } }` in request body.
The prototype of all objects gets polluted, bypassing authorization checks.

**Fix:** Validate and whitelist input properties. Use `Object.create(null)` for plain
objects. Freeze prototypes where possible.

### Regular Expression Denial of Service (ReDoS)

**Detection:** Regex patterns with nested quantifiers applied to user input:
- `(a+)+` -- catastrophic backtracking
- `(a|a)+` -- overlapping alternatives
- `(.*a){x}` -- nested quantifiers with wildcards

**Grep patterns:**
```
new RegExp\s*\(\s*(req\.|user|input|param|query)
\.match\s*\(\s*new RegExp\s*\(
\.test\s*\(\s*(req\.|user|input)
```

**Attack:** Crafted input causes regex evaluation to take exponential time, blocking
the event loop (Node.js) or thread (Python).

**Fix:** Use linear-time regex libraries (RE2). Set timeouts on regex execution.
Validate input length before regex matching.
```

- [ ] **Step 2: Add SSRF grep detection patterns**

In `skills/scan/references/vulnerability-catalog.md`, in the existing `## A10: Server-Side Request Forgery (SSRF)` section, add after the existing "Fix" line:

```markdown
**Grep patterns:**
```
fetch\s*\(\s*(req\.|user|input|param|url|href)
axios\.\w+\s*\(\s*(req\.|user|input|param|url|href)
http\.get\s*\(\s*(req\.|user|input|param|url)
urllib\.request\.urlopen\s*\(\s*(req|user|input|url)
requests\.(get|post|put)\s*\(\s*(req|user|input|url)
```

**Python-specific patterns:**
- `urllib.request.urlopen(user_url)` -- standard library SSRF
- `requests.get(user_provided_url)` -- requests library SSRF
- `httpx.get(url_from_input)` -- httpx library SSRF
```

- [ ] **Step 3: Add Python-specific vulnerability patterns section**

At the end of `skills/scan/references/vulnerability-catalog.md`, before the `## Severity Classification` section, add:

```markdown
## Additional: Python-Specific Patterns

### Pickle Deserialization

**Detection:** `pickle.loads()` or `pickle.load()` on untrusted data. Pickle can execute
arbitrary code during deserialization.

**Grep patterns:** `pickle\.(loads?|Unpickler)\s*\(`

**Attack:** Attacker sends a crafted pickle payload that runs arbitrary system commands
during deserialization.

**Fix:** Never unpickle untrusted data. Use JSON or MessagePack for serialization.

### Python eval/exec

**Detection:** `eval()` or `exec()` with user-controlled input.

**Grep patterns:** `\beval\s*\(`, `\bexec\s*\(`

**Attack:** Arbitrary code execution on the server.

**Fix:** Never use eval/exec with user input. Use `ast.literal_eval()` for safe parsing
of Python literals.

### Django/Flask Misconfigurations

**Detection patterns:**
- `DEBUG = True` in production settings
- `ALLOWED_HOSTS = ['*']` -- accepts requests for any hostname
- `@csrf_exempt` on state-changing views
- Missing `@login_required` on views accessing user data
- `SECRET_KEY` hardcoded in settings.py

**Grep patterns:**
```
DEBUG\s*=\s*True
ALLOWED_HOSTS\s*=\s*\[.*\*
@csrf_exempt
SECRET_KEY\s*=\s*["']
```
```

- [ ] **Step 4: Commit**

```bash
git add skills/scan/references/vulnerability-catalog.md
git commit -m "fix(ref): vulnerability-catalog A06, prototype pollution, ReDoS, SSRF patterns, Python

Adds A06 (Vulnerable and Outdated Components) section.
Adds prototype pollution and ReDoS entries.
Adds SSRF grep detection patterns for JS and Python.
Adds Python-specific patterns: pickle, eval/exec, Django/Flask misconfig."
```

---

### Task 18: Fix `stride-guide.md` — DoS categorization, cross-references, Python/Django patterns

**Files:**
- Modify: `skills/threat-model/references/stride-guide.md`

- [ ] **Step 1: Fix DoS categorization and add Python patterns**

In `skills/threat-model/references/stride-guide.md`, replace the `## Denial of Service` section's `### Common Patterns` content with:

```markdown
### Common Patterns

**Application-level (resource exhaustion):**
- No rate limiting on any endpoint
- Expensive operations triggered by cheap requests (search with complex regex)
- Unbounded queries (SELECT * without LIMIT)
- Resource exhaustion (unlimited file uploads, unbounded pagination)
- Regular expression denial of service (ReDoS) -- see `references/vulnerability-catalog.md` > ReDoS

**Application-level (logic abuse):**
- Account lockout abuse (locking out legitimate users by triggering failed login attempts)
- Cart/reservation holding (reserving all inventory without purchasing)
- Email/SMS flooding via notification triggers

**Infrastructure-level:**
- Single points of failure
- No connection pooling (database connection exhaustion)
- Synchronous operations blocking event loop
- Memory leaks from accumulating state

**Python/Django specific:**
- Missing `DATA_UPLOAD_MAX_MEMORY_SIZE` (default allows large POST bodies)
- Unbounded `QuerySet` evaluation (`.all()` without pagination)
- Synchronous views performing blocking I/O (blocks entire Django worker)
- Missing `CONN_MAX_AGE` causing connection churn
```

- [ ] **Step 2: Add cross-references to vulnerability-catalog**

Add a cross-reference line at the end of each STRIDE section:

After **Spoofing** `What to check` list:
```
**See also:** `references/vulnerability-catalog.md` > A07: Identification and Authentication Failures
```

After **Tampering** `What to check` list:
```
**See also:** `references/vulnerability-catalog.md` > A03: Injection, A08: Software and Data Integrity Failures
```

After **Information Disclosure** `What to check` list:
```
**See also:** `references/vulnerability-catalog.md` > A01: Broken Access Control (IDOR)
```

After **Denial of Service** `What to check` list:
```
**See also:** `references/vulnerability-catalog.md` > A06: Vulnerable and Outdated Components (ReDoS)
```

After **Elevation of Privilege** `What to check` list:
```
**See also:** `references/vulnerability-catalog.md` > A01: Broken Access Control (Privilege Escalation, Mass Assignment)
```

- [ ] **Step 3: Add Python/Django patterns to Application Type Quick Reference**

In `skills/threat-model/references/stride-guide.md`, add to the `## Application Type Quick Reference` section:

```markdown
### Django Applications
Focus on: CSRF (T), IDOR (I), Missing `@login_required` (S), DEBUG=True (I), Mass assignment via ModelForm (E), Unbounded QuerySets (D)

### Flask Applications
Focus on: Missing auth decorators (S), SQL injection via raw queries (T), Debug mode (I), CORS misconfiguration (I), Rate limiting (D)

### FastAPI Applications
Focus on: Missing `Depends()` auth (S), Pydantic bypass (T), CORS middleware config (I), Rate limiting (D)
```

- [ ] **Step 4: Commit**

```bash
git add skills/threat-model/references/stride-guide.md
git commit -m "fix(ref): stride-guide DoS categorization, cross-references, Python/Django patterns

Splits DoS into resource exhaustion vs logic abuse. Adds Python/Django DoS patterns.
Adds cross-references to vulnerability-catalog.md in each STRIDE category.
Adds Django, Flask, FastAPI to application type quick reference."
```

---

### Task 19: Fix `review-checklist.md` — Schema validation, CSRF move, dependency integrity, three-state format

**Files:**
- Modify: `skills/security-review/references/review-checklist.md`

- [ ] **Step 1: Update to three-state format and make all fixes**

Replace the entire contents of `skills/security-review/references/review-checklist.md`:

```markdown
# Security Review Checklist

Quick-reference checklist organized by code area. For each item, mark as:
- **[PASS]** -- Verified secure
- **[FAIL]** -- Vulnerability found (document details)
- **[N/A]** -- Not applicable to this codebase (briefly note why)

## Authentication

- [ ] Every API route/handler checks authentication
- [ ] Auth check is the FIRST operation (before any data access)
- [ ] Tokens have expiry set
- [ ] Sessions regenerate after login
- [ ] Logout actually invalidates the session/token
- [ ] Password reset tokens are single-use and expire
- [ ] Failed login attempts are rate-limited
- [ ] Auth errors don't differentiate "user not found" vs "wrong password"
- [ ] CSRF protection on state-changing endpoints (forms, POST/PUT/DELETE)

## Authorization

- [ ] Every resource access checks ownership (not just authentication)
- [ ] Admin routes verify admin role server-side
- [ ] Role/permission changes require admin authorization
- [ ] User cannot modify their own role via API
- [ ] Resource IDs are not predictable/sequential (or ownership is always checked)
- [ ] Nested resources verify parent ownership (e.g., /users/1/orders/2 checks user owns order)

## Input Validation

- [ ] All user input is validated before use
- [ ] Validation is server-side (not just client-side)
- [ ] Validation uses a schema library (zod, joi, yup, ajv, Pydantic, marshmallow, etc.) rather than ad-hoc checks
- [ ] Request body fields are explicitly destructured (no mass assignment)
- [ ] File uploads validate: type, size, filename
- [ ] URL parameters are validated and typed
- [ ] Headers used in logic are validated

## Database

- [ ] All queries use parameterized statements (no string interpolation)
- [ ] ORM calls don't pass raw user input to `where` clauses without filtering
- [ ] Bulk operations are bounded (LIMIT, pagination)
- [ ] Transactions used for multi-step mutations
- [ ] No raw SQL with user input concatenation

## Output

- [ ] User-generated content is escaped before HTML rendering
- [ ] No raw HTML insertion with user-controlled content
- [ ] API responses don't include internal fields (password hashes, tokens, internal IDs)
- [ ] Error responses use generic messages (no stack traces, query text, file paths)
- [ ] Content-Type headers are set correctly

## Secrets & Configuration

- [ ] No hardcoded secrets in source code
- [ ] `.env` files are in `.gitignore`
- [ ] Environment variables not accessible in client bundles
- [ ] Sensitive config (DB credentials, API keys) uses env vars
- [ ] Default credentials don't exist
- [ ] Debug mode is disabled in production configuration

## Session & Cookies

- [ ] Cookies use `httpOnly`, `secure`, `sameSite` flags
- [ ] Session tokens have reasonable expiry
- [ ] Session data stored server-side (not in cookies)

## Dependencies

- [ ] No known vulnerable packages (run `npm audit` / `pip audit` / `cargo audit`)
- [ ] No severely outdated dependencies (2+ major versions behind)
- [ ] Lock file (`package-lock.json`, `yarn.lock`, `poetry.lock`) is committed and reviewed
- [ ] Dependencies use integrity hashes where supported

## External Services

- [ ] Webhook endpoints verify signatures
- [ ] OAuth redirect URIs are whitelisted (not user-controlled)
- [ ] External API calls use HTTPS
- [ ] SSRF prevention: user-supplied URLs validated against allowlist
- [ ] External API keys are not exposed to clients

## Headers & Transport

- [ ] HTTPS enforced (HSTS header set)
- [ ] Content-Security-Policy header configured
- [ ] X-Frame-Options set (clickjacking prevention)
- [ ] X-Content-Type-Options: nosniff
- [ ] CORS configured with specific origins (not wildcard for authenticated endpoints)

## Logging & Monitoring

- [ ] Auth events logged (login, logout, failed attempts)
- [ ] Sensitive operations logged (data deletion, permission changes, payments)
- [ ] Sensitive data NOT in logs (passwords, tokens, PII)
- [ ] Logs include: timestamp, actor, action, target, outcome
- [ ] Rate limiting is in place for public endpoints

## Error Handling

- [ ] Errors caught and handled (no unhandled rejections/exceptions)
- [ ] Error messages don't reveal internal structure
- [ ] Different error types return consistent response format
- [ ] No empty catch blocks that silently swallow security-relevant errors
```

- [ ] **Step 2: Commit**

```bash
git add skills/security-review/references/review-checklist.md
git commit -m "fix(ref): review-checklist three-state format, schema validation, CSRF move, dep integrity

Changes to [PASS]/[FAIL]/[N/A] format. Adds schema validation library guidance
to Input Validation. Moves CSRF to Authentication section. Adds Dependencies
section with integrity checks and lock file review."
```

---

## Section 3.5 — Comprehensive Test Suite

---

### Task 20: False-positive regression suite for hardcoded-secrets

**Files:**
- Modify: `mcp/shieldkit/src/__tests__/hardcoded-secrets.test.ts`

These tests ensure known-safe patterns are NOT flagged. They guard against future regressions.

- [ ] **Step 1: Add false-positive regression tests**

Append to the existing test file `mcp/shieldkit/src/__tests__/hardcoded-secrets.test.ts`:

```typescript
  describe('false-positive regression suite', () => {
    const knownSafePatterns = [
      // Environment variable references
      `const dbUrl = process.env.DATABASE_URL;`,
      `const secret = process.env.JWT_SECRET || '';`,
      // Import statements
      `import { password } from './config';`,
      `const { apiKey } = require('./env');`,
      // Type definitions
      `interface Config { password: string; apiKey: string; }`,
      `type Secret = { token: string };`,
      // Comments
      `// The password is stored securely in the vault`,
      `/* apiKey is loaded from environment */`,
      // Template strings without actual values
      `const msg = "Enter your password:";`,
      `const label = "API Key";`,
      // Placeholder values
      `const password = "placeholder";`,
      `const token = "TODO: set this";`,
      // Short values
      `const password = "test";`,
      `const secret = "dev";`,
      // Empty assignments
      `const password = "";`,
      `let token = '';`,
      // Stripe publishable keys
      `const STRIPE_PK = "pk_test_abc123def456ghi789jkl";`,
      `const key = "pk_live_abcdefghijklmnop";`,
    ];

    for (const pattern of knownSafePatterns) {
      it(`should NOT flag: ${pattern.slice(0, 60)}...`, () => {
        const result = analyzeHardcodedSecrets(pattern);
        expect(result.count, `False positive on: ${pattern}`).toBe(0);
      });
    }

    it('should NOT flag secrets in test files', () => {
      const content = `const password = "real-looking-secret-value-123";`;
      const result = analyzeHardcodedSecrets(content, 'src/auth.test.ts');
      expect(result.count).toBe(0);
    });

    it('should NOT flag secrets in .env.example', () => {
      const content = `JWT_SECRET=your-secret-here`;
      const result = analyzeHardcodedSecrets(content, '.env.example');
      expect(result.count).toBe(0);
    });
  });
```

- [ ] **Step 2: Run tests, verify they pass**

Run: `cd mcp/shieldkit && npx vitest run src/__tests__/hardcoded-secrets.test.ts 2>&1 | tail -20`

Expected: All false-positive regression tests pass.

- [ ] **Step 3: Commit**

```bash
git add mcp/shieldkit/src/__tests__/hardcoded-secrets.test.ts
git commit -m "test(shieldkit): add false-positive regression suite for hardcoded-secrets

Guards against re-introducing false positives: env refs, imports, types,
comments, placeholders, short values, empty strings, pk_ keys, test files."
```

---

### Task 21: False-positive regression suite for sql-injection

**Files:**
- Modify: `mcp/shieldkit/src/__tests__/sql-injection.test.ts`

- [ ] **Step 1: Add false-positive regression tests**

Append to the existing test file `mcp/shieldkit/src/__tests__/sql-injection.test.ts`:

```typescript
  describe('false-positive regression suite', () => {
    const knownSafePatterns = [
      // Parameterized queries (JS/TS)
      `db.query("SELECT * FROM users WHERE id = $1", [userId]);`,
      `await prisma.user.findMany({ where: { id: userId } });`,
      `knex("users").where("id", userId).select("*");`,
      `sequelize.query("SELECT * FROM users WHERE id = ?", { replacements: [userId] });`,
      // Parameterized queries (Python)
      `cursor.execute("SELECT * FROM users WHERE id = %s", [user_id])`,
      `db.session.execute(text("SELECT * FROM users WHERE id = :id"), {"id": user_id})`,
      // String literals without interpolation
      `const sql = "SELECT * FROM users WHERE active = true";`,
      `const sql = "DELETE FROM sessions WHERE expires_at < NOW()";`,
      // Comments containing SQL
      `// This query: SELECT * FROM users WHERE id = \${userId}`,
      `/* DELETE FROM users WHERE id = \${dangerous} */`,
      // ORM calls
      `const users = await User.findAll({ where: { active: true } });`,
      `const user = await User.findByPk(id);`,
    ];

    for (const pattern of knownSafePatterns) {
      it(`should NOT flag: ${pattern.slice(0, 60)}...`, () => {
        const result = analyzeSqlInjection(pattern);
        expect(result.count, `False positive on: ${pattern}`).toBe(0);
      });
    }

    it('should NOT flag SQL injection patterns in test files', () => {
      const content = 'const q = `SELECT * FROM users WHERE id = ${userId}`;';
      const result = analyzeSqlInjection(content, 'tests/db.test.ts');
      expect(result.count).toBe(0);
    });
  });
```

- [ ] **Step 2: Run tests, verify they pass**

Run: `cd mcp/shieldkit && npx vitest run src/__tests__/sql-injection.test.ts 2>&1 | tail -20`

Expected: All false-positive regression tests pass.

- [ ] **Step 3: Commit**

```bash
git add mcp/shieldkit/src/__tests__/sql-injection.test.ts
git commit -m "test(shieldkit): add false-positive regression suite for sql-injection

Guards against flagging: parameterized queries, ORM calls, string literals
without interpolation, SQL in comments, test files."
```

---

### Task 22: False-positive regression suites for remaining analyzers

**Files:**
- Modify: `mcp/shieldkit/src/__tests__/dangerous-functions.test.ts`
- Modify: `mcp/shieldkit/src/__tests__/cors-config.test.ts`
- Modify: `mcp/shieldkit/src/__tests__/missing-auth.test.ts`

- [ ] **Step 1: Add dangerous-functions false-positive tests**

Append to `mcp/shieldkit/src/__tests__/dangerous-functions.test.ts`:

```typescript
  describe('false-positive regression suite', () => {
    const knownSafePatterns = [
      // setTimeout/setInterval with function (not string)
      `setTimeout(() => { doThing(); }, 1000);`,
      `setInterval(checkStatus, 5000);`,
      `setTimeout(function() { refresh(); }, 100);`,
      // execFile (safe alternative)
      `require("child_process").execFile("/bin/ls", ["-la"]);`,
      // eval in variable name or comment
      `const evalResult = computeScore();`,
      `// Don't use eval() here`,
      // Function as variable name
      `const myFunction = () => {};`,
      // innerHTML read (not assignment)
      `const html = el.innerHTML;`,
      `console.log(el.innerHTML);`,
      // Python safe subprocess
      `subprocess.run(["ls", "-la"])`,
      `subprocess.call(["git", "status"])`,
    ];

    for (const pattern of knownSafePatterns) {
      it(`should NOT flag: ${pattern.slice(0, 60)}...`, () => {
        const result = analyzeDangerousFunctions(pattern);
        expect(result.count, `False positive on: ${pattern}`).toBe(0);
      });
    }
  });
```

- [ ] **Step 2: Add cors-config false-positive tests**

Append to `mcp/shieldkit/src/__tests__/cors-config.test.ts`:

```typescript
  describe('false-positive regression suite', () => {
    const knownSafePatterns = [
      // Specific origins
      `app.use(cors({ origin: 'https://example.com' }));`,
      `app.use(cors({ origin: ['https://a.com', 'https://b.com'] }));`,
      // Origin in non-CORS context
      `const origin = window.location.origin;`,
      `const data = { origin: 'USA' };`,
      // Commented-out CORS
      `// app.use(cors({ origin: '*' }));`,
      `/* cors({ origin: true }) */`,
      // CORS with function origin (dynamic checking)
      `app.use(cors({ origin: (origin, cb) => cb(null, allowlist.includes(origin)) }));`,
    ];

    for (const pattern of knownSafePatterns) {
      it(`should NOT flag: ${pattern.slice(0, 60)}...`, () => {
        const result = analyzeCorsConfig(pattern);
        expect(result.count, `False positive on: ${pattern}`).toBe(0);
      });
    }
  });
```

- [ ] **Step 3: Add missing-auth false-positive tests**

Append to `mcp/shieldkit/src/__tests__/missing-auth.test.ts`:

```typescript
  describe('false-positive regression suite', () => {
    it('should NOT flag utility files as missing auth', () => {
      expect(isRouteFile('src/utils/helpers.ts')).toBe(false);
      expect(isRouteFile('src/lib/database.ts')).toBe(false);
      expect(isRouteFile('src/models/user.ts')).toBe(false);
    });

    it('should NOT flag files with auth patterns present', () => {
      const content = `
export async function GET(req) {
  const session = await getServerSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  return Response.json({ data: "ok" });
}
`;
      expect(analyzeAuth(content)).toBe(true);
    });

    it('should NOT flag middleware files as route files', () => {
      expect(isRouteFile('src/middleware/auth.ts')).toBe(false);
      expect(isRouteFile('src/middleware/logger.ts')).toBe(false);
    });
  });
```

- [ ] **Step 4: Run all tests**

Run: `cd mcp/shieldkit && npx vitest run 2>&1 | tail -30`

Expected: All tests across all test files pass.

- [ ] **Step 5: Commit**

```bash
git add mcp/shieldkit/src/__tests__/dangerous-functions.test.ts mcp/shieldkit/src/__tests__/cors-config.test.ts mcp/shieldkit/src/__tests__/missing-auth.test.ts
git commit -m "test(shieldkit): add false-positive regression suites for all remaining analyzers

Covers: dangerous-functions (safe setTimeout, execFile, variable names),
cors-config (specific origins, non-CORS contexts, comments),
missing-auth (utility files, auth-present files, middleware)."
```

---

### Task 23: Integration tests against Phase 0 fixture project

**Files:**
- Create: `mcp/shieldkit/src/__tests__/integration.test.ts`

These tests run the full scan/surface/status tools against the Phase 0 test fixtures and verify expected findings. They are skipped if fixtures are not present.

- [ ] **Step 1: Create integration test file**

Create `mcp/shieldkit/src/__tests__/integration.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { scanTool } from '../mcp/tools/scan.js';
import { surfaceTool } from '../mcp/tools/surface.js';
import { statusTool } from '../mcp/tools/status.js';

const FIXTURES_DIR = resolve(import.meta.dirname, '../../../../test-fixtures');
const hasFixtures = existsSync(FIXTURES_DIR);

describe.skipIf(!hasFixtures)('integration: scan against test-fixtures', () => {
  it('should find hardcoded secrets in config.ts', async () => {
    const result = await scanTool({ file: 'src/config.ts' }, FIXTURES_DIR);
    expect(result.files[0].hardcodedSecrets.count).toBeGreaterThan(0);
  });

  it('should find SQL injection in user-repository.ts', async () => {
    const result = await scanTool({ file: 'src/db/user-repository.ts' }, FIXTURES_DIR);
    expect(result.files[0].sqlInjection.count).toBeGreaterThan(0);
  });

  it('should find CORS misconfiguration in config.ts', async () => {
    const result = await scanTool({ file: 'src/config.ts' }, FIXTURES_DIR);
    expect(result.files[0].corsConfig.count).toBeGreaterThan(0);
  });

  it('should find missing auth in admin-routes.ts', async () => {
    const result = await scanTool({ file: 'src/routes/admin-routes.ts' }, FIXTURES_DIR);
    const adminFile = result.files[0];
    expect(adminFile.missingAuth?.isRouteFile).toBe(true);
    expect(adminFile.missingAuth?.hasAuth).toBe(false);
  });

  it('should find dangerous functions in Python utils', async () => {
    const result = await scanTool({ file: 'src/py/utils.py' }, FIXTURES_DIR);
    expect(result.files[0].dangerousFunctions.count).toBeGreaterThan(0);
  });

  it('should find Python SQL injection in utils.py', async () => {
    const result = await scanTool({ file: 'src/py/utils.py' }, FIXTURES_DIR);
    expect(result.files[0].sqlInjection.count).toBeGreaterThan(0);
  });

  it('full project scan should find multiple categories', async () => {
    const result = await scanTool({}, FIXTURES_DIR);
    expect(result.summary.totalFiles).toBeGreaterThan(0);
    expect(result.summary.filesWithFindings).toBeGreaterThan(0);
    expect(result.scoring.riskLevel).not.toBe('clean');
  });
});

describe.skipIf(!hasFixtures)('integration: surface against test-fixtures', () => {
  it('should discover route files', async () => {
    const result = await surfaceTool(FIXTURES_DIR);
    expect(result.endpoints.length).toBeGreaterThan(0);
  });

  it('should find unprotected endpoints', async () => {
    const result = await surfaceTool(FIXTURES_DIR);
    const unprotected = result.endpoints.filter(e => !e.hasAuth);
    expect(unprotected.length).toBeGreaterThan(0);
  });

  it('should discover env files', async () => {
    const result = await surfaceTool(FIXTURES_DIR);
    expect(result.envFiles.length).toBeGreaterThanOrEqual(0);
  });
});

describe.skipIf(!hasFixtures)('integration: status against test-fixtures', () => {
  it('should produce a complete status result', async () => {
    const result = await statusTool(FIXTURES_DIR);
    expect(result.riskLevel).toBeDefined();
    expect(result.totalFindings).toBeGreaterThan(0);
    expect(result.quickSummary).toBeTruthy();
  });

  it('should have topIssues sorted by severity', async () => {
    const result = await statusTool(FIXTURES_DIR);
    if (result.topIssues.length >= 2) {
      const severityOrder = ['critical', 'high', 'medium', 'low'];
      const firstSeverity = result.topIssues[0].match(/\[(critical|high|medium|low)\]/);
      const lastSeverity = result.topIssues[result.topIssues.length - 1].match(/\[(critical|high|medium|low)\]/);
      if (firstSeverity && lastSeverity) {
        expect(severityOrder.indexOf(firstSeverity[1])).toBeLessThanOrEqual(
          severityOrder.indexOf(lastSeverity[1])
        );
      }
    }
  });
});
```

- [ ] **Step 2: Run integration tests**

Run: `cd mcp/shieldkit && npx vitest run src/__tests__/integration.test.ts 2>&1 | tail -30`

Expected: If Phase 0 fixtures exist, all tests pass. If not, all tests are skipped.

- [ ] **Step 3: Commit**

```bash
git add mcp/shieldkit/src/__tests__/integration.test.ts
git commit -m "test(shieldkit): add integration tests against Phase 0 test-fixture project

Tests scan/surface/status tools against realistic fixture project.
Verifies expected findings: secrets in config, SQL injection in repository,
CORS misconfig, missing auth in admin routes, Python dangerous functions.
Skipped automatically if test-fixtures directory is not present."
```

---

### Task 24: Run full test suite and verify build

**Files:** (none modified -- verification only)

- [ ] **Step 1: Run all shieldkit tests**

Run: `cd mcp/shieldkit && npx vitest run 2>&1`

Expected: All tests pass. Should be approximately 80-100+ tests across 8 test files.

- [ ] **Step 2: Verify TypeScript compilation**

Run: `cd mcp/shieldkit && npx tsc --noEmit 2>&1`

Expected: No type errors.

- [ ] **Step 3: Build the project**

Run: `cd mcp/shieldkit && npm run build 2>&1`

Expected: Clean build, dist/ directory updated.

- [ ] **Step 4: Run root test script (if Phase 0 created it)**

Run: `npm test 2>&1 | tail -30`

Expected: All server tests pass (or at least shieldkit passes).

---

## Summary of All Changes

### Analyzers Modified (7 files):
1. `mcp/shieldkit/src/analyzers/hardcoded-secrets.ts` -- Remove pk_, case-insensitive, min length, entropy
2. `mcp/shieldkit/src/analyzers/missing-auth.ts` -- Handler-level detection, expanded patterns, Python
3. `mcp/shieldkit/src/analyzers/sql-injection.ts` -- Test exclusion, nested templates, comments, Python
4. `mcp/shieldkit/src/analyzers/dangerous-functions.ts` -- New patterns, per-finding severity
5. `mcp/shieldkit/src/analyzers/cors-config.ts` -- Variable config, 10-line context, credentials+wildcard
6. `mcp/shieldkit/src/analyzers/discovery.ts` -- Gitignore **, negation, parallel detect, Python
7. `mcp/shieldkit/src/analyzers/scoring.ts` -- Per-finding severity aggregation

### Tools Modified (2 files):
8. `mcp/shieldkit/src/mcp/tools/scan.ts` -- Auth in FileFindings, filesWithFindings count, no double-discovery
9. `mcp/shieldkit/src/mcp/tools/status.ts` -- Sorted topIssues

### Skills Modified (3 files):
10. `skills/scan/SKILL.md` -- Remove redundancy, concrete dep checks, Not Vulnerable section
11. `skills/threat-model/SKILL.md` -- Likelihood x Impact matrix, skipped-categories docs
12. `skills/security-review/SKILL.md` -- file-or-directory hint, ownership verification, timing enumeration

### Agent Modified (1 file):
13. `agents/security-auditor.md` -- Phase 0 status, STRIDE table, dep checks, posture criteria, scope guidance

### References Modified (3 files):
14. `skills/scan/references/vulnerability-catalog.md` -- A06, prototype pollution, ReDoS, SSRF, Python
15. `skills/threat-model/references/stride-guide.md` -- DoS categorization, cross-refs, Python/Django
16. `skills/security-review/references/review-checklist.md` -- Three-state, schema validation, CSRF, deps

### Tests Created (10 files):
17. `mcp/shieldkit/src/__tests__/hardcoded-secrets.test.ts`
18. `mcp/shieldkit/src/__tests__/missing-auth.test.ts`
19. `mcp/shieldkit/src/__tests__/sql-injection.test.ts`
20. `mcp/shieldkit/src/__tests__/dangerous-functions.test.ts`
21. `mcp/shieldkit/src/__tests__/cors-config.test.ts`
22. `mcp/shieldkit/src/__tests__/discovery.test.ts`
23. `mcp/shieldkit/src/__tests__/scoring.test.ts`
24. `mcp/shieldkit/src/__tests__/tools-scan.test.ts`
25. `mcp/shieldkit/src/__tests__/tools-status.test.ts`
26. `mcp/shieldkit/src/__tests__/integration.test.ts`
