-- TECHNICAL-ARCHITECT-APPROVED: Schema-isolated version
-- SmartSuite Knowledge Platform - Initial Schema (Production-Ready)
-- Uses knowledge_platform schema for isolation

SET search_path TO knowledge_platform, public;

-- Create events table for event sourcing
CREATE TABLE IF NOT EXISTS knowledge_platform.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_id UUID NOT NULL,
  aggregate_type VARCHAR(100) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  event_version INTEGER NOT NULL,
  event_data JSONB NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL,
  tenant_id UUID NOT NULL,
  
  -- Optimistic concurrency control
  CONSTRAINT unique_aggregate_version UNIQUE (aggregate_id, event_version)
);

-- Create snapshots table for performance optimization
CREATE TABLE IF NOT EXISTS knowledge_platform.snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_id UUID NOT NULL,
  aggregate_type VARCHAR(100) NOT NULL,
  version INTEGER NOT NULL,
  state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tenant_id UUID NOT NULL,
  
  -- Only one snapshot per aggregate at a time
  CONSTRAINT unique_aggregate_snapshot UNIQUE (aggregate_id)
);

-- Dead letter queue for failed events
CREATE TABLE IF NOT EXISTS knowledge_platform.dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_event_id UUID,
  event_data JSONB NOT NULL,
  error_message TEXT NOT NULL,
  error_count INTEGER DEFAULT 1,
  last_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  tenant_id UUID NOT NULL
);

-- Audit log table
CREATE TABLE IF NOT EXISTS knowledge_platform.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(100) NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,
  changes JSONB,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tenant_id UUID NOT NULL
);

-- Create indexes for performance
CREATE INDEX idx_events_aggregate ON knowledge_platform.events(aggregate_id, event_version);
CREATE INDEX idx_events_created ON knowledge_platform.events(created_at);
CREATE INDEX idx_events_type ON knowledge_platform.events(event_type);
CREATE INDEX idx_events_tenant ON knowledge_platform.events(tenant_id);

CREATE INDEX idx_snapshots_aggregate ON knowledge_platform.snapshots(aggregate_id);
CREATE INDEX idx_snapshots_tenant ON knowledge_platform.snapshots(tenant_id);

CREATE INDEX idx_dlq_created ON knowledge_platform.dead_letter_queue(created_at);
CREATE INDEX idx_dlq_resolved ON knowledge_platform.dead_letter_queue(resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX idx_dlq_tenant ON knowledge_platform.dead_letter_queue(tenant_id);

CREATE INDEX idx_audit_created_at ON knowledge_platform.audit_log(created_at);
CREATE INDEX idx_audit_user_id ON knowledge_platform.audit_log(user_id);
CREATE INDEX idx_audit_entity ON knowledge_platform.audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_tenant_id ON knowledge_platform.audit_log(tenant_id);

-- Materialized view for field mappings
CREATE MATERIALIZED VIEW knowledge_platform.field_mappings AS
SELECT
  aggregate_id as table_id,
  (state->>'fields')::jsonb as fields,
  version,
  created_at as last_updated,
  tenant_id
FROM knowledge_platform.snapshots
WHERE aggregate_type = 'FieldMapping';

-- Index for materialized view performance
CREATE INDEX idx_field_mappings_table ON knowledge_platform.field_mappings(table_id);
CREATE INDEX idx_field_mappings_tenant ON knowledge_platform.field_mappings(tenant_id);

-- Comments for documentation
COMMENT ON TABLE knowledge_platform.events IS 'Event store for all domain events';
COMMENT ON TABLE knowledge_platform.snapshots IS 'Aggregate snapshots for performance optimization';
COMMENT ON TABLE knowledge_platform.dead_letter_queue IS 'Failed events for retry and debugging';
COMMENT ON TABLE knowledge_platform.audit_log IS 'Audit trail for compliance and debugging';
COMMENT ON MATERIALIZED VIEW knowledge_platform.field_mappings IS 'Denormalized view of SmartSuite field mappings';
