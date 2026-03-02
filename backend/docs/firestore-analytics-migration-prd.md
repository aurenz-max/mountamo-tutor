# PRD: Real-Time Firestore Analytics Migration

> **Status:** Draft
> **Date:** 2026-03-01
> **Scope:** Replace all BigQuery-backed analytics endpoints with real-time Firestore reads

---

## 1. Problem Statement

The current analytics system reads from BigQuery tables that are populated by a nightly ETL sync (`BigQueryETLService`). This introduces a **12–24 hour data lag** — a student who completes a practice session sees stale metrics until the next ETL run. Meanwhile, all writes already land in Firestore in real-time (attempts, reviews, competencies, mastery lifecycle). The data is there; the analytics endpoints just don't read it yet.

**Goal:** Migrate every student-facing analytics endpoint to read exclusively from Firestore, delivering live-to-the-moment metrics with zero ETL dependency.

---

## 2. Current Architecture

### 2.1 Write Path (already real-time)

```
Student completes problem
  → CompetencyService.update_competency_from_problem()
    → Firestore: students/{id}/attempts/{attempt_id}
    → Firestore: students/{id}/competencies/{subject}_{skill}_{subskill}
    → Firestore: students/{id}/mastery_lifecycle/{subskill_id}
    → Firestore: students/{id}/reviews/{review_id}
    → CosmosDB (legacy dual-write, to be deprecated)
```

### 2.2 Read Path (current — lagged)

```
Frontend hook (e.g., useStudentMetrics)
  → GET /api/analytics/student/{id}/metrics
    → BigQueryAnalyticsService.get_hierarchical_metrics()
      → SQL query against analytics.attempts + analytics.curriculum
      → Data is 12-24h stale (nightly ETL)
```

### 2.3 Firestore Collections Available

| Collection Path | Contents | Indexes |
|----------------|----------|---------|
| `students/{id}/attempts/*` | Every scored attempt: subject, skill_id, subskill_id, score, timestamp, source | subject, skill_id, subskill_id, timestamp DESC |
| `students/{id}/reviews/*` | Structured problem reviews: observation, analysis, evaluation, feedback, problem_content | subject, skill_id, subskill_id, timestamp DESC |
| `students/{id}/competencies/*` | Blended score, credibility, total_attempts per subskill | subject |
| `students/{id}/mastery_lifecycle/*` | Gate (0-4), completion_pct, passes/fails, next_retest_eligible, estimated_remaining_attempts | subject, current_gate |
| `students/{id}/learning_paths/*` | Unlocked entities, entity statuses per subject | — |
| `students/{id}/velocityHistory/*` | Weekly velocity snapshots | weekOf DESC |
| `students/{id}` (root doc) | global_practice_pass_rate, daily_session_capacity, aggregate_metrics | — |
| `curriculum_published/{grade}/subjects/{id}` | Full curriculum hierarchy + subskill_index + stats | — |
| `config/schoolYear` | Year dates, break periods | — |

---

## 3. Target Architecture

### 3.1 New Service: `FirestoreAnalyticsService`

**File:** `backend/app/services/firestore_analytics.py`

A new service that replaces `BigQueryAnalyticsService` for all analytics reads. It queries Firestore subcollections directly and performs aggregation in Python.

```
Frontend hook
  → GET /api/analytics/student/{id}/metrics
    → FirestoreAnalyticsService.get_hierarchical_metrics()
      → Firestore reads: competencies, mastery_lifecycle, curriculum_published
      → Python aggregation → structured response
      → Data is live to the moment
```

### 3.2 Design Principles

1. **Firestore is the single source of truth.** No BigQuery, no ETL, no Cosmos reads.
2. **Aggregation happens in Python.** Firestore can't do SQL-style JOINs, GROUP BYs, or window functions. The service reads raw docs and aggregates in memory.
3. **Student-scoped queries only.** Every query reads from `students/{id}/...` subcollections — no collection-group queries, no cross-student analytics. This keeps reads fast and within Firestore's sweet spot.
4. **Curriculum is cached.** The published curriculum (hierarchy + subskill_index) changes rarely. Cache it in-memory with a 60-minute TTL (already done in CurriculumService).
5. **Short-TTL response caching.** The analytics endpoint layer keeps a 2-minute in-memory cache per (student, endpoint, params) to absorb rapid repeated requests from the frontend. Much shorter than the current 10-15 min TTL since the data is now live.

---

## 4. Endpoint Migration Map

Each existing analytics endpoint, its current BigQuery dependency, and the Firestore replacement strategy.

### 4.1 Hierarchical Metrics

**Endpoint:** `GET /analytics/student/{id}/metrics`
**Current:** `BigQueryAnalyticsService.get_hierarchical_metrics()` — single massive SQL with CTEs joining attempts, curriculum, learning_paths
**New:** `FirestoreAnalyticsService.get_hierarchical_metrics()`

**Data sources:**
- `curriculum_published` → full hierarchy (units → skills → subskills) — via CurriculumService (cached)
- `students/{id}/competencies/*` → blended score, credibility, total_attempts per subskill
- `students/{id}/mastery_lifecycle/*` → gate, completion_pct per subskill

**Aggregation logic:**
1. Load curriculum hierarchy for the subject
2. Load all competency docs for the student (optionally filtered by subject)
3. Load all mastery lifecycle docs for the student (optionally filtered by subject)
4. Build subskill lookup maps: `{subskill_id: competency_data}`, `{subskill_id: lifecycle_data}`
5. Walk the curriculum tree, enriching each subskill with:
   - `avg_score` = competency.current_score / 10.0
   - `mastery` = avg_score × credibility
   - `attempt_count` = competency.total_attempts
   - `credibility` = competency.credibility
   - `completion` = 100.0 if attempted else 0.0
   - `readiness_status` = derived from mastery lifecycle gate or learning path unlock status
   - `priority_level` = Mastered / High Priority / Medium Priority / Not Started (same thresholds as current BQ query)
6. Roll up skill-level and unit-level aggregates (avg mastery, avg proficiency, count attempted, total)
7. Compute summary: overall mastery, proficiency, completion, total items, attempted items, ready items

**Estimated read cost:** ~2 Firestore reads (curriculum cache hit) + N competency docs + N lifecycle docs. For a student with 200 subskills across all subjects, this is ~400 doc reads — well within Firestore performance budgets.

### 4.2 Timeseries Metrics

**Endpoint:** `GET /analytics/student/{id}/metrics/timeseries`
**Current:** `BigQueryAnalyticsService.get_timeseries_metrics()` — SQL with DATE_TRUNC grouping
**New:** `FirestoreAnalyticsService.get_timeseries_metrics()`

**Data sources:**
- `students/{id}/attempts/*` — filtered by date range, subject, grouped by interval

**Aggregation logic:**
1. Query attempts subcollection with date range filter and optional subject filter
2. Group in Python by date interval (day/week/month/quarter)
3. Per interval: count attempts, count distinct subskills, avg score, compute mastery and completion
4. Return sorted intervals

**Note:** This is the most read-heavy endpoint. For students with 1000+ attempts, we may need to:
- Limit the default lookback period (e.g., 6 months)
- Consider a pre-computed `students/{id}/attemptSummaries/{interval_key}` subcollection (see §7 Denormalized Aggregates)

### 4.3 Recommendations

**Endpoint:** `GET /analytics/student/{id}/recommendations`
**Current:** `BigQueryAnalyticsService.get_recommendations()` — SQL joining curriculum, attempts, learning_paths
**New:** `FirestoreAnalyticsService.get_recommendations()`

**Data sources:**
- Competencies (mastery per subskill)
- Mastery lifecycle (gate status)
- Curriculum (hierarchy)
- Learning paths (unlock state)

**Aggregation logic:**
1. Load competencies → build mastery map
2. Load mastery lifecycles → build gate map
3. Load curriculum → walk tree
4. For each subskill: determine readiness (from learning paths), mastery level, priority
5. Score and sort by: ready + not started (coverage gap) > ready + low mastery (performance gap) > not ready
6. Return top N

This aligns closely with what the daily planning service already does (§3.5 of PLANNING_ARCHITECTURE). Consider sharing the recommendation logic with `PlanningService._select_new_skills()`.

### 4.4 Velocity Metrics

**Endpoint:** `GET /analytics/student/{id}/velocity-metrics`
**Current:** `BigQueryAnalyticsService.get_velocity_metrics()` — SQL against attempts with date math
**New:** `FirestoreAnalyticsService.get_velocity_metrics()`

**Data sources:**
- `students/{id}/mastery_lifecycle/*` → count by gate status per subject
- `curriculum_published` → total subskills per subject
- `config/schoolYear` → expected progress timeline
- `students/{id}/velocityHistory/*` → historical snapshots (already Firestore-native)

**Aggregation logic:**
1. Count closed (gate 4) subskills per subject = actual_progress
2. Load school year config → compute expected_progress at current date
3. Derive velocity_percentage, days_ahead_behind, velocity_status

**Note:** This is already partially Firestore-native (velocityHistory). The live velocity calculation can reuse `PlanningService.get_weekly_plan()` logic which already does this from Firestore.

### 4.5 Score Distribution

**Endpoint:** `GET /analytics/student/{id}/score-distribution`
**Current:** `BigQueryAnalyticsService.get_score_distribution()` — SQL histogram with CASE buckets
**New:** `FirestoreAnalyticsService.get_score_distribution()`

**Data sources:**
- `students/{id}/attempts/*` — filtered by subject, date range

**Aggregation logic:**
1. Query attempts for student + subject + date range
2. For each attempt, bucket score into histogram (0-10 integer buckets)
3. Group by hierarchy level (subject → unit → skill) using curriculum lookup
4. Return `ScoreDistributionItem[]` with score_histogram, attempt_histogram, total_reviews, avg_score

### 4.6 Score Trends

**Endpoint:** `GET /analytics/student/{id}/score-trends`
**Current:** `BigQueryAnalyticsService.get_score_trends()` — SQL with weekly/monthly grouping per subject
**New:** `FirestoreAnalyticsService.get_score_trends()`

**Data sources:**
- `students/{id}/attempts/*` — all attempts in the lookback window

**Aggregation logic:**
1. Query attempts within lookback window
2. Group by (subject, period_key) where period_key = week or month
3. Per group: avg score, total reviews, score sum
4. Build `SubjectTrend[]` → `TrendPeriod[]`

### 4.7 Problem Reviews

**Endpoint:** `GET /analytics/student/{id}/problem-reviews` (via CompetencyService)
**Current:** Reads from CosmosDB via `cosmos_db.get_problem_reviews()`
**New:** Read from `students/{id}/reviews/*` directly

**Data sources:**
- `students/{id}/reviews/*` — already stores full structured review data (observation, analysis, evaluation, feedback, problem_content)

**Aggregation:** Minimal — just format and return. Already almost working via `firestore_service.get_problem_reviews()`.

### 4.8 Recent Detailed Activity

**Endpoint:** `GET /analytics/student/{id}/recent-activity-detailed`
**Current:** `BigQueryAnalyticsService.get_detailed_recent_activity()`
**New:** `FirestoreAnalyticsService.get_recent_activity()`

**Data sources:**
- `students/{id}/attempts/*` — timestamp >= cutoff, limit N
- `students/{id}/reviews/*` — joined by subskill_id + timestamp proximity

**Aggregation:**
1. Query recent attempts (ordered by timestamp DESC, limit)
2. Optionally join with reviews for rich feedback context
3. Enrich with curriculum metadata (subskill descriptions)

### 4.9 Mistake Patterns

**Endpoint:** `GET /analytics/student/{id}/mistake-patterns`
**Current:** `BigQueryAnalyticsService.get_mistake_patterns()`
**New:** `FirestoreAnalyticsService.get_mistake_patterns()`

**Data sources:**
- `students/{id}/reviews/*` — filtered by date range, low scores
- `students/{id}/competencies/*` — for context

**Aggregation:**
1. Query reviews in date range where score < threshold
2. Group by subskill_id → extract common feedback themes
3. Return pattern clusters with frequency counts

### 4.10 Assessment Analytics (Overview, History, Performance, Details)

**Endpoints:**
- `GET /analytics/assessments/overview`
- `GET /analytics/assessments/history`
- `GET /analytics/assessments/performance`
- `GET /analytics/assessments/{id}`

**Current:** `BigQueryAnalyticsService.get_assessment_*()` methods
**New:** `FirestoreAnalyticsService.get_assessment_*()`

**Data sources:**
- Need a new Firestore subcollection: `students/{id}/assessments/{assessment_id}`
- Assessment data currently lives only in BigQuery. Will need to be written to Firestore going forward and backfilled.

**Note:** If assessment data doesn't currently write to Firestore, this is the one area that may require adding write-path instrumentation before the analytics migration can be complete.

---

## 5. Service Implementation Details

### 5.1 Class Structure

```python
class FirestoreAnalyticsService:
    def __init__(
        self,
        firestore_service: FirestoreService,
        curriculum_service: CurriculumService,
    ):
        self.fs = firestore_service
        self.curriculum = curriculum_service
        self._cache = {}  # {cache_key: (timestamp, data)}
        self._cache_ttl = timedelta(minutes=2)

    # Core analytics methods
    async def get_hierarchical_metrics(self, student_id, subject=None, ...) -> Dict
    async def get_timeseries_metrics(self, student_id, subject=None, interval='month', ...) -> List[Dict]
    async def get_recommendations(self, student_id, subject=None, limit=5) -> List[Dict]
    async def get_velocity_metrics(self, student_id, subject=None) -> Dict
    async def get_score_distribution(self, student_id, subject, ...) -> Dict
    async def get_score_trends(self, student_id, granularity, ...) -> Dict
    async def get_recent_activity(self, student_id, hours=24, ...) -> List[Dict]
    async def get_mistake_patterns(self, student_id, subject=None, days=30) -> List[Dict]
    async def get_problem_reviews(self, student_id, subject=None, ...) -> List[Dict]

    # Assessment analytics
    async def get_assessment_overview(self, student_id, subject=None) -> Dict
    async def get_assessment_history(self, student_id, ...) -> Dict
    async def get_assessment_performance(self, student_id, ...) -> Dict
    async def get_assessment_details(self, assessment_id, student_id) -> Dict

    # Shared helpers
    async def _load_competency_map(self, student_id, subject=None) -> Dict[str, Dict]
    async def _load_lifecycle_map(self, student_id, subject=None) -> Dict[str, Dict]
    async def _load_attempts(self, student_id, subject=None, start=None, end=None, limit=None) -> List[Dict]
    async def _load_curriculum_hierarchy(self, subject) -> List[Dict]
    async def _enrich_subskill(self, subskill_id, comp_map, lifecycle_map) -> Dict
```

### 5.2 Shared Helper: `_load_competency_map`

Most endpoints need a `{subskill_id: competency_data}` lookup. This helper loads all competency docs for a student (optionally filtered by subject) and returns a dict. Cost: O(N) doc reads where N = unique subskills the student has touched.

### 5.3 Shared Helper: `_load_lifecycle_map`

Same pattern for mastery lifecycle docs. Returns `{subskill_id: lifecycle_data}` with gate, completion_pct, etc.

### 5.4 Shared Helper: `_enrich_subskill`

Given a subskill_id and the two maps above, compute all derived analytics fields (mastery, proficiency, priority_level, readiness_status, etc.) using the same formulas as the current BigQuery SQL.

---

## 6. Endpoint Router Changes

### 6.1 Dependency Injection

Replace `BigQueryAnalyticsService` with `FirestoreAnalyticsService` in the dependency chain:

```python
# Current (analytics.py)
def get_bigquery_analytics_service() -> BigQueryAnalyticsService:
    ...

# New
def get_analytics_service() -> FirestoreAnalyticsService:
    return FirestoreAnalyticsService(
        firestore_service=get_firestore_service(),
        curriculum_service=get_curriculum_service(),
    )
```

### 6.2 Endpoint Signature Changes

Each endpoint's `Depends(get_bigquery_analytics_service)` becomes `Depends(get_analytics_service)`. The response models stay the same — the frontend sees no change.

### 6.3 ETL Endpoints (Deprecated)

The following endpoints become no-ops or are removed:

- `POST /analytics/etl/sync` — no longer needed (no ETL)
- `POST /analytics/cache/clear` — keep but update to clear FirestoreAnalyticsService cache
- `GET /analytics/cache/stats` — keep but update to report Firestore cache stats

---

## 7. Denormalized Aggregates (Performance Optimization)

Some queries that BigQuery handled efficiently via columnar scans will be expensive as naive Firestore reads. For these, we pre-compute summary documents.

### 7.1 Student Subject Summary

**Path:** `students/{id}/subject_summaries/{subject_id}`
**Updated:** On every competency update (write-time aggregation in CompetencyService)

```json
{
  "subject": "Mathematics",
  "total_attempts": 450,
  "total_subskills_attempted": 32,
  "total_subskills": 85,
  "avg_score": 7.2,
  "mastery_avg": 0.62,
  "gate_counts": {"0": 53, "1": 12, "2": 8, "3": 7, "4": 5},
  "last_activity": "2026-03-01T14:30:00Z",
  "updated_at": "2026-03-01T14:30:00Z"
}
```

This allows velocity metrics, overview stats, and subject-level aggregates without reading every competency doc.

### 7.2 Weekly Attempt Rollup (for Timeseries)

**Path:** `students/{id}/attempt_rollups/{YYYY-Www}` (e.g., `2026-W09`)
**Updated:** On every attempt save

```json
{
  "week": "2026-W09",
  "start_date": "2026-02-23",
  "by_subject": {
    "Mathematics": {"attempts": 15, "score_sum": 112.5, "distinct_subskills": 8},
    "Language Arts": {"attempts": 10, "score_sum": 78.0, "distinct_subskills": 5}
  },
  "total_attempts": 25,
  "updated_at": "2026-03-01T14:30:00Z"
}
```

This makes timeseries queries O(weeks) instead of O(attempts).

---

## 8. Migration Strategy

### Phase 1: Build FirestoreAnalyticsService (no endpoint changes)

1. Create `backend/app/services/firestore_analytics.py` with all methods
2. Write tests against Firestore emulator or mock data
3. Add a `/analytics/student/{id}/metrics-v2` shadow endpoint that calls the new service
4. Compare output of v1 (BigQuery) vs v2 (Firestore) for validation

### Phase 2: Add Denormalized Aggregates

1. Add `subject_summaries` write-time updates in CompetencyService
2. Add `attempt_rollups` write-time updates in Firestore attempt save
3. Backfill existing students by running a one-time script over existing data

### Phase 3: Swap Endpoints

1. Update `analytics.py` dependency injection to use `FirestoreAnalyticsService`
2. Remove `BigQueryAnalyticsService` dependency from all analytics endpoints
3. Keep BigQuery service available for CurriculumService authored content fallbacks (detailed_objectives, subskill_foundations, reading_content, visual_snippets)
4. Deprecate ETL sync endpoint

### Phase 4: Cleanup

1. Remove `BigQueryETLService` and ETL sync endpoint
2. Remove CosmosDB reads from CompetencyService (Firestore becomes sole read path)
3. Remove dual-write to CosmosDB from CompetencyService (optional, depending on other consumers)
4. Remove BigQuery attempts/reviews/competencies tables (keep curriculum/authored content tables)
5. Update frontend cache TTLs — data is now live, 2-minute client cache is sufficient

---

## 9. Frontend Impact

### 9.1 Zero Breaking Changes

All response models (`MetricsResponse`, `TimeseriesResponse`, `VelocityMetricsResponse`, `ScoreDistributionResponse`, `ScoreTrendsResponse`, `AssessmentOverviewResponse`, etc.) remain identical. The frontend hooks continue to call the same endpoints and receive the same shapes.

### 9.2 Behavior Improvements

- **Instant feedback:** After completing a problem, refreshing analytics shows updated scores immediately
- **Shorter cache TTLs:** Frontend hooks can reduce polling intervals or cache TTLs since data is live
- **No stale-data warnings:** Remove any "data may be up to 24 hours old" disclaimers

### 9.3 Optional Frontend Enhancements (Post-Migration)

- Real-time subscriptions via Firestore onSnapshot (future, not in this PRD scope)
- Optimistic UI updates for score changes

---

## 10. Affected Files

### New Files
| File | Purpose |
|------|---------|
| `backend/app/services/firestore_analytics.py` | New analytics service |
| `backend/tests/test_firestore_analytics.py` | Service tests |

### Modified Files
| File | Changes |
|------|---------|
| `backend/app/api/endpoints/analytics.py` | Swap dependency injection from BigQuery to Firestore analytics |
| `backend/app/services/competency.py` | Add write-time aggregation for subject_summaries, attempt_rollups |
| `backend/app/db/firestore_service.py` | Add methods for subject_summaries, attempt_rollups CRUD |
| `backend/app/core/dependencies.py` | Add `get_firestore_analytics_service()` factory |

### Deprecated Files (Phase 4)
| File | Status |
|------|--------|
| `backend/app/services/bigquery_analytics.py` | Deprecated for analytics reads (keep for authored content) |
| `backend/app/services/bigquery_etl.py` | Deprecated entirely |

---

## 11. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Firestore read costs spike for heavy users | Cost | Denormalized aggregates (§7) reduce reads 10-50x for common queries. 2-min response cache absorbs repeated hits. |
| Python aggregation slower than BQ SQL for large datasets | Latency | Student-scoped data is bounded (~200-500 subskills per student). In-memory aggregation over 500 dicts is <50ms. |
| Assessment data not in Firestore | Feature gap | Instrument assessment write path to Firestore before migrating assessment analytics. Backfill existing data. |
| Regression in analytics accuracy | Correctness | Phase 1 shadow endpoint compares BQ vs Firestore outputs before any swap. |
| Timeseries over long periods expensive | Latency | Weekly rollup docs (§7.2) make this O(weeks) not O(attempts). Default lookback to 6 months. |

---

## 12. Success Criteria

1. **Zero ETL dependency:** All student-facing analytics endpoints return live data without BigQuery reads
2. **Response contract unchanged:** All existing frontend hooks work without modification
3. **Latency ≤ current:** p95 analytics endpoint latency stays under 500ms
4. **Data accuracy:** Shadow testing shows <0.1% deviation between BQ and Firestore results (rounding differences only)
5. **Cost neutral:** Firestore read costs offset by elimination of BQ query costs and ETL compute

---

## 13. Open Questions

1. **Assessment data write path:** Do assessments currently write to Firestore, or only to BigQuery/CosmosDB? If not, this needs to be instrumented first.
2. **AI Recommendations endpoint:** Currently uses `AIRecommendationService` which wraps BigQuery analytics internally. Should this also be migrated, or does it remain a separate concern?
3. **Cross-student analytics:** Any future need for classroom-level or teacher-view analytics? This PRD is student-scoped only. Cross-student queries would need a different approach (collection-group queries or a read-optimized aggregate store).
4. **CosmosDB deprecation timeline:** CompetencyService currently dual-writes. When can CosmosDB writes be dropped entirely?
