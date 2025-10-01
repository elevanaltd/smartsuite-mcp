# B1 Build Plan - SmartSuite Knowledge Platform

**Date:** 2025-09-13
**Phase:** B1 (Planning & Setup)
**Status:** Active
**Technical Architect:** Activated

## Executive Summary

Detailed build plan for SmartSuite Knowledge Platform implementation following B0 validation CONDITIONAL GO. This plan implements mandatory requirements including separate Supabase instance, event sourcing starter kit, and phased rollout strategy.

## B0 Mandatory Requirements Checklist

- [ ] **Separate Supabase Instance** (CRITICAL)
- [ ] **Event Sourcing Starter Kit** before business logic
- [ ] **Concrete Rollback Plan** with feature flags
- [ ] **Phased Implementation** (4 phases defined)

## TRACED Methodology Implementation

### T - Test First (RED State Enforcement)
Every feature starts with failing tests:
```bash
git commit -m "TEST: failing test for event store append"
git commit -m "FEAT: implement event store append"
```

### R - Review
Code review after each component completion

### A - Analyze
Technical architect validation at phase boundaries

### C - Consult
- Critical-engineer for infrastructure decisions
- Test-methodology-guardian for test strategy

### E - Execute
Quality gates: lint + typecheck + tests

### D - Document
TodoWrite tracking throughout

## Phase 1: Core Infrastructure (Week 1-2)

### 1.1 Supabase Infrastructure Setup (Day 1-2)

#### Atomic Tasks:
```typescript
interface InfrastructureTasks {
  "1.1.1": "Create new Supabase project 'smartsuite-knowledge-platform'",
  "1.1.2": "Configure connection pooling (Pro tier)",
  "1.1.3": "Set up environment variables in .env.local",
  "1.1.4": "Create database schema migration files",
  "1.1.5": "Implement connection manager with retry logic",
  "1.1.6": "Add health check endpoint",
  "1.1.7": "Configure real-time subscriptions",
  "1.1.8": "Set up Row Level Security policies"
}
```

**Test Requirements:**
- Connection pool limits test
- Retry mechanism test
- Health check integration test
- RLS policy validation test

### 1.2 Event Sourcing Starter Kit (Day 3-5)

#### Core Components:
```typescript
// Event Store (Append-Only)
interface EventStore {
  append(event: DomainEvent): Promise<EventId>;
  getEvents(aggregateId: string, fromVersion?: number): Promise<DomainEvent[]>;
  getSnapshot(aggregateId: string): Promise<Snapshot | null>;
}

// Domain Event Structure
interface DomainEvent {
  id: string;
  aggregateId: string;
  type: string;
  version: number;
  timestamp: Date;
  userId: string;
  payload: Record<string, unknown>;
  metadata: {
    correlationId: string;
    causationId: string;
  };
}
```

#### Atomic Tasks:
```typescript
interface EventSourcingTasks {
  "1.2.1": "TEST: Event store append operation",
  "1.2.2": "FEAT: Implement event store append",
  "1.2.3": "TEST: Event retrieval by aggregate",
  "1.2.4": "FEAT: Implement event retrieval",
  "1.2.5": "TEST: Snapshot creation at intervals",
  "1.2.6": "FEAT: Implement snapshot mechanism",
  "1.2.7": "TEST: Event replay from snapshot",
  "1.2.8": "FEAT: Implement event replay",
  "1.2.9": "TEST: Dead letter queue for failed events",
  "1.2.10": "FEAT: Implement dead letter queue",
  "1.2.11": "TEST: Event versioning migration",
  "1.2.12": "FEAT: Implement version migration"
}
```

### 1.3 Simple Knowledge Service (Day 6-8)

#### Materialized Views:
```typescript
interface FieldMappingProjection {
  tableId: string;
  fieldMappings: Map<string, FieldDefinition>;
  lastEventVersion: number;
  lastUpdated: Date;
}
```

#### Atomic Tasks:
```typescript
interface KnowledgeServiceTasks {
  "1.3.1": "TEST: Field mapping projection creation",
  "1.3.2": "FEAT: Create field mapping projections",
  "1.3.3": "TEST: Projection update from events",
  "1.3.4": "FEAT: Implement projection updates",
  "1.3.5": "TEST: API endpoint for field lookups",
  "1.3.6": "FEAT: Create lookup API endpoints",
  "1.3.7": "TEST: Cache invalidation on updates",
  "1.3.8": "FEAT: Implement cache strategy",
  "1.3.9": "TEST: Performance <50ms requirement",
  "1.3.10": "FEAT: Optimize query performance"
}
```

### 1.4 API Shim Integration (Day 9-10)

#### Integration Points:
```typescript
interface ShimIntegration {
  discover: "Enhanced with knowledge platform lookups",
  schema: "Augmented with historical patterns",
  intelligent: "Knowledge-guided operations"
}
```

#### Atomic Tasks:
```typescript
interface IntegrationTasks {
  "1.4.1": "TEST: Discover tool knowledge enhancement",
  "1.4.2": "FEAT: Integrate discover with knowledge",
  "1.4.3": "TEST: Schema tool pattern augmentation",
  "1.4.4": "FEAT: Add pattern data to schema",
  "1.4.5": "TEST: Intelligent tool knowledge guidance",
  "1.4.6": "FEAT: Implement knowledge suggestions",
  "1.4.7": "TEST: Fallback to YAML on failure",
  "1.4.8": "FEAT: Implement graceful degradation"
}
```

## Quality Gates & Testing Strategy

### Test Coverage Requirements
- **Unit Tests:** 80% coverage (diagnostic, not blocking)
- **Integration Tests:** All API endpoints
- **Performance Tests:** <50ms field lookups
- **E2E Tests:** Critical user journeys

### CI/CD Pipeline
```yaml
name: Knowledge Platform CI
steps:
  - lint: "npm run lint"
  - typecheck: "npm run typecheck"
  - test:unit: "npm test -- --coverage"
  - test:integration: "npm run test:integration"
  - test:performance: "npm run test:perf"
  - security:scan: "npm audit"
  - deploy:preview: "if PR"
  - deploy:production: "if main + all_checks_pass"
```

### Rollback Strategy

#### Feature Flags:
```typescript
interface FeatureFlags {
  KNOWLEDGE_PLATFORM_ENABLED: boolean;
  EVENT_SOURCING_ENABLED: boolean;
  REAL_TIME_SYNC_ENABLED: boolean;
  WEBHOOK_INTEGRATION_ENABLED: boolean;
}
```

#### Rollback Procedure:
1. **Immediate:** Toggle feature flag off
2. **Data Preservation:** Events remain in append-only log
3. **Fallback:** Revert to YAML file lookups
4. **Recovery:** Fix issues with events intact
5. **Resume:** Re-enable with replay from last snapshot

## Implementation Timeline

### Week 1 (Days 1-5)
- **Day 1-2:** Supabase infrastructure setup
- **Day 3-5:** Event sourcing starter kit

### Week 2 (Days 6-10)
- **Day 6-8:** Simple knowledge service
- **Day 9-10:** API Shim integration

### Week 3 (Phase 2 Start)
- Knowledge automation
- Webhook integration
- Pattern learning

### Week 4 (Phase 3 Start)
- Sync foundation
- Real-time updates
- Conflict resolution

## Success Metrics

### Phase 1 Completion Criteria
- ✅ All 40 atomic tasks completed
- ✅ Tests passing (100% of written tests)
- ✅ Performance: <50ms field lookups verified
- ✅ Rollback tested and documented
- ✅ API Shim fully integrated
- ✅ Zero data loss during migration

### Key Performance Indicators
- **Availability:** 99.9% uptime
- **Performance:** P95 latency <50ms
- **Reliability:** Zero data loss events
- **Scalability:** Handle 10-20 concurrent users

## Risk Mitigation

### Technical Risks
1. **Event Store Performance**
   - Mitigation: Implement snapshotting early
   - Monitoring: Track append latency

2. **Supabase Connection Limits**
   - Mitigation: Connection pooling
   - Monitoring: Active connection count

3. **Migration Complexity**
   - Mitigation: Phased rollout
   - Monitoring: Error rates during migration

### Operational Risks
1. **Team Availability**
   - Mitigation: Document all decisions
   - Backup: Cross-training on components

2. **Dependency Updates**
   - Mitigation: Lock versions in package.json
   - Testing: Automated dependency scanning

## Next Actions

1. **Immediate (Today):**
   - [ ] Provision Supabase instance
   - [ ] Create project structure
   - [ ] Set up CI/CD pipeline

2. **Tomorrow:**
   - [ ] Begin event store implementation
   - [ ] Write first failing tests
   - [ ] Set up monitoring

3. **This Week:**
   - [ ] Complete Phase 1.1 and 1.2
   - [ ] Daily progress updates
   - [ ] End-of-week review

## Approval & Sign-off

**Technical Architect:** Plan approved with TRACED methodology
**Status:** Ready for implementation
**Next Gate:** B1_02 after infrastructure setup

---

*Generated by Technical Architect following B0 validation requirements*
*TRACED methodology enforced throughout execution*