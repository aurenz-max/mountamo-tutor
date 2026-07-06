import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import type {
  StoryTalkData,
  StoryTalkChallenge,
  StoryTalkChallengeType,
  StoryTalkOption,
} from "../../primitives/visual-primitives/literacy/StoryTalk";
import {
  resolveEvalModes,
  constrainChallengeTypeEnum,
  buildModeConstraintSection,
  type ChallengeTypeDoc,
} from "../evalMode";

// ---------------------------------------------------------------------------
// STORY TALK generator (FORK B: orchestrator / content-bearing).
//
// Kindergarten LISTENING comprehension. The tutor reads a short 3-5 sentence
// story aloud; the child answers a comprehension question whose answer is a
// single picturable word, by tapping one of 4 pictures.
//
// LESSON (story primitives): the LLM authors each story TOGETHER WITH its
// question, answer, and distractors — self-consistently, in ONE structured
// response. Code NEVER reconstructs a story around fixed answers (that desyncs
// story ↔ answer). Code VALIDATES (mode-aware) and ASSEMBLES (reconstruct the
// options array, reject unusable items, shuffle, enforce type variety, id).
//
// EVAL MODES (task identities, not difficulty levels):
//   who_what_where — literal recall; the answer is STATED in the story.
//   feeling_check  — emotion inference; the feeling is NOT stated, it's inferred.
//   why_because    — causal inference; the CAUSE is a picturable word in the story.
// All three share ONE render surface (question + 4 emoji taps), so they share ONE
// schema. Gemini self-labels each story via `challengeType` (enum-constrained by
// resolveEvalModes to the pinned/resolved/mixed set); validation branches on it.
// ---------------------------------------------------------------------------

const MODEL = 'gemini-flash-lite-latest';

const ALL_TYPES: StoryTalkChallengeType[] = ['who_what_where', 'feeling_check', 'why_because'];

// The answer is expected to be spoken in the story for these modes (literal
// recall + the causal picture). feeling_check is the exception — the feeling is
// the inference, so it is NOT required to appear in the story text.
const REQUIRES_ANSWER_IN_STORY = new Set<StoryTalkChallengeType>(['who_what_where', 'why_because']);

// ---------------------------------------------------------------------------
// Challenge-type docs — one per mode. promptDoc is injected into the prompt via
// buildModeConstraintSection; schemaDescription labels the enum.
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  who_what_where: {
    promptDoc:
      `"who_what_where" (literal recall): ask a simple WHO, WHAT, or WHERE question about ONE concrete detail `
      + `the story STATES out loud. The answer word MUST appear inside the story text. answer = a concrete, `
      + `picturable noun (an animal, object, or place); the 3 distractors are OTHER nouns of the SAME kind `
      + `(animal → other animals, place → other places). Vary who/what/where across stories.`,
    schemaDescription: "'who_what_where' (literal who/what/where recall)",
  },
  feeling_check: {
    promptDoc:
      `"feeling_check" (emotion inference): tell a story whose EVENTS show how a character feels WITHOUT naming `
      + `the feeling, then ask "How did <character> feel?". answer = ONE common feeling word with a matching FACE `
      + `emoji — happy 😊, sad 😢, scared 😨, angry 😠, excited 🤩, proud 😌, tired 😴, or surprised 😮. Do NOT state `
      + `the feeling word in the story — the child INFERS it from what happened. The 3 distractors are OTHER feeling `
      + `words, each with its own face emoji.`,
    schemaDescription: "'feeling_check' (infer the character's feeling)",
  },
  why_because: {
    promptDoc:
      `"why_because" (causal inference): tell a story where something happens for a clear reason, then ask `
      + `"Why did <event>?". answer = the CAUSE, written as ONE concrete picturable word that appears in the story `
      + `(why run home? → rain 🌧️). The 3 distractors are OTHER picturable things from the same story world, none of `
      + `which caused the event.`,
    schemaDescription: "'why_because' (infer why it happened)",
  },
};

// ---------------------------------------------------------------------------
// Schema — ONE object: { title, description, stories: [...] }.
// 2 object levels (wrapper + story item). The 3 distractors are FLATTENED into
// indexed string fields (no nested distractor array). ALL fields required.
// `challengeType` is enum-constrained per resolution before the Gemini call.
// ---------------------------------------------------------------------------

const buildStoryPoolSchema = (): Schema => ({
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging, kid-friendly session title including the topic (e.g., 'Story Time in the Forest!').",
    },
    description: {
      type: Type.STRING,
      description: "One friendly sentence telling a Kindergartner what they'll do (listen and tap the answer). NO answer words.",
    },
    stories: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          challengeType: {
            type: Type.STRING,
            enum: ALL_TYPES,
            description: "Which comprehension skill this story tests: 'who_what_where', 'feeling_check', or 'why_because'.",
          },
          storyTitle: {
            type: Type.STRING,
            description: "A short kid-friendly title for this mini-story (e.g., \"Milo's Acorn\").",
          },
          story: {
            type: Type.STRING,
            description: "3 to 5 short simple sentences a Kindergartner can follow, read aloud by the tutor. One clear event.",
          },
          question: {
            type: Type.STRING,
            description: "The comprehension question for this story's skill. NEVER contains the answer word.",
          },
          answer: {
            type: Type.STRING,
            description: "The correct answer: ONE concrete, picturable, lowercase word (or feeling word for feeling_check).",
          },
          answerEmoji: {
            type: Type.STRING,
            description: "Exactly one emoji that IS the answer (squirrel → 🐿️, rain → 🌧️, scared → 😨).",
          },
          distractor0Word: {
            type: Type.STRING,
            description: "A DIFFERENT same-category wrong choice (same kind as the answer). Lowercase single word. NEVER equals the answer.",
          },
          distractor0Emoji: { type: Type.STRING, description: "Exactly one emoji that IS distractor0Word." },
          distractor1Word: {
            type: Type.STRING,
            description: "A second DIFFERENT same-category wrong choice. Lowercase single word. NEVER equals the answer or distractor0Word.",
          },
          distractor1Emoji: { type: Type.STRING, description: "Exactly one emoji that IS distractor1Word." },
          distractor2Word: {
            type: Type.STRING,
            description: "A third DIFFERENT same-category wrong choice. Lowercase single word. NEVER equals the answer or the other distractors.",
          },
          distractor2Emoji: { type: Type.STRING, description: "Exactly one emoji that IS distractor2Word." },
        },
        required: [
          "challengeType", "storyTitle", "story", "question", "answer", "answerEmoji",
          "distractor0Word", "distractor0Emoji",
          "distractor1Word", "distractor1Emoji",
          "distractor2Word", "distractor2Emoji",
        ],
      },
      description: "6-8 self-consistent mini-stories. Each story asks a question that does NOT contain its answer.",
    },
  },
  required: ["title", "description", "stories"],
});

// ---------------------------------------------------------------------------
// Raw shapes (everything optional — Gemini may drop or malform any field).
// ---------------------------------------------------------------------------

interface RawStory {
  challengeType?: string;
  storyTitle?: string;
  story?: string;
  question?: string;
  answer?: string;
  answerEmoji?: string;
  distractor0Word?: string;
  distractor0Emoji?: string;
  distractor1Word?: string;
  distractor1Emoji?: string;
  distractor2Word?: string;
  distractor2Emoji?: string;
}

interface RawStoryPool {
  title?: string;
  description?: string;
  stories?: RawStory[];
}

/** A story item that survived validation — every REQUIRED-CONTRACT field present. */
interface ValidStory {
  challengeType: StoryTalkChallengeType;
  storyTitle: string;
  story: string;
  question: string;
  answer: string;
  answerEmoji: string;
  options: StoryTalkOption[]; // exactly 4, answer once, all distinct, shuffled
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Single token, no spaces, 2-15 chars — the answer-token guard. */
const isValidAnswerToken = (w: string): boolean => /^\S{2,15}$/.test(w) && !/\s/.test(w);

const shuffle = <T,>(arr: readonly T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** Whole-ish-word contains, case-insensitive ("hat" doesn't match "that"). */
const containsToken = (haystack: string, token: string): boolean =>
  new RegExp(`(^|[^a-z])${escapeRegExp(token)}([^a-z]|$)`, 'i').test(haystack);

// ---------------------------------------------------------------------------
// Validation — REJECT, never fabricate. Mode-aware: literal-recall + causal
// answers must be stated in the story; the inferred feeling must not.
// ---------------------------------------------------------------------------

const validateStoryPool = (raw: RawStoryPool, allowed: readonly StoryTalkChallengeType[]): ValidStory[] => {
  const survivors: ValidStory[] = [];
  const allowedSet = new Set(allowed);
  let rejected = 0;

  for (const s of raw.stories ?? []) {
    const challengeType = s.challengeType?.trim() as StoryTalkChallengeType | undefined;
    const storyTitle = s.storyTitle?.trim();
    const story = s.story?.trim();
    const question = s.question?.trim();
    const answer = s.answer?.trim().toLowerCase();
    const answerEmoji = s.answerEmoji?.trim();

    // 1. Required prose present.
    if (!storyTitle || !story || !question || !answer || !answerEmoji) { rejected += 1; continue; }

    // 2. challengeType must be a REAL type AND inside the resolved/pinned set.
    if (!challengeType || !allowedSet.has(challengeType)) { rejected += 1; continue; }

    // 3. Answer is a single picturable token.
    if (!isValidAnswerToken(answer)) { rejected += 1; continue; }

    // 4. Answer-derivability (mode-aware): literal recall + causal answers must be
    //    spoken in the story; feeling_check is inference, so it is NOT required.
    if (REQUIRES_ANSWER_IN_STORY.has(challengeType) && !containsToken(story, answer)) { rejected += 1; continue; }

    // 5. Answer-leak: the question must NOT contain the answer (all modes).
    if (containsToken(question, answer)) { rejected += 1; continue; }

    // 6. Reconstruct + validate distractors (3 distinct, none equal to answer).
    const rawDistractors: Array<{ word?: string; emoji?: string }> = [
      { word: s.distractor0Word, emoji: s.distractor0Emoji },
      { word: s.distractor1Word, emoji: s.distractor1Emoji },
      { word: s.distractor2Word, emoji: s.distractor2Emoji },
    ];
    const distractors: StoryTalkOption[] = [];
    const seenWords = new Set<string>([answer]);
    const seenEmojis = new Set<string>([answerEmoji]);
    for (const d of rawDistractors) {
      const word = d.word?.trim().toLowerCase();
      const emoji = d.emoji?.trim();
      if (!word || !emoji || !isValidAnswerToken(word)) continue;
      if (seenWords.has(word) || seenEmojis.has(emoji)) continue; // dup word/emoji or == answer
      seenWords.add(word);
      seenEmojis.add(emoji);
      distractors.push({ word, emoji });
    }
    if (distractors.length < 3) { rejected += 1; continue; }

    // 7. Assemble exactly 4 options (answer once + 3 distractors), then shuffle
    //    so the answer isn't always first — code owns option order.
    const options = shuffle<StoryTalkOption>([
      { word: answer, emoji: answerEmoji },
      ...distractors.slice(0, 3),
    ]);

    survivors.push({ challengeType, storyTitle, story, question, answer, answerEmoji, options });
  }

  if (rejected > 0) {
    console.warn(`[StoryTalk] rejected ${rejected} malformed stor${rejected === 1 ? 'y' : 'ies'} (${survivors.length} survived)`);
  }
  return survivors;
};

/**
 * Pick the final `count` with challengeType VARIETY: cover as many distinct types
 * as the pool offers (one-per-type first), then back-fill from the remainder.
 * For a single pinned mode the pool is one type — this is a no-op passthrough.
 * For a blend/mixed session it guarantees the label isn't a lie (every allowed
 * type that the pool can supply appears at least once).
 */
const selectWithTypeVariety = (pool: ValidStory[], count: number): ValidStory[] => {
  const shuffled = shuffle(pool);
  const picked: ValidStory[] = [];
  const usedTypes = new Set<StoryTalkChallengeType>();

  for (const story of shuffled) {
    if (picked.length === count) break;
    if (!usedTypes.has(story.challengeType)) {
      usedTypes.add(story.challengeType);
      picked.push(story);
    }
  }
  for (const story of shuffled) {
    if (picked.length === count) break;
    if (!picked.includes(story)) picked.push(story);
  }
  return picked.slice(0, count);
};

// ---------------------------------------------------------------------------
// Gemini call — throws on empty/unparseable output (never fabricates).
// ---------------------------------------------------------------------------

const SYSTEM_INSTRUCTION =
  `You are an expert early-childhood read-aloud specialist. You write tiny 3-5 sentence stories `
  + `that a Kindergartner (age 5) can follow when heard aloud — simple words, concrete objects, one clear `
  + `event. For each story you write ONE comprehension question whose answer is a single concrete, picturable `
  + `word. You NEVER put the answer word inside the question — the question is asked right before the child taps `
  + `a picture, so containing the answer would give it away. For literal-recall (who/what/where) and causal `
  + `(why) questions you STATE the answer plainly inside the story; for feeling questions you show the feeling `
  + `through events and NEVER name it. Every distractor you give is the SAME CATEGORY as the answer (another `
  + `animal for an animal, another feeling for a feeling) so the pictures are a fair choice.`;

const callGemini = async (schema: Schema, prompt: string, corrective?: string): Promise<RawStoryPool> => {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: corrective ? `${prompt}\n\n${corrective}` : prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: schema,
      systemInstruction: SYSTEM_INSTRUCTION,
    },
  });
  const text = response.text;
  if (!text) throw new Error('No data returned from Gemini API');
  return JSON.parse(text) as RawStoryPool;
};

const preamble = (topic: string, intent: string | undefined, grade: string): string =>
  `Topic: "${topic}".`
  + `${intent ? `\nSPECIFIC FOCUS: lean the stories toward "${intent}" when possible — but ALWAYS prioritize simple, Kindergarten-appropriate language and concrete picturable answers over this focus.` : ''}`
  + `\nTARGET GRADE LEVEL: ${grade}`;

const buildPrompt = (
  topic: string,
  intent: string | undefined,
  grade: string,
  modeSection: string,
): string =>
  `Write a pool of tiny stories for a Kindergarten LISTENING comprehension game. The tutor reads each
story aloud, asks the question, and the child answers by tapping one of four pictures.
${preamble(topic, intent, grade)}

Produce 6-8 self-consistent mini-stories. For EACH story give ALL fields, and set challengeType to the skill it tests.

${modeSection}

STRICT RULES (this is the whole activity — follow every one):
- story: 3-5 SHORT simple sentences a 5-year-old can follow when heard aloud. One clear event.
- answer: ONE concrete, PICTURABLE, lowercase word with a clear emoji (a feeling word for feeling_check).
- question: MUST NOT contain the answer word anywhere.
- distractor0/1/2 Word+Emoji: three DIFFERENT wrong choices in the SAME CATEGORY as the answer, each a lowercase single word with its own distinct emoji. None may equal the answer or each other.
- Theme the stories to "${topic}" wherever it fits naturally; keep the language K-simple regardless.

Also provide:
- title: a fun, kid-friendly session title including the topic.
- description: one friendly sentence telling the child what they'll do (listen, then tap the answer). NO answer words.`;

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export const generateStoryTalk = async (ctx: GenerationContext): Promise<StoryTalkData> => {
  const { topic } = ctx;
  const intent = ctx.intent;
  const grade = ctx.gradeContext;

  // Resolve which skill(s) this component teaches: explicit pin (tester/curator),
  // intent resolution (single | blend), or mixed (null → all three).
  const resolution = await resolveEvalModes(
    'story-talk',
    { targetEvalMode: ctx.targetEvalMode, intent: ctx.intent, objectiveText: ctx.objective?.text },
    CHALLENGE_TYPE_DOCS,
  );
  const allowedTypes = (resolution?.allowedTypes ?? ALL_TYPES) as StoryTalkChallengeType[];

  console.log(
    `[StoryTalk] modes: ${resolution ? `${resolution.modes.map(m => m.evalMode).join('+')} (${resolution.source})` : 'mixed'} → types [${allowedTypes.join(', ')}]`,
  );

  const baseSchema = buildStoryPoolSchema();
  const activeSchema = resolution
    ? constrainChallengeTypeEnum(baseSchema, resolution.allowedTypes, CHALLENGE_TYPE_DOCS, {
        arrayName: 'stories',
        fieldName: 'challengeType',
      })
    : baseSchema;

  const modeSection = buildModeConstraintSection(resolution, CHALLENGE_TYPE_DOCS);

  try {
    const prompt = buildPrompt(topic, intent, grade, modeSection);

    // First pass.
    let raw = await callGemini(activeSchema, prompt);
    let pool = validateStoryPool(raw, allowedTypes);

    // One corrective retry if the pool can't fill a 5-story session (never fabricate).
    if (pool.length < 5) {
      console.warn(`[StoryTalk] only ${pool.length}/5 usable stories — retrying once`);
      raw = await callGemini(activeSchema, prompt,
        `PREVIOUS ATTEMPT REJECTED: too few usable stories. Regenerate 8 stories. For EACH story: `
        + `(1) set challengeType correctly; `
        + `(2) the question MUST NOT contain the answer word; `
        + `(3) for who_what_where and why_because the exact lowercase answer word MUST appear inside the story; for feeling_check do NOT name the feeling in the story; `
        + `(4) the answer MUST be a single concrete picturable word with a matching emoji; `
        + `(5) give three DIFFERENT same-category distractors, each with its own distinct emoji, none equal to the answer.`);
      const retryPool = validateStoryPool(raw, allowedTypes);
      // Keep whichever attempt yielded more usable stories.
      if (retryPool.length > pool.length) pool = retryPool;
    }

    const title = raw.title?.trim() || '';
    const description = raw.description?.trim() || '';

    if (pool.length < 5) {
      throw new Error(`[StoryTalk] Story pool too small after retry: ${pool.length}/5 usable stories`);
    }
    if (!title || !description) {
      throw new Error('[StoryTalk] Gemini pool missing title/description');
    }

    // Select 5 with challengeType variety, then assign index-derived ids (never Date.now()).
    const selected = selectWithTypeVariety(pool, 5);
    const challenges: StoryTalkChallenge[] = selected.map((s, i) => ({
      id: `story-talk-${i + 1}`,
      type: s.challengeType,
      storyTitle: s.storyTitle,
      story: s.story,
      question: s.question,
      answer: s.answer,
      answerEmoji: s.answerEmoji,
      options: s.options,
    }));

    // Session-level metadata: the pinned/first mode, or a representative for mixed.
    const representative = (resolution?.allowedTypes[0] ?? 'who_what_where') as StoryTalkChallengeType;

    const data: StoryTalkData = {
      title,
      description,
      challengeType: representative,
      challenges,
      gradeLevel: ctx.gradeContext,
    };

    console.log('Story Talk Generated:', {
      title: data.title,
      mode: resolution ? resolution.modes.map(m => m.evalMode).join('+') : 'mixed',
      challengeCount: challenges.length,
      types: challenges.map(c => c.type),
      answers: challenges.map(c => c.answer),
    });

    return data;
  } catch (error) {
    console.error('Error generating story talk:', error);
    throw error;
  }
};
