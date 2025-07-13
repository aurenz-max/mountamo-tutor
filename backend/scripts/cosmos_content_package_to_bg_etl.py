# backend/scripts/content_packages_etl.py

import os
import sys
import asyncio
import logging
import json
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime

# Add the backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv
from google.cloud import bigquery

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

class ContentPackagesETL:
    """Simplified ETL for content packages data"""
    
    def __init__(self, batch_size: int = 100):
        self.batch_size = batch_size
        self.cosmos_service = None
        self.bq_client = None
        self.dataset_id = os.getenv('BIGQUERY_DATASET_ID', 'analytics')
        self.project_id = os.getenv('GOOGLE_CLOUD_PROJECT', 'mountamo-tutor-h7wnta')
        self.results = {}
        self.start_time = None
        
    async def setup(self):
        """Setup the ETL environment"""
        print("🔧 Setting up Content Packages ETL environment...")
        
        # Setup credentials
        if not setup_credentials():
            raise Exception("❌ Credentials setup failed - file not found")
        
        # Initialize BigQuery client
        self.bq_client = bigquery.Client(project=self.project_id)
        print("✅ BigQuery client initialized")
        
        # Initialize Cosmos DB service
        try:
            from app.db.cosmos_db import CosmosDBService
            self.cosmos_service = CosmosDBService()
            print("✅ Cosmos DB service initialized")
            
            # Test Cosmos connection using the container directly
            test_query = "SELECT VALUE COUNT(1) FROM c"
            
            # Use the same pattern as your working ETL - access containers directly
            if hasattr(self.cosmos_service, 'content_packages'):
                container = self.cosmos_service.content_packages
            else:
                # Fallback to manual container access
                container = self.cosmos_service.client.get_database_client(
                    self.cosmos_service.database_name or 'learning_platform'
                ).get_container_client("content_packages")
            
            count = list(container.query_items(
                query=test_query,
                enable_cross_partition_query=True
            ))[0]
            
            print(f"✅ Cosmos DB connection verified - {count:,} content packages found")
            
        except Exception as e:
            raise Exception(f"❌ Failed to initialize Cosmos DB service: {e}")
    
    def _get_content_packages_schema(self) -> List[bigquery.SchemaField]:
            """Define consistent BigQuery schema for content packages - all arrays as REPEATED STRING"""
            return [
                bigquery.SchemaField("package_id", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("subject", "STRING", mode="NULLABLE"),
                bigquery.SchemaField("unit", "STRING", mode="NULLABLE"),
                bigquery.SchemaField("skill", "STRING", mode="NULLABLE"),
                bigquery.SchemaField("subskill", "STRING", mode="NULLABLE"),
                bigquery.SchemaField("difficulty_level", "STRING", mode="NULLABLE"),
                bigquery.SchemaField("reading_level", "STRING", mode="NULLABLE"),
                # Change these to REPEATED STRING for consistency
                bigquery.SchemaField("prerequisites", "STRING", mode="REPEATED"),
                bigquery.SchemaField("real_world_applications", "STRING", mode="REPEATED"),
                bigquery.SchemaField("learning_objectives", "STRING", mode="REPEATED"),
                bigquery.SchemaField("core_concepts", "STRING", mode="REPEATED"),
                bigquery.SchemaField("key_terminology", "STRING", mode="REPEATED"),
            ]
    
    async def _ensure_table_exists(self, table_name: str, schema: List[bigquery.SchemaField]):
        """Ensure BigQuery table exists with proper schema"""
        table_id = f"{self.project_id}.{self.dataset_id}.{table_name}"
        
        try:
            # Check if table exists
            self.bq_client.get_table(table_id)
            print(f"✅ Table {table_name} already exists")
        except Exception:
            # Create table
            table = bigquery.Table(table_id, schema=schema)
            table = self.bq_client.create_table(table)
            print(f"✅ Created table {table_name}")
    
    def _extract_string_array(self, data: Any) -> List[str]:
        """Extract string array from various data formats"""
        if not data:
            return []
        
        if isinstance(data, list):
            return [str(item) for item in data]
        elif isinstance(data, dict):
            # If it's a dictionary, extract values
            return [str(value) for value in data.values()]
        elif isinstance(data, str):
            # If it's a string, try to parse as JSON
            try:
                parsed = json.loads(data)
                if isinstance(parsed, list):
                    return [str(item) for item in parsed]
                elif isinstance(parsed, dict):
                    return [str(value) for value in parsed.values()]
            except:
                pass
            return [data]
        else:
            return [str(data)]
    
    def _transform_content_package(self, package: Dict[str, Any]) -> Dict[str, Any]:
        """Transform a content package document for BigQuery with consistent array handling"""
        try:
            # Extract master context
            master_context = package.get("master_context", {})
            
            # Extract content metadata
            content = package.get("content", {})
            reading = content.get("reading", {})
            
            # Build the record with consistent array handling
            transformed = {
                "package_id": package.get("id"),
                "subject": package.get("subject"),
                "unit": package.get("unit"),
                "skill": package.get("skill"),
                "subskill": package.get("subskill"),
                "difficulty_level": master_context.get("difficulty_level"),
                "reading_level": reading.get("reading_level"),
                # Convert everything to string arrays consistently
                "prerequisites": self._extract_string_array(master_context.get("prerequisites", [])),
                "real_world_applications": self._extract_string_array(master_context.get("real_world_applications", [])),
                "learning_objectives": self._extract_string_array(master_context.get("learning_objectives", [])),
                "core_concepts": self._extract_string_array(master_context.get("core_concepts", [])),
                "key_terminology": self._extract_string_array(master_context.get("key_terminology", [])),
            }
            
            return transformed
            
        except Exception as e:
            logger.error(f"Error transforming content package {package.get('id', 'unknown')}: {e}")
            raise
    
    async def _load_to_bigquery(self, table_name: str, records: List[Dict[str, Any]], write_disposition: str = "WRITE_TRUNCATE") -> int:
        """Load records to BigQuery"""
        if not records:
            return 0
        
        table_id = f"{self.project_id}.{self.dataset_id}.{table_name}"
        
        job_config = bigquery.LoadJobConfig(
            write_disposition=write_disposition,
            source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON,
        )
        
        # Load data in batches
        total_loaded = 0
        for i in range(0, len(records), self.batch_size):
            batch = records[i:i + self.batch_size]
            
            job = self.bq_client.load_table_from_json(
                batch,
                table_id,
                job_config=job_config
            )
            
            job.result()  # Wait for job to complete
            
            if job.errors:
                raise Exception(f"BigQuery load job failed: {job.errors}")
            
            total_loaded += len(batch)
            print(f"  Loaded batch {i//self.batch_size + 1}: {len(batch)} records")
            
            # For subsequent batches, use WRITE_APPEND
            if write_disposition == "WRITE_TRUNCATE":
                job_config.write_disposition = "WRITE_APPEND"
        
        return total_loaded
    
    async def load_content_packages(self, incremental: bool = False, limit: Optional[int] = None):
        """Load content packages from Cosmos DB to BigQuery"""
        print(f"\n📚 Loading content packages {'(incremental)' if incremental else '(full load)'}...")
        
        try:
            # Ensure table exists
            await self._ensure_table_exists("content_packages", self._get_content_packages_schema())
            
            # Build query
            query = "SELECT * FROM c ORDER BY c._ts"
            
            if limit:
                query += f" OFFSET 0 LIMIT {limit}"
            
            # Query Cosmos DB
            if hasattr(self.cosmos_service, 'content_packages'):
                container = self.cosmos_service.content_packages
            else:
                # Fallback to manual container access
                container = self.cosmos_service.client.get_database_client(
                    self.cosmos_service.database_name or 'learning_platform'
                ).get_container_client("content_packages")
            
            print("  Querying Cosmos DB...")
            items = list(container.query_items(
                query=query,
                enable_cross_partition_query=True
            ))
            
            if not items:
                print("  No records found to process")
                return {"success": True, "records_processed": 0, "message": "No records to process"}
            
            print(f"  Found {len(items):,} content packages to process")
            
            # Transform data
            transformed_packages = []
            
            for i, item in enumerate(items):
                try:
                    # Transform package
                    transformed_package = self._transform_content_package(item)
                    transformed_packages.append(transformed_package)
                    
                    if (i + 1) % 100 == 0:
                        print(f"  Processed {i + 1:,} packages...")
                    
                except Exception as e:
                    logger.error(f"Error processing package {item.get('id', 'unknown')}: {e}")
                    continue
            
            print(f"  Transformed {len(transformed_packages):,} packages")
            
            # Load to BigQuery
            packages_loaded = 0
            
            if transformed_packages:
                print("  Loading packages to BigQuery...")
                packages_loaded = await self._load_to_bigquery(
                    "content_packages", 
                    transformed_packages,
                    write_disposition="WRITE_TRUNCATE" if not incremental else "WRITE_APPEND"
                )
            
            result = {
                "success": True,
                "records_processed": len(transformed_packages),
                "packages_loaded": packages_loaded,
            }
            
            print(f"✅ Content packages loaded: {packages_loaded:,} packages")
            self.results['content_packages'] = result
            return result
            
        except Exception as e:
            logger.error(f"Content packages load failed: {e}")
            result = {"success": False, "error": str(e)}
            self.results['content_packages'] = result
            return result
    
    async def validate_loaded_data(self):
        """Validate the loaded data"""
        print(f"\n🔍 Validating loaded content packages data...")
        
        try:
            # Validate main packages table
            packages_query = f"""
                SELECT 
                    COUNT(*) as total_packages,
                    COUNT(DISTINCT subject) as unique_subjects,
                    COUNT(DISTINCT unit) as unique_units,
                    COUNT(DISTINCT skill) as unique_skills,
                    COUNT(DISTINCT subskill) as unique_subskills,
                    COUNT(DISTINCT difficulty_level) as unique_difficulty_levels,
                    COUNT(DISTINCT reading_level) as unique_reading_levels,
                    SUM(CASE WHEN prerequisites IS NOT NULL THEN 1 ELSE 0 END) as packages_with_prerequisites,
                    SUM(CASE WHEN real_world_applications IS NOT NULL THEN 1 ELSE 0 END) as packages_with_applications,
                    SUM(CASE WHEN ARRAY_LENGTH(learning_objectives) > 0 THEN 1 ELSE 0 END) as packages_with_objectives,
                    SUM(CASE WHEN ARRAY_LENGTH(core_concepts) > 0 THEN 1 ELSE 0 END) as packages_with_concepts,
                    SUM(CASE WHEN ARRAY_LENGTH(key_terminology) > 0 THEN 1 ELSE 0 END) as packages_with_terminology
                FROM `{self.project_id}.{self.dataset_id}.content_packages`
            """
            
            packages_results = list(self.bq_client.query(packages_query))
            
            # Print validation results
            if packages_results:
                stats = dict(packages_results[0])
                print("Content Packages validation results:")
                print(f"  📊 Total packages: {stats.get('total_packages', 0):,}")
                print(f"  📚 Unique subjects: {stats.get('unique_subjects', 0):,}")
                print(f"  📖 Unique units: {stats.get('unique_units', 0):,}")
                print(f"  🎯 Unique skills: {stats.get('unique_skills', 0):,}")
                print(f"  🔍 Unique subskills: {stats.get('unique_subskills', 0):,}")
                print(f"  📈 Unique difficulty levels: {stats.get('unique_difficulty_levels', 0):,}")
                print(f"  📝 Unique reading levels: {stats.get('unique_reading_levels', 0):,}")
                print(f"  🔗 Packages with prerequisites: {stats.get('packages_with_prerequisites', 0):,}")
                print(f"  🌍 Packages with applications: {stats.get('packages_with_applications', 0):,}")
                print(f"  🎯 Packages with objectives: {stats.get('packages_with_objectives', 0):,}")
                print(f"  💡 Packages with concepts: {stats.get('packages_with_concepts', 0):,}")
                print(f"  📚 Packages with terminology: {stats.get('packages_with_terminology', 0):,}")
            
            validation_results = {
                "packages_stats": dict(packages_results[0]) if packages_results else {},
                "validation_timestamp": datetime.utcnow().isoformat()
            }
            
            self.results['validation'] = validation_results
            
        except Exception as e:
            print(f"❌ Data validation failed: {e}")
            self.results['validation'] = {'success': False, 'error': str(e)}
    
    def print_summary(self):
        """Print load summary"""
        end_time = datetime.now()
        duration = end_time - self.start_time
        
        print("\n" + "="*80)
        print("🎯 CONTENT PACKAGES ETL SUMMARY")
        print("="*80)
        print(f"Start Time: {self.start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"End Time: {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Duration: {duration}")
        print("-"*80)
        
        # Content packages results
        cp_result = self.results.get('content_packages', {})
        if cp_result.get('success'):
            packages = cp_result.get('packages_loaded', 0)
            print(f"✅ SUCCESS Content Packages: {packages:,} packages")
        else:
            error = cp_result.get('error', 'Unknown error')
            print(f"❌ FAILED Content Packages: {error}")
        
        # Validation results
        validation = self.results.get('validation', {})
        if validation and not validation.get('success') == False:
            print("✅ SUCCESS Data validation completed")
        else:
            print("❌ FAILED Data validation")
        
        print("="*80)
        
        # Check overall success
        if cp_result.get('success') and validation:
            print("🎉 Content packages ETL completed successfully!")
        else:
            print("🟡 Content packages ETL completed with issues")
    
    async def run_etl(self, incremental: bool = False, limit: Optional[int] = None):
        """Run the complete content packages ETL"""
        self.start_time = datetime.now()
        
        try:
            print("🚀 Starting Simplified Content Packages ETL")
            print("="*80)
            print(f"Mode: {'Incremental' if incremental else 'Full Load'}")
            print(f"Limit: {limit if limit else 'No limit'}")
            print(f"Start Time: {self.start_time.strftime('%Y-%m-%d %H:%M:%S')}")
            print("="*80)
            
            # Setup
            await self.setup()
            
            # Load content packages
            await self.load_content_packages(incremental=incremental, limit=limit)
            
            # Validate loaded data
            await self.validate_loaded_data()
            
            # Print summary
            self.print_summary()
            
        except Exception as e:
            print(f"\n❌ Content packages ETL failed: {e}")
            import traceback
            traceback.print_exc()

async def run_cosmos_preview():
    """Preview Cosmos DB content packages data"""
    print("🔍 Content Packages Data Preview")
    print("-" * 50)
    
    if not setup_credentials():
        print("❌ Credentials setup failed")
        return
    
    try:
        from app.db.cosmos_db import CosmosDBService
        
        cosmos_service = CosmosDBService()
        print("✅ Cosmos DB service initialized")
        
        # Count content packages
        count_query = "SELECT VALUE COUNT(1) FROM c"
        
        if hasattr(cosmos_service, 'content_packages'):
            container = cosmos_service.content_packages
        else:
            container = cosmos_service.client.get_database_client(
                cosmos_service.database_name or 'learning_platform'
            ).get_container_client("content_packages")
        
        packages_count = list(container.query_items(
            query=count_query,
            enable_cross_partition_query=True
        ))[0]
        
        print(f"📚 Total content packages in Cosmos DB: {packages_count:,}")
        
        # Show sample data
        if packages_count > 0:
            sample_query = "SELECT TOP 1 * FROM c"
            sample_packages = list(container.query_items(
                query=sample_query,
                enable_cross_partition_query=True
            ))
            
            if sample_packages:
                sample = sample_packages[0]
                print(f"\n📊 Sample content package details:")
                print(f"  - ID: {sample.get('id')}")
                print(f"  - Subject: {sample.get('subject')}")
                print(f"  - Unit: {sample.get('unit')}")
                print(f"  - Skill: {sample.get('skill')}")
                print(f"  - Subskill: {sample.get('subskill')}")
                
                master_context = sample.get('master_context', {})
                print(f"  - Difficulty Level: {master_context.get('difficulty_level')}")
                print(f"  - Learning Objectives: {len(master_context.get('learning_objectives', []))}")
                print(f"  - Core Concepts: {len(master_context.get('core_concepts', []))}")
                print(f"  - Key Terminology: {len(master_context.get('key_terminology', []))}")
        
    except Exception as e:
        print(f"❌ Content packages preview failed: {e}")

def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Simplified Content Packages ETL Script')
    parser.add_argument('--incremental', action='store_true', 
                       help='Run incremental load instead of full load')
    parser.add_argument('--preview', action='store_true', 
                       help='Preview Cosmos DB content packages data')
    parser.add_argument('--limit', type=int, default=None,
                       help='Limit number of records to process (for testing)')
    parser.add_argument('--batch-size', type=int, default=100,
                       help='Batch size for BigQuery loading (default: 100)')
    
    args = parser.parse_args()
    
    if args.preview:
        asyncio.run(run_cosmos_preview())
    else:
        # Run content packages ETL
        etl = ContentPackagesETL(batch_size=args.batch_size)
        asyncio.run(etl.run_etl(incremental=args.incremental, limit=args.limit))

if __name__ == "__main__":
    main()