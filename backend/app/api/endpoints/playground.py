# backend/app/api/endpoints/playground.py
from fastapi import APIRouter, HTTPException, Depends, Body
from typing import Optional, Dict, Any, List
from google import genai
from google.genai import types  # Import types for ThinkingConfig
import os
import re
import logging
import traceback
import time
import hashlib

from pydantic import BaseModel

from ...core.config import settings

# Add the dependency
from ...db.cosmos_db import CosmosDBService
from ...dependencies import get_cosmos_db

# Set up logging with more detail
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


# Router setup
router = APIRouter()

# System instructions for P5js Playground
SYSTEM_INSTRUCTIONS = """You're an extremely proficient creative coding agent, and can code effects, games, generative art.
write javascript code assuming it's in a live p5js environment.
return the code block.
you can include a short paragraph explaining your reasoning and the result in human readable form.
there can be no external dependencies: all functions must be in the returned code.
make extra sure that all functions are either declared in the code or part of p5js.
the user can modify the code, go along with the user's changes."""

class P5jsCodeSnippet(BaseModel):
    title: str
    code: str
    description: Optional[str] = ""
    tags: Optional[List[str]] = []
    
    # Legacy syllabus metadata fields (keeping for backward compatibility)
    unit_id: Optional[str] = None
    unit_title: Optional[str] = None
    skill_id: Optional[str] = None
    skill_description: Optional[str] = None
    subskill_id: Optional[str] = None
    subskill_description: Optional[str] = None
    
    # New educational metadata fields
    subject: Optional[str] = None
    skill: Optional[str] = None  # Note: This conflicts with skill_id above, consider renaming one
    subskill: Optional[str] = None  # Note: This conflicts with subskill_id above
    key_concepts: Optional[List[str]] = None

class P5jsCodeResponse(BaseModel):
    id: str
    title: str
    code: str
    description: Optional[str] = ""
    tags: Optional[List[str]] = []
    created_at: str
    updated_at: str
    
    # Legacy syllabus metadata fields
    unit_id: Optional[str] = None
    unit_title: Optional[str] = None
    skill_id: Optional[str] = None
    skill_description: Optional[str] = None
    subskill_id: Optional[str] = None
    subskill_description: Optional[str] = None
    
    # New educational metadata fields
    subject: Optional[str] = None
    skill: Optional[str] = None
    subskill: Optional[str] = None
    key_concepts: Optional[List[str]] = []

class ConversationMessage(BaseModel):
    role: str
    text: str

class StudentEvaluationRequest(BaseModel):
    studentId: int
    exerciseId: str
    finalCode: str
    chatInteractions: List[Dict[str, str]]
    programOutput: Optional[Dict[str, Any]] = None
    conceptDomain: str
    exerciseMetadata: Optional[Dict[str, Any]] = None

class StudentEvaluationResponse(BaseModel):
    evaluationId: str
    studentId: int
    exerciseId: str
    evaluation: str
    overallGrade: str
    numericScore: Optional[float] = None
    criterionScores: List[float]
    timestamp: str
    exerciseData: Dict[str, str]

# Helper function to extract code from Gemini's response
def extract_code(text: str) -> str:
    """Extract JavaScript code from the response text with enhanced logging."""
    logger.info(f"Extracting code from response of length {len(text)}")
    
    start_mark = "```javascript"
    code_start = text.find(start_mark)
    
    if code_start > -1:
        code_start_pos = code_start + len(start_mark)
        logger.info(f"Found code start marker at position {code_start}")
        
        code_end = text.rfind("```")
        if code_end < 0 or code_end <= code_start_pos:
            logger.warning(f"No valid end marker found after position {code_start_pos}")
            # Return the rest of the text if no end marker
            return text[code_start_pos:]
        
        logger.info(f"Found code end marker at position {code_end}")
        code_block = text[code_start_pos:code_end]
        
        # Check for potential issues in the extracted code
        if len(code_block.strip()) == 0:
            logger.warning("Extracted code block is empty")
        if "```" in code_block:
            logger.warning("Extracted code contains unexpected code fence markers")
        if len(code_block) > 30000:
            logger.warning(f"Extracted code is unusually large: {len(code_block)} chars")
        
        return code_block
    else:
        logger.warning("No code start marker found in the response")
        
        # Check if there's any code block at all, might be missing language indicator
        generic_code_start = text.find("```")
        if generic_code_start > -1:
            logger.info(f"Found generic code marker at {generic_code_start}, but no JavaScript marker")
        
        return ""

def compute_code_hash(code):
    """Compute a hash of the code for tracking changes."""
    if not code:
        return "no_code"
    return hashlib.md5(code.encode('utf-8')).hexdigest()

def log_code_diff(old_code, new_code):
    """Log differences between old and new code."""
    if not old_code or not new_code:
        logger.info("Cannot compute diff - one of the code samples is empty")
        return
    
    # Simple line count comparison for logging
    old_lines = old_code.split('\n')
    new_lines = new_code.split('\n')
    
    logger.info(f"Code change: {len(old_lines)} lines -> {len(new_lines)} lines")
    
    # Log first few changed lines for context (not the whole code for privacy/space)
    changed = False
    for i in range(min(10, min(len(old_lines), len(new_lines)))):
        if old_lines[i] != new_lines[i]:
            logger.info(f"First change at line {i+1}: '{old_lines[i]}' -> '{new_lines[i]}'")
            changed = True
            break
    
    if not changed and len(old_lines) != len(new_lines):
        logger.info(f"Changes appear after line {min(len(old_lines), len(new_lines))}")

# Enhanced version of your process_playground_request function with better logging
@router.post("/gemini")
async def process_playground_request(
    message: str = Body(..., description="User message"),
    role: str = Body(..., description="Message role (user, system, etc.)"),
    code: Optional[str] = Body(None, description="Current P5js code"),
    codeHasChanged: bool = Body(False, description="Whether code has been modified"),
    conversationHistory: Optional[List[Dict[str, str]]] = Body(None, description="Previous conversation messages")
):
    """Process P5js playground requests using Gemini API with simplified code context handling."""
    start_time = time.time()
    request_id = f"req_{int(start_time * 1000)}"
    code_hash = hashlib.md5(code.encode('utf-8')).hexdigest() if code else "no_code"
    
    try:
        logger.info(f"[{request_id}] Processing playground request: role={role}, message_length={len(message)}")
        logger.info(f"[{request_id}] Request metadata: codeHasChanged={codeHasChanged}, code_hash={code_hash}")
        
        # Log code info with more detail
        if code:
            code_lines = len(code.splitlines())
            code_bytes = len(code.encode('utf-8'))
            logger.info(f"[{request_id}] Code info: lines={code_lines}, bytes={code_bytes}")
            
            # Log sample of code beginning (for context)
            first_lines = code.split('\n')[:3]
            logger.info(f"[{request_id}] Code begins with: {first_lines}")
        else:
            logger.info(f"[{request_id}] No code provided")
        
        # Configure Gemini
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        
        # Prepare the message - SIMPLIFIED APPROACH
        message_text = message
        
        # If user message and code exists, always include the current code
        if role.upper() == "USER" and code:
            # Always include the current code with the message
            code_prefix = "I have updated the code: " if codeHasChanged else "Here is my current code: "
            message_text = f"{code_prefix}```javascript\n{code}\n```\n\n{message_text}"
            logger.info(f"[{request_id}] Always including code context in message. New length: {len(message_text)}")
        elif role.upper() == "SYSTEM":
            message_text = f"Interpreter reported: {message}. Is it possible to improve that?"
            logger.info(f"[{request_id}] Processing system error message")
        
        logger.info(f"[{request_id}] Final message to send: {message_text[:100]}...")
        
        # Log conversation history status
        if conversationHistory:
            history_count = len(conversationHistory)
            history_msg_lengths = [len(msg['text']) for msg in conversationHistory]
            avg_msg_length = sum(history_msg_lengths) / max(1, len(history_msg_lengths))
            
            logger.info(f"[{request_id}] Conversation history: {history_count} messages, avg length: {avg_msg_length:.1f} chars")
            
            # Log a sample of history (first and last message if available)
            if history_count > 0:
                first_msg = conversationHistory[0]
                logger.info(f"[{request_id}] First history message: role={first_msg['role']}, text={first_msg['text'][:50]}...")
                
                if history_count > 1:
                    last_msg = conversationHistory[-1]
                    logger.info(f"[{request_id}] Last history message: role={last_msg['role']}, text={last_msg['text'][:50]}...")
            
            # Create conversation content for Gemini
            gen_contents = []
            
            # Add previous messages if available
            for idx, msg in enumerate(conversationHistory):
                # Map roles to Gemini format (user -> user, assistant -> model)
                gemini_role = "user" if msg["role"] == "user" else "model"
                
                # Each part needs a dict with "text" key, not direct string
                gen_contents.append({
                    "role": gemini_role,
                    "parts": [{"text": msg["text"]}]
                })
                
                logger.debug(f"[{request_id}] History message {idx}: role={gemini_role}, length={len(msg['text'])}")
            
            # Add current message
            current_gemini_role = "user" if role.lower() == "user" else "model"
            gen_contents.append({
                "role": current_gemini_role,
                "parts": [{"text": message_text}]
            })
            
            logger.info(f"[{request_id}] Formatted {len(gen_contents)} messages for Gemini API")
            
            # Log API call start time
            api_call_start = time.time()
            logger.info(f"[{request_id}] Calling Gemini API with conversation history...")
            
            try:
                # Call the Gemini API with conversation history
                response = await client.aio.models.generate_content(
                    #model='gemini-2.5-flash-preview-04-17',
                    model='gemini-2.5-pro-preview-05-06',
                    contents=gen_contents,  # Send the entire conversation
                    config=types.GenerateContentConfig(
                        temperature=0.7,
                        top_p=0.95,
                        top_k=40,
                        max_output_tokens=16384,
                        system_instruction=SYSTEM_INSTRUCTIONS,
                    ),
                )
                
                # Log API call duration
                api_duration = time.time() - api_call_start
                logger.info(f"[{request_id}] Gemini API call completed in {api_duration:.2f}s")
            except Exception as e:
                logger.error(f"[{request_id}] Gemini API call failed: {str(e)}")
                logger.error(f"[{request_id}] Traceback: {traceback.format_exc()}")
                raise HTTPException(status_code=500, detail=f"Gemini API error: {str(e)}")
        else:
            logger.info(f"[{request_id}] No conversation history received, sending single message")
            
            # Log API call start time
            api_call_start = time.time()
            logger.info(f"[{request_id}] Calling Gemini API with single message...")
            
            # No conversation history, just send the single message
            try:
                response = await client.aio.models.generate_content(
                    model='gemini-2.5-pro-preview-05-06',
                    contents=message_text,
                    config=types.GenerateContentConfig(
                        temperature=0.7,
                        top_p=0.95,
                        top_k=40,
                        max_output_tokens=16384,
                        system_instruction=SYSTEM_INSTRUCTIONS,
                    ),
                )
                
                # Log API call duration
                api_duration = time.time() - api_call_start
                logger.info(f"[{request_id}] Gemini API call completed in {api_duration:.2f}s")
            except Exception as e:
                logger.error(f"[{request_id}] Gemini API call failed: {str(e)}")
                logger.error(f"[{request_id}] Traceback: {traceback.format_exc()}")
                raise HTTPException(status_code=500, detail=f"Gemini API error: {str(e)}")
            
        # Extract code from the response
        full_text = response.text
        
        # Log the size of the response
        logger.info(f"[{request_id}] Received response from Gemini: {len(full_text)} chars")
        
        # Enhanced code extraction with better logging
        code_block = extract_code(full_text)
        
        if code_block:
            logger.info(f"[{request_id}] Successfully extracted code block: {len(code_block)} chars")
            
            # Compare with original code if it exists
            if code:
                new_code_hash = hashlib.md5(code_block.encode('utf-8')).hexdigest()
                logger.info(f"[{request_id}] Code comparison: original={code_hash}, new={new_code_hash}")
                
                # Log if code is unchanged
                if code.strip() == code_block.strip():
                    logger.warning(f"[{request_id}] Extracted code is identical to the original code")
        else:
            logger.warning(f"[{request_id}] No code block extracted from response")
            # Check if there are any code markers in the response
            js_markers = full_text.count("```javascript")
            code_end_markers = full_text.count("```", full_text.find("```javascript") if "```javascript" in full_text else 0)
            if js_markers > 0:
                logger.error(f"[{request_id}] Found {js_markers} JavaScript markers but code extraction failed")
                logger.error(f"[{request_id}] Code markers in response: starts={js_markers}, ends={code_end_markers}")
        
        # Remove the code block from the explanation
        explanation = full_text.replace(f"```javascript{code_block}```", "").strip() if code_block else full_text
        
        # Log response details
        logger.info(f"[{request_id}] Parsed response - Explanation: {len(explanation)} chars, Code: {len(code_block)} chars")
        
        # Check if we have thinking metadata
        thinking_info = ""
        if hasattr(response, "usage_metadata"):
            logger.info(f"[{request_id}] Response includes usage metadata")
            
            if hasattr(response.usage_metadata, "thoughts_token_count"):
                thinking_tokens = response.usage_metadata.thoughts_token_count
                thinking_info = f"Thinking tokens: {thinking_tokens}"
                logger.info(f"[{request_id}] Thinking tokens: {thinking_tokens}")
            
            if hasattr(response.usage_metadata, "prompt_token_count"):
                prompt_tokens = response.usage_metadata.prompt_token_count
                logger.info(f"[{request_id}] Prompt tokens: {prompt_tokens}")
                
            if hasattr(response.usage_metadata, "candidates_token_count"):
                candidate_tokens = response.usage_metadata.candidates_token_count
                logger.info(f"[{request_id}] Candidate tokens: {candidate_tokens}")
        
        # Calculate total processing time
        total_time = time.time() - start_time
        logger.info(f"[{request_id}] Total request processing time: {total_time:.2f}s")
        
        return {
            "explanation": explanation,
            "code": code_block,
            "thinking_info": thinking_info
        }
    
    except Exception as e:
        error_msg = f"Error processing playground request: {str(e)}"
        logger.error(f"[{request_id}] {error_msg}")
        logger.error(f"[{request_id}] Traceback: {traceback.format_exc()}")
        
        # Log more detailed error information
        error_type = type(e).__name__
        logger.error(f"[{request_id}] Error type: {error_type}")
        
        # Calculate total processing time even in error case
        total_time = time.time() - start_time
        logger.error(f"[{request_id}] Request failed after {total_time:.2f}s")
        
        raise HTTPException(status_code=500, detail=error_msg)

# Add new endpoints to the router
@router.post("/code/save", response_model=P5jsCodeResponse)
async def save_p5js_code(
    snippet: P5jsCodeSnippet,
    student_id: int,
    cosmos_db: CosmosDBService = Depends(get_cosmos_db)
):
    """Save a p5js code snippet with educational metadata"""
    try:
        # Validate input
        if not snippet.title or not snippet.title.strip():
            raise HTTPException(status_code=400, detail="Title is required")
        
        # Sanitize inputs to prevent XSS and other injection attacks
        safe_title = snippet.title.strip()
        safe_description = snippet.description.strip() if snippet.description else ""
        
        # Don't execute any code, just save it as a string
        result = await cosmos_db.save_p5js_code(
            student_id=student_id,
            title=safe_title,
            code=snippet.code,
            description=safe_description,
            tags=snippet.tags,
            # Legacy fields
            unit_id=snippet.unit_id,
            unit_title=snippet.unit_title,
            skill_id=snippet.skill_id,
            skill_description=snippet.skill_description,
            subskill_id=snippet.subskill_id,
            subskill_description=snippet.subskill_description,
            # New educational metadata fields
            subject=snippet.subject,
            skill=snippet.skill,
            subskill=snippet.subskill,
            key_concepts=snippet.key_concepts
        )
        
        return result
    except Exception as e:
        logger.error(f"Error saving p5js code: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save code: {str(e)}")

@router.get("/code/list", response_model=List[P5jsCodeResponse])
async def list_p5js_codes(
    student_id: int,
    limit: int = 100,
    cosmos_db: CosmosDBService = Depends(get_cosmos_db)
):
    """List all p5js code snippets for a student"""
    try:
        results = await cosmos_db.get_student_p5js_codes(
            student_id=student_id,
            limit=limit
        )
        return results
    except Exception as e:
        logger.error(f"Error listing p5js codes: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list codes: {str(e)}")

@router.get("/code/{snippet_id}", response_model=P5jsCodeResponse)
async def get_p5js_code(
    snippet_id: str,
    student_id: int,
    cosmos_db: CosmosDBService = Depends(get_cosmos_db)
):
    """Get a specific p5js code snippet"""
    try:
        result = await cosmos_db.get_p5js_code_by_id(
            student_id=student_id,
            snippet_id=snippet_id
        )
        if not result:
            raise HTTPException(status_code=404, detail="Code snippet not found")
        return result
    except Exception as e:
        logger.error(f"Error getting p5js code: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get code: {str(e)}")

@router.put("/code/{snippet_id}", response_model=P5jsCodeResponse)
async def update_p5js_code(
    snippet_id: str,
    snippet: P5jsCodeSnippet,
    student_id: int,
    cosmos_db: CosmosDBService = Depends(get_cosmos_db)
):
    """Update a p5js code snippet with educational metadata"""
    try:
        result = await cosmos_db.update_p5js_code(
            student_id=student_id,
            snippet_id=snippet_id,
            title=snippet.title,
            code=snippet.code,
            description=snippet.description,
            tags=snippet.tags,
            # Legacy fields
            unit_id=snippet.unit_id,
            unit_title=snippet.unit_title,
            skill_id=snippet.skill_id,
            skill_description=snippet.skill_description,
            subskill_id=snippet.subskill_id,
            subskill_description=snippet.subskill_description,
            # New educational metadata fields
            subject=snippet.subject,
            skill=snippet.skill,
            subskill=snippet.subskill,
            key_concepts=snippet.key_concepts
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating p5js code: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update code: {str(e)}")

@router.delete("/code/{snippet_id}", response_model=Dict[str, bool])
async def delete_p5js_code(
    snippet_id: str,
    student_id: int,
    cosmos_db: CosmosDBService = Depends(get_cosmos_db)
):
    """Delete a p5js code snippet"""
    try:
        success = await cosmos_db.delete_p5js_code(
            student_id=student_id,
            snippet_id=snippet_id
        )
        if not success:
            raise HTTPException(status_code=404, detail="Code snippet not found")
        return {"success": True}
    except Exception as e:
        logger.error(f"Error deleting p5js code: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete code: {str(e)}")

@router.get("/code/search", response_model=List[P5jsCodeResponse])
async def search_p5js_codes(
    subject: Optional[str] = None,
    skill: Optional[str] = None,
    subskill: Optional[str] = None,
    limit: int = 100,
    cosmos_db: CosmosDBService = Depends(get_cosmos_db)
):
    """Search p5js code snippets by educational metadata"""
    try:
        results = await cosmos_db.search_p5js_codes_by_subject(
            subject=subject,
            skill=skill,
            subskill=subskill,
            limit=limit
        )
        return results
    except Exception as e:
        logger.error(f"Error searching p5js codes: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to search codes: {str(e)}")
        
@router.post("/evaluate", response_model=StudentEvaluationResponse)
async def evaluate_student_work(
    evaluation_request: StudentEvaluationRequest,
    cosmos_db: CosmosDBService = Depends(get_cosmos_db)
):
    """Evaluate a student's work based on their P5js code and interactions with Gemini."""
    start_time = time.time()
    request_id = f"eval_{int(start_time * 1000)}"
    code_hash = compute_code_hash(evaluation_request.finalCode)
    
    try:
        logger.info(f"[{request_id}] Processing evaluation request: student={evaluation_request.studentId}, exercise={evaluation_request.exerciseId}")
        logger.info(f"[{request_id}] Request metadata: concept_domain={evaluation_request.conceptDomain}, code_hash={code_hash}")
        
        # Log code info
        if evaluation_request.finalCode:
            code_lines = len(evaluation_request.finalCode.splitlines())
            code_bytes = len(evaluation_request.finalCode.encode('utf-8'))
            logger.info(f"[{request_id}] Code info: lines={code_lines}, bytes={code_bytes}")
            
            # Log sample of code beginning (for context)
            first_lines = evaluation_request.finalCode.split('\n')[:3]
            logger.info(f"[{request_id}] Code begins with: {first_lines}")
        else:
            logger.info(f"[{request_id}] No code provided for evaluation")
            raise HTTPException(status_code=400, detail="Code is required for evaluation")
        
        # Log chat interaction info
        if evaluation_request.chatInteractions:
            chat_count = len(evaluation_request.chatInteractions)
            user_messages = sum(1 for msg in evaluation_request.chatInteractions if msg.get('role', '').lower() == 'user')
            assistant_messages = sum(1 for msg in evaluation_request.chatInteractions if msg.get('role', '').lower() == 'assistant')
            
            logger.info(f"[{request_id}] Chat interactions: {chat_count} total, {user_messages} user, {assistant_messages} assistant")
        else:
            logger.info(f"[{request_id}] No chat interactions provided")
            raise HTTPException(status_code=400, detail="Chat interactions are required for evaluation")
            
        # Configure Gemini
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        
        # Retrieve exercise details (if available from the request)
        exercise_details = evaluation_request.exerciseMetadata or {}
        
        # Create a comprehensive evaluation prompt
        evaluation_prompt = f"""
        Evaluate this student's project for {evaluation_request.conceptDomain} exercise {evaluation_request.exerciseId}.
        
        CONTEXT:
        In this learning environment, students collaborate with an AI (Gemini) to create 
        p5js visualizations that demonstrate {evaluation_request.conceptDomain} concepts. The student's 
        evaluation should reflect their ability to effectively use AI as a learning tool while 
        demonstrating understanding of the underlying concepts.
        
        {"EXERCISE DETAILS:" + json.dumps(exercise_details, indent=2) if exercise_details else ""}
        
        STUDENT WORK:
        - Final p5js code: ```javascript
        {evaluation_request.finalCode}
        ```
        
        - Chat interaction summary: 
        {json.dumps([{"role": msg.get('role', ''), "text": msg.get('text', '')[:150] + "..." if len(msg.get('text', '')) > 150 else msg.get('text', '')} for msg in evaluation_request.chatInteractions[:10]], indent=2)}
        {f"... and {len(evaluation_request.chatInteractions) - 10} more messages" if len(evaluation_request.chatInteractions) > 10 else ""}
        
        EVALUATION CRITERIA:
        1. Concept Mastery (40%): Does the student demonstrate understanding of the {evaluation_request.conceptDomain} 
           concepts in their interactions and final project?
        
        2. Effective AI Collaboration (20%): How well did the student guide the AI? Did they 
           ask clarifying questions, request improvements, or demonstrate critical thinking 
           about the AI's suggestions?
        
        3. Technical Implementation (20%): Is the code functional, efficient, and well-structured?
        
        4. Creativity and Engagement (10%): Does the project show creative application of concepts?
        
        5. Scientific/Mathematical Rigor (10%): Is the representation accurate and precise?
        
        For each criterion, provide:
        - A score (1-10)
        - Specific evidence from their work
        - Constructive feedback
        
        End with an overall grade (A-F) and 2-3 specific recommendations for improvement.
        """
        
        logger.info(f"[{request_id}] Prepared evaluation prompt of length {len(evaluation_prompt)}")
        
        # Call Gemini API for evaluation
        api_call_start = time.time()
        logger.info(f"[{request_id}] Calling Gemini API for evaluation...")
        
        try:
            response = await client.aio.models.generate_content(
                model='gemini-2.5-pro-preview-03-25',
                contents=evaluation_prompt,
                config=types.GenerateContentConfig(
                    temperature=0.2,  # Lower temperature for more consistent evaluations
                    top_p=0.95,
                    top_k=40,
                    max_output_tokens=8192,
                )
            )
            
            # Log API call duration
            api_duration = time.time() - api_call_start
            logger.info(f"[{request_id}] Gemini API evaluation completed in {api_duration:.2f}s")
        except Exception as e:
            logger.error(f"[{request_id}] Gemini API evaluation failed: {str(e)}")
            logger.error(f"[{request_id}] Traceback: {traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=f"Evaluation engine error: {str(e)}")
        
        # Extract the evaluation text
        evaluation_text = response.text
        
        # Extract overall grade using regex
        grade_match = re.search(r'overall grade:?\s*([A-F][+-]?)', evaluation_text, re.IGNORECASE)
        overall_grade = grade_match.group(1) if grade_match else "Not specified"
        
        # Parse the evaluation to extract criterion scores
        score_pattern = re.compile(r'(\d+)(/|\s*out of\s*)10', re.IGNORECASE)
        scores = score_pattern.findall(evaluation_text)
        criterion_scores = [int(score[0]) for score in scores] if scores else []
        
        # Calculate overall numeric score if possible
        numeric_score = None
        if len(criterion_scores) >= 5:
            # Using the weights mentioned in the prompt: 40%, 20%, 20%, 10%, 10%
            weights = [0.4, 0.2, 0.2, 0.1, 0.1]
            numeric_score = sum(score * weight for score, weight in zip(criterion_scores[:5], weights))
            logger.info(f"[{request_id}] Calculated overall numeric score: {numeric_score:.1f}/10")
        
        # Save the evaluation to the database
        try:
            # Format evaluation data for storage (similar to your reviews structure)
            timestamp = datetime.utcnow().isoformat()
            evaluation_id = f"{evaluation_request.studentId}_{evaluation_request.exerciseId}_{timestamp}_{uuid.uuid4()}"
            
            evaluation_data = {
                "id": evaluation_id,
                "student_id": evaluation_request.studentId,
                "exercise_id": evaluation_request.exerciseId,
                "evaluation_text": evaluation_text,
                "overall_grade": overall_grade,
                "numeric_score": numeric_score,
                "criterion_scores": criterion_scores[:5] if len(criterion_scores) >= 5 else criterion_scores,
                "code_hash": code_hash,
                "concept_domain": evaluation_request.conceptDomain,
                "created_at": timestamp,
                "type": "p5js_evaluation"
            }
            
            # Store in the p5js_code_snippets container since it's already set up for student projects
            # You can also create a dedicated evaluations container if preferred
            result = await cosmos_db.save_p5js_evaluation(evaluation_data)
            logger.info(f"[{request_id}] Saved evaluation with ID: {evaluation_id}")
        except Exception as e:
            logger.error(f"[{request_id}] Failed to save evaluation: {str(e)}")
            logger.error(f"[{request_id}] Traceback: {traceback.format_exc()}")
            # Continue without saving to the database
        
        # Calculate total processing time
        total_time = time.time() - start_time
        logger.info(f"[{request_id}] Total evaluation processing time: {total_time:.2f}s")
        
        return StudentEvaluationResponse(
            evaluationId=evaluation_id,
            studentId=evaluation_request.studentId,
            exerciseId=evaluation_request.exerciseId,
            evaluation=evaluation_text,
            overallGrade=overall_grade,
            numericScore=numeric_score,
            criterionScores=criterion_scores[:5] if len(criterion_scores) >= 5 else criterion_scores,
            timestamp=timestamp,
            exerciseData={
                "domain": evaluation_request.conceptDomain,
                "title": exercise_details.get("title", "Unknown Exercise")
            }
        )
    
    except Exception as e:
        error_msg = f"Error processing evaluation request: {str(e)}"
        logger.error(f"[{request_id}] {error_msg}")
        logger.error(f"[{request_id}] Traceback: {traceback.format_exc()}")
        
        # Log more detailed error information
        error_type = type(e).__name__
        logger.error(f"[{request_id}] Error type: {error_type}")
        
        # Calculate total processing time even in error case
        total_time = time.time() - start_time
        logger.error(f"[{request_id}] Evaluation request failed after {total_time:.2f}s")
        
        raise HTTPException(status_code=500, detail=error_msg)

# Add route to get evaluations for a student
@router.get("/evaluations", response_model=List[Dict[str, Any]])
async def get_student_evaluations(
    student_id: int,
    exercise_id: Optional[str] = None,
    limit: int = 10,
    cosmos_db: CosmosDBService = Depends(get_cosmos_db)
):
    """Get evaluations for a student, optionally filtered by exercise."""
    try:
        evaluations = await cosmos_db.get_student_evaluations(
            student_id=student_id,
            exercise_id=exercise_id,
            limit=limit
        )
        return evaluations
    except Exception as e:
        logger.error(f"Error retrieving student evaluations: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve evaluations: {str(e)}")

# Add route to get a specific evaluation
@router.get("/evaluations/{evaluation_id}", response_model=Dict[str, Any])
async def get_evaluation_by_id(
    evaluation_id: str,
    student_id: int,
    cosmos_db: CosmosDBService = Depends(get_cosmos_db)
):
    """Get a specific evaluation by ID."""
    try:
        evaluation = await cosmos_db.get_evaluation_by_id(
            student_id=student_id,
            evaluation_id=evaluation_id
        )
        if not evaluation:
            raise HTTPException(status_code=404, detail="Evaluation not found")
        return evaluation
    except Exception as e:
        logger.error(f"Error retrieving evaluation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve evaluation: {str(e)}")