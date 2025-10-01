// Event Store implementation with pluggable backends
// TECHNICAL-ARCHITECT: Supports both in-memory (testing) and Supabase (production)
// CONTEXT7_BYPASS: CI-FIX-001 - ESM import extension fixes for TypeScript compilation

import { EventStoreSupabase } from './event-store-supabase.js';
import { DomainEvent, Snapshot } from './types.js';

export interface IEventStore {
  append(event: DomainEvent): Promise<string>;
  getEvents(aggregateId: string, fromVersion?: number): Promise<DomainEvent[]>;
  getSnapshot(aggregateId: string): Promise<Snapshot | null>;
}

// In-memory implementation for testing
export class EventStoreMemory implements IEventStore {
  private events: Map<string, DomainEvent[]> = new Map();
  private snapshots: Map<string, Snapshot> = new Map();
  private versions: Map<string, number> = new Map();

  append(event: DomainEvent): Promise<string> {
    const currentVersion = this.versions.get(event.aggregateId) ?? 0;
    const expectedVersion = currentVersion + 1;

    if (event.version !== expectedVersion) {
      throw new Error(`Version conflict: expected ${expectedVersion}, got ${event.version}`);
    }

    if (!this.events.has(event.aggregateId)) {
      this.events.set(event.aggregateId, []);
    }
    this.events.get(event.aggregateId)!.push(event);
    this.versions.set(event.aggregateId, event.version);

    return Promise.resolve(event.id);
  }

  getEvents(aggregateId: string, fromVersion?: number): Promise<DomainEvent[]> {
    const events = this.events.get(aggregateId) ?? [];

    if (fromVersion === undefined) {
      return Promise.resolve(events);
    }

    return Promise.resolve(events.filter(e => e.version >= fromVersion));
  }

  getSnapshot(aggregateId: string): Promise<Snapshot | null> {
    return Promise.resolve(this.snapshots.get(aggregateId) ?? null);
  }
}

// Main EventStore class that delegates to appropriate backend
export class EventStore implements IEventStore {
  private backend: IEventStore;

  constructor(backend?: IEventStore | string) {
    if (typeof backend === 'string') {
      // Tenant ID provided - use Supabase
      this.backend = new EventStoreSupabase(backend);
    } else if (backend) {
      // Custom backend provided
      this.backend = backend;
    } else {
      // Default to in-memory for testing
      this.backend = new EventStoreMemory();
    }
  }

  async append(event: DomainEvent): Promise<string> {
    return await this.backend.append(event);
  }

  async getEvents(aggregateId: string, fromVersion?: number): Promise<DomainEvent[]> {
    return await this.backend.getEvents(aggregateId, fromVersion);
  }

  async getSnapshot(aggregateId: string): Promise<Snapshot | null> {
    return await this.backend.getSnapshot(aggregateId);
  }
}

// Factory functions with explicit naming to prevent confusion
export function createMemoryEventStore(): EventStore {
  return new EventStore(new EventStoreMemory());
}

export function createProductionEventStore(tenantId: string): EventStore {
  if (!tenantId) {
    throw new Error('Tenant ID is required for production event store');
  }
  return new EventStore(tenantId);
}

// DEPRECATED: Use createMemoryEventStore or createProductionEventStore instead
// Kept for backward compatibility - will be removed in next major version
export function createEventStore(tenantId?: string): EventStore {
  console.warn('createEventStore is deprecated. Use createMemoryEventStore or createProductionEventStore');
  if (tenantId) {
    return createProductionEventStore(tenantId);
  }
  return createMemoryEventStore();
}
