/**
 * agent-canvas on the shared tutor/JEV teaching workspace. The canvas is a program in a sandboxed frame; the host knows
 * only what the page reports: whether its goal is met, and plain facts of what is on screen (`lumina.scene`, which the
 * author is told never holds the answer). The scene passes those facts on; the goal the program checks stays out of it.
 */
import type { SceneOf } from '../../../../components/live-activity/bossLevers';
import type { PlayStep } from '../../../../service/agent-kit/canvas/stage';

/** One canvas: a program the child operates, with the author's own two playthroughs as its record. */
export interface CanvasChallenge {
  id: string;
  title: string;
  /** What the child is asked. Never how, never the answer. */
  ask: string;
  /** What the program checks, in words. For QA; never shown and never sent to the tutor. */
  goal: string;
  /** The whole page, mounted with sandbox="allow-scripts". Absent when the lesson shares one page (`AgentCanvasData.page`). */
  html?: string;
  /** This problem's values for the lesson's shared page. */
  params?: Record<string, unknown>;
  /** The author's playthrough that reached the goal, and its wrong attempt that did not. */
  proof: PlayStep[];
  miss: PlayStep[];
  /** What the page reported at rest and after each playthrough. */
  scene: unknown;
  proofScene?: unknown;
  missScene?: unknown;
}

/** Where a shared page takes its params: `displayDocument` writes this object as JSON, and the host swaps in each problem's. */
export const SHARED_PARAMS = { __LUMINA_PARAMS__: true } as const;
const SHARED_PARAMS_JSON = JSON.stringify(SHARED_PARAMS);

/** The page one challenge runs: its own, or the lesson's shared page with this problem's params written in. */
export function canvasPage(item: Pick<CanvasChallenge, 'html' | 'params'>, page?: string): string {
  if (item.html) return item.html;
  if (!page || !page.includes(SHARED_PARAMS_JSON)) return '';
  // `<` is escaped so a string value can never close the page's script tag.
  return page.split(SHARED_PARAMS_JSON).join(JSON.stringify(item.params ?? {}).replace(/</g, '\\u003c'));
}

export interface CanvasTry { work: string; correct: boolean }

/** The page's scene facts as one line. */
export const sceneWords = (scene: unknown): string =>
  scene == null ? 'nothing reported yet' : (typeof scene === 'string' ? scene : JSON.stringify(scene)).slice(0, 500);

/** The learner's work in words: what the canvas shows now. Never the goal. */
export const describeCanvasWork = (scene: unknown): string => `the canvas now: ${sceneWords(scene)}`.slice(0, 300);

export function canvasScene(item: CanvasChallenge, view: { scene: unknown; tries: readonly CanvasTry[]; solved: boolean }): SceneOf {
  return { objects: [], facts: {
    task: 'operate the canvas (drag, place, set, run) until it does what the prompt asks, then press Check; more than one finished canvas can be right',
    prompt: item.ask,
    canvas: item.title,
    now: sceneWords(view.scene ?? item.scene),
    step: view.solved ? 'it worked' : view.tries.length ? 'trying again' : 'not started',
    tries: view.tries.length ? view.tries.map((t, i) => `try ${i + 1}: ${t.work}`).join('; ').slice(0, 400) : 'none yet',
    constraints: 'Check judges the canvas. Say what the canvas shows and what changed when the learner acted; never say what to set, where to put a thing, or which values meet the goal.',
  } };
}
