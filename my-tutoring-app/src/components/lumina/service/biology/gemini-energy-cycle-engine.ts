import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

// Import the data type from the component (single source of truth)
import { EnergyCycleEngineData } from "../../primitives/visual-primitives/biology/EnergyCycleEngine";

/**
 * Schema definition for Energy Cycle Engine Data
 *
 * This schema defines the structure for the photosynthesis-respiration coupled
 * energy cycle primitive. Students manipulate inputs and observe how the two
 * processes are interconnected — the outputs of one are the inputs of the other.
 */
const energyCycleEngineSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    mode: {
      type: Type.STRING,
      enum: ["photosynthesis", "respiration", "coupled"],
      description: "Default view mode. Use 'coupled' to show both processes side-by-side."
    },
    photosynthesis: {
      type: Type.OBJECT,
      properties: {
        location: {
          type: Type.STRING,
          description: "Where this process occurs (e.g., 'Chloroplasts in plant cells')"
        },
        inputs: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              molecule: { type: Type.STRING, description: "Molecule name (e.g., 'CO₂', 'H₂O', 'Light Energy')" },
              source: { type: Type.STRING, description: "Where this input comes from (e.g., 'From the air', 'From roots')" },
              amount: { type: Type.STRING, enum: ["adjustable", "fixed"], description: "Whether student can adjust this input" }
            },
            required: ["molecule", "source", "amount"]
          }
        },
        outputs: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              molecule: { type: Type.STRING, description: "Molecule name" },
              destination: { type: Type.STRING, description: "Where this output goes" }
            },
            required: ["molecule", "destination"]
          }
        },
        equation: { type: Type.STRING, description: "Chemical equation (e.g., '6CO₂ + 6H₂O + Light → C₆H₁₂O₆ + 6O₂')" },
        energySource: { type: Type.STRING, description: "Energy source description (e.g., 'Sunlight (light energy)')" },
        stages: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Stage name (e.g., 'Light-Dependent Reactions')" },
              description: { type: Type.STRING, description: "2-3 sentence description of what happens" },
              location: { type: Type.STRING, description: "Where in the organelle this occurs (e.g., 'Thylakoid membrane')" }
            },
            required: ["name", "description", "location"]
          }
        }
      },
      required: ["location", "inputs", "outputs", "equation", "energySource", "stages"]
    },
    cellularRespiration: {
      type: Type.OBJECT,
      properties: {
        location: {
          type: Type.STRING,
          description: "Where this process occurs (e.g., 'Mitochondria in all cells')"
        },
        inputs: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              molecule: { type: Type.STRING },
              source: { type: Type.STRING },
              amount: { type: Type.STRING, enum: ["adjustable", "fixed"] }
            },
            required: ["molecule", "source", "amount"]
          }
        },
        outputs: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              molecule: { type: Type.STRING },
              destination: { type: Type.STRING }
            },
            required: ["molecule", "destination"]
          }
        },
        equation: { type: Type.STRING },
        energyOutput: { type: Type.STRING, description: "Energy output description (e.g., 'ATP (cellular energy currency)')" },
        stages: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              description: { type: Type.STRING },
              location: { type: Type.STRING }
            },
            required: ["name", "description", "location"]
          }
        }
      },
      required: ["location", "inputs", "outputs", "equation", "energyOutput", "stages"]
    },
    couplingPoints: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          molecule: { type: Type.STRING, description: "The shared molecule (e.g., 'Glucose', 'O₂', 'CO₂')" },
          producedBy: { type: Type.STRING, enum: ["photosynthesis", "respiration"] },
          consumedBy: { type: Type.STRING, enum: ["photosynthesis", "respiration"] },
          description: { type: Type.STRING, description: "How these processes are connected through this molecule" }
        },
        required: ["molecule", "producedBy", "consumedBy", "description"]
      },
      description: "Molecules that connect photosynthesis and respiration (typically 3-4: glucose, O₂, CO₂, H₂O)"
    },
    experiments: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          scenario: { type: Type.STRING, description: "The 'What if?' question (e.g., 'What happens if you block all light?')" },
          affectedInputs: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                molecule: { type: Type.STRING },
                newLevel: { type: Type.STRING, description: "New level: 'zero', 'low', 'high', or a number 0-100" }
              },
              required: ["molecule", "newLevel"]
            }
          },
          expectedOutcome: { type: Type.STRING, description: "What actually happens (brief)" },
          explanation: { type: Type.STRING, description: "Detailed explanation of why this happens, connecting both processes" }
        },
        required: ["scenario", "affectedInputs", "expectedOutcome", "explanation"]
      },
      description: "3-5 'What If?' experimental scenarios that demonstrate the coupled nature"
    },
    gradeBand: {
      type: Type.STRING,
      enum: ["5-6", "7-8"],
      description: "Target grade band"
    }
  },
  required: ["mode", "photosynthesis", "cellularRespiration", "couplingPoints", "experiments", "gradeBand"]
};

/**
 * Generate energy cycle engine data using Gemini AI
 *
 * Creates an interactive model showing the coupled relationship between
 * photosynthesis and cellular respiration. Students manipulate inputs
 * and observe how changes cascade between the two processes.
 *
 * @param topic - The specific focus (e.g., "photosynthesis and respiration", "plant energy", "cellular energy")
 * @param gradeBand - Grade level ('5-6' or '7-8')
 * @param config - Optional partial configuration to override generated values
 * @returns EnergyCycleEngineData
 */
export const generateEnergyCycleEngine = async (
  topic: string,
  gradeBand: '5-6' | '7-8' = '5-6',
  config?: Partial<EnergyCycleEngineData>
): Promise<EnergyCycleEngineData> => {

  const gradeContext = {
    '5-6': `
GRADE 5-6 GUIDELINES:
- Use scientific vocabulary WITH clear explanations
- Keep chemical equations simple and readable
- Use molecular names students know (CO₂, O₂, glucose, water)
- Focus on the BIG PICTURE: inputs, outputs, and the cycle connection
- 2-3 stages per process (not too detailed)
- Experiments should test basic cause-and-effect reasoning
- Make it clear that these processes are OPPOSITE and CONNECTED
- Use analogies: "like a factory" or "like charging and using a battery"
`,
    '7-8': `
GRADE 7-8 GUIDELINES:
- Use proper scientific terminology
- Include detailed chemical equations with molecular formulas
- 3-4 stages per process with subcellular locations
- Include ATP production details and energy currency concepts
- Experiments should require systems thinking and cascade reasoning
- Address common misconceptions (e.g., "plants don't do respiration")
- Include electron transport chain and Krebs cycle references for grade 8
- Connect to broader concepts: carbon cycle, energy flow in ecosystems
`
  };

  const generationPrompt = `Create an interactive energy cycle engine for: "${topic}".

TARGET GRADE BAND: ${gradeBand}

${gradeContext[gradeBand]}

This primitive teaches the COUPLED relationship between photosynthesis and cellular respiration.
Key learning goals:
1. Outputs of photosynthesis are inputs of cellular respiration (and vice versa)
2. Both processes are happening simultaneously in plants
3. Disrupting one process cascades to affect the other
4. Together they form a continuous energy cycle

REQUIRED CONTENT:

1. **Mode**: Always set to "coupled" (shows both processes side-by-side)

2. **Photosynthesis** (in chloroplasts):
   - Location: Where it occurs
   - Inputs: CO₂ (adjustable), H₂O (adjustable), Light Energy (adjustable)
   - Outputs: Glucose, O₂
   - Chemical equation
   - Energy source description
   - ${gradeBand === '5-6' ? '2-3' : '3-4'} stages with locations

3. **Cellular Respiration** (in mitochondria):
   - Location: Where it occurs
   - Inputs: Glucose (adjustable), O₂ (adjustable)
   - Outputs: CO₂, H₂O, ATP
   - Chemical equation
   - Energy output description
   - ${gradeBand === '5-6' ? '2-3' : '3-4'} stages with locations

4. **Coupling Points** (3-4 molecules that connect the processes):
   - Glucose: produced by photosynthesis, consumed by respiration
   - O₂: produced by photosynthesis, consumed by respiration
   - CO₂: produced by respiration, consumed by photosynthesis
   - H₂O: produced by respiration, consumed by photosynthesis

5. **Experiments** (${gradeBand === '5-6' ? '3-4' : '4-5'} "What If?" scenarios):
   Examples:
   - "What happens if you block all light?" → Photosynthesis stops, but respiration continues using stored glucose. Eventually glucose runs out.
   - "What happens if CO₂ levels drop to zero?" → Photosynthesis can't fix carbon, no new glucose is made, respiration eventually slows.
   - "What happens if O₂ is removed?" → Respiration can't proceed aerobically, cells switch to fermentation (less ATP).
   - "What happens at night?" → No light for photosynthesis, but respiration continues normally.
   Each experiment should have: scenario question, affected inputs with new levels, expected outcome, and detailed explanation.

6. **Grade Band**: ${gradeBand}

IMPORTANT:
- Use Unicode subscripts/superscripts for chemical formulas (CO₂, H₂O, O₂, C₆H₁₂O₆)
- Make experiments demonstrate the COUPLED nature — changing one process affects the other
- Include at least one experiment about what happens at night (common student question)
- Include at least one experiment about removing a key molecule

Now generate the energy cycle engine data for "${topic}" at grade band ${gradeBand}.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: energyCycleEngineSchema,
        systemInstruction: `You are an expert biology educator specializing in grades 5-8 life sciences. You create engaging, scientifically accurate models of cellular processes. You understand that photosynthesis and cellular respiration form a coupled energy cycle and can explain this in age-appropriate ways. You design experiments that help students discover the interconnected nature of these processes through cause-and-effect reasoning.`,
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API");
    }

    const result = JSON.parse(text) as EnergyCycleEngineData;

    // Validate essential fields
    if (!result?.photosynthesis?.inputs || !result?.cellularRespiration?.inputs) {
      throw new Error('Invalid response: missing photosynthesis or cellularRespiration data');
    }

    if (!result.couplingPoints || result.couplingPoints.length === 0) {
      throw new Error('Invalid response: missing coupling points');
    }

    if (!result.experiments || result.experiments.length === 0) {
      throw new Error('Invalid response: missing experiments');
    }

    // Merge with config overrides
    const finalData: EnergyCycleEngineData = {
      ...result,
      ...config,
      photosynthesis: config?.photosynthesis || result.photosynthesis,
      cellularRespiration: config?.cellularRespiration || result.cellularRespiration,
      couplingPoints: config?.couplingPoints || result.couplingPoints,
      experiments: config?.experiments || result.experiments,
    };

    console.log('⚡ Energy Cycle Engine Generated:', {
      mode: finalData.mode,
      photoStages: finalData.photosynthesis.stages.length,
      respStages: finalData.cellularRespiration.stages.length,
      couplingPoints: finalData.couplingPoints.length,
      experiments: finalData.experiments.length,
      gradeBand: finalData.gradeBand,
    });

    return finalData;

  } catch (error) {
    console.error("Error generating energy cycle engine:", error);
    throw error;
  }
};
