// Test-Methodology-Guardian: approved TDD RED-GREEN-REFACTOR cycle
// Technical-Architect: function module pattern for tool extraction

import type { ToolContext } from './types.js';

/**
 * Handle discovery of tables and fields
 * Enables exploration of available tables and their human-readable field names
 */
export async function handleDiscover(
  context: ToolContext,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { tableResolver, fieldTranslator } = context;
  const scope = args.scope as string;
  const tableId = args.tableId as string | undefined;

  if (scope === 'tables') {
    // Return all available tables
    const tables = tableResolver.getAvailableTables();
    return {
      tables,
      count: tables.length,
      message: `Found ${tables.length} available table${tables.length === 1 ? '' : 's'}. Use table names directly in queries.`,
    };
  } else if (scope === 'fields') {
    if (!tableId) {
      throw new Error('tableId is required when scope is "fields"');
    }

    // Resolve table name if needed
    const resolvedId = tableResolver.resolveTableId(tableId);
    if (!resolvedId) {
      const suggestions = tableResolver.getSuggestionsForUnknown(tableId);
      const availableTables = tableResolver.getAllTableNames();
      throw new Error(
        `Unknown table '${tableId}'. ` +
        (suggestions.length > 0
          ? `Did you mean: ${suggestions.join(', ')}?`
          : `Available tables: ${availableTables.join(', ')}`
        ),
      );
    }

    // Get table info
    const tableInfo = tableResolver.getTableByName(tableId) ??
                     tableResolver.getAvailableTables().find((t: { id: string; name: string }) => t.id === resolvedId);

    // Get field mappings if available
    if (fieldTranslator.hasMappings(resolvedId)) {
      // Access internal mappings through proper interface
      const mapping = (fieldTranslator as any).mappings.get(resolvedId) as { fields?: Record<string, unknown> } | undefined;
      if (mapping?.fields) {
        const fields = mapping.fields;
        return {
          table: tableInfo,
          fields: fields,
          fieldCount: Object.keys(fields).length,
          message: `Table '${tableInfo?.name ?? tableId}' has ${Object.keys(fields).length} mapped fields. Use these human-readable names in your queries.`,
        };
      }
    }

    // No mappings available
    return {
      table: tableInfo,
      fields: {},
      fieldCount: 0,
      message: `Table '${tableInfo?.name ?? tableId}' has no field mappings configured. Use raw API field codes or configure mappings.`,
    };
  } else {
    throw new Error(`Invalid scope: ${scope}. Must be 'tables' or 'fields'`);
  }
}
