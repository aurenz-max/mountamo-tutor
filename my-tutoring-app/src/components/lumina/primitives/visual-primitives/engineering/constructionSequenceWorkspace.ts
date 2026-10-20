/**
 * construction-sequence-planner's domain: the items, their keys, checks and misses, and the scene. Its live wiring is
 * `constructionSequencePlanner.card.ts` + `constructionSequencePlanner.boss.ts` (three plan boards and a SAY_OR_SHOW
 * total on the spoken preset).
 *
 * Every item is built and keyed by code from a library of real construction jobs per project (house, bridge, tower,
 * road, playground), each job with the jobs it needs done first. An item is a convex, connected piece of one project's
 * job graph: a job's needs inside the item are its real needs, and nothing outside the item sits between two of its
 * jobs. Each eval mode is a task:
 * - sequence: a straight chain of jobs (3, 4 or 5 by tier), shown without their needs. The learner taps the jobs into
 *   the build order. The order follows from how buildings go together (a roof sits on walls), so the needs are hidden.
 * - dependency_chain: 4, 5 or 6 jobs (by tier), each card showing the jobs it needs, with at least one job that needs
 *   two. The learner taps them into an order where no job comes before a job it needs.
 * - parallel: 5, 6 or 7 jobs, one week each, with their needs shown. The learner plans the jobs into weeks (jobs in
 *   one week happen at the same time) so the build finishes by a deadline that only plans using the same week for
 *   jobs that do not need each other can meet. hard limits the crews to two jobs a week.
 * - critical_path: 5, 6 or 7 jobs with their weeks and needs shown, in branches of different lengths. The learner
 *   says or taps the fewest weeks the whole build can take (the longest chain of needs). The wrong choices are what
 *   known mistakes give: adding every job's weeks, taking a shorter chain, the chain with the most jobs, or counting
 *   jobs instead of weeks.
 * sequence, dependency_chain and parallel are plans checked by code; critical_path is one number said aloud or tapped (J14).
 *
 * Pure: the component, the generator, the boss and the tests read the same items, checks, misses and scene.
 */
import type { WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import { CSP_MISSES, type CriticalMiss, type CspMiss, type OrderMiss, type ParallelMiss } from './constructionSequencePlanner.card';

export type CspMode = 'sequence' | 'dependency_chain' | 'parallel' | 'critical_path';
export const CSP_MODES: CspMode[] = ['sequence', 'dependency_chain', 'parallel', 'critical_path'];
export type CspTier = 'easy' | 'medium' | 'hard';
export type ProjectId = 'house' | 'bridge' | 'tower' | 'road' | 'playground';
export const PROJECT_IDS: ProjectId[] = ['house', 'bridge', 'tower', 'road', 'playground'];

export interface Job {
  id: string;
  name: string;
  icon: string;
  /** Weeks the job takes. Shown and used only on critical_path items; parallel jobs take one week each. */
  weeks: number;
  /** The jobs in this item that must be done before this one. */
  needs: string[];
}

export interface CspItem {
  id: string;
  mode: CspMode;
  project: ProjectId;
  /** In the order the cards are shown: code-shuffled, and for a plan item never already a working order. */
  jobs: Job[];
  /** parallel: the most jobs one week can hold (the crews); absent, any number. */
  crews?: number;
  /** parallel: the weeks the plan must fit in (the fewest any plan can take). */
  deadline?: number;
  /** critical_path: the week totals offered, smallest first. */
  options?: number[];
}

// ── The job library ──────────────────────────────────────────────────────────────────────

type Spec = [string, string, string, number, string[]];
const lib = (specs: Spec[]): Job[] => specs.map(([id, name, icon, weeks, needs]) => ({ id, name, icon, weeks, needs }));

export const PROJECTS: Record<ProjectId, { label: string; jobs: Job[] }> = {
  house: { label: 'house', jobs: lib([
    ['clear', 'Clear the land', '🚜', 1, []],
    ['dig', 'Dig the base', '⛏️', 1, ['clear']],
    ['foundation', 'Pour the foundation', '🧱', 2, ['dig']],
    ['frame', 'Frame the walls', '🔨', 3, ['foundation']],
    ['roof', 'Put on the roof', '🏠', 2, ['frame']],
    ['pipes', 'Run the water pipes', '🚰', 2, ['frame']],
    ['wires', 'Run the electric wires', '💡', 1, ['frame']],
    ['windows', 'Put in the windows', '🪟', 1, ['frame']],
    ['inside', 'Cover the inside walls', '🪵', 2, ['pipes', 'wires']],
    ['paint', 'Paint the rooms', '🎨', 1, ['inside', 'roof']],
  ]) },
  bridge: { label: 'bridge', jobs: lib([
    ['survey', 'Mark where the bridge goes', '📐', 1, []],
    ['footings', 'Dig the footing holes', '⛏️', 2, ['survey']],
    ['piers', 'Build the piers', '🏛️', 3, ['footings']],
    ['ends', 'Build the end supports', '🧱', 2, ['survey']],
    ['beams', 'Lift the beams into place', '🏗️', 2, ['piers', 'ends']],
    ['deck', 'Pour the deck', '🛣️', 2, ['beams']],
    ['rails', 'Put up the side rails', '🚧', 1, ['deck']],
    ['lamps', 'Put up the lamps', '💡', 1, ['deck']],
    ['lines', 'Paint the road lines', '🎨', 1, ['deck']],
  ]) },
  tower: { label: 'tower', jobs: lib([
    ['dig', 'Dig the deep hole', '⛏️', 2, []],
    ['piles', 'Drive the steel piles', '🔩', 2, ['dig']],
    ['base', 'Pour the base slab', '🧱', 2, ['piles']],
    ['core', 'Build the center core', '🏗️', 3, ['base']],
    ['floors', 'Build the floors', '🏢', 3, ['core']],
    ['elevator', 'Install the elevator', '🛗', 2, ['core']],
    ['glass', 'Hang the glass walls', '🪟', 2, ['floors']],
    ['wires', 'Run the wires', '💡', 1, ['floors']],
    ['lobby', 'Open the lobby', '🚪', 1, ['glass', 'elevator']],
  ]) },
  road: { label: 'road', jobs: lib([
    ['survey', "Mark the road's path", '📐', 1, []],
    ['clear', 'Clear trees and rocks', '🚜', 2, ['survey']],
    ['level', 'Level the ground', '🚧', 2, ['clear']],
    ['drains', 'Lay the drain pipes', '🚰', 2, ['level']],
    ['gravel', 'Spread the gravel', '🪨', 1, ['level']],
    ['pave', 'Pave with asphalt', '🛣️', 2, ['gravel', 'drains']],
    ['lines', 'Paint the lines', '🎨', 1, ['pave']],
    ['signs', 'Put up the signs', '🚦', 1, ['level']],
  ]) },
  playground: { label: 'playground', jobs: lib([
    ['clear', 'Clear the ground', '🚜', 1, []],
    ['holes', 'Dig the post holes', '⛏️', 1, ['clear']],
    ['posts', 'Set the posts in concrete', '🪵', 2, ['holes']],
    ['bars', 'Bolt on the top bars', '🔩', 1, ['posts']],
    ['swings', 'Hang the swings', '⛓️', 1, ['bars']],
    ['slide', 'Attach the slide', '🛝', 1, ['bars']],
    ['chips', 'Spread soft wood chips', '🌳', 1, ['swings', 'slide']],
    ['fence', 'Build the fence', '🚧', 2, ['clear']],
  ]) },
};

// ── Graph helpers ────────────────────────────────────────────────────────────────────────

const jobMap = (jobs: Job[]) => new Map(jobs.map(j => [j.id, j]));
export const jobOf = (item: CspItem, id: string) => item.jobs.find(j => j.id === id);
export const nameOf = (item: CspItem, id: string) => jobOf(item, id)?.name ?? id;

/** One working order: Kahn's sort, ties broken by the project library's order. Empty when the needs have a cycle. */
export function buildOrder(item: Pick<CspItem, 'jobs' | 'project'>): string[] {
  const rank = new Map(PROJECTS[item.project].jobs.map((j, i) => [j.id, i]));
  const left = new Map(item.jobs.map(j => [j.id, j.needs.length]));
  const out: string[] = [];
  const ready = () => item.jobs.filter(j => left.get(j.id) === 0 && !out.includes(j.id))
    .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
  for (let r = ready(); r.length; r = ready()) {
    const j = r[0];
    out.push(j.id);
    for (const k of item.jobs) if (k.needs.includes(j.id)) left.set(k.id, (left.get(k.id) ?? 0) - 1);
  }
  return out.length === item.jobs.length ? out : [];
}

/** Every job is in the order once, after every job it needs. */
export function orderWorks(item: CspItem, order: string[]): boolean {
  if (order.length !== item.jobs.length || new Set(order).size !== order.length) return false;
  return order.every((id, i) => (jobOf(item, id)?.needs ?? ['?']).every(n => order.indexOf(n) > -1 && order.indexOf(n) < i));
}

/** Level of each job: 1 for a job that needs nothing, else one more than its deepest need. */
export function levels(item: Pick<CspItem, 'jobs'>): Map<string, number> {
  const m = jobMap(item.jobs), out = new Map<string, number>();
  const at = (id: string): number => {
    if (out.has(id)) return out.get(id)!;
    const j = m.get(id); const v = 1 + Math.max(0, ...(j?.needs ?? []).map(at));
    out.set(id, v); return v;
  };
  item.jobs.forEach(j => at(j.id));
  return out;
}

/** The fewest one-week weeks a plan can take with at most `crews` jobs a week (searches the sets of done jobs). */
export function fewestWeeks(item: Pick<CspItem, 'jobs'>, crews?: number): number {
  const n = item.jobs.length, idx = new Map(item.jobs.map((j, i) => [j.id, i]));
  const needMask = item.jobs.map(j => j.needs.reduce((m, id) => m | (1 << (idx.get(id) ?? 0)), 0));
  const full = (1 << n) - 1, cap = crews ?? n;
  const seen = new Map<number, number>([[0, 0]]);
  let frontier = [0];
  for (let week = 1; week <= n; week++) {
    const next: number[] = [];
    for (const done of frontier) {
      const ready = item.jobs.map((_, i) => i).filter(i => !(done & (1 << i)) && (needMask[i] & done) === needMask[i]);
      // Every subset of the ready jobs up to the crew size (at most 2^7 here).
      const total = 1 << ready.length;
      for (let s = 1; s < total; s++) {
        const pick = ready.filter((_, k) => s & (1 << k));
        if (pick.length > cap) continue;
        const after = pick.reduce((m, i) => m | (1 << i), done);
        if (after === full) return week;
        if (!seen.has(after)) { seen.set(after, week); next.push(after); }
      }
    }
    frontier = next;
  }
  return n;
}

/** A fastest one-week plan: job id to week (1-based). */
export function fastestPlan(item: CspItem): Record<string, number> {
  const n = item.jobs.length, idx = new Map(item.jobs.map((j, i) => [j.id, i]));
  const needMask = item.jobs.map(j => j.needs.reduce((m, id) => m | (1 << (idx.get(id) ?? 0)), 0));
  const full = (1 << n) - 1, cap = item.crews ?? n;
  const from = new Map<number, [number, number]>([[0, [-1, 0]]]);
  let frontier = [0];
  for (let week = 1; week <= n && !from.has(full); week++) {
    const next: number[] = [];
    for (const done of frontier) {
      const ready = item.jobs.map((_, i) => i).filter(i => !(done & (1 << i)) && (needMask[i] & done) === needMask[i]);
      for (let s = 1; s < 1 << ready.length; s++) {
        const pick = ready.filter((_, k) => s & (1 << k));
        if (pick.length > cap) continue;
        const after = pick.reduce((m, i) => m | (1 << i), done);
        if (!from.has(after)) { from.set(after, [done, week]); next.push(after); }
      }
    }
    frontier = next;
  }
  const plan: Record<string, number> = {};
  for (let s = full; s !== 0 && from.has(s);) {
    const [prev, week] = from.get(s)!;
    item.jobs.forEach((j, i) => { if ((s & (1 << i)) && !(prev & (1 << i))) plan[j.id] = week; });
    s = prev;
  }
  return plan;
}

/** Every chain of needs from a job that needs nothing to a job nothing needs. */
export function chainsOf(item: Pick<CspItem, 'jobs'>): string[][] {
  const out: string[][] = [];
  const next = (id: string) => item.jobs.filter(j => j.needs.includes(id)).map(j => j.id);
  const walk = (path: string[]) => {
    const after = next(path[path.length - 1]);
    if (!after.length) { out.push(path); return; }
    for (const a of after) walk([...path, a]);
  };
  item.jobs.filter(j => !j.needs.length).forEach(j => walk([j.id]));
  return out;
}
export const chainWeeks = (item: Pick<CspItem, 'jobs'>, chain: string[]) =>
  chain.reduce((s, id) => s + (item.jobs.find(j => j.id === id)?.weeks ?? 0), 0);
/** The fewest weeks the build can take when crews work at the same time: the longest chain, in weeks. */
export const criticalWeeks = (item: Pick<CspItem, 'jobs'>) => Math.max(0, ...chainsOf(item).map(c => chainWeeks(item, c)));

// ── Work, keys and checks ────────────────────────────────────────────────────────────────

/** The learner's work: an order (sequence, dependency_chain), a week per job (parallel) or a number (critical_path). */
export interface CspWork {
  order: string[];
  week: Record<string, number>;
  /** parallel: the job card picked, waiting for a week. */
  selected: string | null;
  choice: number | null;
}
export const emptyWork = (): CspWork => ({ order: [], week: {}, selected: null, choice: null });
export const isOrderMode = (m: CspMode) => m === 'sequence' || m === 'dependency_chain';

export function workComplete(item: CspItem, w: CspWork): boolean {
  if (isOrderMode(item.mode)) return w.order.length === item.jobs.length;
  if (item.mode === 'parallel') return item.jobs.every(j => (w.week[j.id] ?? 0) > 0);
  return w.choice !== null;
}

export const weeksUsed = (w: CspWork) => Math.max(0, ...Object.values(w.week));

export function cspCorrect(item: CspItem | undefined, w: CspWork): boolean {
  if (!item || !workComplete(item, w)) return false;
  if (isOrderMode(item.mode)) return orderWorks(item, w.order);
  if (item.mode === 'parallel') return parallelProblem(item, w) === null;
  return w.choice === criticalWeeks(item);
}

export type { CriticalMiss, CspMiss, OrderMiss, ParallelMiss };
export { CSP_MISSES };

/** The first job in the order placed before a job it needs, with the need it is missing. */
export function firstBreak(item: CspItem, order: string[]): { at: number; job: string; missing: string } | null {
  for (let i = 0; i < order.length; i++) {
    const missing = (jobOf(item, order[i])?.needs ?? []).find(n => !order.slice(0, i).includes(n));
    if (missing) return { at: i, job: order[i], missing };
  }
  return null;
}

/** What is wrong with a complete week plan, in the order the learner meets it; null when it works. */
export function parallelProblem(item: CspItem, w: CspWork): { miss: ParallelMiss; week: number; job?: string } | null {
  for (const j of item.jobs) {
    const wk = w.week[j.id] ?? 0;
    if (j.needs.some(n => (w.week[n] ?? 0) === wk)) return { miss: 'need_same_week', week: wk, job: j.id };
  }
  for (const j of item.jobs) {
    const wk = w.week[j.id] ?? 0;
    if (j.needs.some(n => (w.week[n] ?? 0) > wk)) return { miss: 'need_later', week: wk, job: j.id };
  }
  if (item.crews) {
    for (let wk = 1; wk <= weeksUsed(w); wk++) {
      if (item.jobs.filter(j => w.week[j.id] === wk).length > item.crews) return { miss: 'crew_over', week: wk };
    }
  }
  if (weeksUsed(w) > (item.deadline ?? item.jobs.length)) return { miss: 'too_many_weeks', week: weeksUsed(w) };
  return null;
}

/** The miss a known wrong total shows, most specific first. */
function criticalDistractors(item: CspItem): Array<[CriticalMiss, number]> {
  const chains = chainsOf(item), cp = criticalWeeks(item);
  const weeks = chains.map(c => chainWeeks(item, c));
  const shorter = Math.max(0, ...weeks.filter(w => w < cp));
  const most = Math.max(...chains.map(c => c.length));
  const mostChains = chains.filter(c => c.length === most);
  const mostWeeks = mostChains.some(c => chainWeeks(item, c) === cp) ? 0 : Math.max(...mostChains.map(c => chainWeeks(item, c)));
  const critical = chains.find(c => chainWeeks(item, c) === cp) ?? [];
  const out: Array<[CriticalMiss, number]> = [
    ['added_all', item.jobs.reduce((s, j) => s + j.weeks, 0)],
    ['most_jobs_chain', mostWeeks],
    ['shorter_chain', shorter],
    ['counted_jobs', critical.length],
    ['off_by_one', cp + 1],
    ['off_by_one', cp - 1],
  ];
  return out.filter(([, v]) => v > 0 && v !== cp);
}
export function criticalMissOf(item: CspItem, said: number): CriticalMiss | undefined {
  if (said === criticalWeeks(item)) return undefined;
  return criticalDistractors(item).find(([, v]) => v === said)?.[0] ?? 'off_by_one';
}
/** The key and three distinct wrong totals that known mistakes give, smallest first. */
export function criticalOptions(item: CspItem): number[] {
  const out = [criticalWeeks(item)];
  for (const [, v] of criticalDistractors(item)) if (out.length < 4 && !out.includes(v)) out.push(v);
  return out.sort((a, b) => a - b);
}

export function cspMiss(item: CspItem | undefined, w: CspWork): CspMiss | undefined {
  if (!item || !workComplete(item, w) || cspCorrect(item, w)) return undefined;
  if (item.mode === 'critical_path') return criticalMissOf(item, w.choice!);
  if (item.mode === 'parallel') return parallelProblem(item, w)?.miss;
  const key = buildOrder(item), order = w.order;
  if (item.mode === 'sequence') {
    if (order.every((id, i) => id === key[key.length - 1 - i])) return 'reversed';
    const off = order.map((id, i) => (id === key[i] ? -1 : i)).filter(i => i >= 0);
    if (off.length === 2 && off[1] === off[0] + 1) return 'swapped_neighbors';
  }
  if ((jobOf(item, order[0])?.needs.length ?? 0) > 0) return 'wrong_first';
  const b = firstBreak(item, order);
  if (item.mode === 'dependency_chain' && b) {
    const needs = jobOf(item, b.job)?.needs ?? [];
    if (needs.length > 1 && needs.some(n => order.indexOf(n) < b.at)) return 'missed_second_need';
  }
  return 'job_before_need';
}

// ── The ask ──────────────────────────────────────────────────────────────────────────────

const projectLabel = (item: Pick<CspItem, 'project'>) => PROJECTS[item.project].label;

export function askOf(item: CspItem): string {
  const p = projectLabel(item), n = item.jobs.length;
  if (item.mode === 'sequence') {
    return `The builders have ${n} jobs to do on the ${p}. Put the jobs in the order they must happen: tap the job that comes first, then the next, until all ${n} are in the plan.`;
  }
  if (item.mode === 'dependency_chain') {
    return `Each job card shows which jobs must be done before it. Put all ${n} jobs for the ${p} in an order that works: no job may come before a job it needs.`;
  }
  if (item.mode === 'parallel') {
    const crews = item.crews ? ` There are only ${item.crews} crews, so a week can hold at most ${item.crews} jobs.` : '';
    return `Each job takes one week, and jobs in the same week happen at the same time with different crews.${crews} A job can start only in a week after every job it needs is done. Plan the ${n} jobs into weeks so the ${p} is finished in ${item.deadline} weeks.`;
  }
  return `Each job card shows how many weeks it takes and which jobs must be done before it. Crews work on different jobs at the same time whenever the jobs allow. What is the fewest number of weeks the whole ${p} can take?`;
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
export const shuffle = <T,>(xs: T[], rng: Rng): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

/** The project's jobs restricted to `ids`, each keeping only the needs inside the set. */
function restrict(project: ProjectId, ids: string[]): Job[] {
  return PROJECTS[project].jobs.filter(j => ids.includes(j.id)).map(j => ({ ...j, needs: j.needs.filter(n => ids.includes(n)) }));
}

/** Every convex, connected set of a project's jobs: no job outside the set lies on a chain between two inside it. */
function pieces(project: ProjectId): string[][] {
  const jobs = PROJECTS[project].jobs, n = jobs.length;
  // reach[a]: every job that needs job a, directly or through others.
  const dependents = jobs.map(j => jobs.map((k, i) => (k.needs.includes(j.id) ? i : -1)).filter(i => i >= 0));
  const reach = jobs.map((_, a) => {
    const seen = new Set<number>(), stack = [...dependents[a]];
    while (stack.length) { const b = stack.pop()!; if (!seen.has(b)) { seen.add(b); stack.push(...dependents[b]); } }
    return seen;
  });
  const out: string[][] = [];
  for (let mask = 1; mask < 1 << n; mask++) {
    const ins = jobs.map((_, i) => i).filter(i => mask & (1 << i));
    if (ins.length < 3) continue;
    const convex = ins.every(a => ins.every(c => !reach[a].has(c) || jobs.every((_, b) => (mask & (1 << b)) || !(reach[a].has(b) && reach[b].has(c)))));
    if (!convex) continue;
    // Connected, ignoring direction.
    const seen = new Set([ins[0]]), stack = [ins[0]];
    while (stack.length) {
      const a = stack.pop()!;
      for (const b of ins) {
        if (seen.has(b)) continue;
        if (jobs[a].needs.includes(jobs[b].id) || jobs[b].needs.includes(jobs[a].id)) { seen.add(b); stack.push(b); }
      }
    }
    if (seen.size === ins.length) out.push(ins.map(i => jobs[i].id));
  }
  return out;
}
const PIECES = new Map<ProjectId, string[][]>();
const piecesOf = (p: ProjectId) => { if (!PIECES.has(p)) PIECES.set(p, pieces(p)); return PIECES.get(p)!; };

const isChain = (jobs: Job[]) => jobs.filter(j => !j.needs.length).length === 1 && jobs.every(j => j.needs.length <= 1)
  && jobs.every(j => jobs.filter(k => k.needs.includes(j.id)).length <= 1);
const hasJoin = (jobs: Job[]) => jobs.some(j => j.needs.length >= 2);
const widest = (jobs: Job[]) => { const count = new Map<number, number>(); levels({ jobs }).forEach(v => count.set(v, (count.get(v) ?? 0) + 1)); return Math.max(...Array.from(count.values())); };

/** Groups of two or more jobs that need exactly the same jobs (they can share a week). */
export function sameNeedsGroups(jobs: Job[]): string[][] {
  const by = new Map<string, string[]>();
  for (const j of jobs) { const k = [...j.needs].sort().join('+'); by.set(k, [...(by.get(k) ?? []), j.id]); }
  return Array.from(by.values()).filter(g => g.length >= 2);
}

export const SIZE: Record<CspMode, Record<CspTier, number>> = {
  sequence: { easy: 3, medium: 4, hard: 5 },
  dependency_chain: { easy: 4, medium: 5, hard: 6 },
  parallel: { easy: 5, medium: 6, hard: 7 },
  critical_path: { easy: 5, medium: 6, hard: 7 },
};

/** The job sets a mode can use at a size. */
export function shapesFor(mode: CspMode, project: ProjectId, size: number, tier: CspTier): Job[][] {
  return piecesOf(project).filter(ids => ids.length === size).map(ids => restrict(project, ids)).filter(jobs => {
    if (mode === 'sequence') return isChain(jobs);
    if (mode === 'dependency_chain') return hasJoin(jobs);
    if (mode === 'parallel') {
      if (widest(jobs) < 2 || !sameNeedsGroups(jobs).length) return false;
      return tier === 'hard' ? fewestWeeks({ jobs }, 2) > fewestWeeks({ jobs }) : true;
    }
    return chainsOf({ jobs }).length >= (tier === 'easy' ? 2 : 3);
  });
}

/** Weeks for a critical_path item, drawn until the tier's shape holds; null when none does. */
function weighCritical(jobs: Job[], tier: CspTier, rng: Rng): Job[] | null {
  for (let t = 0; t < 120; t++) {
    const w = jobs.map(j => ({ ...j, weeks: 1 + Math.floor(rng() * 4) }));
    const chains = chainsOf({ jobs: w }), weeks = chains.map(c => chainWeeks({ jobs: w }, c));
    const cp = Math.max(...weeks), crit = chains.filter(c => chainWeeks({ jobs: w }, c) === cp);
    if (crit.length !== 1) continue; // one longest chain
    const second = Math.max(0, ...weeks.filter(x => x < cp));
    const most = Math.max(...chains.map(c => c.length));
    const trap = !chains.filter(c => c.length === most).some(c => chainWeeks({ jobs: w }, c) === cp);
    if (tier === 'easy' && cp - second < 2) continue;
    if (tier === 'medium' && cp - second < 1) continue;
    if (tier === 'hard' && !trap) continue;
    if (tier !== 'hard' && trap) continue;
    const item: CspItem = { id: '', mode: 'critical_path', project: 'house', jobs: w };
    if (criticalOptions(item).length < 4) continue;
    return w;
  }
  return null;
}

/** One item of the mode at the tier from one job set, or null when the set cannot make one. */
export function makeItem(mode: CspMode, tier: CspTier, project: ProjectId, jobs: Job[], rng: Rng): CspItem | null {
  if (mode === 'critical_path') {
    const w = weighCritical(jobs, tier, rng);
    if (!w) return null;
    const item: CspItem = { id: '', mode, project, jobs: w };
    // The cards are shown in a working order, so they read like a plan; the question is about weeks.
    const order = buildOrder(item);
    item.jobs = order.map(id => w.find(j => j.id === id)!);
    return { ...item, options: criticalOptions(item) };
  }
  const base: CspItem = { id: '', mode, project, jobs: mode === 'parallel' ? jobs.map(j => ({ ...j, weeks: 1 })) : jobs };
  // The cards never start in an order that already works.
  let shown = shuffle(base.jobs, rng);
  for (let t = 0; t < 20 && orderWorks(base, shown.map(j => j.id)); t++) shown = shuffle(base.jobs, rng);
  if (orderWorks(base, shown.map(j => j.id))) shown = [...shown].reverse();
  const item: CspItem = { ...base, jobs: shown };
  if (mode === 'parallel') {
    const crews = tier === 'hard' ? 2 : undefined;
    return { ...item, ...(crews ? { crews } : {}), deadline: fewestWeeks(item, crews) };
  }
  return item;
}

export const ITEM_COUNT: Record<CspMode, [number, number]> = { sequence: [2, 1], dependency_chain: [2, 1], parallel: [2, 1], critical_path: [3, 2] };

const overlap = (a: CspItem, b: CspItem) => a.project === b.project ? a.jobs.filter(j => b.jobs.some(k => k.id === j.id)).length : 0;

/** The items of one mode at one tier: the lesson's project first, then other projects, no two alike. */
export function buildModeItems(mode: CspMode, tier: CspTier, project: ProjectId, count: number, rng: Rng, avoid: CspItem[] = []): CspItem[] {
  const picked: CspItem[] = [];
  const projects = [project, ...shuffle(PROJECT_IDS.filter(p => p !== project), rng)];
  for (const strict of [true, false]) {
    for (const p of projects) {
      for (const jobs of shuffle(shapesFor(mode, p, SIZE[mode][tier], tier), rng)) {
        if (picked.length >= count) return picked;
        const limit = strict ? 1 : Math.floor(jobs.length / 2);
        if ([...picked, ...avoid].some(o => overlap(o, { id: '', mode, project: p, jobs }) > limit)) continue;
        const item = makeItem(mode, tier, p, jobs, rng);
        if (item) picked.push(item);
      }
    }
  }
  return picked;
}

export function buildCspItems(opts: { modes: CspMode[]; tier: CspTier; project: ProjectId; rng: Rng }): CspItem[] {
  const out: CspItem[] = [];
  for (const mode of opts.modes) {
    out.push(...buildModeItems(mode, opts.tier, opts.project, ITEM_COUNT[mode][opts.modes.length === 1 ? 0 : 1], opts.rng));
  }
  return out.map((item, i) => ({ ...item, id: `${item.mode}-${i + 1}` }));
}

// ── Lesson data → items ──────────────────────────────────────────────────────────────────

export interface CspItemsSource {
  title?: string;
  projectType?: string;
  gradeLevel?: string;
  challengeTypes?: string[];
  difficulty?: string;
  items?: CspItem[];
  /** Legacy generations (before 2026-10-16): read only for their modes. */
  challenges?: Array<{ type?: string }>;
  supportTier?: string;
}

export const resolveProject = (d: CspItemsSource): ProjectId =>
  ((PROJECT_IDS as string[]).includes(d.projectType ?? '') ? d.projectType as ProjectId : 'house');
export const resolveTier = (d: CspItemsSource): CspTier => {
  const t = (d.difficulty ?? d.supportTier ?? '').toLowerCase();
  return t === 'easy' || t === 'hard' ? t : 'medium';
};
const LEGACY: Record<string, CspMode> = { sequence: 'sequence', dependency_chain: 'dependency_chain', parallel: 'parallel', deadline: 'parallel', critical_path: 'critical_path' };
/** The modes a lesson asks: its pin, else the legacy challenges' types, else by grade. */
export function resolveCspModes(d: CspItemsSource): CspMode[] {
  const asked = (d.challengeTypes ?? []).filter((m): m is CspMode => (CSP_MODES as string[]).includes(m));
  if (asked.length) return CSP_MODES.filter(m => asked.includes(m));
  const legacy = (d.challenges ?? []).map(c => LEGACY[c?.type ?? '']).filter((m): m is CspMode => !!m);
  if (legacy.length) return CSP_MODES.filter(m => legacy.includes(m));
  const g = d.gradeLevel === 'K' ? 0 : parseInt(d.gradeLevel ?? '', 10);
  if (isNaN(g) || g <= 1) return ['sequence'];
  if (g <= 3) return ['sequence', 'dependency_chain'];
  return ['dependency_chain', 'parallel', 'critical_path'];
}

/** False when a stored item is not one code could have built (its key would not be computable). */
export function validCspItem(i: CspItem | undefined): i is CspItem {
  if (!i || typeof i.id !== 'string' || !(CSP_MODES as string[]).includes(i.mode) || !(PROJECT_IDS as string[]).includes(i.project)) return false;
  if (!Array.isArray(i.jobs) || i.jobs.length < 2 || i.jobs.length > 10) return false;
  const ids = i.jobs.map(j => j?.id);
  if (new Set(ids).size !== ids.length || i.jobs.some(j => typeof j.name !== 'string' || !Array.isArray(j.needs)
    || !Number.isInteger(j.weeks) || j.weeks < 1 || j.needs.some(n => !ids.includes(n)))) return false;
  if (!buildOrder(i).length) return false;
  if (i.mode === 'sequence' && !isChain(i.jobs)) return false;
  if (isOrderMode(i.mode) || i.mode === 'parallel') if (orderWorks(i, ids)) return false;
  if (i.mode === 'parallel') return Number.isInteger(i.deadline) && i.deadline === fewestWeeks(i, i.crews);
  if (i.mode === 'critical_path') {
    return Array.isArray(i.options) && i.options.includes(criticalWeeks(i)) && new Set(i.options).size === i.options.length
      && i.options.every(o => Number.isInteger(o) && o > 0);
  }
  return true;
}

/** Every item of the session: the stored, code-built items when valid, else built from the lesson's own fields. */
export function cspItems(d: CspItemsSource): CspItem[] {
  const stored = Array.isArray(d.items) ? d.items.filter(validCspItem) : [];
  if (stored.length && stored.length === (d.items ?? []).length) return stored;
  return buildCspItems({ modes: resolveCspModes(d), tier: resolveTier(d), project: resolveProject(d),
    rng: seededRng(`${d.title ?? 'build'}:${resolveProject(d)}`) });
}

// ── Spoken answers ───────────────────────────────────────────────────────────────────────

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty', 'twenty-one',
  'twenty-two', 'twenty-three', 'twenty-four', 'twenty-five', 'twenty-six', 'twenty-seven', 'twenty-eight'];

/**
 * The key a spoken total is judged against, on critical_path only: the fewest weeks, as a number, a number word or
 * with "weeks". The other offered totals, two totals at once and a hedge are the signature error. A plan (sequence,
 * dependency_chain, parallel) has no key: the activity checks the board.
 */
export function cspKey(item: CspItem): SpokenKey | null {
  if (item.mode !== 'critical_path') return null;
  const cp = criticalWeeks(item);
  const others = (item.options ?? []).filter(o => o !== cp);
  return { answer: `${cp} weeks`, alsoAccept: [`${cp}`, ...(NUMBER_WORDS[cp] ? [NUMBER_WORDS[cp]] : [])],
    signatureError: `${others.length ? `${others.join(', ')} weeks ${others.length > 1 ? 'are' : 'is'} wrong, and so is` : 'So is'} `
      + 'naming two totals or hedging between them.' };
}

const WHAT: Record<CriticalMiss, string> = {
  added_all: "adds up every job's weeks, as if no two jobs could happen at the same time",
  shorter_chain: 'takes a shorter chain of needs instead of the longest',
  most_jobs_chain: 'takes the chain with the most jobs, which is not the one with the most weeks',
  counted_jobs: 'counts the jobs on the longest chain instead of their weeks',
  off_by_one: 'is one week away from the total',
};

/** critical_path's known wrong totals, most specific first, with the tap's miss ids. */
export function cspSpokenMisses(item: CspItem): KnownMiss[] {
  if (item.mode !== 'critical_path') return [];
  const cp = criticalWeeks(item), out: KnownMiss[] = [];
  for (const o of item.options ?? []) {
    if (o === cp) continue;
    const id = criticalMissOf(item, o)!;
    if (out.some(k => k.id === id)) continue;
    out.push({ id, pattern: `The right total is ${cp} weeks. The learner says ${o} weeks, which ${WHAT[id]}.`, examples: [`${o}`, `${o} weeks`] });
  }
  return out;
}

// ── Scene ────────────────────────────────────────────────────────────────────────────────

export interface CspView {
  work: CspWork;
  /** The plan last checked (after Check and build), right or wrong. */
  checked: CspWork | null;
  /** critical_path: credited, and the timeline is drawn. */
  solved: boolean;
}

export const needsText = (item: CspItem, j: Job) => (j.needs.length ? `needs ${j.needs.map(n => nameOf(item, n)).join(' and ')}` : 'needs nothing');

export function describeCspWork(item: CspItem | undefined, w: CspWork): string {
  if (!item) return 'Nothing yet';
  if (isOrderMode(item.mode)) {
    return w.order.length ? `The plan so far: ${w.order.map((id, i) => `${i + 1}) ${nameOf(item, id)}`).join(', ')}` : 'The plan is empty';
  }
  if (item.mode === 'parallel') {
    const used = weeksUsed(w);
    if (!used) return 'No job is in a week yet';
    const weeks = Array.from({ length: used }, (_, k) => k + 1).map(wk => {
      const in_ = item.jobs.filter(j => w.week[j.id] === wk).map(j => j.name);
      return `week ${wk}: ${in_.length ? in_.join(' and ') : 'nothing'}`;
    });
    const left = item.jobs.filter(j => !w.week[j.id]).length;
    return `${weeks.join('; ')}${left ? `; ${left} job${left === 1 ? '' : 's'} not placed` : ''}`;
  }
  return w.choice === null ? 'Nothing chosen yet' : `Chose ${w.choice} weeks`;
}

/** What a checked plan did when it was built: the learner's own result, never the fix. */
export function runText(item: CspItem, w: CspWork): string {
  if (isOrderMode(item.mode)) {
    const b = firstBreak(item, w.order);
    return b ? `The build ran the plan and stopped at job ${b.at + 1}, "${nameOf(item, b.job)}": a job it needs had not been done yet.`
      : `The build ran the plan: every job had what it needs, and the ${projectLabel(item)} is finished.`;
  }
  if (item.mode === 'parallel') {
    const p = parallelProblem(item, w);
    if (!p) return `The build ran the plan: every job had what it needs, and the ${projectLabel(item)} is finished in ${weeksUsed(w)} weeks.`;
    if (p.miss === 'crew_over') return `The build stopped in week ${p.week}: it has more jobs than there are crews.`;
    if (p.miss === 'too_many_weeks') return `The build ran the plan: every job had what it needs, but it takes ${weeksUsed(w)} weeks, not ${item.deadline}.`;
    return `The build stopped in week ${p.week} at "${nameOf(item, p.job!)}": a job it needs was not finished before that week.`;
  }
  return '';
}

/** What the screen shows and hides, by mode (kept from the catalog's guidance before the boss). */
const LAYOUT: Record<CspMode, string> = {
  sequence: 'The cards do not show what a job needs: working that out is the task. A checked plan is built on screen and stops at '
    + 'the first job whose need was not done; the screen does not say which need was missing, and neither do you.',
  dependency_chain: 'Each card shows the jobs it needs. A checked plan is built on screen and stops at the first job whose need was '
    + 'not done; the screen does not say which need was missing, and neither do you.',
  parallel: 'Each card shows the jobs it needs. A checked plan is built on screen week by week and stops at the first week a job\'s '
    + 'need was not done; the screen does not say which need was missing, and neither do you.',
  critical_path: 'Each card shows its weeks and the jobs it needs. No total, timeline or chain is marked on screen until the answer '
    + 'is credited.',
};

/** What this task forbids saying, beyond the shared rules (kept from the catalog's guidance before the boss). */
const NEVER_SAY: Record<CspMode, string> = {
  sequence: 'Never say which job comes first, next or last, which job another job needs, or that one job goes before another '
    + '("the roof sits on the walls"). You may ask what a job the learner names needs before it, but never describe the needed '
    + 'job by where it is, what it looks like or what it does ("the part in the middle that holds the floors").',
  dependency_chain: 'Never say where a job goes, which job to place next, or that a job is missing one of its needs; ask the '
    + 'learner to read a card.',
  parallel: 'Never say which jobs share a week, which week a job goes in, or that two jobs can happen at the same time; ask which '
    + 'jobs need the same jobs.',
  critical_path: 'Never say a total, the weeks of a chain, which chain is longest, or that the weeks should not all be added; ask '
    + 'how the learner got their number.',
};
const AFTER_A_MISS = 'After a miss, never say what the wrong answer came from, which jobs to swap, switch or move, or where a job '
  + 'goes ("swap the last two", "put it after the core").';

/** What is drawn and asked. The cards and their rules; never an order, a plan or a total the learner must find. */
export function workspaceScene(item: CspItem, view: CspView): WorkspaceScene {
  const facts: Record<string, string> = { kind: item.mode, question: askOf(item), project: projectLabel(item) };
  if (item.mode === 'sequence') {
    facts.cards = `Job cards, in the order shown (not the build order): ${item.jobs.map(j => j.name).join('; ')}.`;
  } else if (item.mode === 'critical_path') {
    facts.cards = `Job cards: ${item.jobs.map(j => `${j.name} (${j.weeks} week${j.weeks === 1 ? '' : 's'}, ${needsText(item, j)})`).join('; ')}.`;
    facts.choices = (item.options ?? []).map((o, i) => `${i + 1}) ${o} weeks`).join('  ');
    if (view.solved) facts.run = `The timeline is drawn: with crews working at the same time, the ${projectLabel(item)} takes ${criticalWeeks(item)} weeks.`;
  } else {
    facts.cards = `Job cards, in the order shown: ${item.jobs.map(j => `${j.name} (${needsText(item, j)})`).join('; ')}.`;
    if (item.mode === 'parallel') facts.weeks = `Week rows 1 to ${weekRows(item)}; the goal is ${item.deadline} weeks${item.crews ? `, at most ${item.crews} jobs a week` : ''}.`;
  }
  if (view.checked && item.mode !== 'critical_path') facts.run = runText(item, view.checked);
  facts.learnerWork = describeCspWork(item, view.work);
  facts.layout = LAYOUT[item.mode];
  facts.constraints = NEVER_SAY[item.mode];
  facts.afterMiss = AFTER_A_MISS;
  return { objects: [], facts };
}

/** parallel: the week rows offered, two past the deadline so a slow plan can be built and checked. */
export const weekRows = (item: CspItem) => Math.min(item.jobs.length, (item.deadline ?? item.jobs.length) + 2);

// ── The harness's learner (the boss's drive, the dry sweep) ──────────────────────────────

/** The journey's answers: the key, and a wrong answer showing a typical miss of the mode. */
export function cspHarnessAnswers(item: CspItem): { correct: CspWork; plainWrong: CspWork } {
  const work = emptyWork();
  if (item.mode === 'critical_path') {
    const cp = criticalWeeks(item);
    const rank = CSP_MISSES.critical_path;
    const wrong = (item.options ?? []).filter(o => o !== cp).sort((a, b) => rank.indexOf(criticalMissOf(item, a)!) - rank.indexOf(criticalMissOf(item, b)!));
    return { correct: { ...work, choice: cp }, plainWrong: { ...work, choice: wrong[0] ?? cp + 1 } };
  }
  if (item.mode === 'parallel') {
    const plan = fastestPlan(item);
    // One job moved into the same week as a job it needs.
    const j = item.jobs.find(x => x.needs.length)!;
    const need = j.needs.reduce((a, b) => (plan[a] >= plan[b] ? a : b));
    return { correct: { ...work, week: plan }, plainWrong: { ...work, week: { ...plan, [j.id]: plan[need] } } };
  }
  const key = buildOrder(item);
  if (item.mode === 'sequence') {
    // The last two jobs swapped.
    const wrong = [...key]; [wrong[wrong.length - 2], wrong[wrong.length - 1]] = [wrong[wrong.length - 1], wrong[wrong.length - 2]];
    return { correct: { ...work, order: key }, plainWrong: { ...work, order: wrong } };
  }
  // dependency_chain: the job that needs two moved to just after the first of its needs.
  const join = item.jobs.find(j => j.needs.length >= 2)!;
  const without = key.filter(id => id !== join.id);
  const first = Math.min(...join.needs.map(n => without.indexOf(n)));
  const wrong = [...without.slice(0, first + 1), join.id, ...without.slice(first + 1)];
  return { correct: { ...work, order: key }, plainWrong: { ...work, order: orderWorks(item, wrong) ? [...key].reverse() : wrong } };
}

/** The journey's spoken totals on critical_path: the key's own words, or the total that shows the mode's first-listed miss. */
export function cspHarnessWords(item: CspItem): { correct: string; plainWrong: string } {
  const a = cspHarnessAnswers(item);
  return { correct: `${a.correct.choice} weeks`, plainWrong: `${a.plainWrong.choice} weeks` };
}

/** The taps that enter a work on screen (cards, weeks, a total), before the check. */
export function cspTaps(item: CspItem, w: CspWork): string[] {
  if (isOrderMode(item.mode)) return w.order.map(id => nameOf(item, id));
  if (item.mode === 'parallel') return item.jobs.flatMap(j => [j.name, `Put in week ${w.week[j.id]}`]);
  return w.choice === null ? [] : [`${w.choice} weeks`];
}
