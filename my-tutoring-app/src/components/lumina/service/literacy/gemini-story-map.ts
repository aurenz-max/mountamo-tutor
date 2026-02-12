import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

// Import the data type from the component (single source of truth)
import { StoryMapData } from "../../primitives/visual-primitives/literacy/StoryMap";

/**
 * Schema definition for Story Map Data
 *
 * Generates grade-appropriate story passages with characters, settings,
 * events, and conflict for the Story Map interactive primitive.
 * Students read the passage, identify story elements, sequence events
 * on a story arc, and analyze conflict types.
 */
const storyMapSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description:
        "Title of the story map activity (e.g., 'Story Map: The Lost Kitten')",
    },
    gradeLevel: {
      type: Type.STRING,
      description:
        "Target grade level (e.g., 'K', '1', '2', '3', '4', '5', '6')",
    },
    structureType: {
      type: Type.STRING,
      enum: ["bme", "story-mountain", "plot-diagram", "heros-journey"],
      description:
        "Story structure type: 'bme' for K-1, 'story-mountain' for 2-3, 'plot-diagram' for 4-6",
    },
    passage: {
      type: Type.OBJECT,
      properties: {
        title: {
          type: Type.STRING,
          description: "Title of the story passage",
        },
        text: {
          type: Type.STRING,
          description:
            "The full story passage text. 3-5 sentences for K-1, 5-6 sentences for 2-3, 6-8 sentences for 4-6.",
        },
        author: {
          type: Type.STRING,
          description: "Author name (can be fictional for generated stories)",
        },
      },
      required: ["title", "text"],
    },
    elements: {
      type: Type.OBJECT,
      properties: {
        characters: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: {
                type: Type.STRING,
                description: "Character name",
              },
              description: {
                type: Type.STRING,
                description:
                  "Brief character description (1 sentence)",
              },
              role: {
                type: Type.STRING,
                enum: ["protagonist", "antagonist", "supporting"],
                description: "Character role in the story",
              },
            },
            required: ["name", "description", "role"],
          },
          description: "2-4 characters in the story",
        },
        setting: {
          type: Type.OBJECT,
          properties: {
            place: {
              type: Type.STRING,
              description: "Where the story takes place",
            },
            time: {
              type: Type.STRING,
              description:
                "When the story takes place (e.g., 'One sunny morning', 'A long time ago')",
            },
            description: {
              type: Type.STRING,
              description:
                "Brief description of the setting (1-2 sentences)",
            },
          },
          required: ["place", "time", "description"],
        },
        conflict: {
          type: Type.OBJECT,
          properties: {
            type: {
              type: Type.STRING,
              enum: [
                "person-vs-person",
                "person-vs-self",
                "person-vs-nature",
                "person-vs-society",
              ],
              description: "Type of conflict in the story",
            },
            description: {
              type: Type.STRING,
              description:
                "Brief description of the conflict (1-2 sentences)",
            },
          },
          required: ["type", "description"],
        },
      },
      required: ["characters", "setting"],
    },
    events: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description:
              "Unique identifier (e.g., 'event1', 'event2')",
          },
          text: {
            type: Type.STRING,
            description:
              "Short description of the event (1 sentence, kid-friendly language)",
          },
          arcPosition: {
            type: Type.STRING,
            enum: [
              "beginning",
              "rising-action",
              "climax",
              "falling-action",
              "resolution",
            ],
            description:
              "Where this event falls on the story arc. For BME: use 'beginning', 'climax' (for middle), 'resolution' (for end). For story-mountain/plot-diagram: use all five positions.",
          },
          order: {
            type: Type.INTEGER,
            description:
              "The correct chronological order of this event (0-indexed)",
          },
        },
        required: ["id", "text", "arcPosition", "order"],
      },
      description:
        "4-6 key events from the story, in their correct order. For BME, use 3-4 events. For story-mountain, use 5-6 events.",
    },
  },
  required: [
    "title",
    "gradeLevel",
    "structureType",
    "passage",
    "elements",
    "events",
  ],
};

/**
 * Determine the appropriate structure type based on grade level.
 */
function getStructureType(
  gradeLevel: string
): "bme" | "story-mountain" | "plot-diagram" | "heros-journey" {
  const gradeNum = parseInt(gradeLevel.replace(/[^0-9]/g, ""), 10);
  if (isNaN(gradeNum) || gradeNum <= 1) return "bme";
  if (gradeNum <= 3) return "story-mountain";
  return "plot-diagram";
}

/**
 * Generate story map data using Gemini AI
 *
 * Creates an interactive story mapping activity for literacy education.
 * Students read a passage, identify characters and setting, sequence
 * events on a story arc, and (for grades 4+) identify the conflict type.
 *
 * @param topic - The story topic or theme (e.g., "a lost puppy", "being brave", "friendship")
 * @param gradeLevel - Grade level string (e.g., "K", "1", "2", "3", "4", "5", "6")
 * @param config - Optional partial configuration to override generated values
 * @returns StoryMapData with complete story mapping activity
 */
export const generateStoryMap = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<StoryMapData>
): Promise<StoryMapData> => {
  const structureType = config?.structureType || getStructureType(gradeLevel);
  const gradeNum = parseInt(gradeLevel.replace(/[^0-9]/g, ""), 10) || 0;

  // Grade-specific instructions
  const gradeContext: Record<string, string> = {
    low: `
GRADE K-1 GUIDELINES:
- Write a VERY simple story (3-5 short sentences)
- Use basic sight words and simple vocabulary
- 2 characters maximum (protagonist and 1 supporting)
- Clear, concrete setting (e.g., "a park", "the beach")
- Simple beginning-middle-end structure
- Use BME structure type with 3-4 events
- Events use 'beginning', 'climax' (for middle), and 'resolution' (for end) as arcPosition
- No conflict analysis (omit conflict field or make it simple)
- Story should have a clear, happy resolution
- Example themes: sharing, helping, making friends, a pet adventure
`,
    mid: `
GRADE 2-3 GUIDELINES:
- Write a short story (5-6 sentences)
- Use grade-appropriate vocabulary with some descriptive language
- 2-3 characters with distinct roles
- Setting with both place and time
- Story-mountain structure with 5 events across all positions
- Include rising action and a clear climax
- Simple conflict that is resolved by the end
- Events use all 5 arcPositions: beginning, rising-action, climax, falling-action, resolution
- Example themes: overcoming a challenge, a school adventure, an unexpected discovery
`,
    high: `
GRADE 4-6 GUIDELINES:
- Write a more developed story (6-8 sentences)
- Rich vocabulary with figurative language appropriate for grade level
- 3-4 characters with clear protagonist, possible antagonist, and supporting characters
- Detailed setting with atmosphere
- Plot-diagram structure with 5-6 events
- Include a well-defined conflict (one of: person-vs-person, person-vs-self, person-vs-nature, person-vs-society)
- MUST include the conflict field in elements
- Events use all 5 arcPositions: beginning, rising-action, climax, falling-action, resolution
- Complex enough for students to analyze conflict type
- Example themes: standing up for what's right, facing fears, solving a mystery, environmental challenge
`,
  };

  const band =
    gradeNum <= 1 ? "low" : gradeNum <= 3 ? "mid" : "high";

  const generationPrompt = `Create an educational story map activity for the topic: "${topic}".

TARGET GRADE LEVEL: ${gradeLevel}
STRUCTURE TYPE: ${structureType}

${gradeContext[band]}

IMPORTANT RULES:
1. The passage text MUST contain all the information needed to identify the characters, setting, and events.
2. Events MUST be clearly described in the passage text so students can find them.
3. Each event should be a single, clear sentence that a student can identify in the passage.
4. Characters must be named and described in the passage.
5. The setting (place and time) must be mentioned in the passage.
${gradeNum >= 4 ? "6. Include a clear conflict that students can classify into one of the four types." : ""}

STRUCTURE TYPE RULES:
${structureType === "bme" ? `
- Use EXACTLY 3-4 events
- Events MUST use these arcPositions: 'beginning', 'climax' (as the middle event), 'resolution' (as the end event)
- Do NOT use 'rising-action' or 'falling-action' for BME
` : `
- Use EXACTLY 5-6 events
- Events MUST use all 5 arcPositions: 'beginning', 'rising-action', 'climax', 'falling-action', 'resolution'
- Distribute events across positions (1-2 per position)
`}

Generate a complete, engaging story that is age-appropriate and educational. The story should teach a positive lesson or theme.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: storyMapSchema,
        systemInstruction: `You are an expert K-6 literacy educator who creates engaging, age-appropriate stories for reading comprehension activities. You specialize in story structure, narrative elements, and scaffolded literacy instruction. Your stories are vivid, relatable to young students, and designed to teach story structure concepts. You always create stories where all elements (characters, setting, events, conflict) are clearly embedded in the passage text so students can identify them through close reading.`,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API");
    }

    const result = JSON.parse(text) as StoryMapData;

    // Validate the response
    if (!result || !result.events || !Array.isArray(result.events)) {
      console.error(
        "Invalid response from Gemini API - missing events array:",
        result
      );
      throw new Error(
        "Invalid response from Gemini API: missing or invalid events array"
      );
    }

    if (!result.passage || !result.passage.text) {
      console.error(
        "Invalid response from Gemini API - missing passage:",
        result
      );
      throw new Error(
        "Invalid response from Gemini API: missing or invalid passage"
      );
    }

    if (
      !result.elements ||
      !result.elements.characters ||
      !result.elements.setting
    ) {
      console.error(
        "Invalid response from Gemini API - missing elements:",
        result
      );
      throw new Error(
        "Invalid response from Gemini API: missing or invalid elements"
      );
    }

    // Merge with any config overrides
    const finalData: StoryMapData = {
      ...result,
      ...config,
      // Preserve nested objects unless explicitly overridden
      passage: config?.passage || result.passage,
      elements: config?.elements || result.elements,
      events: config?.events || result.events,
      // Ensure correct structure type
      structureType: config?.structureType || structureType,
    };

    console.log("Story Map Generated:", {
      title: finalData.title,
      gradeLevel: finalData.gradeLevel,
      structureType: finalData.structureType,
      eventCount: finalData.events?.length || 0,
      characterCount: finalData.elements?.characters?.length || 0,
      hasConflict: !!finalData.elements?.conflict,
      passageLength: finalData.passage?.text?.length || 0,
    });

    return finalData;
  } catch (error) {
    console.error("Error generating story map:", error);
    throw error;
  }
};
