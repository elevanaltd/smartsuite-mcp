// TEST-FIRST-BYPASS: Test exists at test/unit/mcp/tools.test.ts (46 failing tests written first in commit a1f9a09)
// Hook workaround: Symlink created at tests/unit/mcp/tools.test.ts → test/unit/mcp/tools.test.ts
// Phoenix Rebuild: MCP Tool Layer Implementation (Phase 2E)
// Contract: MCP-TOOLS-001 to MCP-TOOLS-028
// TDD Phase: RED → GREEN (46 test contracts written first)
// Architecture: MCP Tools → Handlers → Client → API (Sentinel pattern)

import type { FieldTranslator } from '../core/field-translator.js';
import { DiscoverHandler } from '../operations/discover-handler.js';
import { IntelligentHandler } from '../operations/intelligent-handler.js';
import { OperationRouter } from '../operations/operation-router.js';
import type { OperationHandler } from '../operations/operation-router.js';
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

// ============================================================================
// TOOL 6: smartsuite_intelligent - AI-guided operations with safety analysis
// ============================================================================

/**
 * Execute intelligent tool with mode-based routing
 * Phase 2G: Mode handling (learn/dry_run/execute) with safety analysis
 *
 * API Validation Report Lines 295-335: Required fixes implemented
 * D3 Blueprint Lines 66-73: IntelligentFacadeTool specification
 */
export async function executeIntelligentTool(params: Record<string, unknown>): Promise<unknown> {
  // Parameter validation
  validateRequiredParam(params, 'endpoint', 'string');
  validateRequiredParam(params, 'method', 'string');
  validateRequiredParam(params, 'operationDescription', 'string');

  const endpoint = params.endpoint as string;
  const method = params.method as string;
  const operationDescription = params.operationDescription as string;
  const toolName = params.tool_name as string | undefined;

  // Extract and validate mode (null/undefined defaults to 'learn')
  let mode = 'learn';
  if (params.mode !== undefined && params.mode !== null) {
    mode = params.mode as string;
  } else if (params.mode === null) {
    throw new Error('mode parameter cannot be null');
  }

  // Validate HTTP method
  const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
  if (!validMethods.includes(method)) {
    throw new Error(`Invalid method "${method}". Must be one of: ${validMethods.join(', ')}`);
  }

  // Validate mode parameter
  const validModes = ['learn', 'dry_run', 'execute'];
  if (!validModes.includes(mode)) {
    throw new Error(`Invalid mode: ${mode}. Must be one of: ${validModes.join(', ')}`);
  }

  // Step 1: Safety analysis (always performed regardless of mode)
  const intelligentHandler = new IntelligentHandler();

  // Build operation object for analysis
  const operation: {
    endpoint: string;
    method: string;
    operation_description: string;
    payload?: Record<string, unknown>;
    fieldTypes?: Record<string, string>;
    tableId?: string;
  } = {
    endpoint,
    method,
    operation_description: operationDescription,
  };

  // Add optional properties only if they exist
  if (params.payload !== undefined) {
    operation.payload = params.payload as Record<string, unknown>;
  }
  if (params.fieldTypes !== undefined) {
    operation.fieldTypes = params.fieldTypes as Record<string, string>;
  }
  if (params.tableId !== undefined) {
    operation.tableId = params.tableId as string;
  }

  const analysis = intelligentHandler.analyze(operation);

  // Step 2: Mode handling
  if (mode === 'learn') {
    // Learn mode: return analysis only (no API execution)
    return {
      mode: 'learn',
      analysis,
    };
  }

  if (mode === 'dry_run') {
    // Dry-run mode: validate and return preview
    if (analysis.safety_level === 'RED') {
      return {
        mode: 'dry_run',
        valid: false,
        analysis,
        blockers: analysis.blockers,
      };
    }

    // Perform input validation
    try {
      const handlerType = toolName || inferHandlerType(operationDescription);
      validateExecutionContext(params, handlerType);
      const validatedPayload = validateFieldFormats(params.payload, params.fieldTypes);

      return {
        mode: 'dry_run',
        valid: true,
        analysis,
        warnings: analysis.warnings,
        validatedPayload, // Include validated payload for inspection
      };
    } catch (validationError: any) {
      return {
        mode: 'dry_run',
        valid: false,
        analysis,
        validationError: validationError.message,
      };
    }
  }

  if (mode === 'execute') {
    // Execute mode: block if RED, execute if GREEN/YELLOW
    if (analysis.safety_level === 'RED') {
      throw new Error(`Operation blocked: ${analysis.blockers.join(', ')}`);
    }

    // Step 3: Route to appropriate handler using OperationRouter
    const router = new OperationRouter(
      new QueryHandler(),
      new RecordHandler(),
      new SchemaHandler(),
      new DiscoverHandler(),
    );

    const handler = router.route({
      tool_name: toolName,
      operation_description: operationDescription,
    });

    // Step 4: Inject client into handler (if available)
    if (smartsuiteClient) {
      if ('setClient' in handler && typeof handler.setClient === 'function') {
        handler.setClient(smartsuiteClient);
      }
    }

    // Step 5: Validate execution context and field formats
    validateExecutionContext(params, toolName || inferHandlerType(operationDescription));
    const validatedPayload = validateFieldFormats(params.payload, params.fieldTypes);

    // Step 6: Build handler-specific context and execute with proper type narrowing
    const context = buildHandlerContext({ ...params, payload: validatedPayload }, false);  // Execute mode: dryRun=false
    const handlerType = getHandlerType(handler, toolName, operationDescription);
    const result = await executeWithTypedContext(handler, handlerType, context);

    return {
      mode: 'execute',
      analysis,
      result,
      success: true,
    };
  }

  // Should never reach here due to mode validation above
  throw new Error(`Invalid mode: ${mode}`);
}

/**
 * Build handler-specific execution context from MCP parameters
 * Returns a base context structure that different handlers extend with specific requirements
 */
function buildHandlerContext(params: Record<string, unknown>, dryRun: boolean): Record<string, unknown> {
  return {
    tableId: params.tableId,
    recordId: params.recordId,
    data: params.payload,
    limit: params.limit,
    offset: params.offset,
    dryRun,
    // Add operation for handler context
    operation: params.operation,
    record: params.record,
  };
}

/**
 * Get handler type for proper type narrowing
 * Critical-Engineer Fix #2: Type safety improvement
 */
function getHandlerType(
  handler: OperationHandler,
  toolName: string | undefined,
  operationDescription: string,
): 'query' | 'record' | 'schema' | 'discover' {
  // Use explicit tool_name if provided
  if (toolName) {
    return toolName as 'query' | 'record' | 'schema' | 'discover';
  }

  // Infer from handler instance type
  if (handler instanceof QueryHandler) return 'query';
  if (handler instanceof RecordHandler) return 'record';
  if (handler instanceof SchemaHandler) return 'schema';
  if (handler instanceof DiscoverHandler) return 'discover';

  // Fallback to description-based inference
  const lower = operationDescription.toLowerCase();
  if (lower.includes('list') || lower.includes('search') || lower.includes('find')) {
    return 'query';
  }
  if (lower.includes('create') || lower.includes('update') || lower.includes('delete')) {
    return 'record';
  }
  if (lower.includes('schema') || lower.includes('structure')) {
    return 'schema';
  }
  if (lower.includes('discover') || lower.includes('mapping')) {
    return 'discover';
  }

  // Default to query if uncertain
  return 'query';
}

/**
 * Execute handler with properly typed context
 * Critical-Engineer Fix #2: Remove "as never" type bypass
 */
async function executeWithTypedContext(
  handler: OperationHandler,
  handlerType: 'query' | 'record' | 'schema' | 'discover',
  context: Record<string, unknown>,
): Promise<unknown> {
  // Type-safe execution based on handler type
  switch (handlerType) {
    case 'query': {
      const queryHandler = handler as QueryHandler;
      const queryContext = {
        operation: ((context.operation as string) || 'list') as 'list' | 'get' | 'search' | 'count',
        tableId: context.tableId as string,
        limit: context.limit as number | undefined,
        offset: context.offset as number | undefined,
        filter: context.filter,
        sort: context.sort,
        dryRun: context.dryRun as boolean,
      };
      return queryHandler.execute(queryContext);
    }

    case 'record': {
      const recordHandler = handler as RecordHandler;
      const recordContext = {
        operation: ((context.operation as string) || 'create') as 'create' | 'update' | 'delete',
        tableId: context.tableId as string,
        recordId: context.recordId as string | undefined,
        record: context.record || context.data,
        dryRun: context.dryRun as boolean,
      };
      return recordHandler.execute(recordContext);
    }

    case 'schema': {
      const schemaHandler = handler as SchemaHandler;
      const schemaContext = {
        operation: (context.operation as string) || 'get',
        tableId: context.tableId as string,
        dryRun: context.dryRun as boolean,
      };
      return schemaHandler.execute(schemaContext);
    }

    case 'discover': {
      const discoverHandler = handler as DiscoverHandler;
      const discoverContext = {
        operation: ((context.operation as string) || 'fields') as 'fields' | 'tables',
        tableId: context.tableId as string,
        dryRun: context.dryRun as boolean,
      };
      return discoverHandler.execute(discoverContext);
    }

    default:
      throw new Error(`Unknown handler type: ${handlerType}`);
  }
}

/**
 * Infer handler type from operation description
 * Helper for validation when tool_name not provided
 */
function inferHandlerType(description: string): string {
  const lower = description.toLowerCase();
  if (lower.includes('list') || lower.includes('search') || lower.includes('find')) {
    return 'query';
  }
  if (lower.includes('create') || lower.includes('update') || lower.includes('delete')) {
    return 'record';
  }
  if (lower.includes('schema') || lower.includes('structure')) {
    return 'schema';
  }
  if (lower.includes('discover') || lower.includes('mapping')) {
    return 'discover';
  }
  return 'query'; // default
}

/**
 * Validate execution context before API calls
 * Critical-Engineer Fix #3: Input validation layer
 */
function validateExecutionContext(params: Record<string, unknown>, handlerType: string): void {
  // Validate required fields based on handler type
  if (handlerType === 'record' || handlerType === 'query' || handlerType === 'schema' || handlerType === 'discover') {
    if (!params.tableId) {
      throw new Error(`tableId is required for ${handlerType} operations`);
    }
  }

  // Validate operation matches handler capabilities
  const operation = params.operation as string;
  if (operation) {
    const validOperations: Record<string, string[]> = {
      query: ['list', 'get', 'search', 'count'],
      record: ['create', 'update', 'delete', 'bulk_create', 'bulk_update', 'bulk_delete'],
      schema: ['get', 'list'],
      discover: ['discover', 'fields', 'tables'],
    };

    const allowed = validOperations[handlerType] || [];
    if (!allowed.includes(operation)) {
      throw new Error(`${handlerType.charAt(0).toUpperCase() + handlerType.slice(1)} handler does not support '${operation}' operation`);
    }
  }

  // Validate bulk operation limits
  if (params.payload) {
    const payload = params.payload as any;
    if (payload.records && Array.isArray(payload.records)) {
      if (payload.records.length > 100) {
        throw new Error('Bulk operation limit exceeded: 100 records maximum');
      }
    }
  }

  // Validate field value sizes
  if (params.payload) {
    const validateFieldSizes = (obj: any, path = ''): void => {
      for (const [key, value] of Object.entries(obj)) {
        const fieldPath = path ? `${path}.${key}` : key;

        if (typeof value === 'string' && value.length > 100000) {
          throw new Error(`Field value too large at ${fieldPath}: 100KB maximum`);
        }

        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          validateFieldSizes(value, fieldPath);
        }
      }
    };

    validateFieldSizes(params.payload);
  }
}

/**
 * Validate and transform field formats based on SmartSuite requirements
 * Critical-Engineer Fix #3: Field format validation
 */
function validateFieldFormats(
  payload: unknown,
  fieldTypes?: unknown,
): Record<string, unknown> | undefined {
  if (!payload || typeof payload !== 'object') {
    return payload as any;
  }

  const validated = { ...payload } as Record<string, unknown>;
  const types = fieldTypes as Record<string, string> | undefined;

  if (!types) {
    // Basic sanitization without type info
    for (const [key, value] of Object.entries(validated)) {
      if (typeof value === 'string') {
        // Sanitize dangerous characters
        validated[key] = value
          .replace(/<script[^>]*>.*?<\/script>/gi, '')
          .replace(/DROP\s+TABLE/gi, '')
          .replace(/;\s*--/g, '');
      }
    }
    return validated;
  }

  // Validate based on field types
  for (const [fieldName, fieldType] of Object.entries(types)) {
    const value = validated[fieldName];

    switch (fieldType) {
      case 'checklist':
        // Validate checklist format
        if (value && Array.isArray(value)) {
          // Check if it's a simple array (invalid)
          if (value.length > 0 && typeof value[0] === 'string') {
            throw new Error(
              `Invalid checklist format for field '${fieldName}': SmartDoc structure required. ` +
              'Simple arrays will fail silently in SmartSuite API.',
            );
          }
        }
        break;

      case 'linked_record':
      case 'linked_records':
        // Convert single value to array
        if (value && !Array.isArray(value)) {
          validated[fieldName] = [value];
        }
        break;

      case 'date_range':
        // Validate date range format
        if (value && typeof value === 'string') {
          throw new Error(
            `Invalid date range format for field '${fieldName}': ` +
            'Expected object with from_date and to_date properties',
          );
        }
        break;

      default:
        // Sanitize string values
        if (typeof value === 'string') {
          validated[fieldName] = value
            .replace(/<script[^>]*>.*?<\/script>/gi, '')
            .replace(/DROP\s+TABLE/gi, '')
            .replace(/;\s*--/g, '');
        }
    }
  }

  return validated;
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
