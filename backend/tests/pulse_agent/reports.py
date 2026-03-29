"""
Journey Reports
===============

Generate human-readable reports from journey timelines.
Outputs Markdown that can be saved to files or printed to console.

Includes IRT decision context: P(correct), Fisher information, item difficulty,
and commentary explaining why the unified utility scorer chose each item
(utility = information × urgency) and how the IRT-derived gates
(derive_gate_from_irt) match observed behavior.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional

from .assertions import AssertionResult, run_assertions_for_archetype
from .journey_recorder import ItemResult, JourneyTimeline, SessionSnapshot

logger = logging.getLogger(__name__)


# ── Helpers ────────────────────────────────────────────────────────────────


def _p_label(p: Optional[float]) -> str:
    """Human label for P(correct)."""
    if p is None:
        return "?"
    if p >= 0.95:
        return "trivial"
    if p >= 0.85:
        return "easy"
    if p >= 0.65:
        return "informative"
    if p >= 0.45:
        return "challenging"
    return "hard"


def _info_label(info: Optional[float]) -> str:
    """Human label for Fisher information."""
    if info is None:
        return "?"
    if info >= 0.20:
        return "high"
    if info >= 0.10:
        return "moderate"
    if info >= 0.04:
        return "low"
    return "negligible"


def _session_irt_commentary(s: SessionSnapshot) -> List[str]:
    """
    Generate narrative commentary for one session's item selection,
    focusing on whether the IRT data reveals good or poor calibration.
    """
    notes: List[str] = []

    # Collect IRT stats
    frontier_items = [it for it in s.items if it.band == "frontier"]
    current_items = [it for it in s.items if it.band == "current"]
    review_items = [it for it in s.items if it.band == "review"]

    # 1. Skill diversity check
    skills = set(it.skill_id for it in s.items)
    if len(skills) == 1:
        notes.append(
            f"**Skill concentration:** All {len(s.items)} items targeted a single "
            f"skill (`{next(iter(skills))}`). The session provided no diversity across "
            f"curriculum areas — likely the candidate pool was too narrow or lesson "
            f"grouping locked items to one skill."
        )
    elif len(skills) <= 2:
        notes.append(
            f"**Low diversity:** Only {len(skills)} skills appeared "
            f"({', '.join(f'`{s}`' for s in sorted(skills))}). "
            f"Consider whether the candidate pool or lesson grouping is too restrictive."
        )

    # 2. P(correct) analysis — are we giving items that are too easy?
    # Use blended P when available (what actually drives gate checks)
    p_values = [it.p_blended or it.p_correct for it in s.items if (it.p_blended or it.p_correct) is not None]
    p_irt_values = [it.p_correct for it in s.items if it.p_correct is not None]
    if p_values:
        avg_p = sum(p_values) / len(p_values)
        avg_p_irt = sum(p_irt_values) / len(p_irt_values) if p_irt_values else avg_p
        high_p_count = sum(1 for p in p_values if p >= 0.90)

        # Show IRT vs blended divergence when credibility blend is materially pulling P down
        if p_irt_values and abs(avg_p_irt - avg_p) > 0.03:
            notes.append(
                f"**Credibility blend active:** P(irt) avg = {avg_p_irt:.3f}, "
                f"P(blended) avg = {avg_p:.3f} (Δ={avg_p - avg_p_irt:+.3f}). "
                f"Empirical pass rate is pulling the gate-check P "
                f"{'down' if avg_p < avg_p_irt else 'up'} from the IRT prediction."
            )

        if avg_p >= 0.90:
            notes.append(
                f"**Ceiling effect:** Average P(blended) = {avg_p:.3f}. "
                f"{high_p_count}/{len(p_values)} items had P >= 0.90 — the student "
                f"has very high probability of acing these. Items are not providing "
                f"maximum information. Consider higher-beta items or frontier probes "
                f"at deeper DAG depths."
            )
        elif avg_p <= 0.50:
            notes.append(
                f"**Floor effect:** Average P(blended) = {avg_p:.3f}. "
                f"Items may be too difficult — risk of frustrating the student."
            )

    # 3. Fisher information analysis
    info_values = [it.item_information for it in s.items if it.item_information is not None]
    if info_values:
        avg_info = sum(info_values) / len(info_values)
        negligible = sum(1 for i in info_values if i < 0.04)
        if negligible > len(info_values) / 2:
            notes.append(
                f"**Low information yield:** {negligible}/{len(info_values)} items had "
                f"Fisher information < 0.04 (negligible). These items barely update "
                f"theta. The student's ability is likely far from the items' difficulty. "
                f"Avg I(theta) = {avg_info:.4f}."
            )

    # 4. Frontier probe analysis
    if frontier_items:
        depths = [it.dag_distance for it in frontier_items if it.dag_distance is not None]
        ancestors = [it.ancestors_if_passed for it in frontier_items if it.ancestors_if_passed is not None]
        if depths:
            avg_depth = sum(depths) / len(depths)
            notes.append(
                f"**Frontier probes:** {len(frontier_items)} probes at DAG depths "
                f"{depths} (avg {avg_depth:.1f}). "
                + (f"Would infer {sum(ancestors)} ancestor skills on pass. " if ancestors else "")
                + ("Shallow probes (depth 1-2) test basic prerequisite skills — "
                   "deeper probes (3+) are more aggressive and can leapfrog further."
                   if avg_depth <= 2 else
                   "Deep probes are aggressive — high-reward if passed.")
            )
    elif not s.is_cold_start and len(s.items) > 0:
        notes.append(
            "**No frontier probes:** This session had zero frontier items. "
            "The student is only drilling known skills with no exploration of "
            "new territory. This limits leapfrog opportunities."
        )

    # 5. Gate advance vs score mismatch (gate > 0 only — at gate 0 all bands
    #    now route through the lesson handler, so this would be a real issue)
    #    Gates advance via derive_gate_from_irt(theta, sigma, min_beta, max_beta, avg_a)
    #    which checks P(correct) at reference difficulties with σ thresholds.
    high_scores_no_gate = [
        it for it in s.items
        if it.score >= 9.0 and it.gate_before == it.gate_after and it.gate_before > 0
    ]
    if high_scores_no_gate:
        notes.append(
            f"**High scores, no gate progress:** {len(high_scores_no_gate)} items scored "
            f"9.0+ but gate didn't advance. Gates are IRT-derived via "
            f"derive_gate_from_irt — check P(correct) at reference difficulties "
            f"and σ thresholds."
        )

    return notes


# ── Main Report ────────────────────────────────────────────────────────────


def generate_journey_report(
    timeline: JourneyTimeline,
    assertion_results: Optional[List[AssertionResult]] = None,
) -> str:
    """Generate a full Markdown report for one journey."""

    lines: List[str] = []
    _h = lines.append

    _h(f"# Pulse Agent Journey Report: {timeline.profile_name}")
    _h("")
    _h(f"**Student ID:** {timeline.student_id}")
    _h(f"**Archetype:** {timeline.archetype}")
    _h(f"**Subject:** {timeline.subject}")
    _h(f"**Sessions:** {timeline.total_sessions}")
    _h(f"**Total Items:** {timeline.total_items}")
    _h(f"**Total Leapfrogs:** {timeline.total_leapfrogs}")
    _h(f"**Total Gate Advances:** {timeline.total_gate_advances}")
    _h(f"**Unique Skills:** {timeline.unique_skills_touched}")
    _h(f"**Unique Subskills:** {timeline.unique_subskills_touched}")
    _h(f"**Started:** {timeline.started_at}")
    _h(f"**Completed:** {timeline.completed_at}")
    _h("")

    # ── Curriculum coverage headline ──
    total_cur = timeline.total_curriculum_nodes
    if total_cur > 0 and timeline.sessions:
        final_snap = timeline.sessions[-1].mastery_snapshot
        known = sum(1 for lc in final_snap.values() if lc.get("current_gate", 0) >= 1)
        mastered = sum(1 for lc in final_snap.values() if lc.get("current_gate", 0) >= 4)
        _h(f"**Curriculum:** {total_cur} subskills total")
        _h(f"**Coverage (final):** {known}/{total_cur} known ({known*100/total_cur:.0f}%), "
           f"{mastered}/{total_cur} mastered ({mastered*100/total_cur:.0f}%)")
        _h("")

    # ── Assertion results ──
    if assertion_results:
        _h("## Assertions")
        _h("")
        passed = sum(1 for r in assertion_results if r.passed)
        total = len(assertion_results)
        _h(f"**{passed}/{total} passed**")
        _h("")
        _h("| Assertion | Result | Message |")
        _h("|-----------|--------|---------|")
        for r in assertion_results:
            icon = "PASS" if r.passed else "FAIL"
            _h(f"| {r.name} | {icon} | {r.message} |")
        _h("")

    # ── Session-by-session summary ──
    _h("## Session Timeline")
    _h("")
    if total_cur > 0:
        _h("| # | Avg Score | Bands (F/C/R) | Leapfrogs | Gate Advances | Known | % Known | Gates (G0/G1/G2/G3/G4) | % Mastered |")
        _h("|---|-----------|---------------|-----------|---------------|-------|---------|------------------------|------------|")
    else:
        _h("| # | Avg Score | Bands (F/C/R) | Leapfrogs | Gate Advances | Skills in State |")
        _h("|---|-----------|---------------|-----------|---------------|-----------------|")

    for s in timeline.sessions:
        bands = f"{s.band_counts.get('frontier', 0)}/{s.band_counts.get('current', 0)}/{s.band_counts.get('review', 0)}"
        skills_in_state = len(s.mastery_snapshot)

        if total_cur > 0:
            # Compute gate distribution from mastery snapshot
            gate_counts = [0, 0, 0, 0, 0]  # G0, G1, G2, G3, G4
            for lc in s.mastery_snapshot.values():
                g = min(lc.get("current_gate", 0), 4)
                gate_counts[g] += 1
            known = sum(gate_counts[1:])  # gate >= 1
            mastered_g4 = gate_counts[4]
            pct_known = known * 100 / total_cur
            pct_mastered = mastered_g4 * 100 / total_cur
            gate_str = "/".join(str(c) for c in gate_counts)
            _h(
                f"| {s.session_number} "
                f"| {s.avg_score:.1f} "
                f"| {bands} "
                f"| {s.total_leapfrogs} "
                f"| {s.total_gate_advances} "
                f"| {known}/{total_cur} "
                f"| {pct_known:.0f}% "
                f"| {gate_str} "
                f"| {pct_mastered:.0f}% |"
            )
        else:
            _h(
                f"| {s.session_number} "
                f"| {s.avg_score:.1f} "
                f"| {bands} "
                f"| {s.total_leapfrogs} "
                f"| {s.total_gate_advances} "
                f"| {skills_in_state} |"
            )
    _h("")

    # ── IRT Decision Context (only sessions with anomalies get full tables) ──
    _h("## IRT Decision Context")
    _h("")

    for s in timeline.sessions:
        commentary = _session_irt_commentary(s)
        p_values = [it.p_correct for it in s.items if it.p_correct is not None]
        avg_p = sum(p_values) / len(p_values) if p_values else 0
        gate_advances = sum(1 for it in s.items if it.gate_before != it.gate_after)

        if commentary:
            # Session has anomalies — show full IRT table
            _h(f"### Session {s.session_number}" + (" (Cold Start)" if s.is_cold_start else ""))
            _h("")
            _h("| Band | Subskill | Mode | Beta | theta | P(irt) | P(blended) | Info | Score | Verdict |")
            _h("|------|----------|------|------|-------|--------|------------|------|-------|---------|")

            for item in s.items:
                p = item.p_correct
                pb = item.p_blended
                info = item.item_information
                p_str = f"{p:.3f}" if p is not None else "--"
                pb_str = f"{pb:.3f}" if pb is not None else "--"
                info_str = f"{info:.4f}" if info is not None else "--"
                verdict = _p_label(pb if pb is not None else p)
                dag_note = f" d={item.dag_distance}" if item.dag_distance is not None else ""

                _h(
                    f"| {item.band}{dag_note} "
                    f"| {item.subskill_id} "
                    f"| {item.target_mode} "
                    f"| {item.target_beta:.1f} "
                    f"| {item.theta_before:.2f} "
                    f"| {p_str} "
                    f"| {pb_str} ({verdict}) "
                    f"| {info_str} ({_info_label(info)}) "
                    f"| {item.score:.1f} "
                    f"| {'G' + str(item.gate_before) + '->' + 'G' + str(item.gate_after) if item.gate_before != item.gate_after else '--'} |"
                )
            _h("")
            for note in commentary:
                _h(f"- {note}")
            _h("")
        else:
            # Clean session — one-line summary
            p_vals = [it.p_blended or it.p_correct for it in s.items if (it.p_blended or it.p_correct) is not None]
            avg_p_clean = sum(p_vals) / len(p_vals) if p_vals else 0
            _h(
                f"- **Session {s.session_number}:** "
                f"avg P(blended)={avg_p_clean:.2f}, "
                f"{gate_advances} gate advances, "
                f"avg score {s.avg_score:.1f} — no anomalies"
            )

    _h("")

    # ── theta progression table ──
    if timeline.sessions:
        _h("## Ability (theta) Progression")
        _h("")

        # Collect all skill_ids seen across all sessions
        all_skills = set()
        for s in timeline.sessions:
            all_skills.update(s.ability_snapshot.keys())

        if all_skills:
            # Show up to 10 skills
            skill_list = sorted(all_skills)[:10]
            header = "| Session | " + " | ".join(
                f"{sid[:20]}" for sid in skill_list
            ) + " |"
            sep = "|---------|" + "|".join(
                "--------" for _ in skill_list
            ) + "|"
            _h(header)
            _h(sep)

            for s in timeline.sessions:
                vals = []
                for sid in skill_list:
                    ab = s.ability_snapshot.get(sid)
                    if ab:
                        vals.append(f"{ab['theta']:.1f}")
                    else:
                        vals.append("--")
                _h(f"| {s.session_number} | " + " | ".join(vals) + " |")
            _h("")

    # ── Gate progression table ──
    if timeline.sessions:
        _h("## Mastery Gate Progression")
        _h("")

        all_subskills = set()
        for s in timeline.sessions:
            all_subskills.update(s.mastery_snapshot.keys())

        if all_subskills:
            subskill_list = sorted(all_subskills)[:10]
            header = "| Session | " + " | ".join(
                f"{sid[:20]}" for sid in subskill_list
            ) + " |"
            sep = "|---------|" + "|".join(
                "--------" for _ in subskill_list
            ) + "|"
            _h(header)
            _h(sep)

            for s in timeline.sessions:
                vals = []
                for sid in subskill_list:
                    lc = s.mastery_snapshot.get(sid)
                    if lc:
                        vals.append(f"G{lc['current_gate']}")
                    else:
                        vals.append("--")
                _h(f"| {s.session_number} | " + " | ".join(vals) + " |")
            _h("")

    # ── Leapfrog summary ──
    _h("## Leapfrog Events")
    _h("")
    leapfrog_items = [
        (s.session_number, item)
        for s in timeline.sessions
        for item in s.items
        if item.leapfrog_triggered
    ]
    if leapfrog_items:
        total_inferred = sum(len(it.inferred_skills) for _, it in leapfrog_items)
        _h(f"**{len(leapfrog_items)} leapfrogs**, inferring {total_inferred} total ancestor skills.")
        _h("")

        # Show up to 5 examples
        _h("| Session | Probe | Depth | Score | P(c) | Inferred |")
        _h("|---------|-------|-------|-------|------|----------|")
        for sess_num, item in leapfrog_items[:5]:
            p_str = f"{item.p_correct:.3f}" if item.p_correct is not None else "--"
            _h(
                f"| {sess_num} "
                f"| {item.subskill_id} "
                f"| {item.dag_distance or '?'} "
                f"| {item.score:.1f} "
                f"| {p_str} "
                f"| {len(item.inferred_skills)} skills |"
            )
        if len(leapfrog_items) > 5:
            _h(f"| ... | {len(leapfrog_items) - 5} more | | | | |")
        _h("")
    else:
        _h("No leapfrogs triggered during this journey.")
        _h("")
        frontier_count = sum(
            sum(1 for it in s.items if it.band == "frontier")
            for s in timeline.sessions
        )
        if frontier_count == 0:
            _h("> **Why?** No frontier probes in any session.")
        else:
            avg_frontier_score = 0.0
            total_frontier = 0
            for s in timeline.sessions:
                for it in s.items:
                    if it.band == "frontier":
                        avg_frontier_score += it.score
                        total_frontier += 1
            if total_frontier > 0:
                avg_frontier_score /= total_frontier
                _h(f"> **Why?** {total_frontier} frontier probes, avg score {avg_frontier_score:.1f} "
                   f"({'below 7.5 threshold' if avg_frontier_score < 7.5 else 'check lesson group scoring'}).")
        _h("")

    # ── Selection Analysis (why these skills?) ──
    _h("## Selection Analysis")
    _h("")
    _h("> Why did the engine choose these skills? Items are ranked by a unified ")
    _h("> utility function: utility = information(θ,a,b) × urgency(σ, decay, state). ")
    _h("> Band labels (frontier/current/review) are emergent from state, not allocated ")
    _h("> by percentage. This section tracks selection patterns and flags potential issues.")
    _h("")

    skill_session_counts: Dict[str, int] = defaultdict(int)
    skill_item_counts: Dict[str, int] = defaultdict(int)
    skill_bands: Dict[str, set] = defaultdict(set)
    for s in timeline.sessions:
        session_skills = set()
        for it in s.items:
            skill_item_counts[it.skill_id] += 1
            skill_bands[it.skill_id].add(it.band)
            session_skills.add(it.skill_id)
        for sk in session_skills:
            skill_session_counts[sk] += 1

    _h("| Skill | Sessions | Items | Bands Seen | Concentration |")
    _h("|-------|----------|-------|------------|---------------|")
    total_items = timeline.total_items or 1
    for sk in sorted(skill_item_counts, key=lambda k: -skill_item_counts[k]):
        pct = skill_item_counts[sk] / total_items * 100
        bands_str = ", ".join(sorted(skill_bands[sk]))
        flag = " << dominant" if pct > 50 else ""
        _h(
            f"| {sk} "
            f"| {skill_session_counts[sk]}/{timeline.total_sessions} "
            f"| {skill_item_counts[sk]} ({pct:.0f}%) "
            f"| {bands_str} "
            f"| {flag} |"
        )
    _h("")

    return "\n".join(lines)


def generate_graph_report(
    graph: Dict[str, Any],
    timeline: Optional[JourneyTimeline] = None,
) -> str:
    """
    Generate a DAG analysis section showing nodes, edges, and journey overlay.

    Shows:
    - Full node inventory grouped by skill (with gate status from journey)
    - Edge list (prerequisite -> dependent)
    - Which nodes were directly touched, leapfrog-inferred, or untouched
    - Traversal path analysis: did the student follow expected edges?
    """
    lines: List[str] = []
    _h = lines.append

    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])

    # Build lookup structures
    node_map = {n["id"]: n for n in nodes}
    forward: Dict[str, List[str]] = defaultdict(list)
    reverse: Dict[str, List[str]] = defaultdict(list)
    for edge in edges:
        src, tgt = edge["source"], edge["target"]
        forward[src].append(tgt)
        reverse[tgt].append(src)

    # Collect journey data if available
    touched_directly: set = set()      # subskills that appeared as items
    leapfrog_inferred: set = set()     # subskills inferred via leapfrog
    leapfrog_probes: set = set()       # subskills that triggered a leapfrog
    gate_map: Dict[str, int] = {}      # latest gate per subskill
    skill_scores: Dict[str, List[float]] = defaultdict(list)

    if timeline and timeline.sessions:
        for s in timeline.sessions:
            for item in s.items:
                touched_directly.add(item.subskill_id)
                skill_scores[item.subskill_id].append(item.score)
                if item.leapfrog_triggered:
                    leapfrog_probes.add(item.subskill_id)
                    for inf in item.inferred_skills:
                        leapfrog_inferred.add(inf)
            # Use latest mastery snapshot for gates
            for sid, lc in s.mastery_snapshot.items():
                gate_map[sid] = lc.get("current_gate", 0)

    _h("## Curriculum DAG Analysis")
    _h("")
    _h(f"**Total nodes:** {len(nodes)} subskills")
    _h(f"**Total edges:** {len(edges)} prerequisites")
    if timeline:
        _h(f"**Touched directly:** {len(touched_directly)} nodes")
        _h(f"**Leapfrog-inferred:** {len(leapfrog_inferred)} nodes")
        _h(f"**Untouched:** {len(nodes) - len(touched_directly) - len(leapfrog_inferred - touched_directly)} nodes")
    _h("")

    # ── Nodes grouped by skill ──
    skill_groups: Dict[str, List[Dict]] = defaultdict(list)
    for node in nodes:
        skill_id = node.get("skill_id", node.get("parent_id", "unknown"))
        skill_groups[skill_id].append(node)

    _h("### Nodes by Skill")
    _h("")
    _h("| Skill | Subskill | Description | Status | Gate | Avg Score |")
    _h("|-------|----------|-------------|--------|------|-----------|")

    for skill_id in sorted(skill_groups.keys()):
        group = sorted(skill_groups[skill_id], key=lambda n: n["id"])
        for node in group:
            nid = node["id"]
            desc = node.get("description", node.get("label", ""))[:40]
            # Determine status
            if nid in leapfrog_probes:
                status = "PROBED+LEAP"
            elif nid in touched_directly:
                status = "TOUCHED"
            elif nid in leapfrog_inferred:
                status = "INFERRED"
            elif timeline:
                status = "untouched"
            else:
                status = "--"

            gate = f"G{gate_map[nid]}" if nid in gate_map else "--"
            avg = ""
            if nid in skill_scores:
                avg = f"{sum(skill_scores[nid])/len(skill_scores[nid]):.1f}"

            _h(f"| {skill_id} | {nid} | {desc} | {status} | {gate} | {avg} |")
    _h("")

    # ── Edge list with traversal annotation ──
    _h("### Prerequisite Edges")
    _h("")
    _h("> source -> target means source must be mastered before target unlocks.")
    _h("")
    _h("| Source | Target | Threshold | Traversed? |")
    _h("|--------|--------|-----------|------------|")

    all_known = touched_directly | leapfrog_inferred
    for edge in sorted(edges, key=lambda e: (e["source"], e["target"])):
        src = edge["source"]
        tgt = edge["target"]
        threshold = edge.get("threshold", edge.get("proficiency_threshold", 0.8))
        # Edge was "traversed" if source was mastered/inferred AND target was touched/inferred
        if timeline:
            src_known = src in all_known
            tgt_known = tgt in all_known
            if src_known and tgt_known:
                traversal = "YES"
            elif src_known and not tgt_known:
                traversal = "frontier"
            else:
                traversal = "--"
        else:
            traversal = "--"
        _h(f"| {src} | {tgt} | {threshold} | {traversal} |")
    _h("")

    # ── Leapfrog path analysis ──
    if leapfrog_probes and timeline:
        _h("### Leapfrog Path Analysis")
        _h("")
        _h("> For each leapfrog probe, shows the ancestor chain that was inferred.")
        _h("")

        for s in timeline.sessions:
            for item in s.items:
                if not item.leapfrog_triggered:
                    continue
                _h(f"**Session {s.session_number} — `{item.subskill_id}`** "
                   f"(depth {item.dag_distance or '?'}, score {item.score:.1f})")
                _h("")

                # Walk ancestors via reverse edges
                ancestors_in_dag = set()
                queue = list(reverse.get(item.subskill_id, []))
                visited = set()
                while queue:
                    cur = queue.pop(0)
                    if cur in visited:
                        continue
                    visited.add(cur)
                    ancestors_in_dag.add(cur)
                    queue.extend(p for p in reverse.get(cur, []) if p not in visited)

                # Show which ancestors were inferred vs already known
                inferred_set = set(item.inferred_skills)
                _h("| Ancestor | In DAG | Inferred? | Was Known? |")
                _h("|----------|--------|-----------|------------|")

                for anc in sorted(ancestors_in_dag):
                    in_inferred = "YES" if anc in inferred_set else "no"
                    was_known = "already" if (anc in touched_directly and anc not in inferred_set) else "--"
                    _h(f"| {anc} | yes | {in_inferred} | {was_known} |")

                # Flag any inferred skills NOT in DAG ancestors (shouldn't happen)
                orphans = inferred_set - ancestors_in_dag - {item.subskill_id}
                if orphans:
                    _h("")
                    _h(f"**WARNING:** {len(orphans)} inferred skills not in DAG ancestor chain:")
                    for o in sorted(orphans):
                        _h(f"  - `{o}`")
                _h("")

    # ── Next-step analysis (what SHOULD come next?) ──
    if timeline:
        _h("### Next-Step Candidates")
        _h("")
        _h("> Nodes reachable from current frontier (1-3 edges ahead) that haven't been touched.")
        _h("")

        # Frontier = nodes that are known but whose children are not all known
        frontier = set()
        for nid in all_known:
            children = forward.get(nid, [])
            if children and not all(c in all_known for c in children):
                frontier.add(nid)

        # BFS forward from frontier, 1-3 hops
        next_candidates: List[tuple] = []  # (node_id, depth, parent)
        bfs_queue = []
        for fid in frontier:
            for child in forward.get(fid, []):
                if child not in all_known:
                    bfs_queue.append((child, 1, fid))

        bfs_visited = set()
        while bfs_queue:
            nid, depth, parent = bfs_queue.pop(0)
            if nid in bfs_visited or depth > 3:
                continue
            bfs_visited.add(nid)
            next_candidates.append((nid, depth, parent))
            if depth < 3:
                for child in forward.get(nid, []):
                    if child not in bfs_visited and child not in all_known:
                        bfs_queue.append((child, depth + 1, nid))

        if next_candidates:
            _h("| Candidate | Depth | From (frontier) | Skill | Description |")
            _h("|-----------|-------|-----------------|-------|-------------|")
            for nid, depth, parent in sorted(next_candidates, key=lambda x: (x[1], x[0])):
                node = node_map.get(nid, {})
                desc = node.get("description", node.get("label", ""))[:40]
                skill = node.get("skill_id", "?")
                _h(f"| {nid} | {depth} | {parent} | {skill} | {desc} |")
        else:
            _h("No next-step candidates found — student may have reached the end of the DAG.")
        _h("")

    return "\n".join(lines)


def save_report(report: str, output_dir: Path, profile_name: str, subject: str = "") -> Path:
    """Save a report to a Markdown file.

    Args:
        subject: Subject ID (e.g. "MATHEMATICS_GK") — included in filename
                 when provided so reports are distinguishable per-subject.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    subject_tag = f"_{subject}" if subject else ""
    filename = f"journey_report_{profile_name}{subject_tag}.md"
    path = output_dir / filename
    path.write_text(report, encoding="utf-8")
    logger.info(f"Report saved to {path}")
    return path


def generate_comparison_report(
    timelines: List[JourneyTimeline],
) -> str:
    """Generate a side-by-side comparison of multiple journeys."""
    lines: List[str] = []
    _h = lines.append

    _h("# Pulse Agent -- Journey Comparison Report")
    _h("")
    _h("| Profile | Archetype | Sessions | Items | Leapfrogs | Gate Advances | Skills |")
    _h("|---------|-----------|----------|-------|-----------|---------------|--------|")

    for t in timelines:
        _h(
            f"| {t.profile_name} "
            f"| {t.archetype} "
            f"| {t.total_sessions} "
            f"| {t.total_items} "
            f"| {t.total_leapfrogs} "
            f"| {t.total_gate_advances} "
            f"| {t.unique_skills_touched} |"
        )
    _h("")

    # Assertion summary per profile
    _h("## Assertion Summary")
    _h("")
    for t in timelines:
        results = run_assertions_for_archetype(t, t.archetype)
        passed = sum(1 for r in results if r.passed)
        total = len(results)
        status = "ALL PASS" if passed == total else f"{passed}/{total}"
        _h(f"### {t.profile_name} ({t.archetype}): {status}")
        _h("")
        for r in results:
            icon = "PASS" if r.passed else "FAIL"
            _h(f"- [{icon}] {r.name}: {r.message}")
        _h("")

    return "\n".join(lines)
