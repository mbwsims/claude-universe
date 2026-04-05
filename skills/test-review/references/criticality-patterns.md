# Criticality Patterns

Classification system for source file criticality. Used to weight test quality priorities
— critical code with weak tests is a bigger problem than utility code with weak tests.

## Criticality Levels

### Critical — Test quality floor: A or B

Code where bugs cause security breaches, data loss, financial errors, or system-wide
failures. These files MUST have thorough tests.

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

**Keyword detection in filenames:**
`auth`, `login`, `session`, `token`, `payment`, `billing`, `checkout`, `charge`,
`security`, `permission`, `access`, `middleware`, `migration`, `password`,
`credential`, `secret`, `encrypt`, `decrypt`, `hash`, `webhook`, `admin`

**What makes it critical:**
- Bugs here have outsized blast radius (affect all users, expose data, lose money)
- These paths are targeted by attackers
- Failures are often not caught by manual testing
- Rollback is difficult or impossible (migrations, payments)

### Important — Test quality floor: B

Core business logic where bugs cause incorrect behavior, data inconsistency, or user-facing
errors. Tests should be solid but don't need the exhaustive coverage of critical code.

**File path patterns:**
- `**/service**`, `**/controller**`, `**/handler**`, `**/resolver**`
- `**/repository**`, `**/store**`, `**/model**`
- `**/api/**`, `**/route**`, `**/endpoint**`
- `**/database/**`, `**/db/**`, `**/query**`
- `**/cache**`
- `**/queue**`, `**/worker**`, `**/job**`
- `**/validator**`, `**/schema**`

**Keyword detection in filenames:**
`service`, `controller`, `handler`, `resolver`, `repository`, `store`, `model`,
`api`, `route`, `endpoint`, `database`, `db`, `query`, `cache`, `queue`, `worker`,
`job`, `validator`, `schema`

**What makes it important:**
- Core business rules live here
- Bugs cause incorrect data or broken workflows
- These are the files that change most frequently

### Standard — Test quality floor: C

Utility code, helpers, formatters, and configuration. Bugs here cause inconvenience but
not data loss or security issues. Adequate testing is fine.

**File path patterns:**
- `**/util**`, `**/helper**`, `**/format**`, `**/convert**`
- `**/config**`, `**/constant**`, `**/type**`
- `**/logger**`, `**/error**` (error class definitions, not error handling)
- `**/fixture**`, `**/seed**`, `**/mock**` (test support files)

**What makes it standard:**
- Limited blast radius
- Failures are obvious and easy to fix
- Often pure functions with predictable behavior

## Handling Ambiguous Cases

When a file matches multiple patterns or is unclear:

1. **Check the imports and exports.** If the file imports auth/payment modules and processes
   their data, treat it as the higher criticality level.

2. **Check the error handling.** If the file has security-sensitive error handling (hiding
   internal errors from users, validating tokens), lean toward critical.

3. **Check side effects.** Files that write to databases, send emails, or modify permissions
   are more critical than read-only code.

4. **When in doubt, go one level higher.** It's better to flag a false positive (marking
   a standard file as important) than to miss a critical gap.

## Examples

### Critical code with weak tests — flag as priority gap

```
auth.service.test.ts — Grade: C
- 5 shallow assertions (toBeDefined on token values)
- 0 error tests for 4 throwable operations (invalid token, expired session, etc.)
- This is CRITICAL code: authentication bypass bugs are security vulnerabilities
```

### Utility code with adequate tests — acceptable

```
format-date.test.ts — Grade: C+
- 2 shallow assertions, rest are deep
- Happy path + one edge case (invalid date)
- This is STANDARD code: formatting bugs are cosmetic, not critical
```

### Important code with good tests — no action needed

```
user.service.test.ts — Grade: B+
- Deep assertions on all return values
- Error tests for validation failures
- This is IMPORTANT code and meets the B floor — no gap
```
