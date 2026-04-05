---
name: map
description: >-
  This skill should be used when the user asks to "map the architecture", "show me the
  architecture", "codebase overview", "how is this project structured", "architecture
  diagram", "module map", "dependency map", "what are the layers", mentions "/map", or
  wants a high-level architectural overview of the project.
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - mcp__lenskit__lenskit_graph
  - mcp__lenskit__lenskit_status
  - mcp__lenskit__lenskit_analyze
argument-hint: "[directory]"
---

# Architecture Map

Generate a high-level architectural map of the codebase: layers, modules, boundaries,
data flow, and dependency directions. The output should give someone who's never seen
this codebase a mental model in 2 minutes.

## Workflow

### 1. Survey the Project

Gather structural data:
- **Directory listing**: Top-level and one level deep (`ls -la`, `ls src/`)
- **Package config**: `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod` — what's
  the stack?
- **Framework config**: `next.config.js`, `vite.config.ts`, `tsconfig.json`, etc.
- **Entry points**: Main files, route directories, handler directories
- **lenskit_status**: If available, call `lenskit_status` first. It provides file count,
  top hotspots, circular dependency count, hub count, and test coverage ratio in seconds.
  This gives you a quantitative foundation before reading any code.

### 2. Identify Layers

Read representative files from each major directory to understand the layer:

| Directory pattern | Likely layer |
|-------------------|-------------|
| `app/`, `pages/`, `routes/` | Entry / Routing |
| `api/`, `handlers/`, `controllers/` | Request handling |
| `services/`, `use-cases/`, `domain/` | Business logic |
| `lib/`, `utils/`, `helpers/` | Shared utilities |
| `db/`, `repositories/`, `models/` | Data access |
| `components/`, `ui/`, `views/` | Presentation |
| `types/`, `interfaces/`, `schemas/` | Type definitions |
| `config/`, `env/` | Configuration |
| `middleware/`, `plugins/` | Cross-cutting concerns |
| `test/`, `__tests__/`, `spec/` | Tests |

### 3. Map Dependencies

**With lenskit-mcp (preferred):** Call `lenskit_graph` to get the full dependency graph
with layer classifications, circular dependencies, hub files, and layer violations
pre-computed. Use this data directly for the module map and observations sections.

**Note on tsconfig path aliases:** If the project uses tsconfig path aliases (e.g.,
`@/utils/helpers` mapping to `src/utils/helpers`), lenskit resolves these automatically.
The graph data will show the true file-to-file dependencies even for aliased imports.
If you see aliased imports in the code that don't appear in the graph, check whether
the project's tsconfig.json has `paths` configured.

**Without lenskit-mcp:** For each major module/directory, identify what it imports from
and what imports it:

```bash
# What does src/lib/auth import?
grep -h "from" src/lib/auth/*.ts | sort -u

# What imports from src/lib/auth?
grep -rl "from.*lib/auth" src/ | grep -v "lib/auth"
```

Build a dependency direction map: which layers depend on which?

### 4. Identify Boundaries

Look for:
- **Trust boundaries**: Where external input enters (API routes, webhooks, file uploads)
- **Package boundaries**: In monorepos, where packages interface with each other
- **Layer boundaries**: Where one architectural layer calls another
- **External boundaries**: Where code talks to databases, APIs, file systems

### 5. Present the Map

**Report format:**

```
## Architecture Map — {project name}

### Stack
{Framework, language, database, key dependencies — one line each}

### Layer Diagram

┌─────────────────────────────────────────┐
│  Entry (app/api/, app/(routes)/)        │ ← External requests
├─────────────────────────────────────────┤
│  Middleware (middleware.ts, lib/auth/)    │ ← Auth, rate limiting
├─────────────────────────────────────────┤
│  Business Logic (lib/services/)          │ ← Core domain
├─────────────────────────────────────────┤
│  Data Access (lib/db/)                   │ ← Database operations
├─────────────────────────────────────────┤
│  External Services (lib/clients/)        │ ← Third-party APIs
└─────────────────────────────────────────┘

### Module Map

| Module | Purpose | Depends on | Depended by |
|--------|---------|------------|-------------|
| lib/auth | Authentication | lib/db, env | api/*, middleware |
| lib/db | Database access | prisma, env | lib/services, api/* |
| lib/services | Business logic | lib/db, lib/clients | api/* |
| ... |

### Data Flow
{Primary data flow path from entry to storage — reference /trace for detailed flows}

### Boundaries
- **Trust boundary**: All API routes require auth via middleware
- **Package boundary**: (if monorepo) packages communicate via published APIs
- **External boundary**: Database via Prisma, payments via Stripe SDK

### Key Patterns
{2-3 architectural patterns the project follows: repository pattern, service layer,
middleware chain, event-driven, etc.}

### Observations
{Potential issues: circular dependencies, layer violations, god modules, etc.}
```

## Related Skills

- **`/hotspots`** — Find the riskiest areas in the architecture
- **`/trace`** — Follow a specific feature flow through the layers
- **`/explain`** — Deep-dive into any module you found in the map

## Monorepo Guidance

For monorepos (Turborepo, Nx, Lerna, pnpm workspaces):
- Map each package separately first, then show inter-package dependencies
- Identify the dependency graph between packages (which packages depend on which)
- Highlight shared/core packages that all others depend on (these are the highest-impact
  modules for architecture decisions)
- Note package boundary violations: direct imports from one package's `src/` into another
  (should use published package exports instead)
- If lenskit_graph is available, run it at the monorepo root to get cross-package edges

## Guidelines

- The map should be scannable in under 2 minutes. Lead with the diagram, detail below.
- Use ASCII box diagrams for layers. Keep them simple — clarity over artistic merit.
- Focus on the ARCHITECTURE, not every file. Group by module/directory, not individual files.
- Note architectural violations: files that import across layers in unexpected directions
  (e.g., a utility importing from a route handler).
- If the project has no clear architecture (flat structure, everything in one directory),
  say so. That's a finding in itself.
