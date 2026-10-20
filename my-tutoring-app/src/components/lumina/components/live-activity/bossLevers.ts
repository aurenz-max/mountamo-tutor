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
import type { WorkspaceScene } from './runtime/useTeachingWorkspace';
import { containsPhrase } from './spokenKey';
import { supportFact, type SupportTier } from './supportFact';

/**
 * - `model`: works a DIFFERENT item, solved, beside this one.
 * - `easier`: the same task one step simpler, opened as an ungraded practice item (the content is that item).
 * - `clue`: a hint about this item, in words that never name its answer.
 * - `meaning`: what each option or label means, never which one is right.
 * - `marks`: rings, dots or lines on what is already on screen.
 * - `layout`: the same things, arranged to be easier to see (rows of five).
 * - `legend`: a key or reference that names EVERY choice alike, none marked (a litmus key, the timeline read before).
 *   Not leak-checked: naming every choice is what it is, so it never singles out the answer.
 * - `custom`: anything else; `why` says what no stock type does.
 */
export type LeverType = 'model' | 'easier' | 'clue' | 'meaning' | 'marks' | 'layout' | 'legend' | 'custom';

const CARRIER: Record<LeverType, WorkspaceLever['carrier'] | null> = {
  model: 'both', easier: 'both', clue: 'both', meaning: 'both', marks: 'shown', layout: 'shown', legend: 'shown', custom: null,
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
  /** The misses it answers on this item, when they differ by item within one mode: kept from `answers`, which stays
   *  the mode's whole list (the card and the guards read it). */
  answersOn?: (item: I, ctx: C) => readonly string[];
  /** When to pull it, in the tutor's terms. A function when the words differ by item within one mode. */
  when: string | ((item: I, ctx: C) => string);
  /** What changes on screen when it is pulled. Never the answer. A function when the words differ by item within one
   *  mode (a decodable word is sounded out, a sight word said whole). */
  does: string | ((item: I, ctx: C) => string);
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
  /** When the model lever comes, by tier. Required when the set has a `model` lever: `leverSet` throws without it. */
  support?: LeverSupport<I>;
  specs: readonly LeverSpec<I, C>[];
}

/**
 * The words the `support` scene fact needs; `supportFact` writes the sentence and names the item's model lever.
 * A scene never writes `support` itself: `leverScene` adds it, and throws on a scene that already has it.
 */
export interface LeverSupport<I> {
  /** The item's tier, with the pack's default when it has none. */
  tier: (item: I) => SupportTier;
  /** What the model card shows: "a different fact". */
  different: string | ((item: I) => string);
  /** What is never said before a try at the cold tier: "this fact's answer". */
  own: string | ((item: I) => string);
}

/** The facts a lever set owns. A scene that writes one of them fails (`leverScene`). */
const LEVER_FACTS = ['support', 'onScreen'] as const;
/** A primitive's scene: every fact except the ones its lever set writes. */
export type SceneOf = WorkspaceScene & { facts: { support?: never; onScreen?: never } };

export interface LeverSet<I, C> {
  specs: readonly LeverSpec<I, C>[];
  /**
   * The `support` scene fact for an item: when its model lever comes (`supportFact`). '' when the item's mode has no
   * model lever. Given the lesson context (every production caller passes the one it gives `declare`), only a model
   * lever OFFERED on this item counts: '' when none is, and the lever is named only when exactly one is. Without ctx
   * (tests only) every model lever in the item's mode counts.
   */
  support: (item: I | null, ctx?: C, lastMiss?: string) => string;
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
    support: (item: I, lastMiss?: string) => string;
  };
}

/**
 * The scene the tutor reads: the primitive's scene plus the facts the lever set owns. The one way a boss mount
 * publishes a scene with levers (`DiTeachingStage`, a bespoke component): a scene that writes `support` or `onScreen`
 * itself throws, so the mode fails instead of teaching from a hand-written tier rule.
 */
export function leverScene(scene: WorkspaceScene, owned: { support: string; onScreen: string }): WorkspaceScene {
  const written = LEVER_FACTS.filter(key => key in (scene.facts ?? {}));
  if (written.length) throw new Error(`A scene wrote ${written.join(', ')}: the lever set writes it (leverScene). `
    + 'Declare `support` on the lever set and delete the fact from the scene.');
  return { ...scene, facts: { ...scene.facts,
    ...(owned.support ? { support: owned.support } : {}), ...(owned.onScreen ? { onScreen: owned.onScreen } : {}) } };
}

export const leverKind = (type: LeverType): WorkspaceLever['kind'] => (type === 'easier' ? 'simplify' : 'help');

export function leverSet<I, C>(def: LeverSetDef<I, C>): LeverSet<I, C> {
  const { specs } = def;
  const modeOf = def.modeOf ?? (() => '');
  const inMode = (spec: LeverSpec<I, C>, mode: string) => !spec.modes || spec.modes.includes(mode);
  const models = specs.filter(spec => spec.type === 'model');
  if (models.length && !def.support) {
    throw new Error(`leverSet: ${models.map(s => s.id).join(', ')} is a model lever, so the set declares \`support\` `
      + '(tier, different, own); supportFact writes when it comes. No scene writes that rule by hand.');
  }

  const contentOf = (spec: LeverSpec<I, C>, item: I, ctx: C, lastMiss?: string) =>
    (spec.content ? spec.content(item, ctx, lastMiss) : true);
  const factOf = (spec: LeverSpec<I, C>, content: unknown, item: I, ctx: C) =>
    (typeof spec.fact === 'function' ? spec.fact(content, item, ctx) : spec.fact ?? '');
  const leaks = (spec: LeverSpec<I, C>, content: unknown, item: I, ctx: C) => {
    if (!WORDED.has(spec.type)) return false;
    const words = factOf(spec, content, item, ctx);
    return (def.answersOf?.(item, ctx) ?? []).some(answer => containsPhrase(words, answer));
  };
  /** The rule `declare` applies: in the mode, `offer` holds, it has content, and its words do not name the answer. */
  const offered = (spec: LeverSpec<I, C>, item: I, ctx: C, lastMiss?: string) => {
    if (!inMode(spec, modeOf(item)) || (spec.offer && !spec.offer(item, ctx, lastMiss))) return false;
    const content = contentOf(spec, item, ctx, lastMiss);
    return !(content == null || content === false || leaks(spec, content, item, ctx));
  };

  // `ctx` is told apart by argument count, not by value: a set whose context is null or void still passes it.
  const support: LeverSet<I, C>['support'] = (item, ...rest: [ctx?: C, lastMiss?: string]) => {
    if (!item || !def.support) return '';
    const { tier, different, own } = def.support;
    const word = (w: string | ((item: I) => string)) => (typeof w === 'function' ? w(item) : w);
    // The item's own model lever, named when exactly one is offered on it. With none offered there is no support
    // rule to state: telling the tutor to pull a model it is not offered is false.
    const inItemMode = models.filter(spec => (rest.length
      ? offered(spec, item, rest[0] as C, rest[1]) : inMode(spec, modeOf(item))));
    if (!inItemMode.length) return '';
    return supportFact(tier(item), { different: word(different), own: word(own),
      ...(inItemMode.length === 1 ? { lever: inItemMode[0].id } : {}) });
  };
  const declare: LeverSet<I, C>['declare'] = (item, ctx, pulled, lastMiss) => {
    if (!item) return [];
    const mode = modeOf(item);
    return specs.flatMap(spec => {
      if (!offered(spec, item, ctx, lastMiss)) return [];
      const listed = spec.answers === 'all' ? def.missesOf(mode) : spec.answers;
      const onItem = spec.answersOn?.(item, ctx);
      return [{ id: spec.id, kind: leverKind(spec.type), carrier: spec.carrier ?? CARRIER[spec.type] ?? 'both',
        pulled: pulled.includes(spec.id),
        answers: onItem ? listed.filter(miss => onItem.includes(miss)) : [...listed],
        when: typeof spec.when === 'function' ? spec.when(item, ctx) : spec.when,
        does: typeof spec.does === 'function' ? spec.does(item, ctx) : spec.does }];
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
    specs, declare, onScreen, simpler, support,
    idsFor: mode => specs.filter(spec => inMode(spec, mode)).map(spec => spec.id),
    bind: ctx => ({
      declare: (item, pulled, lastMiss) => declare(item, ctx, pulled, lastMiss),
      onScreen: (item, pulled) => onScreen(item, ctx, pulled),
      simpler: (item, lever, lastMiss) => simpler(item, ctx, lever, lastMiss),
      support: (item, lastMiss) => support(item, ctx, lastMiss),
    }),
  };
}
