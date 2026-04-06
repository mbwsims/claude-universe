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

  it('flags names with fewer than 3 words', () => {
    const content = `test('it works', () => {});`;
    const result = analyzeNameQuality(content);
    expect(result.vague).toBe(1);
    expect(result.vagueNames[0].reason).toBe('fewer than 3 words');
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

  it('does not flag 3-word test names that contain domain-specific terms', () => {
    const content = `
      test('rejects empty email', () => {});
      test('validates OAuth token', () => {});
      test('handles ConnectionError gracefully', () => {});
    `;
    const result = analyzeNameQuality(content);
    expect(result.total).toBe(3);
    expect(result.vague).toBe(0);
  });

  it('does not treat handles as a generic term', () => {
    const content = `test('handles concurrent requests without data loss', () => {});`;
    const result = analyzeNameQuality(content);
    expect(result.total).toBe(1);
    expect(result.vague).toBe(0);
  });

  it('still flags 2-word names as too short', () => {
    const content = `test('it works', () => {});`;
    const result = analyzeNameQuality(content);
    expect(result.vague).toBe(1);
    expect(result.vagueNames[0].reason).toBe('fewer than 3 words');
  });

  it('considers camelCase words as domain-specific and does not flag short names with them', () => {
    const content = `
      test('returns userId correctly', () => {});
      test('throws ValidationError', () => {});
    `;
    const result = analyzeNameQuality(content);
    expect(result.total).toBe(2);
    expect(result.vague).toBe(0);
  });
});

describe('inner quotes do not truncate test names', () => {
  it('handles double quotes inside single-quoted test name', () => {
    const content = `it('classifies "feat: add user auth" as feature', () => {});`;
    const result = analyzeNameQuality(content);
    expect(result.total).toBe(1);
    expect(result.vague).toBe(0);
    // The full name should be extracted, not truncated at the inner "
    expect(result.vagueNames).toHaveLength(0);
  });

  it('handles single quotes inside double-quoted test name', () => {
    const content = `it("rejects email with 'invalid' format", () => {});`;
    const result = analyzeNameQuality(content);
    expect(result.total).toBe(1);
    expect(result.vague).toBe(0);
  });

  it('handles single quotes inside backtick test name', () => {
    const content = "it(`handles the 'edge' case for empty input`, () => {});";
    const result = analyzeNameQuality(content);
    expect(result.total).toBe(1);
    expect(result.vague).toBe(0);
  });
});

describe('analyzeNameQuality — Python patterns', () => {
  it('extracts Python test names from def test_ prefix', () => {
    const content = `
      def test_rejects_empty_email_with_validation_error():
          pass

      def test_returns_empty_list_when_no_results():
          pass
    `;
    const result = analyzeNameQuality(content);
    expect(result.total).toBe(2);
    expect(result.vague).toBe(0);
  });

  it('flags short Python test names', () => {
    const content = `
      def test_it():
          pass
    `;
    const result = analyzeNameQuality(content);
    expect(result.total).toBe(1);
    expect(result.vague).toBe(1);
  });

  it('flags generic Python test names', () => {
    const content = `
      def test_works_correctly():
          pass
    `;
    const result = analyzeNameQuality(content);
    expect(result.total).toBe(1);
    expect(result.vague).toBe(1);
  });

  it('does not flag descriptive Python test names', () => {
    const content = `
      def test_create_user_returns_valid_id():
          pass

      def test_delete_user_raises_not_found_error():
          pass
    `;
    const result = analyzeNameQuality(content);
    expect(result.total).toBe(2);
    expect(result.vague).toBe(0);
  });

  it('handles Python test class methods', () => {
    const content = `
    class TestUserService:
        def test_creates_user_with_valid_email(self):
            pass
    `;
    const result = analyzeNameQuality(content);
    expect(result.total).toBe(1);
    expect(result.vague).toBe(0);
  });
});
