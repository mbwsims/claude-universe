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

// Updated deps
