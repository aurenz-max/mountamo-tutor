"""
Visual Problems API Endpoints

FastAPI endpoints for the visual problem library system.
Integrates with existing authentication and problem generation flow.
"""

import logging
from typing import Dict, List, Optional, Any
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel

from ...core.middleware import get_user_context
from ...services.problems import ProblemService
from ...services.visual_problem_service import VisualProblemService
from ...services.competency import CompetencyService
from ...services.recommender import ProblemRecommender
from ...db.cosmos_db import CosmosDBService
from ...db.problem_optimizer import ProblemOptimizer

logger = logging.getLogger(__name__)

router = APIRouter()

# Request/Response Models
class AnalyzeSkillRequest(BaseModel):
    subject: str
    subskill_description: str
    detailed_objectives: Optional[Dict[str, Any]] = {}

class AnalyzeSkillResponse(BaseModel):
    recommended_primitives: List[Dict[str, Any]]
    primary_primitive: Optional[str]
    visual_concepts: List[str] = []
    interaction_types: List[str] = []
    suitability_assessment: Optional[str] = None

class GenerateVisualProblemsRequest(BaseModel):
    student_id: int
    subject: str
    skill_id: Optional[str] = None
    subskill_id: Optional[str] = None
    count: int = 5
    visual_ratio: float = 0.4  # 40% visual by default
    primitive_preference: Optional[str] = None

class GenerateVisualProblemsResponse(BaseModel):
    problems: List[Dict[str, Any]]
    total_count: int
    visual_count: int
    text_count: int
    generated_at: str

class EnhanceProblemsRequest(BaseModel):
    problems: List[Dict[str, Any]]
    subject: str
    enhancement_threshold: float = 0.3  # 30% chance to enhance

class PrimitiveCapabilitiesResponse(BaseModel):
    available_primitives: Dict[str, List[str]]
    primitive_descriptions: Dict[str, str]
    subject_mappings: Dict[str, List[str]]


# Dependency to initialize services
async def get_visual_problem_service() -> VisualProblemService:
    """Initialize the visual problem service with dependencies"""
    # Initialize base services using existing pattern
    problem_service = ProblemService()
    
    # Set up dependencies (this would normally be done via dependency injection)
    problem_service.competency_service = CompetencyService()
    problem_service.recommender = ProblemRecommender()
    problem_service.cosmos_db = CosmosDBService()
    problem_service.problem_optimizer = ProblemOptimizer()
    
    return VisualProblemService(problem_service)


@router.get("/capabilities", response_model=PrimitiveCapabilitiesResponse)
async def get_primitive_capabilities():
    """Get available visual primitives and their capabilities"""
    try:
        visual_service = await get_visual_problem_service()
        
        primitive_descriptions = {
            "NumberLine": "Interactive number line for number sense and positioning",
            "FractionBars": "Visual fraction representation with colored segments", 
            "AreaModel": "Grid-based model for multiplication and area concepts",
            "DiagramLabeler": "Interactive diagrams with drag-drop labeling",
            "PartFunctionMatcher": "Matching components to their functions",
            "MoonPhaseSelector": "Moon phase identification and sequencing",
            "OrbitPanel": "Solar system and orbital mechanics visualization",
            "EvidenceHighlighter": "Text evidence selection and highlighting",
            "PartsOfSpeechTagger": "Grammar identification and tagging",
            "MapLabeler": "Geographic labeling and location identification",
            "TimelineBuilder": "Historical event sequencing and chronology"
        }
        
        return PrimitiveCapabilitiesResponse(
            available_primitives=visual_service.primitive_subjects,
            primitive_descriptions=primitive_descriptions,
            subject_mappings=visual_service.primitive_subjects
        )
        
    except Exception as e:
        logger.error(f"Error getting primitive capabilities: {e}")
        raise HTTPException(status_code=500, detail="Failed to get primitive capabilities")


@router.post("/analyze-skill", response_model=AnalyzeSkillResponse)
async def analyze_skill_for_visual_potential(
    request: AnalyzeSkillRequest,
    user_context: dict = Depends(get_user_context)
):
    """Analyze a skill/subskill to determine visual primitive suitability"""
    try:
        visual_service = await get_visual_problem_service()
        
        analysis = await visual_service.analyze_subskill_for_visual_potential(
            subject=request.subject,
            subskill_description=request.subskill_description,
            detailed_objectives=request.detailed_objectives
        )
        
        return AnalyzeSkillResponse(**analysis)
        
    except Exception as e:
        logger.error(f"Error analyzing skill for visual potential: {e}")
        raise HTTPException(status_code=500, detail="Failed to analyze skill")


@router.post("/generate", response_model=GenerateVisualProblemsResponse)
async def generate_visual_problems(
    request: GenerateVisualProblemsRequest,
    background_tasks: BackgroundTasks,
    user_context: dict = Depends(get_user_context)
):
    """Generate a mixed set of visual and text problems"""
    try:
        visual_service = await get_visual_problem_service()
        
        if request.skill_id and request.subskill_id:
            # Generate problems for specific skill
            problems = await visual_service.generate_mixed_problem_set(
                student_id=request.student_id,
                subject=request.subject,
                skill_id=request.skill_id,
                subskill_id=request.subskill_id,
                count=request.count,
                visual_ratio=request.visual_ratio
            )
        else:
            # Generate problems using general recommendation system
            problems = []
            logger.warning("General problem generation not yet implemented")
        
        # Count visual vs text problems
        visual_count = sum(1 for p in problems if p.get('template') is not None)
        text_count = len(problems) - visual_count
        
        # Log telemetry in background
        background_tasks.add_task(
            log_problem_generation_telemetry,
            student_id=request.student_id,
            subject=request.subject,
            total_count=len(problems),
            visual_count=visual_count,
            user_id=user_context["user_id"]
        )
        
        return GenerateVisualProblemsResponse(
            problems=problems,
            total_count=len(problems),
            visual_count=visual_count,
            text_count=text_count,
            generated_at=datetime.utcnow().isoformat()
        )
        
    except Exception as e:
        logger.error(f"Error generating visual problems: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate visual problems")


@router.post("/enhance", response_model=List[Dict[str, Any]])
async def enhance_existing_problems(
    request: EnhanceProblemsRequest,
    user_context: dict = Depends(get_user_context)
):
    """Analyze existing problems and enhance suitable ones with visual elements"""
    try:
        visual_service = await get_visual_problem_service()
        
        enhanced_problems = []
        
        for problem in request.problems:
            # Create a basic recommendation structure for analysis
            recommendation = {
                'skill': {'description': problem.get('metadata', {}).get('skill', {}).get('description', '')},
                'subskill': {'description': problem.get('metadata', {}).get('subskill', {}).get('description', '')},
                'detailed_objectives': problem.get('metadata', {}).get('objectives', {})
            }
            
            # Check if this problem should be enhanced
            enhancement_analysis = await visual_service.should_enhance_existing_problem(
                problem_data=problem,
                subject=request.subject,
                recommendation=recommendation
            )
            
            if enhancement_analysis.get('should_enhance', False):
                # Try to enhance the problem
                if enhancement_analysis.get('recommended_primitive'):
                    visual_problem = await visual_service.generate_visual_problem_with_primitive(
                        subject=request.subject,
                        recommendation=recommendation,
                        primitive_component=enhancement_analysis['recommended_primitive']
                    )
                    
                    if visual_problem:
                        # Merge visual elements with original problem
                        enhanced_problem = problem.copy()
                        enhanced_problem['template'] = visual_problem['template']
                        enhanced_problem['visual_enhancement'] = {
                            'type': enhancement_analysis['enhancement_type'],
                            'primitive': enhancement_analysis['recommended_primitive'],
                            'reason': enhancement_analysis['enhancement_reason']
                        }
                        enhanced_problems.append(enhanced_problem)
                        continue
            
            # If not enhanced, add original problem
            enhanced_problems.append(problem)
        
        return enhanced_problems
        
    except Exception as e:
        logger.error(f"Error enhancing problems: {e}")
        raise HTTPException(status_code=500, detail="Failed to enhance problems")


@router.get("/primitive/{primitive_name}")
async def get_primitive_info(
    primitive_name: str,
    user_context: dict = Depends(get_user_context)
):
    """Get detailed information about a specific primitive component"""
    try:
        visual_service = await get_visual_problem_service()
        
        # Get primitive info from the service
        primitive_info = {
            "name": primitive_name,
            "subjects": [],
            "description": "",
            "interaction_types": [],
            "example_configs": {}
        }
        
        # Find which subjects support this primitive
        for subject, primitives in visual_service.primitive_subjects.items():
            if primitive_name in primitives:
                primitive_info["subjects"].append(subject)
        
        # Add description and example config based on primitive type
        if primitive_name == "NumberLine":
            primitive_info.update({
                "description": "Interactive number line where students can place markers and identify positions",
                "interaction_types": ["click", "drag", "position"],
                "example_configs": {
                    "basic": {"min": 0, "max": 10, "step": 1, "show_labels": True},
                    "fractions": {"min": 0, "max": 2, "step": 0.25, "tick_density": "dense"}
                }
            })
        elif primitive_name == "DiagramLabeler":
            primitive_info.update({
                "description": "Interactive diagrams where students drag labels to correct positions",
                "interaction_types": ["drag", "drop", "label"],
                "example_configs": {
                    "cell_diagram": {
                        "diagram_id": "plant_cell",
                        "hotspots": [{"id": "nucleus", "x": 150, "y": 100, "width": 40, "height": 40}],
                        "label_options": ["Nucleus", "Chloroplast", "Cell Wall"]
                    }
                }
            })
        # Add more primitive types as needed
        
        return primitive_info
        
    except Exception as e:
        logger.error(f"Error getting primitive info for {primitive_name}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get primitive information")


@router.get("/health")
async def visual_problems_health():
    """Health check for visual problems service"""
    try:
        visual_service = await get_visual_problem_service()
        
        # Basic connectivity test
        test_analysis = await visual_service.analyze_subskill_for_visual_potential(
            subject="math",
            subskill_description="counting numbers",
            detailed_objectives={"ConceptGroup": "Number Sense", "DetailedObjective": "Count to 10"}
        )
        
        return {
            "status": "healthy",
            "service": "visual_problems",
            "gemini_connection": "healthy" if test_analysis else "degraded",
            "available_primitives": len(visual_service.primitive_subjects),
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        return {
            "status": "unhealthy",
            "service": "visual_problems", 
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


# Background task functions
async def log_problem_generation_telemetry(
    student_id: int,
    subject: str, 
    total_count: int,
    visual_count: int,
    user_id: str
):
    """Log telemetry for problem generation in background"""
    try:
        # This would integrate with your existing telemetry system
        telemetry_data = {
            "event_type": "visual_problem_generation",
            "student_id": student_id,
            "subject": subject,
            "total_problems": total_count,
            "visual_problems": visual_count,
            "text_problems": total_count - visual_count,
            "visual_ratio": visual_count / total_count if total_count > 0 else 0,
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        logger.info(f"Visual problem generation telemetry: {telemetry_data}")
        # Here you would save to your analytics database
        
    except Exception as e:
        logger.error(f"Error logging problem generation telemetry: {e}")


# Import statement fix
from datetime import datetime