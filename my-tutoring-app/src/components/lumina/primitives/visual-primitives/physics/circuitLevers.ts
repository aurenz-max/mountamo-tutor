/**
 * The in-item levers on a circuit-workbench item, as one lever set (`bossLevers.ts`; `/add-support-tiers`). No
 * real-learner evidence yet: the misses are what each mode's check observes, and the documented misconception that one
 * wire from the battery is enough (electricity "goes to" the bulb rather than round a loop).
 *
 * - `xray` (marks, every mode): glowing charge dots on every wire electricity can reach from the battery's + end. Round a
 *   closed loop they move; where the path stops they stand still, so the learner sees where the loop is open. Through a
 *   short they race round the shorting wire. No words, and it never adds a wire: the learner still decides what to do.
 * - `one_step_less` (easier, every mode): the same task one step simpler, ungraded: one wire already right (light it),
 *   a loose wire you can see (find the break), two tests and one thing to decide (conductor test), the loop already
 *   through the switch but for one wire (add a switch), or one of the two paths already wired (two bulbs). None when
 *   the item is already that simple.
 *
 * When they come is the lesson's support tier: at easy the x-ray is drawn from the start (`startLevers`).
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { CIRCUIT_MISSES_BY_MODE } from './circuitWorkbench.card';
import { makeLightIt, wire, wireKey, type CircuitChallenge, type Wire } from './circuitModel';
import { makeBreak } from './breakModel';
import { condByKey, makeConductor } from './conductorModel';
import { makeSwitch } from './switchModel';
import { makeTwoBulb } from './twoBulbModel';
import { DEVICES, makeDevice } from './deviceModel';
import { magnetByKey, makeMagnet } from './magnetModel';
import { makePoles } from './poleModel';
import { makeDistance } from './distanceModel';
import { makeElectro } from './electroModel';

export const XRAY_LEVER = 'xray';
export const EASIER_LEVER = 'one_step_less';
export const MAGNET_TAGS_LEVER = 'magnet_tags';
export const POLE_TAGS_LEVER = 'pole_tags';
export const PULL_MARKS_LEVER = 'pull_marks';
export const STRENGTH_METER_LEVER = 'strength_meter';
export const PRACTICE_SUFFIX = '~easier';
export const isPractice = (c: Pick<CircuitChallenge, 'id'>) => c.id.endsWith(PRACTICE_SUFFIX);
export const PRACTICE_NOTE = 'An easier practice item, ungraded; the full item comes back after it.';

/** What the screen shows that a lever needs: whether the battery is in (the x-ray has something to draw). */
export interface CircuitLeverCtx { powered: boolean }

const sameStart = (a: readonly Wire[], b: readonly Wire[]) =>
  a.length === b.length && a.map(wireKey).sort().join() === b.map(wireKey).sort().join();

/** The same task one step simpler, or null when the item is already that simple. */
export function practiceItem(c: CircuitChallenge): CircuitChallenge | null {
  if (isPractice(c)) return null;
  const id = `${c.id}${PRACTICE_SUFFIX}`;
  if (c.type === 'light_it') {
    const start = [wire('bat+', 'red.left')];
    // Already that simple: one bulb, one wire from a battery end to a bulb clip.
    const simple = c.bulbs.length === 1 && c.start.length === 1 && c.start[0].some(k => k.startsWith('bat')) && c.start[0].some(k => k.startsWith('red'));
    return simple ? null : makeLightIt(id, ['red'], 'red', start);
  }
  if (c.type === 'find_the_break') return c.fault.kind === 'loose_wire' ? null : makeBreak(id, ['red'], { kind: 'loose_wire', wire: 1 });
  if (c.type === 'conductor_test') {
    return c.toSort.length === 1 ? null : makeConductor(id, [condByKey('spoon')!, condByKey('eraser')!], [condByKey('key')!]);
  }
  if (c.type === 'magnet_test') {
    // Two tests, one thing to decide, no tricky metal.
    if (c.toSort.length === 1) return null;
    return makeMagnet(`${c.id}${PRACTICE_SUFFIX}`, [magnetByKey('paper-clip')!, magnetByKey('eraser')!], [magnetByKey('nail')!]);
  }
  if (c.type === 'magnet_poles') {
    // One pair of bar magnets to call, every letter showing.
    if (!c.mystery && c.toCall.length === 1 && c.toCall.every(p => p.a.kind === 'bar' && p.b.kind === 'bar')) return null;
    return makePoles(id, 'N', [{ a: { kind: 'bar', end: 'S' }, b: { kind: 'bar', end: 'S' } }]);
  }
  if (c.type === 'magnet_distance') {
    // Reach: already the simplest. Calls: find one magnet's reach first. Stronger: the big magnet is the stronger one,
    // by far, so size does not mislead.
    if (c.ask === 'reach') return null;
    if (c.ask === 'calls') return makeDistance(id, 'reach', [{ size: 'big', reach: 3 }]);
    const easy = c.magnets.some(m => m.size === 'big' && m.reach === 5) && c.magnets.some(m => m.size === 'small' && m.reach === 2);
    return easy ? null : makeDistance(id, 'stronger', [{ size: 'small', reach: 2 }, { size: 'big', reach: 5 }]);
  }
  if (c.type === 'electromagnet') {
    // At least two clips from a bare steel nail; for a hard item, an exact count on one battery and a steel nail.
    if (c.goal.kind === 'at_least') return null;
    if (!c.spareBattery && !c.coreTray) return makeElectro(id, { kind: 'at_least', clips: 2 }, { core: 'steel', turns: 0, batteries: 1, on: false });
    return makeElectro(id, { kind: 'exactly', clips: 3 }, { core: 'steel', turns: 9, batteries: 1, on: false });
  }
  if (c.type === 'build_device') {
    // One part, no switch: a fan.
    return DEVICES[c.device].needsSwitch || DEVICES[c.device].loads.length > 1 ? makeDevice(`${c.id}${PRACTICE_SUFFIX}`, 'fan') : null;
  }
  if (c.type === 'add_a_switch') {
    const start = [wire('bat+', 'red.left'), wire('red.right', 'sw.left')];
    return sameStart(c.start, start) || c.start.length === 2 ? null : makeSwitch(id, start);
  }
  const start = c.arrangement === 'row' ? [wire('bat+', 'red.left'), wire('red.right', 'blue.left')]
    : [wire('bat+', 'red.left'), wire('red.right', 'bat-')];
  return sameStart(c.start, start) ? null : makeTwoBulb(id, c.arrangement, start);
}

export const practiceParent = (itemId: string | null | undefined, challenges: readonly CircuitChallenge[]) =>
  itemId?.endsWith(PRACTICE_SUFFIX) ? challenges.find(c => `${c.id}${PRACTICE_SUFFIX}` === itemId) ?? null : null;

const notPractice = (c: CircuitChallenge) => (isPractice(c) ? null : true);
const misses = CIRCUIT_MISSES_BY_MODE;

export const CIRCUIT_LEVERS = leverSet<CircuitChallenge, CircuitLeverCtx>({
  modeOf: c => c.type,
  missesOf: mode => misses[mode as keyof typeof misses] ?? [],
  specs: [
    { id: XRAY_LEVER, type: 'marks', modes: ['light_it', 'find_the_break', 'conductor_test', 'add_a_switch', 'build_device', 'two_bulbs'],
      answers: ['open_loop', 'both_on_one_end', 'short_circuit', 'wrong_bulb', 'lit_both', 'still_dark', 'no_loop',
        'switch_does_nothing', 'switch_backwards', 'switch_shorts', 'not_both_lit', 'made_a_row', 'made_side_by_side',
        'not_working',
        'judged_by_shine', 'sort_slip'],
      when: 'The learner cannot see where the electricity goes, or where the path stops.',
      does: 'Draws glowing charge dots on every wire electricity can reach from the battery\'s + end, with no words: round a '
        + 'closed loop they move; where the path stops they stand still.',
      content: notPractice,
      offer: (_c, ctx) => ctx.powered,
      fact: 'Charge dots are drawn on every wire electricity can reach from the battery\'s + end: they move round a closed '
        + 'loop and stand still where the path stops.' },
    { id: MAGNET_TAGS_LEVER, type: 'legend', modes: ['magnet_test'], answers: ['all_metal_sticks', 'sort_slip'],
      when: 'The learner thinks every metal sticks, or does not use what each thing is made of.',
      does: 'Puts a tag on every thing, tests and untested alike, naming what it is made of: iron or steel, another metal, or not a metal.',
      content: notPractice,
      fact: 'A tag on every thing (tests and untested alike) names what it is made of: iron or steel, another metal, or not a metal.' },
    { id: POLE_TAGS_LEVER, type: 'legend', modes: ['magnet_poles'], answers: ['like_ends_pull', 'unlike_ends_push'],
      when: 'The learner does not notice which ends faced each other in a test.',
      does: 'Puts a tag on every test and every pair to call, naming whether the same ends or different ends face each other.',
      // A magnet with no letters has no tag to give: which ends face is what the learner is finding out.
      content: c => (isPractice(c) || (c.type === 'magnet_poles' && c.mystery) ? null : true),
      fact: 'A tag on every test and every pair to call names whether the same ends or different ends face each other.' },
    { id: PULL_MARKS_LEVER, type: 'legend', modes: ['magnet_distance'],
      answers: ['reach_too_far', 'reach_too_near', 'farther_pulled', 'nearer_not_pulled', 'judged_by_size', 'picked_weaker'],
      when: 'The learner does not connect how far the ball was with whether the magnet pulled it.',
      does: 'Colours every mark the learner tested on the ruler: green where the magnet pulled the ball, grey where it did not.',
      content: notPractice,
      fact: 'Every tested mark on the ruler is coloured: green where the magnet pulled the ball, grey where it did not.' },
    { id: STRENGTH_METER_LEVER, type: 'marks', modes: ['electromagnet'],
      answers: ['switch_off', 'no_coil', 'not_iron_core', 'too_few_clips', 'too_many_clips'],
      when: 'The learner does not see what makes the electromagnet stronger or weaker.',
      does: 'Draws a meter beside the crane that fills as the magnet gets stronger, with no numbers: empty with the switch off or no wraps, '
        + 'almost empty on a core that is not iron or steel, higher with each wrap and with a second battery.',
      content: notPractice,
      fact: 'A meter beside the crane fills as the magnet gets stronger, with no numbers: empty with the switch off or no wraps, almost '
        + 'empty on a core that is not iron or steel, higher with each wrap and with a second battery.' },
    { id: EASIER_LEVER, type: 'easier', answers: 'all',
      when: 'The learner cannot yet do this item even with the charge dots.',
      does: c => (c.type === 'light_it' ? 'Opens an easier circuit first: one bulb, one wire already right.'
        : c.type === 'find_the_break' ? 'Opens an easier break first: a wire whose clip came off, which you can see.'
          : c.type === 'conductor_test' ? 'Opens an easier test first: two things to test and one to decide about.'
            : c.type === 'magnet_test' ? 'Opens an easier magnet test first: two tests and one thing to decide, no tricky metal.'
            : c.type === 'magnet_poles' ? 'Opens an easier magnet pair first: two bar magnets, every letter showing, one pair to call.'
            : c.type === 'electromagnet' ? (c.spareBattery || c.coreTray ? 'Opens an easier electromagnet first: a steel nail, one battery, an exact number of clips.'
              : 'Opens an easier electromagnet first: a bare steel nail; pick up at least two clips.')
            : c.type === 'magnet_distance' ? (c.ask === 'calls' ? 'Opens an easier magnet first: one magnet, find the farthest mark it pulls the ball from.'
              : 'Opens an easier pair first: the big magnet is the stronger one, by far.')
            : c.type === 'build_device' ? 'Opens an easier build first: a fan, one motor and no switch.'
            : c.type === 'add_a_switch' ? 'Opens an easier switch first: the loop already runs through the switch but for one wire.'
              : 'Opens an easier two-bulb circuit first: one of the paths already wired.')
        + ' It is not graded; the full item comes back after it.',
      content: c => practiceItem(c) },
  ],
});
