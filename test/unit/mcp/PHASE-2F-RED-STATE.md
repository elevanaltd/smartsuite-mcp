# Phase 2F - RED State Complete ✅

**Date**: 2025-10-01
**TDD Phase**: RED (Test Contracts Written, Implementation Pending)
**Status**: 50/50 tests FAILING (expected)

## Test Contracts Created

### 1. Server Layer Tests (`test/unit/mcp/server.test.ts`)
**Contracts**: SERVER-001 to SERVER-023 (29 tests)

#### Server Initialization (11 tests)
- ✅ SERVER-001: Server instance creation (2 tests)
  - Create MCP Server instance with correct name/version
  - Initialize with server info metadata

- ✅ SERVER-002: Environment configuration loading (4 tests)
  - Load SMARTSUITE_API_KEY from environment
  - Load SMARTSUITE_WORKSPACE_ID from environment
  - Use default API URL if not provided
  - Override API URL from environment if provided

- ✅ SERVER-003: Missing environment variables (3 tests)
  - Throw error if SMARTSUITE_API_KEY missing
  - Throw error if SMARTSUITE_WORKSPACE_ID missing
  - Provide helpful error message for missing configuration

- ✅ SERVER-004: SmartSuite client initialization (2 tests)
  - Create SmartSuite client with loaded configuration
  - Pass API URL to SmartSuite client

#### Tool Registration (9 tests)
- ✅ SERVER-005: Tool count validation (3 tests)
  - Register exactly 2 tools (smartsuite_intelligent, smartsuite_undo)
  - Verify smartsuite_intelligent tool registered
  - Verify smartsuite_undo tool registered

- ✅ SERVER-006: Tool schema validation (3 tests)
  - Register tools with MCP-compliant schemas
  - Define required parameters for smartsuite_intelligent
  - Define required parameters for smartsuite_undo

- ✅ SERVER-007: Tool handler connection (3 tests)
  - Connect smartsuite_intelligent to handler
  - Connect smartsuite_undo to handler
  - Reject unknown tool names

#### Server Lifecycle (9 tests)
- ✅ SERVER-008: Server startup (3 tests)
  - Start server and listen for MCP protocol messages
  - Register tool request handlers on startup
  - Log successful startup

- ✅ SERVER-009: Server shutdown (3 tests)
  - Gracefully shutdown on SIGTERM
  - Gracefully shutdown on SIGINT
  - Close MCP transport on shutdown

- ✅ SERVER-010: Error handling (3 tests)
  - Catch and log unhandled errors
  - Handle tool execution errors gracefully
  - Provide error context for debugging

### 2. Entry Point Tests (`test/unit/index.test.ts`)
**Contracts**: ENTRY-001 to ENTRY-008 (21 tests)

#### Server Export (3 tests)
- ✅ ENTRY-001: Main export structure
  - Export server instance
  - Export startServer function
  - Allow server import by MCP clients

#### STDIO Transport (3 tests)
- ✅ ENTRY-002: Transport creation
  - Create StdioServerTransport for MCP communication
  - Connect transport to server
  - Use process stdin/stdout for transport

#### Signal Handling (5 tests)
- ✅ ENTRY-003: SIGTERM handling (2 tests)
  - Register SIGTERM handler
  - Cleanup resources on SIGTERM

- ✅ ENTRY-004: SIGINT handling (3 tests)
  - Register SIGINT handler
  - Cleanup resources on SIGINT
  - Exit process after cleanup on SIGINT

#### Error Boundaries (6 tests)
- ✅ ENTRY-005: Unhandled error handling (3 tests)
  - Register uncaughtException handler
  - Log uncaught exceptions
  - Exit process on uncaught exception

- ✅ ENTRY-006: Unhandled promise rejection handling (3 tests)
  - Register unhandledRejection handler
  - Log unhandled rejections
  - Exit process on unhandled rejection

#### Bootstrap and Startup (4 tests)
- ✅ ENTRY-007: Configuration loading (2 tests)
  - Load configuration before starting server
  - Fail fast if configuration is invalid

- ✅ ENTRY-008: Server startup (2 tests)
  - Start MCP protocol handler
  - Log successful startup

## RED State Verification

### Test Execution Results
```bash
npm test -- test/unit/mcp/server.test.ts test/unit/index.test.ts
```

**Output**:
```
Test Files  2 failed (2)
     Tests  50 failed (50)
  Duration  120ms
```

### TypeScript Compilation
```bash
npm run typecheck
```

**Output**: ❌ Expected failures (modules not implemented yet)
- `Cannot find module '../../../src/mcp/server.js'`
- `Cannot find module '../../src/index.js'`

## Implementation Requirements

### Files to Create (GREEN phase):

1. **`src/mcp/server.ts`** - MCP Server Layer
   - `createServer()`: Initialize MCP Server instance
   - `getServerInfo()`: Return server metadata
   - `loadConfiguration()`: Load environment variables
   - `initializeClient()`: Create SmartSuite client
   - `getRegisteredTools()`: Return tool schemas
   - `executeToolByName()`: Execute tool by name
   - `startServer()`: Start MCP protocol handler
   - `shutdownServer()`: Graceful shutdown
   - `handleError()`: Error handling

2. **`src/index.ts`** - Entry Point
   - Export `server`: MCP Server instance
   - Export `startServer()`: Bootstrap function
   - `createTransport()`: Create StdioServerTransport
   - `setupSignalHandlers()`: Register SIGTERM/SIGINT handlers
   - `handleUncaughtException()`: Global error handler
   - `handleUnhandledRejection()`: Promise rejection handler

### Architecture Constraints

**Phase 2F Scope**: Minimal 2-tool MCP server
- Tool 1: `smartsuite_intelligent` - Guided SmartSuite operations
- Tool 2: `smartsuite_undo` - Transaction rollback

**Dependencies**:
- MCP SDK: `@modelcontextprotocol/sdk` v0.4.0
- Transport: `StdioServerTransport` for stdio communication
- Server: `Server` class from MCP SDK

**Environment Variables**:
- `SMARTSUITE_API_KEY` (required)
- `SMARTSUITE_WORKSPACE_ID` (required)
- `SMARTSUITE_API_URL` (optional, defaults to production)

## Next Steps (GREEN Phase)

1. ✅ **RED State Complete** - All test contracts written and failing
2. ⏭️ **GREEN Phase** - Implement minimal code to pass tests
   - Create `src/mcp/server.ts` with stubbed functions
   - Create `src/index.ts` with entry point
   - Verify tests pass one by one
3. ⏭️ **REFACTOR Phase** - Optimize implementation
   - Extract common patterns
   - Add error handling improvements
   - Optimize for production use

## Coverage Target

**Phase 2F Goal**: 90% coverage (universal-test-engineer standard)

**Current Coverage**: 0% (implementation pending)

## TRACED Compliance

- ✅ **T (Test)**: Test contracts written first (RED state)
- ⏭️ **R (Review)**: Code review after implementation
- ⏭️ **A (Analyze)**: Architecture validation
- ⏭️ **C (Consult)**: Specialist consultation if needed
- ⏭️ **E (Execute)**: Quality gates (lint, typecheck, tests)
- ⏭️ **D (Document)**: Documentation updates

---

**Test Integrity**: All 50 tests MUST remain failing until proper implementation is complete. No test manipulation to achieve GREEN state.
