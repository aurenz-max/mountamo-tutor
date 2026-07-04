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
        self.assertEqual(block_cost_minutes(BlockType.RETEST, 1), 5)

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

    def test_retests_never_merge_with_teaching(self):
        candidates = [
            _cand("A1", skill="Skill One"),
            _cand("R1", skill="Skill Two", ctype="review", gate=2, days_overdue=3),
        ]
        blocks = LessonGroupService.group_subskills_into_blocks(candidates)
        self.assertEqual(len(blocks), 2)
        types = {b.type for b in blocks}
        self.assertIn(BlockType.RETEST, types)
        self.assertIn(BlockType.LESSON, types)


class TestPulseBeat(unittest.TestCase):
    def test_split_diverts_retests_then_confirms(self):
        candidates = [
            _cand("R1", ctype="review", gate=2, days_overdue=1),
            _cand("R2", ctype="review", gate=1, days_overdue=9),
            _cand("C1", selection_kind="confirm"),
            _cand("L1", selection_kind="learn"),
            _cand("N1"),
        ]
        pulse, rest = LessonGroupService.split_pulse_candidates(candidates)
        pulse_ids = [p["skill_id"] for p in pulse]
        # Most overdue retest first, then the other retest, then confirm
        self.assertEqual(pulse_ids, ["R2", "R1", "C1"])
        rest_ids = {r["skill_id"] for r in rest}
        self.assertEqual(rest_ids, {"L1", "N1"})

    def test_split_caps_and_overflows(self):
        candidates = [
            _cand(f"R{i}", ctype="review", gate=1, days_overdue=i) for i in range(6)
        ]
        pulse, rest = LessonGroupService.split_pulse_candidates(candidates)
        self.assertEqual(len(pulse), PULSE_BEAT_MAX_ITEMS)
        self.assertEqual(len(rest), 2)

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


if __name__ == "__main__":
    unittest.main()
