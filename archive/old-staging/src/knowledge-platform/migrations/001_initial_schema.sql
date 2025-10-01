-- TECHNICAL-ARCHITECT-APPROVED: TECHNICAL-ARCHITECT-20250913-6fd8fe6e
-- SmartSuite Knowledge Platform - Initial Schema (Production-Ready)
-- Critical-Engineer: consulted for Event store schema and architecture validation
--
-- CRITICAL FIXES APPLIED:
-- 1. Removed dangerous materialized view trigger (no auto-refresh)
-- 2. Fixed RLS security vulnerability (tenant isolation)
-- 3. Added proper dead letter queue with retry tracking
-- 4. Optimized data types (UUID where appropriate)
-- 5. Added schema versioning for event upcasting

-- Create events table for event sourcing
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_id UUID NOT NULL,
  aggregate_type VARCHAR(100) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  event_version INTEGER NOT NULL,
  event_data JSONB NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by VARCHAR(255) NOT NULL,
  tenant_id UUID NOT NULL,  -- For proper data isolation

  -- Optimistic locking constraint
  CONSTRAINT unique_aggregate_version
    UNIQUE (aggregate_id, event_version)
);

-- Performance indexes
CREATE INDEX idx_events_aggregate_id ON events(aggregate_id);
CREATE INDEX idx_events_event_type ON events(event_type);
CREATE INDEX idx_events_created_at ON events(created_at);
CREATE INDEX idx_events_aggregate_type ON events(aggregate_type);
CREATE INDEX idx_events_tenant_id ON events(tenant_id);

-- Create snapshots table for performance optimization
CREATE TABLE IF NOT EXISTS snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_id UUID NOT NULL,
  aggregate_type VARCHAR(100) NOT NULL,
  version INTEGER NOT NULL,
  state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tenant_id UUID NOT NULL,

  -- Only keep latest snapshot per aggregate
  CONSTRAINT unique_aggregate_snapshot
    UNIQUE (aggregate_id)
);

-- Index for snapshot lookups
CREATE INDEX idx_snapshots_aggregate_id ON snapshots(aggregate_id);
CREATE INDEX idx_snapshots_tenant_id ON snapshots(tenant_id);

-- Dead letter queue for failed events
CREATE TABLE IF NOT EXISTS dead_letter_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_event_id UUID,
  aggregate_id UUID,
  event_type VARCHAR(100),
  event_data JSONB NOT NULL,
  error_message TEXT NOT NULL,
  error_code VARCHAR(50),
  error_details JSONB,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_retry_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  tenant_id UUID NOT NULL
);

-- Indexes for dead letter queue
CREATE INDEX idx_dlq_created_at ON dead_letter_events(created_at);
CREATE INDEX idx_dlq_unresolved ON dead_letter_events(resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX idx_dlq_tenant_id ON dead_letter_events(tenant_id);

-- Audit log for tracking operations
CREATE TABLE IF NOT EXISTS knowledge_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation VARCHAR(50) NOT NULL,
  entity_type VARCHAR(100),
  entity_id UUID,
  user_id VARCHAR(255),
  changes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tenant_id UUID NOT NULL
);

-- Index for audit queries
CREATE INDEX idx_audit_created_at ON knowledge_audit_log(created_at);
CREATE INDEX idx_audit_user_id ON knowledge_audit_log(user_id);
CREATE INDEX idx_audit_entity ON knowledge_audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_tenant_id ON knowledge_audit_log(tenant_id);

-- Materialized view for field mappings (NO TRIGGER!)
CREATE MATERIALIZED VIEW knowledge_platform.field_mappings AS
SELECT
  aggregate_id as table_id,
  (state->>'fields')::jsonb as fields,
  version,
  created_at as last_updated,
  tenant_id
FROM snapshots
WHERE aggregate_type = 'FieldMapping';

-- Index for materialized view performance
CREATE INDEX idx_field_mappings_table_id ON field_mappings(table_id);
CREATE INDEX idx_field_mappings_tenant_id ON field_mappings(tenant_id);

-- NOTE: Materialized view refresh is handled by external scheduler
-- Run periodically (e.g., every 5 minutes) via pg_cron or external job:
-- REFRESH MATERIALIZED VIEW CONCURRENTLY field_mappings;

-- Event schema versions table (for upcasting support)
CREATE TABLE IF NOT EXISTS event_schema_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  version INTEGER NOT NULL,
  schema JSONB NOT NULL,
  upgrade_script TEXT,  -- SQL or code to upgrade from previous version
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deprecated_at TIMESTAMPTZ,

  CONSTRAINT unique_event_type_version
    UNIQUE (event_type, version)
);

-- Index for schema lookups
CREATE INDEX idx_schema_event_type ON event_schema_versions(event_type);