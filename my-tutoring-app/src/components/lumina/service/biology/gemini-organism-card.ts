import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

// Import the data type from the component (single source of truth)
import { OrganismCardData } from "../../primitives/visual-primitives/biology/OrganismCard";

/**
 * Schema definition for Organism Card Data
 *
 * This schema defines the structure for foundational organism information,
 * designed to scale from K-2 (simple attributes) to 6-8 (full taxonomy).
 *
 * The primitive follows the PRD specification for "Organism Card" from the
 * biology primitives document - it's the foundational "unit" of biology content
 * used for comparison, classification, and reference.
 */
const organismCardSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    organism: {
      type: Type.OBJECT,
      properties: {
        commonName: {
          type: Type.STRING,
          description: "Common name of the organism (e.g., 'Honey Bee', 'Oak Tree', 'Lion')"
        },
        scientificName: {
          type: Type.STRING,
          description: "Scientific binomial name (e.g., 'Apis mellifera'), null for K-2"
        },
        imagePrompt: {
          type: Type.STRING,
          description: "Concise description for image generation or stock lookup"
        },
        kingdom: {
          type: Type.STRING,
          description: "Biological kingdom (Animalia, Plantae, Fungi, Protista, Bacteria, Archaea)"
        },
        classification: {
          type: Type.OBJECT,
          properties: {
            domain: { type: Type.STRING, description: "Domain (for grades 6-8)" },
            phylum: { type: Type.STRING, description: "Phylum (for grades 6-8)" },
            class: { type: Type.STRING, description: "Class (for grades 6-8)" },
            order: { type: Type.STRING, description: "Order (for grades 6-8)" },
            family: { type: Type.STRING, description: "Family (for grades 6-8)" }
          }
        }
      },
      required: ["commonName", "imagePrompt", "kingdom"]
    },
    attributes: {
      type: Type.OBJECT,
      properties: {
        habitat: {
          type: Type.STRING,
          description: "Where the organism lives (e.g., 'Forests and meadows', 'Ocean depths')"
        },
        diet: {
          type: Type.STRING,
          description: "What the organism eats (e.g., 'Nectar and pollen', 'Small fish and squid')"
        },
        locomotion: {
          type: Type.STRING,
          description: "How the organism moves (e.g., 'Flying', 'Walking on four legs', 'Rooted in place')"
        },
        lifespan: {
          type: Type.STRING,
          description: "How long the organism typically lives (e.g., '5-7 weeks', '80+ years')"
        },
        size: {
          type: Type.STRING,
          description: "Size of the organism with familiar comparison (e.g., '1.5 cm long, about as big as a paperclip')"
        },
        bodyTemperature: {
          type: Type.STRING,
          enum: ["warm-blooded", "cold-blooded", "N/A"],
          description: "Body temperature regulation (for grades 3-8, N/A for plants/fungi)"
        },
        reproduction: {
          type: Type.STRING,
          description: "How the organism reproduces (for grades 3-8, e.g., 'Lays eggs', 'Seeds in flowers')"
        },
        specialAdaptations: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "2-4 special adaptations that help the organism survive (for grades 3-8)"
        }
      },
      required: ["habitat", "diet", "locomotion", "lifespan", "size"]
    },
    funFact: {
      type: Type.STRING,
      description: "One fascinating, age-appropriate fact about the organism"
    },
    gradeBand: {
      type: Type.STRING,
      enum: ["K-2", "3-5", "6-8"],
      description: "Target grade band - determines complexity and visible fields"
    },
    visibleFields: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Array of field names that should be visible at this grade level"
    },
    themeColor: {
      type: Type.STRING,
      description: "Optional hex color for accent (e.g., '#10b981' for green theme)"
    }
  },
  required: ["organism", "attributes", "funFact", "gradeBand", "visibleFields"]
};

/**
 * Grade band field visibility configuration
 *
 * K-2: Simple labels and basic attributes (3-4 visible fields)
 * 3-5: Add habitat, diet, reproduction (5-7 visible fields)
 * 6-8: Add taxonomy, cellular characteristics, evolutionary context (all fields)
 */
const GRADE_BAND_FIELDS: Record<string, string[]> = {
  'K-2': [
    'habitat',
    'diet',
    'size',
    'locomotion',
    'funFact'
  ],
  '3-5': [
    'habitat',
    'diet',
    'size',
    'locomotion',
    'lifespan',
    'bodyTemperature',
    'reproduction',
    'specialAdaptations',
    'funFact'
  ],
  '6-8': [
    'habitat',
    'diet',
    'size',
    'locomotion',
    'lifespan',
    'bodyTemperature',
    'reproduction',
    'specialAdaptations',
    'classification',
    'funFact'
  ]
};

/**
 * Generate organism card data using Gemini AI
 *
 * This function creates foundational organism information cards that scale
 * from K-2 (simple attributes with icons) to 6-8 (full taxonomy and cellular info).
 *
 * The cards are designed as the "unit" of biology content - used for:
 * - Comparison (side-by-side organism cards)
 * - Classification (sorting organisms by attributes)
 * - Reference (quick lookup of organism facts)
 *
 * @param organismName - Name of the organism to profile
 * @param gradeBand - Grade level ('K-2', '3-5', or '6-8') determines complexity
 * @param config - Optional partial configuration to override generated values
 * @returns OrganismCardData with grade-appropriate organism information
 */
export const generateOrganismCard = async (
  organismName: string,
  gradeBand: 'K-2' | '3-5' | '6-8' = '3-5',
  config?: Partial<OrganismCardData>
): Promise<OrganismCardData> => {

  // Grade-specific vocabulary and complexity instructions
  const gradeContext = {
    'K-2': `
GRADE K-2 GUIDELINES:
- Use simple, concrete vocabulary (avoid scientific jargon)
- Keep sentences short and clear
- Use familiar comparisons for size (paperclip, soccer ball, car)
- Focus on observable characteristics students can see or imagine
- Make it exciting and engaging for young learners
- Scientific name can be null (too complex for K-2)
- Classification fields can be null (taxonomy too complex for K-2)
- NO body temperature, reproduction, or special adaptations (too advanced)
`,
    '3-5': `
GRADE 3-5 GUIDELINES:
- Introduce scientific vocabulary with explanations
- Include body temperature regulation (warm-blooded vs cold-blooded)
- Explain reproduction methods in age-appropriate terms
- Highlight 2-4 special adaptations that help survival
- Use comparisons to familiar objects and animals
- Include scientific name
- Make facts interesting and relatable to student experiences
- Classification is OPTIONAL (introduce domain/phylum for advanced 5th graders)
`,
    '6-8': `
GRADE 6-8 GUIDELINES:
- Use proper scientific terminology
- Include FULL taxonomic classification (domain, phylum, class, order, family)
- Explain cellular characteristics (prokaryotic/eukaryotic, unicellular/multicellular)
- Discuss evolutionary context and adaptations
- Include scientific name and etymology
- Connect to broader biological concepts (ecology, evolution, anatomy)
- Provide rigorous, academically appropriate content
- Classification is REQUIRED at this level
`
  };

  const visibleFields = GRADE_BAND_FIELDS[gradeBand];

  const generationPrompt = `Create an educational organism card for: "${organismName}".

TARGET GRADE BAND: ${gradeBand}

${gradeContext[gradeBand]}

REQUIRED INFORMATION:

1. **Organism Info**:
   - Common Name: Clear, accurate name students will recognize
   - Scientific Name: Binomial nomenclature (null for K-2, required for 3-5 and 6-8)
   - Kingdom: Animalia, Plantae, Fungi, Protista, Bacteria, or Archaea
   - Image Prompt: Concise visual description for image generation
   - Classification: Full taxonomy for 6-8 (domain through family), optional for 3-5, null for K-2

2. **Attributes** (all grade-appropriate):
   - Habitat: Where it lives (be specific but clear)
   - Diet: What it eats (use age-appropriate language)
   - Locomotion: How it moves (or "Rooted in place" for plants)
   - Lifespan: How long it lives (with clear time units)
   - Size: Actual measurement + familiar comparison (e.g., "15 cm long, about as long as a pencil")
   - Body Temperature: warm-blooded, cold-blooded, or N/A (grades 3+ only, N/A for plants/fungi)
   - Reproduction: How it reproduces (grades 3+ only, age-appropriate)
   - Special Adaptations: 2-4 survival adaptations (grades 3+ only)

3. **Fun Fact**:
   - One captivating, accurate fact appropriate for the grade level
   - Should inspire curiosity and wonder
   - Connect to student experiences when possible

4. **Visible Fields**:
   Return exactly this array: ${JSON.stringify(visibleFields)}

5. **Theme Color** (optional):
   - Suggest a hex color that matches the organism's appearance or kingdom

EXAMPLES:

**K-2 Example - Honey Bee**:
{
  "organism": {
    "commonName": "Honey Bee",
    "scientificName": null,
    "kingdom": "Animalia",
    "imagePrompt": "A yellow and black striped honey bee collecting nectar from a bright flower",
    "classification": null
  },
  "attributes": {
    "habitat": "Gardens, meadows, and forests",
    "diet": "Nectar and pollen from flowers",
    "locomotion": "Flying with four wings",
    "lifespan": "5-7 weeks for worker bees",
    "size": "1.5 cm long, about as big as a paperclip"
  },
  "funFact": "Honey bees dance to tell other bees where to find flowers!",
  "gradeBand": "K-2",
  "visibleFields": ["habitat", "diet", "size", "locomotion", "funFact"],
  "themeColor": "#fbbf24"
}

**3-5 Example - Bottlenose Dolphin**:
{
  "organism": {
    "commonName": "Bottlenose Dolphin",
    "scientificName": "Tursiops truncatus",
    "kingdom": "Animalia",
    "imagePrompt": "A gray bottlenose dolphin leaping out of blue ocean water",
    "classification": null
  },
  "attributes": {
    "habitat": "Warm ocean waters near coastlines",
    "diet": "Fish and squid",
    "locomotion": "Swimming with powerful tail flukes",
    "lifespan": "40-50 years in the wild",
    "size": "2-4 meters long, about as long as a car",
    "bodyTemperature": "warm-blooded",
    "reproduction": "Gives birth to live babies (calves)",
    "specialAdaptations": [
      "Uses echolocation to find food in dark water",
      "Can hold breath for 8-10 minutes",
      "Thick layer of blubber keeps warm in cold water",
      "Highly intelligent brain for problem-solving"
    ]
  },
  "funFact": "Dolphins have names for each other—they use unique whistles to call their friends!",
  "gradeBand": "3-5",
  "visibleFields": ["habitat", "diet", "size", "locomotion", "lifespan", "bodyTemperature", "reproduction", "specialAdaptations", "funFact"],
  "themeColor": "#3b82f6"
}

**6-8 Example - Giant Sequoia**:
{
  "organism": {
    "commonName": "Giant Sequoia",
    "scientificName": "Sequoiadendron giganteum",
    "kingdom": "Plantae",
    "imagePrompt": "A massive giant sequoia tree towering over a forest with thick reddish-brown bark",
    "classification": {
      "domain": "Eukarya",
      "phylum": "Tracheophyta",
      "class": "Pinopsida",
      "order": "Pinales",
      "family": "Cupressaceae"
    }
  },
  "attributes": {
    "habitat": "Mountain slopes of Sierra Nevada, California (1,400-2,150 meters elevation)",
    "diet": "Photosynthesis (produces food from sunlight, water, and CO2)",
    "locomotion": "Rooted in place (sessile)",
    "lifespan": "2,000-3,000 years",
    "size": "60-85 meters tall with trunk diameter of 6-8 meters—taller than the Statue of Liberty",
    "bodyTemperature": "N/A",
    "reproduction": "Seeds produced in small cones; requires fire to release seeds and clear ground",
    "specialAdaptations": [
      "Thick, fire-resistant bark up to 60 cm thick protects from wildfires",
      "Shallow but extensive root system (no taproot) provides stability",
      "Tannin-rich wood resists decay and insect damage",
      "Requires periodic fire to release seeds and regenerate"
    ]
  },
  "funFact": "Giant sequoias are the largest living organisms on Earth by volume—the largest tree (General Sherman) weighs about 1,385 tons, as much as 10 blue whales!",
  "gradeBand": "6-8",
  "visibleFields": ["habitat", "diet", "size", "locomotion", "lifespan", "bodyTemperature", "reproduction", "specialAdaptations", "classification", "funFact"],
  "themeColor": "#84cc16"
}

Now generate an organism card for "${organismName}" at grade level ${gradeBand}.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: organismCardSchema,
        systemInstruction: `You are an expert biology educator specializing in K-8 life sciences. You create engaging, scientifically accurate organism cards that scale appropriately by grade level. You understand developmental psychology and choose vocabulary, complexity, and content depth appropriate for each age group. You make biology exciting and accessible while maintaining scientific rigor.`,
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API");
    }

    const result = JSON.parse(text) as OrganismCardData;

    // Merge with any config overrides
    const finalData: OrganismCardData = {
      ...result,
      ...config,
    };

    console.log('🦋 Organism Card Generated:', {
      commonName: finalData.organism.commonName,
      kingdom: finalData.organism.kingdom,
      gradeBand: finalData.gradeBand,
      visibleFields: finalData.visibleFields.length,
      hasClassification: !!finalData.organism.classification
    });

    return finalData;

  } catch (error) {
    console.error("Error generating organism card:", error);
    throw error;
  }
};

/**
 * Generate multiple organism cards for comparison activities
 *
 * Useful for:
 * - Compare/contrast lessons (herbivore vs carnivore, warm-blooded vs cold-blooded)
 * - Classification activities (sorting into kingdoms or groups)
 * - Ecosystem studies (organisms from the same habitat)
 * - Adaptation lessons (different adaptations to same environment)
 *
 * @param topic - Topic or theme (e.g., "Arctic animals", "Pollinators", "Desert adaptations")
 * @param count - Number of organism cards to generate (2-6 recommended)
 * @param gradeBand - Grade level for all cards
 * @returns Array of OrganismCardData
 */
export const generateOrganismCardSet = async (
  topic: string,
  count: number = 3,
  gradeBand: 'K-2' | '3-5' | '6-8' = '3-5'
): Promise<OrganismCardData[]> => {
  const cards: OrganismCardData[] = [];

  // Ask AI to suggest diverse organisms for the topic
  const suggestionPrompt = `List ${count} diverse organisms for the topic: "${topic}".

Choose organisms that:
- Show variety in size, behavior, or adaptations
- Are age-appropriate for grade ${gradeBand}
- Offer good comparison and contrast opportunities
- Are scientifically interesting and engaging for students

Return ONLY the organism names, one per line, nothing else.`;

  try {
    const suggestionResponse = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: suggestionPrompt,
    });

    const organismNames = suggestionResponse.text
      ?.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && !line.match(/^\d+\./))
      .slice(0, count);

    if (!organismNames || organismNames.length === 0) {
      throw new Error("Failed to generate organism suggestions");
    }

    // Generate cards for each suggested organism
    for (const organismName of organismNames) {
      const card = await generateOrganismCard(organismName, gradeBand);
      cards.push(card);
    }

    console.log(`🦋 Generated ${cards.length} organism cards for topic: "${topic}"`);
    return cards;

  } catch (error) {
    console.error("Error generating organism card set:", error);
    throw error;
  }
};
