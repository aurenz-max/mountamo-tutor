/**
 * The in-item levers on a planetary-explorer question, as one lever set (`bossLevers.ts`; `/add-support-tiers`, report
 * qa/eval-reports/planetary-explorer-levers-2026-10-15.md). No real-learner evidence: the misses are what `planetMiss`
 * names. Pure: the component draws from these, the tests hold each leak rule.
 *
 * - `planet_card` (custom, shown): this stop's fact cards back beside the question (the learner read them before it
 *   opened). Withheld when any choice is printed on a card (`cardLeak`), and on a true-false statement, whose truth is
 *   read off the cards: there the card IS the answer.
 * - `visited_cards` (layout): every planet visited so far, its fact cards side by side in journey order, none marked.
 *   Same leak rule over every card; on a menu of planet names, offered only when every named planet has a card.
 * - `family_model` (clue, shown): two model worlds beside the question, not planets of this trip: a small grey rocky
 *   one and a big striped gas giant. On a quiz menu of planet names that spans both kinds. Names no planet.
 * - `drop_far_choice` (custom, shown): greys out one wrong choice that is easy to rule out, on the item itself (user
 *   ruling 09-27: removing a choice is assisted work). Planet names: the one farthest from the answer in order from
 *   the Sun; numbers: the farthest number; words: the choice sharing the fewest words with the answer. Guard: at least
 *   two untried choices remain, so a 4-choice question has it after one wrong answer and a 2- or 3-choice one not.
 *
 * No lever on a true-false statement (already the smallest judgement, and its truth is on the cards): unanswered on
 * the card. Every lever starts released, except that the easy tier starts the help levers pulled (`startLevers`).
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { keyAnswers } from '../../../components/live-activity/spokenKey';
import type { PlanetStop } from './PlanetaryExplorer';
import {
  PLANET_ORDER, asNumber, capitalize, isNumberMenu, isPlanetMenu, keyText, planetKey, planetNamed, type PlanetItem, type PlanetMiss,
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

/** What the levers read beside the item: the trip's planets, and this item's lever state. */
export interface PlanetLeverContext { planets: readonly PlanetStop[]; state: PlanetLeverState }

const on = (ctx: PlanetLeverContext, id: string) => ctx.state.pulled.includes(id);
const stopOf = (item: PlanetItem, ctx: PlanetLeverContext) => (item.kind === 'planet' ? ctx.planets[item.planetIndex] : undefined);
const statLine = (stop: PlanetStop) => stop.keyStats.map(s => `${s.label} ${s.value}${s.unit ? ` ${s.unit}` : ''}`).join('; ');

export const PLANET_LEVERS = leverSet<PlanetItem, PlanetLeverContext>({
  missesOf: () => [],
  // The model worlds' words never name the key or a way of saying it.
  answersOf: item => keyAnswers(planetKey(item)),
  specs: [
    { id: CARD_LEVER, type: 'custom', carrier: 'shown', answers: STOP_MISSES,
      why: 'It brings back this stop\'s own fact cards, which the learner read before the question opened; no stock type re-shows earlier content.',
      when: 'The learner picks a wrong choice or is stuck, and does not remember what this planet\'s card said.',
      does: (item, ctx) => `Shows ${capitalize(stopOf(item, ctx)?.planetId ?? '')}'s fact cards again beside the question. Read a card `
        + 'aloud if asked; never say which card or which number decides the question.',
      content: (item, ctx) => { const stop = stopOf(item, ctx); return stop && (on(ctx, CARD_LEVER) || !cardLeak(item, [stop])) ? stop : null; },
      fact: (stop: PlanetStop) => `${capitalize(stop.planetId)}'s fact cards are back beside the question: ${statLine(stop)}.` },
    { id: VISITED_LEVER, type: 'layout', answers: STOP_MISSES,
      when: 'The learner mixes up planets already visited, or has to compare them.',
      does: 'Lays the fact cards of every planet visited so far side by side, in the order they were visited, none marked. '
        + 'Never say which planet\'s card wins the comparison.',
      content: (item, ctx) => (on(ctx, VISITED_LEVER) || (stopOf(item, ctx) && !visitedLeak(item, ctx.planets)) ? visitedStops(item, ctx.planets) : null),
      fact: (stops: readonly PlanetStop[]) => `The fact cards of ${stops.map(p => capitalize(p.planetId)).join(', ')} are laid side by side `
        + 'below the question, none marked.' },
    { id: FAMILY_LEVER, type: 'clue', carrier: 'shown', answers: ['other_family_planet'],
      when: 'The learner names a planet of the wrong kind: a giant for a small rocky world, or the other way round.',
      does: 'Shows two model worlds beside the question, not planets of this trip: a small grey rocky one and a big striped gas '
        + 'giant. It names no planet; never say which kind the answer is.',
      content: (item, ctx) => on(ctx, FAMILY_LEVER) || spansFamilies(item),
      fact: 'Beside the question, two model worlds that are not planets of this trip: a small grey rocky one and a big striped gas giant.' },
    { id: DROP_LEVER, type: 'custom', carrier: 'shown', answers: Array.from(new Set([...QUIZ_MISSES, ...STOP_MISSES])),
      answersOn: item => (item.kind === 'quiz' ? QUIZ_MISSES : STOP_MISSES),
      why: 'It narrows this item in place (one wrong choice greyed out) rather than opening a practice item.',
      when: 'The learner still picks a wrong choice after help, or is stuck with too many choices.',
      does: 'Greys out one wrong choice that is easy to rule out, so fewer choices remain. The next answer counts as helped.',
      // Offered while one more can be greyed out; once pulled, its fact names every greyed-out choice.
      content: (item, ctx) => (on(ctx, DROP_LEVER) || farChoice(item, ctx.state) !== null ? ctx.state.dropped : null),
      fact: (dropped: readonly number[], item) => dropped.filter(i => item.question.options[i] !== undefined)
        .map(i => `choice ${i + 1}, "${item.question.options[i]}", is greyed out and is not the answer.`).join(' ') },
  ],
});

/** The levers the easy tier (`config.difficulty`) starts pulled: the cards and the model worlds where they may be
 *  shown, drawn and declared, never recorded as help. Not the side-by-side cards, and never a greyed-out choice. */
export function startLevers(item: PlanetItem | null | undefined, tier: string | undefined, planets: readonly PlanetStop[]): string[] {
  if (!item || tier !== 'easy') return [];
  return PLANET_LEVERS.declare(item, { planets, state: NO_LEVERS }, [])
    .filter(l => l.id === CARD_LEVER || l.id === FAMILY_LEVER).map(l => l.id);
}
