import { describe, it, expect } from 'vitest';
import { analyzeCorsConfig } from '../analyzers/cors-config.js';

describe('cors-config', () => {
  describe('basic detection', () => {
    it('should detect Access-Control-Allow-Origin wildcard', () => {
      const content = `res.setHeader("Access-Control-Allow-Origin", "*");`;
      const result = analyzeCorsConfig(content);
      expect(result.count).toBe(1);
    });

    it('should detect cors origin wildcard', () => {
      const content = `app.use(cors({ origin: '*' }));`;
      const result = analyzeCorsConfig(content);
      expect(result.count).toBe(1);
    });

    it('should detect cors origin true', () => {
      const content = `app.use(cors({ origin: true }));`;
      const result = analyzeCorsConfig(content);
      expect(result.count).toBe(1);
    });

    it('should NOT flag specific origin', () => {
      const content = `app.use(cors({ origin: 'https://example.com' }));`;
      const result = analyzeCorsConfig(content);
      expect(result.count).toBe(0);
    });
  });

  describe('variable-stored config detection', () => {
    it('should detect origin wildcard assigned to a variable used in cors()', () => {
      const content = `const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST'],
};

app.use(cors(corsOptions));`;
      const result = analyzeCorsConfig(content);
      expect(result.count).toBe(1);
    });

    it('should detect origin true in a config object', () => {
      const content = `const config = {
  cors: {
    origin: true,
    credentials: true,
  }
};`;
      const result = analyzeCorsConfig(content);
      expect(result.count).toBe(1);
    });
  });

  describe('expanded context window (10 lines)', () => {
    it('should detect origin wildcard 8 lines after cors import', () => {
      const lines = [
        'import cors from "cors";',
        '',
        '// Line 3',
        '// Line 4',
        '// Line 5',
        '// Line 6',
        '// Line 7',
        '// Line 8',
        '  origin: "*",',  // Line 9 -- 8 lines after cors
      ];
      const content = lines.join('\n');
      const result = analyzeCorsConfig(content);
      expect(result.count).toBe(1);
    });
  });

  describe('credentials:true + wildcard detection', () => {
    it('should flag credentials:true with wildcard origin', () => {
      const content = `app.use(cors({
  origin: '*',
  credentials: true,
}));`;
      const result = analyzeCorsConfig(content);
      expect(result.count).toBeGreaterThanOrEqual(1);
      // Check that at least one finding flags credentials
      const hasCredentialsWarning = result.locations.some(
        loc => loc.credentialsWithWildcard === true
      );
      expect(hasCredentialsWarning).toBe(true);
    });

    it('should flag credentials:true with origin:true', () => {
      const content = `const corsOpts = {
  origin: true,
  credentials: true,
};`;
      const result = analyzeCorsConfig(content);
      expect(result.count).toBeGreaterThanOrEqual(1);
    });
  });

  describe('false positive avoidance', () => {
    it('should NOT flag commented-out CORS config', () => {
      const content = `// app.use(cors({ origin: '*' }));`;
      const result = analyzeCorsConfig(content);
      expect(result.count).toBe(0);
    });

    it('should NOT flag origin in non-CORS context', () => {
      const content = `const origin = 'some-value';`;
      const result = analyzeCorsConfig(content);
      expect(result.count).toBe(0);
    });
  });

  describe('Python CORS detection', () => {
    it('should detect Django CORS_ALLOW_ALL_ORIGINS = True', () => {
      const content = `CORS_ALLOW_ALL_ORIGINS = True`;
      const result = analyzeCorsConfig(content);
      expect(result.count).toBe(1);
    });

    it('should detect Django CORS_ORIGIN_ALLOW_ALL = True', () => {
      const content = `CORS_ORIGIN_ALLOW_ALL = True`;
      const result = analyzeCorsConfig(content);
      expect(result.count).toBe(1);
    });

    it('should detect Flask-CORS wildcard origin', () => {
      const content = `CORS(app, origins="*")`;
      const result = analyzeCorsConfig(content);
      expect(result.count).toBe(1);
    });

    it('should detect Flask-CORS dict form wildcard', () => {
      const content = `CORS(app, resources={r"/*": {"origins": "*"}})`;
      const result = analyzeCorsConfig(content);
      expect(result.count).toBe(1);
    });

    it('should NOT detect Django CORS_ALLOW_ALL_ORIGINS = False', () => {
      const content = `CORS_ALLOW_ALL_ORIGINS = False`;
      const result = analyzeCorsConfig(content);
      expect(result.count).toBe(0);
    });
  });

  describe('false-positive regression suite', () => {
    const knownSafePatterns = [
      // Specific origins
      `app.use(cors({ origin: 'https://example.com' }));`,
      `app.use(cors({ origin: ['https://a.com', 'https://b.com'] }));`,
      // Origin in non-CORS context
      `const origin = window.location.origin;`,
      `const data = { origin: 'USA' };`,
      // Commented-out CORS
      `// app.use(cors({ origin: '*' }));`,
      `/* cors({ origin: true }) */`,
      // CORS with function origin (dynamic checking)
      `app.use(cors({ origin: (origin, cb) => cb(null, allowlist.includes(origin)) }));`,
    ];

    for (const pattern of knownSafePatterns) {
      it(`should NOT flag: ${pattern.slice(0, 60)}...`, () => {
        const result = analyzeCorsConfig(pattern);
        expect(result.count, `False positive on: ${pattern}`).toBe(0);
      });
    }
  });
});
