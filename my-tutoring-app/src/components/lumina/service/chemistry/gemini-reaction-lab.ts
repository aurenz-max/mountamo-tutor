import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";
import {
  ReactionLabData,
  Substance,
  ReactionChallenge,
  ReactionAnimation,
  ReactionNotebook,
  ChallengeOption,
} from "../../primitives/visual-primitives/chemistry/ReactionLab";

// Re-export types for convenience (no redefinition — sourced from the component)
export type {
  ReactionLabData,
  Substance,
  ReactionChallenge,
  ReactionAnimation,
  ReactionNotebook,
  ChallengeOption,
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
        "3-5 sequenced challenges: predict → observe → explain/classify/balance. " +
        "Use multiple-choice options for predict, observe, explain, balance, and identify_signs challenges. " +
        "Use isTrueFalse for conservation challenges. " +
        "classify has built-in Chemical/Physical buttons (no options needed). " +
        "Only use open-ended textarea (no options, no isTrueFalse) when none of the above apply.",
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
          options: {
            type: Type.ARRAY,
            description:
              "Multiple-choice options (3-4 choices). Required for predict, observe, explain, balance, and identify_signs challenges. " +
              "Omit for classify (has built-in Chemical/Physical buttons) and conservation (use isTrueFalse).",
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
              "Set to true for conservation challenges to render True/False buttons instead of textarea.",
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
        predictionOptions: {
          type: Type.ARRAY,
          description:
            "3-4 multiple-choice prediction options. Always provide these so students pick from choices instead of typing. " +
            "One option should be the correct prediction, others should be plausible but wrong.",
          items: {
            type: Type.OBJECT,
            properties: {
              id: {
                type: Type.STRING,
                description: "Option identifier (A, B, C, D)",
              },
              text: {
                type: Type.STRING,
                description: "The prediction text the student sees",
              },
            },
            required: ["id", "text"],
          },
        },
        correctPredictionId: {
          type: Type.STRING,
          description:
            "The id of the correct prediction option (e.g. 'B'). Required when predictionOptions are provided.",
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
      required: ["predictPrompt", "predictionOptions", "correctPredictionId", "observePrompts", "explainPrompt"],
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
 * The challenge types, as the catalog's eval modes group them: predict = `predict` (answered before mixing);
 * observe = `observe`, `identify_signs`, `classify` (read off the reaction); explain = `explain`, `balance`,
 * `conservation` (why it happened). A pinned mode or blend narrows the schema enum and the kept challenges.
 */
const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  predict: {
    promptDoc: '"predict": asked BEFORE the substances are mixed: what will happen when they are mixed. 3-4 options, one right. The instruction never says or hints what happens (no "all that foam", "the bubbles").',
    schemaDescription: "'predict' (what will happen, asked before mixing)",
  },
  observe: {
    promptDoc: '"observe": asked AFTER the reaction is shown: what the learner saw. Every option describes something a beaker could show; the right one matches the animation effects and temperature change. 3-4 options.',
    schemaDescription: "'observe' (what was seen)",
  },
  identify_signs: {
    promptDoc: '"identify_signs": which signs of change happened. 3-4 options, each a set of signs; only one matches reaction.signs.',
    schemaDescription: "'identify_signs' (which signs of change happened)",
  },
  classify: {
    promptDoc: '"classify": was this a chemical or a physical change. No options (the screen has Chemical Change / Physical Change buttons); targetAnswer "chemical" or "physical", matching reaction.type.',
    schemaDescription: "'classify' (chemical or physical change)",
  },
  explain: {
    promptDoc: '"explain": why the reaction happened, at the particle level. 3-4 options, one right; never reuse the wording of particleDescription in the right option.',
    schemaDescription: "'explain' (why it happened)",
  },
  balance: {
    promptDoc: '"balance" (grades 6-8 only): which equation is balanced. 3-4 equation options, exactly one balanced.',
    schemaDescription: "'balance' (which equation is balanced)",
  },
  conservation: {
    promptDoc: '"conservation": a true/false statement about mass or atoms before and after (isTrueFalse true, correctBoolean set).',
    schemaDescription: "'conservation' (true/false about mass)",
  },
};

/**
 * Challenge types a kindergartner is never asked (RXL-K1). The chemical/physical distinction is grade 2
 * (2-PS1-4); balance and conservation are 6-8. A K probe served "physical change or chemical change?".
 */
export const K_EXCLUDED_REACTION_TYPES = ["classify", "balance", "conservation"];

/** True for a kindergarten objective: canonical grade first, then the normalized grade key. */
export function isKindergartenReaction(grade: string | undefined, gradeLevel: string): boolean {
  const g = (grade ?? "").trim().toUpperCase();
  if (g) return g === "K" || g === "KINDERGARTEN" || g === "0";
  return /kinder|preschool/i.test(gradeLevel ?? "");
}

/** The challenge types a pin allows: one mode, a blend ('a|b'), or null for mixed / no pin. */
function pinnedChallengeTypes(targetEvalMode: string | undefined): { types: string[]; label: string } | null {
  const keys = (targetEvalMode ?? "").split("|").map((k) => k.trim()).filter((k) => k && k !== "mixed");
  const resolved = keys.map((k) => resolveEvalModeConstraint("reaction-lab", k, CHALLENGE_TYPE_DOCS)).filter((c) => !!c);
  if (!resolved.length) return null;
  logEvalModeResolution("ReactionLab", targetEvalMode, resolved[0]);
  return {
    types: Array.from(new Set(resolved.flatMap((c) => c!.allowedTypes))),
    label: resolved.map((c) => `${c!.definition.label}: ${c!.definition.description}`).join("; "),
  };
}

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
 * Canonical-grade → band mapper (systemic 14m). The prose test above matches
 * none of its K-2 markers in the production elementary sentence ("grades 1-5"),
 * so published G1/G2 lessons landed the 3-5 band. Canonical grade wins when
 * present; null keeps the prose fallback reachable (never deleted).
 */
export function reactionLabGradeBandFromGrade(grade?: string): "K-2" | "3-5" | "6-8" | null {
  if (!grade) return null;
  const g = grade.trim().toUpperCase();
  if (g === "K") return "K-2";
  const n = parseInt(g, 10);
  if (isNaN(n)) return null;
  if (n <= 2) return "K-2";
  if (n <= 5) return "3-5";
  return "6-8";
}

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
export const generateReactionLab = async (ctx: GenerationContext): Promise<ReactionLabData> => {
  const { topic } = ctx;
  const gradeLevel = ctx.gradeContext;
  const intent = ctx.intent || "";
  // Canonical objective grade wins; the prose parser is only the fallback (14m).
  const canonicalBand = reactionLabGradeBandFromGrade(ctx.grade);
  const gradeBand = canonicalBand ?? resolveGradeBand(gradeLevel);

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

  const isK = isKindergartenReaction(ctx.grade, ctx.gradeLevel);
  const pinnedRaw = pinnedChallengeTypes(ctx.targetEvalMode);
  // At K the excluded types leave every mode; a pin that keeps nothing falls back to the K-allowed set.
  const kTypes = (types: string[]) => types.filter((t) => !K_EXCLUDED_REACTION_TYPES.includes(t));
  const pinned = pinnedRaw && isK
    ? (kTypes(pinnedRaw.types).length ? { ...pinnedRaw, types: kTypes(pinnedRaw.types) } : null)
    : pinnedRaw;
  const allowedTypes = pinned?.types ?? (isK ? kTypes(Object.keys(CHALLENGE_TYPE_DOCS)) : null);
  const kindergartenRule = isK
    ? `
KINDERGARTEN RULES (override the band text above):
- Never use the words "chemical change", "physical change", "reaction", "atoms", "molecules" or "particles" anywhere a child sees or hears.
- Every challenge has 3 short picture-able options a tutor can read aloud. No typed answers.
- "explain" asks why in a child's words (e.g. "the soap pushed the colours away"), never at the particle level.`
    : "";
  const challengeRule = pinned
    ? `5. Provide 3-5 challenges, EVERY one of type ${pinned.types.map((t) => `"${t}"`).join(" or ")} (eval mode ${pinned.label}). No other challenge type.
${pinned.types.map((t) => `   - ${CHALLENGE_TYPE_DOCS[t]?.promptDoc ?? t}`).join("\n")}`
    : isK
      ? `5. Provide 3-4 challenges: start with a "predict" challenge, then "observe" or "identify_signs", and at most one "explain". Never "classify", "balance" or "conservation".`
      : `5. Provide 3-5 challenges sequenced by difficulty:
   - Start with a "predict" challenge (what do you think will happen?)
   - Middle challenges: "observe", "identify_signs", or "classify"
   - End with harder challenges: "explain", "balance", or "conservation"`;
  const schema = allowedTypes ? constrainChallengeTypeEnum(reactionLabSchema, allowedTypes, CHALLENGE_TYPE_DOCS) : reactionLabSchema;

  const generationPrompt = `Create a Reaction Lab experiment about "${topic}" for ${gradeBand} students.
${intent ? `\nTeaching intent: ${intent}` : ""}

GRADE BAND REQUIREMENTS (${gradeBand}):
${gradeBandDescriptions[gradeBand]}
${kindergartenRule}

GENERAL REQUIREMENTS:
1. Choose a REAL, safe experiment that students could actually perform (or safely simulate virtually).
2. Include 2-4 substances with accurate physical descriptions (state, color, amount).
3. The reaction must have at least 2 observable signs of change.
4. Always include a realWorldConnection — explain where this reaction happens in everyday life.
   The title names the materials, never the result: "Soap and Milk", not "Baking Soda Volcano" or "Fizz Explosion" (the predict challenge asks what will happen).
${challengeRule}
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
    - predictionOptions: ALWAYS provide 3-4 multiple-choice prediction options. One correct, others plausible but wrong.
      Example: [{id:"A", text:"Bubbles will form and overflow"}, {id:"B", text:"The color will change to green"}, {id:"C", text:"Nothing will happen"}, {id:"D", text:"It will get very cold"}].
      Set correctPredictionId to the correct option id (e.g. "A").
    - observePrompts: 2-4 specific observation questions (sight, sound, temperature, smell)
    - explainPrompt: Age-appropriate "why did this happen?" question
12. For K-2: formula fields should be null. equation should be null.
    For 3-5: formula fields are optional. equation is optional.
    For 6-8: formula and equation fields are required.

CHALLENGE SCAFFOLDING (IMPORTANT):
Use the right answer format for each challenge type:
- predict: Provide "options" with 3-4 multiple-choice predictions of what will happen.
  Example: [{id:"A", text:"Bubbles will form and it will fizz"}, {id:"B", text:"The color will change to blue"}, {id:"C", text:"Nothing will happen"}, {id:"D", text:"It will explode"}].
  Set correctOptionId to the correct option id. Still set targetAnswer for fallback.
- observe: Provide "options" with 3-4 choices about what was observed.
  Example: [{id:"A", text:"The mixture turned cloudy and warm"}, {id:"B", text:"Bubbles formed and it fizzed"}, {id:"C", text:"Nothing happened"}].
  Set correctOptionId to the correct option id.
- explain: Provide "options" with 3-4 explanations of why the reaction happened.
  Example: [{id:"A", text:"The acid broke apart the baking soda molecules"}, {id:"B", text:"The water dissolved the powder"}, {id:"C", text:"The heat melted the substances"}].
  Set correctOptionId to the correct option id.
- classify: No options needed (the UI has built-in Chemical Change / Physical Change buttons). Set targetAnswer to "chemical" or "physical".
- balance: Provide "options" with 3-4 equation choices (only one is correctly balanced).
  Example: [{id:"A", text:"2H₂ + O₂ → 2H₂O"}, {id:"B", text:"H₂ + O₂ → H₂O"}, {id:"C", text:"2H₂ + 2O₂ → 2H₂O"}].
  Set correctOptionId to the correct option id.
- identify_signs: Provide "options" with 3-4 sets of signs, only one list is fully correct.
  Example: [{id:"A", text:"Fizzing and temperature change"}, {id:"B", text:"Color change and new smell"}, {id:"C", text:"No observable changes"}].
  Set correctOptionId to the correct option id.
- conservation: Set "isTrueFalse" to true and "correctBoolean" to the correct answer (true/false).
  Frame the instruction as a true/false statement (e.g. "The total mass of products equals the total mass of reactants.").`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
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
    // With a canonical grade the band is NOT the LLM's choice — code stamps it
    // (14m); the backstop only fixes invalid stamps on the legacy no-grade path.
    if (canonicalBand) {
      result.gradeBand = canonicalBand;
    } else if (!result.gradeBand || !["K-2", "3-5", "6-8"].includes(result.gradeBand)) {
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
      result.challenges = result.challenges.map((ch, idx) => {
        const challenge = {
          ...ch,
          id: ch.id || `challenge-${idx}`,
          type: ch.type || "predict",
          instruction: ch.instruction || "What do you think will happen?",
          targetAnswer: ch.targetAnswer || "",
          narration: ch.narration || ch.instruction || "",
          hint: ch.hint || "Think about what you already know!",
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

        // The key and the model's own statement of the answer must agree. Seen 2026-10-15 (explain payload): key "A"
        // ("dissolved the powder") while targetAnswer "Atoms rearranged to form a new gas" was option B. When another
        // option alone shares clearly more words with targetAnswer than the keyed one, it is the key.
        if (challenge.options && challenge.options.length > 1 && challenge.correctOptionId && challenge.targetAnswer) {
          const words = (t: string) => new Set(t.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3));
          const target = words(challenge.targetAnswer);
          const overlap = (t: string) => Array.from(words(t)).filter((w) => target.has(w)).length;
          const scored = challenge.options.map((o) => ({ id: o.id, n: overlap(o.text) })).sort((a, b) => b.n - a.n);
          const keyed = scored.find((s) => s.id === challenge.correctOptionId)?.n ?? 0;
          if (scored[0].id !== challenge.correctOptionId && scored[0].n >= 2 && scored[0].n > scored[1].n && scored[0].n > keyed) {
            console.warn(`[ReactionLab] ${challenge.id}: key ${challenge.correctOptionId} disagreed with targetAnswer; re-keyed to ${scored[0].id}`);
            challenge.correctOptionId = scored[0].id;
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

    // A pinned mode keeps only its own challenge types (the schema enum already asks for them); at K the
    // excluded types are dropped whatever the pin.
    if (allowedTypes && result.challenges) {
      result.challenges = result.challenges.filter((c) => allowedTypes.includes(c.type));
      if (!result.challenges.length) {
        throw new Error(`reaction-lab: no ${allowedTypes.join("/")} challenge generated${isK ? " for kindergarten" : " for the pinned mode"}`);
      }
    }

    // Ensure notebook defaults
    if (result.notebook) {
      result.notebook = {
        predictPrompt:
          result.notebook.predictPrompt ||
          "What do you think will happen when we mix these substances together?",
        predictionOptions: result.notebook.predictionOptions?.length
          ? result.notebook.predictionOptions
          : undefined,
        correctPredictionId: result.notebook.correctPredictionId || undefined,
        observePrompts:
          result.notebook.observePrompts?.length
            ? result.notebook.observePrompts
            : ["What did you see?", "Did anything change?"],
        explainPrompt:
          result.notebook.explainPrompt ||
          "Why do you think this happened?",
      };

      // Ensure correctPredictionId is set when predictionOptions are present
      if (result.notebook.predictionOptions && result.notebook.predictionOptions.length > 0 && !result.notebook.correctPredictionId) {
        result.notebook.correctPredictionId = result.notebook.predictionOptions[0].id;
      }
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
