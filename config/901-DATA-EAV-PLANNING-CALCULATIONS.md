# EAV Planning Calculations Reference

**Replaces:** `/Volumes/EAV/new-system/task-timeframes.xlsx`  
**Version:** 1.0  
**Date:** 2025-01-10  
**Working Day:** 7.5 hours  

## Overview

This document defines the calculation logic for EAV video production project timelines. All calculations work backward from **P11-Client Delivery = Project Due Date**.

## Video Count Variables

```yaml
# Source: SmartSuite Tasks table lookup fields
new_vids: sac1cc3284      # Count of videos with prodtype01 = "new_prod"
amend_vids: s0a1f5ad8f    # Count of videos with prodtype01 = "amend_minor|amend_major" 
reuse_vids: s4e387c8f5    # Count of videos with prodtype01 = "reuse_prod"

# Calculation Variables
NEWVID = new_vids + amend_vids  # Used in most task duration formulas
total_vids = new_vids + amend_vids + reuse_vids
```

## Three-Field Model (Updated)

**Field Purpose Definitions:**
1. **`due_date`** (duedatefield): Simple deadline for My Work overview
2. **`duration`** (duedatefield): Window constraints (when work CAN happen)
3. **`rsrc_alloc`** (daterangefield): Visual resource allocation/booking

## Task Duration & Resource Calculations

### Project-Level Tasks

| Task | Window Duration | Resource Days | Buffer | Formula/Notes |
|------|----------------|---------------|---------|---------------|
| **P1-Setup** | 3 | 0.15 | - | Foundation task |
| **P2-Booking (Recce)** | 5 | 0.15 | +14 days | 2-week booking buffer |
| **P2-Booking (Shoot)** | 10 | 0.15 | +14 days | 2-week booking buffer |
| **P3-Attendance (Recce)** | 1 | 1.0 | - | Full day attendance |
| **P4-Branding Collection** | 10 | 0.15 | - | Can run parallel |
| **P5-Music Collection** | 5 | 0.15 | - | After branding |
| **P6-MOGRT Check** | 5 | 0.15 | - | Can run with P5 |
| **P7-MOGRT Creation** | 3 | 0.25 | - | Only if MOGRT needed |
| **P8-Spec Collection** | 5 | 0.25 | - | Can run parallel |
| **P9-Filming** | `ROUNDUP(0.15 * NEWVID, 0.5)` | per video | - | Rounded up to half-days |
| **P10-Media Ingestion** | 3 | 0.15 | - | After filming |
| **P11-Client Delivery** | 3 | 0.15 | - | = Project Due Date |
| **P12-Completion** | 5 | 0.15 | - | +7 days after P11 |

### Video-Level Tasks (Batch Allocated)

| Task | Window Duration | Resource Formula | Notes |
|------|----------------|------------------|-------|
| **V1-User Manual Collection** | 5 | `0.05 * NEWVID` | Only if user_manual_checkbox = true |
| **V2-Script Creation** | 5 | `0.15 * NEWVID` | New + Amend videos |
| **V3-Script Review (Client)** | 5 | - | 7-day auto-approve |
| **V4-Script Revision (Internal)** | 3 | `0.08 * NEWVID * 0.25` | Buffer: 25% probability |
| **V4-Script Revision (Client)** | 2 | `0.15 * NEWVID * 0.25` | Buffer: 25% probability |
| **V5-Scene Planning** | 5 | `0.15 * NEWVID` | Can run parallel with V6 |
| **V6-VO Generation** | 5 | `0.08 * NEWVID` | Can run parallel with V5 |
| **V7-Edit Prep** | 3 | `0.08 * NEWVID` | After ingestion + assets |
| **V8-Video Edit (Quoting)** | 3 | 0.15 | PM-Editor negotiation |
| **V8-Video Edit (Editing/Grading)** | `ROUNDUP(0.25 * NEWVID, 0.5)` | per video | Rounded to half-days |
| **V9-Video Review (Internal)** | 3 | `0.08 * NEWVID` | Internal QA |
| **V9-Video Review (Client)** | 5 | - | 7-day auto-approve |
| **V10-Video Revision (Internal)** | 2 | `0.15 * NEWVID * 0.25` | Buffer: 25% probability |
| **V10-Video Revision (Client)** | 2 | `0.15 * NEWVID * 0.25` | Buffer: 25% probability |

### Special Workflows

| Task | Window Duration | Notes |
|------|----------------|-------|
| **V9-Video Review (Reuse)** | 10 | Day 3-5, early review for reuse videos |

## Backward Scheduling Logic

**Starting Point:** P11-Client Delivery = Project Due Date

**Key Principle:** Tasks are calculated backward from the due date to determine their latest start dates, but execute forward in logical sequence. Each task has a window duration creating a from_date (start) and to_date (end).

**Calculation Flow (Working Backward from Due Date):**
```
1. P11-Delivery to_date = Project Due Date
2. P11-Delivery from_date = P11 to_date - 3 days (window duration)
3. P10-Ingestion to_date = P11 from_date
4. P10-Ingestion from_date = P10 to_date - 3 days
5. P9-Filming to_date = P10 from_date  
6. P9-Filming from_date = P9 to_date - ROUNDUP(0.15 * NEWVID * 6, 0) days
7. P2-Booking(Shoot) to_date = P9 from_date
8. P2-Booking(Shoot) from_date = P2-Booking(Shoot) to_date - 10 days - 14 buffer days
9. P3-Attendance(Recce) to_date = P2-Booking(Shoot) from_date
10. P3-Attendance(Recce) from_date = P3 to_date - 1 day
11. P2-Booking(Recce) to_date = P3 from_date
12. P2-Booking(Recce) from_date = P2 to_date - 5 days - 14 buffer days
13. P1-Setup to_date = P2-Booking(Recce) from_date
14. P1-Setup from_date = P1 to_date - 3 days

Video Stream (parallel with main production):
15. V10-Video Revision(Client) to_date = P11 from_date
16. V10-Video Revision(Client) from_date = V10-Client to_date - 2 days
17. V9-Video Review(Client) to_date = V10-Video-Revision(Client) from_date
18. V9-Video Review(Client) from_date = V9 to_date - 5 days
19. V9-Video Review(Internal) to_date = V9-Client from_date
20. V9-Video Review(Internal) from_date = V9-Internal to_date - 3 days
21. V8-Video Edit to_date = V9-Internal from_date
22. V8-Video Edit from_date = V8 to_date - ROUNDUP(0.25 * NEWVID, 0.5) days
23. V8-Video Edit(Quoting) to_date = V8-Edit from_date
24. V8-Video Edit(Quoting) from_date = V8-Quoting to_date - 3 days
25. V7-Edit Prep to_date = V8-Quoting from_date
26. V7-Edit Prep from_date = V7 to_date - 3 days
27. V6-VO Generation to_date = V7 from_date
28. V6-VO Generation from_date = V6 to_date - 5 days
29. V5-Scene Planning to_date = P9 from_date
30. V5-Scene Planning from_date = V5 to_date - 5 days
31. V3-Script Review(Client) to_date = V4-Script-Revision(Client) from_date
32. V3-Script Review(Client) from_date = V3 to_date - 5 days  
33. V4-Script Revision(Client) to_date = V5 from_date
34. V4-Script Revision(Client) from_date = V4-Client to_date - 2 days
35. V3-Script Review(Internal) to_date = V3-Client from_date
36. V3-Script Review(Internal) from_date = V3-Internal to_date - 3 days
37. V2-Script Creation to_date = V3-Internal from_date
38. V2-Script Creation from_date = V2 to_date - 5 days
39. V1-User Manual (if needed) to_date = V2 from_date
40. V1-User Manual from_date = V1 to_date - 5 days

Asset Stream (parallel):
41. P8-Spec Collection can start after P1-Setup
42. P4-Branding can start after P1-Setup
43. P5-Music follows P4-Branding
44. P6-MOGRT Check follows P4-Branding
45. P7-MOGRT Creation (if needed) follows P6
```

**Forward Execution Logic (Chronological Order):**
```
Despite backward calculation, tasks execute in this order:
1. P1-Setup (first task chronologically)
2. P2-Booking(Recce) 
3. P3-Attendance(Recce)
4. P2-Booking(Shoot)
5. P8-Specs, P4-Branding (parallel after P1)
6. V1-Manuals (if needed)
7. V2-Script Creation
8. V3-Script Reviews
9. V5-Scene Planning, V6-VO Generation (parallel)
10. P9-Filming
11. P10-Ingestion
12. V7-Edit Prep
13. V8-Video Edit (Quoting then Editing)
14. V9-Video Reviews
15. P11-Delivery
16. P12-Completion
```

## Cross-Stream Dependencies

**Asset Stream Convergence:**
- P4-Branding (10 days) → P5-Music (5 days) → P6-MOGRT Check (5 days)  
- If MOGRT needed: + P7-MOGRT Creation (3 days)
- Assets Ready = Latest of (P5, P6, P7 if needed)

**Edit Readiness Gate:**
- V7-Edit Prep requires: P10-Ingestion + Assets Ready + V6-VO Complete

**Delivery Readiness:**
- P11-Delivery requires: ALL videos V9-Client Review complete

## Buffer Management

**Standard Buffers:**
- Booking Buffer: +14 days for all P2 tasks
- Client Review: 5-day window with 7-day auto-approve
- Internal Review: 3-day window 
- Revision Probability: 25% (affects V4/V10 buffer tasks - sequential, not loops)

**Buffer Calculation:**
```
Total Project Duration = P11 - P1 ≈ 100 business days (3 months)
- From Setup to Script Creation: ≈ 70 days  
- From Filming to Delivery: ≈ 30 days
```

## Conditional Logic

**User Manual Requirement:**
```
IF user_manual_checkbox = true:
  Create V1-User Manual Collection task
ELSE:
  V2-Script Creation depends directly on P8-Specs
```

**MOGRT Creation:**
```  
IF P6-MOGRT Check determines new MOGRT needed:
  Create P7-MOGRT Creation task
  Assets Ready = P7 complete
ELSE:
  Assets Ready = MAX(P5, P6) complete
```

**Reuse Workflow:**
```
IF reuse_vids > 0:
  Create V9-Video Review (Reuse) at Day 3-5
  IF approved: Skip to delivery prep
  IF rejected: Convert to new/amend (manual process)
```

## Example Calculation

**Project:** EAV007 (3 new + 3 amend + 4 reuse videos)  
**Project Due:** 2025-08-15  

```
NEWVID = 3 + 3 = 6

P9-Filming Duration = ROUNDUP(0.15 * 6, 0.5) = ROUNDUP(0.9, 0.5) = 1 day
V8-Edit Duration = ROUNDUP(0.25 * 6, 0.5) = ROUNDUP(1.5, 0.5) = 1.5 days

Timeline (Working Backward):
- P11-Delivery: 2025-08-12 to 2025-08-15 (3-day window, ends on Project Due)
- P10-Ingestion: 2025-08-07 to 2025-08-11 (3-day window)  
- P9-Filming: 2025-08-05 to 2025-08-06 (1-day window)
- P2-Booking(Shoot): 2025-06-27 to 2025-07-24 (10 days + 14 buffer)
- P3-Attendance(Recce): 2025-06-26 to 2025-06-26 (1-day)
- P2-Booking(Recce): 2025-06-06 to 2025-06-25 (5 days + 14 buffer)
- P1-Setup: 2025-06-03 to 2025-06-05 (3-day window, FIRST TASK)

Video Stream (parallel):
- V9-Client Review: 2025-08-01 to 2025-08-07 (5 days, ends before P11 starts)
- V9-Internal Review: 2025-07-29 to 2025-07-31 (3 days)
- V8-Video Edit: 2025-07-26 to 2025-07-28 (1.5 days rounded to half-days)
- V8-Quoting: 2025-07-23 to 2025-07-25 (3 days)
- V7-Edit Prep: 2025-07-18 to 2025-07-22 (3 days + 7 buffer)
- V6-VO Generation: 2025-07-11 to 2025-07-17 (5 days)
- V5-Scene Planning: 2025-07-02 to 2025-07-08 (5 days, must complete before P9)
- V4-Script Revision: 2025-06-27 to 2025-07-01 (3 days if needed)
- V3-Client Review: 2025-06-20 to 2025-06-26 (5 days)
- V3-Internal Review: 2025-06-17 to 2025-06-19 (3 days)
- V2-Script Creation: 2025-06-10 to 2025-06-16 (5 days)
- V1-Manual Collection: 2025-06-03 to 2025-06-09 (5 days if needed)

Total Project Duration: ~74 business days (June 3 to August 15)
```

## SmartSuite Integration

**Required Fields:**
- `project_id`: Link to Projects table
- `sac1cc3284`: New video count (lookup)
- `s0a1f5ad8f`: Amend video count (lookup)  
- `s4e387c8f5`: Reuse video count (lookup)
- `s9cb92c387`: Project due date (lookup)
- `due_date`: Simple deadline display
- `duration`: Window constraints (hard boundaries) 
- `rsrc_alloc`: Visual resource allocation
- `task_code`: Task type (P1, V2, etc.)
- `task_variant`: Task variant (recce, client, etc.)

**Calculation Trigger:**
AI workflow manager reads project data, applies formulas, creates task records with calculated due dates.