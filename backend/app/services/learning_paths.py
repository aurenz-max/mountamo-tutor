# app/services/learning_paths.py

import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, List, Optional, Any, Set, Tuple
from datetime import datetime

from google.cloud import bigquery
from google.cloud.exceptions import NotFound

logger = logging.getLogger(__name__)


class LearningPathsService:
    """
    Learning paths service using BigQuery-backed prerequisite graph system.

    This service manages skill/subskill dependencies and unlocks using the
    curriculum_prerequisites table, which supports:
    - Subskill → Subskill unlocks
    - Skill → Skill unlocks
    - Skill → Subskill unlocks (unlocking all subskills in target skill)
    - Multiple AND prerequisites for a single unlock
    - Proficiency thresholds per prerequisite (0.8, 0.9, etc.)
    """

    def __init__(
        self,
        analytics_service: Any,  # BigQueryAnalyticsService
        firestore_service: Any,  # FirestoreService
        project_id: str,
        dataset_id: str = "analytics"
    ):
        """
        Initialize learning paths service

        Args:
            analytics_service: BigQueryAnalyticsService for student proficiency queries
            firestore_service: FirestoreService for curriculum graph access
            project_id: Google Cloud project ID
            dataset_id: BigQuery dataset ID (default: "analytics")
        """
        self.analytics = analytics_service
        self.firestore = firestore_service
        self.project_id = project_id
        self.dataset_id = dataset_id
        self.client = bigquery.Client(project=project_id)
        self.executor = ThreadPoolExecutor(max_workers=4)

        # Default threshold for mastery
        self.DEFAULT_MASTERY_THRESHOLD = 0.8

        logger.info(f"Initialized LearningPathsService for {project_id}.{dataset_id}")

    # ==================== Core Prerequisite Methods ====================

    async def get_entity_proficiency(
        self,
        student_id: int,
        entity_id: str,
        entity_type: str
    ) -> float:
        """
        Get student proficiency for a skill or subskill

        Args:
            student_id: Student ID
            entity_id: Skill or subskill ID
            entity_type: "skill" or "subskill"

        Returns:
            Proficiency score (0.0 to 1.0)
        """
        try:
            if entity_type == "subskill":
                # Query attempts table for specific subskill
                query = f"""
                SELECT AVG(score / 10.0) as proficiency
                FROM `{self.project_id}.{self.dataset_id}.attempts`
                WHERE student_id = @student_id
                  AND subskill_id = @entity_id
                """

                parameters = [
                    bigquery.ScalarQueryParameter("student_id", "INT64", student_id),
                    bigquery.ScalarQueryParameter("entity_id", "STRING", entity_id)
                ]

            elif entity_type == "skill":
                # Query all subskills in skill and average
                query = f"""
                WITH skill_subskills AS (
                  SELECT DISTINCT subskill_id
                  FROM `{self.project_id}.{self.dataset_id}.curriculum`
                  WHERE skill_id = @entity_id
                ),
                subskill_proficiencies AS (
                  SELECT
                    a.subskill_id,
                    AVG(a.score / 10.0) as proficiency
                  FROM `{self.project_id}.{self.dataset_id}.attempts` a
                  INNER JOIN skill_subskills ss ON a.subskill_id = ss.subskill_id
                  WHERE a.student_id = @student_id
                  GROUP BY a.subskill_id
                )
                SELECT AVG(proficiency) as proficiency
                FROM subskill_proficiencies
                """

                parameters = [
                    bigquery.ScalarQueryParameter("student_id", "INT64", student_id),
                    bigquery.ScalarQueryParameter("entity_id", "STRING", entity_id)
                ]
            else:
                raise ValueError(f"Invalid entity_type: {entity_type}. Must be 'skill' or 'subskill'")

            results = await self._run_query_async(query, parameters)

            if results and results[0].get('proficiency') is not None:
                return float(results[0]['proficiency'])
            else:
                return 0.0

        except Exception as e:
            logger.error(f"Error getting proficiency for {entity_type} {entity_id}: {e}")
            return 0.0

    async def check_prerequisites_met(
        self,
        student_id: int,
        target_entity_id: str,
        target_entity_type: str
    ) -> Dict[str, Any]:
        """
        Check if ALL prerequisites are met for a target entity

        Args:
            student_id: Student ID
            target_entity_id: Target skill or subskill ID
            target_entity_type: "skill" or "subskill"

        Returns:
            {
                "unlocked": bool,
                "prerequisites": [
                    {
                        "prerequisite_id": str,
                        "prerequisite_type": str,
                        "required_threshold": float,
                        "current_proficiency": float,
                        "met": bool
                    }
                ]
            }
        """
        try:
            query = f"""
            SELECT
              cp.prerequisite_entity_id,
              cp.prerequisite_entity_type,
              cp.min_proficiency_threshold
            FROM `{self.project_id}.{self.dataset_id}.curriculum_prerequisites` cp
            WHERE cp.unlocks_entity_id = @target_entity_id
              AND cp.unlocks_entity_type = @target_entity_type
              AND cp.is_draft = FALSE
            """

            parameters = [
                bigquery.ScalarQueryParameter("target_entity_id", "STRING", target_entity_id),
                bigquery.ScalarQueryParameter("target_entity_type", "STRING", target_entity_type)
            ]

            prerequisite_rows = await self._run_query_async(query, parameters)

            # If no prerequisites, entity is unlocked by default
            if not prerequisite_rows:
                return {
                    "unlocked": True,
                    "prerequisites": []
                }

            # Check each prerequisite
            prerequisite_checks = []
            all_met = True

            for row in prerequisite_rows:
                prerequisite_id = row['prerequisite_entity_id']
                prerequisite_type = row['prerequisite_entity_type']
                required_threshold = float(row['min_proficiency_threshold'])

                current_proficiency = await self.get_entity_proficiency(
                    student_id,
                    prerequisite_id,
                    prerequisite_type
                )

                met = current_proficiency >= required_threshold
                if not met:
                    all_met = False

                prerequisite_checks.append({
                    "prerequisite_id": prerequisite_id,
                    "prerequisite_type": prerequisite_type,
                    "required_threshold": required_threshold,
                    "current_proficiency": current_proficiency,
                    "met": met
                })

            return {
                "unlocked": all_met,
                "prerequisites": prerequisite_checks
            }

        except Exception as e:
            logger.error(f"Error checking prerequisites for {target_entity_type} {target_entity_id}: {e}")
            raise

    async def get_unlocked_entities(
        self,
        student_id: int,
        entity_type: Optional[str] = None,
        subject: Optional[str] = None
    ) -> Set[str]:
        """
        Get all entities (skills/subskills) currently unlocked for student

        This handles:
        - Entities with no prerequisites (always unlocked)
        - Entities where ALL prerequisites meet thresholds
        - Skill → Subskill unlocks (if skill unlocked, all subskills available)

        Args:
            student_id: Student ID
            entity_type: Filter by "skill" or "subskill" (None = both)
            subject: Filter by subject

        Returns:
            Set of unlocked entity IDs
        """
        try:
            query = f"""
            WITH student_proficiencies AS (
              -- Subskill proficiencies
              SELECT
                subskill_id as entity_id,
                'subskill' as entity_type,
                AVG(score / 10.0) as proficiency
              FROM `{self.project_id}.{self.dataset_id}.attempts`
              WHERE student_id = @student_id
              GROUP BY subskill_id

              UNION ALL

              -- Skill proficiencies (average of all subskills in skill)
              SELECT
                c.skill_id as entity_id,
                'skill' as entity_type,
                AVG(COALESCE(sp.proficiency, 0)) as proficiency
              FROM `{self.project_id}.{self.dataset_id}.curriculum` c
              LEFT JOIN (
                SELECT
                  subskill_id,
                  AVG(score / 10.0) as proficiency
                FROM `{self.project_id}.{self.dataset_id}.attempts`
                WHERE student_id = @student_id
                GROUP BY subskill_id
              ) sp ON c.subskill_id = sp.subskill_id
              GROUP BY c.skill_id
            ),
            prerequisite_checks AS (
              SELECT
                cp.unlocks_entity_id,
                cp.unlocks_entity_type,
                cp.prerequisite_entity_id,
                cp.prerequisite_entity_type,
                cp.min_proficiency_threshold,
                COALESCE(sp.proficiency, 0) as current_proficiency,
                CASE
                  WHEN COALESCE(sp.proficiency, 0) >= cp.min_proficiency_threshold
                  THEN TRUE
                  ELSE FALSE
                END as prerequisite_met
              FROM `{self.project_id}.{self.dataset_id}.curriculum_prerequisites` cp
              LEFT JOIN student_proficiencies sp
                ON cp.prerequisite_entity_id = sp.entity_id
                AND cp.prerequisite_entity_type = sp.entity_type
              WHERE cp.is_draft = FALSE
                AND (@entity_type IS NULL OR cp.unlocks_entity_type = @entity_type)
                AND (
                  @subject IS NULL
                  OR EXISTS (
                    SELECT 1 FROM `{self.project_id}.{self.dataset_id}.curriculum` c
                    WHERE c.skill_id = cp.unlocks_entity_id
                      AND c.subject = @subject
                  )
                  OR EXISTS (
                    SELECT 1 FROM `{self.project_id}.{self.dataset_id}.curriculum` c
                    WHERE c.subskill_id = cp.unlocks_entity_id
                      AND c.subject = @subject
                  )
                )
            ),
            entities_with_met_prerequisites AS (
              -- Entities where ALL prerequisites are met
              SELECT DISTINCT unlocks_entity_id as entity_id
              FROM prerequisite_checks
              GROUP BY unlocks_entity_id
              HAVING LOGICAL_AND(prerequisite_met) = TRUE
            ),
            entities_without_prerequisites AS (
              -- Entities with no prerequisites (always unlocked)
              SELECT DISTINCT
                CASE
                  WHEN @entity_type = 'skill' OR @entity_type IS NULL THEN c.skill_id
                  WHEN @entity_type = 'subskill' THEN c.subskill_id
                END as entity_id
              FROM `{self.project_id}.{self.dataset_id}.curriculum` c
              WHERE (@subject IS NULL OR c.subject = @subject)
                AND NOT EXISTS (
                  SELECT 1
                  FROM `{self.project_id}.{self.dataset_id}.curriculum_prerequisites` cp
                  WHERE cp.unlocks_entity_id =
                    CASE
                      WHEN @entity_type = 'skill' OR @entity_type IS NULL THEN c.skill_id
                      WHEN @entity_type = 'subskill' THEN c.subskill_id
                    END
                    AND cp.is_draft = FALSE
                )
                AND (
                  ((@entity_type = 'skill' OR @entity_type IS NULL) AND c.skill_id IS NOT NULL)
                  OR (@entity_type = 'subskill' AND c.subskill_id IS NOT NULL)
                )
            )
            SELECT DISTINCT entity_id
            FROM (
              SELECT entity_id FROM entities_with_met_prerequisites
              UNION DISTINCT
              SELECT entity_id FROM entities_without_prerequisites
            )
            WHERE entity_id IS NOT NULL
            """

            parameters = [
                bigquery.ScalarQueryParameter("student_id", "INT64", student_id),
                bigquery.ScalarQueryParameter("entity_type", "STRING", entity_type),
                bigquery.ScalarQueryParameter("subject", "STRING", subject)
            ]

            results = await self._run_query_async(query, parameters)

            unlocked = {row['entity_id'] for row in results if row.get('entity_id')}

            logger.info(f"Student {student_id} has {len(unlocked)} unlocked entities (type={entity_type}, subject={subject})")
            return unlocked

        except Exception as e:
            logger.error(f"Error getting unlocked entities for student {student_id}: {e}")
            raise

    # ==================== Graph Structure Methods ====================

    async def get_learning_graph(
        self,
        subject: Optional[str] = None,
        entity_type: Optional[str] = None,
        include_metadata: bool = True
    ) -> Dict[str, Any]:
        """
        Get complete learning prerequisite graph

        Args:
            subject: Filter by subject
            entity_type: Filter by "skill" or "subskill"
            include_metadata: Include metadata about graph structure

        Returns:
            {
                "graph": {
                    "nodes": [{entity_id, entity_type, subject, description}],
                    "edges": [{from_id, from_type, to_id, to_type, threshold}]
                },
                "metadata": {total_nodes, total_edges, subjects}
            }
        """
        try:
            query = f"""
            SELECT
              cp.prerequisite_entity_id,
              cp.prerequisite_entity_type,
              cp.unlocks_entity_id,
              cp.unlocks_entity_type,
              cp.min_proficiency_threshold,
              c1.subject as prerequisite_subject,
              COALESCE(c1.skill_description, c1.subskill_description) as prerequisite_description,
              c2.subject as unlocks_subject,
              COALESCE(c2.skill_description, c2.subskill_description) as unlocks_description
            FROM `{self.project_id}.{self.dataset_id}.curriculum_prerequisites` cp
            LEFT JOIN `{self.project_id}.{self.dataset_id}.curriculum` c1
              ON (cp.prerequisite_entity_id = c1.skill_id AND cp.prerequisite_entity_type = 'skill')
              OR (cp.prerequisite_entity_id = c1.subskill_id AND cp.prerequisite_entity_type = 'subskill')
            LEFT JOIN `{self.project_id}.{self.dataset_id}.curriculum` c2
              ON (cp.unlocks_entity_id = c2.skill_id AND cp.unlocks_entity_type = 'skill')
              OR (cp.unlocks_entity_id = c2.subskill_id AND cp.unlocks_entity_type = 'subskill')
            WHERE cp.is_draft = FALSE
              AND (@subject IS NULL OR c2.subject = @subject)
              AND (@entity_type IS NULL OR cp.unlocks_entity_type = @entity_type)
            """

            parameters = [
                bigquery.ScalarQueryParameter("subject", "STRING", subject),
                bigquery.ScalarQueryParameter("entity_type", "STRING", entity_type)
            ]

            results = await self._run_query_async(query, parameters)

            # Build graph structure
            nodes = {}
            edges = []
            subjects = set()

            for row in results:
                # Add prerequisite node
                prereq_id = row['prerequisite_entity_id']
                if prereq_id not in nodes:
                    nodes[prereq_id] = {
                        "entity_id": prereq_id,
                        "entity_type": row['prerequisite_entity_type'],
                        "subject": row['prerequisite_subject'],
                        "description": row['prerequisite_description']
                    }
                    if row['prerequisite_subject']:
                        subjects.add(row['prerequisite_subject'])

                # Add unlocks node
                unlocks_id = row['unlocks_entity_id']
                if unlocks_id not in nodes:
                    nodes[unlocks_id] = {
                        "entity_id": unlocks_id,
                        "entity_type": row['unlocks_entity_type'],
                        "subject": row['unlocks_subject'],
                        "description": row['unlocks_description']
                    }
                    if row['unlocks_subject']:
                        subjects.add(row['unlocks_subject'])

                # Add edge
                edges.append({
                    "from_id": prereq_id,
                    "from_type": row['prerequisite_entity_type'],
                    "to_id": unlocks_id,
                    "to_type": row['unlocks_entity_type'],
                    "threshold": float(row['min_proficiency_threshold'])
                })

            response = {
                "graph": {
                    "nodes": list(nodes.values()),
                    "edges": edges
                }
            }

            if include_metadata:
                response["metadata"] = {
                    "total_nodes": len(nodes),
                    "total_edges": len(edges),
                    "subjects": sorted(list(subjects))
                }

            return response

        except Exception as e:
            logger.error(f"Error getting learning graph: {e}")
            raise

    async def get_entity_prerequisites(
        self,
        entity_id: str,
        entity_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get prerequisites for a specific entity

        Args:
            entity_id: Entity ID
            entity_type: "skill" or "subskill" (auto-detect if None)

        Returns:
            List of prerequisite dictionaries
        """
        try:
            # Auto-detect entity type if not provided
            if entity_type is None:
                entity_type = self._detect_entity_type(entity_id)

            query = f"""
            SELECT
              cp.prerequisite_entity_id,
              cp.prerequisite_entity_type,
              cp.min_proficiency_threshold,
              c.subject,
              COALESCE(c.skill_description, c.subskill_description) as description
            FROM `{self.project_id}.{self.dataset_id}.curriculum_prerequisites` cp
            LEFT JOIN `{self.project_id}.{self.dataset_id}.curriculum` c
              ON (cp.prerequisite_entity_id = c.skill_id AND cp.prerequisite_entity_type = 'skill')
              OR (cp.prerequisite_entity_id = c.subskill_id AND cp.prerequisite_entity_type = 'subskill')
            WHERE cp.unlocks_entity_id = @entity_id
              AND cp.unlocks_entity_type = @entity_type
              AND cp.is_draft = FALSE
            """

            parameters = [
                bigquery.ScalarQueryParameter("entity_id", "STRING", entity_id),
                bigquery.ScalarQueryParameter("entity_type", "STRING", entity_type)
            ]

            results = await self._run_query_async(query, parameters)

            return [
                {
                    "prerequisite_id": row['prerequisite_entity_id'],
                    "prerequisite_type": row['prerequisite_entity_type'],
                    "min_proficiency_threshold": float(row['min_proficiency_threshold']),
                    "subject": row.get('subject'),
                    "description": row.get('description')
                }
                for row in results
            ]

        except Exception as e:
            logger.error(f"Error getting prerequisites for {entity_id}: {e}")
            raise

    async def get_entity_unlocks(
        self,
        entity_id: str,
        entity_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get what entities this entity unlocks

        Args:
            entity_id: Entity ID
            entity_type: "skill" or "subskill" (auto-detect if None)

        Returns:
            List of unlocked entity dictionaries
        """
        try:
            # Auto-detect entity type if not provided
            if entity_type is None:
                entity_type = self._detect_entity_type(entity_id)

            query = f"""
            SELECT
              cp.unlocks_entity_id,
              cp.unlocks_entity_type,
              cp.min_proficiency_threshold,
              c.subject,
              COALESCE(c.skill_description, c.subskill_description) as description
            FROM `{self.project_id}.{self.dataset_id}.curriculum_prerequisites` cp
            LEFT JOIN `{self.project_id}.{self.dataset_id}.curriculum` c
              ON (cp.unlocks_entity_id = c.skill_id AND cp.unlocks_entity_type = 'skill')
              OR (cp.unlocks_entity_id = c.subskill_id AND cp.unlocks_entity_type = 'subskill')
            WHERE cp.prerequisite_entity_id = @entity_id
              AND cp.prerequisite_entity_type = @entity_type
              AND cp.is_draft = FALSE
            """

            parameters = [
                bigquery.ScalarQueryParameter("entity_id", "STRING", entity_id),
                bigquery.ScalarQueryParameter("entity_type", "STRING", entity_type)
            ]

            results = await self._run_query_async(query, parameters)

            return [
                {
                    "unlocks_id": row['unlocks_entity_id'],
                    "unlocks_type": row['unlocks_entity_type'],
                    "threshold": float(row['min_proficiency_threshold']),
                    "subject": row.get('subject'),
                    "description": row.get('description')
                }
                for row in results
            ]

        except Exception as e:
            logger.error(f"Error getting unlocks for {entity_id}: {e}")
            raise

    # ==================== Skill/Subskill Details ====================

    async def get_skill_with_subskills(
        self,
        skill_id: str,
        student_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Get detailed view of a specific skill with subskills and sequencing

        Args:
            skill_id: Skill ID
            student_id: Optional student ID for progress data

        Returns:
            {
                "skill_id": str,
                "skill_description": str,
                "subject": str,
                "subskills": [{subskill_id, description, sequence, prerequisites, student_data}],
                "prerequisites": [...],
                "unlocks": [...]
            }
        """
        try:
            # Get skill info and subskills
            query = f"""
            SELECT
              c.skill_id,
              c.skill_description,
              c.subject,
              c.subskill_id,
              c.subskill_description,
              c.difficulty_start,
              c.difficulty_end
            FROM `{self.project_id}.{self.dataset_id}.curriculum` c
            WHERE c.skill_id = @skill_id
            ORDER BY c.difficulty_start, c.subskill_id
            """

            parameters = [
                bigquery.ScalarQueryParameter("skill_id", "STRING", skill_id)
            ]

            results = await self._run_query_async(query, parameters)

            if not results:
                raise ValueError(f"Skill {skill_id} not found")

            # Extract skill info
            first_row = results[0]
            skill_data = {
                "skill_id": skill_id,
                "skill_description": first_row['skill_description'],
                "subject": first_row['subject'],
                "subskills": []
            }

            # Get subskills with prerequisites
            for idx, row in enumerate(results):
                subskill_id = row['subskill_id']

                # Get prerequisites for this subskill
                subskill_prerequisites = await self.get_entity_prerequisites(
                    subskill_id,
                    "subskill"
                )

                subskill_data = {
                    "subskill_id": subskill_id,
                    "description": row['subskill_description'],
                    "sequence_order": idx + 1,
                    "difficulty_start": float(row['difficulty_start']) if row['difficulty_start'] else None,
                    "difficulty_end": float(row['difficulty_end']) if row['difficulty_end'] else None,
                    "prerequisites": subskill_prerequisites
                }

                # Add student data if student_id provided
                if student_id:
                    proficiency = await self.get_entity_proficiency(
                        student_id,
                        subskill_id,
                        "subskill"
                    )

                    unlock_check = await self.check_prerequisites_met(
                        student_id,
                        subskill_id,
                        "subskill"
                    )

                    subskill_data["student_data"] = {
                        "unlocked": unlock_check["unlocked"],
                        "proficiency": proficiency,
                        "attempts": 0  # Could query this if needed
                    }

                skill_data["subskills"].append(subskill_data)

            # Get prerequisites for the skill itself
            skill_data["prerequisites"] = await self.get_entity_prerequisites(skill_id, "skill")

            # Get what this skill unlocks
            skill_data["unlocks"] = await self.get_entity_unlocks(skill_id, "skill")

            return skill_data

        except Exception as e:
            logger.error(f"Error getting skill details for {skill_id}: {e}")
            raise

    # ==================== Student-Specific Queries ====================

    async def get_recommendations(
        self,
        student_id: int,
        subject: Optional[str] = None,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Get personalized recommendations based on prerequisites

        Logic:
        1. Get all unlocked subskills
        2. Filter out mastered ones (proficiency >= 0.8)
        3. Prioritize:
           - Ready but not started (coverage gap) - priority 1
           - Ready but low proficiency (performance gap) - priority 2
           - Newly unlocked - priority 3

        Args:
            student_id: Student ID
            subject: Filter by subject
            limit: Number of recommendations

        Returns:
            List of recommendation dictionaries
        """
        try:
            # OPTIMIZED: Single query to get all unlocked subskills with proficiency and details
            query = f"""
            WITH student_proficiencies AS (
              -- Subskill proficiencies
              SELECT
                subskill_id as entity_id,
                'subskill' as entity_type,
                AVG(score / 10.0) as proficiency
              FROM `{self.project_id}.{self.dataset_id}.attempts`
              WHERE student_id = @student_id
              GROUP BY subskill_id

              UNION ALL

              -- Skill proficiencies
              SELECT
                c.skill_id as entity_id,
                'skill' as entity_type,
                AVG(COALESCE(sp.proficiency, 0)) as proficiency
              FROM `{self.project_id}.{self.dataset_id}.curriculum` c
              LEFT JOIN (
                SELECT subskill_id, AVG(score / 10.0) as proficiency
                FROM `{self.project_id}.{self.dataset_id}.attempts`
                WHERE student_id = @student_id
                GROUP BY subskill_id
              ) sp ON c.subskill_id = sp.subskill_id
              GROUP BY c.skill_id
            ),
            prerequisite_checks AS (
              -- Check prerequisites for each subskill
              SELECT
                cp.unlocks_entity_id,
                LOGICAL_AND(
                  COALESCE(sp.proficiency, 0) >= cp.min_proficiency_threshold
                ) as all_prerequisites_met,
                ARRAY_AGG(STRUCT(
                  cp.prerequisite_entity_id as prerequisite_id,
                  cp.prerequisite_entity_type as prerequisite_type,
                  cp.min_proficiency_threshold as required_threshold,
                  COALESCE(sp.proficiency, 0) as current_proficiency,
                  COALESCE(sp.proficiency, 0) >= cp.min_proficiency_threshold as met
                )) as prerequisites
              FROM `{self.project_id}.{self.dataset_id}.curriculum_prerequisites` cp
              LEFT JOIN student_proficiencies sp
                ON cp.prerequisite_entity_id = sp.entity_id
                AND cp.prerequisite_entity_type = sp.entity_type
              WHERE cp.is_draft = FALSE
                AND cp.unlocks_entity_type = 'subskill'
              GROUP BY cp.unlocks_entity_id
            ),
            unlocked_subskills AS (
              -- Subskills with all prerequisites met
              SELECT DISTINCT unlocks_entity_id as subskill_id
              FROM prerequisite_checks
              WHERE all_prerequisites_met = TRUE

              UNION DISTINCT

              -- Subskills with no prerequisites
              SELECT DISTINCT c.subskill_id
              FROM `{self.project_id}.{self.dataset_id}.curriculum` c
              WHERE (@subject IS NULL OR c.subject = @subject)
                AND NOT EXISTS (
                  SELECT 1
                  FROM `{self.project_id}.{self.dataset_id}.curriculum_prerequisites` cp
                  WHERE cp.unlocks_entity_id = c.subskill_id
                    AND cp.unlocks_entity_type = 'subskill'
                    AND cp.is_draft = FALSE
                )
            )
            SELECT
              c.subskill_id,
              c.subskill_description,
              c.subject,
              c.skill_id,
              c.skill_description,
              c.unit_order,
              c.skill_order,
              c.subskill_order,
              COALESCE(sp.proficiency, 0) as proficiency,
              pc.prerequisites
            FROM unlocked_subskills us
            JOIN `{self.project_id}.{self.dataset_id}.curriculum` c
              ON us.subskill_id = c.subskill_id
            LEFT JOIN student_proficiencies sp
              ON c.subskill_id = sp.entity_id AND sp.entity_type = 'subskill'
            LEFT JOIN prerequisite_checks pc
              ON c.subskill_id = pc.unlocks_entity_id
            WHERE (@subject IS NULL OR c.subject = @subject)
              AND COALESCE(sp.proficiency, 0) < @mastery_threshold
            ORDER BY
              c.unit_order,
              c.skill_order,
              c.subskill_order
            LIMIT @limit
            """

            parameters = [
                bigquery.ScalarQueryParameter("student_id", "INT64", student_id),
                bigquery.ScalarQueryParameter("subject", "STRING", subject),
                bigquery.ScalarQueryParameter("mastery_threshold", "FLOAT64", self.DEFAULT_MASTERY_THRESHOLD),
                bigquery.ScalarQueryParameter("limit", "INT64", limit * 2)  # Get 2x to ensure we have enough after filtering
            ]

            results = await self._run_query_async(query, parameters)

            if not results:
                logger.info(f"No unlocked subskills for student {student_id}")
                return []

            # Build recommendations from results
            recommendations = []

            for row in results:
                proficiency = float(row['proficiency'])

                # Determine priority and reason
                if proficiency == 0.0:
                    priority = 1
                    priority_label = "high"
                    reason = "coverage_gap"
                    message = "Ready to start"
                elif proficiency < 0.6:
                    priority = 2
                    priority_label = "high"
                    reason = "performance_gap"
                    message = f"Continue practicing (current: {proficiency:.0%})"
                else:
                    priority = 3
                    priority_label = "medium"
                    reason = "nearly_mastered"
                    message = f"Almost there! (current: {proficiency:.0%})"

                # Extract prerequisites
                prerequisites_met = []
                if row.get('prerequisites'):
                    prerequisites_met = [
                        {
                            "prerequisite_id": p['prerequisite_id'],
                            "prerequisite_type": p['prerequisite_type'],
                            "required_threshold": float(p['required_threshold']),
                            "current_proficiency": float(p['current_proficiency']),
                            "met": bool(p['met'])
                        }
                        for p in row['prerequisites']
                    ]

                recommendations.append({
                    "entity_id": row['subskill_id'],
                    "entity_type": "subskill",
                    "description": row['subskill_description'],
                    "subject": row['subject'],
                    "skill_id": row['skill_id'],
                    "skill_description": row['skill_description'],
                    "priority": priority_label,
                    "priority_order": priority,
                    "reason": reason,
                    "message": message,
                    "current_proficiency": proficiency,
                    "unlocked": True,
                    "prerequisites_met": prerequisites_met
                })

            logger.info(f"Found {len(recommendations)} recommendations for student {student_id}")

            return recommendations[:limit]

        except Exception as e:
            logger.error(f"Error getting recommendations for student {student_id}: {e}")
            raise

    # ==================== Visualization ====================

    async def get_graph_for_visualization(
        self,
        subject: Optional[str] = None,
        student_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Get graph structure optimized for frontend visualization

        Returns units with nested skills and subskills, prerequisites, unlocks, and
        optional student progress data.

        Args:
            subject: Filter by subject
            student_id: Optional student ID for progress data

        Returns:
            {
                "units": [{
                    unit_id, unit_title, subject,
                    skills: [{
                        skill_id, skill_description, subject,
                        subskills: [{subskill_id, description, sequence, unlocked, proficiency}],
                        prerequisites: [...],
                        unlocks: [...]
                    }]
                }]
            }
        """
        try:
            # OPTIMIZED: Single query to get all skills, subskills, and prerequisites
            base_query = f"""
            WITH curriculum_data AS (
              SELECT
                c.unit_id,
                c.unit_title,
                c.skill_id,
                c.skill_description,
                c.subject,
                c.subskill_id,
                c.subskill_description,
                c.difficulty_start,
                c.difficulty_end,
                ROW_NUMBER() OVER (PARTITION BY c.skill_id ORDER BY c.difficulty_start, c.subskill_id) as sequence_order
              FROM `{self.project_id}.{self.dataset_id}.curriculum` c
              WHERE (@subject IS NULL OR c.subject = @subject)
            ),
            skill_prerequisites AS (
              SELECT
                cp.unlocks_entity_id as skill_id,
                ARRAY_AGG(STRUCT(
                  cp.prerequisite_entity_id as prerequisite_id,
                  cp.prerequisite_entity_type as prerequisite_type,
                  cp.min_proficiency_threshold as min_proficiency_threshold,
                  c.subject as subject,
                  COALESCE(c.skill_description, c.subskill_description) as description
                )) as prerequisites
              FROM `{self.project_id}.{self.dataset_id}.curriculum_prerequisites` cp
              LEFT JOIN `{self.project_id}.{self.dataset_id}.curriculum` c
                ON (cp.prerequisite_entity_id = c.skill_id AND cp.prerequisite_entity_type = 'skill')
                OR (cp.prerequisite_entity_id = c.subskill_id AND cp.prerequisite_entity_type = 'subskill')
              WHERE cp.unlocks_entity_type = 'skill'
                AND cp.is_draft = FALSE
                AND (@subject IS NULL OR EXISTS (
                  SELECT 1 FROM `{self.project_id}.{self.dataset_id}.curriculum` c2
                  WHERE c2.skill_id = cp.unlocks_entity_id AND c2.subject = @subject
                ))
              GROUP BY cp.unlocks_entity_id
            ),
            skill_unlocks AS (
              SELECT
                cp.prerequisite_entity_id as skill_id,
                ARRAY_AGG(STRUCT(
                  cp.unlocks_entity_id as unlocks_id,
                  cp.unlocks_entity_type as unlocks_type,
                  cp.min_proficiency_threshold as threshold,
                  c.subject as subject,
                  COALESCE(c.skill_description, c.subskill_description) as description
                )) as unlocks
              FROM `{self.project_id}.{self.dataset_id}.curriculum_prerequisites` cp
              LEFT JOIN `{self.project_id}.{self.dataset_id}.curriculum` c
                ON (cp.unlocks_entity_id = c.skill_id AND cp.unlocks_entity_type = 'skill')
                OR (cp.unlocks_entity_id = c.subskill_id AND cp.unlocks_entity_type = 'subskill')
              WHERE cp.prerequisite_entity_type = 'skill'
                AND cp.is_draft = FALSE
                AND (@subject IS NULL OR EXISTS (
                  SELECT 1 FROM `{self.project_id}.{self.dataset_id}.curriculum` c2
                  WHERE c2.skill_id = cp.prerequisite_entity_id AND c2.subject = @subject
                ))
              GROUP BY cp.prerequisite_entity_id
            ),
            subskill_prerequisites AS (
              SELECT
                cp.unlocks_entity_id as subskill_id,
                ARRAY_AGG(STRUCT(
                  cp.prerequisite_entity_id as prerequisite_id,
                  cp.prerequisite_entity_type as prerequisite_type,
                  cp.min_proficiency_threshold as min_proficiency_threshold,
                  c.subject as subject,
                  COALESCE(c.skill_description, c.subskill_description) as description
                )) as prerequisites
              FROM `{self.project_id}.{self.dataset_id}.curriculum_prerequisites` cp
              LEFT JOIN `{self.project_id}.{self.dataset_id}.curriculum` c
                ON (cp.prerequisite_entity_id = c.skill_id AND cp.prerequisite_entity_type = 'skill')
                OR (cp.prerequisite_entity_id = c.subskill_id AND cp.prerequisite_entity_type = 'subskill')
              WHERE cp.unlocks_entity_type = 'subskill'
                AND cp.is_draft = FALSE
              GROUP BY cp.unlocks_entity_id
            )"""

            # Add student proficiency data if student_id provided
            if student_id:
                base_query += f""",
            student_proficiencies AS (
              -- Student proficiency by subskill
              SELECT
                subskill_id,
                AVG(score / 10.0) as proficiency,
                COUNT(*) as attempts
              FROM `{self.project_id}.{self.dataset_id}.attempts`
              WHERE student_id = @student_id
              GROUP BY subskill_id
            ),
            all_student_prof AS (
              -- All student proficiencies (subskills and skills)
              SELECT
                subskill_id as entity_id,
                'subskill' as entity_type,
                AVG(score / 10.0) as proficiency
              FROM `{self.project_id}.{self.dataset_id}.attempts`
              WHERE student_id = @student_id
              GROUP BY subskill_id

              UNION ALL

              SELECT
                c.skill_id as entity_id,
                'skill' as entity_type,
                AVG(COALESCE(sp.proficiency, 0)) as proficiency
              FROM `{self.project_id}.{self.dataset_id}.curriculum` c
              LEFT JOIN (
                SELECT subskill_id, AVG(score / 10.0) as proficiency
                FROM `{self.project_id}.{self.dataset_id}.attempts`
                WHERE student_id = @student_id
                GROUP BY subskill_id
              ) sp ON c.subskill_id = sp.subskill_id
              GROUP BY c.skill_id
            ),
            prerequisite_checks AS (
              -- Check each prerequisite
              SELECT
                cp.unlocks_entity_id,
                cp.unlocks_entity_type,
                LOGICAL_AND(
                  COALESCE(sp.proficiency, 0) >= cp.min_proficiency_threshold
                ) as all_prerequisites_met,
                ARRAY_AGG(STRUCT(
                  cp.prerequisite_entity_id as id,
                  c.subskill_description as description,
                  cp.min_proficiency_threshold as required,
                  COALESCE(sp.proficiency, 0) as current_proficiency
                )) as unlock_data
              FROM `{self.project_id}.{self.dataset_id}.curriculum_prerequisites` cp
              LEFT JOIN all_student_prof sp
                ON cp.prerequisite_entity_id = sp.entity_id
                AND cp.prerequisite_entity_type = sp.entity_type
            LEFT JOIN `{self.project_id}.{self.dataset_id}.curriculum` c
                ON cp.prerequisite_entity_id = c.subskill_id
              WHERE cp.is_draft = FALSE
                AND cp.unlocks_entity_type = 'subskill'
              GROUP BY cp.unlocks_entity_id, cp.unlocks_entity_type
            ),
            unlocked_subskills AS (
              -- Subskills with all prerequisites met
              SELECT DISTINCT unlocks_entity_id as entity_id
              FROM prerequisite_checks
              WHERE all_prerequisites_met = TRUE

              UNION DISTINCT

              -- Subskills with no prerequisites (always unlocked)
              SELECT DISTINCT c.subskill_id as entity_id
              FROM `{self.project_id}.{self.dataset_id}.curriculum` c
              WHERE NOT EXISTS (
                SELECT 1
                FROM `{self.project_id}.{self.dataset_id}.curriculum_prerequisites` cp
                WHERE cp.unlocks_entity_id = c.subskill_id
                  AND cp.unlocks_entity_type = 'subskill'
                  AND cp.is_draft = FALSE
              )
            )"""

                main_select = """
            SELECT
              cd.unit_id,
              cd.unit_title,
              cd.skill_id,
              cd.skill_description,
              cd.subject,
              cd.subskill_id,
              cd.subskill_description,
              cd.difficulty_start,
              cd.difficulty_end,
              cd.sequence_order,
              sp_skill.prerequisites as skill_prerequisites,
              su.unlocks as skill_unlocks,
              sp_subskill.prerequisites as subskill_prerequisites,
              COALESCE(spr.proficiency, 0) as proficiency,
              COALESCE(spr.attempts, 0) as attempts,
              CASE WHEN us.entity_id IS NOT NULL THEN TRUE ELSE FALSE END as unlocked,
              pc.unlock_data
            FROM curriculum_data cd
            LEFT JOIN skill_prerequisites sp_skill ON cd.skill_id = sp_skill.skill_id
            LEFT JOIN skill_unlocks su ON cd.skill_id = su.skill_id
            LEFT JOIN subskill_prerequisites sp_subskill ON cd.subskill_id = sp_subskill.subskill_id
            LEFT JOIN student_proficiencies spr ON cd.subskill_id = spr.subskill_id
            LEFT JOIN unlocked_subskills us ON cd.subskill_id = us.entity_id
            LEFT JOIN prerequisite_checks pc ON cd.subskill_id = pc.unlocks_entity_id
            ORDER BY cd.unit_id, cd.skill_id, cd.sequence_order
            """
            else:
                main_select = """
            SELECT
              cd.unit_id,
              cd.unit_title,
              cd.skill_id,
              cd.skill_description,
              cd.subject,
              cd.subskill_id,
              cd.subskill_description,
              cd.difficulty_start,
              cd.difficulty_end,
              cd.sequence_order,
              sp_skill.prerequisites as skill_prerequisites,
              su.unlocks as skill_unlocks,
              sp_subskill.prerequisites as subskill_prerequisites
            FROM curriculum_data cd
            LEFT JOIN skill_prerequisites sp_skill ON cd.skill_id = sp_skill.skill_id
            LEFT JOIN skill_unlocks su ON cd.skill_id = su.skill_id
            LEFT JOIN subskill_prerequisites sp_subskill ON cd.subskill_id = sp_subskill.subskill_id
            ORDER BY cd.unit_id, cd.skill_id, cd.sequence_order
            """

            query = base_query + main_select

            parameters = [bigquery.ScalarQueryParameter("subject", "STRING", subject)]
            if student_id:
                parameters.append(bigquery.ScalarQueryParameter("student_id", "INT64", student_id))

            results = await self._run_query_async(query, parameters)

            # Organize results into units -> skills -> subskills hierarchy
            units_dict = {}

            for row in results:
                unit_id = row['unit_id']
                skill_id = row['skill_id']

                # Initialize unit if not seen
                if unit_id not in units_dict:
                    units_dict[unit_id] = {
                        "unit_id": unit_id,
                        "unit_title": row['unit_title'],
                        "subject": row['subject'],
                        "skills": {}
                    }

                # Initialize skill if not seen within this unit
                if skill_id not in units_dict[unit_id]["skills"]:
                    units_dict[unit_id]["skills"][skill_id] = {
                        "skill_id": skill_id,
                        "skill_description": row['skill_description'],
                        "subject": row['subject'],
                        "subskills": [],
                        "prerequisites": [],
                        "unlocks": []
                    }

                    # Add skill-level prerequisites and unlocks (only once per skill)
                    if row.get('skill_prerequisites'):
                        units_dict[unit_id]["skills"][skill_id]["prerequisites"] = [
                            {
                                "prerequisite_id": p['prerequisite_id'],
                                "prerequisite_type": p['prerequisite_type'],
                                "min_proficiency_threshold": float(p['min_proficiency_threshold']),
                                "subject": p.get('subject'),
                                "description": p.get('description')
                            }
                            for p in row['skill_prerequisites']
                        ]

                    if row.get('skill_unlocks'):
                        units_dict[unit_id]["skills"][skill_id]["unlocks"] = [
                            {
                                "unlocks_id": u['unlocks_id'],
                                "unlocks_type": u['unlocks_type'],
                                "threshold": float(u['threshold']),
                                "subject": u.get('subject'),
                                "description": u.get('description')
                            }
                            for u in row['skill_unlocks']
                        ]

                # Add subskill
                subskill_data = {
                    "subskill_id": row['subskill_id'],
                    "description": row['subskill_description'],
                    "sequence_order": int(row['sequence_order']),
                    "difficulty_start": float(row['difficulty_start']) if row['difficulty_start'] else None,
                    "difficulty_end": float(row['difficulty_end']) if row['difficulty_end'] else None,
                    "prerequisites": []
                }

                # Add subskill prerequisites
                if row.get('subskill_prerequisites'):
                    subskill_data["prerequisites"] = [
                        {
                            "prerequisite_id": p['prerequisite_id'],
                            "prerequisite_type": p['prerequisite_type'],
                            "min_proficiency_threshold": float(p['min_proficiency_threshold']),
                            "subject": p.get('subject'),
                            "description": p.get('description')
                        }
                        for p in row['subskill_prerequisites']
                    ]

                # Add student data if available
                if student_id:
                    subskill_data["student_data"] = {
                        "unlocked": bool(row.get('unlocked', False)),
                        "proficiency": float(row.get('proficiency', 0)),
                        "attempts": int(row.get('attempts', 0))
                    }
                    if not subskill_data["student_data"]["unlocked"] and row.get('unlock_data'):
                        subskill_data["student_data"]["unlock_data"] = [
                            {
                                "id": d.get("id"),
                                "description": d.get("description"),
                                "required": d.get("required"),
                                "current_proficiency": d.get("current_proficiency")
                            }
                            for d in row.get('unlock_data')
                        ]

                units_dict[unit_id]["skills"][skill_id]["subskills"].append(subskill_data)

            # Convert nested dict structure to list format
            units_list = []
            for unit in units_dict.values():
                unit["skills"] = list(unit["skills"].values())
                units_list.append(unit)

            return {"units": units_list}

        except Exception as e:
            logger.error(f"Error getting graph for visualization: {e}")
            raise

    # ==================== Student State Engine ====================

    async def get_student_graph(
        self,
        student_id: int,
        subject_id: str,
        include_drafts: bool = False
    ) -> Dict[str, Any]:
        """
        Get curriculum graph decorated with student progress data

        This is the "Student State Engine" that merges:
        - Static curriculum structure (from Firestore)
        - Dynamic student progress (from BigQuery)

        Returns graph where each node includes:
        - student_proficiency: float (0.0-1.0)
        - status: "LOCKED" | "UNLOCKED" | "IN_PROGRESS" | "MASTERED"
        - last_attempt_at: datetime (optional)
        - attempt_count: int (optional)

        Algorithm:
        1. Fetch curriculum graph + student proficiencies in parallel
        2. Initialize all nodes as LOCKED with 0.0 proficiency
        3. Determine UNLOCKED nodes (prerequisites met)
        4. Overlay IN_PROGRESS (proficiency > 0) and MASTERED (proficiency >= 0.8)
        5. Return decorated graph

        Args:
            student_id: Student ID
            subject_id: Subject identifier (e.g., "MATHEMATICS", "LANGUAGE_ARTS")
            include_drafts: Include draft curriculum (default: False)

        Returns:
            {
                "nodes": [...],  # Decorated with student data
                "edges": [...],  # Original edges
                "student_id": int,
                "subject_id": str,
                "version_id": str,
                "generated_at": str
            }
        """
        try:
            logger.info(f"Building student graph for student {student_id}, subject {subject_id}")

            # Step 1: Fetch data in parallel for performance
            graph_data, student_prof_map = await asyncio.gather(
                self.firestore.get_curriculum_graph(
                    subject_id=subject_id,
                    version_type="draft" if include_drafts else "published"
                ),
                self.analytics.get_student_proficiency_map(
                    student_id=student_id,
                    subject_id=subject_id
                )
            )

            if not graph_data or not graph_data.get("graph"):
                raise ValueError(f"No curriculum graph found for {subject_id}")

            graph = graph_data["graph"]
            nodes = graph["nodes"]
            edges = graph["edges"]

            logger.info(f"Retrieved graph with {len(nodes)} nodes, {len(edges)} edges")
            logger.info(f"Student has proficiency data for {len(student_prof_map)} entities")

            # Step 2: Initialize node states (all LOCKED by default)
            student_node_states = {}

            for node in nodes:
                student_node_states[node["id"]] = {
                    **node,  # Copy all original node data
                    "student_proficiency": 0.0,
                    "status": "LOCKED",
                    "attempt_count": 0,
                    "last_attempt_at": None
                }

            # Step 3: Determine UNLOCKED status
            # Build prerequisites map: node_id -> [(prereq_id, threshold), ...]
            prereqs_map = self._build_prerequisites_map(edges)

            # Determine which nodes are unlocked
            unlocked_node_ids = self._determine_unlocked_nodes(
                nodes=nodes,
                edges=edges,
                prereqs_map=prereqs_map,
                student_prof_map=student_prof_map
            )

            # Update status to UNLOCKED
            for node_id in unlocked_node_ids:
                student_node_states[node_id]["status"] = "UNLOCKED"

            logger.info(f"Determined {len(unlocked_node_ids)} unlocked nodes")

            # Step 4: Overlay student proficiency data and determine final status
            mastered_count = 0
            in_progress_count = 0

            for node_id, prof_data in student_prof_map.items():
                if node_id in student_node_states:
                    node = student_node_states[node_id]
                    proficiency = prof_data["proficiency"]

                    # Update proficiency data
                    node["student_proficiency"] = proficiency
                    node["attempt_count"] = prof_data.get("attempt_count", 0)
                    node["last_attempt_at"] = prof_data.get("last_attempt_at")

                    # Determine final status based on proficiency
                    if proficiency >= self.DEFAULT_MASTERY_THRESHOLD:
                        node["status"] = "MASTERED"
                        mastered_count += 1
                    elif proficiency > 0:
                        node["status"] = "IN_PROGRESS"
                        in_progress_count += 1
                    # else: remains "UNLOCKED" or "LOCKED" based on Step 3

            logger.info(
                f"Student state: {mastered_count} mastered, "
                f"{in_progress_count} in progress, "
                f"{len(unlocked_node_ids)} unlocked, "
                f"{len(nodes) - len(unlocked_node_ids)} locked"
            )

            # Step 5: Return decorated graph
            return {
                "nodes": list(student_node_states.values()),
                "edges": edges,
                "student_id": student_id,
                "subject_id": subject_id,
                "version_id": graph_data.get("version_id"),
                "generated_at": graph_data.get("generated_at")
            }

        except ValueError as e:
            # Re-raise ValueError for 404 handling
            logger.error(f"Graph not found: {e}")
            raise
        except Exception as e:
            logger.error(f"Error building student graph: {e}")
            raise

    def _build_prerequisites_map(
        self,
        edges: List[Dict[str, Any]]
    ) -> Dict[str, List[Tuple[str, float]]]:
        """
        Build map of node_id -> [(prerequisite_node_id, threshold), ...]

        Args:
            edges: List of edge dictionaries with source, target, threshold

        Returns:
            {
                "target_node_id": [
                    ("prereq_node_1", 0.8),
                    ("prereq_node_2", 0.9)
                ]
            }
        """
        prereqs_map = {}

        for edge in edges:
            target_id = edge["target"]
            source_id = edge["source"]
            threshold = edge.get("threshold", self.DEFAULT_MASTERY_THRESHOLD)

            if target_id not in prereqs_map:
                prereqs_map[target_id] = []

            prereqs_map[target_id].append((source_id, threshold))

        return prereqs_map

    def _determine_unlocked_nodes(
        self,
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]],
        prereqs_map: Dict[str, List[Tuple[str, float]]],
        student_prof_map: Dict[str, Dict[str, Any]]
    ) -> Set[str]:
        """
        Determine which nodes are unlocked for the student

        A node is unlocked if:
        - It has no prerequisites (entry point), OR
        - ALL prerequisites meet required proficiency thresholds

        Args:
            nodes: List of node dictionaries
            edges: List of edge dictionaries
            prereqs_map: Prerequisite map from _build_prerequisites_map
            student_prof_map: Student proficiency map from BigQuery

        Returns:
            Set of unlocked node IDs
        """
        unlocked = set()

        for node in nodes:
            node_id = node["id"]

            # Check if node has prerequisites
            prerequisites = prereqs_map.get(node_id, [])

            if not prerequisites:
                # No prerequisites = entry point = always unlocked
                unlocked.add(node_id)
                continue

            # Check if ALL prerequisites are met
            all_met = True

            for prereq_id, required_threshold in prerequisites:
                # Get student's proficiency for this prerequisite
                prof_data = student_prof_map.get(prereq_id, {})
                current_proficiency = prof_data.get("proficiency", 0.0)

                # Check if proficiency meets threshold
                if current_proficiency < required_threshold:
                    all_met = False
                    break

            if all_met:
                unlocked.add(node_id)

        return unlocked

    # ==================== Utility Methods ====================

    async def _run_query_async(
        self,
        query: str,
        parameters: List[bigquery.ScalarQueryParameter] = None
    ) -> List[Dict]:
        """Run BigQuery query asynchronously"""
        loop = asyncio.get_event_loop()

        def _execute_query():
            job_config = bigquery.QueryJobConfig()
            if parameters:
                job_config.query_parameters = parameters

            job_config.labels = {"service": "learning_paths", "component": "prerequisite_graph"}

            query_job = self.client.query(query, job_config=job_config)
            results = query_job.result()

            logger.debug(f"Query processed {query_job.total_bytes_processed} bytes")

            return [dict(row) for row in results]

        return await loop.run_in_executor(self.executor, _execute_query)

    def _detect_entity_type(self, entity_id: str) -> str:
        """
        Auto-detect entity type from ID pattern

        Skill IDs typically: COUNT001-01, OPS001-02
        Subskill IDs typically: COUNT001-01-A, OPS001-02-B
        """
        parts = entity_id.split('-')

        # If 3+ parts and last part is single letter, likely subskill
        if len(parts) >= 3 and len(parts[-1]) == 1 and parts[-1].isalpha():
            return "subskill"
        else:
            return "skill"

    async def health_check(self) -> Dict[str, Any]:
        """Check learning paths service health"""
        try:
            # Test query
            test_query = f"""
            SELECT COUNT(*) as total_prerequisites
            FROM `{self.project_id}.{self.dataset_id}.curriculum_prerequisites`
            WHERE is_draft = FALSE
            LIMIT 1
            """

            job_config = bigquery.QueryJobConfig(dry_run=True)
            query_job = self.client.query(test_query, job_config=job_config)

            return {
                "status": "healthy",
                "project_id": self.project_id,
                "dataset_id": self.dataset_id,
                "query_validation": "passed",
                "timestamp": datetime.now().isoformat()
            }

        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
