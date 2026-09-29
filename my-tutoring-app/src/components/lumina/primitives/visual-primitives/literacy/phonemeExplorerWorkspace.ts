/**
 * Phoneme explorer on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch C1). Its only teaching path: the scripted
 * runner was retired (LA-14, user ruling 09-23: one path).
 *
 * Pure: the component and the journey read the same assignment and scene. Every item is one
 * spoken answer: a card word (isolate, ending, medial), the blended word, the sound count, or
 * the new word after one sound changes. The task is the pack's own ask.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import { speakablePhoneme } from './phonemeVoice';
import { LETTER_NAME, wordReadingMisses } from './spokenReadingMisses';
import { askFor, phonemeExplorerHarnessAnswers, spokenPhonemeToken, spokenSound, type PhonemeExplorerItem }
  from './phonemeExplorerScript';

const cards = (item: PhonemeExplorerItem) => (item.menu ?? []).map(c => c.word).join(', ');

export function phonemeAssignment(item: PhonemeExplorerItem): TeachingAssignment {
  const expectedAnswer = (() => {
    switch (item.kind) {
      case 'isolate':
        return `${item.answer}, the card that starts with ${spokenSound(item.phonemeSound)}.`
          + (item.exampleWord ? ` The example word ${item.exampleWord} is not a card, so it is not the answer.` : '');
      case 'ending':
        return `${item.answer}, the card with the same ending sound as ${item.targetWord}. ${item.targetWord} said back is not a card.`;
      case 'medial':
        return `${item.answer}, the card with the same middle sound as ${item.targetWord}. ${item.targetWord} said back is not a card.`;
      case 'blend':
        return `${item.answer}. Sounding it out and landing on ${item.answer} counts; the sounds with no word at the end do not.`;
      case 'segment':
        return `${item.answer} (${item.soundCount}). Counting the sounds aloud that ends on ${item.answer} counts; a count that runs past it does not.`;
      case 'manipulate':
        return `${item.answer}. ${item.originalWord} said back unchanged is not it.`;
    }
  })();
  const misses = phonemeSpokenMisses(item);
  return { id: item.id, task: askFor(item), response: 'speech', expectedAnswer, ...(misses.length ? { misses } : {}) };
}

/**
 * A spoken item's known wrong answers (handoff 20 Part B), from the ids `PHONEME_MISSES` declares. isolate: the
 * example word said back, the letter's name. blend: the sounds with no word, a real word one sound off. The other
 * modes have no saved payload to measure a list against yet, so they name none.
 */
export function phonemeSpokenMisses(item: PhonemeExplorerItem): KnownMiss[] {
  if (item.kind === 'blend' && item.phonemeSequence?.length) {
    return wordReadingMisses(item.answer, { sounds: item.phonemeSequence, nearId: 'near_word', only: ['sounds_no_word', 'near_word'],
      fact: `The sounds on the tiles are ${item.phonemeSequence.join(', ')}, and they blend into "${item.answer.toLowerCase()}". ` });
  }
  if (item.kind !== 'isolate') return [];
  const menu = cards(item), letter = (item.phoneme ?? '').toLowerCase(), name = LETTER_NAME[letter];
  const example = item.exampleWord?.toLowerCase();
  const onMenu = (item.menu ?? []).some(c => c.word.toLowerCase() === example);
  return [
    ...(example && item.voiceExample && !onMenu ? [{ id: 'echo_stimulus', pattern: `The example word is "${example}", and it is not one of the cards (${menu}). The learner says "${example}", the example word, instead of a card.`, examples: [example] }] : []),
    ...(name && letter.length === 1 ? [{ id: 'letter_name', pattern: `The sound is written with the letter ${letter.toUpperCase()}. The learner says the letter's NAME, "${name}", and no card word.`, examples: [name, letter.toUpperCase()] }] : []),
  ];
}

export function phonemeScene(item: PhonemeExplorerItem): WorkspaceScene {
  const facts: Record<string, string> = {};
  if (item.menu?.length) {
    facts.cards = cards(item);
    facts.namingCards = item.enumerateMenu === false
      ? 'The learner reads the cards: do not read them aloud.'
      : 'You may say the card words aloud.';
  }
  const shown = (() => {
    switch (item.kind) {
      case 'isolate': return 'The letter for the sound and the cards are shown.';
      case 'ending': return 'Only pictures are shown: the target word and the card words are not printed until credit.';
      case 'medial': return 'The target word is never printed; the cards are.';
      case 'blend': return 'The sounds are shown as separate tiles; the word appears only after credit.';
      case 'segment': return 'The word is never printed (a reader would count letters); the count appears only after credit.';
      case 'manipulate': return 'The starting word and the change are printed; the new word appears only after credit.';
    }
  })();
  facts.constraints = `The learner answers out loud. ${shown} Tapping a card, tile or picture asks you to say that word `
    + 'or sound only.';
  return { objects: [], facts };
}

/** What a tapped card or picture asks the tutor to say: that word only. */
export const hearWordRequest = (word: string) => `The learner tapped a card. Say only this word, once: "${word}".`;

/** What a tapped tile asks the tutor to say: that sound only. */
export const hearSoundRequest = (raw: string) =>
  `The learner tapped a sound. Say only this sound, once: ${spokenPhonemeToken(raw) ?? speakablePhoneme(raw)}.`;

/** The journey's answers: the pack's own right and plainly wrong answers. */
export function phonemeHarnessAnswers(item: PhonemeExplorerItem): { correct: string; plainWrong: string } {
  const { correct, plainWrong } = phonemeExplorerHarnessAnswers(item);
  return { correct, plainWrong };
}
