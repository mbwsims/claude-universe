# Assertion Depth

Catalog of shallow-to-deep assertion upgrades. For each assertion type, the shallow version
is what Claude writes by default. The deep version is what catches real bugs.

## Primitive Return Values

**Shallow:**
```
expect(result).toBeDefined()
expect(result).toBeTruthy()
```

**Why it's shallow:** Passes for ANY non-null value. If the function returns `"error"` instead
of `"success"`, or `0` instead of `42`, the test still passes.

**Deep:**
```
expect(result).toBe(42)
expect(result).toBe("success")
```

## Object Return Values

**Shallow:**
```
expect(user).toBeDefined()
expect(user).toHaveProperty("name")
```

**Why it's shallow:** Passes if user has wrong name, missing fields, or extra unexpected fields.

**Deep:**
```
expect(user).toEqual({
  id: expect.any(String),
  name: "Alice",
  email: "alice@example.com",
  role: "member",
  createdAt: expect.any(Date),
})
```

**When to use `toMatchObject` vs `toEqual`:**
- `toEqual`: Assert the EXACT shape — no extra fields allowed. Use when the contract specifies
  a precise return shape.
- `toMatchObject`: Assert a SUBSET — extra fields are OK. Use when testing a specific aspect
  of a larger object.

## Array Return Values

**Shallow:**
```
expect(results).toHaveLength(3)
```

**Why it's shallow:** Passes if the array has 3 completely wrong items.

**Deep:**
```
expect(results).toHaveLength(3)
expect(results).toEqual([
  expect.objectContaining({ id: "1", name: "Alice" }),
  expect.objectContaining({ id: "2", name: "Bob" }),
  expect.objectContaining({ id: "3", name: "Carol" }),
])
```

**For unordered results:**
```
expect(results).toHaveLength(3)
expect(results).toEqual(expect.arrayContaining([
  expect.objectContaining({ name: "Alice" }),
  expect.objectContaining({ name: "Bob" }),
]))
```

## Error Assertions

**Shallow:**
```
expect(() => fn()).toThrow()
await expect(fn()).rejects.toThrow()
```

**Why it's shallow:** Passes for ANY error. If the function throws a generic `Error` instead
of `ValidationError`, or throws "Internal error" instead of "Email is required", the test
still passes. You would not catch a regression where the error message changes or the
wrong error type is thrown.

**Deep:**
```
expect(() => fn()).toThrow(ValidationError)
expect(() => fn()).toThrow("Email is required")

// For async:
await expect(fn()).rejects.toThrow(ValidationError)
await expect(fn()).rejects.toThrow("Email is required")

// For error properties:
try {
  await fn()
  expect.unreachable("Should have thrown")
} catch (err) {
  expect(err).toBeInstanceOf(ValidationError)
  expect(err.message).toBe("Email is required")
  expect(err.field).toBe("email")
  expect(err.code).toBe("REQUIRED")
}
```

## Side Effect Assertions

**Shallow:**
```
expect(mockDb.save).toHaveBeenCalled()
```

**Why it's shallow:** Only proves the function was called. Doesn't verify it was called
with the right arguments, the right number of times, or that the save actually persisted
the right data.

**Deep (with mock):**
```
expect(mockDb.save).toHaveBeenCalledTimes(1)
expect(mockDb.save).toHaveBeenCalledWith({
  email: "alice@example.com",
  name: "Alice",
  role: "member",
})
```

**Deep (with real dependency — preferred):**
```
await createUser({ email: "alice@example.com", name: "Alice" })

const saved = await db.users.findByEmail("alice@example.com")
expect(saved).toEqual(expect.objectContaining({
  email: "alice@example.com",
  name: "Alice",
  role: "member",
}))
```

## Promise / Async Assertions

**Shallow:**
```
const result = await fn()
expect(result).toBeDefined()
```

**Deep:**
```
const result = await fn()
expect(result).toEqual(expectedValue)

// Rejection:
await expect(fn()).rejects.toThrow(SpecificError)
await expect(fn()).rejects.toThrow("specific message")
```

## Boolean Return Values

**Shallow:**
```
expect(isValid).toBeTruthy()
```

**Why it's shallow:** `toBeTruthy()` passes for `1`, `"yes"`, `[]`, or any truthy value.
If the function should return exactly `true`, this doesn't verify that.

**Deep:**
```
expect(isValid).toBe(true)
expect(isExpired).toBe(false)
```

## HTTP Response Assertions

**Shallow:**
```
expect(response.status).toBe(200)
```

**Why it's shallow:** A 200 with the wrong body, wrong content-type, or missing headers
still passes.

**Deep:**
```
expect(response.status).toBe(200)
expect(response.headers.get("content-type")).toBe("application/json")
expect(await response.json()).toEqual({
  user: { id: expect.any(String), name: "Alice" },
})
```

**For error responses:**
```
expect(response.status).toBe(400)
expect(await response.json()).toEqual({
  error: "Email is required",
})
```

## The Assertion Depth Checklist

Before finalizing any test, check:

1. **Could this assertion pass with a completely wrong value?** If yes, deepen it.
2. **Am I asserting existence or correctness?** `toBeDefined()` is existence. `toEqual(expected)` is correctness.
3. **Am I asserting on the right thing?** Assert on the RETURN VALUE or OBSERVABLE EFFECT, not on internal method calls.
4. **For errors: am I asserting the specific error?** Both type AND message.
5. **For side effects: am I verifying the actual outcome?** Read back from the real (or mocked) store, don't just check that a write method was called.
