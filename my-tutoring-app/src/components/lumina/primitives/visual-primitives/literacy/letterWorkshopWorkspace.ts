/**
 * Letter workshop on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md, batch C13).
 *
 * Pure: the component and any probe read the same assignment and scene. The paper checks the writing itself
 * (geometry, then on copy/write the vision judge), so no key is published. Trace and copy show the letter on
 * screen; write does not: the tutor says its name, which is the task, and the shape stays the learner's.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { LetterWorkshopChallenge } from './LetterWorkshop';
import { getLetterTemplate, type LetterTemplate, type TraceAssessment } from './letterWorkshopGeometry';
import { letterNameSaid } from './useLetterWorkshopCue';

const glyph = (t: LetterTemplate) => t.letterCase === 'uppercase' ? t.letter.toUpperCase() : t.letter.toLowerCase();

type Point = { x: number; y: number };
export const pathLength = (points: readonly Point[]) =>
  points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - points[i].x, p.y - points[i].y), 0);

/** The start of a stroke, up to `length` along it (the last point interpolated). */
export function strokePrefix(points: readonly Point[], length: number): Point[] {
  const out: Point[] = [points[0]];
  let walked = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], step = Math.hypot(b.x - a.x, b.y - a.y);
    if (walked + step >= length) {
      const r = step ? (length - walked) / step : 0;
      out.push({ x: a.x + (b.x - a.x) * r, y: a.y + (b.y - a.y) * r });
      return out;
    }
    out.push(b); walked += step;
  }
  return out;
}

/** A practice item's part of the letter (`part`): its first stroke, or the first half of a one-stroke letter. */
export function partOf(t: LetterTemplate): Point[][] {
  return t.strokes.length > 1 ? [t.strokes[0]] : [strokePrefix(t.strokes[0], pathLength(t.strokes[0]) / 2)];
}

/** The strokes the paper draws and checks: the letter, or on a part practice item, its part. */
export function templateOf(challenge: LetterWorkshopChallenge): LetterTemplate {
  const t = getLetterTemplate(challenge.templateId);
  return challenge.part ? { ...t, id: `${t.id}#part`, strokes: partOf(t) } : t;
}

/** The ask, as the screen prints it on trace and copy, and as the tutor says it on write. */
export function letterTask(challenge: LetterWorkshopChallenge): string {
  const t = getLetterTemplate(challenge.templateId);
  const part = challenge.part ? 'the first part of ' : '';
  if (challenge.type === 'trace') return `Trace ${part}${t.letterCase} ${t.letter} on the writing paper.`;
  if (challenge.type === 'copy') return `Copy ${part}${t.letterCase} ${t.letter} beside the model. Use the writing lines.`;
  return `Write the ${t.letterCase} letter ${t.letter.toUpperCase()} (its name, said "${letterNameSaid(t.letter)}") on the writing lines.`;
}

export function workspaceAssignment(challenge: LetterWorkshopChallenge): TeachingAssignment {
  return { id: challenge.id, task: letterTask(challenge), response: 'gesture' };
}

/** The checked writing in the learner's terms: how many strokes, the judge's reading when it had one, the check's own tip. */
export const describeWriting = (strokes: number, writtenAs: string | null, feedback: string) =>
  `Made ${strokes} ${strokes === 1 ? 'stroke' : 'strokes'} on the paper${writtenAs ? `; it was read as "${writtenAs}"` : ''}. `
  + `The paper's check said: ${feedback}`;

/**
 * What a wrong check shows (`TeachingAttempt.miss`, handoff 20), from what the check read:
 * - the vision judge's confident reading (copy, write) when it is another letter: `wrong_case` (the target in the
 *   other case), `reversed` (its mirror: b/d, p/q), `other_letter`;
 * - geometry otherwise, the first failing measure the paper's tip is about: `stroke_count` (more or fewer strokes
 *   than the letter has), `start_or_order` (a stroke starts away from its start), `part_left_out` (part of the
 *   letter is not drawn), `extra_ink` (marks off the letter), `direction_or_shape` (on the letter, the wrong way
 *   or the wrong size).
 */
export type LetterWorkshopMiss = 'other_letter' | 'reversed' | 'wrong_case'
  | 'stroke_count' | 'start_or_order' | 'part_left_out' | 'extra_ink' | 'direction_or_shape';

export const GEOMETRY_MISSES: readonly LetterWorkshopMiss[] = ['stroke_count', 'start_or_order', 'part_left_out', 'extra_ink', 'direction_or_shape'];
export const READING_MISSES: readonly LetterWorkshopMiss[] = ['other_letter', 'reversed', 'wrong_case'];

const MIRRORS: Record<string, string> = { b: 'd', d: 'b', p: 'q', q: 'p' };

export function letterWorkshopMiss(challenge: LetterWorkshopChallenge,
  work: { assessment: TraceAssessment; writtenAs: string | null }): LetterWorkshopMiss {
  const t = getLetterTemplate(challenge.templateId), read = work.writtenAs?.trim();
  if (read && read !== t.letter) {
    if (read.toLowerCase() === t.letter.toLowerCase()) return 'wrong_case';
    if (MIRRORS[t.letter] === read) return 'reversed';
    return 'other_letter';
  }
  const a = work.assessment, trace = challenge.type === 'trace';
  if (!a.strokeCountMatch) return 'stroke_count';
  if (a.startAccuracy < 1) return 'start_or_order';
  if (a.coverage < (trace ? 0.9 : 0.8)) return 'part_left_out';
  if (a.precision < (trace ? 0.92 : 0.85)) return 'extra_ink';
  return 'direction_or_shape';
}

export interface LetterWorkshopView {
  strokes: number;
  /** Write: the model a checked attempt revealed, kept for Try again. */
  modelRevealed: boolean;
}

export function workspaceScene(challenge: LetterWorkshopChallenge, view: LetterWorkshopView): WorkspaceScene {
  const t = getLetterTemplate(challenge.templateId);
  const what = challenge.part ? `the first part of the ${t.letterCase} letter ${glyph(t)}` : `the ${t.letterCase} letter ${glyph(t)}`;
  const onScreen = challenge.type === 'trace'
    ? `${what.charAt(0).toUpperCase()}${what.slice(1)} is drawn on the paper as a dotted path to trace over.`
    : challenge.type === 'copy'
      ? `A model of ${what} is printed beside the blank writing paper.`
      : view.modelRevealed
        ? 'After the last check a model of the letter is shown beside the blank writing paper.'
        : 'Nothing on the screen shows or names the letter: the learner knows it only from you saying its name. '
          + 'Say its NAME, never its sound, a word that starts with it, or its shape.';
  return {
    objects: [],
    facts: {
      kind: challenge.type,
      onScreen,
      strokesDrawn: view.strokes,
      constraints: 'The learner writes on the writing paper with a finger, pen or mouse and presses Check; the paper '
        + 'checks the writing itself. You cannot draw, trace or clear.',
    },
  };
}

/**
 * The journey's drawn answer, in the paper's own coordinates: the letter's model strokes, densified, which every mode's
 * check accepts; the wrong one is the same strokes each drawn backwards (`start_or_order`).
 */
export function letterWorkshopHarnessStrokes(challenge: LetterWorkshopChallenge, wrong: boolean): { x: number; y: number }[][] {
  return templateOf(challenge).strokes.map(stroke => {
    const dense = stroke.length < 2 ? [...stroke] : stroke.slice(1).flatMap((b, k) => {
      const a = stroke[k], n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 6));
      return Array.from({ length: n }, (_, i) => ({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n }));
    }).concat([stroke[stroke.length - 1]]);
    return wrong ? dense.reverse() : dense;
  });
}
