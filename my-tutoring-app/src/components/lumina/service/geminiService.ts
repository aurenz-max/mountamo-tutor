
import { Type, Schema } from "@google/genai";
import {
  ExhibitData,
  ItemDetailData,
  MathVisualData,
  SpecializedExhibitIntent,
  SpecializedExhibit,
  CustomWebData,
  CustomSVGData,
  SentenceSchemaData,
  ExhibitManifest,
  ComponentDefinition,
  ComponentId,
  GraphBoardData,
  ScaleSpectrumData,
  AnnotatedExampleData,
  NestedHierarchyData,
  ImagePanelData,
  ManifestItemConfig,
  InteractivePassageData,
  WordBuilderData,
  ProblemType,
  ProblemData
} from "../types";

import { generateExhibitManifest } from "./manifest/gemini-manifest";
import { generateIntroBriefing } from "./curator-brief/gemini-curator-brief";
import { generateMediaPlayer } from "./media-player/gemini-media-player";
import { ai } from "./geminiClient";

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
      model: "gemini-2.5-flash",
      contents: `Context: Educational exhibit about "${contextTopic}".
      Task: Provide a deep-dive analysis for the specific item: "${item}".`,
      config: {
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

  const prompt = `You are an expert educational experience designer creating interactive HTML visualizations that bring concepts to life.

Your mission: Create a delightful, engaging HTML experience that makes learners think "WOW! That makes it so much clearer!"

🎯 CONTENT TO VISUALIZE:
- Topic: ${contextTopic}
- Exhibit Title: ${intent.title}
- Purpose: ${intent.purpose}
${contextSection}${keyTermsSection}${conceptsSection}

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
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        temperature: 1.0,
        maxOutputTokens: 15000,
        thinkingConfig: {
          thinkingLevel: 'HIGH',
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
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0.8,
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
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.7,
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
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.7,
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
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: multipleChoiceSchema,
        temperature: 0.8, // Slightly higher for variety in questions
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
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: trueFalseSchema,
        temperature: 0.8,
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
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: fillInBlanksSchema,
        temperature: 0.8,
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
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: categorizationSchema,
        temperature: 0.8,
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
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: matchingSchema,
        temperature: 0.8,
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
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: sequencingSchema,
        temperature: 0.8,
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
 */
export const generateComponentContent = async (
  item: any, // ManifestItem
  topic: string,
  gradeLevel: string
): Promise<any> => {
  const gradeLevelContext = getGradeLevelContext(gradeLevel);

  console.log(`🔧 [generateComponentContent] Processing: ${item.componentId} (${item.instanceId})`);
  if (item.componentId === 'knowledge-check') {
    console.log('  📋 Knowledge Check Item Details:');
    console.log('  - Title:', item.title);
    console.log('  - Intent:', item.intent);
    console.log('  - Config:', JSON.stringify(item.config, null, 2));
  }

  switch (item.componentId) {
    case 'curator-brief':
      return await generateCuratorBriefContent(item, topic, gradeLevelContext);

    case 'concept-card-grid':
      return await generateConceptCardsContent(item, topic, gradeLevelContext);

    case 'math-visual':
      return await generateMathVisualContent(item, topic, gradeLevelContext);

    case 'custom-visual':
      return await generateCustomVisualContent(item, topic, gradeLevel);

    case 'comparison-panel':
      return await generateComparisonContent(item, topic, gradeLevelContext);

    case 'generative-table':
      return await generateTableContent(item, topic, gradeLevelContext);

    case 'graph-board':
      return await generateGraphBoardContent(item, topic, gradeLevelContext);

    case 'scale-spectrum':
      return await generateScaleSpectrumContent(item, topic, gradeLevelContext);

    case 'annotated-example':
      return await generateAnnotatedExampleContent(item, topic, gradeLevelContext);

    case 'nested-hierarchy':
      return await generateNestedHierarchyContent(item, topic, gradeLevelContext);

    case 'image-panel':
      return await generateImagePanelContent(item, topic, gradeLevelContext);

    case 'feature-exhibit':
      return await generateFeatureExhibitContent(item, topic, gradeLevelContext);

    case 'knowledge-check':
      return await generateKnowledgeCheckContent(item, topic, gradeLevelContext);

    case 'formula-card':
      return await generateFormulaCardContent(item, topic, gradeLevelContext);

    case 'sentence-analyzer':
      return await generateSentenceAnalyzerContent(item, topic, gradeLevelContext);

    case 'take-home-activity':
      return await generateTakeHomeActivityContent(item, topic, gradeLevelContext);

    case 'interactive-passage':
      return await generateInteractivePassageContent(item, topic, gradeLevelContext);

    case 'word-builder':
      return await generateWordBuilderContent(item, topic, gradeLevelContext);

    case 'molecule-viewer':
      return await generateMoleculeViewerContent(item, topic, gradeLevelContext);

    case 'periodic-table':
      return await generatePeriodicTableContent(item, topic, gradeLevelContext);

    case 'media-player':
      return await generateMediaPlayerContent(item, topic, gradeLevelContext);

    default:
      console.warn(`Unknown component type: ${item.componentId}`);
      return null;
  }
};

/**
 * Generate Curator Brief content
 * Now generates comprehensive IntroBriefingData using the new generateIntroBriefing function
 */
const generateCuratorBriefContent = async (item: any, topic: string, gradeContext: string) => {
  // Extract subject from topic or use default
  // Try to infer subject from common keywords in topic
  let subject = 'General';
  const topicLower = topic.toLowerCase();
  if (topicLower.includes('math') || topicLower.includes('fraction') || topicLower.includes('algebra') ||
      topicLower.includes('geometry') || topicLower.includes('number') || topicLower.includes('counting')) {
    subject = 'Mathematics';
  } else if (topicLower.includes('science') || topicLower.includes('biology') || topicLower.includes('chemistry') ||
             topicLower.includes('physics') || topicLower.includes('plant') || topicLower.includes('animal')) {
    subject = 'Science';
  } else if (topicLower.includes('reading') || topicLower.includes('writing') || topicLower.includes('grammar') ||
             topicLower.includes('sentence') || topicLower.includes('vocabulary') || topicLower.includes('language')) {
    subject = 'Language Arts';
  } else if (topicLower.includes('history') || topicLower.includes('historical') || topicLower.includes('ancient') ||
             topicLower.includes('civilization') || topicLower.includes('revolution') || topicLower.includes('war')) {
    subject = 'History';
  } else if (topicLower.includes('geography') || topicLower.includes('map') || topicLower.includes('continent') ||
             topicLower.includes('country') || topicLower.includes('climate')) {
    subject = 'Geography';
  }

  // Extract grade level from gradeContext or use default
  let gradeLevel = 'Elementary';
  if (gradeContext.includes('toddler')) gradeLevel = 'Toddler';
  else if (gradeContext.includes('preschool')) gradeLevel = 'Preschool';
  else if (gradeContext.includes('kindergarten')) gradeLevel = 'Kindergarten';
  else if (gradeContext.includes('elementary') || gradeContext.includes('grades 1-5')) gradeLevel = 'Elementary';
  else if (gradeContext.includes('middle') || gradeContext.includes('grades 6-8')) gradeLevel = 'Middle School';
  else if (gradeContext.includes('high') || gradeContext.includes('grades 9-12')) gradeLevel = 'High School';

  // Generate comprehensive intro briefing
  const introBriefingData = await generateIntroBriefing(topic, subject, gradeLevel);

  return {
    type: 'curator-brief',
    instanceId: item.instanceId,
    data: introBriefingData
  };
};

/**
 * Generate Concept Cards content
 */
const generateConceptCardsContent = async (item: any, topic: string, gradeContext: string) => {
  const itemCount = item.config?.itemCount || 3;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      cards: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            subheading: { type: Type.STRING },
            definition: { type: Type.STRING },
            originStory: { type: Type.STRING },
            conceptElements: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  detail: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ['primary', 'secondary', 'highlight']}
                }
              }
            },
            timelineContext: { type: Type.STRING },
            curiosityNote: { type: Type.STRING },
            visualPrompt: { type: Type.STRING },
            themeColor: { type: Type.STRING }
          },
          required: ["title", "subheading", "definition", "conceptElements", "timelineContext", "originStory", "curiosityNote", "visualPrompt", "themeColor"]
        }
      }
    },
    required: ["cards"]
  };

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Create ${itemCount} concept cards for: "${topic}"

TARGET AUDIENCE: ${gradeContext}
INTENT: ${item.intent}

Generate ${itemCount} key concepts with definitions, visual prompts, and pedagogical elements.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: 0.7,
    },
  });

  if (!response.text) throw new Error("No content generated");
  const data = JSON.parse(response.text);
  return {
    type: 'concept-card-grid',
    instanceId: item.instanceId,
    data: data.cards
  };
};

/**
 * Generate Math Visual content (reusing existing generator)
 */
const generateMathVisualContent = async (item: any, topic: string, gradeContext: string) => {
  const visualType = item.config?.visualType || 'bar-model';

  const intent: SpecializedExhibitIntent = {
    id: item.instanceId,
    type: 'math-visual',
    title: item.title,
    purpose: item.intent,
    visualType: visualType as any
  };

  const result = await generateMathVisualExhibit(intent, topic);
  return {
    type: 'math-visual',
    instanceId: item.instanceId,
    data: result
  };
};

/**
 * Generate Custom Visual content (reusing existing generator)
 */
const generateCustomVisualContent = async (item: any, topic: string, gradeLevel: string) => {
  const intent: SpecializedExhibitIntent = {
    id: item.instanceId,
    type: 'custom-web',
    title: item.title,
    purpose: item.intent
  };

  // Extract additional context from config if available
  const additionalContext = item.config ? {
    subject: item.config.subject,
    unitTitle: item.config.unitTitle,
    keyTerms: item.config.keyTerms,
    conceptsCovered: item.config.conceptsCovered
  } : undefined;

  const result = await generateCustomWebExhibit(intent, topic, gradeLevel, additionalContext);
  return {
    type: 'custom-visual',
    instanceId: item.instanceId,
    data: result
  };
};

/**
 * Generate Comparison Panel content
 */
const generateComparisonContent = async (item: any, topic: string, gradeContext: string) => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      intro: { type: Type.STRING },
      item1: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          visualPrompt: { type: Type.STRING },
          points: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["name", "description", "visualPrompt", "points"]
      },
      item2: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          visualPrompt: { type: Type.STRING },
          points: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["name", "description", "visualPrompt", "points"]
      },
      synthesis: { type: Type.STRING }
    },
    required: ["title", "intro", "item1", "item2", "synthesis"]
  };

  const response = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: `Create comparison panel for: "${topic}"

TARGET AUDIENCE: ${gradeContext}
INTENT: ${item.intent}

Generate a side-by-side comparison with two items.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: 0.7,
    },
  });

  if (!response.text) throw new Error("No content generated");
  const data = JSON.parse(response.text);
  return {
    type: 'comparison-panel',
    instanceId: item.instanceId,
    data
  };
};

/**
 * Generate Table content
 */
const generateTableContent = async (item: any, topic: string, gradeContext: string) => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      headers: { type: Type.ARRAY, items: { type: Type.STRING } },
      rows: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.STRING } } }
    },
    required: ["headers", "rows"]
  };

  const response = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: `Create structured table for: "${topic}"

TARGET AUDIENCE: ${gradeContext}
INTENT: ${item.intent}

Generate a table with headers and rows.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: 0.7,
    },
  });

  if (!response.text) throw new Error("No content generated");
  const data = JSON.parse(response.text);
  return {
    type: 'generative-table',
    instanceId: item.instanceId,
    data: { ...data, type: 'table' }
  };
};

/**
 * Generate Feature Exhibit content
 */
const generateFeatureExhibitContent = async (item: any, topic: string, gradeContext: string) => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      visualPrompt: { type: Type.STRING },
      sections: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            heading: { type: Type.STRING },
            content: { type: Type.STRING }
          },
          required: ["heading", "content"]
        }
      },
      relatedTerms: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ["title", "visualPrompt", "sections", "relatedTerms"]
  };

  const response = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: `Create feature exhibit for: "${topic}"

TARGET AUDIENCE: ${gradeContext}
INTENT: ${item.intent}

Generate a deep-dive editorial section with multiple subsections.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: 0.7,
    },
  });

  if (!response.text) throw new Error("No content generated");
  const data = JSON.parse(response.text);
  return {
    type: 'feature-exhibit',
    instanceId: item.instanceId,
    data
  };
};

/**
 * Generate Knowledge Check content
 */
const generateKnowledgeCheckContent = async (item: any, topic: string, gradeContext: string) => {
  console.log('🎯 [Knowledge Check] generateKnowledgeCheckContent called with:');
  console.log('  📦 item:', JSON.stringify(item, null, 2));
  console.log('  📚 topic:', topic);
  console.log('  🎓 gradeContext:', gradeContext);

  // NEW: If config specifies a problemType, use the problem registry system
  if (item.config?.problemType) {
    console.log('  ✅ Using config-based problem generation');
    console.log('  🎲 Problem Type:', item.config.problemType);
    console.log('  📊 Config:', JSON.stringify(item.config, null, 2));

    const problems = await generateKnowledgeCheckProblems(
      topic,
      item.config.gradeLevel || 'elementary',
      {
        problemType: item.config.problemType,
        count: item.config.count || 1,
        difficulty: item.config.difficulty,
        context: item.intent
      }
    );

    return {
      type: 'knowledge-check',
      data: { problems } // Return in problem registry format
    };
  }

  console.log('  ⚠️ No config.problemType found - using LEGACY format');

  // LEGACY: Fall back to old single multiple-choice format with visuals
  // Define reusable schemas for visual primitives
  const objectItemSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "Name of the object type (e.g., 'apple', 'ball')" },
      count: { type: Type.INTEGER, description: "Number of this object type" },
      icon: { type: Type.STRING, description: "Emoji icon (e.g., '🍎', '⚽️')" },
      attributes: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Optional visual attributes like ['red', 'shiny']"
      }
    },
    required: ["name", "count"]
  };

  const objectCollectionSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      instruction: { type: Type.STRING, description: "Optional scene description" },
      items: {
        type: Type.ARRAY,
        items: objectItemSchema,
        description: "Array of object types in this collection"
      },
      layout: {
        type: Type.STRING,
        enum: ["grid", "scattered", "row"],
        description: "Layout arrangement"
      }
    },
    required: ["items"]
  };

  const comparisonPanelItemSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      label: { type: Type.STRING, description: "Label for this panel (e.g., 'Maya's Collection')" },
      collection: objectCollectionSchema
    },
    required: ["label", "collection"]
  };

  // ABC/Early Literacy Visual Primitive Schemas
  const letterPictureItemSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "Item name" },
      image: { type: Type.STRING, description: "Emoji or image" },
      highlight: { type: Type.BOOLEAN, description: "True if starts with focus letter" }
    },
    required: ["name", "image", "highlight"]
  };

  const letterPictureItemsArraySchema: Schema = {
    type: Type.ARRAY,
    items: letterPictureItemSchema,
    description: "Array of items - MUST contain at least 4 items",
    minItems: 4
  };

  const rhymingPairSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      word1: { type: Type.STRING, description: "First rhyming word" },
      image1: { type: Type.STRING, description: "Emoji for first word" },
      word2: { type: Type.STRING, description: "Second rhyming word" },
      image2: { type: Type.STRING, description: "Emoji for second word" }
    },
    required: ["word1", "word2"]
  };

  const soundSortCategorySchema: Schema = {
    type: Type.OBJECT,
    properties: {
      label: { type: Type.STRING, description: "Category label" },
      words: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Words in category" }
    },
    required: ["label", "words"]
  };

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      question: { type: Type.STRING },
      options: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            text: { type: Type.STRING }
          },
          required: ["id", "text"]
        }
      },
      correctAnswerId: { type: Type.STRING },
      explanation: { type: Type.STRING },
      visualType: {
        type: Type.STRING,
        enum: [
          "none",
          "object-collection",
          "comparison-panel",
          "letter-picture",
          "alphabet-sequence",
          "rhyming-pairs",
          "sight-word-card",
          "sound-sort"
        ],
        description: "Type of visual primitive (or 'none' if no visual needed)"
      },
      visualData: {
        type: Type.OBJECT,
        description: "Visual primitive data - structure depends on visualType",
        properties: {
          // For object-collection
          instruction: { type: Type.STRING },
          items: { type: Type.ARRAY, items: objectItemSchema },
          layout: { type: Type.STRING, enum: ["grid", "scattered", "row"] },
          // For comparison-panel
          panels: {
            type: Type.ARRAY,
            items: comparisonPanelItemSchema,
            description: "Exactly 2 panels for comparison-panel type"
          },
          // For alphabet-sequence
          sequence: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Sequence with blanks as '_'" },
          missing: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Letters that are missing" },
          highlightMissing: { type: Type.BOOLEAN, description: "Highlight the missing positions" },
          showImages: { type: Type.BOOLEAN, description: "Show images for letters" },
          // For rhyming-pairs
          pairs: { type: Type.ARRAY, items: rhymingPairSchema, description: "Rhyming word pairs" },
          showConnectingLines: { type: Type.BOOLEAN, description: "Draw lines connecting pairs" },
          // For sight-word-card
          word: { type: Type.STRING, description: "The sight word" },
          fontSize: { type: Type.STRING, enum: ["small", "medium", "large"], description: "Text size" },
          showInContext: { type: Type.BOOLEAN, description: "Show word in a sentence" },
          sentence: { type: Type.STRING, description: "Example sentence using the word" },
          highlightWord: { type: Type.BOOLEAN, description: "Highlight the word in sentence" },
          // For sound-sort
          targetSound: { type: Type.STRING, description: "The sound being sorted (e.g., 'short a')" },
          categories: { type: Type.ARRAY, items: soundSortCategorySchema, description: "Sound categories" },
          showPictures: { type: Type.BOOLEAN, description: "Show pictures for words" }
        }
      }
    },
    required: ["question", "options", "correctAnswerId", "explanation", "visualType"]
  };

  const response = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: `Create knowledge check quiz for: "${topic}"

TARGET AUDIENCE: ${gradeContext}
INTENT: ${item.intent}

Generate a multiple choice question with 4 options.

VISUAL PRIMITIVES:
Set visualType to specify which visual primitive to include (or 'none' for no visual):

MATH/COUNTING VISUALS:
1. "object-collection" - Use for counting discrete objects, showing groups of items, simple identification tasks
   When visualType is "object-collection", populate visualData with:
   {
     instruction?: "Scene description (no directive language like 'Count', just describe scenario)",
     items: [{name: "apple", count: 5, icon: "🍎", attributes?: ["red"]}],
     layout?: "grid" | "scattered" | "row"
   }

2. "comparison-panel" - Use for side-by-side comparison of two object groups, "who has more/less" questions
   When visualType is "comparison-panel", populate visualData with:
   {
     panels: [
       {label: "Maya's Collection", collection: {items: [{name: "apple", count: 3, icon: "🍎"}]}},
       {label: "Tom's Collection", collection: {items: [{name: "orange", count: 5, icon: "🍊"}]}}
     ]
   }

ABC/EARLY LITERACY VISUALS:
3. "letter-picture" - Use for letter-sound correspondence, initial sound identification, phonics
   When visualType is "letter-picture", populate visualData with:
   {
     letter: "A",
     items: [
       {name: "Apple", image: "🍎", highlight: true},
       {name: "Ball", image: "⚽", highlight: false},
       {name: "Ant", image: "🐜", highlight: true},
       {name: "Alligator", image: "🐊", highlight: true},
       {name: "Airplane", image: "✈️", highlight: true},
       {name: "Cat", image: "🐱", highlight: false}
     ]
   }
   GUIDANCE: Include enough items for variety (typically 4-8 items works well).
   Balance items that start with the letter (highlight: true) and those that don't (highlight: false).
   Consider what's developmentally appropriate - common letters can have more examples.

4. "alphabet-sequence" - Use for alphabetical order, missing letter identification, sequence completion
   When visualType is "alphabet-sequence", populate visualData with:
   {
     sequence: ["A", "B", "_", "D"],
     missing: ["C"],
     highlightMissing?: true,
     showImages?: false
   }

5. "rhyming-pairs" - Use for rhyme identification, phonological awareness, word families
   When visualType is "rhyming-pairs", populate visualData with:
   {
     pairs: [
       {word1: "cat", image1: "🐱", word2: "hat", image2: "🎩"},
       {word1: "dog", image1: "🐶", word2: "log", image2: "🪵"}
     ],
     showConnectingLines?: true
   }

6. "sight-word-card" - Use for high-frequency word recognition, sight word practice in context
   When visualType is "sight-word-card", populate visualData with:
   {
     word: "the",
     fontSize?: "large",
     showInContext?: true,
     sentence?: "The cat runs fast.",
     highlightWord?: true
   }

7. "sound-sort" - Use for phoneme categorization, vowel sound practice, sound discrimination
   When visualType is "sound-sort", populate visualData with:
   {
     targetSound: "short a",
     categories: [
       {label: "Has short 'a'", words: ["cat", "hat", "mat"]},
       {label: "No short 'a'", words: ["dog", "sun", "tree"]}
     ],
     showPictures?: true
   }

8. "none" - No visual needed (for abstract concepts or text-only questions)
   When visualType is "none", you can leave visualData empty or omit fields

CRITICAL RULES:
- Use emojis for icons (🍎, 🍊, ⚽️, 🌟, 🍪, 🎈, 🐱, 🐶, etc.)
- Keep counts reasonable for grade level (1-10 for K-1)
- Question should reference the visual when visualType is not "none"
- For object-collection: instruction describes the SCENARIO, not directives
- For ABC visuals: Choose based on whether question focuses on letter sounds, order, rhyming, or sight words
- Use ABC visuals for K-1 literacy topics (letters, sounds, rhymes, words)`,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: 0.7,
    },
  });

  if (!response.text) throw new Error("No content generated");
  const rawData = JSON.parse(response.text);

  // Transform the data to match our component interface
  const transformedData: any = {
    question: rawData.question,
    options: rawData.options,
    correctAnswerId: rawData.correctAnswerId,
    explanation: rawData.explanation
  };

  // Add visual if present and not "none"
  if (rawData.visualType && rawData.visualType !== 'none' && rawData.visualData) {
    transformedData.visual = {
      type: rawData.visualType,
      data: rawData.visualData
    };
  }

  return {
    type: 'knowledge-check',
    instanceId: item.instanceId,
    data: transformedData
  };
};

/**
 * Generate Formula Card content
 */
const generateFormulaCardContent = async (item: any, topic: string, gradeContext: string) => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Title of the formula (e.g., 'Newton's Second Law')" },
      description: { type: Type.STRING, description: "Brief overview of what the formula represents" },
      formula: { type: Type.STRING, description: "The formula as plain text (e.g., 'F = ma')" },
      segments: {
        type: Type.ARRAY,
        description: "Interactive segments for the formula display",
        items: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING, description: "The text segment (variable, operator, or symbol)" },
            meaning: { type: Type.STRING, description: "Brief tooltip explanation (for variables only)" },
            isVariable: { type: Type.BOOLEAN, description: "True if this is a variable/parameter, false for operators" }
          },
          required: ["text", "isVariable"]
        }
      },
      parameters: {
        type: Type.ARRAY,
        description: "Detailed explanation cards for each parameter/variable in the formula",
        items: {
          type: Type.OBJECT,
          properties: {
            symbol: { type: Type.STRING, description: "The variable symbol (e.g., 'F', 'm', 'a')" },
            name: { type: Type.STRING, description: "Full name (e.g., 'Force', 'Mass', 'Acceleration')" },
            description: { type: Type.STRING, description: "Clear explanation of what this parameter represents (2-3 sentences)" },
            unit: { type: Type.STRING, description: "Standard unit of measurement (e.g., 'Newtons (N)', 'kilograms (kg)', 'm/s²')" },
            isHighlighted: { type: Type.BOOLEAN, description: "True for the MOST IMPORTANT parameters that students should focus on (typically 1-2 parameters). Consider L'Hôpital's rule principle - highlight parameters that have the most significant impact or are most commonly misunderstood." }
          },
          required: ["symbol", "name", "description"]
        }
      },
      relationships: {
        type: Type.ARRAY,
        description: "Key relationships between parameters (optional, 1-3 relationships)",
        items: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING, description: "Explanation of the relationship (e.g., 'Force is directly proportional to both mass and acceleration')" },
            type: { type: Type.STRING, enum: ["proportional", "inverse", "complex"], description: "Type of mathematical relationship" }
          },
          required: ["description"]
        }
      },
      examples: {
        type: Type.ARRAY,
        description: "Real-world examples demonstrating the formula (2-3 examples recommended)",
        items: {
          type: Type.OBJECT,
          properties: {
            scenario: { type: Type.STRING, description: "Concrete real-world scenario (e.g., 'Pushing a shopping cart')" },
            calculation: { type: Type.STRING, description: "Optional: Show the calculation with specific numbers" },
            result: { type: Type.STRING, description: "The outcome or what it demonstrates" }
          },
          required: ["scenario", "result"]
        }
      },
      applicationContext: { type: Type.STRING, description: "When and where this formula is used (1-2 sentences)" }
    },
    required: ["title", "description", "formula", "segments", "parameters"]
  };

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Create a comprehensive formula card for: "${topic}"

TARGET AUDIENCE: ${gradeContext}
INTENT: ${item.intent}

## Task: Generate a rich, educational formula explanation

You are creating an interactive formula display that helps students deeply understand a mathematical or scientific formula.

## Design Principles:

1. **Parameter Highlighting** (L'Hôpital's Rule Principle):
   - Mark 1-2 parameters as "highlighted" (isHighlighted: true)
   - Highlight parameters that are:
     * Most conceptually important
     * Most commonly misunderstood
     * Have the greatest impact on the result
   - For F=ma, you might highlight 'a' (acceleration) as it's often the key variable being solved for
   - For complex formulas (Snell's Law, Einstein's equations), highlight the parameters that reveal the core insight

2. **Parameter Cards**:
   - Each variable gets a detailed explanation card
   - Include the standard unit of measurement
   - Use clear, accessible language appropriate for ${gradeContext}
   - Explain what the parameter represents in practical terms

3. **Relationships**:
   - Explain how parameters interact (proportional, inverse, etc.)
   - Make mathematical relationships intuitive
   - Focus on the 1-3 most important relationships

4. **Real-World Examples**:
   - Provide 2-3 concrete, relatable scenarios
   - Use everyday situations students can visualize
   - Show how the formula applies in practice
   - Optional: Include simple numerical calculations

5. **Segments**:
   - Break the formula into interactive parts
   - Variables should have isVariable: true with a brief meaning
   - Operators (=, +, -, ×, ÷, etc.) should have isVariable: false

## Example Output Structure (for reference):

For "F = ma" (Newton's Second Law):
{
  "title": "Newton's Second Law of Motion",
  "description": "This fundamental law describes how force, mass, and acceleration are related",
  "formula": "F = ma",
  "segments": [
    {"text": "F", "meaning": "Force", "isVariable": true},
    {"text": " = ", "isVariable": false},
    {"text": "m", "meaning": "Mass", "isVariable": true},
    {"text": "a", "meaning": "Acceleration", "isVariable": true}
  ],
  "parameters": [
    {
      "symbol": "F",
      "name": "Force",
      "description": "Force is a push or pull on an object. It's what causes things to speed up, slow down, or change direction.",
      "unit": "Newtons (N)",
      "isHighlighted": false
    },
    {
      "symbol": "m",
      "name": "Mass",
      "description": "Mass is how much matter an object contains. Heavier objects have more mass and are harder to accelerate.",
      "unit": "kilograms (kg)",
      "isHighlighted": false
    },
    {
      "symbol": "a",
      "name": "Acceleration",
      "description": "Acceleration is how quickly velocity changes. It's the rate at which something speeds up or slows down.",
      "unit": "meters per second squared (m/s²)",
      "isHighlighted": true
    }
  ],
  "relationships": [
    {
      "description": "Force is directly proportional to both mass and acceleration. Doubling either mass or acceleration will double the force.",
      "type": "proportional"
    }
  ],
  "examples": [
    {
      "scenario": "Pushing a shopping cart",
      "result": "An empty cart (low mass) accelerates easily with little force. A full cart (high mass) needs much more force to achieve the same acceleration."
    },
    {
      "scenario": "Car braking",
      "calculation": "A 1000 kg car decelerating at 5 m/s² experiences F = 1000 × 5 = 5000 N of braking force",
      "result": "Heavier vehicles require more braking force to stop in the same distance."
    }
  ],
  "applicationContext": "This formula is fundamental in physics and engineering, used to analyze motion in everything from rocket launches to car safety systems."
}

Now generate comprehensive formula data following these principles.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: 0.7,
    },
  });

  if (!response.text) throw new Error("No content generated");
  const data = JSON.parse(response.text);
  return {
    type: 'formula-card',
    instanceId: item.instanceId,
    data: { ...data, type: 'equation' }
  };
};

/**
 * Generate Sentence Analyzer content (reusing existing generator)
 */
const generateSentenceAnalyzerContent = async (item: any, topic: string, gradeContext: string) => {
  const intent: SpecializedExhibitIntent = {
    id: item.instanceId,
    type: 'sentence',
    title: item.title,
    purpose: item.intent
  };

  const result = await generateSentenceExhibit(intent, topic);
  return {
    type: 'sentence-analyzer',
    instanceId: item.instanceId,
    data: result
  };
};

/**
 * Generate Graph Board content
 * Note: GraphBoard is self-contained and interactive - no AI generation needed
 */
const generateGraphBoardContent = async (item: any, topic: string, gradeContext: string): Promise<{ type: string; instanceId: string; data: GraphBoardData }> => {
  // GraphBoard is fully interactive and self-contained
  // Just return the title from the manifest
  return {
    type: 'graph-board',
    instanceId: item.instanceId,
    data: {
      title: item.title,
      description: item.intent || "Click on the grid to plot points and see the polynomial curve that fits through them."
    }
  };
};

/**
 * Generate Scale Spectrum content
 */
const generateScaleSpectrumContent = async (item: any, topic: string, gradeContext: string) => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Question framing the spectrum judgment" },
      description: { type: Type.STRING, description: "Brief instruction for the student" },
      spectrum: {
        type: Type.OBJECT,
        properties: {
          leftLabel: { type: Type.STRING, description: "Left endpoint (3 words max)" },
          rightLabel: { type: Type.STRING, description: "Right endpoint (3 words max)" },
          leftColor: { type: Type.STRING, description: "Hex color for left (default #ef4444)" },
          rightColor: { type: Type.STRING, description: "Hex color for right (default #22c55e)" },
          anchors: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                position: { type: Type.NUMBER, description: "Position 0-100 on spectrum" },
                label: { type: Type.STRING, description: "Endpoint label" },
                example: { type: Type.STRING, description: "Concrete example (5 words max)" }
              },
              required: ["position", "label", "example"]
            },
            description: "Exactly 5 anchors at positions 0, 25, 50, 75, 100"
          }
        },
        required: ["leftLabel", "rightLabel", "leftColor", "rightColor", "anchors"]
      },
      items: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.NUMBER },
            title: { type: Type.STRING, description: "Item name (concise)" },
            description: { type: Type.STRING, description: "One sentence explaining what this item is" },
            correctPosition: { type: Type.NUMBER, description: "Position 0-100 on spectrum" },
            tolerance: { type: Type.NUMBER, description: "Acceptable margin of error (5-18)" },
            explanation: { type: Type.STRING, description: "2-3 sentences justifying the position" },
            metadata: { type: Type.STRING, description: "Optional contextual metadata like date (e.g., '235 CE'), step number (e.g., 'Step 3'), category, or other brief identifier relevant to the topic. Leave empty if not applicable." }
          },
          required: ["id", "title", "description", "correctPosition", "tolerance", "explanation"]
        },
        description: "4-6 items that span the spectrum meaningfully"
      }
    },
    required: ["title", "description", "spectrum", "items"]
  };

  const prompt = `You are generating a Scale/Spectrum learning activity. The student will place items along a continuum, learning to make nuanced judgments rather than binary classifications.

CONTEXT:
- Topic: ${topic}
- Target Audience: ${gradeContext}
- Intent: ${item.intent}

## Design Principles

1. **Anchors calibrate judgment**: Each anchor should be an unambiguous reference point. Students use these to triangulate where items belong. Choose anchors that are widely understood and not themselves debatable.

2. **Tolerance reflects genuine ambiguity**: Items with clear positions get tolerance 5-8. Items where reasonable people disagree get tolerance 12-18. Never use tolerance > 20 (that's too vague to teach anything).

3. **Avoid clustering**: Distribute items across the spectrum. Include at least one item in each third (0-33, 34-66, 67-100). Clustering defeats the purpose.

4. **Explanations model reasoning**: The explanation should articulate the factors that determine position, not just assert it. Use phrases like "because...", "considering that...", "while X, also Y..."

5. **Title as genuine question**: Frame the title as something worth asking, not a label. "How formal is this writing?" not "Writing Formality Spectrum"

6. **Metadata usage**: Include the metadata field when contextually relevant:
   - For historical topics: Include dates (e.g., "235 CE", "1776", "14th Century")
   - For sequential processes: Include step numbers (e.g., "Step 1", "Phase 2")
   - For categorized items: Include category names (e.g., "Politics", "Science")
   - For general topics without natural metadata: Leave empty or omit

## Common Spectrum Types

- **Degree/Intensity**: How much of a quality (formal↔informal, concrete↔abstract)
- **Moral/Ethical**: How justifiable, fair, democratic, ethical
- **Temporal**: How recent, how long-lasting, how fast-changing
- **Certainty**: How well-established, how disputed, how speculative
- **Complexity**: How simple↔complex, how many factors involved
- **Scope**: How narrow↔broad, local↔global, individual↔systemic

Generate 4-6 items that span the spectrum meaningfully. Ensure the activity teaches discrimination—students should finish understanding WHY things fall where they do, not just WHERE.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: 0.8,
    },
  });

  if (!response.text) throw new Error("No content generated");
  const data = JSON.parse(response.text);

  return {
    type: 'scale-spectrum',
    instanceId: item.instanceId,
    data
  };
};

/**
 * Generate Annotated Example content
 */
const generateAnnotatedExampleContent = async (item: any, topic: string, gradeContext: string): Promise<{ type: string; instanceId: string; data: AnnotatedExampleData }> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Descriptive title of the problem type" },
      subject: { type: Type.STRING, description: "Subject area" },
      problem: {
        type: Type.OBJECT,
        properties: {
          statement: { type: Type.STRING, description: "The problem prompt or question" },
          equations: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Any given equations or expressions"
          },
          context: { type: Type.STRING, description: "Optional additional context or given information" }
        },
        required: ["statement"]
      },
      layers: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, description: "Layer ID (steps, strategy, misconceptions, connections)" },
            label: { type: Type.STRING, description: "Display label" },
            color: { type: Type.STRING, description: "Hex color code" },
            icon: { type: Type.STRING, description: "Emoji icon" }
          },
          required: ["id", "label", "color", "icon"]
        },
        description: "Must include these 4 layers: steps, strategy, misconceptions, connections"
      },
      steps: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.NUMBER, description: "Step number (sequential from 1)" },
            title: { type: Type.STRING, description: "Brief title for this step" },
            work: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING, description: "Mathematical expression or work shown" },
                  annotation: { type: Type.STRING, description: "Optional inline note like '× 3'" }
                },
                required: ["text"]
              },
              description: "Lines of mathematical work shown in this step"
            },
            result: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING, description: "Result or simplified form after this step" }
                },
                required: ["text"]
              },
              description: "Result lines after this step (optional)"
            },
            annotations: {
              type: Type.OBJECT,
              properties: {
                steps: { type: Type.STRING, description: "What we're doing procedurally in this step" },
                strategy: { type: Type.STRING, description: "WHY we're making this choice, metacognitive reasoning" },
                misconceptions: { type: Type.STRING, description: "Common errors students make here" },
                connections: { type: Type.STRING, description: "How this connects to underlying concepts" }
              },
              required: ["steps", "strategy", "misconceptions", "connections"]
            }
          },
          required: ["id", "title", "work", "annotations"]
        },
        description: "4-8 steps that solve the problem completely"
      }
    },
    required: ["title", "subject", "problem", "layers", "steps"]
  };

  const prompt = `You are generating a Worked Example with Annotation Layers. The student will study a fully solved problem while toggling different layers that reveal procedural steps, strategic thinking, common errors, and conceptual connections.

CONTEXT:
- Topic: ${topic}
- Target Audience: ${gradeContext}
- Intent: ${item.intent}

## Output Format
Return ONLY valid JSON matching the schema provided.

## Layer Design Principles

### Steps Layer (Procedural)
- Describe WHAT is happening mechanically
- Use clear, direct language: "Multiply both sides by 3" not "We should multiply..."
- Focus on the action, not the reasoning
- Should be sufficient for a student to replicate the procedure

### Strategy Layer (Metacognitive)
- Explain WHY this approach was chosen over alternatives
- Make decision points explicit: "I chose elimination over substitution because..."
- Reveal expert thinking patterns: "I notice that... so I'll..."
- Discuss efficiency and elegance when relevant
- Use first person to model internal monologue

### Misconceptions Layer (Error Prevention)
- Flag the SPECIFIC error students commonly make at this step
- Be concrete: "A common error is writing 12x - 3y = 5 instead of 15"
- Explain why the error is tempting
- Don't just say "be careful"—say what to be careful about

### Connections Layer (Conceptual)
- Link to underlying mathematical/scientific principles
- Connect to previously learned concepts
- Provide geometric, visual, or real-world interpretations
- Show how this technique generalizes

## Step Design Principles

1. **Granularity**: Each step should represent ONE logical move. If you're tempted to write "and then" in a step description, split it into two steps.

2. **Work array**: Show the actual mathematical expressions, line by line. Include intermediate steps—don't skip algebra.

3. **Result array**: Show what we have after this step is complete. This becomes the starting point for the next step.

4. **Inline annotations**: Use sparingly for operation indicators (× 3, + equation 1, etc.)

5. **Verification step**: Always include a final step that verifies the answer by substitution or checking. This models good mathematical practice.

## Annotation Quality Checklist

For each step, verify:
- Steps layer tells WHAT without WHY
- Strategy layer reveals expert decision-making
- Misconceptions layer flags a SPECIFIC, COMMON error (not generic warnings)
- Connections layer links to at least one broader concept
- No layer repeats information from another layer

## Required Layers (MUST include all 4)
[
  { "id": "steps", "label": "Steps", "color": "#3b82f6", "icon": "📝" },
  { "id": "strategy", "label": "Strategy", "color": "#8b5cf6", "icon": "🧠" },
  { "id": "misconceptions", "label": "Watch Out", "color": "#ef4444", "icon": "⚠️" },
  { "id": "connections", "label": "Connections", "color": "#22c55e", "icon": "🔗" }
]

Generate a complete worked example with 4-8 steps. Ensure annotations are substantive—each should teach something a student wouldn't get from just watching the procedure.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: 0.7,
    },
  });

  if (!response.text) throw new Error("No content generated");
  const data = JSON.parse(response.text) as AnnotatedExampleData;

  return {
    type: 'annotated-example',
    instanceId: item.instanceId,
    data
  };
};

/**
 * Generate Image Panel content
 */
const generateImagePanelContent = async (item: any, topic: string, gradeContext: string): Promise<{ type: string; instanceId: string; data: ImagePanelData }> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Title for the image panel" },
      description: { type: Type.STRING, description: "Brief description of what the image shows" },
      imagePrompt: {
        type: Type.STRING,
        description: "Detailed prompt for generating the image - be specific about style, content, perspective, and educational purpose"
      },
      category: {
        type: Type.STRING,
        enum: ["geography", "history", "science", "literature", "art", "general"],
        description: "Category that best fits the image content"
      }
    },
    required: ["title", "imagePrompt", "category"]
  };

  const response = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: `Create image panel metadata for: "${topic}"

TARGET AUDIENCE: ${gradeContext}
INTENT: ${item.intent}

Generate metadata for an AI image generation request. The imagePrompt should be:
- Detailed and specific about what to visualize
- Educational and age-appropriate
- Clear about style (map, diagram, illustration, photograph-style, etc.)
- Include relevant context (historical period, geographic region, scientific accuracy)

Choose the most appropriate category based on the content.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: 0.7,
    },
  });

  if (!response.text) throw new Error("No content generated");
  const metadata = JSON.parse(response.text);

  // Generate the actual image using the existing generateConceptImage function
  let imageUrl: string | null = null;
  try {
    imageUrl = await generateConceptImage(metadata.imagePrompt);
  } catch (error) {
    console.error("Failed to generate image:", error);
    // Continue without image - the component will handle the null case
  }

  return {
    type: 'image-panel',
    instanceId: item.instanceId,
    data: {
      title: metadata.title,
      description: metadata.description,
      imageUrl,
      imagePrompt: metadata.imagePrompt,
      category: metadata.category,
      attribution: 'Generated with Gemini AI'
    }
  };
};

/**
 * Generate Take Home Activity content
 */
const generateTakeHomeActivityContent = async (item: any, topic: string, gradeContext: string): Promise<{ type: string; instanceId: string; data: any }> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING, description: "Unique identifier for this activity" },
      title: { type: Type.STRING, description: "Engaging, action-oriented title" },
      subject: {
        type: Type.STRING,
        enum: ["Science", "Math", "Language Arts", "Social Studies", "Art"],
        description: "Subject area"
      },
      topic: { type: Type.STRING, description: "Specific curriculum topic this addresses" },
      gradeRange: { type: Type.STRING, description: "Grade range like 'K-2', '3-5', '6-8'" },
      estimatedTime: { type: Type.STRING, description: "Time estimate like '30-45 minutes'" },
      overview: { type: Type.STRING, description: "2-3 sentence description that hooks student interest and previews the learning" },
      learningObjectives: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "3 specific, measurable learning outcomes"
      },
      materials: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            item: { type: Type.STRING, description: "Material name" },
            quantity: { type: Type.STRING, description: "Amount needed (household-friendly units)" },
            essential: { type: Type.BOOLEAN, description: "Is this truly necessary?" },
            substitutes: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Alternative materials that can be used instead"
            },
            examples: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Specific examples for open-ended items"
            }
          },
          required: ["item", "quantity", "essential"]
        },
        description: "List of 5-10 materials needed"
      },
      safetyNotes: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Safety considerations if applicable"
      },
      steps: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            stepNumber: { type: Type.NUMBER, description: "Step number (1, 2, 3...)" },
            title: { type: Type.STRING, description: "Brief step title" },
            instruction: { type: Type.STRING, description: "Clear, detailed instruction at appropriate reading level" },
            tip: { type: Type.STRING, description: "Optional helpful hint for tricky parts" },
            scienceNote: { type: Type.STRING, description: "Optional explanation of the concept being demonstrated" },
            checkpoint: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING, description: "Question to verify understanding or completion" },
                type: {
                  type: Type.STRING,
                  enum: ["confirm", "count", "reflection"],
                  description: "Type of checkpoint"
                }
              },
              required: ["question", "type"]
            }
          },
          required: ["stepNumber", "title", "instruction"]
        },
        description: "5-8 steps for younger grades, up to 10-12 for older grades"
      },
      reflectionPrompts: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING, description: "Open-ended question connecting to learning objectives" },
            hint: { type: Type.STRING, description: "Scaffolding hint to guide thinking" },
            connectionTo: { type: Type.STRING, description: "Reference to which learning objective this addresses" }
          },
          required: ["question"]
        },
        description: "2-4 reflection prompts moving from observation to abstract principle to real-world connection"
      },
      extensions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Extension activity name" },
            description: { type: Type.STRING, description: "Brief description of the challenge" },
            difficulty: {
              type: Type.STRING,
              enum: ["intermediate", "advanced"],
              description: "Difficulty level"
            }
          },
          required: ["title", "description", "difficulty"]
        },
        description: "1-2 optional challenges for deeper exploration"
      },
      documentationPrompt: {
        type: Type.OBJECT,
        properties: {
          instruction: { type: Type.STRING, description: "What to photograph or record" },
          suggestedCaption: { type: Type.STRING, description: "Template for sharing with fill-in-the-blanks" }
        },
        required: ["instruction", "suggestedCaption"]
      }
    },
    required: ["id", "title", "subject", "topic", "gradeRange", "estimatedTime", "overview", "learningObjectives", "materials", "steps", "reflectionPrompts"]
  };

  const prompt = `You are an expert educational content designer specializing in hands-on, inquiry-based learning activities for K-8 homeschool students. Generate a Take Home Activity - a screen-free, hands-on learning experience using common household materials.

CONTEXT:
- Topic: ${topic}
- Target Audience: ${gradeContext}
- Intent: ${item.intent}

## Design Principles

1. **Safety First**: Activities must be age-appropriate with clear safety guidance. Assume varying levels of adult supervision.

2. **Accessibility**: Prioritize common household materials. ALWAYS provide substitutes for harder-to-find items.

3. **Scientific Rigor**: Even simple activities should teach real concepts accurately. Include the "why" behind each step.

4. **Scaffolded Discovery**: Guide students toward insights rather than just telling them. Use checkpoints and reflection prompts.

5. **Multiple Entry Points**: Activities should engage different learning styles - kinesthetic doing, visual observation, verbal reflection.

6. **Documentation Built-In**: Encourage students to capture and reflect on their work.

## Field Guidelines

### Materials
- List 5-10 materials maximum
- Mark truly necessary items as essential: true
- ALWAYS provide substitutes for specialty items (substitutes array)
- Use examples array for open-ended categories (e.g., "small objects to test")
- Quantities should be household-friendly (tablespoons, cups, "a few")

### Steps
- Aim for 5-8 steps for younger grades (K-2, 3-5), up to 10-12 for older (6-8)
- Each step should be ONE focused action
- Include tip for tricky parts or common mistakes
- Include scienceNote when explaining WHY something happens
- Every 2-3 steps should have a checkpoint to maintain engagement
- Checkpoint types:
  - confirm: Yes/no verification ("Can you see two layers?")
  - count: Numerical observation ("How many different sounds can you make?")
  - reflection: Open observation ("What do you notice about...?")

### Reflection Prompts
- 2-4 prompts that connect hands-on experience to conceptual understanding
- Move from concrete observation → abstract principle → real-world connection
- Hints should scaffold without giving away the answer

### Extensions
- 1-2 optional challenges for students who want more
- Should deepen understanding, not just add busywork
- Mark difficulty clearly so students self-select appropriately

### Safety Notes
- Include for ANY activity involving:
  - Heat, sharp objects, or breakable items
  - Substances that shouldn't be ingested
  - Activities requiring adult supervision
  - Potential mess or stain risks
- For young grades (K-2), always include "Adult helper recommended"

## Grade-Level Calibration

### K-2 Activities
- 15-25 minutes
- 5-6 steps maximum
- Simple materials (paper, crayons, water, food items)
- Large motor skills preferred
- Picture-friendly checkpoints
- Adult helper assumed

### 3-5 Activities
- 25-45 minutes
- 6-8 steps
- Can include measuring, simple tools
- Mix of observation and recording
- Introduction to scientific vocabulary
- Adult supervision for specific steps only

### 6-8 Activities
- 30-60 minutes
- 8-12 steps
- Can include calculations, precise measurements
- Emphasis on hypothesis → experiment → conclusion
- More sophisticated reflection prompts
- Independent work with safety awareness

Generate a complete, engaging take-home activity following these guidelines.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: 0.8,
    },
  });

  if (!response.text) throw new Error("No content generated");
  const activityData = JSON.parse(response.text);

  return {
    type: 'take-home-activity',
    instanceId: item.instanceId,
    data: activityData
  };
};

/**
 * Generate Interactive Passage content
 */
const generateInteractivePassageContent = async (item: any, topic: string, gradeContext: string): Promise<{ type: string; instanceId: string; data: InteractivePassageData }> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Engaging title for the reading passage" },
      author: { type: Type.STRING, description: "Author name (or 'Lumina AI')" },
      readingLevel: { type: Type.STRING, description: "Lexile or grade level estimate" },
      sections: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            segments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ['text', 'vocabulary'] },
                  vocabData: {
                    type: Type.OBJECT,
                    properties: {
                      word: { type: Type.STRING },
                      definition: { type: Type.STRING },
                      partOfSpeech: { type: Type.STRING }
                    },
                    required: ["word", "definition", "partOfSpeech"]
                  }
                },
                required: ["text", "type"]
              }
            },
            inlineQuestion: {
              type: Type.OBJECT,
              properties: {
                prompt: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctIndex: { type: Type.INTEGER }
              },
              required: ["prompt", "options", "correctIndex"]
            }
          },
          required: ["id", "segments"]
        }
      },
      highlightTask: {
        type: Type.OBJECT,
        properties: {
          instruction: { type: Type.STRING, description: "Task instruction (e.g., 'Find the sentence that explains why...')" },
          targets: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                textSegment: { type: Type.STRING, description: "Exact text to match for highlighting" },
                correct: { type: Type.BOOLEAN },
                feedback: { type: Type.STRING }
              },
              required: ["id", "textSegment", "correct", "feedback"]
            }
          }
        },
        required: ["instruction", "targets"]
      }
    },
    required: ["title", "sections"]
  };

  const prompt = `Create an interactive reading passage for: "${topic}"

TARGET AUDIENCE: ${gradeContext}
INTENT: ${item.intent}

Generate a reading passage broken into sections.
- Identify 3-5 challenging vocabulary words and mark them as 'vocabulary' segments with definitions.
- Include 1-2 inline comprehension checks (multiple choice).
- Create a "Highlight Task" where students must find evidence in the text to answer a specific question.
  - Provide at least 1 correct target (the right evidence).
  - Provide 1-2 plausible but incorrect targets (distractors) with specific feedback explaining why they are wrong.

Structure the text as a sequence of segments. Most segments will be 'text', but vocabulary words should be their own 'vocabulary' segments.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: 0.7,
    },
  });

  if (!response.text) throw new Error("No content generated");
  const data = JSON.parse(response.text) as InteractivePassageData;

  return {
    type: 'interactive-passage',
    instanceId: item.instanceId,
    data
  };
};

/**
 * Generate Word Builder content
 */
const generateWordBuilderContent = async (item: any, topic: string, gradeContext: string): Promise<{ type: string; instanceId: string; data: any }> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Engaging title for the word-building exercise (e.g., 'Constructing Scientific Terms')" },
      availableParts: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, description: "Unique identifier like 'pre-bio', 'root-log', 'suf-y'" },
            text: { type: Type.STRING, description: "The actual word part (e.g., 'bio', 'log', 'y')" },
            type: { type: Type.STRING, enum: ['prefix', 'root', 'suffix'], description: "Type of word part" },
            meaning: { type: Type.STRING, description: "What this part means (e.g., 'Life' for 'bio')" }
          },
          required: ["id", "text", "type", "meaning"]
        },
        description: "Pool of 8-12 word parts students can use. Include variety of prefixes, roots, and suffixes."
      },
      targets: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING, description: "The complete word to build (e.g., 'biology')" },
            parts: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Array of part IDs in order [prefix, root, suffix]. Some positions can be omitted if word doesn't have that part."
            },
            definition: { type: Type.STRING, description: "Clear definition of the word" },
            sentenceContext: { type: Type.STRING, description: "Example sentence using the word in context" }
          },
          required: ["word", "parts", "definition", "sentenceContext"]
        },
        description: "2-4 target words to build. Ensure parts needed are in availableParts array."
      }
    },
    required: ["title", "availableParts", "targets"]
  };

  const prompt = `Create a word-building morphology exercise for: "${topic}"

TARGET AUDIENCE: ${gradeContext}
INTENT: ${item.intent}

## Design Principles

1. **Educational Value**: Choose words that genuinely illustrate morphological patterns
   - Words should be relevant to the topic/subject area
   - Parts should have clear, teachable meanings
   - Focus on common, useful word parts students will encounter again

2. **Available Parts Pool (8-12 parts)**:
   - Include 2-4 prefixes (e.g., bio-, geo-, tele-, micro-, pre-, un-)
   - Include 3-5 roots (e.g., -log-, -graph-, -meter-, -scope-)
   - Include 2-4 suffixes (e.g., -y, -ic, -er, -tion, -ous)
   - Ensure all parts needed for target words are in the pool
   - Include some extra parts that aren't used (adds challenge)

3. **Target Words (2-4 words)**:
   - Start with simpler 2-part words, progress to 3-part words
   - Each word should clearly demonstrate its meaning through its parts
   - Provide clear, age-appropriate definitions
   - Include authentic sentence contexts showing usage

4. **Part ID Format**:
   - Use descriptive IDs: "pre-bio", "root-log", "suf-y"
   - This helps with debugging and understanding

5. **Meaning Quality**:
   - Keep meanings concise (1-3 words)
   - Use accessible language appropriate for grade level
   - Examples: "Life", "Study", "State of", "Against", "Write"

## Subject-Specific Guidance

**Science/Biology**: Use Greek/Latin roots common in scientific vocabulary
- bio (life), geo (earth), hydro (water), thermo (heat), photo (light)
- -logy (study), -meter (measure), -scope (view), -graph (write/record)

**Medical/Health**: Focus on body parts and processes
- cardio (heart), neuro (nerve), derm (skin), gastro (stomach)
- -ology (study), -itis (inflammation), -pathy (disease)

**General Academic**: Mix of common prefixes and roots
- pre- (before), re- (again), un- (not), dis- (opposite)
- -tion (action), -ment (result), -able (capable of)

## Example Structure

{
  "title": "Building Scientific Vocabulary",
  "availableParts": [
    {"id": "pre-bio", "text": "bio", "type": "prefix", "meaning": "Life"},
    {"id": "pre-geo", "text": "geo", "type": "prefix", "meaning": "Earth"},
    {"id": "root-log", "text": "log", "type": "root", "meaning": "Study"},
    {"id": "root-graph", "text": "graph", "type": "root", "meaning": "Write"},
    {"id": "suf-y", "text": "y", "type": "suffix", "meaning": "State of"}
  ],
  "targets": [
    {
      "word": "biology",
      "parts": ["pre-bio", "root-log", "suf-y"],
      "definition": "The study of life and living organisms",
      "sentenceContext": "In biology class, we learned about photosynthesis."
    }
  ]
}

Generate an engaging word-building exercise that helps students understand how words are constructed from meaningful parts.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: 0.7,
    },
  });

  if (!response.text) throw new Error("No content generated");
  const data = JSON.parse(response.text);

  return {
    type: 'word-builder',
    instanceId: item.instanceId,
    data
  };
};

/**
 * Generate Molecule Viewer content
 * Uses the standalone chemistry service for 3D molecular structure generation
 */
const generateMoleculeViewerContent = async (item: any, topic: string, gradeContext: string): Promise<{ type: string; instanceId: string; data: any }> => {
  // Import the chemistry service dynamically to avoid circular dependencies
  const { generateMoleculeData } = await import('./chemistry/gemini-chemistry');

  // Extract molecule prompt from intent or title
  const moleculePrompt = item.intent || item.title || topic;

  // Extract grade level from context if available
  const gradeLevel = gradeContext.toLowerCase().includes('elementary') ? 'elementary' :
                     gradeContext.toLowerCase().includes('middle') ? 'middle-school' :
                     gradeContext.toLowerCase().includes('high') ? 'high-school' : undefined;

  // Generate the 3D molecular structure using our dedicated chemistry service
  const moleculeData = await generateMoleculeData(moleculePrompt, gradeLevel);

  return {
    type: 'molecule-viewer',
    instanceId: item.instanceId,
    data: moleculeData
  };
};

/**
 * Generate Periodic Table content
 * The periodic table is self-contained with all element data, so we just need to pass configuration
 */
const generatePeriodicTableContent = async (item: any, topic: string, gradeContext: string): Promise<{ type: string; instanceId: string; data: any }> => {
  // Parse any element highlighting from the intent or config
  const highlightElements = item.config?.highlightElements || [];
  const focusCategory = item.config?.focusCategory;

  // Build the periodic table data structure
  const periodicTableData = {
    title: item.title || 'Periodic Table of Elements',
    description: item.intent || 'Explore the elements and their properties',
    highlightElements,
    focusCategory
  };

  return {
    type: 'periodic-table',
    instanceId: item.instanceId,
    data: periodicTableData
  };
};

/**
 * Generate Media Player content
 * Uses dedicated media player service to generate audio-visual lesson content
 */
const generateMediaPlayerContent = async (item: any, topic: string, gradeContext: string): Promise<{ type: string; instanceId: string; data: any }> => {
  // Extract configuration from manifest item
  const lessonTopic = item.intent || item.title || topic;
  const segmentCount = item.config?.segmentCount || 4;
  const imageResolution = item.config?.imageResolution || '1K';

  // Extract grade level from context
  const gradeLevel = gradeContext.toLowerCase().includes('toddler') ? 'toddler' :
                     gradeContext.toLowerCase().includes('preschool') ? 'preschool' :
                     gradeContext.toLowerCase().includes('kindergarten') ? 'kindergarten' :
                     gradeContext.toLowerCase().includes('elementary') ? 'elementary' :
                     gradeContext.toLowerCase().includes('middle') ? 'middle-school' :
                     gradeContext.toLowerCase().includes('high') ? 'high-school' :
                     gradeContext.toLowerCase().includes('undergraduate') ? 'undergraduate' :
                     gradeContext.toLowerCase().includes('graduate') ? 'graduate' :
                     gradeContext.toLowerCase().includes('phd') ? 'phd' : 'elementary';

  // Generate the media player content using dedicated service
  const mediaPlayerData = await generateMediaPlayer(lessonTopic, gradeLevel, segmentCount, imageResolution);

  return {
    type: 'media-player',
    instanceId: item.instanceId,
    data: mediaPlayerData
  };
};

/**
 * Generate Nested Hierarchy content
 */
const generateNestedHierarchyContent = async (item: any, topic: string, gradeContext: string): Promise<{ type: string; instanceId: string; data: NestedHierarchyData }> => {
  const hierarchyNodeSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING, description: "Unique identifier for this node" },
      label: { type: Type.STRING, description: "Display name for this node" },
      type: { type: Type.STRING, description: "Category/type of this node (e.g., 'System', 'Subsystem', 'Component')" },
      icon: {
        type: Type.STRING,
        enum: ["activity", "brain", "zap", "git-commit", "layers", "home"],
        description: "Icon identifier for this node"
      },
      description: { type: Type.STRING, description: "Detailed explanation of this node" },
      children: {
        type: Type.ARRAY,
        items: { type: Type.STRING, description: "Recursive reference - will be replaced with actual node structure" },
        description: "Child nodes in the hierarchy"
      }
    },
    required: ["id", "label", "icon", "description"]
  };

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Title of the hierarchical system" },
      description: { type: Type.STRING, description: "Brief overview of the system" },
      root_node: {
        type: Type.OBJECT,
        description: "The root node of the hierarchy - must be a complete recursive tree structure",
        properties: {
          id: { type: Type.STRING },
          label: { type: Type.STRING },
          type: { type: Type.STRING },
          icon: {
            type: Type.STRING,
            enum: ["activity", "brain", "zap", "git-commit", "layers", "home"]
          },
          description: { type: Type.STRING },
          children: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                label: { type: Type.STRING },
                type: { type: Type.STRING },
                icon: {
                  type: Type.STRING,
                  enum: ["activity", "brain", "zap", "git-commit", "layers", "home"]
                },
                description: { type: Type.STRING },
                children: {
                  type: Type.ARRAY,
                  items: { type: Type.OBJECT },
                  description: "Recursive children"
                }
              },
              required: ["id", "label", "icon", "description"]
            },
            description: "Array of child nodes - each with same recursive structure"
          }
        },
        required: ["id", "label", "icon", "description"]
      },
      defaultExpanded: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Array of node IDs that should be expanded by default"
      }
    },
    required: ["title", "root_node"]
  };

  const prompt = `You are generating a Nested Hierarchy visualization. The student will explore a hierarchical system by clicking through nodes in a tree structure, seeing detailed information about each component.

CONTEXT:
- Topic: ${topic}
- Target Audience: ${gradeContext}
- Intent: ${item.intent}

## Design Principles

1. **Clear Hierarchy Levels**: Organize the system into logical levels (e.g., System → Subsystem → Component → Subcomponent)

2. **Balanced Tree**: Aim for 2-4 children per node where possible. Avoid single-child nodes unless structurally necessary.

3. **Meaningful Descriptions**: Each node's description should:
   - Explain what this component does/is
   - Clarify its role in the larger system
   - Be 1-3 sentences, clear and informative

4. **Type Labels**: Use consistent type labels across the same level (e.g., all level-2 nodes might be "Subsystem", level-3 "Component")

5. **Icon Selection**: Choose icons that visually represent the node's function:
   - "activity": General activity, processes, actions
   - "brain": Cognitive functions, control centers, decision-making
   - "zap": Energy, electrical, fast processes
   - "git-commit": Connections, pathways, transmission
   - "layers": Structural layers, organization
   - "home": Root, foundation, central hub

6. **Depth**: Aim for 3-4 levels deep. Too shallow (1-2 levels) lacks detail; too deep (5+ levels) overwhelms.

7. **Default Expanded**: Include the root node ID and 1-2 key subsystem IDs to give students a good starting view.

## Example Structure

For "The Human Nervous System":
- Root: "Human Nervous System"
  - Level 1: "Central Nervous System", "Peripheral Nervous System"
    - Level 2: "Brain", "Spinal Cord" (under CNS)
      - Level 3: "Cerebrum", "Cerebellum", "Brain Stem" (under Brain)
    - Level 2: "Somatic", "Autonomic" (under PNS)
      - Level 3: "Sympathetic", "Parasympathetic" (under Autonomic)

## Output Requirements

Generate a complete hierarchical tree structure with:
- 1 root node
- 2-5 main branches (children of root)
- Each branch developed to 2-3 additional levels
- Total of 8-20 nodes across the entire tree
- Descriptive content for each node
- Logical type progressions (System → Subsystem → Component)

Return ONLY valid JSON matching the schema.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: 0.7,
    },
  });

  if (!response.text) throw new Error("No content generated");
  const data = JSON.parse(response.text) as NestedHierarchyData;

  return {
    type: 'nested-hierarchy',
    instanceId: item.instanceId,
    data
  };
};



// ============================================================================
// MAIN ORCHESTRATOR: MANIFEST → COMPLETE EXHIBIT
// ============================================================================

/**
 * 🎯 MAIN ORCHESTRATOR FUNCTION - Manifest-First Architecture
 *
 * This is the primary entry point for the new manifest-first exhibit generation flow.
 * It combines all three phases into a single, streamlined process.
 *
 * WORKFLOW:
 * 1. 📋 Phase 1: Generate Manifest
 *    - Uses Gemini to create a blueprint (ExhibitManifest)
 *    - Selects optimal components from UNIVERSAL_CATALOG
 *    - Defines layout, intent, and configuration for each component
 *
 * 2. 🎨 Phase 2: Generate Content in Parallel
 *    - Calls generateComponentContent() for each manifest item
 *    - All content generation happens concurrently (Promise.all)
 *    - Gracefully handles failures (continues if individual components fail)
 *
 * 3. 🏗️ Phase 3: Assemble Complete Exhibit
 *    - Maps generated components to ExhibitData structure
 *    - Organizes into: intro, cards, featureExhibit, comparison, tables, knowledgeCheck, specializedExhibits
 *    - Returns fully-built exhibit ready for rendering
 *
 * USAGE:
 * ```typescript
 * const exhibit = await buildCompleteExhibitFromTopic('Photosynthesis', 'middle-school');
 * setExhibitData(exhibit);
 * ```
 *
 * @param topic - The educational topic to generate content for
 * @param gradeLevel - Target audience grade level (default: 'elementary')
 * @returns Complete ExhibitData structure ready for rendering
 */
export const buildCompleteExhibitFromTopic = async (
  topic: string,
  gradeLevel: string = 'elementary'
): Promise<any> => {
  console.log('🎯 Starting complete exhibit build for:', topic);

  // PHASE 1: Generate Manifest
  console.log('📋 Phase 1: Generating manifest...');
  const manifest = await generateExhibitManifest(topic, gradeLevel); 
  console.log(`✅ Manifest generated with ${manifest.layout.length} components`);

  // PHASE 2: Generate Content for All Components in Parallel
  console.log('🎨 Phase 2: Generating content for all components...');
  const contentPromises = manifest.layout.map(async (item, index) => {
    try {
      console.log(`  ⚙️ [${index + 1}/${manifest.layout.length}] Generating: ${item.componentId} (${item.instanceId})`);
      const content = await generateComponentContent(item, manifest.topic, manifest.gradeLevel);
      console.log(`  ✅ [${index + 1}/${manifest.layout.length}] Completed: ${item.componentId}`);
      return content;
    } catch (error) {
      console.error(`  ❌ Failed to generate ${item.componentId}:`, error);
      return null; // Return null for failed components, don't block others
    }
  });

  const components = await Promise.all(contentPromises);
  const validComponents = components.filter(c => c !== null);
  console.log(`✅ Generated ${validComponents.length}/${manifest.layout.length} components successfully`);

  // PHASE 3: Assemble into Complete Exhibit Structure
  console.log('🏗️ Phase 3: Assembling exhibit...');

  const exhibit: any = {
    topic: manifest.topic,
    themeColor: manifest.themeColor,
    intro: null,
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
    relatedTopics: [] // Could be added as another component type in future
  };

  // Map components to exhibit structure
  for (const component of validComponents) {
    if (!component) continue;

    switch (component.type) {
      case 'curator-brief':
        // Check if it's the new comprehensive format or legacy format
        if (component.data && 'mindset' in component.data) {
          // New IntroBriefingData format
          exhibit.introBriefing = component.data;
          // Also create legacy intro for backward compatibility
          exhibit.intro = {
            hook: component.data.hook.content,
            objectives: component.data.objectives.map((obj: any) => obj.text)
          };
        } else {
          // Legacy IntroData format
          exhibit.intro = component.data;
        }
        break;

      case 'concept-card-grid':
        exhibit.cards = component.data; // Array of cards
        break;

      case 'feature-exhibit':
        exhibit.featureExhibit = component.data;
        break;

      case 'comparison-panel':
        exhibit.comparison = component.data;
        break;

      case 'generative-table':
        exhibit.tables.push(component.data);
        break;

      case 'graph-board':
        exhibit.graphBoards.push(component.data);
        break;

      case 'scale-spectrum':
        exhibit.scaleSpectrums.push(component.data);
        break;

      case 'annotated-example':
        exhibit.annotatedExamples.push(component.data);
        break;

      case 'nested-hierarchy':
        exhibit.nestedHierarchies.push(component.data);
        break;

      case 'image-panel':
        exhibit.imagePanels.push(component.data);
        break;

      case 'take-home-activity':
        exhibit.takeHomeActivities.push(component.data);
        break;

      case 'interactive-passage':
        if (!exhibit.interactivePassages) exhibit.interactivePassages = [];
        exhibit.interactivePassages.push(component.data);
        break;

      case 'word-builder':
        if (!exhibit.wordBuilders) exhibit.wordBuilders = [];
        exhibit.wordBuilders.push(component.data);
        break;

      case 'molecule-viewer':
        if (!exhibit.moleculeViewers) exhibit.moleculeViewers = [];
        exhibit.moleculeViewers.push(component.data);
        break;

      case 'periodic-table':
        if (!exhibit.periodicTables) exhibit.periodicTables = [];
        exhibit.periodicTables.push(component.data);
        break;

      case 'media-player':
        if (!exhibit.mediaPlayers) exhibit.mediaPlayers = [];
        exhibit.mediaPlayers.push(component.data);
        break;

      case 'knowledge-check':
        exhibit.knowledgeCheck = component.data;
        break;

      case 'formula-card':
        exhibit.specializedExhibits.push({ ...component.data, type: 'equation' });
        break;

      case 'sentence-analyzer':
        exhibit.specializedExhibits.push(component.data);
        break;

      case 'math-visual':
        exhibit.specializedExhibits.push(component.data);
        break;

      case 'custom-visual':
        exhibit.specializedExhibits.push(component.data);
        break;

      default:
        console.warn('Unknown component type:', component.type);
    }
  }

  console.log('🎉 Exhibit assembly complete!');
  return exhibit;
};

// Re-export generateIntroBriefing from dedicated curator-brief service
export { generateIntroBriefing };

// Re-export hint generator from problems service
export { generateProblemHint } from './problems/hint-generator';

