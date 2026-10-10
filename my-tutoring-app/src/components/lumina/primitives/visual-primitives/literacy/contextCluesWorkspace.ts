/**
 * Context clues detective on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape.
 *
 * Pure: the component, the adapter and the journey read the same steps, assignment, scene and check. Each
 * generated word is three checked steps, one workspace item each: find a clue sentence (tap sentences, Check
 * Clue), name the clue type (tap one of five types, Check Type), give the meaning (tap an option or type it,
 * Check Meaning). The activity's own check is the judge, so the tutor is never handed `clueSentenceIds`,
 * `clueType` or `correctMeaning` before the step that asks for it is credited.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { textFacts } from '../../../components/live-activity/runtime/sceneFacts';
import type { ContextClueChallenge } from './ContextCluesDetective';

export type CluePhase = 'find' | 'classify' | 'define';
export const CLUE_PHASES: readonly CluePhase[] = ['find', 'classify', 'define'];
export type ClueType = ContextClueChallenge['clueType'];
export const CLUE_TYPES: readonly ClueType[] = ['definition', 'synonym', 'antonym', 'example', 'inference'];
export const CLUE_TYPE_LABEL: Record<ClueType, string> = {
  definition: 'Definition', synonym: 'Synonym', antonym: 'Antonym', example: 'Example', inference: 'Inference',
};

/** One checked step of one word. Its id is `<challenge id>:<phase>`. `phases` are the session's steps per word. */
export interface ClueStep {
  id: string; phase: CluePhase; challenge: ContextClueChallenge; challengeIndex: number; phases: readonly CluePhase[];
}

export const stepId = (challengeId: string, phase: CluePhase) => `${challengeId}:${phase}`;

/**
 * The steps each word gets. When every word shares one clue type (every pinned single-type mode), the classify step has
 * one possible answer, the lesson's mode name, so it is not built: find, then define. A session that mixes types keeps it.
 */
export function cluePhases(challenges: readonly Pick<ContextClueChallenge, 'clueType'>[]): readonly CluePhase[] {
  return new Set(challenges.map(c => c.clueType)).size > 1 ? CLUE_PHASES : ['find', 'define'];
}

export function clueSteps(challenges: readonly ContextClueChallenge[]): ClueStep[] {
  const phases = cluePhases(challenges);
  return challenges.flatMap((challenge, challengeIndex) =>
    phases.map(phase => ({ id: stepId(challenge.id, phase), phase, challenge, challengeIndex, phases })));
}

/** The step a workspace item id names, from the generated challenges (null for a step the session does not build). */
export function stepFor(challenges: readonly ContextClueChallenge[], itemId: string): ClueStep | null {
  return clueSteps(challenges).find(s => s.id === itemId) ?? null;
}

/** 1-based sentence number on screen. */
export const sentenceNumber = (c: ContextClueChallenge, sentenceId: string) =>
  c.passage.sentences.findIndex(s => s.id === sentenceId) + 1;
export const sentenceLabel = (n: number) => `sentence ${n}`;

export function clueAsk(step: ClueStep): string {
  const word = `"${step.challenge.targetWord}"`;
  switch (step.phase) {
    case 'find': return `Find a sentence that gives a clue to what ${word} means. Tap it, then press Check Clue.`;
    case 'classify': return `What type of context clue helps you understand ${word}? Tap a clue type, then press Check Type.`;
    case 'define': return step.challenge.meaningOptions?.length
      ? `Use the clue: what does ${word} mean? Tap a meaning, then press Check Meaning.`
      : `Use the clue: what does ${word} mean? Type the meaning, then press Check Meaning.`;
  }
}

export function clueAssignment(step: ClueStep): TeachingAssignment {
  return { id: step.id, task: clueAsk(step), response: 'gesture' };
}

/** The learner's work the check and the tutor read. */
export interface ClueView {
  /** Tapped sentence ids, in passage order. */
  picked: readonly string[];
  clueType: string;
  /** The tapped option, or the typed meaning when the word has no options. */
  meaning: string;
}

// ---------------------------------------------------------------------------
// The checks (both paths)
// ---------------------------------------------------------------------------

/**
 * The clue sentences a find must include one of: those other than the word's own sentence, or the word's own
 * sentence when the clue sits only inside it (an example clue usually does).
 */
export function cluesToFind(c: ContextClueChallenge): string[] {
  const others = c.clueSentenceIds.filter(id => id !== c.targetWordSentenceId);
  return others.length ? others : c.clueSentenceIds.filter(id => id === c.targetWordSentenceId);
}

/**
 * Find: at least one tapped sentence is a clue to find, and every other tapped sentence is a clue or the sentence
 * that holds the word. Tapping every sentence is not a find, nor is the highlighted sentence alone when the clue
 * is elsewhere.
 */
export function findCorrect(c: ContextClueChallenge, picked: readonly string[]): boolean {
  const needed = cluesToFind(c);
  return picked.some(id => needed.includes(id))
    && picked.every(id => c.clueSentenceIds.includes(id) || id === c.targetWordSentenceId);
}

export const classifyCorrect = (c: ContextClueChallenge, type: string) => type === c.clueType;

export function defineCorrect(c: ContextClueChallenge, meaning: string): boolean {
  if (c.meaningOptions?.length) return meaning === c.correctMeaning;
  const answer = meaning.trim().toLowerCase();
  return !!answer && [c.correctMeaning, ...(c.acceptableMeanings ?? [])].some(m => m.trim().toLowerCase() === answer);
}

export function stepCorrect(step: ClueStep, view: ClueView): boolean {
  switch (step.phase) {
    case 'find': return findCorrect(step.challenge, view.picked);
    case 'classify': return classifyCorrect(step.challenge, view.clueType);
    case 'define': return defineCorrect(step.challenge, view.meaning);
  }
}

/** Whether the step has anything to check (Check stays disabled otherwise). */
export function stepAnswered(step: ClueStep, view: ClueView): boolean {
  return step.phase === 'find' ? view.picked.length > 0 : step.phase === 'classify' ? !!view.clueType : !!view.meaning.trim();
}

/**
 * What a wrong check shows (`TeachingAttempt.miss`, handoff 20), only the observable pattern:
 * - find: `target_sentence_only` (only the sentence that holds the word, when the clue is elsewhere), `extra_sentence`
 *   (a clue sentence plus one that is not), `no_clue` (no clue sentence to find tapped);
 * - classify: `similar_opposite` (synonym and antonym swapped), `definition_synonym` (definition and synonym
 *   swapped), `said_inference` (inference for a clue the text states), `stated_for_inference` (a stated type for
 *   an inference clue), `other_type`;
 * - define: `other_meaning` (another option, or a typed meaning the item does not accept).
 */
export type ContextClueMiss = 'target_sentence_only' | 'extra_sentence' | 'no_clue'
  | 'similar_opposite' | 'definition_synonym' | 'said_inference' | 'stated_for_inference' | 'other_type'
  | 'other_meaning';

export function clueMiss(step: ClueStep, view: ClueView): ContextClueMiss | undefined {
  if (stepCorrect(step, view)) return undefined;
  const c = step.challenge;
  switch (step.phase) {
    case 'find': {
      if (view.picked.some(id => cluesToFind(c).includes(id))) return 'extra_sentence';
      return view.picked.length === 1 && view.picked[0] === c.targetWordSentenceId ? 'target_sentence_only' : 'no_clue';
    }
    case 'classify': {
      const pair = new Set([view.clueType, c.clueType]);
      if (pair.has('synonym') && pair.has('antonym')) return 'similar_opposite';
      if (pair.has('definition') && pair.has('synonym')) return 'definition_synonym';
      if (c.clueType === 'inference') return 'stated_for_inference';
      if (view.clueType === 'inference') return 'said_inference';
      return 'other_type';
    }
    case 'define': return 'other_meaning';
  }
}

const FIND_MISSES: readonly ContextClueMiss[] = ['target_sentence_only', 'extra_sentence', 'no_clue'];
/** The catalog's miss list per eval mode: what `clueMiss` can name on that mode's clue types. */
export const CONTEXT_CLUE_MISSES_BY_MODE: Readonly<Record<string, readonly ContextClueMiss[]>> = {
  // One clue type per session: no classify step (`cluePhases`), so no type misses.
  definition: [...FIND_MISSES, 'other_meaning'],
  // Synonym and antonym words mixed: the classify step is built.
  synonym_antonym: [...FIND_MISSES, 'similar_opposite', 'definition_synonym', 'said_inference', 'other_type', 'other_meaning'],
  example: [...FIND_MISSES, 'other_meaning'],
  inference: [...FIND_MISSES, 'other_meaning'],
};

// ---------------------------------------------------------------------------
// What the tutor is told
// ---------------------------------------------------------------------------

const quoteList = (xs: readonly string[]) => xs.map(x => `"${x}"`).join(', ');
const numbers = (c: ContextClueChallenge, ids: readonly string[]) =>
  ids.map(id => sentenceNumber(c, id)).filter(n => n > 0).sort((a, b) => a - b);
const sentenceList = (ns: readonly number[]) => ns.length === 1 ? `sentence ${ns[0]}` : `sentences ${ns.join(', ')}`;

/** The learner's work in their own terms, never the key. */
export function describeClueWork(step: ClueStep, view: ClueView): string {
  switch (step.phase) {
    case 'find': {
      const ns = numbers(step.challenge, view.picked);
      return ns.length ? `Tapped ${sentenceList(ns)}` : 'No sentence tapped yet';
    }
    case 'classify': {
      const label = CLUE_TYPE_LABEL[view.clueType as ClueType];
      return label ? `Chose the clue type ${label}` : 'No clue type chosen yet';
    }
    case 'define':
      if (!view.meaning.trim()) return step.challenge.meaningOptions?.length ? 'No meaning chosen yet' : 'No meaning typed yet';
      return step.challenge.meaningOptions?.length ? `Chose the meaning "${view.meaning}"` : `Typed the meaning "${view.meaning.trim()}"`;
  }
}

export interface ClueSceneView extends ClueView {
  total: number;
  /** Whether each clue-type button prints its one-line description (the support tier). */
  typeDescriptionsShown: boolean;
}

export function clueScene(step: ClueStep, view: ClueSceneView): WorkspaceScene {
  const c = step.challenge;
  const numbered = c.passage.sentences.map((s, i) => `(${i + 1}) ${s.text.trim()}`).join(' ');
  const facts: Record<string, string> = {
    ...textFacts('passage', numbered),
    word: `The mystery word "${c.targetWord}" is highlighted where it appears in the passage.`,
    step: `Word ${step.challengeIndex + 1} of ${view.total}, step ${step.phases.indexOf(step.phase) + 1} of ${step.phases.length}: `
      + (step.phase === 'find' ? 'find a clue sentence' : step.phase === 'classify' ? 'name the clue type' : 'give the meaning') + '.',
  };
  if (step.phase !== 'find')
    facts.clueSentences = `Found in the find step: the clue is in ${sentenceList(numbers(c, c.clueSentenceIds))}, shaded green.`;
  if (step.phase === 'classify')
    facts.menu = `Clue-type buttons: ${CLUE_TYPES.map(t => CLUE_TYPE_LABEL[t]).join(', ')}`
      + (view.typeDescriptionsShown ? ', each with a one-line description.' : ', names only.');
  if (step.phase === 'define') {
    facts.clueType = step.phases.includes('classify')
      ? `Named in the type step: the clue type is ${CLUE_TYPE_LABEL[c.clueType]}.`
      : `Every word in this lesson has a ${CLUE_TYPE_LABEL[c.clueType]} clue (there is no type step).`;
    if (c.meaningOptions?.length) facts.menu = `Meaning choices: ${quoteList(c.meaningOptions)}.`;
    if (c.strategyHint) facts.strategy = `Printed under the question: "${c.strategyHint}"`;
  }
  facts.learnerWork = describeClueWork(step, view);
  facts.constraints = step.phase === 'find'
    ? 'The learner taps sentences (a tap again lifts one), then presses Check Clue; the activity checks it.'
    : step.phase === 'classify' ? 'The learner taps one clue type, then presses Check Type; the activity checks it.'
    : c.meaningOptions?.length ? 'The learner taps one meaning, then presses Check Meaning; the activity checks it.'
    : 'The learner types the meaning, then presses Check Meaning; the activity checks it.';
  return { objects: [], facts };
}

// ---------------------------------------------------------------------------
// The journey's inputs
// ---------------------------------------------------------------------------

export const CHECK_LABEL: Record<CluePhase, string> = { find: 'Check Clue', classify: 'Check Type', define: 'Check Meaning' };
export const MEANING_INPUT_LABEL = 'Meaning';

export type ClueHarnessInput = { kind: 'choose'; label: string } | { kind: 'write'; label: string; text: string };

/**
 * The real controls for a right or a plain wrong answer to a step: a clue sentence (wrong: a sentence that is not a
 * clue, or none when every sentence is one), the right type (wrong: its signature confusion), the right option or
 * meaning (wrong: another option, or a typed off meaning). Each list ends with the step's Check.
 */
export function clueHarnessInputs(step: ClueStep, intent: 'correct' | 'wrong'): ClueHarnessInput[] | null {
  const c = step.challenge, check = { kind: 'choose' as const, label: CHECK_LABEL[step.phase] };
  switch (step.phase) {
    case 'find': {
      const pick = intent === 'correct' ? cluesToFind(c).find(id => sentenceNumber(c, id) > 0)
        : c.passage.sentences.find(s => !c.clueSentenceIds.includes(s.id) && s.id !== c.targetWordSentenceId)?.id
          ?? (cluesToFind(c).includes(c.targetWordSentenceId) ? undefined : c.targetWordSentenceId);
      return pick ? [{ kind: 'choose', label: sentenceLabel(sentenceNumber(c, pick)) }, check] : null;
    }
    case 'classify': {
      const swap: Partial<Record<ClueType, ClueType>> = { synonym: 'antonym', antonym: 'synonym', definition: 'synonym', example: 'definition', inference: 'example' };
      const type = intent === 'correct' ? c.clueType : swap[c.clueType]!;
      return [{ kind: 'choose', label: CLUE_TYPE_LABEL[type] }, check];
    }
    case 'define': {
      if (c.meaningOptions?.length) {
        const option = intent === 'correct' ? c.correctMeaning : c.meaningOptions.find(o => o !== c.correctMeaning);
        return option ? [{ kind: 'choose', label: option }, check] : null;
      }
      return [{ kind: 'write', label: MEANING_INPUT_LABEL, text: intent === 'correct' ? c.correctMeaning : 'a kind of food' }, check];
    }
  }
}

/**
 * The scripted path's session score, over the steps actually built: find 30, classify 30, define 40 when the session
 * has a type step; find and define rescaled to 100 (3/7, 4/7) when it has none. A step never asked earns nothing.
 */
export function scriptedScore(results: ReadonlyArray<{ clueCorrect: boolean; typeCorrect: boolean; meaningCorrect: boolean }>,
  hasClassify: boolean): number {
  if (!results.length) return 0;
  const share = (pick: (r: typeof results[number]) => boolean) => results.filter(pick).length / results.length;
  const [find, type, define] = hasClassify ? [30, 30, 40] : [300 / 7, 0, 400 / 7];
  return Math.round(share(r => r.clueCorrect) * find + share(r => r.typeCorrect) * type + share(r => r.meaningCorrect) * define);
}
