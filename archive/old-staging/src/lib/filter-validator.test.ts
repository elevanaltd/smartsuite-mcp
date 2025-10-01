// Context7: consulted for vitest
import { describe, it, expect } from 'vitest';

import { FilterValidator } from './filter-validator.js';

describe('FilterValidator', () => {
  describe('validate', () => {
    it('should accept null/undefined filters', () => {
      expect(FilterValidator.validate(null)).toBeNull();
      expect(FilterValidator.validate(undefined)).toBeNull();
    });

    it('should reject non-object filters', () => {
      expect(FilterValidator.validate('string')).toBe('Filter must be an object');
      expect(FilterValidator.validate(123)).toBe('Filter must be an object');
    });

    it('should require operator when fields array exists', () => {
      const filter = {
        fields: [],
      };
      expect(FilterValidator.validate(filter)).toBe('Filter with fields array must have an operator (and/or)');
    });

    it('should validate operator values', () => {
      const invalidFilter = {
        operator: 'invalid',
        fields: [],
      };
      expect(FilterValidator.validate(invalidFilter)).toContain('Invalid operator');

      const validFilter = {
        operator: 'and',
        fields: [],
      };
      expect(FilterValidator.validate(validFilter)).toBeNull();
    });

    it('should validate field structure', () => {
      const filter = {
        operator: 'and',
        fields: [
          { field: 'name' }, // Missing comparison
        ],
      };
      expect(FilterValidator.validate(filter)).toContain('missing required property "comparison"');
    });

    it('should validate comparison operators', () => {
      const filter = {
        operator: 'and',
        fields: [
          { field: 'name', comparison: 'invalid_op', value: 'test' },
        ],
      };
      expect(FilterValidator.validate(filter)).toContain('invalid comparison');
    });

    it('should require value for non-empty comparisons', () => {
      const filter = {
        operator: 'and',
        fields: [
          { field: 'name', comparison: 'is' }, // Missing value
        ],
      };
      expect(FilterValidator.validate(filter)).toContain('requires a value');
    });

    it('should allow is_empty/is_not_empty without value', () => {
      const filter = {
        operator: 'and',
        fields: [
          { field: 'name', comparison: 'is_empty' },
        ],
      };
      expect(FilterValidator.validate(filter)).toBeNull();
    });

    it('should validate complex nested filters', () => {
      const validFilter = {
        operator: 'and',
        fields: [
          { field: 'status', comparison: 'is', value: 'active' },
          { field: 'projects_link', comparison: 'is', value: ['68abcd3975586ee1ff3e5b1f'] },
          { field: 'description', comparison: 'is_not_empty' },
        ],
      };
      expect(FilterValidator.validate(validFilter)).toBeNull();
    });
  });

  describe('format', () => {
    it('should format filters as JSON', () => {
      const filter = { operator: 'and', fields: [] };
      const formatted = FilterValidator.format(filter);
      expect(formatted).toContain('operator');
      expect(formatted).toContain('fields');
    });

    it('should handle format errors gracefully', () => {
      const circular: any = { operator: 'and' };
      circular.self = circular; // Create circular reference
      const formatted = FilterValidator.format(circular);
      expect(formatted).toBeTruthy(); // Should return something, not throw
    });
  });
});
