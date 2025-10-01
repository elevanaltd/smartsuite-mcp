-- Row Level Security Policies for Knowledge Platform
-- TECHNICAL-ARCHITECT: Proper tenant isolation

-- Enable RLS on all tables
ALTER TABLE knowledge_platform.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_platform.snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_platform.dead_letter_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_platform.audit_log ENABLE ROW LEVEL SECURITY;

-- Service role has full access (backend operations)
CREATE POLICY "Service role has full access to events"
  ON knowledge_platform.events FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to snapshots"
  ON knowledge_platform.snapshots FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to dead_letter_queue"
  ON knowledge_platform.dead_letter_queue FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to audit_log"
  ON knowledge_platform.audit_log FOR ALL
  USING (auth.role() = 'service_role');

-- Authenticated users can only access their tenant's data
CREATE POLICY "Users can view their tenant events"
  ON knowledge_platform.events FOR SELECT
  USING (auth.uid()::uuid = tenant_id);

CREATE POLICY "Users can view their tenant snapshots"
  ON knowledge_platform.snapshots FOR SELECT
  USING (auth.uid()::uuid = tenant_id);

CREATE POLICY "Users can view their tenant dead_letter_queue"
  ON knowledge_platform.dead_letter_queue FOR SELECT
  USING (auth.uid()::uuid = tenant_id);

CREATE POLICY "Users can view their tenant audit_log"
  ON knowledge_platform.audit_log FOR SELECT
  USING (auth.uid()::uuid = tenant_id);
