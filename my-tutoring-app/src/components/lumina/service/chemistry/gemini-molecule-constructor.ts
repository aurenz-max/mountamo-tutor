import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import {
  MoleculeConstructorData,
  MoleculeConstructorChallenge,
  MoleculeGalleryEntry,
  MoleculeConstructorShowOptions,
} from "../../primitives/visual-primitives/chemistry/MoleculeConstructor";

// Re-export types for convenience (no redefinition — sourced from the component)
export type {
  MoleculeConstructorData,
  MoleculeConstructorChallenge,
  MoleculeGalleryEntry,
  MoleculeConstructorShowOptions,
};

/**
 * Schema definition for Molecule Constructor Data
 *
 * Describes the JSON structure Gemini must return:
 * - targetMolecule: the molecule students should build (atoms, bonds, real-world use)
 * - palette: available elements and display toggles
 * - challenges: sequenced build/identify/formula/predict challenges
 * - moleculeGallery: collection of related molecules to unlock
 * - showOptions: UI toggles for formula, name, valence satisfaction, etc.
 * - gradeBand: 3-5 or 6-8
 */
const moleculeConstructorSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description:
        "Short, engaging title for the activity (e.g. 'Build a Water Molecule!')",
    },
    description: {
      type: Type.STRING,
      description:
        "One-sentence activity description in kid-friendly language",
    },
    targetMolecule: {
      type: Type.OBJECT,
      description: "The primary target molecule for this activity",
      properties: {
        name: {
          type: Type.STRING,
          description:
            "Common name of the molecule (e.g. 'Water') or null for free build",
          nullable: true,
        },
        formula: {
          type: Type.STRING,
          description:
            "Molecular formula (e.g. 'H2O') or null for free build",
          nullable: true,
        },
        atoms: {
          type: Type.ARRAY,
          description:
            "List of atoms in the molecule with element symbol and count",
          items: {
            type: Type.OBJECT,
            properties: {
              element: {
                type: Type.STRING,
                description: "Element symbol (e.g. 'H', 'O', 'C')",
              },
              count: {
                type: Type.NUMBER,
                description: "Number of this element in the molecule",
              },
            },
            required: ["element", "count"],
          },
        },
        bonds: {
          type: Type.ARRAY,
          description:
            "List of bonds between atoms (atom indices are 0-based positions in the atoms array)",
          items: {
            type: Type.OBJECT,
            properties: {
              atom1: {
                type: Type.NUMBER,
                description: "Index of the first atom",
              },
              atom2: {
                type: Type.NUMBER,
                description: "Index of the second atom",
              },
              type: {
                type: Type.STRING,
                enum: ["single", "double", "triple"],
                description: "Type of chemical bond",
              },
            },
            required: ["atom1", "atom2", "type"],
          },
        },
        realWorldUse: {
          type: Type.STRING,
          description:
            "Real-world connection for the molecule (e.g. 'Water covers 71% of Earth and is essential for all life!')",
        },
        imagePrompt: {
          type: Type.STRING,
          description:
            "Prompt for generating a real-world image of this molecule in action",
        },
      },
      required: ["name", "formula", "atoms", "bonds", "realWorldUse", "imagePrompt"],
    },
    palette: {
      type: Type.OBJECT,
      description: "Element palette configuration",
      properties: {
        availableElements: {
          type: Type.ARRAY,
          description:
            "Element symbols available to students (e.g. ['H', 'C', 'N', 'O'])",
          items: { type: Type.STRING },
        },
        showValence: {
          type: Type.BOOLEAN,
          description: "Whether to show valence bond counts on element buttons",
        },
        showElectronDots: {
          type: Type.BOOLEAN,
          description:
            "Whether to show Lewis dot notation around atoms (grades 6-8 only)",
        },
      },
      required: ["availableElements", "showValence", "showElectronDots"],
    },
    challenges: {
      type: Type.ARRAY,
      description:
        "3-6 sequenced challenges progressing in difficulty: free_build, build_target, identify, formula_write, predict_bonds, shape_predict",
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique challenge identifier (e.g. 'ch1')",
          },
          type: {
            type: Type.STRING,
            enum: [
              "free_build",
              "build_target",
              "identify",
              "formula_write",
              "predict_bonds",
              "shape_predict",
            ],
            description: "Type of challenge task",
          },
          instruction: {
            type: Type.STRING,
            description: "Kid-friendly instruction for this challenge",
          },
          targetFormula: {
            type: Type.STRING,
            description:
              "Molecular formula the student must build (e.g. 'CH4'). Use empty string '' for free_build.",
          },
          targetName: {
            type: Type.STRING,
            description:
              "Common name of the target molecule (e.g. 'Methane'). Use empty string '' for free_build.",
          },
          targetAtoms: {
            type: Type.ARRAY,
            description:
              "Explicit atom counts for this challenge. E.g. [{element:'C',count:1},{element:'H',count:4}] for CH4. Use empty array [] for free_build.",
            items: {
              type: Type.OBJECT,
              properties: {
                element: {
                  type: Type.STRING,
                  description: "Element symbol (e.g. 'H', 'O', 'C')",
                },
                count: {
                  type: Type.NUMBER,
                  description: "Number of this element needed",
                },
              },
              required: ["element", "count"],
            },
          },
          hint: {
            type: Type.STRING,
            description: "Gentle hint if the student is stuck",
          },
          narration: {
            type: Type.STRING,
            description:
              "Wonder-driven narration text to celebrate success and teach",
          },
        },
        required: [
          "id",
          "type",
          "instruction",
          "targetFormula",
          "targetName",
          "targetAtoms",
          "hint",
          "narration",
        ],
      },
    },
    moleculeGallery: {
      type: Type.ARRAY,
      description:
        "Collection of related molecules students can unlock by completing challenges",
      items: {
        type: Type.OBJECT,
        properties: {
          name: {
            type: Type.STRING,
            description: "Common name of the molecule",
          },
          formula: {
            type: Type.STRING,
            description: "Molecular formula",
          },
          category: {
            type: Type.STRING,
            enum: ["essential", "food", "atmosphere", "energy", "household"],
            description: "Category for grouping and color-coding",
          },
          unlocked: {
            type: Type.BOOLEAN,
            description:
              "Whether this molecule starts unlocked (usually false)",
          },
          imagePrompt: {
            type: Type.STRING,
            description:
              "Prompt for generating a real-world image of this molecule",
          },
        },
        required: ["name", "formula", "category", "unlocked", "imagePrompt"],
      },
    },
    showOptions: {
      type: Type.OBJECT,
      description: "Which UI panels and features to enable",
      properties: {
        showFormula: {
          type: Type.BOOLEAN,
          description: "Show the live molecular formula display",
        },
        showName: {
          type: Type.BOOLEAN,
          description: "Show the target molecule name and info panel",
        },
        showRealWorldImage: {
          type: Type.BOOLEAN,
          description: "Show a real-world image of the target molecule",
        },
        showValenceSatisfaction: {
          type: Type.BOOLEAN,
          description:
            "Show green/red dots indicating whether each atom's valence is satisfied",
        },
        show3DToggle: {
          type: Type.BOOLEAN,
          description: "Show a toggle for 3D molecule view (future feature)",
        },
        showElectronDots: {
          type: Type.BOOLEAN,
          description:
            "Show Lewis electron dots around atoms (grades 6-8 only)",
        },
        showBondType: {
          type: Type.BOOLEAN,
          description: "Show bond type labels (single, double, triple)",
        },
      },
      required: [
        "showFormula",
        "showName",
        "showRealWorldImage",
        "showValenceSatisfaction",
        "show3DToggle",
        "showElectronDots",
        "showBondType",
      ],
    },
    gradeBand: {
      type: Type.STRING,
      enum: ["3-5", "6-8"],
      description: "Target grade band for content complexity",
    },
  },
  required: [
    "title",
    "description",
    "targetMolecule",
    "palette",
    "challenges",
    "moleculeGallery",
    "showOptions",
    "gradeBand",
  ],
};

/**
 * Determine the grade band from grade level context string
 */
const resolveGradeBand = (gradeLevel: string): "3-5" | "6-8" => {
  const gl = gradeLevel.toLowerCase();
  if (
    gl.includes("6") ||
    gl.includes("7") ||
    gl.includes("8") ||
    gl.includes("middle") ||
    gl.includes("grade 6") ||
    gl.includes("grade 7") ||
    gl.includes("grade 8")
  ) {
    return "6-8";
  }
  return "3-5";
};

/**
 * Known molecule formula ↔ name mappings for cross-referencing.
 */
const FORMULA_TO_NAME: Record<string, string> = {
  H2: "Hydrogen Gas",
  H2O: "Water",
  CH4: "Methane",
  CO2: "Carbon Dioxide",
  O2: "Oxygen",
  N2: "Nitrogen",
  NH3: "Ammonia",
  C6H12O6: "Glucose",
  NaCl: "Sodium Chloride",
  C2H5OH: "Ethanol",
  HCl: "Hydrochloric Acid",
  H2SO4: "Sulfuric Acid",
  NO2: "Nitrogen Dioxide",
  SO2: "Sulfur Dioxide",
  C2H6: "Ethane",
  C3H8: "Propane",
  H2O2: "Hydrogen Peroxide",
};

const NAME_TO_FORMULA: Record<string, string> = Object.fromEntries(
  Object.entries(FORMULA_TO_NAME).map(([f, n]) => [n.toLowerCase(), f])
);

/** Parse a molecular formula (e.g. "CH4") into atom counts. */
function parseFormulaToAtoms(
  formula: string
): { element: string; count: number }[] {
  const counts: Record<string, number> = {};
  const regex = /([A-Z][a-z]?)(\d*)/g;
  let match;
  while ((match = regex.exec(formula)) !== null) {
    if (!match[1]) continue;
    counts[match[1]] =
      (counts[match[1]] || 0) + (match[2] ? parseInt(match[2]) : 1);
  }
  return Object.entries(counts).map(([element, count]) => ({ element, count }));
}

/**
 * Generate Molecule Constructor data using Gemini
 *
 * Creates an interactive molecule-building activity where students snap atoms
 * together to construct molecules, learning about chemical bonding, valence,
 * molecular formulas, and how molecular structure determines properties.
 *
 * Grade-appropriate content:
 * - 3-5: Simple molecules (H2O, O2, CO2, CH4). "Atoms connect to make molecules."
 *        Kid-friendly language. No electron dots. availableElements: H, C, N, O.
 * - 6-8: More complex molecules (NH3, C2H5OH, H2SO4). Valence rules, bond types,
 *        Lewis dot basics. Scientific vocabulary. showElectronDots: true.
 *
 * @param topic - The topic or theme (e.g. "water molecules", "carbon compounds")
 * @param gradeLevel - Grade level context string
 * @param config - Optional config with intent override
 * @returns MoleculeConstructorData ready for the MoleculeConstructor component
 */
export const generateMoleculeConstructor = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<{ intent: string }>
): Promise<MoleculeConstructorData> => {
  const intent = config?.intent || "";
  const gradeBand = resolveGradeBand(gradeLevel);

  const gradeBandDescriptions: Record<string, string> = {
    "3-5":
      "Grades 3-5. Focus on SIMPLE molecules: H2O (water), O2 (oxygen), CO2 (carbon dioxide), CH4 (methane). " +
      "Key concept: 'Atoms connect to make molecules.' " +
      "Use kid-friendly language — 'snapping together', 'building blocks', 'connecting atoms'. " +
      "NO electron dots (showElectronDots: false, palette.showElectronDots: false). " +
      "availableElements: ['H', 'C', 'N', 'O'] (only 4 elements). " +
      "showValence: true (so kids can see how many bonds each atom wants). " +
      "Challenges should be primarily build_target and free_build. " +
      "Start with the simplest molecule (H2 or H2O) and progress to CO2 or CH4. " +
      "Narrations should celebrate discovery: 'You built water! Every drop you drink is H2O!' " +
      "Gallery molecules should be simple and relatable (water, oxygen gas, carbon dioxide, sugar).",
    "6-8":
      "Grades 6-8. Explore more complex molecules: NH3 (ammonia), C2H5OH (ethanol), H2SO4 (sulfuric acid), C6H12O6 (glucose). " +
      "Key concepts: valence rules, single/double/triple bonds, Lewis dot structures, molecular geometry basics. " +
      "Use scientific vocabulary: 'covalent bond', 'valence electrons', 'molecular formula', 'Lewis structure'. " +
      "showElectronDots: true, palette.showElectronDots: true. " +
      "availableElements: ['H', 'C', 'N', 'O', 'F', 'S', 'P', 'Cl'] (8 elements). " +
      "showValence: true. " +
      "Challenges should include ALL types: build_target, identify, formula_write, predict_bonds, shape_predict. " +
      "Include at least one formula_write challenge ('Write the formula for this molecule'). " +
      "Include at least one predict_bonds challenge ('How many bonds will nitrogen form?'). " +
      "Connect to real-world chemistry: 'Ethanol is the alcohol in hand sanitizer — C2H5OH has an OH group that kills germs!' " +
      "Gallery molecules should include organic and inorganic examples across all 5 categories.",
  };

  const generationPrompt = `Create a Molecule Constructor activity about "${topic}" for ${gradeBand} students.
${intent ? `\nTeaching intent: ${intent}` : ""}

GRADE BAND REQUIREMENTS (${gradeBand}):
${gradeBandDescriptions[gradeBand]}

GENERAL REQUIREMENTS:
1. Choose a relatable target molecule that connects to the topic. The targetMolecule should have accurate atoms and bonds arrays.
2. Provide 3-6 challenges sequenced by difficulty. Start with easier tasks (build_target with simple molecules) and progress to harder ones (formula_write, predict_bonds, shape_predict).
3. Every challenge must have a unique id (e.g. "ch1", "ch2", "ch3").
4. CRITICAL — every challenge MUST be self-contained with its own target data:
   - targetFormula: the molecular formula (e.g. "CH4"). Use "" for free_build.
   - targetName: the common name (e.g. "Methane"). Use "" for free_build.
   - targetAtoms: array of {element, count} (e.g. [{element:"C",count:1},{element:"H",count:4}] for CH4). Use [] for free_build.
   ALL THREE must be consistent with each other. Different challenges target DIFFERENT molecules — each challenge has its OWN targetFormula, targetName, and targetAtoms.
5. The top-level targetMolecule describes the PRIMARY molecule of the whole activity (for context and real-world info). Individual challenges use their own target fields for validation.
6. For formula_write challenges: targetFormula must contain the expected answer.
7. For identify challenges: students see a built molecule and name it.
8. For predict_bonds challenges: students predict how many bonds an atom will form based on valence.
9. For shape_predict challenges: students predict molecular geometry.
10. For free_build challenges: targetFormula="", targetName="", targetAtoms=[].
11. Narrations should be wonder-driven and educational:
   - "Amazing! You built water — H2O! Every raindrop, every ocean wave is made of this molecule!"
   - "Nitrogen forms a TRIPLE bond in N2 — that's why nitrogen gas is so stable in our atmosphere!"
12. The moleculeGallery should contain 4-8 molecules related to the topic, spread across categories (essential, food, atmosphere, energy, household). All should start unlocked: false.
13. Set showOptions based on grade band:
   - 3-5: showFormula: true, showName: true, showRealWorldImage: true, showValenceSatisfaction: true, show3DToggle: false, showElectronDots: false, showBondType: false
   - 6-8: showFormula: true, showName: true, showRealWorldImage: true, showValenceSatisfaction: true, show3DToggle: false, showElectronDots: true, showBondType: true
14. The bonds array in targetMolecule uses 0-based atom indices corresponding to the order atoms would be placed. Use accurate bond types (single, double, triple).
15. imagePrompt should describe a vivid real-world scene featuring the target molecule.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: moleculeConstructorSchema,
        systemInstruction:
          "You are an expert chemistry educator creating interactive molecule-building activities for grades 3-8. " +
          "Design engaging challenges where students discover how atoms bond together to form molecules, " +
          "learn valence rules, understand single/double/triple bonds, and see how molecular structure " +
          "determines properties and real-world uses. Use accurate chemical data — atom counts, bond types, " +
          "and molecular formulas must be scientifically correct. Language should be age-appropriate: " +
          "simple wonder-filled phrasing for younger students, precise scientific vocabulary for older students. " +
          "Connect every molecule to real-world examples so students see chemistry in their daily lives.",
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error(
        "No data returned from Gemini API for molecule-constructor"
      );
    }

    const result = JSON.parse(text) as MoleculeConstructorData;

    // -----------------------------------------------------------------------
    // Validation & Defaults
    // -----------------------------------------------------------------------

    // Ensure gradeBand
    if (!result.gradeBand || !["3-5", "6-8"].includes(result.gradeBand)) {
      result.gradeBand = gradeBand;
    }

    // Ensure targetMolecule defaults
    if (!result.targetMolecule) {
      result.targetMolecule = {
        name: null,
        formula: null,
        atoms: [],
        bonds: [],
        realWorldUse: "Molecules are everywhere — in the air you breathe, the water you drink, and the food you eat!",
        imagePrompt: "Colorful molecule models in a chemistry classroom",
      };
    }
    if (!result.targetMolecule.atoms) {
      result.targetMolecule.atoms = [];
    }
    if (!result.targetMolecule.bonds) {
      result.targetMolecule.bonds = [];
    }
    if (!result.targetMolecule.realWorldUse) {
      result.targetMolecule.realWorldUse = "This molecule plays an important role in our world!";
    }
    if (!result.targetMolecule.imagePrompt) {
      result.targetMolecule.imagePrompt = "A vivid real-world scene featuring molecules and chemistry";
    }

    // Ensure palette defaults
    result.palette = {
      availableElements: result.palette?.availableElements ??
        (gradeBand === "3-5" ? ["H", "C", "N", "O"] : ["H", "C", "N", "O", "F", "S", "P", "Cl"]),
      showValence: result.palette?.showValence ?? true,
      showElectronDots: result.palette?.showElectronDots ?? gradeBand === "6-8",
    };

    // Ensure showOptions defaults
    result.showOptions = {
      showFormula: result.showOptions?.showFormula ?? true,
      showName: result.showOptions?.showName ?? true,
      showRealWorldImage: result.showOptions?.showRealWorldImage ?? true,
      showValenceSatisfaction: result.showOptions?.showValenceSatisfaction ?? true,
      show3DToggle: result.showOptions?.show3DToggle ?? false,
      showElectronDots: result.showOptions?.showElectronDots ?? gradeBand === "6-8",
      showBondType: result.showOptions?.showBondType ?? gradeBand === "6-8",
    };

    // Ensure every challenge has required fields and consistent target data
    if (result.challenges) {
      result.challenges = result.challenges.map((ch, idx) => {
        // Normalize empty strings from schema to null
        const targetFormula = ch.targetFormula || null;
        const targetName = ch.targetName || null;

        // Ensure targetAtoms: prefer provided, else parse from formula
        let targetAtoms = ch.targetAtoms ?? [];
        if (targetAtoms.length === 0 && targetFormula) {
          targetAtoms = parseFormulaToAtoms(targetFormula);
        }

        // Cross-reference formula ↔ name via known molecules
        const resolvedName =
          targetName ||
          (targetFormula ? (FORMULA_TO_NAME[targetFormula] ?? null) : null);
        const resolvedFormula =
          targetFormula ||
          (targetName
            ? (NAME_TO_FORMULA[targetName.toLowerCase()] ?? null)
            : null);

        // If we resolved a formula but still lack atoms, parse it
        if (targetAtoms.length === 0 && resolvedFormula) {
          targetAtoms = parseFormulaToAtoms(resolvedFormula);
        }

        return {
          ...ch,
          id: ch.id || `ch${idx + 1}`,
          type: ch.type || "build_target",
          instruction:
            ch.instruction || "Build the molecule by snapping atoms together!",
          targetFormula: resolvedFormula,
          targetName: resolvedName,
          targetAtoms,
          hint: ch.hint || "Look at the formula and count the atoms!",
          narration:
            ch.narration || ch.instruction || "Great work building that molecule!",
        };
      });
    }

    // Ensure at least one challenge exists
    if (!result.challenges || result.challenges.length === 0) {
      result.challenges = [
        {
          id: "ch1",
          type: "build_target",
          instruction: "Build a water molecule! Connect 2 hydrogen atoms to 1 oxygen atom.",
          targetFormula: "H2O",
          targetName: "Water",
          targetAtoms: [{ element: "H", count: 2 }, { element: "O", count: 1 }],
          hint: "Oxygen needs 2 bonds, and each hydrogen needs 1 bond.",
          narration: "You built water — H2O! Every drop of water on Earth is made of these tiny molecules!",
        },
        {
          id: "ch2",
          type: "build_target",
          instruction: "Now build methane! Snap 4 hydrogen atoms to 1 carbon atom.",
          targetFormula: "CH4",
          targetName: "Methane",
          targetAtoms: [{ element: "C", count: 1 }, { element: "H", count: 4 }],
          hint: "Carbon needs 4 bonds, and each hydrogen needs 1 bond. One H on each side!",
          narration: "CH4 — methane! This is the gas that heats our homes and cooks our food!",
        },
        {
          id: "ch3",
          type: "free_build",
          instruction: "Free build! Create any molecule you like using the available atoms.",
          targetFormula: null,
          targetName: null,
          targetAtoms: [],
          hint: "Try connecting different atoms and see what molecules you can make!",
          narration: "Amazing creativity! You're thinking like a real chemist!",
        },
      ];
    }

    // Ensure moleculeGallery defaults
    if (!result.moleculeGallery || result.moleculeGallery.length === 0) {
      result.moleculeGallery = [
        {
          name: "Water",
          formula: "H2O",
          category: "essential",
          unlocked: false,
          imagePrompt: "A crystal clear water droplet reflecting sunlight",
        },
        {
          name: "Carbon Dioxide",
          formula: "CO2",
          category: "atmosphere",
          unlocked: false,
          imagePrompt: "Bubbles rising in a glass of sparkling water",
        },
        {
          name: "Methane",
          formula: "CH4",
          category: "energy",
          unlocked: false,
          imagePrompt: "A natural gas flame burning on a kitchen stove",
        },
        {
          name: "Oxygen Gas",
          formula: "O2",
          category: "essential",
          unlocked: false,
          imagePrompt: "A person breathing fresh air in a green forest",
        },
      ];
    }

    console.log("Molecule Constructor Generated:", {
      title: result.title,
      gradeBand: result.gradeBand,
      targetMolecule: result.targetMolecule.name,
      formula: result.targetMolecule.formula,
      challengeCount: result.challenges?.length ?? 0,
      galleryCount: result.moleculeGallery?.length ?? 0,
      availableElements: result.palette.availableElements.join(", "),
    });

    return result;
  } catch (error) {
    console.error("Error generating molecule-constructor data:", error);
    throw error;
  }
};
