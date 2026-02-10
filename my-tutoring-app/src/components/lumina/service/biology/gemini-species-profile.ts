import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

// Import the data type from the component (single source of truth)
import { SpeciesProfileData } from "../../primitives/biology-primitives/SpeciesProfile";

/**
 * Schema definition for Species Profile Data
 *
 * This schema defines the structure for comprehensive species information,
 * including physical characteristics, behavior, habitat, and taxonomy.
 */
const speciesProfileSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    commonName: {
      type: Type.STRING,
      description: "Common name of the species (e.g., 'Tyrannosaurus Rex')"
    },
    scientificName: {
      type: Type.STRING,
      description: "Scientific binomial name (e.g., 'Tyrannosaurus rex')"
    },
    nameMeaning: {
      type: Type.STRING,
      description: "Etymology and meaning of the name (e.g., 'Tyrant Lizard King')"
    },
    imagePrompt: {
      type: Type.STRING,
      description: "Detailed prompt for AI image generation showing the species in its natural habitat"
    },
    physicalStats: {
      type: Type.OBJECT,
      properties: {
        height: {
          type: Type.STRING,
          description: "Height measurement (e.g., '4-5 meters tall')"
        },
        length: {
          type: Type.STRING,
          description: "Length measurement (e.g., '12 meters long')"
        },
        weight: {
          type: Type.STRING,
          description: "Weight measurement (e.g., '7-9 tons')"
        },
        heightComparison: {
          type: Type.STRING,
          description: "Height compared to familiar objects (e.g., 'As tall as a giraffe')"
        },
        weightComparison: {
          type: Type.STRING,
          description: "Weight compared to familiar objects (e.g., 'Heavier than an elephant')"
        }
      }
    },
    diet: {
      type: Type.OBJECT,
      properties: {
        type: {
          type: Type.STRING,
          enum: ['carnivore', 'herbivore', 'omnivore', 'insectivore', 'piscivore'],
          description: "Primary dietary classification"
        },
        description: {
          type: Type.STRING,
          description: "Detailed description of diet and feeding behavior"
        },
        primaryFood: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "List of primary food sources"
        },
        huntingStrategy: {
          type: Type.STRING,
          description: "Hunting or foraging strategy (if applicable)"
        }
      },
      required: ["type", "description"]
    },
    habitat: {
      type: Type.OBJECT,
      properties: {
        period: {
          type: Type.STRING,
          description: "Geological period or time era (e.g., 'Late Cretaceous')"
        },
        timeRange: {
          type: Type.STRING,
          description: "Specific time range (e.g., '68-66 million years ago')"
        },
        location: {
          type: Type.STRING,
          description: "Geographic location (e.g., 'North America', 'Amazon Rainforest')"
        },
        environment: {
          type: Type.STRING,
          description: "Environmental conditions and habitat type (e.g., 'Forested river valleys')"
        }
      }
    },
    taxonomy: {
      type: Type.OBJECT,
      properties: {
        kingdom: { type: Type.STRING },
        phylum: { type: Type.STRING },
        class: { type: Type.STRING },
        order: { type: Type.STRING },
        family: { type: Type.STRING },
        genus: { type: Type.STRING },
        species: { type: Type.STRING },
        relatedSpecies: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "List of closely related species names"
        }
      }
    },
    biologicalNiche: {
      type: Type.STRING,
      description: "Role in the ecosystem and ecological significance"
    },
    interestingFacts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: "Catchy title for the fact"
          },
          description: {
            type: Type.STRING,
            description: "Detailed explanation of the interesting fact"
          }
        },
        required: ["title", "description"]
      },
      description: "Array of 3-5 fascinating facts about the species"
    },
    discoveryInfo: {
      type: Type.STRING,
      description: "Information about when and where the species was discovered or first described"
    },
    category: {
      type: Type.STRING,
      enum: ['dinosaur', 'mammal', 'reptile', 'bird', 'fish', 'invertebrate', 'plant'],
      description: "Broad category for styling and organization"
    }
  },
  required: ["commonName", "scientificName", "imagePrompt", "diet", "category"]
};

/**
 * Generate a species image using Gemini's image generation
 *
 * @param imagePrompt - The detailed prompt for generating the species image
 * @returns Base64 data URL of the generated image, or null if generation fails
 */
export const generateSpeciesImage = async (imagePrompt: string): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{
        role: 'user',
        parts: [{
          text: `Generate a scientifically accurate educational illustration: ${imagePrompt}.
Style: Photorealistic or high-quality scientific illustration, suitable for students.
Show the organism in its natural habitat with clear details. No text in the image.`
        }]
      }],
      config: {
        responseModalities: ['IMAGE', 'TEXT'],
        imageConfig: {
          aspectRatio: '16:9',
        },
      }
    });

    // Extract image from response
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData?.mimeType?.startsWith('image/')) {
          const base64Data = part.inlineData.data;
          return `data:${part.inlineData.mimeType};base64,${base64Data}`;
        }
      }
    }
    return null;
  } catch (error) {
    console.error('Error generating species image:', error);
    return null;
  }
};

/**
 * Generate comprehensive species profile data (Phase 1: Metadata only)
 *
 * This function creates detailed species information including:
 * - Physical characteristics with real-world comparisons
 * - Diet, behavior, and hunting strategies
 * - Habitat and geographic/temporal information
 * - Taxonomic classification and related species
 * - Fascinating facts and discovery history
 * - Educational context appropriate for the grade level
 * - Image prompt (but NOT the actual image - call generateSpeciesProfileWithImage for that)
 *
 * @param speciesName - Name of the species to profile
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional partial configuration to override generated values
 * @returns SpeciesProfileData with comprehensive species information (imageUrl will be null)
 */
export const generateSpeciesProfile = async (
  speciesName: string,
  gradeLevel: string = "K-5",
  config?: Partial<SpeciesProfileData>
): Promise<SpeciesProfileData> => {
  const educationalContext = `
Educational Context: This is for ${gradeLevel} students.
- Use age-appropriate vocabulary and explanations
- Include comparisons to familiar objects and animals
- Focus on fascinating facts that capture imagination
- Explain scientific concepts in accessible ways
- For younger students (K-2), use simpler language and more vivid descriptions
- For older students (3-5), include more scientific detail and taxonomic information
`;

  const generationPrompt = `Create a comprehensive species profile for: "${speciesName}".

REQUIREMENTS:
1. **Physical Stats**: Provide accurate measurements with real-world comparisons
   - For dinosaurs: height, length, weight with comparisons to modern animals or objects
   - For other species: relevant size metrics appropriate to the organism

2. **Diet & Behavior**: Detailed information about feeding and survival
   - Classification (carnivore, herbivore, etc.)
   - Specific food sources
   - Hunting/foraging strategies
   - Behavioral adaptations

3. **Habitat**: When and where this species lived/lives
   - Geological period (for extinct species) or current distribution
   - Geographic location
   - Environmental conditions and preferred habitat

4. **Taxonomy**: Complete classification
   - Kingdom through species
   - List 2-4 closely related species by name

5. **Biological Niche**: Ecological role and significance
   - Position in food chain
   - Ecosystem impact
   - Evolutionary significance

6. **Fascinating Facts**: 3-5 captivating facts
   - Unique adaptations or features
   - Record-breaking characteristics
   - Surprising discoveries or behaviors
   - Scientific significance

7. **Discovery**: Historical context
   - When and where first discovered/described
   - Notable fossil finds or scientific milestones (for extinct species)

8. **Image Prompt**: Create a vivid, detailed prompt for AI image generation
   - Show the species in its natural habitat
   - Highlight distinctive features
   - Include environmental context
   - Make it visually engaging for students
   - Be specific about pose, lighting, and setting

9. **Category**: Choose the most appropriate category for styling

${educationalContext}

EXAMPLE for "Velociraptor":
- Common Name: "Velociraptor"
- Scientific Name: "Velociraptor mongoliensis"
- Name Meaning: "Swift Seizer"
- Height: "0.5 meters tall at the hip"
- Length: "2 meters long"
- Weight: "15-20 kilograms"
- Height Comparison: "About as tall as a large dog"
- Weight Comparison: "About the weight of a turkey"
- Diet Type: "carnivore"
- Diet Description: "Small, agile predator that hunted in packs..."
- Primary Food: ["Small dinosaurs", "Lizards", "Mammals"]
- Hunting Strategy: "Pack hunter using speed and curved claws"
- Period: "Late Cretaceous"
- Time Range: "75-71 million years ago"
- Location: "Mongolia and China"
- Environment: "Arid sand dunes and desert scrublands"
- Biological Niche: "Small pack-hunting predator controlling prey populations"
- Interesting Facts: [
    { title: "Feathered Raptor", description: "Despite Jurassic Park, Velociraptor had feathers..." },
    { title: "Sickle Claw", description: "The famous curved claw on each foot was 6.5 cm long..." }
  ]
- Discovery Info: "First discovered in Mongolia in 1923 by paleontologist Peter Kaisen"
- Category: "dinosaur"
- Image Prompt: "A feathered Velociraptor mongoliensis running across Mongolian sand dunes during sunset, showing distinctive sickle claw and feathers, realistic paleontological accuracy"

Generate similarly detailed and accurate information for "${speciesName}".`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: speciesProfileSchema,
        systemInstruction: "You are an expert biologist, paleontologist, and science educator. You create engaging, scientifically accurate species profiles that inspire curiosity in students. Prioritize factual accuracy while making content accessible and exciting.",
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API");
    }

    const result = JSON.parse(text) as SpeciesProfileData;

    // Merge with any config overrides
    const finalData: SpeciesProfileData = {
      ...result,
      ...config,
      imageUrl: config?.imageUrl ?? null, // Always null in phase 1
    };

    console.log('🦕 Species Profile Metadata Generated:', {
      commonName: finalData.commonName,
      scientificName: finalData.scientificName,
      category: finalData.category,
      facts: finalData.interestingFacts?.length || 0,
      hasImagePrompt: !!finalData.imagePrompt
    });

    return finalData;

  } catch (error) {
    console.error("Error generating species profile:", error);
    throw error;
  }
};

/**
 * Generate comprehensive species profile data with image (Phase 2: Metadata + Image)
 *
 * This is the complete two-phase generation:
 * 1. First generates all metadata including imagePrompt
 * 2. Then generates the actual image using the imagePrompt
 *
 * @param speciesName - Name of the species to profile
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional partial configuration to override generated values
 * @returns SpeciesProfileData with comprehensive species information AND generated image
 */
export const generateSpeciesProfileWithImage = async (
  speciesName: string,
  gradeLevel: string = "K-5",
  config?: Partial<SpeciesProfileData>
): Promise<SpeciesProfileData> => {
  // Phase 1: Generate metadata (including imagePrompt)
  const profileData = await generateSpeciesProfile(speciesName, gradeLevel, config);

  // Phase 2: Generate the actual image using the imagePrompt
  let imageUrl: string | null = null;
  if (profileData.imagePrompt) {
    try {
      imageUrl = await generateSpeciesImage(profileData.imagePrompt);
    } catch (error) {
      console.error("Failed to generate species image:", error);
      // Continue without image - the component will handle the null case
    }
  }

  const finalData: SpeciesProfileData = {
    ...profileData,
    imageUrl,
  };

  console.log('🦕 Species Profile Generated (with image):', {
    commonName: finalData.commonName,
    scientificName: finalData.scientificName,
    category: finalData.category,
    hasImage: !!imageUrl
  });

  return finalData;
};

/**
 * Generate multiple species profiles for comparison or collection
 *
 * Useful for comparative biology lessons or creating species galleries
 *
 * @param topic - Topic or group (e.g., "Theropod dinosaurs", "Arctic mammals")
 * @param count - Number of species to generate (default: 3)
 * @param gradeLevel - Grade level for age-appropriate content
 * @returns Array of SpeciesProfileData
 */
export const generateSpeciesCollection = async (
  topic: string,
  count: number = 3,
  gradeLevel: string = "K-5"
): Promise<SpeciesProfileData[]> => {
  const collection: SpeciesProfileData[] = [];

  // First, ask AI to suggest diverse species for the topic
  const suggestionPrompt = `List ${count} diverse and representative species for the topic: "${topic}".
  Choose species that:
  - Showcase variety in size, behavior, or adaptations
  - Are scientifically significant or popular with students
  - Offer good comparison and contrast opportunities

  Return just the species names, one per line.`;

  try {
    const suggestionResponse = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: suggestionPrompt,
    });

    const speciesNames = suggestionResponse.text?.split('\n').filter(s => s.trim());

    if (!speciesNames || speciesNames.length === 0) {
      throw new Error("Failed to generate species suggestions");
    }

    // Generate profiles for each suggested species
    for (const speciesName of speciesNames.slice(0, count)) {
      const profile = await generateSpeciesProfile(speciesName.trim(), gradeLevel);
      collection.push(profile);
    }

    return collection;

  } catch (error) {
    console.error("Error generating species collection:", error);
    throw error;
  }
};
