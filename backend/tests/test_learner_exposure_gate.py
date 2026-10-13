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


def test_reach_opens_a_grade_for_each_grade_grown_past():
    """T1 ruling: K + G1 shown -> G2 opens; K alone -> reach stays at G1."""
    import numpy as np
    from types import SimpleNamespace
    from app.services.learner_model.engine import _reach
    g = SimpleNamespace(gi=np.array([0] * 5 + [1] * 5 + [2] * 5 + [3] * 5))
    ev = np.zeros(20)
    assert _reach(g, ev, 0) == (1, [])
    ev[:4] = 0.9                       # 80% of K shown
    assert _reach(g, ev, 0) == (1, [0])
    ev[5:8] = 0.9                      # 60% of G1 shown
    assert _reach(g, ev, 0) == (2, [0, 1])
    ev[10:12] = 0.9                    # 40% of G2: not yet
    assert _reach(g, ev, 0) == (2, [0, 1])


def test_general_ability_alone_does_not_grow_a_grade():
    """A high model P(mastered) on unpractised at-grade skills is not 'shown'."""
    import numpy as np
    from app.services.learner_model.engine import _evidenced
    pm = np.array([0.95, 0.95, 0.95, 0.95])
    seen = np.array([True, False, False, False])
    implied = np.array([0.0, 0.9, 0.0, 0.0])   # skill 1 is an R step of skill 0
    assert list(_evidenced(pm, seen, implied)) == [0.95, 0.9, 0.0, 0.0]


def _chain():
    """count5 <-R- count20 -E-> count10 ; sub100 -R-> sub10 (all K)."""
    from app.services.learner_model.engine import GraphArrays
    P = lambda key, step, easier: {"key": key, "in_model": True, "score": 0.9, "step": step, "easier_form": easier}
    nodes = {
        "Kindergarten:C5": {"grade": "Kindergarten", "skill_id": "C", "parents": []},
        "Kindergarten:C10": {"grade": "Kindergarten", "skill_id": "C", "parents": []},
        "Kindergarten:C20": {"grade": "Kindergarten", "skill_id": "C",
                             "parents": [P("Kindergarten:C5", 0.9, 0.2), P("Kindergarten:C10", 0.3, 0.9)]},
        "Kindergarten:S10": {"grade": "Kindergarten", "skill_id": "S", "parents": []},
        "Kindergarten:S100": {"grade": "Kindergarten", "skill_id": "S", "parents": [P("Kindergarten:S10", 0.9, 0.1)]},
    }
    return GraphArrays.from_nodes("t", nodes)


def test_harder_skill_shows_its_steps_and_easier_forms_not_phi():
    from app.services.learner_model.engine import demonstration
    g = _chain()
    ro = {k: [0.95, 0.9, 0.0] for k in g.keys}            # phi reads everything as mastered
    st = demonstration(g, ro, {"Kindergarten:C20": {}})
    assert st["Kindergarten:C20"]["state"] == "shown" and st["Kindergarten:C20"]["via"] is None
    assert st["Kindergarten:C10"] == {**st["Kindergarten:C10"], "state": "shown", "via": "Kindergarten:C20"}  # easier form
    assert st["Kindergarten:C5"]["state"] == "shown"       # R step
    assert "Kindergarten:S10" not in st and "Kindergarten:S100" not in st   # general ability alone: nothing


def test_retention_flows_down_the_same_edges():
    from app.services.learner_model.engine import demonstration
    g = _chain()
    ro = {k: [0.9, 0.9, 0.0] for k in g.keys}
    lc = {"Kindergarten:S100": {"current_gate": 4}, "Kindergarten:C20": {"current_gate": 2}}
    st = demonstration(g, ro, {"Kindergarten:S100": {}, "Kindergarten:C20": {}, "Kindergarten:C10": {}}, lc)
    assert st["Kindergarten:S10"]["state"] == "mastered" and st["Kindergarten:S10"]["via"] == "Kindergarten:S100"
    assert st["Kindergarten:C10"]["gate"] == 2 and st["Kindergarten:C10"]["own_gate"] is None
    assert "Kindergarten:S100" not in [st[k]["via"] for k in ("Kindergarten:C10", "Kindergarten:C5")]
