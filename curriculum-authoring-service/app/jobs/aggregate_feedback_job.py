"""
Aggregate Feedback Job - Background job for automated feedback aggregation

Responsibilities:
- Trigger after batch evaluations complete
- Run feedback aggregation for all affected templates
- Update prompt_performance_metrics table
- Can be triggered manually or on a schedule
"""

import logging
from typing import List, Optional
from datetime import datetime, timedelta

from app.core.database import db
from app.core.config import settings
from app.services.feedback_aggregator_service import feedback_aggregator_service
from app.services.prompt_manager_service import prompt_manager_service

logger = logging.getLogger(__name__)


class AggregateFeedbackJob:
    """Background job for aggregating feedback across problem evaluations"""

    async def run_for_template(
        self,
        template_id: str,
        min_evaluations: int = 3
    ) -> bool:
        """
        Run feedback aggregation for a single template.

        Args:
            template_id: Template to aggregate feedback for
            min_evaluations: Minimum evaluations required

        Returns:
            Success status
        """
        logger.info(f"🔄 Running feedback aggregation job for template: {template_id}")

        try:
            feedback_report = await feedback_aggregator_service.aggregate_template_feedback(
                template_id,
                min_evaluations=min_evaluations
            )

            logger.info(
                f"✅ Feedback aggregation complete for {template_id}: "
                f"{len(feedback_report['feedback_themes'].get('themes', []))} themes identified"
            )

            return True

        except ValueError as e:
            # Expected errors (insufficient data, etc.)
            logger.info(f"ℹ️ Skipping template {template_id}: {str(e)}")
            return False

        except Exception as e:
            logger.error(f"❌ Feedback aggregation failed for {template_id}: {str(e)}")
            return False

    async def run_for_all_templates(
        self,
        min_evaluations: int = 3,
        only_active: bool = False
    ) -> dict:
        """
        Run feedback aggregation for all templates.

        Args:
            min_evaluations: Minimum evaluations required per template
            only_active: Only process active template versions

        Returns:
            Summary of aggregation results
        """
        logger.info(f"🔄 Running feedback aggregation job for all templates")

        # Get all templates
        templates = await prompt_manager_service.list_templates(
            active_only=only_active
        )

        logger.info(f"Found {len(templates)} templates to process")

        results = {
            "total_templates": len(templates),
            "successful": 0,
            "skipped": 0,
            "failed": 0,
            "processed_templates": []
        }

        for template in templates:
            try:
                success = await self.run_for_template(
                    template.template_id,
                    min_evaluations=min_evaluations
                )

                if success:
                    results["successful"] += 1
                    results["processed_templates"].append(template.template_id)
                else:
                    results["skipped"] += 1

            except Exception as e:
                logger.error(f"❌ Error processing template {template.template_id}: {str(e)}")
                results["failed"] += 1

        logger.info(
            f"✅ Feedback aggregation job complete: "
            f"{results['successful']} successful, "
            f"{results['skipped']} skipped, "
            f"{results['failed']} failed"
        )

        return results

    async def run_for_recently_evaluated_templates(
        self,
        hours: int = 24,
        min_evaluations: int = 3
    ) -> dict:
        """
        Run feedback aggregation for templates with recent evaluations.

        Args:
            hours: Look back this many hours for new evaluations
            min_evaluations: Minimum evaluations required

        Returns:
            Summary of aggregation results
        """
        logger.info(
            f"🔄 Running feedback aggregation for templates with evaluations "
            f"in last {hours} hours"
        )

        # Find templates used in recent problem generations
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)

        problems_table = settings.get_table_id("curriculum_problems")
        templates_table = settings.get_table_id("prompt_templates")

        query = f"""
        SELECT DISTINCT
            pt.template_id,
            pt.template_name,
            COUNT(DISTINCT p.problem_id) as recent_problems
        FROM `{problems_table}` p
        JOIN `{templates_table}` pt
            ON p.generation_prompt = pt.template_text
        WHERE p.generation_timestamp >= @cutoff_time
        GROUP BY pt.template_id, pt.template_name
        HAVING COUNT(DISTINCT p.problem_id) >= @min_evaluations
        ORDER BY recent_problems DESC
        """

        from google.cloud import bigquery
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("cutoff_time", "TIMESTAMP", cutoff_time),
                bigquery.ScalarQueryParameter("min_evaluations", "INT64", min_evaluations)
            ]
        )

        query_job = db.client.query(query, job_config=job_config)
        templates_to_process = list(query_job.result())

        logger.info(
            f"Found {len(templates_to_process)} templates with recent evaluations"
        )

        results = {
            "total_templates": len(templates_to_process),
            "successful": 0,
            "skipped": 0,
            "failed": 0,
            "processed_templates": []
        }

        for row in templates_to_process:
            template_id = row['template_id']
            template_name = row['template_name']
            recent_problems = row['recent_problems']

            logger.info(
                f"Processing {template_name} ({template_id}) - "
                f"{recent_problems} recent problems"
            )

            try:
                success = await self.run_for_template(
                    template_id,
                    min_evaluations=min_evaluations
                )

                if success:
                    results["successful"] += 1
                    results["processed_templates"].append({
                        "template_id": template_id,
                        "template_name": template_name,
                        "recent_problems": recent_problems
                    })
                else:
                    results["skipped"] += 1

            except Exception as e:
                logger.error(f"❌ Error processing template {template_id}: {str(e)}")
                results["failed"] += 1

        logger.info(
            f"✅ Recent evaluation aggregation complete: "
            f"{results['successful']} successful, "
            f"{results['skipped']} skipped, "
            f"{results['failed']} failed"
        )

        return results

    async def run_after_batch_evaluation(
        self,
        subskill_id: str,
        version_id: str
    ) -> dict:
        """
        Run feedback aggregation after a batch of problems was evaluated.

        This is the main integration point - call this after batch_evaluate()
        completes in ProblemEvaluationService.

        Args:
            subskill_id: Subskill that was evaluated
            version_id: Version ID

        Returns:
            Summary of aggregation results
        """
        logger.info(
            f"🔄 Running post-evaluation feedback aggregation for "
            f"{subskill_id} (version {version_id})"
        )

        # Find template(s) used for this subskill's problems
        problems_table = settings.get_table_id("curriculum_problems")
        templates_table = settings.get_table_id("prompt_templates")

        query = f"""
        SELECT DISTINCT
            pt.template_id,
            pt.template_name,
            COUNT(DISTINCT p.problem_id) as problem_count
        FROM `{problems_table}` p
        JOIN `{templates_table}` pt
            ON p.generation_prompt = pt.template_text
        WHERE p.subskill_id = @subskill_id
          AND p.version_id = @version_id
        GROUP BY pt.template_id, pt.template_name
        """

        from google.cloud import bigquery
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("subskill_id", "STRING", subskill_id),
                bigquery.ScalarQueryParameter("version_id", "STRING", version_id)
            ]
        )

        query_job = db.client.query(query, job_config=job_config)
        templates = list(query_job.result())

        if not templates:
            logger.info(f"No templates found for {subskill_id}")
            return {
                "total_templates": 0,
                "successful": 0,
                "skipped": 0,
                "failed": 0,
                "processed_templates": []
            }

        results = {
            "total_templates": len(templates),
            "successful": 0,
            "skipped": 0,
            "failed": 0,
            "processed_templates": []
        }

        for row in templates:
            template_id = row['template_id']
            template_name = row['template_name']
            problem_count = row['problem_count']

            logger.info(
                f"Processing {template_name} ({template_id}) - "
                f"{problem_count} problems"
            )

            try:
                success = await self.run_for_template(
                    template_id,
                    min_evaluations=1  # Lower threshold for batch context
                )

                if success:
                    results["successful"] += 1
                    results["processed_templates"].append({
                        "template_id": template_id,
                        "template_name": template_name,
                        "problem_count": problem_count
                    })
                else:
                    results["skipped"] += 1

            except Exception as e:
                logger.error(f"❌ Error processing template {template_id}: {str(e)}")
                results["failed"] += 1

        logger.info(
            f"✅ Post-batch feedback aggregation complete: "
            f"{results['successful']} successful, "
            f"{results['skipped']} skipped, "
            f"{results['failed']} failed"
        )

        return results


# Singleton instance
aggregate_feedback_job = AggregateFeedbackJob()
