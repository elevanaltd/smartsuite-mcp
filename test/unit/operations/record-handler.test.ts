// Phoenix Test Contract: RECORD-001 to RECORD-006
// Contract: Record operations (create, update, delete) with dry-run safety
// Status: RED (tests written, implementation pending)
// Source: coordination/phoenix-rebuild/001-D3-PHOENIX-REBUILD-BLUEPRINT.md
// TDD Phase: RED → Implementation will follow

import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { SmartSuiteClient } from '../../../src/smartsuite-client.js';

describe('RecordHandler', () => {
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

  describe('RECORD-001: Create with dry_run returns preview', () => {
    it('should return preview without saving when dry_run is true', async () => {
      // CONTRACT: Dry-run must simulate operation without execution
      // CRITICAL: Default dry_run behavior must prevent accidental mutations

      // Arrange
      const { RecordHandler } = await import('../../../src/operations/record-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3'; // Primary test table
      const testData = {
        title: 'Test Record',
        status: 'active',
      };

      // Mock schema for validation
      vi.mocked(mockClient.getSchema).mockResolvedValue({
        structure: [
          { slug: 'title', label: 'Title', field_type: 'textfield' },
          { slug: 'status', label: 'Status', field_type: 'statusfield' },
        ],
      });

      // Mock connectivity check (listRecords for validation)
      vi.mocked(mockClient.listRecords).mockResolvedValue({
        items: [],
        total: 0,
        offset: 0,
        limit: 1,
      });

      // Act
      const handler = new RecordHandler();
      handler.setClient(mockClient);
      const result = await handler.execute({
        operation: 'create',
        tableId,
        data: testData,
        dryRun: true,
      });

      // Assert - Result structure
      expect(result).toBeDefined();
      expect(result).toHaveProperty('dryRun', true);
      expect(result).toHaveProperty('operation', 'create');
      expect(result).toHaveProperty('tableId', tableId);
      expect(result).toHaveProperty('validated');

      // Assert - Preview data included
      expect(result).toHaveProperty('preview');
      expect(result.preview).toEqual(testData);

      // Assert - No actual API call made
      expect(mockClient.createRecord).not.toHaveBeenCalled();
    });

    it('should validate field formats during dry-run', async () => {
      // CONTRACT: RECORD-005 - Field format validation (especially checklists)
      // CRITICAL: SmartDoc format required for rich text fields

      // Arrange
      const { RecordHandler } = await import('../../../src/operations/record-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';

      // Mock schema with rich text field
      vi.mocked(mockClient.getSchema).mockResolvedValue({
        structure: [
          { slug: 'description', label: 'Description', field_type: 'richtextareafield' },
        ],
      });

      vi.mocked(mockClient.listRecords).mockResolvedValue({
        items: [],
        total: 0,
        offset: 0,
        limit: 1,
      });

      // Act - Plain string for rich text field (WRONG)
      const handler = new RecordHandler();
      handler.setClient(mockClient);
      const result = await handler.execute({
        operation: 'create',
        tableId,
        data: {
          description: 'Plain string instead of SmartDoc', // WRONG format
        },
        dryRun: true,
      });

      // Assert - Should detect format error
      expect(result).toHaveProperty('validated', false);
      expect(result).toHaveProperty('errors');
      expect(Array.isArray(result.errors) && result.errors.some((e: string) => /SmartDoc|rich text|format/i.test(e))).toBe(true);
    });

    it('should validate linked records are arrays', async () => {
      // CONTRACT: RECORD-006 - Linked records handled as arrays
      // CRITICAL: Even single values must be arrays (silent failure prevention)

      // Arrange
      const { RecordHandler } = await import('../../../src/operations/record-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';

      // Mock schema with linked record field
      vi.mocked(mockClient.getSchema).mockResolvedValue({
        structure: [
          { slug: 'project_id', label: 'Project', field_type: 'linkedrecordfield' },
        ],
      });

      vi.mocked(mockClient.listRecords).mockResolvedValue({
        items: [],
        total: 0,
        offset: 0,
        limit: 1,
      });

      // Act - String instead of array (WRONG)
      const handler = new RecordHandler();
      handler.setClient(mockClient);
      const result = await handler.execute({
        operation: 'create',
        tableId,
        data: {
          project_id: '68a8ff5237fde0bf797c05b3', // WRONG: should be array
        },
        dryRun: true,
      });

      // Assert - Should detect format error
      expect(result).toHaveProperty('validated', false);
      expect(result).toHaveProperty('errors');
      expect(Array.isArray(result.errors) && result.errors.some((e: string) => /array|linked record/i.test(e))).toBe(true);
    });
  });

  describe('RECORD-002: Create with execute saves to SmartSuite', () => {
    it('should save record when dryRun is false', async () => {
      // CONTRACT: Execute mode must perform actual API call
      // CRITICAL: Must validate before execution (no direct execution without dry-run)

      // Arrange
      const { RecordHandler } = await import('../../../src/operations/record-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';
      const testData = {
        title: 'Real Record',
        status: 'active',
      };
      const createdRecord = {
        id: 'new-record-123',
        ...testData,
        created_at: '2025-10-01T00:00:00Z',
      };

      // Mock successful creation
      vi.mocked(mockClient.createRecord).mockResolvedValue(createdRecord);

      // Act
      const handler = new RecordHandler();
      handler.setClient(mockClient);
      const result = await handler.execute({
        operation: 'create',
        tableId,
        data: testData,
        dryRun: false,
        validated: true, // Simulating prior validation
      });

      // Assert
      expect(result).toBeDefined();
      expect(result).toHaveProperty('id', 'new-record-123');
      expect(result).toHaveProperty('title', 'Real Record');
      expect(mockClient.createRecord).toHaveBeenCalledWith(tableId, testData);
    });

    it('should execute operation without prior validation (stateless MCP)', async () => {
      // CONTRACT UPDATE: Validation gate removed per UX research
      // Reference: coordination/reports/851-REPORT-MCP-TOOL-UX-INVESTIGATION.md
      // RATIONALE: MCP protocol is stateless - validation state cannot persist
      // SAFETY: Format validation still available via optional dry-run preview

      // Arrange
      const { RecordHandler } = await import('../../../src/operations/record-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';
      const testData = { title: 'Direct Execution Test' };
      const createdRecord = {
        id: 'direct-exec-123',
        ...testData,
        created_at: '2025-10-07T00:00:00Z',
      };

      // Mock successful creation
      vi.mocked(mockClient.createRecord).mockResolvedValue(createdRecord);

      // Act - Execute without validated flag
      const handler = new RecordHandler();
      handler.setClient(mockClient);
      const result = await handler.execute({
        operation: 'create',
        tableId,
        data: testData,
        dryRun: false,
        // No validated flag - should execute directly
      });

      // Assert - Operation executes successfully
      expect(result).toHaveProperty('id', 'direct-exec-123');
      expect(mockClient.createRecord).toHaveBeenCalledWith(tableId, testData);
    });
  });

  describe('RECORD-003: Update modifies correct fields', () => {
    it('should update record when dryRun is false', async () => {
      // CONTRACT: Update operation modifies existing records

      // Arrange
      const { RecordHandler } = await import('../../../src/operations/record-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';
      const recordId = 'existing-record-123';
      const updateData = {
        title: 'Updated Title',
        status: 'completed',
      };
      const updatedRecord = {
        id: recordId,
        ...updateData,
        updated_at: '2025-10-01T00:00:00Z',
      };

      // Mock successful update
      vi.mocked(mockClient.updateRecord).mockResolvedValue(updatedRecord);

      // Act
      const handler = new RecordHandler();
      handler.setClient(mockClient);
      const result = await handler.execute({
        operation: 'update',
        tableId,
        recordId,
        data: updateData,
        dryRun: false,
        validated: true,
      });

      // Assert
      expect(result).toHaveProperty('id', recordId);
      expect(result).toHaveProperty('title', 'Updated Title');
      expect(mockClient.updateRecord).toHaveBeenCalledWith(tableId, recordId, updateData);
    });

    it('should preview update in dry-run mode', async () => {
      // CONTRACT: Dry-run update shows preview without execution

      // Arrange
      const { RecordHandler } = await import('../../../src/operations/record-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';
      const recordId = 'existing-record-123';
      const updateData = { title: 'Preview Update' };

      // Mock schema and connectivity
      vi.mocked(mockClient.getSchema).mockResolvedValue({
        structure: [
          { slug: 'title', label: 'Title', field_type: 'textfield' },
        ],
      });
      vi.mocked(mockClient.listRecords).mockResolvedValue({
        items: [],
        total: 0,
        offset: 0,
        limit: 1,
      });

      // Act
      const handler = new RecordHandler();
      handler.setClient(mockClient);
      const result = await handler.execute({
        operation: 'update',
        tableId,
        recordId,
        data: updateData,
        dryRun: true,
      });

      // Assert
      expect(result).toHaveProperty('dryRun', true);
      expect(result).toHaveProperty('operation', 'update');
      expect(result).toHaveProperty('recordId', recordId);
      expect(mockClient.updateRecord).not.toHaveBeenCalled();
    });
  });

  describe('RECORD-004: Delete removes records', () => {
    it('should delete record when dryRun is false', async () => {
      // CONTRACT: Delete operation removes records from SmartSuite

      // Arrange
      const { RecordHandler } = await import('../../../src/operations/record-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';
      const recordId = 'record-to-delete-123';

      // Mock successful deletion
      vi.mocked(mockClient.deleteRecord).mockResolvedValue(undefined);

      // Act
      const handler = new RecordHandler();
      handler.setClient(mockClient);
      const result = await handler.execute({
        operation: 'delete',
        tableId,
        recordId,
        dryRun: false,
        validated: true,
      });

      // Assert
      expect(result).toHaveProperty('deleted', true);
      expect(result).toHaveProperty('recordId', recordId);
      expect(mockClient.deleteRecord).toHaveBeenCalledWith(tableId, recordId);
    });

    it('should preview delete in dry-run mode', async () => {
      // CONTRACT: Dry-run delete shows preview without execution

      // Arrange
      const { RecordHandler } = await import('../../../src/operations/record-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';
      const recordId = 'record-to-preview-delete-123';

      // Mock connectivity check
      vi.mocked(mockClient.listRecords).mockResolvedValue({
        items: [],
        total: 0,
        offset: 0,
        limit: 1,
      });

      // Act
      const handler = new RecordHandler();
      handler.setClient(mockClient);
      const result = await handler.execute({
        operation: 'delete',
        tableId,
        recordId,
        dryRun: true,
      });

      // Assert
      expect(result).toHaveProperty('dryRun', true);
      expect(result).toHaveProperty('operation', 'delete');
      expect(result).toHaveProperty('recordId', recordId);
      expect(mockClient.deleteRecord).not.toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should throw error for invalid table ID', async () => {
      // CONTRACT: Fail fast for non-existent tables

      // Arrange
      const { RecordHandler } = await import('../../../src/operations/record-handler.js');
      const invalidTableId = '';

      // Act & Assert
      const handler = new RecordHandler();
      handler.setClient(mockClient);
      await expect(
        handler.execute({
          operation: 'create',
          tableId: invalidTableId,
          data: { title: 'Test' },
          dryRun: true,
        }),
      ).rejects.toThrow(/invalid.*table/i);
    });

    it('should throw error for missing record ID on update', async () => {
      // CONTRACT: Update requires record ID

      // Arrange
      const { RecordHandler } = await import('../../../src/operations/record-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';

      // Act & Assert
      const handler = new RecordHandler();
      handler.setClient(mockClient);
      await expect(
        handler.execute({
          operation: 'update',
          tableId,
          // recordId missing
          data: { title: 'Test' },
          dryRun: true,
        }),
      ).rejects.toThrow(/record.*id.*required/i);
    });

    it('should throw error for missing record ID on delete', async () => {
      // CONTRACT: Delete requires record ID

      // Arrange
      const { RecordHandler } = await import('../../../src/operations/record-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';

      // Act & Assert
      const handler = new RecordHandler();
      handler.setClient(mockClient);
      await expect(
        handler.execute({
          operation: 'delete',
          tableId,
          // recordId missing
          dryRun: true,
        }),
      ).rejects.toThrow(/record.*id.*required/i);
    });
  });
});
