import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { StoryPlannerData } from "../../primitives/visual-primitives/literacy/StoryPlanner";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';

// ---------------------------------------------------------------------------
// Challenge type documentation registry
//
// Eval modes here are narrative-writing TASK IDENTITIES, not numeric difficulty.
// Each mode tilts the WHOLE planning scaffold toward one craft skill — which
// elements are required, what the story-arc and dialogue prompts emphasise —
// while the interaction (plan → arc → review) stays identical. The student is
// always planning a story; the mode decides WHICH narrative skill the plan
// exercises.
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  story_structure: {
    promptDoc:
      `"story_structure": Sequencing the narrative arc. The plan centres on ordering events into a clear beginning-middle-end (or 5-arc) shape. `
      + `Required elements are the structural backbone (Character, Setting, What Happened / key events) and the storyArcLabels carry the weight. `
      + `Prompts ask "what happens first/next/last" — temporal sequencing, not deep elaboration. Foundational skill, grades K-3.`,
    schemaDescription: "'story_structure' (sequence the narrative arc: beginning-middle-end)",
  },
  character_setting: {
    promptDoc:
      `"character_setting": Developing a believable character and a vivid setting. The plan foregrounds Character (traits, wants, motivation) and Setting (sensory, time, place) elements; these are the required cards. `
      + `Prompts push for descriptive, specific detail ("What does your character want? What do they look/sound like? Describe the place using your senses"). `
      + `The arc is secondary. Elaboration / descriptive-language skill, grades 2-5.`,
    schemaDescription: "'character_setting' (develop character traits and a vivid setting)",
  },
  conflict_resolution: {
    promptDoc:
      `"conflict_resolution": Planning a central problem and a resolution that genuinely solves it. The plan requires a Problem/Conflict element and a Solution/Resolution element, and (grades 4+) populates conflictTypes (internal, external, person vs nature/society/self). `
      + `Prompts ask the student to name the conflict and plan how it is resolved, and the storyArcLabels emphasise Rising Action and Resolution. Plot/cause-effect skill, grades 3-6.`,
    schemaDescription: "'conflict_resolution' (plan a central conflict and a connected resolution)",
  },
  theme_craft: {
    promptDoc:
      `"theme_craft": Weaving theme and narrative craft into the plan. The plan requires a Theme/Message element plus craft elements (Perspective, Foreshadowing, Motivation/Relationships), and includes a dialoguePrompt for planning dialogue. `
      + `Prompts ask "what lesson or idea will your story leave the reader with, and how will the events show it?" Highest tier — synthesis of all narrative elements, grades 5-6.`,
    schemaDescription: "'theme_craft' (weave theme, dialogue, and craft into the plan)",
  },
};

const storyPlannerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Title for the story planning activity" },
    gradeLevel: { type: Type.STRING },
    planningFocus: {
      type: Type.STRING,
      enum: ["story_structure", "character_setting", "conflict_resolution", "theme_craft"],
      description: "Which narrative-writing skill this planning scaffold emphasises (the eval-mode task identity). Optional — back-compatible default plans cover all elements.",
    },
    writingPrompt: { type: Type.STRING, description: "Narrative writing prompt" },
    elements: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          elementId: { type: Type.STRING },
          label: { type: Type.STRING, description: "Element name: Character, Setting, Problem, Solution, Theme, etc." },
          prompt: { type: Type.STRING, description: "Student-facing question/prompt for this element" },
          required: { type: Type.BOOLEAN },
        },
        required: ["elementId", "label", "prompt", "required"]
      }
    },
    storyArcLabels: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Labels for the story arc phases" },
    conflictTypes: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Conflict type options for grades 4+" },
    dialoguePrompt: { type: Type.STRING, description: "Dialogue writing guidance for grades 3+" },
  },
  required: ["title", "gradeLevel", "writingPrompt", "elements", "storyArcLabels"]
};

type StoryPlannerConfig = Partial<StoryPlannerData> & { targetEvalMode?: string };

export const generateStoryPlanner = async (
  ctx: GenerationContext,
): Promise<StoryPlannerData> => {
  const { topic } = ctx;
  const intent = ctx.intent;
  const gradeLevel = ctx.gradeContext;
  const config = ctx.raw as StoryPlannerConfig;
  // ── Eval mode resolution (legacy literacy pattern: explicit pin only) ──
  const evalConstraint = resolveEvalModeConstraint(
    'story-planner',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('StoryPlanner', config?.targetEvalMode, evalConstraint);

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(storyPlannerSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'planningFocus',
        rootLevel: true,
      })
    : storyPlannerSchema;

  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint,
    CHALLENGE_TYPE_DOCS,
  );

  const gradeLevelKey = ['K', '1', '2', '3', '4', '5', '6'].includes(gradeLevel) ? gradeLevel : '3';

  const gradeNotes: Record<string, string> = {
    'K': 'K: 2 elements (Character, What Happened). 2-arc (Beginning, End). No conflict types. No dialogue.',
    '1': 'Grade 1: 3 elements (Character, Setting, What Happened). 3-arc (Beginning, Middle, End). No conflict types.',
    '2': 'Grade 2: 4 elements (Character, Setting, Problem, Solution). 3-arc. Use temporal words (first, then, finally).',
    '3': 'Grade 3: 5 elements (Character, Setting, Problem, Events, Solution). 5-arc. Include dialoguePrompt. Descriptive setting.',
    '4': 'Grade 4: 5-6 elements including Motivation. 5-arc with Rising Action detail. Include conflictTypes (internal, external). Sensory details.',
    '5': 'Grade 5: 6 elements including Relationships, Theme. 5-arc. Multiple character support. Subplot awareness.',
    '6': 'Grade 6: 6-7 elements including Conflict Type, Perspective, Foreshadowing. 5-arc. Complex conflict types (person vs self, person vs society, person vs nature).',
  };

  const prompt = `Create a narrative story planning activity about: "${topic}".
${intent ? `\nSPECIFIC FOCUS: The broad lesson is "${topic}", but THIS activity must specifically target: "${intent}". Shape the content (sentences, paragraphs, prompts, examples, questions) to serve that focus. Never name or reveal the answer in this focus text.\n` : ''}
GRADE: ${gradeLevelKey}.
${gradeNotes[gradeLevelKey] || gradeNotes['3']}
${challengeTypeSection}
Generate:
1. An engaging narrative writing prompt related to the topic
2. Planning elements (cards) with student-friendly prompts — mark required elements
3. Story arc labels appropriate for the grade level
4. ${parseInt(gradeLevelKey) >= 4 ? 'Include 3-4 conflictTypes' : 'No conflictTypes needed unless the focus is conflict_resolution'}
5. ${parseInt(gradeLevelKey) >= 3 ? 'Include a dialoguePrompt' : 'No dialoguePrompt needed unless the focus is theme_craft'}
${evalConstraint ? `6. Set planningFocus to "${evalConstraint.allowedTypes[0]}" and make the required elements, prompts, arc labels, conflictTypes, and dialoguePrompt reflect that focus — without ever stating the answer or naming the eval mode to the student.` : '6. Keep the scaffold balanced across all narrative elements for the grade level.'}

Never reveal a "correct" plan in any prompt, label, or placeholder — the prompts only ask open questions that the student answers in their own words.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: activeSchema,
        systemInstruction: 'You are an expert K-6 writing instructor specializing in narrative writing. You create age-appropriate story planning scaffolds that guide students through the creative writing process. Your prompts are imaginative and inspire student creativity while teaching narrative structure.',
      }
    });
    const text = response.text;
    if (!text) throw new Error("No data returned from Gemini API");
    const result = JSON.parse(text) as StoryPlannerData;

    const { targetEvalMode: _unused, ...configRest } = config ?? {};
    void _unused;
    const finalData: StoryPlannerData = { ...result, ...configRest };

    // Post-process: backfill planningFocus from the pinned mode if Gemini dropped it.
    if (!finalData.planningFocus && evalConstraint) {
      finalData.planningFocus = evalConstraint.allowedTypes[0] as StoryPlannerData['planningFocus'];
    }

    console.log('Story Planner Generated:', {
      title: finalData.title,
      gradeLevel: finalData.gradeLevel,
      planningFocus: finalData.planningFocus ?? 'mixed',
      elementCount: finalData.elements?.length || 0,
    });

    return finalData;
  } catch (error) {
    console.error("Error generating story planner:", error);
    throw error;
  }
};
