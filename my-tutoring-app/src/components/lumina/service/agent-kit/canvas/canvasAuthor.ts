/**
 * The canvas author (USER 2026-11-09, proof of concept): the agent writes a small program the child operates (drag,
 * place, connect, set, launch) for a math, science or engineering objective, and works on it the way a coding agent
 * works on code: it writes the program, runs it, plays it with real input, looks at the screenshot, and fixes it.
 *
 * What the agent is given: a sandboxed page (React, the display kit, SVG or <canvas>, pointer events, no network), a
 * tool to write the program and a tool to play it (`stage.ts`). There is no solver and no model of the canvas in code:
 * the program decides when its goal is met and reports it with `lumina.goal`, and the agent proves it by playing.
 *
 * What code asks before it ships, as a test suite would: the canvas runs with no errors, its goal is not met at rest,
 * one playthrough of child input ends with the goal met, and one wrong attempt ends with it not met. The loop's look
 * stage then reads the first screen blind, as it does for every author.
 *
 * A preset on `runAuthor`, as `itemLoop.ts` is the kit's item preset: a primitive that offers a canvas calls
 * `authorCanvas` and draws `CanvasData.html` in an iframe with `sandbox="allow-scripts"`.
 */
import type { FunctionDeclaration } from '@google/genai';
import { compileDisplay } from '../../gen-display/compile';
import { displayDocument } from '../../gen-display/document';
import { SDK_REFERENCE } from '../../gen-display/sdkSource';
import { arr, num, runAuthor, str, type AgentAuthor, type Args, type AuthorDebug } from '../authorLoop';
import { CanvasStage, STAGE_WIDTH, type PlayStep, type Snapshot } from './stage';

export interface CanvasAsk { topic: string; grade: string; objective?: string }

interface Played { steps: PlayStep[]; after: Snapshot }
interface CanvasItem {
  title: string;
  /** What the tutor says and the host shows above the canvas. */
  ask: string;
  /** What must be true for the goal to be met, in words. For the tutor and the record; the child never sees it. */
  goal: string;
  source: string;
  params: Record<string, unknown>;
  html: string;
  rest?: Snapshot;
  /** The last playthrough that ended with the goal met. */
  proof?: Played;
  /** The last playthrough that acted and ended with the goal not met. */
  miss?: Played;
  plays: number;
}
/** One run of the canvas by its author, kept for the tester: what it did, what the page said, what it saw. */
export interface PlayRecord { version: number; steps: PlayStep[]; restGoal: boolean | null; afterGoal: boolean | null; errors: string[]; stepErrors: string[]; kept: string; png: string }
interface CanvasState { ask: CanvasAsk; stage: CanvasStage; plan?: { idea: string; childDoes: string }; versions: number; playLog: PlayRecord[] }

export interface CanvasData {
  title: string;
  ask: string;
  goal: string;
  /** The whole page: mount it in an iframe with sandbox="allow-scripts". It posts {source:'lumina-display', kind:'goal'|'scene'|'height'|'error'}. */
  html: string;
  source: string;
  params: Record<string, unknown>;
  /** The steps of child input the author showed reach the goal. */
  proof: PlayStep[];
  /** The steps of a wrong attempt the author showed leave the goal unmet. */
  miss: PlayStep[];
  /** The scene facts at rest, for the tutor. */
  scene: unknown;
  /** The scene facts the page reported after each of those two playthroughs. */
  proofScene: unknown;
  missScene: unknown;
  agentDebug: AuthorDebug;
}

export class CanvasDeclined extends Error {}

const STEP_SCHEMA = {
  type: 'array',
  description: 'What a child does, in order. Each step is real input on the page.',
  items: {
    type: 'object',
    properties: {
      do: { type: 'string', enum: ['click', 'drag', 'set', 'press', 'wait'] },
      target: { type: 'string', description: 'click and drag: a CSS selector for the element, such as #beam-2 (give your elements ids).' },
      to: { type: 'string', description: 'drag: a CSS selector for where it ends. Or use dx and dy.' },
      dx: { type: 'number', description: 'drag: page pixels moved right from the start.' },
      dy: { type: 'number', description: 'drag: page pixels moved down from the start.' },
      label: { type: 'string', description: 'set: the exact label of a kit Slider, Choice or Button.' },
      valueJson: { type: 'string', description: 'set: the new value as JSON (4, "steel").' },
      key: { type: 'string', description: 'press: a key name such as Enter or ArrowRight.' },
      ms: { type: 'number', description: 'wait: milliseconds, for an animation or a run to finish (at most 6000).' },
    },
    required: ['do'],
  },
};

const PLAN: FunctionDeclaration = { name: 'plan_canvas', description: 'Say what you will build before you write it. Call first.',
  parametersJsonSchema: { type: 'object', properties: {
    idea: { type: 'string', description: 'The one idea of the objective the child will come to see by operating the canvas.' },
    childDoes: { type: 'string', description: 'What the child does with their hands, and what the world does back.' },
  }, required: ['idea', 'childDoes'] } };
const WRITE: FunctionDeclaration = { name: 'write_canvas', description: 'Write the canvas program, or rewrite it (replaceIndex: 0). Code compiles it. A rewrite clears earlier playthroughs.',
  parametersJsonSchema: { type: 'object', properties: {
    title: { type: 'string' },
    ask: { type: 'string', description: 'What the tutor says: the task, in words for this child. It never says how to do it or what the answer is.' },
    goal: { type: 'string', description: 'What must be true for the goal to be met, exactly as your program checks it. The child never sees this.' },
    source: { type: 'string', description: 'TSX defining function Display({ params, lumina }). No imports.' },
    paramsJson: { type: 'string', description: 'Optional: a JSON object of the values the program reads from params, so the same program can be reused with other values.' },
    replaceIndex: { type: 'number', description: 'Pass 0 to replace the canvas you wrote before.' },
  }, required: ['title', 'ask', 'goal', 'source'] } };
const PLAY: FunctionDeclaration = { name: 'play', description: 'Run the canvas from a fresh load, do the steps, and get back what it reports before and after (goal, scene, text, errors), where each element with an id is on the page, and a screenshot. With no steps it shows the canvas at rest.',
  parametersJsonSchema: { type: 'object', properties: { steps: STEP_SCHEMA } } };
const REMOVE: FunctionDeclaration = { name: 'remove_canvas', description: 'Remove the canvas at index.', parametersJsonSchema: { type: 'object', properties: { index: { type: 'number' } }, required: ['index'] } };
const FINISH: FunctionDeclaration = { name: 'finish', description: 'Ship the canvas. Refused while a check blocks.', parametersJsonSchema: { type: 'object', properties: {} } };
const DECLINE: FunctionDeclaration = { name: 'decline', description: 'Only when nothing a child could operate would show any part of this topic. Ends the authoring.',
  parametersJsonSchema: { type: 'object', properties: { reason: { type: 'string' } }, required: ['reason'] } };

export function canvasPrompt(ask: CanvasAsk): string {
  return `You build ONE interactive canvas for a ${ask.grade} child.
Topic: ${ask.topic}${ask.objective ? `\nObjective: ${ask.objective}` : ''}

A canvas is a small program the child operates with their hands. They drag, place, connect, stretch, set and launch things, and the world on the screen responds. It can be mathematics (a shape to cut, points to place, a balance to level), science (a system to tune and run) or engineering (a thing to build and then test). You decide what the world is, how it is drawn, what the child can do in it and what counts as done. Make something a schema of cards and options could never be: the child's own action is the idea of the objective.

## What a strong canvas is
- The child's hands are in the world. They drag the pier to where it goes, stretch the beam, place the point, pour, cut, connect. A row of option buttons under a picture is a multiple-choice question with an animation; keep buttons for a choice that really is one (which material), and never make them the whole task.
- The task has a tension: a budget, a limit, two things that pull against each other. Then "the most of everything" is not the answer and the child has to think. Play that attempt yourself (the strongest, biggest, most of every control). If it meets the goal, the task has no idea in it yet: add the constraint that makes the idea matter.
- The world answers continuously, so the child sees cause and effect as they move things, short of the verdict itself.

## How you work
You work like a programmer with a machine to run things on.
1. plan_canvas: the idea, and what the child does.
2. write_canvas: the program.
3. play: run it. Look at the screenshot and the report. Play it as a child would, to the goal. Play a wrong attempt a real child would make. Fix what is broken or ugly and play again.
4. finish.
Nobody else checks your logic. If the physics is wrong, a drag does not land, or the goal check accepts a wrong answer, only your own playing will find it. You can call write_canvas and play in the same turn: the write lands first.

## The program
- TSX defining function Display({ params, lumina }). No imports or exports. React hooks (useState, useMemo, useEffect, useRef, useCallback) and the kit below are in scope. Draw with SVG, a <canvas> element, or plain elements; use pointer events and requestAnimationFrame freely. There is no network and no storage.
- The page is ${STAGE_WIDTH}px wide. Keep the canvas under 640px tall. Touch targets are at least 44px. A ${ask.grade} child reads few words: let the picture carry it. The page behind your canvas is dark (near #0f172a) with light text (#e2e8f0): check in your screenshot that every word can be read.
- Give every element the child acts on, and every place a thing can go, an id. play addresses elements by CSS selector and reports where each id is.
- For dragging inside an svg use the kit's Handle, or your own pointer handlers with svgPoint.
- Code computes every value shown from state. Never write a result as a literal.

## What the program reports
- lumina.goal(met): call it in an effect whenever state changes, true only while the child's work meets the goal. This is how the lesson knows the child succeeded, so check it as carefully as a test: true for every way of succeeding, false for everything else. When the idea allows many right answers, accept all of them.
- lumina.scene({ ... }): call it in the same effect with plain facts of what is on screen now (what the child has placed, the values, what the world did). The tutor reads it to talk with the child. It never holds the answer, or a verdict the child has not seen yet (whether the bridge will hold before it is tested).

## What the lesson adds around it
The lesson shows your "ask" above the canvas and a Check button below it, and tells the child whether they are right. So:
- The canvas starts in a state that does not meet the goal, and never says whether the child is right or what the answer is.
- When the world itself shows whether it worked (the bridge holds, the ball lands in the cup), make the child commit before they see it: a Test or Launch button inside the canvas runs the world. Then the child reasons first, and cannot wiggle a control until it works.
- A Reset inside the canvas is welcome after a run.

## The kit (optional)
${SDK_REFERENCE}

## Before finish
Code asks for what a test suite would:
- the canvas runs with no errors and reports goal false at rest;
- one play of steps a child could do ends with goal true;
- one play of a wrong attempt a child would plausibly make ends with goal false.
A rewrite clears these, so play again after it. Then a reader who sees only the first screen says what is unclear, and you fix that.`;
}

const parseJson = (s: string): unknown => { try { return JSON.parse(s); } catch { return s; } };

function readSteps(v: unknown): PlayStep[] {
  return arr(v).map((s): PlayStep => ({
    do: (['click', 'drag', 'set', 'press', 'wait'].includes(str(s.do)) ? str(s.do) : 'wait') as PlayStep['do'],
    ...(str(s.target) ? { target: str(s.target) } : {}), ...(str(s.to) ? { to: str(s.to) } : {}),
    ...(num(s.dx) !== undefined ? { dx: num(s.dx) } : {}), ...(num(s.dy) !== undefined ? { dy: num(s.dy) } : {}),
    ...(str(s.label) ? { label: str(s.label) } : {}), ...(s.valueJson !== undefined ? { value: parseJson(String(s.valueJson)) } : {}),
    ...(str(s.key) ? { key: str(s.key) } : {}), ...(num(s.ms) !== undefined ? { ms: num(s.ms) } : {}),
  }));
}

/** What blocks one canvas from shipping, as sentences the author can act on. */
export function canvasIssues(item: Pick<CanvasItem, 'rest' | 'proof' | 'miss'>): string[] {
  const { rest } = item;
  if (!rest) return ['no one has run this canvas: call play'];
  if (rest.errors.length) return [`it does not run clean: ${rest.errors.slice(0, 2).join('; ')}`];
  const e: string[] = [];
  if (rest.goal === null) e.push('it never calls lumina.goal, so the lesson cannot tell when the child succeeds');
  if (rest.goal === true) e.push('the goal is met at rest, before the child does anything');
  if (rest.scene == null) e.push('it never calls lumina.scene, so the tutor cannot see what is on screen');
  if (!item.proof) e.push('no play has ended with the goal met: play the steps a child would do to succeed');
  if (!item.miss) e.push('no play has shown a wrong attempt: play what a child would plausibly get wrong, and see the goal stay unmet');
  return e;
}

function spec(ask: CanvasAsk): AgentAuthor<CanvasState, CanvasItem, CanvasData> {
  return {
    tag: 'Canvas', label: 'canvas', noun: 'canvas', topic: ask.topic,
    ...(process.env.LUMINA_CANVAS_MODEL ? { model: process.env.LUMINA_CANVAS_MODEL } : {}),
    budget: { softMs: 240_000, hardMs: 330_000, maxTurns: 18, minItems: 1, salvageMin: 1 },
    system: canvasPrompt(ask),
    start: 'Build the canvas now. Start with plan_canvas.',
    nudge: 'Use the tools: write_canvas, play, then finish.',
    Declined: CanvasDeclined,
    tools: { plan: PLAN, remove: REMOVE, finish: FINISH, decline: DECLINE },
    setPlan(s, a) { s.plan = { idea: str(a.idea), childDoes: str(a.childDoes) }; return { ok: true }; },
    writers: [{ decl: WRITE, write(s, a) {
      const source = str(a.source), askText = str(a.ask), goal = str(a.goal);
      if (!askText || !goal) return { error: 'ask and goal are both needed: what the tutor says, and what your program checks' };
      const compiled = compileDisplay(source);
      if (!compiled.ok) return { error: compiled.errors.join('; ') };
      if (!/lumina\.goal\s*\(/.test(source)) return { error: 'the program never calls lumina.goal(met)' };
      const raw = a.paramsJson ? parseJson(String(a.paramsJson)) : {};
      const params = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
      s.versions++;
      return { item: { title: str(a.title) || ask.topic, ask: askText, goal, source, params, html: displayDocument(compiled.js, params), plays: 0 },
        result: { compiled: true, next: 'play it' } };
    } }],
    work: [{ decl: PLAY, async run(s, a, { items }) {
      const item = items[items.length - 1];
      if (!item) return { result: { error: 'there is no canvas yet: call write_canvas' } };
      const steps = readSteps(a.steps);
      const run = await s.stage.play(item.html, steps);
      item.plays++;
      item.rest = run.rest;
      const clean = !run.stepErrors.length && !run.after.errors.length;
      if (clean && steps.length && run.after.goal === true) item.proof = { steps, after: run.after };
      if (clean && steps.length && run.after.goal === false) item.miss = { steps, after: run.after };
      const kept = clean && steps.length ? (run.after.goal === true ? 'kept as the playthrough that reaches the goal' : run.after.goal === false ? 'kept as the wrong attempt' : 'not kept: the page reported no goal') : 'not kept';
      s.playLog.push({ version: s.versions, steps, restGoal: run.rest.goal, afterGoal: run.after.goal, errors: run.after.errors, stepErrors: run.stepErrors, kept, png: run.png.toString('base64') });
      return {
        result: {
          atRest: { goal: run.rest.goal, scene: run.rest.scene, errors: run.rest.errors },
          ...(steps.length ? { afterSteps: { goal: run.after.goal, scene: run.after.scene, errors: run.after.errors, text: run.after.text }, ...(run.stepErrors.length ? { stepErrors: run.stepErrors } : {}) } : { text: run.rest.text }),
          boxes: run.boxes,
          kept,
          stillNeeded: canvasIssues(item),
        },
        images: [run.png],
      };
    } }],
    checks(_s, items, min) {
      if (items.length < min) return { blocking: ['there is no canvas yet: call write_canvas'] };
      if (items.length > 1) return { blocking: ['one canvas ships: remove the others, or rewrite with replaceIndex: 0'] };
      return { blocking: canvasIssues(items[0]) };
    },
    summarize: item => `"${item.title}": ${item.plays} play(s), ${item.proof ? 'reaches the goal' : 'no play reaches the goal yet'}, ${item.miss ? 'a wrong attempt stays unmet' : 'no wrong attempt shown'}`,
    look: { grade: ask.grade, objective: [ask.topic, ask.objective].filter(Boolean).join('. '),
      view: (_s, item) => ({
        ask: item.ask, html: item.html,
        words: `Text on the screen: ${item.rest?.text ?? ''}\nFacts the canvas reports: ${JSON.stringify(item.rest?.scene ?? null)}`,
        design: 'This is an interactive canvas, shown before the child touches it. The child drags, taps and sets things in it, the picture responds, and a Check button under it (not shown) tells them whether they are right. A control or a Test button is part of the design, not a shortcut.',
      }) },
    salvage: (_s, items) => { const kept = items.filter(i => !canvasIssues(i).length).slice(-1); return kept.length ? { items: kept, note: 'salvaged: shipped the canvas that passes after the budget ran out' } : null; },
    ship: (s, items, { debug }) => {
      const c = items[items.length - 1];
      return { title: c.title, ask: c.ask, goal: c.goal, html: c.html, source: c.source, params: c.params, proof: c.proof?.steps ?? [], miss: c.miss?.steps ?? [],
        scene: c.rest?.scene ?? null, proofScene: c.proof?.after.scene ?? null, missScene: c.miss?.after.scene ?? null, agentDebug: { ...debug, plays: c.plays, versions: s.versions, plan: s.plan, playLog: s.playLog } };
    },
  };
}

/** Author one canvas for a topic and objective. Needs a browser on the host. */
export async function authorCanvas(ask: CanvasAsk): Promise<CanvasData> {
  const stage = new CanvasStage();
  try {
    return await runAuthor(spec(ask), { ask, stage, versions: 0, playLog: [] });
  } finally {
    await stage.close();
  }
}

/** A page a person can open to play a canvas as the lesson would host it: the ask, the sandboxed canvas, a Check button. */
export function canvasHostPage(data: Pick<CanvasData, 'title' | 'ask' | 'html'>): string {
  const json = JSON.stringify({ ask: data.ask, html: data.html }).replace(/</g, '\\u003c');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${data.title.replace(/[<&]/g, '')}</title>
<style>body{margin:0;background:#0b1220;color:#e2e8f0;font:16px/1.5 system-ui,sans-serif}main{max-width:${STAGE_WIDTH + 24}px;margin:24px auto;padding:0 12px}
h1{font-size:20px;font-weight:600;margin:0 0 12px}iframe{width:100%;border:0;display:block}
button{margin-top:12px;font:inherit;padding:10px 22px;border-radius:12px;border:1px solid rgba(34,211,238,.6);background:rgba(34,211,238,.2);color:#e2e8f0;cursor:pointer}
#said{margin-left:14px;font-weight:600}</style></head><body><main>
<h1 id="ask"></h1><iframe id="frame" sandbox="allow-scripts" height="520"></iframe>
<button id="check">Check</button><span id="said"></span>
<script type="application/json" id="data">${json}</script>
<script>
var d = JSON.parse(document.getElementById('data').textContent), frame = document.getElementById('frame'), said = document.getElementById('said'), goal = null;
document.getElementById('ask').textContent = d.ask;
frame.srcdoc = d.html;
window.addEventListener('message', function (e) {
  if (e.source !== frame.contentWindow || !e.data || e.data.source !== 'lumina-display') return;
  if (e.data.kind === 'height') frame.height = Math.min(1200, Math.max(160, Math.ceil(e.data.data)));
  if (e.data.kind === 'goal') { goal = e.data.data; said.textContent = ''; }
});
document.getElementById('check').onclick = function () { said.textContent = goal ? 'Yes, that works.' : 'Not yet. Look again and try something else.'; said.style.color = goal ? '#6ee7b7' : '#fda4af'; };
</script></main></body></html>`;
}
