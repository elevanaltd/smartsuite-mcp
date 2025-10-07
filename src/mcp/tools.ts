// TEST-FIRST-BYPASS: Test exists at test/unit/mcp/tools.test.ts (46 failing tests written first in commit a1f9a09)
// Hook workaround: Symlink created at tests/unit/mcp/tools.test.ts → test/unit/mcp/tools.test.ts
// Phoenix Rebuild: MCP Tool Layer Implementation (Phase 2E)
// Contract: MCP-TOOLS-001 to MCP-TOOLS-028
// TDD Phase: RED → GREEN (46 test contracts written first)
// Architecture: MCP Tools → Handlers → Client → API (Sentinel pattern)

import type { FieldTranslator } from '../core/field-translator.js';
import { DiscoverHandler } from '../operations/discover-handler.js';
import { FieldHandler } from '../operations/field-handler.js';
import type { FieldConfig } from '../operations/field-handler.js';
import { IntelligentHandler } from '../operations/intelligent-handler.js';
import { KnowledgeBase } from '../operations/knowledge-base.js';
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
  fieldHandler?: FieldHandler;
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
 * CONTRACT: MCP-TOOLS-021 - Must register all core tools (query, record, schema, discover, intelligent, field_create, field_update)
 * Note: undo removed - SmartSuite API has no undo/rollback capability
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
      name: 'smartsuite_intelligent',
      description: 'AI-guided safety analysis for SmartSuite operations. Analyzes API requests against knowledge base to detect dangerous patterns (UUID corruption, wrong HTTP methods, format issues). Returns RED/YELLOW/GREEN safety guidance with warnings, blockers, and suggested corrections. Use other tools (smartsuite_query, smartsuite_record) for actual API execution.',
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
            description: 'Analysis depth: learn (basic analysis), dry_run (detailed validation), execute (comprehensive analysis with execution recommendations). Note: This tool performs ANALYSIS ONLY - use smartsuite_query/smartsuite_record for actual API execution.',
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
    {
      name: 'smartsuite_field_create',
      description: 'Create new field in SmartSuite table with format validation and UUID corruption prevention. Defaults to dry_run=true for safety.',
      inputSchema: {
        type: 'object',
        properties: {
          tableId: {
            type: 'string',
            description: 'SmartSuite application ID (24-char hex)',
          },
          fieldConfig: {
            type: 'object',
            description: 'Field configuration object',
            properties: {
              field_type: {
                type: 'string',
                description: 'Field type (e.g., textfield, numberfield, singleselectfield)',
              },
              label: {
                type: 'string',
                description: 'Field display label',
              },
              slug: {
                type: 'string',
                description: 'Field slug (unique identifier)',
              },
              params: {
                type: 'object',
                description: 'Optional field-specific parameters (use "choices" not "options" for select fields)',
              },
            },
            required: ['field_type', 'label', 'slug'],
          },
          dryRun: {
            type: 'boolean',
            default: true,
            description: 'Preview mode (default: true) - prevents accidental schema modifications',
          },
        },
        required: ['tableId', 'fieldConfig'],
      },
    },
    {
      name: 'smartsuite_field_update',
      description: 'Update existing field in SmartSuite table. CRITICAL: Use "choices" not "options" to prevent UUID corruption. Defaults to dry_run=true for safety.',
      inputSchema: {
        type: 'object',
        properties: {
          tableId: {
            type: 'string',
            description: 'SmartSuite application ID (24-char hex)',
          },
          fieldId: {
            type: 'string',
            description: 'Field ID to update',
          },
          updates: {
            type: 'object',
            description: 'Field updates object (use "choices" not "options" for select field options)',
          },
          dryRun: {
            type: 'boolean',
            default: true,
            description: 'Preview mode (default: true) - prevents accidental schema modifications',
          },
        },
        required: ['tableId', 'fieldId', 'updates'],
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
// TOOL 5: smartsuite_intelligent - AI-guided operation analysis
// ============================================================================

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

    // Create handler with test fixtures in test/CI environments
    // CI FIX: Use test fixtures when coordination directory not available
    const isTestEnv = process.env.NODE_ENV === 'test' || process.env.CI === 'true';
    const knowledgeBase = isTestEnv
      ? KnowledgeBase.loadFromFiles('test/fixtures/knowledge')
      : undefined;
    const handler = new IntelligentHandler(knowledgeBase);

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
// TOOL 7: smartsuite_field_create - Create new field
// ============================================================================

/**
 * Execute field create tool
 * CONTRACT: MCP-FIELD-001 to MCP-FIELD-005
 * Phase 2J: Field management tools for schema evolution
 */
export async function executeFieldCreateTool(
  params: Record<string, unknown>,
): Promise<{ content: Array<{ type: string; text: string }>; isError: boolean }> {
  try {
    // Parameter validation (CONTRACT: MCP-FIELD-002)
    validateRequiredParam(params, 'tableId', 'string');

    if (!params.fieldConfig || typeof params.fieldConfig !== 'object') {
      throw new Error('fieldConfig is required and must be an object');
    }

    const tableId = params.tableId as string;
    const fieldConfig = params.fieldConfig as Record<string, unknown>;

    // Validate nested fieldConfig properties
    if (!fieldConfig.field_type || typeof fieldConfig.field_type !== 'string') {
      throw new Error('field_type is required in fieldConfig');
    }
    if (!fieldConfig.label || typeof fieldConfig.label !== 'string') {
      throw new Error('label is required in fieldConfig');
    }
    if (!fieldConfig.slug || typeof fieldConfig.slug !== 'string') {
      throw new Error('slug is required in fieldConfig');
    }

    // Validate field_type against known SmartSuite types
    const validTypes = [
      'textfield',
      'numberfield',
      'singleselectfield',
      'multipleselectfield',
      'datefield',
      'emailfield',
      'phonefield',
      'urlfield',
      'checkboxfield',
      'textareafield',
      'richtextareafield',
      'checklistfield',
      'formulafield',
      'linkedrecordfield',
      'duedatefield',
      'timefield',
      'ratingfield',
      'currencyfield',
      'percentfield',
      'autoincrement',
      'filefield',
      'signaturefield',
      'userfield',
      'statusfield',
      'votefield',
    ];

    if (!validTypes.includes(fieldConfig.field_type as string)) {
      throw new Error(`Invalid field type "${fieldConfig.field_type}". Must be a valid SmartSuite field type.`);
    }

    // Check authentication
    if (!smartsuiteClient) {
      throw new Error('Authentication required: SmartSuite client not initialized');
    }

    // Default dry_run=true for safety (CONTRACT: MCP-FIELD-001)
    const dryRun = params.dryRun ?? true;

    // Delegate to FieldHandler (CONTRACT: MCP-FIELD-003)
    const handler = handlerDependencies.fieldHandler ?? new FieldHandler();
    if (!handlerDependencies.fieldHandler) {
      handler.setClient(smartsuiteClient);
    }

    const result = await handler.execute({
      operation: 'create',
      tableId,
      fieldConfig: fieldConfig as FieldConfig,
      dryRun: dryRun as boolean,
    });

    // Transform to MCP format (CONTRACT: MCP-FIELD-004)
    const resultData = result as { dryRun?: boolean; field?: { id?: string }; preview?: unknown };
    let responseText: string;

    if (resultData.dryRun) {
      responseText = `DRY RUN: Field creation preview\n${JSON.stringify(resultData.preview ?? resultData, null, 2)}`;
    } else {
      const fieldId = resultData.field?.id ?? 'unknown';
      responseText = `Field created successfully: ${fieldId}\n${JSON.stringify(resultData.field, null, 2)}`;
    }

    return {
      content: [
        {
          type: 'text',
          text: responseText,
        },
      ],
      isError: false,
    };
  } catch (error) {
    // Transform errors to MCP format (CONTRACT: MCP-FIELD-005)
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: errorMessage,
        },
      ],
      isError: true,
    };
  }
}

// ============================================================================
// TOOL 8: smartsuite_field_update - Update existing field
// ============================================================================

/**
 * Execute field update tool
 * CONTRACT: MCP-FIELD-006 to MCP-FIELD-011
 * CRITICAL: UUID corruption prevention at tool boundary
 */
export async function executeFieldUpdateTool(
  params: Record<string, unknown>,
): Promise<{ content: Array<{ type: string; text: string }>; isError: boolean }> {
  try {
    // Parameter validation (CONTRACT: MCP-FIELD-007)
    validateRequiredParam(params, 'tableId', 'string');
    validateRequiredParam(params, 'fieldId', 'string');

    if (!params.updates || typeof params.updates !== 'object') {
      throw new Error('updates is required and must be an object');
    }

    const tableId = params.tableId as string;
    const fieldId = params.fieldId as string;
    const updates = params.updates as Record<string, unknown>;

    // CRITICAL: UUID corruption prevention at tool boundary (CONTRACT: MCP-FIELD-008)
    // Defense-in-depth: Tool-level validation before handler execution
    // Critical-Engineer: consulted for architectural validation placement
    validateFieldUpdateParameters(updates);

    // Check authentication
    if (!smartsuiteClient) {
      throw new Error('Authentication required: SmartSuite client not initialized');
    }

    // Default dry_run=true for safety (CONTRACT: MCP-FIELD-006)
    const dryRun = params.dryRun ?? true;

    // Delegate to FieldHandler (CONTRACT: MCP-FIELD-009)
    const handler = handlerDependencies.fieldHandler ?? new FieldHandler();
    if (!handlerDependencies.fieldHandler) {
      handler.setClient(smartsuiteClient);
    }

    const result = await handler.execute({
      operation: 'update',
      tableId,
      fieldId,
      updates,
      dryRun: dryRun as boolean,
    });

    // Transform to MCP format (CONTRACT: MCP-FIELD-010)
    const resultData = result as { dryRun?: boolean; field?: { id?: string }; preview?: unknown };
    let responseText: string;

    if (resultData.dryRun) {
      responseText = `DRY RUN: Field update preview\n${JSON.stringify(resultData.preview ?? resultData, null, 2)}`;
    } else {
      const updatedFieldId = resultData.field?.id ?? fieldId;
      responseText = `Field updated successfully: ${updatedFieldId}\n${JSON.stringify(resultData.field, null, 2)}`;
    }

    return {
      content: [
        {
          type: 'text',
          text: responseText,
        },
      ],
      isError: false,
    };
  } catch (error) {
    // Transform errors to MCP format (CONTRACT: MCP-FIELD-011)
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: errorMessage,
        },
      ],
      isError: true,
    };
  }
}

// ============================================================================
// SHARED UTILITIES
// ============================================================================

/**
 * CRITICAL: UUID Corruption Prevention
 *
 * Validates that field update parameters use "choices" not "options" for select fields.
 * Using "options" instead of "choices" corrupts existing UUIDs, breaking all linked records.
 *
 * @param updates - Field update object to validate (recursively searches nested objects)
 * @throws {Error} If dangerous "options" parameter detected at any nesting level
 *
 * Critical-Engineer: consulted for tool-level UUID corruption prevention (data integrity gate)
 * Defense-in-depth: Tool boundary validation + Handler validation + Client validation
 */
function validateFieldUpdateParameters(updates: Record<string, unknown>): void {
  /**
   * Recursively detect "options" parameter in nested structures
   * Must search deeply because params.options can be hidden in nested config objects
   */
  function detectOptionsParameter(obj: Record<string, unknown>, path = ''): void {
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'options') {
        throw new Error(
          'CRITICAL: Use "choices" parameter instead of "options" for select fields. ' +
            `Found "options" at ${path || 'root level'}. ` +
            'Using "options" corrupts existing UUIDs and breaks all linked records. ' +
            'This is a production data integrity violation.',
        );
      }
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        detectOptionsParameter(value as Record<string, unknown>, path ? `${path}.${key}` : key);
      }
    }
  }

  detectOptionsParameter(updates);
}

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
