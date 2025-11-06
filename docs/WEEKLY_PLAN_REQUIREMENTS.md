# Weekly Plan Auto-Generation: Requirements & Enhancement Opportunities

**Document Version**: 1.0
**Date**: 2025-11-06
**Status**: Ready for Implementation
**Owner**: Development Team

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Identified Gaps & Opportunities](#identified-gaps--opportunities)
4. [Functional Requirements](#functional-requirements)
5. [Technical Specifications](#technical-specifications)
6. [User Stories & Acceptance Criteria](#user-stories--acceptance-criteria)
7. [Implementation Guidance](#implementation-guidance)
8. [Appendix](#appendix)

---

## Executive Summary

### Key Findings

**✅ Weekly Plan Auto-Generation Is Already Implemented**

The system currently includes automatic weekly plan creation when a student requests daily activities but no weekly plan exists. This functionality is located in the `DailyActivitiesService._try_pull_from_weekly_plan()` method.

**Current Implementation Highlights:**
- Auto-generates weekly plans on-demand (reactive)
- Uses Gemini LLM for intelligent planning
- Includes assessment-driven prioritization
- Adaptive daily activity pull logic
- 4-level fallback cascade for resilience
- Full Cosmos DB persistence

### Enhancement Opportunities Identified

While the core auto-generation exists, there are several opportunities to improve visibility, proactivity, and user control:

1. **Proactive Generation**: Move from reactive (on-demand) to scheduled batch processing
2. **Monitoring & Alerts**: Health monitoring for weekly plan generation success/failures
3. **User Notifications**: Alert students/parents when plans are created or modified
4. **Manual Control**: Allow preview and adjustment of auto-generated plans
5. **Mid-Week Extensions**: Handle fast learners who complete plans early
6. **Multi-Week Roadmaps**: Extend planning horizon beyond one week

### Priority Recommendations

| Priority | Enhancement | Impact | Effort |
|----------|-------------|--------|--------|
| **P0** | Monitoring & Alerting | High | Low |
| **P1** | Proactive Batch Generation | High | Medium |
| **P1** | User Notifications | Medium | Low |
| **P2** | Plan Preview & Editing | Medium | High |
| **P2** | Mid-Week Extensions | Low | Medium |

---

## Current State Analysis

### 1. System Flow: Daily Activities Request

```
┌─────────────────────────────────────────────────────────────┐
│ Student Requests Daily Activities                           │
│ GET /daily-plan/{student_id}?date=2025-11-06               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ DailyActivitiesService.get_or_generate_daily_plan()        │
│ File: backend/app/services/daily_activities.py:248          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Check Cosmos DB for existing daily plan                     │
│ If found AND not force_refresh → Return saved plan          │
└────────────────────┬────────────────────────────────────────┘
                     │ (Not found)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ _generate_fresh_daily_plan(student_id, date)               │
│ File: backend/app/services/daily_activities.py:310          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: Check for Weekly Plan                             │
│ _try_pull_from_weekly_plan(student_id, date)               │
│ File: backend/app/services/daily_activities.py:402-574      │
└────────────────────┬────────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
    Found Weekly Plan      No Weekly Plan
         │                       │
         │                       ▼
         │              ┌─────────────────────────────────┐
         │              │ 🆕 AUTO-GENERATE WEEKLY PLAN    │
         │              │ Lines 431-464                   │
         │              │                                 │
         │              │ 1. Create WeeklyPlannerService  │
         │              │ 2. Call generate_weekly_plan()  │
         │              │    - student_id                 │
         │              │    - week_start_date (Monday)   │
         │              │    - target_activities=20       │
         │              │ 3. Save to Cosmos DB            │
         │              │ 4. Return plan for daily pull   │
         │              └──────────┬──────────────────────┘
         │                         │
         └─────────────┬───────────┘
                       │ (Success)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Adaptive Pull Logic (Intelligent Daily Assembly)           │
│ 1. INJECT: Assessment-driven activities (72hr window)      │
│ 2. CATCH-UP: Missed activities from previous days          │
│ 3. TODAY: Scheduled activities (with substitution logic)   │
│ 4. ACCELERATE: Pull from future days if ahead              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Return DailyPlan with ~6 activities                        │
│ personalization_source: "weekly_plan"                       │
└─────────────────────────────────────────────────────────────┘

                     │ (Weekly plan auto-gen failed)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ FALLBACK PHASE 2: AI Daily Recommendations                 │
│ _get_ai_recommendations_with_session_plan()                │
│ personalization_source: "ai_recommendations"                │
└────────────────────┬────────────────────────────────────────┘
                     │ (Failed)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ FALLBACK PHASE 3: BigQuery Recommendations                 │
│ personalization_source: "recommendations"                   │
└────────────────────┬────────────────────────────────────────┘
                     │ (Failed)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ FALLBACK PHASE 4: Static Activities                        │
│ personalization_source: "static"                            │
└─────────────────────────────────────────────────────────────┘
```

### 2. Weekly Plan Generation Process

When a weekly plan doesn't exist, the system automatically generates one using the following process:

**Service**: `WeeklyPlannerService`
**File**: `backend/app/services/weekly_planner.py`
**Method**: `generate_weekly_plan()` (Line 54)

**Steps**:

1. **Calculate Week Start Date** (defaults to next Monday)
2. **Check Cosmos DB** for existing plan
   - If exists and not `force_regenerate` → return existing
3. **Fetch Student Analytics Snapshot** (Line 94)
   - Query BigQuery for velocity metrics (all subjects)
   - Call `LearningPathsService.get_unlocked_entities()` per subject
   - Enrich with curriculum metadata
   - Result: Available subskills + readiness status
4. **Fetch Recent Assessment Feedback** (Line 104)
   - Get assessments from last 7 days (Cosmos DB)
   - Extract priority subskills from "Needs Review" / "Developing" skills
5. **Call Gemini LLM for Planning** (Line 112)
   - Calculate subject allocations based on velocity:
     - `velocity < 70%` (Significantly Behind) → 3 activities
     - `velocity < 85%` (Behind) → 2 activities
     - `velocity >= 85%` (On Track) → 1 activity
   - Generate 15-30 planned activities across Monday-Friday
   - Include: weekly theme, objectives, activity priorities, reasoning
6. **Mark Assessment-Driven Activities** (Line 484-494)
   - Link activities to source assessments
7. **Save to Cosmos DB** (Line 140-143)
   - Container: `weekly_plans`
   - Document ID: `{student_id}_{week_start_date}`
8. **Return WeeklyPlan Object**

### 3. Key Code Locations

| Component | File | Lines | Description |
|-----------|------|-------|-------------|
| **Daily Plan Entry Point** | `backend/app/api/endpoints/daily_activities.py` | 64-86 | Main API endpoint |
| **Daily Plan Orchestration** | `backend/app/services/daily_activities.py` | 248-308 | Generates or retrieves daily plan |
| **Weekly Plan Check & Auto-Gen** | `backend/app/services/daily_activities.py` | 402-574 | Checks for weekly plan, auto-generates if missing |
| **Adaptive Pull Logic** | `backend/app/services/daily_activities.py` | 470-560 | Intelligent daily activity assembly |
| **Weekly Plan Generation** | `backend/app/services/weekly_planner.py` | 54-152 | LLM-based weekly planning |
| **Weekly Plan Model** | `backend/app/models/weekly_plan.py` | 1-247 | Data structures |
| **Cosmos DB Persistence** | `backend/app/db/cosmos_db.py` | 2958-3073 | Weekly plan CRUD operations |
| **Weekly Plan API** | `backend/app/api/endpoints/weekly_planner.py` | 1-460 | Manual weekly plan endpoints |

### 4. Existing API Endpoints

#### Daily Activities Endpoints

| Endpoint | Method | Description | File Reference |
|----------|--------|-------------|----------------|
| `/daily-plan/{student_id}` | GET | Get or generate daily plan | Line 64 |
| `/daily-plan/{student_id}/activities` | GET | Get activities with source breakdown | Line 88 |
| `/daily-plan/{student_id}/refresh` | POST | Force refresh daily plan | Line 172 |
| `/daily-plan/{student_id}/activities/{activity_id}/complete` | POST | Mark single activity complete | Line 240 |
| `/daily-plan/{student_id}/complete` | POST | Mark entire daily plan complete | Line 270 |

#### Weekly Plan Endpoints

| Endpoint | Method | Description | File Reference |
|----------|--------|-------------|----------------|
| `/weekly-planner/generate/{student_id}` | POST | Manual weekly plan generation (admin/testing) | Line 50 |
| `/weekly-planner/{student_id}/current` | GET | Get current week's plan (auto-generates if missing) | Line 124 |
| `/weekly-planner/{student_id}/week/{week_start_date}` | GET | Get specific week's plan | Line 175 |
| `/weekly-planner/{student_id}/status` | GET | Get weekly progress summary | Line 227 |
| `/weekly-planner/{student_id}/day/{day_index}` | GET | Get activities for specific day (0=Monday) | Line 266 |
| `/weekly-planner/{student_id}/activity/{activity_uid}/complete` | POST | Mark activity complete in weekly plan | Line 331 |
| `/weekly-planner/{student_id}/week/{week_start_date}` | DELETE | Delete weekly plan | Line 387 |

### 5. Error Handling & Resilience

The system implements a **4-level fallback cascade** to ensure students always receive daily activities:

```
Level 1: Weekly Plan (auto-generated if missing)
   ↓ (Generation failed)
Level 2: AI Daily Recommendations (Gemini LLM)
   ↓ (AI service unavailable)
Level 3: BigQuery Recommendations (Analytics-based)
   ↓ (BigQuery query failed)
Level 4: Static Fallback Activities (Hardcoded)
   ↓
✅ Student always gets activities
```

**Error Handling Code**: `backend/app/services/daily_activities.py:310-379`

---

## Identified Gaps & Opportunities

### Gap 1: Reactive vs. Proactive Generation

**Current State**: Weekly plans are generated **on-demand** when a student requests daily activities.

**Issue**:
- First daily plan request of the week has latency (waiting for LLM generation)
- No visibility into upcoming week until student accesses the system
- Cannot pre-notify parents about upcoming weekly focus

**Opportunity**: Implement **scheduled batch generation** to create weekly plans in advance.

---

### Gap 2: No Health Monitoring or Alerting

**Current State**: Weekly plan generation failures are logged but not monitored.

**Issue**:
- Silent failures degrade to AI daily recommendations (fallback works, but less optimal)
- No visibility into generation success rates
- Cannot identify systemic issues (e.g., LLM rate limits, Cosmos DB connection issues)

**Opportunity**: Add monitoring, alerting, and health dashboards.

---

### Gap 3: Limited Visibility for Users

**Current State**: Weekly plans are generated silently in the background.

**Issue**:
- Students/parents don't know a weekly plan exists until they click daily activities
- No notification when plans are created
- No visibility into weekly theme, objectives, or planned progression

**Opportunity**: Implement notification system and weekly plan preview interface.

---

### Gap 4: No Mid-Week Extension Logic

**Current State**: Weekly plans contain 15-30 activities distributed Monday-Friday.

**Issue**:
- Fast learners who complete all activities by Wednesday have no more planned work
- System falls back to AI daily recommendations (less cohesive)
- No mechanism to extend or append to existing weekly plans

**Opportunity**: Add mid-week extension logic to generate additional activities.

---

### Gap 5: No Manual Adjustment Capability

**Current State**: Weekly plans are 100% auto-generated by LLM.

**Issue**:
- Parents/teachers cannot preview before plans go live
- Cannot adjust priorities (e.g., focus more on math this week)
- Cannot remove/replace activities that don't fit student's schedule

**Opportunity**: Add plan preview and manual editing interface.

---

### Gap 6: Single-Week Planning Horizon

**Current State**: Plans one week at a time.

**Issue**:
- No visibility into multi-week skill progression
- Cannot plan for longer-term goals (e.g., "master multiplication by end of month")
- Parents want to see longer-term roadmaps

**Opportunity**: Extend to multi-week planning with roadmap visualization.

---

## Functional Requirements

### FR-001: Proactive Weekly Plan Generation (Scheduled Batch)

**Priority**: P1 (High)
**Estimated Complexity**: Medium
**Estimated Effort**: 3-5 days

#### Description

Implement a scheduled background job that generates weekly plans for all active students in advance, rather than waiting for on-demand requests.

#### User Stories

- **As a student**, I want my daily activities to load instantly on Monday morning, without waiting for plan generation.
- **As a parent**, I want to receive a weekly preview on Sunday evening so I know what my child will be learning.
- **As the system**, I should generate weekly plans during off-peak hours to reduce load during student usage times.

#### Acceptance Criteria

- [ ] Scheduled job runs every **Sunday at 8:00 PM** (configurable)
- [ ] Generates weekly plans for **next Monday** for all active students
- [ ] Active student defined as: logged in within last 14 days
- [ ] Batch processing with rate limiting (max 10 concurrent LLM calls)
- [ ] Progress tracking: X of Y students processed
- [ ] Error handling: Individual failures don't stop batch
- [ ] Failed generations are retried once after 5 minutes
- [ ] Comprehensive logging with summary report
- [ ] Monitoring integration (see FR-002)

#### Technical Specifications

**New Component**: `BackgroundJobService`
**File**: `backend/app/services/background_jobs.py` (new)

**Key Methods**:
```python
async def generate_weekly_plans_batch(
    target_week_start_date: str,
    student_ids: Optional[List[int]] = None,
    max_concurrent: int = 10
) -> Dict[str, Any]:
    """
    Generate weekly plans for multiple students in batch.

    Returns:
        {
            "total_students": 150,
            "successful": 145,
            "failed": 5,
            "failed_student_ids": [1234, 5678],
            "duration_seconds": 342.5,
            "started_at": "2025-11-03T20:00:00Z",
            "completed_at": "2025-11-03T20:05:42Z"
        }
    """
```

**Scheduler**: Use existing FastAPI scheduler or add APScheduler

**Configuration** (`backend/app/core/config.py`):
```python
WEEKLY_PLAN_BATCH_SCHEDULE_CRON = "0 20 * * 0"  # Sunday 8PM
WEEKLY_PLAN_BATCH_MAX_CONCURRENT = 10
WEEKLY_PLAN_BATCH_RETRY_DELAY_SECONDS = 300
WEEKLY_PLAN_BATCH_ACTIVE_STUDENT_DAYS = 14
```

**API Endpoints** (for manual triggering/testing):
- `POST /admin/background-jobs/weekly-plans/batch` - Manually trigger batch generation
- `GET /admin/background-jobs/weekly-plans/status` - Get last batch run status

#### Code Impact Areas

- **New File**: `backend/app/services/background_jobs.py`
- **New File**: `backend/app/api/endpoints/admin/background_jobs.py`
- **Modified**: `backend/app/core/config.py` (add settings)
- **Modified**: `backend/app/main.py` (register scheduler)

#### Testing Requirements

- [ ] Unit tests: Batch processing logic with mocked students
- [ ] Unit tests: Error handling (some students fail, others succeed)
- [ ] Integration tests: End-to-end batch generation with real services
- [ ] Load tests: 500 students, measure duration and resource usage
- [ ] Manual test: Verify Cosmos DB contains generated plans
- [ ] Manual test: Verify students can access plans on Monday

---

### FR-002: Weekly Plan Health Monitoring & Alerting

**Priority**: P0 (Critical)
**Estimated Complexity**: Low
**Estimated Effort**: 2-3 days

#### Description

Implement comprehensive monitoring and alerting for weekly plan generation, including success/failure rates, latency, and error categorization.

#### User Stories

- **As a DevOps engineer**, I want to be alerted when weekly plan generation failures exceed threshold, so I can investigate before students are impacted.
- **As a product manager**, I want a dashboard showing weekly plan health metrics, so I can track system reliability.
- **As a support engineer**, I want to see which students have failed plan generation, so I can proactively assist them.

#### Acceptance Criteria

- [ ] Metrics tracked:
  - Weekly plan generation attempts (counter)
  - Weekly plan generation successes (counter)
  - Weekly plan generation failures (counter)
  - Generation latency (histogram)
  - Error categories (counter with labels: llm_timeout, cosmos_error, analytics_error, etc.)
- [ ] Alerts configured:
  - Failure rate > 10% in last hour → Warning
  - Failure rate > 25% in last hour → Critical
  - No successful generations in last 2 hours → Critical
  - Average latency > 30 seconds → Warning
- [ ] Health check endpoint returns weekly plan service status
- [ ] Batch generation summary logged and stored
- [ ] Admin dashboard displays metrics (if admin UI exists)

#### Technical Specifications

**Monitoring Library**: Prometheus (recommended) or existing monitoring solution

**New Component**: `WeeklyPlanHealthMonitor`
**File**: `backend/app/services/weekly_planner.py` (add to existing file)

**Metrics Implementation**:
```python
from prometheus_client import Counter, Histogram

# Metrics
weekly_plan_generation_attempts = Counter(
    'weekly_plan_generation_attempts_total',
    'Total weekly plan generation attempts',
    ['student_id', 'trigger_type']  # trigger_type: on_demand, batch, manual
)

weekly_plan_generation_successes = Counter(
    'weekly_plan_generation_successes_total',
    'Successful weekly plan generations',
    ['student_id', 'trigger_type']
)

weekly_plan_generation_failures = Counter(
    'weekly_plan_generation_failures_total',
    'Failed weekly plan generations',
    ['student_id', 'trigger_type', 'error_category']
)

weekly_plan_generation_duration = Histogram(
    'weekly_plan_generation_duration_seconds',
    'Weekly plan generation duration',
    ['trigger_type']
)
```

**Health Check Endpoint**:
```python
@router.get("/health/weekly-planner")
async def weekly_planner_health():
    """
    Returns health status of weekly planner service.

    Response:
    {
        "status": "healthy" | "degraded" | "unhealthy",
        "last_24h_stats": {
            "attempts": 150,
            "successes": 145,
            "failures": 5,
            "success_rate": 96.67,
            "avg_duration_seconds": 8.3
        },
        "services": {
            "cosmos_db": "healthy",
            "bigquery": "healthy",
            "gemini_llm": "healthy",
            "learning_paths": "healthy"
        },
        "timestamp": "2025-11-06T10:30:00Z"
    }
    """
```

#### Code Impact Areas

- **Modified**: `backend/app/services/weekly_planner.py` (add monitoring)
- **Modified**: `backend/app/services/daily_activities.py` (add monitoring for auto-gen)
- **New File**: `backend/app/api/endpoints/health.py` (if doesn't exist)
- **Modified**: `backend/app/main.py` (register health endpoint)

#### Testing Requirements

- [ ] Unit tests: Metrics increment correctly on success/failure
- [ ] Integration tests: Health endpoint returns accurate stats
- [ ] Manual test: Generate plan and verify metrics in Prometheus
- [ ] Manual test: Trigger failure and verify alert fires

---

### FR-003: Intelligent Weekly Plan Refresh Logic

**Priority**: P1 (High)
**Estimated Complexity**: Medium
**Estimated Effort**: 2-3 days

#### Description

Add logic to automatically regenerate or extend weekly plans based on completion status, assessment results, or staleness.

#### User Stories

- **As a student**, if I complete 80% of my weekly plan by Wednesday, I want more activities to be added automatically so I stay engaged.
- **As a parent**, if my child takes a new assessment mid-week that reveals gaps, I want the weekly plan to adjust to include remediation activities.
- **As the system**, I should not serve stale weekly plans that were generated weeks ago and never used.

#### Acceptance Criteria

**Trigger 1: High Completion Rate**
- [ ] If student completes ≥80% of planned activities by Wednesday
- [ ] System generates 5-10 additional activities for Thursday-Friday
- [ ] New activities appended to existing weekly plan (not replaced)
- [ ] Student/parent notified of extension

**Trigger 2: New Assessment Feedback**
- [ ] If student completes assessment with score <70% on any skill
- [ ] System injects 2-3 remediation activities into weekly plan
- [ ] Prioritized as "high" and scheduled for next available day
- [ ] Existing low-priority activities may be deferred

**Trigger 3: Stale Plans**
- [ ] If weekly plan was generated >14 days ago and <30% completed
- [ ] System marks plan as "stale" and regenerates on next daily plan request
- [ ] Student/parent notified that plan was refreshed

**General**:
- [ ] All refresh actions logged with reason
- [ ] Refresh history stored in Cosmos DB (`plan_refresh_history` field)
- [ ] Parent portal displays refresh reasons (if portal exists)

#### Technical Specifications

**New Method**: `WeeklyPlannerService.should_refresh_plan()`
**File**: `backend/app/services/weekly_planner.py`

```python
async def should_refresh_plan(
    self,
    student_id: int,
    weekly_plan: WeeklyPlan
) -> Tuple[bool, Optional[str]]:
    """
    Determine if weekly plan should be refreshed.

    Returns:
        (should_refresh: bool, reason: Optional[str])
    """
```

**New Method**: `WeeklyPlannerService.extend_weekly_plan()`
**File**: `backend/app/services/weekly_planner.py`

```python
async def extend_weekly_plan(
    self,
    student_id: int,
    weekly_plan: WeeklyPlan,
    additional_activities: int = 5
) -> WeeklyPlan:
    """
    Extend existing weekly plan with additional activities.
    """
```

**Modified Method**: `DailyActivitiesService._try_pull_from_weekly_plan()`
**File**: `backend/app/services/daily_activities.py`

Add refresh check before pulling activities:
```python
# After retrieving weekly plan
should_refresh, reason = await weekly_planner.should_refresh_plan(student_id, weekly_plan)
if should_refresh:
    logger.info(f"🔄 WEEKLY_PLAN: Refreshing plan for student {student_id}. Reason: {reason}")
    # Regenerate logic
```

#### Code Impact Areas

- **Modified**: `backend/app/services/weekly_planner.py` (add refresh logic)
- **Modified**: `backend/app/services/daily_activities.py` (check refresh before pull)
- **Modified**: `backend/app/models/weekly_plan.py` (add `plan_refresh_history` field)
- **Modified**: `backend/app/db/cosmos_db.py` (save refresh history)

#### Testing Requirements

- [ ] Unit tests: Refresh triggers fire correctly for each scenario
- [ ] Unit tests: Extension logic appends activities correctly
- [ ] Integration tests: Stale plan is regenerated on next daily request
- [ ] Integration tests: High completion triggers extension
- [ ] Manual test: Complete 80% of plan by Wednesday, verify extension on Thursday

---

### FR-004: Parent/Teacher Notification System

**Priority**: P1 (High)
**Estimated Complexity**: Low
**Estimated Effort**: 3-5 days

#### Description

Notify students, parents, and teachers when weekly plans are generated, modified, or completed.

#### User Stories

- **As a parent**, I want to receive an email on Sunday night with my child's weekly learning plan and theme, so I can support their learning.
- **As a student**, I want to see a notification when new activities are added to my weekly plan, so I know there's more work available.
- **As a teacher**, I want to see which of my students have completed their weekly plans, so I can recognize their progress.

#### Acceptance Criteria

**Notification Types**:

1. **Weekly Plan Generated**
   - [ ] Trigger: New weekly plan created (batch or on-demand)
   - [ ] Recipients: Student, Parent
   - [ ] Content: Weekly theme, objectives, activity count, link to view plan
   - [ ] Delivery: Email + In-app notification

2. **Weekly Plan Extended**
   - [ ] Trigger: Additional activities added mid-week
   - [ ] Recipients: Student, Parent
   - [ ] Content: Reason for extension, new activity count
   - [ ] Delivery: In-app notification

3. **Weekly Plan Refreshed**
   - [ ] Trigger: Plan regenerated due to staleness or assessment
   - [ ] Recipients: Student, Parent
   - [ ] Content: Reason for refresh, new focus areas
   - [ ] Delivery: In-app notification

4. **Weekly Plan Completed**
   - [ ] Trigger: 100% of activities marked complete
   - [ ] Recipients: Student, Parent, Teacher (optional)
   - [ ] Content: Congratulations message, XP earned, progress summary
   - [ ] Delivery: Email + In-app notification

**General**:
- [ ] Notification preferences configurable per user (email on/off, notification types)
- [ ] Delivery uses existing notification service (if exists) or new implementation
- [ ] All notifications logged for debugging

#### Technical Specifications

**Notification Service**: Assume existing `NotificationService` or create new one

**New Component**: `WeeklyPlanNotifier`
**File**: `backend/app/services/weekly_plan_notifier.py` (new)

```python
class WeeklyPlanNotifier:
    def __init__(self, notification_service: NotificationService):
        self.notification_service = notification_service

    async def notify_weekly_plan_generated(
        self,
        student_id: int,
        weekly_plan: WeeklyPlan
    ):
        """Send notification when weekly plan is generated."""

    async def notify_weekly_plan_extended(
        self,
        student_id: int,
        weekly_plan: WeeklyPlan,
        reason: str
    ):
        """Send notification when weekly plan is extended."""

    async def notify_weekly_plan_completed(
        self,
        student_id: int,
        weekly_plan: WeeklyPlan,
        total_xp: int
    ):
        """Send notification when weekly plan is completed."""
```

**Integration Points**:
- `WeeklyPlannerService.generate_weekly_plan()` → Call notifier after save
- `WeeklyPlannerService.extend_weekly_plan()` → Call notifier after extension
- `DailyActivitiesService` (completion handler) → Call notifier if weekly plan 100% complete

**Email Template Example** (weekly plan generated):
```
Subject: Your Weekly Learning Plan is Ready!

Hi [Student Name],

Your learning plan for the week of [Week Start Date] is ready!

🎯 This Week's Theme: [Weekly Theme]

📚 Learning Goals:
• [Objective 1]
• [Objective 2]
• [Objective 3]

📊 Planned Activities: [Activity Count]
Estimated Time: [Total Minutes] minutes

[View Your Weekly Plan]

Keep up the great work!

Best,
Your AI Learning Coach
```

#### Code Impact Areas

- **New File**: `backend/app/services/weekly_plan_notifier.py`
- **Modified**: `backend/app/services/weekly_planner.py` (call notifier)
- **Modified**: `backend/app/services/daily_activities.py` (call notifier on completion)
- **New Folder**: `backend/app/templates/email/` (email templates)

#### Testing Requirements

- [ ] Unit tests: Notifier methods called with correct data
- [ ] Integration tests: Email sent successfully via notification service
- [ ] Manual test: Generate weekly plan, verify email received
- [ ] Manual test: Complete weekly plan, verify completion email

---

### FR-005: Weekly Plan Preview & Manual Adjustment Interface (Backend API)

**Priority**: P2 (Nice-to-have)
**Estimated Complexity**: High
**Estimated Effort**: 5-8 days (backend only)

#### Description

Provide API endpoints for parents/teachers to preview auto-generated weekly plans before they go live, and make manual adjustments (reorder, replace, remove activities).

**Note**: This requirement covers backend API only. Frontend UI is separate effort.

#### User Stories

- **As a parent**, I want to preview my child's weekly plan before Monday, so I can adjust it to fit our family schedule.
- **As a teacher**, I want to remove activities that duplicate classroom lessons, so students don't repeat work.
- **As a parent**, I want to add extra math activities this week because my child is preparing for a test.

#### Acceptance Criteria

**Plan Status**:
- [ ] Weekly plans have status: `draft`, `published`, `active`, `completed`
- [ ] Auto-generated plans start as `draft`
- [ ] Plans become `published` when parent/teacher approves OR Monday arrives
- [ ] Only `published` or `active` plans are used for daily activities

**API Endpoints**:

1. **Preview Draft Plan**
   - [ ] `GET /weekly-planner/{student_id}/draft` - Get draft plan for upcoming week
   - [ ] Returns: Full weekly plan with all activities

2. **Modify Draft Plan**
   - [ ] `PUT /weekly-planner/{student_id}/draft/activities/{activity_uid}` - Update activity (change day, priority)
   - [ ] `DELETE /weekly-planner/{student_id}/draft/activities/{activity_uid}` - Remove activity
   - [ ] `POST /weekly-planner/{student_id}/draft/activities` - Add new activity

3. **Reorder Activities**
   - [ ] `POST /weekly-planner/{student_id}/draft/activities/reorder` - Bulk reorder activities

4. **Publish Plan**
   - [ ] `POST /weekly-planner/{student_id}/draft/publish` - Approve draft, make it live

5. **Reject Plan (Regenerate)**
   - [ ] `POST /weekly-planner/{student_id}/draft/reject` - Reject draft, trigger regeneration with new parameters

**Validation**:
- [ ] Cannot modify/publish plans that are already `active`
- [ ] Must have at least 5 activities to publish
- [ ] Cannot schedule >10 activities on a single day
- [ ] Added activities must be from unlocked subskills

**Audit Trail**:
- [ ] All manual modifications logged in `modification_history` field
- [ ] Includes: timestamp, user_id (parent/teacher), action, old_value, new_value

#### Technical Specifications

**Modified Model**: `backend/app/models/weekly_plan.py`

Add fields:
```python
class WeeklyPlan(BaseModel):
    # ... existing fields ...
    status: WeeklyPlanStatus = WeeklyPlanStatus.DRAFT  # NEW
    modification_history: List[PlanModification] = []  # NEW
    published_at: Optional[str] = None  # NEW
    published_by: Optional[str] = None  # NEW (user_id)

class WeeklyPlanStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ACTIVE = "active"
    COMPLETED = "completed"

class PlanModification(BaseModel):
    timestamp: str
    user_id: str
    user_type: str  # "parent", "teacher", "admin"
    action: str  # "add_activity", "remove_activity", "reorder", "change_priority"
    details: Dict[str, Any]
```

**New Endpoints**: `backend/app/api/endpoints/weekly_planner.py` (add to existing file)

```python
@router.get("/{student_id}/draft")
async def get_draft_weekly_plan(student_id: int):
    """Get draft weekly plan for preview."""

@router.put("/{student_id}/draft/activities/{activity_uid}")
async def update_draft_activity(student_id: int, activity_uid: str, update: ActivityUpdate):
    """Update single activity in draft plan."""

@router.post("/{student_id}/draft/publish")
async def publish_weekly_plan(student_id: int, published_by: str):
    """Publish draft plan, making it live."""

@router.post("/{student_id}/draft/reject")
async def reject_draft_plan(student_id: int, reason: str):
    """Reject draft and trigger regeneration."""
```

**Auto-Publish Logic**: `backend/app/services/background_jobs.py`

Add scheduled job to auto-publish draft plans on Monday morning if not manually published:
```python
async def auto_publish_draft_weekly_plans():
    """
    Run every Monday at 6:00 AM.
    Automatically publish all draft plans for current week.
    """
```

#### Code Impact Areas

- **Modified**: `backend/app/models/weekly_plan.py` (add status, modification tracking)
- **Modified**: `backend/app/api/endpoints/weekly_planner.py` (add draft endpoints)
- **Modified**: `backend/app/services/weekly_planner.py` (add draft logic)
- **Modified**: `backend/app/services/background_jobs.py` (add auto-publish job)
- **Modified**: `backend/app/db/cosmos_db.py` (save draft plans separately)

#### Testing Requirements

- [ ] Unit tests: Draft plan CRUD operations
- [ ] Unit tests: Validation rules (min activities, max per day)
- [ ] Integration tests: Preview → Modify → Publish flow
- [ ] Integration tests: Auto-publish on Monday morning
- [ ] Manual test: Preview draft, add activity, publish, verify in daily plan

---

### FR-006: Mid-Week Extension for Fast Learners

**Priority**: P2 (Nice-to-have)
**Estimated Complexity**: Medium
**Estimated Effort**: 2-3 days

#### Description

Automatically detect when students complete their weekly plan ahead of schedule and generate additional activities to keep them engaged.

**Note**: Overlaps with FR-003 (Refresh Logic). Can be combined or implemented separately.

#### User Stories

- **As a student**, if I finish all my weekly activities by Wednesday, I want more activities to appear so I can keep learning.
- **As a parent**, I want my child to always have work available, even if they're ahead of schedule.
- **As the system**, I should detect fast learners and provide challenge activities.

#### Acceptance Criteria

- [ ] Trigger: Student completes ≥80% of weekly activities before Friday
- [ ] System generates 5-10 additional activities (extension batch)
- [ ] Extension activities scheduled for remaining days of the week
- [ ] Extension activities have slightly higher difficulty (+1 target difficulty)
- [ ] Extension marked in weekly plan with `is_extension=true` flag
- [ ] Student notified of new activities available
- [ ] Extension limited to 1 per week (no infinite extensions)

#### Technical Specifications

**Modified Model**: `backend/app/models/weekly_plan.py`

Add field to `PlannedActivity`:
```python
class PlannedActivity(BaseModel):
    # ... existing fields ...
    is_extension: bool = False  # NEW
    extension_batch_id: Optional[str] = None  # NEW (group extensions)
```

**New Method**: `WeeklyPlannerService.generate_extension_activities()`
**File**: `backend/app/services/weekly_planner.py`

```python
async def generate_extension_activities(
    self,
    student_id: int,
    weekly_plan: WeeklyPlan,
    count: int = 5
) -> List[PlannedActivity]:
    """
    Generate extension activities for fast learners.
    Slightly higher difficulty than original plan.
    """
```

**Background Check**: Add to daily activities service

Check if extension needed when pulling from weekly plan:
```python
# In DailyActivitiesService._try_pull_from_weekly_plan()
completion_rate = weekly_plan.completed_activities / weekly_plan.total_activities
if completion_rate >= 0.8 and current_day < 5 and not weekly_plan.has_extension:
    # Generate extension
```

#### Code Impact Areas

- **Modified**: `backend/app/models/weekly_plan.py` (add extension fields)
- **Modified**: `backend/app/services/weekly_planner.py` (add extension generation)
- **Modified**: `backend/app/services/daily_activities.py` (check for extension trigger)

#### Testing Requirements

- [ ] Unit tests: Extension triggered when >80% complete before Friday
- [ ] Unit tests: Extension limited to 1 per week
- [ ] Integration tests: Complete 80% by Wednesday, verify extension on Thursday
- [ ] Manual test: Fast complete weekly plan, verify additional activities appear

---

### FR-007: Multi-Week Roadmap Planning

**Priority**: P2 (Nice-to-have)
**Estimated Complexity**: High
**Estimated Effort**: 8-12 days

#### Description

Extend planning horizon from 1 week to 4+ weeks, providing students and parents with a long-term learning roadmap.

**Note**: This is a significant architectural change and should be considered for a future phase.

#### User Stories

- **As a parent**, I want to see a 4-week learning roadmap so I understand my child's skill progression over the month.
- **As a teacher**, I want to see which skills each student will cover in the next month, so I can coordinate with my lesson plans.
- **As a student**, I want to see my learning journey and upcoming topics, so I feel motivated to progress.

#### Acceptance Criteria

- [ ] System can generate 4-week roadmaps (4 consecutive weekly plans)
- [ ] Roadmap respects skill prerequisites (prerequisite skills must come before dependent skills)
- [ ] Roadmap adapts based on weekly completion (if student falls behind, future weeks adjust)
- [ ] Roadmap visualization available via API (frontend separate effort)
- [ ] Each week in roadmap has theme, objectives, and estimated activity count
- [ ] Roadmap regenerated monthly or when student velocity changes significantly

#### Technical Specifications

**New Model**: `backend/app/models/multi_week_plan.py` (new)

```python
class MultiWeekPlan(BaseModel):
    student_id: int
    plan_id: str  # {student_id}_{start_date}_multiweek
    start_date: str  # Monday of first week
    end_date: str  # Friday of last week
    total_weeks: int  # Usually 4
    weekly_plans: List[WeeklyPlanSummary]  # Summary of each week
    roadmap_theme: str  # Overall theme for the month
    roadmap_objectives: List[str]  # High-level monthly goals
    generated_at: str
    last_updated_at: str
    status: str  # "active", "completed", "outdated"

class WeeklyPlanSummary(BaseModel):
    week_number: int  # 1-4
    week_start_date: str
    weekly_theme: str
    estimated_activities: int
    key_skills: List[str]  # Skill IDs covered this week
    status: str  # "pending", "active", "completed"
```

**New Service**: `MultiWeekPlannerService`
**File**: `backend/app/services/multi_week_planner.py` (new)

```python
class MultiWeekPlannerService:
    async def generate_multi_week_roadmap(
        self,
        student_id: int,
        num_weeks: int = 4
    ) -> MultiWeekPlan:
        """Generate multi-week learning roadmap."""
```

**API Endpoints**: `backend/app/api/endpoints/multi_week_planner.py` (new)

- `POST /multi-week-planner/generate/{student_id}` - Generate multi-week roadmap
- `GET /multi-week-planner/{student_id}/current` - Get current active roadmap
- `GET /multi-week-planner/{student_id}/roadmap` - Get roadmap visualization data

#### Code Impact Areas

- **New File**: `backend/app/models/multi_week_plan.py`
- **New File**: `backend/app/services/multi_week_planner.py`
- **New File**: `backend/app/api/endpoints/multi_week_planner.py`
- **Modified**: `backend/app/services/weekly_planner.py` (integrate with roadmap)
- **Modified**: `backend/app/db/cosmos_db.py` (save multi-week plans)

#### Testing Requirements

- [ ] Unit tests: Multi-week generation logic
- [ ] Unit tests: Skill prerequisite ordering
- [ ] Integration tests: Generate 4-week roadmap, verify weekly plans align
- [ ] Manual test: View roadmap in frontend (separate UI work)

---

## Technical Specifications

### Database Schema (Cosmos DB)

#### weekly_plans Container

**Document Structure**:
```json
{
  "id": "1004_2025-11-04",
  "student_id": 1004,
  "week_start_date": "2025-11-04",
  "plan_id": "1004_2025-11-04",
  "status": "active",  // NEW (FR-005)
  "weekly_theme": "Building Strong Foundations",
  "weekly_objectives": [
    "Master basic addition up to 10",
    "Practice letter recognition"
  ],
  "planned_activities": [
    {
      "activity_uid": "1004_2025-11-04_act_001",
      "subskill_id": "MATH001-01-A",
      "skill_id": "MATH001-01",  // FIXED (previously incorrect)
      "unit_id": "MATH001",
      "subject": "Mathematics",
      "activity_type": "practice",
      "planned_day": 0,  // Monday
      "status": "completed",
      "priority": "high",
      "llm_reasoning": "Start week with addition practice",
      "estimated_time_minutes": 15,
      "is_extension": false,  // NEW (FR-006)
      "extension_batch_id": null  // NEW (FR-006)
    }
  ],
  "source_analytics_snapshot": {
    "velocity_metrics": {},
    "unlocked_subskills": []
  },
  "generated_at": "2025-11-03T20:15:30Z",
  "published_at": "2025-11-03T21:00:00Z",  // NEW (FR-005)
  "published_by": "parent_5678",  // NEW (FR-005)
  "modification_history": [],  // NEW (FR-005)
  "plan_refresh_history": [],  // NEW (FR-003)
  "has_extension": false,  // NEW (FR-006)
  "total_activities": 20,
  "completed_activities": 5,
  "assigned_activities": 3,
  "document_type": "weekly_plan",
  "_ts": 1730664930
}
```

#### daily_plans Container

**Document Structure** (already exists, no changes needed):
```json
{
  "id": "1004_2025-11-05",
  "student_id": 1004,
  "date": "2025-11-05",
  "activities": [...],
  "personalization_source": "weekly_plan",  // or "ai_recommendations", "recommendations", "static"
  "progress": {
    "completed_activities": 3,
    "total_activities": 6
  },
  "document_type": "daily_plan"
}
```

### Service Dependencies

```
BackgroundJobService (NEW - FR-001)
    ↓ depends on
WeeklyPlannerService (EXISTING)
    ↓ depends on
    ├── BigQueryAnalyticsService (for velocity metrics)
    ├── LearningPathsService (for prerequisite unlocking)
    ├── CompetencyService (via LearningPathsService)
    ├── CosmosDBService (for persistence, assessment feedback)
    └── GeminiLLMService (for plan generation)

WeeklyPlanNotifier (NEW - FR-004)
    ↓ depends on
NotificationService (EXISTING or NEW)

WeeklyPlanHealthMonitor (NEW - FR-002)
    ↓ depends on
PrometheusClient or existing monitoring
```

### Configuration Requirements

**File**: `backend/app/core/config.py`

Add the following configuration variables:

```python
# Weekly Plan Batch Generation (FR-001)
WEEKLY_PLAN_BATCH_SCHEDULE_CRON: str = "0 20 * * 0"  # Sunday 8PM
WEEKLY_PLAN_BATCH_MAX_CONCURRENT: int = 10
WEEKLY_PLAN_BATCH_RETRY_DELAY_SECONDS: int = 300
WEEKLY_PLAN_BATCH_ACTIVE_STUDENT_DAYS: int = 14

# Weekly Plan Refresh (FR-003)
WEEKLY_PLAN_REFRESH_COMPLETION_THRESHOLD: float = 0.8  # 80%
WEEKLY_PLAN_REFRESH_COMPLETION_CHECK_DAY: int = 3  # Wednesday
WEEKLY_PLAN_REFRESH_STALE_DAYS: int = 14

# Weekly Plan Extension (FR-006)
WEEKLY_PLAN_EXTENSION_COUNT: int = 5
WEEKLY_PLAN_EXTENSION_DIFFICULTY_BOOST: int = 1

# Weekly Plan Monitoring (FR-002)
WEEKLY_PLAN_MONITORING_ENABLED: bool = True
WEEKLY_PLAN_ALERT_FAILURE_RATE_WARNING: float = 0.10  # 10%
WEEKLY_PLAN_ALERT_FAILURE_RATE_CRITICAL: float = 0.25  # 25%
```

### API Endpoint Summary

#### New Endpoints (by Requirement)

**FR-001: Batch Generation**
- `POST /admin/background-jobs/weekly-plans/batch` - Manually trigger batch generation
- `GET /admin/background-jobs/weekly-plans/status` - Get last batch run status

**FR-002: Health Monitoring**
- `GET /health/weekly-planner` - Health check endpoint with metrics

**FR-005: Plan Preview & Editing**
- `GET /weekly-planner/{student_id}/draft` - Get draft plan
- `PUT /weekly-planner/{student_id}/draft/activities/{activity_uid}` - Update activity
- `DELETE /weekly-planner/{student_id}/draft/activities/{activity_uid}` - Remove activity
- `POST /weekly-planner/{student_id}/draft/activities` - Add activity
- `POST /weekly-planner/{student_id}/draft/activities/reorder` - Reorder activities
- `POST /weekly-planner/{student_id}/draft/publish` - Publish draft
- `POST /weekly-planner/{student_id}/draft/reject` - Reject draft

**FR-007: Multi-Week Planning**
- `POST /multi-week-planner/generate/{student_id}` - Generate roadmap
- `GET /multi-week-planner/{student_id}/current` - Get current roadmap
- `GET /multi-week-planner/{student_id}/roadmap` - Get roadmap visualization

---

## User Stories & Acceptance Criteria

### Student Perspective

**US-001: Fast Daily Plan Loading**
- **As a student**, I want my daily activities to load instantly on Monday morning, without waiting for plan generation.
- **Acceptance Criteria**:
  - Daily plan request on Monday returns in <500ms
  - Weekly plan already exists in Cosmos DB before request
  - No LLM generation latency

**US-002: Always Have Activities**
- **As a student**, if I finish all my weekly activities early, I want more activities to appear so I can keep learning.
- **Acceptance Criteria**:
  - Complete ≥80% of weekly activities
  - System generates 5-10 extension activities
  - New activities appear in daily plan next day

**US-003: Notification of New Activities**
- **As a student**, I want to see a notification when new activities are added to my plan.
- **Acceptance Criteria**:
  - Extension activities added → In-app notification appears
  - Notification includes count and reason
  - Notification links to daily plan

### Parent Perspective

**US-004: Weekly Preview**
- **As a parent**, I want to receive an email on Sunday evening with my child's weekly learning plan and theme.
- **Acceptance Criteria**:
  - Email sent Sunday 8:00 PM
  - Includes weekly theme, objectives, activity count
  - Includes link to view full plan

**US-005: Plan Adjustment**
- **As a parent**, I want to preview my child's weekly plan and remove activities that don't fit our schedule.
- **Acceptance Criteria**:
  - Access draft plan before Monday
  - Remove unwanted activities
  - Publish adjusted plan
  - Daily activities reflect changes

**US-006: Progress Visibility**
- **As a parent**, I want to see my child's weekly progress and know when they've completed their plan.
- **Acceptance Criteria**:
  - View completion percentage
  - Receive email when 100% complete
  - See congratulations message

### Teacher Perspective

**US-007: Student Plan Overview**
- **As a teacher**, I want to see which skills my students will be learning this week, so I can coordinate with classroom lessons.
- **Acceptance Criteria**:
  - Access all students' weekly plans
  - Filter by skill or subject
  - Export plan summary

**US-008: Class Completion Summary**
- **As a teacher**, I want to see which students have completed their weekly plans, so I can recognize their progress.
- **Acceptance Criteria**:
  - View class-wide completion dashboard
  - See individual student completion rates
  - Export completion report

### System Perspective

**US-009: Proactive Planning**
- **As the system**, I should generate weekly plans in advance during off-peak hours to reduce load during student usage times.
- **Acceptance Criteria**:
  - Batch job runs Sunday 8:00 PM
  - All active students have plans by Monday 6:00 AM
  - Failures logged and alerted

**US-010: Health Monitoring**
- **As the system**, I should alert DevOps when weekly plan generation failures exceed threshold.
- **Acceptance Criteria**:
  - Failure rate >10% → Warning alert
  - Failure rate >25% → Critical alert
  - Alerts sent to configured channels (Slack, email, PagerDuty)

---

## Implementation Guidance

### Phased Rollout Strategy

#### Phase 1: Foundation (P0 Items) - Week 1-2

**Goal**: Establish monitoring and observability before adding new features.

**Requirements**:
- FR-002: Weekly Plan Health Monitoring & Alerting

**Deliverables**:
- [ ] Prometheus metrics added to existing weekly plan generation
- [ ] Health check endpoint deployed
- [ ] Alerts configured in monitoring system
- [ ] Dashboard showing weekly plan health

**Rationale**: Must have visibility into current system before making changes.

---

#### Phase 2: Proactive Generation (P1 Items) - Week 3-4

**Goal**: Move from reactive to proactive weekly plan generation.

**Requirements**:
- FR-001: Proactive Weekly Plan Generation (Scheduled Batch)
- FR-004: Parent/Teacher Notification System (partial - just generation notifications)

**Deliverables**:
- [ ] Background job service implemented
- [ ] Sunday evening batch generation deployed
- [ ] Email notifications for plan generation
- [ ] Monitoring integrated for batch jobs

**Rollout**:
1. **Shadow Mode** (Week 3): Run batch generation but don't use results yet (validate)
2. **Pilot** (Week 4): Enable for 10% of students, monitor closely
3. **Full Rollout** (Week 5): Enable for all students

---

#### Phase 3: Intelligent Adaptation (P1 Items) - Week 5-6

**Goal**: Add intelligent refresh and notification logic.

**Requirements**:
- FR-003: Intelligent Weekly Plan Refresh Logic
- FR-004: Parent/Teacher Notification System (complete)

**Deliverables**:
- [ ] Refresh triggers implemented (high completion, assessment feedback, staleness)
- [ ] Extension logic for fast learners
- [ ] Complete notification types (extension, refresh, completion)

**Rollout**:
1. **Pilot** (Week 5): Enable for 10% of students
2. **Full Rollout** (Week 6): Enable for all students

---

#### Phase 4: User Control (P2 Items) - Week 7-10

**Goal**: Give parents and teachers control over weekly plans.

**Requirements**:
- FR-005: Weekly Plan Preview & Manual Adjustment Interface (Backend API)
- FR-006: Mid-Week Extension for Fast Learners

**Deliverables**:
- [ ] Draft plan API endpoints
- [ ] Plan modification API (add, remove, reorder)
- [ ] Plan approval workflow
- [ ] Auto-publish job for unpublished drafts

**Rollout**:
1. **Alpha** (Week 7-8): Backend API complete, manual testing
2. **Beta** (Week 9): Release to 10 pilot families for feedback
3. **Full Rollout** (Week 10+): Frontend UI developed, full release

---

#### Phase 5: Future Enhancements (P2 Items) - Future Quarters

**Goal**: Extend planning horizon and add advanced features.

**Requirements**:
- FR-007: Multi-Week Roadmap Planning

**Deliverables**:
- [ ] Multi-week plan model and service
- [ ] API endpoints for roadmap access
- [ ] Frontend roadmap visualization

**Rollout**: TBD based on user feedback from Phase 4

---

### Code Reference Table

| Requirement | Action | File | Method/Line | Description |
|-------------|--------|------|-------------|-------------|
| **FR-001** | Create | `backend/app/services/background_jobs.py` | New file | Batch generation service |
| **FR-001** | Create | `backend/app/api/endpoints/admin/background_jobs.py` | New file | Admin endpoints |
| **FR-001** | Modify | `backend/app/main.py` | - | Register scheduler |
| **FR-002** | Modify | `backend/app/services/weekly_planner.py` | Line 54+ | Add metrics |
| **FR-002** | Modify | `backend/app/services/daily_activities.py` | Line 431+ | Add metrics for auto-gen |
| **FR-002** | Create | `backend/app/api/endpoints/health.py` | New file | Health check endpoint |
| **FR-003** | Modify | `backend/app/services/weekly_planner.py` | New methods | Add refresh logic |
| **FR-003** | Modify | `backend/app/services/daily_activities.py` | Line 402+ | Check refresh triggers |
| **FR-003** | Modify | `backend/app/models/weekly_plan.py` | - | Add refresh history field |
| **FR-004** | Create | `backend/app/services/weekly_plan_notifier.py` | New file | Notification service |
| **FR-004** | Modify | `backend/app/services/weekly_planner.py` | Line 140+ | Call notifier after save |
| **FR-005** | Modify | `backend/app/models/weekly_plan.py` | - | Add status, modification fields |
| **FR-005** | Modify | `backend/app/api/endpoints/weekly_planner.py` | New endpoints | Draft CRUD endpoints |
| **FR-005** | Modify | `backend/app/services/weekly_planner.py` | New methods | Draft plan logic |
| **FR-006** | Modify | `backend/app/models/weekly_plan.py` | - | Add extension fields |
| **FR-006** | Modify | `backend/app/services/weekly_planner.py` | New method | Extension generation |
| **FR-006** | Modify | `backend/app/services/daily_activities.py` | Line 402+ | Extension trigger check |
| **FR-007** | Create | `backend/app/models/multi_week_plan.py` | New file | Multi-week model |
| **FR-007** | Create | `backend/app/services/multi_week_planner.py` | New file | Multi-week service |
| **FR-007** | Create | `backend/app/api/endpoints/multi_week_planner.py` | New file | Multi-week endpoints |

---

### Testing Requirements

#### Unit Tests

**Files to Test**:
- `backend/app/services/background_jobs.py` (FR-001)
  - [ ] Test batch processing with mocked students
  - [ ] Test error handling (some students fail)
  - [ ] Test retry logic
- `backend/app/services/weekly_planner.py` (FR-002, FR-003)
  - [ ] Test metrics increment on success/failure
  - [ ] Test refresh trigger detection
  - [ ] Test extension generation
- `backend/app/services/weekly_plan_notifier.py` (FR-004)
  - [ ] Test notification methods called correctly
- `backend/app/api/endpoints/weekly_planner.py` (FR-005)
  - [ ] Test draft plan CRUD operations
  - [ ] Test validation rules

**Coverage Target**: 80% line coverage minimum

---

#### Integration Tests

**Test Scenarios**:
- [ ] **Batch Generation E2E**: Trigger batch job → Verify plans in Cosmos DB → Verify metrics updated
- [ ] **Auto-Generation E2E**: Request daily plan → No weekly plan exists → Auto-generate → Return activities
- [ ] **Refresh E2E**: Complete 80% of weekly plan by Wednesday → Extension generated → Activities appear in daily plan
- [ ] **Notification E2E**: Generate weekly plan → Email sent → In-app notification created
- [ ] **Draft Workflow E2E**: Generate draft → Preview → Modify → Publish → Verify in daily plan

**Environment**: Use test Cosmos DB container and mock LLM service

---

#### Load Tests

**Scenarios**:
- [ ] **Batch Generation Load**: 500 students, measure duration and resource usage
  - **Target**: <10 minutes total, <30s per student
- [ ] **Concurrent Daily Plan Requests**: 100 concurrent requests on Monday morning
  - **Target**: <500ms response time, <5% failures

**Tools**: Use existing load testing framework (e.g., Locust, k6)

---

#### Manual Testing Checklist

**Pre-Deployment**:
- [ ] Generate weekly plan via API, inspect structure in Cosmos DB
- [ ] Trigger batch generation, verify email notifications received
- [ ] Preview draft plan in Cosmos DB, verify status is "draft"
- [ ] Modify draft plan, verify modification_history updated
- [ ] Complete 80% of weekly plan, verify extension triggered
- [ ] Check Prometheus metrics dashboard, verify metrics populating

**Post-Deployment** (Production):
- [ ] Monitor first Sunday batch run, verify success rate
- [ ] Check alert channels (Slack, email) for any alerts
- [ ] Verify students receive email notifications
- [ ] Spot-check weekly plans in Cosmos DB for data quality

---

### Monitoring & Alerting Setup

#### Metrics to Track

**Weekly Plan Generation**:
```
weekly_plan_generation_attempts_total{trigger_type="batch|on_demand"}
weekly_plan_generation_successes_total{trigger_type="batch|on_demand"}
weekly_plan_generation_failures_total{trigger_type="batch|on_demand", error_category="llm_timeout|cosmos_error|..."}
weekly_plan_generation_duration_seconds{trigger_type="batch|on_demand"}
```

**Weekly Plan Health**:
```
weekly_plan_active_count{status="draft|published|active"}
weekly_plan_completion_rate{student_id}
weekly_plan_extension_triggered_total
weekly_plan_refresh_triggered_total{reason="high_completion|assessment|stale"}
```

**Batch Jobs**:
```
batch_weekly_plan_run_total
batch_weekly_plan_run_duration_seconds
batch_weekly_plan_students_processed_total
batch_weekly_plan_students_failed_total
```

#### Alerts to Configure

**Critical Alerts** (PagerDuty, immediate action):
- Weekly plan generation failure rate >25% in last hour
- Batch job failed to complete
- No successful weekly plan generations in last 2 hours

**Warning Alerts** (Slack, review within 4 hours):
- Weekly plan generation failure rate >10% in last hour
- Batch job duration >15 minutes (expected: <10 minutes)
- Average generation latency >30 seconds (expected: <10 seconds)

**Info Alerts** (Slack, FYI):
- Batch job completed successfully (summary report)
- Extension triggered for >10 students in one day (potential systematic issue)

#### Dashboard Widgets

**Weekly Plan Health Dashboard**:
- Success rate (last 24 hours): Gauge (target: >95%)
- Generation latency: Line chart (last 7 days)
- Failure rate by error category: Pie chart
- Active weekly plans count: Counter
- Batch job status: Table (last 10 runs)

---

### Rollback Procedures

#### Scenario 1: Batch Generation Causing Issues

**Symptoms**:
- High LLM rate limit errors
- Cosmos DB throttling
- Students complaining about incorrect plans

**Rollback Steps**:
1. Disable batch job scheduler (set cron to never run)
2. System automatically falls back to on-demand generation
3. Investigate root cause (check logs, metrics)
4. Fix issue (adjust rate limits, concurrency)
5. Re-enable batch job for pilot group (10% of students)
6. Monitor for 1 week, then re-enable fully

**Impact**: Minimal - on-demand generation is original behavior

---

#### Scenario 2: Notification System Causing Spam

**Symptoms**:
- Parents reporting too many emails
- Notification service rate limited

**Rollback Steps**:
1. Disable notification service via feature flag
2. Notifications stop immediately
3. Investigate settings (frequency, content)
4. Adjust notification rules
5. Re-enable with updated settings

**Impact**: Minimal - notifications are enhancement, not core functionality

---

#### Scenario 3: Refresh Logic Causing Unexpected Plan Changes

**Symptoms**:
- Parents complaining weekly plans changing unexpectedly
- Students confused by shifting activities

**Rollback Steps**:
1. Disable refresh triggers via feature flag
2. Weekly plans remain static once generated
3. Review refresh logic and thresholds
4. Adjust trigger conditions (make less aggressive)
5. Re-enable with updated rules

**Impact**: Moderate - students may have fewer activities if they complete early, but won't experience confusing changes

---

## Appendix

### A. Complete Data Flow Diagram

```
[Student/Parent/Teacher]
         │
         ▼
[Frontend Web App / Mobile App]
         │
         │ HTTP Request
         ▼
┌─────────────────────────────────────────────────────────┐
│                    FastAPI Backend                       │
│                                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │          Daily Activities Endpoint                │  │
│  │  GET /daily-plan/{student_id}?date=2025-11-06    │  │
│  └────────────────┬──────────────────────────────────┘  │
│                   │                                      │
│                   ▼                                      │
│  ┌────────────────────────────────────────────────────┐ │
│  │      DailyActivitiesService                        │ │
│  │  - Check Cosmos DB for saved daily plan           │ │
│  │  - If not found, generate fresh plan               │ │
│  └────────────────┬───────────────────────────────────┘ │
│                   │                                      │
│         ┌─────────┴─────────┐                           │
│         │                   │                           │
│         ▼                   ▼                           │
│  ┌──────────────┐    ┌─────────────────────────────┐   │
│  │ Check Weekly │    │  Fallback: AI Daily Recs   │   │
│  │     Plan     │    │  (if weekly plan failed)    │   │
│  └──────┬───────┘    └─────────────────────────────┘   │
│         │                                                │
│         │ Found                                          │
│         ▼                                                │
│  ┌────────────────────────────────────────────────────┐ │
│  │           WeeklyPlannerService                     │ │
│  │                                                    │ │
│  │  ┌──────────────────────────────────────────┐    │ │
│  │  │ If weekly plan missing:                  │    │ │
│  │  │  1. Query BigQuery for velocity metrics │    │ │
│  │  │  2. Query LearningPathsService for      │    │ │
│  │  │     unlocked subskills                   │    │ │
│  │  │  3. Query Cosmos DB for assessment      │    │ │
│  │  │     feedback (last 7 days)              │    │ │
│  │  │  4. Call Gemini LLM for planning        │    │ │
│  │  │  5. Save to Cosmos DB                   │    │ │
│  │  │  6. Notify parent/student (NEW)         │    │ │
│  │  └──────────────────────────────────────────┘    │ │
│  │                                                    │ │
│  │  ┌──────────────────────────────────────────┐    │ │
│  │  │ Adaptive Pull Logic:                     │    │ │
│  │  │  1. Inject assessment-driven activities │    │ │
│  │  │  2. Catch-up activities from prev days  │    │ │
│  │  │  3. Today's scheduled activities        │    │ │
│  │  │  4. Accelerate (pull from future days)  │    │ │
│  │  └──────────────────────────────────────────┘    │ │
│  └─────────────────────┬──────────────────────────────┘ │
│                        │                                 │
│                        ▼                                 │
│  ┌────────────────────────────────────────────────────┐ │
│  │          Return DailyPlan Object                   │ │
│  │  - ~6 activities for today                         │ │
│  │  - Curriculum metadata                             │ │
│  │  - Progress tracking                               │ │
│  │  - Personalization source                          │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
└──────────────────────────────┬───────────────────────────┘
                               │
                               ▼
                    [Frontend Displays Activities]
```

### B. Weekly Plan Activity Status State Machine

```
┌──────────┐
│ pending  │ ─────────────────────────────────┐
└────┬─────┘                                   │
     │                                         │
     │ Student requests daily plan containing │
     │ this activity                           │
     ▼                                         │
┌──────────┐                                   │
│ assigned │                                   │
└────┬─────┘                                   │
     │                                         │
     │ Student completes activity              │
     ▼                                         │
┌───────────┐                                  │
│ completed │                                  │
└───────────┘                                  │
                                               │
     ┌─────────────────────────────────────────┘
     │ Activity substituted due to
     │ assessment injection
     ▼
┌──────────┐
│ deferred │ ─────────────────┐
└──────────┘                  │
                              │ Rescheduled to
                              │ future day
                              ▼
                         ┌──────────┐
                         │ pending  │
                         └──────────┘

     ┌─────────────────────────────────────────┐
     │ Parent/teacher manually removes activity│
     │ (if FR-005 implemented)                 │
     ▼                                         │
┌──────────┐                                   │
│ skipped  │                                   │
└──────────┘                                   │
```

### C. Glossary of Terms

| Term | Definition |
|------|------------|
| **Weekly Plan** | A collection of 15-30 planned learning activities distributed across Monday-Friday, generated by LLM based on student readiness and assessment feedback. |
| **Daily Plan** | A subset of ~6 activities selected from the weekly plan (or AI recommendations) for a specific day, using adaptive pull logic. |
| **Adaptive Pull Logic** | Intelligent algorithm that selects daily activities from the weekly plan based on assessment injection, catch-up needs, scheduled activities, and acceleration. |
| **Assessment-Driven Activity** | An activity injected into the weekly or daily plan based on recent assessment performance (last 7 days for weekly, last 72 hours for daily). |
| **Catch-Up Activity** | An activity from previous days that the student hasn't completed yet, pulled into today's daily plan. |
| **Extension Activity** | An additional activity generated mid-week when a student completes ≥80% of their weekly plan before Friday. |
| **Draft Plan** | A weekly plan in "draft" status that can be previewed and modified by parents/teachers before publishing. |
| **Stale Plan** | A weekly plan generated >14 days ago with <30% completion, indicating the student hasn't engaged and the plan should be regenerated. |
| **Activity UID** | Unique identifier for an activity instance (format: `{student_id}_{week_start_date}_act_{sequence}`). |
| **Planned Day** | Integer representing the day of the week an activity is scheduled (0=Monday, 4=Friday). |
| **Activity Status** | Current state of an activity (pending, assigned, completed, deferred, skipped). |
| **Personalization Source** | Origin of daily activities (weekly_plan, ai_recommendations, recommendations, static). |
| **Velocity Metrics** | Student's pace of progress in each subject (percentage of expected skill mastery), used to calculate activity allocations. |
| **Unlocked Subskills** | Subskills the student is ready to learn based on prerequisite completion (via LearningPathsService decision tree). |
| **Batch Generation** | Scheduled process that generates weekly plans for multiple students at once (e.g., every Sunday evening). |
| **On-Demand Generation** | Reactive process that generates a weekly plan when a student requests daily activities and no plan exists. |
| **Substitution** | Process of deferring lower-priority scheduled activities to make room for higher-priority assessment-driven activities. |

### D. Comparison: Current vs. Proposed State

| Aspect | Current State | After Enhancements |
|--------|---------------|-------------------|
| **Generation Timing** | On-demand (reactive) | Scheduled batch (proactive) |
| **First Load Time** | 5-15 seconds (LLM generation) | <500ms (plan pre-generated) |
| **User Visibility** | Silent background generation | Email + in-app notifications |
| **Plan Flexibility** | 100% auto-generated | Editable drafts (optional) |
| **Mid-Week Adaptation** | Minimal (only assessment injection) | Full refresh + extension logic |
| **Monitoring** | Basic logging | Comprehensive metrics + alerts |
| **Planning Horizon** | 1 week | 1 week (4 weeks in FR-007) |
| **Parent Involvement** | None | Preview, edit, approve |
| **Failure Handling** | Silent fallback to AI daily recs | Alerts + retry + monitoring |

### E. API Response Examples

#### GET /daily-plan/{student_id}

**Response** (after enhancements):
```json
{
  "id": "1004_2025-11-05",
  "student_id": 1004,
  "date": "2025-11-05",
  "daily_theme": null,
  "learning_objectives": [],
  "session_plan": {
    "session_focus": "Building on yesterday's progress...",
    "estimated_time_minutes": 60,
    "difficulty_balance": "Balanced"
  },
  "activities": [
    {
      "id": "rec-MATH001-01-A",
      "type": "practice",
      "title": "Practice: Addition within 10",
      "description": "Interactive addition problems",
      "category": "Practice Problems",
      "estimated_time": "15 min",
      "points": 25,
      "priority": "high",
      "time_slot": "morning",
      "action": "Start Practice",
      "endpoint": "/practice",
      "icon_type": "calculator",
      "metadata": {
        "from_weekly_plan": true,
        "weekly_plan_activity_uid": "1004_2025-11-04_act_003",
        "planned_day": 1,
        "skill_id": "MATH001-01",
        "subskill_id": "MATH001-01-A",
        "is_assessment_driven": false,
        "is_catch_up": false,
        "is_extension": false
      },
      "curriculum_metadata": {
        "subject": "Mathematics",
        "unit": {
          "id": "MATH001",
          "title": "Number Sense"
        },
        "skill": {
          "id": "MATH001-01",
          "description": "Addition"
        },
        "subskill": {
          "id": "MATH001-01-A",
          "description": "Add within 10"
        }
      },
      "is_complete": false
    }
  ],
  "personalization_source": "weekly_plan",
  "weekly_plan_info": {
    "plan_id": "1004_2025-11-04",
    "weekly_theme": "Building Strong Foundations",
    "week_progress": {
      "completed_activities": 5,
      "total_activities": 20,
      "completion_percentage": 25
    }
  },
  "total_points": 150,
  "progress": {
    "completed_activities": 0,
    "total_activities": 6,
    "points_earned_today": 0,
    "daily_goal": 60,
    "current_streak": 3,
    "progress_percentage": 0
  },
  "createdAt": "2025-11-05T08:00:00Z",
  "updatedAt": "2025-11-05T08:00:00Z"
}
```

#### GET /weekly-planner/{student_id}/current

**Response** (after enhancements):
```json
{
  "student_id": 1004,
  "week_start_date": "2025-11-04",
  "plan_id": "1004_2025-11-04",
  "status": "active",
  "weekly_theme": "Building Strong Foundations",
  "weekly_objectives": [
    "Master basic addition up to 10",
    "Practice letter recognition A-F"
  ],
  "planned_activities": [
    {
      "activity_uid": "1004_2025-11-04_act_001",
      "subskill_id": "MATH001-01-A",
      "skill_id": "MATH001-01",
      "unit_id": "MATH001",
      "subject": "Mathematics",
      "activity_type": "practice",
      "planned_day": 0,
      "status": "completed",
      "priority": "high",
      "llm_reasoning": "Start week with addition practice to build confidence",
      "estimated_time_minutes": 15,
      "is_extension": false,
      "assigned_date": "2025-11-04",
      "completed_date": "2025-11-04"
    }
  ],
  "total_activities": 20,
  "completed_activities": 5,
  "assigned_activities": 3,
  "completion_percentage": 25,
  "has_extension": false,
  "generated_at": "2025-11-03T20:15:30Z",
  "published_at": "2025-11-03T21:00:00Z",
  "published_by": null,
  "modification_history": [],
  "plan_refresh_history": []
}
```

#### GET /health/weekly-planner

**Response** (after FR-002):
```json
{
  "status": "healthy",
  "last_24h_stats": {
    "attempts": 150,
    "successes": 145,
    "failures": 5,
    "success_rate": 96.67,
    "avg_duration_seconds": 8.3
  },
  "services": {
    "cosmos_db": "healthy",
    "bigquery": "healthy",
    "gemini_llm": "healthy",
    "learning_paths": "healthy"
  },
  "batch_job_status": {
    "last_run_at": "2025-11-03T20:00:00Z",
    "last_run_status": "success",
    "last_run_duration_seconds": 342,
    "students_processed": 150,
    "students_failed": 5
  },
  "timestamp": "2025-11-06T10:30:00Z"
}
```

---

## Conclusion

This document provides comprehensive requirements for enhancing the existing weekly plan auto-generation system. The enhancements focus on:

1. **Proactivity**: Moving from reactive to scheduled batch generation
2. **Observability**: Adding monitoring, alerting, and health checks
3. **User Control**: Giving parents and teachers visibility and editing capabilities
4. **Intelligence**: Adding adaptive refresh and extension logic
5. **Communication**: Notifying stakeholders when plans change

**Next Steps**:
1. Review and approve this requirements document with product team
2. Create implementation tickets (Jira, Linear, etc.) for each FR
3. Assign priorities and schedule in sprint planning
4. Begin Phase 1 (Monitoring) implementation
5. Iterate based on user feedback

**Questions or Clarifications**: Contact the development team lead.

---

**Document History**:
- **v1.0** (2025-11-06): Initial requirements document created based on code investigation and gap analysis

