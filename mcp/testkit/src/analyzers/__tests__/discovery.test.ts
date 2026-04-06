import { describe, it, expect } from 'vitest';
import { inferSourcePath, classifyCriticality, isTestFile } from '../discovery.js';

describe('inferSourcePath', () => {
  it('infers source from .test. file in same directory', () => {
    const result = inferSourcePath('src/utils/helper.test.ts');
    expect(result).toBe('src/utils/helper.ts');
  });

  it('infers source from .spec. file in same directory', () => {
    const result = inferSourcePath('src/utils/helper.spec.ts');
    expect(result).toBe('src/utils/helper.ts');
  });

  it('infers source from __tests__ directory to parent', () => {
    const result = inferSourcePath('src/utils/__tests__/helper.test.ts');
    expect(result).toBe('src/utils/helper.ts');
  });

  it('returns null for files that do not match test naming patterns', () => {
    const result = inferSourcePath('src/utils/helper.ts');
    expect(result).toBeNull();
  });

  it('handles .tsx test files', () => {
    const result = inferSourcePath('src/components/Button.test.tsx');
    expect(result).toBe('src/components/Button.tsx');
  });

  it('handles .js test files', () => {
    const result = inferSourcePath('src/utils/helper.test.js');
    expect(result).toBe('src/utils/helper.js');
  });

  it('infers source from tests/ to src/ directory mirror', () => {
    const result = inferSourcePath('tests/utils/helper.test.ts');
    expect(result).toBe('tests/utils/helper.ts');
  });

  it('resolves __tests__/ test to sibling directory when cwd provided', () => {
    // The plugin itself has this structure:
    // src/__tests__/discovery.test.ts → should resolve to src/analyzers/discovery.ts
    const result = inferSourcePath('src/__tests__/discovery.test.ts', process.cwd());
    expect(result).toBe('src/analyzers/discovery.ts');
  });

  it('handles Python test files with test_ prefix', () => {
    const result = inferSourcePath('tests/test_utils.py');
    expect(result).toBe('tests/utils.py');
  });

  it('handles Python test files with _test suffix', () => {
    const result = inferSourcePath('tests/utils_test.py');
    expect(result).toBe('tests/utils.py');
  });
});

describe('classifyCriticality', () => {
  it('classifies auth files as high priority', () => {
    const result = classifyCriticality('src/services/auth-service.ts');
    expect(result.priority).toBe('high');
  });

  it('classifies payment files as high priority', () => {
    const result = classifyCriticality('src/services/payment-processor.ts');
    expect(result.priority).toBe('high');
  });

  it('classifies security files as high priority', () => {
    const result = classifyCriticality('src/middleware/security.ts');
    expect(result.priority).toBe('high');
  });

  it('classifies webhook files as high priority', () => {
    const result = classifyCriticality('src/routes/webhook-handler.ts');
    expect(result.priority).toBe('high');
  });

  it('classifies admin files as high priority', () => {
    const result = classifyCriticality('src/routes/admin-panel.ts');
    expect(result.priority).toBe('high');
  });

  it('classifies service files as medium priority', () => {
    const result = classifyCriticality('src/services/user-service.ts');
    expect(result.priority).toBe('medium');
  });

  it('classifies controller files as medium priority', () => {
    const result = classifyCriticality('src/controllers/user-controller.ts');
    expect(result.priority).toBe('medium');
  });

  it('classifies queue files as medium priority', () => {
    const result = classifyCriticality('src/queue/email-queue.ts');
    expect(result.priority).toBe('medium');
  });

  it('classifies worker files as medium priority', () => {
    const result = classifyCriticality('src/workers/email-worker.ts');
    expect(result.priority).toBe('medium');
  });

  it('classifies job files as medium priority', () => {
    const result = classifyCriticality('src/jobs/cleanup-job.ts');
    expect(result.priority).toBe('medium');
  });

  it('classifies utility files as low priority', () => {
    const result = classifyCriticality('src/utils/format.ts');
    expect(result.priority).toBe('low');
  });

  it('classifies unknown files as low priority', () => {
    const result = classifyCriticality('src/lib/helpers.ts');
    expect(result.priority).toBe('low');
  });
});

describe('isTestFile', () => {
  it('detects .test. files as test files', () => {
    expect(isTestFile('src/utils/helper.test.ts')).toBe(true);
  });

  it('detects .spec. files as test files', () => {
    expect(isTestFile('src/utils/helper.spec.ts')).toBe(true);
  });

  it('detects __tests__ directory files as test files', () => {
    expect(isTestFile('src/utils/__tests__/helper.ts')).toBe(true);
  });

  it('does not flag regular source files as test files', () => {
    expect(isTestFile('src/utils/helper.ts')).toBe(false);
  });

  it('detects Python test_ prefix files as test files', () => {
    expect(isTestFile('tests/test_utils.py')).toBe(true);
  });

  it('detects Python _test suffix files as test files', () => {
    expect(isTestFile('tests/utils_test.py')).toBe(true);
  });
});
