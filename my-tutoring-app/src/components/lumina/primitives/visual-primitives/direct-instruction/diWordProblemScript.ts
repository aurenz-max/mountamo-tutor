/**
 * diWordProblemScript — HAND-AUTHORED Direct Instruction script for
 * di-word-problem-setup, the "name the problem, build the family" pack from
 * the "DI for Older Learners" brief (concept 4; handoff
 * qa/HANDOFF-di-word-problem-setup-2026-09-07.md).
 *
 * WHAT IS NEW, AND WHAT IS NOT. The runner, the sentinels, the correction cap,
 * the stillness close and the context sync are the family's
 * (`useJudgedScriptRunner`). What this module adds is a SETUP worked one
 * decision at a time, and the first math pack in the family that MIXES the
 * two answer kinds inside one problem:
 *
 *   classify    "What kind of problem is this?"   spoken, `closed_set_choice`
 *   big_number  "Build small + small = big."        HANDS — the child places all
 *                                                   three story parts; the
 *                                                  match is computed in code
 *                                                  (`bigNumberVerdictCue`);
 *                                                  class `manipulation`
 *   family      "Say the family."                  spoken, NEW class
 *                                                  `equation_statement`
 *   operation   "Do you add or subtract?"          spoken, `closed_set_choice`
 *   solve       "Now work it. How many…?"          spoken, number word
 *
 * WHY THE BIG NUMBER IS PLACED, NOT SAID (user ruling 2026-08-13, and the
 * hybrid pilot this pack was chosen for): picture the teacher at the table —
 * the child BUILDS the family on the page, including the big number after the
 * equals sign, and only then reads it. Position is page-work; reading is voice. The
 * placement closes on stillness (the runner's `armStillness`), completeness-
 * gated and never correctness-gated: a wrong placement commits exactly as
 * readily as a right one, which is what makes it judgeable at all.
 *
 * THE SCREEN ONLY FOLLOWS — AND HERE IT SCRIBES. The family arrow and the bar
 * model draw themselves as each step is affirmed: the big-number chip locks at
 * the arrowhead, then the small numbers and the box, then the sign, then the
 * answer in the box. Nothing the child must say or place is drawn before they
 * do it. Every story, family and answer comes from `diWordProblemPlan.ts`,
 * never from the model.
 *
 * Sentinels are the engine defaults ("Yes" / "My turn"); every correction
 * re-models the step then re-elicits (standing gate 3). Corrections are
 * CONTRASTIVE where a wrong thing was said (⟨what they said⟩ is a slot the
 * tutor fills from the audio — never spoken as marks), and each step scripts
 * its SPECIFIC branches ahead of the general one, in the family's order: ask,
 * affirm, specific corrections, general last.
 *
 * MOVE-ON CARRIES THE STEP. When the cap is reached the tutor STATES the step
 * ("The big number is Jen's stickers.") before the next ask, and the stage
 * draws it as carried — otherwise "Say the family" would refer to a big number
 * the page never placed.
 */

import type {
  DiActionContract,
  JudgedCueOptions,
  JudgedCueSurface,
  JudgedScriptItem,
} from '../../../hooks/judgedScriptContract';
import {
  equationSpoken,
  familyAsSubtraction,
  familyIncomplete,
  familyMisplaced,
  familySolved,
  familySpoken,
  familySpokenSwapped,
  numberWord,
  planWordProblem,
  SHAPE_WORD,
  slotWord,
  STORY_SHAPES,
  wrongWayAnswer,
  type StoryShape,
  type WordProblemPlan,
  type WordProblemSpec,
} from './diWordProblemPlan';
import {
  diWordProblemModePlan,
  HOW_TO_PLAY,
  STEPS_FOR_MODE,
  type WordProblemChallengeType,
  type WordProblemStepKind,
  type WordProblemSupportTier,
} from './diWordProblemModes';
export type {
  WordProblemChallengeType,
  WordProblemStepKind,
  WordProblemSupportTier,
} from './diWordProblemModes';
/** L3 lever: at `easy` every step's ask re-reads the story; otherwise only the
 *  first step of a problem does. `medium` and `hard` are identical in this
 *  pilot — a later /add-support-tiers pass owns the split. */

/** What the generator emits per problem. The plan is built HERE from the
 *  frame, theme and two numbers; a spec that fails the plan gates is dropped,
 *  never backfilled. */
export interface WordProblemProblemSpec extends WordProblemSpec {
  challengeType: WordProblemChallengeType;
  supportTier?: WordProblemSupportTier;
  /** The session's number ceiling (20 unless the objective says within 100). */
  maxNumber?: number;
}

export interface WordProblemItem extends JudgedScriptItem {
  action: WordProblemChallengeType;
  /** Required here even though the family base allows incremental adoption. */
  actionContract: DiActionContract;
  kind: WordProblemStepKind;
  challengeType: WordProblemChallengeType;
  supportTier?: WordProblemSupportTier;
  problemId: string;
  problemIndex: number;
  stepIndex: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  plan: WordProblemPlan;
  /** The canonical utterance (voice) or the big quantity's id (gesture) —
   *  for evidence and the harness. */
  answerSpoken: string;
}

export interface DiWordProblemSetupData {
  title: string;
  description: string;
  challengeType: WordProblemChallengeType;
  problems: WordProblemProblemSpec[];
  gradeLevel?: string;
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  componentIntent?: string;
  objectiveText?: string;
  onEvaluationSubmit?: (result: unknown) => void;
}

const w = numberWord;
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

// ── Items from problems (the ONE builder; the harness calls it too) ──────────

const canonicalFor = (kind: WordProblemStepKind, plan: WordProblemPlan): string => {
  switch (kind) {
    case 'classify': return SHAPE_WORD[plan.shape];
    case 'big_number': return plan.big.id;
    case 'family': return familySpoken(plan);
    case 'operation': return plan.operation;
    case 'solve': return w(plan.answer);
  }
};

/**
 * Build the judged items for a session. Problems that fail the plan gates are
 * DROPPED and counted — a placeholder step in a judged loop becomes a spoken
 * ask the tutor must judge, so nothing is ever backfilled.
 */
export function itemsFromProblems(problems: readonly WordProblemProblemSpec[]): {
  items: WordProblemItem[];
  dropped: number;
} {
  const items: WordProblemItem[] = [];
  let dropped = 0;
  let problemIndex = 0;
  for (const spec of problems) {
    const maxNumber = spec.maxNumber ?? 20;
    const plan = planWordProblem(spec, maxNumber);
    if (!plan || !STEPS_FOR_MODE[spec.challengeType]) { dropped++; continue; }
    const modePlan = diWordProblemModePlan({
      id: spec.id,
      challengeType: spec.challengeType,
      plan,
      maxNumber,
    });
    const kinds = STEPS_FOR_MODE[spec.challengeType];
    kinds.forEach((kind, stepIndex) => {
      const step = modePlan.steps.find((candidate) => candidate.key === kind)!;
      const actionContract = step.actionContract;
      items.push({
        id: `${spec.id}-${kind}`,
        action: spec.challengeType,
        answerKind: actionContract.answerKind,
        actionContract,
        responseClass: step.responseClass!,
        kind,
        challengeType: spec.challengeType,
        supportTier: spec.supportTier,
        problemId: spec.id,
        problemIndex,
        stepIndex,
        isFirstStep: stepIndex === 0,
        isLastStep: stepIndex === kinds.length - 1,
        plan,
        answerSpoken: canonicalFor(kind, plan),
      });
    });
    problemIndex++;
  }
  return { items, dropped };
}

/** Every distinct problem in item order — the stage renders one at a time. */
export const problemsOf = (items: readonly WordProblemItem[]): string[] =>
  Array.from(new Set(items.map((it) => it.problemId)));

// ── The spoken lines ─────────────────────────────────────────────────────────

const readsStory = (item: WordProblemItem): boolean =>
  item.isFirstStep || item.supportTier === 'easy';

const CLASSIFY_MENU = 'a comparison problem, a change problem, or a part-whole problem';
const OPERATION_MENU = 'add or subtract';

/**
 * ONE action definition drives the visible direction, the spoken question,
 * the response modality, progress UI, and judging-state copy. If this changes,
 * every surface changes with it.
 */
export const actionContractFor = (
  kind: WordProblemStepKind,
  plan: WordProblemPlan,
  challengeType: WordProblemChallengeType,
): DiActionContract => {
  return diWordProblemModePlan({ id: 'action', challengeType, plan, maxNumber: 20 })
    .steps.find((candidate) => candidate.key === kind)!.actionContract;
};

const shapeWhy: Record<StoryShape, string> = {
  comparison: 'it compares two amounts',
  change: 'it starts with an amount that changes',
  part_whole: 'two parts make one whole',
};

const boxRole = (plan: WordProblemPlan): string =>
  (plan.unknown.slot === 'big' ? 'the big number' : 'a small number');

/** The step's question alone — what every ask ends on and every re-ask repeats. */
export const stepQuestion = (item: WordProblemItem): string => {
  return item.actionContract.instruction;
};

/** The ask for one step — what the child hears right before their turn. */
export const askLine = (item: WordProblemItem): string => {
  const story = readsStory(item) ? `Listen. ${item.plan.storySpoken} ` : '';
  return `${story}${stepQuestion(item)}`;
};

/** The short re-ask every correction ends on. Never restates the story. */
const reAsk = (item: WordProblemItem): string => {
  return `Your turn. ${item.actionContract.instruction}`;
};

/** The resolved step as a statement — the affirmation's body and the move-on's
 *  carry line. */
const resolution = (item: WordProblemItem): string => {
  const p = item.plan;
  switch (item.kind) {
    case 'classify': return `this is a ${SHAPE_WORD[p.shape]} problem — ${shapeWhy[p.shape]}.`;
    case 'big_number': return `the big number is ${p.big.label} — ${p.bigReason}.`;
    case 'family': return `${familySpoken(p)}.`;
    case 'operation': return `the box is ${boxRole(p)}, so we ${p.operation}.`;
    case 'solve': return `${equationSpoken(p)}. ${p.answerSentence}`;
  }
};

/** Affirmation. MUST begin with "Yes" — the engine scans that sentinel. */
export const verifyLine = (item: WordProblemItem): string => `Yes, ${resolution(item)}`;

/**
 * The correction branches for one step, SPECIFIC first and the general fallback
 * LAST (the harness reads the final span as the catch-all). Every line opens
 * with "My turn" and ends on the re-ask.
 */
export const correctionLines = (item: WordProblemItem): {
  misplaced?: string;
  notFamily?: string;
  incomplete?: string;
  fromVerb?: string;
  contrast?: string;
  fallback: string;
} => {
  const p = item.plan;
  const end = ` ${reAsk(item)}`;
  switch (item.kind) {
    case 'classify':
      return {
        contrast: `My turn: not ⟨what they said⟩ — ${shapeWhy[p.shape]}, so this is a ${SHAPE_WORD[p.shape]} problem.${end}`,
        fallback: `My turn: ${shapeWhy[p.shape]}, so this is a ${SHAPE_WORD[p.shape]} problem.${end}`,
      };
    case 'big_number':
      return {
        fallback:
          `My turn: the big number is the whole amount, the one that has it all. ${cap(p.bigReason)}. `
          + `The big number is ${p.big.label}.${end}`,
      };
    case 'family': {
      const subtraction = familyAsSubtraction(p);
      return {
        misplaced:
          `My turn: the big number goes last, after equals. ${cap(p.big.label)} is the big number, so the `
          + `family is ${familySpoken(p)}.${end}`,
        ...(subtraction
          ? {
              notFamily:
                `My turn: a family says small plus small equals big — we do not subtract yet. `
                + `${cap(familySpoken(p))}.${end}`,
            }
          : {}),
        incomplete:
          `My turn: a family has all three — two small numbers and the big number. `
          + `${cap(familySpoken(p))}.${end}`,
        fallback: `My turn: ${familySpoken(p)}.${end}`,
      };
    }
    case 'operation':
      return {
        ...(p.verbCueOperation !== p.operation
          ? {
              fromVerb:
                `My turn: the story says ${p.verbCueWord}, but the family decides. The box is ${boxRole(p)}, `
                + `so we ${p.operation}.${end}`,
            }
          : {}),
        contrast: `My turn: not ⟨what they said⟩ — the box is ${boxRole(p)}, so we ${p.operation}.${end}`,
        fallback: `My turn: the box is ${boxRole(p)}, so we ${p.operation}.${end}`,
      };
    case 'solve':
      return {
        contrast: `My turn: not ⟨what they said⟩ — ${equationSpoken(p)}.${end}`,
        fallback: `My turn: ${equationSpoken(p)}.${end}`,
      };
  }
};

// ── The judging contracts ────────────────────────────────────────────────────

const WAIT_FACT = 'You then stay silent while the learner works. ';
const SLOT_RULE =
  'Replace ⟨what they said⟩ with the words they actually said, and never speak the ⟨ ⟩ marks. ';
const CLOSING_LAW =
  'After you affirm, you stop; the application sends the next step, and you never continue into '
  + 'another step or another story yourself. Never begin any other sentence with the word "Yes" '
  + 'or the words "My turn". Speak nothing beyond these exact lines, and never announce that you are '
  + 'waiting or listening — simply stop speaking.';
const FILLER = 'If there is no answer, only a filler sound like "um" or "hmm", or the learner says they do not know, ';

const classifyContract = (item: WordProblemItem): string => {
  const p = item.plan;
  const lines = correctionLines(item);
  const word = SHAPE_WORD[p.shape];
  const others = STORY_SHAPES.filter((s) => s !== p.shape).map((s) => `"${SHAPE_WORD[s]}"`).join(' or ');
  const variants = p.shape === 'comparison'
    ? '"comparison", "compare", "comparing", "a compare problem"'
    : p.shape === 'change'
      ? '"change", "a change problem", "changing"'
      : '"part-whole", "part whole", "parts and whole", "parts"';
  const signature = p.shape === 'change'
    ? `The signature error is naming the kind of the LAST sentence instead of the whole story — the question says "${p.verbCueWord}" and sounds like a comparison, but the story starts with an amount that changes. `
    : p.shape === 'comparison'
      ? 'The signature error is naming the kind of the LAST sentence instead of the whole story — hearing "has" and calling it a change problem, when nothing changes and two amounts are compared. '
      : 'The signature error is calling it a comparison because two kinds are named — nothing is compared; two parts make one whole. ';
  return (
    WAIT_FACT
    + `The learner names the KIND of story this is, out loud, from the three kinds in the question. This story `
    + `is a ${word} problem: ${shapeWhy[p.shape]}. Anything that plainly means ${word} counts — ${variants} — on `
    + `its own or inside a longer sentence. Naming ${others} is wrong. `
    + signature
    + `If the answer is right, say exactly: "${verifyLine(item)}" `
    + `If the learner names a different kind, say exactly: "${lines.contrast}" ${SLOT_RULE}`
    + `${FILLER}say exactly: "${lines.fallback}" `
    + CLOSING_LAW
  );
};

/** The gesture contract is a SILENCE contract (cause-effect-chain's shape):
 *  there is nothing to judge until the placement is described, and the big
 *  number is banned from the tutor's mouth for the whole item. */
const placementContract = (item: WordProblemItem): string =>
  'The quoted line is the ONLY thing you say on this turn; the learner answers with their HANDS by putting '
  + (item.challengeType === 'find_big_number'
    ? 'one story part into the big-amount box, not with their voice, so you then stay completely '
    : 'all three story parts into small plus small equals big, not with their voice, so you then stay completely ')
  + 'silent. Never say which part is the big number, never say where a part belongs, and do not narrate '
  + 'what they are doing or fill the pause. You will be told what they put in the big slot and whether it matches; only '
  + 'then do you speak. Never announce that you are waiting or listening — simply stop speaking.';

const familyContract = (item: WordProblemItem): string => {
  const p = item.plan;
  const lines = correctionLines(item);
  const known = p.quantities.filter((x) => x.known).map((x) => w(x.value));
  const bigClause = p.big.known
    ? `the big number is ${p.big.label}, ${w(p.big.value)}`
    : `the big number is ${p.big.label}, which is the box`;
  const subtraction = familyAsSubtraction(p);
  return (
    WAIT_FACT
    + `The learner says the number FAMILY for this story out loud: the two small numbers, then "equals", `
    + `then the big number — with the unknown said as "box" (a child may say "blank", "something", "what", `
    + `or "the box"). The story's numbers are ${known.join(' and ')}; ${bigClause}. The right family is `
    + `"${familySpoken(p)}", and the two small numbers may come in either order — "${familySpokenSwapped(p)}" is `
    + `also right. Any wording that puts the right numbers in the right slots counts: "and" for plus, "makes" `
    + `or "is" for equals, "something" or "what" for the box. A family said in PIECES still counts — pauses, `
    + `"um", "and then", or "is" between the parts do not make it incomplete: "um, ${slotWord(p.small1)}, and `
    + `then ${slotWord(p.small2)}, is, ${slotWord(p.big)}" has all three parts in the right slots and is right. `
    + `A learner who says the right number in the box's place — "${familySolved(p)}" — has the family right; `
    + `count it right. `
    + `If the answer is right, say exactly: "${verifyLine(item)}" `
    + `The signature error puts the big number in a small slot — "${familyMisplaced(p)}" — every number is `
    + `there and the family is upside down; if the big number is said before "equals", or the box is said `
    + `last when it is not the big number, say exactly: "${lines.misplaced}" `
    + (subtraction
      ? `If the learner says a subtraction sentence — "${subtraction}" — that is arithmetic, not the family; `
        + `say exactly: "${lines.notFamily}" `
      : '')
    + `If the learner leaves a number out — "${familyIncomplete(p)}" — or only reads the story back, say `
    + `exactly: "${lines.incomplete}" `
    + `${FILLER}say exactly: "${lines.fallback}" `
    + CLOSING_LAW
  );
};

const operationContract = (item: WordProblemItem): string => {
  const p = item.plan;
  const lines = correctionLines(item);
  const op = p.operation;
  const other = op === 'add' ? 'subtract' : 'add';
  const rightWords = op === 'add'
    ? '"add", "adding", "plus", "put them together"'
    : '"subtract", "subtracting", "minus", "take away"';
  const wrongWords = other === 'add' ? '"add", "plus"' : '"subtract", "minus", "take away"';
  const verbNote = p.verbCueOperation !== op
    ? `The signature error is taking the operation from the story's words: the story says "${p.verbCueWord}", `
      + `which sounds like ${p.verbCueOperation}, but the family decides — the box is ${boxRole(p)}. If the `
      + `learner says ${wrongWords} and the story's word is the reason, say exactly: "${lines.fromVerb}" `
    : '';
  return (
    WAIT_FACT
    + `The learner says whether to add or subtract. The family is "${familySpoken(p)}" and the box is `
    + `${boxRole(p)}, so the correct answer is ${op}: ${rightWords} all count, on their own or inside a `
    + `sentence. `
    + `If the answer is right, say exactly: "${verifyLine(item)}" `
    + verbNote
    + `If the learner says ${wrongWords}, say exactly: "${lines.contrast}" ${SLOT_RULE}`
    + `${FILLER}say exactly: "${lines.fallback}" `
    + CLOSING_LAW
  );
};

const solveContract = (item: WordProblemItem): string => {
  const p = item.plan;
  const lines = correctionLines(item);
  const wrongWay = wrongWayAnswer(p);
  return (
    WAIT_FACT
    + `The learner works the family: ${equationSpoken(p)}. The correct answer is ${w(p.answer)} — the bare `
    + `number, or a whole sentence like "${p.answerSentence}", right away or after counting to it. `
    + `If the answer is right, say exactly: "${verifyLine(item)}" `
    + `A different number is always wrong; the commonest is ${w(wrongWay)}, the two story numbers combined `
    + `the wrong way. If the learner says a different number, say exactly: "${lines.contrast}" ${SLOT_RULE}`
    + `${FILLER}say exactly: "${lines.fallback}" `
    + CLOSING_LAW
  );
};

export const judgingContract = (item: WordProblemItem): string => {
  switch (item.kind) {
    case 'classify': return classifyContract(item);
    case 'big_number': return placementContract(item);
    case 'family': return familyContract(item);
    case 'operation': return operationContract(item);
    case 'solve': return solveContract(item);
  }
};

// ── Cues ─────────────────────────────────────────────────────────────────────

/** One step's ask. The how-to-play rides INSIDE the quoted line on the opening
 *  turn and whenever the mode changes; every later ask is the short signal. */
export const itemCue = (item: WordProblemItem, opts: JudgedCueOptions): string => {
  const how = opts.opening || opts.howToPlay ? HOW_TO_PLAY[item.challengeType] : '';
  return `[WPS_ITEM] Say exactly: "${how}${askLine(item)}" ${judgingContract(item)}`;
};

/**
 * The gesture verdict ask (`big_number`): describes what the child placed and
 * hands the tutor its exact line. THE MATCH IS COMPUTED IN CODE — the tutor is
 * never asked to read a placement. `placedId` is the quantity id the stage
 * commits.
 */
export const bigNumberVerdictCue = (item: WordProblemItem, placedId: string): string => {
  const placed = item.plan.quantities.find((x) => x.id === placedId);
  const matches = placedId === item.plan.big.id;
  const head = `[WPS_BIG] The learner built the family with '${placed?.label ?? 'an amount'}' in the big-number slot; `
    + `that ${matches ? 'MATCHES' : 'does NOT match'} the big number. `;
  const line = matches
    ? `Say exactly: "${verifyLine(item)}" `
    : `Say exactly: "${correctionLines(item).fallback}" `;
  return `${head}${line}Never read bracket tags aloud, and never say which amount is the big number beyond that line.`;
};

/** Cap reached: the tutor STATES the step (so the page can carry it), then asks
 *  the next one. The last step of the run closes warmly. */
export const moveOnCue = (
  item: WordProblemItem,
  next: WordProblemItem | null,
  opts: JudgedCueOptions,
): string => {
  const carry = `Good try. ${cap(resolution(item))}`;
  if (!next) {
    return `[WPS_MOVE_ON] Say exactly: "${carry} That's the end of our word problems for today." Then stop — the activity is over.`;
  }
  const how = opts.howToPlay ? HOW_TO_PLAY[next.challengeType] : '';
  return `[WPS_MOVE_ON] Say exactly: "${carry} ${how}${askLine(next)}" ${judgingContract(next)}`;
};

export const completeCue = (): string =>
  '[WPS_COMPLETE] Say exactly: "That\'s the end of our word problems. You set up every one yourself. '
  + 'Great work today!" Then stop — the activity is over.';

/** Tap-to-hear: the STORY, never the family or the answer. */
export const pronounceCue = (item: WordProblemItem): string =>
  `[WPS_HEAR] Say exactly: "${item.plan.storySpoken}" Then stop — say nothing else.`;

/** RUNTIME STATE, stimulus side only: the printed story and which step is
 *  open. Never the big number, the family or the answer. Keys stay in lockstep
 *  with `contextKeys` on the catalog entry. */
export const contextFor = (item: WordProblemItem): Record<string, string> => ({
  challengeType: item.challengeType,
  story: item.plan.story,
  step: item.kind,
  supportTier: item.supportTier ?? 'medium',
});

// ── Gates the generator and the harness share ────────────────────────────────

/**
 * The ask must not say the step's answer. Every step guards the answer number
 * word (the one number never spoken before the solve); classify and operation
 * also guard their menu word, exempted inside the menu itself.
 */
export const leakTokensFor = (item: WordProblemItem): string[] => {
  const p = item.plan;
  const tokens = [w(p.answer)];
  if (item.kind === 'classify') tokens.push(SHAPE_WORD[p.shape]);
  if (item.kind === 'operation') tokens.push(p.operation);
  return tokens;
};

export const leakExemptSpansFor = (item: WordProblemItem): string[] => [
  item.plan.storySpoken,
  ...(item.kind === 'classify' ? [CLASSIFY_MENU] : []),
  ...(item.kind === 'operation' ? [OPERATION_MENU] : []),
];

// ── The cue surface — exported once, spread by the component and the harness ─

export const diWordProblemSetupPackBase = (
  items: WordProblemItem[],
): JudgedCueSurface<WordProblemItem> => ({
  primitiveType: 'di-word-problem-setup',
  activityLine: 'live direct instruction word-problem setup: name the problem, place the big number, say the family',
  items,
  itemCue,
  moveOnCue,
  completeCue,
  pronounceCue,
  contextFor,
});
