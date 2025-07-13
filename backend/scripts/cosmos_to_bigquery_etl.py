# backend/scripts/full_etl_load.py

import os
import sys
import asyncio
import logging
from pathlib import Path
from typing import Dict, Any
from datetime import datetime

# Add the backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv

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

class FullETLLoader:
    """Full ETL data loader for production use"""
    
    def __init__(self, batch_size: int = 1000):
        self.etl_service = None
        self.batch_size = batch_size
        self.results = {}
        self.start_time = None
        
    async def setup(self):
        """Setup the ETL environment"""
        print("🔧 Setting up ETL environment...")
        
        # Setup credentials
        if not setup_credentials():
            raise Exception("❌ Credentials setup failed - file not found")
        
        # Import and initialize services
        try:
            from app.services.bigquery_etl import BigQueryETLService
            self.etl_service = BigQueryETLService()
            print("✅ ETL service initialized")
            
            # Test connections first
            connection_results = await self.etl_service.test_connections()
            
            if not connection_results.get("bigquery", False):
                raise Exception("❌ BigQuery connection failed")
            
            if not connection_results.get("cosmos_db", False):
                raise Exception("❌ Cosmos DB connection failed")
            
            print("✅ All connections verified")
            
        except Exception as e:
            raise Exception(f"❌ Failed to initialize ETL service: {e}")
    
    async def ensure_tables_exist(self):
        """Ensure all required BigQuery tables exist"""
        print("\n🏗️  Ensuring BigQuery tables exist...")
        
        tables_to_create = [
            ("attempts", self.etl_service._get_attempts_schema()),
            ("reviews", self.etl_service._get_reviews_schema()),
            ("curriculum", self.etl_service._get_curriculum_schema()),
            ("learning_paths", self.etl_service._get_learning_paths_schema())
        ]
        
        for table_name, schema in tables_to_create:
            try:
                await self.etl_service._ensure_table_exists(table_name, schema)
                print(f"✅ {table_name.title()} table ready")
            except Exception as e:
                print(f"❌ Failed to create {table_name} table: {e}")
                raise
    
    async def load_attempts_data(self, incremental: bool = False):
        """Load all attempts data from Cosmos DB to BigQuery"""
        print(f"\n📊 Loading attempts data {'(incremental)' if incremental else '(full load)'}...")
        
        try:
            # Remove the limit to load all data
            result = await self.etl_service.sync_attempts_from_cosmos(
                incremental=incremental,
                limit=None  # Load all data
            )
            
            records_processed = result.get('records_processed', 0)
            success = result.get('success', False)
            
            if success:
                print(f"✅ Attempts data loaded: {records_processed:,} records")
                self.results['attempts'] = result
            else:
                error_msg = result.get('error', 'Unknown error')
                print(f"❌ Attempts data load failed: {error_msg}")
                self.results['attempts'] = result
                
        except Exception as e:
            print(f"❌ Attempts data load failed: {e}")
            self.results['attempts'] = {'success': False, 'error': str(e)}
    
    async def load_reviews_data(self, incremental: bool = False):
        """Load all reviews data from Cosmos DB to BigQuery"""
        print(f"\n📝 Loading reviews data {'(incremental)' if incremental else '(full load)'}...")
        
        try:
            # Remove the limit to load all data
            result = await self.etl_service.sync_reviews_from_cosmos(
                incremental=incremental,
                limit=None  # Load all data
            )
            
            records_processed = result.get('records_processed', 0)
            success = result.get('success', False)
            
            if success:
                print(f"✅ Reviews data loaded: {records_processed:,} records")
                self.results['reviews'] = result
            else:
                error_msg = result.get('error', 'Unknown error')
                print(f"❌ Reviews data load failed: {error_msg}")
                self.results['reviews'] = result
                
        except Exception as e:
            print(f"❌ Reviews data load failed: {e}")
            self.results['reviews'] = {'success': False, 'error': str(e)}
    
    async def load_curriculum_data(self):
        """Load curriculum data from blob storage"""
        print(f"\n📚 Loading curriculum data...")
        
        try:
            if not self.etl_service.curriculum_service:
                print("⚠️  Curriculum service not configured - skipping")
                self.results['curriculum'] = {'skipped': True, 'reason': 'Service not configured'}
                return
            
            result = await self.etl_service.sync_curriculum_from_blob()
            
            records_processed = result.get('records_processed', 0)
            success = result.get('success', False)
            
            if success:
                print(f"✅ Curriculum data loaded: {records_processed:,} records")
                self.results['curriculum'] = result
            else:
                error_msg = result.get('error', 'Unknown error')
                print(f"❌ Curriculum data load failed: {error_msg}")
                self.results['curriculum'] = result
                
        except Exception as e:
            print(f"❌ Curriculum data load failed: {e}")
            self.results['curriculum'] = {'success': False, 'error': str(e)}
    
    async def load_learning_paths_data(self):
        """Load learning paths data from blob storage"""
        print(f"\n🛤️  Loading learning paths data...")
        
        try:
            if not self.etl_service.learning_paths_service:
                print("⚠️  Learning paths service not configured - skipping")
                self.results['learning_paths'] = {'skipped': True, 'reason': 'Service not configured'}
                return
            
            result = await self.etl_service.sync_learning_paths_from_blob()
            
            records_processed = result.get('records_processed', 0)
            success = result.get('success', False)
            
            if success:
                print(f"✅ Learning paths data loaded: {records_processed:,} records")
                self.results['learning_paths'] = result
            else:
                error_msg = result.get('error', 'Unknown error')
                print(f"❌ Learning paths data load failed: {error_msg}")
                self.results['learning_paths'] = result
                
        except Exception as e:
            print(f"❌ Learning paths data load failed: {e}")
            self.results['learning_paths'] = {'success': False, 'error': str(e)}
    
    async def validate_loaded_data(self):
        """Validate the loaded data"""
        print(f"\n🔍 Validating loaded data...")
        
        try:
            validation_results = await self.etl_service.validate_data_integrity()
            
            print("Data validation results:")
            for table, stats in validation_results.items():
                if table in ["validation_timestamp", "overall_status", "quality_issues"]:
                    continue
                
                if isinstance(stats, dict) and "error" not in stats:
                    record_count = stats.get('total_attempts' if 'attempts' in table else f'total_{table.split("_")[0]}_items', 0)
                    print(f"  📊 {table.title()}: {record_count:,} records")
                else:
                    print(f"  ⚠️  {table.title()}: {stats.get('error', 'No data')}")
            
            if validation_results.get("quality_issues"):
                print(f"\n⚠️  Quality Issues Found:")
                for issue in validation_results["quality_issues"]:
                    print(f"   - {issue}")
            else:
                print("✅ No data quality issues found")
            
            self.results['validation'] = validation_results
            
        except Exception as e:
            print(f"❌ Data validation failed: {e}")
            self.results['validation'] = {'success': False, 'error': str(e)}
    
    async def get_final_status(self):
        """Get final sync status"""
        print(f"\n📊 Getting final data status...")
        
        try:
            status_results = await self.etl_service.get_sync_status()
            
            print("Final data status:")
            for table, status in status_results.get("tables", {}).items():
                if status.get("exists"):
                    row_count = status.get('row_count', 0)
                    table_size = status.get('table_size_mb', 0)
                    print(f"  📊 {table.title()}: {row_count:,} rows, {table_size:.2f} MB")
                else:
                    print(f"  ❌ {table.title()}: {status.get('error', 'Unknown error')}")
            
            self.results['final_status'] = status_results
            
        except Exception as e:
            print(f"❌ Final status check failed: {e}")
            self.results['final_status'] = {'success': False, 'error': str(e)}
    
    def print_summary(self):
        """Print load summary"""
        end_time = datetime.now()
        duration = end_time - self.start_time
        
        print("\n" + "="*80)
        print("🎯 ETL FULL DATA LOAD SUMMARY")
        print("="*80)
        print(f"Start Time: {self.start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"End Time: {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Duration: {duration}")
        print("-"*80)
        
        total_records = 0
        
        for component, result in self.results.items():
            if component in ['validation', 'final_status']:
                continue
                
            if isinstance(result, dict):
                records_processed = result.get('records_processed', 0)
                success = result.get('success', False)
                skipped = result.get('skipped', False)
                
                if skipped:
                    status = "⚠️  SKIPPED"
                    reason = result.get('reason', 'Unknown reason')
                    print(f"{status} {component.title()}: {reason}")
                elif success:
                    status = "✅ SUCCESS"
                    total_records += records_processed
                    print(f"{status} {component.title()}: {records_processed:,} records")
                else:
                    status = "❌ FAILED"
                    error = result.get('error', 'Unknown error')
                    print(f"{status} {component.title()}: {error}")
        
        print("-"*80)
        print(f"Total Records Loaded: {total_records:,}")
        
        # Check overall success
        successful_loads = sum(1 for result in self.results.values() 
                             if isinstance(result, dict) and 
                             (result.get('success', False) or result.get('skipped', False)))
        
        total_loads = len([r for r in self.results.values() 
                          if isinstance(r, dict) and 
                          r.get('success') is not None])
        
        if successful_loads == total_loads:
            print("🎉 Full data load completed successfully!")
        else:
            print(f"🟡 Partial success: {successful_loads}/{total_loads} components loaded")
        
        print("="*80)
    
    async def run_full_load(self, incremental: bool = False):
        """Run the complete full data load"""
        self.start_time = datetime.now()
        
        try:
            print("🚀 Starting Full ETL Data Load")
            print("="*80)
            print(f"Mode: {'Incremental' if incremental else 'Full Load'}")
            print(f"Start Time: {self.start_time.strftime('%Y-%m-%d %H:%M:%S')}")
            print("="*80)
            
            # Setup
            await self.setup()
            
            # Ensure tables exist
            await self.ensure_tables_exist()
            
            # Load all data sources
            await self.load_attempts_data(incremental=incremental)
            await self.load_reviews_data(incremental=incremental)
            await self.load_curriculum_data()
            await self.load_learning_paths_data()
            
            # Validate loaded data
            await self.validate_loaded_data()
            
            # Get final status
            await self.get_final_status()
            
            # Print summary
            self.print_summary()
            
        except Exception as e:
            print(f"\n❌ Full load failed: {e}")
            import traceback
            traceback.print_exc()


async def run_cosmos_preview():
    """Preview Cosmos DB data before loading"""
    print("🔍 Cosmos DB Data Preview")
    print("-" * 50)
    
    if not setup_credentials():
        print("❌ Credentials setup failed")
        return
    
    try:
        from app.db.cosmos_db import CosmosDBService
        
        cosmos_service = CosmosDBService()
        print("✅ Cosmos DB service initialized")
        
        # Count attempts
        attempts_count_query = "SELECT VALUE COUNT(1) FROM c"
        attempts_count = list(cosmos_service.attempts.query_items(
            query=attempts_count_query,
            enable_cross_partition_query=True
        ))[0]
        
        print(f"📊 Total attempts in Cosmos DB: {attempts_count:,}")
        
        # Count reviews
        try:
            reviews_count = list(cosmos_service.reviews.query_items(
                query=attempts_count_query,
                enable_cross_partition_query=True
            ))[0]
            print(f"📝 Total reviews in Cosmos DB: {reviews_count:,}")
        except Exception as e:
            print(f"⚠️  Could not count reviews: {e}")
        
        # Show sample data
        sample_query = "SELECT TOP 3 * FROM c"
        sample_attempts = list(cosmos_service.attempts.query_items(
            query=sample_query,
            enable_cross_partition_query=True
        ))
        
        if sample_attempts:
            print(f"\n📋 Sample attempt fields:")
            for field in sorted(sample_attempts[0].keys()):
                print(f"  - {field}")
        
    except Exception as e:
        print(f"❌ Cosmos preview failed: {e}")


def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Full ETL Data Load Script')
    parser.add_argument('--incremental', action='store_true', 
                       help='Run incremental load instead of full load')
    parser.add_argument('--preview', action='store_true', 
                       help='Preview Cosmos DB data before loading')
    parser.add_argument('--batch-size', type=int, default=1000,
                       help='Batch size for data processing (default: 1000)')
    
    args = parser.parse_args()
    
    if args.preview:
        asyncio.run(run_cosmos_preview())
    else:
        # Run full data load
        loader = FullETLLoader(batch_size=args.batch_size)
        asyncio.run(loader.run_full_load(incremental=args.incremental))


if __name__ == "__main__":
    main()