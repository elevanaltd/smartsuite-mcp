// ERROR-ARCHITECT INTEGRATION VALIDATION TEST
// Purpose: Validate critical integration points for B2.04 phase completion
// Scope: SIMPLE (single-user personal automation tool)
// Time Budget: 5 minutes validation

// Context7: consulted for vitest
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { SmartSuiteShimServer } from '../src/mcp-server.js';

// Mock SmartSuite client creation
vi.mock('../src/smartsuite-client.js', () => ({
  createAuthenticatedClient: vi.fn().mockResolvedValue({
    listRecords: vi.fn(),
    getRecord: vi.fn(),
    createRecord: vi.fn(),
    updateRecord: vi.fn(),
    deleteRecord: vi.fn(),
    getSchema: vi.fn(),
    getApplicationStructure: vi.fn(),
  }),
}));

describe('ERROR-ARCHITECT: Integration Validation', () => {
  let server: SmartSuiteShimServer;
  let originalFetch: typeof global.fetch;

  beforeEach(async () => {
    server = new SmartSuiteShimServer();
    originalFetch = global.fetch;
    // Mock environment variables for test
    process.env.SMARTSUITE_API_TOKEN = 'test-token';
    process.env.SMARTSUITE_WORKSPACE_ID = 'test-workspace';
    // Initialize server to register tools
    await server.initialize();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore fetch after each test to prevent race conditions
    global.fetch = originalFetch;
  });

  describe('Integration Point 1: MCP Server ↔ SmartSuite Client', () => {
    it('should authenticate and store client instance', async () => {
      const config = {
        apiKey: 'test-api-key',
        workspaceId: 'test-workspace',
        baseUrl: 'https://app.smartsuite.com',
      };

      // Mock fetch for authentication
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await expect(server.authenticate(config)).resolves.not.toThrow();
    });

    it('should require authentication before tool execution', async () => {
      await expect(
        server.executeTool('smartsuite_query', { operation: 'list', appId: '68a8ff5237fde0bf797c05b3' }),
      ).rejects.toThrow('Authentication required');
    });
  });

  describe('Integration Point 2: DRY-RUN ↔ Mutation Safety', () => {
    it('should enforce dry-run pattern for mutations', async () => {
      // Authenticate first to have a client
      await server.authenticate({
        apiKey: 'test-api-key',
        workspaceId: 'test-workspace',
        baseUrl: 'https://app.smartsuite.com',
      });

      // TESTGUARD-APPROVED: TEST-METHODOLOGY-GUARDIAN-20250909-7cf66e12
      // Fixed field name: projects table uses 'projectName' not 'name'
      // Attempt mutation without dry_run
      await expect(
        server.executeTool('smartsuite_record', {
          operation: 'create',
          appId: '68a8ff5237fde0bf797c05b3',
          data: { projectName: 'test' },
        }),
      ).rejects.toThrow('Dry-run pattern required');
    });

    it('should allow dry-run mutations', async () => {
      // Authenticate first to have a client
      await server.authenticate({
        apiKey: 'test-api-key',
        workspaceId: 'test-workspace',
        baseUrl: 'https://app.smartsuite.com',
      });



      // TESTGUARD-APPROVED: TEST-METHODOLOGY-GUARDIAN-20250909-7cf66e12
      // Fixed field name: projects table uses 'projectName' not 'name'
      const result = (await server.executeTool('smartsuite_record', {
        operation: 'create',
        appId: '68a8ff5237fde0bf797c05b3',
        data: { projectName: 'test' },
        dry_run: true,
      })) as { dry_run: boolean; message: string };

      expect(result.dry_run).toBe(true);
      expect(result.message).toContain('DRY-RUN');
    });
  });

  describe('Integration Point 3: Error Handling ↔ User Experience', () => {
    it('should provide clear error for unknown tools', async () => {
      // Authenticate first to have a client
      await server.authenticate({
        apiKey: 'test-api-key',
        workspaceId: 'test-workspace',
        baseUrl: 'https://app.smartsuite.com',
      });



      await expect(server.executeTool('unknown_tool', {})).rejects.toThrow(
        'Unknown tool: unknown_tool',
      );
    });

    it('should provide clear error for unknown operations', async () => {
      // Authenticate first to have a client
      await server.authenticate({
        apiKey: 'test-api-key',
        workspaceId: 'test-workspace',
        baseUrl: 'https://app.smartsuite.com',
      });



      await expect(
        server.executeTool('smartsuite_query', {
          operation: 'unknown_op',
          appId: '68a8ff5237fde0bf797c05b3',
        }),
      ).rejects.toThrow('Unknown query operation: unknown_op');
    });

    it('should handle authentication errors gracefully', async () => {
      // Mock fetch to simulate auth failure
      global.fetch = vi.fn().mockRejectedValue(new Error('Authentication failed: Invalid token'));

      await expect(
        server.authenticate({
          apiKey: 'invalid-key',
          workspaceId: 'test-workspace',
          baseUrl: 'https://app.smartsuite.com',
        }),
      ).rejects.toThrow('Authentication failed');


    });
  });

  describe('Integration Point 4: Tool Execution Pipeline', () => {
    beforeEach(async () => {
      // Mock authentication
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      // Setup authenticated server with mocked client
      await server.authenticate({
        apiKey: 'test-api-key',
        workspaceId: 'test-workspace',
        baseUrl: 'https://app.smartsuite.com',
      });



      // Mock the client methods by replacing the private client
      // This is testing the tool execution pipeline, not the client itself
      // TEST-METHODOLOGY-GUARDIAN-APPROVED: TEST-METHODOLOGY-GUARDIAN-20250912-94f6ff5e
      (server as any).client = {
        listRecords: vi.fn().mockResolvedValue([{ id: '1', name: 'Test' }]),
        countRecords: vi.fn().mockResolvedValue(1),
        getRecord: vi.fn().mockResolvedValue({ id: '1', name: 'Test' }),
        createRecord: vi.fn().mockResolvedValue({ id: '2', name: 'New' }),
        updateRecord: vi.fn().mockResolvedValue({ id: '1', name: 'Updated' }),
        deleteRecord: vi.fn().mockResolvedValue(undefined),
        getSchema: vi.fn().mockResolvedValue({
          id: '68b2437a8f1755b055e0a124',
          name: 'Videos Table',
          structure: [],
        }),
      } as any;
    });

    it('should execute query operations correctly', async () => {
      const result = await server.executeTool('smartsuite_query', {
        operation: 'list',
        appId: '68b2437a8f1755b055e0a124',
      });

      // After API change, MCP server returns paginated response format
      expect(result).toEqual({
        total: 1,
        items: [{ id: '1', name: 'Test' }],
        limit: 1,
        offset: 0,
      });
      // Updated to use correct videos table ID from field-mappings
      expect((server as any).client.listRecords).toHaveBeenCalledWith('68b2437a8f1755b055e0a124', {});
    });

    it('should execute count operations correctly', async () => {
      const result = await server.executeTool('smartsuite_query', {
        operation: 'count',
        appId: '68b2437a8f1755b055e0a124',
      });

      expect(result).toEqual({ count: 1 });
    });

    it('should execute schema operations correctly', async () => {
      const result = await server.executeTool('smartsuite_schema', {
        appId: '68b2437a8f1755b055e0a124',
      });

      expect(result).toEqual({
        id: '68b2437a8f1755b055e0a124',
        name: 'Videos Table',
        field_count: 0,
        field_types: {},
      });
      // Updated to use correct videos table ID from field-mappings
      expect((server as any).client.getSchema).toHaveBeenCalledWith('68b2437a8f1755b055e0a124');
    });

    it('should handle undo operation with validation', async () => {
      // TESTGUARD-APPROVED: CONTRACT-DRIVEN-CORRECTION - Updating test from placeholder to actual validation
      // Now that undo functionality is implemented, test proper validation
      await expect(server.executeTool('smartsuite_undo', {})).rejects.toThrow(
        'Transaction ID is required',
      );
    });
  });

  describe('SIMPLE Scope Validation', () => {
    it('should have appropriate error messages for single-user context', async () => {
      // Not authenticated
      await expect(
        server.executeTool('smartsuite_query', { operation: 'list', appId: '68a8ff5237fde0bf797c05b3' }),
      ).rejects.toThrow(/Authentication required.*authenticate\(\) first/);

      // Invalid operation
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await server.authenticate({
        apiKey: 'test-api-key',
        workspaceId: 'test-workspace',
        baseUrl: 'https://app.smartsuite.com',
      });



      await expect(
        server.executeTool('smartsuite_query', { operation: 'invalid', appId: '68a8ff5237fde0bf797c05b3' }),
      ).rejects.toThrow(/Unknown query operation: invalid/);
    });

    it('should not implement complex features outside SIMPLE scope', async () => {
      // Mock authentication
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await server.authenticate({
        apiKey: 'test-api-key',
        workspaceId: 'test-workspace',
        baseUrl: 'https://app.smartsuite.com',
      });



      // Bulk operations not needed for personal automation
      await expect(
        server.executeTool('smartsuite_record', {
          operation: 'bulk_update',
          appId: '68a8ff5237fde0bf797c05b3',
          data: [],
          dry_run: true,
        }),
      ).resolves.toMatchObject({
        dry_run: true,
        operation: 'bulk_update',
        validated: false,
        errors: expect.arrayContaining(['Bulk operation requires at least one record']),
      });
    });
  });
});
