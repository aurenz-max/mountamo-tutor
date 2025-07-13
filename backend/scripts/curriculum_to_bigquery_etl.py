# backend/scripts/curriculum_etl.py

import os
import sys
import csv
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

class CurriculumETL:
    """Simple ETL for curriculum syllabus data"""
    
    def __init__(self, batch_size: int = 100):
        self.batch_size = batch_size
        self.bq_client = None
        self.dataset_id = os.getenv('BIGQUERY_DATASET_ID', 'analytics')
        self.project_id = os.getenv('GOOGLE_CLOUD_PROJECT', 'mountamo-tutor-h7wnta')
        self.syllabus_csv_path = backend_dir / "data" / "kindergarten" / "syllabus.csv"
        self.results = {}
        self.start_time = None
        
    def setup(self):
        """Setup the ETL environment"""
        print("🔧 Setting up Curriculum ETL environment...")
        
        # Setup credentials
        if not setup_credentials():
            raise Exception("❌ Credentials setup failed - file not found")
        
        # Initialize BigQuery client
        self.bq_client = bigquery.Client(project=self.project_id)
        print("✅ BigQuery client initialized")
        
        # Check if CSV file exists
        if not self.syllabus_csv_path.exists():
            raise Exception(f"❌ CSV file not found: {self.syllabus_csv_path}")
        
        print(f"✅ CSV file found: {self.syllabus_csv_path}")
    
    def _get_curriculum_schema(self) -> List[bigquery.SchemaField]:
        """Define BigQuery schema for curriculum table"""
        return [
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
    
    def _load_csv_data(self) -> List[Dict[str, Any]]:
        """Load CSV data (assumes comma-delimited)"""
        records = []
        
        try:
            with open(self.syllabus_csv_path, 'r', encoding='utf-8') as csvfile:
                reader = csv.DictReader(csvfile)
                
                # Print headers for debugging
                print(f"📋 CSV Headers: {reader.fieldnames}")
                
                for row_num, row in enumerate(reader, 1):
                    try:
                        # Clean and validate data
                        record = self._clean_csv_row(row)
                        if record:
                            records.append(record)
                    except Exception as e:
                        print(f"⚠️ Warning: Skipping row {row_num} due to error: {e}")
                        continue
            
            print(f"✅ Loaded {len(records)} valid records from CSV")
            return records
            
        except Exception as e:
            raise Exception(f"Failed to load CSV data: {e}")
    
    def _clean_csv_row(self, row: Dict[str, str]) -> Optional[Dict[str, Any]]:
        """Clean and transform a single CSV row using direct mapping"""
        
        # Direct mapping from CSV headers to BigQuery schema
        csv_to_bq_mapping = {
            'Subject': 'subject',
            'Grade': 'grade', 
            'UnitID': 'unit_id',
            'UnitTitle': 'unit_title',
            'SkillID': 'skill_id',
            'SkillDescription': 'skill_description',
            'SubskillID': 'subskill_id',
            'SubskillDescription': 'subskill_description',
            'DifficultyStart': 'difficulty_start',
            'DifficultyEnd': 'difficulty_end',
            'TargetDifficulty': 'target_difficulty'
        }
        
        record = {}
        
        # Required string fields
        required_csv_fields = ['Subject', 'UnitID', 'UnitTitle', 'SkillID', 'SkillDescription', 'SubskillID', 'SubskillDescription']
        
        for csv_field in required_csv_fields:
            bq_field = csv_to_bq_mapping[csv_field]
            value = row.get(csv_field, '').strip()
            if not value:
                raise ValueError(f"Missing required field: {csv_field}")
            record[bq_field] = value
        
        # Optional string field
        record['grade'] = row.get('Grade', '').strip() or None
        
        # Optional float fields
        float_csv_fields = ['DifficultyStart', 'DifficultyEnd', 'TargetDifficulty']
        for csv_field in float_csv_fields:
            bq_field = csv_to_bq_mapping[csv_field]
            value = row.get(csv_field, '').strip()
            if value and value.lower() not in ['', 'null', 'none', 'n/a']:
                try:
                    record[bq_field] = float(value)
                except ValueError:
                    record[bq_field] = None
            else:
                record[bq_field] = None
        
        return record
    
    def _load_to_bigquery(self, table_name: str, records: List[Dict[str, Any]], write_disposition: str = "WRITE_TRUNCATE") -> int:
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
    
    def load_curriculum(self, incremental: bool = False):
        """Load curriculum data from CSV to BigQuery"""
        print(f"\n📚 Loading curriculum data {'(incremental)' if incremental else '(full load)'}...")
        
        try:
            # Ensure table exists
            self._ensure_table_exists("curriculum", self._get_curriculum_schema())
            
            # Load CSV data
            records = self._load_csv_data()
            
            # Load to BigQuery
            records_loaded = 0
            if records:
                print("  Loading curriculum data to BigQuery...")
                records_loaded = self._load_to_bigquery(
                    "curriculum", 
                    records,
                    write_disposition="WRITE_TRUNCATE" if not incremental else "WRITE_APPEND"
                )
            
            result = {
                "success": True,
                "records_loaded": records_loaded,
                "unique_subjects": len(set(r['subject'] for r in records)),
                "unique_units": len(set(r['unit_id'] for r in records)),
                "unique_skills": len(set(r['skill_id'] for r in records)),
                "unique_subskills": len(set(r['subskill_id'] for r in records))
            }
            
            print(f"✅ Curriculum data loaded: {records_loaded:,} records")
            self.results['curriculum'] = result
            return result
            
        except Exception as e:
            logger.error(f"Curriculum load failed: {e}")
            result = {"success": False, "error": str(e)}
            self.results['curriculum'] = result
            return result
    
    def validate_loaded_data(self):
        """Validate the loaded data"""
        print(f"\n🔍 Validating loaded curriculum data...")
        
        try:
            # Validate curriculum table
            validation_query = f"""
                SELECT 
                    COUNT(*) as total_records,
                    COUNT(DISTINCT subject) as unique_subjects,
                    COUNT(DISTINCT unit_id) as unique_units,
                    COUNT(DISTINCT skill_id) as unique_skills,
                    COUNT(DISTINCT subskill_id) as unique_subskills,
                    COUNT(DISTINCT grade) as unique_grades,
                    AVG(difficulty_start) as avg_difficulty_start,
                    AVG(difficulty_end) as avg_difficulty_end,
                    AVG(target_difficulty) as avg_target_difficulty
                FROM `{self.project_id}.{self.dataset_id}.curriculum`
            """
            
            results = list(self.bq_client.query(validation_query))
            
            # Print validation results
            if results:
                stats = dict(results[0])
                print("Curriculum validation results:")
                print(f"  📊 Total records: {stats.get('total_records', 0):,}")
                print(f"  📚 Unique subjects: {stats.get('unique_subjects', 0):,}")
                print(f"  📖 Unique units: {stats.get('unique_units', 0):,}")
                print(f"  🎯 Unique skills: {stats.get('unique_skills', 0):,}")
                print(f"  ⚡ Unique subskills: {stats.get('unique_subskills', 0):,}")
                print(f"  🎓 Unique grades: {stats.get('unique_grades', 0):,}")
                
                # Difficulty stats (if available)
                if stats.get('avg_difficulty_start'):
                    print(f"  📈 Avg difficulty start: {stats.get('avg_difficulty_start', 0):.2f}")
                    print(f"  📈 Avg difficulty end: {stats.get('avg_difficulty_end', 0):.2f}")
                    print(f"  📈 Avg target difficulty: {stats.get('avg_target_difficulty', 0):.2f}")
            
            # Sample some data
            sample_query = f"""
                SELECT subject, grade, unit_title, skill_description, subskill_description
                FROM `{self.project_id}.{self.dataset_id}.curriculum`
                LIMIT 5
            """
            
            sample_results = list(self.bq_client.query(sample_query))
            if sample_results:
                print("\nSample curriculum records:")
                for row in sample_results:
                    grade_str = f" (Grade: {row.grade})" if row.grade else ""
                    print(f"  📚 {row.subject}{grade_str}")
                    print(f"      Unit: {row.unit_title}")
                    print(f"      Skill: {row.skill_description}")
                    print(f"      Subskill: {row.subskill_description}")
                    print()
            
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
        print("🎯 CURRICULUM ETL SUMMARY")
        print("="*80)
        print(f"Start Time: {self.start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"End Time: {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Duration: {duration}")
        print("-"*80)
        
        # Curriculum results
        curr_result = self.results.get('curriculum', {})
        if curr_result.get('success'):
            records = curr_result.get('records_loaded', 0)
            subjects = curr_result.get('unique_subjects', 0)
            units = curr_result.get('unique_units', 0)
            skills = curr_result.get('unique_skills', 0)
            subskills = curr_result.get('unique_subskills', 0)
            print(f"✅ SUCCESS Curriculum: {records:,} records")
            print(f"   📚 {subjects:,} subjects, 📖 {units:,} units, 🎯 {skills:,} skills, ⚡ {subskills:,} subskills")
        else:
            error = curr_result.get('error', 'Unknown error')
            print(f"❌ FAILED Curriculum: {error}")
        
        # Validation results
        validation = self.results.get('validation', {})
        if validation and not validation.get('success') == False:
            print("✅ SUCCESS Data validation completed")
        else:
            print("❌ FAILED Data validation")
        
        print("="*80)
        
        # Check overall success
        if curr_result.get('success') and validation:
            print("🎉 Curriculum ETL completed successfully!")
        else:
            print("🟡 Curriculum ETL completed with issues")
    
    def run_etl(self, incremental: bool = False):
        """Run the complete curriculum ETL"""
        self.start_time = datetime.now()
        
        try:
            print("🚀 Starting Curriculum ETL")
            print("="*80)
            print(f"Mode: {'Incremental' if incremental else 'Full Load'}")
            print(f"CSV File: {self.syllabus_csv_path}")
            print(f"Start Time: {self.start_time.strftime('%Y-%m-%d %H:%M:%S')}")
            print("="*80)
            
            # Setup
            self.setup()
            
            # Load curriculum data
            self.load_curriculum(incremental=incremental)
            
            # Validate loaded data
            self.validate_loaded_data()
            
            # Print summary
            self.print_summary()
            
        except Exception as e:
            print(f"\n❌ Curriculum ETL failed: {e}")
            import traceback
            traceback.print_exc()

def preview_csv():
    """Simple preview of CSV structure"""
    print("🔍 Curriculum CSV Preview")
    print("-" * 50)
    
    backend_dir = Path(__file__).parent.parent
    csv_path = backend_dir / "data" / "kindergarten" / "syllabus.csv"
    
    try:
        with open(csv_path, 'r', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            
            print(f"📋 CSV Headers: {reader.fieldnames}")
            
            # Show first few rows
            print(f"\n📚 Sample data (first 3 rows):")
            for i, row in enumerate(reader):
                if i >= 3:
                    break
                print(f"   Row {i+1}:")
                for key, value in row.items():
                    if value and len(str(value)) > 50:
                        display_value = str(value)[:47] + "..."
                    else:
                        display_value = value
                    print(f"     {key}: {display_value}")
                print()
        
    except Exception as e:
        print(f"❌ Failed to preview CSV: {e}")

def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Curriculum ETL Script')
    parser.add_argument('--incremental', action='store_true', 
                       help='Run incremental load instead of full load')
    parser.add_argument('--preview', action='store_true', 
                       help='Preview CSV data structure')
    parser.add_argument('--batch-size', type=int, default=100,
                       help='Batch size for BigQuery loading (default: 100)')
    
    args = parser.parse_args()
    
    if args.preview:
        preview_csv()
    else:
        # Run curriculum ETL
        etl = CurriculumETL(batch_size=args.batch_size)
        etl.run_etl(incremental=args.incremental)

if __name__ == "__main__":
    main()