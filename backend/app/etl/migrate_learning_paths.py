#!/usr/bin/env python3
"""
Simple script to upload your single learning_path_decision_tree.json to Azure Blob Storage
"""

import asyncio
import json
import os
from pathlib import Path
from datetime import datetime, timezone

# Load environment variables
try:
    from dotenv import load_dotenv
    backend_dir = Path(__file__).parent.parent.parent
    env_file = backend_dir / ".env"
    if env_file.exists():
        load_dotenv(env_file)
        print(f"✅ Loaded environment from: {env_file}")
except ImportError:
    print("Warning: python-dotenv not installed")

from azure.storage.blob import BlobServiceClient, ContentSettings

# Configuration
AZURE_STORAGE_CONNECTION_STRING = os.getenv('AZURE_STORAGE_CONNECTION_STRING', '')
LEARNING_PATHS_CONTAINER_NAME = os.getenv('LEARNING_PATHS_CONTAINER_NAME', 'learning-paths-data')

async def upload_learning_paths():
    """Upload the single learning paths file"""
    
    if not AZURE_STORAGE_CONNECTION_STRING:
        print("❌ AZURE_STORAGE_CONNECTION_STRING not configured!")
        return False
    
    # Path to your JSON file in backend/data directory
    # From backend/app/etl, go up to backend, then into data
    script_dir = Path(__file__).parent  # app/etl
    backend_dir = script_dir.parent.parent  # backend
    data_dir = backend_dir / "data"
    json_file = data_dir / "learning_path_decision_tree.json"
    
    print(f"Looking for file at: {json_file}")
    print(f"Data directory: {data_dir}")
    
    if not json_file.exists():
        print(f"❌ File not found: {json_file}")
        print(f"Please ensure learning_path_decision_tree.json is in: {data_dir}")
        print(f"Expected full path: {json_file.absolute()}")
        
        # List files in data directory for debugging
        if data_dir.exists():
            print(f"\nFiles in {data_dir}:")
            for file in data_dir.iterdir():
                if file.is_file():
                    print(f"  - {file.name}")
        else:
            print(f"❌ Data directory doesn't exist: {data_dir}")
        
        return False
    
    try:
        # Initialize Azure Blob Storage
        blob_service_client = BlobServiceClient.from_connection_string(AZURE_STORAGE_CONNECTION_STRING)
        container_client = blob_service_client.get_container_client(LEARNING_PATHS_CONTAINER_NAME)
        
        # Test connection
        container_client.get_container_properties()
        print(f"✅ Connected to container: {LEARNING_PATHS_CONTAINER_NAME}")
        
        # Read and validate JSON
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Get the decision tree data
        if "learning_path_decision_tree" in data:
            decision_tree = data["learning_path_decision_tree"]
        else:
            decision_tree = data
        
        skill_count = len(decision_tree)
        connection_count = sum(len(next_skills) for next_skills in decision_tree.values())
        
        print(f"📊 Decision tree stats: {skill_count} skills, {connection_count} connections")
        
        # Upload to blob storage (no subject needed)
        blob_name = "learning_paths/decision_tree.json"
        blob_client = container_client.get_blob_client(blob_name)
        
        # Prepare upload data
        upload_data = {
            "learning_path_decision_tree": decision_tree
        }
        
        json_str = json.dumps(upload_data, indent=2)
        
        # Upload
        blob_client.upload_blob(
            data=json_str.encode('utf-8'),
            overwrite=True,
            content_settings=ContentSettings(
                content_type='application/json',
                cache_control='max-age=3600'
            ),
            metadata={
                'file_type': 'learning_paths',
                'upload_timestamp': datetime.now(timezone.utc).isoformat(),
                'skill_count': str(skill_count),
                'connection_count': str(connection_count),
                'version': '1.0',
                'description': 'Cross-subject learning paths decision tree'
            }
        )
        
        # Upload metadata
        metadata = {
            "description": "Cross-subject learning paths decision tree",
            "upload_date": datetime.now(timezone.utc).isoformat(),
            "skill_count": skill_count,
            "connection_count": connection_count,
            "version": "1.0",
            "notes": "Single file containing paths across all subjects"
        }
        
        metadata_blob_name = "learning_paths/metadata.json"
        metadata_blob_client = container_client.get_blob_client(metadata_blob_name)
        
        metadata_blob_client.upload_blob(
            data=json.dumps(metadata, indent=2).encode('utf-8'),
            overwrite=True,
            content_settings=ContentSettings(content_type='application/json')
        )
        
        print(f"✅ Successfully uploaded:")
        print(f"   - Decision tree: {blob_name}")
        print(f"   - Metadata: {metadata_blob_name}")
        print(f"   - Skills: {skill_count}")
        print(f"   - Connections: {connection_count}")
        print(f"   - Blob URL: {blob_client.url}")
        
        return True
        
    except Exception as e:
        print(f"❌ Upload failed: {str(e)}")
        return False

if __name__ == "__main__":
    success = asyncio.run(upload_learning_paths())
    if success:
        print("\n🎉 Upload completed successfully!")
    else:
        print("\n❌ Upload failed!")