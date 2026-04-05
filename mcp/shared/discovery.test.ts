import { describe, it, expect } from 'vitest';
import { isTestFile, isDeclarationFile, IGNORE_PATTERNS, SOURCE_EXTENSIONS } from './discovery.js';

describe('isTestFile', () => {
  it('matches .test.ts files', () => {
    expect(isTestFile('src/utils/helper.test.ts')).toBe(true);
  });
  it('matches .spec.js files', () => {
    expect(isTestFile('src/api.spec.js')).toBe(true);
  });
  it('matches __tests__ directory', () => {
    expect(isTestFile('src/__tests__/helper.ts')).toBe(true);
  });
  it('matches Python test_ prefix', () => {
    expect(isTestFile('tests/test_utils.py')).toBe(true);
  });
  it('matches Go _test.go suffix', () => {
    expect(isTestFile('pkg/handler_test.go')).toBe(true);
  });
  it('does not match regular source files', () => {
    expect(isTestFile('src/utils/helper.ts')).toBe(false);
  });
  it('does not match files with test in name but wrong pattern', () => {
    expect(isTestFile('src/testing-utils.ts')).toBe(false);
  });
});

describe('isDeclarationFile', () => {
  it('matches .d.ts files', () => {
    expect(isDeclarationFile('src/types.d.ts')).toBe(true);
  });
  it('does not match regular .ts files', () => {
    expect(isDeclarationFile('src/types.ts')).toBe(false);
  });
});

describe('IGNORE_PATTERNS', () => {
  it('includes test-fixtures', () => {
    expect(IGNORE_PATTERNS).toContain('**/test-fixtures/**');
  });
  it('includes node_modules', () => {
    expect(IGNORE_PATTERNS).toContain('**/node_modules/**');
  });
});

describe('SOURCE_EXTENSIONS', () => {
  it('includes TypeScript', () => {
    expect(SOURCE_EXTENSIONS.has('.ts')).toBe(true);
  });
  it('includes Python', () => {
    expect(SOURCE_EXTENSIONS.has('.py')).toBe(true);
  });
  it('does not include Markdown', () => {
    expect(SOURCE_EXTENSIONS.has('.md')).toBe(false);
  });
});
