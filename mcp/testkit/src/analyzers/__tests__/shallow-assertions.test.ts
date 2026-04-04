import { describe, it, expect } from 'vitest';
import { analyzeShallowAssertions } from '../shallow-assertions.js';

describe('analyzeShallowAssertions', () => {
  it('returns zero counts for file with no assertions', () => {
    const result = analyzeShallowAssertions('const x = 1;\nconsole.log(x);');
    expect(result).toEqual({ count: 0, total: 0, locations: [] });
  });

  it('returns zero shallow for file with only deep assertions', () => {
    const content = `
      expect(result).toEqual({ id: '123', name: 'Alice' });
      expect(value).toBe(42);
      expect(arr).toHaveLength(3);
      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    `;
    const result = analyzeShallowAssertions(content);
    expect(result.count).toBe(0);
    expect(result.total).toBe(4);
  });

  it('detects toBeDefined as shallow', () => {
    const content = `expect(user).toBeDefined();`;
    const result = analyzeShallowAssertions(content);
    expect(result.count).toBe(1);
    expect(result.locations[0].kind).toBe('toBeDefined');
    expect(result.locations[0].line).toBe(1);
  });

  it('detects toBeTruthy as shallow', () => {
    const content = `expect(isValid).toBeTruthy();`;
    const result = analyzeShallowAssertions(content);
    expect(result.count).toBe(1);
    expect(result.locations[0].kind).toBe('toBeTruthy');
  });

  it('detects toBeFalsy as shallow', () => {
    const content = `expect(result).toBeFalsy();`;
    const result = analyzeShallowAssertions(content);
    expect(result.count).toBe(1);
    expect(result.locations[0].kind).toBe('toBeFalsy');
  });

  it('detects bare toHaveBeenCalled without arguments', () => {
    const content = `expect(mockFn).toHaveBeenCalled();`;
    const result = analyzeShallowAssertions(content);
    expect(result.count).toBe(1);
    expect(result.locations[0].kind).toBe('bareToHaveBeenCalled');
  });

  it('does not flag toHaveBeenCalledWith as shallow', () => {
    const content = `expect(mockFn).toHaveBeenCalledWith('arg1');`;
    const result = analyzeShallowAssertions(content);
    expect(result.count).toBe(0);
  });

  it('counts total expect calls as denominator', () => {
    const content = `
      expect(a).toBeDefined();
      expect(b).toEqual(42);
      expect(c).toBe('hello');
    `;
    const result = analyzeShallowAssertions(content);
    expect(result.total).toBe(3);
    expect(result.count).toBe(1);
  });

  it('handles multiple shallow assertions on different lines', () => {
    const content = `
      expect(a).toBeDefined();
      expect(b).toBeTruthy();
      expect(c).toBeNull();
      expect(d).toEqual('real value');
    `;
    const result = analyzeShallowAssertions(content);
    expect(result.count).toBe(3);
    expect(result.total).toBe(4);
    expect(result.locations.map(l => l.line)).toEqual([2, 3, 4]);
  });

  it('reports correct line numbers', () => {
    const content = `line 1
line 2
expect(x).toBeDefined();
line 4
expect(y).toBeTruthy();`;
    const result = analyzeShallowAssertions(content);
    expect(result.locations[0].line).toBe(3);
    expect(result.locations[1].line).toBe(5);
  });
});
