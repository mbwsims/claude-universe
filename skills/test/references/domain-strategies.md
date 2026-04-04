# Domain-Specific Testing Strategies

Non-obvious testing strategies for common domains. Standard input space analysis covers
most cases, but these domains have specific patterns that require targeted approaches.

## Authentication & Authorization

**Beyond happy path — test the security boundaries:**

| Scenario | What to test |
|----------|-------------|
| No token | Request without any auth header → 401 |
| Invalid token | Malformed, expired, wrong signing key → 401 |
| Expired token | Token that was valid but is now past expiry → 401 |
| Valid token, wrong role | Authenticated but not authorized → 403 |
| Valid token, correct role | Authorized → 200 + correct data |
| Token for deleted user | User removed after token issued → 401 |
| Role escalation | User modifies their own role field → 403 or ignored |

**Common mistake:** Only testing "with auth" and "without auth." The boundary between
valid and invalid tokens is where security bugs live.

**Mock boundary:** Mock the token verification library's key/secret, but test the actual
verification flow. Don't mock `verifyToken()` itself — that defeats the purpose.

## Pagination

**Beyond first page — test the boundaries:**

| Scenario | What to test |
|----------|-------------|
| First page | Default params → correct items and metadata |
| Middle page | page=3 → correct offset, correct items |
| Last page | Final page → fewer items than page size, no next page |
| Past the end | page=999 → empty results, not error |
| Page size = 0 | → error or default page size? |
| Page size = 1 | → one item per page, correct total pages |
| Page size > total | → all items on one page |
| Negative page | page=-1 → error |
| Non-integer page | page=1.5 → error or floor? |
| Cursor-based | Cursor from page 2 after item deleted → no skip/duplicate |

**Common mistake:** Only testing page 1 with default size.

## Search & Filtering

| Scenario | What to test |
|----------|-------------|
| Exact match | Known item by exact name → found |
| Partial match | Substring search → correct matches |
| No results | Search term that matches nothing → empty array, not error |
| Empty query | Empty or whitespace search → all results or error? |
| Special characters | Search for `O'Brien` or `<script>` → handled safely |
| Case sensitivity | Search "alice" vs "Alice" vs "ALICE" → consistent behavior |
| Multiple filters | Combined filters → AND/OR logic correct |
| Filter on missing field | Filter by field that some records don't have |
| Sort + search | Combined search and sort → correct order within results |

**Common mistake:** Only testing that search returns results. Not testing what happens
when it returns nothing, or when the query contains special characters.

## File Upload

| Scenario | What to test |
|----------|-------------|
| Valid file | Correct type and size → upload succeeds |
| Empty file | 0 bytes → error with clear message |
| Oversized file | Beyond max size → 413 or validation error |
| Wrong MIME type | Image endpoint receives a PDF → rejected |
| Malicious filename | `../../etc/passwd` or `file.exe.jpg` → sanitized |
| Duplicate upload | Same file uploaded twice → idempotent or error? |
| Concurrent uploads | Two uploads simultaneously → both handled correctly |
| No file | Upload endpoint called without file attachment → 400 |

**Common mistake:** Testing only the success case. File upload is one of the most
attacked surfaces — test the rejection paths thoroughly.

## Webhooks

| Scenario | What to test |
|----------|-------------|
| Valid signature | Correct HMAC/signature → processed |
| Invalid signature | Wrong signature → 401, not processed |
| Missing signature | No signature header → 401 |
| Replay attack | Valid signature but old timestamp → rejected |
| Idempotency | Same event delivered twice → processed once |
| Unknown event type | Event type not in handler map → acknowledged, not error |
| Malformed payload | Valid signature but invalid JSON body → 400 |
| Out-of-order events | Event B arrives before Event A → handled correctly |

**Common mistake:** Only testing the happy path (valid signature + known event type).
Webhook endpoints are public-facing and must handle adversarial input.

## Rate Limiting

| Scenario | What to test |
|----------|-------------|
| Under limit | Normal request rate → all succeed |
| At limit | Exactly at threshold → last request succeeds |
| Over limit | One past threshold → 429 with retry-after header |
| Limit reset | Wait for window to expire → requests succeed again |
| Per-user isolation | User A at limit doesn't affect User B |
| Burst patterns | Many requests at once → correct counting |

**Common mistake:** Only testing "request succeeds" and never testing the actual limit
enforcement.

## Caching

| Scenario | What to test |
|----------|-------------|
| Cache miss | First request → fetches from source, caches result |
| Cache hit | Second request → returns cached, doesn't re-fetch |
| Cache invalidation | Data changes → cache cleared, next request re-fetches |
| Stale cache | Cache expired → re-fetches on next request |
| Cache stampede | Many concurrent misses → only one source fetch |
| Different cache keys | Different params → different cache entries |
| Cache with errors | Source fails → returns stale cache or error? |

**Common mistake:** Only testing that caching "works" (cache hit returns data). Not testing
invalidation, expiry, or behavior during source failures.

## Database Transactions

| Scenario | What to test |
|----------|-------------|
| All operations succeed | Transaction commits, all changes visible |
| Middle operation fails | Transaction rolls back, NO changes visible |
| Constraint violation | Unique constraint → rollback, clear error |
| Deadlock | Two transactions on same rows → one retries or fails gracefully |
| Nested transactions | Savepoints work correctly |
| Partial read | Read mid-transaction sees consistent state |

**Common mistake:** Only testing that the transaction "completes." Not testing rollback
behavior when something in the middle fails.
