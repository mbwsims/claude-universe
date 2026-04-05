# Input Space Analysis

Systematic decomposition of input spaces by data type. For each parameter of the function
under test, enumerate applicable categories from the relevant type section below.

## Strings

| Category | Test Values |
|----------|-------------|
| Canonical | Valid, typical input: `"alice@example.com"`, `"Hello world"` |
| Empty | `""` (empty string) |
| Whitespace | `" "`, `"\t"`, `"\n"`, `"  alice  "` (leading/trailing) |
| Single character | `"a"` — minimum meaningful input |
| Very long | `"a".repeat(10000)` — exceeds expected max length |
| At length boundary | If max is 255: test 254, 255, 256 |
| Unicode | `"日本語"`, `"émojis 🎉"`, `"مرحبا"` (RTL text) |
| Special characters | `"O'Brien"`, `"<script>alert(1)</script>"`, `"Robert'; DROP TABLE users;--"` |
| Format-specific | Email: missing @, double @, no domain. URL: no protocol, spaces. UUID: wrong format |
| Null bytes | `"hello\x00world"` — can break C-backed parsers |
| Newlines | `"line1\nline2"` — affects single-line assumptions |

## Numbers

| Category | Test Values |
|----------|-------------|
| Canonical | Typical valid number: `42`, `99.99` |
| Zero | `0` — often a boundary that triggers different behavior |
| Negative | `-1`, `-100` — if positive expected |
| Negative zero | `-0` — `Object.is(-0, 0)` is false in JS |
| Float precision | `0.1 + 0.2` — floating point comparison issues |
| Very large | `Number.MAX_SAFE_INTEGER`, `2^53 + 1`, `Infinity` |
| Very small | `Number.MIN_SAFE_INTEGER`, `-Infinity` |
| NaN | `NaN` — `NaN !== NaN`, propagates through arithmetic |
| Non-integer | `3.14` when integer expected |
| String number | `"42"` — implicit coercion in dynamic languages |

## Arrays

| Category | Test Values |
|----------|-------------|
| Canonical | `[1, 2, 3]` — typical populated array |
| Empty | `[]` — triggers different code paths frequently |
| Single element | `[1]` — off-by-one in iteration logic |
| Large | Array of 10,000+ elements — performance/memory |
| Contains nulls | `[1, null, 3]` — breaks `.map()` without null checks |
| Contains undefined | `[1, undefined, 3]` — different from null in JS |
| Duplicates | `[1, 1, 1]` — affects uniqueness assumptions |
| Unsorted | `[3, 1, 2]` — if sorted input assumed |
| Already sorted | When testing sort functions |
| Nested arrays | `[[1, 2], [3, 4]]` — depth handling |
| Mixed types | `[1, "two", true]` — if typed array expected |

## Objects

| Category | Test Values |
|----------|-------------|
| Canonical | `{ name: "Alice", email: "a@b.com" }` — all required fields |
| Empty | `{}` — missing all required fields |
| Missing required key | `{ name: "Alice" }` — email missing |
| Extra unexpected keys | `{ name: "Alice", email: "a@b.com", admin: true }` |
| Null values | `{ name: null, email: "a@b.com" }` |
| Wrong value types | `{ name: 123, email: true }` |
| Deeply nested nulls | `{ user: { profile: null } }` — accessing `.user.profile.name` |
| Circular reference | `const obj = {}; obj.self = obj;` — breaks JSON.stringify |
| Prototype pollution | `{ "__proto__": { "admin": true } }` |

## Booleans

| Category | Test Values |
|----------|-------------|
| True | `true` |
| False | `false` — often the under-tested case |
| Truthy non-boolean | `1`, `"true"`, `[]` — if strict boolean expected |
| Falsy non-boolean | `0`, `""`, `null`, `undefined` |

## Dates

| Category | Test Values |
|----------|-------------|
| Canonical | Valid recent date |
| Epoch | `new Date(0)` -- January 1, 1970 |
| Far future | `new Date("9999-12-31")` -- overflow potential |
| Far past | `new Date("0001-01-01")` |
| Invalid date | `new Date("not-a-date")` -- produces `Invalid Date` |
| Timezone boundary | Midnight UTC vs local time -- a date that is "today" in one timezone and "yesterday" in another |
| DST spring forward | `2024-03-10T02:30:00` US Eastern -- this time does not exist (clocks skip from 2:00 to 3:00). Functions computing duration across this boundary lose an hour. |
| DST fall back | `2024-11-03T01:30:00` US Eastern -- this time occurs TWICE. Ambiguous without explicit offset. |
| Leap year | February 29 on leap year, invalid Feb 29 on non-leap year |
| Leap second | `2016-12-31T23:59:60Z` -- most parsers reject this but some APIs return it |
| ISO string vs Date object | `"2024-01-15"` vs `new Date("2024-01-15")` |

## Async Code

| Category | Test Scenario |
|----------|--------------|
| Resolves normally | Await completes with expected value |
| Rejects with error | Promise rejects — assert specific error |
| Throws (not rejects) | Synchronous throw before async operation |
| Timeout | Operation exceeds time limit |
| Cancellation | Request cancelled mid-flight (AbortController) |
| Concurrent calls | Two calls to same resource simultaneously |
| Sequential dependency | Second call depends on first completing |
| Retry after failure | First call fails, retry succeeds |
| Double resolve | Promise resolved twice (should be no-op) |

## Files / Buffers

| Category | Test Values |
|----------|-------------|
| Canonical | Valid file of expected type and reasonable size |
| Empty file | 0-byte file or empty Buffer -- triggers different code paths |
| Very large | File exceeding expected max size (e.g., 100MB+) -- memory/performance |
| Wrong type | PDF when image expected, text when binary expected |
| Corrupted | Valid header but truncated or corrupted body |
| Malicious filename | `../../etc/passwd`, `file.jpg.exe`, `file\x00.txt` |
| Binary with BOM | UTF-8 BOM (`\xEF\xBB\xBF`) at start -- breaks naive text parsing |
| No extension | File without extension -- type detection from content |
| Symlink | Symlink to valid file, symlink to missing file, circular symlink |
| Permissions | File exists but is not readable (EACCES) |

## Stateful Code

| Category | Test Scenario |
|----------|--------------|
| Initial state | Behavior on fresh instance, no prior mutations |
| After single mutation | State after one valid change |
| After multiple mutations | Accumulated state after sequence of changes |
| Double mutation | Same mutation applied twice (idempotency) |
| Invalid state transition | Mutation that's not allowed in current state |
| Reset/clear | Returning to initial state |
| Concurrent mutations | Two mutations to same state simultaneously |
| Read after write | Consistency of reads after mutations |

## Choosing Categories

Not every category applies to every parameter. Use this filter:

1. **Always test**: canonical, empty/zero, null/undefined, one error path
2. **Test if applicable**: boundary (when thresholds exist), invalid type (dynamic languages),
   adversarial (user-facing input)
3. **Test if suspicious**: combinatorial (multiple optional params), format-specific (structured
   strings), concurrent (shared state)
4. **Skip if irrelevant**: don't test float precision for a function that takes an ID string

Mark each row in the input space table with priority: **must**, **should**, or **nice-to-have**.
