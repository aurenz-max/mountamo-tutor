/**
 * Custom Visual Generator - Dedicated service for custom interactive HTML visualizations
 *
 * Extracted from geminiService.ts as part of the registry refactoring.
 * This generates rich, interactive HTML experiences for educational content.
 */

import { ThinkingLevel } from "@google/genai";
import { ai } from "../geminiClient";

export interface CustomVisualData {
  title: string;
  description: string;
  htmlContent: string;
}

export interface CustomVisualConfig {
  intent?: string;
  title?: string;
  subject?: string;
  unitTitle?: string;
  keyTerms?: string[];
  conceptsCovered?: string[];
  objectiveId?: string;
  objectiveText?: string;
  objectiveVerb?: string;
}

/**
 * Lumina Design System CSS variables and styling guidance
 */
const LUMINA_DESIGN_SYSTEM = `
🎨 LUMINA DESIGN SYSTEM (MUST FOLLOW FOR CONSISTENT APPEARANCE):

CSS Custom Properties (use in :root):
  --bg-dark: #0f172a;           /* slate-900 - main background */
  --bg-surface: #1e293b;        /* slate-800 - card/surface background */
  --bg-elevated: #334155;       /* slate-700 - elevated elements */
  --primary: #3b82f6;           /* blue-500 - primary actions */
  --primary-light: #60a5fa;     /* blue-400 - hover states */
  --accent: #a855f7;            /* purple-500 - accents */
  --accent-light: #c084fc;      /* purple-400 - accent hover */
  --success: #10b981;           /* emerald-500 - positive feedback */
  --text-primary: #ffffff;      /* white - headings and primary text */
  --text-secondary: #cbd5e1;    /* slate-300 - body text */
  --text-muted: #94a3b8;        /* slate-400 - muted text */
  --text-subtle: #64748b;       /* slate-500 - very subtle text */
  --border-subtle: rgba(255, 255, 255, 0.05);  /* subtle borders */
  --border-normal: rgba(255, 255, 255, 0.1);   /* normal borders */

Typography:
  - Font: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif
  - Headings: 24-40px, font-weight: 700, color: var(--text-primary), tracking: -0.02em
  - Subheadings: 18-24px, font-weight: 600, color: var(--text-secondary)
  - Body: 14-16px, line-height: 1.6, color: var(--text-secondary)
  - Instructions: 14px, font-weight: 500, color: var(--text-muted)

Layout:
  - Container padding: 32px (mobile: 24px)
  - Margins: 24px between major sections, 16px between related items
  - Max-width: 1200px, centered
  - Background: var(--bg-dark) for main container

Visual Elements - Glassmorphism & Modern Cards:
  - Border radius: 12-16px (rounded-xl, rounded-2xl)
  - Card background: rgba(30, 41, 59, 0.5) /* slate-800 with transparency */
  - Card backdrop-filter: blur(12px) /* glassmorphism effect */
  - Card borders: 1px solid var(--border-subtle)
  - Subtle shadows: 0 4px 6px rgba(0, 0, 0, 0.3), 0 1px 3px rgba(0, 0, 0, 0.4)
  - Elevated shadows: 0 10px 15px rgba(0, 0, 0, 0.4), 0 4px 6px rgba(0, 0, 0, 0.5)

Interactive Elements:
  - Buttons: padding 12px 24px, border-radius 12px, font-weight 600
  - Primary button: background linear-gradient(to right, var(--primary), var(--accent)), color white
  - Secondary button: background rgba(255,255,255,0.05), border 1px solid var(--border-normal), color var(--text-primary)
  - Hover effects: transform translateY(-2px) scale(1.02), transition all 0.3s cubic-bezier(0.4, 0, 0.2, 1)
  - Active/pressed: transform translateY(0) scale(0.98)
  - Cursor: pointer on all interactive elements
  - Glow effects: box-shadow 0 0 20px rgba(59, 130, 246, 0.3) on hover

Color Usage & Gradients:
  - Primary (blue): main actions, key interactive elements
  - Accent (purple): highlights, special features, secondary emphasis
  - Success (emerald): positive feedback, completion states
  - Gradients: Use liberally for visual interest
    * Hero gradients: linear-gradient(to bottom right, #3b82f6, #a855f7)
    * Subtle accents: linear-gradient(to right, rgba(59,130,246,0.1), rgba(168,85,247,0.1))
  - Border gradients for special elements
  - Ensure WCAG AA contrast (white text on dark backgrounds)

Animations & Micro-interactions:
  - Fade in: opacity 0 to 1, duration 0.3s
  - Slide up: transform translateY(10px) to translateY(0), duration 0.4s
  - Stagger animations for lists (delay: index * 100ms)
  - Particle effects and celebrations for interactions
  - Smooth transitions with cubic-bezier(0.4, 0, 0.2, 1)

Special Effects:
  - Use backdrop-filter: blur() for glassmorphism
  - Subtle glow effects with box-shadow and rgba colors
  - Animated gradients for loading states
  - CSS transforms for depth and layering
`;

/**
 * Generate Custom Visual content
 *
 * Creates an interactive HTML visualization that brings educational concepts to life.
 * Produces complete, self-contained HTML documents with embedded CSS and JavaScript.
 *
 * @param topic - The topic being visualized
 * @param gradeContext - Educational context for the target audience
 * @param config - Configuration including intent, subject, key terms, etc.
 * @returns Custom visual data with HTML content
 */
export const generateCustomVisual = async (
  topic: string,
  gradeContext: string,
  config?: CustomVisualConfig
): Promise<CustomVisualData> => {
  // Build educational context section
  let contextSection = '';
  if (gradeContext || config) {
    contextSection = '\n🎓 EDUCATIONAL CONTEXT:\n';
    if (gradeContext) {
      contextSection += `Target Audience: ${gradeContext}\n`;
    }
    if (config?.subject) {
      contextSection += `Subject: ${config.subject}\n`;
    }
    if (config?.unitTitle) {
      contextSection += `Unit: ${config.unitTitle}\n`;
    }
  }

  // Build key terms section
  let keyTermsSection = '';
  if (config?.keyTerms && config.keyTerms.length > 0) {
    keyTermsSection = `\n📚 KEY TERMS TO EMPHASIZE: ${config.keyTerms.join(', ')}\n`;
  }

  // Build concepts section
  let conceptsSection = '';
  if (config?.conceptsCovered && config.conceptsCovered.length > 0) {
    conceptsSection = `\n💡 CORE CONCEPTS TO ILLUSTRATE: ${config.conceptsCovered.join(', ')}\n`;
  }

  // Build learning objective section
  let objectiveSection = '';
  if (config?.objectiveText) {
    objectiveSection = `\n🎯 LEARNING OBJECTIVE (CRITICAL - Design your visualization to achieve this):
- Objective: ${config.objectiveText}
- Action Verb: ${config.objectiveVerb || 'understand'}

The entire visualization must directly help students achieve this specific learning objective.
Every interactive element should reinforce this objective.\n`;
  }

  const prompt = `You are an expert educational experience designer creating interactive HTML visualizations that bring concepts to life.

Your mission: Create a delightful, engaging HTML experience that makes learners think "WOW! That makes it so much clearer!"

🎯 CONTENT TO VISUALIZE:
- Topic: ${topic}
- Exhibit Title: ${config?.title || topic}
- Purpose: ${config?.intent || 'Explore and understand the concept'}
${contextSection}${keyTermsSection}${conceptsSection}${objectiveSection}

Create a complete, self-contained HTML document that brings this concept to life.

🌟 PEDAGOGICAL PRINCIPLES - CREATE AN EXPERIENCE THAT:

1. TELLS A STORY
   - Don't just show information - create a narrative journey
   - Guide learners through the concept step-by-step with progressive revelation
   - Build from simple to complex, letting them discover patterns

2. USES POWERFUL METAPHORS & REAL-WORLD CONNECTIONS
   - Ground abstract concepts in concrete, relatable scenarios
   - Make it feel relevant to learners' lives

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

6. MAKE IT INTERACTIVE
   - The output MUST NOT be static
   - Include buttons, sliders, drag-and-drop, or dynamic visualizations

7. EMPHASIZES KEY VOCABULARY
   - Make key terms ${config?.keyTerms?.length ? `(${config.keyTerms.join(', ')}) ` : ''}prominent and interactive
   - Clicking terms should reveal definitions, examples, or demonstrations
   - Use visual cues (highlighting, borders, glow effects) to highlight important concepts
   - Interactive term cards or tooltips for deeper exploration

💻 TECHNICAL REQUIREMENTS:
1. Create a complete, self-contained HTML document with embedded CSS and JavaScript
2. **CRITICAL: IF USING LIBRARIES (p5.js, Three.js, etc.):**
   - **p5.js MUST USE INSTANCE MODE**: Do NOT use global mode (function setup() {}).
   - Use: \`new p5((p) => { p.setup = ...; p.draw = ... }, 'canvas-container');\`
   - This prevents window resizing errors and scope pollution.
3. **DOM LOADING:**
   - Wrap all vanilla JS in \`document.addEventListener('DOMContentLoaded', () => { ... })\`
   - Ensure the script attempts to access elements ONLY after they exist.
4. **RESPONSIVENESS:**
   - The canvas/container must resize dynamically.
   - Use \`window.addEventListener('resize', ...)\` to handle layout changes.
5. Works in modern browsers without external dependencies (except CDN links).
6. Include clear, friendly instructions on how to interact
7. Keep code clean, well-commented, and maintainable
8. Ensure accessibility (keyboard navigation, screen reader support where appropriate)

**NO EXTERNAL IMAGES**:
- **CRITICAL**: Do NOT use <img src="..."> with external URLs
- **INSTEAD**: Use **CSS shapes**, **inline SVGs**, **Emojis**, or **CSS gradients**

${LUMINA_DESIGN_SYSTEM}

✨ YOUR GOAL:
Create something magical that makes learners light up with understanding. This isn't just a visualization - it's a learning experience that should feel alive, responsive, and genuinely helpful. Make them excited to explore and discover!

Respond ONLY with the complete HTML code. Do not include explanations or markdown formatting.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      maxOutputTokens: 15000,
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.HIGH,
      },
    },
  });

  // Handle thinking model response
  let htmlContent = '';

  if (response.candidates && response.candidates.length > 0) {
    const candidate = response.candidates[0];
    if (candidate.content && candidate.content.parts) {
      for (const part of candidate.content.parts) {
        if (part.text) {
          htmlContent += part.text;
        }
      }
    }
  } else if (response.text) {
    htmlContent = response.text;
  }

  if (!htmlContent) {
    console.error("Empty HTML response:", response);
    throw new Error("No HTML content generated");
  }

  htmlContent = htmlContent.trim();

  // Clean up the HTML content
  const htmlStart = htmlContent.indexOf('<!DOCTYPE html');
  const htmlStartAlt = htmlContent.indexOf('<html');
  const htmlEnd = htmlContent.lastIndexOf('</html>');

  if (htmlEnd !== -1) {
    if (htmlStart !== -1) {
      htmlContent = htmlContent.substring(htmlStart, htmlEnd + 7);
    } else if (htmlStartAlt !== -1) {
      htmlContent = htmlContent.substring(htmlStartAlt, htmlEnd + 7);
    }
  }

  // Strip markdown fences if present
  if (htmlContent.startsWith('```')) {
    htmlContent = htmlContent.replace(/^```html\s*/, '').replace(/^```\s*/, '').replace(/```$/, '');
  }

  htmlContent = htmlContent.trim();

  // Wrap in HTML structure if needed
  if (!htmlContent.toLowerCase().includes('<!doctype html') && !htmlContent.toLowerCase().includes('<html')) {
    htmlContent = `<!DOCTYPE html>
<html>
<head>
    <title>${config?.title || topic}</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
    ${htmlContent}
</body>
</html>`;
  }

  console.log('🎨 Custom Visual Generated from dedicated service:', {
    topic,
    title: config?.title,
    htmlLength: htmlContent.length
  });

  return {
    title: config?.title || topic,
    description: config?.intent || 'Interactive visualization',
    htmlContent
  };
};
