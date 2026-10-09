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
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
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
  const misses = causeEffectSpokenMisses(item);
  return { id: item.id, task: ask(item), response: 'speech', expectedAnswer, ...(misses.length ? { misses } : {}) };
}

/** What a wrong spoken verdict shows (handoff 20 Part B), by the event's role. */
export type SpokenChainMiss = 'cause_denied' | 'consequence_as_cause' | 'background_as_cause' | 'other_end' | 'middle_event';

/**
 * identify_cause's known wrong answer, stated from the event's role: a real cause said not to help, an event that
 * came after the ending said to cause it, or a background fact said to cause it. root_vs_proximate: the event at the
 * other end of the chain (`other_end`, the signature miss), or one from its middle (`middle_event`).
 */
export function causeEffectSpokenMisses(item: CauseEffectChainItem): KnownMiss[] {
  if (item.kind === 'root_vs_proximate') return endMisses(item);
  if (item.kind !== 'identify_cause') return [];
  const event = item.card.text.replace(/[.!?]+$/, ''), ending = item.outcome.text.replace(/[.!?]+$/, '');
  if (item.isCause) return [{ id: 'cause_denied', pattern: `The right answer is "yes": "${event}" came before "${ending}" and helped cause it. The learner gives the opposite answer, "no" (or "nope", "it did not").`,
    examples: ['no', 'it did not'] }];
  return [item.role === 'consequence'
    ? { id: 'consequence_as_cause', pattern: `The right answer is "no": "${event}" could only happen after "${ending}" had already happened. The learner gives the opposite answer, "yes" (or "yeah", "it helped").`, examples: ['yes', 'it helped'] }
    : { id: 'background_as_cause', pattern: `The right answer is "no": "${event}" was only true at the time and pushed nothing along toward "${ending}". The learner gives the opposite answer, "yes" (or "yeah", "it helped").`, examples: ['yes', 'it helped'] }];
}

/** root_vs_proximate's known wrong answers, by where the named card sits in the chain. */
function endMisses(item: Extract<CauseEffectChainItem, { kind: 'root_vs_proximate' }>): KnownMiss[] {
  const right = correctChoiceOf(item);
  const otherId = item.ask === 'proximate' ? item.correctOrder[0] : item.correctOrder[item.correctOrder.length - 1];
  const other = item.choices.find(c => c.card.id === otherId);
  const middle = item.choices.filter(c => c !== right && c !== other);
  const asked = item.ask === 'proximate' ? 'the event right before the ending' : 'the root';
  const plain = (t: string) => t.replace(/[.!?]+$/, '');
  const misses: KnownMiss[] = [];
  if (other) misses.push({ id: 'other_end', pattern: `The right answer is "${plain(right.card.text)}", ${asked}. The learner names `
    + `"${plain(other.card.text)}" instead, the event at the other end of the chain.`, examples: [other.distinguisher] });
  if (middle.length) misses.push({ id: 'middle_event', pattern: `The right answer is "${plain(right.card.text)}", ${asked}. The learner `
    + `names an event from the middle of the chain: ${middle.map(c => `"${plain(c.card.text)}"`).join(' or ')}.`,
    examples: middle.map(c => c.distinguisher).slice(0, 6) });
  return misses;
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

/**
 * What a checked wrong chain shows (handoff 20), the same shapes as number-sequencer's `orderMiss`: `reversed`
 * (the event nearest the ending placed first, the order run backwards), `two_swapped` (only two cards out of
 * place), `other_order`. identify_cause and root_vs_proximate are spoken
 * (`causeEffectSpokenMisses`, Part B).
 */
export type ChainMiss = 'reversed' | 'two_swapped' | 'other_order';

export function chainMiss(item: BuildChainItem, placed: readonly (string | null)[]): ChainMiss | undefined {
  if (chainMatches(item, placed) || placed.length !== item.correctOrder.length) return undefined;
  if (placed.every((id, i) => id === item.correctOrder[item.correctOrder.length - 1 - i])) return 'reversed';
  return placed.filter((id, i) => id !== item.correctOrder[i]).length === 2 ? 'two_swapped' : 'other_order';
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
