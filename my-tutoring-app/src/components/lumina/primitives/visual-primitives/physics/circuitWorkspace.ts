/**
 * The circuit workbench's scene on the shared tutor/JEV teaching workspace. Every item is a build the activity checks
 * (the card, `circuitWorkbench.card.ts`, names the moves; the boss gives the assignment), so no key reaches the tutor.
 * The scene carries what is on the table: the parts, the wires clipped on, what is lit, the learner's guess. Which wire
 * would close the loop is never in it.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import { bulbName, evaluate, wireWords, type BulbColor, type LightItChallenge, type Wire } from './circuitModel';
import { switchStates, type SwitchChallenge } from './switchModel';
import type { TwoBulbChallenge } from './twoBulbModel';
import { MAGNET_MATERIAL_WORDS, pulled, type MagnetChallenge, type MagnetThing, type PullCall } from './magnetModel';
import { pairResult, pairWords, type Pole, type PoleChallenge, type PoleResult, type PoleTest } from './poleModel';
import { MARKS, callAnswer, callWords, magnetName, strongest, type DistanceChallenge, type DistTest } from './distanceModel';
import { buildWords, clipsLifted, goalWords, type ElectroBuild, type ElectroChallenge } from './electroModel';
import { PART_WORDS, deviceStates, type DeviceChallenge, type TrayPart } from './deviceModel';
import { MATERIAL_WORDS, conducts, type CondThing, type ConductorChallenge, type LightCall } from './conductorModel';
import { breakLit, breakState, fixWords, partWords, type BreakChallenge, type BreakFix, type BrokenPart } from './breakModel';

/** A guess before the battery goes in: will it light as it is? Never graded. */
export type LightGuess = 'lights' | 'stays_off';

/** The learner's working state for a light_it item. */
export interface CircuitView {
  guess: LightGuess | null;
  /** The battery is clipped in (after the guess): the table shows what lights. */
  powered: boolean;
  wires: readonly Wire[];
}

export function circuitScene(c: LightItChallenge, view: CircuitView): SceneOf {
  const s = evaluate(c.bulbs, view.wires);
  const parts = ['a battery with a + end and a − end, each with a clip',
    ...c.bulbs.map(b => `${bulbName(c, b)} in a holder with a left clip and a right clip`)];
  const facts: Record<string, string | number> = {
    table: 'a workbench drawn in 3D with a battery, bulb holders and wires with clips',
    step: view.powered ? 'wiring' : 'guessing whether it will light as it is',
    goal: c.instruction,
    parts: parts.join('; '),
    wires: view.wires.length ? view.wires.map(w => wireWords(c, w)).join('; ') : 'no wires yet',
    wiresLeft: c.maxWires - view.wires.length,
    lit: !view.powered ? 'the battery is not in yet' : s.short ? 'nothing is lit and the battery is warm'
      : s.lit.length ? s.lit.map(b => `${bulbName(c, b)} is lit`).join('; ') : 'nothing is lit',
    guess: view.guess ? `guessed it would ${view.guess === 'lights' ? 'light' : 'stay off'} as it was` : 'no guess yet',
    constraints: 'Each wire joins two clips.',
  };
  return { objects: [], facts };
}

/** One fix tried on a break item and whether the light came on after it. */
export interface FixLog { fix: BreakFix; lit: boolean }

/** The learner's working state for a find_the_break item. */
export interface BreakView {
  guess: BrokenPart | null;
  fixes: readonly BreakFix[];
  log: readonly FixLog[];
  claim: BrokenPart | null;
}

/** A break item's scene: the device, a loose wire where one is visible, the fixes and what they did. Which part is
 *  broken is never in it: a dead battery and a burnt-out bulb look like good ones. */
export function breakScene(c: BreakChallenge, view: BreakView): SceneOf {
  const { wires } = breakState(c, view.fixes);
  const loose = c.fault.kind === 'loose_wire' && wires.length < c.wires.length;
  const lit = breakLit(c, view.fixes);
  const facts: Record<string, string | number> = {
    table: 'a workbench drawn in 3D with a battery, bulb holders and wires with clips',
    step: !view.guess ? 'guessing which part is broken' : 'testing parts one at a time',
    goal: c.instruction,
    parts: ['a battery', ...c.bulbs.map(b => `${bulbName(c, b)} in a holder`)].join('; ') + (c.bulbs.length > 1 ? '; the bulbs are in a row' : ''),
    wires: wires.map(w => wireWords(c, w)).join('; ') + (loose ? '; one more wire has an end off its clip, lying on the table' : ''),
    lit: lit.length ? lit.map(b => `${bulbName(c, b)} is lit`).join('; ') : 'everything is dark',
    guess: view.guess ? `guessed ${partWords(c, view.guess)} was broken` : 'no guess yet',
    tests: view.log.length ? view.log.map(l => `${fixWords(c, l.fix)}: ${l.lit ? 'it lit' : 'still dark'}`).join('; ') : 'none yet',
    claim: view.claim ? `says ${partWords(c, view.claim)} was broken` : 'not said yet',
  };
  return { objects: [], facts };
}

/** The learner's working state for a conductor item. */
export interface ConductorView {
  /** The guess before each test (never graded), and which tests have been put in the gap. */
  guesses: ReadonlyArray<LightCall | null>;
  tested: readonly boolean[];
  /** The thing lying across the gap now. */
  inGap: CondThing | null;
  calls: ReadonlyArray<LightCall | null>;
  /** The things to sort have been tested (after a right check). */
  revealed: boolean;
}

/** A conductor item's scene: what each thing is made of and what each test did. A thing to sort's result is never in
 *  it before a right check. */
export function conductorScene(c: ConductorChallenge, view: ConductorView): SceneOf {
  const madeOf = (t: CondThing) => `the ${t.name} (made of ${MATERIAL_WORDS[t.material]}, ${t.shiny ? 'shiny' : 'dull'})`;
  const tests = c.tested.map((t, i) => `${madeOf(t)}: ${view.tested[i] ? `put in the gap; the bulb ${conducts(t) ? 'lit' : 'stayed off'}`
    : 'not tested yet'}${view.guesses[i] ? ` (guessed it would ${view.guesses[i] === 'lights' ? 'light' : 'stay off'})` : ''}`);
  const toSort = c.toSort.map((t, i) => `${madeOf(t)}: ${view.revealed ? `tested after the check; the bulb ${conducts(t) ? 'lit' : 'stayed off'}`
    : 'not tested'}; the learner ${view.calls[i] ? `says it ${view.calls[i] === 'lights' ? 'lights the bulb' : 'leaves it off'}` : 'has not called it'}`);
  const facts: Record<string, string | number> = {
    table: 'a workbench drawn in 3D: a battery and a bulb wired in a loop with a gap; a thing put across the gap closes it if electricity can go through it',
    step: view.tested.every(Boolean) ? 'deciding about the untested things' : 'testing things in the gap',
    goal: c.instruction,
    inGap: view.inGap ? `the ${view.inGap.name}; the bulb is ${conducts(view.inGap) ? 'lit' : 'off'}` : 'nothing; the bulb is off',
    tests: tests.join('; '),
    toDecide: toSort.join('; '),
  };
  return { objects: [], facts };
}

/** A switch item's scene: the wires, the switch's position and what is lit now, and what the learner's flips showed. */
export function switchScene(c: SwitchChallenge, view: CircuitView & { switchOn: boolean }): SceneOf {
  const now = switchStates(view.wires)[view.switchOn ? 'on' : 'off'];
  const facts: Record<string, string | number> = {
    table: 'a workbench drawn in 3D with a battery, a bulb in a holder and a switch, each with two clips, and wires',
    step: view.powered ? 'wiring and testing the switch' : 'guessing whether it will light as it is',
    goal: c.instruction,
    wires: view.wires.length ? view.wires.map(w => wireWords(c, w)).join('; ') : 'no wires yet',
    wiresLeft: c.maxWires - view.wires.length,
    switchNow: view.switchOn ? 'on (closed)' : 'off (open)',
    lit: !view.powered ? 'the battery is not in yet' : now.short ? 'nothing is lit and the battery is warm' : now.lit.length ? 'the bulb is lit' : 'the bulb is off',
    guess: view.guess ? `guessed it would ${view.guess === 'lights' ? 'light' : 'stay off'} as it was` : 'no guess yet',
  };
  return { objects: [], facts };
}

/** A two-bulb item's scene: the wires, which bulbs are in their holders, and what is lit and how brightly. */
export function twoBulbScene(c: TwoBulbChallenge, view: CircuitView & { out: readonly BulbColor[] }): SceneOf {
  const s = evaluate(c.bulbs, view.wires, { burnt: view.out });
  const facts: Record<string, string | number> = {
    table: 'a workbench drawn in 3D with a battery, a red bulb and a blue bulb in holders, and wires',
    step: view.powered ? 'wiring and testing the bulbs' : 'guessing whether they will light as they are',
    goal: c.instruction,
    wires: view.wires.length ? view.wires.map(w => wireWords(c, w)).join('; ') : 'no wires yet',
    wiresLeft: c.maxWires - view.wires.length,
    takenOut: view.out.length ? view.out.map(b => `the ${b} bulb is taken out of its holder`).join('; ') : 'both bulbs are in their holders',
    lit: !view.powered ? 'the battery is not in yet' : s.short ? 'nothing is lit and the battery is warm'
      : s.lit.length ? s.lit.map(b => `the ${b} bulb is lit${s.dim?.includes(b) ? ', dimly' : ', brightly'}`).join('; ') : 'nothing is lit',
    guess: view.guess ? `guessed they would ${view.guess === 'lights' ? 'light' : 'stay off'} as they were` : 'no guess yet',
  };
  return { objects: [], facts };
}

/** A device item's scene: the device and its job, the parts chosen, the wires, and what runs now. Which parts it needs
 *  is the task, so it is said; which wire is missing is never in it. */
export function deviceScene(c: DeviceChallenge, view: { parts: readonly TrayPart[]; wires: readonly Wire[]; switchOn: boolean }): SceneOf {
  const loads = view.parts.filter((p): p is BulbColor => p !== 'switch');
  const s = deviceStates(view);
  const now = view.parts.includes('switch') ? (view.switchOn ? s.on : s.off!) : s.on;
  const facts: Record<string, string | number> = {
    table: 'a workbench drawn in 3D with a battery, a tray of parts (a bulb, a motor with a fan, a buzzer, a switch), and wires',
    step: view.parts.length ? 'building and testing the device' : 'choosing parts from the tray',
    goal: c.instruction,
    partsOnTable: view.parts.length ? view.parts.map(p => PART_WORDS[p]).join(', ') : 'none yet',
    wires: view.wires.length ? view.wires.map(w => wireWords({ bulbs: loads }, w)).join('; ') : 'no wires yet',
    switchNow: view.parts.includes('switch') ? (view.switchOn ? 'on' : 'off') : 'no switch',
    running: now.short ? 'nothing runs and the battery is warm' : now.lit.length ? now.lit.map(l => bulbName({ bulbs: loads }, l)).join(' and ') + ' on' : 'nothing runs',
  };
  return { objects: [], facts };
}

export interface MagnetView { guesses: ReadonlyArray<PullCall | null>; tested: readonly boolean[]; held: MagnetThing | null; calls: ReadonlyArray<PullCall | null>; revealed: boolean }

/** A magnet item's scene: what each thing is made of and what the tests did. A thing to decide's result is never in it
 *  before a right check. */
export function magnetScene(c: MagnetChallenge, view: MagnetView): SceneOf {
  const made = (t: MagnetThing) => `the ${t.name} (made of ${MAGNET_MATERIAL_WORDS[t.material]})`;
  const facts: Record<string, string | number> = {
    table: 'a workbench drawn in 3D with a pad and a red magnet held above it; a thing on the pad jumps up to the magnet if the magnet pulls it',
    step: view.tested.every(Boolean) ? 'deciding about the untested things' : 'testing things with the magnet',
    goal: c.instruction,
    underMagnet: view.held ? `${made(view.held)}: ${pulled(view.held) ? 'it jumped up to the magnet' : 'it stayed on the pad'}` : 'nothing',
    tests: c.tested.map((t, i) => `${made(t)}: ${view.tested[i] ? (pulled(t) ? 'pulled' : 'not pulled') : 'not tested yet'}`
      + (view.guesses[i] ? ` (guessed ${view.guesses[i] === 'pulls' ? 'pulled' : 'not pulled'})` : '')).join('; '),
    toDecide: c.toSort.map((t, i) => `${made(t)}: ${view.revealed ? (pulled(t) ? 'pulled after the check' : 'not pulled after the check') : 'not tested'}; `
      + `the learner ${view.calls[i] ? `says ${view.calls[i] === 'pulls' ? 'pulled' : 'not pulled'}` : 'has not called it'}`).join('; '),
  };
  return { objects: [], facts };
}

export interface PoleView { facing: Pole; tests: readonly PoleTest[]; calls: ReadonlyArray<PoleResult | null>; striped: Pole | null; revealed: boolean }

/** A magnet-poles item's scene: the two magnets, which ends face, and what each test did. A pair to call's result is
 *  never in it before a right check, and neither is the real pole of a striped end. */
export function poleScene(c: PoleChallenge, view: PoleView): SceneOf {
  const rightEnd = (p: Pole) => (c.mystery ? `its ${p === c.striped ? 'striped' : 'plain'} end` : `its ${p} end`);
  const result = (r: PoleResult) => (r === 'pull' ? 'they pulled together' : 'they pushed apart');
  const facts: Record<string, string | number> = {
    table: 'a workbench drawn in 3D with two bar magnets lying end to end; the left one stays put, the right one can be turned round and slid up to it',
    step: c.mystery ? (view.striped ? 'has named the striped end' : 'testing, then naming the striped end')
      : view.calls.every(Boolean) ? 'ready to check' : 'testing both ways, then calling the untested pairs',
    goal: c.instruction,
    leftMagnet: `a bar magnet with N and S written on its ends; its ${c.aEnd} end faces the right magnet`,
    rightMagnet: c.mystery ? `a bar magnet whose letters rubbed off; one end has a yellow stripe; ${rightEnd(view.facing)} faces the left magnet`
      : `a bar magnet with N and S written on its ends; ${rightEnd(view.facing)} faces the left magnet`,
    tests: view.tests.length ? view.tests.map((t, i) => `test ${i + 1}: the left ${c.aEnd} end and the right magnet's ${rightEnd(t.facing).slice(4)}: ${result(t.result)}`).join('; ') : 'no tests yet',
  };
  if (c.mystery) facts.call = view.revealed ? `the striped end is ${c.striped} (after the check)` : view.striped ? `the learner says the striped end is ${view.striped}` : 'not named yet';
  else facts.toDecide = c.toCall.map((p, i) => `${pairWords(p)}: ${view.revealed ? `${result(pairResult(p))} after the check` : 'not tested'}; the learner `
    + (view.calls[i] ? `says ${view.calls[i] === 'pull' ? 'they pull together' : 'they push apart'}` : 'has not called it')).join('; ');
  return { objects: [], facts };
}

export interface DistanceView { balls: ReadonlyArray<number | null>; tests: readonly DistTest[]; reach: number | null; calls: ReadonlyArray<boolean | null>; stronger: number | null; revealed: boolean }

/** A magnet-distance item's scene: the magnets, where each ball sits, and what each test did. A magnet's reach, a call's
 *  answer and which magnet is stronger are never in it before a right check. */
export function distanceScene(c: DistanceChallenge, view: DistanceView): SceneOf {
  const name = (i: number) => magnetName(c, i);
  const facts: Record<string, string | number> = {
    table: `a workbench drawn in 3D with ${c.magnets.length > 1 ? 'two rulers, each with a bar magnet at its near end' : 'a ruler with a bar magnet at its near end'}; `
      + `the marks run 1 (next to the magnet) to ${MARKS}; a steel ball goes on a mark, and when the magnet is tried the ball rolls to it if the magnet pulls it`,
    step: view.revealed ? 'checked' : c.ask === 'reach' ? 'testing, then naming the farthest mark the magnet pulls from'
      : c.ask === 'calls' ? 'testing near and far, then deciding about another magnet' : 'testing both magnets, then saying which is stronger',
    goal: c.instruction,
    magnets: c.magnets.map((m, i) => `${name(i)}: a ${m.size} bar magnet; its ball is ${view.balls[i] == null ? 'not on the ruler yet' : `on mark ${view.balls[i]}`}`).join('; '),
    tests: view.tests.length ? view.tests.map((t, i) => `test ${i + 1}: ${name(t.magnet)} with the ball on mark ${t.mark}: ${t.pulled ? 'it rolled to the magnet' : 'it stayed put'}`).join('; ') : 'no tests yet',
  };
  if (c.ask === 'reach') facts.answer = view.revealed ? `the farthest mark is ${c.magnets[0].reach} (after the check)` : view.reach ? `the learner says mark ${view.reach}` : 'not named yet';
  else if (c.ask === 'calls') facts.toDecide = c.toCall.map((k, i) => `${callWords(k)} ${view.revealed ? `(${callAnswer(k) ? 'yes' : 'no'}, after the check)` : ''}`
    + `the learner ${view.calls[i] === null || view.calls[i] === undefined ? 'has not called it' : `says ${view.calls[i] ? 'yes' : 'no'}`}`).join('; ');
  else facts.answer = view.revealed ? `${name(strongest(c))} is stronger (after the check)` : view.stronger !== null ? `the learner says ${name(view.stronger)} is stronger` : 'not picked yet';
  return { objects: [], facts };
}

export interface ElectroView { build: ElectroBuild; tests: readonly ElectroBuild[]; hanging: number }

/** An electromagnet item's scene: the build on the bench and what each dip lifted. How many wraps or batteries the goal
 *  needs is never in it. */
export function electroScene(c: ElectroChallenge, view: ElectroView): SceneOf {
  const lifted = (b: ElectroBuild) => `${clipsLifted(b)} clip${clipsLifted(b) === 1 ? '' : 's'}`;
  const facts: Record<string, string | number> = {
    table: 'a workbench drawn in 3D: a battery and a switch wired to a coil of copper wire wrapped round a core that hangs from a crane '
      + 'over a tray of paper clips' + (c.spareBattery ? '; a spare battery to put in' : '') + (c.coreTray ? '; a tray of other cores to wrap the wire round instead' : ''),
    step: view.tests.length ? 'changing the build and testing' : 'building, then dipping it in the clips to test',
    goal: `pick up ${goalWords(c.goal)}`,
    build: buildWords(view.build),
    tests: view.tests.length ? view.tests.map((t, i) => `test ${i + 1}: ${buildWords(t)}: lifted ${lifted(t)}`).join('; ') : 'no tests yet',
    hanging: view.hanging ? `${view.hanging} clip${view.hanging === 1 ? '' : 's'} hanging from the core` : 'nothing hanging from the core',
  };
  return { objects: [], facts };
}
