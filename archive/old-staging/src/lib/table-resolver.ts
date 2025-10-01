// TEST-METHODOLOGY-GUARDIAN-APPROVED: TEST-METHODOLOGY-GUARDIAN-20250909-cabb9383
// Critical-Engineer: consulted for human-readable name resolution architecture
// Context7: consulted for fs-extra -> MIGRATED to native fs/promises for MCP compatibility
// Context7: consulted for fs
import { promises as fs } from 'fs';
import { existsSync } from 'fs';
// Context7: consulted for path
import * as path from 'path';

// Context7: consulted for yaml
import * as yaml from 'yaml';

export interface TableInfo {
  name: string;
  id: string;
  solutionId?: string;
}

export class TableResolver {
  private tableMap: Map<string, TableInfo> = new Map(); // normalized name → info
  private idToTable: Map<string, TableInfo> = new Map(); // id → info

  /**
   * Load table mappings from YAML files
   * FAIL FAST: Throws errors on conflicts or invalid data
   */
  async loadFromYaml(yamlPath: string): Promise<void> {
    try {
      const yamlContent = await fs.readFile(yamlPath, 'utf8');
      const mapping = yaml.parse(yamlContent) as Record<string, unknown>;

      const tableId = mapping.tableId as string | undefined;
      const tableName = mapping.tableName as string | undefined;
      const solutionId = mapping.solutionId as string | undefined;

      if (tableId && tableName) {
        const tableInfo: TableInfo = {
          name: tableName,
          id: tableId,
          ...(solutionId && { solutionId }),
        };

        const normalizedName = tableName.toLowerCase();

        // Check for name collision
        if (this.tableMap.has(normalizedName)) {
          const existing = this.tableMap.get(normalizedName)!;
          throw new Error(
            `Configuration Error: Duplicate table name '${tableName}' detected. ` +
            `Already loaded as '${existing.name}' with ID ${existing.id}. ` +
            `Cannot load from ${yamlPath}`,
          );
        }

        this.tableMap.set(normalizedName, tableInfo);
        this.idToTable.set(tableId, tableInfo);
      }
    } catch (error) {
      const errorMessage = `Failed to load YAML from ${yamlPath}: ${error instanceof Error ? error.message : String(error)}`;
      throw new Error(errorMessage);
    }
  }

  /**
   * Load all YAML mappings from a directory
   * FAIL FAST: Throws errors on conflicts or missing files
   */
  async loadFromMappings(mappingsDir: string): Promise<void> {
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

      // Load all mappings with collision detection
      const loadPromises = yamlFiles.map(file => {
        const filePath = path.join(mappingsDir, file);
        return this.loadFromYaml(filePath);
      });
      await Promise.all(loadPromises);
    } catch (error) {
      const errorMessage = `Failed to load mappings from directory ${mappingsDir}: ${error instanceof Error ? error.message : String(error)}`;
      throw new Error(errorMessage);
    }
  }

  /**
   * Resolve a table name or ID to a table ID
   * Returns the ID if already a valid hex ID, otherwise looks up the name
   */
  resolveTableId(nameOrId: string): string | null {
    // Check if it's already a 24-char hex ID
    if (/^[a-f0-9]{24}$/i.test(nameOrId)) {
      return nameOrId;
    }

    // Look up by normalized name
    const normalizedName = nameOrId.toLowerCase();
    const tableInfo = this.tableMap.get(normalizedName);
    return tableInfo ? tableInfo.id : null;
  }

  /**
   * Get all available tables
   */
  getAvailableTables(): TableInfo[] {
    return Array.from(this.tableMap.values());
  }

  /**
   * Get table info by name (case-insensitive)
   */
  getTableByName(name: string): TableInfo | null {
    const normalizedName = name.toLowerCase();
    return this.tableMap.get(normalizedName) ?? null;
  }

  /**
   * Get suggestions for an unknown table name
   * Simple implementation - returns tables with partial matches
   */
  getSuggestionsForUnknown(unknownName: string): string[] {
    const normalized = unknownName.toLowerCase();
    const suggestions: string[] = [];

    for (const [key, info] of this.tableMap) {
      if (key.includes(normalized) || normalized.includes(key)) {
        suggestions.push(info.name);
      }
    }

    return suggestions;
  }

  /**
   * Get all known table names for error messages
   */
  getAllTableNames(): string[] {
    return Array.from(this.tableMap.values()).map(info => info.name);
  }
}
