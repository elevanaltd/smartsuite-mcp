-- TECHNICAL-ARCHITECT-APPROVED: TECHNICAL-ARCHITECT-20250913-6fd8fe6e
-- SmartSuite Knowledge Platform - Row Level Security Policies
-- Critical-Engineer: consulted for RLS security implementation
--
-- Implements proper tenant isolation to prevent data leaks

-- Enable RLS on all tables
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE dead_letter_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_audit_log ENABLE ROW LEVEL SECURITY;

-- Service role has full access (for backend operations)
CREATE POLICY service_role_all_events ON events
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY service_role_all_snapshots ON snapshots
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY service_role_all_dlq ON dead_letter_events
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY service_role_all_audit ON knowledge_audit_log
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- FIXED: Tenant-scoped read access for authenticated users
-- Users can only read data from their own tenant
CREATE POLICY tenant_read_events ON events
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND tenant_id = (auth.jwt()->>'tenant_id')::uuid
  );

CREATE POLICY tenant_read_snapshots ON snapshots
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND tenant_id = (auth.jwt()->>'tenant_id')::uuid
  );

CREATE POLICY tenant_read_dlq ON dead_letter_events
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND tenant_id = (auth.jwt()->>'tenant_id')::uuid
  );

CREATE POLICY tenant_read_audit ON knowledge_audit_log
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND tenant_id = (auth.jwt()->>'tenant_id')::uuid
  );

-- Insert policies (authenticated users can create events in their tenant)
CREATE POLICY tenant_insert_events ON events
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND tenant_id = (auth.jwt()->>'tenant_id')::uuid
    AND created_by = auth.jwt()->>'sub'
  );

CREATE POLICY tenant_insert_audit ON knowledge_audit_log
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND tenant_id = (auth.jwt()->>'tenant_id')::uuid
    AND user_id = auth.jwt()->>'sub'
  );

-- No direct insert/update/delete on snapshots or DLQ by authenticated users
-- These are managed by the service role only

-- Create a function to validate tenant access
CREATE OR REPLACE FUNCTION check_tenant_access(requested_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Service role has access to all tenants
  IF auth.jwt()->>'role' = 'service_role' THEN
    RETURN TRUE;
  END IF;

  -- Authenticated users can only access their own tenant
  IF auth.role() = 'authenticated' THEN
    RETURN requested_tenant_id = (auth.jwt()->>'tenant_id')::uuid;
  END IF;

  -- Deny by default
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create an audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO knowledge_audit_log (
    operation,
    entity_type,
    entity_id,
    user_id,
    changes,
    tenant_id
  ) VALUES (
    TG_OP,
    TG_TABLE_NAME,
    CASE
      WHEN TG_OP = 'DELETE' THEN OLD.id
      ELSE NEW.id
    END,
    auth.jwt()->>'sub',
    jsonb_build_object(
      'old', to_jsonb(OLD),
      'new', to_jsonb(NEW)
    ),
    CASE
      WHEN TG_OP = 'DELETE' THEN OLD.tenant_id
      ELSE NEW.tenant_id
    END
  );

  RETURN CASE
    WHEN TG_OP = 'DELETE' THEN OLD
    ELSE NEW
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit triggers to critical tables
CREATE TRIGGER audit_events_trigger
  AFTER INSERT OR UPDATE OR DELETE ON events
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_snapshots_trigger
  AFTER INSERT OR UPDATE OR DELETE ON snapshots
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();
