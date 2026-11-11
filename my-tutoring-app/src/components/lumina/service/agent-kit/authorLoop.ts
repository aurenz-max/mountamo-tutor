/**
 * The agent-primitive kit's author loop: the one function-calling loop every agent primitive runs.
 *
 * Before this file each agent primitive (wonder-walk, life-lab, deep-dive, annotated-example) carried its own copy of
 * the same loop: turn and deadline budget, plan / write / remove / finish / decline tools, a fixed tool order inside a
 * turn, a trace of every call, a status echo after each turn, an independent review once at finish, and a salvage of
 * the passing items when the budget runs out. A primitive now supplies only what is its own (`AgentAuthor`): its
 * tools, how a write is read and checked, the session checks, the review and how the shipped data is built.
 * Capabilities shared across primitives (what the child produces, levers, the tier target) plug in through
 * `capabilities.ts`, not through code copied into each primitive. Doctrine: `.claude/skills/agent-primitive/SKILL.md`.
 *
 * The stages are the loop's, so a lesson added to one reaches every author (USER 2026-11-08): write, code checks, look
 * (the first screen in a screenshot, read by a blind reader, sent back with what it found), revise, ship. Every run gets
 * the trace, the cost and the run record without asking.
 *
 * `agentKit.guard.test.ts` fails any new service file that runs its own tool loop, and any author with no look stage.
 */
import { ThinkingLevel, type Content, type FunctionCall, type FunctionDeclaration, type Part } from '@google/genai';
import { ai } from '../geminiClient';
import { priceCall } from '../spend/spendMeter';
import { resolveEvalModes, type ChallengeTypeDoc } from '../evalMode';
import type { GenerationContext, GenerationObjective } from '../generation/generationContext';
import { buildLevers, withLevers, type DraftLever, type LeverCapability } from './levers';
import { Looker, readView, type LookView, type ViewReading } from './look';
import { startTrace, tallyDisplays, type RunRecord } from './trace';

/** Looks at the items that changed: the first draft, then once more after a revise. */
const MAX_LOOK_ROUNDS = 2;

// ── Argument readers (the model's tool args arrive loosely typed) ───────────────

export type Args = Record<string, unknown>;
export const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
export const strs = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
export const arr = (v: unknown): Args[] => (Array.isArray(v) ? v : []).map(x => (x ?? {}) as Args);
export const num = (v: unknown) => (v === undefined || v === null || v === '' ? undefined : Number(v));
export const optStr = <T extends string>(v: unknown) => (str(v) ? (str(v) as T) : undefined);
/** Drops undefined, empty strings and empty arrays. */
export const clean = <T extends object>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && !v.length))) as T;

// ── The primitive's half ────────────────────────────────────────────────────────

export interface ToolTrace { turn: number; name: string; ok: boolean; note?: string }
export interface AuthorDebug { turns: number; seconds: number; toolCalls: ToolTrace[]; advisories: string[]; [extra: string]: unknown }

/** A write either lands an item (with the result the author reads) or returns an error and lands nothing. */
export type WriteOutcome<I> = { item: I; result: Args } | { error: string };

export interface AuthorBudget {
  softMs: number;
  hardMs: number;
  /** The deadlines are the real budget; the turn cap only stops a model that loops without writing. */
  maxTurns: number;
  /** A full session needs this many items. */
  minItems: number;
  /** Out of time, a session still ships with this many passing items. */
  salvageMin: number;
}

export interface AgentAuthor<S, I, D> {
  /** Log and error tag, e.g. "WonderWalk". */
  tag: string;
  /** What the author builds ("walk", "session"): the status echo's key and the failure message. */
  label: string;
  /** One item ("stop", "world"): index errors. */
  noun: string;
  /** The lesson topic, named in a decline. */
  topic: string;
  model?: string;
  budget: AuthorBudget;
  system: string;
  start: string;
  /** Said when a turn has no tool call. */
  nudge: string;
  Declined: new (message: string) => Error;
  tools: { plan: FunctionDeclaration; remove: FunctionDeclaration; finish: FunctionDeclaration; decline: FunctionDeclaration };
  setPlan(s: S, a: Args): Args;
  /** The item writers. Inside a turn, writes land in the order the model called them. `replaceIndex` and `levers` are the kit's: a writer never
   *  reads them. `lever` is set when the kit rebuilds a lever's changed item (no side effects such as images). */
  writers: Array<{ decl: FunctionDeclaration; write(s: S, a: Args, opts?: { lever?: boolean }): WriteOutcome<I> }>;
  /** Tools the author works with between writes (run what it built, play it, look at it), as a coding agent runs its
   *  code. They land nothing: a result is what the author reads, and its images follow in the same turn. They run after
   *  the turn's writes, in the order called. */
  work?: Array<{ decl: FunctionDeclaration; run(s: S, a: Args, at: { items: I[] }): Promise<{ result: Args; images?: Buffer[] }> }>;
  /** The lever capability (`levers.ts`): the agent authors each item's levers, the kit rebuilds and checks them. */
  levers?: LeverCapability<S, I>;
  /** Every blocking check of the session (per item and across items), with `min` items required. `salvaged`: the budget
   *  ran out and the passing items are shipping; a target the session missed (a tier) must not stop a lesson now. */
  checks(s: S, items: I[], min: number, opts?: { salvaged: boolean }): { blocking: string[]; advisory?: string[] };
  /** One line per item in the status echo. */
  summarize(item: I, index: number): string;
  /** The look stage: the primitive says what the child sees first; the kit screenshots it, reads it blind and sends back
   *  what it finds. `objective`: what the lesson is for, a function when the author wrote it; the reader also says when an
   *  item does not practise it. `view` gets the item's place in the lesson. */
  look?: { grade: string; objective?: string | ((s: S) => string | undefined); view(s: S, item: I, at: { items: readonly I[]; index: number }): LookView };
  /** What the run record counts: the displays this author is offered and those an item shows. */
  displays?: { offered: readonly string[]; shown(item: I): ReadonlyArray<{ kind: string } | null | undefined> };
  /** The independent reader, run once at the first finish that passes the checks. Returns issues that send items back. */
  review?(s: S, items: I[], debug: AuthorDebug): Promise<string[]>;
  /** Out of budget: the items to keep (each passing every check) and a note, or null to fail. */
  salvage?(s: S, items: I[], min: number): { items: I[]; note: string } | null;
  /** Build the shipped data. Push advisories into `advisory`; it is `debug.advisories`. */
  ship(s: S, items: I[], ctx: { debug: AuthorDebug; advisory: string[]; elapsed: () => number; leversOf: (item: I) => DraftLever<I>[] }): Promise<D> | D;
}

/** Where the kit keeps an item's levers: a symbol key, so object spread (a salvage copy) carries it and JSON skips it. */
const LEVERS = Symbol('agentKitLevers');
type WithLevers<I> = I & { [LEVERS]?: { levers: DraftLever<I>[]; blocking: string[] } };
const leversOf = <I>(item: I) => (item as WithLevers<I>)[LEVERS]?.levers ?? [];

/** The eval modes this generation opens: the pin or the lesson's intent, else every mode. */
export async function openModes<M extends string>(primitiveId: string, gctx: GenerationContext, docs: Record<M, ChallengeTypeDoc>, all: readonly M[]) {
  const raw = (gctx.raw ?? {}) as { targetEvalMode?: string };
  const resolution = await resolveEvalModes(primitiveId,
    { targetEvalMode: gctx.targetEvalMode ?? raw.targetEvalMode, intent: gctx.intent, objectiveText: gctx.objective?.text }, docs);
  const picked = (resolution?.allowedTypes ?? []).filter((t): t is M => (all as readonly string[]).includes(t));
  return { open: picked.length ? picked : [...all], resolution };
}

/** The tools in the order the model sees them: plan, writers, remove, finish, decline. */
export const authorTools = (spec: Pick<AgentAuthor<never, never, never>, 'tools' | 'writers' | 'levers' | 'work'>): FunctionDeclaration[] =>
  [spec.tools.plan, ...spec.writers.map(w => (spec.levers ? withLevers(w.decl, spec.levers) : w.decl)), ...(spec.work ?? []).map(w => w.decl), spec.tools.remove, spec.tools.finish, spec.tools.decline];

// ── An objective the author writes ──────────────────────────────────────────────

/** A plan tool that also asks for the objective, in the fields the manifest uses, when the lesson came without one. */
export function planWithObjective(plan: FunctionDeclaration, needed: boolean): FunctionDeclaration {
  if (!needed) return plan;
  const schema = plan.parametersJsonSchema as { properties: Record<string, unknown>; required?: string[] };
  return { ...plan, parametersJsonSchema: { ...schema,
    properties: { ...schema.properties,
      objectiveText: { type: 'string', description: 'The full learning objective: what this child will be able to do by the end, at this grade.' },
      objectiveVerb: { type: 'string', description: "The Bloom's taxonomy verb (identify, explain, apply, etc.)" } },
    required: [...(schema.required ?? []), 'objectiveText', 'objectiveVerb'] } };
}

/** The objective a plan call wrote, shaped as the manifest's, or null when it is missing. */
export function authoredObjective(a: Args): GenerationObjective | null {
  const text = str(a.objectiveText), verb = str(a.objectiveVerb);
  return text && verb ? { id: 'obj1', text, verb } : null;
}

// ── The loop ────────────────────────────────────────────────────────────────────

export async function runAuthor<S, I, D>(spec: AgentAuthor<S, I, D>, state: S, debugExtra: Args = {}): Promise<D> {
  const looker = spec.look ? new Looker() : undefined;
  const trace = startTrace(spec.tag);
  try {
    return await runStages(spec, state, debugExtra, trace, looker);
  } catch (e) {
    trace.say('run', `stopped after ${trace.seconds}s, about $${trace.costUsd.toFixed(2)}: ${e instanceof Error ? e.message : String(e)}`, { level: e instanceof spec.Declined ? 'warn' : 'error' });
    throw e;
  } finally {
    await looker?.close();
  }
}

async function runStages<S, I, D>(spec: AgentAuthor<S, I, D>, state: S, debugExtra: Args, trace: ReturnType<typeof startTrace>, looker: Looker | undefined): Promise<D> {
  const started = Date.now();
  const elapsed = () => Date.now() - started;
  const { budget } = spec;
  const model = spec.model ?? 'gemini-flash-latest';
  const debug: AuthorDebug = { turns: 0, seconds: 0, ...debugExtra, toolCalls: [], advisories: [] };
  const contents: Content[] = [{ role: 'user', parts: [{ text: spec.start }] }];
  const tools = authorTools(spec as never);
  let items: I[] = [];
  let shipped: D | undefined;
  let reviewed = false;
  let salvaged: string | undefined;
  const min = () => (salvaged ? budget.salvageMin : budget.minItems);

  // ── The look stage ─────────────────────────────────────────────────────────
  /** What each item's screen was when it was read. */
  const looked = new WeakMap<object, string>();
  /** What the reader found on the items still in the session; whatever is left at ship goes in the advisories. */
  const lookProblems = new Map<I, string[]>();
  const lookLog: Array<Omit<ViewReading, 'png'> & { item: number; round: number; screenshot: boolean }> = [];
  let lookRounds = 0;
  let lookSkipped: string | undefined;
  let shots: Part[] = [];

  /** Reads every item not yet looked at, and returns what must go back to the author. */
  const runLook = async (lastChance = false): Promise<string[]> => {
    const stage = spec.look;
    if (!stage || !looker) return [];
    const views = items.map((item, i) => ({ item, i, view: stage.view(state, item, { items, index: i }) }));
    const fresh = views.filter(x => looked.get(x.item as object) !== x.view.html);
    if (!fresh.length) return [];
    const objective = typeof stage.objective === 'function' ? stage.objective(state) : stage.objective;
    if (elapsed() >= budget.softMs) {
      lookSkipped = `no time left: ${fresh.length} ${spec.noun}(s) shipped unread`;
      trace.say('look', lookSkipped, { level: 'warn' });
      return [];
    }
    // A rewrite after the last round is still read: nothing ships unseen. What this read finds ships as an advisory.
    const finalRead = lastChance || lookRounds >= MAX_LOOK_ROUNDS;
    lookRounds++;
    trace.say('look', `${finalRead ? 'final read' : `round ${lookRounds}`}: reading ${fresh.length} ${spec.noun}(s) as the child meets them`);
    const seen = await Promise.all(fresh.map(async ({ item, i, view }) => {
      looked.set(item as object, view.html);
      const reading = await (async () => readView(view, { grade: stage.grade, looker, objective }))()
        .catch((e): ViewReading => ({ png: null, answer: null, shortcut: null, issues: null, error: e instanceof Error ? e.message : String(e), costUsd: 0 }));
      trace.addCost(reading.costUsd);
      return { item, i, reading, drawn: !!view.drawn };
    }));
    const found: string[] = [];
    for (const { item, i, reading, drawn } of seen) {
      const { png, ...rest } = reading;
      lookLog.push({ ...rest, item: i, round: lookRounds, screenshot: !!png });
      const problems = [
        ...(reading.disagrees ? [reading.disagrees] : []),
        ...(reading.shortcut ? [`a reader who saw only the screen says a child could succeed without the idea: ${reading.shortcut}`] : []),
        ...(reading.issues ? [`a reader who saw only the screen reports: ${reading.issues}`] : []),
        ...(reading.offObjective ? [`a reader who saw only the screen says this does not practise the lesson's objective: ${reading.offObjective}`] : []),
        ...(reading.untaught ? [`the child has not been taught what this needs: ${reading.untaught}. Define it in terms, teach it first, or change the question.`] : []),
      ].map(p => `${spec.noun} ${i}: ${p}`);
      if (reading.error) trace.say('look', `${spec.noun} ${i}: the reader failed, so it has no independent check (${reading.error})`, { item: i + 1, level: 'warn' });
      else trace.say('look', `${png ? 'screenshot read' : 'no browser, read in words'}: ${problems.length} problem(s)${problems[0] ? `. First: ${problems[0]}` : ''}`, { item: i + 1, level: problems.length ? 'warn' : 'info' });
      lookProblems.set(item, problems);
      found.push(...problems);
      // A drawing the author made comes back even when the reader finds nothing: a drawing no one looked at does not ship.
      if ((problems.length || drawn) && png && !finalRead) shots.push({ text: `${spec.noun} ${i} as the child sees it:` }, { inlineData: { mimeType: 'image/png', data: png.toString('base64') } });
      if (drawn && png && !problems.length && !finalRead) found.push(`${spec.noun} ${i}: here is your own drawing as the child sees it. Fix it if it does not show what you meant; if it does, leave it.`);
    }
    return finalRead ? [] : found;
  };

  const runRecord = (): RunRecord => ({
    author: spec.tag, loop: 'author', seconds: +(elapsed() / 1000).toFixed(1), costUsd: +trace.costUsd.toFixed(4), items: items.length, rounds: debug.turns,
    look: { ran: lookRounds > 0, looked: lookLog.length, unread: items.filter(item => !looked.has(item as object)).length, screenshots: lookLog.filter(l => l.screenshot).length,
      problems: items.reduce((n, item) => n + (lookProblems.get(item)?.length ?? 0), 0), ...(lookSkipped ? { skipped: lookSkipped } : {}) },
    displays: spec.displays ? { offered: spec.displays.offered, used: tallyDisplays(items.flatMap(item => [...spec.displays!.shown(item)])) } : null,
  });

  /** The session's checks plus each item's lever checks (dropped after a salvage: the passing levers ship). */
  const checks = () => {
    const c = spec.checks(state, items, min(), { salvaged: !!salvaged });
    if (!spec.levers || salvaged) return c;
    const lever = items.flatMap((item, i) => ((item as WithLevers<I>)[LEVERS]?.blocking ?? []).map(b => `${spec.noun} ${i}: ${b}`));
    return { ...c, blocking: [...c.blocking, ...lever] };
  };

  const finalize = async (allowRevise: boolean): Promise<{ status: 'shipped' } | { status: 'revise'; blocking: string[] }> => {
    const { blocking, advisory = [] } = checks();
    if (blocking.length) return { status: 'revise', blocking };
    if (allowRevise) {
      const found = await runLook();
      if (found.length) {
        trace.say('revise', `sent back with ${found.length} problem(s) from the look`, { level: 'warn' });
        return { status: 'revise', blocking: found };
      }
    } else {
      // Out of turns with items no one has read (11-08: two rewrites shipped unread at the turn cap): read them, and what
      // the reader finds ships as an advisory.
      await runLook(true);
    }
    if (spec.review && !reviewed) {
      reviewed = true;
      const issues = await spec.review(state, items, debug).catch((error) => {
        advisory.push(`review failed: ${error instanceof Error ? error.message : String(error)}`);
        return [] as string[];
      });
      if (issues.length && allowRevise && elapsed() < budget.softMs) return { status: 'revise', blocking: issues.map(x => `review: ${x}`) };
      issues.forEach(x => advisory.push(`review: ${x}`));
    }
    items.forEach(item => (lookProblems.get(item) ?? []).forEach(p => advisory.push(`look: ${p}`)));
    debug.seconds = +(elapsed() / 1000).toFixed(1);
    debug.advisories = salvaged ? [salvaged, ...advisory] : advisory;
    debug.costUsd = +trace.costUsd.toFixed(4);
    debug.events = trace.events;
    debug.look = lookLog;
    debug.run = runRecord();
    shipped = await spec.ship(state, items, { debug, advisory: debug.advisories, elapsed, leversOf });
    debug.seconds = +(elapsed() / 1000).toFixed(1);
    return { status: 'shipped' };
  };

  while (!shipped && debug.turns < budget.maxTurns && elapsed() < budget.hardMs) {
    debug.turns++;
    trace.say('write', `turn ${debug.turns}: the author is working`);
    const response = await ai.models.generateContent({
      model,
      contents,
      config: { systemInstruction: spec.system, thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }, tools: [{ functionDeclarations: tools }] },
    });
    trace.addCost(priceCall(model, response.usageMetadata));
    const modelContent = response.candidates?.[0]?.content;
    if (!modelContent) break;
    contents.push(modelContent);
    const calls: FunctionCall[] = response.functionCalls ?? [];
    if (!calls.length) {
      const said = (modelContent.parts ?? []).map(p => p.text ?? '').join(' ').trim();
      debug.toolCalls.push({ turn: debug.turns, name: '(text, no tool call)', ok: false, note: said.slice(0, 160) || 'empty reply' });
      contents.push({ role: 'user', parts: [{ text: spec.nudge }] });
      continue;
    }
    const declined = calls.find(c => c.name === spec.tools.decline.name);
    // An author holding a lesson that passes fixes what was sent back; it does not throw the lesson away (11-08: three
    // passing worlds on "mitochondria" for a Kindergartner were dropped at turn 8).
    const holdsLesson = !!declined && (spec.salvage?.(state, items, budget.salvageMin)?.items.length ?? 0) >= budget.salvageMin;
    if (declined && !holdsLesson) throw new spec.Declined(`[${spec.tag}] declined "${spec.topic}": ${str(declined.args?.reason) || 'no reason given'}`);

    const results = new Map<number, unknown>();
    const record = (i: number, value: unknown) => {
      results.set(i, value);
      const v = value as { error?: string; checks?: { blocking?: string[] }; blocking?: string[] } | undefined;
      // A write that lands blocked is ok as a call; its first block goes in the trace, so a long run shows what it fought.
      const note = v?.error ? `${v.error}${v.blocking?.length ? `: ${v.blocking[0]}` : ''}` : v?.checks?.blocking?.[0] ? `blocked: ${v.checks.blocking[0]}` : undefined;
      debug.toolCalls.push({ turn: debug.turns, name: calls[i].name ?? '?', ok: !v?.error, ...(note ? { note: note.slice(0, 160) } : {}) });
    };
    const byName = (n: string) => calls.map((c, i) => ({ c, i })).filter(x => x.c.name === n);

    // Fixed order inside a turn: plan, removals (last first), writes, finish.
    for (const { i } of byName(spec.tools.decline.name!)) record(i, { error: `refused: you hold ${spec.noun}s that pass. Keep them, fix what was sent back, and call finish. Teach the topic at this child's level.` });
    for (const { c, i } of byName(spec.tools.plan.name!)) record(i, spec.setPlan(state, c.args ?? {}));
    for (const { c, i } of byName(spec.tools.remove.name!).sort((a, b) => Number(b.c.args?.index) - Number(a.c.args?.index))) {
      const index = Number(c.args?.index);
      if (!items[index]) record(i, { error: `no ${spec.noun} at index ${index}` });
      else { items.splice(index, 1); record(i, { ok: true, [`${spec.noun}s`]: items.length }); }
    }
    // Writes land in the order the model called them: the sequence of a lesson is the author's to design.
    for (let i = 0; i < calls.length; i++) {
      const c = calls[i];
      const writer = spec.writers.find(w => w.decl.name === c.name);
      if (!writer) continue;
      const a = c.args ?? {};
      const out = writer.write(state, a);
      if ('error' in out) { record(i, out); continue; }
      // Replacing at the next free index is a first write (11-10 canvas runs lost up to three turns to "no canvas at index 0").
      const asked = num(a.replaceIndex);
      const at = asked === items.length ? undefined : asked;
      if (at !== undefined && !items[at]) { record(i, { error: `no ${spec.noun} at index ${at}` }); continue; }
      let leverNote: Args = {};
      if (spec.levers) {
        const built = buildLevers(state, a, out.item, (st, x) => writer.write(st, x, { lever: true }), spec.levers);
        (out.item as WithLevers<I>)[LEVERS] = { levers: built.levers, blocking: built.blocking };
        leverNote = { levers: built.report.length ? built.report : ['none written'], ...(built.blocking.length ? { leverChecks: built.blocking } : {}) };
      }
      if (at !== undefined) items[at] = out.item; else items.push(out.item);
      record(i, { ok: true, index: at ?? items.length - 1, ...out.result, ...leverNote });
    }
    // Work tools run on what the turn's writes left, so "write it, then run it" works in one turn.
    for (let i = 0; i < calls.length; i++) {
      const tool = spec.work?.find(w => w.decl.name === calls[i].name);
      if (!tool) continue;
      const out = await tool.run(state, calls[i].args ?? {}, { items }).catch((e): { result: Args; images?: Buffer[] } => ({ result: { error: e instanceof Error ? e.message : String(e) } }));
      record(i, out.result);
      (out.images ?? []).forEach((png, n) => shots.push({ text: `${calls[i].name} image ${n + 1}:` }, { inlineData: { mimeType: 'image/png', data: png.toString('base64') } }));
    }
    for (const { i } of byName(spec.tools.finish.name!)) record(i, await finalize(true));

    const parts: Part[] = calls.map((c, i) => ({ functionResponse: { id: c.id, name: c.name, response: { output: results.get(i) ?? { error: 'not executed' } } } }));
    if (!shipped) {
      const remaining = budget.softMs - elapsed();
      const open = checks();
      trace.say('write', `turn ${debug.turns}: ${items.length} ${spec.noun}(s) held, ${open.blocking.length} blocking check(s)${open.blocking[0] ? `. First: ${open.blocking[0]}` : ''}`, { level: open.blocking.length ? 'warn' : 'info' });
      parts.push({ text: JSON.stringify({
        [spec.label]: items.map((item, i) => spec.summarize(item, i)),
        [`${spec.label}Checks`]: open,
        time: remaining > 0 ? `${Math.round(remaining / 1000)}s left.` : 'Time is up. Fix only blocking issues and call finish now.',
      }) });
      parts.push(...shots);
      shots = [];
    }
    contents.push({ role: 'user', parts });
  }

  if (!shipped) {
    const outcome = await finalize(false);
    if (outcome.status !== 'shipped' && spec.salvage) {
      const kept = spec.salvage(state, items, budget.salvageMin);
      if (kept && kept.items.length >= budget.salvageMin) {
        items = kept.items;
        salvaged = kept.note;
        reviewed = true; // no time for a review round; its earlier verdicts stay in the trace
        await finalize(false);
      }
    }
    if (!shipped) {
      const blocking = outcome.status === 'revise' ? outcome.blocking : [];
      const trace = debug.toolCalls.filter(t => !t.ok || t.note).slice(-4).map(t => `turn ${t.turn} ${t.name}: ${t.note}`);
      throw new Error(`[${spec.tag}] stopped after ${debug.turns} turns without a valid ${spec.label}: ${blocking.join('; ')}${trace.length ? ` | last failures: ${trace.join(' | ')}` : ''}`);
    }
  }
  trace.say('run', `shipped ${items.length} ${spec.noun}(s) in ${debug.seconds}s over ${debug.turns} turn(s), about $${trace.costUsd.toFixed(2)}`);
  return shipped!;
}

