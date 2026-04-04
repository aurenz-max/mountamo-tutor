/**
 * Practice Manifest Generator
 *
 * Generates a structured manifest that pairs practice problems with
 * interactive visual primitives. Follows the same pattern as gemini-manifest.ts
 * but produces a flat problem list instead of objective-centric blocks.
 */

import { Type, Schema, ThinkingLevel } from "@google/genai";
import { PracticeManifest } from "../../types";
import { ai } from "../geminiClient";
import { buildPracticeVisualCatalogContext } from "./practice-visual-catalog";

/**
 * Map target_beta to nearest Bloom's tier when eval_mode_name is not available.
 * Thresholds are midpoints between adjacent tier betas (1.5, 3.0, 4.5, 6.0).
 */
function betaToBloomsTier(beta: number): string {
  if (beta <= 2.25) return 'recall';
  if (beta <= 3.75) return 'apply';
  if (beta <= 5.25) return 'analyze';
  return 'evaluate';
}

/**
 * Progress callback for practice manifest generation streaming
 */
export interface PracticeManifestProgressCallback {
  onProgress?: (message: string) => void;
  onThinking?: (thought: string) => void;
}

/**
 * Grade level context for practice problems
 */
const getGradeLevelContext = (gradeLevel: string): string => {
  const contexts: Record<string, string> = {
    'toddler': 'toddlers (ages 1-3)',
    'preschool': 'preschool children (ages 3-5)',
    'kindergarten': 'kindergarten students (ages 5-6)',
    'elementary': 'elementary students (grades 1-5)',
    'middle-school': 'middle school students (grades 6-8)',
    'high-school': 'high school students (grades 9-12)',
    'undergraduate': 'undergraduate college students',
    'graduate': 'graduate students',
    'phd': 'doctoral students and researchers',
  };
  return contexts[gradeLevel] || contexts['elementary'];
};

/**
 * Gemini structured output schema for PracticeManifest
 */
const practiceManifestSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    topic: { type: Type.STRING },
    gradeLevel: { type: Type.STRING },
    problemCount: { type: Type.NUMBER },
    sessionBrief: {
      type: Type.OBJECT,
      description: "A short, student-facing intro that frames the upcoming activities. Written for the student, not the teacher.",
      properties: {
        title: {
          type: Type.STRING,
          description: "A friendly, engaging title for this activity set (e.g., 'The Alphabet Adventure', 'Fraction Explorers'). NOT the raw curriculum name.",
        },
        hook: {
          type: Type.STRING,
          description: "One engaging sentence that makes the topic feel relevant or exciting to the student (e.g., 'Letters are the building blocks of every word you'll ever read!').",
        },
        whyItMatters: {
          type: Type.STRING,
          description: "One sentence connecting this skill to something the student cares about (e.g., 'Knowing your letter sounds helps you read your favorite stories!').",
        },
      },
      required: ["title", "hook", "whyItMatters"],
    },
    items: {
      type: Type.ARRAY,
      description: "Ordered list of practice items. Each is one problem.",
      items: {
        type: Type.OBJECT,
        properties: {
          instanceId: {
            type: Type.STRING,
            description: "Unique ID (e.g., 'problem-1', 'problem-2')"
          },
          problemText: {
            type: Type.STRING,
            description: "The problem question or contextual prompt the student sees"
          },
          difficulty: {
            type: Type.STRING,
            enum: ["easy", "medium", "hard"],
          },
          rationale: {
            type: Type.STRING,
            description: "Educational rationale for this problem"
          },
          teachingNote: {
            type: Type.STRING,
            description: "Brief teaching guidance for scaffolding"
          },
          visualPrimitive: {
            type: Type.OBJECT,
            nullable: true,
            description: "When set, the student answers by interacting with this visual primitive instead of text options. Set to null if no visual fits.",
            properties: {
              componentId: {
                type: Type.STRING,
                description: "Visual primitive ID from the catalog (e.g., 'fraction-circles', 'balance-scale')"
              },
              intent: {
                type: Type.STRING,
                description: "Natural-language instructions for the generator: what to build, target values, task type, difficulty context. The dedicated generator will handle full configuration."
              },
              numberRange: {
                type: Type.OBJECT,
                nullable: true,
                description: "Structured number range for this primitive based on the student's grade and scaffolding level. Required for math primitives that generate numbers (e.g., place-value-chart, base-ten-blocks, number-line). Null for non-numeric primitives.",
                properties: {
                  min: { type: Type.NUMBER, description: "Minimum value (inclusive) appropriate for this student's level" },
                  max: { type: Type.NUMBER, description: "Maximum value (inclusive) appropriate for this student's level" },
                },
                required: ["min", "max"],
              },
              successCriteria: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING, description: "What the student needs to do to answer correctly" },
                  targetValue: { type: Type.STRING, description: "Expected answer value for validation" },
                },
                required: ["description"],
              },
            },
            required: ["componentId", "intent", "numberRange", "successCriteria"],
          },
          standardProblem: {
            type: Type.OBJECT,
            nullable: true,
            description: "When visualPrimitive is null, this specifies a standard text-based problem type. Set to null if using a visual.",
            properties: {
              problemType: {
                type: Type.STRING,
                enum: ["multiple_choice", "true_false", "fill_in_blanks", "matching_activity", "sequencing_activity", "categorization_activity"],
              },
              generationIntent: {
                type: Type.STRING,
                description: "Detailed instructions for generating this specific problem"
              },
            },
            required: ["problemType", "generationIntent"],
          },
        },
        required: ["instanceId", "problemText", "difficulty", "rationale", "teachingNote"],
      },
    },
  },
  required: ["topic", "gradeLevel", "problemCount", "sessionBrief", "items"],
};

/**
 * Generate a practice manifest that pairs problems with visual primitives.
 * Supports optional progress callbacks for streaming UI updates.
 */
export interface PracticeManifestOptions {
  /** When true, forces every item to use a different visual primitive or problem type. Duplicate primitives are converted to standard problems. */
  enforceDiversity?: boolean;
  /** Primitives already used in this session with scores. Guides the model toward variety and appropriate difficulty. */
  sessionHistory?: Array<{ componentId: string; difficulty: string; score?: number; topic?: string }>;
  /** Target scaffolding mode (1-6) from the backend IRT calibration system. Controls difficulty via scaffolding level, not item content. */
  targetMode?: number;
  /** Pulse band context: 'current' (learning), 'review' (retest), 'frontier' (probing ahead). */
  band?: string;
  /** Cross-session primitive history from the backend. Used to avoid serving the same primitives repeatedly. */
  recentPrimitives?: Array<{ primitive_type: string; eval_mode: string; score: number; subskill_id: string }>;
}

/**
 * Mode-based scaffolding descriptions for the Gemini prompt.
 * Maps IRT target_mode (1-6) to concrete content generation instructions.
 * This is the bridge between the backend calibration system and Gemini's output.
 */
const MODE_SCAFFOLDING: Record<number, { label: string; difficulty: string; instruction: string }> = {
  1: {
    label: 'Concrete manipulatives with full guidance',
    difficulty: 'easy',
    instruction: 'Use visual manipulatives (ten frames, counters, fraction circles, etc.) with full step-by-step guidance. Provide visual scaffolding for every step. Use small, simple numbers. The student should be able to see and interact with physical representations.',
  },
  2: {
    label: 'Pictorial with prompts',
    difficulty: 'easy',
    instruction: 'Use pictorial representations (drawings, diagrams, number lines) with guiding prompts. One layer of abstraction above concrete manipulatives. Provide visual support but let the student figure out the approach. Keep numbers manageable.',
  },
  3: {
    label: 'Pictorial, reduced prompts',
    difficulty: 'medium',
    instruction: 'Use pictorial representations but with minimal prompting. The student must self-organize their approach. Visual support is present but the student drives the reasoning. Moderate number ranges.',
  },
  4: {
    label: 'Transitional: mixed symbolic/pictorial',
    difficulty: 'medium',
    instruction: 'Bridge between concrete and abstract. Mix some symbolic notation with pictorial support. Partial scaffolding — the student should be transitioning to working with numbers and symbols. Broader number ranges.',
  },
  5: {
    label: 'Fully symbolic, single operation',
    difficulty: 'hard',
    instruction: 'Abstract, symbolic problems with no visual scaffolding. The student works with numbers, equations, and symbolic notation directly. Single-operation problems requiring direct abstract reasoning. Wider number ranges.',
  },
  6: {
    label: 'Symbolic, multi-step or cross-concept',
    difficulty: 'hard',
    instruction: 'The most challenging level. Multi-step symbolic problems, cross-concept integration, or problems requiring the student to synthesize multiple skills. No scaffolding. Expect the student to work abstractly and independently. Complex number ranges and multi-step reasoning.',
  },
};

/**
 * Build the difficulty/scaffolding section of the prompt based on mode and band.
 */
const buildDifficultyContext = (options?: PracticeManifestOptions): string => {
  const mode = options?.targetMode;
  const band = options?.band;

  if (!mode || !MODE_SCAFFOLDING[mode]) {
    // Fallback: no mode from backend, use generic variety
    return `## DIFFICULTY
- Vary difficulty (some easy, some medium, some hard)`;
  }

  const scaffolding = MODE_SCAFFOLDING[mode];
  let bandContext = '';
  if (band === 'review') {
    bandContext = '\nThis is a REVIEW item — the student has seen this skill before. Focus on recall and fluency, not teaching.';
  } else if (band === 'frontier') {
    bandContext = '\nThis is a FRONTIER PROBE — the student has NOT been formally taught this skill yet. Use a fair assessment approach: test whether they already know it, do not assume prior instruction.';
  } else if (band === 'current') {
    bandContext = '\nThis is a CURRENT LEARNING item — the student is actively learning this skill. Balance challenge with support.';
  }

  return `## DIFFICULTY & SCAFFOLDING (from adaptive calibration system)
TARGET MODE: ${mode}/6 — "${scaffolding.label}"
DIFFICULTY LEVEL: ${scaffolding.difficulty}

${scaffolding.instruction}${bandContext}

IMPORTANT: All items in this request MUST match the target mode ${mode} scaffolding level. Do NOT default to medium difficulty. The adaptive system has determined this student needs mode ${mode} content based on their demonstrated ability.
- Set difficulty to "${scaffolding.difficulty}" for all items.`;
};

/**
 * Build the primitive diversity section based on cross-session history.
 */
const buildDiversityContext = (options?: PracticeManifestOptions): string => {
  const parts: string[] = [];

  if (options?.recentPrimitives && options.recentPrimitives.length > 0) {
    // Count frequency of each primitive type
    const freq: Record<string, number> = {};
    for (const rp of options.recentPrimitives) {
      freq[rp.primitive_type] = (freq[rp.primitive_type] || 0) + 1;
    }
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    const overused = sorted.filter(([, count]) => count >= 3).map(([name]) => name);
    const recent = sorted.slice(0, 5).map(([name, count]) => `${name} (${count}x)`);

    parts.push(`\n## PRIMITIVE DIVERSITY (cross-session history)
The student has recently completed these primitives across past sessions: ${recent.join(', ')}.`);

    if (overused.length > 0) {
      parts.push(`AVOID these overused primitives if alternatives exist: ${overused.join(', ')}.
Choose different visual primitives from the catalog to keep the experience fresh.`);
    } else {
      parts.push('Vary the primitive selection to keep the experience engaging.');
    }
  }

  if (options?.sessionHistory && options.sessionHistory.length > 0) {
    const scored = options.sessionHistory.filter(h => h.score !== undefined && h.score >= 0);
    const generated = options.sessionHistory.filter(h => h.score === undefined || h.score < 0);

    // Extract topic context from all entries to maintain session coherence
    const allTopics = options.sessionHistory
      .map(h => h.topic)
      .filter((t): t is string => !!t);

    if (scored.length > 0) {
      parts.push(`Earlier in this session the student completed: ${scored.map(h => `${h.componentId} (${h.difficulty}, scored ${h.score}%)${h.topic ? ` — ${h.topic}` : ''}`).join(', ')}.`);
    }
    if (generated.length > 0) {
      parts.push(`These primitives are ALREADY QUEUED for this session and must NOT be repeated: ${generated.map(h => `${h.componentId}${h.topic ? ` (${h.topic})` : ''}`).join(', ')}. Pick a DIFFERENT primitive from the catalog.`);
    }
    if (allTopics.length > 0) {
      parts.push(`SESSION COHERENCE: This session is focused on: ${allTopics[0]}. Continue in the SAME skill area and grade level. Do NOT jump to an unrelated topic. Build on what came before — deepen the same concept with a different visual or increase difficulty.`);
    }
    if (scored.length > 0) {
      parts.push('Vary primitives when possible, but repeating at a harder level is fine.');
    }
  }

  return parts.join('\n');
};

export const generatePracticeManifest = async (
  topic: string,
  gradeLevel: string,
  problemCount: number,
  callbacks?: PracticeManifestProgressCallback,
  options?: PracticeManifestOptions,
): Promise<PracticeManifest> => {
  const gradeLevelContext = getGradeLevelContext(gradeLevel);
  const visualCatalog = buildPracticeVisualCatalogContext();

  callbacks?.onProgress?.(`Designing ${problemCount} practice problems...`);

  const difficultyContext = buildDifficultyContext(options);
  const diversityContext = buildDiversityContext(options);

  const prompt = `You are an educational content designer creating an interactive practice session.

ASSIGNMENT: Generate ${problemCount} practice problems for: "${topic}"
TARGET AUDIENCE: ${gradeLevelContext}

${visualCatalog}

## SESSION BRIEF (required)
First, generate a "sessionBrief" — a short, student-facing intro for this activity set:
- "title": A fun, engaging name (NOT the raw curriculum label). Examples: "Fraction Explorers", "Sound Safari", "Number Detectives".
- "hook": One exciting sentence that pulls the student in. Speak directly to them.
- "whyItMatters": One sentence connecting this skill to something they care about.

## YOUR TASK

For each problem, decide:
1. Is there a visual primitive that would create a BETTER learning experience than multiple choice?
   - If YES: set "visualPrimitive" with componentId, intent, and successCriteria. Set "standardProblem" to null.
   - If NO: set "standardProblem" with problemType and generationIntent. Set "visualPrimitive" to null.

2. EVERY item must have exactly one of: visualPrimitive OR standardProblem (never both, never neither)

## VISUAL PRIMITIVE RULES
- The "intent" field is natural language describing what the generator should build (target values, task type, context). Dedicated generators handle the full configuration — you just describe what you want.
- "numberRange": For math primitives that work with numbers (place-value-chart, base-ten-blocks, number-line, counting-board, ten-frame, etc.), set numberRange to {min, max} appropriate for the student's grade AND scaffolding mode. Examples:
  * Kindergarten mode 1: {"min": 1, "max": 10}
  * Grade 1 mode 2: {"min": 1, "max": 20}
  * Grade 2 mode 3: {"min": 10, "max": 100}
  * Grade 3 mode 4: {"min": 100, "max": 1000}
  * Grade 4 mode 5: {"min": 100, "max": 9999}
  * Grade 5+ mode 6: {"min": 1000, "max": 99999}
  Set to null for non-numeric primitives (fraction-circles, shape-builder, etc.).
- successCriteria.description: tell the student what to DO
- successCriteria.targetValue: the expected answer

${difficultyContext}

## PROBLEM VARIETY
- Math topics: aim for 60-80% visual primitives
- Non-math topics: use standard problems mostly (0-20% visual)
- Mix different visual primitives when possible${diversityContext}${options?.enforceDiversity ? `

## DIVERSITY REQUIREMENT (MANDATORY)
This is a diagnostic assessment — each item must test a DIFFERENT facet of the skill.
- NEVER use the same visual primitive componentId more than once.
- NEVER use the same standard problem type more than once.
- If only one visual primitive fits, use it once and make the other items standard problems of DIFFERENT types.
- Each item should probe a distinct angle: e.g. one conceptual, one procedural, one applied.` : ''}

## EXAMPLE (Fractions for Elementary)

{
  "topic": "Fractions",
  "gradeLevel": "elementary",
  "problemCount": 3,
  "sessionBrief": {
    "title": "Fraction Explorers",
    "hook": "Did you know that every time you share a pizza equally, you're already using fractions?",
    "whyItMatters": "Understanding fractions helps you share fairly, measure ingredients, and solve real-world puzzles!"
  },
  "items": [
    {
      "instanceId": "problem-1",
      "problemText": "An explorer finds a ribbon and cuts it into 3 equal parts. What fraction is one part?",
      "difficulty": "easy",
      "rationale": "Tests basic understanding of unit fractions",
      "teachingNote": "Connect to real-world sharing scenarios",
      "visualPrimitive": {
        "componentId": "fraction-circles",
        "intent": "Build a fraction circle for 1/3. Task type: build. The student shades one out of three equal sections.",
        "numberRange": null,
        "successCriteria": {
          "description": "Shade the circle to show 1/3",
          "targetValue": "1/3"
        }
      },
      "standardProblem": null
    },
    {
      "instanceId": "problem-2",
      "problemText": "Which fraction is larger: 1/2 or 1/4?",
      "difficulty": "medium",
      "rationale": "Tests fraction comparison using visual reasoning",
      "teachingNote": "Use side-by-side fraction bars to compare",
      "visualPrimitive": {
        "componentId": "fraction-bar",
        "intent": "Compare fractions 1/2 and 1/4 using fraction bars. Task type: compare.",
        "successCriteria": {
          "description": "Shade both fraction bars and identify that 1/2 is larger",
          "targetValue": "1/2"
        }
      },
      "standardProblem": null
    },
    {
      "instanceId": "problem-3",
      "problemText": "True or false: 2/4 is the same as 1/2.",
      "difficulty": "easy",
      "rationale": "Tests understanding of equivalent fractions",
      "teachingNote": "Conceptual check before visual exploration",
      "visualPrimitive": null,
      "standardProblem": {
        "problemType": "true_false",
        "generationIntent": "True/false about whether 2/4 equals 1/2. Answer: TRUE."
      }
    }
  ]
}

Now generate the practice manifest for: "${topic}" (${gradeLevel}, ${problemCount} problems)
Return ONLY valid JSON matching the schema.`;

  callbacks?.onProgress?.('AI is thinking about the best problems...');

  const responseStream = await ai.models.generateContentStream({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: "application/json",
      responseSchema: practiceManifestSchema,
    },
  });

  let accumulatedText = '';
  let chunkCount = 0;
  for await (const chunk of responseStream) {
    if (chunk.text) {
      accumulatedText += chunk.text;
      chunkCount++;
      // Send periodic progress as chunks arrive
      if (chunkCount % 3 === 0) {
        callbacks?.onProgress?.('Generating problem details...');
      }
    }
  }

  if (!accumulatedText) throw new Error("No practice manifest returned");

  callbacks?.onProgress?.('Parsing manifest...');

  let jsonStr = accumulatedText.trim();
  const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match) jsonStr = match[1].trim();

  const firstOpen = jsonStr.indexOf('{');
  const lastClose = jsonStr.lastIndexOf('}');
  if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
    jsonStr = jsonStr.substring(firstOpen, lastClose + 1);
  }

  const manifest = JSON.parse(jsonStr) as PracticeManifest;

  // Post-manifest diversity enforcement: convert duplicate visual primitives
  // to standard problems so every item tests a different facet.
  // NOTE: only visual primitives are deduplicated — duplicate standard problem
  // types (e.g. 2x multiple_choice) are fine and pedagogically valuable.
  if (options?.enforceDiversity) {
    const seenVisuals = new Set<string>();
    const fallbackTypes = ['multiple_choice', 'true_false', 'fill_in_blanks', 'short_answer'];
    let fallbackIdx = 0;

    for (const item of manifest.items) {
      if (item.visualPrimitive) {
        const cid = item.visualPrimitive.componentId;
        if (seenVisuals.has(cid)) {
          const fallback = fallbackTypes[fallbackIdx % fallbackTypes.length];
          fallbackIdx++;
          console.log(`🔄 [Diversity] Swapping duplicate visual "${cid}" → standard "${fallback}" for ${item.instanceId}`);
          item.standardProblem = {
            problemType: fallback as any,
            generationIntent: `Generate a ${fallback.replace(/_/g, ' ')} problem about: ${item.problemText}`,
          };
          item.visualPrimitive = null;
        } else {
          seenVisuals.add(cid);
        }
      }
    }
  }

  // Safety net: items with neither visualPrimitive nor standardProblem get
  // converted to a standard problem so the hydrator can always generate content.
  const orphanFallbackTypes = ['multiple_choice', 'true_false', 'fill_in_blanks'];
  let orphanIdx = 0;
  for (const item of manifest.items) {
    if (!item.visualPrimitive && !item.standardProblem) {
      const fallback = orphanFallbackTypes[orphanIdx % orphanFallbackTypes.length];
      orphanIdx++;
      console.log(`⚠️ [Manifest] Item ${item.instanceId} has neither visual nor standard — assigning ${fallback}`);
      item.standardProblem = {
        problemType: fallback as any,
        generationIntent: `Generate a ${fallback.replace(/_/g, ' ')} problem about: ${item.problemText}`,
      };
    }
  }

  const visualCount = manifest.items.filter(i => i.visualPrimitive).length;
  const standardCount = manifest.items.filter(i => i.standardProblem).length;
  console.log(`📋 Practice Manifest Generated: ${manifest.items.length} items`);
  console.log(`   🎨 Visual primitives: ${visualCount}, 📝 Standard problems: ${standardCount}`);

  callbacks?.onProgress?.(`Manifest ready: ${manifest.items.length} problems (${visualCount} interactive, ${standardCount} text)`);

  return manifest;
};

// ===========================================================================
// Pulse batch manifest — multi-skill, one Gemini call
// ===========================================================================

/**
 * A single item spec passed into the Pulse batch generator.
 * Mirrors the relevant fields from PulseItemSpec.
 */
export interface PulseManifestItemInput {
  item_id: string;
  description: string;
  band: string;       // 'frontier' | 'current' | 'review'
  target_mode: number; // 1-6
  target_beta: number;
  eval_mode_name?: string; // e.g. 'recall', 'apply', 'analyze', 'evaluate'
  skill_id: string;
  subskill_id: string;
  subject: string;
  /** Curriculum-assigned primitive from curriculum_published (e.g. 'number-line', 'ten-frame') */
  primitive_affinity?: string;
  /** Curriculum-assigned eval mode — tells the generator which mode to use (e.g. 'subitize', 'plot') */
  eval_mode_hint?: string;
}

/**
 * Generate a practice manifest for ALL Pulse items in one Gemini call.
 *
 * Unlike `generatePracticeManifest` (single topic, N items), this sends
 * the full item queue so Gemini can diversify primitive selection across
 * the entire session.
 *
 * Each manifest item's instanceId matches the Pulse item_id, preserving
 * the identity chain from backend → manifest → renderer → result.
 */
export const generatePulseManifest = async (
  items: PulseManifestItemInput[],
  gradeLevel: string,
  callbacks?: PracticeManifestProgressCallback,
  options?: PracticeManifestOptions,
): Promise<PracticeManifest> => {
  const gradeLevelContext = getGradeLevelContext(gradeLevel);
  const visualCatalog = buildPracticeVisualCatalogContext();

  callbacks?.onProgress?.(`Designing ${items.length} Pulse activities...`);

  const diversityContext = buildDiversityContext(options);

  // Build per-item specifications for the prompt
  const itemSpecList = items.map((item, i) => {
    const scaffolding = MODE_SCAFFOLDING[item.target_mode] || MODE_SCAFFOLDING[4];
    const bandLabel = item.band === 'frontier' ? 'FRONTIER PROBE (student may not know this yet — fair assessment, no assumed instruction)'
      : item.band === 'review' ? 'REVIEW (student has seen this — focus on recall and fluency)'
      : 'CURRENT LEARNING (actively learning — balance challenge with support)';

    const affinityLine = item.primitive_affinity
      ? `\n- PREFERRED PRIMITIVE: "${item.primitive_affinity}" (curriculum-assigned — use this if it exists in the catalog and fits the skill)`
      : '';
    const evalModeLine = item.eval_mode_hint
      ? `\n- EVAL MODE: "${item.eval_mode_hint}" (curriculum-assigned — use this mode for the primitive)`
      : '';

    return `### Item ${i + 1}: "${item.item_id}"
- Skill: ${item.description}
- Band: ${bandLabel}
- Scaffolding: Mode ${item.target_mode}/6 — "${scaffolding.label}" (difficulty: ${scaffolding.difficulty})
- ${scaffolding.instruction}${affinityLine}${evalModeLine}`;
  }).join('\n\n');

  const prompt = `You are an educational content designer creating a Lumina Pulse session — an adaptive, multi-skill practice loop.

ASSIGNMENT: Generate ${items.length} practice activities, one for each skill below. Each activity is for a DIFFERENT skill.
TARGET AUDIENCE: ${gradeLevelContext}

${visualCatalog}

## SESSION BRIEF (required)
Generate a "sessionBrief" — a short, student-facing intro for this Pulse session:
- "title": A fun, engaging name. Examples: "Number Ninja Challenge", "Math Mix-Up", "Brain Boost".
- "hook": One exciting sentence that pulls the student in.
- "whyItMatters": One sentence connecting these skills to something they care about.

## ITEM SPECIFICATIONS
Each item below has its own skill, scaffolding level, and band context. Generate one manifest item per specification.
CRITICAL: The "instanceId" for each item MUST match the item_id given below (e.g., "${items[0]?.item_id}").

${itemSpecList}

## YOUR TASK

For each item, decide:
1. Is there a visual primitive that would create a BETTER learning experience than multiple choice?
   - If YES: set "visualPrimitive" with componentId, intent, and successCriteria. Set "standardProblem" to null.
   - If NO: set "standardProblem" with problemType and generationIntent. Set "visualPrimitive" to null.
2. EVERY item must have exactly one of: visualPrimitive OR standardProblem (never both, never neither)

## VISUAL PRIMITIVE RULES
- The "intent" field is natural language describing what the generator should build. Dedicated generators handle configuration.
- "numberRange": For math primitives that work with numbers, set numberRange to {min, max} appropriate for the item's grade AND scaffolding mode. Match the mode level:
  * Mode 1-2 (concrete/pictorial): small numbers (e.g., K: 1-10, G1: 1-20, G2: 10-100)
  * Mode 3-4 (transitional): moderate numbers (e.g., G2: 10-200, G3: 100-1000, G4: 100-5000)
  * Mode 5-6 (symbolic): wider ranges (e.g., G3: 100-2000, G4: 1000-9999, G5+: 1000-99999)
  Set to null for non-numeric primitives.
- successCriteria.description: tell the student what to DO
- successCriteria.targetValue: the expected answer
- Match the difficulty/scaffolding level specified per item. Item at mode 1 should use concrete manipulatives; item at mode 5 should use abstract symbolic.

## DIVERSITY ACROSS THE SESSION (CRITICAL)
You are generating ${items.length} activities that the student will see in sequence. Variety is essential:
- Use DIFFERENT visual primitives for different items. Do NOT repeat the same componentId.
- If two skills are similar (e.g., both counting skills), pick DIFFERENT primitives for each.
  For example: one could use "ten-frame", the other "base-ten-blocks", another "counting-board", another "number-line".
- Consult the full visual primitive catalog above — there are many options beyond the obvious choice.
- Only fall back to standard problems when no visual primitive fits the skill.
${diversityContext}

## PROBLEM VARIETY
- Math topics: aim for 80%+ visual primitives with maximum variety
- Each item should feel distinct in how the student interacts with it

Now generate the practice manifest.
Return ONLY valid JSON matching the schema.`;

  callbacks?.onProgress?.('AI is designing your session...');

  const responseStream = await ai.models.generateContentStream({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: "application/json",
      responseSchema: practiceManifestSchema,
    },
  });

  let accumulatedText = '';
  let chunkCount = 0;
  for await (const chunk of responseStream) {
    if (chunk.text) {
      accumulatedText += chunk.text;
      chunkCount++;
      if (chunkCount % 3 === 0) {
        callbacks?.onProgress?.('Generating activity details...');
      }
    }
  }

  if (!accumulatedText) throw new Error("No Pulse manifest returned");

  callbacks?.onProgress?.('Parsing manifest...');

  let jsonStr = accumulatedText.trim();
  const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match) jsonStr = match[1].trim();

  const firstOpen = jsonStr.indexOf('{');
  const lastClose = jsonStr.lastIndexOf('}');
  if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
    jsonStr = jsonStr.substring(firstOpen, lastClose + 1);
  }

  const manifest = JSON.parse(jsonStr) as PracticeManifest;

  // Fix instanceIds: Gemini might use "problem-1" instead of the pulse item_id.
  // Re-stamp to ensure the identity chain is intact.
  for (let i = 0; i < manifest.items.length && i < items.length; i++) {
    manifest.items[i].instanceId = items[i].item_id;
  }

  // Inject Bloom's tier eval mode into standard problems for IRT-adaptive difficulty.
  // Uses eval_mode_name from backend if available, otherwise derives from target_beta.
  for (let i = 0; i < manifest.items.length && i < items.length; i++) {
    const item = manifest.items[i];
    const input = items[i];
    if (item.standardProblem) {
      const tier = input.eval_mode_name || betaToBloomsTier(input.target_beta);
      item.standardProblem.evalMode = tier;
    }
  }

  // Post-manifest diversity enforcement: convert duplicate visual primitives
  const seenVisuals = new Set<string>();
  const fallbackTypes = ['multiple_choice', 'true_false', 'fill_in_blanks', 'matching_activity'];
  let fallbackIdx = 0;
  for (let i = 0; i < manifest.items.length; i++) {
    const item = manifest.items[i];
    if (item.visualPrimitive) {
      const cid = item.visualPrimitive.componentId;
      if (seenVisuals.has(cid)) {
        const fallback = fallbackTypes[fallbackIdx % fallbackTypes.length];
        fallbackIdx++;
        const input = i < items.length ? items[i] : undefined;
        console.log(`[Pulse] Diversity: duplicate visual "${cid}" → standard "${fallback}" for ${item.instanceId}`);
        item.standardProblem = {
          problemType: fallback as any,
          generationIntent: `Generate a ${fallback.replace(/_/g, ' ')} problem about: ${item.problemText}`,
          evalMode: input ? (input.eval_mode_name || betaToBloomsTier(input.target_beta)) : undefined,
        };
        item.visualPrimitive = null;
      } else {
        seenVisuals.add(cid);
      }
    }
  }

  // Safety net: items with neither visual nor standard
  const orphanFallbacks = ['multiple_choice', 'true_false', 'fill_in_blanks'];
  let orphanIdx = 0;
  for (let i = 0; i < manifest.items.length; i++) {
    const item = manifest.items[i];
    if (!item.visualPrimitive && !item.standardProblem) {
      const fallback = orphanFallbacks[orphanIdx % orphanFallbacks.length];
      orphanIdx++;
      const input = i < items.length ? items[i] : undefined;
      console.log(`[Pulse] Item ${item.instanceId} missing type — assigning ${fallback}`);
      item.standardProblem = {
        problemType: fallback as any,
        generationIntent: `Generate a ${fallback.replace(/_/g, ' ')} problem about: ${item.problemText}`,
        evalMode: input ? (input.eval_mode_name || betaToBloomsTier(input.target_beta)) : undefined,
      };
    }
  }

  const visualCount = manifest.items.filter(i => i.visualPrimitive).length;
  const standardCount = manifest.items.filter(i => i.standardProblem).length;
  console.log(`[Pulse] Manifest generated: ${manifest.items.length} items`);
  manifest.items.forEach((item, i) => {
    const type = item.visualPrimitive ? `visual:${item.visualPrimitive.componentId}` : `standard:${item.standardProblem?.problemType}`;
    console.log(`[Pulse]   ${i + 1}. ${item.instanceId} → ${type} (${item.difficulty})`);
  });
  console.log(`[Pulse]   Visual: ${visualCount}, Standard: ${standardCount}`);

  callbacks?.onProgress?.(`Manifest ready: ${manifest.items.length} activities (${visualCount} interactive, ${standardCount} text)`);

  return manifest;
};
