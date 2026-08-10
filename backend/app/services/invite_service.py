# backend/app/services/invite_service.py
"""
Invite-code gate for signup.

Lumina signup is invite-only (settings.INVITE_REQUIRED_FOR_SIGNUP): a code is
minted by the platform owner (scripts/mint_invite.py), sent to a family as a
/login?mode=signup&invite=CODE link, validated at POST /api/auth/register, and
redeemed exactly once. An invite may pre-provision the student's grade — that
grade is authoritative over the signup form, because the inviter knows the
child and the form default ("K") silently wins whenever a parent skips the
dropdown.

Storage is a top-level Firestore collection `invite_codes` keyed by the code
itself. Redemption stamps who used it (uid, email, student_id), which makes
the collection double as the pilot-cohort roster: "which students came from
an invite" is a single collection scan, no joins.
"""

import logging
import random
import string
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple

from google.cloud import firestore

logger = logging.getLogger(__name__)

COLLECTION = "invite_codes"

# Human-transcribable alphabet: no 0/O, 1/I/L, or vowels that spell words.
_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
_CODE_LENGTH = 6
_CODE_PREFIX = "LUMINA"

STATUS_ACTIVE = "active"
STATUS_REDEEMED = "redeemed"
STATUS_REVOKED = "revoked"


def generate_code() -> str:
    body = "".join(random.SystemRandom().choice(_CODE_ALPHABET) for _ in range(_CODE_LENGTH))
    return f"{_CODE_PREFIX}-{body}"


def normalize_code(code: str) -> str:
    return (code or "").strip().upper()


class InviteService:
    """Firestore-backed invite codes. Sync client, same idiom as FirestoreService."""

    def __init__(self, client: Optional[firestore.Client] = None):
        self._client = client

    @property
    def client(self) -> firestore.Client:
        if self._client is None:
            # Lazy import: dependencies.py imports half the app; importing it at
            # module load from a service would cycle.
            from ..dependencies import get_firestore_service

            fs = get_firestore_service()
            if fs is None:
                raise RuntimeError("Firestore service unavailable — invite codes cannot be read")
            self._client = fs.client
        return self._client

    def _doc(self, code: str):
        return self.client.collection(COLLECTION).document(normalize_code(code))

    # ------------------------------------------------------------------
    # Minting
    # ------------------------------------------------------------------

    def create_invite(
        self,
        code: Optional[str] = None,
        grade_level: Optional[str] = None,
        student_display_name: Optional[str] = None,
        note: Optional[str] = None,
        invited_by: Optional[str] = None,
        expires_days: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Mint a new active invite. Fails rather than overwrite an existing code."""
        code = normalize_code(code) if code else generate_code()
        doc_ref = self._doc(code)
        if doc_ref.get().exists:
            raise ValueError(f"Invite code {code} already exists")

        now = datetime.now(timezone.utc)
        data: Dict[str, Any] = {
            "code": code,
            "status": STATUS_ACTIVE,
            "grade_level": grade_level,
            "student_display_name": student_display_name,
            "note": note,
            "invited_by": invited_by,
            "created_at": now.isoformat(),
            "expires_at": (now + timedelta(days=expires_days)).isoformat() if expires_days else None,
            "redeemed_at": None,
            "redeemed_by_uid": None,
            "redeemed_by_email": None,
            "student_id": None,
        }
        doc_ref.set(data)
        logger.info(f"🎟️ Minted invite {code} (grade={grade_level!r}, note={note!r})")
        return data

    # ------------------------------------------------------------------
    # Lookup / validation
    # ------------------------------------------------------------------

    def get_invite(self, code: str) -> Optional[Dict[str, Any]]:
        snap = self._doc(code).get()
        return snap.to_dict() if snap.exists else None

    def validate_invite(self, code: str) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
        """Returns (ok, reason, invite). reason ∈ not_found | redeemed | revoked | expired | ok."""
        invite = self.get_invite(code)
        if invite is None:
            return False, "not_found", None
        if invite.get("status") == STATUS_REDEEMED:
            return False, "redeemed", invite
        if invite.get("status") == STATUS_REVOKED:
            return False, "revoked", invite
        expires_at = invite.get("expires_at")
        if expires_at and datetime.fromisoformat(expires_at) < datetime.now(timezone.utc):
            return False, "expired", invite
        if invite.get("status") != STATUS_ACTIVE:
            return False, "not_found", invite
        return True, "ok", invite

    # ------------------------------------------------------------------
    # Redemption
    # ------------------------------------------------------------------

    def redeem_invite(
        self,
        code: str,
        firebase_uid: str,
        email: str,
        student_id: Optional[int] = None,
    ) -> bool:
        """Flip active → redeemed atomically; loser of a race gets False."""
        doc_ref = self._doc(code)
        transaction = self.client.transaction()

        @firestore.transactional
        def _redeem(txn) -> bool:
            snap = doc_ref.get(transaction=txn)
            if not snap.exists or snap.to_dict().get("status") != STATUS_ACTIVE:
                return False
            txn.update(
                doc_ref,
                {
                    "status": STATUS_REDEEMED,
                    "redeemed_at": datetime.now(timezone.utc).isoformat(),
                    "redeemed_by_uid": firebase_uid,
                    "redeemed_by_email": email,
                    "student_id": student_id,
                },
            )
            return True

        redeemed = _redeem(transaction)
        if redeemed:
            logger.info(f"🎟️ Invite {normalize_code(code)} redeemed by {email} (student {student_id})")
        else:
            logger.warning(f"⚠️ Invite {normalize_code(code)} redemption failed (already used or missing)")
        return redeemed


invite_service = InviteService()
