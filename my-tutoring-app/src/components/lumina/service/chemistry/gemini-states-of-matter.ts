import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import {
  StatesOfMatterData,
  SubstanceConfig,
  ParticleConfig,
  StatesOfMatterChallenge,
  ChallengeOption,
} from "../../primitives/visual-primitives/chemistry/StatesOfMatter";

// Re-export types for convenience (no redefinition — sourced from the component)
export type {
  StatesOfMatterData,
  SubstanceConfig,
  ParticleConfig,
  StatesOfMatterChallenge,
  ChallengeOption,
};

/**
 * Schema definition for States of Matter Data
 *
 * Describes the JSON structure Gemini must return:
 * - substance: starting substance with melting/boiling points and colors per state
 * - particleConfig: particle simulation settings (count, size, trails, bonds)
 * - challenges: sequenced interactive tasks (identify, predict, explain, compare)
 * - showOptions: UI toggles for particle view, slider, labels, graph, speed
 * - substances: list of available substance keys for the switcher
 * - imagePrompt: prompt for generating a real-life phase-change image
 * - gradeBand: K-2 or 3-5
 */
const statesOfMatterSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description:
        "Short, engaging title for the activity (e.g. 'Watch Water Change!')",
    },
    description: {
      type: Type.STRING,
      description:
        "One-sentence activity description in kid-friendly language",
    },
    substance: {
      type: Type.OBJECT,
      description: "The starting substance to explore",
      properties: {
        name: {
          type: Type.STRING,
          description: "Common name of the substance (e.g. 'Water')",
        },
        formula: {
          type: Type.STRING,
          description:
            "Chemical formula (e.g. 'H₂O') or null for younger grades",
          nullable: true,
        },
        meltingPoint: {
          type: Type.NUMBER,
          description: "Melting point in degrees Celsius",
        },
        boilingPoint: {
          type: Type.NUMBER,
          description: "Boiling point in degrees Celsius",
        },
        currentTemp: {
          type: Type.NUMBER,
          description:
            "Starting temperature in degrees Celsius (should show the substance in its most common state)",
        },
        color: {
          type: Type.OBJECT,
          description: "Hex color for each state of this substance",
          properties: {
            solid: {
              type: Type.STRING,
              description: "Hex color when solid (e.g. '#93c5fd')",
            },
            liquid: {
              type: Type.STRING,
              description: "Hex color when liquid (e.g. '#3b82f6')",
            },
            gas: {
              type: Type.STRING,
              description: "Hex color when gas (e.g. '#e2e8f0')",
            },
          },
          required: ["solid", "liquid", "gas"],
        },
      },
      required: [
        "name",
        "formula",
        "meltingPoint",
        "boilingPoint",
        "currentTemp",
        "color",
      ],
    },
    particleConfig: {
      type: Type.OBJECT,
      description: "Configuration for the particle simulation",
      properties: {
        count: {
          type: Type.NUMBER,
          description: "Number of particles to simulate (20-60)",
        },
        size: {
          type: Type.STRING,
          enum: ["small", "medium", "large"],
          description: "Particle size",
        },
        showTrails: {
          type: Type.BOOLEAN,
          description:
            "Whether to show motion trails behind particles (useful for showing speed)",
        },
        showBonds: {
          type: Type.BOOLEAN,
          description:
            "Whether to show bond lines between close particles in solid state",
        },
      },
      required: ["count", "size", "showTrails", "showBonds"],
    },
    challenges: {
      type: Type.ARRAY,
      description:
        "3-5 sequenced challenges: identify → predict → explain → compare. " +
        "Use multiple-choice options for explain_particles, predict_change, and heating_curve challenges. " +
        "Use isTrueFalse for reversibility challenges. " +
        "Only use open-ended textarea (no options, no isTrueFalse) for compare_substances.",
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique challenge identifier",
          },
          type: {
            type: Type.STRING,
            enum: [
              "identify_state",
              "predict_change",
              "explain_particles",
              "heating_curve",
              "compare_substances",
              "reversibility",
            ],
            description: "Type of challenge task",
          },
          instruction: {
            type: Type.STRING,
            description: "Kid-friendly instruction for this challenge",
          },
          targetAnswer: {
            type: Type.STRING,
            description: "Expected correct answer or key answer word(s)",
          },
          targetTemp: {
            type: Type.NUMBER,
            description:
              "Target temperature the student should reach (for predict_change), or null",
            nullable: true,
          },
          hint: {
            type: Type.STRING,
            description: "Gentle hint if the student is stuck",
          },
          narration: {
            type: Type.STRING,
            description:
              "Wonder-driven narration text to spark curiosity and celebrate success",
          },
          options: {
            type: Type.ARRAY,
            description:
              "Multiple-choice options (3-4 choices). Required for explain_particles, predict_change, and heating_curve challenges. " +
              "Omit for identify_state (has built-in solid/liquid/gas buttons), reversibility (use isTrueFalse), and compare_substances (open-ended).",
            nullable: true,
            items: {
              type: Type.OBJECT,
              properties: {
                id: {
                  type: Type.STRING,
                  description: "Option identifier (A, B, C, D)",
                },
                text: {
                  type: Type.STRING,
                  description: "The option text the student sees",
                },
              },
              required: ["id", "text"],
            },
          },
          correctOptionId: {
            type: Type.STRING,
            description:
              "The id of the correct option (e.g. 'B'). Required when options are provided.",
            nullable: true,
          },
          isTrueFalse: {
            type: Type.BOOLEAN,
            description:
              "Set to true for reversibility challenges to render True/False buttons instead of textarea.",
            nullable: true,
          },
          correctBoolean: {
            type: Type.BOOLEAN,
            description:
              "The correct True/False answer. Required when isTrueFalse is true.",
            nullable: true,
          },
        },
        required: [
          "id",
          "type",
          "instruction",
          "targetAnswer",
          "targetTemp",
          "hint",
          "narration",
        ],
      },
    },
    showOptions: {
      type: Type.OBJECT,
      description: "Which UI panels to enable for this activity",
      properties: {
        showParticleView: {
          type: Type.BOOLEAN,
          description: "Show the particle simulation panel (always true)",
        },
        showTemperatureSlider: {
          type: Type.BOOLEAN,
          description: "Show the temperature slider control (always true)",
        },
        showStateLabels: {
          type: Type.BOOLEAN,
          description:
            "Show labels on the temperature slider (solid/liquid/gas regions)",
        },
        showEnergyGraph: {
          type: Type.BOOLEAN,
          description:
            "Show the heating curve graph (false for K-2, true for 3-5)",
        },
        showPhaseMarkers: {
          type: Type.BOOLEAN,
          description:
            "Show melting/boiling point markers on the slider",
        },
        showParticleSpeed: {
          type: Type.BOOLEAN,
          description:
            "Show the particle energy/speed indicator bar (false for K-2, true for 3-5)",
        },
      },
    },
    substances: {
      type: Type.ARRAY,
      description:
        "Array of substance keys available in the switcher (e.g. ['water', 'wax', 'iron'])",
      items: {
        type: Type.STRING,
      },
    },
    imagePrompt: {
      type: Type.STRING,
      description:
        "Prompt for generating a daily-life photo of phase changes (e.g. 'ice melting in a glass of lemonade on a sunny day')",
      nullable: true,
    },
    gradeBand: {
      type: Type.STRING,
      enum: ["K-2", "3-5"],
      description: "Target grade band for content complexity",
    },
  },
  required: [
    "title",
    "description",
    "substance",
    "particleConfig",
    "challenges",
    "showOptions",
    "substances",
    "gradeBand",
  ],
};

/**
 * Determine the grade band from grade level context string
 */
const resolveGradeBand = (gradeLevel: string): "K-2" | "3-5" => {
  const gl = gradeLevel.toLowerCase();
  if (
    gl.includes("k") ||
    gl.includes("kindergarten") ||
    gl.includes("1st") ||
    gl.includes("2nd") ||
    gl.includes("grade 1") ||
    gl.includes("grade 2") ||
    gl.includes("toddler") ||
    gl.includes("preschool")
  ) {
    return "K-2";
  }
  // Default to 3-5 for everything else (elementary, grades 3-5, etc.)
  return "3-5";
};

/**
 * Generate States of Matter data using Gemini
 *
 * Creates an interactive particle simulation where students control temperature
 * and observe how particles speed up, slow down, break free, or lock into place.
 * Split view shows macroscopic substance alongside particle model.
 *
 * Grade-appropriate content:
 * - K-2: Water focus, simple observations, no formulas, small particle count
 * - 3-5: Multiple substances, heating curve, particle speed, compare challenges
 *
 * @param topic - The topic or theme (e.g. "states of matter", "ice and water")
 * @param gradeLevel - Grade level context string
 * @param config - Optional config with intent override
 * @returns StatesOfMatterData ready for the StatesOfMatter component
 */
export const generateStatesOfMatter = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<{ intent: string }>
): Promise<StatesOfMatterData> => {
  const intent = config?.intent || "";
  const gradeBand = resolveGradeBand(gradeLevel);

  const gradeBandDescriptions: Record<string, string> = {
    "K-2":
      "Kindergarten to 2nd grade. Use WATER as the primary substance (ice, water, steam). " +
      "Keep language very simple — talk about 'tiny bits' or 'particles' not 'molecules'. " +
      "NO chemical formulas (formula should be null). " +
      "Particle count: 20-30. Size: large (easier to see). " +
      "showEnergyGraph: false. showParticleSpeed: false. " +
      "Focus on simple observations: 'What state is this?' and 'What happens when we heat it up?' " +
      "Challenges should be identify_state and predict_change types only. " +
      "Substances list should be just ['water']. " +
      "Use familiar everyday examples: ice cubes melting, puddles drying up, steam from a kettle.",
    "3-5":
      "3rd to 5th grade. Include MULTIPLE substances with different melting/boiling points. " +
      "Use 'particles' and 'energy' language. Introduce the heating curve concept. " +
      "Formulas are optional for well-known substances (H₂O, N₂, Fe). " +
      "Particle count: 30-50. Size: medium. Show trails and bonds. " +
      "showEnergyGraph: true. showParticleSpeed: true. " +
      "Include compare_substances challenges — ask students to compare melting points or " +
      "explain why chocolate melts in your hand but iron doesn't. " +
      "Include explain_particles challenges — ask what particles are doing in each state. " +
      "Substances list should include 3-4 options from: water, wax, iron, chocolate, nitrogen, butter. " +
      "Include a reversibility challenge — can we turn steam back into water?",
  };

  const generationPrompt = `Create a States of Matter particle simulation activity about "${topic}" for ${gradeBand} students.
${intent ? `\nTeaching intent: ${intent}` : ""}

GRADE BAND REQUIREMENTS (${gradeBand}):
${gradeBandDescriptions[gradeBand]}

GENERAL REQUIREMENTS:
1. Choose a starting substance that is relatable and safe.
2. Melting and boiling points must be scientifically accurate.
3. Provide 3 colors (hex) for each substance state (solid, liquid, gas) that look visually distinct.
4. currentTemp should start the substance in its most familiar state (e.g. water at 25°C = liquid).
5. Provide 3-5 challenges sequenced by difficulty:
   - Start with an "identify_state" challenge (what state is this substance in right now?)
   - Follow with "predict_change" (what will happen if we heat/cool it?)
   - Progress to harder challenges: "explain_particles", "heating_curve", "compare_substances", "reversibility"
6. Every narration field should be wonder-driven (e.g. "You discovered something amazing — the tiny particles sped up so much they broke free and became a gas!").
7. For predict_change challenges, set targetTemp to the temperature the student should try to reach.
8. Always include an imagePrompt describing a daily-life phase change scene:
   - e.g. "A child watching an ice cream cone melt on a hot summer day" or "Steam rising from a pot of boiling soup on the stove"
9. Set showOptions appropriately:
   - showParticleView: always true
   - showTemperatureSlider: always true
   - showStateLabels: always true
   - showEnergyGraph: false for K-2, true for 3-5
   - showPhaseMarkers: always true
   - showParticleSpeed: false for K-2, true for 3-5
10. The substances array must only include keys from: water, wax, iron, chocolate, nitrogen, butter.
11. For K-2: formula should be null. Only use ['water'] for substances.
    For 3-5: formula is optional. Use 3-4 substances from the available set.

CHALLENGE SCAFFOLDING (IMPORTANT):
Use the right answer format for each challenge type:
- identify_state: No options needed (the UI has built-in solid/liquid/gas buttons). Set targetAnswer to the correct state.
- explain_particles: Provide "options" with 3-4 multiple-choice descriptions of particle behavior.
  Example options: [{id:"A", text:"Vibrating in place, tightly packed"}, {id:"B", text:"Sliding past each other freely"}, {id:"C", text:"Flying apart in all directions"}, {id:"D", text:"Not moving at all"}].
  Set correctOptionId to the correct option id. Still set targetAnswer for fallback.
- predict_change: Provide "options" with 3-4 choices about what will happen.
  Example: [{id:"A", text:"It will melt into a liquid"}, {id:"B", text:"It will freeze into a solid"}, {id:"C", text:"Nothing will happen"}].
  Set correctOptionId to the correct option id.
- heating_curve: Provide "options" with 3-4 choices about what happens on the heating curve.
  Set correctOptionId to the correct option id.
- reversibility: Set "isTrueFalse" to true and "correctBoolean" to the correct answer (true/false).
  Frame the instruction as a true/false statement (e.g. "Melting ice into water can be reversed by cooling it back down.").
- compare_substances: No options — this stays as open-ended textarea for creative answers.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: statesOfMatterSchema,
        systemInstruction:
          "You are an expert science educator creating interactive particle simulation activities for K-5 students. " +
          "Design engaging explorations where students discover how temperature affects the state of matter. " +
          "Use accurate science — melting points, boiling points, and particle behavior must be correct. " +
          "Language should be age-appropriate: simple wonder-filled phrasing for young children, more precise scientific vocabulary for older students. " +
          "Every activity should connect to real-world examples so students see phase changes in their daily lives. " +
          "Always sequence challenges from easiest (identify) to hardest (compare/explain).",
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error(
        "No data returned from Gemini API for states-of-matter"
      );
    }

    const result = JSON.parse(text) as StatesOfMatterData;

    // -----------------------------------------------------------------------
    // Validation & Defaults
    // -----------------------------------------------------------------------

    // Ensure gradeBand
    if (!result.gradeBand || !["K-2", "3-5"].includes(result.gradeBand)) {
      result.gradeBand = gradeBand;
    }

    // Ensure showOptions defaults
    result.showOptions = {
      showParticleView: result.showOptions?.showParticleView ?? true,
      showTemperatureSlider:
        result.showOptions?.showTemperatureSlider ?? true,
      showStateLabels: result.showOptions?.showStateLabels ?? true,
      showEnergyGraph:
        result.showOptions?.showEnergyGraph ?? gradeBand === "3-5",
      showPhaseMarkers: result.showOptions?.showPhaseMarkers ?? true,
      showParticleSpeed:
        result.showOptions?.showParticleSpeed ?? gradeBand === "3-5",
    };

    // Ensure substance defaults
    if (result.substance) {
      result.substance = {
        name: result.substance.name || "Water",
        formula: result.substance.formula ?? null,
        meltingPoint:
          result.substance.meltingPoint ?? 0,
        boilingPoint:
          result.substance.boilingPoint ?? 100,
        currentTemp: result.substance.currentTemp ?? 25,
        color: {
          solid: result.substance.color?.solid || "#93c5fd",
          liquid: result.substance.color?.liquid || "#3b82f6",
          gas: result.substance.color?.gas || "#e2e8f0",
        },
      };
    } else {
      result.substance = {
        name: "Water",
        formula: gradeBand === "3-5" ? "H₂O" : null,
        meltingPoint: 0,
        boilingPoint: 100,
        currentTemp: 25,
        color: { solid: "#93c5fd", liquid: "#3b82f6", gas: "#e2e8f0" },
      };
    }

    // Ensure particleConfig defaults
    if (result.particleConfig) {
      const count = result.particleConfig.count ?? (gradeBand === "K-2" ? 25 : 40);
      result.particleConfig = {
        count: Math.max(20, Math.min(60, count)),
        size: result.particleConfig.size || (gradeBand === "K-2" ? "large" : "medium"),
        showTrails: result.particleConfig.showTrails ?? gradeBand === "3-5",
        showBonds: result.particleConfig.showBonds ?? true,
      };
    } else {
      result.particleConfig = {
        count: gradeBand === "K-2" ? 25 : 40,
        size: gradeBand === "K-2" ? "large" : "medium",
        showTrails: gradeBand === "3-5",
        showBonds: true,
      };
    }

    // Ensure every challenge has required fields
    if (result.challenges) {
      result.challenges = result.challenges.map((ch, idx) => {
        const challenge = {
          ...ch,
          id: ch.id || `challenge-${idx}`,
          type: ch.type || "identify_state",
          instruction:
            ch.instruction || "What state of matter is this substance in?",
          targetAnswer: ch.targetAnswer || "",
          targetTemp: ch.targetTemp ?? null,
          hint: ch.hint || "Look at the particles — are they moving fast or slow?",
          narration:
            ch.narration ||
            ch.instruction ||
            "Great observation!",
        };

        // Ensure correctOptionId is set when options are present
        if (challenge.options && challenge.options.length > 0 && !challenge.correctOptionId) {
          const target = challenge.targetAnswer.toLowerCase();
          const match = challenge.options.find(
            (o) => o.text.toLowerCase().includes(target) || target.includes(o.text.toLowerCase())
          );
          if (match) {
            challenge.correctOptionId = match.id;
          } else {
            // Default to first option — generator gave us no usable signal
            challenge.correctOptionId = challenge.options[0].id;
          }
        }

        // Ensure correctBoolean is set when isTrueFalse is present
        if (challenge.isTrueFalse && challenge.correctBoolean === undefined) {
          const target = challenge.targetAnswer.toLowerCase();
          challenge.correctBoolean = target === "true" || target === "yes";
        }

        return challenge;
      });
    }

    // Ensure substances list defaults
    if (!result.substances || result.substances.length === 0) {
      result.substances =
        gradeBand === "K-2"
          ? ["water"]
          : ["water", "wax", "chocolate", "butter"];
    }

    // Ensure imagePrompt
    if (!result.imagePrompt) {
      result.imagePrompt =
        gradeBand === "K-2"
          ? "A child watching an ice cube melt in a glass of water on a warm sunny day"
          : "A kitchen scene showing ice melting in a pan, water boiling on the stove, and steam rising";
    }

    console.log("🌡️ States of Matter Generated:", {
      title: result.title,
      gradeBand: result.gradeBand,
      substance: result.substance.name,
      meltingPoint: result.substance.meltingPoint,
      boilingPoint: result.substance.boilingPoint,
      particleCount: result.particleConfig.count,
      challengeCount: result.challenges?.length ?? 0,
      substancesAvailable: result.substances?.length ?? 0,
    });

    return result;
  } catch (error) {
    console.error("Error generating states-of-matter data:", error);
    throw error;
  }
};
