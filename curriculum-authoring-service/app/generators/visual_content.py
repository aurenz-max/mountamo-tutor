"""
Visual Content Generator - Generates interactive HTML visualizations for reading sections
"""

import logging
from datetime import datetime
import uuid

from google import genai
from google.genai import types

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
        subject_name: str = None,
        grade_level: str = None,
        unit_title: str = None,
        skill_description: str = None,
        subskill_description: str = None,
        key_terms: list = None,
        concepts_covered: list = None,
        custom_prompt: str = None
    ) -> VisualSnippet:
        """
        Generate interactive HTML content for visualizing educational concepts.

        Args:
            subskill_id: Subskill identifier
            section_id: Section identifier
            section_heading: The heading of the content section
            section_content: The content text of the section
            subject_name: Subject name (e.g., "Mathematics", "Science")
            grade_level: Grade level (e.g., "Kindergarten", "Grade 3")
            unit_title: Unit title for broader context
            skill_description: Parent skill description
            subskill_description: Detailed subskill description
            key_terms: Key vocabulary terms to emphasize
            concepts_covered: Core concepts to illustrate
            custom_prompt: Optional custom instructions

        Returns:
            VisualSnippet with complete HTML content
        """
        logger.info(f"🎨 Generating visual snippet for section: {section_heading}")

        # Build educational context section
        context_section = ""
        if any([subject_name, grade_level, unit_title, skill_description, subskill_description]):
            context_section = "\n🎓 EDUCATIONAL CONTEXT:\n"
            if grade_level:
                context_section += f"Grade Level: {grade_level}\n"
            if subject_name:
                context_section += f"Subject: {subject_name}\n"
            if unit_title:
                context_section += f"Unit: {unit_title}\n"
            if skill_description:
                context_section += f"Skill: {skill_description}\n"
            if subskill_description:
                context_section += f"Subskill: {subskill_description}\n"

        # Build key terms section
        key_terms_section = ""
        if key_terms and len(key_terms) > 0:
            key_terms_section = f"\n📚 KEY TERMS TO EMPHASIZE: {', '.join(key_terms)}\n"

        # Build concepts section
        concepts_section = ""
        if concepts_covered and len(concepts_covered) > 0:
            concepts_section = f"\n💡 CORE CONCEPTS TO ILLUSTRATE: {', '.join(concepts_covered)}\n"

        # Create the prompt for visual generation
        base_prompt = f"""
You are an expert educational experience designer creating interactive learning visualizations that bring concepts to life.

Your mission: Create a delightful, engaging HTML experience that makes learners think "WOW! That makes it so much clearer!"

🎯 CONTENT TO VISUALIZE:
Section Heading: {section_heading}
Section Content: {section_content}
{context_section}{key_terms_section}{concepts_section}

🌟 PEDAGOGICAL PRINCIPLES - CREATE AN EXPERIENCE THAT:

1. TELLS A STORY
   - Don't just show information - create a narrative journey
   - Guide learners through the concept step-by-step with progressive revelation
   - Build from simple to complex, letting them discover patterns

2. USES POWERFUL METAPHORS & REAL-WORLD CONNECTIONS
   - Ground abstract concepts in concrete, relatable scenarios
   - For young learners ({grade_level if grade_level else 'students'}): use familiar objects, animals, everyday scenarios
   - For older learners: use realistic simulations, real-world applications
   - Make it feel relevant to their lives

3. ENCOURAGES HANDS-ON DISCOVERY
   - Let learners manipulate, experiment, and discover
   - Include "What if..." moments where they can test ideas
   - Create "aha!" moments where patterns suddenly become clear
   - Make interactions feel responsive and meaningful

4. CELEBRATES ENGAGEMENT
   - Add delightful micro-interactions (subtle animations, color changes, particle effects)
   - Celebrate correct insights with positive feedback
   - Make every click, hover, or interaction feel rewarding
   - Keep it playful and encouraging

5. BUILDS UNDERSTANDING PROGRESSIVELY
   - Start with the simplest form of the concept
   - Add layers of complexity that learners can reveal
   - Include optional "dig deeper" areas for curious minds
   - Let them control the pace of exploration

6. **Make it Interactive**: The output MUST NOT be static. It needs buttons, sliders, drag-and-drop, or dynamic visualizations.

7. EMPHASIZES KEY VOCABULARY
   - Make key terms ({', '.join(key_terms) if key_terms else 'important vocabulary'}) prominent and interactive
   - Clicking terms should reveal definitions, examples, or demonstrations
   - Use visual cues to highlight important concepts

💻 TECHNICAL REQUIREMENTS:
1. Create a complete, self-contained HTML document with embedded CSS and JavaScript
2. Use vanilla JavaScript or simple libraries like p5.js, Chart.js, or Three.js (via CDN only)
3. Works in modern browsers without external dependencies (except CDN links)
4. Include clear, friendly instructions on how to interact
5. Keep code clean, well-commented, and maintainable
6. Ensure accessibility (keyboard navigation, screen reader support where appropriate)

2. **NO EXTERNAL IMAGES**:
    - **CRITICAL**: Do NOT use <img src="..."> with external URLs (like imgur, placeholder.com, or generic internet URLs). They will fail.
    - **INSTEAD**: Use **CSS shapes**, **inline SVGs**, **Emojis**, or **CSS gradients** to visually represent the elements you see in the input.
    - If you see a "coffee cup" in the input, render a ☕ emoji or draw a cup with CSS. Do not try to load a jpg of a coffee cup.

🎨 DESIGN STYLE (MUST FOLLOW FOR CONSISTENT APPEARANCE):

CSS Custom Properties (use in :root):
  --primary: #3b82f6;
  --secondary: #10b981;
  --accent: #8b5cf6;
  --bg-main: #f8fafc;
  --bg-surface: #ffffff;
  --text-primary: #1e293b;
  --text-secondary: #64748b;
  --border-color: #e2e8f0;

Typography:
  - Font: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
  - Headings: 24-32px, font-weight: 600, color: var(--text-primary)
  - Body: 14-16px, line-height: 1.6, color: var(--text-secondary)
  - Instructions: 14px, font-weight: 500, color: var(--text-primary)

Layout:
  - Container padding: 24px
  - Margins: 16px between sections, 12px between related items
  - Max-width: 1200px, centered

Visual Elements:
  - Border radius: 8-12px
  - Card shadows: 0 1px 3px rgba(0,0,0,0.1)
  - Elevated shadows: 0 4px 6px rgba(0,0,0,0.1)
  - Borders: 1px solid var(--border-color)

Interactive Elements:
  - Buttons: padding 10px 20px, border-radius 8px, background var(--primary), color white
  - Hover states: opacity 0.9, transform scale(1.05), transition all 0.3s ease
  - Cursor: pointer on all interactive elements

Color Usage:
  - Primary (blue): main actions, key elements
  - Secondary (green): success, positive feedback
  - Accent (purple): highlights, special features
  - Use gradients sparingly for visual interest
  - Ensure WCAG AA contrast for accessibility

✨ YOUR GOAL:
Create something magical that makes learners light up with understanding. This isn't just a visualization - it's a learning experience that should feel alive, responsive, and genuinely helpful. Make them excited to explore and discover!
"""

        if custom_prompt:
            base_prompt += f"\n\nAdditional Instructions:\n{custom_prompt}"

        base_prompt += "\n\nRespond ONLY with the complete HTML code. Do not include any explanations or markdown formatting."

        try:
            # Generate the HTML content
            response = await self.client.aio.models.generate_content(
                model='gemini-3-pro-preview',
                contents=base_prompt,
                config=types.GenerateContentConfig(
                    temperature=1.0,  # Higher temp for more creative visuals
                    max_output_tokens=15000,
                    thinking_config={"thinking_level": "HIGH"}   # ← keyword, not positional
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
