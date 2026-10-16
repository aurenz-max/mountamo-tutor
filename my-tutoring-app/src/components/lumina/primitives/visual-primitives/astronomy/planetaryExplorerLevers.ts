/**
 * The in-item levers on a planetary-explorer question (`/add-support-tiers`, report
 * qa/eval-reports/planetary-explorer-levers-2026-10-15.md). No real-learner evidence: the misses are what
 * `planetMiss` names. Pure: the component draws from these, the workspace publishes them, the tests hold each leak rule.
 *
 * - `planet_card` (help, shown): this stop's fact cards back beside the question (the learner read them before it
 *   opened). Withheld when any choice is printed on a card (`cardLeak`), and on a true-false statement, whose truth is
 *   read off the cards: there the card IS the answer.
 * - `visited_cards` (help, shown): every planet visited so far, its fact cards side by side in journey order, none
 *   marked. Same leak rule over every card; on a menu of planet names, offered only when every named planet has a card.
 * - `family_model` (help, shown): two model worlds beside the question, not planets of this trip: a small grey rocky
 *   one and a big striped gas giant. On a menu of planet names that spans both kinds. Names no planet.
 * - `drop_far_choice` (simplify, shown): greys out one wrong choice that is easy to rule out, on the item itself (user
 *   ruling 09-27: removing a choice is assisted work). Planet names: the one farthest from the answer in order from
 *   the Sun; numbers: the farthest number; words: the choice sharing the fewest words with the answer. Guard: at least
 *   two untried choices remain, so a 4-choice question has it after one wrong answer and a 2- or 3-choice one not.
 *
 * No lever on a true-false statement (already the smallest judgement, and its truth is on the cards): unanswered in
 * the catalog.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { PlanetStop } from './PlanetaryExplorer';
import {
  PLANET_ORDER, asNumber, capitalize, isNumberMenu, isPlanetMenu, keyText, planetNamed, type PlanetItem, type PlanetMiss,
} from './planetaryExplorerWorkspace';

export const CARD_LEVER = 'planet_card';
export const VISITED_LEVER = 'visited_cards';
export const FAMILY_LEVER = 'family_model';
export const DROP_LEVER = 'drop_far_choice';

/** Per session item: the levers pulled, the choices greyed out, the choices tried wrong, and the wrong attempts. */
export interface PlanetLeverState { pulled: readonly string[]; dropped: readonly number[]; picked: readonly number[]; wrongs: number }
export const NO_LEVERS: PlanetLeverState = { pulled: [], dropped: [], picked: [], wrongs: 0 };

const norm = (s: string) => s.toLowerCase().replace(/(\d),(\d)/g, '$1$2').replace(/[^a-z0-9.\s-]/g, ' ').replace(/\s+/g, ' ').trim();
const STOP = new Set(['the', 'and', 'with', 'for', 'from', 'that', 'this', 'its', 'are', 'was', 'has', 'have', 'into', 'than',
  'because', 'very', 'more', 'less', 'much', 'about', 'there', 'their', 'they', 'not', 'can', 'all', 'any', 'it', 'is', 'of']);
const contentWords = (s: string) => norm(s).split(' ').filter(w => w.length >= 3 && !STOP.has(w));

/** What a stop's fact cards say: values, units and Earth comparisons. The labels name what is asked about
 *  ("Moons"), never the answer, so they are left out. */
export const cardText = (stop: PlanetStop) =>
  stop.keyStats.map(s => `${s.value} ${s.unit ?? ''} ${s.comparisonToEarth ?? ''}`).join(' | ');

/**
 * Why cards may not be shown beside this question, or null when they may: a true-false statement; a choice printed on
 * a card (whole words or a whole number); a choice of three or more content words, half of them on the cards. Every
 * choice is tested alike, so a withheld lever says nothing about which choice is right.
 */
export function cardLeak(item: PlanetItem, stops: readonly PlanetStop[]): string | null {
  if (item.question.questionType === 'true-false') return 'a true-false statement is checked against the cards';
  const text = ` ${norm(stops.map(cardText).join(' | '))} `, words = new Set(contentWords(text));
  for (const o of item.question.options) {
    if (planetNamed(o)) continue; // a planet's name labels its card and its choice alike
    const said = norm(o);
    if (said && text.includes(` ${said} `)) return `the choice "${o}" is printed on a card`;
    const own = contentWords(o);
    if (own.length >= 3 && own.filter(w => words.has(w)).length * 2 >= own.length) return `the choice "${o}" is mostly words on a card`;
  }
  return null;
}

/** The stops `visited_cards` shows: this one and every one before it, in journey order. */
export const visitedStops = (item: PlanetItem, planets: readonly PlanetStop[]) =>
  item.kind === 'planet' ? planets.slice(0, item.planetIndex + 1) : [];

function visitedLeak(item: PlanetItem, planets: readonly PlanetStop[]): string | null {
  const stops = visitedStops(item, planets);
  if (stops.length < 2) return 'no planet visited before this one';
  if (isPlanetMenu(item.question)) {
    const have = new Set(stops.map(s => s.planetId.toLowerCase()));
    if (item.question.options.some(o => !have.has(planetNamed(o)!))) return 'a planet among the choices has no card yet';
  }
  return cardLeak(item, stops);
}

const familyOf = (id: string) => ((PLANET_ORDER as readonly string[]).indexOf(id) < 4 ? 'rocky' : 'giant');
const spansFamilies = (item: PlanetItem) => item.kind === 'quiz' && isPlanetMenu(item.question)
  && new Set(item.question.options.map(o => familyOf(planetNamed(o)!))).size === 2;
const wordsOf = (s: string) => new Set(contentWords(s));

/**
 * The wrong choice `drop_far_choice` greys out now, or null when too few untried choices would be left. Planet names:
 * the one farthest from the answer in order from the Sun; numbers: the farthest number; words: the choice sharing the
 * fewest words with the answer (on a tie, the last one).
 */
export function farChoice(item: PlanetItem, s: PlanetLeverState): number | null {
  const q = item.question;
  const live = q.options.map((_, i) => i).filter(i => !s.dropped.includes(i));
  const tried = Math.max(s.wrongs, new Set(s.picked).size);
  if (live.length - 1 - tried < 2) return null;
  const foils = live.filter(i => i !== q.correctIndex && !s.picked.includes(i));
  const key = wordsOf(keyText(q));
  const distance = isPlanetMenu(q)
    ? (i: number) => Math.abs((PLANET_ORDER as readonly string[]).indexOf(planetNamed(q.options[i])!)
      - (PLANET_ORDER as readonly string[]).indexOf(planetNamed(keyText(q))!))
    : isNumberMenu(q) ? (i: number) => Math.abs(asNumber(q.options[i]) - asNumber(keyText(q)))
      : (i: number) => -Array.from(wordsOf(q.options[i])).filter(w => key.has(w)).length;
  if (!foils.length) return null;
  return [...foils].sort((a, b) => distance(b) - distance(a) || b - a)[0];
}

const QUIZ_MISSES: PlanetMiss[] = ['neighbour_planet', 'same_family_planet', 'other_family_planet', 'other_number', 'other_choice'];
const STOP_MISSES: PlanetMiss[] = ['other_planet', 'other_planet_fact', 'other_number', 'other_choice'];

/** The levers this item declares, with their state. A lever that cannot be pulled now and was not pulled is left out. */
export function planetLevers(item: PlanetItem | null | undefined, s: PlanetLeverState, planets: readonly PlanetStop[]): WorkspaceLever[] {
  if (!item) return [];
  const on = (id: string) => s.pulled.includes(id);
  const levers: WorkspaceLever[] = [];
  const stop = item.kind === 'planet' ? planets[item.planetIndex] : undefined;
  if (stop && (on(CARD_LEVER) || !cardLeak(item, [stop]))) levers.push({ id: CARD_LEVER, kind: 'help', carrier: 'shown', pulled: on(CARD_LEVER),
    answers: STOP_MISSES,
    when: 'The learner picks a wrong choice or is stuck, and does not remember what this planet\'s card said.',
    does: `Shows ${capitalize(stop.planetId)}'s fact cards again beside the question. Read a card aloud if asked; never say which card or which number decides the question.` });
  if (on(VISITED_LEVER) || (stop && !visitedLeak(item, planets))) levers.push({ id: VISITED_LEVER, kind: 'help', carrier: 'shown', pulled: on(VISITED_LEVER),
    answers: STOP_MISSES,
    when: 'The learner mixes up planets already visited, or has to compare them.',
    does: 'Lays the fact cards of every planet visited so far side by side, in the order they were visited, none marked. Never say which planet\'s card wins the comparison.' });
  if (on(FAMILY_LEVER) || spansFamilies(item)) levers.push({ id: FAMILY_LEVER, kind: 'help', carrier: 'shown', pulled: on(FAMILY_LEVER),
    answers: ['other_family_planet'] satisfies PlanetMiss[],
    when: 'The learner names a planet of the wrong kind: a giant for a small rocky world, or the other way round.',
    does: 'Shows two model worlds beside the question, not planets of this trip: a small grey rocky one and a big striped gas giant. It names no planet; never say which kind the answer is.' });
  if (on(DROP_LEVER) || farChoice(item, s) !== null) levers.push({ id: DROP_LEVER, kind: 'simplify', carrier: 'shown', pulled: on(DROP_LEVER),
    answers: item.kind === 'quiz' ? QUIZ_MISSES : STOP_MISSES,
    when: 'The learner still picks a wrong choice after help, or is stuck with too many choices.',
    does: 'Greys out one wrong choice that is easy to rule out, so fewer choices remain. The next answer counts as helped.' });
  return levers;
}

/** The levers a support tier starts pulled (`config.difficulty` easy): drawn and declared, never recorded as help. */
export function startLevers(item: PlanetItem | null | undefined, tier: string | undefined, planets: readonly PlanetStop[]): string[] {
  if (!item || tier !== 'easy') return [];
  return planetLevers(item, NO_LEVERS, planets).filter(l => l.kind === 'help' && l.id !== VISITED_LEVER).map(l => l.id);
}

/** What the pulled levers put on screen, for the tutor and JEV. Names the greyed-out choice, never the key. */
export function leverFacts(item: PlanetItem, shown: readonly string[], dropped: readonly number[], planets: readonly PlanetStop[]): string | null {
  const parts: string[] = [];
  const stop = item.kind === 'planet' ? planets[item.planetIndex] : undefined;
  if (stop && shown.includes(CARD_LEVER)) parts.push(`${capitalize(stop.planetId)}'s fact cards are back beside the question: `
    + stop.keyStats.map(s => `${s.label} ${s.value}${s.unit ? ` ${s.unit}` : ''}`).join('; '));
  if (shown.includes(VISITED_LEVER)) parts.push(`the fact cards of ${visitedStops(item, planets).map(p => capitalize(p.planetId)).join(', ')} `
    + 'are laid side by side below the question, none marked');
  if (shown.includes(FAMILY_LEVER)) parts.push('beside the question, two model worlds that are not planets of this trip: a small grey rocky one and a big striped gas giant');
  for (const i of dropped) if (item.question.options[i] !== undefined) parts.push(`choice ${i + 1}, "${item.question.options[i]}", is greyed out and is not the answer`);
  return parts.length ? parts.join('; ') : null;
}
