"""
Mint an invite code for Lumina's invite-only signup.

Signup (POST /api/auth/register) requires a valid code while
INVITE_REQUIRED_FOR_SIGNUP is on. A code minted with --grade pre-provisions
the student's grade of record: it overrides the signup form's dropdown and is
written through to students/{id}.grade_level, so the planner serves the right
curriculum from lesson one. --name prefills the child's name on the form.

Usage (Windows, py311env):
    python scripts/mint_invite.py --grade K --name "Ava" --note "pilot: friend's daughter"
    python scripts/mint_invite.py --list          # show all codes + redemption status
    python scripts/mint_invite.py --revoke CODE   # kill an unsent/leaked code
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.firestore_service import FirestoreService  # noqa: E402
from app.services.invite_service import (  # noqa: E402
    COLLECTION,
    STATUS_REVOKED,
    InviteService,
    normalize_code,
)

APP_BASE_URL = os.getenv("LUMINA_APP_URL", "http://localhost:3000")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--grade", type=str, default=None,
                        help='Pre-provision the student grade, e.g. "K", "1st" (authoritative over the signup form)')
    parser.add_argument("--name", type=str, default=None,
                        help="Child's name — prefills the signup form greeting")
    parser.add_argument("--note", type=str, default=None,
                        help='Who this is for, e.g. "pilot: friend\'s daughter"')
    parser.add_argument("--code", type=str, default=None,
                        help="Custom code instead of a generated one")
    parser.add_argument("--expires-days", type=int, default=None,
                        help="Days until the code expires (default: never)")
    parser.add_argument("--list", action="store_true", help="List all invite codes")
    parser.add_argument("--revoke", type=str, default=None, help="Revoke a code")
    args = parser.parse_args()

    fs = FirestoreService()  # scripts MUST reuse this client (hand-rolled clients 403)
    svc = InviteService(client=fs.client)

    if args.list:
        docs = list(fs.client.collection(COLLECTION).stream())
        if not docs:
            print("No invite codes minted yet.")
            return
        for doc in sorted(docs, key=lambda d: d.to_dict().get("created_at") or ""):
            d = doc.to_dict()
            line = f"{d['code']:>16}  {d['status']:<9} grade={d.get('grade_level') or '-':<4}"
            if d.get("status") == "redeemed":
                line += f" → {d.get('redeemed_by_email')} (student {d.get('student_id')}) at {d.get('redeemed_at')}"
            elif d.get("note"):
                line += f"  ({d['note']})"
            print(line)
        return

    if args.revoke:
        code = normalize_code(args.revoke)
        doc_ref = fs.client.collection(COLLECTION).document(code)
        if not doc_ref.get().exists:
            print(f"Code {code} not found.")
            sys.exit(1)
        doc_ref.update({"status": STATUS_REVOKED})
        print(f"Code {code} revoked.")
        return

    invite = svc.create_invite(
        code=args.code,
        grade_level=args.grade,
        student_display_name=args.name,
        note=args.note,
        invited_by="mint_invite.py",
        expires_days=args.expires_days,
    )

    print(f"Invite code : {invite['code']}")
    print(f"Grade       : {invite['grade_level'] or '(parent picks on the form)'}")
    print(f"Student     : {invite['student_display_name'] or '(not set)'}")
    print(f"Expires     : {invite['expires_at'] or 'never'}")
    print()
    print("Send this link:")
    print(f"  {APP_BASE_URL}/login?mode=signup&invite={invite['code']}")


if __name__ == "__main__":
    main()
