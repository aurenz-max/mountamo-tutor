/**
 * Diagrams the author draws as SVG: reading where a part sits and grading where a student put its label. The author
 * says where each part is, so code knows the key; no vision model places or judges a label. Pure.
 */
import type { DiagramBlockData } from '../types';

export interface ViewBox { x: number; y: number; width: number; height: number }

/** The drawing's viewBox, or null when it has none (positions cannot be read without one). */
export function viewBoxOf(svg: string): ViewBox | null {
  const raw = svg.match(/<svg\b[^>]*?\bviewBox\s*=\s*["']([^"']+)["']/i)?.[1];
  const n = (raw ?? '').trim().split(/[\s,]+/).map(Number);
  if (n.length !== 4 || n.some(v => !Number.isFinite(v)) || n[2] <= 0 || n[3] <= 0) return null;
  return { x: n[0], y: n[1], width: n[2], height: n[3] };
}

/** How far a dropped label may sit from its part, in percent of the picture. */
export const LABEL_REACH = 18;

export interface LabelPlaced { labelId: string; position: { x: number; y: number } }

/** Whether each label sits on its own part: its part is the nearest one, and close enough to mean it. */
export function gradeDrawnLabels(labels: DiagramBlockData['labels'], placed: LabelPlaced[]) {
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
  const labelResults = placed.map(({ labelId, position }) => {
    const own = labels.find(l => l.id === labelId);
    const nearest = [...labels].filter(l => l.position).sort((a, b) => dist(a.position!, position) - dist(b.position!, position))[0];
    const correct = !!own?.position && nearest?.id === labelId && dist(own.position, position) <= LABEL_REACH;
    return { labelId, correct, reasoning: correct ? `"${own?.text}" is on the right part.` : `"${own?.text}" belongs on a different part of the picture.` };
  });
  const right = labelResults.filter(r => r.correct).length;
  return { labelResults, overallFeedback: `${right} of ${labels.length} labels are on the right parts.` };
}
