// Context7: consulted for vitest
// Context7: consulted for @modelcontextprotocol/sdk/server/index.js
// Context7: consulted for @modelcontextprotocol/sdk/server/stdio.js
// Context7: consulted for @modelcontextprotocol/sdk/types.js
// Test for MCP stdio server integration added in B3 phase
// Validates that the server can initialize MCP stdio transport correctly

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('MCP Stdio Integration (B3)', () => {
  let consoleLogSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.MCP_VALIDATE_AND_EXIT;
    vi.resetModules();
  });

  it('should be able to create MCP Server and StdioServerTransport instances', () => {
    // Test that we can create the MCP components without errors
    const mcpServer = new Server({ name: 'Test Server', version: '1.0.0' });
    const transport = new StdioServerTransport();

    expect(mcpServer).toBeDefined();
    expect(transport).toBeDefined();
    // Note: MCP Server doesn't expose name property publicly, that's fine
    expect(typeof mcpServer.connect).toBe('function');
  });

  it('should initialize MCP server components when not in validation mode', async () => {
    // TESTGUARD-APPROVED: Adding mockSetRequestHandler to match production code changes
    // Mock the MCP Server and transport to avoid actual stdio connection
    const mockConnect = vi.fn().mockResolvedValue(undefined);
    const mockSetRequestHandler = vi.fn();
    const MockServer = vi.fn().mockImplementation(() => ({
      connect: mockConnect,
      setRequestHandler: mockSetRequestHandler,
    }));
    const MockTransport = vi.fn().mockImplementation(() => ({}));

    vi.doMock('@modelcontextprotocol/sdk/server/index.js', () => ({
      Server: MockServer,
    }));
    vi.doMock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
      StdioServerTransport: MockTransport,
    }));

    // DO NOT set validation mode - let it run the full startup
    // But we need to handle the infinite promise, so we'll race it with a timeout
    const { main } = await import('../src/index.js');

    // Race the main function with a timeout since it runs indefinitely
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => resolve('timeout'), 100);
    });

    const mainPromise = main();
    const result = await Promise.race([mainPromise, timeoutPromise]);

    expect(result).toBe('timeout'); // Should timeout because main() runs indefinitely
    expect(MockServer).toHaveBeenCalledWith({
      name: 'SmartSuite API Shim',
      version: '1.0.0',
    });
    expect(MockTransport).toHaveBeenCalled();
    expect(mockConnect).toHaveBeenCalled();
    // TESTGUARD-APPROVED: Verify MCP protocol handlers are registered
    expect(mockSetRequestHandler).toHaveBeenCalledTimes(2);
    expect(mockSetRequestHandler).toHaveBeenCalledWith(
      ListToolsRequestSchema,
      expect.any(Function),
    );
    expect(mockSetRequestHandler).toHaveBeenCalledWith(CallToolRequestSchema, expect.any(Function));

    vi.doUnmock('@modelcontextprotocol/sdk/server/index.js');
    vi.doUnmock('@modelcontextprotocol/sdk/server/stdio.js');
  });

  it('should log MCP server connection success when not in validation mode', async () => {
    // TESTGUARD-APPROVED: Adding mockSetRequestHandler to match production code changes
    // Mock successful MCP connection
    const mockConnect = vi.fn().mockResolvedValue(undefined);
    const mockSetRequestHandler = vi.fn();
    vi.doMock('@modelcontextprotocol/sdk/server/index.js', () => ({
      Server: vi.fn().mockImplementation(() => ({
        connect: mockConnect,
        setRequestHandler: mockSetRequestHandler,
      })),
    }));
    vi.doMock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
      StdioServerTransport: vi.fn().mockImplementation(() => ({})),
    }));

    const { main } = await import('../src/index.js');

    // Race with timeout since main() runs indefinitely
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => resolve('timeout'), 100);
    });

    await Promise.race([main(), timeoutPromise]);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      'MCP Server connected with tool handlers ready for stdio communication',
    );

    vi.doUnmock('@modelcontextprotocol/sdk/server/index.js');
    vi.doUnmock('@modelcontextprotocol/sdk/server/stdio.js');
  });

  it('should skip MCP connection in validation mode', async () => {
    // Mock the MCP components
    const MockServer = vi.fn();
    const MockTransport = vi.fn();

    vi.doMock('@modelcontextprotocol/sdk/server/index.js', () => ({
      Server: MockServer,
    }));
    vi.doMock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
      StdioServerTransport: MockTransport,
    }));

    // Set validation mode to exit before MCP initialization
    process.env.MCP_VALIDATE_AND_EXIT = 'true';

    const { main } = await import('../src/index.js');
    const exitCode = await main();

    expect(exitCode).toBe(0);
    // In validation mode, MCP components should not be called
    expect(MockServer).not.toHaveBeenCalled();
    expect(MockTransport).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith('CI startup validation successful');

    vi.doUnmock('@modelcontextprotocol/sdk/server/index.js');
    vi.doUnmock('@modelcontextprotocol/sdk/server/stdio.js');
  });

  it('should handle MCP connection failures gracefully', async () => {
    const connectionError = new Error('Failed to connect to stdio transport');
    const mockConnect = vi.fn().mockRejectedValue(connectionError);

    vi.doMock('@modelcontextprotocol/sdk/server/index.js', () => ({
      Server: vi.fn().mockImplementation(() => ({
        connect: mockConnect,
        setRequestHandler: vi.fn(),
      })),
    }));
    vi.doMock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
      StdioServerTransport: vi.fn().mockImplementation(() => ({})),
    }));

    const { main } = await import('../src/index.js');

    // Should propagate the connection error
    await expect(main()).rejects.toThrow('Failed to connect to stdio transport');

    vi.doUnmock('@modelcontextprotocol/sdk/server/index.js');
    vi.doUnmock('@modelcontextprotocol/sdk/server/stdio.js');
  });
});
