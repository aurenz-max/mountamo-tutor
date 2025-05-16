#!/usr/bin/env python3
"""
ETL Scheduler for Education Analytics Data Warehouse
This script sets up a scheduled job to run the ETL process on a regular basis.
"""

import asyncio
import logging
import schedule
import time
import sys
import os
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("etl_job.log"),
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger("education_etl_scheduler")

# Import the ETL class
from etl.cosmos_to_postgres_etl import CosmosToPostgresETL, run_scheduled_etl

def job():
    """Wrapper to run the async ETL job"""
    logger.info("Starting scheduled ETL job")
    asyncio.run(run_scheduled_etl())
    logger.info("Scheduled ETL job completed")

def setup_schedule():
    """Set up the schedule for the ETL job"""
    # Run daily at 2 AM
    schedule.every().day.at("02:00").do(job)
    
    # Additional schedules for different components
    # Run a quick update of recent attempts every hour
    # schedule.every(1).hour.do(quick_update_job)
    
    logger.info("ETL job scheduled to run daily at 2:00 AM")
    
    # Keep the script running to execute scheduled jobs
    while True:
        schedule.run_pending()
        time.sleep(60)  # Check every minute

if __name__ == "__main__":
    logger.info("Starting ETL scheduler")
    
    # Check if we should run immediately (command line argument)
    if len(sys.argv) > 1 and sys.argv[1] == "--run-now":
        logger.info("Running ETL job immediately")
        job()
    
    # Then set up the regular schedule
    setup_schedule()