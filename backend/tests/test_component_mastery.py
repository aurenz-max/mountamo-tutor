"""Component mastery: cleaning a submission's rows and the replay that rebuilds the tallies."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

from app.services.component_mastery import clean_component_evidence, tally_by_kind


def test_valid_rows_pass_and_duplicates_add():
    rows = clean_component_evidence([
        {"kind": "letter_sound", "id": "sh/SH", "attempts": 3, "correct": 2},
        {"kind": "letter_sound", "id": "sh/SH", "attempts": 1, "correct": 1},
        {"kind": "letter_sound", "id": "x/K S", "attempts": 1, "correct": 0},
    ])
    assert rows == [
        {"kind": "letter_sound", "id": "sh/SH", "attempts": 4, "correct": 3},
        {"kind": "letter_sound", "id": "x/K S", "attempts": 1, "correct": 0},
    ]


def test_bad_rows_are_dropped():
    bad = [
        None, "x", {"kind": "Letter", "id": "a", "attempts": 1, "correct": 1},
        {"kind": "letter_sound", "id": "", "attempts": 1, "correct": 1},
        {"kind": "letter_sound", "id": "a" * 41, "attempts": 1, "correct": 1},
        {"kind": "letter_sound", "id": "a\n", "attempts": 1, "correct": 1},
        {"kind": "letter_sound", "id": "a", "attempts": 0, "correct": 0},
        {"kind": "letter_sound", "id": "a", "attempts": 2, "correct": 3},
        {"kind": "letter_sound", "id": "a", "attempts": 1.5, "correct": 1},
        {"kind": "letter_sound", "id": "a", "attempts": True, "correct": True},
        {"kind": "letter_sound", "id": "a", "attempts": 5000, "correct": 1},
    ]
    assert clean_component_evidence(bad) == []
    assert clean_component_evidence(None) == []
    assert clean_component_evidence({"kind": "letter_sound"}) == []


def test_tally_by_kind_groups_rows():
    rows = clean_component_evidence([
        {"kind": "letter_sound", "id": "a/AE", "attempts": 2, "correct": 2},
        {"kind": "math_fact", "id": "7x8", "attempts": 1, "correct": 0},
    ])
    assert tally_by_kind(rows) == {
        "letter_sound": {"a/AE": {"attempts": 2, "correct": 2}},
        "math_fact": {"7x8": {"attempts": 1, "correct": 0}},
    }


def test_replay_rebuilds_the_tallies_in_time_order():
    from backfill_component_mastery import rebuild

    docs = rebuild([
        {"timestamp": "2026-11-10T02:00:00", "component_evidence": [{"kind": "letter_sound", "id": "a/AE", "attempts": 1, "correct": 0}]},
        {"timestamp": "2026-11-10T01:00:00", "component_evidence": [{"kind": "letter_sound", "id": "a/AE", "attempts": 2, "correct": 2}]},
        {"timestamp": "2026-11-10T03:00:00"},
    ])
    assert docs == {"letter_sound": {"kind": "letter_sound", "updated_at": "2026-11-10T02:00:00",
                                     "components": {"a/AE": {"attempts": 3, "correct": 2, "last_at": "2026-11-10T02:00:00"}}}}


def test_packet_components_keeps_every_kind_and_drops_bad_rows():
    from app.services.component_mastery import packet_components
    docs = [
        {"kind": "letter_sound", "components": {
            "s/S": {"attempts": 4, "correct": 3, "last_at": "x"},
            "a/AE": {"attempts": 1, "correct": 2},
            "t/T": {"attempts": True, "correct": 0},
            "": {"attempts": 1, "correct": 1}}},
        {"kind": "some_future_kind", "components": {"7x8": {"attempts": 2, "correct": 1}}},
        {"kind": "Bad Kind", "components": {"x": {"attempts": 1, "correct": 1}}},
        {"kind": "empty", "components": {}},
    ]
    assert packet_components(docs) == {"letter_sound": {"s/S": [4, 3]}, "some_future_kind": {"7x8": [2, 1]}}
