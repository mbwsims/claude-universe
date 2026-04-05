# Test Architecture

Decision framework for choosing between unit tests, integration tests, or both — based on
the type of code being tested.

## Decision Framework

Ask: **Where does this code's complexity live?**

- In the LOGIC (transformations, calculations, decisions) → **Unit test**
- In the INTERACTION with external systems (database, API, filesystem) → **Integration test**
- In BOTH → **Both, with clear separation**

## Code Archetypes

### Pure Functions (transformers, validators, formatters, calculators)

**Test approach:** Unit tests only. No mocks needed.

**Why:** Pure functions have no side effects and no external dependencies. Input goes in,
output comes out. Test the mapping directly.

**Mock boundary:** None. If a pure function imports another pure function, test through
the real call — don't mock internal utilities.

**Example structure:**
```
describe("calculateDiscount", () => {
  test("applies 20% for gold members", () => { ... })
  test("applies 10% for silver members", () => { ... })
  test("returns 0 for unknown tier", () => { ... })
  test("throws for negative price", () => { ... })
  test("handles zero price", () => { ... })
})
```

### Stateful Services (repositories, caches, state machines)

**Test approach:** Integration preferred. Test with real state storage.

**Why:** The value of these services IS the state management. Mocking the storage layer
tests nothing — you're just verifying your mock works.

**Mock boundary:** Mock external services that the state layer connects to (e.g., a remote
cache server), but use real in-memory or test-database storage.

**Example structure:**
```
describe("UserRepository", () => {
  let db: TestDatabase

  beforeEach(async () => {
    db = await createTestDatabase()
  })

  afterEach(async () => {
    await db.cleanup()
  })

  test("creates and retrieves user", async () => { ... })
  test("returns null for non-existent user", async () => { ... })
  test("updates existing user", async () => { ... })
  test("throws on duplicate email", async () => { ... })
})
```

### API Route Handlers

**Test approach:** Integration test the full request/response cycle.

**Why:** The handler's job is to connect HTTP to business logic. Testing the handler in
isolation (mocking the request, mocking the business logic) tests nothing real. Send a
real HTTP request and verify the real response.

**Mock boundary:** Mock external services the handler calls (payment APIs, email services).
Do NOT mock the database if possible — use a test database.

**Example structure:**
```
describe("POST /api/users", () => {
  test("creates user and returns 201", async () => {
    const response = await app.request("/api/users", {
      method: "POST",
      body: JSON.stringify({ email: "alice@example.com", name: "Alice" }),
    })
    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ id: expect.any(String) })
  })

  test("returns 400 for missing email", async () => { ... })
  test("returns 409 for duplicate email", async () => { ... })
  test("returns 401 without auth token", async () => { ... })
})
```

### UI Components (React, Vue, Svelte, etc.)

**Test approach:** Test user-visible behavior. Render + interact + assert on DOM.

**Why:** Users don't care about component internals, state management, or lifecycle hooks.
They care about what they SEE and what happens when they CLICK.

**Mock boundary:** Mock API calls and external services. Do NOT mock child components
(test the composed behavior), hooks, or state management — test through the real render.

**Example structure:**
```
describe("LoginForm", () => {
  test("shows error message for invalid email", async () => {
    render(<LoginForm />)
    await userEvent.type(screen.getByRole("textbox", { name: /email/i }), "invalid")
    await userEvent.click(screen.getByRole("button", { name: /submit/i }))
    expect(screen.getByText("Please enter a valid email")).toBeInTheDocument()
  })

  test("calls onSubmit with email and password", async () => { ... })
  test("disables button while submitting", async () => { ... })
})
```

### Event-Driven Code (pub/sub, webhooks, message handlers)

**Test approach:** Test the handler function directly with crafted events.

**Why:** The event transport (Kafka, SQS, webhook delivery) is infrastructure. The handler
logic is your code. Test the handler with realistic event payloads.

**Mock boundary:** Mock the transport/infrastructure. Use real event payloads (copy from
production or documentation).

### Middleware / Interceptors

**Test approach:** Test through the full chain, not in isolation.

**Why:** Middleware exists to transform requests/responses in a pipeline. Testing one
middleware in isolation misses ordering bugs and interaction effects.

**Mock boundary:** Mock the final handler that the middleware chain protects. Verify the
middleware chain produces the expected request transformations and response modifications.

### GraphQL Resolvers

**Test approach:** Test resolvers as functions with parent, args, and context. For complex
queries, integration test through the full GraphQL schema.

**Why:** Resolvers are the business logic layer of a GraphQL API. Testing through HTTP adds
unnecessary complexity -- test the resolver function directly for unit tests, and use
`graphql()` for integration tests of query composition.

**Mock boundary:** Mock data sources in context (database, REST APIs). For integration tests,
use a real schema with test data sources.

**Example structure:**
```
describe("User resolver", () => {
  test("resolves user by ID", async () => {
    const user = await resolvers.Query.user(
      null,
      { id: "123" },
      { dataSources: { users: mockUserDS } }
    )
    expect(user).toEqual({ id: "123", name: "Alice", email: "alice@example.com" })
  })

  test("returns null for non-existent user", async () => {
    const user = await resolvers.Query.user(
      null,
      { id: "nonexistent" },
      { dataSources: { users: mockUserDS } }
    )
    expect(user).toBeNull()
  })

  test("nested field resolver loads related data", async () => {
    const result = await graphql({
      schema,
      source: '{ user(id: "123") { name posts { title } } }',
      contextValue: { dataSources: testSources },
    })
    expect(result.errors).toBeUndefined()
    expect(result.data.user.posts).toHaveLength(2)
    expect(result.data.user.posts[0].title).toBe("First Post")
  })

  test("authorization check on admin-only field", async () => {
    const result = await graphql({
      schema,
      source: '{ user(id: "123") { email secretField } }',
      contextValue: { dataSources: testSources, viewer: regularUser },
    })
    expect(result.errors[0].message).toContain("Not authorized")
  })
})
```

### CLI Commands

**Test approach:** Test the command handler with parsed arguments.

**Why:** Argument parsing is the framework's job. The handler logic is yours. Test with
various argument combinations and verify output + side effects.

**Mock boundary:** Mock filesystem operations and network calls. Use real argument objects.

**Example structure:**
```
describe("deploy command", () => {
  test("deploys to staging with default options", async () => {
    const output = await runCommand("deploy", { env: "staging" })
    expect(output.exitCode).toBe(0)
    expect(output.stdout).toContain("Deployed to staging")
  })

  test("rejects unknown environment", async () => {
    const output = await runCommand("deploy", { env: "invalid" })
    expect(output.exitCode).toBe(1)
    expect(output.stderr).toContain("Unknown environment: invalid")
  })

  test("requires --force for production deploy", async () => {
    const output = await runCommand("deploy", { env: "production" })
    expect(output.exitCode).toBe(1)
    expect(output.stderr).toContain("Use --force for production")
  })

  test("dry-run prints plan without deploying", async () => {
    const output = await runCommand("deploy", { env: "staging", dryRun: true })
    expect(output.stdout).toContain("DRY RUN")
    expect(mockDeploy).not.toHaveBeenCalled()
  })
})
```

## When to Write Both Unit and Integration Tests

Write BOTH when:
- The function has complex internal logic AND external interactions
- The unit tests verify the logic, the integration tests verify the wiring
- Example: a service that calculates a complex price AND saves it to a database — unit
  test the calculation, integration test the save

Write ONLY unit tests when:
- Pure logic with no external dependencies
- The function is a leaf node (nothing else depends on it)

Write ONLY integration tests when:
- The code is pure wiring (minimal logic, mostly delegation)
- Testing in isolation would require mocking so much that the test proves nothing
