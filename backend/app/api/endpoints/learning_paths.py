# app/api/endpoints/learning_paths.py

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Dict, Any, List, Optional
import logging

from ...services.learning_paths import LearningPathsService
from ...dependencies import get_learning_paths_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/")
async def get_learning_paths_overview():
    """
    Get overview of learning paths API endpoints

    Returns available endpoints and their descriptions.
    """
    return {
        "service": "Learning Paths API",
        "description": "Prerequisite-based learning path recommendations using decision trees",
        "endpoints": {
            "graph_structure": {
                "/learning-graph": "Get complete prerequisite graph",
                "/prerequisites/{entity_id}": "Get prerequisites for a specific skill/subskill"
            },
            "student_specific": {
                "/student/{student_id}/recommendations": "Get personalized learning recommendations",
                "/student/{student_id}/unlocked-entities": "Get all unlocked skills/subskills",
                "/student/{student_id}/prerequisite-check/{entity_id}": "Check prerequisite status"
            },
            "visualization": {
                "/graph/visualization": "Get graph for frontend visualization",
                "/graph/skill/{skill_id}/details": "Get detailed skill information"
            },
            "utility": {
                "/health": "Service health check",
                "/analytics": "Graph structure analytics"
            }
        }
    }


# ==================== Graph Structure Endpoints ====================

@router.get("/learning-graph")
async def get_learning_graph(
    subject: Optional[str] = Query(None, description="Filter by subject (e.g., 'Mathematics')"),
    entity_type: Optional[str] = Query(None, description="Filter by 'skill' or 'subskill'"),
    include_metadata: bool = Query(True, description="Include metadata about graph structure"),
    learning_paths_service: LearningPathsService = Depends(get_learning_paths_service)
):
    """
    Get complete learning prerequisite graph

    Returns a graph structure with nodes (skills/subskills) and edges (prerequisites).
    Each edge has a proficiency threshold that must be met to unlock the target.

    Response:
    {
        "graph": {
            "nodes": [{"entity_id": str, "entity_type": str, "subject": str, "description": str}],
            "edges": [{"from_id": str, "from_type": str, "to_id": str, "to_type": str, "threshold": float}]
        },
        "metadata": {"total_nodes": int, "total_edges": int, "subjects": [str]}
    }
    """
    try:
        logger.info(f"Getting learning graph (subject={subject}, entity_type={entity_type})")

        graph = await learning_paths_service.get_learning_graph(
            subject=subject,
            entity_type=entity_type,
            include_metadata=include_metadata
        )

        logger.info(f"Successfully retrieved learning graph with {len(graph['graph']['nodes'])} nodes")
        return graph

    except Exception as e:
        logger.error(f"Error getting learning graph: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/prerequisites/{entity_id}")
async def get_prerequisites(
    entity_id: str,
    entity_type: Optional[str] = Query(None, description="'skill' or 'subskill' (auto-detect if not provided)"),
    learning_paths_service: LearningPathsService = Depends(get_learning_paths_service)
):
    """
    Get prerequisites for a specific entity (skill or subskill)

    Returns all prerequisites that must be met to unlock this entity, along with
    what this entity unlocks.

    Response:
    {
        "entity_id": str,
        "entity_type": str,
        "prerequisites": [{
            "prerequisite_id": str,
            "prerequisite_type": str,
            "min_proficiency_threshold": float,
            "subject": str,
            "description": str
        }],
        "unlocks": [{
            "unlocks_id": str,
            "unlocks_type": str,
            "threshold": float,
            "subject": str,
            "description": str
        }]
    }
    """
    try:
        logger.info(f"Getting prerequisites for {entity_id} (type={entity_type})")

        # Get prerequisites
        prerequisites = await learning_paths_service.get_entity_prerequisites(
            entity_id,
            entity_type
        )

        # Get what this entity unlocks
        unlocks = await learning_paths_service.get_entity_unlocks(
            entity_id,
            entity_type
        )

        # Detect entity type if not provided
        if entity_type is None:
            entity_type = learning_paths_service._detect_entity_type(entity_id)

        return {
            "entity_id": entity_id,
            "entity_type": entity_type,
            "prerequisites": prerequisites,
            "unlocks": unlocks
        }

    except Exception as e:
        logger.error(f"Error getting prerequisites for {entity_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Student-Specific Endpoints ====================

@router.get("/student/{student_id}/recommendations")
async def get_recommendations(
    student_id: int,
    subject: Optional[str] = Query(None, description="Filter by subject"),
    limit: int = Query(5, ge=1, le=20, description="Number of recommendations (1-20)"),
    learning_paths_service: LearningPathsService = Depends(get_learning_paths_service)
):
    """
    Get personalized learning recommendations for a student

    Returns recommended subskills based on:
    - Prerequisites met (unlocked)
    - Current proficiency (not yet mastered)
    - Priority (coverage gaps > performance gaps > nearly mastered)

    Response:
    {
        "recommendations": [{
            "entity_id": str,
            "entity_type": "subskill",
            "description": str,
            "subject": str,
            "skill_id": str,
            "skill_description": str,
            "priority": "high" | "medium",
            "priority_order": int,
            "reason": "coverage_gap" | "performance_gap" | "nearly_mastered",
            "message": str,
            "current_proficiency": float,
            "unlocked": true,
            "prerequisites_met": [...]
        }]
    }
    """
    try:
        logger.info(f"Getting recommendations for student {student_id} (subject={subject}, limit={limit})")

        recommendations = await learning_paths_service.get_recommendations(
            student_id=student_id,
            subject=subject,
            limit=limit
        )

        logger.info(f"Found {len(recommendations)} recommendations for student {student_id}")

        return {
            "recommendations": recommendations,
            "count": len(recommendations)
        }

    except Exception as e:
        logger.error(f"Error getting recommendations for student {student_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/student/{student_id}/unlocked-entities")
async def get_unlocked_entities(
    student_id: int,
    entity_type: Optional[str] = Query(None, description="Filter by 'skill' or 'subskill'"),
    subject: Optional[str] = Query(None, description="Filter by subject"),
    learning_paths_service: LearningPathsService = Depends(get_learning_paths_service)
):
    """
    Get all entities (skills/subskills) currently unlocked for a student

    An entity is unlocked when ALL of its prerequisites meet the required
    proficiency thresholds.

    Response:
    {
        "student_id": int,
        "unlocked_entities": [str],
        "count": int
    }
    """
    try:
        logger.info(f"Getting unlocked entities for student {student_id} (type={entity_type}, subject={subject})")

        unlocked = await learning_paths_service.get_unlocked_entities(
            student_id=student_id,
            entity_type=entity_type,
            subject=subject
        )

        return {
            "student_id": student_id,
            "unlocked_entities": sorted(list(unlocked)),
            "count": len(unlocked)
        }

    except Exception as e:
        logger.error(f"Error getting unlocked entities for student {student_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/student/{student_id}/prerequisite-check/{entity_id}")
async def check_prerequisite_status(
    student_id: int,
    entity_id: str,
    entity_type: Optional[str] = Query(None, description="'skill' or 'subskill' (auto-detect if not provided)"),
    learning_paths_service: LearningPathsService = Depends(get_learning_paths_service)
):
    """
    Check if a student has met all prerequisites for a specific entity

    Returns detailed information about each prerequisite and whether it's met.

    Response:
    {
        "student_id": int,
        "entity_id": str,
        "entity_type": str,
        "unlocked": bool,
        "prerequisites": [{
            "prerequisite_id": str,
            "prerequisite_type": str,
            "required_threshold": float,
            "current_proficiency": float,
            "met": bool
        }]
    }
    """
    try:
        logger.info(f"Checking prerequisites for student {student_id}, entity {entity_id}")

        # Detect entity type if not provided
        if entity_type is None:
            entity_type = learning_paths_service._detect_entity_type(entity_id)

        check_result = await learning_paths_service.check_prerequisites_met(
            student_id=student_id,
            target_entity_id=entity_id,
            target_entity_type=entity_type
        )

        return {
            "student_id": student_id,
            "entity_id": entity_id,
            "entity_type": entity_type,
            **check_result
        }

    except Exception as e:
        logger.error(f"Error checking prerequisites: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Visualization Endpoints ====================

@router.get("/graph/visualization")
async def get_graph_visualization(
    subject: Optional[str] = Query(None, description="Filter by subject"),
    student_id: Optional[int] = Query(None, description="Include student progress data"),
    learning_paths_service: LearningPathsService = Depends(get_learning_paths_service)
):
    """
    Get graph structure optimized for frontend visualization

    Returns units with nested skills and subskills, prerequisites, unlocks, and optional
    student progress data. Designed for interactive graph visualizations.

    Response:
    {
        "units": [{
            "unit_id": str,
            "unit_title": str,
            "subject": str,
            "skills": [{
                "skill_id": str,
                "skill_description": str,
                "subject": str,
                "subskills": [{
                    "subskill_id": str,
                    "description": str,
                    "sequence_order": int,
                    "difficulty_start": float,
                    "difficulty_end": float,
                    "prerequisites": [...],
                    "student_data": {  // if student_id provided
                        "unlocked": bool,
                        "proficiency": float,
                        "attempts": int
                    }
                }],
                "prerequisites": [...],
                "unlocks": [...]
            }]
        }]
    }
    """
    try:
        logger.info(f"Getting graph visualization (subject={subject}, student_id={student_id})")

        graph = await learning_paths_service.get_graph_for_visualization(
            subject=subject,
            student_id=student_id
        )

        logger.info(f"Retrieved visualization graph with {len(graph['units'])} units")

        return graph

    except Exception as e:
        logger.error(f"Error getting graph visualization: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/graph/skill/{skill_id}/details")
async def get_skill_details(
    skill_id: str,
    student_id: Optional[int] = Query(None, description="Include student progress data"),
    learning_paths_service: LearningPathsService = Depends(get_learning_paths_service)
):
    """
    Get detailed view of a specific skill with subskills and sequencing

    Returns comprehensive information about a skill including all subskills,
    their prerequisites, sequence order, and optional student progress.

    Response:
    {
        "skill_id": str,
        "skill_description": str,
        "subject": str,
        "subskills": [{
            "subskill_id": str,
            "description": str,
            "sequence_order": int,
            "difficulty_start": float,
            "difficulty_end": float,
            "prerequisites": [...],
            "student_data": {  // if student_id provided
                "unlocked": bool,
                "proficiency": float,
                "attempts": int
            }
        }],
        "prerequisites": [...],
        "unlocks": [...]
    }
    """
    try:
        logger.info(f"Getting skill details for {skill_id} (student_id={student_id})")

        skill_data = await learning_paths_service.get_skill_with_subskills(
            skill_id=skill_id,
            student_id=student_id
        )

        return skill_data

    except ValueError as e:
        logger.warning(f"Skill not found: {skill_id}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting skill details for {skill_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Student State Engine Endpoint ====================

@router.get("/{subject_id}/student-graph/{student_id}")
async def get_student_curriculum_graph(
    subject_id: str,
    student_id: int,
    include_drafts: bool = Query(
        False,
        description="Include draft curriculum (default: published only)"
    ),
    learning_paths_service: LearningPathsService = Depends(get_learning_paths_service)
):
    """
    Get curriculum graph decorated with student progress

    This endpoint implements the "Student State Engine" that shows:
    - Which skills/subskills are LOCKED (prerequisites not met)
    - Which are UNLOCKED (ready to practice)
    - Which are IN_PROGRESS (started but not mastered)
    - Which are MASTERED (proficiency >= 80%)

    Perfect for visualizing student position on curriculum graph.

    Response:
    {
        "nodes": [{
            // All original curriculum node fields, PLUS:
            "student_proficiency": 0.85,
            "status": "MASTERED" | "IN_PROGRESS" | "UNLOCKED" | "LOCKED",
            "attempt_count": 10,
            "last_attempt_at": "2025-10-24T18:30:00Z"
        }],
        "edges": [...],  // Original edges unchanged
        "student_id": 123,
        "subject_id": "MATHEMATICS",
        "version_id": "uuid-...",
        "generated_at": "2025-10-24T..."
    }

    Status Values:
    - LOCKED: Prerequisites not met, cannot practice
    - UNLOCKED: Prerequisites met, ready to start (proficiency = 0)
    - IN_PROGRESS: Started but not mastered (0 < proficiency < 0.8)
    - MASTERED: Mastered (proficiency >= 0.8)
    """
    try:
        logger.info(
            f"Getting student graph for student {student_id}, "
            f"subject {subject_id}, include_drafts={include_drafts}"
        )

        student_graph = await learning_paths_service.get_student_graph(
            student_id=student_id,
            subject_id=subject_id,
            include_drafts=include_drafts
        )

        logger.info(
            f"Successfully generated student graph with "
            f"{len(student_graph['nodes'])} nodes for student {student_id}"
        )

        return student_graph

    except ValueError as e:
        logger.warning(f"Graph not found: {str(e)}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting student graph: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Health & Utility Endpoints ====================

@router.get("/health")
async def learning_paths_health_check(
    learning_paths_service: LearningPathsService = Depends(get_learning_paths_service)
):
    """
    Check learning paths service health

    Tests BigQuery connectivity and query validation.
    """
    try:
        health = await learning_paths_service.health_check()

        if health["status"] not in ["healthy"]:
            raise HTTPException(status_code=503, detail="Service unhealthy")

        return health

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analytics")
async def get_learning_paths_analytics(
    subject: Optional[str] = Query(None, description="Filter by subject"),
    learning_paths_service: LearningPathsService = Depends(get_learning_paths_service)
):
    """
    Get analytics about learning paths graph structure

    Returns metadata about the prerequisite graph including node counts,
    edge counts, and subject distribution.
    """
    try:
        logger.info(f"Getting learning paths analytics (subject={subject})")

        # Get graph with metadata
        graph = await learning_paths_service.get_learning_graph(
            subject=subject,
            include_metadata=True
        )

        if not graph or not graph.get("graph"):
            raise HTTPException(
                status_code=404,
                detail="Learning paths not found"
            )

        metadata = graph.get("metadata", {})
        nodes = graph["graph"]["nodes"]
        edges = graph["graph"]["edges"]

        # Calculate additional analytics
        skills = [n for n in nodes if n["entity_type"] == "skill"]
        subskills = [n for n in nodes if n["entity_type"] == "subskill"]

        # Count nodes without prerequisites (starting points)
        entities_with_prerequisites = {e["to_id"] for e in edges}
        starting_entities = [n for n in nodes if n["entity_id"] not in entities_with_prerequisites]

        # Count terminal nodes (no unlocks)
        entities_that_unlock = {e["from_id"] for e in edges}
        terminal_entities = [n for n in nodes if n["entity_id"] not in entities_that_unlock]

        return {
            "metadata": metadata,
            "structure_analytics": {
                "total_nodes": len(nodes),
                "total_skills": len(skills),
                "total_subskills": len(subskills),
                "total_edges": len(edges),
                "average_edges_per_node": round(len(edges) / len(nodes), 2) if nodes else 0,
                "starting_entities": len(starting_entities),
                "terminal_entities": len(terminal_entities),
                "starting_entities_list": [n["entity_id"] for n in starting_entities[:10]],  # First 10
                "terminal_entities_list": [n["entity_id"] for n in terminal_entities[:10]]   # First 10
            },
            "threshold_distribution": {
                "0.8": len([e for e in edges if e["threshold"] == 0.8]),
                "0.9": len([e for e in edges if e["threshold"] == 0.9]),
                "other": len([e for e in edges if e["threshold"] not in [0.8, 0.9]])
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting analytics: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
