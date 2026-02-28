"""
Seed the school year config document in Firestore.

Usage:
    cd backend
    python -m app.scripts.seed_school_year
"""

import asyncio
import logging
from app.db.firestore_service import FirestoreService
from app.core.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SCHOOL_YEAR_CONFIG = {
    "start_date": "2025-08-25",
    "end_date": "2026-05-29",
    "breaks": [
        {"name": "Thanksgiving", "start": "2025-11-24", "end": "2025-11-28"},
        {"name": "Winter", "start": "2025-12-20", "end": "2026-01-05"},
        {"name": "Spring", "start": "2026-03-16", "end": "2026-03-20"},
    ],
    "school_days_per_week": 5,
}


async def main():
    logger.info("Seeding school year config...")
    fs = FirestoreService(project_id=settings.GCP_PROJECT_ID)
    await fs.set_school_year_config(SCHOOL_YEAR_CONFIG)
    logger.info("Done. Verifying...")

    config = await fs.get_school_year_config()
    logger.info(f"School year config: {config}")


if __name__ == "__main__":
    asyncio.run(main())
