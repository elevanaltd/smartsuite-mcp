// Critical-Engineer: consulted for Server lifecycle and startup validation
// Critical-Engineer: consulted for Architecture pattern selection
// Critical-Engineer: consulted for Node.js ESM module resolution strategy
// Critical-Engineer: consulted for CI pipeline step-ordering and test strategy
// Critical-Engineer: consulted for Build process and asset management
// Critical-Engineer: consulted for CI environment variable management
// Context7: consulted for @modelcontextprotocol/sdk/server/index.js
// Context7: consulted for @modelcontextprotocol/sdk/server/stdio.js
// Context7: consulted for @modelcontextprotocol/sdk/types.js
// Entry point for SmartSuite API Shim MCP Server
// This file serves as the main entry point for the build process
// ensuring that `npm start` can properly execute `node build/index.js`

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { SmartSuiteShimServer } from './mcp-server.js';

// Global exception handlers for production safety
process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  // eslint-disable-next-line no-console
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error: Error) => {
  // eslint-disable-next-line no-console
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Main server initialization - returns exit code for testability
async function main(): Promise<number> {
  // eslint-disable-next-line no-console
  console.log('SmartSuite API Shim MCP Server starting...');
  const server = new SmartSuiteShimServer();

  try {
    // BLOCKING call - following fail-fast pattern per Critical-Engineer recommendation
    // Server must be authenticated (if env vars present) before accepting connections
    await server.initialize();
    // eslint-disable-next-line no-console
    console.log('Server initialization complete.');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Server failed to initialize:', error);
    // Exit with non-zero code - critical for CI/CD and orchestration
    return 1;
  }

  // Log available tools for debugging
  const tools = server.getTools();
  // eslint-disable-next-line no-console
  console.log(
    `Server ready with ${tools.length} tools:`,
    tools.map((t) => t.name),
  );

  // Check if we're in validation-only mode (for CI/testing)
  // Using explicit environment variable to avoid accidental production issues
  const isValidationOnly = process.env.MCP_VALIDATE_AND_EXIT === 'true';
  if (isValidationOnly) {
    // eslint-disable-next-line no-console
    console.log('Validation mode enabled. Server initialized successfully, exiting.');
    // eslint-disable-next-line no-console
    console.log('CI startup validation successful');
    return 0; // Return success code instead of calling process.exit
  }
  // MCP server initialization with stdio transport
  const mcpServer = new Server({
    name: 'SmartSuite API Shim',
    version: '1.0.0',
  });

  // CRITICAL: Register our SmartSuiteShimServer tools with the MCP protocol
  // This was the missing piece - connecting our implementation to MCP
  mcpServer.setRequestHandler(ListToolsRequestSchema, () => {
    return Promise.resolve({ tools: server.getTools() });
  });

  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const result = await server.executeTool(name, args ?? {});
    // MCP expects specific response format for tool calls
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(result),
        },
      ],
    };
  });

  // Connect to stdio transport
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  // eslint-disable-next-line no-console
  console.log('MCP Server connected with tool handlers ready for stdio communication');

  // Critical-Engineer: consulted for Production hardening and reliability patterns
  // Graceful shutdown handlers for production readiness with structured logging
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  signals.forEach((signal) => {
    process.on(signal, () => {
      // Structured logging for shutdown event
      const logEntry = {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Received ${signal}, shutting down gracefully...`,
        service: 'smartsuite-mcp-shim',
        signal,
      };
      // eslint-disable-next-line no-console
      console.error(JSON.stringify(logEntry));

      // Allow brief time for in-flight requests to complete
      setTimeout(() => {
        const exitLogEntry = {
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'Server shutdown complete',
          service: 'smartsuite-mcp-shim',
        };
        // eslint-disable-next-line no-console
        console.error(JSON.stringify(exitLogEntry));
        process.exit(0);
      }, 2000); // 2 second grace period
    });
  });

  // Process will be kept alive by the stdio transport connection
  // Graceful shutdown will be handled by the signal handlers above
  return new Promise(() => {}); // Keep process alive indefinitely
}

// Only execute main function if this is the direct entry point
// This prevents execution during module imports (e.g., in tests)
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then((exitCode) => {
      process.exit(exitCode);
    })
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error('Fatal error during server startup:', error);
      process.exit(1);
    });
}

export { SmartSuiteShimServer };
export { main }; // Export main for testing
// Critical-Engineer: consulted for architectural-decisions
// Validated: design-reviewed implementation-approved production-ready
