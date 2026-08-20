import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import {
  StatesOfMatterData,
  SubstanceConfig,
  ParticleConfig,
  StatesOfMatterChallenge,
} from "../../primitives/visual-primitives/chemistry/StatesOfMatter";
import {
  bandPool,
  carriesAnswerVocabulary,
} from "../../primitives/visual-primitives/chemistry/statesOfMatterScript";

// Re-export types for convenience (no redefinition — sourced from the component)
export type {
  StatesOfMatterData,
  SubstanceConfig,
  ParticleConfig,
  StatesOfMatterChallenge,
};

/**
 * Schema definition for States of Matter Data
 *
 * Describes the JSON structure Gemini must return:
 * - substance: starting substance with melting/boiling points and colors per state
 * - particleConfig: particle simulation settings (count, size, trails, bonds)
 * NOTE: challenges are NOT here. Every judged challenge is CODE-DRAWN from the
 * substance table (`states-of-matter-challenges.ts`) and every answer key is
 * computed, so no LLM ever writes the science this primitive grades.
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
 * Canonical-grade → band mapper (systemic 14m). The prose test above matches
 * none of its K-2 markers in the production elementary sentence ("grades 1-5"),
 * so published G1/G2 lessons landed the 3-5 band. Canonical grade wins when
 * present; null keeps the prose fallback reachable (never deleted).
 */
export function statesOfMatterGradeBandFromGrade(grade?: string): "K-2" | "3-5" | null {
  if (!grade) return null;
  const g = grade.trim().toUpperCase();
  if (g === "K") return "K-2";
  const n = parseInt(g, 10);
  if (isNaN(n)) return null;
  return n <= 2 ? "K-2" : "3-5";
}

/**
 * Generate States of Matter data using Gemini
 *
 * Creates an interactive particle simulation where students control temperature
 * and observe how particles speed up, slow down, break free, or lock into place.
 * Split view shows macroscopic substance alongside particle model.
 *
 * Grade-appropriate content:
 * - K-2: Water focus, simple observations, no formulas, small particle count
 * - 3-5: Multiple substances, heating curve, particle speed
 *
 * @param topic - The topic or theme (e.g. "states of matter", "ice and water")
 * @param gradeLevel - Grade level context string
 * @param config - Optional config with intent override
 * @returns StatesOfMatterData ready for the StatesOfMatter component
 */
export const generateStatesOfMatter = async (ctx: GenerationContext): Promise<StatesOfMatterData> => {
  const { topic } = ctx;
  const gradeLevel = ctx.gradeContext;
  const intent = ctx.intent || "";
  // Canonical objective grade wins; the prose parser is only the fallback (14m).
  const canonicalBand = statesOfMatterGradeBandFromGrade(ctx.grade);
  const gradeBand = canonicalBand ?? resolveGradeBand(gradeLevel);

  const gradeBandDescriptions: Record<string, string> = {
    "K-2":
      "Kindergarten to 2nd grade. Use WATER as the primary substance (ice, water, steam). " +
      "Keep language very simple — talk about 'tiny bits' or 'particles' not 'molecules'. " +
      "NO chemical formulas (formula should be null). " +
      "Particle count: 20-30. Size: large (easier to see). " +
      "showEnergyGraph: false. showParticleSpeed: false. " +
      "Focus on simple observations: 'What state is this?' and 'What happens when we heat it up?' " +
      "Substances list: everyday, above-freezing things — water, wax, chocolate, butter, coconutOil. " +
      "Use familiar everyday examples: ice cubes melting, puddles drying up, steam from a kettle.",
    "3-5":
      "3rd to 5th grade. Include MULTIPLE substances with different melting/boiling points. " +
      "Use 'particles' and 'energy' language. Introduce the heating curve concept. " +
      "Formulas are optional for well-known substances (H₂O, N₂, Fe). " +
      "Particle count: 30-50. Size: medium. Show trails and bonds. " +
      "showEnergyGraph: true. showParticleSpeed: true. " +
      "Substances list should include 3-4 keys from the allowed set below.",
  };

  const allowedKeys = bandPool(gradeBand).map((sub) => sub.key);

  const generationPrompt = `Create a States of Matter particle simulation activity about "${topic}" for ${gradeBand} students.
${intent ? `\nTeaching intent: ${intent}` : ""}

GRADE BAND REQUIREMENTS (${gradeBand}):
${gradeBandDescriptions[gradeBand]}

GENERAL REQUIREMENTS:
1. Choose a starting substance that is relatable and safe.
2. Melting and boiling points must be scientifically accurate.
3. Provide 3 colors (hex) for each substance state (solid, liquid, gas) that look visually distinct.
4. currentTemp should start the substance in its most familiar state (e.g. water at 25°C = liquid).
5. Always include an imagePrompt describing a daily-life phase change scene:
   - e.g. "A child watching an ice cream cone melt on a hot summer day" or "Steam rising from a pot of boiling soup on the stove"
6. Set showOptions appropriately:
   - showParticleView: always true
   - showTemperatureSlider: always true
   - showStateLabels: always true
   - showEnergyGraph: false for K-2, true for 3-5
   - showPhaseMarkers: always true
   - showParticleSpeed: false for K-2, true for 3-5
7. The substances array must only include keys from: ${allowedKeys.join(", ")}.
8. For K-2: formula should be null.

TITLE RULE (IMPORTANT): the title is READ ALOUD to the child and printed over
the beaker, so it must NOT contain a state or a change word — no "solid",
"liquid", "gas", "ice", "steam", "melt", "freeze", "boil" or "condense". A title
that names the answer answers the question before it is asked. Use the topic or
the substance instead: "Wax on the Hot Plate", "What Heat Does".`;

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
          "Every activity should connect to real-world examples so students see phase changes in their daily lives.",
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
    // With a canonical grade the band is NOT the LLM's choice — code stamps it
    // (14m); the backstop only fixes invalid stamps on the legacy no-grade path.
    if (canonicalBand) {
      result.gradeBand = canonicalBand;
    } else if (!result.gradeBand || !["K-2", "3-5"].includes(result.gradeBand)) {
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

    // Substance list: keep only keys the CODE TABLE knows, so exploration
    // never offers a substance a judged session could not ask about.
    const allowed = new Set(allowedKeys);
    result.substances = (result.substances ?? []).filter((k) => allowed.has(k));
    if (result.substances.length === 0) {
      result.substances = allowedKeys.slice(0, gradeBand === "K-2" ? 3 : 4);
    }

    // Defect 11, generator-side half: the TITLE is read aloud and printed over
    // the beaker, so a title carrying a state or change word answers an observe
    // item before the tutor finishes asking. Gated on BOTH sides of the wire
    // (`StatesOfMatter.tsx` re-checks whatever actually arrives).
    if (!result.title || carriesAnswerVocabulary(result.title)) {
      // ⚠️ THE FALLBACK NEEDS THE SAME GATE. The first live probe drew the
      // topic "ice cubes on a warm day", and a fallback built from the topic
      // reproduced the leak word verbatim — the guard has to hold on every
      // string it can emit, not only on the one the model wrote.
      const candidates = [
        topic ? `Heat and ${topic}` : "",
        `${result.substance.name} on the Hot Plate`,
      ];
      result.title = candidates.find((c) => c && !carriesAnswerVocabulary(c))
        ?? "What Heat Does";
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
      substancesAvailable: result.substances?.length ?? 0,
    });

    return result;
  } catch (error) {
    console.error("Error generating states-of-matter data:", error);
    throw error;
  }
};
