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
import {
  planSpokenPractice, modeForSpokenPlan, buildPlannedSpokenItems, hasPlannedCoverage,
  buildSubjectVerbAgreementItems, hasSubjectVerbAgreementCoverage,
  spokenChoiceMenu, hasChoiceCoverage, spokenConceptPlan, hasConceptCoverage,
} from './spokenPracticePlan';
import type { DiSpokenPracticeData } from '../../primitives/visual-primitives/direct-instruction/DiSpokenPractice';
import {
  buildSpokenItem,
  CONCEPT_ANCHOR_MAX_WORDS,
  CONCEPT_STATEMENT_MAX_WORDS,
  CONCEPT_STATEMENT_MIN_WORDS,
  gateSpokenItems,
  MAX_COUNT,
  MIN_COUNT,
  type RawSpokenItem,
  type SpokenPracticeItem,
  type SpokenPracticeMode,
} from '../../primitives/visual-primitives/direct-instruction/diSpokenPracticeScript';

/** Task interpretation and review are semantic judgments (spokenPracticePlan's
 *  ruling); the explain review below is the same authority one layer down. */
const REVIEW_MODEL = 'gemini-flash-latest';

const DEFAULT_ITEM_COUNT = 4;
const MAX_ITEM_COUNT = 6;
const MIN_ITEM_COUNT = 3;

// ── Eval-mode routing (Fork A discipline: code stamps the mode) ──────────────

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  say_answer: {
    promptDoc:
      '"say_answer": the child meets a stimulus (a printed fact, a word said aloud, a picture) '
      + 'and SAYS an answer they were not shown. Includes naming a displayed symbol/picture: '
      + 'the visual is the question and its name must NOT be spoken before the child answers.',
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
  compare_choice: {
    promptDoc:
      '"compare_choice": TWO things are on screen and the child says which word from a fixed, '
      + 'stated set describes them (longer/shorter, heavier/lighter). The tutor reads the WHOLE '
      + 'word menu on every item, so the menu is not a hint — knowing which word fits the pair is '
      + 'the skill. Use it when the objective names the words the child must produce.',
    schemaDescription: "'compare_choice' (say which word describes a pair)",
  },
  explain_concept: {
    promptDoc:
      '"explain_concept": the child sees ONE instance (an equation, a pattern, a ten rod) and says '
      + 'IN THEIR OWN WORDS what it means, why it is so, or what rule governs it. The answer is an '
      + 'IDEA with many correct wordings, judged on meaning; the ask never states the concept. Use it '
      + 'for explain / describe / tell-why objectives whose answer is a short proposition.',
    schemaDescription: "'explain_concept' (say in your own words what it means or what the rule is)",
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
        + 'the PLURAL object word ("bears"). compare_choice: the FIRST of the two things being '
        + 'compared, as its everyday name ("a feather"). Never contains the answer on a '
        + 'say_answer or compare_choice item.',
    },
    stimulusEmoji: {
      type: Type.STRING,
      description:
        'ONE emoji picturing the stimulus, or an empty string. Required for count_and_say '
        + '(it is what gets drawn) and for compare_choice (the FIRST of the two things). '
        + 'Never an emoji that spells out the answer. For riddles or context-clue tasks this is '
        + 'always empty: the clues, not a picture of their answer, must determine the response.',
    },
    stimulusText2: {
      type: Type.STRING,
      description:
        'compare_choice ONLY: the SECOND thing being compared, as its everyday name ("a rock"). '
        + 'Empty string for every other mode. Must not contain any word from the choice menu.',
    },
    stimulusEmoji2: {
      type: Type.STRING,
      description:
        'compare_choice ONLY: ONE emoji for the second thing, different from the first. '
        + 'Empty string for every other mode.',
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
        + 'say_answer listening/arithmetic tasks: the ask must SAY the problem itself — the tutor\'s voice is how the problem '
        + 'reaches the child ("Two plus one. What is two plus one?"), never "What is the answer?" '
        + 'with the problem left on screen. Visual naming instead asks about the displayed target without naming it. '
        + 'read_aloud: the opposite — the ask must NOT contain the '
        + 'printed text. Example of an AMBIGUOUS hand-over to avoid: "Your turn. What word?" after '
        + 'the tutor already said the word — prefer "Three what?".',
    },
    expectedAnswer: {
      type: Type.STRING,
      description:
        'What the child should SAY — 1 to 3 words, sayable by a five-year-old. For count_and_say '
        + 'leave this empty; the count decides it. explain_concept: the PRIMARY ANCHOR — the shortest '
        + `correct wording of the idea, 1-${CONCEPT_ANCHOR_MAX_WORDS} words ("plus two", "both sides the same"); an example `
        + 'for the judge, never a required wording.',
    },
    conceptStatement: {
      type: Type.STRING,
      description:
        `explain_concept ONLY: the idea in ONE sentence, ${CONCEPT_STATEMENT_MIN_WORDS}-${CONCEPT_STATEMENT_MAX_WORDS} words, true for THIS instance `
        + '("This pattern grows by adding two each time."). The judge holds it, and speaks it back as '
        + 'the affirmation. Empty string for every other mode.',
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
  menu: readonly string[],
  concept?: { conceptStatement: string; anchors: readonly string[] },
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
   Explicit named sets are allocated separately by code; this call writes open practice.

4. THE ANSWER IS 1-3 SHORT SPOKEN WORDS. If the honest answer to your ask is a sentence or an
   open-ended list, the item does not belong in this format — write a different item.
   (explain_concept is the one exception: the CHILD may say up to ten words, and your
   "expectedAnswer"/"alsoAccept" are short ANCHOR wordings of the idea, not the required answer.)

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

${mode === 'explain_concept'
    ? `EXPLAINING SPECIFICS: every item shows ONE instance and asks the child to say what it means or what
rule it follows, in their own words. This is the one mode where the answer is an IDEA, not a token.
- "stimulusText" is the INSTANCE the child looks at — an equation ("3 + 2 = 5"), a pattern ("2, 4, 6, 8",
  "red, blue, red, blue"), a base-ten picture. ${count} items means ${count} DIFFERENT instances${concept
      ? ' of the SAME concept'
      : ', each with its own rule'}. Vary what is on screen; a concept asked over the same equation twice is recall.
  If the objective names a KIND of thing (a REPEATING pattern, a GROWING pattern, an equation with two
  sides), every instance is that kind and never its sibling — a growing pattern under a repeating-pattern
  objective is rejected by the reviewer, and so is a shrinking one under "repeating or growing".
- Your "ask" must SAY the instance out loud ("Three plus two equals five. What does the equal sign tell
  us?" / "Two, four, six, eight. What is the rule of this pattern?") and then ask the bare question.
  ⚠ The ask must NOT state, hint, or half-state the idea, and must NOT contain any anchor wording. Never
  model the concept before asking — the re-teach lives in "correctionBody" and nowhere else.
${concept
      ? `- The concept and its anchors are FIXED for this session and stamped in by the application: the idea is
  "${concept.conceptStatement}" and the anchors are ${concept.anchors.map((a) => `"${a}"`).join(', ')}. Leave
  "expectedAnswer", "alsoAccept" and "conceptStatement" EMPTY — they are ignored — and write ${count} different
  instances this idea is true of.`
      : `- "conceptStatement" is the idea for THIS instance in ONE sentence, ${CONCEPT_STATEMENT_MIN_WORDS}-${CONCEPT_STATEMENT_MAX_WORDS} words, TRUE and
  grade-appropriate ("This pattern grows by adding two each time."). "expectedAnswer" is its shortest correct
  wording (1-${CONCEPT_ANCHOR_MAX_WORDS} words: "plus two") and "alsoAccept" holds 1-2 more short wordings ("add two, counting
  by twos"). Every anchor must name the SPECIFIC unit or amount of THIS instance ("plus two", "red then
  blue") — never a generic that fits any pattern ("it repeats", "alternating", "it goes up"); a generic is
  half an answer and the reviewer rejects it. None of them may be the instance read back.`}
- "acceptRule" names the wordings that count even without the anchor words ("any words that say the two
  sides match or are even count"). "signatureError" names the TRUE-BUT-NOT-AN-EXPLANATION answers: the
  result ("saying the sum, five, is NOT an explanation"), the next term, the thing's name, and the
  documented misconception ("saying = means the answer comes next is NOT correct").
- "correctionBody" states the idea plainly, then shows it on this instance. One or two sentences.
- Leave "printStimulus" and "stimulusCount" alone; give "stimulusEmoji" only when a picture IS the instance.`
    : mode === 'compare_choice'
    ? `COMPARING SPECIFICS: every item shows TWO things and asks which word describes them. The word menu is
FIXED and the same on every item: ${menu.join(', ')}. The child says exactly one of those words.
- Put the FIRST thing in "stimulusText"/"stimulusEmoji" and the SECOND in "stimulusText2"/"stimulusEmoji2".
  Both need an emoji — the pair IS the screen. Use two different everyday things a five-year-old knows,
  and make the comparison true in REAL LIFE (a feather and a rock), never a matter of how big the
  pictures happen to look.
- Your "ask" must NAME BOTH THINGS OUT LOUD and then read the WHOLE menu, every time, in the order above:
  "Here is a feather, and here is a rock. Is the rock longer, shorter, heavier, or lighter?"
  ⚠ Reading the whole menu is the ONE exception to rule 1 — it is safe precisely BECAUSE every word is
  offered every time, so the ask says nothing about which is right. An ask that offers only some of the
  words ("longer or heavier?") narrows the field for the child and the item is DROPPED.
- Neither thing's name may contain a menu word OR ITS ROOT. "the longer stick" hands the answer
  over, and so do "a LONG pencil", "a HEAVY rock" and "a LIGHT feather" — describe the things by
  WHAT THEY ARE ("a pencil", "a rock", "a feather"), never by the attribute being asked about.
- "expectedAnswer" is exactly one menu word, spelled as written above. Across the ${count} items use
  EVERY menu word at least once; a menu word that is never asked leaves that part of the skill untested.
- Leave "printStimulus" and "stimulusCount" alone.`
    : mode === 'count_and_say'
      ? `COUNTING SPECIFICS: give the plural object word in "stimulusText" ("bears"), one emoji for it,
and a "stimulusCount" from ${MIN_COUNT} to ${MAX_COUNT}. Leave "expectedAnswer" empty — the count decides it.
Never write a digit anywhere.`
      : mode === 'read_aloud'
        ? `READING SPECIFICS: "stimulusText" is the exact text the child reads and "expectedAnswer" is that
same text. The printed words ARE the task here, so they are not a leak — but your "ask" still must
not contain them ("What word?" / "Read it out loud.").`
        : `SPEAKING SPECIFICS FOR LISTENING/ARITHMETIC: the tutor's VOICE is how the problem reaches the child — your "ask" must SAY
the problem itself and then hand it over ("Two plus one. What is two plus one?" / "Listen: cat. Now say it
without the /k/."). Never write an ask that only points at the screen ("Here is a problem. What is the
answer?") — a child who cannot read hears a question with no problem in it. The printed stimulus is
reinforcement, not the carrier. Set "printStimulus" true for a written prompt worth showing ("2 + 1"),
and FALSE for a listening task where seeing the word would change the skill — printing the word during a
sound task changes what is being practised; leave the emoji empty there. If a PICTURE is the stimulus,
give the emoji and keep "stimulusText" to the thing pictured — then the ask asks ABOUT the picture
without naming it. A picture is valid only when the picture itself is the evidence being questioned and
its label is NOT an accepted answer. For a riddle or context-clue task, the spoken clues are the entire
stimulus: put the complete clue wording in BOTH "stimulusText" and "ask", set "printStimulus" false,
and leave "stimulusEmoji" empty. Never illustrate the riddle's answer.`}${seedSection}

Return the JSON only.`;

// ── Explain review — the semantic half of the concept gate ──────────────────

/**
 * ONE flash-latest call per explain session, and the only place an anchor's
 * MEANING is checked. `findConceptDefects` (script module) proves an item's
 * SHAPE; nothing in the sources grounds a paraphrase, so whether "both sides
 * the same" is what = means for THIS stimulus is a semantic judgment — the
 * same authority split as `planSpokenPractice`'s plan + review, one layer down.
 * A rejected item is dropped by id; a rejected SESSION (instances do not vary)
 * empties it, and the retry loop draws again once. Two failures ship `items: []`
 * — pedagogy over runnability.
 */
const reviewConceptItems = async (
  items: SpokenPracticeItem[],
  context: { topic: string; gradeLevel: string; objectiveText?: string; intent?: string },
): Promise<{ kept: SpokenPracticeItem[]; rejected: string[]; reason: string }> => {
  if (!items.length) return { kept: [], rejected: [], reason: '' };
  const response = await ai.models.generateContent({
    model: REVIEW_MODEL,
    contents: `Independently check these spoken EXPLAIN items against the objective.
CONTEXT: ${JSON.stringify(context)}
ITEMS: ${JSON.stringify(items.map((i) => ({
      id: i.id, instance: i.stimulusText, ask: i.ask, conceptStatement: i.conceptStatement,
      anchors: [i.expectedAnswer, ...i.alternates], acceptRule: i.acceptRule, signatureError: i.signatureError,
    })))}
For EACH item: is conceptStatement a TRUE, grade-appropriate statement of what the objective asks the
child to explain, for THIS instance? Does every anchor mean the same thing as the concept sentence?
Would a child who says only an anchor have shown the understanding the objective names? Does the ask
give the idea away? Reject the ITEM (by id) on any no. Reject the SESSION only if two items show the
SAME thing on screen (the same equation, the same pattern) — different equations that happen to share
a total ("3 + 2 = 5" and "1 + 4 = 5") are different instances and are fine.
Return rejectedIds (empty if all pass), sessionValid, and a short reason.`,
    config: {
      responseMimeType: 'application/json', maxOutputTokens: 8192, httpOptions: { timeout: 45000 },
      responseSchema: { type: Type.OBJECT, properties: {
        rejectedIds: { type: Type.ARRAY, items: { type: Type.STRING } },
        sessionValid: { type: Type.BOOLEAN }, reason: { type: Type.STRING },
      }, required: ['rejectedIds', 'sessionValid', 'reason'] },
    },
  });
  const verdict = JSON.parse(response.text || '{}') as { rejectedIds?: unknown; sessionValid?: unknown; reason?: unknown };
  const reason = typeof verdict.reason === 'string' ? verdict.reason : '';
  if (verdict.sessionValid !== true) return { kept: [], rejected: items.map((i) => i.id), reason };
  const rejected = new Set(Array.isArray(verdict.rejectedIds)
    ? verdict.rejectedIds.filter((id): id is string => typeof id === 'string') : []);
  return { kept: items.filter((i) => !rejected.has(i.id)), rejected: Array.from(rejected), reason };
};

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
  let count = Math.min(
    MAX_ITEM_COUNT,
    Math.max(MIN_ITEM_COUNT, Number.isFinite(config?.challengeCount)
      ? Math.floor(config!.challengeCount!) : DEFAULT_ITEM_COUNT),
  );

  const resolution = await resolveEvalModes(
    'di-spoken-practice',
    { targetEvalMode: config?.targetEvalMode, intent, objectiveText: config?.objectiveText },
    CHALLENGE_TYPE_DOCS,
  );
  // One coherent action per session. The plan may choose within an allowed
  // blend (or an unconstrained request), but cannot override a single-mode pin.
  let mode: SpokenPracticeMode =
    (resolution?.allowedTypes?.[0] as SpokenPracticeMode | undefined) ?? 'say_answer';

  // The planner owns task interpretation and required membership. A wrong pin
  // is refused, never silently converted into a different scored mode.
  const empty = (): DiSpokenPracticeData => ({
    title: 'Say It Out Loud', description: 'No matching practice is available for this task.',
    challengeType: mode, gradeLevel, items: [],
  });
  let plan;
  try {
    plan = await planSpokenPractice(topic, gradeLevel, intent, config?.objectiveText, resolution?.allowedTypes);
  } catch (error) {
    console.error('[DiSpokenPractice] incomplete session:', error);
    return empty();
  }
  const plannedMode = modeForSpokenPlan(plan);
  if (plannedMode && (!resolution || resolution.allowedTypes.includes(plannedMode))) mode = plannedMode;
  if (plannedMode !== mode) {
    console.error(`[DiSpokenPractice] task/mode conflict: ${plan.task} cannot run as ${mode}`);
    return empty();
  }
  // A compare_choice plan hands over a MENU, not a stimulus mapping: code owns
  // WHICH words must be produced, the model writes the object pairs around them,
  // and `hasChoiceCoverage` re-checks the set after the gates. Every other
  // planned task allocates its targets directly, with no second model call.
  const menu = spokenChoiceMenu(plan);
  if (menu.length) count = Math.min(MAX_ITEM_COUNT, Math.max(count, menu.length));
  // A named-concept explain plan likewise hands over a session-wide SLOT (the
  // sentence + anchors) that code stamps into every generated instance.
  const concept = spokenConceptPlan(plan);

  if (plan.task === 'subject_verb_agreement') {
    const result = gateSpokenItems(buildSubjectVerbAgreementItems(count));
    if (!hasSubjectVerbAgreementCoverage(result.kept, count)) {
      console.error('[DiSpokenPractice] subject-verb session incomplete after gates:', result.reasons);
      return empty();
    }
    console.log('[DiSpokenPractice] planned subject-verb session:', {
      kept: result.kept.length,
      pairs: result.kept.map(item => `${item.agreementPairId}:${item.agreementNumber}`),
      answers: result.kept.map(item => item.expectedAnswer),
    });
    return {
      title: 'Finish the Sentence',
      description: 'Listen to each sentence and say the missing word!',
      challengeType: mode,
      gradeLevel,
      items: result.kept,
    };
  }

  if (plan.targets.length && !menu.length && !concept) {
    count = Math.max(count, plan.targets.length);
    // Plans have a six-target ceiling. Every required target is allocated before
    // repetition, and every dependent field comes from the same checked mapping.
    const result = gateSpokenItems(buildPlannedSpokenItems(plan, count));
    if (!hasPlannedCoverage(plan, result.kept, count)) {
      console.error('[DiSpokenPractice] planned session incomplete after gates:', result.dropped);
      return empty();
    }
    console.log('[DiSpokenPractice] planned session:', {
      mode, task: plan.task, closedSet: plan.closedSet,
      targets: plan.targets.map(t => ({ stimulus: t.stimulusText, answer: t.expectedAnswer })),
      kept: result.kept.length,
    });
    return { title: 'Say It Out Loud', description: 'Look, then answer out loud!',
      challengeType: mode, gradeLevel, items: result.kept };
  }

  let title = 'Say It Out Loud';
  let description = 'Listen to your tutor, then answer out loud!';
  let items: SpokenPracticeItem[] = [];
  let dropped: string[] = [];
  let seeds: number[] = [];
  // An explain session is gated twice (shape, then a semantic review), so it
  // is asked for spare capacity and shipped at `count` — "ask 5-8, ship 5":
  // a distinctness/meaning guard with no headroom empties the session on two
  // rejected items (the first pilot: 3/6 fresh draws shipped nothing). The
  // survivors POOL across the two attempts, deduped by instance, instead of
  // each attempt replacing the last.
  const explain = mode === 'explain_concept';
  const askCount = explain ? Math.min(MAX_ITEM_COUNT, count + 2) : count;
  let pool: SpokenPracticeItem[] = [];

  // One retry: a truncated or leaky first pass is common enough on flash-lite
  // that a second ask is cheaper than shipping a short session. The seed pool
  // re-rolls per attempt, so a retry escapes a degenerate first draw too.
  const menuCovered = () => !menu.length || hasChoiceCoverage(menu, items);
  const conceptCovered = () => !concept || hasConceptCoverage(concept, items);
  for (let attempt = 0; attempt < 2 && (items.length < MIN_ITEM_COUNT || !menuCovered() || !conceptCovered()); attempt++) {
    try {
      // A menu session is about objects, never numbers — the seed pool would
      // only invite arithmetic into a measurement lesson. An explain session's
      // child never SAYS a number, so the seeds' "target number" instruction
      // has nothing to attach to there either.
      const seeded = menu.length || mode === 'explain_concept' ? { section: '', seeds: [] } : buildSeedSection(mode);
      seeds = seeded.seeds;
      const parsed = await callModel(
        buildPrompt(topic, gradeLevel, mode, askCount,
          [config?.objectiveText, intent].filter(Boolean).join(' — ') || undefined, seeded.section, menu, concept),
        askCount,
      );
      if (typeof parsed.title === 'string' && parsed.title.trim()) title = parsed.title.trim();
      if (typeof parsed.description === 'string' && parsed.description.trim()) {
        description = parsed.description.trim();
      }
      const raw = Array.isArray(parsed.items) ? (parsed.items as RawSpokenItem[]) : [];
      const built = raw
        .map((item, i) => buildSpokenItem(item, i, mode, menu, concept))
        .filter((item): item is SpokenPracticeItem => item !== null);
      const result = gateSpokenItems(built);
      items = result.kept;
      dropped = result.dropped;
      if (dropped.length) console.warn('[DiSpokenPractice] gate drops:', result.reasons);
      // The semantic half of the concept gate — shape passed, now meaning.
      if (explain) {
        const review = items.length
          ? await reviewConceptItems(items, { topic, gradeLevel, objectiveText: config?.objectiveText, intent })
          : { kept: [], rejected: [], reason: '' };
        if (review.rejected.length) {
          console.warn(`[DiSpokenPractice] explain review rejected ${review.rejected.join(', ')}: ${review.reason}`);
          dropped = [...dropped, ...review.rejected];
        }
        const seen = new Set(pool.map((i) => i.stimulusText.trim().toLowerCase()));
        for (const item of review.kept) {
          const key = item.stimulusText.trim().toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          pool.push(item);
        }
        items = pool.slice(0, count).map((item, i) => ({ ...item, id: `dsp-${i + 1}` }));
      }
      if (items.length > 0 && attempt > 0) {
        console.warn('[DiSpokenPractice] first attempt yielded no usable items; retry succeeded');
      }
    } catch (error) {
      console.error('[DiSpokenPractice] generation failed:', error);
    }
  }

  // A menu the objective NAMED but the session never asked is the named-set
  // failure this plan exists to prevent, so a partial menu ships nothing —
  // the same refusal `hasPlannedCoverage` makes for an allocated target set.
  if (menu.length && items.length && !hasChoiceCoverage(menu, items)) {
    const missing = menu.filter((word) => !items.some(
      (i) => i.expectedAnswer.trim().toLowerCase() === word.trim().toLowerCase()));
    console.error(`[DiSpokenPractice] menu incomplete — never asked: ${missing.join(', ')}`);
    items = [];
  }
  // A named concept asked over the same instance twice is recall of a sentence;
  // a session whose items lost the planned sentence is not the plan.
  if (concept && items.length && !hasConceptCoverage(concept, items)) {
    console.error('[DiSpokenPractice] concept session incomplete — instances repeat or the planned anchors drifted');
    items = [];
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
    items = [];
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
    menu: menu.join(',') || undefined,
    concept: concept?.conceptStatement ?? (mode === 'explain_concept' ? 'per-item' : undefined),
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
