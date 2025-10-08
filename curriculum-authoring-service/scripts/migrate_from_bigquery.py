#!/usr/bin/env python3
"""
Migration script to import curriculum data from existing BigQuery analytics.curriculum table
into the new Curriculum Authoring Service hierarchical structure
"""

import sys
import os
import uuid
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Set
from collections import defaultdict

# Get project root and change to it
project_root = Path(__file__).parent.parent
os.chdir(project_root)

# Add parent directory to path
sys.path.insert(0, str(project_root))

from dotenv import load_dotenv
from google.cloud import bigquery

# Load environment variables from parent directory
env_path = project_root / ".env"
load_dotenv(env_path)

from app.core.config import settings
from app.core.database import db


class BigQueryMigration:
    """Migrate curriculum from analytics.curriculum to new authoring service structure"""

    def __init__(self):
        self.client = None
        self.stats = {
            "subjects": 0,
            "units": 0,
            "skills": 0,
            "subskills": 0,
            "rows_processed": 0
        }

    def migrate(self):
        """Run complete migration from BigQuery"""
        print("=" * 80)
        print("📚 CURRICULUM MIGRATION - BigQuery analytics.curriculum → Authoring Service")
        print("=" * 80)
        print(f"\nSource table: {settings.GOOGLE_CLOUD_PROJECT}.analytics.curriculum")
        print(f"Target dataset: {settings.GOOGLE_CLOUD_PROJECT}.{settings.BIGQUERY_DATASET_ID}")
        print("\n" + "=" * 80)

        # Initialize database
        print("\n🔧 Initializing database connection...")
        db.initialize()
        self.client = db.client

        # Fetch and process curriculum data
        print("\n📥 Fetching data from analytics.curriculum...")
        curriculum_data = self.fetch_curriculum_data()
        print(f"   Found {len(curriculum_data)} curriculum rows")

        # Transform flat structure to hierarchical
        print("\n🔄 Transforming to hierarchical structure...")
        hierarchical_data = self.transform_to_hierarchical(curriculum_data)

        # Insert into new tables
        print("\n💾 Inserting into authoring service tables...")
        self.insert_hierarchical_data(hierarchical_data)

        # Print summary
        self.print_summary()

    def fetch_curriculum_data(self) -> List[Dict]:
        """Fetch all curriculum data from analytics.curriculum"""
        query = f"""
        SELECT
            subject,
            grade,
            unit_id,
            unit_title,
            skill_id,
            skill_description,
            subskill_id,
            subskill_description,
            difficulty_start,
            difficulty_end,
            target_difficulty
        FROM `{settings.GOOGLE_CLOUD_PROJECT}.analytics.curriculum`
        ORDER BY subject, unit_id, skill_id, subskill_id
        """

        query_job = self.client.query(query)
        results = query_job.result()

        return [dict(row) for row in results]

    def transform_to_hierarchical(self, flat_data: List[Dict]) -> Dict:
        """Transform flat curriculum data into hierarchical structure"""
        subjects = {}
        units = {}
        skills = {}
        subskills = []

        processed_subjects: Set[str] = set()
        processed_units: Set[str] = set()
        processed_skills: Set[str] = set()

        # Track order by first appearance
        unit_orders = defaultdict(lambda: defaultdict(int))  # subject_id -> {unit_id: order}
        skill_orders = defaultdict(lambda: defaultdict(int))  # unit_id -> {skill_id: order}
        subskill_orders = defaultdict(lambda: defaultdict(int))  # skill_id -> {subskill_id: order}

        now = datetime.utcnow().isoformat()

        for idx, row in enumerate(flat_data):
            self.stats["rows_processed"] += 1

            # Extract fields
            subject_name = row['subject']
            grade = row['grade']
            unit_id = row['unit_id']
            unit_title = row['unit_title']
            skill_id = row['skill_id']
            skill_description = row['skill_description']
            subskill_id = row['subskill_id']
            subskill_description = row['subskill_description']
            difficulty_start = row['difficulty_start']
            difficulty_end = row['difficulty_end']
            target_difficulty = row['target_difficulty']

            # Generate subject_id (clean key)
            subject_id = subject_name.upper().replace(" ", "_")

            # Create version_id per subject
            if subject_id not in processed_subjects:
                version_id = str(uuid.uuid4())
                subjects[subject_id] = {
                    "subject_id": subject_id,
                    "subject_name": subject_name,
                    "description": f"{subject_name} curriculum for {grade}",
                    "grade_level": grade,
                    "version_id": version_id,
                    "is_active": True,
                    "is_draft": False,
                    "created_at": now,
                    "updated_at": now,
                    "created_by": "bigquery_migration"
                }
                processed_subjects.add(subject_id)
                self.stats["subjects"] += 1

            version_id = subjects[subject_id]["version_id"]

            # Track unit order
            if unit_id not in unit_orders[subject_id]:
                unit_orders[subject_id][unit_id] = len(unit_orders[subject_id])

            # Create unit (once per unit_id)
            if unit_id not in processed_units:
                units[unit_id] = {
                    "unit_id": unit_id,
                    "subject_id": subject_id,
                    "unit_title": unit_title,
                    "unit_order": unit_orders[subject_id][unit_id],
                    "description": None,
                    "version_id": version_id,
                    "is_draft": False,
                    "created_at": now,
                    "updated_at": now
                }
                processed_units.add(unit_id)
                self.stats["units"] += 1

            # Track skill order
            if skill_id not in skill_orders[unit_id]:
                skill_orders[unit_id][skill_id] = len(skill_orders[unit_id])

            # Create skill (once per skill_id)
            if skill_id not in processed_skills:
                skills[skill_id] = {
                    "skill_id": skill_id,
                    "unit_id": unit_id,
                    "skill_description": skill_description,
                    "skill_order": skill_orders[unit_id][skill_id],
                    "version_id": version_id,
                    "is_draft": False,
                    "created_at": now,
                    "updated_at": now
                }
                processed_skills.add(skill_id)
                self.stats["skills"] += 1

            # Track subskill order
            if subskill_id not in subskill_orders[skill_id]:
                subskill_orders[skill_id][subskill_id] = len(subskill_orders[skill_id])

            # Create subskill (every row)
            subskills.append({
                "subskill_id": subskill_id,
                "skill_id": skill_id,
                "subskill_description": subskill_description,
                "subskill_order": subskill_orders[skill_id][subskill_id],
                "difficulty_start": difficulty_start,
                "difficulty_end": difficulty_end,
                "target_difficulty": target_difficulty,
                "version_id": version_id,
                "is_draft": False,
                "created_at": now,
                "updated_at": now
            })
            self.stats["subskills"] += 1

        # Create version records for each subject
        versions = []
        for subject_id, subject_data in subjects.items():
            versions.append({
                "version_id": subject_data["version_id"],
                "subject_id": subject_id,
                "version_number": 1,
                "description": "Initial migration from analytics.curriculum",
                "is_active": True,
                "created_at": now,
                "activated_at": now,
                "created_by": "bigquery_migration",
                "change_summary": "Migrated from legacy flat curriculum table"
            })

        return {
            "subjects": list(subjects.values()),
            "units": list(units.values()),
            "skills": list(skills.values()),
            "subskills": subskills,
            "versions": versions
        }

    def insert_hierarchical_data(self, data: Dict):
        """Insert hierarchical data into new tables"""

        # Insert subjects
        if data["subjects"]:
            print(f"   📚 Inserting {len(data['subjects'])} subjects...")
            errors = self.client.insert_rows_json(
                settings.get_table_id(settings.TABLE_SUBJECTS),
                data["subjects"]
            )
            if errors:
                print(f"      ❌ Errors: {errors}")
            else:
                print(f"      ✅ Success")

        # Insert versions
        if data["versions"]:
            print(f"   📝 Inserting {len(data['versions'])} versions...")
            errors = self.client.insert_rows_json(
                settings.get_table_id(settings.TABLE_VERSIONS),
                data["versions"]
            )
            if errors:
                print(f"      ❌ Errors: {errors}")
            else:
                print(f"      ✅ Success")

        # Insert units
        if data["units"]:
            print(f"   📖 Inserting {len(data['units'])} units...")
            errors = self.client.insert_rows_json(
                settings.get_table_id(settings.TABLE_UNITS),
                data["units"]
            )
            if errors:
                print(f"      ❌ Errors: {errors}")
            else:
                print(f"      ✅ Success")

        # Insert skills
        if data["skills"]:
            print(f"   🎯 Inserting {len(data['skills'])} skills...")
            errors = self.client.insert_rows_json(
                settings.get_table_id(settings.TABLE_SKILLS),
                data["skills"]
            )
            if errors:
                print(f"      ❌ Errors: {errors}")
            else:
                print(f"      ✅ Success")

        # Insert subskills (may need batching if large)
        if data["subskills"]:
            print(f"   ✏️  Inserting {len(data['subskills'])} subskills...")
            # Batch insert if needed (BigQuery has limits)
            batch_size = 500
            for i in range(0, len(data["subskills"]), batch_size):
                batch = data["subskills"][i:i + batch_size]
                errors = self.client.insert_rows_json(
                    settings.get_table_id(settings.TABLE_SUBSKILLS),
                    batch
                )
                if errors:
                    print(f"      ❌ Batch {i // batch_size + 1} errors: {errors}")
                else:
                    print(f"      ✅ Batch {i // batch_size + 1} ({len(batch)} rows)")

    def print_summary(self):
        """Print migration summary"""
        print("\n" + "=" * 80)
        print("✅ MIGRATION COMPLETE")
        print("=" * 80)
        print(f"\nMigration Statistics:")
        print(f"  📥 Rows processed:  {self.stats['rows_processed']}")
        print(f"  📚 Subjects:        {self.stats['subjects']}")
        print(f"  📖 Units:           {self.stats['units']}")
        print(f"  🎯 Skills:          {self.stats['skills']}")
        print(f"  ✏️  Subskills:       {self.stats['subskills']}")
        print("\n" + "=" * 80)
        print("\n✨ Your curriculum has been successfully migrated!")
        print(f"\nNext steps:")
        print(f"  1. Verify data: http://localhost:{settings.SERVICE_PORT}/api/curriculum/subjects")
        print(f"  2. View API docs: http://localhost:{settings.SERVICE_PORT}/docs")
        print(f"  3. Start the curriculum designer app on port 3001")


def main():
    """Main migration function"""
    print("\n⚠️  WARNING: This will insert data into your curriculum authoring tables.")
    print("   Make sure the tables are empty or you may get duplicate data.\n")

    response = input("Continue with migration? (yes/no): ")
    if response.lower() not in ['yes', 'y']:
        print("Migration cancelled.")
        return

    migration = BigQueryMigration()
    migration.migrate()


if __name__ == "__main__":
    main()
