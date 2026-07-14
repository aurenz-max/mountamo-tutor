import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import type {
  PoetryLabData,
  FigurativeInstance,
  RhymeHuntRound,
  TemplateType,
} from "../../primitives/visual-primitives/literacy/PoetryLab";
import {
  resolveEvalModeConstraint,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  rhyme_hunt: {
    promptDoc:
      `"rhyme_hunt": Hear a four-line nursery-style poem, then tap the two line-ending words that rhyme (β 1.5). `
      + `Grades K-1 only. Audio-first, concrete emoji candidates, exactly one valid rhyme pair per ABCB stanza.`,
    schemaDescription: "'rhyme_hunt' (hear a poem and tap its one rhyming pair)",
  },
  analysis: {
    promptDoc:
      `"analysis": Identify poetic elements in a given poem (β 3.5). `
      + `Student reads a poem and identifies mood, figurative language instances, and rhyme scheme. `
      + `The GRADE note governs complexity and how many figurative instances to include (may be zero).`,
    schemaDescription: "'analysis' (identify poetic elements in a given poem)",
  },
  composition: {
    promptDoc:
      `"composition": Compose a poem using template structure (β 6.0). `
      + `Student writes a poem following a specific template (haiku, limerick, acrostic, free-verse, sonnet-intro). `
      + `The GRADE note governs which template to use.`,
    schemaDescription: "'composition' (compose a poem using template structure)",
  },
};

const rhymeHuntSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Warm, short title for a K-1 rhyme listening activity" },
    gradeLevel: { type: Type.STRING, enum: ["K", "1"] },
    mode: { type: Type.STRING, enum: ["rhyme_hunt"], description: "Must match the challenge type" },
    rounds: {
      type: Type.ARRAY,
      minItems: "3",
      maxItems: "4",
      description: "3-4 distinct audio-first rhyme rounds",
      items: {
        type: Type.OBJECT,
        properties: {
          poemLines: {
            type: Type.ARRAY,
            minItems: "4",
            maxItems: "4",
            items: { type: Type.STRING },
            description: "Exactly four short lines in ABCB form, 3-6 simple words per line",
          },
          candidates: {
            type: Type.ARRAY,
            minItems: "4",
            maxItems: "4",
            items: {
              type: Type.OBJECT,
              properties: {
                word: { type: Type.STRING, description: "One line-ending word" },
                emoji: { type: Type.STRING, description: "Required concrete picture cue for this word" },
              },
              required: ["word", "emoji"],
            },
            description: "The four line-ending words, each with a required emoji",
          },
          rhymeWordA: { type: Type.STRING, description: "First word in the one true rhyming pair" },
          rhymeWordB: { type: Type.STRING, description: "Second word in the one true rhyming pair" },
        },
        required: ["poemLines", "candidates", "rhymeWordA", "rhymeWordB"],
      },
    },
  },
  required: ["title", "gradeLevel", "mode", "rounds"],
};

// ---------------------------------------------------------------------------
// Per-mode schemas
//
// Mode-required fields are enforced by the schema itself, never by prompt
// prose — flash-lite drops prose-only requirements (RF-1: 4/4 draws shipped
// without moodOptions and deadlocked phase 1 at every grade). Analysis has NO
// composition fields and vice-versa, so cross-mode leaks (the "Free-Verse"
// badge on an AABB nursery rhyme) are impossible by construction.
//
// figurativeInstances carries text + type only: character offsets are
// recomputed in post-process via indexOf (SP-8 — never trust LLM offsets).
// ---------------------------------------------------------------------------

const analysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Engaging title for the poetry activity" },
    gradeLevel: { type: Type.STRING, description: "Target grade level ('K' or '1' through '6')" },
    mode: { type: Type.STRING, enum: ["analysis"], description: "Activity mode" },
    poemLines: {
      type: Type.ARRAY,
      minItems: "2",
      maxItems: "20",
      items: { type: Type.STRING },
      description: "Each line of the poem as a separate string",
    },
    correctMood: { type: Type.STRING, description: "The mood/feeling of the poem" },
    moodOptions: {
      type: Type.ARRAY,
      minItems: "3",
      maxItems: "4",
      items: { type: Type.STRING },
      description: "3-4 mood options including the correct one",
    },
    figurativeInstances: {
      type: Type.ARRAY,
      maxItems: "6",
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING, description: "The figurative phrase, copied EXACTLY as it appears in the poem" },
          type: { type: Type.STRING, description: "simile, metaphor, personification, alliteration, hyperbole, imagery, onomatopoeia" },
        },
        required: ["text", "type"],
      },
      description: "Figurative language instances (empty array when the grade note says none)",
    },
    rhymeScheme: { type: Type.STRING, description: "Correct rhyme scheme e.g. AABB, ABAB, ABCB" },
    rhymeSchemeOptions: {
      type: Type.ARRAY,
      minItems: "3",
      maxItems: "4",
      items: { type: Type.STRING },
      description: "3-4 rhyme scheme options including the correct one",
    },
  },
  required: [
    "title", "gradeLevel", "mode", "poemLines", "correctMood", "moodOptions",
    "figurativeInstances", "rhymeScheme", "rhymeSchemeOptions",
  ],
};

const compositionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Engaging title for the poetry activity" },
    gradeLevel: { type: Type.STRING, description: "Target grade level ('K' or '1' through '6')" },
    mode: { type: Type.STRING, enum: ["composition"], description: "Activity mode" },
    templateType: { type: Type.STRING, enum: ["haiku", "limerick", "acrostic", "free-verse", "sonnet-intro"] },
    compositionPrompt: { type: Type.STRING, description: "Writing prompt for composition mode" },
    templateConstraints: {
      type: Type.OBJECT,
      properties: {
        lineCount: { type: Type.NUMBER },
        rhymePattern: { type: Type.STRING, description: "e.g. AABB (only for rhyming templates)" },
        acrosticWord: { type: Type.STRING, description: "REQUIRED for acrostic template: the vertical word" },
      },
      required: ["lineCount"],
    },
  },
  required: ["title", "gradeLevel", "mode", "templateType", "compositionPrompt", "templateConstraints"],
};

// ---------------------------------------------------------------------------
// Grade notes
// ---------------------------------------------------------------------------

const ANALYSIS_GRADE_NOTES: Record<string, string> = {
  'K': 'Kindergarten: Nursery-rhyme style. 4 very short lines (3-6 simple words each). AABB with loud, obvious rhyming word pairs (cat/hat). Task = hear and identify the rhyming words. NO figurative language (figurativeInstances = empty array). Mood options must be single simple feeling words (happy, sleepy, silly).',
  '1': 'Grade 1: Simple rhyming poem. Identify rhyming words. Repetition. 4-6 lines. AABB rhyme. No figurative language beyond simple repetition (figurativeInstances may be empty).',
  '2': 'Grade 2: Rhyming poem with sensory words. AABB or ABAB. 4-8 lines. 1-2 simple similes. Identify mood.',
  '3': 'Grade 3: Simile and alliteration. Haiku structure. Stanza structure. AABB/ABAB. 8-12 lines. 2-3 figurative instances.',
  '4': 'Grade 4: ABAB, AABB rhyme schemes. Personification. Limerick form. 8-16 lines. 3-4 figurative instances.',
  '5': 'Grade 5: Meter basics. Imagery and mood. Free verse. Hyperbole. 10-16 lines. 4-5 figurative instances.',
  '6': 'Grade 6: Extended metaphor. Symbolism. Enjambment. 12-20 lines. 4-6 figurative instances.',
};

const COMPOSITION_GRADE_NOTES: Record<string, string> = {
  'K': 'Composition: Finish-the-rhyme — a 2-4 line nursery-style rhyme where the student supplies the final rhyming word(s). Very simple CVC-heavy vocabulary. Use free-verse templateType with rhymePattern AABB.',
  '1': 'Composition: Simple 4-line rhyming poem. AABB. Use free-verse templateType with rhymePattern AABB.',
  '2': 'Composition: 4-6 line poem with at least one simile. Use free-verse templateType.',
  '3': 'Composition: Haiku (5-7-5 syllables) or acrostic.',
  '4': 'Composition: Limerick (AABBA) or ABAB quatrain (free-verse templateType with rhymePattern ABAB).',
  '5': 'Composition: Free verse with imagery, or haiku.',
  '6': 'Composition: Free verse with extended metaphor, or sonnet-intro (4 lines iambic).',
};

// Structured templates have fixed constraints — derive them from templateType,
// never trust the LLM's numbers (PL-2: lineCount defaulted to 3 while the
// prompt said "four-line poem"; PL-3: missing syllablesPerLine made scoring
// binary 85/30).
const TEMPLATE_CONSTRAINT_DEFAULTS: Partial<Record<TemplateType, {
  lineCount: number;
  syllablesPerLine?: number[];
  rhymePattern?: string;
}>> = {
  'haiku': { lineCount: 3, syllablesPerLine: [5, 7, 5] },
  'limerick': { lineCount: 5, syllablesPerLine: [8, 8, 5, 5, 8], rhymePattern: 'AABBA' },
  'sonnet-intro': { lineCount: 4, rhymePattern: 'ABAB' },
};

// ---------------------------------------------------------------------------
// Post-process helpers — derive over validate
// ---------------------------------------------------------------------------

/** Dedupe options and guarantee the correct answer is among them (random slot). */
const ensureAnswerInOptions = (options: string[] | undefined, answer: string, max: number): string[] => {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const raw of options || []) {
    const opt = (raw || '').trim();
    const key = opt.toLowerCase();
    if (!opt || seen.has(key)) continue;
    seen.add(key);
    deduped.push(opt);
  }
  const answerKey = answer.toLowerCase();
  if (!seen.has(answerKey)) {
    deduped.splice(Math.floor(Math.random() * (deduped.length + 1)), 0, answer);
  }
  while (deduped.length > max) {
    let removed = false;
    for (let i = deduped.length - 1; i >= 0; i--) {
      if (deduped[i].toLowerCase() !== answerKey) {
        deduped.splice(i, 1);
        removed = true;
        break;
      }
    }
    if (!removed) break;
  }
  return deduped;
};

/**
 * Recompute figurative offsets from the poem text (SP-8). Instances whose text
 * doesn't appear verbatim are dropped; duplicate/overlapping texts claim
 * successive non-overlapping occurrences so the component's sequential slicer
 * never breaks.
 */
const locateFigurativeInstances = (
  poem: string,
  raw: Array<Partial<FigurativeInstance>> | undefined,
): FigurativeInstance[] => {
  const lowerPoem = poem.toLowerCase();
  const claimed: Array<[number, number]> = [];
  const placed: FigurativeInstance[] = [];
  let dropped = 0;

  for (const inst of raw || []) {
    const text = (inst.text || '').trim();
    const type = (inst.type || '').trim();
    if (!text || !type) { dropped++; continue; }

    const lowerText = text.toLowerCase();
    let start = -1;
    let from = 0;
    while (from <= lowerPoem.length) {
      const idx = lowerPoem.indexOf(lowerText, from);
      if (idx === -1) break;
      const end = idx + text.length;
      if (!claimed.some(([s, e]) => idx < e && end > s)) { start = idx; break; }
      from = idx + 1;
    }
    if (start === -1) { dropped++; continue; }

    const end = start + text.length;
    claimed.push([start, end]);
    placed.push({ text: poem.slice(start, end), startIndex: start, endIndex: end, type });
  }

  if (dropped > 0) {
    console.warn(`[PoetryLab] Dropped ${dropped} figurative instance(s) not found verbatim in the poem`);
  }
  return placed.sort((a, b) => a.startIndex - b.startIndex);
};

const normalizeRhymeWord = (word: string): string =>
  word.trim().toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, '');

const lineEnding = (line: string): string => {
  const words = line.trim().split(/\s+/);
  return normalizeRhymeWord(words[words.length - 1] ?? '');
};

const containsEmojiPicture = (value: string): boolean =>
  /[\u2600-\u27BF\u2B00-\u2BFF]|[\uD83C-\uDBFF][\uDC00-\uDFFF]/.test(value);

const finalizeRhymeHunt = (result: PoetryLabData): PoetryLabData => {
  let rejected = 0;
  const rounds: RhymeHuntRound[] = [];

  const rawRounds = (result.rounds ?? []).slice(0, 4);
  for (let index = 0; index < rawRounds.length; index++) {
    const rawRound = rawRounds[index];
    const poemLines = (rawRound.poemLines ?? []).map((line: string) => (line ?? '').trim()).filter(Boolean);
    const endings = poemLines.map(lineEnding);
    const uniqueEndings = new Set(endings);
    const rawCandidates = rawRound.candidates ?? [];
    const emojiByWord = new Map(
      rawCandidates.map((candidate: RhymeHuntRound['candidates'][number]) => [
        normalizeRhymeWord(candidate.word ?? ''),
        (candidate.emoji ?? '').trim(),
      ]),
    );
    const rhymeWordA = normalizeRhymeWord(rawRound.rhymeWordA ?? '');
    const rhymeWordB = normalizeRhymeWord(rawRound.rhymeWordB ?? '');

    const valid = poemLines.length === 4
      && endings.every(Boolean)
      && uniqueEndings.size === 4
      && rawCandidates.length === 4
      && endings.every((word: string) => containsEmojiPicture(emojiByWord.get(word) ?? ''))
      && rhymeWordA !== rhymeWordB
      && uniqueEndings.has(rhymeWordA)
      && uniqueEndings.has(rhymeWordB);

    if (!valid) {
      rejected += 1;
      continue;
    }

    rounds.push({
      id: `rhyme-hunt-${index + 1}`,
      type: 'rhyme_hunt',
      poemLines: poemLines as RhymeHuntRound['poemLines'],
      candidates: endings.map((word: string) => ({ word, emoji: emojiByWord.get(word)! })) as RhymeHuntRound['candidates'],
      rhymeWordA,
      rhymeWordB,
    });
  }

  if (rejected > 0) {
    console.warn(`[PoetryLab] Rejected ${rejected} invalid rhyme_hunt round(s)`);
  }
  if (rounds.length < 3) {
    throw new Error(`PoetryLab rhyme_hunt needs at least 3 valid rounds; received ${rounds.length}`);
  }

  return {
    title: result.title,
    gradeLevel: result.gradeLevel,
    mode: 'rhyme_hunt',
    rounds,
  };
};

const finalizeAnalysis = (result: PoetryLabData): PoetryLabData => {
  const poemLines = (result.poemLines || []).map(l => (l || '').trim()).filter(Boolean);
  if (poemLines.length === 0) throw new Error("PoetryLab analysis draw has no poem lines");
  const poem = poemLines.join('\n');

  const correctMood = (result.correctMood || '').trim();
  if (!correctMood) throw new Error("PoetryLab analysis draw missing correctMood");
  const rhymeScheme = (result.rhymeScheme || '').trim().toUpperCase();
  if (!rhymeScheme) throw new Error("PoetryLab analysis draw missing rhymeScheme");

  return {
    ...result,
    mode: 'analysis',
    poem,
    poemLines,
    correctMood,
    moodOptions: ensureAnswerInOptions(result.moodOptions, correctMood, 4),
    figurativeInstances: locateFigurativeInstances(poem, result.figurativeInstances),
    rhymeScheme,
    rhymeSchemeOptions: ensureAnswerInOptions(
      (result.rhymeSchemeOptions || []).map(s => (s || '').trim().toUpperCase()),
      rhymeScheme,
      4,
    ),
    templateType: undefined,
    compositionPrompt: undefined,
    templateConstraints: undefined,
  };
};

const finalizeComposition = (result: PoetryLabData): PoetryLabData => {
  let templateType: TemplateType = result.templateType || 'free-verse';
  const raw = result.templateConstraints;

  const acrosticWord = (raw?.acrosticWord || '').trim().toUpperCase();
  if (templateType === 'acrostic' && !acrosticWord) {
    console.warn("[PoetryLab] Acrostic draw missing acrosticWord — degrading to free-verse");
    templateType = 'free-verse';
  }

  const fixed = TEMPLATE_CONSTRAINT_DEFAULTS[templateType];
  const templateConstraints: NonNullable<PoetryLabData['templateConstraints']> = {
    lineCount: templateType === 'acrostic'
      ? acrosticWord.length
      : fixed?.lineCount ?? Math.max(1, Math.round(raw?.lineCount || 4)),
    syllablesPerLine: fixed?.syllablesPerLine,
    rhymePattern: fixed?.rhymePattern ?? ((raw?.rhymePattern || '').trim().toUpperCase() || undefined),
    acrosticWord: templateType === 'acrostic' ? acrosticWord : undefined,
  };

  const compositionPrompt = (result.compositionPrompt || '').trim();
  if (!compositionPrompt) throw new Error("PoetryLab composition draw missing compositionPrompt");

  return {
    ...result,
    mode: 'composition',
    templateType,
    compositionPrompt,
    templateConstraints,
    poem: undefined,
    poemLines: undefined,
    correctMood: undefined,
    moodOptions: undefined,
    figurativeInstances: undefined,
    rhymeScheme: undefined,
    rhymeSchemeOptions: undefined,
  };
};

// ---------------------------------------------------------------------------
// Generator — per-mode dispatch
//
// One invocation produces exactly one activity in exactly one mode, so this
// is a dispatcher (focused prompt + dedicated schema per mode), not a
// parallel orchestrator: there is never a second mode to fan out.
// ---------------------------------------------------------------------------

type PoetryLabConfig = Partial<PoetryLabData & { targetEvalMode: string }>;

export const generatePoetryLab = async (
  ctx: GenerationContext,
): Promise<PoetryLabData> => {
  const { topic } = ctx;
  const intent = ctx.intent;
  const config = ctx.raw as PoetryLabConfig;

  // Grade rung: ctx.grade is the canonical per-objective curriculum grade
  // ('K'|'1'..'12'), resolved once at the registry boundary — use it directly,
  // clamped to this primitive's K-6 ladder. Without it (free-form lessons) fall
  // back to the lesson band: kindergarten → 'K', anything else → '3' (the old
  // prose-matching fallback could never hit and silently pinned every lesson
  // to grade 4).
  const LADDER = ['K', '1', '2', '3', '4', '5', '6'] as const;
  let gradeLevelKey: string;
  if (ctx.grade && (LADDER as readonly string[]).includes(ctx.grade)) {
    gradeLevelKey = ctx.grade;
  } else if (ctx.grade && parseInt(ctx.grade, 10) > 6) {
    gradeLevelKey = '6';
  } else {
    gradeLevelKey = ctx.gradeLevel === 'kindergarten' || ctx.gradeLevel === 'preschool' ? 'K' : '3';
  }

  // ---------------------------------------------------------------------------
  // Eval mode resolution → mode dispatch
  // ---------------------------------------------------------------------------
  const evalConstraint = resolveEvalModeConstraint(
    'poetry-lab',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('PoetryLab', config?.targetEvalMode, evalConstraint);

  const requestedType = evalConstraint?.allowedTypes[0] ?? config?.mode;
  const requestedMode: 'rhyme_hunt' | 'analysis' | 'composition' =
    requestedType === 'rhyme_hunt'
      ? 'rhyme_hunt'
      : requestedType === 'composition'
        ? 'composition'
        : 'analysis';

  const activeSchema = requestedMode === 'rhyme_hunt'
    ? rhymeHuntSchema
    : requestedMode === 'composition'
      ? compositionSchema
      : analysisSchema;

  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint,
    CHALLENGE_TYPE_DOCS,
  );

  const intentSection = intent
    ? `\nSPECIFIC FOCUS: The broad lesson is "${topic}", but THIS activity must specifically target: "${intent}". Shape the content (story context, characters, poem, examples, questions) to serve that focus. Never name or reveal the answer in this focus text.\n`
    : '';

  const prompt = requestedMode === 'rhyme_hunt'
    ? `Create an AUDIO-FIRST rhyme hunt about: "${topic}".
${intentSection}
GRADE: ${gradeLevelKey === '1' ? '1' : 'K'}. MODE: rhyme_hunt.

${challengeTypeSection}

Generate exactly 4 DISTINCT rounds (post-validation may retain 3-4). For EVERY round:
1. Write exactly 4 nursery-style poemLines, each only 3-6 simple words, in ABCB form.
2. There must be EXACTLY ONE rhyming pair among the four line-ending words: lines 2 and 4. Lines 1 and 3 must not rhyme with each other or with that pair.
3. Use loud, obvious, sayable, CVC-heavy rhymes such as cat/hat. Keep vocabulary concrete and familiar to K-1 children.
4. candidates must contain exactly the four line-ending words, in line order. Each emoji field must be an ACTUAL single Unicode emoji picture (for example 🐱 or 🎩), never a translated word, letters, or descriptive text.
5. rhymeWordA and rhymeWordB must be the answer words as TEXT, never positional indices.
6. Do not reuse the same rhyme pair in another round.`
    : requestedMode === 'analysis'
      ? `Create a poetry analysis activity about: "${topic}".
${intentSection}
GRADE: ${gradeLevelKey}. MODE: analysis.
${ANALYSIS_GRADE_NOTES[gradeLevelKey]}

${challengeTypeSection}

Generate:
1. A grade-appropriate poem about the topic (poemLines: each line as a separate string)
2. correctMood and 3-4 moodOptions (correctMood must be one of the options)
3. figurativeInstances per the GRADE note — each with the phrase copied EXACTLY, character-for-character, as it appears in a poem line, plus its type. Empty array if the grade note says none.
4. rhymeScheme (e.g. "AABB") that genuinely matches the poem's end rhymes, and 3-4 rhymeSchemeOptions`
      : `Create a poetry composition activity about: "${topic}".
${intentSection}
GRADE: ${gradeLevelKey}. MODE: composition.
${COMPOSITION_GRADE_NOTES[gradeLevelKey]}

${challengeTypeSection}

Generate:
1. A compositionPrompt appropriate for grade ${gradeLevelKey}
2. templateType matching the grade level
3. templateConstraints with lineCount (and acrosticWord if templateType is acrostic, rhymePattern if the poem should rhyme)`;

  const maxAttempts = requestedMode === 'rhyme_hunt' ? 2 : 1;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-flash-lite-latest',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: activeSchema,
          maxOutputTokens: 8192,
          systemInstruction: 'You are an expert K-6 poetry instructor who creates engaging, age-appropriate poems and poetry activities. For rhyme_hunt, write audio-first K-1 stanzas with exactly one obvious rhyming pair and concrete emoji cues. For analysis mode, write poems with consistent rhyme schemes and copy figurative phrases exactly as they appear in the poem. For composition mode, create inspiring prompts with clear structural constraints.',
        }
      });
      const text = response.text;
      if (!text) throw new Error("No data returned from Gemini API");
      const parsed = JSON.parse(text) as PoetryLabData;
      const result = requestedMode === 'rhyme_hunt'
        ? finalizeRhymeHunt(parsed)
        : requestedMode === 'composition'
          ? finalizeComposition(parsed)
          : finalizeAnalysis(parsed);
      // Exclude routing/content fields from config spread so the validated root
      // mode and rounds remain load-bearing for eval-test and the component.
      const {
        targetEvalMode: _targetEvalMode,
        mode: _requestedMode,
        rounds: _configuredRounds,
        ...restConfig
      } = config || {};
      return { ...result, ...restConfig };
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        console.warn(`[PoetryLab] rhyme_hunt generation attempt ${attempt} rejected; retrying`, error);
      }
    }
  }
  console.error("Error generating poetry lab:", lastError);
  throw lastError;
};
