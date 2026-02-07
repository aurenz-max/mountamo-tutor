import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

// Import the data type from the component (single source of truth)
import { BodySystemExplorerData } from "../../primitives/visual-primitives/biology/BodySystemExplorer";

/**
 * Schema definition for Body System Explorer Data
 *
 * This schema defines the structure for interactive layered anatomy diagrams
 * where students can toggle system layers, click organs for details, and trace
 * pathways (e.g., path of blood through heart, path of food through digestive system).
 *
 * The primitive follows the PRD specification for "Body System Explorer" from the
 * biology primitives document - it's the primary anatomy teaching tool.
 */
const bodySystemExplorerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    system: {
      type: Type.STRING,
      enum: ["digestive", "circulatory", "respiratory", "nervous", "skeletal", "muscular", "immune", "endocrine", "reproductive", "urinary"],
      description: "The body system being explored"
    },
    title: {
      type: Type.STRING,
      description: "Title for this explorer (e.g., 'The Human Digestive System')"
    },
    overview: {
      type: Type.STRING,
      description: "Brief overview of what this system does and why it's important"
    },
    organs: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique identifier for this organ (e.g., 'stomach', 'heart', 'lungs')"
          },
          name: {
            type: Type.STRING,
            description: "Display name of the organ"
          },
          svgRegion: {
            type: Type.STRING,
            description: "CSS selector or coordinate identifier for clickable region in SVG"
          },
          function: {
            type: Type.STRING,
            description: "What this organ does in the system (grade-appropriate language)"
          },
          funFact: {
            type: Type.STRING,
            description: "Interesting, age-appropriate fact about this organ (can be null)"
          },
          connectedTo: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Array of organ IDs this organ connects to"
          },
          layerGroup: {
            type: Type.STRING,
            description: "Which layer this organ belongs to (matches layer.id)"
          }
        },
        required: ["id", "name", "svgRegion", "function", "connectedTo", "layerGroup"]
      }
    },
    pathways: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique identifier for this pathway"
          },
          name: {
            type: Type.STRING,
            description: "Name of the pathway (e.g., 'Path of blood through the heart')"
          },
          description: {
            type: Type.STRING,
            description: "Brief description of what this pathway shows"
          },
          steps: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                organId: {
                  type: Type.STRING,
                  description: "ID of the organ at this step"
                },
                action: {
                  type: Type.STRING,
                  description: "What happens at this organ in the pathway"
                },
                order: {
                  type: Type.INTEGER,
                  description: "Order of this step in the pathway (0-indexed)"
                }
              },
              required: ["organId", "action", "order"]
            }
          }
        },
        required: ["id", "name", "description", "steps"]
      }
    },
    layers: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique identifier for this layer"
          },
          label: {
            type: Type.STRING,
            description: "Display label for the layer toggle"
          },
          defaultVisible: {
            type: Type.BOOLEAN,
            description: "Whether this layer is visible by default"
          }
        },
        required: ["id", "label", "defaultVisible"]
      }
    },
    gradeBand: {
      type: Type.STRING,
      enum: ["2-4", "5-6", "7-8"],
      description: "Target grade band - determines complexity and vocabulary"
    }
  },
  required: ["system", "title", "overview", "organs", "pathways", "layers", "gradeBand"]
};

/**
 * Generate body system explorer data using Gemini AI
 *
 * This function creates interactive anatomy content where students can:
 * - Toggle layers to see different systems
 * - Click on organs to learn their function
 * - Trace pathways to understand processes (blood flow, digestion, etc.)
 *
 * The generator creates grade-appropriate content that scales from elementary
 * (simple vocabulary, fewer organs) to middle school (detailed anatomy, complex pathways).
 *
 * @param system - The body system to explore ('digestive', 'circulatory', etc.)
 * @param gradeBand - Grade level ('2-4', '5-6', or '7-8') determines complexity
 * @param config - Optional partial configuration to override generated values
 * @returns BodySystemExplorerData with interactive anatomy content
 */
export const generateBodySystemExplorer = async (
  system: string,
  gradeBand: '2-4' | '5-6' | '7-8' = '5-6',
  config?: Partial<BodySystemExplorerData>
): Promise<BodySystemExplorerData> => {

  // Grade-specific vocabulary and complexity instructions
  const gradeContext = {
    '2-4': `
GRADE 2-4 GUIDELINES:
- Use simple, concrete vocabulary (avoid medical jargon)
- Focus on 4-6 main organs students can easily understand
- Keep explanations short and clear (1-2 sentences per organ)
- Use familiar analogies (stomach is like a blender, heart is like a pump)
- Make pathways simple with 3-5 steps maximum
- Fun facts should be exciting and relatable
- Focus on what organs DO, not how they're structured
`,
    '5-6': `
GRADE 5-6 GUIDELINES:
- Introduce scientific terminology with explanations
- Include 6-8 major organs with some supporting structures
- Provide clear explanations of function (2-3 sentences)
- Explain how organs work together as a system
- Pathways can have 5-7 steps with more detail
- Fun facts should be scientifically interesting
- Begin discussing structure-function relationships
- Use proper anatomical terms but define them
`,
    '7-8': `
GRADE 7-8 GUIDELINES:
- Use proper medical and anatomical terminology
- Include 8-10+ organs with detailed supporting structures
- Provide comprehensive explanations with scientific detail
- Explain cellular and molecular processes where relevant
- Pathways can be complex with 7-10+ detailed steps
- Fun facts should include cutting-edge science or medical applications
- Discuss structure-function relationships in depth
- Connect to health, disease, and medical science
- Use precise scientific language
`
  };

  const generationPrompt = `Create an interactive body system explorer for the ${system} system.

TARGET GRADE BAND: ${gradeBand}

${gradeContext[gradeBand]}

CRITICAL ARCHITECTURE NOTES:
1. **SVG Region Identifiers**: Use simple, semantic IDs for svgRegion (e.g., 'stomach', 'small-intestine', 'liver'). These will map to actual SVG paths in the renderer. Keep them kebab-case and descriptive.

2. **Layer Organization**: Organize organs into logical layers students can toggle:
   - For digestive: 'main-organs', 'supporting-organs', 'accessory-organs'
   - For circulatory: 'heart', 'arteries', 'veins', 'capillaries'
   - For respiratory: 'upper-tract', 'lower-tract', 'supporting-structures'
   - Choose layers that make pedagogical sense for exploration

3. **Pathway Design**: Create 1-3 pathways that show important processes:
   - Linear processes: food through digestive system, air through respiratory system
   - Circular processes: blood circulation, nerve signal loops
   - Each step should explain WHAT HAPPENS at that organ, not just name it

EXAMPLE OUTPUT for Digestive System (Grade 5-6):

{
  "system": "digestive",
  "title": "The Human Digestive System",
  "overview": "The digestive system breaks down food into nutrients your body can use for energy, growth, and repair. It's like a 30-foot-long processing factory that turns your lunch into fuel for your cells!",
  "organs": [
    {
      "id": "mouth",
      "name": "Mouth",
      "svgRegion": "mouth",
      "function": "Chewing breaks food into smaller pieces, and saliva begins breaking down starches. Your teeth are like little grinding machines!",
      "funFact": "Your mouth produces about 1-2 liters of saliva every day—that's enough to fill a large water bottle!",
      "connectedTo": ["esophagus"],
      "layerGroup": "main-organs"
    },
    {
      "id": "esophagus",
      "name": "Esophagus",
      "svgRegion": "esophagus",
      "function": "A muscular tube that squeezes food down to your stomach using wave-like contractions called peristalsis. You can even swallow upside down!",
      "funFact": "The esophagus is about 10 inches long and uses muscle contractions so powerful you could eat standing on your head!",
      "connectedTo": ["mouth", "stomach"],
      "layerGroup": "main-organs"
    },
    {
      "id": "stomach",
      "name": "Stomach",
      "svgRegion": "stomach",
      "function": "A stretchy, muscular bag that churns food and mixes it with powerful acids and enzymes. It's like a washing machine for your food!",
      "funFact": "Your stomach produces new mucus lining every two weeks to protect itself from its own acid, which is strong enough to dissolve metal!",
      "connectedTo": ["esophagus", "small-intestine"],
      "layerGroup": "main-organs"
    },
    {
      "id": "small-intestine",
      "name": "Small Intestine",
      "svgRegion": "small-intestine",
      "function": "A 20-foot-long tube where most nutrient absorption happens. Tiny finger-like villi increase surface area to absorb nutrients into the bloodstream.",
      "funFact": "If you stretched out all the villi in your small intestine, they'd cover a tennis court!",
      "connectedTo": ["stomach", "large-intestine", "liver", "pancreas"],
      "layerGroup": "main-organs"
    },
    {
      "id": "liver",
      "name": "Liver",
      "svgRegion": "liver",
      "function": "Produces bile to help digest fats, filters toxins from blood, and stores nutrients. It's your body's chemical processing plant!",
      "funFact": "The liver performs over 500 different functions and is the only organ that can regenerate itself—if you lose part of it, it can grow back!",
      "connectedTo": ["small-intestine"],
      "layerGroup": "supporting-organs"
    },
    {
      "id": "pancreas",
      "name": "Pancreas",
      "svgRegion": "pancreas",
      "function": "Produces enzymes to break down proteins, fats, and carbohydrates, plus hormones like insulin to control blood sugar.",
      "funFact": "Your pancreas produces about 1 liter of digestive juice each day, containing powerful enzymes that would digest the pancreas itself if not for protective mechanisms!",
      "connectedTo": ["small-intestine"],
      "layerGroup": "supporting-organs"
    },
    {
      "id": "large-intestine",
      "name": "Large Intestine",
      "svgRegion": "large-intestine",
      "function": "Absorbs water and minerals from food waste and forms solid stool. Beneficial bacteria here help digest remaining food and make vitamins.",
      "funFact": "Your large intestine is home to trillions of helpful bacteria—there are more bacterial cells in your gut than human cells in your entire body!",
      "connectedTo": ["small-intestine"],
      "layerGroup": "main-organs"
    }
  ],
  "pathways": [
    {
      "id": "food-journey",
      "name": "Journey of a Meal",
      "description": "Follow a bite of food as it travels through your digestive system and gets broken down into nutrients.",
      "steps": [
        {
          "organId": "mouth",
          "action": "Food is chewed into smaller pieces and mixed with saliva, which begins breaking down starches into sugars.",
          "order": 0
        },
        {
          "organId": "esophagus",
          "action": "Muscular contractions (peristalsis) squeeze the chewed food down toward the stomach—this takes about 8 seconds.",
          "order": 1
        },
        {
          "organId": "stomach",
          "action": "Powerful acid and churning muscles break the food into a soupy mixture called chyme. This takes 2-4 hours.",
          "order": 2
        },
        {
          "organId": "small-intestine",
          "action": "Bile from the liver and enzymes from the pancreas break down fats, proteins, and carbs. Nutrients are absorbed through the intestinal walls into the bloodstream. This takes 3-5 hours.",
          "order": 3
        },
        {
          "organId": "large-intestine",
          "action": "Water is absorbed and waste is formed into stool. Bacteria break down remaining food and produce vitamins. This can take 12-48 hours.",
          "order": 4
        }
      ]
    }
  ],
  "layers": [
    {
      "id": "main-organs",
      "label": "Main Digestive Organs",
      "defaultVisible": true
    },
    {
      "id": "supporting-organs",
      "label": "Supporting Organs",
      "defaultVisible": true
    }
  ],
  "gradeBand": "5-6"
}

KEY REQUIREMENTS:
1. Create ${gradeBand === '2-4' ? '4-6' : gradeBand === '5-6' ? '6-8' : '8-10'} organs appropriate for the grade level
2. Design 1-3 pathways that show important processes in the system
3. Organize organs into 2-4 logical layers students can toggle
4. Use grade-appropriate vocabulary and complexity
5. Include fun facts that will engage and excite students
6. Make connections (connectedTo) accurate for the system
7. Ensure pathway steps are clear and educational

Now generate a body system explorer for the "${system}" system at grade level ${gradeBand}.`;

  try {
    console.log('🫁 Generating Body System Explorer for system:', system, 'gradeBand:', gradeBand);

    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: bodySystemExplorerSchema,
        systemInstruction: `You are an expert anatomy and physiology educator specializing in K-8 life sciences. You create engaging, scientifically accurate interactive anatomy content that scales appropriately by grade level. You understand how to make complex body systems accessible and exciting for students while maintaining scientific rigor. You design learning experiences that help students understand not just what organs are, but how they work together as systems.`,
      }
    });

    console.log('🫁 Raw Gemini response received');

    const text = response.text;
    if (!text) {
      console.error('🫁 ERROR: No text in response:', response);
      throw new Error("No data returned from Gemini API");
    }

    console.log('🫁 Response text length:', text.length);
    console.log('🫁 Response text preview:', text.substring(0, 200));

    const result = JSON.parse(text) as BodySystemExplorerData;

    // Merge with any config overrides
    const finalData: BodySystemExplorerData = {
      ...result,
      ...config,
    };

    console.log('🫁 Body System Explorer Generated:', {
      system: finalData.system,
      organCount: finalData.organs.length,
      pathwayCount: finalData.pathways.length,
      layerCount: finalData.layers.length,
      gradeBand: finalData.gradeBand
    });

    return finalData;

  } catch (error) {
    console.error("🫁 ERROR: Failed to generate body system explorer:", error);
    console.error("🫁 ERROR Details:", {
      system,
      gradeBand,
      config,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
};
