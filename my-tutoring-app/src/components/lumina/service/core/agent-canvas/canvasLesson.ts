/**
 * A canvas run as an agent-canvas lesson. Used by the generator (a fresh run), the tester route and
 * `scripts/canvas-payload.mjs` (a saved run). It loads no model client, so a script can use it without a key.
 */
import type { CanvasData, PlayRecord } from '../../agent-kit/canvas/canvasAuthor';
import type { PlayStep } from '../../agent-kit/canvas/stage';
import { compileDisplay } from '../../gen-display/compile';
import { displayDocument } from '../../gen-display/document';
import type { AgentCanvasData } from '../../../primitives/visual-primitives/core/agent-canvas/AgentCanvas';
import { SHARED_PARAMS } from '../../../primitives/visual-primitives/core/agent-canvas/agentCanvasWorkspace';
import { validateAgentCanvasData } from '../../../primitives/visual-primitives/core/agent-canvas/agentCanvas.boss';

/** One problem on a shared program: its params, its words, and the two playthroughs that were run on it. */
export interface CanvasProblem {
  params: Record<string, unknown>;
  ask?: string;
  goal?: string;
  proof: PlayStep[];
  miss: PlayStep[];
  scene?: unknown;
  proofScene?: unknown;
  missScene?: unknown;
}

/**
 * A canvas run as a lesson: one challenge, with the author's two playthroughs. `rebuild` compiles the page again from
 * the saved source, so a run saved earlier carries the current page shell. A run saved before `miss` shipped keeps its
 * wrong attempt in the play log: the last clean one of the last version.
 */
export function canvasLesson(c: Omit<CanvasData, 'miss' | 'proofScene' | 'missScene'> & Partial<Pick<CanvasData, 'miss' | 'proofScene' | 'missScene'>> & { problems?: CanvasProblem[] },
  opts: { grade?: string; rebuild?: boolean } = {}): AgentCanvasData {
  const debug = (c.agentDebug ?? {}) as Record<string, unknown> & { playLog?: PlayRecord[] };
  const plays = debug.playLog ?? [];
  if (c.problems?.length) {
    // One program, several problems: each is the same source with its own params, played both ways by `canvas-check`.
    const compiled = compileDisplay(c.source);
    if (!compiled.ok) throw new Error(`the saved canvas no longer compiles: ${compiled.errors.join('; ')}`);
    return validateAgentCanvasData({
      title: c.title, description: '', ...(opts.grade ? { gradeBand: opts.grade } : {}), challengeType: 'canvas',
      // One page for the lesson (a page is 170-430 KB); each challenge carries only its params.
      page: displayDocument(compiled.js, { ...SHARED_PARAMS }),
      challenges: c.problems.map((p, i) => ({ id: `canvas-${i + 1}`, title: c.title, ask: p.ask ?? c.ask, goal: p.goal ?? c.goal,
        params: p.params ?? {}, proof: p.proof, miss: p.miss, scene: p.scene ?? null,
        ...(p.proofScene != null ? { proofScene: p.proofScene } : {}), ...(p.missScene != null ? { missScene: p.missScene } : {}) })),
      agentDebug: { ...debug, playLog: plays.map(({ png: _png, ...play }) => play) },
    });
  }
  const lastVersion = Math.max(0, ...plays.map(p => p.version));
  const wrong = plays.filter(p => p.version === lastVersion && p.steps.length && p.afterGoal === false && !p.errors.length && !p.stepErrors.length).at(-1);
  let html = c.html;
  if (opts.rebuild) {
    const compiled = compileDisplay(c.source);
    if (!compiled.ok) throw new Error(`the saved canvas no longer compiles: ${compiled.errors.join('; ')}`);
    html = displayDocument(compiled.js, c.params ?? {});
  }
  return validateAgentCanvasData({
    title: c.title, description: '', ...(opts.grade ? { gradeBand: opts.grade } : {}), challengeType: 'canvas',
    challenges: [{ id: 'canvas-1', title: c.title, ask: c.ask, goal: c.goal, html, proof: c.proof, miss: c.miss?.length ? c.miss : wrong?.steps ?? [],
      scene: c.scene ?? null, ...(c.proofScene != null ? { proofScene: c.proofScene } : {}), ...(c.missScene != null ? { missScene: c.missScene } : {}) }],
    // The author's screenshots stay in the tester's run record; a lesson payload carries the plays without them.
    agentDebug: { ...debug, playLog: plays.map(({ png: _png, ...play }) => play) },
  });
}
