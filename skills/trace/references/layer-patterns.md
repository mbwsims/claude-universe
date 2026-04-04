# Layer Patterns

How to identify architectural layers in common frameworks and patterns.

## Next.js / App Router

| Layer | Location | Pattern |
|-------|----------|---------|
| Entry | `app/api/*/route.ts` | `export async function POST(req)` |
| Validation | Inside handler or middleware | Zod schema, manual checks |
| Business Logic | `lib/services/` or `lib/*/` | Pure functions, orchestration |
| Data Access | `lib/db/` or inline Prisma calls | `prisma.model.method()` |
| External | `lib/clients/` or inline fetch | API calls, email, queues |
| Response | `NextResponse.json()` | Serialization at end of handler |

**Server Components:** Act as both entry and response layer. Data fetching happens inline.
Trace from the `page.tsx` through its data fetches to the database.

## Express / Fastify / Hono

| Layer | Location | Pattern |
|-------|----------|---------|
| Entry | `routes/` or `controllers/` | `router.post('/path', handler)` |
| Validation | Middleware or handler | `validate(schema)`, manual checks |
| Business Logic | `services/` or `use-cases/` | Function calls from handler |
| Data Access | `repositories/` or `models/` | ORM or query builder calls |
| External | `clients/` or `integrations/` | HTTP calls, SDK usage |
| Response | `res.json()` or `res.send()` | At end of handler chain |

## Django / Flask / FastAPI

| Layer | Location | Pattern |
|-------|----------|---------|
| Entry | `views.py` or `routes.py` | Decorated function/class |
| Validation | `serializers.py` or Pydantic models | Input parsing and validation |
| Business Logic | `services.py` or `utils.py` | Domain logic |
| Data Access | `models.py` + ORM | `Model.objects.filter()` |
| External | `clients/` or `tasks.py` | API calls, Celery tasks |
| Response | Return from view | `JsonResponse`, `Response` |

## React / Vue / Svelte Components

| Layer | Location | Pattern |
|-------|----------|---------|
| Entry | Event handler | `onClick`, `onSubmit`, `onChange` |
| Validation | Form validation | Client-side checks before submit |
| API Call | Fetch/axios call | `fetch('/api/...')` or hook |
| State Update | State setter | `setState`, `dispatch`, store mutation |
| Render | Component return | JSX/template showing new state |

**Note:** UI traces go: user action → event handler → API call → state update → re-render.
The API call connects to a server-side trace.

## Monorepo / Microservice

When tracing across packages or services:
- Note each boundary crossing (package import, HTTP call, message)
- Document the contract at each boundary (what data shape crosses)
- Flag where errors might be lost in translation between services

## Go

| Layer | Location | Pattern |
|-------|----------|---------|
| Entry | `cmd/*/main.go` | `func main()`, CLI setup |
| Routing | `internal/api/` or `handler/` | `http.HandleFunc`, mux registration |
| Middleware | `internal/middleware/` | `func(next http.Handler) http.Handler` |
| Business Logic | `internal/service/` or `internal/domain/` | Pure functions, orchestration |
| Data Access | `internal/repository/` or `internal/store/` | SQL queries, ORM calls |
| External | `internal/client/` | HTTP clients, SDK usage |

**Go conventions:** `cmd/` for entry points, `internal/` for private packages, `pkg/` for
public libraries. The `internal/` directory is enforced by the Go compiler — nothing
outside the module can import from it.

## Rust

| Layer | Location | Pattern |
|-------|----------|---------|
| Entry | `src/main.rs` or `src/lib.rs` | `fn main()`, `pub mod` declarations |
| Routing | `src/routes/` or `src/handlers/` | Framework-specific handler registration |
| Business Logic | `src/services/` or `src/domain/` | Core logic, trait implementations |
| Data Access | `src/db/` or `src/repositories/` | sqlx queries, diesel calls |
| Models | `src/models/` | Structs with Serialize/Deserialize derives |
| Errors | `src/errors/` or `src/error.rs` | Custom error enums with thiserror |

**Rust conventions:** `src/lib.rs` declares the module tree. `mod.rs` files define
sub-modules. Binary crates have `main.rs`, library crates have `lib.rs`. Follow
`pub mod` and `mod` declarations to trace the module hierarchy.

## Ruby / Rails

| Layer | Location | Pattern |
|-------|----------|---------|
| Entry | `config/routes.rb` | `resources :users`, route definitions |
| Controllers | `app/controllers/` | `class UsersController < ApplicationController` |
| Business Logic | `app/services/` or `app/models/` | Service objects, model methods |
| Data Access | `app/models/` | ActiveRecord models, scopes, validations |
| Views | `app/views/` | ERB/Haml templates |
| Background Jobs | `app/jobs/` or `app/workers/` | Sidekiq/ActiveJob classes |
| Middleware | `app/middleware/` or `config/application.rb` | Rack middleware |

**Rails conventions:** MVC is the primary pattern. `app/concerns/` for shared modules.
`lib/` for non-Rails code. Trace from route to controller action to model to view.

## Identifying Layers When Structure is Flat

Some codebases don't have clear directory-based layers. Look for:
- **Entry**: Functions called directly from framework (route handlers, event handlers)
- **Validation**: Any `if (!input)` checks, schema validation calls
- **Logic**: Functions that make decisions (conditionals, loops, transformations)
- **Data**: Functions that call databases, ORMs, or file systems
- **External**: Functions that make HTTP requests or use SDKs
