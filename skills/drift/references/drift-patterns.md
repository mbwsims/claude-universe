# Drift Patterns

Common types of architectural drift with detection strategies.

## Drift Types

### Utility to Service

**What happened:** A module started as a pure utility (stateless functions, no side effects)
but gradually accumulated state, database calls, or external service dependencies.

**Detection signals:**
- Original version: zero imports from database/ORM/HTTP client libraries
- Current version: imports database, API clients, or state management
- Original exports: pure functions taking input, returning output
- Current exports: functions with side effects, async operations

**Example:** `src/lib/email.ts` started as `formatEmailTemplate(data)` → now includes
`sendEmail()`, `checkDeliveryStatus()`, `retryFailedEmails()` with SMTP client imports.

**Recommendation:** Extract the side-effect functions into a service module. Keep the
utility pure.

### Internal to Public

**What happened:** A module started as internal implementation detail but gained external
consumers over time, making it impossible to refactor without breaking other code.

**Detection signals:**
- Original: zero or few importers (leaf node)
- Current: many importers across different parts of the codebase
- Original: no explicit public API design (just internal helpers)
- Current: other modules depend on specific function signatures

**Example:** `src/lib/helpers.ts` was internal to one service → now imported by 15 files
across 4 directories.

**Recommendation:** Design a proper public API. Move internal helpers back to private scope.
Export only what external consumers actually need.

### Simple to God Module

**What happened:** A focused module became a catch-all that handles too many concerns.
New functionality was added here because "it's related" until the module does everything.

**Detection signals:**
- Original: single clear purpose, few exports (3-5)
- Current: many exports (10+), covering multiple concerns
- Export names span different domains (e.g., a "user" module that also handles auth,
  permissions, notifications, and billing)
- High import count — everything depends on it

**Example:** `src/services/user.ts` started with `createUser`, `getUser`, `updateUser` →
now includes `authenticateUser`, `checkPermissions`, `sendWelcomeEmail`,
`processSubscription`, `generateReport`.

**Recommendation:** Split by concern. Extract each domain into its own module. The god
module becomes a thin orchestrator or is eliminated entirely.

### Handler to Business Logic

**What happened:** A request handler or controller that should only handle HTTP
request/response grew to include business logic, validation, and data access inline.

**Detection signals:**
- Original: thin handler that delegates to services
- Current: handler contains conditionals, calculations, database queries, business rules
- Handler file is much larger than other handlers
- Logic in the handler can't be reused from other entry points (CLI, queue worker, etc.)

**Example:** `src/api/orders/route.ts` started as "parse request, call service, return
response" → now contains discount calculation, inventory checks, fraud detection, and
email notification inline.

**Recommendation:** Extract business logic into a service. Handler should only: parse
request, call service, format response.

### Layer Violation

**What happened:** A module crossed architectural boundaries — a utility became a service,
a data access layer started making HTTP calls, a frontend component began querying the
database directly.

**Detection signals:**
- Original version: imports only from its own architectural layer
- Current version: imports from a different layer (e.g., utility importing from services)
- Functions that belong in a different layer based on their behavior
- The module's name/path suggests one layer but its behavior is in another

**Example:** `src/utils/notifications.ts` started as `formatNotification(data)` and
`groupNotifications(list)` → now includes `sendPushNotification()`, `checkUserPreferences()`,
and `logNotificationEvent()` with database and HTTP client imports.

**Recommendation:** Move cross-layer functionality to the appropriate layer. The utility
should remain a utility; create a `NotificationService` for side-effect operations.

### Feature Flag Accumulation

**What happened:** Feature flags were added for gradual rollout but never cleaned up.
The code now has layers of conditional branches for features that are fully shipped.

**Detection signals:**
- Multiple `if (featureFlag.X)` or `if (config.enableY)` checks
- Some flagged features are clearly live (no "off" path in production config)
- Code paths behind flags that haven't changed in months (shipped and forgotten)

**Recommendation:** Audit flags. Remove flags for fully-shipped features. Document which
flags are still active rollouts vs permanently configurable.

## Detection Methodology

### Comparing Original vs Current

1. Find the earliest meaningful commit (skip initial scaffolding/boilerplate)
2. Read the file at that commit: count exports, imports, lines, responsibilities
3. Read the current file: same counts
4. Compare across 4 dimensions:
   - **Size growth:** >3x original size is significant
   - **Export growth:** >2x original exports suggests scope creep
   - **Import growth:** new categories of imports (database, HTTP, etc.) suggest layer drift
   - **Responsibility count:** list distinct concerns in both versions

### Quantifying Drift

| Metric | Minimal | Moderate | Significant |
|--------|---------|----------|-------------|
| Size growth | <2x | 2-4x | >4x |
| Export growth | <1.5x | 1.5-3x | >3x |
| New import categories | 0 | 1-2 | 3+ |
| New responsibilities | 0-1 | 2-3 | 4+ |

**Overall drift level:** Take the highest individual rating. One dimension at "significant"
makes the whole module "significant drift."

### When Drift is Acceptable

Not all drift is bad. Drift is acceptable when:
- The domain genuinely grew and the module is the right home for the new functionality
- The original design was too narrow and the expansion is a natural correction
- The module was intentionally designed to be extensible (plugin systems, middleware chains)

Drift is problematic when:
- The module is doing things that belong in other architectural layers
- It's impossible to understand the module's purpose from reading it
- Changes to one concern in the module risk breaking unrelated concerns
- The module can't be tested without mocking half the application

## Renamed File Guidance

When tracing drift, files may have been renamed during their history. Handle this:

1. Use `git log --follow -- {file}` to trace across renames
2. Use `git log --diff-filter=R --find-renames -- {file}` to find the rename commit
3. When comparing "original vs current," use the file at its earliest path, not its
   current path at that old commit (which won't exist)
4. Note the rename in the drift report — a rename often signals a purpose shift
5. If the file was renamed multiple times, each rename may represent a drift event
