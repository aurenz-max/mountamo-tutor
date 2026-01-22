
import { Type, Schema, ThinkingLevel } from "@google/genai";
import {
  ItemDetailData,
  MathVisualData,
  SpecializedExhibitIntent,
  SpecializedExhibit,
  CustomWebData,
  CustomSVGData,
  SentenceSchemaData,
  ComponentDefinition,
  ManifestItemConfig
} from "../types";

import { generateIntroBriefing as generateIntroBriefingWithSubject } from "./curator-brief/gemini-curator-brief";

// Foundational Concept Teaching
import { ai } from "./geminiClient";

// Content Registry (Phase 1 Refactor)
import { getGenerator } from "./registry/contentRegistry";
import { USE_CONTENT_REGISTRY, DEBUG_CONTENT_REGISTRY } from "../config/featureFlags";
// Import all generators for side-effect registration
import "./registry/generators";

// --- HELPER FUNCTIONS ---

/**
 * Convert grade level to descriptive educational context for prompts
 */
const getGradeLevelContext = (gradeLevel: string): string => {
  const contexts: Record<string, string> = {
    'toddler': 'toddlers (ages 1-3) - Use very simple language, basic concepts, concrete examples, and playful engagement. Focus on sensory experiences and foundational learning.',
    'preschool': 'preschool children (ages 3-5) - Use simple sentences, colorful examples, storytelling, and hands-on concepts. Build curiosity and wonder.',
    'kindergarten': 'kindergarten students (ages 5-6) - Use clear language, relatable examples, foundational skills, and engaging visuals. Encourage exploration and basic problem-solving.',
    'elementary': 'elementary students (grades 1-5) - Use age-appropriate vocabulary, concrete examples, structured learning objectives, and interactive elements. Build fundamental understanding.',
    'middle-school': 'middle school students (grades 6-8) - Use more complex vocabulary, abstract concepts, real-world applications, and critical thinking opportunities. Encourage deeper analysis.',
    'high-school': 'high school students (grades 9-12) - Use advanced vocabulary, sophisticated concepts, academic rigor, and college-prep content. Foster analytical and creative thinking.',
    'undergraduate': 'undergraduate college students - Use academic language, theoretical frameworks, research-based content, and interdisciplinary connections. Promote scholarly engagement.',
    'graduate': 'graduate students (Master\'s level) - Use specialized terminology, advanced theoretical concepts, research methodologies, and professional applications. Encourage critical scholarship.',
    'phd': 'doctoral students and researchers - Use expert-level terminology, cutting-edge research, theoretical depth, and scholarly discourse. Foster original thinking and research contributions.'
  };

  return contexts[gradeLevel] || contexts['elementary'];
};

/**
 * Extract objective context from manifest item config
 * Returns formatted string for use in content generation prompts
 */
const getObjectiveContext = (item: any): string => {
  const config = item.config || {};

  if (!config.objectiveText) {
    return ''; // No objective context available
  }

  return `
LEARNING OBJECTIVE FOCUS:
- Objective: ${config.objectiveText}
- Action Verb: ${config.objectiveVerb || 'understand'}
- Objective ID: ${config.objectiveId || 'unknown'}

IMPORTANT: This component must DIRECTLY help students achieve the above learning objective.
All content should be focused on this specific objective, not general topic coverage.`;
};

// --- MAIN EXHIBIT SCHEMA ---


const detailSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    description: { type: Type.STRING },
    realWorldApplication: { type: Type.STRING },
    funFact: { type: Type.STRING },
    visualPrompt: { type: Type.STRING }
  },
  required: ["title", "description", "realWorldApplication", "funFact", "visualPrompt"]
};



export const generateItemDetail = async (contextTopic: string, item: string): Promise<ItemDetailData> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Context: Educational exhibit about "${contextTopic}".
      Task: Provide a deep-dive analysis for the specific item: "${item}".`,
      config: {
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.HIGH,
        },
        responseMimeType: "application/json",
        responseSchema: detailSchema,
      }
    });
    if (!response.text) throw new Error("No text returned");

    let jsonStr = response.text.trim();
    const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) jsonStr = match[1].trim();
    
    return JSON.parse(jsonStr) as ItemDetailData;
  } catch (error) {
    console.error("Detail gen error:", error);
    throw error;
  }
}

export const generateConceptImage = async (prompt: string): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [{ text: prompt }]
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
    }
    return null;
  } catch (error) {
    console.error("Image gen error:", error);
    return null;
  }
};

// ============================================================================
// STEP 2: SPECIALIZED EXHIBIT GENERATORS
// ============================================================================

/**
 * Generate custom HTML content using powerful model with thinking
 */
export const generateCustomWebExhibit = async (
  intent: SpecializedExhibitIntent,
  contextTopic: string,
  gradeLevel?: string,
  additionalContext?: ManifestItemConfig
): Promise<CustomWebData> => {
  // Build educational context section
  let contextSection = '';
  if (gradeLevel || additionalContext) {
    contextSection = '\n🎓 EDUCATIONAL CONTEXT:\n';
    if (gradeLevel) {
      contextSection += `Grade Level: ${gradeLevel}\n`;
    }
    if (additionalContext?.subject) {
      contextSection += `Subject: ${additionalContext.subject}\n`;
    }
    if (additionalContext?.unitTitle) {
      contextSection += `Unit: ${additionalContext.unitTitle}\n`;
    }
  }

  // Build key terms section
  let keyTermsSection = '';
  if (additionalContext?.keyTerms && additionalContext.keyTerms.length > 0) {
    keyTermsSection = `\n📚 KEY TERMS TO EMPHASIZE: ${additionalContext.keyTerms.join(', ')}\n`;
  }

  // Build concepts section
  let conceptsSection = '';
  if (additionalContext?.conceptsCovered && additionalContext.conceptsCovered.length > 0) {
    conceptsSection = `\n💡 CORE CONCEPTS TO ILLUSTRATE: ${additionalContext.conceptsCovered.join(', ')}\n`;
  }

  // Build learning objective section (new objective-centric design)
  let objectiveSection = '';
  if (additionalContext?.objectiveText) {
    objectiveSection = `\n🎯 LEARNING OBJECTIVE (CRITICAL - Design your visualization to achieve this):
- Objective: ${additionalContext.objectiveText}
- Action Verb: ${additionalContext.objectiveVerb || 'understand'}

The entire visualization must directly help students achieve this specific learning objective.
Every interactive element should reinforce this objective.\n`;
  }

  const prompt = `You are an expert educational experience designer creating interactive HTML visualizations that bring concepts to life.

Your mission: Create a delightful, engaging HTML experience that makes learners think "WOW! That makes it so much clearer!"

🎯 CONTENT TO VISUALIZE:
- Topic: ${contextTopic}
- Exhibit Title: ${intent.title}
- Purpose: ${intent.purpose}
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
   - Make key terms ${additionalContext?.keyTerms?.length ? `(${additionalContext.keyTerms.join(', ')}) ` : ''}prominent and interactive
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

✨ YOUR GOAL:
Create something magical that makes learners light up with understanding. This isn't just a visualization - it's a learning experience that should feel alive, responsive, and genuinely helpful. Make them excited to explore and discover!

Respond ONLY with the complete HTML code. Do not include explanations or markdown formatting.`;

  try {
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

    // Handle thinking model response - it may have candidates structure
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

    // Aggressive cleaning to find the HTML envelope
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

    // Fallback: Strip markdown fences if regex above failed
    if (htmlContent.startsWith('```')) {
      htmlContent = htmlContent.replace(/^```html\s*/, '').replace(/^```\s*/, '').replace(/```$/, '');
    }

    htmlContent = htmlContent.trim();

    // Basic validation
    if (!htmlContent.toLowerCase().includes('<!doctype html') && !htmlContent.toLowerCase().includes('<html')) {
      // Wrap in basic HTML structure
      htmlContent = `<!DOCTYPE html>
<html>
<head>
    <title>${intent.title}</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
    ${htmlContent}
</body>
</html>`;
    }

    return {
      type: 'custom-web',
      id: intent.id,
      title: intent.title,
      description: intent.purpose,
      htmlContent
    };
  } catch (error) {
    console.error("Custom web exhibit generation error:", error);
    throw error;
  }
};

/**
 * Generate custom SVG diagram using powerful model
 */
export const generateCustomSVGExhibit = async (
  intent: SpecializedExhibitIntent,
  contextTopic: string
): Promise<CustomSVGData> => {
  const prompt = `Create a clean, educational SVG diagram for the following:

CONTEXT:
- Topic: ${contextTopic}
- Exhibit Title: ${intent.title}
- Purpose: ${intent.purpose}

REQUIREMENTS:
1. Generate complete, valid SVG code with xmlns attribute
2. Use clear labels and annotations
3. Include a viewBox for responsiveness
4. Use educational color palette: blues (#3b82f6), greens (#10b981), purples (#8b5cf6)
5. Add text labels with readable fonts (system-ui, sans-serif)
6. Ensure WCAG AA color contrast
7. Make it visually appealing and pedagogically clear

Respond ONLY with the SVG code. No explanations or markdown.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.HIGH,
        },
        responseMimeType: 'application/json',
        maxOutputTokens: 8000,
      },
    });

    // Handle thinking model response - it may have candidates structure
    let svgCode = '';

    if (response.candidates && response.candidates.length > 0) {
      const candidate = response.candidates[0];
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.text) {
            svgCode += part.text;
          }
        }
      }
    } else if (response.text) {
      svgCode = response.text;
    }

    svgCode = svgCode.trim();

    if (!svgCode) {
      console.error("Empty SVG response:", response);
      throw new Error("No SVG content generated");
    }

    // Remove markdown code fences
    svgCode = svgCode.replace(/```svg\n?/g, '').replace(/```\n?/g, '').trim();

    // Ensure it starts with <svg
    if (!svgCode.toLowerCase().includes('<svg')) {
      throw new Error("Generated content is not valid SVG");
    }

    return {
      type: 'custom-svg',
      id: intent.id,
      title: intent.title,
      description: intent.purpose,
      svgCode
    };
  } catch (error) {
    console.error("Custom SVG exhibit generation error:", error);
    throw error;
  }
};

/**
 * Generate sentence diagram using powerful model
 */
export const generateSentenceExhibit = async (
  intent: SpecializedExhibitIntent,
  contextTopic: string
): Promise<SentenceSchemaData> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      parts: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            role: { type: Type.STRING, description: "e.g., Subject, Predicate, Direct Object" },
            partOfSpeech: { type: Type.STRING, description: "e.g., Noun, Verb, Adjective" },
            definition: { type: Type.STRING, description: "Brief grammar explanation" }
          },
          required: ["text", "role", "partOfSpeech", "definition"]
        }
      }
    },
    required: ["parts"]
  };

  const prompt = `Create a sentence diagram for educational purposes.

CONTEXT:
- Topic: ${contextTopic}
- Exhibit Title: ${intent.title}
- Purpose: ${intent.purpose}

Generate a detailed sentence breakdown showing parts of speech and grammatical roles.
Choose an example sentence that clearly demonstrates the concept.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.HIGH,
        },
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    if (!response.text) throw new Error("No sentence data generated");

    const data = JSON.parse(response.text);

    return {
      type: 'sentence',
      id: intent.id,
      title: intent.title,
      description: intent.purpose,
      parts: data.parts
    };
  } catch (error) {
    console.error("Sentence exhibit generation error:", error);
    throw error;
  }
};

/**
 * Generate math visual using powerful model
 */
export const generateMathVisualExhibit = async (
  intent: SpecializedExhibitIntent,
  contextTopic: string
): Promise<MathVisualData> => {
  const visualType = intent.visualType || 'bar-model';

  // Create dynamic schema based on visual type
  const dataSchema: any = {
    type: Type.OBJECT,
    properties: {
      // Default to flexible object if no specific schema
      placeholder: { type: Type.STRING }
    }
  };

  switch (visualType) {
    case 'bar-model':
      dataSchema.properties = {
        values: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING },
              value: { type: Type.NUMBER },
              color: { type: Type.STRING }
            },
            required: ["label", "value"]
          }
        }
      };
      break;
    case 'number-line':
      dataSchema.properties = {
        range: {
          type: Type.OBJECT,
          properties: {
            min: { type: Type.NUMBER },
            max: { type: Type.NUMBER }
          },
          required: ["min", "max"]
        },
        highlights: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              value: { type: Type.NUMBER },
              label: { type: Type.STRING }
            },
            required: ["value", "label"]
          }
        }
      };
      break;
    case 'fraction-circles':
      dataSchema.properties = {
        fractions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              numerator: { type: Type.NUMBER },
              denominator: { type: Type.NUMBER },
              label: { type: Type.STRING }
            },
            required: ["numerator", "denominator"]
          }
        }
      };
      break;
    case 'base-ten-blocks':
      dataSchema.properties = {
        numberValue: { type: Type.NUMBER }
      };
      break;
    case 'geometric-shape':
      dataSchema.properties = {
        shapeName: { type: Type.STRING },
        attributes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING },
              value: { type: Type.STRING }
            },
            required: ["label", "value"]
          }
        }
      };
      break;
    default:
      // For unknown types, use flexible schema
      dataSchema.properties = {
        values: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING },
              value: { type: Type.NUMBER }
            }
          }
        }
      };
  }

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      data: dataSchema
    },
    required: ["data"]
  };

  const prompt = `Create a ${visualType} visualization for educational purposes.

CONTEXT:
- Topic: ${contextTopic}
- Exhibit Title: ${intent.title}
- Purpose: ${intent.purpose}
- Visual Type: ${visualType}

Generate appropriate data for this visualization type.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.HIGH,
        },
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    if (!response.text) throw new Error("No math visual data generated");

    const result = JSON.parse(response.text);

    return {
      type: 'math-visual',
      id: intent.id,
      visualType: visualType as any,
      title: intent.title,
      description: intent.purpose,
      data: result.data
    };
  } catch (error) {
    console.error("Math visual exhibit generation error:", error);
    throw error;
  }
};

/**
 * Main function to generate all specialized exhibits from intents
 */
export const generateSpecializedExhibits = async (
  intents: SpecializedExhibitIntent[],
  contextTopic: string
): Promise<SpecializedExhibit[]> => {
  const exhibits: SpecializedExhibit[] = [];

  for (const intent of intents) {
    try {
      let exhibit: SpecializedExhibit;

      switch (intent.type) {
        case 'custom-web':
          exhibit = await generateCustomWebExhibit(intent, contextTopic);
          break;
        case 'custom-svg':
          exhibit = await generateCustomSVGExhibit(intent, contextTopic);
          break;
        case 'sentence':
          exhibit = await generateSentenceExhibit(intent, contextTopic);
          break;
        case 'math-visual':
          exhibit = await generateMathVisualExhibit(intent, contextTopic);
          break;
        default:
          console.warn(`Unknown exhibit type: ${intent.type}`);
          continue;
      }

      exhibits.push(exhibit);
    } catch (error) {
      console.error(`Failed to generate exhibit ${intent.id}:`, error);
      // Continue with other exhibits
    }
  }

  return exhibits;
};



// ============================================================================
// MANIFEST-FIRST ARCHITECTURE
// ============================================================================

/**
 * Universal Catalog - All available components for manifest generation
 */
export const UNIVERSAL_CATALOG: ComponentDefinition[] = [
  {
    id: 'curator-brief',
    description: 'Introduction, learning objectives, and hook. REQUIRED: Always include this first.',
    constraints: 'Must be first component'
  },
  {
    id: 'concept-card-grid',
    description: 'A set of 3-4 distinct key terms or concepts defined with visuals. Use for vocabulary or core principles.'
  },
  {
    id: 'math-visual',
    description: 'Interactive math visualizations (Number Line, Base-10 Blocks, Fraction Circles, Geometric Shapes). ESSENTIAL for toddlers/elementary math.',
    constraints: 'Requires numeric/mathematical content'
  },
  {
    id: 'graph-board',
    description: 'Interactive polynomial graphing board where users plot points and visualize fitted polynomial curves. Use for algebra, functions, data analysis, or polynomial interpolation concepts.',
    constraints: 'Best for middle-school and above. Requires mathematical/data analysis context.'
  },
  {
    id: 'comparison-panel',
    description: 'Side-by-side comparison of two entities. Use when distinct "A vs B" analysis aids understanding.'
  },
  {
    id: 'generative-table',
    description: 'Structured rows/columns. Use for datasets, timelines, or categorical attributes.'
  },
  {
    id: 'custom-visual',
    description: 'A bespoke HTML/JS simulation or SVG diagram. Use for complex systems (biology, physics, counting games) that standard math visuals cannot handle. TIP: Provide config with subject, keyTerms, and conceptsCovered for richer content.'
  },
  {
    id: 'formula-card',
    description: 'Mathematical formula display with LaTeX. Use for equations, theorems, or scientific formulas.',
    constraints: 'Requires mathematical formulas'
  },
  {
    id: 'sentence-analyzer',
    description: 'Linguistic breakdown of sentence structure. Use for grammar, syntax, or language learning.',
    constraints: 'Requires language/grammar content'
  },
  {
    id: 'feature-exhibit',
    description: 'Deep-dive editorial section with multiple subsections. Use for comprehensive exploration of a topic.'
  },
  {
    id: 'knowledge-check',
    description: 'Multiple choice quiz question. RECOMMENDED: Include at the end to assess understanding.',
    constraints: 'Typically one per exhibit, at the end'
  },
  {
    id: 'scale-spectrum',
    description: 'Interactive spectrum for placing items along a continuum. Use for teaching nuanced judgments, degrees of intensity, moral/ethical reasoning, or comparative analysis.',
    constraints: 'Best for middle-school and above. Requires items that can be meaningfully positioned on a spectrum.'
  },
  {
    id: 'annotated-example',
    description: 'Step-by-step worked example with multi-layer annotations (procedural steps, strategic thinking, common errors, conceptual connections). Use for demonstrating problem-solving processes in math, science, or any domain requiring systematic reasoning.',
    constraints: 'Best for elementary and above. Requires a well-defined problem with clear solution steps.'
  },
  {
    id: 'nested-hierarchy',
    description: 'Interactive tree structure for exploring hierarchical systems (organizational charts, taxonomies, system architectures, anatomical structures). Users navigate through expandable nodes to see relationships and detailed information about each component.',
    constraints: 'Best for topics with clear hierarchical organization (2-4 levels deep). Use for biology (body systems), government (branches), classification systems, or any nested organizational structure.'
  },
  {
    id: 'image-panel',
    description: 'AI-generated images for visual context (maps, diagrams, illustrations, historical scenes, scientific visualizations). Subject-agnostic - works for geography, history, science, literature, art, or any topic requiring visual representation.',
    constraints: 'Best for topics that benefit from visual representation. Automatically categorizes and styles based on subject matter.'
  },
  {
    id: 'take-home-activity',
    description: 'Hands-on activity using common household materials. Screen-free learning experience with step-by-step instructions, safety notes, reflection prompts, and optional extensions. Perfect for reinforcing concepts through kinesthetic learning and real-world application.',
    constraints: 'Best for science experiments, math manipulatives, art projects, or any topic that benefits from hands-on exploration. Automatically adapts complexity and safety guidance to grade level.'
  },
  {
    id: 'word-builder',
    description: 'Interactive morphology lab where students construct complex words from roots, prefixes, and suffixes to understand their meaning. Drag-and-drop construction with visual breakdown showing how word parts combine. Perfect for vocabulary development, etymology, and morphological analysis in language arts.',
    constraints: 'Best for grades 3-8. Requires words that can be meaningfully broken into morphological components (prefixes, roots, suffixes).'
  }
];


// ============================================================================
// STEP 2: MANIFEST-BASED CONTENT GENERATORS
// ============================================================================

/**
 * Generate content for a single manifest item based on its component type
 *
 * Uses the ContentRegistry pattern - all generators are registered via side-effect imports.
 * See registry/generators/ for the 52 registered generators:
 * - coreGenerators.ts (21): curator-brief, concept-cards, knowledge-check, etc.
 * - mathGenerators.ts (23): bar-model, number-line, fraction-bar, etc.
 * - engineeringGenerators.ts (4): lever-lab, pulley, ramp, wheel-axle
 * - mediaGenerators.ts (3): media-player, flashcard-deck, image-comparison
 * - foundationGenerators.ts (1): foundation-explorer
 */
export const generateComponentContent = async (
  item: any, // ManifestItem
  topic: string,
  gradeLevel: string
): Promise<any> => {
  const gradeLevelContext = getGradeLevelContext(gradeLevel);

  console.log(`🔧 [generateComponentContent] Processing: ${item.componentId} (${item.instanceId})`);

  const generator = getGenerator(item.componentId);
  if (generator) {
    if (DEBUG_CONTENT_REGISTRY) {
      console.log(`  📦 [Registry] Using registered generator for '${item.componentId}'`);
    }
    return await generator(item, topic, gradeLevelContext);
  }

  console.warn(`Unknown component type: ${item.componentId}`);
  return null;
};


/**
 * Build Complete Exhibit from Pre-Generated Manifest and Curator Brief
 * This function is used in the curator-brief-first architecture where:
 * 1. Curator brief is generated first (with learning objectives)
 * 2. Learning objectives guide manifest generation
 * 3. This function builds the exhibit from the manifest (skipping curator brief generation)
 */
export const buildCompleteExhibitFromManifest = async (
  manifest: any,
  curatorBrief: any
): Promise<any> => {
  console.log('🎯 Building exhibit from pre-generated manifest and curator brief');
  console.log(`📋 Manifest has ${manifest.layout.length} components`);

  // PHASE 1: Filter out curator-brief from manifest since we already have it
  const componentsToGenerate = manifest.layout.filter(
    (item: any) => item.componentId !== 'curator-brief'
  );
  console.log(`🎨 Generating ${componentsToGenerate.length} components (excluding curator-brief)...`);

  // PHASE 2: Generate Content for All Components in Parallel (except curator-brief)
  // Use indexed map to preserve order correlation with manifest.layout
  const contentPromises = componentsToGenerate.map(async (item: any, index: number) => {
    try {
      console.log(`  ⚙️ [${index + 1}/${componentsToGenerate.length}] Generating: ${item.componentId} (${item.instanceId})`);
      const content = await generateComponentContent(item, manifest.topic, manifest.gradeLevel);
      console.log(`  ✅ [${index + 1}/${componentsToGenerate.length}] Completed: ${item.componentId}`);
      // Return with original index to maintain order
      return { ...content, _originalIndex: index };
    } catch (error) {
      console.error(`  ❌ Failed to generate ${item.componentId}:`, error);
      return { _originalIndex: index, _failed: true }; // Keep index even for failures
    }
  });

  const components = await Promise.all(contentPromises);
  const validComponents = components.filter(c => !c._failed);
  console.log(`✅ Generated ${validComponents.length}/${componentsToGenerate.length} components successfully`);

  // PHASE 3: Assemble into Complete Exhibit Structure
  console.log('🏗️ Phase 3: Assembling exhibit...');

  const exhibit: any = {
    topic: manifest.topic,
    themeColor: manifest.themeColor,
    manifest: manifest, // Include the manifest for objective mapping
    introBriefing: curatorBrief, // Use pre-generated curator brief
    intro: {
      hook: curatorBrief.hook.content,
      objectives: curatorBrief.objectives.map((obj: any) => obj.text)
    },
    // NEW: Ordered components array preserving manifest layout order
    orderedComponents: [],
    // Legacy arrays kept for backward compatibility
    cards: [],
    featureExhibit: null,
    comparison: null,
    tables: [],
    graphBoards: [],
    scaleSpectrums: [],
    annotatedExamples: [],
    nestedHierarchies: [],
    imagePanels: [],
    takeHomeActivities: [],
    knowledgeCheck: null,
    specializedExhibits: [],
    relatedTopics: []
  };

  // Build the orderedComponents array from manifest layout order
  // Create a map of instanceId -> generated content for quick lookup
  const contentMap = new Map<string, any>();
  for (const component of validComponents) {
    if (component && component.instanceId) {
      contentMap.set(component.instanceId, component);
    }
  }

  // Iterate through manifest.layout to build orderedComponents in manifest order
  for (const layoutItem of manifest.layout) {
    if (layoutItem.componentId === 'curator-brief') {
      // Add curator brief as first component
      exhibit.orderedComponents.push({
        componentId: 'curator-brief',
        instanceId: layoutItem.instanceId,
        title: layoutItem.title,
        data: curatorBrief,
        objectiveIds: layoutItem.objectiveIds || []
      });
    } else {
      // Look up generated content by instanceId
      const generatedContent = contentMap.get(layoutItem.instanceId);
      if (generatedContent && !generatedContent._failed) {
        exhibit.orderedComponents.push({
          componentId: layoutItem.componentId,
          instanceId: layoutItem.instanceId,
          title: layoutItem.title,
          data: { ...generatedContent.data, __instanceId: layoutItem.instanceId },
          objectiveIds: layoutItem.objectiveIds || []
        });
      }
    }
  }

  console.log('🎉 Exhibit assembly complete from manifest!');
  return exhibit;
};

/**
 * Wrapper for generateIntroBriefing that auto-infers subject from topic
 * This allows simpler API calls that don't require explicit subject specification
 */
export const generateIntroBriefing = async (
  topic: string,
  gradeLevel: string
): Promise<any> => {
  // Auto-infer subject as "General" - the curator brief will adapt to the topic
  return generateIntroBriefingWithSubject(topic, 'General', gradeLevel);
};

// Re-export hint generator from problems service
export { generateProblemHint } from './problems/hint-generator';

