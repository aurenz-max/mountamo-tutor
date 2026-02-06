import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

// Import the data type from the component (single source of truth)
import { ClassificationSorterData } from "../../primitives/visual-primitives/biology/ClassificationSorter";

/**
 * Schema definition for Classification Sorter Data
 *
 * This schema defines the structure for interactive drag-and-drop classification
 * activities. Students categorize organisms or characteristics into labeled bins.
 * The core "is it a ___?" primitive for biology education.
 *
 * Handles:
 * - Binary sorts (vertebrate/invertebrate, producer/consumer)
 * - Multi-category sorts (mammal/reptile/amphibian/bird/fish)
 * - Property-based sorts (has bones/no bones, makes own food/eats food)
 * - Hierarchical sorts (Kingdom → Phylum → Class) for grades 6-8
 */
const classificationSorterSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Clear, engaging title for the sorting activity"
    },
    instructions: {
      type: Type.STRING,
      description: "Brief instructions for students (1-2 sentences)"
    },
    categories: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique identifier for the category (e.g., 'vertebrate', 'mammal')"
          },
          label: {
            type: Type.STRING,
            description: "Display name for the category (e.g., 'Vertebrates', 'Mammals')"
          },
          description: {
            type: Type.STRING,
            description: "Brief explanation shown on hover/tap (1 sentence)"
          },
          parentId: {
            type: Type.STRING,
            description: "Parent category ID for hierarchical sorting (null for top-level categories)"
          }
        },
        required: ["id", "label", "description"]
      },
      description: "2-6 categories for sorting (2 for binary, 3-5 for multi-category, hierarchical for grades 6-8)"
    },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique identifier for the item"
          },
          label: {
            type: Type.STRING,
            description: "Display name (organism name or characteristic)"
          },
          imagePrompt: {
            type: Type.STRING,
            description: "Optional visual description (null if text-only)"
          },
          hint: {
            type: Type.STRING,
            description: "Helpful hint shown when item is placed incorrectly"
          },
          correctCategoryId: {
            type: Type.STRING,
            description: "ID of the correct category for this item"
          },
          distractorReasoning: {
            type: Type.STRING,
            description: "Why a student might incorrectly categorize this (helps design better hints)"
          }
        },
        required: ["id", "label", "hint", "correctCategoryId", "distractorReasoning"]
      },
      description: "6-12 items to sort (6-8 for K-2, 8-10 for 3-5, 10-12 for 6-8)"
    },
    sortingRule: {
      type: Type.STRING,
      description: "The principle being applied (e.g., 'Sort by backbone presence', 'Sort by number of legs')"
    },
    gradeBand: {
      type: Type.STRING,
      enum: ["K-2", "3-5", "6-8"],
      description: "Target grade band - determines complexity"
    },
    allowPartialCredit: {
      type: Type.BOOLEAN,
      description: "Whether to allow partial credit (true for formative activities, false for summative)"
    }
  },
  required: ["title", "instructions", "categories", "items", "sortingRule", "gradeBand", "allowPartialCredit"]
};

/**
 * Generate classification sorter data using Gemini AI
 *
 * This function creates interactive drag-and-drop classification activities
 * for biology education. The primitive scales from simple binary sorts (K-2)
 * to complex hierarchical classification (6-8).
 *
 * Use cases:
 * - Classification activities (sorting organisms into taxonomic groups)
 * - Characteristic sorting (warm-blooded vs cold-blooded)
 * - Habitat sorting (aquatic vs terrestrial)
 * - Diet sorting (herbivore vs carnivore vs omnivore)
 * - Life cycle sorting (complete vs incomplete metamorphosis)
 *
 * @param topic - The classification topic (e.g., "vertebrates vs invertebrates", "animal classes")
 * @param gradeBand - Grade level ('K-2', '3-5', or '6-8') determines complexity
 * @param config - Optional partial configuration to override generated values
 * @returns ClassificationSorterData with categorization activity
 */
export const generateClassificationSorter = async (
  topic: string,
  gradeBand: 'K-2' | '3-5' | '6-8' = '3-5',
  config?: Partial<ClassificationSorterData>
): Promise<ClassificationSorterData> => {

  // Grade-specific complexity and content guidance
  const gradeContext = {
    'K-2': `
GRADE K-2 GUIDELINES:
- Use BINARY sorting (2 categories only): yes/no, has/doesn't have, is/isn't
- Simple, observable characteristics that students can see or imagine
- 6-8 items total (manageable for young learners)
- Very simple vocabulary (no scientific terms)
- Clear, concrete categories (e.g., "Has Wings" vs "No Wings")
- Hints should be encouraging and simple
- Include 1-2 "tricky" items that require careful thinking
- Examples: animals with/without legs, plants with/without flowers, big/small animals
`,
    '3-5': `
GRADE 3-5 GUIDELINES:
- Use 3-5 categories (multi-category sorting)
- Introduce scientific vocabulary with clear explanations
- 8-10 items total
- Mix obvious and challenging items
- Categories can be taxonomic (mammal/reptile/amphibian/bird/fish) or characteristic-based
- Hints should guide thinking without giving away the answer
- Include 2-3 "boundary case" items (e.g., platypus, penguin, bat)
- Examples: animal classes, plant types, habitats, food chains, adaptations
`,
    '6-8': `
GRADE 6-8 GUIDELINES:
- Can use hierarchical categories (Kingdom → Phylum → Class) if topic warrants
- Use proper scientific terminology and classification systems
- 10-12 items total with multiple challenging cases
- Include edge cases and exceptions (e.g., whales are mammals, not fish)
- Categories should align with formal biological classification
- Hints should reference specific characteristics or criteria
- Challenge misconceptions (e.g., dolphins are mammals, not fish)
- Examples: taxonomic classification, cellular characteristics, ecological roles, evolutionary relationships
`
  };

  const itemCountGuidance = {
    'K-2': '6-8 items',
    '3-5': '8-10 items',
    '6-8': '10-12 items'
  };

  const categoryCountGuidance = {
    'K-2': '2 categories (binary sort)',
    '3-5': '3-5 categories',
    '6-8': '3-6 categories (can be hierarchical)'
  };

  const generationPrompt = `Create an interactive classification sorting activity for: "${topic}".

TARGET GRADE BAND: ${gradeBand}

${gradeContext[gradeBand]}

ACTIVITY REQUIREMENTS:

1. **Title**: Clear, engaging title (e.g., "Sort Animals by What They Eat", "Classify Organisms by Kingdom")

2. **Instructions**: Brief, clear instructions (1-2 sentences)
   - Example: "Drag each animal to the correct group based on whether it has a backbone."

3. **Categories** (${categoryCountGuidance[gradeBand]}):
   - Clear, distinct categories
   - Each category needs a brief definition (shown on hover)
   - For K-2: Use simple language (e.g., "Has Bones Inside" instead of "Vertebrate")
   - For 3-5: Introduce scientific terms with explanations
   - For 6-8: Use proper scientific terminology
   - IMPORTANT: Include parentId field for hierarchical sorting (null for top-level)

4. **Items** (${itemCountGuidance[gradeBand]}):
   - Mix of organisms or characteristics appropriate to the topic
   - Include both obvious and challenging items
   - MUST include 1-2 "boundary cases" that require deeper thinking
   - Each item needs:
     * Clear label (organism or characteristic name)
     * Helpful hint for when placed incorrectly
     * Distractor reasoning (why student might place it wrong)
     * Optional imagePrompt (null if text-only is sufficient)

5. **Sorting Rule**: State the classification principle clearly
   - Examples: "Sort by backbone presence", "Sort by number of legs", "Sort by taxonomic class"

6. **Allow Partial Credit**:
   - true for formative/learning activities
   - false for summative assessments

7. **Boundary Cases** (IMPORTANT):
   - K-2: 1 challenging item (e.g., penguin in "Can Fly?" sort)
   - 3-5: 2-3 items with interesting edge cases (e.g., platypus, bat, dolphin)
   - 6-8: 3-4 items that challenge misconceptions or require detailed knowledge

EXAMPLE for 3-5: "Vertebrate Animals by Class"
{
  "title": "Sort Vertebrate Animals by Class",
  "instructions": "Drag each animal to its correct class. Remember: classes are groups of animals with similar characteristics.",
  "categories": [
    {
      "id": "mammals",
      "label": "Mammals",
      "description": "Warm-blooded animals with hair that feed milk to their young",
      "parentId": null
    },
    {
      "id": "birds",
      "label": "Birds",
      "description": "Warm-blooded animals with feathers and wings that lay eggs",
      "parentId": null
    },
    {
      "id": "reptiles",
      "label": "Reptiles",
      "description": "Cold-blooded animals with dry, scaly skin that lay eggs on land",
      "parentId": null
    },
    {
      "id": "amphibians",
      "label": "Amphibians",
      "description": "Cold-blooded animals with moist skin that live in water and on land",
      "parentId": null
    },
    {
      "id": "fish",
      "label": "Fish",
      "description": "Cold-blooded animals with gills and fins that live in water",
      "parentId": null
    }
  ],
  "items": [
    {
      "id": "item1",
      "label": "Lion",
      "imagePrompt": null,
      "hint": "Think about whether it has hair and feeds milk to its babies.",
      "correctCategoryId": "mammals",
      "distractorReasoning": "Clear mammal example, unlikely to be confused"
    },
    {
      "id": "item2",
      "label": "Eagle",
      "imagePrompt": null,
      "hint": "Look at its feathers and wings!",
      "correctCategoryId": "birds",
      "distractorReasoning": "Clear bird example"
    },
    {
      "id": "item3",
      "label": "Dolphin",
      "imagePrompt": null,
      "hint": "Even though it lives in water, does it have gills or lungs? Does it have hair or scales?",
      "correctCategoryId": "mammals",
      "distractorReasoning": "Students often think dolphins are fish because they live in water"
    },
    {
      "id": "item4",
      "label": "Penguin",
      "imagePrompt": null,
      "hint": "Can it fly? Look at whether it has feathers!",
      "correctCategoryId": "birds",
      "distractorReasoning": "Students might be confused because penguins can't fly and swim like fish"
    },
    {
      "id": "item5",
      "label": "Frog",
      "imagePrompt": null,
      "hint": "Where does it live as a baby versus as an adult?",
      "correctCategoryId": "amphibians",
      "distractorReasoning": "Might be confused with reptiles if student doesn't know about metamorphosis"
    },
    {
      "id": "item6",
      "label": "Snake",
      "imagePrompt": null,
      "hint": "Does it have dry, scaly skin? Does it lay eggs on land?",
      "correctCategoryId": "reptiles",
      "distractorReasoning": "Clear reptile example"
    },
    {
      "id": "item7",
      "label": "Shark",
      "imagePrompt": null,
      "hint": "Does it have gills and fins? Does it live entirely in water?",
      "correctCategoryId": "fish",
      "distractorReasoning": "Might be confused with mammals because of its size and predatory nature"
    },
    {
      "id": "item8",
      "label": "Bat",
      "imagePrompt": null,
      "hint": "Does it have wings like a bird, or hair like other mammals? Does it feed milk to its babies?",
      "correctCategoryId": "mammals",
      "distractorReasoning": "Students often think bats are birds because they fly"
    }
  ],
  "sortingRule": "Sort by vertebrate class (mammals, birds, reptiles, amphibians, fish)",
  "gradeBand": "3-5",
  "allowPartialCredit": true
}

Now generate a classification sorter for "${topic}" at grade level ${gradeBand}.

CRITICAL REMINDERS:
- Include "boundary case" items that make students think deeply
- Hints should guide without giving away the answer
- For K-2, use only 2 categories (binary sort)
- For 3-5, use 3-5 categories
- For 6-8, can use hierarchical categories with parentId
- Ensure categories and items match the grade-appropriate vocabulary level`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: classificationSorterSchema,
        systemInstruction: `You are an expert biology educator specializing in K-8 life sciences classification activities. You understand how students develop classification skills and common misconceptions at each grade level. You design engaging sorting activities that challenge thinking while building conceptual understanding. You know how to include "boundary case" items (platypus, penguin, dolphin, bat) that make students think deeply about classification criteria.`,
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API");
    }

    const result = JSON.parse(text) as ClassificationSorterData;

    // Merge with any config overrides
    const finalData: ClassificationSorterData = {
      ...result,
      ...config,
    };

    console.log('🔍 Classification Sorter Generated:', {
      title: finalData.title,
      categories: finalData.categories.length,
      items: finalData.items.length,
      gradeBand: finalData.gradeBand,
      sortingRule: finalData.sortingRule
    });

    return finalData;

  } catch (error) {
    console.error("Error generating classification sorter:", error);
    throw error;
  }
};
