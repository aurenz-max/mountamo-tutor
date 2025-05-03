from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

# Import dependencies
from ...dependencies import get_problem_service, get_competency_service, get_problem_recommender, get_analytics_extension, get_review_service, get_anthropic_service
from ...services.problems import ProblemService
from ...services.anthropic import AnthropicService
from ...services.competency import CompetencyService, AnalyticsExtension
from ...services.recommender import ProblemRecommender
from ...services.review import ReviewService
import re
from pathlib import Path
from datetime import datetime, timedelta
import logging  # Add explicit logging import

# Set up logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)  # Set to DEBUG for more details


router = APIRouter()

class ProblemRequest(BaseModel):
    student_id: int
    subject: str
    unit_id: Optional[str] = None
    skill_id: Optional[str] = None
    subskill_id: Optional[str] = None
    difficulty: Optional[float] = None

class ProblemResponse(BaseModel):
    problem_type: str
    problem: str
    answer: str
    success_criteria: List[str]
    teaching_note: str
    metadata: Dict[str, Any]  # Contains competency/recommendation data

class ProblemSubmission(BaseModel):
    subject: str
    problem: Dict[str, Any]  # Complete problem object
    solution_image: str  # Base64 encoded image
    skill_id: str
    subskill_id: Optional[str] = None
    student_answer: Optional[str] = ""
    canvas_used: bool = True
    student_id: int

class ReviewAnalyticsRequest(BaseModel):
    student_id: int
    subject: str
    days: Optional[int] = 30
    skill_id: Optional[str] = None

@router.post("/generate")
async def generate_problem(
    request: ProblemRequest,
    problem_service: ProblemService = Depends(get_problem_service)
) -> ProblemResponse:
    """Generate a new problem based on curriculum parameters"""
    try:
        logger.info(f"Received problem generation request: {request}")
        
        # Validate subject at minimum
        if not request.subject:
            raise HTTPException(status_code=400, detail="Subject is required")
            
        context = {
            "unit": request.unit_id,
            "skill": request.skill_id,
            "subskill": request.subskill_id
        }
        
        logger.info(f"Processing with context: {context}")
        
        # Let the recommender handle missing parameters
        problem = await problem_service.get_problem(
            student_id=request.student_id,
            subject=request.subject,
            context=context
        )
        
        if not problem:
            logger.error("No problem generated")
            raise HTTPException(
                status_code=404, 
                detail="Failed to generate problem. Check server logs for details."
            )
            
        logger.info(f"Generated problem: {problem}")
        return ProblemResponse(**problem)
        
    except HTTPException as e:
        raise
    except Exception as e:
        logger.error(f"Error in generate_problem endpoint: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )
    
@router.post("/submit")
async def submit_problem(
    submission: ProblemSubmission,
    review_service: ReviewService = Depends(get_review_service),  # Changed from problem_service
    competency_service: CompetencyService = Depends(get_competency_service)
) -> Dict[str, Any]:
    """Submit a problem solution for review and update competency"""
    try:
        # Ensure we have valid base64 data
        if not submission.solution_image:
            raise HTTPException(status_code=400, detail="No image data provided")

        # Clean the base64 string if needed
        image_data = submission.solution_image
        if ',' in image_data:
            image_data = image_data.split(',', 1)[1]
            
        # Validate base64 format
        if not re.match(r'^[A-Za-z0-9+/=]+$', image_data):
            raise HTTPException(status_code=400, detail="Invalid image data format")

        # Get problem review from the review service instead of problem service
        review = await review_service.review_problem(
            student_id=submission.student_id,
            subject=submission.subject,
            problem=submission.problem,
            solution_image_base64=image_data,
            skill_id=submission.skill_id,
            subskill_id=submission.subskill_id,
            student_answer=submission.student_answer or "",
            canvas_used=submission.canvas_used
        )
        
        if "error" in review:
            raise HTTPException(status_code=500, detail=review["error"])
        
        # Update student's competency based on review
        competency_update = await competency_service.update_competency_from_problem(
            student_id=submission.student_id,
            subject=submission.subject,
            skill_id=submission.skill_id,
            subskill_id=submission.subskill_id,
            evaluation=review
        )
        
        # Return combined response
        return {
            "review": review,
            "competency": competency_update
        }
            
    except Exception as e:
        logger.error(f"Error in submit_problem: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
@router.get("/student/{student_id}/recommended-problems")
async def get_recommended_problems(
    student_id: int,
    subject: Optional[str] = None,
    count: int = Query(3, ge=1, le=10, description="Number of problems to generate"),
    analytics_service: AnalyticsExtension = Depends(get_analytics_extension),
    problem_service: ProblemService = Depends(get_problem_service)
) -> List[ProblemResponse]:
    """
    Get personalized recommended problems for a student based on their analytics.
    Returns multiple problems in a single call based on the top recommendations.
    """
    try:
        logger.info(f"Getting {count} recommended problems for student {student_id}")
        
        # Step 1: Get recommendations from analytics service
        recommendations = await analytics_service.get_recommendations(
            student_id, subject, limit=count
        )
        
        if not recommendations or len(recommendations) == 0:
            logger.error("No recommendations found for this student")
            raise HTTPException(
                status_code=404,
                detail="No recommendations found for this student"
            )
            
        logger.info(f"Got {len(recommendations)} recommendations")
            
        # Step 2: Generate multiple problems in a single call
        problems = await problem_service.get_multiple_problems(
            student_id=student_id,
            subject=subject,
            recommendations=recommendations
        )
        
        if not problems:
            logger.error("Failed to generate recommended problems")
            raise HTTPException(
                status_code=500,
                detail="Failed to generate recommended problems"
            )
            
        logger.info(f"Generated {len(problems)} problems successfully")
        return problems
        
    except HTTPException as e:
        raise
    except Exception as e:
        logger.error(f"Error in get_recommended_problems endpoint: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@router.get("/skill-problems/{student_id}")
async def get_skill_problems(
    student_id: int,
    subject: str,
    skill_id: str,
    subskill_id: str,
    count: int = Query(5, ge=3, le=8, description="Number of problems to generate"),
    problem_service: ProblemService = Depends(get_problem_service)
) -> List[ProblemResponse]:
    """
    Get multiple problems for a specific skill and subskill.
    Returns varied problems with different concept groups for the same skill/subskill.
    """
    try:
        logger.info(f"Getting {count} problems for student {student_id}, skill {skill_id}, subskill {subskill_id}")
        
        # Get the problems from the service
        problems = await problem_service.get_skill_problems(
            student_id=student_id,
            subject=subject,
            skill_id=skill_id,
            subskill_id=subskill_id,
            count=count
        )
        
        logger.info(f"Retrieved {len(problems) if problems else 0} problems from service")
        
        if not problems or len(problems) == 0:
            logger.error(f"No problems generated for skill {skill_id}, subskill {subskill_id}")
            raise HTTPException(
                status_code=404,
                detail="Failed to generate problems for the specified skill/subskill"
            )
        
        # Log problem details to verify data structure
        for i, problem in enumerate(problems):
            logger.debug(f"Problem {i+1} type: {problem.get('problem_type', 'unknown')}")
            logger.debug(f"Problem {i+1} keys: {problem.keys()}")
        
        logger.info(f"Successfully returning {len(problems)} problems")
        return problems
        
    except HTTPException as e:
        logger.error(f"HTTP Exception in get_skill_problems: {e.detail}")
        raise
    except Exception as e:
        logger.error(f"Error in get_skill_problems endpoint: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@router.post("/generate-svg-assessment")
async def generate_svg_assessment(
    request: ProblemRequest,
    problem_service: ProblemService = Depends(get_problem_service),
    competency_service: CompetencyService = Depends(get_competency_service),
    anthropic_service: AnthropicService = Depends(get_anthropic_service)
) -> Dict[str, Any]:
    """Generate an SVG assessment based on student competency and curriculum data"""
    try:
        logger.info(f"Received SVG assessment generation request: {request}")
        
        # Validate subject at minimum
        if not request.subject:
            raise HTTPException(status_code=400, detail="Subject is required")
                    
        # Get detailed objectives for the subskill
        objectives = None
        if request.subskill_id:
            objectives = await competency_service.get_detailed_objectives(
                subject=request.subject,
                subskill_id=request.subskill_id
            )
        
        # Prepare context for SVG generation
        context = {
            "student_id": request.student_id,
            "subject": request.subject,
            "skill_id": request.skill_id,
            "subskill_id": request.subskill_id,
            "objectives": objectives,
            "difficulty": request.difficulty or 1.0  # Default to 1.0 if not provided
        }
        
        logger.info(f"Preparing SVG generation with context: {context}")
        
        # Generate SVG assessment using Claude
        svg_content = await generate_svg_with_claude(anthropic_service, context)
        
        if not svg_content:
            logger.error("No SVG content generated")
            raise HTTPException(
                status_code=500, 
                detail="Failed to generate SVG assessment"
            )
            
        logger.info("Successfully generated SVG assessment")
        return {
            "svg_content": svg_content,
            "metadata": {
                "student_id": request.student_id,
                "subject": request.subject,
                "skill_id": request.skill_id,
                "subskill_id": request.subskill_id,
                "objectives": objectives
            }
        }
        
    except HTTPException as e:
        raise
    except Exception as e:
        logger.error(f"Error in generate_svg_assessment endpoint: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

async def generate_svg_with_claude(
    anthropic_service: AnthropicService, 
    context: Dict[str, Any]
) -> str:
    """Generate an SVG assessment using Claude based on the provided context"""
    try:
        # Extract key information from context
        subject = context.get("subject", "")
        skill_id = context.get("skill_id", "")
        subskill_id = context.get("subskill_id", "")
        objectives = context.get("objectives", {})
        difficulty = context.get("difficulty", 1.0)
                
        # Extract concept group and detailed objective
        concept_group = objectives.get("ConceptGroup", "") if objectives else ""
        detailed_objective = objectives.get("DetailedObjective", "") if objectives else ""
        subskill_description = objectives.get("SubskillDescription", "") if objectives else ""
        
        # Create prompt for Claude
        prompt = [
            {
                "role": "user", 
                "content": f"""
                Create an interactive SVG assessment worksheet for a kindergarten student focusing on:
                
                Subject: {subject}
                Skill: {skill_id}
                Subskill: {subskill_id}
                Concept Group: {concept_group}
                Detailed Objective: {detailed_objective}
                Subskill Description: {subskill_description}
                
                Target difficulty level: {difficulty}/10
                
                Requirements:
                1. Create an age-appropriate worksheet that tests the specific subskill and concept
                2. Include a title, clear instructions, and visually engaging elements
                3. Create appropriate blank spaces or interactive elements for student responses
                4. Include at least 5-8 questions or problems focused on the concept
                5. Scale the difficulty appropriately based on the target difficulty
                6. Include decorative elements to make it visually appealing for kindergarteners
                7. The SVG should be compact but complete with a viewBox of "0 0 800 600"
                8. IMPORTANT: Use single quotes (') instead of double quotes (") in your SVG attributes
                9. Keep the SVG simple enough to fit within token limits
                10. Return ONLY the SVG code with NO explanation
                """
            }
        ]
        
        system_instructions = """
        You are an expert educational content creator specializing in creating interactive SVG assessments for kindergarten students.
        Your task is to generate a complete, well-formed SVG assessment based on the curriculum data provided.
        
        IMPORTANT CONSTRAINTS:
        - Return ONLY the SVG code without any explanation
        - Your response must start with <svg and end with </svg>
        - Use single quotes (') for all attribute values, not double quotes (")
        - Keep your SVG simple and compact to avoid token limits
        - Use a simple design with just enough elements to fulfill the requirements
        """
        
        # Call Claude to generate the SVG
        logger.info("Sending request to Claude for SVG generation")
        
        # Increase max_tokens to ensure we get the complete SVG
        svg_content = await anthropic_service.generate_response(
            prompt=prompt,
            system_instructions=system_instructions
        )
        
        # Log more details about what we received
        logger.debug(f"Response type: {type(svg_content)}")
        logger.debug(f"Response length: {len(svg_content)}")
        logger.debug(f"First 100 chars: {svg_content[:100]}")
        logger.debug(f"Last 100 chars: {svg_content[-100:] if len(svg_content) > 100 else 'N/A'}")
        
        # Clean up the response to ensure it's only SVG
        svg_content = svg_content.strip()
        
        # Check if the content is wrapped in markdown code blocks and remove them
        if svg_content.startswith("```") and "```" in svg_content:
            logger.debug("Detected markdown code blocks, removing them")
            # Find the last occurrence of ```
            last_backtick = svg_content.rfind("```")
            svg_content = svg_content[3:last_backtick].strip()
            
            # Remove language identifier if present
            if "\n" in svg_content and not svg_content.startswith("<"):
                svg_content = svg_content[svg_content.find("\n")+1:].strip()
        
        # Make sure it starts with SVG tag
        if not svg_content.startswith("<svg"):
            logger.debug("SVG doesn't start with <svg> tag, attempting to extract SVG content")
            # Try to extract just the SVG part
            svg_start = svg_content.find("<svg")
            
            if svg_start >= 0:
                logger.debug(f"Found SVG start tag at position {svg_start}")
                svg_content = svg_content[svg_start:]
            else:
                logger.error(f"Could not find SVG start tag in content")
                raise ValueError("Generated content does not contain valid SVG start tag")
        
        # Ensure we have a closing tag
        if "</svg>" not in svg_content:
            logger.warning("SVG closing tag not found, adding one")
            svg_content += "</svg>"
        elif not svg_content.rstrip().endswith("</svg>"):
            # If there's content after the closing tag, trim it
            svg_end = svg_content.rfind("</svg>") + 6
            logger.warning(f"Found content after SVG closing tag, trimming at position {svg_end}")
            svg_content = svg_content[:svg_end]
        
        # Handle escaped quotes - this is the key fix for your issue
        svg_content = svg_content.replace('\\"', '"')
        svg_content = svg_content.replace("\\'", "'")
        
        # Normalize quotes to use single quotes for attributes to avoid escaping issues
        # This is more complex and might require an HTML/XML parser to do properly
        # For now, we'll stick with the simpler solution above
            
        # Final validation
        if not svg_content.startswith("<svg") or not svg_content.rstrip().endswith("</svg>"):
            logger.error(f"Final validation failed. Content starts with: {svg_content[:20]}, ends with: {svg_content[-20:]}")
            raise ValueError("Could not create valid SVG with proper tags after processing")
            
        logger.info("Successfully processed SVG content")
        return svg_content
        
    except Exception as e:
        logger.error(f"Error generating SVG with Claude: {str(e)}")
        # Log more details about the error
        import traceback
        logger.error(traceback.format_exc())
        raise