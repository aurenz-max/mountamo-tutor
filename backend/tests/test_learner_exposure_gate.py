"""Exposure gate on the learner model's readout (WORKSTREAMS 7.13)."""

from app.services.learner_model.engine import GraphArrays, exposure_gate


def _graph():
    # K count -> G2 repeated addition -> G3 multiply (R steps); G3 area is a root
    def node(parents=()):
        return {"parents": [{"key": p, "in_model": True, "score": 0.9, "step": 0.9} for p in parents]}
    return GraphArrays.from_nodes("t", {
        "Kindergarten:COUNT": node(),
        "1:ADD": node(["Kindergarten:COUNT"]),
        "2:REPADD": node(["1:ADD"]),
        "3:MULT": node(["2:REPADD"]),
        "3:AREA": node(),
    })


def _ro(pm):
    return {k: [p, 0.9, 0.5] for k, p in pm.items()}


PHI_HIGH = {"Kindergarten:COUNT": 0.97, "1:ADD": 0.9, "2:REPADD": 0.9, "3:MULT": 0.9, "3:AREA": 0.9}


def test_untaught_above_grade_is_not_mastered_and_ready_only_next_grade():
    g = _graph()
    out = exposure_gate(g, _ro(PHI_HIGH), {"Kindergarten:COUNT": {}}, grade=0)
    assert out["Kindergarten:COUNT"][0] == 0.97
    for k in ("1:ADD", "2:REPADD", "3:MULT", "3:AREA"):
        assert out[k][0] == 0.0, k
    assert out["1:ADD"][2] == 0.97          # next grade, prerequisite shown
    assert out["2:REPADD"][2] == 0.0        # two grades up
    assert out["3:AREA"][2] == 0.0          # a root is not ready just for having no prerequisite


def test_shown_far_ahead_lends_mastery_to_its_steps():
    g = _graph()
    pm = dict(PHI_HIGH, **{"3:MULT": 0.92})
    out = exposure_gate(g, _ro(pm), {"3:MULT": {}}, grade=0)
    assert out["3:MULT"][0] == 0.92         # the child's own evidence stands
    assert out["2:REPADD"][0] == 0.92 and out["1:ADD"][0] == 0.92
    assert out["3:AREA"][0] == 0.0


def test_a_missed_step_is_not_overridden():
    g = _graph()
    pm = dict(PHI_HIGH, **{"3:MULT": 0.92, "2:REPADD": 0.2})
    out = exposure_gate(g, _ro(pm), {"3:MULT": {}, "2:REPADD": {}}, grade=0)
    assert out["2:REPADD"][0] == 0.2


def test_idempotent_and_off_without_grade():
    g = _graph()
    ro = _ro(PHI_HIGH)
    once = exposure_gate(g, ro, {"Kindergarten:COUNT": {}}, grade=0)
    assert exposure_gate(g, once, {"Kindergarten:COUNT": {}}, grade=0) == once
    assert exposure_gate(g, ro, {}, grade=None) == ro
