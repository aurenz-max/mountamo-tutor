"""
Prompt Manager Service - Manages versioned prompt templates and performance tracking

Responsibilities:
- CRUD operations for prompt templates
- Version management (only one active version per template type+name)
- Performance metrics calculation from evaluation results
- Template rendering with variable substitution
"""

import logging
import json
from uuid import uuid4
from typing import Optional, List, Dict, Any
from datetime import datetime

from app.core.database import db
from app.core.config import settings
from app.models.problems import (
    PromptTemplateCreate,
    PromptTemplateUpdate,
    PromptTemplateInDB,
    PerformanceMetrics,
    PromptTemplatePerformanceSummary
)

logger = logging.getLogger(__name__)


class PromptManagerService:
    """Manages versioned prompt templates and performance tracking"""

    async def create_template(
        self,
        template_data: PromptTemplateCreate,
        user_id: Optional[str] = None
    ) -> PromptTemplateInDB:
        """
        Create a new prompt template version.

        If a template with the same name and type exists, this creates a new version.
        Otherwise, creates version 1.

        Args:
            template_data: Template creation data
            user_id: User creating the template

        Returns:
            Created template with database fields populated
        """
        logger.info(f"📝 Creating prompt template: {template_data.template_name} ({template_data.template_type})")

        # Check if template already exists to determine version number
        existing_templates = await self._get_all_versions(
            template_data.template_name,
            template_data.template_type
        )

        if existing_templates:
            # Create next version
            max_version = max(t['version'] for t in existing_templates)
            version = max_version + 1
            logger.info(f"Creating version {version} (previous max: {max_version})")
        else:
            # First version
            version = 1
            logger.info("Creating version 1 (new template)")

        # Generate template ID
        template_id = str(uuid4())
        now = datetime.utcnow()

        # Prepare row for insertion
        row = {
            "template_id": template_id,
            "template_name": template_data.template_name,
            "template_type": template_data.template_type,
            "template_text": template_data.template_text,
            "template_variables": json.dumps(template_data.template_variables),
            "version": version,
            "is_active": template_data.is_active,
            "usage_count": 0,
            "avg_evaluation_score": None,
            "approval_rate": None,
            "performance_metrics": None,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "created_by": user_id,
            "change_notes": template_data.change_notes
        }

        # Insert into BigQuery
        success = await db.insert_rows("prompt_templates", [row])
        if not success:
            raise RuntimeError(f"Failed to insert prompt template into BigQuery")

        # If this version is active, deactivate all other versions
        if template_data.is_active:
            await self._deactivate_other_versions(
                template_data.template_name,
                template_data.template_type,
                template_id
            )

        # Return the created template
        return PromptTemplateInDB(
            template_id=template_id,
            template_name=template_data.template_name,
            template_type=template_data.template_type,
            template_text=template_data.template_text,
            template_variables=template_data.template_variables,
            version=version,
            is_active=template_data.is_active,
            usage_count=0,
            performance_metrics=None,
            created_at=now,
            updated_at=now,
            created_by=user_id,
            change_notes=template_data.change_notes
        )

    async def update_template(
        self,
        template_id: str,
        updates: PromptTemplateUpdate,
        user_id: Optional[str] = None
    ) -> PromptTemplateInDB:
        """
        Update an existing prompt template.

        Note: Updates modify the existing version. To create a new version,
        use create_template() instead.

        Args:
            template_id: Template to update
            updates: Fields to update
            user_id: User making the update

        Returns:
            Updated template
        """
        logger.info(f"✏️ Updating prompt template: {template_id}")

        # Get current template
        current = await self.get_template(template_id)
        if not current:
            raise ValueError(f"Template {template_id} not found")

        # Build UPDATE statement for changed fields
        update_fields = []
        update_values = []

        if updates.template_text is not None:
            update_fields.append("template_text = ?")
            update_values.append(updates.template_text)

        if updates.template_variables is not None:
            update_fields.append("template_variables = ?")
            update_values.append(json.dumps(updates.template_variables))

        if updates.change_notes is not None:
            update_fields.append("change_notes = ?")
            update_values.append(updates.change_notes)

        # Always update timestamp
        update_fields.append("updated_at = ?")
        update_values.append(datetime.utcnow().isoformat())

        if not update_fields:
            logger.info("No fields to update")
            return current

        # BigQuery doesn't support UPDATE via insert_rows_json, so we need to:
        # 1. Delete the old row (not ideal but necessary for this architecture)
        # 2. Insert updated row
        # For production, consider using MERGE or UPDATE DML statements

        # For now, we'll use a workaround: INSERT a new version or use DML UPDATE
        # Let's use DML UPDATE via execute_query

        table_id = settings.get_table_id("prompt_templates")

        # Build parameterized UPDATE query
        set_clause = ", ".join([
            f"{field.split(' = ?')[0]} = @val{i}"
            for i, field in enumerate(update_fields)
        ])

        query = f"""
        UPDATE `{table_id}`
        SET {set_clause}
        WHERE template_id = @template_id
        """

        # Create query parameters
        from google.cloud import bigquery
        query_params = [
            bigquery.ScalarQueryParameter(f"val{i}", "STRING", val)
            for i, val in enumerate(update_values)
        ]
        query_params.append(
            bigquery.ScalarQueryParameter("template_id", "STRING", template_id)
        )

        # Execute UPDATE
        job_config = bigquery.QueryJobConfig(query_parameters=query_params)
        query_job = db.client.query(query, job_config=job_config)
        query_job.result()  # Wait for completion

        logger.info(f"✅ Updated template {template_id}")

        # Handle is_active update separately (requires deactivating others)
        if updates.is_active is not None and updates.is_active != current.is_active:
            if updates.is_active:
                await self._deactivate_other_versions(
                    current.template_name,
                    current.template_type,
                    template_id
                )
                # Update this template's is_active
                query = f"""
                UPDATE `{table_id}`
                SET is_active = TRUE
                WHERE template_id = @template_id
                """
                job_config = bigquery.QueryJobConfig(
                    query_parameters=[
                        bigquery.ScalarQueryParameter("template_id", "STRING", template_id)
                    ]
                )
                query_job = db.client.query(query, job_config=job_config)
                query_job.result()

        # Fetch and return updated template
        return await self.get_template(template_id)

    async def activate_version(
        self,
        template_id: str
    ) -> PromptTemplateInDB:
        """
        Activate a specific template version.
        Automatically deactivates all other versions of the same template.

        Args:
            template_id: Template version to activate

        Returns:
            Activated template
        """
        logger.info(f"🔄 Activating template version: {template_id}")

        # Get the template to activate
        template = await self.get_template(template_id)
        if not template:
            raise ValueError(f"Template {template_id} not found")

        # Deactivate all other versions
        await self._deactivate_other_versions(
            template.template_name,
            template.template_type,
            template_id
        )

        # Activate this version
        table_id = settings.get_table_id("prompt_templates")
        query = f"""
        UPDATE `{table_id}`
        SET is_active = TRUE, updated_at = @updated_at
        WHERE template_id = @template_id
        """

        from google.cloud import bigquery
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("template_id", "STRING", template_id),
                bigquery.ScalarQueryParameter("updated_at", "TIMESTAMP", datetime.utcnow())
            ]
        )
        query_job = db.client.query(query, job_config=job_config)
        query_job.result()

        logger.info(f"✅ Activated template {template_id}")

        return await self.get_template(template_id)

    async def get_active_template(
        self,
        template_name: str,
        template_type: str
    ) -> Optional[PromptTemplateInDB]:
        """
        Get the currently active version of a template.

        Args:
            template_name: Template name
            template_type: Template type

        Returns:
            Active template or None if no active version exists
        """
        table_id = settings.get_table_id("prompt_templates")
        query = f"""
        SELECT *
        FROM `{table_id}`
        WHERE template_name = @template_name
          AND template_type = @template_type
          AND is_active = TRUE
        LIMIT 1
        """

        from google.cloud import bigquery
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("template_name", "STRING", template_name),
                bigquery.ScalarQueryParameter("template_type", "STRING", template_type)
            ]
        )
        query_job = db.client.query(query, job_config=job_config)
        results = list(query_job.result())

        if not results:
            logger.warning(f"No active template found: {template_name} ({template_type})")
            return None

        row = dict(results[0])
        return self._row_to_template(row)

    async def get_template(
        self,
        template_id: str
    ) -> Optional[PromptTemplateInDB]:
        """
        Get a specific template by ID.

        Args:
            template_id: Template identifier

        Returns:
            Template or None if not found
        """
        table_id = settings.get_table_id("prompt_templates")
        query = f"""
        SELECT *
        FROM `{table_id}`
        WHERE template_id = @template_id
        LIMIT 1
        """

        from google.cloud import bigquery
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("template_id", "STRING", template_id)
            ]
        )
        query_job = db.client.query(query, job_config=job_config)
        results = list(query_job.result())

        if not results:
            return None

        row = dict(results[0])
        return self._row_to_template(row)

    async def list_templates(
        self,
        template_type: Optional[str] = None,
        template_name: Optional[str] = None,
        active_only: bool = False
    ) -> List[PromptTemplateInDB]:
        """
        List all templates with optional filtering.

        Args:
            template_type: Filter by template type
            template_name: Filter by template name
            active_only: Only return active versions

        Returns:
            List of templates
        """
        table_id = settings.get_table_id("prompt_templates")

        # Build WHERE clause
        where_clauses = []
        if template_type:
            where_clauses.append(f"template_type = '{template_type}'")
        if template_name:
            where_clauses.append(f"template_name = '{template_name}'")
        if active_only:
            where_clauses.append("is_active = TRUE")

        where_clause = " AND ".join(where_clauses) if where_clauses else "TRUE"

        query = f"""
        SELECT *
        FROM `{table_id}`
        WHERE {where_clause}
        ORDER BY template_name, version DESC
        """

        results = await db.execute_query(query)
        return [self._row_to_template(row) for row in results]

    async def calculate_performance_metrics(
        self,
        template_id: str
    ) -> PerformanceMetrics:
        """
        Calculate performance metrics for a template based on evaluation results.

        Metrics calculated:
        - Average evaluation scores across all dimensions
        - Approval/revision/rejection rates
        - Total generations using this template

        Args:
            template_id: Template to calculate metrics for

        Returns:
            Performance metrics
        """
        logger.info(f"📊 Calculating performance metrics for template: {template_id}")

        # Get template to find its creation date (to filter evaluations)
        template = await self.get_template(template_id)
        if not template:
            raise ValueError(f"Template {template_id} not found")

        # Query problem evaluations that used this template
        # Note: This assumes generation_prompt field links back to template
        # In practice, you'd want a template_id field in the problems/evaluations table

        problems_table = settings.get_table_id("curriculum_problems")
        evals_table = settings.get_table_id("problem_evaluations")

        query = f"""
        SELECT
            COUNT(*) as total_generations,
            AVG(e.overall_score) as avg_score,
            AVG(e.pedagogical_approach_score) as avg_pedagogical,
            AVG(e.alignment_score) as avg_alignment,
            AVG(e.clarity_score) as avg_clarity,
            AVG(e.correctness_score) as avg_correctness,
            AVG(e.bias_score) as avg_bias,
            SUM(CASE WHEN e.final_recommendation = 'approve' THEN 1 ELSE 0 END) as approvals,
            SUM(CASE WHEN e.final_recommendation = 'revise' THEN 1 ELSE 0 END) as revisions,
            SUM(CASE WHEN e.final_recommendation = 'reject' THEN 1 ELSE 0 END) as rejections
        FROM `{problems_table}` p
        JOIN `{evals_table}` e ON p.problem_id = e.problem_id
        WHERE p.generation_prompt = @template_text
          AND p.generation_timestamp >= @created_at
        """

        from google.cloud import bigquery
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("template_text", "STRING", template.template_text),
                bigquery.ScalarQueryParameter("created_at", "TIMESTAMP", template.created_at)
            ]
        )
        query_job = db.client.query(query, job_config=job_config)
        results = list(query_job.result())

        if not results or results[0]['total_generations'] == 0:
            logger.info("No evaluations found for this template")
            return PerformanceMetrics()

        row = dict(results[0])

        total_gens = row['total_generations']
        approvals = row['approvals']

        metrics = PerformanceMetrics(
            avg_evaluation_score=float(row['avg_score']) if row['avg_score'] else None,
            approval_rate=float(approvals / total_gens) if total_gens > 0 else 0.0,
            avg_pedagogical_score=float(row['avg_pedagogical']) if row['avg_pedagogical'] else None,
            avg_alignment_score=float(row['avg_alignment']) if row['avg_alignment'] else None,
            avg_clarity_score=float(row['avg_clarity']) if row['avg_clarity'] else None,
            avg_correctness_score=float(row['avg_correctness']) if row['avg_correctness'] else None,
            avg_bias_score=float(row['avg_bias']) if row['avg_bias'] else None,
            total_generations=int(total_gens),
            total_approvals=int(row['approvals']),
            total_revisions=int(row['revisions']),
            total_rejections=int(row['rejections'])
        )

        logger.info(f"✅ Metrics: {metrics.total_generations} generations, {metrics.approval_rate:.1%} approval rate")

        return metrics

    def render_template(
        self,
        template: PromptTemplateInDB,
        variables: Dict[str, Any]
    ) -> str:
        """
        Render a template with variable substitution.

        Uses Python format strings for substitution.

        Args:
            template: Template to render
            variables: Variable values (must include all required variables)

        Returns:
            Rendered prompt text

        Raises:
            ValueError: If required variables are missing
        """
        # Check all required variables are provided
        missing = set(template.template_variables) - set(variables.keys())
        if missing:
            raise ValueError(f"Missing required variables: {missing}")

        # Render using format strings
        try:
            rendered = template.template_text.format(**variables)
            logger.debug(f"Rendered template {template.template_name} with {len(variables)} variables")
            return rendered
        except KeyError as e:
            raise ValueError(f"Variable {e} referenced in template but not provided")
        except Exception as e:
            raise ValueError(f"Template rendering failed: {e}")

    # Private helper methods

    async def _get_all_versions(
        self,
        template_name: str,
        template_type: str
    ) -> List[Dict[str, Any]]:
        """Get all versions of a template"""
        table_id = settings.get_table_id("prompt_templates")
        query = f"""
        SELECT *
        FROM `{table_id}`
        WHERE template_name = @template_name
          AND template_type = @template_type
        ORDER BY version DESC
        """

        from google.cloud import bigquery
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("template_name", "STRING", template_name),
                bigquery.ScalarQueryParameter("template_type", "STRING", template_type)
            ]
        )
        query_job = db.client.query(query, job_config=job_config)
        return [dict(row) for row in query_job.result()]

    async def _deactivate_other_versions(
        self,
        template_name: str,
        template_type: str,
        except_template_id: str
    ):
        """Deactivate all versions except the specified one"""
        table_id = settings.get_table_id("prompt_templates")
        query = f"""
        UPDATE `{table_id}`
        SET is_active = FALSE, updated_at = @updated_at
        WHERE template_name = @template_name
          AND template_type = @template_type
          AND template_id != @except_template_id
          AND is_active = TRUE
        """

        from google.cloud import bigquery
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("template_name", "STRING", template_name),
                bigquery.ScalarQueryParameter("template_type", "STRING", template_type),
                bigquery.ScalarQueryParameter("except_template_id", "STRING", except_template_id),
                bigquery.ScalarQueryParameter("updated_at", "TIMESTAMP", datetime.utcnow())
            ]
        )
        query_job = db.client.query(query, job_config=job_config)
        result = query_job.result()

        logger.info(f"Deactivated other versions of {template_name} ({template_type})")

    def _row_to_template(self, row: Dict[str, Any]) -> PromptTemplateInDB:
        """Convert BigQuery row to PromptTemplateInDB"""
        # Parse JSON fields
        template_variables = json.loads(row['template_variables']) if isinstance(row['template_variables'], str) else row['template_variables']
        performance_metrics = json.loads(row['performance_metrics']) if row.get('performance_metrics') and isinstance(row['performance_metrics'], str) else None

        return PromptTemplateInDB(
            template_id=row['template_id'],
            template_name=row['template_name'],
            template_type=row['template_type'],
            template_text=row['template_text'],
            template_variables=template_variables,
            version=int(row['version']),
            is_active=bool(row['is_active']),
            usage_count=int(row.get('usage_count', 0)),
            performance_metrics=PerformanceMetrics(**performance_metrics) if performance_metrics else None,
            created_at=row['created_at'],
            updated_at=row['updated_at'],
            created_by=row.get('created_by'),
            change_notes=row.get('change_notes')
        )


# Singleton instance
prompt_manager_service = PromptManagerService()
