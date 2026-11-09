/**
 * The kit's item loop (USER 2026-11-08): write, look, revise. The second runner in the kit beside `runAuthor`, for
 * items assembled from the kit's surfaces (`surfaces.ts`) and displays (`displays.ts`).
 *
 *   1. One call writes every item of the session, so the author plans the set as a whole (tiers, surfaces, variety).
 *   2. Code reads each draft into an item: structure, computed difficulty, options in a shown order that is never the
 *      answer's order, and the item's own help and simplify levers (built and checked here, `buildSurfaceLevers`).
 *   3. Each item is run the way a child meets it (`look.ts`: a screenshot, a blind solve, code checks) and, while
 *      anything is wrong, sent back to the author with its screenshot and the problems, on its own branch of the
 *      conversation, all items in parallel. The best version of each item is kept.
 *   4. Items with a blocking problem left (broken structure, a code-detected shortcut, a blind solve that disagrees
 *      with the key) are dropped; advisory notes ship in the debug record.
 *
 * Any agent primitive whose items are surface items runs this; it supplies the prompt and the lesson, never a loop.
 */
import type { Content, Part } from '@google/genai';
import { ai } from '../geminiClient';
import { priceCall } from '../spend/spendMeter';
import { startTrace, tallyDisplays, type KitTrace, type RunRecord } from './trace';
import { ALL_DISPLAYS, displayMenu, displayPrompt, readDisplay, sameState, withHighlight, type Display } from './displays';
import { slotLevers, type DraftLever } from './levers';
import { Looker, lookAt, type Look } from './look';
import { FULL_REVIEW_ID, KIT_MODEL, REVIEW_VARIANTS, reviewVariant, type ReviewVariant } from './reviewVariants';
import {
  SURFACES, TIERS, difficultyOf, itemErrors, shortcutChecks, shownOrder,
  type Surface, type SurfaceItem, type SurfaceOption, type Tier,
} from './surfaces';

type Args = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const arr = (v: unknown): Args[] => (Array.isArray(v) ? v : []).map(x => (x ?? {}) as Args);

// ── The capability, as the author reads it ──────────────────────────────────

/**
 * What every author of surface items is told about the parts it can use. A primitive adds the lesson around it.
 * `without` hides displays from the author, so a bench can measure a display against the agent drawing it by hand.
 */
export const surfacePrompt = (without: readonly string[] = []) => `You assemble learning items from generic parts. For each item pick the parts that teach the objective best.

ANSWER SURFACES (what the child does):
- choose: pick the one right option (2-5 options).
- categorize: put each option into one of 2-3 categories (3-8 options).
- order: put the options in the right order (3-6 options).

DISPLAYS (what the child sees). A display is an object {kind, ...}:
${displayPrompt(ALL_DISPLAYS, without)}
When a code-drawn display can show the content, use it, including inside option cards, rather than drawing it yourself: you write a few values and code draws it the same way every time.

AN ITEM: {
  tier: "easy"|"medium"|"hard",
  surface: "choose"|"categorize"|"order",
  prompt: "what the tutor asks the child (never the answer)",
  stimulus: [displays shown above the options, may be empty],
  options: [{id, label?, display?}]  each option is a card: a label, a display, or both,
  categories: [names]  (categorize only),
  key: choose: option id | order: [option ids in order] | categorize: {optionId: category name},
  misconceptions: {optionId: "the wrong idea that leads a child to this option, said as a hint to look again; it never describes the right option"},
  help: {says: "what the tutor says", add_stimulus: [displays that show more: an example, a worked first step, or the same display again with its highlight set, which replaces it], highlight_cards: "a highlight value applied the same way to every card's display (optional)"},
  simplify: {says: "what the tutor says", remove_options: [ids]}  the same task with fewer cards,
  why: "why this item teaches the objective"
}

RULES:
- The child must use the skill to succeed: no answer in the prompt or labels, no option drawn differently or more carefully than the others, no odd one out, no order words (first, next, then) in what the child hears for an order item.
- Wrong options come from real misconceptions. Facts are true. Words suit the grade.
- Pictures must let a child tell the options apart by the feature that matters, at a glance.
- Difficulty comes from structure (closer wrong options, a misconception trap, more steps, a less familiar case), never from more reading.
- A help draws something new on screen (not only words). A simplify keeps the right answer and the task.
- Vary the surfaces and displays across the session when the objective allows.`;

// ── Reading a draft ─────────────────────────────────────────────────────────

const displays = (v: unknown) => (Array.isArray(v) ? v : []).map(readDisplay).filter((d): d is Display => !!d);

export interface SurfaceDraft { item: SurfaceItem; help?: { says: string; add: Display[]; highlightCards?: string }; simplify?: { says: string; remove: string[] }; why: string }

/** A draft as code reads it: the item (options in a shown order), its lever requests and its rationale. */
export function readDraft(raw: unknown, id: string, seed: number): SurfaceDraft {
  const a = (raw ?? {}) as Args;
  const options: SurfaceOption[] = arr(a.options).map(o => {
    const d = readDisplay(o.display);
    return { id: str(o.id), ...(str(o.label) ? { label: str(o.label) } : {}), ...(d ? { display: d } : {}) };
  });
  const surface = (SURFACES as readonly string[]).includes(str(a.surface)) ? str(a.surface) as Surface : 'choose';
  const key = surface === 'order' ? (Array.isArray(a.key) ? a.key.map(String) : [])
    : surface === 'categorize' ? Object.fromEntries(Object.entries((a.key ?? {}) as Args).map(([k, v]) => [k, String(v)]))
    : String(a.key ?? '');
  const misconceptions = Object.fromEntries(Object.entries((a.misconceptions ?? {}) as Args).map(([k, v]) => [k, str(v)]).filter(([, v]) => v));
  const base: SurfaceItem = {
    id, surface, prompt: str(a.prompt), stimulus: displays(a.stimulus), options,
    ...(surface === 'categorize' ? { categories: (Array.isArray(a.categories) ? a.categories : []).map(String) } : {}),
    key, ...(Object.keys(misconceptions).length ? { misconceptions } : {}),
    tier: (TIERS as readonly string[]).includes(str(a.tier)) ? str(a.tier) as Tier : 'medium',
    difficulty: { band: 'easy', score: 0, reasons: [] },
  };
  const item = settle(base, seed);
  const h = (a.help ?? {}) as Args, s = (a.simplify ?? {}) as Args;
  return {
    item,
    ...(str(h.says) ? { help: { says: str(h.says), add: displays(h.add_stimulus), ...(str(h.highlight_cards) ? { highlightCards: str(h.highlight_cards) } : {}) } } : {}),
    ...(str(s.says) ? { simplify: { says: str(s.says), remove: (Array.isArray(s.remove_options) ? s.remove_options : []).map(String) } } : {}),
    why: str(a.why),
  };
}

/** Options in their shown order and the difficulty computed from structure. */
function settle(item: SurfaceItem, seed: number): SurfaceItem {
  const ok = !itemErrors({ ...item, difficulty: item.difficulty }).length;
  const shown = ok ? shownOrder(item, seed) : item.options;
  const out = { ...item, options: shown };
  return { ...out, difficulty: difficultyOf(out) };
}

// ── Levers (I13): authored with the item, built and checked by code ─────────

/** The item with a help drawn: a display in the same state as one on screen replaces it; a card highlight lights every card alike. */
function applyHelp(item: SurfaceItem, help: NonNullable<SurfaceDraft['help']>): SurfaceItem {
  const stimulus = [...item.stimulus];
  for (const added of help.add) {
    const same = stimulus.findIndex(d => sameState(d, added));
    if (same >= 0) stimulus[same] = added; else stimulus.push(added);
  }
  const options = help.highlightCards
    ? item.options.map(o => { const lit = o.display && withHighlight(o.display, help.highlightCards!); return lit ? { ...o, display: lit } : o; })
    : item.options;
  return { ...item, stimulus, options };
}

/** The item's help and simplify levers, each a changed item; a lever that fails its check is dropped with a reason. */
export function buildSurfaceLevers(d: SurfaceDraft, seed: number): { levers: DraftLever<SurfaceItem>[]; refused: string[] } {
  const { item } = d;
  const levers: DraftLever<SurfaceItem>[] = [], refused: string[] = [];
  if (d.help) {
    const helped = applyHelp(item, d.help);
    const extra = shortcutChecks(helped).filter(f => !shortcutChecks(item).includes(f));
    const screen = (x: SurfaceItem) => JSON.stringify([x.stimulus, x.options.map(o => o.display)]);
    if (screen(helped) === screen(item)) refused.push('help: it adds nothing to the screen');
    else if (itemErrors(helped).length) refused.push(`help: ${itemErrors(helped)[0]}`);
    else if (extra.length) refused.push(`help: ${extra[0]}`);
    else levers.push({ kind: 'help', when: 'the learner misses once or is stuck', says: d.help.says, item: { ...helped, difficulty: difficultyOf(helped) } });
  }
  if (d.simplify) {
    const drop = new Set(d.simplify.remove);
    let simpler: SurfaceItem = { ...item, options: item.options.filter(o => !drop.has(o.id)) };
    if (item.surface === 'order') simpler = { ...simpler, key: (item.key as string[]).filter(id => !drop.has(id)) };
    if (item.surface === 'categorize') simpler = { ...simpler, key: Object.fromEntries(Object.entries(item.key as Record<string, string>).filter(([id]) => !drop.has(id))) };
    if (item.misconceptions) simpler = { ...simpler, misconceptions: Object.fromEntries(Object.entries(item.misconceptions).filter(([id]) => !drop.has(id))) };
    simpler = settle(simpler, seed + 7);
    if (item.surface === 'choose' && drop.has(item.key as string)) refused.push('simplify: it removes the right answer');
    else if (!drop.size) refused.push('simplify: it removes nothing');
    else if (itemErrors(simpler).length) refused.push(`simplify: ${itemErrors(simpler)[0]}`);
    else if (simpler.difficulty.score >= item.difficulty.score) refused.push('simplify: it is not easier by the computed difficulty');
    else levers.push({ kind: 'simplify', when: 'the learner misses twice', says: d.simplify.says, item: simpler });
  }
  return { levers, refused };
}

// ── The loop ────────────────────────────────────────────────────────────────

export interface ItemLoopSpec {
  tag: string;
  /** The whole author prompt: `SURFACE_PROMPT` plus the lesson. */
  prompt: string;
  /** The child's grade in words, for the blind solver ("grade 2"). */
  grade: string;
  /** One tier per item, in order. */
  tiers: Tier[];
  /** Revise rounds after the first look (default 2). */
  rounds?: number;
  /** Ship what passes by this time. */
  hardMs?: number;
  /** Fewer passing items than this fails the run. */
  minItems: number;
  idPrefix: string;
  seed: number;
  /** Displays hidden from the author for a bench: they are left out of what the run record says was offered. */
  hiddenDisplays?: readonly string[];
}

export interface LoopItem { item: SurfaceItem; levers: DraftLever<SurfaceItem>[]; why: string; look: Omit<Look, 'png'>; rounds: number; refusedLevers: string[] }
export interface ItemLoopResult { title: string; idea: string; items: LoopItem[]; debug: Args }

const MODEL = KIT_MODEL;

interface Generated { json: Args; content: Content; seconds: number; tokens: number; outputTokens: number; thinkingTokens: number; costUsd: number; served?: string }

async function gen(contents: Content[], trace: KitTrace): Promise<Generated> {
  const started = Date.now();
  const res = await ai.models.generateContent({ model: MODEL, contents, config: { responseMimeType: 'application/json' } });
  const costUsd = priceCall(MODEL, res.usageMetadata);
  trace.addCost(costUsd);
  const json = JSON.parse(res.text ?? '{}') as Args;
  const usage = res.usageMetadata;
  return {
    json, content: res.candidates?.[0]?.content ?? { role: 'model', parts: [{ text: res.text ?? '' }] },
    seconds: Math.round((Date.now() - started) / 1000), tokens: usage?.totalTokenCount ?? 0, outputTokens: usage?.candidatesTokenCount ?? 0, thinkingTokens: usage?.thoughtsTokenCount ?? 0, costUsd, served: res.modelVersion,
  };
}

const rank = (l: Look) => l.blocking.length * 10 + l.advisory.length;
const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** One look in a sentence: what ran, what the solver did, how many problems and the first of them. */
function lookLine(l: Look): string {
  if (l.solved.skipped) {
    const shot = l.png ? `screenshot ${l.shotSeconds}s` : 'no screenshot';
    return `${shot}, no solver. ${l.blocking.length ? `${l.blocking.length} blocking. First: ${l.blocking[0]}` : 'Code checks pass.'}`;
  }
  if (!l.shotSeconds && !l.solveSeconds) return `broken structure, not shown to the solver: ${l.blocking[0]}`;
  const how = l.png ? `screenshot ${l.shotSeconds}s, solve ${l.solveSeconds}s` : `no browser, solved from words in ${l.solveSeconds}s`;
  const solver = l.solved.error ? `the solver failed, so this item has no independent check (${l.solved.error})` : l.agree ? 'solver agreed with the key' : 'solver disagreed with the key';
  const problems = l.blocking.length + l.advisory.length;
  if (!problems) return `${how}. ${solver}. No problems.`;
  return `${how}. ${solver}. ${l.blocking.length} blocking, ${l.advisory.length} advisory. First: ${l.blocking[0] ?? l.advisory[0]}`;
}

interface Written { history: Content[]; drafts: Args[]; title: string; idea: string; costUsd: number; served?: string }

/** The one call that writes every item of the session. */
async function writeItems(spec: ItemLoopSpec, trace: KitTrace): Promise<Written> {
  const ask = `${spec.prompt}\n\nWrite ${spec.tiers.length} items, in this order of tiers: ${spec.tiers.join(', ')}.\nReturn JSON: {"title": "a short friendly title for the session", "idea": "the one idea, in a sentence", "items": [item, ...]}`;
  const history: Content[] = [{ role: 'user', parts: [{ text: ask }] }];
  trace.say('write', `the author is writing ${spec.tiers.length} items (${spec.tiers.join(', ')})`);
  const first = await gen(history, trace);
  history.push(first.content);
  const drafts = arr(first.json.items);
  if (!drafts.length) throw new Error(`${spec.tag}: the author wrote no items`);
  trace.say('write', `wrote ${drafts.length} items in ${first.seconds}s (${first.tokens} tokens: ${first.outputTokens} output, ${first.thinkingTokens} thinking)`);
  return { history, drafts, title: str(first.json.title) || 'Practice', idea: str(first.json.idea), costUsd: first.costUsd, served: first.served };
}

function selfReviewAsk(itemNo: number, tier: Tier, grade: string, problems: string[]): string {
  return `Here is item ${itemNo} as the child will see it.${problems.length ? ` Code checks found:\n${problems.map(p => `- ${p}`).join('\n')}\n` : ''}
Look at it as a ${grade} child would. Can the child tell the options apart by the feature that matters? Do the words match the picture? Could the child get it right without the skill? Is anything false or unreadable?
If nothing needs changing, return JSON {"unchanged": true}. Otherwise revise this one item, keep its tier (${tier}), and return JSON: one item.`;
}

interface ReviewCtx { spec: ItemLoopSpec; written: Written; variant: ReviewVariant; trace: KitTrace; looker: Looker; started: number; prefix: string }

/** Look at every written item and revise it as the variant says; each item on its own branch, all in parallel. */
async function reviewItems({ spec, written, variant, trace, looker, started, prefix }: ReviewCtx): Promise<ItemLoopResult> {
  const hardMs = spec.hardMs ?? 140_000;
  const rounds = spec.rounds ?? 2;
  const say: KitTrace['say'] = (stage, text, opts) => trace.say(stage, `${prefix}${text}`, opts);
  const tooLate = () => Date.now() - started >= hardMs - 60_000;
  const problemsOf = (l: Look) => [...l.blocking, ...l.advisory];

  const runOne = async (raw: Args, n: number): Promise<LoopItem & { blocking: string[]; seconds: number; costUsd: number; changed: boolean }> => {
    const id = `${spec.idPrefix}-${n + 1}`;
    const itemNo = n + 1;
    const itemStarted = Date.now();
    let itemCost = 0;
    const lookNow = async (item: SurfaceItem, what: string): Promise<Look> => {
      say('look', `${what} (${item.surface}, ${item.tier})`, { item: itemNo });
      const seen = await lookAt(item, { grade: spec.grade, looker, plan: variant.look });
      trace.addCost(seen.costUsd);
      itemCost += seen.costUsd;
      say('look', lookLine(seen), { item: itemNo, level: seen.blocking.length || seen.solved.error ? 'warn' : 'info' });
      return seen;
    };
    let draft = readDraft({ ...raw, tier: raw.tier ?? spec.tiers[n] }, id, spec.seed + n * 31);
    const firstDraft = draft;
    let look = await lookNow(draft.item, 'first look');
    let best = { draft, look };
    let used = 0;
    let selfReviewOwed = variant.selfReview;
    const branch: Content[] = [...written.history];
    // A revise round (one author call, one look) takes 30-60 s: start one only while it can finish inside the budget.
    while (variant.revise && used < rounds && (problemsOf(look).length || selfReviewOwed) && !tooLate()) {
      used++;
      const problems = problemsOf(look);
      const parts: Part[] = [{ text: selfReviewOwed
        ? selfReviewAsk(itemNo, draft.item.tier, spec.grade, problems)
        : `Here is item ${itemNo} as the child sees it, with what the checks found:\n${problems.map(p => `- ${p}`).join('\n')}\nRevise this one item so every problem is gone. Keep its tier (${draft.item.tier}). Return JSON: one item.` }];
      if (look.png) parts.push({ inlineData: { mimeType: 'image/png', data: look.png.toString('base64') } });
      branch.push({ role: 'user', parts });
      say('revise', selfReviewOwed ? `round ${used} of ${rounds}: the author is checking its own screenshot` : `round ${used} of ${rounds}: the author is revising ${problems.length} problem(s)`, { item: itemNo });
      selfReviewOwed = false;
      let next: Generated;
      try { next = await gen(branch, trace); } catch (e) {
        say('revise', `round ${used} failed, keeping the best version so far: ${messageOf(e)}`, { item: itemNo, level: 'warn' });
        break;
      }
      itemCost += next.costUsd;
      if (next.json.unchanged === true) {
        say('revise', `round ${used}: the author found nothing to change (${next.seconds}s)`, { item: itemNo });
        break;
      }
      branch.push(next.content);
      const raw2 = (next.json.items ? arr(next.json.items)[0] : next.json) ?? {};
      draft = readDraft({ ...raw2, tier: raw2.tier ?? draft.item.tier }, id, spec.seed + n * 31 + used * 101);
      say('revise', `round ${used} written in ${next.seconds}s`, { item: itemNo });
      look = await lookNow(draft.item, `look after round ${used}`);
      if (rank(look) <= rank(best.look)) best = { draft, look };
    }
    if (variant.revise && used < rounds && (problemsOf(look).length || selfReviewOwed) && tooLate()) {
      say('revise', `stopped after ${used} round(s): no time left for another inside the ${Math.round(hardMs / 1000)}s budget`, { item: itemNo, level: 'warn' });
    }
    const { levers, refused } = buildSurfaceLevers(best.draft, spec.seed + n * 31);
    const { png: _png, ...seen } = best.look;
    const itemSeconds = Math.round((Date.now() - itemStarted) / 1000);
    if (best.look.blocking.length) say('item', `dropped after ${used} round(s): ${best.look.blocking[0]}`, { item: itemNo, level: 'error' });
    else say('item', `kept after ${used} round(s), ${levers.length} lever(s), ${best.look.advisory.length} advisory note(s) left, ${itemSeconds}s`, { item: itemNo });
    return { item: best.draft.item, levers, why: best.draft.why, look: seen, rounds: used, refusedLevers: refused, blocking: best.look.blocking, seconds: itemSeconds, costUsd: itemCost, changed: best.draft !== firstDraft };
  };

  const all = await Promise.all(written.drafts.map((d, n) => runOne(d, n)));
  const kept = all.filter(x => !x.blocking.length);
  if (kept.length < spec.minItems) {
    throw new Error(`${spec.tag}: only ${kept.length} of ${all.length} items passed (${all.filter(x => x.blocking.length).map(x => `${x.item.id}: ${x.blocking[0]}`).join('; ')})`);
  }
  // What this setting costs on its own: the shared first write plus its own looks and revisions.
  const costUsd = written.costUsd + all.reduce((sum, x) => sum + x.costUsd, 0);
  const seconds = Math.round((Date.now() - started) / 1000);
  say('run', `kept ${kept.length} of ${all.length} items in ${seconds}s, about $${costUsd.toFixed(2)}`);
  const run: RunRecord = {
    author: spec.tag, loop: 'item', seconds, costUsd: +costUsd.toFixed(4), items: kept.length, rounds: all.reduce((n, x) => n + x.rounds, 0),
    look: { ran: true, looked: all.length, unread: 0, screenshots: all.filter(x => x.look.shotSeconds > 0).length, problems: kept.reduce((n, x) => n + x.look.advisory.length, 0) },
    displays: {
      offered: displayMenu(ALL_DISPLAYS).filter(k => !spec.hiddenDisplays?.includes(k)),
      used: tallyDisplays(kept.flatMap(x => [...x.item.stimulus, ...x.item.options.map(o => o.display)])),
    },
  };
  const debug: Args = {
    run,
    variant: variant.id,
    model: { requested: MODEL, served: written.served },
    seconds,
    costUsd: +costUsd.toFixed(4),
    items: all.map(x => ({ id: x.item.id, surface: x.item.surface, tier: x.item.tier, computed: x.item.difficulty.band, solver: x.look.solved.difficulty,
      rounds: x.rounds, changed: x.changed, kept: !x.blocking.length, blocking: x.blocking, advisory: x.look.advisory, refusedLevers: x.refusedLevers, drawnByHand: drawnByHand(x.item),
      seconds: x.seconds, costUsd: +x.costUsd.toFixed(4), ...(x.look.solved.error ? { solverError: x.look.solved.error } : {}) })),
    events: prefix ? trace.events.filter(e => e.text.startsWith(prefix)) : trace.events,
  };
  return { title: written.title, idea: written.idea, items: kept, debug };
}

export async function runItemLoop(spec: ItemLoopSpec): Promise<ItemLoopResult> {
  const started = Date.now();
  const trace = startTrace(spec.tag);
  const looker = new Looker();
  try {
    const written = await writeItems(spec, trace);
    return await reviewItems({ spec, written, variant: reviewVariant(FULL_REVIEW_ID)!, trace, looker, started, prefix: '' });
  } catch (e) {
    trace.say('run', `failed after ${trace.seconds}s, about $${trace.costUsd.toFixed(2)}: ${messageOf(e)}`, { level: 'error' });
    throw e;
  } finally {
    await looker.close();
  }
}

export interface BenchRun { id: string; label: string; result?: ItemLoopResult; error?: string }

/** One first write, then each review setting on those same drafts, so the settings differ only in their review. */
export async function runItemBench(spec: ItemLoopSpec, variantIds: readonly string[]): Promise<BenchRun[]> {
  const started = Date.now();
  const trace = startTrace(spec.tag);
  const looker = new Looker();
  const variants = REVIEW_VARIANTS.filter(v => variantIds.includes(v.id));
  if (!variants.length) throw new Error(`${spec.tag}: no known review setting in ${variantIds.join(', ')}`);
  try {
    const written = await writeItems(spec, trace);
    const runs = await Promise.all(variants.map(async (variant): Promise<BenchRun> => {
      const prefix = `[${variant.id}] `;
      try {
        return { id: variant.id, label: variant.label, result: await reviewItems({ spec, written, variant, trace, looker, started, prefix }) };
      } catch (e) {
        trace.say('run', `${prefix}failed: ${messageOf(e)}`, { level: 'error' });
        return { id: variant.id, label: variant.label, error: messageOf(e) };
      }
    }));
    trace.say('run', `bench finished: ${variants.length} settings on one first draft in ${trace.seconds}s, about $${trace.costUsd.toFixed(2)} in all`);
    return runs;
  } finally {
    await looker.close();
  }
}

/** Every picture on an item the author drew by hand (roadmap AD-2): which displays to build next comes from this. */
export const drawnByHand = (item: SurfaceItem) =>
  [...item.stimulus, ...item.options.map(o => o.display)].flatMap(d => (d?.kind === 'svg' ? [{ what: d.name ?? 'not named', chars: d.svg.length }] : []));

/** The shipped levers of an item: the kit's fixed slots, each lever item given its own id. */
export const shipLevers = (item: SurfaceItem, levers: readonly DraftLever<SurfaceItem>[]) =>
  slotLevers(levers, (le, slot) => ({ ...le, id: `${item.id}-${slot}` }));
