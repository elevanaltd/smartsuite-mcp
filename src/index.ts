// Phoenix Implementation: MCP Entry Point (Phase 2F GREEN)
// Contract: ENTRY-001 to ENTRY-008 (21 test contracts)
// TDD Phase: GREEN (minimal implementation to pass RED tests)
// Architecture: Entry Point → Server → Tools → Handlers → Client → API

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import {
  createServer,
  startServer as initializeServer,
  shutdownServer,
  handleError,
} from './mcp/server.js';

// ============================================================================
// SERVER EXPORT
// ============================================================================

/**
 * Export MCP server instance for programmatic access
 * CONTRACT: ENTRY-001 - Server export for MCP clients
 */
export const server = createServer();

/**
 * Start MCP server with bootstrapping
 * CONTRACT: ENTRY-007, ENTRY-008 - Configuration loading and startup
 */
export async function startServer(): Promise<void> {
  // Bootstrap server initialization (loads config, initializes client)
  await initializeServer();
}

// ============================================================================
// STDIO TRANSPORT
// ============================================================================

/**
 * Create StdioServerTransport for MCP communication
 * CONTRACT: ENTRY-002 - Transport creation
 */
export function createTransport(): StdioServerTransport {
  return new StdioServerTransport();
}

// ============================================================================
// SIGNAL HANDLING
// ============================================================================

/**
 * Setup signal handlers for graceful shutdown
 * CONTRACT: ENTRY-003, ENTRY-004 - SIGTERM/SIGINT handling
 */
export function setupSignalHandlers(
  serverInstance: Server,
  transport: StdioServerTransport,
): void {
  // SIGTERM handler
  process.on('SIGTERM', async () => {
    console.error('Received SIGTERM signal');
    await shutdownServer(serverInstance, transport);
    process.exit(0);
  });

  // SIGINT handler (Ctrl+C)
  process.on('SIGINT', async () => {
    console.error('Received SIGINT signal');
    await shutdownServer(serverInstance, transport);
    process.exit(0);
  });
}

// ============================================================================
// ERROR BOUNDARIES
// ============================================================================

/**
 * Handle uncaught exceptions
 * CONTRACT: ENTRY-005 - Unhandled error handling
 */
export function handleUncaughtException(error: Error): void {
  console.error('Uncaught exception:', error);
  process.exit(1);
}

/**
 * Handle unhandled promise rejections
 * CONTRACT: ENTRY-006 - Unhandled rejection handling
 */
export function handleUnhandledRejection(error: Error): void {
  console.error('Unhandled rejection:', error);
  process.exit(1);
}

// ============================================================================
// BOOTSTRAP (Only when run as main module)
// ============================================================================

// Register global error handlers immediately at module load
// CONTRACT: Error boundaries must be active for the entire process lifecycle
process.on('uncaughtException', handleUncaughtException);
process.on('unhandledRejection', handleUnhandledRejection as (reason: unknown) => void);

// Check if this file is being run directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  void (async (): Promise<void> => {
    try {
      // Create transport
      const transport = createTransport();

      // Setup signal handlers
      setupSignalHandlers(server, transport);

      // Start server
      await startServer();

      // Connect server to transport
      await server.connect(transport);

      console.error('SmartSuite MCP Server is running');
    } catch (error) {
      if (error instanceof Error) {
        handleError(error);
      }
      process.exit(1);
    }
  })();
}
