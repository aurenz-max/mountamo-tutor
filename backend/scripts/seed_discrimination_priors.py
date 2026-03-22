"""
Seed Discrimination Priors — One-time Firestore Migration

Backfills `discrimination_a`, `guessing_c`, `a_source`, and `a_credibility`
on all existing ItemCalibration documents in Firestore.

Usage:
    python -m scripts.seed_discrimination_priors [--dry-run]

This is idempotent — running it again will overwrite values using the
latest categorical priors from discrimination_priors.py.
"""

import argparse
import asyncio
import logging
import sys
from pathlib import Path

# Add backend root to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config.discrimination_priors import get_discrimination_prior

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


async def seed_priors(dry_run: bool = False):
    """Backfill discrimination priors on all existing ItemCalibration docs."""
    # Import here to avoid loading Firebase config at module level
    from app.db.firestore_service import FirestoreService

    fs = FirestoreService()
    logger.info("Connected to Firestore. Scanning item_calibration collection...")

    # Get all item calibration docs
    collection_ref = fs.db.collection("item_calibration")
    docs = collection_ref.stream()

    updated = 0
    skipped = 0
    errors = 0

    async for doc in docs:
        doc_id = doc.id
        data = doc.to_dict()

        primitive_type = data.get("primitive_type", "")
        eval_mode = data.get("eval_mode", "")

        if not primitive_type or not eval_mode:
            logger.warning(f"  SKIP {doc_id}: missing primitive_type or eval_mode")
            skipped += 1
            continue

        prior = get_discrimination_prior(primitive_type, eval_mode)

        update_data = {
            "discrimination_a": prior.a,
            "guessing_c": prior.c,
            "a_source": "categorical_prior",
            "a_credibility": 0.0,
        }

        if dry_run:
            logger.info(
                f"  DRY-RUN {doc_id}: {primitive_type}/{eval_mode} "
                f"-> a={prior.a}, c={prior.c}"
            )
        else:
            try:
                collection_ref.document(doc_id).update(update_data)
                logger.info(
                    f"  UPDATED {doc_id}: a={prior.a}, c={prior.c}"
                )
                updated += 1
            except Exception as e:
                logger.error(f"  ERROR {doc_id}: {e}")
                errors += 1

    logger.info(
        f"\nDone. Updated: {updated}, Skipped: {skipped}, Errors: {errors}"
        + (" (DRY RUN)" if dry_run else "")
    )


def main():
    parser = argparse.ArgumentParser(
        description="Backfill discrimination priors on ItemCalibration docs"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Print what would be updated without writing to Firestore",
    )
    args = parser.parse_args()

    asyncio.run(seed_priors(dry_run=args.dry_run))


if __name__ == "__main__":
    main()
