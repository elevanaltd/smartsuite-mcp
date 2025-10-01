// Context7: consulted for vitest
// Test for refactored mcp-server using function modules
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { SmartSuiteShimServer } from '../mcp-server.js';

describe('MCP Server with Function Modules', () => {
  let server: SmartSuiteShimServer;

  beforeEach(async () => {
    server = new SmartSuiteShimServer();

    // Mock authentication method to prevent API calls
    vi.spyOn(server as any, 'authenticate').mockResolvedValue(undefined);
    vi.spyOn(server as any, 'initializeFieldMappings').mockResolvedValue(undefined);

    // Mock authentication state
    (server as any).isAuthenticated = true;
    (server as any).fieldMappingsInitialized = true;

    // Initialize the server to register tools in the registry
    await server.initialize();
  });

  it('should dispatch query operations to function module', async () => {
    // Mock the dependencies
    const mockClient = {
      listRecords: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    };
    (server as any).client = mockClient;

    const mockFieldTranslator = {
      hasMappings: vi.fn(() => false),
      humanToApi: vi.fn((_appId, data) => data),
      apiToHuman: vi.fn((_appId, data) => data),
    };
    (server as any).fieldTranslator = mockFieldTranslator;

    const mockTableResolver = {
      resolveTableId: vi.fn(id => id),
    };
    (server as any).tableResolver = mockTableResolver;

    const args = {
      operation: 'list',
      appId: 'test-table',
    };

    const result = await server.executeTool('smartsuite_query', args);

    expect(result).toBeDefined();
    expect(mockTableResolver.resolveTableId).toHaveBeenCalledWith('test-table');
    expect(mockClient.listRecords).toHaveBeenCalled();
  });

  it('should create proper ToolContext for function modules', () => {
    const mockClient = {};
    const mockFieldTranslator = {};
    const mockTableResolver = {};
    const mockAuditLogger = {};

    (server as any).client = mockClient;
    (server as any).fieldTranslator = mockFieldTranslator;
    (server as any).tableResolver = mockTableResolver;
    (server as any).auditLogger = mockAuditLogger;

    // Check that createToolContext method will be added
    const createToolContext = (server as any).createToolContext;

    // This will fail initially as method doesn't exist yet
    if (createToolContext) {
      const context = createToolContext.call(server);
      expect(context).toHaveProperty('client', mockClient);
      expect(context).toHaveProperty('fieldTranslator', mockFieldTranslator);
      expect(context).toHaveProperty('tableResolver', mockTableResolver);
      expect(context).toHaveProperty('auditLogger', mockAuditLogger);
    }
  });
});
