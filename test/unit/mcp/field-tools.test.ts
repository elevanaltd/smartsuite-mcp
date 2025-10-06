// Phoenix Test Contract: MCP-FIELD-001 to MCP-FIELD-020
// Contract: Field management MCP tool wrappers - Phase 2J
// Status: GREEN (implementation complete)
// Phase: 2J - Field Management Tools (field create, field update)
// Architecture: MCP Field Tools → FieldHandler → SmartSuiteClient → API
// CRITICAL: UUID corruption prevention enforced at tool boundary

import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * MCP Field Management Tool Test Contracts
 *
 * Purpose: Validate MCP protocol integration for field operations
 * Coverage Target: 90% (universal-test-engineer standard)
 * Critical Safety: UUID corruption prevention (options vs choices)
 *
 * Tool Responsibilities:
 * 1. Expose field_create and field_update MCP tool schemas
 * 2. Validate field configuration parameters
 * 3. Enforce UUID corruption prevention
 * 4. Delegate to FieldHandler
 * 5. Transform responses to MCP format
 * 6. Default dry_run to true for safety
 *
 * Test Organization:
 * - 20 test contracts across 2 field management tools
 * - Focus on MCP protocol compliance and safety gates
 * - UUID corruption prevention is CRITICAL safety requirement
 */

describe('MCP Field Management Tools', () => {
  // ============================================================================
  // TOOL: smartsuite_field_create - Create new field in table
  // ============================================================================

  describe('smartsuite_field_create tool', () => {
    beforeEach(async () => {
      const { setToolsClient, resetHandlerDependencies } = await import('../../../src/mcp/tools.js');

      // Reset handler dependencies to avoid test pollution
      resetHandlerDependencies();

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
        addField: vi.fn(),
        updateField: vi.fn(),
      };

      setToolsClient(mockClient as any);
    });

    describe('MCP-FIELD-001: Schema validation', () => {
      it('should define MCP-compliant tool schema', async () => {
        // CONTRACT: Tool schema must match MCP SDK expectations
        // Required: name, description, inputSchema with type/properties/required

        const { getToolSchemas } = await import('../../../src/mcp/tools.js');
        const schemas = getToolSchemas();

        const fieldCreateTool = schemas.find((t) => t.name === 'smartsuite_field_create');
        expect(fieldCreateTool).toBeDefined();
        expect(fieldCreateTool?.description).toBeTruthy();
        expect(fieldCreateTool?.description).toContain('field');

        // Validate schema structure
        expect(fieldCreateTool?.inputSchema).toMatchObject({
          type: 'object',
          properties: expect.any(Object),
          required: expect.arrayContaining(['tableId', 'fieldConfig']),
        });

        // Validate fieldConfig nested schema
        const fieldConfigProp = fieldCreateTool?.inputSchema.properties.fieldConfig as any;
        expect(fieldConfigProp).toBeDefined();
        expect(fieldConfigProp.type).toBe('object');
        expect(fieldConfigProp.properties).toHaveProperty('field_type');
        expect(fieldConfigProp.properties).toHaveProperty('label');
        expect(fieldConfigProp.properties).toHaveProperty('slug');
        expect(fieldConfigProp.required).toEqual(
          expect.arrayContaining(['field_type', 'label', 'slug']),
        );
      });

      it('should include dryRun parameter with default true', async () => {
        // CONTRACT: dry_run defaults to true for safety
        // SAFETY: Prevent accidental schema modifications

        const { getToolSchemas } = await import('../../../src/mcp/tools.js');
        const schemas = getToolSchemas();

        const fieldCreateTool = schemas.find((t) => t.name === 'smartsuite_field_create');
        const dryRunProp = fieldCreateTool?.inputSchema.properties.dryRun as any;

        expect(dryRunProp).toBeDefined();
        expect(dryRunProp.type).toBe('boolean');
        expect(dryRunProp.default).toBe(true);
      });
    });

    describe('MCP-FIELD-002: Parameter validation', () => {
      it('should require tableId parameter', async () => {
        // CONTRACT: tableId is mandatory for field operations

        const { executeFieldCreateTool } = await import('../../../src/mcp/tools.js');

        const result = await executeFieldCreateTool({
          // Missing tableId
          fieldConfig: {
            field_type: 'textfield',
            label: 'Test',
            slug: 'test',
          },
        } as any);

        expect(result.isError).toBe(true);
        expect(result.content?.[0]?.text).toMatch(/tableId.*required/i);
      });

      it('should require fieldConfig parameter', async () => {
        // CONTRACT: fieldConfig object is mandatory

        const { executeFieldCreateTool } = await import('../../../src/mcp/tools.js');

        const result = await executeFieldCreateTool({
          tableId: '68a8ff5237fde0bf797c05b3',
          // Missing fieldConfig
        } as any);

        expect(result.isError).toBe(true);
        expect(result.content?.[0]?.text).toMatch(/fieldConfig.*required/i);
      });

      it('should validate field_type is required in fieldConfig', async () => {
        // CONTRACT: field_type is mandatory for field creation

        const { executeFieldCreateTool } = await import('../../../src/mcp/tools.js');

        const result = await executeFieldCreateTool({
          tableId: '68a8ff5237fde0bf797c05b3',
          fieldConfig: {
            // Missing field_type
            label: 'Test',
            slug: 'test',
          } as any,
        });

        expect(result.isError).toBe(true);
        expect(result.content?.[0]?.text).toMatch(/field_type.*required/i);
      });

      it('should validate label is required in fieldConfig', async () => {
        // CONTRACT: label is mandatory for field creation

        const { executeFieldCreateTool } = await import('../../../src/mcp/tools.js');

        const result = await executeFieldCreateTool({
          tableId: '68a8ff5237fde0bf797c05b3',
          fieldConfig: {
            field_type: 'textfield',
            // Missing label
            slug: 'test',
          } as any,
        });

        expect(result.isError).toBe(true);
        expect(result.content?.[0]?.text).toMatch(/label.*required/i);
      });

      it('should validate slug is required in fieldConfig', async () => {
        // CONTRACT: slug is mandatory for field creation

        const { executeFieldCreateTool } = await import('../../../src/mcp/tools.js');

        const result = await executeFieldCreateTool({
          tableId: '68a8ff5237fde0bf797c05b3',
          fieldConfig: {
            field_type: 'textfield',
            label: 'Test',
            // Missing slug
          } as any,
        });

        expect(result.isError).toBe(true);
        expect(result.content?.[0]?.text).toMatch(/slug.*required/i);
      });

      it('should validate field_type is valid SmartSuite type', async () => {
        // CONTRACT: field_type must be recognized SmartSuite field type
        // EDGE CASE: Prevent typos causing silent failures

        const { executeFieldCreateTool } = await import('../../../src/mcp/tools.js');

        const result = await executeFieldCreateTool({
          tableId: '68a8ff5237fde0bf797c05b3',
          fieldConfig: {
            field_type: 'invalidtype', // Invalid type
            label: 'Test',
            slug: 'test',
          },
        });

        expect(result.isError).toBe(true);
        expect(result.content?.[0]?.text).toMatch(/invalid.*field.*type/i);
      });
    });

    describe('MCP-FIELD-003: Handler delegation', () => {
      it('should delegate to FieldHandler with correct parameters', async () => {
        // CONTRACT: Tool must invoke FieldHandler.execute() with correct context
        // BEHAVIORAL: Verify delegation, not business logic
        // TEST FIX: Use setHandlerDependencies() pattern (vi.doMock after import doesn't work)

        const mockFieldHandler = {
          execute: vi.fn().mockResolvedValue({
            operation: 'create',
            tableId: '68a8ff5237fde0bf797c05b3',
            field: {
              id: 'field_123',
              field_type: 'textfield',
              label: 'Test Field',
              slug: 'test_field',
            },
          }),
          setClient: vi.fn(),
        };

        const { executeFieldCreateTool, setHandlerDependencies } =
          await import('../../../src/mcp/tools.js');

        // Inject mock handler via DI (matches tools.test.ts pattern)
        setHandlerDependencies({ fieldHandler: mockFieldHandler as any });

        // Act
        const params = {
          tableId: '68a8ff5237fde0bf797c05b3',
          fieldConfig: {
            field_type: 'textfield',
            label: 'Test Field',
            slug: 'test_field',
          },
          dryRun: false,
        };

        await executeFieldCreateTool(params);

        // Assert - Handler was called with correct parameters
        expect(mockFieldHandler.execute).toHaveBeenCalledWith({
          operation: 'create',
          tableId: params.tableId,
          fieldConfig: params.fieldConfig,
          dryRun: false,
        });
      });

      it('should default dryRun to true if not specified', async () => {
        // CONTRACT: Safety default - dry_run: true prevents accidental changes
        // CRITICAL: Default behavior protects production schemas
        // TEST FIX: Use setHandlerDependencies() pattern

        const mockFieldHandler = {
          execute: vi.fn().mockResolvedValue({
            operation: 'create',
            dryRun: true,
            preview: {},
          }),
          setClient: vi.fn(),
        };

        const { executeFieldCreateTool, setHandlerDependencies } =
          await import('../../../src/mcp/tools.js');

        setHandlerDependencies({ fieldHandler: mockFieldHandler as any });

        // Act - dryRun NOT specified
        await executeFieldCreateTool({
          tableId: '68a8ff5237fde0bf797c05b3',
          fieldConfig: {
            field_type: 'textfield',
            label: 'Test',
            slug: 'test',
          },
          // dryRun not specified - should default to true
        });

        // Assert - dryRun defaulted to true
        expect(mockFieldHandler.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            dryRun: true,
          }),
        );
      });
    });

    describe('MCP-FIELD-004: Response transformation', () => {
      it('should return MCP-formatted success response', async () => {
        // CONTRACT: Tool must transform FieldHandler response to MCP format
        // MCP format: { content: [{ type, text }], isError: false }
        // TEST FIX: Use setHandlerDependencies() pattern

        const mockFieldHandler = {
          execute: vi.fn().mockResolvedValue({
            operation: 'create',
            tableId: '68a8ff5237fde0bf797c05b3',
            field: {
              id: 'field_123',
              field_type: 'textfield',
              label: 'Test Field',
              slug: 'test_field',
            },
          }),
          setClient: vi.fn(),
        };

        const { executeFieldCreateTool, setHandlerDependencies } =
          await import('../../../src/mcp/tools.js');

        setHandlerDependencies({ fieldHandler: mockFieldHandler as any });

        // Act
        const result = await executeFieldCreateTool({
          tableId: '68a8ff5237fde0bf797c05b3',
          fieldConfig: {
            field_type: 'textfield',
            label: 'Test Field',
            slug: 'test_field',
          },
          dryRun: false,
        });

        // Assert - MCP format
        expect(result).toHaveProperty('content');
        expect(result.content).toBeInstanceOf(Array);
        expect(result.content[0]).toMatchObject({
          type: 'text',
          text: expect.any(String),
        });
        expect(result.isError).toBe(false);

        // Assert - Response includes field ID
        expect(result.content?.[0]?.text).toContain('field_123');
      });

      it('should include dry-run indicator in response', async () => {
        // CONTRACT: Dry-run responses must clearly indicate no actual change occurred

        const mockFieldHandler = {
          execute: vi.fn().mockResolvedValue({
            operation: 'create',
            dryRun: true,
            preview: {
              field_type: 'textfield',
              label: 'Test',
              slug: 'test',
            },
          }),
          setClient: vi.fn(),
        };

        const { executeFieldCreateTool, setHandlerDependencies } =
          await import('../../../src/mcp/tools.js');

        setHandlerDependencies({ fieldHandler: mockFieldHandler as any });

        // Act
        const result = await executeFieldCreateTool({
          tableId: '68a8ff5237fde0bf797c05b3',
          fieldConfig: {
            field_type: 'textfield',
            label: 'Test',
            slug: 'test',
          },
          dryRun: true,
        });

        // Assert - Response indicates dry-run
        expect(result.content?.[0]?.text).toMatch(/dry.*run|preview/i);
      });
    });

    describe('MCP-FIELD-005: Error handling', () => {
      it('should transform handler errors to MCP error format', async () => {
        // CONTRACT: Handler errors must be transformed to MCP error responses
        // MCP error format: { content: [{ type, text }], isError: true }

        const mockFieldHandler = {
          execute: vi.fn().mockRejectedValue(new Error('Field slug already exists')),
          setClient: vi.fn(),
        };

        const { executeFieldCreateTool, setHandlerDependencies } =
          await import('../../../src/mcp/tools.js');

        setHandlerDependencies({ fieldHandler: mockFieldHandler as any });

        // Act
        const result = await executeFieldCreateTool({
          tableId: '68a8ff5237fde0bf797c05b3',
          fieldConfig: {
            field_type: 'textfield',
            label: 'Test',
            slug: 'existing_slug',
          },
          dryRun: false,
        });

        // Assert - MCP error format
        expect(result).toHaveProperty('isError', true);
        expect(result.content?.[0]?.text).toContain('Field slug already exists');
      });
    });
  });

  // ============================================================================
  // TOOL: smartsuite_field_update - Update existing field
  // ============================================================================

  describe('smartsuite_field_update tool', () => {
    beforeEach(async () => {
      const { setToolsClient, resetHandlerDependencies } = await import('../../../src/mcp/tools.js');

      // Reset handler dependencies to avoid test pollution
      resetHandlerDependencies();

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
        addField: vi.fn(),
        updateField: vi.fn(),
      };

      setToolsClient(mockClient as any);
    });

    describe('MCP-FIELD-006: Schema validation', () => {
      it('should define MCP-compliant tool schema', async () => {
        // CONTRACT: Tool schema must match MCP SDK expectations

        const { getToolSchemas } = await import('../../../src/mcp/tools.js');
        const schemas = getToolSchemas();

        const fieldUpdateTool = schemas.find((t) => t.name === 'smartsuite_field_update');
        expect(fieldUpdateTool).toBeDefined();
        expect(fieldUpdateTool?.description).toBeTruthy();

        // Validate schema structure
        expect(fieldUpdateTool?.inputSchema).toMatchObject({
          type: 'object',
          properties: expect.any(Object),
          required: expect.arrayContaining(['tableId', 'fieldId', 'updates']),
        });
      });

      it('should include dryRun parameter with default true', async () => {
        // CONTRACT: dry_run defaults to true for safety

        const { getToolSchemas } = await import('../../../src/mcp/tools.js');
        const schemas = getToolSchemas();

        const fieldUpdateTool = schemas.find((t) => t.name === 'smartsuite_field_update');
        const dryRunProp = fieldUpdateTool?.inputSchema.properties.dryRun as any;

        expect(dryRunProp).toBeDefined();
        expect(dryRunProp.type).toBe('boolean');
        expect(dryRunProp.default).toBe(true);
      });
    });

    describe('MCP-FIELD-007: Parameter validation', () => {
      it('should require tableId parameter', async () => {
        // CONTRACT: tableId is mandatory

        const { executeFieldUpdateTool } = await import('../../../src/mcp/tools.js');

        const result = await executeFieldUpdateTool({
          // Missing tableId
          fieldId: 'field_123',
          updates: { label: 'Updated' },
        } as any);

        expect(result.isError).toBe(true);
        expect(result.content?.[0]?.text).toMatch(/tableId.*required/i);
      });

      it('should require fieldId parameter', async () => {
        // CONTRACT: fieldId is mandatory for updates

        const { executeFieldUpdateTool } = await import('../../../src/mcp/tools.js');

        const result = await executeFieldUpdateTool({
          tableId: '68a8ff5237fde0bf797c05b3',
          // Missing fieldId
          updates: { label: 'Updated' },
        } as any);

        expect(result.isError).toBe(true);
        expect(result.content?.[0]?.text).toMatch(/fieldId.*required/i);
      });

      it('should require updates parameter', async () => {
        // CONTRACT: updates object is mandatory

        const { executeFieldUpdateTool } = await import('../../../src/mcp/tools.js');

        const result = await executeFieldUpdateTool({
          tableId: '68a8ff5237fde0bf797c05b3',
          fieldId: 'field_123',
          // Missing updates
        } as any);

        expect(result.isError).toBe(true);
        expect(result.content?.[0]?.text).toMatch(/updates.*required/i);
      });
    });

    describe('MCP-FIELD-008: CRITICAL - UUID corruption prevention at tool boundary', () => {
      it('should REJECT options parameter in updates (require choices)', async () => {
        // CRITICAL CONTRACT: Prevent UUID corruption at tool boundary
        // PRODUCTION DATA LOSS RISK: Using "options" corrupts all linked records
        // CONSTITUTIONAL REQUIREMENT: Test integrity - validate CORRECT behavior

        const { executeFieldUpdateTool } = await import('../../../src/mcp/tools.js');

        // DANGEROUS: Using "options" instead of "choices"
        const result = await executeFieldUpdateTool({
          tableId: '68a8ff5237fde0bf797c05b3',
          fieldId: 'field_select_123',
          updates: {
            params: {
              options: [
                // WRONG - Will corrupt UUIDs!
                { value: 'active', label: 'Active' },
              ],
            },
          },
        });

        expect(result.isError).toBe(true);
        expect(result.content?.[0]?.text).toMatch(/choices.*options.*uuid/i);
      });

      it('should ACCEPT choices parameter in updates (correct format)', async () => {
        // CONTRACT: "choices" is the correct parameter
        // This preserves UUIDs and prevents data corruption

        const mockFieldHandler = {
          execute: vi.fn().mockResolvedValue({
            operation: 'update',
            field: { id: 'field_select_123' },
          }),
          setClient: vi.fn(),
        };

        const { executeFieldUpdateTool, setHandlerDependencies } =
          await import('../../../src/mcp/tools.js');

        setHandlerDependencies({ fieldHandler: mockFieldHandler as any });

        // Act - Using correct "choices" parameter
        const result = await executeFieldUpdateTool({
          tableId: '68a8ff5237fde0bf797c05b3',
          fieldId: 'field_select_123',
          updates: {
            params: {
              choices: [
                // CORRECT
                { value: 'active', label: 'Active' },
              ],
            },
          },
          dryRun: false,
        });

        // Assert - Operation succeeded
        expect(result.isError).toBe(false);
      });

      it('should detect options in nested update structures', async () => {
        // EDGE CASE: UUID corruption prevention must work for nested structures

        const { executeFieldUpdateTool } = await import('../../../src/mcp/tools.js');

        const result = await executeFieldUpdateTool({
          tableId: '68a8ff5237fde0bf797c05b3',
          fieldId: 'field_select_456',
          updates: {
            label: 'Status',
            params: {
              display_config: { color: 'blue' },
              options: [{ value: 'test' }], // Hidden in nested structure
            },
          },
        });

        expect(result.isError).toBe(true);
        expect(result.content?.[0]?.text).toMatch(/choices.*options/i);
      });

      it('should validate parameters at tool boundary BEFORE handler delegation', async () => {
        // CRITICAL: Tool-level validation MUST catch UUID corruption before reaching handler
        // ARCHITECTURAL: Defense-in-depth - tool boundary protects even if handler bypassed
        // Critical-Engineer: consulted for tool-level UUID corruption prevention (data integrity gate)

        const { executeFieldUpdateTool } = await import('../../../src/mcp/tools.js');

        const dangerousParams = {
          tableId: 'test-table',
          fieldId: 'field-123',
          updates: {
            params: {
              options: [
                // WRONG - will corrupt UUIDs
                { value: 'opt1', label: 'Option 1' },
              ],
            },
          },
          dryRun: false,
        };

        const result = await executeFieldUpdateTool(dangerousParams);

        // Assert: Tool MUST reject before handler execution
        expect(result.isError).toBe(true);
        expect(result.content?.[0]?.text).toMatch(/use.*choices.*instead.*options/i);
        expect(result.content?.[0]?.text).toMatch(/uuid/i);
        expect(result.content?.[0]?.text).toMatch(/corrupt/i);
      });
    });

    describe('MCP-FIELD-009: Handler delegation', () => {
      it('should delegate to FieldHandler with correct parameters', async () => {
        // CONTRACT: Tool must invoke FieldHandler.execute() with correct context

        const mockFieldHandler = {
          execute: vi.fn().mockResolvedValue({
            operation: 'update',
            tableId: '68a8ff5237fde0bf797c05b3',
            field: {
              id: 'field_123',
              label: 'Updated Label',
            },
          }),
          setClient: vi.fn(),
        };

        const { executeFieldUpdateTool, setHandlerDependencies } =
          await import('../../../src/mcp/tools.js');

        setHandlerDependencies({ fieldHandler: mockFieldHandler as any });

        // Act
        const params = {
          tableId: '68a8ff5237fde0bf797c05b3',
          fieldId: 'field_123',
          updates: { label: 'Updated Label' },
          dryRun: false,
        };

        await executeFieldUpdateTool(params);

        // Assert - Handler was called correctly
        expect(mockFieldHandler.execute).toHaveBeenCalledWith({
          operation: 'update',
          tableId: params.tableId,
          fieldId: params.fieldId,
          updates: params.updates,
          dryRun: false,
        });
      });

      it('should default dryRun to true if not specified', async () => {
        // CONTRACT: Safety default - dry_run: true prevents accidental changes

        const mockFieldHandler = {
          execute: vi.fn().mockResolvedValue({
            operation: 'update',
            dryRun: true,
            preview: {},
          }),
          setClient: vi.fn(),
        };

        const { executeFieldUpdateTool, setHandlerDependencies } =
          await import('../../../src/mcp/tools.js');

        setHandlerDependencies({ fieldHandler: mockFieldHandler as any });

        // Act - dryRun NOT specified
        await executeFieldUpdateTool({
          tableId: '68a8ff5237fde0bf797c05b3',
          fieldId: 'field_123',
          updates: { label: 'Updated' },
          // dryRun not specified - should default to true
        });

        // Assert - dryRun defaulted to true
        expect(mockFieldHandler.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            dryRun: true,
          }),
        );
      });
    });

    describe('MCP-FIELD-010: Response transformation', () => {
      it('should return MCP-formatted success response', async () => {
        // CONTRACT: Tool must transform FieldHandler response to MCP format

        const mockFieldHandler = {
          execute: vi.fn().mockResolvedValue({
            operation: 'update',
            tableId: '68a8ff5237fde0bf797c05b3',
            field: {
              id: 'field_123',
              label: 'Updated Label',
            },
          }),
          setClient: vi.fn(),
        };

        const { executeFieldUpdateTool, setHandlerDependencies } =
          await import('../../../src/mcp/tools.js');

        setHandlerDependencies({ fieldHandler: mockFieldHandler as any });

        // Act
        const result = await executeFieldUpdateTool({
          tableId: '68a8ff5237fde0bf797c05b3',
          fieldId: 'field_123',
          updates: { label: 'Updated Label' },
          dryRun: false,
        });

        // Assert - MCP format
        expect(result).toHaveProperty('content');
        expect(result.content).toBeInstanceOf(Array);
        expect(result.content[0]).toMatchObject({
          type: 'text',
          text: expect.any(String),
        });
        expect(result.isError).toBe(false);

        // Assert - Response includes field ID
        expect(result.content?.[0]?.text).toContain('field_123');
      });

      it('should include dry-run indicator in response', async () => {
        // CONTRACT: Dry-run responses must clearly indicate no actual change occurred

        const mockFieldHandler = {
          execute: vi.fn().mockResolvedValue({
            operation: 'update',
            dryRun: true,
            preview: { label: 'Updated' },
          }),
          setClient: vi.fn(),
        };

        const { executeFieldUpdateTool, setHandlerDependencies } =
          await import('../../../src/mcp/tools.js');

        setHandlerDependencies({ fieldHandler: mockFieldHandler as any });

        // Act
        const result = await executeFieldUpdateTool({
          tableId: '68a8ff5237fde0bf797c05b3',
          fieldId: 'field_123',
          updates: { label: 'Updated' },
          dryRun: true,
        });

        // Assert - Response indicates dry-run
        expect(result.content?.[0]?.text).toMatch(/dry.*run|preview/i);
      });
    });

    describe('MCP-FIELD-011: Error handling', () => {
      it('should transform handler errors to MCP error format', async () => {
        // CONTRACT: Handler errors must be transformed to MCP error responses

        const mockFieldHandler = {
          execute: vi.fn().mockRejectedValue(new Error('Field not found')),
          setClient: vi.fn(),
        };

        const { executeFieldUpdateTool, setHandlerDependencies } =
          await import('../../../src/mcp/tools.js');

        setHandlerDependencies({ fieldHandler: mockFieldHandler as any });

        // Act
        const result = await executeFieldUpdateTool({
          tableId: '68a8ff5237fde0bf797c05b3',
          fieldId: 'nonexistent_field',
          updates: { label: 'Test' },
          dryRun: false,
        });

        // Assert - MCP error format
        expect(result).toHaveProperty('isError', true);
        expect(result.content?.[0]?.text).toContain('Field not found');
      });

      it('should handle UUID corruption prevention errors with clear messaging', async () => {
        // CONTRACT: UUID corruption errors must be clear and actionable

        const mockFieldHandler = {
          execute: vi
            .fn()
            .mockRejectedValue(
              new Error('Use "choices" parameter instead of "options" to preserve UUIDs'),
            ),
          setClient: vi.fn(),
        };

        const { executeFieldUpdateTool, setHandlerDependencies } =
          await import('../../../src/mcp/tools.js');

        setHandlerDependencies({ fieldHandler: mockFieldHandler as any });

        // Act
        const result = await executeFieldUpdateTool({
          tableId: '68a8ff5237fde0bf797c05b3',
          fieldId: 'field_select',
          updates: {
            params: {
              options: [{ value: 'test' }], // Wrong parameter
            },
          },
          dryRun: false,
        });

        // Assert - Clear error message about UUID corruption
        expect(result.isError).toBe(true);
        expect(result.content?.[0]?.text).toContain('choices');
        expect(result.content?.[0]?.text).toContain('options');
        expect(result.content?.[0]?.text).toContain('UUID');
      });
    });
  });
});
