/**
 * gemini-di-spoken-practice — the generator for the DI family's CONTENT-GENERIC
 * pack. This is the file the "one schema instead of N primitives" question is
 * actually asking about.
 *
 * FORK B, DELIBERATELY. The other DI generators are Fork A (menu service):
 * content is a curated table in code and Gemini only SELECTS from it. That is
 * correct when the response class is narrow and the menu is finite — letter
 * sounds, shapes, CVC words. It is exactly what makes those packs single-skill.
 * Here the content IS the variable, so Gemini emits items and CODE holds the
 * safety rails:
 *
 *   1. `deriveResponseClass` refuses any item it cannot place in the benched
 *      registry (standing gate 1). A 4-word answer is open-set production —
 *      a BLOCKED class — and the item is dropped, not downgraded.
 *   2. `findAnswerLeaks` drops any item whose ask or printed stimulus contains
 *      its own answer. Mechanical, because `expectedAnswer` is a field.
 *   3. `findUnspokenStimulus` drops any say_answer item whose ask never SAYS
 *      its own problem — the voice is the carrier, the screen is reinforcement
 *      (run 436dcb5616cb: "Here is a groups problem. What is the answer?").
 *   4. count_and_say answers are COMPUTED from the count, never trusted from
 *      the model (LLM emits the window, code builds the answer).
 *   5. Sentinels are never generated — the script module wraps every verdict
 *      branch in "Yes, …" / "My turn: …" itself.
 *
 * SCHEMA SHAPE follows the flash-lite rules the hard way round: ONE bounded
 * array of FLAT items, no nested arrays anywhere (`alsoAccept` is a
 * comma-separated string that code splits), every array bounded, and
 * maxOutputTokens set so a runaway truncates fast instead of returning
 * malformed JSON.
 *
 * WHAT IS BEING TESTED. `acceptRule` and `signatureError` are the two clauses
 * every hand-authored pack had to discover by driving it live. If the model
 * can write them per skill, a conversion costs a generation call instead of a
 * component. If it cannot, the tester shows that before a child hears it —
 * which is the whole reason this ships behind `/di-spoken-practice` in the DI
 * tester rather than into a lesson.
 */

import { Type, Schema } from '@google/genai';
import { ai } from '../geminiClient';
import { resolveEvalModes, type ChallengeTypeDoc } from '../evalMode';
import { createDiscretePool } from '../math/numberPoolService';
import type { DiSpokenPracticeData } from '../../primitives/visual-primitives/direct-instruction/DiSpokenPractice';
import {
  deriveResponseClass,
  findAnswerLeaks,
  findArithmeticMismatches,
  findPrintedNumerals,
  findUnspokenStimulus,
  normalizeSpokenAnswer,
  numberWordFor,
  HOW_TO_PLAY,
  MODE_SHAPE,
  type SpokenPracticeItem,
  type SpokenPracticeMode,
} from '../../primitives/visual-primitives/direct-instruction/diSpokenPracticeScript';

const DEFAULT_ITEM_COUNT = 4;
const MAX_ITEM_COUNT = 6;
const MIN_ITEM_COUNT = 3;
/** Counting stays inside the benched number-word class and floors at 1 —
 *  "zero"/"none" spoken is unbenched (di-shapes rung 2 residual). */
const MIN_COUNT = 1;
const MAX_COUNT = 10;

// ── Eval-mode routing (Fork A discipline: code stamps the mode) ──────────────

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  say_answer: {
    promptDoc:
      '"say_answer": the child meets a stimulus (a printed fact, a word said aloud, a picture) '
      + 'and SAYS an answer they were not shown. The workhorse recall skill.',
    schemaDescription: "'say_answer' (produce a spoken answer)",
  },
  read_aloud: {
    promptDoc:
      '"read_aloud": the printed stimulus IS the utterance — the child reads it aloud. '
      + 'Decoding, not recall; the thing on screen is the task, not a leak.',
    schemaDescription: "'read_aloud' (read the printed stimulus aloud)",
  },
  count_and_say: {
    promptDoc:
      '"count_and_say": a group of identical pictures is on screen and the child says HOW MANY. '
      + 'The numeral is never printed.',
    schemaDescription: "'count_and_say' (say how many)",
  },
};

// ── Schema — one bounded array of flat items ────────────────────────────────

const itemSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    stimulusText: {
      type: Type.STRING,
      description:
        'The stimulus. say_answer: the printed prompt ("2 + 1") or, if nothing is printed, the '
        + 'word the tutor says aloud. read_aloud: the exact text the child reads. count_and_say: '
        + 'the PLURAL object word ("bears"). Never contains the answer on a say_answer item.',
    },
    stimulusEmoji: {
      type: Type.STRING,
      description:
        'ONE emoji picturing the stimulus, or an empty string. Required for count_and_say '
        + '(it is what gets drawn). Never an emoji that spells out the answer.',
    },
    printStimulus: {
      type: Type.BOOLEAN,
      description:
        'say_answer ONLY: should the stimulus be PRINTED on screen? true for a written prompt the '
        + 'child looks at ("2 + 1"). FALSE for a listening task, where showing the word would change '
        + 'the skill — a child asked to change a sound in "cat" is doing something different if the '
        + 'letters are in front of them. When false, nothing is printed and your "ask" must contain '
        + 'the word ("Listen: cat. …").',
    },
    stimulusCount: {
      type: Type.INTEGER,
      description:
        `count_and_say ONLY: how many pictures to draw, ${MIN_COUNT}-${MAX_COUNT}. Use 0 for other modes.`,
    },
    ask: {
      type: Type.STRING,
      description:
        'The tutor\'s scripted question, 1-2 short sentences, ending in a hand-over with EXACTLY '
        + 'ONE correct completion. MUST NOT contain the answer or any accepted alternate. '
        + 'say_answer: the ask must SAY the problem itself — the tutor\'s voice is how the problem '
        + 'reaches the child ("Two plus one. What is two plus one?"), never "What is the answer?" '
        + 'with the problem left on screen. read_aloud: the opposite — the ask must NOT contain the '
        + 'printed text. Example of an AMBIGUOUS hand-over to avoid: "Your turn. What word?" after '
        + 'the tutor already said the word — prefer "Three what?".',
    },
    expectedAnswer: {
      type: Type.STRING,
      description:
        'What the child should SAY — 1 to 3 words, sayable by a five-year-old. For count_and_say '
        + 'leave this empty; the count decides it.',
    },
    alsoAccept: {
      type: Type.STRING,
      description:
        'Other answers that are equally correct, comma-separated (e.g. "sofa, settee"). Empty '
        + 'string when there are none. NOT a list — one comma-separated string.',
    },
    acceptRule: {
      type: Type.STRING,
      description:
        'A RIGHT answer for THIS skill that does not look right, written as an instruction to the '
        + 'judge. Example (counting): "Counting aloud that ENDS on the answer counts as that '
        + 'answer — the last number said tells the total." Example (blending): "Sounding the word '
        + 'out and then saying it counts as the answer." Empty string if this skill has none.',
    },
    signatureError: {
      type: Type.STRING,
      description:
        'A WRONG answer for THIS skill that sounds confident and right, written as an instruction '
        + 'to the judge. Example (plurals): "The bare singular said back is NOT the answer." '
        + 'Example (sound manipulation): "The starting word repeated unchanged is NOT the answer." '
        + 'Empty string if this skill has none.',
    },
    correctionBody: {
      type: Type.STRING,
      description:
        'The re-teach, ONE or TWO short sentences, warm and never scolding. It states the right '
        + 'answer and the strategy. Do NOT begin it with "Yes" or "My turn". Do NOT end it with a '
        + 'question — the application adds the re-ask itself.',
    },
  },
  required: ['stimulusText', 'ask', 'expectedAnswer', 'correctionBody'],
};

const buildSchema = (count: number): Schema => ({
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: 'Short, warm activity title. Never names an answer.',
    },
    description: {
      type: Type.STRING,
      description: 'One friendly sentence telling the child they will answer out loud.',
    },
    items: {
      type: Type.ARRAY,
      items: itemSchema,
      minItems: String(count),
      maxItems: String(count),
      description: `Exactly ${count} DIFFERENT practice items.`,
    },
  },
  required: ['title', 'items'],
});

// ── Raw → item ──────────────────────────────────────────────────────────────

interface RawItem {
  stimulusText?: unknown;
  stimulusEmoji?: unknown;
  stimulusCount?: unknown;
  printStimulus?: unknown;
  ask?: unknown;
  expectedAnswer?: unknown;
  alsoAccept?: unknown;
  acceptRule?: unknown;
  signatureError?: unknown;
  correctionBody?: unknown;
}

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const clampCount = (value: unknown): number => {
  const n = typeof value === 'number' ? Math.round(value) : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return MIN_COUNT;
  return Math.max(MIN_COUNT, Math.min(MAX_COUNT, n));
};

/**
 * Build one item, or null if it cannot ship. Both refusals are gates, not
 * fallbacks: a class that cannot be placed is standing gate 1, and a missing
 * ask/answer is an item with nothing to judge.
 */
const buildItem = (
  raw: RawItem,
  index: number,
  mode: SpokenPracticeMode,
): SpokenPracticeItem | null => {
  const shape = MODE_SHAPE[mode];
  const stimulusText = str(raw.stimulusText);
  const ask = str(raw.ask);
  if (!ask || !stimulusText) return null;

  // count_and_say: the COUNT is the truth and the answer is computed from it.
  // Trusting a model-written number word here is how "seven" ends up under six
  // bears (LLM emits the window, code builds the answer).
  const stimulusCount = mode === 'count_and_say' ? clampCount(raw.stimulusCount) : 0;
  const expectedAnswer = mode === 'count_and_say'
    ? numberWordFor(stimulusCount)
    : normalizeSpokenAnswer(str(raw.expectedAnswer));
  if (!expectedAnswer) return null;

  const responseClass = deriveResponseClass(mode, expectedAnswer, stimulusText);
  if (!responseClass) return null;

  const alternates = str(raw.alsoAccept)
    .split(',')
    .map((a) => normalizeSpokenAnswer(a))
    .filter(Boolean)
    // An "alternate" identical to the answer adds noise to the contract — and
    // after normalisation the common case IS identical, because the model
    // routinely offers the digit and the word as if they were two answers.
    .filter((a) => a.toLowerCase() !== expectedAnswer.toLowerCase())
    .slice(0, 4);

  const stimulusEmoji = str(raw.stimulusEmoji).slice(0, 8);
  // 'objects' needs something to draw; without an emoji the mode has no
  // stimulus at all, so fall back to a neutral counter rather than a blank board.
  const emoji = mode === 'count_and_say' && !stimulusEmoji ? '🔵' : stimulusEmoji;

  // How the stimulus APPEARS. Only say_answer varies: a picture, printed text,
  // or nothing at all — and the last is pedagogy, not layout. Showing the word
  // during a sound-manipulation task turns an auditory skill into a visual one.
  const listenOnly = mode === 'say_answer' && raw.printStimulus === false && !emoji;
  const stimulusKind = mode !== 'say_answer'
    ? shape.stimulusKind
    : listenOnly ? 'none' : emoji ? 'emoji' : 'text';

  return {
    id: `dsp-${index + 1}`,
    mode,
    action: mode,
    answerKind: 'voice',
    responseClass,
    stimulusKind,
    answerSource: shape.answerSource,
    stimulusText,
    stimulusEmoji: emoji,
    stimulusCount,
    ask,
    // Code-owned, per MODE — the model wrote filler here on the first live run.
    howToPlay: HOW_TO_PLAY[mode],
    expectedAnswer,
    alternates,
    acceptRule: str(raw.acceptRule),
    signatureError: str(raw.signatureError),
    correctionBody: str(raw.correctionBody) || `The answer is ${expectedAnswer}.`,
  };
};

/** Drop every item that leaks its own answer, prints a count, asks a
 *  question with no problem in it (an ask that never says its stimulus — run
 *  436dcb5616cb), or contradicts its own printed fact ("3 + 2 → six"). All
 *  are content-contract refusals; logged by id so the tester shows what was
 *  dropped. */
const dropLeakingItems = (items: SpokenPracticeItem[]): {
  kept: SpokenPracticeItem[];
  dropped: string[];
} => {
  const bad = new Set(findAnswerLeaks(items).map((leak) => leak.itemId));
  for (const id of findPrintedNumerals(items)) bad.add(id);
  for (const unspoken of findUnspokenStimulus(items)) bad.add(unspoken.itemId);
  for (const mismatch of findArithmeticMismatches(items)) bad.add(mismatch.itemId);
  return {
    kept: items.filter((item) => !bad.has(item.id)),
    dropped: Array.from(bad),
  };
};

// ── Number seeds — code-owned entropy (numberPoolService doctrine) ───────────

/**
 * Structured output is CONVERGENT on free numeric fields regardless of
 * temperature: asked for "adding within 10", flash-lite chose the answer 5
 * first and back-solved the operands to fit it, four times over (run
 * 592abf43424c — 3+2, 2+3, 4+1, 1+4). So code rolls the numbers and the model
 * writes pedagogy around them.
 *
 * Two constraints make this pool unlike the math generators':
 *   - The pack is CONTENT-GENERIC, so the section is conditional IN THE
 *     PROMPT — the model reads whether the topic is numeric natively (a code
 *     classifier would be the retired regex-topic-parse). A literacy topic is
 *     told to ignore the section outright.
 *   - The scope ("within 5") lives only in the topic text, so the TOPIC stays
 *     AUTHORITATIVE over the pool: seeds outside the topic's stated range are
 *     skipped, never used. The candidate set is the full benched band — every
 *     legal value is present, so the shuffle order alone is the entropy and a
 *     narrow topic still finds all of its values in the list.
 */
const buildSeedSection = (mode: SpokenPracticeMode): { section: string; seeds: number[] } => {
  // count_and_say draws what it can DRAW (1-10); spoken answers cap at the
  // benched number-word class (1-20).
  const ceiling = mode === 'count_and_say' ? MAX_COUNT : 20;
  const pool = createDiscretePool(
    Array.from({ length: ceiling - MIN_COUNT + 1 }, (_, i) => MIN_COUNT + i),
  );
  if (!pool) return { section: '', seeds: [] };
  const section = `

NUMBER SEEDS (pre-shuffled by the adaptive system for variety):
- Seeds, in order: ${pool.values.join(', ')}
- ONLY IF the topic involves numbers, arithmetic, or counting: walk the seeds left to right and
  give each item the next usable seed as its TARGET NUMBER — the number the child ends up SAYING
  (the say_answer answer, the count, the printed number to read). Build the rest of the item
  around it: seed 7 → a problem whose answer is 7. Never give two items the same target number.
- The TOPIC is AUTHORITATIVE for range: skip any seed outside what the topic allows ("within 5"
  → seeds above 5 are skipped; "adding within 10" → every ANSWER stays within 10). If the usable
  seeds run out, start again from the first usable one.
- If the topic has nothing to do with numbers (words, sounds, letters, pictures), IGNORE this
  section completely — do not force numbers into the items.`;
  return { section, seeds: pool.values };
};

// ── Prompt ──────────────────────────────────────────────────────────────────

const buildPrompt = (
  topic: string,
  gradeLevel: string,
  mode: SpokenPracticeMode,
  count: number,
  intent: string | undefined,
  seedSection: string,
): string => `Write ${count} spoken Direct Instruction practice items for a ${gradeLevel} learner.

TOPIC: "${topic}"${intent ? `\nOBJECTIVE FOCUS: "${intent}"` : ''}

TASK IDENTITY: ${CHALLENGE_TYPE_DOCS[mode].promptDoc}

HOW THIS RUNS: a live voice tutor speaks your "ask" out loud, the child ANSWERS OUT LOUD,
and the tutor judges what it heard. There are no buttons, no choices on screen, and nothing
to click. The child cannot read instructions — everything reaches them through the tutor's
voice and the picture on screen.

THE RULES THAT MATTER MOST:

1. NEVER PUT THE ANSWER IN THE ASK. Not the answer, not an alternate, not a near form of it.
   The single most common failure in this format is an ask that a child can answer correctly
   without having the skill.

2. THE HAND-OVER MUST HAVE EXACTLY ONE CORRECT COMPLETION. "What do you see?" has many right
   answers and cannot be judged. Ask the one thing you will grade.

3. ${count} ITEMS MEANS ${count} DIFFERENT PROBLEMS — never the same problem asked ${count} ways.
   Vary the content first. Commuted twins ("3 + 2" and "2 + 3") are the SAME problem. For a
   number topic, the NUMBER SEEDS section below hands each item its target number — use it.

4. THE ANSWER IS 1-3 SHORT SPOKEN WORDS. If the honest answer to your ask is a sentence or an
   open-ended list, the item does not belong in this format — write a different item.

5. "acceptRule" AND "signatureError" ARE THE HARD PART, AND THEY ARE WHY THIS FORMAT WORKS.
   Think about how a child who HAS the skill might sound wrong, and how a child who LACKS it
   might sound right:
   - acceptRule: the right answer that does not look right. A child counting aloud who lands
     on the total HAS answered. A child who sounds a word out and then says it HAS read it.
   - signatureError: the wrong answer that sounds right. The starting word repeated back. The
     singular when you asked for the plural. The number you gave them in the question.
   Leave either empty ONLY if this skill genuinely has none — most skills have at least one.

   ⚠ THE JUDGE ONLY EVER HEARS AUDIO. It cannot see the child, the screen, or their hands.
   Both clauses must describe something SAYABLE and HEARABLE. Never write a rule about counting
   on fingers, tapping, pointing, looking, holding up, or writing — those are silent, so a rule
   about them tells the judge nothing it can act on. "Counting aloud and landing on the total"
   is hearable; "counting on their fingers" is not.

6. THE CORRECTION RE-TEACHES, it does not scold, and it does not end with a question (the
   application re-asks by itself). Never begin it with "Yes" or "My turn".

${mode === 'count_and_say'
    ? `COUNTING SPECIFICS: give the plural object word in "stimulusText" ("bears"), one emoji for it,
and a "stimulusCount" from ${MIN_COUNT} to ${MAX_COUNT}. Leave "expectedAnswer" empty — the count decides it.
Never write a digit anywhere.`
    : mode === 'read_aloud'
      ? `READING SPECIFICS: "stimulusText" is the exact text the child reads and "expectedAnswer" is that
same text. The printed words ARE the task here, so they are not a leak — but your "ask" still must
not contain them ("What word?" / "Read it out loud.").`
      : `SPEAKING SPECIFICS: the tutor's VOICE is how the problem reaches the child — your "ask" must SAY
the problem itself and then hand it over ("Two plus one. What is two plus one?" / "Listen: cat. Now say it
without the /k/."). Never write an ask that only points at the screen ("Here is a problem. What is the
answer?") — a child who cannot read hears a question with no problem in it. The printed stimulus is
reinforcement, not the carrier. Set "printStimulus" true for a written prompt worth showing ("2 + 1"),
and FALSE for a listening task where seeing the word would change the skill — printing the word during a
sound task changes what is being practised; leave the emoji empty there. If a PICTURE is the stimulus,
give the emoji and keep "stimulusText" to the thing pictured — then the ask asks ABOUT the picture
without naming it.`}${seedSection}

Return the JSON only.`;

// ── Generate ────────────────────────────────────────────────────────────────

const callModel = async (
  prompt: string,
  count: number,
): Promise<{ title?: string; description?: string; items?: unknown }> => {
  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: buildSchema(count),
      // A bounded array plus a hard token ceiling turns a runaway into a fast
      // truncation instead of malformed JSON (flash-lite truncation template).
      maxOutputTokens: 8192,
      systemInstruction:
        'You are a Direct Instruction specialist writing brisk spoken call-and-response practice '
        + 'for young children. Every item is answered ALOUD and judged by ear. You never reveal an '
        + 'answer in the question, and you always name how a right answer might sound wrong and how '
        + 'a wrong answer might sound right.',
    },
  });
  const text = response.text;
  if (!text) return {};
  return JSON.parse(text) as { title?: string; description?: string; items?: unknown };
};

export const generateDiSpokenPractice = async (
  topic: string,
  gradeLevel: string,
  config?: {
    intent?: string;
    objectiveText?: string;
    challengeCount?: number;
    targetEvalMode?: string;
    [key: string]: unknown;
  },
): Promise<DiSpokenPracticeData> => {
  const intent = config?.intent;
  const count = Math.min(
    MAX_ITEM_COUNT,
    Math.max(MIN_ITEM_COUNT, config?.challengeCount ?? DEFAULT_ITEM_COUNT),
  );

  const resolution = await resolveEvalModes(
    'di-spoken-practice',
    { targetEvalMode: config?.targetEvalMode, intent, objectiveText: config?.objectiveText },
    CHALLENGE_TYPE_DOCS,
  );
  // Unconstrained ("mixed") resolves to the recall workhorse rather than a
  // blend: the three modes need different stimuli, and a blended session would
  // change the ACTION on nearly every item, so the tutor would re-speak the
  // how-to-play continuously.
  const mode: SpokenPracticeMode =
    (resolution?.allowedTypes?.[0] as SpokenPracticeMode | undefined) ?? 'say_answer';

  let title = 'Say It Out Loud';
  let description = 'Listen to your tutor, then answer out loud!';
  let items: SpokenPracticeItem[] = [];
  let dropped: string[] = [];
  let seeds: number[] = [];

  // One retry: a truncated or leaky first pass is common enough on flash-lite
  // that a second ask is cheaper than shipping a short session. The seed pool
  // re-rolls per attempt, so a retry escapes a degenerate first draw too.
  for (let attempt = 0; attempt < 2 && items.length === 0; attempt++) {
    try {
      const seeded = buildSeedSection(mode);
      seeds = seeded.seeds;
      const parsed = await callModel(
        buildPrompt(topic, gradeLevel, mode, count, intent, seeded.section),
        count,
      );
      if (typeof parsed.title === 'string' && parsed.title.trim()) title = parsed.title.trim();
      if (typeof parsed.description === 'string' && parsed.description.trim()) {
        description = parsed.description.trim();
      }
      const raw = Array.isArray(parsed.items) ? (parsed.items as RawItem[]) : [];
      const built = raw
        .map((item, i) => buildItem(item, i, mode))
        .filter((item): item is SpokenPracticeItem => item !== null);
      const result = dropLeakingItems(built);
      items = result.kept;
      dropped = result.dropped;
      if (items.length > 0 && attempt > 0) {
        console.warn('[DiSpokenPractice] first attempt yielded no usable items; retry succeeded');
      }
    } catch (error) {
      console.error('[DiSpokenPractice] generation failed:', error);
    }
  }

  // No curated fallback exists for a content-generic pack, and inventing one
  // would ship items unscoped to the objective. An empty set renders an honest
  // "nothing to practise" state — pedagogy over runnability (CLAUDE.md §1).
  if (items.length === 0) {
    console.error(
      `[DiSpokenPractice] no usable items for topic "${topic}" (mode ${mode}) — refusing to invent content`,
    );
  } else if (items.length < MIN_ITEM_COUNT) {
    // A thin session is a real finding, not a cosmetic one: single-mode
    // practice needs 3-6 instances to measure anything (mastery-over-demo).
    console.warn(
      `[DiSpokenPractice] THIN SESSION — ${items.length} of ${count} items survived the gates `
      + `(dropped: ${dropped.join(', ') || 'none for leaks'}); the rest failed the response-class clamp.`,
    );
  }

  console.log('[DiSpokenPractice] generated:', {
    title,
    mode: resolution ? `${mode} (${resolution.source})` : mode,
    // The first few seeds are the run's entropy — four items should land on
    // (roughly) the first four usable ones. All-one-answer means the model
    // ignored the pool; report it.
    seeds: seeds.slice(0, 8).join(','),
    answers: items.map((i) => i.expectedAnswer),
    kept: items.length,
    droppedForLeak: dropped.length,
    droppedIds: dropped,
    withAcceptRule: items.filter((i) => i.acceptRule).length,
    withSignatureError: items.filter((i) => i.signatureError).length,
    responseClasses: Array.from(new Set(items.map((i) => i.responseClass))),
  });

  return {
    title,
    description,
    challengeType: mode,
    gradeLevel: gradeLevel || 'kindergarten',
    items,
  };
};
