# backend/app/services/curriculum_service.py - FIRESTORE-PRIMARY CURRICULUM SERVICE

import logging
import pandas as pd
import random
from typing import Dict, Any, List, Optional, TYPE_CHECKING
from datetime import datetime, timezone
from io import BytesIO

from app.db.blob_storage import BlobStorageService
from app.core.config import settings

if TYPE_CHECKING:
    from app.db.firestore_service import FirestoreService
    from app.services.bigquery_analytics import BigQueryAnalyticsService

logger = logging.getLogger(__name__)

class CurriculumService:
    """
    Firestore-primary curriculum service.

    Firestore (curriculum_published collection) is the primary backend for:
      - get_available_subjects, get_curriculum, get_subskill_types,
        get_subskill_metadata, get_curriculum_stats

    BigQuery is optional and only used for authored content fallbacks:
      - get_detailed_objectives, get_subskill_foundations,
        get_reading_content_by_subskill, get_visual_snippets_by_subskill

    BigQuery fallbacks only fire if Firestore data is unavailable.
    """

    def __init__(
        self,
        bigquery_service: Optional['BigQueryAnalyticsService'] = None,
        blob_service: Optional[BlobStorageService] = None,
        firestore_service: Optional['FirestoreService'] = None
    ):
        self.bigquery_service = bigquery_service
        self.blob_service = blob_service
        self.firestore_service = firestore_service
        self._use_firestore = False
        self._use_bigquery = False

        # Simple cache with TTL
        self._cache = {}
        self._cache_timestamps = {}

    async def initialize(self) -> bool:
        """Initialize the curriculum service.

        Firestore is the primary backend. BigQuery is optional and only
        initialized if available (for authored content fallbacks).
        """
        try:
            # Check if Firestore has published curriculum (primary)
            if self.firestore_service:
                try:
                    subjects = await self.firestore_service.get_all_published_subjects()
                    if subjects:
                        self._use_firestore = True
                        logger.info(f"✅ CURRICULUM_SERVICE: Firestore has {len(subjects)} published subjects — using Firestore as primary")
                    else:
                        logger.info("ℹ️ CURRICULUM_SERVICE: No published curriculum in Firestore")
                except Exception as e:
                    logger.warning(f"⚠️ CURRICULUM_SERVICE: Firestore check failed ({e})")

            # Initialize BigQuery if available (optional, for authored content)
            if self.bigquery_service:
                try:
                    if await self.bigquery_service.initialize():
                        self._use_bigquery = True
                        logger.info("✅ CURRICULUM_SERVICE: BigQuery available for authored content")
                    else:
                        logger.warning("⚠️ CURRICULUM_SERVICE: BigQuery initialization returned False")
                except Exception as e:
                    logger.warning(f"⚠️ CURRICULUM_SERVICE: BigQuery init failed ({e}) — authored content methods unavailable")

            # Initialize blob service (optional, for file management)
            if self.blob_service and not getattr(self.blob_service, '_initialized', False):
                await self.blob_service.initialize()

            # At least one backend must be available
            if not self._use_firestore and not self._use_bigquery:
                raise Exception("Neither Firestore nor BigQuery is available — cannot serve curriculum")

            mode_parts = []
            if self._use_firestore:
                mode_parts.append("Firestore (primary)")
            if self._use_bigquery:
                mode_parts.append("BigQuery (authored content)")
            logger.info(f"✅ CURRICULUM_SERVICE: Initialized successfully ({' + '.join(mode_parts)})")
            return True

        except Exception as e:
            logger.error(f"❌ CURRICULUM_SERVICE: Initialization failed: {str(e)}")
            raise

    def _is_cache_valid(self, cache_key: str) -> bool:
        """Check if cached data is still valid"""
        if cache_key not in self._cache_timestamps:
            return False

        cache_time = self._cache_timestamps[cache_key]
        current_time = datetime.now(timezone.utc)
        cache_ttl_seconds = getattr(settings, 'CURRICULUM_CACHE_TTL_MINUTES', 60) * 60
        return (current_time - cache_time).total_seconds() < cache_ttl_seconds

    def _cache_set(self, cache_key: str, value: Any) -> None:
        """Store a value in cache"""
        self._cache[cache_key] = value
        self._cache_timestamps[cache_key] = datetime.now(timezone.utc)

    # ============================================================================
    # FIRESTORE-BACKED CURRICULUM HIERARCHY METHODS
    # ============================================================================

    async def _resolve_subject_id(self, subject: str) -> str:
        """Resolve a subject_name (e.g. 'Language Arts') to its Firestore subject_id ('LANGUAGE_ARTS').

        Falls back to the original string if no mapping is found.
        """
        # If it already looks like a subject_id (all-caps with underscores), return as-is
        if subject == subject.upper() and " " not in subject:
            return subject

        # Check cached subjects for the mapping
        all_subjects = await self.get_available_subjects()
        matches = [
            subj for subj in all_subjects
            if subj.get("subject_name", "").lower() == subject.lower()
        ]
        if len(matches) > 1:
            ids = [m["subject_id"] for m in matches]
            logger.warning(
                f"Ambiguous subject name '{subject}' matches {len(matches)} entries: {ids}. "
                "Pass subject_id instead of subject_name to avoid this."
            )
        if matches:
            return matches[0]["subject_id"]

        # Fallback: normalise to UPPER_SNAKE_CASE
        return subject.upper().replace(" ", "_")

    async def _get_firestore_doc(self, subject: str) -> Optional[Dict[str, Any]]:
        """Get a published curriculum doc from Firestore, using cache.

        Accepts either a subject_name ('Language Arts') or subject_id ('LANGUAGE_ARTS').
        """
        # Resolve to subject_id for Firestore lookup
        subject_id = await self._resolve_subject_id(subject)

        cache_key = f"firestore_doc_{subject_id}"
        if cache_key in self._cache and self._is_cache_valid(cache_key):
            return self._cache[cache_key]

        if not self.firestore_service:
            return None

        doc = await self.firestore_service.get_published_curriculum(subject_id)
        if doc:
            self._cache_set(cache_key, doc)
        return doc

    async def get_available_subjects(self, grade: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get list of all available subjects, optionally filtered by grade.

        Returns list of dicts with subject_id, subject_name, and grade.
        """
        cache_key = f"available_subjects_{grade or 'all'}"
        if cache_key in self._cache and self._is_cache_valid(cache_key):
            return self._cache[cache_key]

        # Try Firestore first
        if self._use_firestore and self.firestore_service:
            try:
                published = await self.firestore_service.get_all_published_subjects(grade=grade)
                if published:
                    subjects = sorted(published, key=lambda s: (s.get("grade", ""), s.get("subject_name", "")))
                    self._cache_set(cache_key, subjects)
                    return subjects
            except Exception as e:
                logger.warning(f"Firestore subject lookup failed, falling back to BigQuery: {e}")

        # BigQuery fallback
        if not self._use_bigquery or not self.bigquery_service:
            return []

        where_clauses = ["subject IS NOT NULL", "subject != ''"]
        if grade:
            where_clauses.append(f"grade = '{grade}'")

        query = f"""
        SELECT DISTINCT subject as subject_name, grade
        FROM `{self.bigquery_service.project_id}.{self.bigquery_service.dataset_id}.curriculum`
        WHERE {' AND '.join(where_clauses)}
        ORDER BY grade, subject
        """

        results = await self.bigquery_service._run_query_async(query)
        subjects = [{"subject_name": row["subject_name"], "grade": row.get("grade")} for row in results]
        self._cache_set(cache_key, subjects)
        return subjects

    async def get_curriculum(self, subject: str) -> List[Dict]:
        """Get hierarchical curriculum data for a subject.

        Accepts either a subject_name ('Language Arts') or subject_id ('LANGUAGE_ARTS').
        """
        subject_id = await self._resolve_subject_id(subject)
        cache_key = f"curriculum_{subject_id.lower()}"
        if cache_key in self._cache and self._is_cache_valid(cache_key):
            return self._cache[cache_key]

        # Try Firestore first
        if self._use_firestore:
            doc = await self._get_firestore_doc(subject_id)
            if doc and "curriculum" in doc:
                structured = self._structure_firestore_curriculum(doc)
                self._cache_set(cache_key, structured)
                return structured

        # BigQuery fallback
        if not self._use_bigquery or not self.bigquery_service:
            return []

        query = f"""
        SELECT
            subject,
            grade,
            unit_id,
            unit_title,
            skill_id,
            skill_description,
            subskill_id,
            subskill_description,
            difficulty_start,
            difficulty_end,
            target_difficulty
        FROM `{self.bigquery_service.project_id}.{self.bigquery_service.dataset_id}.curriculum`
        WHERE subject = @subject
        ORDER BY unit_id, skill_id, subskill_id
        """

        from google.cloud import bigquery
        parameters = [bigquery.ScalarQueryParameter("subject", "STRING", subject)]

        results = await self.bigquery_service._run_query_async(query, parameters)
        structured_curriculum = self._structure_curriculum_data(results)
        self._cache_set(cache_key, structured_curriculum)
        return structured_curriculum

    def _structure_firestore_curriculum(self, doc: Dict[str, Any]) -> List[Dict]:
        """Convert Firestore curriculum_published document to the backend's expected format.

        Input (Firestore doc):
            curriculum: [{unit_id, unit_title, skills: [{skill_id, skill_description, subskills: [...]}]}]

        Output (backend format):
            [{id, title, grade, subject, skills: [{id, description, subskills: [{id, description, difficulty_range}]}]}]
        """
        subject_name = doc.get("subject_name", "")
        grade = doc.get("grade")
        structured = []

        for unit in doc.get("curriculum", []):
            unit_entry = {
                "id": unit.get("unit_id"),
                "title": unit.get("unit_title"),
                "grade": grade,
                "subject": subject_name,
                "skills": [],
            }
            for skill in unit.get("skills", []):
                skill_entry = {
                    "id": skill.get("skill_id"),
                    "description": skill.get("skill_description"),
                    "subskills": [],
                }
                for subskill in skill.get("subskills", []):
                    ss_entry = {
                        "id": subskill.get("subskill_id"),
                        "description": subskill.get("subskill_description"),
                        "difficulty_range": {
                            "start": subskill.get("difficulty_start"),
                            "end": subskill.get("difficulty_end"),
                            "target": subskill.get("target_difficulty"),
                        },
                    }
                    if subskill.get("target_primitive"):
                        ss_entry["target_primitive"] = subskill["target_primitive"]
                    skill_entry["subskills"].append(ss_entry)
                unit_entry["skills"].append(skill_entry)
            structured.append(unit_entry)

        return structured

    def _structure_curriculum_data(self, flat_data: List[Dict]) -> List[Dict]:
        """Convert BigQuery flat results to hierarchical curriculum structure"""
        structured = []
        current_unit = None
        current_skill = None

        for row in flat_data:
            if not current_unit or current_unit["id"] != row["unit_id"]:
                current_unit = {
                    "id": row["unit_id"],
                    "title": row["unit_title"],
                    "grade": row.get("grade"),
                    "subject": row["subject"],
                    "skills": []
                }
                structured.append(current_unit)

            if not current_skill or current_skill["id"] != row["skill_id"]:
                current_skill = {
                    "id": row["skill_id"],
                    "description": row["skill_description"],
                    "subskills": []
                }
                current_unit["skills"].append(current_skill)

            ss_entry = {
                "id": row["subskill_id"],
                "description": row["subskill_description"],
                "difficulty_range": {
                    "start": row.get("difficulty_start"),
                    "end": row.get("difficulty_end"),
                    "target": row.get("target_difficulty")
                }
            }
            if row.get("target_primitive"):
                ss_entry["target_primitive"] = row["target_primitive"]
            current_skill["subskills"].append(ss_entry)

        return structured

    async def get_subskill_types(self, subject: str) -> List[str]:
        """Get list of all subskill IDs for a subject"""
        # Try Firestore first
        if self._use_firestore:
            subject_id = await self._resolve_subject_id(subject)
            doc = await self._get_firestore_doc(subject_id)
            if doc and "subskill_index" in doc:
                return sorted(doc["subskill_index"].keys())

        # BigQuery fallback
        if not self._use_bigquery or not self.bigquery_service:
            return []

        query = f"""
        SELECT DISTINCT subskill_id
        FROM `{self.bigquery_service.project_id}.{self.bigquery_service.dataset_id}.curriculum`
        WHERE subject = @subject
        ORDER BY subskill_id
        """

        from google.cloud import bigquery
        parameters = [bigquery.ScalarQueryParameter("subject", "STRING", subject)]

        results = await self.bigquery_service._run_query_async(query, parameters)
        return [row['subskill_id'] for row in results]

    async def get_subskill_metadata(self, subskill_id: str, subject: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Get unit, skill, and subskill metadata for a given subskill_id.

        Args:
            subskill_id: The subskill identifier
            subject: Optional subject name or subject_id. When provided, does a
                     direct single-document lookup instead of scanning all subjects.
        """
        cache_key = f"subskill_metadata_{subskill_id}"
        if cache_key in self._cache and self._is_cache_valid(cache_key):
            return self._cache[cache_key]

        # Try Firestore first
        if self._use_firestore and self.firestore_service:
            try:
                if subject:
                    # Direct lookup — single document read
                    resolved_id = await self._resolve_subject_id(subject)
                    doc = await self._get_firestore_doc(resolved_id)
                    if not doc:
                        doc = await self.firestore_service.get_published_curriculum(resolved_id)
                    if doc and "subskill_index" in doc and subskill_id in doc["subskill_index"]:
                        metadata = doc["subskill_index"][subskill_id]
                        self._cache_set(cache_key, metadata)
                        return metadata
                else:
                    # Fallback: scan all subjects
                    published = await self.firestore_service.get_all_published_subjects()
                    for subj in published:
                        doc = await self._get_firestore_doc(subj["subject_id"])
                        if not doc:
                            doc = await self.firestore_service.get_published_curriculum(subj["subject_id"])
                        if doc and "subskill_index" in doc and subskill_id in doc["subskill_index"]:
                            metadata = doc["subskill_index"][subskill_id]
                            self._cache_set(cache_key, metadata)
                            return metadata
            except Exception as e:
                logger.warning(f"Firestore subskill_metadata lookup failed: {e}")

        # BigQuery fallback
        if not self._use_bigquery or not self.bigquery_service:
            logger.warning(f"No curriculum metadata found for subskill_id: {subskill_id} (BigQuery unavailable)")
            return None

        query = f"""
        SELECT
            subject,
            unit_id,
            unit_title,
            skill_id,
            skill_description,
            subskill_id,
            subskill_description,
            difficulty_start,
            difficulty_end,
            target_difficulty,
            grade
        FROM `{self.bigquery_service.project_id}.{self.bigquery_service.dataset_id}.curriculum`
        WHERE subskill_id = @subskill_id
        LIMIT 1
        """

        from google.cloud import bigquery
        parameters = [bigquery.ScalarQueryParameter("subskill_id", "STRING", subskill_id)]

        try:
            results = await self.bigquery_service._run_query_async(query, parameters)

            if results and len(results) > 0:
                row = results[0]
                metadata = {
                    'subject': row.get('subject'),
                    'unit_id': row.get('unit_id'),
                    'unit_title': row.get('unit_title'),
                    'skill_id': row.get('skill_id'),
                    'skill_description': row.get('skill_description'),
                    'subskill_id': row.get('subskill_id'),
                    'subskill_description': row.get('subskill_description'),
                    'difficulty_start': row.get('difficulty_start'),
                    'difficulty_end': row.get('difficulty_end'),
                    'target_difficulty': row.get('target_difficulty'),
                    'grade': row.get('grade'),
                    'target_primitive': row.get('target_primitive'),
                }

                self._cache_set(cache_key, metadata)
                return metadata
            else:
                logger.warning(f"No curriculum metadata found for subskill_id: {subskill_id}")
                return None

        except Exception as e:
            logger.error(f"Error fetching subskill metadata for {subskill_id}: {e}")
            return None

    async def get_curriculum_stats(self, subject: Optional[str] = None) -> Dict[str, Any]:
        """Get curriculum statistics.

        Returns a dict. When a single subject is given, returns stats for that subject.
        Otherwise returns {"subjects": [...]}.
        """
        # Try Firestore first
        if self._use_firestore and self.firestore_service:
            try:
                if subject:
                    subject_id = await self._resolve_subject_id(subject)
                    doc = await self._get_firestore_doc(subject_id)
                    if doc and "stats" in doc:
                        return {**doc["stats"], "subject": doc.get("subject_name", subject)}
                else:
                    published = await self.firestore_service.get_all_published_subjects()
                    all_stats = []
                    for subj in published:
                        doc = await self._get_firestore_doc(subj["subject_id"])
                        if not doc:
                            doc = await self.firestore_service.get_published_curriculum(subj["subject_id"])
                        if doc and "stats" in doc:
                            all_stats.append({**doc["stats"], "subject": doc.get("subject_name", subj["subject_id"])})
                    if all_stats:
                        return {"subjects": all_stats}
            except Exception as e:
                logger.warning(f"Firestore stats lookup failed: {e}")

        # BigQuery fallback
        if not self._use_bigquery or not self.bigquery_service:
            return {"subjects": []}

        where_clause = "WHERE subject = @subject" if subject else ""

        query = f"""
        SELECT
            subject,
            COUNT(DISTINCT unit_id) as total_units,
            COUNT(DISTINCT skill_id) as total_skills,
            COUNT(DISTINCT subskill_id) as total_subskills,
            AVG(target_difficulty) as avg_target_difficulty,
            MIN(difficulty_start) as min_difficulty,
            MAX(difficulty_end) as max_difficulty
        FROM `{self.bigquery_service.project_id}.{self.bigquery_service.dataset_id}.curriculum`
        {where_clause}
        GROUP BY subject
        ORDER BY subject
        """

        parameters = []
        if subject:
            from google.cloud import bigquery
            parameters = [bigquery.ScalarQueryParameter("subject", "STRING", subject)]

        results = await self.bigquery_service._run_query_async(query, parameters)

        if subject and results:
            return results[0]
        else:
            return {"subjects": results}

    # ============================================================================
    # BIGQUERY-ONLY METHODS (authored content, detailed objectives)
    # ============================================================================

    async def get_detailed_objectives(self, subject: str, subskill_id: str) -> Dict[str, Any]:
        """Get detailed objectives. Falls back to defaults if BigQuery is unavailable."""
        if not self._use_bigquery or not self.bigquery_service:
            return {
                'ConceptGroup': f'{subject} Skills',
                'DetailedObjective': f'Develop proficiency in {subskill_id}',
                'SubskillDescription': f'Practice and master {subskill_id} concepts'
            }

        try:
            query = f"""
            SELECT
                concept_group,
                detailed_objective,
                subskill_description
            FROM `{self.bigquery_service.project_id}.{self.bigquery_service.dataset_id}.detailed_objectives`
            WHERE subskill_id = @subskill_id
            """

            from google.cloud import bigquery
            parameters = [bigquery.ScalarQueryParameter("subskill_id", "STRING", subskill_id)]

            results = await self.bigquery_service._run_query_async(query, parameters)

            if results:
                objective = random.choice(results)
                return {
                    'ConceptGroup': objective.get('concept_group', f'{subject} Skills'),
                    'DetailedObjective': objective.get('detailed_objective'),
                    'SubskillDescription': objective.get('subskill_description')
                }
            else:
                return {
                    'ConceptGroup': f'{subject} Skills',
                    'DetailedObjective': f'Develop proficiency in {subskill_id}',
                    'SubskillDescription': f'Practice and master {subskill_id} concepts'
                }

        except Exception as e:
            logger.warning(f"Error getting detailed objectives, using default: {str(e)}")
            return {
                'ConceptGroup': f'{subject} Skills',
                'DetailedObjective': f'Develop proficiency in {subskill_id}',
                'SubskillDescription': f'Practice and master {subskill_id} concepts'
            }

    async def health_check(self) -> Dict[str, Any]:
        """Check curriculum service health"""
        try:
            bq_health = None
            if self.bigquery_service:
                bq_health = await self.bigquery_service.health_check()

            firestore_status = "not configured"
            if self.firestore_service:
                try:
                    subjects = await self.firestore_service.get_all_published_subjects()
                    firestore_status = f"healthy ({len(subjects)} subjects)"
                except Exception:
                    firestore_status = "unhealthy"

            mode_parts = []
            if self._use_firestore:
                mode_parts.append("firestore")
            if self._use_bigquery:
                mode_parts.append("bigquery")

            return {
                "status": "healthy",
                "mode": "+".join(mode_parts) or "none",
                "firestore_curriculum": firestore_status,
                "bigquery_service": bq_health or "not configured",
                "blob_storage_available": self.blob_service is not None,
                "cache_size": len(self._cache),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }

        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }

    # ============================================================================
    # FILE MANAGEMENT METHODS (blob storage)
    # ============================================================================

    async def upload_curriculum_csv(self, subject: str, csv_content: bytes, file_type: str = "syllabus") -> Dict[str, Any]:
        """Upload curriculum CSV to blob storage"""
        if not self.blob_service:
            return {"success": False, "error": "Blob storage not available"}

        try:
            df = pd.read_csv(BytesIO(csv_content))

            blob_name = f"curriculum/{subject.lower()}/{file_type}.csv"
            curriculum_container = getattr(settings, 'CURRICULUM_CONTAINER_NAME', 'curriculum-data')

            container_client = self.blob_service.blob_service_client.get_container_client(curriculum_container)
            blob_client = container_client.get_blob_client(blob_name)

            blob_client.upload_blob(
                csv_content,
                overwrite=True,
                metadata={
                    "subject": subject,
                    "file_type": file_type,
                    "row_count": str(len(df)),
                    "upload_timestamp": datetime.now(timezone.utc).isoformat()
                }
            )

            self.clear_cache()

            return {
                "success": True,
                "blob_name": blob_name,
                "row_count": len(df),
                "columns": list(df.columns)
            }

        except Exception as e:
            return {"success": False, "error": str(e)}

    async def download_curriculum_csv(self, subject: str, file_type: str = "syllabus") -> Optional[pd.DataFrame]:
        """Download curriculum CSV from blob storage"""
        if not self.blob_service:
            return None

        try:
            blob_name = f"curriculum/{subject.lower()}/{file_type}.csv"
            curriculum_container = getattr(settings, 'CURRICULUM_CONTAINER_NAME', 'curriculum-data')

            container_client = self.blob_service.blob_service_client.get_container_client(curriculum_container)
            blob_client = container_client.get_blob_client(blob_name)

            blob_data = blob_client.download_blob().readall()
            return pd.read_csv(BytesIO(blob_data))

        except Exception as e:
            logger.warning(f"Failed to download curriculum CSV: {str(e)}")
            return None

    async def list_curriculum_files(self) -> Dict[str, Any]:
        """List curriculum files in blob storage"""
        if not self.blob_service:
            return {"success": False, "error": "Blob service not available", "files": []}

        try:
            curriculum_container = getattr(settings, 'CURRICULUM_CONTAINER_NAME', 'curriculum-data')
            container_client = self.blob_service.blob_service_client.get_container_client(curriculum_container)

            files = []
            for blob in container_client.list_blobs(name_starts_with="curriculum/"):
                try:
                    blob_client = container_client.get_blob_client(blob.name)
                    properties = blob_client.get_blob_properties()

                    files.append({
                        "name": blob.name,
                        "size": blob.size,
                        "last_modified": blob.last_modified.isoformat() if blob.last_modified else None,
                        "subject": properties.metadata.get("subject", "unknown"),
                        "file_type": properties.metadata.get("file_type", "unknown"),
                        "row_count": properties.metadata.get("row_count", "unknown")
                    })
                except Exception as e:
                    logger.warning(f"Could not get properties for {blob.name}: {e}")

            return {"success": True, "files": files, "total_count": len(files)}

        except Exception as e:
            return {"success": False, "error": str(e), "files": []}

    async def refresh_curriculum_cache(self, subject: Optional[str] = None) -> Dict[str, Any]:
        """Manually refresh curriculum cache"""
        try:
            self.clear_cache()

            # Re-check Firestore availability
            if self.firestore_service:
                subjects = await self.firestore_service.get_all_published_subjects()
                self._use_firestore = bool(subjects)

            return {
                "success": True,
                "message": f"Cache cleared. Firestore mode: {self._use_firestore}",
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def clear_cache(self):
        """Clear all cached data"""
        self._cache.clear()
        self._cache_timestamps.clear()

    # ============================================================================
    # BIGQUERY AUTHORED CONTENT METHODS (for content package generation)
    # ============================================================================

    async def get_subskill_foundations(
        self,
        subskill_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get authored foundational content for a subskill from BigQuery.

        Returns master_context, context_primitives, and approved_visual_schemas
        from the curriculum_subskill_foundations table.
        Returns None if BigQuery is unavailable.
        """
        if not self._use_bigquery or not self.bigquery_service:
            return None

        cache_key = f"subskill_foundations_{subskill_id}"

        if cache_key in self._cache and self._is_cache_valid(cache_key):
            return self._cache[cache_key]

        query = f"""
        SELECT
            subskill_id,
            version_id,
            master_context,
            context_primitives,
            approved_visual_schemas,
            generation_status,
            created_at,
            updated_at
        FROM `{self.bigquery_service.project_id}.{self.bigquery_service.dataset_id}.curriculum_subskill_foundations`
        WHERE subskill_id = @subskill_id
        LIMIT 1
        """

        from google.cloud import bigquery
        parameters = [bigquery.ScalarQueryParameter("subskill_id", "STRING", subskill_id)]

        try:
            results = await self.bigquery_service._run_query_async(query, parameters)

            if results and len(results) > 0:
                foundation = results[0]

                result = {
                    "subskill_id": foundation.get("subskill_id"),
                    "version_id": foundation.get("version_id"),
                    "master_context": foundation.get("master_context"),
                    "context_primitives": foundation.get("context_primitives"),
                    "approved_visual_schemas": foundation.get("approved_visual_schemas", []),
                    "generation_status": foundation.get("generation_status"),
                    "created_at": foundation.get("created_at"),
                    "updated_at": foundation.get("updated_at")
                }

                self._cache_set(cache_key, result)

                logger.info(f"✅ Found authored foundations for subskill {subskill_id}")
                return result
            else:
                logger.info(f"ℹ️ No authored foundations found for subskill {subskill_id}")
                return None

        except Exception as e:
            logger.error(f"❌ Error fetching subskill foundations for {subskill_id}: {e}")
            return None

    async def get_reading_content_by_subskill(
        self,
        subskill_id: str
    ) -> List[Dict[str, Any]]:
        """
        Get authored reading content sections for a subskill from BigQuery.
        Returns empty list if BigQuery is unavailable.
        """
        if not self._use_bigquery or not self.bigquery_service:
            return []

        cache_key = f"reading_content_{subskill_id}"

        if cache_key in self._cache and self._is_cache_valid(cache_key):
            return self._cache[cache_key]

        query = f"""
        SELECT
            subskill_id,
            version_id,
            section_id,
            section_order,
            title,
            heading,
            content_text,
            key_terms,
            concepts_covered,
            interactive_primitives,
            has_visual_snippet,
            generation_status,
            created_at,
            updated_at
        FROM `{self.bigquery_service.project_id}.{self.bigquery_service.dataset_id}.subskill_reading_content`
        WHERE subskill_id = @subskill_id
        ORDER BY section_order ASC
        """

        from google.cloud import bigquery
        parameters = [bigquery.ScalarQueryParameter("subskill_id", "STRING", subskill_id)]

        try:
            results = await self.bigquery_service._run_query_async(query, parameters)

            if results:
                self._cache_set(cache_key, results)
                logger.info(f"✅ Found {len(results)} reading sections for subskill {subskill_id}")
                return results
            else:
                logger.info(f"ℹ️ No reading content found for subskill {subskill_id}")
                return []

        except Exception as e:
            logger.error(f"❌ Error fetching reading content for {subskill_id}: {e}")
            return []

    async def get_visual_snippets_by_subskill(
        self,
        subskill_id: str
    ) -> Dict[str, str]:
        """
        Get authored visual snippets for a subskill from BigQuery.
        Returns empty dict if BigQuery is unavailable.
        """
        if not self._use_bigquery or not self.bigquery_service:
            return {}

        cache_key = f"visual_snippets_{subskill_id}"

        if cache_key in self._cache and self._is_cache_valid(cache_key):
            return self._cache[cache_key]

        query = f"""
        SELECT
            section_id,
            html_content,
            snippet_id,
            generation_prompt
        FROM `{self.bigquery_service.project_id}.{self.bigquery_service.dataset_id}.visual_snippets`
        WHERE subskill_id = @subskill_id
        """

        from google.cloud import bigquery
        parameters = [bigquery.ScalarQueryParameter("subskill_id", "STRING", subskill_id)]

        try:
            results = await self.bigquery_service._run_query_async(query, parameters)

            if results:
                visual_map = {
                    row['section_id']: row['html_content']
                    for row in results
                }

                self._cache_set(cache_key, visual_map)
                logger.info(f"✅ Found {len(visual_map)} visual snippets for subskill {subskill_id}")
                return visual_map
            else:
                logger.info(f"ℹ️ No visual snippets found for subskill {subskill_id}")
                return {}

        except Exception as e:
            logger.error(f"❌ Error fetching visual snippets for {subskill_id}: {e}")
            return {}
