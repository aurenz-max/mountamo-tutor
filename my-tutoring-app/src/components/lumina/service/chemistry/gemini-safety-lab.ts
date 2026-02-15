import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import {
  SafetyLabData,
} from "../../primitives/visual-primitives/chemistry/SafetyLab";

// Re-export type for convenience (no redefinition — sourced from the component)
export type { SafetyLabData };

/**
 * Schema definition for Safety Lab Data
 *
 * Describes the JSON structure Gemini must return:
 * - scenario: lab scenario with hazards, required PPE, and safety equipment
 * - ghsSymbols: GHS hazard symbols with meanings and examples
 * - emergencySequence: emergency response steps in correct order
 * - challenges: sequenced safety training challenges
 * - showOptions: UI toggles for lab scene, PPE station, GHS symbols, etc.
 * - gradeBand: K-2, 3-5, or 6-8
 */
const safetyLabSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description:
        "Short, engaging title for the activity (e.g. 'Lab Safety Detective')",
    },
    description: {
      type: Type.STRING,
      description:
        "One-sentence activity description in kid-friendly language",
    },
    scenario: {
      type: Type.OBJECT,
      description:
        "The lab scenario students must make safe before the experiment",
      properties: {
        name: {
          type: Type.STRING,
          description:
            "Name of the lab scenario (e.g. 'Chemistry Mixing Station')",
        },
        experiment: {
          type: Type.STRING,
          description:
            "Description of the experiment being prepared (e.g. 'Mixing baking soda and vinegar')",
        },
        hazards: {
          type: Type.ARRAY,
          description:
            "2-6 hazards hidden in the lab scene for students to find",
          items: {
            type: Type.OBJECT,
            properties: {
              id: {
                type: Type.STRING,
                description: "Unique hazard identifier (e.g. 'h1', 'h2')",
              },
              type: {
                type: Type.STRING,
                enum: [
                  "fire",
                  "chemical",
                  "glass",
                  "electrical",
                  "biological",
                  "slip",
                ],
                description: "Category of the hazard",
              },
              description: {
                type: Type.STRING,
                description:
                  "What the hazard is (e.g. 'Open flame near paper towels')",
              },
              location: {
                type: Type.OBJECT,
                description:
                  "Position in the lab scene as percentage coordinates (0-100)",
                properties: {
                  x: {
                    type: Type.NUMBER,
                    description: "Horizontal position (0-100)",
                  },
                  y: {
                    type: Type.NUMBER,
                    description: "Vertical position (0-100)",
                  },
                },
                required: ["x", "y"],
              },
              severity: {
                type: Type.STRING,
                enum: ["low", "medium", "high"],
                description: "How dangerous this hazard is",
              },
              correction: {
                type: Type.STRING,
                description:
                  "How to fix or avoid this hazard (e.g. 'Move the flame away from flammable materials')",
              },
            },
            required: [
              "id",
              "type",
              "description",
              "location",
              "severity",
              "correction",
            ],
          },
        },
        requiredPPE: {
          type: Type.ARRAY,
          description:
            "List of PPE items required for this experiment (e.g. ['goggles', 'gloves', 'apron'])",
          items: { type: Type.STRING },
        },
        safetyEquipment: {
          type: Type.ARRAY,
          description:
            "Safety equipment that should be nearby (e.g. ['eye_wash', 'fire_extinguisher'])",
          items: { type: Type.STRING },
        },
      },
      required: [
        "name",
        "experiment",
        "hazards",
        "requiredPPE",
        "safetyEquipment",
      ],
    },
    ghsSymbols: {
      type: Type.ARRAY,
      description:
        "GHS hazard symbols relevant to this scenario. Omit or leave empty for K-2.",
      nullable: true,
      items: {
        type: Type.OBJECT,
        properties: {
          symbol: {
            type: Type.STRING,
            enum: [
              "flame",
              "skull",
              "corrosion",
              "exclamation",
              "health_hazard",
              "environment",
              "oxidizer",
              "gas_cylinder",
              "explosive",
            ],
            description: "GHS pictogram identifier",
          },
          meaning: {
            type: Type.STRING,
            description:
              "What this symbol means (e.g. 'Flammable — catches fire easily')",
          },
          examples: {
            type: Type.ARRAY,
            description:
              "2-3 example chemicals or products with this symbol",
            items: { type: Type.STRING },
          },
        },
        required: ["symbol", "meaning", "examples"],
      },
    },
    emergencySequence: {
      type: Type.OBJECT,
      description:
        "An emergency scenario with the correct step-by-step response order",
      nullable: true,
      properties: {
        scenario: {
          type: Type.STRING,
          description:
            "Description of the emergency (e.g. 'A chemical splashes in your partner's eyes!')",
        },
        correctOrder: {
          type: Type.ARRAY,
          description:
            "Steps in the correct emergency response order (3-6 steps)",
          items: { type: Type.STRING },
        },
      },
      required: ["scenario", "correctOrder"],
    },
    challenges: {
      type: Type.ARRAY,
      description:
        "3-6 sequenced challenges: equip_ppe → spot_hazard → match_symbols → emergency_response → design_lab → safety_quiz",
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
              "equip_ppe",
              "spot_hazard",
              "match_symbols",
              "emergency_response",
              "design_lab",
              "safety_quiz",
            ],
            description: "Type of safety challenge",
          },
          instruction: {
            type: Type.STRING,
            description: "Kid-friendly instruction for this challenge",
          },
          targetAnswer: {
            type: Type.STRING,
            description:
              "Expected answer or keywords separated by | for multiple acceptable answers",
          },
          hint: {
            type: Type.STRING,
            description: "Gentle hint if the student is stuck",
          },
          narration: {
            type: Type.STRING,
            description:
              "Encouraging narration text about why safety matters",
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
        showLabScene: {
          type: Type.BOOLEAN,
          description:
            "Show the interactive lab scene with clickable hazard hotspots",
        },
        showPPEStation: {
          type: Type.BOOLEAN,
          description: "Show the PPE selection station",
        },
        showGHSSymbols: {
          type: Type.BOOLEAN,
          description: "Show the GHS hazard symbols panel (grade 3-5 and 6-8)",
        },
        showEmergencyStations: {
          type: Type.BOOLEAN,
          description: "Show safety equipment locations and emergency sequencer",
        },
        showTimer: {
          type: Type.BOOLEAN,
          description:
            "Show a timer for hazard-spotting speed challenges",
        },
      },
      required: [
        "showLabScene",
        "showPPEStation",
        "showGHSSymbols",
        "showEmergencyStations",
        "showTimer",
      ],
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
    "scenario",
    "challenges",
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
    gl.includes("6") ||
    gl.includes("7") ||
    gl.includes("8") ||
    gl.includes("6-8") ||
    gl.includes("middle") ||
    gl.includes("advanced")
  ) {
    return "6-8";
  }
  if (
    gl.includes("3") ||
    gl.includes("4") ||
    gl.includes("5") ||
    gl.includes("3-5") ||
    gl.includes("elementary")
  ) {
    return "3-5";
  }
  return "K-2";
};

/**
 * Generate Safety Lab data using Gemini
 *
 * Creates an interactive lab safety training activity where students identify
 * hazards in a lab scene, select the correct PPE, learn GHS hazard symbols,
 * and practice emergency response procedures.
 *
 * Grade-appropriate content:
 * - K-2: Simple safety rules, basic PPE (goggles, closed shoes), 2-3 obvious
 *         hazards, no GHS symbols, simple emergency steps.
 * - 3-5: More PPE options, 4-5 hazards, basic hazard symbols, simple
 *         emergency sequences, lab equipment names.
 * - 6-8: Full GHS symbols, complex scenarios, risk assessment, proper
 *         disposal, SDS basics, multiple emergency scenarios.
 *
 * @param topic - The topic or theme (e.g. "getting ready for a chemistry experiment", "fire safety in the lab")
 * @param gradeLevel - Grade level context string
 * @param config - Optional partial SafetyLabData for overrides
 * @returns SafetyLabData ready for the SafetyLab component
 */
export const generateSafetyLab = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<SafetyLabData>
): Promise<SafetyLabData> => {
  const gradeBand = resolveGradeBand(gradeLevel);

  const gradeBandDescriptions: Record<string, string> = {
    "K-2":
      "Grades K-2. Use VERY SIMPLE language a 5-7 year old can understand. " +
      "Focus on basic safety rules: 'Don't touch!', 'Tell a grown-up!', 'Walk, don't run!' " +
      "Only 2-3 OBVIOUS hazards that are easy to spot (spilled water on floor, open container, " +
      "running near tables). Basic PPE only: goggles and closed shoes. " +
      "NO GHS symbols (ghsSymbols should be empty array). " +
      "Simple emergency steps: 'Tell your teacher', 'Don't touch it', 'Move away'. " +
      "Challenges: equip_ppe (pick goggles and shoes), spot_hazard (find the spill), " +
      "safety_quiz ('Should you run in the lab? Yes or No'). " +
      "Make it feel like a fun game — 'Safety Detective!' " +
      "Use short sentences. No scary language about chemicals.",

    "3-5":
      "Grades 3-5. Kid-friendly but introduces more real lab equipment and safety concepts. " +
      "4-5 hazards including chemical spills, broken glass, and improper storage. " +
      "PPE options: goggles, gloves, apron, closed shoes. " +
      "Include 2-3 BASIC hazard symbols (flame, exclamation, corrosion) with simple meanings. " +
      "Simple emergency sequence (3-4 steps): 'Alert teacher → Move away → Follow instructions → Wash hands'. " +
      "Lab equipment names: beaker, test tube, Bunsen burner, graduated cylinder. " +
      "Challenges: equip_ppe, spot_hazard, match_symbols (match symbol to meaning), " +
      "emergency_response, safety_quiz. " +
      "Connect to real life: 'Cleaning products at home have these same symbols!'",

    "6-8":
      "Grades 6-8. Full scientific safety training with proper terminology. " +
      "5-6 hazards including chemical incompatibilities, electrical hazards, biological waste, " +
      "and improper ventilation. Complex scenario with multiple risk levels. " +
      "Full PPE options: goggles, gloves, apron, lab coat, face shield, closed shoes. " +
      "Include 4-6 GHS symbols with detailed meanings and real chemical examples: " +
      "flame (ethanol, acetone), skull (concentrated acids), corrosion (HCl, NaOH), " +
      "exclamation (dilute solutions), health_hazard (carcinogens), environment (heavy metals). " +
      "Complex emergency sequence (5-6 steps) for chemical spill or fire. " +
      "Introduce SDS (Safety Data Sheets) concepts: sections, where to find them, key info. " +
      "Challenges: equip_ppe, spot_hazard, match_symbols, emergency_response, " +
      "design_lab (identify what's wrong with a lab setup), safety_quiz (SDS questions). " +
      "Discuss proper chemical disposal, fume hoods, and incompatible chemicals.",
  };

  const generationPrompt = `Create a Lab Safety Training activity about "${topic}" for ${gradeBand} students.

GRADE BAND REQUIREMENTS (${gradeBand}):
${gradeBandDescriptions[gradeBand]}

CRITICAL REQUIREMENTS:
1. Scenario must describe a realistic lab situation appropriate for the grade band:
   - K-2: Simple exploration activities (mixing colors, growing plants, magnets)
   - 3-5: Basic science experiments (vinegar & baking soda, dissolving, states of matter)
   - 6-8: Chemistry/biology experiments (acid-base reactions, microscopy, dissection)

2. Hazards must have:
   - Unique ids (e.g. "h1", "h2")
   - Realistic types matching the scenario
   - Location coordinates as percentages (x: 0-100, y: 0-100) spread across the lab scene
   - Appropriate severity levels (most should be medium for younger grades)
   - Clear correction instructions in age-appropriate language

3. requiredPPE must use these exact keys: goggles, gloves, apron, lab_coat, face_shield, closed_shoes
   - K-2: just goggles and closed_shoes
   - 3-5: goggles, gloves, and one of apron or closed_shoes
   - 6-8: goggles, gloves, apron or lab_coat, and optionally face_shield

4. safetyEquipment must use these keys: eye_wash, fire_extinguisher, shower, first_aid, fume_hood
   - Include at least 2 relevant to the scenario

5. For grade 3-5 and 6-8, include ghsSymbols array with:
   - symbol: one of flame, skull, corrosion, exclamation, health_hazard, environment, oxidizer, gas_cylinder, explosive
   - meaning: clear explanation appropriate for the grade band
   - examples: 2-3 specific chemicals or products

6. emergencySequence should describe a plausible emergency and 3-6 steps in correct order:
   - K-2: "Tell the teacher" → "Move away" → "Wait for help" (3 steps)
   - 3-5: "Alert teacher" → "Move away" → "Don't touch" → "Follow cleanup instructions" (4 steps)
   - 6-8: "Alert everyone" → "Evacuate if needed" → "Use safety equipment" → "Contain spill" → "Report" → "Document" (5-6 steps)

7. Challenges should progress in difficulty:
   - equip_ppe: "Select the safety equipment you need for this experiment"
   - spot_hazard: "Find all the hazards hidden in this lab!"
   - match_symbols: "Match each hazard symbol to its meaning" (grade 3-5, 6-8)
   - emergency_response: "Put the emergency steps in the right order"
   - design_lab: "What's wrong with this lab setup?" (grade 6-8)
   - safety_quiz: "Quick quiz — test your safety knowledge!"

8. targetAnswer should include pipe-separated acceptable answers:
   - "goggles|gloves" for PPE challenges
   - "spill|water|floor" for hazard identification
   - "yes|no" for quiz questions

9. Each challenge id must be unique (e.g. "ch1", "ch2", "ch3").

10. Narrations should be encouraging and emphasize WHY safety matters:
    - "Great catch! That spill could make someone slip — now the lab is safer!"
    - "Perfect PPE selection! Your eyes and hands are protected."

11. showOptions should match the grade band:
    - K-2: showLabScene=true, showPPEStation=true, showGHSSymbols=false, showEmergencyStations=true, showTimer=false
    - 3-5: showLabScene=true, showPPEStation=true, showGHSSymbols=true, showEmergencyStations=true, showTimer=false
    - 6-8: showLabScene=true, showPPEStation=true, showGHSSymbols=true, showEmergencyStations=true, showTimer=true

12. Provide 2-3 challenges for K-2, 3-4 for grade 3-5, 5-6 for grade 6-8.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: safetyLabSchema,
        systemInstruction:
          "You are an expert science safety educator creating interactive lab safety " +
          "training activities for students. Design engaging activities where students " +
          "learn to identify hazards, select proper PPE (Personal Protective Equipment), " +
          "understand GHS (Globally Harmonized System) hazard symbols, and practice " +
          "emergency response procedures. Safety is CRITICAL — every scientist must " +
          "know how to protect themselves and others. Make safety training feel like " +
          "an exciting detective game for younger students and a professional certification " +
          "course for older students. Use accurate safety information — real PPE names, " +
          "real GHS symbols, real emergency procedures. Language should be age-appropriate: " +
          "simple rules and games for K-2, practical skills for 3-5, and professional " +
          "safety culture for 6-8. Connect to real life: cleaning product labels, " +
          "kitchen safety, construction sites, hospital protocols.",
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error(
        "No data returned from Gemini API for safety-lab"
      );
    }

    const result = JSON.parse(text) as SafetyLabData;

    // -----------------------------------------------------------------------
    // Validation & Defaults
    // -----------------------------------------------------------------------

    // Ensure gradeBand
    if (
      !result.gradeBand ||
      !["K-2", "3-5", "6-8"].includes(result.gradeBand)
    ) {
      result.gradeBand = gradeBand;
    }

    // Ensure scenario has valid structure
    if (!result.scenario) {
      result.scenario = {
        name: "Science Lab Setup",
        experiment: "Preparing for a basic science experiment",
        hazards: [
          {
            id: "h1",
            type: "slip",
            description: "Water spilled on the floor near the sink",
            location: { x: 30, y: 70 },
            severity: "medium",
            correction: "Wipe up the spill with paper towels immediately",
          },
          {
            id: "h2",
            type: "glass",
            description: "Cracked beaker on the table edge",
            location: { x: 60, y: 40 },
            severity: "high",
            correction:
              "Tell the teacher and do not touch the broken glass",
          },
        ],
        requiredPPE:
          gradeBand === "K-2"
            ? ["goggles", "closed_shoes"]
            : gradeBand === "3-5"
              ? ["goggles", "gloves", "closed_shoes"]
              : ["goggles", "gloves", "apron", "closed_shoes"],
        safetyEquipment: ["eye_wash", "first_aid"],
      };
    } else {
      // Ensure scenario sub-fields
      result.scenario = {
        name: result.scenario.name || "Lab Scenario",
        experiment:
          result.scenario.experiment || "A science experiment",
        hazards: Array.isArray(result.scenario.hazards)
          ? result.scenario.hazards.map((h, idx) => ({
              ...h,
              id: h.id || `h${idx + 1}`,
              type: h.type || "chemical",
              description: h.description || `Hazard ${idx + 1}`,
              location: {
                x: h.location?.x ?? 20 + idx * 20,
                y: h.location?.y ?? 50,
              },
              severity: h.severity || "medium",
              correction: h.correction || "Report to the teacher",
            }))
          : [
              {
                id: "h1",
                type: "slip" as const,
                description: "Spill on the floor",
                location: { x: 40, y: 70 },
                severity: "medium" as const,
                correction: "Clean it up right away",
              },
            ],
        requiredPPE: Array.isArray(result.scenario.requiredPPE)
          ? result.scenario.requiredPPE
          : ["goggles", "closed_shoes"],
        safetyEquipment: Array.isArray(result.scenario.safetyEquipment)
          ? result.scenario.safetyEquipment
          : ["eye_wash", "first_aid"],
      };
    }

    // Ensure ghsSymbols based on grade band
    if (gradeBand === "K-2") {
      result.ghsSymbols = [];
    } else if (
      !result.ghsSymbols ||
      !Array.isArray(result.ghsSymbols)
    ) {
      result.ghsSymbols =
        gradeBand === "3-5"
          ? [
              {
                symbol: "flame",
                meaning: "Flammable — catches fire easily",
                examples: ["rubbing alcohol", "hand sanitizer"],
              },
              {
                symbol: "exclamation",
                meaning: "Warning — may irritate skin or eyes",
                examples: ["dish soap concentrate", "vinegar"],
              },
              {
                symbol: "corrosion",
                meaning: "Corrosive — can burn skin or damage surfaces",
                examples: ["oven cleaner", "drain cleaner"],
              },
            ]
          : [
              {
                symbol: "flame",
                meaning: "Flammable — catches fire easily when near heat or sparks",
                examples: ["ethanol", "acetone", "methanol"],
              },
              {
                symbol: "skull",
                meaning: "Toxic — can cause serious illness or death if inhaled, swallowed, or absorbed",
                examples: ["concentrated sulfuric acid", "mercury", "cyanide"],
              },
              {
                symbol: "corrosion",
                meaning: "Corrosive — destroys skin tissue and corrodes metals",
                examples: ["hydrochloric acid", "sodium hydroxide", "nitric acid"],
              },
              {
                symbol: "exclamation",
                meaning: "Irritant — causes skin, eye, or respiratory irritation",
                examples: ["dilute acetic acid", "isopropanol", "calcium chloride"],
              },
              {
                symbol: "health_hazard",
                meaning: "Health hazard — may cause cancer, organ damage, or other long-term effects",
                examples: ["formaldehyde", "benzene", "asbestos"],
              },
              {
                symbol: "environment",
                meaning: "Environmental hazard — toxic to aquatic life",
                examples: ["copper sulfate", "lead compounds", "mercury"],
              },
            ];
    } else {
      result.ghsSymbols = result.ghsSymbols.map((sym) => ({
        ...sym,
        symbol: sym.symbol || "exclamation",
        meaning: sym.meaning || "Hazard warning",
        examples: Array.isArray(sym.examples) ? sym.examples : [],
      }));
    }

    // Ensure emergencySequence
    if (!result.emergencySequence) {
      if (gradeBand === "K-2") {
        result.emergencySequence = {
          scenario: "Someone spills water on the floor!",
          correctOrder: [
            "Tell the teacher",
            "Move away from the spill",
            "Wait for the teacher to clean it up",
          ],
        };
      } else if (gradeBand === "3-5") {
        result.emergencySequence = {
          scenario: "A beaker falls and breaks on the floor!",
          correctOrder: [
            "Alert your teacher immediately",
            "Move away from the broken glass",
            "Do not try to pick up glass with your hands",
            "Let the teacher clean it up with a dustpan and brush",
          ],
        };
      } else {
        result.emergencySequence = {
          scenario:
            "A chemical spills on the lab bench and splashes onto your partner's arm!",
          correctOrder: [
            "Call out to alert everyone nearby",
            "Help your partner to the emergency wash station",
            "Flush the affected area with water for 15 minutes",
            "Remove contaminated clothing if safe to do so",
            "Report the incident to the teacher",
            "Fill out an incident report",
          ],
        };
      }
    } else {
      result.emergencySequence = {
        scenario:
          result.emergencySequence.scenario || "An emergency occurs in the lab!",
        correctOrder: Array.isArray(result.emergencySequence.correctOrder)
          ? result.emergencySequence.correctOrder
          : ["Alert the teacher", "Move to safety", "Wait for instructions"],
      };
    }

    // Ensure showOptions defaults based on grade band
    const isKinder = gradeBand === "K-2";
    const isOlder = gradeBand === "6-8";
    result.showOptions = {
      showLabScene: result.showOptions?.showLabScene ?? true,
      showPPEStation: result.showOptions?.showPPEStation ?? true,
      showGHSSymbols:
        result.showOptions?.showGHSSymbols ?? !isKinder,
      showEmergencyStations:
        result.showOptions?.showEmergencyStations ?? true,
      showTimer: result.showOptions?.showTimer ?? isOlder,
    };

    // Ensure every challenge has required fields
    if (result.challenges && Array.isArray(result.challenges)) {
      result.challenges = result.challenges.map((ch, idx) => ({
        ...ch,
        id: ch.id || `ch${idx + 1}`,
        type: ch.type || "equip_ppe",
        instruction:
          ch.instruction ||
          "Complete this safety challenge!",
        targetAnswer: ch.targetAnswer || "goggles",
        hint:
          ch.hint ||
          "Think about what could keep you safe!",
        narration:
          ch.narration || ch.instruction || "Safety first!",
      }));
    }

    // Ensure at least one challenge exists
    if (!result.challenges || result.challenges.length === 0) {
      result.challenges = [
        {
          id: "ch1",
          type: "equip_ppe",
          instruction:
            "Select all the safety equipment you need before starting the experiment.",
          targetAnswer:
            result.scenario.requiredPPE.join("|"),
          hint: "Think about what parts of your body need protection!",
          narration:
            "Great job suiting up! A real scientist always puts on safety gear before starting any experiment.",
        },
        {
          id: "ch2",
          type: "spot_hazard",
          instruction:
            "Look around the lab carefully. Can you spot all the hazards?",
          targetAnswer: "hazard|danger|unsafe",
          hint: "Look for things that are out of place, spilled, or broken!",
          narration:
            "Excellent detective work! Finding hazards BEFORE they cause problems is the mark of a true scientist.",
        },
        {
          id: "ch3",
          type: "safety_quiz",
          instruction:
            "Quick quiz: Should you eat or drink in a science lab?",
          targetAnswer: "no|never|not",
          hint: "Chemicals could get on your food — even ones you can't see!",
          narration:
            "That's right — NEVER eat or drink in a lab! Even tiny amounts of chemicals could be harmful.",
        },
      ];
    }

    // Apply config overrides if provided
    if (config) {
      if (config.title !== undefined) result.title = config.title;
      if (config.description !== undefined)
        result.description = config.description;
      if (config.scenario !== undefined)
        result.scenario = { ...result.scenario, ...config.scenario };
      if (config.ghsSymbols !== undefined)
        result.ghsSymbols = config.ghsSymbols;
      if (config.emergencySequence !== undefined)
        result.emergencySequence = config.emergencySequence;
      if (config.challenges !== undefined)
        result.challenges = config.challenges;
      if (config.showOptions !== undefined)
        result.showOptions = { ...result.showOptions, ...config.showOptions };
      if (config.gradeBand !== undefined) result.gradeBand = config.gradeBand;
    }

    console.log("\uD83E\uDD7D Safety Lab Generated:", {
      title: result.title,
      gradeBand: result.gradeBand,
      scenarioName: result.scenario?.name,
      hazardCount: result.scenario?.hazards?.length ?? 0,
      requiredPPE: result.scenario?.requiredPPE ?? [],
      ghsSymbolCount: result.ghsSymbols?.length ?? 0,
      challengeCount: result.challenges?.length ?? 0,
      showOptions: result.showOptions,
    });

    return result;
  } catch (error) {
    console.error("Error generating safety-lab data:", error);
    throw error;
  }
};
