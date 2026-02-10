import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

// Import the data type from the component (single source of truth)
import { InheritanceLabData } from "../../primitives/visual-primitives/biology/InheritanceLab";

/**
 * Schema definition for Inheritance Lab Data
 *
 * Generates interactive Punnett square activities for genetics education.
 * Supports:
 * - Monohybrid crosses (single trait, 2x2 grid)
 * - Dihybrid crosses (two traits, 4x4 grid)
 * - X-linked inheritance patterns
 * - Complete dominance, incomplete dominance, codominance
 */
const inheritanceLabSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the genetics activity"
    },
    description: {
      type: Type.STRING,
      description: "Brief instructions for students (1-2 sentences)"
    },
    trait: {
      type: Type.OBJECT,
      properties: {
        name: {
          type: Type.STRING,
          description: "Name of the trait being studied (e.g., 'Flower Color', 'Eye Color', 'Wing Shape')"
        },
        gene: {
          type: Type.STRING,
          description: "Gene name or identifier"
        },
        dominantAllele: {
          type: Type.OBJECT,
          properties: {
            symbol: { type: Type.STRING, description: "Allele symbol (single uppercase letter, e.g., 'B')" },
            phenotype: { type: Type.STRING, description: "Observable trait when dominant (e.g., 'Purple')" }
          },
          required: ["symbol", "phenotype"]
        },
        recessiveAllele: {
          type: Type.OBJECT,
          properties: {
            symbol: { type: Type.STRING, description: "Allele symbol (single lowercase letter, e.g., 'b')" },
            phenotype: { type: Type.STRING, description: "Observable trait when recessive (e.g., 'White')" }
          },
          required: ["symbol", "phenotype"]
        },
        inheritancePattern: {
          type: Type.STRING,
          enum: ["complete-dominance", "incomplete-dominance", "codominance", "x-linked"],
          description: "Type of inheritance pattern"
        }
      },
      required: ["name", "gene", "dominantAllele", "recessiveAllele", "inheritancePattern"]
    },
    parentA: {
      type: Type.OBJECT,
      properties: {
        genotype: { type: Type.STRING, description: "Parent A genotype (e.g., 'Bb' for monohybrid, 'BbRr' for dihybrid)" },
        phenotype: { type: Type.STRING, description: "Observable trait of Parent A" },
        label: { type: Type.STRING, description: "Label for Parent A (e.g., 'Mother Plant', 'Father')" }
      },
      required: ["genotype", "phenotype", "label"]
    },
    parentB: {
      type: Type.OBJECT,
      properties: {
        genotype: { type: Type.STRING, description: "Parent B genotype" },
        phenotype: { type: Type.STRING, description: "Observable trait of Parent B" },
        label: { type: Type.STRING, description: "Label for Parent B" }
      },
      required: ["genotype", "phenotype", "label"]
    },
    punnettSquare: {
      type: Type.OBJECT,
      properties: {
        rows: { type: Type.INTEGER, description: "Number of rows (2 for monohybrid, 4 for dihybrid)" },
        columns: { type: Type.INTEGER, description: "Number of columns (2 for monohybrid, 4 for dihybrid)" },
        cells: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              row: { type: Type.INTEGER, description: "Row index (0-based)" },
              col: { type: Type.INTEGER, description: "Column index (0-based)" },
              genotype: { type: Type.STRING, description: "Correct genotype for this cell" },
              phenotype: { type: Type.STRING, description: "Observable trait for this genotype" }
            },
            required: ["row", "col", "genotype", "phenotype"]
          }
        }
      },
      required: ["rows", "columns", "cells"]
    },
    expectedRatios: {
      type: Type.OBJECT,
      properties: {
        genotypic: {
          type: Type.ARRAY,
          description: "Array of genotype-to-ratio entries (e.g., [{key: 'BB', value: '1/4'}, {key: 'Bb', value: '2/4'}, {key: 'bb', value: '1/4'}])",
          items: {
            type: Type.OBJECT,
            properties: {
              key: { type: Type.STRING, description: "Genotype string (e.g., 'BB', 'Bb', 'bb')" },
              value: { type: Type.STRING, description: "Ratio as fraction string (e.g., '1/4', '2/4')" }
            },
            required: ["key", "value"]
          }
        },
        phenotypic: {
          type: Type.ARRAY,
          description: "Array of phenotype-to-ratio entries (e.g., [{key: 'Purple', value: '3/4'}, {key: 'White', value: '1/4'}])",
          items: {
            type: Type.OBJECT,
            properties: {
              key: { type: Type.STRING, description: "Phenotype string (e.g., 'Purple', 'White')" },
              value: { type: Type.STRING, description: "Ratio as fraction string (e.g., '3/4', '1/4')" }
            },
            required: ["key", "value"]
          }
        }
      },
      required: ["genotypic", "phenotypic"]
    },
    simulationPopulation: {
      type: Type.INTEGER,
      description: "Number of offspring to simulate (default 100)"
    },
    realWorldExample: {
      type: Type.STRING,
      description: "Real-world example connecting this genetics concept to students' lives or interesting biology"
    },
    crossType: {
      type: Type.STRING,
      enum: ["monohybrid", "dihybrid", "x-linked"],
      description: "Type of genetic cross"
    },
    gradeBand: {
      type: Type.STRING,
      enum: ["6-7", "8"],
      description: "Target grade band"
    }
  },
  required: [
    "title", "description", "trait", "parentA", "parentB",
    "punnettSquare", "expectedRatios", "simulationPopulation",
    "realWorldExample", "crossType", "gradeBand"
  ]
};

/**
 * Generate inheritance lab data using Gemini AI
 *
 * Creates an interactive Punnett square activity for genetics education.
 * Students fill in gamete combinations, predict offspring ratios,
 * and run population simulations.
 *
 * @param topic - The genetics topic (e.g., "flower color", "eye color", "sickle cell")
 * @param gradeBand - Grade level ('6-7' or '8') determines complexity
 * @param config - Optional partial configuration to override generated values
 * @returns InheritanceLabData with Punnett square, ratios, and simulation config
 */
export const generateInheritanceLab = async (
  topic: string,
  gradeBand: '6-7' | '8' = '6-7',
  config?: Partial<InheritanceLabData>
): Promise<InheritanceLabData> => {

  const gradeContext = {
    '6-7': `
GRADE 6-7 GUIDELINES:
- Use MONOHYBRID crosses only (single trait, 2x2 Punnett square)
- Use complete dominance ONLY (one allele completely dominant over the other)
- Choose familiar, relatable traits: flower color (purple/white), seed shape (round/wrinkled), fur color (black/white), eye color
- Use simple language: "dominant" means "shows up when present", "recessive" means "hidden unless both copies"
- Parent labels should be friendly: "Mother Plant", "Father Plant", "Parent 1", "Parent 2"
- Genotypes should be simple 2-letter combos: Bb, BB, bb
- Real-world example should connect to something students know (pets, garden plants, family traits)
- Simulation population: 100 (easy to calculate percentages)
- Always include both heterozygous x heterozygous (Bb x Bb) as the default cross
`,
    '8': `
GRADE 8 GUIDELINES:
- Can use MONOHYBRID or DIHYBRID crosses (teacher preference via topic)
- Can include incomplete dominance (e.g., red x white = pink), codominance (e.g., red + white spots), or x-linked inheritance
- More complex traits: blood type, sickle cell, colorblindness, fruit fly wing shape
- Use precise scientific vocabulary: "heterozygous", "homozygous dominant/recessive", "genotypic ratio", "phenotypic ratio"
- Parent labels can be more scientific: "P1 (Heterozygous)", "P2 (Homozygous Recessive)"
- For dihybrid crosses: use 4-letter genotypes (BbRr) and 4x4 Punnett squares with 16 cells
- For x-linked: use X^H X^h notation style but simplified (e.g., XH, Xh, Y)
- Real-world example should connect to genetics, medicine, or agriculture
- Simulation population: 100-200
- Include at least one cross that produces unexpected or interesting ratios
`
  };

  const generationPrompt = `Create an interactive Punnett square genetics activity for: "${topic}".

TARGET GRADE BAND: ${gradeBand}

${gradeContext[gradeBand]}

REQUIREMENTS:

1. **Trait Selection**: Choose a trait appropriate for the topic and grade level.
   - For grade 6-7: simple traits with complete dominance
   - For grade 8: can include incomplete dominance, codominance, or x-linked

2. **Allele Symbols**:
   - Dominant: single UPPERCASE letter (e.g., B, R, P)
   - Recessive: same letter LOWERCASE (e.g., b, r, p)
   - For dihybrid: two different letters (e.g., BbRr)

3. **Parent Genotypes**: Select parent genotypes that produce interesting offspring ratios.
   Good crosses:
   - Heterozygous x Heterozygous (Bb x Bb) → 3:1 ratio
   - Heterozygous x Homozygous recessive (Bb x bb) → 1:1 ratio (test cross)
   - Homozygous dominant x Heterozygous (BB x Bb) → all dominant phenotype
   - For dihybrid: BbRr x BbRr → 9:3:3:1 ratio (grade 8)

4. **Punnett Square Cells**: Fill in ALL cells correctly.
   - For monohybrid: 4 cells (2x2)
   - For dihybrid: 16 cells (4x4)
   - Each cell needs genotype AND phenotype
   - Genotype follows convention: uppercase letter first (Bb not bB)

5. **Expected Ratios**: Calculate correct genotypic and phenotypic ratios.
   - Express as fractions (e.g., "1/4", "3/4", "9/16")
   - Genotypic: count of each unique genotype
   - Phenotypic: count of each observable trait

6. **Phenotype Determination**:
   - Complete dominance: BB and Bb show dominant phenotype, bb shows recessive
   - Incomplete dominance: heterozygote shows intermediate phenotype (e.g., pink from red + white)
   - Codominance: heterozygote shows BOTH phenotypes (e.g., red AND white spots)
   - X-linked: males with one recessive allele show recessive phenotype

7. **Real-World Example**: Connect genetics to something meaningful and interesting.

8. **Simulation Population**: Set to 100 for grade 6-7, 100-200 for grade 8.

CRITICAL: Make sure:
- All Punnett square cells are filled correctly with proper genotype combinations
- Ratios add up to 1 (or the correct total fraction)
- Phenotypes match the inheritance pattern
- Row/column indices are 0-based

Now generate the activity for "${topic}" at grade level ${gradeBand}.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: inheritanceLabSchema,
        systemInstruction: `You are an expert genetics educator specializing in middle school life sciences. You understand Mendelian genetics, inheritance patterns, and how to create engaging Punnett square activities. You always generate mathematically correct Punnett squares with proper genotype combinations and accurate ratio calculations. You make genetics accessible and interesting for students by connecting concepts to real-world examples.`,
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API");
    }

    const raw = JSON.parse(text);

    // Convert expectedRatios from array format [{key, value}] to Record<string, string>
    if (raw.expectedRatios) {
      if (Array.isArray(raw.expectedRatios.genotypic)) {
        raw.expectedRatios.genotypic = Object.fromEntries(
          raw.expectedRatios.genotypic.map((entry: { key: string; value: string }) => [entry.key, entry.value])
        );
      }
      if (Array.isArray(raw.expectedRatios.phenotypic)) {
        raw.expectedRatios.phenotypic = Object.fromEntries(
          raw.expectedRatios.phenotypic.map((entry: { key: string; value: string }) => [entry.key, entry.value])
        );
      }
    }

    const result = raw as InheritanceLabData;

    // Merge with any config overrides
    const finalData: InheritanceLabData = {
      ...result,
      ...config,
    };

    console.log('🧬 Inheritance Lab Generated:', {
      title: finalData.title,
      trait: finalData.trait.name,
      crossType: finalData.crossType,
      inheritancePattern: finalData.trait.inheritancePattern,
      parentA: finalData.parentA.genotype,
      parentB: finalData.parentB.genotype,
      cells: finalData.punnettSquare.cells.length,
      gradeBand: finalData.gradeBand,
    });

    return finalData;

  } catch (error) {
    console.error("Error generating inheritance lab:", error);
    throw error;
  }
};
