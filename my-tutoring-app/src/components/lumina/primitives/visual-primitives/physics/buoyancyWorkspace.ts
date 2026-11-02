/**
 * Buoyancy harbor's scene on the shared tutor/JEV teaching workspace. Every item is a gesture the activity
 * checks (the card, `buoyancyHarbor.card.ts`, names the moves; the boss gives the assignment), so no key reaches the
 * tutor. The scene carries what is on screen: the things and what they are made of, which tests have been dropped
 * and what each did, the learner's guesses (the rule and salt items; a drop test's guesses are said aloud), call and chosen test. The mystery's result is never in it before a right
 * check: the mystery stays on the pier until then.
 *
 * A boat build's scene carries the cargo goal (it is the task), the boat as built so far, whether it is in the tank, the
 * pennies in it and what the learner's tests showed. How many pennies a build can carry is never in it: the learner
 * finds out by testing.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import { MATERIAL_WORD, result, type Call, type DropTestChallenge, type HarborThing } from './buoyancyModel';
import { MATERIAL_LABEL, boatName, floatsWith, isBuilt, shapeLabel, type BoatChallenge, type BoatDraft } from './boatModel';
import { floatsAt, type SaltChallenge } from './saltModel';
import { RULES, RULE_LABEL, type Rule, type RuleChallenge } from './ruleModel';
import { clayGrams, clayOf, shapeWords, type ShapeChallenge } from './shapeModel';
import { PART_LABEL, changedParts, type CargoChallenge, type Which } from './cargoModel';

export type DropStep = 'test' | 'decide' | 'done';

/** The learner's working state for the current item. */
export interface BuoyancyView {
  step: DropStep;
  /** Which tests are in the tank and have settled. */
  settled: [boolean, boolean];
  /** Which tests have gone in (settled or still moving). The guess before each is said to the tutor, not tapped. */
  dropped: [boolean, boolean];
  call: Call | null;
  evidence: 0 | 1 | null;
  /** The mystery has been dropped (only after a right check). */
  mysteryDropped: boolean;
}

const HARBOR = 'a harbor pier drawn in 3D with a glass tank of water on it; the things to test sit on the pier in front of the tank';
const madeOf = (t: HarborThing) => `the ${t.name} (made of ${MATERIAL_WORD[t.material]}, ${t.size})`;
const did = (t: HarborThing) => (result(t) === 'floats' ? 'floated at the top of the water' : 'sank to the bottom of the tank');

export function buoyancyScene(c: DropTestChallenge, view: BuoyancyView): SceneOf {
  const tests = c.tested.map((t, i) => `${madeOf(t)}: ${view.settled[i] ? `dropped in the tank; it ${did(t)}`
    : view.dropped[i] ? 'just dropped in the tank, still moving' : 'on the pier, not tested yet'}`);
  const facts: Record<string, string | number> = {
    harbor: HARBOR,
    step: view.step === 'test' ? 'testing the two things' : view.step === 'decide' ? 'deciding about the mystery thing' : 'done',
    testLeft: tests[0],
    testRight: tests[1],
    mystery: view.mysteryDropped
      ? `${madeOf(c.mystery)}: dropped in the tank; it ${did(c.mystery)}`
      : `${madeOf(c.mystery)}: on the yellow stand on the pier, not tested`,
    call: view.call ? `said it will ${view.call === 'floats' ? 'float' : 'sink'}` : 'no call yet',
    testPicked: view.evidence == null ? 'none yet' : `the ${c.tested[view.evidence].name}`,
    constraints: 'Each thing shows what it is made of. A lab notebook under the tank lists each test and what happened.',
  };
  return { objects: [], facts };
}

/** One test of a boat in the tank: what was built, how many pennies went in, whether it sank, and (shaping) the guess. */
export interface BoatTest { name: string; pennies: number; sank: boolean; guess?: Call | null }

/** The learner's working state for a boat item. */
export interface BoatView {
  draft: BoatDraft;
  launched: boolean;
  pennies: number;
  tests: readonly BoatTest[];
}

export const boatTestLine = (t: BoatTest): string =>
  t.sank ? `${t.name} sank with ${t.pennies} ${t.pennies === 1 ? 'penny' : 'pennies'} in it`
    : `${t.name} floated with ${t.pennies} ${t.pennies === 1 ? 'penny' : 'pennies'} in it`;

export function boatScene(c: BoatChallenge, view: BoatView): SceneOf {
  const d = view.draft;
  const build = isBuilt(d) ? boatName(d)
    : [d.material && `made of ${MATERIAL_LABEL[d.material]}`, d.shape && `shape ${shapeLabel(d.shape, d.material)}`, d.size && `size ${d.size}`]
      .filter(Boolean).join(', ') || 'nothing chosen yet';
  const now = !view.launched || !isBuilt(d) ? 'on the yellow stand on the pier'
    : floatsWith(d, view.pennies) ? 'floating in the tank' : 'sunk to the bottom of the tank';
  const facts: Record<string, string | number> = {
    harbor: 'a harbor pier drawn in 3D with a glass tank of water on it; the boat is built on a yellow stand on the pier',
    step: view.launched ? 'testing the boat in the tank' : 'building the boat',
    goal: `build a boat that carries ${c.goal} pennies without sinking`,
    canBuildFrom: c.materials.map(m => MATERIAL_LABEL[m]).join(', '),
    boat: build,
    boatNow: now,
    penniesInBoat: view.launched ? view.pennies : 0,
    tests: view.tests.length ? view.tests.map(boatTestLine).join('; ') : 'none yet',
    constraints: 'A lab notebook lists each test.',
  };
  return { objects: [], facts };
}

/** A shape item's scene: the clay (always the same piece), its shape now, the guess before this test, and the tests.
 *  Which shapes carry the goal is never in it. */
export function shapeScene(c: ShapeChallenge, view: BoatView & { guess: Call | null }): SceneOf {
  const shape = view.draft.shape ?? 'ball';
  const now = !view.launched ? 'on the yellow stand on the pier'
    : floatsWith(clayOf(c, shape), view.pennies) ? 'floating in the tank' : 'sunk to the bottom of the tank';
  const facts: Record<string, string | number> = {
    harbor: 'a harbor pier drawn in 3D with a glass tank of water on it; the clay sits on a yellow stand on the pier',
    step: view.launched ? 'testing the clay in the tank' : 'shaping the clay',
    goal: c.goal ? `shape the clay so it floats carrying ${c.goal} ${c.goal === 1 ? 'penny' : 'pennies'}` : 'shape the clay so it floats',
    clay: `a ${c.size} piece of clay, ${clayGrams(c)} grams whatever its shape; it started as a ball`,
    shape: shapeWords(shape),
    guess: view.guess ? `guessed it would ${view.guess === 'floats' ? 'float' : 'sink'}` : 'no guess yet',
    clayNow: now,
    penniesInIt: view.launched ? view.pennies : 0,
    tests: view.tests.length ? view.tests.map(boatTestLine).join('; ') : 'none yet',
    constraints: 'Only the shape can change. A lab notebook lists each test and the guess.',
  };
  return { objects: [], facts };
}

/** One salt test: the salt in the water after a change, and the foods floating then. */
export interface SaltLog { spoons: number; floating: string[] }

/** The learner's working state for a salt item. */
export interface SaltView {
  /** Which foods are in the tank and have settled, left to right. */
  settled: readonly boolean[];
  guesses: ReadonlyArray<Call | null>;
  spoons: number;
  log: readonly SaltLog[];
}

const spoonsOf = (n: number) => (n ? `${n} ${n === 1 ? 'spoon' : 'spoons'} of salt` : 'no salt (fresh water)');

/** The goal is the task, so it is in the scene; how many spoons any food needs is never in it. */
export function saltScene(c: SaltChallenge, view: SaltView): SceneOf {
  const named = (keys: readonly string[]) => c.things.filter(t => keys.includes(t.key)).map(t => `the ${t.name}`).join(', ');
  const testing = view.settled.some(s => !s);
  const foods = c.things.map((t, i) => {
    const guess = view.guesses[i] ? `guessed it would ${view.guesses[i] === 'floats' ? 'float' : 'sink'}` : 'no guess yet';
    const now = !view.settled[i] ? 'on the pier, not in the water yet'
      : floatsAt(t, view.spoons) ? 'floating at the top of the water' : 'on the bottom of the tank';
    return `the ${t.name}: ${now} (${guess})`;
  });
  const facts: Record<string, string | number> = {
    harbor: 'a harbor pier drawn in 3D with a glass tank of water on it, a salt jar and a spoon beside it',
    step: testing ? 'dropping the foods into fresh water' : 'adding or pouring out salt',
    goal: c.sinkGoal.length ? `make ${named(c.floatGoal)} float but keep ${named(c.sinkGoal)} on the bottom` : `make ${named(c.floatGoal)} float`,
    foods: foods.join('; '),
    saltInWater: spoonsOf(view.spoons),
    tests: view.log.length
      ? view.log.map(l => `${spoonsOf(l.spoons)}: ${l.floating.length ? `${l.floating.join(', ')} floating` : 'nothing floating'}`).join('; ')
      : 'none yet',
    constraints: 'A lab notebook lists the salt after each change and which foods floated.',
  };
  return { objects: [], facts };
}

/** The learner's working state for a rule item. */
export interface RuleView {
  /** Which tests are in the tank and have settled, in order. */
  settled: readonly boolean[];
  guesses: ReadonlyArray<Call | null>;
  /** The call on each thing to sort. */
  calls: ReadonlyArray<Call | null>;
  rule: Rule | null;
  /** The things to sort have been dropped (only after a right check). */
  revealed: boolean;
}

/** What a rule item shows: the tests and what they did, the things to sort and the learner's calls. A thing to sort's
 *  result is never in it before a right check: it stays on its stand until then. */
export function ruleScene(c: RuleChallenge, view: RuleView): SceneOf {
  const testing = view.settled.some(s => !s);
  const tests = c.tested.map((t, i) => {
    const guess = view.guesses[i] ? `guessed it would ${view.guesses[i] === 'floats' ? 'float' : 'sink'}` : 'no guess yet';
    return `${madeOf(t)}: ${view.settled[i] ? `dropped in the tank; it ${did(t)}` : 'on the pier, not tested yet'} (${guess})`;
  });
  const sorts = c.toSort.map((t, i) => (view.revealed ? `${madeOf(t)}: dropped in the tank; it ${did(t)}`
    : `${madeOf(t)}: on a yellow stand, not tested; ${view.calls[i] ? `the learner says it will ${view.calls[i] === 'floats' ? 'float' : 'sink'}` : 'no call yet'}`));
  const facts: Record<string, string | number> = {
    harbor: HARBOR,
    step: testing ? 'testing' : view.revealed ? 'done' : 'sorting the things on the stands without testing',
    tests: tests.join('; '),
    toSort: sorts.join('; '),
    ruleChoices: RULES.map(r => RULE_LABEL[r]).join(', '),
    rulePicked: view.rule ? RULE_LABEL[view.rule] : 'none yet',
    constraints: 'A lab notebook under the tank lists each test, the guess and what happened.',
  };
  return { objects: [], facts };
}

/** One boat's test in a two-boat comparison: it was loaded until it sank. */
export interface CargoTest { boat: 'a' | 'b'; name: string; held: number }

/** The learner's working state for a two-boat item. */
export interface CargoView {
  a: BoatDraft;
  b: BoatDraft;
  /** The boat on the build panel and in the tank. */
  active: 'a' | 'b';
  prediction: Which | null;
  launched: boolean;
  pennies: number;
  /** The latest test of each boat as it is now built (a changed boat's old test is dropped). */
  tests: readonly CargoTest[];
  claim: Which | null;
}

const draftName = (d: BoatDraft) => (isBuilt(d) ? boatName(d)
  : [d.material && `made of ${MATERIAL_LABEL[d.material]}`, d.shape && `shape ${shapeLabel(d.shape, d.material)}`, d.size && `size ${d.size}`]
    .filter(Boolean).join(', ') || 'nothing chosen yet');
export const cargoTestLine = (t: CargoTest): string =>
  `boat ${t.boat.toUpperCase()} (${t.name}) ${t.held ? `carried ${t.held} ${t.held === 1 ? 'penny' : 'pennies'} and sank with the next one` : 'sank with nothing in it'}`;

export function cargoScene(c: CargoChallenge, view: CargoView): SceneOf {
  const tested = (k: 'a' | 'b') => view.tests.some(t => t.boat === k);
  const step = !isBuilt(view.a) || !isBuilt(view.b) ? 'building the boats' : !view.prediction ? 'guessing which boat carries more'
    : !tested('a') || !tested('b') ? 'testing the boats' : 'saying which boat carried more';
  const changed = isBuilt(view.a) && isBuilt(view.b) ? changedParts(view.a, view.b) : [];
  const active = view.active === 'a' ? view.a : view.b;
  const facts: Record<string, string | number> = {
    harbor: 'a harbor pier drawn in 3D with a glass tank of water on it; one boat at a time is on a yellow stand or in the tank',
    step,
    task: c.question ? `find out whether ${PART_LABEL[c.question]} changes how many pennies a boat carries; the two boats must differ only in that`
      : c.oneChange ? 'compare two boats; boat B must change just one thing from boat A' : 'compare two boats',
    canBuildFrom: c.materials.map(m => MATERIAL_LABEL[m]).join(', '),
    boatA: `${draftName(view.a)}${c.given ? ' (built for the learner)' : ''}`,
    boatB: `${draftName(view.b)}${c.givenB ? ' (built for the learner)' : ''}`,
    changed: changed.length ? changed.map(p => PART_LABEL[p]).join(' and ') : 'nothing yet',
    prediction: view.prediction ? `guessed ${view.prediction === 'same' ? 'they carry the same' : `boat ${view.prediction.toUpperCase()} carries more`}` : 'no guess yet',
    inTank: view.launched && isBuilt(active)
      ? `boat ${view.active.toUpperCase()}, ${floatsWith(active, view.pennies) ? 'floating' : 'sunk'} with ${view.pennies} ${view.pennies === 1 ? 'penny' : 'pennies'} in it`
      : 'nothing',
    tests: view.tests.length ? view.tests.map(cargoTestLine).join('; ') : 'none yet',
    claim: view.claim ? `says ${view.claim === 'same' ? 'they carried the same' : `boat ${view.claim.toUpperCase()} carried more`}` : 'none yet',
    constraints: 'A lab notebook lists each boat\'s test. Changing a boat after its test clears that test.',
  };
  return { objects: [], facts };
}
