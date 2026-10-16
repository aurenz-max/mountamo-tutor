/**
 * The in-item levers on construction-sequence-planner (`/add-support-tiers`; report
 * qa/eval-reports/construction-sequence-planner-levers-2026-10-16.md). No real-learner evidence: the misses are what
 * `cspMiss` observes; the failures behind them are documented (the old catalog commonStruggles: the roof placed before
 * the walls, parallel work not seen) or inferred (a job that needs two placed after only one, adding every job's weeks,
 * counting jobs instead of weeks). Every lever starts released; `config.difficulty` changes the items, not the levers.
 *
 * - `check_as_you_go` (help; sequence, dependency_chain, parallel): marks each job in the learner's own plan that has a
 *   job it needs missing before it, and each week holding more jobs than there are crews. It never says which job is
 *   missing or where a job goes.
 * - `tick_needs` (help; dependency_chain): a tick beside each need on a card once that need is in the plan.
 * - `same_needs` (help; parallel): a matching tag on the jobs that need exactly the same jobs, so they can share a week.
 * - `week_blocks` (help; critical_path): each card draws its weeks as blocks.
 * - `trace_chains` (help; critical_path): every chain of needs from a first job to a last job, as a row of job names,
 *   with no totals.
 * - `fewer_jobs` (simplify; every mode, when the item has more than the smallest size): the same task with fewer jobs
 *   on another project (no job of the stuck item, and on critical_path a different total), ungraded, then the full
 *   item back.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import {
  buildOrder, chainsOf, criticalWeeks, CSP_MISSES, cspMiss, emptyWork, isOrderMode, makeItem, nameOf, PROJECT_IDS,
  sameNeedsGroups, seededRng, shapesFor, shuffle, weekRows,
  type CspItem, type CspMiss, type CspWork,
} from './constructionSequenceWorkspace';

export const CHECK_AS_YOU_GO_LEVER = 'check_as_you_go';
export const TICK_NEEDS_LEVER = 'tick_needs';
export const SAME_NEEDS_LEVER = 'same_needs';
export const WEEK_BLOCKS_LEVER = 'week_blocks';
export const TRACE_CHAINS_LEVER = 'trace_chains';
export const FEWER_JOBS_LEVER = 'fewer_jobs';

/** check_as_you_go: the jobs in the learner's plan with a need not before them, and the weeks over the crew size. */
export function asYouGoMarks(item: CspItem, w: CspWork): { jobs: string[]; weeks: number[] } {
  if (isOrderMode(item.mode)) {
    const jobs = w.order.filter((id, i) => (item.jobs.find(j => j.id === id)?.needs ?? []).some(n => !w.order.slice(0, i).includes(n)));
    return { jobs, weeks: [] };
  }
  if (item.mode !== 'parallel') return { jobs: [], weeks: [] };
  const jobs = item.jobs.filter(j => w.week[j.id] && j.needs.some(n => !w.week[n] || w.week[n] >= w.week[j.id])).map(j => j.id);
  const weeks = item.crews ? Array.from({ length: weekRows(item) }, (_, k) => k + 1)
    .filter(wk => item.jobs.filter(j => w.week[j.id] === wk).length > item.crews!) : [];
  return { jobs, weeks };
}
export const NOT_READY = 'not ready yet: a job it needs is not done before it';

/** same_needs: a letter tag per job that shares its needs with another job. */
export function sameNeedsTags(item: CspItem): Record<string, string> {
  const out: Record<string, string> = {};
  sameNeedsGroups(item.jobs).forEach((g, i) => g.forEach(id => { out[id] = String.fromCharCode(65 + i); }));
  return out;
}

/** trace_chains: each chain as a row of names, first job first. No totals. */
export const chainLines = (item: CspItem): string[] => chainsOf(item).map(c => c.map(id => nameOf(item, id)).join(' → '));

/** The leak rule for lever lines: no number of weeks and no order or week for a job. */
export function leverLeak(line: string): boolean {
  return /\d|\b(first|second|third|last|week \d|total|longest|shortest|critical)\b/i.test(line);
}

// ── Simplify: practice items ─────────────────────────────────────────────────────────────

const PRACTICE = '~simpler';
export const isPractice = (item: Pick<CspItem, 'id'>) => item.id.endsWith(PRACTICE);
export const practiceParent = (id: string) => (id.endsWith(PRACTICE) ? id.slice(0, -PRACTICE.length) : null);
const SMALLEST: Record<CspItem['mode'], number> = { sequence: 3, dependency_chain: 3, parallel: 4, critical_path: 4 };

/** The same task with fewer jobs, on another project; null when the item is already the smallest. */
export function simplerItem(item: CspItem): CspItem | null {
  if (isPractice(item) || item.jobs.length - 1 < SMALLEST[item.mode]) return null;
  const rng = seededRng(item.id + item.jobs.map(j => j.id).join(','));
  const size = item.jobs.length - 1;
  for (const p of shuffle(PROJECT_IDS.filter(x => x !== item.project), rng)) {
    for (const jobs of shuffle(shapesFor(item.mode, p, size, 'easy'), rng)) {
      const s = makeItem(item.mode, 'easy', p, jobs, rng);
      if (!s) continue;
      if (s.jobs.some(j => item.jobs.some(k => k.name === j.name))) continue;
      if (item.mode === 'critical_path' && criticalWeeks(s) === criticalWeeks(item)) continue;
      return { ...s, id: `${item.id}${PRACTICE}` };
    }
  }
  return null;
}

// ── Levers on the current item ───────────────────────────────────────────────────────────

const lever = (id: string, kind: WorkspaceLever['kind'], pulled: readonly string[], answers: readonly CspMiss[], when: string, does: string): WorkspaceLever =>
  ({ id, kind, carrier: 'shown', pulled: pulled.includes(id), answers, when, does });

/** The levers on the current session item. A practice item has none. */
export function cspLevers(item: CspItem | undefined, pulled: readonly string[]): WorkspaceLever[] {
  if (!item || isPractice(item)) return [];
  const out: WorkspaceLever[] = [];
  if (item.mode !== 'critical_path') {
    out.push(lever(CHECK_AS_YOU_GO_LEVER, 'help', pulled,
      item.mode === 'parallel' ? ['need_same_week', 'need_later', 'crew_over'] : CSP_MISSES[item.mode],
      'The learner places jobs before the jobs they need and cannot see where the plan breaks.',
      `Marks each job in the learner's own plan that has a job it needs not done before it${item.crews ? ', and each week with more jobs than crews' : ''}. It never says which job is missing or where a job goes.`));
  }
  if (item.mode === 'dependency_chain') {
    out.push(lever(TICK_NEEDS_LEVER, 'help', pulled, ['missed_second_need', 'job_before_need', 'wrong_first'],
      'The learner checks only one of the jobs a card needs.',
      'Puts a tick beside each need on a card once that need is in the plan.'));
  }
  if (item.mode === 'parallel') {
    out.push(lever(SAME_NEEDS_LEVER, 'help', pulled, ['too_many_weeks'],
      'The learner gives every job its own week and runs past the goal.',
      'Puts a matching letter tag on the jobs that need exactly the same jobs. It names no week.'));
  }
  if (item.mode === 'critical_path') {
    out.push(lever(TRACE_CHAINS_LEVER, 'help', pulled, ['added_all', 'shorter_chain', 'most_jobs_chain'],
      'The learner adds every job, or takes the wrong chain.',
      'Lists every chain of needs from a job that needs nothing to a job nothing needs, as a row of job names. It shows no totals.'));
    out.push(lever(WEEK_BLOCKS_LEVER, 'help', pulled, ['counted_jobs', 'off_by_one', 'most_jobs_chain'],
      'The learner counts jobs instead of weeks, or miscounts.',
      'Draws each job card\'s weeks as a row of blocks. It adds nothing up.'));
  }
  if (simplerItem(item)) {
    out.push(lever(FEWER_JOBS_LEVER, 'simplify', pulled, CSP_MISSES[item.mode], 'The learner cannot hold all the jobs at once.',
      'Opens the same kind of task with one job fewer, on a different project. It is not graded; this item comes back after it.'));
  }
  return out;
}

/** What the pulled levers put on screen, as a scene fact. Never an order, a week for a job or a total. */
export function leverFact(item: CspItem | undefined, pulled: readonly string[], w: CspWork = emptyWork()): string {
  if (!item || isPractice(item)) return '';
  const parts: string[] = [];
  if (pulled.includes(CHECK_AS_YOU_GO_LEVER)) {
    const m = asYouGoMarks(item, w);
    const marked = m.jobs.map(id => `"${nameOf(item, id)}"`);
    parts.push(`Check as you go is on: a job in the plan is marked "${NOT_READY}". Marked now: ${marked.length ? marked.join(', ') : 'none'}`
      + `${m.weeks.length ? `; a week holds more jobs than crews: ${m.weeks.map(x => `week ${x}`).join(', ')}` : ''}.`);
  }
  if (pulled.includes(TICK_NEEDS_LEVER)) parts.push('Each need on a card gets a tick once that job is in the plan.');
  if (pulled.includes(SAME_NEEDS_LEVER)) {
    const tags = sameNeedsTags(item);
    const groups = Array.from(new Set(Object.values(tags))).map(t => `${t}: ${item.jobs.filter(j => tags[j.id] === t).map(j => j.name).join(', ')}`);
    parts.push(`Tags on the cards; jobs with the same tag need exactly the same jobs (${groups.join('; ')}).`);
  }
  if (pulled.includes(TRACE_CHAINS_LEVER)) parts.push(`The chains of needs are listed, with no totals: ${chainLines(item).join(' | ')}.`);
  if (pulled.includes(WEEK_BLOCKS_LEVER)) parts.push("Each job card draws its weeks as a row of blocks.");
  return parts.join(' ');
}

/** For tests: every miss this item's work can show (orders tried exhaustively up to 6 jobs, else sampled). */
export function possibleMisses(item: CspItem): CspMiss[] {
  const out = new Set<CspMiss>();
  const add = (w: CspWork) => { const m = cspMiss(item, w); if (m) out.add(m); };
  if (item.mode === 'critical_path') { for (const o of item.options ?? []) add({ ...emptyWork(), choice: o }); return Array.from(out); }
  const ids = item.jobs.map(j => j.id);
  if (isOrderMode(item.mode)) {
    const perms = (xs: string[]): string[][] => (xs.length <= 1 ? [xs] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map(p => [x, ...p])));
    for (const p of perms(ids)) add({ ...emptyWork(), order: p });
    return Array.from(out);
  }
  const rng = seededRng(item.id);
  const rows = weekRows(item);
  for (let t = 0; t < 4000; t++) {
    const week: Record<string, number> = {};
    for (const id of ids) week[id] = 1 + Math.floor(rng() * rows);
    add({ ...emptyWork(), week });
  }
  // The key order of weeks with one job each: too slow, but in order.
  const key = buildOrder(item);
  add({ ...emptyWork(), week: Object.fromEntries(key.map((id, i) => [id, Math.min(i + 1, rows)])) });
  return Array.from(out);
}
