import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

// Import the data type from the component (single source of truth)
import { HabitatDioramaData } from "../../primitives/visual-primitives/biology/HabitatDiorama";

/**
 * Schema definition for Habitat Diorama Data
 *
 * This schema defines the structure for interactive ecosystem exploration,
 * designed to scale from K-2 (simple observation) to 6-8 (ecosystem dynamics).
 *
 * The primitive follows the PRD specification for "Habitat Diorama" from the
 * biology primitives document - it's the CORE ecosystem primitive for exploring
 * relationships, food webs, and ecological interactions.
 */
const habitatDioramaSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    primitiveType: {
      type: Type.STRING,
      enum: ["habitat-diorama"],
      description: "Type identifier for this primitive"
    },
    habitat: {
      type: Type.OBJECT,
      properties: {
        name: {
          type: Type.STRING,
          description: "Name of the habitat (e.g., 'Coral Reef Ecosystem', 'Desert Oasis', 'Deciduous Forest')"
        },
        biome: {
          type: Type.STRING,
          description: "Biome classification (e.g., 'Marine', 'Desert', 'Forest', 'Grassland', 'Tundra')"
        },
        climate: {
          type: Type.STRING,
          description: "Climate description (e.g., 'Warm and humid', 'Hot and dry', 'Temperate with seasons')"
        },
        description: {
          type: Type.STRING,
          description: "Brief description of the habitat setting and ecosystem context"
        }
      },
      required: ["name", "biome", "climate", "description"]
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
          commonName: {
            type: Type.STRING,
            description: "Common name of the organism (e.g., 'Red Fox', 'Oak Tree')"
          },
          role: {
            type: Type.STRING,
            enum: ["producer", "primary-consumer", "secondary-consumer", "tertiary-consumer", "decomposer"],
            description: "Ecological role in the food web"
          },
          imagePrompt: {
            type: Type.STRING,
            description: "Concise description for image generation or visualization"
          },
          position: {
            type: Type.OBJECT,
            properties: {
              x: { type: Type.STRING, description: "Horizontal position as percentage (e.g., '25%', '50%', '75%')" },
              y: { type: Type.STRING, description: "Vertical position as percentage (e.g., '30%', '60%', '80%')" }
            },
            required: ["x", "y"],
            description: "Position in the diorama scene (percentage-based for responsive layout)"
          },
          description: {
            type: Type.STRING,
            description: "Brief description of the organism's role and characteristics"
          },
          adaptations: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "2-4 key adaptations that help the organism survive in this habitat"
          }
        },
        required: ["id", "commonName", "role", "imagePrompt", "position", "description", "adaptations"]
      },
      description: "Array of organisms in the ecosystem (4-5 for K-2, 6-8 for 3-5, 8-10 for 6-8)"
    },
    relationships: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          fromId: {
            type: Type.STRING,
            description: "ID of the organism initiating the relationship"
          },
          toId: {
            type: Type.STRING,
            description: "ID of the organism receiving the relationship"
          },
          type: {
            type: Type.STRING,
            enum: ["predation", "symbiosis-mutualism", "symbiosis-commensalism", "symbiosis-parasitism", "competition"],
            description: "Type of ecological relationship"
          },
          description: {
            type: Type.STRING,
            description: "Brief explanation of the relationship (more detailed for grades 6-8)"
          }
        },
        required: ["fromId", "toId", "type", "description"]
      },
      description: "Array of relationships between organisms (minimal for K-2, comprehensive for 6-8)"
    },
    environmentalFeatures: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique identifier for this feature"
          },
          name: {
            type: Type.STRING,
            description: "Name of the feature (e.g., 'Water Source', 'Sunlight', 'Rocky Shelter')"
          },
          description: {
            type: Type.STRING,
            description: "Explanation of how this feature supports the ecosystem"
          },
          position: {
            type: Type.OBJECT,
            properties: {
              x: { type: Type.STRING, description: "Horizontal position as percentage" },
              y: { type: Type.STRING, description: "Vertical position as percentage" }
            },
            required: ["x", "y"]
          }
        },
        required: ["id", "name", "description", "position"]
      },
      description: "Array of environmental features (3-5 features showing abiotic factors)"
    },
    disruptionScenario: {
      type: Type.OBJECT,
      properties: {
        event: {
          type: Type.STRING,
          description: "Description of a disruption event (e.g., 'The wolf population is removed from this ecosystem')"
        },
        cascadeEffects: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Array of 3-5 cascade effects showing how the disruption impacts the ecosystem"
        },
        question: {
          type: Type.STRING,
          description: "Thought-provoking question for students to consider"
        }
      },
      required: ["event", "cascadeEffects", "question"],
      description: "Optional disruption scenario for grades 3-8 (null for K-2)"
    },
    gradeBand: {
      type: Type.STRING,
      enum: ["K-2", "3-5", "6-8"],
      description: "Target grade band - determines complexity and content depth"
    }
  },
  required: ["primitiveType", "habitat", "organisms", "relationships", "environmentalFeatures", "gradeBand"]
};

/**
 * Generate habitat diorama data using Gemini AI
 *
 * This function creates interactive ecosystem explorations that scale from
 * K-2 (simple observation: who lives here?) to 6-8 (complex food webs and
 * ecosystem dynamics with disruption scenarios).
 *
 * The diorama is designed as the PRIMARY ecosystem primitive for:
 * - Observation and identification (K-2: "What animals live in the forest?")
 * - Food chains and relationships (3-5: "Who eats whom?")
 * - Ecosystem dynamics and disruption (6-8: "What happens if wolves disappear?")
 *
 * @param topic - Habitat or ecosystem topic (e.g., "Coral Reef", "African Savanna", "Temperate Forest")
 * @param gradeBand - Grade level ('K-2', '3-5', or '6-8') determines complexity
 * @param config - Optional partial configuration to override generated values
 * @returns HabitatDioramaData with grade-appropriate ecosystem content
 */
export const generateHabitatDiorama = async (
  topic: string,
  gradeBand: 'K-2' | '3-5' | '6-8' = '3-5',
  config?: Partial<HabitatDioramaData>
): Promise<HabitatDioramaData> => {

  // Grade-specific complexity and content instructions
  const gradeContext = {
    'K-2': `
GRADE K-2 GUIDELINES:
- Simple ecosystem with 4-5 easily recognizable organisms
- Use familiar animals and plants (avoid technical names)
- Focus on observable characteristics: "The rabbit eats plants", "The owl hunts at night"
- Keep relationships simple: predator-prey only (no symbiosis yet)
- Use 2-3 basic environmental features (water, sunlight, shelter)
- NO disruption scenario (too complex for K-2)
- Emphasize observation: "What do you see? Who lives here? What do they eat?"
- Keep descriptions short and engaging
- Use comparisons to familiar things ("The bear is as big as a car")
`,
    '3-5': `
GRADE 3-5 GUIDELINES:
- More complex ecosystem with 6-8 diverse organisms
- Include full food chain: producers → primary consumers → secondary consumers
- Introduce symbiotic relationships (mutualism, commensalism) with simple explanations
- Scientific vocabulary introduced with context: "herbivore (plant-eater)", "carnivore (meat-eater)"
- 3-4 environmental features showing abiotic factors
- INCLUDE a simple disruption scenario with 3-4 predictable effects
- Students should trace energy flow through the food chain
- Adaptations explained in accessible terms
- Make connections to familiar experiences
`,
    '6-8': `
GRADE 6-8 GUIDELINES:
- Complex ecosystem with 8-10 organisms showing full food web
- Include ALL trophic levels: producers → primary → secondary → tertiary consumers + decomposers
- Full range of relationships: predation, mutualism, commensalism, parasitism, competition
- Precise scientific terminology and ecological concepts
- 4-5 environmental features showing abiotic-biotic interactions
- REQUIRED: Complex disruption scenario with 4-5 cascade effects showing systems thinking
- Disruption should demonstrate: trophic cascade, competitive release, population dynamics
- Adaptations linked to evolutionary pressures and natural selection
- Connect to broader ecological concepts: energy flow, nutrient cycling, succession, keystone species
- Challenge students with "what if" scenarios requiring systems-level analysis
`
  };

  const generationPrompt = `Create an interactive habitat diorama for: "${topic}".

TARGET GRADE BAND: ${gradeBand}

${gradeContext[gradeBand]}

REQUIRED INFORMATION:

1. **Habitat Context**:
   - Name: Clear, descriptive name for the habitat
   - Biome: Biome classification (Marine, Desert, Forest, Grassland, Tundra, etc.)
   - Climate: Brief climate description
   - Description: 2-3 sentences setting the scene

2. **Organisms** (${gradeBand === 'K-2' ? '4-5' : gradeBand === '3-5' ? '6-8' : '8-10'} organisms):
   For EACH organism provide:
   - ID: Unique identifier (org1, org2, etc.)
   - Common Name: Clear, recognizable name
   - Role: producer | primary-consumer | secondary-consumer | tertiary-consumer | decomposer
   - Image Prompt: Concise visual description
   - Position: Strategic placement in scene (use percentage strings like "25%", "50%", "75%" for x and y)
   - Description: Brief role explanation (1-2 sentences)
   - Adaptations: 2-4 key survival adaptations

   IMPORTANT POSITION GUIDELINES:
   - Producers (plants): Place at 20-30% vertical (bottom) where they get sunlight/soil
   - Primary consumers (herbivores): Place at 40-50% vertical (middle ground)
   - Secondary/tertiary consumers (predators): Place at 50-70% vertical (upper areas)
   - Decomposers: Place at 80-90% vertical (near ground/forest floor)
   - Spread organisms horizontally: use varied x positions (20%, 35%, 50%, 65%, 80%)
   - Ensure organisms don't overlap: maintain 15%+ spacing between positions

3. **Relationships** (${gradeBand === 'K-2' ? '3-4' : gradeBand === '3-5' ? '5-7' : '8-12'} relationships):
   For EACH relationship provide:
   - fromId: Organism initiating the relationship
   - toId: Organism receiving the relationship
   - Type: predation | symbiosis-mutualism | symbiosis-commensalism | symbiosis-parasitism | competition
   - Description: Clear explanation appropriate for grade level

   ${gradeBand === 'K-2' ? '- K-2: ONLY predation relationships (simple predator-prey)' : ''}
   ${gradeBand === '3-5' ? '- 3-5: Mostly predation, introduce 1-2 symbiotic relationships' : ''}
   ${gradeBand === '6-8' ? '- 6-8: Full range of relationships showing complex food web' : ''}

4. **Environmental Features** (3-5 features):
   For EACH feature provide:
   - ID: Unique identifier
   - Name: Clear feature name (e.g., "Mountain Stream", "Rocky Outcrop", "Canopy Sunlight")
   - Description: How this abiotic factor supports the ecosystem
   - Position: Strategic placement (use percentage strings for x and y)

5. **Disruption Scenario** (${gradeBand === 'K-2' ? 'null' : 'REQUIRED'}):
   ${gradeBand === 'K-2' ? '- K-2: Set to null (omit this field entirely)' : ''}
   ${gradeBand === '3-5' ? '- 3-5: Simple scenario with 3-4 predictable cascade effects' : ''}
   ${gradeBand === '6-8' ? '- 6-8: Complex scenario demonstrating trophic cascade with 4-5 interconnected effects' : ''}

   ${gradeBand !== 'K-2' ? `
   Provide:
   - Event: Clear disruption event (predator removal, habitat loss, invasive species, etc.)
   - Cascade Effects: Step-by-step consequences showing ecosystem impact
   - Question: Thought-provoking question for systems thinking
   ` : ''}

EXAMPLE OUTPUT STRUCTURE:

**K-2 Example - Backyard Garden**:
{
  "primitiveType": "habitat-diorama",
  "habitat": {
    "name": "Backyard Garden",
    "biome": "Urban Garden",
    "climate": "Warm and sunny with afternoon shade",
    "description": "A small backyard garden with flowers, vegetables, and visiting wildlife. This miniature ecosystem shows how plants and animals live together in our neighborhoods."
  },
  "organisms": [
    {
      "id": "org1",
      "commonName": "Tomato Plant",
      "role": "producer",
      "imagePrompt": "Red tomato plant with green leaves and ripe tomatoes",
      "position": { "x": "30%", "y": "25%" },
      "description": "The tomato plant makes its own food from sunlight and grows juicy tomatoes.",
      "adaptations": ["Thick stem supports heavy fruit", "Deep roots find water underground"]
    },
    {
      "id": "org2",
      "commonName": "Honeybee",
      "role": "primary-consumer",
      "imagePrompt": "Yellow and black striped honeybee visiting a flower",
      "position": { "x": "50%", "y": "40%" },
      "description": "The honeybee visits flowers to drink sweet nectar and spreads pollen.",
      "adaptations": ["Special baskets on legs collect pollen", "Long tongue reaches deep into flowers"]
    },
    {
      "id": "org3",
      "commonName": "Robin",
      "role": "secondary-consumer",
      "imagePrompt": "Red-breasted robin bird standing on ground",
      "position": { "x": "70%", "y": "55%" },
      "description": "The robin hops around the garden looking for worms and insects to eat.",
      "adaptations": ["Sharp eyes spot tiny insects", "Strong beak catches worms"]
    },
    {
      "id": "org4",
      "commonName": "Garden Worm",
      "role": "decomposer",
      "imagePrompt": "Pink earthworm in dark soil",
      "position": { "x": "20%", "y": "85%" },
      "description": "The earthworm lives in the soil and breaks down dead leaves to make the soil healthy.",
      "adaptations": ["Tunnels through soil to find food", "Slimy skin helps it move underground"]
    }
  ],
  "relationships": [
    {
      "fromId": "org2",
      "toId": "org1",
      "type": "symbiosis-mutualism",
      "description": "The bee gets nectar from the plant, and the plant gets help spreading its pollen."
    },
    {
      "fromId": "org3",
      "toId": "org2",
      "type": "predation",
      "description": "The robin catches and eats bees and other insects."
    }
  ],
  "environmentalFeatures": [
    {
      "id": "feat1",
      "name": "Sunlight",
      "description": "The sun provides energy for plants to make food through photosynthesis.",
      "position": { "x": "50%", "y": "10%" }
    },
    {
      "id": "feat2",
      "name": "Garden Soil",
      "description": "Rich soil gives plants water and nutrients they need to grow.",
      "position": { "x": "30%", "y": "90%" }
    }
  ],
  "gradeBand": "K-2"
}

**6-8 Example - Yellowstone Wolf Restoration**:
{
  "primitiveType": "habitat-diorama",
  "habitat": {
    "name": "Yellowstone Ecosystem After Wolf Reintroduction",
    "biome": "Temperate Forest and Grassland",
    "climate": "Continental climate with cold winters and warm summers",
    "description": "The Greater Yellowstone Ecosystem demonstrates trophic cascade dynamics following the 1995 wolf reintroduction. This case study shows how apex predators structure entire ecosystems through direct predation and behavioral changes in prey species."
  },
  "organisms": [
    {
      "id": "org1",
      "commonName": "Aspen Tree",
      "role": "producer",
      "imagePrompt": "Young aspen sapling with distinctive white bark and trembling leaves",
      "position": { "x": "25%", "y": "20%" },
      "description": "Aspen trees are keystone species that provide habitat and food, reproducing through root suckers to form extensive clonal colonies.",
      "adaptations": ["Clone through root systems for rapid regeneration", "Trembling leaves maximize photosynthesis", "Bitter bark compounds deter herbivores", "Fire-resistant roots allow post-fire recovery"]
    },
    {
      "id": "org2",
      "commonName": "Elk (Wapiti)",
      "role": "primary-consumer",
      "imagePrompt": "Large elk with antlers grazing in meadow",
      "position": { "x": "45%", "y": "45%" },
      "description": "Elk are the primary herbivores, consuming woody browse and grasses. Wolf presence creates 'landscape of fear' altering elk behavior and distribution.",
      "adaptations": ["Large body size for cold climate survival", "Antlers for male competition and defense", "Vigilance behaviors detect predator presence", "Herd behavior dilutes individual predation risk"]
    },
    {
      "id": "org3",
      "commonName": "Gray Wolf",
      "role": "tertiary-consumer",
      "imagePrompt": "Gray wolf pack hunting in forest clearing",
      "position": { "x": "70%", "y": "60%" },
      "description": "Gray wolves are apex predators that regulate elk populations through direct predation and behavioral modification, driving trophic cascades throughout the ecosystem.",
      "adaptations": ["Pack hunting strategies for large prey", "Territory maintenance through scent marking", "Cooperative breeding increases pup survival", "Efficient long-distance travel conserves energy"]
    },
    {
      "id": "org4",
      "commonName": "Beaver",
      "role": "primary-consumer",
      "imagePrompt": "Beaver near dam with lodge in background",
      "position": { "x": "15%", "y": "70%" },
      "description": "Beavers are ecosystem engineers that create wetland habitat through dam construction, benefiting after aspen recovery enabled by wolf presence.",
      "adaptations": ["Powerful incisors fell trees for food and dam material", "Webbed feet and flat tail for swimming", "Waterproof fur maintains insulation", "Underwater lodges provide predator protection"]
    },
    {
      "id": "org5",
      "commonName": "Grizzly Bear",
      "role": "secondary-consumer",
      "imagePrompt": "Large grizzly bear foraging for berries and scavenging",
      "position": { "x": "85%", "y": "50%" },
      "description": "Grizzly bears are omnivores that benefit from wolf kills through scavenging, gaining access to high-quality protein especially in spring.",
      "adaptations": ["Opportunistic omnivory maximizes energy intake", "Fat storage for hibernation survival", "Massive strength for digging and defense", "Keen sense of smell detects carcasses"]
    },
    {
      "id": "org6",
      "commonName": "Raven",
      "role": "secondary-consumer",
      "imagePrompt": "Black raven perched on tree observing wolf kill",
      "position": { "x": "60%", "y": "25%" },
      "description": "Ravens form commensal relationships with wolves, following packs to scavenge from kills and gaining winter food access.",
      "adaptations": ["Social intelligence tracks wolf pack movements", "Opportunistic feeding on various food sources", "Cached food stores for winter survival", "Flight enables rapid kill detection"]
    },
    {
      "id": "org7",
      "commonName": "Willows",
      "role": "producer",
      "imagePrompt": "Willow shrubs growing along stream bank",
      "position": { "x": "35%", "y": "75%" },
      "description": "Willow shrubs recovered in riparian zones after wolf reintroduction reduced elk browsing pressure, stabilizing stream banks.",
      "adaptations": ["Rapid growth in moist soils", "Resprouting ability after browsing", "Deep roots stabilize stream banks", "Chemical defenses against herbivores"]
    },
    {
      "id": "org8",
      "commonName": "Coyote",
      "role": "secondary-consumer",
      "imagePrompt": "Coyote hunting in grassland",
      "position": { "x": "80%", "y": "70%" },
      "description": "Coyotes experienced competitive pressure from wolf reintroduction, demonstrating mesopredator suppression and interspecific competition.",
      "adaptations": ["Smaller size allows exploitation of marginal habitats", "Flexible diet includes small mammals and carrion", "Solitary or small group hunting", "Behavioral avoidance of wolves reduces conflict"]
    }
  ],
  "relationships": [
    {
      "fromId": "org3",
      "toId": "org2",
      "type": "predation",
      "description": "Wolves predate elk, reducing population size and altering behavior through risk effects, creating spatially heterogeneous browsing patterns."
    },
    {
      "fromId": "org2",
      "toId": "org1",
      "type": "predation",
      "description": "Elk browse aspen shoots, preventing regeneration when wolf predation risk is low. Wolf presence reduces browsing intensity in risky areas."
    },
    {
      "fromId": "org2",
      "toId": "org7",
      "type": "predation",
      "description": "Elk browse willows heavily in wolf-absent conditions. Landscape of fear created by wolves allows willow recovery in riparian zones."
    },
    {
      "fromId": "org4",
      "toId": "org1",
      "type": "predation",
      "description": "Beavers harvest aspen for food and dam construction. Increased aspen recruitment after wolf reintroduction supports beaver population expansion."
    },
    {
      "fromId": "org5",
      "toId": "org3",
      "type": "symbiosis-commensalism",
      "description": "Grizzly bears scavenge wolf kills, gaining high-quality protein. Wolves are unaffected, though bears may displace wolves from carcasses."
    },
    {
      "fromId": "org6",
      "toId": "org3",
      "type": "symbiosis-commensalism",
      "description": "Ravens follow wolf packs and vocalize to attract wolves to prey, then scavenge from kills. Ravens benefit without impacting wolves."
    },
    {
      "fromId": "org3",
      "toId": "org8",
      "type": "competition",
      "description": "Wolves and coyotes compete for prey and space. Wolves directly kill coyotes and competitively exclude them from prime habitat (mesopredator suppression)."
    },
    {
      "fromId": "org8",
      "toId": "org2",
      "type": "predation",
      "description": "Coyotes occasionally predate elk calves when available, though less efficiently than wolves due to smaller body size."
    }
  ],
  "environmentalFeatures": [
    {
      "id": "feat1",
      "name": "Stream Corridor",
      "description": "Riparian zones provide water, fertile soil, and diverse microhabitats. Willow recovery stabilizes banks, reducing erosion and creating aquatic habitat.",
      "position": { "x": "30%", "y": "85%" }
    },
    {
      "id": "feat2",
      "name": "Forest Edge",
      "description": "Ecotone between forest and grassland provides diverse browse for elk and cover for predators, creating spatial heterogeneity in predation risk.",
      "position": { "x": "55%", "y": "35%" }
    },
    {
      "id": "feat3",
      "name": "Open Meadow",
      "description": "Grassland provides high-quality forage for elk but exposes them to predation risk. Elk reduce meadow use when wolf activity is high (risk-foraging tradeoff).",
      "position": { "x": "75%", "y": "55%" }
    },
    {
      "id": "feat4",
      "name": "Rocky Outcrop",
      "description": "Terrain refugia where elk seek safety from wolves. Rugged topography limits wolf hunting efficiency, creating spatial refuges from predation.",
      "position": { "x": "90%", "y": "40%" }
    }
  ],
  "disruptionScenario": {
    "event": "Wolf population is removed from the ecosystem due to livestock conflict or policy change (simulating pre-1995 conditions).",
    "cascadeEffects": [
      "Elk populations increase rapidly without predation pressure, reaching unsustainable densities (release from top-down control).",
      "Elk browsing intensifies in riparian zones and aspen groves, preventing woody plant regeneration and reducing habitat structural complexity.",
      "Beaver populations decline as aspen and willow availability decreases, reducing wetland habitat created by beaver dams and affecting aquatic species.",
      "Coyote populations increase through competitive release (mesopredator release), increasing predation pressure on small mammals and ground-nesting birds.",
      "Stream bank erosion increases as willow root systems decline, degrading water quality and aquatic habitat for fish and amphibians (loss of ecosystem engineering)."
    ],
    "question": "How does the removal of a single apex predator species trigger a trophic cascade affecting producers, herbivores, mesopredators, and even abiotic factors like stream morphology? Consider both direct (consumptive) and indirect (behavioral) effects in your answer."
  },
  "gradeBand": "6-8"
}

Now generate a habitat diorama for "${topic}" at grade level ${gradeBand}.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: habitatDioramaSchema,
        systemInstruction: `You are an expert ecology educator specializing in K-8 life sciences and environmental education. You create engaging, scientifically accurate habitat dioramas that scale appropriately by grade level. You understand food webs, trophic cascades, symbiotic relationships, and ecosystem dynamics. You make ecology exciting and accessible while maintaining ecological rigor. You excel at creating "aha moments" where students discover how ecosystems are interconnected systems, not just collections of organisms.`,
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API");
    }

    const result = JSON.parse(text) as HabitatDioramaData;

    // Merge with any config overrides
    const finalData: HabitatDioramaData = {
      ...result,
      ...config,
    };

    console.log('🌳 Habitat Diorama Generated:', {
      habitat: finalData.habitat.name,
      biome: finalData.habitat.biome,
      organisms: finalData.organisms.length,
      relationships: finalData.relationships.length,
      features: finalData.environmentalFeatures.length,
      hasDisruption: !!finalData.disruptionScenario,
      gradeBand: finalData.gradeBand
    });

    return finalData;

  } catch (error) {
    console.error("Error generating habitat diorama:", error);
    throw error;
  }
};
