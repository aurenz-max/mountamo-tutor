# backend/scripts/fix_bigquery_schema.py

import os
import sys
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv
from google.cloud import bigquery
from google.cloud.exceptions import NotFound

# Load environment
env_path = backend_dir / ".env"
load_dotenv(env_path)

def setup_credentials():
    """Set up Google Cloud credentials"""
    credentials_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
    
    if credentials_path and not os.path.isabs(credentials_path):
        full_credentials_path = backend_dir / credentials_path
        if full_credentials_path.exists():
            os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = str(full_credentials_path)
            return True
    return bool(credentials_path)

def fix_table_schema():
    """Fix BigQuery table schemas to match the ETL service expectations"""
    
    print("🔧 BigQuery Schema Fix Script")
    print("=" * 50)
    
    if not setup_credentials():
        print("❌ Could not setup credentials")
        return
    
    try:
        # Initialize BigQuery client
        project_id = os.getenv('GCP_PROJECT_ID', 'mountamo-tutor-h7wnta')
        dataset_id = os.getenv('BIGQUERY_DATASET_ID', 'analytics')
        
        client = bigquery.Client(project=project_id)
        
        # Define expected schemas
        schemas = {
            'attempts': [
                bigquery.SchemaField("student_id", "INTEGER", mode="REQUIRED"),
                bigquery.SchemaField("subject", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("skill_id", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("subskill_id", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("score", "FLOAT", mode="REQUIRED"),
                bigquery.SchemaField("timestamp", "TIMESTAMP", mode="REQUIRED"),
                bigquery.SchemaField("sync_timestamp", "TIMESTAMP", mode="REQUIRED"),
                bigquery.SchemaField("cosmos_id", "STRING", mode="NULLABLE"),
                bigquery.SchemaField("cosmos_ts", "INTEGER", mode="NULLABLE"),
            ],
            'reviews': [
                bigquery.SchemaField("review_id", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("student_id", "INTEGER", mode="REQUIRED"),
                bigquery.SchemaField("subject", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("skill_id", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("subskill_id", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("score", "FLOAT", mode="NULLABLE"),
                bigquery.SchemaField("timestamp", "TIMESTAMP", mode="REQUIRED"),
                bigquery.SchemaField("problem_text", "STRING", mode="NULLABLE"),
                bigquery.SchemaField("answer_text", "STRING", mode="NULLABLE"),
                bigquery.SchemaField("feedback_praise", "STRING", mode="NULLABLE"),
                bigquery.SchemaField("feedback_guidance", "STRING", mode="NULLABLE"),
                bigquery.SchemaField("sync_timestamp", "TIMESTAMP", mode="REQUIRED"),
                bigquery.SchemaField("cosmos_ts", "INTEGER", mode="NULLABLE"),
            ],
            'curriculum': [
                bigquery.SchemaField("subject", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("grade", "STRING", mode="NULLABLE"),
                bigquery.SchemaField("unit_id", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("unit_title", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("skill_id", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("skill_description", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("subskill_id", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("subskill_description", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("difficulty_start", "FLOAT", mode="NULLABLE"),
                bigquery.SchemaField("difficulty_end", "FLOAT", mode="NULLABLE"),
                bigquery.SchemaField("target_difficulty", "FLOAT", mode="NULLABLE"),
                bigquery.SchemaField("sync_timestamp", "TIMESTAMP", mode="REQUIRED"),
            ],
            'learning_paths': [
                bigquery.SchemaField("prerequisite_skill_id", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("unlocks_skill_id", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("min_score_threshold", "FLOAT", mode="REQUIRED"),
                bigquery.SchemaField("is_base_node", "BOOLEAN", mode="REQUIRED"),
                bigquery.SchemaField("sync_timestamp", "TIMESTAMP", mode="REQUIRED"),
            ]
        }
        
        for table_name, expected_schema in schemas.items():
            table_id = f"{project_id}.{dataset_id}.{table_name}"
            
            try:
                # Get existing table
                table = client.get_table(table_id)
                print(f"\n📋 Checking table: {table_name}")
                
                # Compare schemas
                existing_fields = {field.name: field for field in table.schema}
                expected_fields = {field.name: field for field in expected_schema}
                
                fields_to_add = []
                for field_name, field in expected_fields.items():
                    if field_name not in existing_fields:
                        fields_to_add.append(field)
                        print(f"  ➕ Missing field: {field_name} ({field.field_type})")
                
                if fields_to_add:
                    print(f"  🔄 Adding {len(fields_to_add)} field(s) to {table_name}")
                    
                    # Update schema
                    updated_schema = list(table.schema) + fields_to_add
                    table.schema = updated_schema
                    client.update_table(table, ["schema"])
                    
                    print(f"  ✅ Updated schema for {table_name}")
                else:
                    print(f"  ✅ Schema for {table_name} is up to date")
                
            except NotFound:
                print(f"  📝 Creating new table: {table_name}")
                
                # Create table with full schema
                table = bigquery.Table(table_id, schema=expected_schema)
                table = client.create_table(table)
                
                print(f"  ✅ Created table {table_name}")
            
            except Exception as e:
                print(f"  ❌ Error with table {table_name}: {e}")
        
        print(f"\n🎉 Schema fix completed!")
        
    except Exception as e:
        print(f"❌ Schema fix failed: {e}")
        import traceback
        traceback.print_exc()

def backup_and_recreate_table(table_name: str):
    """Backup existing table data and recreate with correct schema"""
    
    print(f"\n⚠️  Advanced Fix: Recreating table {table_name}")
    
    project_id = os.getenv('GCP_PROJECT_ID', 'mountamo-tutor-h7wnta')
    dataset_id = os.getenv('BIGQUERY_DATASET_ID', 'analytics')
    client = bigquery.Client(project=project_id)
    
    table_id = f"{project_id}.{dataset_id}.{table_name}"
    backup_table_id = f"{project_id}.{dataset_id}.{table_name}_backup_{int(time.time())}"
    
    try:
        # Check if table exists
        table = client.get_table(table_id)
        
        # Create backup
        print(f"  📦 Creating backup: {backup_table_id}")
        backup_query = f"""
        CREATE TABLE `{backup_table_id}` AS
        SELECT * FROM `{table_id}`
        """
        backup_job = client.query(backup_query)
        backup_job.result()
        
        # Drop original table
        print(f"  🗑️  Dropping original table")
        client.delete_table(table_id)
        
        # Recreate with correct schema
        print(f"  🔨 Recreating table with correct schema")
        fix_table_schema()
        
        print(f"  ✅ Table {table_name} recreated successfully")
        print(f"  💡 Backup available at: {backup_table_id}")
        
    except Exception as e:
        print(f"  ❌ Failed to recreate table: {e}")

def main():
    """Main function"""
    import argparse
    import time
    
    parser = argparse.ArgumentParser(description='Fix BigQuery table schemas')
    parser.add_argument('--recreate', type=str, help='Recreate specific table (creates backup first)')
    
    args = parser.parse_args()
    
    if args.recreate:
        backup_and_recreate_table(args.recreate)
    else:
        fix_table_schema()

if __name__ == "__main__":
    import time
    main()