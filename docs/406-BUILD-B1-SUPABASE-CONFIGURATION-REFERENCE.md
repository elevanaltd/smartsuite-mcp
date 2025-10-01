# Supabase Configuration Reference - SmartSuite Knowledge Platform

**Date:** 2025-09-13
**Status:** Implementation Guide
**Source:** Based on proven EAV Orchestrator configuration

## Critical Learning from EAV Orchestrator

The existing EAV Orchestrator provides battle-tested Supabase patterns we should adopt:

### 1. Connection Architecture

```typescript
// Primary: Pooled connections for API/BFF operations
DATABASE_URL=postgres://[user]:[password]@[region].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1

// Secondary: Direct connections for migrations/long operations
DIRECT_DATABASE_URL=postgres://[user]:[password]@[region].pooler.supabase.com:5432/postgres
```

### 2. Client Configuration Pattern

```typescript
import { createClient } from '@supabase/supabase-js';

export const supabaseClient = createClient(
  process.env.KNOWLEDGE_SUPABASE_URL!,
  process.env.KNOWLEDGE_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: false, // Server-side doesn't need session persistence
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    realtime: {
      params: {
        eventsPerSecond: 10 // Conservative rate limiting
      }
    },
    db: {
      schema: 'public'
    },
    global: {
      headers: {
        'x-service-name': 'knowledge-platform'
      }
    }
  }
);
```

### 3. Event Store Schema (Adapted from EAV)

```sql
-- Core event store table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_id VARCHAR(255) NOT NULL,
  aggregate_type VARCHAR(100) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  event_version INTEGER NOT NULL,
  event_data JSONB NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by VARCHAR(255) NOT NULL,

  -- Optimistic locking
  CONSTRAINT unique_aggregate_version
    UNIQUE (aggregate_id, event_version)
);

-- Indexes for performance
CREATE INDEX idx_events_aggregate_id ON events(aggregate_id);
CREATE INDEX idx_events_event_type ON events(event_type);
CREATE INDEX idx_events_created_at ON events(created_at);

-- Snapshot table for performance
CREATE TABLE IF NOT EXISTS snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_id VARCHAR(255) NOT NULL,
  aggregate_type VARCHAR(100) NOT NULL,
  version INTEGER NOT NULL,
  state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Only keep latest snapshot per aggregate
  CONSTRAINT unique_aggregate_snapshot
    UNIQUE (aggregate_id)
);

-- Materialized view for field mappings
CREATE MATERIALIZED VIEW field_mappings AS
SELECT
  aggregate_id as table_id,
  (state->>'fields')::jsonb as fields,
  version,
  created_at as last_updated
FROM snapshots
WHERE aggregate_type = 'FieldMapping';

-- Refresh trigger for materialized view
CREATE OR REPLACE FUNCTION refresh_field_mappings()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY field_mappings;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER refresh_field_mappings_trigger
AFTER INSERT OR UPDATE ON snapshots
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_field_mappings();
```

### 4. Row Level Security (RLS)

```sql
-- Enable RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY service_role_all ON events
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY service_role_all ON snapshots
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Authenticated users can read
CREATE POLICY authenticated_read ON events
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY authenticated_read ON snapshots
  FOR SELECT
  USING (auth.role() = 'authenticated');
```

### 5. Connection Pool Management

```typescript
// Connection pool configuration learned from EAV
export const poolConfig = {
  // Supavisor pooler settings
  poolMode: 'transaction',
  maxConnections: 10,  // Pro tier limit
  idleTimeout: 10000,  // 10 seconds
  connectionTimeout: 5000, // 5 seconds

  // Circuit breaker pattern
  circuitBreaker: {
    threshold: 5,        // Failures before open
    timeout: 30000,      // Reset attempt after 30s
    bucketSize: 60000    // 1 minute buckets
  }
};
```

### 6. Realtime Configuration

```typescript
// Realtime channels for knowledge updates
export const realtimeConfig = {
  channels: {
    fieldMappings: 'realtime:field-mappings',
    knowledgeUpdates: 'realtime:knowledge-updates',
    systemEvents: 'realtime:system-events'
  },

  subscriptions: {
    // Subscribe to new events
    onEventCreated: {
      event: 'INSERT',
      schema: 'public',
      table: 'events'
    },

    // Subscribe to snapshot updates
    onSnapshotUpdated: {
      event: '*',
      schema: 'public',
      table: 'snapshots'
    }
  }
};
```

### 7. Migration Strategy

```bash
# Use direct connection for migrations
DATABASE_URL=$DIRECT_DATABASE_URL npm run migrate:up

# Migration files structure
migrations/
├── 001_initial_schema.sql
├── 002_add_indexes.sql
├── 003_create_materialized_views.sql
└── 004_setup_rls.sql
```

### 8. Performance Optimizations

```typescript
// Batch event inserts
export async function appendEvents(events: DomainEvent[]) {
  const { data, error } = await supabaseClient
    .from('events')
    .insert(events)
    .select();

  if (error) {
    // Circuit breaker integration
    circuitBreaker.recordFailure();
    throw error;
  }

  circuitBreaker.recordSuccess();
  return data;
}

// Use prepared statements for common queries
const getEventsByAggregate = supabaseClient
  .from('events')
  .select('*')
  .eq('aggregate_id', '$1')
  .order('event_version', { ascending: true });
```

### 9. Monitoring Integration

```typescript
// Key metrics from EAV Orchestrator
export const monitoringMetrics = {
  // Connection health
  'supabase.connections.active': getCurrentConnections,
  'supabase.connections.failed': getFailedConnections,

  // Event store performance
  'events.append.latency': measureAppendLatency,
  'events.query.latency': measureQueryLatency,

  // Realtime health
  'realtime.messages.per_second': getMessageRate,
  'realtime.connections.active': getActiveChannels,

  // Circuit breaker state
  'circuit_breaker.state': getCircuitState,
  'circuit_breaker.failures': getFailureCount
};
```

### 10. Environment Variables

```bash
# Complete environment configuration
KNOWLEDGE_SUPABASE_URL=https://[project-id].supabase.co
KNOWLEDGE_SUPABASE_ANON_KEY=eyJ...
KNOWLEDGE_SUPABASE_SERVICE_KEY=eyJ...

# Connection URLs
KNOWLEDGE_DATABASE_URL=postgres://[user]:[pass]@[region].pooler.supabase.com:6543/postgres
KNOWLEDGE_DIRECT_URL=postgres://[user]:[pass]@[region].pooler.supabase.com:5432/postgres

# Feature flags
KNOWLEDGE_PLATFORM_ENABLED=false
EVENT_SOURCING_ENABLED=false
REALTIME_ENABLED=false

# Performance tuning
KNOWLEDGE_BATCH_SIZE=100
KNOWLEDGE_SNAPSHOT_INTERVAL=100
KNOWLEDGE_CACHE_TTL=300000
```

## Implementation Checklist

- [ ] Create Supabase project in same region as EAV Orchestrator
- [ ] Configure connection pooling with Supavisor
- [ ] Run initial schema migrations
- [ ] Set up RLS policies
- [ ] Configure realtime channels
- [ ] Implement circuit breaker
- [ ] Set up monitoring dashboard
- [ ] Test connection resilience
- [ ] Validate performance targets
- [ ] Document connection strings

## Security Considerations

1. **Never commit real credentials** - Use environment variables
2. **Use service role key only server-side** - Never expose to client
3. **Implement RLS for all tables** - Defense in depth
4. **Rotate keys regularly** - Quarterly minimum
5. **Monitor failed auth attempts** - Alert on anomalies

## References

- EAV Orchestrator: `/Volumes/HestAI-old/builds/eav-orchestrator-old/`
- Supabase Docs: https://supabase.com/docs
- Connection Pooling: https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler

---

*Configuration validated against production EAV Orchestrator patterns*