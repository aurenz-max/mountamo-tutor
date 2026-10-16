/**
 * The in-item levers on propulsion-lab (`/add-support-tiers`; report qa/eval-reports/propulsion-lab-levers-2026-10-16.md).
 * No real-learner evidence: the misses are what `propulsionMiss` observes; the failures behind them are documented (the
 * old catalog's commonStruggles: a propeller thought to work in space, exhaust not linked to motion, action and
 * reaction confused) or inferred (two equal pushes not seen to cancel, an engine turned around, a test that changes two
 * things). Every lever starts released; `config.difficulty` changes the items, not the levers.
 *
 * - `how_it_works` (help; predict): a card saying how each engine on the craft works. It names no motion and no place.
 * - `air_marks` (help; predict): labels the scene "air all around" or "no air here".
 * - `blast_arrows` (help; predict, engines only): an arrow at each engine's blast end, the way it is aimed to blast.
 *   Never an arrow on the craft or the way it goes.
 * - `label_streams` (help; observe): labels each engine's stream with the way it leaves, or "nothing comes out".
 * - `stream_units` (help; observe, two streams): writes each stream's length in units. No comparison.
 * - `compare_tests` (help; experiment): a row per setting saying whether Test A and Test B are the same or different,
 *   with what each test uses. It never says which setting should differ.
 * - `can_push` (help; experiment, throttle questions): under each test, whether its engine has anything to push there.
 * - `one_step` (simplify; predict, two engines or one turned around): one engine, or the engine the right way round.
 * - `one_stream` (simplify; observe, two streams): the same craft with only one stream.
 * - `one_test` (simplify; experiment with both tests free): the same question with Test A set and locked.
 * A simpler item is ungraded and its key differs from the full item's; the full item comes back after it.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import {
  emptyWork, ENGINES, fairSetups, keyOf, MOTIONS, PROPULSION_MISSES, propulsionMiss, works,
  type ChoiceItem, type ExperimentItem, type ObserveItem, type PredictItem, type PropulsionItem, type PropulsionMiss,
  type PropulsionWork, type Setup,
} from './propulsionWorkspace';

export const HOW_IT_WORKS_LEVER = 'how_it_works';
export const AIR_MARKS_LEVER = 'air_marks';
export const BLAST_ARROWS_LEVER = 'blast_arrows';
export const LABEL_STREAMS_LEVER = 'label_streams';
export const STREAM_UNITS_LEVER = 'stream_units';
export const COMPARE_TESTS_LEVER = 'compare_tests';
export const CAN_PUSH_LEVER = 'can_push';
export const ONE_STEP_LEVER = 'one_step';
export const ONE_STREAM_LEVER = 'one_stream';
export const ONE_TEST_LEVER = 'one_test';

/** how_it_works: how each engine on the craft works. */
export const howLines = (item: ChoiceItem): string[] => Array.from(new Set(item.thrusters.map(t => ENGINES[t.engine].how)));
/** air_marks: what the place label says. */
export const airLine = (item: ChoiceItem): string => (item.place === 'air' ? 'Air all around' : 'No air here');
/** label_streams: one line per engine, the way its stream leaves or that nothing comes out. */
export const streamLines = (item: ObserveItem): string[] => item.thrusters.map(t => (works(t.engine, item.place)
  ? `The ${ENGINES[t.engine].label} at the ${t.blast === 'left' ? 'back' : 'front'}: its stream leaves to the ${t.blast}.`
  : `The ${ENGINES[t.engine].label} at the ${t.blast === 'left' ? 'back' : 'front'}: nothing comes out.`));
/** stream_units: each stream's length. */
export const unitLines = (item: ObserveItem): string[] => item.thrusters.filter(t => works(t.engine, item.place))
  .map(t => `${t.blast === 'left' ? 'Left' : 'Right'} stream: ${t.size} units`);

const FIELD_NAME: Record<keyof Setup, string> = { engine: 'Engine', place: 'Place', throttle: 'Throttle' };
const value = (s: Setup, f: keyof Setup) => (f === 'engine' ? ENGINES[s.engine].label : s[f]);
/** compare_tests: per setting, same or different, with each test's value. */
export function compareLines(a: Setup, b: Setup): string[] {
  return (['engine', 'place', 'throttle'] as (keyof Setup)[]).map(f => (a[f] === b[f]
    ? `${FIELD_NAME[f]}: the same in both (${value(a, f)})` : `${FIELD_NAME[f]}: different (A ${value(a, f)}, B ${value(b, f)})`));
}
/** can_push: whether the engine has anything to push where its test is. */
export const canPushLine = (s: Setup): string => (works(s.engine, s.place)
  ? `The ${ENGINES[s.engine].label} has something to push here.` : `The ${ENGINES[s.engine].label} has nothing to push here.`);

/** The leak rule for every lever line on a choice item: no word for where the craft goes. */
export function motionLeak(line: string): boolean {
  return /\b(moves?|moving|goes|go|stays? still|stays? put|does not move|doesn't move|left|right|forward|backward)\b/i.test(line)
    && !/\b(stream leaves to the (left|right)|(Left|Right) stream)\b/.test(line);
}

// ── Simplify: practice items ─────────────────────────────────────────────────────────────

const PRACTICE = '~simpler';
export const isPractice = (item: Pick<PropulsionItem, 'id'>) => item.id.endsWith(PRACTICE);
export const practiceParent = (id: string) => (id.endsWith(PRACTICE) ? id.slice(0, -PRACTICE.length) : null);

/** The simpler item, or null when the item is already one step. A choice item's simpler key differs from its own. */
export function simplerItem(item: PropulsionItem): PropulsionItem | null {
  if (isPractice(item)) return null;
  const id = `${item.id}${PRACTICE}`;
  if (item.mode === 'experiment') {
    if (item.lockA) return null;
    const a = fairSetups(item.question).a;
    return { ...item, id, lockA: true, start: { a, b: { ...a } } };
  }
  const key = keyOf(item);
  if (item.mode === 'predict') {
    if (item.named) return null;
    const ts = item.thrusters;
    if (ts.length === 2) {
      for (const t of ts) {
        const s: PredictItem = { ...item, id, thrusters: [{ ...t, blast: 'left' }] };
        if (keyOf(s) !== key) return s;
      }
      return null;
    }
    if (ts[0].engine === 'sail' || ts[0].blast === 'left') return null;
    const s: PredictItem = { ...item, id, thrusters: [{ ...ts[0], blast: 'left' }] };
    return keyOf(s) !== key ? s : null;
  }
  const live = item.thrusters.filter(t => works(t.engine, item.place));
  if (live.length < 2) return null;
  const smaller = [...live].sort((x, y) => x.size - y.size)[0];
  const s: ObserveItem = { ...item, id, thrusters: [smaller] };
  return keyOf(s) !== key ? s : null;
}

// ── Levers on the current item ───────────────────────────────────────────────────────────

const lever = (id: string, kind: WorkspaceLever['kind'], pulled: readonly string[], answers: readonly PropulsionMiss[], when: string, does: string): WorkspaceLever =>
  ({ id, kind, carrier: 'shown', pulled: pulled.includes(id), answers, when, does });
const PRACTICE_NOTE = 'It is not graded; this item comes back after it.';

/** The levers on the current session item. A practice item has none. */
export function propulsionLevers(item: PropulsionItem | undefined, pulled: readonly string[]): WorkspaceLever[] {
  if (!item || isPractice(item)) return [];
  const out: WorkspaceLever[] = [];
  const simpler = simplerItem(item);
  if (item.mode === 'predict') {
    const sail = item.thrusters[0].engine === 'sail';
    out.push(lever(HOW_IT_WORKS_LEVER, 'help', pulled, ['said_moves', 'said_still', 'wrong_way'],
      'The learner does not know what the engine needs or what it pushes.',
      `Shows a card saying how ${item.thrusters.length > 1 ? 'each engine' : sail ? 'a sail' : 'the engine'} works (for example "a propeller spins its blades to push air"). It names no motion.`));
    out.push(lever(AIR_MARKS_LEVER, 'help', pulled, ['said_moves', 'said_still'],
      'The learner has not noticed whether there is air around the craft.',
      'Labels the scene with whether there is air around the craft, and rings the specks of air if there are any.'));
    if (!sail) {
      out.push(lever(BLAST_ARROWS_LEVER, 'help', pulled, PROPULSION_MISSES.predict,
        'The learner mixes up which way an engine blasts, or does not compare two engines.',
        'Draws an arrow at each engine showing which way it is aimed to blast. Nothing is switched on and the craft does not move.'));
    }
    if (simpler) {
      out.push(lever(ONE_STEP_LEVER, 'simplify', pulled, PROPULSION_MISSES.predict, 'The learner cannot follow two engines, or an engine turned around.',
        `${item.thrusters.length > 1 ? 'Opens the same craft with one of its engines only' : 'Opens the same craft with its engine at the back, aimed to blast out to the left'}. ${PRACTICE_NOTE}`));
    }
    return out;
  }
  if (item.mode === 'observe') {
    out.push(lever(LABEL_STREAMS_LEVER, 'help', pulled, PROPULSION_MISSES.observe,
      'The learner does not see which way each stream leaves, or that an engine sends nothing out.',
      'Labels each engine with the way its stream leaves, or that nothing comes out of it.'));
    if (item.thrusters.filter(t => works(t.engine, item.place)).length > 1) {
      out.push(lever(STREAM_UNITS_LEVER, 'help', pulled, ['missed_cancel', 'wrong_way', 'said_still'],
        'The learner cannot judge which stream is longer.',
        "Writes each stream's length in units beside it. It writes no comparison."));
    }
    if (simpler) {
      out.push(lever(ONE_STREAM_LEVER, 'simplify', pulled, PROPULSION_MISSES.observe, 'The learner cannot weigh two streams at once.',
        `Opens the same craft with only one of its streams. ${PRACTICE_NOTE}`));
    }
    return out;
  }
  out.push(lever(COMPARE_TESTS_LEVER, 'help', pulled, ['same_tests', 'changed_more_than_one', 'changed_other', 'wrong_subject'],
    'The learner does not see what differs between the two tests, or tests a different engine or place than the question names.',
    'Shows a row for each setting (engine, place, throttle) saying whether Test A and Test B are the same or different, and what each uses. It does not say which should differ.'));
  if (item.question.vary === 'throttle') {
    out.push(lever(CAN_PUSH_LEVER, 'help', pulled, ['cannot_show'],
      'The learner tests the throttle where the engine cannot push anything.',
      'Writes under each test whether its engine has anything to push where that test is.'));
  }
  if (simpler) {
    out.push(lever(ONE_TEST_LEVER, 'simplify', pulled, PROPULSION_MISSES.experiment, 'The learner cannot set up both tests at once.',
      `Opens the same question with Test A already set and locked, so only Test B is set. ${PRACTICE_NOTE}`));
  }
  return out;
}

/** What the pulled levers put on screen, as a scene fact. Never a key or a motion. */
export function leverFact(item: PropulsionItem | undefined, pulled: readonly string[], work?: PropulsionWork): string {
  if (!item || isPractice(item)) return '';
  const parts: string[] = [];
  if (item.mode === 'predict') {
    if (pulled.includes(HOW_IT_WORKS_LEVER)) parts.push(`A card: ${howLines(item).join(' ')}`);
    if (pulled.includes(AIR_MARKS_LEVER)) parts.push(`The scene is labelled "${airLine(item)}".`);
    if (pulled.includes(BLAST_ARROWS_LEVER)) parts.push('An arrow is drawn at each engine, the way it is aimed to blast. Nothing is switched on.');
  } else if (item.mode === 'observe') {
    if (pulled.includes(LABEL_STREAMS_LEVER)) parts.push(`Labels on the engines: ${streamLines(item).join(' ')}`);
    if (pulled.includes(STREAM_UNITS_LEVER)) parts.push(`Lengths written beside the streams: ${unitLines(item).join(', ')}.`);
  } else {
    const w = work ?? emptyWork(item);
    if (pulled.includes(COMPARE_TESTS_LEVER)) parts.push(`A row per setting: ${compareLines(w.a, w.b).join('; ')}.`);
    if (pulled.includes(CAN_PUSH_LEVER)) parts.push(`Under Test A: ${canPushLine(w.a)} Under Test B: ${canPushLine(w.b)}`);
  }
  return parts.join(' ');
}

/** For tests: every miss this item's work can show. */
export function possibleMisses(item: PropulsionItem): PropulsionMiss[] {
  const out = new Set<PropulsionMiss>();
  const work = emptyWork(item);
  if (item.mode === 'experiment') {
    const setups: Setup[] = [];
    for (const engine of ['jet', 'rocket', 'propeller'] as const) for (const place of ['air', 'space'] as const) for (const throttle of ['low', 'high'] as const) setups.push({ engine, place, throttle });
    const as = item.lockA ? [item.start.a] : setups;
    for (const a of as) for (const b of setups) { const m = propulsionMiss(item, { ...work, a, b }); if (m) out.add(m); }
    return Array.from(out);
  }
  for (const c of MOTIONS) { const m = propulsionMiss(item, { ...work, choice: c }); if (m) out.add(m); }
  return Array.from(out);
}
