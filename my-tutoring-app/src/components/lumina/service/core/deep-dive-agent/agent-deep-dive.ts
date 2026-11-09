/**
 * Agentic DeepDive author.
 *
 * One model (gemini-flash-latest) runs a function-calling loop: it states the
 * objective, picks a lesson shape from three that code drew for this run,
 * writes every block itself through typed per-block tools, reads each block
 * back with the code checks, revises, and calls finish. The staged pipeline
 * (gemini-deep-dive.ts) has a planner that never sees the blocks and a dozen
 * parallel writers that never see each other; here one author sees the whole
 * lesson before it ships.
 *
 * Code owns option order, blanking, each block's interaction mode at this eval
 * mode, structure and leak checks, and image rendering, which starts in the
 * background as soon as an image block is written.
 */

import { ThinkingLevel, type Content, type FunctionCall, type Part } from '@google/genai';
import { ai } from '../../geminiClient';
import { startTrace, type KitTrace } from '../../agent-kit/trace';
import { svgToPng } from '../../agent-kit/svgPng';
import { drawnSvg, isDrawn, pinKey } from './drawn';
import { withSpendTally, type SpendTally } from '../../spend/spendMeter';
import { buildScopePromptSection } from '../../scopeContext';
import { generateImage, isPreReaderAudience, placeDiagramLabels } from '../gemini-deep-dive';
import { matchTemplate } from '../../../primitives/visual-primitives/core/deep-dive/composition-templates';
import type { GenerationContext } from '../../generation/generationContext';
import type {
  BlockType,
  DeepDiveAgentDebug,
  DeepDiveBlock,
  DeepDiveData,
  DeepDiveSection,
  DiagramBlockData,
  DrawerBlockData,
  GenDisplayBlockData,
  HeroImageBlockData,
  ProseBlockData,
  SeeAlsoLink,
  WrapperLayout,
} from '../../../primitives/visual-primitives/core/deep-dive/types';
import { blockIssues, blockTools, buildBlock, placement, PRE_READER_BLOCKED, sentenceLimit, TOOL_TO_BLOCK, type BlockContext } from './blocks';
import { drawShapes, lessonChecks } from './lesson';
import { buildAgentSystemPrompt, lessonTools } from './agent-prompt';
import { drawerMenu, generateDrawerBlock } from './drawers';
import { buildDisplayBlock, displayMenu } from './displays';
import { recordUse, requestDisplay } from '../../gen-display/library';
import type { DisplayTemplate } from '../../gen-display/types';
import { reviewChecks, verdictIssues, type ReviewResult } from './review';
import { isEvaluableBlock } from '../../../primitives/visual-primitives/core/deep-dive/deepDiveWorkspace';

const MODEL = 'gemini-flash-latest';
// A sectioned lesson is 10-16 blocks, about twice the old single-objective one.
const SOFT_DEADLINE_MS = Number(process.env.LUMINA_DD_AGENT_SOFT_MS ?? 110_000);
const HARD_DEADLINE_MS = Number(process.env.LUMINA_DD_AGENT_HARD_MS ?? 150_000);
const IMAGE_WAIT_MS = 45_000;
// A drawer's generator retries its own checks up to 3 times; the agent waits for it within the turn.
const DRAWER_WAIT_MS = 30_000;
// One thinking-LOW call; bounded so a slow tail cannot hold the lesson.
const REVIEW_TIMEOUT_MS = 25_000;
const REVIEW_WAIT_MS = 10_000;
// The deadlines are the real budget (as in the kit); this only stops a model that loops without writing.
const MAX_TURNS = 12;
// The reader's findings pull against each other ("given away", then "could not reach it" on the same check): the 11-08
// baseline spent all 8 turns on that. It reports on the first clean drafts; the first finish is its last word.
const MAX_TURN_REVIEWS = 2;
const THINKING: Record<string, ThinkingLevel> = { LOW: ThinkingLevel.LOW, HIGH: ThinkingLevel.HIGH };
// LOW by default: a HIGH draft took 42-84 s against 12-13 s for LOW, and the LOW
// lessons shipped with no open checks (qa/deep-dive-bench agent-r3 vs agent-r4-low).
const thinkingLevel = (turn: number) => {
  const level = turn === 1 ? process.env.LUMINA_DD_AGENT_THINKING ?? 'LOW' : process.env.LUMINA_DD_AGENT_FIX_THINKING ?? 'LOW';
  return THINKING[level.toUpperCase()] ?? ThinkingLevel.HIGH;
};
const imagesOn = () => process.env.LUMINA_DD_AGENT_IMAGES !== '0';

// ── State ────────────────────────────────────────────────────────────

interface Entry {
  uid: number;
  block: DeepDiveBlock;
  /** Resolves when the block's image or drawer work is done; false when the block cannot ship without it. */
  ready?: Promise<boolean>;
  /** The block's image work, waiting until the block passes its own checks. */
  startImages?: () => Promise<boolean> | undefined;
  imageStarted?: boolean;
}

interface Plan {
  objective: string;
  shape: string;
  title: string;
  subtitle: string;
  narrativeArc: string;
  sections: DeepDiveSection[];
  layout: WrapperLayout;
}

interface State {
  ctx: BlockContext;
  gradeLevel: string;
  plan?: Plan;
  entries: Entry[];
  nextUid: number;
  requiredSequence?: BlockType[];
  forcedLayout?: WrapperLayout;
  topic: string;
  intent?: string;
  drawerIds: Set<string>;
  displays: Map<string, DisplayTemplate>;
  requests: number;
  seeAlso?: SeeAlsoLink[];
  review?: { signature: string; result: Promise<ReviewResult> };
}

type Args = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const LAYOUTS = new Set<WrapperLayout>(['stack', 'grid_2col', 'reveal_progressive', 'masonry']);

// ── Images ───────────────────────────────────────────────────────────

/** Start the block's image work in the background. Mutates the block when the image lands. */
function startImages(block: DeepDiveBlock, args: Args, gradeLevel: string): Promise<boolean> | undefined {
  if (!imagesOn()) return undefined;
  if (block.blockType === 'hero-image') {
    const b = block as HeroImageBlockData;
    return generateImage(`Educational illustration for ${gradeLevel} students: ${str(args.imagePrompt)}. Clean, professional, visually engaging. No text overlays.`)
      .then((img) => { b.imageBase64 = img ?? ''; return true; });
  }
  if (block.blockType === 'diagram') {
    const b = block as DiagramBlockData;
    if (b.svg) return undefined;
    return generateImage(`Educational diagram for ${gradeLevel} students: ${str(args.imagePrompt)}. DARK BACKGROUND (dark navy or charcoal). Bright, luminous, high-contrast diagram elements. Scientific illustration style. Clean, professional, clearly showing distinct spatial features. Do NOT include any text, labels, or annotations in the image.`)
      .then(async (img) => {
        if (!img) return false;
        b.imageBase64 = img;
        if (b.interactionMode === 'explore') await placeDiagramLabels(img, b.labels);
        return true;
      });
  }
  if (block.blockType === 'prose' && str(args.figurePrompt)) {
    const b = block as ProseBlockData;
    return generateImage(`Educational illustration for ${gradeLevel} students: ${str(args.figurePrompt)}. Clean, informative, no text overlays.`)
      .then((img) => {
        if (img) b.figure = { imageBase64: img, caption: str(args.figureCaption), altText: str(args.figureCaption) || 'Illustration', placement: 'right' };
        return true;
      });
  }
  return undefined;
}

// ── Tools ────────────────────────────────────────────────────────────

function writeBlock(state: State, tool: string, args: Args): { entry: Entry; index?: number } | { error: string } {
  const type = TOOL_TO_BLOCK[tool];
  const built = buildBlock(type, args, state.ctx);
  if ('error' in built) return built;
  const entry: Entry = {
    uid: state.nextUid++, block: built,
    startImages: () => startImages(built, args, state.gradeLevel)?.catch((error) => {
      console.warn(`[DeepDiveAgent] image for ${type} failed:`, error);
      return type !== 'diagram';
    }),
  };
  if (args.replaceIndex !== undefined && args.replaceIndex !== null) {
    const index = Number(args.replaceIndex);
    if (!state.entries[index]) return { error: `no block at index ${index}` };
    return { entry, index };
  }
  return { entry };
}

/** A drawer section: the entry exists at once, its spec arrives when the drawer's generator passes its checks. */
function embedDrawer(state: State, args: Args): { entry: Entry; index?: number; failure: Promise<string | undefined> } | { error: string } {
  const drawerId = str(args.id);
  if (!state.drawerIds.has(drawerId)) return { error: `"${drawerId}" is not a display this lesson can embed` };
  if (!str(args.intent)) return { error: 'intent is required: say what the display must show' };
  const block: DrawerBlockData = { id: '', blockType: 'drawer', drawerId, spec: null, label: str(args.label) || drawerId, tutoringBrief: str(args.tutoringBrief), transitionCue: str(args.transitionCue), ...placement(args) };
  const entry: Entry = { uid: state.nextUid++, block };
  let failure: string | undefined;
  entry.ready = generateDrawerBlock({ drawerId, intent: str(args.intent), topic: state.topic, gradeLevel: state.gradeLevel, label: block.label })
    .then((built) => { block.spec = built.spec; return true; })
    .catch((error) => { failure = error instanceof Error ? error.message : String(error); console.warn(`[DeepDiveAgent] ${drawerId} failed:`, failure); return false; });
  const done = entry.ready.then(() => failure);
  if (args.replaceIndex !== undefined && args.replaceIndex !== null) {
    const index = Number(args.replaceIndex);
    if (!state.entries[index]) return { error: `no block at index ${index}` };
    return { entry, index, failure: done };
  }
  return { entry, failure: done };
}

function setSeeAlso(state: State, args: Args) {
  const links = (Array.isArray(args.links) ? args.links : [])
    .map((l) => ({ label: str((l as Args)?.label), question: str((l as Args)?.question) }))
    .filter((l) => l.label && l.question);
  state.seeAlso = links;
  return { ok: true, links: links.length };
}

/** A block that can ship: a diagram needs its picture, a drawer needs its spec. */
const complete = (b: DeepDiveBlock) => (b.blockType === 'diagram' ? !imagesOn() || !!(b as DiagramBlockData).imageBase64 || !!(b as DiagramBlockData).svg
  : b.blockType === 'drawer' ? (b as DrawerBlockData).spec != null : true);

/** A built display with this lesson's params; the page is built now, no code is written. */
function useDisplay(state: State, args: Args): { entry: Entry; index?: number } | { error: string } {
  const template = state.displays.get(str(args.id));
  if (!template) return { error: `"${str(args.id)}" is not a built display for this lesson` };
  const built = buildDisplayBlock(template, args.params, { id: '', label: str(args.label) || template.title, tutoringBrief: str(args.tutoringBrief), transitionCue: str(args.transitionCue), ...placement(args) });
  if ('error' in built) return built;
  const entry: Entry = { uid: state.nextUid++, block: built };
  if (args.replaceIndex !== undefined && args.replaceIndex !== null) {
    const index = Number(args.replaceIndex);
    if (!state.entries[index]) return { error: `no block at index ${index}` };
    return { entry, index };
  }
  return { entry };
}

function askForDisplay(state: State, args: Args) {
  if (!str(args.idea)) return { error: 'idea is required' };
  requestDisplay({ topic: state.topic, gradeLevel: state.gradeLevel, idea: str(args.idea), interaction: str(args.interaction), why: str(args.why) });
  state.requests++;
  return { ok: true, note: 'Recorded for the authoring job. Teach this idea with the blocks you have.' };
}

/** A block as the agent reads it back: images and display pages are named, not inlined. */
const agentView = (k: string, v: unknown) => (k === 'imageBase64' ? (v ? '[image]' : '[rendering]') : k === 'html' ? '[display page]' : k === 'svg' ? '[your drawing: see the screenshot]' : k === 'id' ? undefined : v);

function blockView(block: DeepDiveBlock, index: number, ctx: BlockContext) {
  const shown = JSON.stringify(block, agentView);
  return { index, blockType: block.blockType, block: shown.length > 1800 ? `${shown.slice(0, 1800)}…` : shown, checks: blockIssues(block, ctx) };
}

function setPlan(state: State, args: Args) {
  const layout = str(args.layout) as WrapperLayout;
  state.plan = {
    objective: str(args.objective),
    shape: str(args.shape) || 'own',
    title: str(args.title),
    subtitle: str(args.subtitle),
    narrativeArc: str(args.narrativeArc),
    sections: (Array.isArray(args.sections) ? args.sections : [])
      .map((x) => x as Args)
      .map((x) => ({ heading: str(x?.heading), ideas: (Array.isArray(x?.ideas) ? x.ideas : []).map(str).filter(Boolean) }))
      .filter((x) => x.heading),
    layout: state.forcedLayout ?? (LAYOUTS.has(layout) ? layout : 'stack'),
  };
  if (!state.plan.objective || !state.plan.title) return { error: 'objective and title are required' };
  return { ok: true, ...(state.forcedLayout ? { note: `The instructor's template fixes the layout to ${state.forcedLayout}.` } : {}) };
}

/** Start the images of blocks that pass their own checks; a block the agent is about to rewrite costs no image. */
function startPassingImages(state: State, debug: DeepDiveAgentDebug) {
  for (const entry of state.entries) {
    if (!entry.startImages || blockIssues(entry.block, state.ctx).blocking.length) continue;
    const ready = entry.startImages();
    entry.startImages = undefined;
    if (ready) { entry.ready = ready; entry.imageStarted = true; debug.imagesStarted++; }
  }
}

/** Start (or reuse) the background review of the current checks. */
function ensureReview(state: State, debug: DeepDiveAgentDebug) {
  const blocks = state.entries.map((e) => e.block);
  if (!blocks.some(isEvaluableBlock)) return undefined;
  const signature = JSON.stringify(blocks, (k, v) => (k === 'imageBase64' || k === 'html' ? undefined : v));
  if (state.review?.signature !== signature) {
    const result = reviewChecks(blocks, state.gradeLevel, REVIEW_TIMEOUT_MS, { topic: state.topic, intent: state.intent, outline: state.plan?.sections });
    result.catch(() => undefined);
    debug.reviews++;
    state.review = { signature, result };
  }
  return state.review;
}

// ── Loop ─────────────────────────────────────────────────────────────

export function generateDeepDiveAgentic(gctx: GenerationContext): Promise<DeepDiveData> {
  return withSpendTally(async (tally) => {
    const trace = startTrace('DeepDiveAgent');
    const say: KitTrace['say'] = (stage, text, opts) => { trace.addCost(tally.usd - trace.costUsd); trace.say(stage, text, opts); };
    try {
      return await authorLesson(gctx, tally, trace, say);
    } catch (error) {
      say('run', `the agent failed after about $${tally.usd.toFixed(3)}: ${error instanceof Error ? error.message : String(error)}. The staged pipeline takes over, and its cost is not in this log.`, { level: 'error' });
      throw error;
    }
  });
}

async function authorLesson(gctx: GenerationContext, tally: SpendTally, trace: KitTrace, say: KitTrace['say']): Promise<DeepDiveData> {
  const started = Date.now();
  const raw = (gctx.raw ?? {}) as { targetEvalMode?: string; templateId?: string; layoutOverride?: string };
  const gradeLevel = gctx.grade ? `grade ${gctx.grade} student` : gctx.gradeContext;
  const evalMode = gctx.targetEvalMode ?? raw.targetEvalMode;
  const preReader = isPreReaderAudience(gradeLevel);
  const gradeNum = gctx.grade ? (/^k$/i.test(gctx.grade) ? 0 : Number(gctx.grade)) : undefined;
  const drawers = drawerMenu(preReader);
  const displays = displayMenu(gctx.topic, gctx.intent, preReader);
  const ctx: BlockContext = { evalMode, preReader, grade: Number.isFinite(gradeNum) ? gradeNum : undefined, drawers: drawers.length > 0 };

  const state: State = { ctx, gradeLevel, entries: [], nextUid: 1, topic: gctx.topic, intent: gctx.intent, drawerIds: new Set(drawers.map((d) => d.id)), displays: new Map(displays.map((d) => [d.id, d])), requests: 0 };
  let templateHint: string | undefined;
  if (raw.templateId) {
    const { template, promptHint } = matchTemplate(evalMode, raw.templateId);
    if (template.id === raw.templateId) {
      state.requiredSequence = template.slots.map((s) => s.primitive).filter((t) => !(preReader && PRE_READER_BLOCKED.has(t)));
      state.forcedLayout = template.wrapperLayout;
      templateHint = promptHint;
    }
  }
  const layoutOverride = raw.layoutOverride && LAYOUTS.has(raw.layoutOverride as WrapperLayout) ? (raw.layoutOverride as WrapperLayout) : undefined;
  if (layoutOverride) state.forcedLayout = layoutOverride;

  const shapes = drawShapes();
  const debug: DeepDiveAgentDebug = { turns: 0, seconds: 0, deadline: 'none', shape: '', shapeCandidates: shapes.map((s) => s.id), objective: '', advisories: [], toolCalls: [], cost: tally, reviews: 0, imagesStarted: 0, imagesDiscarded: 0, events: trace.events };
  const systemInstruction = buildAgentSystemPrompt({
    topic: gctx.topic, gradeLevel, intent: gctx.intent, evalMode, preReader, sentenceLimit: sentenceLimit(ctx.grade),
    scopeSection: buildScopePromptSection(gctx.scope), shapes, templateHint,
    softDeadlineSeconds: Math.round(SOFT_DEADLINE_MS / 1000), drawers, displays,
  });
  const tools = [...lessonTools(drawers, preReader, displays), ...blockTools(ctx)];
  const contents: Content[] = [{ role: 'user', parts: [{ text: 'Author the DeepDive now.' }] }];
  let shipped: DeepDiveData | undefined;
  let finishAttempts = 0;
  const looked = new Set<number>();

  const elapsed = () => Date.now() - started;
  const checks = () => lessonChecks({ ctx, planned: !!state.plan, blocks: state.entries.map((e) => e.block), requiredSequence: state.requiredSequence, shape: state.plan?.shape, offered: shapes, seeAlso: preReader ? null : state.seeAlso, outline: state.plan?.sections });

  const finalize = async (allowRevise: boolean): Promise<{ status: 'shipped' } | { status: 'revise'; blocking: string[] }> => {
    const { blocking, advisory } = checks();
    if (blocking.length) return { status: 'revise', blocking };
    const verdicts = await (ensureReview(state, debug)?.result.catch((error) => {
      advisory.push(`check review failed: ${error instanceof Error ? error.message : String(error)}`);
      return { checks: [], missingIdeas: [] };
    }) ?? Promise.resolve({ checks: [], missingIdeas: [] }));
    const reviewIssues = verdictIssues(verdicts);
    if (allowRevise && reviewIssues.length && elapsed() < SOFT_DEADLINE_MS) {
      return { status: 'revise', blocking: reviewIssues.map((x) => `review: ${x}`) };
    }
    reviewIssues.forEach((x) => advisory.push(`review: ${x}`));
    const pendingWork = state.entries.filter((e) => e.ready).length;
    if (pendingWork) say('look', `waiting for ${pendingWork} image(s) and display(s) to finish`);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settled = await Promise.race([
      Promise.all(state.entries.map((e) => e.ready ?? Promise.resolve(true))),
      new Promise<boolean[]>((resolve) => { timer = setTimeout(() => resolve(state.entries.map((e) => complete(e.block))), IMAGE_WAIT_MS); }),
    ]);
    clearTimeout(timer);
    if (settled.some((ok) => !ok)) say('look', 'one or more images or displays did not finish', { level: 'warn' });
    // A diagram with no picture or a drawer with no spec has nothing to explore; it is dropped, not shipped blank.
    const kept = state.entries.filter((e, i) => settled[i] !== false && complete(e.block));
    if (kept.length < state.entries.length) advisory.push(`${state.entries.length - kept.length} block(s) dropped: a diagram's image or a display's content did not build`);
    const plan = state.plan!;
    debug.seconds = +(elapsed() / 1000).toFixed(1);
    debug.shape = plan.shape;
    debug.objective = plan.objective;
    debug.advisories = advisory;
    shipped = {
      title: plan.title,
      subtitle: plan.subtitle,
      topic: gctx.topic,
      gradeLevel,
      narrativeArc: plan.narrativeArc,
      layout: plan.layout,
      sections: plan.sections,
      blocks: kept.map((e, i) => {
        if (e.block.blockType === 'display') recordUse((e.block as GenDisplayBlockData).displayId);
        return { ...e.block, id: `block-${i}` };
      }),
      ...(state.seeAlso?.length ? { seeAlso: state.seeAlso } : {}),
      agentDebug: debug,
    };
    return { status: 'shipped' };
  };

  while (!shipped && debug.turns < MAX_TURNS && elapsed() < HARD_DEADLINE_MS) {
    debug.turns++;
    say('write', debug.turns === 1 ? 'the author is writing the lesson' : `turn ${debug.turns}: the author is revising`);
    const response = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: { systemInstruction, thinkingConfig: { thinkingLevel: thinkingLevel(debug.turns) }, tools: [{ functionDeclarations: tools }] },
    });
    const modelContent = response.candidates?.[0]?.content;
    if (!modelContent) break;
    contents.push(modelContent);
    const calls: FunctionCall[] = response.functionCalls ?? [];
    if (calls.length === 0) {
      contents.push({ role: 'user', parts: [{ text: 'Use the tools. Call finish when the lesson is complete.' }] });
      continue;
    }

    const results = new Map<number, unknown>();
    const record = (i: number, t: number, value: unknown) => {
      results.set(i, value);
      const error = value && typeof value === 'object' && 'error' in value ? String((value as { error: unknown }).error) : undefined;
      debug.toolCalls.push({ turn: debug.turns, name: calls[i].name ?? '?', ms: Date.now() - t, ok: !error, note: error?.slice(0, 160) });
      if (error) say('revise', `${calls[i].name ?? 'a tool'} was refused: ${error}`, { level: 'warn' });
    };
    const byName = (pred: (name: string) => boolean) => calls.map((c, i) => ({ c, i })).filter((x) => pred(x.c.name ?? ''));

    // Fixed order inside a turn: frame, removals and moves, writes (in call order), finish.
    for (const { c, i } of byName((n) => n === 'plan_lesson')) {
      const planned = setPlan(state, c.args ?? {});
      record(i, Date.now(), planned);
      if (!('error' in planned)) say('write', `plan: "${state.plan!.title}", shape ${state.plan!.shape}, ${state.plan!.sections.length} section(s), layout ${state.plan!.layout}`);
    }
    for (const { c, i } of byName((n) => n === 'add_see_also')) record(i, Date.now(), setSeeAlso(state, c.args ?? {}));
    for (const { c, i } of byName((n) => n === 'request_display')) record(i, Date.now(), askForDisplay(state, c.args ?? {}));
    for (const { c, i } of byName((n) => n === 'remove_block').sort((a, b) => Number(b.c.args?.index) - Number(a.c.args?.index))) {
      const index = Number(c.args?.index);
      if (!state.entries[index]) record(i, Date.now(), { error: `no block at index ${index}` });
      else { if (state.entries[index].imageStarted) debug.imagesDiscarded++; state.entries.splice(index, 1); record(i, Date.now(), { ok: true, blockCount: state.entries.length }); }
    }
    for (const { c, i } of byName((n) => n === 'move_block')) {
      const from = Number(c.args?.from);
      const to = Number(c.args?.to);
      if (!state.entries[from] || to < 0 || to >= state.entries.length) record(i, Date.now(), { error: `cannot move ${from} to ${to}` });
      else { state.entries.splice(to, 0, state.entries.splice(from, 1)[0]); record(i, Date.now(), { ok: true }); }
    }
    const written: Array<{ i: number; uid: number }> = [];
    const embeds: Array<{ i: number; uid: number; failure: Promise<string | undefined>; call: number }> = [];
    for (const { c, i } of byName((n) => n in TOOL_TO_BLOCK || n === 'embed_primitive' || n === 'use_display')) {
      const t = Date.now();
      const out = c.name === 'embed_primitive' ? embedDrawer(state, c.args ?? {})
        : c.name === 'use_display' ? useDisplay(state, c.args ?? {}) : writeBlock(state, c.name!, c.args ?? {});
      if ('error' in out) { record(i, t, out); continue; }
      if (out.index !== undefined) { if (state.entries[out.index].imageStarted) debug.imagesDiscarded++; state.entries[out.index] = out.entry; }
      else state.entries.push(out.entry);
      written.push({ i, uid: out.entry.uid });
      if ('failure' in out && out.failure instanceof Promise) embeds.push({ i, uid: out.entry.uid, failure: out.failure, call: debug.toolCalls.length });
      record(i, t, { ok: true });
      const position = out.index ?? state.entries.length - 1;
      say('write', `${out.index === undefined ? 'wrote' : 'replaced'} block ${position + 1}: ${out.entry.block.blockType} "${out.entry.block.label}"`);
    }
    if (embeds.length) say('write', `waiting for ${embeds.length} embedded display(s) to build`);
    // The agent writes around what a display actually shows, so this turn's displays are awaited (in parallel).
    // One that fails is removed and reported; one still building after the wait stays and is checked at finish.
    if (embeds.length) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const outcomes = await Promise.race([
        Promise.all(embeds.map((e) => e.failure.then((f) => ({ f, pending: false })))),
        new Promise<Array<{ f?: string; pending: boolean }>>((r) => { timer = setTimeout(() => r(embeds.map(() => ({ pending: true }))), DRAWER_WAIT_MS); }),
      ]);
      clearTimeout(timer);
      embeds.forEach((e, k) => {
        const { f, pending } = outcomes[k];
        if (pending || f === undefined) return;
        const index = state.entries.findIndex((x) => x.uid === e.uid);
        if (index >= 0) state.entries.splice(index, 1);
        const at = written.findIndex((w) => w.uid === e.uid);
        if (at >= 0) written.splice(at, 1);
        results.set(e.i, { error: `the display could not be built and was removed: ${f.slice(0, 200)}. Use another block or another display.` });
        Object.assign(debug.toolCalls[e.call], { ok: false, note: f.slice(0, 160) });
        say('revise', `an embedded display failed and was removed: ${f}`, { level: 'warn' });
      });
    }
    const imagesBefore = debug.imagesStarted;
    startPassingImages(state, debug);
    if (debug.imagesStarted > imagesBefore) say('write', `started ${debug.imagesStarted - imagesBefore} image(s) in the background`);
    // The author sees each new drawing as the student will, in this turn's report.
    const toShow = state.entries.filter((e) => isDrawn(e.block) && !looked.has(e.uid));
    const shots = await Promise.all(toShow.map(async (entry) => ({ entry, render: await svgToPng(drawnSvg(entry.block)) })));
    toShow.forEach((e) => looked.add(e.uid));
    const shown = shots.filter((x) => 'png' in x.render);
    const unseen = shots.filter((x) => 'error' in x.render);
    if (shown.length) say('look', `the author is shown ${shown.length} drawing(s)`);
    if (unseen.length) say('look', `${unseen.length} drawing(s) could not be rendered. First: ${'error' in unseen[0].render ? unseen[0].render.error : ''}`, { level: 'warn' });
    for (const { i, uid } of written) {
      const index = state.entries.findIndex((e) => e.uid === uid);
      if (index >= 0) results.set(i, { ok: true, ...blockView(state.entries[index].block, index, ctx) });
    }
    for (const { i } of byName((n) => n === 'finish')) {
      const t = Date.now();
      if (shown.length && elapsed() < SOFT_DEADLINE_MS) {
        record(i, t, { status: 'revise', blocking: ['look at the drawing screenshots in this report first, fix what is wrong, then call finish'] });
        continue;
      }
      finishAttempts++;
      const outcome = await finalize(finishAttempts === 1);
      record(i, t, outcome);
      if (outcome.status === 'revise') say('revise', `finish sent back with ${outcome.blocking.length} problem(s). First: ${outcome.blocking[0]}`, { level: 'warn' });
    }
    // The review reads only the checks, and the agent gets its findings in the same report as the code checks (~3 s).
    // A draft with blocking code checks is about to change, so it is not reviewed yet.
    let checkReview: string[] | undefined;
    const open = shipped ? [] : checks().blocking;
    say('write', shipped ? 'the lesson passed its checks' : `${written.length} block(s) written, ${open.length} blocking check(s) open${open[0] ? `. First: ${open[0]}` : ''}`, { level: open.length ? 'warn' : 'info' });
    const review = shipped || open.length || debug.reviews >= MAX_TURN_REVIEWS ? undefined : ensureReview(state, debug);
    if (review) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const verdicts = await Promise.race([review.result.catch(() => undefined), new Promise<undefined>((r) => { timer = setTimeout(() => r(undefined), REVIEW_WAIT_MS); })]);
      clearTimeout(timer);
      if (verdicts) {
        checkReview = verdictIssues(verdicts);
        say('look', `the blind reader found ${checkReview.length} problem(s)${checkReview[0] ? `. First: ${checkReview[0]}` : ''}`, { level: checkReview.length ? 'warn' : 'info' });
      }
    }

    const remainingMs = SOFT_DEADLINE_MS - elapsed();
    if (remainingMs <= 0 && debug.deadline === 'none') debug.deadline = 'soft';
    const parts: Part[] = calls.map((c, i) => ({ functionResponse: { id: c.id, name: c.name, response: { output: results.get(i) ?? { error: 'not executed' } } } }));
    if (!shipped) {
      parts.push({
        text: JSON.stringify({
          lesson: state.entries.map((e, i) => `${i}. [section ${(e.block.section ?? -1) + 1}] ${e.block.blockType === 'drawer' ? (e.block as DrawerBlockData).drawerId : e.block.blockType === 'display' ? `display ${(e.block as GenDisplayBlockData).displayId}` : e.block.blockType}: ${e.block.label} (ideas ${(e.block.ideas ?? []).join(', ') || 'none'})`),
          lessonChecks: checks(),
          ...(checkReview ? { checkReview } : {}),
          time: remainingMs > 0
            ? `${Math.round(remainingMs / 1000)}s left. Fix blocking issues and checkReview findings, then advisories.`
            : 'Time is up. Fix only blocking issues, then call finish now.',
        }),
      });
      for (const { entry, render } of shots) {
        const at = state.entries.indexOf(entry);
        if ('error' in render) {
          parts.push({ text: `Block ${at} ("${entry.block.label}"): your drawing could not be rendered, so check it is well-formed XML (write & as &amp;, close every tag). ${render.error}` });
          continue;
        }
        const pins = pinKey(entry.block);
        parts.push({ text: `Block ${at} ("${entry.block.label}") as the student will see it.${pins ? ` Pins: ${pins}.` : ''}` });
        parts.push({ inlineData: { mimeType: 'image/png', data: render.png.toString('base64') } });
      }
    }
    contents.push({ role: 'user', parts });
  }

  if (!shipped) {
    debug.deadline = elapsed() >= HARD_DEADLINE_MS ? 'hard' : debug.deadline;
    const outcome = await finalize(false);
    if (outcome.status !== 'shipped') {
      throw new Error(`[DeepDiveAgent] stopped after ${debug.turns} turns without a valid lesson: ${outcome.blocking.join('; ')}`);
    }
  }
  say('run', `shipped ${shipped!.blocks.length} blocks in ${debug.turns} turns and ${debug.seconds}s, about $${tally.usd.toFixed(3)} over ${tally.calls} calls`);
  console.log('[DeepDiveAgent] shipped', { turns: debug.turns, seconds: debug.seconds, shape: debug.shape, blocks: shipped!.blocks.map((b) => b.blockType).join(',') });
  return shipped!;
}
