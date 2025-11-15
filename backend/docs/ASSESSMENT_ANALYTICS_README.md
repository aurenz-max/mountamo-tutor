# Assessment Analytics ETL Implementation

## Overview

This implementation provides a comprehensive ETL (Extract, Transform, Load) system for analyzing assessment data from Cosmos DB in BigQuery. The system transforms complex, nested assessment documents into a normalized, queryable schema optimized for analytics and insights.

## Architecture

### Data Flow

```
Cosmos DB (assessments container)
    ↓
BigQueryETLService.sync_assessments_from_cosmos()
    ↓
4 Normalized BigQuery Tables:
    1. assessments - Core assessment metadata
    2. assessment_subskill_attempts - Blueprint subskills (flattened)
    3. assessment_problem_reviews - Individual problem results
    4. assessment_skill_insights - AI-generated insights
```

### BigQuery Tables

#### 1. `analytics.assessments`
**Purpose:** Core assessment metadata and summary metrics

**Key Fields:**
- `assessment_id` (STRING) - Unique assessment identifier
- `student_id` (INTEGER) - Student identifier
- `subject`, `status`, `total_questions`
- Timing: `created_at`, `started_at`, `completed_at`, `time_taken_minutes`
- Metrics: `score_percentage`, `correct_count`
- Category breakdown: `weak_spots_count`, `foundational_review_count`, etc.
- `performance_by_type` (ARRAY<STRUCT>) - Performance by problem type
- `performance_by_category` (ARRAY<STRUCT>) - Performance by assessment category
- AI insights: `ai_summary`, `performance_quote`, `common_misconceptions`

**Partitioning:** `DATE(completed_at)`
**Clustering:** `student_id`, `subject`, `status`

**Use Cases:**
- Track overall assessment performance trends
- Compare performance across subjects
- Analyze completion rates and time management
- Identify students needing intervention

---

#### 2. `analytics.assessment_subskill_attempts`
**Purpose:** Normalized table tracking which subskills were included in each assessment and their mastery levels at that point in time

**Key Fields:**
- `assessment_id`, `student_id`, `subskill_id` (composite key)
- Hierarchy: `subject`, `skill_id`, `unit_id`, `unit_title`
- `category` - Assessment focus (weak_spots, new_frontiers, etc.)
- Performance metrics: `mastery`, `avg_score`, `proficiency`, `completion`
- `attempt_count`, `readiness_status`, `priority_level`

**Partitioning:** `DATE(assessment_completed_at)`
**Clustering:** `student_id`, `subskill_id`, `category`

**Use Cases:**
- Track how subskill mastery evolves over time
- Analyze which categories get the most focus
- Identify subskills that consistently appear as weak spots
- Measure effectiveness of assessment targeting

---

#### 3. `analytics.assessment_problem_reviews`
**Purpose:** Individual problem-level results for detailed error analysis

**Key Fields:**
- `assessment_id`, `problem_id`, `student_id` (composite key)
- Hierarchy: `subject`, `skill_id`, `skill_name`, `subskill_id`, `unit_id`
- Problem details: `problem_type`, `difficulty`, `grade_level`
- Performance: `is_correct`, `score` (0-10 scale)
- Answers: `student_answer_text`, `correct_answer_text`
- **Misconception tracking:** `misconception`, `misconception_addressed`

**Partitioning:** `DATE(assessment_completed_at)`
**Clustering:** `student_id`, `subskill_id`, `is_correct`

**Use Cases:**
- Misconception analysis and tracking
- Problem difficulty analysis
- Success rates by problem type
- Student answer pattern analysis
- Error categorization

---

#### 4. `analytics.assessment_skill_insights`
**Purpose:** AI-generated skill-level insights and recommendations

**Key Fields:**
- `assessment_id`, `skill_id`, `student_id` (composite key)
- Hierarchy: `subject`, `skill_name`, `unit_id`
- `category` - Assessment focus category
- Performance: `total_questions`, `correct_count`, `percentage`
- AI fields: `assessment_focus_tag`, `performance_label`, `insight_text`
- `next_step` (STRUCT) - Recommended action with link and type
- `subskills` (ARRAY<STRUCT>) - Detailed subskill breakdown

**Partitioning:** `DATE(assessment_completed_at)`
**Clustering:** `student_id`, `skill_id`, `performance_label`

**Use Cases:**
- Personalized learning recommendations
- Skill mastery tracking
- Identify skills ready for advancement
- Generate coaching insights

---

## ETL Implementation

### Running the ETL

#### Option 1: Full ETL Script
```bash
# From backend directory
cd scripts
python cosmos_to_bigquery_etl.py

# Or with custom options
python cosmos_to_bigquery_etl.py --incremental --batch-size 500
```

This will:
1. Create all assessment tables if they don't exist
2. Fetch completed assessments from Cosmos DB
3. Transform nested data into flat records
4. Load data to BigQuery with deduplication

#### Option 2: Programmatic API
```python
from app.services.bigquery_etl import BigQueryETLService

etl_service = BigQueryETLService()

# Sync all assessments
result = await etl_service.sync_assessments_from_cosmos(
    incremental=False,
    limit=None  # or set a limit for testing
)

print(f"Loaded {result['records_processed']} records")
print(f"Details: {result['details']}")
```

### Data Transformation Logic

#### 1. Main Assessment Transformation
- Extracts top-level metadata
- Flattens `performance_by_problem_type` dict to ARRAY<STRUCT>
- Flattens `performance_by_category` dict to ARRAY<STRUCT>
- Extracts `detailed_metrics` from summary
- Handles timestamp parsing for multiple formats

#### 2. Subskill Attempts Extraction
- Iterates through `blueprint.selected_subskills` array
- Creates one record per subskill per assessment
- Preserves mastery, proficiency, and readiness metrics
- Maintains category classification

#### 3. Problem Reviews Extraction
- Iterates through `results.problem_reviews` array
- Creates one record per problem per assessment
- Extracts student and correct answers
- Includes misconception data when available

#### 4. Skill Insights Extraction
- Iterates through `results.ai_insights.skill_insights` array
- Transforms `next_step` object to STRUCT
- Preserves `subskills` array as nested ARRAY<STRUCT>
- Maintains AI-generated text insights

---

## Sample Analytics Queries

See [assessment_analytics_queries.sql](./assessment_analytics_queries.sql) for 50+ sample queries covering:

### 1. Trend Analysis
- Score trends over time by subject and category
- Assessment completion rates
- Performance evolution

### 2. Misconception Analysis
- Most common misconceptions by subskill
- Student-specific misconception patterns
- Misconception improvement tracking

### 3. Student Progress Tracking
- Improvement in weak spots over time
- Subskill mastery progression
- Category performance evolution

### 4. Performance Distribution
- Score distribution analysis
- Problem type difficulty analysis
- Percentile rankings

### 5. AI Insights Analysis
- Common AI-identified patterns
- Assessment focus effectiveness
- Recommendation analysis

### 6. Cohort Comparison
- Student performance vs cohort average
- Z-score calculations
- Performance banding

### 7. Actionable Insights
- Students needing intervention
- High performers ready for challenge
- Risk level categorization

### 8. Time-Based Analysis
- Optimal assessment timing
- Assessment velocity and cadence
- Time-to-completion analysis

### 9. Dashboard Queries
- Student overview metrics
- Teacher/class overview
- Summary statistics

---

## Key Queries for Common Use Cases

### Find Students Struggling with Misconceptions
```sql
SELECT
  student_id,
  subject,
  misconception,
  COUNT(*) as times_encountered,
  COUNTIF(is_correct) / COUNT(*) as correction_rate
FROM `analytics.assessment_problem_reviews`
WHERE misconception IS NOT NULL
GROUP BY student_id, subject, misconception
HAVING times_encountered >= 3 AND correction_rate < 0.5
ORDER BY times_encountered DESC;
```

### Track Weak Spot Improvement
```sql
WITH assessment_sequence AS (
  SELECT
    student_id,
    subject,
    category,
    percentage,
    ROW_NUMBER() OVER (PARTITION BY student_id, subject, category ORDER BY assessment_completed_at) as attempt_number
  FROM `analytics.assessment_skill_insights`
  WHERE category = 'weak_spots'
)
SELECT
  student_id,
  subject,
  AVG(CASE WHEN attempt_number <= 3 THEN percentage END) as early_avg,
  AVG(CASE WHEN attempt_number > 3 THEN percentage END) as later_avg,
  AVG(CASE WHEN attempt_number > 3 THEN percentage END) - AVG(CASE WHEN attempt_number <= 3 THEN percentage END) as improvement
FROM assessment_sequence
GROUP BY student_id, subject
HAVING COUNT(*) >= 4
ORDER BY improvement DESC;
```

### Assessment Category Distribution
```sql
SELECT
  subject,
  category,
  COUNT(*) as assessments,
  AVG(percentage) as avg_score,
  COUNTIF(performance_label = 'Mastered') / COUNT(*) as mastery_rate
FROM `analytics.assessment_skill_insights`
WHERE assessment_completed_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY subject, category
ORDER BY subject, avg_score DESC;
```

---

## Schema Design Decisions

### Why 4 Tables Instead of 1?

**Normalization Benefits:**
1. **Query Performance** - Smaller tables with focused indexes
2. **Storage Efficiency** - No duplicate data across nested arrays
3. **Analytical Flexibility** - JOIN only what you need
4. **Independent Analysis** - Analyze problems separately from skill insights

### Denormalization Strategy

We strategically denormalize:
- **Hierarchy context** (subject, skill_id, unit_id) - Avoids expensive JOINs
- **High-level metrics** (score_percentage, correct_count) - Fast aggregations
- **Student metadata** - Commonly filtered fields

### ARRAY<STRUCT> vs Separate Tables

**Use ARRAY<STRUCT> when:**
- Small, bounded arrays (< 100 items)
- Data accessed together (performance_by_type)
- Filtering within parent record context

**Use separate tables when:**
- Large arrays (blueprint.selected_subskills can be 15+ items)
- Need independent analysis (problem_reviews)
- Want to JOIN with other tables

### Partitioning & Clustering

**Partitioning by `completed_at`:**
- Reduces query costs by ~90% for time-range filters
- Required for efficient data pruning
- Aligned with most common query patterns

**Clustering strategy:**
- Primary: `student_id` - Most common filter
- Secondary: `subject` - Second most common
- Tertiary: `status`, `category`, etc. - Categorical filters

---

## Data Quality & Validation

### Deduplication Strategy

The ETL uses MERGE logic with `assessment_id` as the unique key:
```sql
MERGE `analytics.assessments` T
USING `temp_assessments_staging` S
ON T.assessment_id = S.assessment_id
WHEN MATCHED AND S.sync_timestamp > T.sync_timestamp THEN
  UPDATE SET ... (all mutable fields)
WHEN NOT MATCHED THEN
  INSERT ...
```

### Data Integrity Checks

1. **Completed assessments only** - Filter for `status = 'completed'`
2. **Results validation** - Skip assessments without `results` structure
3. **Timestamp parsing** - Handle multiple ISO 8601 formats
4. **Null handling** - Graceful defaults for missing fields
5. **Error logging** - Continue processing on individual record errors

---

## Performance Considerations

### Query Optimization Tips

1. **Always use partition filters:**
   ```sql
   WHERE completed_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
   ```

2. **Use clustered columns in WHERE/JOIN:**
   ```sql
   WHERE student_id = 1004 AND subject = 'Mathematics'
   ```

3. **Limit result sets:**
   ```sql
   LIMIT 1000
   ```

4. **Use APPROX_QUANTILES for percentiles:**
   ```sql
   APPROX_QUANTILES(score, 100)[OFFSET(50)] as median
   ```

5. **Aggregate before JOIN when possible:**
   ```sql
   WITH student_stats AS (
     SELECT student_id, AVG(score_percentage) as avg_score
     FROM assessments
     GROUP BY student_id
   )
   SELECT * FROM student_stats JOIN students USING(student_id)
   ```

### Cost Management

- **Table size estimate:** ~1KB per assessment (main table)
- **Monthly storage:** ~$0.02/GB for active storage
- **Query costs:** ~$5/TB scanned
- **Typical monthly cost:** < $10 for 10K assessments with moderate querying

---

## Extending the Schema

### Adding New Fields

1. **Update schema method:**
   ```python
   def _get_assessments_schema(self):
       return [
           # ... existing fields
           bigquery.SchemaField("new_field", "STRING", mode="NULLABLE"),
       ]
   ```

2. **Update transformation:**
   ```python
   def _transform_assessment_data(self, assessments):
       # ... existing transformation
       transformed_record['new_field'] = assessment.get('new_field')
   ```

3. **Recreate table or add column:**
   ```sql
   ALTER TABLE `analytics.assessments`
   ADD COLUMN new_field STRING;
   ```

### Adding New Analytics Tables

Follow the same pattern:
1. Define schema method (`_get_new_table_schema()`)
2. Create transformation method (`_transform_new_data()`)
3. Add to `sync_assessments_from_cosmos()` pipeline
4. Add to `ensure_tables_exist()` in ETL script

---

## Troubleshooting

### Common Issues

**Issue:** "No assessments found in Cosmos DB"
- **Solution:** Verify assessments have `document_type = 'assessment'` field
- Check Cosmos DB query in `_fetch_assessments_from_cosmos()`

**Issue:** "Transformed 0/X assessments successfully"
- **Solution:** Check logs for transformation errors
- Verify assessments have `status = 'completed'` and `results` field

**Issue:** "BigQuery schema mismatch"
- **Solution:** Drop and recreate table, or add missing columns with ALTER TABLE
- Check for data type mismatches (e.g., INTEGER vs STRING)

**Issue:** "Timestamp parsing errors"
- **Solution:** Check `_parse_timestamp()` method handles your format
- Common formats: ISO 8601 with/without 'Z' suffix

### Debugging Tips

1. **Test with limited data:**
   ```python
   result = await etl_service.sync_assessments_from_cosmos(limit=10)
   ```

2. **Check transformation output:**
   ```python
   assessments = await self._fetch_assessments_from_cosmos(...)
   transformed = self._transform_assessment_data(assessments)
   print(json.dumps(transformed[0], indent=2))
   ```

3. **Validate BigQuery data:**
   ```sql
   SELECT * FROM `analytics.assessments` LIMIT 10;
   SELECT COUNT(*), MIN(created_at), MAX(completed_at)
   FROM `analytics.assessments`;
   ```

---

## Future Enhancements

### Potential Additions

1. **Real-time streaming** - Stream assessments as they complete
2. **Materialized views** - Pre-aggregate common queries
3. **ML predictions** - Predict student performance trends
4. **Alerts/notifications** - Alert teachers when students struggle
5. **Comparative analytics** - Benchmark against historical data
6. **Content effectiveness** - Track which problems are most valuable

### Integration Opportunities

- **Frontend dashboards** - Student/teacher analytics UIs
- **API endpoints** - Expose queries as REST APIs
- **Scheduled reports** - Daily/weekly email summaries
- **Data exports** - CSV/Excel downloads for offline analysis

---

## References

- **Cosmos DB assessments structure:** `backend/app/api/endpoints/assessments.py`
- **ETL service:** `backend/app/services/bigquery_etl.py`
- **ETL script:** `backend/scripts/cosmos_to_bigquery_etl.py`
- **Sample queries:** `backend/docs/assessment_analytics_queries.sql`
- **Schema documentation:** This file

---

## Support

For questions or issues:
1. Check existing queries in `assessment_analytics_queries.sql`
2. Review schema definitions in `bigquery_etl.py`
3. Test with small data samples first
4. Check BigQuery logs for detailed error messages

**Last Updated:** 2025-01-14
**Version:** 1.0.0
