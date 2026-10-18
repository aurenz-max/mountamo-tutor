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
 * The common mechanics are presets, so a boss chooses its wiring instead of rebuilding it:
 *   - `SPOKEN` + `spokenBoss`: the learner says it, the tutor judges against a shared spoken key (`spokenKey.ts`);
 *   - `TAP_ONE` + `tapBoss`: the learner taps one choice, the activity's own check judges.
 * Everything else (a board, a build, a simulation) writes its `ask`, `assignment` and `drive` by hand.
 *
 * `boss.test.ts` checks every card and boss on disk against the catalog, the adapter, the journey and these rules.
 * Pure and free of React: the server route imports adapters, and the catalog imports cards.
 */
import type { AudioInputConfig, BossMode, BossModeWiring, BossWords, ComponentDefinition, EvalModeDefinition } from '../../types';
import type { DriverInput, JourneyContext, JourneyProbe } from './liveJourneySpec';
import type { TeachingAssignment } from './runtime/useTeachingWorkspace';
import type { KnownMiss } from './runtime/spokenMissContract';
import type { LeverSet } from './bossLevers';

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
/** A spoken pack brackets each learner turn itself. */
export const SPOKEN_AUDIO: AudioInputConfig = { manual_activity: true };

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
  drive: BossDrive<I>;
}

export const defineBoss = <D extends { title: string }, I, M extends string>(boss: Boss<D, I, M>): Boss<D, I, M> => boss;

/** A non-empty string: the field check every boss validator makes. */
export const hasText = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

type Drive<I> = Omit<BossDrive<I>, 'play'>;
type BossBase<D extends { title: string }, I, M extends string> = Pick<Boss<D, I, M>, 'card' | 'validate' | 'items' | 'levers'>;

/**
 * A spoken boss: every item is one spoken answer the tutor judges against its key; the `spoken_miss` observer
 * names known wrong answers. The primitive gives the ask, the key (`spokenKeyText`), its known misses, and the
 * harness's right and wrong answers; the assignment and the harness play come from here.
 */
export function spokenBoss<D extends { title: string }, I extends { id: string }, M extends string>(def: BossBase<D, I, M> & {
  speech: {
    ask: (item: I) => string;
    key: (item: I) => string;
    misses?: (item: I) => KnownMiss[];
    /** The journey's answers: the key's own words, or a plainly different answer of the same kind. */
    say: (item: I) => { correct: string; plainWrong: string };
    /** What the learner does on screen before there is anything to say (roll the dice), when it is not done yet. */
    before?: (item: I, ctx: JourneyContext) => DriverInput[];
  };
  drive: Drive<I>;
}): Boss<D, I, M> & Required<Pick<Boss<D, I, M>, 'assignment'>> {
  const { speech, drive, ...rest } = def;
  return {
    ...rest,
    preset: 'spoken',
    ask: speech.ask,
    assignment: item => {
      const misses = speech.misses?.(item) ?? [];
      return { id: item.id, task: speech.ask(item), response: 'speech', expectedAnswer: speech.key(item),
        ...(misses.length ? { misses } : {}) };
    },
    drive: { ...drive, play: (right, item, ctx) => {
      const answers = speech.say(item);
      return [...(speech.before?.(item, ctx) ?? []), { type: 'answer', text: right ? answers.correct : answers.plainWrong }];
    } },
  };
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
  };
  drive: Drive<I>;
}): Boss<D, I, M> & Required<Pick<Boss<D, I, M>, 'assignment'>> {
  const { choice, drive, ...rest } = def;
  return {
    ...rest,
    preset: 'tap',
    ask: choice.ask,
    assignment: item => ({ id: item.id, task: choice.ask(item), response: 'gesture' }),
    drive: { ...drive, play: (right, item, ctx) => {
      const targets = choice.targets(item, ctx.data as D);
      const target = right ? targets.correct : targets.wrong;
      if (!target) throw new Error(`${def.card.id}: no wrong choice to tap`);
      return [{ type: 'touch', target }];
    } },
  };
}

/** How the host judges this card, said once on mount: the sentences its modes' judges make true. */
export function bossInteraction(card: Card): string {
  const judges = new Set(Object.values(card.modes).flatMap(m => wiringsOf(m).map(w => w.wiring.judge)));
  return 'Teach from liveRuntime.task and its workspace. '
    + (judges.has('tutor') ? 'Judge spoken answers naturally; the host records your completed feedback and handles retry/advance. ' : '')
    + (judges.has('activity') ? 'The activity checks a placement or selection itself.' : '');
}

// ── The readable card ───────────────────────────────────────────────────────

const ANSWER_WORDS: Record<BossMode['answer'], string> = {
  tap: 'taps', build: 'builds', manipulate: 'moves', type: 'types', spoken: 'says',
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
        line('Judged by', w.judge === 'activity' ? 'ACTIVITY CHECK, in code; the tutor never sees the key' : 'TUTOR, from the learner\'s words, against the key in the task'),
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
