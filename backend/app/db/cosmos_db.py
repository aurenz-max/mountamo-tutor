# backend/app/db/cosmos_db.py

from azure.cosmos import CosmosClient, PartitionKey
from azure.cosmos.exceptions import CosmosResourceExistsError, CosmosResourceNotFoundError
from datetime import datetime
from typing import Dict, List, Any, Optional
import os
import uuid
from ..core.config import settings
import logging

logger = logging.getLogger(__name__)

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
            unique_key_policy={'uniqueKeys': [{'paths': ['/student_id', '/subject', '/skill_id', '/subskill_id']}]}
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

        self.content_packages = self.database.create_container_if_not_exists(
            id="content_packages",
            partition_key=PartitionKey(path="/partition_key"),
            unique_key_policy={'uniqueKeys': [{'paths': ['/subject', '/skill', '/subskill']}]}
        )

        # 🆕 NEW: Visualize concepts container for storing generated visualizations
        self.visualize_concepts = self.database.create_container_if_not_exists(
            id="visualize_concepts",
            partition_key=PartitionKey(path="/subskill_id"),
            unique_key_policy={'uniqueKeys': [{'paths': ['/subskill_id', '/section_heading']}]}
        )

        # 🔥 NEW: Student mapping container for linking Firebase users to student records
        self.student_mappings = self.database.create_container_if_not_exists(
            id="student_mappings",
            partition_key=PartitionKey(path="/firebase_uid"),
            unique_key_policy={'uniqueKeys': [{'paths': ['/email']}]}
        )

        # 🆕 NEW: Daily plans container for persistent daily activity recommendations
        self.daily_plans = self.database.create_container_if_not_exists(
            id="daily_plans",
            partition_key=PartitionKey(path="/student_id"),
            unique_key_policy={'uniqueKeys': [{'paths': ['/student_id', '/date']}]}
        )

        # 🆕 NEW: Assessments container for persistent assessment storage
        self.assessments = self.database.create_container_if_not_exists(
            id="assessments",
            partition_key=PartitionKey(path="/student_id"),
            unique_key_policy={'uniqueKeys': [{'paths': ['/assessment_id']}]}
        )

        # 🆕 NEW: Context Primitives container for dynamic problem variety
        self.context_primitives = self.database.create_container_if_not_exists(
            id="context_primitives",
            partition_key=PartitionKey(path="/subject"),
            unique_key_policy={'uniqueKeys': [{'paths': ['/subskill_id']}]}
        )

    # ============================================================================
    # 🔥 NEW: STUDENT MAPPING METHODS
    # ============================================================================

    async def create_student_mapping(
        self,
        firebase_uid: str,
        email: str,
        display_name: str
    ) -> Dict[str, Any]:
        """Create student mapping for a new Firebase user"""
        try:
            # Check if mapping already exists
            existing_mapping = await self.get_student_mapping(firebase_uid)
            if existing_mapping:
                logger.info(f"Student mapping already exists for {email}")
                return existing_mapping
            
            # Generate a proper UUID-based student_id
            student_uuid = str(uuid.uuid4())
            # For backward compatibility, also generate a numeric student_id
            numeric_student_id = await self._generate_unique_numeric_student_id()
            
            timestamp = datetime.utcnow().isoformat()
            
            mapping_data = {
                "id": str(uuid.uuid4()),  # Document ID
                "firebase_uid": firebase_uid,
                "student_id": numeric_student_id,  # Keep numeric for existing code
                "student_uuid": student_uuid,  # New UUID-based ID
                "email": email,
                "display_name": display_name,
                "created_at": timestamp,
                "updated_at": timestamp,
                "active": True
            }
            
            result = self.student_mappings.create_item(body=mapping_data)
            logger.info(f"Created student mapping for {email} -> student_id: {numeric_student_id}, uuid: {student_uuid}")
            
            return result
            
        except Exception as e:
            logger.error(f"Error creating student mapping: {str(e)}")
            raise

    async def get_student_mapping(self, firebase_uid: str) -> Optional[Dict[str, Any]]:
        """Get student mapping for a Firebase user"""
        try:
            query = """
            SELECT * FROM c 
            WHERE c.firebase_uid = @firebase_uid 
            AND c.active = true
            """
            
            params = [{"name": "@firebase_uid", "value": firebase_uid}]
            
            results = list(self.student_mappings.query_items(
                query=query,
                parameters=params,
                partition_key=firebase_uid
            ))
            
            return results[0] if results else None
            
        except Exception as e:
            logger.error(f"Error getting student mapping: {str(e)}")
            return None

    async def get_student_id_for_user(self, firebase_uid: str) -> Optional[int]:
        """Get numeric student_id for a Firebase user (for backward compatibility)"""
        mapping = await self.get_student_mapping(firebase_uid)
        return mapping["student_id"] if mapping else None

    async def get_student_uuid_for_user(self, firebase_uid: str) -> Optional[str]:
        """Get UUID-based student_id for a Firebase user (recommended for new code)"""
        mapping = await self.get_student_mapping(firebase_uid)
        return mapping.get("student_uuid") if mapping else None

    async def get_or_create_student_mapping(
        self,
        firebase_uid: str,
        email: str,
        display_name: str
    ) -> Dict[str, Any]:
        """Get existing mapping or create new one - integrates with your middleware"""
        mapping = await self.get_student_mapping(firebase_uid)
        if mapping:
            # Update last access time
            mapping["last_accessed"] = datetime.utcnow().isoformat()
            mapping["updated_at"] = datetime.utcnow().isoformat()
            self.student_mappings.upsert_item(body=mapping)
            return mapping
        else:
            return await self.create_student_mapping(firebase_uid, email, display_name)

    async def _generate_unique_numeric_student_id(self) -> int:
        """Generate a unique numeric student ID for backward compatibility"""
        try:
            # Get the highest existing student_id
            query = """
            SELECT VALUE MAX(c.student_id) 
            FROM c
            WHERE IS_NUMBER(c.student_id)
            """
            
            results = list(self.student_mappings.query_items(
                query=query,
                enable_cross_partition_query=True
            ))
            
            max_id = results[0] if results and results[0] is not None else 1000
            return max_id + 1
            
        except Exception as e:
            logger.error(f"Error generating student ID: {str(e)}")
            # Fallback to timestamp-based ID
            return int(datetime.utcnow().timestamp())

    # ============================================================================
    # USER VALIDATION HELPERS
    # ============================================================================

    async def validate_user_access_to_student(
        self, 
        firebase_uid: str, 
        requested_student_id: int
    ) -> bool:
        """Validate that a Firebase user has access to a specific student_id"""
        try:
            user_student_id = await self.get_student_id_for_user(firebase_uid)
            
            if not user_student_id:
                logger.warning(f"No student mapping found for user {firebase_uid}")
                return False
            
            # Check if user is accessing their own data
            if user_student_id == requested_student_id:
                return True
            
            # Check for admin access or development mode
            if getattr(settings, 'ALLOW_ANY_STUDENT_ACCESS', False):
                logger.warning(f"Allowing cross-student access in development mode")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error validating user access: {str(e)}")
            return False

    # ============================================================================
    # 🆕 DAILY PLANS PERSISTENCE METHODS
    # ============================================================================

    async def get_daily_plan(
        self,
        student_id: int,
        date: str,
        firebase_uid: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Get daily plan for a student on a specific date"""

        # Validate user access
        if firebase_uid:
            has_access = await self.validate_user_access_to_student(firebase_uid, student_id)
            if not has_access:
                raise PermissionError(f"User {firebase_uid} does not have access to student {student_id}")

        try:
            plan_id = f"{student_id}_{date}"
            logger.info(f"🔍 COSMOS DB LOOKUP - plan_id: '{plan_id}', partition_key: {student_id}")

            result = self.daily_plans.read_item(
                item=plan_id,
                partition_key=student_id  # Use integer, not string
            )

            logger.info(f"✅ FOUND EXISTING DAILY PLAN - Student: {student_id}, Date: {date}")
            return result

        except CosmosResourceNotFoundError as e:
            logger.info(f"❌ NO DAILY PLAN FOUND - Student: {student_id}, Date: {date}")
            logger.info(f"📋 Cosmos lookup details - plan_id: '{plan_id}', partition_key: {student_id}")
            return None
        except Exception as e:
            logger.error(f"💥 ERROR GETTING DAILY PLAN - Student: {student_id}, Date: {date}: {str(e)}")
            return None

    async def save_daily_plan(
        self,
        student_id: int,
        date: str,
        daily_plan_data: Dict[str, Any],
        firebase_uid: Optional[str] = None
    ) -> Dict[str, Any]:
        """Save a daily plan to Cosmos DB"""

        # Validate user access
        if firebase_uid:
            has_access = await self.validate_user_access_to_student(firebase_uid, student_id)
            if not has_access:
                raise PermissionError(f"User {firebase_uid} does not have access to student {student_id}")

        try:
            plan_id = f"{student_id}_{date}"
            timestamp = datetime.utcnow().isoformat()

            # Transform DailyPlan object to persistent schema
            plan_document = {
                "id": plan_id,
                "student_id": student_id,
                "date": date,
                "daily_theme": daily_plan_data.get("session_plan", {}).get("daily_theme"),
                "learning_objectives": daily_plan_data.get("session_plan", {}).get("learning_objectives", []),
                "session_plan": daily_plan_data.get("session_plan", {}),
                "activities": [],
                "personalization_source": daily_plan_data.get("personalization_source", "unknown"),
                "total_points": daily_plan_data.get("total_points", 0),
                "progress": daily_plan_data.get("progress", {}),
                "createdAt": timestamp,
                "updatedAt": timestamp,
                "firebase_uid": firebase_uid,
                "document_type": "daily_plan"
            }

            # Process activities and add completion status
            for activity in daily_plan_data.get("activities", []):
                activity_dict = activity.dict() if hasattr(activity, 'dict') else activity
                activity_dict["is_complete"] = False  # Add completion status
                plan_document["activities"].append(activity_dict)

            # Save to Cosmos DB
            result = self.daily_plans.upsert_item(body=plan_document)
            logger.info(f"Saved daily plan {plan_id} to Cosmos DB")

            return result

        except Exception as e:
            logger.error(f"Error saving daily plan: {str(e)}")
            raise

    async def update_activity_completion(
        self,
        student_id: int,
        date: str,
        activity_id: str,
        is_complete: bool = True,
        firebase_uid: Optional[str] = None
    ) -> bool:
        """Update completion status of a specific activity in the daily plan"""

        # Validate user access
        if firebase_uid:
            has_access = await self.validate_user_access_to_student(firebase_uid, student_id)
            if not has_access:
                raise PermissionError(f"User {firebase_uid} does not have access to student {student_id}")

        try:
            plan_id = f"{student_id}_{date}"

            # Get the existing plan
            plan = self.daily_plans.read_item(
                item=plan_id,
                partition_key=student_id
            )

            # Update the specific activity
            activity_found = False
            for activity in plan.get("activities", []):
                if activity.get("id") == activity_id:
                    activity["is_complete"] = is_complete
                    activity_found = True
                    logger.info(f"Updated activity {activity_id} completion to {is_complete}")
                    break

            if not activity_found:
                logger.warning(f"Activity {activity_id} not found in plan {plan_id}")
                return False

            # Update timestamp and save
            plan["updatedAt"] = datetime.utcnow().isoformat()
            self.daily_plans.upsert_item(body=plan)

            logger.info(f"Successfully updated activity completion in plan {plan_id}")
            return True

        except CosmosResourceNotFoundError:
            logger.warning(f"Daily plan {plan_id} not found for activity completion update")
            return False
        except Exception as e:
            logger.error(f"Error updating activity completion: {str(e)}")
            return False

    async def delete_daily_plan(
        self,
        student_id: int,
        date: str,
        firebase_uid: Optional[str] = None
    ) -> bool:
        """Delete a daily plan (used for force refresh)"""

        # Validate user access
        if firebase_uid:
            has_access = await self.validate_user_access_to_student(firebase_uid, student_id)
            if not has_access:
                raise PermissionError(f"User {firebase_uid} does not have access to student {student_id}")

        try:
            plan_id = f"{student_id}_{date}"

            self.daily_plans.delete_item(
                item=plan_id,
                partition_key=student_id
            )

            logger.info(f"Deleted daily plan {plan_id}")
            return True

        except CosmosResourceNotFoundError:
            logger.info(f"Daily plan {plan_id} not found for deletion")
            return True  # Already deleted
        except Exception as e:
            logger.error(f"Error deleting daily plan: {str(e)}")
            return False

    async def get_daily_plan_progress(
        self,
        student_id: int,
        date: str,
        firebase_uid: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get progress summary for a daily plan"""

        plan = await self.get_daily_plan(student_id, date, firebase_uid)
        if not plan:
            return {
                "completed_activities": 0,
                "total_activities": 0,
                "progress_percentage": 0.0,
                "points_earned": 0
            }

        activities = plan.get("activities", [])
        completed = sum(1 for activity in activities if activity.get("is_complete", False))
        total = len(activities)

        return {
            "completed_activities": completed,
            "total_activities": total,
            "progress_percentage": (completed / total * 100) if total > 0 else 0.0,
            "points_earned": sum(
                activity.get("points", 0)
                for activity in activities
                if activity.get("is_complete", False)
            )
        }

    async def query_items(self, container_name: str, query: str, parameters: List[Dict] = None) -> List[Dict]:
        """
        Generic method to query items from a Cosmos DB container
        """
        try:
            container = self.database.get_container_client(container_name)
            
            # Convert parameters to Cosmos DB format if provided
            query_params = []
            if parameters:
                for param in parameters:
                    query_params.append({
                        "name": param["name"],
                        "value": param["value"]
                    })
            
            # Execute query
            items = container.query_items(
                query=query,
                parameters=query_params if query_params else None,
                enable_cross_partition_query=True
            )
            
            # Convert to list and return
            results = list(items)
            logger.info(f"Query returned {len(results)} items from {container_name}")
            return results
            
        except Exception as e:
            logger.error(f"Error querying {container_name}: {str(e)}")
            raise

    async def get_user_profile_by_student_id(self, student_id: int) -> Optional[Dict]:
        """
        Get user profile by student_id
        """
        try:
            query = "SELECT * FROM c WHERE c.student_id = @student_id AND c.type = 'user_profile'"
            parameters = [{"name": "@student_id", "value": student_id}]
            
            results = await self.query_items(
                container_name="user_profiles",  # Adjust to your actual container name
                query=query,
                parameters=parameters
            )
            
            if results and len(results) > 0:
                return results[0]
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting user profile for student_id {student_id}: {str(e)}")
            return None

    # ============================================================================
    # ENHANCED CONVERSATION METHODS
    # ============================================================================

    async def save_conversation_message(
        self,
        session_id: str,
        student_id: int,
        speaker: str,
        message: str,
        timestamp: str,
        firebase_uid: Optional[str] = None
    ) -> Dict[str, Any]:
        """Save conversation message with optional user validation"""
        
        # Validate user has access to this student_id
        if firebase_uid:
            has_access = await self.validate_user_access_to_student(firebase_uid, student_id)
            if not has_access:
                raise PermissionError(f"User {firebase_uid} does not have access to student {student_id}")
        
        # Use UUID for message ID to avoid collisions
        message_id = str(uuid.uuid4())
        
        message_data = {
            "id": message_id,
            "session_id": session_id,
            "student_id": student_id,
            "speaker": speaker,
            "message": message,
            "timestamp": timestamp,
            "firebase_uid": firebase_uid,
            "created_at": datetime.utcnow().isoformat()
        }
        
        return self.conversations.create_item(body=message_data)

    async def get_session_conversation(
        self,
        session_id: str,
        student_id: int,
        firebase_uid: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get session conversation with optional user validation"""
        
        # Validate user access
        if firebase_uid:
            has_access = await self.validate_user_access_to_student(firebase_uid, student_id)
            if not has_access:
                raise PermissionError(f"User {firebase_uid} does not have access to student {student_id}")
        
        query = """
        SELECT * FROM c 
        WHERE c.session_id = @session_id 
        ORDER BY c.timestamp
        """
        
        params = [{"name": "@session_id", "value": session_id}]
        
        return list(self.conversations.query_items(
            query=query,
            parameters=params,
            partition_key=student_id
        ))
    
    async def get_student_recent_conversations(
        self,
        student_id: int,
        session_limit: int = 5,
        firebase_uid: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get recent conversations for a student across sessions"""
        
        # Validate user access
        if firebase_uid:
            has_access = await self.validate_user_access_to_student(firebase_uid, student_id)
            if not has_access:
                raise PermissionError(f"User {firebase_uid} does not have access to student {student_id}")
        
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
        end_date: str = None,
        firebase_uid: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get summary statistics for student conversations"""
        
        # Validate user access
        if firebase_uid:
            has_access = await self.validate_user_access_to_student(firebase_uid, student_id)
            if not has_access:
                raise PermissionError(f"User {firebase_uid} does not have access to student {student_id}")
        
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

    # ============================================================================
    # ENHANCED COMPETENCY METHODS
    # ============================================================================

    async def get_competency(
        self,
        student_id: int,
        subject: str,
        skill_id: str,
        subskill_id: str,
        firebase_uid: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get competency with optional user validation"""
        
        # Validate user access
        if firebase_uid:
            has_access = await self.validate_user_access_to_student(firebase_uid, student_id)
            if not has_access:
                raise PermissionError(f"User {firebase_uid} does not have access to student {student_id}")
        
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
        total_attempts: int,
        firebase_uid: Optional[str] = None
    ) -> Dict[str, Any]:
        """Update competency with user validation"""
        
        # Validate user access
        if firebase_uid:
            has_access = await self.validate_user_access_to_student(firebase_uid, student_id)
            if not has_access:
                raise PermissionError(f"User {firebase_uid} does not have access to student {student_id}")
        
        # Use consistent ID based on student, subject, skill, and subskill for upsert
        competency_id = f"{student_id}_{subject}_{skill_id}_{subskill_id}"
        
        competency_data = {
            "id": competency_id,
            "student_id": student_id,
            "subject": subject,
            "skill_id": skill_id,
            "subskill_id": subskill_id,
            "current_score": score,
            "credibility": credibility,
            "total_attempts": total_attempts,
            "last_updated": datetime.utcnow().isoformat(),
            "firebase_uid": firebase_uid,
            "created_at": datetime.utcnow().isoformat()
        }
        
        # Use upsert for atomic create-or-update
        try:
            # First check if document exists to preserve created_at
            try:
                existing_competency = self.competencies.read_item(
                    item=competency_id, 
                    partition_key=student_id
                )
                # Preserve original created_at timestamp
                competency_data["created_at"] = existing_competency.get("created_at", competency_data["created_at"])
            except CosmosResourceNotFoundError:
                # Document doesn't exist, use current timestamp for created_at
                pass
            
            # Upsert (create or replace) the document
            return self.competencies.upsert_item(body=competency_data)
            
        except Exception as e:
            logger.error(f"Failed to upsert competency {competency_id}: {e}")
            raise

    async def get_subject_competencies(
        self,
        student_id: int,
        subject: str,
        firebase_uid: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get all competencies for a specific subject"""
        
        # Validate user access
        if firebase_uid:
            has_access = await self.validate_user_access_to_student(firebase_uid, student_id)
            if not has_access:
                raise PermissionError(f"User {firebase_uid} does not have access to student {student_id}")
        
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

    async def get_competency_distribution(
        self,
        student_id: int,
        subject: Optional[str] = None,
        firebase_uid: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get competency distribution statistics"""
        
        # Validate user access
        if firebase_uid:
            has_access = await self.validate_user_access_to_student(firebase_uid, student_id)
            if not has_access:
                raise PermissionError(f"User {firebase_uid} does not have access to student {student_id}")
        
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

    # ============================================================================
    # ENHANCED ATTEMPT METHODS
    # ============================================================================

    async def save_attempt(
        self,
        student_id: int,
        subject: str,
        skill_id: str,
        subskill_id: str,
        score: float,
        analysis: str,
        feedback: str,
        firebase_uid: Optional[str] = None
    ) -> Dict[str, Any]:
        """Save attempt with user validation"""
        
        # Validate user access
        if firebase_uid:
            has_access = await self.validate_user_access_to_student(firebase_uid, student_id)
            if not has_access:
                raise PermissionError(f"User {firebase_uid} does not have access to student {student_id}")
        
        # Use UUID for attempt ID
        attempt_id = str(uuid.uuid4())
        
        attempt_data = {
            "id": attempt_id,
            "student_id": student_id,
            "subject": subject,
            "skill_id": skill_id,
            "subskill_id": subskill_id,
            "score": score,
            "analysis": analysis,
            "feedback": feedback,
            "timestamp": datetime.utcnow().isoformat(),
            "firebase_uid": firebase_uid,
            "created_at": datetime.utcnow().isoformat()
        }
        
        return self.attempts.create_item(body=attempt_data)

    async def get_student_attempts(
        self,
        student_id: int,
        subject: Optional[str] = None,
        skill_id: Optional[str] = None,
        subskill_id: Optional[str] = None,
        limit: int = 100,
        firebase_uid: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get student attempts with optional user validation"""
        
        # Validate user access if firebase_uid provided
        if firebase_uid:
            has_access = await self.validate_user_access_to_student(firebase_uid, student_id)
            if not has_access:
                raise PermissionError(f"User {firebase_uid} does not have access to student {student_id}")
        
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

    async def get_attempts_by_time_range(
        self,
        student_id: int,
        subject: Optional[str] = None,
        skill_id: Optional[str] = None,
        subskill_id: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        firebase_uid: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get attempts within a specific time range with filtering options"""
        
        # Validate user access
        if firebase_uid:
            has_access = await self.validate_user_access_to_student(firebase_uid, student_id)
            if not has_access:
                raise PermissionError(f"User {firebase_uid} does not have access to student {student_id}")
        
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

    async def get_aggregated_attempts_by_time(
        self,
        student_id: int,
        subject: Optional[str] = None,
        grouping: str = "day",  # day, week, month
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        firebase_uid: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get aggregated attempt data grouped by time periods"""
        
        # Validate user access
        if firebase_uid:
            has_access = await self.validate_user_access_to_student(firebase_uid, student_id)
            if not has_access:
                raise PermissionError(f"User {firebase_uid} does not have access to student {student_id}")
        
        # Cosmos DB doesn't support complex aggregations natively,
        # so we'll fetch the data and aggregate it in Python
        
        attempts = await self.get_attempts_by_time_range(
            student_id=student_id,
            subject=subject,
            start_date=start_date,
            end_date=end_date,
            firebase_uid=firebase_uid
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
        subskill_id: Optional[str] = None,
        firebase_uid: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Reconstruct competency history based on attempts data"""
        
        # Validate user access
        if firebase_uid:
            has_access = await self.validate_user_access_to_student(firebase_uid, student_id)
            if not has_access:
                raise PermissionError(f"User {firebase_uid} does not have access to student {student_id}")
        
        # This is an approximation since we don't store historical competency values
        attempts = await self.get_attempts_by_time_range(
            student_id=student_id,
            subject=subject,
            skill_id=skill_id,
            subskill_id=subskill_id,
            firebase_uid=firebase_uid
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

    # ============================================================================
    # ENHANCED REVIEW METHODS
    # ============================================================================

    async def save_problem_review(
        self,
        student_id: int,
        subject: str,
        skill_id: str,
        subskill_id: str,
        problem_id: str,
        review_data: Dict[str, Any],
        problem_content: Dict[str, Any] = None,
        firebase_uid: Optional[str] = None
    ) -> Dict[str, Any]:
        """Save problem review with user validation"""
        
        # Validate user access
        if firebase_uid:
            has_access = await self.validate_user_access_to_student(firebase_uid, student_id)
            if not has_access:
                raise PermissionError(f"User {firebase_uid} does not have access to student {student_id}")
        
        timestamp = datetime.utcnow().isoformat()
        review_id = str(uuid.uuid4())

        logger.info(f"Saving problem review with ID: {review_id} for student {student_id}")

        review_item = {
            "id": review_id,
            "student_id": student_id,
            "subject": subject,
            "skill_id": skill_id,
            "subskill_id": subskill_id,
            "problem_id": problem_id,
            "timestamp": timestamp,
            "problem_content": problem_content,
            "full_review": review_data,
            "observation": review_data.get("observation", {}),
            "analysis": review_data.get("analysis", {}),
            "evaluation": review_data.get("evaluation", {}),
            "feedback": review_data.get("feedback", {}),
            "score": float(review_data.get("evaluation", {}).get("score", 0)) 
                if isinstance(review_data.get("evaluation"), dict) 
                else float(review_data.get("evaluation", 0)),
            "firebase_uid": firebase_uid,
            "created_at": timestamp
        }
        
        return self.reviews.create_item(body=review_item)

    async def get_problem_reviews(
        self,
        student_id: int,
        subject: Optional[str] = None,
        skill_id: Optional[str] = None, 
        subskill_id: Optional[str] = None,
        limit: int = 100,
        firebase_uid: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get problem reviews for a student with optional filters."""
        
        # Validate user access
        if firebase_uid:
            has_access = await self.validate_user_access_to_student(firebase_uid, student_id)
            if not has_access:
                raise PermissionError(f"User {firebase_uid} does not have access to student {student_id}")
        
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
        days: int = 30,
        firebase_uid: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get summary statistics for problem reviews."""
        
        # Validate user access
        if firebase_uid:
            has_access = await self.validate_user_access_to_student(firebase_uid, student_id)
            if not has_access:
                raise PermissionError(f"User {firebase_uid} does not have access to student {student_id}")
        
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

    async def get_review_patterns(
        self,
        student_id: int,
        subject: Optional[str] = None,
        recent_count: int = 100,
        firebase_uid: Optional[str] = None
    ) -> Dict[str, Any]:
        """Analyze patterns in problem reviews"""
        
        # Validate user access
        if firebase_uid:
            has_access = await self.validate_user_access_to_student(firebase_uid, student_id)
            if not has_access:
                raise PermissionError(f"User {firebase_uid} does not have access to student {student_id}")
        
        reviews = await self.get_problem_reviews(
            student_id=student_id,
            subject=subject,
            limit=recent_count,
            firebase_uid=firebase_uid
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

    # ============================================================================
    # ENHANCED CACHED PROBLEMS METHODS
    # ============================================================================

    async def save_cached_problem(self, subject, skill_id, subskill_id, problem_data):
        """Save a problem to the cached_problems container with UUID-based IDs"""
        try:
            # Generate UUID for problem
            problem_uuid = str(uuid.uuid4())
            timestamp_precise = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
            
            # Ensure problem_data has proper IDs
            problem_data["id"] = problem_uuid
            problem_data["problem_id"] = problem_uuid
            
            # Ensure metadata exists and has required fields
            if "metadata" not in problem_data:
                problem_data["metadata"] = {}
            
            if "subject" not in problem_data["metadata"]:
                problem_data["metadata"]["subject"] = subject
                
            # Create the standardized document
            document = {
                "id": problem_uuid,
                "problem_id": problem_uuid,
                "type": "cached_problem",
                "subject": subject,
                "skill_id": skill_id,
                "subskill_id": subskill_id,
                "difficulty": problem_data.get("metadata", {}).get("difficulty", 5.0),
                "timestamp": timestamp_precise,
                "problem_data": problem_data,
                "created_at": datetime.utcnow().isoformat()
            }
            
            # Save to cached_problems container
            self.cached_problems.create_item(body=document)
            logger.info(f"Saved cached problem {problem_uuid} for {subject}/{skill_id}/{subskill_id}")
            
            return problem_uuid
            
        except Exception as e:
            logger.error(f"Failed to save cached problem: {str(e)}")
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
            logger.error(f"Error getting cached problems: {str(e)}")
            return []

    # ============================================================================
    # CONTEXT PRIMITIVES CACHING METHODS
    # ============================================================================

    async def get_cached_context_primitives(self, subject: str, subskill_id: str) -> Optional[Dict[str, Any]]:
        """Get cached context primitives for a specific subskill"""
        try:
            query = """
            SELECT c.primitives
            FROM c
            WHERE c.subject = @subject
            AND c.subskill_id = @subskill_id
            """

            params = [
                {"name": "@subject", "value": subject},
                {"name": "@subskill_id", "value": subskill_id}
            ]

            items = list(self.context_primitives.query_items(
                query=query,
                parameters=params,
                enable_cross_partition_query=False  # Using partition key
            ))

            if items:
                logger.info(f"Cache HIT for context primitives: {subject}:{subskill_id}")
                return items[0].get("primitives", {})
            else:
                logger.info(f"Cache MISS for context primitives: {subject}:{subskill_id}")
                return None

        except Exception as e:
            logger.error(f"Error getting cached context primitives for {subject}:{subskill_id}: {str(e)}")
            return None

    async def save_cached_context_primitives(
        self,
        subject: str,
        grade_level: str,
        unit_id: str,
        skill_id: str,
        subskill_id: str,
        primitives_data: Dict[str, Any]
    ):
        """Save context primitives to cache with curriculum IDs"""
        try:
            # Create deterministic document ID
            document_id = f"{subject.lower()}:{grade_level.lower()}:{subskill_id}"

            # Create the document with curriculum IDs
            document = {
                "id": document_id,
                "subject": subject,
                "grade_level": grade_level,
                "unit_id": unit_id,
                "skill_id": skill_id,
                "subskill_id": subskill_id,
                "version": "1.0",
                "created_at": datetime.utcnow().isoformat(),
                "primitives": primitives_data
            }

            # Use upsert to handle both creation and potential updates
            self.context_primitives.upsert_item(body=document)
            logger.info(f"Successfully cached context primitives for {subject}:{unit_id}:{skill_id}:{subskill_id}")

        except Exception as e:
            logger.error(f"Error saving context primitives for {subject}:{subskill_id}: {str(e)}")
            raise

    # ============================================================================
    # ENHANCED P5JS CODE METHODS
    # ============================================================================

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
        subskill_description: str = None,
        subject: str = None,
        skill: str = None,
        subskill: str = None,
        key_concepts: List[str] = None,
        firebase_uid: Optional[str] = None
    ) -> Dict[str, Any]:
        """Save p5js code snippet with user validation and UUIDs"""
        try:
            # Validate user access
            if firebase_uid:
                has_access = await self.validate_user_access_to_student(firebase_uid, student_id)
                if not has_access:
                    raise PermissionError(f"User {firebase_uid} does not have access to student {student_id}")
            
            snippet_id = str(uuid.uuid4())
            timestamp = datetime.utcnow().isoformat()
            
            item = {
                "id": snippet_id,
                "student_id": student_id,
                "title": title,
                "description": description,
                "code": code,
                "tags": tags or [],
                "created_at": timestamp,
                "updated_at": timestamp,
                "type": "p5js_code_snippet",
                "unit_id": unit_id,
                "unit_title": unit_title,
                "skill_id": skill_id,
                "skill_description": skill_description,
                "subskill_id": subskill_id,
                "subskill_description": subskill_description,
                "subject": subject,
                "skill": skill,
                "subskill": subskill,
                "key_concepts": key_concepts or [],
                "source": "user_created",
                "firebase_uid": firebase_uid
            }
            
            result = self.p5js_code_snippets.create_item(body=item)
            logger.info(f"Saved p5js code snippet with ID: {snippet_id}")
            
            return {
                "id": result["id"],
                "student_id": result["student_id"],
                "title": result["title"],
                "code": result["code"],
                "description": result.get("description", ""),
                "tags": result.get("tags", []),
                "created_at": result["created_at"],
                "updated_at": result["updated_at"],
                "unit_id": result.get("unit_id"),
                "unit_title": result.get("unit_title"),
                "skill_id": result.get("skill_id"),
                "skill_description": result.get("skill_description"),
                "subskill_id": result.get("subskill_id"),
                "subskill_description": result.get("subskill_description"),
                "subject": result.get("subject"),
                "skill": result.get("skill"),
                "subskill": result.get("subskill"),
                "key_concepts": result.get("key_concepts", [])
            }
            
        except Exception as e:
            logger.error(f"Error saving p5js code: {str(e)}")
            raise

    async def get_student_p5js_codes(
        self,
        student_id: int,
        limit: int = 100,
        firebase_uid: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get all p5js code snippets for a student"""
        
        # Validate user access
        if firebase_uid:
            has_access = await self.validate_user_access_to_student(firebase_uid, student_id)
            if not has_access:
                raise PermissionError(f"User {firebase_uid} does not have access to student {student_id}")
        
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
        snippet_id: str,
        firebase_uid: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get a specific p5js code snippet by ID"""
        
        # Validate user access
        if firebase_uid:
            has_access = await self.validate_user_access_to_student(firebase_uid, student_id)
            if not has_access:
                raise PermissionError(f"User {firebase_uid} does not have access to student {student_id}")
        
        try:
            result = self.p5js_code_snippets.read_item(
                item=snippet_id,
                partition_key=student_id
            )
            return result
        except Exception as e:
            logger.error(f"Error retrieving p5js code: {str(e)}")
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
        subskill_description: str = None,
        subject: str = None,
        skill: str = None,
        subskill: str = None,
        key_concepts: List[str] = None,
        firebase_uid: Optional[str] = None
    ) -> Dict[str, Any]:
        """Update an existing p5js code snippet"""
        
        # Validate user access
        if firebase_uid:
            has_access = await self.validate_user_access_to_student(firebase_uid, student_id)
            if not has_access:
                raise PermissionError(f"User {firebase_uid} does not have access to student {student_id}")
        
        try:
            # First get the existing item
            snippet = await self.get_p5js_code_by_id(student_id, snippet_id, firebase_uid)
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
            if subject is not None:
                snippet["subject"] = subject
            if skill is not None:
                snippet["skill"] = skill
            if subskill is not None:
                snippet["subskill"] = subskill
            if key_concepts is not None:
                snippet["key_concepts"] = key_concepts
                
            # Update the timestamp
            snippet["updated_at"] = datetime.utcnow().isoformat()
            
            # Save the updated document
            result = self.p5js_code_snippets.replace_item(
                item=snippet_id,
                body=snippet
            )
            return result
        except Exception as e:
            logger.error(f"Error updating p5js code: {str(e)}")
            raise

    async def delete_p5js_code(
        self,
        student_id: int,
        snippet_id: str,
        firebase_uid: Optional[str] = None
    ) -> bool:
        """Delete a p5js code snippet"""
        
        # Validate user access
        if firebase_uid:
            has_access = await self.validate_user_access_to_student(firebase_uid, student_id)
            if not has_access:
                raise PermissionError(f"User {firebase_uid} does not have access to student {student_id}")
        
        try:
            self.p5js_code_snippets.delete_item(
                item=snippet_id,
                partition_key=student_id
            )
            return True
        except Exception as e:
            logger.error(f"Error deleting p5js code: {str(e)}")
            return False

    async def search_p5js_codes_by_subject(
        self, 
        subject: str = None, 
        skill: str = None, 
        subskill: str = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Search p5js code snippets by educational metadata"""
        try:
            conditions = ["c.type = 'p5js_code_snippet'"]
            params = []
            
            if subject:
                conditions.append("c.subject = @subject")
                params.append({"name": "@subject", "value": subject})
            
            if skill:
                conditions.append("c.skill = @skill")
                params.append({"name": "@skill", "value": skill})
            
            if subskill:
                conditions.append("c.subskill = @subskill")
                params.append({"name": "@subskill", "value": subskill})
            
            params.append({"name": "@limit", "value": limit})
            
            where_clause = " AND ".join(conditions)
            query = f"""
            SELECT * FROM c 
            WHERE {where_clause}
            ORDER BY c.created_at DESC
            OFFSET 0 LIMIT @limit
            """
            
            results = list(self.p5js_code_snippets.query_items(
                query=query,
                parameters=params,
                enable_cross_partition_query=True
            ))
            
            formatted_results = []
            for result in results:
                formatted_results.append({
                    "id": result["id"],
                    "student_id": result["student_id"],
                    "title": result["title"],
                    "code": result["code"],
                    "description": result.get("description", ""),
                    "tags": result.get("tags", []),
                    "created_at": result["created_at"],
                    "updated_at": result["updated_at"],
                    "subject": result.get("subject"),
                    "skill": result.get("skill"),
                    "subskill": result.get("subskill"),
                    "key_concepts": result.get("key_concepts", [])
                })
            
            return formatted_results
            
        except Exception as e:
            logger.error(f"Error searching p5js codes by subject: {str(e)}")
            raise

    # ============================================================================
    # P5JS EVALUATION METHODS
    # ============================================================================

    async def save_p5js_evaluation(self, evaluation_data, firebase_uid: Optional[str] = None):
        """Save a p5js evaluation to the database."""
        
        # Validate user access if student_id is in evaluation_data
        student_id = evaluation_data.get("student_id")
        if firebase_uid and student_id:
            has_access = await self.validate_user_access_to_student(firebase_uid, student_id)
            if not has_access:
                raise PermissionError(f"User {firebase_uid} does not have access to student {student_id}")
        
        try:
            # Create the evaluations container if it doesn't exist
            evaluations = self.database.create_container_if_not_exists(
                id="evaluations",
                partition_key=PartitionKey(path="/student_id")
            )
            
            # Add UUID and firebase_uid to evaluation data
            evaluation_data["id"] = str(uuid.uuid4())
            evaluation_data["firebase_uid"] = firebase_uid
            evaluation_data["created_at"] = datetime.utcnow().isoformat()
            
            # Save to the evaluations container
            result = evaluations.create_item(body=evaluation_data)
            return result
        except Exception as e:
            logger.error(f"Error saving p5js evaluation: {str(e)}")
            raise

    async def get_student_evaluations(
        self,
        student_id: int,
        exercise_id: Optional[str] = None,
        limit: int = 10,
        firebase_uid: Optional[str] = None
    ):
        """Get evaluations for a student, optionally filtered by exercise."""
        
        # Validate user access
        if firebase_uid:
            has_access = await self.validate_user_access_to_student(firebase_uid, student_id)
            if not has_access:
                raise PermissionError(f"User {firebase_uid} does not have access to student {student_id}")
        
        try:
            # Create the evaluations container if it doesn't exist (for backwards compatibility)
            evaluations = self.database.create_container_if_not_exists(
                id="evaluations",
                partition_key=PartitionKey(path="/student_id")
            )
            
            # Build query
            query = "SELECT * FROM c WHERE c.student_id = @student_id AND c.type = 'p5js_evaluation'"
            parameters = [{"name": "@student_id", "value": student_id}]
            
            if exercise_id:
                query += " AND c.exercise_id = @exercise_id"
                parameters.append({"name": "@exercise_id", "value": exercise_id})
            
            query += " ORDER BY c.created_at DESC OFFSET 0 LIMIT @limit"
            parameters.append({"name": "@limit", "value": limit})
            
            # Execute query
            items = list(evaluations.query_items(
                query=query,
                parameters=parameters,
                partition_key=student_id
            ))
            
            return items
        except Exception as e:
            logger.error(f"Error getting student evaluations: {str(e)}")
            return []

    async def get_evaluation_by_id(
        self,
        student_id: int,
        evaluation_id: str,
        firebase_uid: Optional[str] = None
    ):
        """Get a specific evaluation by ID."""
        
        # Validate user access
        if firebase_uid:
            has_access = await self.validate_user_access_to_student(firebase_uid, student_id)
            if not has_access:
                raise PermissionError(f"User {firebase_uid} does not have access to student {student_id}")
        
        try:
            # Create the evaluations container if it doesn't exist (for backwards compatibility)
            evaluations = self.database.create_container_if_not_exists(
                id="evaluations",
                partition_key=PartitionKey(path="/student_id")
            )
            
            result = evaluations.read_item(
                item=evaluation_id,
                partition_key=student_id
            )
            return result
        except Exception as e:
            logger.error(f"Error retrieving evaluation: {str(e)}")
            return None

    # ============================================================================
    # CONTENT PACKAGES METHODS (unchanged - these are global)
    # ============================================================================

    async def get_content_packages(
        self,
        subject: Optional[str] = None,
        skill: Optional[str] = None,
        subskill: Optional[str] = None,
        status: str = "approved",
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get educational content packages with filtering"""
        try:
            # Build the query conditions
            conditions = ["c.document_type = 'content_package'"]
            params = []
            
            if status:
                conditions.append("c.status = @status")
                params.append({"name": "@status", "value": status})
            
            if subject:
                conditions.append("c.subject = @subject")
                params.append({"name": "@subject", "value": subject})
            
            if skill:
                conditions.append("c.skill = @skill")
                params.append({"name": "@skill", "value": skill})
            
            if subskill:
                conditions.append("c.subskill = @subskill")
                params.append({"name": "@subskill", "value": subskill})
            
            params.append({"name": "@limit", "value": limit})
            
            where_clause = " AND ".join(conditions)
            query = f"""
            SELECT * FROM c 
            WHERE {where_clause}
            ORDER BY c.created_at DESC
            OFFSET 0 LIMIT @limit
            """
            
            results = list(self.content_packages.query_items(
                query=query,
                parameters=params,
                enable_cross_partition_query=True
            ))
            
            return results
            
        except Exception as e:
            logger.error(f"Error getting content packages: {str(e)}")
            return []

    async def get_content_package_by_id(
        self,
        package_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get specific content package for session context"""
        try:
            # First, try to find the package by querying with the ID
            query = """
            SELECT * FROM c 
            WHERE c.id = @package_id 
            AND c.document_type = 'content_package'
            AND c.status = 'approved'
            """
            
            params = [{"name": "@package_id", "value": package_id}]
            
            results = list(self.content_packages.query_items(
                query=query,
                parameters=params,
                enable_cross_partition_query=True
            ))
            
            if results:
                return results[0]
            else:
                logger.info(f"Content package with ID {package_id} not found or not approved")
                return None
                
        except Exception as e:
            logger.error(f"Error getting content package by ID: {str(e)}")
            return None

    async def search_content_packages_by_criteria(
        self,
        search_criteria: Dict[str, Any],
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Advanced search for content packages with multiple criteria"""
        try:
            conditions = ["c.document_type = 'content_package'", "c.status = 'approved'"]
            params = [{"name": "@limit", "value": limit}]
            
            # Handle different search criteria
            if search_criteria.get("grade_level"):
                conditions.append("c.master_context.grade_level = @grade_level")
                params.append({"name": "@grade_level", "value": search_criteria["grade_level"]})
            
            if search_criteria.get("difficulty_level"):
                conditions.append("c.master_context.difficulty_level = @difficulty_level")
                params.append({"name": "@difficulty_level", "value": search_criteria["difficulty_level"]})
            
            if search_criteria.get("keywords"):
                # Search in core concepts and key terminology
                conditions.append("(CONTAINS(LOWER(ARRAY_TO_STRING(c.master_context.core_concepts, ' ')), LOWER(@keywords)) OR CONTAINS(LOWER(c.master_context.key_terminology), LOWER(@keywords)))")
                params.append({"name": "@keywords", "value": search_criteria["keywords"]})
            
            where_clause = " AND ".join(conditions)
            query = f"""
            SELECT * FROM c 
            WHERE {where_clause}
            ORDER BY c.created_at DESC
            OFFSET 0 LIMIT @limit
            """
            
            results = list(self.content_packages.query_items(
                query=query,
                parameters=params,
                enable_cross_partition_query=True
            ))
            
            return results
            
        except Exception as e:
            logger.error(f"Error searching content packages: {str(e)}")
            return []

    # ============================================================================
    # 🆕 NEW: ASSESSMENT METHODS
    # ============================================================================

    async def store_assessment(
        self,
        assessment_data: Dict[str, Any],
        firebase_uid: Optional[str] = None
    ) -> Dict[str, Any]:
        """Store assessment data in Cosmos DB with expiration"""
        try:
            student_id = assessment_data.get("student_id")
            assessment_id = assessment_data.get("assessment_id")

            # Validate user access
            if firebase_uid and student_id:
                has_access = await self.validate_user_access_to_student(firebase_uid, student_id)
                if not has_access:
                    raise PermissionError(f"User {firebase_uid} does not have access to student {student_id}")

            timestamp = datetime.utcnow().isoformat()

            # Calculate expiration time (6 hours from creation)
            from datetime import timedelta
            expires_at = (datetime.utcnow() + timedelta(hours=6)).isoformat()

            # Create the assessment document
            assessment_document = {
                "id": assessment_id,
                "assessment_id": assessment_id,
                "student_id": student_id,
                "subject": assessment_data.get("subject"),
                "status": "created",
                "total_questions": assessment_data.get("total_questions", 0),
                "estimated_duration_minutes": assessment_data.get("estimated_duration_minutes", 30),
                "blueprint": assessment_data.get("blueprint", {}),
                "problems": assessment_data.get("problems", []),
                "created_at": timestamp,
                "expires_at": expires_at,
                "started_at": None,
                "completed_at": None,
                "answers": None,
                "score_data": None,
                "time_taken_minutes": None,
                "firebase_uid": firebase_uid,
                "document_type": "assessment",
                "ttl": 21600  # 6 hours in seconds for automatic deletion
            }

            # Store the assessment
            result = self.assessments.create_item(body=assessment_document)
            logger.info(f"Stored assessment {assessment_id} for student {student_id}")

            return result

        except Exception as e:
            logger.error(f"Error storing assessment: {str(e)}")
            raise

    async def get_assessment(
        self,
        assessment_id: str,
        student_id: int,
        firebase_uid: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Retrieve assessment by ID with validation and expiration check.

        This method enforces expiration - returns None if assessment has expired.
        Use for taking assessments where expiration should block access.
        """
        try:
            # Validate user access
            if firebase_uid:
                has_access = await self.validate_user_access_to_student(firebase_uid, student_id)
                if not has_access:
                    raise PermissionError(f"User {firebase_uid} does not have access to student {student_id}")

            # Get the assessment
            result = self.assessments.read_item(
                item=assessment_id,
                partition_key=student_id
            )

            # Check if assessment has expired
            if result.get("expires_at"):
                expires_at = datetime.fromisoformat(result["expires_at"])
                if datetime.utcnow() > expires_at:
                    logger.warning(f"Assessment {assessment_id} has expired")
                    return None

            logger.info(f"Retrieved assessment {assessment_id} for student {student_id}")
            return result

        except CosmosResourceNotFoundError:
            logger.info(f"Assessment {assessment_id} not found for student {student_id}")
            return None
        except Exception as e:
            logger.error(f"Error retrieving assessment: {str(e)}")
            return None

    async def get_assessment_for_results(
        self,
        assessment_id: str,
        student_id: int,
        firebase_uid: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Retrieve assessment by ID for viewing results - ignores expiration.

        This method allows viewing results of completed assessments even if expired.
        Use for showing assessment history and results.
        """
        try:
            # Validate user access
            if firebase_uid:
                has_access = await self.validate_user_access_to_student(firebase_uid, student_id)
                if not has_access:
                    raise PermissionError(f"User {firebase_uid} does not have access to student {student_id}")

            # Get the assessment without checking expiration
            result = self.assessments.read_item(
                item=assessment_id,
                partition_key=student_id
            )

            logger.info(f"Retrieved assessment {assessment_id} for results viewing (ignoring expiration)")
            return result

        except CosmosResourceNotFoundError:
            logger.info(f"Assessment {assessment_id} not found for student {student_id}")
            return None
        except Exception as e:
            logger.error(f"Error retrieving assessment for results: {str(e)}")
            return None

    async def update_assessment_status(
        self,
        assessment_id: str,
        student_id: int,
        status: str,
        firebase_uid: Optional[str] = None
    ) -> bool:
        """Update assessment status (created → in_progress → completed)"""
        try:
            # Validate user access
            if firebase_uid:
                has_access = await self.validate_user_access_to_student(firebase_uid, student_id)
                if not has_access:
                    raise PermissionError(f"User {firebase_uid} does not have access to student {student_id}")

            # Get the existing assessment
            assessment = await self.get_assessment(assessment_id, student_id, firebase_uid)
            if not assessment:
                return False

            # Update status and relevant timestamps
            assessment["status"] = status

            if status == "in_progress" and not assessment.get("started_at"):
                assessment["started_at"] = datetime.utcnow().isoformat()
            elif status == "completed" and not assessment.get("completed_at"):
                assessment["completed_at"] = datetime.utcnow().isoformat()

            # Save the updated assessment
            self.assessments.upsert_item(body=assessment)
            logger.info(f"Updated assessment {assessment_id} status to {status}")

            return True

        except Exception as e:
            logger.error(f"Error updating assessment status: {str(e)}")
            return False

    async def store_assessment_submission(
        self,
        assessment_id: str,
        student_id: int,
        answers: Dict[str, Any],
        score_data: Dict[str, Any],
        time_taken_minutes: Optional[int] = None,
        firebase_uid: Optional[str] = None
    ) -> bool:
        """Store student answers and scoring results"""
        try:
            # Validate user access
            if firebase_uid:
                has_access = await self.validate_user_access_to_student(firebase_uid, student_id)
                if not has_access:
                    raise PermissionError(f"User {firebase_uid} does not have access to student {student_id}")

            # Get the existing assessment
            assessment = await self.get_assessment(assessment_id, student_id, firebase_uid)
            if not assessment:
                return False

            # Update with submission data
            assessment["answers"] = answers
            assessment["score_data"] = score_data
            assessment["time_taken_minutes"] = time_taken_minutes
            assessment["status"] = "completed"
            assessment["completed_at"] = datetime.utcnow().isoformat()

            # Save the updated assessment
            self.assessments.upsert_item(body=assessment)
            logger.info(f"Stored submission for assessment {assessment_id}")

            return True

        except Exception as e:
            logger.error(f"Error storing assessment submission: {str(e)}")
            return False

    async def update_assessment_with_results(
        self,
        assessment_id: str,
        student_id: int,
        final_results: Dict[str, Any],
        answers: Dict[str, Any],
        time_taken_minutes: Optional[int] = None,
        firebase_uid: Optional[str] = None
    ) -> bool:
        """Update assessment with new results structure and set status to 'completed'"""
        try:
            # Validate user access
            if firebase_uid:
                has_access = await self.validate_user_access_to_student(firebase_uid, student_id)
                if not has_access:
                    raise PermissionError(f"User {firebase_uid} does not have access to student {student_id}")

            # Get the existing assessment
            assessment = await self.get_assessment(assessment_id, student_id, firebase_uid)
            if not assessment:
                logger.error(f"Assessment {assessment_id} not found for student {student_id}")
                return False

            # Update the assessment with the new structure
            assessment["results"] = final_results
            assessment["student_answers"] = answers
            assessment["status"] = "completed"
            assessment["completed_at"] = datetime.utcnow().isoformat()

            if time_taken_minutes is not None:
                assessment["time_taken_minutes"] = time_taken_minutes

            # Save the updated assessment
            self.assessments.upsert_item(body=assessment)
            logger.info(f"Updated assessment {assessment_id} with new results structure")

            return True

        except Exception as e:
            logger.error(f"Error updating assessment with results: {str(e)}")
            return False

    async def get_student_assessments(
        self,
        student_id: int,
        status: Optional[str] = None,
        limit: int = 50,
        firebase_uid: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get assessments for a student with optional status filter"""
        try:
            # Validate user access
            if firebase_uid:
                has_access = await self.validate_user_access_to_student(firebase_uid, student_id)
                if not has_access:
                    raise PermissionError(f"User {firebase_uid} does not have access to student {student_id}")

            query = """
            SELECT * FROM c
            WHERE c.student_id = @student_id
            AND c.document_type = 'assessment'
            """
            params = [{"name": "@student_id", "value": student_id}]

            if status:
                query += " AND c.status = @status"
                params.append({"name": "@status", "value": status})

            query += " ORDER BY c.created_at DESC OFFSET 0 LIMIT @limit"
            params.append({"name": "@limit", "value": limit})

            results = list(self.assessments.query_items(
                query=query,
                parameters=params,
                partition_key=student_id
            ))

            # Filter out expired assessments
            current_time = datetime.utcnow()
            valid_results = []

            for result in results:
                if result.get("expires_at"):
                    expires_at = datetime.fromisoformat(result["expires_at"])
                    if current_time <= expires_at:
                        valid_results.append(result)
                else:
                    valid_results.append(result)

            return valid_results

        except Exception as e:
            logger.error(f"Error getting student assessments: {str(e)}")
            return []

    async def get_completed_assessments(
        self,
        student_id: int,
        firebase_uid: Optional[str] = None,
        page: int = 1,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Get completed assessments for a student with pagination.

        This method returns ALL completed assessments regardless of expiration status,
        as per PRD requirements for assessment history.
        """
        try:
            # Validate user access
            if firebase_uid:
                has_access = await self.validate_user_access_to_student(firebase_uid, student_id)
                if not has_access:
                    raise PermissionError(f"User {firebase_uid} does not have access to student {student_id}")

            # Calculate offset for pagination
            offset = (page - 1) * limit

            query = """
            SELECT * FROM c
            WHERE c.student_id = @student_id
            AND c.document_type = 'assessment'
            AND c.status = 'completed'
            ORDER BY c.completed_at DESC
            OFFSET @offset LIMIT @limit
            """

            params = [
                {"name": "@student_id", "value": student_id},
                {"name": "@offset", "value": offset},
                {"name": "@limit", "value": limit}
            ]

            results = list(self.assessments.query_items(
                query=query,
                parameters=params,
                partition_key=student_id
            ))

            logger.info(f"Retrieved {len(results)} completed assessments for student {student_id} (ignoring expiration for history)")
            return results

        except Exception as e:
            logger.error(f"Error getting completed assessments: {str(e)}")
            return []

    async def get_completed_assessments_count(
        self,
        student_id: int,
        firebase_uid: Optional[str] = None
    ) -> int:
        """Get the total count of completed assessments for a student"""
        try:
            # Validate user access
            if firebase_uid:
                has_access = await self.validate_user_access_to_student(firebase_uid, student_id)
                if not has_access:
                    raise PermissionError(f"User {firebase_uid} does not have access to student {student_id}")

            query = """
            SELECT VALUE COUNT(1) FROM c
            WHERE c.student_id = @student_id
            AND c.document_type = 'assessment'
            AND c.status = 'completed'
            """

            params = [{"name": "@student_id", "value": student_id}]

            results = list(self.assessments.query_items(
                query=query,
                parameters=params,
                partition_key=student_id
            ))

            return results[0] if results else 0

        except Exception as e:
            logger.error(f"Error getting completed assessments count: {str(e)}")
            return 0

    # ============================================================================
    # 🆕 VISUALIZE CONCEPTS METHODS
    # ============================================================================

    async def save_visualize_concept(
        self,
        subskill_id: str,
        section_heading: str,
        section_content: str,
        html_content: str,
        firebase_uid: Optional[str] = None
    ) -> Dict[str, Any]:
        """Save a generated visual concept to Cosmos DB (upsert if already exists)"""
        logger.info(f"🔄 COSMOS DB SAVE START - subskill_id: '{subskill_id}', section: '{section_heading[:50]}...'")
        logger.info(f"📋 Input params - content_length: {len(section_content)}, html_length: {len(html_content)}, firebase_uid: '{firebase_uid}'")
        
        try:
            # First check if a visualization already exists for this subskill + section combination
            logger.info(f"🔍 Checking for existing concept...")
            existing_concept = await self.get_visualize_concept_by_section(
                subskill_id, section_heading, firebase_uid=None  # System-wide
            )
            logger.info(f"🔍 Existing concept check result: {'Found' if existing_concept else 'Not found'}")
            
            timestamp = datetime.utcnow().isoformat()
            
            if existing_concept:
                # Check if content has actually changed to avoid unnecessary updates
                content_changed = (
                    existing_concept.get("section_content") != section_content or
                    existing_concept.get("html_content") != html_content
                )
                
                if content_changed:
                    logger.info(f"🔄 Content changed - updating existing concept with ID: {existing_concept.get('id')}")
                    existing_concept["section_content"] = section_content
                    existing_concept["html_content"] = html_content
                    existing_concept["updated_at"] = timestamp
                    existing_concept["version"] = existing_concept.get("version", 1) + 1
                    if firebase_uid:
                        existing_concept["updated_by"] = firebase_uid
                    
                    logger.info(f"💾 Executing upsert_item for updated concept...")
                    result = self.visualize_concepts.upsert_item(body=existing_concept)
                    logger.info(f"✅ COSMOS UPDATE SUCCESS - ID: {result.get('id')}, version: {result.get('version')}")
                    
                    return result
                else:
                    logger.info(f"✅ Content unchanged - returning existing concept with ID: {existing_concept.get('id')}")
                    return existing_concept
            else:
                # Create new concept
                visualization_id = str(uuid.uuid4())
                logger.info(f"🆕 Creating new concept with ID: {visualization_id}")
                
                visualization_data = {
                    "id": visualization_id,
                    "subskill_id": subskill_id,
                    "section_heading": section_heading,
                    "section_content": section_content,
                    "html_content": html_content,
                    "created_at": timestamp,
                    "updated_at": timestamp,
                    "created_by": firebase_uid,
                    "document_type": "visualize_concept",
                    "version": 1
                }
                
                logger.info(f"📤 Cosmos DB upsert payload prepared - document_type: {visualization_data['document_type']}")
                logger.info(f"💾 Executing upsert_item for new concept...")
                
                # Save to Cosmos DB using upsert to avoid conflicts
                result = self.visualize_concepts.upsert_item(body=visualization_data)
                logger.info(f"✅ COSMOS CREATE SUCCESS - ID: {result.get('id')}, subskill: {result.get('subskill_id')}")
                logger.info(f"📊 Result keys: {list(result.keys()) if result else 'None'}")
                
                return result
            
        except Exception as e:
            logger.error(f"❌ COSMOS DB SAVE FAILED - subskill: {subskill_id}, section: {section_heading[:30]}")
            logger.error(f"💥 Error type: {type(e).__name__}")
            logger.error(f"📝 Error details: {str(e)}")
            import traceback
            logger.error(f"📍 Stack trace: {traceback.format_exc()}")
            raise

    async def get_visualize_concepts_by_subskill(
        self,
        subskill_id: str,
        firebase_uid: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get all saved visualize concepts for a specific subskill"""
        try:
            query = """
            SELECT * FROM c 
            WHERE c.subskill_id = @subskill_id 
            AND c.document_type = 'visualize_concept'
            ORDER BY c.created_at DESC
            """
            
            params = [{"name": "@subskill_id", "value": subskill_id}]
            
            results = list(self.visualize_concepts.query_items(
                query=query,
                parameters=params,
                partition_key=subskill_id
            ))
            
            logger.info(f"Found {len(results)} visualize concepts for subskill {subskill_id}")
            return results
            
        except Exception as e:
            logger.error(f"Error getting visualize concepts for subskill {subskill_id}: {str(e)}")
            return []

    async def get_visualize_concept_by_section(
        self,
        subskill_id: str,
        section_heading: str,
        firebase_uid: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Get a specific visualize concept by subskill_id and section_heading"""
        try:
            query = """
            SELECT * FROM c 
            WHERE c.subskill_id = @subskill_id 
            AND c.section_heading = @section_heading
            AND c.document_type = 'visualize_concept'
            ORDER BY c.created_at DESC
            """
            
            params = [
                {"name": "@subskill_id", "value": subskill_id},
                {"name": "@section_heading", "value": section_heading}
            ]
            
            results = list(self.visualize_concepts.query_items(
                query=query,
                parameters=params,
                partition_key=subskill_id
            ))
            
            if results:
                logger.info(f"Found existing visualize concept for subskill {subskill_id}, section: {section_heading}")
                return results[0]  # Return the most recent one
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting visualize concept: {str(e)}")
            return None

    async def update_visualize_concept(
        self,
        visualization_id: str,
        subskill_id: str,
        html_content: str,
        firebase_uid: Optional[str] = None
    ) -> Dict[str, Any]:
        """Update an existing visualize concept with new HTML content"""
        try:
            # First, get the existing visualization
            existing = await self.get_visualize_concept_by_id(visualization_id, subskill_id)
            if not existing:
                raise ValueError(f"Visualize concept {visualization_id} not found")
            
            # Update the visualization
            existing["html_content"] = html_content
            existing["updated_at"] = datetime.utcnow().isoformat()
            existing["version"] = existing.get("version", 1) + 1
            if firebase_uid:
                existing["updated_by"] = firebase_uid
            
            # Save back to Cosmos DB
            result = self.visualize_concepts.upsert_item(body=existing)
            logger.info(f"Updated visualize concept {visualization_id}")
            
            return result
            
        except Exception as e:
            logger.error(f"Error updating visualize concept: {str(e)}")
            raise

    async def get_visualize_concept_by_id(
        self,
        visualization_id: str,
        subskill_id: str,
        firebase_uid: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Get a specific visualize concept by ID"""
        try:
            query = """
            SELECT * FROM c 
            WHERE c.id = @visualization_id
            AND c.subskill_id = @subskill_id
            AND c.document_type = 'visualize_concept'
            """
            
            params = [
                {"name": "@visualization_id", "value": visualization_id},
                {"name": "@subskill_id", "value": subskill_id}
            ]
            
            results = list(self.visualize_concepts.query_items(
                query=query,
                parameters=params,
                partition_key=subskill_id
            ))
            
            return results[0] if results else None
            
        except Exception as e:
            logger.error(f"Error getting visualize concept by ID: {str(e)}")
            return None