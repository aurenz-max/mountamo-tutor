/**
 * Levers as a boss mechanic (2026-10-18): a primitive declares each in-item lever once, by TYPE, with the content
 * it shows, and this module builds everything the runtime asks of levers from that one list — the levers offered on
 * an item (`declare`), the scene fact while one is pulled (`onScreen`), the practice item a simplify lever opens
 * (`simpler`) and, for the card, the lever ids by mode. Before, each primitive wrote those three as separate
 * switches over the same ids and listed the ids a fourth time on its boss.
 *
 * The type owns what is the same for every primitive: whether the lever helps or simplifies, its default carrier,
 * and for `clue` and `meaning` the leak rule (a lever whose words name the item's answer is not offered). The
 * primitive owns when it is offered and what it shows. `custom` is the escape hatch, and it must say why.
 *
 * Pure: the boss and the component import it, and nothing here renders.
 */
import type { WorkspaceLever } from './runtime/contract';
import { containsPhrase } from './spokenKey';

/**
 * - `model`: works a DIFFERENT item, solved, beside this one.
 * - `easier`: the same task one step simpler, opened as an ungraded practice item (the content is that item).
 * - `clue`: a hint about this item, in words that never name its answer.
 * - `meaning`: what each option or label means, never which one is right.
 * - `marks`: rings, dots or lines on what is already on screen.
 * - `layout`: the same things, arranged to be easier to see (rows of five).
 * - `custom`: anything else; `why` says what no stock type does.
 */
export type LeverType = 'model' | 'easier' | 'clue' | 'meaning' | 'marks' | 'layout' | 'custom';

const CARRIER: Record<LeverType, WorkspaceLever['carrier'] | null> = {
  model: 'both', easier: 'both', clue: 'both', meaning: 'both', marks: 'shown', layout: 'shown', custom: null,
};
/** The types whose words are checked against the item's answers. */
const WORDED: ReadonlySet<LeverType> = new Set<LeverType>(['clue', 'meaning']);

export interface LeverSpec<I, C> {
  id: string;
  type: LeverType;
  /** The eval modes it is offered in. Absent: every mode. */
  modes?: readonly string[];
  /** Default: the type's. Required on `custom`. */
  carrier?: WorkspaceLever['carrier'];
  /** The misses it is for (`TeachingAttempt.miss`); `'all'` is every miss of the item's mode. */
  answers: readonly string[] | 'all';
  /** When to pull it, in the tutor's terms. */
  when: string;
  /** What changes on screen when it is pulled. Never the answer. */
  does: string;
  /** What it shows on this item; null or undefined and it is not offered. Absent: it always shows the same thing. */
  content?: (item: I, ctx: C, lastMiss?: string) => unknown;
  /** A condition on the screen's state, beside having content ("a group already holds a card"). */
  offer?: (item: I, ctx: C, lastMiss?: string) => boolean;
  /** The scene fact while it is pulled, from its content. */
  fact?: string | ((content: any, item: I, ctx: C) => string);
  /** `custom` only: what no stock type does. */
  why?: string;
}

export interface LeverSetDef<I, C> {
  /** The item's eval mode. Absent: the set has one mode. */
  modeOf?: (item: I) => string;
  /** Every miss of a mode, for `answers: 'all'`. */
  missesOf: (mode: string) => readonly string[];
  /** The answers a `clue` or `meaning` lever must never name. Required when the set has one. */
  answersOf?: (item: I, ctx: C) => readonly string[];
  specs: readonly LeverSpec<I, C>[];
}

export interface LeverSet<I, C> {
  specs: readonly LeverSpec<I, C>[];
  /** The lever ids each mode can offer, in order (for the card and the tests). */
  idsFor: (mode: string) => string[];
  declare: (item: I | null, ctx: C, pulled: readonly string[], lastMiss?: string) => WorkspaceLever[];
  onScreen: (item: I | null, ctx: C, pulled: readonly string[]) => string;
  simpler: (item: I, ctx: C, lever: string, lastMiss?: string) => I | null;
  /** The three bound to one lesson's context, in the shape `DiTeachingStage` takes. */
  bind: (ctx: C) => {
    declare: (item: I, pulled: readonly string[], lastMiss?: string) => WorkspaceLever[];
    onScreen: (item: I, pulled: readonly string[]) => string;
    simpler: (item: I, lever: string, lastMiss?: string) => I | null;
  };
}

export const leverKind = (type: LeverType): WorkspaceLever['kind'] => (type === 'easier' ? 'simplify' : 'help');

export function leverSet<I, C>(def: LeverSetDef<I, C>): LeverSet<I, C> {
  const { specs } = def;
  const modeOf = def.modeOf ?? (() => '');
  const inMode = (spec: LeverSpec<I, C>, mode: string) => !spec.modes || spec.modes.includes(mode);
  const contentOf = (spec: LeverSpec<I, C>, item: I, ctx: C, lastMiss?: string) =>
    (spec.content ? spec.content(item, ctx, lastMiss) : true);
  const factOf = (spec: LeverSpec<I, C>, content: unknown, item: I, ctx: C) =>
    (typeof spec.fact === 'function' ? spec.fact(content, item, ctx) : spec.fact ?? '');
  const leaks = (spec: LeverSpec<I, C>, content: unknown, item: I, ctx: C) => {
    if (!WORDED.has(spec.type)) return false;
    const words = factOf(spec, content, item, ctx);
    return (def.answersOf?.(item, ctx) ?? []).some(answer => containsPhrase(words, answer));
  };

  const declare: LeverSet<I, C>['declare'] = (item, ctx, pulled, lastMiss) => {
    if (!item) return [];
    const mode = modeOf(item);
    return specs.flatMap(spec => {
      if (!inMode(spec, mode) || (spec.offer && !spec.offer(item, ctx, lastMiss))) return [];
      const content = contentOf(spec, item, ctx, lastMiss);
      if (content == null || content === false || leaks(spec, content, item, ctx)) return [];
      return [{ id: spec.id, kind: leverKind(spec.type), carrier: spec.carrier ?? CARRIER[spec.type] ?? 'both',
        pulled: pulled.includes(spec.id),
        answers: [...(spec.answers === 'all' ? def.missesOf(mode) : spec.answers)], when: spec.when, does: spec.does }];
    });
  };

  // A pulled lever's fact reads its content now, whatever `offer` says: what is on screen stays on screen.
  const onScreen: LeverSet<I, C>['onScreen'] = (item, ctx, pulled) => {
    if (!item) return '';
    const mode = modeOf(item);
    return specs.filter(spec => pulled.includes(spec.id) && inMode(spec, mode) && spec.fact).flatMap(spec => {
      const content = contentOf(spec, item, ctx);
      return content == null || content === false ? [] : [factOf(spec, content, item, ctx)];
    }).filter(Boolean).join(' ');
  };

  const simpler: LeverSet<I, C>['simpler'] = (item, ctx, lever, lastMiss) => {
    const spec = specs.find(s => s.id === lever && s.type === 'easier' && inMode(s, modeOf(item)));
    return (spec?.content?.(item, ctx, lastMiss) as I | null | undefined) ?? null;
  };

  return {
    specs, declare, onScreen, simpler,
    idsFor: mode => specs.filter(spec => inMode(spec, mode)).map(spec => spec.id),
    bind: ctx => ({
      declare: (item, pulled, lastMiss) => declare(item, ctx, pulled, lastMiss),
      onScreen: (item, pulled) => onScreen(item, ctx, pulled),
      simpler: (item, lever, lastMiss) => simpler(item, ctx, lever, lastMiss),
    }),
  };
}
