import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import {
  MatterExplorerData,
  MatterObject,
  MatterChallenge,
} from "../../primitives/visual-primitives/chemistry/MatterExplorer";

// Re-export types for convenience (no redefinition — sourced from the component)
export type { MatterExplorerData, MatterObject, MatterChallenge };

/**
 * Schema definition for Matter Explorer Data
 *
 * Describes the JSON structure Gemini must return:
 * - title & description for the activity
 * - objects: everyday items with state & observable properties
 * - challenges: sequenced tasks (sort → describe → predict/mystery)
 * - showOptions: UI toggles
 * - gradeBand: K-1 or 1-2
 */
const matterExplorerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Short, engaging title for the activity (e.g. 'Kitchen Matter Hunt')",
    },
    description: {
      type: Type.STRING,
      description: "One-sentence activity description in kid-friendly language",
    },
    objects: {
      type: Type.ARRAY,
      description: "6-10 everyday objects for the student to explore and classify",
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique identifier, e.g. 'obj-ice-cube'",
          },
          name: {
            type: Type.STRING,
            description: "Common name kids would use (e.g. 'ice cube', 'juice')",
          },
          state: {
            type: Type.STRING,
            enum: ["solid", "liquid", "gas"],
            description: "Primary state of matter at room temperature",
          },
          properties: {
            type: Type.OBJECT,
            properties: {
              color: {
                type: Type.STRING,
                description: "Observable color of the object",
              },
              texture: {
                type: Type.STRING,
                enum: ["smooth", "rough", "bumpy", "soft", "hard"],
              },
              transparency: {
                type: Type.STRING,
                enum: ["transparent", "translucent", "opaque"],
              },
              flexibility: {
                type: Type.STRING,
                enum: ["rigid", "flexible", "flows"],
              },
              shape: {
                type: Type.STRING,
                enum: ["keeps_shape", "takes_container", "fills_space"],
              },
              weight: {
                type: Type.STRING,
                enum: ["light", "medium", "heavy"],
              },
            },
            required: ["color", "texture", "transparency", "flexibility", "shape", "weight"],
          },
          imagePrompt: {
            type: Type.STRING,
            description: "Short prompt for generating a real-world photo of this object",
          },
          canChangeState: {
            type: Type.BOOLEAN,
            description: "Whether the object can change state with temperature (e.g. ice melts)",
          },
          stateChangeTemp: {
            type: Type.NUMBER,
            description: "Temperature in °C at which state change occurs (only if canChangeState is true)",
          },
        },
        required: ["id", "name", "state", "properties", "canChangeState"],
      },
    },
    challenges: {
      type: Type.ARRAY,
      description: "Sequenced challenges: always start with sort, then describe, then optionally predict/mystery/compare",
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique challenge identifier",
          },
          type: {
            type: Type.STRING,
            enum: ["sort", "describe", "predict", "mystery", "compare"],
          },
          instruction: {
            type: Type.STRING,
            description: "Kid-friendly instruction for this challenge",
          },
          targetAnswer: {
            type: Type.STRING,
            description: "Expected correct answer or key answer word(s)",
          },
          hint: {
            type: Type.STRING,
            description: "Gentle hint if the student is stuck",
          },
          narration: {
            type: Type.STRING,
            description: "Wonder-driven narration text to spark curiosity",
          },
        },
        required: ["id", "type", "instruction", "targetAnswer", "hint", "narration"],
      },
    },
    showOptions: {
      type: Type.OBJECT,
      description: "Which UI panels to enable for this activity",
      properties: {
        showPropertyPanel: {
          type: Type.BOOLEAN,
          description: "Show the property inspection panel when an object is selected",
        },
        showTemperatureSlider: {
          type: Type.BOOLEAN,
          description: "Show the temperature slider for state-change exploration",
        },
        showParticleView: {
          type: Type.BOOLEAN,
          description: "Show animated particle view of matter states",
        },
        showVennDiagram: {
          type: Type.BOOLEAN,
          description: "Show Venn diagram for comparing objects",
        },
      },
    },
    gradeBand: {
      type: Type.STRING,
      enum: ["K-1", "1-2"],
      description: "Target grade band for content complexity",
    },
  },
  required: ["title", "description", "objects", "challenges", "showOptions", "gradeBand"],
};

/**
 * Generate Matter Explorer data using Gemini
 *
 * Creates an interactive matter classification activity for K-2 students with:
 * - Everyday objects to sort into solid / liquid / gas
 * - Observable properties to explore
 * - Temperature-based state change exploration
 * - Mystery material challenges
 *
 * @param topic - The topic or theme for the activity (e.g. "kitchen items", "playground")
 * @param gradeLevel - Grade level context string
 * @param config - Optional config with intent override
 * @returns MatterExplorerData ready for the MatterExplorer component
 */
export const generateMatterExplorer = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<{ intent: string }>
): Promise<MatterExplorerData> => {
  const intent = config?.intent || "";

  const gradeBand = gradeLevel.toLowerCase().includes("k") ||
    gradeLevel.toLowerCase().includes("kindergarten")
    ? "K-1"
    : "1-2";

  const generationPrompt = `Create a Matter Explorer activity about "${topic}" for ${gradeBand === "K-1" ? "Kindergarten to 1st grade" : "1st to 2nd grade"} students.
${intent ? `\nTeaching intent: ${intent}` : ""}

REQUIREMENTS:
1. Choose 6-10 everyday objects kids can see and touch (ice, water, air, rock, milk, balloon, sand, honey, juice, steam, etc.).
2. Include a good mix: at least 2 solids, 2 liquids, and 1-2 gases.
3. For K-1: stick to obvious examples (rock=solid, water=liquid, air=gas).
   For 1-2: include 1-2 trickier materials (honey, sand, toothpaste, fog) that challenge assumptions.
4. At least 2 objects should have canChangeState=true with realistic stateChangeTemp values (e.g. water freezes at 0°C, butter melts around 32°C).
5. Challenges MUST be sequenced: start with a "sort" challenge, then a "describe" challenge, then optionally "predict", "mystery", or "compare".
6. Provide 3-5 challenges total.
7. Every imagePrompt should describe a real-world photo of the object that a young child would recognise.
8. Every narration field should be wonder-driven and spark curiosity (e.g. "I wonder what would happen if we heated the ice cube?").
9. Set showOptions appropriately:
   - showPropertyPanel: always true
   - showTemperatureSlider: true if any object has canChangeState
   - showParticleView: true only for grade 1-2
   - showVennDiagram: true only if a compare challenge is included`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: matterExplorerSchema,
        systemInstruction:
          "You are an expert early-childhood science educator creating interactive matter-classification activities for Kindergarten through 2nd grade. " +
          "Use simple, wonder-filled language. Choose objects children encounter daily — in the kitchen, playground, bathroom, or outdoors. " +
          "Properties must be physically accurate. State classifications must be scientifically correct (sand is a solid even though it pours). " +
          "Narration should model scientific thinking: observing, comparing, predicting. " +
          "Always sequence challenges from easiest (sort) to hardest (mystery/compare).",
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API for matter-explorer");
    }

    const result = JSON.parse(text) as MatterExplorerData;

    // -----------------------------------------------------------------------
    // Validation & Defaults
    // -----------------------------------------------------------------------

    // Ensure gradeBand
    if (!result.gradeBand || !["K-1", "1-2"].includes(result.gradeBand)) {
      result.gradeBand = gradeBand as "K-1" | "1-2";
    }

    // Ensure showOptions defaults
    result.showOptions = {
      showPropertyPanel: result.showOptions?.showPropertyPanel ?? true,
      showTemperatureSlider:
        result.showOptions?.showTemperatureSlider ??
        result.objects?.some((o) => o.canChangeState) ??
        false,
      showParticleView: result.showOptions?.showParticleView ?? false,
      showVennDiagram: result.showOptions?.showVennDiagram ?? false,
    };

    // Ensure every object has required fields with safe defaults
    if (result.objects) {
      result.objects = result.objects.map((obj, idx) => ({
        ...obj,
        id: obj.id || `obj-${idx}`,
        canChangeState: obj.canChangeState ?? false,
        stateChangeTemp: obj.canChangeState ? (obj.stateChangeTemp ?? null) : null,
        properties: {
          color: obj.properties?.color ?? "unknown",
          texture: obj.properties?.texture ?? "smooth",
          transparency: obj.properties?.transparency ?? "opaque",
          flexibility: obj.properties?.flexibility ?? "rigid",
          shape: obj.properties?.shape ?? "keeps_shape",
          weight: obj.properties?.weight ?? "medium",
        },
      }));
    }

    // Ensure every challenge has required fields
    if (result.challenges) {
      result.challenges = result.challenges.map((ch, idx) => ({
        ...ch,
        id: ch.id || `challenge-${idx}`,
        narration: ch.narration || ch.instruction || "",
        hint: ch.hint || "Think about what you already know!",
      }));
    }

    console.log("🔬 Matter Explorer Generated:", {
      title: result.title,
      gradeBand: result.gradeBand,
      objectCount: result.objects?.length ?? 0,
      challengeCount: result.challenges?.length ?? 0,
      hasTemperatureSlider: result.showOptions.showTemperatureSlider,
    });

    return result;
  } catch (error) {
    console.error("Error generating matter explorer data:", error);
    throw error;
  }
};
