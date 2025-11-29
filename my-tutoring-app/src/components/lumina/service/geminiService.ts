
import { GoogleGenAI, Type, Schema } from "@google/genai";
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
  ImagePanelData
} from "../types";

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';

const ai = new GoogleGenAI({ apiKey: API_KEY });

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

const exhibitSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    topic: { type: Type.STRING },
    intro: {
      type: Type.OBJECT,
      description: "The curator's briefing for the exhibit.",
      properties: {
        hook: { type: Type.STRING, description: "A captivating 2-sentence narrative introduction." },
        objectives: { 
          type: Type.ARRAY, 
          items: { type: Type.STRING },
          description: "3 specific learning objectives."
        }
      },
      required: ["hook", "objectives"]
    },
    specializedExhibitIntents: {
        type: Type.ARRAY,
        description: "Array of specialized exhibit requests. Specify WHAT exhibits are needed, content will be generated separately.",
        items: {
          type: Type.OBJECT,
          properties: {
            id: {
              type: Type.STRING,
              description: "Unique identifier for this exhibit (e.g., 'sentence_1', 'custom_web_1')"
            },
            type: {
              type: Type.STRING,
              enum: ["sentence", "math-visual", "custom-svg", "custom-web"],
              description: "Type of specialized exhibit to generate"
            },
            title: {
              type: Type.STRING,
              description: "Title/heading for the exhibit"
            },
            purpose: {
              type: Type.STRING,
              description: "What this exhibit should demonstrate or teach (brief description)"
            },
            // Optional hints for specific types
            visualType: {
              type: Type.STRING,
              description: "For math-visual: specify bar-model, number-line, base-ten-blocks, fraction-circles, or geometric-shape"
            }
          },
          required: ["id", "type", "title", "purpose"]
        }
    },
    featureExhibit: {
      type: Type.OBJECT,
      description: "A deep-dive editorial section.",
      properties: {
        title: { type: Type.STRING },
        visualPrompt: { type: Type.STRING, description: "Prompt for detailed background image." },
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
        relatedTerms: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
        }
      },
      required: ["title", "visualPrompt", "sections", "relatedTerms"]
    },
    comparison: {
      type: Type.OBJECT,
      description: "Comparative analysis of two entities.",
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
    },
    cards: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          subheading: { type: Type.STRING },
          definition: { type: Type.STRING },
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
          originStory: { type: Type.STRING },
          curiosityNote: { type: Type.STRING },
          visualPrompt: { type: Type.STRING },
          themeColor: { type: Type.STRING }
        },
        required: ["title", "subheading", "definition", "conceptElements", "timelineContext", "originStory", "curiosityNote", "visualPrompt", "themeColor"]
      }
    },
    tables: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: ["table"] },
          title: { type: Type.STRING },
          headers: { type: Type.ARRAY, items: { type: Type.STRING } },
          rows: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.STRING } } }
        },
        required: ["type", "headers", "rows"]
      }
    },
    knowledgeCheck: {
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
        explanation: { type: Type.STRING }
      },
      required: ["question", "options", "correctAnswerId", "explanation"]
    },
    relatedTopics: {
      type: Type.ARRAY,
      items: { 
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          topic: { type: Type.STRING },
          category: { type: Type.STRING },
          teaser: { type: Type.STRING }
        },
        required: ["title", "topic", "category", "teaser"]
      }
    }
  },
  required: ["topic", "intro", "featureExhibit", "comparison", "cards", "tables", "knowledgeCheck", "relatedTopics"]
};

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
  contextTopic: string
): Promise<CustomWebData> => {
  const prompt = `You are an expert educational experience designer creating interactive HTML visualizations.

CONTEXT:
- Topic: ${contextTopic}
- Exhibit Title: ${intent.title}
- Purpose: ${intent.purpose}

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
      model: "gemini-2.0-flash-thinking-exp-01-21",
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
      model: "gemini-2.0-flash-thinking-exp-01-21",
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
    description: 'A bespoke HTML/JS simulation or SVG diagram. Use for complex systems (biology, physics, counting games) that standard math visuals cannot handle.'
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
            description: "Optional configuration hints",
            properties: {
              visualType: { type: Type.STRING },
              itemCount: { type: Type.NUMBER },
              difficulty: { type: Type.STRING }
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

  switch (item.componentId) {
    case 'curator-brief':
      return await generateCuratorBriefContent(item, topic, gradeLevelContext);

    case 'concept-card-grid':
      return await generateConceptCardsContent(item, topic, gradeLevelContext);

    case 'math-visual':
      return await generateMathVisualContent(item, topic, gradeLevelContext);

    case 'custom-visual':
      return await generateCustomVisualContent(item, topic, gradeLevelContext);

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

    default:
      console.warn(`Unknown component type: ${item.componentId}`);
      return null;
  }
};

/**
 * Generate Curator Brief content
 */
const generateCuratorBriefContent = async (item: any, topic: string, gradeContext: string) => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      hook: { type: Type.STRING, description: "A captivating 2-sentence narrative introduction." },
      objectives: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "3 specific learning objectives."
      }
    },
    required: ["hook", "objectives"]
  };

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Create curator brief for: "${topic}"

TARGET AUDIENCE: ${gradeContext}
INTENT: ${item.intent}

Generate an engaging introduction with hook and learning objectives.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: 0.7,
    },
  });

  if (!response.text) throw new Error("No content generated");
  const data = JSON.parse(response.text);
  return {
    type: 'curator-brief',
    instanceId: item.instanceId,
    data
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
const generateCustomVisualContent = async (item: any, topic: string, gradeContext: string) => {
  const intent: SpecializedExhibitIntent = {
    id: item.instanceId,
    type: 'custom-web',
    title: item.title,
    purpose: item.intent
  };

  const result = await generateCustomWebExhibit(intent, topic);
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
    model: "gemini-2.5-flash",
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

/**
 * Generate Exhibit Manifest (Phase 1 - The Blueprint)
 * This creates a plan for what components to use WITHOUT generating content
 */
export const generateExhibitManifest = async (
  topic: string,
  gradeLevel: string = 'elementary'
): Promise<ExhibitManifest> => {
  try {
    const gradeLevelContext = getGradeLevelContext(gradeLevel);
    const catalogContext = UNIVERSAL_CATALOG.map(c =>
      `- ${c.id}: ${c.description}${c.constraints ? ` [${c.constraints}]` : ''}`
    ).join('\n');

    const prompt = `You are the Lead Curator designing an educational exhibit.

ASSIGNMENT: Create a manifest (blueprint) for: "${topic}"
TARGET AUDIENCE: ${gradeLevelContext}

AVAILABLE COMPONENT TOOLS:
${catalogContext}

DESIGN RULES:
1. ✅ ALWAYS start with 'curator-brief' (this is REQUIRED)
2. ✅ ALWAYS end with 'knowledge-check' (this is RECOMMENDED)
3. 🎯 Choose the BEST 4-8 components total to explain the topic effectively
4. 📊 Prioritize components that match the subject matter:
   - Math/Counting for Kids → Use 'math-visual' (basic concepts) OR 'custom-visual' (interactive games/counting)
   - Math Problem-Solving (Elementary+) → Use 'annotated-example' to show worked solutions with multi-layer reasoning
   - History/Literature/Social Studies → Use 'comparison-panel', 'generative-table', or 'feature-exhibit'
   - Nuanced Judgment Topics → Use 'scale-spectrum' for ethical dilemmas, degrees of formality, historical significance, etc.
   - Science/Physics/Chemistry → Use 'formula-card' (equations), 'custom-visual' (simulations), 'feature-exhibit', 'annotated-example' (problem-solving)
   - Language Arts/Grammar → Use 'sentence-analyzer', 'concept-card-grid'
   - Data Analysis → Use 'graph-board' for polynomial fitting and data visualization
5. 🎨 Pick a themeColor that matches the subject (e.g., blue for science, green for nature, purple for humanities)

OUTPUT INSTRUCTIONS:
- For each component in the layout array:
  * componentId: Pick from the catalog
  * instanceId: Create a unique ID (e.g., 'brief-1', 'math-addition-1', 'comparison-democracy-monarchy')
  * title: The heading that will appear above this section
  * intent: DETAILED instructions for what content to generate (be specific!)
  * config: Optional hints (e.g., for math-visual, specify {"visualType": "number-line"})

EXAMPLE MANIFEST STRUCTURE:
{
  "topic": "Addition for Kindergarten",
  "gradeLevel": "kindergarten",
  "themeColor": "#3b82f6",
  "layout": [
    {
      "componentId": "curator-brief",
      "instanceId": "brief-1",
      "title": "Welcome to Addition!",
      "intent": "Create a warm introduction about adding numbers together. Include learning objectives: 1) Understand what addition means, 2) Count objects to add them, 3) Use the plus symbol"
    },
    {
      "componentId": "math-visual",
      "instanceId": "math-counting-1",
      "title": "Let's Count Together",
      "intent": "Show addition using a number line from 0-10. Highlight 2 + 3 = 5.",
      "config": { "visualType": "number-line" }
    },
    {
      "componentId": "knowledge-check",
      "instanceId": "quiz-1",
      "title": "Check Your Understanding",
      "intent": "Create a simple addition question: If you have 2 apples and get 1 more, how many do you have?"
    }
  ]
}

Now generate the manifest for: "${topic}" (${gradeLevel})
Return ONLY valid JSON matching the schema.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: manifestSchema,
        temperature: 0.8,
      },
    });

    if (!response.text) throw new Error("No manifest returned");

    let jsonStr = response.text.trim();
    const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) jsonStr = match[1].trim();

    // Cleanup potential trailing characters
    const firstOpen = jsonStr.indexOf('{');
    const lastClose = jsonStr.lastIndexOf('}');
    if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
      jsonStr = jsonStr.substring(firstOpen, lastClose + 1);
    }

    const manifest = JSON.parse(jsonStr) as ExhibitManifest;

    console.log('📋 Manifest Generated:', manifest);
    return manifest;
  } catch (error) {
    console.error("Manifest generation error:", error);
    throw error;
  }
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
        exhibit.intro = component.data;
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

