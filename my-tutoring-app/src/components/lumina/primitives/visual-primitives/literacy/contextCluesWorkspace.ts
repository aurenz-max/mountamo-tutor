/**
 * Context clues detective on the shared tutor/JEV teaching workspace, wired by its boss (`contextClues.card.ts`,
 * `contextClues.boss.ts`).
 *
 * Pure: the component and the boss read the same steps, ask, scene and check. Each
 * generated word is three checked steps, one workspace item each: find a clue sentence (tap sentences, Check
 * Clue), name the clue type (tap one of five types, Check Type), give the meaning (tap an option or type it,
 * Check Meaning). The activity's own check is the judge, so the tutor is never handed `clueSentenceIds`,
 * `clueType` or `correctMeaning` before the step that asks for it is credited.
 */
import { textFacts } from '../../../components/live-activity/runtime/sceneFacts';
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { ContextClueChallenge } from './ContextCluesDetective';
import type { ContextClueMiss } from './contextClues.card';

export { CONTEXT_CLUE_MISSES_BY_MODE, FIND_MISSES, type ContextClueMiss } from './contextClues.card';

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

/** The learner's work the check and the tutor read. */
export interface ClueView {
  /** Tapped sentence ids, in passage order. */
  picked: readonly string[];
  clueType: string;
  /** The tapped option, or the typed meaning when the word has no options. */
  meaning: string;
}

// ---------------------------------------------------------------------------
// The checks
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

/** What a wrong check shows (`TeachingAttempt.miss`): the card lists them (`contextClues.card.ts`). */
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
}

/** What is drawn and asked, never a key before its step is credited. `kind` names the step. What a lever or the
 *  support tier adds (the list, the descriptions, the strategy) is the lever set's `onScreen` fact. */
export function clueScene(step: ClueStep, view: ClueSceneView): SceneOf {
  const c = step.challenge;
  const numbered = c.passage.sentences.map((s, i) => `(${i + 1}) ${s.text.trim()}`).join(' ');
  const facts: Record<string, string> = {
    kind: step.phase,
    ...textFacts('passage', numbered),
    word: `The mystery word "${c.targetWord}" is highlighted where it appears in the passage.`,
    step: `Word ${step.challengeIndex + 1} of ${view.total}, step ${step.phases.indexOf(step.phase) + 1} of ${step.phases.length}: `
      + (step.phase === 'find' ? 'find a clue sentence' : step.phase === 'classify' ? 'name the clue type' : 'give the meaning') + '.',
  };
  if (step.phase !== 'find')
    facts.clueSentences = `Found in the find step: the clue is in ${sentenceList(numbers(c, c.clueSentenceIds))}, shaded green.`;
  if (step.phase === 'classify') facts.menu = `Clue-type buttons: ${CLUE_TYPES.map(t => CLUE_TYPE_LABEL[t]).join(', ')}.`;
  if (step.phase === 'define') {
    facts.clueType = step.phases.includes('classify')
      ? `Named in the type step: the clue type is ${CLUE_TYPE_LABEL[c.clueType]}.`
      : `Every word in this lesson has a ${CLUE_TYPE_LABEL[c.clueType]} clue (there is no type step).`;
    facts.menu = c.meaningOptions?.length ? `Meaning choices: ${quoteList(c.meaningOptions)}.`
      : 'No meanings are printed: the learner types the meaning in the box.';
    facts.dictionary = 'The dictionary definition appears only once the meaning is credited.';
  }
  if (step.phase === 'find') facts.check = 'The check passes when the tapped sentences hold a clue and every one is a clue or '
    + "the word's own sentence; the word's own sentence alone passes only when the clue is inside it, and tapping every "
    + 'sentence does not pass.';
  facts.learnerWork = describeClueWork(step, view);
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
