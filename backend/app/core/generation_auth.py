"""Additional server credential; a learner Firebase token is insufficient."""
import hashlib
import hmac
import os
import time

from fastapi import HTTPException, Request

from .config import settings


async def require_generation_server(request: Request):
    # Settings reads backend/.env; a process started without the key exported
    # must not silently disable every signed generation route.
    key = os.environ.get("LUMINA_GENERATION_SIGNING_KEY") or settings.LUMINA_GENERATION_SIGNING_KEY
    timestamp = request.headers.get("x-lumina-time", "")
    signature = request.headers.get("x-lumina-signature", "")
    try:
        fresh = abs(time.time() - int(timestamp)) <= 60
    except ValueError:
        fresh = False
    if len(key) < 32 or not fresh:
        raise HTTPException(403, "Generation certification unavailable")
    body = await request.body()
    message = (request.url.path + "\n" + timestamp + "\n" + request.headers.get("authorization", "") + "\n").encode() + body
    expected = hmac.new(key.encode(), message, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        raise HTTPException(403, "Invalid generation certification")
