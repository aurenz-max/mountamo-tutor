import { Type, Schema, ThinkingLevel } from "@google/genai";
import { MoleculeViewerData } from "../../types";
import { ai } from "../geminiClient";

/**
 * Schema definition for Molecule Data
 *
 * This schema defines the structure for 3D molecular visualization,
 * including atomic positions, bonds, and chemical properties.
 */
const moleculeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: {
      type: Type.STRING,
      description: "Common name of the molecule or structure"
    },
    description: {
      type: Type.STRING,
      description: "Educational description of the molecule, its bonds, and properties."
    },
    category: {
      type: Type.STRING,
      enum: ['organic', 'inorganic', 'protein', 'crystal', 'other']
    },
    atoms: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          element: {
            type: Type.STRING,
            description: "Periodic symbol (e.g. C, H, O)"
          },
          name: {
            type: Type.STRING,
            description: "Element name"
          },
          position: {
            type: Type.OBJECT,
            properties: {
              x: { type: Type.NUMBER },
              y: { type: Type.NUMBER },
              z: { type: Type.NUMBER }
            },
            required: ["x", "y", "z"]
          },
          atomicNumber: { type: Type.NUMBER },
          description: {
            type: Type.STRING,
            description: "Short fact about this specific atom role if relevant"
          }
        },
        required: ["id", "element", "name", "position"]
      }
    },
    bonds: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          sourceId: {
            type: Type.STRING,
            description: "id of source atom"
          },
          targetId: {
            type: Type.STRING,
            description: "id of target atom"
          },
          order: {
            type: Type.NUMBER,
            description: "1 for single, 2 for double, 3 for triple. Use 0.5 for ionic attractions."
          },
          type: {
            type: Type.STRING,
            enum: ['covalent', 'ionic', 'hydrogen', 'metallic', 'unknown']
          }
        },
        required: ["sourceId", "targetId", "order", "type"]
      }
    }
  },
  required: ["name", "description", "atoms", "bonds", "category"]
};

/**
 * Generate 3D molecular structure data for visualization
 *
 * This function creates molecular data including:
 * - Accurate 3D atomic coordinates (Angstrom scale)
 * - Chemical bonds with proper types and orders
 * - Educational descriptions and properties
 * - Support for molecules, crystals, polymers, and proteins
 *
 * @param prompt - Description of the molecule to generate
 * @param gradeLevel - Optional grade level for age-appropriate descriptions
 * @returns MoleculeViewerData with complete 3D structure
 */
export const generateMoleculeData = async (
  prompt: string,
  gradeLevel?: string
): Promise<MoleculeViewerData> => {
  const educationalContext = gradeLevel
    ? `\n\nEducational Context: This is for ${gradeLevel} students. Adjust the description complexity accordingly.`
    : '';

  const generationPrompt = `Generate a 3D molecular structure for: "${prompt}".

RULES:
1. Provide accurate 3D coordinates (Angstrom scale approximation).
2. If it's a crystal (like Diamond or Salt), generate a small lattice (at least 3x3x3 unit cells or enough to show the pattern, roughly 20-50 atoms).
3. If it's a polymer/plastic, generate a short chain (5-10 monomers).
4. Ensure bonds connect the correct atoms based on chemistry rules.
5. Center the molecule at 0,0,0.
6. For "Diamond", use Carbon atoms in a tetrahedral lattice.
7. For "Salt" (NaCl), use Na and Cl in a cubic lattice.
8. For proteins, generate a short peptide chain with proper backbone structure.
9. Include accurate bond types: covalent, ionic, hydrogen, metallic.
10. Use standard bond orders: 1 (single), 2 (double), 3 (triple), 1.5 (aromatic/resonant).
11. Add educational descriptions that explain molecular properties and significance.
12. For each atom, include the full element name and atomic number.${educationalContext}

VISUALIZATION GUIDELINES:
- Arrange atoms to minimize overlap while maintaining chemical accuracy
- For cyclic structures (benzene, etc.), ensure proper planarity
- For 3D structures, use appropriate spatial arrangements
- Include hydrogen atoms where chemically relevant
- For crystals, show repeating unit cell patterns clearly`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: generationPrompt,
      config: {
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.HIGH,
        },
        responseMimeType: "application/json",
        responseSchema: moleculeSchema,
        systemInstruction: "You are an expert computational chemist and educator. You generate precise 3D coordinate data for molecular visualization engines. Provide chemically accurate structures with educational value.",
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API");
    }

    const result = JSON.parse(text) as MoleculeViewerData;

    console.log('🧪 Molecular Structure Generated:', {
      name: result.name,
      category: result.category,
      atomCount: result.atoms.length,
      bondCount: result.bonds.length
    });

    return result;

  } catch (error) {
    console.error("Error generating molecular structure:", error);
    throw error;
  }
};

/**
 * Generate multiple molecule examples for a chemistry topic
 *
 * Useful for comparative lessons or exploring variations
 *
 * @param topic - Chemistry topic (e.g., "alkanes", "ionic compounds")
 * @param count - Number of examples to generate (default: 3)
 * @param gradeLevel - Optional grade level for age-appropriate content
 * @returns Array of MoleculeViewerData
 */
export const generateMoleculeExamples = async (
  topic: string,
  count: number = 3,
  gradeLevel?: string
): Promise<MoleculeViewerData[]> => {
  const examples: MoleculeViewerData[] = [];

  // Generate common examples for the topic
  const examplePrompt = `List ${count} representative molecules for the topic: "${topic}".
  Provide diverse examples that show key concepts.`;

  // For simplicity, generate them sequentially
  // In production, you might want to generate all at once or in parallel
  for (let i = 0; i < count; i++) {
    const molecule = await generateMoleculeData(
      `${topic} - example ${i + 1}`,
      gradeLevel
    );
    examples.push(molecule);
  }

  return examples;
};
