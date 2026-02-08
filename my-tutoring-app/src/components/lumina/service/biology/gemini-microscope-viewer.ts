import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

// Import the data type from the component (single source of truth)
import { MicroscopeViewerData } from "../../primitives/visual-primitives/biology/MicroscopeViewer";

/**
 * Schema definition for Microscope Viewer Data
 *
 * This schema defines the structure for simulated microscope experiences
 * with zoom levels, labeling tasks, and guided observation prompts.
 * Students examine specimens at increasing magnification and identify structures.
 *
 * The primitive follows the PRD specification for "Microscope Viewer" from
 * the biology primitives document - it bridges the gap between macro
 * observation and micro understanding.
 */
const microscopeViewerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    specimen: {
      type: Type.OBJECT,
      properties: {
        name: {
          type: Type.STRING,
          description: "Name of the specimen (e.g., 'Onion Epidermal Cell', 'Cheek Cell', 'Paramecium')"
        },
        type: {
          type: Type.STRING,
          enum: ["cell", "tissue", "organism", "mineral"],
          description: "Type of specimen"
        },
        prepMethod: {
          type: Type.STRING,
          description: "Preparation method (e.g., 'stained with iodine', 'unstained', 'cross-section', 'whole mount'), null if not specified",
          nullable: true
        }
      },
      required: ["name", "type"]
    },
    zoomLevels: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          magnification: {
            type: Type.STRING,
            description: "Magnification level (e.g., '40x', '100x', '400x')"
          },
          imagePrompt: {
            type: Type.STRING,
            description: "Detailed description of what the student sees at this magnification level - used for AI image generation"
          },
          visibleStructures: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: {
                  type: Type.STRING,
                  description: "Unique identifier (e.g., 'cell-wall', 'nucleus')"
                },
                name: {
                  type: Type.STRING,
                  description: "Name of the structure (e.g., 'Cell Wall', 'Nucleus')"
                },
                description: {
                  type: Type.STRING,
                  description: "Brief description of the structure visible at this magnification"
                },
                labelPosition: {
                  type: Type.OBJECT,
                  properties: {
                    x: {
                      type: Type.NUMBER,
                      description: "Horizontal position as percentage (0-100) within the viewport"
                    },
                    y: {
                      type: Type.NUMBER,
                      description: "Vertical position as percentage (0-100) within the viewport"
                    }
                  },
                  required: ["x", "y"]
                },
                function: {
                  type: Type.STRING,
                  description: "The function of this structure (e.g., 'Provides structural support and protection')"
                }
              },
              required: ["id", "name", "description", "labelPosition", "function"]
            },
            description: "Structures visible and labelable at this magnification (0-6 per level)"
          },
          observationPrompt: {
            type: Type.STRING,
            description: "Guided observation question for the student (e.g., 'What shape are the cells at this magnification?')"
          }
        },
        required: ["magnification", "imagePrompt", "visibleStructures", "observationPrompt"]
      },
      description: "Array of 2-4 zoom levels from lowest to highest magnification"
    },
    comparisonNote: {
      type: Type.STRING,
      description: "Optional note comparing this specimen to others (e.g., 'Compare this to the animal cell you observed earlier'), null if not applicable",
      nullable: true
    },
    gradeBand: {
      type: Type.STRING,
      enum: ["3-5", "6-8"],
      description: "Target grade band - determines vocabulary and complexity"
    }
  },
  required: ["specimen", "zoomLevels", "gradeBand"]
};

/**
 * Generate microscope viewer data using Gemini AI
 *
 * This function creates simulated microscope experiences for biology education.
 * Students examine specimens at increasing magnification, label structures,
 * and respond to guided observation prompts.
 *
 * Covers:
 * - Plant cells (onion, elodea, leaf cross-section)
 * - Animal cells (cheek cells, blood cells)
 * - Microorganisms (paramecium, amoeba, bacteria)
 * - Tissues (muscle tissue, epithelial tissue)
 * - Minerals and crystals
 *
 * @param topic - The specimen or topic (e.g., "onion cell", "cheek cell", "paramecium")
 * @param gradeBand - Grade level ('3-5' or '6-8') determines complexity
 * @param config - Optional partial configuration to override generated values
 * @returns MicroscopeViewerData with zoom levels, structures, and observation prompts
 */
export const generateMicroscopeViewer = async (
  topic: string,
  gradeBand: '3-5' | '6-8' = '3-5',
  config?: Partial<MicroscopeViewerData>
): Promise<MicroscopeViewerData> => {

  // Grade-specific vocabulary and complexity instructions
  const gradeContext = {
    '3-5': `
GRADE 3-5 GUIDELINES:
- Use simple, concrete vocabulary
- 2-3 zoom levels (e.g., 40x, 100x, maybe 400x)
- 2-4 structures per zoom level (keep it manageable)
- Focus on OBSERVABLE features students can actually see in a real microscope
- Observation prompts should be about shape, color, pattern, size
- Use familiar comparisons ("cells look like bricks in a wall")
- Structure descriptions should be 1-2 simple sentences
- Function descriptions should use everyday language
- Label positions should be spread out (not too close together)
`,
    '6-8': `
GRADE 6-8 GUIDELINES:
- Use proper scientific terminology
- 3-4 zoom levels (40x, 100x, 400x, optionally 1000x)
- 3-6 structures per zoom level
- Include organelles visible at higher magnifications
- Observation prompts should encourage scientific reasoning
- Use precise scientific descriptions
- Connect structure to function explicitly
- Include preparation method effects on visibility
- Label positions should be accurately placed relative to typical microscope views
`,
  };

  // Infer specimen type from topic
  const typeKeywords: Record<string, string> = {
    'cell': 'cell',
    'blood': 'cell',
    'cheek': 'cell',
    'onion': 'cell',
    'elodea': 'cell',
    'tissue': 'tissue',
    'muscle': 'tissue',
    'epithelial': 'tissue',
    'skin': 'tissue',
    'paramecium': 'organism',
    'amoeba': 'organism',
    'bacteria': 'organism',
    'euglena': 'organism',
    'volvox': 'organism',
    'hydra': 'organism',
    'crystal': 'mineral',
    'mineral': 'mineral',
    'rock': 'mineral',
    'salt': 'mineral',
  };

  let inferredType = 'cell'; // default
  const topicLower = topic.toLowerCase();
  for (const [keyword, type] of Object.entries(typeKeywords)) {
    if (topicLower.includes(keyword)) {
      inferredType = type;
      break;
    }
  }

  const generationPrompt = `Create an educational microscope viewer experience for: "${topic}".

TARGET GRADE BAND: ${gradeBand}

${gradeContext[gradeBand]}

SPECIMEN TYPE: ${inferredType}
- cell: Individual cells or cell preparations
- tissue: Tissue samples showing multiple cell types
- organism: Whole microorganisms
- mineral: Mineral or crystal samples

REQUIRED INFORMATION:

1. **Specimen**: Name, type (${inferredType}), and preparation method if applicable

2. **Zoom Levels** (${gradeBand === '3-5' ? '2-3' : '3-4'} levels):
   For each zoom level:
   - **magnification**: Power level (e.g., "40x", "100x", "400x")
   - **imagePrompt**: Detailed description of what the student sees at this magnification through a microscope. Be specific about shapes, colors, patterns, and relative sizes. This will be used to generate an AI image.
   - **visibleStructures**: Array of structures visible at this magnification. Each structure needs:
     - **id**: Unique identifier (e.g., "cell-wall", "nucleus")
     - **name**: Scientific name of the structure
     - **description**: What it looks like under the microscope at this magnification
     - **labelPosition**: { x: percentage 0-100, y: percentage 0-100 } - position within circular viewport. IMPORTANT: Spread positions out, don't cluster them. Keep positions between 15 and 85 for both x and y to stay within the circular lens area.
     - **function**: What this structure does
   - **observationPrompt**: A guiding question that encourages students to look carefully

3. **Comparison Note** (optional): A note suggesting comparison to other specimens, or null

4. **Grade Band**: ${gradeBand}

STRUCTURE PLACEMENT GUIDELINES:
- Low magnification (40x): Few structures visible (1-3), spread across the viewport
- Medium magnification (100x): More structures become visible (2-4)
- High magnification (400x): Detailed structures visible (3-6)
- Ensure label positions don't overlap (at least 15 percentage points apart)
- Keep all positions between 15-85% for both x and y coordinates

OBSERVATION PROMPT GUIDELINES:
- Low power: "What overall shape do you notice?" / "How are the cells arranged?"
- Medium power: "Can you see any structures inside the cells?" / "What differences do you notice?"
- High power: "What structures can you identify inside the cell?" / "How does this compare to what you expected?"

EXAMPLE - Onion Epidermal Cell (Grade 3-5):
{
  "specimen": {
    "name": "Onion Epidermal Cell",
    "type": "cell",
    "prepMethod": "stained with iodine"
  },
  "zoomLevels": [
    {
      "magnification": "40x",
      "imagePrompt": "Low power microscope view of onion skin cells arranged in a neat brick-like pattern. Cells appear as rectangular shapes packed tightly together. Light purple/brown tint from iodine staining. The overall pattern looks like a grid.",
      "visibleStructures": [
        {
          "id": "cell-wall",
          "name": "Cell Wall",
          "description": "The thick dark lines forming the rectangular shape of each cell",
          "labelPosition": { "x": 35, "y": 30 },
          "function": "Provides rigid support and shape to the plant cell"
        }
      ],
      "observationPrompt": "What shape are the cells? Do they remind you of anything you've seen before?"
    },
    {
      "magnification": "100x",
      "imagePrompt": "Medium power view of onion cells showing more detail. Individual cells are clearly rectangular with visible cell walls. Some cells show a darker circular spot (nucleus) inside. Iodine staining makes the nucleus appear darker brown/purple.",
      "visibleStructures": [
        {
          "id": "cell-wall-100",
          "name": "Cell Wall",
          "description": "Thick borders around each cell, clearly visible as dark lines",
          "labelPosition": { "x": 25, "y": 40 },
          "function": "Provides rigid support and protection for the plant cell"
        },
        {
          "id": "nucleus",
          "name": "Nucleus",
          "description": "A round, dark-stained spot near the edge of the cell",
          "labelPosition": { "x": 60, "y": 55 },
          "function": "Contains the cell's DNA and controls cell activities"
        }
      ],
      "observationPrompt": "Can you spot a darker round structure inside any of the cells? Where is it located within the cell?"
    },
    {
      "magnification": "400x",
      "imagePrompt": "High power view showing a single onion cell in detail. The cell wall is very clearly defined. The nucleus appears as a large dark oval structure near the edge. The cytoplasm fills the cell interior and appears slightly granular. A large clear area (vacuole) takes up most of the cell center.",
      "visibleStructures": [
        {
          "id": "cell-wall-400",
          "name": "Cell Wall",
          "description": "The rigid outer boundary of the cell, appearing as a thick dark line",
          "labelPosition": { "x": 20, "y": 30 },
          "function": "Made of cellulose, provides structural support and protection"
        },
        {
          "id": "nucleus-400",
          "name": "Nucleus",
          "description": "A large, dark, oval-shaped structure pressed against the cell wall",
          "labelPosition": { "x": 70, "y": 25 },
          "function": "The control center of the cell, containing genetic instructions (DNA)"
        },
        {
          "id": "cytoplasm",
          "name": "Cytoplasm",
          "description": "The slightly grainy, gel-like material filling the space between the nucleus and the cell wall",
          "labelPosition": { "x": 45, "y": 70 },
          "function": "A jelly-like substance where chemical reactions happen inside the cell"
        },
        {
          "id": "vacuole",
          "name": "Central Vacuole",
          "description": "The large, clear area taking up most of the cell's interior",
          "labelPosition": { "x": 50, "y": 45 },
          "function": "Stores water and nutrients, helps maintain cell shape"
        }
      ],
      "observationPrompt": "Most of this cell appears clear or empty. What structure do you think fills most of the space, and why might a plant cell need it?"
    }
  ],
  "comparisonNote": "Compare these rectangular plant cells to cheek cells - how does their shape differ? Why might plant cells need to be more rigid?",
  "gradeBand": "3-5"
}

Now generate a microscope viewer for "${topic}" at grade level ${gradeBand}.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: microscopeViewerSchema,
        systemInstruction: `You are an expert biology educator specializing in microscopy and cell biology for grades 3-8. You create scientifically accurate simulated microscope experiences that teach students to observe, identify structures, and reason about biological organization at different scales. You understand what is actually visible at different magnifications under a real light microscope and ensure your descriptions match real microscope observations. You design observation prompts that develop scientific observation skills. You place structure labels at realistic positions within the microscope field of view.`,
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API");
    }

    const result = JSON.parse(text) as MicroscopeViewerData;

    // Validate zoom levels
    if (!result || !result.zoomLevels || !Array.isArray(result.zoomLevels) || result.zoomLevels.length === 0) {
      console.error('Invalid response from Gemini API - missing zoomLevels:', result);
      throw new Error('Invalid response from Gemini API: missing or invalid zoomLevels array');
    }

    // Validate specimen
    if (!result.specimen || !result.specimen.name) {
      console.error('Invalid response from Gemini API - missing specimen:', result);
      throw new Error('Invalid response from Gemini API: missing specimen data');
    }

    // Merge with any config overrides
    const finalData: MicroscopeViewerData = {
      ...result,
      ...config,
      specimen: config?.specimen || result.specimen,
      zoomLevels: config?.zoomLevels || result.zoomLevels,
    };

    console.log('🔬 Microscope Viewer Generated:', {
      specimen: finalData.specimen.name,
      type: finalData.specimen.type,
      zoomLevelCount: finalData.zoomLevels.length,
      totalStructures: finalData.zoomLevels.reduce(
        (sum, z) => sum + (z.visibleStructures?.length || 0), 0
      ),
      gradeBand: finalData.gradeBand,
    });

    return finalData;

  } catch (error) {
    console.error("Error generating microscope viewer:", error);
    throw error;
  }
};
