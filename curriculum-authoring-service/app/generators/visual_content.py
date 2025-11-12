"""
Visual Content Generator - Generates interactive HTML visualizations for reading sections
"""

import logging
from datetime import datetime
import uuid

from google import genai
from google.genai.types import GenerateContentConfig

from app.core.config import settings
from app.models.content import VisualSnippet

logger = logging.getLogger(__name__)


class VisualContentGenerator:
    """Generator for interactive HTML visual snippets"""

    def __init__(self):
        self.client = None
        self._initialize_gemini()

    def _initialize_gemini(self):
        """Initialize Gemini client"""
        if not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is required")

        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
        logger.info("Gemini client initialized for VisualContentGenerator")

    async def generate_visual_snippet(
        self,
        subskill_id: str,
        section_id: str,
        section_heading: str,
        section_content: str,
        custom_prompt: str = None
    ) -> VisualSnippet:
        """
        Generate interactive HTML content for visualizing educational concepts.

        Args:
            subskill_id: Subskill identifier
            section_id: Section identifier
            section_heading: The heading of the content section
            section_content: The content text of the section
            custom_prompt: Optional custom instructions

        Returns:
            VisualSnippet with complete HTML content
        """
        logger.info(f"🎨 Generating visual snippet for section: {section_heading}")

        # Create the prompt for visual generation
        base_prompt = f"""
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

Design Style Requirements (MUST FOLLOW FOR CONSISTENT APPEARANCE):
- Use these CSS custom properties in your :root selector:
  --primary: #3b82f6;
  --secondary: #10b981;
  --accent: #8b5cf6;
  --bg-main: #f8fafc;
  --bg-surface: #ffffff;
  --text-primary: #1e293b;
  --text-secondary: #64748b;
  --border-color: #e2e8f0;

- Typography:
  * Font family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
  * Headings: 24-32px, font-weight: 600, color: var(--text-primary)
  * Body text: 14-16px, line-height: 1.6, color: var(--text-secondary)
  * Instructions: 14px, font-weight: 500, color: var(--text-primary)

- Layout and Spacing:
  * Container padding: 24px
  * Element margins: 16px between sections, 12px between related items
  * Max-width for content: 1200px, centered with margin: 0 auto

- Visual Elements:
  * Border radius: 8-12px for all containers, cards, and buttons
  * Shadows: box-shadow: 0 1px 3px rgba(0,0,0,0.1) for cards/containers
  * Deeper shadows for elevated elements: 0 4px 6px rgba(0,0,0,0.1)
  * Borders: 1px solid var(--border-color)

- Interactive Elements:
  * Buttons: padding: 10px 20px, border-radius: 8px, background: var(--primary), color: white
  * Button hover: opacity: 0.9, add transition: all 0.3s ease
  * Interactive areas: Add cursor: pointer and subtle hover effects (transform: scale(1.05) or opacity change)
  * All transitions: transition: all 0.3s ease

- Color Usage:
  * Primary color (blue) for main actions and key interactive elements
  * Secondary color (green) for success states and positive feedback
  * Accent color (purple) for highlights and special features
  * Use color gradients sparingly for visual interest
  * Ensure sufficient contrast for accessibility (WCAG AA minimum)

Focus on creating something that would make a learner think "Wow, that makes it so much clearer!" while maintaining a consistent, modern, clean design aesthetic.
"""

        if custom_prompt:
            base_prompt += f"\n\nAdditional Instructions:\n{custom_prompt}"

        base_prompt += "\n\nRespond ONLY with the complete HTML code. Do not include any explanations or markdown formatting."

        try:
            # Generate the HTML content
            response = await self.client.aio.models.generate_content(
                model='gemini-flash-latest',
                contents=base_prompt,
                config=GenerateContentConfig(
                    temperature=0.7,  # Higher temp for more creative visuals
                    max_output_tokens=15000
                )
            )

            if response and response.text:
                html_content = response.text.strip()

                # Remove markdown code fences if present
                if html_content.startswith('```html'):
                    html_content = html_content[7:]
                if html_content.startswith('```'):
                    html_content = html_content[3:]
                if html_content.endswith('```'):
                    html_content = html_content[:-3]

                html_content = html_content.strip()

                # Basic validation that we got HTML
                if not html_content.lower().startswith('<!doctype html') and not html_content.lower().startswith('<html'):
                    logger.warning(f"Generated content doesn't appear to be valid HTML for section: {section_heading}")
                    # Try to wrap it in basic HTML structure if it's just HTML fragments
                    html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <title>Interactive Demo: {section_heading}</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
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

                now = datetime.utcnow()
                snippet = VisualSnippet(
                    snippet_id=str(uuid.uuid4()),
                    subskill_id=subskill_id,
                    section_id=section_id,
                    html_content=html_content,
                    generation_prompt=base_prompt,
                    created_at=now,
                    updated_at=now
                )

                logger.info(f"✅ Successfully generated visual snippet for: {section_heading}")
                return snippet

            else:
                logger.error(f"No content generated for section: {section_heading}")
                raise ValueError("Model did not generate any content")

        except Exception as e:
            error_msg = f"Visual content generation failed for '{section_heading}': {str(e)}"
            logger.error(error_msg)

            # Return a fallback HTML with error message
            fallback_html = self._create_fallback_html(section_heading, str(e))

            now = datetime.utcnow()
            snippet = VisualSnippet(
                snippet_id=str(uuid.uuid4()),
                subskill_id=subskill_id,
                section_id=section_id,
                html_content=fallback_html,
                generation_prompt=base_prompt,
                created_at=now,
                updated_at=now
            )

            return snippet

    def _create_fallback_html(self, section_heading: str, error_message: str) -> str:
        """Create a fallback HTML when generation fails"""
        return f"""
<!DOCTYPE html>
<html>
<head>
    <title>{section_heading}</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {{
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: #f5f5f5;
        }}
        .error-container {{
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            max-width: 500px;
            text-align: center;
        }}
        .error-icon {{
            font-size: 48px;
            margin-bottom: 20px;
        }}
        h1 {{
            color: #333;
            margin-bottom: 20px;
        }}
        p {{
            color: #666;
            line-height: 1.6;
        }}
        .error-details {{
            background: #f9f9f9;
            padding: 15px;
            border-radius: 4px;
            margin-top: 20px;
            font-size: 12px;
            color: #888;
            text-align: left;
        }}
    </style>
</head>
<body>
    <div class="error-container">
        <div class="error-icon">⚠️</div>
        <h1>Visualization Unavailable</h1>
        <p>We couldn't generate an interactive visualization for <strong>{section_heading}</strong> at this time.</p>
        <p>Please try regenerating this visual snippet or contact support if the problem persists.</p>
        <div class="error-details">
            <strong>Error:</strong> {error_message}
        </div>
    </div>
</body>
</html>
"""
