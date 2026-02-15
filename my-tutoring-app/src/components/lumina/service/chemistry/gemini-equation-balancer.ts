import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import {
  EquationBalancerData,
} from "../../primitives/visual-primitives/chemistry/EquationBalancer";

// Re-export type for convenience (no redefinition — sourced from the component)
export type { EquationBalancerData };

/**
 * Schema definition for Equation Balancer Data
 *
 * Describes the JSON structure Gemini must return:
 * - equation: reactants + products with atom counts
 * - solution: correct coefficients in order (all reactants then all products)
 * - challenges: sequenced balancing challenges (count_atoms → spot_imbalance → balance → complex_balance → timed)
 * - showOptions: UI toggles for atom counter, molecule visual, balance scale, guided mode, history, max coefficient
 * - gradeBand: 6-7 or 7-8
 */
const equationBalancerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description:
        "Short, engaging title for the activity (e.g. 'Balance the Combustion!')",
    },
    description: {
      type: Type.STRING,
      description:
        "One-sentence activity description in kid-friendly language",
    },
    equation: {
      type: Type.OBJECT,
      description:
        "The chemical equation to balance, with reactants and products",
      properties: {
        reactants: {
          type: Type.ARRAY,
          description: "Array of reactant compounds",
          items: {
            type: Type.OBJECT,
            properties: {
              formula: {
                type: Type.STRING,
                description:
                  "Chemical formula of the compound (e.g. 'H2O', 'CH4', 'O2')",
              },
              coefficient: {
                type: Type.NUMBER,
                description:
                  "Starting coefficient (should default to 1 so students adjust from scratch)",
              },
              atoms: {
                type: Type.OBJECT,
                description:
                  "Map of element symbol to atom count in ONE molecule of this compound (e.g. { 'H': 2, 'O': 1 } for H2O). Keys are element symbols, values are integer counts.",
              },
            },
            required: ["formula", "coefficient", "atoms"],
          },
        },
        products: {
          type: Type.ARRAY,
          description: "Array of product compounds",
          items: {
            type: Type.OBJECT,
            properties: {
              formula: {
                type: Type.STRING,
                description:
                  "Chemical formula of the compound",
              },
              coefficient: {
                type: Type.NUMBER,
                description:
                  "Starting coefficient (should default to 1 so students adjust from scratch)",
              },
              atoms: {
                type: Type.OBJECT,
                description:
                  "Map of element symbol to atom count in ONE molecule of this compound. Keys are element symbols, values are integer counts.",
              },
            },
            required: ["formula", "coefficient", "atoms"],
          },
        },
        arrow: {
          type: Type.STRING,
          enum: ["\u2192", "\u21CC"],
          description:
            "Arrow type: \u2192 for irreversible reactions, \u21CC for reversible/equilibrium reactions",
        },
      },
      required: ["reactants", "products", "arrow"],
    },
    solution: {
      type: Type.OBJECT,
      description:
        "The correct solution: coefficients in order (all reactants first, then all products)",
      properties: {
        coefficients: {
          type: Type.ARRAY,
          description:
            "Array of correct coefficients in order: [reactant1, reactant2, ..., product1, product2, ...]",
          items: {
            type: Type.NUMBER,
          },
        },
      },
      required: ["coefficients"],
    },
    challenges: {
      type: Type.ARRAY,
      description:
        "3-6 sequenced challenges progressing in difficulty: count_atoms \u2192 spot_imbalance \u2192 balance \u2192 complex_balance \u2192 timed",
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
              "count_atoms",
              "spot_imbalance",
              "balance",
              "complex_balance",
              "timed",
            ],
            description: "Type of challenge task",
          },
          instruction: {
            type: Type.STRING,
            description:
              "Kid-friendly instruction for this challenge",
          },
          equation: {
            type: Type.STRING,
            description:
              "The equation as a string (e.g. 'H2 + O2 \u2192 H2O')",
          },
          difficulty: {
            type: Type.STRING,
            enum: ["simple", "moderate", "complex"],
            description: "Difficulty level of the challenge",
          },
          timeLimit: {
            type: Type.NUMBER,
            description:
              "Time limit in seconds for timed challenges, or null for untimed",
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
        },
        required: [
          "id",
          "type",
          "instruction",
          "equation",
          "difficulty",
          "timeLimit",
          "hint",
          "narration",
        ],
      },
    },
    showOptions: {
      type: Type.OBJECT,
      description: "Which UI panels to enable for this activity",
      properties: {
        showAtomCounter: {
          type: Type.BOOLEAN,
          description:
            "Show the atom counter table comparing reactant vs product atom totals",
        },
        showMoleculeVisual: {
          type: Type.BOOLEAN,
          description:
            "Show molecule cluster visuals (colored atom circles for each compound)",
        },
        showBalanceScale: {
          type: Type.BOOLEAN,
          description:
            "Show the visual balance scale that tips when atoms are unequal",
        },
        showGuided: {
          type: Type.BOOLEAN,
          description:
            "Show guided mode option that walks students through balancing one element at a time",
        },
        showHistory: {
          type: Type.BOOLEAN,
          description: "Show undo/redo history controls",
        },
        maxCoefficient: {
          type: Type.NUMBER,
          description:
            "Maximum coefficient value students can set (6 for grade 6-7, 10 for grade 7-8)",
        },
      },
      required: [
        "showAtomCounter",
        "showMoleculeVisual",
        "showBalanceScale",
        "showGuided",
        "showHistory",
        "maxCoefficient",
      ],
    },
    gradeBand: {
      type: Type.STRING,
      enum: ["6-7", "7-8"],
      description: "Target grade band for content complexity",
    },
  },
  required: [
    "title",
    "description",
    "equation",
    "solution",
    "challenges",
    "showOptions",
    "gradeBand",
  ],
};

/**
 * Determine the grade band from grade level context string
 */
const resolveGradeBand = (gradeLevel: string): "6-7" | "7-8" => {
  const gl = gradeLevel.toLowerCase();
  if (
    gl.includes("8") ||
    gl.includes("grade 8") ||
    gl.includes("7-8") ||
    gl.includes("advanced")
  ) {
    return "7-8";
  }
  return "6-7";
};

/**
 * Generate Equation Balancer data using Gemini
 *
 * Creates an interactive chemical equation balancing activity where students
 * adjust coefficients to balance equations, with atom counters, molecule
 * visuals, and a balance scale visualization.
 *
 * Grade-appropriate content:
 * - 6-7: Simple equations (synthesis, decomposition), max coefficient 6,
 *         guided mode enabled, smaller molecules (2-3 elements)
 * - 7-8: More complex equations (combustion, double replacement), max coefficient 10,
 *         timed challenges available, larger molecules
 *
 * @param topic - The topic or theme (e.g. "combustion reactions", "balancing equations")
 * @param gradeLevel - Grade level context string
 * @param config - Optional partial EquationBalancerData for overrides
 * @returns EquationBalancerData ready for the EquationBalancer component
 */
export const generateEquationBalancer = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<EquationBalancerData>
): Promise<EquationBalancerData> => {
  const gradeBand = resolveGradeBand(gradeLevel);

  const gradeBandDescriptions: Record<string, string> = {
    "6-7":
      "Grades 6-7. Focus on SIMPLE equations with 2-3 compounds total. " +
      "Reaction types: synthesis (A + B \u2192 AB), decomposition (AB \u2192 A + B), " +
      "single replacement (A + BC \u2192 AC + B). " +
      "Use common molecules: H2, O2, H2O, CO2, NaCl, Fe, etc. " +
      "Max coefficient: 6. Show guided mode. " +
      "Challenges should start with count_atoms (just counting), then spot_imbalance " +
      "(identifying which elements are off), then balance (actually balancing). " +
      "Use kid-friendly language: 'How many oxygen atoms are on each side?' " +
      "Keep atom maps simple: at most 3 different elements per equation. " +
      "NO timed challenges. NO complex_balance type.",
    "7-8":
      "Grades 7-8. Include more complex equations with 3-4 compounds. " +
      "Reaction types: combustion (CxHy + O2 \u2192 CO2 + H2O), double replacement, " +
      "acid-base neutralization. " +
      "Use molecules like CH4, C2H6, C3H8, Ca(OH)2, H2SO4, etc. " +
      "Max coefficient: 10. Guided mode optional. " +
      "Include at least one complex_balance challenge. May include one timed challenge. " +
      "Use scientific vocabulary: 'conservation of mass', 'stoichiometric coefficients'. " +
      "Atom maps can include 3-4 different elements. " +
      "Connect to real-world chemistry: 'This is the same reaction that powers a car engine!'",
  };

  const generationPrompt = `Create an Equation Balancer activity about "${topic}" for ${gradeBand} students.

GRADE BAND REQUIREMENTS (${gradeBand}):
${gradeBandDescriptions[gradeBand]}

CRITICAL REQUIREMENTS:
1. The "atoms" field in each compound must accurately reflect the number of each element in ONE molecule of that compound.
   - H2O: { "H": 2, "O": 1 }
   - CO2: { "C": 1, "O": 2 }
   - CH4: { "C": 1, "H": 4 }
   - Fe2O3: { "Fe": 2, "O": 3 }
   - Ca(OH)2: { "Ca": 1, "O": 2, "H": 2 }

2. The "solution.coefficients" array must contain the CORRECT coefficients that balance the equation.
   - Order: all reactants first (left to right), then all products (left to right).
   - When balanced, for every element: sum(coefficient * atoms_in_compound) must be equal on both sides.
   - Use the SMALLEST whole number coefficients (e.g. [2, 1, 2] not [4, 2, 4]).
   - Example: 2H2 + O2 -> 2H2O has solution coefficients [2, 1, 2].

3. Starting coefficients in the equation should all be 1 (so students start from scratch).

4. The "arrow" field should be "\u2192" for standard reactions and "\u21CC" only for equilibrium reactions.

5. Challenges should progress in difficulty:
   - count_atoms: "How many hydrogen atoms are on the reactant side?"
   - spot_imbalance: "Which element is NOT balanced?"
   - balance: "Balance this equation by adjusting the coefficients."
   - complex_balance: "Balance this combustion reaction." (grade 7-8 only)
   - timed: "Balance this equation in 60 seconds!" (grade 7-8 only)

6. Each challenge's "equation" field should be the equation written as a string (e.g. "H2 + O2 \u2192 H2O").

7. Provide 3-5 challenges sequenced by difficulty.

8. Each challenge id must be unique (e.g. "ch1", "ch2", "ch3").

9. Narrations should be educational and encouraging:
   - "Every atom that enters the reaction must come out! That's conservation of mass."
   - "You balanced it! The same number of each element on both sides \u2014 nothing created, nothing destroyed."

10. showOptions should be set based on grade band:
   - 6-7: showAtomCounter: true, showMoleculeVisual: true, showBalanceScale: true, showGuided: true, showHistory: true, maxCoefficient: 6
   - 7-8: showAtomCounter: true, showMoleculeVisual: true, showBalanceScale: true, showGuided: false, showHistory: true, maxCoefficient: 10

DOUBLE-CHECK: Verify that your solution coefficients actually balance the equation before returning. Multiply each compound's atom counts by its solution coefficient, then confirm that each element's total on the reactant side equals its total on the product side.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: equationBalancerSchema,
        systemInstruction:
          "You are an expert chemistry educator creating interactive equation-balancing activities " +
          "for grades 6-8. Design engaging challenges where students discover that atoms are conserved " +
          "in chemical reactions \u2014 the same number of each type of atom must appear on both sides of " +
          "the equation. Students adjust coefficients (the big numbers in front of formulas) to balance, " +
          "but never change subscripts. Use accurate chemistry: atom counts must be correct for each " +
          "formula, and solution coefficients must genuinely balance the equation using the smallest " +
          "whole numbers. Language should be age-appropriate: clear and encouraging for younger students, " +
          "with proper scientific vocabulary for older students. Connect to real-world examples so " +
          "students see why balancing matters (cooking, combustion, photosynthesis, rust).",
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error(
        "No data returned from Gemini API for equation-balancer"
      );
    }

    const result = JSON.parse(text) as EquationBalancerData;

    // -----------------------------------------------------------------------
    // Validation & Defaults
    // -----------------------------------------------------------------------

    // Ensure gradeBand
    if (!result.gradeBand || !["6-7", "7-8"].includes(result.gradeBand)) {
      result.gradeBand = gradeBand;
    }

    // Ensure equation has valid structure
    if (!result.equation) {
      result.equation = {
        reactants: [
          { formula: "H2", coefficient: 1, atoms: { H: 2 } },
          { formula: "O2", coefficient: 1, atoms: { O: 2 } },
        ],
        products: [
          { formula: "H2O", coefficient: 1, atoms: { H: 2, O: 1 } },
        ],
        arrow: "\u2192",
      };
    }

    // Ensure arrow defaults
    if (!result.equation.arrow) {
      result.equation.arrow = "\u2192";
    }

    // Ensure all coefficients default to 1
    if (result.equation.reactants) {
      result.equation.reactants = result.equation.reactants.map((r) => ({
        ...r,
        coefficient: r.coefficient ?? 1,
        atoms: r.atoms || {},
      }));
    }
    if (result.equation.products) {
      result.equation.products = result.equation.products.map((p) => ({
        ...p,
        coefficient: p.coefficient ?? 1,
        atoms: p.atoms || {},
      }));
    }

    // Ensure solution exists
    if (!result.solution || !result.solution.coefficients) {
      const totalCompounds =
        (result.equation.reactants?.length || 0) +
        (result.equation.products?.length || 0);
      result.solution = {
        coefficients: Array(totalCompounds).fill(1),
      };
    }

    // Ensure showOptions defaults
    result.showOptions = {
      showAtomCounter: result.showOptions?.showAtomCounter ?? true,
      showMoleculeVisual: result.showOptions?.showMoleculeVisual ?? true,
      showBalanceScale: result.showOptions?.showBalanceScale ?? true,
      showGuided: result.showOptions?.showGuided ?? gradeBand === "6-7",
      showHistory: result.showOptions?.showHistory ?? true,
      maxCoefficient:
        result.showOptions?.maxCoefficient ??
        (gradeBand === "6-7" ? 6 : 10),
    };

    // Ensure every challenge has required fields
    if (result.challenges) {
      result.challenges = result.challenges.map((ch, idx) => ({
        ...ch,
        id: ch.id || `ch${idx + 1}`,
        type: ch.type || "balance",
        instruction:
          ch.instruction ||
          "Balance the equation by adjusting the coefficients!",
        equation: ch.equation || "",
        difficulty: ch.difficulty || "simple",
        timeLimit: ch.timeLimit ?? null,
        hint:
          ch.hint ||
          "Remember: the same number of each atom must appear on both sides!",
        narration: ch.narration || ch.instruction || "Great work!",
      }));
    }

    // Ensure at least one challenge exists
    if (!result.challenges || result.challenges.length === 0) {
      result.challenges = [
        {
          id: "ch1",
          type: "count_atoms",
          instruction:
            "Count the atoms on each side of this equation. How many hydrogen atoms are on the left?",
          equation: "H2 + O2 \u2192 H2O",
          difficulty: "simple",
          timeLimit: null,
          hint: "Look at the subscript in H2 \u2014 that tells you how many hydrogen atoms are in one molecule!",
          narration:
            "Counting atoms is the first step to balancing! Each subscript tells you how many of that atom are in the molecule.",
        },
        {
          id: "ch2",
          type: "spot_imbalance",
          instruction:
            "Look at the unbalanced equation. Which element has a different count on each side?",
          equation: "H2 + O2 \u2192 H2O",
          difficulty: "simple",
          timeLimit: null,
          hint: "Count the oxygen atoms on each side. Are they equal?",
          narration:
            "Spotting the imbalance is key! Oxygen has 2 atoms on the left but only 1 on the right.",
        },
        {
          id: "ch3",
          type: "balance",
          instruction:
            "Now balance the equation! Adjust coefficients so every element matches on both sides.",
          equation: "H2 + O2 \u2192 H2O",
          difficulty: "moderate",
          timeLimit: null,
          hint: "Try putting a 2 in front of H2O first, then see what else needs to change.",
          narration:
            "2H2 + O2 \u2192 2H2O. Every hydrogen and every oxygen is accounted for \u2014 that's conservation of mass!",
        },
      ];
    }

    // Apply config overrides if provided
    if (config) {
      if (config.title !== undefined) result.title = config.title;
      if (config.description !== undefined)
        result.description = config.description;
      if (config.equation !== undefined)
        result.equation = { ...result.equation, ...config.equation };
      if (config.solution !== undefined) result.solution = config.solution;
      if (config.challenges !== undefined)
        result.challenges = config.challenges;
      if (config.showOptions !== undefined)
        result.showOptions = { ...result.showOptions, ...config.showOptions };
      if (config.gradeBand !== undefined) result.gradeBand = config.gradeBand;
    }

    console.log("\u2696\uFE0F Equation Balancer Generated:", {
      title: result.title,
      gradeBand: result.gradeBand,
      reactantCount: result.equation.reactants?.length ?? 0,
      productCount: result.equation.products?.length ?? 0,
      challengeCount: result.challenges?.length ?? 0,
      maxCoefficient: result.showOptions.maxCoefficient,
      solutionCoefficients: result.solution.coefficients,
    });

    return result;
  } catch (error) {
    console.error("Error generating equation-balancer data:", error);
    throw error;
  }
};
