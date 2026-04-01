"""
Migrate Grade 1 subject_ids: drop the _G1 suffix.

Before: curriculum_drafts/1/subjects/MATHEMATICS_G1
After:  curriculum_drafts/1/subjects/MATHEMATICS

The grade is already encoded in the Firestore path — the _G1 suffix
is redundant. This script:
  1. Backs up all affected docs to a JSON file
  2. Copies each doc to the bare subject_id (new doc)
  3. Copies subcollections (edges, suggestions) if any
  4. Updates subject_id field inside the doc
  5. Deletes old _G1 docs after confirmation
  6. Deletes stale flat graph cache docs (will be rebuilt on next publish)

Run: python -m scripts.migrate_g1_subjects [--dry-run] [--execute]
"""

import json
import sys
import datetime
from pathlib import Path

from firebase_admin import credentials, firestore, initialize_app

# --- Config ---
CREDENTIALS_PATH = "credentials/firebase-admin.json"
GRADE = "1"
SUBJECTS_TO_RENAME = {
    "MATHEMATICS_G1": "MATHEMATICS",
    "LANGUAGE_ARTS_G1": "LANGUAGE_ARTS",
    "SCIENCE_G1": "SCIENCE",
    "SOCIAL_STUDIES_G1": "SOCIAL_STUDIES",
}
COLLECTIONS = ["curriculum_drafts", "curriculum_published"]
GRAPH_COLLECTION = "curriculum_graphs"
SUBCOLLECTIONS = ["edges", "suggestions"]


class FirestoreEncoder(json.JSONEncoder):
    def default(self, o):
        if hasattr(o, "isoformat"):
            return o.isoformat()
        if hasattr(o, "__dict__"):
            return str(o)
        return super().default(o)


def init_firestore():
    cred = credentials.Certificate(CREDENTIALS_PATH)
    app = initialize_app(cred, name=f"migrate_{datetime.datetime.now().strftime('%H%M%S')}")
    return firestore.client(app=app)


def backup_docs(db):
    """Backup all affected docs to a JSON file."""
    backup = {}
    for collection in COLLECTIONS + [GRAPH_COLLECTION]:
        backup[collection] = {}
        for old_id in SUBJECTS_TO_RENAME:
            # Main doc
            doc_ref = db.collection(collection).document(GRADE).collection("subjects").document(old_id)
            doc = doc_ref.get()
            if doc.exists:
                backup[collection][old_id] = {"_data": doc.to_dict()}
                # Subcollections
                for sub_name in SUBCOLLECTIONS:
                    sub_docs = list(doc_ref.collection(sub_name).stream())
                    if sub_docs:
                        backup[collection][old_id][sub_name] = {
                            sd.id: sd.to_dict() for sd in sub_docs
                        }
                print(f"  Backed up {collection}/{GRADE}/subjects/{old_id}")
            else:
                print(f"  (not found) {collection}/{GRADE}/subjects/{old_id}")

    # Flat graph cache docs
    backup["flat_graph_cache"] = {}
    for old_id in SUBJECTS_TO_RENAME:
        for suffix in ["_latest_published", "_latest_draft"]:
            cache_doc_id = f"{old_id}{suffix}"
            doc = db.collection(GRAPH_COLLECTION).document(cache_doc_id).get()
            if doc.exists:
                backup["flat_graph_cache"][cache_doc_id] = doc.to_dict()
                print(f"  Backed up flat cache: {cache_doc_id}")

    backup_path = Path(f"backup_g1_migration_{datetime.date.today()}.json")
    with open(backup_path, "w") as f:
        json.dump(backup, f, cls=FirestoreEncoder, indent=2)
    print(f"\nBackup saved to {backup_path}")
    return backup


def migrate(db, dry_run=True):
    """Copy docs from _G1 to bare name, update subject_id field."""
    action = "DRY RUN" if dry_run else "EXECUTING"
    print(f"\n{'='*60}")
    print(f"  {action}: Rename _G1 subject docs")
    print(f"{'='*60}\n")

    for collection in COLLECTIONS:
        print(f"\n--- {collection} ---")
        for old_id, new_id in SUBJECTS_TO_RENAME.items():
            old_ref = db.collection(collection).document(GRADE).collection("subjects").document(old_id)
            new_ref = db.collection(collection).document(GRADE).collection("subjects").document(new_id)

            old_doc = old_ref.get()
            if not old_doc.exists:
                print(f"  SKIP {old_id} — not found")
                continue

            # Check new doc doesn't already exist
            new_doc = new_ref.get()
            if new_doc.exists:
                print(f"  SKIP {old_id} -> {new_id} — target already exists!")
                continue

            data = old_doc.to_dict()

            # Update subject_id in the doc data
            if data.get("subject_id") == old_id:
                data["subject_id"] = new_id
                print(f"  Updated subject_id field: {old_id} -> {new_id}")

            # Also update subject_id in subskill_index keys if present
            if "subskill_index" in data and isinstance(data["subskill_index"], dict):
                # subskill_index values may contain subject_id references
                for ss_id, ss_data in data["subskill_index"].items():
                    if isinstance(ss_data, dict) and ss_data.get("subject_id") == old_id:
                        ss_data["subject_id"] = new_id

            print(f"  {'WOULD COPY' if dry_run else 'COPYING'} {old_id} -> {new_id}")

            if not dry_run:
                new_ref.set(data)

            # Copy subcollections
            for sub_name in SUBCOLLECTIONS:
                sub_docs = list(old_ref.collection(sub_name).stream())
                if sub_docs:
                    print(f"    {sub_name}: {len(sub_docs)} docs")
                    if not dry_run:
                        for sd in sub_docs:
                            new_ref.collection(sub_name).document(sd.id).set(sd.to_dict())

    # Handle curriculum_graphs hierarchical docs
    print(f"\n--- {GRAPH_COLLECTION} (hierarchical) ---")
    for old_id, new_id in SUBJECTS_TO_RENAME.items():
        old_ref = db.collection(GRAPH_COLLECTION).document(GRADE).collection("subjects").document(old_id)
        new_ref = db.collection(GRAPH_COLLECTION).document(GRADE).collection("subjects").document(new_id)

        old_doc = old_ref.get()
        if not old_doc.exists:
            # Check if doc exists without data but has subcollections
            has_subcollections = False
            for sub_name in SUBCOLLECTIONS:
                if list(old_ref.collection(sub_name).limit(1).stream()):
                    has_subcollections = True
                    break

            if not has_subcollections:
                print(f"  SKIP {old_id} — not found")
                continue
            else:
                print(f"  {old_id} — shell doc with subcollections")
                if not dry_run:
                    new_ref.set({"subject_id": new_id})
        else:
            data = old_doc.to_dict()
            if data.get("subject_id") == old_id:
                data["subject_id"] = new_id
            print(f"  {'WOULD COPY' if dry_run else 'COPYING'} {old_id} -> {new_id}")
            if not dry_run:
                new_ref.set(data)

        # Copy edge/suggestion subcollections
        for sub_name in SUBCOLLECTIONS:
            sub_docs = list(old_ref.collection(sub_name).stream())
            if sub_docs:
                print(f"    {sub_name}: {len(sub_docs)} docs")
                if not dry_run:
                    for sd in sub_docs:
                        sd_data = sd.to_dict()
                        # Update any subject_id references in edge data
                        for field in ["source_subject_id", "target_subject_id", "subject_id"]:
                            if sd_data.get(field) == old_id:
                                sd_data[field] = new_id
                        new_ref.collection(sub_name).document(sd.id).set(sd_data)

    print(f"\n{'='*60}")
    if dry_run:
        print("  DRY RUN complete. Re-run with --execute to apply.")
    else:
        print("  Migration complete. Old docs still exist — run cleanup next.")
    print(f"{'='*60}")


def cleanup(db, dry_run=True):
    """Delete old _G1 docs after migration is verified."""
    action = "DRY RUN" if dry_run else "EXECUTING"
    print(f"\n{'='*60}")
    print(f"  {action}: Delete old _G1 docs")
    print(f"{'='*60}\n")

    for collection in COLLECTIONS + [GRAPH_COLLECTION]:
        for old_id in SUBJECTS_TO_RENAME:
            old_ref = db.collection(collection).document(GRADE).collection("subjects").document(old_id)

            # Delete subcollections first
            for sub_name in SUBCOLLECTIONS:
                sub_docs = list(old_ref.collection(sub_name).stream())
                for sd in sub_docs:
                    print(f"  {'WOULD DELETE' if dry_run else 'DELETING'} {collection}/.../subjects/{old_id}/{sub_name}/{sd.id}")
                    if not dry_run:
                        sd.reference.delete()

            old_doc = old_ref.get()
            if old_doc.exists:
                print(f"  {'WOULD DELETE' if dry_run else 'DELETING'} {collection}/{GRADE}/subjects/{old_id}")
                if not dry_run:
                    old_ref.delete()

    # Delete stale flat cache docs
    for old_id in SUBJECTS_TO_RENAME:
        for suffix in ["_latest_published", "_latest_draft"]:
            cache_doc_id = f"{old_id}{suffix}"
            doc_ref = db.collection(GRAPH_COLLECTION).document(cache_doc_id)
            doc = doc_ref.get()
            if doc.exists:
                print(f"  {'WOULD DELETE' if dry_run else 'DELETING'} flat cache: {cache_doc_id}")
                if not dry_run:
                    doc_ref.delete()


if __name__ == "__main__":
    args = set(sys.argv[1:])

    if not args or args == {"--help"}:
        print("Usage:")
        print("  python -m scripts.migrate_g1_subjects --dry-run     Preview changes")
        print("  python -m scripts.migrate_g1_subjects --execute     Apply migration + cleanup")
        sys.exit(0)

    db = init_firestore()

    if "--dry-run" in args:
        print("=== BACKUP ===")
        backup_docs(db)
        print("\n=== MIGRATION (dry run) ===")
        migrate(db, dry_run=True)
        print("\n=== CLEANUP (dry run) ===")
        cleanup(db, dry_run=True)

    elif "--execute" in args:
        print("=== BACKUP ===")
        backup_docs(db)

        confirm = input("\nProceed with migration? (yes/no): ")
        if confirm.lower() != "yes":
            print("Aborted.")
            sys.exit(0)

        print("\n=== MIGRATION ===")
        migrate(db, dry_run=False)

        print("\n=== VERIFYING ===")
        # Quick verify: check new docs exist
        all_good = True
        for collection in COLLECTIONS:
            for old_id, new_id in SUBJECTS_TO_RENAME.items():
                new_ref = db.collection(collection).document(GRADE).collection("subjects").document(new_id)
                if not new_ref.get().exists:
                    print(f"  MISSING: {collection}/{GRADE}/subjects/{new_id}")
                    all_good = False
                else:
                    print(f"  OK: {collection}/{GRADE}/subjects/{new_id}")

        if not all_good:
            print("\nVerification FAILED — skipping cleanup. Check manually.")
            sys.exit(1)

        print("\n=== CLEANUP ===")
        cleanup(db, dry_run=False)
        print("\nDone! Rebuild graph caches by publishing each subject.")
    else:
        print("Unknown args. Use --dry-run or --execute")
