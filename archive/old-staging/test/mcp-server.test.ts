// Context7: consulted for vitest
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { SmartSuiteShimServer } from '../src/mcp-server.js';

// Mock the createAuthenticatedClient to avoid real API calls in tests
vi.mock('../src/smartsuite-client.js', () => ({
  createAuthenticatedClient: vi.fn(async (config) => {
    // Return a mock client for valid test tokens
    if (config.apiKey === 'test-api-token-12345' || config.apiKey === 'env-api-token') {
      return {
        apiKey: config.apiKey,
        workspaceId: config.workspaceId,
        // Add required methods for tests
        getSchema: vi.fn().mockResolvedValue({
          id: 'test-app-id',
          name: 'Test Application',
          structure: [],
        }),
        get: vi.fn().mockResolvedValue({ fields: [] }),
      };
    }
    // Throw for invalid tokens to test fail-fast behavior
    throw new Error('Invalid API credentials');
  }),
  SmartSuiteClient: vi.fn(),
  SmartSuiteClientConfig: {},
}));

describe('SmartSuiteShimServer', () => {
  it('should be instantiable with proper MCP server interface', () => {
    expect(() => new SmartSuiteShimServer()).not.toThrow();
  });

  // TESTGUARD: Refactored from brittle exact-match to resilient contract-based tests
  // Following CONTRACT-DRIVEN-CORRECTION principle

  it('should register the 6 core SmartSuite tools', async () => {
    const server = new SmartSuiteShimServer();
    const toolNames = (await server.getTools()).map((t: any) => t.name);

    expect(toolNames).toEqual(expect.arrayContaining([
      'smartsuite_query',
      'smartsuite_record',
      'smartsuite_schema',
      'smartsuite_undo',
      'smartsuite_discover',
      'smartsuite_intelligent',
    ]));
  });

  it('should register the 3 Knowledge Platform tools', async () => {
    const server = new SmartSuiteShimServer();
    const toolNames = (await server.getTools()).map((t: any) => t.name);

    expect(toolNames).toEqual(expect.arrayContaining([
      'smartsuite_knowledge_events',
      'smartsuite_knowledge_field_mappings',
      'smartsuite_knowledge_refresh_views',
    ]));
  });

  it('should register a total of 9 tools', async () => {
    const server = new SmartSuiteShimServer();
    const tools = await server.getTools();
    expect(tools).toHaveLength(9);
  });

  it('should enforce mandatory dry-run pattern for record tool', async () => {
    const server = new SmartSuiteShimServer();
    const tools = await server.getTools();
    const recordTool = tools.find((t: any) => t.name === 'smartsuite_record');

    expect((recordTool?.inputSchema?.properties?.dry_run as any)?.default).toBe(true);
  });

  it('should use enum constraints for operation parameters', async () => {
    const server = new SmartSuiteShimServer();
    const tools = await server.getTools();

    const queryTool = tools.find((t: any) => t.name === 'smartsuite_query');
    expect((queryTool?.inputSchema?.properties?.operation as any)?.enum).toEqual([
      'list',
      'get',
      'search',
      'count',
    ]);

    const recordTool = tools.find((t: any) => t.name === 'smartsuite_record');
    expect((recordTool?.inputSchema?.properties?.operation as any)?.enum).toEqual([
      'create',
      'update',
      'delete',
      'bulk_update',
      'bulk_delete',
    ]);
  });

  // NEW FAILING TESTS - These will fail until methods are implemented
  it('should have executeTool method', () => {
    const server = new SmartSuiteShimServer();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(server.executeTool).toBeDefined();
    expect(typeof server.executeTool).toBe('function');
  });

  it('should have authenticate method', () => {
    const server = new SmartSuiteShimServer();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(server.authenticate).toBeDefined();
    expect(typeof server.authenticate).toBe('function');
  });

  // TDD RED PHASE: Auto-authentication on startup test
  describe('auto-authentication behavior', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      // Reset environment
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      // Restore original environment
      process.env = originalEnv;
    });

    it('should auto-authenticate from environment variables on startup', async () => {
      // ARRANGE: Set up environment variables
      process.env.SMARTSUITE_API_TOKEN = 'test-api-token-12345';
      process.env.SMARTSUITE_WORKSPACE_ID = 'test-workspace-id';

      // ACT: Create server instance and initialize
      const server = new SmartSuiteShimServer();
      await server.initialize();

      // ASSERT: Server should be authenticated after initialization
      expect(server.isAuthenticated()).toBe(true);
    });

    it('should allow tool execution without explicit authenticate() call when env vars are set', async () => {
      // ARRANGE: Set up environment variables
      process.env.SMARTSUITE_API_TOKEN = 'test-api-token-12345';
      process.env.SMARTSUITE_WORKSPACE_ID = 'test-workspace-id';

      // ACT: Create server and initialize
      const server = new SmartSuiteShimServer();
      await server.initialize();

      // ASSERT: Tool execution should work without throwing "Authentication required" error
      await expect(
        server.executeTool('smartsuite_schema', {
          appId: '6613bedd1889d8deeaef8b0e',
        }),
      ).resolves.not.toThrow('Authentication required: call authenticate() first');
    });

    it('should fallback to manual authentication when environment variables are missing', async () => {
      // ARRANGE: Clear environment variables
      delete process.env.SMARTSUITE_API_TOKEN;
      delete process.env.SMARTSUITE_WORKSPACE_ID;

      // ACT: Create server instance and initialize (should be no-op without env vars)
      const server = new SmartSuiteShimServer();
      await server.initialize();

      // ASSERT: Server should not be auto-authenticated
      expect(server.isAuthenticated()).toBe(false);

      // ASSERT: Tool execution should still require explicit authentication
      await expect(
        server.executeTool('smartsuite_schema', {
          appId: '6613bedd1889d8deeaef8b0e',
        }),
      ).rejects.toThrow('Authentication required: call authenticate() first');
    });

    it('should prioritize environment variables over manual authentication config', async () => {
      // ARRANGE: Set up environment variables
      process.env.SMARTSUITE_API_TOKEN = 'env-api-token';
      process.env.SMARTSUITE_WORKSPACE_ID = 'env-workspace-id';

      const server = new SmartSuiteShimServer();
      await server.initialize();

      // ACT: Try manual authentication with different values
      await server.authenticate({
        apiKey: 'manual-api-token',
        workspaceId: 'manual-workspace-id',
      });

      // ASSERT: Server should use environment variable values, not manual config
      // This test will FAIL initially because environment variable priority doesn't exist
      const config = server.getAuthConfig();
      expect(config?.apiKey).toBe('env-api-token');
      expect(config?.workspaceId).toBe('env-workspace-id');
    });
  });
});
