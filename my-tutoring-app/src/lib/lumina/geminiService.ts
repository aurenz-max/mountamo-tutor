
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ExhibitData, ItemDetailData } from "@/types/lumina";

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';

const ai = new GoogleGenAI({ apiKey: API_KEY });

// --- VISUALIZATION GUIDELINES ---

const visualGuide = `
MATH VISUALIZATION SELECTION GUIDE:
1. "bar-model":
   - Best for: Comparing ABSTRACT quantities/totals, part-whole relationships with large numbers, data visualization.
   - Avoid for: Counting discrete physical objects, problems where actual objects are more intuitive.
   - Example: "Team A scored 15 points vs Team B scored 12 points"

2. "number-line":
   - Best for: Ordering numbers, skip counting, number sequences, showing intervals or ranges.
   - Avoid for: Discrete comparisons without sequence, problems not involving order.
   - Example: "Finding numbers between 5 and 10, counting by 2s"

3. "base-ten-blocks":
   - Best for: Place value understanding, regrouping, representing multi-digit numbers visually.
   - Avoid for: Simple single-digit problems, non-base-10 concepts.
   - Example: "Showing 23 as 2 tens and 3 ones"

4. "fraction-circles":
   - Best for: Part-whole fractions, comparing fraction sizes, visual fraction equivalence.
   - Avoid for: Whole number problems, complex fraction operations beyond kindergarten/elementary level.
   - Example: "Showing 1/4 of a circle shaded"

5. "geometric-shape":
   - Best for: Shape identification, area/perimeter concepts, spatial reasoning.
   - Avoid for: Problems not involving shapes or spatial properties.
   - Example: "Identifying a rectangle with labeled dimensions"
`;

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
    modularExhibit: {
        description: "Optional specialized module. Choose the best format for the topic.",
        anyOf: [
            // Linguistics
            {
                type: Type.OBJECT,
                properties: {
                    type: { type: Type.STRING, enum: ["sentence"] },
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    parts: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                text: { type: Type.STRING },
                                role: { type: Type.STRING },
                                partOfSpeech: { type: Type.STRING },
                                definition: { type: Type.STRING }
                            },
                            required: ["text", "role", "partOfSpeech", "definition"]
                        }
                    }
                },
                required: ["type", "title", "description", "parts"]
            },
            // Math Visual
            {
                type: Type.OBJECT,
                properties: {
                    type: { type: Type.STRING, enum: ["math-visual"] },
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    visualType: {
                        type: Type.STRING,
                        enum: ["bar-model", "number-line", "base-ten-blocks", "fraction-circles", "geometric-shape"],
                        description: "The specific strategy selected for math visualization."
                    },
                    data: {
                        type: Type.OBJECT,
                        description: "Data container for math visuals. Fill the properties corresponding to the selected visualType.",
                        properties: {
                            values: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { label: { type: Type.STRING }, value: { type: Type.NUMBER }, color: { type: Type.STRING } }, required: ["label", "value"] } },
                            range: { type: Type.OBJECT, properties: { min: { type: Type.NUMBER }, max: { type: Type.NUMBER } }, required: ["min", "max"] },
                            highlights: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { value: { type: Type.NUMBER }, label: { type: Type.STRING } }, required: ["value", "label"] } },
                            numberValue: { type: Type.NUMBER },
                            fractions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { numerator: { type: Type.NUMBER }, denominator: { type: Type.NUMBER }, label: { type: Type.STRING } }, required: ["numerator", "denominator"] } },
                            shapeName: { type: Type.STRING },
                            attributes: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { label: { type: Type.STRING }, value: { type: Type.STRING } }, required: ["label", "value"] } }
                        }
                    }
                },
                required: ["type", "title", "description", "visualType", "data"]
            },
            // Custom SVG
            {
                type: Type.OBJECT,
                properties: {
                    type: { type: Type.STRING, enum: ["custom-svg"] },
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    svgCode: { type: Type.STRING, description: "Complete raw SVG element string including xmlns." }
                },
                required: ["type", "title", "description", "svgCode"]
            },
            // Custom Web
            {
                type: Type.OBJECT,
                properties: {
                    type: { type: Type.STRING, enum: ["custom-web"] },
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    library: { type: Type.STRING, enum: ["chart.js", "d3", "echarts", "roughjs", "mermaid", "tone.js"] },
                    html: { type: Type.STRING, description: "HTML container string. Ensure IDs are unique (e.g., prefix with exhibit)." },
                    script: { type: Type.STRING, description: "JavaScript code to render the visualization. Use the global library variable. Do not wrap in <script> tags." }
                },
                required: ["type", "title", "description", "library", "html", "script"]
            }
        ]
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

export const generateExhibitContent = async (topic: string): Promise<ExhibitData> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Create an interactive educational museum exhibit for the topic: "${topic}".

      INSTRUCTIONS:
      1. Analyze the topic to choose the best visualization module.

      2. IF LINGUISTICS/LITERATURE:
         - Use 'sentence' type and provide the 'parts' analysis.

      3. IF MATH/QUANTITATIVE/GEOMETRY (Standard):
         - Use 'math-visual' type.
         - Select the SINGLE BEST 'visualType' based on this guide:
           ${visualGuide}
         - GENERATE the 'data' object corresponding to the selected 'visualType'.

      4. IF COMPLEX DATA/DIAGRAMS/CHARTS/MUSIC (Advanced):
         - Use 'custom-svg' OR 'custom-web' types.
         - 'custom-svg': Generate raw SVG code for a custom diagram.
         - 'custom-web': Use an external library (Chart.js, D3, ECharts, RoughJS, Mermaid, Tone.js).
           - Provide valid HTML for the container (use unique IDs).
           - Provide valid JS in 'script' to render it.

      5. Generate the full JSON for the rest of the exhibit (cards, tables, etc.).

      OUTPUT FORMAT:
      - Return strictly JSON matching the schema.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: exhibitSchema,
        temperature: 0.7,
      },
    });

    if (!response.text) throw new Error("No text returned");

    let jsonStr = response.text.trim();
    const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) jsonStr = match[1].trim();

    // Cleanup potential trailing characters
    const firstOpen = jsonStr.indexOf('{');
    const lastClose = jsonStr.lastIndexOf('}');
    if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
        jsonStr = jsonStr.substring(firstOpen, lastClose + 1);
    }

    const exhibitData = JSON.parse(jsonStr) as ExhibitData;
    return exhibitData;
  } catch (error) {
    console.error("Text gen error:", error);
    throw error;
  }
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
