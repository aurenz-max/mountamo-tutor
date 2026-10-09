/**
 * The in-item levers on a light-shadow-lab item (`/add-support-tiers`; report
 * qa/eval-reports/light-shadow-lab-levers-2026-10-09.md). No real-learner evidence: the misses are what `shadowMiss`
 * observes, plus the catalog's documented struggles (the shadow drawn toward the sun; length not tied to how high the
 * sun is). Pure: the component draws from these, the workspace publishes them, the tests hold each leak rule. Every
 * help lever is a drawing with no words (K-2 pre-readers); every easier item has the id `<item>~easier`.
 *
 * - `side_model` (help, every mode): three small pictures beside the scene, a sun on the left with the block's shadow
 *   to the right, a sun straight above with a dot of shadow underneath, a sun on the right with the shadow to the left.
 *   Fixed: it reads nothing from the item and shows every side, so it favours none.
 * - `height_model` (help, every mode): two small pictures, both suns on the left: a low sun with a long shadow, a high
 *   sun with a short one. Fixed: a true model of the rule, not the item.
 * - `shadow_zones` (help, observe and measure, where the shadow is drawn): unlabelled tick marks on the ground on both
 *   sides of the object, where a short shadow ends and where a long one begins. Equal on both sides; no words.
 * - `easy_sun` / `easy_shadow` (simplify): an ungraded item of the same mode with an obvious sun (very low on one side,
 *   or straight overhead) and two choices, whose answer is never the item's answer.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { ShadowChallenge, SunPosition } from './LightShadowLab';
import {
  PRACTICE_SUNS, comboLabel, flipLength, keyOption, keyShadow, normalizeTime, opposite, shadowDirectionOf, shadowLengthOf,
  shadowOptions, sunWords, type ShadowMiss,
} from './lightShadowWorkspace';

export const SIDE_MODEL_LEVER = 'side_model';
export const HEIGHT_MODEL_LEVER = 'height_model';
export const SHADOW_ZONES_LEVER = 'shadow_zones';
export const EASY_SUN_LEVER = 'easy_sun';
export const EASY_SHADOW_LEVER = 'easy_shadow';

export const PRACTICE_SUFFIX = '~easier';
export const isPractice = (c: Pick<ShadowChallenge, 'id'>) => c.id.endsWith(PRACTICE_SUFFIX);
export const PRACTICE_NOTE = 'An easier practice item with two choices, ungraded; the full item comes back after it.';

/** side_model: where the sun sits in each picture (azimuth), fixed. Left, overhead, right: every side once. */
export const SIDE_MODEL = [20, 90, 160] as const;
/** height_model: the two suns' altitudes, both on the left, fixed. */
export const HEIGHT_MODEL = [15, 72] as const;


const SHADOW_MISSES: readonly ShadowMiss[] = ['toward_sun', 'side_when_overhead', 'below_when_side', 'length_flipped', 'length_off', 'both_wrong'];
const APPLY_MISSES: readonly ShadowMiss[] = ['mirror_time', 'wrong_height', 'other_time'];

function instructionFor(c: ShadowChallenge, sun: SunPosition): string {
  if (c.type === 'observe') return `Drag the sun to the ${sun.time} mark. Which way does the shadow point, and how long is it?`;
  if (c.type === 'predict') return `The sun is ${sunWords(sun)}. Which way will the shadow point, and how long will it be?`;
  if (c.type === 'measure') return 'Look at the shadow. Which way does it point, and how long is it?';
  return 'Look at the shadow. What time of day is it?';
}

const category = (s: Pick<SunPosition, 'altitude' | 'azimuth'>) => `${shadowDirectionOf(s.azimuth)}-${shadowLengthOf(s.altitude)}`;

/** The practice's one wrong choice: the shadow on the sun's side (or, overhead, off to one side), or the time on the
 *  other side of noon; never `avoid` (the item's own answer). */
function partnerChoice(type: ShadowChallenge['type'], sun: SunPosition, avoid: string): string | null {
  const d = shadowDirectionOf(sun.azimuth), l = shadowLengthOf(sun.altitude);
  if (type !== 'apply') {
    return [comboLabel(opposite(d), l), comboLabel(d === 'N' ? 'E' : d, flipLength(l))].find(o => o !== avoid) ?? null;
  }
  const other = PRACTICE_SUNS.find(s => category(s) !== category(sun) && normalizeTime(s.time) !== avoid);
  return other ? normalizeTime(other.time) : null;
}

/** The easier item a simplify lever opens: same mode, an obvious sun with a different shadow from the item's, and two
 *  choices, neither of them the item's answer (a wrong choice there would teach against the item's key). */
export function practiceItem(c: ShadowChallenge): ShadowChallenge | null {
  if (isPractice(c)) return null;
  const key = keyOption(c), keyTime = normalizeTime(c.sunPosition.time);
  for (const sun of PRACTICE_SUNS) {
    if (normalizeTime(sun.time) === keyTime || category(sun) === category(c.sunPosition)) continue;
    const k = keyShadow({ ...c, sunPosition: sun });
    const right = c.type === 'apply' ? normalizeTime(sun.time) : comboLabel(k.direction, k.relativeLength);
    const wrong = partnerChoice(c.type, sun, key);
    if (right === key || !wrong) continue;
    return {
      id: `${c.id}${PRACTICE_SUFFIX}`, type: c.type, instruction: instructionFor(c, sun), sunPosition: { ...sun },
      correctShadow: { direction: k.direction, relativeLength: k.relativeLength }, choices: [right, wrong],
      // The easier item keeps the item's own ground labels and sun path, so the picture reads the same way.
      showSunPath: c.showSunPath, showDirectionLabels: c.showDirectionLabels,
    };
  }
  return null;
}

/** Leak rule for the easier item: same mode, not the item, a different answer and sun, two choices, an obvious sun. */
export function practiceLeaks(parent: ShadowChallenge, p: ShadowChallenge): boolean {
  const s = p.sunPosition;
  const obvious = (s.altitude <= 15 && (s.azimuth <= 20 || s.azimuth >= 160)) || (s.altitude >= 75 && s.azimuth >= 85 && s.azimuth <= 95);
  return p.id === parent.id || p.type !== parent.type || p.choices?.length !== 2 || !obvious
    || !p.choices.includes(keyOption(p)) || category(s) === category(parent.sunPosition)
    || shadowOptions(p).includes(keyOption(parent)) || normalizeTime(s.time) === normalizeTime(parent.sunPosition.time)
    || (s.altitude === parent.sunPosition.altitude && s.azimuth === parent.sunPosition.azimuth);
}

export const practiceParent = (itemId: string | null | undefined, challenges: readonly ShadowChallenge[]) =>
  itemId?.endsWith(PRACTICE_SUFFIX) ? challenges.find(c => `${c.id}${PRACTICE_SUFFIX}` === itemId) ?? null : null;

/** Whether the shadow is on screen to be read, so ground marks can help read it. */
const shadowDrawn = (c: ShadowChallenge) => c.type === 'observe' || c.type === 'measure' || c.type === 'apply';

export function lightShadowLevers(c: ShadowChallenge | null, pulled: readonly string[]): WorkspaceLever[] {
  if (!c || isPractice(c)) return [];
  const apply = c.type === 'apply';
  const lever = (id: string, kind: WorkspaceLever['kind'], answers: readonly ShadowMiss[], when: string, does: string): WorkspaceLever =>
    ({ id, kind, carrier: 'shown', pulled: pulled.includes(id), answers, when, does });
  const simpler = practiceItem(c);
  return [
    lever(SIDE_MODEL_LEVER, 'help', apply ? ['mirror_time', 'other_time'] : ['toward_sun', 'side_when_overhead', 'below_when_side', 'both_wrong'],
      apply ? 'The learner picks a time when the sun is on the same side as the shadow, or cannot tell which side the sun is on.'
        : 'The learner puts the shadow on the sun\'s side, or under the object when the sun is off to one side.',
      'Shows three small pictures beside the scene: a sun on the left with a block\'s shadow on the right, a sun straight '
        + 'above with a dot of shadow underneath, and a sun on the right with the shadow on the left. They show no part of this item.'),
    lever(HEIGHT_MODEL_LEVER, 'help', apply ? ['wrong_height', 'other_time'] : ['length_flipped', 'length_off', 'both_wrong'],
      apply ? 'The learner picks a time with the sun at the wrong height for this shadow\'s length.'
        : 'The learner mixes up long and short, or does not link the length to how high the sun is.',
      'Shows two small pictures beside the scene, both suns on the left: a low sun with a long shadow and a high sun '
        + 'with a short one. They show no part of this item.'),
    ...(shadowDrawn(c) && !apply ? [lever(SHADOW_ZONES_LEVER, 'help', ['length_off', 'length_flipped'],
      'The learner cannot judge how long the drawn shadow is.',
      'Draws small marks on the ground on both sides of the object, the same on each side: where a short shadow ends and '
        + 'where a long one begins. The marks have no words.')] : []),
    ...(simpler ? [lever(apply ? EASY_SHADOW_LEVER : EASY_SUN_LEVER, 'simplify', apply ? APPLY_MISSES : SHADOW_MISSES,
      apply ? 'The learner cannot yet read a time from this shadow.' : 'The learner cannot yet work out this shadow.',
      `Opens an easier item first: the same kind of question with ${apply ? 'a very long or very short shadow' : 'the sun very low or straight overhead'} `
        + 'and only two choices. It is not graded; the full item comes back after it.')] : []),
  ];
}

/** What the pulled help levers put on screen, for the tutor. Never a direction, a length or a time for this item. */
export function leverFacts(c: ShadowChallenge | null, pulled: readonly string[]): string {
  if (!c || isPractice(c)) return '';
  return [
    pulled.includes(SIDE_MODEL_LEVER) && 'Beside the scene are three small pictures: a sun on the left with the shadow on the right, '
      + 'a sun straight above with a dot of shadow underneath, a sun on the right with the shadow on the left.',
    pulled.includes(HEIGHT_MODEL_LEVER) && 'Beside the scene are two small pictures, both suns on the left: a low sun with a long '
      + 'shadow and a high sun with a short shadow.',
    pulled.includes(SHADOW_ZONES_LEVER) && shadowDrawn(c) && 'Small marks on the ground on both sides of the object show where a '
      + 'short shadow ends and where a long shadow begins.',
  ].filter((s): s is string => !!s).join(' ');
}
