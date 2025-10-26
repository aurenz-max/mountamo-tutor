"""
BigQuery database connection and schema management
"""

import logging
from typing import List, Dict, Any, Optional
from google.cloud import bigquery
from google.cloud.exceptions import NotFound

from app.core.config import settings

logger = logging.getLogger(__name__)


class BigQueryDatabase:
    """BigQuery database manager for curriculum authoring"""

    def __init__(self):
        self.client: Optional[bigquery.Client] = None
        self.project_id = settings.GOOGLE_CLOUD_PROJECT
        self.dataset_id = settings.BIGQUERY_DATASET_ID

    def initialize(self):
        """Initialize BigQuery client"""
        try:
            self.client = bigquery.Client(project=self.project_id)
            logger.info(f"✅ BigQuery client initialized for project: {self.project_id}")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to initialize BigQuery client: {e}")
            raise

    def get_subjects_schema(self) -> List[bigquery.SchemaField]:
        """Schema for curriculum_subjects table"""
        return [
            bigquery.SchemaField("subject_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("subject_name", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("description", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("grade_level", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("version_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("is_active", "BOOLEAN", mode="REQUIRED"),
            bigquery.SchemaField("is_draft", "BOOLEAN", mode="REQUIRED"),
            bigquery.SchemaField("created_at", "TIMESTAMP", mode="REQUIRED"),
            bigquery.SchemaField("updated_at", "TIMESTAMP", mode="REQUIRED"),
            bigquery.SchemaField("created_by", "STRING", mode="NULLABLE"),
        ]

    def get_units_schema(self) -> List[bigquery.SchemaField]:
        """Schema for curriculum_units table"""
        return [
            bigquery.SchemaField("unit_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("subject_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("unit_title", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("unit_order", "INTEGER", mode="NULLABLE"),
            bigquery.SchemaField("description", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("version_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("is_draft", "BOOLEAN", mode="REQUIRED"),
            bigquery.SchemaField("created_at", "TIMESTAMP", mode="REQUIRED"),
            bigquery.SchemaField("updated_at", "TIMESTAMP", mode="REQUIRED"),
        ]

    def get_skills_schema(self) -> List[bigquery.SchemaField]:
        """Schema for curriculum_skills table"""
        return [
            bigquery.SchemaField("skill_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("unit_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("skill_description", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("skill_order", "INTEGER", mode="NULLABLE"),
            bigquery.SchemaField("version_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("is_draft", "BOOLEAN", mode="REQUIRED"),
            bigquery.SchemaField("created_at", "TIMESTAMP", mode="REQUIRED"),
            bigquery.SchemaField("updated_at", "TIMESTAMP", mode="REQUIRED"),
        ]

    def get_subskills_schema(self) -> List[bigquery.SchemaField]:
        """Schema for curriculum_subskills table"""
        return [
            bigquery.SchemaField("subskill_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("skill_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("subskill_description", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("subskill_order", "INTEGER", mode="NULLABLE"),
            bigquery.SchemaField("difficulty_start", "FLOAT", mode="NULLABLE"),
            bigquery.SchemaField("difficulty_end", "FLOAT", mode="NULLABLE"),
            bigquery.SchemaField("target_difficulty", "FLOAT", mode="NULLABLE"),
            bigquery.SchemaField("version_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("is_draft", "BOOLEAN", mode="REQUIRED"),
            bigquery.SchemaField("created_at", "TIMESTAMP", mode="REQUIRED"),
            bigquery.SchemaField("updated_at", "TIMESTAMP", mode="REQUIRED"),
        ]

    def get_prerequisites_schema(self) -> List[bigquery.SchemaField]:
        """Schema for curriculum_prerequisites table (polymorphic relationships)"""
        return [
            bigquery.SchemaField("prerequisite_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("subject_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("prerequisite_entity_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("prerequisite_entity_type", "STRING", mode="REQUIRED"),  # 'skill' or 'subskill'
            bigquery.SchemaField("unlocks_entity_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("unlocks_entity_type", "STRING", mode="REQUIRED"),  # 'skill' or 'subskill'
            bigquery.SchemaField("min_proficiency_threshold", "FLOAT", mode="NULLABLE"),
            bigquery.SchemaField("version_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("is_draft", "BOOLEAN", mode="REQUIRED"),
            bigquery.SchemaField("created_at", "TIMESTAMP", mode="REQUIRED"),
        ]

    def get_versions_schema(self) -> List[bigquery.SchemaField]:
        """Schema for curriculum_versions table"""
        return [
            bigquery.SchemaField("version_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("subject_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("version_number", "INTEGER", mode="REQUIRED"),
            bigquery.SchemaField("description", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("is_active", "BOOLEAN", mode="REQUIRED"),
            bigquery.SchemaField("created_at", "TIMESTAMP", mode="REQUIRED"),
            bigquery.SchemaField("activated_at", "TIMESTAMP", mode="NULLABLE"),
            bigquery.SchemaField("created_by", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("change_summary", "STRING", mode="NULLABLE"),
        ]

    def get_primitives_schema(self) -> List[bigquery.SchemaField]:
        """Schema for curriculum_primitives table (visual primitive library)"""
        return [
            bigquery.SchemaField("primitive_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("primitive_name", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("category", "STRING", mode="REQUIRED"),  # foundational, math, science, language-arts, abcs
            bigquery.SchemaField("best_for", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("avoid_for", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("example", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("created_at", "TIMESTAMP", mode="REQUIRED"),
        ]

    def get_subskill_primitives_schema(self) -> List[bigquery.SchemaField]:
        """Schema for curriculum_subskill_primitives table (junction table)"""
        return [
            bigquery.SchemaField("subskill_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("primitive_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("version_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("is_draft", "BOOLEAN", mode="REQUIRED"),
            bigquery.SchemaField("created_at", "TIMESTAMP", mode="REQUIRED"),
        ]

    def create_table_if_not_exists(self, table_name: str, schema: List[bigquery.SchemaField]):
        """Create a BigQuery table if it doesn't exist"""
        table_id = settings.get_table_id(table_name)

        try:
            self.client.get_table(table_id)
            logger.info(f"✅ Table {table_name} already exists")
        except NotFound:
            table = bigquery.Table(table_id, schema=schema)
            table = self.client.create_table(table)
            logger.info(f"✅ Created table {table_name}")

    def setup_all_tables(self):
        """Create all curriculum authoring tables"""
        logger.info("🔧 Setting up curriculum authoring database tables...")

        tables_config = [
            (settings.TABLE_SUBJECTS, self.get_subjects_schema()),
            (settings.TABLE_UNITS, self.get_units_schema()),
            (settings.TABLE_SKILLS, self.get_skills_schema()),
            (settings.TABLE_SUBSKILLS, self.get_subskills_schema()),
            (settings.TABLE_PREREQUISITES, self.get_prerequisites_schema()),
            (settings.TABLE_VERSIONS, self.get_versions_schema()),
            (settings.TABLE_PRIMITIVES, self.get_primitives_schema()),
            (settings.TABLE_SUBSKILL_PRIMITIVES, self.get_subskill_primitives_schema()),
        ]

        for table_name, schema in tables_config:
            self.create_table_if_not_exists(table_name, schema)

        logger.info("✅ All curriculum authoring tables are ready")

    async def execute_query(self, query: str, parameters: Optional[List] = None) -> List[Dict[str, Any]]:
        """Execute a BigQuery query and return results"""
        try:
            logger.info(f"🔍 Executing query: {query[:200]}...")
            if parameters:
                logger.info(f"📝 Parameters: {parameters}")

            job_config = bigquery.QueryJobConfig()
            if parameters:
                job_config.query_parameters = parameters

            query_job = self.client.query(query, job_config=job_config)
            results = query_job.result()

            result_list = [dict(row) for row in results]
            logger.info(f"✅ Query returned {len(result_list)} rows")

            return result_list

        except Exception as e:
            logger.error(f"❌ Query execution failed: {e}")
            logger.error(f"Query: {query}")
            raise

    async def insert_rows(self, table_name: str, rows: List[Dict[str, Any]]) -> bool:
        """Insert rows into a BigQuery table"""
        try:
            table_id = settings.get_table_id(table_name)
            errors = self.client.insert_rows_json(table_id, rows)

            if errors:
                logger.error(f"Errors inserting rows into {table_name}: {errors}")
                return False

            logger.info(f"✅ Inserted {len(rows)} rows into {table_name}")
            return True

        except Exception as e:
            logger.error(f"Failed to insert rows into {table_name}: {e}")
            raise


# Global database instance
db = BigQueryDatabase()
