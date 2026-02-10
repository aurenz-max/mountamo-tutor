import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

// Import the data type from the component (single source of truth)
import { AdaptationInvestigatorData } from "../../primitives/visual-primitives/biology/AdaptationInvestigator";

/**
 * Schema definition for Adaptation Investigator Data
 *
 * This schema defines the structure for teaching structure-function-environment
 * relationships in biology. Students explore why organisms have specific traits,
 * connecting adaptations to environmental pressures, and predicting consequences
 * of environmental change in "What If?" scenarios.
 *
 * Grade Bands: 2-4, 5-6, 7-8
 */
const adaptationInvestigatorSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    organism: {
      type: Type.STRING,
      description: "Name of the organism (e.g., 'Arctic Fox', 'Cactus', 'Giraffe')"
    },
    adaptation: {
      type: Type.OBJECT,
      properties: {
        trait: {
          type: Type.STRING,
          description: "Name of the adaptation trait (e.g., 'White Winter Fur', 'Thick Waxy Skin', 'Long Neck')"
        },
        type: {
          type: Type.STRING,
          enum: ["structural", "behavioral", "physiological"],
          description: "Type of adaptation: structural (body part), behavioral (actions), or physiological (body process)"
        },
        description: {
          type: Type.STRING,
          description: "2-3 sentence description of the trait that is grade-appropriate"
        },
        imagePrompt: {
          type: Type.STRING,
          description: "Detailed image prompt showing the organism with its adaptation highlighted (for AI image generation)"
        }
      },
      required: ["trait", "type", "description", "imagePrompt"]
    },
    environment: {
      type: Type.OBJECT,
      properties: {
        habitat: {
          type: Type.STRING,
          description: "Name of the habitat (e.g., 'Arctic Tundra', 'Sonoran Desert', 'African Savanna')"
        },
        pressures: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "2-4 environmental pressures the organism faces (e.g., 'Extreme cold temperatures', 'Predators with keen eyesight')"
        },
        description: {
          type: Type.STRING,
          description: "2-3 sentence description of the environment and its challenges"
        }
      },
      required: ["habitat", "pressures", "description"]
    },
    connection: {
      type: Type.OBJECT,
      properties: {
        explanation: {
          type: Type.STRING,
          description: "2-3 sentence explanation of how the trait addresses the environmental pressures"
        },
        evidencePoints: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "2-4 specific evidence points supporting how the trait helps (e.g., 'White fur reflects light, making the fox nearly invisible in snow')"
        }
      },
      required: ["explanation", "evidencePoints"]
    },
    whatIfScenarios: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          environmentChange: {
            type: Type.STRING,
            description: "A hypothetical environmental change (e.g., 'The Arctic warms and snow melts permanently')"
          },
          question: {
            type: Type.STRING,
            description: "Question asking whether the adaptation is still useful (e.g., 'Would white fur still help the arctic fox?')"
          },
          expectedReasoning: {
            type: Type.STRING,
            description: "2-3 sentence explanation of the correct reasoning"
          },
          adaptationStillUseful: {
            type: Type.BOOLEAN,
            description: "Whether the adaptation would still be useful in the changed environment"
          }
        },
        required: ["environmentChange", "question", "expectedReasoning", "adaptationStillUseful"]
      },
      description: "2-3 'What If?' scenarios for higher grades (5-8). Include a mix of true and false answers."
    },
    misconception: {
      type: Type.OBJECT,
      properties: {
        commonBelief: {
          type: Type.STRING,
          description: "A common misconception about this adaptation (e.g., 'Giraffes stretched their necks to reach food')"
        },
        correction: {
          type: Type.STRING,
          description: "The scientifically accurate correction explaining why the misconception is wrong"
        }
      },
      required: ["commonBelief", "correction"]
    },
    gradeBand: {
      type: Type.STRING,
      enum: ["2-4", "5-6", "7-8"],
      description: "Target grade band"
    }
  },
  required: ["organism", "adaptation", "environment", "connection", "whatIfScenarios", "misconception", "gradeBand"]
};

/**
 * Generate adaptation investigator data using Gemini AI
 *
 * Creates interactive content for teaching structure-function-environment
 * relationships. Students explore an organism's adaptation, understand the
 * environmental pressures that shaped it, and predict outcomes of
 * environmental change.
 *
 * @param topic - The organism or adaptation to investigate (e.g., "arctic fox camouflage", "cactus water storage")
 * @param gradeBand - Grade level ('2-4', '5-6', or '7-8')
 * @param config - Optional partial configuration to override generated values
 * @returns AdaptationInvestigatorData with trait, environment, connection, and What If? scenarios
 */
export const generateAdaptationInvestigator = async (
  topic: string,
  gradeBand: '2-4' | '5-6' | '7-8' = '5-6',
  config?: Partial<AdaptationInvestigatorData>
): Promise<AdaptationInvestigatorData> => {

  const gradeContext: Record<string, string> = {
    '2-4': `
GRADE 2-4 GUIDELINES:
- Use simple, everyday vocabulary (no scientific jargon)
- Keep descriptions SHORT (1-2 simple sentences)
- Focus on observable traits students can see and understand
- Use familiar comparisons ("thick like a blanket", "sharp like scissors")
- What If? scenarios should be simple and concrete
- Only 2 What If? scenarios (keep it manageable)
- Misconception should use child-friendly language
- Environmental pressures should be relatable (cold, hot, predators, food)
`,
    '5-6': `
GRADE 5-6 GUIDELINES:
- Introduce scientific vocabulary WITH clear explanations
- Include both observable and functional descriptions
- Connect trait to survival and reproduction
- Use 2-3 What If? scenarios with moderate complexity
- Begin discussing natural selection concepts (without using the term directly)
- Environmental pressures can include competition and resource scarcity
- Misconception should address a real student confusion point
`,
    '7-8': `
GRADE 7-8 GUIDELINES:
- Use proper scientific terminology (structural, behavioral, physiological)
- Include evolutionary context where appropriate
- Discuss adaptation in terms of natural selection and fitness
- Use 3 What If? scenarios with nuanced reasoning required
- Environmental pressures can include complex ecological interactions
- Evidence points should cite specific biological mechanisms
- Misconception should address Lamarckism vs Darwinism where relevant
- Connect to broader concepts: gene pool, selective pressure, fitness advantage
`
  };

  const generationPrompt = `Create an educational adaptation investigator for: "${topic}".

TARGET GRADE BAND: ${gradeBand}

${gradeContext[gradeBand]}

REQUIRED INFORMATION:

1. **Organism**: The organism being studied

2. **Adaptation**:
   - trait: Name of the specific adaptation
   - type: "structural" (body part/structure), "behavioral" (actions/behaviors), or "physiological" (internal body processes)
   - description: Grade-appropriate description of the trait
   - imagePrompt: Detailed prompt for generating an image showing the organism with this adaptation highlighted

3. **Environment**:
   - habitat: Name of the habitat
   - pressures: 2-4 environmental pressures (predators, climate, food scarcity, competition)
   - description: Description of the environment and its challenges

4. **Connection**:
   - explanation: How the trait addresses the environmental pressures
   - evidencePoints: 2-4 specific evidence points

5. **What If? Scenarios** (${gradeBand === '2-4' ? '2' : '2-3'} scenarios):
   - environmentChange: A hypothetical change to the environment
   - question: Question about whether the adaptation would still help
   - expectedReasoning: Why the answer is correct
   - adaptationStillUseful: true or false
   IMPORTANT: Include a MIX of true and false answers. Not all scenarios should have the same answer.

6. **Misconception**:
   - commonBelief: A widely held misconception about this adaptation
   - correction: The scientifically accurate explanation

7. **Grade Band**: ${gradeBand}

EXAMPLE - Arctic Fox (Grade 5-6):
{
  "organism": "Arctic Fox",
  "adaptation": {
    "trait": "Seasonal Color-Changing Fur",
    "type": "structural",
    "description": "The Arctic fox grows thick white fur in winter that turns brown or gray in summer. This seasonal change helps it blend into its surroundings year-round, whether the landscape is covered in snow or rocky tundra.",
    "imagePrompt": "A white Arctic fox in a snowy winter landscape, with its thick white fur blending into the snow background, highlighted adaptation showing the dense fur coat"
  },
  "environment": {
    "habitat": "Arctic Tundra",
    "pressures": [
      "Extreme cold temperatures (-40°F in winter)",
      "Predators like wolves and polar bears with keen eyesight",
      "Scarce food during long, dark winters",
      "Open landscape with few hiding places"
    ],
    "description": "The Arctic tundra is one of Earth's harshest environments. Temperatures plunge far below freezing, the landscape is flat and exposed, and food becomes extremely scarce during winter months."
  },
  "connection": {
    "explanation": "The Arctic fox's color-changing fur serves a dual purpose: the white winter coat provides excellent camouflage against snow, hiding it from both predators and prey, while the thick fur also acts as insulation against extreme cold temperatures.",
    "evidencePoints": [
      "White fur reflects light, making the fox nearly invisible against snow",
      "Fur is 200% denser in winter than summer, trapping insulating air",
      "Color change is triggered by shorter daylight hours, not temperature",
      "Brown summer fur matches rocks and soil when snow melts"
    ]
  },
  "whatIfScenarios": [
    {
      "environmentChange": "Climate change causes the snow to melt earlier each year, leaving brown ground exposed for more months.",
      "question": "Would the Arctic fox's white winter fur still be helpful if snow disappeared earlier?",
      "expectedReasoning": "No - if snow melts early but the fox is still white, it would stand out against brown ground, making it EASIER for predators to spot. The fox's color change is timed by daylight, not snow, so it can't adapt quickly to earlier melting.",
      "adaptationStillUseful": false
    },
    {
      "environmentChange": "A new predator species that hunts mainly by smell (not sight) moves into the Arctic.",
      "question": "Would the fox's camouflage fur still protect it from this new predator?",
      "expectedReasoning": "The camouflage would be less useful against a smell-based predator since the white fur only hides the fox visually. However, the thick insulating properties would still help it survive the cold, so the fur itself remains partially useful even if the camouflage aspect doesn't help.",
      "adaptationStillUseful": true
    },
    {
      "environmentChange": "The Arctic fox's main food source (lemmings) goes extinct.",
      "question": "Would the fox's camouflage still be useful without lemmings to hunt?",
      "expectedReasoning": "Yes - the camouflage helps the fox both avoid predators AND sneak up on prey. Even without lemmings, the fox would still need to hunt other small animals and avoid predators. The camouflage would remain valuable for both purposes.",
      "adaptationStillUseful": true
    }
  ],
  "misconception": {
    "commonBelief": "Arctic foxes turn white because the cold weather bleaches their fur, like how cold turns your breath white.",
    "correction": "The color change is triggered by changing day length (photoperiod), not temperature. Special cells called melanocytes receive hormonal signals from the brain when days get shorter, causing them to produce less pigment. The fox would still change color in a warm room if the days shortened."
  },
  "gradeBand": "5-6"
}

Now generate an adaptation investigator for "${topic}" at grade band ${gradeBand}.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: adaptationInvestigatorSchema,
        systemInstruction: `You are an expert biology educator specializing in grades 2-8 life sciences with deep knowledge of evolutionary biology, ecology, and comparative anatomy. You create engaging, scientifically accurate content about adaptations that connects structure to function to environment. You understand developmental psychology and tailor complexity, vocabulary, and conceptual depth to each grade band. You design "What If?" scenarios that genuinely test causal reasoning, not just recall. You always address common misconceptions with scientifically rigorous corrections. You make biology exciting and accessible while maintaining accuracy.`,
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API");
    }

    const result = JSON.parse(text) as AdaptationInvestigatorData;

    // Validate core fields
    if (!result || !result.organism || !result.adaptation || !result.environment || !result.connection) {
      console.error('❌ Invalid response from Gemini API - missing required fields:', result);
      throw new Error('Invalid response from Gemini API: missing required fields');
    }

    // Validate What If? scenarios
    if (!result.whatIfScenarios || !Array.isArray(result.whatIfScenarios)) {
      console.error('❌ Invalid response from Gemini API - missing whatIfScenarios:', result);
      throw new Error('Invalid response from Gemini API: missing whatIfScenarios array');
    }

    // Merge with config overrides
    const finalData: AdaptationInvestigatorData = {
      ...result,
      ...config,
      adaptation: config?.adaptation || result.adaptation,
      environment: config?.environment || result.environment,
      connection: config?.connection || result.connection,
      whatIfScenarios: config?.whatIfScenarios || result.whatIfScenarios,
      misconception: config?.misconception || result.misconception,
    };

    console.log('🔬 Adaptation Investigator Generated:', {
      organism: finalData.organism,
      trait: finalData.adaptation.trait,
      adaptationType: finalData.adaptation.type,
      habitat: finalData.environment.habitat,
      whatIfCount: finalData.whatIfScenarios.length,
      gradeBand: finalData.gradeBand,
    });

    return finalData;

  } catch (error) {
    console.error("Error generating adaptation investigator:", error);
    throw error;
  }
};
