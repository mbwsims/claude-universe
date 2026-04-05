---
name: trace
description: >-
  This skill should be used when the user asks to "trace a feature", "follow the data flow",
  "how does this feature work", "trace the request", "where does data flow", "walk me through
  this flow", "trace from entry to database", mentions "/trace", or wants to understand how a
  feature or request flows through the codebase from entry point to storage.
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - mcp__lenskit__lenskit_graph
  - mcp__lenskit__lenskit_analyze
argument-hint: "[feature-or-endpoint]"
---

# Trace Feature

Follow a feature from entry point through every layer of the codebase. Produces a visual
flow showing exactly how data moves: route → handler → service → database, with every
transformation, validation, and side effect along the way.

Understanding data flow is a prerequisite for safe changes. You cannot safely modify code
you don't understand.

## Workflow

### 0. Build the Dependency Graph

If `lenskit_graph` is available, call it FIRST to get the full project dependency graph.
Use this data throughout the trace to:
- Identify which files import from the current file (downstream impact)
- Spot circular dependencies in the trace path
- Verify layer classifications match your manual assessment
- Find hub files that the trace passes through (high-impact nodes)

This step takes seconds and saves minutes of manual grep work.

If `lenskit_graph` is unavailable, build the import chain manually: for each file in
the trace, use Grep to find `import.*from` statements and follow them forward. This is
slower but produces the same trace. Skip the hub/cycle annotations.

### 1. Identify the Entry Point

Find where the feature begins:
- **API endpoint**: The route handler (e.g., `POST /api/users`)
- **UI action**: The component event handler (e.g., button click -> fetch call)
- **Background job**: The job/worker entry function
- **CLI command**: The command handler
- **Event handler**: The subscriber/listener function (for event-driven/pub-sub systems)
- **Message consumer**: The queue consumer handler (for message-driven architectures)

If the user specified a feature name (e.g., "checkout"), find the entry point by grepping
for related routes, components, or handlers.

**For event-driven / pub-sub systems:** The entry point may not be an HTTP route. Look for:
- Event emitters: `emit('eventName', ...)`, `publish('topic', ...)`
- Event subscribers: `on('eventName', ...)`, `subscribe('topic', ...)`
- Message queue consumers: `consume('queue', handler)`, `@Listener('topic')`
- Trace BOTH the publisher side (what triggers the event) and the subscriber side
  (what reacts to it). Note the async boundary between them.

### 2. Trace Forward

Starting from the entry point, follow the execution path. At each step, document:

- **File and function**: Where execution moves to
- **Input**: What data arrives (params, body, context)
- **Transformation**: How data is modified (validation, mapping, enrichment)
- **Output**: What is returned or passed to the next step
- **Side effects**: Database writes, API calls, events emitted, files created

Read each file in the chain. Follow imports, function calls, and async operations.
Don't guess — read the actual code.

### 3. Identify Layers

As you trace, identify which architectural layer each step belongs to:

| Layer | Examples | Role |
|-------|----------|------|
| **Entry** | Route handler, controller, API gateway | Receives external input |
| **Validation** | Schema validation, auth checks, input parsing | Ensures input is safe and valid |
| **Business Logic** | Services, use cases, domain models | Core logic and decisions |
| **Data Access** | Repositories, ORM calls, query builders | Reads/writes persistent state |
| **External** | API clients, email services, queue publishers | Communicates with external systems |
| **Response** | Serializers, formatters, view models | Shapes output for the caller |

### 4. Note Observations

While tracing, flag:
- **Missing validation**: Input passes through without checks
- **Implicit dependencies**: Code that depends on global state, env vars, or side effects
- **Error handling gaps**: Operations that can fail but aren't wrapped in try/catch
- **Test coverage**: Whether each step in the flow has corresponding tests
- **Circular dependencies**: Module A imports B imports A

### 5. Present the Trace

**Report format:**

```
## Trace — {feature name}

### Flow Summary
{One-line description of the complete flow}

### Data Flow

Entry: {entry point}
  ↓ {what data}
Validation: {validation step}
  ↓ {validated data}
Logic: {business logic}
  ↓ {processed data}
Storage: {database/API call}
  ↓ {result}
Response: {what goes back to caller}

### Branches (if applicable)
- **Branch A: {condition}** -> {where it goes}
- **Branch B: {condition}** -> {where it goes}
- **Default path**: {which branch is the happy path}

### Detailed Steps

**Step 1: {file}:{function}** — {layer}
Input: {what comes in}
Does: {what happens}
Output: {what goes out}
Side effects: {any}

**Step 2: {file}:{function}** — {layer}
...

### Observations
{Missing validation, error handling gaps, test coverage, etc.}
```

The flow diagram should be scannable in 10 seconds. The detailed steps provide depth
when needed.

## Guidelines

- Read actual code. Don't infer or guess what a function does — read it.
- Follow the HAPPY PATH first, then note where error paths diverge.
- Include file paths and line numbers so the user can navigate directly.
- If the trace branches (e.g., different handlers for different input types), document
  the primary path and note the branches.
- Stop at system boundaries (database, external API, message queue). Don't trace into
  third-party libraries unless relevant.

## Related Skills

- **`/map`** — Understand overall architecture before tracing
- **`/impact`** — Check blast radius of modules in the trace
- **`/explain`** — Deep understanding of a layer you traced through

## Additional Resources

- **`references/layer-patterns.md`** — Common architectural layer patterns and how to
  identify them in different frameworks
