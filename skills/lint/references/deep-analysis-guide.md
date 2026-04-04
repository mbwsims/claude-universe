# Deep Analysis Guide

This guide provides methodology for the deep analysis that replaces the paid `--deep` flag.
The `alignkit_lint` tool returns structured data including `projectContext` (dependencies,
tsconfig, directory tree) and per-rule diagnostics. Use this data to perform effectiveness
ratings, coverage gap detection, and consolidation analysis.

## Effectiveness Ratings

Rate every rule as HIGH, MEDIUM, or LOW. Only present MEDIUM and LOW to the user.

### HIGH Effectiveness

The rule is concrete, actionable, and clearly relevant to this project.

**Indicators:**
- References specific tools, directories, or patterns that exist in the project
- Uses imperative language with clear conditions
- Covers a non-obvious behavior that Claude wouldn't infer from reading code
- Addresses a real gotcha or footgun in the tech stack

**Examples:**
- "Run `vitest run` before committing" (vitest is in devDependencies)
- "Place API routes in `src/routes/` using kebab-case filenames" (directory exists)
- "Never import from `internal/` packages in `public/` code" (both directories exist)

### MEDIUM Effectiveness

The rule is reasonable but could be more specific or better targeted.

**Indicators:**
- Correct intent but missing project-specific details
- Somewhat generic — could apply to any project
- Missing concrete tool names, directory paths, or thresholds
- Uses hedging language but has a core of value

**Suggested rewrites should:**
- Add project-specific details from the project context
- Replace generic terms with concrete references
- Add specific flags, paths, or thresholds

### LOW Effectiveness

The rule is vague, irrelevant, or states something Claude already knows.

**Indicators:**
- "Claude already knows this" — rules that restate common knowledge:
  - "Write clean, readable code"
  - "Handle errors properly"
  - "Use meaningful variable names"
  - "Follow REST conventions"
  - "Write unit tests for new features"
- References tools or frameworks not in the project's dependencies
- Too abstract to act on ("maintain good code quality")
- Duplicates what a linter/formatter already enforces

**For "Claude already knows" rules:** Recommend REMOVE. These waste instruction budget
without changing behavior. Claude reads code and infers conventions; it doesn't need
instructions for standard practices.

**For irrelevant tools:** Either update to reference actual tools or remove.

**For vague rules:** Rewrite with concrete, project-specific language.

## Coverage Gap Detection

Analyze the project context to find important behaviors not covered by existing rules.

### What to Examine

**Dependencies (from projectContext.dependencies):**

JavaScript/TypeScript:
- Database tools (prisma, knex, typeorm, drizzle) → migration workflow rules?
- API frameworks (express, fastify, hono, next) → route organization, error handling?
- Testing tools (vitest, jest, playwright, cypress) → test execution, coverage?
- Build tools (webpack, vite, turbo, nx) → build commands, cache handling?
- Auth libraries (next-auth, passport, lucia) → security-sensitive patterns?

Python (from pyproject.toml, requirements.txt):
- Database tools (sqlalchemy, django-orm, alembic, tortoise) → migration rules?
- API frameworks (fastapi, django, flask, starlette) → route patterns, middleware?
- Testing tools (pytest, unittest, hypothesis, tox) → test runner, fixtures?
- Type checking (mypy, pyright, pydantic) → type annotation rules?
- Task queues (celery, rq, dramatiq) → async task patterns?

Go (from go.mod):
- Web frameworks (gin, echo, chi, fiber) → handler patterns, middleware?
- Database (sqlx, gorm, ent, pgx) → query patterns, transactions?
- Testing (testify, gomock, go-cmp) → assertion style, mock patterns?
- gRPC / protobuf → service definition, code generation rules?
- Logging (zap, zerolog, slog) → structured logging conventions?

Rust (from Cargo.toml):
- Web frameworks (actix-web, axum, rocket, warp) → handler patterns, extractors?
- Database (sqlx, diesel, sea-orm) → query patterns, migrations?
- Error handling (thiserror, anyhow, eyre) → error type conventions?
- Serialization (serde, serde_json) → derive patterns?
- Async runtime (tokio, async-std) → async patterns, spawning rules?

**TypeScript config (from projectContext.tsconfig):**
- strict mode enabled? → type safety rules?
- path aliases configured? → import convention rules?
- multiple tsconfig files? → build vs dev configurations?

**Directory structure (from projectContext.directoryTree):**
- Monorepo patterns (packages/, apps/) → cross-package dependency rules?
- Separation of concerns (src/api/, src/ui/, src/db/) → boundary rules?
- Config directories (.github/, .circleci/) → CI/CD workflow rules?
- Migration directories → migration management rules?

### Quality Standards for Suggested Rules

Every suggested rule must:
1. Reference specific evidence from the project (a real dependency, directory, or config)
2. Be concrete and actionable — copy-paste ready
3. Address a non-obvious behavior (not something Claude would infer)
4. Not duplicate an existing rule

**Good gap suggestion:**
```
Database migrations — Prisma is in dependencies but no rules about migration workflow.
Suggested rule: "Run `npx prisma migrate dev` after schema changes. Never edit
migration files in `prisma/migrations/` directly."
Evidence: prisma in dependencies, prisma/migrations/ directory exists
```

**Bad gap suggestion:**
```
Error handling — No rules about error handling.
Suggested rule: "Handle errors properly."
```
This is too generic and states something Claude already knows.

### How Many Gaps to Report

Report 3-5 gaps. Prioritize:
1. Safety-critical gaps (auth, data integrity, destructive operations)
2. Workflow gaps (build, test, deploy sequences)
3. Convention gaps (naming, organization, import patterns)

## Consolidation Analysis

Find groups of related rules that can merge into fewer, stronger rules.

### Identifying Merge Candidates

Look for:
- **Same topic, different wording**: "Use absolute imports" + "Don't use relative imports"
- **Related constraints**: "Test files go in `__tests__/`" + "Name test files `*.test.ts`"
  + "Use `describe`/`it` blocks"
- **Subset rules**: "Never push to main" is a subset of "Always create a branch, get
  review, then merge to main"

### Merge Quality Standards

The merged rule must:
1. Preserve ALL constraints from the originals (no information loss)
2. Be a complete, standalone rule (not truncated)
3. Be concise — the point is to save tokens, not create a paragraph
4. Read naturally as a single instruction

**Good merge:**
```
Original: "Use absolute imports" + "Import from index files where available" +
          "Never create circular imports"
Merged:   "Use absolute imports from index files. No circular dependencies."
Savings:  ~40 tokens
```

**Bad merge:**
```
Original: "Always run tests" + "Use dark mode in the editor"
Merged:   (these are unrelated — do not merge)
```

### Token Savings Estimation

Estimate tokens saved as: (sum of original rule tokens) - (merged rule tokens).
Rough estimate: 1 token per 4 characters.
