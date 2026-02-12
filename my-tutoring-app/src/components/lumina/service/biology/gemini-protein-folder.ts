import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

// Import the data type from the component (single source of truth)
import { ProteinFolderData } from "../../primitives/visual-primitives/biology/ProteinFolder";

/**
 * Schema definition for Protein Folder Data
 *
 * Generates interactive protein folding activities for molecular biology education.
 * Students learn:
 * - How amino acid properties determine protein folding
 * - The relationship between sequence, structure, and function
 * - How mutations cause misfolding and disease
 */
const proteinFolderSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    proteinName: {
      type: Type.STRING,
      description: "Name of the protein (e.g., 'Hemoglobin', 'Insulin', 'Collagen')"
    },
    function: {
      type: Type.STRING,
      description: "Brief description of the protein's biological function (e.g., 'Carries oxygen in blood')"
    },
    aminoAcidSequence: {
      type: Type.ARRAY,
      description: "Simplified amino acid sequence (8-14 residues for educational purposes)",
      items: {
        type: Type.OBJECT,
        properties: {
          position: { type: Type.INTEGER, description: "1-based position in the sequence" },
          threeLetterCode: { type: Type.STRING, description: "Three-letter amino acid code (e.g., 'Ala', 'Val', 'Glu')" },
          name: { type: Type.STRING, description: "Full amino acid name (e.g., 'Alanine', 'Valine', 'Glutamic Acid')" },
          property: {
            type: Type.STRING,
            enum: ["hydrophobic", "hydrophilic", "charged-positive", "charged-negative", "polar"],
            description: "Chemical property determining folding behavior"
          },
          color: { type: Type.STRING, description: "Hex color for visual display, consistent per property type" }
        },
        required: ["position", "threeLetterCode", "name", "property", "color"]
      }
    },
    foldingLevels: {
      type: Type.OBJECT,
      properties: {
        primary: {
          type: Type.STRING,
          description: "Grade-appropriate description of primary structure (linear amino acid chain)"
        },
        secondary: {
          type: Type.OBJECT,
          properties: {
            type: {
              type: Type.STRING,
              enum: ["alpha-helix", "beta-sheet", "mixed"],
              description: "Predominant secondary structure type"
            },
            description: {
              type: Type.STRING,
              description: "Grade-appropriate description of the secondary structure"
            }
          },
          required: ["type", "description"]
        },
        tertiary: {
          type: Type.OBJECT,
          properties: {
            description: {
              type: Type.STRING,
              description: "Grade-appropriate description of the 3D folded shape"
            },
            keyInteractions: {
              type: Type.ARRAY,
              description: "Important bonds/interactions that stabilize the fold (3-6 interactions)",
              items: {
                type: Type.OBJECT,
                properties: {
                  position1: { type: Type.INTEGER, description: "Position of first residue in the interaction" },
                  position2: { type: Type.INTEGER, description: "Position of second residue in the interaction" },
                  bondType: {
                    type: Type.STRING,
                    enum: ["hydrogen", "ionic", "disulfide", "hydrophobic-interaction"],
                    description: "Type of chemical interaction"
                  },
                  description: {
                    type: Type.STRING,
                    description: "Brief description of this interaction"
                  }
                },
                required: ["position1", "position2", "bondType", "description"]
              }
            }
          },
          required: ["description", "keyInteractions"]
        },
        quaternary: {
          type: Type.STRING,
          nullable: true,
          description: "Description of multi-subunit assembly, or null if protein is a single chain"
        }
      },
      required: ["primary", "secondary", "tertiary", "quaternary"]
    },
    mutationChallenges: {
      type: Type.ARRAY,
      description: "2-3 mutation scenarios for students to analyze",
      items: {
        type: Type.OBJECT,
        properties: {
          originalPosition: { type: Type.INTEGER, description: "Position of the amino acid being mutated" },
          originalAminoAcid: { type: Type.STRING, description: "Three-letter code of original amino acid" },
          mutatedAminoAcid: { type: Type.STRING, description: "Three-letter code of mutated amino acid" },
          effectOnFolding: { type: Type.STRING, description: "How the mutation affects protein folding" },
          effectOnFunction: { type: Type.STRING, description: "How the mutation affects protein function" },
          realWorldDisease: {
            type: Type.STRING,
            nullable: true,
            description: "Real-world disease caused by this type of mutation, or null"
          }
        },
        required: ["originalPosition", "originalAminoAcid", "mutatedAminoAcid", "effectOnFolding", "effectOnFunction", "realWorldDisease"]
      }
    },
    analogies: {
      type: Type.OBJECT,
      properties: {
        foldingAnalogy: {
          type: Type.STRING,
          description: "Relatable analogy for protein folding (e.g., 'Like origami—the crease pattern determines the final shape')"
        },
        misfoldingAnalogy: {
          type: Type.STRING,
          description: "Relatable analogy for misfolding (e.g., 'Like a key cut wrong—it won't fit the lock')"
        }
      },
      required: ["foldingAnalogy", "misfoldingAnalogy"]
    },
    gradeBand: {
      type: Type.STRING,
      enum: ["7-8"],
      description: "Target grade band (always 7-8 for protein folding)"
    }
  },
  required: [
    "proteinName", "function", "aminoAcidSequence", "foldingLevels",
    "mutationChallenges", "analogies", "gradeBand"
  ]
};

/**
 * Generate Protein Folder data using Gemini AI
 *
 * Creates an interactive protein folding activity with amino acid sequence,
 * folding levels, key interactions, and mutation challenges.
 *
 * @param topic - The protein or topic (e.g., "Hemoglobin", "Sickle cell disease", "Protein folding")
 * @param gradeBand - Grade level (always '7-8' for this primitive)
 * @param config - Optional partial configuration to override generated values
 * @returns ProteinFolderData with sequence, folding levels, and mutation challenges
 */
export const generateProteinFolder = async (
  topic: string,
  gradeBand: '7-8' = '7-8',
  config?: Partial<ProteinFolderData>
): Promise<ProteinFolderData> => {

  const generationPrompt = `Create an interactive protein folding simulation activity for: "${topic}".

TARGET GRADE BAND: ${gradeBand} (middle school advanced biology)

REQUIREMENTS:

1. **Protein**: Choose a well-known protein relevant to the topic. Include its name and biological function.

2. **Amino Acid Sequence**: Generate a SIMPLIFIED sequence of 8-14 amino acids.
   - Each residue needs: position (1-based), threeLetterCode, name, property, and color
   - Properties must be SCIENTIFICALLY ACCURATE for each amino acid:
     * Hydrophobic: Ala, Val, Leu, Ile, Met, Phe, Trp, Pro (color: #f59e0b amber)
     * Hydrophilic: (general term, use more specific below)
     * Charged-positive: Lys, Arg, His (color: #f87171 rose)
     * Charged-negative: Asp, Glu (color: #a78bfa violet)
     * Polar: Ser, Thr, Cys, Tyr, Asn, Gln (color: #34d399 emerald)
   - Mix of properties to make the folding challenge interesting
   - At least 3 hydrophobic (should fold to interior) and 3 surface-facing residues

3. **Folding Levels**: Grade-appropriate descriptions of:
   - Primary: The linear chain concept
   - Secondary: Alpha-helix, beta-sheet, or mixed
   - Tertiary: 3D folded shape with key interactions (3-6 interactions)
   - Quaternary: Multi-subunit info if applicable, null otherwise

4. **Key Interactions**: 3-6 bonds between specific residue positions:
   - Hydrophobic interactions between hydrophobic residues
   - Ionic bonds between oppositely charged residues
   - Hydrogen bonds between polar residues
   - Disulfide bonds between Cys residues (if present)
   - Positions MUST match actual residues in the sequence

5. **Mutation Challenges**: 2-3 mutation scenarios:
   - Each swaps one amino acid for another with a DIFFERENT property
   - Explain how the property change disrupts folding
   - Explain how misfolding affects function
   - Include real-world disease connection when possible (e.g., sickle cell anemia for hemoglobin)
   - At least one mutation should swap a hydrophobic residue to a hydrophilic one (or vice versa)

6. **Analogies**: Two relatable analogies:
   - One for normal folding (origami, puzzle pieces, etc.)
   - One for misfolding consequences (wrong key, broken tool, etc.)

CRITICAL RULES:
- Amino acid properties MUST be scientifically correct
- Key interaction positions MUST reference actual residues in the generated sequence
- Mutation positions MUST reference actual residues in the sequence
- Use engaging, accessible language for 7th-8th graders
- Colors should be consistent: all hydrophobic = amber, charged+ = rose, charged- = violet, polar = emerald

Now generate the protein folding activity for "${topic}".`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: proteinFolderSchema,
        systemInstruction: `You are an expert molecular biologist and biochemistry educator specializing in middle school science. You understand protein structure, amino acid chemistry, and protein folding at a deep level, and you can explain these concepts accessibly for 7th-8th grade students. You always generate scientifically accurate amino acid properties and folding interactions, and you create engaging mutation scenarios that connect molecular changes to real-world health outcomes.`,
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API");
    }

    const result = JSON.parse(text) as ProteinFolderData;

    // Merge with any config overrides
    const finalData: ProteinFolderData = {
      ...result,
      ...config,
    };

    console.log('🧪 Protein Folder Generated:', {
      protein: finalData.proteinName,
      function: finalData.function,
      sequenceLength: finalData.aminoAcidSequence.length,
      interactions: finalData.foldingLevels.tertiary.keyInteractions.length,
      mutations: finalData.mutationChallenges.length,
      gradeBand: finalData.gradeBand,
    });

    return finalData;

  } catch (error) {
    console.error("Error generating protein folder:", error);
    throw error;
  }
};
