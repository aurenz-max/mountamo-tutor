/**
 * Light and shadow lab on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md).
 *
 * Pure: the component, the journey and the tests read the same options, assignment, scene, work and miss.
 * Every item is one tapped choice and Check, judged by the activity against the shadow computed in code
 * from the item's sun position, so the tutor is never handed the shadow or the time.
 *
 * The choices are built here, not taken from the generator: its distractors were free text ("Morning",
 * "East") beside a key printed as "West (right), Long", so the key was the only option in its own format.
 * Every option now has the key's form, and each wrong one is a known error (the shadow on the sun's side,
 * the length of a high sun for a low one, the time on the other side of noon).
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { stableShuffle } from '../../../utils/choiceOrder';
import type { RelativeLength, ShadowChallenge, ShadowDirection, SunPosition } from './LightShadowLab';

export const DIRECTION_LABELS: Record<ShadowDirection, string> = { E: 'East (left)', W: 'West (right)', N: 'Directly below' };
export const LENGTH_LABELS: Record<RelativeLength, string> = { short: 'Short', medium: 'Medium', long: 'Long' };

/** The bins the generator and the drawing share: azimuth 0 = east (left), 180 = west (right). */
export const shadowDirectionOf = (azimuth: number): ShadowDirection => azimuth < 80 ? 'W' : azimuth > 100 ? 'E' : 'N';
export const shadowLengthOf = (altitude: number): RelativeLength => altitude < 30 ? 'long' : altitude <= 60 ? 'medium' : 'short';
/** The item's key, recomputed from its sun position, never trusted from the payload. */
export const keyShadow = (c: ShadowChallenge) => ({ direction: shadowDirectionOf(c.sunPosition.azimuth), relativeLength: shadowLengthOf(c.sunPosition.altitude) });

export const comboLabel = (d: ShadowDirection, l: RelativeLength) => `${DIRECTION_LABELS[d]}, ${LENGTH_LABELS[l]}`;

/** "10 AM", "10:00am", "10:00 A.M." all print as "10:00 AM", so no option stands out by its format. */
export function normalizeTime(time: string): string {
  const m = /(\d{1,2})(?::(\d{2}))?\s*([AaPp])\.?\s*[Mm]\.?/.exec(time ?? '');
  return m ? `${Number(m[1])}:${m[2] ?? '00'} ${m[3].toUpperCase()}M` : (time ?? '').trim();
}

/** Times a wrong option can name, one per part of the day, drawn with the same bins. */
const DAY_TIMES: SunPosition[] = [
  { time: '7:00 AM', altitude: 18, azimuth: 25 }, { time: '10:00 AM', altitude: 42, azimuth: 62 },
  { time: '12:00 PM', altitude: 70, azimuth: 90 }, { time: '2:00 PM', altitude: 42, azimuth: 118 },
  { time: '5:00 PM', altitude: 18, azimuth: 155 },
];

/** The obvious suns an easier practice item uses (`lightShadowLevers.ts`): very low on each side, straight overhead. */
export const PRACTICE_SUNS: readonly SunPosition[] = [
  { time: '6:00 AM', altitude: 10, azimuth: 10 }, { time: '6:00 PM', altitude: 10, azimuth: 170 },
  { time: '12:00 PM', altitude: 78, azimuth: 90 },
];

export const opposite = (d: ShadowDirection): ShadowDirection => d === 'W' ? 'E' : d === 'E' ? 'W' : 'W';
export const flipLength = (l: RelativeLength): RelativeLength => l === 'long' ? 'short' : l === 'short' ? 'long' : 'long';

/** The times an apply item offers, each with the sun it stands for; the key first, before the shuffle. */
function applyChoices(c: ShadowChallenge, sunPositions: readonly SunPosition[]): SunPosition[] {
  const key = keyShadow(c), keyTime = normalizeTime(c.sunPosition.time);
  const category = (p: SunPosition) => `${shadowDirectionOf(p.azimuth)}-${shadowLengthOf(p.altitude)}`;
  // A wrong time casts a different shadow from the key and from every other option, or two options would be the
  // same answer; and the side alone must not answer it, so the miss kinds are taken in turn: the mirror time (the
  // same length on the other side), the same side at another height, then the rest.
  const seen = new Set([keyTime]), cats = new Set([category(c.sunPosition)]);
  const pool = [...sunPositions, ...DAY_TIMES].map(p => ({ ...p, time: normalizeTime(p.time) }));
  const rank = (p: SunPosition) => applyMissOf(c, p) === 'mirror_time' ? (shadowLengthOf(p.altitude) === key.relativeLength ? 0 : 3)
    : applyMissOf(c, p) === 'wrong_height' ? 1 : 2;
  const picked: SunPosition[] = [];
  for (let pass = 0; pass < 3; pass++) for (const want of [0, 1, 2, 3]) {
    const p = pool.find(x => rank(x) === want && !seen.has(x.time) && !cats.has(category(x)));
    if (!p || picked.length === 3) continue;
    picked.push(p); seen.add(p.time); cats.add(category(p));
  }
  return [{ ...c.sunPosition, time: keyTime }, ...picked];
}

/** The choices on screen for an item, in a stable shuffled order. */
export function shadowOptions(c: ShadowChallenge, sunPositions: readonly SunPosition[] = []): string[] {
  // An easier practice item carries its own two choices, built with it (`lightShadowLevers.ts`).
  if (c.choices?.length) return stableShuffle(c.choices, c.id);
  if (c.type === 'apply') return stableShuffle(applyChoices(c, sunPositions).map(p => p.time), c.id);
  const { direction: d, relativeLength: l } = keyShadow(c);
  const candidates: Array<[ShadowDirection, RelativeLength]> = [
    [opposite(d), l], [d, flipLength(l)], [opposite(d), flipLength(l)],
    ...(['short', 'medium', 'long'] as const).map((x): [ShadowDirection, RelativeLength] => [d, x]),
    ...(['N', 'E', 'W'] as const).map((x): [ShadowDirection, RelativeLength] => [x, l]),
  ];
  const labels = Array.from(new Set(candidates.map(([x, y]) => comboLabel(x, y)))).filter(o => o !== comboLabel(d, l));
  return stableShuffle([comboLabel(d, l), ...labels.slice(0, 3)], c.id);
}

/** The option the activity credits. */
export const keyOption = (c: ShadowChallenge) => c.type === 'apply' ? normalizeTime(c.sunPosition.time)
  : comboLabel(keyShadow(c).direction, keyShadow(c).relativeLength);

export function workspaceAssignment(c: ShadowChallenge): TeachingAssignment {
  return { id: c.id, task: c.instruction, response: 'gesture' };
}

/**
 * What a wrong choice shows (`TeachingAttempt.miss`, handoff 20):
 * - shadow modes: `toward_sun` (the shadow drawn on the sun's side), `side_when_overhead` (a sideways shadow with
 *   the sun overhead), `below_when_side` (a shadow underneath with the sun off to one side), `length_flipped`
 *   (long for a high sun or short for a low one), `length_off` (one length step off), `both_wrong`;
 * - apply: `mirror_time` (the time with the sun on the other side), `wrong_height` (the same side, the sun at
 *   another height), `other_time`.
 */
export type ShadowMiss = 'toward_sun' | 'side_when_overhead' | 'below_when_side' | 'length_flipped' | 'length_off' | 'both_wrong'
  | 'mirror_time' | 'wrong_height' | 'other_time';

function applyMissOf(c: ShadowChallenge, picked: SunPosition): ShadowMiss {
  const key = keyShadow(c), d = shadowDirectionOf(picked.azimuth);
  if (key.direction !== 'N' && d !== 'N' && d !== key.direction) return 'mirror_time';
  if (d === key.direction) return 'wrong_height';
  return 'other_time';
}

const LABEL_TO_COMBO = new Map((['E', 'W', 'N'] as const).flatMap(d => (['short', 'medium', 'long'] as const)
  .map(l => [comboLabel(d, l), { d, l }] as const)));

export function shadowMiss(c: ShadowChallenge | null, choice: string | null, sunPositions: readonly SunPosition[] = []): ShadowMiss | undefined {
  if (!c || !choice || choice === keyOption(c)) return undefined;
  if (c.type === 'apply') {
    const picked = [...sunPositions, ...DAY_TIMES, ...PRACTICE_SUNS].find(p => normalizeTime(p.time) === choice);
    return picked ? applyMissOf(c, picked) : 'other_time';
  }
  const got = LABEL_TO_COMBO.get(choice), key = keyShadow(c);
  if (!got) return 'both_wrong';
  const dirOk = got.d === key.direction, lenOk = got.l === key.relativeLength;
  if (!dirOk && !lenOk) return 'both_wrong';
  if (!dirOk) return key.direction === 'N' ? 'side_when_overhead' : got.d === 'N' ? 'below_when_side' : 'toward_sun';
  return got.l === flipLength(key.relativeLength) && key.relativeLength !== 'medium' ? 'length_flipped' : 'length_off';
}

const MISS_ORDER: ShadowMiss[] = ['toward_sun', 'mirror_time', 'side_when_overhead', 'length_flipped', 'wrong_height', 'below_when_side', 'length_off', 'both_wrong', 'other_time'];

/** The journey's answers: the key, and the wrong choice that shows the most telling error. */
export function shadowHarnessAnswers(c: ShadowChallenge, sunPositions: readonly SunPosition[] = []): { correct: string; plainWrong: string } {
  const wrong = shadowOptions(c, sunPositions).filter(o => o !== keyOption(c))
    .sort((a, b) => MISS_ORDER.indexOf(shadowMiss(c, a, sunPositions)!) - MISS_ORDER.indexOf(shadowMiss(c, b, sunPositions)!));
  return { correct: keyOption(c), plainWrong: wrong[0] };
}

export const shadowCorrect =(c: ShadowChallenge, choice: string | null) => !!choice && choice === keyOption(c);

/** The learner's work in their own terms, never the key. */
export const describeShadowWork = (choice: string | null) => choice ? `Chose "${choice}"` : 'Nothing chosen yet';

/** A hint that points at the evidence and never states the shadow or the time (the generator's hint often did). */
export function shadowHint(c: ShadowChallenge): string {
  if (c.type === 'observe') return 'Drag the sun to the time the question names, then look at the shadow: which side is it on, and how far does it reach?';
  if (c.type === 'predict') return 'Look at where the sun is: how high it sits and which side it is on. The shadow falls where the light cannot reach.';
  if (c.type === 'measure') return 'Look at the shadow in the picture: which side of the object is it on, and how far does it stretch?';
  return 'Look at the shadow first: how long is it, and which way does it point? Let that tell you where the sun is.';
}

/** Observe: the times marked on the sun's path, one per sun position, each a place the dragged sun snaps to. */
export function timeMarks(c: ShadowChallenge, sunPositions: readonly SunPosition[]): SunPosition[] {
  if (c.type !== 'observe') return [];
  const byTime = new Map<string, SunPosition>();
  for (const p of [c.sunPosition, ...sunPositions]) {
    const time = normalizeTime(p.time);
    if (time && !byTime.has(time)) byTime.set(time, { ...p, time });
  }
  return Array.from(byTime.values()).sort((a, b) => a.azimuth - b.azimuth);
}

/** The mark the sun sits on, if any. */
export const markAt = (marks: readonly SunPosition[], sun: Pick<SunPosition, 'altitude' | 'azimuth'>) =>
  marks.find(m => Math.abs(m.azimuth - sun.azimuth) < 0.5 && Math.abs(m.altitude - sun.altitude) < 0.5);

/** Where the sun opens. Observe parks it where its shadow points the other way, so the open item does not show the answer. */
export function openingSun(c: ShadowChallenge): Pick<SunPosition, 'altitude' | 'azimuth'> {
  if (c.type !== 'observe') return { altitude: c.sunPosition.altitude, azimuth: c.sunPosition.azimuth };
  return shadowDirectionOf(c.sunPosition.azimuth) === 'N' ? { altitude: 12, azimuth: 15 }
    : { altitude: c.sunPosition.altitude, azimuth: 180 - c.sunPosition.azimuth };
}

/** The sun in the words a child would use for what is drawn: how high, and which side. */
export function sunWords(sun: Pick<SunPosition, 'altitude' | 'azimuth'>): string {
  const height = sun.altitude < 30 ? 'low in the sky' : sun.altitude <= 60 ? 'partway up the sky' : 'high in the sky';
  const side = sun.azimuth < 80 ? 'on the east side (the left)' : sun.azimuth > 100 ? 'on the west side (the right)' : 'nearly straight overhead';
  return `${height}, ${side}`;
}

export interface ShadowView {
  choice: string | null;
  /** Observe: where the learner has dragged the sun. */
  sun: Pick<SunPosition, 'altitude' | 'azimuth'>;
  /** The answer has been credited, so what was hidden is drawn. */
  solved: boolean;
}

/** What each mode hides while it is open, because it is the answer. */
export const hidesShadow = (c: ShadowChallenge) => c.type === 'predict';
export const hidesSun = (c: ShadowChallenge) => c.type === 'apply';

/**
 * What is drawn and asked. The shadow's length and direction are never stated where they are the answer
 * (observe, predict, measure), and on apply the time and the sun are hidden, so neither is stated there.
 */
export function workspaceScene(c: ShadowChallenge, view: ShadowView, sunPositions: readonly SunPosition[] = []): WorkspaceScene {
  const drawn: Record<string, string> = {};
  const choices = shadowOptions(c, sunPositions).join(' | ');
  if (c.type === 'observe') {
    const marks = timeMarks(c, sunPositions), at = markAt(marks, view.sun);
    drawn.scene = 'An object stands on the ground with its shadow; the learner drags the sun across the sky and the shadow '
      + `moves with it. The sun's path has time marks (${marks.map(m => m.time).join(', ')}) and the sun snaps onto a mark it is dragged near`;
    drawn.sunNow = `the sun is ${sunWords(view.sun)}${at ? `, on the ${at.time} mark` : ', between marks'}`;
    drawn.howToAnswer = `drag the sun to explore, then tap one choice and check it; the choices are: ${choices}`;
  } else if (c.type === 'predict') {
    drawn.scene = `The sun is fixed ${sunWords(c.sunPosition)} at ${normalizeTime(c.sunPosition.time)}. `
      + (view.solved ? 'The shadow is now drawn.' : 'No shadow is drawn yet: the learner predicts it, and it appears once the prediction is right');
    drawn.howToAnswer = `tap the shadow you predict, then check it; the choices are: ${choices}`;
  } else if (c.type === 'measure') {
    drawn.scene = `The sun is fixed ${sunWords(c.sunPosition)} at ${normalizeTime(c.sunPosition.time)}, and the object's shadow is drawn on the ground. `
      + 'The learner reads which way it points and how long it is from the picture; that reading is the answer, so it is not given here';
    drawn.howToAnswer = `tap the shadow that matches the picture, then check it; the choices are: ${choices}`;
  } else {
    drawn.scene = view.solved ? 'The sun and the time are now drawn.'
      : 'The object\'s shadow is drawn on the ground; the sun and the clock time are hidden, because the time is the answer';
    drawn.howToAnswer = `tap the time of day the shadow shows, then check it; the choices are: ${choices}`;
  }
  return {
    objects: [],
    facts: {
      kind: c.type, ...drawn,
      learnerWork: describeShadowWork(view.choice),
      constraints: 'The learner answers by tapping a choice and checking it; the activity judges it. '
        + 'You cannot move the sun, tap or check for the learner.',
    },
  };
}
