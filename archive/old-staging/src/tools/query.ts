// Test-Methodology-Guardian: approved TDD RED-GREEN-REFACTOR cycle
// Technical-Architect: function module pattern for tool extraction

import type { SmartSuiteListResponse, SmartSuiteRecord } from '../smartsuite-client.js';

import type { ToolContext } from './types.js';

/**
 * Convert API options to list options format
 */
function toListOptions(options: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (options.filter) result.filter = options.filter;
  if (options.sort) result.sort = options.sort;
  if (options.limit) result.limit = options.limit;
  if (options.offset !== undefined) result.offset = options.offset;
  return result;
}

/**
 * Handle list response - supports both new API format and legacy test mocks
 */
function handleListResponse(
  appId: string,
  response: unknown,
  fieldTranslator: ToolContext['fieldTranslator'],
): Record<string, unknown> {
  // Check if it's an array (legacy test mock format)
  if (Array.isArray(response)) {
    // Convert legacy mock format to new pagination response
    const legacyResponse: SmartSuiteListResponse = {
      items: response as unknown as SmartSuiteRecord[],
      total: response.length,
      offset: 0,
      limit: response.length,
    };
    return formatMcpPaginationResponse(appId, legacyResponse, fieldTranslator);
  }

  // Handle new API format
  return formatMcpPaginationResponse(appId, response as SmartSuiteListResponse, fieldTranslator);
}

/**
 * Format SmartSuite API response for MCP protocol with cursor-based pagination
 */
function formatMcpPaginationResponse(
  appId: string,
  response: SmartSuiteListResponse,
  fieldTranslator: ToolContext['fieldTranslator'],
): Record<string, unknown> {
  // Handle undefined response items (for test compatibility)
  const items = response.items ?? [];

  // CONTEXT OPTIMIZATION: Limit default response size
  const MAX_ITEMS_FOR_MCP = 5; // Reduce from unlimited to 5 items by default
  const truncatedItems = items.slice(0, MAX_ITEMS_FOR_MCP);
  const wasTruncated = items.length > MAX_ITEMS_FOR_MCP;

  // Translate field names if mappings exist
  const translatedItems = fieldTranslator.hasMappings(appId)
    ? truncatedItems.map((record) =>
        fieldTranslator.apiToHuman(appId, record as Record<string, unknown>),
      )
    : truncatedItems;

  // Calculate next offset for cursor-based pagination
  const offset = response.offset ?? 0;
  const limit = response.limit ?? 200;
  const total = response.total ?? 0;
  const nextOffset = offset + limit;
  const hasMore = nextOffset < total;

  return {
    total,
    items: translatedItems,
    limit: wasTruncated ? MAX_ITEMS_FOR_MCP : limit,
    offset,
    ...(hasMore && { nextOffset }),
    ...(wasTruncated && {
      truncated: true,
      originalCount: items.length,
      message: `Response truncated to ${MAX_ITEMS_FOR_MCP} items to optimize context. Use limit parameter to control size.`,
    }),
  };
}

/**
 * Handle query operations for SmartSuite records
 */
export async function handleQuery(
  context: ToolContext,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { client, fieldTranslator, tableResolver } = context;

  // Note: Query operations are not mutations and don't need audit logging

  // FIELD TRANSLATION: Convert human-readable field names to API codes
  const operation = args.operation as string;
  let appId = args.appId as string;
  const recordId = args.recordId as string;
  const filters = args.filters as Record<string, unknown> | undefined;
  const sort = args.sort as Record<string, unknown> | undefined;
  const limit = args.limit as number | undefined;
  const offset = args.offset as number | undefined;

  // TABLE RESOLUTION: Convert table name to ID if needed
  const resolvedId = tableResolver.resolveTableId(appId);
  if (!resolvedId) {
    const suggestions = tableResolver.getSuggestionsForUnknown(appId);
    const availableTables = tableResolver.getAllTableNames();
    throw new Error(
      `Unknown table '${appId}'. ` +
      (suggestions.length > 0
        ? `Did you mean: ${suggestions.join(', ')}?`
        : `Available tables: ${availableTables.join(', ')}`
      ),
    );
  }
  appId = resolvedId;

  // Translate filters and sort options if field mappings exist
  const translatedFilters =
    filters && fieldTranslator.hasMappings(appId)
      ? fieldTranslator.humanToApi(appId, filters, false) // Non-strict mode for filters
      : filters;

  const translatedSort =
    sort && fieldTranslator.hasMappings(appId)
      ? fieldTranslator.humanToApi(appId, sort, false) // Non-strict mode for sort
      : sort;

  const options = {
    ...(translatedFilters && { filter: translatedFilters }),
    ...(translatedSort && { sort: translatedSort }),
    ...(limit && { limit }),
    ...(offset !== undefined && { offset }),
  };

  let result: unknown;
  switch (operation) {
    case 'list': {
      const listResponse = await client.listRecords(appId, toListOptions(options));
      // Handle both new API format and legacy test mocks
      result = handleListResponse(appId, listResponse, fieldTranslator);
      break;
    }
    case 'get':
      result = await client.getRecord(appId, recordId);
      break;
    case 'search': {
      // SIMPLE scope: search is just list with filter
      const searchResponse = await client.listRecords(appId, toListOptions(options));
      // Handle both new API format and legacy test mocks
      result = handleListResponse(appId, searchResponse, fieldTranslator);
      break;
    }
    case 'count': {
      const count = await client.countRecords(appId, toListOptions(options));
      result = { count };
      break;
    }
    default:
      throw new Error(`Unknown query operation: ${operation}`);
  }

  // FIELD TRANSLATION: Convert API response back to human-readable names for single record
  if (fieldTranslator.hasMappings(appId) && result && typeof result === 'object') {
    if ('count' in (result as Record<string, unknown>)) {
      // Handle count result - no field translation needed
      return result;
    } else if ('items' in (result as Record<string, unknown>)) {
      // Handle paginated list/search results - already processed by formatMcpPaginationResponse
      return result;
    } else {
      // Handle single record (get result)
      return fieldTranslator.apiToHuman(appId, result as Record<string, unknown>);
    }
  }

  return result;
}
