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

## Denial of Service

**Core question:** Can someone make this unavailable?

### Common Patterns

**Application-level:**
- No rate limiting on any endpoint
- Expensive operations triggered by cheap requests (search with complex regex)
- Unbounded queries (SELECT * without LIMIT)
- Resource exhaustion (unlimited file uploads, unbounded pagination)
- Regular expression denial of service (ReDoS)

**Infrastructure-level:**
- Single points of failure
- No connection pooling (database connection exhaustion)
- Synchronous operations blocking event loop
- Memory leaks from accumulating state

**What to check:**
- Are endpoints rate-limited?
- Can a single request consume disproportionate resources?
- Are queries bounded (LIMIT, pagination limits)?
- Can uploads/inputs exhaust storage or memory?

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
