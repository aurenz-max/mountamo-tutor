import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { FoundationExplorerData, FoundationConcept } from "../../types";

type FoundationExplorerConfig = {
  objectiveId?: string;
  objectiveText?: string;
  objectiveVerb?: string;
  conceptCount?: number;
};

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
          description: "A CLOSED question with one clearly correct answer, matching the objective verb. IDENTIFY: 'Which part is the fulcrum?' EXPLAIN: 'Why does the fulcrum matter?' APPLY: 'Where would you use a fulcrum?'"
        },
        options: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "EXACTLY 3 short answer choices. One is correct; the other two are PLAUSIBLE distractors (common misconceptions or the other concepts in this diagram) — never obviously wrong or joke answers. Do NOT reveal which is correct in the wording."
        },
        correctIndex: {
          type: Type.INTEGER,
          description: "0-based index into options of the correct choice. VARY this across concepts — do not always use 0."
        },
        hint: {
          type: Type.STRING,
          description: "A helpful nudge toward the correct choice if they're stuck. Do NOT state the answer directly."
        },
        optionEmojis: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          nullable: true,
          description: "PRE-READER (kindergarten) ONLY. One single emoji per option, SAME ORDER as options, that VISUALLY depicts that choice (🔺 for 'The triangle in the middle', 📦 for 'The heavy box'). The child answers by picture, so each emoji must be unambiguous and DISTINCT from the others. Omit entirely for grade 1 and up."
        }
      },
      required: ["prompt", "options", "correctIndex", "hint"]
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
/**
 * Canonical pre-reader grade key from the resolved context. Returns 'K' ONLY when
 * confidently kindergarten (never over-gates a reader lesson into pre-reader UI).
 * Mirrors resolvePreReaderGradeKey in the literacy generators.
 */
function resolvePreReaderGradeKey(ctx: GenerationContext): string | undefined {
  const canonical = (ctx.grade ?? '').toString().trim().toLowerCase();
  if (canonical === 'k' || canonical === '0' || canonical === 'kindergarten') return 'K';
  if (/^\d+$/.test(canonical)) return canonical;
  // Fall back to the display context for the pre-reader signal only.
  if (/(kinder|preschool|pre-?k\b|prek|pre-?reader)/i.test(ctx.gradeContext ?? '')) return 'K';
  return canonical || undefined;
}

export const generateFoundationExplorer = async (
  ctx: GenerationContext
): Promise<FoundationExplorerData> => {
  const { topic } = ctx;
  const gradeLevel = ctx.gradeContext;
  const gradeKey = resolvePreReaderGradeKey(ctx);
  const isPreReader = gradeKey === 'K';
  const config = ctx.raw as FoundationExplorerConfig;
  const objectiveVerb = ctx.objective.verb || 'identify';
  const conceptCount = config?.conceptCount || 3;

  // The SPECIFIC objective the manifest assigned to THIS instance. In production
  // this is the authored objective text (ctx.objective.text); fall back through the
  // canonical intent chain (config.intent → item.intent → item.title, resolved as
  // ctx.intent) so the per-component focus is never silently dropped, and finally to
  // the broad topic. Reading these typed axes — not ctx.raw — is what makes the
  // generator context-native (see resolveGenerationContext / topic-fidelity).
  const specificFocus = ctx.objective.text || ctx.intent || topic;
  const objectiveId = ctx.objective.id || 'obj1';

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
Create a Foundation Explorer for ${gradeLevel} students.

LEARNING OBJECTIVE CONTEXT:
- Broad lesson topic: ${topic}
- THIS activity must specifically teach: ${specificFocus}
- Objective ID: ${objectiveId}
- Action Verb: ${objectiveVerb.toUpperCase()}

SCOPE BINDING (critical — do not ignore):
The concepts you generate MUST BE the specific parts, components, or terms named in
the focus above ("${specificFocus}"). Do NOT substitute a different or more general
topic, even when the broad lesson topic is wider than the focus. If the focus names
specific parts (e.g. "fulcrum, load, effort"), those parts ARE your concepts. Stay
within the scope and theme the focus implies; the grade level is the ceiling, never a
reason to broaden past the focus.

${verbGuidance[objectiveVerb] || verbGuidance.identify}
${isPreReader ? `
PRE-READER AUDIENCE (KINDERGARTEN) — the student CANNOT read; a tutor reads everything aloud and the child answers by tapping a PICTURE. These rules override any conflicting guidance above:
- briefDefinition: ONE very short spoken-style sentence (max 12 words), everyday words a 5-year-old knows.
- inContext.scenario / whereToFind: ONE short simple sentence each, natural when read aloud.
- selfCheck.prompt: ONE short spoken question, MAX 12 WORDS. Do NOT reference anything the child must read or a picture that is not there ("the diagram below", "the word", "the picture above"). Do NOT let the answer leak from the wording (never "the shape with 3 sides" when the answer is Triangle).
- selfCheck.options: EXACTLY 3, each 1-4 words, a CONCRETE thing a 5-year-old can picture. No abstract phrases.
- selfCheck.optionEmojis: REQUIRED — one distinct emoji per option, SAME ORDER, that clearly depicts it. This is the answer surface; it must stand alone without the text.
` : ''}
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
   - selfCheck: A quick 3-option multiple-choice check matching the ${objectiveVerb.toUpperCase()} verb

3. SELF-CHECK ALIGNMENT (this is a GRADED multiple-choice question, not a reflection prompt):
   - Every selfCheck.prompt MUST be a closed question with ONE correct answer, matching the objective verb
   - ${objectiveVerb.toUpperCase()} verbs need ${objectiveVerb}-style questions (see guidance above)
   - Provide EXACTLY 3 options: one correct + two PLAUSIBLE distractors (use the OTHER concepts in
     this diagram, or a common misconception, as distractors). Never joke/obviously-wrong options.
   - Set correctIndex to the correct option and VARY it across concepts (not always 0)
   - The student must not be able to guess the answer from wording, length, or option order

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
        "prompt": "Which part of the lever is the fulcrum?",
        "options": ["The heavy box on the left", "The triangle in the middle the beam rests on", "The hand pushing down on the right"],
        "correctIndex": 1,
        "hint": "Look for something in the middle that the beam rests on and pivots around."
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
    const sc = concept.selfCheck || ({} as FoundationConcept['selfCheck']);
    // Guard the graded self-check: guarantee ≥2 options and an in-range correctIndex,
    // so a malformed generation can never render an unanswerable check.
    const options = Array.isArray(sc.options) ? sc.options.filter(Boolean) : [];
    const safeOptions = options.length >= 2 ? options : [];
    const correctIndex =
      typeof sc.correctIndex === 'number' &&
      sc.correctIndex >= 0 &&
      sc.correctIndex < safeOptions.length
        ? sc.correctIndex
        : 0;
    // Pre-reader picture answer surface: keep optionEmojis only when EVERY option
    // has a non-empty, DISTINCT emoji (a partial set would leave some options
    // picture-primary and others picture-less for a child who can't read the label).
    const rawEmojis = Array.isArray(sc.optionEmojis) ? sc.optionEmojis : [];
    const trimmed = rawEmojis.map((e) => (typeof e === 'string' ? e.trim() : ''));
    const emojisComplete =
      isPreReader &&
      trimmed.length === safeOptions.length &&
      trimmed.every((e) => e.length > 0) &&
      new Set(trimmed).size === trimmed.length;
    const optionEmojis = emojisComplete ? trimmed : undefined;
    return {
      ...concept,
      id: concept.id || `concept-${index}`,
      color: concept.color || colors[index % colors.length],
      selfCheck: { ...sc, options: safeOptions, correctIndex, optionEmojis },
    };
  });

  // Apply objective overrides from the resolved context so the shipped data echoes
  // the manifest's assigned objective (not the LLM's invented one).
  if (ctx.objective.id) data.objectiveId = ctx.objective.id;
  if (ctx.objective.text) data.objectiveText = ctx.objective.text;
  if (ctx.objective.verb) data.objectiveVerb = ctx.objective.verb;

  // Set defaults if missing
  if (!data.themeColor) data.themeColor = '#6366f1';
  if (!data.diagram.style) data.diagram.style = 'schematic';

  // Stamp the canonical grade key so the component can band-gate the pre-reader UI.
  if (gradeKey) data.gradeLevel = gradeKey;

  return data;
};
