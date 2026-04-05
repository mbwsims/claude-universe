import { describe, it, expect } from 'vitest';
import { analyzeHardcodedSecrets, isExcludedFile } from '../analyzers/hardcoded-secrets.js';

describe('hardcoded-secrets', () => {
  describe('pk_ false positive removal', () => {
    it('should NOT flag Stripe publishable keys (pk_test_)', () => {
      const content = `const key = "pk_test_abc123def456";`;
      const result = analyzeHardcodedSecrets(content);
      expect(result.count).toBe(0);
      expect(result.locations).toHaveLength(0);
    });

    it('should NOT flag Stripe publishable keys (pk_live_)', () => {
      const content = `const stripeKey = "pk_live_xyz789";`;
      const result = analyzeHardcodedSecrets(content);
      expect(result.count).toBe(0);
      expect(result.locations).toHaveLength(0);
    });

    it('should still flag Stripe secret keys (sk-)', () => {
      const content = `const key = "sk-abc123def456ghi789";`;
      const result = analyzeHardcodedSecrets(content);
      expect(result.count).toBe(1);
      expect(result.locations[0].pattern).toBe('openai-secret-key');
    });
  });

  describe('case-insensitive keyword patterns', () => {
    it('should flag PASSWORD (uppercase)', () => {
      const content = `const PASSWORD = "hunter2hunter2";`;
      const result = analyzeHardcodedSecrets(content);
      expect(result.count).toBe(1);
      expect(result.locations[0].pattern).toBe('password-assignment');
    });

    it('should flag Password (mixed case)', () => {
      const content = `const Password = "hunter2hunter2";`;
      const result = analyzeHardcodedSecrets(content);
      expect(result.count).toBe(1);
      expect(result.locations[0].pattern).toBe('password-assignment');
    });

    it('should flag APIKEY (uppercase)', () => {
      const content = `const APIKEY = "abcdef123456";`;
      const result = analyzeHardcodedSecrets(content);
      expect(result.count).toBe(1);
      expect(result.locations[0].pattern).toBe('api-key-assignment');
    });

    it('should flag SECRET (uppercase)', () => {
      const content = `const SECRET = "mysecretvalue123";`;
      const result = analyzeHardcodedSecrets(content);
      expect(result.count).toBe(1);
      expect(result.locations[0].pattern).toBe('secret-assignment');
    });

    it('should flag TOKEN (uppercase)', () => {
      const content = `const TOKEN = "mytoken123456";`;
      const result = analyzeHardcodedSecrets(content);
      expect(result.count).toBe(1);
      expect(result.locations[0].pattern).toBe('token-assignment');
    });
  });

  describe('minimum value length and placeholder exclusions', () => {
    it('should NOT flag empty string values', () => {
      const content = `const password = "";`;
      const result = analyzeHardcodedSecrets(content);
      expect(result.count).toBe(0);
    });

    it('should NOT flag single-character values', () => {
      const content = `const password = "x";`;
      const result = analyzeHardcodedSecrets(content);
      expect(result.count).toBe(0);
    });

    it('should NOT flag common placeholder values', () => {
      const lines = [
        `const password = "your-password-here";`,
        `const password = "changeme";`,
        `const password = "REPLACE_ME";`,
        `const apiKey = "your-api-key-here";`,
        `const secret = "example-secret";`,
        `const token = "xxxx";`,
        `const password = "password123";  // TODO: change this`,
      ];
      for (const line of lines) {
        const result = analyzeHardcodedSecrets(line);
        expect(result.count, `should not flag: ${line}`).toBe(0);
      }
    });

    it('should still flag real-looking secret values', () => {
      const content = `const password = "aR$7kL9mNx2pQw4v";`;
      const result = analyzeHardcodedSecrets(content);
      expect(result.count).toBe(1);
    });

    it('should NOT flag process.env references', () => {
      const content = `const password = process.env.PASSWORD;`;
      const result = analyzeHardcodedSecrets(content);
      expect(result.count).toBe(0);
    });
  });

  describe('entropy-based detection', () => {
    it('should flag high-entropy strings in secret-like assignments', () => {
      // This string has high Shannon entropy (23 chars, entropy ~4.52)
      // Use a variable name that matches entropy context but NOT keyword patterns
      const content = `const signing_key = "X7k9M2jQ4pR8sW3vL5nB6tY";`;
      const result = analyzeHardcodedSecrets(content);
      expect(result.count).toBe(1);
      expect(result.locations[0].pattern).toBe('high-entropy-string');
    });

    it('should NOT flag low-entropy strings in assignments', () => {
      const content = `const greeting = "hello world this is a test";`;
      const result = analyzeHardcodedSecrets(content);
      expect(result.count).toBe(0);
    });

    it('should NOT flag repeated-character strings', () => {
      const content = `const separator = "================";`;
      const result = analyzeHardcodedSecrets(content);
      expect(result.count).toBe(0);
    });

    it('should only apply entropy check to secret-context variable names', () => {
      // Variable name has no secret keywords, even though value is high-entropy
      const content = `const greeting = "X7k9M2jQ4pR8sW3vL5nB6tY";`;
      const result = analyzeHardcodedSecrets(content);
      expect(result.count).toBe(0);
    });

    it('should detect high-entropy values assigned to SECRET_KEY-like vars', () => {
      const content = `const SECRET_KEY = "aB3cD5eF7gH9iJ1kL2mN4oP";`;
      const result = analyzeHardcodedSecrets(content);
      // Should be caught by either keyword pattern or entropy
      expect(result.count).toBe(1);
    });
  });

  describe('false-positive regression suite', () => {
    const knownSafePatterns = [
      // Environment variable references
      `const dbUrl = process.env.DATABASE_URL;`,
      `const secret = process.env.JWT_SECRET || '';`,
      // Import statements
      `import { password } from './config';`,
      `const { apiKey } = require('./env');`,
      // Type definitions
      `interface Config { password: string; apiKey: string; }`,
      `type Secret = { token: string };`,
      // Comments
      `// The password is stored securely in the vault`,
      `/* apiKey is loaded from environment */`,
      // Template strings without actual values
      `const msg = "Enter your password:";`,
      `const label = "API Key";`,
      // Placeholder values
      `const password = "placeholder";`,
      `const token = "TODO: set this";`,
      // Short values
      `const password = "test";`,
      `const secret = "dev";`,
      // Empty assignments
      `const password = "";`,
      `let token = '';`,
      // Stripe publishable keys
      `const STRIPE_PK = "pk_test_abc123def456ghi789jkl";`,
      `const key = "pk_live_abcdefghijklmnop";`,
    ];

    for (const pattern of knownSafePatterns) {
      it(`should NOT flag: ${pattern.slice(0, 60)}...`, () => {
        const result = analyzeHardcodedSecrets(pattern);
        expect(result.count, `False positive on: ${pattern}`).toBe(0);
      });
    }

    it('should NOT flag secrets in test files', () => {
      const content = `const password = "real-looking-secret-value-123";`;
      const result = analyzeHardcodedSecrets(content, 'src/auth.test.ts');
      expect(result.count).toBe(0);
    });

    it('should NOT flag secrets in .env.example', () => {
      const content = `JWT_SECRET=your-secret-here`;
      const result = analyzeHardcodedSecrets(content, '.env.example');
      expect(result.count).toBe(0);
    });
  });
});
