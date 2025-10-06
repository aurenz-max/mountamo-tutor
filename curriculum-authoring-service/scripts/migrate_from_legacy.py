#!/usr/bin/env python3
"""
Migration script to import curriculum data from legacy CSV and JSON files
into the new Curriculum Authoring Service database
"""

import os
import sys
import csv
import json
import uuid
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from app.core.config import settings
from app.core.database import db

# Load environment variables
load_dotenv()


class LegacyMigration:
    """Migrate curriculum from legacy CSV/JSON to new service"""

    def __init__(self, source_data_dir: str):
        self.source_dir = Path(source_data_dir)
        self.stats = {
            "subjects": 0,
            "units": 0,
            "skills": 0,
            "subskills": 0,
            "prerequisites": 0
        }

    def migrate(self):
        """Run complete migration"""
        print("=" * 80)
        print("📚 CURRICULUM MIGRATION - Legacy to Authoring Service")
        print("=" * 80)
        print(f"\nSource directory: {self.source_dir}")
        print(f"Target dataset: {settings.BIGQUERY_DATASET_ID}")
        print("\n" + "=" * 80)

        # Initialize database
        print("\n🔧 Initializing database connection...")
        db.initialize()

        # Migrate curriculum from CSV files
        print("\n📋 Migrating curriculum from CSV files...")
        self.migrate_curriculum_csv()

        # Migrate prerequisites from JSON decision trees
        print("\n🔗 Migrating prerequisites from decision trees...")
        self.migrate_prerequisites_json()

        # Print summary
        self.print_summary()

    def migrate_curriculum_csv(self):
        """Migrate curriculum from CSV syllabus files"""
        # Find all syllabus CSV files
        csv_files = list(self.source_dir.glob("*syllabus*.csv"))

        print(f"Found {len(csv_files)} syllabus files")

        for csv_file in csv_files:
            print(f"\n  Processing: {csv_file.name}")
            self.process_syllabus_csv(csv_file)

    def process_syllabus_csv(self, csv_file: Path):
        """Process a single syllabus CSV file"""
        # Create initial version
        subject_name = self.extract_subject_from_filename(csv_file.name)
        subject_id = subject_name.upper().replace(" ", "_")
        version_id = str(uuid.uuid4())

        subjects_data = []
        units_data = []
        skills_data = []
        subskills_data = []

        processed_subjects = set()
        processed_units = set()
        processed_skills = set()

        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)

            for row in reader:
                # Extract data
                subject = row.get('Subject', subject_name)
                grade = row.get('Grade', 'Kindergarten')
                unit_id = row.get('UnitID')
                unit_title = row.get('UnitTitle')
                skill_id = row.get('SkillID')
                skill_description = row.get('SkillDescription')
                subskill_id = row.get('SubskillID')
                subskill_description = row.get('SubskillDescription')
                difficulty_start = float(row.get('DifficultyStart', 1))
                difficulty_end = float(row.get('DifficultyEnd', 5))
                target_difficulty = float(row.get('TargetDifficulty', 3))

                # Create subject record (once)
                if subject_id not in processed_subjects:
                    subjects_data.append({
                        "subject_id": subject_id,
                        "subject_name": subject,
                        "description": f"{subject} curriculum",
                        "grade_level": grade,
                        "version_id": version_id,
                        "is_active": True,
                        "is_draft": False,
                        "created_at": datetime.utcnow().isoformat(),
                        "updated_at": datetime.utcnow().isoformat(),
                        "created_by": "migration_script"
                    })
                    processed_subjects.add(subject_id)

                # Create unit record (once per unit)
                if unit_id not in processed_units:
                    units_data.append({
                        "unit_id": unit_id,
                        "subject_id": subject_id,
                        "unit_title": unit_title,
                        "unit_order": None,
                        "description": None,
                        "version_id": version_id,
                        "is_draft": False,
                        "created_at": datetime.utcnow().isoformat(),
                        "updated_at": datetime.utcnow().isoformat()
                    })
                    processed_units.add(unit_id)

                # Create skill record (once per skill)
                if skill_id not in processed_skills:
                    skills_data.append({
                        "skill_id": skill_id,
                        "unit_id": unit_id,
                        "skill_description": skill_description,
                        "skill_order": None,
                        "version_id": version_id,
                        "is_draft": False,
                        "created_at": datetime.utcnow().isoformat(),
                        "updated_at": datetime.utcnow().isoformat()
                    })
                    processed_skills.add(skill_id)

                # Create subskill record
                subskills_data.append({
                    "subskill_id": subskill_id,
                    "skill_id": skill_id,
                    "subskill_description": subskill_description,
                    "subskill_order": None,
                    "difficulty_start": difficulty_start,
                    "difficulty_end": difficulty_end,
                    "target_difficulty": target_difficulty,
                    "version_id": version_id,
                    "is_draft": False,
                    "created_at": datetime.utcnow().isoformat(),
                    "updated_at": datetime.utcnow().isoformat()
                })

        # Insert data
        if subjects_data:
            db.client.insert_rows_json(
                settings.get_table_id(settings.TABLE_SUBJECTS),
                subjects_data
            )
            self.stats["subjects"] += len(subjects_data)

        if units_data:
            db.client.insert_rows_json(
                settings.get_table_id(settings.TABLE_UNITS),
                units_data
            )
            self.stats["units"] += len(units_data)

        if skills_data:
            db.client.insert_rows_json(
                settings.get_table_id(settings.TABLE_SKILLS),
                skills_data
            )
            self.stats["skills"] += len(skills_data)

        if subskills_data:
            db.client.insert_rows_json(
                settings.get_table_id(settings.TABLE_SUBSKILLS),
                subskills_data
            )
            self.stats["subskills"] += len(subskills_data)

        # Create version record
        version_data = [{
            "version_id": version_id,
            "subject_id": subject_id,
            "version_number": 1,
            "description": "Initial migration from legacy system",
            "is_active": True,
            "created_at": datetime.utcnow().isoformat(),
            "activated_at": datetime.utcnow().isoformat(),
            "created_by": "migration_script",
            "change_summary": f"Migrated {len(subskills_data)} subskills"
        }]

        db.client.insert_rows_json(
            settings.get_table_id(settings.TABLE_VERSIONS),
            version_data
        )

        print(f"    ✅ Migrated: {len(units_data)} units, {len(skills_data)} skills, {len(subskills_data)} subskills")

    def migrate_prerequisites_json(self):
        """Migrate prerequisites from decision tree JSON files"""
        # Find decision tree JSON files
        json_files = list(self.source_dir.glob("*decision_tree.json"))

        print(f"Found {len(json_files)} decision tree files")

        for json_file in json_files:
            print(f"\n  Processing: {json_file.name}")
            self.process_decision_tree_json(json_file)

    def process_decision_tree_json(self, json_file: Path):
        """Process a decision tree JSON file"""
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Extract decision tree
        decision_tree = data.get('learning_path_decision_tree', {})

        if not decision_tree:
            print(f"    ⚠️  No decision tree found in {json_file.name}")
            return

        prerequisites_data = []
        version_id = str(uuid.uuid4())  # In reality, would match to subject's version

        for prerequisite_id, unlocks_list in decision_tree.items():
            for unlocks_id in unlocks_list:
                prerequisites_data.append({
                    "prerequisite_id": str(uuid.uuid4()),
                    "prerequisite_entity_id": prerequisite_id,
                    "prerequisite_entity_type": "subskill",  # Assuming subskill
                    "unlocks_entity_id": unlocks_id,
                    "unlocks_entity_type": "subskill",
                    "min_proficiency_threshold": 0.8,
                    "version_id": version_id,
                    "is_draft": False,
                    "created_at": datetime.utcnow().isoformat()
                })

        if prerequisites_data:
            db.client.insert_rows_json(
                settings.get_table_id(settings.TABLE_PREREQUISITES),
                prerequisites_data
            )
            self.stats["prerequisites"] += len(prerequisites_data)

        print(f"    ✅ Migrated {len(prerequisites_data)} prerequisite relationships")

    def extract_subject_from_filename(self, filename: str) -> str:
        """Extract subject name from filename"""
        # Remove common suffixes
        name = filename.replace('-syllabus', '').replace('_syllabus', '') \
                       .replace('-refactored', '').replace('_refactored', '') \
                       .replace('.csv', '').replace('.json', '')

        # Capitalize properly
        return name.replace('-', ' ').replace('_', ' ').title()

    def print_summary(self):
        """Print migration summary"""
        print("\n" + "=" * 80)
        print("✅ MIGRATION COMPLETE")
        print("=" * 80)
        print(f"\nMigration Statistics:")
        print(f"  📚 Subjects:       {self.stats['subjects']}")
        print(f"  📖 Units:          {self.stats['units']}")
        print(f"  🎯 Skills:         {self.stats['skills']}")
        print(f"  ✏️  Subskills:      {self.stats['subskills']}")
        print(f"  🔗 Prerequisites:  {self.stats['prerequisites']}")
        print("\n" + "=" * 80)
        print("\n✨ Your curriculum has been successfully migrated!")
        print(f"\nNext steps:")
        print(f"  1. Start the service: uvicorn app.main:app --reload --port {settings.SERVICE_PORT}")
        print(f"  2. Access the API: http://localhost:{settings.SERVICE_PORT}/docs")
        print(f"  3. Verify the data through the API endpoints")


def main():
    """Main migration function"""
    import argparse

    parser = argparse.ArgumentParser(description='Migrate curriculum from legacy system')
    parser.add_argument(
        '--source',
        default='../backend/data',
        help='Path to legacy data directory (default: ../backend/data)'
    )

    args = parser.parse_args()

    migration = LegacyMigration(args.source)
    migration.migrate()


if __name__ == "__main__":
    main()
