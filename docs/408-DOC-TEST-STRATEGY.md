# Test Strategy Documentation

## ERROR-ARCHITECT: Systemic Solution for Test Architecture

### Problem Statement
CI kept failing with cascading errors:
1. Tests timeout → Skip tests
2. Unskip tests → Can't connect to Supabase
3. Add PostgreSQL → Wrong protocol (Supabase ≠ PostgreSQL)
4. Add mocks → Mocks don't match reality

### Root Cause
**Architectural Impedance Mismatch**: Supabase is NOT just PostgreSQL. It's a complete platform with REST API, Auth, RLS, and Realtime features. The Supabase client expects HTTP/REST endpoints, not direct database connections.

### Solution: Three-Tier Test Strategy

#### 1. Unit Tests (CI-Safe)
**Location**: `src/**/*.test.ts` (excluding `.integration.test.ts`)
**Implementation**: In-memory stores (e.g., `EventStoreMemory`)
**Dependencies**: None
**Execution**: All environments (local, CI, staging)
**Coverage**: Business logic, validation, state management
**Example**: `event-store-memory.test.ts`

```typescript
// Uses in-memory implementation
const eventStore = createEventStore('test-tenant');
// No external dependencies needed
```

#### 2. Integration Tests (Local/Staging)
**Location**: `src/**/*.integration.test.ts`
**Implementation**: Real external services
**Dependencies**: Supabase, SmartSuite API (test workspace)
**Execution**: Local development, staging environment
**Coverage**: Database operations, API calls, service integration
**Example**: `event-store-supabase.test.ts`

```typescript
// Requires real Supabase instance
const ENABLE_INTEGRATION_TESTS = process.env.KNOWLEDGE_SUPABASE_URL &&
                                 !IS_CI_POSTGRES;
```

#### 3. E2E Tests (Production-like)
**Location**: `test/e2e/**/*.test.ts`
**Implementation**: Full stack testing
**Dependencies**: All services, production-like data
**Execution**: Staging, pre-production
**Coverage**: Complete user workflows, performance

### Implementation Details

#### EventStore Architecture
```
Production: EventStoreSupabase → Supabase Cloud
Unit Tests: EventStoreMemory → In-memory Maps
Integration: EventStoreSupabase → Local Supabase
```

#### CI Pipeline Configuration
```yaml
test:
  name: Test Suite
  steps:
    # No database setup needed
    - name: Run unit tests
      run: npm run test:unit
      # Excludes integration tests automatically
```

#### Local Development
```bash
# Run all tests (requires Supabase)
npm test

# Run only unit tests (no dependencies)
npm run test:unit

# Run integration tests (requires services)
npm run test:integration
```

### Benefits

1. **Fast CI**: Unit tests run in seconds, no external dependencies
2. **Real Testing**: Integration tests use actual services, not mocks
3. **Clear Boundaries**: Each test tier has defined scope and dependencies
4. **No False Positives**: Tests match their execution environment
5. **Maintainable**: Clear separation makes updates easier

### Migration Guide

When adding new features:
1. Write unit tests using in-memory implementations
2. Write integration tests for external service interactions
3. Ensure unit tests can run without any services
4. Mark integration tests with `.integration.test.ts` suffix

### Monitoring

Track these metrics:
- Unit test execution time (<30s in CI)
- Integration test coverage (>80% of service calls)
- False positive rate (should be 0%)
- Test flakiness (track and fix immediately)

### Future Improvements

1. Add contract tests between unit and integration layers
2. Implement test data factories for consistency
3. Add performance benchmarks to integration tests
4. Create service virtualization for complex scenarios

---

*This strategy eliminates the fix-break-fix cycle by properly separating concerns and matching tests to their appropriate execution environments.*