// Phoenix Implementation: MCP Server Layer (Phase 2F GREEN)
// Contract: SERVER-001 to SERVER-010 (29 test contracts)
// TDD Phase: GREEN (minimal implementation to pass RED tests)
// Architecture: Server → Tools → Handlers → Client → API

import { Server } from '@modelcontextprotocol/sdk/server/index.js';

import packageJson from '../../package.json' with { type: 'json' };
import { FieldTranslator } from '../core/field-translator.js';
import { createClient, type SmartSuiteClient } from '../core/smartsuite-client.js';

import {
  getToolSchemas,
  setToolsClient,
  setFieldTranslator,
  executeUndoTool,
} from './tools.js';


// ============================================================================
// SERVER INITIALIZATION
// ============================================================================

/**
 * Server configuration interface
 */
interface ServerConfig {
  apiKey: string;
  workspaceId: string;
  apiUrl: string;
}

/**
 * Server info metadata for MCP protocol
 */
interface ServerInfo {
  name: string;
  version: string;
}

/**
 * MCP Transport interface (for shutdown)
 */
interface Transport {
  close(): Promise<void>;
}

/**
 * Get server info metadata
 * CONTRACT: SERVER-001 - Server metadata for MCP protocol
 */
export function getServerInfo(): ServerInfo {
  return {
    name: packageJson.name,
    version: packageJson.version,
  };
}

/**
 * Load configuration from environment variables
 * CONTRACT: SERVER-002, SERVER-003 - Environment configuration with validation
 */
export function loadConfiguration(): ServerConfig {
  const apiKey = process.env.SMARTSUITE_API_KEY;
  const workspaceId = process.env.SMARTSUITE_WORKSPACE_ID;
  const apiUrl =
    process.env.SMARTSUITE_API_URL ?? 'https://app.smartsuite.com/api/v1';

  // Validate required environment variables
  if (!apiKey) {
    throw new Error(
      'SMARTSUITE_API_KEY environment variable is required. Please set this variable to authenticate with SmartSuite API.',
    );
  }

  if (!workspaceId) {
    throw new Error(
      'SMARTSUITE_WORKSPACE_ID environment variable is required. Please set this variable to specify your SmartSuite workspace.',
    );
  }

  return {
    apiKey,
    workspaceId,
    apiUrl,
  };
}

/**
 * Initialize SmartSuite client with loaded configuration
 * CONTRACT: SERVER-004 - Client initialization
 */
export function initializeClient(): SmartSuiteClient {
  const config = loadConfiguration();
  return createClient(config.apiKey, config.workspaceId, config.apiUrl);
}

/**
 * Create MCP Server instance with tool registration
 * CONTRACT: SERVER-001 - Server instance creation
 */
export function createServer(): Server {
  const info = getServerInfo();

  const server = new Server({
    name: info.name,
    version: info.version,
  });

  return server;
}

// ============================================================================
// TOOL REGISTRATION
// ============================================================================

/**
 * Get registered tool schemas
 * CONTRACT: SERVER-005, SERVER-006 - Tool registration with MCP-compliant schemas
 * Phase 2F scope: Return only 2 tools (smartsuite_intelligent, smartsuite_undo)
 */
export function getRegisteredTools(): ReturnType<typeof getToolSchemas> {
  const allTools = getToolSchemas();

  // Phase 2F: Register exactly 2 tools as per test contracts
  const registeredTools = allTools.filter(
    (tool) => tool.name === 'smartsuite_intelligent' || tool.name === 'smartsuite_undo',
  );

  return registeredTools;
}

/**
 * Execute tool by name
 * CONTRACT: SERVER-007 - Tool handler connection
 */
export async function executeToolByName(
  name: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  // Phase 2F: Only smartsuite_intelligent and smartsuite_undo are registered
  // All other tools throw "unknown tool" error

  if (name === 'smartsuite_intelligent') {
    // Intelligent tool not yet implemented - placeholder for Phase 2G
    throw new Error(
      'smartsuite_intelligent not implemented - guided operations coming in Phase 2G',
    );
  } else if (name === 'smartsuite_undo') {
    // Undo tool implementation
    return executeUndoTool(params);
  } else {
    throw new Error(`Unknown tool: ${name}. Only smartsuite_intelligent and smartsuite_undo are registered.`);
  }
}

// ============================================================================
// SERVER LIFECYCLE
// ============================================================================

/**
 * Start MCP server and register handlers
 * CONTRACT: SERVER-008 - Server startup
 */
export async function startServer(): Promise<void> {
  // Load configuration and initialize client
  const config = loadConfiguration();
  const client = createClient(config.apiKey, config.workspaceId, config.apiUrl);

  // Initialize field translator with client
  const translator = new FieldTranslator(client);

  // Set dependencies for tools
  setToolsClient(client);
  setFieldTranslator(translator);

  // Log successful startup
  console.error(
    `SmartSuite MCP Server started - ${packageJson.name} v${packageJson.version}`,
  );
  console.error(`Workspace: ${config.workspaceId}`);
  console.error(`API URL: ${config.apiUrl}`);
}

/**
 * Shutdown server gracefully
 * CONTRACT: SERVER-009 - Graceful shutdown
 */
export async function shutdownServer(
  _server: Server,
  transport?: Transport,
): Promise<void> {
  console.error('Shutting down SmartSuite MCP Server...');

  // Close transport if provided
  if (transport) {
    await transport.close();
  }

  // MCP SDK Server doesn't have explicit close method
  // Cleanup is handled by transport closure and process exit

  console.error('Shutdown complete');
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Handle unhandled errors
 * CONTRACT: SERVER-010 - Error handling with context
 */
export function handleError(error: Error): void {
  console.error('SmartSuite MCP Server Error:', error);

  if (error.stack) {
    console.error('Stack trace:', error.stack);
  }
}
