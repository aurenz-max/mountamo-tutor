/**
 * Cause-effect chain on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch C8). Its only teaching path: the scripted
 * runner was retired (LA-14, user ruling 09-23: one path).
 *
 * Pure: the component and the journey read the same assignment and scene. Three kinds of item,
 * all built by the pack's gates: identify_cause is one spoken yes or no about one event card;
 * root_vs_proximate is one spoken pick of a card (the root, or the one right before the ending);
 * build_chain is the cards placed in causal order with the hands, checked in code
 * (`chainMatches`), so its key never reaches the tutor.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { textFacts } from '../../../components/live-activity/runtime/sceneFacts';
import {
  askFor,
  causeEffectChainHarnessAnswers,
  correctChoiceOf,
  itemsFromChallenges,
  type BuildChainItem,
  type CauseEffectChainItem,
  type ChainChallengeLike,
  type ChainTier,
} from './causeEffectChainScript';

/** The items a payload asks, built by the pack's gates: shared by the component, the adapter and the journey. */
export const causeEffectItems = (data: { challenges?: ChainChallengeLike[]; periodLabel?: string; gradeLevel?: string;
  supportTier?: ChainTier }): CauseEffectChainItem[] =>
  itemsFromChallenges(data.challenges ?? [], { periodLabel: data.periodLabel ?? '', gradeLevel: data.gradeLevel },
    { tier: data.supportTier });

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];

/** The pack's own ask, without its "Listen." and "Your turn." protocol words. */
const ask = (item: CauseEffectChainItem) =>
  askFor(item).replace(/^Listen\.\s*/, '').replace(/\s*Your turn\.\s*/, ' ').replace(/\s+/g, ' ').trim();

const quoted = (words: readonly string[]) => words.map(w => `"${w}"`).join(', ');

export function causeEffectAssignment(item: CauseEffectChainItem): TeachingAssignment {
  if (item.kind === 'build_chain') return { id: item.id, task: ask(item), response: 'gesture' };
  let expectedAnswer: string;
  if (item.kind === 'identify_cause') {
    const right = item.isCause ? 'yes' : 'no';
    const why = item.role === 'cause' ? 'it came before the ending and the ending needed it'
      : item.role === 'consequence' ? 'it could only happen once the ending had already happened'
        : 'it was true at the time but pushed nothing along';
    expectedAnswer = `${right}: "${item.card.text}" ${item.isCause ? 'helped' : 'did not help'} cause the ending, because ${why}. `
      + `Any natural form of ${right} counts (${item.isCause ? '"yeah", "it did", "it helped"' : '"nope", "it did not", "it didn\'t"'}), `
      + `alone or in a sentence. Saying the event back, "maybe" or "sort of" gives no verdict and is not it.`
      + (item.role === 'consequence' ? ' Being about the same people or things is not being a cause.'
        : item.role === 'background' ? ' Being true at the time is not being a cause.'
          : ' A cause does not have to be the last or the biggest event.');
  } else {
    const c = correctChoiceOf(item);
    const others = item.choices.filter((_, i) => i !== item.correctIndex).map(o => o.card.text);
    expectedAnswer = `"${c.card.text}" (the ${ORDINALS[item.correctIndex]} card on screen), the ${item.ask === 'proximate'
      ? 'event right before the ending' : 'root, the event none of the others could happen without'}. `
      + `Its own words count on their own (${quoted([c.distinguisher, ...c.alsoCounts])}), and so does its place on screen. `
      + `Any other event is wrong (${quoted(others)}), and so is an answer that does not pick exactly one event.`;
  }
  return { id: item.id, task: ask(item), response: 'speech', expectedAnswer };
}

/** The cards in on-screen order, numbered: the page's own shuffle, never the causal order. */
const cardList = (item: CauseEffectChainItem) => item.cards.map((c, i) => `${i + 1}. ${c.text}`).join(' ');

export function causeEffectScene(item: CauseEffectChainItem, context: string, placed: readonly (string | null)[]): WorkspaceScene {
  const facts: Record<string, string> = {
    ...(context ? textFacts('background', context) : {}),
    ending: item.outcome.text,
  };
  if (item.kind === 'identify_cause') {
    facts.event = `The one event on screen: ${item.card.text}`;
    facts.constraints = 'The learner says yes or no out loud; nothing marks the event as a cause until the answer is credited.';
  } else if (item.kind === 'root_vs_proximate') {
    facts.events = `Event cards on screen, numbered in the order they sit: ${cardList(item)}`;
    facts.constraints = 'The learner names one event out loud; nothing marks the answer until it is credited.';
  } else {
    facts.events = `Event cards on screen, in shuffled order: ${cardList(item)}`;
    facts.board = describeChain(item, placed);
    facts.constraints = 'The learner builds the chain by tapping the cards into the slots, earliest first; the chain is checked by '
      + 'the activity once every slot is filled and the board stays still.';
  }
  if (item.emergingReader) facts.constraints += ' The learner does not read yet: read the ending and the events aloud when the ask carries them.';
  return { objects: [], facts };
}

/** Whether the full board is the chain the ending needed. */
export function chainMatches(item: BuildChainItem, placed: readonly (string | null)[]): boolean {
  return placed.length === item.correctOrder.length && placed.every((id, i) => id === item.correctOrder[i]);
}

/** The learner's board in words, slot by slot. Never the key. */
export function describeChain(item: BuildChainItem, placed: readonly (string | null)[]): string {
  const text = (id: string | null) => (id ? item.cards.find(c => c.id === id)?.text ?? id : 'empty');
  if (!placed.length) return 'The chain slots are empty.';
  return `The chain, earliest first: ${placed.map((id, i) => `slot ${i + 1}: ${text(id)}`).join('; ')}.`;
}

/** What the background's read-aloud asks the tutor: the paragraph, word for word. It never says what caused what. */
export const hearBackgroundRequest = (context: string) =>
  `The learner tapped to hear the background. Read it aloud once, word for word, and nothing else: "${context}"`;

/** The journey's answers: the code-computed answer, or a plain wrong one. A chain is a card order. */
export function causeEffectJourneyAnswers(item: CauseEffectChainItem): { correct: string; plainWrong: string; order?: { correct: string[]; wrong: string[] } } {
  const answers = causeEffectChainHarnessAnswers(item);
  const order = answers.tapped
    ? { correct: answers.tapped.correct.split(','), wrong: answers.tapped.wrong.split(',') } : undefined;
  return { correct: answers.correct, plainWrong: answers.plainWrong, order };
}
