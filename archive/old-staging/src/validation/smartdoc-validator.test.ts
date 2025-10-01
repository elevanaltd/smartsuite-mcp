// Test-Methodology-Guardian: RED-GREEN-REFACTOR TDD cycle for SmartDoc validation
// CRITICAL: Prevents silent data loss in SmartSuite API checklist fields
// Context7: consulted for vitest
import { describe, it, expect } from 'vitest';

import { validateSmartDocFormat, SmartDocValidationError } from './smartdoc-validator.js';

describe('SmartDoc Format Validator', () => {
  describe('checklist format validation', () => {
    it('should reject simple array format that causes silent data loss', () => {
      // RED: This test MUST fail initially - no validator exists yet
      const invalidChecklistFormat = ['item1', 'item2', 'item3'];

      expect(() => validateSmartDocFormat('checklist', invalidChecklistFormat)).toThrow(
        SmartDocValidationError,
      );
    });

    it('should accept valid SmartDoc rich text format', () => {
      // RED: This test should fail - need to implement proper format validation
      const validSmartDocFormat = [
        {
          type: 'checklist',
          content: [
            { text: 'item1', checked: false },
            { text: 'item2', checked: true },
          ],
        },
      ];

      expect(() => validateSmartDocFormat('checklist', validSmartDocFormat)).not.toThrow();
    });
  });

  describe('linked record format validation', () => {
    it('should reject non-array linked record values', () => {
      // RED: This should fail - no linked record validation exists yet
      const invalidLinkedRecord = 'single-record-id';

      expect(() => validateSmartDocFormat('linked_record', invalidLinkedRecord)).toThrow(
        SmartDocValidationError,
      );
    });

    it('should accept array format for linked records', () => {
      const validLinkedRecord = ['record-id-1', 'record-id-2'];

      expect(() => validateSmartDocFormat('linked_record', validLinkedRecord)).not.toThrow();
    });
  });
});
