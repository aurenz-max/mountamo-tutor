"""
Connection Suggestion Engine — Gemini-Powered Edge Recommendations

Hierarchical search pipeline:
  1. Skill-level embedding (25 skills → 300 pairs) — fast coarse filter
  2. Skill-pair LLM triage — which skill pairs have pedagogical connections?
  3. Subskill drill-down — for matched skill pairs, embed and compare subskills
  4. Subskill LLM refinement — relationship typing, strength, gating decisions
  5. Impact simulation + validation

Uses google.genai client with gemini-embedding-2-preview for embeddings
and gemini-3-flash-preview for LLM refinement.

Checkpointing: Each phase saves results to Firestore so the pipeline can
resume from the last completed phase if something fails mid-run.
"""

import json
import logging
import uuid
from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from google import genai
from google.genai import types
import numpy as np

from app.core.config import settings
from app.models.edges import RelationshipType
from app.models.suggestions import EdgeSuggestion, SuggestionImpact
from app.services.graph_analysis import GraphAnalysisEngine

logger = logging.getLogger(__name__)

EMBEDDING_MODEL = "gemini-embedding-2-preview"
LLM_MODEL = "gemini-3-flash-preview"
LLM_MODEL_LITE = "gemini-3.1-flash-lite-preview"


class PipelineCheckpoint:
    """Firestore-backed checkpoint storage for suggestion pipeline phases.

    Saves intermediate results after each phase so the pipeline can resume
    from the last completed phase on failure. Each run is identified by
    subject_id and a hash of the graph state (node/edge counts).
    """

    def __init__(self, firestore_client: Optional[Any] = None):
        self.firestore = firestore_client

    def _run_doc(self, subject_id: str):
        if not self.firestore:
            return None
        return (
            self.firestore
            .collection("suggestion_runs")
            .document(subject_id)
        )

    def _graph_fingerprint(self, nodes: List[Dict], edges: List[Dict]) -> str:
        """Quick fingerprint so we invalidate checkpoints when the graph changes."""
        node_ids = sorted(n.get("id", "") for n in nodes)
        edge_keys = sorted(f"{e.get('source','')}->{e.get('target','')}" for e in edges)
        import hashlib
        h = hashlib.md5(
            f"{len(node_ids)}:{','.join(node_ids[:10])}|{len(edge_keys)}".encode()
        ).hexdigest()[:12]
        return h

    async def load(self, subject_id: str, nodes: List[Dict], edges: List[Dict]) -> Optional[Dict]:
        """Load checkpoint if it exists and matches current graph state."""
        doc_ref = self._run_doc(subject_id)
        if not doc_ref:
            return None
        try:
            doc = doc_ref.get()
            if not doc.exists:
                return None
            data = doc.to_dict()
            fp = self._graph_fingerprint(nodes, edges)
            if data.get("graph_fingerprint") != fp:
                logger.info(f"Checkpoint stale (graph changed) — starting fresh")
                return None
            logger.info(
                f"Resuming from checkpoint: last completed phase = {data.get('last_phase', 0)}"
            )
            return data
        except Exception as e:
            logger.warning(f"Failed to load checkpoint: {e}")
            return None

    async def save(
        self,
        subject_id: str,
        phase: int,
        nodes: List[Dict],
        edges: List[Dict],
        phase_data: Dict,
    ) -> None:
        """Save checkpoint after a phase completes."""
        doc_ref = self._run_doc(subject_id)
        if not doc_ref:
            return
        try:
            fp = self._graph_fingerprint(nodes, edges)
            doc_ref.set({
                "graph_fingerprint": fp,
                "last_phase": phase,
                "updated_at": datetime.utcnow().isoformat(),
                **phase_data,
            }, merge=True)
            logger.info(f"Checkpoint saved: phase {phase}")
        except Exception as e:
            logger.warning(f"Failed to save checkpoint (non-blocking): {e}")

    async def clear(self, subject_id: str) -> None:
        """Clear checkpoint after successful completion."""
        doc_ref = self._run_doc(subject_id)
        if not doc_ref:
            return
        try:
            doc_ref.delete()
        except Exception:
            pass


class SuggestionEngine:
    """Generates edge suggestions using hierarchical embedding search + Gemini."""

    def __init__(self, firestore_client: Optional[Any] = None):
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
        self.analysis = GraphAnalysisEngine()
        self.checkpoint = PipelineCheckpoint(firestore_client)

    # ================================================================== #
    #  Main Pipeline
    # ================================================================== #

    async def generate_suggestions(
        self,
        subject_id: str,
        nodes: List[Dict],
        edges: List[Dict],
        max_suggestions: int = 0,
    ) -> List[EdgeSuggestion]:
        """Hierarchical suggestion pipeline with checkpointing.

        Phase 1: Skill-level — embed 25 skills, find similar pairs (300 combos)
        Phase 2: LLM triage — which skill pairs have pedagogical connections?
        Phase 3: Subskill drill-down — for matched skills, pairwise subskill comparison
        Phase 4: LLM refinement — relationship typing on subskill pairs
        Phase 5: Impact simulation + validation + ranking

        max_suggestions: 0 = no limit (return all valid suggestions).
            Applied as a skill-pair cap BEFORE Phase 3, so expensive subskill
            work is only done on pairs we'll actually keep.

        Checkpointing: Each phase saves results to Firestore. If the pipeline
        fails mid-run, the next call resumes from the last completed phase.
        """
        logger.info(f"Generating suggestions for {subject_id} (max={max_suggestions or 'unlimited'})")

        node_map = {n["id"]: n for n in nodes}

        # Build indexes
        skill_nodes = [n for n in nodes if n.get("type") == "skill"]
        subskill_nodes = [n for n in nodes if n.get("type") == "subskill"]
        skill_to_subskills: Dict[str, List[Dict]] = defaultdict(list)
        for ss in subskill_nodes:
            sid = ss.get("skill_id", "")
            if sid:
                skill_to_subskills[sid].append(ss)

        existing_pairs = {(e["source"], e["target"]) for e in edges}
        existing_pairs |= {(e["target"], e["source"]) for e in edges}

        logger.info(
            f"Graph: {len(skill_nodes)} skills, {len(subskill_nodes)} subskills, "
            f"{len(edges)} existing edges"
        )

        # Try to resume from checkpoint
        checkpoint = await self.checkpoint.load(subject_id, nodes, edges)
        last_phase = checkpoint.get("last_phase", 0) if checkpoint else 0

        # ---- Phase 1: Skill-level embedding ----
        if last_phase >= 1 and checkpoint:
            matched_skill_pairs = self._restore_skill_pairs(
                checkpoint.get("phase1_pairs", []), skill_nodes
            )
            logger.info(f"Phase 1: RESUMED — {len(matched_skill_pairs)} skill pairs from checkpoint")
        else:
            matched_skill_pairs = await self._phase1_skill_embedding(
                skill_nodes, skill_to_subskills
            )
            logger.info(f"Phase 1: {len(matched_skill_pairs)} skill pairs above threshold")
            await self.checkpoint.save(subject_id, 1, nodes, edges, {
                "phase1_pairs": self._serialize_skill_pairs(matched_skill_pairs),
            })

        # ---- Phase 2: LLM triage on skill pairs ----
        if last_phase >= 2 and checkpoint:
            approved_skill_pairs = self._restore_approved_pairs(
                checkpoint.get("phase2_approved", []), skill_nodes
            )
            logger.info(f"Phase 2: RESUMED — {len(approved_skill_pairs)} skill pairs from checkpoint")
        else:
            approved_skill_pairs = await self._phase2_skill_triage(
                matched_skill_pairs, subject_id
            )
            logger.info(f"Phase 2: {len(approved_skill_pairs)} skill pairs approved by LLM")
            await self.checkpoint.save(subject_id, 2, nodes, edges, {
                "phase2_approved": self._serialize_approved_pairs(approved_skill_pairs),
            })

        # ---- Apply max_suggestions cap BEFORE expensive subskill work ----
        # Each skill pair produces ~5 subskill candidates (max_per_skill_pair).
        # Cap the skill pairs so we don't do expensive embedding + LLM work
        # on pairs whose suggestions we'd just discard.
        if max_suggestions > 0:
            # Each skill pair → ~5 subskill candidates → ~60% survive Phase 4
            # So to get N suggestions, we need ~N/3 skill pairs
            skill_pair_cap = max(max_suggestions // 3, 5)
            if len(approved_skill_pairs) > skill_pair_cap:
                logger.info(
                    f"Capping skill pairs: {len(approved_skill_pairs)} → {skill_pair_cap} "
                    f"(targeting ~{max_suggestions} final suggestions)"
                )
                approved_skill_pairs = approved_skill_pairs[:skill_pair_cap]

        # ---- Phase 3: Subskill drill-down ----
        if last_phase >= 3 and checkpoint:
            subskill_candidates = checkpoint.get("phase3_candidates", [])
            logger.info(f"Phase 3: RESUMED — {len(subskill_candidates)} subskill candidates from checkpoint")
        else:
            subskill_candidates = await self._phase3_subskill_drilldown(
                approved_skill_pairs, skill_to_subskills, existing_pairs
            )
            logger.info(f"Phase 3: {len(subskill_candidates)} subskill candidates from drill-down")
            await self.checkpoint.save(subject_id, 3, nodes, edges, {
                "phase3_candidates": subskill_candidates,
            })

        if not subskill_candidates:
            await self.checkpoint.clear(subject_id)
            return []

        # ---- Phase 4: LLM refinement on subskill pairs ----
        if last_phase >= 4 and checkpoint:
            suggestions = self._restore_suggestions(
                checkpoint.get("phase4_suggestions", []), subject_id
            )
            logger.info(f"Phase 4: RESUMED — {len(suggestions)} suggestions from checkpoint")
        else:
            suggestions = await self._phase4_subskill_refinement(
                subskill_candidates, nodes, subject_id
            )
            logger.info(f"Phase 4: {len(suggestions)} suggestions after LLM refinement")
            await self.checkpoint.save(subject_id, 4, nodes, edges, {
                "phase4_suggestions": [s.model_dump(mode="json") for s in suggestions],
            })

        # ---- Phase 5: Impact simulation + validation ----
        valid_suggestions = self._phase5_validate_and_rank(
            suggestions, nodes, edges
        )
        logger.info(f"Phase 5: {len(valid_suggestions)} valid suggestions after validation")

        # Apply final cap if set (but the real savings happened at the skill-pair level)
        if max_suggestions > 0 and len(valid_suggestions) > max_suggestions:
            logger.info(f"Final cap: {len(valid_suggestions)} → {max_suggestions}")
            valid_suggestions = valid_suggestions[:max_suggestions]

        # Pipeline complete — clear checkpoint
        await self.checkpoint.clear(subject_id)

        return valid_suggestions

    # ================================================================== #
    #  Checkpoint serialization helpers
    # ================================================================== #

    @staticmethod
    def _serialize_skill_pairs(
        pairs: List[Tuple[Dict, Dict, float]],
    ) -> List[Dict]:
        return [
            {"a_id": a["id"], "b_id": b["id"], "sim": sim}
            for a, b, sim in pairs
        ]

    @staticmethod
    def _restore_skill_pairs(
        serialized: List[Dict], skill_nodes: List[Dict],
    ) -> List[Tuple[Dict, Dict, float]]:
        node_map = {n["id"]: n for n in skill_nodes}
        result = []
        for item in serialized:
            a = node_map.get(item["a_id"])
            b = node_map.get(item["b_id"])
            if a and b:
                result.append((a, b, item["sim"]))
        return result

    @staticmethod
    def _serialize_approved_pairs(
        pairs: List[Tuple[Dict, Dict, str]],
    ) -> List[Dict]:
        return [
            {"a_id": a["id"], "b_id": b["id"], "rationale": r}
            for a, b, r in pairs
        ]

    @staticmethod
    def _restore_approved_pairs(
        serialized: List[Dict], skill_nodes: List[Dict],
    ) -> List[Tuple[Dict, Dict, str]]:
        node_map = {n["id"]: n for n in skill_nodes}
        result = []
        for item in serialized:
            a = node_map.get(item["a_id"])
            b = node_map.get(item["b_id"])
            if a and b:
                result.append((a, b, item.get("rationale", "")))
        return result

    @staticmethod
    def _restore_suggestions(
        serialized: List[Dict], subject_id: str,
    ) -> List[EdgeSuggestion]:
        result = []
        for item in serialized:
            try:
                result.append(EdgeSuggestion(**item))
            except Exception:
                pass
        return result

    # ================================================================== #
    #  Phase 1: Skill-Level Embedding
    # ================================================================== #

    async def _phase1_skill_embedding(
        self,
        skill_nodes: List[Dict],
        skill_to_subskills: Dict[str, List[Dict]],
        similarity_threshold: float = 0.70,
    ) -> List[Tuple[Dict, Dict, float]]:
        """Embed skills with hierarchy context, find similar pairs.

        25 skills → 300 pairs. Cheap and fast.
        Returns [(skill_a, skill_b, similarity), ...].
        """
        if len(skill_nodes) < 2:
            return []

        # Build rich skill descriptions that summarize their subskills
        descriptions = []
        for skill in skill_nodes:
            descriptions.append(self._build_skill_embedding_text(
                skill, skill_to_subskills.get(skill["id"], [])
            ))

        logger.info(f"Phase 1: Embedding {len(descriptions)} skills")
        logger.info(f"  Sample: {descriptions[0][:150]}...")

        try:
            embeddings = await self._compute_embeddings(descriptions)
        except Exception as e:
            logger.error(f"Phase 1 embedding failed: {e}")
            return []

        # Cosine similarity matrix
        emb_array = np.array(embeddings)
        norms = np.linalg.norm(emb_array, axis=1, keepdims=True)
        norms = np.where(norms == 0, 1, norms)
        normalized = emb_array / norms
        sim_matrix = normalized @ normalized.T

        # Collect pairs above threshold (skip same-unit for now — we want cross-unit)
        pairs: List[Tuple[Dict, Dict, float]] = []
        for i in range(len(skill_nodes)):
            for j in range(i + 1, len(skill_nodes)):
                sim = float(sim_matrix[i, j])
                is_cross_unit = (
                    skill_nodes[i].get("unit_id") != skill_nodes[j].get("unit_id")
                )
                # Lower threshold for cross-unit (more valuable)
                threshold = similarity_threshold - 0.05 if is_cross_unit else similarity_threshold
                if sim >= threshold:
                    pairs.append((skill_nodes[i], skill_nodes[j], sim))

        pairs.sort(key=lambda p: -p[2])

        logger.info(
            f"Phase 1: {len(pairs)} skill pairs above threshold "
            f"(cross-unit: {sum(1 for a,b,_ in pairs if a.get('unit_id') != b.get('unit_id'))})"
        )

        return pairs

    @staticmethod
    def _build_skill_embedding_text(
        skill: Dict, subskills: List[Dict]
    ) -> str:
        """Build a rich skill description that includes unit context and subskill summary.

        Format:
          [Geometry > Identify and describe shapes]
          Subskills: Match 2D shapes; Identify shapes in environment; Count shape properties; ...
        """
        unit = skill.get("unit_title", "")
        label = skill.get("label", "")

        parts = []
        if unit:
            parts.append(f"[{unit} > {label}]")
        else:
            parts.append(label)

        if subskills:
            # Include subskill descriptions (truncated) for richer signal
            ss_texts = [ss.get("label", "")[:60] for ss in subskills[:7]]
            parts.append("Subskills: " + "; ".join(ss_texts))

        return " ".join(parts)

    # ================================================================== #
    #  Phase 2: Skill-Pair LLM Triage
    # ================================================================== #

    async def _phase2_skill_triage(
        self,
        skill_pairs: List[Tuple[Dict, Dict, float]],
        subject_id: str,
    ) -> List[Tuple[Dict, Dict, str]]:
        """LLM evaluates which skill pairs have real pedagogical connections.

        Processes in batches of 25 skill pairs per LLM call.
        Uses JSON mode with structured schema.
        """
        if not skill_pairs:
            return []

        triage_schema = types.Schema(
            type=types.Type.ARRAY,
            items=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "pair_index": types.Schema(type=types.Type.INTEGER),
                    "accept": types.Schema(type=types.Type.BOOLEAN),
                    "connection_type": types.Schema(type=types.Type.STRING),
                    "rationale": types.Schema(type=types.Type.STRING),
                },
                required=["pair_index", "accept", "connection_type", "rationale"],
            ),
        )

        approved: List[Tuple[Dict, Dict, str]] = []
        batch_size = 25

        for batch_start in range(0, len(skill_pairs), batch_size):
            batch = skill_pairs[batch_start:batch_start + batch_size]

            candidate_text = "\n".join(
                f"{i+1}. [{a.get('unit_title','?')} > {a.get('label','')}] "
                f"<-> [{b.get('unit_title','?')} > {b.get('label','')}] "
                f"(similarity: {sim:.2f})"
                for i, (a, b, sim) in enumerate(batch)
            )

            prompt = f"""You are an expert curriculum designer for kindergarten {subject_id}.

I have {len(batch)} skill pairs identified by semantic similarity. For each, decide:
Does a meaningful pedagogical connection exist between these two skills?

Skills pairs:
{candidate_text}

Accept if there is a real pedagogical connection (shared concepts, progressive difficulty, transfer of learning, complementary practice). Reject if superficial or coincidental. Keep rationale under 15 words."""

            try:
                response = self.client.models.generate_content(
                    model=LLM_MODEL_LITE,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        temperature=0.3,
                        max_output_tokens=32000,
                        response_mime_type="application/json",
                        response_schema=triage_schema,
                    ),
                )
                evaluations = json.loads(response.text)
            except Exception as e:
                logger.error(f"Phase 2 triage batch at {batch_start} failed: {e}")
                # Fallback: accept all in this batch
                evaluations = [
                    {"pair_index": i + 1, "accept": True,
                     "connection_type": "unknown", "rationale": "Triage fallback"}
                    for i in range(len(batch))
                ]

            for ev in evaluations:
                if not ev.get("accept", False):
                    continue
                idx = ev.get("pair_index", 0) - 1
                if 0 <= idx < len(batch):
                    skill_a, skill_b, _ = batch[idx]
                    approved.append((skill_a, skill_b, ev.get("rationale", "")))

            logger.info(
                f"Phase 2 batch {batch_start//batch_size + 1}: "
                f"{sum(1 for e in evaluations if e.get('accept'))} accepted / {len(batch)}"
            )

        return approved

    # ================================================================== #
    #  Phase 3: Subskill Drill-Down
    # ================================================================== #

    async def _phase3_subskill_drilldown(
        self,
        approved_skill_pairs: List[Tuple[Dict, Dict, str]],
        skill_to_subskills: Dict[str, List[Dict]],
        existing_pairs: set,
        similarity_threshold: float = 0.60,
        max_per_skill_pair: int = 5,
    ) -> List[Dict]:
        """For each approved skill pair, embed their subskills and find best matches.

        A skill with 7 subskills matched to another with 6 = 42 pairs.
        30 approved skill pairs × ~40 pairs each = ~1200 total — still tractable.
        We only keep the top N per skill pair.
        """
        all_candidates: List[Dict] = []

        # Collect all unique subskills we need to embed
        subskills_to_embed: Dict[str, Dict] = {}  # id -> node
        for skill_a, skill_b, _ in approved_skill_pairs:
            for ss in skill_to_subskills.get(skill_a["id"], []):
                subskills_to_embed[ss["id"]] = ss
            for ss in skill_to_subskills.get(skill_b["id"], []):
                subskills_to_embed[ss["id"]] = ss

        if not subskills_to_embed:
            return []

        # Embed all needed subskills at once (deduplicated)
        ss_list = list(subskills_to_embed.values())
        ss_ids = [ss["id"] for ss in ss_list]
        descriptions = [self._build_embedding_text(ss) for ss in ss_list]

        logger.info(
            f"Phase 3: Embedding {len(descriptions)} unique subskills "
            f"from {len(approved_skill_pairs)} skill pairs"
        )

        try:
            embeddings = await self._compute_embeddings(descriptions)
        except Exception as e:
            logger.error(f"Phase 3 embedding failed: {e}")
            return []

        # Build embedding lookup
        emb_map: Dict[str, np.ndarray] = {}
        for ss_id, emb in zip(ss_ids, embeddings):
            vec = np.array(emb)
            norm = np.linalg.norm(vec)
            emb_map[ss_id] = vec / norm if norm > 0 else vec

        # For each approved skill pair, compare their subskills
        for skill_a, skill_b, skill_rationale in approved_skill_pairs:
            ss_a = skill_to_subskills.get(skill_a["id"], [])
            ss_b = skill_to_subskills.get(skill_b["id"], [])

            if not ss_a or not ss_b:
                continue

            # Pairwise similarity
            pair_scores: List[Tuple[Dict, Dict, float]] = []
            for sa in ss_a:
                for sb in ss_b:
                    if (sa["id"], sb["id"]) in existing_pairs:
                        continue
                    ea = emb_map.get(sa["id"])
                    eb = emb_map.get(sb["id"])
                    if ea is None or eb is None:
                        continue
                    sim = float(np.dot(ea, eb))
                    if sim >= similarity_threshold:
                        pair_scores.append((sa, sb, sim))

            # Keep top N per skill pair
            pair_scores.sort(key=lambda p: -p[2])
            for sa, sb, sim in pair_scores[:max_per_skill_pair]:
                all_candidates.append({
                    "source_id": sa["id"],
                    "target_id": sb["id"],
                    "source_label": sa.get("label", ""),
                    "target_label": sb.get("label", ""),
                    "origin": "hierarchical",
                    "reason": f"Skill match: {skill_a.get('label','')} <-> {skill_b.get('label','')} (subskill sim: {sim:.2f})",
                    "similarity": sim,
                    "skill_rationale": skill_rationale,
                })

        logger.info(
            f"Phase 3: {len(all_candidates)} subskill candidates "
            f"(avg {len(all_candidates)/max(len(approved_skill_pairs),1):.1f} per skill pair)"
        )

        return all_candidates

    # ================================================================== #
    #  Phase 4: Subskill LLM Refinement
    # ================================================================== #

    async def _phase4_subskill_refinement(
        self,
        candidates: List[Dict],
        nodes: List[Dict],
        subject_id: str,
    ) -> List[EdgeSuggestion]:
        """LLM evaluates subskill pairs for relationship type, strength, gating.

        Processes in batches of 10. Uses full hierarchy context.
        """
        if not candidates:
            return []

        all_suggestions: List[EdgeSuggestion] = []
        batch_size = 10

        for batch_start in range(0, len(candidates), batch_size):
            batch = candidates[batch_start:batch_start + batch_size]
            batch_suggestions = await self._refine_batch(
                batch, batch_start, nodes, subject_id
            )
            all_suggestions.extend(batch_suggestions)

        return all_suggestions

    # ================================================================== #
    #  Phase 5: Validate & Rank
    # ================================================================== #

    def _phase5_validate_and_rank(
        self,
        suggestions: List[EdgeSuggestion],
        nodes: List[Dict],
        edges: List[Dict],
    ) -> List[EdgeSuggestion]:
        """Impact simulation, validation, ranking."""
        for suggestion in suggestions:
            proposed_edge = {
                "source": suggestion.source_entity_id,
                "target": suggestion.target_entity_id,
                "relationship": suggestion.relationship,
                "strength": suggestion.strength,
                "is_prerequisite": suggestion.is_prerequisite,
            }
            suggestion.impact = self.analysis.compute_impact(nodes, edges, [proposed_edge])

        valid = []
        for s in suggestions:
            edge_dict = {
                "source": s.source_entity_id,
                "target": s.target_entity_id,
                "relationship": s.relationship,
                "is_prerequisite": s.is_prerequisite,
            }
            is_valid, warnings = self.analysis.validate_edge(nodes, edges, edge_dict)
            if is_valid:
                valid.append(s)
            else:
                logger.info(f"Filtered invalid suggestion: {warnings}")

        # Rank: cross-unit edges first, then by confidence * impact
        valid.sort(key=lambda s: (
            # Cross-unit bonus: +10 to sort key
            -(10 if s.source_entity_id.split("-")[0] != s.target_entity_id.split("-")[0] else 0),
            -(s.confidence * abs(s.impact.health_score_delta + 0.1)),
        ))

        return valid

    # ================================================================== #
    #  Shared Helpers
    # ================================================================== #

    @staticmethod
    def _build_embedding_text(node: Dict) -> str:
        """Build a rich text string for embedding that includes the full hierarchy.

        Format: "[Unit > Skill] subskill description (difficulty: X-Y)"
        """
        unit = node.get("unit_title", "")
        skill = node.get("skill_description", "")
        label = node.get("label", "")
        diff_start = node.get("difficulty_start")
        diff_end = node.get("difficulty_end")

        parts = []
        if unit and skill:
            parts.append(f"[{unit} > {skill}]")
        elif unit:
            parts.append(f"[{unit}]")
        parts.append(label)
        if diff_start is not None and diff_end is not None:
            parts.append(f"(difficulty: {diff_start}-{diff_end})")

        return " ".join(parts)

    @staticmethod
    def _build_candidate_text(node_map: Dict, node_id: str) -> str:
        """Build rich text for LLM candidate display."""
        node = node_map.get(node_id, {})
        unit = node.get("unit_title", "")
        skill = node.get("skill_description", "")
        label = node.get("label", node_id)
        diff_start = node.get("difficulty_start")
        diff_end = node.get("difficulty_end")

        hierarchy = " > ".join(filter(None, [unit, skill]))
        diff = f" (difficulty: {diff_start}-{diff_end})" if diff_start is not None else ""
        if hierarchy:
            return f"{hierarchy} > \"{label}\"{diff}"
        return f"\"{label}\"{diff}"

    async def _compute_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Compute Gemini embeddings in batches of 100."""
        results = []
        batch_size = 100
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            response = self.client.models.embed_content(
                model=EMBEDDING_MODEL,
                contents=batch,
            )
            for embedding in response.embeddings:
                results.append(embedding.values)
        return results

    async def _refine_batch(
        self,
        batch: List[Dict],
        global_offset: int,
        nodes: List[Dict],
        subject_id: str,
    ) -> List[EdgeSuggestion]:
        """Refine a single batch of subskill candidates via Gemini JSON mode."""
        node_map = {n["id"]: n for n in nodes}

        candidate_text = "\n".join(
            f"{i+1}. {self._build_candidate_text(node_map, c['source_id'])} ({c['source_id']})\n"
            f"   -> {self._build_candidate_text(node_map, c['target_id'])} ({c['target_id']})\n"
            f"   [{c['reason']}]"
            for i, c in enumerate(batch)
        )

        prompt = f"""You are an expert curriculum designer analyzing a {subject_id} knowledge graph for kindergarten students.

Each candidate shows the full hierarchy: Unit > Skill > "subskill description" (difficulty range).

Evaluate {len(batch)} potential connections. For each, decide:
1. Does this connection make pedagogical sense given the unit/skill context?
2. What relationship type fits?
3. How strongly related (0.0-1.0)?
4. Should it be a prerequisite gate (must master A before B)?

Candidates:
{candidate_text}

Relationship types:
- prerequisite: A must be mastered before B (use sparingly, only for true developmental dependencies)
- builds_on: B extends A's concepts (most common for progression within or across domains)
- reinforces: Practicing A strengthens B (good for review pairing across related skills)
- parallel: A and B are peers at similar difficulty (cross-domain breadth, good for session variety)
- applies: A is abstract, B is applied context (transfer of learning)

Set accept=false for connections that don't make pedagogical sense.
Keep rationale under 20 words."""

        evaluation_schema = types.Schema(
            type=types.Type.ARRAY,
            items=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "candidate_index": types.Schema(type=types.Type.INTEGER),
                    "accept": types.Schema(type=types.Type.BOOLEAN),
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
                    "candidate_index", "accept", "relationship",
                    "strength", "is_prerequisite", "rationale", "confidence",
                ],
            ),
        )

        try:
            response = self.client.models.generate_content(
                model=LLM_MODEL_LITE,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.3,
                    max_output_tokens=32000,
                    response_mime_type="application/json",
                    response_schema=evaluation_schema,
                ),
            )
            evaluations = json.loads(response.text)
        except Exception as e:
            logger.error(f"LLM refinement failed for batch at offset {global_offset}: {e}")
            evaluations = [
                {
                    "candidate_index": i + 1,
                    "accept": True,
                    "relationship": "builds_on",
                    "strength": 0.7,
                    "is_prerequisite": False,
                    "rationale": c.get("reason", "Structural or semantic connection"),
                    "confidence": 0.5,
                }
                for i, c in enumerate(batch)
            ]

        suggestions: List[EdgeSuggestion] = []
        for eval_item in evaluations:
            if not eval_item.get("accept", False):
                continue

            idx = eval_item.get("candidate_index", 0) - 1
            if idx < 0 or idx >= len(batch):
                continue

            candidate = batch[idx]
            suggestions.append(EdgeSuggestion(
                suggestion_id=str(uuid.uuid4()),
                subject_id=subject_id,
                source_entity_id=candidate["source_id"],
                source_label=candidate.get("source_label", ""),
                target_entity_id=candidate["target_id"],
                target_label=candidate.get("target_label", ""),
                relationship=eval_item.get("relationship", "builds_on"),
                strength=eval_item.get("strength", 0.7),
                is_prerequisite=eval_item.get("is_prerequisite", False),
                threshold=0.8 if eval_item.get("is_prerequisite") else None,
                rationale=eval_item.get("rationale", ""),
                confidence=eval_item.get("confidence", 0.5),
            ))

        return suggestions
