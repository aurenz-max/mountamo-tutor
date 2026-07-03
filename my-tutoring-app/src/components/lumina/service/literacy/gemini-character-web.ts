import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { CharacterWebData } from "../../primitives/visual-primitives/literacy/CharacterWeb";
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
// Each mode is a DISTINCT literary-analysis task identity (a different reading
// skill / Bloom tier), NOT a numeric difficulty knob. The character-web data
// shape is identical for every mode (same characters/relationships/change
// fields); the mode shifts WHICH analytical move the content is built to
// elicit — what the story foregrounds and what the change/relationship prompts
// demand. `analysisFocus` is the root-level discriminator; the component
// renders every phase regardless, so the field is back-compatible / optional.
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  trait_id: {
    promptDoc:
      `"trait_id": IDENTIFY character traits from behavior. The student's task is to name `
      + `single-word adjective traits a character shows through what they DO and SAY (kind, brave, `
      + `stubborn, curious). The story must make traits inferable from concrete actions — each `
      + `suggestedTrait should be demonstrated by an event in the storyContext. traitEvidence can be `
      + `a short action reference (1 sentence). Relationships are simple and plot-obvious. The change `
      + `prompt asks about an OUTWARD behavior change. Bloom: identify/describe. Grades 2-3.`,
    schemaDescription: "'trait_id' (name traits from behavior)",
  },
  trait_evidence: {
    promptDoc:
      `"trait_evidence": CITE TEXT EVIDENCE for each trait. The skill is supporting a trait claim with `
      + `a specific quote or paraphrase from the story — the trait-to-evidence link is the graded move. `
      + `Every suggestedTrait MUST map (via traitEvidence) to a concrete 1-2 sentence quote drawn from `
      + `storyContext. Choose traits that are NOT stated outright but are provable from an event, so the `
      + `student must locate the supporting line. The change prompt asks the student to back up a claim `
      + `with evidence. Bloom: cite/justify. Grades 3-4.`,
    schemaDescription: "'trait_evidence' (support traits with text evidence)",
  },
  relationship_map: {
    promptDoc:
      `"relationship_map": ANALYZE how characters interact and how those relationships drive the plot. `
      + `Provide 2-3 characters with VARIED, non-obvious relationships (include at least one rival/enemy `
      + `or mentor pairing, not just friends) whose interactions actually shape story events. Each `
      + `relationship description must explain HOW the connection affects what happens, not just label it. `
      + `The change prompt centers on how a RELATIONSHIP shifted over the story. Bloom: analyze `
      + `interactions. Grades 4-5.`,
    schemaDescription: "'relationship_map' (analyze character interactions)",
  },
  character_change: {
    promptDoc:
      `"character_change": ANALYZE a dynamic character's development and WHY it happened. Build a clear `
      + `character arc — the protagonist is meaningfully different by the end (a belief, value, or `
      + `relationship has shifted) and the story supplies the CAUSE of that change (a turning point, `
      + `consequence, or relationship). suggestedTraits should contrast beginning-vs-end where relevant `
      + `(e.g. "fearful early, resolute later"). The change prompt MUST ask not just WHAT changed but WHY, `
      + `and expectedChange names the cause. Bloom: analyze/evaluate development. Grades 5-6.`,
    schemaDescription: "'character_change' (analyze character development and cause)",
  },
};

const characterWebSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Engaging title for the character analysis activity" },
    gradeLevel: { type: Type.STRING, description: "Target grade level ('2' through '6')" },
    analysisFocus: {
      type: Type.STRING,
      enum: ["trait_id", "trait_evidence", "relationship_map", "character_change"],
      description: "The literary-analysis skill this activity is built to elicit (does not change the data shape; shapes the content emphasis)",
    },
    storyContext: { type: Type.STRING, description: "Brief story summary (3-5 sentences) for student reference" },
    characters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          characterId: { type: Type.STRING },
          name: { type: Type.STRING },
          description: { type: Type.STRING, description: "Brief context about the character (1-2 sentences)" },
          suggestedTraits: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-5 character traits students should identify" },
          traitEvidence: {
            type: Type.OBJECT,
            description: "Map of trait name -> text evidence quote from the story. Keys are trait names, values are evidence strings.",
            properties: {},
          },
        },
        required: ["characterId", "name", "description", "suggestedTraits", "traitEvidence"]
      }
    },
    relationships: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          fromCharacterId: { type: Type.STRING },
          toCharacterId: { type: Type.STRING },
          relationshipType: { type: Type.STRING, description: "friend, rival, family, mentor, enemy, or ally" },
          description: { type: Type.STRING, description: "How they relate to each other" },
        },
        required: ["fromCharacterId", "toCharacterId", "relationshipType", "description"]
      }
    },
    changePrompt: { type: Type.STRING, description: "Question about how the main character changed" },
    changeCharacterId: { type: Type.STRING, description: "Character ID the change question refers to" },
    expectedChange: { type: Type.STRING, description: "Model answer describing the character's change" },
  },
  required: ["title", "gradeLevel", "storyContext", "characters", "relationships", "changePrompt", "changeCharacterId", "expectedChange"]
};

/**
 * Generate character web data using Gemini AI.
 *
 * Eval modes are distinct literary-analysis task identities (trait_id →
 * trait_evidence → relationship_map → character_change), resolved via the
 * shared eval-mode utility. An explicit `config.targetEvalMode` pins one mode
 * (the tester / curator path); otherwise the resolver runs and may blend or
 * leave the focus unconstrained (mixed). The schema's `analysisFocus` enum is
 * narrowed to the resolved mode(s) so Gemini commits to the right analytical
 * emphasis — no post-filtering, no numeric trimming.
 *
 * @param topic - Theme for the story (e.g. "A New School", "Lost in the Woods")
 * ctx.grade (the canonical objective grade) drives realization — reading level,
 * vocabulary, cast size, story length — via an unconditional grade note, clamped
 * to this primitive's 2-6 ladder. Grade is orthogonal to the eval-mode axis.
 * @param config - Optional overrides + eval-mode routing (targetEvalMode / intent / objectiveText)
 */
type CharacterWebConfig = Partial<CharacterWebData> & {
  /** Eval mode pinned by the tester/curator. Wins over intent resolution, no LLM call. */
  targetEvalMode?: string;
  /** Component intent — routing signal when no mode is pinned. */
  intent?: string;
  /** Parent objective text — secondary routing signal. */
  objectiveText?: string;
};

export const generateCharacterWeb = async (
  ctx: GenerationContext,
): Promise<CharacterWebData> => {
  const { topic } = ctx;
  const intent = ctx.intent;
  const config: CharacterWebConfig = { ...(ctx.raw as CharacterWebConfig), intent: ctx.intent };

  // ── Eval mode resolution ────────────────────────────────────────────
  const evalConstraint = resolveEvalModeConstraint(
    'character-web',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('CharacterWeb', config?.targetEvalMode, evalConstraint);

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(characterWebSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'analysisFocus',
        rootLevel: true,
      })
    : characterWebSchema;

  // Canonical curriculum grade (ctx.grade) drives realization — reading level,
  // vocabulary, character count, structural load. ctx.gradeLevel is only a BAND
  // key ('elementary' collapses 2-5) so it can never recover the numeric rung;
  // read ctx.grade, clamp to this primitive's real 2-6 ladder, and fall back to
  // the band only when no canonical grade is present.
  const LADDER = ['2', '3', '4', '5', '6'] as const;
  const gradeNum = ctx.grade ? parseInt(ctx.grade, 10) : NaN;
  let gradeLevelKey: string;
  if (ctx.grade && (LADDER as readonly string[]).includes(ctx.grade)) {
    gradeLevelKey = ctx.grade;
  } else if (Number.isFinite(gradeNum) && gradeNum > 6) {
    gradeLevelKey = '6';                       // above-ceiling numeric grade clamps to top rung
  } else if (Number.isFinite(gradeNum) && gradeNum < 2) {
    gradeLevelKey = '2';                       // below-floor numeric grade (grade 1) clamps to bottom rung
  } else {
    gradeLevelKey = ctx.gradeLevel === 'kindergarten' || ctx.gradeLevel === 'preschool' ? '2' : '4';
  }

  // Grade note = REALIZATION only (reading level, vocabulary, cast size, story
  // length). It is orthogonal to the eval mode's cognitive KIND (analysisFocus)
  // and is injected UNCONDITIONALLY so the objective grade governs how the story
  // reads at every mode — the mode's promptDoc still owns the analytical task.
  const gradeNotes: Record<string, string> = {
    '2': 'GRADE 2 READING LEVEL: keep the cast small (1-2 characters). Short, simple sentences; concrete everyday vocabulary; a 3-4 sentence story. Traits are plain single-word adjectives (kind, brave, funny) and evidence is one obvious action.',
    '3': 'GRADE 3 READING LEVEL: 2 characters. Simple compound sentences; mostly familiar vocabulary with a few new words; a 4-5 sentence story. Traits are inferable from one clear action or line.',
    '4': 'GRADE 4 READING LEVEL: 2-3 characters. Longer sentences with some subordinate clauses; grade-appropriate richer vocabulary; a 5-6 sentence story with a bit more description. Traits require light inference.',
    '5': 'GRADE 5 READING LEVEL: 2-3 characters. Varied sentence structure; more advanced vocabulary and figurative touches; a 6-7 sentence story with layered detail. Traits require inference across more than one event.',
    '6': 'GRADE 6 READING LEVEL: 2-3 characters. Complex, varied sentences; sophisticated vocabulary and nuance; a 7-8 sentence story with subtle characterization. Traits are indirect and demand inference from multiple lines.',
  };

  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint,
    CHALLENGE_TYPE_DOCS,
  );

  const prompt = `Create a character analysis activity about: "${topic}".
${intent ? `\nSPECIFIC FOCUS: The broad lesson is "${topic}", but THIS activity must specifically target: "${intent}". Shape the content (story context, characters, poem, examples, questions) to serve that focus. Never name or reveal the answer in this focus text.\n` : ''}
TARGET GRADE LEVEL: ${gradeLevelKey}
${gradeNotes[gradeLevelKey] || gradeNotes['4']}
${challengeTypeSection}

Provide:
1. analysisFocus: ${evalConstraint ? `"${evalConstraint.allowedTypes[0]}"` : 'the focus that best fits this activity'}
2. A brief story summary (storyContext) related to the topic with vivid characters whose traits are inferable from their actions
3. 2-3 character profiles, each with suggestedTraits and a traitEvidence map (trait name -> a quote/paraphrase drawn from storyContext)
4. Relationships between characters, each with a description of HOW they relate
5. A character change question (changePrompt) targeting one character, the changeCharacterId, and a model expectedChange

CRITICAL RULES:
- Every suggestedTrait MUST be demonstrable from an event or line in storyContext (never reveal the answer outright in labels — the student infers it).
- Every key in traitEvidence MUST be one of that character's suggestedTraits, and its value is a quote/paraphrase that actually supports the trait.
- changeCharacterId MUST be one of the provided characters.
- Keep the title neutral — never state the analysis focus or the answer in the title.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: activeSchema,
        systemInstruction: 'You are an expert K-6 reading teacher specializing in character analysis and literary response. You create rich, relatable characters with clear traits supported by textual evidence. Your story contexts are engaging and age-appropriate. Character relationships are realistic and varied. You build each activity to elicit one specific analytical skill without ever revealing the answer in titles, labels, or prompts.',
      }
    });
    const text = response.text;
    if (!text) throw new Error("No data returned from Gemini API");
    const result = JSON.parse(text) as CharacterWebData;

    // Merge config overrides (exclude routing fields from the spread).
    const { targetEvalMode: _m, intent: _i, objectiveText: _o, ...configRest } = config ?? {};
    void _m; void _i; void _o;
    const finalData: CharacterWebData = {
      ...result,
      ...configRest,
    };

    console.log('Character Web Generated:', {
      title: finalData.title,
      gradeLevel: finalData.gradeLevel,
      analysisFocus: (finalData as { analysisFocus?: string }).analysisFocus,
      modes: evalConstraint ? evalConstraint.allowedTypes.join('+') : 'mixed',
      characters: finalData.characters?.map(c => c.name) || [],
    });

    return finalData;
  } catch (error) {
    console.error("Error generating character web:", error);
    throw error;
  }
};
