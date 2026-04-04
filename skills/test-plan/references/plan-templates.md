# Plan Templates

Pre-filled input space templates by code archetype. Use these as starting points — add
or remove rows based on the specific function's contract.

## Template: Validator Function

For functions that validate input and return boolean/error.

| Category | Input | Expected | Priority |
|----------|-------|----------|----------|
| Valid complete | All required fields, correct types | passes / returns true | must |
| Valid minimal | Only required fields, no optional | passes | must |
| Missing required field | One required field omitted | specific error for that field | must |
| Empty string field | Required string is `""` | error — empty not accepted | must |
| Null field | Required field is `null` | error — null not accepted | must |
| Wrong type | Number where string expected | type error | should |
| Too long | String exceeds max length | length error | should |
| Too short | String below min length | length error | should |
| Special characters | `<script>`, `'; DROP TABLE` | sanitized or rejected | should |
| Extra fields | Unknown fields in object | ignored or rejected | nice |

## Template: CRUD Create Function

For functions that create a new record in a data store.

| Category | Input | Expected | Priority |
|----------|-------|----------|----------|
| Valid create | Complete valid input | new record returned with ID | must |
| Duplicate key | Input with existing unique value | conflict error | must |
| Missing required | Required field omitted | validation error | must |
| Empty string | Required string is `""` | validation error | must |
| Null value | Required field is `null` | validation error | must |
| Invalid reference | Foreign key to non-existent record | reference error | should |
| Concurrent create | Two creates with same unique value | one succeeds, one fails | should |
| Max field length | Value at max length boundary | succeeds or length error | should |
| Created record shape | After create, read back the record | matches expected shape | must |

## Template: CRUD Read/Query Function

For functions that retrieve records, possibly with filtering/pagination.

| Category | Input | Expected | Priority |
|----------|-------|----------|----------|
| Existing record | Valid ID of existing record | record returned | must |
| Non-existent | ID that doesn't exist | null or not-found error | must |
| List all | No filters | all records returned | must |
| Filter match | Filter matching some records | correct subset | must |
| Filter no match | Filter matching nothing | empty array, not error | must |
| Empty string filter | Filter is `""` | all results or error? | should |
| Pagination first page | page=1, limit=10 | first 10 items | should |
| Pagination last page | Last page | fewer than limit items | should |
| Pagination past end | Page beyond data | empty array | should |
| Sort ascending | Sort by field ASC | correct order | should |
| Sort descending | Sort by field DESC | reverse order | should |

## Template: CRUD Update Function

| Category | Input | Expected | Priority |
|----------|-------|----------|----------|
| Valid update | Existing record + valid changes | updated record returned | must |
| Non-existent record | Update record that doesn't exist | not-found error | must |
| No changes | Update with same values | succeeds, no error | must |
| Partial update | Only some fields provided | unchanged fields preserved | must |
| Invalid field value | Update with invalid data | validation error, no change | must |
| Concurrent update | Two updates to same record | last write wins or conflict | should |
| Update unique to duplicate | Change unique field to existing value | conflict error | should |

## Template: CRUD Delete Function

| Category | Input | Expected | Priority |
|----------|-------|----------|----------|
| Valid delete | Existing record ID | record removed, confirmation | must |
| Non-existent | Delete record that doesn't exist | not-found error or no-op | must |
| Double delete | Delete same record twice | second is not-found or no-op | must |
| Cascade check | Delete record with dependent records | cascade or foreign key error | should |
| Verify deletion | Read after delete | not found | must |

## Template: API Route Handler

| Category | Input | Expected | Priority |
|----------|-------|----------|----------|
| Valid request | Correct method + headers + body | 200/201 + response body | must |
| No auth | Missing authentication | 401 | must |
| Invalid auth | Malformed or expired token | 401 | must |
| Wrong role | Valid auth, insufficient permissions | 403 | should |
| Missing body | Required request body omitted | 400 | must |
| Invalid body | Malformed or wrong-typed body | 400 | must |
| Not found | Valid request for non-existent resource | 404 | must |
| Wrong method | GET to POST-only endpoint | 405 | nice |
| Server error | Internal failure (mock dependency error) | 500 + error response | should |

## Template: Pure Transformer Function

For functions that transform input to output with no side effects.

| Category | Input | Expected | Priority |
|----------|-------|----------|----------|
| Typical input | Normal, representative input | correct transformation | must |
| Empty input | Empty string/array/object | empty output or error | must |
| Single element | Minimal non-empty input | correct transformation | must |
| Large input | Many elements/long string | correct + reasonable performance | should |
| Special values | Nulls, NaN, Infinity, -0 | handled without crash | should |
| Idempotent check | Apply twice | same result as once | nice |

## Template: State Machine

| Category | Input | Expected | Priority |
|----------|-------|----------|----------|
| Initial state | Check state before any transitions | correct initial state | must |
| Valid transition | Trigger valid state change | new state + any effects | must |
| Invalid transition | Trigger change not allowed in current state | error, state unchanged | must |
| Full lifecycle | Walk through complete state sequence | all transitions work | must |
| Double transition | Same valid transition twice | second succeeds or idempotent | should |
| Reset | Return to initial state from any state | clean initial state | should |
| Concurrent transitions | Two transitions on same instance | serialized correctly | nice |
