// Tests to verify Zod validation is working correctly
// CRITICAL-ENGINEER: Validates runtime type safety implementation
// Context7: consulted for vitest
// Context7: consulted for uuid

import { v4 as uuidv4 } from 'uuid';
import { describe, it, expect } from 'vitest';

import {
  parseEventRow,
  parseSnapshotRow,
  parseDomainEvent,
  parseSnapshot,
  EventValidationError,
  DomainEvent,
  Snapshot,
} from './types.js';

describe('Event Validation', () => {
  describe('parseEventRow', () => {
    it('should parse valid event row data', () => {
      const validEventRow = {
        id: uuidv4(),
        aggregate_id: uuidv4(),
        event_type: 'FieldMappingCreated',
        event_version: 1,
        created_at: '2023-12-01T10:00:00.000Z',
        created_by: uuidv4(),
        event_data: { name: 'test' },
        metadata: { correlationId: uuidv4() },
      };

      expect(() => parseEventRow(validEventRow)).not.toThrow();
      const result = parseEventRow(validEventRow);
      expect(result.id).toBe(validEventRow.id);
      expect(result.event_type).toBe(validEventRow.event_type);
    });

    it('should throw EventValidationError for invalid event row', () => {
      const invalidEventRow = {
        id: 'not-a-uuid',
        aggregate_id: uuidv4(),
        event_type: '',
        event_version: -1,
        created_at: 'invalid-date',
        created_by: 'not-a-uuid',
        event_data: null,
        metadata: null,
      };

      expect(() => parseEventRow(invalidEventRow)).toThrow(EventValidationError);

      try {
        parseEventRow(invalidEventRow);
      } catch (error) {
        expect(error).toBeInstanceOf(EventValidationError);
        const validationError = error as EventValidationError;
        expect(validationError.getValidationDetails()).toContain('id');
        expect(validationError.getValidationDetails()).toContain('uuid');
      }
    });

    it('should reject completely malformed data', () => {
      expect(() => parseEventRow(null)).toThrow(EventValidationError);
      expect(() => parseEventRow('string')).toThrow(EventValidationError);
      expect(() => parseEventRow(123)).toThrow(EventValidationError);
      expect(() => parseEventRow({})).toThrow(EventValidationError);
    });
  });

  describe('parseSnapshotRow', () => {
    it('should parse valid snapshot row data', () => {
      const validSnapshotRow = {
        id: uuidv4(),
        aggregate_id: uuidv4(),
        version: 5,
        created_at: '2023-12-01T10:00:00.000Z',
        state: { currentMapping: { field1: 'value1' } },
      };

      expect(() => parseSnapshotRow(validSnapshotRow)).not.toThrow();
      const result = parseSnapshotRow(validSnapshotRow);
      expect(result.id).toBe(validSnapshotRow.id);
      expect(result.version).toBe(validSnapshotRow.version);
    });

    it('should throw EventValidationError for invalid snapshot row', () => {
      const invalidSnapshotRow = {
        id: 'not-a-uuid',
        aggregate_id: 'not-a-uuid',
        version: 0,
        created_at: 'invalid-date',
        state: null,
      };

      expect(() => parseSnapshotRow(invalidSnapshotRow)).toThrow(EventValidationError);
    });
  });

  describe('parseDomainEvent', () => {
    it('should parse valid domain event', () => {
      const validDomainEvent: DomainEvent = {
        id: uuidv4(),
        aggregateId: uuidv4(),
        type: 'FieldMappingCreated',
        version: 1,
        timestamp: new Date(),
        userId: uuidv4(),
        payload: { field: 'value' },
        metadata: {
          correlationId: uuidv4(),
          causationId: uuidv4(),
        },
      };

      expect(() => parseDomainEvent(validDomainEvent)).not.toThrow();
      const result = parseDomainEvent(validDomainEvent);
      expect(result.id).toBe(validDomainEvent.id);
      expect(result.type).toBe(validDomainEvent.type);
    });

    it('should throw EventValidationError for invalid domain event', () => {
      const invalidDomainEvent = {
        id: 'not-a-uuid',
        aggregateId: 'not-a-uuid',
        type: '',
        version: 0,
        timestamp: 'not-a-date',
        userId: 'not-a-uuid',
        payload: null,
        metadata: null,
      };

      expect(() => parseDomainEvent(invalidDomainEvent)).toThrow(EventValidationError);
    });
  });

  describe('parseSnapshot', () => {
    it('should parse valid snapshot', () => {
      const validSnapshot: Snapshot = {
        id: uuidv4(),
        aggregateId: uuidv4(),
        version: 1,
        timestamp: new Date(),
        data: { state: 'value' },
      };

      expect(() => parseSnapshot(validSnapshot)).not.toThrow();
      const result = parseSnapshot(validSnapshot);
      expect(result.id).toBe(validSnapshot.id);
      expect(result.version).toBe(validSnapshot.version);
    });

    it('should throw EventValidationError for invalid snapshot', () => {
      const invalidSnapshot = {
        id: 'not-a-uuid',
        aggregateId: 'not-a-uuid',
        version: 0,
        timestamp: 'not-a-date',
        data: null,
      };

      expect(() => parseSnapshot(invalidSnapshot)).toThrow(EventValidationError);
    });
  });

  describe('EventValidationError', () => {
    it('should provide detailed validation error messages', () => {
      const invalidData = {
        id: 'not-a-uuid',
        event_type: '',
        event_version: -1,
      };

      try {
        parseEventRow(invalidData);
      } catch (error) {
        expect(error).toBeInstanceOf(EventValidationError);
        const validationError = error as EventValidationError;

        expect(validationError.message).toContain('Invalid event row data from database');
        expect(validationError.rawData).toBe(invalidData);
        expect(validationError.getValidationDetails()).toMatch(/id.*uuid/);
        expect(validationError.getValidationDetails()).toMatch(/event_type.*String must contain at least 1 character/);
        expect(validationError.getValidationDetails()).toMatch(/event_version.*Number must be greater than 0/);
      }
    });
  });

  describe('Type Safety Verification', () => {
    it('should ensure no any types leak through validation', () => {
      const validEventRow = {
        id: uuidv4(),
        aggregate_id: uuidv4(),
        event_type: 'FieldMappingCreated',
        event_version: 1,
        created_at: '2023-12-01T10:00:00.000Z',
        created_by: uuidv4(),
        event_data: { name: 'test', value: 123, nested: { deep: true } },
        metadata: { correlationId: uuidv4(), extra: 'data' },
      };

      const result = parseEventRow(validEventRow);

      // TypeScript should enforce types even though payload/metadata are Record<string, unknown>
      expect(typeof result.id).toBe('string');
      expect(typeof result.event_type).toBe('string');
      expect(typeof result.event_version).toBe('number');
      expect(typeof result.created_at).toBe('string');
      expect(typeof result.created_by).toBe('string');
      expect(typeof result.event_data).toBe('object');
      expect(typeof result.metadata).toBe('object');
    });
  });
});

