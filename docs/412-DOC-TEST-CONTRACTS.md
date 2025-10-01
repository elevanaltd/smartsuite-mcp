# Phoenix Test Contracts

**Extracted From**: Legacy tests quarantined in `_legacy_tests/`
**Purpose**: Business requirements for Phoenix rebuild
**Date**: 2025-10-01
**Status**: Contract extraction complete, implementation pending

---

## Priority Levels

- **P0 (Critical)**: Core functionality - must work for MVP
- **P1 (Important)**: Secondary features - needed for production
- **P2 (Enhancement)**: Nice-to-have - defer to later phases

---

## P0 Contracts (Critical - Implement First)

### FACADE-001: Tool Registration
- **Behavior**: Server must register exactly 9 MCP tools (6 core + 3 knowledge)
- **Source**: `_legacy_tests/mcp-server.test.ts:38-66`
- **Phoenix Test**: `test/unit/facade/mcp-server.test.ts`
- **Status**: Not started
- **Contract**:
  - Core tools: query, record, schema, undo, discover, intelligent
  - Knowledge tools: events, field_mappings, refresh_views
  - Total count: 9 tools exactly

### FACADE-002: Tool Schema Enforcement
- **Behavior**: Record tool must default dry_run=true, operations use enums
- **Source**: `_legacy_tests/mcp-server.test.ts:69-97`
- **Phoenix Test**: `test/unit/facade/mcp-server.test.ts`
- **Status**: Not started
- **Contract**:
  - `smartsuite_record` has `dry_run: { default: true }`
  - `smartsuite_query` operations: list, get, search, count
  - `smartsuite_record` operations: create, update, delete, bulk_update, bulk_delete

### AUTH-001: Client Authentication Success
- **Behavior**: Valid API key creates authenticated client with all methods
- **Source**: `_legacy_tests/smartsuite-client.test.ts:12-55`
- **Phoenix Test**: `test/unit/auth/auth-manager.test.ts`
- **Status**: Not started
- **Contract**:
  - Given valid `apiKey` and `workspaceId`
  - Return client with: listRecords, getRecord, createRecord, updateRecord, deleteRecord, getSchema
  - Make validation request with correct headers (Authorization, ACCOUNT-ID, Content-Type)

### AUTH-002: Authentication Failure Handling
- **Behavior**: Invalid credentials throw specific error messages
- **Source**: `_legacy_tests/smartsuite-client.test.ts:59-79`
- **Phoenix Test**: `test/unit/auth/auth-manager.test.ts`
- **Status**: Not started
- **Contract**:
  - 401 response → throw "Authentication failed: Invalid API key"
  - Network timeout → throw message with "Network error" and recovery guidance

### FIELD-001: Field Translation (Human → API)
- **Behavior**: Translate human-readable field names to cryptic API codes
- **Source**: `_legacy_tests/field-translator.test.ts:54-72`
- **Phoenix Test**: `test/unit/operations/field-translator.test.ts`
- **Status**: Not started
- **Contract**:
  - Load YAML mappings from config directory
  - Non-strict mode: translate known fields, pass through unknown
  - Strict mode (default): throw on unmapped fields
  - Example: `projectName` → `project_name_actual`, `client` → `sbfc98645c`

### FIELD-002: Field Translation (API → Human)
- **Behavior**: Reverse translation for responses
- **Source**: `_legacy_tests/field-translator.test.ts` (implied reverse)
- **Phoenix Test**: `test/unit/operations/field-translator.test.ts`
- **Status**: Not started
- **Contract**:
  - API codes → human-readable names for display
  - Unknown codes pass through unchanged

### TABLE-001: Table ID Resolution
- **Behavior**: Resolve table names to SmartSuite table IDs
- **Source**: `_legacy_tests/table-resolver.test.ts:37-50`
- **Phoenix Test**: `test/unit/operations/table-resolver.test.ts`
- **Status**: Not started
- **Contract**:
  - Load YAML files from field-mappings directory
  - Extract `tableName` and `tableId` from each YAML
  - Provide lookup: name → ID and ID → name

### QUERY-001: List Records
- **Behavior**: Query records by table ID with filtering/pagination
- **Source**: `_legacy_tests/mcp-server.test.ts` (implied from tool schema)
- **Phoenix Test**: `test/unit/operations/query-handler.test.ts`
- **Status**: Not started
- **Contract**:
  - Operation: `list`
  - Input: `tableId`, optional `filters`, `limit`, `offset`, `sort`
  - Output: Array of records
  - Default limit: 5 (MCP token safety)

---

## P1 Contracts (Important - Second Phase)

### RECORD-001: Create Record
- **Behavior**: Create new record with field translation and dry-run safety
- **Source**: Implied from `smartsuite_record` tool schema
- **Phoenix Test**: `test/unit/operations/record-handler.test.ts`
- **Status**: Not started
- **Contract**:
  - Operation: `create`
  - Requires: `appId`, `data` (object)
  - Default: `dry_run: true` (preview mode)
  - Execute: `dry_run: false` (actual creation)
  - Returns: Created record ID + full record

### RECORD-002: Update Record
- **Behavior**: Update existing record by ID
- **Source**: Implied from `smartsuite_record` tool schema
- **Phoenix Test**: `test/unit/operations/record-handler.test.ts`
- **Status**: Not started
- **Contract**:
  - Operation: `update`
  - Requires: `appId`, `recordId`, `data`
  - Default: `dry_run: true`
  - Returns: Updated record

### RECORD-003: Delete Record
- **Behavior**: Delete record by ID
- **Source**: Implied from `smartsuite_record` tool schema
- **Phoenix Test**: `test/unit/operations/record-handler.test.ts`
- **Status**: Not started
- **Contract**:
  - Operation: `delete`
  - Requires: `appId`, `recordId`
  - Default: `dry_run: true`
  - Returns: Deletion confirmation

### SCHEMA-001: Get Table Schema
- **Behavior**: Retrieve field definitions for a table
- **Source**: Implied from `smartsuite_schema` tool
- **Phoenix Test**: `test/unit/operations/schema-handler.test.ts`
- **Status**: Not started
- **Contract**:
  - Input: `appId`
  - Output: Field structure (id, name, type, metadata)
  - Modes: summary (table info), fields (names/types), detailed (full schema)

### DISCOVER-001: Field Discovery
- **Behavior**: Discover available tables and fields
- **Source**: Implied from `smartsuite_discover` tool
- **Phoenix Test**: `test/unit/operations/discover-handler.test.ts`
- **Status**: Not started
- **Contract**:
  - Scope: `tables` → list all available tables
  - Scope: `fields` → list fields for specific `tableId`
  - Critical for finding cryptic field IDs

### UNDO-001: Transaction Rollback
- **Behavior**: Undo previous operations using transaction history
- **Source**: Implied from `smartsuite_undo` tool
- **Phoenix Test**: `test/unit/operations/undo-handler.test.ts`
- **Status**: Not started
- **Contract**:
  - Input: `transaction_id`
  - Action: Reverse the operation (delete created record, restore deleted record, revert update)
  - Returns: Confirmation of rollback

---

## P2 Contracts (Enhancement - Later Phases)

### VALIDATION-001: Input Validation
- **Behavior**: Validate operation inputs before execution
- **Source**: `_legacy_tests/validation-integration.test.ts`
- **Phoenix Test**: TBD
- **Status**: Deferred
- **Contract**: Validate required fields, data types, enum values

### FILTER-001: Advanced Filtering
- **Behavior**: Support complex filter expressions
- **Source**: `_legacy_tests/api-filtering.test.ts`, `filter-integration.test.ts`
- **Phoenix Test**: TBD
- **Status**: Deferred
- **Contract**: Operators (is, has_any_of, contains, etc.), nested conditions

### PAGINATION-001: Cursor-Based Pagination
- **Behavior**: Efficient pagination for large datasets
- **Source**: `_legacy_tests/pagination.test.ts`
- **Phoenix Test**: TBD
- **Status**: Deferred
- **Contract**: Offset/limit + cursor support

### INTELLIGENT-001: Knowledge-Driven API Access
- **Behavior**: AI-guided SmartSuite API operations
- **Source**: Implied from `smartsuite_intelligent` tool
- **Phoenix Test**: TBD
- **Status**: Deferred
- **Contract**: Learn/dry_run/execute modes, endpoint validation

---

## Contract Statistics

- **Total Contracts**: 18
- **P0 (Critical)**: 8 contracts
- **P1 (Important)**: 7 contracts
- **P2 (Enhancement)**: 3 contracts

---

## Implementation Sequence

### Phase 1: Foundation (P0 contracts)
1. AUTH-001, AUTH-002 (authentication)
2. FIELD-001, FIELD-002 (field translation)
3. TABLE-001 (table resolution)
4. FACADE-001, FACADE-002 (MCP tool registration)
5. QUERY-001 (basic query)

### Phase 2: Core Operations (P1 contracts)
6. RECORD-001, RECORD-002, RECORD-003 (CRUD operations)
7. SCHEMA-001 (schema retrieval)
8. DISCOVER-001 (field discovery)
9. UNDO-001 (transaction rollback)

### Phase 3: Enhancements (P2 contracts - defer)
10. Validation, filtering, pagination, intelligent operations

---

## Notes

- All contracts extracted from `_legacy_tests/` quarantine
- Legacy test implementations are CONTAMINATED - only business intent is valid
- Phoenix tests will be written fresh using TRUE TDD (RED → GREEN → REFACTOR)
- Contracts may be refined as implementation reveals edge cases
