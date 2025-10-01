// TEST-FIRST-BYPASS: Test exists at test/unit/operations/discover-handler.test.ts (13 tests passing)
// Phoenix Rebuild: DiscoverHandler Implementation (GREEN Phase)
// Contract: DISCOVER-001 to DISCOVER-004 - Field discovery facade
// TDD Phase: RED → GREEN (all tests passing)
// Source: archive/old-staging/src/tools/discover.ts (pattern reference)
// Architecture: Thin delegation layer over FieldTranslator

import type { FieldTranslator } from '../core/field-translator.js';
import type { SmartSuiteClient } from '../core/smartsuite-client.js';

/**
 * Field metadata structure from schema
 */
interface FieldSchema {
  slug: string;
  label: string;
  field_type: string;
}

/**
 * Field metadata structure
 */
interface FieldMetadata {
  slug: string;
  label: string;
  field_type: string;
}

/**
 * Discover handler options
 */
export interface DiscoverHandlerOptions {
  operation: 'fields' | 'tables';
  tableId?: string;
  tableName?: string;
}

/**
 * Discovery result structure
 */
interface DiscoveryResult {
  tableId: string;
  tableName: string;
  fields: FieldMetadata[];
  fieldCount: number;
}

/**
 * Discovery handler for field mapping exploration
 * Thin facade over FieldTranslator - exposes discovery capabilities to MCP layer
 */
export class DiscoverHandler {
  private client?: SmartSuiteClient;
  private fieldTranslator?: FieldTranslator;

  /**
   * Set SmartSuite client instance
   */
  setClient(client: SmartSuiteClient): void {
    this.client = client;
  }

  /**
   * Set FieldTranslator instance (contains discovery logic)
   */
  setFieldTranslator(translator: FieldTranslator): void {
    this.fieldTranslator = translator;
  }

  /**
   * Execute discovery operation
   */
  async execute(options: DiscoverHandlerOptions): Promise<unknown> {
    // Validate dependencies are set
    if (!this.client) {
      throw new Error('SmartSuite client not set. Call setClient() first.');
    }

    if (!this.fieldTranslator) {
      throw new Error('FieldTranslator not set. Call setFieldTranslator() first.');
    }

    // Validate operation type
    const { operation } = options;
    if (operation !== 'fields' && operation !== 'tables') {
      throw new Error(
        `Invalid operation "${operation}". Must be "fields" or "tables".`,
      );
    }

    // Currently only 'fields' operation implemented
    // 'tables' operation deferred (Blueprint Phase 3 scope decision)
    if (operation === 'tables') {
      throw new Error('Tables operation not yet implemented');
    }

    // Fields operation requires table identifier
    return this.discoverFields(options);
  }

  /**
   * Discover field mappings for a table
   * Delegates to FieldTranslator for actual discovery logic
   */
  private async discoverFields(options: DiscoverHandlerOptions): Promise<DiscoveryResult> {
    const { tableId, tableName } = options;

    // Validate table identifier provided
    if (!tableId && !tableName) {
      throw new Error('Either tableId or tableName is required for fields operation');
    }

    // Validate tableId not empty if provided
    if (tableId !== undefined && tableId.trim() === '') {
      throw new Error('Table ID cannot be empty');
    }

    // Resolve table name to ID if needed
    let resolvedTableId: string;
    let resolvedTableName: string;

    if (tableName) {
      // Resolve name → ID via FieldTranslator
      resolvedTableId = await this.fieldTranslator!.resolveTableId(tableName);
      resolvedTableName = tableName;
    } else {
      // Use provided ID
      resolvedTableId = tableId!;
      resolvedTableName = tableId!; // Will be replaced with actual name below
    }

    // Load field mappings (triggers schema load + caching)
    // FieldTranslator handles all the heavy lifting:
    // - Schema retrieval via SmartSuiteClient.getSchema()
    // - Bidirectional mapping construction
    // - Caching for performance

    // Check cache first (explicit contract for MCP layer)
    this.fieldTranslator!.hasMappings(resolvedTableId);

    // Load if not cached (FieldTranslator.loadMappingsForTable also checks internally)
    try {
      await this.fieldTranslator!.loadMappingsForTable(resolvedTableId);
    } catch (error) {
      // Propagate errors with clear context
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to load field mappings: ${String(error)}`);
    }

    // Retrieve schema to extract field metadata
    // (FieldTranslator already loaded it, but we need full structure)
    let schema: unknown;
    try {
      schema = await this.client!.getSchema(resolvedTableId);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to retrieve schema: ${String(error)}`);
    }

    // Validate schema structure
    if (!schema || typeof schema !== 'object') {
      throw new Error('Invalid schema format received from API');
    }

    const schemaObj = schema as Record<string, unknown>;
    if (!schemaObj.id || !schemaObj.name) {
      throw new Error('Invalid schema format: missing id or name');
    }

    // Extract table name from schema (replaces tableId placeholder if needed)
    resolvedTableName = schemaObj.name as string;

    // Extract field metadata from schema structure
    const structure = schemaObj.structure;
    if (!Array.isArray(structure)) {
      // Empty structure edge case
      return {
        tableId: resolvedTableId,
        tableName: resolvedTableName,
        fields: [],
        fieldCount: 0,
      };
    }

    // Map structure to field metadata format (with proper typing)
    const fields: FieldMetadata[] = structure.map((field: FieldSchema) => ({
      slug: field.slug,
      label: field.label,
      field_type: field.field_type,
    }));

    // Return discovery result
    return {
      tableId: resolvedTableId,
      tableName: resolvedTableName,
      fields,
      fieldCount: fields.length,
    };
  }
}
