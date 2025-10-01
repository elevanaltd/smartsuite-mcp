// Phoenix Rebuild: Field Translation Layer (GREEN Phase)
// Contract: FIELD-001, FIELD-002, TABLE-001 - Field translation and table resolution
// TDD Phase: RED → GREEN → CRITICAL FIX (fail-fast translation)
// Status: Implementation for typo protection - critical-engineer mandated HIGH SEVERITY fix
// critical-engineer consulted for fail-fast translation requirement (architectural validation)
// Tests exist at: test/unit/core/field-translator.test.ts (RED state validated)

import type { SmartSuiteClient } from './smartsuite-client.js';

/**
 * Field schema structure from SmartSuite API
 */
interface FieldSchema {
  slug: string;
  label: string;
  field_type: string;
}

/**
 * Table schema structure from SmartSuite API
 */
interface TableSchema {
  id: string;
  name: string;
  structure: FieldSchema[];
}

/**
 * Application list item from workspace
 */
interface ApplicationListItem {
  id: string;
  name: string;
}

/**
 * Bidirectional field mapping cache
 */
interface FieldMappingCache {
  labelToSlug: Map<string, string>;
  slugToLabel: Map<string, string>;
}

/**
 * Field Translator
 * Translates between human-friendly field labels and SmartSuite API field slugs
 * Caches field mappings for performance
 */
export class FieldTranslator {
  private client: SmartSuiteClient;
  private fieldMappings: Map<string, FieldMappingCache>;
  private tableCache: Map<string, string>; // lowercase name → ID
  private tableNames: Map<string, string>; // ID → name
  private loadingPromises: Map<string, Promise<void>>; // For concurrent loading prevention

  constructor(client: SmartSuiteClient) {
    this.client = client;
    this.fieldMappings = new Map();
    this.tableCache = new Map();
    this.tableNames = new Map();
    this.loadingPromises = new Map();
  }

  /**
   * Check if field mappings are cached for a table
   */
  hasMappings(tableId: string): boolean {
    return this.fieldMappings.has(tableId);
  }

  /**
   * Load field mappings for a table from SmartSuite schema
   * Builds bidirectional mapping cache (label ↔ slug)
   */
  async loadMappingsForTable(tableId: string): Promise<void> {
    // Validate table ID
    if (!tableId || tableId.trim() === '') {
      throw new Error('Invalid table ID: cannot be empty');
    }

    // Return if already cached
    if (this.hasMappings(tableId)) {
      return;
    }

    // Check if already loading (prevent concurrent loads)
    const existingLoad = this.loadingPromises.get(tableId);
    if (existingLoad) {
      return existingLoad;
    }

    // Start loading
    const loadPromise = this._loadMappingsInternal(tableId);
    this.loadingPromises.set(tableId, loadPromise);

    try {
      await loadPromise;
    } finally {
      this.loadingPromises.delete(tableId);
    }
  }

  /**
   * Internal implementation of schema loading
   */
  private async _loadMappingsInternal(tableId: string): Promise<void> {
    try {
      const schema = (await this.client.getSchema(tableId)) as TableSchema;

      // Validate schema structure
      if (!schema.structure) {
        throw new Error(`Invalid schema: missing structure field for table ${tableId}`);
      }

      // Build bidirectional mapping
      const labelToSlug = new Map<string, string>();
      const slugToLabel = new Map<string, string>();

      for (const field of schema.structure) {
        // Handle duplicate labels - use first occurrence
        if (!labelToSlug.has(field.label)) {
          labelToSlug.set(field.label, field.slug);
        }
        slugToLabel.set(field.slug, field.label);
      }

      // Cache mappings
      this.fieldMappings.set(tableId, { labelToSlug, slugToLabel });

      // Cache table name for reverse lookup
      if (schema.name) {
        this.tableNames.set(tableId, schema.name);
      }
    } catch (error) {
      // Re-throw with context
      if (error instanceof Error) {
        if (error.message.includes('schema') || error.message.includes('structure')) {
          throw error;
        }
        // Wrap other errors
        throw new Error(`Failed to load schema for table ${tableId}: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Translate human-friendly field names to API field slugs
   * Auto-loads schema if not cached
   * @param tableId - SmartSuite table ID
   * @param humanFields - Object with human-readable field labels as keys
   * @param options - Translation options
   * @param options.ignoreUnknown - If false (default), throws error for unknown fields. If true, silently omits unknown fields.
   * @returns Object with field slugs as keys
   * @throws Error if unknown field encountered and ignoreUnknown is false
   */
  async translateFields(
    tableId: string,
    humanFields: Record<string, unknown>,
    options: { ignoreUnknown?: boolean } = {},
  ): Promise<Record<string, unknown>> {
    // Auto-load mappings if needed
    if (!this.hasMappings(tableId)) {
      await this.loadMappingsForTable(tableId);
    }

    const cache = this.fieldMappings.get(tableId);
    if (!cache) {
      throw new Error(`No field mappings found for table ${tableId}`);
    }

    const { ignoreUnknown = false } = options; // Default to strict mode
    const result: Record<string, unknown> = {};

    // Translate each field
    for (const [label, value] of Object.entries(humanFields)) {
      const slug = cache.labelToSlug.get(label);
      if (slug) {
        result[slug] = value;
      } else if (!ignoreUnknown) {
        // CRITICAL FIX: Fail-fast prevents typo-induced data loss
        const availableFields = Array.from(cache.labelToSlug.keys()).join(', ');
        throw new Error(
          `Unknown field label: "${label}" in table ${tableId}. ` +
            `Available fields: ${availableFields}`,
        );
      }
      // If ignoreUnknown is true, silently omit (backward compatible)
    }

    return result;
  }

  /**
   * Translate API field slugs back to human-friendly labels
   * Synchronous - requires mappings to be pre-loaded
   * @returns Object with field labels as keys
   */
  reverseTranslateFields(
    tableId: string,
    apiFields: Record<string, unknown>,
  ): Record<string, unknown> {
    const cache = this.fieldMappings.get(tableId);
    if (!cache) {
      throw new Error(
        `No field mappings found for table ${tableId}. Call loadMappingsForTable first.`,
      );
    }

    const result: Record<string, unknown> = {};

    // Translate each field
    for (const [slug, value] of Object.entries(apiFields)) {
      const label = cache.slugToLabel.get(slug);
      if (label) {
        result[label] = value;
      } else {
        // Unknown slugs preserved (e.g., system fields, new fields)
        result[slug] = value;
      }
    }

    return result;
  }

  /**
   * Resolve table display name to table ID
   * Supports case-insensitive matching
   * Caches results for performance
   * @returns Table ID
   */
  async resolveTableId(tableNameOrId: string): Promise<string> {
    // Check if already a table ID (24-char hex pattern)
    if (this.isTableId(tableNameOrId)) {
      return tableNameOrId;
    }

    // Check cache (case-insensitive)
    const lowerName = tableNameOrId.toLowerCase();
    const cachedId = this.tableCache.get(lowerName);
    if (cachedId) {
      return cachedId;
    }

    // Fetch workspace applications
    try {
      const applications = (await this.client.request({
        method: 'GET',
        endpoint: '/api/v1/applications',
      })) as ApplicationListItem[];

      // Build cache
      for (const app of applications) {
        this.tableCache.set(app.name.toLowerCase(), app.id);
        this.tableNames.set(app.id, app.name);
      }

      // Try again with populated cache
      const resolvedId = this.tableCache.get(lowerName);
      if (resolvedId) {
        return resolvedId;
      }

      // Not found
      throw new Error(`Unknown table: ${tableNameOrId} not found in workspace`);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('Unknown table')) {
          throw error;
        }
        // Wrap network/API errors
        throw new Error(`Failed to resolve table name: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get table display name from table ID
   * Requires table to be resolved or schema loaded first
   */
  getTableName(tableId: string): string {
    const name = this.tableNames.get(tableId);
    if (!name) {
      throw new Error(`Table name not found for ID: ${tableId}. Resolve table first.`);
    }
    return name;
  }

  /**
   * Check if string matches SmartSuite table ID pattern
   * Table IDs are hex strings (typically 24 chars, but support shorter for testing)
   */
  private isTableId(value: string): boolean {
    return /^[a-f0-9]{10,}$/i.test(value);
  }
}
