import { Type, type Schema } from '@google/genai';
import { ai } from '../geminiClient';
import {
  CONCEPT_ANCHOR_MAX_WORDS, CONCEPT_STATEMENT_MAX_WORDS, CONCEPT_STATEMENT_MIN_WORDS,
  deriveResponseClass, HOW_TO_PLAY, normalizeConceptAnchors, normalizeSpokenAnswer, wordCount,
  type SpokenPracticeItem, type SpokenPracticeMode,
} from '../../primitives/visual-primitives/direct-instruction/diSpokenPracticeScript';

const TASKS = [
  'visual_naming', 'read_aloud', 'say_answer', 'subject_verb_agreement', 'count_and_say',
  'compare_choice', 'explain_concept', 'unsupported',
] as const;
type Task = typeof TASKS[number];
// Task interpretation and review are semantic judgments, like lesson coverage.
// Flash Lite approved empty generic plans for explicit symbol-naming sets in
// the DSP retest. Keep it for open item generation, not the plan's authority.
const PLAN_MODEL = 'gemini-flash-latest';

export interface SpokenTarget {
  id: string;
  stimulusText: string;
  stimulusEmoji: string;
  expectedAnswer: string;
  alternates: string[];
  sourceQuote: string;
}

export interface SpokenPracticePlan {
  task: Task;
  closedSet: boolean;
  targets: SpokenTarget[];
  /**
   * explain_concept ONLY, and only when the objective names ONE concept (the
   * equal sign, a ten rod): the sentence the judge holds on every item, stated
   * once here and stamped into each generated instance by code. Empty for the
   * per-instance shape (the rule of THIS pattern), where each item carries its
   * own — and for every other task.
   */
  conceptStatement?: string;
}

// Built via the RegExp constructor, not a /u-flagged literal: this project's
// es5 compile target rejects the `u` flag on regex literal syntax (TS1501),
// but a string-built pattern is only checked at runtime, where Node's regex
// engine has supported \p{} Unicode property escapes since ES2018.
const TOKEN_PATTERN = new RegExp("[\\p{L}\\p{N}]+(?:['’][\\p{L}\\p{N}]+)*|[^\\s]", 'gu');

/** Syntactic inventory only: the model decides WHICH tokens are instructional
 * targets. IDs keep punctuation/Unicode intact across structured generation. */
export function spokenSourceTokens(sources: string[]): Array<{ id: string; text: string }> {
  const tokens = new Set(sources.flatMap(s => s.match(TOKEN_PATTERN) ?? []));
  return Array.from(tokens).map((text, i) => ({ id: `t${i + 1}`, text }));
}

const planSchema = (sources: string[]): Schema => ({
  type: Type.OBJECT,
  properties: {
    task: { type: Type.STRING, enum: [...TASKS] },
    closedSet: { type: Type.BOOLEAN },
    conceptStatement: {
      type: Type.STRING,
      description: 'explain_concept with ONE named concept only: the idea in one sentence, 4-12 words. '
        + 'Empty string for every other case.',
    },
    targets: {
      // flash-latest rejects maxItems in responseSchema; parseSpokenPlan owns
      // the six-target ceiling (same API constraint as lesson coverage).
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          stimulusId: { type: Type.STRING, enum: [...spokenSourceTokens(sources).map(t => t.id), 'picture'] },
          stimulusText: { type: Type.STRING, description: 'Picture label ONLY; empty for a selected text token.' },
          stimulusEmoji: { type: Type.STRING },
          expectedAnswer: { type: Type.STRING },
          alsoAccept: { type: Type.STRING, description: 'Comma-separated equally correct names; empty if none.' },
          sourceId: { type: Type.STRING, enum: sources.map((_, i) => `s${i + 1}`) },
        },
        required: ['stimulusId', 'stimulusText', 'stimulusEmoji', 'expectedAnswer', 'alsoAccept', 'sourceId'],
      },
    },
  },
  required: ['task', 'closedSet', 'conceptStatement', 'targets'],
});

const text = (v: unknown): string => typeof v === 'string' ? v.trim() : '';
const record = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};

/** Structural/grounding checks precede a separate semantic review. Grounding
 * alone does not prove that the model extracted the complete or correct set. */
export function parseSpokenPlan(raw: unknown, sources: string[]): SpokenPracticePlan {
  const value = record(raw);
  const tokens = spokenSourceTokens(sources);
  if (!TASKS.includes(value.task as Task) || typeof value.closedSet !== 'boolean'
    || !Array.isArray(value.targets) || value.targets.length > 6) throw new Error('Invalid task plan');
  const task = value.task as Task;
  // The class a planned target's answer must place in. explain_concept answers
  // are ANCHORS (≤ 4 words) of an idea, not tokens, so they get their own class
  // rather than being clamped as say_answer recall.
  const answerMode: SpokenPracticeMode = task === 'read_aloud' ? 'read_aloud'
    : task === 'explain_concept' ? 'explain_concept' : 'say_answer';
  const targets = value.targets.map((rawTarget, i): SpokenTarget => {
    const t = record(rawTarget);
    const picture = t.stimulusId === 'picture';
    const selected = tokens.find(token => token.id === t.stimulusId);
    const stimulusText = picture ? text(t.stimulusText) : selected?.text ?? '';
    const stimulusEmoji = picture ? text(t.stimulusEmoji) : '';
    const expectedAnswer = normalizeSpokenAnswer(text(t.expectedAnswer));
    const sourceIndex = sources.findIndex((_, i) => `s${i + 1}` === t.sourceId);
    const sourceQuote = sources[sourceIndex] ?? '';
    const offered = text(t.alsoAccept).split(',').map(normalizeSpokenAnswer)
      .filter(a => a && a.toLowerCase() !== expectedAnswer.toLowerCase());
    // Explain anchors are tidied here ONCE (redundant wordings dropped, capped)
    // so the stamped set is already in its final form when items carry it.
    const alternates = task === 'explain_concept' ? normalizeConceptAnchors(expectedAnswer, offered) : offered;
    if (!stimulusText || !expectedAnswer || !sourceQuote || (picture ? !stimulusEmoji : !sourceQuote.includes(stimulusText))
      || !deriveResponseClass(answerMode, expectedAnswer, stimulusText)
      || alternates.some(a => !deriveResponseClass(answerMode, a, stimulusText))) {
      throw new Error('Ungrounded or unsupported target');
    }
    if (task === 'read_aloud' && (stimulusEmoji
      || normalizeSpokenAnswer(stimulusText).toLowerCase() !== expectedAnswer.toLowerCase()
      || alternates.length)) throw new Error('Reading target does not match printed text');
    // A compare_choice target is a MENU WORD, not a stimulus: the required word
    // quoted from the objective's own text ("longer"), grounded through the same
    // token inventory that grounds a printed symbol. The two OBJECTS each item
    // compares are not in the objective and are written later, by the item
    // generator — which is why this task alone plans a set without planning
    // items (see `buildPlannedSpokenItems`, which refuses to build them).
    if (task === 'compare_choice' && (stimulusEmoji
      || normalizeSpokenAnswer(stimulusText).toLowerCase() !== expectedAnswer.toLowerCase()
      || alternates.length)) throw new Error('Comparative target is not a quoted menu word');
    return { id: `target-${i + 1}`, stimulusText, stimulusEmoji, expectedAnswer, alternates, sourceQuote };
  });
  if (new Set(targets.map(t => t.stimulusEmoji || t.stimulusText.toLowerCase())).size !== targets.length) {
    throw new Error('Duplicate targets');
  }
  if ((task === 'visual_naming' || value.closedSet) && targets.length === 0) throw new Error('Missing targets');
  if (targets.length && task !== 'visual_naming' && task !== 'read_aloud' && task !== 'compare_choice'
    && task !== 'explain_concept') {
    throw new Error('Unsupported target task');
  }
  // The MENU is the task. One word is not a choice, and a comparative task
  // whose words were never enumerated cannot claim `closed_set_choice` — it is
  // open production wearing a menu, which is the class this pack refuses.
  if (task === 'compare_choice' && (!value.closedSet || targets.length < 2)) {
    throw new Error('Comparative choice needs an enumerated menu of two or more words');
  }
  // An explain plan is ONE named concept (one grounded stimulus + the sentence
  // the judge holds + ≤ 2 more anchors) or OPEN (nothing planned; each instance
  // writes its own rule). The sentence is STRUCTURE-checked here and MEANING-
  // checked by the review below — nothing in the sources grounds a paraphrase.
  const conceptStatement = task === 'explain_concept' ? text(value.conceptStatement) : '';
  if (task === 'explain_concept') {
    if (targets.length > 1) throw new Error('An explain plan names at most one concept');
    if (targets.length === 1) {
      const words = wordCount(conceptStatement);
      if (words < CONCEPT_STATEMENT_MIN_WORDS || words > CONCEPT_STATEMENT_MAX_WORDS) {
        throw new Error(`A named concept needs a ${CONCEPT_STATEMENT_MIN_WORDS}-${CONCEPT_STATEMENT_MAX_WORDS} word conceptStatement`);
      }
    } else if (conceptStatement) {
      throw new Error('An open explain plan carries no session-wide conceptStatement');
    }
  }
  return { task, closedSet: value.closedSet, targets, ...(conceptStatement ? { conceptStatement } : {}) };
}

export function modeForSpokenPlan(plan: SpokenPracticePlan): SpokenPracticeMode | null {
  return plan.task === 'unsupported' ? null
    : plan.task === 'visual_naming' || plan.task === 'subject_verb_agreement' ? 'say_answer'
      : plan.task;
}

export async function planSpokenPractice(
  topic: string, gradeLevel: string, intent?: string, objectiveText?: string,
  allowedModes?: readonly string[],
): Promise<SpokenPracticePlan> {
  const sources = [objectiveText, intent, topic].filter((s): s is string => Boolean(s));
  const context = JSON.stringify({ topic, gradeLevel, objectiveText, intent });
  let feedback = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: PLAN_MODEL,
        contents: `Plan the learning task for spoken practice. Interpret the supplied text; do not write practice items.
CONTEXT: ${context}
SOURCES: ${JSON.stringify(sources.map((text, i) => ({ id: `s${i + 1}`, text })))}
PRINTED TOKEN INVENTORY: ${JSON.stringify(spokenSourceTokens(sources))}
The objective defines scope; the component intent defines this slot's action within that scope.
TASKS:
- visual_naming: retrieve the NAME of a displayed symbol or picture. The visual IS the question.
  Showing + and saying its name is recall, NOT reading. Never print the name to be recalled.
- read_aloud: decode printed words or numerals; the printed text itself is the utterance.
- say_answer: listening recall, arithmetic, or spoken manipulation of sounds/words.
- subject_verb_agreement: complete a short present-progressive sentence by saying "is" or "are".
  Choose this when the child must apply present-tense agreement across singular and plural subjects.
  This task preserves the subject and predicate as an answer-free spoken frame; targets is empty and
  closedSet is false because a later code-owned builder supplies contrasting sentence pairs.
- count_and_say: count displayed objects and say the total (1-10).
- compare_choice: the text names a FIXED SET of comparison words (longer/shorter, heavier/lighter,
  more/fewer) and the child says which one describes TWO things they are shown. Choose this only
  when the words themselves are enumerated. targets are those WORDS: select each from the token
  inventory, set expectedAnswer to the same word, and leave alsoAccept empty. Never invent the pair
  of objects being compared — a later generator writes those around your menu.
- explain_concept: the child says, IN THEIR OWN WORDS, what something means, why it is so, or what
  rule governs it ("what does = mean?", "what is the rule of this pattern?"). The answer is an IDEA,
  1-10 words, with many correct wordings. Choose this for an explain/describe/tell-why objective whose
  answer is a short proposition. When the objective names ONE concept (the equal sign, a ten rod),
  emit ONE target whose stimulusId is the named symbol/picture, whose expectedAnswer is the shortest
  correct statement of the concept (1-${CONCEPT_ANCHOR_MAX_WORDS} words), with alsoAccept holding 1-2 more short
  wordings, and put the idea as one ${CONCEPT_STATEMENT_MIN_WORDS}-${CONCEPT_STATEMENT_MAX_WORDS} word sentence in conceptStatement. When the
  concept varies per instance (the rule of a pattern), targets is empty, closedSet false, and
  conceptStatement empty — the item generator writes each instance and its rule. A PROCEDURE
  ("explain how to solve", the steps of a method) is not one proposition: use unsupported.
- unsupported: letter NAMES, open-ended answers that are not a short proposition, procedures,
  unsupported representations, or an impossible scope.
An answer must be 1-3 short spoken words, except explain_concept anchors (1-${CONCEPT_ANCHOR_MAX_WORDS}). Letter names
are not supported by this pack. conceptStatement is empty for every task but a named explain_concept.
closedSet is true ONLY when the objective/intent explicitly enumerates a finite required set for
visual naming, reading, or comparative choice (which is ALWAYS closedSet — its menu is the task).
A numerical range, arithmetic topic, or phonics pattern is not such a set.
For a closed set, extract EVERY required target, once each, regardless of prominence in the topic.
For visual_naming without a named set, choose 3-4 distinct, scope-appropriate exemplars.
For reading without a named set and for other tasks, targets is empty and closedSet is false.
For printed symbols, words or numerals, SELECT stimulusId from the token inventory. Code copies
the original token, so leave stimulusText and stimulusEmoji empty. NEVER emit a replacement glyph.
For pictured objects use stimulusId "picture", one unambiguous stimulusEmoji, and the object label
in stimulusText (the label will NOT be printed). sourceId identifies the input establishing the target.
For reading, expectedAnswer is the printed text (digits may become spoken number words); no alternates.
For naming, expectedAnswer/alsoAccept contain correct names, not definitions or associated concepts.
Do not truncate a required set larger than six: use unsupported with no targets instead.
${feedback}`,
        config: { responseMimeType: 'application/json', responseSchema: planSchema(sources), maxOutputTokens: 8192,
          httpOptions: { timeout: 45000 } },
      });
      const plan = parseSpokenPlan(JSON.parse(response.text || '{}'), sources);
      const plannedMode = modeForSpokenPlan(plan);
      if (plannedMode && allowedModes && !allowedModes.includes(plannedMode)) {
        throw new Error(`Task ${plan.task} conflicts with requested modes ${allowedModes.join(', ')}. `
          + 'Recheck the learner action. Do not change the objective or invent a different task to fit the mode.');
      }
      // An explicit SINGLE pin is the curator's reading of the objective. A
      // plan that calls it `unsupported` on the first pass gets one re-read
      // against that pin before the refusal stands (the pattern-rule objective
      // drew `unsupported` on 1 of 3 fresh plans while its pin said
      // explain_concept). A second `unsupported` still ships nothing.
      if (!plannedMode && allowedModes?.length === 1 && attempt === 0) {
        throw new Error(`Task unsupported conflicts with the requested mode ${allowedModes[0]}. Re-read the `
          + 'objective against that task\'s definition; plan it only if the learner action truly fits, '
          + 'otherwise answer unsupported again.');
      }
      // Review even an empty/open plan: otherwise misclassifying a named set
      // as generic practice would bypass the coverage contract entirely.
      {
        const review = await ai.models.generateContent({
          model: PLAN_MODEL,
          contents: `Independently check this proposed spoken-practice plan against the ORIGINAL context.
CONTEXT: ${context}
PLAN: ${JSON.stringify(plan)}
This is a TASK PLAN, not the generated practice session. Its targets array is ONLY for visual
naming, explicitly enumerated reading targets, compare_choice — where the targets are the
required comparison WORDS themselves (the objects each item compares are written later, so their
absence here is correct and is NOT grounds for rejection) — and explain_concept with ONE named
concept, where the single target only NAMES the concept (a token from the text, or a picture) as a
grounding hook — the instances the child actually sees are written later, so the hook's glyph or
picture is NOT grounds for rejection; judge only that conceptStatement is TRUE and grade-appropriate
and that every anchor MEANS the same thing as it, and reject on any no. An open explain_concept plan
(the rule varies per instance) has no targets and no conceptStatement, which is correct.
subject_verb_agreement is valid only when the requested action is present-tense agreement across
singular and plural subjects; its targets MUST be empty because code builds answer-free is/are
sentence pairs after this review. For listening recall, arithmetic, counting, or reading from a
range/pattern, targets MUST be empty and closedSet false: a later generator
writes those items. A numerical range (within five), a phonics pattern, or an arithmetic topic
does NOT enumerate a required set. Do not reject a valid open plan for lacking practice items.
Reject if the task changes the requested learner action, any required named member is missing,
any target is outside scope, a symbol glyph or picture is wrong/ambiguous, any name/alternate is
incorrect, or a letter-name task was admitted. Check EVERY displayed stimulus against its answer.
A named list must be marked closedSet and fully represented, even if another member dominates the topic.
Reading must decode the printed text; naming a symbol/picture must retrieve its name without printing it.
Do not approve merely because quotes occur in the input. Return valid and a short reason.`,
          config: {
            responseMimeType: 'application/json', maxOutputTokens: 8192, httpOptions: { timeout: 45000 },
            responseSchema: { type: Type.OBJECT, properties: {
              valid: { type: Type.BOOLEAN }, reason: { type: Type.STRING },
            }, required: ['valid', 'reason'] },
          },
        });
        const verdict = record(JSON.parse(review.text || '{}'));
        if (verdict.valid !== true) throw new Error(`Plan review: ${text(verdict.reason)}`);
      }
      return plan;
    } catch (error) {
      feedback = `Previous plan failed validation: ${error instanceof Error ? error.message : 'invalid output'}`;
      console.warn(`[DiSpokenPractice] plan attempt ${attempt + 1}: ${feedback}`);
    }
  }
  throw new Error('No verified spoken-practice plan after two attempts');
}

/** Repetition is intentional DI practice. The model supplies a checked mapping
 * once; it never independently re-emits the glyph, answer, or correction per slot. */
export function buildPlannedSpokenItems(plan: SpokenPracticePlan, count: number): SpokenPracticeItem[] {
  const mode = modeForSpokenPlan(plan);
  // compare_choice plans a MENU, not a stimulus mapping — there is no checked
  // stimulus→answer pair here to repeat, because the pair of objects is content
  // the item generator writes. Its coverage is verified by `hasChoiceCoverage`
  // over the generated items instead. explain_concept likewise plans a session-
  // wide ANCHOR SET, not an instance: the instances ("3 + 2 = 5", "4 = 4") are
  // written by the item generator around it (`hasConceptCoverage`).
  if (!mode || mode === 'compare_choice' || mode === 'explain_concept'
    || !plan.targets.length || plan.targets.length > count) return [];
  const offset = Math.floor(Math.random() * plan.targets.length);
  return Array.from({ length: count }, (_, i) => {
    const t = plan.targets[(i + offset) % plan.targets.length];
    const reading = mode === 'read_aloud';
    return {
      id: `dsp-${i + 1}`, targetId: t.id,
      mode, action: mode, answerKind: 'voice',
      responseClass: deriveResponseClass(mode, t.expectedAnswer, t.stimulusText)!,
      stimulusRole: reading ? undefined : 'visual_target',
      stimulusKind: t.stimulusEmoji ? 'emoji' : 'text',
      answerSource: reading ? 'decode' : 'recall',
      stimulusText: t.stimulusText, stimulusEmoji: t.stimulusEmoji, stimulusCount: 0,
      ask: reading ? 'Read it out loud.' : 'What is this called?',
      howToPlay: reading ? 'Read what you see out loud.' : 'Look, then say its name.',
      expectedAnswer: t.expectedAnswer, alternates: t.alternates,
      acceptRule: reading ? 'Sounding out and then reading the whole printed text correctly counts.' : '',
      signatureError: '',
      correctionBody: reading ? `It says ${t.expectedAnswer}.` : `This is called ${t.expectedAnswer}.`,
    };
  });
}

/**
 * A K agreement item is a sentence-completion task, not verb recall. The
 * original generator asked a complete sentence ("The birds fly") and then
 * keyed `fly`; the answer-leak gate correctly removed every item. These paired
 * frames retain the subject and predicate while code owns the missing `is/are`
 * word and all dependent feedback.
 */
const AGREEMENT_PAIRS = [
  { id: 'cat', singular: 'The cat', plural: 'The cats', predicate: 'sleeping on the mat' },
  { id: 'dog', singular: 'The dog', plural: 'The dogs', predicate: 'running in the park' },
  { id: 'bird', singular: 'The bird', plural: 'The birds', predicate: 'flying over the tree' },
  { id: 'duck', singular: 'The duck', plural: 'The ducks', predicate: 'swimming in the pond' },
  { id: 'frog', singular: 'The frog', plural: 'The frogs', predicate: 'jumping by the log' },
  { id: 'rabbit', singular: 'The rabbit', plural: 'The rabbits', predicate: 'eating a carrot' },
] as const;

export function buildSubjectVerbAgreementItems(count: number): SpokenPracticeItem[] {
  if (count < 2) return [];
  const offset = Math.floor(Math.random() * AGREEMENT_PAIRS.length);
  const pairCount = Math.ceil(count / 2);
  const selected = Array.from(
    { length: pairCount },
    (_, i) => AGREEMENT_PAIRS[(offset + i) % AGREEMENT_PAIRS.length],
  );
  const rows = selected.flatMap((pair) => ([
    { pair, agreementNumber: 'singular' as const, subject: pair.singular, answer: 'is', wrong: 'are' },
    { pair, agreementNumber: 'plural' as const, subject: pair.plural, answer: 'are', wrong: 'is' },
  ])).slice(0, count);

  return rows.map(({ pair, agreementNumber, subject, answer, wrong }, index) => {
    const frame = `${subject} ... ${pair.predicate}.`;
    const oneOrMore = agreementNumber === 'singular' ? 'one subject' : 'more than one subject';
    return {
      id: `dsp-${index + 1}`,
      targetId: `agreement-${pair.id}-${agreementNumber}`,
      agreementNumber,
      agreementPairId: pair.id,
      mode: 'say_answer',
      action: 'say_answer',
      answerKind: 'voice',
      responseClass: deriveResponseClass('say_answer', answer, frame)!,
      stimulusKind: 'none',
      answerSource: 'recall',
      stimulusText: frame,
      stimulusEmoji: '',
      stimulusCount: 0,
      ask: `Listen: ${frame} Say the missing word.`,
      howToPlay: HOW_TO_PLAY.say_answer,
      expectedAnswer: answer,
      alternates: [],
      acceptRule: '',
      signatureError: `Saying "${wrong}" for ${oneOrMore} is not correct agreement.`,
      correctionBody: `Use ${answer} with ${oneOrMore}. ${subject} ${answer} ${pair.predicate}.`,
    };
  });
}

/** Every shipped agreement session must retain a singular/plural contrast, a
 *  matched pair, and the code-owned key for each grammatical number. */
export function hasSubjectVerbAgreementCoverage(
  items: readonly SpokenPracticeItem[], count: number,
): boolean {
  if (items.length !== count) return false;
  if (!items.every(item => item.agreementNumber === 'singular'
    ? item.expectedAnswer === 'is'
    : item.agreementNumber === 'plural' && item.expectedAnswer === 'are')) return false;
  const numbers = new Set(items.map(item => item.agreementNumber));
  if (!numbers.has('singular') || !numbers.has('plural')) return false;
  const byPair = new Map<string, Set<string>>();
  for (const item of items) {
    if (!item.agreementPairId) return false;
    const seen = byPair.get(item.agreementPairId) ?? new Set<string>();
    seen.add(item.agreementNumber!);
    byPair.set(item.agreementPairId, seen);
  }
  return Array.from(byPair.values()).some(seen => seen.has('singular') && seen.has('plural'));
}

/** Run AFTER item gates. A surviving label alone is not coverage of a target. */
export function hasPlannedCoverage(plan: SpokenPracticePlan, items: SpokenPracticeItem[], count: number): boolean {
  return items.length === count && plan.targets.every(t => items.some(item =>
    item.targetId === t.id && item.stimulusText === t.stimulusText
    && item.stimulusEmoji === t.stimulusEmoji && item.expectedAnswer === t.expectedAnswer));
}

/** The required comparison words for a menu plan, in the objective's own order
 *  and wording. Empty for every other task. */
export function spokenChoiceMenu(plan: SpokenPracticePlan): string[] {
  return plan.task === 'compare_choice' ? plan.targets.map(t => t.expectedAnswer) : [];
}

/** Coverage for a menu plan: every required word must be PRODUCED at least once.
 *  Repetition across items is fine — an unasked menu word is not, because a
 *  four-word objective assessed on two words is the named-set failure this plan
 *  exists to prevent. Run AFTER the item gates, like `hasPlannedCoverage`. */
export function hasChoiceCoverage(
  menu: readonly string[], items: readonly SpokenPracticeItem[],
): boolean {
  return menu.every(word => items.some(
    item => item.expectedAnswer.trim().toLowerCase() === word.trim().toLowerCase()));
}

/** A named-concept explain plan's session-wide slot — the sentence the judge
 *  holds and the anchor wordings, stamped into every generated instance by
 *  code (the counterpart of `spokenChoiceMenu`). Undefined for the open shape
 *  and for every other task. */
export function spokenConceptPlan(
  plan: SpokenPracticePlan,
): { conceptStatement: string; anchors: string[] } | undefined {
  if (plan.task !== 'explain_concept' || !plan.conceptStatement || plan.targets.length !== 1) return undefined;
  const t = plan.targets[0];
  return { conceptStatement: plan.conceptStatement, anchors: [t.expectedAnswer, ...t.alternates] };
}

/** Coverage for a named-concept plan: every surviving item must carry the
 *  planned sentence and anchors (a model re-emission that drifted is not the
 *  plan), and the instances must VARY — one concept asked over the same
 *  equation four times is recall of a sentence, which the coverage judge files
 *  as ASSESSED_INDIRECTLY. Run AFTER the item gates, like `hasChoiceCoverage`. */
export function hasConceptCoverage(
  concept: { conceptStatement: string; anchors: readonly string[] },
  items: readonly SpokenPracticeItem[],
): boolean {
  if (!items.length) return false;
  // Anchors ride as a non-empty SUBSET of the planned set: an item whose ask
  // names an anchor word drops that anchor (`reconcileConceptAnchors`), and a
  // model-drifted anchor — one outside the vetted set — is what this refuses.
  const planned = new Set(concept.anchors.map(a => a.trim().toLowerCase()));
  const stamped = items.every(item =>
    item.conceptStatement === concept.conceptStatement
    && [item.expectedAnswer, ...item.alternates].every(a => planned.has(a.trim().toLowerCase())));
  const instances = new Set(items.map(item => item.stimulusText.trim().toLowerCase()));
  return stamped && instances.size === items.length;
}
