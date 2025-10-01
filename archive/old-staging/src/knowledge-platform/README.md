# SmartSuite Knowledge Platform

Event-sourced knowledge management system for SmartSuite field mappings and patterns.

## Architecture

```
knowledge-platform/
├── core/           # Domain models and business logic
├── events/         # Event store and event handling
├── projections/    # Materialized views and read models
├── api/           # REST API endpoints
├── infrastructure/ # Supabase client and connections
└── migrations/    # Database migrations
```

## Implementation Status

- [ ] Phase 1: Core Infrastructure (Week 1-2)
- [ ] Phase 2: Knowledge Automation (Week 3)
- [ ] Phase 3: Sync Foundation (Week 4)
- [ ] Phase 4: EAV Integration (Future)

## Quick Start

```bash
# Set up environment
cp .env.example .env.local
# Add SUPABASE_URL and SUPABASE_ANON_KEY

# Run migrations
npm run migrate:up

# Start development
npm run dev:knowledge
```

## Testing

```bash
# Unit tests
npm test src/knowledge-platform

# Integration tests
npm run test:integration:knowledge

# Performance tests
npm run test:perf:knowledge
```