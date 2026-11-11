/**
 * Agent Canvas's generator. A lesson is served a canvas from the checked library (`library/`, written only by
 * `scripts/canvas-check.mjs --promote`): no author run, no browser, one small model call that says which library canvas,
 * if any, teaches this objective. Code then builds the lesson from that canvas's program and problems.
 *
 * Authoring a new canvas (`agent-kit/canvas/canvasAuthor.ts`) takes minutes and needs Chromium, so it is not on the
 * lesson path. It runs in the tester and the scripts, and here only when LUMINA_CANVAS_LIVE=1 and nothing in the library
 * fits. The path from an authored canvas to the library is `/canvas-primitive`.
 */
import { Type, type Schema } from '@google/genai';
import { ai } from '../../geminiClient';
import type { GenerationContext } from '../../generation/generationContext';
import type { AgentCanvasData } from '../../../primitives/visual-primitives/core/agent-canvas/AgentCanvas';
import { canvasLesson, type CanvasProblem } from './canvasLesson';
import { CANVAS_LIBRARY, type CanvasLibraryEntry } from './library';
import { findCanvas } from './canvasCandidates';

/** A lesson shows at most this many problems of one canvas, in the spec's order (its progression). */
const MAX_PROBLEMS = 5;

interface LibraryCanvas { id: string; title: string; source: string; problems: CanvasProblem[] }

const gradeWords = (g?: string) => (!g ? 'elementary' : g.toUpperCase() === 'K' ? 'Kindergarten' : /^\d+$/.test(g) ? `grade ${g}` : g);

/** The library canvas that teaches this objective, or null. The model reads the objective; code only offers what exists. */
export async function pickCanvas(ask: { topic: string; grade: string; objective: string }, library: readonly CanvasLibraryEntry[] = CANVAS_LIBRARY): Promise<CanvasLibraryEntry | null> {
  if (!library.length) return null;
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      canvas: { type: Type.STRING, enum: [...library.map(c => c.id), 'none'], description: 'The id of the canvas that teaches this objective, or none.' },
      why: { type: Type.STRING, description: 'One sentence.' },
    },
    required: ['canvas', 'why'],
  };
  const prompt = `A lesson needs an interactive canvas for one objective. Choose the canvas whose activity IS this objective: operating it must practise the same skill, at this grade. If none does, answer none. A canvas on a neighbouring topic is none.

Lesson topic: ${ask.topic}
Grade: ${ask.grade}
Objective: ${ask.objective || '(none given: use the topic)'}

Canvases:
${library.map(c => `- ${c.id} (grades ${c.grades.join(', ')}): ${c.summary}`).join('\n')}`;
  const response = await ai.models.generateContent({ model: 'gemini-flash-lite-latest', contents: prompt, config: { responseMimeType: 'application/json', responseSchema: schema } });
  const picked = JSON.parse(response.text ?? '{}') as { canvas?: string; why?: string };
  console.log(`[AgentCanvas] library pick for "${ask.topic}": ${picked.canvas} (${picked.why ?? ''})`);
  return library.find(c => c.id === picked.canvas) ?? null;
}

/** A library (or pilot) canvas as a lesson: its program, and its problems in order. */
export async function libraryLesson(entry: CanvasLibraryEntry, grade?: string, opts: { pilot?: boolean; studentId?: string } = {}): Promise<AgentCanvasData> {
  const c = await entry.load() as LibraryCanvas;
  const problems = c.problems.slice(0, MAX_PROBLEMS);
  const lesson = canvasLesson({ title: c.title, ask: problems[0].ask ?? '', goal: problems[0].goal ?? '', html: '', source: c.source, params: problems[0].params,
    proof: problems[0].proof, scene: null, problems, agentDebug: { library: c.id, ...(opts.pilot ? { pilot: true } : {}) } as never }, { grade });
  return { ...lesson, canvasId: c.id, ...(opts.pilot ? { pilot: { studentId: opts.studentId ?? null } } : {}) };
}

export async function generateAgentCanvas(gctx: GenerationContext): Promise<AgentCanvasData> {
  const grade = gradeWords(gctx.grade ?? gctx.gradeContext);
  const objective = [gctx.objective?.text, gctx.intent].filter(Boolean).join('. ');
  // The manifest picked a canvas by its own catalog entry (`canvas:<id>`, see canvasCandidates.ts): serve that one.
  const placed = typeof gctx.raw.canvasId === 'string' ? findCanvas(gctx.raw.canvasId) : null;
  if (placed) return libraryLesson(placed.entry, grade, { pilot: placed.pilot, ...(typeof gctx.raw.pilotStudentId === 'string' ? { studentId: gctx.raw.pilotStudentId } : {}) });
  const entry = await pickCanvas({ topic: gctx.topic, grade, objective });
  if (entry) return libraryLesson(entry, grade);
  if (process.env.LUMINA_CANVAS_LIVE === '1') {
    const { authorCanvas } = await import('../../agent-kit/canvas/canvasAuthor');
    const c = await authorCanvas({ topic: gctx.topic, grade, ...(objective ? { objective } : {}) });
    console.log(`[AgentCanvas] authored live "${c.title}": ${c.proof.length} proof steps, ${c.miss.length} miss steps`);
    return canvasLesson(c, { grade });
  }
  throw new Error(`No checked canvas in the library teaches "${objective || gctx.topic}". Author one and promote it (/canvas-primitive), or set LUMINA_CANVAS_LIVE=1 to author live.`);
}
