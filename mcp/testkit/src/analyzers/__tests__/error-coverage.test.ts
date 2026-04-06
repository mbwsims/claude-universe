import { describe, it, expect } from 'vitest';
import { analyzeErrorCoverage } from '../error-coverage.js';

describe('analyzeErrorCoverage', () => {
  it('returns ratio 1 when source has no throwable operations', () => {
    const source = `export function add(a, b) { return a + b; }`;
    const test = `test('adds', () => { expect(add(1, 2)).toBe(3); });`;
    const result = analyzeErrorCoverage(source, test);
    expect(result.throwable).toBe(0);
    expect(result.ratio).toBe(1);
  });

  it('detects throw new as throwable', () => {
    const source = `
      function validate(email) {
        if (!email) throw new Error('Email required');
        return true;
      }
    `;
    const test = `test('validates', () => {});`;
    const result = analyzeErrorCoverage(source, test);
    expect(result.throwable).toBe(1);
    expect(result.throwableLocations[0].text).toContain('throw new');
  });

  it('detects throw with variable as throwable', () => {
    const source = `
      const err = new Error('bad');
      throw err;
    `;
    const test = `test('x', () => {});`;
    const result = analyzeErrorCoverage(source, test);
    expect(result.throwable).toBe(1);
  });

  it('detects Promise.reject as throwable', () => {
    const source = `return Promise.reject(new Error('failed'));`;
    const test = `test('x', () => {});`;
    const result = analyzeErrorCoverage(source, test);
    expect(result.throwable).toBe(1);
  });

  it('detects .toThrow in tests as error test', () => {
    const source = `throw new Error('bad');`;
    const test = `expect(() => fn()).toThrow('bad');`;
    const result = analyzeErrorCoverage(source, test);
    expect(result.tested).toBe(1);
  });

  it('detects .rejects in tests as error test', () => {
    const source = `throw new Error('bad');`;
    const test = `await expect(fn()).rejects.toThrow('bad');`;
    const result = analyzeErrorCoverage(source, test);
    expect(result.tested).toBe(1);
  });

  it('calculates correct ratio', () => {
    const source = `
      throw new Error('one');
      throw new Error('two');
      throw new Error('three');
      throw new Error('four');
    `;
    const test = `
      expect(() => fn()).toThrow('one');
      expect(() => fn()).toThrow('two');
    `;
    const result = analyzeErrorCoverage(source, test);
    expect(result.throwable).toBe(4);
    expect(result.tested).toBe(2);
    expect(result.ratio).toBe(0.5);
  });

  it('does not flag bare reject() in Promise constructor as throwable', () => {
    const source = `
      return new Promise((resolve, reject) => {
        resolve('ok');
      });
    `;
    const test = `test('x', () => {});`;
    const result = analyzeErrorCoverage(source, test);
    // The Promise constructor pattern should not be flagged
    // Only .reject( and Promise.reject( should count
    expect(result.throwable).toBe(0);
  });

  it('does not flag methods ending in reject like onReject as throwable', () => {
    const source = `
      function onReject(reason) {
        console.log(reason);
      }
      onReject('something');
    `;
    const test = `test('x', () => {});`;
    const result = analyzeErrorCoverage(source, test);
    expect(result.throwable).toBe(0);
  });

  it('ignores throwable operations inside comments', () => {
    const source = `
      // throw new Error('old code');
      /* throw new Error('disabled'); */
      return 'ok';
    `;
    const test = `test('x', () => {});`;
    const result = analyzeErrorCoverage(source, test);
    expect(result.throwable).toBe(0);
  });

  it('ignores error test patterns inside comments in test file', () => {
    const source = `throw new Error('fail');`;
    const test = `
      // expect(() => fn()).toThrow('old');
      /* .rejects.toThrow() */
      test('x', () => {});
    `;
    const result = analyzeErrorCoverage(source, test);
    expect(result.tested).toBe(0);
  });
});

describe('analyzeErrorCoverage — Python patterns', () => {
  it('detects raise as throwable', () => {
    const source = `
      def validate(email):
          if not email:
              raise ValueError("Email required")
    `;
    const test = `def test_x(): pass`;
    const result = analyzeErrorCoverage(source, test);
    expect(result.throwable).toBe(1);
    expect(result.throwableLocations[0].text).toContain('raise');
  });

  it('detects bare raise (re-raise) as throwable', () => {
    const source = `
      try:
          do_something()
      except Exception:
          raise
    `;
    const test = `def test_x(): pass`;
    const result = analyzeErrorCoverage(source, test);
    expect(result.throwable).toBe(1);
  });

  it('detects pytest.raises in test as error test', () => {
    const source = `raise ValueError("bad")`;
    const test = `
      def test_validation():
          with pytest.raises(ValueError):
              validate("")
    `;
    const result = analyzeErrorCoverage(source, test);
    expect(result.tested).toBe(1);
  });

  it('detects self.assertRaises in test as error test', () => {
    const source = `raise ValueError("bad")`;
    const test = `
      def test_validation(self):
          with self.assertRaises(ValueError):
              validate("")
    `;
    const result = analyzeErrorCoverage(source, test);
    expect(result.tested).toBe(1);
  });

  it('calculates correct ratio for Python code', () => {
    const source = `
      def process(data):
          if not data:
              raise ValueError("empty data")
          if data.get("type") not in ["a", "b"]:
              raise TypeError("invalid type")
          return transform(data)
    `;
    const test = `
      def test_empty_data():
          with pytest.raises(ValueError):
              process({})
    `;
    const result = analyzeErrorCoverage(source, test);
    expect(result.throwable).toBe(2);
    expect(result.tested).toBe(1);
    expect(result.ratio).toBe(0.5);
  });
});
