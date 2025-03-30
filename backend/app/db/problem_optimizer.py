# problem_optimizer.py
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import math

logger = logging.getLogger(__name__)

class ProblemOptimizer:
    """
    Optimizes problem selection for students based on:
    1. Spaced repetition principles (using Poisson distribution)
    2. Appropriate difficulty level targeting 80-90% success rate
    """
    
    def __init__(self, cosmos_db, recommender=None):
        """
        Initialize the problem optimizer
        
        Args:
            cosmos_db: The CosmosDBService instance for tracking reviews
            recommender: The ProblemRecommender instance for difficulty calculation
        """
        self.cosmos_db = cosmos_db
        self.recommender = recommender  # Store the recommender reference
        
        # Spaced repetition parameters
        self.sr_low_lambda = 3    # Lambda for low scores (< 60%)
        self.sr_medium_lambda = 7 # Lambda for medium scores (60-90%)
        self.sr_high_lambda = 14  # Lambda for high scores (> 90%)
        
        # Target success rate for optimal learning (sweet spot)
        self.target_success_rate = 0.85  # 85% target success rate
        
        logger.info("Problem optimizer initialized")
    
    async def calculate_optimal_difficulty(self, student_id, subject, skill_id, subskill_id, unit_id=None):
        """
        Calculate the optimal difficulty level for a student using the recommender's
        difficulty calculation logic
        """
        try:
            # Check if recommender is available
            if self.recommender is None:
                logger.error("Recommender not available, falling back to original method")
                return await self._calculate_optimal_difficulty_original(student_id, subject, skill_id, subskill_id)
                
            # Try to get difficulty range from somewhere, or use default
            difficulty_range = {
                "start": 1.0,
                "target": 5.0,
                "end": 10.0
            }
            
            # Create a more complete subskill dict that matches what the recommender expects
            subskill = {
                "unit_id": unit_id,  # Now we're passing this from the problem service
                "skill_id": skill_id,
                "subskill_id": subskill_id,
                "difficulty_range": difficulty_range
            }
            
            # Use the recommender's difficulty calculation
            difficulty = await self.recommender._determine_difficulty(
                student_id=student_id,
                subject=subject,
                subskill=subskill
            )
            
            logger.info(f"Using recommender difficulty for student {student_id}, skill {skill_id}: {difficulty:.2f}")
            return difficulty
        except Exception as e:
            logger.error(f"Error using recommender difficulty: {e}, falling back to original method")
            # Fall back to original method if recommender method fails
            return await self._calculate_optimal_difficulty_original(student_id, subject, skill_id, subskill_id)
    
    async def _calculate_optimal_difficulty_original(self, student_id, subject, skill_id, subskill_id):
        """
        Original difficulty calculation method as fallback when recommender is not available
        or fails to calculate difficulty
        """
        try:
            # Simple implementation - return a medium difficulty level
            # This is a fallback when the recommender isn't available
            logger.info(f"Using fallback difficulty calculation for student {student_id}, skill {skill_id}")
            
            # Get reviews for this student/skill (if any)
            all_reviews = await self.cosmos_db.get_problem_reviews(
                student_id=student_id,
                skill_id=skill_id,
                subskill_id=subskill_id
            )
            
            # Calculate average score if we have reviews
            if all_reviews:
                # Calculate average score
                total_score = 0
                count = 0
                for review in all_reviews:
                    if isinstance(review.get("score"), (int, float)):
                        total_score += float(review["score"])
                        count += 1
                    elif isinstance(review.get("evaluation", {}).get("score"), (int, float, str)):
                        score_value = review["evaluation"]["score"]
                        if isinstance(score_value, str):
                            try:
                                score_value = float(score_value)
                            except ValueError:
                                continue
                        total_score += float(score_value)
                        count += 1
                
                if count > 0:
                    avg_score = total_score / count
                    
                    # Adjust difficulty based on average score
                    # Higher scores -> higher difficulty (challenging but achievable)
                    # Target success rate is 0.85 (85%)
                    if avg_score / 10 > self.target_success_rate + 0.1:
                        # Student is doing well, increase difficulty
                        optimal_difficulty = 7.0
                    elif avg_score / 10 < self.target_success_rate - 0.1:
                        # Student is struggling, decrease difficulty
                        optimal_difficulty = 3.0
                    else:
                        # Student is in the sweet spot
                        optimal_difficulty = 5.0
                    
                    logger.info(f"Calculated difficulty based on {count} reviews: {optimal_difficulty:.2f}")
                    return optimal_difficulty
            
            # Default to medium difficulty when no data is available
            logger.info("No review data available, using default medium difficulty")
            return 5.0
            
        except Exception as e:
            logger.error(f"Error in fallback difficulty calculation: {e}")
            # Return medium difficulty as a safe default
            return 5.0
    
    async def calculate_poisson_probability(self, days_since_review, lambda_param):
        """
        Calculate the Poisson cumulative distribution function
        
        This is a simplified implementation of the Poisson CDF
        """
        # Simple approximation - linear relationship up to lambda value
        if days_since_review < 0:
            return 0.0
        
        # Calculate the probability - simple linear approach
        probability = min(days_since_review / lambda_param, 1.0)
        return probability
    
    async def get_problem_review_history(self, student_id, problem_id):
        """
        Get review history for a specific problem
        
        Filters problem reviews by problem_id
        """
        # Get all reviews for this student
        all_reviews = await self.cosmos_db.get_problem_reviews(
            student_id=student_id
        )
        
        # Filter to just reviews for this problem
        problem_reviews = [
            review for review in all_reviews 
            if review.get("problem_id") == problem_id or 
               (review.get("problem_content", {}) or {}).get("problem_id") == problem_id
        ]
        
        return problem_reviews
    
    async def calculate_review_probability(self, student_id, problem_id):
        """
        Calculate probability that a problem should be reviewed based on Poisson CDF
        
        For new problems, returns 1.0 (highest priority)
        For previously seen problems, uses spaced repetition model based on last score
        """
        # Get reviews for this specific problem
        problem_reviews = await self.get_problem_review_history(
            student_id=student_id,
            problem_id=problem_id
        )
        
        if not problem_reviews:
            # Never reviewed - highest priority
            return 1.0, True, None
        
        # Sort reviews by timestamp (most recent first)
        problem_reviews.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        latest_review = problem_reviews[0]
        
        # Calculate days since last review
        latest_timestamp = datetime.fromisoformat(latest_review.get("timestamp", ""))
        days_since_review = (datetime.utcnow() - latest_timestamp).days
        
        # Get score from last review (handle different formats)
        latest_score = 0
        if isinstance(latest_review.get("score"), (int, float)):
            latest_score = float(latest_review["score"]) / 10  # Normalize to 0-1
        elif isinstance(latest_review.get("evaluation", {}).get("score"), (int, float, str)):
            score_value = latest_review["evaluation"]["score"]
            if isinstance(score_value, str):
                try:
                    score_value = float(score_value)
                except ValueError:
                    score_value = 0
            latest_score = float(score_value) / 10  # Normalize to 0-1
        
        # Set lambda based on performance
        if latest_score < 0.6:  # Below 60%
            lambda_param = self.sr_low_lambda
            logger.debug(f"Problem {problem_id}: Low score ({latest_score:.2f}), lambda={lambda_param}")
        elif latest_score < 0.9:  # 60-90%
            lambda_param = self.sr_medium_lambda
            logger.debug(f"Problem {problem_id}: Medium score ({latest_score:.2f}), lambda={lambda_param}")
        else:  # 90%+
            lambda_param = self.sr_high_lambda
            logger.debug(f"Problem {problem_id}: High score ({latest_score:.2f}), lambda={lambda_param}")
        
        # Calculate Poisson CDF probability
        try:
            # Try to use scipy if available
            from scipy.stats import poisson
            review_probability = poisson.cdf(days_since_review, lambda_param)
        except ImportError:
            # Fall back to our own implementation
            review_probability = await self.calculate_poisson_probability(days_since_review, lambda_param)
            
        logger.debug(f"Problem {problem_id}: days_since={days_since_review}, review_probability={review_probability:.2f}")
        return review_probability, False, latest_score
    
    async def select_optimal_problems(
        self,
        student_id,
        subject,
        unit_id,  # Added unit_id parameter
        skill_id,
        subskill_id,
        available_problems,
        count=5        
    ):
        """
        Select optimal problems using a two-stage approach:
        1. Filter to problems due for review (spaced repetition)
        2. Select problems with optimal difficulty
        
        Applies a 50% probability multiplier to previously seen problems
        to reduce the frequency of exact problem repetition.
        """
        if not available_problems:
            logger.warning("No available problems to select from")
            return []
                
        logger.info(f"Selecting {count} problems from {len(available_problems)} available problems")
        
        # Stage 1: Calculate review probability for each problem
        review_probabilities = []
        
        for problem in available_problems:
            problem_id = problem.get("id") or problem.get("problem_id")
            
            if not problem_id:
                # Generate a temporary ID if none exists
                problem_id = f"temp_{hash(str(problem))}"
                problem["problem_id"] = problem_id
                logger.warning(f"Problem missing ID, using temporary ID: {problem_id}")
            
            # Try to extract unit_id from problem metadata if not provided
            if not unit_id and "metadata" in problem and "unit" in problem["metadata"]:
                unit_id = problem["metadata"]["unit"].get("id")
            
            # Calculate review probability
            try:
                probability, is_new, last_score = await self.calculate_review_probability(
                    student_id=student_id,
                    problem_id=problem_id
                )
                
                # Apply 50% multiplier to previously seen problems as specified
                if not is_new:
                    probability *= 0.5
                    logger.debug(f"Applied 50% multiplier to previously seen problem {problem_id}, new probability: {probability:.2f}")
                
                review_probabilities.append({
                    "problem": problem,
                    "probability": probability,
                    "is_new": is_new,
                    "last_score": last_score
                })
            except Exception as e:
                logger.error(f"Error calculating review probability for problem {problem_id}: {e}")
                import traceback
                logger.error(traceback.format_exc())
        
        # Sort by probability (highest first)
        review_probabilities.sort(key=lambda x: x["probability"], reverse=True)
        
        logger.info(f"Calculated probabilities for {len(review_probabilities)} problems")
        for i, item in enumerate(review_probabilities[:5]):
            logger.debug(f"Top probability {i+1}: {item['probability']:.2f}, new: {item['is_new']}")
        
        # Stage 2: From the problems due for review, select by optimal difficulty
        
        # Calculate student's optimal difficulty
        optimal_difficulty = await self.calculate_optimal_difficulty(
            student_id=student_id,
            subject=subject,
            skill_id=skill_id,
            subskill_id=subskill_id,
            unit_id=unit_id  # Pass the unit_id
        )
        
        logger.info(f"Optimal difficulty for student {student_id}, skill {skill_id}: {optimal_difficulty:.2f}")
        
        # Select top problems by review probability
        # We'll select more than needed, then filter by difficulty
        candidate_count = min(len(review_probabilities), count * 2)
        candidate_problems = review_probabilities[:candidate_count]
        
        # Calculate difficulty distance for each candidate
        for candidate in candidate_problems:
            problem = candidate["problem"]
            difficulty = problem.get("metadata", {}).get("difficulty", 5.0)
            candidate["difficulty_distance"] = abs(difficulty - optimal_difficulty)
            logger.debug(f"Problem {problem.get('problem_id')}: difficulty={difficulty}, distance={candidate['difficulty_distance']:.2f}")
        
        # Final sort:
        # 1. First prioritize new problems (never seen before)
        # 2. Then sort by difficulty match
        candidate_problems.sort(key=lambda x: (not x["is_new"], x["difficulty_distance"]))
        
        # Return final selection
        selected_problems = [item["problem"] for item in candidate_problems[:count]]
        
        logger.info(f"Selected {len(selected_problems)} problems")
        return selected_problems