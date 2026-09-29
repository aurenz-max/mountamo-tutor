/**
 * Era explorer on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch C8). Its only teaching path: the scripted
 * runner was retired (LA-14, user ruling 09-23: one path).
 *
 * Pure: the component and the journey read the same assignment and scene. Every item is one
 * spoken pick from a three-part menu the ask states aloud (the mats rule): which lens a life
 * detail comes from (lens_id), only then, only now or both (era_sort), this era, the one before
 * or both (era_compare), or which of three causes changed life (cause_of_change). The era cards
 * are open-book evidence and stay on screen.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { textFacts } from '../../../components/live-activity/runtime/sceneFacts';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import {
  askFor,
  correctChoiceOf,
  eraExplorerHarnessAnswers,
  itemsFromChallenges,
  type EraChallengeLike,
  type EraExplorerItem,
  type EraTier,
} from './eraExplorerScript';

const ORDINALS = ['first', 'second', 'third'];

export interface EraPayloadLike {
  eraName?: string;
  priorEra?: { name: string; body: string };
  lenses?: { title: string; body: string }[];
  challenges?: EraChallengeLike[];
  supportTier?: EraTier;
}

/** The items a payload asks, built by the pack's gates: shared by the component, the adapter and the journey. */
export const eraItems = (data: EraPayloadLike): EraExplorerItem[] => {
  const lenses = data.lenses ?? [];
  return itemsFromChallenges(data.challenges ?? [], {
    eraName: data.eraName ?? '', priorEraName: data.priorEra?.name ?? '',
    lensTitles: lenses.map(l => l.title), lensBodies: lenses.map(l => l.body),
  }, { tier: data.supportTier });
};

/** The pack's own ask, without its "Listen." and "Your turn." protocol words. */
const ask = (item: EraExplorerItem) =>
  askFor(item).replace(/^Listen\.\s*/, '').replace(/\s*Your turn\.\s*/, ' ').replace(/\s+/g, ' ').trim();

const quoted = (words: readonly string[]) => words.map(w => `"${w}"`).join(', ');

const SIGNATURE: Record<EraExplorerItem['kind'], (both: boolean) => string> = {
  lens_id: () => 'Naming a thing from the sentence, or the era itself, instead of a lens is not an answer.',
  era_sort: both => (both ? 'Putting something that still happens back in the past because it sounds old-fashioned is the signature miss.'
    : '"Both" for something that belongs to one time only is the signature miss.'),
  era_compare: () => '"Today", "now" and "our time" are not choices here and are wrong.',
  cause_of_change: () => 'Saying what changed instead of why is not a cause.',
};

export function eraAssignment(item: EraExplorerItem): TeachingAssignment {
  const c = correctChoiceOf(item);
  const others = item.choices.filter((_, i) => i !== item.correctIndex).map(o => o.distinguisher);
  const expectedAnswer = `"${c.phrase}" (the ${ORDINALS[item.correctIndex]} choice the ask offered). A child never says the `
    + `whole phrase back: ${quoted([c.distinguisher, ...c.alsoCounts])} count on their own or in a sentence, and so does its `
    + `place in the menu. ${quoted(others)} are wrong, and so is an answer that does not pick exactly one of the three. `
    + SIGNATURE[item.kind](c.distinguisher === 'both');
  const misses = eraSpokenMisses(item);
  return { id: item.id, task: ask(item), response: 'speech', expectedAnswer, ...(misses.length ? { misses } : {}) };
}

/** What a wrong spoken pick shows (handoff 20 Part B), by the choice picked. */
export type SpokenEraMiss = 'said_back_then' | 'said_today' | 'said_both' | 'other_cause' | 'said_what_changed';

/** era_sort's menu, in the ask's order: only then, only today, both. */
const SORT_IDS = ['said_back_then', 'said_today', 'said_both'] as const;

/**
 * An item's known wrong answers, in precedence order, for the `spoken_miss` observer: on era_sort, each other time
 * named for what it is; on cause_of_change, another offered cause, then what changed said instead of why.
 * lens_id and era_compare name none yet (no saved payload).
 */
export function eraSpokenMisses(item: EraExplorerItem): KnownMiss[] {
  const right = correctChoiceOf(item);
  if (item.kind === 'era_sort' && item.choices.length === 3) {
    return item.choices.flatMap((c, i) => i === item.correctIndex ? [] : [{ id: SORT_IDS[i],
      pattern: `The right choice is "${right.phrase}". The learner picks "${c.phrase}" instead, for example ${[c.distinguisher, ...c.alsoCounts].slice(0, 2).map(w => `"${w}"`).join(' or ')}.`,
      examples: [c.distinguisher] }]);
  }
  if (item.kind === 'cause_of_change') {
    const others = item.choices.filter((_, i) => i !== item.correctIndex);
    return [
      { id: 'other_cause', pattern: `The right choice is "${right.phrase}". The learner picks another offered cause instead: ${others.map(o => `"${o.phrase}"`).join(' or ')}.`,
        examples: others.map(o => o.distinguisher).slice(0, 2) },
      { id: 'said_what_changed', pattern: `The learner says what changed ("${item.statement.replace(/[.!?]+$/, '')}") instead of why it changed.`,
        examples: [item.statement.replace(/[.!?]+$/, '')] },
    ];
  }
  return [];
}

export function eraScene(item: EraExplorerItem, data: EraPayloadLike, cardsOpen: boolean, readsAloud: boolean): WorkspaceScene {
  const facts: Record<string, string> = { statement: item.statement };
  if (cardsOpen) {
    (data.lenses ?? []).forEach((lens, i) => Object.assign(facts, textFacts(`card${i + 1}`, `${lens.title}: ${lens.body}`)));
    if (item.kind === 'era_compare' && data.priorEra) Object.assign(facts, textFacts('before', `Before that, ${data.priorEra.name}: ${data.priorEra.body}`));
  } else {
    facts.cards = 'The era cards are folded away; the learner can open them.';
  }
  facts.constraints = 'The learner answers out loud with one of the three choices; no choice is printed until the answer is credited.'
    + (readsAloud ? ' The learner does not read yet: read the statement and a card aloud when asked.' : '');
  return { objects: [], facts };
}

/** What a card's read-aloud asks the tutor: the lens body, word for word. It never names a choice. */
export const hearCardRequest = (title: string, body: string) =>
  `The learner tapped to hear the ${title} card. Read it aloud once, word for word, and nothing else: "${body}"`;

/** The journey's answers: the pack's own right and plainly wrong picks. */
export function eraJourneyAnswers(item: EraExplorerItem): { correct: string; plainWrong: string } {
  const { correct, plainWrong } = eraExplorerHarnessAnswers(item);
  return { correct, plainWrong };
}
