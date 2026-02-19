import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import {
  MixingAndDissolvingData,
} from "../../primitives/visual-primitives/chemistry/MixingAndDissolving";

// Re-export type for convenience (no redefinition — sourced from the component)
export type { MixingAndDissolvingData };

/**
 * Schema definition for Mixing and Dissolving Data
 *
 * Describes the JSON structure Gemini must return:
 * - solvent: the liquid students dissolve things in (name, formula, volume, temperature)
 * - substances: array of solutes/insolubles/immiscibles to test
 * - separationMethods: recovery techniques with descriptions
 * - challenges: sequenced dissolving/mixing challenges
 * - showOptions: UI toggles for particle view, concentration meter, etc.
 * - gradeBand: 3-5 or 6-7
 */
const mixingAndDissolvingSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description:
        "Short, engaging title for the activity (e.g. 'Kitchen Dissolving Lab')",
    },
    description: {
      type: Type.STRING,
      description:
        "One-sentence activity description in kid-friendly language",
    },
    solvent: {
      type: Type.OBJECT,
      description: "The liquid (solvent) students will dissolve substances in",
      properties: {
        name: {
          type: Type.STRING,
          description: "Name of the solvent (e.g. 'Water')",
        },
        formula: {
          type: Type.STRING,
          description: "Chemical formula (e.g. 'H2O')",
        },
        volume: {
          type: Type.NUMBER,
          description: "Volume in millilitres (e.g. 200)",
        },
        temperature: {
          type: Type.NUMBER,
          description: "Starting temperature in degrees Celsius (e.g. 20)",
        },
      },
      required: ["name", "formula", "volume", "temperature"],
    },
    substances: {
      type: Type.ARRAY,
      description:
        "4-6 substances for students to test. Include a mix of soluble, insoluble, partially_soluble, and immiscible_liquid types.",
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique identifier (e.g. 'salt', 'sand')",
          },
          name: {
            type: Type.STRING,
            description: "Display name (e.g. 'Table Salt')",
          },
          formula: {
            type: Type.STRING,
            description:
              "Chemical formula or null if not applicable (e.g. 'NaCl')",
            nullable: true,
          },
          type: {
            type: Type.STRING,
            enum: [
              "soluble",
              "insoluble",
              "partially_soluble",
              "immiscible_liquid",
            ],
            description: "How the substance behaves when added to the solvent",
          },
          maxSolubility: {
            type: Type.NUMBER,
            description:
              "Maximum grams that dissolve per 100 mL of solvent at room temperature, or null for insoluble/immiscible",
            nullable: true,
          },
          solubilityVsTemp: {
            type: Type.STRING,
            enum: ["increases", "decreases", "unchanged"],
            description:
              "How solubility changes with temperature",
          },
          color: {
            type: Type.STRING,
            description:
              "CSS colour for the substance in the beaker (e.g. '#ffffff', 'rgba(255,180,0,0.5)')",
          },
          particleColor: {
            type: Type.STRING,
            description:
              "CSS colour for particles in the particle view (e.g. '#ff6b35')",
          },
          imagePrompt: {
            type: Type.STRING,
            description:
              "Optional prompt for generating an image of the substance",
          },
        },
        required: [
          "id",
          "name",
          "formula",
          "type",
          "maxSolubility",
          "solubilityVsTemp",
          "color",
          "particleColor",
        ],
      },
    },
    separationMethods: {
      type: Type.ARRAY,
      description:
        "2-4 separation methods students can use to recover dissolved or mixed substances",
      items: {
        type: Type.OBJECT,
        properties: {
          method: {
            type: Type.STRING,
            enum: [
              "filtration",
              "evaporation",
              "distillation",
              "chromatography",
              "magnet",
              "decanting",
            ],
            description: "The separation technique",
          },
          worksFor: {
            type: Type.ARRAY,
            description:
              "Names of substances this method can recover from the mixture",
            items: { type: Type.STRING },
          },
          description: {
            type: Type.STRING,
            description:
              "Kid-friendly explanation of how this method works",
          },
          animation: {
            type: Type.STRING,
            description:
              "Short description of the visual animation for this method (e.g. 'liquid boils away leaving crystals')",
          },
        },
        required: ["method", "worksFor", "description", "animation"],
      },
    },
    challenges: {
      type: Type.ARRAY,
      description:
        "3-6 sequenced challenges progressing in difficulty: dissolve_sort → particle_explain → factor_test → saturation → separate → concentration",
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
              "dissolve_sort",
              "particle_explain",
              "factor_test",
              "saturation",
              "separate",
              "concentration",
            ],
            description: "Type of challenge task",
          },
          answerType: {
            type: Type.STRING,
            enum: ["multiple_choice", "true_false"],
            description:
              "Answer interaction type. Use 'true_false' for binary choices (e.g. Dissolves/Doesn't dissolve, Yes/No). " +
              "Use 'multiple_choice' for questions with 3-4 options including plausible distractors.",
          },
          instruction: {
            type: Type.STRING,
            description:
              "Kid-friendly instruction for this challenge",
          },
          options: {
            type: Type.ARRAY,
            description:
              "Answer choices for the student. For true_false: exactly 2 options. For multiple_choice: 3-4 options. " +
              "Include one correct answer and plausible distractors. Randomize correct answer position.",
            items: { type: Type.STRING },
          },
          correctOptionIndex: {
            type: Type.NUMBER,
            description:
              "0-based index of the correct option in the options array. MUST be a valid index within the options array.",
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
          "answerType",
          "instruction",
          "options",
          "correctOptionIndex",
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
          description:
            "Show the particle-level microscope view of the solution",
        },
        showConcentrationMeter: {
          type: Type.BOOLEAN,
          description:
            "Show the concentration bar that tracks dissolved solute",
        },
        showTemperatureControl: {
          type: Type.BOOLEAN,
          description:
            "Show the temperature slider to test how heat affects dissolving",
        },
        showSaturationIndicator: {
          type: Type.BOOLEAN,
          description:
            "Show the saturation badge when no more solute can dissolve",
        },
        showSeparationTools: {
          type: Type.BOOLEAN,
          description:
            "Show the separation tools accordion for recovering substances",
        },
        showSolubilityCurve: {
          type: Type.BOOLEAN,
          description:
            "Show the solubility vs temperature curve (grade 6-7 only)",
        },
      },
      required: [
        "showParticleView",
        "showConcentrationMeter",
        "showTemperatureControl",
        "showSaturationIndicator",
        "showSeparationTools",
        "showSolubilityCurve",
      ],
    },
    gradeBand: {
      type: Type.STRING,
      enum: ["3-5", "6-7"],
      description: "Target grade band for content complexity",
    },
  },
  required: [
    "title",
    "description",
    "solvent",
    "substances",
    "separationMethods",
    "challenges",
    "showOptions",
    "gradeBand",
  ],
};

/**
 * Determine the grade band from grade level context string
 */
const resolveGradeBand = (gradeLevel: string): "3-5" | "6-7" => {
  const gl = gradeLevel.toLowerCase();
  if (
    gl.includes("6") ||
    gl.includes("7") ||
    gl.includes("6-7") ||
    gl.includes("middle") ||
    gl.includes("advanced")
  ) {
    return "6-7";
  }
  return "3-5";
};

/**
 * Generate Mixing and Dissolving data using Gemini
 *
 * Creates an interactive solutions/mixtures exploration where students add
 * solutes to solvents, observe dissolving at the particle level, test factors
 * like temperature and stirring, reach saturation, and use separation tools
 * to recover solutes.
 *
 * Grade-appropriate content:
 * - 3-5: Everyday substances (salt, sugar, sand, oil), simple language,
 *         particle view + saturation indicator, no concentration meter or
 *         solubility curve. Challenges focus on sorting dissolve/doesn't-dissolve
 *         and basic separation (filtration, evaporation).
 * - 6-7: Includes chemical formulas, concentration meter, temperature control,
 *         solubility curve. Challenges include factor testing, saturation
 *         calculations, and scientific separation techniques (distillation,
 *         chromatography).
 *
 * @param topic - The topic or theme (e.g. "dissolving everyday substances", "solutions and mixtures")
 * @param gradeLevel - Grade level context string
 * @param config - Optional partial MixingAndDissolvingData for overrides
 * @returns MixingAndDissolvingData ready for the MixingAndDissolving component
 */
export const generateMixingAndDissolving = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<MixingAndDissolvingData>
): Promise<MixingAndDissolvingData> => {
  const gradeBand = resolveGradeBand(gradeLevel);

  const gradeBandDescriptions: Record<string, string> = {
    "3-5":
      "Grades 3-5. Use EVERYDAY substances kids recognise: table salt, sugar, sand, " +
      "cooking oil, flour, chalk, food colouring, baking soda, etc. " +
      "Language must be simple and concrete: 'What happened to the salt? Did it disappear?' " +
      "NO chemical formulas in challenge instructions (formulas can appear in the data). " +
      "Solubility values should be realistic (salt ~36 g/100 mL, sugar ~200 g/100 mL). " +
      "Challenges: start with dissolve_sort (sort substances into dissolves / doesn't dissolve), " +
      "then particle_explain (describe what happened using the particle view), " +
      "then saturation (add more and more until it won't dissolve), " +
      "then separate (use filtration or evaporation to recover). " +
      "Show particle view, saturation indicator, separation tools. " +
      "Do NOT show concentration meter, temperature control, or solubility curve. " +
      "Include at least one insoluble substance and one immiscible liquid.",
    "6-7":
      "Grades 6-7. Use a broader range of substances with CHEMICAL FORMULAS: " +
      "NaCl, CuSO4, KNO3, CaCO3, vegetable oil, ethanol, etc. " +
      "Include realistic maxSolubility values and accurate solubilityVsTemp behaviour. " +
      "Use proper scientific vocabulary: 'solute', 'solvent', 'solution', 'saturated', " +
      "'concentration', 'solubility curve'. " +
      "Challenges should include factor_test (test how temperature affects dissolving), " +
      "saturation (identify when the solution becomes saturated), " +
      "concentration (estimate or compare concentrations), " +
      "and separate (choose the correct separation method with justification). " +
      "Show ALL UI panels: particle view, concentration meter, temperature control, " +
      "saturation indicator, separation tools, solubility curve. " +
      "Include at least one substance whose solubility DECREASES with temperature " +
      "(like gases or calcium hydroxide) to surprise students.",
  };

  const generationPrompt = `Create a Mixing and Dissolving activity about "${topic}" for ${gradeBand} students.

GRADE BAND REQUIREMENTS (${gradeBand}):
${gradeBandDescriptions[gradeBand]}

CRITICAL REQUIREMENTS:
1. Provide 4-6 substances with a MIX of types:
   - At least 2 soluble substances with realistic maxSolubility values
   - At least 1 insoluble substance (maxSolubility: null)
   - At least 1 immiscible liquid OR partially soluble substance
   - Each substance needs a distinct colour and particleColor (use hex or rgba CSS colours)

2. Solvent should be water unless the topic specifically calls for another solvent.
   - Default: { name: "Water", formula: "H2O", volume: 200, temperature: 20 }

3. maxSolubility is grams per 100 mL at room temperature (~20°C):
   - Table salt (NaCl): ~36 g/100 mL
   - Sugar (C12H22O11): ~200 g/100 mL
   - Baking soda (NaHCO3): ~10 g/100 mL
   - Copper sulfate (CuSO4): ~32 g/100 mL
   - Potassium nitrate (KNO3): ~32 g/100 mL (increases sharply with temperature)
   - Sand (SiO2): null (insoluble)
   - Cooking oil: null (immiscible)
   Set maxSolubility to null for insoluble and immiscible substances.

4. solubilityVsTemp should be:
   - "increases" for most solid solutes (salt, sugar, KNO3)
   - "decreases" for gases and calcium hydroxide
   - "unchanged" for NaCl (nearly flat curve) or immiscible liquids

5. Separation methods must match the substances:
   - filtration: works for insoluble solids (sand, chalk)
   - evaporation: works for dissolved solids (salt, sugar)
   - distillation: works for dissolved solids or miscible liquids
   - chromatography: works for mixed pigments (ink, food colouring)
   - magnet: works for iron filings or magnetic materials
   - decanting: works for immiscible liquids (oil)
   Each method's worksFor array should list the exact substance NAMES from your substances array.

6. Challenges (Multiple Choice / True-False):
   - ALL challenges use "answerType": either "multiple_choice" or "true_false".
   - For "true_false": provide exactly 2 options (e.g. ["Dissolves", "Doesn't dissolve"] or ["Yes", "No"]).
   - For "multiple_choice": provide 3-4 options with plausible distractors. VARY the position of the correct answer.
   - "correctOptionIndex" is the 0-based index of the correct option in the options array.
   - Good answerType choices:
     * dissolve_sort → true_false ("Dissolves" / "Doesn't dissolve") or multiple_choice for which substance
     * particle_explain → multiple_choice (3-4 descriptions of what happened)
     * factor_test → multiple_choice (3-4 options about what happens with temperature)
     * saturation → true_false or multiple_choice
     * separate → multiple_choice (3-4 separation methods to choose from)
     * concentration → multiple_choice (comparing concentrations)
   - Reference actual substances in challenges:
     * dissolve_sort: "Will salt dissolve in water?" → ["Dissolves", "Doesn't dissolve"]
     * particle_explain: "What happened to the salt particles?" → ["They spread out among water molecules", "They disappeared completely", "They sank to the bottom", "They evaporated"]
     * separate: "How would you recover salt from salt water?" → ["Filtration", "Evaporation", "Using a magnet", "Decanting"]

7. Each challenge id must be unique (e.g. "ch1", "ch2", "ch3").

9. Narrations should be educational and encouraging, connecting to real life:
   - "Salt disappears in water but it's still there — that's why the ocean tastes salty!"
   - "You found the saturation point! The water simply can't hold any more."

10. Provide 3-5 challenges for grade 3-5, 4-6 challenges for grade 6-7.

11. Include 2-4 separation methods relevant to the substances provided.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: mixingAndDissolvingSchema,
        systemInstruction:
          "You are an expert primary/middle-school science educator creating interactive " +
          "dissolving and mixing activities. Design engaging explorations where students " +
          "discover that dissolving is a physical change — the solute particles spread out " +
          "among solvent molecules but can be recovered. Students should test different " +
          "substances (soluble, insoluble, immiscible), observe particle-level views, " +
          "explore factors affecting solubility (temperature, stirring), identify saturation, " +
          "and use separation techniques to recover solutes. Use accurate solubility data. " +
          "Language should be age-appropriate: concrete and wonder-driven for younger students " +
          "(grades 3-5), with proper scientific vocabulary for older students (grades 6-7). " +
          "Connect to real-world examples: cooking, ocean water, water treatment, recycling.",
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error(
        "No data returned from Gemini API for mixing-and-dissolving"
      );
    }

    const result = JSON.parse(text) as MixingAndDissolvingData;

    // -----------------------------------------------------------------------
    // Validation & Defaults
    // -----------------------------------------------------------------------

    // Ensure gradeBand
    if (!result.gradeBand || !["3-5", "6-7"].includes(result.gradeBand)) {
      result.gradeBand = gradeBand;
    }

    // Ensure solvent has valid structure
    if (!result.solvent) {
      result.solvent = {
        name: "Water",
        formula: "H2O",
        volume: 200,
        temperature: 20,
      };
    } else {
      result.solvent = {
        name: result.solvent.name || "Water",
        formula: result.solvent.formula || "H2O",
        volume: result.solvent.volume ?? 200,
        temperature: result.solvent.temperature ?? 20,
      };
    }

    // Ensure substances array exists and each entry has required fields
    if (!result.substances || !Array.isArray(result.substances)) {
      result.substances = [
        {
          id: "salt",
          name: "Table Salt",
          formula: "NaCl",
          type: "soluble",
          maxSolubility: 36,
          solubilityVsTemp: "unchanged",
          color: "#ffffff",
          particleColor: "#e0e0e0",
        },
        {
          id: "sand",
          name: "Sand",
          formula: "SiO2",
          type: "insoluble",
          maxSolubility: null,
          solubilityVsTemp: "unchanged",
          color: "#c4a35a",
          particleColor: "#d4b06a",
        },
        {
          id: "oil",
          name: "Cooking Oil",
          formula: null,
          type: "immiscible_liquid",
          maxSolubility: null,
          solubilityVsTemp: "unchanged",
          color: "rgba(255,200,0,0.5)",
          particleColor: "#ffc800",
        },
        {
          id: "sugar",
          name: "Sugar",
          formula: "C12H22O11",
          type: "soluble",
          maxSolubility: 200,
          solubilityVsTemp: "increases",
          color: "rgba(255,255,255,0.3)",
          particleColor: "#f0f0f0",
        },
      ];
    } else {
      result.substances = result.substances.map((s, idx) => ({
        ...s,
        id: s.id || `sub${idx + 1}`,
        name: s.name || `Substance ${idx + 1}`,
        formula: s.formula ?? null,
        type: s.type || "soluble",
        maxSolubility: s.maxSolubility ?? null,
        solubilityVsTemp: s.solubilityVsTemp || "unchanged",
        color: s.color || "#ffffff",
        particleColor: s.particleColor || "#cccccc",
      }));
    }

    // Ensure separationMethods array
    if (
      !result.separationMethods ||
      !Array.isArray(result.separationMethods) ||
      result.separationMethods.length === 0
    ) {
      result.separationMethods = [
        {
          method: "filtration",
          worksFor: result.substances
            .filter((s) => s.type === "insoluble")
            .map((s) => s.name),
          description:
            "Pour the mixture through filter paper. Solids that didn't dissolve get caught!",
          animation: "liquid passes through paper, solid stays behind",
        },
        {
          method: "evaporation",
          worksFor: result.substances
            .filter(
              (s) => s.type === "soluble" || s.type === "partially_soluble"
            )
            .map((s) => s.name),
          description:
            "Heat the solution until the water boils away. The dissolved substance is left behind as crystals!",
          animation: "liquid boils away leaving crystals",
        },
      ];
    } else {
      result.separationMethods = result.separationMethods.map((m) => ({
        ...m,
        method: m.method || "filtration",
        worksFor: m.worksFor || [],
        description: m.description || "A separation technique.",
        animation: m.animation || "separation in progress",
      }));
    }

    // Ensure showOptions defaults based on grade band
    const isYounger = gradeBand === "3-5";
    result.showOptions = {
      showParticleView: result.showOptions?.showParticleView ?? true,
      showConcentrationMeter:
        result.showOptions?.showConcentrationMeter ?? !isYounger,
      showTemperatureControl:
        result.showOptions?.showTemperatureControl ?? !isYounger,
      showSaturationIndicator:
        result.showOptions?.showSaturationIndicator ?? true,
      showSeparationTools: result.showOptions?.showSeparationTools ?? true,
      showSolubilityCurve:
        result.showOptions?.showSolubilityCurve ?? !isYounger,
    };

    // Ensure every challenge has required fields
    if (result.challenges && Array.isArray(result.challenges)) {
      result.challenges = result.challenges.map((ch, idx) => {
        const challenge = {
          ...ch,
          id: ch.id || `ch${idx + 1}`,
          type: ch.type || "dissolve_sort",
          answerType: ch.answerType || "true_false",
          instruction:
            ch.instruction ||
            "Add a substance to the water and see what happens!",
          options: ch.options && ch.options.length >= 2
            ? ch.options
            : ["Dissolves", "Doesn't dissolve"],
          correctOptionIndex: ch.correctOptionIndex ?? 0,
          hint:
            ch.hint ||
            "Try adding the substance and watch carefully!",
          narration: ch.narration || ch.instruction || "Great observation!",
        };
        // Ensure correctOptionIndex is within bounds
        if (challenge.correctOptionIndex < 0 || challenge.correctOptionIndex >= challenge.options.length) {
          challenge.correctOptionIndex = 0;
        }
        // Ensure true_false has exactly 2 options
        if (challenge.answerType === "true_false" && challenge.options.length !== 2) {
          challenge.answerType = "multiple_choice";
        }
        return challenge;
      });
    }

    // Ensure at least one challenge exists
    if (!result.challenges || result.challenges.length === 0) {
      result.challenges = [
        {
          id: "ch1",
          type: "dissolve_sort",
          answerType: "true_false" as const,
          instruction:
            "Add salt to the water. Does it dissolve?",
          options: ["Dissolves", "Doesn't dissolve"],
          correctOptionIndex: 0,
          hint: "Watch carefully — does the substance disappear into the water or stay visible?",
          narration:
            "Salt dissolves and seems to disappear — but it's still there! That's why the water tastes salty.",
        },
        {
          id: "ch2",
          type: "particle_explain",
          answerType: "multiple_choice" as const,
          instruction:
            "Turn on the particle view. What happened to the salt particles when they dissolved?",
          options: [
            "They spread out among the water molecules",
            "They disappeared completely",
            "They sank to the bottom",
            "They floated to the top",
          ],
          correctOptionIndex: 0,
          hint: "Look at where the salt particles are now compared to the sand particles.",
          narration:
            "The salt particles broke apart and spread out among the water molecules — that's dissolving at the tiny particle level!",
        },
        {
          id: "ch3",
          type: "separate",
          answerType: "multiple_choice" as const,
          instruction:
            "You have a mixture of sand and salt water. How would you get the salt back?",
          options: [
            "Use a magnet",
            "Filter then evaporate",
            "Just pour it out",
            "Freeze the water",
          ],
          correctOptionIndex: 1,
          hint: "Think about it in two steps: first remove the sand, then get the salt out of the water.",
          narration:
            "Filter out the sand, then evaporate the water — the salt crystals appear like magic! But it's not magic, it's science!",
        },
      ];
    }

    // Apply config overrides if provided
    if (config) {
      if (config.title !== undefined) result.title = config.title;
      if (config.description !== undefined)
        result.description = config.description;
      if (config.solvent !== undefined)
        result.solvent = { ...result.solvent, ...config.solvent };
      if (config.substances !== undefined)
        result.substances = config.substances;
      if (config.separationMethods !== undefined)
        result.separationMethods = config.separationMethods;
      if (config.challenges !== undefined)
        result.challenges = config.challenges;
      if (config.showOptions !== undefined)
        result.showOptions = { ...result.showOptions, ...config.showOptions };
      if (config.gradeBand !== undefined) result.gradeBand = config.gradeBand;
    }

    console.log("🧪 Mixing & Dissolving Generated:", {
      title: result.title,
      gradeBand: result.gradeBand,
      substanceCount: result.substances?.length ?? 0,
      separationMethodCount: result.separationMethods?.length ?? 0,
      challengeCount: result.challenges?.length ?? 0,
      showOptions: result.showOptions,
    });

    return result;
  } catch (error) {
    console.error("Error generating mixing-and-dissolving data:", error);
    throw error;
  }
};
