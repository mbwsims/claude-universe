# STRIDE Guide

Detailed methodology for each STRIDE category with common patterns by application type.

## Spoofing

**Core question:** Can an attacker assume another identity?

### Common Patterns

**Web applications:**
- Forged authentication tokens (JWT with weak secret, no signature verification)
- Session hijacking via XSS (steal cookie, replay in different browser)
- OAuth redirect manipulation (redirect_uri to attacker-controlled server)
- Email spoofing in password reset flows (no sender verification)

**APIs:**
- API key theft (key in URL, logged, or exposed in client code)
- Bearer token replay (no token binding to client, no expiry)
- Webhook source spoofing (no signature verification)
- IP-based auth bypass (X-Forwarded-For header manipulation)

**What to check:**
- How are users authenticated? Token, session, API key?
- Can tokens be forged? What's the signing mechanism?
- Are sessions bound to the client (IP, user agent)?
- Can external callbacks be spoofed?

**See also:** `references/vulnerability-catalog.md` > A07: Identification and Authentication Failures

## Tampering

**Core question:** Can an attacker modify data they shouldn't?

### Common Patterns

**Data in transit:**
- SQL/NoSQL injection via user input
- Parameter tampering (changing `userId`, `price`, `role` in requests)
- HTTP request smuggling
- Man-in-the-middle on non-HTTPS connections

**Data at rest:**
- Mass assignment (extra fields in POST/PUT body applied to database)
- Direct database access via exposed admin panels
- File tampering (modifying uploaded files, config files)
- Cache poisoning

**What to check:**
- Where does user input reach the database?
- Are request parameters validated and sanitized?
- Can users modify fields they shouldn't (role, price, permissions)?
- Is data integrity verified (checksums, signatures)?

**See also:** `references/vulnerability-catalog.md` > A03: Injection, A08: Software and Data Integrity Failures

## Repudiation

**Core question:** Can someone deny they performed an action?

### Common Patterns

- No audit logging for sensitive operations (payments, permission changes, data deletion)
- Logs that don't include actor identity (who did this?)
- Logs that can be modified or deleted by the actor
- Missing timestamps or using client-provided timestamps
- No confirmation for destructive actions

**What to check:**
- Are sensitive operations logged with: who, what, when, from where?
- Are logs tamper-proof (append-only, separate storage)?
- Can financial or legal actions be attributed to a specific user?
- Are there confirmation steps for irreversible actions?

## Information Disclosure

**Core question:** Can someone access data they shouldn't see?

### Common Patterns

**Direct access:**
- IDOR (Insecure Direct Object Reference) — accessing resources by guessing IDs
- Directory traversal (accessing files outside intended directory)
- Exposed admin/debug endpoints
- GraphQL introspection revealing full schema

**Indirect leakage:**
- Verbose error messages (stack traces, SQL queries, file paths)
- Timing differences revealing data existence (user enumeration)
- Different response codes for existing vs non-existing resources
- Source maps or debug info in production builds
- Sensitive data in URL parameters (logged by proxies, visible in history)

**What to check:**
- Can users access other users' data by changing IDs?
- Do error messages reveal internal structure?
- Are responses consistent regardless of data existence?
- Is sensitive data exposed in logs, URLs, or client code?

**See also:** `references/vulnerability-catalog.md` > A01: Broken Access Control (IDOR)

## Denial of Service

**Core question:** Can someone make this unavailable?

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

**What to check:**
- Are endpoints rate-limited?
- Can a single request consume disproportionate resources?
- Are queries bounded (LIMIT, pagination limits)?
- Can uploads/inputs exhaust storage or memory?

**See also:** `references/vulnerability-catalog.md` > A06: Vulnerable and Outdated Components (ReDoS)

## Elevation of Privilege

**Core question:** Can someone gain access beyond their authorization level?

### Common Patterns

- Mass assignment allowing role changes
- Missing authorization checks on admin endpoints
- Default admin credentials
- Privilege inheritance (child resource inherits parent's higher privilege)
- Token scope escalation (requesting more permissions than granted)
- Path traversal from restricted to unrestricted areas
- Server-side request forgery accessing internal services

**What to check:**
- Are all admin/privileged endpoints explicitly checking authorization?
- Can users modify their own role or permissions?
- Are there default credentials anywhere?
- Can a low-privilege action lead to high-privilege access?

**See also:** `references/vulnerability-catalog.md` > A01: Broken Access Control (Privilege Escalation, Mass Assignment)

## Application Type Quick Reference

### REST APIs
Focus on: Injection (T), IDOR (I), Missing auth (S), Mass assignment (E), Rate limiting (D)

### Single Page Applications
Focus on: XSS (T), Token storage (S), Source exposure (I), Client-side auth bypass (E)

### Webhook Receivers
Focus on: Signature verification (S), Replay attacks (S), Payload injection (T)

### File Processing
Focus on: Path traversal (T/I), Upload size (D), Type validation (T), Storage access (I)

### Payment Systems
Focus on: Price tampering (T), Race conditions (T), Audit logging (R), Idempotency (T)

### Multi-tenant Applications
Focus on: Tenant isolation (I/E), Cross-tenant access (I), Shared resource exhaustion (D)

### Django Applications
Focus on: CSRF (T), IDOR (I), Missing `@login_required` (S), DEBUG=True (I), Mass assignment via ModelForm (E), Unbounded QuerySets (D)

### Flask Applications
Focus on: Missing auth decorators (S), SQL injection via raw queries (T), Debug mode (I), CORS misconfiguration (I), Rate limiting (D)

### FastAPI Applications
Focus on: Missing `Depends()` auth (S), Pydantic bypass (T), CORS middleware config (I), Rate limiting (D)
