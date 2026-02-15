import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import {
  AtomBuilderData,
  AtomBuilderChallenge,
  AtomBuilderShowOptions,
  AtomBuilderConstraints,
} from "../../primitives/visual-primitives/chemistry/AtomBuilder";

// Re-export types for convenience (no redefinition — sourced from the component)
export type {
  AtomBuilderData,
  AtomBuilderChallenge,
  AtomBuilderShowOptions,
  AtomBuilderConstraints,
};

/**
 * Schema definition for Atom Builder Data
 *
 * Describes the JSON structure Gemini must return:
 * - targetElement: the element students should build (or null for free build)
 * - challenges: sequenced build/identify/ion/isotope challenges
 * - showOptions: UI toggles for identity card, shell capacity, charge, mass number, etc.
 * - constraints: max protons, max shells, ion/isotope toggles
 * - gradeBand: 3-5 or 6-8
 */
const atomBuilderSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description:
        "Short, engaging title for the activity (e.g. 'Build an Atom!')",
    },
    description: {
      type: Type.STRING,
      description:
        "One-sentence activity description in kid-friendly language",
    },
    targetElement: {
      type: Type.OBJECT,
      description: "The primary target element for this activity",
      properties: {
        atomicNumber: {
          type: Type.NUMBER,
          description: "Atomic number (proton count) of the target element, or 0 for free build",
          nullable: true,
        },
        massNumber: {
          type: Type.NUMBER,
          description: "Mass number (protons + neutrons) of the target, or null for free build",
          nullable: true,
        },
        charge: {
          type: Type.NUMBER,
          description: "Target charge (0 for neutral, positive for cation, negative for anion)",
        },
        name: {
          type: Type.STRING,
          description: "Element name (e.g. 'Carbon') or null for free build",
          nullable: true,
        },
      },
      required: ["atomicNumber", "massNumber", "charge", "name"],
    },
    challenges: {
      type: Type.ARRAY,
      description:
        "3-6 sequenced challenges progressing in difficulty: build_element → identify → fill_shells → make_ion → make_isotope → find_on_table",
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
              "build_element",
              "identify",
              "fill_shells",
              "make_ion",
              "make_isotope",
              "find_on_table",
            ],
            description: "Type of challenge task",
          },
          instruction: {
            type: Type.STRING,
            description:
              "Kid-friendly instruction for this challenge",
          },
          targetProtons: {
            type: Type.NUMBER,
            description:
              "Number of protons the student should have, or null if any is acceptable",
            nullable: true,
          },
          targetNeutrons: {
            type: Type.NUMBER,
            description:
              "Number of neutrons the student should have, or null if any is acceptable",
            nullable: true,
          },
          targetElectrons: {
            type: Type.NUMBER,
            description:
              "Number of electrons the student should have, or null if any is acceptable",
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
          "targetProtons",
          "targetNeutrons",
          "targetElectrons",
          "hint",
          "narration",
        ],
      },
    },
    showOptions: {
      type: Type.OBJECT,
      description: "Which UI panels to enable for this activity",
      properties: {
        showMiniPeriodicTable: {
          type: Type.BOOLEAN,
          description: "Show the mini periodic table with current element highlighted",
        },
        showIdentityCard: {
          type: Type.BOOLEAN,
          description: "Show the element identity card (symbol, name, category)",
        },
        showShellCapacity: {
          type: Type.BOOLEAN,
          description: "Show shell capacity indicators (2, 8, 8, 18)",
        },
        showCharge: {
          type: Type.BOOLEAN,
          description: "Show charge calculation (protons - electrons)",
        },
        showMassNumber: {
          type: Type.BOOLEAN,
          description: "Show mass number (protons + neutrons)",
        },
        showElectronConfiguration: {
          type: Type.BOOLEAN,
          description: "Show electron configuration notation (for grades 7-8 only)",
        },
        showNucleusDetail: {
          type: Type.BOOLEAN,
          description: "Show individual proton/neutron particles in the nucleus (for small atoms)",
        },
      },
      required: [
        "showMiniPeriodicTable",
        "showIdentityCard",
        "showShellCapacity",
        "showCharge",
        "showMassNumber",
        "showElectronConfiguration",
        "showNucleusDetail",
      ],
    },
    constraints: {
      type: Type.OBJECT,
      description: "Constraints on what students can build",
      properties: {
        maxProtons: {
          type: Type.NUMBER,
          description: "Maximum protons allowed (20 for grades 3-5, 36 for 6-8)",
        },
        maxShells: {
          type: Type.NUMBER,
          description: "Maximum electron shells (3 for grades 3-5, 4 for 6-8)",
        },
        allowIons: {
          type: Type.BOOLEAN,
          description: "Whether ion challenges are available",
        },
        allowIsotopes: {
          type: Type.BOOLEAN,
          description: "Whether isotope challenges are available",
        },
      },
      required: ["maxProtons", "maxShells", "allowIons", "allowIsotopes"],
    },
    imagePrompt: {
      type: Type.STRING,
      description:
        "Prompt for generating a real-world connection image (e.g. 'Colorful neon signs glowing in a city at night')",
      nullable: true,
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
    "targetElement",
    "challenges",
    "showOptions",
    "constraints",
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
 * Generate Atom Builder data using Gemini
 *
 * Creates an interactive atom construction activity where students drag
 * protons, neutrons, and electrons to build atoms, exploring element identity,
 * electron shells, ions, and isotopes.
 *
 * Grade-appropriate content:
 * - 3-5: Build simple atoms (H to Ca), learn proton count = element, basic shells
 * - 6-8: Ions, isotopes, electron configuration, elements up to Kr
 *
 * @param topic - The topic or theme (e.g. "atomic structure", "building atoms")
 * @param gradeLevel - Grade level context string
 * @param config - Optional config with intent override
 * @returns AtomBuilderData ready for the AtomBuilder component
 */
export const generateAtomBuilder = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<{ intent: string }>
): Promise<AtomBuilderData> => {
  const intent = config?.intent || "";
  const gradeBand = resolveGradeBand(gradeLevel);

  const gradeBandDescriptions: Record<string, string> = {
    "3-5":
      "Grades 3-5. Focus on SIMPLE elements (Hydrogen through Calcium, atomic number 1-20). " +
      "Key concepts: atoms are made of smaller parts (protons, neutrons, electrons). " +
      "Proton count = element identity. Electron shells fill in order (2, 8, 8). " +
      "Use kid-friendly language — 'tiny particles', 'building blocks'. " +
      "NO ions or isotopes (allowIons: false, allowIsotopes: false). " +
      "maxProtons: 20. maxShells: 3. " +
      "showElectronConfiguration: false. showNucleusDetail: true (for small atoms). " +
      "Challenges: build_element and fill_shells only. " +
      "Start with hydrogen (1 proton) or helium (2 protons) for the first challenge. " +
      "Progress to carbon (6), oxygen (8), or sodium (11). " +
      "Narration should celebrate discovery: 'You have 6 protons — that makes it carbon!'",
    "6-8":
      "Grades 6-8. Explore elements up to Krypton (atomic number 36). " +
      "Key concepts: electron configuration, valence electrons, ions, isotopes, atomic vs mass number. " +
      "Use scientific vocabulary: 'atomic number', 'mass number', 'electron configuration', 'valence shell'. " +
      "ALLOW ions (allowIons: true) and isotopes (allowIsotopes: true). " +
      "maxProtons: 36. maxShells: 4. " +
      "showElectronConfiguration: true. showNucleusDetail: true for atoms with <16 particles. " +
      "Challenges should include ALL types: build_element → identify → fill_shells → make_ion → make_isotope. " +
      "Include at least one ion challenge (e.g. 'Start with sodium, remove one electron — what's the charge?'). " +
      "Include at least one isotope challenge (e.g. 'Build carbon-14: same protons as carbon-12, but more neutrons'). " +
      "Connect to periodic table groups: 'See how its outer shell is full? That's why neon doesn't react!'",
  };

  const generationPrompt = `Create an Atom Builder activity about "${topic}" for ${gradeBand} students.
${intent ? `\nTeaching intent: ${intent}` : ""}

GRADE BAND REQUIREMENTS (${gradeBand}):
${gradeBandDescriptions[gradeBand]}

GENERAL REQUIREMENTS:
1. Choose relatable elements students encounter in real life (carbon in pencils, oxygen in air, iron in blood, neon in signs, gold in jewelry).
2. Provide 3-6 challenges sequenced by difficulty.
3. Every challenge must specify exact targetProtons, targetNeutrons, and targetElectrons (use null only if that particle count doesn't matter for the challenge).
4. For build_element challenges: targetProtons = atomic number, targetNeutrons = most common isotope neutrons, targetElectrons = same as protons (neutral).
5. For make_ion challenges: targetElectrons should differ from targetProtons to create a charge.
6. For make_isotope challenges: targetNeutrons should differ from the most common isotope.
7. For identify challenges: provide an atom already built and ask the student to identify it (still set target values for validation).
8. For fill_shells challenges: focus on correct electron shell filling order.
9. Narrations should be wonder-driven and educational:
   - "Amazing! 8 protons means oxygen — the element you breathe every second!"
   - "You removed an electron and created a sodium ION! That's exactly what happens when salt dissolves in water."
10. Set showOptions based on grade band:
   - 3-5: showMiniPeriodicTable: true, showIdentityCard: true, showShellCapacity: true, showCharge: false, showMassNumber: false, showElectronConfiguration: false, showNucleusDetail: true
   - 6-8: showMiniPeriodicTable: true, showIdentityCard: true, showShellCapacity: true, showCharge: true, showMassNumber: true, showElectronConfiguration: true, showNucleusDetail: true
11. imagePrompt should connect to a real-world use of the target element.
12. Each challenge id should be unique (e.g. "ch1", "ch2", "ch3").`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: atomBuilderSchema,
        systemInstruction:
          "You are an expert chemistry educator creating interactive atom-building activities for grades 3-8. " +
          "Design engaging challenges where students discover how protons determine element identity, " +
          "electrons fill shells in order, ions form when electrons are gained or lost, and isotopes " +
          "have different neutron counts. Use accurate atomic data — neutron counts should match the " +
          "most common isotope. Language should be age-appropriate: simple wonder-filled phrasing for " +
          "younger students, precise scientific vocabulary for older students. " +
          "Connect every atom to real-world examples so students see chemistry in their daily lives.",
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API for atom-builder");
    }

    const result = JSON.parse(text) as AtomBuilderData;

    // -----------------------------------------------------------------------
    // Validation & Defaults
    // -----------------------------------------------------------------------

    // Ensure gradeBand
    if (!result.gradeBand || !["3-5", "6-8"].includes(result.gradeBand)) {
      result.gradeBand = gradeBand;
    }

    // Ensure targetElement defaults
    if (!result.targetElement) {
      result.targetElement = {
        atomicNumber: null,
        massNumber: null,
        charge: 0,
        name: null,
      };
    }

    // Ensure showOptions defaults
    result.showOptions = {
      showMiniPeriodicTable: result.showOptions?.showMiniPeriodicTable ?? true,
      showIdentityCard: result.showOptions?.showIdentityCard ?? true,
      showShellCapacity: result.showOptions?.showShellCapacity ?? true,
      showCharge: result.showOptions?.showCharge ?? gradeBand === "6-8",
      showMassNumber: result.showOptions?.showMassNumber ?? gradeBand === "6-8",
      showElectronConfiguration: result.showOptions?.showElectronConfiguration ?? gradeBand === "6-8",
      showNucleusDetail: result.showOptions?.showNucleusDetail ?? true,
    };

    // Ensure constraints defaults
    result.constraints = {
      maxProtons: result.constraints?.maxProtons ?? (gradeBand === "3-5" ? 20 : 36),
      maxShells: result.constraints?.maxShells ?? (gradeBand === "3-5" ? 3 : 4),
      allowIons: result.constraints?.allowIons ?? gradeBand === "6-8",
      allowIsotopes: result.constraints?.allowIsotopes ?? gradeBand === "6-8",
    };

    // Ensure every challenge has required fields
    if (result.challenges) {
      result.challenges = result.challenges.map((ch, idx) => ({
        ...ch,
        id: ch.id || `ch${idx + 1}`,
        type: ch.type || "build_element",
        instruction: ch.instruction || "Build the element by adding the right particles!",
        targetProtons: ch.targetProtons ?? null,
        targetNeutrons: ch.targetNeutrons ?? null,
        targetElectrons: ch.targetElectrons ?? null,
        hint: ch.hint || "Look at the periodic table for the atomic number!",
        narration: ch.narration || ch.instruction || "Great work!",
      }));
    }

    // Ensure at least one challenge exists
    if (!result.challenges || result.challenges.length === 0) {
      result.challenges = [
        {
          id: "ch1",
          type: "build_element",
          instruction: "Build a hydrogen atom! Add 1 proton and 1 electron.",
          targetProtons: 1,
          targetNeutrons: 0,
          targetElectrons: 1,
          hint: "Hydrogen is the simplest element — it has just 1 proton!",
          narration: "You built hydrogen — the most abundant element in the universe!",
        },
        {
          id: "ch2",
          type: "build_element",
          instruction: "Now build carbon! Carbon has 6 protons.",
          targetProtons: 6,
          targetNeutrons: 6,
          targetElectrons: 6,
          hint: "Carbon has 6 protons, 6 neutrons, and 6 electrons.",
          narration: "Carbon is in your pencil, in diamonds, and in every living thing!",
        },
        {
          id: "ch3",
          type: "fill_shells",
          instruction: "Build oxygen (8 protons, 8 neutrons) and fill the electron shells correctly.",
          targetProtons: 8,
          targetNeutrons: 8,
          targetElectrons: 8,
          hint: "The first shell holds 2 electrons, the second holds up to 8.",
          narration: "Oxygen has 2 electrons in shell 1 and 6 in shell 2. You breathe this element every second!",
        },
      ];
    }

    // Ensure imagePrompt
    if (!result.imagePrompt) {
      result.imagePrompt =
        gradeBand === "3-5"
          ? "A colorful classroom poster showing the inside of an atom with protons, neutrons, and electrons"
          : "Neon signs glowing in different colors at night, each color from a different element";
    }

    console.log("⚛️ Atom Builder Generated:", {
      title: result.title,
      gradeBand: result.gradeBand,
      targetElement: result.targetElement.name,
      challengeCount: result.challenges?.length ?? 0,
      maxProtons: result.constraints.maxProtons,
      allowIons: result.constraints.allowIons,
      allowIsotopes: result.constraints.allowIsotopes,
    });

    return result;
  } catch (error) {
    console.error("Error generating atom-builder data:", error);
    throw error;
  }
};
