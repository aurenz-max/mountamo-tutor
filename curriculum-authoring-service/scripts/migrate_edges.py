#!/usr/bin/env python3
"""
Migration script: curriculum_prerequisites -> curriculum_edges

Copies all existing prerequisite rows into the new curriculum_edges table
with knowledge-graph defaults:
  - relationship = "prerequisite"
  - strength = 1.0
  - is_prerequisite = true
  - authored_by = "human"

Does NOT drop the old table. Both can coexist during transition.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv

load_dotenv()

from app.core.config import settings
from app.core.database import db


def main():
    print("=" * 80)
    print("CURRICULUM EDGES MIGRATION")
    print("=" * 80)
    print(f"\nProject: {settings.GOOGLE_CLOUD_PROJECT}")
    print(f"Dataset: {settings.BIGQUERY_DATASET_ID}")
    print(f"\nSource: {settings.TABLE_PREREQUISITES}")
    print(f"Target: {settings.TABLE_EDGES}")
    print()

    db.initialize()

    # Step 1: Create the edges table if it doesn't exist
    print("Step 1: Ensuring curriculum_edges table exists...")
    db.create_table_if_not_exists(settings.TABLE_EDGES, db.get_edges_schema())

    # Step 2: Check current row counts
    src_table = settings.get_table_id(settings.TABLE_PREREQUISITES)
    dst_table = settings.get_table_id(settings.TABLE_EDGES)

    src_count_q = db.client.query(f"SELECT COUNT(*) AS cnt FROM `{src_table}`")
    src_count = list(src_count_q.result())[0]["cnt"]
    print(f"  Source rows (prerequisites): {src_count}")

    dst_count_q = db.client.query(f"SELECT COUNT(*) AS cnt FROM `{dst_table}`")
    dst_count = list(dst_count_q.result())[0]["cnt"]
    print(f"  Target rows (edges):         {dst_count}")

    if dst_count > 0:
        print(f"\n  Target table already has {dst_count} rows.")
        resp = input("  Proceed anyway? This will INSERT (not replace). (yes/no): ")
        if resp.lower() != "yes":
            print("Cancelled.")
            return

    if src_count == 0:
        print("\n  No prerequisites to migrate. Done.")
        return

    # Step 3: Copy rows with knowledge-graph defaults
    print("\nStep 2: Migrating prerequisites to edges...")
    migrate_query = f"""
    INSERT INTO `{dst_table}` (
        edge_id,
        subject_id,
        source_entity_id,
        source_entity_type,
        target_entity_id,
        target_entity_type,
        relationship,
        strength,
        is_prerequisite,
        min_proficiency_threshold,
        rationale,
        authored_by,
        confidence,
        version_id,
        is_draft,
        created_at,
        updated_at,
        pair_id
    )
    SELECT
        prerequisite_id                    AS edge_id,
        subject_id,
        prerequisite_entity_id             AS source_entity_id,
        prerequisite_entity_type           AS source_entity_type,
        unlocks_entity_id                  AS target_entity_id,
        unlocks_entity_type                AS target_entity_type,
        'prerequisite'                     AS relationship,
        1.0                                AS strength,
        true                               AS is_prerequisite,
        min_proficiency_threshold,
        CAST(NULL AS STRING)               AS rationale,
        'human'                            AS authored_by,
        CAST(NULL AS FLOAT64)              AS confidence,
        version_id,
        is_draft,
        created_at,
        created_at                         AS updated_at,
        CAST(NULL AS STRING)               AS pair_id
    FROM `{src_table}`
    WHERE subject_id IS NOT NULL
    """

    job = db.client.query(migrate_query)
    job.result()  # Wait for completion

    # Step 4: Verify
    dst_count_q2 = db.client.query(f"SELECT COUNT(*) AS cnt FROM `{dst_table}`")
    new_dst_count = list(dst_count_q2.result())[0]["cnt"]
    print(f"\n  Migrated rows: {new_dst_count - dst_count}")
    print(f"  Total edges:   {new_dst_count}")

    if new_dst_count - dst_count == src_count:
        print("\n  Row counts match. Migration successful.")
    else:
        print(f"\n  WARNING: Expected {src_count} new rows, got {new_dst_count - dst_count}.")

    print("\n" + "=" * 80)
    print("MIGRATION COMPLETE")
    print("=" * 80)
    print("\nThe old curriculum_prerequisites table has NOT been dropped.")
    print("Both tables can coexist. The EdgeManager reads from curriculum_edges.")


if __name__ == "__main__":
    main()
