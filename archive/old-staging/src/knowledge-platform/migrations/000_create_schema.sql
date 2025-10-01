-- Create dedicated schema for Knowledge Platform
-- TECHNICAL-ARCHITECT: Schema isolation for clean separation

CREATE SCHEMA IF NOT EXISTS knowledge_platform;

-- Grant appropriate permissions
GRANT USAGE ON SCHEMA knowledge_platform TO anon;
GRANT USAGE ON SCHEMA knowledge_platform TO authenticated;
GRANT ALL ON SCHEMA knowledge_platform TO service_role;

-- Set search path for subsequent migrations
SET search_path TO knowledge_platform, public;

-- Add comment for documentation
COMMENT ON SCHEMA knowledge_platform IS 'Event-sourced knowledge management system for SmartSuite field mappings and API patterns';
