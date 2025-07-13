# backend/scripts/learning_paths_etl.py

import os
import sys
import json
import logging
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

class LearningPathsETL:
    """ETL for learning paths decision tree data"""
    
    def __init__(self, batch_size: int = 100):
        self.batch_size = batch_size
        self.bq_client = None
        self.dataset_id = os.getenv('BIGQUERY_DATASET_ID', 'analytics')
        self.project_id = os.getenv('GOOGLE_CLOUD_PROJECT', 'mountamo-tutor-h7wnta')
        self.data_file_path = backend_dir / "data" / "learning_path_decision_tree.json"
        self.results = {}
        self.start_time = None
        
    def setup(self):
        """Setup the ETL environment"""
        print("🔧 Setting up Learning Paths ETL environment...")
        
        # Setup credentials
        if not setup_credentials():
            raise Exception("❌ Credentials setup failed - file not found")
        
        # Initialize BigQuery client
        self.bq_client = bigquery.Client(project=self.project_id)
        print("✅ BigQuery client initialized")
        
        # Check if data file exists
        if not self.data_file_path.exists():
            raise Exception(f"❌ Data file not found: {self.data_file_path}")
        
        print(f"✅ Data file found: {self.data_file_path}")
    
    def _get_learning_paths_schema(self) -> List[bigquery.SchemaField]:
        """Define BigQuery schema for learning paths table"""
        return [
            bigquery.SchemaField("prerequisite_skill_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("unlocks_skill_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("min_score_threshold", "FLOAT", mode="NULLABLE"),
            bigquery.SchemaField("is_base_node", "BOOLEAN", mode="NULLABLE"),
        ]
    
    def _ensure_table_exists(self, table_name: str, schema: List[bigquery.SchemaField]):
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
    
    def _load_decision_tree_data(self) -> Dict[str, Any]:
        """Load the learning path decision tree JSON data"""
        try:
            with open(self.data_file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Extract the decision tree from the JSON structure
            decision_tree = data.get('learning_path_decision_tree', {})
            
            if not decision_tree:
                raise ValueError("No 'learning_path_decision_tree' found in JSON data")
            
            print(f"✅ Loaded decision tree with {len(decision_tree)} nodes")
            return decision_tree
            
        except Exception as e:
            raise Exception(f"Failed to load decision tree data: {e}")
    
    def _identify_base_nodes(self, decision_tree: Dict[str, List[str]]) -> set:
        """Identify base nodes (nodes that are not unlocked by any other node)"""
        all_nodes = set(decision_tree.keys())
        unlocked_nodes = set()
        
        # Collect all nodes that are unlocked by other nodes
        for prerequisite, unlocks_list in decision_tree.items():
            unlocked_nodes.update(unlocks_list)
        
        # Base nodes are those that exist but are never unlocked by others
        base_nodes = all_nodes - unlocked_nodes
        
        print(f"✅ Identified {len(base_nodes)} base nodes: {sorted(base_nodes)}")
        return base_nodes
    
    def _transform_decision_tree(self, decision_tree: Dict[str, List[str]]) -> List[Dict[str, Any]]:
        """Transform decision tree into learning paths records"""
        records = []
        base_nodes = self._identify_base_nodes(decision_tree)
        
        # Create records for each prerequisite → unlocks relationship
        for prerequisite_skill, unlocked_skills in decision_tree.items():
            is_base = prerequisite_skill in base_nodes
            
            if unlocked_skills:  # If this skill unlocks other skills
                for unlocked_skill in unlocked_skills:
                    record = {
                        "prerequisite_skill_id": prerequisite_skill,
                        "unlocks_skill_id": unlocked_skill,
                        "min_score_threshold": None,  # Can be set later if needed
                        "is_base_node": is_base
                    }
                    records.append(record)
            else:  # Terminal node (doesn't unlock anything)
                # Still create a record to mark it as existing
                record = {
                    "prerequisite_skill_id": prerequisite_skill,
                    "unlocks_skill_id": None,  # Terminal node
                    "min_score_threshold": None,
                    "is_base_node": is_base
                }
                records.append(record)
        
        print(f"✅ Transformed decision tree into {len(records)} learning path records")
        return records
    
    def _load_to_bigquery(self, table_name: str, records: List[Dict[str, Any]], write_disposition: str = "WRITE_TRUNCATE") -> int:
        """Load records to BigQuery"""
        if not records:
            return 0
        
        table_id = f"{self.project_id}.{self.dataset_id}.{table_name}"
        
        # Filter out records with None unlocks_skill_id for the main table
        # (BigQuery doesn't handle None values well in REQUIRED fields)
        filtered_records = [r for r in records if r.get('unlocks_skill_id') is not None]
        
        if not filtered_records:
            print("  No valid records to load (all terminal nodes)")
            return 0
        
        job_config = bigquery.LoadJobConfig(
            write_disposition=write_disposition,
            source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON,
        )
        
        # Load data in batches
        total_loaded = 0
        for i in range(0, len(filtered_records), self.batch_size):
            batch = filtered_records[i:i + self.batch_size]
            
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
    
    def load_learning_paths(self, incremental: bool = False):
        """Load learning paths from JSON to BigQuery"""
        print(f"\n📚 Loading learning paths {'(incremental)' if incremental else '(full load)'}...")
        
        try:
            # Ensure table exists
            self._ensure_table_exists("learning_paths", self._get_learning_paths_schema())
            
            # Load decision tree data
            decision_tree = self._load_decision_tree_data()
            
            # Transform data
            learning_path_records = self._transform_decision_tree(decision_tree)
            
            # Load to BigQuery
            records_loaded = 0
            if learning_path_records:
                print("  Loading learning paths to BigQuery...")
                records_loaded = self._load_to_bigquery(
                    "learning_paths", 
                    learning_path_records,
                    write_disposition="WRITE_TRUNCATE" if not incremental else "WRITE_APPEND"
                )
            
            result = {
                "success": True,
                "total_nodes": len(decision_tree),
                "records_loaded": records_loaded,
                "terminal_nodes": len([r for r in learning_path_records if r.get('unlocks_skill_id') is None])
            }
            
            print(f"✅ Learning paths loaded: {records_loaded:,} path relationships")
            self.results['learning_paths'] = result
            return result
            
        except Exception as e:
            logger.error(f"Learning paths load failed: {e}")
            result = {"success": False, "error": str(e)}
            self.results['learning_paths'] = result
            return result
    
    def validate_loaded_data(self):
        """Validate the loaded data"""
        print(f"\n🔍 Validating loaded learning paths data...")
        
        try:
            # Validate learning paths table
            validation_query = f"""
                SELECT 
                    COUNT(*) as total_relationships,
                    COUNT(DISTINCT prerequisite_skill_id) as unique_prerequisites,
                    COUNT(DISTINCT unlocks_skill_id) as unique_unlocks,
                    SUM(CASE WHEN is_base_node = true THEN 1 ELSE 0 END) as base_node_relationships,
                    COUNT(DISTINCT CASE WHEN is_base_node = true THEN prerequisite_skill_id END) as unique_base_nodes
                FROM `{self.project_id}.{self.dataset_id}.learning_paths`
            """
            
            results = list(self.bq_client.query(validation_query))
            
            # Print validation results
            if results:
                stats = dict(results[0])
                print("Learning Paths validation results:")
                print(f"  📊 Total path relationships: {stats.get('total_relationships', 0):,}")
                print(f"  🔗 Unique prerequisite skills: {stats.get('unique_prerequisites', 0):,}")
                print(f"  🎯 Unique skills that get unlocked: {stats.get('unique_unlocks', 0):,}")
                print(f"  🌟 Base node relationships: {stats.get('base_node_relationships', 0):,}")
                print(f"  🏁 Unique base nodes: {stats.get('unique_base_nodes', 0):,}")
            
            # Sample some data
            sample_query = f"""
                SELECT *
                FROM `{self.project_id}.{self.dataset_id}.learning_paths`
                WHERE is_base_node = true
                LIMIT 5
            """
            
            sample_results = list(self.bq_client.query(sample_query))
            if sample_results:
                print("\nSample base node relationships:")
                for row in sample_results:
                    print(f"  {row.prerequisite_skill_id} → {row.unlocks_skill_id}")
            
            validation_results = {
                "stats": dict(results[0]) if results else {},
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
        print("🎯 LEARNING PATHS ETL SUMMARY")
        print("="*80)
        print(f"Start Time: {self.start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"End Time: {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Duration: {duration}")
        print("-"*80)
        
        # Learning paths results
        lp_result = self.results.get('learning_paths', {})
        if lp_result.get('success'):
            records = lp_result.get('records_loaded', 0)
            nodes = lp_result.get('total_nodes', 0)
            terminals = lp_result.get('terminal_nodes', 0)
            print(f"✅ SUCCESS Learning Paths: {records:,} relationships from {nodes:,} nodes ({terminals:,} terminal)")
        else:
            error = lp_result.get('error', 'Unknown error')
            print(f"❌ FAILED Learning Paths: {error}")
        
        # Validation results
        validation = self.results.get('validation', {})
        if validation and not validation.get('success') == False:
            print("✅ SUCCESS Data validation completed")
        else:
            print("❌ FAILED Data validation")
        
        print("="*80)
        
        # Check overall success
        if lp_result.get('success') and validation:
            print("🎉 Learning paths ETL completed successfully!")
        else:
            print("🟡 Learning paths ETL completed with issues")
    
    def run_etl(self, incremental: bool = False):
        """Run the complete learning paths ETL"""
        self.start_time = datetime.now()
        
        try:
            print("🚀 Starting Learning Paths ETL")
            print("="*80)
            print(f"Mode: {'Incremental' if incremental else 'Full Load'}")
            print(f"Data File: {self.data_file_path}")
            print(f"Start Time: {self.start_time.strftime('%Y-%m-%d %H:%M:%S')}")
            print("="*80)
            
            # Setup
            self.setup()
            
            # Load learning paths
            self.load_learning_paths(incremental=incremental)
            
            # Validate loaded data
            self.validate_loaded_data()
            
            # Print summary
            self.print_summary()
            
        except Exception as e:
            print(f"\n❌ Learning paths ETL failed: {e}")
            import traceback
            traceback.print_exc()

def preview_decision_tree():
    """Preview the decision tree data structure"""
    print("🔍 Learning Path Decision Tree Preview")
    print("-" * 50)
    
    backend_dir = Path(__file__).parent.parent
    data_file_path = backend_dir / "data" / "learning_path_decision_tree.json"
    
    try:
        with open(data_file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        decision_tree = data.get('learning_path_decision_tree', {})
        
        print(f"📊 Total nodes in decision tree: {len(decision_tree)}")
        
        # Find base nodes
        all_nodes = set(decision_tree.keys())
        unlocked_nodes = set()
        for unlocks_list in decision_tree.values():
            unlocked_nodes.update(unlocks_list)
        base_nodes = all_nodes - unlocked_nodes
        
        print(f"🌟 Base nodes (starting points): {len(base_nodes)}")
        print(f"   {sorted(list(base_nodes))}")
        
        # Find terminal nodes
        terminal_nodes = [node for node, unlocks in decision_tree.items() if not unlocks]
        print(f"🏁 Terminal nodes (end points): {len(terminal_nodes)}")
        print(f"   {sorted(terminal_nodes)}")
        
        # Show some examples
        print(f"\n📚 Example paths:")
        for i, (prereq, unlocks) in enumerate(list(decision_tree.items())[:5]):
            is_base = prereq in base_nodes
            base_marker = " (BASE)" if is_base else ""
            if unlocks:
                print(f"   {prereq}{base_marker} → {', '.join(unlocks[:3])}{'...' if len(unlocks) > 3 else ''}")
            else:
                print(f"   {prereq}{base_marker} → [TERMINAL]")
        
    except Exception as e:
        print(f"❌ Failed to preview decision tree: {e}")

def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Learning Paths ETL Script')
    parser.add_argument('--incremental', action='store_true', 
                       help='Run incremental load instead of full load')
    parser.add_argument('--preview', action='store_true', 
                       help='Preview decision tree data structure')
    parser.add_argument('--batch-size', type=int, default=100,
                       help='Batch size for BigQuery loading (default: 100)')
    
    args = parser.parse_args()
    
    if args.preview:
        preview_decision_tree()
    else:
        # Run learning paths ETL
        etl = LearningPathsETL(batch_size=args.batch_size)
        etl.run_etl(incremental=args.incremental)

if __name__ == "__main__":
    main()