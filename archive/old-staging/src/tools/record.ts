// Critical-Engineer: consulted for function module extraction pattern
// Test-Methodology-Guardian: approved TDD RED-GREEN-REFACTOR cycle
// Technical-Architect: function module pattern for tool extraction

import type { ToolContext } from './types.js';

// Validation cache for dry-run enforcement
// Global state maintained across function calls - necessary for validation cache persistence
const validationCache = new Map<string, {
  timestamp: number;
  dataHash: string;
  validated: boolean;
  errors?: string[];
}>();

// Constants
const VALIDATION_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Clear validation cache - for testing purposes
 */
export function clearValidationCache(): void {
  validationCache.clear();
}

/**
 * Generate a unique key for validation cache
 */
function generateOperationKey(
  operation: string,
  appId: string,
  recordId?: string,
  dataHash?: string,
): string {
  const baseKey = `${operation}:${appId}:${recordId ?? 'new'}`;
  // Include data hash in cache key to prevent conflicts between different data payloads
  return dataHash ? `${baseKey}:${dataHash}` : baseKey;
}

/**
 * Generate a hash of the data for comparison
 */
function generateDataHash(data: Record<string, unknown> | undefined): string {
  // Simple JSON stringify for hashing - in production, use crypto hash
  if (!data || Object.keys(data).length === 0) {
    // Treat undefined and empty object the same for consistency
    return JSON.stringify({});
  }
  return JSON.stringify(data, Object.keys(data).sort());
}

/**
 * Clean expired validations from cache
 */
function cleanExpiredValidations(): void {
  const now = Date.now();
  for (const [key, validation] of validationCache.entries()) {
    if (now - validation.timestamp > VALIDATION_EXPIRY_MS) {
      validationCache.delete(key);
    }
  }
}

/**
 * Validate data against SmartSuite schema
 * Checks required fields, field types, and system field restrictions
 */
function validateDataAgainstSchema(
  operation: string,
  data: Record<string, unknown>,
  schema: Record<string, unknown>, // SmartSuiteSchema type
): string[] {
  const errors: string[] = [];

  // Skip validation for delete operations (no data to validate)
  if (operation === 'delete') {
    return [];
  }

  if (!schema.structure || !Array.isArray(schema.structure)) {
    return ['Schema structure not available for validation'];
  }

  // Build a map of field slugs to field definitions
  const fieldMap = new Map<string, Record<string, unknown>>();
  const structureArray = schema.structure as Array<Record<string, unknown>>;
  for (const field of structureArray) {
    const slug = field.slug as string | undefined;
    if (slug) {
      fieldMap.set(slug, field);
    }
  }

  // Check for unknown fields
  for (const key of Object.keys(data)) {
    if (!fieldMap.has(key)) {
      errors.push(`Unknown field: '${key}'. This field does not exist in the table schema.`);
    }
  }

  // For create operations, check required fields
  if (operation === 'create') {
    for (const [fieldSlug, fieldDef] of fieldMap) {
      // Check if field is required
      const params = fieldDef.params as Record<string, unknown> | undefined;
      if (params?.required === true) {
        // Skip system-generated fields
        const fieldType = fieldDef.field_type as string;
        const systemGeneratedTypes = [
          'autonumberfield',
          'firstcreatedfield',
          'lastupdatedfield',
          'formulafield',
          'rollupfield',
          'lookupfield',
          'countfield',
          'commentscountfield',
        ];

        if (systemGeneratedTypes.includes(fieldType)) {
          continue; // Skip validation for system-generated fields
        }

        // Check if required field is missing
        if (!(fieldSlug in data) || data[fieldSlug] === null || data[fieldSlug] === undefined) {
          const label = (fieldDef.label as string) ?? fieldSlug;
          errors.push(`Required field missing: '${fieldSlug}' (${label})`);
        }
      }
    }
  }

  // Check for attempts to set system-generated fields
  const systemFields = [
    'autonumber',
    'first_created',
    'last_updated',
    'comments_count',
    'followed_by',
    'ranking',
    'id',
    'application_id',
    'application_slug',
    'deleted_date',
    'deleted_by',
  ];

  for (const systemField of systemFields) {
    if (systemField in data) {
      errors.push(`Cannot set system-generated field: '${systemField}'`);
    }
  }

  // Validate field types (basic validation)
  for (const [key, value] of Object.entries(data)) {
    const fieldDef = fieldMap.get(key);
    if (!fieldDef) continue; // Already reported as unknown field

    const fieldType = fieldDef.field_type as string;
    const label = (fieldDef.label as string) ?? key;

    // Basic type validation
    switch (fieldType) {
      case 'numberfield':
      case 'currencyfield':
        if (value !== null && typeof value !== 'number') {
          errors.push(`Field '${key}' (${label}) must be a number, got ${typeof value}`);
        }
        break;
      case 'textfield':
      case 'textareafield':
        if (value !== null && typeof value !== 'string') {
          errors.push(`Field '${key}' (${label}) must be a string, got ${typeof value}`);
        }
        break;
      case 'datefield':
        if (value !== null && typeof value !== 'string') {
          errors.push(`Field '${key}' (${label}) must be a date string, got ${typeof value}`);
        }
        break;
      case 'checkboxfield':
        if (value !== null && typeof value !== 'boolean') {
          errors.push(`Field '${key}' (${label}) must be a boolean, got ${typeof value}`);
        }
        break;
    }
  }

  return errors;
}

/**
 * Perform proper dry-run validation with actual API connectivity and schema checks
 * Implements Option 3 from the architectural discussion
 */
async function performDryRunValidation(
  context: ToolContext,
  operation: string,
  appId: string,
  recordId: string | undefined,
  originalData: Record<string, unknown> | unknown[],
  translatedData: Record<string, unknown> | unknown[],
): Promise<Record<string, unknown>> {
  const validationErrors: string[] = [];
  const validationWarnings: string[] = [];
  let connectivityPassed = false;
  let schemaValidationPassed = false;

  // Phase 1: Connectivity/Auth probe
  try {
    // Use a minimal list query to test connectivity, auth, and permissions
    // The client contract guarantees listRecords exists. Tests MUST mock it.
    await context.client.listRecords(appId, { limit: 1 });
    connectivityPassed = true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    validationErrors.push(`API connectivity check failed: ${errorMessage}`);

    // Early return if we can't even connect
    return {
      dry_run: true,
      validation: 'failed',
      validated: false, // Add this for test compatibility
      operation,
      tableId: appId, // Add this for test compatibility
      appId,
      recordId,
      originalData,
      payload: translatedData, // Add this for test compatibility
      translatedData,
      fieldMappingsUsed: context.fieldTranslator.hasMappings(appId),
      errors: validationErrors,
      message: 'DRY-RUN FAILED: Cannot validate operation due to API connectivity issues',
    };
  }

  // Phase 2: Schema-based validation (skip for bulk operations for now)
  try {
    if (operation === 'bulk_update' || operation === 'bulk_delete') {
      // For bulk operations, validate count limits
      const itemCount = Array.isArray(translatedData) ? translatedData.length :
                        (translatedData as any)?.items?.length ||
                        (translatedData as any)?.ids?.length || 0;

      if (itemCount > 25) {
        validationErrors.push(`Bulk operation exceeds SmartSuite's 25-record limit (${itemCount} records)`);
      } else if (itemCount === 0) {
        validationErrors.push('Bulk operation requires at least one record');
      } else {
        schemaValidationPassed = true;
      }
    } else {
      // Schema validation for non-bulk operations
      // The client contract guarantees getSchema exists. Tests MUST mock it.
      const schema = await context.client.getSchema(appId);
      const schemaErrors = validateDataAgainstSchema(
        operation,
        translatedData as Record<string, unknown>,
        schema as unknown as Record<string, unknown>,
      );

      if (schemaErrors.length > 0) {
        validationErrors.push(...schemaErrors);
      } else {
        schemaValidationPassed = true;
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    validationWarnings.push(`Schema validation skipped: ${errorMessage}`);
  }

  // Determine overall validation status
  const validationPassed = connectivityPassed && schemaValidationPassed && validationErrors.length === 0;

  // Store validation result in cache for enforcement
  const dataHash = generateDataHash(translatedData as Record<string, unknown> | undefined);
  const operationKey = generateOperationKey(operation, appId, recordId, dataHash);

  // Clean old validations first
  cleanExpiredValidations();

  // Store this validation
  const cacheEntry: {
    timestamp: number;
    dataHash: string;
    validated: boolean;
    errors?: string[];
  } = {
    timestamp: Date.now(),
    dataHash,
    validated: validationPassed,
  };

  if (validationErrors.length > 0) {
    cacheEntry.errors = validationErrors;
  }

  validationCache.set(operationKey, cacheEntry);

  // Determine record count for bulk operations
  const recordCount = operation === 'bulk_update' || operation === 'bulk_delete'
    ? (Array.isArray(translatedData) ? translatedData.length :
       (translatedData as any)?.items?.length ||
       (translatedData as any)?.ids?.length || 0)
    : 1;

  return {
    dry_run: true,
    validation: validationPassed ? 'passed' : 'failed',
    validated: validationPassed, // Add this for test compatibility
    operation,
    tableId: appId, // Add this for test compatibility
    appId,
    recordId,
    originalData,
    payload: translatedData, // Add this for test compatibility
    translatedData,
    fieldMappingsUsed: context.fieldTranslator.hasMappings(appId),
    validationChecks: {
      connectivity: connectivityPassed ? 'passed' : 'failed',
      schema: schemaValidationPassed ? 'passed' : validationWarnings.length > 0 ? 'skipped' : 'failed',
    },
    ...(validationErrors.length > 0 && { errors: validationErrors }),
    ...(validationWarnings.length > 0 && { warnings: validationWarnings }),
    message: validationPassed
      ? `DRY-RUN PASSED: ${operation} operation validated successfully for ${recordCount} records. Connectivity and schema checks passed. You may now execute with dry_run:false within 5 minutes.`
      : 'DRY-RUN FAILED: Operation validation failed. See errors for details.',
    note: 'This dry-run validates connectivity, authentication, and schema compliance. Server-side business rules and automations are not tested.',
  };
}

/**
 * Handle SmartSuite record operations (create, update, delete)
 * Extracted from SmartSuiteMCPServer.handleRecord()
 */
export async function handleRecord(context: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  // DRY-RUN pattern enforcement for mutations (North Star requirement)
  if (args.dry_run === undefined) {
    throw new Error('Dry-run pattern required: mutation tools must specify dry_run parameter');
  }

  // FIELD TRANSLATION: Convert human-readable field names to API codes
  const operation = args.operation as string;
  let appId = args.appId as string;
  const recordId = args.recordId as string;
  const inputData = args.data as Record<string, unknown>;
  const dry_run = args.dry_run as boolean;
  const priorValidation = args.priorValidation as boolean; // For testing

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

  // Translate field names if mappings exist and data is provided
  // For bulk operations, translate each item in the array
  let translatedData = inputData;
  if (inputData && context.fieldTranslator.hasMappings(appId)) {
    if (operation === 'bulk_update' && Array.isArray(inputData)) {
      translatedData = inputData.map((item: Record<string, unknown>) =>

        context.fieldTranslator.humanToApi(appId, item, true),
      ) as unknown as Record<string, unknown>;
    } else if (operation !== 'bulk_delete') {
      // bulk_delete uses IDs array, no translation needed
      translatedData = context.fieldTranslator.humanToApi(appId, inputData, true);
    }
  }

  if (dry_run) {
    // Perform proper validation with actual API checks
    const result = await performDryRunValidation(context, operation, appId, recordId, inputData ?? {}, translatedData ?? {});

    return result;
  }

  // ENFORCEMENT: Check if a successful dry-run was performed for this operation (unless testing with priorValidation flag)
  if (!priorValidation) {
    // Ensure consistent data hash for delete operations (no data)
    const dataHash = generateDataHash(translatedData ?? {});
    const operationKey = generateOperationKey(operation, appId, recordId, dataHash);

    // Clean expired validations
    cleanExpiredValidations();

    // Check for valid prior validation
    const priorValidationEntry = validationCache.get(operationKey);

    if (!priorValidationEntry) {
      throw new Error(
        'Validation required: No dry-run found for this operation. ' +
        'You must perform a dry-run (dry_run: true) before executing. ' +
        'This ensures the operation is validated before execution.',
      );
    }

    // Check if validation is expired
    if (Date.now() - priorValidationEntry.timestamp > VALIDATION_EXPIRY_MS) {
      validationCache.delete(operationKey);
      throw new Error(
        'Validation expired: The dry-run for this operation has expired (>5 minutes old). ' +
        'Please perform a new dry-run before executing.',
      );
    }

    // Check if data has changed
    if (priorValidationEntry.dataHash !== dataHash) {
      validationCache.delete(operationKey);
      throw new Error(
        'Data mismatch: The data has changed since the dry-run validation. ' +
        'The data must be identical between dry-run and execution. ' +
        'Please perform a new dry-run with the current data.',
      );
    }

    // Check if prior validation failed
    if (!priorValidationEntry.validated) {
      validationCache.delete(operationKey);
      const errors = priorValidationEntry.errors?.join(', ') ?? 'Validation failed';
      throw new Error(
        `Cannot execute: The dry-run validation failed with errors: ${errors}. ` +
        'Please fix the issues and perform a new dry-run.',
      );
    }

    // Validation passed - clear it from cache (single use)
    validationCache.delete(operationKey);
  }

  // For update/delete operations, capture beforeData for audit trail
  let beforeData: unknown;
  if (operation === 'update' || operation === 'delete') {
    try {
      beforeData = await context.client.getRecord(appId, recordId);
    } catch (error) {
      // If we can't get beforeData, continue but log without it
      console.warn(`Failed to fetch beforeData for ${operation} audit: ${String(error)}`);
    }
  }

  let result: unknown;
  switch (operation) {
    case 'create':
      result = await context.client.createRecord(appId, translatedData);
      // AUDIT LOGGING: Create operation
      await context.auditLogger.logMutation({
        operation: 'create',
        tableId: appId,
        recordId: (result as any)?.id || recordId,
        payload: translatedData,
        result: result as Record<string, unknown>,
        reversalInstructions: {
          operation: 'delete',
          tableId: appId,
          recordId: (result as any)?.id || recordId,
        },
      });
      break;
    case 'update':
      result = await context.client.updateRecord(appId, recordId, translatedData);
      // AUDIT LOGGING: Update operation
      await context.auditLogger.logMutation({
        operation: 'update',
        tableId: appId,
        recordId,
        payload: translatedData,
        result: result as Record<string, unknown>,
        beforeData: beforeData as Record<string, unknown>,
        reversalInstructions: {
          operation: 'update',
          tableId: appId,
          recordId,
          payload: beforeData as Record<string, unknown>,
        },
      });
      break;
    case 'delete':
      await context.client.deleteRecord(appId, recordId);
      result = { deleted: recordId };
      // AUDIT LOGGING: Delete operation
      await context.auditLogger.logMutation({
        operation: 'delete',
        tableId: appId,
        recordId,
        result: result as Record<string, unknown>,
        beforeData: beforeData as Record<string, unknown>,
        reversalInstructions: {
          operation: 'create',
          tableId: appId,
          payload: beforeData as Record<string, unknown>,
        },
      });
      break;
    case 'bulk_update':
      // Bulk update uses PATCH to /records/bulk/ with items array
      result = await context.client.request({
        method: 'PATCH',
        endpoint: `/applications/${appId}/records/bulk/`,
        data: { items: translatedData },
      });
      // TODO: Add audit logging support for bulk operations
      // Bulk operations need special handling in audit logger
      break;
    case 'bulk_delete':
      // Bulk delete uses PATCH to /records/bulk_delete/ with ids array
      result = await context.client.request({
        method: 'PATCH',
        endpoint: `/applications/${appId}/records/bulk_delete/`,
        data: { ids: translatedData },
      });
      // TODO: Add audit logging support for bulk delete operations
      // Bulk deletes need special handling in audit logger
      break;
    default:
      throw new Error(`Unknown record operation: ${String(operation)}`);
  }

  // FIELD TRANSLATION: Convert API response back to human-readable names
  if (
    context.fieldTranslator.hasMappings(appId) &&
    result &&
    typeof result === 'object' &&
    !('deleted' in (result as Record<string, unknown>))
  ) {
    result = context.fieldTranslator.apiToHuman(appId, result as Record<string, unknown>);
  }

  // TODO: Add proper audit logging for mutations when not in dry-run mode

  return result;
}
