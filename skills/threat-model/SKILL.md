---
name: threat-model
description: >-
  This skill should be used when the user asks to "threat model", "model threats",
  "what are the security risks", "attack surface analysis", "STRIDE analysis",
  "security risks of this feature", "who could attack this", mentions "/threat-model",
  or wants to understand the security threats to a feature, module, or system.
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - mcp__shieldkit__shieldkit_surface
argument-hint: "[feature-or-module]"
---

# Threat Model

Generate a structured threat model for a feature or module using the STRIDE methodology.
Identifies assets, threat actors, attack surfaces, potential attacks, and mitigations.

Threat modeling BEFORE building is cheaper than finding vulnerabilities AFTER shipping.
This skill provides the security thinking that most development skips.

## Workflow

### 1. Identify the Target

Read the target feature or module. If a specific file/directory was provided, focus there.
Otherwise, ask what feature or system to model.

Understand:
- What does this feature do?
- What data does it handle?
- Who interacts with it (users, admins, external services, other systems)?
- What are the trust boundaries (where does trusted code meet untrusted input)?

### 2. Map the Attack Surface

**With shieldkit-mcp (preferred):** Call `shieldkit_surface` to get structured attack surface
mapping — all endpoints with auth status, env file coverage, and external boundaries.
Use this as the foundation for the attack surface map.

**Without shieldkit-mcp:** Discover manually by reading route files and handler directories.

Identify every point where external input enters the system:

- **API endpoints** — HTTP methods, parameters, headers, body
- **User input** — forms, uploads, URL parameters, cookies
- **External service callbacks** — webhooks, OAuth redirects, payment notifications
- **File system** — uploaded files, config files, temp files
- **Environment** — env vars, CLI arguments, database connections

For each entry point, note: what data comes in, who can send it, and what validation
exists.

### 3. Apply STRIDE

For each entry point, systematically check six threat categories:

| Threat | Question | Example |
|--------|----------|---------|
| **S**poofing | Can someone pretend to be someone else? | Forged auth token, session hijack |
| **T**ampering | Can someone modify data they shouldn't? | SQL injection, parameter manipulation |
| **R**epudiation | Can someone deny they did something? | Missing audit logs, unsigned actions |
| **I**nformation Disclosure | Can someone access data they shouldn't? | IDOR, error messages, logs |
| **D**enial of Service | Can someone make this unavailable? | No rate limiting, resource exhaustion |
| **E**levation of Privilege | Can someone gain unauthorized access? | Mass assignment, role escalation |

Not every threat applies to every entry point. Skip categories that genuinely don't apply
and note why.

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

### 5. Recommend Mitigations

For each threat, provide a specific mitigation:
- What code to add or change
- What configuration to set
- What process to implement
- Whether the mitigation already exists (acknowledge what's secure)

### 6. Present the Model

**Report format:**

```
## Threat Model — {feature/module name}

### Overview
{What this feature does and why it matters from a security perspective}

### Assets
{What data/resources need protecting}

### Trust Boundaries
{Where trusted meets untrusted — diagram if helpful}

### Attack Surface
{Entry points enumerated}

### Threats

| # | Category | Threat | Entry Point | Likelihood | Impact | Priority |
|---|----------|--------|-------------|------------|--------|----------|
| 1 | Tampering | SQL injection via search | /api/search?q= | High | Critical | P0 |
| 2 | Spoofing | Session fixation | /auth/login | Medium | High | P1 |
| ... |

### Mitigations

1. **T1: SQL injection** — Use parameterized queries for search endpoint.
   Status: NOT MITIGATED — current code uses string interpolation.

2. **T2: Session fixation** — Regenerate session after login.
   Status: MITIGATED — auth library handles this automatically.

### Summary
{n} threats identified: {critical} P0, {high} P1, {medium} P2, {low} P3
{n} already mitigated, {n} need implementation
```

## Guidelines

- Focus on REALISTIC threats, not theoretical. "Nation-state actor with physical access"
  is not useful for most applications.
- Note what's already secure. A threat model that only lists problems is incomplete.
- Be specific about mitigations. "Add input validation" is vague. "Parameterize the SQL
  query in search.ts:42" is actionable.
- The model should be useful to a developer deciding what to build next, not just a
  security auditor.

## Related Skills

- **`/scan`** — Use to verify whether identified threats have corresponding vulnerabilities in code
- **`/security-review`** — Use on the highest-risk code identified by the threat model

## Additional Resources

- **`references/stride-guide.md`** — Detailed STRIDE methodology with examples for each
  category and common patterns by application type
