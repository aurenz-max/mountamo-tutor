/**
 * The kit's lever capability (USER 11-07, `/agent-primitive` I13): the agent authors each item's help and simplify
 * levers; code rebuilds and checks every one. No primitive keeps a lever menu.
 *
 * Authoring half (the author loop calls it): every writer gets a `levers` field. A lever is a help or a simplify, when
 * to pull it, what the tutor says, and `change`: some of the writer's own fields, each replacing that field of the
 * item. Code runs the changed item through the same writer and the same checks, then refuses
 *   - a lever whose changed item is blocked (a shortcut, a leak, a broken world),
 *   - a help that changes the item's skill or its answer, or changes only words (the screen must show more),
 *   - a simplify that changes the skill or does not lower the computed difficulty,
 *   - a `says` line that names the answer.
 *
 * Playing half (the boss and the component import it; pure, no model): `authoredLeverSet` is one lever set for every
 * agent primitive. Its specs are fixed slots (help_1, help_2, simpler_1) whose words and content come from the item's
 * own stored levers. A pulled help shows its item in place of the item (same answer, more shown); a simplify opens its
 * item as ungraded practice.
 */
import type { FunctionDeclaration } from '@google/genai';
import { leverSet, type LeverSet } from '../../components/live-activity/bossLevers';

export type LeverKind = 'help' | 'simplify';
/** A lever as stored on a shipped item: `item` is the changed item, built the way the primitive builds every item. */
export interface AuthoredLever<I> { id: string; kind: LeverKind; when: string; says: string; item: I }
export const HELP_SLOTS = ['help_1', 'help_2'] as const;
export const SIMPLER_SLOTS = ['simpler_1'] as const;
export const PRACTICE_MARK = '~';

// ── Authoring ───────────────────────────────────────────────────────────────────

type Args = Record<string, unknown>;
const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** What code knows about a written item, for comparing a lever's item with it. */
export interface LeverFacts { mode?: string; key?: unknown; score?: number; blocking: string[] }

export interface LeverCapability<S, I> {
  /** Facts of a written item (mode, key, difficulty score, blocking checks). */
  facts(item: I, state: S): LeverFacts;
  /** True when `text` says the item's answer. */
  leaks(text: string, item: I): boolean;
  /** Writer fields that are only words (ask, narration, why): a help must change something else. */
  wordFields: readonly string[];
  /** What the item draws, with every word left out (labels, names): a help must change it. A label a pre-reader cannot
   *  read is not more shown. Absent: only `wordFields` are words. */
  drawn?(item: I): unknown;
  /** Writer fields a lever cannot change (an index, the idea it teaches). */
  fixedFields?: readonly string[];
  /** Simplify is optional on an item already in the lowest band. */
  lowest?(item: I): boolean;
}

/** The pending lever on a written draft: its kind, words, and the changed draft. */
export interface DraftLever<I> { kind: LeverKind; when: string; says: string; item: I }

const KIT_FIELDS = ['replaceIndex', 'levers'];

/** A writer's declaration with the `levers` field added: `change` takes the writer's own fields. */
export function withLevers(decl: FunctionDeclaration, cap: Pick<LeverCapability<never, never>, 'fixedFields'>): FunctionDeclaration {
  const schema = decl.parametersJsonSchema as { properties: Record<string, unknown>; required?: string[] };
  const skip = new Set([...KIT_FIELDS, ...(cap.fixedFields ?? [])]);
  const change = Object.fromEntries(Object.entries(schema.properties).filter(([k]) => !skip.has(k)));
  return {
    ...decl,
    parametersJsonSchema: {
      ...schema,
      properties: {
        ...schema.properties,
        levers: {
          type: 'array',
          description: 'What the tutor can do when the child is stuck on THIS item (see "Levers").',
          items: {
            type: 'object',
            properties: {
              kind: { type: 'string', enum: ['help', 'simplify'] },
              when: { type: 'string', description: 'When to pull it: the mistake or the moment, in the tutor\'s words.' },
              says: { type: 'string', description: 'What the tutor says as it changes the screen. Never the answer.' },
              change: { type: 'object', description: 'The fields of this item that change; each replaces that field.', properties: change },
            },
            required: ['kind', 'when', 'says', 'change'],
          },
        },
      },
    },
  };
}

/** The prompt section every leverable primitive's author reads. `examples` are the primitive's own, in its fields. */
export function leverPrompt(examples: string): string {
  return `

## Levers (help and simplify)
Every item carries its own levers: what the tutor can do on THIS item when the child is stuck. You built the item and its traps, so you know why a child misses it. Write them with the item, in levers: [{kind, when, says, change}].
- help: the screen shows MORE of the same item (a ring on what decides it, the hidden group shown, an example beside a basket, things drawn in rows), and the answer stays the same. Words alone are not a help: change something on screen.
- simplify: the same skill, one step simpler (fewer cards, smaller numbers, one event instead of two). It opens as practice; the item comes back after.
- change holds only the fields that change, each replacing that field whole (give the whole answer or the whole list of cards).
- says is what the tutor says as it pulls the lever; never the answer.
Every item needs one help and one simplify (an easy item may skip simplify). Code rebuilds each lever's item, checks it like any item, and refuses a help that changes the answer or the skill, a simplify that is not easier by the computed difficulty, and any lever that names the answer. Each write returns the levers that passed.
${examples}`;
}

/**
 * Build and check the levers a write asked for. Returns the levers that passed (to store on the item), one line per
 * lever for the author, and the issues that block the item.
 */
export function buildLevers<S, I>(
  state: S, args: Args, base: I,
  write: (s: S, a: Args) => { item: I } | { error: string },
  cap: LeverCapability<S, I>,
): { levers: DraftLever<I>[]; report: string[]; blocking: string[] } {
  const asked = Array.isArray(args.levers) ? (args.levers as Args[]) : [];
  const baseFacts = cap.facts(base, state);
  const levers: DraftLever<I>[] = [];
  const report: string[] = [];
  const blocking: string[] = [];
  const fixed = new Set([...KIT_FIELDS, ...(cap.fixedFields ?? [])]);
  const words = new Set(cap.wordFields);
  asked.forEach((l, i) => {
    const kind = s(l.kind) === 'simplify' ? 'simplify' : s(l.kind) === 'help' ? 'help' : undefined;
    const tag = `lever ${i} (${kind ?? '?'})`;
    const change = (l.change && typeof l.change === 'object' ? l.change : {}) as Args;
    const keys = Object.keys(change).filter(k => !fixed.has(k));
    const refuse = (why: string) => { blocking.push(`${tag}: ${why}`); report.push(`${tag} refused: ${why}`); };
    if (!kind) return refuse('kind is help or simplify');
    if (!s(l.when) || !s(l.says)) return refuse('when and says are required');
    if (!keys.length) return refuse('change is empty');
    if (kind === 'help' && keys.every(k => words.has(k))) return refuse('it changes only words; a help changes the screen');
    if (cap.leaks(s(l.says), base)) return refuse('says names the answer');
    const { levers: _l, replaceIndex: _r, ...rest } = args;
    const out = write(state, { ...rest, ...Object.fromEntries(keys.map(k => [k, change[k]])) });
    if ('error' in out) return refuse(out.error);
    const f = cap.facts(out.item, state);
    if (kind === 'help' && cap.drawn && JSON.stringify(cap.drawn(out.item)) === JSON.stringify(cap.drawn(base)))
      return refuse('it changes only words (a label or a name); a help changes what is drawn');
    if (f.blocking.length) return refuse(`its item is blocked: ${f.blocking[0]}`);
    if (f.mode !== baseFacts.mode) return refuse(`it changes the skill (${baseFacts.mode} to ${f.mode})`);
    if (kind === 'help' && JSON.stringify(f.key) !== JSON.stringify(baseFacts.key)) return refuse('it changes the answer');
    if (kind === 'simplify' && !(f.score !== undefined && baseFacts.score !== undefined && f.score < baseFacts.score))
      return refuse(`it is not easier (difficulty ${f.score ?? '?'} vs ${baseFacts.score ?? '?'})`);
    levers.push({ kind, when: s(l.when), says: s(l.says), item: out.item });
    report.push(`${tag} ok${f.score !== undefined ? ` (difficulty ${f.score})` : ''}`);
  });
  const helps = levers.filter(l => l.kind === 'help').length;
  const simpler = levers.filter(l => l.kind === 'simplify').length;
  if (helps > HELP_SLOTS.length) blocking.push(`at most ${HELP_SLOTS.length} help levers`);
  if (simpler > SIMPLER_SLOTS.length) blocking.push(`at most ${SIMPLER_SLOTS.length} simplify lever`);
  if (!baseFacts.blocking.length) {
    if (!helps && !blocking.some(b => b.includes('(help)'))) blocking.push('no help lever: add one (see "Levers")');
    if (!simpler && !cap.lowest?.(base) && !blocking.some(b => b.includes('(simplify)'))) blocking.push('no simplify lever: add one (see "Levers")');
  }
  return { levers, report, blocking };
}

/** Slot ids for the passing levers of one item, in order (help_1, help_2, simpler_1). */
export function slotLevers<I, O>(levers: readonly DraftLever<I>[], build: (item: I, id: string) => O): AuthoredLever<O>[] {
  let h = 0, p = 0;
  return levers.flatMap(l => {
    const id = l.kind === 'help' ? HELP_SLOTS[h++] : SIMPLER_SLOTS[p++];
    return id ? [{ id, kind: l.kind, when: l.when, says: l.says, item: build(l.item, id) }] : [];
  });
}

// ── Playing ─────────────────────────────────────────────────────────────────────

export interface Leverable<I> { id: string; levers?: AuthoredLever<I>[] }

/** The one lever set every agent primitive's boss uses: its words and content are the item's own levers. */
export function authoredLeverSet<I extends Leverable<I>>(def: { modeOf: (item: I) => string; missesOf: (mode: string) => readonly string[] }): LeverSet<I, unknown> {
  const find = (item: I, id: string) => item.levers?.find(l => l.id === id) ?? null;
  const words = (id: string, pick: 'when' | 'says') => (item: I) => find(item, id)?.[pick] ?? '';
  const help = HELP_SLOTS.map(id => ({
    id, type: 'custom' as const, carrier: 'shown' as const, answers: 'all' as const,
    why: 'authored by the agent for this item; code checked it keeps the answer and the skill and leaves no shortcut',
    when: words(id, 'when'), does: words(id, 'says'),
    content: (item: I) => find(item, id),
    fact: (lever: AuthoredLever<I>) => `On screen now: ${lever.says}`,
  }));
  const simpler = SIMPLER_SLOTS.map(id => ({
    id, type: 'easier' as const, answers: 'all' as const,
    when: words(id, 'when'), does: words(id, 'says'),
    content: (item: I) => {
      const l = find(item, id);
      return l ? { ...l.item, id: `${item.id}${PRACTICE_MARK}${id}`, levers: undefined } : null;
    },
  }));
  return leverSet<I, unknown>({ modeOf: def.modeOf, missesOf: def.missesOf, specs: [...help, ...simpler] });
}

/** The item on screen for a pulled help lever (the last one pulled), else the item itself. */
export function shownItem<I extends Leverable<I>>(item: I, pulled: readonly string[]): I {
  const help = [...pulled].reverse().map(id => item.levers?.find(l => l.id === id && l.kind === 'help')).find(Boolean);
  return help ? { ...help.item, id: item.id, levers: item.levers } : item;
}
