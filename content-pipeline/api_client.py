"""
API Client for Backend Communication

Handles all communication with the FastAPI backend:
- Curriculum fetching (/subjects, /curriculum/{subject})
- Problem generation (/generate)
- Authentication
"""

import httpx
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)


class BackendAPIClient:
    """Client for communicating with the FastAPI backend"""

    def __init__(
        self,
        base_url: Optional[str] = None,
        auth_token: Optional[str] = None,
        timeout: float = 120.0
    ):
        self.base_url = base_url or os.getenv("BACKEND_URL", "http://localhost:8000")
        self.auth_token = auth_token or os.getenv("AUTH_TOKEN")
        self.timeout = timeout

        # Create HTTP client
        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=timeout,
            headers=self._get_headers()
        )

        logger.info(f"Initialized API client for {self.base_url}")

    def _get_headers(self) -> Dict[str, str]:
        """Get HTTP headers including auth if available"""
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

        if self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"

        return headers

    async def health_check(self) -> bool:
        """Check if backend is accessible"""
        try:
            response = await self.client.get("/api/problems/health")
            response.raise_for_status()
            logger.info(f"Backend health check: {response.json()}")
            return True
        except Exception as e:
            logger.error(f"Backend health check failed: {str(e)}")
            return False

    # ========================================================================
    # CURRICULUM ENDPOINTS
    # ========================================================================

    async def get_available_subjects(self) -> List[str]:
        """
        Fetch list of all available subjects from /subjects endpoint

        Returns:
            List of subject names (e.g., ['math', 'reading', 'science'])
        """
        try:
            response = await self.client.get("/api/curriculum/subjects")
            response.raise_for_status()
            data = response.json()
            subjects = data.get("subjects", [])
            logger.info(f"Fetched {len(subjects)} subjects: {subjects}")
            return subjects
        except Exception as e:
            logger.error(f"Error fetching subjects: {str(e)}")
            raise

    async def get_curriculum(self, subject: str) -> List[Dict[str, Any]]:
        """
        Fetch complete curriculum structure for a subject

        Args:
            subject: Subject name (e.g., 'math')

        Returns:
            List of curriculum units with nested skills and subskills
            [
                {
                    "id": "unit-1",
                    "title": "Numbers to 10",
                    "skills": [
                        {
                            "id": "counting",
                            "description": "Count objects...",
                            "subskills": [
                                {"id": "count-to-5", "description": "...", "difficulty_range": {...}}
                            ]
                        }
                    ]
                }
            ]
        """
        try:
            response = await self.client.get(f"/api/curriculum/curriculum/{subject}")
            response.raise_for_status()
            data = response.json()
            curriculum = data.get("curriculum", [])
            logger.info(f"Fetched curriculum for {subject}: {len(curriculum)} units")
            return curriculum
        except Exception as e:
            logger.error(f"Error fetching curriculum for {subject}: {str(e)}")
            raise

    async def get_full_curriculum_tree(
        self,
        subjects: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Fetch complete curriculum tree across all subjects (or specified subjects)

        This is the main method for getting all testable curriculum nodes.

        Args:
            subjects: Optional list of subjects to fetch. If None, fetches all.

        Returns:
            Flattened list of testable nodes:
            [
                {
                    "subject": "math",
                    "unit_id": "unit-1",
                    "unit_title": "Numbers to 10",
                    "skill_id": "counting",
                    "skill_description": "Count objects...",
                    "subskill_id": "count-to-5",
                    "subskill_description": "Count objects 1-5",
                    "grade_level": "K",
                    "difficulty_range": {"start": 1, "end": 3, "target": 2}
                },
                ...
            ]
        """
        # Fetch subjects if not provided
        if subjects is None:
            subjects = await self.get_available_subjects()

        testable_nodes = []

        for subject in subjects:
            logger.info(f"Fetching curriculum tree for {subject}...")

            try:
                curriculum = await self.get_curriculum(subject)

                # Flatten the hierarchical structure
                for unit in curriculum:
                    unit_id = unit.get("id")
                    unit_title = unit.get("title")
                    grade_level = unit.get("grade", "unknown")

                    for skill in unit.get("skills", []):
                        skill_id = skill.get("id")
                        skill_description = skill.get("description")

                        for subskill in skill.get("subskills", []):
                            subskill_id = subskill.get("id")
                            subskill_description = subskill.get("description")
                            difficulty_range = subskill.get("difficulty_range", {})

                            testable_nodes.append({
                                "subject": subject,
                                "unit_id": unit_id,
                                "unit_title": unit_title,
                                "skill_id": skill_id,
                                "skill_description": skill_description,
                                "subskill_id": subskill_id,
                                "subskill_description": subskill_description,
                                "grade_level": grade_level,
                                "difficulty_range": difficulty_range
                            })

                logger.info(f"Extracted {len(testable_nodes)} testable nodes so far...")

            except Exception as e:
                logger.warning(f"Failed to fetch curriculum for {subject}: {str(e)}")
                continue

        logger.info(f"Total testable nodes across all subjects: {len(testable_nodes)}")
        return testable_nodes

    # ========================================================================
    # PROBLEM GENERATION ENDPOINTS
    # ========================================================================

    async def generate_problem_for_skill(
        self,
        subject: str,
        unit_id: Optional[str] = None,
        skill_id: Optional[str] = None,
        subskill_id: Optional[str] = None,
        difficulty: Optional[float] = None,
        count: int = 1
    ) -> Dict[str, Any]:
        """
        Generate problem(s) via /generate endpoint

        Args:
            subject: Subject (required)
            unit_id: Unit identifier (optional)
            skill_id: Skill identifier (optional)
            subskill_id: Subskill identifier (optional)
            difficulty: Difficulty level (optional)
            count: Number of problems to generate (default 1)

        Returns:
            Problem dict or list of problem dicts (depending on count)
            {
                "problem_type": "multiple_choice",
                "problem": "...",
                "answer": "...",
                "success_criteria": [...],
                "teaching_note": "...",
                "metadata": {...},
                ...
            }
        """
        start_time = datetime.now()

        payload = {
            "subject": subject,
            "unit_id": unit_id,
            "skill_id": skill_id,
            "subskill_id": subskill_id,
            "difficulty": difficulty,
            "count": count
        }

        # Remove None values
        payload = {k: v for k, v in payload.items() if v is not None}

        try:
            logger.info(f"Generating {count} problem(s) with payload: {payload}")
            response = await self.client.post("/api/problems/generate", json=payload)
            response.raise_for_status()

            generation_time = (datetime.now() - start_time).total_seconds() * 1000

            problem_data = response.json()

            # Log the raw response structure
            logger.info(f"Problem generated in {generation_time:.2f}ms")
            logger.info(f"Response type: {type(problem_data)}")
            if isinstance(problem_data, dict):
                logger.info(f"Response keys: {list(problem_data.keys())}")
                # Log visual intent specifically
                if "question_visual_intent" in problem_data:
                    logger.info(f"question_visual_intent: {problem_data['question_visual_intent']}")
                if "statement_visual_intent" in problem_data:
                    logger.info(f"statement_visual_intent: {problem_data['statement_visual_intent']}")
            elif isinstance(problem_data, list) and problem_data:
                logger.info(f"Response list length: {len(problem_data)}")
                logger.info(f"First item keys: {list(problem_data[0].keys()) if problem_data else 'empty'}")

            # Add generation metadata
            if isinstance(problem_data, dict):
                problem_data["_generation_time_ms"] = generation_time
            elif isinstance(problem_data, list):
                for p in problem_data:
                    p["_generation_time_ms"] = generation_time

            return problem_data

        except httpx.ReadTimeout:
            logger.warning(f"Request timed out after {self.timeout}s while generating {count} problem(s). Backend may still be processing.")
            return None
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error generating problem: {e.response.status_code} - {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"Error generating problem: {str(e)}")
            raise

    async def close(self):
        """Close the HTTP client"""
        await self.client.aclose()
        logger.info("API client closed")

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()
