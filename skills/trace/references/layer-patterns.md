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

## Java / Spring Boot

| Layer | Location | Pattern |
|-------|----------|---------|
| Entry | `*Controller.java` | `@RestController`, `@RequestMapping`, `@GetMapping` |
| Validation | DTOs + `@Valid` annotation | `@Valid @RequestBody CreateUserDto dto` |
| Business Logic | `*Service.java` or `*ServiceImpl.java` | `@Service`, `@Transactional` |
| Data Access | `*Repository.java` | `@Repository`, extends `JpaRepository<Entity, ID>` |
| Models/Entities | `*Entity.java` or `model/*.java` | `@Entity`, `@Table`, `@Column` |
| External | `*Client.java` or `*Adapter.java` | `@FeignClient`, `RestTemplate`, `WebClient` |
| Configuration | `*Config.java` or `application.yml` | `@Configuration`, `@Bean`, `@Value` |

**Spring Boot conventions:** Follow the `@Autowired` / constructor injection chain to trace
dependencies. `@Service` classes contain business logic, `@Repository` classes wrap data
access. The `@Transactional` annotation marks methods that need atomicity -- trace these
carefully to understand rollback boundaries.

**Spring Security:** Auth is typically configured in a `SecurityConfig` class with
`SecurityFilterChain`. The `@PreAuthorize` and `@Secured` annotations on controller methods
indicate per-endpoint auth rules.

## Python / Django

| Layer | Location | Pattern |
|-------|----------|---------|
| Entry | `views.py` or `viewsets.py` | `@api_view`, `class ModelViewSet`, function views |
| URL Routing | `urls.py` | `path('api/users/', views.create_user)`, `router.register()` |
| Validation | `serializers.py` | `class UserSerializer(serializers.ModelSerializer)` |
| Business Logic | `services.py` or `selectors.py` | Pure functions, orchestration logic |
| Data Access | `models.py` + ORM | `Model.objects.filter()`, `QuerySet` chains |
| External | `tasks.py` or `clients/` | Celery tasks, API client classes |
| Middleware | `middleware.py` | `class CustomMiddleware`, `process_request` / `process_response` |
| Admin | `admin.py` | `@admin.register(Model)`, `class ModelAdmin` |

**Django conventions:** `urls.py` maps URLs to views. `views.py` handles requests.
`models.py` defines database schema AND business logic (Active Record pattern).
`serializers.py` handles input validation AND output formatting. `admin.py` provides
the admin interface.

**Django REST Framework (DRF):** ViewSets combine CRUD operations into a single class.
Serializers serve as both input validation and output formatting. `permissions.py`
defines access control classes applied via `permission_classes`.

**Trace tip:** Start from `urls.py` to find the view, then follow the view to its
serializer (validation), model (data access), and any service functions (business logic).

## Python / FastAPI

| Layer | Location | Pattern |
|-------|----------|---------|
| Entry | `routers/*.py` or `main.py` | `@router.get('/users')`, `@app.post('/users')` |
| Validation | Pydantic models | `class CreateUserRequest(BaseModel)`, type annotations |
| Dependencies | `dependencies.py` or `deps.py` | `Depends(get_db)`, `Depends(get_current_user)` |
| Business Logic | `services/*.py` or `crud/*.py` | Pure functions, service classes |
| Data Access | `models/*.py` + SQLAlchemy | `session.query(User).filter(...)`, `AsyncSession` |
| External | `clients/*.py` | `httpx.AsyncClient`, background tasks |
| Middleware | `middleware.py` | `@app.middleware("http")`, Starlette middleware |

**FastAPI conventions:** Uses Python type hints for automatic validation (via Pydantic).
`Depends()` is the dependency injection system -- trace these to understand how database
sessions, auth, and other dependencies are provided to route handlers.

**Trace tip:** FastAPI routes declare their dependencies in the function signature.
`async def create_user(db: Session = Depends(get_db), user: User = Depends(get_current_user))`
tells you exactly what this endpoint needs. Follow each `Depends()` call to its provider.

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
