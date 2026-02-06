import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

// Import the data type from the component (single source of truth)
import { LifeCycleSequencerData } from "../../primitives/visual-primitives/biology/LifeCycleSequencer";

/**
 * Schema definition for Life Cycle Sequencer Data
 *
 * This schema defines the structure for temporal sequencing activities,
 * covering organismal life cycles, cellular processes, and ecological cycles.
 *
 * The primitive follows the PRD specification for "Life Cycle Sequencer" from
 * the biology primitives document - it teaches temporal relationships and
 * transformation through interactive drag-and-drop sequencing.
 */
const lifeCycleSequencerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title of the life cycle activity (e.g., 'Life Cycle of a Butterfly', 'The Water Cycle')"
    },
    instructions: {
      type: Type.STRING,
      description: "Clear instructions for students (e.g., 'Drag the stages into the correct order from start to finish')"
    },
    cycleType: {
      type: Type.STRING,
      enum: ["linear", "circular"],
      description: "linear for developmental sequences (embryo → adult), circular for repeating cycles (water cycle, cell cycle)"
    },
    stages: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique identifier (e.g., 'stage1', 'stage2')"
          },
          label: {
            type: Type.STRING,
            description: "Name of this stage (e.g., 'Egg', 'Larva', 'Pupa', 'Adult')"
          },
          imagePrompt: {
            type: Type.STRING,
            description: "Concise visual description for image generation"
          },
          description: {
            type: Type.STRING,
            description: "2-3 sentences describing what happens during this stage"
          },
          correctPosition: {
            type: Type.INTEGER,
            description: "0-indexed position in the correct sequence"
          },
          transitionToNext: {
            type: Type.STRING,
            description: "What changes or happens between this stage and the next (e.g., 'The egg hatches into a caterpillar')"
          },
          duration: {
            type: Type.STRING,
            description: "How long this stage typically lasts (e.g., '3-5 days', '2 weeks', 'several years'), null if not applicable"
          }
        },
        required: ["id", "label", "imagePrompt", "description", "correctPosition", "transitionToNext", "duration"]
      },
      description: "Array of 4-8 stages in the life cycle (shuffled for student)"
    },
    scaleContext: {
      type: Type.STRING,
      description: "Overall time context (e.g., 'This process takes about 30 days', 'Each division takes ~1 hour')"
    },
    misconceptionTrap: {
      type: Type.OBJECT,
      properties: {
        commonError: {
          type: Type.STRING,
          description: "A common mistake students make with this cycle (e.g., 'Students often think the pupa is a resting stage')"
        },
        correction: {
          type: Type.STRING,
          description: "The correct understanding (e.g., 'The pupa is actually very active inside—major body changes are happening!')"
        }
      },
      required: ["commonError", "correction"]
    },
    gradeBand: {
      type: Type.STRING,
      enum: ["K-2", "3-5", "6-8"],
      description: "Target grade band - determines vocabulary and complexity"
    }
  },
  required: ["title", "instructions", "cycleType", "stages", "scaleContext", "misconceptionTrap", "gradeBand"]
};

/**
 * Generate life cycle sequencer data using Gemini AI
 *
 * This function creates interactive temporal sequencing activities for biology education.
 * Students arrange stages of a biological process in correct temporal order.
 *
 * Covers:
 * - Organismal life cycles (frog, butterfly, plant, human)
 * - Cellular processes (mitosis phases, meiosis)
 * - Ecological cycles (water, carbon, nitrogen, rock cycle)
 *
 * @param topic - The cycle or process to sequence (e.g., "butterfly metamorphosis", "frog life cycle", "water cycle")
 * @param gradeBand - Grade level ('K-2', '3-5', or '6-8') determines complexity
 * @param config - Optional partial configuration to override generated values
 * @returns LifeCycleSequencerData with temporal sequencing activity
 */
export const generateLifeCycleSequencer = async (
  topic: string,
  gradeBand: 'K-2' | '3-5' | '6-8' = '3-5',
  config?: Partial<LifeCycleSequencerData>
): Promise<LifeCycleSequencerData> => {

  // Grade-specific vocabulary and complexity instructions
  const gradeContext = {
    'K-2': `
GRADE K-2 GUIDELINES:
- Use simple, concrete vocabulary (avoid scientific jargon)
- Keep descriptions SHORT (1-2 simple sentences per stage)
- Use 4-6 stages maximum (too many overwhelms young learners)
- Focus on observable, visible changes students can see
- Use familiar comparisons and everyday language
- Make it exciting and engaging with vivid descriptions
- Circular cycles should be simple (water cycle, day/night)
- Linear sequences should be straightforward (plant growth, butterfly)
- Duration can be approximate ("a few days", "about a week")
`,
    '3-5': `
GRADE 3-5 GUIDELINES:
- Introduce scientific vocabulary WITH explanations
- Use 5-7 stages for good depth without overwhelming
- Include scientific terms but define them clearly
- Explain WHY changes happen, not just WHAT changes
- Use precise time durations when known
- Connect stages to familiar student experiences
- Can handle more complex cycles (nitrogen cycle, moon phases)
- Transitions should explain the mechanism of change
- Include interesting facts about each stage
`,
    '6-8': `
GRADE 6-8 GUIDELINES:
- Use proper scientific terminology
- Can handle 6-8 stages with complex relationships
- Include cellular/molecular details where appropriate
- Explain mechanisms and causation precisely
- Use exact time durations with scientific units
- Connect to broader biological concepts (energy, matter, evolution)
- Handle complex cycles (Krebs cycle, cell cycle with checkpoints, rock cycle)
- Transitions should explain biochemical/physical mechanisms
- Provide rigorous, academically appropriate content
`
  };

  // Determine if this should be linear or circular based on topic keywords
  const circularKeywords = [
    'cycle', 'water', 'carbon', 'nitrogen', 'rock', 'seasons', 'moon',
    'cell cycle', 'krebs', 'calvin', 'circular'
  ];
  const isCircular = circularKeywords.some(keyword =>
    topic.toLowerCase().includes(keyword.toLowerCase())
  );
  const defaultCycleType = isCircular ? 'circular' : 'linear';

  const generationPrompt = `Create an educational life cycle sequencer for: "${topic}".

TARGET GRADE BAND: ${gradeBand}

${gradeContext[gradeBand]}

CYCLE TYPE: ${defaultCycleType}
- Use "circular" for repeating cycles (water cycle, cell division, seasons)
- Use "linear" for developmental sequences (embryo to adult, seed to plant)

REQUIRED INFORMATION:

1. **Title**: Clear, engaging title (e.g., "Life Cycle of a Butterfly", "The Water Cycle")

2. **Instructions**: Simple, clear instructions for students
   - K-2: "Put the pictures in order from start to finish"
   - 3-5: "Drag the stages into the correct order from start to finish"
   - 6-8: "Sequence these stages in the correct temporal order"

3. **Stages** (${gradeBand === 'K-2' ? '4-6' : gradeBand === '3-5' ? '5-7' : '6-8'} stages):
   For each stage:
   - **id**: Unique identifier (stage1, stage2, etc.)
   - **label**: Name of the stage (e.g., "Egg", "Tadpole", "Adult Frog")
   - **imagePrompt**: Concise visual description for image generation
   - **description**: What happens during this stage (2-3 sentences)
   - **correctPosition**: 0-indexed position (0 for first, 1 for second, etc.)
   - **transitionToNext**: What changes between this stage and the next
   - **duration**: How long this stage lasts (null if not applicable)

4. **Scale Context**: Overall time context
   - Examples: "This complete cycle takes about 6-8 weeks", "One full cycle takes 24 hours", "Each cell division takes about 90 minutes"

5. **Misconception Trap**: Identify ONE common student misconception
   - **commonError**: What students often get wrong
   - **correction**: The correct scientific understanding
   - Examples:
     * Butterfly: "Students think the pupa is 'sleeping'" → "The pupa is actually very active inside!"
     * Water cycle: "Students think evaporation only happens from oceans" → "Evaporation happens from all water surfaces, including puddles and leaves!"
     * Frog: "Students think tadpoles just grow legs and become frogs" → "Tadpoles undergo metamorphosis, losing their tail and gills while growing legs and lungs!"

6. **Grade Band**: ${gradeBand}

EXAMPLES:

**K-2 Example - Plant Life Cycle**:
{
  "title": "How a Bean Plant Grows",
  "instructions": "Put the pictures in order to show how a bean plant grows!",
  "cycleType": "circular",
  "stages": [
    {
      "id": "stage1",
      "label": "Seed",
      "imagePrompt": "A brown bean seed in soil",
      "description": "The seed is planted in the soil. It has food inside to help it grow.",
      "correctPosition": 0,
      "transitionToNext": "Water and warmth make the seed start to grow",
      "duration": "1-2 days"
    },
    {
      "id": "stage2",
      "label": "Sprout",
      "imagePrompt": "A tiny green sprout poking out of the soil",
      "description": "A tiny plant pokes up through the soil. It has a small stem and leaves.",
      "correctPosition": 1,
      "transitionToNext": "The sprout grows bigger and taller",
      "duration": "5-7 days"
    },
    {
      "id": "stage3",
      "label": "Growing Plant",
      "imagePrompt": "A young bean plant with several green leaves",
      "description": "The plant grows taller with more leaves. It uses sunlight to make food.",
      "correctPosition": 2,
      "transitionToNext": "Flowers start to grow on the plant",
      "duration": "2-3 weeks"
    },
    {
      "id": "stage4",
      "label": "Flowering Plant",
      "imagePrompt": "A bean plant with white flowers blooming",
      "description": "Pretty flowers bloom on the plant. Bees visit the flowers.",
      "correctPosition": 3,
      "transitionToNext": "The flowers turn into bean pods",
      "duration": "1 week"
    },
    {
      "id": "stage5",
      "label": "Bean Pods",
      "imagePrompt": "A bean plant with green bean pods hanging from it",
      "description": "Green bean pods grow where the flowers were. New seeds grow inside the pods.",
      "correctPosition": 4,
      "transitionToNext": "The pods dry out and release new seeds",
      "duration": "2-3 weeks"
    }
  ],
  "scaleContext": "It takes about 8-10 weeks for a bean plant to grow from seed to seed",
  "misconceptionTrap": {
    "commonError": "Students often think plants eat soil like we eat food",
    "correction": "Plants actually make their own food from sunlight, air, and water! Soil provides minerals and water, but sunlight is their main 'food'."
  },
  "gradeBand": "K-2"
}

**3-5 Example - Butterfly Metamorphosis**:
{
  "title": "Complete Metamorphosis of a Monarch Butterfly",
  "instructions": "Drag the stages into the correct order to show how a caterpillar transforms into a butterfly",
  "cycleType": "linear",
  "stages": [
    {
      "id": "stage1",
      "label": "Egg",
      "imagePrompt": "A tiny white egg attached to the underside of a milkweed leaf",
      "description": "The female butterfly lays a tiny egg on a milkweed leaf. The egg is about the size of a pinhead and contains a developing caterpillar embryo.",
      "correctPosition": 0,
      "transitionToNext": "The egg hatches and a tiny caterpillar emerges",
      "duration": "3-5 days"
    },
    {
      "id": "stage2",
      "label": "Larva (Caterpillar)",
      "imagePrompt": "A black, white, and yellow striped caterpillar eating a green milkweed leaf",
      "description": "The caterpillar hatches and immediately starts eating milkweed leaves. It grows quickly, shedding its skin 5 times as it gets bigger. The caterpillar stores energy for the big change ahead.",
      "correctPosition": 1,
      "transitionToNext": "The caterpillar forms a chrysalis around itself",
      "duration": "9-14 days"
    },
    {
      "id": "stage3",
      "label": "Pupa (Chrysalis)",
      "imagePrompt": "A green chrysalis with gold dots hanging from a leaf",
      "description": "Inside the chrysalis, the caterpillar's body completely reorganizes. Special cells break down the caterpillar body and rebuild it into a butterfly. Wings, antennae, and new body parts form.",
      "correctPosition": 2,
      "transitionToNext": "The butterfly emerges from the chrysalis",
      "duration": "8-12 days"
    },
    {
      "id": "stage4",
      "label": "Adult Butterfly",
      "imagePrompt": "An orange and black monarch butterfly with wings spread, perched on a flower",
      "description": "The adult butterfly breaks out of the chrysalis with wet, crumpled wings. It pumps fluid into its wings to expand them, then waits for them to dry and harden. Now it can fly, drink nectar, and lay eggs to start the cycle again.",
      "correctPosition": 3,
      "transitionToNext": "The adult butterfly lays eggs on milkweed plants",
      "duration": "2-6 weeks"
    }
  ],
  "scaleContext": "Complete metamorphosis from egg to adult takes about 4-6 weeks",
  "misconceptionTrap": {
    "commonError": "Students often think the chrysalis is a resting stage where the caterpillar sleeps and grows wings",
    "correction": "The chrysalis is actually the MOST active stage! Inside, the caterpillar's body completely breaks down and rebuilds itself into a butterfly. It's one of nature's most amazing transformations!"
  },
  "gradeBand": "3-5"
}

**6-8 Example - Mitosis (Cell Division)**:
{
  "title": "Mitosis: The Cell Division Cycle",
  "instructions": "Sequence these phases of mitosis in the correct temporal order",
  "cycleType": "circular",
  "stages": [
    {
      "id": "stage1",
      "label": "Interphase",
      "imagePrompt": "A cell with visible nucleus containing dispersed chromatin and active cellular processes",
      "description": "The cell grows, carries out normal functions, and replicates its DNA. Chromatin is loosely dispersed in the nucleus. The cell spends most of its life in this phase, preparing for division by duplicating organelles and synthesizing proteins.",
      "correctPosition": 0,
      "transitionToNext": "DNA condenses into visible chromosomes as prophase begins",
      "duration": "90% of cell cycle (hours to days depending on cell type)"
    },
    {
      "id": "stage2",
      "label": "Prophase",
      "imagePrompt": "A cell with condensed chromosomes visible and centrioles moving to opposite poles",
      "description": "Chromatin condenses into visible X-shaped chromosomes (each made of two sister chromatids). The nuclear envelope begins to break down. Centrioles move to opposite poles and begin forming the mitotic spindle of microtubules.",
      "correctPosition": 1,
      "transitionToNext": "Chromosomes align at the cell's equator during metaphase",
      "duration": "30-60 minutes"
    },
    {
      "id": "stage3",
      "label": "Metaphase",
      "imagePrompt": "Chromosomes aligned in a single line at the cell's equator with spindle fibers attached",
      "description": "Chromosomes line up along the cell's equator (metaphase plate). Spindle fibers from both poles attach to the centromere of each chromosome at the kinetochore. The cell checks that all chromosomes are properly attached before proceeding (spindle checkpoint).",
      "correctPosition": 2,
      "transitionToNext": "Sister chromatids separate and move to opposite poles in anaphase",
      "duration": "5-15 minutes"
    },
    {
      "id": "stage4",
      "label": "Anaphase",
      "imagePrompt": "Sister chromatids being pulled apart to opposite ends of the cell",
      "description": "The centromeres split, separating sister chromatids. Spindle fibers shorten, pulling the separated chromatids (now individual chromosomes) toward opposite poles of the cell. This ensures each new cell will receive an identical set of chromosomes.",
      "correctPosition": 3,
      "transitionToNext": "Nuclear envelopes reform around each set of chromosomes in telophase",
      "duration": "3-5 minutes"
    },
    {
      "id": "stage5",
      "label": "Telophase",
      "imagePrompt": "Two sets of chromosomes at opposite poles with nuclear envelopes reforming and a cleavage furrow forming",
      "description": "Nuclear envelopes reform around each set of chromosomes at opposite poles. Chromosomes begin to decondense back into chromatin. The spindle apparatus disassembles. A cleavage furrow forms as the cell membrane pinches inward.",
      "correctPosition": 4,
      "transitionToNext": "Cytokinesis divides the cytoplasm to form two separate daughter cells",
      "duration": "10-30 minutes"
    },
    {
      "id": "stage6",
      "label": "Cytokinesis",
      "imagePrompt": "A cell completely pinched in the middle forming two identical daughter cells",
      "description": "The cytoplasm divides, creating two separate daughter cells. In animal cells, a contractile ring of actin filaments pinches the cell in two. Each daughter cell receives identical genetic information and approximately half the organelles. Both cells enter interphase.",
      "correctPosition": 5,
      "transitionToNext": "Daughter cells enter interphase and the cycle begins again",
      "duration": "Overlaps with telophase, 10-30 minutes"
    }
  ],
  "scaleContext": "One complete cell cycle (mitosis + interphase) takes approximately 24 hours in human cells, though this varies by cell type",
  "misconceptionTrap": {
    "commonError": "Students often think mitosis and cytokinesis are the same thing, or that cell division happens instantly",
    "correction": "Mitosis is ONLY the division of the nucleus (prophase through telophase), while cytokinesis is the separate process of dividing the cytoplasm. Together they form cell division, but they are distinct processes that overlap in timing."
  },
  "gradeBand": "6-8"
}

Now generate a life cycle sequencer for "${topic}" at grade level ${gradeBand}.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: lifeCycleSequencerSchema,
        systemInstruction: `You are an expert biology educator specializing in K-8 life sciences. You create engaging, scientifically accurate sequencing activities that teach temporal relationships and biological transformations. You understand developmental psychology and choose vocabulary, complexity, and content depth appropriate for each age group. You make life cycles and biological processes exciting and accessible while maintaining scientific rigor. You always identify common student misconceptions and provide clear corrections.`,
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API");
    }

    const result = JSON.parse(text) as LifeCycleSequencerData;

    // Validate that stages exist
    if (!result || !result.stages || !Array.isArray(result.stages)) {
      console.error('❌ Invalid response from Gemini API - missing stages array:', result);
      throw new Error('Invalid response from Gemini API: missing or invalid stages array');
    }

    // Merge with any config overrides
    const finalData: LifeCycleSequencerData = {
      ...result,
      ...config,
      // Ensure stages are not overridden unless explicitly provided
      stages: config.stages || result.stages,
    };

    console.log('🔄 Life Cycle Sequencer Generated:', {
      title: finalData.title,
      cycleType: finalData.cycleType,
      stageCount: finalData.stages?.length || 0,
      gradeBand: finalData.gradeBand,
      hasStages: !!finalData.stages,
    });

    return finalData;

  } catch (error) {
    console.error("Error generating life cycle sequencer:", error);
    throw error;
  }
};
