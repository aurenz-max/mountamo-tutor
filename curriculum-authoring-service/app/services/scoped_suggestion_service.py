"""
Scoped Suggestion Service — Lightweight Edge Suggestions During Authoring

Separate from the bulk SuggestionEngine because the design goals differ:
  - Bulk: 5 phases, 20-100+ Gemini calls, 2-10 minutes, periodic audit
  - Scoped: 1-2 Gemini calls, 2-5 seconds, inline during authoring

The author defines exactly which skills/subskills to analyze. No full-subject
sweeps, no embedding pipeline. Goes directly to a single rich LLM call with
full context.

Storage:
  curriculum_graphs/{grade}/subjects/{subject_id}/suggestions/{suggestion_id}

See docs/prds/GRAPH_AWARE_AUTHORING.md for the full design.
"""

import json
import logging
import time
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from google import genai
from google.genai import types

from app.core.config import settings
from app.db.firestore_curriculum_reader import firestore_reader
from app.db.firestore_curriculum_service import firestore_curriculum_sync
from app.models.edges import RelationshipType
from app.models.scoped_suggestions import (
    AcceptScopedSuggestionsRequest,
    AcceptScopedSuggestionsResponse,
    ConnectSkillsRequest,
    ConnectSkillsResponse,
    ScopedEdgeSuggestion,
    ScopedSuggestionRequest,
    ScopedSuggestionResponse,
    ScopeSummary,
    SkillConnection,
    SkillConnectionSummary,
)
from app.models.suggestions import EdgeSuggestion
from app.services.edge_manager import EdgeManager

logger = logging.getLogger(__name__)

LLM_MODEL = "gemini-3.1-flash-lite-preview"


def _parse_json_lenient(text: str) -> list:
    """Parse a JSON array, recovering partial results from truncated output.

    Gemini sometimes truncates long structured-output responses mid-object,
    producing invalid JSON.  This salvages all complete objects before the
    truncation point.
    """
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Strategy: find the last complete object by looking for "},\n" or "}\n]"
    # and truncate there, closing the array.
    last_complete = text.rfind("}")
    while last_complete > 0:
        candidate = text[: last_complete + 1].rstrip().rstrip(",") + "\n]"
        # Ensure it starts with '['
        start = candidate.find("[")
        if start >= 0:
            try:
                result = json.loads(candidate[start:])
                logger.warning(
                    f"Recovered {len(result)} items from truncated Gemini JSON "
                    f"(original {len(text)} chars, used {last_complete + 1})"
                )
                return result
            except json.JSONDecodeError:
                pass
        last_complete = text.rfind("}", 0, last_complete)

    logger.error("Could not recover any items from malformed Gemini JSON")
    raise ValueError(f"Unparseable Gemini response ({len(text)} chars)")


class ScopedSuggestionService:
    """Lightweight, scoped edge suggestions for inline authoring."""

    def __init__(
        self,
        edge_manager: EdgeManager,
        firestore_client: Optional[Any] = None,
    ):
        self.edges = edge_manager
        self.firestore = firestore_client
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)

    # ------------------------------------------------------------------ #
    #  suggest_edges — scoped multi-skill suggestion
    # ------------------------------------------------------------------ #

    async def suggest_edges(
        self, request: ScopedSuggestionRequest
    ) -> ScopedSuggestionResponse:
        """Generate edge suggestions for a scoped set of skills/subskills.

        1. Load metadata for scoped nodes
        2. Load existing edges between them (dedup)
        3. Single Gemini call with full context
        4. Validate and return
        """
        start = time.monotonic()

        # 1. Load scoped nodes (subject_id passed for O(1) lookup)
        source_nodes = await self._load_scoped_nodes(
            request.subject_id,
            request.scope.skill_ids,
            request.scope.subskill_ids,
        )

        # Load cross-grade nodes if requested
        cross_grade_nodes: List[Dict] = []
        if request.scope.cross_grade_subject_ids:
            for sid in request.scope.cross_grade_subject_ids:
                if sid != request.subject_id:
                    cg_nodes = await self._load_subject_nodes(sid)
                    cross_grade_nodes.extend(cg_nodes)

        all_nodes = source_nodes + cross_grade_nodes

        if len(all_nodes) < 2:
            return ScopedSuggestionResponse(
                suggestions=[],
                scope_summary=ScopeSummary(
                    source_nodes_analyzed=len(source_nodes),
                    elapsed_ms=int((time.monotonic() - start) * 1000),
                ),
            )

        # 2. Load existing edges between scoped nodes
        node_ids = {n["id"] for n in all_nodes}
        existing_edges = await self._load_existing_edges(
            request.subject_id, node_ids
        )

        # 3. Single Gemini call
        suggestions = await self._generate_scoped_suggestions(
            all_nodes,
            existing_edges,
            request.options.relationship_types,
            request.options.max_suggestions,
            request.options.depth,
        )

        # 4. Store suggestions in hierarchical subcollection
        for s in suggestions:
            data = s.model_dump(mode="json")
            data["origin"] = "scoped"
            data["status"] = "pending"
            data["created_at"] = datetime.utcnow().isoformat()
            await firestore_curriculum_sync.sync_suggestion(request.subject_id, data)

        elapsed = int((time.monotonic() - start) * 1000)

        return ScopedSuggestionResponse(
            suggestions=suggestions,
            scope_summary=ScopeSummary(
                source_nodes_analyzed=len(source_nodes),
                target_nodes_analyzed=len(cross_grade_nodes),
                cross_grade_nodes_included=len(cross_grade_nodes),
                gemini_calls=1,
                elapsed_ms=elapsed,
            ),
        )

    # ------------------------------------------------------------------ #
    #  connect_skills — pairwise skill connection
    # ------------------------------------------------------------------ #

    async def connect_skills(
        self, request: ConnectSkillsRequest
    ) -> ConnectSkillsResponse:
        """Find all subskill-level connections between exactly two skills."""
        start = time.monotonic()

        # Load both skills' subskill trees (subject_id for O(1) lookups)
        source_nodes = await self._load_skill_subskills(
            request.source_subject_id, request.source_skill_id
        )
        target_nodes = await self._load_skill_subskills(
            request.target_subject_id, request.target_skill_id
        )

        if not source_nodes or not target_nodes:
            return ConnectSkillsResponse(
                connections=[],
                skill_summary=SkillConnectionSummary(
                    source_subskills=len(source_nodes),
                    target_subskills=len(target_nodes),
                    elapsed_ms=int((time.monotonic() - start) * 1000),
                ),
            )

        # Load existing edges between these skill families
        all_ids = {n["id"] for n in source_nodes + target_nodes}
        existing_edges = await self._load_existing_edges(
            request.source_subject_id, all_ids
        )

        # Single Gemini call for pairwise analysis
        connections = await self._generate_pairwise_connections(
            source_nodes,
            target_nodes,
            existing_edges,
            request.relationship_types,
        )

        # Store as suggestions (using source subject)
        subject_id = request.source_subject_id
        for conn in connections:
            suggestion = ScopedEdgeSuggestion(
                suggestion_id=str(uuid.uuid4()),
                source_entity_id=conn.source_subskill_id,
                source_entity_type="subskill",
                source_label=conn.source_label,
                target_entity_id=conn.target_subskill_id,
                target_entity_type="subskill",
                target_label=conn.target_label,
                relationship=conn.relationship,
                strength=conn.strength,
                is_prerequisite=conn.is_prerequisite,
                rationale=conn.rationale,
                confidence=conn.confidence,
            )
            data = suggestion.model_dump(mode="json")
            data["subject_id"] = subject_id  # Ensure subject_id stored for accept-all
            data["origin"] = "connect_skills"
            data["status"] = "pending"
            data["created_at"] = datetime.utcnow().isoformat()
            await firestore_curriculum_sync.sync_suggestion(subject_id, data)

        elapsed = int((time.monotonic() - start) * 1000)

        return ConnectSkillsResponse(
            connections=connections,
            skill_summary=SkillConnectionSummary(
                source_subskills=len(source_nodes),
                target_subskills=len(target_nodes),
                connections_found=len(connections),
                gemini_calls=1,
                elapsed_ms=elapsed,
            ),
        )

    # ------------------------------------------------------------------ #
    #  accept_suggestions — inline accept
    # ------------------------------------------------------------------ #

    async def accept_suggestions(
        self, request: AcceptScopedSuggestionsRequest
    ) -> AcceptScopedSuggestionsResponse:
        """Accept scoped suggestions, creating draft edges via EdgeManager."""
        from app.services.version_control import version_control
        from app.models.edges import CurriculumEdgeCreate

        version_id = await version_control.get_or_create_active_version(
            request.subject_id, "agent"
        )

        edge_ids: List[str] = []

        for suggestion_id in request.suggestion_ids:
            suggestion = await firestore_reader.get_suggestion(
                request.subject_id, suggestion_id
            )
            if not suggestion:
                logger.warning(f"Suggestion {suggestion_id} not found — skipping")
                continue

            edge_create = CurriculumEdgeCreate(
                source_entity_id=suggestion.get("source_entity_id", ""),
                source_entity_type=suggestion.get("source_entity_type", "subskill"),
                target_entity_id=suggestion.get("target_entity_id", ""),
                target_entity_type=suggestion.get("target_entity_type", "subskill"),
                relationship=suggestion.get("relationship", "builds_on"),
                strength=suggestion.get("strength", 0.8),
                is_prerequisite=suggestion.get("is_prerequisite", False),
                min_proficiency_threshold=0.8 if suggestion.get("is_prerequisite") else None,
                rationale=suggestion.get("rationale", ""),
                authored_by="agent",
                confidence=suggestion.get("confidence"),
            )

            created = await self.edges.create_edge(
                edge_create, version_id, request.subject_id
            )
            edge_ids.append(created.edge_id)

            # Mark as accepted
            await firestore_curriculum_sync.update_suggestion(
                request.subject_id, suggestion_id, {
                    "status": "accepted",
                    "reviewed_at": datetime.utcnow().isoformat(),
                }
            )

        return AcceptScopedSuggestionsResponse(
            accepted=len(edge_ids),
            edge_ids=edge_ids,
        )

    # ================================================================== #
    #  Data Loading (all subject-scoped for O(1) lookups)
    # ================================================================== #

    async def _load_scoped_nodes(
        self,
        subject_id: str,
        skill_ids: List[str],
        subskill_ids: List[str],
    ) -> List[Dict]:
        """Load full metadata for scoped skills and their subskills."""
        nodes: List[Dict] = []

        if skill_ids:
            for skill_id in skill_ids:
                skill_nodes = await self._load_skill_subskills(
                    subject_id, skill_id
                )
                nodes.extend(skill_nodes)

        if subskill_ids:
            for ss_id in subskill_ids:
                node = await self._load_subskill(subject_id, ss_id)
                if node:
                    nodes.append(node)

        # Deduplicate by id
        seen = set()
        deduped = []
        for n in nodes:
            if n["id"] not in seen:
                seen.add(n["id"])
                deduped.append(n)

        return deduped

    async def _load_skill_subskills(
        self, subject_id: str, skill_id: str
    ) -> List[Dict]:
        """Load all subskills for a skill with full hierarchy context.

        Uses subject_id for O(1) document lookup instead of scanning all subjects.
        """
        skill_doc = await firestore_reader.get_skill(skill_id, subject_id=subject_id)
        if not skill_doc:
            return []

        unit_doc = await firestore_reader.get_unit(
            skill_doc.get("unit_id", ""), subject_id=subject_id
        )
        subskill_docs = await firestore_reader.get_subskills_by_skill(
            skill_id, subject_id=subject_id, include_drafts=True
        )

        return [
            {
                "id": ss["subskill_id"],
                "type": "subskill",
                "label": ss["subskill_description"],
                "subject_id": subject_id,
                "unit_id": unit_doc.get("unit_id", "") if unit_doc else "",
                "unit_title": unit_doc.get("unit_title", "") if unit_doc else "",
                "unit_order": unit_doc.get("unit_order") if unit_doc else None,
                "skill_id": skill_id,
                "skill_description": skill_doc.get("skill_description", ""),
                "skill_order": skill_doc.get("skill_order"),
                "subskill_order": ss.get("subskill_order"),
                "difficulty_start": ss.get("difficulty_start"),
                "difficulty_end": ss.get("difficulty_end"),
                "target_difficulty": ss.get("target_difficulty"),
            }
            for ss in subskill_docs
        ]

    async def _load_subskill(
        self, subject_id: str, subskill_id: str
    ) -> Optional[Dict]:
        """Load a single subskill with full hierarchy context."""
        ss = await firestore_reader.get_subskill(subskill_id, subject_id=subject_id)
        if not ss:
            return None

        skill_doc = await firestore_reader.get_skill(
            ss.get("skill_id", ""), subject_id=subject_id
        )
        unit_doc = await firestore_reader.get_unit(
            skill_doc.get("unit_id", ""), subject_id=subject_id
        ) if skill_doc else None

        return {
            "id": ss["subskill_id"],
            "type": "subskill",
            "label": ss["subskill_description"],
            "subject_id": subject_id,
            "unit_id": unit_doc.get("unit_id", "") if unit_doc else "",
            "unit_title": unit_doc.get("unit_title", "") if unit_doc else "",
            "unit_order": unit_doc.get("unit_order") if unit_doc else None,
            "skill_id": skill_doc.get("skill_id", "") if skill_doc else "",
            "skill_description": skill_doc.get("skill_description", "") if skill_doc else "",
            "skill_order": skill_doc.get("skill_order") if skill_doc else None,
            "subskill_order": ss.get("subskill_order"),
            "difficulty_start": ss.get("difficulty_start"),
            "difficulty_end": ss.get("difficulty_end"),
            "target_difficulty": ss.get("target_difficulty"),
        }

    async def _load_subject_nodes(self, subject_id: str) -> List[Dict]:
        """Load all subskills for a subject (for cross-grade context)."""
        all_nodes = await firestore_reader.get_subject_graph_nodes(subject_id, include_drafts=False)
        return [n for n in all_nodes if n["type"] == "subskill"]

    async def _load_existing_edges(
        self, subject_id: str, node_ids: set
    ) -> List[Dict]:
        """Load existing edges between scoped nodes (for dedup)."""
        if not node_ids:
            return []

        all_edges = await firestore_reader.get_edges_for_subject(subject_id, include_drafts=True)

        return [
            e for e in all_edges
            if e.get("source_entity_id") in node_ids
            or e.get("target_entity_id") in node_ids
        ]

    # ================================================================== #
    #  LLM: Scoped Suggestions
    # ================================================================== #

    async def _generate_scoped_suggestions(
        self,
        nodes: List[Dict],
        existing_edges: List[Dict],
        relationship_types: List[RelationshipType],
        max_suggestions: int,
        depth: str,
    ) -> List[ScopedEdgeSuggestion]:
        """Single Gemini call to generate scoped edge suggestions."""
        logger.info(
            f"[SCOPED] Generating suggestions: {len(nodes)} nodes, "
            f"{len(existing_edges)} existing edges, max={max_suggestions}"
        )
        nodes_text = self._format_nodes_for_prompt(nodes)
        edges_text = self._format_edges_for_prompt(existing_edges)
        types_text = ", ".join(relationship_types)

        prompt = f"""You are a curriculum architect analyzing connections between specific skills
in a K-12 educational curriculum.

## Nodes to Analyze
{nodes_text}

## Existing Edges (avoid duplicating these)
{edges_text if edges_text else "None — this is a fresh scope."}

## Task
Identify pedagogically meaningful connections between the listed subskills.
For each connection, specify:
- source_id and target_id (exact IDs from the list above)
- relationship type: {types_text}
- strength (0.0-1.0)
- whether it gates progression (is_prerequisite) — use sparingly
- brief rationale (max 20 words)

## Relationship Type Guide
- prerequisite: true developmental dependency (student CANNOT succeed at target without source mastery)
- builds_on: conceptual extension (most common)
- reinforces: practicing source strengthens target (review pairing)
- parallel: peers at similar difficulty (cross-domain breadth)
- applies: source is abstract, target is applied context

## Constraints
- Use prerequisite sparingly — most connections are builds_on
- Consider difficulty ranges: higher difficulty source should not be prerequisite for lower difficulty target
- Do not suggest edges that duplicate existing ones
- Return at most {max_suggestions} suggestions
- Only suggest connections that make strong pedagogical sense"""

        schema = types.Schema(
            type=types.Type.ARRAY,
            items=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "source_id": types.Schema(type=types.Type.STRING),
                    "target_id": types.Schema(type=types.Type.STRING),
                    "relationship": types.Schema(
                        type=types.Type.STRING,
                        enum=["prerequisite", "builds_on", "reinforces", "parallel", "applies"],
                    ),
                    "strength": types.Schema(type=types.Type.NUMBER),
                    "is_prerequisite": types.Schema(type=types.Type.BOOLEAN),
                    "rationale": types.Schema(type=types.Type.STRING),
                    "confidence": types.Schema(type=types.Type.NUMBER),
                },
                required=[
                    "source_id", "target_id", "relationship",
                    "strength", "is_prerequisite", "rationale", "confidence",
                ],
            ),
        )

        prompt_chars = len(prompt)
        logger.info(f"[SCOPED] Prompt size: {prompt_chars} chars, {len(nodes)} nodes in scope")

        try:
            response = self.client.models.generate_content(
                model=LLM_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.3,
                    max_output_tokens=65536,
                    response_mime_type="application/json",
                    response_schema=schema,
                ),
            )
            raw = _parse_json_lenient(response.text)
        except Exception as e:
            logger.error(f"Scoped suggestion LLM call failed: {e}")
            return []

        logger.info(f"[SCOPED] Gemini returned {len(raw)} raw items ({len(response.text)} chars)")

        node_map = {n["id"]: n for n in nodes}

        rejected_ids: List[str] = []
        suggestions: List[ScopedEdgeSuggestion] = []
        for item in raw[:max_suggestions]:
            src_id = item.get("source_id", "")
            tgt_id = item.get("target_id", "")

            if src_id not in node_map or tgt_id not in node_map:
                rejected_ids.append(f"{src_id}->{tgt_id}")
                continue

            src_node = node_map[src_id]
            tgt_node = node_map[tgt_id]

            suggestions.append(ScopedEdgeSuggestion(
                suggestion_id=str(uuid.uuid4()),
                source_entity_id=src_id,
                source_entity_type="subskill",
                source_label=src_node.get("label", ""),
                source_context=self._node_context(src_node),
                target_entity_id=tgt_id,
                target_entity_type="subskill",
                target_label=tgt_node.get("label", ""),
                target_context=self._node_context(tgt_node),
                relationship=item.get("relationship", "builds_on"),
                strength=max(0.0, min(1.0, item.get("strength", 0.8))),
                is_prerequisite=item.get("is_prerequisite", False),
                rationale=item.get("rationale", ""),
                confidence=max(0.0, min(1.0, item.get("confidence", 0.7))),
            ))

        if rejected_ids:
            logger.warning(
                f"[SCOPED] Rejected {len(rejected_ids)} items with unknown IDs: "
                f"{rejected_ids[:5]}{'...' if len(rejected_ids) > 5 else ''}"
            )
        logger.info(
            f"[SCOPED] Result: {len(suggestions)} valid suggestions "
            f"({len(raw)} raw, {len(rejected_ids)} rejected)"
        )

        return suggestions

    # ================================================================== #
    #  LLM: Pairwise Connections
    # ================================================================== #

    async def _generate_pairwise_connections(
        self,
        source_nodes: List[Dict],
        target_nodes: List[Dict],
        existing_edges: List[Dict],
        relationship_types: List[RelationshipType],
    ) -> List[SkillConnection]:
        """Single Gemini call for pairwise skill connection analysis."""
        src_skill = source_nodes[0].get("skill_id", "?") if source_nodes else "?"
        tgt_skill = target_nodes[0].get("skill_id", "?") if target_nodes else "?"
        logger.info(
            f"[PAIRWISE] {src_skill} → {tgt_skill}: "
            f"{len(source_nodes)} source subskills, {len(target_nodes)} target subskills, "
            f"{len(existing_edges)} existing edges"
        )
        source_text = self._format_nodes_for_prompt(source_nodes)
        target_text = self._format_nodes_for_prompt(target_nodes)
        edges_text = self._format_edges_for_prompt(existing_edges)
        types_text = ", ".join(relationship_types)

        source_subject = source_nodes[0].get("subject_id", "") if source_nodes else ""
        target_subject = target_nodes[0].get("subject_id", "") if target_nodes else ""

        grade_note = ""
        if source_subject != target_subject:
            grade_note = f"\nNote: Source is from {source_subject}, target is from {target_subject}. Consider cross-grade developmental progression."

        prompt = f"""You are a curriculum architect analyzing connections between two specific skills
in a K-12 educational curriculum.{grade_note}

## Source Skill Subskills
{source_text}

## Target Skill Subskills
{target_text}

## Existing Edges (avoid duplicating)
{edges_text if edges_text else "None"}

## Task
Find all meaningful subskill-level connections from source to target.
For each connection, specify:
- source_subskill_id and target_subskill_id (exact IDs)
- relationship type: {types_text}
- strength (0.0-1.0)
- whether it gates progression (is_prerequisite)
- brief rationale (max 20 words)

## Relationship Type Guide
- prerequisite: true developmental dependency (student CANNOT succeed at target without source mastery)
- builds_on: conceptual extension (most common)
- reinforces: practicing source strengthens target
- parallel: peers at similar difficulty
- applies: source is abstract, target is applied context

## Constraints
- Use prerequisite sparingly — most connections are builds_on
- Consider difficulty ranges when determining direction
- Do not duplicate existing edges"""

        schema = types.Schema(
            type=types.Type.ARRAY,
            items=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "source_subskill_id": types.Schema(type=types.Type.STRING),
                    "target_subskill_id": types.Schema(type=types.Type.STRING),
                    "relationship": types.Schema(
                        type=types.Type.STRING,
                        enum=["prerequisite", "builds_on", "reinforces", "parallel", "applies"],
                    ),
                    "strength": types.Schema(type=types.Type.NUMBER),
                    "is_prerequisite": types.Schema(type=types.Type.BOOLEAN),
                    "rationale": types.Schema(type=types.Type.STRING),
                    "confidence": types.Schema(type=types.Type.NUMBER),
                },
                required=[
                    "source_subskill_id", "target_subskill_id", "relationship",
                    "strength", "is_prerequisite", "rationale", "confidence",
                ],
            ),
        )

        try:
            response = self.client.models.generate_content(
                model=LLM_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.3,
                    max_output_tokens=65536,
                    response_mime_type="application/json",
                    response_schema=schema,
                ),
            )
            raw = _parse_json_lenient(response.text)
        except Exception as e:
            logger.error(f"Pairwise connection LLM call failed: {e}")
            return []

        logger.info(
            f"[PAIRWISE] {src_skill} → {tgt_skill}: "
            f"Gemini returned {len(raw)} raw items ({len(response.text)} chars)"
        )

        source_ids = {n["id"] for n in source_nodes}
        target_ids = {n["id"] for n in target_nodes}
        node_map = {n["id"]: n for n in source_nodes + target_nodes}

        rejected_count = 0
        connections: List[SkillConnection] = []
        for item in raw:
            src_id = item.get("source_subskill_id", "")
            tgt_id = item.get("target_subskill_id", "")

            if src_id not in source_ids or tgt_id not in target_ids:
                rejected_count += 1
                continue

            connections.append(SkillConnection(
                source_subskill_id=src_id,
                source_label=node_map.get(src_id, {}).get("label", ""),
                target_subskill_id=tgt_id,
                target_label=node_map.get(tgt_id, {}).get("label", ""),
                relationship=item.get("relationship", "builds_on"),
                strength=max(0.0, min(1.0, item.get("strength", 0.8))),
                is_prerequisite=item.get("is_prerequisite", False),
                rationale=item.get("rationale", ""),
                confidence=max(0.0, min(1.0, item.get("confidence", 0.7))),
            ))

        if rejected_count:
            logger.warning(
                f"[PAIRWISE] {src_skill} → {tgt_skill}: "
                f"rejected {rejected_count}/{len(raw)} items (IDs not in source/target sets)"
            )
        logger.info(
            f"[PAIRWISE] {src_skill} → {tgt_skill}: "
            f"{len(connections)} valid connections "
            f"({len(raw)} raw, {rejected_count} rejected)"
        )

        return connections

    # ================================================================== #
    #  Prompt Helpers
    # ================================================================== #

    @staticmethod
    def _format_nodes_for_prompt(nodes: List[Dict]) -> str:
        """Format nodes with full hierarchy context for the LLM prompt."""
        lines = []
        for n in nodes:
            unit = n.get("unit_title", "")
            skill = n.get("skill_description", "")
            label = n.get("label", "")
            diff_start = n.get("difficulty_start")
            diff_end = n.get("difficulty_end")
            nid = n["id"]

            hierarchy = " > ".join(filter(None, [unit, skill]))
            diff = f" (difficulty: {diff_start}-{diff_end})" if diff_start is not None else ""

            lines.append(f"- {nid}: {hierarchy} > \"{label}\"{diff}")

        return "\n".join(lines)

    @staticmethod
    def _format_edges_for_prompt(edges: List[Dict]) -> str:
        """Format existing edges for dedup context."""
        if not edges:
            return ""
        lines = []
        for e in edges:
            src = e.get("source_entity_id", e.get("source", ""))
            tgt = e.get("target_entity_id", e.get("target", ""))
            rel = e.get("relationship", "prerequisite")
            lines.append(f"- {src} -> {tgt} ({rel})")
        return "\n".join(lines[:30])

    @staticmethod
    def _node_context(node: Dict) -> str:
        """Build human-readable context string for a node."""
        parts = []
        subject = node.get("subject_id", "")
        unit = node.get("unit_title", "")
        skill_desc = node.get("skill_description", "")
        if subject:
            parts.append(subject)
        if unit:
            parts.append(unit)
        if skill_desc:
            parts.append(skill_desc)
        return " > ".join(parts)
