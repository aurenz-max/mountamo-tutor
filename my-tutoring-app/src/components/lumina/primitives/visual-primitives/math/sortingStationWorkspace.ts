/**
 * Sorting station on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/live-runtime-handoffs/15-workspace-rollout.md).
 *
 * Pure: the component and any probe read the same assignment and scene. The items
 * still come from `itemsFromChallenges` in `sortingStationScript.ts`. Every item is
 * spoken, judged by the observer against the pack's own `answer`.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { offByMisses, type KnownMiss, type OffByMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import { askFor, type SortingStationItem } from './sortingStationScript';

/** What a wrong spoken answer at the station shows (handoff 20 Part B). */
export type SpokenSortingMiss = OffByMiss | 'said_object' | 'other_group' | 'other_rule' | 'belonging_card' | 'said_all_belong'
  | 'said_same' | 'bare_more' | 'opposite_verdict' | 'one_criterion_only';

const list = (words: readonly string[], joiner: 'or' | 'and') => words.length < 2 ? words.join('')
  : `${words.slice(0, -1).join(', ')} ${joiner} ${words.at(-1)}`;
const orList = (words: readonly string[]) => list(words, 'or');
const andList = (words: readonly string[]) => list(words, 'and');

/**
 * A spoken item's known wrong answers, in precedence order, for the `spoken_miss` observer. Concrete per item:
 * the card, the printed groups or the counted group, never a cause.
 */
export function sortingStationSpokenMisses(item: SortingStationItem): KnownMiss[] {
  const others = item.choices.filter(c => c.toLowerCase() !== item.answer.toLowerCase());
  switch (item.kind) {
    case 'sort': {
      const fact = `The groups are ${andList(item.choices)}; ${item.stimulus} goes with ${item.answer}.`;
      return [
        { id: 'said_object', pattern: `${fact} The learner's answer is "${item.stimulus}", the name of the thing being sorted, not a group name.`, examples: [item.stimulus] },
        ...(others.length ? [{ id: 'other_group', pattern: `${fact} The learner's answer is ${orList(others)}, another group.`, examples: others.slice(0, 2) }] : []),
      ];
    }
    case 'pick_rule':
      return others.length ? [{ id: 'other_rule', pattern: `The ways to sort are ${andList(item.choices)}, and these cards are sorted by ${item.answer}. `
        + `The learner's answer is ${orList(others)}, another way.`, examples: others.slice(0, 2) }] : [];
    case 'odd_one': {
      const fact = `The cards are ${andList(item.choices)}; ${item.answer} is the one that does not belong.`;
      return [
        ...(others.length ? [{ id: 'belonging_card', pattern: `${fact} The learner's answer is ${orList(others)}, a card that belongs with the others.`,
          examples: others.slice(0, 2) }] : []),
        { id: 'said_all_belong', pattern: `${fact} The learner says they all belong together and names no card.`, examples: ['they all go together'] },
      ];
    }
    case 'count_group':
      return item.answerValue ? offByMisses(item.answerValue, `the ${item.answerValue} things in the ${item.stimulus} group`) : [];
    case 'compare': {
      const labels = item.choices.filter(c => c !== 'the same');
      const other = labels.filter(l => l.toLowerCase() !== item.answer.toLowerCase());
      const fact = item.answer === 'the same' ? `The ${andList(labels)} groups have the same number.` : `The ${item.answer} group has more.`;
      return [
        ...(other.length ? [{ id: 'other_group', pattern: `${fact} The learner's answer is ${orList(other)}, ${item.answer === 'the same' ? 'one group' : 'the group with fewer'}.`,
          examples: other.slice(0, 2) }] : []),
        ...(item.answer !== 'the same' ? [{ id: 'said_same', pattern: `${fact} The learner's answer is that the groups are the same.`, examples: ['the same'] }] : []),
        { id: 'bare_more', pattern: `${fact} The learner says only "more" and names no group.`, examples: ['more'] },
      ];
    }
    case 'both_criteria': {
      const c = item.criteria;
      if (!c) return [];
      const fact = item.answer === 'yes' ? `${item.stimulus} is a ${c.primary} and is ${c.secondary}, so the answer is yes.`
        : `${item.stimulus} is not both a ${c.primary} and ${c.secondary}, so the answer is no.`;
      const wrong = item.answer === 'yes' ? 'no' : 'yes';
      return [
        { id: 'opposite_verdict', pattern: `${fact} The learner says "${wrong}" instead of ${item.answer}.`, examples: [wrong] },
        { id: 'one_criterion_only', pattern: `${fact} The learner says only that it is a ${c.primary} (or only whether it is ${c.secondary}), `
          + 'with no yes or no about both.', examples: [`it is a ${c.primary}`] },
      ];
    }
    default: return [];
  }
}

export function workspaceAssignment(item: SortingStationItem): TeachingAssignment {
  const misses = sortingStationSpokenMisses(item);
  return { id: item.id, task: askFor(item), response: 'speech', expectedAnswer: item.answer, ...(misses.length ? { misses } : {}) };
}

export function workspaceScene(item: SortingStationItem): WorkspaceScene {
  return {
    objects: [],
    facts: {
      kind: item.kind,
      // The card or group the ask is about; on odd_one, a description of the whole set.
      about: item.stimulus,
      ...(item.choices.length ? { options: item.choices.join(', ') } : {}),
      // On pick_rule the sorting rule is the answer.
      ...(item.ruleName && item.kind !== 'pick_rule' ? { sortingBy: item.ruleName } : {}),
      constraints: item.hidesCounts
        ? 'The learner says the answer. The group counts are hidden until the answer is credited.'
        : 'The learner says the answer. Nothing on screen is tapped or moved.',
    },
  };
}
