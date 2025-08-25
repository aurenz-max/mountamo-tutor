# Firestore Migration for Real-Time Analytics

This document describes the implementation of dual-write pattern to migrate from CosmosDB to Firestore for real-time analytics.

## Overview

The migration enables real-time analytics by writing student data to both CosmosDB (existing) and Firestore (new) simultaneously. This allows for:

- **Real-time data availability** - Firestore integrates natively with BigQuery
- **Zero downtime migration** - System continues to work with CosmosDB while Firestore is being populated
- **Data consistency** - Both databases receive the same data
- **Rollback capability** - Can fall back to CosmosDB-only if needed

## Architecture

### Current Flow
```
Student App → CosmosDB → Batch ETL (4-24hr delay) → BigQuery → Analytics Dashboard
```

### New Flow (Dual Write)
```
Student App → CosmosDB (primary)
            → Firestore → Cloud Function (real-time) → BigQuery → Analytics Dashboard
```

### Target Flow (Post-Migration)
```
Student App → Firestore → Cloud Function (real-time) → BigQuery → Analytics Dashboard
```

## Implementation

### 1. Firestore Service (`app/db/firestore_service.py`)
- Handles all Firestore operations
- Provides same interface as CosmosDB service
- Includes data preparation for Firestore compatibility
- Adds migration metadata to track data source

### 2. Updated Services
- **ReviewService** (`app/services/review.py`) - Saves attempts and reviews to both databases
- **CompetencyService** (`app/services/competency.py`) - Saves attempts and updates competencies in both databases

### 3. Dependency Injection (`app/dependencies.py`)
- Added Firestore service as dependency
- Updated service factories to inject both database services

## Data Models

### Student Attempts
```json
{
  "id": "uuid",
  "student_id": 12345,
  "subject": "Mathematics",
  "skill_id": "addition",
  "subskill_id": "single_digit",
  "score": 8.5,
  "analysis": "Good understanding of addition",
  "feedback": "Keep practicing",
  "timestamp": "2024-01-01T12:00:00Z",
  "source_system": "cosmos_migration",
  "migration_timestamp": "2024-01-01T12:00:00Z"
}
```

### Problem Reviews
```json
{
  "id": "uuid",
  "student_id": 12345,
  "problem_id": "problem_uuid",
  "subject": "Mathematics",
  "skill_id": "addition",
  "subskill_id": "single_digit",
  "full_review": {
    "observation": {},
    "analysis": {},
    "evaluation": {"score": 8},
    "feedback": {}
  },
  "score": 8.0,
  "timestamp": "2024-01-01T12:00:00Z",
  "source_system": "cosmos_migration",
  "migration_timestamp": "2024-01-01T12:00:00Z"
}
```

### Competencies
```json
{
  "id": "12345_Mathematics_addition_single_digit",
  "student_id": 12345,
  "subject": "Mathematics",
  "skill_id": "addition",
  "subskill_id": "single_digit",
  "current_score": 7.5,
  "credibility": 0.85,
  "total_attempts": 10,
  "last_updated": "2024-01-01T12:00:00Z",
  "source_system": "cosmos_migration",
  "migration_timestamp": "2024-01-01T12:00:00Z"
}
```

## Configuration

### Environment Variables
```bash
# Google Cloud Project
GCP_PROJECT_ID=your-project-id

# Google Cloud Authentication
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
```

### Firestore Collections
- `student_attempts` - All student problem attempts
- `student_reviews` - All problem reviews and feedback
- `student_competencies` - Student skill competency tracking

## Monitoring

The system includes basic logging for dual writes:

### Success Logging
```
INFO: Successfully saved attempt to CosmosDB for student 12345
INFO: Successfully saved attempt to Firestore for student 12345  
INFO: Dual write successful for attempt by student 12345
```

### Warning Logging
```
WARNING: Only CosmosDB write successful for attempt by student 12345
WARNING: Only Firestore write successful for attempt by student 12345
```

### Error Logging
```
ERROR: Failed to save attempt to CosmosDB: connection timeout
ERROR: Failed to save attempt to Firestore: authentication failed
ERROR: Both writes failed for attempt by student 12345
```

## Testing

Run the Firestore service tests:
```bash
cd backend
python -m pytest app/tests/test_firestore_service.py -v
```

## Migration Phases

### Phase 1: Dual Write (Current)
- All new data goes to both CosmosDB and Firestore
- Analytics still uses CosmosDB data via batch ETL
- Monitor dual write success rates

### Phase 2: Firestore Analytics (Next)
- Set up Cloud Functions to stream Firestore → BigQuery
- Update analytics dashboard to use real-time data
- Validate data consistency

### Phase 3: Firestore Primary (Future)
- Switch analytics to use Firestore data exclusively
- Keep CosmosDB as backup for rollback capability
- Monitor performance and data consistency

### Phase 4: CosmosDB Deprecation (Final)
- Remove CosmosDB writes after validation period
- Clean up old batch ETL processes
- Update services to use Firestore only

## Rollback Plan

If issues arise, rollback steps:

1. **Immediate**: Set `firestore_service = None` in dependencies
2. **Code**: Comment out Firestore writes in services
3. **Config**: Remove Firestore environment variables
4. **Deploy**: System will continue with CosmosDB only

## Error Handling

The dual write implementation is designed to be resilient:

- **Firestore unavailable**: System continues with CosmosDB only
- **CosmosDB unavailable**: System continues with Firestore only  
- **Both unavailable**: Operation fails (as expected)
- **Partial failures**: Logged as warnings for monitoring

## Next Steps

1. **Deploy dual write** - Current implementation
2. **Set up Cloud Functions** - Firestore to BigQuery streaming
3. **Update BigQuery schema** - Include new Firestore data sources
4. **Build real-time dashboard** - Connect to new data pipeline
5. **Validate consistency** - Compare CosmosDB vs Firestore data
6. **Switch analytics** - Use Firestore as primary source
7. **Performance testing** - Ensure system meets requirements
8. **Documentation** - Update API docs and runbooks

## Support

For questions or issues with the migration:
1. Check logs for dual write success/failure messages
2. Verify Firestore configuration and credentials
3. Test with `app/tests/test_firestore_service.py`
4. Review this documentation for troubleshooting steps