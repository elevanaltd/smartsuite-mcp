// Phoenix Rebuild: FieldHandler Implementation (GREEN Phase)
// Contract: FIELD-001 to FIELD-015 - Field management operations
// TDD Phase: RED → GREEN (minimal code to pass tests)
// TEST-FIRST-BYPASS: Test exists at test/unit/operations/field-handler.test.ts (23 failing tests)
// Hook needs update to check test/ directory
// Critical-Engineer: consulted for dryRun default behavior - verdict: must default to true for safety

import type { SmartSuiteClient } from '../smartsuite-client.js';

/**
 * Valid SmartSuite field types
 * Source: SmartSuite API documentation
 */
const VALID_FIELD_TYPES = [
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
] as const;

/**
 * Field configuration for creation
 */
export interface FieldConfig extends Record<string, unknown> {
  field_type: string;
  label: string;
  slug: string;
  params?: Record<string, unknown>;
}

/**
 * Field operation request context
 */
export interface FieldOperationRequest {
  operation: 'create' | 'update';
  tableId: string;
  fieldId?: string;
  fieldConfig?: FieldConfig;
  updates?: Record<string, unknown>;
  dryRun?: boolean;
}

/**
 * Field operation result
 */
export interface FieldOperationResult {
  operation: string;
  tableId: string;
  field?: unknown;
  preview?: unknown;
  dryRun?: boolean;
}

/**
 * FieldHandler - Minimal implementation for FIELD-001 to FIELD-015 contracts
 *
 * Architecture: FieldHandler → SmartSuiteClient → SmartSuite API
 *
 * Responsibilities:
 * - Validate field configurations (required parameters, field types)
 * - Prevent UUID corruption (reject "options" parameter for select fields)
 * - Support dry-run simulation (safety default)
 * - Delegate API communication to SmartSuiteClient
 */
export class FieldHandler {
  private client: SmartSuiteClient | null = null;

  /**
   * Set the SmartSuite client (allows test mocking)
   */
  setClient(client: SmartSuiteClient): void {
    this.client = client;
  }

  /**
   * Execute field operation based on context
   * Minimal implementation to satisfy test contracts
   */
  async execute(request: FieldOperationRequest): Promise<FieldOperationResult> {
    const { operation, tableId, fieldId, fieldConfig, updates, dryRun = true } = request;

    // Validate required parameters
    if (!tableId || typeof tableId !== 'string' || tableId.trim() === '') {
      throw new Error('Invalid table ID: tableId is required');
    }

    // Validate client initialization
    if (!this.client) {
      throw new Error('SmartSuiteClient not initialized');
    }

    // Route to appropriate operation
    if (operation === 'create') {
      return this.handleCreate(tableId, fieldConfig!, dryRun);
    } else if (operation === 'update') {
      return this.handleUpdate(tableId, fieldId!, updates!, dryRun);
    } else {
      throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Handle field creation
   */
  private async handleCreate(
    tableId: string,
    fieldConfig: FieldConfig,
    dryRun: boolean,
  ): Promise<FieldOperationResult> {
    // Validate required parameters
    this.validateFieldConfig(fieldConfig);

    // Dry-run simulation
    if (dryRun) {
      return {
        operation: 'create',
        tableId,
        dryRun: true,
        preview: fieldConfig,
      };
    }

    // Transform to SmartSuite API structure
    // Constitutional citation (line 102): EMPIRICAL_DEVELOPMENT - API contract requires nested structure
    const apiPayload = {
      field: {
        ...fieldConfig,
        is_new: true, // Required by API for new field creation
      },
      field_position: {
        prev_sibling_slug: '', // Empty string = add at beginning
      },
      auto_fill_structure_layout: true,
    };

    // Execute real API call with properly structured payload
    const result = await this.client!.addField(tableId, apiPayload);

    return {
      operation: 'create',
      tableId,
      field: result,
    };
  }

  /**
   * Handle field update
   */
  private async handleUpdate(
    tableId: string,
    fieldId: string,
    updates: Record<string, unknown>,
    dryRun: boolean,
  ): Promise<FieldOperationResult> {
    // Validate required parameters
    if (!fieldId || typeof fieldId !== 'string') {
      throw new Error('Invalid field ID: fieldId is required for update operations');
    }

    if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
      throw new Error('Invalid updates: updates object is required for update operations');
    }

    // CRITICAL: UUID corruption prevention
    this.preventUUIDCorruption(updates);

    // Dry-run simulation
    if (dryRun) {
      return {
        operation: 'update',
        tableId,
        dryRun: true,
        preview: updates,
      };
    }

    // Execute real API call
    const result = await this.client!.updateField(tableId, fieldId, updates);

    return {
      operation: 'update',
      tableId,
      field: result,
    };
  }

  /**
   * Validate field configuration for creation
   */
  private validateFieldConfig(config: FieldConfig): void {
    if (!config.field_type || typeof config.field_type !== 'string') {
      throw new Error('Invalid field configuration: field_type is required');
    }

    if (!config.label || typeof config.label !== 'string') {
      throw new Error('Invalid field configuration: label is required');
    }

    if (!config.slug || typeof config.slug !== 'string') {
      throw new Error('Invalid field configuration: slug is required');
    }

    // Validate field type
    if (!VALID_FIELD_TYPES.includes(config.field_type as (typeof VALID_FIELD_TYPES)[number])) {
      throw new Error(
        `Invalid field type: "${config.field_type}". Must be a valid SmartSuite field type.`,
      );
    }
  }

  /**
   * Prevent UUID corruption in select field updates
   * CRITICAL SAFETY: Using "options" instead of "choices" corrupts UUIDs
   */
  private preventUUIDCorruption(updates: Record<string, unknown>): void {
    // Recursively check for "options" parameter
    const hasOptionsParameter = this.hasOptionsKey(updates);

    if (hasOptionsParameter) {
      throw new Error(
        'Use "choices" not "options" for select fields - "options" corrupts UUIDs',
      );
    }
  }

  /**
   * Recursively check if object contains "options" key
   */
  private hasOptionsKey(obj: unknown): boolean {
    if (typeof obj !== 'object' || obj === null) {
      return false;
    }

    const record = obj as Record<string, unknown>;

    // Check direct properties
    if ('options' in record) {
      return true;
    }

    // Recursively check nested objects
    for (const value of Object.values(record)) {
      if (this.hasOptionsKey(value)) {
        return true;
      }
    }

    return false;
  }
}
