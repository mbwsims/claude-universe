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
    // toBeNull is NOT shallow -- only toBeDefined and toBeTruthy are
    expect(result.count).toBe(2);
    expect(result.total).toBe(4);
    expect(result.locations.map(l => l.line)).toEqual([2, 3]);
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

  it('does not flag toBeNull as shallow since it tests a specific value', () => {
    const content = `
      expect(result).toBeNull();
      expect(other).toBe(42);
    `;
    const result = analyzeShallowAssertions(content);
    expect(result.count).toBe(0);
    expect(result.total).toBe(2);
  });

  it('does not flag toBeUndefined as shallow since it tests a specific value', () => {
    const content = `
      expect(result).toBeUndefined();
      expect(other).toBe('hello');
    `;
    const result = analyzeShallowAssertions(content);
    expect(result.count).toBe(0);
    expect(result.total).toBe(2);
  });

  it('ignores assertions inside single-line comments', () => {
    const content = `
      // expect(result).toBeDefined(); -- this is a comment
      expect(value).toBe(42);
    `;
    const result = analyzeShallowAssertions(content);
    expect(result.count).toBe(0);
    expect(result.total).toBe(1);
  });

  it('ignores assertions inside multi-line block comments', () => {
    const content = `
      /* expect(result).toBeTruthy(); */
      expect(value).toEqual({ id: '1' });
    `;
    const result = analyzeShallowAssertions(content);
    expect(result.count).toBe(0);
    expect(result.total).toBe(1);
  });
});

describe('.not.toHaveBeenCalled() exclusion', () => {
  it('does NOT flag .not.toHaveBeenCalled() as shallow', () => {
    const content = 'expect(mockFn).not.toHaveBeenCalled();';
    const result = analyzeShallowAssertions(content);
    // .not.toHaveBeenCalled() should not count as shallow
    const bareCalled = result.locations.filter(l => l.kind === 'bareToHaveBeenCalled');
    expect(bareCalled.length).toBe(0);
  });

  it('does NOT flag .not.toHaveBeenCalledWith() as shallow', () => {
    const content = "expect(mockFn).not.toHaveBeenCalledWith('arg');";
    const result = analyzeShallowAssertions(content);
    const bareCalled = result.locations.filter(l => l.kind === 'bareToHaveBeenCalled');
    expect(bareCalled.length).toBe(0);
  });

  it('still flags bare .toHaveBeenCalled() as shallow', () => {
    const content = 'expect(mockFn).toHaveBeenCalled();';
    const result = analyzeShallowAssertions(content);
    const bareCalled = result.locations.filter(l => l.kind === 'bareToHaveBeenCalled');
    expect(bareCalled.length).toBe(1);
  });
});

describe('analyzeShallowAssertions — Python patterns', () => {
  it('detects bare assert as shallow', () => {
    const content = `
      def test_user_creation():
          result = create_user("alice")
          assert result
    `;
    const result = analyzeShallowAssertions(content);
    expect(result.count).toBe(1);
    expect(result.locations[0].kind).toBe('bareAssert');
  });

  it('does not flag assert with comparison as shallow', () => {
    const content = `
      def test_user_creation():
          result = create_user("alice")
          assert result == {"name": "alice"}
          assert result.name == "alice"
          assert len(result) == 1
    `;
    const result = analyzeShallowAssertions(content);
    expect(result.count).toBe(0);
  });

  it('detects assert is not None as shallow', () => {
    const content = `
      def test_user_exists():
          user = get_user("alice")
          assert user is not None
    `;
    const result = analyzeShallowAssertions(content);
    expect(result.count).toBe(1);
    expect(result.locations[0].kind).toBe('assertIsNotNone');
  });

  it('counts Python assert statements in total assertion count', () => {
    const content = `
      def test_example():
          assert result
          assert value == 42
          assert name == "alice"
    `;
    const result = analyzeShallowAssertions(content);
    expect(result.total).toBeGreaterThanOrEqual(3);
    expect(result.count).toBe(1);  // only 'assert result' is shallow
  });

  it('does not flag assert with in operator as shallow', () => {
    const content = `
      def test_membership():
          assert "alice" in users
          assert key in config
    `;
    const result = analyzeShallowAssertions(content);
    expect(result.count).toBe(0);
  });

  it('does not flag assert with not or negation as shallow', () => {
    const content = `
      def test_not_equal():
          assert result != "error"
          assert not is_empty(data)
    `;
    const result = analyzeShallowAssertions(content);
    expect(result.count).toBe(0);
  });
});
