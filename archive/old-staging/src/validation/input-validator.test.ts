// Test-Methodology-Guardian: RED-GREEN-REFACTOR TDD cycle for input validation middleware
// CRITICAL: MCP tool parameter validation to prevent invalid API calls
// Context7: consulted for vitest
// Context7: consulted for zod
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

import { validateMcpToolInput, McpValidationError } from './input-validator.js';

describe('MCP Tool Input Validator', () => {
  describe('schema validation', () => {
    it('should reject invalid inputs that do not match schema', () => {
      // RED: This test should fail - no validator exists yet
      const queryToolSchema = z.object({
        operation: z.enum(['list', 'get', 'search', 'count']),
        appId: z.string().min(1),
        limit: z.number().optional(),
      });

      const invalidInput = {
        operation: 'invalid_operation',
        appId: '',
        limit: -1,
      };

      expect(() =>
        validateMcpToolInput('smartsuite_query', queryToolSchema, invalidInput),
      ).toThrow(McpValidationError);
    });
  });

  describe('SmartDoc field validation integration', () => {
    it('should validate SmartDoc field formats in record data', () => {
      // RED: This should fail - no SmartDoc integration exists yet
      const recordToolSchema = z.object({
        operation: z.enum(['create', 'update']),
        appId: z.string(),
        data: z.record(z.unknown()),
      });

      const invalidInput = {
        operation: 'create' as const,
        appId: 'test-app',
        data: {
          checklist_field: ['simple', 'array'], // This should trigger SmartDoc validation
        },
      };

      expect(() =>
        validateMcpToolInput('smartsuite_record', recordToolSchema, invalidInput),
      ).toThrow(McpValidationError);
    });
  });
});
