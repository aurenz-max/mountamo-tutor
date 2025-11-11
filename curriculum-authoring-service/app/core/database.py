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

    def get_subskill_foundations_schema(self) -> List[bigquery.SchemaField]:
        """Schema for curriculum_subskill_foundations table (AI-generated foundational content)"""
        return [
            bigquery.SchemaField("subskill_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("version_id", "STRING", mode="REQUIRED"),
            # Master Context stored as JSON
            bigquery.SchemaField("master_context", "JSON", mode="NULLABLE"),
            # Context Primitives stored as JSON
            bigquery.SchemaField("context_primitives", "JSON", mode="NULLABLE"),
            # Approved Visual Schemas stored as array of strings
            bigquery.SchemaField("approved_visual_schemas", "STRING", mode="REPEATED"),
            # Metadata
            bigquery.SchemaField("generation_status", "STRING", mode="REQUIRED"),  # 'pending' | 'generated' | 'edited'
            bigquery.SchemaField("is_draft", "BOOLEAN", mode="REQUIRED"),
            bigquery.SchemaField("created_at", "TIMESTAMP", mode="REQUIRED"),
            bigquery.SchemaField("updated_at", "TIMESTAMP", mode="REQUIRED"),
            bigquery.SchemaField("last_edited_by", "STRING", mode="NULLABLE"),
        ]

    def get_reading_content_schema(self) -> List[bigquery.SchemaField]:
        """
        Schema for subskill_reading_content table (AI-generated reading content sections).

        Stores reading content sections with interactive primitives for each subskill.
        Table is partitioned by DATE(created_at) and clustered by subskill_id, version_id
        for efficient querying by subskill and time range.
        """
        return [
            # Identifiers
            bigquery.SchemaField("subskill_id", "STRING", mode="REQUIRED", description="Subskill identifier"),
            bigquery.SchemaField("version_id", "STRING", mode="REQUIRED", description="Version identifier"),
            bigquery.SchemaField("section_id", "STRING", mode="REQUIRED", description="Unique section identifier"),
            bigquery.SchemaField("section_order", "INTEGER", mode="REQUIRED", description="Order of section in content"),
            # Content
            bigquery.SchemaField("title", "STRING", mode="REQUIRED", description="Title of the reading content package"),
            bigquery.SchemaField("heading", "STRING", mode="REQUIRED", description="Section heading"),
            bigquery.SchemaField("content_text", "STRING", mode="REQUIRED", description="Main section content text"),
            bigquery.SchemaField("key_terms", "STRING", mode="REPEATED", description="Key terms used in this section"),
            bigquery.SchemaField("concepts_covered", "STRING", mode="REPEATED", description="Core concepts covered"),
            # Interactive primitives stored as JSON array
            # Supports: alerts, expandables, quizzes, definitions, checklists, tables, keyvalues,
            # interactive_timelines, carousels, flip_cards, categorization_activities,
            # fill_in_the_blanks, scenario_questions, tabbed_content, matching_activities,
            # sequencing_activities, accordions
            bigquery.SchemaField("interactive_primitives", "JSON", mode="NULLABLE", description="Array of interactive learning primitives"),
            # Visual snippet reference
            bigquery.SchemaField("has_visual_snippet", "BOOLEAN", mode="NULLABLE", description="Whether section has associated visual snippet"),
            # Status and metadata
            bigquery.SchemaField("generation_status", "STRING", mode="NULLABLE", description="Generation status: pending, generated, edited"),
            bigquery.SchemaField("is_draft", "BOOLEAN", mode="NULLABLE", description="Whether content is in draft state"),
            bigquery.SchemaField("created_at", "TIMESTAMP", mode="REQUIRED", description="Timestamp of creation"),
            bigquery.SchemaField("updated_at", "TIMESTAMP", mode="REQUIRED", description="Timestamp of last update"),
            bigquery.SchemaField("last_edited_by", "STRING", mode="NULLABLE", description="User who last edited the content"),
        ]

    def get_visual_snippets_schema(self) -> List[bigquery.SchemaField]:
        """
        Schema for visual_snippets table (HTML visual content for reading sections).

        Stores interactive HTML visual snippets that accompany reading content sections.
        Table is partitioned by DATE(created_at) and clustered by subskill_id, section_id
        for efficient retrieval of visuals for specific sections.
        """
        return [
            # Identifiers
            bigquery.SchemaField("snippet_id", "STRING", mode="REQUIRED", description="Unique snippet identifier"),
            bigquery.SchemaField("subskill_id", "STRING", mode="REQUIRED", description="Associated subskill identifier"),
            bigquery.SchemaField("section_id", "STRING", mode="REQUIRED", description="Associated section identifier"),
            # Content
            bigquery.SchemaField("html_content", "STRING", mode="REQUIRED", description="Complete HTML file with embedded CSS/JS"),
            bigquery.SchemaField("generation_prompt", "STRING", mode="NULLABLE", description="Prompt used to generate this visual"),
            # Metadata
            bigquery.SchemaField("created_at", "TIMESTAMP", mode="REQUIRED", description="Timestamp of creation"),
            bigquery.SchemaField("updated_at", "TIMESTAMP", mode="REQUIRED", description="Timestamp of last update"),
            bigquery.SchemaField("last_edited_by", "STRING", mode="NULLABLE", description="User who last edited the snippet"),
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

    def _setup_content_table_optimizations(self):
        """
        Setup partitioning and clustering for content tables.

        Note: BigQuery table partitioning and clustering cannot be added after table creation
        via the Python client. These optimizations are best applied during initial table creation
        using SQL DDL statements (see docs/bigquery_content_tables.sql).

        This method exists as a placeholder for future optimization logic and serves as
        documentation that these tables should be partitioned and clustered.

        Recommended optimizations (apply via SQL):
        - subskill_reading_content: PARTITION BY DATE(created_at), CLUSTER BY subskill_id, version_id
        - visual_snippets: PARTITION BY DATE(created_at), CLUSTER BY subskill_id, section_id
        """
        logger.info("📊 Content table partitioning/clustering should be configured via SQL DDL")
        logger.info("   See docs/bigquery_content_tables.sql for recommended optimizations")

        # Future: Could add logic here to check if tables have proper partitioning
        # and warn if they don't, or to recreate tables with proper settings if needed

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
            (settings.TABLE_SUBSKILL_FOUNDATIONS, self.get_subskill_foundations_schema()),
            (settings.TABLE_READING_CONTENT, self.get_reading_content_schema()),
            (settings.TABLE_VISUAL_SNIPPETS, self.get_visual_snippets_schema()),
        ]

        for table_name, schema in tables_config:
            self.create_table_if_not_exists(table_name, schema)

        # Setup partitioning and clustering for content tables
        self._setup_content_table_optimizations()

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

    async def get_all_visual_schemas_with_metadata(self) -> List[Dict[str, Any]]:
        """
        Fetch all visual schemas with their metadata from curriculum_primitives table.
        Returns list of schemas with fields: primitive_id, primitive_name, category,
        best_for, avoid_for, example
        """
        try:
            query = f"""
            SELECT
                primitive_id,
                primitive_name,
                category,
                best_for,
                avoid_for,
                example
            FROM `{settings.get_table_id(settings.TABLE_PRIMITIVES)}`
            ORDER BY category, primitive_id
            """

            results = await self.execute_query(query)
            logger.info(f"✅ Retrieved {len(results)} visual schemas with metadata")
            return results

        except Exception as e:
            logger.error(f"❌ Failed to fetch visual schemas metadata: {e}")
            # Return empty list as fallback
            return []


# Global database instance
db = BigQueryDatabase()
