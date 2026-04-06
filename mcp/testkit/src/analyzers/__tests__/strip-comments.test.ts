import { describe, it, expect } from 'vitest';
import { stripComments } from '../strip-comments.js';

describe('stripComments', () => {
  it('strips JS single-line comments', () => {
    expect(stripComments('code // comment')).toBe('code ');
  });

  it('strips JS block comments preserving line count', () => {
    const input = 'before\n/* line1\nline2 */\nafter';
    const result = stripComments(input);
    expect(result.split('\n').length).toBe(4);
    expect(result).toContain('before');
    expect(result).toContain('after');
    expect(result).not.toContain('line1');
  });

  it('strips Python single-line comments', () => {
    expect(stripComments('x = 1  # set x').trim()).toBe('x = 1');
  });

  it('strips Python comment at start of line', () => {
    expect(stripComments('# full line comment').trim()).toBe('');
  });

  it('does NOT strip # inside single-quoted strings', () => {
    const input = "color = '#ff0000'";
    expect(stripComments(input)).toBe(input);
  });

  it('does NOT strip # inside double-quoted strings', () => {
    const input = 'tag = "#hashtag"';
    expect(stripComments(input)).toBe(input);
  });

  // M2: // inside strings should NOT be stripped
  it('does NOT strip // inside single-quoted strings', () => {
    const input = "const url = 'http://example.com/path';";
    expect(stripComments(input)).toBe(input);
  });

  it('does NOT strip // inside double-quoted strings', () => {
    const input = 'const url = "http://example.com/path";';
    expect(stripComments(input)).toBe(input);
  });

  it('does NOT strip // inside template literals', () => {
    const input = 'const url = `http://example.com/path`;';
    expect(stripComments(input)).toBe(input);
  });

  // M3: # mid-string should NOT be stripped
  it('does NOT strip # mid-string (page#anchor)', () => {
    const input = "url = 'page#anchor'";
    expect(stripComments(input)).toBe(input);
  });

  it('does NOT strip # mid-string in double quotes', () => {
    const input = 'url = "page#anchor"';
    expect(stripComments(input)).toBe(input);
  });

  // Mixed: string then comment on same line
  it('preserves string content but strips trailing comment', () => {
    const input = "const x = 'hello'; // greeting";
    expect(stripComments(input)).toBe("const x = 'hello'; ");
  });

  it('preserves string with // then strips Python comment', () => {
    const input = "url = 'http://example.com'  # the url";
    expect(stripComments(input)).toBe("url = 'http://example.com'  ");
  });

  // Escaped quotes inside strings
  it('handles escaped quotes inside strings', () => {
    const input = "const s = 'it\\'s a // test';";
    expect(stripComments(input)).toBe(input);
  });
});
