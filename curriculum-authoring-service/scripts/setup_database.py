#!/usr/bin/env python3
"""
Database setup script for Curriculum Authoring Service
Creates all required BigQuery tables
"""

import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from app.core.config import settings
from app.core.database import db

# Load environment variables
load_dotenv()


def main():
    """Setup database tables"""
    print("=" * 80)
    print("📚 CURRICULUM AUTHORING SERVICE - DATABASE SETUP")
    print("=" * 80)
    print(f"\nProject: {settings.GOOGLE_CLOUD_PROJECT}")
    print(f"Dataset: {settings.BIGQUERY_DATASET_ID}")
    print(f"\nThis will create the following tables:")
    print(f"  - {settings.TABLE_SUBJECTS}")
    print(f"  - {settings.TABLE_UNITS}")
    print(f"  - {settings.TABLE_SKILLS}")
    print(f"  - {settings.TABLE_SUBSKILLS}")
    print(f"  - {settings.TABLE_PREREQUISITES}")
    print(f"  - {settings.TABLE_VERSIONS}")
    print(f"  - {settings.TABLE_PRIMITIVES}")
    print(f"  - {settings.TABLE_SUBSKILL_PRIMITIVES}")
    print("\n" + "=" * 80)

    response = input("\nProceed with table creation? (yes/no): ")

    if response.lower() != "yes":
        print("❌ Setup cancelled")
        return

    try:
        # Initialize BigQuery client
        print("\n🔧 Initializing BigQuery client...")
        db.initialize()

        # Create tables
        print("\n📋 Creating tables...")
        db.setup_all_tables()

        print("\n" + "=" * 80)
        print("✅ DATABASE SETUP COMPLETE")
        print("=" * 80)
        print("\nYour curriculum authoring database is ready to use!")
        print(f"\nNext steps:")
        print(f"  1. Run migration script to import existing curriculum data")
        print(f"  2. Start the service: uvicorn app.main:app --reload --port {settings.SERVICE_PORT}")
        print(f"  3. Access API docs: http://localhost:{settings.SERVICE_PORT}/docs")

    except Exception as e:
        print(f"\n❌ Setup failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
