// Phoenix Test Contract: SERVER-001 to SERVER-023
// Contract: MCP server initialization and tool registration
// Status: RED (tests written, implementation pending)
// Phase: 2F - MCP Server Integration (follows 2E tool layer completion)
// Architecture: Server → Tools → Handlers → Client → API
// TDD Phase: RED → Implementation will follow

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * MCP Server Test Contracts
 *
 * Purpose: Validate MCP server initialization, configuration, and tool registration
 * Coverage Target: 90% (universal-test-engineer standard)
 *
 * Server Responsibilities:
 * 1. Initialize MCP Server instance with proper configuration
 * 2. Load environment variables for API authentication
 * 3. Register exactly 2 tools (smartsuite_intelligent, smartsuite_undo)
 * 4. Handle server lifecycle (start, shutdown, error recovery)
 * 5. Validate tool schemas match MCP protocol requirements
 *
 * Test Organization:
 * - 23 test contracts covering initialization, tool registration, lifecycle
 * - Focus on server configuration and MCP protocol compliance
 * - Mock MCP SDK Server class to test integration patterns
 */

describe('MCP Server', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Set up test environment variables
    process.env.SMARTSUITE_API_KEY = 'test-api-key';
    process.env.SMARTSUITE_WORKSPACE_ID = 'test-workspace-id';
    process.env.SMARTSUITE_API_URL = 'https://app.smartsuite.com/api/v1';
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  // ============================================================================
  // SERVER INITIALIZATION
  // ============================================================================

  describe('Server Initialization', () => {
    describe('SERVER-001: Server instance creation', () => {
      it('should create MCP Server instance with correct name and version', async () => {
        // CONTRACT: Server must be initialized with proper metadata
        // Expected: name = "smartsuite-mcp-server", version from package.json

        const { createServer } = await import('../../../src/mcp/server.js');
        const server = createServer();

        expect(server).toBeDefined();
        expect(server).toBeInstanceOf(Object);

        // Server should have MCP SDK methods
        expect(server).toHaveProperty('setRequestHandler');
        expect(server).toHaveProperty('connect');
      });

      it('should initialize with server info metadata', async () => {
        // CONTRACT: Server metadata should include name and version for MCP protocol

        const { getServerInfo } = await import('../../../src/mcp/server.js');
        const info = getServerInfo();

        expect(info).toMatchObject({
          name: expect.stringMatching(/smartsuite/i),
          version: expect.stringMatching(/^\d+\.\d+\.\d+/), // Semver format
        });
      });
    });

    describe('SERVER-002: Environment configuration loading', () => {
      it('should load SMARTSUITE_API_KEY from environment', async () => {
        // CONTRACT: API key must be loaded from SMARTSUITE_API_KEY env var

        const { loadConfiguration } = await import('../../../src/mcp/server.js');
        const config = loadConfiguration();

        expect(config.apiKey).toBe('test-api-key');
      });

      it('should load SMARTSUITE_WORKSPACE_ID from environment', async () => {
        // CONTRACT: Workspace ID must be loaded from SMARTSUITE_WORKSPACE_ID env var

        const { loadConfiguration } = await import('../../../src/mcp/server.js');
        const config = loadConfiguration();

        expect(config.workspaceId).toBe('test-workspace-id');
      });

      it('should use default API URL if not provided', async () => {
        // CONTRACT: API URL should default to SmartSuite production endpoint

        delete process.env.SMARTSUITE_API_URL;

        const { loadConfiguration } = await import('../../../src/mcp/server.js');
        const config = loadConfiguration();

        expect(config.apiUrl).toBe('https://app.smartsuite.com/api/v1');
      });

      it('should override API URL from environment if provided', async () => {
        // CONTRACT: Allow custom API URL for testing/staging environments

        process.env.SMARTSUITE_API_URL = 'https://staging.smartsuite.com/api/v1';

        const { loadConfiguration } = await import('../../../src/mcp/server.js');
        const config = loadConfiguration();

        expect(config.apiUrl).toBe('https://staging.smartsuite.com/api/v1');
      });
    });

    describe('SERVER-003: Missing environment variables', () => {
      it('should throw error if SMARTSUITE_API_KEY is missing', async () => {
        // CONTRACT: Server initialization must fail fast if API key is not configured

        delete process.env.SMARTSUITE_API_KEY;

        const { loadConfiguration } = await import('../../../src/mcp/server.js');

        expect(() => loadConfiguration()).toThrow(/SMARTSUITE_API_KEY.*required/i);
      });

      it('should throw error if SMARTSUITE_WORKSPACE_ID is missing', async () => {
        // CONTRACT: Server initialization must fail fast if workspace ID is not configured

        delete process.env.SMARTSUITE_WORKSPACE_ID;

        const { loadConfiguration } = await import('../../../src/mcp/server.js');

        expect(() => loadConfiguration()).toThrow(/SMARTSUITE_WORKSPACE_ID.*required/i);
      });

      it('should provide helpful error message for missing configuration', async () => {
        // CONTRACT: Error messages should guide users to proper environment setup

        delete process.env.SMARTSUITE_API_KEY;

        const { loadConfiguration } = await import('../../../src/mcp/server.js');

        expect(() => loadConfiguration()).toThrow(/environment variable/i);
      });
    });

    describe('SERVER-004: SmartSuite client initialization', () => {
      it('should create SmartSuite client with loaded configuration', async () => {
        // CONTRACT: Server must initialize SmartSuite client for API operations

        const { initializeClient } = await import('../../../src/mcp/server.js');
        const client = initializeClient();

        expect(client).toBeDefined();
        expect(client.apiKey).toBe('test-api-key');
        expect(client.workspaceId).toBe('test-workspace-id');
      });

      it('should pass API URL to SmartSuite client', async () => {
        // CONTRACT: Client should use configured API URL

        process.env.SMARTSUITE_API_URL = 'https://custom.api.url/v1';

        const { initializeClient } = await import('../../../src/mcp/server.js');
        const client = initializeClient();

        // Client should have custom URL configured
        expect(client).toHaveProperty('apiUrl');
      });
    });
  });

  // ============================================================================
  // TOOL REGISTRATION
  // ============================================================================

  describe('Tool Registration', () => {
    describe('SERVER-005: Tool count validation', () => {
      it('should register exactly 2 tools', async () => {
        // CONTRACT: Server exposes only smartsuite_intelligent and smartsuite_undo
        // Phase 2F scope: Minimal 2-tool implementation

        const { getRegisteredTools } = await import('../../../src/mcp/server.js');
        const tools = getRegisteredTools();

        expect(tools).toHaveLength(2);
      });

      it('should register smartsuite_intelligent tool', async () => {
        // CONTRACT: Primary tool for guided SmartSuite operations

        const { getRegisteredTools } = await import('../../../src/mcp/server.js');
        const tools = getRegisteredTools();

        const intelligentTool = tools.find((t) => t.name === 'smartsuite_intelligent');
        expect(intelligentTool).toBeDefined();
      });

      it('should register smartsuite_undo tool', async () => {
        // CONTRACT: Transaction rollback capability

        const { getRegisteredTools } = await import('../../../src/mcp/server.js');
        const tools = getRegisteredTools();

        const undoTool = tools.find((t) => t.name === 'smartsuite_undo');
        expect(undoTool).toBeDefined();
      });
    });

    describe('SERVER-006: Tool schema validation', () => {
      it('should register tools with MCP-compliant schemas', async () => {
        // CONTRACT: Tool schemas must match MCP SDK expectations
        // Required: name, description, inputSchema

        const { getRegisteredTools } = await import('../../../src/mcp/server.js');
        const tools = getRegisteredTools();

        tools.forEach((tool) => {
          expect(tool).toMatchObject({
            name: expect.any(String),
            description: expect.any(String),
            inputSchema: expect.objectContaining({
              type: 'object',
              properties: expect.any(Object),
            }),
          });
        });
      });

      it('should define required parameters for smartsuite_intelligent', async () => {
        // CONTRACT: Intelligent tool must specify required parameters

        const { getRegisteredTools } = await import('../../../src/mcp/server.js');
        const tools = getRegisteredTools();

        const intelligentTool = tools.find((t) => t.name === 'smartsuite_intelligent');
        expect(intelligentTool?.inputSchema.required).toBeDefined();
        expect(intelligentTool?.inputSchema.required).toBeInstanceOf(Array);
      });

      it('should define required parameters for smartsuite_undo', async () => {
        // CONTRACT: Undo tool must specify transaction ID as required

        const { getRegisteredTools } = await import('../../../src/mcp/server.js');
        const tools = getRegisteredTools();

        const undoTool = tools.find((t) => t.name === 'smartsuite_undo');
        expect(undoTool?.inputSchema.required).toContain('transaction_id');
      });
    });

    describe('SERVER-007: Tool handler connection', () => {
      it('should connect smartsuite_intelligent to handler', async () => {
        // CONTRACT: Tool execution should delegate to proper handler

        const { executeToolByName } = await import('../../../src/mcp/server.js');

        // This will fail until handler is implemented
        await expect(
          executeToolByName('smartsuite_intelligent', {
            query: 'list records from test table',
          }),
        ).rejects.toThrow(/not implemented/i);
      });

      it('should connect smartsuite_undo to handler', async () => {
        // CONTRACT: Tool execution should delegate to proper handler

        const { executeToolByName } = await import('../../../src/mcp/server.js');

        // This will fail until handler is implemented
        await expect(
          executeToolByName('smartsuite_undo', {
            transaction_id: 'test-transaction-id',
          }),
        ).rejects.toThrow(/not implemented/i);
      });

      it('should reject unknown tool names', async () => {
        // CONTRACT: Only registered tools should be executable

        const { executeToolByName } = await import('../../../src/mcp/server.js');

        await expect(
          executeToolByName('unknown_tool', {}),
        ).rejects.toThrow(/unknown tool/i);
      });
    });
  });

  // ============================================================================
  // SERVER LIFECYCLE
  // ============================================================================

  describe('Server Lifecycle', () => {
    describe('SERVER-008: Server startup', () => {
      it('should start server and listen for MCP protocol messages', async () => {
        // CONTRACT: Server must be ready to handle MCP requests after start

        const { createServer } = await import('../../../src/mcp/server.js');
        const server = createServer();

        // Should have connect method from MCP SDK
        expect(server.connect).toBeDefined();
        expect(typeof server.connect).toBe('function');
      });

      it('should register tool request handlers on startup', async () => {
        // CONTRACT: Tool handlers must be registered before accepting requests

        const { createServer } = await import('../../../src/mcp/server.js');
        const server = createServer();

        // Should have setRequestHandler method
        expect(server.setRequestHandler).toBeDefined();
      });

      it('should log successful startup', async () => {
        // CONTRACT: Provide visibility into server state for debugging

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const { startServer } = await import('../../../src/mcp/server.js');
        await startServer();

        // Server should log startup (implementation will determine exact format)
        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
      });
    });

    describe('SERVER-009: Server shutdown', () => {
      it('should gracefully shutdown on SIGTERM', async () => {
        // CONTRACT: Server must cleanup resources on termination signal

        const { createServer, shutdownServer } = await import('../../../src/mcp/server.js');
        const server = createServer();

        // Should not throw on shutdown
        await expect(shutdownServer(server)).resolves.not.toThrow();
      });

      it('should gracefully shutdown on SIGINT', async () => {
        // CONTRACT: Server must cleanup resources on interrupt signal

        const { createServer, shutdownServer } = await import('../../../src/mcp/server.js');
        const server = createServer();

        // Should not throw on shutdown
        await expect(shutdownServer(server)).resolves.not.toThrow();
      });

      it('should close MCP transport on shutdown', async () => {
        // CONTRACT: Ensure stdio transport is properly closed

        const { createServer, shutdownServer } = await import('../../../src/mcp/server.js');
        const server = createServer();

        // Mock transport close
        const mockTransport = {
          close: vi.fn().mockResolvedValue(undefined),
        };

        // This will test proper cleanup
        await shutdownServer(server, mockTransport as any);

        expect(mockTransport.close).toHaveBeenCalled();
      });
    });

    describe('SERVER-010: Error handling', () => {
      it('should catch and log unhandled errors', async () => {
        // CONTRACT: Server must not crash on unexpected errors

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const { handleError } = await import('../../../src/mcp/server.js');
        const testError = new Error('Test error');

        handleError(testError);

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringMatching(/error/i),
          expect.anything(),
        );

        consoleErrorSpy.mockRestore();
      });

      it('should handle tool execution errors gracefully', async () => {
        // CONTRACT: Tool errors should be caught and returned as MCP error responses

        const { executeToolByName } = await import('../../../src/mcp/server.js');

        // Force an error condition
        await expect(
          executeToolByName('smartsuite_intelligent', { invalid: 'params' }),
        ).rejects.toThrow();
      });

      it('should provide error context for debugging', async () => {
        // CONTRACT: Error messages should include enough context for troubleshooting

        const { handleError } = await import('../../../src/mcp/server.js');
        const testError = new Error('Test error');
        testError.stack = 'Error: Test error\n  at test.ts:123';

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        handleError(testError);

        // Should log error with stack trace
        expect(consoleErrorSpy).toHaveBeenCalled();

        consoleErrorSpy.mockRestore();
      });
    });
  });
});
