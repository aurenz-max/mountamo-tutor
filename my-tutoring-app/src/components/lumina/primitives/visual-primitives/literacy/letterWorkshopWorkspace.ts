/**
 * Letter workshop's task, scene and check reading on the shared teaching workspace (the boss is
 * `letterWorkshop.boss.ts`). Pure: the component, the boss and any probe read the same task and scene. The paper
 * checks the writing itself (geometry, then on copy/write the vision judge), so no key is published. Trace and copy
 * show the letter on screen; write does not: the tutor says its name, which is the task, and the shape stays the
 * learner's.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { LetterWorkshopChallenge } from './LetterWorkshop';
import { getLetterTemplate, type LetterTemplate, type TraceAssessment } from './letterWorkshopGeometry';
import type { LetterWorkshopMiss } from './letterWorkshop.card';

export { GEOMETRY_MISSES, READING_MISSES, type LetterWorkshopMiss } from './letterWorkshop.card';

const NAMES = ['ay', 'bee', 'see', 'dee', 'ee', 'eff', 'jee', 'aitch', 'eye', 'jay', 'kay', 'ell', 'em', 'en', 'oh', 'pee', 'cue', 'ar', 'ess', 'tee', 'you', 'vee', 'double you', 'ex', 'why', 'zee'];

/** How a letter's NAME is said ("bee"), so the tutor never says its sound. */
export const letterNameSaid = (letter: string) => NAMES[letter.toLowerCase().charCodeAt(0) - 97] ?? letter;

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

/** The checked writing in the learner's terms: how many strokes, the judge's reading when it had one, the check's own tip. */
export const describeWriting = (strokes: number, writtenAs: string | null, feedback: string) =>
  `Made ${strokes} ${strokes === 1 ? 'stroke' : 'strokes'} on the paper${writtenAs ? `; it was read as "${writtenAs}"` : ''}. `
  + `The paper's check said: ${feedback}`;

const MIRRORS: Record<string, string> = { b: 'd', d: 'b', p: 'q', q: 'p' };

/** What a wrong check shows (`LetterWorkshopMiss`, the card): the judge's confident reading first, then geometry. */
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

/** The scene the tutor reads; the lever set adds what its pulled levers show (`leverScene`). */
export function workspaceScene(challenge: LetterWorkshopChallenge, view: LetterWorkshopView): SceneOf {
  const t = getLetterTemplate(challenge.templateId);
  const what = challenge.part ? `the first part of the ${t.letterCase} letter ${glyph(t)}` : `the ${t.letterCase} letter ${glyph(t)}`;
  const shown = challenge.type === 'trace'
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
      shown,
      strokesDrawn: view.strokes,
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
