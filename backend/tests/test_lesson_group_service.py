"""
Tests for LessonGroupService — merge-up grouper, linear cost model, and the
daily pulse beat (measurement diversion).

All methods under test are stateless classmethods; no Firestore mocking needed.
"""

import sys
import unittest
from pathlib import Path

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.models.lesson_plan import BlockType, block_cost_minutes
from app.services.lesson_group_service import (
    LessonGroupService,
    MAX_GROUP_SIZE,
    PULSE_BEAT_MAX_ITEMS,
)


def _cand(
    sid,
    subject="Math",
    unit="Unit A",
    skill="Skill One",
    ctype="new",
    gate=0,
    **extra,
):
    return {
        "skill_id": sid,
        "subject": subject,
        "unit_title": unit,
        "skill_description": skill,
        "subskill_description": f"desc {sid}",
        "type": ctype,
        "mastery_gate": gate,
        **extra,
    }


class TestCostModel(unittest.TestCase):
    def test_reproduces_legacy_typical_sizes(self):
        # Constants were chosen so typical block sizes match the old flat costs
        self.assertEqual(block_cost_minutes(BlockType.LESSON, 4), 18)
        self.assertEqual(block_cost_minutes(BlockType.PRACTICE, 3), 10)

    def test_singleton_lesson_cheaper_than_five_pack(self):
        self.assertLess(
            block_cost_minutes(BlockType.LESSON, 1),
            block_cost_minutes(BlockType.LESSON, 5),
        )

    def test_pulse_is_about_four_minutes(self):
        self.assertLessEqual(block_cost_minutes(BlockType.PULSE, 2), 5)
        self.assertLessEqual(block_cost_minutes(BlockType.PULSE, PULSE_BEAT_MAX_ITEMS), 6)


class TestMergeUp(unittest.TestCase):
    def test_singletons_from_different_skills_combine(self):
        candidates = [
            _cand("A1", skill="Skill One"),
            _cand("B1", skill="Skill Two"),
            _cand("C1", skill="Skill Three"),
        ]
        blocks = LessonGroupService.group_subskills_into_blocks(candidates)
        self.assertEqual(len(blocks), 1)
        self.assertEqual(len(blocks[0].subskills), 3)
        # Cross-skill merge falls back to the unit for its title key
        self.assertEqual(blocks[0].unit_title, "Unit A")

    def test_singleton_merges_into_sibling_group_with_room(self):
        candidates = [
            _cand("A1", skill="Skill One"),
            _cand("A2", skill="Skill One"),
            _cand("A3", skill="Skill One"),
            _cand("B1", skill="Skill Two"),
        ]
        blocks = LessonGroupService.group_subskills_into_blocks(candidates)
        self.assertEqual(len(blocks), 1)
        self.assertEqual(len(blocks[0].subskills), 4)

    def test_no_merge_across_units(self):
        candidates = [
            _cand("A1", unit="Unit A"),
            _cand("B1", unit="Unit B", skill="Skill Two"),
        ]
        blocks = LessonGroupService.group_subskills_into_blocks(candidates)
        self.assertEqual(len(blocks), 2)

    def test_genuine_singleton_survives(self):
        blocks = LessonGroupService.group_subskills_into_blocks([_cand("A1")])
        self.assertEqual(len(blocks), 1)
        self.assertEqual(len(blocks[0].subskills), 1)

    def test_max_group_size_respected(self):
        candidates = [_cand(f"A{i}", skill=f"Skill {i}") for i in range(7)]
        blocks = LessonGroupService.group_subskills_into_blocks(candidates)
        for b in blocks:
            self.assertLessEqual(len(b.subskills), MAX_GROUP_SIZE)
        # 7 singletons should pool into 2 blocks, not 7
        self.assertEqual(len(blocks), 2)

    def test_oversized_group_chunks_evenly(self):
        candidates = [_cand(f"A{i}") for i in range(7)]  # same skill
        blocks = LessonGroupService.group_subskills_into_blocks(candidates)
        sizes = sorted(len(b.subskills) for b in blocks)
        self.assertEqual(sizes, [3, 4])  # not 2+5

    def test_review_at_any_gate_is_practice_not_retest(self):
        # Retests are retired (C15): a review is practice whatever the gate
        blocks = LessonGroupService.group_subskills_into_blocks(
            [_cand("R1", ctype="review", gate=2, days_overdue=3)])
        self.assertEqual([b.type for b in blocks], [BlockType.PRACTICE])
        self.assertEqual(blocks[0].subskills[0].status, "review")


class TestPulseBeat(unittest.TestCase):
    def test_split_diverts_confirms_only(self):
        candidates = [
            _cand("R1", ctype="review", gate=2, days_overdue=1),
            _cand("C1", selection_kind="confirm"),
            _cand("L1", selection_kind="learn"),
            _cand("N1"),
        ]
        pulse, rest = LessonGroupService.split_pulse_candidates(candidates)
        # retests are retired (C15): a due review is no longer measurement
        self.assertEqual([p["skill_id"] for p in pulse], ["C1"])
        self.assertEqual({r["skill_id"] for r in rest}, {"R1", "L1", "N1"})

    def test_confirm_overflow_is_deferred_not_taught(self):
        candidates = [_cand(f"C{i}", selection_kind="confirm") for i in range(PULSE_BEAT_MAX_ITEMS + 1)]
        candidates.append(_cand("L1", selection_kind="learn"))
        pulse, rest = LessonGroupService.split_pulse_candidates(candidates)
        self.assertEqual(len(pulse), PULSE_BEAT_MAX_ITEMS)
        # a confirm never becomes a "New Lesson" block
        self.assertEqual([r["skill_id"] for r in rest], ["L1"])

    def test_learn_targets_never_diverted(self):
        candidates = [_cand("L1", selection_kind="learn"), _cand("L2", selection_kind="learn")]
        pulse, rest = LessonGroupService.split_pulse_candidates(candidates)
        self.assertEqual(pulse, [])
        self.assertEqual(len(rest), 2)

    def test_pulse_block_shape(self):
        items = [
            _cand("R1", subject="Math", ctype="review", gate=2, days_overdue=4),
            _cand("C1", subject="Math", selection_kind="confirm"),
            _cand("C2", subject="Science", selection_kind="confirm"),
        ]
        block = LessonGroupService.build_pulse_block(items)
        self.assertEqual(block.type, BlockType.PULSE)
        self.assertEqual(block.subject, "Math")  # majority subject
        self.assertEqual(len(block.subskills), 3)
        # Per-subskill subject carried for cross-subject evidence reads
        self.assertEqual(block.subskills[2].subject, "Science")
        self.assertLessEqual(block.estimated_minutes, 6)
        self.assertGreater(block.priority_score, 2000)

    def test_pulse_block_ships_first_in_session_plan(self):
        candidates = [_cand(f"A{i}") for i in range(4)]
        teaching_blocks = LessonGroupService.group_subskills_into_blocks(candidates)
        pulse = LessonGroupService.build_pulse_block(
            [_cand("R1", ctype="review", gate=2, days_overdue=1)]
        )
        plan = LessonGroupService.build_session_plan(
            student_id=1,
            candidate_blocks=teaching_blocks + [pulse],
        )
        self.assertGreaterEqual(len(plan.blocks), 2)
        self.assertEqual(plan.blocks[0].type, BlockType.PULSE)
        self.assertEqual(plan.blocks[0].block_index, 1)


class TestSubjectShares(unittest.TestCase):
    def test_share_smaller_than_one_block_still_gets_one(self):
        # 1004 on 10-17: math's 7.1m share vs a 9m lesson left math out and
        # the release pass gave the minutes to a second reading lesson.
        la = LessonGroupService.group_subskills_into_blocks(
            [_cand("LA1", subject="LANGUAGE_ARTS", unit="U1", skill="S1"),
             _cand("LA2", subject="LANGUAGE_ARTS", unit="U2", skill="S2")])
        math = LessonGroupService.group_subskills_into_blocks(
            [_cand("M1", subject="MATHEMATICS", unit="U3", skill="S3")])
        math_minutes = math[0].estimated_minutes
        plan = LessonGroupService.build_session_plan(
            student_id=1,
            candidate_blocks=la + math,
            budget_minutes=sum(b.estimated_minutes for b in la),
            subject_budgets={"LANGUAGE_ARTS": la[0].estimated_minutes + 1,
                             "MATHEMATICS": math_minutes - 2},
        )
        self.assertIn("MATHEMATICS", {b.subject for b in plan.blocks})


if __name__ == "__main__":
    unittest.main()
