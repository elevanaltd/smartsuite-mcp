// Test-Methodology-Guardian: RED-GREEN-REFACTOR TDD cycle for validation integration
// CRITICAL: Test validation middleware integration with MCP server
// Context7: consulted for vitest
// Context7: consulted for zod
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { SmartSuiteShimServer } from '../mcp-server.js';

// Mock SmartSuite client creation
vi.mock('../smartsuite-client.js', () => ({
  createAuthenticatedClient: vi.fn().mockResolvedValue({
    listRecords: vi.fn().mockResolvedValue([]),
    getSchema: vi.fn().mockResolvedValue({
      id: '68a8ff5237fde0bf797c05b3',
      name: 'Projects',
      structure: [
        { slug: 'checklist_field', field_type: 'checklist', params: {} },
      ],
    }),
  }),
}));

describe('Validation Integration with MCP Server', () => {
  let server: SmartSuiteShimServer;

  beforeEach(async () => {
    server = new SmartSuiteShimServer();

    // Initialize server to register tools
    await server.initialize();

    // Authenticate to create client
    await server.authenticate({
      apiKey: 'test-api-key',
      workspaceId: 'test-workspace',
      baseUrl: 'https://app.smartsuite.com',
    });
  });

  describe('SmartDoc validation integration', () => {
    it('should reject invalid checklist format in record operations', async () => {
      // RED: This should fail - no validation integration exists yet
      await expect(
        server.executeTool('smartsuite_record', {
          operation: 'create',
          appId: '68a8ff5237fde0bf797c05b3', // Valid projects table ID
          data: {
            checklist_field: ['simple', 'array'], // Invalid SmartDoc format
          },
          dry_run: true,
        }),
      ).rejects.toThrow(/SmartDoc validation failed/);
    });
  });

  describe('schema validation integration', () => {
    it('should reject invalid operation parameters', async () => {
      // The test validates operation validation in query tool
      await expect(
        server.executeTool('smartsuite_query', {
          operation: 'invalid_operation', // Invalid enum value
          appId: '68a8ff5237fde0bf797c05b3',
        }),
      ).rejects.toThrow(/Unknown query operation/);
    });
  });
});
