// TEST-FIRST-BYPASS: Test exists at test/unit/operations/schema-handler.test.ts (12 failing tests)
// Hook pattern needs update to check test/unit/operations/ hierarchy
// Phoenix Rebuild: SchemaHandler Implementation (GREEN Phase)
// Contract: SCHEMA-001 to SCHEMA-004 - Schema retrieval with output formatting
// TDD Phase: RED → GREEN (minimal code to pass tests)
// Source: archive/old-staging/src/tools/schema.ts (pattern reference)

import type { SmartSuiteClient } from '../core/smartsuite-client.js';

/**
 * Schema handler options
 */
export interface SchemaHandlerOptions {
  tableId: string;
  outputMode?: 'summary' | 'fields' | 'detailed';
}

/**
 * Schema handler for table structure retrieval
 * Simpler than RecordHandler - read-only operations only
 */
export class SchemaHandler {
  private client?: SmartSuiteClient;

  /**
   * Set SmartSuite client instance
   */
  setClient(client: SmartSuiteClient): void {
    this.client = client;
  }

  /**
   * Execute schema retrieval operation
   */
  async execute(options: SchemaHandlerOptions): Promise<unknown> {
    // Validate client is set
    if (!this.client) {
      throw new Error('SmartSuite client not set. Call setClient() first.');
    }

    // Validate table ID
    const { tableId, outputMode = 'summary' } = options;
    if (!tableId || tableId.trim() === '') {
      throw new Error('Table ID is required and cannot be empty');
    }

    // Validate output mode
    const validModes = ['summary', 'fields', 'detailed'];
    if (!validModes.includes(outputMode)) {
      throw new Error(
        'Invalid output mode "' + outputMode + '". Must be one of: ' + validModes.join(', '),
      );
    }

    // Retrieve schema from SmartSuite API
    // This is a direct passthrough - SmartSuiteClient handles auth and errors
    let schema: unknown;
    try {
      schema = await this.client.getSchema(tableId);
    } catch (error) {
      // Propagate errors with clear messages
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to retrieve schema: ${String(error)}`);
    }

    // Validate schema format
    if (!schema || typeof schema !== 'object') {
      throw new Error('Invalid schema format received from API');
    }

    const schemaObj = schema as Record<string, unknown>;
    if (!schemaObj.id || !schemaObj.name) {
      throw new Error('Invalid schema format: missing id or name');
    }

    // Transform output based on mode
    return this.transformOutput(schemaObj, outputMode);
  }

  /**
   * Transform schema output based on requested mode
   */
  private transformOutput(
    schema: Record<string, unknown>,
    mode: 'summary' | 'fields' | 'detailed',
  ): unknown {
    // Detailed mode returns full schema as-is
    if (mode === 'detailed') {
      return schema;
    }

    // Extract structure for summary/fields modes
    const structure = schema.structure;
    if (!Array.isArray(structure)) {
      // Fallback to full schema if structure missing
      return schema;
    }

    // Summary mode: condensed field information
    if (mode === 'summary') {
      return this.generateSummary(schema, structure);
    }

    // Fields mode: detailed field list
    if (mode === 'fields') {
      return this.generateFields(schema, structure);
    }

    // Should never reach here due to validation
    throw new Error(`Unsupported output mode: ${mode}`);
  }

  /**
   * Generate summary output (field counts and types)
   */
  private generateSummary(
    schema: Record<string, unknown>,
    structure: Array<Record<string, unknown>>,
  ): unknown {
    // Count field types
    const fieldTypes: Record<string, number> = {};
    for (const field of structure) {
      const fieldType = field.field_type as string;
      fieldTypes[fieldType] = (fieldTypes[fieldType] ?? 0) + 1;
    }

    return {
      id: schema.id,
      name: schema.name,
      field_count: structure.length,
      field_types: fieldTypes,
    };
  }

  /**
   * Generate fields output (detailed field list without full params)
   */
  private generateFields(
    schema: Record<string, unknown>,
    structure: Array<Record<string, unknown>>,
  ): unknown {
    // Extract essential field information
    const fields = structure.map((field) => {
      const params = field.params as Record<string, unknown> | undefined;

      return {
        slug: field.slug,
        label: field.label,
        field_type: field.field_type,
        required: params?.required ?? false,
      };
    });

    return {
      id: schema.id,
      name: schema.name,
      field_count: structure.length,
      fields,
    };
  }
}
