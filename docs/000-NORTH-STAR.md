# SmartSuite API Shim - North Star Reference

**Status:** Reference Document  
**Location:** This is a reference to the canonical North Star document  
**Canonical Source:** `.coord/workflow-docs/000-SMARTSUITE-API-SHIM-D1-NORTH-STAR.md`

## North Star Location

The canonical North Star document for this project is maintained in the coordination repository:

```
.coord/workflow-docs/000-SMARTSUITE-API-SHIM-D1-NORTH-STAR.md
```

## Purpose

This reference ensures that developers working in the build repository can quickly locate the project North Star while maintaining the two-repository pattern where:

- **Build Repository** (`/staging/`): Contains system architecture, technical documentation, and development guides
- **Coordination Repository** (`/coordination/`): Contains project management artifacts, phase reports, and workflow documentation including the North Star

## Quick Access

For direct access to the North Star document:

```bash
# From project root
cat .coord/workflow-docs/000-SMARTSUITE-API-SHIM-D1-NORTH-STAR.md

# Or via symlink
ls -la .coord/
```

## Document Hierarchy

- **This document (100-PROJECT-*)**: North Star reference for build repository
- **Canonical North Star (000-PROJECT-*)**: Complete project requirements and immutable vision
- **System Architecture (012-SYSTEM-*)**: Technical implementation of North Star vision

---

*This reference document follows HestAI naming standards while maintaining clear separation between build and coordination concerns.*