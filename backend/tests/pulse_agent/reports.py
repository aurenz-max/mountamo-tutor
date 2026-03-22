"""
Journey Reports
===============

Generate human-readable reports from journey timelines.
Outputs Markdown that can be saved to files or printed to console.

Includes IRT decision context: P(correct), Fisher information, item difficulty,
and commentary explaining why the engine chose each item and how the
selection algorithm's assumptions match observed behavior.
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
    p_values = [it.p_correct for it in s.items if it.p_correct is not None]
    if p_values:
        avg_p = sum(p_values) / len(p_values)
        high_p_count = sum(1 for p in p_values if p >= 0.90)
        if avg_p >= 0.90:
            notes.append(
                f"**Ceiling effect:** Average P(correct) = {avg_p:.3f}. "
                f"{high_p_count}/{len(p_values)} items had P >= 0.90 — the student "
                f"has very high probability of acing these. Items are not providing "
                f"maximum information. Consider higher-beta items or frontier probes "
                f"at deeper DAG depths."
            )
        elif avg_p <= 0.50:
            notes.append(
                f"**Floor effect:** Average P(correct) = {avg_p:.3f}. "
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

    # 5. Gate advance vs score mismatch
    high_scores_no_gate = [
        it for it in s.items
        if it.score >= 9.0 and it.gate_before == it.gate_after and it.gate_before == 0
    ]
    if high_scores_no_gate:
        notes.append(
            f"**High scores, no gate progress:** {len(high_scores_no_gate)} items scored "
            f"9.0+ but stayed at Gate 0. This happens when items are `practice` source "
            f"(not `lesson`) at Gate 0 — mastery engine requires `lesson` evals for initial "
            f"gate advancement. Check eval_source assignment logic."
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
    _h("| # | Avg Score | Bands (F/C/R) | Leapfrogs | Gate Advances | Skills in State |")
    _h("|---|-----------|---------------|-----------|---------------|-----------------|")

    for s in timeline.sessions:
        bands = f"{s.band_counts.get('frontier', 0)}/{s.band_counts.get('current', 0)}/{s.band_counts.get('review', 0)}"
        skills_in_state = len(s.mastery_snapshot)
        _h(
            f"| {s.session_number} "
            f"| {s.avg_score:.1f} "
            f"| {bands} "
            f"| {s.total_leapfrogs} "
            f"| {s.total_gate_advances} "
            f"| {skills_in_state} |"
        )
    _h("")

    # ── IRT Decision Context (per session) ──
    _h("## IRT Decision Context")
    _h("")
    _h("> Shows what the IRT model predicted for each item vs what happened.")
    _h("> P(correct) near 1.0 means the item was trivially easy for this student;")
    _h("> Fisher Information near 0.0 means we learned almost nothing from the response.")
    _h("")

    for s in timeline.sessions:
        _h(f"### Session {s.session_number}" + (" (Cold Start)" if s.is_cold_start else ""))
        _h("")
        _h("| Band | Subskill | Mode | Beta | theta | P(correct) | Info | Score | Verdict |")
        _h("|------|----------|------|------|-------|------------|------|-------|---------|")

        for item in s.items:
            p = item.p_correct
            info = item.item_information
            p_str = f"{p:.3f}" if p is not None else "--"
            info_str = f"{info:.4f}" if info is not None else "--"
            verdict = _p_label(p)
            dag_note = f" d={item.dag_distance}" if item.dag_distance is not None else ""

            _h(
                f"| {item.band}{dag_note} "
                f"| {item.subskill_id} "
                f"| {item.target_mode} "
                f"| {item.target_beta:.1f} "
                f"| {item.theta_before:.2f} "
                f"| {p_str} ({verdict}) "
                f"| {info_str} ({_info_label(info)}) "
                f"| {item.score:.1f} "
                f"| {'G' + str(item.gate_before) + '->' + 'G' + str(item.gate_after) if item.gate_before != item.gate_after else '--'} |"
            )
        _h("")

        # Add narrative commentary
        commentary = _session_irt_commentary(s)
        if commentary:
            for note in commentary:
                _h(f"- {note}")
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

    # ── Leapfrog details ──
    leapfrog_sessions = [
        s for s in timeline.sessions if s.total_leapfrogs > 0
    ]
    if leapfrog_sessions:
        _h("## Leapfrog Events")
        _h("")
        for s in leapfrog_sessions:
            for item in s.items:
                if item.leapfrog_triggered:
                    p_str = f", P(correct)={item.p_correct:.3f}" if item.p_correct is not None else ""
                    ancestors_str = f", would infer {item.ancestors_if_passed} ancestors" if item.ancestors_if_passed else ""
                    _h(
                        f"- **Session {s.session_number}**: "
                        f"Probed `{item.subskill_id}` at DAG depth {item.dag_distance or '?'} "
                        f"(score {item.score:.1f}{p_str}{ancestors_str}), "
                        f"inferred {len(item.inferred_skills)} skills:"
                    )
                    for inf in item.inferred_skills[:8]:
                        _h(f"  - `{inf}`")
                    if len(item.inferred_skills) > 8:
                        _h(f"  - ... and {len(item.inferred_skills) - 8} more")
        _h("")
    else:
        _h("## Leapfrog Events")
        _h("")
        _h("No leapfrogs triggered during this journey.")
        _h("")
        # Diagnose why
        frontier_count = sum(
            sum(1 for it in s.items if it.band == "frontier")
            for s in timeline.sessions
        )
        if frontier_count == 0:
            _h("> **Why?** No frontier probes were included in any session. "
               "Leapfrogs require frontier-band items. Check that the probe "
               "candidate pool is not empty and that frontier allocation "
               "percentage is > 0.")
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
                if avg_frontier_score < 7.5:
                    _h(f"> **Why?** {total_frontier} frontier probes fired but "
                       f"avg score was {avg_frontier_score:.1f} (threshold: 7.5). "
                       f"Student didn't score high enough to trigger leapfrog.")
                else:
                    _h(f"> **Why?** {total_frontier} frontier probes with avg score "
                       f"{avg_frontier_score:.1f} >= 7.5, but no leapfrog. "
                       f"Check lesson_group_id grouping — leapfrogs require all "
                       f"items in a group to be scored.")
        _h("")

    # ── Selection Analysis (why these skills?) ──
    _h("## Selection Analysis")
    _h("")
    _h("> Why did the engine choose these skills? This section tracks which skills ")
    _h("> were selected across sessions, how often, and flags potential issues ")
    _h("> with the candidate selection or midpoint algorithm.")
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

    # ── Item-level detail for each session ──
    if timeline.sessions:
        _h("## Full Session Details")
        _h("")
        for s in timeline.sessions:
            _h(f"### Session {s.session_number}")
            _h("")
            _h("| # | Band | Subskill | Group | Mode | Score | theta B->A | Gate | P(c) | Info |")
            _h("|---|------|----------|-------|------|-------|------------|------|------|------|")
            for i, item in enumerate(s.items, 1):
                p_str = f"{item.p_correct:.3f}" if item.p_correct is not None else "--"
                info_str = f"{item.item_information:.4f}" if item.item_information is not None else "--"
                group = item.lesson_group_id[:15] if item.lesson_group_id else "--"
                _h(
                    f"| {i} "
                    f"| {item.band} "
                    f"| {item.subskill_id} "
                    f"| {group} "
                    f"| {item.target_mode} "
                    f"| {item.score:.1f} "
                    f"| {item.theta_before:.1f}->{item.theta_after:.1f} "
                    f"| G{item.gate_before}->G{item.gate_after} "
                    f"| {p_str} "
                    f"| {info_str} |"
                )
            _h("")

    return "\n".join(lines)


def save_report(report: str, output_dir: Path, profile_name: str) -> Path:
    """Save a report to a Markdown file."""
    output_dir.mkdir(parents=True, exist_ok=True)
    filename = f"journey_report_{profile_name}.md"
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
