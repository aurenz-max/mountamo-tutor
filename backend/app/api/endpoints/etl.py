# backend/app/api/endpoints/etl.py
import asyncio
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from app.etl.postgres_etl import get_etl_instance
from typing import Dict, Any
import logging

logger = logging.getLogger("api.etl")

router = APIRouter()

# Track the last ETL run status
last_run_status = {
    "status": "never_run",
    "message": "ETL has not been run yet",
    "timestamp": None
}

async def run_etl_task():
    """Background task to run the ETL process."""
    global last_run_status
    
    try:
        etl = get_etl_instance()
        last_run_status["status"] = "running"
        last_run_status["message"] = "ETL process is running"
        last_run_status["timestamp"] = None
        
        # Run the ETL process
        await etl.run_etl()
        
        # Update status on success
        from datetime import datetime
        last_run_status["status"] = "success"
        last_run_status["message"] = "ETL process completed successfully"
        last_run_status["timestamp"] = datetime.utcnow().isoformat()
        
    except Exception as e:
        # Update status on failure
        from datetime import datetime
        last_run_status["status"] = "error"
        last_run_status["message"] = f"ETL process failed: {str(e)}"
        last_run_status["timestamp"] = datetime.utcnow().isoformat()
        logger.error(f"ETL process failed: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())


@router.post("/run", status_code=status.HTTP_202_ACCEPTED)
async def trigger_etl(background_tasks: BackgroundTasks) -> Dict[str, Any]:
    """
    Trigger ETL process to run in the background.
    
    This endpoint will start the ETL process to transfer data from Cosmos DB to PostgreSQL.
    The process runs in the background and does not block the response.
    """
    if last_run_status.get("status") == "running":
        return {
            "message": "ETL process is already running",
            "status": last_run_status
        }
    
    # Add the ETL task to background tasks
    background_tasks.add_task(run_etl_task)
    
    return {
        "message": "ETL process triggered successfully",
        "status": "scheduled"
    }


@router.get("/status")
async def get_etl_status() -> Dict[str, Any]:
    """
    Get the status of the last ETL run.
    
    Returns information about the last ETL process execution, including 
    status, message, and timestamp.
    """
    return {
        "status": last_run_status.get("status", "unknown"),
        "message": last_run_status.get("message", ""),
        "timestamp": last_run_status.get("timestamp"),
    }