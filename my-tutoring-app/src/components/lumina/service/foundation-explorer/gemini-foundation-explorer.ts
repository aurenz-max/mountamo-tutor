import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { FoundationExplorerData, FoundationConcept } from "../../types";

/**
 * Schema for a single foundational concept
 */
const foundationConceptSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: {
      type: Type.STRING,
      description: "Unique identifier for the concept (e.g., 'fulcrum', 'load', 'effort')"
    },
    name: {
      type: Type.STRING,
      description: "Display name of the concept (e.g., 'Fulcrum')"
    },
    briefDefinition: {
      type: Type.STRING,
      description: "ONE sentence definition. Keep it simple and concrete for the grade level. Example: 'The balance point that holds up the lever.'"
    },
    diagramHighlight: {
      type: Type.STRING,
      description: "Description of where to find this concept in the diagram (e.g., 'The triangle in the center of the lever')"
    },
    inContext: {
      type: Type.OBJECT,
      properties: {
        scenario: {
          type: Type.STRING,
          description: "A relatable, real-world scenario (1-2 sentences). Example: 'On a seesaw at the playground...'"
        },
        whereToFind: {
          type: Type.STRING,
          description: "Where to find this concept in the scenario. Example: 'The fulcrum is the center post that the seesaw sits on.'"
        }
      },
      required: ["scenario", "whereToFind"]
    },
    selfCheck: {
      type: Type.OBJECT,
      properties: {
        prompt: {
          type: Type.STRING,
          description: "A question the student can use to check understanding. Should match the objective verb. IDENTIFY: 'Can you point to...?' EXPLAIN: 'Can you tell why...?' APPLY: 'Where would you use...?'"
        },
        hint: {
          type: Type.STRING,
          description: "A helpful hint if they're stuck. Don't give away the answer directly."
        }
      },
      required: ["prompt", "hint"]
    },
    color: {
      type: Type.STRING,
      description: "Hex color for visual identity (e.g., '#3B82F6' blue, '#10B981' green, '#F59E0B' amber, '#EF4444' red, '#8B5CF6' purple)"
    }
  },
  required: ["id", "name", "briefDefinition", "diagramHighlight", "inContext", "selfCheck", "color"]
};

/**
 * Schema for Foundation Explorer data
 */
const foundationExplorerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    objectiveId: {
      type: Type.STRING,
      description: "ID of the learning objective this serves (from manifest config)"
    },
    objectiveText: {
      type: Type.STRING,
      description: "Full text of the learning objective"
    },
    objectiveVerb: {
      type: Type.STRING,
      enum: ["identify", "explain", "apply", "analyze", "compare"],
      description: "Bloom's taxonomy verb that drives the self-check style"
    },
    diagram: {
      type: Type.OBJECT,
      properties: {
        description: {
          type: Type.STRING,
          description: "What the diagram shows (e.g., 'A simple lever with all three parts labeled: fulcrum, load, and effort')"
        },
        imagePrompt: {
          type: Type.STRING,
          description: "Detailed prompt for AI image generation. Should describe a clean, educational schematic diagram. Example: 'Clean educational diagram of a lever/seesaw showing: a horizontal beam balanced on a triangular fulcrum in the center, a heavy box (load) on the left side, a hand pushing down (effort) on the right side. Labels pointing to each part. Simple line art style, dark background, white/blue lines.'"
        },
        style: {
          type: Type.STRING,
          enum: ["schematic", "realistic", "animated"],
          description: "Visual style. Use 'schematic' for clear educational diagrams (recommended), 'realistic' for real-world photos, 'animated' for dynamic visuals."
        }
      },
      required: ["description", "imagePrompt", "style"]
    },
    concepts: {
      type: Type.ARRAY,
      items: foundationConceptSchema,
      description: "The foundational concepts to teach (2-4 concepts). Each should be a key term or component students need to IDENTIFY, EXPLAIN, or APPLY."
    },
    themeColor: {
      type: Type.STRING,
      description: "Primary accent color for the component (hex code)"
    }
  },
  required: ["objectiveId", "objectiveText", "objectiveVerb", "diagram", "concepts", "themeColor"]
};

/**
 * Generate Foundation Explorer content for teaching foundational concepts
 *
 * This primitive is designed to bridge from learning objectives (in CuratorBrief)
 * to actual concept mastery. It:
 * 1. Shows a central diagram with all concepts
 * 2. Lets students explore each concept individually
 * 3. Provides self-checks aligned to the Bloom's verb
 *
 * @param topic - The topic being taught (e.g., "levers", "plant cells")
 * @param gradeLevel - Grade level context string
 * @param config - Configuration from manifest (includes objectiveId, objectiveText, objectiveVerb)
 * @returns FoundationExplorerData
 */
export const generateFoundationExplorer = async (
  topic: string,
  gradeLevel: string,
  config?: {
    objectiveId?: string;
    objectiveText?: string;
    objectiveVerb?: string;
    conceptCount?: number;
  }
): Promise<FoundationExplorerData> => {
  const objectiveVerb = config?.objectiveVerb || 'identify';
  const conceptCount = config?.conceptCount || 3;

  // Verb-specific prompting guidance
  const verbGuidance: Record<string, string> = {
    identify: `
IDENTIFY VERB - Focus on RECOGNITION:
- Self-checks should ask students to POINT TO, NAME, or RECOGNIZE the concept
- Example prompts: "Can you point to the fulcrum?", "What is this part called?"
- Hints should help them visually locate the concept
- Definitions should focus on WHAT it is and HOW to recognize it`,

    explain: `
EXPLAIN VERB - Focus on UNDERSTANDING WHY:
- Self-checks should ask students to DESCRIBE, TELL WHY, or GIVE REASONS
- Example prompts: "Can you explain why the fulcrum matters?", "What happens if we move this?"
- Hints should guide them toward cause-and-effect thinking
- Definitions should include WHY this concept matters, not just what it is`,

    apply: `
APPLY VERB - Focus on USING KNOWLEDGE:
- Self-checks should ask students to FIND EXAMPLES, USE, or DEMONSTRATE
- Example prompts: "Where else have you seen this?", "How would you use this at home?"
- Hints should connect to real-world situations they know
- Definitions should emphasize practical use and real-world connections`,

    analyze: `
ANALYZE VERB - Focus on BREAKING DOWN:
- Self-checks should ask students to COMPARE, EXAMINE, or FIND RELATIONSHIPS
- Example prompts: "How is the load different from the effort?", "What's the relationship between...?"
- Hints should guide them to notice patterns and differences
- Definitions should highlight relationships between concepts`,

    compare: `
COMPARE VERB - Focus on SIMILARITIES AND DIFFERENCES:
- Self-checks should ask students to CONTRAST, DISTINGUISH, or MATCH
- Example prompts: "How is this similar to...?", "What makes this different from...?"
- Hints should point to specific attributes to compare
- Definitions should include points of comparison`
  };

  const prompt = `
Create a Foundation Explorer for teaching "${topic}" to ${gradeLevel} students.

LEARNING OBJECTIVE CONTEXT:
${config?.objectiveText ? `- Objective: ${config.objectiveText}` : `- Teaching foundational concepts about ${topic}`}
- Objective ID: ${config?.objectiveId || 'obj1'}
- Action Verb: ${objectiveVerb.toUpperCase()}

${verbGuidance[objectiveVerb] || verbGuidance.identify}

TASK:
Generate ${conceptCount} foundational concepts that students must master to achieve this objective.

CRITICAL REQUIREMENTS:

1. DIAGRAM:
   - Create ONE central diagram that shows ALL concepts together
   - The imagePrompt should describe a CLEAN, EDUCATIONAL SCHEMATIC
   - NOT abstract art - clear labels and visual indicators
   - Style should be 'schematic' for clarity
   - Example good prompt: "Educational diagram showing a lever system: horizontal beam balanced on triangular fulcrum, weight/load on left labeled 'LOAD', arrow pushing down on right labeled 'EFFORT', fulcrum labeled in center. Clean line art, labeled parts, dark background."

2. CONCEPTS (Generate exactly ${conceptCount}):
   - Each concept is a KEY TERM or COMPONENT students must learn
   - briefDefinition: ONE sentence only, grade-appropriate language
   - diagramHighlight: Where to find it in the central diagram
   - inContext: Real-world example they can relate to
   - selfCheck: Question matching the ${objectiveVerb.toUpperCase()} verb

3. SELF-CHECK ALIGNMENT:
   - Every selfCheck.prompt MUST match the objective verb
   - ${objectiveVerb.toUpperCase()} verbs need ${objectiveVerb}-style questions (see guidance above)

4. VISUAL IDENTITY:
   - Each concept gets a distinct color
   - Use colors: '#3B82F6' (blue), '#10B981' (green), '#F59E0B' (amber), '#EF4444' (red), '#8B5CF6' (purple)
   - themeColor should complement the concepts

5. GRADE-APPROPRIATE LANGUAGE:
   - Elementary: Simple words, concrete examples, relatable scenarios
   - Middle School: More technical terms, abstract connections
   - High School: Academic vocabulary, complex relationships

EXAMPLE OUTPUT STRUCTURE (for levers with IDENTIFY verb):

{
  "objectiveId": "obj1",
  "objectiveText": "Identify the three main parts of a simple lever (fulcrum, effort, load).",
  "objectiveVerb": "identify",
  "diagram": {
    "description": "A simple lever showing all three parts: fulcrum, load, and effort",
    "imagePrompt": "Clean educational diagram of a class 1 lever: horizontal beam balanced on triangular pivot point (fulcrum) in center, heavy box labeled 'LOAD' on left end, downward arrow labeled 'EFFORT' on right end, triangle labeled 'FULCRUM'. Simple line art style, dark navy background, white lines, colored labels (blue for load, green for effort, amber for fulcrum).",
    "style": "schematic"
  },
  "concepts": [
    {
      "id": "fulcrum",
      "name": "Fulcrum",
      "briefDefinition": "The balance point that holds up the lever and lets it tilt.",
      "diagramHighlight": "The triangle shape in the center of the lever",
      "inContext": {
        "scenario": "On a seesaw at the playground, kids sit on each end and go up and down.",
        "whereToFind": "The fulcrum is the center post that the seesaw sits on and pivots around."
      },
      "selfCheck": {
        "prompt": "Can you point to the fulcrum in the diagram?",
        "hint": "Look for something in the middle that the beam rests on."
      },
      "color": "#F59E0B"
    },
    ...
  ],
  "themeColor": "#6366f1"
}

Return a complete Foundation Explorer configuration.
`;

  const result = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: foundationExplorerSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid Foundation Explorer data returned from Gemini API');
  }

  // Validation: ensure we have concepts
  if (!data.concepts || data.concepts.length === 0) {
    throw new Error('Foundation Explorer must have at least one concept');
  }

  // Validation: ensure each concept has required fields
  data.concepts = data.concepts.map((concept: FoundationConcept, index: number) => {
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
    return {
      ...concept,
      id: concept.id || `concept-${index}`,
      color: concept.color || colors[index % colors.length]
    };
  });

  // Apply config overrides
  if (config?.objectiveId) data.objectiveId = config.objectiveId;
  if (config?.objectiveText) data.objectiveText = config.objectiveText;
  if (config?.objectiveVerb) data.objectiveVerb = config.objectiveVerb;

  // Set defaults if missing
  if (!data.themeColor) data.themeColor = '#6366f1';
  if (!data.diagram.style) data.diagram.style = 'schematic';

  return data;
};
