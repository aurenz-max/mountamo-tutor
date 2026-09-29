/**
 * Rhyme studio on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch C1). Its only teaching path: the scripted
 * runner was retired (LA-14, user ruling 09-23: one path).
 *
 * Pure: the component and the journey read the same assignment and scene. Every item is one
 * spoken answer: yes or no (recognition), the rhyming choice (identification), any rhyme
 * (production), or a new rhyme for the family being collected (collection).
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import { rhymeStudioHarnessAnswers, type RhymeItem } from './rhymeStudioScript';
import { onsetOf, rimeOfWord } from './rhymeModels';

/** The ask, in the pack's words. The ending sound is never named: it is the answer's family. */
export function rhymeAsk(item: RhymeItem): string {
  switch (item.mode) {
    case 'recognition':
      return `Listen to these two words: ${item.targetWord}, ${item.comparisonWord}. Do they rhyme? Say yes or no.`;
    case 'identification':
      return `Listen to this word: ${item.targetWord}. Which word on the screen rhymes with ${item.targetWord}? Say it.`;
    case 'production':
      return `Listen to this word: ${item.targetWord}. Tell me a word that rhymes with ${item.targetWord}.`;
    case 'collection':
      return `Listen to this word: ${item.targetWord}. Say a new word that rhymes with ${item.targetWord}.`;
  }
}

/** `collected`: the family's words already credited, which a collection slot must not repeat. */
export function rhymeAssignment(item: RhymeItem, collected: readonly string[] = item.priorAcceptedWords): TeachingAssignment {
  const other = `, not ${item.targetWord} itself`;
  const expectedAnswer = item.mode === 'recognition'
    ? (item.doesRhyme ? `Yes: ${item.targetWord} and ${item.comparisonWord} rhyme.`
      : `No: ${item.targetWord} and ${item.comparisonWord} do not rhyme.`)
    : item.mode === 'identification'
      ? `${item.answer}, the choice that rhymes with ${item.targetWord}.`
      : item.mode === 'production'
        ? `Any real word that rhymes with ${item.targetWord} (ends in -${item.rime})${other}. A made-up word is not.`
        : `A real word that rhymes with ${item.targetWord} (ends in -${item.rime})${other}`
          + (collected.length ? ` and not one already collected (${collected.join(', ')}).` : '.');
  const misses = rhymeSpokenMisses(item);
  return { id: item.id, task: rhymeAsk(item), response: 'speech', expectedAnswer, ...(misses.length ? { misses } : {}) };
}

const OFF_MENU_WORDS = ['ball', 'fish', 'tree', 'moon', 'duck'];

/**
 * A spoken item's known wrong answers (handoff 20 Part B), from the ids `RHYME_MISSES` declares. recognition: the
 * one wrong verdict, named by what the pair shares. identification: a choice that only starts like the target, the
 * target said back, a word that is no choice. Production and collection accept any real rhyme: none yet.
 */
export function rhymeSpokenMisses(item: RhymeItem): KnownMiss[] {
  const target = item.targetWord.toLowerCase();
  if (item.mode === 'recognition' && item.comparisonWord) {
    const other = item.comparisonWord.toLowerCase(), pair = `"${target}" and "${other}"`;
    if (item.doesRhyme) return [{ id: 'no_to_rhyme', pattern: `${pair} rhyme: they end with the same sound. The learner says no, they do not rhyme.`, examples: ['no', "no, they don't"] }];
    const sameStart = !!onsetOf(target) && onsetOf(target) === onsetOf(other);
    return [sameStart
      ? { id: 'yes_same_start', pattern: `${pair} start with the same sound but do not rhyme. The learner says yes, they rhyme.`, examples: ['yes', 'yes, they rhyme'] }
      : { id: 'yes_no_rhyme', pattern: `${pair} do not rhyme and do not start alike. The learner says yes, they rhyme.`, examples: ['yes', 'yes, they rhyme'] }];
  }
  if (item.mode !== 'identification') return [];
  const choices = item.choices.map(c => c.word.toLowerCase()), menu = choices.join(', ');
  const foils = choices.filter(w => w !== item.answer.toLowerCase() && !!onsetOf(w) && onsetOf(w) === onsetOf(target));
  const off = OFF_MENU_WORDS.filter(w => !choices.includes(w) && w !== target && rimeOfWord(w) !== rimeOfWord(target)).slice(0, 1);
  return [
    ...(foils.length ? [{ id: 'onset_foil', pattern: `The choices are ${menu}. ${foils.map(w => `"${w}"`).join(' and ')} starts with the same sound as "${target}" but does not rhyme with it. The learner says ${foils.map(w => `"${w}"`).join(' or ')}.`, examples: foils }] : []),
    { id: 'echo_target', pattern: `The word to rhyme with is "${target}". The learner says "${target}" itself back instead of a choice.`, examples: [target] },
    { id: 'off_menu', pattern: `The choices on the screen are ${menu}. The learner says a word that is none of them and not "${target}" either.`, examples: off },
  ];
}

export interface RhymeView {
  /** Words of the family already credited, in slot order (collection). */
  collected: readonly string[];
  /** The rime is highlighted on the target card at this tier. */
  familyShown: boolean;
}

export function rhymeScene(item: RhymeItem, view: RhymeView): WorkspaceScene {
  const facts: Record<string, string> = {};
  if (item.mode === 'identification') {
    facts.choices = item.choices.map(c => c.word).join(', ');
    facts.namingChoices = item.namesChoices
      ? 'You may say the choices aloud; the learner cannot read them.'
      : 'The learner reads the choices on screen: do not read them aloud.';
  }
  if (item.mode === 'collection') {
    facts.slot = `${item.collectionSlot ?? 1} of ${item.collectionSize ?? 3}`;
    facts.collected = view.collected.length ? view.collected.join(', ') : 'none yet';
  }
  facts.constraints = 'The learner answers out loud. '
    + (item.mode === 'recognition' ? 'Both words are shown; which endings match is shown only after credit.'
      : item.mode === 'identification' ? 'The target and the choices are shown; the rhyming choice is marked only after credit.'
        : item.mode === 'production' ? 'Only the target word is shown; there are no choices.'
          : 'The target and the rhymes collected so far are shown; empty spots show no example.')
    + (view.familyShown && item.mode !== 'recognition' ? ' The ending of the target word is highlighted at this level.' : '')
    + ' Tapping the word card asks you to say the question again.';
  return { objects: [], facts };
}

/** What a tapped card asks the tutor to say: the question only, never which words rhyme. */
export const hearRhymeRequest = (item: RhymeItem) =>
  `The learner tapped to hear the question again. Say only this, once: "${rhymeAsk(item)}" Never say which words rhyme or name the ending.`;

/** The journey's answers. Production and collection have no code-owned answer, so the journey cannot drive them. */
export function rhymeHarnessAnswers(item: RhymeItem): { correct: string; plainWrong: string } {
  if (item.mode === 'production' || item.mode === 'collection')
    throw new Error(`rhyme-studio ${item.mode} has no code-owned answer to drive`);
  const { correct, plainWrong } = rhymeStudioHarnessAnswers(item);
  return { correct, plainWrong };
}
