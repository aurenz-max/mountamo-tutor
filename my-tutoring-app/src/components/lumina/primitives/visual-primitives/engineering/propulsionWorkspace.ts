/**
 * propulsion-lab's domain: the items, their keys, checks and misses, and the scene. Its live wiring is
 * `propulsionLab.card.ts` + `propulsionLab.boss.ts` (SAY_OR_SHOW choices and an experiment board on the spoken preset).
 *
 * Every item is built and keyed by code. A craft carries one or two engines (jet engine, rocket engine, propeller, or a
 * sail); each engine points one way and has a size. An engine pushes the craft the opposite way from its blast
 * (Newton's third law); a sail goes the way the wind blows. A jet engine, a propeller and a sail need air; a rocket
 * engine carries everything it needs, so it also works in space. The craft's motion is the sum of the working pushes.
 * Each mode is a task:
 * - predict: a craft described and drawn with its engines off; the learner predicts what it does when they start.
 *   easy names how each engine works and that space has no air; medium leaves that to the learner and some engines are
 *   fixed on pointing forward; hard has two engines pointing opposite ways (equal, unequal, or one that cannot work).
 * - observe: a craft held by a clamp with its engines running; the learner reads what comes out of each engine and
 *   says which way the craft goes when the clamp lets go. easy is one stream; medium adds an engine with nothing coming
 *   out and two equal streams; hard is two opposite streams one unit apart or equal.
 * - experiment: a question (does a jet engine need air? which engine works in space? does more throttle push harder?);
 *   the learner sets up Test A and Test B (engine, place, throttle) and runs them. The check is the fair test: exactly
 *   the asked thing differs, on the asked engine or place, in a setup that can show a difference. easy has Test A set
 *   and locked; medium starts both tests the same on the wrong engine or place; hard starts them two changes apart or
 *   in a setup that cannot show the difference.
 * predict and observe are closed choices said aloud or tapped (J14); experiment is a gesture checked by code.
 *
 * Pure: the component, the generator, the boss and the tests read the same items, checks, misses and scene.
 */
import type { WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import { PROPULSION_MISSES } from './propulsionLab.card';

export type PropulsionMode = 'predict' | 'observe' | 'experiment';
export const PROPULSION_MODES: PropulsionMode[] = ['predict', 'observe', 'experiment'];
export type PropulsionTier = 'easy' | 'medium' | 'hard';

export type Engine = 'jet' | 'rocket' | 'propeller' | 'sail';
export const ENGINE_IDS: Engine[] = ['jet', 'rocket', 'propeller', 'sail'];
export type TestEngine = Exclude<Engine, 'sail'>;
export const TEST_ENGINES: TestEngine[] = ['jet', 'rocket', 'propeller'];
export type Place = 'air' | 'space';
export const PLACES: Place[] = ['air', 'space'];
export type Side = 'left' | 'right';
export type Throttle = 'low' | 'high';
export const THROTTLES: Throttle[] = ['low', 'high'];

export const ENGINES: Record<Engine, { label: string; button: string; how: string; needsAir: boolean }> = {
  jet: { label: 'jet engine', button: 'Jet engine', how: 'A jet engine sucks in air, burns fuel in it, and blasts the hot air out.', needsAir: true },
  rocket: { label: 'rocket engine', button: 'Rocket', how: 'A rocket engine carries its own fuel and the oxygen to burn it, and blasts the hot gas out.', needsAir: false },
  propeller: { label: 'propeller', button: 'Propeller', how: 'A propeller spins its blades to push air.', needsAir: true },
  sail: { label: 'sail', button: 'Sail', how: 'A sail catches the wind: blowing air that pushes on it.', needsAir: true },
};
export const PLACE_TEXT: Record<Place, { short: string; named: string; button: string }> = {
  air: { short: 'on a smooth track on Earth', named: 'on a smooth track on Earth, with air all around it', button: 'Air' },
  space: { short: 'in space', named: 'in space, where there is no air at all', button: 'Space' },
};
export const THROTTLE_TEXT: Record<Throttle, string> = { low: 'Low', high: 'High' };
/** A test engine's push in units, by throttle. */
export const THROTTLE_SIZE: Record<Throttle, number> = { low: 2, high: 4 };

export const works = (e: Engine, p: Place) => p === 'air' || !ENGINES[e].needsAir;

export const MOTIONS = ['Moves left', 'Moves right', 'Stays still'] as const;
export type Motion = typeof MOTIONS[number];

/** One engine on the craft. `blast` is the way it points its blast (for a sail: the way the wind blows). */
export interface Thruster { engine: Engine; blast: Side; size: number }
const other = (s: Side): Side => (s === 'left' ? 'right' : 'left');
/** The way a working engine pushes the craft: against its blast. A sail goes with the wind. */
export const pushOf = (t: Thruster): Side => (t.engine === 'sail' ? t.blast : other(t.blast));
/** The end of the craft an engine sits on: an engine pointing left sits at the back (the craft faces right). */
export const endOf = (t: Thruster): 'back' | 'front' => (t.blast === 'left' ? 'back' : 'front');

export function motionOf(place: Place, thrusters: Thruster[]): Motion {
  let net = 0;
  for (const t of thrusters) if (works(t.engine, place)) net += (pushOf(t) === 'right' ? 1 : -1) * t.size;
  return net > 0 ? 'Moves right' : net < 0 ? 'Moves left' : 'Stays still';
}

// ── Items ────────────────────────────────────────────────────────────────────────────────

export interface PredictItem { id: string; mode: 'predict'; place: Place; thrusters: Thruster[]; /** The ask says how each engine works and whether there is air. */ named: boolean }
export interface ObserveItem { id: string; mode: 'observe'; place: Place; thrusters: Thruster[] }
export interface Setup { engine: TestEngine; place: Place; throttle: Throttle }
export type Question =
  | { vary: 'place'; engine: TestEngine }
  | { vary: 'engine'; engines: [TestEngine, TestEngine]; place: Place }
  | { vary: 'throttle'; engine: TestEngine };
export interface ExperimentItem {
  id: string; mode: 'experiment';
  question: Question;
  start: { a: Setup; b: Setup };
  /** Test A is set and cannot be changed (easy). */
  lockA: boolean;
}
export type PropulsionItem = PredictItem | ObserveItem | ExperimentItem;
export type ChoiceItem = PredictItem | ObserveItem;

// ── Keys and checks ──────────────────────────────────────────────────────────────────────

export const keyOf = (item: ChoiceItem): Motion => motionOf(item.place, item.thrusters);

/** The learner's work: the choice, or the two tests. */
export interface PropulsionWork { choice: Motion | null; a: Setup; b: Setup }
const BLANK: Setup = { engine: 'rocket', place: 'air', throttle: 'low' };
export const emptyWork = (item: PropulsionItem | undefined): PropulsionWork => (item?.mode === 'experiment'
  ? { choice: null, a: { ...item.start.a }, b: { ...item.start.b } } : { choice: null, a: { ...BLANK }, b: { ...BLANK } });
export const workComplete = (item: PropulsionItem, w: PropulsionWork) => item.mode === 'experiment' || w.choice !== null;

const FIELDS: (keyof Setup)[] = ['engine', 'place', 'throttle'];
export const diffsOf = (a: Setup, b: Setup): (keyof Setup)[] => FIELDS.filter(f => a[f] !== b[f]);

/** The asked engine (or place) is the one tested. */
function subjectOk(q: Question, a: Setup, b: Setup): boolean {
  if (q.vary === 'engine') return a.place === q.place && b.place === q.place && [a.engine, b.engine].sort().join() === [...q.engines].sort().join();
  return a.engine === q.engine && b.engine === q.engine;
}

export function fairTest(item: ExperimentItem, a: Setup, b: Setup): boolean {
  const d = diffsOf(a, b);
  if (d.length !== 1 || d[0] !== item.question.vary || !subjectOk(item.question, a, b)) return false;
  return item.question.vary !== 'throttle' || works(a.engine, a.place);
}

export function propulsionCorrect(item: PropulsionItem | undefined, w: PropulsionWork): boolean {
  if (!item) return false;
  if (item.mode === 'experiment') return fairTest(item, w.a, w.b);
  return w.choice !== null && w.choice === keyOf(item);
}

export type ChoiceMiss = 'missed_cancel' | 'said_moves' | 'said_still' | 'wrong_way';
export type ExperimentMiss = 'same_tests' | 'changed_more_than_one' | 'changed_other' | 'wrong_subject' | 'cannot_show';
export type PropulsionMiss = ChoiceMiss | ExperimentMiss;
export { PROPULSION_MISSES };

/** Two or more working engines whose pushes cancel. */
const cancels = (item: ChoiceItem) => keyOf(item) === 'Stays still' && item.thrusters.filter(t => works(t.engine, item.place)).length >= 2;

/** The miss of one wrong choice. */
export function choiceMiss(item: ChoiceItem, chose: Motion): ChoiceMiss | undefined {
  const key = keyOf(item);
  if (chose === key) return undefined;
  if (key === 'Stays still') return cancels(item) ? 'missed_cancel' : 'said_moves';
  return chose === 'Stays still' ? 'said_still' : 'wrong_way';
}

export function experimentMiss(item: ExperimentItem, a: Setup, b: Setup): ExperimentMiss | undefined {
  if (fairTest(item, a, b)) return undefined;
  const d = diffsOf(a, b);
  if (!d.length) return 'same_tests';
  if (d.length > 1) return 'changed_more_than_one';
  if (d[0] !== item.question.vary) return 'changed_other';
  if (!subjectOk(item.question, a, b)) return 'wrong_subject';
  return 'cannot_show';
}

export function propulsionMiss(item: PropulsionItem | undefined, w: PropulsionWork): PropulsionMiss | undefined {
  if (!item || !workComplete(item, w)) return undefined;
  if (item.mode === 'experiment') return experimentMiss(item, w.a, w.b);
  return choiceMiss(item, w.choice!);
}

// ── The ask ──────────────────────────────────────────────────────────────────────────────

const article = (s: string) => (/^[aeiou]/i.test(s) ? 'an' : 'a');
const withArticle = (e: Engine) => `${article(ENGINES[e].label)} ${ENGINES[e].label}`;

/** The craft and its engines, as the ask states them. Never what the engines do to the craft. */
export function craftText(item: ChoiceItem): string {
  const ts = item.thrusters;
  if (ts.length === 1 && ts[0].engine === 'sail') {
    return item.place === 'air' ? 'It has a sail, and a wind blows toward the right.' : 'It has a sail, raised.';
  }
  const where = (t: Thruster) => (endOf(t) === 'back' ? 'at its back, aimed to blast out to the left' : 'at its front, aimed to blast out to the right');
  if (ts.length === 1) return `It has ${withArticle(ts[0].engine)} ${where(ts[0])}.`;
  const [x, y] = ts;
  const pair = x.engine === y.engine
    ? `It has two ${ENGINES[x.engine].label}s: one ${where(x)}, and one ${where(y)}.`
    : `It has two engines: ${withArticle(x.engine)} ${where(x)}, and ${withArticle(y.engine)} ${where(y)}.`;
  const size = x.size === y.size ? 'Both are the same size and equally powerful.'
    : `The one at its ${endOf(x.size > y.size ? x : y)} is bigger and more powerful.`;
  return `${pair} ${size}`;
}

const howText = (item: ChoiceItem) => Array.from(new Set(item.thrusters.map(t => ENGINES[t.engine].how))).join(' ');

export function questionText(q: Question): string {
  if (q.vary === 'place') return `Does ${withArticle(q.engine)} need air to push a craft along?`;
  if (q.vary === 'engine') return `${q.place === 'space' ? 'In space' : 'On Earth'}, which can push a craft along: ${withArticle(q.engines[0])} or ${withArticle(q.engines[1])}?`;
  return `Does ${withArticle(q.engine)} push a craft harder on high throttle than on low throttle?`;
}

export function askOf(item: PropulsionItem): string {
  if (item.mode === 'experiment') {
    const how = item.lockA ? 'Test A is set. Choose the engine, the place and the throttle for Test B'
      : 'Choose the engine, the place and the throttle for Test A and for Test B';
    return `${questionText(item.question)} Set up two tests that can answer it. ${how}, then press Run and check.`;
  }
  const place = item.mode === 'predict' && item.named ? PLACE_TEXT[item.place].named : PLACE_TEXT[item.place].short;
  const sail = item.thrusters[0]?.engine === 'sail';
  if (item.mode === 'predict') {
    const go = sail ? 'What does the craft do?' : `The ${item.thrusters.length > 1 ? 'engines are' : 'engine is'} switched on. What does the craft do?`;
    return `A small craft sits ${place}. ${craftText(item)}${item.named ? ` ${howText(item)}` : ''} ${go}`;
  }
  const many = item.thrusters.length > 1;
  return `A small craft is held by a clamp ${place}. ${craftText(item)} ${many ? 'Both engines are' : 'The engine is'} switched on. `
    + `Look at what comes out of ${many ? 'each engine' : 'it'}. When the clamp lets go, what does the craft do?`;
}

// ── Item space ───────────────────────────────────────────────────────────────────────────

export type Rng = () => number;
/** A seeded generator, so a lesson without stored items still builds the same items everywhere. */
export function seededRng(seed: string): Rng {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a += 0x6d2b79f5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const shuffle = <T,>(xs: T[], rng: Rng): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

const one = (engine: Engine, blast: Side, size = 3): Thruster => ({ engine, blast, size });

function predictCandidates(tier: PropulsionTier): PredictItem[] {
  const base = { id: '', mode: 'predict' as const };
  const out: PredictItem[] = [];
  if (tier !== 'hard') {
    for (const place of PLACES) for (const engine of ENGINE_IDS) {
      out.push({ ...base, place, thrusters: [one(engine, engine === 'sail' ? 'right' : 'left')], named: tier === 'easy' });
    }
    if (tier === 'medium') {
      // An engine fixed on pointing forward, where it works.
      for (const place of PLACES) for (const engine of TEST_ENGINES) if (works(engine, place)) out.push({ ...base, place, thrusters: [one(engine, 'right')], named: false });
    }
    return out;
  }
  // Two engines pointing opposite ways: equal, one bigger, or one that cannot work where the craft is.
  for (const place of PLACES) for (const back of TEST_ENGINES) for (const front of TEST_ENGINES) {
    for (const [bs, fs] of [[3, 3], [4, 2], [2, 4]] as Array<[number, number]>) {
      if (back !== front && bs !== fs) continue;
      out.push({ ...base, place, thrusters: [one(back, 'left', bs), one(front, 'right', fs)], named: false });
    }
  }
  return out;
}

function observeCandidates(tier: PropulsionTier): ObserveItem[] {
  const base = { id: '', mode: 'observe' as const };
  const out: ObserveItem[] = [];
  const singles = (sizes: number[]) => {
    for (const place of PLACES) for (const engine of TEST_ENGINES) for (const blast of ['left', 'right'] as Side[]) for (const size of sizes) {
      if (works(engine, place)) out.push({ ...base, place, thrusters: [one(engine, blast, size)] });
    }
  };
  if (tier === 'easy') { singles([3, 4, 5]); return out; }
  if (tier === 'medium') {
    singles([2, 3]);
    // An engine switched on with nothing coming out of it.
    for (const engine of ['jet', 'propeller'] as TestEngine[]) for (const blast of ['left', 'right'] as Side[]) out.push({ ...base, place: 'space', thrusters: [one(engine, blast, 3)] });
    // Two equal streams pointing opposite ways.
    for (const place of PLACES) for (const engine of TEST_ENGINES) if (works(engine, place)) for (const s of [3, 4]) {
      out.push({ ...base, place, thrusters: [one(engine, 'left', s), one(engine, 'right', s)] });
    }
    return out;
  }
  // hard: two opposite streams, equal or one unit apart.
  for (const place of PLACES) for (const back of TEST_ENGINES) for (const front of TEST_ENGINES) {
    if (!works(back, place) || !works(front, place)) continue;
    for (const [bs, fs] of [[3, 4], [4, 3], [5, 6], [6, 5], [4, 4], [5, 5]] as Array<[number, number]>) {
      out.push({ ...base, place, thrusters: [one(back, 'left', bs), one(front, 'right', fs)] });
    }
  }
  return out;
}

const otherEngine = (e: TestEngine): TestEngine => (e === 'propeller' ? 'jet' : e === 'jet' ? 'rocket' : 'propeller');
const otherPlace = (p: Place): Place => (p === 'air' ? 'space' : 'air');
/** Where an engine can show a throttle difference. */
const workingPlace = (_e: TestEngine): Place => 'air';

function experimentQuestions(): Question[] {
  return [
    ...TEST_ENGINES.map((engine): Question => ({ vary: 'place', engine })),
    { vary: 'engine', engines: ['rocket', 'jet'], place: 'space' },
    { vary: 'engine', engines: ['rocket', 'propeller'], place: 'space' },
    { vary: 'engine', engines: ['propeller', 'rocket'], place: 'space' },
    ...TEST_ENGINES.map((engine): Question => ({ vary: 'throttle', engine })),
  ];
}

/** The fair setup nearest a question's subject: Test A, and Test B with the asked thing changed. */
export function fairSetups(q: Question, throttle: Throttle = 'low'): { a: Setup; b: Setup } {
  if (q.vary === 'place') { const a: Setup = { engine: q.engine, place: 'air', throttle }; return { a, b: { ...a, place: 'space' } }; }
  if (q.vary === 'engine') { const a: Setup = { engine: q.engines[0], place: q.place, throttle }; return { a, b: { ...a, engine: q.engines[1] } }; }
  const a: Setup = { engine: q.engine, place: workingPlace(q.engine), throttle: 'low' };
  return { a, b: { ...a, throttle: 'high' } };
}

function experimentCandidates(tier: PropulsionTier): ExperimentItem[] {
  const base = { id: '', mode: 'experiment' as const };
  return experimentQuestions().map((question): ExperimentItem => {
    const fair = fairSetups(question);
    if (tier === 'easy') return { ...base, question, start: { a: fair.a, b: { ...fair.a } }, lockA: true };
    if (tier === 'medium') {
      // Both tests the same, on the wrong engine (or, for an engine question, the wrong place).
      const s: Setup = question.vary === 'engine' ? { ...fair.a, place: otherPlace(question.place) } : { ...fair.a, engine: otherEngine(question.engine) };
      return { ...base, question, start: { a: s, b: { ...s } }, lockA: false };
    }
    // hard: the tests start two or more changes apart, or (throttle) where the engine has nothing to push.
    if (question.vary === 'throttle') {
      const e = question.engine;
      return { ...base, question, lockA: false, start: e === 'rocket'
        ? { a: { engine: 'rocket', place: 'space', throttle: 'low' }, b: { engine: 'jet', place: 'space', throttle: 'high' } }
        : { a: { engine: e, place: 'space', throttle: 'low' }, b: { engine: e, place: 'space', throttle: 'high' } } };
    }
    return { ...base, question, lockA: false, start: { a: fair.a, b: { ...fair.b, throttle: 'high', ...(question.vary === 'place' ? { engine: otherEngine(question.engine) } : { place: otherPlace(question.place) }) } } };
  }).filter(i => !fairTest(i, i.start.a, i.start.b));
}

export const ITEM_COUNT: Record<PropulsionMode, [number, number]> = { predict: [4, 2], observe: [4, 2], experiment: [3, 2] };

const shapeKey = (i: PropulsionItem): string => i.mode === 'experiment' ? `${i.question.vary}:${JSON.stringify(i.question)}`
  : `${i.place}:${i.thrusters.map(t => `${t.engine}${t.blast}`).join('+')}:${keyOf(i)}`;
const keyGroup = (i: PropulsionItem): string => (i.mode === 'experiment' ? i.question.vary : keyOf(i));

/** The items of one mode at one tier: varied keys (or question kinds) first, then distinct shapes. */
export function buildModeItems(mode: PropulsionMode, tier: PropulsionTier, count: number, rng: Rng): PropulsionItem[] {
  const pool: PropulsionItem[] = shuffle<PropulsionItem>(mode === 'predict' ? predictCandidates(tier)
    : mode === 'observe' ? observeCandidates(tier) : experimentCandidates(tier), rng);
  const picked: PropulsionItem[] = [];
  const take = (i: PropulsionItem | undefined) => { if (i && picked.length < count && !picked.includes(i)) picked.push(i); };
  // The tier's defining shape first.
  if (mode === 'predict' && tier === 'hard') take(pool.find(i => i.mode === 'predict' && i.thrusters.some(t => !works(t.engine, i.place))));
  if (mode === 'predict' && tier === 'medium') take(pool.find(i => i.mode === 'predict' && i.thrusters[0].blast === 'right' && i.thrusters[0].engine !== 'sail'));
  if (mode === 'observe' && tier === 'medium') take(pool.find(i => i.mode === 'observe' && i.thrusters.length === 1 && !works(i.thrusters[0].engine, i.place)));
  if (mode === 'experiment' && tier === 'hard') take(pool.find(i => i.mode === 'experiment' && i.question.vary === 'throttle'));
  const groups = new Set(picked.map(keyGroup));
  for (const i of pool) if (!groups.has(keyGroup(i))) { take(i); groups.add(keyGroup(i)); }
  const shapes = new Set(picked.map(shapeKey));
  for (const i of pool) if (!shapes.has(shapeKey(i))) { take(i); shapes.add(shapeKey(i)); }
  for (const i of pool) take(i);
  return picked;
}

export function buildPropulsionItems(opts: { modes: PropulsionMode[]; tier: PropulsionTier; rng: Rng }): PropulsionItem[] {
  const out: PropulsionItem[] = [];
  for (const mode of opts.modes) out.push(...buildModeItems(mode, opts.tier, ITEM_COUNT[mode][opts.modes.length === 1 ? 0 : 1], opts.rng));
  return out.map((item, i) => ({ ...item, id: `${item.mode}-${i + 1}` }));
}

// ── Lesson data → items ──────────────────────────────────────────────────────────────────

export interface PropulsionItemsSource {
  title?: string;
  gradeBand?: string;
  challengeTypes?: string[];
  difficulty?: string;
  items?: PropulsionItem[];
  /** Legacy generations (before 2026-10-16): read only for their modes. */
  challenges?: Array<{ type?: string }>;
}

export const resolveTier = (d: PropulsionItemsSource): PropulsionTier => {
  const t = (d.difficulty ?? '').toLowerCase();
  return t === 'easy' || t === 'hard' ? t : 'medium';
};
/** The modes a lesson asks: its pin, else the legacy challenges' types, else by grade band. */
export function resolvePropulsionModes(d: PropulsionItemsSource): PropulsionMode[] {
  const asked = (d.challengeTypes ?? []).filter((m): m is PropulsionMode => (PROPULSION_MODES as string[]).includes(m));
  if (asked.length) return PROPULSION_MODES.filter(m => asked.includes(m));
  const legacy = (d.challenges ?? []).map(c => c?.type).filter((m): m is PropulsionMode => (PROPULSION_MODES as string[]).includes(m ?? ''));
  if (legacy.length) return PROPULSION_MODES.filter(m => legacy.includes(m));
  return d.gradeBand === '1-2' ? ['predict', 'observe'] : [...PROPULSION_MODES];
}

const validSetup = (s: Setup | undefined) => !!s && (TEST_ENGINES as string[]).includes(s.engine) && (PLACES as string[]).includes(s.place) && (THROTTLES as string[]).includes(s.throttle);
const validThruster = (t: Thruster | undefined) => !!t && (ENGINE_IDS as string[]).includes(t.engine) && (t.blast === 'left' || t.blast === 'right')
  && Number.isInteger(t.size) && t.size >= 1 && t.size <= 8;

/** False when a stored item is not one code could have built (its key would not be computable). */
export function validPropulsionItem(i: PropulsionItem | undefined): i is PropulsionItem {
  if (!i || typeof i.id !== 'string') return false;
  if (i.mode === 'predict' || i.mode === 'observe') {
    const ts = i.thrusters;
    if (!(PLACES as string[]).includes(i.place) || !Array.isArray(ts) || ts.length < 1 || ts.length > 2 || !ts.every(validThruster)) return false;
    // An observe item draws only engines with exhaust (no sail); two engines point opposite ways.
    if (i.mode === 'observe' && ts.some(t => t.engine === 'sail')) return false;
    return ts.length === 1 || (ts[0].blast !== ts[1].blast && !ts.some(t => t.engine === 'sail'));
  }
  if (i.mode === 'experiment') {
    const q = i.question;
    const qOk = !!q && (q.vary === 'engine'
      ? Array.isArray(q.engines) && q.engines.length === 2 && q.engines[0] !== q.engines[1] && q.engines.every(e => (TEST_ENGINES as string[]).includes(e)) && (PLACES as string[]).includes(q.place)
      : (q.vary === 'place' || q.vary === 'throttle') && (TEST_ENGINES as string[]).includes(q.engine));
    return qOk && !!i.start && validSetup(i.start.a) && validSetup(i.start.b) && !fairTest(i, i.start.a, i.start.b);
  }
  return false;
}

/** Every item of the session: the stored, code-built items when valid, else built from the lesson's own fields. */
export function propulsionItems(d: PropulsionItemsSource): PropulsionItem[] {
  const stored = Array.isArray(d.items) ? d.items.filter(validPropulsionItem) : [];
  if (stored.length && stored.length === (d.items ?? []).length) return stored;
  return buildPropulsionItems({ modes: resolvePropulsionModes(d), tier: resolveTier(d), rng: seededRng(`${d.title ?? 'propulsion'}:${resolveTier(d)}`) });
}

// ── The spoken key ───────────────────────────────────────────────────────────────────────

const ORDINAL = ['first', 'second', 'third'];
/** The ways a learner says each choice, beside the choice itself. */
const SAY: Record<Motion, readonly string[]> = {
  'Moves left': ['goes left'],
  'Moves right': ['goes right'],
  'Stays still': ['does not move', 'stays put', 'nothing happens'],
};
/** A way alone names a moving choice. Kept out of `alsoAccept`: the ask says "aimed to blast out to the left" by design. */
const WAY_ALONE: Partial<Record<Motion, string>> = {
  'Moves left': 'The way alone ("left", "to the left") names it too.',
  'Moves right': 'The way alone ("right", "to the right") names it too.',
};
const said = (m: Motion) => m.toLowerCase();

/**
 * The key a spoken reply is judged against: the motion, in any of its everyday wordings or by its place in the row.
 * The other choices are the signature error. An experiment item has no key: the activity checks the two tests.
 */
export function propulsionKey(item: PropulsionItem): SpokenKey | null {
  if (item.mode === 'experiment') return null;
  const key = keyOf(item), place = `the ${ORDINAL[MOTIONS.indexOf(key)]} one`;
  const others = MOTIONS.filter(c => c !== key).map(c => `"${said(c)}"`).join(', ');
  return { answer: said(key), alsoAccept: [...SAY[key], place],
    acceptRule: `${WAY_ALONE[key] ? `${WAY_ALONE[key]} ` : ''}Its place in the row ("${place}") names it too.`,
    signatureError: `${others} are wrong, and so is naming two or hedging between them.` };
}

/** How a learner says a choice item's work aloud (the harness's spoken answers). */
export const propulsionSaid = (w: PropulsionWork): string => (w.choice ? said(w.choice) : '');

const WHAT: Record<ChoiceMiss, string> = {
  missed_cancel: 'says the craft moves, though its working engines push equally hard opposite ways',
  said_moves: 'says the craft moves',
  said_still: 'says the craft stays still',
  wrong_way: 'says the craft moves the other way',
};

/** A spoken item's known wrong answers, most specific first, with the tap's miss ids. */
export function propulsionSpokenMisses(item: ChoiceItem): KnownMiss[] {
  const key = keyOf(item);
  const groups = new Map<ChoiceMiss, string[]>();
  for (const c of MOTIONS) if (c !== key) { const m = choiceMiss(item, c)!; groups.set(m, [...(groups.get(m) ?? []), c]); }
  const out: KnownMiss[] = [];
  for (const m of PROPULSION_MISSES[item.mode] as ChoiceMiss[]) {
    if (!groups.has(m)) continue;
    out.push({ id: m, pattern: `The right answer is "${key}". The learner's answer ${WHAT[m]}: ${groups.get(m)!.map(x => `"${x}"`).join(', ')}.`, examples: groups.get(m)! });
  }
  return out;
}

// ── Scene ────────────────────────────────────────────────────────────────────────────────

export interface PropulsionView {
  work: PropulsionWork;
  /** Choice items: credited, and the engines have been run on screen. */
  solved: boolean;
  /** Experiment: the two tests last run (after Run and check), credited or not. */
  ran: { a: Setup; b: Setup } | null;
}

export const setupText = (s: Setup) => `${ENGINES[s.engine].label}, ${s.place === 'air' ? 'air' : 'space'}, ${s.throttle} throttle`;
export const motionLower = (m: Motion) => m.toLowerCase();
const PLACE_DRAWN: Record<Place, string> = {
  air: 'on a track, with specks of air drifting all around it',
  space: 'among stars, with no specks of air anywhere',
};

/** What one test does when run: the craft moves right (fast or slowly), or stays still. */
export function testResult(s: Setup): string {
  if (!works(s.engine, s.place)) return 'the craft stays still: nothing comes out of the engine';
  return `the craft moves right, ${s.throttle === 'high' ? 'fast' : 'slowly'}`;
}

const engineDrawn = (t: Thruster) => (t.engine === 'sail' ? 'a sail' : `${withArticle(t.engine)} at its ${endOf(t)}, aimed to blast out to the ${t.blast}`);
const streamDrawn = (t: Thruster, place: Place) => (works(t.engine, place)
  ? `the ${ENGINES[t.engine].label} at its ${endOf(t)} blasts a stream ${t.size} units long out to the ${t.blast}`
  : `the ${ENGINES[t.engine].label} at its ${endOf(t)} is switched on, but nothing comes out of it`);

export function describePropulsionWork(item: PropulsionItem | undefined, w: PropulsionWork): string {
  if (!item) return 'Nothing chosen yet';
  if (item.mode === 'experiment') return `Test A: ${setupText(w.a)}. Test B: ${setupText(w.b)}.`;
  return w.choice ? `Chose "${w.choice}"` : 'Nothing chosen yet';
}

const LAYOUT_CHOICE = 'Nothing on screen names what the craft does; it holds still until the answer is credited.';

/** What this item's task forbids saying, beyond the shared rules (kept from the catalog's guidance before the boss). */
function neverSay(item: PropulsionItem): string {
  if (item.mode === 'predict') {
    return `Until it is credited, never say whether an engine can work where the craft is${item.named ? '' : ' or what it needs, whether there is air in space,'} `
      + 'or which way an engine pushes the craft, and never put two engines together ("both pushing equally", "the stronger '
      + 'one") or single out the bigger one. Ask about each engine in turn: which way it is aimed, and what it pushes out.';
  }
  if (item.mode === 'observe') {
    return 'Until it is credited, never say which way a stream pushes the craft, the rule that a craft goes the opposite way '
      + 'from its stream, or that two streams are equal or which is longer; ask what comes out of each engine and which way it leaves.';
  }
  return 'Never say which setting to change or keep, what should stay the same, that only one thing may differ ("just the '
    + 'throttle", "the one thing", "test only what the question asks"), or which engine, place or throttle to choose; after '
    + 'a run, ask what is different between the two tests and what the question asks about.';
}
const NEVER_EXPLAIN = 'After a miss, never say what the wrong choice came from. Describe a lever card only by what the scene '
  + 'says it shows, never as the conclusion.';

/** What is drawn and asked. Choices named, never which is right; the motion only once credited (or run). */
export function workspaceScene(item: PropulsionItem, view: PropulsionView): WorkspaceScene {
  const facts: Record<string, string> = { kind: item.mode, question: askOf(item) };
  if (item.mode === 'experiment') {
    facts.controls = `Test A and Test B each have engine buttons (Jet engine, Rocket, Propeller), place buttons (Air, Space) and throttle buttons (Low, High).${item.lockA ? ' Test A is locked.' : ''}`;
    facts.shown = 'Two tracks, one per test, each with a craft standing still until the tests are run.';
    if (view.ran) facts.run = `The learner ran the tests. Test A (${setupText(view.ran.a)}): ${testResult(view.ran.a)}. Test B (${setupText(view.ran.b)}): ${testResult(view.ran.b)}.`;
  } else {
    facts.choices = MOTIONS.map((c, i) => `${i + 1}) ${c}`).join('  ');
    if (item.mode === 'predict') {
      facts.shown = `The craft drawn ${PLACE_DRAWN[item.place]}, with ${item.thrusters.map(engineDrawn).join(' and ')}${item.thrusters[0].engine === 'sail' && item.place === 'air' ? ', and wind drawn blowing to the right' : ''}. Nothing has been switched on yet.`;
      if (view.solved) facts.run = `The engines have been run on screen: the craft ${motionLower(keyOf(item))}.`;
    } else {
      facts.shown = `The craft held by a clamp ${PLACE_DRAWN[item.place]}. ${item.thrusters.map(t => streamDrawn(t, item.place)).join('; ')}.`.replace('. the', '. The');
      if (view.solved) facts.run = `The clamp has let go on screen: the craft ${motionLower(keyOf(item))}.`;
    }
  }
  facts.learnerWork = describePropulsionWork(item, view.work);
  if (item.mode !== 'experiment') facts.layout = LAYOUT_CHOICE;
  facts.constraints = neverSay(item);
  facts.neverSay = NEVER_EXPLAIN;
  return { objects: [], facts };
}

// ── The harness's learner (the boss's drive, the dry sweep) ───────────────────────────

/** The journey's answers: the key, and a wrong answer showing the mode's first-listed miss it can. */
export function propulsionHarnessAnswers(item: PropulsionItem): { correct: PropulsionWork; plainWrong: PropulsionWork } {
  const work = emptyWork(item);
  if (item.mode === 'experiment') {
    const fair = item.lockA ? { a: item.start.a, b: varyOf(item.question, item.start.a) } : fairSetups(item.question);
    // One change too many: the asked thing and the throttle (or, on a throttle question, the place).
    const extra: Partial<Setup> = item.question.vary === 'throttle' ? { place: otherPlace(fair.b.place) } : { throttle: fair.b.throttle === 'low' ? 'high' : 'low' };
    return { correct: { ...work, a: fair.a, b: fair.b }, plainWrong: { ...work, a: fair.a, b: { ...fair.b, ...extra } } };
  }
  const key = keyOf(item);
  const rank = PROPULSION_MISSES[item.mode];
  const wrongs = MOTIONS.filter(c => c !== key).sort((x, y) => rank.indexOf(choiceMiss(item, x)!) - rank.indexOf(choiceMiss(item, y)!));
  return { correct: { ...work, choice: key }, plainWrong: { ...work, choice: wrongs[0] } };
}

/** Test B as Test A with the asked thing changed. */
export function varyOf(q: Question, a: Setup): Setup {
  if (q.vary === 'place') return { ...a, place: otherPlace(a.place) };
  if (q.vary === 'throttle') return { ...a, throttle: a.throttle === 'low' ? 'high' : 'low' };
  return { ...a, engine: a.engine === q.engines[0] ? q.engines[1] : q.engines[0] };
}

const BUTTON: Record<keyof Setup, (s: Setup) => string> = {
  engine: s => ENGINES[s.engine].button, place: s => PLACE_TEXT[s.place].button, throttle: s => THROTTLE_TEXT[s.throttle],
};
/** A test's button label, unique on screen ("Test B: Space"). */
export const testButton = (test: 'A' | 'B', label: string) => `Test ${test}: ${label}`;

/** The button presses that take the tests from their start to a target. */
export function pressesTo(from: { a: Setup; b: Setup }, to: { a: Setup; b: Setup }): string[] {
  const out: string[] = [];
  for (const [test, f, t] of [['A', from.a, to.a], ['B', from.b, to.b]] as Array<['A' | 'B', Setup, Setup]>) {
    for (const field of FIELDS) if (f[field] !== t[field]) out.push(testButton(test, BUTTON[field](t)));
  }
  return out;
}
