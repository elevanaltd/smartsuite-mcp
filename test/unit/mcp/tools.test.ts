// Phoenix Test Contract: MCP-TOOLS-001 to MCP-TOOLS-028
// Contract: MCP tool wrapper layer - Sentinel pattern facade over handlers
// Status: RED (tests written, implementation pending)
// Phase: 2E - MCP Tool Layer (follows 2D handler completion)
// Architecture: MCP Tools → Handlers → Client → API
// TDD Phase: RED → Implementation will follow

import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * MCP Tool Test Contracts
 *
 * Purpose: Validate MCP protocol integration layer
 * Coverage Target: 90% (universal-test-engineer standard)
 *
 * Tool Responsibilities:
 * 1. Expose MCP-compliant tool schemas
 * 2. Validate MCP protocol parameters
 * 3. Delegate to appropriate handlers
 * 4. Transform handler responses to MCP format
 * 5. Propagate errors with MCP error codes
 *
 * Test Organization:
 * - 28 test contracts across 5 tools
 * - Each tool: schema validation, delegation, error handling
 * - Focus on MCP protocol compliance, NOT business logic
 */

describe('MCP Tool Layer', () => {

  // ============================================================================
  // TOOL 1: smartsuite_query - Query operations (list, get, search, count)
  // ============================================================================

  describe('smartsuite_query tool', () => {
    // Set up mock client for all delegation tests
    beforeEach(async () => {
      const { setToolsClient } = await import('../../../src/mcp/tools.js');

      // Create minimal mock client for testing
      const mockClient = {
        apiKey: 'test-key',
        workspaceId: 'test-workspace',
        listRecords: vi.fn(),
        getRecord: vi.fn(),
        createRecord: vi.fn(),
        updateRecord: vi.fn(),
        deleteRecord: vi.fn(),
        getSchema: vi.fn(),
        countRecords: vi.fn(),
        request: vi.fn(),
      };

      setToolsClient(mockClient as any);
    });

    describe('MCP-TOOLS-001: Schema validation', () => {
      it('should define MCP-compliant tool schema', async () => {
        // CONTRACT: Tool schema must match MCP SDK expectations
        // Required: name, description, inputSchema with type/properties/required

        const { getToolSchemas } = await import('../../../src/mcp/tools.js');
        const schemas = getToolSchemas();

        const queryTool = schemas.find((t) => t.name === 'smartsuite_query');
        expect(queryTool).toBeDefined();
        expect(queryTool?.description).toBeTruthy();

        // Validate schema structure
        expect(queryTool?.inputSchema).toMatchObject({
          type: 'object',
          properties: expect.any(Object),
          required: expect.arrayContaining(['operation', 'tableId']),
        });

        // Validate operation enum
        const opProp = queryTool?.inputSchema.properties.operation as any;
        expect(opProp.enum).toEqual(['list', 'get', 'search', 'count']);
      });
    });

    describe('MCP-TOOLS-002: Parameter validation', () => {
      it('should require tableId parameter', async () => {
        // CONTRACT: Required parameters must be validated before handler delegation

        const { executeQueryTool } = await import('../../../src/mcp/tools.js');

        await expect(
          executeQueryTool({
            operation: 'list',
            // Missing tableId
          }),
        ).rejects.toThrow(/tableId.*required/i);
      });

      it('should validate operation enum values', async () => {
        // CONTRACT: Operation must be one of: list, get, search, count

        const { executeQueryTool } = await import('../../../src/mcp/tools.js');

        await expect(
          executeQueryTool({
            operation: 'invalid_operation' as any,
            tableId: '68a8ff5237fde0bf797c05b3',
          }),
        ).rejects.toThrow(/invalid.*operation/i);
      });

      it('should enforce recordId for get operation', async () => {
        // CONTRACT: Get operation requires recordId parameter

        const { executeQueryTool } = await import('../../../src/mcp/tools.js');

        await expect(
          executeQueryTool({
            operation: 'get',
            tableId: '68a8ff5237fde0bf797c05b3',
            // Missing recordId
          }),
        ).rejects.toThrow(/recordId.*required.*get/i);
      });

      it('should validate limit range (1-1000)', async () => {
        // CONTRACT: Limit must be positive integer, max 1000

        const { executeQueryTool } = await import('../../../src/mcp/tools.js');

        await expect(
          executeQueryTool({
            operation: 'list',
            tableId: '68a8ff5237fde0bf797c05b3',
            limit: 0, // Invalid: zero
          }),
        ).rejects.toThrow(/limit.*positive/i);

        await expect(
          executeQueryTool({
            operation: 'list',
            tableId: '68a8ff5237fde0bf797c05b3',
            limit: 1001, // Invalid: exceeds max
          }),
        ).rejects.toThrow(/limit.*1000/i);
      });
    });

    describe('MCP-TOOLS-003: Handler delegation', () => {
      it('should delegate list operation to QueryHandler', async () => {
        // CONTRACT: Tool must invoke QueryHandler.execute() with correct context

        const mockQueryHandler = {
          execute: vi.fn().mockResolvedValue({
            operation: 'list',
            tableId: '68a8ff5237fde0bf797c05b3',
            records: [{ id: '1', title: 'Test' }],
            limit: 5,
          }),
          setClient: vi.fn(),
        };

        // Mock handler injection (actual implementation will use DI)
        vi.mock('../../../src/operations/query-handler.js', () => ({
          QueryHandler: vi.fn(() => mockQueryHandler),
        }));

        const { executeQueryTool } = await import('../../../src/mcp/tools.js');

        const result = await executeQueryTool({
          operation: 'list',
          tableId: '68a8ff5237fde0bf797c05b3',
          limit: 5,
        });

        // Verify handler was called with correct context
        expect(mockQueryHandler.execute).toHaveBeenCalledWith({
          operation: 'list',
          tableId: '68a8ff5237fde0bf797c05b3',
          limit: 5,
        });

        // Verify result structure
        expect(result).toMatchObject({
          operation: 'list',
          records: expect.any(Array),
        });
      });

      it('should delegate get operation with recordId', async () => {
        // CONTRACT: Get operation passes recordId to handler

        const mockQueryHandler = {
          execute: vi.fn().mockResolvedValue({
            operation: 'get',
            tableId: '68a8ff5237fde0bf797c05b3',
            record: { id: 'rec123', title: 'Test Record' },
          }),
          setClient: vi.fn(),
        };

        vi.mock('../../../src/operations/query-handler.js', () => ({
          QueryHandler: vi.fn(() => mockQueryHandler),
        }));

        const { executeQueryTool } = await import('../../../src/mcp/tools.js');

        await executeQueryTool({
          operation: 'get',
          tableId: '68a8ff5237fde0bf797c05b3',
          recordId: 'rec123',
        });

        expect(mockQueryHandler.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            operation: 'get',
            recordId: 'rec123',
          }),
        );
      });
    });

    describe('MCP-TOOLS-004: Error handling', () => {
      it('should propagate handler errors with MCP error format', async () => {
        // CONTRACT: Handler errors must be transformed to MCP protocol errors

        const mockQueryHandler = {
          execute: vi.fn().mockRejectedValue(new Error('Table not found')),
          setClient: vi.fn(),
        };

        vi.mock('../../../src/operations/query-handler.js', () => ({
          QueryHandler: vi.fn(() => mockQueryHandler),
        }));

        const { executeQueryTool } = await import('../../../src/mcp/tools.js');

        await expect(
          executeQueryTool({
            operation: 'list',
            tableId: 'invalid_id',
          }),
        ).rejects.toThrow(/Table not found/);
      });
    });
  });

  // ============================================================================
  // TOOL 2: smartsuite_record - Record mutations (create, update, delete)
  // ============================================================================

  describe('smartsuite_record tool', () => {
    // Set up mock client for all delegation tests
    beforeEach(async () => {
      const { setToolsClient } = await import('../../../src/mcp/tools.js');

      const mockClient = {
        apiKey: 'test-key',
        workspaceId: 'test-workspace',
        listRecords: vi.fn(),
        getRecord: vi.fn(),
        createRecord: vi.fn(),
        updateRecord: vi.fn(),
        deleteRecord: vi.fn(),
        getSchema: vi.fn(),
        countRecords: vi.fn(),
        request: vi.fn(),
      };

      setToolsClient(mockClient as any);
    });

    describe('MCP-TOOLS-005: Schema validation', () => {
      it('should define MCP-compliant tool schema with dry_run default', async () => {
        // CONTRACT: Record tool MUST default dry_run=true for safety

        const { getToolSchemas } = await import('../../../src/mcp/tools.js');
        const schemas = getToolSchemas();

        const recordTool = schemas.find((t) => t.name === 'smartsuite_record');
        expect(recordTool).toBeDefined();

        // Validate dry_run safety default
        const dryRunProp = recordTool?.inputSchema.properties.dryRun as any;
        expect(dryRunProp.default).toBe(true);

        // Validate operation enum
        const opProp = recordTool?.inputSchema.properties.operation as any;
        expect(opProp.enum).toEqual(['create', 'update', 'delete']);
      });
    });

    describe('MCP-TOOLS-006: Parameter validation', () => {
      it('should require tableId and operation', async () => {
        // CONTRACT: tableId and operation are mandatory parameters

        const { executeRecordTool } = await import('../../../src/mcp/tools.js');

        await expect(
          executeRecordTool({
            operation: 'create',
            // Missing tableId
            data: { title: 'Test' },
          }),
        ).rejects.toThrow(/tableId.*required/i);
      });

      it('should require data for create/update operations', async () => {
        // CONTRACT: Create and update require data parameter

        const { executeRecordTool } = await import('../../../src/mcp/tools.js');

        await expect(
          executeRecordTool({
            operation: 'create',
            tableId: '68a8ff5237fde0bf797c05b3',
            // Missing data
          }),
        ).rejects.toThrow(/data.*required.*create/i);

        await expect(
          executeRecordTool({
            operation: 'update',
            tableId: '68a8ff5237fde0bf797c05b3',
            recordId: 'rec123',
            // Missing data
          }),
        ).rejects.toThrow(/data.*required.*update/i);
      });

      it('should require recordId for update/delete operations', async () => {
        // CONTRACT: Update and delete require recordId parameter

        const { executeRecordTool } = await import('../../../src/mcp/tools.js');

        await expect(
          executeRecordTool({
            operation: 'update',
            tableId: '68a8ff5237fde0bf797c05b3',
            data: { title: 'Updated' },
            // Missing recordId
          }),
        ).rejects.toThrow(/recordId.*required.*update/i);

        await expect(
          executeRecordTool({
            operation: 'delete',
            tableId: '68a8ff5237fde0bf797c05b3',
            // Missing recordId
          }),
        ).rejects.toThrow(/recordId.*required.*delete/i);
      });

      it('should validate dryRun is boolean', async () => {
        // CONTRACT: dryRun must be boolean type

        const { executeRecordTool } = await import('../../../src/mcp/tools.js');

        await expect(
          executeRecordTool({
            operation: 'create',
            tableId: '68a8ff5237fde0bf797c05b3',
            data: { title: 'Test' },
            dryRun: 'yes' as any, // Invalid: string
          }),
        ).rejects.toThrow(/dryRun.*boolean/i);
      });
    });

    describe('MCP-TOOLS-007: Handler delegation', () => {
      it('should delegate create operation with dry_run=true by default', async () => {
        // CONTRACT: Default dry_run=true prevents accidental mutations

        const mockRecordHandler = {
          execute: vi.fn().mockResolvedValue({
            dryRun: true,
            operation: 'create',
            validated: true,
            preview: { title: 'Test' },
          }),
          setClient: vi.fn(),
        };

        vi.mock('../../../src/operations/record-handler.js', () => ({
          RecordHandler: vi.fn(() => mockRecordHandler),
        }));

        const { executeRecordTool } = await import('../../../src/mcp/tools.js');

        const result = await executeRecordTool({
          operation: 'create',
          tableId: '68a8ff5237fde0bf797c05b3',
          data: { title: 'Test' },
          // dryRun not specified - should default to true
        });

        // Verify handler was called with dry_run=true
        expect(mockRecordHandler.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            dryRun: true,
          }),
        );

        // Verify dry-run result
        expect(result).toMatchObject({
          dryRun: true,
          validated: true,
        });
      });

      it('should delegate update operation with explicit dry_run=false', async () => {
        // CONTRACT: Explicit dry_run=false executes actual mutation

        const mockRecordHandler = {
          execute: vi.fn().mockResolvedValue({
            id: 'rec123',
            title: 'Updated',
          }),
          setClient: vi.fn(),
        };

        vi.mock('../../../src/operations/record-handler.js', () => ({
          RecordHandler: vi.fn(() => mockRecordHandler),
        }));

        const { executeRecordTool } = await import('../../../src/mcp/tools.js');

        await executeRecordTool({
          operation: 'update',
          tableId: '68a8ff5237fde0bf797c05b3',
          recordId: 'rec123',
          data: { title: 'Updated' },
          dryRun: false, // Explicit execution
        });

        expect(mockRecordHandler.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            dryRun: false,
          }),
        );
      });

      it('should delegate delete operation', async () => {
        // CONTRACT: Delete operation passes recordId to handler

        const mockRecordHandler = {
          execute: vi.fn().mockResolvedValue({
            dryRun: true,
            operation: 'delete',
            validated: true,
            message: 'Would delete record rec123',
          }),
          setClient: vi.fn(),
        };

        vi.mock('../../../src/operations/record-handler.js', () => ({
          RecordHandler: vi.fn(() => mockRecordHandler),
        }));

        const { executeRecordTool } = await import('../../../src/mcp/tools.js');

        await executeRecordTool({
          operation: 'delete',
          tableId: '68a8ff5237fde0bf797c05b3',
          recordId: 'rec123',
        });

        expect(mockRecordHandler.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            operation: 'delete',
            recordId: 'rec123',
          }),
        );
      });
    });

    describe('MCP-TOOLS-008: Error handling', () => {
      it('should propagate validation errors from handler', async () => {
        // CONTRACT: Handler validation errors must reach MCP client

        const mockRecordHandler = {
          execute: vi.fn().mockRejectedValue(new Error('Invalid field format: checklist must use SmartDoc structure')),
          setClient: vi.fn(),
        };

        vi.mock('../../../src/operations/record-handler.js', () => ({
          RecordHandler: vi.fn(() => mockRecordHandler),
        }));

        const { executeRecordTool } = await import('../../../src/mcp/tools.js');

        await expect(
          executeRecordTool({
            operation: 'create',
            tableId: '68a8ff5237fde0bf797c05b3',
            data: { checklist: ['item1', 'item2'] }, // Invalid format
          }),
        ).rejects.toThrow(/Invalid field format/);
      });
    });
  });

  // ============================================================================
  // TOOL 3: smartsuite_schema - Schema retrieval with output modes
  // ============================================================================

  describe('smartsuite_schema tool', () => {
    // Set up mock client for all delegation tests
    beforeEach(async () => {
      const { setToolsClient } = await import('../../../src/mcp/tools.js');

      const mockClient = {
        apiKey: 'test-key',
        workspaceId: 'test-workspace',
        listRecords: vi.fn(),
        getRecord: vi.fn(),
        createRecord: vi.fn(),
        updateRecord: vi.fn(),
        deleteRecord: vi.fn(),
        getSchema: vi.fn(),
        countRecords: vi.fn(),
        request: vi.fn(),
      };

      setToolsClient(mockClient as any);
    });

    describe('MCP-TOOLS-009: Schema validation', () => {
      it('should define MCP-compliant tool schema with output modes', async () => {
        // CONTRACT: Schema tool supports summary/fields/detailed output modes

        const { getToolSchemas } = await import('../../../src/mcp/tools.js');
        const schemas = getToolSchemas();

        const schemaTool = schemas.find((t) => t.name === 'smartsuite_schema');
        expect(schemaTool).toBeDefined();

        // Validate outputMode enum
        const modeProp = schemaTool?.inputSchema.properties.outputMode as any;
        expect(modeProp.enum).toEqual(['summary', 'fields', 'detailed']);
        expect(modeProp.default).toBe('summary');
      });
    });

    describe('MCP-TOOLS-010: Parameter validation', () => {
      it('should require tableId parameter', async () => {
        // CONTRACT: tableId is required for schema retrieval

        const { executeSchemaTool } = await import('../../../src/mcp/tools.js');

        await expect(
          executeSchemaTool({
            // Missing tableId
            outputMode: 'summary',
          }),
        ).rejects.toThrow(/tableId.*required/i);
      });

      it('should validate outputMode enum values', async () => {
        // CONTRACT: outputMode must be summary, fields, or detailed

        const { executeSchemaTool } = await import('../../../src/mcp/tools.js');

        await expect(
          executeSchemaTool({
            tableId: '68a8ff5237fde0bf797c05b3',
            outputMode: 'invalid_mode' as any,
          }),
        ).rejects.toThrow(/outputMode.*summary|fields|detailed/i);
      });
    });

    describe('MCP-TOOLS-011: Handler delegation', () => {
      it('should delegate to SchemaHandler with summary mode', async () => {
        // CONTRACT: Default summary mode returns table info only

        const mockSchemaHandler = {
          execute: vi.fn().mockResolvedValue({
            id: '68a8ff5237fde0bf797c05b3',
            name: 'Projects',
            fieldCount: 25,
          }),
          setClient: vi.fn(),
        };

        vi.mock('../../../src/operations/schema-handler.js', () => ({
          SchemaHandler: vi.fn(() => mockSchemaHandler),
        }));

        const { executeSchemaTool } = await import('../../../src/mcp/tools.js');

        const result = await executeSchemaTool({
          tableId: '68a8ff5237fde0bf797c05b3',
          // outputMode defaults to 'summary'
        });

        expect(mockSchemaHandler.execute).toHaveBeenCalledWith({
          tableId: '68a8ff5237fde0bf797c05b3',
          outputMode: 'summary',
        });

        expect(result).toMatchObject({
          id: expect.any(String),
          name: expect.any(String),
        });
      });

      it('should delegate with fields mode for field listing', async () => {
        // CONTRACT: Fields mode returns field names and types

        const mockSchemaHandler = {
          execute: vi.fn().mockResolvedValue({
            tableId: '68a8ff5237fde0bf797c05b3',
            fields: [
              { slug: 'title', label: 'Title', field_type: 'textfield' },
              { slug: 'status', label: 'Status', field_type: 'statusfield' },
            ],
          }),
          setClient: vi.fn(),
        };

        vi.mock('../../../src/operations/schema-handler.js', () => ({
          SchemaHandler: vi.fn(() => mockSchemaHandler),
        }));

        const { executeSchemaTool } = await import('../../../src/mcp/tools.js');

        await executeSchemaTool({
          tableId: '68a8ff5237fde0bf797c05b3',
          outputMode: 'fields',
        });

        expect(mockSchemaHandler.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            outputMode: 'fields',
          }),
        );
      });

      it('should delegate with detailed mode for full schema', async () => {
        // CONTRACT: Detailed mode returns complete schema with metadata

        const mockSchemaHandler = {
          execute: vi.fn().mockResolvedValue({
            id: '68a8ff5237fde0bf797c05b3',
            name: 'Projects',
            structure: [
              {
                slug: 'title',
                label: 'Title',
                field_type: 'textfield',
                params: { required: true },
              },
            ],
          }),
          setClient: vi.fn(),
        };

        vi.mock('../../../src/operations/schema-handler.js', () => ({
          SchemaHandler: vi.fn(() => mockSchemaHandler),
        }));

        const { executeSchemaTool } = await import('../../../src/mcp/tools.js');

        await executeSchemaTool({
          tableId: '68a8ff5237fde0bf797c05b3',
          outputMode: 'detailed',
        });

        expect(mockSchemaHandler.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            outputMode: 'detailed',
          }),
        );
      });
    });

    describe('MCP-TOOLS-012: Error handling', () => {
      it('should propagate schema retrieval errors', async () => {
        // CONTRACT: Handler errors must be propagated to MCP client

        const mockSchemaHandler = {
          execute: vi.fn().mockRejectedValue(new Error('Table not found: invalid_id')),
          setClient: vi.fn(),
        };

        vi.mock('../../../src/operations/schema-handler.js', () => ({
          SchemaHandler: vi.fn(() => mockSchemaHandler),
        }));

        const { executeSchemaTool } = await import('../../../src/mcp/tools.js');

        await expect(
          executeSchemaTool({
            tableId: 'invalid_id',
          }),
        ).rejects.toThrow(/Table not found/);
      });
    });
  });

  // ============================================================================
  // TOOL 4: smartsuite_discover - Field mapping discovery
  // ============================================================================

  describe('smartsuite_discover tool', () => {
    // Set up mock client and field translator for all delegation tests
    beforeEach(async () => {
      const { setToolsClient, setFieldTranslator } = await import('../../../src/mcp/tools.js');

      const mockClient = {
        apiKey: 'test-key',
        workspaceId: 'test-workspace',
        listRecords: vi.fn(),
        getRecord: vi.fn(),
        createRecord: vi.fn(),
        updateRecord: vi.fn(),
        deleteRecord: vi.fn(),
        getSchema: vi.fn(),
        countRecords: vi.fn(),
        request: vi.fn(),
      };

      const mockTranslator = {
        translateDisplayToStorage: vi.fn(),
        translateStorageToDisplay: vi.fn(),
        getFieldMetadata: vi.fn(),
        getAllFieldsForTable: vi.fn(),
      };

      setToolsClient(mockClient as any);
      setFieldTranslator(mockTranslator as any);
    });

    describe('MCP-TOOLS-013: Schema validation', () => {
      it('should define MCP-compliant tool schema with operation modes', async () => {
        // CONTRACT: Discover tool supports fields/tables operations

        const { getToolSchemas } = await import('../../../src/mcp/tools.js');
        const schemas = getToolSchemas();

        const discoverTool = schemas.find((t) => t.name === 'smartsuite_discover');
        expect(discoverTool).toBeDefined();

        // Validate operation enum
        const opProp = discoverTool?.inputSchema.properties.operation as any;
        expect(opProp.enum).toEqual(['fields', 'tables']);
      });
    });

    describe('MCP-TOOLS-014: Parameter validation', () => {
      it('should require operation parameter', async () => {
        // CONTRACT: operation is mandatory (fields or tables)

        const { executeDiscoverTool } = await import('../../../src/mcp/tools.js');

        await expect(
          executeDiscoverTool({
            // Missing operation
            tableId: '68a8ff5237fde0bf797c05b3',
          }),
        ).rejects.toThrow(/operation.*required/i);
      });

      it('should require tableId for fields operation', async () => {
        // CONTRACT: Fields discovery requires tableId parameter

        const { executeDiscoverTool } = await import('../../../src/mcp/tools.js');

        await expect(
          executeDiscoverTool({
            operation: 'fields',
            // Missing tableId
          }),
        ).rejects.toThrow(/tableId.*required.*fields/i);
      });

      it('should validate operation enum values', async () => {
        // CONTRACT: operation must be fields or tables

        const { executeDiscoverTool } = await import('../../../src/mcp/tools.js');

        await expect(
          executeDiscoverTool({
            operation: 'invalid_op' as any,
          }),
        ).rejects.toThrow(/operation.*fields|tables/i);
      });
    });

    describe('MCP-TOOLS-015: Handler delegation', () => {
      it('should delegate fields discovery to DiscoverHandler', async () => {
        // CONTRACT: Fields operation returns field metadata for table

        const mockDiscoverHandler = {
          execute: vi.fn().mockResolvedValue({
            tableId: '68a8ff5237fde0bf797c05b3',
            tableName: 'Projects',
            fields: [
              { slug: 'title', label: 'Title', field_type: 'textfield' },
              { slug: 'status', label: 'Status', field_type: 'statusfield' },
            ],
            fieldCount: 2,
          }),
          setClient: vi.fn(),
          setFieldTranslator: vi.fn(),
        };

        vi.mock('../../../src/operations/discover-handler.js', () => ({
          DiscoverHandler: vi.fn(() => mockDiscoverHandler),
        }));

        const { executeDiscoverTool } = await import('../../../src/mcp/tools.js');

        const result = await executeDiscoverTool({
          operation: 'fields',
          tableId: '68a8ff5237fde0bf797c05b3',
        });

        expect(mockDiscoverHandler.execute).toHaveBeenCalledWith({
          operation: 'fields',
          tableId: '68a8ff5237fde0bf797c05b3',
        });

        expect(result).toMatchObject({
          fields: expect.any(Array),
          fieldCount: expect.any(Number),
        });
      });

      it('should delegate tables discovery to DiscoverHandler', async () => {
        // CONTRACT: Tables operation returns all available tables

        const mockDiscoverHandler = {
          execute: vi.fn().mockResolvedValue({
            tables: [
              { id: '68a8ff5237fde0bf797c05b3', name: 'Projects' },
              { id: '68ab34b30b1e05e11a8ba87f', name: 'Tasks' },
            ],
            tableCount: 2,
          }),
          setClient: vi.fn(),
          setFieldTranslator: vi.fn(),
        };

        vi.mock('../../../src/operations/discover-handler.js', () => ({
          DiscoverHandler: vi.fn(() => mockDiscoverHandler),
        }));

        const { executeDiscoverTool } = await import('../../../src/mcp/tools.js');

        const result = await executeDiscoverTool({
          operation: 'tables',
        });

        expect(mockDiscoverHandler.execute).toHaveBeenCalledWith({
          operation: 'tables',
        });

        expect(result).toMatchObject({
          tables: expect.any(Array),
        });
      });
    });

    describe('MCP-TOOLS-016: Error handling', () => {
      it('should propagate discovery errors', async () => {
        // CONTRACT: Handler errors must be propagated to MCP client

        const mockDiscoverHandler = {
          execute: vi.fn().mockRejectedValue(new Error('Table not found in field mappings')),
          setClient: vi.fn(),
          setFieldTranslator: vi.fn(),
        };

        vi.mock('../../../src/operations/discover-handler.js', () => ({
          DiscoverHandler: vi.fn(() => mockDiscoverHandler),
        }));

        const { executeDiscoverTool } = await import('../../../src/mcp/tools.js');

        await expect(
          executeDiscoverTool({
            operation: 'fields',
            tableId: 'nonexistent_table',
          }),
        ).rejects.toThrow(/Table not found/);
      });
    });
  });

  // ============================================================================
  // TOOL 5: smartsuite_undo - Transaction history rollback
  // ============================================================================

  describe('smartsuite_undo tool', () => {
    // Set up mock client for all delegation tests
    beforeEach(async () => {
      const { setToolsClient } = await import('../../../src/mcp/tools.js');

      const mockClient = {
        apiKey: 'test-key',
        workspaceId: 'test-workspace',
        listRecords: vi.fn(),
        getRecord: vi.fn(),
        createRecord: vi.fn(),
        updateRecord: vi.fn(),
        deleteRecord: vi.fn(),
        getSchema: vi.fn(),
        countRecords: vi.fn(),
        request: vi.fn(),
      };

      setToolsClient(mockClient as any);
    });

    describe('MCP-TOOLS-017: Schema validation', () => {
      it('should define MCP-compliant tool schema', async () => {
        // CONTRACT: Undo tool requires transaction_id parameter

        const { getToolSchemas } = await import('../../../src/mcp/tools.js');
        const schemas = getToolSchemas();

        const undoTool = schemas.find((t) => t.name === 'smartsuite_undo');
        expect(undoTool).toBeDefined();

        // Validate required transaction_id
        expect(undoTool?.inputSchema.required).toContain('transaction_id');
      });
    });

    describe('MCP-TOOLS-018: Parameter validation', () => {
      it('should require transaction_id parameter', async () => {
        // CONTRACT: transaction_id is mandatory for rollback

        const { executeUndoTool } = await import('../../../src/mcp/tools.js');

        await expect(
          executeUndoTool({
            // Missing transaction_id
          }),
        ).rejects.toThrow(/transaction_id.*required/i);
      });

      it('should validate transaction_id format', async () => {
        // CONTRACT: transaction_id must be non-empty string

        const { executeUndoTool } = await import('../../../src/mcp/tools.js');

        await expect(
          executeUndoTool({
            transaction_id: '', // Empty string
          }),
        ).rejects.toThrow(/transaction_id.*empty/i);
      });
    });

    describe('MCP-TOOLS-019: Handler delegation', () => {
      it('should delegate to UndoHandler for transaction rollback', async () => {
        // CONTRACT: Undo operation reverses previous mutation

        const mockUndoHandler = {
          execute: vi.fn().mockResolvedValue({
            transaction_id: 'txn_123',
            operation: 'rollback',
            reversed: true,
            message: 'Successfully deleted created record',
          }),
          setClient: vi.fn(),
        };

        vi.mock('../../../src/operations/undo-handler.js', () => ({
          UndoHandler: vi.fn(() => mockUndoHandler),
        }));

        const { executeUndoTool } = await import('../../../src/mcp/tools.js');

        const result = await executeUndoTool({
          transaction_id: 'txn_123',
        });

        expect(mockUndoHandler.execute).toHaveBeenCalledWith({
          transaction_id: 'txn_123',
        });

        expect(result).toMatchObject({
          reversed: true,
          message: expect.any(String),
        });
      });
    });

    describe('MCP-TOOLS-020: Error handling', () => {
      it('should propagate transaction not found errors', async () => {
        // CONTRACT: Invalid transaction_id must return clear error

        const mockUndoHandler = {
          execute: vi.fn().mockRejectedValue(new Error('Transaction not found: txn_invalid')),
          setClient: vi.fn(),
        };

        vi.mock('../../../src/operations/undo-handler.js', () => ({
          UndoHandler: vi.fn(() => mockUndoHandler),
        }));

        const { executeUndoTool } = await import('../../../src/mcp/tools.js');

        await expect(
          executeUndoTool({
            transaction_id: 'txn_invalid',
          }),
        ).rejects.toThrow(/Transaction not found/);
      });

      it('should propagate already reversed transaction errors', async () => {
        // CONTRACT: Prevent double-undo operations

        const mockUndoHandler = {
          execute: vi.fn().mockRejectedValue(new Error('Transaction already reversed')),
          setClient: vi.fn(),
        };

        vi.mock('../../../src/operations/undo-handler.js', () => ({
          UndoHandler: vi.fn(() => mockUndoHandler),
        }));

        const { executeUndoTool } = await import('../../../src/mcp/tools.js');

        await expect(
          executeUndoTool({
            transaction_id: 'txn_123',
          }),
        ).rejects.toThrow(/already reversed/);
      });
    });
  });

  // ============================================================================
  // CROSS-CUTTING CONCERNS
  // ============================================================================

  describe('Cross-cutting tool concerns', () => {

    describe('MCP-TOOLS-021: Tool registration', () => {
      it('should register all 5 core MCP tools', async () => {
        // CONTRACT: MCP server must expose all 5 tools to clients

        const { getToolSchemas } = await import('../../../src/mcp/tools.js');
        const schemas = getToolSchemas();

        expect(schemas).toHaveLength(5);

        const toolNames = schemas.map((s) => s.name);
        expect(toolNames).toEqual([
          'smartsuite_query',
          'smartsuite_record',
          'smartsuite_schema',
          'smartsuite_discover',
          'smartsuite_undo',
        ]);
      });
    });

    describe('MCP-TOOLS-022: Client dependency injection', () => {
      it('should inject SmartSuiteClient into all handlers', async () => {
        // CONTRACT: Tools must set authenticated client on handlers

        const mockClient = {
          apiKey: 'test-key',
          workspaceId: 'test-workspace',
          listRecords: vi.fn(),
          getRecord: vi.fn(),
          createRecord: vi.fn(),
          updateRecord: vi.fn(),
          deleteRecord: vi.fn(),
          getSchema: vi.fn(),
          countRecords: vi.fn(),
          request: vi.fn(),
        };

        const { setToolsClient } = await import('../../../src/mcp/tools.js');

        // Should not throw
        expect(() => setToolsClient(mockClient)).not.toThrow();
      });
    });

    describe('MCP-TOOLS-023: Error standardization', () => {
      it('should standardize error responses across all tools', async () => {
        // CONTRACT: All tools return errors in consistent format

        const mockError = new Error('Test error');

        const { formatToolError } = await import('../../../src/mcp/tools.js');

        const formatted = formatToolError(mockError);

        expect(formatted).toMatchObject({
          error: expect.any(String),
          message: 'Test error',
        });
      });

      it('should include error codes for known error types', async () => {
        // CONTRACT: Known errors include MCP error codes

        const authError = new Error('Authentication required');

        const { formatToolError } = await import('../../../src/mcp/tools.js');

        const formatted = formatToolError(authError);

        expect(formatted).toMatchObject({
          error: expect.any(String),
          code: 'AUTHENTICATION_REQUIRED',
        });
      });
    });

    describe('MCP-TOOLS-024: Response formatting', () => {
      it('should format handler responses for MCP protocol', async () => {
        // CONTRACT: Tool responses must be MCP-compliant JSON

        const handlerResult = {
          operation: 'list',
          records: [{ id: '1', title: 'Test' }],
        };

        const { formatToolResponse } = await import('../../../src/mcp/tools.js');

        const formatted = formatToolResponse('smartsuite_query', handlerResult);

        expect(formatted).toMatchObject({
          tool: 'smartsuite_query',
          result: handlerResult,
          timestamp: expect.any(String),
        });
      });
    });

    describe('MCP-TOOLS-025: Authentication state', () => {
      it('should enforce authentication before tool execution', async () => {
        // CONTRACT: All tools require authenticated client

        const { executeQueryTool, setToolsClient } = await import('../../../src/mcp/tools.js');

        // Clear client
        setToolsClient(null as any);

        await expect(
          executeQueryTool({
            operation: 'list',
            tableId: '68a8ff5237fde0bf797c05b3',
          }),
        ).rejects.toThrow(/authentication.*required/i);
      });
    });

    describe('MCP-TOOLS-026: Concurrent execution', () => {
      it('should handle concurrent tool calls safely', async () => {
        // CONTRACT: Tools must be thread-safe for concurrent MCP requests

        const mockQueryHandler = {
          execute: vi.fn()
            .mockResolvedValueOnce({ operation: 'list', records: [{ id: '1' }] })
            .mockResolvedValueOnce({ operation: 'list', records: [{ id: '2' }] }),
          setClient: vi.fn(),
        };

        vi.mock('../../../src/operations/query-handler.js', () => ({
          QueryHandler: vi.fn(() => mockQueryHandler),
        }));

        const { executeQueryTool } = await import('../../../src/mcp/tools.js');

        const results = await Promise.all([
          executeQueryTool({
            operation: 'list',
            tableId: '68a8ff5237fde0bf797c05b3',
          }),
          executeQueryTool({
            operation: 'list',
            tableId: '68ab34b30b1e05e11a8ba87f',
          }),
        ]);

        expect(results).toHaveLength(2);
        expect(mockQueryHandler.execute).toHaveBeenCalledTimes(2);
      });
    });

    describe('MCP-TOOLS-027: Memory efficiency', () => {
      it('should limit response size for MCP context optimization', async () => {
        // CONTRACT: Large responses truncated with continuation tokens

        const mockQueryHandler = {
          execute: vi.fn().mockResolvedValue({
            operation: 'list',
            records: Array.from({ length: 100 }, (_, i) => ({ id: String(i) })),
            total: 100,
          }),
          setClient: vi.fn(),
        };

        vi.mock('../../../src/operations/query-handler.js', () => ({
          QueryHandler: vi.fn(() => mockQueryHandler),
        }));

        const { executeQueryTool } = await import('../../../src/mcp/tools.js');

        await executeQueryTool({
          operation: 'list',
          tableId: '68a8ff5237fde0bf797c05b3',
          limit: 5, // MCP token safety default
        });

        // Verify limit was enforced at handler level
        expect(mockQueryHandler.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            limit: 5,
          }),
        );
      });
    });

    describe('MCP-TOOLS-028: Tool documentation', () => {
      it('should include usage examples in tool descriptions', async () => {
        // CONTRACT: Tool schemas include helpful descriptions for LLM context

        const { getToolSchemas } = await import('../../../src/mcp/tools.js');
        const schemas = getToolSchemas();

        schemas.forEach((tool) => {
          expect(tool.description).toBeTruthy();
          expect(tool.description!.length).toBeGreaterThan(20); // Non-trivial description
        });
      });
    });
  });
});
