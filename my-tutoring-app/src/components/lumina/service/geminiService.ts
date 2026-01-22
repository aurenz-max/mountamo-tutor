
import { Type, Schema, ThinkingLevel } from "@google/genai";
import {
  ExhibitData,
  ItemDetailData,
  MathVisualData,
  SpecializedExhibitIntent,
  SpecializedExhibit,
  CustomWebData,
  CustomSVGData,
  SentenceSchemaData,
  ComponentDefinition,
  GraphBoardData,
  AnnotatedExampleData,
  NestedHierarchyData,
  ImagePanelData,
  ManifestItemConfig,
  InteractivePassageData,
  ProblemType,
  ProblemData
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
// KNOWLEDGE CHECK - PROBLEM REGISTRY GENERATION
// ============================================================================

/**
 * Generate multiple choice problems for KnowledgeCheck component
 * Following the problem registry architecture from KNOWLEDGE_CHECK_SYSTEM.md
 */
export const generateMultipleChoiceProblems = async (
  topic: string,
  gradeLevel: string,
  count: number = 1,
  context?: string
): Promise<any[]> => {
  const gradeLevelContext = getGradeLevelContext(gradeLevel);

  // Define schema for multiple choice problem generation
  const multipleChoiceSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      problems: {
        type: Type.ARRAY,
        description: `Array of ${count} multiple choice problems`,
        items: {
          type: Type.OBJECT,
          properties: {
            id: {
              type: Type.STRING,
              description: "Unique identifier (e.g., 'mc_1', 'mc_2')"
            },
            difficulty: {
              type: Type.STRING,
              enum: ["easy", "medium", "hard"],
              description: "Problem difficulty level"
            },
            question: {
              type: Type.STRING,
              description: "The multiple choice question"
            },
            options: {
              type: Type.ARRAY,
              description: "Array of 4 answer options",
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: "Option letter (A, B, C, D)" },
                  text: { type: Type.STRING, description: "Option text" }
                },
                required: ["id", "text"]
              }
            },
            correctOptionId: {
              type: Type.STRING,
              description: "The correct option ID (A, B, C, or D)"
            },
            rationale: {
              type: Type.STRING,
              description: "Detailed explanation of the correct answer and why it's correct (2-3 sentences)"
            },
            teachingNote: {
              type: Type.STRING,
              description: "Optional teaching tip or additional context for educators (can be empty string)"
            },
            successCriteria: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Learning objectives this problem assesses (1-3 criteria)"
            }
          },
          required: ["id", "difficulty", "question", "options", "correctOptionId", "rationale", "teachingNote", "successCriteria"]
        }
      }
    },
    required: ["problems"]
  };

  const prompt = `You are an expert educational assessment designer creating multiple choice questions for a knowledge check.

🎯 TOPIC: ${topic}
📚 TARGET AUDIENCE: ${gradeLevelContext}
${context ? `📖 ADDITIONAL CONTEXT: ${context}\n` : ''}
🔢 NUMBER OF PROBLEMS: ${count}

## Your Mission:
Create ${count} high-quality multiple choice question${count > 1 ? 's' : ''} that effectively assess understanding of "${topic}".

## Quality Standards:

### 1. QUESTION DESIGN
- Write clear, unambiguous questions appropriate for the grade level
- Focus on conceptual understanding, not just memorization
- Use age-appropriate vocabulary and sentence structure
- Questions should test genuine comprehension, not trick students

### 2. ANSWER OPTIONS
- Provide exactly 4 options labeled A, B, C, D
- Make all distractors (wrong answers) plausible but clearly incorrect
- Avoid "all of the above" or "none of the above" options
- Ensure options are parallel in structure and length
- Mix up the position of the correct answer (don't always make it B or C)

### 3. DIFFICULTY PROGRESSION
${count > 1 ? `- Start with easier questions, build to harder ones
- Balance difficulty: some easy, some medium, some hard` : '- Set appropriate difficulty for the topic and grade level'}

### 4. RATIONALE (Most Important!)
- Explain WHY the correct answer is right (not just repeating it)
- Connect to broader concepts or principles
- Address common misconceptions if relevant
- Use encouraging, educational language
- 2-3 sentences that genuinely teach

### 5. TEACHING NOTE
- Provide optional pedagogical context or teaching strategies
- Suggest connections to other concepts
- Highlight common student difficulties
- Can be empty if no special note needed

### 6. SUCCESS CRITERIA
- List 1-3 specific learning objectives this problem assesses
- Use action verbs (identify, explain, apply, analyze, etc.)
- Make criteria measurable and specific to the problem

## Example Problem Structure:

{
  "id": "mc_1",
  "difficulty": "medium",
  "question": "What is the primary purpose of photosynthesis in plants?",
  "options": [
    {"id": "A", "text": "To produce oxygen for animals to breathe"},
    {"id": "B", "text": "To convert sunlight into chemical energy stored in glucose"},
    {"id": "C", "text": "To absorb water from the soil"},
    {"id": "D", "text": "To create flowers for reproduction"}
  ],
  "correctOptionId": "B",
  "rationale": "Photosynthesis is the process by which plants convert light energy into chemical energy stored in glucose molecules. While oxygen is produced as a byproduct, the primary purpose is energy conversion to fuel the plant's life processes.",
  "teachingNote": "Connect this to the broader concept of energy flow in ecosystems and how plants are producers at the base of food chains.",
  "successCriteria": [
    "Identify the main function of photosynthesis",
    "Distinguish between primary purposes and byproducts of biological processes"
  ]
}

Now generate ${count} problem${count > 1 ? 's' : ''} following this structure and quality standard.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: multipleChoiceSchema,
      },
    });

    if (!response.text) throw new Error("No content generated");
    const data = JSON.parse(response.text);

    // Transform to match MultipleChoiceProblemData interface
    const problems = data.problems.map((problem: any) => ({
      type: 'multiple_choice',
      id: problem.id,
      difficulty: problem.difficulty,
      gradeLevel: gradeLevel,
      question: problem.question,
      options: problem.options,
      correctOptionId: problem.correctOptionId,
      rationale: problem.rationale,
      teachingNote: problem.teachingNote,
      successCriteria: problem.successCriteria
    }));

    return problems;
  } catch (error) {
    console.error("Multiple choice problem generation error:", error);
    throw error;
  }
};

/**
 * Generate true/false problems for KnowledgeCheck component
 * Following the problem registry architecture from KNOWLEDGE_CHECK_SYSTEM.md
 */
export const generateTrueFalseProblems = async (
  topic: string,
  gradeLevel: string,
  count: number = 1,
  context?: string
): Promise<any[]> => {
  const gradeLevelContext = getGradeLevelContext(gradeLevel);

  // Define schema for true/false problem generation
  const trueFalseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      problems: {
        type: Type.ARRAY,
        description: `Array of ${count} true/false problems`,
        items: {
          type: Type.OBJECT,
          properties: {
            id: {
              type: Type.STRING,
              description: "Unique identifier (e.g., 'tf_1', 'tf_2')"
            },
            difficulty: {
              type: Type.STRING,
              enum: ["easy", "medium", "hard"],
              description: "Problem difficulty level"
            },
            statement: {
              type: Type.STRING,
              description: "A clear declarative statement that is either true or false"
            },
            correct: {
              type: Type.BOOLEAN,
              description: "Whether the statement is true (true) or false (false)"
            },
            rationale: {
              type: Type.STRING,
              description: "Detailed explanation of why the statement is true or false, addressing potential misconceptions (2-3 sentences)"
            },
            teachingNote: {
              type: Type.STRING,
              description: "Optional teaching tip, real-world connection, or common student misconception to address (can be empty string)"
            },
            successCriteria: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Learning objectives this problem assesses (1-3 criteria)"
            }
          },
          required: ["id", "difficulty", "statement", "correct", "rationale", "teachingNote", "successCriteria"]
        }
      }
    },
    required: ["problems"]
  };

  const prompt = `You are an expert educational assessment designer creating true/false questions for a knowledge check.

🎯 TOPIC: ${topic}
📚 TARGET AUDIENCE: ${gradeLevelContext}
${context ? `📖 ADDITIONAL CONTEXT: ${context}\n` : ''}
🔢 NUMBER OF PROBLEMS: ${count}

## Your Mission:
Create ${count} high-quality true/false statement${count > 1 ? 's' : ''} that effectively assess understanding of "${topic}".

## Quality Standards:

### 1. STATEMENT DESIGN
- Write clear, unambiguous declarative statements
- Each statement should be definitively true or false (no "sometimes" or "maybe")
- Focus on important concepts, not trivial facts
- Avoid trick questions or overly complex wording
- Use age-appropriate vocabulary and sentence structure
- Avoid absolute words like "always," "never," "all," "none" unless genuinely accurate

### 2. BALANCE TRUE AND FALSE
${count > 1 ? `- Mix true and false statements roughly equally
- Don't create patterns (e.g., T, F, T, F or all true)
- Randomize the distribution naturally` : '- Make it either true or false based on what best assesses understanding'}

### 3. DIFFICULTY PROGRESSION
${count > 1 ? `- Start with clearer statements, progress to more nuanced ones
- Balance difficulty: some easy, some medium, some hard` : '- Set appropriate difficulty for the topic and grade level'}

### 4. MISCONCEPTION TARGETING
- Target common student misconceptions with false statements
- Use false statements that reflect plausible but incorrect thinking
- Avoid obscure or trick false statements
- True statements should reinforce key accurate understandings

### 5. RATIONALE (Most Important!)
- Explain WHY the statement is true or false
- For FALSE statements: explain what makes it false AND what the truth is
- For TRUE statements: explain what makes it accurate and important
- Address any misconceptions the statement targets
- Use clear, educational language
- 2-3 sentences that genuinely teach

### 6. TEACHING NOTE
- Provide optional pedagogical context
- Highlight common student errors or confusion points
- Suggest real-world examples or demonstrations
- Connect to broader concepts
- Can be empty if no special note needed

### 7. SUCCESS CRITERIA
- List 1-3 specific learning objectives this problem assesses
- Use action verbs (identify, recognize, distinguish, understand, etc.)
- Make criteria measurable and specific to the statement

## Example Problem Structure:

{
  "id": "tf_1",
  "difficulty": "easy",
  "statement": "All mammals lay eggs.",
  "correct": false,
  "rationale": "This statement is false. While most mammals give birth to live young, there are exceptions like the platypus and echidna (monotremes) that do lay eggs. However, these are rare exceptions, and the vast majority of mammals are viviparous (give birth to live offspring).",
  "teachingNote": "Use the platypus as a fascinating exception to illustrate that biological classifications often have interesting outliers. This helps students understand that scientific rules often have nuanced exceptions.",
  "successCriteria": [
    "Recognize basic characteristics of mammal reproduction",
    "Understand that biological classifications can have exceptions"
  ]
}

{
  "id": "tf_2",
  "difficulty": "medium",
  "statement": "Photosynthesis occurs only in the leaves of plants.",
  "correct": false,
  "rationale": "This statement is false. While leaves are the primary site of photosynthesis due to their high chlorophyll concentration, photosynthesis can occur in any green part of a plant that contains chloroplasts. This includes green stems, unripe fruit, and even some roots that are exposed to light.",
  "teachingNote": "Point out green stems in common plants to demonstrate that photosynthesis isn't limited to leaves. This reinforces understanding of the role of chlorophyll rather than the organ itself.",
  "successCriteria": [
    "Identify where photosynthesis occurs in plants",
    "Understand the role of chlorophyll in photosynthesis"
  ]
}

## Important Guidelines:

✅ DO:
- Write statements that test conceptual understanding
- Use statements that address common misconceptions
- Make false statements plausible but clearly wrong
- Balance true and false statements
- Provide educational rationales that teach

❌ DON'T:
- Use trick wording or confusing language
- Create statements with "sometimes" situations
- Make statements about trivial details
- Use double negatives or complex grammar
- Write statements that are opinion-based

Now generate ${count} problem${count > 1 ? 's' : ''} following this structure and quality standard.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: trueFalseSchema,
      },
    });

    if (!response.text) throw new Error("No content generated");
    const data = JSON.parse(response.text);

    // Transform to match TrueFalseProblemData interface
    const problems = data.problems.map((problem: any) => ({
      type: 'true_false',
      id: problem.id,
      difficulty: problem.difficulty,
      gradeLevel: gradeLevel,
      statement: problem.statement,
      correct: problem.correct,
      rationale: problem.rationale,
      teachingNote: problem.teachingNote,
      successCriteria: problem.successCriteria
    }));

    return problems;
  } catch (error) {
    console.error("True/false problem generation error:", error);
    throw error;
  }
};

/**
 * Generate fill in blanks problems for KnowledgeCheck component
 * Following the problem registry architecture from KNOWLEDGE_CHECK_SYSTEM.md
 */
export const generateFillInBlanksProblems = async (
  topic: string,
  gradeLevel: string,
  count: number = 1,
  context?: string
): Promise<any[]> => {
  const gradeLevelContext = getGradeLevelContext(gradeLevel);

  // Define schema for fill in blanks problem generation
  const fillInBlanksSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      problems: {
        type: Type.ARRAY,
        description: `Array of ${count} fill in blanks problems`,
        items: {
          type: Type.OBJECT,
          properties: {
            id: {
              type: Type.STRING,
              description: "Unique identifier (e.g., 'fib_1', 'fib_2')"
            },
            difficulty: {
              type: Type.STRING,
              enum: ["easy", "medium", "hard"],
              description: "Problem difficulty level - Easy: 1 blank, Medium: 2 blanks, Hard: 3 blanks"
            },
            textWithBlanks: {
              type: Type.STRING,
              description: "Complete sentence or passage with blanks marked as [blank_1], [blank_2], etc. The blanks should test key vocabulary or concepts."
            },
            blanks: {
              type: Type.ARRAY,
              description: "Array of blank definitions, one for each [blank_N] in the text. Easy should have 1 blank, Medium 2 blanks, Hard 3 blanks.",
              items: {
                type: Type.OBJECT,
                properties: {
                  id: {
                    type: Type.STRING,
                    description: "Blank identifier matching the text (e.g., 'blank_1', 'blank_2')"
                  },
                  correctAnswer: {
                    type: Type.STRING,
                    description: "The single correct answer for this blank (will be included in word bank)"
                  },
                  caseSensitive: {
                    type: Type.BOOLEAN,
                    description: "Whether answers should be case-sensitive (usually false)"
                  }
                },
                required: ["id", "correctAnswer", "caseSensitive"]
              }
            },
            wordBank: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Word bank containing all correct answers PLUS 2-3 plausible distractors. Distractors should be related to the topic but clearly incorrect for the given context."
            },
            rationale: {
              type: Type.STRING,
              description: "Detailed explanation of the correct answers and why they're important (2-3 sentences)"
            },
            teachingNote: {
              type: Type.STRING,
              description: "Optional teaching tip about vocabulary usage, context clues, or common errors (can be empty string)"
            },
            successCriteria: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Learning objectives this problem assesses (1-3 criteria)"
            }
          },
          required: ["id", "difficulty", "textWithBlanks", "blanks", "wordBank", "rationale", "teachingNote", "successCriteria"]
        }
      }
    },
    required: ["problems"]
  };

  const prompt = `You are an expert educational assessment designer creating fill-in-the-blank questions with drag-and-drop word banks.

🎯 TOPIC: ${topic}
📚 TARGET AUDIENCE: ${gradeLevelContext}
${context ? `📖 ADDITIONAL CONTEXT: ${context}\n` : ''}
🔢 NUMBER OF PROBLEMS: ${count}

## Your Mission:
Create ${count} high-quality fill-in-the-blank problem${count > 1 ? 's' : ''} with word banks that effectively assess understanding of "${topic}".

## Quality Standards:

### 1. TEXT DESIGN
- Create complete, meaningful sentences or short passages (1-3 sentences)
- Use age-appropriate vocabulary and complexity
- Make the context clear enough that students can use context clues
- Ensure the sentence makes sense with the blanks filled in
- Use natural, flowing language (not awkward or forced)

### 2. DIFFICULTY LEVELS (CRITICAL - FOLLOW EXACTLY)
- **EASY**: Exactly 1 blank per problem
- **MEDIUM**: Exactly 2 blanks per problem
- **HARD**: Exactly 3 blanks per problem
- Mark blanks using the format [blank_1], [blank_2], [blank_3], etc.

### 3. BLANK PLACEMENT
- Place blanks strategically at KEY TERMS or CONCEPTS (not trivial words)
- Don't blank out articles (a, an, the) or prepositions unless testing those specifically
- Space blanks out - don't put them right next to each other

### 4. WORD BANK DESIGN (CRITICAL)
- Include ALL correct answers in the word bank
- Add 2-3 PLAUSIBLE DISTRACTORS (wrong answers that seem related)
- Distractors should be:
  * Related to the same topic/subject area
  * Similar part of speech as the correct answers
  * Tempting but clearly incorrect in context
- Example: If correct answers are "photosynthesis" and "glucose", distractors might be "respiration", "oxygen", "mitochondria"
- Total word bank size: (number of blanks) + 2 or 3 distractors

### 5. CASE SENSITIVITY
- Usually set caseSensitive to false (most forgiving for students)
- Only use caseSensitive: true when testing proper nouns or when case genuinely matters

### 6. DIFFICULTY PROGRESSION
${count > 1 ? `- Easy problems: 1 blank with simple vocabulary
- Medium problems: 2 blanks with moderate complexity
- Hard problems: 3 blanks with advanced concepts` : '- Set appropriate difficulty for the topic and grade level'}

### 7. RATIONALE (Most Important!)
- Explain the meaning and importance of the correct answers
- Connect the vocabulary to broader concepts
- Provide context for why these terms matter
- Address why distractors are incorrect
- Use clear, educational language
- 2-3 sentences that genuinely teach

### 8. TEACHING NOTE
- Suggest how to help students use context clues to eliminate distractors
- Mention common misconceptions that distractors might represent
- Connect to other related vocabulary
- Can be empty if no special note needed

### 9. SUCCESS CRITERIA
- List 1-3 specific learning objectives this problem assesses
- Focus on vocabulary usage, comprehension, or concept application
- Use action verbs (recall, identify, apply, use correctly, etc.)

## Example Problem Structure (Medium Difficulty - 2 blanks):

{
  "id": "fib_1",
  "difficulty": "medium",
  "textWithBlanks": "During [blank_1], plants use sunlight to convert carbon dioxide and water into [blank_2], which is stored as chemical energy.",
  "blanks": [
    {
      "id": "blank_1",
      "correctAnswer": "photosynthesis",
      "caseSensitive": false
    },
    {
      "id": "blank_2",
      "correctAnswer": "glucose",
      "caseSensitive": false
    }
  ],
  "wordBank": ["photosynthesis", "glucose", "respiration", "oxygen", "chlorophyll"],
  "rationale": "Photosynthesis is the fundamental process by which plants convert light energy into chemical energy. The glucose produced is used to fuel cellular processes and is the basis of the food chain. The distractors 'respiration' and 'oxygen' are related processes/products but don't fit the specific context clues in the sentence.",
  "teachingNote": "Encourage students to look for context clues like 'sunlight' and 'convert' to identify photosynthesis, and 'stored as chemical energy' to identify glucose as the product.",
  "successCriteria": [
    "Recall key vocabulary terms related to photosynthesis",
    "Understand the inputs and outputs of photosynthesis",
    "Use context clues to distinguish between related biological terms"
  ]
}

## Important Guidelines:

✅ DO:
- Create sentences that flow naturally
- Test important vocabulary and concepts
- Create plausible distractors that test understanding
- Use context clues to help students differentiate
- Make rationales explain WHY distractors are wrong

❌ DON'T:
- Violate the difficulty rules (1 blank for easy, 2 for medium, 3 for hard)
- Create distractors that are random or unrelated
- Blank out trivial words like "the," "and," "very"
- Make blanks impossible to deduce from context
- Use overly complex sentence structures

Now generate ${count} problem${count > 1 ? 's' : ''} following this structure and quality standard.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: fillInBlanksSchema,
      },
    });

    if (!response.text) throw new Error("No content generated");
    const data = JSON.parse(response.text);

    // Transform to match FillInBlanksProblemData interface
    const problems = data.problems.map((problem: any) => ({
      type: 'fill_in_blanks',
      id: problem.id,
      difficulty: problem.difficulty,
      gradeLevel: gradeLevel,
      textWithBlanks: problem.textWithBlanks,
      blanks: problem.blanks,
      wordBank: problem.wordBank,
      rationale: problem.rationale,
      teachingNote: problem.teachingNote,
      successCriteria: problem.successCriteria
    }));

    return problems;
  } catch (error) {
    console.error("Fill in blanks problem generation error:", error);
    throw error;
  }
};

/**
 * Generate categorization activity problems for KnowledgeCheck component
 * Following the problem registry architecture from KNOWLEDGE_CHECK_SYSTEM.md
 */
export const generateCategorizationProblems = async (
  topic: string,
  gradeLevel: string,
  count: number = 1,
  context?: string
): Promise<any[]> => {
  const gradeLevelContext = getGradeLevelContext(gradeLevel);

  // Define schema for categorization problem generation
  const categorizationSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      problems: {
        type: Type.ARRAY,
        description: `Array of ${count} categorization activity problems`,
        items: {
          type: Type.OBJECT,
          properties: {
            id: {
              type: Type.STRING,
              description: "Unique identifier (e.g., 'cat_1', 'cat_2')"
            },
            difficulty: {
              type: Type.STRING,
              enum: ["easy", "medium", "hard"],
              description: "Problem difficulty level"
            },
            instruction: {
              type: Type.STRING,
              description: "Clear instruction telling students what to categorize and how (e.g., 'Sort these words by part of speech')"
            },
            categories: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "2-4 category names that items will be sorted into"
            },
            categorizationItems: {
              type: Type.ARRAY,
              description: "6-12 items to be categorized (should be balanced across categories)",
              items: {
                type: Type.OBJECT,
                properties: {
                  itemText: {
                    type: Type.STRING,
                    description: "The text/word/concept to be categorized"
                  },
                  correctCategory: {
                    type: Type.STRING,
                    description: "The category this item belongs to (must match one of the categories exactly)"
                  }
                },
                required: ["itemText", "correctCategory"]
              }
            },
            rationale: {
              type: Type.STRING,
              description: "Educational explanation of the categorization logic, common patterns, and why items belong in their categories (2-3 sentences)"
            },
            teachingNote: {
              type: Type.STRING,
              description: "Optional teaching tip, common categorization errors to watch for, or scaffolding suggestions (can be empty string)"
            },
            successCriteria: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Learning objectives this problem assesses (1-3 criteria)"
            }
          },
          required: ["id", "difficulty", "instruction", "categories", "categorizationItems", "rationale", "teachingNote", "successCriteria"]
        }
      }
    },
    required: ["problems"]
  };

  const prompt = `You are an expert educational assessment designer creating categorization activities for a knowledge check.

🎯 TOPIC: ${topic}
📚 TARGET AUDIENCE: ${gradeLevelContext}
${context ? `📖 ADDITIONAL CONTEXT: ${context}\n` : ''}
🔢 NUMBER OF PROBLEMS: ${count}

## Your Mission:
Create ${count} high-quality categorization activit${count > 1 ? 'ies' : 'y'} that effectively assess understanding of "${topic}".

## Quality Standards:

### 1. INSTRUCTION DESIGN
- Write clear, concise instructions that explain the categorization task
- Be specific about what attribute/characteristic determines the categories
- Use age-appropriate language
- Make the task unambiguous (students should know exactly what to do)

### 2. CATEGORY SELECTION
- Choose 2-4 distinct, well-defined categories
- Categories should be mutually exclusive (no overlap)
- Categories should be collectively exhaustive for the given items
- Use clear, recognizable category labels
- Ensure categories are appropriate for the grade level

### 3. ITEM SELECTION (6-12 items per problem)
- Choose items that clearly belong to one category
- Distribute items relatively evenly across categories (avoid having all items in one category)
- Include some items that might be tempting to miscategorize (to assess deeper understanding)
- Use items that are familiar to students at the target grade level
- Vary complexity within items (some obvious, some requiring more thought)
- Ensure each item has exactly ONE correct category

### 4. DIFFICULTY PROGRESSION
${count > 1 ? `- Start with clearer categorizations, progress to more nuanced ones
- Balance difficulty: some easy, some medium, some hard` : '- Set appropriate difficulty for the topic and grade level'}

### 5. BALANCED DISTRIBUTION
- Aim for roughly equal numbers of items per category
- For 2 categories: 3-6 items each (6-12 total)
- For 3 categories: 2-4 items each (6-12 total)
- For 4 categories: 2-3 items each (8-12 total)

### 6. RATIONALE (Most Important!)
- Explain the logic behind the categorization system
- Highlight key distinguishing features of each category
- Address common categorization errors students might make
- Explain why tricky items belong where they do
- Use clear, educational language
- 2-3 sentences that genuinely teach the categorization skill

### 7. TEACHING NOTE
- Provide optional pedagogical context
- Highlight common student categorization errors
- Suggest scaffolding strategies (e.g., "Start by identifying obvious examples")
- Connect to broader concepts or real-world applications
- Can be empty if no special note needed

### 8. SUCCESS CRITERIA
- List 1-3 specific learning objectives this problem assesses
- Use action verbs (classify, identify, distinguish, group, organize, etc.)
- Make criteria measurable and specific to the categorization task

## Example Problem Structures:

### Example 1: Parts of Speech (Elementary)
{
  "id": "cat_1",
  "difficulty": "medium",
  "instruction": "Sort these words by their part of speech",
  "categories": ["Noun", "Verb", "Adjective"],
  "categorizationItems": [
    { "itemText": "cat", "correctCategory": "Noun" },
    { "itemText": "run", "correctCategory": "Verb" },
    { "itemText": "beautiful", "correctCategory": "Adjective" },
    { "itemText": "book", "correctCategory": "Noun" },
    { "itemText": "jump", "correctCategory": "Verb" },
    { "itemText": "happy", "correctCategory": "Adjective" },
    { "itemText": "teacher", "correctCategory": "Noun" },
    { "itemText": "think", "correctCategory": "Verb" },
    { "itemText": "tall", "correctCategory": "Adjective" }
  ],
  "rationale": "Parts of speech are determined by how words function in sentences. Nouns name people, places, or things (cat, book, teacher). Verbs show actions or states of being (run, jump, think). Adjectives describe or modify nouns (beautiful, happy, tall). Understanding these categories is fundamental to grammar and sentence construction.",
  "teachingNote": "Students often confuse words that can function as multiple parts of speech. For this activity, all words have clear primary functions. Consider following up with examples where words change roles (e.g., 'run' as a noun: 'I went for a run').",
  "successCriteria": [
    "Identify basic parts of speech",
    "Classify words by grammatical function",
    "Distinguish between nouns, verbs, and adjectives"
  ]
}

### Example 2: Living vs Non-living (Preschool)
{
  "id": "cat_2",
  "difficulty": "easy",
  "instruction": "Sort these things into living and non-living",
  "categories": ["Living", "Non-living"],
  "categorizationItems": [
    { "itemText": "dog", "correctCategory": "Living" },
    { "itemText": "rock", "correctCategory": "Non-living" },
    { "itemText": "tree", "correctCategory": "Living" },
    { "itemText": "toy car", "correctCategory": "Non-living" },
    { "itemText": "butterfly", "correctCategory": "Living" },
    { "itemText": "water", "correctCategory": "Non-living" },
    { "itemText": "flower", "correctCategory": "Living" },
    { "itemText": "pencil", "correctCategory": "Non-living" }
  ],
  "rationale": "Living things grow, need food and water, breathe, and can reproduce. Non-living things do not have these characteristics. While water is essential for life, water itself is not alive - it doesn't grow, eat, or reproduce. This fundamental distinction helps children understand biology and the natural world.",
  "teachingNote": "Young children often think moving objects (like toy cars) or natural objects (like water) are alive. Use the criteria of growth, eating, and reproduction to help them distinguish. Consider discussing borderline cases like seeds (alive but dormant) in future lessons.",
  "successCriteria": [
    "Distinguish between living and non-living things",
    "Apply characteristics of life to classify objects"
  ]
}

### Example 3: States of Matter (Middle School)
{
  "id": "cat_3",
  "difficulty": "hard",
  "instruction": "Classify these substances by their state of matter at room temperature (20°C)",
  "categories": ["Solid", "Liquid", "Gas"],
  "categorizationItems": [
    { "itemText": "ice cube", "correctCategory": "Solid" },
    { "itemText": "water", "correctCategory": "Liquid" },
    { "itemText": "steam", "correctCategory": "Gas" },
    { "itemText": "iron nail", "correctCategory": "Solid" },
    { "itemText": "milk", "correctCategory": "Liquid" },
    { "itemText": "oxygen", "correctCategory": "Gas" },
    { "itemText": "sugar", "correctCategory": "Solid" },
    { "itemText": "mercury", "correctCategory": "Liquid" },
    { "itemText": "carbon dioxide", "correctCategory": "Gas" },
    { "itemText": "aluminum foil", "correctCategory": "Solid" }
  ],
  "rationale": "States of matter depend on temperature and the arrangement of molecules. At room temperature (20°C): solids have fixed shape and volume (ice, iron, sugar), liquids have fixed volume but take the shape of their container (water, milk, mercury), and gases have neither fixed shape nor volume (steam, oxygen, CO2). Mercury is tricky because it's the only metal that's liquid at room temperature.",
  "teachingNote": "Students often struggle with mercury (liquid metal) and may categorize steam incorrectly if thinking of visible water vapor. Emphasize that the state depends on temperature - the same substance (H2O) appears in all three states in this list. This reinforces that state is a property determined by conditions, not by the substance itself.",
  "successCriteria": [
    "Classify substances by state of matter",
    "Apply knowledge of molecular arrangement",
    "Recognize temperature-dependent states"
  ]
}

## Important Guidelines:

✅ DO:
- Create categories that are clearly defined and mutually exclusive
- Balance items across categories (roughly equal distribution)
- Include items that test nuanced understanding
- Use familiar, age-appropriate items
- Provide detailed rationales that explain the categorization logic
- Address potential misconceptions in teaching notes

❌ DON'T:
- Create overlapping categories (items should fit clearly in ONE category)
- Put all items in one or two categories (balance the distribution)
- Use obscure items students won't recognize
- Make categories too similar or confusing
- Create categorization tasks that rely on trivial memorization
- Use ambiguous items that could reasonably fit multiple categories

## Additional Tips:

### For Toddler/Preschool:
- Use 2 categories maximum
- Use very concrete, familiar items (animals, toys, food)
- Categories should be obvious and visual (big/small, colors, animal/not animal)
- 6-8 items total

### For Elementary:
- 2-3 categories work well
- Mix concrete and slightly abstract concepts
- Can introduce academic categorizations (parts of speech, living/non-living)
- 8-10 items total

### For Middle/High School:
- 3-4 categories can work
- More abstract or academic categorizations
- Can include disciplinary knowledge (states of matter, literary genres, historical periods)
- 9-12 items total

Now generate ${count} problem${count > 1 ? 's' : ''} following this structure and quality standard.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: categorizationSchema,
      },
    });

    if (!response.text) throw new Error("No content generated");
    const data = JSON.parse(response.text);

    // Transform to match CategorizationActivityProblemData interface
    const problems = data.problems.map((problem: any) => ({
      type: 'categorization_activity',
      id: problem.id,
      difficulty: problem.difficulty,
      gradeLevel: gradeLevel,
      instruction: problem.instruction,
      categories: problem.categories,
      categorizationItems: problem.categorizationItems,
      rationale: problem.rationale,
      teachingNote: problem.teachingNote,
      successCriteria: problem.successCriteria
    }));

    return problems;
  } catch (error) {
    console.error("Categorization problem generation error:", error);
    throw error;
  }
};

/**
 * Generate matching activity problems for KnowledgeCheck component
 * Following the problem registry architecture from KNOWLEDGE_CHECK_SYSTEM.md
 */
export const generateMatchingProblems = async (
  topic: string,
  gradeLevel: string,
  count: number = 1,
  context?: string
): Promise<any[]> => {
  const gradeLevelContext = getGradeLevelContext(gradeLevel);

  // Define schema for matching activity problem generation
  const matchingSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      problems: {
        type: Type.ARRAY,
        description: `Array of ${count} matching activity problems`,
        items: {
          type: Type.OBJECT,
          properties: {
            id: {
              type: Type.STRING,
              description: "Unique identifier (e.g., 'match_1', 'match_2')"
            },
            difficulty: {
              type: Type.STRING,
              enum: ["easy", "medium", "hard"],
              description: "Problem difficulty level - Easy: 3-4 matches, Medium: 5-6 matches, Hard: 7-8 matches"
            },
            prompt: {
              type: Type.STRING,
              description: "Clear instruction for the matching task (e.g., 'Match each scientist to their discovery', 'Connect each country with its capital')"
            },
            leftItems: {
              type: Type.ARRAY,
              description: "Items in the left column (3-8 items depending on difficulty). These are what students will select first.",
              items: {
                type: Type.OBJECT,
                properties: {
                  id: {
                    type: Type.STRING,
                    description: "Unique identifier (e.g., 'L1', 'L2', 'L3')"
                  },
                  text: {
                    type: Type.STRING,
                    description: "The text to display"
                  }
                },
                required: ["id", "text"]
              }
            },
            rightItems: {
              type: Type.ARRAY,
              description: "Items in the right column (same count as leftItems). These are the matching targets.",
              items: {
                type: Type.OBJECT,
                properties: {
                  id: {
                    type: Type.STRING,
                    description: "Unique identifier (e.g., 'R1', 'R2', 'R3')"
                  },
                  text: {
                    type: Type.STRING,
                    description: "The text to display"
                  }
                },
                required: ["id", "text"]
              }
            },
            mappings: {
              type: Type.ARRAY,
              description: "Correct mappings from left items to right items. Each left item maps to exactly one right item (1:1 relationship).",
              items: {
                type: Type.OBJECT,
                properties: {
                  leftId: {
                    type: Type.STRING,
                    description: "ID of the left item"
                  },
                  rightIds: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Array containing exactly ONE right item ID (use array format for consistency, but only include one ID)"
                  }
                },
                required: ["leftId", "rightIds"]
              }
            },
            rationale: {
              type: Type.STRING,
              description: "Detailed explanation of the relationships and why they're important (2-4 sentences)"
            },
            teachingNote: {
              type: Type.STRING,
              description: "Optional teaching tip about the relationships, common confusions, or mnemonic devices (can be empty string)"
            },
            successCriteria: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Learning objectives this problem assesses (1-3 criteria)"
            }
          },
          required: ["id", "difficulty", "prompt", "leftItems", "rightItems", "mappings", "rationale", "teachingNote", "successCriteria"]
        }
      }
    },
    required: ["problems"]
  };

  const prompt = `You are an expert educational assessment designer creating matching activities for knowledge checks.

🎯 TOPIC: ${topic}
📚 TARGET AUDIENCE: ${gradeLevelContext}
${context ? `📖 ADDITIONAL CONTEXT: ${context}\n` : ''}
🔢 NUMBER OF PROBLEMS: ${count}

## Your Mission:
Create ${count} high-quality matching activity problem${count > 1 ? 's' : ''} that effectively assess understanding of "${topic}".

## What is a Matching Activity?
A matching activity presents two columns of items where students must identify the correct relationships between items in the left column and items in the right column. This tests their ability to make connections and understand relationships.

## Quality Standards:

### 1. PROMPT DESIGN
- Write a clear, specific instruction (e.g., "Match each scientist to their discovery")
- Make it obvious what kind of relationship to look for
- Use age-appropriate language
- Be specific about what's being matched

### 2. DIFFICULTY LEVELS (CRITICAL - FOLLOW EXACTLY)
- **EASY**: Exactly 3-4 matching pairs
- **MEDIUM**: Exactly 5-6 matching pairs
- **HARD**: Exactly 7-8 matching pairs
- More pairs = harder because there are more options to choose from

### 3. ITEM DESIGN (Left Column)
- Use clear, concise labels
- Keep items parallel in structure (all nouns, all people, all concepts, etc.)
- Make items distinct from each other
- Avoid overly similar items that would cause confusion
- Left items are typically the "key" items (e.g., scientists, countries, terms)

### 4. ITEM DESIGN (Right Column)
- Should match the grammatical structure needed for the relationship
- Keep parallel structure across all right items
- Make each right item clearly distinct
- Right items are typically the "values" (e.g., discoveries, capitals, definitions)

### 5. RELATIONSHIP DESIGN
- Create ONE-TO-ONE relationships (each left item matches to exactly ONE right item)
- Even though rightIds is an array, ONLY include ONE ID per mapping
- Ensure all relationships are factually correct and unambiguous
- Test important, meaningful relationships (not trivial connections)
- All left items must have a match (no unmatched items)
- All right items must have a match (no extra distractors)

### 6. ITEM BALANCE
- Keep text length similar across items (don't make one much longer)
- Vary the complexity appropriately for grade level
- Don't give away answers through text length or obvious patterns
- Randomize the order (don't put matches in the same position)

### 7. RELATIONSHIP TYPES (Choose what fits the topic)
- **Cause → Effect**: "Global warming" → "Rising sea levels"
- **Person → Achievement**: "Marie Curie" → "Discovery of radium"
- **Term → Definition**: "Photosynthesis" → "Process plants use to make food"
- **Location → Feature**: "Egypt" → "Pyramids of Giza"
- **Category → Example**: "Mammals" → "Whale"
- **Part → Whole**: "Chapter" → "Book"
- **Symbol → Meaning**: "H₂O" → "Water"
- **Question → Answer**: "What is the capital of France?" → "Paris"

### 8. RATIONALE (Most Important!)
- Explain the nature of the relationships
- Highlight why these connections matter
- Connect to broader concepts or patterns
- Address any potentially confusing pairs
- Use clear, educational language
- 2-4 sentences that genuinely teach

### 9. TEACHING NOTE
- Common mistakes students make
- Helpful mnemonics or memory tricks
- Ways to remember the relationships
- Connections to other concepts

## Example Structure:

EASY (4 pairs - Elementary Science):
{
  "id": "match_1",
  "difficulty": "easy",
  "prompt": "Match each animal to where it lives",
  "leftItems": [
    { "id": "L1", "text": "Fish" },
    { "id": "L2", "text": "Bird" },
    { "id": "L3", "text": "Rabbit" },
    { "id": "L4", "text": "Monkey" }
  ],
  "rightItems": [
    { "id": "R1", "text": "Ocean" },
    { "id": "R2", "text": "Sky/Trees" },
    { "id": "R3", "text": "Underground burrow" },
    { "id": "R4", "text": "Tree canopy" }
  ],
  "mappings": [
    { "leftId": "L1", "rightIds": ["R1"] },
    { "leftId": "L2", "rightIds": ["R2"] },
    { "leftId": "L3", "rightIds": ["R3"] },
    { "leftId": "L4", "rightIds": ["R4"] }
  ],
  "rationale": "Animals have adapted to live in specific habitats based on their physical features and needs. Fish have gills for breathing underwater, birds have wings for flying, rabbits dig burrows for shelter and safety, and monkeys have strong limbs for climbing and living in trees. Understanding animal habitats helps us see how species are specially suited to their environments.",
  "teachingNote": "Some students may confuse where monkeys and birds live since both can be in trees. Emphasize that birds primarily fly and nest in trees, while monkeys live and move through the tree canopy. You can extend this by asking: 'What would happen if a fish tried to live on land?' to reinforce adaptation concepts.",
  "successCriteria": [
    "Identify animal habitats",
    "Understand adaptation to environment",
    "Match organisms to ecosystems"
  ]
}

MEDIUM (6 pairs - Middle School History):
{
  "id": "match_2",
  "difficulty": "medium",
  "prompt": "Match each historical figure to their major contribution",
  "leftItems": [
    { "id": "L1", "text": "Isaac Newton" },
    { "id": "L2", "text": "Marie Curie" },
    { "id": "L3", "text": "Albert Einstein" },
    { "id": "L4", "text": "Charles Darwin" },
    { "id": "L5", "text": "Galileo Galilei" },
    { "id": "L6", "text": "Ada Lovelace" }
  ],
  "rightItems": [
    { "id": "R1", "text": "Laws of Motion and Gravity" },
    { "id": "R2", "text": "Research on Radioactivity" },
    { "id": "R3", "text": "Theory of Relativity" },
    { "id": "R4", "text": "Theory of Evolution" },
    { "id": "R5", "text": "Telescopic Astronomy" },
    { "id": "R6", "text": "First Computer Algorithm" }
  ],
  "mappings": [
    { "leftId": "L1", "rightIds": ["R1"] },
    { "leftId": "L2", "rightIds": ["R2"] },
    { "leftId": "L3", "rightIds": ["R3"] },
    { "leftId": "L4", "rightIds": ["R4"] },
    { "leftId": "L5", "rightIds": ["R5"] },
    { "leftId": "L6", "rightIds": ["R6"] }
  ],
  "rationale": "These scientists revolutionized our understanding of the natural world across different disciplines. Newton explained how objects move and gravity works. Curie pioneered research into radioactive elements. Einstein transformed physics with relativity. Darwin explained how species change over time. Galileo used telescopes to study space. Lovelace created the first computer program before computers even existed. Each contribution built on previous knowledge and opened new fields of study.",
  "teachingNote": "Students often confuse Newton and Einstein since both worked in physics, or Darwin and Galileo since both challenged established beliefs. Help students create mental associations: Newton = falling apple, Einstein = E=mc², Curie = radioactive elements, Darwin = finches/evolution, Galileo = telescope, Lovelace = early programming. Discuss how these discoveries connect - many later scientists built upon Newton's work.",
  "successCriteria": [
    "Connect scientists to their discoveries",
    "Recognize historical contributions to science",
    "Understand the impact of scientific breakthroughs"
  ]
}

## Important Guidelines:

✅ DO:
- Create meaningful, educational relationships
- Use parallel structure in both columns
- Make relationships unambiguous (one clear correct match)
- Balance difficulty appropriately
- Include exactly ONE ID in each rightIds array
- Randomize item order (don't put matches side-by-side)
- Choose topics students should know or can learn from
- Provide rich rationales that explain the connections

❌ DON'T:
- Create ambiguous relationships (multiple possible correct answers)
- Use obscure or overly difficult pairings for the grade level
- Put multiple IDs in rightIds arrays (always exactly one)
- Make items too similar to each other
- Leave any items unmatched
- Add extra distractors to right column
- Create patterns that give away answers (like alphabetical order)
- Use relationships based on trivial facts

## Additional Tips:

### For Toddler/Preschool:
- 3 pairs maximum (EASY difficulty)
- Use very familiar, concrete items (animals and sounds, shapes and colors)
- Relationships should be obvious and visual
- Use simple, one-word labels where possible

### For Elementary:
- 3-5 pairs (EASY to MEDIUM)
- Mix concrete and slightly abstract relationships
- Can introduce academic connections (vocabulary to definitions, math terms to symbols)
- Use complete but simple phrases

### For Middle School:
- 5-6 pairs (MEDIUM difficulty)
- More abstract or academic relationships
- Can test historical facts, scientific concepts, literary analysis
- Expect students to know or learn specific content

### For High School+:
- 6-8 pairs (MEDIUM to HARD)
- Complex academic relationships
- Can test nuanced understanding and advanced concepts
- Expect detailed domain knowledge

Now generate ${count} problem${count > 1 ? 's' : ''} following this structure and quality standard.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: matchingSchema,
      },
    });

    if (!response.text) throw new Error("No content generated");
    const data = JSON.parse(response.text);

    // Transform to match MatchingActivityProblemData interface
    const problems = data.problems.map((problem: any) => ({
      type: 'matching_activity',
      id: problem.id,
      difficulty: problem.difficulty,
      gradeLevel: gradeLevel,
      prompt: problem.prompt,
      leftItems: problem.leftItems,
      rightItems: problem.rightItems,
      mappings: problem.mappings,
      rationale: problem.rationale,
      teachingNote: problem.teachingNote,
      successCriteria: problem.successCriteria
    }));

    return problems;
  } catch (error) {
    console.error("Matching activity problem generation error:", error);
    throw error;
  }
};

/**
 * Generate knowledge check problems based on manifest config
 * This is the main entry point for manifest-driven problem generation
 *
 * @param topic - The topic to generate problems about
 * @param gradeLevel - Grade level for appropriate difficulty
 * @param config - Manifest configuration specifying problemType, count, difficulty
 * @param context - Optional additional context
 * @returns Array of problems matching the specified type
 */
export const generateKnowledgeCheckProblems = async (
  topic: string,
  gradeLevel: string,
  config?: {
    problemType?: ProblemType;
    count?: number;
    difficulty?: string;
    context?: string;
  }
): Promise<ProblemData[]> => {
  const problemType = config?.problemType || 'multiple_choice';
  const count = config?.count || 1;
  const context = config?.context;

  console.log('🎲 [generateKnowledgeCheckProblems] Starting problem generation:');
  console.log('  📝 Topic:', topic);
  console.log('  🎓 Grade Level:', gradeLevel);
  console.log('  🎯 Problem Type:', problemType);
  console.log('  🔢 Count:', count);
  console.log('  📋 Context:', context || '(none)');
  console.log('  ⚙️ Full Config:', JSON.stringify(config, null, 2));

  // Map problem types to their generator functions
  const generatorMap: Record<ProblemType, (topic: string, gradeLevel: string, count: number, context?: string) => Promise<any[]>> = {
    'multiple_choice': generateMultipleChoiceProblems,
    'true_false': generateTrueFalseProblems,
    'fill_in_blanks': generateFillInBlanksProblems,
    'matching_activity': generateMatchingProblems,
    'sequencing_activity': generateSequencingProblems,
    'categorization_activity': generateCategorizationProblems,
    'scenario_question': async () => { throw new Error('Scenario questions not yet implemented'); },
    'short_answer': async () => { throw new Error('Short answer not yet implemented'); },
  };

  const generator = generatorMap[problemType];
  if (!generator) {
    console.error(`❌ Unknown problem type: ${problemType}`);
    throw new Error(`Unknown problem type: ${problemType}`);
  }

  console.log(`  🚀 Calling generator function for: ${problemType}`);
  console.log(`  📞 Generator params: topic="${topic}", gradeLevel="${gradeLevel}", count=${count}, context="${context || ''}"`);

  try {
    const problems = await generator(topic, gradeLevel, count, context);
    console.log(`  ✅ Successfully generated ${problems.length} problem(s) of type: ${problemType}`);
    console.log(`  📦 Generated problems:`, JSON.stringify(problems, null, 2));
    return problems as ProblemData[];
  } catch (error) {
    console.error(`❌ Error generating ${problemType} problems:`, error);
    throw error;
  }
};

/**
 * Generate sequencing activity problems for KnowledgeCheck component
 * Following the problem registry architecture from KNOWLEDGE_CHECK_SYSTEM.md
 */
export const generateSequencingProblems = async (
  topic: string,
  gradeLevel: string,
  count: number = 1,
  context?: string
): Promise<any[]> => {
  const gradeLevelContext = getGradeLevelContext(gradeLevel);

  // Define schema for sequencing problem generation
  const sequencingSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      problems: {
        type: Type.ARRAY,
        description: `Array of ${count} sequencing activity problems`,
        items: {
          type: Type.OBJECT,
          properties: {
            id: {
              type: Type.STRING,
              description: "Unique identifier (e.g., 'seq_1', 'seq_2')"
            },
            difficulty: {
              type: Type.STRING,
              enum: ["easy", "medium", "hard"],
              description: "Problem difficulty level"
            },
            instruction: {
              type: Type.STRING,
              description: "Clear instruction telling students what to sequence and how (e.g., 'Arrange the life cycle stages of a butterfly in order')"
            },
            items: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "4-8 items in the CORRECT ORDER. These will be shuffled when presented to students. Each item should be a clear, concise step or stage."
            },
            rationale: {
              type: Type.STRING,
              description: "Educational explanation of why this is the correct sequence, the logic or principle that determines the order (2-3 sentences)"
            },
            teachingNote: {
              type: Type.STRING,
              description: "Optional teaching tip, common sequencing errors students make, or scaffolding suggestions (can be empty string)"
            },
            successCriteria: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Learning objectives this problem assesses (1-3 criteria)"
            }
          },
          required: ["id", "difficulty", "instruction", "items", "rationale", "teachingNote", "successCriteria"]
        }
      }
    },
    required: ["problems"]
  };

  const prompt = `You are an expert educational assessment designer creating sequencing activities for a knowledge check.

🎯 TOPIC: ${topic}
📚 TARGET AUDIENCE: ${gradeLevelContext}
${context ? `📖 ADDITIONAL CONTEXT: ${context}\n` : ''}
🔢 NUMBER OF PROBLEMS: ${count}

## Your Mission:
Create ${count} high-quality sequencing activit${count > 1 ? 'ies' : 'y'} that effectively assess understanding of "${topic}".

## Quality Standards:

### 1. INSTRUCTION DESIGN
- Write clear, concise instructions that explain what needs to be sequenced
- Be specific about the ordering principle (chronological, procedural, logical, etc.)
- Use age-appropriate language
- Make the task unambiguous (students should know exactly what to do)

### 2. ITEM SELECTION (4-8 items per problem)
- Choose items that have a clear, logical sequence
- Each item should be distinct and necessary for the sequence
- Items should be concise (1-2 short sentences or a brief phrase)
- Use parallel structure (all items formatted similarly)
- Ensure the sequence has ONE correct order (not multiple valid orderings)
- Avoid items that could logically go in multiple positions

### 3. SEQUENCE TYPES TO CONSIDER
- **Chronological**: Events in time order (historical events, life cycles, timelines)
- **Procedural**: Steps in a process (scientific method, recipe, instructions)
- **Logical**: Progression of ideas (simple to complex, cause to effect)
- **Developmental**: Stages of growth or development (life cycles, skill progression)
- **Narrative**: Story sequence (plot events, problem-solving steps)

### 4. DIFFICULTY PROGRESSION
${count > 1 ? `- Start with clearer sequences, progress to more nuanced ones
- Balance difficulty: some easy, some medium, some hard
- Easy: Obvious sequences with distinct stages (4-5 items)
- Medium: Familiar sequences requiring some thought (5-6 items)
- Hard: Complex sequences with subtle distinctions (6-8 items)` : '- Set appropriate difficulty for the topic and grade level'}

### 5. ITEM COUNT GUIDELINES
- **4 items**: Very clear, simple sequences (toddler/preschool)
- **5 items**: Basic sequences with distinct steps (kindergarten/elementary)
- **6 items**: Standard sequences requiring careful thought (elementary/middle school)
- **7-8 items**: Complex sequences with nuanced ordering (middle/high school)

### 6. RATIONALE (Most Important!)
- Explain WHY this is the correct sequence
- Describe the principle or logic that determines the order
- Highlight key transitions or turning points in the sequence
- Address why certain items must come before or after others
- Use clear, educational language
- 2-3 sentences that genuinely teach the sequencing logic

### 7. TEACHING NOTE
- Provide optional pedagogical context
- Highlight common sequencing errors students make
- Suggest scaffolding strategies (e.g., "Look for time markers like 'first,' 'then,' 'finally'")
- Connect to broader concepts or real-world applications
- Can be empty if no special note needed

### 8. SUCCESS CRITERIA
- List 1-3 specific learning objectives this problem assesses
- Use action verbs (sequence, order, arrange, organize, identify progression, etc.)
- Make criteria measurable and specific to the sequencing task

## Example Problem Structures:

### Example 1: Butterfly Life Cycle (Elementary)
{
  "id": "seq_1",
  "difficulty": "easy",
  "instruction": "Arrange the life cycle stages of a butterfly in order from beginning to end",
  "items": [
    "Egg",
    "Larva (Caterpillar)",
    "Pupa (Chrysalis)",
    "Adult Butterfly"
  ],
  "rationale": "The butterfly undergoes complete metamorphosis with four distinct stages. It begins as an egg laid by an adult butterfly, hatches into a larva (caterpillar) that eats and grows, forms a protective pupa (chrysalis) where transformation occurs, and finally emerges as an adult butterfly. This cycle represents a complete transformation from one form to another.",
  "teachingNote": "Students often confuse the pupa stage with a cocoon (which moths use). Emphasize that butterflies form a chrysalis. Use real images to reinforce each stage and highlight the dramatic transformation that occurs inside the chrysalis.",
  "successCriteria": [
    "Understand life cycle sequences",
    "Identify stages of complete metamorphosis",
    "Recognize developmental progression"
  ]
}

### Example 2: Scientific Method (Middle School)
{
  "id": "seq_2",
  "difficulty": "medium",
  "instruction": "Put the steps of the scientific method in the correct order",
  "items": [
    "Ask a question based on observation",
    "Research and gather background information",
    "Form a testable hypothesis",
    "Design and conduct an experiment",
    "Analyze data and draw conclusions",
    "Communicate results and repeat if necessary"
  ],
  "rationale": "The scientific method follows a logical progression from curiosity to conclusion. Scientists first observe something and ask a question, then research to understand existing knowledge. They form a hypothesis (testable prediction), design an experiment to test it, analyze the results, and share their findings. This iterative process ensures scientific rigor and allows others to verify results.",
  "teachingNote": "Students often want to jump straight to experimenting without forming a clear hypothesis first. Emphasize that research and hypothesis formation guide the experimental design. Note that real science is often messier than this linear model suggests - scientists may cycle back to earlier steps based on results.",
  "successCriteria": [
    "Sequence procedural steps correctly",
    "Understand the logic of scientific inquiry",
    "Recognize the relationship between hypothesis and experiment"
  ]
}

### Example 3: American Revolution Timeline (High School)
{
  "id": "seq_3",
  "difficulty": "hard",
  "instruction": "Arrange these key events of the American Revolution in chronological order",
  "items": [
    "Stamp Act imposed by British Parliament (1765)",
    "Boston Tea Party protest (1773)",
    "First Continental Congress meets (1774)",
    "Battles of Lexington and Concord (1775)",
    "Declaration of Independence signed (1776)",
    "Battle of Saratoga - turning point (1777)",
    "Treaty of Paris ends the war (1783)"
  ],
  "rationale": "The American Revolution followed a progression from colonial grievances to open rebellion to independence. The Stamp Act created early tensions, leading to protests like the Boston Tea Party. Colonists organized through the Continental Congress, armed conflict began at Lexington and Concord, and independence was formally declared in 1776. The Battle of Saratoga secured French support, and the war concluded with the Treaty of Paris recognizing American independence.",
  "teachingNote": "Students may struggle with events happening in quick succession (1774-1776). Help them see the cause-and-effect chain: taxation → protest → organization → war → independence declaration. Emphasize that declaring independence (1776) came AFTER fighting had already started (1775), which surprises many students.",
  "successCriteria": [
    "Sequence historical events chronologically",
    "Understand cause-and-effect relationships in history",
    "Recognize escalation from protest to war to independence"
  ]
}

### Example 4: Story Sequence (Elementary)
{
  "id": "seq_4",
  "difficulty": "easy",
  "instruction": "Put these events from 'The Three Little Pigs' in story order",
  "items": [
    "Three pigs leave home to build their own houses",
    "First pig builds a house of straw",
    "Wolf blows down the straw house",
    "Second pig builds a house of sticks",
    "Wolf blows down the stick house",
    "Third pig builds a house of bricks",
    "Wolf cannot blow down the brick house",
    "Pigs live safely in the brick house"
  ],
  "rationale": "This narrative follows a clear story arc with repeated patterns. The pigs leave home and each builds a house in sequence (straw, sticks, bricks). The wolf attacks each house in the same order, succeeding twice but failing at the brick house. The story demonstrates the consequences of effort and planning, with the climax at the brick house and resolution with the pigs' safety.",
  "teachingNote": "The repeated pattern (build house → wolf attacks) helps students predict and remember the sequence. Use this to discuss story structure: beginning (pigs leave), middle (building and attacks), end (safety). This foundation helps students understand more complex narratives later.",
  "successCriteria": [
    "Sequence narrative events in story order",
    "Recognize repeated patterns in stories",
    "Identify beginning, middle, and end"
  ]
}

### Example 5: Water Cycle (Elementary)
{
  "id": "seq_5",
  "difficulty": "medium",
  "instruction": "Arrange the stages of the water cycle in order, starting with evaporation",
  "items": [
    "Water evaporates from oceans, lakes, and rivers",
    "Water vapor rises and cools in the atmosphere",
    "Water vapor condenses into clouds",
    "Precipitation falls as rain, snow, or hail",
    "Water collects in bodies of water or soaks into ground",
    "The cycle repeats"
  ],
  "rationale": "The water cycle is a continuous process driven by the sun's energy. Water evaporates (turns to vapor), rises and cools, condenses into clouds, falls as precipitation, and collects back in bodies of water or underground, where it can evaporate again. This cycle has no true beginning or end, but starting with evaporation provides a logical entry point for understanding the process.",
  "teachingNote": "Emphasize that this is a CYCLE - it continues forever with no true start or finish. Students may ask 'why start with evaporation?' - explain that we need to start somewhere to explain it, but in nature, all stages are happening simultaneously around the world.",
  "successCriteria": [
    "Sequence the stages of the water cycle",
    "Understand cyclical processes",
    "Recognize the role of energy in phase changes"
  ]
}

## Important Guidelines:

✅ DO:
- Create sequences with a single, clear correct order
- Use concise, parallel phrasing for all items
- Choose sequences that teach important processes or concepts
- Include transitional logic students can learn from
- Provide detailed rationales that explain the sequencing principle
- Address potential misconceptions in teaching notes

❌ DON'T:
- Create sequences where multiple orderings could be valid
- Use overly long or complex item descriptions
- Include "trick" sequences that rely on trivial details
- Mix different types of sequences (don't combine chronological with logical)
- Create sequences with missing steps (all necessary items should be included)
- Use sequences that require specialized prior knowledge

## Additional Tips:

### For Toddler/Preschool:
- Use 3-4 items maximum
- Choose very familiar sequences (getting dressed, daily routines, simple stories)
- Use concrete, visual sequences
- Items should be obviously different from each other

### For Kindergarten/Elementary:
- 4-6 items work well
- Mix familiar routines with academic content (life cycles, simple procedures)
- Can introduce basic chronological and procedural sequences
- Use clear temporal markers when appropriate

### For Middle School:
- 5-7 items are appropriate
- More complex procedural and chronological sequences
- Can include historical events, scientific processes, mathematical procedures
- May require understanding of cause-and-effect relationships

### For High School:
- 6-8 items can work
- Complex chronological, procedural, or logical sequences
- Disciplinary knowledge (historical events, literary plot, scientific processes)
- May involve subtle distinctions between adjacent items

## Key Insight:
The ITEMS array you provide must be in the CORRECT ORDER. The frontend will shuffle them for display, and students will drag them to recreate your correct sequence.

Now generate ${count} problem${count > 1 ? 's' : ''} following this structure and quality standard.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: sequencingSchema,
      },
    });

    if (!response.text) throw new Error("No content generated");
    const data = JSON.parse(response.text);

    // Transform to match SequencingActivityProblemData interface
    const problems = data.problems.map((problem: any) => ({
      type: 'sequencing_activity',
      id: problem.id,
      difficulty: problem.difficulty,
      gradeLevel: gradeLevel,
      instruction: problem.instruction,
      items: problem.items,
      rationale: problem.rationale,
      teachingNote: problem.teachingNote,
      successCriteria: problem.successCriteria
    }));

    return problems;
  } catch (error) {
    console.error("Sequencing problem generation error:", error);
    throw error;
  }
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

/**
 * Manifest Schema for structured output
 */
const manifestSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    topic: { type: Type.STRING },
    gradeLevel: { type: Type.STRING },
    themeColor: {
      type: Type.STRING,
      description: "Hex color code for the exhibit theme (e.g., #3b82f6)"
    },
    layout: {
      type: Type.ARRAY,
      description: "Ordered array of components to display",
      items: {
        type: Type.OBJECT,
        properties: {
          componentId: {
            type: Type.STRING,
            enum: UNIVERSAL_CATALOG.map(c => c.id),
            description: "Component type from the universal catalog"
          },
          instanceId: {
            type: Type.STRING,
            description: "Unique identifier for this instance (e.g., 'curator-brief-1', 'math-visual-counting')"
          },
          title: {
            type: Type.STRING,
            description: "Display title/heading for this section"
          },
          intent: {
            type: Type.STRING,
            description: "Detailed instructions for what content to generate for this component"
          },
          config: {
            type: Type.OBJECT,
            description: "Optional configuration hints and educational context",
            properties: {
              visualType: { type: Type.STRING, description: "Type of visualization (e.g., 'bar-model', 'number-line')" },
              itemCount: { type: Type.NUMBER, description: "Number of items to generate" },
              difficulty: { type: Type.STRING, description: "Difficulty level" },
              subject: { type: Type.STRING, description: "Subject area (e.g., 'Mathematics', 'Science', 'Language Arts')" },
              unitTitle: { type: Type.STRING, description: "Broader unit context" },
              problemType: {
                type: Type.STRING,
                enum: ["multiple_choice", "true_false", "fill_in_blanks", "matching_activity", "sequencing_activity", "categorization_activity", "scenario_question", "short_answer"],
                description: "For knowledge-check components: Type of problem to generate (e.g., 'multiple_choice', 'true_false', 'sequencing_activity')"
              },
              count: { type: Type.NUMBER, description: "For knowledge-check components: Number of problems to generate" },
              gradeLevel: { type: Type.STRING, description: "For knowledge-check components: Override grade level for this specific check" },
              keyTerms: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Key vocabulary terms to emphasize in the visualization"
              },
              conceptsCovered: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Core concepts to illustrate"
              }
            }
          }
        },
        required: ["componentId", "instanceId", "title", "intent"]
      }
    }
  },
  required: ["topic", "gradeLevel", "themeColor", "layout"]
};

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

