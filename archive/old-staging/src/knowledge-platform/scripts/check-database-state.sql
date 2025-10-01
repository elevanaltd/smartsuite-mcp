-- Database State Assessment Script
-- TECHNICAL-ARCHITECT: Checking for maintenance needs

-- Check existing schemas
SELECT schema_name, 
       CASE 
         WHEN schema_name = 'knowledge_platform' THEN '⚠️ EXISTS - may need cleanup'
         WHEN schema_name = 'public' THEN '✅ Default schema'
         WHEN schema_name LIKE 'pg_%' THEN '📋 System schema'
         ELSE '📂 Custom schema'
       END as status
FROM information_schema.schemata
WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
ORDER BY schema_name;

-- Check for Knowledge Platform tables
SELECT 
    'knowledge_platform schema exists' as check_item,
    EXISTS (
        SELECT 1 FROM information_schema.schemata 
        WHERE schema_name = 'knowledge_platform'
    ) as result;

-- Check EAV Orchestrator activity (to determine old vs new)
SELECT 
    'Latest EAV activity' as check_item,
    MAX(created_at) as last_activity,
    CASE 
        WHEN MAX(created_at) >= '2025-09-01' THEN 'NEW repository (September+)'
        WHEN MAX(created_at) < '2025-09-01' THEN 'OLD repository (pre-September)'
        ELSE 'No data found'
    END as assessment
FROM audit_logs
WHERE created_at IS NOT NULL;

-- List all tables with row counts (approximate)
SELECT 
    schemaname,
    tablename,
    n_live_tup as approx_rows,
    CASE 
        WHEN schemaname = 'knowledge_platform' THEN 'Knowledge Platform'
        WHEN tablename LIKE '%audit%' THEN 'Audit/Logging'
        WHEN tablename LIKE '%eav%' THEN 'EAV Orchestrator'
        ELSE 'Other'
    END as category
FROM pg_stat_user_tables
ORDER BY schemaname, tablename;
