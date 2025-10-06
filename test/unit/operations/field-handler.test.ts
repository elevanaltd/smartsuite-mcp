// Phoenix Test Contract: FIELD-001 to FIELD-015
// Contract: Field management operations (create, update) with UUID corruption prevention
// Status: RED (tests written, implementation pending)
// Source: coordination/reports/850-REPORT-RESEARCH-PHASE-2J-FIELD-MANAGEMENT-INVESTIGATION.md
// TDD Phase: RED → Implementation will follow
// CRITICAL: UUID corruption prevention for change_field operations

import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { SmartSuiteClient } from '../../../src/smartsuite-client.js';

describe('FieldHandler', () => {
  let mockClient: SmartSuiteClient;

  beforeEach(() => {
    // Create mock SmartSuite client with all required methods
    mockClient = {
      apiKey: 'test-key',
      workspaceId: 'test-workspace',
      listRecords: vi.fn(),
      getRecord: vi.fn(),
      countRecords: vi.fn(),
      createRecord: vi.fn(),
      updateRecord: vi.fn(),
      deleteRecord: vi.fn(),
      getSchema: vi.fn(),
      request: vi.fn(),
      addField: vi.fn(),
      updateField: vi.fn(),
    };
  });

  describe('FIELD-001: Field create operation (success case)', () => {
    it('should create field with required parameters', async () => {
      // CONTRACT: Field creation requires field_type, label, slug
      // BEHAVIORAL ASSERTION: Validate correct behavior, not just API calls

      // Arrange
      const { FieldHandler } = await import('../../../src/operations/field-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3'; // Primary test table
      const fieldConfig = {
        field_type: 'textfield',
        label: 'Test Field',
        slug: 'test_field',
      };

      vi.mocked(mockClient.addField).mockResolvedValue({
        id: 'field_123',
        ...fieldConfig,
      });

      // Act
      const handler = new FieldHandler();
      handler.setClient(mockClient);
      const result = await handler.execute({
        operation: 'create',
        tableId,
        fieldConfig,
        dryRun: false, // Explicit execution - safety default is dry-run
      });

      // Assert - Result structure (BEHAVIOR: Field created successfully)
      expect(result).toBeDefined();
      expect(result).toHaveProperty('operation', 'create');
      expect(result).toHaveProperty('tableId', tableId);
      expect(result).toHaveProperty('field');

      // Type assertion for field properties
      const field = result.field as { id: string; field_type: string; label: string; slug: string };
      expect(field).toHaveProperty('id');
      expect(field.field_type).toBe('textfield');
      expect(field.label).toBe('Test Field');
      expect(field.slug).toBe('test_field');

      // Assert - API called correctly
      expect(mockClient.addField).toHaveBeenCalledWith(tableId, fieldConfig);
    });

    it('should support optional params for field-type specific configuration', async () => {
      // CONTRACT: Different field types require different params
      // EXAMPLE: Single-select needs choices array

      // Arrange
      const { FieldHandler } = await import('../../../src/operations/field-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';
      const fieldConfig = {
        field_type: 'singleselectfield',
        label: 'Status',
        slug: 'status',
        params: {
          choices: [
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ],
        },
      };

      vi.mocked(mockClient.addField).mockResolvedValue({
        id: 'field_456',
        ...fieldConfig,
      });

      // Act
      const handler = new FieldHandler();
      handler.setClient(mockClient);
      const result = await handler.execute({
        operation: 'create',
        tableId,
        fieldConfig,
        dryRun: false, // Explicit execution - safety default is dry-run
      });

      // Assert - Params preserved
      const fieldWithParams = result.field as { params?: { choices?: unknown[] } };
      expect(fieldWithParams.params).toBeDefined();
      expect(fieldWithParams.params?.choices).toHaveLength(2);
    });
  });

  describe('FIELD-002: Field create validation (required parameters)', () => {
    it('should reject creation without field_type', async () => {
      // CONTRACT: field_type is MANDATORY
      // BEHAVIORAL ASSERTION: Reject invalid behavior early

      // Arrange
      const { FieldHandler } = await import('../../../src/operations/field-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';
      const invalidConfig = {
        // Missing field_type
        label: 'Test Field',
        slug: 'test_field',
      };

      // Act & Assert
      const handler = new FieldHandler();
      handler.setClient(mockClient);

      await expect(
        handler.execute({
          operation: 'create',
          tableId,
          fieldConfig: invalidConfig as any,
        }),
      ).rejects.toThrow(/field_type.*required/i);

      // Assert - No API call attempted
      expect(mockClient.addField).not.toHaveBeenCalled();
    });

    it('should reject creation without label', async () => {
      // CONTRACT: label is MANDATORY

      // Arrange
      const { FieldHandler } = await import('../../../src/operations/field-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';
      const invalidConfig = {
        field_type: 'textfield',
        // Missing label
        slug: 'test_field',
      };

      // Act & Assert
      const handler = new FieldHandler();
      handler.setClient(mockClient);

      await expect(
        handler.execute({
          operation: 'create',
          tableId,
          fieldConfig: invalidConfig as any,
        }),
      ).rejects.toThrow(/label.*required/i);

      expect(mockClient.addField).not.toHaveBeenCalled();
    });

    it('should reject creation without slug', async () => {
      // CONTRACT: slug is MANDATORY

      // Arrange
      const { FieldHandler } = await import('../../../src/operations/field-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';
      const invalidConfig = {
        field_type: 'textfield',
        label: 'Test Field',
        // Missing slug
      };

      // Act & Assert
      const handler = new FieldHandler();
      handler.setClient(mockClient);

      await expect(
        handler.execute({
          operation: 'create',
          tableId,
          fieldConfig: invalidConfig as any,
        }),
      ).rejects.toThrow(/slug.*required/i);

      expect(mockClient.addField).not.toHaveBeenCalled();
    });

    it('should reject invalid field_type', async () => {
      // CONTRACT: field_type must be valid SmartSuite type
      // EDGE CASE: Prevent typos causing silent failures

      // Arrange
      const { FieldHandler } = await import('../../../src/operations/field-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';
      const invalidConfig = {
        field_type: 'invalidtype', // Invalid type
        label: 'Test Field',
        slug: 'test_field',
      };

      // Act & Assert
      const handler = new FieldHandler();
      handler.setClient(mockClient);

      await expect(
        handler.execute({
          operation: 'create',
          tableId,
          fieldConfig: invalidConfig,
        }),
      ).rejects.toThrow(/invalid.*field.*type/i);

      expect(mockClient.addField).not.toHaveBeenCalled();
    });
  });

  describe('FIELD-003: Field update operation (success case)', () => {
    it('should update field with valid parameters', async () => {
      // CONTRACT: Update existing field configuration

      // Arrange
      const { FieldHandler } = await import('../../../src/operations/field-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';
      const fieldId = 'field_123';
      const updates = {
        label: 'Updated Label',
      };

      vi.mocked(mockClient.updateField).mockResolvedValue({
        id: fieldId,
        field_type: 'textfield',
        label: 'Updated Label',
        slug: 'test_field',
      });

      // Act
      const handler = new FieldHandler();
      handler.setClient(mockClient);
      const result = await handler.execute({
        operation: 'update',
        tableId,
        fieldId,
        updates,
        dryRun: false, // Explicit execution - safety default is dry-run
      });

      // Assert - Result structure
      expect(result).toBeDefined();
      expect(result).toHaveProperty('operation', 'update');
      expect(result).toHaveProperty('tableId', tableId);
      expect(result).toHaveProperty('field');

      // Type assertion for field properties
      const field = result.field as { id: string; label: string };
      expect(field.id).toBe(fieldId);
      expect(field.label).toBe('Updated Label');

      // Assert - API called correctly
      expect(mockClient.updateField).toHaveBeenCalledWith(tableId, fieldId, updates);
    });
  });

  describe('FIELD-004: CRITICAL - UUID corruption prevention', () => {
    it('should REJECT options parameter for select fields (require choices instead)', async () => {
      // CRITICAL CONTRACT: Using "options" instead of "choices" corrupts UUIDs
      // PRODUCTION DATA LOSS RISK: Breaks all linked records
      // SAFETY LEVEL: RED (from research report line 88)
      // CONSTITUTIONAL REQUIREMENT: Test integrity - validate CORRECT behavior

      // Arrange
      const { FieldHandler } = await import('../../../src/operations/field-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';
      const fieldId = 'field_select_123';

      // DANGEROUS: Using "options" instead of "choices"
      const dangerousUpdate = {
        field_type: 'singleselectfield',
        params: {
          options: [
            // WRONG PARAMETER NAME - Will corrupt UUIDs!
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ],
        },
      };

      // Act & Assert
      const handler = new FieldHandler();
      handler.setClient(mockClient);

      await expect(
        handler.execute({
          operation: 'update',
          tableId,
          fieldId,
          updates: dangerousUpdate,
        }),
      ).rejects.toThrow(/use.*choices.*not.*options.*uuid/i);

      // Assert - No API call made (protection worked)
      expect(mockClient.updateField).not.toHaveBeenCalled();
    });

    it('should ACCEPT choices parameter for select fields (correct format)', async () => {
      // CONTRACT: "choices" is the correct parameter for select fields
      // This preserves UUIDs and prevents data corruption

      // Arrange
      const { FieldHandler } = await import('../../../src/operations/field-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';
      const fieldId = 'field_select_123';

      // CORRECT: Using "choices" parameter
      const safeUpdate = {
        field_type: 'singleselectfield',
        params: {
          choices: [
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ],
        },
      };

      vi.mocked(mockClient.updateField).mockResolvedValue({
        id: fieldId,
        ...safeUpdate,
      });

      // Act
      const handler = new FieldHandler();
      handler.setClient(mockClient);
      const result = await handler.execute({
        operation: 'update',
        tableId,
        fieldId,
        updates: safeUpdate,
        dryRun: false, // Explicit execution - safety default is dry-run
      });

      // Assert - Operation succeeded
      expect(result).toBeDefined();

      // Type assertion for nested params
      const fieldWithChoices = result.field as { params: { choices: unknown[] } };
      expect(fieldWithChoices.params.choices).toBeDefined();
      expect(fieldWithChoices.params.choices).toHaveLength(2);

      // Assert - API called with safe parameters
      expect(mockClient.updateField).toHaveBeenCalledWith(tableId, fieldId, safeUpdate);
    });

    it('should detect options parameter in nested params structure', async () => {
      // EDGE CASE: UUID corruption prevention must work for nested structures
      // CONSTITUTIONAL REQUIREMENT: Defensive testing - assume nothing

      // Arrange
      const { FieldHandler } = await import('../../../src/operations/field-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';
      const fieldId = 'field_select_456';

      // Nested dangerous parameter
      const nestedDangerous = {
        params: {
          display_config: { color: 'blue' },
          options: [{ value: 'test' }], // Hidden in nested structure
        },
      };

      // Act & Assert
      const handler = new FieldHandler();
      handler.setClient(mockClient);

      await expect(
        handler.execute({
          operation: 'update',
          tableId,
          fieldId,
          updates: nestedDangerous,
        }),
      ).rejects.toThrow(/use.*choices.*not.*options/i);

      expect(mockClient.updateField).not.toHaveBeenCalled();
    });

    it('should apply UUID protection to multipleselectfield as well', async () => {
      // EDGE CASE: Multiple-select fields have same UUID corruption risk
      // CONSTITUTIONAL REQUIREMENT: Test everything (all field types)

      // Arrange
      const { FieldHandler } = await import('../../../src/operations/field-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';
      const fieldId = 'field_multi_select';

      const dangerousMultiSelect = {
        field_type: 'multipleselectfield',
        params: {
          options: [{ value: 'tag1' }], // WRONG - Will corrupt UUIDs
        },
      };

      // Act & Assert
      const handler = new FieldHandler();
      handler.setClient(mockClient);

      await expect(
        handler.execute({
          operation: 'update',
          tableId,
          fieldId,
          updates: dangerousMultiSelect,
        }),
      ).rejects.toThrow(/use.*choices.*not.*options/i);

      expect(mockClient.updateField).not.toHaveBeenCalled();
    });
  });

  describe('FIELD-005: Dry-run simulation (no actual API call)', () => {
    it('should preview field creation without saving when dry_run is true', async () => {
      // CONTRACT: Dry-run must simulate operation without execution
      // SAFETY DEFAULT: dry_run should default to true

      // Arrange
      const { FieldHandler } = await import('../../../src/operations/field-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';
      const fieldConfig = {
        field_type: 'textfield',
        label: 'Test Field',
        slug: 'test_field',
      };

      // Act
      const handler = new FieldHandler();
      handler.setClient(mockClient);
      const result = await handler.execute({
        operation: 'create',
        tableId,
        fieldConfig,
        dryRun: true,
      });

      // Assert - Result structure
      expect(result).toBeDefined();
      expect(result).toHaveProperty('dryRun', true);
      expect(result).toHaveProperty('operation', 'create');
      expect(result).toHaveProperty('preview');
      expect(result.preview).toEqual(fieldConfig);

      // Assert - No actual API call made
      expect(mockClient.addField).not.toHaveBeenCalled();
    });

    it('should preview field update without saving when dry_run is true', async () => {
      // CONTRACT: Dry-run applies to updates as well

      // Arrange
      const { FieldHandler } = await import('../../../src/operations/field-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';
      const fieldId = 'field_123';
      const updates = { label: 'Updated Label' };

      // Act
      const handler = new FieldHandler();
      handler.setClient(mockClient);
      const result = await handler.execute({
        operation: 'update',
        tableId,
        fieldId,
        updates,
        dryRun: true,
      });

      // Assert - Preview returned
      expect(result).toBeDefined();
      expect(result).toHaveProperty('dryRun', true);
      expect(result).toHaveProperty('preview');

      // Assert - No actual API call made
      expect(mockClient.updateField).not.toHaveBeenCalled();
    });

    it('should validate field configuration during dry-run', async () => {
      // CONTRACT: Dry-run should catch validation errors
      // BEHAVIORAL ASSERTION: Prevent invalid operations early

      // Arrange
      const { FieldHandler } = await import('../../../src/operations/field-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';
      const invalidConfig = {
        field_type: 'invalidtype', // Invalid type
        label: 'Test',
        slug: 'test',
      };

      // Act & Assert
      const handler = new FieldHandler();
      handler.setClient(mockClient);

      await expect(
        handler.execute({
          operation: 'create',
          tableId,
          fieldConfig: invalidConfig,
          dryRun: true,
        }),
      ).rejects.toThrow(/invalid.*field.*type/i);

      // Validation happens even in dry-run
      expect(mockClient.addField).not.toHaveBeenCalled();
    });

    it('should default to dry_run: true for safety', async () => {
      // CONTRACT: Safety default - require explicit confirmation for actual changes
      // CONSTITUTIONAL REQUIREMENT: Defensive testing

      // Arrange
      const { FieldHandler } = await import('../../../src/operations/field-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';
      const fieldConfig = {
        field_type: 'textfield',
        label: 'Test',
        slug: 'test',
      };

      // Act - No dryRun parameter specified
      const handler = new FieldHandler();
      handler.setClient(mockClient);
      const result = await handler.execute({
        operation: 'create',
        tableId,
        fieldConfig,
        // dryRun not specified - should default to true
      });

      // Assert - Defaulted to dry-run
      expect(result.dryRun).toBe(true);
      expect(mockClient.addField).not.toHaveBeenCalled();
    });
  });

  describe('FIELD-006: Error handling (missing parameters)', () => {
    it('should reject operation without tableId', async () => {
      // CONTRACT: tableId is mandatory for all field operations

      // Arrange
      const { FieldHandler } = await import('../../../src/operations/field-handler.js');
      const fieldConfig = {
        field_type: 'textfield',
        label: 'Test',
        slug: 'test',
      };

      // Act & Assert
      const handler = new FieldHandler();
      handler.setClient(mockClient);

      await expect(
        handler.execute({
          operation: 'create',
          tableId: '', // Empty tableId
          fieldConfig,
        }),
      ).rejects.toThrow(/tableId.*required/i);
    });

    it('should reject update without fieldId', async () => {
      // CONTRACT: fieldId is mandatory for update operations

      // Arrange
      const { FieldHandler } = await import('../../../src/operations/field-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';

      // Act & Assert
      const handler = new FieldHandler();
      handler.setClient(mockClient);

      await expect(
        handler.execute({
          operation: 'update',
          tableId,
          fieldId: '', // Empty fieldId
          updates: { label: 'Test' },
        }),
      ).rejects.toThrow(/fieldId.*required/i);
    });

    it('should reject update without updates object', async () => {
      // CONTRACT: updates parameter is mandatory for update operations

      // Arrange
      const { FieldHandler } = await import('../../../src/operations/field-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';
      const fieldId = 'field_123';

      // Act & Assert
      const handler = new FieldHandler();
      handler.setClient(mockClient);

      await expect(
        handler.execute({
          operation: 'update',
          tableId,
          fieldId,
          // Missing updates parameter
        } as any),
      ).rejects.toThrow(/updates.*required/i);
    });
  });

  describe('FIELD-007: Error handling (API errors)', () => {
    it('should handle 401 authentication errors', async () => {
      // CONTRACT: Propagate authentication errors with context

      // Arrange
      const { FieldHandler } = await import('../../../src/operations/field-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';
      const fieldConfig = {
        field_type: 'textfield',
        label: 'Test',
        slug: 'test',
      };

      vi.mocked(mockClient.addField).mockRejectedValue(new Error('Unauthorized: Invalid API key'));

      // Act & Assert
      const handler = new FieldHandler();
      handler.setClient(mockClient);

      await expect(
        handler.execute({
          operation: 'create',
          tableId,
          fieldConfig,
          dryRun: false,
        }),
      ).rejects.toThrow(/unauthorized/i);
    });

    it('should handle 404 table not found errors', async () => {
      // CONTRACT: Clear error when table does not exist

      // Arrange
      const { FieldHandler } = await import('../../../src/operations/field-handler.js');
      const tableId = 'nonexistent-table-id';
      const fieldConfig = {
        field_type: 'textfield',
        label: 'Test',
        slug: 'test',
      };

      vi.mocked(mockClient.addField).mockRejectedValue(new Error('Table not found'));

      // Act & Assert
      const handler = new FieldHandler();
      handler.setClient(mockClient);

      await expect(
        handler.execute({
          operation: 'create',
          tableId,
          fieldConfig,
          dryRun: false,
        }),
      ).rejects.toThrow(/table.*not.*found/i);
    });

    it('should handle 400 validation errors from API', async () => {
      // CONTRACT: Propagate SmartSuite validation errors
      // EDGE CASE: API-side validation (slug already exists, etc.)

      // Arrange
      const { FieldHandler } = await import('../../../src/operations/field-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';
      const fieldConfig = {
        field_type: 'textfield',
        label: 'Test',
        slug: 'existing_slug', // Already exists
      };

      vi.mocked(mockClient.addField).mockRejectedValue(
        new Error('Bad Request: Field slug already exists'),
      );

      // Act & Assert
      const handler = new FieldHandler();
      handler.setClient(mockClient);

      await expect(
        handler.execute({
          operation: 'create',
          tableId,
          fieldConfig,
          dryRun: false,
        }),
      ).rejects.toThrow(/slug.*already.*exists/i);
    });

    it('should handle 500 server errors', async () => {
      // CONTRACT: Propagate server errors with context

      // Arrange
      const { FieldHandler } = await import('../../../src/operations/field-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';
      const fieldConfig = {
        field_type: 'textfield',
        label: 'Test',
        slug: 'test',
      };

      vi.mocked(mockClient.addField).mockRejectedValue(new Error('Internal Server Error'));

      // Act & Assert
      const handler = new FieldHandler();
      handler.setClient(mockClient);

      await expect(
        handler.execute({
          operation: 'create',
          tableId,
          fieldConfig,
          dryRun: false,
        }),
      ).rejects.toThrow(/internal.*server.*error/i);
    });
  });

  describe('FIELD-008: Supported field types validation', () => {
    it('should accept all valid SmartSuite field types', async () => {
      // CONTRACT: Support complete SmartSuite field type vocabulary
      // REFERENCE: Research report - known field types

      const { FieldHandler } = await import('../../../src/operations/field-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';
      const handler = new FieldHandler();
      handler.setClient(mockClient);

      const validFieldTypes = [
        'textfield',
        'textareafield',
        'richtextareafield',
        'numberfield',
        'datefield',
        'singleselectfield',
        'multipleselectfield',
        'checklistfield',
        'checkboxfield',
        'linkedrecordfield',
        'statusfield',
        'emailfield',
        'phonefield',
        'urlfield',
        'formulafield',
      ];

      for (const fieldType of validFieldTypes) {
        vi.mocked(mockClient.addField).mockResolvedValue({
          id: `field_${fieldType}`,
          field_type: fieldType,
          label: `Test ${fieldType}`,
          slug: `test_${fieldType}`,
        });

        // Act
        const result = await handler.execute({
          operation: 'create',
          tableId,
          fieldConfig: {
            field_type: fieldType,
            label: `Test ${fieldType}`,
            slug: `test_${fieldType}`,
          },
          dryRun: false,
        });

        // Assert
        const field = result.field as { field_type: string };
        expect(field.field_type).toBe(fieldType);
      }
    });
  });
});
