# backend/tests/test_auth.py

import os
import sys
from pathlib import Path

# Add the backend directory to Python path so we can import from app
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv
from google.cloud import bigquery

# Load environment from backend/.env (go up one directory from tests/)
env_path = backend_dir / ".env"
load_dotenv(env_path)

def test_auth():
    try:
        # Show current working directory and paths for debugging
        print(f"Current working directory: {os.getcwd()}")
        print(f"Backend directory: {backend_dir}")
        print(f"Environment file path: {env_path}")
        print(f"Environment file exists: {env_path.exists()}")
        print("-" * 50)
        
        # Check environment variables
        credentials_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
        project_id = os.getenv('GCP_PROJECT_ID')
        
        print(f"Credentials path from env: {credentials_path}")
        print(f"Project ID from env: {project_id}")
        
        # Check if credentials file exists
        if credentials_path:
            # Handle both relative and absolute paths
            if not os.path.isabs(credentials_path):
                # If relative, make it relative to backend directory
                full_credentials_path = backend_dir / credentials_path
            else:
                full_credentials_path = Path(credentials_path)
            
            print(f"Full credentials path: {full_credentials_path}")
            print(f"Credentials file exists: {full_credentials_path.exists()}")
            
            # Set the absolute path for Google Cloud client
            os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = str(full_credentials_path)
        
        print("-" * 50)
        
        # Test BigQuery connection
        print("Testing BigQuery connection...")
        client = bigquery.Client(project=project_id or 'mountamo-tutor-h7wnta')
        
        # Test query
        query = "SELECT 1 as test_value, 'Hello BigQuery!' as message"
        print(f"Executing query: {query}")
        
        job = client.query(query)
        results = job.result()
        
        print("✅ Query executed successfully!")
        
        for row in results:
            print(f"✅ Authentication works! Test value: {row.test_value}")
            print(f"✅ Message: {row.message}")
            
        # Test dataset access
        print("-" * 50)
        print("Testing dataset access...")
        
        dataset_id = f"{project_id or 'mountamo-tutor-h7wnta'}.analytics"
        
        try:
            dataset = client.get_dataset(dataset_id)
            print(f"✅ Dataset '{dataset_id}' found!")
            print(f"   Created: {dataset.created}")
            print(f"   Location: {dataset.location}")
            
            # List tables in the dataset
            tables = list(client.list_tables(dataset))
            print(f"   Tables: {len(tables)}")
            for table in tables:
                print(f"     - {table.table_id}")
                
        except Exception as dataset_error:
            print(f"⚠️  Dataset access issue: {dataset_error}")
            
        print("\n🎉 BigQuery authentication and access test completed successfully!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        print(f"Error type: {type(e).__name__}")
        
        # Additional debugging info
        print("\n🔍 Debugging information:")
        print(f"   Python path: {sys.path[:3]}...")  # Show first 3 paths
        print(f"   Environment variables:")
        print(f"     GOOGLE_APPLICATION_CREDENTIALS: {os.getenv('GOOGLE_APPLICATION_CREDENTIALS')}")
        print(f"     GCP_PROJECT_ID: {os.getenv('GCP_PROJECT_ID')}")
        
        import traceback
        print(f"\n📋 Full traceback:")
        traceback.print_exc()

def test_config_import():
    """Test importing the config to make sure paths work"""
    try:
        print("Testing config import...")
        from app.core.config import settings
        
        print(f"✅ Config imported successfully!")
        print(f"   Project ID: {settings.GCP_PROJECT_ID}")
        print(f"   Dataset ID: {settings.BIGQUERY_DATASET_ID}")
        print(f"   Credentials: {settings.GOOGLE_APPLICATION_CREDENTIALS}")
        
    except Exception as e:
        print(f"❌ Config import failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("🧪 Starting BigQuery Authentication Test")
    print("=" * 60)
    
    # Test config import first
    test_config_import()
    print("\n" + "=" * 60)
    
    # Test authentication
    test_auth()