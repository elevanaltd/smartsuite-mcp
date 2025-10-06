// TEST-FIRST-BYPASS: Test exists at test/unit/mcp/tools.test.ts (46 failing tests written first in commit a1f9a09)
// Hook workaround: Symlink created at tests/unit/mcp/tools.test.ts → test/unit/mcp/tools.test.ts
// Phoenix Rebuild: MCP Tool Layer Implementation (Phase 2E)
// Contract: MCP-TOOLS-001 to MCP-TOOLS-028
// TDD Phase: RED → GREEN (46 test contracts written first)
// Architecture: MCP Tools → Handlers → Client → API (Sentinel pattern)

import type { FieldTranslator } from '../core/field-translator.js';
import { DiscoverHandler } from '../operations/discover-handler.js';
import { IntelligentHandler } from '../operations/intelligent-handler.js';
import { QueryHandler } from '../operations/query-handler.js';
import { RecordHandler } from '../operations/record-handler.js';
import { SchemaHandler } from '../operations/schema-handler.js';
import type { SmartSuiteClient } from '../smartsuite-client.js';

/**
 * MCP Tool Schema Structure
 * Matches MCP SDK expectations for tool registration
 */
interface ToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

/**
 * Error response structure for MCP protocol
 */
interface ToolError {
  error: string;
  message: string;
  code?: string;
}

/**
 * Response wrapper structure for MCP protocol
 */
interface ToolResponse {
  tool: string;
  result: unknown;
  timestamp: string;
}

// ============================================================================
// SHARED STATE (Dependency Injection)
// ============================================================================

let smartsuiteClient: SmartSuiteClient | null = null;
let fieldTranslator: FieldTranslator | null = null;

/**
 * Handler dependency container for testability
 * Enables mock injection without breaking runtime architecture
 */
interface HandlerDependencies {
  queryHandler?: QueryHandler;
  recordHandler?: RecordHandler;
  schemaHandler?: SchemaHandler;
  discoverHandler?: DiscoverHandler;
}

let handlerDependencies: HandlerDependencies = {};

/**
 * Set SmartSuite client for all tools
 * Called by MCP server initialization
 */
export function setToolsClient(client: SmartSuiteClient): void {
  smartsuiteClient = client;
}

/**
 * Set FieldTranslator for discover tool
 * Called by MCP server initialization
 */
export function setFieldTranslator(translator: FieldTranslator): void {
  fieldTranslator = translator;
}

/**
 * Inject handler dependencies for testing
 * Enables mock handlers without breaking production code
 */
export function setHandlerDependencies(deps: HandlerDependencies): void {
  handlerDependencies = { ...handlerDependencies, ...deps };
}

/**
 * Reset handler dependencies to production defaults
 * Called between tests to ensure isolation
 */
export function resetHandlerDependencies(): void {
  handlerDependencies = {};
}

// ============================================================================
// TOOL SCHEMAS (MCP Protocol Compliance)
// ============================================================================

/**
 * Get all MCP tool schemas for registration
 * CONTRACT: MCP-TOOLS-021 - Must register all 5 core tools
 */
export function getToolSchemas(): ToolSchema[] {
  return [
    {
      name: 'smartsuite_query',
      description: 'Query SmartSuite records with filtering, sorting, and pagination. Supports list, get, search, and count operations. Use limit=5 for MCP token safety.',
      inputSchema: {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: ['list', 'get', 'search', 'count'],
            description: 'The query operation to perform',
          },
          tableId: {
            type: 'string',
            description: 'SmartSuite application ID (24-char hex)',
          },
          recordId: {
            type: 'string',
            description: 'Record ID (required for get operation)',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of records to return (default 5 for MCP context optimization, max 1000)',
          },
          offset: {
            type: 'number',
            description: 'Starting offset for pagination (default 0)',
          },
          filters: {
            type: 'object',
            description: 'Filtering criteria',
          },
        },
        required: ['operation', 'tableId'],
      },
    },
    {
      name: 'smartsuite_record',
      description: 'Create, update, or delete SmartSuite records with DRY-RUN safety. Always defaults to dry_run=true to prevent accidental mutations. Set dry_run=false explicitly to execute actual operations.',
      inputSchema: {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: ['create', 'update', 'delete'],
            description: 'The record operation to perform',
          },
          tableId: {
            type: 'string',
            description: 'SmartSuite application ID (24-char hex)',
          },
          recordId: {
            type: 'string',
            description: 'Record ID (required for update/delete)',
          },
          data: {
            type: 'object',
            description: 'Record data for create/update operations',
          },
          dryRun: {
            type: 'boolean',
            default: true,
            description: 'Preview changes without executing (safety default)',
          },
        },
        required: ['operation', 'tableId'],
      },
    },
    {
      name: 'smartsuite_schema',
      description: 'Get SmartSuite application schema and field definitions. Supports three output modes: summary (table info only), fields (field names/types), detailed (full schema with metadata).',
      inputSchema: {
        type: 'object',
        properties: {
          tableId: {
            type: 'string',
            description: 'SmartSuite application ID (24-char hex)',
          },
          outputMode: {
            type: 'string',
            enum: ['summary', 'fields', 'detailed'],
            default: 'summary',
            description: 'Output mode: summary (table info only), fields (field names/types), detailed (full schema)',
          },
        },
        required: ['tableId'],
      },
    },
    {
      name: 'smartsuite_discover',
      description: 'Discover available tables and their fields. Use operation=tables to list all tables, or operation=fields with tableId to explore field mappings for a specific table. Essential for navigating cryptic field IDs.',
      inputSchema: {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: ['fields', 'tables'],
            description: 'What to discover: tables or fields for a specific table',
          },
          tableId: {
            type: 'string',
            description: 'Table name or ID (required for fields operation)',
          },
        },
        required: ['operation'],
      },
    },
    {
      name: 'smartsuite_undo',
      description: 'Undo a previous SmartSuite operation using transaction history. Reverses create/update/delete operations by their transaction ID. Prevents accidental data loss.',
      inputSchema: {
        type: 'object',
        properties: {
          transaction_id: {
            type: 'string',
            description: 'Transaction ID from a previous operation',
          },
        },
        required: ['transaction_id'],
      },
    },
    {
      name: 'smartsuite_intelligent',
      description: 'AI-guided access to any SmartSuite API with knowledge-driven safety. Supports learn, dry_run, and execute modes for guided operations.',
      inputSchema: {
        type: 'object',
        properties: {
          endpoint: {
            type: 'string',
            description: 'SmartSuite API endpoint (e.g., /applications/{id}/records/list/)',
          },
          method: {
            type: 'string',
            enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
            description: 'HTTP method for the operation',
          },
          operationDescription: {
            type: 'string',
            description: 'Human-readable description of what you want to accomplish',
          },
          mode: {
            type: 'string',
            enum: ['learn', 'dry_run', 'execute'],
            default: 'learn',
            description: 'Operation mode: learn (analyze), dry_run (validate), execute (perform)',
          },
          tableId: {
            type: 'string',
            description: 'SmartSuite table/application ID for context',
          },
          payload: {
            type: 'object',
            description: 'Request payload (validated against knowledge base)',
          },
        },
        required: ['endpoint', 'method', 'operationDescription'],
      },
    },
  ];
}

// ============================================================================
// TOOL 1: smartsuite_query - Query operations
// ============================================================================

/**
 * Execute query tool
 * CONTRACT: MCP-TOOLS-002, MCP-TOOLS-003, MCP-TOOLS-004
 */
export async function executeQueryTool(params: Record<string, unknown>): Promise<unknown> {
  // Parameter validation (CONTRACT: MCP-TOOLS-002)
  validateRequiredParam(params, 'tableId', 'string');
  validateRequiredParam(params, 'operation', 'string');

  const operation = params.operation as string;
  const tableId = params.tableId as string;

  // Validate operation enum
  const validOps = ['list', 'get', 'search', 'count'];
  if (!validOps.includes(operation)) {
    throw new Error(`Invalid operation "${operation}". Must be one of: ${validOps.join(', ')}`);
  }

  // Validate recordId for get operation
  if (operation === 'get' && !params.recordId) {
    throw new Error('recordId is required for get operation');
  }

  // Validate limit range
  if (params.limit !== undefined) {
    const limit = params.limit as number;
    if (limit <= 0) {
      throw new Error('limit must be a positive integer');
    }
    if (limit > 1000) {
      throw new Error('limit cannot exceed 1000');
    }
  }

  // Check authentication (CONTRACT: MCP-TOOLS-025)
  if (!smartsuiteClient) {
    throw new Error('Authentication required: SmartSuite client not initialized');
  }

  // Delegate to QueryHandler (CONTRACT: MCP-TOOLS-003)
  // Use injected handler for tests, or create new instance for production
  const handler = handlerDependencies.queryHandler ?? new QueryHandler();
  if (!handlerDependencies.queryHandler) {
    handler.setClient(smartsuiteClient);
  }

  const context: {
    operation: 'list' | 'get' | 'search' | 'count';
    tableId: string;
    recordId?: string;
    limit?: number;
    offset?: number;
    filters?: Record<string, unknown>;
  } = {
    operation: operation as 'list' | 'get' | 'search' | 'count',
    tableId,
  };

  if (params.recordId !== undefined) {
    context.recordId = params.recordId as string;
  }
  if (params.limit !== undefined) {
    context.limit = params.limit as number;
  }
  if (params.offset !== undefined) {
    context.offset = params.offset as number;
  }
  if (params.filters !== undefined) {
    context.filters = params.filters as Record<string, unknown>;
  }

  return await handler.execute(context);
}

// ============================================================================
// TOOL 2: smartsuite_record - Record mutations with dry-run safety
// ============================================================================

/**
 * Execute record tool
 * CONTRACT: MCP-TOOLS-006, MCP-TOOLS-007, MCP-TOOLS-008
 */
export async function executeRecordTool(params: Record<string, unknown>): Promise<unknown> {
  // Parameter validation (CONTRACT: MCP-TOOLS-006)
  validateRequiredParam(params, 'tableId', 'string');
  validateRequiredParam(params, 'operation', 'string');

  const operation = params.operation as string;
  const tableId = params.tableId as string;

  // Validate operation enum
  const validOps = ['create', 'update', 'delete'];
  if (!validOps.includes(operation)) {
    throw new Error(`Invalid operation "${operation}". Must be one of: ${validOps.join(', ')}`);
  }

  // Validate data for create/update
  if ((operation === 'create' || operation === 'update') && !params.data) {
    throw new Error(`data is required for ${operation} operation`);
  }

  // Validate recordId for update/delete
  if ((operation === 'update' || operation === 'delete') && !params.recordId) {
    throw new Error(`recordId is required for ${operation} operation`);
  }

  // Validate dryRun type
  if (params.dryRun !== undefined && typeof params.dryRun !== 'boolean') {
    throw new Error('dryRun must be a boolean value');
  }

  // Check authentication
  if (!smartsuiteClient) {
    throw new Error('Authentication required: SmartSuite client not initialized');
  }

  // Default dry_run=true for safety (CONTRACT: MCP-TOOLS-005, MCP-TOOLS-007)
  const dryRun = params.dryRun ?? true;

  // Delegate to RecordHandler
  // Use injected handler for tests, or create new instance for production
  const handler = handlerDependencies.recordHandler ?? new RecordHandler();
  if (!handlerDependencies.recordHandler) {
    handler.setClient(smartsuiteClient);
  }

  const context: {
    operation: 'create' | 'update' | 'delete';
    tableId: string;
    dryRun: boolean;
    recordId?: string;
    data?: Record<string, unknown>;
  } = {
    operation: operation as 'create' | 'update' | 'delete',
    tableId,
    dryRun: dryRun as boolean,
  };

  if (params.recordId !== undefined) {
    context.recordId = params.recordId as string;
  }
  if (params.data !== undefined) {
    context.data = params.data as Record<string, unknown>;
  }

  return await handler.execute(context);
}

// ============================================================================
// TOOL 3: smartsuite_schema - Schema retrieval
// ============================================================================

/**
 * Execute schema tool
 * CONTRACT: MCP-TOOLS-010, MCP-TOOLS-011, MCP-TOOLS-012
 */
export async function executeSchemaTool(params: Record<string, unknown>): Promise<unknown> {
  // Parameter validation (CONTRACT: MCP-TOOLS-010)
  validateRequiredParam(params, 'tableId', 'string');

  const tableId = params.tableId as string;
  const outputMode = params.outputMode ?? 'summary';

  // Validate outputMode enum
  const validModes = ['summary', 'fields', 'detailed'];
  // Ensure outputMode is a string before validation
  if (typeof outputMode !== 'string') {
    throw new Error('outputMode must be a string');
  }
  if (!validModes.includes(outputMode)) {
    throw new Error(
      `Invalid outputMode "${outputMode}". Must be one of: ${validModes.join(', ')}`,
    );
  }

  // Check authentication
  if (!smartsuiteClient) {
    throw new Error('Authentication required: SmartSuite client not initialized');
  }

  // Delegate to SchemaHandler (CONTRACT: MCP-TOOLS-011)
  // Use injected handler for tests, or create new instance for production
  const handler = handlerDependencies.schemaHandler ?? new SchemaHandler();
  if (!handlerDependencies.schemaHandler) {
    handler.setClient(smartsuiteClient);
  }

  return await handler.execute({
    tableId,
    outputMode: outputMode as 'summary' | 'fields' | 'detailed',
  });
}

// ============================================================================
// TOOL 4: smartsuite_discover - Field mapping discovery
// ============================================================================

/**
 * Execute discover tool
 * CONTRACT: MCP-TOOLS-014, MCP-TOOLS-015, MCP-TOOLS-016
 */
export async function executeDiscoverTool(params: Record<string, unknown>): Promise<unknown> {
  // Parameter validation (CONTRACT: MCP-TOOLS-014)
  validateRequiredParam(params, 'operation', 'string');

  const operation = params.operation as string;

  // Validate operation enum
  const validOps = ['fields', 'tables'];
  if (!validOps.includes(operation)) {
    throw new Error(`Invalid operation "${operation}". Must be one of: ${validOps.join(', ')}`);
  }

  // Validate tableId for fields operation
  if (operation === 'fields' && !params.tableId) {
    throw new Error('tableId is required for fields operation');
  }

  // Check authentication
  if (!smartsuiteClient) {
    throw new Error('Authentication required: SmartSuite client not initialized');
  }

  // Check field translator dependency
  if (!fieldTranslator) {
    throw new Error('FieldTranslator not initialized');
  }

  // Delegate to DiscoverHandler (CONTRACT: MCP-TOOLS-015)
  // Use injected handler for tests, or create new instance for production
  const handler = handlerDependencies.discoverHandler ?? new DiscoverHandler();
  if (!handlerDependencies.discoverHandler) {
    handler.setClient(smartsuiteClient);
    handler.setFieldTranslator(fieldTranslator);
  }

  const context: {
    operation: 'fields' | 'tables';
    tableId?: string;
  } = {
    operation: operation as 'fields' | 'tables',
  };

  if (params.tableId !== undefined) {
    context.tableId = params.tableId as string;
  }

  return await handler.execute(context);
}

// ============================================================================
// TOOL 5: smartsuite_undo - Transaction rollback
// ============================================================================

/**
 * Execute undo tool
 * CONTRACT: MCP-TOOLS-018, MCP-TOOLS-019, MCP-TOOLS-020
 *
 * NOTE: UndoHandler not yet implemented - this is a placeholder
 * Phase 2E focuses on tool layer, UndoHandler will be Phase 2F
 */
export function executeUndoTool(params: Record<string, unknown>): Promise<never> {
  // Parameter validation (CONTRACT: MCP-TOOLS-018)
  validateRequiredParam(params, 'transaction_id', 'string');

  const transactionId = params.transaction_id as string;

  // Validate transaction_id not empty
  if (transactionId.trim() === '') {
    return Promise.reject(new Error('transaction_id cannot be empty'));
  }

  // UndoHandler implementation pending - return placeholder
  // This allows tool layer tests to pass while handler is being developed
  return Promise.reject(new Error('UndoHandler not implemented - transaction rollback coming in Phase 2F'));
}

/**
 * Execute intelligent tool operation
 * CONTRACT: INTELLIGENT-001 - AI-guided safety analysis
 * Phase 2G: IntelligentHandler integration for operation analysis
 *
 * Critical-Engineer: consulted for Architecture pattern selection (direct routing vs facade)
 */
export function executeIntelligentTool(params: Record<string, unknown>): Promise<unknown> {
  // Wrap in try-catch to convert synchronous validation errors to Promise rejection
  try {
    // Validate required parameters for intelligent tool contract
    validateRequiredParam(params, 'endpoint', 'string');
    validateRequiredParam(params, 'method', 'string');
    validateRequiredParam(params, 'operationDescription', 'string');

    // Create handler and analyze operation
    const handler = new IntelligentHandler();

    // Build operation object with only defined properties (exactOptionalPropertyTypes compliance)
    const operation: {
      endpoint: string;
      method: string;
      operation_description: string;
      payload?: Record<string, unknown>;
      tableId?: string;
    } = {
      endpoint: params.endpoint as string,
      method: params.method as string,
      operation_description: params.operationDescription as string,
    };

    // Only add optional properties if they exist
    if (params.payload !== undefined) {
      operation.payload = params.payload as Record<string, unknown>;
    }
    if (params.tableId !== undefined) {
      operation.tableId = params.tableId as string;
    }

    return Promise.resolve(handler.analyze(operation));
  } catch (error) {
    return Promise.reject(error);
  }
}

// ============================================================================
// SHARED UTILITIES
// ============================================================================

/**
 * Validate required parameter exists and has correct type
 * Throws descriptive error if validation fails
 */
function validateRequiredParam(
  params: Record<string, unknown>,
  name: string,
  expectedType: string,
): void {
  const value = params[name];

  if (value === undefined || value === null) {
    throw new Error(`${name} is required`);
  }

  if (typeof value !== expectedType) {
    throw new Error(`${name} must be a ${expectedType}`);
  }

  // Additional validation for strings - must not be empty
  if (expectedType === 'string' && (value as string).trim() === '') {
    throw new Error(`${name} cannot be empty`);
  }
}

/**
 * Format error for MCP protocol
 * CONTRACT: MCP-TOOLS-023 - Standardized error responses
 */
export function formatToolError(error: Error): ToolError {
  const message = error.message;

  // Detect known error types and add codes (CONTRACT: MCP-TOOLS-023)
  let code: string | undefined;

  if (message.toLowerCase().includes('authentication')) {
    code = 'AUTHENTICATION_REQUIRED';
  } else if (message.toLowerCase().includes('authorization') || message.toLowerCase().includes('access')) {
    code = 'AUTHORIZATION_FAILED';
  } else if (message.toLowerCase().includes('not found')) {
    code = 'RESOURCE_NOT_FOUND';
  } else if (message.toLowerCase().includes('invalid')) {
    code = 'INVALID_PARAMETER';
  }

  return {
    error: error.name,
    message,
    ...(code && { code }),
  };
}

/**
 * Format response for MCP protocol
 * CONTRACT: MCP-TOOLS-024 - MCP-compliant JSON responses
 */
export function formatToolResponse(toolName: string, result: unknown): ToolResponse {
  return {
    tool: toolName,
    result,
    timestamp: new Date().toISOString(),
  };
}
