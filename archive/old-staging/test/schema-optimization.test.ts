// Critical-Engineer: consulted for Architecture pattern selection
// TESTGUARD-APPROVED: TDD approach for schema optimization refactor
// Context7: consulted for vitest
import { describe, it, expect, beforeEach, vi, MockedFunction } from 'vitest';

import { SmartSuiteShimServer } from '../src/mcp-server.js';

// Mock the SmartSuite client
vi.mock('../src/smartsuite-client.js', () => ({
  createAuthenticatedClient: vi.fn(),
  SmartSuiteClient: vi.fn(),
}));

// Mock schema response for testing
const mockFullSchema = {
  id: '68a8ff5237fde0bf797c05b3',
  name: 'Test Table',
  structure: [
    {
      slug: 'title',
      field_type: 'textfield',
      label: 'Title',
      params: { required: true },
    },
    {
      slug: 'status',
      field_type: 'singleselectfield',
      label: 'Status',
      params: {
        required: false,
        choices: [
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
        ],
      },
    },
    {
      slug: 'priority',
      field_type: 'numberfield',
      label: 'Priority',
      params: { required: false },
    },
  ],
};

describe('Schema Optimization', () => {
  let server: SmartSuiteShimServer;
  let mockClient: { getSchema: MockedFunction<any> };

  beforeEach(async () => {
    server = new SmartSuiteShimServer();
    // Mock environment for test
    process.env.SMARTSUITE_API_TOKEN = 'test-token';
    process.env.SMARTSUITE_WORKSPACE_ID = 'test-workspace';
    // Mock authenticate to avoid real API calls
    server['authenticate'] = vi.fn().mockResolvedValue(undefined);
    // Initialize server to register tools
    await server.initialize();


    // Create mock client with getSchema method
    mockClient = {
      getSchema: vi.fn(),
    };

    // Set up server with mock client
    await server.authenticate({
      apiKey: 'test-key',
      workspaceId: 'test-workspace',
    });

    // Replace client with mock - accessing private property for testing
    (server as any).client = mockClient;

    // Mock successful schema response
    mockClient.getSchema.mockResolvedValue(mockFullSchema);
  });

  describe('Output Mode: summary', () => {
    it('should return only essential table info with summary mode', async () => {
      const result = await server.callTool('smartsuite_schema', {
        appId: '68a8ff5237fde0bf797c05b3',
        output_mode: 'summary',
      });

      expect(result).toEqual({
        id: '68a8ff5237fde0bf797c05b3',
        name: 'Test Table',
        field_count: 3,
        field_types: {
          textfield: 1,
          singleselectfield: 1,
          numberfield: 1,
        },
      });

      // Should still call the API once
      expect(mockClient.getSchema).toHaveBeenCalledTimes(1);
    });

    it('should use summary mode as default when no output_mode specified', async () => {
      // TEST FAILS: Current implementation returns full schema by default
      const result = await server.callTool('smartsuite_schema', {
        appId: '68a8ff5237fde0bf797c05b3',
        // No output_mode specified
      });

      expect(result).toEqual({
        id: '68a8ff5237fde0bf797c05b3',
        name: 'Test Table',
        field_count: 3,
        field_types: {
          textfield: 1,
          singleselectfield: 1,
          numberfield: 1,
        },
      });
    });
  });

  describe('Output Mode: fields', () => {
    it('should return field names and types with fields mode', async () => {
      const result = await server.callTool('smartsuite_schema', {
        appId: '68a8ff5237fde0bf797c05b3',
        output_mode: 'fields',
      });

      expect(result).toEqual({
        id: '68a8ff5237fde0bf797c05b3',
        name: 'Test Table',
        field_count: 3,
        fields: [
          {
            slug: 'title',
            field_type: 'textfield',
            label: 'Title',
            required: true,
          },
          {
            slug: 'status',
            field_type: 'singleselectfield',
            label: 'Status',
            required: false,
          },
          {
            slug: 'priority',
            field_type: 'numberfield',
            label: 'Priority',
            required: false,
          },
        ],
        conditionalFieldsSupported: true,
      });
    });
  });

  describe('Output Mode: detailed', () => {
    it('should return full schema with detailed mode', async () => {
      const result = await server.callTool('smartsuite_schema', {
        appId: '68a8ff5237fde0bf797c05b3',
        output_mode: 'detailed',
      });

      expect(result).toEqual({
        ...mockFullSchema,
        conditionalFieldsSupported: true,
        fieldMappings: {
          hasCustomMappings: expect.any(Boolean),
          message: expect.any(String),
        },
      });
    });
  });

  describe('Input Validation', () => {
    it('should reject invalid output_mode values', async () => {
      await expect(
        server.callTool('smartsuite_schema', {
          appId: '68a8ff5237fde0bf797c05b3',
          output_mode: 'invalid',
        }),
      ).rejects.toThrow('Invalid output_mode "invalid". Must be one of: summary, fields, detailed');
    });

    it('should accept undefined output_mode (uses default)', async () => {
      const result = await server.callTool('smartsuite_schema', {
        appId: '68a8ff5237fde0bf797c05b3',
        // output_mode undefined
      });

      // Should not throw, and should use default (summary)
      expect(result).toHaveProperty('field_count', 3);
    });
  });

  describe('Caching Behavior', () => {
    beforeEach(() => {
      // Reset mock call count for caching tests
      mockClient.getSchema.mockClear();
    });


    it('should handle cache TTL expiry', async () => {
      // This test would need time manipulation or dependency injection
      // For now, mark as TODO for implementation phase
      // TODO: Implement TTL testing with fake timers or injectable clock
    });
  });

  describe('Error Handling', () => {
    // ERROR-ARCHITECT-APPROVED: DEBUG-20250109-82f589cf
    it('should reject invalid table IDs with proper error handling', async () => {
      // PRESERVE THE TRUTH: This test reveals how the system handles invalid table IDs
      const invalidTableId = '78b9gg6348edf1cg8a8c16c4';

      await expect(
        server.callTool('smartsuite_schema', {
          appId: invalidTableId,
          output_mode: 'summary',
        }),
      ).rejects.toThrow('Unknown table \'78b9gg6348edf1cg8a8c16c4\'. Available tables:');
    });
  });
});
