/**
 * Constellation builder on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md; report qa/tutor-reports/constellation-builder-w1-2026-10-15.md).
 *
 * Pure: the component, the journey and the tests read the same options, assignment, scene, checks and misses.
 * - guided_trace / free_connect: star taps checked by the activity against `starOrder` / `correctConnections`. The
 *   tutor is never handed which star is next or which stars are joined.
 * - identify / seasonal: one constellation name, tapped (identify) or tapped and checked (seasonal), or said aloud:
 *   a speech item with `acceptsGesture`, judged from the tutor's feedback against `expectedAnswer`.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import { stableShuffle } from '../../../utils/choiceOrder';
import type { ConnectionLine, ConstellationChallenge } from './ConstellationBuilder';

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const sameName = (a: string, b: string) => norm(a) === norm(b);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Whether `text` names `name` as a whole phrase. */
export const namesIt = (text: string, name: string) =>
  !!norm(name) && new RegExp(`(^| )${escape(norm(name))}( |$)`).test(norm(text));

/**
 * The instruction on screen. On identify and seasonal the name IS the answer, and the generator's instructions
 * describe it in other words: all four saved identify items (2026-10-15) named the shape or the figure ("What
 * legendary hunter", "a powerful beast ruling over the spring sky"), and three of five seasonal ones gave a feature
 * ("its bright belt", "five-star pattern", "flying down the Milky Way") past the shape-word filter. So those two
 * modes ask the plain question, built here, on both paths. A trace instruction names the constellation to draw,
 * which is the task, not its answer.
 */
export function shownInstruction(c: ConstellationChallenge): string {
  if (c.type === 'identify') return 'Look at the lines. Which constellation is this?';
  if (c.type === 'seasonal') return /year/i.test(c.season) ? 'Which constellation can be seen on any evening of the year?'
    : `Which constellation is best seen on ${c.season} evenings?`;
  return c.instruction;
}

/** A session-level text (title, description) shown while an identify or seasonal item is open: the name masked. */
export function maskAnswer(text: string, c: ConstellationChallenge | null | undefined): string {
  if (!c || (c.type !== 'identify' && c.type !== 'seasonal') || !namesIt(text, c.constellationName)) return text;
  return text.replace(new RegExp(escape(c.constellationName), 'gi'), 'a constellation');
}

const distractors = (c: ConstellationChallenge) =>
  [c.distractorName0, c.distractorName1, c.distractorName2].filter((n): n is string => !!n && !sameName(n, c.constellationName));

/** Real names a seasonal item pads a collapsed pool with (the generator requires distractors only for identify). */
const SEASONAL_NAME_POOL = ['Orion', 'Ursa Major', 'Cassiopeia', 'Leo', 'Scorpius', 'Lyra'];
const seasonOf = (s: string) => { const n = norm(s); return n.includes('autumn') ? 'fall' : n; };

/** The identify choices, in a stable shuffled order: the name and its distractors. */
export function identifyOptions(c: ConstellationChallenge): string[] {
  if (c.choices?.length) return stableShuffle(c.choices, c.id);
  return stableShuffle(dedupe([c.constellationName, ...distractors(c)]), c.id);
}

function dedupe(names: string[]): string[] {
  const out: string[] = [];
  for (const n of names) if (!out.some(o => sameName(o, n))) out.push(n);
  return out;
}

/**
 * The seasonal choices: this item's name, the other seasonal items' names and its distractors. Another seasonal
 * item's name seen in the SAME season is left out: both would be right, and only one is credited.
 */
export function seasonalOptions(c: ConstellationChallenge, challenges: readonly ConstellationChallenge[]): string[] {
  if (c.choices?.length) return stableShuffle(c.choices, c.id);
  const others = challenges.filter(o => o.type === 'seasonal' && o.id !== c.id && seasonOf(o.season) !== seasonOf(c.season))
    .map(o => o.constellationName);
  const options = dedupe([c.constellationName, ...others, ...distractors(c)]);
  // A collapsed pool (<2 options) is not a choice: pad from the static pool up to 3.
  if (options.length < 2) for (const name of SEASONAL_NAME_POOL) {
    if (options.length >= 3) break;
    if (!options.some(o => sameName(o, name))) options.push(name);
  }
  return stableShuffle(options, c.id);
}

/** Every star the pattern joins, from the lines the checker reads. */
export function patternStars(c: Pick<ConstellationChallenge, 'correctConnections'>): Set<string> {
  const ids = new Set<string>();
  for (const l of c.correctConnections) { ids.add(l.fromStarId); ids.add(l.toStarId); }
  return ids;
}
const joins = (l: ConnectionLine, a: string, b: string) => (l.fromStarId === a && l.toStarId === b) || (l.fromStarId === b && l.toStarId === a);
export const isPatternLine = (c: ConstellationChallenge, a: string, b: string) => c.correctConnections.some(l => joins(l, a, b));
export const traceComplete = (c: ConstellationChallenge, drawn: readonly ConnectionLine[]) =>
  c.correctConnections.length > 0 && c.correctConnections.every(t => drawn.some(d => joins(d, t.fromStarId, t.toStarId)));

/** A spoken name answers identify and seasonal; the trace modes are star taps. */
export const namesAnswer = (c: ConstellationChallenge) => c.type === 'identify' || c.type === 'seasonal';

/**
 * What a wrong check shows (`TeachingAttempt.miss`, handoff 20):
 * - guided_trace: `later_star` (a star further along the order than the ringed one), `traced_star` (one already
 *   joined), `other_star` (a star not in the order);
 * - free_connect: `background_star` (a star that is not in the pattern), `wrong_pair` (two pattern stars the
 *   pattern does not join);
 * - identify: `wrong_name` (another name on screen);
 * - seasonal: `other_name` (one name, not the answer), `several_names` (more than one name chosen).
 */
export type ConstellationMiss = 'later_star' | 'traced_star' | 'other_star' | 'background_star' | 'wrong_pair'
  | 'wrong_name' | 'other_name' | 'several_names';

export function guidedMiss(c: ConstellationChallenge, step: number, starId: string): ConstellationMiss {
  const at = c.starOrder.indexOf(starId);
  return at > step ? 'later_star' : at >= 0 ? 'traced_star' : 'other_star';
}
export const freeMiss = (c: ConstellationChallenge, starId: string): ConstellationMiss =>
  patternStars(c).has(starId) ? 'wrong_pair' : 'background_star';
export const nameMiss = (c: ConstellationChallenge, chosen: readonly string[]): ConstellationMiss | undefined =>
  nameCorrect(c, chosen) ? undefined : c.type === 'seasonal' ? (chosen.length > 1 ? 'several_names' : 'other_name') : 'wrong_name';
export const nameCorrect = (c: ConstellationChallenge, chosen: readonly string[]) =>
  chosen.length === 1 && sameName(chosen[0], c.constellationName);

/** The learner's work in their own terms, never the key. */
export function describeTrace(c: ConstellationChallenge, drawn: number, miss?: ConstellationMiss): string {
  const total = c.correctConnections.length;
  const sofar = `${drawn} of ${total} lines drawn`;
  if (!miss) return drawn >= total ? `Drew all ${total} lines of the pattern` : sofar;
  if (miss === 'background_star') return `${sofar}, then tapped a dim star that is not in the pattern`;
  if (miss === 'wrong_pair') return `${sofar}, then tried to join two stars the pattern does not join`;
  return `${sofar}, then tapped a star that is not the next one`;
}
export const describeNames = (chosen: readonly string[]) =>
  chosen.length ? `Chose ${chosen.map(n => `"${n}"`).join(', ')}` : 'Nothing chosen yet';

/** A spoken name's known wrong answers: each other name on screen. Each pattern names the answer. */
export function constellationSpokenMisses(c: ConstellationChallenge, challenges: readonly ConstellationChallenge[]): KnownMiss[] {
  if (!namesAnswer(c)) return [];
  const others = (c.type === 'identify' ? identifyOptions(c) : seasonalOptions(c, challenges)).filter(o => !sameName(o, c.constellationName));
  if (!others.length) return [];
  return [{ id: c.type === 'identify' ? 'wrong_name' : 'other_name',
    pattern: `The answer is "${c.constellationName}". The learner names another constellation on screen: ${others.map(o => `"${o}"`).join(', ')}.`,
    examples: others.slice(0, 6) }];
}

export function workspaceAssignment(c: ConstellationChallenge, challenges: readonly ConstellationChallenge[] = []): TeachingAssignment {
  const task = shownInstruction(c);
  if (!namesAnswer(c)) return { id: c.id, task, response: 'gesture' };
  return { id: c.id, task: `${task} The learner answers by saying the name, or ${c.type === 'identify' ? 'tapping it' : 'tapping it and pressing Check Answer'}.`,
    response: 'speech', acceptsGesture: true, expectedAnswer: c.constellationName, misses: constellationSpokenMisses(c, challenges) };
}

export interface ConstellationView {
  /** Lines the learner has drawn (trace modes). */
  drawn: number;
  /** guided_trace: whether the pulsing ring is numbered (grade 2 up). */
  numbered: boolean;
  /** free_connect: a star is selected, waiting for its partner. */
  selected: boolean;
  /** Pattern stars drawn brighter than the rest (the easy tier, or the bright_stars lever). */
  membersBright: boolean;
  /** free_connect: dim stars can be tapped too (the medium and hard tiers). */
  dimTappable: boolean;
  chosen: readonly string[];
  solved: boolean;
}

/**
 * What is drawn and asked. Never which star is next, where a pattern star is, or which stars are joined; on
 * identify and seasonal the name is not stated here (the spoken key reaches the observer as `expectedAnswer`).
 */
export function workspaceScene(c: ConstellationChallenge, view: ConstellationView, challenges: readonly ConstellationChallenge[]): WorkspaceScene {
  const drawn: Record<string, string> = {};
  const total = c.correctConnections.length;
  if (c.type === 'guided_trace') {
    drawn.scene = `A star field. The learner draws ${c.constellationName} by tapping its stars in order; the next star to tap `
      + `has a pulsing ring around it${view.numbered ? ' with its number' : ''}, and only the pattern's stars can be tapped`;
    drawn.progress = view.solved ? `all ${total} lines are drawn` : `${view.drawn} of ${total} lines drawn`;
    drawn.howToAnswer = 'tap the ringed star, then the next ringed star, until the picture is finished';
  } else if (c.type === 'free_connect') {
    drawn.scene = `A star field. The learner draws ${c.constellationName} by joining its stars two at a time, with no numbers. `
      + (view.membersBright ? 'The pattern\'s stars are drawn brighter than the others. ' : 'Every star is drawn by its own brightness; the pattern\'s stars are not marked. ')
      + (view.dimTappable ? 'Dim background stars can be tapped too.' : 'Only the pattern\'s stars can be tapped.');
    drawn.progress = view.solved ? `all ${total} lines are drawn` : `${view.drawn} of ${total} lines drawn${view.selected ? '; one star is selected, waiting for the star to join it to' : ''}`;
    drawn.howToAnswer = 'tap one star, then the star it joins to, for each line';
  } else if (c.type === 'identify') {
    drawn.scene = view.solved ? 'The constellation is named and its star story is shown.'
      : 'The lines of one constellation are drawn on a star field. No name is shown: the name is the answer';
    drawn.choices = identifyOptions(c).join(' | ');
    drawn.howToAnswer = 'say the name, or tap one name';
  } else {
    drawn.scene = view.solved ? 'The answer is shown with its star story.'
      : `No star field: only the season (${c.season}) and a list of constellation names. Which one is best seen then is the answer`;
    drawn.choices = seasonalOptions(c, challenges).join(' | ');
    drawn.howToAnswer = 'say the name, or tap one name and press Check Answer';
  }
  return {
    objects: [],
    facts: {
      kind: c.type, ...drawn,
      learnerWork: namesAnswer(c) ? describeNames(view.chosen) : describeTrace(c, view.drawn),
      ...(view.solved && c.mythologyFact ? { starStory: c.mythologyFact } : {}),
      constraints: namesAnswer(c)
        ? 'The learner answers by saying a name or tapping one; the activity checks a tap. You cannot tap or check for the learner.'
        : 'The learner answers by tapping stars; the activity checks every tap. You cannot tap a star or draw a line for the learner.',
    },
  };
}

/** The journey's answers for a trace item: the taps that draw it, and a first tap that is wrong. */
export function traceHarnessTaps(c: ConstellationChallenge): { correct: string[]; plainWrong: string[] } {
  if (c.type === 'guided_trace') {
    if (c.starOrder.length < 2) throw new Error(`constellation-builder guided_trace ${c.id}: fewer than two stars`);
    return { correct: [...c.starOrder], plainWrong: [c.starOrder[1]] };
  }
  const members = Array.from(patternStars(c));
  const pair = members.flatMap((a, i) => members.slice(i + 1).map(b => [a, b] as const)).find(([a, b]) => !isPatternLine(c, a, b));
  if (!pair) throw new Error(`constellation-builder free_connect ${c.id}: every two pattern stars are joined, no wrong pair`);
  return { correct: c.correctConnections.flatMap(l => [l.fromStarId, l.toStarId]), plainWrong: [pair[0], pair[1]] };
}

/** The journey's answers for a name item: the key, and the first other name on screen. */
export function nameHarnessAnswers(c: ConstellationChallenge, challenges: readonly ConstellationChallenge[]): { correct: string; plainWrong: string } {
  const options = c.type === 'identify' ? identifyOptions(c) : seasonalOptions(c, challenges);
  const wrong = options.find(o => !sameName(o, c.constellationName));
  if (!wrong) throw new Error(`constellation-builder ${c.type} ${c.id}: no wrong name on screen`);
  return { correct: options.find(o => sameName(o, c.constellationName)) ?? c.constellationName, plainWrong: wrong };
}
