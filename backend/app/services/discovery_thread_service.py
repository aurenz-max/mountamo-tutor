# backend/app/services/discovery_thread_service.py
# Using Gemini 2.5 Flash Lite with tool calling for structured JSON responses
import google.generativeai as genai
from google.generativeai.types import GenerationConfig
import json
import logging
from typing import List, Dict, Any, Optional
from ..core.config import settings

logger = logging.getLogger(__name__)

class DiscoveryThreadService:
    def __init__(self):
        """Initialize Discovery Thread Service with Gemini 2.5 Flash Lite"""
        try:
            # Configure the Google AI SDK
            genai.configure(api_key=settings.GEMINI_API_KEY)
            
            # Define the tool schema for structured JSON output
            self.generate_threads_tool = {
                "function_declarations": [
                    {
                        "name": "generate_discovery_threads",
                        "description": "Generates intriguing follow-up questions (discovery threads) for a given section of educational text.",
                        "parameters": {
                            "type": "OBJECT",
                            "properties": {
                                "heading": {
                                    "type": "STRING",
                                    "description": "The original heading of the text section."
                                },
                                "discovery_threads": {
                                    "type": "ARRAY",
                                    "description": "An array of exactly 4 engaging questions or prompts related to the text.",
                                    "items": {
                                        "type": "STRING"
                                    }
                                }
                            },
                            "required": ["heading", "discovery_threads"]
                        }
                    }
                ]
            }
            
            # Initialize the model with tool configuration
            self.model = genai.GenerativeModel(
                model_name='gemini-2.5-flash-lite',
                tools=self.generate_threads_tool,
                generation_config=GenerationConfig(
                    temperature=0.7  # Adjust this value as needed
                )
            )
            
            # Initialize a separate model for visual generation (no tools)
            self.visual_model = genai.GenerativeModel(
                model_name='gemini-2.5-pro',
                generation_config=GenerationConfig(
                    temperature=0.3  # Lower temperature for more consistent code generation
                )
            )
            
            logger.info("Discovery Thread service initialized successfully with Gemini 2.5 Flash Lite")
            
        except Exception as e:
            logger.error(f"Failed to initialize Discovery Thread service: {str(e)}")
            raise

    async def generate_discovery_threads(
        self, 
        section_heading: str, 
        section_content: str
    ) -> Dict[str, Any]:
        """
        Generate discovery threads for a given section using Gemini tool calling
        
        Args:
            section_heading: The heading of the content section
            section_content: The content text of the section
            
        Returns:
            Dictionary containing the heading and discovery_threads array
        """
        try:
            # Create the prompt that instructs the model to use the tool
            prompt = f"""
Please generate discovery threads based on the following article section:

Heading: {section_heading}
Content: {section_content}

Create exactly 4 engaging discovery threads that:
1. Take different angles (why/how/what-if/comparison)
2. Spark curiosity and encourage deeper exploration
3. Are appropriate for the reading level of the content
4. Can be answered through conversation with an AI tutor
5. Connect to real-world applications or implications

Focus on questions that would make a learner think "I never considered that!" or "That's fascinating!"
"""
            
            # Force the model to use the specified tool
            response = self.model.generate_content(
                prompt, 
                tool_config={'function_calling_config': 'ANY'}
            )
            
            # Extract the structured data from the function call
            if (response.candidates and 
                response.candidates[0].content.parts and
                response.candidates[0].content.parts[0].function_call):
                
                function_call = response.candidates[0].content.parts[0].function_call
                function_args = function_call.args
                
                # Convert the response to our expected format
                discovery_data = {
                    "heading": str(function_args.get('heading', section_heading)),
                    "discovery_threads": list(function_args.get('discovery_threads', []))
                }
                
                # Validate we have exactly 4 threads
                if len(discovery_data['discovery_threads']) != 4:
                    logger.warning(f"Expected 4 discovery threads, got {len(discovery_data['discovery_threads'])} for section: {section_heading}")
                
                logger.info(f"Successfully generated {len(discovery_data['discovery_threads'])} discovery threads for: {section_heading}")
                return discovery_data
                
            else:
                logger.error(f"No function call found in response for section: {section_heading}")
                raise ValueError("Model did not use the expected tool format")
                
        except Exception as e:
            logger.error(f"Error generating discovery threads for '{section_heading}': {str(e)}")
            # Return fallback structure
            return {
                "heading": section_heading,
                "discovery_threads": []
            }

    async def generate_discovery_threads_for_package(
        self, 
        package_content: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate discovery threads for all sections in a reading package
        
        Args:
            package_content: The full package content with sections
            
        Returns:
            Updated package content with discovery_threads added to each section
        """
        try:
            updated_content = package_content.copy()
            
            if 'content' in updated_content and 'sections' in updated_content['content']:
                sections = updated_content['content']['sections']
                
                for i, section in enumerate(sections):
                    if 'heading' in section and 'content' in section:
                        logger.info(f"Generating discovery threads for section {i+1}/{len(sections)}: {section['heading']}")
                        
                        # Generate threads for this section
                        thread_data = await self.generate_discovery_threads(
                            section['heading'],
                            section['content']
                        )
                        
                        # Add discovery_threads to the section
                        sections[i]['discovery_threads'] = thread_data['discovery_threads']
                
                logger.info(f"Successfully processed {len(sections)} sections for discovery thread generation")
            
            return updated_content
            
        except Exception as e:
            logger.error(f"Error processing package for discovery threads: {str(e)}")
            raise

    async def regenerate_single_section_threads(
        self,
        section_heading: str,
        section_content: str
    ) -> List[str]:
        """
        Regenerate discovery threads for a single section
        
        Args:
            section_heading: The heading of the section
            section_content: The content of the section
            
        Returns:
            List of discovery thread strings
        """
        try:
            thread_data = await self.generate_discovery_threads(section_heading, section_content)
            return thread_data.get('discovery_threads', [])
            
        except Exception as e:
            logger.error(f"Error regenerating threads for section '{section_heading}': {str(e)}")
            return []

    async def generate_visual_content(
        self, 
        section_heading: str, 
        section_content: str
    ) -> str:
        """
        Generate interactive HTML content for visualizing educational concepts
        
        Args:
            section_heading: The heading of the content section
            section_content: The content text of the section
            
        Returns:
            Complete HTML string with interactive visualization
        """
        try:
            # Create the prompt for visual generation
            prompt = f"""
You are an expert educational programmer. Based on the following section heading and content, generate a single, self-contained HTML file that provides a simple, interactive visual demonstration of the core concept.

Section Heading: {section_heading}
Section Content: {section_content}

Requirements:
1. Create a complete HTML document with embedded CSS and JavaScript
2. Use vanilla JavaScript or simple libraries like p5.js (via CDN)
3. The visualization must be clear, simple, and directly related to the content
4. Make it interactive - users should be able to click, hover, or manipulate elements
5. Use appropriate colors, animations, and visual metaphors
6. Include clear instructions for the user on how to interact
7. Keep the code clean and well-commented
8. Ensure it works in modern browsers without external dependencies (except CDN links)
9. Make it educational and engaging for learners
10. The visualization should help users understand the concept better than text alone

Focus on creating something that would make a learner think "Wow, that makes it so much clearer!"

Respond ONLY with the complete HTML code. Do not include any explanations or markdown formatting.
"""
            
            # Generate the HTML content
            response = self.visual_model.generate_content(prompt)
            
            if response and response.text:
                html_content = response.text.strip()
                
                # Basic validation that we got HTML
                if not html_content.lower().startswith('<!doctype html') and not html_content.lower().startswith('<html'):
                    logger.warning(f"Generated content doesn't appear to be valid HTML for section: {section_heading}")
                    # Try to wrap it in basic HTML structure if it's just HTML fragments
                    html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <title>Interactive Demo: {section_heading}</title>
    <style>
        body {{
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }}
    </style>
</head>
<body>
    {html_content}
</body>
</html>
"""
                
                logger.info(f"Successfully generated visual content for: {section_heading}")
                return html_content
                
            else:
                logger.error(f"No content generated for section: {section_heading}")
                raise ValueError("Model did not generate any content")
                
        except Exception as e:
            logger.error(f"Error generating visual content for '{section_heading}': {str(e)}")
            # Return a fallback HTML with error message
            return f"""
<!DOCTYPE html>
<html>
<head>
    <title>Visual Demo - {section_heading}</title>
    <style>
        body {{
            font-family: Arial, sans-serif;
            padding: 40px;
            text-align: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
            margin: 0;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
        }}
        .error-container {{
            background: rgba(255,255,255,0.1);
            padding: 30px;
            border-radius: 15px;
            backdrop-filter: blur(10px);
            max-width: 500px;
        }}
        h2 {{
            margin-bottom: 20px;
        }}
        p {{
            line-height: 1.6;
            margin-bottom: 15px;
        }}
    </style>
</head>
<body>
    <div class="error-container">
        <h2>🎨 Visual Demo Coming Soon!</h2>
        <p>We're working on creating an interactive demonstration for:</p>
        <h3>{section_heading}</h3>
        <p>For now, you can explore the concept through the "Ask AI" feature or the discovery questions below.</p>
        <p><small>This feature is in active development and will be available soon!</small></p>
    </div>
</body>
</html>
"""

    async def generate_walkthrough_threads(
        self, 
        section_heading: str, 
        section_content: str,
        visual_type: str = "interactive_demonstration"
    ) -> Dict[str, Any]:
        """
        Generate walkthrough threads specifically for visual demonstrations
        
        Args:
            section_heading: The heading of the content section
            section_content: The content text of the section
            visual_type: Type of visual demonstration
            
        Returns:
            Dictionary containing the heading and walkthrough_threads array
        """
        try:
            # Define the tool schema for walkthrough threads
            walkthrough_tool = {
                "function_declarations": [
                    {
                        "name": "generate_walkthrough_threads",
                        "description": "Generates walkthrough questions specifically for guiding users through visual demonstrations.",
                        "parameters": {
                            "type": "OBJECT",
                            "properties": {
                                "heading": {
                                    "type": "STRING",
                                    "description": "The original heading of the text section."
                                },
                                "walkthrough_threads": {
                                    "type": "ARRAY",
                                    "description": "An array of exactly 4 walkthrough questions for visual demonstrations.",
                                    "items": {
                                        "type": "STRING"
                                    }
                                }
                            },
                            "required": ["heading", "walkthrough_threads"]
                        }
                    }
                ]
            }
            
            # Create a model instance specifically for walkthrough threads
            walkthrough_model = genai.GenerativeModel(
                model_name='gemini-2.5-flash-lite',
                tools=walkthrough_tool,
                generation_config=GenerationConfig(
                    temperature=0.7
                )
            )
            
            # Create the prompt for walkthrough thread generation
            prompt = f"""
Please generate walkthrough threads for a visual demonstration based on the following section:

Heading: {section_heading}
Content: {section_content}
Visual Type: {visual_type}

Create exactly 4 walkthrough questions that help users understand and interact with a visual demonstration. These questions should:

1. Guide users through the visual step-by-step
2. Help them understand what they're seeing
3. Explain how the visual relates to the concept
4. Encourage interaction with the demonstration
5. Be specific to visual learning and demonstration walkthroughs

Make them conversational and appropriate for an AI tutor to answer while referring to the visual.
"""
            
            # Generate the walkthrough threads
            response = walkthrough_model.generate_content(
                prompt, 
                tool_config={'function_calling_config': 'ANY'}
            )
            
            # Extract the structured data from the function call
            if (response.candidates and 
                response.candidates[0].content.parts and
                response.candidates[0].content.parts[0].function_call):
                
                function_call = response.candidates[0].content.parts[0].function_call
                function_args = function_call.args
                
                # Convert the response to our expected format
                walkthrough_data = {
                    "heading": str(function_args.get('heading', section_heading)),
                    "walkthrough_threads": list(function_args.get('walkthrough_threads', []))
                }
                
                # Validate we have exactly 4 threads
                if len(walkthrough_data['walkthrough_threads']) != 4:
                    logger.warning(f"Expected 4 walkthrough threads, got {len(walkthrough_data['walkthrough_threads'])} for section: {section_heading}")
                
                logger.info(f"Successfully generated {len(walkthrough_data['walkthrough_threads'])} walkthrough threads for: {section_heading}")
                return walkthrough_data
                
            else:
                logger.error(f"No function call found in walkthrough response for section: {section_heading}")
                raise ValueError("Model did not use the expected tool format for walkthrough threads")
                
        except Exception as e:
            logger.error(f"Error generating walkthrough threads for '{section_heading}': {str(e)}")
            # Return fallback structure with default walkthrough questions
            return {
                "heading": section_heading,
                "walkthrough_threads": [
                    f"Walk me through this visual demonstration of \"{section_heading}\" step by step",
                    f"What should I focus on in this interactive demonstration?",
                    f"How does this visual help me understand {section_heading}?",
                    f"Can you guide me through interacting with this demonstration?"
                ]
            }