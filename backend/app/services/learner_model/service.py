"""
Learner state: the two-layer model's per-student state, kept current by the
submission paths so reads never replay history (WORKSTREAMS 7.4d).

SHADOW. Nothing a student sees reads this yet: CompetencyService and
PulseEngine call `observe` after their own fan-out, failures are logged and
swallowed, and in production the update runs as a background task.

    students/{sid}/learner_state/{SUBJECT}             summary: chains, touched
                                                       subskills, practice, readout
    students/{sid}/learner_state/{SUBJECT}/grids/{key} theta posterior + log lik
    students/{sid}/learner_events/{id}                 one per observed answer:
                                                       cause + what moved

An event records the readout of every subskill whose P(mastered) or P(right)
moved by MIN_DELTA or more, tagged by its graph position relative to the
answered subskill (self / prerequisite / unlocks / other). `influence`
aggregates the events in a window (a lesson, a Pulse session): the "student
did X, and P(right) rose on these prerequisites and these next skills" view.

A graph version change keeps every state whose node keys still exist; keys
that disappear are dropped on the next load.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Dict, List, Optional, Tuple

from ..calibration.problem_type_registry import (
    PROBLEM_TYPE_REGISTRY,
    get_item_discrimination,
    get_prior_beta,
)
from ..curriculum_scope import grade_key, subject_key
from ..learner_graph import LearnerGraph, get_learner_graph
from .engine import (READY_WINDOW, GraphArrays, LearnerEngine, exposure_gate, grade_index, grade_name,
                     grade_reach, n_eff, demonstration, counts_toward_grade, MASTERED_STATE)

logger = logging.getLogger(__name__)

MIN_DELTA = 0.02          # smallest readout move an event records (chain noise sits below this)
MAX_CHANGES = 30          # per event
NET_MIN = 0.01            # a window's net move below this is not reported
NEIGHBOUR_DEPTH = 3       # hops that count as prerequisite / unlocks
# READY_MIN: a subskill is "ready" (card list) and teachable (select) only when
# P(all model prerequisites mastered) clears it. User ruling 10-12 (C4): a teach
# pick whose parts are not in place is not served, even when general ability
# predicts a right answer. One number for the card and the selector.
MASTERED, READY_MIN = 0.8, 0.4
# A practised subskill the model is already this sure of is not confirmed again:
# the answer carries no information (a gifted child spent week 4 re-proving
# "count to 5"). Spaced retention stays the lifecycle's retest schedule.
CONFIRM_MAX = 0.95
READY_SHOWN = 0.5          # by_cause: P(ready) at or above this counts as newly within reach

GraphSource = Callable[[str], Awaitable[Optional[LearnerGraph]]]


def first_try_from_response(primitive_response: Optional[dict]) -> Optional[List[bool]]:
    """Per-challenge first-try results, found the way problems.py
    `_find_challenge_results` finds them (a list of dicts with numeric
    `attempts`, in student_work or metrics). None when the primitive reports
    no per-challenge results."""
    if not isinstance(primitive_response, dict):
        return None
    for src in (primitive_response.get("student_work"), primitive_response.get("metrics")):
        if not isinstance(src, dict):
            continue
        for v in src.values():
            if isinstance(v, list) and v and all(isinstance(e, dict) and isinstance(e.get("attempts"), (int, float)) for e in v):
                return [e.get("attempts") == 1 and e.get("correct") is not False for e in v]
    return None


def plain_reason(kind: str, seen: bool, p_right: float) -> str:
    """Why a subskill was picked, in words a parent or child can read. The
    engine's numbers stay in `reason_detail`. A learn pick is described by how
    likely the child is to get it right, which is what the selector weighs."""
    if kind == "confirm":
        return ("Practised before and looks solid: a quick check to confirm it." if seen
                else "Looks like something you already know: a quick check to confirm it.")
    if p_right >= 0.7:
        return "A good next step: it builds on what you already know."
    if p_right >= 0.4:
        return "A stretch: within reach with some help."
    return "A big stretch: new ground, with lots of support."


class LearnerStateService:
    def __init__(self, firestore_service, graph_source: Optional[GraphSource] = None, background: bool = True):
        self.fs = firestore_service
        self._graph_source = graph_source or (lambda s: get_learner_graph(firestore_service, s))
        self.background = background
        self._arrays: Dict[Tuple[str, str], Tuple[LearnerGraph, GraphArrays]] = {}
        self._locks: Dict[Tuple[str, str], asyncio.Lock] = {}
        self._grades: Dict[str, Tuple[float, Optional[str]]] = {}
        self._tasks: set = set()

    # ── graph ─────────────────────────────────────────────────────────────
    async def _graph(self, subject: str) -> Optional[Tuple[LearnerGraph, GraphArrays]]:
        lg = await self._graph_source(subject)
        if lg is None:
            return None
        hit = self._arrays.get((lg.subject, lg.version))
        if hit is None:
            hit = (lg, await asyncio.to_thread(GraphArrays.from_nodes, lg.version, lg.nodes))
            self._arrays = {k: v for k, v in self._arrays.items() if k[0] != lg.subject}
            self._arrays[(lg.subject, lg.version)] = hit
        return hit

    async def _student_grade(self, student_id) -> Optional[str]:
        hit = self._grades.get(str(student_id))
        if hit and time.time() - hit[0] < 600:
            return hit[1]
        g = None
        try:
            g = grade_key((await self.fs.get_student_planning_fields(student_id) or {}).get("grade_level"))
        except Exception:
            pass
        self._grades[str(student_id)] = (time.time(), g)
        return g

    @staticmethod
    async def _canonical(subskill_id: str) -> str:
        """The lineage successor of a renamed subskill id (unchanged when none).
        The learner graph holds canonical ids only, so an answer recorded under
        a retired id must be resolved before it is keyed (invariant 4)."""
        if not subskill_id:
            return subskill_id
        try:
            from ..subskill_id_resolver import subskill_id_resolver
            return await subskill_id_resolver.resolve(subskill_id) or subskill_id
        except Exception as e:
            logger.info(f"[LEARNER_STATE] lineage resolve failed for {subskill_id}: {e}")
            return subskill_id

    @staticmethod
    def _resolve_key(lg: LearnerGraph, subskill_id: str, grade: Optional[str]) -> Optional[str]:
        """Bare subskill ids repeat across grades: unique id -> its node; else the grade decides."""
        if not hasattr(lg, "_by_sid"):
            by: Dict[str, List[str]] = {}
            for key, nd in lg.nodes.items():
                by.setdefault(nd.get("subskill_id"), []).append(key)
            lg._by_sid = by  # type: ignore[attr-defined]
        keys = lg._by_sid.get(subskill_id, [])  # type: ignore[attr-defined]
        if len(keys) == 1:
            return keys[0]
        g = grade_key(grade) if grade else None
        return f"{g}:{subskill_id}" if g and f"{g}:{subskill_id}" in lg.nodes else None

    async def _labels(self) -> Dict[str, dict]:
        """"{grade}:{subskill_id}" -> {label, unit}: the published parent sentence
        (`parent_summary`, the progress report's source) when there is one, else
        the first line of the author description. Cached with the report's index."""
        if getattr(self, "_label_cache", None) and time.time() - self._label_cache[0] < 600:
            return self._label_cache[1]
        out: Dict[str, dict] = {}
        try:
            from ..progress_report import ProgressReportService, _clean_description
            index, _ = await asyncio.to_thread(ProgressReportService(self.fs)._curriculum)
            for sid, locs in index.items():
                for m in locs:
                    out[f"{m.get('grade_doc')}:{sid}"] = {
                        "label": m.get("parent_summary") or _clean_description(m.get("subskill_description")) or sid,
                        "unit": m.get("unit_title") or ""}
        except Exception as e:  # in-memory store or no curriculum: fall back to graph labels
            logger.info(f"[LEARNER_STATE] parent labels unavailable: {e}")
        if out:  # an empty table is retried on the next read, not cached
            self._label_cache = (time.time(), out)
        return out

    @staticmethod
    def _label(labels: Dict[str, dict], lg: Optional[LearnerGraph], key: str) -> Tuple[str, str]:
        hit = labels.get(key)
        if hit:
            return hit["label"], hit["unit"]
        raw = ((lg.nodes.get(key) if lg else None) or {}).get("label", "")
        return raw.split(". Focus:")[0].split(" Focus:")[0], ""

    # ── write path ────────────────────────────────────────────────────────
    def schedule(self, **kw) -> None:
        """Fire-and-forget `observe` (production); awaited inline when background=False."""
        task = asyncio.create_task(self.observe(**kw))
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    async def drain(self) -> None:
        while self._tasks:
            await asyncio.gather(*list(self._tasks), return_exceptions=True)

    async def submit(self, **kw) -> Optional[dict]:
        """Entry point for the submission paths: never raises."""
        if self.background:
            self.schedule(**kw)
            return None
        return await self.observe(**kw)

    async def observe(
        self,
        student_id,
        subject: str,
        subskill_id: str,
        score: float,
        primitive_type: Optional[str] = None,
        eval_mode: Optional[str] = None,
        first_try: Optional[List[bool]] = None,
        evidence_parts: int = 1,
        grade: Optional[str] = None,
        source: str = "practice",
        attempt_id: Optional[str] = None,
        timestamp: Optional[str] = None,
    ) -> Optional[dict]:
        """One answer -> updated state + one event. score is 0-10. Returns the
        event (None when the subject or subskill is not on a learner graph)."""
        try:
            hit = await self._graph(subject)
            if hit is None:
                return None
            lg, ga = hit
            record = await self._student_grade(student_id)
            gidx = grade_index(record)
            subskill_id = await self._canonical(subskill_id)
            key = self._resolve_key(lg, subskill_id, grade or record)
            if key is None:
                logger.info(f"[LEARNER_STATE] {subskill_id} ({subject}) not on the learner graph or ambiguous without a grade; skipped")
                return None
            if first_try:
                x, n, evidence = sum(first_try) / len(first_try), n_eff(len(first_try)), "first_try"
            else:
                x, n, evidence = max(0.0, min(1.0, float(score) / 10.0)), n_eff(evidence_parts), "score"
            k = ga.index[key]
            if primitive_type in PROBLEM_TYPE_REGISTRY:
                a, c = get_item_discrimination(primitive_type, eval_mode or "default")
                beta = get_prior_beta(primitive_type, eval_mode or "default")
            else:  # standard problem or unregistered primitive: the subskill's typical item
                a, c, beta = 1.0, 0.0, float(ga.bmed[k])
            lock = self._locks.setdefault((str(student_id), lg.subject), asyncio.Lock())
            async with lock:
                doc = await self.fs.get_learner_state(student_id, lg.subject) or {}
                state = json.loads(doc["state_json"]) if doc.get("state_json") else None
                before = json.loads(doc["readout_json"]) if doc.get("readout_json") else None
                grid = await self.fs.get_learner_grid(student_id, lg.subject, key) if state and key in state.get("touched", {}) else None

                def run():
                    n_obs = int((state or {}).get("n_obs", 0))
                    eng = LearnerEngine.from_state(ga, state, LearnerEngine.seed_for(student_id, n_obs))
                    eng.load_grid(key, grid)
                    p_before = eng.predict(key, a, beta, c)
                    prior = (exposure_gate(ga, before, (state or {}).get("touched", {}), gidx)
                             if before is not None else eng.readout(gidx))
                    eng.observe(key, a, beta, c, x, n)
                    return eng, p_before, prior, eng.readout(gidx), eng.phi_summary()

                eng, p_before, prior, after, (phi_m, phi_sd) = await asyncio.to_thread(run)
                # milestone: a grade newly grown past (the child's work moved the reach)
                grown_before = set(grade_reach(ga, prior, (state or {}).get("touched", {}), gidx)[1])
                grown_now = grade_reach(ga, after, eng.touched, gidx)[1]
                grown_past = dict(doc.get("grown_past") or {})
                # the pulse-agent's in-memory store carries a virtual clock
                ts = timestamp or (getattr(self.fs, "virtual_now", None) or datetime.now(timezone.utc)).isoformat()
                event = {
                    "event_id": attempt_id or str(uuid.uuid4()),
                    "ts": ts, "subject": lg.subject, "graph_version": ga.version, "source": source,
                    "cause": {"key": key, "subskill_id": subskill_id, "label": lg.nodes[key].get("label", ""),
                              "primitive_type": primitive_type, "eval_mode": eval_mode,
                              "x": round(x, 3), "n": n, "evidence": evidence, "score": score,
                              "p_right_predicted": round(p_before, 4)},
                }
                event["changes"], event["general_pc"] = self._changes(lg, ga, key, prior, after)
                new_grades = [grade_name(i) for i in grown_now if i not in grown_before and grade_name(i) not in grown_past]
                for gname in new_grades:
                    grown_past[gname] = ts
                if new_grades:
                    event["milestone"] = {"grown_past": new_grades, "reach_grade": grade_name(max(grown_now) + 1)}
                await self.fs.save_learner_update(
                    student_id, lg.subject,
                    summary={"graph_version": ga.version, "n_obs": eng.n_obs, "updated_at": ts,
                             "state_json": json.dumps(eng.to_state(), separators=(",", ":")),
                             "readout_json": json.dumps(after, separators=(",", ":")),
                             "phi_mean": round(phi_m, 3), "phi_sd": round(phi_sd, 3),
                             "grown_past": grown_past},
                    grids=eng.dirty_grids(),
                    event={**{k: v for k, v in event.items() if k != "changes"},
                           "changes_json": json.dumps(event["changes"], separators=(",", ":"))},
                )
            return event
        except Exception as e:  # shadow: never break a submission
            logger.warning(f"[LEARNER_STATE] observe failed for student {student_id} {subject}/{subskill_id}: {e}", exc_info=True)
            return None

    @staticmethod
    def _relations(lg: LearnerGraph, key: str) -> Dict[str, Tuple[str, int]]:
        rel: Dict[str, Tuple[str, int]] = {key: ("self", 0)}
        for kind, step in (("prerequisite", lambda x: [p["key"] for p in lg.prerequisites(x)]),
                           ("unlocks", lambda x: [c["key"] for c in lg.unlocks(x)])):
            frontier = [key]
            for hop in range(1, NEIGHBOUR_DEPTH + 1):
                nxt = []
                for x in frontier:
                    for y in step(x):
                        if y not in rel:
                            rel[y] = (kind, hop)
                            nxt.append(y)
                frontier = nxt
        return rel

    def _changes(self, lg: LearnerGraph, ga: GraphArrays, key: str, before: dict, after: dict) -> Tuple[List[dict], float]:
        """(changes, general shift). The general shift is the median P(right) move of
        subskills off the answered one's graph neighbourhood: what general ability
        (phi) moved everywhere. A miss moves unrelated subskills about as much as the
        missed one's prerequisites, so a neighbour counts by how far it moved BEYOND
        that shift, and neighbours are recorded first, before the cap."""
        rel = self._relations(lg, key)
        shifts = sorted(a[1] - before[k][1] for k, a in after.items() if k in before and k not in rel)
        tide = shifts[len(shifts) // 2] if shifts else 0.0
        out = []
        for k, a in after.items():
            b = before.get(k)
            if b is None:
                continue
            r, hop = rel.get(k, ("other", None))
            d = max(abs(a[0] - b[0]), abs(a[1] - b[1]))
            own = abs(a[1] - b[1] - tide) if r != "other" else 0.0
            if d >= MIN_DELTA or own >= MIN_DELTA or k == key:
                out.append({"key": k, "rel": r, "hops": hop, "pm": [b[0], a[0]], "pc": [b[1], a[1]],
                            "ready": [b[2], a[2]], "_o": (k != key, r == "other", -max(own, d if r == "other" else 0.0))})
        out.sort(key=lambda c: c["_o"])
        for c in out:
            c.pop("_o")
        return out[:MAX_CHANGES], round(tide, 4)

    async def _lifecycle(self, student_id, lg: LearnerGraph, grade: Optional[str]) -> Dict[str, dict]:
        """The student's mastery lifecycle docs keyed by learner-graph key."""
        out: Dict[str, dict] = {}
        try:
            for lc in await self.fs.get_all_mastery_lifecycles(student_id) or []:
                sid = await self._canonical(lc.get("subskill_id", ""))
                key = self._resolve_key(lg, sid, grade)
                if key:
                    out[key] = lc
        except Exception as e:
            logger.warning(f"[LEARNER_STATE] lifecycle read failed for {student_id}: {e}")
        return out

    async def demonstration(self, student_id, subject: str) -> Optional[dict]:
        """One state per subskill (engine.demonstration) from the stored readout and
        the lifecycle: what the report grid, the My Progress card and reach read.
        None when the subject has no learner graph."""
        hit = await self._graph(subject)
        if hit is None:
            return None
        lg, ga = hit
        grade = await self._student_grade(student_id)
        doc = await self.fs.get_learner_state(student_id, lg.subject) or {}
        touched = json.loads(doc["state_json"]).get("touched", {}) if doc.get("state_json") else {}
        ro = (exposure_gate(ga, json.loads(doc["readout_json"]), touched, grade_index(grade))
              if doc.get("readout_json") else {})
        lifecycle = await self._lifecycle(student_id, lg, grade)
        return {"lg": lg, "ga": ga, "grade": grade, "doc": doc, "touched": touched, "readout": ro,
                "lifecycle": lifecycle, "states": demonstration(ga, ro, touched, lifecycle)}

    # ── selection: the one brain for Pulse and the session planner ────────
    async def select(self, student_id, subject: str, count: int, confirm_share: float = 0.5,
                     max_per_skill: int = 2, grade: Optional[str] = None) -> Optional[dict]:
        """The next subskills to serve, from the learner model alone.

            teach    expected learning = P(right) x teaching value (frontier,
                     unlock, easier-form transfer); the lab's success-weighted
                     selector without the look-ahead
            confirm  the model believes it mastered (P(mastered) >= MASTERED)
                     but the mastery lifecycle has not recorded it: the item's
                     job is the evidence that advances the gate. Covers what
                     leapfrog probes did: inferred-but-unshown subskills at or
                     below the grade of record get checked

        Lifecycle-mastered subskills are left out: retests are the lifecycle's
        schedule. Scope: practised subskills plus everything up to READY_WINDOW
        grades above the grade of record. Each pick carries `target_beta` (the
        subskill's typical item); the frontend picks the primitive and mode.
        `grade` (a per-subject promotion override) replaces the grade of record
        for the window. Returns None when the subject has no learner graph."""
        hit = await self._graph(subject)
        if hit is None:
            return None
        lg, ga = hit
        doc = await self.fs.get_learner_state(student_id, lg.subject) or {}
        state = json.loads(doc["state_json"]) if doc.get("state_json") else None
        grade = grade_key(grade) if grade else await self._student_grade(student_id)
        gidx = grade_index(grade)
        lifecycle = await self._lifecycle(student_id, lg, grade)

        def run():
            eng = LearnerEngine.from_state(ga, state, LearnerEngine.seed_for(student_id, int((state or {}).get("n_obs", 0))))
            ro = eng.readout(gidx)
            return ro, eng.teaching_gain(ro), set(eng.touched)

        ro, gain, touched = await asyncio.to_thread(run)
        top, _grown = grade_reach(ga, ro, touched, gidx, lifecycle)
        # gates and retention flow down the demonstration edges: a subskill whose
        # harder form is lifecycle-mastered is not served, and its confirm item
        # targets the gate it effectively holds
        states = demonstration(ga, ro, touched, lifecycle)
        from ...models.mastery_lifecycle import GATE_P_THRESHOLDS

        teach, confirm, unready = [], [], []
        for k, key in enumerate(ga.keys):
            seen = key in touched
            if top is not None and not seen and ga.gi[k] > top:
                continue
            st = states.get(key) or {}
            if st.get("state") == MASTERED_STATE:
                continue
            pm, pc, ready = ro[key]
            gate = max(0, st.get("gate") or 0)
            row = {"key": key, "k": k, "seen": seen, "gate": gate, "pm": pm, "pc": pc, "ready": ready,
                   "gain": float(gain[k]), "skill": ga.skill[k]}
            if pm >= MASTERED:
                # gate 4 = accuracy shown; what remains is spaced stability,
                # which the lifecycle's retest schedule owns
                if gate < 4 and (seen or gidx is None or ga.gi[k] <= max(gidx, top - 1))                         and not (seen and pm >= CONFIRM_MAX):
                    row["kind"] = "confirm"
                    confirm.append(row)
            elif gain[k] > 0:
                row["kind"] = "learn"
                (teach if ready >= READY_MIN else unready).append(row)
        teach.sort(key=lambda r: -r["gain"])
        # last resort (a child below every floor): the most-ready of the rest
        unready.sort(key=lambda r: (-r["ready"], -r["gain"]))
        # confirm alternates inferred (never practised: discovery, what leapfrog
        # probes did) with practised (gate evidence), each by P(mastered)
        unseen = sorted((r for r in confirm if not r["seen"]), key=lambda r: -r["pm"])
        seen_c = sorted((r for r in confirm if r["seen"]), key=lambda r: -r["pm"])
        confirm = [r for pair in zip(unseen, seen_c) for r in pair]
        confirm += unseen[len(seen_c):] + seen_c[len(unseen):]

        picked: List[dict] = []
        per_skill: Dict[str, int] = {}

        def take(pool: List[dict], want: int) -> None:
            for r in pool:
                if want <= 0 or len(picked) >= count:
                    return
                if r in picked or per_skill.get(r["skill"], 0) >= max_per_skill:
                    continue
                picked.append(r)
                per_skill[r["skill"]] = per_skill.get(r["skill"], 0) + 1
                want -= 1

        n_confirm = int(round(count * confirm_share))
        take(confirm, n_confirm)
        take(teach, count - len(picked))
        take(confirm, count - len(picked))
        take(unready, count - len(picked))

        labels = await self._labels() if picked else {}
        out = []
        for r in picked:
            nd = lg.nodes.get(r["key"], {})
            nxt = min(r["gate"] + 1, 4)
            if r["kind"] == "confirm":
                detail = (f"model P(mastered) {r['pm']:.2f}, lifecycle gate {r['gate']}: "
                          f"evidence to advance the gate")
            else:
                detail = (f"P(right) {r['pc']:.2f} x teaching value: expected learning {r['gain']:.3f} "
                          f"(P(ready) {r['ready']:.2f})")
            reason = plain_reason(r["kind"], r["seen"], r["pc"])
            out.append({
                "key": r["key"], "subskill_id": nd.get("subskill_id"), "skill_id": nd.get("skill_id", ""),
                "grade": nd.get("grade"), "description": nd.get("label", ""),
                "label": self._label(labels, lg, r["key"])[0],
                "kind": r["kind"], "reason": reason, "reason_detail": detail, "seen": r["seen"],
                "target_beta": round(float(ga.bmed[r["k"]]), 3),
                "p_right": r["pc"], "p_mastered": r["pm"], "p_ready": r["ready"], "gain": round(r["gain"], 4),
                "current_gate": r["gate"], "next_gate": nxt, "gate_threshold": GATE_P_THRESHOLDS[nxt],
            })
        return {"subject": lg.subject, "graph_version": lg.version, "student_grade": grade,
                "reach_grade": grade_name(top) if top is not None else None,
                "grown_past": [grade_name(i) for i in _grown],
                "observations": int((state or {}).get("n_obs", 0)), "picks": out, "pool_sizes": {"learn": len(teach), "confirm": len(confirm), "unready": len(unready)}}

    # ── read path ─────────────────────────────────────────────────────────
    async def profile(self, student_id, subject: str, top: int = 8) -> Optional[dict]:
        """The stored readout as a profile section. No replay.

        Scoped to the student: subskills they practised, plus anything up to
        one grade above their grade of record. The readout is exposure-gated
        here too (engine.exposure_gate), so readouts stored before the gate
        read the same as new ones."""
        hit = await self._graph(subject)
        if hit is None:
            return None
        lg, ga = hit
        doc = await self.fs.get_learner_state(student_id, lg.subject)
        if not doc or not doc.get("readout_json"):
            return {"subject": lg.subject, "graph_version": lg.version, "validation": lg.validation,
                    "observations": 0, "mastered": [], "ready": [], "working_on": [], "counts": {}}
        touched = json.loads(doc["state_json"]).get("touched", {})
        grade = await self._student_grade(student_id)
        ro = exposure_gate(ga, json.loads(doc["readout_json"]), touched, grade_index(grade))
        lifecycle = await self._lifecycle(student_id, lg, grade)
        states = demonstration(ga, ro, touched, lifecycle)
        labels = await self._labels()

        def row(k):
            nd = lg.nodes.get(k, {})
            pm, pc, ready = ro[k]
            label, unit = self._label(labels, lg, k)
            return {"key": k, "subskill_id": nd.get("subskill_id"), "grade": nd.get("grade"),
                    "skill_id": nd.get("skill_id"), "label": label, "unit": unit,
                    "p_mastered": pm, "p_right": pc, "p_ready": ready,
                    "seen": k in touched, "answers": (touched.get(k) or {}).get("n", 0)}

        order = lambda g: 0 if g == "Kindergarten" else int(g) if str(g).isdigit() else 99
        top, grown = grade_reach(ga, ro, touched, grade_index(grade), lifecycle)
        shown = {k for k, v in states.items() if counts_toward_grade(v["state"])}
        ceiling = top if top is not None else 99
        keys = [k for k in ro if k in lg.nodes and (k in touched or order(lg.nodes[k].get("grade")) <= ceiling)]
        mastered = sorted((k for k in keys if ro[k][0] >= MASTERED), key=lambda k: -ro[k][0])
        # ranked by expected learning, P(ready) x P(right): the lab's success-weighted
        # value, so a cross-grade root the child would mostly fail does not lead
        # new skills only; practised ones are listed under working_on
        ready = sorted((k for k in keys if k not in touched and ro[k][0] < MASTERED and ro[k][2] >= READY_MIN),
                       key=lambda k: -ro[k][2] * ro[k][1])
        working = sorted((k for k in touched if k in ro and ro[k][0] < MASTERED), key=lambda k: -ro[k][2])
        return {
            "subject": lg.subject, "graph_version": lg.version, "validation": lg.validation,
            "state_graph_version": doc.get("graph_version"), "observations": doc.get("n_obs", 0),
            "updated_at": doc.get("updated_at"), "student_grade": grade,
            "grade_ceiling": None if ceiling == 99 else ceiling,
            # grades the child has grown past (60% of the grade mastered), with when
            "grown_past": [{"grade": grade_name(i), "at": (doc.get("grown_past") or {}).get(grade_name(i))}
                           for i in grown],
            "reach_grade": grade_name(top) if top is not None else None,
            "general_ability": {"mean": doc.get("phi_mean"), "sd": doc.get("phi_sd")},
            "counts": {"subskills": len(keys), "seen": len(touched),
                       "mastered": len(mastered), "mastered_seen": sum(k in touched for k in mastered),
                       # the demonstration states (engine.demonstration), the same the report grid reads:
                       # shown = practised, or demonstrated by something practised; mastered = also retained
                       "shown": sum(1 for k in keys if k in shown),
                       "shown_practised": sum(1 for k in keys if k in shown and k in touched),
                       "shown_mastered": sum(1 for k in keys if states.get(k, {}).get("state") == MASTERED_STATE),
                       "ready": len(ready)},
            "ready": [row(k) for k in ready[:top]],
            "working_on": [row(k) for k in working[:top]],
            "mastered": [row(k) for k in mastered[:top]],
        }

    async def influence(self, student_id, since: str, until: Optional[str] = None,
                        subject: Optional[str] = None, top: int = 10) -> dict:
        """What the answers in [since, until] did: per answer, the subskills it
        moved; net, each moved subskill's first 'before' and last 'after'."""
        events = await self.fs.get_learner_events(student_id, since, until, subject_key(subject) if subject else None)
        events.sort(key=lambda e: e.get("ts", ""))
        labels = await self._labels() if events else {}
        per_answer, net = [], {}
        for e in events:
            changes = json.loads(e.get("changes_json") or "[]")
            lg = (await self._graph(e["subject"]) or (None, None))[0]
            e["cause"]["label"] = self._label(labels, lg, e["cause"]["key"])[0]
            for c in changes:
                c["label"], c["unit"] = self._label(labels, lg, c["key"])
                c["grade"] = c["key"].split(":", 1)[0]
                ent = net.setdefault((e["subject"], c["key"]), {"subject": e["subject"], "key": c["key"], "label": c["label"],
                                                               "unit": c["unit"], "grade": c["grade"],
                                                               "pm": [c["pm"][0], c["pm"][1]], "pc": [c["pc"][0], c["pc"][1]],
                                                               "caused_by": set(), "relations": set()})
                ent["pm"][1], ent["pc"][1] = c["pm"][1], c["pc"][1]
                ent["caused_by"].add(e["cause"]["key"])
                ent["relations"].add(c["rel"])
            # graph neighbours only; "other" subskills move with the general-ability
            # estimate (phi), so they are counted, not listed
            per_answer.append({"ts": e.get("ts"), "subject": e["subject"], "source": e.get("source"),
                               "cause": e.get("cause"),
                               "moved": [c for c in changes if c["rel"] in ("prerequisite", "unlocks")][:top],
                               "general_shift": sum(c["rel"] == "other" for c in changes),
                               "self": next((c for c in changes if c["key"] == e["cause"]["key"]), None)})
        practised = {e["cause"]["key"] for e in events}
        rows = []
        for ent in net.values():
            ent["caused_by"] = sorted(ent["caused_by"])
            ent["relations"] = sorted(ent["relations"])
            ent["d_pc"] = round(ent["pc"][1] - ent["pc"][0], 4)
            ent["d_pm"] = round(ent["pm"][1] - ent["pm"][0], 4)
            if max(abs(ent["d_pc"]), abs(ent["d_pm"])) >= NET_MIN or ent["key"] in practised:
                rows.append(ent)
        rows.sort(key=lambda r: -abs(r["d_pc"]))
        record = grade_index(await self._student_grade(student_id)) if events else None
        # the reach widens with each grade grown past (milestones in the stored state)
        ceiling = None
        if record is not None:
            grown = 0
            for subj in {e["subject"] for e in events}:
                doc = await self.fs.get_learner_state(student_id, subj) or {}
                grown = max(grown, len(doc.get("grown_past") or {}))
            ceiling = max(record + READY_WINDOW, record + grown)
        by_cause, unlocked = self._by_cause(events, labels, practised, ceiling, top)
        milestones = [{"ts": e.get("ts"), "subject": e["subject"], **e["milestone"]}
                      for e in events if e.get("milestone")]
        return {
            "milestones": milestones,
            "since": since, "until": until, "answers": len(events),
            "practised": [r for r in rows if r["key"] in practised],
            "upstream": [r for r in rows if r["key"] not in practised and "prerequisite" in r["relations"]][:top],
            "downstream": [r for r in rows if r["key"] not in practised and "unlocks" in r["relations"]
                           and "prerequisite" not in r["relations"]][:top],
            "by_cause": by_cause,
            "unlocked": unlocked,
            "per_answer": per_answer,
        }

    def _by_cause(self, events: List[dict], labels: Dict[str, dict], practised: set,
                  ceiling: Optional[int], top: int) -> Tuple[List[dict], List[dict]]:
        """Per practised subskill, what its answers did along the graph:
            foundations  prerequisites its answers made more likely (evidence flows down)
            check        prerequisites they made less likely (a miss points at a step)
            next         subskills they brought within reach (evidence flows up), `became_ready`
                         when P(ready) crossed READY_SHOWN
            further      subskills they pushed further away
        Each move counts beyond the event's general shift (`d_own`); `d_pc` is the raw move.
        Subskills above the child's reach (`ceiling`: grade of record + 1, wider for
        each grade grown past) are left out: they move with general ability, not
        with this lesson's evidence."""
        causes: Dict[str, dict] = {}
        links: Dict[Tuple[str, str], dict] = {}
        ready_net: Dict[str, List[float]] = {}
        for e in events:
            ck = e["cause"]["key"]
            changes = json.loads(e.get("changes_json") or "[]")
            tide = float(e.get("general_pc") or 0.0)
            c = causes.setdefault(ck, {"key": ck, "subject": e["subject"], "label": e["cause"].get("label", ""),
                                       "grade": ck.split(":", 1)[0], "answers": 0, "first_try": [], "pc": None})
            c["answers"] += 1
            c["first_try"].append(float(e["cause"].get("x", 0.0)))
            for ch in changes:
                if ch["key"] == ck:
                    c["pc"] = [c["pc"][0] if c["pc"] else ch["pc"][0], ch["pc"][1]]
                    continue
                if ch["key"] in practised or ch["rel"] not in ("prerequisite", "unlocks"):
                    continue
                gi = grade_index(ch["key"].split(":", 1)[0])
                if ceiling is not None and gi is not None and gi > ceiling:
                    continue
                ln = links.setdefault((ck, ch["key"]), {"key": ch["key"], "rel": ch["rel"], "hops": ch.get("hops"),
                                                        "pc": [ch["pc"][0], ch["pc"][1]], "pm": [ch["pm"][0], ch["pm"][1]],
                                                        "own": 0.0})
                ln["pc"][1], ln["pm"][1] = ch["pc"][1], ch["pm"][1]
                ln["own"] += ch["pc"][1] - ch["pc"][0] - tide
                r = ready_net.setdefault(ch["key"], [ch["ready"][0], ch["ready"][1]])
                r[1] = ch["ready"][1]
        out = []
        for ck, c in causes.items():
            c["label"] = labels.get(ck, {}).get("label") or c["label"]
            c["first_try"] = round(sum(c["first_try"]) / len(c["first_try"]), 3)
            mine = []
            for (src, key), ln in links.items():
                if src != ck:
                    continue
                d = round(ln["pc"][1] - ln["pc"][0], 4)
                own = round(ln.pop("own"), 4)
                # a neighbour that held still while everything else fell was not confirmed:
                # the raw move and the move beyond the general shift must agree
                if abs(own) < NET_MIN or abs(d) < NET_MIN or (own > 0) != (d > 0):
                    continue
                rd = ready_net.get(key, [0.0, 0.0])
                mine.append({**ln, "d_pc": d, "d_own": own, "label": labels.get(key, {}).get("label") or key.split(":", 1)[1],
                             "grade": key.split(":", 1)[0],
                             "became_ready": rd[0] < READY_SHOWN <= rd[1]})
            c["foundations"] = sorted((m for m in mine if m["rel"] == "prerequisite" and m["d_own"] > 0), key=lambda m: -m["d_own"])[:top]
            c["check"] = sorted((m for m in mine if m["rel"] == "prerequisite" and m["d_own"] < 0), key=lambda m: m["d_own"])[:top]
            c["next"] = sorted((m for m in mine if m["rel"] == "unlocks" and m["d_own"] > 0),
                               key=lambda m: (not m["became_ready"], -m["d_own"]))[:top]
            c["further"] = sorted((m for m in mine if m["rel"] == "unlocks" and m["d_own"] < 0), key=lambda m: m["d_own"])[:top]
            out.append(c)
        out.sort(key=lambda c: -c["answers"])
        unlocked = [{"key": k, "label": labels.get(k, {}).get("label") or k.split(":", 1)[1],
                     "grade": k.split(":", 1)[0], "ready": r}
                    for k, r in ready_net.items() if r[0] < READY_SHOWN <= r[1]]
        return out, unlocked[:top]
