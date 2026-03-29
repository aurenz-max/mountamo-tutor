"""
Agentic Graph Analysis API endpoints.

Exposes the CurriculumGraphAgentService capabilities:
  - Health reports (structural analysis)
  - Suggestion generation (Gemini-powered)
  - Suggestion review workflow (accept/reject)
  - Impact preview (before/after projection)
"""

import logging
from typing import List
from fastapi import APIRouter, HTTPException, Request

from app.models.suggestions import (
    EdgeSuggestion, GraphHealthReport, SuggestionImpact,
)

logger = logging.getLogger(__name__)
router = APIRouter()


def _get_agent(request: Request):
    """Get the graph agent from app state (initialized at startup)."""
    agent = getattr(request.app.state, "graph_agent", None)
    if agent is None:
        raise HTTPException(
            status_code=503,
            detail="Graph agent service not initialized",
        )
    return agent


@router.get("/{subject_id}/health", response_model=GraphHealthReport)
async def get_graph_health(subject_id: str, request: Request):
    """Get cached graph health report (re-analyzed on graph mutations)."""
    agent = _get_agent(request)
    return await agent.analyze_graph(subject_id)


@router.post("/{subject_id}/suggest", response_model=List[EdgeSuggestion])
async def generate_suggestions(
    subject_id: str,
    request: Request,
    max_suggestions: int = 0,
):
    """Trigger suggestion generation (Gemini-powered analysis).

    This is an expensive operation — calls Gemini embeddings + LLM.
    Results are stored in Firestore and returned.
    """
    agent = _get_agent(request)
    try:
        return await agent.suggest_connections(subject_id, max_suggestions)
    except Exception as e:
        logger.error(f"Suggestion generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{subject_id}/suggestions", response_model=List[EdgeSuggestion])
async def list_pending_suggestions(subject_id: str, request: Request):
    """List all pending suggestions for a subject."""
    from app.db.firestore_curriculum_reader import firestore_reader
    _get_agent(request)  # Ensure agent is initialized
    data = await firestore_reader.get_suggestions_for_subject(subject_id, status="pending")
    results = []
    for d in data:
        # Inject subject_id (scoped suggestions may omit or null it)
        d["subject_id"] = subject_id
        # Provide defaults for fields that may be missing from scoped origin
        d.setdefault("rationale", "")
        d.setdefault("confidence", 0.0)
        try:
            results.append(EdgeSuggestion(**d))
        except Exception as e:
            logger.warning(f"Skipping malformed suggestion {d.get('suggestion_id', '?')}: {e}")
    return results


@router.post("/{subject_id}/suggestions/accept-all")
async def bulk_accept_all(subject_id: str, request: Request):
    """Accept all pending suggestions in bulk — creates draft edges via streaming insert."""
    agent = _get_agent(request)
    try:
        result = await agent.bulk_accept_all(subject_id)
        return result
    except Exception as e:
        logger.error(f"Bulk accept failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{subject_id}/suggestions/{suggestion_id}/accept")
async def accept_suggestion(
    subject_id: str, suggestion_id: str, request: Request
):
    """Accept a suggestion: creates a draft edge in the knowledge graph."""
    agent = _get_agent(request)
    try:
        edge = await agent.accept_suggestion(subject_id, suggestion_id)
        return {
            "message": "Suggestion accepted — draft edge created",
            "edge": {
                "source": edge.source_entity_id,
                "target": edge.target_entity_id,
                "relationship": edge.relationship,
                "strength": edge.strength,
                "is_prerequisite": edge.is_prerequisite,
            },
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{subject_id}/suggestions/{suggestion_id}/reject")
async def reject_suggestion(
    subject_id: str, suggestion_id: str, request: Request
):
    """Reject a suggestion."""
    agent = _get_agent(request)
    await agent.reject_suggestion(subject_id, suggestion_id)
    return {"message": "Suggestion rejected"}


@router.post("/{subject_id}/reclassify")
async def reclassify_suggestions(
    subject_id: str,
    request: Request,
    dry_run: bool = False,
):
    """Reclassify pending suggestions using tiered promotion rules.

    Promotes high-signal builds_on/applies edges to prerequisite,
    drops gate on weak ones. Based on strength * confidence scoring
    and domain-path analysis.

    Query params:
      - dry_run: if true, returns what would change without writing
    """
    agent = _get_agent(request)

    # Domain-agnostic rules — domain context is now read from curriculum metadata
    rules = {
        "combo_promote_threshold": 0.76,
        "combo_drop_threshold": 0.60,
        "redundancy_cap": 2,
    }

    if dry_run:
        return {"message": "Use dry_run=false to apply. Rules applied:", "rules": {
            "tier1_promote": "strength * confidence >= 0.76 → prerequisite",
            "tier2_same_unit": "0.60-0.75 + same unit → prerequisite",
            "tier2_cross_unit": "0.60-0.75 + cross unit → drop gate",
            "tier3_drop": "strength * confidence < 0.60 → drop gate",
            "redundancy_cap": "max 2 gated targets per source node",
        }}

    try:
        result = await agent.reclassify_suggestions(subject_id, rules)
        return result
    except Exception as e:
        logger.error(f"Reclassification failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{subject_id}/impact-preview", response_model=SuggestionImpact)
async def preview_impact(subject_id: str, request: Request):
    """Preview cumulative impact if all pending suggestions are accepted."""
    agent = _get_agent(request)
    return await agent.preview_all_pending(subject_id)
