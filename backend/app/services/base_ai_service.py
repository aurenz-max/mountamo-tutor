# backend/app/services/base_ai_service.py
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional, Union

class BaseAIService(ABC):
    """Abstract base class for AI services"""
    
    @abstractmethod
    async def generate_response(
        self, 
        prompt: Union[str, List[Dict[str, Any]]], 
        system_instructions: Optional[str] = None
    ) -> str:
        """Generate a text response from the AI model"""
        pass
    
    @abstractmethod
    async def generate_questions(self, content: str, num_questions: int = 5) -> List[str]:
        """Generate questions based on content"""
        pass
    
    @abstractmethod
    async def evaluate_answer(self, question: str, user_answer: str, content: str) -> Dict[str, Any]:
        """Evaluate a user's answer to a question"""
        pass
    
    @abstractmethod
    async def summarize_session(self, conversation_text: str) -> str:
        """Summarize a tutoring session"""
        pass