"""
Seed Empirical-a Fields — Firestore Migration for Phase 6.2

Backfills `sum_correct_theta` and `sum_theta_squared` on all existing
ItemCalibration documents. Computes values from existing counters:
  - sum_correct_theta = (total_correct / total_observations) * sum_respondent_theta
  - sum_theta_squared ≈ (sum_respondent_theta / n)^2 * n  (mean approximation)

These are approximations since we don't have per-response θ data.
New submissions will track exact values going forward.

Usage:
    python -m scripts.seed_empirical_a_fields [--dry-run]

Idempotent — safe to re-run.
"""

import argparse
import asyncio
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


async def seed_fields(dry_run: bool = False):
    """Backfill sum_correct_theta and sum_theta_squared on ItemCalibration docs."""
    from app.db.firestore_service import FirestoreService

    fs = FirestoreService()
    logger.info("Connected to Firestore. Scanning item_calibration collection...")

    collection_ref = fs.db.collection("item_calibration")
    docs = collection_ref.stream()

    updated = 0
    skipped = 0
    errors = 0

    async for doc in docs:
        doc_id = doc.id
        data = doc.to_dict()

        n = data.get("total_observations", 0)
        if n == 0:
            logger.info(f"  SKIP {doc_id}: no observations")
            skipped += 1
            continue

        total_correct = data.get("total_correct", 0)
        sum_respondent_theta = data.get("sum_respondent_theta", 0.0)
        mean_theta = sum_respondent_theta / n

        # Approximate: assume correct respondents have similar θ distribution
        # to the overall population (best we can do without per-response data)
        p_correct_rate = total_correct / n if n > 0 else 0.0
        approx_sum_correct_theta = p_correct_rate * sum_respondent_theta

        # Approximate sum of θ²: use mean² × n + variance estimate
        # With only the mean, we assume σ²_θ ≈ 1.0 as a rough prior
        approx_sum_theta_squared = n * (mean_theta ** 2 + 1.0)

        update_data = {
            "sum_correct_theta": round(approx_sum_correct_theta, 4),
            "sum_theta_squared": round(approx_sum_theta_squared, 4),
        }

        if dry_run:
            logger.info(
                f"  DRY-RUN {doc_id}: n={n}, "
                f"sum_correct_theta={update_data['sum_correct_theta']}, "
                f"sum_theta_squared={update_data['sum_theta_squared']}"
            )
        else:
            try:
                collection_ref.document(doc_id).update(update_data)
                logger.info(
                    f"  UPDATED {doc_id}: "
                    f"sum_correct_theta={update_data['sum_correct_theta']}, "
                    f"sum_theta_squared={update_data['sum_theta_squared']}"
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
        description="Backfill sum_correct_theta and sum_theta_squared on ItemCalibration docs"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Print what would be updated without writing to Firestore",
    )
    args = parser.parse_args()
    asyncio.run(seed_fields(dry_run=args.dry_run))


if __name__ == "__main__":
    main()
