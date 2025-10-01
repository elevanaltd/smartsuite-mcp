// Context7: consulted for vitest
// Context7: consulted for zod
import { describe, it, expect, beforeEach } from 'vitest';


import { registerAllTools } from './tool-definitions.js';
import { defaultToolRegistry } from './tool-registry.js';

describe('Tool Definitions', () => {
  beforeEach(() => {
    // Clear registry before each test
    (defaultToolRegistry as any).tools.clear();
  });

  describe('Tool Registration', () => {
    it('should register all 9 MCP tools', () => {
      // ACT: Register all tools
      registerAllTools();

      // ASSERT: All 9 tools should be registered
      const toolNames = defaultToolRegistry.getToolNames();
      expect(toolNames).toHaveLength(9);

      const expectedTools = [
        'smartsuite_query',
        'smartsuite_record',
        'smartsuite_schema',
        'smartsuite_undo',
        'smartsuite_discover',
        'smartsuite_intelligent',
        'smartsuite_knowledge_events',
        'smartsuite_knowledge_field_mappings',
        'smartsuite_knowledge_refresh_views',
      ];

      expectedTools.forEach(toolName => {
        expect(toolNames).toContain(toolName);
        expect(defaultToolRegistry.hasTool(toolName)).toBe(true);
      });
    });

    it('should provide tool information for MCP protocol', () => {
      // ARRANGE: Register tools
      registerAllTools();

      // ACT: Get tool info for query tool
      const queryToolInfo = defaultToolRegistry.getToolInfo('smartsuite_query');

      // ASSERT: Should return MCP-compatible tool information
      expect(queryToolInfo).toBeDefined();
      expect(queryToolInfo?.name).toBe('smartsuite_query');
      expect(queryToolInfo?.description).toContain('Query SmartSuite records');
      expect(queryToolInfo?.schema).toBeDefined();
    });
  });

  describe('Schema Validation', () => {
    beforeEach(() => {
      registerAllTools();
    });

    it('should validate query tool arguments with proper schema', async () => {
      // ARRANGE: Valid query arguments
      const validArgs = {
        operation: 'list',
        appId: 'test-app-id',
        limit: 10,
      };

      // ACT & ASSERT: Should execute without throwing
      // We can't easily mock the handler here, but we can verify schema access
      const schema = defaultToolRegistry.getValidationSchema('smartsuite_query');
      expect(schema).toBeDefined();

      // Test schema validation directly
      const result = schema?.safeParse(validArgs);
      expect(result?.success).toBe(true);
    });

    it('should reject invalid query tool arguments', () => {
      // ARRANGE: Invalid query arguments
      const invalidArgs = {
        operation: 'invalid_operation', // Invalid enum value
        appId: '', // Empty string (min length 1)
        limit: -1, // Could be invalid depending on schema constraints
      };

      // ACT: Get schema and test validation
      const schema = defaultToolRegistry.getValidationSchema('smartsuite_query');
      expect(schema).toBeDefined();

      const result = schema?.safeParse(invalidArgs);
      expect(result?.success).toBe(false);
    });

    it('should validate record tool dry_run requirement', () => {
      // ARRANGE: Record arguments missing dry_run (which is optional)
      const argsWithoutDryRun = {
        operation: 'create',
        appId: 'test-app-id',
        data: { name: 'test' },
        // dry_run is optional in schema, defaults handled by business logic
      };

      // ACT: Get schema and test validation
      const schema = defaultToolRegistry.getValidationSchema('smartsuite_record');
      expect(schema).toBeDefined();

      const result = schema?.safeParse(argsWithoutDryRun);
      // dry_run is optional, so this should succeed at schema level
      expect(result?.success).toBe(true);
    });

    it('should validate record tool with proper dry_run', () => {
      // ARRANGE: Valid record arguments with dry_run
      const validArgs = {
        operation: 'create',
        appId: 'test-app-id',
        data: { name: 'test' },
        dry_run: true,
      };

      // ACT: Get schema and test validation
      const schema = defaultToolRegistry.getValidationSchema('smartsuite_record');
      expect(schema).toBeDefined();

      const result = schema?.safeParse(validArgs);
      expect(result?.success).toBe(true);
    });
  });

  describe('Knowledge Platform Tools', () => {
    beforeEach(() => {
      registerAllTools();
    });

    it('should validate knowledge events tool schema', () => {
      // ARRANGE: Valid knowledge events arguments
      const validArgs = {
        operation: 'append',
        aggregateId: 'test-aggregate',
        event: { type: 'test', data: {} },
      };

      // ACT: Get schema and test validation
      const schema = defaultToolRegistry.getValidationSchema('smartsuite_knowledge_events');
      expect(schema).toBeDefined();

      const result = schema?.safeParse(validArgs);
      expect(result?.success).toBe(true);
    });

    it('should validate knowledge field mappings tool schema', () => {
      // ARRANGE: Valid field mappings arguments
      const validArgs = {
        tableId: 'test-table-id',
      };

      // ACT: Get schema and test validation
      const schema = defaultToolRegistry.getValidationSchema('smartsuite_knowledge_field_mappings');
      expect(schema).toBeDefined();

      const result = schema?.safeParse(validArgs);
      expect(result?.success).toBe(true);
    });

    it('should validate knowledge refresh views tool schema', () => {
      // ARRANGE: Valid refresh views arguments
      const validArgs = {
        views: ['field_mappings', 'custom_view'],
      };

      // ACT: Get schema and test validation
      const schema = defaultToolRegistry.getValidationSchema('smartsuite_knowledge_refresh_views');
      expect(schema).toBeDefined();

      const result = schema?.safeParse(validArgs);
      expect(result?.success).toBe(true);
    });
  });

  describe('Intelligent Tool', () => {
    beforeEach(() => {
      registerAllTools();
    });

    it('should validate intelligent tool with required fields', () => {
      // ARRANGE: Valid intelligent tool arguments
      const validArgs = {
        endpoint: '/api/v1/test',
        method: 'POST',
        operation_description: 'Test operation',
        payload: { data: 'test' },
        mode: 'dry_run',
      };

      // ACT: Get schema and test validation
      const schema = defaultToolRegistry.getValidationSchema('smartsuite_intelligent');
      expect(schema).toBeDefined();

      const result = schema?.safeParse(validArgs);
      expect(result?.success).toBe(true);
    });

    it('should reject intelligent tool with invalid method', () => {
      // ARRANGE: Invalid method
      const invalidArgs = {
        endpoint: '/api/v1/test',
        method: 'INVALID_METHOD',
        operation_description: 'Test operation',
      };

      // ACT: Get schema and test validation
      const schema = defaultToolRegistry.getValidationSchema('smartsuite_intelligent');
      expect(schema).toBeDefined();

      const result = schema?.safeParse(invalidArgs);
      expect(result?.success).toBe(false);
    });
  });

  describe('Discover Tool', () => {
    beforeEach(() => {
      registerAllTools();
    });

    it('should validate discover tool with tables scope', () => {
      // ARRANGE: Valid discover arguments for tables
      const validArgs = {
        scope: 'tables',
      };

      // ACT: Get schema and test validation
      const schema = defaultToolRegistry.getValidationSchema('smartsuite_discover');
      expect(schema).toBeDefined();

      const result = schema?.safeParse(validArgs);
      expect(result?.success).toBe(true);
    });

    it('should validate discover tool with fields scope', () => {
      // ARRANGE: Valid discover arguments for fields
      const validArgs = {
        scope: 'fields',
        tableId: 'test-table-id',
      };

      // ACT: Get schema and test validation
      const schema = defaultToolRegistry.getValidationSchema('smartsuite_discover');
      expect(schema).toBeDefined();

      const result = schema?.safeParse(validArgs);
      expect(result?.success).toBe(true);
    });
  });
});

