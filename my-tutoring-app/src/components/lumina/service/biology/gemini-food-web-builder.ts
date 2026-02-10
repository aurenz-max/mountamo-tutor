import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

// Import the data type from the component (single source of truth)
import { FoodWebBuilderData } from "../../primitives/visual-primitives/biology/FoodWebBuilder";

/**
 * Schema definition for Food Web Builder Data
 *
 * This schema defines the structure for interactive food web construction,
 * designed to scale from grades 3-5 (simple food chains) to 6-8 (complex food webs).
 *
 * The primitive follows the PRD specification for "Food Web Builder" - students
 * construct food webs by drawing energy-flow connections between organisms,
 * testing understanding of producer/consumer relationships, trophic levels, and
 * energy transfer. Can also model disruptions to explore ecosystem cascades.
 */
const foodWebBuilderSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    primitiveType: {
      type: Type.STRING,
      enum: ["food-web-builder"],
      description: "Type identifier for this primitive"
    },
    ecosystem: {
      type: Type.STRING,
      description: "Name of the ecosystem (e.g., 'Grassland', 'Coral Reef', 'Forest')"
    },
    organisms: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique identifier for this organism (e.g., 'org1', 'org2')"
          },
          name: {
            type: Type.STRING,
            description: "Common name of the organism (e.g., 'Grass', 'Rabbit', 'Hawk')"
          },
          imagePrompt: {
            type: Type.STRING,
            description: "Concise description for visualization"
          },
          trophicLevel: {
            type: Type.STRING,
            enum: ["producer", "primary-consumer", "secondary-consumer", "tertiary-consumer", "decomposer"],
            description: "Trophic level classification"
          },
          position: {
            type: Type.OBJECT,
            properties: {
              x: { type: Type.STRING, description: "Horizontal position as percentage (e.g., '25%', '50%')" },
              y: { type: Type.STRING, description: "Vertical position as percentage (e.g., '30%', '60%')" }
            },
            required: ["x", "y"],
            description: "Position on the canvas (percentage-based)"
          }
        },
        required: ["id", "name", "imagePrompt", "trophicLevel", "position"]
      },
      description: "Array of organisms in the food web (6-8 for 3-5 grade, 8-10 for 6-8 grade)"
    },
    correctConnections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          fromId: {
            type: Type.STRING,
            description: "ID of the prey/energy source organism"
          },
          toId: {
            type: Type.STRING,
            description: "ID of the predator/consumer organism"
          },
          relationship: {
            type: Type.STRING,
            description: "Description of the relationship (e.g., 'Rabbits eat grass', 'Hawks hunt rabbits')"
          }
        },
        required: ["fromId", "toId", "relationship"]
      },
      description: "Array of correct feeding relationships (energy flows from prey → predator)"
    },
    disruptionChallenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          removeOrganismId: {
            type: Type.STRING,
            description: "ID of the organism to remove from the ecosystem"
          },
          question: {
            type: Type.STRING,
            description: "Thought-provoking question about the disruption"
          },
          expectedEffects: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Array of expected cascade effects (3-5 effects)"
          },
          explanation: {
            type: Type.STRING,
            description: "Brief explanation of the ecological principle demonstrated"
          }
        },
        required: ["removeOrganismId", "question", "expectedEffects", "explanation"]
      },
      description: "Optional disruption scenarios (1-2 scenarios for grades 6-8, optional for 3-5)"
    },
    gradeBand: {
      type: Type.STRING,
      enum: ["3-5", "6-8"],
      description: "Target grade band - determines complexity"
    }
  },
  required: ["primitiveType", "ecosystem", "organisms", "correctConnections", "gradeBand"]
};

/**
 * Generate food web builder data using Gemini AI
 *
 * Creates interactive food web construction activities that scale from
 * 3-5 (simple food chains with 6-8 organisms) to 6-8 (complex food webs
 * with 8-10 organisms and disruption scenarios).
 *
 * The builder is designed as the CORE "who eats whom?" primitive for:
 * - Understanding trophic levels and energy flow (3-5)
 * - Constructing complete food webs (6-8)
 * - Exploring ecosystem disruptions and cascades (6-8)
 *
 * @param topic - Food web topic or ecosystem (e.g., "Grassland Food Web", "Ocean Food Chain")
 * @param gradeBand - Grade level ('3-5' or '6-8') determines complexity
 * @param config - Optional partial configuration to override generated values
 * @returns FoodWebBuilderData with grade-appropriate food web content
 */
export const generateFoodWebBuilder = async (
  topic: string,
  gradeBand: '3-5' | '6-8' = '3-5',
  config?: Partial<FoodWebBuilderData>
): Promise<FoodWebBuilderData> => {

  // Grade-specific complexity and content instructions
  const gradeContext = {
    '3-5': `
GRADE 3-5 GUIDELINES:
- Simple food chain structure with 6-8 organisms
- Clear linear relationships: grass → rabbit → fox → decomposer
- Focus on basic producer → consumer → predator progression
- Use familiar organisms students can recognize
- Include 1 producer, 2-3 primary consumers, 2-3 secondary consumers, 1 decomposer
- Connections should form clear chains showing energy transfer
- Keep relationships straightforward: "X eats Y" without complex interactions
- OPTIONAL: 1 simple disruption scenario showing predictable effects
- Emphasize vocabulary: producer, consumer, predator, prey, decomposer
- Position organisms vertically by trophic level (producers bottom, top predators top)
`,
    '6-8': `
GRADE 6-8 GUIDELINES:
- Complex food web with 8-10 organisms showing interconnected relationships
- Include ALL trophic levels: producers, primary/secondary/tertiary consumers, decomposers
- Multiple organisms at each level creating web structure (not just linear chains)
- Organisms can have multiple prey and multiple predators
- Scientific precision: use correct ecological terminology
- REQUIRED: 1-2 disruption scenarios demonstrating trophic cascade effects
- Disruptions should show:
  - Keystone species removal (dramatic cascading effects)
  - Population dynamics (predator removal → prey explosion → producer depletion)
  - Indirect effects (removing middle predator affects both above and below)
- Position organisms strategically to show complex web connections
- Challenge students to recognize that removing one organism affects multiple others
`
  };

  const generationPrompt = `Create an interactive food web builder for: "${topic}".

TARGET GRADE BAND: ${gradeBand}

${gradeContext[gradeBand]}

REQUIRED INFORMATION:

1. **Ecosystem Name**:
   - Clear, specific name (e.g., "African Savanna", "Temperate Forest", "Coral Reef")

2. **Organisms** (${gradeBand === '3-5' ? '6-8' : '8-10'} organisms):
   For EACH organism provide:
   - ID: Unique identifier (org1, org2, etc.)
   - Name: Clear, recognizable common name
   - Image Prompt: Brief visual description
   - Trophic Level: producer | primary-consumer | secondary-consumer | tertiary-consumer | decomposer
   - Position: Strategic placement on canvas (use percentage strings like "25%", "50%" for x and y)

   CRITICAL POSITIONING GUIDELINES:
   - Arrange organisms vertically by trophic level:
     * Producers (plants): y = 70-85% (bottom tier)
     * Primary consumers (herbivores): y = 50-65% (lower-middle tier)
     * Secondary consumers (carnivores): y = 35-50% (upper-middle tier)
     * Tertiary consumers (top predators): y = 15-30% (top tier)
     * Decomposers: y = 80-90% (bottom, near producers)
   - Spread organisms horizontally to avoid overlap: use varied x positions (15%, 30%, 45%, 60%, 75%, 90%)
   - Ensure 12%+ spacing between organisms
   - Position organisms to minimize arrow crossings in the food web

   ${gradeBand === '3-5' ? `
   GRADE 3-5 ORGANISM DISTRIBUTION:
   - 1-2 producers (plants)
   - 2-3 primary consumers (herbivores)
   - 2-3 secondary consumers (carnivores)
   - 1 decomposer
   - Total: 6-8 organisms forming clear food chains
   ` : `
   GRADE 6-8 ORGANISM DISTRIBUTION:
   - 2-3 producers (diverse plant types)
   - 3-4 primary consumers (multiple herbivore species)
   - 2-3 secondary consumers (mid-level predators)
   - 1-2 tertiary consumers (apex predators)
   - 1 decomposer
   - Total: 8-10 organisms forming complex food web
   `}

3. **Correct Connections** (feeding relationships):
   For EACH connection provide:
   - fromId: ID of prey/energy source (the organism being eaten)
   - toId: ID of predator/consumer (the organism doing the eating)
   - Relationship: Clear description (e.g., "Rabbits eat grass", "Hawks hunt rabbits")

   ${gradeBand === '3-5' ? `
   GRADE 3-5 CONNECTION GUIDELINES:
   - Create 6-10 connections forming clear linear food chains
   - Each organism should typically have 1-2 connections (simple relationships)
   - Show clear energy flow: producer → herbivore → carnivore
   - Example chain: Grass (org1) → Rabbit (org2) → Fox (org3) → Decomposer (org4)
     * Connection 1: fromId: org1, toId: org2, relationship: "Rabbits eat grass"
     * Connection 2: fromId: org2, toId: org3, relationship: "Foxes hunt rabbits"
     * Connection 3: fromId: org3, toId: org4, relationship: "Fungi decompose dead foxes"
   ` : `
   GRADE 6-8 CONNECTION GUIDELINES:
   - Create 12-16 connections forming complex interconnected web
   - Organisms should have multiple feeding relationships (web structure)
   - Show energy flowing through multiple pathways
   - Include:
     * Multiple herbivores feeding on same plants
     * Predators with varied prey (multiple fromId → same toId)
     * Organisms serving as prey to multiple predators (same fromId → multiple toId)
   - Ensure ALL organisms are connected to the web (no isolated organisms)
   `}

4. **Disruption Challenges** (${gradeBand === '3-5' ? 'optional, 0-1' : 'REQUIRED, 1-2'}):
   ${gradeBand === '3-5' ? `
   OPTIONAL FOR GRADE 3-5:
   If including a disruption, keep it simple:
   - Remove: A middle consumer (not producer or top predator)
   - Expected Effects: 3-4 predictable, direct effects
   - Example: Remove rabbits → grass overgrows, foxes lose food source, population changes
   ` : `
   REQUIRED FOR GRADE 6-8 (provide 1-2 scenarios):
   - Scenario 1: Remove a KEYSTONE SPECIES showing dramatic cascade
   - Scenario 2 (optional): Remove apex predator showing top-down effects

   For EACH disruption provide:
   - removeOrganismId: ID of organism to remove
   - question: Thought-provoking question about ecosystem impact
   - expectedEffects: 4-5 cascade effects showing indirect impacts
   - explanation: Brief ecological principle (trophic cascade, keystone species, etc.)

   Focus on:
   - Population dynamics (prey explosion, predator starvation)
   - Cascade effects (ripple through multiple trophic levels)
   - Indirect effects (affecting organisms not directly connected)
   - Ecosystem imbalance and recovery
   `}

EXAMPLE OUTPUT - GRADE 3-5 (Simple Food Chain):

{
  "primitiveType": "food-web-builder",
  "ecosystem": "Grassland",
  "organisms": [
    {
      "id": "org1",
      "name": "Grass",
      "imagePrompt": "Green prairie grass",
      "trophicLevel": "producer",
      "position": { "x": "20%", "y": "75%" }
    },
    {
      "id": "org2",
      "name": "Grasshopper",
      "imagePrompt": "Green grasshopper on grass blade",
      "trophicLevel": "primary-consumer",
      "position": { "x": "35%", "y": "55%" }
    },
    {
      "id": "org3",
      "name": "Mouse",
      "imagePrompt": "Small brown field mouse",
      "trophicLevel": "primary-consumer",
      "position": { "x": "55%", "y": "55%" }
    },
    {
      "id": "org4",
      "name": "Snake",
      "imagePrompt": "Garter snake hunting",
      "trophicLevel": "secondary-consumer",
      "position": { "x": "40%", "y": "35%" }
    },
    {
      "id": "org5",
      "name": "Hawk",
      "imagePrompt": "Red-tailed hawk soaring",
      "trophicLevel": "tertiary-consumer",
      "position": { "x": "70%", "y": "20%" }
    },
    {
      "id": "org6",
      "name": "Bacteria",
      "imagePrompt": "Decomposing bacteria in soil",
      "trophicLevel": "decomposer",
      "position": { "x": "80%", "y": "85%" }
    }
  ],
  "correctConnections": [
    {
      "fromId": "org1",
      "toId": "org2",
      "relationship": "Grasshoppers eat grass"
    },
    {
      "fromId": "org1",
      "toId": "org3",
      "relationship": "Mice eat grass seeds"
    },
    {
      "fromId": "org2",
      "toId": "org4",
      "relationship": "Snakes eat grasshoppers"
    },
    {
      "fromId": "org3",
      "toId": "org4",
      "relationship": "Snakes hunt mice"
    },
    {
      "fromId": "org3",
      "toId": "org5",
      "relationship": "Hawks hunt mice"
    },
    {
      "fromId": "org4",
      "toId": "org5",
      "relationship": "Hawks prey on snakes"
    },
    {
      "fromId": "org5",
      "toId": "org6",
      "relationship": "Bacteria decompose dead hawks"
    }
  ],
  "disruptionChallenges": [
    {
      "removeOrganismId": "org4",
      "question": "What would happen if all the snakes disappeared from this grassland?",
      "expectedEffects": [
        "Grasshopper population would increase (no predator)",
        "Mouse population would increase (no predator)",
        "Grass would be overeaten by too many grasshoppers and mice",
        "Hawk population might decrease (fewer prey options)"
      ],
      "explanation": "Snakes are a middle predator that controls both grasshopper and mouse populations. Removing them creates an imbalance, demonstrating how each organism plays an important role in maintaining ecosystem balance."
    }
  ],
  "gradeBand": "3-5"
}

EXAMPLE OUTPUT - GRADE 6-8 (Complex Food Web):

{
  "primitiveType": "food-web-builder",
  "ecosystem": "Kelp Forest",
  "organisms": [
    {
      "id": "org1",
      "name": "Giant Kelp",
      "imagePrompt": "Tall brown kelp swaying underwater",
      "trophicLevel": "producer",
      "position": { "x": "15%", "y": "75%" }
    },
    {
      "id": "org2",
      "name": "Phytoplankton",
      "imagePrompt": "Microscopic floating algae",
      "trophicLevel": "producer",
      "position": { "x": "35%", "y": "80%" }
    },
    {
      "id": "org3",
      "name": "Sea Urchin",
      "imagePrompt": "Purple sea urchin with spines",
      "trophicLevel": "primary-consumer",
      "position": { "x": "25%", "y": "60%" }
    },
    {
      "id": "org4",
      "name": "Zooplankton",
      "imagePrompt": "Tiny transparent crustaceans",
      "trophicLevel": "primary-consumer",
      "position": { "x": "50%", "y": "65%" }
    },
    {
      "id": "org5",
      "name": "Abalone",
      "imagePrompt": "Abalone gastropod on kelp",
      "trophicLevel": "primary-consumer",
      "position": { "x": "45%", "y": "55%" }
    },
    {
      "id": "org6",
      "name": "Sea Otter",
      "imagePrompt": "Sea otter floating on back",
      "trophicLevel": "secondary-consumer",
      "position": { "x": "30%", "y": "35%" }
    },
    {
      "id": "org7",
      "name": "Small Fish",
      "imagePrompt": "School of sardines",
      "trophicLevel": "secondary-consumer",
      "position": { "x": "60%", "y": "45%" }
    },
    {
      "id": "org8",
      "name": "Seal",
      "imagePrompt": "Harbor seal swimming",
      "trophicLevel": "tertiary-consumer",
      "position": { "x": "70%", "y": "25%" }
    },
    {
      "id": "org9",
      "name": "Great White Shark",
      "imagePrompt": "Great white shark patrolling",
      "trophicLevel": "tertiary-consumer",
      "position": { "x": "85%", "y": "20%" }
    },
    {
      "id": "org10",
      "name": "Marine Bacteria",
      "imagePrompt": "Bacteria decomposing organic matter",
      "trophicLevel": "decomposer",
      "position": { "x": "75%", "y": "85%" }
    }
  ],
  "correctConnections": [
    {
      "fromId": "org1",
      "toId": "org3",
      "relationship": "Sea urchins graze on kelp"
    },
    {
      "fromId": "org1",
      "toId": "org5",
      "relationship": "Abalone feed on kelp"
    },
    {
      "fromId": "org2",
      "toId": "org4",
      "relationship": "Zooplankton consume phytoplankton"
    },
    {
      "fromId": "org3",
      "toId": "org6",
      "relationship": "Sea otters prey on sea urchins"
    },
    {
      "fromId": "org5",
      "toId": "org6",
      "relationship": "Sea otters eat abalone"
    },
    {
      "fromId": "org4",
      "toId": "org7",
      "relationship": "Small fish feed on zooplankton"
    },
    {
      "fromId": "org7",
      "toId": "org8",
      "relationship": "Seals hunt small fish"
    },
    {
      "fromId": "org6",
      "toId": "org9",
      "relationship": "Great white sharks prey on sea otters"
    },
    {
      "fromId": "org8",
      "toId": "org9",
      "relationship": "Great white sharks hunt seals"
    },
    {
      "fromId": "org9",
      "toId": "org10",
      "relationship": "Bacteria decompose dead sharks"
    },
    {
      "fromId": "org6",
      "toId": "org10",
      "relationship": "Bacteria decompose dead otters"
    },
    {
      "fromId": "org8",
      "toId": "org10",
      "relationship": "Bacteria decompose dead seals"
    }
  ],
  "disruptionChallenges": [
    {
      "removeOrganismId": "org6",
      "question": "Sea otters are a keystone species in kelp forests. Predict the cascade of effects if they disappear.",
      "expectedEffects": [
        "Sea urchin population explodes without their main predator (direct effect)",
        "Urchins overgraze and destroy kelp forests (indirect effect on producer)",
        "Fish populations decline due to loss of kelp habitat (indirect effect on consumer)",
        "Seal populations may decline due to reduced fish prey (cascade to tertiary consumer)",
        "Great white sharks lose prey diversity, potentially impacting their population (top-level cascade)"
      ],
      "explanation": "This demonstrates a trophic cascade initiated by keystone species removal. Sea otters control urchin populations; without them, urchins devastate kelp forests, collapsing the entire ecosystem structure. This is a classic example of top-down control in marine ecosystems."
    },
    {
      "removeOrganismId": "org9",
      "question": "If great white sharks (apex predators) were removed from the kelp forest, how would the ecosystem change?",
      "expectedEffects": [
        "Seal and sea otter populations increase without predation pressure (mesopredator release)",
        "Increased seal predation on fish could reduce fish populations",
        "Sea otters might over-consume urchins and abalone, depleting these populations",
        "Changed predator-prey dynamics throughout the web (behavior and distribution changes)",
        "Potential long-term ecosystem instability due to loss of top-down regulation"
      ],
      "explanation": "Apex predator removal triggers mesopredator release, where mid-level predators increase and disrupt balance throughout the food web. This shows how top predators regulate entire ecosystems through both direct predation and behavioral effects on prey."
    }
  ],
  "gradeBand": "6-8"
}

Now generate a food web builder for "${topic}" at grade level ${gradeBand}.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: foodWebBuilderSchema,
        systemInstruction: `You are an expert ecology educator specializing in K-8 food webs, energy transfer, and trophic relationships. You create engaging, scientifically accurate food web builders that scale appropriately by grade level. You understand predator-prey dynamics, trophic cascades, keystone species, and ecosystem balance. You make ecology exciting and help students visualize energy flow through ecosystems. You excel at showing how organisms are interconnected and how removing one species can cascade through an entire food web.`,
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API");
    }

    const result = JSON.parse(text) as FoodWebBuilderData;

    // Merge with any config overrides
    const finalData: FoodWebBuilderData = {
      ...result,
      ...config,
    };

    console.log('🕸️ Food Web Builder Generated:', {
      ecosystem: finalData.ecosystem,
      organisms: finalData.organisms.length,
      connections: finalData.correctConnections.length,
      disruptions: finalData.disruptionChallenges?.length || 0,
      gradeBand: finalData.gradeBand
    });

    return finalData;

  } catch (error) {
    console.error("Error generating food web builder:", error);
    throw error;
  }
};
