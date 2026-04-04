# Security Review Checklist

Quick-reference checklist organized by code area. For each area, check every item.
Mark as PASS, FAIL, or N/A.

## Authentication

- [ ] Every API route/handler checks authentication
- [ ] Auth check is the FIRST operation (before any data access)
- [ ] Tokens have expiry set
- [ ] Sessions regenerate after login
- [ ] Logout actually invalidates the session/token
- [ ] Password reset tokens are single-use and expire
- [ ] Failed login attempts are rate-limited
- [ ] Auth errors don't differentiate "user not found" vs "wrong password"

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
- [ ] CSRF protection on state-changing endpoints
- [ ] Session data stored server-side (not in cookies)

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
