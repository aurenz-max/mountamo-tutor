import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

// Import the data type from the component (single source of truth)
import { ProcessAnimatorData } from "../../primitives/visual-primitives/biology/ProcessAnimator";

/**
 * Schema definition for Process Animator Data
 *
 * This schema defines the structure for step-through biological process animations,
 * covering photosynthesis, cellular respiration, digestion, blood flow, pollination,
 * germination, and other multi-step biological processes.
 *
 * The primitive follows the PRD specification for "Process Animator" from
 * the biology primitives document - it teaches sequential processes through
 * narrated animations with comprehension checkpoints.
 */
const processAnimatorSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    processName: {
      type: Type.STRING,
      description: "Name of the biological process (e.g., 'Photosynthesis', 'Cellular Respiration', 'Digestion')"
    },
    overview: {
      type: Type.STRING,
      description: "2-3 sentence overview of what this process does and why it matters"
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
          order: {
            type: Type.INTEGER,
            description: "Sequential order of this stage (0-based index)"
          },
          title: {
            type: Type.STRING,
            description: "Name of this stage (e.g., 'Light-Dependent Reactions', 'Glycolysis', 'Ingestion')"
          },
          narration: {
            type: Type.STRING,
            description: "Detailed 3-4 sentence explanation of what happens during this stage"
          },
          visualDescription: {
            type: Type.STRING,
            description: "Concise description for visual representation (what the animation should show)"
          },
          keyMolecules: {
            type: Type.ARRAY,
            items: {
              type: Type.STRING
            },
            description: "Important molecules involved in this stage (e.g., ['ATP', 'NADPH', 'Glucose']), null if not applicable",
            nullable: true
          },
          energyChange: {
            type: Type.STRING,
            description: "Energy transformation in this stage (e.g., 'ATP is consumed', 'Light energy is captured'), null if not applicable",
            nullable: true
          },
          duration: {
            type: Type.STRING,
            description: "How long this stage typically takes (e.g., 'milliseconds', '20-30 minutes', 'several hours'), null if not applicable",
            nullable: true
          }
        },
        required: ["id", "order", "title", "narration", "visualDescription"]
      },
      description: "Array of 3-8 sequential stages in the process"
    },
    checkpoints: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          afterStageId: {
            type: Type.STRING,
            description: "ID of the stage after which this checkpoint appears"
          },
          question: {
            type: Type.STRING,
            description: "Comprehension question about the process so far"
          },
          options: {
            type: Type.ARRAY,
            items: {
              type: Type.STRING
            },
            description: "3-4 answer choices"
          },
          correctIndex: {
            type: Type.INTEGER,
            description: "Index of the correct answer (0-based)"
          },
          explanation: {
            type: Type.STRING,
            description: "Explanation of why this answer is correct and why others are wrong"
          }
        },
        required: ["afterStageId", "question", "options", "correctIndex", "explanation"]
      },
      description: "1-3 checkpoint questions embedded at key moments in the process"
    },
    inputs: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING
      },
      description: "What goes into this process (e.g., ['Carbon dioxide', 'Water', 'Light energy'])"
    },
    outputs: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING
      },
      description: "What comes out of this process (e.g., ['Glucose', 'Oxygen'])"
    },
    equation: {
      type: Type.STRING,
      description: "Chemical equation for the process (e.g., '6CO2 + 6H2O → C6H12O6 + 6O2'), null if not applicable",
      nullable: true
    },
    scale: {
      type: Type.STRING,
      enum: ["molecular", "cellular", "organ", "organism", "ecosystem"],
      description: "The scale at which this process operates"
    },
    gradeBand: {
      type: Type.STRING,
      enum: ["2-4", "5-6", "7-8"],
      description: "Target grade band - determines vocabulary and complexity"
    }
  },
  required: ["processName", "overview", "stages", "checkpoints", "inputs", "outputs", "equation", "scale", "gradeBand"]
};

/**
 * Generate process animator data using Gemini AI
 *
 * This function creates interactive step-through animations for biology education.
 * Students control playback and answer comprehension checkpoints embedded at key moments.
 *
 * Covers:
 * - Photosynthesis, cellular respiration, fermentation
 * - Digestion, blood circulation, breathing
 * - Pollination, germination, transpiration
 * - Protein synthesis, DNA replication
 * - Any multi-step biological process
 *
 * @param topic - The process to animate (e.g., "photosynthesis", "digestion", "protein synthesis")
 * @param gradeBand - Grade level ('2-4', '5-6', or '7-8') determines complexity
 * @param config - Optional partial configuration to override generated values
 * @returns ProcessAnimatorData with narrated stages and checkpoint questions
 */
export const generateProcessAnimator = async (
  topic: string,
  gradeBand: '2-4' | '5-6' | '7-8' = '5-6',
  config?: Partial<ProcessAnimatorData>
): Promise<ProcessAnimatorData> => {

  // Grade-specific vocabulary and complexity instructions
  const gradeContext = {
    '2-4': `
GRADE 2-4 GUIDELINES:
- Use simple, concrete vocabulary (avoid technical jargon)
- Keep narrations SHORT (2-3 simple sentences per stage)
- Use 3-5 stages maximum (manageable for younger learners)
- Focus on observable processes students can understand
- Use familiar analogies and everyday language
- Make it exciting and engaging with vivid descriptions
- Checkpoints should test basic understanding ("What happens next?")
- Molecular details should be minimal or absent
- Duration can be approximate ("a few minutes", "about an hour")
`,
    '5-6': `
GRADE 5-6 GUIDELINES:
- Introduce scientific vocabulary WITH explanations
- Use 4-6 stages for good depth
- Include scientific terms but define them clearly
- Explain WHY changes happen, not just WHAT changes
- Use precise time durations when known
- Connect to familiar student experiences
- Can introduce molecular concepts (ATP, glucose, oxygen)
- Checkpoints should test causal understanding ("Why does this happen?")
- Include some energy transformation language
`,
    '7-8': `
GRADE 7-8 GUIDELINES:
- Use proper scientific terminology
- Can handle 5-8 stages with complex relationships
- Include molecular and cellular details where appropriate
- Explain mechanisms and causation precisely
- Use exact time durations with scientific units
- Connect to broader biological concepts (energy, matter flow, cellular respiration)
- Can handle complex biochemical processes (Krebs cycle, electron transport chain)
- Checkpoints should test conceptual understanding and application
- Provide rigorous, academically appropriate content
- Include chemical equations and molecular formulas
`
  };

  // Determine scale based on topic keywords
  const scaleKeywords: Record<string, string> = {
    'photosynthesis': 'cellular',
    'respiration': 'cellular',
    'fermentation': 'cellular',
    'glycolysis': 'molecular',
    'krebs': 'molecular',
    'electron transport': 'molecular',
    'digestion': 'organ',
    'circulation': 'organ',
    'breathing': 'organ',
    'excretion': 'organ',
    'transpiration': 'organism',
    'pollination': 'organism',
    'germination': 'organism',
    'nutrient cycling': 'ecosystem',
    'carbon cycle': 'ecosystem',
    'nitrogen cycle': 'ecosystem',
  };

  let inferredScale = 'cellular'; // default
  const topicLower = topic.toLowerCase();
  for (const [keyword, scale] of Object.entries(scaleKeywords)) {
    if (topicLower.includes(keyword)) {
      inferredScale = scale;
      break;
    }
  }

  const generationPrompt = `Create an educational process animator for: "${topic}".

TARGET GRADE BAND: ${gradeBand}

${gradeContext[gradeBand]}

SCALE: ${inferredScale}
- molecular: Biochemical reactions at molecular level
- cellular: Processes within cells
- organ: Processes within organ systems
- organism: Processes at whole organism level
- ecosystem: Processes involving multiple organisms/environment

REQUIRED INFORMATION:

1. **Process Name**: Clear, concise name (e.g., "Photosynthesis", "Human Digestion")

2. **Overview**: 2-3 sentences explaining what this process does and why it matters

3. **Stages** (${gradeBand === '2-4' ? '3-5' : gradeBand === '5-6' ? '4-6' : '5-8'} stages):
   For each stage:
   - **id**: Unique identifier (stage1, stage2, etc.)
   - **order**: Sequential position (0 for first, 1 for second, etc.)
   - **title**: Name of the stage (e.g., "Light-Dependent Reactions", "Glycolysis")
   - **narration**: Detailed 3-4 sentence explanation of what happens
   - **visualDescription**: What the animation should show
   - **keyMolecules**: Array of important molecules (e.g., ["ATP", "NADPH", "Glucose"]), null if not applicable
   - **energyChange**: Energy transformation (e.g., "ATP is consumed", "Light energy is captured"), null if not applicable
   - **duration**: How long this stage takes, null if not applicable

4. **Checkpoints** (1-3 questions):
   Embed comprehension questions at key moments:
   - **afterStageId**: Which stage this checkpoint follows
   - **question**: Clear comprehension question
   - **options**: 3-4 answer choices
   - **correctIndex**: Index of correct answer (0-based)
   - **explanation**: Why this answer is correct

5. **Inputs**: What goes into the process (e.g., ["Carbon dioxide", "Water", "Light energy"])

6. **Outputs**: What comes out (e.g., ["Glucose", "Oxygen"])

7. **Equation**: Chemical equation if applicable (e.g., "6CO2 + 6H2O → C6H12O6 + 6O2"), null if not applicable

8. **Scale**: ${inferredScale}

9. **Grade Band**: ${gradeBand}

EXAMPLE - Photosynthesis (Grade 5-6):
{
  "processName": "Photosynthesis",
  "overview": "Photosynthesis is how plants make their own food using sunlight, water, and carbon dioxide. This process happens in the chloroplasts of plant cells and produces glucose (sugar) and oxygen. It's one of the most important processes on Earth because it provides food and oxygen for almost all living things.",
  "stages": [
    {
      "id": "stage1",
      "order": 0,
      "title": "Light Absorption",
      "narration": "Sunlight hits the chlorophyll in the plant's leaves. Chlorophyll is a green pigment that acts like a solar panel, capturing light energy. This energy excites electrons in the chlorophyll molecules, starting the whole process.",
      "visualDescription": "Sunlight beams hitting green chloroplast structures, with energy waves being absorbed",
      "keyMolecules": ["Chlorophyll", "Photons"],
      "energyChange": "Light energy is captured and converted to chemical energy",
      "duration": "Happens instantly when light is available"
    },
    {
      "id": "stage2",
      "order": 1,
      "title": "Water Splitting",
      "narration": "The captured light energy is used to split water molecules (H2O) into hydrogen and oxygen. The oxygen is released as a waste product (the oxygen we breathe!). The hydrogen is saved for later steps.",
      "visualDescription": "Water molecules being split apart, with oxygen bubbles escaping and hydrogen being captured",
      "keyMolecules": ["H2O", "O2", "H+ ions"],
      "energyChange": "Light energy breaks chemical bonds in water",
      "duration": "Occurs within milliseconds"
    },
    {
      "id": "stage3",
      "order": 2,
      "title": "Energy Storage (ATP Production)",
      "narration": "The plant creates energy-storing molecules called ATP and NADPH. These are like rechargeable batteries that the plant will use in the next steps. This stage is called the light-dependent reactions because it needs sunlight.",
      "visualDescription": "Energy being stored in ATP and NADPH molecules, shown as glowing battery-like structures",
      "keyMolecules": ["ATP", "NADPH"],
      "energyChange": "Chemical energy is stored in ATP and NADPH",
      "duration": "Continues as long as light is available"
    },
    {
      "id": "stage4",
      "order": 3,
      "title": "Carbon Fixation (Calvin Cycle)",
      "narration": "The plant uses the ATP and NADPH energy to convert carbon dioxide from the air into glucose (sugar). This happens in a cycle called the Calvin Cycle. Unlike the earlier steps, this stage doesn't need direct sunlight—just the energy stored in ATP and NADPH.",
      "visualDescription": "Carbon dioxide molecules being assembled into glucose molecules using ATP and NADPH energy",
      "keyMolecules": ["CO2", "ATP", "NADPH", "Glucose"],
      "energyChange": "ATP and NADPH energy is used to build glucose",
      "duration": "Each cycle takes about 1-2 minutes"
    }
  ],
  "checkpoints": [
    {
      "afterStageId": "stage2",
      "question": "What happens to the oxygen produced when water is split?",
      "options": [
        "It is released into the air as a waste product",
        "It is used to make glucose",
        "It is stored in the chloroplast for later",
        "It combines with carbon dioxide"
      ],
      "correctIndex": 0,
      "explanation": "The oxygen from splitting water is released into the air as a waste product. This is the oxygen we breathe! The plant doesn't need it for photosynthesis, but it's essential for most life on Earth."
    },
    {
      "afterStageId": "stage4",
      "question": "Why is the Calvin Cycle called 'light-independent'?",
      "options": [
        "It happens at night when there is no light",
        "It uses stored energy (ATP and NADPH) instead of direct sunlight",
        "It doesn't need any energy at all",
        "It happens in a different part of the plant"
      ],
      "correctIndex": 1,
      "explanation": "The Calvin Cycle is called light-independent because it doesn't need direct sunlight to work. It uses the ATP and NADPH energy that was created in the earlier light-dependent stages. So it CAN happen at night as long as the plant has stored energy!"
    }
  ],
  "inputs": ["Carbon dioxide (CO2)", "Water (H2O)", "Light energy"],
  "outputs": ["Glucose (C6H12O6)", "Oxygen (O2)"],
  "equation": "6CO2 + 6H2O + Light Energy → C6H12O6 + 6O2",
  "scale": "cellular",
  "gradeBand": "5-6"
}

CHECKPOINT QUESTION GUIDELINES:
- Place checkpoints at key conceptual moments (after major stages)
- Questions should test understanding of mechanisms, not just recall
- Options should include common misconceptions as distractors
- Explanations should address why the correct answer is right AND why common wrong answers are incorrect
- Grade 2-4: Basic recall ("What happens next?", "What is produced?")
- Grade 5-6: Causal understanding ("Why does this happen?", "What is the purpose of X?")
- Grade 7-8: Application and synthesis ("What would happen if X was removed?", "How does this relate to Y?")

Now generate a process animator for "${topic}" at grade level ${gradeBand}.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: processAnimatorSchema,
        systemInstruction: `You are an expert biology educator specializing in grades 2-8 life sciences. You create engaging, scientifically accurate process animations that teach multi-step biological processes. You understand developmental psychology and choose vocabulary, complexity, and content depth appropriate for each age group. You design comprehension checkpoints that test conceptual understanding, not just recall. You make biological processes exciting and accessible while maintaining scientific rigor.`,
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API");
    }

    const result = JSON.parse(text) as ProcessAnimatorData;

    // Validate that stages exist
    if (!result || !result.stages || !Array.isArray(result.stages) || result.stages.length === 0) {
      console.error('❌ Invalid response from Gemini API - missing stages array:', result);
      throw new Error('Invalid response from Gemini API: missing or invalid stages array');
    }

    // Validate that checkpoints exist
    if (!result.checkpoints || !Array.isArray(result.checkpoints)) {
      console.error('❌ Invalid response from Gemini API - missing checkpoints array:', result);
      throw new Error('Invalid response from Gemini API: missing or invalid checkpoints array');
    }

    // Merge with any config overrides
    const finalData: ProcessAnimatorData = {
      ...result,
      ...config,
      // Ensure stages and checkpoints are not overridden unless explicitly provided
      stages: config?.stages || result.stages,
      checkpoints: config?.checkpoints || result.checkpoints,
    };

    console.log('🎬 Process Animator Generated:', {
      processName: finalData.processName,
      stageCount: finalData.stages?.length || 0,
      checkpointCount: finalData.checkpoints?.length || 0,
      scale: finalData.scale,
      gradeBand: finalData.gradeBand,
    });

    return finalData;

  } catch (error) {
    console.error("Error generating process animator:", error);
    throw error;
  }
};
