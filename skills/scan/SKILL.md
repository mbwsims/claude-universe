---
name: scan
description: >-
  This skill should be used when the user asks to "scan for vulnerabilities", "security scan",
  "find security issues", "check for security problems", "OWASP scan", "is this code secure",
  "find injection vulnerabilities", mentions "/scan", or wants to identify security
  vulnerabilities in their code.
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - mcp__shieldkit__shieldkit_scan
argument-hint: "[file-or-directory]"
---

# Security Scan

Scan code for security vulnerabilities. Goes beyond surface-level checks ("don't use eval")
into the structural vulnerabilities that cause real breaches: auth bypass, injection, IDOR,
mass assignment, insecure defaults, race conditions, and secret exposure.

Claude's default security awareness catches obvious issues but misses the non-obvious ones
that attackers actually exploit. This skill provides the methodology to find them.

## Workflow

### 1. Scope the Scan

If a specific file or directory was provided, focus there. Otherwise, identify the
security-critical surfaces:

- **API routes / handlers** — entry points for attackers
- **Authentication code** — login, session, token handling
- **Authorization code** — permission checks, role enforcement
- **Database queries** — injection surfaces
- **File handling** — upload, download, path operations
- **Configuration** — env vars, secrets, default settings
- **Dependencies** — known vulnerable packages

Prioritize by attack surface: externally-reachable code first, internal code second.

### 2. Run Vulnerability Checks

**With shieldkit-mcp (preferred):** Call `shieldkit_scan` to get deterministic pattern
detection — SQL injection, missing auth, hardcoded secrets, dangerous functions, CORS
misconfigurations. Use the structured findings as the foundation, then supplement with
semantic analysis for issues the tool cannot detect (logic flaws, broken access control
that requires understanding business rules, race conditions).

**Without shieldkit-mcp:** For each file in scope, manually check against the vulnerability
categories in `references/vulnerability-catalog.md`. Note to the user: "Running without
shieldkit-mcp — analysis will use manual pattern matching."

For each vulnerability found:
1. Identify the specific code location (file + line)
2. Classify the severity: **Critical**, **High**, **Medium**, **Low**
3. Describe the attack scenario — how an attacker would exploit this
4. Provide a concrete fix

### 3. Check for Secrets

Grep for patterns that indicate exposed secrets:
- API keys, tokens, passwords in source code
- Hardcoded credentials in config files
- `.env` files committed to git (check `.gitignore`)
- Private keys or certificates in the repo

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

### 5. Present Findings

**Report format:**

```
## Security Scan — {scope}

{n} vulnerabilities found: {critical} critical, {high} high, {medium} medium, {low} low

### Critical

1. **SQL Injection** — `{file}:{line}`
   Code: `db.query(\`SELECT * FROM users WHERE id = ${userId}\`)`
   Attack: Attacker sends `userId = "1; DROP TABLE users"` via API
   Fix: Use parameterized queries: `db.query("SELECT * FROM users WHERE id = $1", [userId])`

### High

2. **Missing Auth Check** — `{file}:{line}`
   ...

### Medium
...

### Secrets
{Any exposed secrets found}

### Dependencies
{Any vulnerable or outdated dependencies}

### Not Vulnerable
{Explicitly list what was checked and found secure. Examples:}
- SQL queries: All database access in `src/db/` uses parameterized queries via Prisma
- Auth: All API routes in `src/routes/` have authentication middleware
- CORS: Configuration restricts origins to `https://app.example.com`
- Secrets: No hardcoded credentials found; all secrets loaded via env vars

{This section builds confidence that the scan was thorough and helps developers
understand what does NOT need attention.}
```

Order findings by severity (Critical → High → Medium → Low). Within each severity,
order by exploitability (externally reachable > internal only).

## Guidelines

- **Be specific about attacks.** Don't say "this is insecure." Say "an attacker could
  send X to endpoint Y and gain Z." The attack scenario is what makes findings actionable.
- **Don't flag theoretical issues.** If an input is only reachable from trusted internal
  code, a sanitization issue is Low, not Critical. Context matters.
- **Include false-positive reasoning.** If something looks like a vulnerability but isn't
  (e.g., parameterized query that uses string interpolation for table names only), explain
  why it's safe.
- **Note what's secure.** A scan that only lists problems is incomplete. Note areas that
  are well-protected — this builds confidence and helps prioritize.

## Related Skills

- **`/threat-model`** — Use on high-risk findings to assess broader attack patterns
- **`/security-review`** — Use for attacker-minded analysis of specific files

## Additional Resources

- **`references/vulnerability-catalog.md`** — Full vulnerability catalog organized by
  OWASP Top 10 + modern web categories, with detection patterns and fix templates
