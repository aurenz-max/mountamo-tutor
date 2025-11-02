# backend/app/db/postgresql_db.py
#
# DEPRECATED: PostgreSQL ETL has been replaced by BigQuery.
# This file contains legacy ETL code for migrating data from Cosmos DB to PostgreSQL.
# PostgreSQL dependencies (psycopg2, asyncpg) have been removed from requirements.txt
# This code is kept for reference only and will not function in production.
#

import json
import os
import pandas as pd
import psycopg2  # DEPRECATED: No longer in requirements.txt
from psycopg2.extras import execute_values
import logging
from pathlib import Path
from datetime import datetime
import asyncio
from typing import List, Dict, Any, Optional

# Import from project modules
from ..core.config import settings
from app.db.cosmos_db import CosmosDBService

# Configure logging
import sys
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("postgres_etl.log", encoding='utf-8'),
        logging.StreamHandler(sys.stdout)  # Using stdout instead of stderr
    ]
)

logger = logging.getLogger("postgres_etl")

class PostgreSQLETL:
    """ETL service for transferring data from Cosmos DB to PostgreSQL."""
    
    def __init__(self):
        """Initialize PostgreSQL ETL service using settings from config."""
        self.connection_params = {
            "host": settings.PG_HOST,
            "port": settings.PG_PORT,
            "database": settings.PG_DATABASE,
            "user": settings.PG_USER,
            "password": settings.PG_PASSWORD
        }
        # Use a direct path to backend/data directory
        self.data_dir = Path(__file__).parent.parent.parent / "data"
        self.cosmos_db = CosmosDBService()
        
    def get_connection(self):
        """Create a connection to PostgreSQL."""
        try:
            conn = psycopg2.connect(**self.connection_params)
            return conn
        except psycopg2.Error as e:
            logger.error(f"Error connecting to PostgreSQL: {e}")
            raise

    async def import_students(self, conn):
        """Import student data directly from Cosmos DB.
        
        Args:
            conn: PostgreSQL connection
        """
        logger.info("Importing students from Cosmos DB...")
        
        try:
            # Query to get unique student IDs from attempts
            query = """
            SELECT DISTINCT VALUE c.student_id
            FROM c
            """
            
            student_ids = list(self.cosmos_db.attempts.query_items(
                query=query,
                enable_cross_partition_query=True
            ))
            
            # Create basic student records
            students = []
            for student_id in student_ids:
                students.append({
                    "student_id": student_id,
                    "name": f"Student {student_id}",
                    "grade": "Unknown"
                })
                
            logger.info(f"Extracted {len(students)} students from Cosmos DB")
            
            # Insert students
            if students:
                with conn.cursor() as cur:
                    for student in students:
                        cur.execute(
                            """
                            INSERT INTO students (student_id, name, grade)
                            VALUES (%s, %s, %s)
                            ON CONFLICT (student_id) DO UPDATE
                            SET name = EXCLUDED.name, grade = EXCLUDED.grade
                            """,
                            (student["student_id"], student.get("name"), student.get("grade", ""))
                        )
                    
                    conn.commit()
                    logger.info(f"Imported {len(students)} students")
            else:
                logger.warning("No students found in Cosmos DB")
                
        except Exception as e:
            logger.error(f"Error importing students from Cosmos DB: {e}")
            conn.rollback()

    def import_curriculum_from_csv(self, conn):
        """Import curriculum data from all syllabus CSV files with character cleaning.
        
        Args:
            conn: PostgreSQL connection
        """
        logger.info("Starting import_curriculum_from_csv with character cleaning...")
        
        # Define character replacements for cleaning text
        replacements = {
            '\u2192': '->',   # Right arrow →
            '\u2190': '<-',   # Left arrow ←
            '\u2194': '<->',  # Bidirectional arrow ↔
            '\u2022': '*',    # Bullet •
            '\u2018': "'",    # Left single quote '
            '\u2019': "'",    # Right single quote '
            '\u201c': '"',    # Left double quote "
            '\u201d': '"',    # Right double quote "
            '\u2013': '-',    # En dash –
            '\u2014': '--',   # Em dash —
            '\u2026': '...',  # Ellipsis …
            '\u00a9': '(c)',  # Copyright ©
            '\u00ae': '(R)',  # Registered trademark ®
            '\u2122': '(TM)', # Trademark ™
            '\u00b0': ' degrees', # Degree symbol °
            '\u03b1': 'alpha',    # Greek alpha α
            '\u03b2': 'beta',     # Greek beta β
            '\u03b3': 'gamma',    # Greek gamma γ
            '\u03c0': 'pi',       # Greek pi π
            '\u00b2': '²',        # Superscript 2
            '\u00b3': '³',        # Superscript 3
            '\u00d7': 'x',        # Multiplication sign ×
            '\u00f7': '/',        # Division sign ÷
            '\u221e': 'infinity', # Infinity ∞
            '\u2264': '<=',       # Less than or equal to ≤
            '\u2265': '>=',       # Greater than or equal to ≥
        }
        
        # Function to clean text by replacing Unicode characters
        def clean_text(text):
            if not isinstance(text, str):
                return text
                
            for char, replacement in replacements.items():
                text = text.replace(char, replacement)
            return text
        
        # Log the data directory path for verification
        logger.info(f"Data directory being checked: {self.data_dir} (exists: {os.path.exists(self.data_dir)})")
        
        # Find all CSV files in the data directory
        all_csv_files = list(self.data_dir.glob("*.csv"))
        logger.info(f"All CSV files in data directory ({len(all_csv_files)}): {[f.name for f in all_csv_files]}")
        
        # Find all syllabus CSV files in the data directory, case-insensitive
        syllabus_files = []
        for pattern in ["*syllabus*.csv", "*Syllabus*.csv"]:
            matched_files = list(self.data_dir.glob(pattern))
            logger.info(f"Files matching '{pattern}': {[f.name for f in matched_files]}")
            syllabus_files.extend(matched_files)
        
        # Make sure the list has unique paths
        syllabus_files = list(set(syllabus_files))
        logger.info(f"Unique syllabus files found: {len(syllabus_files)}")
        
        if not syllabus_files:
            logger.warning(f"No syllabus files found in: {self.data_dir}")
            # Try current working directory as fallback
            current_dir = Path.cwd()
            logger.info(f"Trying current working directory: {current_dir}")
            
            all_cwd_csv_files = list(current_dir.glob("*.csv"))
            logger.info(f"All CSV files in current directory: {[f.name for f in all_cwd_csv_files]}")
            
            alt_files = []
            for pattern in ["*syllabus*.csv", "*Syllabus*.csv"]:
                matched_files = list(current_dir.glob(pattern))
                logger.info(f"Files in current dir matching '{pattern}': {[f.name for f in matched_files]}")
                alt_files.extend(matched_files)
                
            if alt_files:
                syllabus_files = list(set(alt_files))
                logger.info(f"Found {len(syllabus_files)} syllabus files in current directory")
        
        if not syllabus_files:
            logger.error("Could not find any syllabus files in any location")
            return
        
        logger.info(f"Found {len(syllabus_files)} syllabus files to process")
        for idx, file_path in enumerate(syllabus_files):
            logger.info(f"  [{idx+1}] {file_path} (exists: {os.path.exists(file_path)})")
        
        total_records = 0
        processed_files = 0
        skipped_files = 0
        
        for file_path in syllabus_files:
            try:
                logger.info(f"=========================================================")
                logger.info(f"Processing syllabus file: {file_path}")
                
                # Check if file exists
                if not os.path.exists(file_path):
                    logger.error(f"File not found: {file_path}")
                    skipped_files += 1
                    continue
                
                # Load the CSV with error handling
                try:
                    logger.info(f"Attempting to read CSV with pandas...")
                    df = pd.read_csv(file_path)
                    logger.info(f"Successfully read CSV with {len(df)} rows and {len(df.columns)} columns")
                except Exception as e:
                    logger.error(f"Failed to read CSV with default encoding: {str(e)}")
                    # Try different encodings
                    for encoding in ['utf-8', 'latin1', 'iso-8859-1', 'cp1252']:
                        try:
                            logger.info(f"Trying to read with {encoding} encoding...")
                            df = pd.read_csv(file_path, encoding=encoding)
                            logger.info(f"Successfully read CSV with {encoding} encoding")
                            break
                        except Exception as e:
                            logger.warning(f"Failed with {encoding} encoding: {str(e)}")
                    else:
                        logger.error(f"Could not read file with any encoding, skipping: {file_path}")
                        skipped_files += 1
                        continue
                
                # Check required columns with case-insensitive matching
                required_columns = [
                    'Subject', 'UnitID', 'UnitTitle', 'SkillID', 
                    'SkillDescription', 'SubskillID', 'SubskillDescription',
                    'DifficultyStart', 'DifficultyEnd', 'TargetDifficulty'
                ]
                
                # Create a mapping of lowercase column names to actual column names
                column_mapping = {col.lower(): col for col in df.columns}
                
                # Check if required columns exist (case-insensitive)
                missing_columns = []
                for req_col in required_columns:
                    if req_col.lower() not in column_mapping:
                        missing_columns.append(req_col)
                
                if missing_columns:
                    logger.error(f"Missing columns in {file_path}: {missing_columns}")
                    logger.error(f"Available columns: {df.columns.tolist()}")
                    skipped_files += 1
                    continue
                
                # Rename columns to match the expected case
                rename_mapping = {}
                for req_col in required_columns:
                    if req_col not in df.columns and req_col.lower() in column_mapping:
                        rename_mapping[column_mapping[req_col.lower()]] = req_col
                
                if rename_mapping:
                    logger.info(f"Renaming columns in {file_path}: {rename_mapping}")
                    df = df.rename(columns=rename_mapping)
                
                # Clean text data in the DataFrame to handle Unicode characters
                for col in df.columns:
                    if df[col].dtype == 'object':  # Only clean string columns
                        df[col] = df[col].apply(clean_text)
                        logger.info(f"Cleaned text in column: {col}")
                
                # Prepare data for batch insert
                records = []
                error_rows = 0
                
                for idx, row in df.iterrows():
                    try:
                        # Add record
                        records.append((
                            str(row["Subject"]),
                            str(row.get("Grade", "")),
                            str(row["UnitID"]),
                            str(row["UnitTitle"]),
                            str(row["SkillID"]),
                            str(row["SkillDescription"]),
                            str(row["SubskillID"]),
                            str(row["SubskillDescription"]),
                            float(row["DifficultyStart"]),
                            float(row["DifficultyEnd"]),
                            float(row["TargetDifficulty"]),
                        ))
                    except Exception as e:
                        logger.warning(f"Error in row {idx}: {str(e)}")
                        logger.warning(f"Row data: {dict(row)}")
                        error_rows += 1
                
                if error_rows > 0:
                    logger.warning(f"Skipped {error_rows} rows due to errors")
                
                if not records:
                    logger.error(f"No valid records found in {file_path}")
                    skipped_files += 1
                    continue
                
                logger.info(f"Prepared {len(records)} records for insertion")
                
                # Batch insert with explicit connection encoding
                try:
                    # Set client encoding to SQL_ASCII to handle problematic characters
                    with conn.cursor() as cur:
                        cur.execute("SET client_encoding = 'SQL_ASCII'")
                        execute_values(
                            cur,
                            """
                            INSERT INTO curriculum (
                                subject, grade, unit_id, unit_title, 
                                skill_id, skill_description, 
                                subskill_id, subskill_description,
                                difficulty_start, difficulty_end, target_difficulty
                            ) VALUES %s
                            ON CONFLICT (subskill_id) DO UPDATE
                            SET subject = EXCLUDED.subject,
                                grade = EXCLUDED.grade,
                                unit_id = EXCLUDED.unit_id,
                                unit_title = EXCLUDED.unit_title,
                                skill_id = EXCLUDED.skill_id,
                                skill_description = EXCLUDED.skill_description,
                                subskill_description = EXCLUDED.subskill_description,
                                difficulty_start = EXCLUDED.difficulty_start,
                                difficulty_end = EXCLUDED.difficulty_end,
                                target_difficulty = EXCLUDED.target_difficulty
                            """,
                            records
                        )
                        # Reset client encoding
                        cur.execute("RESET client_encoding")
                        conn.commit()
                        logger.info(f"Commit successful!")
                except Exception as e:
                    logger.error(f"Error during database insert: {str(e)}")
                    conn.rollback()
                    logger.error(f"Transaction rolled back")
                    skipped_files += 1
                    continue
                    
                logger.info(f"Successfully imported {len(records)} curriculum items from {file_path}")
                total_records += len(records)
                processed_files += 1
                
            except Exception as e:
                logger.error(f"Unhandled error processing {file_path}: {str(e)}")
                logger.error(f"Exception type: {type(e).__name__}")
                import traceback
                logger.error(f"Traceback: {traceback.format_exc()}")
                conn.rollback()
                skipped_files += 1
        
        logger.info(f"=========================================================")
        logger.info(f"Import summary:")
        logger.info(f"- Total syllabus files found: {len(syllabus_files)}")
        logger.info(f"- Files successfully processed: {processed_files}")
        logger.info(f"- Files skipped due to errors: {skipped_files}")
        logger.info(f"- Total curriculum items loaded: {total_records}")
        
        # Double-check what's actually in the database
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT subject, COUNT(*) FROM curriculum GROUP BY subject")
                subjects = cur.fetchall()
                logger.info(f"Curriculum records by subject in database:")
                for subject, count in subjects:
                    logger.info(f"  - {subject}: {count} records")
        except Exception as e:
            logger.error(f"Error checking curriculum records: {str(e)}")
        
        logger.info(f"Curriculum import completed")

    def import_learning_path(self, conn, file_path=None, base_nodes_file=None):
        """Import learning path data from JSON with base node identification.
        
        Args:
            conn: PostgreSQL connection
            file_path: Path to learning path JSON file
            base_nodes_file: Path to base node skills JSON file
        """
        logger.info("Importing learning path data with base node identification...")
        
        # If no file path specified, use default in data directory
        if not file_path:
            file_path = self.data_dir / "learning_path_decision_tree.json"
        
        # If no base nodes file specified, use default in data directory
        if not base_nodes_file:
            base_nodes_file = self.data_dir / "base_node_skills.json"
        
        # Verify files exist
        if not os.path.exists(file_path):
            logger.warning(f"Learning path file not found: {file_path}")
            # Check if file exists in current directory
            current_dir = Path.cwd()
            alt_path = current_dir / Path(file_path).name
            if os.path.exists(alt_path):
                logger.info(f"Found learning path in current directory: {alt_path}")
                file_path = alt_path
            else:
                logger.error("Could not locate learning path file")
                return
        
        # Check if base nodes file exists
        base_nodes = []
        if os.path.exists(base_nodes_file):
            logger.info(f"Loading base node skills from {base_nodes_file}")
            try:
                with open(base_nodes_file, 'r') as f:
                    base_nodes_data = json.load(f)
                    base_nodes = base_nodes_data.get("base_node_skills", [])
                logger.info(f"Loaded {len(base_nodes)} base node skills")
            except Exception as e:
                logger.error(f"Error loading base node skills: {str(e)}")
                # Continue with algorithmic detection as fallback
        else:
            logger.warning(f"Base nodes file not found: {base_nodes_file}")
            logger.info("Will identify base nodes algorithmically")
        
        try:
            # Load the learning path JSON data
            with open(file_path, 'r') as f:
                learning_path_data = json.load(f)
            
            # Process learning paths
            with conn.cursor() as cur:
                # First clear any existing data (optional depending on your needs)
                cur.execute("TRUNCATE TABLE learning_paths")
                
                # Get the learning_path_decision_tree object
                tree_data = learning_path_data.get("learning_path_decision_tree", {})
                
                # Track skills that appear as prerequisites and those that are unlocked
                all_prereq_skills = set()
                all_unlocked_skills = set()
                
                # First, gather all skills mentioned in the tree
                for prereq_skill, unlocks_skills in tree_data.items():
                    all_prereq_skills.add(prereq_skill)
                    for unlocks_skill in unlocks_skills:
                        all_unlocked_skills.add(unlocks_skill)
                
                # Identify base nodes algorithmically: 
                # 1. If they're in the explicit base_nodes list
                # 2. If they appear as prerequisites but never as unlocked skills
                algorithmic_base_nodes = all_prereq_skills - all_unlocked_skills
                
                # Combine with explicitly defined base nodes
                combined_base_nodes = set(base_nodes) | algorithmic_base_nodes
                
                logger.info(f"Identified {len(combined_base_nodes)} base nodes " 
                        f"({len(base_nodes)} from file, "
                        f"{len(algorithmic_base_nodes)} algorithmically)")
                
                # Log the identified base nodes
                logger.info(f"Base nodes: {sorted(list(combined_base_nodes))}")
                
                # Process each item in the tree
                paths_added = 0
                
                # First insert all learning paths WITHOUT setting base_node flag
                for prereq_skill, unlocks_skills in tree_data.items():
                    for unlocks_skill in unlocks_skills:
                        # Insert with is_base_node as false initially
                        cur.execute(
                            """
                            INSERT INTO learning_paths (
                                prerequisite_skill_id, 
                                unlocks_skill_id,
                                min_score_threshold,
                                is_base_node
                            ) VALUES (%s, %s, %s, %s)
                            """,
                            (prereq_skill, unlocks_skill, 6.0, False)
                        )
                        paths_added += 1
                
                # Now update the is_base_node flag for just the base node skills
                # This updates the flag only for paths where the base node skill has no prerequisites
                for base_node in combined_base_nodes:
                    cur.execute(
                        """
                        UPDATE learning_paths 
                        SET is_base_node = TRUE 
                        WHERE prerequisite_skill_id = %s
                        AND NOT EXISTS (
                            SELECT 1 FROM learning_paths lp 
                            WHERE lp.unlocks_skill_id = %s
                        )
                        """,
                        (base_node, base_node)
                    )
                
                conn.commit()
            
            # Count imported paths
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM learning_paths")
                path_count = cur.fetchone()[0]
                
                # Count base nodes
                cur.execute("SELECT COUNT(*) FROM learning_paths WHERE is_base_node = TRUE")
                base_node_count = cur.fetchone()[0]
                
                # Count distinct base node skills 
                cur.execute("""
                    SELECT COUNT(DISTINCT prerequisite_skill_id) 
                    FROM learning_paths 
                    WHERE is_base_node = TRUE
                """)
                base_node_skills_count = cur.fetchone()[0]
            
            logger.info(f"Added {paths_added} learning paths, total in database: {path_count}")
            logger.info(f"Base node paths in database: {base_node_count}")
            logger.info(f"Distinct base node skills: {base_node_skills_count}")
            
        except Exception as e:
            logger.error(f"Error importing learning path data: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            conn.rollback()

    def import_subskill_learning_paths(self, conn, file_path=None):
        """Import subskill learning path data from JSON.
        
        Args:
            conn: PostgreSQL connection
            file_path: Path to subskill learning paths JSON file
        """
        logger.info("Importing subskill learning path data...")
        
        # If no file path specified, use default in data directory
        if not file_path:
            file_path = self.data_dir / "subskill-paths.json"
        
        # Verify file exists
        if not os.path.exists(file_path):
            logger.warning(f"Subskill learning path file not found: {file_path}")
            # Check if file exists in current directory
            current_dir = Path.cwd()
            alt_path = current_dir / Path(file_path).name
            if os.path.exists(alt_path):
                logger.info(f"Found subskill learning path in current directory: {alt_path}")
                file_path = alt_path
            else:
                logger.error("Could not locate subskill learning path file")
                return
        
        try:
            # Load the JSON data
            with open(file_path, 'r') as f:
                paths_data = json.load(f)
            
            # Get the subskill_learning_path object
            subskill_paths = paths_data.get("subskill_learning_path", {})
            
            if not subskill_paths:
                logger.warning("No subskill paths found in JSON file")
                return
            
            logger.info(f"Found {len(subskill_paths)} subskill paths in JSON")
            
            # Create set of valid subskill IDs from curriculum
            valid_subskills = set()
            with conn.cursor() as cur:
                cur.execute("SELECT subskill_id FROM curriculum")
                for row in cur.fetchall():
                    valid_subskills.add(row[0])
            
            # Process each subskill path
            paths_added = 0
            with conn.cursor() as cur:
                # First truncate the table to replace all data
                cur.execute("TRUNCATE TABLE subskill_learning_paths")
                
                # Process each subskill and its next subskill
                for current_subskill, data in subskill_paths.items():
                    next_subskill = data.get("next_subskill")
                    
                    # Skip if current subskill isn't in curriculum
                    if current_subskill not in valid_subskills:
                        logger.warning(f"Current subskill not in curriculum: {current_subskill}")
                        continue
                    
                    # Allow NULL for next_subskill to represent end of path
                    if next_subskill is not None and next_subskill not in valid_subskills:
                        logger.warning(f"Next subskill not in curriculum: {next_subskill} (from {current_subskill})")
                        # Continue with insertion but log the warning
                    
                    # Insert path with proper parameter handling
                    cur.execute(
                        """
                        INSERT INTO subskill_learning_paths (
                            current_subskill_id, 
                            next_subskill_id
                        ) VALUES (%s, %s)
                        ON CONFLICT (current_subskill_id) DO UPDATE
                        SET next_subskill_id = EXCLUDED.next_subskill_id
                        """,
                        (current_subskill, next_subskill)
                    )
                    paths_added += 1
            
                conn.commit()
            
            logger.info(f"Added {paths_added} subskill learning paths")
            
        except Exception as e:
            logger.error(f"Error importing subskill learning path data: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            conn.rollback()

    async def import_attempts_from_cosmos(self, conn):
        """Import attempt data directly from Cosmos DB, replacing existing data.
        
        Args:
            conn: PostgreSQL connection
        """
        logger.info("Importing attempts from Cosmos DB (replacing existing data)...")
        
        try:
            # First, truncate the attempts table to remove all existing attempts
            with conn.cursor() as cur:
                logger.info("Truncating attempts table to remove existing data...")
                cur.execute("TRUNCATE TABLE attempts")
                conn.commit()
            
            # Get all students
            with conn.cursor() as cur:
                cur.execute("SELECT student_id FROM students")
                student_ids = [row[0] for row in cur.fetchall()]
                
            if not student_ids:
                logger.warning("No students found to import attempts for")
                return
            
            # Create a set of valid subskill IDs
            valid_subskills = set()
            with conn.cursor() as cur:
                cur.execute("SELECT subskill_id FROM curriculum")
                for row in cur.fetchall():
                    valid_subskills.add(row[0])
            
            logger.info(f"Found {len(valid_subskills)} valid subskill IDs in curriculum")
            
            # For each student, fetch and import attempts
            total_imported = 0
            for sid in student_ids:
                logger.info(f"Fetching attempts for student {sid}")
                
                # Get all attempts for this student
                attempts = await self.cosmos_db.get_attempts_by_time_range(
                    student_id=sid
                )
                
                logger.info(f"Found {len(attempts)} attempts for student {sid}")
                
                # Process and insert each attempt
                student_imported = 0
                with conn.cursor() as cur:
                    for attempt in attempts:
                        try:
                            # Extract required fields
                            score = attempt.get("score", 0)
                            if not isinstance(score, (int, float)):
                                # Try to convert from string if needed
                                try:
                                    score = float(score)
                                except (ValueError, TypeError):
                                    logger.warning(f"Invalid score in attempt: {score}, using 0")
                                    score = 0
                            
                            # Skip attempts with invalid subskill IDs
                            subskill_id = attempt.get("subskill_id")
                            if subskill_id and subskill_id not in valid_subskills:
                                continue
                            
                            # Insert the attempt
                            cur.execute(
                                """
                                INSERT INTO attempts (
                                    student_id, subject, skill_id, subskill_id, 
                                    score, timestamp
                                ) VALUES (%s, %s, %s, %s, %s, %s)
                                """,
                                (
                                    attempt.get("student_id"),
                                    attempt.get("subject"),
                                    attempt.get("skill_id"),
                                    subskill_id,
                                    score,
                                    attempt.get("timestamp")
                                )
                            )
                            
                            student_imported += 1
                            
                        except Exception as e:
                            logger.error(f"Error importing attempt: {str(e)}")
                        
                        conn.commit()
                    
                    total_imported += student_imported
                    logger.info(f"Imported {student_imported} attempts for student {sid}")
                
                logger.info(f"Imported a total of {total_imported} attempts from Cosmos DB")
                
        except Exception as e:
            logger.error(f"Error importing attempts from Cosmos DB: {str(e)}")
            conn.rollback()

    async def import_problem_reviews(self, conn):
        """Import problem review data directly from CosmosDB reviews container.
        
        Args:
            conn: PostgreSQL connection
        """
        logger.info("Importing problem reviews from Cosmos DB...")
        
        try:
            # Since we need to use a different container, check if it exists
            # Use the reviews container if specified, otherwise fall back to attempts
            reviews_container = None
            try:
                if hasattr(self.cosmos_db, 'reviews'):
                    reviews_container = self.cosmos_db.reviews
                else:
                    # Try to access the reviews container
                    database = self.cosmos_db.client.get_database_client(self.cosmos_db.database_id)
                    reviews_container = database.get_container_client('reviews')
            except Exception as e:
                logger.error(f"Error accessing reviews container: {str(e)}")
                logger.warning("Falling back to attempts container")
                reviews_container = self.cosmos_db.attempts
            
            if not reviews_container:
                raise Exception("Could not access reviews container")
            
            query = """
            SELECT * FROM c WHERE 
            IS_DEFINED(c.student_id) AND 
            IS_DEFINED(c.skill_id) AND 
            IS_DEFINED(c.subskill_id)
            """
            
            logger.info(f"Executing reviews query: {query}")
            reviews = list(reviews_container.query_items(
                query=query,
                enable_cross_partition_query=True
            ))
            
            logger.info(f"Found {len(reviews)} potential reviews in Cosmos DB")
            
            # Get unit_id and unit_title mapping from curriculum
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT DISTINCT skill_id, unit_id, unit_title 
                    FROM curriculum
                """)
                unit_mapping = {}
                for skill_id, unit_id, unit_title in cur.fetchall():
                    unit_mapping[skill_id] = (unit_id, unit_title)
            
            logger.info(f"Built unit mapping from curriculum with {len(unit_mapping)} entries")
            
            # Create a set of valid subskill IDs
            valid_subskills = set()
            with conn.cursor() as cur:
                cur.execute("SELECT subskill_id FROM curriculum")
                for row in cur.fetchall():
                    valid_subskills.add(row[0])
            
            logger.info(f"Found {len(valid_subskills)} valid subskill IDs in curriculum")
            
            # Process and insert each review
            inserted = 0
            skipped = 0
            
            for review in reviews:
                try:
                    # Check if we have the required fields
                    if not all(k in review for k in ['id', 'student_id', 'subject', 'skill_id', 'subskill_id']):
                        logger.warning(f"Skipping review with missing required fields: {review.get('id', 'unknown')}")
                        skipped += 1
                        continue
                    
                    # Skip reviews with invalid subskill IDs
                    subskill_id = review.get('subskill_id')
                    if not subskill_id or subskill_id not in valid_subskills:
                        logger.warning(f"Skipping review with invalid subskill_id: {review.get('id', 'unknown')} - {subskill_id}")
                        skipped += 1
                        continue
                    
                    # Get timestamp, defaulting to current time if not found
                    timestamp = review.get('timestamp')
                    if not timestamp:
                        timestamp = datetime.utcnow().isoformat()
                    
                    # Get problem content
                    problem_type = None
                    problem_text = None
                    answer_text = None
                    success_criteria = None
                    teaching_note = None
                    
                    if 'problem_content' in review:
                        problem_content = review['problem_content']
                        problem_type = problem_content.get('problem_type')
                        problem_text = problem_content.get('problem')
                        answer_text = problem_content.get('answer')
                        success_criteria = problem_content.get('success_criteria')
                        teaching_note = problem_content.get('teaching_note')
                    
                    # Get data from full_review structure if it exists
                    # For reviews, most data is nested inside full_review
                    # but we need to check both root level and full_review
                    
                    # Get observation data
                    canvas_description = None
                    selected_answer = None
                    work_shown = None
                    
                    # Check full_review.observation first
                    if 'full_review' in review and 'observation' in review['full_review']:
                        observation = review['full_review']['observation']
                        if isinstance(observation, dict):
                            canvas_description = observation.get('canvas_description')
                            selected_answer = observation.get('selected_answer')
                            work_shown = observation.get('work_shown')
                    
                    # Try root observation as fallback
                    if canvas_description is None and 'observation' in review:
                        observation = review['observation']
                        if isinstance(observation, dict):
                            canvas_description = observation.get('canvas_description')
                            selected_answer = observation.get('selected_answer')
                            work_shown = observation.get('work_shown')
                    
                    # Get analysis data
                    understanding = None
                    approach = None
                    accuracy = None
                    creativity = None
                    
                    # Check full_review.analysis first
                    if 'full_review' in review and 'analysis' in review['full_review']:
                        analysis = review['full_review']['analysis']
                        if isinstance(analysis, dict):
                            understanding = analysis.get('understanding')
                            approach = analysis.get('approach')
                            accuracy = analysis.get('accuracy')
                            creativity = analysis.get('creativity')
                    
                    # Try root analysis as fallback
                    if understanding is None and 'analysis' in review:
                        analysis = review['analysis']
                        if isinstance(analysis, dict):
                            understanding = analysis.get('understanding')
                            approach = analysis.get('approach')
                            accuracy = analysis.get('accuracy')
                            creativity = analysis.get('creativity')
                    
                    # Get score from all possible locations
                    score = None
                    if 'score' in review:
                        score = review['score']
                    elif 'full_review' in review and 'evaluation' in review['full_review'] and 'score' in review['full_review']['evaluation']:
                        score = review['full_review']['evaluation']['score']
                    elif 'evaluation' in review and 'score' in review['evaluation']:
                        score = review['evaluation']['score']
                    
                    # Convert score to float if it's a string
                    if isinstance(score, str):
                        try:
                            score = float(score)
                        except (ValueError, TypeError):
                            logger.warning(f"Invalid score in review {review['id']}: {score}, using 0")
                            score = 0
                    
                    # Get evaluation justification
                    evaluation_justification = None
                    if 'full_review' in review and 'evaluation' in review['full_review']:
                        evaluation = review['full_review']['evaluation']
                        if isinstance(evaluation, dict):
                            evaluation_justification = evaluation.get('justification')
                    elif 'evaluation' in review:
                        evaluation = review['evaluation']
                        if isinstance(evaluation, dict):
                            evaluation_justification = evaluation.get('justification')
                    
                    # Get feedback fields
                    feedback_praise = None
                    feedback_guidance = None
                    feedback_encouragement = None
                    feedback_next_steps = None
                    
                    # Check full_review.feedback first
                    if 'full_review' in review and 'feedback' in review['full_review']:
                        feedback = review['full_review']['feedback']
                        if isinstance(feedback, dict):
                            feedback_praise = feedback.get('praise')
                            feedback_guidance = feedback.get('guidance')
                            feedback_encouragement = feedback.get('encouragement')
                            feedback_next_steps = feedback.get('next_steps')
                    
                    # Try root feedback as fallback
                    if feedback_praise is None and 'feedback' in review:
                        feedback = review['feedback']
                        if isinstance(feedback, dict):
                            feedback_praise = feedback.get('praise')
                            feedback_guidance = feedback.get('guidance')
                            feedback_encouragement = feedback.get('encouragement')
                            feedback_next_steps = feedback.get('next_steps')
                    
                    # Get unit information from mapping
                    unit_id = None
                    unit_title = None
                    if review['skill_id'] in unit_mapping:
                        unit_id, unit_title = unit_mapping[review['skill_id']]
                    
                    # Store the original JSON for reference
                    import json
                    raw_data = json.dumps(review)
                    
                    # Now we have all the fields, insert the review
                    with conn.cursor() as cur:
                        # Insert the review
                        cur.execute(
                            """
                            INSERT INTO problem_reviews (
                                review_id, student_id, subject, skill_id, subskill_id, 
                                problem_id, timestamp, unit_id, unit_title,
                                problem_type, problem_text, answer_text, success_criteria, teaching_note,
                                canvas_description, selected_answer, work_shown,
                                understanding, approach, accuracy, creativity,
                                feedback_praise, feedback_guidance, feedback_encouragement, feedback_next_steps,
                                score, evaluation_justification, cosmos_rid, cosmos_ts, raw_data
                            ) VALUES (
                                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 
                                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                            )
                            ON CONFLICT (review_id) DO UPDATE
                            SET 
                                student_id = EXCLUDED.student_id,
                                subject = EXCLUDED.subject,
                                skill_id = EXCLUDED.skill_id,
                                subskill_id = EXCLUDED.subskill_id,
                                problem_id = EXCLUDED.problem_id,
                                timestamp = EXCLUDED.timestamp,
                                unit_id = EXCLUDED.unit_id,
                                unit_title = EXCLUDED.unit_title,
                                problem_type = EXCLUDED.problem_type,
                                problem_text = EXCLUDED.problem_text,
                                answer_text = EXCLUDED.answer_text,
                                success_criteria = EXCLUDED.success_criteria,
                                teaching_note = EXCLUDED.teaching_note,
                                canvas_description = EXCLUDED.canvas_description,
                                selected_answer = EXCLUDED.selected_answer,
                                work_shown = EXCLUDED.work_shown,
                                understanding = EXCLUDED.understanding,
                                approach = EXCLUDED.approach,
                                accuracy = EXCLUDED.accuracy,
                                creativity = EXCLUDED.creativity,
                                feedback_praise = EXCLUDED.feedback_praise,
                                feedback_guidance = EXCLUDED.feedback_guidance,
                                feedback_encouragement = EXCLUDED.feedback_encouragement,
                                feedback_next_steps = EXCLUDED.feedback_next_steps,
                                score = EXCLUDED.score,
                                evaluation_justification = EXCLUDED.evaluation_justification,
                                cosmos_rid = EXCLUDED.cosmos_rid,
                                cosmos_ts = EXCLUDED.cosmos_ts,
                                raw_data = EXCLUDED.raw_data,
                                updated_at = CURRENT_TIMESTAMP
                            """,
                            (
                                review['id'], 
                                review['student_id'],
                                review['subject'],
                                review['skill_id'],
                                subskill_id,
                                review.get('problem_id', review['id']),
                                timestamp,
                                unit_id,
                                unit_title,
                                problem_type,
                                problem_text,
                                answer_text,
                                json.dumps(success_criteria) if success_criteria else None,
                                teaching_note,
                                canvas_description,
                                selected_answer,
                                work_shown,
                                understanding,
                                approach,
                                accuracy,
                                creativity,
                                feedback_praise,
                                feedback_guidance,
                                feedback_encouragement,
                                feedback_next_steps,
                                score,
                                evaluation_justification,
                                review.get('_rid'),
                                review.get('_ts'),
                                raw_data
                            )
                        )
                    
                    # Commit after each record to avoid transaction issues
                    conn.commit()
                    inserted += 1
                    
                    if inserted % 10 == 0:
                        logger.info(f"Imported {inserted} problem reviews so far")
                    
                except Exception as e:
                    # If an error occurs, log it and skip this review
                    logger.error(f"Error importing problem review {review.get('id', 'unknown')}: {str(e)}")
                    logger.error(f"Review ID: {review.get('id')}, Student: {review.get('student_id')}, Subskill: {review.get('subskill_id', 'unknown')}")
                    import traceback
                    logger.error(f"Traceback: {traceback.format_exc()}")
                    conn.rollback()  # Roll back the transaction for this review
                    skipped += 1
            
            logger.info(f"Successfully imported {inserted} problem reviews")
            logger.info(f"Skipped {skipped} problem reviews due to errors")
            
        except Exception as e:
            logger.error(f"Error importing problem reviews from Cosmos DB: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            conn.rollback()

    def verify_database(self, conn):
        """Verify the database tables have data.
        
        Args:
            conn: PostgreSQL connection
        """
        logger.info("Verifying database tables...")
        
        with conn.cursor() as cur:
            # Count records in each table
            tables = ["students", "curriculum", "learning_paths", "attempts", "subskill_learning_paths", "problem_reviews"]
            
            for table in tables:
                cur.execute(f"SELECT COUNT(*) FROM {table}")
                count = cur.fetchone()[0]
                logger.info(f"Table {table}: {count} records")
            
            # Get curriculum counts by subject
            cur.execute("SELECT subject, COUNT(*) FROM curriculum GROUP BY subject ORDER BY COUNT(*) DESC")
            subject_counts = cur.fetchall()
            for subject, count in subject_counts:
                logger.info(f"Curriculum - {subject}: {count} records")
            
            # Check learning paths and base nodes
            cur.execute("SELECT COUNT(*) FROM learning_paths WHERE is_base_node = TRUE")
            base_node_count = cur.fetchone()[0]
            logger.info(f"Learning paths - Base nodes: {base_node_count}")
            
            # List some base nodes
            cur.execute("""
                SELECT prerequisite_skill_id 
                FROM learning_paths 
                WHERE is_base_node = TRUE 
                GROUP BY prerequisite_skill_id
                LIMIT 10
            """)
            base_nodes = [row[0] for row in cur.fetchall()]
            logger.info(f"Sample base nodes: {', '.join(base_nodes)}")
            
            # Check a few problem reviews to verify data is correct
            cur.execute("""
                SELECT review_id, student_id, subject, score, unit_id 
                FROM problem_reviews 
                ORDER BY timestamp DESC
                LIMIT 5
            """)
            reviews = cur.fetchall()
            logger.info("Sample problem reviews:")
            for review_id, student_id, subject, score, unit_id in reviews:
                logger.info(f"  - {review_id}: Student {student_id}, {subject}, Score {score}, Unit {unit_id}")
            
            # Check for missing unit information in problem reviews
            cur.execute("SELECT COUNT(*) FROM problem_reviews WHERE unit_id IS NULL")
            missing_unit_count = cur.fetchone()[0]
            if missing_unit_count > 0:
                logger.warning(f"Found {missing_unit_count} problem reviews with missing unit information")
            
            logger.info("Database verification completed")

    async def run_etl(self, syllabus_file=None, learning_path_file=None, subskill_path_file=None, base_nodes_file=None, verify=True):
        """Run the ETL process.
        
        Args:
            syllabus_file: Optional specific syllabus file path
            learning_path_file: Optional specific learning path file path
            subskill_path_file: Optional specific subskill path file path
            verify: Whether to verify the database after import
        """
        logger.info("Starting ETL process")
        
        # Get database connection
        conn = self.get_connection()
        
        try:
            # Import data
            await self.import_students(conn)
            self.import_curriculum_from_csv(conn)
            self.import_learning_path(conn, learning_path_file, base_nodes_file)
            self.import_subskill_learning_paths(conn, subskill_path_file)
            
            # Import attempts from Cosmos DB
            await self.import_attempts_from_cosmos(conn)
            
            # Import problem reviews
            await self.import_problem_reviews(conn)
            
            # Verify database
            if verify:
                self.verify_database(conn)
            
            logger.info("ETL process completed successfully")
            
        except Exception as e:
            logger.error(f"Error in ETL process: {str(e)}")
            conn.rollback()
            
        finally:
            conn.close()

# Create a singleton instance
postgres_etl = PostgreSQLETL()

def get_postgres_etl():
    """Get the singleton PostgreSQL ETL instance."""
    return postgres_etl

# Utility method to run the ETL process directly
async def run_etl(syllabus_file=None, learning_path_file=None, 
                  subskill_path_file=None, base_nodes_file=None):
    """Run the ETL process."""
    etl = get_postgres_etl()
    await etl.run_etl(syllabus_file, learning_path_file, 
                      subskill_path_file, base_nodes_file)

if __name__ == "__main__":
    """Run ETL when executed directly."""
    asyncio.run(run_etl())