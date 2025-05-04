# backend/app/db/cosmos_db.py

from azure.cosmos import CosmosClient, PartitionKey
from datetime import datetime
from typing import Dict, List, Any, Optional
import os
from ..core.config import settings

class CosmosDBService:
    def __init__(self):
        endpoint = settings.COSMOS_ENDPOINT
        key = settings.COSMOS_KEY
        database_name = settings.COSMOS_DATABASE
        
        self.client = CosmosClient(endpoint, key)
        self.database = self.client.create_database_if_not_exists(id=database_name)
        
        # Initialize containers
        self.competencies = self.database.create_container_if_not_exists(
            id="competencies",
            partition_key=PartitionKey(path="/student_id"),
            unique_key_policy={'uniqueKeys': [{'paths': ['/subject', '/skill_id', '/subskill_id']}]}
        )
        
        self.attempts = self.database.create_container_if_not_exists(
            id="attempts",
            partition_key=PartitionKey(path="/student_id")
        )

        self.conversations = self.database.create_container_if_not_exists(
            id="conversations",
            partition_key=PartitionKey(path="/student_id"),
            unique_key_policy={
                'uniqueKeys': [
                    {'paths': ['/student_id', '/session_id']}
                ]
            }
        )

        self.reviews = self.database.create_container_if_not_exists(
                id="reviews",
                partition_key=PartitionKey(path="/student_id")
            )

        # Add to CosmosDBService.__init__
        self.cached_problems = self.database.create_container_if_not_exists(
            id="cached_problems",
            partition_key=PartitionKey(path="/subject"),
            unique_key_policy={'uniqueKeys': [{'paths': ['/skill_id', '/subskill_id', '/problem_id']}]}
        )

        self.p5js_code_snippets = self.database.create_container_if_not_exists(
            id="p5js_code_snippets",
            partition_key=PartitionKey(path="/student_id"),
            unique_key_policy={'uniqueKeys': [{'paths': ['/title']}]}
        )

    async def save_conversation_message(
        self,
        session_id: str,
        student_id: int,
        speaker: str,  # 'self' or 'gemini'
        message: str,
        timestamp: str
    ) -> Dict[str, Any]:
        message_data = {
            "id": f"{student_id}_{session_id}_{timestamp}",  # Updated id format
            "session_id": session_id,
            "student_id": student_id,
            "speaker": speaker,
            "message": message,
            "timestamp": timestamp
        }
        
        return self.conversations.create_item(body=message_data)

    async def get_competency(
        self,
        student_id: int,
        subject: str,
        skill_id: str,
        subskill_id: str
    ) -> Dict[str, Any]:
        query = f"""
        SELECT * FROM c 
        WHERE c.student_id = @student_id 
        AND c.subject = @subject 
        AND c.skill_id = @skill_id 
        AND c.subskill_id = @subskill_id
        """
        
        params = [
            {"name": "@student_id", "value": student_id},
            {"name": "@subject", "value": subject},
            {"name": "@skill_id", "value": skill_id},
            {"name": "@subskill_id", "value": subskill_id}
        ]
        
        results = list(self.competencies.query_items(
            query=query,
            parameters=params,
            enable_cross_partition_query=True
        ))
        
        if not results:
            return {
                "student_id": student_id,
                "subject": subject,
                "skill_id": skill_id,
                "subskill_id": subskill_id,
                "current_score": 0,
                "credibility": 0,
                "total_attempts": 0,
                "last_updated": None
            }
        
        return results[0]

    async def update_competency(
        self,
        student_id: int,
        subject: str,
        skill_id: str,
        subskill_id: str,
        score: float,
        credibility: float,
        total_attempts: int
    ) -> Dict[str, Any]:
        competency_data = {
            "id": f"{student_id}_{subject}_{skill_id}_{subskill_id}",
            "student_id": student_id,
            "subject": subject,
            "skill_id": skill_id,
            "subskill_id": subskill_id,
            "current_score": score,
            "credibility": credibility,
            "total_attempts": total_attempts,
            "last_updated": datetime.utcnow().isoformat()
        }
        
        return self.competencies.upsert_item(body=competency_data)

    async def save_attempt(
        self,
        student_id: int,
        subject: str,
        skill_id: str,
        subskill_id: str,
        score: float,
        analysis: str,
        feedback: str
    ) -> Dict[str, Any]:
        attempt_data = {
            "id": f"{student_id}_{datetime.utcnow().isoformat()}",
            "student_id": student_id,
            "subject": subject,
            "skill_id": skill_id,
            "subskill_id": subskill_id,
            "score": score,
            "analysis": analysis,
            "feedback": feedback,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        return self.attempts.create_item(body=attempt_data)

    async def save_cached_problem(self, subject, skill_id, subskill_id, problem_data):
        """
        Save a problem to the cached_problems container with a standardized format.
        
        Args:
            subject: The subject (e.g., 'mathematics')
            skill_id: The ID of the skill
            subskill_id: The ID of the subskill
            problem_data: The full problem data object
        """
        try:
            # Generate a unique ID with timestamp and UUID for uniqueness
            import uuid
            from datetime import datetime
            timestamp_precise = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
            unique_id = f"{subject}_{skill_id}_{subskill_id}_{timestamp_precise}_{uuid.uuid4()}"
            
            # Ensure problem_data has proper IDs
            problem_data["id"] = unique_id
            problem_data["problem_id"] = unique_id
            
            # Ensure metadata exists and has required fields
            if "metadata" not in problem_data:
                problem_data["metadata"] = {}
            
            if "subject" not in problem_data["metadata"]:
                problem_data["metadata"]["subject"] = subject
                
            # Create the standardized document that will contain the problem
            document = {
                "id": unique_id,
                "problem_id": unique_id,
                "type": "cached_problem",
                "subject": subject,
                "skill_id": skill_id,
                "subskill_id": subskill_id,
                "difficulty": problem_data.get("metadata", {}).get("difficulty", 5.0),
                "timestamp": timestamp_precise,
                "problem_data": problem_data
            }
            
            # Save to cached_problems container
            self.cached_problems.create_item(body=document)
            print(f"[DEBUG] Saved cached problem {unique_id} for {subject}/{skill_id}/{subskill_id}")
            
            return unique_id
            
        except Exception as e:
            print(f"[ERROR] Failed to save cached problem: {str(e)}")
            import traceback
            print(traceback.format_exc())
            return None

    async def get_cached_problems(
        self,
        subject: str,
        skill_id: str,
        subskill_id: str
    ) -> List[Dict[str, Any]]:
        """Get cached problems for a specific skill/subskill combination"""
        query = """
        SELECT c.problem_data
        FROM c
        WHERE c.subject = @subject
        AND c.skill_id = @skill_id
        AND c.subskill_id = @subskill_id
        """
        
        params = [
            {"name": "@subject", "value": subject},
            {"name": "@skill_id", "value": skill_id},
            {"name": "@subskill_id", "value": subskill_id}
        ]
        
        try:
            items = list(self.cached_problems.query_items(
                query=query,
                parameters=params,
                enable_cross_partition_query=True
            ))
            
            # Extract problem_data from items
            return [item.get("problem_data", {}) for item in items]
        except Exception as e:
            print(f"Error getting cached problems: {str(e)}")
            return []

    async def get_student_attempts(
        self,
        student_id: int,
        subject: Optional[str] = None,
        skill_id: Optional[str] = None,
        subskill_id: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        query = "SELECT * FROM c WHERE c.student_id = @student_id"
        params = [{"name": "@student_id", "value": student_id}]
        
        if subject:
            query += " AND c.subject = @subject"
            params.append({"name": "@subject", "value": subject})
        if skill_id:
            query += " AND c.skill_id = @skill_id"
            params.append({"name": "@skill_id", "value": skill_id})
        if subskill_id:
            query += " AND c.subskill_id = @subskill_id"
            params.append({"name": "@subskill_id", "value": subskill_id})
            
        query += " ORDER BY c.timestamp DESC OFFSET 0 LIMIT @limit"
        params.append({"name": "@limit", "value": limit})
        
        return list(self.attempts.query_items(
            query=query,
            parameters=params,
            enable_cross_partition_query=True
        ))
    
    async def get_session_conversation(
        self,
        session_id: str,
        student_id: int  # Added student_id parameter
    ) -> List[Dict[str, Any]]:
        query = """
        SELECT * FROM c 
        WHERE c.session_id = @session_id 
        ORDER BY c.timestamp
        """
        
        params = [
            {"name": "@session_id", "value": session_id}
        ]
        
        # Now we can query within the student's partition
        return list(self.conversations.query_items(
            query=query,
            parameters=params,
            partition_key=student_id  # More efficient query using partition key
        ))
    
    async def get_student_recent_conversations(
        self,
        student_id: int,
        session_limit: int = 5
    ) -> List[Dict[str, Any]]:
        """Get recent conversations for a student across sessions"""
        query = """
        SELECT DISTINCT c.session_id,
                c.timestamp,
                ARRAY_AGG(c) AS messages
        FROM c
        WHERE c.student_id = @student_id
        GROUP BY c.session_id, c.timestamp
        ORDER BY c.timestamp DESC
        OFFSET 0 LIMIT @limit
        """
        
        params = [
            {"name": "@student_id", "value": student_id},
            {"name": "@limit", "value": session_limit}
        ]
        
        return list(self.conversations.query_items(
            query=query,
            parameters=params,
            partition_key=student_id
        ))
    
    async def get_student_conversation_summary(
        self,
        student_id: int,
        start_date: str = None,
        end_date: str = None
    ) -> Dict[str, Any]:
        """Get summary statistics for student conversations"""
        query = """
        SELECT 
            COUNT(1) as total_messages,
            COUNT(DISTINCT c.session_id) as total_sessions,
            AVG(LENGTH(c.message)) as avg_message_length
        FROM c
        WHERE c.student_id = @student_id
        """
        
        params = [{"name": "@student_id", "value": student_id}]
        
        if start_date:
            query += " AND c.timestamp >= @start_date"
            params.append({"name": "@start_date", "value": start_date})
        if end_date:
            query += " AND c.timestamp <= @end_date"
            params.append({"name": "@end_date", "value": end_date})
            
        results = list(self.conversations.query_items(
            query=query,
            parameters=params,
            partition_key=student_id
        ))
        
        return results[0] if results else None
    
    async def save_problem_review(
        self,
        student_id: int,
        subject: str,
        skill_id: str,
        subskill_id: str,
        problem_id: str,
        review_data: Dict[str, Any],
        problem_content: Dict[str, Any] = None  # New parameter
    ) -> Dict[str, Any]:
        """Save a structured review of a student's problem solution."""
        timestamp = datetime.utcnow().isoformat()

        # Log all input parameters
        print(f"[DEBUG] save_problem_review called with:")
        print(f"[DEBUG]   - student_id: {student_id}")
        print(f"[DEBUG]   - subject: {subject}")
        print(f"[DEBUG]   - skill_id: {skill_id}")
        print(f"[DEBUG]   - subskill_id: {subskill_id}")
        print(f"[DEBUG]   - problem_id: {problem_id}")
        print(f"[DEBUG]   - problem_content present: {'yes' if problem_content else 'no'}")
        
        if problem_content:
            print(f"[DEBUG]   - problem_content keys: {problem_content.keys()}")
        else:
            print(f"[DEBUG]   - problem_content is None or empty")
        
        # Preserve the original structure but normalize for storage
        review_item = {
            "id": f"{student_id}_{problem_id}_{timestamp}",
            "student_id": student_id,
            "subject": subject,
            "skill_id": skill_id,
            "subskill_id": subskill_id,
            "problem_id": problem_id,
            "timestamp": timestamp,
            # Store the problem content
            "problem_content": problem_content,
            # Store all the raw data directly
            "full_review": review_data,
            # For easier querying, extract key fields
            "observation": review_data.get("observation", {}),
            "analysis": review_data.get("analysis", {}),
            "evaluation": review_data.get("evaluation", {}),
            "feedback": review_data.get("feedback", {}),
            # Extract the score for easier querying
            "score": float(review_data.get("evaluation", {}).get("score", 0)) 
                if isinstance(review_data.get("evaluation"), dict) 
                else float(review_data.get("evaluation", 0))
        }
        
        return self.reviews.create_item(body=review_item)

    async def get_problem_reviews(
        self,
        student_id: int,
        subject: Optional[str] = None,
        skill_id: Optional[str] = None, 
        subskill_id: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get problem reviews for a student with optional filters."""
        query = "SELECT * FROM c WHERE c.student_id = @student_id"
        params = [{"name": "@student_id", "value": student_id}]
        
        if subject:
            query += " AND c.subject = @subject"
            params.append({"name": "@subject", "value": subject})
        if skill_id:
            query += " AND c.skill_id = @skill_id"
            params.append({"name": "@skill_id", "value": skill_id})
        if subskill_id:
            query += " AND c.subskill_id = @subskill_id"
            params.append({"name": "@subskill_id", "value": subskill_id})
            
        query += " ORDER BY c.timestamp DESC OFFSET 0 LIMIT @limit"
        params.append({"name": "@limit", "value": limit})
        
        return list(self.reviews.query_items(
            query=query,
            parameters=params,
            enable_cross_partition_query=True
        ))

    async def get_review_summary(
        self,
        student_id: int,
        subject: Optional[str] = None,
        days: int = 30
    ) -> Dict[str, Any]:
        """Get summary statistics for problem reviews."""
        from datetime import datetime, timedelta
        
        start_date = (datetime.utcnow() - timedelta(days=days)).isoformat()
        
        query = """
        SELECT 
            AVG(c.score) as avg_score,
            COUNT(1) as total_reviews,
            COUNT(IIF(c.score >= 8, 1, null)) as high_score_count,
            COUNT(IIF(c.score >= 5 AND c.score < 8, 1, null)) as medium_score_count,
            COUNT(IIF(c.score < 5, 1, null)) as low_score_count
        FROM c
        WHERE c.student_id = @student_id
        AND c.timestamp >= @start_date
        """
        
        params = [
            {"name": "@student_id", "value": student_id},
            {"name": "@start_date", "value": start_date}
        ]
        
        if subject:
            query += " AND c.subject = @subject"
            params.append({"name": "@subject", "value": subject})
            
        results = list(self.reviews.query_items(
            query=query,
            parameters=params,
            enable_cross_partition_query=True
        ))
        
        return results[0] if results else None

    async def get_attempts_by_time_range(
        self,
        student_id: int,
        subject: Optional[str] = None,
        skill_id: Optional[str] = None,
        subskill_id: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get attempts within a specific time range with filtering options"""
        query = "SELECT * FROM c WHERE c.student_id = @student_id"
        params = [{"name": "@student_id", "value": student_id}]
        
        if subject:
            query += " AND c.subject = @subject"
            params.append({"name": "@subject", "value": subject})
        if skill_id:
            query += " AND c.skill_id = @skill_id"
            params.append({"name": "@skill_id", "value": skill_id})
        if subskill_id:
            query += " AND c.subskill_id = @subskill_id"
            params.append({"name": "@subskill_id", "value": subskill_id})
        if start_date:
            query += " AND c.timestamp >= @start_date"
            params.append({"name": "@start_date", "value": start_date})
        if end_date:
            query += " AND c.timestamp <= @end_date"
            params.append({"name": "@end_date", "value": end_date})
            
        query += " ORDER BY c.timestamp DESC"
        
        return list(self.attempts.query_items(
            query=query,
            parameters=params,
            enable_cross_partition_query=True
        ))

    async def get_subject_competencies(
        self,
        student_id: int,
        subject: str
    ) -> List[Dict[str, Any]]:
        """Get all competencies for a specific subject"""
        query = """
        SELECT * FROM c 
        WHERE c.student_id = @student_id 
        AND c.subject = @subject
        """
        
        params = [
            {"name": "@student_id", "value": student_id},
            {"name": "@subject", "value": subject}
        ]
        
        return list(self.competencies.query_items(
            query=query,
            parameters=params,
            enable_cross_partition_query=True
        ))

    async def get_aggregated_attempts_by_time(
        self,
        student_id: int,
        subject: Optional[str] = None,
        grouping: str = "day",  # day, week, month
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get aggregated attempt data grouped by time periods"""
        # Cosmos DB doesn't support complex aggregations natively,
        # so we'll fetch the data and aggregate it in Python
        
        attempts = await self.get_attempts_by_time_range(
            student_id=student_id,
            subject=subject,
            start_date=start_date,
            end_date=end_date
        )
        
        from datetime import datetime
        from collections import defaultdict
        
        # Group by time period
        grouped_data = defaultdict(lambda: {"count": 0, "scores": [], "subjects": set()})
        
        for attempt in attempts:
            dt = datetime.fromisoformat(attempt["timestamp"])
            
            if grouping == "day":
                key = dt.strftime("%Y-%m-%d")
            elif grouping == "week":
                # ISO week format: YYYY-WNN (year-week number)
                key = f"{dt.year}-W{dt.isocalendar()[1]:02d}"
            elif grouping == "month":
                key = dt.strftime("%Y-%m")
            else:
                key = dt.strftime("%Y-%m-%d")  # Default to day
                
            grouped_data[key]["count"] += 1
            grouped_data[key]["scores"].append(attempt["score"])
            grouped_data[key]["subjects"].add(attempt["subject"])
        
        # Calculate averages and format result
        result = []
        for period, data in sorted(grouped_data.items()):
            avg_score = sum(data["scores"]) / len(data["scores"]) if data["scores"] else 0
            result.append({
                "period": period,
                "count": data["count"],
                "average_score": avg_score,
                "subjects": list(data["subjects"])
            })
        
        return result

    async def get_competency_history(
        self,
        student_id: int,
        subject: str,
        skill_id: Optional[str] = None,
        subskill_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Reconstruct competency history based on attempts data"""
        # This is an approximation since we don't store historical competency values
        
        attempts = await self.get_attempts_by_time_range(
            student_id=student_id,
            subject=subject,
            skill_id=skill_id,
            subskill_id=subskill_id
        )
        
        # Sort by timestamp (oldest first)
        attempts.sort(key=lambda x: x["timestamp"])
        
        # Reconstruct progression using a simplified model
        history = []
        running_sum = 0
        default_score = 5.0  # Same as in CompetencyService
        
        for i, attempt in enumerate(attempts):
            # Simple running average calculation
            running_sum += attempt["score"]
            avg_score = running_sum / (i + 1)
            
            # Simple credibility calculation based on attempts count
            credibility = min(1.0, (i + 1) / 15)  # Using 15 as full credibility standard
            
            # Blend with default score based on credibility
            blended_score = (avg_score * credibility) + (default_score * (1 - credibility))
            
            history.append({
                "timestamp": attempt["timestamp"],
                "attempt_number": i + 1,
                "attempt_score": attempt["score"],
                "calculated_competency": blended_score,
                "credibility": credibility
            })
        
        return history

    async def get_competency_distribution(
        self,
        student_id: int,
        subject: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get competency distribution statistics"""
        query = "SELECT c.current_score, c.credibility, c.subject, c.skill_id, c.subskill_id FROM c WHERE c.student_id = @student_id"
        params = [{"name": "@student_id", "value": student_id}]
        
        if subject:
            query += " AND c.subject = @subject"
            params.append({"name": "@subject", "value": subject})
        
        competencies = list(self.competencies.query_items(
            query=query,
            parameters=params,
            enable_cross_partition_query=True
        ))
        
        # Filter for competencies with reasonable credibility
        credible_competencies = [c for c in competencies if c["credibility"] > 0.3]
        
        # Calculate distribution
        score_ranges = {
            "beginner": [0, 3],
            "developing": [3, 5],
            "proficient": [5, 7],
            "advanced": [7, 9],
            "mastery": [9, 10]
        }
        
        distribution = {level: 0 for level in score_ranges}
        subject_distribution = {}
        
        for comp in credible_competencies:
            score = comp["current_score"]
            subject = comp["subject"]
            
            # Add to overall distribution
            for level, (min_score, max_score) in score_ranges.items():
                if min_score <= score < max_score:
                    distribution[level] += 1
                    break
            
            # Add to subject-specific distribution
            if subject not in subject_distribution:
                subject_distribution[subject] = {level: 0 for level in score_ranges}
                
            for level, (min_score, max_score) in score_ranges.items():
                if min_score <= score < max_score:
                    subject_distribution[subject][level] += 1
                    break
        
        return {
            "student_id": student_id,
            "overall_distribution": distribution,
            "subject_distribution": subject_distribution,
            "total_competencies": len(credible_competencies)
        }

    async def get_review_patterns(
        self,
        student_id: int,
        subject: Optional[str] = None,
        recent_count: int = 100
    ) -> Dict[str, Any]:
        """Analyze patterns in problem reviews"""
        reviews = await self.get_problem_reviews(
            student_id=student_id,
            subject=subject,
            limit=recent_count
        )
        
        if not reviews:
            return {
                "student_id": student_id,
                "subject": subject,
                "patterns": {}
            }
        
        # Extract feedback patterns (simplified example)
        from collections import Counter
        
        # Count common terms in feedback (very basic NLP approach)
        feedback_text = " ".join([
            str(review.get("feedback", {}).get("guidance", "")) + " " +
            str(review.get("feedback", {}).get("encouragement", ""))
            for review in reviews
        ]).lower()
        
        # Extract some basic word patterns (this would be enhanced in a real NLP system)
        words = feedback_text.split()
        word_counts = Counter(words)
        
        # Analyze score patterns
        scores = [review["score"] for review in reviews]
        avg_score = sum(scores) / len(scores) if scores else 0
        
        # Detect improvements or regressions
        if len(scores) >= 5:
            first_half = scores[len(scores)//2:]
            second_half = scores[:len(scores)//2]
            avg_first = sum(first_half) / len(first_half)
            avg_second = sum(second_half) / len(second_half)
            trend = avg_second - avg_first
        else:
            trend = 0
        
        # Identify most frequent subskills in reviews
        subskill_counts = Counter([f"{review['subject']}_{review['subskill_id']}" for review in reviews])
        most_common_subskills = subskill_counts.most_common(5)
        
        return {
            "student_id": student_id,
            "subject": subject,
            "patterns": {
                "average_score": avg_score,
                "score_trend": trend,
                "trend_direction": "Improving" if trend > 0.5 else "Declining" if trend < -0.5 else "Stable",
                "common_feedback_terms": {word: count for word, count in word_counts.most_common(10) if len(word) > 3},
                "most_reviewed_subskills": most_common_subskills
            }
        }

    async def save_p5js_code(
        self,
        student_id: int,
        title: str,
        code: str,
        description: str = "",
        tags: List[str] = None,
        unit_id: str = None,
        unit_title: str = None,
        skill_id: str = None,
        skill_description: str = None,
        subskill_id: str = None,
        subskill_description: str = None
    ) -> Dict[str, Any]:
        """
        Save a p5js code snippet to the database with proper sanitization.
        
        Args:
            student_id: The student's ID
            title: Title for the code snippet
            code: The p5js code content (will be stored as a string, never executed)
            description: Optional description for the code
            tags: Optional list of tags for categorization
            unit_id: Optional unit ID from syllabus
            unit_title: Optional unit title from syllabus
            skill_id: Optional skill ID from syllabus
            skill_description: Optional skill description from syllabus
            subskill_id: Optional subskill ID from syllabus
            subskill_description: Optional subskill description from syllabus
        """
        # Generate a unique ID with timestamp for uniqueness
        import uuid
        from datetime import datetime
        timestamp = datetime.utcnow().isoformat()
        snippet_id = f"{student_id}_{uuid.uuid4()}"
        
        # Create the code snippet document - using proper sanitization
        document = {
            "id": snippet_id,
            "student_id": student_id,
            "title": title,
            "description": description,
            "code": code,  # Store as plain text, never execute
            "tags": tags or [],
            "created_at": timestamp,
            "updated_at": timestamp,
            "type": "p5js_code_snippet",
            # Add syllabus metadata
            "unit_id": unit_id,
            "unit_title": unit_title,
            "skill_id": skill_id, 
            "skill_description": skill_description,
            "subskill_id": subskill_id,
            "subskill_description": subskill_description
        }
        
        try:
            result = self.p5js_code_snippets.create_item(body=document)
            return result
        except Exception as e:
            print(f"Error saving p5js code: {str(e)}")
            raise

    async def get_student_p5js_codes(
        self,
        student_id: int,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get all p5js code snippets for a student"""
        query = """
        SELECT * FROM c 
        WHERE c.student_id = @student_id 
        AND c.type = 'p5js_code_snippet'
        ORDER BY c.updated_at DESC
        OFFSET 0 LIMIT @limit
        """
        
        params = [
            {"name": "@student_id", "value": student_id},
            {"name": "@limit", "value": limit}
        ]
        
        return list(self.p5js_code_snippets.query_items(
            query=query,
            parameters=params,
            partition_key=student_id
        ))

    async def get_p5js_code_by_id(
        self,
        student_id: int,
        snippet_id: str
    ) -> Dict[str, Any]:
        """Get a specific p5js code snippet by ID"""
        try:
            result = self.p5js_code_snippets.read_item(
                item=snippet_id,
                partition_key=student_id
            )
            return result
        except Exception as e:
            print(f"Error retrieving p5js code: {str(e)}")
            return None

    async def update_p5js_code(
        self,
        student_id: int,
        snippet_id: str,
        title: str = None,
        code: str = None,
        description: str = None,
        tags: List[str] = None,
        unit_id: str = None,
        unit_title: str = None,
        skill_id: str = None,
        skill_description: str = None,
        subskill_id: str = None,
        subskill_description: str = None
    ) -> Dict[str, Any]:
        """Update an existing p5js code snippet"""
        try:
            # First get the existing item
            snippet = await self.get_p5js_code_by_id(student_id, snippet_id)
            if not snippet:
                raise ValueError(f"Code snippet {snippet_id} not found")
                
            # Update only the provided fields
            if title is not None:
                snippet["title"] = title
            if code is not None:
                snippet["code"] = code
            if description is not None:
                snippet["description"] = description
            if tags is not None:
                snippet["tags"] = tags
            # Update syllabus metadata fields if provided
            if unit_id is not None:
                snippet["unit_id"] = unit_id
            if unit_title is not None:
                snippet["unit_title"] = unit_title
            if skill_id is not None:
                snippet["skill_id"] = skill_id
            if skill_description is not None:
                snippet["skill_description"] = skill_description
            if subskill_id is not None:
                snippet["subskill_id"] = subskill_id
            if subskill_description is not None:
                snippet["subskill_description"] = subskill_description
                
            # Update the timestamp
            snippet["updated_at"] = datetime.utcnow().isoformat()
            
            # Save the updated document
            result = self.p5js_code_snippets.replace_item(
                item=snippet_id,
                body=snippet
            )
            return result
        except Exception as e:
            print(f"Error updating p5js code: {str(e)}")
            raise

    async def delete_p5js_code(
        self,
        student_id: int,
        snippet_id: str
    ) -> bool:
        """Delete a p5js code snippet"""
        try:
            self.p5js_code_snippets.delete_item(
                item=snippet_id,
                partition_key=student_id
            )
            return True
        except Exception as e:
            print(f"Error deleting p5js code: {str(e)}")
            return False