// MappingService: Centralized collision detection and mapping management
// TECHNICAL-ARCHITECT-APPROVED: TECHNICAL-ARCHITECT-20250909-9a54fa8a
// Critical-Engineer: consulted for collision detection architecture
// Context7: consulted for fs-extra -> MIGRATED to native fs/promises for MCP compatibility
import { promises as fs } from 'fs';
import { existsSync } from 'fs';
// Context7: consulted for path
import * as path from 'path';

// Context7: consulted for yaml
import * as yaml from 'yaml';

import { FieldTranslator } from './field-translator.js';
import { TableResolver } from './table-resolver.js';

interface MappingStats {
  tablesLoaded: number;
  totalFields: number;
  tables: string[];
}

/**
 * MappingService provides centralized loading with collision detection
 * Ensures no duplicate table or field names before populating translators
 * FAIL FAST: All-or-nothing loading - validation happens before population
 */
export class MappingService {
  private tableResolver: TableResolver;
  private fieldTranslator: FieldTranslator;
  private loadedTables: Set<string> = new Set();
  private fieldCount: number = 0;

  constructor() {
    this.tableResolver = new TableResolver();
    this.fieldTranslator = new FieldTranslator();
  }

  /**
   * Load all mappings from directory with comprehensive collision detection
   * ATOMIC: Either all mappings load successfully or none do
   */
  async loadAllMappings(mappingsDir: string): Promise<void> {
    try {
      if (!existsSync(mappingsDir)) {
        throw new Error(`Directory does not exist: ${mappingsDir}`);
      }

      const files = await fs.readdir(mappingsDir);
      // Exclude .example.yaml files to prevent duplicates in examples directory
      const yamlFiles = files.filter((f) =>
        (f.endsWith('.yaml') || f.endsWith('.yml')) &&
        !f.includes('.example.'),
      );

      if (yamlFiles.length === 0) {
        throw new Error(`No YAML mapping files found in directory: ${mappingsDir}`);
      }

      // First pass: validate all files before loading
      const validatedMappings: Array<{file: string, content: Record<string, unknown>}> = [];
      const tableNames: Map<string, string> = new Map(); // normalized name -> file

      // Read all files in parallel first
      const fileContents = await Promise.all(
        yamlFiles.map(async (file) => {
          const filePath = path.join(mappingsDir, file);
          const yamlContent = await fs.readFile(filePath, 'utf8');
          return { file, yamlContent };
        }),
      );

      // Then validate sequentially
      for (const { file, yamlContent } of fileContents) {
        const mapping = yaml.parse(yamlContent) as Record<string, unknown>;

        // Validate table ID format
        const tableId = mapping.tableId as string | undefined;
        const tableName = mapping.tableName as string | undefined;
        const fields = mapping.fields as Record<string, unknown> | undefined;

        if (tableId && !/^[a-f0-9]{24}$/i.test(tableId)) {
          throw new Error(`Invalid table ID '${tableId}' in ${file} - must be 24-char hex`);
        }

        // Check for table name collision
        if (tableName) {
          const normalized = tableName.toLowerCase();
          if (tableNames.has(normalized)) {
            throw new Error(
              `Configuration Error: Duplicate table name '${tableName}' detected. ` +
              `Already defined in ${tableNames.get(normalized)}. ` +
              `Cannot load from ${file}`,
            );
          }
          tableNames.set(normalized, file);
        }

        // Check for field name collisions within this table
        if (fields) {
          const fieldNames: Map<string, string> = new Map(); // normalized -> original
          for (const fieldName of Object.keys(fields)) {
            const normalized = fieldName.toLowerCase();
            if (fieldNames.has(normalized)) {
              throw new Error(
                `Configuration Error: Duplicate field name detected in ${file}. ` +
                `Field '${fieldName}' collides with '${fieldNames.get(normalized)}' ` +
                `(both normalize to '${normalized}')`,
              );
            }
            fieldNames.set(normalized, fieldName);
          }
        }

        validatedMappings.push({ file, content: mapping });
      }

      // Second pass: load validated mappings
      const tableLoadPromises: Promise<void>[] = [];
      const fieldLoadPromises: Promise<void>[] = [];

      for (const { file, content } of validatedMappings) {
        const filePath = path.join(mappingsDir, file);
        // Load into TableResolver
        const contentTableId = content.tableId as string | undefined;
        const contentTableName = content.tableName as string | undefined;
        const contentFields = content.fields as Record<string, unknown> | undefined;

        if (contentTableId && contentTableName) {
          tableLoadPromises.push(
            this.tableResolver.loadFromYaml(filePath).then(() => {
              this.loadedTables.add(contentTableName);
              return;
            }),
          );
        }

        // Load into FieldTranslator
        if (contentTableId && contentFields) {
          const fieldCount = Object.keys(contentFields).length;
          fieldLoadPromises.push(
            this.fieldTranslator.loadFromYaml(filePath).then(() => {
              this.fieldCount += fieldCount;
              return;
            }),
          );
        }
      }

      await Promise.all([...tableLoadPromises, ...fieldLoadPromises]);

    } catch (error) {
      // Reset on failure - atomic loading
      this.tableResolver = new TableResolver();
      this.fieldTranslator = new FieldTranslator();
      this.loadedTables.clear();
      this.fieldCount = 0;

      const errorMessage = `Failed to load mappings: ${error instanceof Error ? error.message : String(error)}`;
      throw new Error(errorMessage);
    }
  }

  /**
   * Get the TableResolver instance
   */
  getTableResolver(): TableResolver {
    return this.tableResolver;
  }

  /**
   * Get the FieldTranslator instance
   */
  getFieldTranslator(): FieldTranslator {
    return this.fieldTranslator;
  }

  /**
   * Get statistics about loaded mappings
   */
  getMappingStats(): MappingStats {
    return {
      tablesLoaded: this.loadedTables.size,
      totalFields: this.fieldCount,
      tables: Array.from(this.loadedTables),
    };
  }
}
