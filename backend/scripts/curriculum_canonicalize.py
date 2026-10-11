"""
Canonicalize curriculum graph data in Firestore (2026-10-11 audit, WORKSTREAMS 7.0).

  backup  export curriculum_published, curriculum_drafts, curriculum_graphs (with
          edges), curriculum_lineage, curriculum_edges to JSON
  plan    dry run: print every write/delete and save the plan as JSON
  apply   execute a saved plan (refuses if the plan file is missing)

Fixes in this pass (mechanical; nothing pedagogical):
  A. edges whose source or target is not a node of the same grade's published
     subject (left behind when a curriculum edit removed subskills)
  B. self-loop edges (source == target)
  C. duplicate (source, target) pairs: keep one, preferring a gating edge, then
     a human-authored edge, then the higher strength, then the oldest
  D. ENGINEERING_G5 lives under grade doc "5th Grade" while its edges live under
     "5": copy the published + draft subject docs to "5" (old docs stay until the
     authoring service writes short grade keys)

  venv/Scripts/python scripts/curriculum_canonicalize.py backup
  venv/Scripts/python scripts/curriculum_canonicalize.py plan
  venv/Scripts/python scripts/curriculum_canonicalize.py apply
"""

from __future__ import annotations

import json
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
OUT = ROOT / "reports" / "curriculum-canonicalize-2026-10-11"


def _client():
    from app.db.firestore_service import FirestoreService
    fs = FirestoreService()
    return fs, fs.client


def _jsonable(v):
    if isinstance(v, dict):
        return {k: _jsonable(x) for k, x in v.items()}
    if isinstance(v, list):
        return [_jsonable(x) for x in v]
    if hasattr(v, "isoformat"):
        return v.isoformat()
    return v


def backup() -> None:
    _, c = _client()
    OUT.mkdir(parents=True, exist_ok=True)
    dump = {}
    for coll in ("curriculum_published", "curriculum_drafts", "curriculum_graphs"):
        dump[coll] = {}
        for g in c.collection(coll).list_documents():
            gd = g.get()
            entry = {"fields": _jsonable(gd.to_dict()) if gd.exists else None, "subjects": {}}
            for s in g.collection("subjects").list_documents():
                sd = s.get()
                sub = {"fields": _jsonable(sd.to_dict()) if sd.exists else None}
                if coll == "curriculum_graphs":
                    sub["edges"] = {e.id: _jsonable(e.to_dict()) for e in s.collection("edges").stream()}
                entry["subjects"][s.id] = sub
            dump[coll][g.id] = entry
    for coll in ("curriculum_lineage", "curriculum_edges"):
        dump[coll] = {d.id: _jsonable(d.to_dict()) for d in c.collection(coll).stream()}
    path = OUT / "backup.json"
    path.write_text(json.dumps(dump), encoding="utf-8")
    n_edges = sum(len(s.get("edges", {})) for g in dump["curriculum_graphs"].values() for s in g["subjects"].values())
    print(f"backup: {path} ({path.stat().st_size / 1e6:.1f} MB, {n_edges} edges)")


def plan() -> None:
    fs, c = _client()
    ops = []  # {"op": "delete"|"set", "path": str, "reason": str, "data"?: {...}}
    summary = defaultdict(lambda: defaultdict(int))

    for g in c.collection("curriculum_graphs").list_documents():
        for s in g.collection("subjects").list_documents():
            edges = [(e.id, e.to_dict() or {}) for e in s.collection("edges").stream()]
            if not edges:
                continue
            nodes = fs._read_nodes_from_curriculum(g.id, s.id, "curriculum_published")
            if not nodes and s.id.startswith("ENGINEERING_G5"):
                nodes = fs._read_nodes_from_curriculum("5th Grade", s.id, "curriculum_published")
            node_ids = {n["id"] for n in nodes}
            key = f"{g.id}/{s.id}"
            if not node_ids:
                summary[key]["SKIPPED: no published nodes found"] += 1
                continue
            live = []
            for eid, e in edges:
                path = f"curriculum_graphs/{g.id}/subjects/{s.id}/edges/{eid}"
                src, tgt = e.get("source_entity_id"), e.get("target_entity_id")
                if src not in node_ids or tgt not in node_ids:
                    ops.append({"op": "delete", "path": path, "reason": f"A dead edge {src} -> {tgt}"})
                    summary[key]["A dead"] += 1
                elif src == tgt:
                    ops.append({"op": "delete", "path": path, "reason": f"B self-loop {src}"})
                    summary[key]["B self-loop"] += 1
                else:
                    live.append((eid, e))
            by_pair = defaultdict(list)
            for eid, e in live:
                by_pair[(e["source_entity_id"], e["target_entity_id"])].append((eid, e))
            for (src, tgt), group in by_pair.items():
                if len(group) < 2:
                    continue
                group.sort(key=lambda x: (
                    not x[1].get("is_prerequisite"),
                    x[1].get("authored_by") != "human",
                    -(x[1].get("strength") or 0),
                    str(x[1].get("created_at") or ""),
                ))
                keep = group[0]
                for eid, e in group[1:]:
                    ops.append({"op": "delete",
                                "path": f"curriculum_graphs/{g.id}/subjects/{s.id}/edges/{eid}",
                                "reason": f"C duplicate {src} -> {tgt} ({e.get('relationship')}); keeping {keep[1].get('relationship')}"})
                    summary[key]["C duplicate"] += 1

    # D. ENGINEERING_G5 -> grade doc "5"
    for coll in ("curriculum_published", "curriculum_drafts"):
        src = c.collection(coll).document("5th Grade").collection("subjects").document("ENGINEERING_G5").get()
        dst = c.collection(coll).document("5").collection("subjects").document("ENGINEERING_G5").get()
        if src.exists and not dst.exists:
            ops.append({"op": "set", "path": f"{coll}/5/subjects/ENGINEERING_G5",
                        "reason": "D copy ENGINEERING_G5 from '5th Grade' to '5' (edges live under '5')",
                        "from": f"{coll}/5th Grade/subjects/ENGINEERING_G5"})
            summary[f"{coll}/5"]["D copy ENGINEERING_G5"] += 1

    # E. long-form draft buckets ("1st Grade" ...) twin the short ones; the
    #    authoring service now reads and writes only grade_doc_key ("1"). The
    #    long-form copy is the newer one (parent summaries, 10-08) and the short
    #    copy can hold unit workflow fields the long one lacks (G5 status,
    #    preview_id), so write their DEEP UNION to the short key, then delete
    #    the long-form doc. A key present in both with different values aborts.
    def _union(short, long_, path=""):
        if isinstance(short, dict) and isinstance(long_, dict):
            out = dict(short)
            for k, v in long_.items():
                out[k] = _union(short[k], v, f"{path}.{k}") if k in short else v
            return out
        if isinstance(short, list) and isinstance(long_, list):
            if len(short) != len(long_):
                raise ValueError(f"list length differs at {path}")
            return [_union(x, y, f"{path}[{i}]") for i, (x, y) in enumerate(zip(short, long_))]
        if short != long_ and path not in (".updated_at", ".grade"):
            raise ValueError(f"value differs at {path}: {short!r} vs {long_!r}")
        return short

    for g in c.collection("curriculum_drafts").list_documents():
        if not g.id.endswith(" Grade"):
            continue
        short_key = g.id.split(maxsplit=1)[0].rstrip("stndrh")
        for s in g.collection("subjects").list_documents():
            long_doc = _jsonable(s.get().to_dict() or {})
            twin = c.collection("curriculum_drafts").document(short_key).collection("subjects").document(s.id).get()
            long_path = f"curriculum_drafts/{g.id}/subjects/{s.id}"
            short_path = f"curriculum_drafts/{short_key}/subjects/{s.id}"
            if twin.exists:
                try:
                    merged = _union(_jsonable(twin.to_dict()), long_doc)
                except ValueError as e:
                    summary[f"curriculum_drafts/{g.id}"][f"E SKIP {s.id}: {e}"] += 1
                    continue
                merged["grade"] = short_key
                ops.append({"op": "set", "path": short_path, "data": merged,
                            "reason": f"E union of {long_path} into {short_path}"})
            elif not any(o.get("path") == short_path for o in ops):
                summary[f"curriculum_drafts/{g.id}"][f"E SKIP {s.id}: no short twin and no copy planned"] += 1
                continue
            ops.append({"op": "delete", "path": long_path, "reason": f"E long-form twin of {short_path}"})
            summary[f"curriculum_drafts/{g.id}"]["E union+delete"] += 1

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "plan.json").write_text(json.dumps(ops, indent=1), encoding="utf-8")
    print(f"plan: {len(ops)} operations -> {OUT / 'plan.json'}")
    for key in sorted(summary):
        print(f"  {key}: " + ", ".join(f"{k} {v}" for k, v in sorted(summary[key].items())))


def apply() -> None:
    _, c = _client()
    path = OUT / "plan.json"
    if not path.exists() or not (OUT / "backup.json").exists():
        sys.exit("apply needs both backup.json and plan.json from this script")
    ops = json.loads(path.read_text(encoding="utf-8"))
    batch, n = c.batch(), 0
    for op in ops:
        ref = c.document(op["path"])
        if op["op"] == "delete":
            batch.delete(ref)
        else:
            data = op.get("data") or c.document(op["from"]).get().to_dict()
            data = {**data, "canonicalized_at": datetime.now(timezone.utc).isoformat(),
                    "canonicalized_from": op.get("from") or op["reason"]}
            batch.set(ref, data)
        n += 1
        if n % 400 == 0:
            batch.commit()
            batch = c.batch()
    batch.commit()
    log = OUT / "applied.json"
    log.write_text(json.dumps({"at": datetime.now(timezone.utc).isoformat(), "ops": len(ops)}), encoding="utf-8")
    print(f"applied {n} operations; log {log}")


if __name__ == "__main__":
    {"backup": backup, "plan": plan, "apply": apply}[sys.argv[1]]()
