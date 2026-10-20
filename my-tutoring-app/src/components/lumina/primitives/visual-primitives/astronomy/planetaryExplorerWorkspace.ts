/**
 * Planetary explorer's items, keys, misses and scene: the pure half of its boss (`planetaryExplorer.boss.ts`, a
 * SAY_OR_SHOW card on the spoken preset).
 *
 * Every item is one generated question with a code-held key (`correctIndex`): the per-planet questions in journey order,
 * then the identify mode's quiz. A choice is tapped and checked by the activity, or said aloud (VB-1, user ruling 10-13:
 * a sayable choice takes speech as well as the tap); the tutor judges speech against `planetKey`.
 */
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import { containsPhrase, type SpokenKey } from '../../../components/live-activity/spokenKey';
import type { PlanetQuestion, PlanetStat, PlanetStop } from './PlanetaryExplorer';

/** One question the session asks: a stop's question, or a quiz question after the last stop (identify). */
export interface PlanetItem {
  id: string;
  kind: 'planet' | 'quiz';
  /** The stop the question belongs to; -1 on a quiz question. */
  planetIndex: number;
  planetId?: string;
  question: PlanetQuestion;
  /** The trip's planets, which a choice is compared with (another planet's card names a miss). */
  trip: readonly PlanetStop[];
}

export function planetItems(planets: readonly PlanetStop[], quiz: readonly PlanetQuestion[] = []): PlanetItem[] {
  return [
    ...planets.flatMap((p, pi) => p.questions.map((question, qi): PlanetItem =>
      ({ id: `${p.planetId}-q${qi}`, kind: 'planet', planetIndex: pi, planetId: p.planetId, question, trip: planets }))),
    ...quiz.map((question, i): PlanetItem => ({ id: `quiz-q${i}`, kind: 'quiz', planetIndex: -1, question, trip: planets })),
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

/** The catalog's eval modes. */
export type PlanetMode = 'explore' | 'identify' | 'compare' | 'apply';
/**
 * A mode of the card an item belongs to. The items carry no session mode, and every mode is wired alike (SAY_OR_SHOW,
 * the same moves), so this names the mode whose schema the item's kind is unique to, else explore.
 */
export const planetMode = (item: PlanetItem): PlanetMode =>
  (item.kind === 'quiz' ? 'identify' : item.question.questionType === 'compare' ? 'compare' : 'explore');

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

const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];
const LETTERS = 'ABCDEFGH';

/**
 * The key a spoken reply is judged against. A true-false statement is a menu key (the ask says both words); a choice is
 * the choice's words, its letter or its place in the list.
 */
export function planetKey(item: PlanetItem): SpokenKey {
  const q = item.question, key = stripEnd(keyText(q));
  if (isTrueFalse(q)) {
    const truth = /^t/i.test(key);
    return { answer: truth ? 'true' : 'false', menu: ['true', 'false'],
      alsoAccept: truth ? ['yes', 'yeah', 'right', 'it is'] : ['no', 'nope', 'wrong', 'it is not'],
      signatureError: `"${truth ? 'false' : 'true'}" is wrong. The statement said back gives no verdict and is not it.` };
  }
  const others = q.options.filter((_, i) => i !== q.correctIndex);
  return {
    answer: key,
    alsoAccept: [`choice ${LETTERS[q.correctIndex] ?? q.correctIndex + 1}`, `the ${ORDINAL[q.correctIndex] ?? 'last'} one`],
    ...(key.split(/\s+/).length > 1 ? { acceptRule: 'The part of the choice that tells it apart from the others counts too.' } : {}),
    signatureError: `${quoted(others)} ${others.length > 1 ? 'are' : 'is'} wrong, and so is naming two choices or hedging between them.`,
  };
}

/**
 * What the ask says by design: a compare question names the planets it compares ("Mars or Jupiter?"), the key among
 * them. Only when the ask names two or more of the choices, the key one of them; an ask naming the key alone is a leak.
 */
export function planetGiven(item: PlanetItem): string[] {
  const ask = askOf(item), named = item.question.options.filter(o => containsPhrase(ask, stripEnd(o)));
  return named.length >= 2 && named.includes(keyText(item.question)) ? named.map(stripEnd) : [];
}

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
  // Long sentence choices (apply's why questions) do not fit a pattern (`validSpokenMissRequest`: 400 characters); the
  // pattern then says what kind of choice it is, and the examples carry the choices themselves.
  const short: Record<PlanetMiss, string> = {
    true_false_flipped: '', neighbour_planet: 'names the planet next to it in order from the Sun',
    same_family_planet: 'names a planet of the same kind', other_family_planet: 'names a planet of the other kind',
    other_planet: 'names a different planet', other_planet_fact: 'is a fact about another planet on the journey',
    other_number: 'is another number', other_choice: 'is another of the choices, as in the examples',
  };
  return order.filter(m => groups.has(m)).map(m => {
    const full = `${fact} The learner's answer ${what[m](groups.get(m)!)}.`;
    return { id: m, pattern: full.length <= 400 ? full : `${fact.length <= 300 ? fact : 'The right choice is another one.'} The learner's answer ${short[m]}.`,
      examples: groups.get(m)!.slice(0, 6) };
  });
}

export interface PlanetView {
  /** The stop's card is on screen before its first question (the learner reads it, then opens the question). */
  readingCard: boolean;
  choice: number | null;
  /** The choice the activity credited is shown. */
  solved: boolean;
  /** Planets visited before this stop, in journey order. */
  visited: readonly string[];
  /** The lesson's grade rung ('K', '1', ... or 'Grade 4'). */
  grade?: string;
}

const PRE_READER = /^(k|1|kindergarten|grade 1)$/i;

/**
 * What is drawn and asked. The choices are named, never which is right. A quiz question describes a planet without
 * naming it, and while it is open the map's planets wear no names.
 */
export function workspaceScene(item: PlanetItem, view: PlanetView, planets: readonly PlanetStop[]): SceneOf {
  const q = item.question, stop = item.kind === 'planet' ? planets[item.planetIndex] : undefined;
  const choices = q.options.map((o, i) => `${i + 1}) ${o}`).join('  ');
  const facts: Record<string, string> = {};
  if (stop) {
    const name = capitalize(stop.planetId);
    facts.stop = `${name}, stop ${item.planetIndex + 1} of ${planets.length} on a trip through the solar system`
      + (view.visited.length ? `; visited before: ${view.visited.map(capitalize).join(', ')}` : '') + `. Focus: ${stop.focusTheme}.`;
    facts.shown = view.readingCard
      ? `${name}'s card is on screen: a short description, fact cards (${stop.keyStats.map(s => s.label).join(', ')}) and a fun fact. `
        + 'The question is not open yet.'
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
  // How the learner answers is the card's `moves`; the rules below are this question's own facts.
  const rules: string[] = [];
  if (!view.readingCard) {
    rules.push('A planet\'s nickname or best-known description ("the Red Planet", "the one with rings") answers a question '
      + 'about it: never say one while the question is open, not even as a clue.');
    if (/\bwhy\b/i.test(q.question)) rules.push('Why is the question: never name the reason or the facts the right choice uses.');
    if (item.kind === 'quiz') rules.push('The question means a planet it does not name: never name or describe that planet.');
  }
  if (view.grade && PRE_READER.test(view.grade.trim())) rules.push('Say no units or decimals: tell sizes, temperatures and distances in plain words.');
  if (rules.length) facts.constraints = rules.join(' ');
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
