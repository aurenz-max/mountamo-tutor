/**
 * Ordinal line on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/live-runtime-handoffs/15-workspace-rollout.md).
 *
 * Pure: the component and any probe read the same assignment and scene. The items
 * still come from `itemsFromChallenges` in `ordinalLineScript.ts`. Four modes are
 * spoken against `answerText`; `build_sequence` is arranged by hand and checked by
 * code (`placementMatches`), so the tutor is not handed the answer line as a key.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import { numberWordFor } from './countingBoardScript';
import { askFor, backOf, frontOf, ordinalWordFor, placementComplete, placementMatches, type OrdinalLineItem } from './ordinalLineScript';

/** What a wrong spoken place or name shows (handoff 20 Part B). */
export type SpokenOrdinalMiss = 'cardinal_for_ordinal' | 'wrong_end' | 'next_to_place' | 'said_anchor' | 'wrong_side';

/**
 * A spoken item's known wrong answers, in precedence order, for the `spoken_miss` observer: the counting number for
 * the place word, the line counted from the other end, the one right beside the asked place; on relative_position the
 * anchor itself and the one on its other side.
 */
export function ordinalSpokenMisses(item: OrdinalLineItem): KnownMiss[] {
  if (item.answerKind === 'gesture') return [];
  const k = item.askPosition, names = item.lineNames, n = names.length, front = frontOf(item.context), back = backOf(item.context);
  const ord = ordinalWordFor(k), mirror = n + 1 - k;
  const inLine = (ps: number[]) => ps.filter(p => p >= 1 && p <= n && p !== k);
  const nameAt = (p: number) => names[p - 1];
  const wantsName = item.kind === 'relative_position' || item.kind === 'identify' && item.direction === 'name_character';
  // The line as the observer cannot see it: every place, counted from the front.
  const line = `Counting from ${front}, the line is: ${names.map((name, i) => `${ordinalWordFor(i + 1)} the ${name}`).join(', ')}.`;
  if (item.kind === 'relative_position') {
    const target = item.relativeQuery === 'before' ? k - 1 : k + 1, other = item.relativeQuery === 'before' ? k + 1 : k - 1;
    const asked = `The question asks who is right ${item.relativeQuery} the ${ordinalWordFor(k)} one, the ${nameAt(k)}: that is the ${nameAt(target)}.`;
    return [
      { id: 'said_anchor', pattern: `${line} The question names the ${ordinalWordFor(k)} one, the ${nameAt(k)}, and asks who is right `
        + `${item.relativeQuery} it. The learner's answer is the ${nameAt(k)} itself, the one the question names.`, examples: [nameAt(k)] },
      ...(inLine([other]).length ? [{ id: 'wrong_side', pattern: `${line} ${asked} The learner names the ${nameAt(other)}, who is right `
        + `${item.relativeQuery === 'before' ? 'after' : 'before'} the ${nameAt(k)} instead.`, examples: [nameAt(other)] }] : []),
    ];
  }
  const lineKinds = item.kind === 'identify';
  // The story's places are its clues; a printed card has no line, only the place words one away.
  const beside = (item.kind === 'sequence_story' ? [k - 1, k + 1].filter(p => p >= 1 && p <= item.clues.length)
    : item.kind === 'match' ? [k - 1, k + 1].filter(p => p >= 1 && p <= 10) : inLine([k - 1, k + 1])).filter(p => !(lineKinds && p === mirror));
  const say = (p: number) => wantsName ? `the ${nameAt(p)}` : ordinalWordFor(p);
  const fact = item.kind === 'match' ? `The card shows ${item.symbol}, which is read ${ord}.`
    : item.kind === 'sequence_story' ? `In the story the ${item.storyName} is ${ord}.`
    : wantsName ? `${line} The question asks who is ${ord}: the ${nameAt(k)}.` : `${line} The ${nameAt(k)} is ${ord}.`;
  return [
    ...(wantsName ? [] : [{ id: 'cardinal_for_ordinal', pattern: `${fact} The learner's answer is ${numberWordFor(k)}, the counting number, `
      + 'instead of the place word.', examples: [numberWordFor(k)] }]),
    ...(lineKinds && mirror !== k && mirror >= 1 ? [{ id: 'wrong_end', pattern: `${fact} The learner's answer is ${say(mirror)}, `
      + `${wantsName ? `who is ${ord}` : `the ${nameAt(k)}'s place`} counting from ${back}, the other end.`,
      examples: [wantsName ? nameAt(mirror) : ordinalWordFor(mirror)] }] : []),
    ...(beside.length ? [{ id: 'next_to_place', pattern: `${fact} The learner's answer is ${beside.map(say).join(' or ')}, `
      + `${wantsName ? `who ${beside.length > 1 ? 'are' : 'is'} ${beside.map(p => ordinalWordFor(p)).join(' and ')}` : 'a place word'}, one place away.`,
      examples: beside.map(p => wantsName ? nameAt(p) : ordinalWordFor(p)) }] : []),
  ];
}

export function workspaceAssignment(item: OrdinalLineItem): TeachingAssignment {
  if (item.answerKind === 'gesture') return { id: item.id, task: askFor(item), response: 'gesture' };
  const misses = ordinalSpokenMisses(item);
  return { id: item.id, task: askFor(item), response: 'speech', expectedAnswer: item.answerText, ...(misses.length ? { misses } : {}) };
}

/** Does the committed line put every picture in its clued place? Empty places are ''. */
export const lineMatches = placementMatches;

/**
 * What a wrong line shows (`TeachingAttempt.miss`, handoff 20): `place_left_empty` (not every place filled),
 * `reversed` (the whole line from the other end), `two_swapped` (only two pictures out of place), `other_order`.
 * Undefined for a right line and for the spoken kinds.
 */
export type LineMiss = 'place_left_empty' | 'reversed' | 'two_swapped' | 'other_order';

export function lineMiss(item: OrdinalLineItem | null, placed: readonly string[]): LineMiss | undefined {
  if (!item || item.kind !== 'build_sequence' || placementMatches(item, placed)) return undefined;
  if (!placementComplete(item, placed)) return 'place_left_empty';
  const want = item.answerOrder;
  if (want.every((name, i) => placed[i] === want[want.length - 1 - i])) return 'reversed';
  return want.filter((name, i) => placed[i] !== name).length === 2 ? 'two_swapped' : 'other_order';
}

/** The committed line in the learner's terms, place 1 first, as the tutor and the observer read it. */
export const describeLine = (item: OrdinalLineItem, placed: readonly string[]) => {
  const filled = placed.filter(Boolean).length;
  if (!filled) return 'Placed none of the pictures';
  const places = Array.from({ length: item.answerOrder.length }, (_, i) => placed[i] || 'empty');
  return `Placed ${filled} of ${item.answerOrder.length}, from the first place: ${places.join(', ')}`;
};

export function workspaceScene(item: OrdinalLineItem, view: { placedOrder: readonly string[]; markedPlace?: number }): WorkspaceScene {
  const front = frontOf(item.context);
  const line = `${item.lineNames.join(', ')} (from ${front})`;
  const facts = ((): Record<string, string | number> => {
    switch (item.kind) {
      case 'match':
        return { printedCard: item.symbol,
          constraints: 'The learner reads the printed card aloud. Only the symbol is printed, never the word.' };
      case 'sequence_story':
        return { pictured: `${item.clues.map(c => c.name).join(', ')} (shuffled, not in story order)`,
          constraints: 'The story is never printed: the learner hears it only from you, then says the place.' };
      case 'build_sequence':
        return { places: item.answerOrder.length, line: describeLine(item, view.placedOrder),
          constraints: 'The clues are never printed: the learner hears them only from you. The learner touches a picture, '
            + 'then its place. The line checks the arrangement once the learner stops, whether or not every place is filled.' };
      default:
        return { pictured: line, ...(view.markedPlace ? { markedPlace: view.markedPlace } : {}),
          constraints: 'The learner says the answer. Nothing on the line can be tapped, and its place labels stay hidden '
            + 'until the answer is credited.' };
    }
  })();
  return { objects: [], facts: { kind: item.kind, front, ...facts } };
}
