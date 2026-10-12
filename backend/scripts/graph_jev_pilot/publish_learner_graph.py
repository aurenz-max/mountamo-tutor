"""
Publish the Jev prerequisite graph to Firestore as the learner graph.

One graph per subject spanning grades (user ruling 10-11). Its own collection:
it never touches curriculum_published, curriculum_graphs or the typed edges
Pulse uses for variety.

  learner_graphs/{SUBJECT}                      {active_version, updated_at}
  learner_graphs/{SUBJECT}/versions/{vid}       method, params, counts, validation
  learner_graphs/{SUBJECT}/versions/{vid}/nodes/{grade}:{subskill_id}
      grade ("Kindergarten" | "1".."12"), subskill_id, skill_id, unit_id, label,
      parents: [{key, relation R|E|related, step, easier_form, fluency, score, in_model}]

Node keys carry the grade because bare subskill ids repeat across grades.
`parents` holds every scored prerequisite above 0.6 that survives the DAG
rule (strongest first, skip an edge that closes a cycle); `in_model` marks the
top 3 the learner model uses. relation: R = Jev step >= 0.8 (performed inside
the subskill), E = easier_form >= 0.6 and not R (an easier version learned
first), related = neither alone. Activation is the last write, so a version is
either fully written or not active; rollback = point active_version back.

  venv/Scripts/python -m scripts.graph_jev_pilot.publish_learner_graph plan  [--subjects ...]
  venv/Scripts/python -m scripts.graph_jev_pilot.publish_learner_graph apply [--subjects ...]
  venv/Scripts/python -m scripts.graph_jev_pilot.publish_learner_graph verify
"""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from scripts.learner_model_lab.graph import SCOPE, load

from .run_pilot import OUT, WINDOW

COLLECTION = "learner_graphs"
PLAN_DIR = OUT / "publish"
MIN_SCORE, MAX_PARENTS, STEP_R, EASIER_E = 0.6, 3, 0.8, 0.6
GRADE_KEY = {"GK": "Kindergarten", **{f"G{i}": str(i) for i in range(1, 13)}}

# Hand-labelled checks so far (scripts/graph_jev_pilot/validate.py). A
# consumer reads this before trusting a subject's graph.
VALIDATION = {
    "LANGUAGE_ARTS": {"status": "partial", "sheet": "user_literacy_pairs.json", "pairs": 22, "auc": 0.92,
                      "accuracy": 0.86, "covers": "Kindergarten-1"},
    "MATHEMATICS": {"status": "pending", "sheet": "user_math_g3g5_pairs.json", "pairs": 30, "auc": None,
                    "covers": "3-5", "note": "awaiting user labels; K-2 checked against author gold pairs (AUC 1.00)"},
    "SCIENCE": {"status": "unvalidated"},
    "SOCIAL_STUDIES": {"status": "unvalidated"},
}


def _key(g, k: int) -> str:
    nd = g.nodes[k]
    return f"{GRADE_KEY[nd.grade]}:{nd.sid}"


def _relation(step: float, easier: float) -> str:
    if step >= STEP_R:
        return "R"
    if easier >= EASIER_E:
        return "E"
    return "related"


def build(subject: str) -> dict:
    g = load(subject, min_score=MIN_SCORE, max_parents=MAX_PARENTS)
    jev = json.loads((OUT / "jev_answers.json").read_text(encoding="utf-8"))
    flu = {}
    for v in jev.values():
        if v.get("subject") == subject and "fluency" in v:
            flu[(f"{v['source_grade']}:{v['source']}", f"{v['target_grade']}:{v['target']}")] = v["fluency"]
    nodes = {}
    n_edges = n_model = n_cross = 0
    for k, nd in enumerate(g.nodes):
        model = set(g.parents[k])
        parents = []
        for p, s in sorted(zip(g.truth_parents[k], g.truth_scores[k]), key=lambda x: -x[1]):
            step, easier = g.step.get((p, k), 0.0), g.easier.get((p, k), 0.0)
            parents.append({"key": _key(g, p), "relation": _relation(step, easier), "step": round(step, 3),
                            "easier_form": round(easier, 3),
                            "fluency": flu.get((g.nodes[p].key, nd.key)),
                            "score": round(s, 3), "in_model": p in model})
            n_edges += 1
            n_model += p in model
            n_cross += g.nodes[p].grade != nd.grade
        nodes[_key(g, k)] = {"grade": GRADE_KEY[nd.grade], "subskill_id": nd.sid,
                             "skill_id": nd.skill.split(":", 1)[1], "unit_id": nd.unit.split(":", 1)[1],
                             "label": nd.label.split("\n")[0].strip(), "parents": parents}
    body = json.dumps(nodes, sort_keys=True)
    vid = f"jev-{datetime.now(timezone.utc):%Y%m%d}-{hashlib.sha1(body.encode()).hexdigest()[:8]}"
    meta = {"created_at": datetime.now(timezone.utc).isoformat(), "subject": subject,
            "grades": [GRADE_KEY[x] for x in SCOPE[subject]],
            "method": {"model": "TypeSafe jev-latest", "questions": ["step", "easier_form", "fluency"],
                       "candidate_window_grades": WINDOW, "min_score": MIN_SCORE, "max_parents_in_model": MAX_PARENTS,
                       "relation_R_step_min": STEP_R, "relation_E_easier_min": EASIER_E,
                       "source": str((OUT / "jev_answers.json").relative_to(OUT.parents[2]))},
            "counts": {"nodes": len(nodes), "edges": n_edges, "in_model_edges": n_model, "cross_grade_edges": n_cross},
            "validation": VALIDATION.get(subject, {"status": "unvalidated"})}
    return {"version_id": vid, "meta": meta, "nodes": nodes}


def plan(subjects) -> None:
    PLAN_DIR.mkdir(parents=True, exist_ok=True)
    for s in subjects:
        b = build(s)
        (PLAN_DIR / f"{s}.json").write_text(json.dumps(b, indent=1), encoding="utf-8")
        c = b["meta"]["counts"]
        print(f"{s}: version {b['version_id']}  nodes {c['nodes']}  edges {c['edges']} "
              f"(in model {c['in_model_edges']}, cross-grade {c['cross_grade_edges']})  validation {b['meta']['validation']['status']}")
    print(f"plan written to {PLAN_DIR}; nothing sent to Firestore")


def _client():
    from app.db.firestore_service import FirestoreService
    return FirestoreService().client


def apply(subjects) -> None:
    c = _client()
    for s in subjects:
        path = PLAN_DIR / f"{s}.json"
        if not path.exists():
            raise SystemExit(f"no plan for {s}; run `plan` first")
        b = json.loads(path.read_text(encoding="utf-8"))
        root = c.collection(COLLECTION).document(s)
        prev = (root.get().to_dict() or {}).get("active_version")
        vref = root.collection("versions").document(b["version_id"])
        vref.set({**b["meta"], "previous_version": prev})
        batch, n = c.batch(), 0
        for key, node in b["nodes"].items():
            batch.set(vref.collection("nodes").document(key), node)
            n += 1
            if n % 400 == 0:
                batch.commit()
                batch = c.batch()
        batch.commit()
        written = sum(1 for _ in vref.collection("nodes").stream())
        if written != len(b["nodes"]):
            raise SystemExit(f"{s}: wrote {written} of {len(b['nodes'])} nodes; NOT activated")
        root.set({"active_version": b["version_id"], "updated_at": datetime.now(timezone.utc).isoformat(),
                  "previous_version": prev}, merge=True)
        print(f"{s}: {written} nodes written, active_version = {b['version_id']} (previous: {prev})")


def verify() -> None:
    import asyncio
    from app.db.firestore_service import FirestoreService
    from app.services.learner_graph import get_learner_graph

    async def go():
        fs = FirestoreService()
        for s in SCOPE:
            lg = await get_learner_graph(fs, s)
            if lg is None:
                print(f"{s}: not published")
                continue
            k = next(iter(lg.nodes))
            print(f"{s}: version {lg.version}  {len(lg.nodes)} nodes  validation {lg.validation.get('status')}  "
                  f"e.g. {k} has {len(lg.prerequisites(k))} model prerequisites")
    asyncio.run(go())


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["plan", "apply", "verify"])
    ap.add_argument("--subjects", nargs="+", default=list(SCOPE))
    a = ap.parse_args()
    {"plan": lambda: plan(a.subjects), "apply": lambda: apply(a.subjects), "verify": verify}[a.cmd]()


if __name__ == "__main__":
    main()
