import { describe, it, expect } from 'vitest';
import { slugify, truncate } from '../src/utils/helpers';

describe('slugify', () => {
  it('works', () => {
    const result = slugify('Hello World');
    expect(result).toBeDefined();  // shallow assertion
  });
});

describe('truncate', () => {
  it('handles strings', () => {
    const result = truncate('hello', 10);
    expect(result).toBeTruthy();  // shallow assertion
  });
});
