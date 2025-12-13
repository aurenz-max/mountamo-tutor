import { GoogleGenAI, Type, Schema } from "@google/genai";
import { MoleculeData } from "../types";

// Schema definition for Molecule Data
const moleculeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "Common name of the molecule or structure" },
    description: { type: Type.STRING, description: "Educational description of the molecule, its bonds, and properties." },
    category: { type: Type.STRING, enum: ['organic', 'inorganic', 'protein', 'crystal', 'other'] },
    atoms: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          element: { type: Type.STRING, description: "Periodic symbol (e.g. C, H, O)" },
          name: { type: Type.STRING, description: "Element name" },
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
          description: { type: Type.STRING, description: "Short fact about this specific atom role if relevant" }
        },
        required: ["id", "element", "position"]
      }
    },
    bonds: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          sourceId: { type: Type.STRING, description: "id of source atom" },
          targetId: { type: Type.STRING, description: "id of target atom" },
          order: { type: Type.NUMBER, description: "1 for single, 2 for double, 3 for triple. Use 0.5 for ionic attractions." },
          type: { type: Type.STRING, enum: ['covalent', 'ionic', 'hydrogen', 'metallic', 'unknown'] }
        },
        required: ["sourceId", "targetId", "order", "type"]
      }
    }
  },
  required: ["name", "description", "atoms", "bonds", "category"]
};

export const generateMoleculeData = async (prompt: string): Promise<MoleculeData> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key missing");

    const ai = new GoogleGenAI({ apiKey });

    // We use gemini-2.5-flash for speed and structural reasoning
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Generate a 3D molecular structure for: "${prompt}".
      
      RULES:
      1. Provide accurate 3D coordinates (Angstrom scale approximation).
      2. If it's a crystal (like Diamond or Salt), generate a small lattice (at least 3x3x3 unit cells or enough to show the pattern, roughly 20-50 atoms).
      3. If it's a polymer/plastic, generate a short chain.
      4. Ensure bonds connect the correct atoms based on chemistry rules.
      5. Center the molecule at 0,0,0.
      6. For "Diamond", use Carbon atoms in a tetrahedral lattice.
      7. For "Salt" (NaCl), use Na and Cl in a cubic lattice.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: moleculeSchema,
        systemInstruction: "You are an expert computational chemist and educator. You generate precise 3D coordinate data for molecular visualization engines.",
      }
    });

    const text = response.text;
    if (!text) throw new Error("No data returned");

    return JSON.parse(text) as MoleculeData;

  } catch (error) {
    console.error("Gemini Molecule Generation Error:", error);
    throw error;
  }
};