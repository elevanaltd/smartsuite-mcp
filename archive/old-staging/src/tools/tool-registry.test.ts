// Context7: consulted for vitest
// Context7: consulted for zod
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

import { McpValidationError } from '../validation/input-validator.js';

import { ToolRegistry, type Tool } from './tool-registry.js';
import type { ToolContext } from './types.js';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;
  let mockContext: ToolContext;

  beforeEach(() => {
    registry = new ToolRegistry();
    mockContext = {
      client: {} as any,
      fieldTranslator: {} as any,
      tableResolver: {} as any,
      auditLogger: {} as any,
    };
  });

  describe('Tool Registration', () => {
    it('should register a tool with schema and handler', () => {
      // ARRANGE: Create a test tool
      const testSchema = z.object({
        name: z.string(),
        value: z.number(),
      });

      const testTool: Tool<typeof testSchema> = {
        name: 'test_tool',
        description: 'A test tool',
        schema: testSchema,
        execute: vi.fn().mockResolvedValue({ success: true }),
      };

      // ACT: Register the tool
      registry.register(testTool);

      // ASSERT: Tool should be registered
      expect(registry.hasTool('test_tool')).toBe(true);
      expect(registry.getToolNames()).toContain('test_tool');
    });

    it('should throw error for unknown tool execution', async () => {
      // ACT & ASSERT: Should throw for unknown tool
      await expect(
        registry.execute('unknown_tool', mockContext, {}),
      ).rejects.toThrow('Unknown tool: unknown_tool');
    });

    it('should prevent duplicate tool registration', () => {
      // ARRANGE: Create identical tools
      const testSchema = z.object({ name: z.string() });
      const testTool: Tool<typeof testSchema> = {
        name: 'duplicate_tool',
        description: 'First tool',
        schema: testSchema,
        execute: vi.fn(),
      };
      const duplicateTool: Tool<typeof testSchema> = {
        name: 'duplicate_tool',
        description: 'Second tool',
        schema: testSchema,
        execute: vi.fn(),
      };

      // ACT: Register first tool
      registry.register(testTool);

      // ASSERT: Second registration should throw
      expect(() => registry.register(duplicateTool)).toThrow(
        "Tool 'duplicate_tool' is already registered. Duplicate registration is not allowed.",
      );
    });

    it('should prevent prototype pollution attacks', () => {
      // ARRANGE: Create tools with malicious names
      const testSchema = z.object({ name: z.string() });
      const maliciousTools = [
        {
          name: '__proto__',
          description: 'Malicious tool',
          schema: testSchema,
          execute: vi.fn(),
        },
        {
          name: 'constructor',
          description: 'Malicious tool',
          schema: testSchema,
          execute: vi.fn(),
        },
      ];

      // ACT & ASSERT: Should throw for each malicious tool name
      maliciousTools.forEach(tool => {
        expect(() => registry.register(tool)).toThrow(
          `Invalid tool name: ${tool.name}. Tool names cannot contain prototype pollution vectors.`,
        );
      });
    });

    it('should validate tool structure before registration', () => {
      // ARRANGE: Create incomplete tool
      const incompleteTool = {
        name: 'incomplete_tool',
        // Missing description, schema, or execute
      };

      // ACT & ASSERT: Should throw for incomplete tool
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      expect(() => registry.register(incompleteTool as any)).toThrow(
        "Tool 'incomplete_tool' is missing required properties (schema, execute, or description).",
      );
    });
  });

  describe('Type-Safe Validation', () => {
    it('should validate arguments using tool schema and preserve McpValidationError', async () => {
      // ARRANGE: Create tool with validation requirements
      const strictSchema = z.object({
        requiredField: z.string().min(1),
        numberField: z.number().positive(),
      });

      const mockExecute = vi.fn().mockResolvedValue({ success: true });
      const testTool: Tool<typeof strictSchema> = {
        name: 'strict_tool',
        description: 'Tool with strict validation',
        schema: strictSchema,
        execute: mockExecute,
      };

      registry.register(testTool);

      // ACT & ASSERT: Should throw McpValidationError for invalid input
      const invalidInput = {
        requiredField: '', // Invalid: empty string
        numberField: -1,   // Invalid: negative number
      };

      await expect(
        registry.execute('strict_tool', mockContext, invalidInput),
      ).rejects.toThrow(McpValidationError);
    });

    it('should pass validated arguments to tool handler with correct types', async () => {
      // ARRANGE: Create tool with typed schema
      const typedSchema = z.object({
        operation: z.enum(['create', 'update', 'delete']),
        data: z.record(z.unknown()),
        count: z.number().optional(),
      });

      const mockExecute = vi.fn().mockResolvedValue({ result: 'success' });
      const testTool: Tool<typeof typedSchema> = {
        name: 'typed_tool',
        description: 'Tool with typed arguments',
        schema: typedSchema,
        execute: mockExecute,
      };

      registry.register(testTool);

      // ACT: Execute with valid input
      const validInput = {
        operation: 'create',
        data: { name: 'test', value: 42 },
        count: 5,
      };

      const result = await registry.execute('typed_tool', mockContext, validInput);

      // ASSERT: Tool should receive properly typed and validated arguments
      expect(result).toEqual({ result: 'success' });
      expect(mockExecute).toHaveBeenCalledWith(mockContext, validInput);
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });
  });

  describe('Schema Access', () => {
    it('should provide access to tool validation schema', () => {
      // ARRANGE: Register tool with schema
      const testSchema = z.object({ field: z.string() });
      const testTool: Tool<typeof testSchema> = {
        name: 'schema_tool',
        description: 'Tool for schema testing',
        schema: testSchema,
        execute: vi.fn(),
      };

      registry.register(testTool);

      // ACT: Get validation schema
      const schema = registry.getValidationSchema('schema_tool');

      // ASSERT: Should return the tool's schema
      expect(schema).toBe(testSchema);
    });

    it('should return null for unknown tool schema', () => {
      // ACT: Get schema for non-existent tool
      const schema = registry.getValidationSchema('unknown_tool');

      // ASSERT: Should return null
      expect(schema).toBeNull();
    });
  });

  describe('MCP Protocol Integration', () => {
    it('should provide tool information for MCP protocol', () => {
      // ARRANGE: Register tool
      const testSchema = z.object({ param: z.string() });
      const testTool: Tool<typeof testSchema> = {
        name: 'mcp_tool',
        description: 'Tool for MCP integration',
        schema: testSchema,
        execute: vi.fn(),
      };

      registry.register(testTool);

      // ACT: Get tool info
      const toolInfo = registry.getToolInfo('mcp_tool');

      // ASSERT: Should return MCP-compatible tool information
      expect(toolInfo).toEqual({
        name: 'mcp_tool',
        description: 'Tool for MCP integration',
        schema: testSchema,
      });
    });

    it('should return null for unknown tool info', () => {
      // ACT: Get info for non-existent tool
      const toolInfo = registry.getToolInfo('unknown_tool');

      // ASSERT: Should return null
      expect(toolInfo).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should preserve McpValidationError structure and details', async () => {
      // ARRANGE: Tool with validation that will fail
      const strictSchema = z.object({
        email: z.string().email(),
        age: z.number().min(18),
      });

      const testTool: Tool<typeof strictSchema> = {
        name: 'validation_tool',
        description: 'Tool that validates strictly',
        schema: strictSchema,
        execute: vi.fn(),
      };

      registry.register(testTool);

      // ACT & ASSERT: Should preserve McpValidationError with all details
      const invalidInput = {
        email: 'not-an-email',
        age: 15,
      };

      try {
        await registry.execute('validation_tool', mockContext, invalidInput);
        expect.fail('Should have thrown McpValidationError');
      } catch (error) {
        expect(error).toBeInstanceOf(McpValidationError);
        if (error instanceof McpValidationError) {
          expect(error.toolName).toBe('validation_tool');
          expect(error.validationErrors).toBeInstanceOf(Array);
          expect(error.validationErrors.length).toBeGreaterThan(0);
        }
      }
    });
  });
});
