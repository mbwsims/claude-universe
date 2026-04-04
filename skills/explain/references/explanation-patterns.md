# Explanation Patterns

How to explain different types of code effectively. The explanation should be tailored to
the archetype — a service needs different explanation than a utility or a configuration file.

## Service / Business Logic Module

**Focus on:** What business rules does it encode? What state does it manage? What are the
invariants (things that must always be true)?

**Key sections:**
- Business rules: "An order can only be cancelled within 24 hours of placement"
- State management: "Uses a transaction to ensure inventory and order are updated atomically"
- Error handling: "Throws OrderError for business rule violations, lets database errors propagate"
- Edge cases: "Handles partial fulfillment, but assumes all items are in the same warehouse"

## API Route / Handler

**Focus on:** What's the request/response contract? What auth is required? What validation
happens? What side effects occur?

**Key sections:**
- Contract: "POST /api/orders — creates an order, returns 201 with order object"
- Auth: "Requires authenticated user, checks ownership of cart"
- Validation: "Validates body with Zod schema, returns 400 on failure"
- Side effects: "Writes to orders table, decrements inventory, sends confirmation email"
- Error paths: "Returns 400 for invalid input, 404 for missing cart, 409 for out-of-stock"

## Utility / Helper Module

**Focus on:** Why does this utility exist? What edge cases does it handle? Are there
performance considerations?

**Key sections:**
- Raison d'etre: "Wraps native Date API to handle timezone conversion consistently"
- Edge cases handled: "Handles DST transitions, leap years, invalid date strings"
- Performance: "Caches parsed timezone data — safe for hot paths"
- Gotchas: "Returns UTC dates — callers must convert to local time"

## Configuration / Setup Module

**Focus on:** What is configured? What are the defaults? What happens if configuration
is wrong?

**Key sections:**
- What's configured: "Database connection, Redis cache, email transport"
- Environment dependencies: "Requires DATABASE_URL, REDIS_URL. EMAIL_API_KEY optional."
- Defaults: "Falls back to SQLite if DATABASE_URL not set (development only)"
- Failure modes: "Throws at startup if DATABASE_URL is invalid — fast failure"

## UI Component

**Focus on:** What user interaction does it handle? What state does it manage? What props
does it accept and what do they control?

**Key sections:**
- User interaction: "Drag-and-drop list reordering with optimistic updates"
- State: "Local state for drag position, server state via React Query"
- Props contract: "items (required), onReorder (callback), disabled (boolean)"
- Accessibility: "Keyboard reordering with arrow keys, aria-labels for screen readers"
- Gotchas: "onReorder fires on drop, not on drag — don't update server during drag"

## Database Migration / Schema

**Focus on:** What changed? Why? Is it reversible? What data was affected?

**Key sections:**
- What changed: "Added `status` column to orders table with default 'pending'"
- Why: "Supporting order lifecycle tracking for the new dashboard"
- Data impact: "Backfilled 12,000 existing orders with 'completed' status"
- Reversibility: "Column can be dropped, but backfilled data would be lost"
- Dependencies: "API handler in orders/route.ts now reads this column"

## Middleware / Interceptor

**Focus on:** What does it intercept? What does it modify? What's the ordering dependency?

**Key sections:**
- Purpose: "Rate limiting middleware for API routes"
- Intercepts: "All requests to /api/* before reaching handlers"
- Modifies: "Adds X-RateLimit-Remaining header, returns 429 if exceeded"
- Ordering: "Must run AFTER auth middleware (needs user ID for per-user limits)"
- Configuration: "Limits in config/rate-limits.ts, defaults to 100 req/min"
