import { describe, it, expect } from 'vitest';
import { generateTestCandidates } from './test-coverage.js';

describe('generateTestCandidates', () => {
  it('generates standard JS/TS test candidates', () => {
    const candidates = generateTestCandidates('src/services/user-service.ts');
    expect(candidates).toContain('src/services/user-service.test.ts');
    expect(candidates).toContain('src/services/user-service.spec.ts');
    expect(candidates).toContain('src/services/__tests__/user-service.ts');
    expect(candidates).toContain('src/services/__tests__/user-service.test.ts');
  });

  it('generates tests/ directory mirror candidates', () => {
    const candidates = generateTestCandidates('src/services/user-service.ts');
    expect(candidates).toContain('tests/services/user-service.test.ts');
    expect(candidates).toContain('tests/services/user-service.spec.ts');
    expect(candidates).toContain('test/services/user-service.test.ts');
    expect(candidates).toContain('test/services/user-service.spec.ts');
  });

  it('generates Go test candidates (_test.go)', () => {
    const candidates = generateTestCandidates('internal/service/user.go');
    expect(candidates).toContain('internal/service/user_test.go');
  });

  it('generates Python test candidates (test_*.py)', () => {
    const candidates = generateTestCandidates('src/py/utils.py');
    expect(candidates).toContain('src/py/test_utils.py');
    expect(candidates).toContain('tests/py/test_utils.py');
    expect(candidates).toContain('test/py/test_utils.py');
  });

  it('generates Python _test.py candidate', () => {
    const candidates = generateTestCandidates('app/models.py');
    expect(candidates).toContain('app/models_test.py');
    expect(candidates).toContain('app/test_models.py');
  });

  it('handles files in root directory', () => {
    const candidates = generateTestCandidates('index.ts');
    expect(candidates).toContain('index.test.ts');
    expect(candidates).toContain('index.spec.ts');
  });

  it('generates candidates for nested src/ paths with tests/ mirror', () => {
    const candidates = generateTestCandidates('src/db/connection.ts');
    expect(candidates).toContain('tests/db/connection.test.ts');
    expect(candidates).toContain('test/db/connection.test.ts');
  });

  it('does not generate Go candidates for non-Go files', () => {
    const candidates = generateTestCandidates('src/index.ts');
    expect(candidates.every(c => !c.endsWith('_test.go'))).toBe(true);
  });
});
