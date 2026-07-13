"""Migrate legacy subskill-keyed misconception docs to declared-scope keys.

Dry-run is the default. Legacy documents do not contain enough information to
infer which primitive observed the failure, so this script never auto-assigns
them. Supply an explicit JSON mapping whose keys are
``student_id/legacy_doc_id`` and whose values contain ``primitive_type``,
``scope`` and, for skill scope, ``skill_id``.
"""

import argparse
import json
import os
import sys
from typing import Any, Dict

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.firestore_service import FirestoreService  # noqa: E402


def load_assignments(path: str | None) -> Dict[str, Dict[str, Any]]:
    if not path:
        return {}
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def run(assignments: Dict[str, Dict[str, Any]], apply: bool) -> Dict[str, int]:
    firestore = FirestoreService()
    counts = {"legacy": 0, "assigned": 0, "ambiguous": 0, "written": 0}
    for student in firestore.client.collection("students").stream():
        collection = student.reference.collection("misconceptions")
        for snapshot in collection.stream():
            data = snapshot.to_dict() or {}
            if data.get("primitive_type") and data.get("scope"):
                continue
            counts["legacy"] += 1
            assignment_key = f"{student.id}/{snapshot.id}"
            assignment = assignments.get(assignment_key)
            if not assignment:
                counts["ambiguous"] += 1
                print(f"AMBIGUOUS {assignment_key} (left untouched)")
                continue
            primitive_type = assignment["primitive_type"]
            scope = assignment["scope"]
            skill_id = assignment.get("skill_id")
            if scope not in ("primitive", "skill") or (scope == "skill" and not skill_id):
                raise ValueError(f"Invalid assignment for {assignment_key}: {assignment}")
            new_key = primitive_type if scope == "primitive" else f"{primitive_type}::{skill_id}"
            migrated = {
                **data,
                "primitive_type": primitive_type,
                "scope": scope,
                "skill_id": skill_id if scope == "skill" else None,
                "misconception_key": new_key,
                "migration_source_key": snapshot.id,
            }
            counts["assigned"] += 1
            print(f"{'WRITE' if apply else 'DRY-RUN'} {assignment_key} -> {student.id}/{new_key}")
            if apply:
                collection.document(new_key).set(migrated)
                if new_key != snapshot.id:
                    snapshot.reference.delete()
                counts["written"] += 1
    return counts


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--assignments", help="Explicit JSON assignment file")
    parser.add_argument("--apply", action="store_true", help="Perform writes; default is dry-run")
    args = parser.parse_args()
    print(json.dumps(run(load_assignments(args.assignments), args.apply), indent=2))
