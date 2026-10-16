/**
 * Planetary explorer on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md, C23).
 *
 * Pure: the component, the journey and the tests read the same items, assignment, scene, miss and answers. Every item
 * is one generated question with a code-held key (`correctIndex`): the per-planet questions in journey order, then the
 * identify mode's quiz. A choice is tapped and checked by the activity, or said aloud (VB-1, user ruling 10-13: a
 * sayable choice takes speech as well as the tap); JEV judges speech against `expectedAnswer`.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { PlanetQuestion, PlanetStat, PlanetStop } from './PlanetaryExplorer';

/** One question the session asks: a stop's question, or a quiz question after the last stop (identify). */
export interface PlanetItem {
  id: string;
  kind: 'planet' | 'quiz';
  /** The stop the question belongs to; -1 on a quiz question. */
  planetIndex: number;
  planetId?: string;
  question: PlanetQuestion;
}

export function planetItems(planets: readonly PlanetStop[], quiz: readonly PlanetQuestion[] = []): PlanetItem[] {
  return [
    ...planets.flatMap((p, pi) => p.questions.map((question, qi): PlanetItem =>
      ({ id: `${p.planetId}-q${qi}`, kind: 'planet', planetIndex: pi, planetId: p.planetId, question }))),
    ...quiz.map((question, i): PlanetItem => ({ id: `quiz-q${i}`, kind: 'quiz', planetIndex: -1, question })),
  ];
}

/** The eight planets in order from the Sun; the first four are small rocky worlds, the last four giants. */
export const PLANET_ORDER = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'] as const;
export const capitalize = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);

/** The planet a choice names, when the choice is just a planet's name ("Mars", "the planet Mars"). */
export function planetNamed(text: string): string | null {
  const t = text.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\b(the|planet)\b/g, ' ').trim();
  return (PLANET_ORDER as readonly string[]).includes(t) ? t : null;
}
const orderOf = (id: string) => (PLANET_ORDER as readonly string[]).indexOf(id);
const familyOf = (id: string) => (orderOf(id) < 4 ? 'rocky' : 'giant');
/** A choice that is a number, alone or with a unit ("24 hours", "95 moons"): its value and its unit. */
export function measureOf(text: string): { n: number; unit: string } | null {
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*([a-z°%][a-z°%\s]*)?\s*$/i.exec(text.replace(/(\d),(\d)/g, '$1$2'));
  return m ? { n: Number(m[1]), unit: (m[2] ?? '').trim().toLowerCase().replace(/s$/, '') } : null;
}
export const asNumber = (text: string) => measureOf(text)?.n ?? NaN;

const isTrueFalse = (q: PlanetQuestion) => q.questionType === 'true-false';
export const keyText = (q: PlanetQuestion) => q.options[q.correctIndex] ?? '';
export const isPlanetMenu = (q: PlanetQuestion) => q.options.length > 1 && q.options.every(o => !!planetNamed(o));
/** Every choice a number in the same unit (or none): "0, 1, 2, 4" or "12 hours, 24 hours, 48 hours". */
export const isNumberMenu = (q: PlanetQuestion) => {
  const ms = q.options.map(measureOf);
  return q.options.length > 1 && ms.every(m => !!m) && new Set(ms.map(m => m!.unit)).size === 1;
};

/** The ask the tutor is given: the question as printed, a true-false statement as one. */
export const askOf = (item: PlanetItem) => isTrueFalse(item.question)
  ? `True or false: ${item.question.question.trim()}` : item.question.question.trim();

const norm = (s: string) => s.toLowerCase().replace(/(\d),(\d)/g, '$1$2').replace(/[^a-z0-9.\s-]/g, ' ').replace(/\s+/g, ' ').trim();
const statTexts = (s: PlanetStat) => [s.value, `${s.value} ${s.unit ?? ''}`].map(norm).filter(Boolean);

/**
 * What a wrong choice shows (`TeachingAttempt.miss`, handoff 20). The generated options record no reason for being
 * wrong, so a pattern is named only where the choice's text shows one:
 * - `true_false_flipped`: a true-false statement judged the other way;
 * - on a quiz question whose answer and choice are planets: `neighbour_planet` (the planet next to the answer in order
 *   from the Sun), `same_family_planet` (another planet of the answer's kind, small rocky or giant), `other_family_planet`;
 * - `other_planet`: at a stop, another planet named where the answer names a planet (the other one of a compared pair);
 * - `other_planet_fact`: a stop's question answered with a value printed on another journey planet's card, and on no
 *   card of this planet (the documented mix-up between planets already visited);
 * - `other_number`: another number on a menu of numbers; `other_choice`: any other choice.
 */
export type PlanetMiss = 'true_false_flipped' | 'neighbour_planet' | 'same_family_planet' | 'other_family_planet'
  | 'other_planet' | 'other_planet_fact' | 'other_number' | 'other_choice';

function choiceMiss(item: PlanetItem, choice: string, planets: readonly PlanetStop[]): PlanetMiss {
  const q = item.question;
  if (isTrueFalse(q)) return 'true_false_flipped';
  const want = planetNamed(keyText(q)), got = planetNamed(choice);
  if (want && got && item.kind === 'quiz') {
    if (Math.abs(orderOf(want) - orderOf(got)) === 1) return 'neighbour_planet';
    return familyOf(want) === familyOf(got) ? 'same_family_planet' : 'other_family_planet';
  }
  if (want && got) return 'other_planet';
  if (item.kind === 'planet') {
    const said = norm(choice), own = planets[item.planetIndex];
    const onCard = (p: PlanetStop | undefined) => !!p?.keyStats.some(s => statTexts(s).includes(said));
    if (said && !onCard(own) && planets.some((p, i) => i !== item.planetIndex && onCard(p))) return 'other_planet_fact';
  }
  if (isNumberMenu(q)) return 'other_number';
  return 'other_choice';
}

export function planetMiss(item: PlanetItem | null | undefined, choiceIndex: number | null, planets: readonly PlanetStop[]): PlanetMiss | undefined {
  if (!item || choiceIndex === null || choiceIndex === item.question.correctIndex) return undefined;
  const choice = item.question.options[choiceIndex];
  return choice === undefined ? undefined : choiceMiss(item, choice, planets);
}

export const planetCorrect = (item: PlanetItem | null | undefined, choiceIndex: number | null) =>
  !!item && choiceIndex !== null && choiceIndex === item.question.correctIndex;

/** The learner's work in their own terms, never the key. */
export const describePlanetWork = (item: PlanetItem | null | undefined, choiceIndex: number | null) =>
  item && choiceIndex !== null && item.question.options[choiceIndex] !== undefined
    ? `Chose "${item.question.options[choiceIndex]}"` : 'Nothing chosen yet';

const stripEnd = (t: string) => t.trim().replace(/[.!?]+$/, '');
const quoted = (xs: readonly string[]) => xs.map(x => `"${stripEnd(x)}"`).join(', ');

/** The answer a spoken reply is judged against, with the ways a learner says it. */
export function planetExpectedAnswer(item: PlanetItem): string {
  const q = item.question, key = keyText(q);
  if (isTrueFalse(q)) {
    const truth = /^t/i.test(key.trim());
    return `${truth ? 'true' : 'false'}: the statement is ${truth ? 'true' : 'false'}. `
      + `${truth ? '"yes", "yeah", "right", "it is"' : '"no", "nope", "wrong", "it is not"'} count too, alone or in a short `
      + 'sentence. The statement said back gives no verdict and is not it.';
  }
  const others = q.options.filter((_, i) => i !== q.correctIndex);
  return `"${stripEnd(key)}" (choice ${q.correctIndex + 1} of ${q.options.length}). The whole choice, the part that tells it `
    + `apart from the others, or its place in the list ("the ${ORDINAL[q.correctIndex] ?? 'last'} one") all count. `
    + `${quoted(others)} ${others.length > 1 ? 'are' : 'is'} wrong, and so is naming two choices or hedging between them.`;
}
const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];

/**
 * A spoken item's known wrong answers, most specific first, with the tap's ids (the catalog's lists): each wrong
 * choice grouped under the miss its text shows.
 */
export function planetSpokenMisses(item: PlanetItem, planets: readonly PlanetStop[]): KnownMiss[] {
  const q = item.question, key = stripEnd(keyText(q));
  if (isTrueFalse(q)) {
    const truth = /^t/i.test(key);
    return [{ id: 'true_false_flipped', pattern: `The statement is ${truth ? 'true' : 'false'}. The learner's answer says it is ${truth ? 'false' : 'true'}.`,
      examples: truth ? ['false', 'no'] : ['true', 'yes'] }];
  }
  const groups = new Map<PlanetMiss, string[]>();
  q.options.forEach((o, i) => {
    if (i === q.correctIndex) return;
    const m = choiceMiss(item, o, planets);
    groups.set(m, [...(groups.get(m) ?? []), stripEnd(o)]);
  });
  const fact = `The right choice is "${key}".`;
  const what: Record<PlanetMiss, (xs: string[]) => string> = {
    true_false_flipped: () => '',
    neighbour_planet: xs => `names ${quoted(xs)}, the planet next to ${key} in order from the Sun`,
    same_family_planet: xs => `names ${quoted(xs)}, a planet of the same kind as ${key}`,
    other_family_planet: xs => `names ${quoted(xs)}, a planet of the other kind`,
    other_planet: xs => `names ${quoted(xs)}, a different planet`,
    other_planet_fact: xs => `is ${quoted(xs)}, a fact about another planet on the journey`,
    other_number: xs => `is the number ${quoted(xs)}`,
    other_choice: xs => `is ${quoted(xs)}`,
  };
  const order: PlanetMiss[] = ['neighbour_planet', 'same_family_planet', 'other_family_planet', 'other_planet', 'other_planet_fact', 'other_number', 'other_choice'];
  return order.filter(m => groups.has(m)).map(m => ({ id: m, pattern: `${fact} The learner's answer ${what[m](groups.get(m)!)}.`,
    examples: groups.get(m)!.slice(0, 6) }));
}

export function workspaceAssignment(item: PlanetItem, planets: readonly PlanetStop[] = []): TeachingAssignment {
  const misses = planetSpokenMisses(item, planets);
  return { id: item.id, task: `${askOf(item)} The learner answers by saying it, or tapping one choice and pressing Check Answer.`,
    response: 'speech', acceptsGesture: true, expectedAnswer: planetExpectedAnswer(item), ...(misses.length ? { misses } : {}) };
}

export interface PlanetView {
  /** The stop's card is on screen before its first question (the learner reads it, then opens the question). */
  readingCard: boolean;
  choice: number | null;
  /** The choice the activity credited is shown. */
  solved: boolean;
  /** Planets visited before this stop, in journey order. */
  visited: readonly string[];
  grade?: string;
}

/**
 * What is drawn and asked. The choices are named, never which is right. A quiz question describes a planet without
 * naming it, and while it is open the map's planets wear no names.
 */
export function workspaceScene(item: PlanetItem, view: PlanetView, planets: readonly PlanetStop[]): WorkspaceScene {
  const q = item.question, stop = item.kind === 'planet' ? planets[item.planetIndex] : undefined;
  const choices = q.options.map((o, i) => `${i + 1}) ${o}`).join('  ');
  const facts: Record<string, string> = {};
  if (stop) {
    const name = capitalize(stop.planetId);
    facts.stop = `${name}, stop ${item.planetIndex + 1} of ${planets.length} on a trip through the solar system`
      + (view.visited.length ? `; visited before: ${view.visited.map(capitalize).join(', ')}` : '') + `. Focus: ${stop.focusTheme}.`;
    facts.shown = view.readingCard
      ? `${name}'s card is on screen: a short description, fact cards (${stop.keyStats.map(s => s.label).join(', ')}) and a fun fact. `
        + 'The question opens when the learner presses Ready for Questions.'
      : `The question about ${name}, with its choices. ${name}'s card is not on screen now`
        + ' (the learner read it before the question opened).';
  } else {
    facts.shown = 'The identification quiz after the trip: the question describes a planet without naming it; '
      + 'the map shows the planets in order from the Sun with no names while the quiz is open.';
  }
  if (!view.readingCard) {
    facts.question = isTrueFalse(q) ? `True or false: ${q.question.trim()}` : q.question.trim();
    facts.choices = choices;
    facts.learnerWork = describePlanetWork(item, view.choice);
  }
  facts.constraints = 'The learner answers by saying it, or by tapping one choice and checking it; the activity judges the tap. '
    + 'You cannot tap, check or point at a choice for the learner.';
  return { objects: [], facts };
}

/** The journey's answers: the key, and the wrong choice that shows the most telling miss. */
export function planetHarnessAnswers(item: PlanetItem, planets: readonly PlanetStop[]): { correct: string; plainWrong: string } {
  const q = item.question;
  const rank: PlanetMiss[] = ['true_false_flipped', 'other_planet_fact', 'neighbour_planet', 'same_family_planet', 'other_family_planet', 'other_planet', 'other_number', 'other_choice'];
  const wrong = q.options.map((o, i) => ({ o, i })).filter(x => x.i !== q.correctIndex)
    .sort((a, b) => rank.indexOf(choiceMiss(item, a.o, planets)) - rank.indexOf(choiceMiss(item, b.o, planets)));
  return { correct: keyText(q), plainWrong: wrong[0]?.o ?? '' };
}
