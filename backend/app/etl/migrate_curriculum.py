# backend/app/etl/migrate_curriculum_standalone.py

"""
Standalone Curriculum Migration Script
Can be run directly from the ETL directory without module import issues

Usage:
cd "c:/Users/xbox3/claude web tutor/backend/app/etl"
python migrate_curriculum_standalone.py
"""

import asyncio
import logging
import sys
import os
import argparse
import pandas as pd
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime, timezone
from io import BytesIO

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    
    # Find the backend directory (go up from etl -> app -> backend)
    backend_dir = Path(__file__).parent.parent.parent
    env_file = backend_dir / ".env"
    
    if env_file.exists():
        load_dotenv(env_file)
        print(f"✅ Loaded environment variables from: {env_file}")
    else:
        print(f"⚠️  No .env file found at: {env_file}")
        print("You can still set environment variables manually")
        
except ImportError:
    print("Warning: python-dotenv not installed. Install with: pip install python-dotenv")
    print("You can still set environment variables manually")

# Azure imports
try:
    from azure.storage.blob import BlobServiceClient, BlobClient, ContainerClient, ContentSettings
    from azure.core.exceptions import ResourceNotFoundError, ResourceExistsError
except ImportError:
    print("Error: Azure Storage Blob library not installed")
    print("Install with: pip install azure-storage-blob")
    sys.exit(1)

# Configuration (loaded from .env file or environment variables)
AZURE_STORAGE_CONNECTION_STRING = os.getenv('AZURE_STORAGE_CONNECTION_STRING', '')
CURRICULUM_CONTAINER_NAME = os.getenv('CURRICULUM_CONTAINER_NAME', 'curriculum-data')

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class StandaloneCurriculumMigration:
    """Standalone curriculum migration that doesn't depend on app modules"""
    
    def __init__(self, data_dir: str = None):
        self.data_dir = Path(data_dir) if data_dir else self._get_default_data_dir()
        self.blob_service_client = None
        self.container_client = None
        self.uploaded_files = []
        self.errors = []
        
        # Validate configuration
        if not AZURE_STORAGE_CONNECTION_STRING:
            print("\n❌ AZURE_STORAGE_CONNECTION_STRING is not configured!")
            print("Please check your backend/.env file and ensure it contains:")
            print("AZURE_STORAGE_CONNECTION_STRING=your_connection_string_here")
            print("\nAlternatively, you can set it as an environment variable:")
            print("set AZURE_STORAGE_CONNECTION_STRING=your_connection_string_here")
            raise ValueError("AZURE_STORAGE_CONNECTION_STRING environment variable is required")
    
    def _get_default_data_dir(self) -> Path:
        """Get the default data directory relative to this ETL script"""
        # From backend/app/etl/migrate_curriculum.py, go to backend/data
        return Path(__file__).parent.parent.parent / "data"
    
    async def initialize_blob_storage(self):
        """Initialize Azure Blob Storage connection"""
        try:
            logger.info("Initializing Azure Blob Storage connection...")
            logger.info(f"Container: {CURRICULUM_CONTAINER_NAME}")
            
            # Create blob service client
            self.blob_service_client = BlobServiceClient.from_connection_string(
                AZURE_STORAGE_CONNECTION_STRING
            )
            
            # Get container client
            self.container_client = self.blob_service_client.get_container_client(
                container=CURRICULUM_CONTAINER_NAME
            )
            
            # Test connection by checking if container exists
            try:
                container_properties = self.container_client.get_container_properties()
                logger.info(f"Connected to container '{CURRICULUM_CONTAINER_NAME}'")
                logger.info(f"Container created: {container_properties.last_modified}")
            except ResourceNotFoundError:
                logger.error(f"Container '{CURRICULUM_CONTAINER_NAME}' not found")
                logger.error("Please create the container in Azure Portal first")
                return False
            
            logger.info("Blob Storage initialization completed successfully")
            return True
            
        except Exception as e:
            logger.error(f"Blob Storage initialization failed: {str(e)}")
            return False
    
    def get_curriculum_blob_path(self, subject: str, file_type: str) -> str:
        """Generate blob path for curriculum files"""
        return f"curriculum/{subject.lower()}/{file_type}.csv"
    
    def extract_subject_from_filename(self, filename: str) -> str:
        """Extract subject name from filename"""
        filename_lower = filename.lower()
        
        # Common subject mappings
        subject_mappings = {
            'math': 'Mathematics',
            'mathematics': 'Mathematics',
            'science': 'Science',
            'english': 'English',
            'ela': 'English',
            'reading': 'Reading',
            'history': 'History',
            'social': 'Social Studies'
        }
        
        # Check for known subjects in filename
        for key, subject in subject_mappings.items():
            if key in filename_lower:
                return subject
        
        # Try to extract subject from the first part of filename
        parts = filename.split('_')
        if len(parts) > 0:
            first_part = parts[0].lower()
            return subject_mappings.get(first_part, first_part.title())
        
        return "Unknown"
    
    def determine_file_type(self, filename: str) -> str:
        """Determine file type from filename"""
        filename_lower = filename.lower()
        
        if 'objective' in filename_lower:
            return 'detailed_objectives'
        elif 'syllabus' in filename_lower:
            return 'syllabus'
        else:
            # Default to syllabus for curriculum files
            return 'syllabus'
    
    def validate_csv_structure(self, df: pd.DataFrame, file_type: str) -> Dict[str, Any]:
        """Validate CSV structure based on file type"""
        if file_type == "syllabus":
            required_columns = [
                'Subject', 'UnitID', 'UnitTitle', 'SkillID', 
                'SkillDescription', 'SubskillID', 'SubskillDescription',
                'DifficultyStart', 'DifficultyEnd', 'TargetDifficulty'
            ]
        elif file_type == "detailed_objectives":
            required_columns = [
                'Subject', 'SubskillID', 'SubskillDescription', 
                'ConceptGroup', 'DetailedObjective'
            ]
        else:
            return {"valid": False, "error": f"Unknown file type: {file_type}"}
        
        missing_columns = set(required_columns) - set(df.columns)
        if missing_columns:
            return {
                "valid": False,
                "error": f"Missing required columns: {missing_columns}",
                "required_columns": required_columns,
                "found_columns": list(df.columns)
            }
        
        return {"valid": True, "row_count": len(df)}
    
    async def upload_curriculum_csv(self, subject: str, csv_content: bytes, file_type: str) -> Dict[str, Any]:
        """Upload curriculum CSV to blob storage"""
        try:
            # Validate CSV structure first
            df = pd.read_csv(BytesIO(csv_content))
            validation = self.validate_csv_structure(df, file_type)
            
            if not validation["valid"]:
                return {
                    "success": False,
                    "error": validation["error"],
                    "blob_name": None
                }
            
            blob_name = self.get_curriculum_blob_path(subject, file_type)
            blob_client = self.container_client.get_blob_client(blob_name)
            
            # Upload with metadata
            blob_client.upload_blob(
                data=csv_content,
                overwrite=True,
                content_settings=ContentSettings(
                    content_type='text/csv',
                    cache_control='max-age=3600'
                ),
                metadata={
                    'subject': subject,
                    'file_type': file_type,
                    'upload_timestamp': datetime.now(timezone.utc).isoformat(),
                    'row_count': str(len(df)),
                    'version': '1.0'
                }
            )
            
            logger.info(f"Uploaded {file_type} curriculum for {subject}: {blob_name}")
            
            return {
                "success": True,
                "blob_name": blob_name,
                "blob_url": blob_client.url,
                "row_count": len(df),
                "subject": subject,
                "file_type": file_type
            }
            
        except Exception as e:
            logger.error(f"Failed to upload curriculum CSV: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "blob_name": None
            }
    
    async def find_curriculum_files(self) -> List[Path]:
        """Find all curriculum CSV files in the data directory"""
        if not self.data_dir.exists():
            raise FileNotFoundError(f"Data directory not found: {self.data_dir}")
        
        curriculum_files = []
        
        # Look for various curriculum file patterns
        patterns = [
            "*syllabus*.csv",
            "*curriculum*.csv", 
            "*objective*.csv",
            "detailed_objectives_*.csv"
        ]
        
        for pattern in patterns:
            files = list(self.data_dir.glob(pattern))
            curriculum_files.extend(files)
        
        # Remove duplicates
        curriculum_files = list(set(curriculum_files))
        
        logger.info(f"Found {len(curriculum_files)} curriculum files:")
        for file_path in curriculum_files:
            logger.info(f"  - {file_path.name}")
        
        return curriculum_files
    
    async def migrate_file(self, file_path: Path) -> Dict[str, Any]:
        """Migrate a single curriculum file"""
        try:
            logger.info(f"Processing file: {file_path}")
            
            # Extract metadata from filename
            subject = self.extract_subject_from_filename(file_path.stem)
            file_type = self.determine_file_type(file_path.stem)
            
            logger.info(f"  - Subject: {subject}")
            logger.info(f"  - File type: {file_type}")
            
            # Read file content
            with open(file_path, 'rb') as f:
                content = f.read()
            
            # Upload to blob storage
            result = await self.upload_curriculum_csv(
                subject=subject,
                csv_content=content,
                file_type=file_type
            )
            
            if result["success"]:
                migration_result = {
                    "local_file": str(file_path),
                    "subject": subject,
                    "file_type": file_type,
                    "blob_name": result["blob_name"],
                    "row_count": result["row_count"],
                    "status": "success"
                }
                self.uploaded_files.append(migration_result)
                logger.info(f"✅ Successfully uploaded: {file_path.name} -> {result['blob_name']}")
                return migration_result
            else:
                error_msg = f"Failed to upload {file_path}: {result['error']}"
                self.errors.append(error_msg)
                logger.error(f"❌ {error_msg}")
                return {
                    "local_file": str(file_path),
                    "subject": subject,
                    "file_type": file_type,
                    "status": "failed",
                    "error": result["error"]
                }
                
        except Exception as e:
            error_msg = f"Error processing {file_path}: {str(e)}"
            self.errors.append(error_msg)
            logger.error(f"❌ {error_msg}")
            return {
                "local_file": str(file_path),
                "status": "failed",
                "error": str(e)
            }
    
    async def migrate_all_files(self) -> Dict[str, Any]:
        """Migrate all curriculum files"""
        logger.info("Starting curriculum migration...")
        logger.info(f"Data directory: {self.data_dir}")
        
        # Find all curriculum files
        curriculum_files = await self.find_curriculum_files()
        
        if not curriculum_files:
            logger.warning("No curriculum files found to migrate")
            return {
                "uploaded_files": [],
                "errors": [],
                "success_count": 0,
                "error_count": 0
            }
        
        # Migrate each file
        for file_path in curriculum_files:
            await self.migrate_file(file_path)
        
        # Print summary
        self._print_migration_summary()
        
        return {
            "uploaded_files": self.uploaded_files,
            "errors": self.errors,
            "success_count": len(self.uploaded_files),
            "error_count": len(self.errors)
        }
    
    def _print_migration_summary(self):
        """Print migration summary"""
        logger.info(f"\n📊 Migration Summary:")
        logger.info(f"✅ Successfully uploaded: {len(self.uploaded_files)} files")
        logger.info(f"❌ Errors: {len(self.errors)} files")
        
        if self.uploaded_files:
            logger.info(f"\n📁 Uploaded files:")
            for file_info in self.uploaded_files:
                logger.info(f"  - {Path(file_info['local_file']).name} -> {file_info['blob_name']} ({file_info['row_count']} rows)")
        
        if self.errors:
            logger.info(f"\n❌ Errors:")
            for error in self.errors:
                logger.info(f"  - {error}")
    
    async def list_curriculum_files(self) -> Dict[str, Any]:
        """List all curriculum files in blob storage"""
        try:
            files = []
            for blob in self.container_client.list_blobs(name_starts_with="curriculum/"):
                try:
                    blob_client = self.container_client.get_blob_client(blob.name)
                    properties = blob_client.get_blob_properties()
                    
                    files.append({
                        "name": blob.name,
                        "size": blob.size,
                        "last_modified": blob.last_modified.isoformat() if blob.last_modified else None,
                        "subject": properties.metadata.get("subject", "unknown"),
                        "file_type": properties.metadata.get("file_type", "unknown"),
                        "row_count": properties.metadata.get("row_count", "unknown"),
                        "url": blob_client.url
                    })
                except Exception as e:
                    logger.warning(f"Could not get properties for {blob.name}: {e}")
            
            return {
                "success": True,
                "files": files,
                "total_count": len(files)
            }
            
        except Exception as e:
            logger.error(f"Failed to list curriculum files: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "files": []
            }
    
    async def verify_migration(self) -> Dict[str, Any]:
        """Verify that the migration was successful"""
        logger.info("Verifying migration...")
        
        # List all curriculum files in blob storage
        files_result = await self.list_curriculum_files()
        
        if files_result["success"]:
            logger.info(f"✅ Found {files_result['total_count']} curriculum files in blob storage:")
            for file_info in files_result["files"]:
                logger.info(f"  - {file_info['name']} ({file_info['subject']}, {file_info['file_type']}, {file_info['row_count']} rows)")
        else:
            logger.error(f"❌ Failed to list curriculum files: {files_result['error']}")
            return {"success": False, "error": files_result["error"]}
        
        return {
            "success": True,
            "blob_files": files_result
        }

async def main():
    """Main function to run the migration"""
    parser = argparse.ArgumentParser(description='Migrate curriculum data to Azure Blob Storage')
    parser.add_argument('--data-dir', type=str, help='Path to data directory containing CSV files')
    parser.add_argument('--verify-only', action='store_true', help='Only verify existing migration, do not migrate new files')
    
    args = parser.parse_args()
    
    try:
        # Print current environment info
        logger.info(f"Current working directory: {Path.cwd()}")
        logger.info(f"Script location: {Path(__file__).parent}")
        logger.info(f"Azure connection string configured: {'Yes' if AZURE_STORAGE_CONNECTION_STRING else 'No'}")
        logger.info(f"Target container: {CURRICULUM_CONTAINER_NAME}")
        
        # Initialize migration
        migration = StandaloneCurriculumMigration(data_dir=args.data_dir)
        
        # Initialize blob storage
        blob_initialized = await migration.initialize_blob_storage()
        if not blob_initialized:
            logger.error("Failed to initialize blob storage")
            sys.exit(1)
        
        if args.verify_only:
            # Only verify existing migration
            logger.info("Running verification only...")
            result = await migration.verify_migration()
            if result["success"]:
                logger.info("✅ Verification completed successfully")
            else:
                logger.error(f"❌ Verification failed: {result.get('error', 'Unknown error')}")
                sys.exit(1)
        else:
            # Run full migration
            result = await migration.migrate_all_files()
            
            # Verify the migration
            logger.info("\nRunning verification...")
            verification_result = await migration.verify_migration()
            
            if result["error_count"] == 0 and verification_result["success"]:
                logger.info("🎉 Migration completed successfully!")
                sys.exit(0)
            else:
                logger.error("❌ Migration completed with errors")
                sys.exit(1)
                
    except Exception as e:
        logger.error(f"❌ Migration failed: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())