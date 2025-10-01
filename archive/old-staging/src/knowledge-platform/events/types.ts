// Event sourcing type definitions with Zod validation
// TEST COMMIT: 9617b92 - implementing to satisfy failing tests
// CRITICAL-ENGINEER: Added runtime validation to eliminate any types
// Context7: consulted for zod

import { z } from 'zod';

// Zod schemas for runtime validation
export const DomainEventMetadataSchema = z.object({
  correlationId: z.string().uuid(),
  causationId: z.string().uuid(),
});

export const DomainEventSchema = z.object({
  id: z.string().uuid(),
  aggregateId: z.string().uuid(),
  type: z.string().min(1),
  version: z.number().int().positive(),
  timestamp: z.date(),
  userId: z.string().uuid(),
  payload: z.record(z.unknown()),
  metadata: DomainEventMetadataSchema,
});

export const SnapshotSchema = z.object({
  id: z.string().uuid(),
  aggregateId: z.string().uuid(),
  version: z.number().int().positive(),
  timestamp: z.date(),
  data: z.record(z.unknown()),
});

// Schema for validating raw database rows from Supabase
export const EventRowSchema = z.object({
  id: z.string().uuid(),
  aggregate_id: z.string().uuid(),
  event_type: z.string().min(1),
  event_version: z.number().int().positive(),
  created_at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, 'Invalid ISO datetime format'),
  created_by: z.string().uuid(),
  event_data: z.record(z.unknown()),
  metadata: z.record(z.unknown()),
});

export const SnapshotRowSchema = z.object({
  id: z.string().uuid(),
  aggregate_id: z.string().uuid(),
  version: z.number().int().positive(),
  created_at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, 'Invalid ISO datetime format'),
  state: z.record(z.unknown()),
});

// TypeScript types derived from Zod schemas
export type DomainEvent = z.infer<typeof DomainEventSchema>;
export type DomainEventMetadata = z.infer<typeof DomainEventMetadataSchema>;
export type Snapshot = z.infer<typeof SnapshotSchema>;
export type EventRow = z.infer<typeof EventRowSchema>;
export type SnapshotRow = z.infer<typeof SnapshotRowSchema>;

// Validation error handling
export class EventValidationError extends Error {
  constructor(
    message: string,
    public readonly zodError: z.ZodError,
    public readonly rawData: unknown,
  ) {
    super(message);
    this.name = 'EventValidationError';
  }

  getValidationDetails(): string {
    return this.zodError.errors
      .map(err => `${err.path.join('.')}: ${err.message}`)
      .join('; ');
  }
}

// Helper functions for safe parsing
export function parseEventRow(data: unknown): EventRow {
  try {
    return EventRowSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new EventValidationError(
        'Invalid event row data from database',
        error,
        data,
      );
    }
    throw error;
  }
}

export function parseSnapshotRow(data: unknown): SnapshotRow {
  try {
    return SnapshotRowSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new EventValidationError(
        'Invalid snapshot row data from database',
        error,
        data,
      );
    }
    throw error;
  }
}

export function parseDomainEvent(data: unknown): DomainEvent {
  try {
    return DomainEventSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new EventValidationError(
        'Invalid domain event data',
        error,
        data,
      );
    }
    throw error;
  }
}

export function parseSnapshot(data: unknown): Snapshot {
  try {
    return SnapshotSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new EventValidationError(
        'Invalid snapshot data',
        error,
        data,
      );
    }
    throw error;
  }
}
