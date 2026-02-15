import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import {
  ReactionLabData,
  Substance,
  ReactionChallenge,
  ReactionAnimation,
  ReactionNotebook,
} from "../../primitives/visual-primitives/chemistry/ReactionLab";

// Re-export types for convenience (no redefinition — sourced from the component)
export type {
  ReactionLabData,
  Substance,
  ReactionChallenge,
  ReactionAnimation,
  ReactionNotebook,
};

/**
 * Schema definition for Reaction Lab Data
 *
 * Describes the JSON structure Gemini must return:
 * - experiment: name, category, safetyLevel, realWorldConnection
 * - substances: array of reagents with state, color, formula, amounts
 * - reaction: type, signs, reversibility, equation, energy change, particle description
 * - animation: realView (effects, duration) and particleView (molecules, bonds)
 * - challenges: sequenced predict → observe → explain tasks
 * - notebook: prompts for prediction, observation, and explanation
 * - showOptions: UI toggles for particle view, equation, safety, etc.
 * - gradeBand: K-2, 3-5, or 6-8
 */
const reactionLabSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description:
        "Short, engaging title for the experiment (e.g. 'Volcano in a Cup')",
    },
    description: {
      type: Type.STRING,
      description: "One-sentence experiment description in kid-friendly language",
    },
    experiment: {
      type: Type.OBJECT,
      properties: {
        name: {
          type: Type.STRING,
          description: "Full name of the experiment",
        },
        category: {
          type: Type.STRING,
          enum: [
            "acid_base",
            "decomposition",
            "oxidation",
            "dissolution",
            "physical_change",
            "density",
            "combustion",
          ],
          description: "Category of the reaction or change",
        },
        safetyLevel: {
          type: Type.STRING,
          enum: ["safe", "caution", "supervised"],
          description:
            "Safety level: safe (no risk), caution (mild risk), supervised (adult needed)",
        },
        realWorldConnection: {
          type: Type.STRING,
          description:
            "A real-world example of this reaction (e.g. 'This is how antacid tablets work in your stomach!')",
        },
      },
      required: ["name", "category", "safetyLevel", "realWorldConnection"],
    },
    substances: {
      type: Type.ARRAY,
      description: "2-4 substances involved in the reaction",
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique identifier, e.g. 'sub-baking-soda'",
          },
          name: {
            type: Type.STRING,
            description: "Common name kids would use (e.g. 'baking soda')",
          },
          formula: {
            type: Type.STRING,
            description:
              "Chemical formula (e.g. 'NaHCO₃') or null for younger grades",
            nullable: true,
          },
          state: {
            type: Type.STRING,
            enum: ["solid", "liquid", "gas", "solution"],
            description: "Physical state of the substance",
          },
          color: {
            type: Type.STRING,
            description: "Observable color of the substance",
          },
          safetyInfo: {
            type: Type.STRING,
            description:
              "Brief safety note (e.g. 'Do not taste' or 'Wash hands after')",
          },
          imagePrompt: {
            type: Type.STRING,
            description:
              "Short prompt for generating a real-world photo of this substance",
          },
          amount: {
            type: Type.STRING,
            description:
              "Amount used in the experiment (e.g. '2 tablespoons', '100 mL')",
          },
        },
        required: [
          "id",
          "name",
          "state",
          "color",
          "safetyInfo",
          "amount",
        ],
      },
    },
    reaction: {
      type: Type.OBJECT,
      properties: {
        type: {
          type: Type.STRING,
          enum: ["chemical", "physical"],
          description: "Whether this is a chemical or physical change",
        },
        signs: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
            enum: [
              "fizzing",
              "color_change",
              "temperature_change",
              "gas_produced",
              "precipitate",
              "light",
              "odor",
            ],
          },
          description: "Observable signs of change during the reaction",
        },
        isReversible: {
          type: Type.BOOLEAN,
          description: "Whether the reaction can be reversed",
        },
        equation: {
          type: Type.STRING,
          description:
            "Chemical equation (e.g. 'NaHCO₃ + CH₃COOH → NaCH₃COO + H₂O + CO₂') or null for K-2",
          nullable: true,
        },
        energyChange: {
          type: Type.STRING,
          enum: ["exothermic", "endothermic", "neutral"],
          description: "Whether the reaction releases or absorbs energy",
        },
        particleDescription: {
          type: Type.STRING,
          description:
            "Kid-friendly explanation of what happens at the particle level",
        },
      },
      required: [
        "type",
        "signs",
        "isReversible",
        "energyChange",
        "particleDescription",
      ],
    },
    animation: {
      type: Type.OBJECT,
      properties: {
        realView: {
          type: Type.OBJECT,
          properties: {
            duration: {
              type: Type.NUMBER,
              description: "Duration of the reaction animation in seconds",
            },
            effects: {
              type: Type.ARRAY,
              items: {
                type: Type.STRING,
                enum: [
                  "bubbles",
                  "foam",
                  "colorShift",
                  "steamRise",
                  "precipitate",
                  "glow",
                  "explosion",
                ],
              },
              description: "Visual effects to show during the reaction",
            },
            temperatureChange: {
              type: Type.NUMBER,
              description:
                "Temperature change in °C (positive = hotter, negative = cooler) or null",
              nullable: true,
            },
          },
          required: ["duration", "effects"],
        },
        particleView: {
          type: Type.OBJECT,
          properties: {
            reactantMolecules: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description:
                "List of reactant molecule formulas or names (e.g. ['NaHCO₃', 'CH₃COOH'])",
            },
            productMolecules: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description:
                "List of product molecule formulas or names (e.g. ['NaCH₃COO', 'H₂O', 'CO₂'])",
            },
            bondBreaking: {
              type: Type.BOOLEAN,
              description: "Whether bonds break during the reaction",
            },
            bondForming: {
              type: Type.BOOLEAN,
              description: "Whether new bonds form during the reaction",
            },
          },
          required: [
            "reactantMolecules",
            "productMolecules",
            "bondBreaking",
            "bondForming",
          ],
        },
      },
      required: ["realView", "particleView"],
    },
    challenges: {
      type: Type.ARRAY,
      description:
        "3-5 sequenced challenges: predict → observe → explain/classify/balance",
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
              "predict",
              "observe",
              "explain",
              "classify",
              "balance",
              "identify_signs",
              "conservation",
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
        required: [
          "id",
          "type",
          "instruction",
          "targetAnswer",
          "hint",
          "narration",
        ],
      },
    },
    notebook: {
      type: Type.OBJECT,
      properties: {
        predictPrompt: {
          type: Type.STRING,
          description:
            "Prompt asking the student to predict what will happen (e.g. 'What do you think will happen when we mix baking soda and vinegar?')",
        },
        observePrompts: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description:
            "2-4 observation prompts (e.g. 'What did you see?', 'Did the temperature change?', 'What color is the mixture now?')",
        },
        explainPrompt: {
          type: Type.STRING,
          description:
            "Prompt asking the student to explain what happened and why",
        },
      },
      required: ["predictPrompt", "observePrompts", "explainPrompt"],
    },
    showOptions: {
      type: Type.OBJECT,
      description: "Which UI panels to enable for this activity",
      properties: {
        showParticleView: {
          type: Type.BOOLEAN,
          description:
            "Show the particle/molecular view of the reaction (true for grades 3+)",
        },
        showEquation: {
          type: Type.BOOLEAN,
          description:
            "Show the chemical equation (true for grades 6-8)",
        },
        showSafetyBadge: {
          type: Type.BOOLEAN,
          description: "Show the safety level badge",
        },
        showTemperatureGauge: {
          type: Type.BOOLEAN,
          description:
            "Show the temperature change indicator during reaction",
        },
        showObservationNotebook: {
          type: Type.BOOLEAN,
          description: "Show the observation notebook in the observe phase",
        },
        showConservationCounter: {
          type: Type.BOOLEAN,
          description:
            "Show the conservation of mass counter (true for grades 6-8)",
        },
      },
    },
    imagePrompt: {
      type: Type.STRING,
      description:
        "Prompt for generating an image of the overall experiment setup",
    },
    gradeBand: {
      type: Type.STRING,
      enum: ["K-2", "3-5", "6-8"],
      description: "Target grade band for content complexity",
    },
  },
  required: [
    "title",
    "description",
    "experiment",
    "substances",
    "reaction",
    "animation",
    "challenges",
    "notebook",
    "showOptions",
    "gradeBand",
  ],
};

/**
 * Determine the grade band from grade level context string
 */
const resolveGradeBand = (gradeLevel: string): "K-2" | "3-5" | "6-8" => {
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
  if (
    gl.includes("6") ||
    gl.includes("7") ||
    gl.includes("8") ||
    gl.includes("middle")
  ) {
    return "6-8";
  }
  // Default to 3-5 for elementary, grades 3-5, etc.
  return "3-5";
};

/**
 * Generate Reaction Lab data using Gemini
 *
 * Creates an interactive virtual experiment where students combine real substances
 * and observe reactions through a multi-phase workflow: predict → experiment → observe → explain.
 *
 * Grade-appropriate content:
 * - K-2: Kitchen chemistry, simple observations, no formulas
 * - 3-5: Predict-observe-explain cycle, signs of change, particle view
 * - 6-8: Chemical equations, balancing, conservation of mass, energy changes
 *
 * @param topic - The topic or theme for the experiment (e.g. "acids and bases", "kitchen chemistry")
 * @param gradeLevel - Grade level context string
 * @param config - Optional config with intent override
 * @returns ReactionLabData ready for the ReactionLab component
 */
export const generateReactionLab = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<{ intent: string }>
): Promise<ReactionLabData> => {
  const intent = config?.intent || "";
  const gradeBand = resolveGradeBand(gradeLevel);

  const gradeBandDescriptions: Record<string, string> = {
    "K-2":
      "Kindergarten to 2nd grade. Use familiar kitchen chemistry experiments: baking soda + vinegar, dissolving candy in water, milk + food coloring + dish soap, dissolving sugar, melting ice with salt. " +
      "Keep language very simple. Use ONLY observations — no chemical formulas, no equations. " +
      "Focus on 'what do you see/hear/feel?' questions. " +
      "Challenges should be simple predict and observe types.",
    "3-5":
      "3rd to 5th grade. Use the Predict-Observe-Explain (POE) cycle explicitly. " +
      "Introduce signs of chemical change (fizzing, color change, temperature change, gas produced, new smell). " +
      "Use 'reactants' and 'products' language. Show the particle view to visualize molecular changes. " +
      "Include classify challenges (chemical vs physical change). " +
      "Formulas are optional but particle names should be shown. " +
      "Challenges should include predict, observe, identify_signs, and classify types.",
    "6-8":
      "6th to 8th grade. Include proper chemical equations with formulas. " +
      "Include balancing challenges. Discuss conservation of mass explicitly. " +
      "Cover reaction types (acid-base, decomposition, oxidation, etc.). " +
      "Include energy change (exothermic vs endothermic) with temperature data. " +
      "Challenges should include predict, observe, explain, classify, balance, and conservation types. " +
      "Particle view must show correct reactant and product molecules.",
  };

  const generationPrompt = `Create a Reaction Lab experiment about "${topic}" for ${gradeBand} students.
${intent ? `\nTeaching intent: ${intent}` : ""}

GRADE BAND REQUIREMENTS (${gradeBand}):
${gradeBandDescriptions[gradeBand]}

GENERAL REQUIREMENTS:
1. Choose a REAL, safe experiment that students could actually perform (or safely simulate virtually).
2. Include 2-4 substances with accurate physical descriptions (state, color, amount).
3. The reaction must have at least 2 observable signs of change.
4. Always include a realWorldConnection — explain where this reaction happens in everyday life.
5. Provide 3-5 challenges sequenced by difficulty:
   - Start with a "predict" challenge (what do you think will happen?)
   - Middle challenges: "observe", "identify_signs", or "classify"
   - End with harder challenges: "explain", "balance", or "conservation"
6. Every narration field should be wonder-driven (e.g. "Amazing! You just witnessed a chemical reaction — the same kind that makes bread rise!").
7. Animation effects should match the actual reaction (e.g. acid-base → bubbles + foam, oxidation → colorShift).
8. Temperature change should be realistic (e.g. exothermic reactions: +5 to +30°C, endothermic: -5 to -20°C).
9. Safety level must be accurate: most kitchen chemistry is "safe", anything with heat or fumes is "caution" or "supervised".
10. Set showOptions appropriately:
    - showParticleView: false for K-2, true for 3-5 and 6-8
    - showEquation: false for K-2 and 3-5, true for 6-8
    - showSafetyBadge: always true
    - showTemperatureGauge: true if the reaction has a temperature change
    - showObservationNotebook: always true
    - showConservationCounter: false for K-2 and 3-5, true for 6-8
11. Notebook prompts should guide structured scientific thinking:
    - predictPrompt: Wonder-filled question about what might happen
    - observePrompts: 2-4 specific observation questions (sight, sound, temperature, smell)
    - explainPrompt: Age-appropriate "why did this happen?" question
12. For K-2: formula fields should be null. equation should be null.
    For 3-5: formula fields are optional. equation is optional.
    For 6-8: formula and equation fields are required.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: reactionLabSchema,
        systemInstruction:
          "You are an expert chemistry educator creating interactive virtual experiment activities for K-8 students. " +
          "Design safe, engaging experiments that follow the scientific method: predict → experiment → observe → explain. " +
          "Use accurate chemistry — states of matter, reaction types, signs of chemical change, and conservation of mass must be correct. " +
          "Language should be age-appropriate: simple wonder-filled phrasing for young children, precise scientific vocabulary for older students. " +
          "Every experiment should connect to real-world applications so students see chemistry in their daily lives. " +
          "Safety information must be realistic and responsible. " +
          "Always sequence challenges from easiest (predict) to hardest (balance/conservation).",
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API for reaction-lab");
    }

    const result = JSON.parse(text) as ReactionLabData;

    // -----------------------------------------------------------------------
    // Validation & Defaults
    // -----------------------------------------------------------------------

    // Ensure gradeBand
    if (!result.gradeBand || !["K-2", "3-5", "6-8"].includes(result.gradeBand)) {
      result.gradeBand = gradeBand;
    }

    // Ensure showOptions defaults
    result.showOptions = {
      showParticleView:
        result.showOptions?.showParticleView ?? gradeBand !== "K-2",
      showEquation:
        result.showOptions?.showEquation ?? gradeBand === "6-8",
      showSafetyBadge: result.showOptions?.showSafetyBadge ?? true,
      showTemperatureGauge:
        result.showOptions?.showTemperatureGauge ??
        (result.reaction?.energyChange !== "neutral"),
      showObservationNotebook:
        result.showOptions?.showObservationNotebook ?? true,
      showConservationCounter:
        result.showOptions?.showConservationCounter ?? gradeBand === "6-8",
    };

    // Ensure every substance has required fields with safe defaults
    if (result.substances) {
      result.substances = result.substances.map((sub, idx) => ({
        ...sub,
        id: sub.id || `sub-${idx}`,
        name: sub.name || `Substance ${idx + 1}`,
        formula: sub.formula ?? null,
        state: sub.state || "liquid",
        color: sub.color || "clear",
        safetyInfo: sub.safetyInfo || "Handle with care",
        amount: sub.amount || "a small amount",
      }));
    }

    // Ensure reaction defaults
    if (result.reaction) {
      result.reaction = {
        ...result.reaction,
        type: result.reaction.type || "chemical",
        signs: result.reaction.signs?.length ? result.reaction.signs : ["fizzing"],
        isReversible: result.reaction.isReversible ?? false,
        equation: result.reaction.equation ?? null,
        energyChange: result.reaction.energyChange || "neutral",
        particleDescription:
          result.reaction.particleDescription ||
          "The tiny particles rearrange to form something new!",
      };
    }

    // Ensure animation defaults
    if (result.animation) {
      result.animation = {
        realView: {
          duration: result.animation.realView?.duration ?? 3,
          effects: result.animation.realView?.effects?.length
            ? result.animation.realView.effects
            : ["bubbles"],
          temperatureChange:
            result.animation.realView?.temperatureChange ?? null,
        },
        particleView: {
          reactantMolecules:
            result.animation.particleView?.reactantMolecules ?? [],
          productMolecules:
            result.animation.particleView?.productMolecules ?? [],
          bondBreaking:
            result.animation.particleView?.bondBreaking ?? false,
          bondForming:
            result.animation.particleView?.bondForming ?? false,
        },
      };
    }

    // Ensure every challenge has required fields
    if (result.challenges) {
      result.challenges = result.challenges.map((ch, idx) => ({
        ...ch,
        id: ch.id || `challenge-${idx}`,
        type: ch.type || "predict",
        instruction: ch.instruction || "What do you think will happen?",
        targetAnswer: ch.targetAnswer || "",
        narration: ch.narration || ch.instruction || "",
        hint: ch.hint || "Think about what you already know!",
      }));
    }

    // Ensure notebook defaults
    if (result.notebook) {
      result.notebook = {
        predictPrompt:
          result.notebook.predictPrompt ||
          "What do you think will happen when we mix these substances together?",
        observePrompts:
          result.notebook.observePrompts?.length
            ? result.notebook.observePrompts
            : ["What did you see?", "Did anything change?"],
        explainPrompt:
          result.notebook.explainPrompt ||
          "Why do you think this happened?",
      };
    }

    console.log("🧪 Reaction Lab Generated:", {
      title: result.title,
      gradeBand: result.gradeBand,
      category: result.experiment?.category,
      substanceCount: result.substances?.length ?? 0,
      challengeCount: result.challenges?.length ?? 0,
      reactionType: result.reaction?.type,
      signs: result.reaction?.signs,
      energyChange: result.reaction?.energyChange,
    });

    return result;
  } catch (error) {
    console.error("Error generating reaction lab data:", error);
    throw error;
  }
};
