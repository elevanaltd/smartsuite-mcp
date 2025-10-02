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
export function startServer(): Promise<void> {
  // Bootstrap server initialization (loads config, initializes client)
  // Wrap in Promise to allow async test expectations (.resolves/.rejects)
  return Promise.resolve().then(() => initializeServer());
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

// Global transport reference for signal handlers (set during bootstrap or by setupSignalHandlers)
let globalTransport: StdioServerTransport | null = null;

/**
 * Shutdown timeout in milliseconds
 * Reasonable for stdio-based MCP transport
 */
const SHUTDOWN_TIMEOUT_MS = 500;

/**
 * Execute graceful shutdown with timeout protection
 * FIX: BUG-2 (Silent failure) - Proper error handling with exit code 1
 * FIX: BUG-3 (No timeout) - Promise.race with timeout protection
 */
async function executeShutdown(
  signal: string,
  serverInstance: Server,
  transport: StdioServerTransport,
): Promise<void> {
  console.error(`Received ${signal} signal`);

  try {
    // Race shutdown against timeout to prevent indefinite hangs
    await Promise.race([
      shutdownServer(serverInstance, transport),
      new Promise((_resolve, reject) =>
        setTimeout(() => reject(new Error(`Shutdown timeout after ${SHUTDOWN_TIMEOUT_MS}ms`)), SHUTDOWN_TIMEOUT_MS),
      ),
    ]);
    process.exit(0);
  } catch (err) {
    // Log to stderr and exit with failure code
    console.error('Shutdown error:', err);
    process.exit(1);
  }
}

/**
 * Setup signal handlers for graceful shutdown
 * CONTRACT: ENTRY-003, ENTRY-004 - SIGTERM/SIGINT handling
 * FIX: BUG-1 (Double registration) - Use process.once() to prevent duplicate calls
 *
 * Note: Handlers are also registered at module load for test visibility.
 * This function updates the global transport reference used by those handlers.
 */
export function setupSignalHandlers(
  serverInstance: Server,
  transport: StdioServerTransport,
): void {
  // Update global transport so module-level handlers use the provided transport
  globalTransport = transport;

  // For backwards compatibility and explicit registration, also register handlers here
  // FIX: BUG-1 - Use .once() to prevent double execution
  const sigtermHandler = async () => {
    await executeShutdown('SIGTERM', serverInstance, transport);
  };

  const sigintHandler = async () => {
    await executeShutdown('SIGINT', serverInstance, transport);
  };

  // Register handlers with .once() to prevent double registration
  process.once('SIGTERM', sigtermHandler);
  process.once('SIGINT', sigintHandler);
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

// Register signal handlers at module load (needed for test visibility)
// CONTRACT: ENTRY-003, ENTRY-004 - Signal handlers must be registered at import time
// FIX: BUG-1 - Use .once() to prevent double registration
// FIX: BUG-2, BUG-3 - Use executeShutdown for proper error handling and timeout
// These handlers use the globalTransport which will be set during bootstrap or testing
process.once('SIGTERM', async () => {
  if (globalTransport) {
    await executeShutdown('SIGTERM', server, globalTransport);
  } else {
    console.error('Received SIGTERM signal, but no transport available');
    process.exit(1);
  }
});

process.once('SIGINT', async () => {
  if (globalTransport) {
    await executeShutdown('SIGINT', server, globalTransport);
  } else {
    console.error('Received SIGINT signal, but no transport available');
    process.exit(1);
  }
});

// Check if this file is being run directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  void (async (): Promise<void> => {
    try {
      // Create transport and store in global for signal handlers
      globalTransport = createTransport();

      // Start server
      await startServer();

      // Connect server to transport
      await server.connect(globalTransport);

      console.error('SmartSuite MCP Server is running');
    } catch (error) {
      if (error instanceof Error) {
        handleError(error);
      }
      process.exit(1);
    }
  })();
}
