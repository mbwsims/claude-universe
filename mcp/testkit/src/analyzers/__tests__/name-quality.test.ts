import { describe, it, expect } from 'vitest';
import { analyzeNameQuality } from '../name-quality.js';

describe('analyzeNameQuality', () => {
  it('returns zero for file with no test names', () => {
    const content = `const x = 1;`;
    const result = analyzeNameQuality(content);
    expect(result.total).toBe(0);
    expect(result.vague).toBe(0);
  });

  it('does not flag descriptive test names', () => {
    const content = `
      test('rejects empty email with ValidationError', () => {});
      test('returns empty array when search matches nothing', () => {});
      test('applies 20% discount for gold members', () => {});
    `;
    const result = analyzeNameQuality(content);
    expect(result.total).toBe(3);
    expect(result.vague).toBe(0);
  });

  it('flags names with fewer than 4 words', () => {
    const content = `test('it works', () => {});`;
    const result = analyzeNameQuality(content);
    expect(result.vague).toBe(1);
    expect(result.vagueNames[0].reason).toBe('fewer than 4 words');
  });

  it('flags names with only generic terms', () => {
    const content = `test('handles test works correctly', () => {});`;
    const result = analyzeNameQuality(content);
    expect(result.vague).toBe(1);
    expect(result.vagueNames[0].reason).toBe('mostly generic terms');
  });

  it('flags numbered test names', () => {
    const content = `test('test 1', () => {});`;
    const result = analyzeNameQuality(content);
    expect(result.vague).toBe(1);
  });

  it('handles it() the same as test()', () => {
    const content = `it('works', () => {});`;
    const result = analyzeNameQuality(content);
    expect(result.total).toBe(1);
    expect(result.vague).toBe(1);
  });

  it('counts total test names correctly with mix', () => {
    const content = `
      test('rejects empty email with ValidationError', () => {});
      test('works', () => {});
      it('handles correctly', () => {});
      test('creates user with valid email and returns 201 status', () => {});
    `;
    const result = analyzeNameQuality(content);
    expect(result.total).toBe(4);
    expect(result.vague).toBe(2);
  });

  it('reports correct line numbers', () => {
    const content = `// line 1
// line 2
test('works', () => {});
// line 4
test('also works', () => {});`;
    const result = analyzeNameQuality(content);
    expect(result.vagueNames[0].line).toBe(3);
    expect(result.vagueNames[1].line).toBe(5);
  });

  it('handles backtick template strings in test names', () => {
    const content = "test(`returns correct value for input`, () => {});";
    const result = analyzeNameQuality(content);
    expect(result.total).toBe(1);
    expect(result.vague).toBe(0);
  });
});
