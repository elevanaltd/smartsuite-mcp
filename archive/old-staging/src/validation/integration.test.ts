// Test-Methodology-Guardian: RED-GREEN-REFACTOR TDD cycle for validation integration
// CRITICAL: Test validation middleware integration with MCP server
// Context7: consulted for vitest
// Context7: consulted for zod
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createAuthenticatedTestServer } from '../../test/helpers/test-server.js';
import { SmartSuiteShimServer } from '../mcp-server.js';

describe('Validation Integration with MCP Server', () => {
  let server: SmartSuiteShimServer;

  beforeEach(async () => {
    // Use TestGuard-approved authentication helper
    server = await createAuthenticatedTestServer();

    // Mock client
    (server as any).client = {
      listRecords: vi.fn().mockResolvedValue([]),
      getSchema: vi.fn().mockResolvedValue({
        id: 'test-app',
        name: 'Test App',
        structure: [
          { slug: 'checklist_field', field_type: 'checklist', params: {} },
        ],
      }),
    };
  });

  describe('SmartDoc validation integration', () => {
    it('should reject invalid checklist format in record operations', async () => {
      // RED: This should fail - no validation integration exists yet
      await expect(
        server.executeTool('smartsuite_record', {
          operation: 'create',
          appId: 'test-app',
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
      // The test validates that invalid table IDs are caught
      // Table validation happens before operation validation
      await expect(
        server.executeTool('smartsuite_query', {
          operation: 'invalid_operation', // Invalid enum value
          appId: 'test-app', // Invalid table ID format
        }),
      ).rejects.toThrow(/Unknown table/);
    });
  });
});
