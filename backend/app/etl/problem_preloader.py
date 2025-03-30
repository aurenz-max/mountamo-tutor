# backend/app/etl/problem_preloader.py
import asyncio
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
import json
import sys
import time
import uuid
from pathlib import Path
import os

# Import from project modules
from ..core.config import settings
from app.services.analytics import AnalyticsExtension
from app.services.problems import ProblemService
from app.db.cosmos_db import CosmosDBService
from app.services.competency import CompetencyService
from app.services.recommender import ProblemRecommender

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(f"problem_preloader_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"),
        logging.StreamHandler(sys.stdout)
    ]
)

# Silence azure logs
logging.getLogger('azure').setLevel(logging.WARNING)
logging.getLogger('azure.core.pipeline.policies.http_logging_policy').setLevel(logging.WARNING)
logging.getLogger('websockets').setLevel(logging.WARNING)

logger = logging.getLogger("problem_preloader")

class ProblemPreloaderETL:
    """ETL service for preloading problems for students based on recommendations."""
    
    def __init__(self):
        """Initialize Problem Preloader ETL service."""
        # Create service instances - note special handling for ProblemRecommender
        self.cosmos_db = CosmosDBService()
        
        # Use the DATA_DIR path similar to dependencies.py
        DATA_DIR = Path(__file__).parent.parent.parent / "data"
        logger.info(f"Using data directory: {DATA_DIR}")
        
        # Initialize competency service with data directory
        self.competency_service = CompetencyService(data_dir=str(DATA_DIR))
        self.competency_service.cosmos_db = self.cosmos_db
        
        # Initialize the recommender with competency service
        self.recommender = ProblemRecommender(self.competency_service)
        
        # Initialize problem service and set dependencies
        self.problem_service = ProblemService()
        self.problem_service.recommender = self.recommender
        self.problem_service.competency_service = self.competency_service
        self.problem_service.cosmos_db = self.cosmos_db
        
        # Initialize analytics service
        self.analytics_service = AnalyticsExtension()
        
        # Config
        self.problems_per_subskill = 15  # Number of problems to preload per subskill
        self.batch_size = 10            # Process students in batches of this size
        
        logger.info("Initialized all services for Problem Preloader ETL")
        logger.info(f"Creating {self.problems_per_subskill} problems per subskill")

    def get_cosmos_db_container_info(self):
        """Diagnostic function to report CosmosDB container info."""
        try:
            logger.info("Checking CosmosDB container status:")
            
            # Check main attributes
            logger.info(f"CosmosDB client initialized: {self.cosmos_db.client is not None}")
            logger.info(f"CosmosDB attempts container exists: {hasattr(self.cosmos_db, 'attempts') and self.cosmos_db.attempts is not None}")
            
            # Try to access the containers
            try:
                if hasattr(self.cosmos_db, 'container'):
                    logger.info(f"Main container ID: {self.cosmos_db.container.id}")
                
                if hasattr(self.cosmos_db, 'attempts'):
                    logger.info(f"Attempts container ID: {self.cosmos_db.attempts.id}")
                
                if hasattr(self.cosmos_db, 'reviews'):
                    logger.info(f"Reviews container ID: {self.cosmos_db.reviews.id}")
            except Exception as e:
                logger.error(f"Error accessing container IDs: {str(e)}")
            
            logger.info("CosmosDB container status check complete")
            
        except Exception as e:
            logger.error(f"Error checking CosmosDB status: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
    
    async def get_active_students(self, days_threshold: int = 30) -> List[int]:
        """Get list of active student IDs from the last N days."""
        try:
            logger.info(f"Attempting to get active students for the last {days_threshold} days")
            
            # Query to get unique student IDs from attempts
            query = """
            SELECT DISTINCT VALUE c.student_id
            FROM c
            WHERE c.type = 'attempt'
            """
            
            logger.info(f"Executing CosmosDB query: {query}")
            
            # Check if cosmos_db is properly initialized
            if not hasattr(self.cosmos_db, 'attempts') or self.cosmos_db.attempts is None:
                logger.error("CosmosDB attempts container not initialized")
                # For testing, return student_id = 1
                logger.info("Returning test student_id = 1 for development")
                return [1]
            
            try:
                items = list(self.cosmos_db.attempts.query_items(
                    query=query,
                    enable_cross_partition_query=True
                ))
                logger.info(f"Query returned {len(items)} active students: {items}")
            except Exception as e:
                logger.error(f"Error executing CosmosDB query: {str(e)}")
                # For testing, return student_id = 1
                logger.info("Returning test student_id = 1 for development")
                return [1]
            
            # If no active students found, return student_id = 1 for testing
            if not items:
                logger.info("No active students found in database. Using test student_id = 1 for development")
                return [1]
                
            # Collect results
            student_ids = items
            logger.info(f"Found {len(student_ids)} active students: {student_ids}")
            return student_ids
            
        except Exception as e:
            logger.error(f"Error getting active students: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            
            # For testing, return student_id = 1
            logger.info("Returning test student_id = 1 for development due to error")
            return [1]
    
    async def get_student_recommendations(self, student_id: int, subject: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get recommended activities for a student."""
        try:
            logger.info(f"Getting recommendations for student {student_id}, subject {subject}")
            
            try:
                # Get 3 recommendations per subject
                recommendations = await self.analytics_service.get_recommendations(
                    student_id=student_id,
                    subject=subject,
                    limit=5  # Changed from 10 to 3
                )
                
                logger.info(f"Got {len(recommendations)} recommendations for student {student_id}")
                
                # Log some details about the recommendations
                if recommendations:
                    for i, rec in enumerate(recommendations[:3]):  # Log first 3 recommendations
                        logger.info(f"Recommendation {i+1}: Unit: {rec.get('unit_id')} - {rec.get('unit_title')}, "
                                    f"Skill: {rec.get('skill_id')} - {rec.get('skill_description')}, "
                                    f"Subskill: {rec.get('subskill_id')} - {rec.get('subskill_description')}")
                
                # If no recommendations, use default test values
                if not recommendations:
                    logger.warning(f"No recommendations found for student {student_id}")
                                    
                return recommendations
                
            except Exception as e:
                logger.error(f"Error calling analytics_service.get_recommendations: {str(e)}")
                import traceback
                logger.error(traceback.format_exc()) 
                return []
                
        except Exception as e:
            logger.error(f"Error getting recommendations for student {student_id}: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            
            # Return empty list as fallback
            return []
    
    async def preload_problems_for_student(self, student_id: int, subject: Optional[str] = None) -> Dict[str, Any]:
        """Preload problems for a specific student based on their recommendations."""
        try:
            start_time = time.time()
            logger.info(f"Preloading problems for student {student_id}, subject: {subject}")
            
            # Default to student 1 for testing
            if not student_id:
                student_id = 1
                logger.info("Defaulting to student_id = 1 for testing")
            
            # Default to mathematics for testing
            if not subject:
                subject = "mathematics"
                logger.info("Defaulting to subject = mathematics for testing")
                
            # Use the class-level problems_per_subskill
            problems_per_subskill = self.problems_per_subskill
                        
            # Get recommendations for this student
            recommendations = await self.get_student_recommendations(student_id, subject)

            processed_ids = set()  # Track IDs we've generated in this run
            
            if not recommendations:
                logger.warning(f"No recommendations found for student {student_id}")
                return {
                    "student_id": student_id,
                    "subject": subject,
                    "problems_generated": 0,
                    "success": False,
                    "message": "No recommendations found"
                }
            
            # Process each recommendation and generate problems
            total_problems_generated = 0
            formatted_recommendations = []
            
            # First, collect all the recommendations that need problems
            for recommendation in recommendations:
                try:
                    # Extract metadata
                    recommendation_subject = recommendation.get("subject", subject)
                    skill_id = recommendation.get("skill_id")
                    subskill_id = recommendation.get("subskill_id")
                    
                    if not skill_id or not subskill_id:
                        logger.warning(f"Missing skill/subskill in recommendation: {recommendation}")
                        continue
                        
                    logger.info(f"Processing recommendation: subject={recommendation_subject}, "
                            f"skill={skill_id}, subskill={subskill_id}")
                    
                    # Check existing problems for this subskill
                    existing_problems = await self.cosmos_db.get_cached_problems(
                        subject=recommendation_subject,
                        skill_id=skill_id,
                        subskill_id=subskill_id
                    )
                    
                    # Log existing problems
                    if existing_problems:
                        logger.info(f"Found {len(existing_problems)} existing problems for {skill_id}/{subskill_id}")
                        for i, prob in enumerate(existing_problems[:2]):  # Log first 2 problems
                            problem_obj = prob.get("problem_data", prob)
                            problem_id = problem_obj.get("problem_id") or problem_obj.get("id")
                            problem_type = problem_obj.get("problem_type")
                            logger.info(f"Existing problem {i+1}: ID={problem_id}, Type={problem_type}")
                    else:
                        logger.info(f"No existing problems found for {skill_id}/{subskill_id}")
                                        
                    # Get detailed objectives for this subskill
                    logger.info(f"Getting detailed objectives for subskill {subskill_id}")
                    objectives = await self.competency_service.get_detailed_objectives(
                        subject=recommendation_subject,
                        subskill_id=subskill_id
                    )

                    difficulty = recommendation.get("difficulty")  # Use the difficulty from the recommendation
                    
                    if objectives:
                        logger.info(f"Got objectives for {subskill_id}: ConceptGroup={objectives.get('ConceptGroup')}, "
                                f"DetailedObjective={objectives.get('DetailedObjective')}")
                    else:
                        logger.warning(f"No objectives found for subskill {subskill_id}")
                        objectives = {
                            "ConceptGroup": "General",
                            "DetailedObjective": "Basic understanding"
                        }

                    try:
                        # Get the difficulty directly from the recommender
                        difficulty = await self.recommender._determine_difficulty(
                            student_id=student_id,
                            subject=recommendation_subject,
                            subskill={
                                "unit_id": recommendation.get("unit_id"),
                                "skill_id": skill_id,
                                "subskill_id": subskill_id,
                                "difficulty_range": {"target": 5.0, "start": 1.0, "end": 10.0}  # Default range if not available
                            }
                        )
                        logger.info(f"Got adaptive difficulty {difficulty} for subskill {subskill_id}")

                        # Check if we have enough problems at the CORRECT difficulty level
                        difficulty_tolerance = 1.0  # Allow problems within +/- 1.0 of target difficulty
                        problems_at_correct_difficulty = []

                        for prob in existing_problems:
                            # Extract nested problem_data if needed
                            problem_obj = prob.get("problem_data", prob)
                            prob_difficulty = problem_obj.get("metadata", {}).get("difficulty", 0)
                            if abs(prob_difficulty - difficulty) <= difficulty_tolerance:
                                problems_at_correct_difficulty.append(prob)

                        logger.info(f"Found {len(problems_at_correct_difficulty)} problems at correct difficulty level (target: {difficulty})")

                        if len(problems_at_correct_difficulty) >= problems_per_subskill:
                            logger.info(f"Already have {len(problems_at_correct_difficulty)} problems at difficulty {difficulty} for {skill_id}/{subskill_id}, skipping")
                            continue

                        # Calculate how many problems to generate at the correct difficulty
                        problems_needed = problems_per_subskill - len(problems_at_correct_difficulty)
                        logger.info(f"Need to generate {problems_needed} problems at difficulty {difficulty} for {skill_id}/{subskill_id}")
                    except Exception as e:
                        # Default to medium difficulty if there's an error
                        difficulty = 5.0
                        logger.warning(f"Error getting difficulty, using default: {str(e)}")
                                        
                    # Format the recommendation for batch generation
                    # Add the same recommendation multiple times if we need multiple problems
                    for _ in range(problems_needed):
                        formatted_recommendations.append({
                            "unit": {
                                "id": recommendation.get("unit_id"),
                                "title": recommendation.get("unit_title")
                            },
                            "skill": {
                                "id": skill_id,
                                "description": recommendation.get("skill_description")
                            },
                            "subskill": {
                                "id": subskill_id,
                                "description": recommendation.get("subskill_description")
                            },
                            "difficulty": difficulty,
                            "detailed_objectives": objectives,
                            "original_subject": recommendation_subject  # Store the subject for later use
                        })
                    
                except Exception as e:
                    logger.error(f"Error processing recommendation for student {student_id}: {str(e)}")
                    import traceback
                    logger.error(traceback.format_exc())
            
            # If we have recommendations to process, generate problems in batch
            if formatted_recommendations:
                logger.info(f"Generating {len(formatted_recommendations)} problems in batch for student {student_id}")
                
                # Split into manageable batches to avoid exceeding token limits
                batch_size = 5  # Process 5 problems at a time
                for i in range(0, len(formatted_recommendations), batch_size):
                    batch = formatted_recommendations[i:i+batch_size]
                    logger.info(f"Processing batch {i//batch_size + 1}/{(len(formatted_recommendations)-1)//batch_size + 1}")
                    
                    try:
                        # Generate problems in batch
                        # Use the first recommendation's subject as the subject for the batch
                        batch_subject = batch[0].get("original_subject", subject)
                        
                        # Use the new method to generate multiple problems in one call
                        raw_problems_response = await self.problem_service.generate_multiple_problems(
                            subject=batch_subject,
                            recommendations=batch
                        )
                        
                        if not raw_problems_response:
                            logger.warning(f"Failed to generate batch of problems")
                            continue
                        
                        # Parse the response to get individual problems
                        try:
                            import json
                            response_obj = json.loads(raw_problems_response)
                            
                            if not isinstance(response_obj, dict) or "problems" not in response_obj:
                                logger.error(f"Response does not contain 'problems' array")
                                logger.debug(f"Raw response: {raw_problems_response[:200]}...")
                                continue
                                
                            raw_problems = response_obj["problems"]
                            if not isinstance(raw_problems, list):
                                logger.error(f"'problems' is not an array")
                                continue
                                
                            logger.info(f"Successfully parsed batch response with {len(raw_problems)} problems")
                            
                        except json.JSONDecodeError as e:
                            logger.error(f"Failed to parse JSON response: {str(e)}")
                            logger.debug(f"Raw response: {raw_problems_response[:200]}...")
                            continue
                        
                        # Process each problem in the batch
                        for j, raw_problem in enumerate(raw_problems):
                            if j >= len(batch):
                                # If we have more problems than recommendations, stop processing
                                break
                            
                            # Get the corresponding recommendation for this problem
                            current_rec = batch[j]
                            current_subject = current_rec.get("original_subject", batch_subject)
                            current_skill_id = current_rec["skill"]["id"]
                            current_subskill_id = current_rec["subskill"]["id"]
                            
                            try:
                                # Convert to string for _parse_problem if not already a string
                                if not isinstance(raw_problem, str):
                                    raw_problem = json.dumps(raw_problem)
                                    
                                # Parse the problem
                                problem_data = await self.problem_service._parse_problem(raw_problem)
                                
                                if not problem_data:
                                    logger.warning(f"Failed to parse problem {j+1} in batch")
                                    continue
                                
                                logger.info(f"Parsed problem {j+1} in batch: type={problem_data.get('problem_type')}")
                                
                                # Add metadata
                                problem_data['metadata'] = {
                                    'subject': current_subject,
                                    'unit': current_rec['unit'],
                                    'skill': current_rec['skill'],
                                    'subskill': current_rec['subskill'],
                                    'difficulty': current_rec.get("difficulty", 5.0),
                                    'objectives': current_rec['detailed_objectives']
                                }
                                
                                # Store in CosmosDB using the unified method
                                try:
                                    await self.cosmos_db.save_cached_problem(
                                        subject=current_subject,
                                        skill_id=current_skill_id,
                                        subskill_id=current_subskill_id,
                                        problem_data=problem_data
                                    )
                                    
                                    total_problems_generated += 1
                                    logger.info(f"Successfully stored problem for {current_skill_id}/{current_subskill_id}")
                                    time.sleep(0.001)  # Small delay to avoid rate limiting
                                    
                                except Exception as e:
                                    logger.error(f"Error storing problem in CosmosDB: {str(e)}")
                                    import traceback
                                    logger.error(traceback.format_exc())
                                    
                            except Exception as e:
                                logger.error(f"Error processing problem {j+1} in batch: {str(e)}")
                                import traceback
                                logger.error(traceback.format_exc())
                        
                    except Exception as e:
                        logger.error(f"Error generating batch of problems: {str(e)}")
                        import traceback
                        logger.error(traceback.format_exc())
                    
                    # Add a delay between batches to avoid rate limiting
                    if i + batch_size < len(formatted_recommendations):
                        await asyncio.sleep(5)
            
            elapsed_time = time.time() - start_time
            logger.info(f"Generated {total_problems_generated} problems for student {student_id} for subject {subject} in {elapsed_time:.2f} seconds")
            
            return {
                "student_id": student_id,
                "subject": subject,
                "problems_generated": total_problems_generated,
                "success": True,
                "elapsed_seconds": elapsed_time
            }
            
        except Exception as e:
            logger.error(f"Error preloading problems for student {student_id}: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            
            return {
                "student_id": student_id,
                "subject": subject,
                "problems_generated": 0,
                "success": False,
                "error": str(e)
            }
    
    async def batch_preload_problems(self, subject: Optional[str] = None, specific_students: Optional[List[int]] = None) -> Dict[str, Any]:
        """Preload problems for multiple students in batches."""
        try:
            start_time = time.time()
            
            # Get active students if not specified
            students_to_process = specific_students
            if not students_to_process:
                students_to_process = await self.get_active_students()
            
            if not students_to_process:
                logger.warning("No students to process")
                return {
                    "students_processed": 0,
                    "successful_students": 0,
                    "failed_students": 0,
                    "total_problems_generated": 0,
                    "success": False,
                    "error": "No students to process"
                }
            
            # Get available subjects if not specified
            subjects_to_process = [subject] if subject else await self.competency_service.get_available_subjects()
            
            if not subjects_to_process:
                logger.warning("No subjects to process")
                return {
                    "students_processed": 0,
                    "successful_students": 0,
                    "failed_students": 0,
                    "total_problems_generated": 0,
                    "success": False,
                    "error": "No subjects to process"
                }
            
            logger.info(f"Starting batch problem preloading for {len(students_to_process)} students and {len(subjects_to_process)} subjects")
            
            # Process students in batches
            student_results = []
            successful_students = 0
            failed_students = 0
            total_problems_generated = 0
            
            # Process in batches
            for i in range(0, len(students_to_process), self.batch_size):
                batch = students_to_process[i:i+self.batch_size]
                logger.info(f"Processing batch {i//self.batch_size + 1}/{(len(students_to_process)-1)//self.batch_size + 1} with {len(batch)} students")
                
                # Process each student in the batch concurrently
                batch_tasks = []
                for student_id in batch:
                    # For each student, create tasks for each subject
                    for subject_name in subjects_to_process:
                        batch_tasks.append(self.preload_problems_for_student(student_id, subject_name))
                
                batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)
                
                # Process batch results
                for result in batch_results:
                    if isinstance(result, Exception):
                        logger.error(f"Batch processing error: {str(result)}")
                        failed_students += 1
                    else:
                        student_results.append(result)
                        if result.get("success", False):
                            successful_students += 1
                            total_problems_generated += result.get("problems_generated", 0)
                        else:
                            failed_students += 1
                
                # Add delay between batches to reduce system load
                if i + self.batch_size < len(students_to_process):
                    logger.info(f"Waiting between batches...")
                    await asyncio.sleep(10)
            
            total_elapsed = time.time() - start_time
            logger.info(f"Completed batch preloading in {total_elapsed:.2f} seconds: " +
                    f"processed {len(student_results)} students, " +
                    f"successful: {successful_students}, " +
                    f"failed: {failed_students}, " +
                    f"generated {total_problems_generated} new problems")
            
            return {
                "students_processed": len(student_results),
                "successful_students": successful_students,
                "failed_students": failed_students,
                "total_problems_generated": total_problems_generated,
                "success": True,
                "elapsed_seconds": total_elapsed
            }
            
        except Exception as e:
            logger.error(f"Error in batch preloading: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            
            return {
                "students_processed": 0,
                "successful_students": 0,
                "failed_students": 0,
                "total_problems_generated": 0,
                "success": False,
                "error": str(e)
            }

    async def run_etl(self, subject: Optional[str] = None, specific_students: Optional[List[int]] = None, 
                  problems_per_subskill: Optional[int] = None, batch_size: Optional[int] = None):
        """Run the ETL process."""
        logger.info("Starting problem preloader ETL process")
        
        # Log environment info
        logger.info(f"Running in directory: {os.getcwd()}")
        logger.info(f"Python path: {sys.path}")
        logger.info(f"Subject filter: {subject}")
        logger.info(f"Specific students: {specific_students}")
        
        # Check CosmosDB status
        self.get_cosmos_db_container_info()
        
        # Update configuration if provided
        if problems_per_subskill is not None:
            self.problems_per_subskill = problems_per_subskill
            logger.info(f"Set problems_per_subskill to {problems_per_subskill}")
            
        if batch_size is not None:
            self.batch_size = batch_size
            logger.info(f"Set batch_size to {batch_size}")
        
        # Run the batch preloading process
        result = await self.batch_preload_problems(subject, specific_students)
        
        if result.get("success", False):
            logger.info("Problem preloader ETL completed successfully")
        else:
            logger.error(f"Problem preloader ETL failed: {result.get('error', 'Unknown error')}")
        
        return result

# Create a singleton instance
problem_preloader_etl = ProblemPreloaderETL()

def get_problem_preloader_etl():
    """Get the singleton problem preloader ETL instance."""
    return problem_preloader_etl

# Utility method to run the ETL process directly
async def run_etl(subject=None, specific_students=None, problems_per_subskill=None, batch_size=None):
    """Run the problem preloader ETL process."""
    etl = get_problem_preloader_etl()
    return await etl.run_etl("Mathematics", specific_students, problems_per_subskill, batch_size)

if __name__ == "__main__":
    """Run ETL when executed directly."""
    import argparse
    
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Problem Preloader ETL Process')
    parser.add_argument('--subject', type=str, help='Subject filter (e.g., "math", "science")')
    parser.add_argument('--students', type=str, help='Comma-separated list of student IDs')
    parser.add_argument('--problems-per-subskill', type=int, default=5, 
                       help='Number of problems to preload per subskill')
    parser.add_argument('--batch-size', type=int, default=10, 
                       help='Batch size for processing students')
    
    args = parser.parse_args()
    
    # Process specific students if provided
    specific_students = None
    if args.students:
        try:
            specific_students = [int(s.strip()) for s in args.students.split(',')]
            logger.info(f"Processing specific students: {specific_students}")
        except ValueError:
            logger.error("Invalid student IDs provided. Must be comma-separated integers.")
            sys.exit(1)
    
    # Run the ETL process
    asyncio.run(run_etl(
        subject=args.subject,
        specific_students=specific_students,
        problems_per_subskill=15,
        batch_size=args.batch_size
    ))