"""
LineageDetector — publish-time change detection for curriculum lineage.

Diffs old (published) vs new (draft) subskill_index to auto-detect
rename, merge, split, and retire operations.  Heuristic-based with
author annotation override support.

Called from draft_curriculum_service.publish() before deploying.
"""

from __future__ import annotations

import logging
from difflib import SequenceMatcher
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Minimum description similarity for auto-rename detection
RENAME_SIMILARITY_THRESHOLD = 0.7


def _similarity(a: str, b: str) -> float:
    """Simple token-overlap ratio between two description strings."""
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


def detect_changes(
    old_index: Dict[str, Any],
    new_index: Dict[str, Any],
    subject_id: str = "",
    grade: str = "",
) -> List[Dict[str, Any]]:
    """
    Compare old (published) vs new (about-to-publish) subskill_index.

    Returns a list of lineage record dicts ready to write to Firestore.
    Ambiguous cases are NOT auto-created — they're returned with
    operation="ambiguous" for human review.
    """
    old_ids = set(old_index.keys())
    new_ids = set(new_index.keys())

    removed = old_ids - new_ids  # IDs that disappeared
    added = new_ids - old_ids    # IDs that appeared
    unchanged = old_ids & new_ids  # IDs present in both

    if not removed:
        return []  # Nothing to track

    records: List[Dict[str, Any]] = []

    # Group removed/added by skill_id for merge/split detection
    removed_by_skill: Dict[str, List[str]] = {}
    for rid in removed:
        skill = old_index[rid].get("skill_id", "")
        removed_by_skill.setdefault(skill, []).append(rid)

    added_by_skill: Dict[str, List[str]] = {}
    for aid in added:
        skill = new_index[aid].get("skill_id", "")
        added_by_skill.setdefault(skill, []).append(aid)

    # Track which removed/added IDs we've matched
    matched_removed = set()
    matched_added = set()

    # Pass 1: Detect renames — 1:1 mapping within the same skill
    for skill_id, r_ids in removed_by_skill.items():
        a_ids = added_by_skill.get(skill_id, [])
        if not a_ids:
            continue

        # Try to match by description similarity
        pairs = _find_best_matches(r_ids, a_ids, old_index, new_index)
        for old_id, new_id, sim in pairs:
            if sim >= RENAME_SIMILARITY_THRESHOLD:
                records.append(_make_record(
                    old_id=old_id,
                    canonical_id=new_id,
                    operation="rename",
                    old_index=old_index,
                    new_index=new_index,
                    subject_id=subject_id,
                    grade=grade,
                    description=f"Renamed: '{old_index[old_id].get('subskill_description', '')}' "
                                f"→ '{new_index[new_id].get('subskill_description', '')}'",
                ))
                matched_removed.add(old_id)
                matched_added.add(new_id)

    # Pass 2: Detect merges — N removed : 1 added in same skill
    for skill_id, r_ids in removed_by_skill.items():
        unmatched_r = [r for r in r_ids if r not in matched_removed]
        a_ids = added_by_skill.get(skill_id, [])
        unmatched_a = [a for a in a_ids if a not in matched_added]

        if len(unmatched_r) > 1 and len(unmatched_a) == 1:
            new_id = unmatched_a[0]
            for old_id in unmatched_r:
                records.append(_make_record(
                    old_id=old_id,
                    canonical_id=new_id,
                    operation="merge",
                    old_index=old_index,
                    new_index=new_index,
                    subject_id=subject_id,
                    grade=grade,
                    description=f"Merged into '{new_index[new_id].get('subskill_description', '')}'",
                ))
                matched_removed.add(old_id)
            matched_added.add(new_id)

    # Pass 3: Detect splits — 1 removed : N added in same skill
    for skill_id, r_ids in removed_by_skill.items():
        unmatched_r = [r for r in r_ids if r not in matched_removed]
        a_ids = added_by_skill.get(skill_id, [])
        unmatched_a = [a for a in a_ids if a not in matched_added]

        if len(unmatched_r) == 1 and len(unmatched_a) > 1:
            old_id = unmatched_r[0]
            records.append(_make_record(
                old_id=old_id,
                canonical_id=unmatched_a[0],  # primary target
                canonical_ids=unmatched_a,
                operation="split",
                old_index=old_index,
                new_index=new_index,
                subject_id=subject_id,
                grade=grade,
                description=f"Split into {len(unmatched_a)} subskills",
            ))
            matched_removed.add(old_id)
            for a in unmatched_a:
                matched_added.add(a)

    # Pass 4: Remaining unmatched removed IDs → retire or ambiguous
    for old_id in removed:
        if old_id in matched_removed:
            continue
        # Check if there are any unmatched added IDs in ANY skill with high similarity
        best_match, best_sim = _find_cross_skill_match(old_id, added - matched_added, old_index, new_index)
        if best_match and best_sim >= RENAME_SIMILARITY_THRESHOLD:
            records.append(_make_record(
                old_id=old_id,
                canonical_id=best_match,
                operation="rename",
                old_index=old_index,
                new_index=new_index,
                subject_id=subject_id,
                grade=grade,
                description=f"Cross-skill rename (similarity={best_sim:.2f})",
            ))
            matched_removed.add(old_id)
            matched_added.add(best_match)
        else:
            records.append(_make_record(
                old_id=old_id,
                canonical_id=None,
                operation="retire",
                old_index=old_index,
                new_index=new_index,
                subject_id=subject_id,
                grade=grade,
                description=f"Retired: '{old_index[old_id].get('subskill_description', '')}'",
            ))
            matched_removed.add(old_id)

    return records


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _find_best_matches(
    removed_ids: List[str],
    added_ids: List[str],
    old_index: Dict[str, Any],
    new_index: Dict[str, Any],
) -> List[Tuple[str, str, float]]:
    """Find the best 1:1 matches between removed and added IDs by description similarity."""
    if not removed_ids or not added_ids:
        return []

    # Compute all pairwise similarities
    pairs = []
    for rid in removed_ids:
        old_desc = old_index[rid].get("subskill_description", "")
        for aid in added_ids:
            new_desc = new_index[aid].get("subskill_description", "")
            sim = _similarity(old_desc, new_desc)
            pairs.append((rid, aid, sim))

    # Greedy 1:1 matching (highest similarity first)
    pairs.sort(key=lambda x: x[2], reverse=True)
    used_r = set()
    used_a = set()
    result = []
    for rid, aid, sim in pairs:
        if rid in used_r or aid in used_a:
            continue
        result.append((rid, aid, sim))
        used_r.add(rid)
        used_a.add(aid)

    return result


def _find_cross_skill_match(
    old_id: str,
    candidate_adds: set,
    old_index: Dict[str, Any],
    new_index: Dict[str, Any],
) -> Tuple[Optional[str], float]:
    """Find the best description match for old_id across all unmatched added IDs."""
    old_desc = old_index[old_id].get("subskill_description", "")
    best_id = None
    best_sim = 0.0
    for aid in candidate_adds:
        new_desc = new_index[aid].get("subskill_description", "")
        sim = _similarity(old_desc, new_desc)
        if sim > best_sim:
            best_sim = sim
            best_id = aid
    return best_id, best_sim


def _make_record(
    old_id: str,
    canonical_id: Optional[str],
    operation: str,
    old_index: Dict[str, Any],
    new_index: Dict[str, Any],
    subject_id: str = "",
    grade: str = "",
    description: str = "",
    canonical_ids: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Build a lineage record dict."""
    old_entry = old_index.get(old_id, {})
    new_entry = new_index.get(canonical_id, {}) if canonical_id else {}

    record = {
        "old_id": old_id,
        "canonical_ids": canonical_ids or ([canonical_id] if canonical_id else []),
        "operation": operation,
        "level": "subskill",
        "old_skill_id": old_entry.get("skill_id"),
        "canonical_skill_id": new_entry.get("skill_id") or old_entry.get("skill_id"),
        "subject_id": subject_id,
        "grade": grade,
        "description": description,
    }
    return record
