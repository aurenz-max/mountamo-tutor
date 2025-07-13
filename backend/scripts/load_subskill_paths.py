#!/usr/bin/env python3
"""
Simple script to load subskill-paths.json into BigQuery
Based on your existing ETL infrastructure
"""

import os
import sys
import json
import asyncio
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any

# Add the backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv
from google.cloud import bigquery
from google.cloud.exceptions import NotFound

# Load environment
env_path = backend_dir / ".env"
load_dotenv(env_path)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

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

class SubskillPathLoader:
    """Load subskill paths JSON data into BigQuery"""
    
    def __init__(self):
        self.client = None
        self.dataset_id = os.getenv('BIGQUERY_DATASET_ID', 'analytics')
        self.project_id = os.getenv('GOOGLE_CLOUD_PROJECT', 'mountamo-tutor-h7wnta')
        self.table_id = 'subskill_paths'
        
    def initialize_client(self):
        """Initialize BigQuery client"""
        try:
            self.client = bigquery.Client(project=self.project_id)
            print(f"✅ BigQuery client initialized for project: {self.project_id}")
            return True
        except Exception as e:
            print(f"❌ Failed to initialize BigQuery client: {e}")
            return False
    
    def load_json_data(self, file_path: str) -> Dict[str, Any]:
        """Load JSON data from file"""
        try:
            json_path = Path(file_path)
            
            # Debug: print current working directory and backend_dir
            print(f"🔍 Current working directory: {Path.cwd()}")
            print(f"🔍 Backend directory: {backend_dir}")
            print(f"🔍 Looking for file: {file_path}")
            
            # Try multiple path resolutions
            possible_paths = [
                json_path,  # As provided
                backend_dir / file_path,  # Relative to backend
                Path.cwd() / file_path,  # Relative to current directory
                backend_dir / "data" / "subskill-paths.json",  # Direct path
                Path.cwd() / ".." / "data" / "subskill-paths.json",  # Up one level then data
                Path.cwd().parent / "data" / "subskill-paths.json",  # Parent then data
            ]
            
            for path in possible_paths:
                print(f"🔍 Trying path: {path}")
                if path.exists():
                    print(f"✅ Found file at: {path}")
                    with open(path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    print(f"✅ Loaded JSON data from: {path}")
                    return data
            
            # If we get here, file wasn't found
            print(f"❌ Searched in the following locations:")
            for path in possible_paths:
                print(f"   - {path}")
            
            raise FileNotFoundError(f"Could not find JSON file: {file_path}")
            
        except Exception as e:
            print(f"❌ Failed to load JSON data: {e}")
            raise
    
    def transform_data(self, raw_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Transform JSON data into BigQuery-friendly format"""
        try:
            subskill_paths = raw_data.get('subskill_learning_path', {})
            transformed_data = []
            
            for current_subskill, path_info in subskill_paths.items():
                record = {
                    'current_subskill': current_subskill,
                    'next_subskill': path_info.get('next_subskill'),
                    'created_at': datetime.utcnow().isoformat(),
                    'updated_at': datetime.utcnow().isoformat()
                }
                transformed_data.append(record)
            
            print(f"✅ Transformed {len(transformed_data)} subskill path records")
            return transformed_data
            
        except Exception as e:
            print(f"❌ Failed to transform data: {e}")
            raise
    
    def get_table_schema(self) -> List[bigquery.SchemaField]:
        """Define BigQuery table schema"""
        return [
            bigquery.SchemaField("current_subskill", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("next_subskill", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("created_at", "TIMESTAMP", mode="REQUIRED"),
            bigquery.SchemaField("updated_at", "TIMESTAMP", mode="REQUIRED"),
        ]
    
    def create_table_if_not_exists(self):
        """Create BigQuery table if it doesn't exist"""
        try:
            table_ref = self.client.dataset(self.dataset_id).table(self.table_id)
            
            try:
                table = self.client.get_table(table_ref)
                print(f"✅ Table {self.dataset_id}.{self.table_id} already exists")
                return table
            except NotFound:
                # Create table
                schema = self.get_table_schema()
                table = bigquery.Table(table_ref, schema=schema)
                
                table.description = "Subskill learning paths defining the sequence of skills"
                
                table = self.client.create_table(table)
                print(f"✅ Created table {self.dataset_id}.{self.table_id}")
                return table
                
        except Exception as e:
            print(f"❌ Failed to create table: {e}")
            raise
    
    def load_data_to_bigquery(self, data: List[Dict[str, Any]], replace: bool = False):
        """Load data into BigQuery table"""
        try:
            table_ref = self.client.dataset(self.dataset_id).table(self.table_id)
            
            # Configure job
            job_config = bigquery.LoadJobConfig()
            job_config.source_format = bigquery.SourceFormat.NEWLINE_DELIMITED_JSON
            job_config.autodetect = False
            job_config.schema = self.get_table_schema()
            
            if replace:
                job_config.write_disposition = bigquery.WriteDisposition.WRITE_TRUNCATE
                print("🔄 Replacing existing data...")
            else:
                job_config.write_disposition = bigquery.WriteDisposition.WRITE_APPEND
                print("➕ Appending to existing data...")
            
            # Convert data to NDJSON format
            ndjson_data = "\n".join(json.dumps(record) for record in data)
            
            # Load data
            job = self.client.load_table_from_json(
                json_rows=data,
                destination=table_ref,
                job_config=job_config
            )
            
            # Wait for job to complete
            job.result()
            
            # Get final table info
            table = self.client.get_table(table_ref)
            
            print(f"✅ Successfully loaded {len(data)} records")
            print(f"   Table now contains {table.num_rows} total rows")
            
            return True
            
        except Exception as e:
            print(f"❌ Failed to load data to BigQuery: {e}")
            raise
    
    def validate_data(self):
        """Validate loaded data"""
        try:
            query = f"""
            SELECT 
                COUNT(*) as total_records,
                COUNT(DISTINCT current_subskill) as unique_current_subskills,
                COUNT(DISTINCT next_subskill) as unique_next_subskills,
                COUNT(CASE WHEN next_subskill IS NULL THEN 1 END) as terminal_subskills
            FROM `{self.project_id}.{self.dataset_id}.{self.table_id}`
            """
            
            results = self.client.query(query).result()
            
            for row in results:
                print(f"📊 Data Validation Results:")
                print(f"   Total records: {row.total_records}")
                print(f"   Unique current subskills: {row.unique_current_subskills}")
                print(f"   Unique next subskills: {row.unique_next_subskills}")
                print(f"   Terminal subskills (no next): {row.terminal_subskills}")
            
            # Sample a few records
            sample_query = f"""
            SELECT current_subskill, next_subskill
            FROM `{self.project_id}.{self.dataset_id}.{self.table_id}`
            ORDER BY current_subskill
            LIMIT 5
            """
            
            sample_results = self.client.query(sample_query).result()
            
            print(f"\n📋 Sample Records:")
            for row in sample_results:
                print(f"   {row.current_subskill} → {row.next_subskill}")
            
            return True
            
        except Exception as e:
            print(f"❌ Data validation failed: {e}")
            return False
    
    async def run(self, json_file_path: str, replace: bool = False):
        """Main execution method"""
        try:
            print("🚀 Starting Subskill Paths Loader")
            print("-" * 50)
            
            # Setup credentials
            if not setup_credentials():
                raise Exception("❌ Credentials setup failed")
            
            # Initialize client
            if not self.initialize_client():
                raise Exception("❌ BigQuery client initialization failed")
            
            # Load JSON data
            raw_data = self.load_json_data(json_file_path)
            
            # Transform data
            transformed_data = self.transform_data(raw_data)
            
            if not transformed_data:
                print("⚠️  No data to load")
                return
            
            # Create table if needed
            self.create_table_if_not_exists()
            
            # Load data
            self.load_data_to_bigquery(transformed_data, replace=replace)
            
            # Validate data
            self.validate_data()
            
            print("\n✅ Subskill paths loading completed successfully!")
            
        except Exception as e:
            print(f"\n❌ Loading failed: {e}")
            import traceback
            traceback.print_exc()
            raise


def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Load subskill paths JSON into BigQuery')
    parser.add_argument(
        '--file', 
        default='data/subskill-paths.json',
        help='Path to JSON file (default: data/subskill-paths.json)'
    )
    parser.add_argument(
        '--replace', 
        action='store_true',
        help='Replace existing data instead of appending'
    )
    
    args = parser.parse_args()
    
    loader = SubskillPathLoader()
    asyncio.run(loader.run(args.file, args.replace))


if __name__ == "__main__":
    main()