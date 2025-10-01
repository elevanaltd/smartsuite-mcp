// MCP tool input validation middleware
// CRITICAL: Prevents invalid parameters from reaching SmartSuite API
// Context7: consulted for zod
import { z } from 'zod';

import { validateSmartDocFormat, SmartDocValidationError } from './smartdoc-validator.js';

export class McpValidationError extends Error {
  constructor(
    message: string,
    public readonly toolName: string,
    public readonly validationErrors: string[],
  ) {
    super(message);
    this.name = 'McpValidationError';
  }
}

/**
 * Validate MCP tool input parameters with schema and SmartDoc validation
 * @param toolName - Name of the MCP tool
 * @param schema - Zod schema for validation
 * @param input - Input to validate
 * @returns Validated and typed input
 * @throws McpValidationError when validation fails
 */
export function validateMcpToolInput<T>(
  toolName: string,
  schema: z.ZodSchema<T>,
  input: unknown,
): T {
  // Phase 1: Schema validation
  const validatedInput = validateSchema(toolName, schema, input);

  // Phase 2: SmartDoc field format validation
  performSmartDocValidation(toolName, validatedInput);

  return validatedInput;
}

/**
 * Validate input against Zod schema
 */
function validateSchema<T>(
  toolName: string,
  schema: z.ZodSchema<T>,
  input: unknown,
): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const errorMessages = result.error.errors.map(
      (err) => `${err.path.join('.')}: ${err.message}`,
    );
    throw new McpValidationError(
      `Invalid input for tool ${toolName}`,
      toolName,
      errorMessages,
    );
  }
  return result.data;
}

/**
 * Perform SmartDoc field format validation for applicable tools
 */
function performSmartDocValidation(toolName: string, validatedInput: unknown): void {
  if (!requiresSmartDocValidation(toolName)) {
    return;
  }

  const recordData = validatedInput as Record<string, unknown>;
  if (recordData.data && typeof recordData.data === 'object') {
    validateRecordDataFields(toolName, recordData.data as Record<string, unknown>);
  }
}

/**
 * Check if tool requires SmartDoc validation
 */
function requiresSmartDocValidation(toolName: string): boolean {
  return toolName === 'smartsuite_record';
}

/**
 * Validate individual fields in record data
 */
function validateRecordDataFields(toolName: string, data: Record<string, unknown>): void {
  for (const [fieldName, value] of Object.entries(data)) {
    const fieldType = inferFieldType(fieldName, value);
    if (fieldType) {
      try {
        validateSmartDocFormat(fieldType, value);
      } catch (error) {
        if (error instanceof SmartDocValidationError) {
          throw new McpValidationError(
            `SmartDoc validation failed for field ${fieldName}`,
            toolName,
            [error.message],
          );
        }
      }
    }
  }
}

/**
 * Infer field type from field name and value for validation
 */
function inferFieldType(fieldName: string, value: unknown): string | null {
  if (fieldName.includes('checklist') && Array.isArray(value)) {
    return 'checklist';
  }
  if (fieldName.includes('linked') && fieldName.includes('record')) {
    return 'linked_record';
  }
  return null;
}
