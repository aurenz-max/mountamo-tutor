/**
 * The boss framework: one primitive's whole wiring to the live tutor, in the same shape for every primitive
 * (2026-10-18). Two files beside the component:
 *
 *   `<name>.card.ts`  the CARD — facts only: how each mode is answered and judged, its misses, the words the shared
 *                     rules are filled with, the microphone. The catalog reads it (`bossEntry`), so it imports
 *                     nothing but other cards and this module (boss.test.ts holds that, to keep the catalog light).
 *   `<name>.boss.ts`  the BOSS — behavior: validate generated content, list the items, ask one, the levers
 *                     (`bossLevers.ts`), and how the journey harness plays it. The live adapter (`bossAdapter`), the
 *                     journey row (`bossJourney`) and the component read it.
 *
 * The rotation is the same for every boss: ask one item, the learner answers, the judge the card names checks it,
 * the host retries or advances, levers help. A card mode states its variant as values (`answer`, `judge`, `flow`,
 * `moves`); no mode needs its own wiring. Every item's assignment comes from `bossAssignment`: a spoken key, or none
 * (a gesture the activity checks). The presets build a boss from that:
 *   - `spokenBoss`: items with a key are said and the tutor judges them (`SPOKEN`, or `SAY_OR_SHOW` when a gesture
 *     also counts); items with no key are shown and the activity checks them, so one boss mixes both;
 *   - `tapBoss`: the learner taps one choice (optionally then a commit button), the activity's own check judges.
 * A board's component builds its own gesture assignment; its boss gives only content, the ask and the harness moves.
 *
 * `boss.test.ts` checks every card and boss on disk against the catalog, the adapter, the journey and these rules.
 * Pure and free of React: the server route imports adapters, and the catalog imports cards.
 */
import type { AudioInputConfig, BossMode, BossModeWiring, BossWords, ComponentDefinition, EvalModeDefinition } from '../../types';
import type { DriverInput, JourneyContext, JourneyProbe } from './liveJourneySpec';
import type { TeachingAssignment } from './runtime/useTeachingWorkspace';
import type { KnownMiss, OffByMiss } from './runtime/spokenMissContract';
import type { LeverSet } from './bossLevers';
import { askLeaks, spokenKeyText, type SpokenKey } from './spokenKey';

// ── The card ────────────────────────────────────────────────────────────────

/** One eval mode on the card: how it is wired (every item alike, or by step), and the misses its judges name. */
export type CardMode<M extends string = string> = BossModeWiring & {
  /** What a wrong answer shows (`TeachingAttempt.miss`), as the check or the spoken-miss observer names it. On a
   *  stepped mode, the misses of every step. */
  misses: readonly M[];
  /** Misses no lever answers, each by decision (journey sweep J9). */
  unanswered?: readonly M[];
  /** A spoken mode whose wrong answers are recorded from the learner's words (`missFromWords`, RP-2). */
  missFromWords?: true;
};

/** A mode's wirings: one with no step name, or one per step. Every reader of a card's wiring goes through this. */
export function wiringsOf(mode: BossModeWiring): Array<{ step?: string; wiring: BossMode }> {
  if ('steps' in mode) return Object.entries(mode.steps).map(([step, wiring]) => ({ step, wiring }));
  const { answer, judge, flow, moves } = mode;
  return [{ wiring: { answer, judge, flow, ...(moves ? { moves } : {}) } }];
}

export interface Card<M extends string = string> {
  id: string;
  grades: readonly string[];
  /** Keyed by the catalog's eval modes, every one of them. */
  modes: Readonly<Record<string, CardMode<M>>>;
  words: BossWords;
  /** Microphone settings for the session. */
  audio?: AudioInputConfig;
  /** The boss declares in-item levers (`bossLevers.ts`); the guidance then carries `LEVER_DOCTRINE`. */
  levers?: true;
}

export const defineCard = <M extends string>(card: Card<M>): Card<M> => card;

/** Wiring presets for a card mode. */
export const SPOKEN = { answer: 'spoken', judge: 'tutor', flow: 'one-at-a-time' } as const satisfies BossMode;
export const TAP_ONE = { answer: 'tap', judge: 'activity', flow: 'one-at-a-time' } as const satisfies BossMode;
/** The learner says it or shows it on screen: the tutor judges the words, the activity checks the gesture. */
export const SAY_OR_SHOW = { answer: 'spoken', judge: 'either', flow: 'one-at-a-time' } as const satisfies BossMode;
/** A spoken pack brackets each learner turn itself. */
export const SPOKEN_AUDIO: AudioInputConfig = { manual_activity: true };

/** The four off-by misses of a counted spoken answer (`offByMisses`), for cards and lever sets to spread. */
export const OFF_BY = ['one_short', 'one_over', 'short_by_more', 'over_by_more'] as const satisfies readonly OffByMiss[];

/** The catalog fields a card owns: spread into the catalog entry as `...bossEntry(card)`. */
export function bossEntry(card: Card): Pick<ComponentDefinition, 'teachingWorkspace' | 'audioInput'> {
  return { teachingWorkspace: bossWorkspace(card), ...(card.audio ? { audioInput: card.audio } : {}) };
}

/** The catalog's `teachingWorkspace`, built from the card. */
export function bossWorkspace(card: Card): NonNullable<ComponentDefinition['teachingWorkspace']> {
  const modes = Object.entries(card.modes);
  const byMode = <V>(pick: (m: CardMode) => V | undefined) =>
    Object.fromEntries(modes.flatMap(([k, m]) => { const v = pick(m); return v ? [[k, v]] : []; }));
  const misses = byMode(m => (m.misses.length ? m.misses : undefined));
  const unanswered = byMode(m => (m.unanswered?.length ? m.unanswered : undefined));
  const fromWords = modes.filter(([, m]) => m.missFromWords).map(([k]) => k);
  return {
    // Everything but the judge's miss lists is wiring the doctrine reads.
    card: { modes: Object.fromEntries(modes.map(([k, { misses: _m, unanswered: _u, missFromWords: _w, ...wiring }]) =>
      [k, wiring])), words: card.words },
    grades: card.grades,
    ...(card.levers ? { levers: true as const } : {}),
    ...(Object.keys(misses).length ? { misses } : {}),
    ...(Object.keys(unanswered).length ? { unanswered } : {}),
    ...(fromWords.length ? { missFromWords: fromWords } : {}),
  };
}

// ── The boss ────────────────────────────────────────────────────────────────

/** How the journey harness plays this boss: a right or a wrong answer on the current item, as real learner input. */
export interface BossDrive<I = any> {
  /** Module path under `src/components/lumina/`. */
  component: string;
  instanceId: string;
  defaults: { grade: string; mode: string; topic: string };
  /** The element present once the primitive has mounted. */
  mounted: string;
  probes?: Record<string, JourneyProbe>;
  /** Tags the tutor must never say aloud (the component's legacy cue names). */
  leakTokens?: readonly string[];
  /** The current item, when it is not one of `items(data)` by id (an easier practice item rebuilt from its parent). */
  current?: (ctx: JourneyContext) => I | undefined;
  play: (right: boolean, item: I, ctx: JourneyContext) => DriverInput[];
}

export interface Boss<D extends { title: string } = any, I = any, M extends string = string> {
  card: Card<M>;
  /** The preset it is built on; absent for a bespoke boss. */
  preset?: 'spoken' | 'tap';
  /** Reject generated content this primitive cannot run. */
  validate: (value: unknown) => D;
  /** The graded items of one lesson, in order: a card, a board, a spoken ask. */
  items: (data: D) => readonly I[];
  /** What the learner is asked on one item. Never the answer. */
  ask: (item: I, data: D) => string;
  /** The workspace assignment of one item. Set by a preset; a bespoke component builds its own. */
  assignment?: (item: I) => TeachingAssignment;
  /** The in-item levers, declared by type (`bossLevers.ts`). */
  levers?: LeverSet<I, any>;
  /** On a card with stepped modes, the step an item is (its scene's `kind`). Required there (boss.test.ts). */
  stepOf?: (item: I) => string;
  /** Required on a boss with spoken items (boss.test.ts): each item's key, so no ask can say its answer. */
  spoken?: BossSpeech<I>;
  drive: BossDrive<I>;
}

/** The keys of a boss's spoken items, which `validate` checks against each ask (`askLeaks`). */
export interface BossSpeech<I> {
  /** The item's key; null for an item that is not spoken (a placing step, a build). */
  key: (item: I) => SpokenKey | null;
  /** What the ask says by design, which may contain the answer: a fact's operands ("zero plus three"). */
  given?: (item: I) => readonly string[];
}

/** Every spoken item whose ask fails `askLeaks`, as a sentence each. */
export function spokenLeaksOf<D extends { title: string }, I>(boss: Pick<Boss<D, I>, 'items' | 'ask' | 'spoken'>, data: D): string[] {
  const { spoken } = boss;
  if (!spoken) return [];
  return boss.items(data).flatMap(item => {
    const key = spoken.key(item);
    return key ? askLeaks(boss.ask(item, data), key, spoken.given?.(item) ?? [])
      .map(problem => `item ${(item as { id?: string }).id}: the ask ${problem}`) : [];
  });
}

/** A boss. With `spoken`, its `validate` also rejects content whose ask says a spoken item's answer. */
export function defineBoss<D extends { title: string }, I, M extends string>(boss: Boss<D, I, M>): Boss<D, I, M> {
  if (!boss.spoken) return boss;
  const { validate } = boss;
  return { ...boss, validate: value => {
    const data = validate(value);
    const leaks = spokenLeaksOf(boss, data);
    if (leaks.length) throw new Error(`${boss.card.id}: ${leaks.join('; ')}`);
    return data;
  } };
}

/** The one spoken assignment: the ask, the key as the judge reads it (`spokenKeyText`), and the known misses. */
export function spokenAssignment(id: string, task: string, key: SpokenKey, misses: readonly KnownMiss[] = []): TeachingAssignment {
  return { id, task, response: 'speech', expectedAnswer: spokenKeyText(key), ...(misses.length ? { misses: [...misses] } : {}) };
}

/**
 * The one assignment every boss item gets: with a key, a spoken answer the tutor judges (`orShow`: a gesture is also
 * accepted, a SAY_OR_SHOW mode); with none, a gesture the activity checks (a tap, a build, a board).
 */
export function bossAssignment(id: string, task: string, key: SpokenKey | null, misses: readonly KnownMiss[] = [],
  orShow = false): TeachingAssignment {
  if (!key) return { id, task, response: 'gesture' };
  return { ...spokenAssignment(id, task, key, misses), ...(orShow ? { acceptsGesture: true } : {}) };
}

/** A non-empty string: the field check every boss validator makes. */
export const hasText = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

type Drive<I> = Omit<BossDrive<I>, 'play'>;
type BossBase<D extends { title: string }, I, M extends string> = Pick<Boss<D, I, M>, 'card' | 'validate' | 'items' | 'levers'>;

/**
 * A spoken boss: each item is a spoken answer the tutor judges against its key; the `spoken_miss` observer names
 * known wrong answers. An item with no key is answered on screen and the activity checks it (di-shapes' build in a
 * spoken lesson), and a SAY_OR_SHOW mode's items also take the answer shown. The primitive gives the ask, the key (a
 * `SpokenKey`; the preset writes its text), what the ask says by design (`given`), its known misses, and the harness's
 * answers; the assignment (`bossAssignment`), the harness play and the ask-leak check on `validate` come from here.
 */
export function spokenBoss<D extends { title: string }, I extends { id: string }, M extends string>(def: BossBase<D, I, M> & {
  speech: {
    ask: (item: I) => string;
    /** The item's key; null on an item answered on screen, which then needs `show`. */
    key: (item: I) => SpokenKey | null;
    /** What the ask says by design, which may contain the answer (`BossSpeech.given`). */
    given?: (item: I) => readonly string[];
    misses?: (item: I) => KnownMiss[];
    /** The journey's answers: the key's own words, or a plainly different answer of the same kind. */
    say: (item: I) => { correct: string; plainWrong: string };
    /** The journey's moves on an item with no key, as real learner input. Required when `key` can return null. */
    show?: (right: boolean, item: I, ctx: JourneyContext) => DriverInput[];
    /** What the learner does on screen before there is anything to say (roll the dice), when it is not done yet. */
    before?: (item: I, ctx: JourneyContext) => DriverInput[];
    /** The item's eval mode. Required when the card has several modes and one of them is SAY_OR_SHOW. */
    modeOf?: (item: I) => string;
  };
  drive: Drive<I>;
}): Boss<D, I, M> & Required<Pick<Boss<D, I, M>, 'assignment'>> {
  const { speech, drive, ...rest } = def;
  const modes = Object.entries(def.card.modes);
  const either = new Set(modes.filter(([, m]) => !('steps' in m) && m.judge === 'either').map(([k]) => k));
  if (either.size && modes.length > 1 && !speech.modeOf)
    throw new Error(`${def.card.id}: a SAY_OR_SHOW mode beside other modes needs speech.modeOf`);
  const orShow = (item: I) => either.has(speech.modeOf?.(item) ?? modes[0][0]);
  const assignment = (item: I) =>
    bossAssignment(item.id, speech.ask(item), speech.key(item), speech.misses?.(item), orShow(item));
  return { ...defineBoss<D, I, M>({
    ...rest,
    preset: 'spoken',
    ask: speech.ask,
    spoken: { key: speech.key, ...(speech.given ? { given: speech.given } : {}) },
    drive: { ...drive, play: (right, item, ctx) => {
      if (!speech.key(item)) {
        if (!speech.show) throw new Error(`${def.card.id}: item ${item.id} has no key, so the boss needs speech.show`);
        return speech.show(right, item, ctx);
      }
      const answers = speech.say(item);
      return [...(speech.before?.(item, ctx) ?? []), { type: 'answer', text: right ? answers.correct : answers.plainWrong }];
    } },
  }), assignment };
}

/**
 * A tap boss: every item is one choice the learner taps, and the activity's own check judges it (the tutor never
 * sees the key). The primitive gives the ask and the harness's right and wrong targets.
 */
export function tapBoss<D extends { title: string }, I extends { id: string }, M extends string>(def: BossBase<D, I, M> & {
  choice: {
    ask: (item: I) => string;
    /** The journey's taps: the right target, and a wrong one (null when there is none). */
    targets: (item: I, data: D) => { correct: string; wrong: string | null };
    /** The button pressed after the tap to commit it ("Check"), when the activity has one. Name it in the card's `moves`. */
    commit?: string;
  };
  drive: Drive<I>;
}): Boss<D, I, M> & Required<Pick<Boss<D, I, M>, 'assignment'>> {
  const { choice, drive, ...rest } = def;
  return {
    ...rest,
    preset: 'tap',
    ask: choice.ask,
    assignment: item => bossAssignment(item.id, choice.ask(item), null),
    drive: { ...drive, play: (right, item, ctx) => {
      const targets = choice.targets(item, ctx.data as D);
      const target = right ? targets.correct : targets.wrong;
      if (!target) throw new Error(`${def.card.id}: no wrong choice to tap`);
      return [{ type: 'touch', target }, ...(choice.commit ? [{ type: 'choose' as const, label: choice.commit }] : [])];
    } },
  };
}

/** How the host judges this card, said once on mount: the sentences its modes' judges make true. */
export function bossInteraction(card: Card): string {
  const judges = new Set(Object.values(card.modes).flatMap(m => wiringsOf(m).map(w => w.wiring.judge)));
  return 'Teach from liveRuntime.task and its workspace. '
    + (judges.has('tutor') || judges.has('either') ? 'Judge spoken answers naturally; the host records your completed feedback and handles retry/advance. ' : '')
    + (judges.has('activity') || judges.has('either') ? 'The activity checks a placement or selection itself.' : '');
}

// ── The readable card ───────────────────────────────────────────────────────

const ANSWER_WORDS: Record<BossMode['answer'], string> = {
  tap: 'taps', build: 'builds', manipulate: 'moves', type: 'types', spoken: 'says',
};
const JUDGE_WORDS: Record<BossMode['judge'], string> = {
  activity: 'ACTIVITY CHECK, in code; the tutor never sees the key',
  tutor: 'TUTOR, from the learner\'s words, against the key in the task',
  either: 'TUTOR for words against the key, or ACTIVITY CHECK for an answer shown on screen',
};

/**
 * The card a person reads to see how this boss is wired. Built from the same objects the tutor's guidance and the
 * levers are, so it cannot drift from what runs. `evalModes` adds the labels and β priors from the catalog.
 */
export function renderBoss(boss: Boss, evalModes: readonly EvalModeDefinition[] = []): string {
  const { card } = boss;
  const line = (label: string, value: string) => `  ${label.padEnd(20)}${value}`;
  const out = [`BOSS ${card.id}`, `  grades ${card.grades.join(', ')}`,
    `  preset ${boss.preset ?? 'bespoke'}`, ''];
  for (const [mode, m] of Object.entries(card.modes)) {
    const def = evalModes.find(e => e.evalMode === mode);
    const levers = boss.levers?.specs.filter(s => !s.modes || s.modes.includes(mode)).map(s => `${s.id} (${s.type})`) ?? [];
    out.push(`MODE ${mode}${def ? ` · ${def.label} · β ${def.beta}` : ''}`,
      ...wiringsOf(m).flatMap(({ step, wiring: w }) => [
        ...(step ? [line(`Step ${step}`, '')] : []),
        line('Learner answers', `${w.answer.toUpperCase()} (the learner ${ANSWER_WORDS[w.answer]} it)`),
        ...(w.moves ? [line('Moves', w.moves)] : []),
        line('Judged by', JUDGE_WORDS[w.judge]),
        line('Item flow', w.flow === 'board' ? 'a board of parts, checked together' : 'one item at a time')]),
      line('Levers', levers.length ? levers.join(', ') : card.levers ? 'declared in the component (not on the boss yet)' : 'none'),
      line('Misses it names', m.misses.length ? m.misses.join(', ') : 'none'),
      ...(m.unanswered?.length ? [line('No lever answers', m.unanswered.join(', '))] : []),
      ...(m.missFromWords ? [line('Misses from speech', 'yes: a named wrong answer is recorded from the learner\'s words')] : []),
      '');
  }
  out.push('SESSION',
    line('Microphone', card.audio ? (card.audio.manual_activity ? 'manual turns (the surface brackets each answer)' : JSON.stringify(card.audio)) : 'default'),
    line('Harness', `${boss.drive.component} · mounted ${boss.drive.mounted}`),
    '',
    'WORDS',
    line('Job', card.words.job),
    line('Judged (never said)', card.words.answer),
    line('Question (said)', card.words.question),
    ...(card.words.special ? [line('Special', card.words.special)] : []));
  return out.join('\n');
}
