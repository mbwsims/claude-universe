# Convention Categories

Analyze each category below when discovering conventions. For each, look for consistent
patterns across sampled files. Skip categories that aren't relevant to the project's
stack.

## Import & Module Patterns

**What to look for:**
- Path alias usage (`@/`, `~/`, `#/`) vs relative paths (`../`)
- Import ordering (external → internal → types → styles)
- Named exports vs default exports
- Barrel files / index re-exports
- Dynamic imports vs static imports
- Module system (ESM vs CJS)

**How to detect:**
- Grep for `import .* from` patterns across source files
- Check for `export default` vs `export { ... }` or `export function/const`
- Look at tsconfig.json `paths` configuration
- Count relative imports with `../` vs alias imports

**Example discoveries:**
- "All 34 files use @/ alias — zero ../.. relative imports"
- "Named exports exclusively — 0 default exports outside Next.js pages"
- "Imports ordered: external packages, then @/ internal, then types"

## Naming Conventions

**What to look for:**
- File naming: kebab-case, camelCase, PascalCase, snake_case
- Component naming patterns
- Function naming (handle*, use*, get*, create*, etc.)
- Variable naming for specific concepts (isX, hasX for booleans)
- Directory naming conventions
- Test file naming (*.test.ts, *.spec.ts, __tests__/)

**How to detect:**
- List files and observe naming patterns
- Grep for function declarations and observe naming
- Check for consistent prefixes/suffixes

**Example discoveries:**
- "All React components use PascalCase files matching component name"
- "All boolean variables prefixed with is/has/should"
- "Test files co-located as *.test.ts next to source"

## Error Handling

**What to look for:**
- Try/catch patterns in handlers
- Error response shapes ({ error: string }, { message, code }, etc.)
- Custom error classes or error factories
- Error logging patterns
- Validation approaches (zod, joi, manual checks)
- Error boundary patterns (React)

**How to detect:**
- Grep for `catch` blocks and observe handling patterns
- Grep for `throw new` to find error creation patterns
- Check API routes for response format on errors
- Look for validation library usage in package.json

**Example discoveries:**
- "All 8 API routes return { error: string } with try/catch"
- "Zod schemas validate all API inputs — no manual validation"
- "Custom AppError class used consistently for domain errors"

## API & Route Patterns

**What to look for:**
- Route organization (file-based, directory-based)
- HTTP method handling patterns
- Request parsing approach
- Response format consistency
- Authentication/authorization patterns
- Middleware usage

**How to detect:**
- List all route files and observe structure
- Read 3-4 route handlers and compare patterns
- Check for shared middleware or wrapper functions
- Look for auth checks and where they appear

**Example discoveries:**
- "Every API route wraps handler in withAuth() middleware"
- "All POST/PUT routes validate body with zod schema as first step"
- "Responses always include { data: T } on success, { error: string } on failure"

## Data Access Patterns

**What to look for:**
- ORM usage (Prisma, Drizzle, TypeORM, Sequelize)
- Raw SQL presence or absence
- Repository pattern vs direct ORM calls
- Transaction patterns
- Query builder patterns
- Data access location (centralized in lib/db/ vs scattered)

**How to detect:**
- Check package.json for ORM dependencies
- Grep for raw SQL queries (queryRaw, executeRaw, pool.query, etc.)
- Grep for ORM calls and where they originate
- Look for data access layer directories

**Example discoveries:**
- "All DB access through Prisma — zero raw SQL anywhere in src/"
- "Data access centralized in src/lib/db/ — no ORM calls in route handlers"
- "Every mutation wrapped in prisma.$transaction"

## Testing Patterns

**What to look for:**
- Test framework and runner
- Test file location and naming
- Describe/it vs test() style
- Mock patterns
- Fixture patterns
- Coverage configuration
- Integration vs unit test separation

**How to detect:**
- Check package.json for test dependencies and scripts
- Find test files and read 2-3 to observe style
- Check for test configuration files
- Look for mock directories or setup files

**Example discoveries:**
- "Vitest with describe/it blocks — no standalone test() calls"
- "Tests in __tests__/ directories adjacent to source"
- "Database tests use a shared setupTestDB() helper — no raw connection setup"

## Type Patterns (TypeScript/Flow)

**What to look for:**
- Type file organization (*.types.ts, types/ directory, inline)
- Interface vs type alias preference
- Enum usage vs const objects vs union types
- Generic patterns
- Strict mode usage and any/unknown handling
- Type assertion patterns

**How to detect:**
- Check tsconfig.json for strictness settings
- Grep for `interface` vs `type` declarations
- Grep for `as any`, `@ts-ignore`, `@ts-expect-error`
- Look for type files and where types are defined

**Example discoveries:**
- "Interfaces for object shapes, type aliases for unions — consistent split"
- "Zero @ts-ignore or @ts-expect-error in codebase"
- "All shared types in src/types/ — no inline type exports from modules"

## State & Configuration Patterns

**What to look for:**
- Environment variable handling (.env, config files)
- Configuration loading patterns
- State management approach (React context, stores, etc.)
- Feature flags
- Constants organization

**How to detect:**
- Check for .env files and how they're loaded
- Grep for process.env or import.meta.env
- Look for config/ or constants/ directories
- Check for state management libraries

**Example discoveries:**
- "All env vars accessed through src/lib/env.ts — never raw process.env"
- "Constants centralized in src/constants/ — no magic strings in source"
- "React context for auth state, server components for everything else"

## Git & Workflow Patterns

**What to look for:**
- Commit message format
- Branch naming conventions
- PR template presence
- CI/CD configuration
- Pre-commit hooks (husky, lint-staged)
- Changelog maintenance

**How to detect:**
- Read recent git log for commit message patterns
- Check for .github/, .husky/, .commitlintrc
- Look for CI configuration files
- Check for PR templates

**Example discoveries:**
- "Commit messages follow Conventional Commits (feat:, fix:, chore:)"
- "All PRs require passing CI checks — GitHub Actions in .github/workflows/"
- "Husky pre-commit runs lint-staged on changed files"

## Architecture Boundaries

**What to look for:**
- Layer separation (UI → API → data)
- Import restrictions between directories
- Shared vs feature-specific code boundaries
- Monorepo package boundaries
- Dependency injection patterns

**How to detect:**
- Map which directories import from which
- Look for index.ts barrel exports that define public APIs
- Check for eslint import restrictions
- Observe which modules are imported most widely

**Example discoveries:**
- "Components never import from lib/db/ directly — always through API routes"
- "src/shared/ is imported by all features — features never import from each other"
- "Each package has index.ts that defines its public API — no deep imports"

---

## Language-Specific Categories

The categories above apply broadly. The sections below add language-specific patterns
that don't map to the general categories. Skip sections for languages not present in
the project.

### Python

**Import Organization:**
- Absolute vs relative imports (`from mypackage.utils import X` vs `from .utils import X`)
- Import grouping (stdlib → third-party → local, enforced by isort/ruff)
- Star imports (`from module import *`) — presence or absence
- `__init__.py` usage: re-exports vs empty vs package initialization

**How to detect:**
- Grep for `from . import` (relative) vs `from mypackage import` (absolute)
- Check for `.isort.cfg`, `pyproject.toml [tool.isort]`, or `ruff.toml`
- Count `import *` occurrences

**Type Annotations:**
- Type hint coverage (all functions, only public APIs, or none)
- `from __future__ import annotations` usage
- Runtime type checking (pydantic, attrs, dataclasses) vs static-only (mypy)
- `Optional[X]` vs `X | None` style (Python 3.10+)

**How to detect:**
- Grep for `def .+\(.*:` (typed params) vs `def .+\([^:]+\)` (untyped)
- Check for `mypy.ini`, `pyproject.toml [tool.mypy]`
- Grep for `from pydantic import`, `@dataclass`, `import attrs`

**Decorator Patterns:**
- Auth decorators on views (`@login_required`, `@permission_required`)
- Caching decorators (`@cache`, `@lru_cache`)
- Route decorators (`@app.route`, `@router.get`)
- Custom decorator conventions

**How to detect:**
- Grep for `@` at start of line, aggregate decorator names
- Look for consistent decorator ordering on functions

**Project Structure:**
- Package layout (`src/` layout vs flat)
- Test organization (`tests/` mirror vs `test_*.py` co-located)
- Configuration approach (pyproject.toml vs setup.cfg vs setup.py)
- Virtual environment (poetry, pipenv, uv, venv)

**Example discoveries:**
- "All 23 functions have type annotations — consistent typing throughout"
- "Every view function decorated with @require_auth before @require_permission"
- "Tests mirror src/ structure: src/services/user.py → tests/services/test_user.py"
- "Pydantic models for all API request/response schemas — no raw dicts"

### Go

**Error Handling:**
- `if err != nil` patterns (return early vs wrap vs log)
- Error wrapping (`fmt.Errorf("context: %w", err)` vs bare returns)
- Custom error types vs sentinel errors vs string matching
- Error variable naming (`err` vs descriptive names)

**How to detect:**
- Grep for `if err != nil` and observe the block body
- Grep for `%w` in Errorf calls (wrapping) vs `%v` or `%s` (losing context)
- Grep for `errors.New`, `errors.Is`, `errors.As`
- Look for files defining custom error types

**Interface Patterns:**
- Interface size (small, 1-3 methods vs large)
- Interface location (consumer package vs provider package)
- Naming conventions (`Reader`, `Writer`, `Storer` vs `IReader`, `ReaderInterface`)
- Embedding patterns

**How to detect:**
- Grep for `type .+ interface` and count methods per interface
- Check where interfaces are defined vs where they're implemented
- Look for interface embedding (`io.Reader`, etc.)

**Package Organization:**
- Package naming (single word, no underscores)
- Internal packages (`internal/`) for encapsulation
- `cmd/` for entry points
- Flat vs nested package hierarchy

**How to detect:**
- List directories and observe naming patterns
- Check for `internal/` directory and what it contains
- Count packages and nesting depth

**Concurrency Patterns:**
- Channel usage vs sync primitives (Mutex, WaitGroup)
- Context propagation (context.Context as first parameter)
- Goroutine lifecycle management (errgroup, worker pools)

**How to detect:**
- Grep for `go func`, `make(chan`, `sync.Mutex`, `sync.WaitGroup`
- Grep for `context.Context` in function signatures — check if it's always first param
- Grep for `errgroup` imports

**Example discoveries:**
- "All errors wrapped with fmt.Errorf and %w — consistent error chain"
- "Interfaces defined in consumer packages, max 2 methods each"
- "context.Context is always the first parameter — 47/47 functions"
- "All HTTP handlers follow func(w http.ResponseWriter, r *http.Request) signature"

### Rust

**Error Handling:**
- Result/Option usage patterns
- Custom error enums vs anyhow/thiserror
- `?` operator usage (early return vs explicit match)
- Error conversion patterns (From trait implementations)

**How to detect:**
- Grep for `-> Result<` to find functions that return Results
- Check Cargo.toml for `anyhow`, `thiserror`, `eyre`
- Grep for `impl From<` for error conversion patterns
- Count `unwrap()` and `expect()` calls (high counts suggest weak error handling)

**Ownership & Borrowing Patterns:**
- Function signatures: `&self` vs `&mut self` vs `self` (consuming) conventions
- String handling: `&str` vs `String` in function parameters
- Clone usage patterns (sparing vs liberal)
- Lifetime annotation conventions

**How to detect:**
- Grep for `fn .+\(self` vs `fn .+\(&self` vs `fn .+\(&mut self`
- Grep for `.clone()` calls and frequency
- Look for explicit lifetime annotations `<'a>`

**Module Organization:**
- `mod.rs` vs file-as-module pattern
- Re-exports in `lib.rs`
- Visibility modifiers (`pub`, `pub(crate)`, `pub(super)`)
- Feature flag organization

**How to detect:**
- Check for `mod.rs` files vs directory/file modules
- Grep for `pub(crate)` vs bare `pub`
- Check Cargo.toml `[features]` section

**Trait Patterns:**
- Trait design (small, composable traits vs large interfaces)
- Derive macro usage (`#[derive(Debug, Clone, PartialEq)]`)
- Default implementations
- Trait bounds in generics

**How to detect:**
- Grep for `trait ` definitions and count methods
- Grep for `#[derive(` and list commonly derived traits
- Look for `impl Default for` patterns

**Example discoveries:**
- "All error types use thiserror — zero manual Display implementations"
- "pub(crate) used consistently for internal APIs — only lib.rs re-exports are pub"
- "Every struct derives Debug, Clone, Serialize, Deserialize — consistent 4-derive pattern"
- "All functions take &str not String for string parameters"

---

## Analysis Tips

**Sampling strategy:**
- Read files from at least 3 different directories
- Include both "core" and "leaf" modules
- Include both recent and older files (check git dates)
- Prioritize files with the most imports (likely central/important)

**Threshold for reporting:**
- 90%+ consistency → Strong convention, high-confidence rule
- 70-89% consistency → Likely convention with exceptions, note the exceptions
- Below 70% → Not a convention, don't report it

**What NOT to report:**
- Framework-imposed patterns (Next.js routing structure is not a "convention")
- Obvious language features (using TypeScript interfaces in a TypeScript project)
- Single-instance patterns (one file does something unique — not a convention)
- Patterns already documented in CLAUDE.md or .claude/rules/
