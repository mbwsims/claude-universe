import { describe, it, expect } from 'vitest';
import { analyzeMockHealth } from '../mock-health.js';
describe('analyzeMockHealth', () => {
    it('returns zero mocks for file with no mocking', () => {
        const content = `
      test('adds numbers', () => {
        expect(add(1, 2)).toBe(3);
      });
    `;
        const result = analyzeMockHealth(content);
        expect(result.total).toBe(0);
        expect(result.boundary).toBe(0);
        expect(result.internal).toBe(0);
    });
    it('classifies relative import mocks as internal', () => {
        const content = `jest.mock('../utils/helper');`;
        const result = analyzeMockHealth(content);
        expect(result.total).toBe(1);
        expect(result.internal).toBe(1);
        expect(result.boundary).toBe(0);
        expect(result.mocks[0].type).toBe('internal');
        expect(result.mocks[0].path).toBe('../utils/helper');
    });
    it('classifies node: imports as boundary', () => {
        const content = `jest.mock('node:fs');`;
        const result = analyzeMockHealth(content);
        expect(result.total).toBe(1);
        expect(result.boundary).toBe(1);
        expect(result.mocks[0].type).toBe('boundary');
    });
    it('classifies third-party packages as boundary', () => {
        const content = `
      vi.mock('axios');
      vi.mock('@prisma/client');
      vi.mock('stripe');
    `;
        const result = analyzeMockHealth(content);
        expect(result.total).toBe(3);
        expect(result.boundary).toBe(3);
        expect(result.internal).toBe(0);
    });
    it('handles mix of boundary and internal mocks', () => {
        const content = `
      jest.mock('axios');
      jest.mock('../services/userService');
      jest.mock('node:fs');
      jest.mock('./helpers');
    `;
        const result = analyzeMockHealth(content);
        expect(result.total).toBe(4);
        expect(result.boundary).toBe(2);
        expect(result.internal).toBe(2);
    });
    it('calculates mock setup percentage', () => {
        const content = `
      jest.mock('axios');
      const mockAxios = jest.fn();
      mockAxios.mockReturnValue({ data: 'test' });

      test('fetches data', () => {
        expect(result).toBe('test');
      });

      test('handles error', () => {
        expect(error).toBeDefined();
      });
    `;
        const result = analyzeMockHealth(content);
        // 3 mock setup lines out of ~10 non-empty lines
        expect(result.setupPercent).toBeGreaterThan(0);
        expect(result.setupPercent).toBeLessThan(50);
    });
    it('counts vi.mock the same as jest.mock', () => {
        const content = `vi.mock('../service');`;
        const result = analyzeMockHealth(content);
        expect(result.total).toBe(1);
        expect(result.internal).toBe(1);
    });
    it('reports correct line numbers', () => {
        const content = `line 1
line 2
jest.mock('axios');
line 4`;
        const result = analyzeMockHealth(content);
        expect(result.mocks[0].line).toBe(3);
    });
});
//# sourceMappingURL=mock-health.test.js.map