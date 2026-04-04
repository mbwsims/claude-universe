# Phase 0: Shared Infrastructure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build shared infrastructure that Phases 1-5 depend on: fix vitest across all servers, create a shared test fixture project, build a tsconfig path resolver, create a Python pattern library, and create shared git error handling.

**Architecture:** Five independent modules in `mcp/shared/` plus a shared test fixture in `mcp/test-fixtures/`. Each server's `package.json` gets a consistent vitest version. A root-level test script runs all servers' tests.

**Tech Stack:** TypeScript (ES2022, NodeNext), vitest, Node.js child_process (execFile only — never exec), globby

---

### Task 1: Fix vitest across all servers

**Files:**
- Modify: `mcp/testkit/package.json`
- Modify: `mcp/shieldkit/package.json`
- Modify: `mcp/lenskit/package.json`
- Modify: `mcp/timewarp/package.json`

All four servers currently declare `"vitest": "^4.1.2"` in devDependencies. We need to pin to a specific working version and verify tests pass.

- [ ] **Step 1: Check current Node version and vitest compatibility**

Run: `node --version && npx vitest --version 2>/dev/null || echo "vitest not found globally"`
Expected: Node version output + vitest version or not found

- [ ] **Step 2: Pin vitest to a known working version in testkit**

In `mcp/testkit/package.json`, change the vitest version from `^4.1.2` to `~3.2.4` (last known stable release for wide Node compatibility). If `^4.1.2` resolves correctly on the current Node, keep it but pin to the exact resolved version instead.

Run: `cd mcp/testkit && npm ls vitest 2>/dev/null | head -5`

Check what version is currently installed. If it resolves and works, pin that exact version. If it doesn't resolve, change to `~3.2.4`.

- [ ] **Step 3: Install and verify testkit tests pass**

Run: `cd mcp/testkit && npm install && npx vitest run 2>&1 | tail -20`
Expected: All 5 test files pass (shallow-assertions, error-coverage, mock-health, name-quality, scoring)

- [ ] **Step 4: Record the working vitest version**

Run: `cd mcp/testkit && node -e "console.log(require('./node_modules/vitest/package.json').version)"`

Record this exact version — we'll use it for all servers.

- [ ] **Step 5: Update remaining 3 servers to the same vitest version**

Update `mcp/shieldkit/package.json`, `mcp/lenskit/package.json`, and `mcp/timewarp/package.json` to use the same pinned vitest version from Step 4.

- [ ] **Step 6: Install dependencies in all remaining servers**

Run: `cd mcp/shieldkit && npm install && cd ../lenskit && npm install && cd ../timewarp && npm install`
Expected: Clean install with no resolution errors

- [ ] **Step 7: Verify vitest runs in each server (even with no tests)**

Run: `cd mcp/shieldkit && npx vitest run 2>&1 | tail -5`
Run: `cd mcp/lenskit && npx vitest run 2>&1 | tail -5`
Run: `cd mcp/timewarp && npx vitest run 2>&1 | tail -5`
Expected: Each exits cleanly (either "no test files found" or passes)

- [ ] **Step 8: Commit**

```bash
git add mcp/testkit/package.json mcp/shieldkit/package.json mcp/lenskit/package.json mcp/timewarp/package.json
git commit -m "fix: pin vitest to consistent working version across all MCP servers"
```

---

### Task 2: Add root-level test script

**Files:**
- Create: `package.json` (root)

- [ ] **Step 1: Create root package.json with test script**

```json
{
  "name": "claude-universe-plugin",
  "version": "0.3.0",
  "private": true,
  "scripts": {
    "test": "npm run test:testkit && npm run test:shieldkit && npm run test:lenskit && npm run test:timewarp",
    "test:testkit": "cd mcp/testkit && npx vitest run",
    "test:shieldkit": "cd mcp/shieldkit && npx vitest run",
    "test:lenskit": "cd mcp/lenskit && npx vitest run",
    "test:timewarp": "cd mcp/timewarp && npx vitest run",
    "build": "npm run build:testkit && npm run build:shieldkit && npm run build:lenskit && npm run build:timewarp",
    "build:testkit": "cd mcp/testkit && npm run build",
    "build:shieldkit": "cd mcp/shieldkit && npm run build",
    "build:lenskit": "cd mcp/lenskit && npm run build",
    "build:timewarp": "cd mcp/timewarp && npm run build"
  }
}
```

Note: The `alignkit-local` server (Phase 1) will add `test:alignkit` and `build:alignkit` entries to this file when it completes. Phase 1 Task 6 handles this update.

- [ ] **Step 2: Verify root test script works**

Run: `npm test 2>&1 | tail -20`
Expected: Runs all 4 servers' tests sequentially, exits clean

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "feat: add root-level test and build scripts for all MCP servers"
```

---

### Task 3: Create shared test fixture project

**Files:**
- Create: `mcp/test-fixtures/src/index.ts`
- Create: `mcp/test-fixtures/src/utils/helpers.ts`
- Create: `mcp/test-fixtures/src/utils/format.ts`
- Create: `mcp/test-fixtures/src/services/user-service.ts`
- Create: `mcp/test-fixtures/src/services/auth-service.ts`
- Create: `mcp/test-fixtures/src/db/connection.ts`
- Create: `mcp/test-fixtures/src/db/user-repository.ts`
- Create: `mcp/test-fixtures/src/routes/user-routes.ts`
- Create: `mcp/test-fixtures/src/routes/admin-routes.ts`
- Create: `mcp/test-fixtures/src/middleware/auth-middleware.ts`
- Create: `mcp/test-fixtures/src/config.ts`
- Create: `mcp/test-fixtures/src/py/utils.py`
- Create: `mcp/test-fixtures/src/py/api.py`
- Create: `mcp/test-fixtures/src/py/models.py`
- Create: `mcp/test-fixtures/src/py/test_utils.py`
- Create: `mcp/test-fixtures/tsconfig.json`
- Create: `mcp/test-fixtures/.env.example`
- Create: `mcp/test-fixtures/.gitignore`
- Create: `mcp/test-fixtures/tests/user-service.test.ts`
- Create: `mcp/test-fixtures/tests/helpers.test.ts`
- Create: `mcp/test-fixtures/setup-git-history.sh`

This is a synthetic project that all 4 MCP servers can analyze during integration tests. It must contain realistic patterns that exercise every analyzer.

- [ ] **Step 1: Create directory structure**

Run: `mkdir -p mcp/test-fixtures/src/{utils,services,db,routes,middleware,py} mcp/test-fixtures/tests`

- [ ] **Step 2: Create tsconfig.json with path aliases**

Create `mcp/test-fixtures/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@db/*": ["src/db/*"],
      "@services/*": ["src/services/*"]
    },
    "outDir": "dist",
    "rootDir": ".",
    "strict": true
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Create entry point with re-exports**

Create `mcp/test-fixtures/src/index.ts`:

```typescript
// Main entry point — re-exports public API
export { UserService } from './services/user-service.js';
export { AuthService } from './services/auth-service.js';
export { formatDate, formatCurrency } from './utils/format.js';
```

- [ ] **Step 4: Create utility files**

Create `mcp/test-fixtures/src/utils/helpers.ts`:

```typescript
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}
```

Create `mcp/test-fixtures/src/utils/format.ts`:

```typescript
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function formatCurrency(cents: number, currency = 'USD'): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(dollars);
}

export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let value = bytes;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}
```

- [ ] **Step 5: Create service files**

Create `mcp/test-fixtures/src/services/user-service.ts`:

```typescript
import { UserRepository } from '../db/user-repository.js';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  createdAt: Date;
}

export class UserService {
  constructor(private repo: UserRepository) {}

  async getUser(id: string): Promise<User | null> {
    return this.repo.findById(id);
  }

  async createUser(email: string, name: string): Promise<User> {
    const existing = await this.repo.findByEmail(email);
    if (existing) {
      throw new Error(`User with email ${email} already exists`);
    }
    return this.repo.create({ email, name, role: 'user' });
  }

  async updateRole(id: string, role: 'admin' | 'user'): Promise<User> {
    const user = await this.repo.findById(id);
    if (!user) throw new Error('User not found');
    return this.repo.update(id, { role });
  }

  async deleteUser(id: string): Promise<void> {
    const user = await this.repo.findById(id);
    if (!user) throw new Error('User not found');
    await this.repo.delete(id);
  }
}
```

Create `mcp/test-fixtures/src/services/auth-service.ts`:

```typescript
import { UserRepository } from '../db/user-repository.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

export class AuthService {
  constructor(private repo: UserRepository) {}

  async login(email: string, password: string): Promise<string> {
    const user = await this.repo.findByEmail(email);
    if (!user) throw new Error('Invalid credentials');
    // Simplified — real app would hash-compare
    return `token-${user.id}-${Date.now()}`;
  }

  verifyToken(token: string): { userId: string } | null {
    if (!token.startsWith('token-')) return null;
    const parts = token.split('-');
    if (parts.length < 3) return null;
    return { userId: parts[1] };
  }
}
```

- [ ] **Step 6: Create database files**

Create `mcp/test-fixtures/src/db/connection.ts`:

```typescript
export interface DbConnection {
  query(sql: string, params?: unknown[]): Promise<unknown[]>;
  close(): Promise<void>;
}

let connection: DbConnection | null = null;

export function getConnection(): DbConnection {
  if (!connection) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return connection;
}

export async function initDb(connectionString: string): Promise<void> {
  // Simulated connection
  connection = {
    async query(sql: string, params?: unknown[]) {
      return [];
    },
    async close() {
      connection = null;
    },
  };
}
```

Create `mcp/test-fixtures/src/db/user-repository.ts`:

```typescript
import { getConnection } from './connection.js';
import type { User } from '../services/user-service.js';

export class UserRepository {
  async findById(id: string): Promise<User | null> {
    const conn = getConnection();
    const rows = await conn.query('SELECT * FROM users WHERE id = $1', [id]);
    return (rows[0] as User) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const conn = getConnection();
    const rows = await conn.query('SELECT * FROM users WHERE email = $1', [email]);
    return (rows[0] as User) ?? null;
  }

  async create(data: { email: string; name: string; role: string }): Promise<User> {
    const conn = getConnection();
    const id = `user-${Date.now()}`;
    await conn.query(
      'INSERT INTO users (id, email, name, role) VALUES ($1, $2, $3, $4)',
      [id, data.email, data.name, data.role]
    );
    return { id, ...data, role: data.role as 'admin' | 'user', createdAt: new Date() };
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    const conn = getConnection();
    // Deliberately using string interpolation for SQL injection test target
    await conn.query(`UPDATE users SET role = '${data.role}' WHERE id = $1`, [id]);
    const user = await this.findById(id);
    return user!;
  }

  async delete(id: string): Promise<void> {
    const conn = getConnection();
    await conn.query('DELETE FROM users WHERE id = $1', [id]);
  }
}
```

- [ ] **Step 7: Create route files (some with auth, some without)**

Create `mcp/test-fixtures/src/routes/user-routes.ts`:

```typescript
import { UserService } from '../services/user-service.js';
import { AuthService } from '../services/auth-service.js';

interface Request {
  headers: Record<string, string>;
  params: Record<string, string>;
  body: unknown;
}

interface Response {
  status(code: number): Response;
  json(data: unknown): void;
}

export function registerUserRoutes(app: { get: Function; post: Function; delete: Function }) {
  const userService = new UserService(null as any);
  const authService = new AuthService(null as any);

  // GET /users/:id — authenticated
  app.get('/users/:id', async (req: Request, res: Response) => {
    const token = req.headers['authorization'];
    const auth = authService.verifyToken(token);
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });

    const user = await userService.getUser(req.params.id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json(user);
  });

  // POST /users — no auth check (intentional gap for shieldkit to find)
  app.post('/users', async (req: Request, res: Response) => {
    const { email, name } = req.body as { email: string; name: string };
    const user = await userService.createUser(email, name);
    res.status(201).json(user);
  });
}
```

Create `mcp/test-fixtures/src/routes/admin-routes.ts`:

```typescript
interface Request {
  headers: Record<string, string>;
  params: Record<string, string>;
  body: unknown;
}

interface Response {
  status(code: number): Response;
  json(data: unknown): void;
}

// No auth middleware at all — shieldkit should flag this entire file
export function registerAdminRoutes(app: { get: Function; post: Function; delete: Function }) {
  app.get('/admin/users', async (req: Request, res: Response) => {
    // Missing auth check
    res.json({ users: [] });
  });

  app.delete('/admin/users/:id', async (req: Request, res: Response) => {
    // Missing auth check
    res.json({ deleted: true });
  });
}
```

- [ ] **Step 8: Create middleware file**

Create `mcp/test-fixtures/src/middleware/auth-middleware.ts`:

```typescript
interface Request {
  headers: Record<string, string>;
  user?: { userId: string };
}

interface Response {
  status(code: number): Response;
  json(data: unknown): void;
}

type NextFunction = () => void;

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Missing token' });
    return;
  }
  // Simplified verification
  if (token.startsWith('token-')) {
    req.user = { userId: token.split('-')[1] };
    next();
  } else {
    res.status(401).json({ error: 'Invalid token' });
  }
}
```

- [ ] **Step 9: Create config file with hardcoded secret (for shieldkit testing)**

Create `mcp/test-fixtures/src/config.ts`:

```typescript
export const config = {
  port: Number(process.env.PORT) || 3000,
  databaseUrl: process.env.DATABASE_URL || 'postgres://localhost:5432/myapp',
  jwtSecret: 'super-secret-key-12345',  // hardcoded secret — shieldkit should flag
  apiKey: 'sk-1234567890abcdef',         // hardcoded API key — shieldkit should flag
  cors: {
    origin: '*',                          // wildcard CORS — shieldkit should flag
    credentials: true,
  },
};
```

- [ ] **Step 10: Create .env.example and .gitignore**

Create `mcp/test-fixtures/.env.example`:

```
DATABASE_URL=postgres://localhost:5432/myapp
JWT_SECRET=change-me-in-production
API_KEY=your-api-key-here
PORT=3000
```

Create `mcp/test-fixtures/.gitignore`:

```
node_modules/
dist/
.env
.env.local
```

- [ ] **Step 11: Create Python fixture files**

Create `mcp/test-fixtures/src/py/utils.py`:

```python
import os
import subprocess


def run_command(cmd: str) -> str:
    """Run a shell command — dangerous function for shieldkit to detect."""
    return subprocess.check_output(cmd, shell=True).decode()


def execute_query(db, table: str, user_input: str) -> list:
    """SQL injection vulnerability — f-string with user input."""
    query = f"SELECT * FROM {table} WHERE name = '{user_input}'"
    return db.execute(query)


def safe_query(db, table: str, user_input: str) -> list:
    """Safe parameterized query."""
    return db.execute("SELECT * FROM users WHERE name = %s", [user_input])


def format_name(first: str, last: str) -> str:
    return f"{first.strip()} {last.strip()}"


def validate_email(email: str) -> bool:
    return "@" in email and "." in email.split("@")[1]
```

Create `mcp/test-fixtures/src/py/api.py`:

```python
from flask import Flask, request, jsonify
from .models import UserModel
from .utils import validate_email

app = Flask(__name__)


@app.route("/users", methods=["POST"])
def create_user():
    """No auth decorator — shieldkit should detect missing auth."""
    data = request.get_json()
    if not validate_email(data.get("email", "")):
        return jsonify({"error": "Invalid email"}), 400
    user = UserModel.create(data["email"], data["name"])
    return jsonify(user), 201


@app.route("/users/<user_id>", methods=["GET"])
def get_user(user_id):
    """No auth decorator — shieldkit should detect missing auth."""
    user = UserModel.find_by_id(user_id)
    if not user:
        return jsonify({"error": "Not found"}), 404
    return jsonify(user)


@app.route("/admin/users", methods=["DELETE"])
def delete_all_users():
    """Dangerous admin endpoint with no auth."""
    UserModel.delete_all()
    return jsonify({"status": "deleted"}), 200
```

Create `mcp/test-fixtures/src/py/models.py`:

```python
from dataclasses import dataclass
from typing import Optional


@dataclass
class UserModel:
    id: str
    email: str
    name: str
    role: str = "user"

    @classmethod
    def create(cls, email: str, name: str) -> "UserModel":
        return cls(id=f"user-{id(email)}", email=email, name=name)

    @classmethod
    def find_by_id(cls, user_id: str) -> Optional["UserModel"]:
        return None

    @classmethod
    def delete_all(cls) -> None:
        pass
```

Create `mcp/test-fixtures/src/py/test_utils.py`:

```python
"""Deliberately shallow tests for testkit to analyze."""
import pytest
from .utils import format_name, validate_email


def test_format_name():
    result = format_name("Alice", "Smith")
    assert result is not None  # shallow assertion — testkit should flag


def test_validate_email():
    assert validate_email("user@example.com")  # bare assert — testkit should flag


def test_validate_email_invalid():
    assert not validate_email("not-an-email")
```

- [ ] **Step 12: Create deliberately shallow test files (for testkit to analyze)**

Create `mcp/test-fixtures/tests/helpers.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { slugify, truncate } from '../src/utils/helpers';

describe('slugify', () => {
  it('works', () => {
    const result = slugify('Hello World');
    expect(result).toBeDefined();  // shallow assertion
  });
});

describe('truncate', () => {
  it('handles strings', () => {
    const result = truncate('hello', 10);
    expect(result).toBeTruthy();  // shallow assertion
  });
});
```

Create `mcp/test-fixtures/tests/user-service.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { UserService } from '../src/services/user-service';

// Heavy mock setup — testkit should flag mock health
const mockRepo = {
  findById: vi.fn(),
  findByEmail: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

describe('UserService', () => {
  const service = new UserService(mockRepo as any);

  it('gets a user', async () => {
    mockRepo.findById.mockResolvedValue({ id: '1', name: 'Alice' });
    const user = await service.getUser('1');
    expect(user).toBeDefined();  // shallow
    expect(mockRepo.findById).toHaveBeenCalled();  // bare toHaveBeenCalled
  });

  it('creates a user', async () => {
    mockRepo.findByEmail.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue({ id: '2', email: 'b@b.com', name: 'Bob' });
    const user = await service.createUser('b@b.com', 'Bob');
    expect(user).toBeDefined();  // shallow
  });

  // No error tests — testkit should flag missing error coverage
});
```

- [ ] **Step 13: Create git history setup script**

Create `mcp/test-fixtures/setup-git-history.sh`:

```bash
#!/usr/bin/env bash
# Initialize the test fixture as its own git repo with realistic history.
# Run from the mcp/test-fixtures/ directory.
set -euo pipefail

cd "$(dirname "$0")"

# Clean any existing git repo
rm -rf .git

git init
git checkout -b main

# Commit 1: Initial project setup
git add tsconfig.json .gitignore .env.example
git commit -m "chore: initial project setup" --date="2025-10-01T10:00:00"

# Commit 2: Add utility functions
git add src/utils/helpers.ts src/utils/format.ts
git commit -m "feat: add core utility functions" --date="2025-10-05T14:00:00"

# Commit 3: Add database layer
git add src/db/connection.ts src/db/user-repository.ts
git commit -m "feat: add database connection and user repository" --date="2025-10-10T11:00:00"

# Commit 4: Add services
git add src/services/user-service.ts src/services/auth-service.ts
git commit -m "feat: implement user and auth services" --date="2025-10-15T09:00:00"

# Commit 5: Add routes
git add src/routes/user-routes.ts src/routes/admin-routes.ts
git commit -m "feat: add user and admin route handlers" --date="2025-10-20T16:00:00"

# Commit 6: Add middleware
git add src/middleware/auth-middleware.ts
git commit -m "feat: add authentication middleware" --date="2025-11-01T10:00:00"

# Commit 7: Add config
git add src/config.ts
git commit -m "feat: add application configuration" --date="2025-11-05T13:00:00"

# Commit 8: Add entry point
git add src/index.ts
git commit -m "feat: add main entry point with public exports" --date="2025-11-10T11:00:00"

# Commit 9: Add tests
git add tests/
git commit -m "feat: add initial test suite" --date="2025-12-01T10:00:00"

# Commit 10: Add Python files
git add src/py/
git commit -m "feat: add Python API and utilities" --date="2025-12-15T14:00:00"

# Commit 11: Fix auth bug
printf '%s\n' '//' '// Fixed token validation edge case' '' >> src/services/auth-service.ts
git add src/services/auth-service.ts
git commit -m "fix: handle empty token string in auth verification" --date="2026-01-10T09:00:00"

# Commit 12: Refactor utils
printf '%s\n' '' '// Optimized for large strings' >> src/utils/helpers.ts
git add src/utils/helpers.ts
git commit -m "refactor: optimize slugify for large inputs" --date="2026-02-01T11:00:00"

# Commit 13: Update repository
printf '%s\n' '' '// Added pagination support' >> src/db/user-repository.ts
git add src/db/user-repository.ts
git commit -m "feat: add pagination to user repository queries" --date="2026-02-15T14:00:00"

# Commit 14: Security patch
printf '%s\n' '' '// Rate limiting added' >> src/routes/user-routes.ts
git add src/routes/user-routes.ts
git commit -m "fix: add rate limiting to user creation endpoint" --date="2026-03-01T10:00:00"

# Commit 15: Chore update
printf '%s\n' '' '// Updated deps' >> src/config.ts
git add src/config.ts
git commit -m "chore: bump dependency versions" --date="2026-03-15T16:00:00"

echo "Git history created with 15 commits"
git log --oneline
```

- [ ] **Step 14: Run the git history setup**

Run: `cd mcp/test-fixtures && chmod +x setup-git-history.sh && bash setup-git-history.sh`
Expected: "Git history created with 15 commits" followed by a 15-line log

- [ ] **Step 15: Commit the fixture project**

```bash
git add mcp/test-fixtures/
git commit -m "feat: add shared test fixture project with realistic JS/TS/Python files and git history"
```

---

### Task 4: Create shared tsconfig path resolver

**Files:**
- Create: `mcp/shared/tsconfig-resolver.ts`
- Create: `mcp/shared/tsconfig-resolver.test.ts`

- [ ] **Step 1: Write the failing test**

Create `mcp/shared/tsconfig-resolver.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseTsconfig, resolveAliasedImport } from './tsconfig-resolver.js';
import { join } from 'node:path';

const FIXTURE_DIR = join(import.meta.dirname, '..', 'test-fixtures');

describe('parseTsconfig', () => {
  it('parses paths and baseUrl from fixture tsconfig', async () => {
    const result = await parseTsconfig(FIXTURE_DIR);
    expect(result).toEqual({
      baseUrl: '.',
      paths: {
        '@/*': ['src/*'],
        '@db/*': ['src/db/*'],
        '@services/*': ['src/services/*'],
      },
    });
  });

  it('returns null for directory without tsconfig', async () => {
    const result = await parseTsconfig('/tmp/nonexistent-dir-12345');
    expect(result).toBeNull();
  });
});

describe('resolveAliasedImport', () => {
  it('resolves @/ alias to src/', () => {
    const result = resolveAliasedImport(
      '@/utils/helpers',
      { '@/*': ['src/*'] },
      '.'
    );
    expect(result).toBe('src/utils/helpers');
  });

  it('resolves @db/ alias to src/db/', () => {
    const result = resolveAliasedImport(
      '@db/connection',
      { '@db/*': ['src/db/*'] },
      '.'
    );
    expect(result).toBe('src/db/connection');
  });

  it('resolves @services/ alias', () => {
    const result = resolveAliasedImport(
      '@services/user-service',
      { '@services/*': ['src/services/*'] },
      '.'
    );
    expect(result).toBe('src/services/user-service');
  });

  it('returns null for non-aliased relative import', () => {
    const result = resolveAliasedImport(
      './helpers',
      { '@/*': ['src/*'] },
      '.'
    );
    expect(result).toBeNull();
  });

  it('returns null for node_modules import', () => {
    const result = resolveAliasedImport(
      'lodash',
      { '@/*': ['src/*'] },
      '.'
    );
    expect(result).toBeNull();
  });

  it('handles baseUrl prefix correctly', () => {
    const result = resolveAliasedImport(
      '@/db/connection',
      { '@/*': ['src/*'] },
      'app'
    );
    expect(result).toBe('app/src/db/connection');
  });

  it('handles paths with multiple mapping targets (uses first)', () => {
    const result = resolveAliasedImport(
      '@/foo',
      { '@/*': ['src/*', 'lib/*'] },
      '.'
    );
    expect(result).toBe('src/foo');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mcp/testkit && npx vitest run ../shared/tsconfig-resolver.test.ts 2>&1 | tail -10`
Expected: FAIL — cannot find `./tsconfig-resolver.js`

- [ ] **Step 3: Write the implementation**

Create `mcp/shared/tsconfig-resolver.ts`:

```typescript
/**
 * tsconfig-resolver.ts — Parse tsconfig.json path aliases and resolve aliased imports.
 *
 * Handles `extends` chains up to 3 levels, `baseUrl`, and `paths` mappings.
 * Primary consumer: lenskit (coupling.ts, graph.ts).
 */

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';

export interface TsconfigPaths {
  baseUrl: string;
  paths: Record<string, string[]>;
}

/**
 * Parse tsconfig.json at the given directory, following `extends` up to 3 levels.
 * Returns the merged baseUrl and paths, or null if no tsconfig found.
 */
export async function parseTsconfig(
  projectDir: string,
  depth = 0,
): Promise<TsconfigPaths | null> {
  if (depth > 3) return null;

  const tsconfigPath = join(projectDir, 'tsconfig.json');
  let raw: string;
  try {
    raw = await readFile(tsconfigPath, 'utf-8');
  } catch {
    return null;
  }

  // Strip single-line comments (tsconfig allows them)
  const cleaned = raw.replace(/\/\/.*$/gm, '');
  let config: {
    extends?: string;
    compilerOptions?: {
      baseUrl?: string;
      paths?: Record<string, string[]>;
    };
  };
  try {
    config = JSON.parse(cleaned);
  } catch {
    return null;
  }

  // Resolve extends chain
  let parentPaths: TsconfigPaths | null = null;
  if (config.extends) {
    const extendsPath = config.extends.startsWith('.')
      ? join(projectDir, dirname(config.extends))
      : join(projectDir, 'node_modules', config.extends.replace(/\/tsconfig\.json$/, ''));
    parentPaths = await parseTsconfig(extendsPath, depth + 1);
  }

  const baseUrl = config.compilerOptions?.baseUrl ?? parentPaths?.baseUrl ?? '.';
  const paths = {
    ...(parentPaths?.paths ?? {}),
    ...(config.compilerOptions?.paths ?? {}),
  };

  if (Object.keys(paths).length === 0 && !config.compilerOptions?.baseUrl) {
    if (parentPaths) return parentPaths;
    return { baseUrl, paths };
  }

  return { baseUrl, paths };
}

/**
 * Resolve an aliased import path using tsconfig paths mapping.
 *
 * Returns the resolved path (relative to project root) or null if the
 * import doesn't match any alias.
 *
 * Example:
 *   resolveAliasedImport('@/utils/helpers', { '@/*': ['src/*'] }, '.')
 *   => 'src/utils/helpers'
 */
export function resolveAliasedImport(
  importPath: string,
  paths: Record<string, string[]>,
  baseUrl: string,
): string | null {
  // Skip relative and bare module imports
  if (importPath.startsWith('.') || importPath.startsWith('/')) {
    return null;
  }

  for (const [pattern, targets] of Object.entries(paths)) {
    if (targets.length === 0) continue;

    // Pattern is like '@/*' — split into prefix '@/' and check for wildcard
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1); // '@/'
      if (importPath.startsWith(prefix)) {
        const rest = importPath.slice(prefix.length);
        const target = targets[0]; // Use first mapping target
        const targetPrefix = target.slice(0, -1); // 'src/'
        const resolved = targetPrefix + rest;
        return baseUrl === '.' ? resolved : join(baseUrl, resolved);
      }
    } else {
      // Exact match (no wildcard)
      if (importPath === pattern) {
        const resolved = targets[0];
        return baseUrl === '.' ? resolved : join(baseUrl, resolved);
      }
    }
  }

  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mcp/testkit && npx vitest run ../shared/tsconfig-resolver.test.ts 2>&1 | tail -15`
Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add mcp/shared/tsconfig-resolver.ts mcp/shared/tsconfig-resolver.test.ts
git commit -m "feat: add shared tsconfig path resolver for aliased import resolution"
```

---

### Task 5: Create shared Python pattern library

**Files:**
- Create: `mcp/shared/python-patterns.ts`
- Create: `mcp/shared/python-patterns.test.ts`

- [ ] **Step 1: Write the failing test**

Create `mcp/shared/python-patterns.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  extractPythonFunctions,
  extractPythonImports,
  detectPythonTestFramework,
  isPythonTestFile,
  findPythonInjectionPatterns,
} from './python-patterns.js';

describe('extractPythonFunctions', () => {
  it('extracts def functions', () => {
    const content = `
def hello():
    pass

def greet(name: str) -> str:
    return f"Hello {name}"
`;
    const fns = extractPythonFunctions(content);
    expect(fns).toEqual([
      { name: 'hello', line: 2, isAsync: false, isMethod: false },
      { name: 'greet', line: 5, isAsync: false, isMethod: false },
    ]);
  });

  it('extracts async def functions', () => {
    const content = `
async def fetch_data():
    pass
`;
    const fns = extractPythonFunctions(content);
    expect(fns).toEqual([
      { name: 'fetch_data', line: 2, isAsync: true, isMethod: false },
    ]);
  });

  it('extracts class methods with self', () => {
    const content = `
class UserService:
    def get_user(self, user_id: str):
        pass

    async def create_user(self, data: dict):
        pass
`;
    const fns = extractPythonFunctions(content);
    expect(fns).toEqual([
      { name: 'get_user', line: 3, isAsync: false, isMethod: true },
      { name: 'create_user', line: 6, isAsync: true, isMethod: true },
    ]);
  });

  it('skips commented-out functions', () => {
    const content = `
# def old_function():
#     pass
def real_function():
    pass
`;
    const fns = extractPythonFunctions(content);
    expect(fns).toEqual([
      { name: 'real_function', line: 4, isAsync: false, isMethod: false },
    ]);
  });
});

describe('extractPythonImports', () => {
  it('extracts from...import statements', () => {
    const content = `
from flask import Flask, request
from .models import UserModel
from ..utils import validate_email
`;
    const imports = extractPythonImports(content);
    expect(imports).toEqual([
      { module: 'flask', names: ['Flask', 'request'], line: 2 },
      { module: '.models', names: ['UserModel'], line: 3 },
      { module: '..utils', names: ['validate_email'], line: 4 },
    ]);
  });

  it('extracts bare import statements', () => {
    const content = `
import os
import subprocess
import json
`;
    const imports = extractPythonImports(content);
    expect(imports).toEqual([
      { module: 'os', names: [], line: 2 },
      { module: 'subprocess', names: [], line: 3 },
      { module: 'json', names: [], line: 4 },
    ]);
  });

  it('skips commented imports', () => {
    const content = `
# import os
import json
`;
    const imports = extractPythonImports(content);
    expect(imports).toEqual([
      { module: 'json', names: [], line: 3 },
    ]);
  });
});

describe('isPythonTestFile', () => {
  it('detects test_ prefix files', () => {
    expect(isPythonTestFile('test_utils.py')).toBe(true);
    expect(isPythonTestFile('tests/test_auth.py')).toBe(true);
  });

  it('detects _test suffix files', () => {
    expect(isPythonTestFile('utils_test.py')).toBe(true);
  });

  it('detects conftest.py', () => {
    expect(isPythonTestFile('conftest.py')).toBe(true);
    expect(isPythonTestFile('tests/conftest.py')).toBe(true);
  });

  it('rejects non-test files', () => {
    expect(isPythonTestFile('utils.py')).toBe(false);
    expect(isPythonTestFile('test_data.json')).toBe(false);
  });
});

describe('detectPythonTestFramework', () => {
  it('detects pytest from import', () => {
    expect(detectPythonTestFramework('import pytest\n')).toBe('pytest');
  });

  it('detects pytest from conftest fixture', () => {
    expect(detectPythonTestFramework('@pytest.fixture\ndef db():\n    pass')).toBe('pytest');
  });

  it('detects unittest from class', () => {
    expect(detectPythonTestFramework('class TestUser(unittest.TestCase):\n    pass')).toBe('unittest');
  });

  it('detects unittest from import', () => {
    expect(detectPythonTestFramework('import unittest\n')).toBe('unittest');
  });

  it('returns null for ambiguous content', () => {
    expect(detectPythonTestFramework('def test_something():\n    assert True')).toBeNull();
  });
});

describe('findPythonInjectionPatterns', () => {
  it('detects f-string SQL injection', () => {
    const content = `
query = f"SELECT * FROM users WHERE name = '{user_input}'"
`;
    const findings = findPythonInjectionPatterns(content);
    expect(findings.length).toBe(1);
    expect(findings[0].type).toBe('sql-injection');
    expect(findings[0].line).toBe(2);
  });

  it('detects os.system calls', () => {
    const content = `
import os
os.system(user_input)
`;
    const findings = findPythonInjectionPatterns(content);
    expect(findings.length).toBe(1);
    expect(findings[0].type).toBe('command-injection');
  });

  it('detects subprocess.call with shell=True', () => {
    const content = `
subprocess.call(cmd, shell=True)
`;
    const findings = findPythonInjectionPatterns(content);
    expect(findings.length).toBe(1);
    expect(findings[0].type).toBe('command-injection');
  });

  it('detects eval calls', () => {
    const content = `
result = eval(user_expression)
`;
    const findings = findPythonInjectionPatterns(content);
    expect(findings.length).toBe(1);
    expect(findings[0].type).toBe('code-injection');
  });

  it('detects pickle.loads', () => {
    const content = `
data = pickle.loads(untrusted_bytes)
`;
    const findings = findPythonInjectionPatterns(content);
    expect(findings.length).toBe(1);
    expect(findings[0].type).toBe('deserialization');
  });

  it('does not flag safe patterns', () => {
    const content = `
db.execute("SELECT * FROM users WHERE id = %s", [user_id])
subprocess.run(["ls", "-la"], check=True)
`;
    const findings = findPythonInjectionPatterns(content);
    expect(findings).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mcp/testkit && npx vitest run ../shared/python-patterns.test.ts 2>&1 | tail -10`
Expected: FAIL — cannot find module

- [ ] **Step 3: Write the implementation**

Create `mcp/shared/python-patterns.ts`:

```typescript
/**
 * python-patterns.ts — Shared Python analysis patterns.
 *
 * Provides Python-specific detection for functions, imports, test frameworks,
 * and security vulnerability patterns. Used by testkit, shieldkit, lenskit,
 * and timewarp for Python language support.
 */

export interface PythonFunction {
  name: string;
  line: number;
  isAsync: boolean;
  isMethod: boolean;
}

export interface PythonImport {
  module: string;
  names: string[];
  line: number;
}

export interface InjectionFinding {
  type: 'sql-injection' | 'command-injection' | 'code-injection' | 'deserialization';
  line: number;
  text: string;
  pattern: string;
}

/**
 * Extract function definitions from Python source code.
 */
export function extractPythonFunctions(content: string): PythonFunction[] {
  const functions: PythonFunction[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();

    // Skip comments
    if (trimmed.startsWith('#')) continue;

    // Match: async def name(...) or def name(...)
    const match = trimmed.match(/^(async\s+)?def\s+(\w+)\s*\(/);
    if (match) {
      const isAsync = !!match[1];
      const name = match[2];
      // Check if it's a method (has self or cls as first param)
      const isMethod = /\(\s*(self|cls)\b/.test(trimmed);
      functions.push({ name, line: i + 1, isAsync, isMethod });
    }
  }

  return functions;
}

/**
 * Extract import statements from Python source code.
 */
export function extractPythonImports(content: string): PythonImport[] {
  const imports: PythonImport[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();

    // Skip comments
    if (trimmed.startsWith('#')) continue;

    // from module import name1, name2
    const fromMatch = trimmed.match(/^from\s+(\S+)\s+import\s+(.+)/);
    if (fromMatch) {
      const module = fromMatch[1];
      const names = fromMatch[2]
        .split(',')
        .map((n) => n.trim())
        .filter((n) => n && !n.startsWith('#'));
      imports.push({ module, names, line: i + 1 });
      continue;
    }

    // import module
    const importMatch = trimmed.match(/^import\s+(\S+)\s*$/);
    if (importMatch) {
      imports.push({ module: importMatch[1], names: [], line: i + 1 });
      continue;
    }
  }

  return imports;
}

/**
 * Check if a file path is a Python test file.
 */
export function isPythonTestFile(filePath: string): boolean {
  const name = filePath.split('/').pop() ?? '';
  if (!name.endsWith('.py')) return false;
  if (name === 'conftest.py') return true;
  if (name.startsWith('test_')) return true;
  if (name.endsWith('_test.py')) return true;
  return false;
}

/**
 * Detect Python test framework from file content.
 * Returns 'pytest', 'unittest', or null.
 */
export function detectPythonTestFramework(content: string): 'pytest' | 'unittest' | null {
  if (/\bimport\s+pytest\b/.test(content) || /@pytest\./.test(content)) {
    return 'pytest';
  }
  if (/\bimport\s+unittest\b/.test(content) || /unittest\.TestCase/.test(content)) {
    return 'unittest';
  }
  return null;
}

const INJECTION_PATTERNS: Array<{
  regex: RegExp;
  type: InjectionFinding['type'];
  pattern: string;
}> = [
  // f-string SQL injection: f"SELECT ... {variable}"
  {
    regex: /f["'].*(?:SELECT|INSERT|UPDATE|DELETE|WHERE|FROM).*\{.*\}.*["']/i,
    type: 'sql-injection',
    pattern: 'f-string with SQL keyword and interpolation',
  },
  // String format SQL: "SELECT ...".format(variable)
  {
    regex: /["'].*(?:SELECT|INSERT|UPDATE|DELETE|WHERE|FROM).*["']\.format\(/i,
    type: 'sql-injection',
    pattern: '.format() with SQL keyword',
  },
  // String concatenation SQL: "SELECT ... " + variable
  {
    regex: /["'].*(?:SELECT|INSERT|UPDATE|DELETE|WHERE|FROM).*["']\s*\+/i,
    type: 'sql-injection',
    pattern: 'string concatenation with SQL keyword',
  },
  // os.system()
  {
    regex: /\bos\.system\s*\(/,
    type: 'command-injection',
    pattern: 'os.system()',
  },
  // subprocess with shell=True
  {
    regex: /\bsubprocess\.(?:call|run|Popen|check_output|check_call)\s*\(.*shell\s*=\s*True/,
    type: 'command-injection',
    pattern: 'subprocess with shell=True',
  },
  // eval()
  {
    regex: /\beval\s*\(/,
    type: 'code-injection',
    pattern: 'eval()',
  },
  // exec() — Python's exec statement
  {
    regex: /\bexec\s*\(/,
    type: 'code-injection',
    pattern: 'exec()',
  },
  // pickle.loads
  {
    regex: /\bpickle\.loads?\s*\(/,
    type: 'deserialization',
    pattern: 'pickle.loads()',
  },
];

/**
 * Find Python injection vulnerability patterns in source code.
 */
export function findPythonInjectionPatterns(content: string): InjectionFinding[] {
  const findings: InjectionFinding[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();

    // Skip comments
    if (trimmed.startsWith('#')) continue;

    for (const { regex, type, pattern } of INJECTION_PATTERNS) {
      if (regex.test(trimmed)) {
        findings.push({
          type,
          line: i + 1,
          text: trimmed.trim(),
          pattern,
        });
        break; // One finding per line
      }
    }
  }

  return findings;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mcp/testkit && npx vitest run ../shared/python-patterns.test.ts 2>&1 | tail -20`
Expected: All 19 tests PASS

- [ ] **Step 5: Commit**

```bash
git add mcp/shared/python-patterns.ts mcp/shared/python-patterns.test.ts
git commit -m "feat: add shared Python pattern library for cross-server Python analysis"
```

---

### Task 6: Create shared git error handling

**Files:**
- Create: `mcp/shared/git-utils.ts`
- Create: `mcp/shared/git-utils.test.ts`

- [ ] **Step 1: Write the failing test**

Create `mcp/shared/git-utils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { gitRun } from './git-utils.js';
import { join } from 'node:path';

const FIXTURE_DIR = join(import.meta.dirname, '..', 'test-fixtures');

describe('gitRun', () => {
  it('returns ok with stdout for valid git command', async () => {
    const result = await gitRun(['log', '--oneline', '-1'], FIXTURE_DIR);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.stdout.trim().length).toBeGreaterThan(0);
    }
  });

  it('returns ok with stdout for git status', async () => {
    const result = await gitRun(['status', '--short'], FIXTURE_DIR);
    expect(result.ok).toBe(true);
  });

  it('returns failure for invalid git command', async () => {
    const result = await gitRun(['not-a-real-command'], FIXTURE_DIR);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it('returns failure for non-git directory', async () => {
    const result = await gitRun(['log', '--oneline', '-1'], '/tmp');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('not a git repository');
    }
  });

  it('returns failure for nonexistent directory', async () => {
    const result = await gitRun(['status'], '/tmp/nonexistent-dir-99999');
    expect(result.ok).toBe(false);
  });

  it('captures multi-line stdout', async () => {
    const result = await gitRun(['log', '--oneline', '-5'], FIXTURE_DIR);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const lines = result.stdout.trim().split('\n');
      expect(lines.length).toBeGreaterThanOrEqual(5);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mcp/testkit && npx vitest run ../shared/git-utils.test.ts 2>&1 | tail -10`
Expected: FAIL — cannot find module

- [ ] **Step 3: Write the implementation**

Create `mcp/shared/git-utils.ts`:

```typescript
/**
 * git-utils.ts — Shared git command wrapper with structured error handling.
 *
 * Returns a discriminated union instead of silently returning empty strings.
 * Callers choose to degrade gracefully, but the failure reason is captured
 * and reportable.
 *
 * Uses execFile (array-based args, no shell) — never exec.
 *
 * Used by timewarp (history.ts, trends.ts) and lenskit (churn.ts).
 */

import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

const execFilePromise = promisify(execFileCb);

export type GitResult =
  | { ok: true; stdout: string }
  | { ok: false; reason: string };

/**
 * Run a git command and return structured result.
 *
 * @param args - Arguments to pass to `git` (e.g. `['log', '--oneline', '-5']`)
 * @param cwd - Working directory for the git command
 * @param maxBuffer - Max stdout buffer in bytes (default 10MB)
 */
export async function gitRun(
  args: string[],
  cwd: string,
  maxBuffer = 10 * 1024 * 1024,
): Promise<GitResult> {
  try {
    const { stdout } = await execFilePromise('git', args, { cwd, maxBuffer });
    return { ok: true, stdout };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Normalize common git errors for easier matching
    const reason = message.toLowerCase().includes('not a git repository')
      ? 'not a git repository'
      : message;
    return { ok: false, reason };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mcp/testkit && npx vitest run ../shared/git-utils.test.ts 2>&1 | tail -15`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add mcp/shared/git-utils.ts mcp/shared/git-utils.test.ts
git commit -m "feat: add shared git command wrapper with structured error handling"
```

---

### Task 7: Verify all shared infrastructure works together

**Files:** (no new files)

- [ ] **Step 1: Run all shared tests**

Run: `cd mcp/testkit && npx vitest run ../shared/ 2>&1 | tail -20`
Expected: All tests pass across tsconfig-resolver, python-patterns, and git-utils

- [ ] **Step 2: Run existing testkit tests to verify no regressions**

Run: `cd mcp/testkit && npx vitest run 2>&1 | tail -10`
Expected: All existing tests still pass

- [ ] **Step 3: Verify test fixture git history is intact**

Run: `cd mcp/test-fixtures && git log --oneline | wc -l`
Expected: 15

- [ ] **Step 4: Verify root test script**

Run: `npm test 2>&1 | tail -20`
Expected: All servers' tests pass

- [ ] **Step 5: Build all servers**

Run: `npm run build 2>&1 | tail -20`
Expected: Clean build for all 4 servers

- [ ] **Step 6: Final commit if any fixes were needed**

Only if steps 1-5 revealed issues that needed fixing:

```bash
git add -A
git commit -m "fix: resolve integration issues in shared infrastructure"
```
