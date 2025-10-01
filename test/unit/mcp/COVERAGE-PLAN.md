# Phase 2E MCP Tool Layer - Test Coverage Plan

**Created**: 2025-10-01
**Phase**: 2E - MCP Tool Layer (Sentinel Pattern Facade)
**Status**: RED state (46 failing tests, implementation pending)
**Target**: 90% coverage (universal-test-engineer standard)

---

## Architecture Overview

```
MCP Protocol (Claude Desktop)
        ↓
  MCP Tool Layer (5 tools) ← THIS LAYER
        ↓
  Handler Layer (106 tests GREEN)
        ↓
  SmartSuite Client
        ↓
  SmartSuite API
```

**Responsibilities**:
- Expose MCP-compliant tool schemas
- Validate MCP protocol parameters
- Delegate to appropriate handlers
- Transform responses to MCP format
- Propagate errors with MCP error codes

---

## Test Coverage Breakdown

### Tool 1: smartsuite_query (8 contracts)

| Contract | Test ID | Description | Coverage Area |
|----------|---------|-------------|---------------|
| MCP-TOOLS-001 | Schema validation | MCP schema structure compliance | Protocol compliance |
| MCP-TOOLS-002a | Parameter: tableId required | Required parameter validation | Input validation |
| MCP-TOOLS-002b | Parameter: operation enum | Enum constraint validation | Input validation |
| MCP-TOOLS-002c | Parameter: recordId for get | Conditional parameter logic | Input validation |
| MCP-TOOLS-002d | Parameter: limit range | Numeric range validation | Input validation |
| MCP-TOOLS-003a | Delegation: list operation | Handler invocation correctness | Handler integration |
| MCP-TOOLS-003b | Delegation: get operation | RecordId propagation | Handler integration |
| MCP-TOOLS-004 | Error handling | Error propagation to MCP | Error handling |

**Expected Lines of Code**: ~80 lines
**Coverage Target**: 95% (simple delegation logic)

---

### Tool 2: smartsuite_record (9 contracts)

| Contract | Test ID | Description | Coverage Area |
|----------|---------|-------------|---------------|
| MCP-TOOLS-005 | Schema: dry_run default | Safety default validation | Protocol safety |
| MCP-TOOLS-006a | Parameter: tableId required | Required parameter validation | Input validation |
| MCP-TOOLS-006b | Parameter: data for create/update | Conditional parameter logic | Input validation |
| MCP-TOOLS-006c | Parameter: recordId for update/delete | Conditional parameter logic | Input validation |
| MCP-TOOLS-006d | Parameter: dryRun type | Boolean type validation | Input validation |
| MCP-TOOLS-007a | Delegation: create with dry_run | Default safety behavior | Handler integration |
| MCP-TOOLS-007b | Delegation: update with execute | Explicit dry_run=false | Handler integration |
| MCP-TOOLS-007c | Delegation: delete operation | RecordId propagation | Handler integration |
| MCP-TOOLS-008 | Error handling | Validation error propagation | Error handling |

**Expected Lines of Code**: ~120 lines
**Coverage Target**: 95% (delegation + validation)

---

### Tool 3: smartsuite_schema (8 contracts)

| Contract | Test ID | Description | Coverage Area |
|----------|---------|-------------|---------------|
| MCP-TOOLS-009 | Schema: output modes | Mode enum validation | Protocol compliance |
| MCP-TOOLS-010a | Parameter: tableId required | Required parameter validation | Input validation |
| MCP-TOOLS-010b | Parameter: outputMode enum | Enum constraint validation | Input validation |
| MCP-TOOLS-011a | Delegation: summary mode | Default mode behavior | Handler integration |
| MCP-TOOLS-011b | Delegation: fields mode | Mode-specific logic | Handler integration |
| MCP-TOOLS-011c | Delegation: detailed mode | Mode-specific logic | Handler integration |
| MCP-TOOLS-012 | Error handling | Schema error propagation | Error handling |

**Expected Lines of Code**: ~70 lines
**Coverage Target**: 95% (simple delegation)

---

### Tool 4: smartsuite_discover (7 contracts)

| Contract | Test ID | Description | Coverage Area |
|----------|---------|-------------|---------------|
| MCP-TOOLS-013 | Schema: operation modes | Mode enum validation | Protocol compliance |
| MCP-TOOLS-014a | Parameter: operation required | Required parameter validation | Input validation |
| MCP-TOOLS-014b | Parameter: tableId for fields | Conditional parameter logic | Input validation |
| MCP-TOOLS-014c | Parameter: operation enum | Enum constraint validation | Input validation |
| MCP-TOOLS-015a | Delegation: fields discovery | TableId propagation | Handler integration |
| MCP-TOOLS-015b | Delegation: tables discovery | Mode-specific logic | Handler integration |
| MCP-TOOLS-016 | Error handling | Discovery error propagation | Error handling |

**Expected Lines of Code**: ~70 lines
**Coverage Target**: 95% (simple delegation)

---

### Tool 5: smartsuite_undo (6 contracts)

| Contract | Test ID | Description | Coverage Area |
|----------|---------|-------------|---------------|
| MCP-TOOLS-017 | Schema: transaction_id | Schema structure validation | Protocol compliance |
| MCP-TOOLS-018a | Parameter: transaction_id required | Required parameter validation | Input validation |
| MCP-TOOLS-018b | Parameter: transaction_id format | String validation | Input validation |
| MCP-TOOLS-019 | Delegation: undo operation | Handler invocation | Handler integration |
| MCP-TOOLS-020a | Error handling: not found | Transaction not found error | Error handling |
| MCP-TOOLS-020b | Error handling: already reversed | Double-undo prevention | Error handling |

**Expected Lines of Code**: ~60 lines
**Coverage Target**: 95% (simple delegation)

---

### Cross-Cutting Concerns (8 contracts)

| Contract | Test ID | Description | Coverage Area |
|----------|---------|-------------|---------------|
| MCP-TOOLS-021 | Tool registration | All 5 tools exposed | Registry pattern |
| MCP-TOOLS-022 | Client injection | DI pattern for handlers | Dependency injection |
| MCP-TOOLS-023a | Error standardization | Consistent error format | Error handling |
| MCP-TOOLS-023b | Error codes | Known error type mapping | Error handling |
| MCP-TOOLS-024 | Response formatting | MCP protocol compliance | Response transformation |
| MCP-TOOLS-025 | Authentication state | Auth enforcement | Security |
| MCP-TOOLS-026 | Concurrent execution | Thread safety | Concurrency |
| MCP-TOOLS-027 | Memory efficiency | Response size limiting | Performance |
| MCP-TOOLS-028 | Tool documentation | LLM-friendly descriptions | Documentation |

**Expected Lines of Code**: ~150 lines (utility functions)
**Coverage Target**: 85% (some edge cases acceptable)

---

## Total Coverage Summary

| Category | Test Contracts | Expected LOC | Target Coverage |
|----------|----------------|--------------|-----------------|
| Tool implementations | 38 contracts | ~400 lines | 95% |
| Cross-cutting utilities | 8 contracts | ~150 lines | 85% |
| **TOTAL** | **46 contracts** | **~550 lines** | **90%+** |

---

## Implementation Strategy

### Phase 1: Core Tool Functions
1. `getToolSchemas()` - Return all 5 MCP tool definitions
2. `executeQueryTool(params)` - Query operations wrapper
3. `executeRecordTool(params)` - Record mutation wrapper
4. `executeSchemaTool(params)` - Schema retrieval wrapper
5. `executeDiscoverTool(params)` - Discovery wrapper
6. `executeUndoTool(params)` - Undo wrapper

### Phase 2: Shared Utilities
7. `setToolsClient(client)` - DI for SmartSuiteClient
8. `formatToolError(error)` - Error standardization
9. `formatToolResponse(tool, result)` - Response formatting
10. `validateToolAuth()` - Authentication guard

### Phase 3: Parameter Validators
11. `validateQueryParams(params)` - Query-specific validation
12. `validateRecordParams(params)` - Record-specific validation
13. `validateSchemaParams(params)` - Schema-specific validation
14. `validateDiscoverParams(params)` - Discover-specific validation
15. `validateUndoParams(params)` - Undo-specific validation

---

## Test Execution Results

### Initial RED State (Expected)
```
✗ 46 tests failing (module not found)
✓ 44 handler tests passing (unchanged)
Status: RED confirmed - ready for implementation
```

### Target GREEN State
```
✓ 46 MCP tool tests passing
✓ 44 handler tests passing (unchanged)
✓ 90%+ coverage achieved
Status: GREEN - ready for integration
```

---

## Critical Success Criteria

1. **MCP Protocol Compliance**: All tool schemas match MCP SDK expectations
2. **Handler Delegation**: Correct handler methods invoked with proper context
3. **Error Propagation**: Handler errors reach MCP client with clear messages
4. **Safety Defaults**: `dry_run=true` default enforced for mutations
5. **Input Validation**: Required parameters validated before handler delegation
6. **No Regression**: All 44 existing handler tests remain GREEN

---

## Known Edge Cases

1. **Concurrent Requests**: Tools must be stateless (no shared mutable state)
2. **Large Responses**: Limit enforcement for MCP token optimization
3. **Authentication Timing**: Client injection before any tool execution
4. **Error Format Consistency**: All tools use same error structure
5. **Parameter Defaults**: Explicit defaults for optional parameters

---

## Testing Anti-Patterns to Avoid

❌ **Testing business logic** (already covered in handler tests)
❌ **Mocking the MCP SDK** (trust the SDK, test our integration)
❌ **Over-specifying response format** (flexible for future changes)
❌ **Testing handler internals** (test delegation, not implementation)
❌ **Excessive type assertions** (TypeScript provides compile-time safety)

✅ **Testing MCP protocol compliance** (schema structure, parameter validation)
✅ **Testing delegation correctness** (right handler, right parameters)
✅ **Testing error propagation** (errors reach MCP client)
✅ **Testing safety defaults** (dry_run=true enforced)
✅ **Testing input validation** (required parameters, enum constraints)

---

## Coverage Gap Analysis

### Expected Uncovered Lines (<10%)

1. **Type guards**: Runtime type validation (TypeScript covers most)
2. **Defensive programming**: Null checks for impossible states
3. **Debug logging**: Non-critical diagnostic code
4. **Error message formatting**: Minor string interpolation variants

### Areas Requiring 100% Coverage

1. **Parameter validation logic**: All validation branches must be tested
2. **Handler delegation**: All tools must have delegation test
3. **Error propagation**: All error paths must be verified
4. **Safety defaults**: dry_run=true behavior must be proven

---

## Integration with Phase 2F

**Next Phase**: MCP Server Integration (Phase 2F)
- Wire tools into MCP SDK server
- Implement STDIO transport
- Add server lifecycle management
- Integration tests with actual MCP protocol

**Prerequisites for 2F**:
- ✅ All 46 tool tests GREEN
- ✅ 90%+ coverage achieved
- ✅ No handler test regressions
- ✅ Tool schemas validated against MCP SDK

---

## Maintenance Notes

**When to update these tests**:
- Adding new MCP tools (update MCP-TOOLS-021)
- Changing tool schemas (update schema validation tests)
- Adding new error codes (update MCP-TOOLS-023)
- Modifying parameter validation (update parameter tests)

**Test stability**:
- Tests use mocked handlers (no external dependencies)
- Deterministic (no timing/randomness)
- Fast (<100ms total execution)
- Isolated (no shared state between tests)

---

**Test Integrity Checkpoint**: RED state verified ✅
**Ready for Implementation**: Phase 2E GREEN implementation can begin
**TDD Discipline**: Tests written first, implementation follows
