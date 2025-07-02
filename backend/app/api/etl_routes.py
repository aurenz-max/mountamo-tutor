# backend/app/api/etl_routes.py

from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends, Query
from fastapi.security import HTTPBearer
from typing import Dict, Any, Optional
import logging
from datetime import datetime

from app.services.bigquery_etl import BigQueryETLService
from app.core.config import settings

logger = logging.getLogger(__name__)
security = HTTPBearer()

# Suppress Azure SDK logging
logging.getLogger('azure').setLevel(logging.WARNING)
logging.getLogger('azure.core').setLevel(logging.WARNING)


router = APIRouter(prefix="/etl", tags=["ETL"])

# Global ETL service instance
etl_service = None

def get_etl_service() -> BigQueryETLService:
    """Get or create ETL service instance"""
    global etl_service
    
    if not settings.is_bigquery_enabled:
        raise HTTPException(
            status_code=503, 
            detail="BigQuery is not properly configured. Check GCP_PROJECT_ID and credentials."
        )
    
    if etl_service is None:
        try:
            etl_service = BigQueryETLService()
            logger.info("ETL service initialized")
        except Exception as e:
            logger.error(f"Failed to initialize ETL service: {e}")
            raise HTTPException(status_code=503, detail=f"ETL service initialization failed: {e}")
    
    return etl_service

@router.get("/status")
async def get_etl_status(service: BigQueryETLService = Depends(get_etl_service)):
    """Get current ETL status and table information"""
    try:
        status = await service.get_sync_status()
        return {
            "success": True,
            "bigquery_enabled": settings.is_bigquery_enabled,
            "project_id": settings.GCP_PROJECT_ID,
            "dataset_id": settings.BIGQUERY_DATASET_ID,
            "status": status
        }
    except Exception as e:
        logger.error(f"Error getting ETL status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
async def check_etl_health(service: BigQueryETLService = Depends(get_etl_service)):
    """Check health of all ETL connections"""
    try:
        health_check = await service.test_connections()
        
        # Determine overall health
        is_healthy = health_check.get("bigquery", False) and health_check.get("cosmos_db", False)
        
        return {
            "success": True,
            "healthy": is_healthy,
            "connections": health_check,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error checking ETL health: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sync/attempts")
async def sync_attempts(
    background_tasks: BackgroundTasks,
    incremental: bool = Query(True, description="Use incremental sync"),
    limit: Optional[int] = Query(None, description="Limit number of records (for testing)"),
    background: bool = Query(False, description="Run sync in background"),
    service: BigQueryETLService = Depends(get_etl_service)
):
    """Sync attempts data from Cosmos DB to BigQuery"""
    
    if background:
        background_tasks.add_task(service.sync_attempts_from_cosmos, incremental, limit)
        return {
            "success": True,
            "message": "Attempts sync started in background",
            "sync_type": "incremental" if incremental else "full"
        }
    
    try:
        result = await service.sync_attempts_from_cosmos(incremental, limit)
        return result
    except Exception as e:
        logger.error(f"Error syncing attempts: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sync/reviews")
async def sync_reviews(
    background_tasks: BackgroundTasks,
    incremental: bool = Query(True, description="Use incremental sync"),
    limit: Optional[int] = Query(None, description="Limit number of records (for testing)"),
    background: bool = Query(False, description="Run sync in background"),
    service: BigQueryETLService = Depends(get_etl_service)
):
    """Sync reviews data from Cosmos DB to BigQuery"""
    
    if background:
        background_tasks.add_task(service.sync_reviews_from_cosmos, incremental, limit)
        return {
            "success": True,
            "message": "Reviews sync started in background",
            "sync_type": "incremental" if incremental else "full"
        }
    
    try:
        result = await service.sync_reviews_from_cosmos(incremental, limit)
        return result
    except Exception as e:
        logger.error(f"Error syncing reviews: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sync/curriculum")
async def sync_curriculum(
    background_tasks: BackgroundTasks,
    subject: Optional[str] = Query(None, description="Specific subject to sync"),
    background: bool = Query(False, description="Run sync in background"),
    service: BigQueryETLService = Depends(get_etl_service)
):
    """Sync curriculum data from blob storage to BigQuery"""
    
    if background:
        background_tasks.add_task(service.sync_curriculum_from_blob, subject)
        return {
            "success": True,
            "message": f"Curriculum sync started in background for subject: {subject or 'all'}"
        }
    
    try:
        result = await service.sync_curriculum_from_blob(subject)
        return result
    except Exception as e:
        logger.error(f"Error syncing curriculum: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sync/learning-paths")
async def sync_learning_paths(
    background_tasks: BackgroundTasks,
    background: bool = Query(False, description="Run sync in background"),
    service: BigQueryETLService = Depends(get_etl_service)
):
    """Sync learning paths data from blob storage to BigQuery"""
    
    if background:
        background_tasks.add_task(service.sync_learning_paths_from_blob)
        return {
            "success": True,
            "message": "Learning paths sync started in background"
        }
    
    try:
        result = await service.sync_learning_paths_from_blob()
        return result
    except Exception as e:
        logger.error(f"Error syncing learning paths: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sync/full")
async def run_full_sync(
    background_tasks: BackgroundTasks,
    test_mode: bool = Query(False, description="Run in test mode with limited data"),
    background: bool = Query(False, description="Run sync in background"),
    service: BigQueryETLService = Depends(get_etl_service)
):
    """Run complete ETL sync of all data sources"""
    
    if background:
        background_tasks.add_task(service.run_full_sync, test_mode)
        return {
            "success": True,
            "message": f"Full ETL sync started in background (test_mode: {test_mode})"
        }
    
    try:
        result = await service.run_full_sync(test_mode)
        return result
    except Exception as e:
        logger.error(f"Error running full sync: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/validate")
async def validate_data_integrity(service: BigQueryETLService = Depends(get_etl_service)):
    """Validate data integrity across all ETL tables"""
    try:
        result = await service.validate_data_integrity()
        return result
    except Exception as e:
        logger.error(f"Error validating data integrity: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/cleanup")
async def cleanup_old_data(
    days_to_keep: int = Query(90, description="Number of days of data to keep"),
    service: BigQueryETLService = Depends(get_etl_service)
):
    """Clean up old or duplicate data"""
    try:
        result = await service.cleanup_old_data(days_to_keep)
        return result
    except Exception as e:
        logger.error(f"Error cleaning up data: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/config")
async def get_etl_config():
    """Get current ETL configuration"""
    return {
        "bigquery_enabled": settings.is_bigquery_enabled,
        "project_id": settings.GCP_PROJECT_ID,
        "dataset_id": settings.BIGQUERY_DATASET_ID,
        "dataset_full_id": settings.bigquery_dataset_full_id,
        "location": settings.BIGQUERY_LOCATION,
        "batch_size": settings.ETL_BATCH_SIZE,
        "max_retries": settings.ETL_MAX_RETRIES,
        "credentials_configured": bool(settings.GOOGLE_APPLICATION_CREDENTIALS),
        "cache_ttl_minutes": settings.ANALYTICS_CACHE_TTL_MINUTES,
        "query_caching_enabled": settings.ENABLE_QUERY_CACHING
    }

# Analytics query endpoints
@router.get("/analytics/student-progress/{student_id}")
async def get_student_progress(
    student_id: int,
    subject: Optional[str] = Query(None),
    service: BigQueryETLService = Depends(get_etl_service)
):
    """Get student progress analytics from BigQuery"""
    try:
        # Build query
        where_clause = f"WHERE student_id = {student_id}"
        if subject:
            where_clause += f" AND subject = '{subject}'"
        
        query = f"""
        SELECT 
            subject,
            skill_id,
            subskill_id,
            COUNT(*) as attempt_count,
            AVG(score) as avg_score,
            MAX(score) as max_score,
            MIN(timestamp) as first_attempt,
            MAX(timestamp) as latest_attempt
        FROM `{settings.bigquery_dataset_full_id}.attempts`
        {where_clause}
        GROUP BY subject, skill_id, subskill_id
        ORDER BY latest_attempt DESC
        """
        
        job = service.client.query(query)
        results = [dict(row) for row in job.result()]
        
        return {
            "success": True,
            "student_id": student_id,
            "subject": subject,
            "progress": results
        }
        
    except Exception as e:
        logger.error(f"Error getting student progress: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analytics/subject-stats")
async def get_subject_statistics(
    subject: Optional[str] = Query(None),
    service: BigQueryETLService = Depends(get_etl_service)
):
    """Get subject-level statistics from BigQuery"""
    try:
        where_clause = ""
        if subject:
            where_clause = f"WHERE subject = '{subject}'"
        
        query = f"""
        SELECT 
            subject,
            COUNT(DISTINCT student_id) as unique_students,
            COUNT(*) as total_attempts,
            AVG(score) as avg_score,
            STDDEV(score) as score_stddev,
            COUNT(DISTINCT subskill_id) as subskills_practiced
        FROM `{settings.bigquery_dataset_full_id}.attempts`
        {where_clause}
        GROUP BY subject
        ORDER BY subject
        """
        
        job = service.client.query(query)
        results = [dict(row) for row in job.result()]
        
        return {
            "success": True,
            "subject_filter": subject,
            "statistics": results
        }
        
    except Exception as e:
        logger.error(f"Error getting subject statistics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analytics/recent-activity")
async def get_recent_activity(
    hours: int = Query(24, description="Hours of recent activity to fetch"),
    limit: int = Query(100, description="Maximum number of records"),
    service: BigQueryETLService = Depends(get_etl_service)
):
    """Get recent student activity from BigQuery"""
    try:
        query = f"""
        SELECT 
            student_id,
            subject,
            skill_id,
            subskill_id,
            score,
            timestamp
        FROM `{settings.bigquery_dataset_full_id}.attempts`
        WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL {hours} HOUR)
        ORDER BY timestamp DESC
        LIMIT {limit}
        """
        
        job = service.client.query(query)
        results = [dict(row) for row in job.result()]
        
        return {
            "success": True,
            "hours": hours,
            "activity_count": len(results),
            "recent_activity": results
        }
        
    except Exception as e:
        logger.error(f"Error getting recent activity: {e}")
        raise HTTPException(status_code=500, detail=str(e))