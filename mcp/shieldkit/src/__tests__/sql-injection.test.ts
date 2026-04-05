import { describe, it, expect } from 'vitest';
import { analyzeSqlInjection } from '../analyzers/sql-injection.js';

describe('sql-injection', () => {
  describe('basic detection', () => {
    it('should detect template literal SQL injection', () => {
      const content = 'const q = `SELECT * FROM users WHERE id = ${userId}`;';
      const result = analyzeSqlInjection(content);
      expect(result.count).toBe(1);
      expect(result.locations[0].pattern).toBe('template-literal-interpolation');
    });

    it('should detect string concatenation SQL injection', () => {
      const content = `const q = "SELECT * FROM users WHERE id = " + userId;`;
      const result = analyzeSqlInjection(content);
      expect(result.count).toBe(1);
      expect(result.locations[0].pattern).toBe('string-concatenation');
    });

    it('should detect multi-line template literal SQL injection', () => {
      const content = `const q = \`
  SELECT * FROM users
  WHERE id = \${userId}
  AND active = true
\`;`;
      const result = analyzeSqlInjection(content);
      expect(result.count).toBe(1);
    });

    it('should NOT flag parameterized queries', () => {
      const content = `const q = db.query("SELECT * FROM users WHERE id = $1", [userId]);`;
      const result = analyzeSqlInjection(content);
      expect(result.count).toBe(0);
    });
  });

  describe('test file exclusion', () => {
    it('should NOT flag SQL in test files', () => {
      const content = 'const q = `SELECT * FROM users WHERE id = ${userId}`;';
      const result = analyzeSqlInjection(content, 'src/db.test.ts');
      expect(result.count).toBe(0);
    });

    it('should NOT flag SQL in spec files', () => {
      const content = 'const q = `SELECT * FROM users WHERE id = ${userId}`;';
      const result = analyzeSqlInjection(content, 'src/db.spec.ts');
      expect(result.count).toBe(0);
    });

    it('should NOT flag SQL in __tests__ directory', () => {
      const content = 'const q = `SELECT * FROM users WHERE id = ${userId}`;';
      const result = analyzeSqlInjection(content, 'src/__tests__/db.ts');
      expect(result.count).toBe(0);
    });

    it('should still flag SQL in non-test files', () => {
      const content = 'const q = `SELECT * FROM users WHERE id = ${userId}`;';
      const result = analyzeSqlInjection(content, 'src/db.ts');
      expect(result.count).toBe(1);
    });
  });

  describe('nested template literal handling', () => {
    it('should handle nested template literals inside ${}', () => {
      const content = 'const q = `SELECT * FROM ${getTable(`users`)} WHERE id = ${userId}`;';
      const result = analyzeSqlInjection(content);
      expect(result.count).toBe(1);
    });
  });

  describe('comment stripping', () => {
    it('should NOT flag SQL in single-line comments', () => {
      const content = `// const q = \`SELECT * FROM users WHERE id = \${userId}\`;`;
      const result = analyzeSqlInjection(content);
      expect(result.count).toBe(0);
    });

    it('should NOT flag SQL in multi-line comments', () => {
      const content = `/* const q = \`SELECT * FROM users WHERE id = \${userId}\`; */`;
      const result = analyzeSqlInjection(content);
      expect(result.count).toBe(0);
    });

    it('should NOT flag SQL in JSDoc comments', () => {
      const content = `/**
 * Example: \`SELECT * FROM users WHERE id = \${userId}\`
 */`;
      const result = analyzeSqlInjection(content);
      expect(result.count).toBe(0);
    });
  });

  describe('Python f-string detection', () => {
    it('should detect Python f-string SQL injection', () => {
      const content = `query = f"SELECT * FROM users WHERE name = '{user_input}'"`;
      const result = analyzeSqlInjection(content);
      expect(result.count).toBe(1);
      expect(result.locations[0].pattern).toBe('python-f-string-interpolation');
    });

    it('should detect Python format-string SQL injection', () => {
      const content = `query = "SELECT * FROM users WHERE name = '%s'" % user_input`;
      const result = analyzeSqlInjection(content);
      expect(result.count).toBe(1);
      expect(result.locations[0].pattern).toBe('python-format-interpolation');
    });

    it('should NOT flag Python parameterized queries', () => {
      const content = `cursor.execute("SELECT * FROM users WHERE name = %s", [user_input])`;
      const result = analyzeSqlInjection(content);
      expect(result.count).toBe(0);
    });
  });

  describe('false positive avoidance', () => {
    it('should NOT flag ORM method chains', () => {
      const content = `const users = await prisma.user.findMany({ where: { id: userId } });`;
      const result = analyzeSqlInjection(content);
      expect(result.count).toBe(0);
    });

    it('should NOT flag query builder patterns', () => {
      const content = `const users = await knex("users").where("id", userId).select("*");`;
      const result = analyzeSqlInjection(content);
      expect(result.count).toBe(0);
    });
  });

  describe('false-positive regression suite', () => {
    const knownSafePatterns = [
      // Parameterized queries (JS/TS)
      `db.query("SELECT * FROM users WHERE id = $1", [userId]);`,
      `await prisma.user.findMany({ where: { id: userId } });`,
      `knex("users").where("id", userId).select("*");`,
      `sequelize.query("SELECT * FROM users WHERE id = ?", { replacements: [userId] });`,
      // Parameterized queries (Python)
      `cursor.execute("SELECT * FROM users WHERE id = %s", [user_id])`,
      `db.session.execute(text("SELECT * FROM users WHERE id = :id"), {"id": user_id})`,
      // String literals without interpolation
      `const sql = "SELECT * FROM users WHERE active = true";`,
      `const sql = "DELETE FROM sessions WHERE expires_at < NOW()";`,
      // Comments containing SQL
      `// This query: SELECT * FROM users WHERE id = \${userId}`,
      `/* DELETE FROM users WHERE id = \${dangerous} */`,
      // ORM calls
      `const users = await User.findAll({ where: { active: true } });`,
      `const user = await User.findByPk(id);`,
    ];

    for (const pattern of knownSafePatterns) {
      it(`should NOT flag: ${pattern.slice(0, 60)}...`, () => {
        const result = analyzeSqlInjection(pattern);
        expect(result.count, `False positive on: ${pattern}`).toBe(0);
      });
    }

    it('should NOT flag SQL injection patterns in test files', () => {
      const content = 'const q = `SELECT * FROM users WHERE id = ${userId}`;';
      const result = analyzeSqlInjection(content, 'tests/db.test.ts');
      expect(result.count).toBe(0);
    });
  });
});
