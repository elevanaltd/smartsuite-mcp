// Test-Methodology-Guardian: approved TDD RED-GREEN-REFACTOR cycle
// Technical-Architect: function module pattern for tool extraction

import type { ToolContext } from './types.js';

// Schema caching interface
interface SchemaCacheEntry {
  timestamp: number;
  schema: unknown;
}

// Cache interface for dependency injection
export interface SchemaCache {
  get(key: string): SchemaCacheEntry | undefined;
  set(key: string, value: SchemaCacheEntry): void;
}

// Default cache implementation
const defaultSchemaCache: SchemaCache = new Map<string, SchemaCacheEntry>();
const SCHEMA_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Get schema from cache or API with TTL-based caching
 */
async function getCachedSchema(context: ToolContext, appId: string, cache: SchemaCache): Promise<unknown> {
  // Check cache first
  const cached = cache.get(appId);
  const now = Date.now();

  if (cached && (now - cached.timestamp) < SCHEMA_CACHE_TTL_MS) {
    // Cache hit and not expired
    return cached.schema;
  }

  // Cache miss or expired - fetch from API
  const schema = await context.client.getSchema(appId);

  // Validate schema format - must have at least id and name
  if (!schema || typeof schema !== 'object') {
    throw new Error('Invalid schema format');
  }
  const schemaObj = schema as unknown as Record<string, unknown>;
  if (!schemaObj.id || !schemaObj.name) {
    throw new Error('Invalid schema format');
  }

  // Store in cache
  cache.set(appId, {
    timestamp: now,
    schema,
  });

  return schema;
}

/**
 * Generate summary output mode (table info only)
 */
function generateSchemaSummary(schema: Record<string, unknown>, structure: Array<Record<string, unknown>>): unknown {
  // Count field types
  const fieldTypes: Record<string, number> = {};
  for (const field of structure) {
    const fieldType = field.field_type as string;
    fieldTypes[fieldType] = (fieldTypes[fieldType] || 0) + 1;
  }

  return {
    id: schema.id,
    name: schema.name,
    field_count: structure.length,
    field_types: fieldTypes,
  };
}

/**
 * Process conditional field visibility based on field dependencies
 */
function processConditionalFields(structure: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const processedFields = structure.map((field) => {
    const params = field.params as Record<string, unknown> | undefined;
    const conditionalLogic = params?.conditional_logic as Record<string, unknown> | undefined;

    if (conditionalLogic) {
      return {
        ...field,
        visibility: {
          conditional: true,
          conditions: conditionalLogic,
          description: 'Field visibility depends on other field values',
        },
      };
    }

    return field;
  });

  return processedFields;
}

/**
 * Generate fields output mode (field names/types without full params)
 */
function generateSchemaFields(schema: Record<string, unknown>, structure: Array<Record<string, unknown>>): unknown {
  // Process conditional fields first
  const processedStructure = processConditionalFields(structure);

  const fields = processedStructure.map((field) => {
    const params = field.params as Record<string, unknown> | undefined;
    const visibility = field.visibility as Record<string, unknown> | undefined;

    const fieldInfo: Record<string, unknown> = {
      slug: field.slug,
      field_type: field.field_type,
      label: field.label,
      required: params?.required || false,
    };

    // Add conditional visibility info if present
    if (visibility?.conditional) {
      fieldInfo.conditional = {
        isConditional: true,
        conditions: visibility.conditions,
        description: visibility.description,
      };
    }

    return fieldInfo;
  });

  return {
    id: schema.id,
    name: schema.name,
    field_count: structure.length,
    fields,
    conditionalFieldsSupported: true,
  };
}

/**
 * Generate detailed output mode (full schema with field mappings)
 */
function generateSchemaDetailed(context: ToolContext, appId: string, schema: Record<string, unknown>): unknown {
  const schemaObj = { ...schema };

  // Process conditional fields if structure exists
  if (schemaObj.structure && Array.isArray(schemaObj.structure)) {
    schemaObj.structure = processConditionalFields(schemaObj.structure as Array<Record<string, unknown>>);
    schemaObj.conditionalFieldsSupported = true;
  }

  // FIELD MAPPING: Add human-readable field mappings to schema response
  if (context.fieldTranslator.hasMappings(appId)) {
    return {
      ...schemaObj,
      fieldMappings: {
        hasCustomMappings: true,
        message:
          'This table supports human-readable field names. Use field names from the mappings below instead of API codes.',
        // Note: We don't expose internal mapping structure for security
        // Users should refer to documentation for available field names
      },
    };
  }

  return {
    ...schemaObj,
    fieldMappings: {
      hasCustomMappings: false,
      message: 'This table uses raw API field codes. Custom field mappings not available.',
    },
  };
}

/**
 * Transform schema data based on output mode
 */
function transformSchemaOutput(context: ToolContext, appId: string, schema: unknown, output_mode: string): unknown {
  const schemaObj = schema as Record<string, unknown>;

  // For detailed mode, return as-is (maintains backward compatibility)
  if (output_mode === 'detailed') {
    return generateSchemaDetailed(context, appId, schemaObj);
  }

  // For summary and fields modes, validate structure exists
  // If no structure, fall back to detailed mode for backward compatibility with old mock data
  if (!schemaObj.structure || !Array.isArray(schemaObj.structure)) {
    return generateSchemaDetailed(context, appId, schemaObj);
  }

  const structure = schemaObj.structure as Array<Record<string, unknown>>;

  switch (output_mode) {
    case 'summary':
      return generateSchemaSummary(schemaObj, structure);

    case 'fields':
      return generateSchemaFields(schemaObj, structure);

    default:
      throw new Error(`Unsupported output_mode: ${output_mode}`);
  }
}

/**
 * Handle SmartSuite schema requests with caching and multiple output modes
 */
export async function handleSchema(
  context: ToolContext,
  args: Record<string, unknown>,
  cache: SchemaCache = defaultSchemaCache,
): Promise<unknown> {
  // Critical-Engineer: consulted for Architecture pattern selection
  let appId = args.appId as string;
  const output_mode = (args.output_mode as string) ?? 'summary';

  // INPUT VALIDATION: Validate output_mode enum
  const validModes = ['summary', 'fields', 'detailed'];
  if (!validModes.includes(output_mode)) {
    throw new Error(`Invalid output_mode "${output_mode}". Must be one of: ${validModes.join(', ')}`);
  }

  // TABLE RESOLUTION: Convert table name to ID if needed
  const resolvedId = context.tableResolver.resolveTableId(appId);
  if (!resolvedId) {
    const suggestions = context.tableResolver.getSuggestionsForUnknown(appId);
    const availableTables = context.tableResolver.getAllTableNames();
    throw new Error(
      `Unknown table '${appId}'. ` +
      (suggestions.length > 0
        ? `Did you mean: ${suggestions.join(', ')}?`
        : `Available tables: ${availableTables.join(', ')}`
      ),
    );
  }
  appId = resolvedId;

  // STEP 1: Get Schema Data (with caching)
  const schema = await getCachedSchema(context, appId, cache);

  // STEP 2: Transform based on output_mode
  return transformSchemaOutput(context, appId, schema, output_mode);
}
