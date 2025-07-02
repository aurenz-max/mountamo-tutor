# backend/tests/test_etl_enhanced.py

import os
import sys
import asyncio
import logging
from pathlib import Path
from typing import Dict, Any

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

class ETLTestSuite:
    """Comprehensive ETL test suite"""
    
    def __init__(self):
        self.etl_service = None
        self.results = {}
        
    async def setup(self):
        """Setup test environment"""
        print("🔧 Setting up test environment...")
        
        # Setup credentials
        if not setup_credentials():
            raise Exception("❌ Credentials setup failed - file not found")
        
        # Import and initialize services
        try:
            from app.services.bigquery_etl import BigQueryETLService
            self.etl_service = BigQueryETLService()
            print("✅ ETL service initialized")
        except Exception as e:
            raise Exception(f"❌ Failed to initialize ETL service: {e}")
    
    async def test_connections(self) -> Dict[str, Any]:
        """Test all data source connections"""
        print("\n📡 Testing Data Source Connections")
        print("-" * 50)
        
        connection_results = await self.etl_service.test_connections()
        
        for service, status in connection_results.items():
            if service == "errors":
                continue
            emoji = "✅" if status else "❌"
            print(f"{emoji} {service.replace('_', ' ').title()}: {'Connected' if status else 'Failed'}")
        
        if connection_results.get("errors"):
            print("\n🚨 Connection Errors:")
            for error in connection_results["errors"]:
                print(f"   - {error}")
        
        self.results["connections"] = connection_results
        return connection_results
    
    async def test_table_creation(self):
        """Test BigQuery table creation"""
        print("\n🏗️  Testing Table Creation")
        print("-" * 50)
        
        try:
            # Test creating tables
            await self.etl_service._ensure_table_exists(
                "attempts", 
                self.etl_service._get_attempts_schema()
            )
            print("✅ Attempts table created/verified")
            
            await self.etl_service._ensure_table_exists(
                "reviews", 
                self.etl_service._get_reviews_schema()
            )
            print("✅ Reviews table created/verified")
            
            await self.etl_service._ensure_table_exists(
                "curriculum", 
                self.etl_service._get_curriculum_schema()
            )
            print("✅ Curriculum table created/verified")
            
            await self.etl_service._ensure_table_exists(
                "learning_paths", 
                self.etl_service._get_learning_paths_schema()
            )
            print("✅ Learning paths table created/verified")
            
            self.results["table_creation"] = {"success": True}
            
        except Exception as e:
            print(f"❌ Table creation failed: {e}")
            self.results["table_creation"] = {"success": False, "error": str(e)}
    
    async def test_small_data_sync(self):
        """Test syncing a small amount of data"""
        print("\n🔄 Testing Small Data Sync")
        print("-" * 50)
        
        try:
            # Test attempts sync with limit
            attempts_result = await self.etl_service.sync_attempts_from_cosmos(
                incremental=False, 
                limit=5
            )
            print(f"✅ Attempts sync: {attempts_result.get('records_processed', 0)} records")
            
            # Test reviews sync with limit
            reviews_result = await self.etl_service.sync_reviews_from_cosmos(
                incremental=False, 
                limit=5
            )
            print(f"✅ Reviews sync: {reviews_result.get('records_processed', 0)} records")
            
            self.results["small_sync"] = {
                "attempts": attempts_result,
                "reviews": reviews_result
            }
            
        except Exception as e:
            print(f"❌ Small data sync failed: {e}")
            self.results["small_sync"] = {"error": str(e)}
    
    async def test_data_validation(self):
        """Test data validation after sync"""
        print("\n🔍 Testing Data Validation")
        print("-" * 50)
        
        try:
            validation_results = await self.etl_service.validate_data_integrity()
            
            for table, stats in validation_results.items():
                if table in ["validation_timestamp", "overall_status", "quality_issues"]:
                    continue
                
                if isinstance(stats, dict) and "error" not in stats:
                    print(f"✅ {table.title()}: {stats.get('total_attempts' if 'attempts' in table else 'total_' + table.split('_')[0] + '_items', 'N/A')} records")
                else:
                    print(f"⚠️  {table.title()}: {stats.get('error', 'No data')}")
            
            if validation_results.get("quality_issues"):
                print(f"\n⚠️  Quality Issues Found:")
                for issue in validation_results["quality_issues"]:
                    print(f"   - {issue}")
            else:
                print("✅ No data quality issues found")
            
            self.results["validation"] = validation_results
            
        except Exception as e:
            print(f"❌ Data validation failed: {e}")
            self.results["validation"] = {"error": str(e)}
    
    async def test_sync_status(self):
        """Test getting sync status"""
        print("\n📊 Testing Sync Status")
        print("-" * 50)
        
        try:
            status_results = await self.etl_service.get_sync_status()
            
            for table, status in status_results.get("tables", {}).items():
                if status.get("exists"):
                    print(f"✅ {table.title()}: {status.get('row_count', 0)} rows, {status.get('table_size_mb', 0)} MB")
                else:
                    print(f"❌ {table.title()}: {status.get('error', 'Unknown error')}")
            
            self.results["sync_status"] = status_results
            
        except Exception as e:
            print(f"❌ Sync status failed: {e}")
            self.results["sync_status"] = {"error": str(e)}
    
    async def test_incremental_sync(self):
        """Test incremental sync functionality"""
        print("\n⏳ Testing Incremental Sync")
        print("-" * 50)
        
        try:
            # First, do a small full sync
            await self.test_small_data_sync()
            
            # Then test incremental
            incremental_attempts = await self.etl_service.sync_attempts_from_cosmos(
                incremental=True, 
                limit=3
            )
            print(f"✅ Incremental attempts sync: {incremental_attempts.get('records_processed', 0)} records")
            
            incremental_reviews = await self.etl_service.sync_reviews_from_cosmos(
                incremental=True, 
                limit=3
            )
            print(f"✅ Incremental reviews sync: {incremental_reviews.get('records_processed', 0)} records")
            
            self.results["incremental_sync"] = {
                "attempts": incremental_attempts,
                "reviews": incremental_reviews
            }
            
        except Exception as e:
            print(f"❌ Incremental sync failed: {e}")
            self.results["incremental_sync"] = {"error": str(e)}
    
    async def test_blob_services(self):
        """Test blob storage services if available"""
        print("\n💾 Testing Blob Storage Services")
        print("-" * 50)
        
        try:
            # Test curriculum service if available
            if self.etl_service.curriculum_service:
                curriculum_result = await self.etl_service.sync_curriculum_from_blob()
                print(f"✅ Curriculum sync: {curriculum_result.get('records_processed', 0)} records")
                self.results["curriculum_sync"] = curriculum_result
            else:
                print("⚠️  Curriculum service not configured - skipping")
                self.results["curriculum_sync"] = {"skipped": True, "reason": "Service not configured"}
            
            # Test learning paths service if available
            if self.etl_service.learning_paths_service:
                paths_result = await self.etl_service.sync_learning_paths_from_blob()
                print(f"✅ Learning paths sync: {paths_result.get('records_processed', 0)} records")
                self.results["learning_paths_sync"] = paths_result
            else:
                print("⚠️  Learning paths service not configured - skipping")
                self.results["learning_paths_sync"] = {"skipped": True, "reason": "Service not configured"}
            
        except Exception as e:
            print(f"❌ Blob services test failed: {e}")
            self.results["blob_services"] = {"error": str(e)}
    
    async def test_full_pipeline(self):
        """Test the complete ETL pipeline"""
        print("\n🚀 Testing Full ETL Pipeline")
        print("-" * 50)
        
        try:
            # Run full sync in test mode
            full_sync_result = await self.etl_service.run_full_sync(test_mode=True)
            
            print(f"✅ Full sync completed")
            print(f"   Success: {full_sync_result.get('success', False)}")
            print(f"   Total records: {full_sync_result.get('total_records_processed', 0)}")
            
            # Show individual results
            for component, result in full_sync_result.get('results', {}).items():
                if isinstance(result, dict):
                    records = result.get('records_processed', 0)
                    success = result.get('success', False)
                    emoji = "✅" if success else "❌"
                    print(f"   {emoji} {component.title()}: {records} records")
            
            self.results["full_pipeline"] = full_sync_result
            
        except Exception as e:
            print(f"❌ Full pipeline test failed: {e}")
            self.results["full_pipeline"] = {"error": str(e)}
    
    async def test_cleanup(self):
        """Test data cleanup functionality"""
        print("\n🧹 Testing Data Cleanup")
        print("-" * 50)
        
        try:
            cleanup_result = await self.etl_service.cleanup_old_data()
            
            if cleanup_result.get('success'):
                print("✅ Cleanup completed successfully")
                for operation, status in cleanup_result.get('cleanup_results', {}).items():
                    print(f"   - {operation}: {status}")
            else:
                print(f"❌ Cleanup failed: {cleanup_result.get('error', 'Unknown error')}")
            
            self.results["cleanup"] = cleanup_result
            
        except Exception as e:
            print(f"❌ Cleanup test failed: {e}")
            self.results["cleanup"] = {"error": str(e)}
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("🎯 ETL TEST SUMMARY")
        print("="*60)
        
        total_tests = 0
        passed_tests = 0
        
        for test_name, result in self.results.items():
            total_tests += 1
            
            if isinstance(result, dict):
                if result.get('success', False) or (result.get('skipped', False)):
                    passed_tests += 1
                    status = "✅ PASS" if result.get('success', False) else "⚠️  SKIP"
                elif 'error' in result:
                    status = "❌ FAIL"
                else:
                    # Check for sub-results
                    sub_success = all(
                        sub_result.get('success', False) 
                        for sub_result in result.values() 
                        if isinstance(sub_result, dict)
                    )
                    if sub_success:
                        passed_tests += 1
                        status = "✅ PASS"
                    else:
                        status = "❌ FAIL"
            else:
                status = "❓ UNKNOWN"
            
            print(f"{status} {test_name.replace('_', ' ').title()}")
        
        print(f"\nTest Results: {passed_tests}/{total_tests} passed")
        
        if passed_tests == total_tests:
            print("🎉 All tests passed! ETL pipeline is ready for production.")
        elif passed_tests >= total_tests * 0.8:
            print("🟡 Most tests passed. Review failed tests before production.")
        else:
            print("🔴 Multiple tests failed. ETL pipeline needs attention.")
    
    async def run_all_tests(self):
        """Run the complete test suite"""
        try:
            print("🧪 Starting Comprehensive ETL Test Suite")
            print("="*60)
            
            await self.setup()
            
            # Core connectivity tests
            await self.test_connections()
            
            # Only proceed if basic connections work
            if not self.results.get("connections", {}).get("bigquery", False):
                print("\n❌ BigQuery connection failed - aborting remaining tests")
                return
            
            if not self.results.get("connections", {}).get("cosmos_db", False):
                print("\n❌ Cosmos DB connection failed - aborting remaining tests")
                return
            
            # Infrastructure tests
            await self.test_table_creation()
            
            # Data sync tests
            await self.test_small_data_sync()
            await self.test_incremental_sync()
            
            # Blob storage tests (optional)
            await self.test_blob_services()
            
            # Validation and monitoring tests
            await self.test_data_validation()
            await self.test_sync_status()
            
            # Full pipeline test
            await self.test_full_pipeline()
            
            # Cleanup test
            await self.test_cleanup()
            
            # Print summary
            self.print_summary()
            
        except Exception as e:
            print(f"\n❌ Test suite failed: {e}")
            import traceback
            traceback.print_exc()


async def run_quick_test():
    """Run a quick connectivity test"""
    print("⚡ Quick ETL Connectivity Test")
    print("-" * 40)
    
    if not setup_credentials():
        print("❌ Credentials setup failed")
        return
    
    try:
        from app.services.bigquery_etl import BigQueryETLService
        
        etl_service = BigQueryETLService()
        connection_results = await etl_service.test_connections()
        
        print(f"BigQuery: {'✅' if connection_results.get('bigquery') else '❌'}")
        print(f"Cosmos DB: {'✅' if connection_results.get('cosmos_db') else '❌'}")
        
        if connection_results.get('errors'):
            print("\nErrors:")
            for error in connection_results['errors']:
                print(f"  - {error}")
        
    except Exception as e:
        print(f"❌ Quick test failed: {e}")


async def run_manual_cosmos_test():
    """Test Cosmos DB connection manually"""
    print("🔍 Manual Cosmos DB Test")
    print("-" * 40)
    
    try:
        from app.db.cosmos_db import CosmosDBService
        
        cosmos_service = CosmosDBService()
        print("✅ Cosmos DB service initialized")
        
        # Test attempts query
        test_query = "SELECT TOP 3 * FROM c"
        attempts_data = list(cosmos_service.attempts.query_items(
            query=test_query,
            enable_cross_partition_query=True
        ))
        
        print(f"✅ Found {len(attempts_data)} sample attempts")
        
        if attempts_data:
            sample = attempts_data[0]
            print(f"   Sample keys: {list(sample.keys())}")
            print(f"   Student ID: {sample.get('student_id', 'N/A')}")
            print(f"   Subject: {sample.get('subject', 'N/A')}")
        
        # Test reviews query
        try:
            reviews_data = list(cosmos_service.reviews.query_items(
                query=test_query,
                enable_cross_partition_query=True
            ))
            print(f"✅ Found {len(reviews_data)} sample reviews")
        except Exception as reviews_error:
            print(f"⚠️  Reviews query failed: {reviews_error}")
        
    except Exception as e:
        print(f"❌ Manual Cosmos test failed: {e}")
        import traceback
        traceback.print_exc()


def main():
    """Main test function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='ETL Test Suite')
    parser.add_argument('--quick', action='store_true', help='Run quick connectivity test only')
    parser.add_argument('--cosmos', action='store_true', help='Run manual Cosmos DB test')
    parser.add_argument('--full', action='store_true', help='Run full test suite (default)')
    
    args = parser.parse_args()
    
    if args.quick:
        asyncio.run(run_quick_test())
    elif args.cosmos:
        asyncio.run(run_manual_cosmos_test())
    else:
        # Run full test suite
        test_suite = ETLTestSuite()
        asyncio.run(test_suite.run_all_tests())


if __name__ == "__main__":
    main()