"""Generation-server credential: a learner Firebase token alone is insufficient.

Two uses of one server-only key (``LUMINA_GENERATION_SIGNING_KEY``, >= 32 chars,
configured on both services, never ``NEXT_PUBLIC``):

* ``require_generation_server`` guards the one write the generation server still
  makes with authority (retest receipt issuance).
* ``sign_learning_observations`` signs the learner's delivery packet once at lesson
  launch. The packet travels with the generate request and the generation server
  verifies it with the same key, so generation makes no backend call and a client
  cannot forge or edit what it carries.
"""
import hashlib
import hmac
import os
import time

from fastapi import HTTPException, Request

from .config import settings

PACKET_SIGNATURE_PREFIX = "lumina-learning-observations:v1\n"


def generation_signing_key():
    """The shared key, or '' when the boundary is not configured (signed routes 403, packets unsigned)."""
    # Settings reads backend/.env; a process started without the key exported
    # must not silently disable every signed generation route.
    key = os.environ.get("LUMINA_GENERATION_SIGNING_KEY") or settings.LUMINA_GENERATION_SIGNING_KEY
    return key if len(key) >= 32 else ""


def sign_learning_observations(payload_text):
    """HMAC over the exact payload bytes; None when no key is configured (never an unsigned packet)."""
    key = generation_signing_key()
    if not key:
        return None
    return hmac.new(key.encode(), (PACKET_SIGNATURE_PREFIX + payload_text).encode("utf-8"), hashlib.sha256).hexdigest()


async def require_generation_server(request: Request):
    key = generation_signing_key()
    timestamp = request.headers.get("x-lumina-time", "")
    signature = request.headers.get("x-lumina-signature", "")
    try:
        fresh = abs(time.time() - int(timestamp)) <= 60
    except ValueError:
        fresh = False
    if not key or not fresh:
        raise HTTPException(403, "Generation certification unavailable")
    body = await request.body()
    message = (request.url.path + "\n" + timestamp + "\n" + request.headers.get("authorization", "") + "\n").encode() + body
    expected = hmac.new(key.encode(), message, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        raise HTTPException(403, "Invalid generation certification")
