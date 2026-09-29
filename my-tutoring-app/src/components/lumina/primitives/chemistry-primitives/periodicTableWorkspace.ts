/**
 * Periodic table on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch C8). A payload with challenges runs only here (the
 * scripted runner was retired, LA-14, user ruling 09-23: one path); a payload without them is the
 * ungraded exploration table.
 *
 * Pure: the component and the journey read the same assignment and scene. `find` is a tap on a
 * box, checked in code (`cellMatches`), so its key never reaches the tutor; `name` (an element
 * name read off the table), `compare` (one of two named elements) and `valence` (a count of
 * outer electrons) are spoken, with the pack's signature misses in their keys.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../components/live-activity/runtime/useTeachingWorkspace';
import { numberMisses, offByMisses, type KnownMiss, type OffByMiss } from '../../components/live-activity/runtime/spokenMissContract';
import {
  askFor,
  itemsFromChallenges,
  numberWord,
  periodicTableHarnessAnswers,
  spellSymbol,
  type PeriodicChallengeLike,
  type PeriodicTableItem,
  type PeriodicTier,
} from './periodicTableScript';
import { ELEMENTS } from './constants';

/** The items a payload asks, built by the pack's gates: shared by the component, the adapter and the journey. */
export const periodicItems = (data: { challenges?: PeriodicChallengeLike[]; supportTier?: PeriodicTier }): PeriodicTableItem[] =>
  itemsFromChallenges(data.challenges ?? [], data.supportTier ?? 'medium');

/** The pack's own ask, without its "Your turn." hand-over. */
const ask = (item: PeriodicTableItem) => askFor(item).replace(/\s*Your turn\.\s*/, ' ').replace(/\s+/g, ' ').trim();

function key(item: PeriodicTableItem): string | undefined {
  switch (item.kind) {
    case 'find':
      return undefined; // checked by the activity
    case 'name': {
      const e = item.element!;
      return `"${e.name}". A close or fumbled try at the name counts, alone or in a short phrase. Any other element's name `
        + 'is wrong' + (item.clueBy === 'symbol'
        ? `, and so is reading the letters ${spellSymbol(e.symbol)} back: the letters are the question.`
        : ', including the box beside it.');
    }
    case 'compare': {
      const [a, b] = item.pair!;
      const other = item.answerName === a.name ? b.name : a.name;
      return `"${item.answerName}", the ${item.axis === 'reactivity' ? 'more reactive' : 'bigger atom'} of the two. The name `
        + `alone counts. "${other}" is wrong, and so is an answer that does not pick one of the two.`;
    }
    case 'valence': {
      const e = item.element!;
      const n = item.answerCount!;
      return `${numberWord(n)} ("${n}", "${numberWord(n)} electrons", or counting aloud that lands on ${numberWord(n)}). `
        + ((e.group ?? 0) >= 13 ? `"${e.group}" is the group number, not the outer electrons, and is wrong. ` : '')
        + 'Any other number is wrong.';
    }
  }
}

export function periodicAssignment(item: PeriodicTableItem): TeachingAssignment {
  const expectedAnswer = key(item);
  const misses = expectedAnswer ? periodicSpokenMisses(item) : [];
  return expectedAnswer
    ? { id: item.id, task: ask(item), response: 'speech', expectedAnswer, ...(misses.length ? { misses } : {}) }
    : { id: item.id, task: ask(item), response: 'gesture' };
}

/** What a wrong spoken answer shows on Trends (handoff 20 Part B). */
export type SpokenPeriodicMiss = 'other_of_pair' | 'group_number' | OffByMiss;

/**
 * A Trends item's known wrong answers, in precedence order, for the `spoken_miss` observer: the other element of
 * the pair (compare); the group number, then off-by counts of the outer electrons (valence). Name It names none yet.
 */
export function periodicSpokenMisses(item: PeriodicTableItem): KnownMiss[] {
  if (item.kind === 'compare' && item.pair) {
    const other = item.answerName === item.pair[0].name ? item.pair[1].name : item.pair[0].name;
    const trait = item.axis === 'reactivity' ? 'more reactive' : 'the bigger atom';
    return [{ id: 'other_of_pair', pattern: `Of ${item.pair[0].name} and ${item.pair[1].name}, ${item.answerName} is ${trait}. The learner's answer is ${other}, the other one.`,
      examples: [other] }];
  }
  if (item.kind === 'valence' && item.element && item.answerCount) {
    const n = item.answerCount, e = item.element;
    return [...numberMisses(n, [{ id: 'group_number', value: (e.group ?? 0) >= 13 ? e.group ?? undefined : undefined,
      pattern: g => `${e.name} is in group ${g} and has ${n} outer electrons. The learner's answer is ${g}, the group number.` }]),
      ...offByMisses(n, `the ${n} outer electrons of ${e.name}`)];
  }
  return [];
}

export function periodicScene(item: PeriodicTableItem, tapped: string | null): WorkspaceScene {
  const facts: Record<string, string> = {
    table: 'The full periodic table: every box shows its atomic number, symbol and name. There is no search or filter.',
  };
  if (item.kind === 'find') {
    facts.constraints = 'The learner answers by tapping one box; the activity checks the tap. '
      + (item.findBy === 'position' ? 'Never say which element is at that spot.' : 'Never say where the box is.');
    if (tapped) facts.tapped = `The learner tapped ${tapped}'s box.`;
  } else {
    facts.constraints = 'The learner answers out loud; no box is marked until the answer is credited.';
  }
  return { objects: [], facts };
}

/** Whether a tapped box is the asked element. */
export const cellMatches = (item: PeriodicTableItem, atomicNumber: number): boolean =>
  item.kind === 'find' && item.element?.number === atomicNumber;

/**
 * What a checked wrong tap shows on an Element Hunt (handoff 20), by where the tapped box sits against the asked
 * one on the drawn table: `same_first_letter` (a spelled-symbol ask: the tapped symbol starts with the same
 * letter), `next_box` (the box touching it), `same_row` (the same row, further along: on a group-and-period ask,
 * the right period), `same_column` (the same column, another row: the right group), `other_box`.
 * Name It and Trends are spoken; Trends names its misses in `periodicSpokenMisses` (Part B).
 */
export type PeriodicMiss = 'same_first_letter' | 'next_box' | 'same_row' | 'same_column' | 'other_box';

const cellOf = new Map(ELEMENTS.map(e => [e.number, e]));

export function periodicMiss(item: PeriodicTableItem, tappedNumber: number): PeriodicMiss | undefined {
  const want = item.element && cellOf.get(item.element.number), got = cellOf.get(tappedNumber);
  if (item.kind !== 'find' || !want || !got || want.number === got.number) return undefined;
  if (item.findBy === 'symbol' && want.symbol[0] === got.symbol[0]) return 'same_first_letter';
  const dx = got.xpos - want.xpos, dy = got.ypos - want.ypos;
  if (Math.abs(dx) + Math.abs(dy) === 1) return 'next_box';
  return dy === 0 ? 'same_row' : dx === 0 ? 'same_column' : 'other_box';
}

/** The journey's answers: the pack's right and plainly wrong answers; a find is the box to tap, by element name. */
export function periodicJourneyAnswers(item: PeriodicTableItem): { correct: string; plainWrong: string; tap?: { correct: string; wrong: string } } {
  const answers = periodicTableHarnessAnswers(item);
  return { correct: answers.correct, plainWrong: answers.plainWrong, tap: 'tapped' in answers ? answers.tapped : undefined };
}
