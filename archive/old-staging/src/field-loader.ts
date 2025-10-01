/**
 * Enhanced field mapping loader with multi-tier fallback
 * Supports: local > examples > defaults hierarchy
 */

// Context7: consulted for fs-extra -> MIGRATED to native fs/promises for MCP compatibility
// Context7: consulted for path
import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import * as path from 'path';

// Context7: consulted for js-yaml
import * as yaml from 'js-yaml';

interface FieldMapping {
  [fieldId: string]: string;
}

interface LoadResult {
  source: 'local' | 'example' | 'default' | 'none';
  mappings: Map<string, FieldMapping>;
  warnings: string[];
}

export class EnhancedFieldLoader {
  private mappings: Map<string, FieldMapping> = new Map();
  private loadedSources: Map<string, string> = new Map(); // Track where each mapping came from

  /**
   * Load field mappings with intelligent fallback
   * Priority: local > examples > defaults
   */
  async loadMappingsWithFallback(baseDir: string): Promise<LoadResult> {
    const warnings: string[] = [];
    const localDir = baseDir;
    const examplesDir = path.join(baseDir, 'examples');
    const defaultsDir = path.join(baseDir, 'defaults');

    // First, try to load local mappings
    const localMappings = await this.loadMappingsFromDir(localDir, '.yaml');

    if (localMappings.size > 0) {
      // User has local mappings - use them exclusively
      this.mappings = localMappings;
      return {
        source: 'local',
        mappings: this.mappings,
        warnings: [],
      };
    }

    // No local mappings found - check if this is a fresh setup
    const exampleMappings = await this.loadMappingsFromDir(examplesDir, '.example.yaml');

    if (exampleMappings.size > 0) {
      // Use examples as starting point
      this.mappings = exampleMappings;
      warnings.push(
        'No local field mappings found. Using examples as templates.',
        'Run: npm run setup:mappings to create your local configuration',
      );
      // Also check for any defaults to merge
      const defaultMappings = await this.loadMappingsFromDir(defaultsDir, '.yaml');
      if (defaultMappings.size > 0) {
        // Merge defaults (they have lowest priority)
        for (const [table, mapping] of defaultMappings) {
          if (!this.mappings.has(table)) {
            this.mappings.set(table, mapping);
          }
        }
      }

      return {
        source: 'example',
        mappings: this.mappings,
        warnings,
      };
    }

    // Last resort - check defaults only
    const defaultMappings = await this.loadMappingsFromDir(defaultsDir, '.yaml');
    if (defaultMappings.size > 0) {
      this.mappings = defaultMappings;
      warnings.push(
        'Using default field mappings only.',
        'Consider creating local mappings for your workspace.',
      );
      return {
        source: 'default',
        mappings: this.mappings,
        warnings,
      };
    }

    // No mappings found anywhere
    warnings.push(
      'No field mappings found in any location.',
      'Server will use raw API field codes.',
      'Run: npm run discover:fields to generate mappings from your SmartSuite workspace',
    );
    return {
      source: 'none',
      mappings: this.mappings,
      warnings,
    };
  }

  /**
   * Load all YAML files from a directory that match the suffix
   */
  private async loadMappingsFromDir(
    dir: string,
    suffix: string,
  ): Promise<Map<string, FieldMapping>> {
    const mappings = new Map<string, FieldMapping>();

    try {
      if (!existsSync(dir)) {
        return mappings;
      }

      const files = await fs.readdir(dir);
      const yamlFiles = files.filter(f => f.endsWith(suffix));

      // Load all files in parallel to avoid await-in-loop
      const loadPromises = yamlFiles.map(async (file) => {
        try {
          const filePath = path.join(dir, file);
          const content = await fs.readFile(filePath, 'utf8');
          // Use safeLoad to prevent code execution
          const mapping = yaml.load(content, { schema: yaml.JSON_SCHEMA }) as FieldMapping;

          // Extract table name from filename
          let tableName = file.replace(suffix, '');
          if (suffix === '.example.yaml') {
            tableName = tableName.replace('.example', '');
          }

          return { tableName, mapping, filePath };
        } catch (error) {
          // Use logger instead of console in production
          if (process.env.NODE_ENV !== 'test') {
            process.stderr.write(`Warning: Failed to load mapping from ${file}: ${String(error)}\n`);
          }
          return null;
        }
      });

      // Wait for all files to load
      const results = await Promise.all(loadPromises);

      // Process successful loads
      for (const result of results) {
        if (result) {
          mappings.set(result.tableName, result.mapping);
          this.loadedSources.set(result.tableName, result.filePath);
        }
      }
    } catch (error) {
      // Use logger instead of console in production
      if (process.env.NODE_ENV !== 'test') {
        process.stderr.write(`Warning: Failed to read directory ${dir}: ${String(error)}\n`);
      }
    }

    return mappings;
  }

  /**
   * Get the source path for a specific table's mappings
   */
  getSourcePath(tableName: string): string | undefined {
    return this.loadedSources.get(tableName);
  }

  /**
   * Get all loaded mappings
   */
  getMappings(): Map<string, FieldMapping> {
    return this.mappings;
  }
}
