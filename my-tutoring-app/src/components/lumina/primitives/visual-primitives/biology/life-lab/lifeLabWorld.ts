/**
 * Life Lab's world engine, pure (no React).
 *
 * Engineers write the schema and the instructions; the author agent writes the content (`/agent-primitive` I12, USER
 * 2026-11-07). A world declares its own content: the places and what they are like, the living things (any organism:
 * name, picture, needs, traits), the options a child picks from and what each one works on, a life cycle's stages, a
 * body's parts and what each takes in and passes on. Code owns the structure and computes everything that follows
 * from it, for any content:
 *
 *   - `simulate` runs the rule (needs over days, a part doing a job, inheritance, a life cycle, a hunter that sees what
 *     does not match its background, something flowing through parts);
 *   - `goalMet` checks the goal; `solve` tries every setting the child could make;
 *   - `classify` names the eval mode and standards from the structure;
 *   - `worldChecks` blocks a broken or unfair world (a goal true before acting, nothing reaching it, the ask naming the
 *     answer, a baby that copies a parent);
 *   - `difficulty` scores what was built.
 *
 * The atlas (`lifeLabAtlas.ts`) is a cache of facts and a source of examples, never a gate: `normalizeWorld` fills a
 * world written in shorthand (`subject: 'frog'`, option values like 'thick') from it, and anything the atlas lacks is
 * declared in the world and accepted as written.
 */
import {
  BODY_PART_NAMES, CARRIER_WORDS, COND_KEYS, COND_WORDS, FLOW, FOOD_WORDS, GIVEAWAY, GROUND_WORDS, PART_JOBS, PART_LABELS,
  PART_ON, STAGE_NAMES, TOKEN_WORDS, organism, type BodyPart, type CondKey, type Level, type PartKind, type Stage,
} from './lifeLabAtlas';
import { LIFE_MODES, MODE_MISSES, type LifeLabMiss, type LifeLabMode } from './lifeLab.card';
import { displayIssues, displayText, type Display, type DisplayCapability } from '../../../../service/agent-kit/displays';

/**
 * The kit displays Life Lab offers its author: science, data and biology (cell, zoom, food web), and its own drawings for
 * a concept no display covers (`svg`: the look stage shows the author every drawing it made). No `text`: an item's words
 * are its ask and its teach frames.
 */
export const LIFE_DISPLAYS: DisplayCapability = { domains: ['science', 'biology'], without: ['text'] };
const MAX_SHOWN = 2;
export { LIFE_MODES, MODE_MISSES, type LifeLabMiss, type LifeLabMode };

// ── Skill labels (code reads them from a finished world; they never limit what the author may build) ───────────

export const MODE_STANDARDS: Record<LifeLabMode, string> = {
  where_it_lives: 'K-ESS3-1 · K-LS1-1', what_it_needs: 'K-LS1-1 · 2-LS2-1', part_for_the_job: '1-LS1-1 · 4-LS1-1',
  hide_from_the_hunter: '1-LS1-1 · 3-LS4-3', whose_baby: '1-LS3-1 · 3-LS3-1', spread_the_seeds: '2-LS2-2',
  life_cycle: '3-LS1-1', follow_the_path: '4-LS1-1', survive_and_change: '3-LS4-2 · 3-LS4-3', fair_test: '2-LS2-1 · 3-5-ETS1-3',
};
export const MODE_LABELS: Record<LifeLabMode, string> = {
  where_it_lives: 'Where it lives', what_it_needs: 'What it needs', part_for_the_job: 'Part for the job',
  hide_from_the_hunter: 'Hide from the hunter', whose_baby: 'Whose baby?', spread_the_seeds: 'Spread the seeds',
  life_cycle: 'Life cycle', follow_the_path: 'Follow the path', survive_and_change: 'Survive and change', fair_test: 'Fair test',
};

// ── The world (schema) ──────────────────────────────────────────────────────

/**
 * What a place is like. light, water and temp are dials (0, 1, 2) the child may turn; any other key is a feature the
 * world declares with a word value: `food: 'hard seeds'`, `carrier: 'wind'`, `ground: 'snow'`, `color: 'green'`
 * (the background a hunter looks at), `medium: 'water'` (what a body breathes in).
 */
export type ZoneCond = Partial<Record<CondKey, Level>> & { [feature: string]: string | number | undefined };
export interface Zone { id: string; label: string; kind?: string; emoji?: string; cond: ZoneCond }
export interface Being {
  id: string;
  zone: string;
  /** Shorthand: an atlas id whose facts fill what the world leaves out. */
  subject?: string;
  name?: string;
  emoji?: string;
  kind?: 'animal' | 'plant';
  /** What it needs from its place, as inclusive dial ranges. */
  needs?: Partial<Record<CondKey, [Level, Level]>>;
  /** Any traits: a part it has ("beak": "thick"), its coloring ("color": "green"), inherited looks ("wings": "orange"). */
  traits?: Record<string, string>;
  /** A population of colorings (survive_and_change). */
  variants?: Array<{ value: string; count: number }>;
}
/** One thing the child can pick for a part, and what it does the job for (values of the place's feature). */
export interface Option { value: string; label: string; emoji?: string; works?: string[] }
/** A picture the child places in order: a life stage or a body part. */
export interface Item { id: string; name: string; emoji?: string }
export interface FlowPart extends Item { /** What it takes in → what it passes on ("air" → "oxygen in the blood"). */ takes: Record<string, string> }
export type Rule =
  | { kind: 'needs'; beings: string[] }
  | { kind: 'part_enables'; being: string; part: string; on?: string; /** More features of the place the part must also work on. */ also?: string[]; job?: string; moveTo?: string }
  | { kind: 'inherits'; parents: [string, string]; traits: string[] }
  | { kind: 'stages'; subject?: string; of?: string; stages?: Item[] }
  | { kind: 'spots'; predator: string; prey: string; /** Features of the place a coloring must also work on (the bark's texture). */ also?: string[] }
  | { kind: 'flows'; being: string; start?: string; goal?: string; parts?: FlowPart[]; paths?: string[][] };
export type Control =
  | { type: 'condition'; zones: string[]; keys: CondKey[] }
  | { type: 'move'; beings: string[]; zones: string[] }
  | { type: 'trait'; being: string; part: string; options: Array<Option | string> }
  | { type: 'order'; slots: number; items: string[]; extras?: Item[] }
  | { type: 'choose'; among: string[] }
  | { type: 'predict'; of: string };
export type Goal =
  | { kind: 'all_thrive' | 'survives' | 'action' | 'order' | 'flow' | 'choose' | 'prediction' }
  | { kind: 'fair_test'; variable: CondKey };
export interface LifeWorld {
  zones: Zone[];
  beings: Being[];
  rules: Rule[];
  controls: Control[];
  goal: Goal;
  /** Days (needs) or families (a hunted population). */
  steps?: number;
  /** Kit displays beside the world: evidence or an example, drawn by code from the agent's values. Never the answer. */
  show?: Display[];
}

/** What the child has set: dials, where things are, traits, an order, a choice. */
export interface LifeState {
  zones: Record<string, ZoneCond>;
  beings: Record<string, { zone: string; traits: Record<string, string> }>;
  order: string[];
  choice: string | null;
}

export interface LifeRun {
  status: Record<string, 'thrives' | 'struggles'>;
  reasons: Record<string, string>;
  action?: { being: string; ok: boolean; value: string; text: string };
  moved: Record<string, string>;
  frames?: Array<Array<{ value: string; count: number }>>;
  hunted?: { prey: string; seen: boolean };
  order?: { ok: boolean; why: string };
  trace?: { ok: boolean; tokens: string[]; stopAt: number; why: string };
  possible?: string[];
}

const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** A feature's value as words ("hard_seeds" → "hard seeds"). */
export const featureWords = (v: unknown) => {
  const s = String(v ?? '');
  return FOOD_WORDS[s as keyof typeof FOOD_WORDS] ?? s.replace(/_/g, ' ');
};
const HUNT_PER_FAMILY = 3;

// ── Shorthand → declared content (the atlas as a cache) ─────────────────────

const PART_JOB: Record<string, string> = { beak: 'eat', seed: 'travel', feet: 'move' };
const normalized = new WeakSet<object>();

/**
 * The world with every shorthand filled from the atlas: a being's name, picture and needs; a known part's option labels
 * and what each works on; a known life cycle's stages; a known body's parts and real paths. Idempotent and pure. Content
 * the atlas does not know is left exactly as the world declares it.
 */
export function normalizeWorld(w: LifeWorld): LifeWorld {
  if (normalized.has(w)) return w;
  const out = clone(w);
  out.zones = out.zones ?? [];
  out.beings = (out.beings ?? []).map(b => {
    const o = b.subject ? organism(b.subject) : undefined;
    return { ...b, name: b.name ?? o?.name ?? b.subject ?? b.id, emoji: b.emoji ?? o?.emoji ?? '❔', kind: b.kind ?? o?.kind ?? 'animal',
      ...(b.needs ?? o?.needs ? { needs: b.needs ?? o?.needs } : {}) };
  });
  out.rules = (out.rules ?? []).map(r => {
    if (r.kind === 'part_enables') return { ...r, on: r.on ?? PART_ON[r.part as PartKind] ?? r.part, job: r.job ?? PART_JOB[r.part] ?? 'do the job' };
    if (r.kind === 'stages' && !r.stages?.length) {
      const o = organism(r.subject ?? '');
      return { ...r, of: r.of ?? o?.name ?? r.subject, stages: (o?.cycle ?? []).map(id => ({ id, name: STAGE_NAMES[id] ?? id })) };
    }
    if (r.kind === 'stages') return { ...r, of: r.of ?? organism(r.subject ?? '')?.name ?? r.subject ?? 'living thing' };
    if (r.kind === 'flows' && !r.parts?.length) {
      const b = out.beings.find(x => x.id === r.being);
      const medium = String(out.zones.find(z => z.id === b?.zone)?.cond.medium ?? 'air');
      const items = (out.controls.find(c => c.type === 'order') as { items?: string[] } | undefined)?.items ?? [];
      const o = organism(b?.subject ?? '');
      return { ...r, start: r.start ?? (medium === 'water' ? 'outside_water' : 'outside_air'), goal: r.goal ?? 'blood',
        parts: items.map(id => ({ id, name: BODY_PART_NAMES[id as BodyPart] ?? id, takes: { ...(FLOW[id as BodyPart] ?? {}) } as Record<string, string> })),
        ...(r.paths ?? o?.breathes ? { paths: r.paths ?? (o!.breathes!.map(p => [...p])) } : {}) };
    }
    return r;
  });
  out.controls = (out.controls ?? []).map(c => {
    if (c.type !== 'trait') return c;
    const known = PART_JOBS[c.part as PartKind];
    return { ...c, options: c.options.map(o => {
      if (typeof o !== 'string') return o;
      if (c.part === 'color') return { value: o, label: `${o} coloring` };
      return { value: o, label: PART_LABELS[c.part as PartKind]?.[o] ?? o, ...(known ? { works: [...(known[o] ?? [])] } : {}) };
    }) };
  });
  normalized.add(out);
  return out;
}
const N = normalizeWorld;

const rule = <K extends Rule['kind']>(w: LifeWorld, kind: K) => w.rules.find(r => r.kind === kind) as Extract<Rule, { kind: K }> | undefined;
const control = <T extends Control['type']>(w: LifeWorld, type: T) => w.controls.find(c => c.type === type) as Extract<Control, { type: T }> | undefined;
export const beingOf = (w: LifeWorld, id: string) => N(w).beings.find(b => b.id === id);
export const zoneOf = (w: LifeWorld, id: string) => N(w).zones.find(z => z.id === id);
export const nameOf = (w: LifeWorld, id: string) => beingOf(w, id)?.name ?? id;
export const optionsOf = (w: LifeWorld): Option[] => (control(N(w), 'trait')?.options ?? []) as Option[];
export const optionOf = (w: LifeWorld, value: string) => optionsOf(w).find(o => o.value === value);
/** Every picture the order control can place: life stages, body parts and declared extras. */
export function itemsOf(w: LifeWorld): Item[] {
  const n = N(w);
  const st = rule(n, 'stages'), fl = rule(n, 'flows'), oc = control(n, 'order');
  const pool = [...(st?.stages ?? []), ...(fl?.parts ?? []), ...(oc?.extras ?? [])];
  return (oc?.items ?? []).map(id => pool.find(x => x.id === id) ?? { id, name: STAGE_NAMES[id as Stage] ?? BODY_PART_NAMES[id as BodyPart] ?? id });
}
export const itemName = (w: LifeWorld, id: string) => itemsOf(w).find(x => x.id === id)?.name ?? id;

/** What a picked option must satisfy where its living thing is: one or more of the place's features, and a coloring its background. */
interface Need { cond: ZoneCond; keys: string[]; color?: string }
function needOf(w: LifeWorld, s?: LifeState): Need | null {
  const tc = control(w, 'trait');
  if (!tc) return null;
  const cond = (s ? s.zones[s.beings[tc.being]?.zone] : zoneOf(w, beingOf(w, tc.being)?.zone ?? '')?.cond) ?? {};
  const sp = rule(w, 'spots');
  if (sp) return { cond, keys: sp.also ?? [], color: String(cond.color ?? '') };
  const pe = rule(w, 'part_enables');
  return pe ? { cond, keys: [pe.on!, ...(pe.also ?? [])] } : null;
}
const needTotal = (n: Need) => n.keys.length + (n.color === undefined ? 0 : 1);
/** How many of the things it must satisfy this option satisfies. */
const needMet = (o: Option, n: Need) => n.keys.filter(k => !!o.works?.includes(String(n.cond[k]))).length + (n.color !== undefined && o.value === n.color ? 1 : 0);
const fits = (o: Option, n: Need) => needMet(o, n) === needTotal(n);

const tokenWords = (t: string) => TOKEN_WORDS[t as keyof typeof TOKEN_WORDS] ?? t.replace(/_/g, ' ');

export function initState(w: LifeWorld): LifeState {
  const n = N(w);
  const s: LifeState = { zones: {}, beings: {}, order: [], choice: null };
  n.zones.forEach(z => { s.zones[z.id] = { ...z.cond }; });
  n.beings.forEach(b => { s.beings[b.id] = { zone: b.zone, traits: { ...(b.traits ?? {}) } }; });
  return s;
}

// ── Running the rules ───────────────────────────────────────────────────────

export function simulate(world: LifeWorld, s: LifeState): LifeRun {
  const w = N(world);
  const r: LifeRun = { status: {}, reasons: {}, moved: {} };
  for (const ru of w.rules) {
    if (ru.kind === 'needs') {
      for (const id of ru.beings) {
        const b = s.beings[id], z = s.zones[b.zone] ?? {}, need = beingOf(w, id)?.needs ?? {};
        const unmet = (Object.entries(need) as Array<[CondKey, [Level, Level]]>).filter(([k, [lo, hi]]) => typeof z[k] !== 'number' || (z[k] as number) < lo || (z[k] as number) > hi);
        r.status[id] = unmet.length ? 'struggles' : 'thrives';
        r.reasons[id] = unmet.length
          ? unmet.map(([k]) => (typeof z[k] !== 'number' ? `there is no ${k === 'temp' ? 'warmth' : k} here` : `${COND_WORDS[k][z[k] as Level]} is wrong for it`)).join('; ')
          : 'it has what it needs here';
      }
    }
    if (ru.kind === 'part_enables') {
      const b = s.beings[ru.being], value = b.traits[ru.part] ?? '';
      const on = (s.zones[b.zone] ?? {})[ru.on!];
      const opt = optionOf(w, value);
      const need = needOf(w, s);
      const ok = !!opt && !!need && fits(opt, need);
      const label = opt?.label ?? (value || 'nothing');
      const thing = [ru.on!, ...(ru.also ?? [])].map(k => featureWords((s.zones[b.zone] ?? {})[k])).join(' and ');
      const rider = w.beings.find(x => x.id !== ru.being && s.beings[x.id]?.zone === b.zone && x.kind === 'animal');
      const carrier = String(on) === 'fur' ? (rider?.name ?? CARRIER_WORDS.fur) : thing;
      const text = ru.job === 'eat'
        ? (ok ? `The ${nameOf(w, ru.being)} ate the ${thing} with its ${label}.` : `A ${label} cannot get at the ${thing}.`)
        : ru.job === 'travel'
        ? (ok ? `The ${carrier} carried the seed with ${label} far away.` : `The ${carrier} went by, but the seed with ${label} stayed where it was.`)
        : ru.job === 'move' && GROUND_WORDS[String(on) as keyof typeof GROUND_WORDS]
        ? (ok ? `With ${label}, it can ${GROUND_WORDS[String(on) as keyof typeof GROUND_WORDS]}.` : `${cap(label)} do not help it ${GROUND_WORDS[String(on) as keyof typeof GROUND_WORDS]}.`)
        : (ok ? `With its ${label}, the ${nameOf(w, ru.being)} can ${featureWords(ru.job)} here (${thing}).` : `With ${label}, the ${nameOf(w, ru.being)} cannot ${featureWords(ru.job)} here (${thing}).`);
      r.action = { being: ru.being, ok, value, text };
      if (ok && ru.moveTo) r.moved[ru.being] = ru.moveTo;
    }
    if (ru.kind === 'inherits') {
      const among = control(w, 'choose')?.among ?? [];
      const ps = ru.parents.map(p => s.beings[p].traits);
      const fromNeither = (id: string) => ru.traits.filter(t => !ps.some(p => p[t] === s.beings[id].traits[t]));
      r.possible = among.filter(id => !fromNeither(id).length);
      if (s.choice && s.beings[s.choice]) {
        const bad = fromNeither(s.choice);
        r.reasons[s.choice] = bad.length
          ? `Neither parent has ${bad.map(t => `${s.beings[s.choice!].traits[t]} ${t}`).join(' or ')}.`
          : 'Each of its traits comes from the mother or the father.';
      }
    }
    if (ru.kind === 'stages') {
      const real = (ru.stages ?? []).map(x => x.id);
      const o = s.order, name = ru.of ?? 'living thing', nm = (id: string) => itemName(w, id);
      const ok = o.length === real.length && o.every((x, i) => x === real[i]);
      let why = '';
      if (!ok) {
        const foreign = o.find(x => !real.includes(x));
        if (foreign) why = `A ${nm(foreign)} is not part of a ${name}'s life.`;
        else if (o.length < real.length) why = 'Fill every box first.';
        else {
          for (let i = 0; i < o.length - 1 && !why; i++) {
            if (real[(real.indexOf(o[i]) + 1) % real.length] !== o[i + 1]) why = `Look at ${nm(o[i])} → ${nm(o[i + 1])}: a ${nm(o[i + 1])} does not come straight from a ${nm(o[i])}.`;
          }
          if (!why) why = `The stages go round in a loop, but a new ${name}'s life starts somewhere else.`;
        }
      }
      r.order = { ok, why: ok ? `That is a ${name}'s life cycle, and it starts again.` : why };
    }
    if (ru.kind === 'spots') {
      const prey = beingOf(w, ru.prey)!;
      const bg = String((s.zones[s.beings[ru.prey].zone] ?? {}).color ?? '');
      if (prey.variants) {
        let v = clone(prey.variants);
        r.frames = [clone(v)];
        for (let g = 0; g < (w.steps ?? 4); g++) {
          let eat = HUNT_PER_FAMILY;
          v.filter(x => x.value !== bg).sort((a, b) => b.count - a.count).forEach(x => { const e = Math.min(eat, x.count); x.count -= e; eat -= e; });
          v.forEach(x => { x.count = Math.round(x.count * 1.5); });
          const total = v.reduce((a, x) => a + x.count, 0);
          if (total > 16) v = v.map(x => ({ ...x, count: Math.round(x.count * 16 / total) }));
          r.frames.push(clone(v));
        }
      } else {
        const color = s.beings[ru.prey].traits.color, opt = optionOf(w, color), need = needOf(w, s);
        const seen = ru.also?.length ? !(opt && need && fits(opt, need)) : color !== bg;
        r.hunted = { prey: ru.prey, seen };
        r.status[ru.prey] = seen ? 'struggles' : 'thrives';
        const p = nameOf(w, ru.prey), place = zoneOf(w, s.beings[ru.prey].zone)?.label.toLowerCase() ?? 'place';
        r.reasons[ru.prey] = seen ? `The ${nameOf(w, ru.predator)} saw the ${p} against the ${bg} ${place}.` : `The ${nameOf(w, ru.predator)} looked right at the ${place} and did not see the ${p}.`;
      }
    }
    if (ru.kind === 'flows') {
      const parts = ru.parts ?? [];
      let tok = ru.start ?? 'outside_air';
      const tokens: string[] = [];
      let stopAt = -1, why = '';
      s.order.forEach((p, i) => {
        if (stopAt >= 0) return;
        const part = parts.find(x => x.id === p);
        const next = part?.takes[tok];
        if (!next) { stopAt = i; why = `The ${part?.name ?? p} cannot take ${tokenWords(tok)}, so it stopped there.`; return; }
        tok = next; tokens.push(tok);
      });
      const reached = stopAt < 0 && tok === (ru.goal ?? 'blood');
      const real = !ru.paths?.length || ru.paths.some(p => p.join() === s.order.join());
      if (stopAt < 0 && !reached) why = s.order.length ? `It got as far as ${tokenWords(tok)}, which is not ${tokenWords(ru.goal ?? 'blood')} yet.` : 'Put some parts in the path first.';
      if (reached && !real) why = `That path works, but it is not the one a real ${nameOf(w, ru.being)} uses.`;
      if (reached && real) why = `It went all the way: ${tokenWords(ru.start ?? '')} became ${tokenWords(ru.goal ?? 'blood')}.`;
      r.trace = { ok: reached && real, tokens, stopAt, why };
    }
  }
  return r;
}

/** The prediction the run bears out: the coloring there are most of after the last family. */
export function predictionKey(world: LifeWorld): string | null {
  const w = N(world);
  if (!rule(w, 'spots') || w.goal.kind !== 'prediction') return null;
  const last = simulate(w, initState(w)).frames?.at(-1);
  if (!last?.length) return null;
  const sorted = [...last].sort((a, b) => b.count - a.count);
  return sorted.length > 1 && sorted[0].count === sorted[1].count ? null : sorted[0].value;
}

export function goalMet(world: LifeWorld, s: LifeState, r: LifeRun = simulate(world, s)): boolean {
  const w = N(world);
  switch (w.goal.kind) {
    case 'all_thrive': return Object.keys(r.status).length > 0 && Object.values(r.status).every(x => x === 'thrives');
    case 'survives': return !!r.hunted && !r.hunted.seen;
    case 'action': return !!r.action?.ok;
    case 'order': return !!r.order?.ok;
    case 'flow': return !!r.trace?.ok;
    case 'choose': return !!s.choice && !!r.possible?.includes(s.choice);
    case 'prediction': return !!s.choice && s.choice === predictionKey(w);
    case 'fair_test': {
      const v = w.goal.variable;
      // Every pot counts: a pot the child cannot change is the one to match.
      const ids = w.zones.map(z => z.id);
      const living = (z: string) => Object.keys(r.status).find(id => s.beings[id].zone === z);
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
        const a = s.zones[ids[i]], b = s.zones[ids[j]], la = living(ids[i]), lb = living(ids[j]);
        if (!la || !lb) continue;
        const diff = COND_KEYS.filter(k => a[k] !== b[k]);
        if (diff.length === 1 && diff[0] === v && r.status[la] !== r.status[lb]) return true;
      }
      return false;
    }
  }
}

/** Whether the child may run the world freely before committing (a prediction or a choice is committed first). */
export const canRun = (w: LifeWorld) => !['prediction', 'choose'].includes(w.goal.kind);

// ── The solver ──────────────────────────────────────────────────────────────

function sequences(ids: string[], n: number, exact: boolean): string[][] {
  const out: string[][] = [];
  const rec = (cur: string[], rest: string[]) => {
    if (cur.length && (!exact || cur.length === n)) out.push(cur);
    if (cur.length === n) return;
    rest.forEach((x, i) => rec([...cur, x], rest.filter((_, j) => j !== i)));
  };
  rec([], ids);
  return out;
}

interface Dim { values: unknown[]; apply: (s: LifeState, v: unknown) => void }
function dims(w: LifeWorld): Dim[] {
  const D: Dim[] = [];
  for (const c of w.controls) {
    if (c.type === 'condition') for (const z of c.zones) for (const k of c.keys) D.push({ values: [0, 1, 2], apply: (s, v) => { s.zones[z][k] = v as Level; } });
    if (c.type === 'move') for (const b of c.beings) D.push({ values: c.zones, apply: (s, v) => { s.beings[b].zone = v as string; } });
    if (c.type === 'trait') D.push({ values: (c.options as Option[]).map(o => o.value), apply: (s, v) => { s.beings[c.being].traits[c.part] = v as string; } });
    if (c.type === 'order') D.push({ values: sequences(c.items, c.slots, !!rule(w, 'stages')), apply: (s, v) => { s.order = [...(v as string[])]; } });
    if (c.type === 'choose') D.push({ values: c.among, apply: (s, v) => { s.choice = v as string; } });
    if (c.type === 'predict') D.push({ values: (beingOf(w, c.of)?.variants ?? []).map(x => x.value), apply: (s, v) => { s.choice = v as string; } });
  }
  return D;
}

export const MAX_SPACE = 20000;
export interface Solved { space: number; solutions: number; first: LifeState | null; wrong: LifeState | null }

/** Every setting the child could make, tried. `first` is a right one, `wrong` a wrong one (for the harness). */
export function solve(world: LifeWorld): Solved {
  const w = N(world);
  const D = dims(w);
  const space = D.reduce((a, d) => a * Math.max(1, d.values.length), 1);
  const out: Solved = { space, solutions: 0, first: null, wrong: null };
  if (space > MAX_SPACE) return out;
  const rec = (i: number, s: LifeState) => {
    if (i === D.length) {
      if (goalMet(w, s)) { out.solutions++; if (!out.first) out.first = clone(s); } else if (!out.wrong) out.wrong = clone(s);
      return;
    }
    for (const v of D[i].values) { const s2 = clone(s); D[i].apply(s2, v); rec(i + 1, s2); }
  };
  rec(0, initState(w));
  return out;
}

// ── Mode, standards, difficulty ─────────────────────────────────────────────

/** Code names the skill from the structure, by fixed precedence. Null when no mode fits the composition. */
export function classify(world: LifeWorld): { mode: LifeLabMode; why: string } | null {
  const w = N(world);
  const has = (k: Rule['kind']) => w.rules.some(r => r.kind === k);
  if (has('flows')) return { mode: 'follow_the_path', why: 'something flowing through body parts' };
  if (has('inherits')) return { mode: 'whose_baby', why: 'young compared with two parents' };
  if (has('spots')) return beingOf(w, rule(w, 'spots')!.prey)?.variants
    ? { mode: 'survive_and_change', why: 'a hunted population over several families' }
    : { mode: 'hide_from_the_hunter', why: 'one animal and a hunter that hunts by sight' };
  if (has('stages')) return { mode: 'life_cycle', why: 'the stages of a life cycle to order' };
  if (has('needs') && w.goal.kind === 'fair_test') return { mode: 'fair_test', why: 'places that may differ in one thing only' };
  if (has('needs') && control(w, 'move')) return { mode: 'where_it_lives', why: 'living things to move to places that meet their needs' };
  if (has('needs')) return { mode: 'what_it_needs', why: 'conditions to set so living things get what they need' };
  if (has('part_enables')) {
    const pe = rule(w, 'part_enables')!;
    return pe.moveTo || pe.job === 'travel'
      ? { mode: 'spread_the_seeds', why: 'a shape that lets something be carried away' }
      : { mode: 'part_for_the_job', why: 'a body part for a job in a place' };
  }
  return null;
}

export type SupportTier = 'easy' | 'medium' | 'hard';
export interface Difficulty { band: SupportTier; score: number; reasons: string[] }
export const bandOf = (score: number): SupportTier => (score < 1.5 ? 'easy' : score < 3 ? 'medium' : 'hard');

export function difficulty(world: LifeWorld, sol: Solved = solve(world)): Difficulty {
  const w = N(world);
  let score = 0;
  const reasons: string[] = [];
  const add = (v: number, why: string) => { v = Math.round(v * 10) / 10; if (v > 0) { score += v; reasons.push(`+${v} ${why}`); } };
  add(Math.min(2, Math.log10(Math.max(1, sol.space)) * 0.7), `${sol.space} different things the child could try`);
  const frac = sol.space ? sol.solutions / sol.space : 1;
  if (frac < 0.05) add(1, `only ${sol.solutions} of them work`); else if (frac < 0.3) add(0.5, `${sol.solutions} of them work`);
  if (w.goal.kind === 'fair_test') {
    const pots = w.zones.filter(z => w.beings.some(b => b.zone === z.id)).length;
    if ((control(w, 'condition')?.zones.length ?? 0) >= pots) add(1.5, 'the child designs a fair test (change one thing only)');
    else add(0.2, 'one pot is set already, and the child makes a fair test against it');
  }
  if (w.goal.kind === 'prediction') add(0.8, 'the child predicts before seeing it happen');
  const sp = rule(w, 'spots');
  const prey = sp ? beingOf(w, sp.prey) : undefined;
  if (prey?.variants) {
    const families = w.steps ?? 4;
    add(Math.min(1, (families - 1) * 0.25), `the change happens over ${families} families`);
    const start = [...prey.variants].sort((a, b) => b.count - a.count);
    const key = predictionKey(w);
    if (key && start[0].count > start[1].count && start[0].value !== key) add(1, 'the coloring that starts with more ends with fewer');
  }
  const need = needOf(w);
  if (need && needTotal(need) > 1) {
    add(needTotal(need) - 1, `the choice must fit ${needTotal(need)} things about the place`);
    const near = optionsOf(w).filter(o => needMet(o, need) > 0 && !fits(o, need)).length;
    add(0.5 * near, `${near} option(s) fit only some of them`);
  }
  const inh = rule(w, 'inherits');
  if (inh) {
    add(0.3 * inh.traits.length, `${inh.traits.length} traits to check against both parents`);
    const parents = inh.parents.map(p => beingOf(w, p)?.traits ?? {});
    const offByOne = (control(w, 'choose')?.among ?? []).filter(id => inh.traits.filter(t => !parents.some(p => p[t] === beingOf(w, id)?.traits?.[t])).length === 1).length;
    add(0.4 * offByOne, `${offByOne} young wrong in only one trait`);
  }
  const ne = rule(w, 'needs');
  if (ne && ne.beings.length >= 3) add(0.5, `${ne.beings.length} living things to look after`);
  const fl = rule(w, 'flows'), oc = control(w, 'order');
  if (fl && oc && sol.first) add(0.25 * Math.max(0, oc.items.length - sol.first.order.length), 'parts on the bench that do not belong');
  const st = rule(w, 'stages');
  if (st && oc && oc.items.length > oc.slots) add(0.5, 'a stage from another living thing on the bench');
  return { band: bandOf(score), score: Math.round(score * 10) / 10, reasons };
}

// ── The key and the work, in words ──────────────────────────────────────────

function stateWords(w: LifeWorld, s: LifeState): string {
  const parts: string[] = [];
  for (const c of w.controls) {
    if (c.type === 'condition') parts.push(c.zones.map(z => `${zoneOf(w, z)?.label}: ${c.keys.map(k => COND_WORDS[k][(s.zones[z][k] as Level) ?? 0]).join(', ')}`).join('; '));
    if (c.type === 'move') parts.push(c.beings.map(b => `${nameOf(w, b)} → ${zoneOf(w, s.beings[b].zone)?.label}`).join(', '));
    if (c.type === 'trait') { const v = s.beings[c.being].traits[c.part] ?? ''; parts.push(optionOf(w, v)?.label ?? v); }
    if (c.type === 'order') parts.push(s.order.map(x => itemName(w, x)).join(' → '));
    if (c.type === 'choose') parts.push(s.choice ?? '');
    if (c.type === 'predict') parts.push(`more ${s.choice} ${nameOf(w, c.of)}s`);
  }
  return parts.filter(Boolean).join(' | ');
}

/** The options that do the job (a part world) or match the background (a coloring world). */
export function workingOptions(world: LifeWorld): Option[] {
  const w = N(world);
  const tc = control(w, 'trait');
  const need = needOf(w);
  if (!tc || !need) return [];
  return (tc.options as Option[]).filter(o => fits(o, need));
}

export function keyWords(world: LifeWorld, sol: Solved = solve(world)): string {
  const w = N(world);
  if (!sol.first) return 'no setting reaches the goal';
  if (control(w, 'trait')) return workingOptions(w).map(o => o.label).join(' or ');
  if (w.goal.kind === 'fair_test') return `${sol.solutions} set-ups work, e.g. ${stateWords(w, sol.first)}`;
  if (w.goal.kind === 'choose') return (simulate(w, sol.first).possible ?? []).join(', ');
  return stateWords(w, sol.first);
}

/** What the child's work is, in words (never the key). */
export const describeWork = (w: LifeWorld, s: LifeState) => stateWords(N(w), s) || 'nothing yet';

/** The named wrong answer a failed check shows. */
export function missOf(world: LifeWorld, s: LifeState, r: LifeRun): LifeLabMiss {
  const w = N(world);
  switch (classify(w)?.mode) {
    case 'where_it_lives': return 'wrong_home';
    case 'what_it_needs': return 'unmet_need';
    case 'fair_test': return 'not_fair_test';
    case 'part_for_the_job': case 'spread_the_seeds': return 'wrong_part';
    case 'hide_from_the_hunter': return 'seen_by_hunter';
    case 'survive_and_change': return 'wrong_prediction';
    case 'whose_baby': return 'trait_from_neither';
    case 'life_cycle': {
      const real = (rule(w, 'stages')!.stages ?? []).map(x => x.id);
      return s.order.some(x => !real.includes(x)) ? 'not_in_cycle' : 'out_of_order';
    }
    case 'follow_the_path': {
      const fl = rule(w, 'flows')!, t = r.trace!;
      if (t.stopAt < 0) return t.tokens.at(-1) === (fl.goal ?? 'blood') ? 'not_this_animal' : 'stops_short';
      const before = t.stopAt === 0 ? (fl.start ?? '') : t.tokens[t.stopAt - 1];
      const part = (fl.parts ?? []).find(p => p.id === s.order[t.stopAt]);
      if (before === (fl.goal ?? 'blood')) return 'too_many_parts';
      // A part that takes nothing this path could ever carry is not part of this kind of path at all.
      const carried = new Set([fl.start, ...(fl.parts ?? []).flatMap(p => Object.values(p.takes))]);
      if (part && !Object.keys(part.takes).some(k => carried.has(k))) return 'not_a_breathing_part';
      if (t.stopAt === 0) return Object.keys(part?.takes ?? {}).length && !Object.keys(part?.takes ?? {}).includes(fl.start ?? '') && !Object.keys(part?.takes ?? {}).some(k => k.startsWith('outside')) ? 'no_way_in' : 'wrong_medium';
      return 'wrong_medium';
    }
    default: return 'wrong_part';
  }
}

/** What the run showed, for the child (the feedback card) and the tutor's tries. Never which choice is right. */
export function outcomeText(world: LifeWorld, s: LifeState, r: LifeRun, met: boolean): string {
  const w = N(world);
  const mode = classify(w)?.mode;
  if (mode === 'fair_test') {
    if (met) return 'That is a fair test: the pots were the same except for one thing, and only one of them grew.';
    const grew = w.zones.filter(z => Object.keys(r.status).some(id => s.beings[id].zone === z.id && r.status[id] === 'thrives')).map(z => z.label);
    return `Not a fair test yet. Two pots must be the same in every way but one, and one must grow while the other does not. ${grew.length ? `Grew: ${grew.join(', ')}.` : 'Nothing grew.'}`;
  }
  if (mode === 'where_it_lives' || mode === 'what_it_needs') {
    if (met) return 'Everything is thriving: each one has what it needs where it is.';
    return Object.keys(r.status).filter(id => r.status[id] === 'struggles').map(id => `The ${nameOf(w, id)} is struggling: ${r.reasons[id]}.`).join(' ');
  }
  if (r.action) return r.action.text;
  if (r.order) return r.order.why;
  if (r.trace) return r.trace.why;
  if (r.hunted) return r.reasons[r.hunted.prey];
  if (mode === 'whose_baby') return s.choice ? `${met ? 'Yes.' : 'Not that one.'} ${r.reasons[s.choice] ?? ''}`.trim() : 'Pick a baby first.';
  if (mode === 'survive_and_change') {
    const last = r.frames?.at(-1) ?? [];
    const sp = rule(w, 'spots')!;
    const prey = nameOf(w, sp.prey), hunter = nameOf(w, sp.predator);
    return `${met ? 'Your prediction was right.' : 'Not what you predicted.'} After ${(r.frames?.length ?? 1) - 1} families: ${last.map(v => `${v.count} ${v.value}`).join(', ')} ${prey}s. The ${hunter} ate the ${prey}s it could see; the hidden ones had babies like themselves.`;
  }
  return met ? 'It worked!' : 'Not yet.';
}

// ── Checks on a world the author wrote ──────────────────────────────────────

export interface CheckContext { grade?: number }
export interface WorldChecks { blocking: string[]; advisory: string[]; mode?: LifeLabMode; standards?: string; key?: string; difficulty?: Difficulty }

const isLevel = (v: unknown) => v === 0 || v === 1 || v === 2;
const words = (t: string) => t.toLowerCase();
const has = (said: string, phrase: string) => !!phrase && new RegExp(`\\b${phrase.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(said);
const STOP = new Set(['the', 'and', 'with', 'that', 'this', 'from', 'into', 'very', 'little', 'small', 'big']);

/** Every reason a world cannot be built, as sentences the author can act on. Structure only: content is the author's. */
export function structureErrors(world: LifeWorld): string[] {
  const w = N(world);
  const e: string[] = [];
  const need = (ok: boolean, msg: string) => { if (!ok) e.push(msg); };
  const zoneIds = new Set(w.zones.map(z => z.id)), beingIds = new Set(w.beings.map(b => b.id));
  if ((w.show?.length ?? 0) > MAX_SHOWN) e.push(`show: at most ${MAX_SHOWN} displays`);
  e.push(...displayIssues(w.show ?? [], LIFE_DISPLAYS).map(x => `show: ${x}`));
  if (!w.zones.length && !rule(w, 'stages')) e.push('a world needs 1-4 places');
  if (w.zones.length > 4) e.push('at most 4 places');
  if (w.beings.length > 6) e.push('at most 6 living things');
  if (zoneIds.size !== w.zones.length || beingIds.size !== w.beings.length) e.push('place and living-thing ids must be distinct');
  for (const z of w.zones) {
    if (!z.label?.trim()) e.push(`place ${z.id} needs a label`);
    for (const k of COND_KEYS) if (z.cond[k] !== undefined && !isLevel(z.cond[k])) e.push(`place ${z.id}: ${k} is 0, 1 or 2`);
  }
  for (const b of w.beings) {
    if (!zoneIds.has(b.zone)) e.push(`living thing ${b.id} is in no place (zone "${b.zone}")`);
    if (!b.name?.trim()) e.push(`living thing ${b.id} needs a name`);
  }
  if (w.rules.length !== 1) e.push('a world has exactly one rule');
  if (w.controls.length !== 1) e.push('a world has exactly one thing the child changes (one control)');
  const ru = w.rules[0], c = w.controls[0];
  if (!ru || !c) return e;
  if (ru.kind === 'needs') {
    for (const id of ru.beings) need(beingIds.has(id) && !!beingOf(w, id)?.needs && Object.keys(beingOf(w, id)!.needs!).length > 0,
      `needs: ${id} must be a living thing in this world with needs declared (light, water or temp as [low, high], 0-2)`);
    need(c.type === 'condition' || c.type === 'move', 'needs: the child sets conditions or moves living things');
    need(['all_thrive', 'fair_test'].includes(w.goal.kind), 'needs: the goal is all_thrive or fair_test');
    if (w.goal.kind === 'fair_test') need(c.type === 'condition' && c.zones.length >= 1 && w.zones.length >= 2 && c.keys.includes(w.goal.variable),
      'fair_test: at least 2 pots, and the child sets conditions in 1-3 of them, including the variable (a pot the child cannot change is the one to match)');
  }
  if (ru.kind === 'part_enables') {
    need(beingIds.has(ru.being) && !!ru.part, 'part_enables: a living thing and the name of a part');
    const z = beingIds.has(ru.being) ? zoneOf(w, beingOf(w, ru.being)!.zone) : undefined;
    for (const k of [ru.on!, ...(ru.also ?? [])]) need(!!z && z.cond[k] !== undefined, `part_enables: the living thing's place must declare the feature the part works on ("${k}")`);
    need(c.type === 'trait' && c.being === ru.being && c.part === ru.part, 'part_enables: the child picks that part (a trait control on the same living thing and part)');
    if (c.type === 'trait') {
      const opts = c.options as Option[];
      need(opts.length >= 2 && opts.length <= 4 && new Set(opts.map(o => o.value)).size === opts.length && opts.every(o => !!o.label?.trim()),
        'part_enables: 2-4 options, each with a distinct value and a label (what it looks like)');
      need(opts.every(o => Array.isArray(o.works)), 'part_enables: each option says what it works on (works: values of the place\'s feature; empty when it works on none)');
    }
    need(w.goal.kind === 'action', 'part_enables: the goal is action');
    if (ru.moveTo) need(zoneIds.has(ru.moveTo), 'part_enables: moveTo must be a place');
  }
  if (ru.kind === 'inherits') {
    if (ru.parents.length !== 2) e.push(`inherits: exactly two parents (it has ${ru.parents.length})`);
    for (const p of ru.parents) if (!beingIds.has(p)) e.push(`inherits: parent "${p}" is not a living thing in this world`);
    need(ru.traits.length >= 1 && ru.traits.length <= 4, 'inherits: 1-4 traits');
    need(c.type === 'choose' && c.among.length >= 2 && c.among.length <= 4 && c.among.every(id => beingIds.has(id) && !ru.parents.includes(id)), 'inherits: the child chooses among 2-4 young (not the parents)');
    const all = [...ru.parents, ...(c.type === 'choose' ? c.among : [])];
    for (const id of all) for (const t of ru.traits) if (!beingOf(w, id)?.traits?.[t]?.trim()) e.push(`inherits: ${id} needs a value for "${t}"`);
    need(new Set(all.map(id => beingOf(w, id)?.name)).size === 1, 'inherits: parents and young are the same kind of living thing (same name)');
    need(w.goal.kind === 'choose', 'inherits: the goal is choose');
  }
  if (ru.kind === 'stages') {
    const st = ru.stages ?? [];
    need(st.length >= 3 && st.length <= 6 && new Set(st.map(x => x.id)).size === st.length && st.every(x => !!x.name?.trim()),
      'stages: declare 3-6 stages in the order of the life, each with an id and a name (and a picture)');
    need(c.type === 'order' && c.slots === st.length && st.every(x => c.items.includes(x.id)) && c.items.length <= st.length + 2,
      'stages: an order control whose slots are the number of stages, holding every stage (plus at most 2 from another life, declared in extras)');
    if (c.type === 'order') for (const id of c.items) if (!st.some(x => x.id === id) && !(c.extras ?? []).some(x => x.id === id) && !STAGE_NAMES[id as Stage])
      e.push(`stages: bench item "${id}" is neither a stage nor a declared extra`);
    need(w.goal.kind === 'order', 'stages: the goal is order');
  }
  if (ru.kind === 'spots') {
    const prey = beingOf(w, ru.prey), z = prey ? zoneOf(w, prey.zone) : undefined;
    need(beingIds.has(ru.predator) && !!prey, 'spots: a hunter and a prey');
    need(!!z?.cond.color, 'spots: the prey\'s place declares the background color (color: a color word)');
    if (prey?.variants) {
      need(prey.variants.length === 2 && prey.variants.every(v => v.count >= 2 && v.count <= 8 && !!v.value) && prey.variants[0].value !== prey.variants[1].value,
        'spots: a population of two different colorings, 2-8 of each');
      need(c.type === 'predict' && c.of === prey.id && w.goal.kind === 'prediction', 'spots (population): the child predicts which coloring there will be more of');
      need((w.steps ?? 4) >= 2 && (w.steps ?? 4) <= 5, 'spots: 2-5 families');
    } else {
      need(c.type === 'trait' && c.being === ru.prey && c.part === 'color', 'spots (one animal): the child picks its coloring (a trait control, part color)');
      if (c.type === 'trait' && c.part === 'color') need((c.options as Option[]).length >= 2 && (c.options as Option[]).length <= 4 && (c.options as Option[]).some(o => o.value === z?.cond.color),
        'spots (one animal): 2-4 colorings, one of them the background\'s color');
      if (c.type === 'trait' && c.part === 'color') need(new Set((c.options as Option[]).map(o => o.value)).size === (c.options as Option[]).length,
        'spots (one animal): each coloring has its own value (two with the same value cannot be told apart when tapped)');
      for (const k of ru.also ?? []) need(z?.cond[k] !== undefined, `spots: the prey's place must declare "${k}"`);
      if (ru.also?.length && c.type === 'trait') need((c.options as Option[]).every(o => Array.isArray(o.works)), 'spots: with also, each coloring says what it works on (works: values of those features; empty when none)');
      need(w.goal.kind === 'survives', 'spots (one animal): the goal is survives');
    }
  }
  if (ru.kind === 'flows') {
    const parts = ru.parts ?? [];
    need(beingIds.has(ru.being), 'flows: the living thing it flows through');
    need(!!ru.start && !!ru.goal, 'flows: declare what goes in (start) and what it must become (goal)');
    need(parts.length >= 3 && parts.length <= 6 && parts.every(p => !!p.name?.trim() && p.takes && typeof p.takes === 'object'),
      'flows: declare 3-6 parts, each with a name and what it takes in → passes on');
    need(c.type === 'order' && c.slots >= 1 && c.slots <= 4 && c.items.length === parts.length && parts.every(p => c.items.includes(p.id)),
      'flows: an order control of 1-4 slots whose bench is the declared parts');
    need(w.goal.kind === 'flow', 'flows: the goal is flow');
  }
  if (c.type === 'condition') need(c.zones.every(z => zoneIds.has(z)) && c.zones.length <= 3 && c.keys.length >= 1 && c.keys.length <= 2, 'condition: 1-3 places and 1-2 of light, water, temp');
  if (c.type === 'move') need(c.beings.every(b => beingIds.has(b)) && c.zones.every(z => zoneIds.has(z)) && c.beings.length <= 4 && c.zones.length >= 2, 'move: up to 4 living things and 2-4 places');
  return e;
}

/** A shortcut, a leak or a goal that cannot fail, as sentences the author can act on. */
export function worldChecks(world: LifeWorld, ask: string, why: string, ctx: CheckContext = {}): WorldChecks {
  const w = N(world);
  const blocking = structureErrors(w);
  const advisory: string[] = [];
  if (blocking.length) return { blocking, advisory };
  const cls = classify(w);
  if (!cls) return { blocking: ['no skill fits this world'], advisory };
  const sol = solve(w);
  if (sol.space > MAX_SPACE) blocking.push(`too many things to try (${sol.space}); fewer places or options`);
  if (!sol.solutions) blocking.push('no setting the child can make reaches the goal');
  const s0 = initState(w);
  if (!['choose', 'prediction', 'order', 'flow'].includes(w.goal.kind) && goalMet(w, s0)) blocking.push('the goal is already true before the child does anything');
  // A display is read like the ask: every rule below about what may not be said holds for what is shown.
  const said = words(`${ask} ${why} ${(w.show ?? []).map(displayText).join(' ')}`), asked = words(ask);

  const tc = control(w, 'trait');
  if (tc) {
    const opts = tc.options as Option[], right = workingOptions(w), wrong = opts.filter(o => !right.includes(o));
    if (!right.length) blocking.push('no option works here');
    if (!wrong.length) blocking.push('every option works: the child cannot get it wrong; add one that does not');
    if (tc.part === 'color') {
      // Matching the coloring to the background IS the skill, so the background's color may be said; the coloring as
      // the answer may not ("pick green wings").
      const bg = String(zoneOf(w, beingOf(w, tc.being)!.zone)?.cond.color ?? '');
      if (bg && [`${bg} wings`, `${bg} coloring`, `${bg} body`, `${bg} ${nameOf(w, tc.being)}`].some(x => said.includes(x))) blocking.push(`the ask names the ${bg} coloring, which is the answer`);
    } else {
      const named = right.find(o => has(said, o.label));
      if (named) blocking.push(`the ask or why-card names "${named.label}", which works`);
      // A word only the working options have (their look) hands the child the match.
      // The part's own name and the living thing's name are the job, not the answer ("pick its feet").
      const wrongWords = new Set([...wrong.flatMap(o => words(o.label).split(/\W+/)), ...words(`${tc.part} ${tc.part}s ${tc.part.replace(/s$/, '')} ${nameOf(w, tc.being)}`).split(/\W+/)]);
      const own = right.flatMap(o => words(o.label).split(/\W+/)).filter(x => x.length >= 4 && !STOP.has(x) && !wrongWords.has(x));
      const leak = own.find(x => has(asked, x));
      if (leak && !named) blocking.push(`the ask says "${leak}", which only the working option has; say the job only`);
      // Words the atlas knows tell the trick of a known part ("paddle" for webbed feet).
      const known = GIVEAWAY[tc.part as PartKind];
      const trick = known ? right.flatMap(o => known[o.value] ?? []).find(g => asked.includes(g)) : undefined;
      if (trick) blocking.push(`the ask says "${trick}", which tells the child the working part's shape or trick; say the job only`);
    }
  }
  // Turning the one dial the goal is about is not a skill.
  const cc = control(w, 'condition');
  if (cc && cc.keys.length < 2 && (cls.mode === 'what_it_needs' || cls.mode === 'fair_test'))
    blocking.push(cls.mode === 'fair_test' ? 'the child can change only the thing being tested, so any change is fair; let it change another condition too'
      : 'the child can change only one thing, so there is nothing to work out; let it change two (light and water, or warmth)');
  const missing = asked.match(/\b(needs? (more|less|some) (light|water|sun|sunlight|warmth)|too (dry|dark|wet|cold|hot|bright|shady)|not enough (light|water|sun|sunlight|warmth)|getting dry|in the dark)\b/);
  if (missing && cls.mode === 'what_it_needs') blocking.push(`the ask says "${missing[0]}", which names what is missing; let the child find it`);
  const LEVEL_WORDS: Array<[CondKey, Level, RegExp]> = [
    ['light', 2, /\b(dark|shade|shady)\b/], ['light', 0, /\b(bright|sunny)\b/], ['water', 2, /\b(dry|thirsty)\b/],
    ['water', 0, /\b(wet|soggy|flooded)\b/], ['temp', 2, /\b(cold|freezing|icy|chilly)\b/], ['temp', 0, /\b(hot|baking)\b/],
  ];
  if (w.zones.length === 1) for (const [k, v, re] of LEVEL_WORDS) {
    const m = asked.match(re);
    if (m && w.zones[0].cond[k] === v) blocking.push(`the ask says "${m[0]}", but ${w.zones[0].label} has ${COND_WORDS[k][v]}`);
  }
  const governed = new Set(cc?.zones ?? []);
  for (const z of w.zones) {
    if (governed.has(z.id)) continue;
    const k = z.cond;
    if ((z.kind === 'ice' || z.kind === 'snow') && k.temp !== undefined && k.temp !== 0) blocking.push(`${z.label} is ${z.kind} but not cold`);
    if (z.kind === 'desert' && (((k.water as number) ?? 0) > 1 || k.temp === 0)) blocking.push(`${z.label} is a desert but wet or cold`);
    if (['pond', 'river', 'sea'].includes(z.kind ?? '') && k.water !== undefined && k.water !== 2) blocking.push(`${z.label} is water but not wet`);
  }
  const inh = rule(w, 'inherits');
  if (inh) {
    const possible = simulate(w, s0).possible ?? [];
    if (possible.length !== 1) blocking.push(`${possible.length} young could belong to these parents; exactly one may`);
    const copy = possible.some(id => inh.parents.some(p => inh.traits.every(t => beingOf(w, p)!.traits![t] === beingOf(w, id)!.traits![t])));
    if (copy) blocking.push('the right baby is a copy of one parent: a child can match the picture, not check each trait');
    if (inh.traits.length < 2) advisory.push('one trait only: easy to match by eye');
  }
  if (w.goal.kind === 'prediction') {
    const key = predictionKey(w);
    const other = (beingOf(w, (control(w, 'predict')!).of)?.variants ?? []).map(v => v.value).filter(v => v !== key);
    if (!key) blocking.push('after the families there are as many of each coloring: no prediction is right');
    else if (said.includes(`more ${key}`) && !other.some(o => said.includes(o))) blocking.push('the ask names only the answer coloring');
  }
  const st = rule(w, 'stages');
  if (st) {
    const names = (st.stages ?? []).map(x => words(x.name));
    // Each display is read alone, so an ask that names the animal cannot hide a list of its stages. A loop may start anywhere.
    const inOrder = (t: string, loop = false) => {
      const pos = names.map(n => t.indexOf(n)).filter(i => i >= 0);
      return pos.length >= 3 && pos.filter((p, i) => i > 0 && p < pos[i - 1]).length <= (loop ? 1 : 0);
    };
    if (inOrder(said) || (w.show ?? []).some(d => inOrder(words(displayText(d)), d.kind === 'flow' && !!d.loop))) blocking.push('the ask or a display lists the stages in order');
    const first = names[0];
    if (first && new RegExp(`\\b(from|with|starting with|starts? as|begins? as) (an? |the )?${first}\\b`).test(asked)) blocking.push(`the ask says the life starts with the ${first}; say "from the start of its life" instead`);
  }
  const fl = rule(w, 'flows');
  if (fl && sol.first) {
    const onPath = new Set(sol.first.order);
    const path = (fl.parts ?? []).filter(p => onPath.has(p.id)), off = (fl.parts ?? []).filter(p => !onPath.has(p.id));
    const offWords = new Set(off.flatMap(p => words(p.name).split(/\W+/)));
    // The part's name, or a word only it has ("moist skin" names wet skin).
    const leak = path.find(p => has(said, p.name) || words(p.name).split(/\W+/).some(x => x.length >= 4 && !STOP.has(x) && !offWords.has(x) && has(said, x)));
    if (leak) blocking.push(`the ask or why-card names the ${leak.name} (or a word of its name), a part of the path`);
  }
  const mv = control(w, 'move');
  if (mv && sol.first) for (const b of mv.beings) {
    const home = zoneOf(w, sol.first.beings[b].zone)!.label.toLowerCase();
    if (said.includes(nameOf(w, b).toLowerCase()) && said.includes(home)) blocking.push(`the ask names the ${nameOf(w, b)} and the ${home} together`);
  }
  if (!/[?.!]\s*$/.test(ask.trim())) advisory.push('end the ask with a question mark or a full stop');
  if (ctx.grade !== undefined && ctx.grade <= 2) {
    const targets = w.controls.reduce((a, k) => a + (k.type === 'condition' ? k.zones.length * k.keys.length * 2 : k.type === 'move' ? k.beings.length + k.zones.length
      : k.type === 'trait' ? k.options.length : k.type === 'order' ? k.items.length : k.type === 'choose' ? k.among.length : 2), 0);
    if (targets > 10) advisory.push(`K-2: ${targets} things to tap; keep it to about 8`);
  }
  return { blocking, advisory, mode: cls.mode, standards: MODE_STANDARDS[cls.mode], key: keyWords(w, sol), difficulty: difficulty(w, sol) };
}

// ── A session of items ──────────────────────────────────────────────────────

export interface ItemDraft { world: LifeWorld; ask: string; why: string }

/** Session-level rules: length, no repeated answer or world, the tier. Which kinds of world fit is the objective's business. */
export function sessionChecks(items: Array<ItemDraft & { mode?: LifeLabMode; key?: string; band?: SupportTier }>, opts: { tier?: SupportTier; min?: number }): string[] {
  const out: string[] = [];
  const min = opts.min ?? 3;
  if (items.length < min) out.push(`a session has ${min}-5 items; it has ${items.length}`);
  if (items.length > 5) out.push('at most 5 items');
  const keys = items.map(i => i.key).filter(Boolean);
  if (new Set(keys).size !== keys.length) out.push('two items have the same answer; vary the living things and the answer');
  const sig = items.map(i => `${i.mode}|${N(i.world).beings.map(b => b.name).sort().join(',')}|${JSON.stringify(N(i.world).rules[0])}`);
  if (new Set(sig).size !== sig.length) out.push('two items are the same world; vary them');
  if (opts.tier) {
    const order: SupportTier[] = ['easy', 'medium', 'hard'];
    items.forEach((it, i) => {
      if (!it.band) return;
      const gap = order.indexOf(opts.tier!) - order.indexOf(it.band);
      if (gap !== 0 && !(i === 0 && gap === 1)) out.push(`item ${i} scores ${it.band}; this session is ${opts.tier}`);
    });
  }
  return out;
}

/** The world as stored: shorthand filled in, and an order control's bench shuffled (seeded) out of the answer's order. */
export function settleBench(world: LifeWorld, rand: () => number): LifeWorld {
  const out = clone(N(world));
  const oc = out.controls.find(c => c.type === 'order') as Extract<Control, { type: 'order' }> | undefined;
  if (!oc) return out;
  const items = [...oc.items];
  for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
  const real = solve(out).first?.order ?? [];
  if (real.length && items.slice(0, real.length).join() === real.join()) items.push(items.shift()!);
  oc.items = items;
  return out;
}

export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
