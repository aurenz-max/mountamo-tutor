"""Backfill parent-facing subskill summaries through the draft -> publish pipeline.

New and edited subskills get a summary on every publish (draft_curriculum.publish).
This script covers what was published before that existed.

    python scripts/fill_parent_summaries.py                  # dry run: what each draft needs
    python scripts/fill_parent_summaries.py --fill           # write summaries onto the drafts
    python scripts/fill_parent_summaries.py --fill --publish # ...then publish each CLEAN subject

A subject is clean when its draft, minus summary fields, matches what is published
(accepted units only, authoring metadata stripped). A draft carrying other
unpublished edits is never published here; it is listed for its author instead.
Filter with --grade K and/or --subject MATHEMATICS.
"""

import argparse
import asyncio
import json
import os
import sys
from copy import deepcopy

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.draft_curriculum_service import draft_curriculum, _is_accepted  # noqa: E402
from app.db.firestore_curriculum_service import firestore_curriculum_sync  # noqa: E402
from app.db.firestore_graph_service import firestore_graph_service  # noqa: E402
from app.services.parent_summaries import fill_parent_summaries, needs_summary  # noqa: E402

SUMMARY_FIELDS = ("parent_summary", "parent_summary_hash")


def _content(curriculum):
    """Curriculum with summary fields removed, for comparing draft and published."""
    c = deepcopy(curriculum or [])
    for u in c:
        for sk in u.get("skills", []):
            for ss in sk.get("subskills", []):
                for f in SUMMARY_FIELDS:
                    ss.pop(f, None)
    return json.dumps(c, sort_keys=True, default=str)


def _published(grade, subject_id):
    snap = (firestore_graph_service.curriculum_published.document(grade)
            .collection("subjects").document(subject_id).get())
    return snap.to_dict() if snap.exists else None


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--grade")
    ap.add_argument("--subject")
    ap.add_argument("--fill", action="store_true")
    ap.add_argument("--publish", action="store_true")
    args = ap.parse_args()

    firestore_graph_service.initialize()
    firestore_curriculum_sync.initialize()

    # List first: a stream left open across slow Gemini calls times out (504).
    targets = []
    for grade_doc in list(firestore_curriculum_sync.client.collection("curriculum_drafts").list_documents()):
        grade = grade_doc.id
        if args.grade and grade not in (args.grade, {"K": "Kindergarten"}.get(args.grade)):
            continue
        for subj in list(grade_doc.collection("subjects").list_documents()):
            if not args.subject or subj.id == args.subject:
                targets.append((grade, subj.id))

    for grade, subject_id in targets:
        doc = await draft_curriculum.get_draft(grade, subject_id) or {}
        subskills = [ss for u in doc.get("curriculum", []) for sk in u.get("skills", []) for ss in sk.get("subskills", [])]
        need = sum(1 for ss in subskills if needs_summary(ss))
        pub = _published(grade, subject_id)
        accepted = [draft_curriculum._strip_authoring_metadata(u) for u in doc.get("curriculum", []) if _is_accepted(u)]
        clean = pub is not None and _content(accepted) == _content(pub.get("curriculum"))
        line = f"{grade:>14} {subject_id:<22} subskills={len(subskills):<4} need={need:<4} {'clean' if clean else 'DRAFT DIFFERS FROM PUBLISHED' if pub else 'never published'}"
        if args.fill and need:
            res = await fill_parent_summaries(doc)
            await draft_curriculum.save_draft(grade, subject_id, doc)
            line += f"  filled {res['written']}/{res['needed']}"
        pub_missing = sum(1 for e in (pub or {}).get("subskill_index", {}).values() if not e.get("parent_summary"))
        line += f" published_without={pub_missing}"
        if args.publish and (need or pub_missing):
            if clean:
                published = await draft_curriculum.publish(grade, subject_id, deployed_by="fill_parent_summaries")
                with_summary = sum(1 for e in published.get("subskill_index", {}).values() if e.get("parent_summary"))
                line += f"  PUBLISHED ({with_summary}/{len(published.get('subskill_index', {}))} with summary)"
            else:
                line += "  not published (not clean)"
        print(line, flush=True)


if __name__ == "__main__":
    asyncio.run(main())
