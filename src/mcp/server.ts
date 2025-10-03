// Phoenix Implementation: MCP Server Layer (Phase 2F GREEN)
// Contract: SERVER-001 to SERVER-010 (29 test contracts)
// TDD Phase: GREEN (minimal implementation to pass RED tests)
// Architecture: Server → Tools → Handlers → Client → API

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import packageJson from '../../package.json' with { type: 'json' };
import { FieldTranslator } from '../core/field-translator.js';
import { createClient, type SmartSuiteClient } from '../core/smartsuite-client.js';

import {
  getToolSchemas,
  setToolsClient,
  setFieldTranslator,
  executeQueryTool,
  executeRecordTool,
  executeSchemaTool,
  executeDiscoverTool,
  executeUndoTool,
  executeIntelligentTool,
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

  // Register tools/list handler
  // CONTRACT: SERVER-005 - Tool discovery endpoint
  server.setRequestHandler(ListToolsRequestSchema, () => {
    const tools = getRegisteredTools();

    return {
      tools: tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };
  });

  // Register tools/call handler
  // CONTRACT: SERVER-007 - Tool execution endpoint
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      const result = await executeToolByName(name, args ?? {});

      return {
        content: [
          {
            type: 'text',
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      // Return error as content for MCP protocol compliance
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      return {
        content: [
          {
            type: 'text',
            text: `Error: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

// ============================================================================
// TOOL REGISTRATION
// ============================================================================

/**
 * Get registered tool schemas
 * CONTRACT: SERVER-005, SERVER-006 - Tool registration with MCP-compliant schemas
 * Phase 2G Revised: Direct 6-tool architecture (architectural amendment 44373ac)
 * Returns all 6 tools without facade layer filtering
 */
export function getRegisteredTools(): ReturnType<typeof getToolSchemas> {
  // Phase 2G Revised: Register all 6 tools directly
  // smartsuite_query, smartsuite_record, smartsuite_schema, smartsuite_discover, smartsuite_undo, smartsuite_intelligent
  return getToolSchemas();
}

/**
 * Execute tool by name
 * CONTRACT: SERVER-007 - Tool handler connection
 * Phase 2G Revised: Route all 6 tools to their respective handlers
 */
export function executeToolByName(
  name: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  // Phase 2G Revised: Direct routing to all 6 tool handlers
  switch (name) {
    case 'smartsuite_query':
      return executeQueryTool(params);

    case 'smartsuite_record':
      return executeRecordTool(params);

    case 'smartsuite_schema':
      return executeSchemaTool(params);

    case 'smartsuite_discover':
      return executeDiscoverTool(params);

    case 'smartsuite_undo':
      return executeUndoTool(params);

    case 'smartsuite_intelligent':
      return executeIntelligentTool(params);

    default:
      return Promise.reject(new Error(
        `Unknown tool: ${name}. Registered tools: smartsuite_query, smartsuite_record, smartsuite_schema, smartsuite_discover, smartsuite_undo, smartsuite_intelligent`,
      ));
  }
}

// ============================================================================
// SERVER LIFECYCLE
// ============================================================================

/**
 * Start MCP server and register handlers
 * CONTRACT: SERVER-008 - Server startup
 */
export function startServer(): void {
  // Load configuration and initialize client
  const config = loadConfiguration();
  const client = createClient(config.apiKey, config.workspaceId, config.apiUrl);

  // Initialize field translator with client
  const translator = new FieldTranslator(client);

  // Set dependencies for tools
  setToolsClient(client);
  setFieldTranslator(translator);

  // Log successful startup
  // eslint-disable-next-line no-console -- MCP lifecycle logging to stderr (doesn't interfere with STDIO)
  console.error(
    `SmartSuite MCP Server started - ${packageJson.name} v${packageJson.version}`,
  );
  // eslint-disable-next-line no-console -- MCP lifecycle logging to stderr (doesn't interfere with STDIO)
  console.error(`Workspace: ${config.workspaceId}`);
  // eslint-disable-next-line no-console -- MCP lifecycle logging to stderr (doesn't interfere with STDIO)
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
  // eslint-disable-next-line no-console -- MCP lifecycle logging to stderr (doesn't interfere with STDIO)
  console.error('Shutting down SmartSuite MCP Server...');

  // Close transport if provided
  if (transport) {
    await transport.close();
  }

  // MCP SDK Server doesn't have explicit close method
  // Cleanup is handled by transport closure and process exit

  // eslint-disable-next-line no-console -- MCP lifecycle logging to stderr (doesn't interfere with STDIO)
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
  // eslint-disable-next-line no-console -- MCP lifecycle logging to stderr (doesn't interfere with STDIO)
  console.error('SmartSuite MCP Server Error:', error);

  if (error.stack) {
    // eslint-disable-next-line no-console -- MCP lifecycle logging to stderr (doesn't interfere with STDIO)
    console.error('Stack trace:', error.stack);
  }
}
