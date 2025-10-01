// SmartDoc format validator - prevents silent data loss in SmartSuite API
// CRITICAL: Validates checklist and rich text field formats
// Architecture compliance: Field format validation layer

export class SmartDocValidationError extends Error {
  constructor(
    message: string,
    public readonly fieldType: string,
    public readonly invalidValue: unknown,
  ) {
    super(message);
    this.name = 'SmartDocValidationError';
  }
}

/**
 * Validate SmartDoc field format to prevent silent data loss
 * @param fieldType - The SmartSuite field type
 * @param value - The field value to validate
 * @throws SmartDocValidationError when format is invalid
 */
export function validateSmartDocFormat(fieldType: string, value: unknown): void {
  const validator = getValidatorForFieldType(fieldType);
  if (validator) {
    validator(value);
  }
}

/**
 * Get appropriate validator function for field type
 */
function getValidatorForFieldType(fieldType: string): ((value: unknown) => void) | null {
  switch (fieldType) {
    case 'checklist':
      return validateChecklistFormat;
    case 'linked_record':
      return validateLinkedRecordFormat;
    default:
      return null; // No validation required for this field type
  }
}

/**
 * Validate checklist field format - prevents silent data loss from simple arrays
 */
function validateChecklistFormat(value: unknown): void {
  if (!Array.isArray(value)) {
    return; // Non-arrays are handled by schema validation
  }

  // Check for dangerous simple array format that causes silent data loss
  if (value.length > 0 && typeof value[0] === 'string') {
    throw new SmartDocValidationError(
      'Invalid checklist format: Simple arrays ["item1", "item2"] cause silent data loss in SmartSuite API. Use proper SmartDoc rich text structure.',
      'checklist',
      value,
    );
  }
}

/**
 * Validate linked record field format - must be arrays even for single values
 */
function validateLinkedRecordFormat(value: unknown): void {
  if (value != null && !Array.isArray(value)) {
    throw new SmartDocValidationError(
      'Invalid linked record format: Linked records must be arrays, even for single values.',
      'linked_record',
      value,
    );
  }
}
