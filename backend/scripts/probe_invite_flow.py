"""
Runtime probe for the invite-only signup flow (Verification Doctrine: exercise
the real endpoint, not just the types).

Against a RUNNING local backend (default http://localhost:8000), this:
  1. mints a fresh invite (grade 1st) directly in Firestore
  2. GET /api/auth/invite/{code}            → expects valid + grade echoed
  3. POST /api/auth/register WITHOUT a code → expects 403 (invite-only)
  4. POST /api/auth/register WITH the code  → expects 200 (real Firebase user)
  5. GET /api/auth/invite/{code} again      → expects valid=false / redeemed
  6. verifies Firestore: invite doc stamped with uid+student_id, and
     students/{id}.grade_level == the INVITE grade (form sent "K" — the
     invite's "1st" must win)
  7. cleans up: deletes the Firebase user, invite doc, and students/{id} doc

NOTE: register is rate-limited 3/5min per IP — run this at most once per
5 minutes, and the two register calls here are the budget.

Usage (Windows, py311env):
    python scripts/probe_invite_flow.py [--base-url http://localhost:8000] [--keep]
"""

import argparse
import os
import sys
import time

import requests

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.firestore_service import FirestoreService  # noqa: E402
from app.services.invite_service import COLLECTION, InviteService  # noqa: E402

PASS = "PASS"
FAIL = "FAIL"
results = []


def check(name: str, ok: bool, detail: str = ""):
    results.append((name, ok))
    print(f"  [{PASS if ok else FAIL}] {name}" + (f" — {detail}" if detail else ""))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--keep", action="store_true",
                        help="Skip cleanup (leave the test account for manual browser inspection)")
    args = parser.parse_args()
    base = args.base_url.rstrip("/")

    fs = FirestoreService()  # scripts MUST reuse this client (hand-rolled clients 403)
    svc = InviteService(client=fs.client)

    stamp = int(time.time())
    email = f"lumina.invite.probe.{stamp}@example.com"
    password = "ProbeTest123"

    print(f"Probing {base} as {email}")

    # 1. mint
    invite = svc.create_invite(grade_level="1st", student_display_name="Probe Kid",
                               note=f"probe {stamp}", invited_by="probe_invite_flow.py")
    code = invite["code"]
    print(f"  minted {code} (grade 1st)")

    uid = None
    student_id = None
    try:
        # 2. lookup: active
        r = requests.get(f"{base}/api/auth/invite/{code}", timeout=15)
        body = r.json()
        check("lookup active code", r.status_code == 200 and body.get("valid") is True
              and body.get("grade_level") == "1st"
              and body.get("student_display_name") == "Probe Kid", str(body))

        # 3. register WITHOUT code → 403
        r = requests.post(f"{base}/api/auth/register", json={
            "email": f"lumina.nocode.{stamp}@example.com", "password": password,
            "display_name": "No Code", "grade_level": "K",
        }, timeout=30)
        check("register without code rejected", r.status_code == 403, f"{r.status_code} {r.text[:120]}")

        # 4. register WITH code — form says K, invite says 1st; invite must win
        r = requests.post(f"{base}/api/auth/register", json={
            "email": email, "password": password,
            "display_name": "Probe Kid", "grade_level": "K",
            "invite_code": code.lower(),  # case-insensitivity check too
        }, timeout=60)
        ok = r.status_code == 200
        check("register with code succeeds", ok, f"{r.status_code} {r.text[:200]}")
        if ok:
            uid = r.json().get("uid")

        # 5. lookup again: redeemed
        r = requests.get(f"{base}/api/auth/invite/{code}", timeout=15)
        body = r.json()
        check("code shows redeemed after use",
              body.get("valid") is False and body.get("reason") == "redeemed", str(body))

        # 6. Firestore state
        invite_doc = fs.client.collection(COLLECTION).document(code).get().to_dict()
        student_id = invite_doc.get("student_id")
        check("invite stamped with uid + student_id",
              invite_doc.get("redeemed_by_uid") == uid and student_id is not None,
              f"uid={invite_doc.get('redeemed_by_uid')} student_id={student_id}")

        if student_id is not None:
            sdoc = fs.client.collection("students").document(str(student_id)).get().to_dict() or {}
            check("students/{id}.grade_level == invite grade ('1st' beats form 'K')",
                  sdoc.get("grade_level") == "1st", f"grade_level={sdoc.get('grade_level')!r}")

    finally:
        if args.keep:
            print(f"  --keep: leaving {email} / invite {code} / student {student_id} in place")
        else:
            if uid:
                import firebase_admin
                from firebase_admin import auth as fb_auth
                from firebase_admin import credentials as fb_credentials
                from app.core.config import settings
                try:
                    if not firebase_admin._apps:
                        firebase_admin.initialize_app(fb_credentials.Certificate(
                            settings.firebase_admin_credentials_full_path))
                    fb_auth.delete_user(uid)
                    print(f"  cleaned Firebase user {uid}")
                except Exception as e:
                    print(f"  WARN could not delete Firebase user {uid}: {e}")
            fs.client.collection(COLLECTION).document(code).delete()
            if student_id is not None:
                fs.client.collection("students").document(str(student_id)).delete()
            print(f"  cleaned invite doc + students/{student_id} (Cosmos mapping/profile left; harmless)")

    failed = [n for n, ok in results if not ok]
    print()
    print(f"{len(results) - len(failed)}/{len(results)} checks passed")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
