# backend/app/services/llm_briefing_content_selector.py

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from pydantic import BaseModel
from google import genai
from google.genai import types
import json
import re

from ..db.cosmos_db import CosmosDBService
from ..services.bigquery_analytics import BigQueryAnalyticsService
from ..core.config import settings

logger = logging.getLogger(__name__)

class ContentSelectionDecision(BaseModel):
    """LLM decision about the best content package for today's briefing"""
    student_id: int
    selected_package_id: str
    selection_confidence: float  # 0-1
    primary_reasons: List[str]
    conversation_hooks: List[str]
    alternative_packages: List[Dict[str, Any]]
    engagement_prediction: str  # "high", "medium", "low"
    optimal_presentation_style: str  # "exciting", "supportive", "challenging", "exploratory"
    time_recommendation: str  # "start_immediately", "save_for_peak_energy", "end_of_session"
    success_indicators: List[str]
    learning_path: str
    llm_reasoning: str

class DailyContentRecommendations(BaseModel):
    """Daily content recommendations with multiple options"""
    student_id: int
    primary_recommendation: ContentSelectionDecision
    alternative_recommendations: List[ContentSelectionDecision]
    focus_areas: List[str]
    skill_building_opportunities: List[str]
    challenge_level_today: str
    estimated_engagement_time: str
    learning_momentum_analysis: Dict[str, Any]

class LLMBriefingContentSelector:
    """Fast, simple LLM-powered content selection using cheap models"""
    
    def __init__(self):
        self.gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY)
        self.analytics_service = BigQueryAnalyticsService(
            project_id=settings.GCP_PROJECT_ID,
            dataset_id=getattr(settings, 'BIGQUERY_DATASET_ID', 'analytics')
        )
    
    async def get_daily_content_recommendations(
        self, 
        student_id: int,
        recommendation_count: int = 3
    ) -> DailyContentRecommendations:
        """Get daily content recommendations - fast and simple approach"""
        
        logger.info(f"🚀 Getting daily recommendations for student {student_id}")
        
        try:
            # Step 1: Get student's focus areas (what subjects they need to work on)
            focus_areas = await self._get_student_focus_areas(student_id)
            logger.info(f"📊 Focus areas: {focus_areas}")
            
            # Step 2: Get available content packages for those focus areas
            content_packages = await self._get_available_content_packages(student_id, focus_areas)
            logger.info(f"📦 Found {len(content_packages)} available packages")
            
            if not content_packages:
                raise ValueError(f"No content packages found for student {student_id}")
            
            # Step 3: Use fast LLM to select best packages
            recommendations = await self._select_content_with_fast_llm(
                student_id, focus_areas, content_packages, recommendation_count
            )
            logger.info(f"🤖 LLM selected {len(recommendations)} recommendations")
            
            # Step 4: Build response
            result = DailyContentRecommendations(
                student_id=student_id,
                primary_recommendation=recommendations[0],
                alternative_recommendations=recommendations[1:] if len(recommendations) > 1 else [],
                focus_areas=focus_areas,
                skill_building_opportunities=[],  # Keep simple for now
                challenge_level_today="moderate",  # Default
                estimated_engagement_time="15-20 minutes",  # Default
                learning_momentum_analysis={"status": "active", "focus_areas_count": len(focus_areas)}
            )
            
            logger.info(f"✅ Successfully generated recommendations for student {student_id}")
            return result
            
        except Exception as e:
            logger.error(f"💥 Error generating recommendations for student {student_id}: {str(e)}")
            raise
    
    async def select_optimal_content_for_briefing(
        self, 
        student_id: int,
        briefing_context: Dict[str, Any] = None
    ) -> ContentSelectionDecision:
        """Legacy method - returns primary recommendation"""
        recommendations = await self.get_daily_content_recommendations(student_id, 1)
        return recommendations.primary_recommendation
    
    async def _get_student_focus_areas(self, student_id: int) -> List[str]:
        """Get student's focus areas from high priority items"""
        
        logger.info(f"📊 Getting focus areas for student {student_id}")
        
        try:
            # Simple query to get focus subjects
            query = f"""
            SELECT DISTINCT subject
            FROM `{settings.GCP_PROJECT_ID}.{getattr(settings, 'BIGQUERY_DATASET_ID', 'analytics')}.v_student_focus_areas`
            WHERE student_id = @student_id
              AND priority_level = 'High Priority'
            """
            
            results = await self.analytics_service.execute_query(query, [
                {"name": "student_id", "type": "INT64", "value": student_id}
            ])
            
            focus_areas = [row['subject'] for row in results]
            logger.info(f"📊 Found focus areas: {focus_areas}")
            
            return focus_areas if focus_areas else ["Math"]  # Default to Math if no focus areas
            
        except Exception as e:
            logger.error(f"💥 Error getting focus areas: {str(e)}")
            return ["Math"]  # Safe default
    
    async def _get_available_content_packages(self, student_id: int, focus_areas: List[str]) -> List[Dict[str, Any]]:
        """Get available content packages for focus areas"""
        
        logger.info(f"📦 Getting content packages for areas: {focus_areas}")
        
        try:
            if not focus_areas:
                return []
            
            # Simple query to get content packages
            subject_conditions = " OR ".join([f"subject = '{area}'" for area in focus_areas])
            
            query = f"""
            SELECT 
                package_id,
                subject,
                unit,
                skill,
                subskill,
                difficulty_level,
                reading_level,
                core_concepts,
                learning_objectives
            FROM `{settings.GCP_PROJECT_ID}.{getattr(settings, 'BIGQUERY_DATASET_ID', 'analytics')}.content_packages`
            WHERE {subject_conditions}
            ORDER BY subject, unit, skill, subskill
            LIMIT 20
            """
            
            results = await self.analytics_service.execute_query(query)
            
            # Convert to simple format
            packages = []
            for row in results:
                package = {
                    "package_id": row.get("package_id"),
                    "subject": row.get("subject"),
                    "unit": row.get("unit"),
                    "skill": row.get("skill"), 
                    "subskill": row.get("subskill"),
                    "learning_path": f"{row.get('subject')} > {row.get('unit')} > {row.get('skill')} > {row.get('subskill')}",
                    "difficulty_level": row.get("difficulty_level", "INTERMEDIATE"),
                    "reading_level": row.get("reading_level", "Grade 3-5"),
                    "core_concepts": row.get("core_concepts", ""),
                    "learning_objectives": row.get("learning_objectives", ""),
                    "difficulty_numeric": 2,  # Default
                    "reading_grade_level": 4,  # Default
                    "key_terminology": [],
                    "prerequisites": [],
                    "real_world_applications": [],
                    "related_packages_same_level": [],
                    "progression_path_within_unit": [],
                    "progression_path_cross_unit": [],
                    "llm_context_block": f"{row.get('skill')}: {row.get('subskill')}",
                    "llm_json_payload": {"subject": row.get("subject")}
                }
                packages.append(package)
            
            logger.info(f"📦 Processed {len(packages)} content packages")
            return packages
            
        except Exception as e:
            logger.error(f"💥 Error getting content packages: {str(e)}")
            return []
    
    async def _select_content_with_fast_llm(
        self,
        student_id: int,
        focus_areas: List[str],
        content_packages: List[Dict[str, Any]],
        recommendation_count: int
    ) -> List[ContentSelectionDecision]:
        """Use fast, cheap LLM to select best content packages"""
        
        logger.info(f"🤖 Using fast LLM to select {recommendation_count} packages from {len(content_packages)} options")
        
        try:
            # Build simple package list for LLM
            package_list = ""
            for i, pkg in enumerate(content_packages[:15], 1):  # Limit for prompt size
                package_list += f"{i}. {pkg['package_id']}: {pkg['skill']} - {pkg['subskill']} ({pkg['subject']}, {pkg['difficulty_level']})\n"
            
            # Simple, focused prompt
            prompt = f"""Select the best {recommendation_count} learning packages for a student.

STUDENT FOCUS AREAS: {', '.join(focus_areas)}

AVAILABLE PACKAGES:
{package_list}

Select {recommendation_count} packages that best match the student's focus areas.

RESPOND ONLY WITH THIS JSON:
{{
  "selections": [
    {{
      "rank": 1,
      "package_id": "exact_package_id_here",
      "confidence": 0.9,
      "reason": "Brief reason"
    }}
  ]
}}"""
            
            # Call fast, cheap model
            logger.info(f"🤖 Calling Gemini Flash Lite")
            response = await self.gemini_client.aio.models.generate_content(
                model="gemini-2.5-flash-lite-preview-06-17",
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.1,
                    max_output_tokens=400,
                    response_modalities=["Text"]
                )
            )
            
            logger.info(f"🤖 Fast LLM responded: {len(response.text)} chars")
            
            # Parse response
            recommendations = self._parse_fast_llm_response(
                response.text, student_id, content_packages
            )
            
            return recommendations
            
        except Exception as e:
            logger.error(f"💥 Error with fast LLM selection: {str(e)}")
            # Fallback: just return first few packages
            return self._create_simple_recommendations(student_id, content_packages[:recommendation_count])
    
    def _parse_fast_llm_response(
        self,
        response_text: str,
        student_id: int,
        content_packages: List[Dict[str, Any]]
    ) -> List[ContentSelectionDecision]:
        """Parse fast LLM response into recommendations"""
        
        try:
            # Extract JSON from response
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if not json_match:
                logger.warning(f"🔍 No JSON found in LLM response, using fallback")
                return self._create_simple_recommendations(student_id, content_packages[:3])
            
            response_data = json.loads(json_match.group())
            selections = response_data.get("selections", [])
            
            # Create package lookup
            package_lookup = {pkg["package_id"]: pkg for pkg in content_packages}
            
            recommendations = []
            for selection in selections:
                package_id = selection.get("package_id")
                package = package_lookup.get(package_id)
                
                if not package:
                    logger.warning(f"🔍 Package {package_id} not found, skipping")
                    continue
                
                # Create simple recommendation
                recommendation = ContentSelectionDecision(
                    student_id=student_id,
                    selected_package_id=package_id,
                    selection_confidence=selection.get("confidence", 0.8),
                    primary_reasons=[selection.get("reason", "AI recommended")],
                    conversation_hooks=[f"Ready to work on {package['skill']}?"],
                    alternative_packages=[],
                    engagement_prediction="medium",
                    optimal_presentation_style="supportive", 
                    time_recommendation="start_immediately",
                    success_indicators=["Student engagement", "Progress completion"],
                    learning_path=package["learning_path"],
                    llm_reasoning=f"Fast selection: {selection.get('reason', 'AI recommended based on focus areas')}"
                )
                
                recommendations.append(recommendation)
            
            logger.info(f"🔍 Parsed {len(recommendations)} recommendations from LLM")
            return recommendations
            
        except Exception as e:
            logger.error(f"💥 Error parsing LLM response: {str(e)}")
            return self._create_simple_recommendations(student_id, content_packages[:3])
    
    def _create_simple_recommendations(
        self, 
        student_id: int, 
        packages: List[Dict[str, Any]]
    ) -> List[ContentSelectionDecision]:
        """Create simple recommendations as fallback"""
        
        recommendations = []
        for i, package in enumerate(packages):
            recommendation = ContentSelectionDecision(
                student_id=student_id,
                selected_package_id=package["package_id"],
                selection_confidence=0.7,
                primary_reasons=["Selected from focus areas"],
                conversation_hooks=[f"Let's work on {package['skill']}!"],
                alternative_packages=[],
                engagement_prediction="medium",
                optimal_presentation_style="supportive",
                time_recommendation="start_immediately", 
                success_indicators=["Student participation"],
                learning_path=package["learning_path"],
                llm_reasoning="Simple selection based on focus areas"
            )
            recommendations.append(recommendation)
        
        return recommendations
    
    async def enhance_recommendation_with_detailed_llm(
        self, 
        recommendation: ContentSelectionDecision
    ) -> ContentSelectionDecision:
        """Optional: Enhance recommendation with detailed LLM (expensive model)"""
        
        logger.info(f"🎯 Enhancing recommendation {recommendation.selected_package_id}")
        
        try:
            prompt = f"""Make this learning recommendation more engaging:

PACKAGE: {recommendation.selected_package_id}
SKILL: {recommendation.learning_path}

Create engaging conversation hooks and success indicators.

RESPOND IN JSON:
{{
  "conversation_hooks": ["hook1", "hook2", "hook3"],
  "success_indicators": ["indicator1", "indicator2", "indicator3"],
  "presentation_style": "exciting",
  "reasoning": "Why this is perfect..."
}}"""

            # Use expensive model for enhancement
            response = await self.gemini_client.aio.models.generate_content(
                model="gemini-2.0-flash-exp",
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.4,
                    max_output_tokens=500,
                    response_modalities=["Text"]
                )
            )
            
            # Parse and update recommendation
            json_match = re.search(r'\{.*\}', response.text, re.DOTALL)
            if json_match:
                enhancement = json.loads(json_match.group())
                recommendation.conversation_hooks = enhancement.get("conversation_hooks", recommendation.conversation_hooks)
                recommendation.success_indicators = enhancement.get("success_indicators", recommendation.success_indicators)
                recommendation.optimal_presentation_style = enhancement.get("presentation_style", recommendation.optimal_presentation_style)
                recommendation.llm_reasoning = enhancement.get("reasoning", recommendation.llm_reasoning)
            
            return recommendation
            
        except Exception as e:
            logger.error(f"💥 Error enhancing recommendation: {str(e)}")
            return recommendation
    
    async def health_check(self) -> Dict[str, Any]:
        """Simple health check"""
        try:
            # Test analytics service
            analytics_health = await self.analytics_service.health_check()
            
            # Test fast LLM
            test_response = await self.gemini_client.aio.models.generate_content(
                model="gemini-2.5-flash-lite-preview-06-17",
                contents="Test",
                config=types.GenerateContentConfig(max_output_tokens=5)
            )
            
            return {
                "status": "healthy",
                "service": "llm_briefing_content_selector_v4_simple",
                "models": {
                    "fast_selection": "gemini-2.5-flash-lite-preview-06-17",
                    "detailed_enhancement": "gemini-2.0-flash-exp"
                },
                "analytics_service": analytics_health.get("status"),
                "fast_llm_test": bool(test_response.text),
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }