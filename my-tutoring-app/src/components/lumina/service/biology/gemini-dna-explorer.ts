import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

// Import the data type from the component (single source of truth)
import { DnaExplorerData } from "../../primitives/visual-primitives/biology/DnaExplorer";

/**
 * Schema definition for DNA Explorer Data
 *
 * Generates interactive DNA structure exploration activities for genetics education.
 * Supports:
 * - Structure mode: Explore the double helix, backbone, and base pairing
 * - Base-pairing mode: Practice matching complementary bases
 * - Transcription mode: Understand DNA → RNA
 * - Replication mode: Understand DNA copying
 */
const dnaExplorerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the DNA exploration activity"
    },
    description: {
      type: Type.STRING,
      description: "Brief instructions for students (1-2 sentences)"
    },
    mode: {
      type: Type.STRING,
      enum: ["structure", "base-pairing", "transcription", "replication"],
      description: "The focus mode for this DNA exploration"
    },
    sequence: {
      type: Type.OBJECT,
      properties: {
        templateStrand: {
          type: Type.STRING,
          description: "DNA template strand sequence (5' to 3' direction, only A/T/C/G characters, 6-12 bases)"
        },
        complementaryStrand: {
          type: Type.STRING,
          description: "Complementary strand (3' to 5' direction, auto-paired: A↔T, C↔G)"
        },
        highlightedRegion: {
          type: Type.OBJECT,
          properties: {
            start: { type: Type.INTEGER, description: "Start index (0-based) of highlighted region" },
            end: { type: Type.INTEGER, description: "End index (0-based) of highlighted region" },
            label: { type: Type.STRING, description: "Label for the highlighted region (e.g., 'Gene for eye color')" }
          },
          required: ["start", "end", "label"]
        }
      },
      required: ["templateStrand", "complementaryStrand"]
    },
    nucleotides: {
      type: Type.ARRAY,
      description: "Information about each of the 4 DNA nucleotides (A, T, C, G)",
      items: {
        type: Type.OBJECT,
        properties: {
          base: {
            type: Type.STRING,
            enum: ["A", "T", "C", "G"],
            description: "Single-letter base code"
          },
          fullName: {
            type: Type.STRING,
            description: "Full name of the nucleotide (e.g., 'Adenine')"
          },
          type: {
            type: Type.STRING,
            enum: ["purine", "pyrimidine"],
            description: "Whether purine (A, G) or pyrimidine (C, T)"
          },
          pairsWith: {
            type: Type.STRING,
            description: "Which base this pairs with (A↔T, C↔G)"
          },
          color: {
            type: Type.STRING,
            description: "Hex color for this base (e.g., '#22c55e' for green)"
          },
          bondType: {
            type: Type.STRING,
            description: "Bond description (e.g., '2 hydrogen bonds' for A-T, '3 hydrogen bonds' for C-G)"
          }
        },
        required: ["base", "fullName", "type", "pairsWith", "color", "bondType"]
      }
    },
    structuralFeatures: {
      type: Type.OBJECT,
      properties: {
        sugarPhosphateBackbone: {
          type: Type.STRING,
          description: "Grade-appropriate description of the sugar-phosphate backbone"
        },
        majorGroove: {
          type: Type.STRING,
          description: "Description of the major groove (grades 7-8 only, null for 5-6)"
        },
        minorGroove: {
          type: Type.STRING,
          description: "Description of the minor groove (grades 7-8 only, null for 5-6)"
        },
        antiparallelOrientation: {
          type: Type.STRING,
          description: "Grade-appropriate explanation of 5' to 3' directionality"
        }
      },
      required: ["sugarPhosphateBackbone", "antiparallelOrientation"]
    },
    zoomLevels: {
      type: Type.ARRAY,
      description: "Zoom levels from chromosome down to molecular (2-5 levels based on grade)",
      items: {
        type: Type.OBJECT,
        properties: {
          level: {
            type: Type.STRING,
            enum: ["chromosome", "gene", "sequence", "base-pair", "molecular"],
            description: "Zoom level identifier"
          },
          description: {
            type: Type.STRING,
            description: "What students see at this zoom level"
          },
          visibleFeatures: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Features visible at this zoom level"
          }
        },
        required: ["level", "description", "visibleFeatures"]
      }
    },
    centralDogmaStep: {
      type: Type.STRING,
      enum: ["none", "transcription", "translation"],
      description: "Which central dogma step to highlight (none for structure/base-pairing mode)"
    },
    buildChallenges: {
      type: Type.ARRAY,
      description: "Base pairing challenges for students (2-4 challenges)",
      items: {
        type: Type.OBJECT,
        properties: {
          givenStrand: {
            type: Type.STRING,
            description: "Template strand with some bases replaced by '_' for blanks (e.g., 'A_CG_T')"
          },
          task: {
            type: Type.STRING,
            description: "Instructions for the student (e.g., 'Complete the complementary strand')"
          },
          correctAnswer: {
            type: Type.STRING,
            description: "The full correct complementary strand (e.g., 'TAGCCA')"
          }
        },
        required: ["givenStrand", "task", "correctAnswer"]
      }
    },
    gradeBand: {
      type: Type.STRING,
      enum: ["5-6", "7-8"],
      description: "Target grade band"
    }
  },
  required: [
    "title", "description", "mode", "sequence", "nucleotides",
    "structuralFeatures", "zoomLevels", "centralDogmaStep",
    "buildChallenges", "gradeBand"
  ]
};

/**
 * Generate DNA Explorer data using Gemini AI
 *
 * Creates an interactive DNA structure exploration with base pairing
 * challenges, zoom levels, and structural feature descriptions.
 *
 * @param topic - The genetics topic (e.g., "DNA structure", "base pairing rules", "DNA replication")
 * @param gradeBand - Grade level ('5-6' or '7-8') determines complexity
 * @param config - Optional partial configuration to override generated values
 * @returns DnaExplorerData with sequence, nucleotides, challenges, and zoom levels
 */
export const generateDnaExplorer = async (
  topic: string,
  gradeBand: '5-6' | '7-8' = '5-6',
  config?: Partial<DnaExplorerData>
): Promise<DnaExplorerData> => {

  const gradeContext = {
    '5-6': `
GRADE 5-6 GUIDELINES:
- Focus on BASE PAIRING RULES: A always pairs with T, C always pairs with G
- Use simple vocabulary: "backbone" instead of "sugar-phosphate backbone" in descriptions
- Keep sequences SHORT: 6-8 bases maximum
- Mode should be "structure" or "base-pairing" (no transcription/replication)
- centralDogmaStep should be "none"
- Zoom levels: 3 levels (chromosome, sequence, base-pair)
- Do NOT include majorGroove/minorGroove in structural features
- Build challenges: 2-3 simple complementary strand completion tasks
- Use fun analogies: "DNA is like a twisted ladder" or "bases are like puzzle pieces"
- Highlighted region label should be simple: "A gene" or "Important section"
- antiparallelOrientation: simple explanation like "The two strands run in opposite directions, like two lanes on a road"
`,
    '7-8': `
GRADE 7-8 GUIDELINES:
- Include BASE PAIRING RULES plus hydrogen bond specifics (A-T: 2 bonds, C-G: 3 bonds)
- Use scientific vocabulary: nucleotide, phosphodiester bond, antiparallel
- Sequences can be LONGER: 8-12 bases
- All modes available (structure, base-pairing, transcription, replication)
- centralDogmaStep can be "transcription" or "translation" if mode is transcription
- Zoom levels: 4-5 levels (chromosome, gene, sequence, base-pair, molecular)
- Include majorGroove and minorGroove descriptions
- Build challenges: 3-4 challenges including error identification tasks
- Highlighted region: can be specific gene or promoter region
- antiparallelOrientation: scientific explanation with 5' and 3' terminology
- Include more detail about purine vs pyrimidine classification
`
  };

  const generationPrompt = `Create an interactive DNA structure exploration activity for: "${topic}".

TARGET GRADE BAND: ${gradeBand}

${gradeContext[gradeBand]}

REQUIREMENTS:

1. **Sequence**: Generate a DNA sequence appropriate for the topic and grade level.
   - Template strand: 5' to 3' direction, only A/T/C/G
   - Complementary strand: Must be correctly base-paired (A↔T, C↔G)
   - Length: 6-8 bases for grade 5-6, 8-12 for grade 7-8
   - Optionally highlight a region of interest

2. **Nucleotides**: Provide information for all 4 DNA bases:
   - A (Adenine) - purine, pairs with T, 2 hydrogen bonds
   - T (Thymine) - pyrimidine, pairs with A, 2 hydrogen bonds
   - C (Cytosine) - pyrimidine, pairs with G, 3 hydrogen bonds
   - G (Guanine) - purine, pairs with C, 3 hydrogen bonds

3. **Structural Features**: Grade-appropriate descriptions of:
   - Sugar-phosphate backbone
   - Antiparallel orientation (5' → 3')
   - Major and minor grooves (7-8 only)

4. **Zoom Levels**: Progressive zoom from chromosome to molecular level
   - Each level describes what's visible and key features

5. **Build Challenges**: Interactive tasks for students:
   - Given a template strand (with some blanks shown as '_'), write the complementary strand
   - Progress from simple to more complex
   - For grade 7-8: include one challenge about identifying base pairing errors

6. **Central Dogma Step**: Set based on mode:
   - structure/base-pairing → "none"
   - transcription → "transcription"
   - replication → "none" (replication is about DNA copying, not central dogma per se)

CRITICAL: Make sure:
- All complementary base pairings are correct (A↔T, C↔G)
- Build challenge answers match the base pairing rules
- Zoom levels progress from largest (chromosome) to smallest
- Grade-appropriate vocabulary throughout
- Title and description are engaging for the target age group

Now generate the DNA exploration activity for "${topic}" at grade level ${gradeBand}.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: dnaExplorerSchema,
        systemInstruction: `You are an expert molecular biology educator specializing in middle school genetics. You understand DNA structure, base pairing rules, the central dogma, and how to make molecular biology accessible and exciting for students. You always generate scientifically accurate base pair combinations and create engaging exploration activities that build from observation to understanding.`,
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API");
    }

    const result = JSON.parse(text) as DnaExplorerData;

    // Merge with any config overrides
    const finalData: DnaExplorerData = {
      ...result,
      ...config,
    };

    console.log('🧬 DNA Explorer Generated:', {
      title: finalData.title,
      mode: finalData.mode,
      sequenceLength: finalData.sequence.templateStrand.length,
      challenges: finalData.buildChallenges.length,
      zoomLevels: finalData.zoomLevels.length,
      gradeBand: finalData.gradeBand,
    });

    return finalData;

  } catch (error) {
    console.error("Error generating DNA explorer:", error);
    throw error;
  }
};
