---
name: security-review
description: >-
  This skill should be used when the user asks to "security review this code", "review for
  security", "is this code safe", "check for exploits", "security code review", "find
  security bugs", "pen test this", mentions "/security-review", or wants a security-focused
  code review of specific files or changes.
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - mcp__shieldkit__shieldkit_scan
argument-hint: "[file-or-directory]"
---

# Security Review

Perform a security-focused code review. Unlike a general code review (style, correctness,
performance), this review asks one question: **can this code be exploited?**

Reads the code with an attacker's mindset. Traces data from untrusted sources through
processing to storage/output. Identifies where validation is missing, where authorization
is incomplete, and where assumptions can be broken.

## Workflow

### 0. Baseline Scan (if available)

Call `shieldkit_scan` with the target file. If available, use the structured findings
(SQL injection, missing auth, hardcoded secrets, dangerous functions) as a starting point.
Then go deeper with semantic analysis below.

If unavailable, proceed directly to manual analysis.

### 1. Read with Attacker's Eyes

Read the target code. For each function or handler, ask:
- Where does untrusted input enter?
- What assumptions does the code make about that input?
- How can those assumptions be broken?
- What happens if they are broken?

### 2. Trace Data Flow

For each piece of untrusted input (request params, body, headers, URL, cookies, uploaded
files, webhook payloads), trace it through the code:

```
Input source → Validation → Processing → Storage/Output
```

At each step, check:
- **Input source**: Is the source authenticated? Can it be spoofed?
- **Validation**: Is input validated? Are ALL fields checked? Are checks bypassable?
- **Processing**: Is input used in queries, commands, file paths, or HTML? Is it escaped?
- **Storage/Output**: Is sensitive data stored securely? Is output properly encoded?

### 3. Check Authorization Completeness

For every operation that modifies data or accesses resources:
- Is there an auth check?
- Does the auth check verify OWNERSHIP, not just authentication?
- Can the auth check be bypassed (parameter tampering, direct object reference)?
- Are there admin-only operations without admin checks?

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

### 4. Check Error Handling

Errors are a common source of information disclosure:
- Do error messages reveal internal structure (stack traces, query text, file paths)?
- Do different error types reveal information (different messages for "user not found" vs
  "wrong password" enables user enumeration)?
- Are errors handled consistently (no swallowed errors that skip security checks)?
- Do responses take different amounts of time for different outcomes? (e.g., login takes
  longer for valid usernames because it checks the password hash, but returns immediately
  for invalid usernames -- this enables username enumeration via timing side-channel)
- **Mitigation:** Use constant-time comparison for secrets (`crypto.timingSafeEqual()`),
  and ensure login flows take the same time regardless of whether the user exists

### 5. Present Findings

**Report format:**

```
## Security Review — {file}

**Risk Level: {Critical / High / Medium / Low / Clean}**

### Findings

1. **{Vulnerability type}** — Line {n}
   **Severity:** {Critical/High/Medium/Low}
   **Data flow:** {untrusted source} → {processing step} → {vulnerable operation}
   **Attack:** {How an attacker would exploit this}
   **Fix:** {Specific code change}

2. ...

### Secure Patterns Found
{Acknowledge what's done well — auth checks, parameterized queries, etc.}

### Recommendations
{Prioritized list of changes to make}
```

## Guidelines

- **Think like an attacker, not an auditor.** Don't enumerate every possible theoretical
  vulnerability. Focus on what a real attacker would try first.
- **Trace the data.** Every finding should include the data flow: where untrusted input
  enters, how it moves through the code, and where it becomes dangerous.
- **Context matters.** An internal-only service has different risks than a public API. Don't
  flag internal RPC calls for "missing rate limiting."
- **Acknowledge security.** Note secure patterns — auth checks that work, proper escaping,
  good session management. A review that only lists problems is discouraging and incomplete.
- **Be specific about fixes.** "Sanitize input" is useless. "Add zod validation schema
  for the request body before line 42" is actionable.

## Related Skills

- **`/scan`** — Use for broader vulnerability coverage across the project
- **`/threat-model`** — Use for strategic risk assessment of features and systems

## Additional Resources

- **`references/review-checklist.md`** — Quick-reference checklist for security review
  organized by code area (routes, auth, database, file handling, etc.)
