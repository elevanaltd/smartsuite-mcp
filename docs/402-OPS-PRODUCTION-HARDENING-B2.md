# Production Hardening Plan - SmartSuite MCP Server

## Critical Engineering Validation Results

Date: 2025-01-13
Validated By: Critical-Engineer Protocol

## Executive Summary

All 4 remaining critique points represent **PRODUCTION THREATS**, not nice-to-haves. These issues will cause outages, data corruption, or security vulnerabilities if not addressed.

## Priority Order (by Production Impact)

### 1. 🔴 CRITICAL: Auth Context in Audit Logs

**Issue:** Audit logs lack actor/session identification
**Impact:** Cannot perform incident response, meet compliance requirements, or identify compromised accounts
**Will Break:** First security incident or compliance audit

**Fix Implementation:**
```typescript
// In src/audit/audit-logger.ts
interface AuditContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  ipAddress?: string;
}

// Use async_hooks or cls-hooked for context propagation
import { AsyncLocalStorage } from 'async_hooks';
const auditContext = new AsyncLocalStorage<AuditContext>();

// In middleware/request handler
auditContext.run({ userId, sessionId, requestId }, async () => {
  // All downstream code has access to context
});
```

### 2. 🟠 HIGH: Validation Semantics (Dates & Arrays)

**Issue:** No input validation for dates (ISO 8601) or linked record arrays
**Impact:** Data corruption, runtime TypeErrors, broken downstream consumers
**Will Break:** First non-standard date or single-value linked record

**Fix Implementation:**
```typescript
// In src/validation/schemas.ts
import { z } from 'zod';

const dateSchema = z.string().datetime(); // Enforces ISO 8601

const linkedRecordSchema = z.union([
  z.array(z.string()),
  z.string()
]).transform(val => Array.isArray(val) ? val : [val]);

// Apply at API boundary in mcp-server.ts
const validateInput = (data: unknown) => {
  return schema.parse(data); // Throws if invalid
};
```

### 3. 🟠 HIGH: Tool Schema Conditionals

**Issue:** MCP schema allows invalid operations (e.g., 'get' without recordId)
**Impact:** Runtime failures for valid-according-to-schema requests
**Will Break:** Any client attempting 'get' without recordId

**Fix Implementation:**
```json
{
  "oneOf": [
    {
      "properties": {
        "operation": { "const": "get" },
        "recordId": { "type": "string" }
      },
      "required": ["operation", "appId", "recordId"]
    },
    {
      "properties": {
        "operation": { "enum": ["list", "search", "count"] }
      },
      "required": ["operation", "appId"]
    }
  ]
}
```

### 4. 🟠 HIGH: Hidden Coupling via `any` Cast

**Issue:** Direct access to private property via TypeScript bypass
**Impact:** Future refactoring will cause runtime failures
**Will Break:** Next FieldTranslator refactor

**Fix Implementation:**
```typescript
// In src/lib/field-translator.ts
public getMapping(resolvedId: string): FieldMapping | undefined {
  return this.mappings.get(resolvedId);
}

// In src/tools/discover.ts (line 52)
// Replace: const mapping = (fieldTranslator as any).mappings.get(resolvedId)
// With: const mapping = fieldTranslator.getMapping(resolvedId)
```

## Implementation Timeline

### Phase 1: Immediate (Week 1)
- [ ] Auth context in audit logs (CRITICAL)
- [ ] Input validation layer setup

### Phase 2: Short-term (Week 2)
- [ ] Complete validation schemas for all field types
- [ ] Fix tool schema conditionals

### Phase 3: Cleanup (Week 3)
- [ ] Remove hidden coupling
- [ ] Add integration tests for all fixes

## Testing Requirements

Each fix must include:
1. Unit tests for the specific functionality
2. Integration tests for end-to-end flow
3. Failure mode tests (what happens when it breaks)
4. Audit trail verification

## Success Criteria

- [ ] All audit logs include user/session context
- [ ] Invalid data is rejected at API boundary
- [ ] Schema accurately represents all operation requirements
- [ ] No `any` casts in production code
- [ ] All tests passing with >80% coverage on critical paths

## Risk Mitigation

- Deploy fixes incrementally with feature flags
- Monitor error rates after each deployment
- Have rollback procedures ready
- Test in staging environment first

## Notes

These are not code quality improvements - they are production stability requirements. The system is currently under-engineered in critical areas that will cause failures under real-world conditions.

---

*"Build systems that don't break" - Critical Engineering Principle*