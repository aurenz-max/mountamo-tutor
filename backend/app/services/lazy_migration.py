"""
LazyMigrationService — REMOVED.

The SubskillIdResolver handles correctness by transparently resolving
deprecated IDs at read time. In-place document migration was a cleanup
optimization that added complexity without improving correctness.

If batch cleanup of stale documents is ever needed, write a one-off script.
"""

# Stub kept so existing imports don't break at module level.
# TODO: remove this file entirely once all imports are cleaned up.


class LazyMigrationService:
    """No-op stub — lazy migration removed in favour of resolver-only approach."""
    pass


lazy_migration_service = LazyMigrationService()
