from app.services.learner_graph import LearnerGraph


def _graph() -> LearnerGraph:
    p = lambda key, rel, in_model=True: {"key": key, "relation": rel, "step": 0.9, "easier_form": 0.2,
                                         "fluency": None, "score": 0.9, "in_model": in_model}
    return LearnerGraph(subject="LANGUAGE_ARTS", version="v1", validation={"status": "partial"}, nodes={
        "Kindergarten:LS": {"label": "letter sounds", "parents": []},
        "Kindergarten:PB": {"label": "blend phonemes", "parents": []},
        "1:CVC": {"label": "decode CVC", "parents": [p("Kindergarten:LS", "R"), p("Kindergarten:PB", "R"),
                                                     p("Kindergarten:X", "related", in_model=False)]},
        "1:CVCE": {"label": "silent e", "parents": [p("1:CVC", "E")]},
    })


def test_key_uses_curriculum_grade_keys():
    assert LearnerGraph.key("K", "LS") == "Kindergarten:LS"
    assert LearnerGraph.key("1st", "CVC") == "1:CVC"
    assert LearnerGraph.key("", "CVC") is None


def test_prerequisites_default_to_the_model_set():
    g = _graph()
    assert [p["key"] for p in g.prerequisites("1:CVC")] == ["Kindergarten:LS", "Kindergarten:PB"]
    assert len(g.prerequisites("1:CVC", in_model_only=False)) == 3


def test_unlocks_inverts_prerequisites():
    g = _graph()
    assert [c["key"] for c in g.unlocks("Kindergarten:LS")] == ["1:CVC"]
    assert [c["key"] for c in g.unlocks("1:CVC")] == ["1:CVCE"]
    assert g.unlocks("1:CVCE") == []
