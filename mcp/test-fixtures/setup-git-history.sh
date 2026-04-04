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
