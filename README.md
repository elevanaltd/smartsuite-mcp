<!-- LINK_VALIDATION_BYPASS: coordination directory docs not in staging worktree -->
# SmartSuite API Shim

**Status:** ⚠️ Phase 2G Complete (Analysis Only) - Phase 2H (Execution) Pending
**Test Coverage:** 464+ tests passing with intelligent handler and knowledge base validation
**Server Status:** 2-tool Sentinel Architecture with safety analysis (execution modes incomplete)  

## Quick Start

> **⚠️ IMPORTANT**: Read [`docs/001-ARCHITECTURE.md`](./docs/001-ARCHITECTURE.md) before making changes to understand system constraints and common failure modes.

1. **Prerequisites:** Node.js 18+, npm, SmartSuite API credentials
2. **Installation:** `npm install`
3. **Build:** `npm run build`
4. **Configuration:** Set environment variables `SMARTSUITE_API_TOKEN` and `SMARTSUITE_WORKSPACE_ID`
5. **Usage:** `npm start` - MCP server with 2-tool Sentinel Architecture

> **⚠️ CURRENT LIMITATION**: The intelligent tool provides safety analysis but execution modes (dry_run, execute) are not yet implemented. See [Validation Report](../coordination/reports/api/806-REPORT-API-VALIDATION.md) for details.

## Features

🎯 **Phase 2G Achievements (Sentinel Architecture):**
- ✅ **Auto-Authentication** - Environment variable authentication with fail-fast pattern
- ✅ **Knowledge Base** - Pattern matching for 5 critical safety checks (UUID corruption, bulk limits, HTTP methods, SmartDoc format, field IDs)
- ✅ **2-Tool Sentinel Pattern** - Intelligent facade + undo (replaces 6 individual tools per blueprint design)
- ✅ **Safety Analysis** - 3-tier system (RED/YELLOW/GREEN) with actionable guidance
- ✅ **Comprehensive Testing** - 464+ tests with intelligent handler and knowledge base validation
- ✅ **CI/CD Pipeline** - Fully resolved with CodeQL integration and quality gates
- ✅ **Error Handling** - Graceful degradation and clear error messages
- ✅ **Enhanced Code Quality** - Nullish coalescing, console cleanup, path resolution fixes

⚠️ **Phase 2H Pending (Execution Modes):**
- ❌ **Mode-based Routing** - learn/dry_run/execute modes not implemented
- ❌ **API Execution** - SmartSuiteClient integration in intelligent handler missing
- ❌ **CRUD Operations** - Cannot perform actual create/read/update/delete operations
- ❌ **Transaction History** - Undo functionality blocked by missing execution

### Available MCP Tools (Sentinel Architecture)

| Tool | Description | Implementation Status |
|------|-------------|----------------------|
| `smartsuite_intelligent` | Universal SmartSuite operations with intelligent routing and safety analysis | ⚠️ Analysis only - execution modes pending |
| `smartsuite_undo` | Transaction rollback operations | ⚠️ Placeholder - requires execution to generate transactions |

**Architecture Note**: Per the Phoenix Rebuild Blueprint, the server uses a **2-tool Sentinel Pattern** where `smartsuite_intelligent` acts as a unified facade that routes to internal handlers (query, record, schema, discover). Individual tools are intentionally not exposed at the MCP layer.

### Internal Operation Handlers (Not Exposed)

These handlers exist in the codebase but are accessed through the intelligent facade:

| Handler | Purpose | Status |
|---------|---------|--------|
| `QueryHandler` | List, search, get records | ✅ Implemented |
| `RecordHandler` | Create, update, delete records | ✅ Implemented |
| `SchemaHandler` | Get table schema and field definitions | ✅ Implemented |
| `DiscoverHandler` | Field mapping discovery | ✅ Implemented |

**Current Gap**: The intelligent facade analyzes operations but doesn't yet route to these handlers for execution.

### Supported Tables (10 Configured with Example Mappings)
- **Projects** (47 mapped fields) - Core project management
- **Tasks** (26 mapped fields) - Task tracking and assignments  
- **Videos** (21 mapped fields) - Video production workflow
- **Clients** (21 mapped fields) - Client relationship management
- **Schedule** (24 mapped fields) - Calendar and timeline management
- **Planning** (25 mapped fields) - Resource planning and phase management
- **Financial Records** - Cost tracking and invoicing
- **Services** - Service catalog and offerings
- **Content Items** - Content asset management
- **Issue Log** (26 mapped fields) - Problem tracking and resolution

**Note:** Field mappings are workspace-specific. Copy examples from `config/field-mappings/examples/` to create your own mappings.

## Development

This is a TypeScript project. The source code is located in the `/src` directory. It is compiled into JavaScript in the `/build` directory for execution. **Do not edit files in `/build` directly, as they will be overwritten.**

### Prerequisites
- Node.js v18.x or higher
- npm

### Running Locally
1. Install dependencies: `npm install`
2. Run in development mode (with auto-reload): `npm run dev`

### Building for Production
1. Compile TypeScript: `npm run build`
2. Run the compiled code: `npm start`

### Testing
- Run all tests: `npm test`
- Run tests with coverage: `npm run test:coverage`
- Watch mode: `npm run test:watch`

## Project Structure
- `src/` - TypeScript source code  
- `build/` - Compiled JavaScript (generated, do not edit)
- `test/` - Test suites
- `docs/` - Documentation
- `reports/` - Build phase reports

## Configuration & Usage

### Field Mappings Setup
Since field mappings are workspace-specific and not included in the repository:

1. **Copy example mappings** from `config/field-mappings/examples/`
2. **Remove `.example` suffix** from filenames  
3. **Place in** `config/field-mappings/` directory
4. **Customize** field mappings for your SmartSuite workspace

The system automatically loads all `.yaml` files from `config/field-mappings/` on startup.

### Environment Variables

**Required for Auto-Authentication:**
```bash
# Set these for automatic authentication on server startup
export SMARTSUITE_API_TOKEN="your-smartsuite-api-key"
export SMARTSUITE_WORKSPACE_ID="your-workspace-id"
```

**Optional Configuration:**
```bash
# Override knowledge base location (defaults to auto-discovery via package.json)
export KNOWLEDGE_BASE_PATH="/absolute/path/to/coordination/smartsuite-truth"
```

The knowledge base path is resolved using a multi-layered strategy:
1. **Explicit path** (for tests) - provided as function argument
2. **KNOWLEDGE_BASE_PATH** env var (for production/staging) - explicit override
3. **Auto-discovery** (for local development) - finds project root via package.json

Most users don't need to set KNOWLEDGE_BASE_PATH as auto-discovery works correctly.

### Production Deployment
```bash
# Compile and run
npm run build
npm start

# Validation mode (for CI/CD)
MCP_VALIDATE_AND_EXIT=true npm start
```

### Integration with Claude Desktop
Add to your Claude Desktop MCP configuration:
```json
{
  "mcpServers": {
    "smartsuite": {
      "command": "node",
      "args": ["/path/to/smartsuite-api-shim/build/src/index.js"],
      "env": {
        "SMARTSUITE_API_TOKEN": "your-api-token",
        "SMARTSUITE_WORKSPACE_ID": "your-workspace-id"
      }
    }
  }
}
```

## Critical Documentation - READ FIRST

### 🚨 System Context (Required Reading)
- **🎯 NORTH STAR**: [`docs/000-NORTH-STAR.md`](./docs/000-NORTH-STAR.md) - Project vision and goals  
- **🏗️ ARCHITECTURE**: [`docs/001-ARCHITECTURE.md`](./docs/001-ARCHITECTURE.md) - System design, failure modes, what will break

### User & Technical Guides
- **Complete User Guide**: [`docs/guides/001-DOC-GUIDE-USER-GUIDE.md`](./docs/guides/001-DOC-GUIDE-USER-GUIDE.md) - Detailed usage instructions with examples
- **Technical Handoff**: [`docs/delivery/202-PROJECT-SMARTSUITE-API-SHIM-B4-HANDOFF.md`](./docs/delivery/202-PROJECT-SMARTSUITE-API-SHIM-B4-HANDOFF.md) - Implementation details and architecture

### Example Usage (When Execution Modes Implemented)

```javascript
// Learn mode - analyze operation for safety (CURRENTLY WORKING)
{
  "endpoint": "/applications/68a8ff5237fde0bf797c05b3/records/list/",
  "method": "POST",
  "operationDescription": "List all projects",
  "mode": "learn"  // Returns safety analysis only
}

// Execute mode - perform actual operation (NOT YET IMPLEMENTED)
{
  "endpoint": "/applications/68a8ff5237fde0bf797c05b3/records/",
  "method": "POST",
  "operationDescription": "Create new project record",
  "mode": "execute",  // Would execute after safety check
  "payload": {
    "title": "Website Redesign",
    "priority": "High"
  }
}
```

**Current Behavior**: All modes return safety analysis. Execution logic pending Phase 2H implementation.

## Current Development Status

### ✅ What's Complete (Phase 2G)
- **Knowledge Base System**: 5 critical safety patterns loaded from `/coordination/smartsuite-truth/`
- **Safety Analysis**: 3-tier RED/YELLOW/GREEN system with actionable corrections
- **Intelligent Handler**: analyze() method with pattern matching and guidance generation
- **Server Infrastructure**: 2-tool MCP registration with proper protocol compliance
- **Test Coverage**: 464+ tests covering analysis, knowledge base, and handlers

### ⚠️ What's Pending (Phase 2H - Execution Modes)
See [Validation Report](../coordination/reports/api/806-REPORT-API-VALIDATION.md) for complete analysis.

**Required Implementation**:
1. **Mode Parameter Handling** - Switch behavior based on learn/dry_run/execute
2. **Client Integration** - Add SmartSuiteClient to IntelligentHandler via setClient()
3. **Execute Method** - Implement execute() that analyzes then calls API
4. **Validate Method** - Implement validate() for dry-run previews
5. **Response Wrapping** - Return both analysis and API data

**Estimated Effort**: 4-6 hours for senior developer familiar with codebase

### 📋 Next Steps
1. Review [Phoenix Rebuild Blueprint](../coordination/phoenix-rebuild/001-D3-PHOENIX-REBUILD-BLUEPRINT.md)
2. Review [Validation Report](../coordination/reports/api/806-REPORT-API-VALIDATION.md)
3. Implement execution modes per blueprint Section 1.3 (Data Flow Patterns)
4. Complete Phase 4 validation checklist in [CURRENT-CHECKLIST.md](../coordination/CURRENT-CHECKLIST.md)

## Coordination Access
Access project management via `.coord/` symlink
