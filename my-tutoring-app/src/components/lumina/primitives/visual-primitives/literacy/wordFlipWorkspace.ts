/**
 * Word flip on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch B2). Its only teaching path: the scripted
 * speech loop was retired (LA-14, user ruling 09-23: one path).
 *
 * Pure: the component and the journey read the same assignment and scene. Every item is one
 * spoken answer, the transformed word, judged against the challenge's `answer`.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { WordFlipChallenge, WordFlipChallengeType } from './WordFlip';
import { countWord } from './wordFlipScript';

export const isPluralFlip = (type: WordFlipChallengeType): boolean => type !== 'past_ed' && type !== 'past_irregular';

/** The ask, with the answer nowhere in it: "Three what?" has one correct completion, the plural. */
export function flipAssignment(c: WordFlipChallenge): TeachingAssignment {
  const count = countWord(c.count ?? 2);
  const task = isPluralFlip(c.type)
    ? `There is one ${c.sourceWord}. Now there are ${count}. Say the word for ${count} of them: ${count} what?`
    : `Today I ${c.sourceWord}. It already happened yesterday. Say how it goes: yesterday I...`;
  const misses = flipSpokenMisses(c);
  return { id: c.id, task, response: 'speech', expectedAnswer: c.answer, ...(misses.length ? { misses } : {}) };
}

/**
 * The item's known wrong answers (handoff 20 Part B), from the ids `FLIP_MISSES` declares: the word said back
 * unchanged, the regular rule on an irregular word, the ending twice. `wrong_ending` is not stated: on -es, -y and
 * -ed items it is heard as the answer ("boxs" as "box", "babys" as "babies"), and on plural_s the observer read
 * "sockses" as the "sockes" pattern in 5 of 5 probe runs on 09-28.
 */
export function flipSpokenMisses(c: WordFlipChallenge): KnownMiss[] {
  const source = c.sourceWord.toLowerCase(), answer = c.answer.toLowerCase();
  const plural = isPluralFlip(c.type), change = plural ? `the word for more than one ${source}` : `"${source}" said as already happened`;
  const fact = `The answer is "${answer}", ${change}. `;
  const unchanged = { id: 'unchanged', pattern: `${fact}The learner says "${source}", the same word as for ${plural ? `one ${source}` : 'today'}, with nothing added or changed.`, examples: [source, `${plural ? countWord(c.count ?? 2) : 'yesterday I'} ${source}`] };
  if (c.type === 'irregulars' || c.type === 'past_irregular') {
    const regular = plural ? `${source}s` : /[^aeiou][aeiou][bdgmnpt]$/.test(source) ? `${source}${source.at(-1)}ed` : `${source.replace(/e$/, '')}ed`;
    return [{ id: 'regularized', pattern: `${fact}The learner adds the usual ending to "${source}" and says "${regular}", a word that is not "${answer}".`, examples: [regular] }, unchanged];
  }
  const twice = c.type === 'past_ed' ? `${answer}ed` : `${answer}es`;
  return [
    unchanged,
    { id: 'double_ending', pattern: `${fact}The learner puts the ending on twice and says "${twice}".`, examples: [twice] },
  ];
}

export function flipScene(c: WordFlipChallenge): WorkspaceScene {
  return { objects: [], facts: {
    change: isPluralFlip(c.type) ? `one to ${countWord(c.count ?? 2)}` : 'today to yesterday',
    constraints: 'The learner says the new word aloud. The word on the one-side card is printed; the new word is a '
      + 'blank until it is credited. Tapping the card asks you to say its word.',
  } };
}

/** What a tapped source card asks the tutor to say: the word unchanged, never the answer. */
export const sourceWordRequest = (sourceWord: string) =>
  `The learner tapped the word card. Say this word once, unchanged, and nothing else: "${sourceWord}".`;

/** The journey's answers: the word itself, or the source word said back (the signature error). */
export const flipHarnessAnswers = (c: WordFlipChallenge) => ({ correct: c.answer, plainWrong: c.sourceWord });
