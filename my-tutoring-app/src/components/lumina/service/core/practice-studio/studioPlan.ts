/**
 * Studio plans (PROTOTYPE, 2026-11-14): a practice-studio session written offline (by Claude Code or a person) and
 * filled by code, with no model call. The canvas loop applied to practice-studio: an author writes the session once,
 * code checks every problem, and a lesson gets a checked session for free.
 *
 * A plan is one model the child works with through the whole session (the `world`), a sequence of steps that each
 * change one thing (set it up, predict, test, a harder case), and several problems: each a set of values for the
 * `{{name}}` tokens. Every item still goes through the kit's own reader (`readDraft`), checks (`itemErrors`,
 * `shortcutChecks`) and lever builder, and a choose item's key can be worked out by code from the model (`keyFrom`).
 *
 * Pure apart from the kit imports: no model, no browser.
 */
import { buildSurfaceLevers, readDraft, shipLevers } from '../../agent-kit/itemLoop';
import { itemErrors, shortcutChecks, type SurfaceItem } from '../../agent-kit/surfaces';
import { readSystem, systemValues } from '../../agent-kit/system';
import type { PracticeStudioData } from '../../../primitives/visual-primitives/core/practice-studio/PracticeStudio';
import { validatePracticeStudioData } from '../../../primitives/visual-primitives/core/practice-studio/practiceStudio.boss';

type Args = Record<string, unknown>;
type Param = number | string;

export interface StudioPlanStep {
  /** What the step does in the sequence, for the reviewer: setup, predict, test, harder. */
  role: string;
  /** An item draft in the author's format (`surfacePrompt`), with `{{name}}` tokens and `{"$use": world name}` displays. */
  draft: Args;
  /** choose only: the key is the option whose `value`, put into `part` of the first system display in the stimulus, makes `rule` true (the least such value). */
  keyFrom?: { part: string; rule: string };
}

export interface StudioPlan {
  id: string;
  title: string;
  idea: string;
  serves: { grades: string[]; objective: string };
  /** Displays the steps share. A step uses one as {"$use": "name", "parts": {partId: {value, min, max}}, ...other fields}; null removes a field. */
  world: Record<string, Args>;
  steps: StudioPlanStep[];
  /** One entry per problem: a value for every token in the world and the steps. */
  problems: Array<Record<string, Param>>;
}

const WHOLE = /^\{\{(\w+)\}\}$/;
const TOKEN = /\{\{(\w+)\}\}/g;

function param(params: Record<string, Param>, name: string): Param {
  if (!(name in params)) throw new Error(`no value for {{${name}}}`);
  return params[name];
}

/** A world display with a step's overrides: parts by id (null drops a field, so `min: null, max: null` fixes a part), then any other field. */
function useDisplay(base: Args, over: Args): Args {
  const { parts, ...rest } = over;
  const out: Args = { ...base };
  if (parts && typeof parts === 'object') {
    const changes = parts as Record<string, Args>;
    for (const id of Object.keys(changes)) if (!(Array.isArray(base.parts) && base.parts.some(p => (p as Args).id === id))) throw new Error(`the world display has no part "${id}"`);
    out.parts = (Array.isArray(base.parts) ? base.parts : []).map(p => {
      const part = { ...(p as Args) }, change = changes[String(part.id)];
      for (const [k, v] of Object.entries(change ?? {})) { if (v === null) delete part[k]; else part[k] = v; }
      return part;
    });
  }
  for (const [k, v] of Object.entries(rest)) { if (v === null) delete out[k]; else out[k] = v; }
  return out;
}

function fill(v: unknown, params: Record<string, Param>, world: Record<string, Args>): unknown {
  if (typeof v === 'string') {
    const whole = WHOLE.exec(v);
    return whole ? param(params, whole[1]) : v.replace(TOKEN, (_m, k: string) => String(param(params, k)));
  }
  if (Array.isArray(v)) return v.map(x => fill(x, params, world));
  if (v && typeof v === 'object') {
    const o = v as Args;
    if (typeof o.$use === 'string') {
      const base = world[o.$use];
      if (!base) throw new Error(`no world display "${o.$use}"`);
      const { $use: _name, ...over } = o;
      return useDisplay(fill(base, params, world) as Args, fill(over, params, world) as Args);
    }
    return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, fill(x, params, world)]));
  }
  return v;
}

/** The key of a predict item, worked out from the model: the least option value that makes the rule true. */
function keyFromModel(draft: Args, from: NonNullable<StudioPlanStep['keyFrom']>): string {
  const raw = (Array.isArray(draft.stimulus) ? draft.stimulus : []).find(d => (d as Args)?.kind === 'system') as Args | undefined;
  if (!raw) throw new Error('keyFrom needs a system display in the stimulus');
  const model = readSystem(raw);
  const at = model.parts.findIndex(p => p.id === from.part);
  if (at < 0) throw new Error(`keyFrom: the model has no part "${from.part}"`);
  const options = (Array.isArray(draft.options) ? draft.options : []) as Args[];
  const results = options.map(o => {
    if (typeof o.value !== 'number') throw new Error(`keyFrom: option "${String(o.id)}" needs a number in value`);
    const parts = model.parts.map((p, i) => (i === at ? { ...p, value: o.value as number } : p));
    return { id: String(o.id), value: o.value, ok: systemValues({ ...model, parts })[from.rule] === true };
  });
  const right = results.filter(r => r.ok).sort((a, b) => a.value - b.value)[0];
  if (!right) throw new Error(`keyFrom: no option makes "${from.rule}" true`);
  if (results.every(r => r.ok)) throw new Error(`keyFrom: every option makes "${from.rule}" true`);
  return right.id;
}

export interface FilledPlan { data: PracticeStudioData; problems: string[] }

/** One problem of a plan as a session, and every problem code found in it (an empty list is a pass). */
export function fillPlan(plan: StudioPlan, problem: number, seed: number): FilledPlan {
  const params = plan.problems[problem];
  if (!params) throw new Error(`${plan.id}: no problem ${problem + 1} (it has ${plan.problems.length})`);
  const found: string[] = [];
  const debugItems: Args[] = [];
  const challenges: SurfaceItem[] = plan.steps.map((step, i) => {
    const id = `plan-${i + 1}`;
    const draft = fill(step.draft, params, plan.world) as Args;
    if (step.keyFrom) {
      const key = keyFromModel(draft, step.keyFrom);
      draft.key = key;
      // A misconception explains a wrong option; the right one of this problem has none.
      if (draft.misconceptions && typeof draft.misconceptions === 'object') draft.misconceptions = Object.fromEntries(Object.entries(draft.misconceptions as Args).filter(([k]) => k !== key));
    }
    const read = readDraft(draft, id, seed + i);
    const errors = [...itemErrors(read.item), ...shortcutChecks(read.item)];
    const { levers, refused } = buildSurfaceLevers(read, seed + i);
    found.push(...errors.map(e => `step ${i + 1} (${step.role}): ${e}`), ...refused.map(e => `step ${i + 1} (${step.role}) lever: ${e}`));
    debugItems.push({ id, tier: read.item.tier, computed: `${read.item.difficulty.band} (${read.item.difficulty.score})`, rounds: 0, advisory: [`${step.role}: ${read.why}`, ...errors], refusedLevers: refused });
    const shipped = shipLevers(read.item, levers);
    return shipped.length ? { ...read.item, levers: shipped } : read.item;
  });
  const data = validatePracticeStudioData({
    title: plan.title, description: plan.idea, gradeBand: plan.serves.grades.join(', '), challengeType: 'practice', challenges,
    agentDebug: { plan: plan.id, problem: problem + 1, seconds: 0, costUsd: 0, model: { requested: 'none: a studio plan filled by code' }, items: debugItems },
  });
  return { data, problems: found };
}

/** The gate: every problem of the plan, filled and checked. */
export function planProblems(plan: StudioPlan): string[] {
  return plan.problems.flatMap((_, n) => {
    try {
      return fillPlan(plan, n, 1).problems.map(p => `problem ${n + 1}: ${p}`);
    } catch (e) {
      return [`problem ${n + 1}: ${e instanceof Error ? e.message : String(e)}`];
    }
  });
}
