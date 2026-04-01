"""
SubskillIdResolver — cached lookup layer for curriculum lineage.

Resolves any subskill_id (potentially deprecated) to its current canonical ID.
Used transparently by FirestoreService before every student-data access so that
curriculum iteration never orphans student progress.

Cache strategy: load all curriculum_lineage docs on first access, refresh every
10 minutes or when invalidated by a publish webhook.  The collection is small
(hundreds of docs max), so full-load is fine.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

MAX_CHAIN_DEPTH = 10
CACHE_TTL = timedelta(minutes=10)


class SubskillIdResolver:
    """Resolves deprecated subskill/skill IDs to current canonical IDs."""

    def __init__(self, firestore_client=None):
        self._client = firestore_client
        # old_id → {canonical_id, canonical_ids, operation, level, ...}
        self._cache: Dict[str, dict] = {}
        self._last_refresh: Optional[datetime] = None
        self._lock = asyncio.Lock()

    def set_client(self, firestore_client) -> None:
        """Set or replace the Firestore client (for late init)."""
        self._client = firestore_client

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def resolve(self, subskill_id: str) -> str:
        """Resolve a subskill_id to its canonical ID.

        Returns the ID unchanged if no lineage record exists.
        For splits, returns the first canonical_id (primary target).
        """
        await self._ensure_cache()
        return self._follow_chain(subskill_id, level="subskill")

    async def resolve_skill(self, skill_id: str) -> str:
        """Resolve a skill_id through lineage."""
        await self._ensure_cache()
        return self._follow_chain(skill_id, level="skill")

    async def resolve_multi(self, subskill_id: str) -> List[str]:
        """Resolve to ALL canonical IDs (relevant for splits)."""
        await self._ensure_cache()
        record = self._cache.get(subskill_id)
        if not record:
            return [subskill_id]
        targets = record.get("canonical_ids") or []
        if not targets and record.get("canonical_id"):
            targets = [record["canonical_id"]]
        if not targets:
            return [subskill_id]
        # Recursively resolve each target in case of chained changes
        result = []
        for t in targets:
            result.extend(await self.resolve_multi(t))
        return result

    async def resolve_batch(self, subskill_ids: List[str]) -> Dict[str, str]:
        """Batch-resolve multiple IDs. Returns {input_id: canonical_id}."""
        await self._ensure_cache()
        return {sid: self._follow_chain(sid, level="subskill") for sid in subskill_ids}

    async def get_lineage_record(self, old_id: str) -> Optional[dict]:
        """Get the full lineage record for an old ID (or None)."""
        await self._ensure_cache()
        return self._cache.get(old_id)

    async def has_lineage(self, old_id: str) -> bool:
        """Check whether a lineage record exists for old_id."""
        await self._ensure_cache()
        return old_id in self._cache

    def resolve_sync(self, subskill_id: str) -> str:
        """Synchronous resolve using cached data. Returns unchanged if cache is empty."""
        return self._follow_chain(subskill_id, level="subskill")

    def resolve_skill_sync(self, skill_id: str) -> str:
        """Synchronous skill resolve using cached data."""
        return self._follow_chain(skill_id, level="skill")

    def invalidate_cache(self) -> None:
        """Force cache refresh on next access."""
        self._last_refresh = None

    # ------------------------------------------------------------------
    # Cache management
    # ------------------------------------------------------------------

    async def _ensure_cache(self) -> None:
        """Load or refresh cache if stale or empty."""
        now = datetime.now(timezone.utc)
        if (
            self._last_refresh is not None
            and (now - self._last_refresh) < CACHE_TTL
        ):
            return

        async with self._lock:
            # Double-check after acquiring lock
            if (
                self._last_refresh is not None
                and (now - datetime.now(timezone.utc)) < CACHE_TTL
            ):
                return
            await self._load_cache()

    async def _load_cache(self) -> None:
        """Load all lineage records from Firestore into memory."""
        if not self._client:
            logger.debug("SubskillIdResolver: no Firestore client — cache empty")
            self._cache = {}
            self._last_refresh = datetime.now(timezone.utc)
            return

        try:
            collection = self._client.collection("curriculum_lineage")
            new_cache: Dict[str, dict] = {}
            for doc in collection.stream():
                data = doc.to_dict()
                old_id = data.get("old_id", doc.id)
                new_cache[old_id] = data
            self._cache = new_cache
            self._last_refresh = datetime.now(timezone.utc)
            if new_cache:
                logger.info(f"SubskillIdResolver: loaded {len(new_cache)} lineage records")
        except Exception as e:
            logger.error(f"SubskillIdResolver: failed to load cache: {e}")
            # Keep stale cache rather than clearing it
            if not self._cache:
                self._last_refresh = datetime.now(timezone.utc)

    # ------------------------------------------------------------------
    # Chain resolution
    # ------------------------------------------------------------------

    def _follow_chain(self, id_: str, level: str = "subskill") -> str:
        """Follow lineage chains: A→B→C, max depth MAX_CHAIN_DEPTH."""
        seen = set()
        current = id_
        for _ in range(MAX_CHAIN_DEPTH):
            record = self._cache.get(current)
            if not record:
                return current
            # Skip records for a different level
            if record.get("level", "subskill") != level:
                return current
            canonical_ids = record.get("canonical_ids") or []
            canonical = canonical_ids[0] if canonical_ids else record.get("canonical_id")
            if not canonical:
                # Retired with no successor — return the original
                return current
            if canonical in seen:
                logger.warning(f"SubskillIdResolver: cycle detected at {canonical}")
                return current
            seen.add(current)
            current = canonical
        logger.warning(f"SubskillIdResolver: max chain depth reached for {id_}")
        return current


# ---------------------------------------------------------------------------
# Module-level singleton (initialised at app startup)
# ---------------------------------------------------------------------------

subskill_id_resolver = SubskillIdResolver()
