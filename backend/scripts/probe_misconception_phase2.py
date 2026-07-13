"""Runtime probe for Misconception Loop S4 (Firestore -> generation context).

Uses a disposable synthetic student, always deletes the probe document, and
avoids HTTP auth so the objective-state assembly can be exercised directly.
"""

import argparse
import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.api.endpoints import student_profile  # noqa: E402
from app.db.firestore_service import FirestoreService  # noqa: E402


class _NoCompetency:
    async def get_competency(self, **_kwargs):
        return None


class _UnusedMapping:
    retrieval_matcher = None


async def run(student_id: int) -> None:
    firestore = FirestoreService()
    subskill_id = "MISCONCEPTION_PHASE2_PROBE"
    attempt_id = "misconception-phase2-probe"
    student_ref = firestore._student_doc(student_id)
    student_existed = student_ref.get().exists
    doc_ref = firestore._misconceptions_subcollection(student_id).document("tape-diagram")

    original_factory = student_profile.get_firestore_service
    student_profile.get_firestore_service = lambda: firestore
    try:
        await firestore.add_or_update_misconception(
            student_id=student_id,
            primitive_type="tape-diagram",
            scope="primitive",
            subskill_id=subskill_id,
            misconception_text=(
                "The student treats the smaller quantity as the difference."
            ),
            source_attempt_id=attempt_id,
            confidence="high",
            evidence_tier="structured",
        )

        result = await student_profile.get_generation_context(
            student_profile.GenerationContextRequest(
                student_id=student_id,
                topic="Comparing quantities",
                grade_level="1",
                subject="Mathematics",
                include_persona=False,
                objectives=[student_profile.ObjectiveIn(
                    id="obj-compare",
                    text="Compare two quantities and find the difference",
                    verb="apply",
                    subskill_id=subskill_id,
                    skill_id="MISCONCEPTION_PHASE2_SKILL",
                )],
            ),
            user_context={},
            competency_service=_NoCompetency(),
            mapping_service=_UnusedMapping(),
        )

        objective = result["objectives"][0]
        active = result["activeMisconceptions"][0]
        assert active == {
            "text": "The student treats the smaller quantity as the difference.",
            "detectedAt": active["detectedAt"],
            "sourceAttemptId": attempt_id,
            "primitiveType": "tape-diagram",
            "scope": "primitive",
            "skillId": None,
            "subskillId": subskill_id,
            "misconceptionKey": "tape-diagram",
        }
        print(json.dumps({
            "status": "pass",
            "student_id": student_id,
            "objective_id": objective["objectiveId"],
            "subskill_id": objective["subskillId"],
            "activeMisconception": active,
        }, indent=2))
    finally:
        student_profile.get_firestore_service = original_factory
        doc_ref.delete()
        if not student_existed:
            student_ref.delete()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--student", type=int, default=999904)
    args = parser.parse_args()
    asyncio.run(run(args.student))
