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