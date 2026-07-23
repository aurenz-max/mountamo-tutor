"""
Curriculum Retrieval Matcher

Scoped embedding retrieval for primitive -> curriculum-subskill attribution.
This is the root-cause fix for QA_curriculum_mapping_misattribution.md (§8): it
replaces forced-LLM *generation* (CurriculumMappingService._resolve_with_gemini)
with *retrieval* for the case where the primitive's subject domain is known.

Three faults the old generation path had, and how this fixes them:

  1. SCOPE — the old candidate set was never scoped. `get_curriculum(subject)`
     with no grade defaulted to Grade 1, so a Kindergarten primitive was matched
     against Grade-1 skills (its real skill was never even in the set), and with
     `subject_hint=None` the *full* cross-subject curriculum was offered, letting a
     math primitive map to a Language-Arts skill. Here we scope to (subject, grade)
     BEFORE matching: subject from the primitive's catalog domain, grade from the
     lesson.

  2. METHOD — generation forces an LLM to pick *something* and it hallucinates a
     confident wrong answer (LA @ 0.80 for an ordinal-line). Retrieval (embed ->
     cosine nearest neighbour) returns the pedagogically correct skill
     deterministically (ordinal-line -> COUNT001-04 @ 0.884, §11.3).

  3. ABSTAIN — a peaked, coherent top-k (one skill family) means "this primitive
     has a home"; a diffuse plateau of unrelated skills means "no home" -> we
     write nothing, show nothing (CLAUDE.md priority #1). Height alone is not
     enough: a wrong-grade ordinal-line scored 0.728 but was scattered across five
     unrelated skills, so the shape test catches it where a bare threshold would not.

Reuses the exact embedding technique as the authoring-service SuggestionEngine
(`gemini-embedding-2-preview` + cosine + threshold). The abstain rule below is a
sensible default; the cross-primitive calibration sweep is the deferred §11
"open next step".
"""

import asyncio
import logging
import re
from typing import Dict, List, Optional, Tuple

import numpy as np

from app.services.curriculum_mapping_service import CurriculumMapping

logger = logging.getLogger(__name__)

EMBEDDING_MODEL = "gemini-embedding-2-preview"

# Frontend catalog domain -> curriculum subject_id. Cross-cutting domains
# (core / media / assessment / calendar) have no single subject and are
# intentionally absent: for those the matcher declines (returns None) and the
# caller keeps its existing behaviour rather than force a wrong scope.
_DOMAIN_TO_SUBJECT: Dict[str, str] = {
    "math": "MATHEMATICS",
    "literacy": "LANGUAGE_ARTS",
    "science": "SCIENCE",
    "biology": "SCIENCE",
    "chemistry": "SCIENCE",
    "physics": "SCIENCE",
    "astronomy": "SCIENCE",
    "engineering": "SCIENCE",
    # Direct Instruction packs are literacy-first (letter sounds, word reading)
    # — this removes the --domain literacy workaround for probes/attribution.
    # REVISIT when di-math-facts is born: the family will then span subjects
    # and this must become a per-primitive mapping (or the domain must split).
    "di": "LANGUAGE_ARTS",
}

# --- Abstain rule (default; calibration sweep deferred, see QA §11 open step) ---
# A real match is a PEAK: the majority of the shortlist is one skill FAMILY (curriculum
# unit), e.g. ordinal-line@K = 5/5, ten-frame@K = 4/5. A diffuse plateau across unrelated
# units is "no home" (wrong-grade ordinal-line = 2/5 -> abstain). Height alone is not
# enough — the wrong-grade plateau still clears 0.60, so the coherence (peak-shape) test
# is what rejects it.
#
# Coherence is measured at the FAMILY (unit) level, not the exact skill_id. A cross-cutting
# representation primitive (number-line plot) maps to one unit (COUNT001 = Counting &
# Cardinality) but its top-k legitimately spreads across sibling skills within that unit
# (count-sequence COUNT001-01, compare COUNT001-03). Exact-skill_id coherence rejected that
# real peak (2/5); family coherence accepts it (3-5/5) and attributes to the top-1 subskill.
_TAU = 0.60          # absolute cosine floor (same level SuggestionEngine uses for subskills)
_TOP_K = 5           # how many neighbours define the "shape"
_MIN_COHERENT = 3    # >= this many of the top-k must share the top-1's UNIT (majority of 5)
# How the two stationary levels gate a MATCH (subskill is never tested — one problem may
# touch 1-2 subskills, so it's free to wobble):
#
#   unit >= STRONG (4-5/5)            -> MATCH. A dominant unit peak is unambiguous about
#                                        the home; the within-unit SKILL spread is just
#                                        fine-grained curriculum (G1 operations has counting-
#                                        on, three-addends, subtraction... — one jump
#                                        challenge legitimately hits several).
#   unit == MIN (3/5) AND skill >= 2  -> MATCH. A moderate unit peak (2/5 leaking to OTHER
#                                        units) is borderline, so it must ALSO pin a skill to
#                                        prove it isn't cross-unit ambiguity.
#   unit == 3 AND skill < 2           -> ABSTAIN ("scattered"). Moderate unit, no skill pinned,
#                                        neighbours split across units — exactly the under-
#                                        informed omnibus blurb. Confidently attributing it is
#                                        the misattribution this path exists to prevent.
#   unit < 3                          -> ABSTAIN ("diffuse"). No unit consensus at all.
_STRONG_UNIT = 4         # a unit peak this strong stands on its own (skill spread is fine-granularity)
_MIN_COHERENT_SKILL = 2  # at a moderate (3/5) unit peak, the dominant skill must gather >= this many


def _skill_family(skill_id: str) -> str:
    """Curriculum UNIT a skill belongs to — the skill_id with its trailing skill
    number stripped (COUNT001-03 -> COUNT001, OPS001-04 -> OPS001). Subskills of one
    unit (counting, comparing, ordinal) form a coherent 'family': a primitive whose
    top-k clusters within a unit has a home there even when the exact skill differs
    across siblings (number-line plot -> COUNT001)."""
    if not skill_id:
        return skill_id
    return re.sub(r"-[^-]+$", "", skill_id)

_ORDINAL_WORDS = {
    "first": "1", "second": "2", "third": "3", "fourth": "4", "fifth": "5",
    "sixth": "6", "seventh": "7", "eighth": "8", "ninth": "9", "tenth": "10",
    "eleventh": "11", "twelfth": "12",
}

# Coarse grade BANDS -> the numeric grade levels they cover (K = 0). Production
# often sends a band ("elementary") rather than a specific grade — grade is a soft
# narrowing, not a hard requirement, so a band widens the scope to its member
# grades instead of abstaining. Anything unrecognized widens to ALL published
# grades for the subject (subject stays the hard scope either way).
_BANDS: Dict[str, range] = {
    "pre-k": range(-1, 0),
    "prek": range(-1, 0),
    "preschool": range(-1, 0),
    "early elementary": range(0, 3),
    "lower elementary": range(0, 3),
    "primary": range(0, 6),
    "elementary": range(0, 6),          # K-5
    "upper elementary": range(3, 6),
    "intermediate": range(3, 6),
    "middle": range(6, 9),
    "middle school": range(6, 9),
    "junior high": range(6, 9),
    "high": range(9, 13),
    "high school": range(9, 13),
    "secondary": range(6, 13),
}


class CurriculumRetrievalMatcher:
    """Scoped embedding retrieval: (subject, grade) -> best curriculum subskill.

    Embeddings of a grade's subskills are computed once and cached per
    (subject, grade) — curriculum changes are rare, so this keeps the hot
    submission path to a single query embedding after warm-up.
    """

    def __init__(self, curriculum_service):
        self.curriculum_service = curriculum_service
        self._client = None
        # (subject, grade) -> (nodes, normalized_matrix | None)
        self._embed_cache: Dict[Tuple[str, Optional[str]], Tuple[List[Tuple], Optional[np.ndarray]]] = {}
        # subject -> list of published grade doc keys (e.g. ["Kindergarten", "1st Grade"])
        self._grade_keys_cache: Dict[str, List[str]] = {}

    # ------------------------------------------------------------------
    # Public helpers
    # ------------------------------------------------------------------

    @staticmethod
    def subject_for_domain(domain: Optional[str]) -> Optional[str]:
        """Map a frontend catalog domain to a curriculum subject_id, or None."""
        if not domain:
            return None
        return _DOMAIN_TO_SUBJECT.get(domain.strip().lower())

    @staticmethod
    def normalize_grade(grade_level: Optional[str]) -> Optional[str]:
        """Normalize a free-typed grade ('kindergarten', 'Grade 1', 'first') to a
        key get_published_curriculum understands ('Kindergarten', 'Pre-K', or a
        digit string; its alias map covers 'K'<->'Kindergarten' and N<->'Nth Grade').
        """
        if not grade_level:
            return None
        g = grade_level.strip().lower()
        if not g:
            return None
        if "kinder" in g or g in ("k", "gk", "0"):
            return "Kindergarten"
        if "pre" in g or g in ("pk", "pre-k", "gpk"):
            return "Pre-K"
        for word, num in _ORDINAL_WORDS.items():
            if word in g:
                return num
        m = re.search(r"(1[0-2]|[1-9])", g)
        if m:
            return m.group(1)
        return grade_level  # let get_curriculum try the raw value

    @classmethod
    def _grade_num(cls, grade: Optional[str]) -> Optional[int]:
        """Numeric level for a grade (K=0, Pre-K=-1), or None for bands/unknown."""
        n = cls.normalize_grade(grade)
        if not n:
            return None
        if n == "Kindergarten":
            return 0
        if n == "Pre-K":
            return -1
        try:
            return int(n)
        except (TypeError, ValueError):
            return None

    async def match(
        self,
        *,
        subject: str,
        grade_level: Optional[str],
        query_text: str,
        primitive_type: str,
    ) -> Optional[CurriculumMapping]:
        """Return the best (subject, grade)-scoped subskill match, or None to abstain.

        None means one of: unknown/empty scope, nothing to match against, or the
        top-k is too weak/diffuse to claim a curriculum home. Callers treat None
        as "do not attribute" — never as "fall back to a forced guess".
        """
        result = await self.probe(
            subject=subject,
            grade_level=grade_level,
            query_text=query_text,
            primitive_type=primitive_type,
        )
        return result.get("mapping")

    async def probe(
        self,
        *,
        subject: str,
        grade_level: Optional[str],
        query_text: str,
        primitive_type: str,
    ) -> Dict:
        """Run the full scoped retrieval and return a diagnostic dict (top-k,
        best cosine, coherence, verdict, abstain reason, and the CurriculumMapping
        when it matches). `match()` is the thin production wrapper over this; the
        /curriculum-fit skill uses the richer detail to diagnose misses.
        """
        # Subject is the HARD scope; grade is a soft narrowing. A band ("elementary")
        # or anything unresolvable widens to all published grades for the subject —
        # never abstain just because the grade is coarse.
        grade_keys = await self._resolve_grades(subject, grade_level)
        base: Dict = {
            "subject": subject,
            "grade": grade_keys,
            "grade_requested": grade_level,
            "n_candidates": 0,
            "best_cosine": None,
            "coherent": 0,
            "top_k": [],
            "verdict": "abstain",
            "abstain_reason": None,
            "mapping": None,
            "tau": _TAU,
            "min_coherent": _MIN_COHERENT,
        }

        if not grade_keys:
            base["abstain_reason"] = "no_scope"
            logger.info(
                f"[CURRICULUM_RETRIEVAL] No published grades for {subject} "
                f"(requested={grade_level!r}) — abstaining"
            )
            return base

        try:
            qmat = await asyncio.to_thread(self._embed, [query_text])
        except Exception as e:
            logger.warning(f"[CURRICULUM_RETRIEVAL] Query embedding failed: {e}")
            base["abstain_reason"] = "embed_error"
            return base
        qvec = qmat[0]

        # Score each candidate grade on ITS OWN coherent set — never union the grades
        # (unioning splits a multi-grade concept's top-k across different skill_ids and
        # dilutes the coherence test). Then pick the best home: highest-cosine MATCH if
        # any grade matches, else the closest near-miss (highest cosine) for diagnostics.
        per_grade = []
        total_candidates = 0
        for gk in grade_keys:
            nodes, matrix = await self._node_matrix(subject, gk)
            if not nodes or matrix is None:
                continue
            total_candidates += len(nodes)
            sims = matrix @ qvec
            order = list(np.argsort(-sims)[:_TOP_K])  # candidate row indices, cosine-desc
            best = float(sims[order[0]])

            # --- Coherence is measured at TWO stationary levels; subskill is NOT tested ---
            # A curriculum id is UNIT-SKILL-SUBSKILL (COUNT001 / COUNT001-03 / COUNT001-03-C).
            # The UNIT (Counting & Cardinality) and the SKILL ("Compare numbers") should be
            # stationary for a given challenge; the SUBSKILL legitimately wobbles because one
            # problem can touch 1-2 subskills and the embedding picks among them. So we gate on
            # UNIT coherence, attribute to the dominant SKILL, and let the subskill be the
            # top-ranked instance of that skill (best-effort, intentionally not coherence-tested).
            top_unit = _skill_family(nodes[order[0]][0])
            unit_members = [i for i in order if _skill_family(nodes[i][0]) == top_unit]  # cosine-desc
            coherent = len(unit_members)  # UNIT coherence — the abstain gate (decision metric)

            skill_counts: Dict[str, int] = {}
            for i in unit_members:
                skill_counts[nodes[i][0]] = skill_counts.get(nodes[i][0], 0) + 1
            coherent_skill = max(skill_counts.values())  # votes for the dominant skill (diagnostic)

            # Dominant skill within the coherent unit: most votes, ties broken by best cosine
            # (unit_members is already cosine-sorted, so first-seen == highest cosine).
            dom_seen: List[str] = []
            for i in unit_members:
                if nodes[i][0] not in dom_seen:
                    dom_seen.append(nodes[i][0])
            dom_skill = max(dom_seen, key=lambda sid: (skill_counts[sid], -dom_seen.index(sid)))
            attr_i = next(i for i in unit_members if nodes[i][0] == dom_skill)
            attr = {
                "cosine": round(float(sims[attr_i]), 4),
                "skill_id": nodes[attr_i][0], "skill_description": nodes[attr_i][1],
                "subskill_id": nodes[attr_i][2], "subskill_description": nodes[attr_i][3],
                "unit_id": nodes[attr_i][4], "unit_title": nodes[attr_i][5],
            }

            # Gate on unit dominance; a moderate unit peak additionally needs a pinned skill.
            if best < _TAU:
                reason = "weak"
            elif coherent < _MIN_COHERENT:
                reason = "diffuse"        # top-k spread across unrelated units — no home
            elif coherent < _STRONG_UNIT and coherent_skill < _MIN_COHERENT_SKILL:
                reason = "scattered"      # moderate unit peak, no skill pinned — under-informed query
            else:
                reason = None
            per_grade.append({
                "grade": gk,
                "best": best,
                "coherent": coherent,             # UNIT-level (gate)
                "coherent_skill": coherent_skill,  # dominant-SKILL votes (gate)
                "reason": reason,
                "attr": attr,                      # stationary attribution target (unit+skill, top subskill)
                "top_k": [
                    {
                        "rank": rank, "cosine": round(float(sims[i]), 4),
                        "skill_id": nodes[i][0], "skill_description": nodes[i][1],
                        "subskill_id": nodes[i][2], "subskill_description": nodes[i][3],
                        "grade": gk,
                    }
                    for rank, i in enumerate(order, 1)
                ],
            })

        base["n_candidates"] = total_candidates
        if not per_grade:
            base["abstain_reason"] = "no_scope"
            logger.info(f"[CURRICULUM_RETRIEVAL] No curriculum loaded for {subject}/grades={grade_keys} — abstaining")
            return base

        base["per_grade"] = [
            {"grade": g["grade"], "best_cosine": round(g["best"], 4),
             "coherent": g["coherent"], "coherent_skill": g["coherent_skill"], "reason": g["reason"]}
            for g in per_grade
        ]

        matches = [g for g in per_grade if g["reason"] is None]
        chosen = max(matches, key=lambda g: g["best"]) if matches else max(per_grade, key=lambda g: g["best"])

        base["best_cosine"] = round(chosen["best"], 4)
        base["coherent"] = chosen["coherent"]
        base["coherent_skill"] = chosen["coherent_skill"]
        base["top_k"] = chosen["top_k"]

        if not matches:
            base["abstain_reason"] = chosen["reason"]
            logger.info(
                f"[CURRICULUM_RETRIEVAL] Abstain for {primitive_type} in {subject}/grades={grade_keys}: "
                f"best grade={chosen['grade']} best={chosen['best']:.3f} (tau={_TAU}), "
                f"unit_coherent={chosen['coherent']}/{len(chosen['top_k'])} (min={_MIN_COHERENT}, "
                f"skill={chosen['coherent_skill']}) — {chosen['reason']}, no curriculum home"
            )
            return base

        # Attribute to the dominant SKILL in the coherent UNIT (stationary); subskill is its
        # top-ranked instance (best-effort). This is usually rank-1, but a noisy rank-1 that
        # disagrees with the unit's modal skill is corrected here.
        attr = chosen["attr"]
        logger.info(
            f"[CURRICULUM_RETRIEVAL] Matched {primitive_type} -> {subject}/{attr['skill_id']}/{attr['subskill_id']} "
            f"@ grade={chosen['grade']} (cosine={chosen['best']:.3f}, "
            f"unit_coherent={chosen['coherent']}/{len(chosen['top_k'])}, skill={chosen['coherent_skill']})"
        )
        base["verdict"] = "match"
        base["mapping"] = CurriculumMapping(
            subject=subject,
            skill_id=attr["skill_id"],
            skill_description=attr["skill_description"],
            subskill_id=attr["subskill_id"],
            subskill_description=attr["subskill_description"],
            confidence=attr["cosine"],
            resolved_by="retrieval",
            unit_id=attr["unit_id"],
            unit_title=attr["unit_title"],
        )
        return base

    def clear_cache(self) -> None:
        self._embed_cache.clear()
        self._grade_keys_cache.clear()

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    @property
    def client(self):
        if self._client is None:
            from google import genai
            from app.core.config import settings
            self._client = genai.Client(api_key=settings.GEMINI_API_KEY)
        return self._client

    async def _published_grade_keys(self, subject: str) -> List[str]:
        """Published grade doc keys for a subject (e.g. ['1', 'Kindergarten']), cached."""
        if subject in self._grade_keys_cache:
            return self._grade_keys_cache[subject]
        keys: List[str] = []
        try:
            subjects = await self.curriculum_service.get_available_subjects()
            for s in subjects:
                if not isinstance(s, dict):
                    continue
                sid = s.get("subject_id") or s.get("subject_name", "")
                if sid == subject and s.get("grade"):
                    keys.append(s["grade"])
        except Exception as e:
            logger.warning(f"[CURRICULUM_RETRIEVAL] Could not list grades for {subject}: {e}")
        seen, out = set(), []
        for k in keys:
            if k not in seen:
                seen.add(k)
                out.append(k)
        self._grade_keys_cache[subject] = out
        return out

    async def _resolve_grades(self, subject: str, grade_level: Optional[str]) -> List[str]:
        """Resolve a requested grade/band to the published grade keys to scope to.

        - specific grade ('kindergarten', 'Grade 1') -> just that grade (if published)
        - band ('elementary') -> its member published grades
        - missing / unrecognized -> ALL published grades (subject stays the hard scope)
        """
        published = await self._published_grade_keys(subject)
        if not published:
            return []
        if not grade_level or not str(grade_level).strip():
            return published
        g = str(grade_level).strip().lower()

        if g in _BANDS:
            band = set(_BANDS[g])
            keys = [k for k in published if self._grade_num(k) in band]
            return keys or published

        target = self._grade_num(grade_level)
        if target is not None:
            keys = [k for k in published if self._grade_num(k) == target]
            if keys:
                return keys

        # Unresolved single grade or band we don't know — widen to the whole subject.
        return published

    async def _node_matrix(
        self, subject: str, grade: Optional[str]
    ) -> Tuple[List[Tuple], Optional[np.ndarray]]:
        """Load + embed the (subject, grade) subskills, cached. Returns
        (nodes, matrix) where nodes[i] = (skill_id, skill_desc, subskill_id,
        subskill_desc, unit_id, unit_title) and matrix rows are L2-normalized
        embeddings aligned to nodes.
        """
        key = (subject, grade)
        if key in self._embed_cache:
            return self._embed_cache[key]

        nodes = await self._scoped_nodes(subject, grade)
        if not nodes:
            self._embed_cache[key] = (nodes, None)
            return nodes, None

        # Embed only the skill+subskill descriptions (the unit fields ride along on
        # each node for display attribution but are not part of the matched signal).
        texts = [f"{n[1]}: {n[3]}" for n in nodes]
        try:
            matrix = await asyncio.to_thread(self._embed, texts)
        except Exception as e:
            logger.warning(f"[CURRICULUM_RETRIEVAL] Subskill embedding failed for {subject}/{grade}: {e}")
            self._embed_cache[key] = (nodes, None)
            return nodes, None

        self._embed_cache[key] = (nodes, matrix)
        logger.info(f"[CURRICULUM_RETRIEVAL] Embedded {len(nodes)} subskills for {subject}/grade={grade}")
        return nodes, matrix

    async def _scoped_nodes(self, subject: str, grade: Optional[str]) -> List[Tuple]:
        units = await self.curriculum_service.get_curriculum(subject, grade=grade)
        nodes: List[Tuple] = []
        for unit in units or []:
            unit_id = unit.get("id", "")
            unit_title = unit.get("title", "")
            for skill in unit.get("skills", []):
                skill_id = skill.get("id", "")
                skill_desc = skill.get("description", "")
                for ss in skill.get("subskills", []):
                    nodes.append((
                        skill_id, skill_desc, ss.get("id", ""), ss.get("description", ""),
                        unit_id, unit_title,
                    ))
        return nodes

    def _embed(self, texts: List[str]) -> np.ndarray:
        """Embed texts (batched at 100) and return an L2-normalized matrix.

        Runs synchronously; callers wrap in asyncio.to_thread to avoid blocking
        the event loop on the network call.
        """
        vecs: List[np.ndarray] = []
        for i in range(0, len(texts), 100):
            resp = self.client.models.embed_content(
                model=EMBEDDING_MODEL, contents=texts[i:i + 100]
            )
            for e in resp.embeddings:
                v = np.array(e.values, dtype=np.float32)
                n = np.linalg.norm(v)
                vecs.append(v / n if n > 0 else v)
        return np.vstack(vecs)
