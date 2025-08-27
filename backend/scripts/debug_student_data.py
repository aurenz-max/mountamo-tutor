#!/usr/bin/env python3
"""Debug script to check student data in Cosmos DB and BigQuery"""

import os
import sys
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv

# Load environment
env_path = backend_dir / ".env"
load_dotenv(env_path)

def setup_credentials():
    """Set up Google Cloud credentials with proper path resolution"""
    credentials_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
    
    if credentials_path:
        # Handle both relative and absolute paths
        if not os.path.isabs(credentials_path):
            # If relative, make it relative to backend directory
            full_credentials_path = backend_dir / credentials_path
        else:
            full_credentials_path = Path(credentials_path)
        
        print(f"Setting up credentials...")
        print(f"Credentials path from env: {credentials_path}")
        print(f"Full credentials path: {full_credentials_path}")
        print(f"Credentials file exists: {full_credentials_path.exists()}")
        
        # Set the absolute path for Google Cloud client
        os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = str(full_credentials_path)
        
        return full_credentials_path.exists()
    
    return False

def check_cosmos_students():
    """Check what student IDs exist in Cosmos DB"""
    print("=" * 60)
    print("COSMOS DB STUDENT DATA")
    print("=" * 60)
    
    try:
        from app.db.cosmos_db import CosmosDBService
        
        cosmos_service = CosmosDBService()
        print("+ Cosmos DB service initialized")
        
        # Get distinct student IDs from attempts
        student_query = "SELECT DISTINCT c.student_id FROM c ORDER BY c.student_id"
        students = list(cosmos_service.attempts.query_items(
            query=student_query,
            enable_cross_partition_query=True
        ))
        
        print(f"Found {len(students)} unique student IDs in attempts:")
        for student in students:
            print(f"  - Student ID: {student['student_id']}")
        
        # Get a few sample records to check data structure
        sample_query = "SELECT TOP 5 c.student_id, c.subject, c.skill_id, c.subskill_id, c.score, c.timestamp FROM c ORDER BY c._ts DESC"
        samples = list(cosmos_service.attempts.query_items(
            query=sample_query,
            enable_cross_partition_query=True
        ))
        
        print(f"\nSample recent attempts:")
        for i, sample in enumerate(samples, 1):
            print(f"  {i}. Student: {sample['student_id']}, Subject: {sample.get('subject', 'N/A')}, "
                  f"Skill: {sample.get('skill_id', 'N/A')}, Score: {sample.get('score', 'N/A')}")
        
        return students
        
    except Exception as e:
        print(f"X Error checking Cosmos DB: {e}")
        return []

def check_bigquery_students():
    """Check what student IDs exist in BigQuery"""
    print("\n" + "=" * 60)
    print("BIGQUERY STUDENT DATA")
    print("=" * 60)
    
    try:
        from google.cloud import bigquery
        from app.core.config import settings
        
        client = bigquery.Client(project=settings.GCP_PROJECT_ID)
        dataset_id = settings.BIGQUERY_DATASET_ID
        
        # Check if attempts table exists
        table_id = f"{settings.GCP_PROJECT_ID}.{dataset_id}.attempts"
        
        try:
            table = client.get_table(table_id)
            print(f"+ Attempts table exists: {table.num_rows} rows")
        except Exception as e:
            print(f"X Attempts table issue: {e}")
            return []
        
        # Get distinct student IDs from BigQuery
        student_query = f"""
        SELECT DISTINCT student_id
        FROM `{table_id}`
        ORDER BY student_id
        """
        
        job = client.query(student_query)
        students = list(job.result())
        
        print(f"Found {len(students)} unique student IDs in BigQuery:")
        for student in students:
            print(f"  - Student ID: {student['student_id']}")
        
        # Get sample records
        sample_query = f"""
        SELECT student_id, subject, skill_id, subskill_id, score, timestamp
        FROM `{table_id}`
        ORDER BY sync_timestamp DESC
        LIMIT 5
        """
        
        job = client.query(sample_query)
        samples = list(job.result())
        
        print(f"\nSample recent attempts in BigQuery:")
        for i, sample in enumerate(samples, 1):
            print(f"  {i}. Student: {sample['student_id']}, Subject: {sample['subject']}, "
                  f"Skill: {sample['skill_id']}, Score: {sample['score']}")
        
        return students
        
    except Exception as e:
        print(f"X Error checking BigQuery: {e}")
        import traceback
        traceback.print_exc()
        return []

def compare_data():
    """Compare the data between Cosmos DB and BigQuery"""
    print("\n" + "=" * 60)
    print("DATA COMPARISON")
    print("=" * 60)
    
    # Setup credentials first
    if not setup_credentials():
        print("X Credentials setup failed")
        return
    
    cosmos_students = check_cosmos_students()
    bigquery_students = check_bigquery_students()
    
    if cosmos_students and bigquery_students:
        cosmos_ids = set(s['student_id'] for s in cosmos_students)
        bigquery_ids = set(s['student_id'] for s in bigquery_students)
        
        print(f"\nComparison Summary:")
        print(f"  Cosmos DB student IDs: {sorted(cosmos_ids)}")
        print(f"  BigQuery student IDs: {sorted(bigquery_ids)}")
        
        missing_in_bigquery = cosmos_ids - bigquery_ids
        extra_in_bigquery = bigquery_ids - cosmos_ids
        
        if missing_in_bigquery:
            print(f"  X Missing in BigQuery: {sorted(missing_in_bigquery)}")
        
        if extra_in_bigquery:
            print(f"  ! Extra in BigQuery: {sorted(extra_in_bigquery)}")
        
        if cosmos_ids == bigquery_ids:
            print(f"  + Student IDs match between sources!")
        else:
            print(f"  X Student ID mismatch detected!")

if __name__ == "__main__":
    compare_data()