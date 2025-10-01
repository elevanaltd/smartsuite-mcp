# SmartSuite API Shim - User Guide

**Version:** 1.2.0  
**Date:** 2025-09-08  
**Status:** ✅ Production Ready - EAV Workspace Configured

## System Overview

**Workspace:** s3qnmox1  
**Architecture:** 3 Solutions, 10 Active Tables, 4-Stream Workflow  
**Purpose:** Elevana AV video production management with human-readable field access

## Getting Started

The SmartSuite API Shim transforms cryptic SmartSuite API field codes into human-readable names, making database operations intuitive and error-free for the EAV video production workflow.

### Quick Start Example

**Before (Raw API):**
```javascript
// Cryptic and error-prone
{
  "project_name_actual": "My Project",
  "sbfc98645c": "client-id-123", 
  "autonumber": "EAV001"
}
```

**After (Human-Readable):**
```javascript
// Clear and intuitive  
{
  "projectName": "My Project",
  "client": "client-id-123",
  "eavCode": "EAV001"
}
```

## EAV Solutions & Tables

The system manages 3 SmartSuite solutions for comprehensive video production workflow:

### Solution 1: EAV Projects (68b6d66b33630eb365ae54cb)
Manages project lifecycle, client relationships, and financial tracking.

| Table | Table ID | Description | Fields |
|-------|----------|-------------|---------|
| **Projects** | `68a8ff5237fde0bf797c05b3` | Project management with 4-stream status tracking | 47 fields |
| **Clients** | `68a8ff34dc58deda12a3bc02` | Client management and relationships | 21 fields |
| **Financial Records** | `68b1cecc4b54c373a5f6fdf5` | Financial tracking and invoicing | Active |
| **Services** | `68b7fb8ed78e0c91416c1787` | Service catalog and offerings | Active |
| **Planning** | `68bace6c51dce2f0d0f5073b` | Resource planning and phase management | 25 fields |

### Solution 2: EAV Operations (68a8eedc2271ce265ebdae8f)
Handles workflow execution, task management, and content production.

| Table | Table ID | Description | Fields |
|-------|----------|-------------|---------|
| **Tasks** | `68a8ffac490e5496953e5b1c` | Streamlined task workflow (4 streams) | 26 fields |
| **Videos** | `68b2437a8f1755b055e0a124` | Video production tracking (Main/VO status) | 21 fields |
| **Schedule** | `68a8ffb767da02533af2bc9c` | Booking and calendar management | 24 fields |
| **Content Items** | `68a8ffc3a38c8a5a547c05b6` | Content asset management | Active |

### Solution 3: EAV System (68ac236dc90313c20428b15d)
System administration and issue tracking.

| Table | Table ID | Description | Fields |
|-------|----------|-------------|---------|
| **Issue Log** | `68ac236dc90313c20428b15f` | Operational issues and enhancement tracking | 26 fields |

## 4-Stream Workflow Architecture

The EAV system organizes video production into 4 parallel workflow streams:

1. **BOOKING Stream**: Project readiness and scheduling (P1-P3 tasks)
2. **ASSET Stream**: Resource collection and preparation (P4-P8 tasks)  
3. **MAIN Stream**: Core production pipeline (V1-V10 + P9-P12 tasks)
4. **VO Stream**: Voice generation workflow (V6 task)

Each stream has status tracking at the project level (Projects table) and task execution at the operational level (Tasks table).

## Important: Mandatory Two-Step Validation Process

⚠️ **All record mutations (create, update, delete) REQUIRE a two-step validation process:**

1. **Step 1 - Validation (dry_run: true):** Validates connectivity, permissions, and data against schema
2. **Step 2 - Execution (dry_run: false):** Executes the operation if validation passed

### What Gets Validated

The dry-run performs **real validation** against the SmartSuite API:

✅ **Connectivity & Authentication**: Tests API access and permissions  
✅ **Schema Validation**: Checks required fields, field types, and valid values  
✅ **Field Name Validation**: Ensures all fields exist in the table  
✅ **System Field Protection**: Prevents setting auto-generated fields  

⚠️ **Not Validated**: Server-side business rules, automations, or complex validations

### Enforcement Rules

The system **enforces** proper validation:
- **Must validate first**: Cannot execute without a successful dry-run
- **Validation expires**: After 5 minutes, must re-validate
- **Data must match**: Any change to data requires new validation
- **Single use**: Each validation is used once then cleared
- **Must pass**: Failed validations cannot be executed

## Using the Tools

### 1. Query Records (`smartsuite_query`)

**List all projects with human-readable filters (EAV Projects solution):**
```javascript
{
  "operation": "list",
  "appId": "68a8ff5237fde0bf797c05b3",  // Projects table
  "filters": {
    "projectPhase": "PRODUCTION",    // Instead of "status"
    "priority": "High",              // Instead of raw priority code
    "client": "client-abc-123"       // Instead of "sbfc98645c"
  },
  "sort": {
    "projectName": "asc"             // Instead of "project_name_actual"
  },
  "limit": 10
}
```

**Get a specific project:**
```javascript
{
  "operation": "get", 
  "appId": "68a8ff5237fde0bf797c05b3",
  "recordId": "project-id-123"
}
```

**Search with filters:**
```javascript
{
  "operation": "search",
  "appId": "68a8ff5237fde0bf797c05b3", 
  "filters": {
    "projectName": "Website Redesign"  // Human-readable search
  }
}
```

### 2. Create/Update Records (`smartsuite_record`)

⚠️ **IMPORTANT: All mutations require a two-step validation process:**

#### Step 1: Validate with Dry-Run
```javascript
{
  "operation": "create",
  "appId": "68a8ff5237fde0bf797c05b3",
  "dry_run": true,                    // MUST be true for validation
  "data": {
    "projectName": "New Website",     // Instead of "project_name_actual"
    "client": "client-xyz-789",       // Instead of "sbfc98645c"
    "priority": "High",               // Instead of priority code
    "projectPhase": "PRE-PRODUCTION", // Instead of "status"
    "initialProjectCost": 15000       // Instead of "initial_cost"
  }
}

// Returns:
{
  "dry_run": true,
  "validation": "passed",              // or "failed" with errors
  "validationChecks": {
    "connectivity": "passed",
    "schema": "passed"
  },
  "message": "DRY-RUN PASSED: Operation validated successfully. You may now execute with dry_run:false within 5 minutes."
}
```

#### Step 2: Execute After Successful Validation
```javascript
{
  "operation": "create",
  "appId": "68a8ff5237fde0bf797c05b3",
  "dry_run": false,                          // NOW set to false
  "data": {
    "projectName": "New Website",           // MUST be identical to Step 1
    "client": "client-xyz-789",
    "priority": "High",
    "projectPhase": "PRE-PRODUCTION",
    "initialProjectCost": 15000
  }
}
```

**Update existing project (also requires two steps):**
```javascript
// Step 1: Validate
{
  "operation": "update",
  "appId": "68a8ff5237fde0bf797c05b3", 
  "recordId": "project-id-123",
  "dry_run": true,                    // Validate first
  "data": {
    "projectPhase": "PRODUCTION",     // Human-readable status
    "priority": "Urgent"              // Human-readable priority
  }
}

// Step 2: Execute (if validation passed)
{
  "operation": "update",
  "appId": "68a8ff5237fde0bf797c05b3", 
  "recordId": "project-id-123",
  "dry_run": false,                   // Execute after validation
  "data": {
    "projectPhase": "PRODUCTION",     // MUST be identical to Step 1
    "priority": "Urgent"
  }
}
```

### 3. Get Schema Info (`smartsuite_schema`)

**Check table schema and field mapping availability:**
```javascript
{
  "appId": "68a8ff5237fde0bf797c05b3"
}
```

**Response includes:**
```javascript
{
  "fields": [...],                    // SmartSuite field definitions
  "fieldMappings": {
    "hasCustomMappings": true,        // Field translation available
    "message": "This table supports human-readable field names..."
  }
}
```

## Field Name Examples by Table

### Projects Table (EAV Projects - 68a8ff5237fde0bf797c05b3)
```yaml
# Human Name → API Code
title: title                         # Project Title (Record Title)
projectName: project_name_actual     # Actual Project Name  
client: sbfc98645c                   # Client (Linked Record)
projectManager: project_manager      # Project Manager
priority: priority                   # Priority Level
projectPhase: status                 # Project Phase (Status Field)
initialProjectCost: initial_cost     # Initial Budget
agreementDate: agreement_date        # Contract Date
finalDelivery: final_delivery        # Final Delivery Date
scriptsDeadline: scripts_deadline    # Scripts Deadline
assetsDeadline: assets_deadline      # Assets Collection Deadline
voDeadline: vo_deadline              # Voiceover Deadline
filmingDeadline: filming_deadline    # Filming Completion Date
eavCode: autonumber                 # EAV Project Code
bookingStreamStatus: bkgstream       # Booking Stream Status
assetStreamStatus: assetstream       # Asset Stream Status
mainStreamStatus: mainstream         # Main Stream Status
dueDate: projdue456                  # Project Due Date
pcDate: pcdate001                    # Practical Completion Date
```

### Tasks Table (EAV Operations - 68a8ffac490e5496953e5b1c)
**Note: Streamlined to 26 fields (2025-09-08)**
```yaml
# Human Name → API Code
taskTitle: title                     # Task Description
description: description             # Detailed Description
assignedTo: assigned_to              # Task Owner
status: taskstatus                   # Task Status
priority: priority                   # Priority Level
duration: due_date                   # Due Date (Duration field)
taskCode: task_code                 # Task Code (P1-P12, V1-V10)
taskVariant: task_variant           # Variant (Multi-select)
workflowStream: work1stream         # Workflow Stream (BOOKING/ASSET/MAIN/VO)
taskLevel: task2level               # Task Level (Project/Video)
project: project_id                 # Project Link
projectCode: sb22aa25c1             # EAV Code (Lookup)
estimatedHours: estimated_hours     # Time Estimate
confirmedHours: confirmed_h         # Confirmed Hours (Editor quoting)
actualHours: actual_hours           # Time Logged
roleCategory: role_category         # Role Classification
workContext: work_context           # Work Environment
dependency: dependency              # Task Dependencies
batchAllocate: batch_alloc         # Batch Video Allocation
```

### Videos Table (EAV Operations - 68b2437a8f1755b055e0a124)
```yaml
# Human Name → API Code  
videoTitle: title                    # Video Title (Record Title)
videoName: video_name               # Video Name (Text)
mainStreamStatus: main_status       # Main Stream Status
voStreamStatus: vo_status           # VO Stream Status
priority: priority                  # Priority Level
projectCode: s16f0c5a34            # Project Code (Lookup)
project: projects_link             # Project (Linked Record)
assignedTo: assignedto1            # Assigned To
targetDuration: target_duration    # Target Duration (minutes)
sequence: video_seq01              # Video Sequence Number
make: make1field                   # Equipment Make
model: model2fld1                  # Equipment Model
videoType: vidtype123              # Video Type
productionType: prodtype01         # Production Type
dueDate: duedate123               # Due Date
```

### Issue Log Table (EAV System - 68ac236dc90313c20428b15f)
```yaml
# Human Name → API Code
title: title                        # Issue Title
description: description            # Issue Description
assignedTo: assigned_to            # Assigned To
status: status                     # Issue Status
dueDate: due_date                 # Due Date
priority: priority                 # Priority Level
type: op_type                     # Issue Type
priorityLevel: op_priority        # Priority Classification
affectedSystems: op_affected_systems # Affected Systems (Multi)
actionItems: op_action_items      # Action Items
solutionNotes: op_solution_notes  # Solution Notes
impactLevel: op_impact_level      # Impact Level
dateResolved: op_date_resolved    # Resolution Date
reporter: reporter001              # Reporter
dateReported: date_rep01          # Date Reported
relatedProject: projectlnk        # Related Project Link
```

## Error Handling & Safety

### Two-Step Validation Pattern (Enforced)
All mutation operations (create/update/delete) **require** a two-step validation process:

```javascript
// ❌ This will fail - No prior validation
{
  "operation": "create",
  "appId": "table-id",
  "dry_run": false,
  "data": { "field": "value" }
  // Error: Validation required: No dry-run found for this operation
}

// ✅ Step 1: Validate with dry-run
{
  "operation": "create",
  "appId": "table-id", 
  "data": { "field": "value" },
  "dry_run": true  // REQUIRED first step
}
// Returns: { validation: "passed", validationChecks: {...} }

// ✅ Step 2: Execute (only if validation passed)
{
  "operation": "create",
  "appId": "table-id",
  "dry_run": false,              // No token needed
  "data": { "field": "value" }    // Must be identical to Step 1
}
```

**Validation Rules (Enforced by Server):**
- Dry-run validation expires after 5 minutes
- Each validation is single-use only
- Data must be identical between steps
- All parameters must match exactly
- The server tracks and enforces these rules automatically

### Field Validation
When using human-readable field names, the system validates against known mappings:

```javascript
// ❌ Unknown field error
{
  "operation": "create",
  "data": {
    "unknownField": "value"  // Will trigger validation error
  }
}

// ✅ Valid field names
{
  "operation": "create", 
  "data": {
    "projectName": "value",  // Known mapping
    "priority": "High"       // Valid option
  }
}
```

### Graceful Degradation
For tables without field mappings, the system falls back to raw API codes:

```javascript
// Table without mappings - uses raw codes
{
  "operation": "list",
  "appId": "unmapped-table-id",
  "filters": {
    "raw_field_code": "value"  // Falls back to API codes
  }
}
```

## Troubleshooting

### Common Issues

**1. Field mapping not loading:**
```
Field mappings not available - server will use raw API field codes
```
- **Solution:** Check that YAML mapping files exist in `/config/field-mappings/`
- **Workaround:** Use raw API field codes temporarily

**2. Unknown field error:**
```
Unmapped fields found for table projects: invalidField. Available fields: projectName, client, priority...
```
- **Solution:** Use one of the listed available field names
- **Reference:** Check YAML mapping files for correct field names

**3. Validation required:**
```  
Validation required: No dry-run found for this operation
```
- **Solution:** Always start with `"dry_run": true` to validate
- **Execute:** Use `"dry_run": false` within 5 minutes (no token needed)

**Token-related errors:**
- **"Token expired"** - Token older than 5 minutes, get a new one
- **"Token validation failed"** - Data changed between steps, keep identical
- **"Token not found"** - Invalid or already used token, tokens are single-use

**4. Authentication failed:**
```
Authentication required: call authenticate() first
```
- **Solution:** Verify SmartSuite API credentials are configured
- **Check:** Environment variables `SMARTSUITE_API_KEY` and `SMARTSUITE_API_URL`

### Debug Information

**Check server startup:**
```bash
# Should show field mapping loading
Loading field mappings from: /path/to/config/field-mappings
FieldTranslator initialized successfully with 9 mappings
```

**Verify table support:**
Use `smartsuite_schema` tool to check if a table has field mappings available.

## Best Practices

### 1. Always Use Two-Step Validation
```javascript
// Step 1: Validate and get token
const validation = await smartsuite_record({
  "operation": "create", 
  "appId": "table-id",
  "dry_run": true, 
  "data": {...}
});

// Step 2: Review the validation response
console.log(validation.validation_token);  // Save this token

// Step 3: Execute with token within 5 minutes
const result = await smartsuite_record({
  "operation": "create",
  "appId": "table-id", 
  "dry_run": false,
  "validation_token": validation.validation_token,
  "data": {...}  // Must be identical to Step 1
});
```

### 2. Use Human-Readable Names
```javascript
// ✅ Good - Self-documenting
{
  "projectName": "Website Redesign",
  "client": "acme-corp", 
  "priority": "High",
  "projectPhase": "PRODUCTION"
}

// ❌ Avoid - Cryptic and error-prone
{
  "project_name_actual": "Website Redesign",
  "sbfc98645c": "acme-corp",
  "priority": "high",  
  "status": "prod"
}
```

### 3. Leverage Schema Information
Before working with a new table, call `smartsuite_schema` to understand:
- Available field mappings
- Field types and constraints  
- Validation requirements

### 4. Handle Errors Gracefully
```javascript
// Always check for field mapping availability
const schema = await smartsuite_schema({ appId: "table-id" });
if (schema.fieldMappings.hasCustomMappings) {
  // Use human-readable field names
} else {
  // Fall back to raw API codes
}
```

## Advanced Usage

### Batch Operations
```javascript
// Create multiple records with consistent field naming
const projects = [
  {
    "projectName": "Project A",
    "client": "client-1", 
    "priority": "High"
  },
  {
    "projectName": "Project B", 
    "client": "client-2",
    "priority": "Normal"  
  }
];

// Note: Each record creation still requires the two-step validation process
for (const project of projects) {
  // Step 1: Get validation token
  const validation = await smartsuite_record({
    operation: "create",
    appId: "68a8ff5237fde0bf797c05b3",
    dry_run: true,
    data: project
  });
  
  // Step 2: Execute with token
  await smartsuite_record({
    operation: "create",
    appId: "68a8ff5237fde0bf797c05b3",
    dry_run: false,
    validation_token: validation.validation_token,
    data: project
  });
}
```

### Complex Filtering
```javascript
{
  "operation": "search",
  "appId": "68a8ff5237fde0bf797c05b3",
  "filters": {
    "projectPhase": "PRODUCTION",
    "priority": ["High", "Urgent"],      // Multiple values
    "client": "important-client",
    "finalDelivery": {                   // Date range
      ">=": "2025-09-01",
      "<=": "2025-12-31" 
    }
  },
  "sort": {
    "priority": "desc",                  // High priority first
    "finalDelivery": "asc"              // Earliest deadline first
  }
}
```

## Support & Resources

### Documentation
- **Handoff Guide:** `../delivery/001-DOC-DELIVERY-B4-HANDOFF.md` - Technical implementation details
- **Field Mappings:** `/config/field-mappings/*.yaml` - Complete field definitions
- **EAV System Design:** `/Volumes/EAV/new-system/data/EAV-Final-Table-Field-List.md` - Authoritative field reference

### Getting Help
1. **Check Schema:** Use `smartsuite_schema` tool to verify field mappings
2. **Validate Fields:** Review YAML mapping files for correct field names  
3. **Test with DRY-RUN:** Always test mutations before executing
4. **Check Logs:** Review server startup logs for field mapping loading

## Change Log

### Version 1.2.0 (2025-09-08)
- **Updated**: Complete EAV solution and table documentation
- **Added**: All 3 EAV solutions with correct table IDs
- **Added**: 4-Stream workflow architecture explanation
- **Updated**: Field examples for all major tables (Projects, Tasks, Videos, Issue Log)
- **Note**: Tasks table streamlined to 26 fields (down from 44)

### Version 1.1.0 (2025-09-08)
- **Fixed**: Two-step validation process
- **Added**: Token expiration and single-use enforcement
- **Improved**: Error messages and safety features

---

**🎯 Transform your SmartSuite experience from cryptic codes to intuitive field names!**

*This guide enables you to leverage the full power of SmartSuite's API through human-readable field names, making database operations faster, safer, and more maintainable for the EAV video production workflow.*