import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import {
  EnergyOfReactionsData,
} from "../../primitives/visual-primitives/chemistry/EnergyOfReactions";

// Re-export type for convenience (no redefinition — sourced from the component)
export type { EnergyOfReactionsData };

/**
 * Schema definition for Energy of Reactions Data
 *
 * Describes the JSON structure Gemini must return:
 * - reaction: core reaction info (name, equation, type, deltaH, activation energy, real-world example)
 * - energyDiagram: enthalpy diagram levels and catalyst path
 * - bondEnergies: breaking/forming bond energy breakdown
 * - challenges: sequenced interactive challenges (classify → read_diagram → draw_diagram → catalyst_effect → calculate_deltaH → predict)
 * - showOptions: UI toggles for diagram, gauge, bond view, panels, animation
 * - gradeBand: 5-6 or 7-8
 */
const energyOfReactionsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description:
        "Short, engaging title for the activity (e.g. 'Combustion: Feel the Heat!')",
    },
    description: {
      type: Type.STRING,
      description:
        "One-sentence activity description in kid-friendly language",
    },
    reaction: {
      type: Type.OBJECT,
      description: "Core information about the chemical reaction",
      properties: {
        name: {
          type: Type.STRING,
          description: "Human-readable name of the reaction (e.g. 'Combustion of Methane')",
        },
        equation: {
          type: Type.STRING,
          description:
            "Balanced chemical equation as a string (e.g. 'CH4 + 2O2 → CO2 + 2H2O')",
        },
        type: {
          type: Type.STRING,
          enum: ["exothermic", "endothermic"],
          description: "Whether the reaction releases (exothermic) or absorbs (endothermic) energy",
        },
        deltaH: {
          type: Type.NUMBER,
          description:
            "Enthalpy change in kJ/mol. Negative for exothermic (e.g. -890), positive for endothermic (e.g. +178). Must be scientifically accurate for the given reaction.",
        },
        activationEnergy: {
          type: Type.NUMBER,
          description:
            "Activation energy in kJ/mol — the energy barrier that must be overcome to start the reaction (always positive, e.g. 150)",
        },
        realWorldExample: {
          type: Type.STRING,
          description:
            "A relatable real-world example of this reaction (e.g. 'Burning natural gas on a stove to cook food')",
        },
        imagePrompt: {
          type: Type.STRING,
          description:
            "Optional image generation prompt for an illustration of this reaction",
          nullable: true,
        },
      },
      required: [
        "name",
        "equation",
        "type",
        "deltaH",
        "activationEnergy",
        "realWorldExample",
      ],
    },
    energyDiagram: {
      type: Type.OBJECT,
      description:
        "Energy levels for the enthalpy diagram visualization (values in kJ, used for relative positioning)",
      properties: {
        reactantLevel: {
          type: Type.NUMBER,
          description: "Energy level of the reactants in kJ (e.g. 500)",
        },
        productLevel: {
          type: Type.NUMBER,
          description:
            "Energy level of the products in kJ. Lower than reactantLevel for exothermic, higher for endothermic.",
        },
        activationPeak: {
          type: Type.NUMBER,
          description:
            "Peak energy at the transition state (must be higher than both reactantLevel and productLevel)",
        },
        showCatalystPath: {
          type: Type.BOOLEAN,
          description: "Whether to display the catalyst comparison path on the diagram",
        },
        catalystActivation: {
          type: Type.NUMBER,
          description:
            "Peak energy with catalyst present (lower than activationPeak but higher than both reactant and product levels). Null if no catalyst path.",
          nullable: true,
        },
      },
      required: [
        "reactantLevel",
        "productLevel",
        "activationPeak",
        "showCatalystPath",
        "catalystActivation",
      ],
    },
    bondEnergies: {
      type: Type.OBJECT,
      description:
        "Bond energy breakdown for calculating deltaH from bond energies (grade 7-8 feature)",
      properties: {
        enabled: {
          type: Type.BOOLEAN,
          description:
            "Whether bond energy view is enabled (true for grade 7-8, false for grade 5-6)",
        },
        bondsBreaking: {
          type: Type.ARRAY,
          description:
            "Bonds broken in reactants (endothermic step — costs energy)",
          items: {
            type: Type.OBJECT,
            properties: {
              bond: {
                type: Type.STRING,
                description: "Bond notation (e.g. 'C-H', 'O=O', 'C=O')",
              },
              energy: {
                type: Type.NUMBER,
                description:
                  "Bond dissociation energy per bond in kJ/mol (e.g. C-H: 413, O=O: 498)",
              },
              count: {
                type: Type.NUMBER,
                description: "Number of these bonds broken in the reaction",
              },
            },
            required: ["bond", "energy", "count"],
          },
        },
        bondsForming: {
          type: Type.ARRAY,
          description:
            "Bonds formed in products (exothermic step — releases energy)",
          items: {
            type: Type.OBJECT,
            properties: {
              bond: {
                type: Type.STRING,
                description: "Bond notation (e.g. 'C=O', 'O-H')",
              },
              energy: {
                type: Type.NUMBER,
                description:
                  "Bond dissociation energy per bond in kJ/mol (e.g. C=O in CO2: 799, O-H: 463)",
              },
              count: {
                type: Type.NUMBER,
                description: "Number of these bonds formed in the reaction",
              },
            },
            required: ["bond", "energy", "count"],
          },
        },
      },
      required: ["enabled", "bondsBreaking", "bondsForming"],
    },
    challenges: {
      type: Type.ARRAY,
      description:
        "3-6 sequenced challenges progressing in difficulty: classify → read_diagram → draw_diagram → catalyst_effect → calculate_deltaH → predict",
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique challenge identifier (e.g. 'ch1', 'ch2')",
          },
          type: {
            type: Type.STRING,
            enum: [
              "classify",
              "read_diagram",
              "draw_diagram",
              "catalyst_effect",
              "calculate_deltaH",
              "predict",
            ],
            description: "Type of challenge task",
          },
          instruction: {
            type: Type.STRING,
            description: "Kid-friendly instruction for this challenge",
          },
          targetAnswer: {
            type: Type.STRING,
            description:
              "The correct answer (e.g. 'exothermic', '-890', 'lower activation energy')",
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
        },
        required: ["id", "type", "instruction", "targetAnswer", "hint", "narration"],
      },
    },
    showOptions: {
      type: Type.OBJECT,
      description: "Which UI panels to enable for this activity",
      properties: {
        showEnergyDiagram: {
          type: Type.BOOLEAN,
          description: "Show the enthalpy diagram with reaction pathway",
        },
        showTemperatureGauge: {
          type: Type.BOOLEAN,
          description: "Show the temperature gauge that responds to reaction activation",
        },
        showBondView: {
          type: Type.BOOLEAN,
          description:
            "Show bond energy breakdown panel (typically true for grade 7-8 only)",
        },
        showRealWorldPanel: {
          type: Type.BOOLEAN,
          description: "Show real-world connection panel with example",
        },
        showCalculation: {
          type: Type.BOOLEAN,
          description:
            "Show energy calculation panel (grade 7-8 only)",
        },
        showCatalystComparison: {
          type: Type.BOOLEAN,
          description:
            "Show catalyst vs. uncatalyzed path comparison toggle",
        },
        animateReactionPath: {
          type: Type.BOOLEAN,
          description: "Animate the energy ball along the reaction pathway",
        },
      },
      required: [
        "showEnergyDiagram",
        "showTemperatureGauge",
        "showBondView",
        "showRealWorldPanel",
        "showCalculation",
        "showCatalystComparison",
        "animateReactionPath",
      ],
    },
    gradeBand: {
      type: Type.STRING,
      enum: ["5-6", "7-8"],
      description: "Target grade band for content complexity",
    },
  },
  required: [
    "title",
    "description",
    "reaction",
    "energyDiagram",
    "bondEnergies",
    "challenges",
    "showOptions",
    "gradeBand",
  ],
};

/**
 * Determine the grade band from grade level context string
 */
const resolveGradeBand = (gradeLevel: string): "5-6" | "7-8" => {
  const gl = gradeLevel.toLowerCase();
  if (
    gl.includes("8") ||
    gl.includes("grade 8") ||
    gl.includes("7-8") ||
    gl.includes("7") ||
    gl.includes("grade 7") ||
    gl.includes("advanced")
  ) {
    return "7-8";
  }
  return "5-6";
};

/**
 * Generate Energy of Reactions data using Gemini
 *
 * Creates an interactive energy-of-reactions activity where students explore
 * exothermic and endothermic reactions through enthalpy diagrams, temperature
 * gauges, bond energy breakdowns, and catalyst comparisons.
 *
 * Grade-appropriate content:
 * - 5-6: Focus on classifying reactions as exothermic/endothermic, reading
 *         simple energy diagrams, temperature changes, and real-world examples.
 *         No bond energy calculations. Simpler vocabulary.
 * - 7-8: Include bond energy calculations (deltaH = bonds broken - bonds formed),
 *         activation energy concepts, catalyst effects, and quantitative challenges.
 *         Scientific vocabulary and more complex reactions.
 *
 * @param topic - The topic or theme (e.g. "combustion reactions", "photosynthesis energy")
 * @param gradeLevel - Grade level context string
 * @param config - Optional partial EnergyOfReactionsData for overrides
 * @returns EnergyOfReactionsData ready for the EnergyOfReactions component
 */
export const generateEnergyOfReactions = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<EnergyOfReactionsData>
): Promise<EnergyOfReactionsData> => {
  const gradeBand = resolveGradeBand(gradeLevel);

  const gradeBandDescriptions: Record<string, string> = {
    "5-6":
      "Grades 5-6. Focus on SIMPLE, everyday reactions students can relate to. " +
      "Use reactions like: burning wood, rusting iron, baking soda + vinegar, ice melting, cooking an egg. " +
      "Vocabulary: 'gives off heat', 'absorbs heat', 'energy comes out', 'energy goes in'. " +
      "Energy diagram should be visually clear with big differences between reactant and product levels. " +
      "NO bond energy calculations — set bondEnergies.enabled to false and provide empty arrays. " +
      "Challenges should focus on: classify (is it exo or endo?), read_diagram (which is higher?), predict (will it feel hot or cold?). " +
      "DO NOT include calculate_deltaH or catalyst_effect challenges. " +
      "Use kid-friendly language throughout: 'Does this reaction give off heat or absorb heat?' " +
      "showOptions: showBondView=false, showCalculation=false, showCatalystComparison=false. " +
      "Keep deltaH values rounded to simple numbers (e.g. -400, +200). " +
      "Activation energy: use simple values, no need for scientific precision.",

    "7-8":
      "Grades 7-8. Use scientifically accurate reactions with correct deltaH values. " +
      "Good reactions: CH4 + 2O2 → CO2 + 2H2O (ΔH = -890 kJ), photosynthesis (ΔH = +2803 kJ), " +
      "neutralization HCl + NaOH → NaCl + H2O (ΔH = -57 kJ), decomposition of CaCO3 (ΔH = +178 kJ). " +
      "MUST include accurate bond energies: C-H ≈ 413, O=O ≈ 498, C=O (in CO2) ≈ 799, O-H ≈ 463, " +
      "H-H ≈ 436, N≡N ≈ 945, C-C ≈ 348, C=C ≈ 614. Set bondEnergies.enabled to true. " +
      "Include catalyst path on the energy diagram with showCatalystPath=true and a realistic catalystActivation value. " +
      "Use scientific vocabulary: 'enthalpy change', 'activation energy', 'transition state', 'catalyst'. " +
      "Challenges should progress: classify → read_diagram → catalyst_effect → calculate_deltaH → predict. " +
      "Include at least one calculate_deltaH challenge where students compute ΔH from bond energies. " +
      "showOptions: showBondView=true, showCalculation=true, showCatalystComparison=true. " +
      "Connect to real-world applications: car engines, cold packs, industrial processes.",
  };

  const generationPrompt = `Create an Energy of Reactions activity about "${topic}" for ${gradeBand} students.

GRADE BAND REQUIREMENTS (${gradeBand}):
${gradeBandDescriptions[gradeBand]}

CRITICAL REQUIREMENTS:

1. REACTION DATA:
   - "name" should be a clear, descriptive name (e.g. "Combustion of Methane").
   - "equation" must be a properly balanced chemical equation string (e.g. "CH4 + 2O2 → CO2 + 2H2O").
   - "type" must be "exothermic" if deltaH is negative, "endothermic" if positive.
   - "deltaH" must be scientifically accurate for the given reaction (negative for exothermic, positive for endothermic).
   - "activationEnergy" is always positive (it's the energy barrier to START the reaction).
   - "realWorldExample" should be relatable and age-appropriate.

2. ENERGY DIAGRAM:
   - "reactantLevel" and "productLevel" should reflect the relative energy. For exothermic: reactantLevel > productLevel. For endothermic: productLevel > reactantLevel.
   - "activationPeak" must be HIGHER than both reactantLevel and productLevel (it's the transition state).
   - The difference between reactantLevel and productLevel should roughly correspond to |deltaH|.
   - If showCatalystPath is true, "catalystActivation" should be lower than "activationPeak" but still above both reactant and product levels.

3. BOND ENERGIES (grade 7-8 only):
   - Set "enabled" to true for grade 7-8, false for grade 5-6.
   - "bondsBreaking" lists all bonds broken in reactants with accurate bond energies.
   - "bondsForming" lists all bonds formed in products with accurate bond energies.
   - VERIFY: sum(breaking energies) - sum(forming energies) should approximately equal deltaH.
   - For grade 5-6: set enabled=false and use empty arrays for bondsBreaking and bondsForming.

4. CHALLENGES:
   - Provide 3-5 challenges sequenced by difficulty.
   - Each challenge must have a unique "id" (e.g. "ch1", "ch2").
   - "targetAnswer" should be a clear, concise expected answer.
   - "hint" should gently guide without giving away the answer.
   - "narration" should celebrate learning and build curiosity.
   - Challenge types by grade band:
     * 5-6: classify, read_diagram, predict ONLY
     * 7-8: classify, read_diagram, catalyst_effect, calculate_deltaH, predict

5. SHOW OPTIONS:
   - 5-6: showEnergyDiagram=true, showTemperatureGauge=true, showBondView=false, showRealWorldPanel=true, showCalculation=false, showCatalystComparison=false, animateReactionPath=true
   - 7-8: showEnergyDiagram=true, showTemperatureGauge=true, showBondView=true, showRealWorldPanel=true, showCalculation=true, showCatalystComparison=true, animateReactionPath=true

6. NARRATION EXAMPLES:
   - "When methane burns, the bonds in CH4 break and NEW bonds form in CO2 and H2O — and more energy comes OUT than went IN!"
   - "A catalyst is like a shortcut over the mountain — the reaction still releases the same energy, but it needs less of a push to get started."
   - "An ice pack feels cold because the reaction inside ABSORBS heat from your skin — that's endothermic in action!"

DOUBLE-CHECK: Verify that your deltaH sign matches the reaction type (negative = exothermic, positive = endothermic), that the energy diagram levels are consistent, and that bond energy calculations (if enabled) approximately match deltaH.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: energyOfReactionsSchema,
        systemInstruction:
          "You are an expert chemistry educator creating interactive energy-of-reactions activities " +
          "for grades 5-8. Design engaging activities where students discover why some reactions release " +
          "heat (exothermic) and others absorb heat (endothermic). Use enthalpy diagrams, temperature " +
          "changes, and real-world connections to build intuition. For older students (7-8), include " +
          "bond energy calculations showing that deltaH = energy to break bonds - energy released forming bonds. " +
          "All deltaH values, bond energies, and activation energies should be scientifically accurate. " +
          "Language should be age-appropriate: friendly and concrete for grades 5-6, with proper " +
          "scientific terminology for grades 7-8. Connect every reaction to something students can see " +
          "or experience in daily life (cooking, cold packs, rusting, photosynthesis, combustion).",
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error(
        "No data returned from Gemini API for energy-of-reactions"
      );
    }

    const result = JSON.parse(text) as EnergyOfReactionsData;

    // -----------------------------------------------------------------------
    // Validation & Defaults
    // -----------------------------------------------------------------------

    // Ensure gradeBand
    if (!result.gradeBand || !["5-6", "7-8"].includes(result.gradeBand)) {
      result.gradeBand = gradeBand;
    }

    // Ensure reaction has valid structure
    if (!result.reaction) {
      result.reaction = {
        name: "Combustion of Methane",
        equation: "CH4 + 2O2 \u2192 CO2 + 2H2O",
        type: "exothermic",
        deltaH: -890,
        activationEnergy: 150,
        realWorldExample:
          "Burning natural gas on a stove to cook food",
      };
    }

    // Ensure reaction fields have defaults
    result.reaction = {
      name: result.reaction.name || "Chemical Reaction",
      equation: result.reaction.equation || "A + B \u2192 C",
      type: result.reaction.type || "exothermic",
      deltaH: result.reaction.deltaH ?? -400,
      activationEnergy: result.reaction.activationEnergy ?? 100,
      realWorldExample:
        result.reaction.realWorldExample || "A common everyday reaction",
      imagePrompt: result.reaction.imagePrompt ?? undefined,
    };

    // Ensure deltaH sign matches reaction type
    if (
      result.reaction.type === "exothermic" &&
      result.reaction.deltaH > 0
    ) {
      result.reaction.deltaH = -Math.abs(result.reaction.deltaH);
    } else if (
      result.reaction.type === "endothermic" &&
      result.reaction.deltaH < 0
    ) {
      result.reaction.deltaH = Math.abs(result.reaction.deltaH);
    }

    // Ensure activationEnergy is always positive
    result.reaction.activationEnergy = Math.abs(
      result.reaction.activationEnergy
    );

    // Ensure energyDiagram has valid structure
    if (!result.energyDiagram) {
      const isExo = result.reaction.type === "exothermic";
      result.energyDiagram = {
        reactantLevel: isExo ? 500 : 300,
        productLevel: isExo ? 300 : 500,
        activationPeak: 650,
        showCatalystPath: gradeBand === "7-8",
        catalystActivation: gradeBand === "7-8" ? 550 : null,
      };
    }

    // Ensure activationPeak is higher than both levels
    const maxLevel = Math.max(
      result.energyDiagram.reactantLevel,
      result.energyDiagram.productLevel
    );
    if (result.energyDiagram.activationPeak <= maxLevel) {
      result.energyDiagram.activationPeak = maxLevel + 100;
    }

    // Ensure catalystActivation is between max level and activation peak
    if (
      result.energyDiagram.showCatalystPath &&
      result.energyDiagram.catalystActivation != null
    ) {
      if (result.energyDiagram.catalystActivation >= result.energyDiagram.activationPeak) {
        result.energyDiagram.catalystActivation =
          maxLevel + (result.energyDiagram.activationPeak - maxLevel) * 0.5;
      }
      if (result.energyDiagram.catalystActivation <= maxLevel) {
        result.energyDiagram.catalystActivation = maxLevel + 30;
      }
    }

    // Ensure bondEnergies has valid structure
    if (!result.bondEnergies) {
      result.bondEnergies = {
        enabled: gradeBand === "7-8",
        bondsBreaking: [],
        bondsForming: [],
      };
    }

    // For grade 5-6, force bond energies off
    if (gradeBand === "5-6") {
      result.bondEnergies.enabled = false;
    }

    // Ensure arrays exist
    result.bondEnergies.bondsBreaking = result.bondEnergies.bondsBreaking || [];
    result.bondEnergies.bondsForming = result.bondEnergies.bondsForming || [];

    // Ensure showOptions defaults
    result.showOptions = {
      showEnergyDiagram: result.showOptions?.showEnergyDiagram ?? true,
      showTemperatureGauge: result.showOptions?.showTemperatureGauge ?? true,
      showBondView:
        result.showOptions?.showBondView ?? (gradeBand === "7-8" && result.bondEnergies.enabled),
      showRealWorldPanel: result.showOptions?.showRealWorldPanel ?? true,
      showCalculation:
        result.showOptions?.showCalculation ?? gradeBand === "7-8",
      showCatalystComparison:
        result.showOptions?.showCatalystComparison ??
        (gradeBand === "7-8" && result.energyDiagram.showCatalystPath),
      animateReactionPath: result.showOptions?.animateReactionPath ?? true,
    };

    // Ensure every challenge has required fields
    if (result.challenges) {
      result.challenges = result.challenges.map((ch, idx) => ({
        ...ch,
        id: ch.id || `ch${idx + 1}`,
        type: ch.type || "classify",
        instruction:
          ch.instruction ||
          "Is this reaction exothermic or endothermic?",
        targetAnswer: ch.targetAnswer || result.reaction.type,
        hint:
          ch.hint ||
          "Look at the energy diagram — are the products higher or lower than the reactants?",
        narration: ch.narration || ch.instruction || "Great work!",
      }));
    }

    // Ensure at least one challenge exists
    if (!result.challenges || result.challenges.length === 0) {
      result.challenges = [
        {
          id: "ch1",
          type: "classify",
          instruction:
            result.reaction.type === "exothermic"
              ? "This reaction releases energy. Is it exothermic or endothermic?"
              : "This reaction absorbs energy. Is it exothermic or endothermic?",
          targetAnswer: result.reaction.type,
          hint:
            "Exothermic = energy exits (releases heat). Endothermic = energy enters (absorbs heat).",
          narration:
            result.reaction.type === "exothermic"
              ? "That's right! Exothermic means 'heat out' — the reaction releases energy to its surroundings."
              : "Correct! Endothermic means 'heat in' — the reaction absorbs energy from its surroundings.",
        },
        {
          id: "ch2",
          type: "read_diagram",
          instruction:
            "Look at the energy diagram. Are the products at a higher or lower energy level than the reactants?",
          targetAnswer:
            result.reaction.type === "exothermic" ? "lower" : "higher",
          hint:
            "Compare the right side (products) to the left side (reactants) on the diagram.",
          narration:
            result.reaction.type === "exothermic"
              ? "The products are lower — energy was released! That extra energy became heat."
              : "The products are higher — energy was absorbed! The reaction needed energy from its surroundings.",
        },
        {
          id: "ch3",
          type: "predict",
          instruction:
            `If you touched the container during this reaction, would it feel hot or cold?`,
          targetAnswer:
            result.reaction.type === "exothermic" ? "hot" : "cold",
          hint:
            `Think about whether energy is leaving the reaction (warming things up) or entering it (cooling things down).`,
          narration:
            result.reaction.type === "exothermic"
              ? "It would feel hot! The reaction releases heat energy into its surroundings — including your hand."
              : "It would feel cold! The reaction absorbs heat from its surroundings — pulling warmth away from your hand.",
        },
      ];
    }

    // Apply config overrides if provided
    if (config) {
      if (config.title !== undefined) result.title = config.title;
      if (config.description !== undefined)
        result.description = config.description;
      if (config.reaction !== undefined)
        result.reaction = { ...result.reaction, ...config.reaction };
      if (config.energyDiagram !== undefined)
        result.energyDiagram = { ...result.energyDiagram, ...config.energyDiagram };
      if (config.bondEnergies !== undefined)
        result.bondEnergies = { ...result.bondEnergies, ...config.bondEnergies };
      if (config.challenges !== undefined)
        result.challenges = config.challenges;
      if (config.showOptions !== undefined)
        result.showOptions = { ...result.showOptions, ...config.showOptions };
      if (config.gradeBand !== undefined) result.gradeBand = config.gradeBand;
    }

    console.log("\u26A1 Energy of Reactions Generated:", {
      title: result.title,
      gradeBand: result.gradeBand,
      reactionName: result.reaction.name,
      reactionType: result.reaction.type,
      deltaH: result.reaction.deltaH,
      activationEnergy: result.reaction.activationEnergy,
      challengeCount: result.challenges?.length ?? 0,
      bondEnergiesEnabled: result.bondEnergies.enabled,
      showCatalystPath: result.energyDiagram.showCatalystPath,
    });

    return result;
  } catch (error) {
    console.error("Error generating energy-of-reactions data:", error);
    throw error;
  }
};
