import 'server-only';

/**
 * Canvas retrieval for the manifest (USER 2026-11-11). The library will hold far more canvases than the curator can read
 * in one catalog line, and a generic "agent-canvas: ESSENTIAL for [list]" entry lost to named specialists. So before the
 * manifest call, code filters the library by grade and one flash-lite call matches the rest against the lesson's
 * objectives. Each match is then shown to the curator as its own catalog entry (`canvas:<id>`, built in
 * `gemini-manifest.ts`), and the curator's pick of that entry IS the canvas: the generator loads it by id.
 *
 * Pilot canvases (passed `canvas-check`, not promoted) join the pool only for a pilot student (`pilotVotes.ts`).
 *
 * Failsafe: an enhancement, never a gate. No key, an error or the time budget returns no offers, and the lesson is built
 * from the specialists alone.
 */
import { Type, type Schema } from '@google/genai';
import { ai } from '../../geminiClient';
import { CANVAS_LIBRARY, type CanvasLibraryEntry } from './library';
import { CANVAS_PILOT } from './library/pilot';
import { heldCanvasIds, isPilotStudent } from './pilotVotes';

export interface CanvasOffer {
  entry: CanvasLibraryEntry;
  /** A pilot canvas: not promoted; the lesson shows the vote when it finishes. */
  pilot: boolean;
  /** The lesson objectives it matched. */
  objectiveIds: string[];
}

/** At most this many canvases offered per objective. */
const PER_OBJECTIVE = 2;
const TIMEOUT_MS = 6000;

const BANDS: Record<string, string[]> = {
  toddler: ['K'], preschool: ['K'], kindergarten: ['K'],
  elementary: ['1', '2', '3', '4', '5'], 'middle-school': ['6', '7', '8'], 'high-school': ['9', '10', '11', '12'],
};

/** The library grade labels an objective is at: its own grade when it has one, else the lesson's band. Null = any. */
export function gradesFor(grade?: string | null, gradeLevel?: string | null): string[] | null {
  const g = grade?.trim().toUpperCase();
  if (g) {
    if (g === 'K' || g.startsWith('KIND')) return ['K'];
    const n = g.match(/\d+/)?.[0];
    if (n) return [String(Number(n))];
  }
  return BANDS[(gradeLevel ?? '').trim().toLowerCase()] ?? null;
}

/** The pool a lesson may draw from: the library, plus unheld pilot canvases for a pilot student. */
export function canvasPool(studentId?: string | null): Array<{ entry: CanvasLibraryEntry; pilot: boolean }> {
  const promoted = new Set(CANVAS_LIBRARY.map(c => c.id));
  const pool = CANVAS_LIBRARY.map(entry => ({ entry, pilot: false }));
  if (isPilotStudent(studentId)) {
    const held = heldCanvasIds();
    for (const entry of CANVAS_PILOT) if (!promoted.has(entry.id) && !held.has(entry.id)) pool.push({ entry, pilot: true });
  }
  return pool;
}

/** Find a library or pilot canvas by id, for the generator. Pilot entries are found for any student: the gate is the offer. */
export function findCanvas(id: string): { entry: CanvasLibraryEntry; pilot: boolean } | null {
  const lib = CANVAS_LIBRARY.find(c => c.id === id);
  if (lib) return { entry: lib, pilot: false };
  const pilot = CANVAS_PILOT.find(c => c.id === id);
  return pilot ? { entry: pilot, pilot: true } : null;
}

export async function canvasCandidates(ask: {
  topic: string;
  gradeLevel?: string;
  objectives?: Array<{ id: string; text: string; grade?: string }>;
  studentId?: string | null;
}): Promise<CanvasOffer[]> {
  const pool = canvasPool(ask.studentId);
  if (!pool.length) return [];
  const objectives = ask.objectives?.length ? ask.objectives : [{ id: 'topic', text: ask.topic }];
  // Code filters by grade; the model only reads skills.
  const eligible = objectives.map(o => {
    const grades = gradesFor(o.grade, ask.gradeLevel);
    return pool.filter(p => !grades || p.entry.grades.some(g => grades.includes(g.toUpperCase())));
  });
  const union = Array.from(new Map(eligible.flat().map(p => [p.entry.id, p])).values());
  if (!union.length) return [];

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      matches: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            objective: { type: Type.INTEGER, description: 'The objective number.' },
            canvases: { type: Type.ARRAY, items: { type: Type.STRING, enum: union.map(p => p.entry.id) }, description: 'Canvas ids that practise this objective, best first. Empty when none does.' },
          },
          required: ['objective', 'canvases'],
        },
      },
    },
    required: ['matches'],
  };
  const prompt = `A lesson is being planned. For each objective, list the hands-on canvases whose activity practises that objective's skill: operating the canvas must be doing what the objective asks, at this level. A canvas on the same topic that practises a different skill is not a match. Most objectives match none; answer an empty list for those.

Lesson topic: ${ask.topic}

Objectives:
${objectives.map((o, i) => `${i + 1}. ${o.text}${o.grade ? ` (grade ${o.grade})` : ''}`).join('\n')}

Canvases:
${union.map(p => `- ${p.entry.id} (grades ${p.entry.grades.join(', ')}): ${p.entry.summary}`).join('\n')}`;

  try {
    const call = ai.models.generateContent({ model: 'gemini-flash-lite-latest', contents: prompt, config: { responseMimeType: 'application/json', responseSchema: schema } });
    const timeout = new Promise<null>(r => setTimeout(() => r(null), TIMEOUT_MS));
    const response = await Promise.race([call, timeout]);
    if (!response) { console.warn('[canvasCandidates] timed out; no canvas offers'); return []; }
    const parsed = JSON.parse(response.text ?? '{}') as { matches?: Array<{ objective?: number; canvases?: string[] }> };
    const offers = new Map<string, CanvasOffer>();
    for (const m of parsed.matches ?? []) {
      const i = (m.objective ?? 0) - 1;
      const o = objectives[i];
      if (!o) continue;
      const allowed = new Map(eligible[i].map(p => [p.entry.id, p]));
      for (const id of (m.canvases ?? []).filter(id => allowed.has(id)).slice(0, PER_OBJECTIVE)) {
        const p = allowed.get(id)!;
        const offer = offers.get(id) ?? { entry: p.entry, pilot: p.pilot, objectiveIds: [] };
        offer.objectiveIds.push(o.id);
        offers.set(id, offer);
      }
    }
    const list = Array.from(offers.values());
    console.log(`[canvasCandidates] ${union.length} eligible, offered: ${list.map(c => `${c.entry.id}${c.pilot ? ' (pilot)' : ''} -> ${c.objectiveIds.join(',')}`).join('; ') || 'none'}`);
    return list;
  } catch (e) {
    console.warn('[canvasCandidates] failed; no canvas offers:', e instanceof Error ? e.message : e);
    return [];
  }
}
