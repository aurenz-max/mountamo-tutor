"""
Visual Problem Service

Extends the existing ProblemService to support visual primitives using 
Gemini JSON schema enforcement. Integrates with your current architecture.
"""

import json
import uuid
import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
from google import genai
from google.genai.types import GenerateContentConfig

from .problems import ProblemService
from ..core.config import settings

logger = logging.getLogger(__name__)


# JSON Schemas for Gemini structured output
PRIMITIVE_ANALYSIS_SCHEMA = {
    "type": "object",
    "properties": {
        "recommended_primitives": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "component": {"type": "string"},
                    "relevance_score": {"type": "number"},
                    "reasoning": {"type": "string"}
                },
                "required": ["component", "relevance_score", "reasoning"]
            }
        },
        "primary_primitive": {"type": "string"},
        "visual_concepts": {"type": "array", "items": {"type": "string"}},
        "interaction_types": {"type": "array", "items": {"type": "string"}},
        "suitability_assessment": {"type": "string"}
    },
    "required": ["recommended_primitives", "primary_primitive"]
}

VISUAL_PROBLEM_SCHEMA = {
    "type": "object",
    "properties": {
        "problem_type": {"type": "string"},
        "problem": {"type": "string"},
        "answer": {},  # Can be any type depending on primitive
        "primitive_config": {
            "type": "object",
            "properties": {}  # Dynamic based on primitive type
        },
        "success_criteria": {
            "type": "array",
            "items": {"type": "string"}
        },
        "teaching_note": {"type": "string"},
        "estimated_time_minutes": {"type": "integer"},
        "grading_config": {
            "type": "object",
            "properties": {
                "type": {"type": "string"},
                "tolerance": {"type": "number"}
            }
        },
        "visual_elements": {
            "type": "object",
            "properties": {
                "diagram_type": {"type": "string"},
                "interaction_style": {"type": "string"},
                "visual_aids": {"type": "array", "items": {"type": "string"}}
            }
        }
    },
    "required": ["problem_type", "problem", "answer", "primitive_config", "success_criteria", "teaching_note"]
}

PROBLEM_ENHANCEMENT_SCHEMA = {
    "type": "object",
    "properties": {
        "should_enhance": {"type": "boolean"},
        "enhancement_type": {"type": "string"},
        "recommended_primitive": {"type": "string"},
        "enhancement_reason": {"type": "string"},
        "visual_elements_to_add": {
            "type": "array",
            "items": {"type": "string"}
        }
    },
    "required": ["should_enhance", "enhancement_type"]
}


class VisualProblemService:
    """Service for generating and managing visual problems with primitives"""
    
    def __init__(self, problem_service: ProblemService):
        self.problem_service = problem_service
        
        if not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is required for visual problem generation")
        
        self.gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY)
        
        # Primitive capabilities mapping
        self.primitive_subjects = {
            "math": ["NumberLine", "FractionBars", "AreaModel"],
            "science": ["DiagramLabeler", "PartFunctionMatcher"],
            "biology": ["DiagramLabeler", "PartFunctionMatcher"],
            "astronomy": ["MoonPhaseSelector", "OrbitPanel"],
            "language-arts": ["EvidenceHighlighter", "PartsOfSpeechTagger"],
            "social-studies": ["MapLabeler", "TimelineBuilder"]
        }
        
        logger.info("Visual Problem Service initialized with Gemini JSON schema enforcement")
    
    async def analyze_subskill_for_visual_potential(self, 
                                                   subject: str,
                                                   subskill_description: str,
                                                   detailed_objectives: Dict[str, Any]) -> Dict[str, Any]:
        """
        Use Gemini with JSON schema to analyze if a subskill should use visual primitives
        """
        try:
            available_primitives = self.primitive_subjects.get(subject.lower(), [])
            if not available_primitives:
                return {"recommended_primitives": [], "primary_primitive": None}
            
            primitives_desc = self._get_primitive_descriptions(available_primitives)
            
            prompt = f"""Analyze this kindergarten learning objective and determine if visual primitives would enhance learning and assessment.

Subject: {subject}
Subskill: {subskill_description}
Concept Group: {detailed_objectives.get('ConceptGroup', 'General')}
Detailed Objective: {detailed_objectives.get('DetailedObjective', 'Basic understanding')}

Available Visual Primitives for {subject}:
{primitives_desc}

Consider:
1. Would visual interaction improve understanding over text-only?
2. Can this concept be meaningfully represented visually?
3. Is the primitive appropriate for kindergarten (ages 5-6)?
4. Does it allow for meaningful assessment?

Rate each relevant primitive 1-10 for effectiveness with this objective."""

            response = await self.gemini_client.aio.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config=GenerateContentConfig(
                    response_mime_type='application/json',
                    response_schema=PRIMITIVE_ANALYSIS_SCHEMA,
                    temperature=0.3,
                    max_output_tokens=1500
                )
            )
            
            if not response or not response.text:
                return {"recommended_primitives": [], "primary_primitive": None}
            
            return json.loads(response.text)
            
        except Exception as e:
            logger.error(f"Error analyzing subskill for visual potential: {e}")
            return {"recommended_primitives": [], "primary_primitive": None}
    
    async def generate_visual_problem_with_primitive(self,
                                                   subject: str,
                                                   recommendation: Dict[str, Any],
                                                   primitive_component: str) -> Optional[Dict[str, Any]]:
        """
        Generate a visual problem using specified primitive with Gemini JSON enforcement
        """
        try:
            # Get primitive-specific schema and prompt
            primitive_schema = self._get_primitive_schema(primitive_component)
            primitive_prompt = self._get_primitive_generation_prompt(
                primitive_component, subject, recommendation
            )
            
            response = await self.gemini_client.aio.models.generate_content(
                model='gemini-2.5-flash',
                contents=primitive_prompt,
                config=GenerateContentConfig(
                    response_mime_type='application/json',
                    response_schema=primitive_schema,
                    temperature=0.4,
                    max_output_tokens=3000
                )
            )
            
            if not response or not response.text:
                logger.error("Empty response from Gemini for visual problem generation")
                return None
            
            visual_problem = json.loads(response.text)
            
            # Add template structure that matches your frontend expectations
            visual_problem = self._format_for_frontend(
                visual_problem, primitive_component, subject, recommendation
            )
            
            return visual_problem
            
        except Exception as e:
            logger.error(f"Error generating visual problem with {primitive_component}: {e}")
            return None
    
    async def should_enhance_existing_problem(self,
                                            problem_data: Dict[str, Any],
                                            subject: str,
                                            recommendation: Dict[str, Any]) -> Dict[str, Any]:
        """
        Determine if an existing text problem should be enhanced with visual elements
        """
        try:
            available_primitives = self.primitive_subjects.get(subject.lower(), [])
            if not available_primitives:
                return {"should_enhance": False, "enhancement_type": "none"}
            
            primitives_desc = self._get_primitive_descriptions(available_primitives)
            
            prompt = f"""Analyze this existing kindergarten problem and determine if adding visual primitives would improve the learning experience.

Existing Problem:
Type: {problem_data.get('problem_type', 'Unknown')}
Text: {problem_data.get('problem', '')}
Answer: {problem_data.get('answer', '')}

Learning Context:
Subject: {subject}
Skill: {recommendation['skill']['description']}
Subskill: {recommendation['subskill']['description']}

Available Visual Primitives:
{primitives_desc}

Consider:
1. Would visual interaction add meaningful value?
2. Is the current problem too abstract without visuals?
3. Would kindergartners engage better with visual elements?
4. Can the concept be represented visually without losing meaning?"""

            response = await self.gemini_client.aio.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config=GenerateContentConfig(
                    response_mime_type='application/json',
                    response_schema=PROBLEM_ENHANCEMENT_SCHEMA,
                    temperature=0.3,
                    max_output_tokens=1000
                )
            )
            
            if not response or not response.text:
                return {"should_enhance": False, "enhancement_type": "none"}
            
            return json.loads(response.text)
            
        except Exception as e:
            logger.error(f"Error analyzing problem for enhancement: {e}")
            return {"should_enhance": False, "enhancement_type": "none"}
    
    async def generate_mixed_problem_set(self,
                                       student_id: int,
                                       subject: str,
                                       skill_id: str,
                                       subskill_id: str,
                                       count: int = 5,
                                       visual_ratio: float = 0.4) -> List[Dict[str, Any]]:
        """
        Generate a mixed set of text and visual problems for a specific skill
        Integrates with your existing problem generation flow
        """
        try:
            logger.info(f"Generating mixed problem set: {count} problems, {visual_ratio*100}% visual")
            
            # Calculate how many should be visual
            visual_count = max(1, int(count * visual_ratio))
            text_count = count - visual_count
            
            problems = []
            
            # Generate text problems using existing service
            if text_count > 0:
                text_problems = await self.problem_service.get_skill_problems(
                    student_id=student_id,
                    subject=subject,
                    skill_id=skill_id,
                    subskill_id=subskill_id,
                    count=text_count
                )
                problems.extend(text_problems)
            
            # Generate visual problems
            if visual_count > 0:
                visual_problems = await self._generate_visual_skill_problems(
                    student_id=student_id,
                    subject=subject,
                    skill_id=skill_id,
                    subskill_id=subskill_id,
                    count=visual_count
                )
                problems.extend(visual_problems)
            
            # Shuffle to mix text and visual
            import random
            random.shuffle(problems)
            
            logger.info(f"Generated mixed set: {len(problems)} total problems")
            return problems[:count]  # Ensure we don't exceed requested count
            
        except Exception as e:
            logger.error(f"Error generating mixed problem set: {e}")
            # Fallback to text-only problems
            return await self.problem_service.get_skill_problems(
                student_id=student_id,
                subject=subject,
                skill_id=skill_id,
                subskill_id=subskill_id,
                count=count
            )
    
    async def _generate_visual_skill_problems(self,
                                            student_id: int,
                                            subject: str,
                                            skill_id: str,
                                            subskill_id: str,
                                            count: int) -> List[Dict[str, Any]]:
        """Generate visual problems for a specific skill using your existing flow"""
        
        problems = []
        
        # Get recommendation for this skill/subskill using existing service
        if not self.problem_service.recommender:
            logger.error("ProblemRecommender not available")
            return problems
        
        try:
            for i in range(count):
                # Get recommendation using existing service
                recommendation = await self.problem_service.recommender.get_recommendation(
                    student_id=student_id,
                    subject=subject,
                    skill_filter=skill_id,
                    subskill_filter=subskill_id
                )
                
                if not recommendation:
                    continue
                
                # Get detailed objectives using existing service
                objectives = await self.problem_service.competency_service.get_detailed_objectives(
                    subject=subject,
                    subskill_id=subskill_id
                )
                
                recommendation['detailed_objectives'] = objectives
                
                # Analyze for visual potential
                analysis = await self.analyze_subskill_for_visual_potential(
                    subject=subject,
                    subskill_description=recommendation['subskill']['description'],
                    detailed_objectives=objectives
                )
                
                if analysis.get('primary_primitive'):
                    # Generate visual problem
                    visual_problem = await self.generate_visual_problem_with_primitive(
                        subject=subject,
                        recommendation=recommendation,
                        primitive_component=analysis['primary_primitive']
                    )
                    
                    if visual_problem:
                        # Add metadata consistent with existing problems
                        visual_problem['metadata'] = {
                            'unit': recommendation['unit'],
                            'skill': recommendation['skill'],
                            'subskill': recommendation['subskill'],
                            'difficulty': recommendation['difficulty'],
                            'objectives': objectives,
                            'subject': subject,
                            'visual_primitive': analysis['primary_primitive']
                        }
                        
                        # Cache in Cosmos DB using existing service
                        if self.problem_service.cosmos_db:
                            await self.problem_service.cosmos_db.save_cached_problem(
                                subject=subject,
                                skill_id=skill_id,
                                subskill_id=subskill_id,
                                problem_data=visual_problem
                            )
                        
                        problems.append(visual_problem)
            
            return problems
            
        except Exception as e:
            logger.error(f"Error generating visual skill problems: {e}")
            return problems
    
    def _get_primitive_descriptions(self, primitives: List[str]) -> str:
        """Get human-readable descriptions for LLM"""
        descriptions = {
            "NumberLine": "Interactive number line - students place markers, identify positions, work with numerical relationships",
            "FractionBars": "Visual fraction bars - colored segments that can be divided, compared, and combined",
            "AreaModel": "Grid-based area model - for multiplication, arrays, and spatial reasoning",
            "DiagramLabeler": "Interactive diagrams - students drag labels to correct positions (cells, body parts, etc.)",
            "PartFunctionMatcher": "Matching activity - connects parts/components to their functions or roles",
            "MoonPhaseSelector": "Moon phase activity - identify and sequence different phases of the moon",
            "OrbitPanel": "Solar system visualization - shows planetary orbits and celestial relationships",
            "EvidenceHighlighter": "Text highlighting - students select evidence from passages to support conclusions",
            "PartsOfSpeechTagger": "Grammar tagging - identify and tag different parts of speech in sentences",
            "MapLabeler": "Geographic labeling - place labels on maps for regions, countries, or features",
            "TimelineBuilder": "Historical sequencing - arrange events in chronological order on interactive timeline"
        }
        
        return "\n".join([f"- {primitive}: {descriptions.get(primitive, 'Interactive component')}" 
                         for primitive in primitives])
    
    def _get_primitive_schema(self, primitive_component: str) -> Dict[str, Any]:
        """Get JSON schema for specific primitive"""
        
        # Base schema that all primitives share
        base_schema = VISUAL_PROBLEM_SCHEMA.copy()
        
        # Customize primitive_config based on component type
        if primitive_component == "NumberLine":
            base_schema["properties"]["primitive_config"]["properties"] = {
                "min": {"type": "number"},
                "max": {"type": "number"},
                "step": {"type": "number"},
                "tick_density": {"type": "string"},
                "target_value": {"type": "number"},
                "show_labels": {"type": "boolean"},
                "highlight_zones": {"type": "array", "items": {"type": "object"}}
            }
        
        elif primitive_component == "DiagramLabeler":
            base_schema["properties"]["primitive_config"]["properties"] = {
                "diagram_id": {"type": "string"},
                "hotspots": {"type": "array", "items": {"type": "object"}},
                "label_options": {"type": "array", "items": {"type": "string"}},
                "svg_content": {"type": "string"}
            }
        
        elif primitive_component == "EvidenceHighlighter":
            base_schema["properties"]["primitive_config"]["properties"] = {
                "passage_text": {"type": "string"},
                "max_selections": {"type": "integer"},
                "highlight_color": {"type": "string"},
                "show_line_numbers": {"type": "boolean"}
            }
        
        # Add more primitive-specific schemas as needed
        
        return base_schema
    
    def _get_primitive_generation_prompt(self, primitive: str, subject: str, recommendation: Dict[str, Any]) -> str:
        """Get primitive-specific generation prompt"""
        
        base_context = f"""Generate a visual problem for kindergarten students using the {primitive} primitive.

Learning Context:
Subject: {subject}
Unit: {recommendation['unit']['title']}
Skill: {recommendation['skill']['description']}
Subskill: {recommendation['subskill']['description']}
Concept Group: {recommendation['detailed_objectives'].get('ConceptGroup', 'General')}
Specific Learning Objective: {recommendation['detailed_objectives'].get('DetailedObjective', 'Basic understanding')}

Requirements:
- Age-appropriate for 5-6 year olds
- Clear, simple instructions
- Engaging context (animals, toys, family situations)
- Meaningful interaction with the visual element
- Assessable learning outcome

"""

        if primitive == "NumberLine":
            return base_context + """Create a NumberLine problem where students interact with number positions.

Set min/max/step values appropriate for kindergarten (typically 0-10 or 0-20).
Make target_value align with the learning objective.
Use engaging contexts like "Help the bunny hop to number 7" or "Find where the toy car should park."

The primitive_config should have realistic values for kindergarten number work."""

        elif primitive == "DiagramLabeler":
            return base_context + """Create a DiagramLabeler problem with drag-and-drop labeling.

Choose a diagram appropriate for the subject (cell parts, body parts, plant parts, etc.).
Create 2-4 hotspots with realistic x,y positions (assume 300x200 pixel diagram).
Provide 4-6 label options including correct answers and reasonable distractors.
Use simple, clear labels that kindergartners can read or recognize."""

        elif primitive == "EvidenceHighlighter":
            return base_context + """Create an EvidenceHighlighter problem with text selection.

Write a short, engaging passage (3-5 sentences) appropriate for kindergarten reading level.
Ask students to highlight evidence for a simple conclusion.
Use familiar topics and vocabulary.
Set max_selections to 1-2 for kindergarten attention spans."""

        else:
            return base_context + f"""Create a {primitive} problem appropriate for kindergarten.

Follow the component's interaction pattern and make it engaging for young learners.
Ensure the primitive_config contains all necessary parameters for the component to work properly."""
    
    def _format_for_frontend(self, 
                           visual_problem: Dict[str, Any], 
                           primitive_component: str,
                           subject: str, 
                           recommendation: Dict[str, Any]) -> Dict[str, Any]:
        """Format the generated problem to match frontend expectations"""
        
        # Add the template structure that your frontend expects
        visual_problem['template'] = {
            'id': str(uuid.uuid4()),
            'type': 'visual',
            'subject': subject,
            'skill_id': recommendation['skill']['id'],
            'primitive': {
                'component': primitive_component,
                'props': visual_problem['primitive_config']
            },
            'problem_text': visual_problem['problem'],
            'params': visual_problem.get('params', {}),
            'answer_key': visual_problem['answer'],
            'grading_config': visual_problem.get('grading_config', {'type': 'exact_match'}),
            'metadata': {
                'difficulty': recommendation.get('difficulty', 5),
                'estimated_time_minutes': visual_problem.get('estimated_time_minutes', 3),
                'tags': ['visual', primitive_component.lower()],
                'visual_elements': visual_problem.get('visual_elements', {})
            }
        }
        
        return visual_problem