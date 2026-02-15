import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import {
  PhExplorerData,
} from "../../primitives/visual-primitives/chemistry/PhExplorer";

// Re-export type for convenience (no redefinition — sourced from the component)
export type { PhExplorerData };

/**
 * Schema definition for pH Explorer Data
 *
 * Describes the JSON structure Gemini must return:
 * - substances: array of testable substances with pH values, types, indicator colors
 * - indicators: available acid/base indicators and their color ranges
 * - neutralization: optional acid-base neutralization station config
 * - challenges: sequenced pH exploration challenges
 * - showOptions: UI toggles for pH scale, indicators, particle view, etc.
 * - gradeBand: 4-6 or 7-8
 */
const phExplorerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description:
        "Short, engaging title for the activity (e.g. 'Acid-Base Rainbow Lab')",
    },
    description: {
      type: Type.STRING,
      description:
        "One-sentence activity description in kid-friendly language",
    },
    substances: {
      type: Type.ARRAY,
      description:
        "5-8 substances for students to test. Include a mix of acids, bases, and neutrals from everyday life.",
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique identifier (e.g. 'lemon_juice', 'soap')",
          },
          name: {
            type: Type.STRING,
            description: "Display name (e.g. 'Lemon Juice')",
          },
          pH: {
            type: Type.NUMBER,
            description:
              "pH value from 0-14. Must be scientifically accurate for the substance.",
          },
          type: {
            type: Type.STRING,
            enum: ["acid", "base", "neutral"],
            description: "Classification based on pH (below 7 = acid, 7 = neutral, above 7 = base)",
          },
          strength: {
            type: Type.STRING,
            enum: ["strong", "weak"],
            description:
              "Whether the acid or base is strong or weak. Neutral substances should be 'weak'.",
          },
          category: {
            type: Type.STRING,
            enum: ["food", "cleaning", "body", "nature", "lab"],
            description: "Real-world category for grouping substances",
          },
          indicatorColors: {
            type: Type.OBJECT,
            description: "Colors this substance produces with each indicator",
            properties: {
              litmus: {
                type: Type.STRING,
                enum: ["red", "blue"],
                description:
                  "Litmus paper color: red for acids (pH < 7), blue for bases (pH > 7). Neutral → blue.",
              },
              cabbageJuice: {
                type: Type.STRING,
                enum: ["red", "pink", "purple", "blue", "green", "yellow"],
                description:
                  "Cabbage juice color: red (pH 0-2), pink (3-4), purple (5-6), blue (7-8), green (9-12), yellow (13-14)",
              },
              universal: {
                type: Type.STRING,
                description:
                  "CSS color string for universal indicator paper at this pH (e.g. '#ff4400' for pH 2)",
              },
            },
            required: ["litmus", "cabbageJuice", "universal"],
          },
          realWorldInfo: {
            type: Type.STRING,
            description:
              "Fun fact connecting this substance to everyday life (e.g. 'Vinegar is used to clean windows and make salad dressing!')",
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
          "pH",
          "type",
          "strength",
          "category",
          "indicatorColors",
          "realWorldInfo",
        ],
      },
    },
    indicators: {
      type: Type.ARRAY,
      description:
        "2-4 indicators available for testing. Always include litmus and cabbage_juice.",
      items: {
        type: Type.OBJECT,
        properties: {
          name: {
            type: Type.STRING,
            enum: ["litmus", "cabbage_juice", "universal", "phenolphthalein"],
            description: "Indicator name",
          },
          colorRange: {
            type: Type.OBJECT,
            description:
              "Key-value map of pH ranges or categories to display colors (e.g. { 'acid': '#e53e3e', 'base': '#4299e1' } for litmus)",
            properties: {
              acid: { type: Type.STRING, description: "Color for acidic substances", nullable: true },
              base: { type: Type.STRING, description: "Color for basic substances", nullable: true },
              neutral: { type: Type.STRING, description: "Color for neutral substances", nullable: true },
            },
          },
        },
        required: ["name", "colorRange"],
      },
    },
    neutralization: {
      type: Type.OBJECT,
      description:
        "Optional neutralization station config. Set enabled=true for grade 7-8 or when a neutralize challenge is included.",
      nullable: true,
      properties: {
        enabled: {
          type: Type.BOOLEAN,
          description: "Whether the neutralization station is active",
        },
        acid: {
          type: Type.STRING,
          description:
            "ID of the acid substance to use in neutralization (must match a substance id)",
        },
        base: {
          type: Type.STRING,
          description:
            "ID of the base substance to use in neutralization (must match a substance id)",
        },
        showpHMeter: {
          type: Type.BOOLEAN,
          description: "Show the live pH meter during neutralization",
        },
        showParticleView: {
          type: Type.BOOLEAN,
          description: "Show H+ / OH- particle view during neutralization",
        },
      },
      required: ["enabled", "acid", "base", "showpHMeter", "showParticleView"],
    },
    challenges: {
      type: Type.ARRAY,
      description:
        "3-6 sequenced challenges progressing in difficulty: sort → test → place_on_scale → identify_from_color → neutralize → rainbow → predict_pH",
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
              "sort",
              "test",
              "place_on_scale",
              "neutralize",
              "identify_from_color",
              "rainbow",
              "predict_pH",
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
              "Expected answer or keywords separated by | for multiple acceptable answers (e.g. 'acid|acidic|sour')",
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
    showOptions: {
      type: Type.OBJECT,
      description: "Which UI panels to enable for this activity",
      properties: {
        showPHScale: {
          type: Type.BOOLEAN,
          description: "Show the interactive pH scale bar with substance markers",
        },
        showIndicators: {
          type: Type.BOOLEAN,
          description: "Show the indicator selector and test tube display",
        },
        showNeutralization: {
          type: Type.BOOLEAN,
          description: "Show the acid-base neutralization mixing station",
        },
        showParticleView: {
          type: Type.BOOLEAN,
          description:
            "Show H+/OH- particle view (grade 7-8 only)",
        },
        showRealWorldImages: {
          type: Type.BOOLEAN,
          description: "Show real-world images for each substance",
        },
        showConcentration: {
          type: Type.BOOLEAN,
          description:
            "Show concentration/dilution controls (grade 7-8 only)",
        },
      },
      required: [
        "showPHScale",
        "showIndicators",
        "showNeutralization",
        "showParticleView",
        "showRealWorldImages",
        "showConcentration",
      ],
    },
    gradeBand: {
      type: Type.STRING,
      enum: ["4-6", "7-8"],
      description: "Target grade band for content complexity",
    },
  },
  required: [
    "title",
    "description",
    "substances",
    "indicators",
    "challenges",
    "showOptions",
    "gradeBand",
  ],
};

/**
 * Determine the grade band from grade level context string
 */
const resolveGradeBand = (gradeLevel: string): "4-6" | "7-8" => {
  const gl = gradeLevel.toLowerCase();
  if (
    gl.includes("7") ||
    gl.includes("8") ||
    gl.includes("7-8") ||
    gl.includes("middle") ||
    gl.includes("advanced")
  ) {
    return "7-8";
  }
  return "4-6";
};

/**
 * Generate pH Explorer data using Gemini
 *
 * Creates an interactive pH / acid-base exploration where students test
 * substances with indicators, sort acids/bases/neutrals, observe indicator
 * color changes, create a cabbage juice pH rainbow, and optionally
 * neutralize acids with bases at a mixing station.
 *
 * Grade-appropriate content:
 * - 4-6: Simple language, household substances (lemon juice, soap, vinegar,
 *         baking soda, milk, water), sort acid/base/neutral, litmus paper,
 *         cabbage juice. No concentration or particle view.
 * - 7-8: Scientific vocabulary (H+, OH-, concentration, logarithmic),
 *         chemical formulas, neutralization station, particle view,
 *         phenolphthalein indicator, buffer introduction, stronger/weaker
 *         acid concepts.
 *
 * @param topic - The topic or theme (e.g. "everyday acids and bases", "pH rainbow")
 * @param gradeLevel - Grade level context string
 * @param config - Optional partial PhExplorerData for overrides
 * @returns PhExplorerData ready for the PhExplorer component
 */
export const generatePhExplorer = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<PhExplorerData>
): Promise<PhExplorerData> => {
  const gradeBand = resolveGradeBand(gradeLevel);

  const gradeBandDescriptions: Record<string, string> = {
    "4-6":
      "Grades 4-6. Use SIMPLE, kid-friendly language and HOUSEHOLD substances kids recognise: " +
      "lemon juice (pH 2), vinegar (pH 3), orange juice (pH 3.5), milk (pH 6.5), " +
      "pure water (pH 7), baking soda solution (pH 8.5), soap (pH 10), bleach (pH 12). " +
      "Focus on sorting substances into acid / base / neutral categories. " +
      "Indicators: litmus paper (turns red for acid, blue for base) and cabbage juice " +
      "(creates a rainbow of colors across the pH scale). " +
      "Challenges: sort substances, test with litmus, create a cabbage juice rainbow, " +
      "place substances on the pH scale. " +
      "Do NOT include concentration controls, particle view, phenolphthalein, or neutralization. " +
      "No chemical formulas in instructions. Fun real-world connections (e.g. 'Your stomach uses acid to digest food!').",

    "7-8":
      "Grades 7-8. Use SCIENTIFIC VOCABULARY: H+ ions, OH- ions, concentration, logarithmic scale, " +
      "neutralization, buffer. Include chemical formulas where relevant (HCl, NaOH, CH3COOH). " +
      "Substances can include lab chemicals alongside everyday ones: hydrochloric acid (pH 1), " +
      "vinegar/acetic acid (pH 3), carbonic acid (pH 4), pure water (pH 7), " +
      "sodium bicarbonate (pH 8.5), ammonia (pH 11), sodium hydroxide (pH 13). " +
      "Include ALL four indicators: litmus, cabbage juice, universal, and phenolphthalein. " +
      "Enable the neutralization station with an acid-base pair (e.g. HCl + NaOH). " +
      "Show particle view (H+ / OH- ions), pH meter, and concentration. " +
      "Challenges should include predict_pH, neutralize, identify_from_color, " +
      "and place_on_scale. Introduce the idea that each pH unit is a 10x change in H+ concentration. " +
      "Discuss strong vs weak acids (HCl vs CH3COOH).",
  };

  const generationPrompt = `Create a pH Explorer activity about "${topic}" for ${gradeBand} students.

GRADE BAND REQUIREMENTS (${gradeBand}):
${gradeBandDescriptions[gradeBand]}

CRITICAL REQUIREMENTS:
1. Provide 5-8 substances with a MIX of acids, bases, and at least 1 neutral:
   - Each must have accurate pH values
   - type must match pH: below 7 = acid, exactly 7 = neutral, above 7 = base
   - strength: strong acids (pH 0-2) and strong bases (pH 12-14); otherwise weak
   - category: food, cleaning, body, nature, or lab
   - indicatorColors must be accurate:
     * litmus: "red" for pH < 7, "blue" for pH >= 7
     * cabbageJuice: "red" (pH 0-2), "pink" (3-4), "purple" (5-6), "blue" (7-8), "green" (9-12), "yellow" (13-14)
     * universal: CSS hex color matching the universal indicator chart

2. Indicators array must include at least litmus and cabbage_juice.
   For grade 7-8, also include universal and phenolphthalein.
   Each indicator needs a colorRange object mapping categories to CSS colors.

3. For grade 7-8, set neutralization.enabled = true and pick one acid + one base from substances.
   For grade 4-6, neutralization should be null or { enabled: false }.

4. Challenges should progress in difficulty:
   - sort: "Sort these substances into acid, base, or neutral"
   - test: "Test lemon juice with litmus paper. What color do you see?"
   - place_on_scale: "Where does soap belong on the pH scale?"
   - identify_from_color: "The cabbage juice turned green. Is this substance acid, base, or neutral?"
   - rainbow: "Test all substances with cabbage juice to create a pH rainbow!"
   - neutralize: "Mix the acid and base until the pH meter reads 7" (grade 7-8)
   - predict_pH: "If vinegar is pH 3, predict: is it more or less acidic than lemon juice (pH 2)?" (grade 7-8)

5. targetAnswer should include pipe-separated acceptable answers:
   - "acid|acidic" for sort challenges
   - "red" for litmus test on acid
   - "7|neutral" for neutralization target

6. Each challenge id must be unique (e.g. "ch1", "ch2", "ch3").

7. Narrations should be educational and wonder-driven:
   - "Cabbage juice is nature's pH detector — it changes color like a mood ring for chemicals!"
   - "You neutralized the acid! The H+ and OH- combined to make water — H2O!"

8. Provide 3-4 challenges for grade 4-6, 5-6 challenges for grade 7-8.

9. realWorldInfo should connect each substance to daily life in a fun, memorable way.

10. showOptions should match the grade band:
    - 4-6: showPHScale=true, showIndicators=true, showNeutralization=false, showParticleView=false, showRealWorldImages=false, showConcentration=false
    - 7-8: showPHScale=true, showIndicators=true, showNeutralization=true, showParticleView=true, showRealWorldImages=false, showConcentration=true`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: phExplorerSchema,
        systemInstruction:
          "You are an expert primary/middle-school science educator creating interactive " +
          "pH and acid-base exploration activities. Design engaging hands-on explorations " +
          "where students test everyday substances with indicators to discover the pH rainbow. " +
          "Students should learn that acids taste sour and turn litmus red, bases feel slippery " +
          "and turn litmus blue, and neutral substances are in the middle at pH 7. " +
          "Cabbage juice is a spectacular natural indicator that produces a full rainbow of colors " +
          "across the pH scale: red for strong acids, pink/purple for weak acids, blue-green for " +
          "bases, and yellow for strong bases. Use accurate pH values for all substances. " +
          "For older students (grade 7-8), introduce the concept that pH is logarithmic " +
          "(each unit = 10x change in H+ concentration), strong vs weak acids/bases, " +
          "neutralization (acid + base → salt + water), and the particle view showing " +
          "H+ and OH- ions. Language should be age-appropriate: concrete and wonder-driven " +
          "for younger students (grades 4-6), with proper scientific vocabulary for older " +
          "students (grades 7-8). Connect to real-world examples: cooking, cleaning, " +
          "stomach acid, ant stings, bee stings, soil pH for gardening.",
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error(
        "No data returned from Gemini API for ph-explorer"
      );
    }

    const result = JSON.parse(text) as PhExplorerData;

    // -----------------------------------------------------------------------
    // Validation & Defaults
    // -----------------------------------------------------------------------

    // Ensure gradeBand
    if (!result.gradeBand || !["4-6", "7-8"].includes(result.gradeBand)) {
      result.gradeBand = gradeBand;
    }

    // Ensure substances array exists and each entry has required fields
    if (!result.substances || !Array.isArray(result.substances)) {
      result.substances = [
        {
          id: "lemon_juice",
          name: "Lemon Juice",
          pH: 2,
          type: "acid",
          strength: "strong",
          category: "food",
          indicatorColors: {
            litmus: "red",
            cabbageJuice: "red",
            universal: "#ff4400",
          },
          realWorldInfo:
            "Lemons are so sour because they contain citric acid — the same acid in oranges and limes!",
        },
        {
          id: "water",
          name: "Pure Water",
          pH: 7,
          type: "neutral",
          strength: "weak",
          category: "nature",
          indicatorColors: {
            litmus: "blue",
            cabbageJuice: "blue",
            universal: "#00cc00",
          },
          realWorldInfo:
            "Pure water is perfectly neutral at pH 7 — right in the middle of the scale!",
        },
        {
          id: "soap",
          name: "Hand Soap",
          pH: 10,
          type: "base",
          strength: "weak",
          category: "cleaning",
          indicatorColors: {
            litmus: "blue",
            cabbageJuice: "green",
            universal: "#0066dd",
          },
          realWorldInfo:
            "Soap is a base — that's why it feels slippery! It helps break up grease and dirt.",
        },
        {
          id: "vinegar",
          name: "Vinegar",
          pH: 3,
          type: "acid",
          strength: "weak",
          category: "food",
          indicatorColors: {
            litmus: "red",
            cabbageJuice: "pink",
            universal: "#ff8800",
          },
          realWorldInfo:
            "Vinegar contains acetic acid. People use it for cooking, cleaning, and even science experiments!",
        },
        {
          id: "baking_soda",
          name: "Baking Soda Solution",
          pH: 8.5,
          type: "base",
          strength: "weak",
          category: "food",
          indicatorColors: {
            litmus: "blue",
            cabbageJuice: "blue",
            universal: "#00aaaa",
          },
          realWorldInfo:
            "Baking soda is a mild base. Mixed with vinegar (an acid), it fizzes — that's a neutralization reaction!",
        },
      ];
    } else {
      result.substances = result.substances.map((s, idx) => ({
        ...s,
        id: s.id || `sub${idx + 1}`,
        name: s.name || `Substance ${idx + 1}`,
        pH: s.pH ?? 7,
        type: s.type || (s.pH < 7 ? "acid" : s.pH > 7 ? "base" : "neutral"),
        strength: s.strength || "weak",
        category: s.category || "food",
        indicatorColors: {
          litmus: s.indicatorColors?.litmus || (s.pH < 7 ? "red" : "blue"),
          cabbageJuice:
            s.indicatorColors?.cabbageJuice ||
            (s.pH <= 2
              ? "red"
              : s.pH <= 4
                ? "pink"
                : s.pH <= 6
                  ? "purple"
                  : s.pH <= 8
                    ? "blue"
                    : s.pH <= 12
                      ? "green"
                      : "yellow"),
          universal: s.indicatorColors?.universal || "#00cc00",
        },
        realWorldInfo:
          s.realWorldInfo || `${s.name || "This substance"} has a pH of ${s.pH ?? 7}.`,
      }));
    }

    // Ensure indicators array
    if (
      !result.indicators ||
      !Array.isArray(result.indicators) ||
      result.indicators.length === 0
    ) {
      result.indicators = [
        {
          name: "litmus",
          colorRange: { acid: "#e53e3e", base: "#4299e1" },
        },
        {
          name: "cabbage_juice",
          colorRange: {
            "pH 0-2": "#e53e3e",
            "pH 3-4": "#ed64a6",
            "pH 5-6": "#9f7aea",
            "pH 7-8": "#4299e1",
            "pH 9-12": "#48bb78",
            "pH 13-14": "#ecc94b",
          },
        },
      ];

      if (gradeBand === "7-8") {
        result.indicators.push(
          {
            name: "universal",
            colorRange: {
              "pH 0": "#ff0000",
              "pH 4": "#ffcc00",
              "pH 7": "#00cc00",
              "pH 10": "#0066dd",
              "pH 14": "#660088",
            },
          },
          {
            name: "phenolphthalein",
            colorRange: {
              "pH 0-8": "transparent",
              "pH 8-14": "#ed64a6",
            },
          }
        );
      }
    } else {
      result.indicators = result.indicators.map((ind) => ({
        ...ind,
        name: ind.name || "litmus",
        colorRange: ind.colorRange || {},
      }));
    }

    // Ensure showOptions defaults based on grade band
    const isYounger = gradeBand === "4-6";
    result.showOptions = {
      showPHScale: result.showOptions?.showPHScale ?? true,
      showIndicators: result.showOptions?.showIndicators ?? true,
      showNeutralization:
        result.showOptions?.showNeutralization ?? !isYounger,
      showParticleView:
        result.showOptions?.showParticleView ?? !isYounger,
      showRealWorldImages:
        result.showOptions?.showRealWorldImages ?? false,
      showConcentration:
        result.showOptions?.showConcentration ?? !isYounger,
    };

    // Ensure every challenge has required fields
    if (result.challenges && Array.isArray(result.challenges)) {
      result.challenges = result.challenges.map((ch, idx) => ({
        ...ch,
        id: ch.id || `ch${idx + 1}`,
        type: ch.type || "sort",
        instruction:
          ch.instruction ||
          "Test a substance with the indicator and observe the color!",
        targetAnswer: ch.targetAnswer || "acid",
        hint:
          ch.hint ||
          "Look at the color the indicator turned!",
        narration: ch.narration || ch.instruction || "Great observation!",
      }));
    }

    // Ensure at least one challenge exists
    if (!result.challenges || result.challenges.length === 0) {
      result.challenges = [
        {
          id: "ch1",
          type: "sort",
          instruction:
            "Sort each substance into acid, base, or neutral by testing it with litmus paper.",
          targetAnswer: "acid|base|neutral",
          hint: "Remember: litmus turns red for acids and blue for bases!",
          narration:
            "Litmus paper is like a secret decoder — red means acid, blue means base!",
        },
        {
          id: "ch2",
          type: "test",
          instruction:
            "Test lemon juice with cabbage juice indicator. What color do you see?",
          targetAnswer: "red|pink",
          hint: "Lemon juice is very acidic. What color does cabbage juice turn for strong acids?",
          narration:
            "Cabbage juice turned red — that tells us lemon juice is a strong acid!",
        },
        {
          id: "ch3",
          type: "rainbow",
          instruction:
            "Test ALL substances with cabbage juice to create a pH rainbow! How many colors can you find?",
          targetAnswer: "6|rainbow|all",
          hint: "Try every substance — each one will produce a different color!",
          narration:
            "You created a rainbow from chemicals! Each color represents a different pH — nature's own color code!",
        },
      ];
    }

    // Apply config overrides if provided
    if (config) {
      if (config.title !== undefined) result.title = config.title;
      if (config.description !== undefined)
        result.description = config.description;
      if (config.substances !== undefined)
        result.substances = config.substances;
      if (config.indicators !== undefined)
        result.indicators = config.indicators;
      if (config.neutralization !== undefined)
        result.neutralization = config.neutralization;
      if (config.challenges !== undefined)
        result.challenges = config.challenges;
      if (config.showOptions !== undefined)
        result.showOptions = { ...result.showOptions, ...config.showOptions };
      if (config.gradeBand !== undefined) result.gradeBand = config.gradeBand;
    }

    console.log("\uD83E\uDDEA pH Explorer Generated:", {
      title: result.title,
      gradeBand: result.gradeBand,
      substanceCount: result.substances?.length ?? 0,
      indicatorCount: result.indicators?.length ?? 0,
      challengeCount: result.challenges?.length ?? 0,
      neutralizationEnabled: result.neutralization?.enabled ?? false,
      showOptions: result.showOptions,
    });

    return result;
  } catch (error) {
    console.error("Error generating ph-explorer data:", error);
    throw error;
  }
};
