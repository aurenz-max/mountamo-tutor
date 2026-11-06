/**
 * The in-item levers on a wave-tank item, as one lever set (`bossLevers.ts`; `/add-support-tiers`). No real-learner
 * evidence yet: the misses are what `knockMiss` observes, and the documented G4 misconception that only a taller wave
 * carries more energy (how often it shakes does not count).
 *
 * - `crest_marks` (marks): brackets on the moving water showing each crest's height and the gap to the next, in grid
 *   squares. The learner sees what each setting does to the wave. Answers `weaker`, `too_small`.
 * - `xray` (marks): an energy bar at the beach, no numbers, that fills as each wave arrives, with a notch where the
 *   tower falls. Shows the learner how far its wave is from enough, never which setting gets there. Answers
 *   `too_small`, `weaker`.
 * - `changes_marked` (marks): the paddle box rings the first wave's settings, and the notebook marks which setting each
 *   wave changed. Answers `changed_both`, `no_change`.
 * - `one_step_less` (easier): a different tower, one step simpler and ungraded: hard (size stuck) becomes medium (both
 *   free); medium becomes easy (one step up is enough). None on an easy item.
 *
 * When they come is the lesson's support tier: at easy the first wave's settings are ringed from the start.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { WAVE_MISSES_BY_MODE } from './waveTank.card';
import { knockCandidates, type WaveChallenge, type WaveRun } from './waveModel';

export const CREST_LEVER = 'crest_marks';
export const XRAY_LEVER = 'xray';
export const CHANGES_LEVER = 'changes_marked';
export const EASIER_LEVER = 'one_step_less';
export const PRACTICE_SUFFIX = '~easier';
export const isPractice = (c: Pick<WaveChallenge, 'id'>) => c.id.endsWith(PRACTICE_SUFFIX);
export const PRACTICE_NOTE = 'An easier practice item, ungraded; the full item comes back after it.';

/** What the screen shows that a lever needs: the waves sent so far. */
export interface WaveLeverCtx { runs: readonly WaveRun[] }

/** The same task one step simpler with a different first wave, or null on an easy item. */
export function practiceItem(c: WaveChallenge): WaveChallenge | null {
  if (isPractice(c) || c.supportTier === 'easy') return null;
  const easier = knockCandidates(c.supportTier === 'hard' ? 'medium' : 'easy')
    .find(p => p.start.size !== c.start.size || p.start.speed !== c.start.speed);
  return easier ? { ...easier, id: `${c.id}${PRACTICE_SUFFIX}` } : null;
}

export const practiceParent = (itemId: string | null | undefined, challenges: readonly WaveChallenge[]) =>
  itemId?.endsWith(PRACTICE_SUFFIX) ? challenges.find(c => `${c.id}${PRACTICE_SUFFIX}` === itemId) ?? null : null;

const notPractice = (c: WaveChallenge) => (isPractice(c) ? null : true);

export const WAVE_LEVERS = leverSet<WaveChallenge, WaveLeverCtx>({
  modeOf: c => c.type,
  missesOf: mode => WAVE_MISSES_BY_MODE[mode as keyof typeof WAVE_MISSES_BY_MODE] ?? [],
  specs: [
    { id: CREST_LEVER, type: 'marks', answers: ['weaker', 'too_small'],
      when: 'The learner does not connect the paddle settings to how the waves look.',
      does: 'Draws brackets on the moving water: how tall each crest is and how far it is to the next crest, counted in '
        + 'the grid squares on the glass.',
      content: notPractice,
      fact: 'Brackets on the moving water show how tall each crest is and how far it is to the next crest, in grid squares.' },
    { id: XRAY_LEVER, type: 'marks', answers: ['too_small', 'weaker'],
      when: 'The learner changed the right kind of thing but not far enough, or the wrong way.',
      does: 'Shows an energy bar at the beach, with no numbers, that fills as each wave arrives, and a notch where the '
        + 'tower falls: the learner sees how far its wave is from enough.',
      content: notPractice,
      offer: (_c, ctx) => ctx.runs.length > 0,
      fact: 'An energy bar at the beach, with no numbers, fills as each wave arrives; a notch on it marks where the tower falls.' },
    { id: CHANGES_LEVER, type: 'marks', answers: ['changed_both', 'no_change'],
      when: 'The learner changes both settings, or neither.',
      does: 'Rings the first wave\'s settings on the paddle box and marks, in the notebook, which setting each wave changed.',
      content: notPractice,
      fact: 'The first wave\'s settings are ringed on the paddle box; the notebook marks which setting each wave changed.' },
    { id: EASIER_LEVER, type: 'easier', answers: 'all',
      when: 'The learner cannot yet do this item even with the marks and the energy bar.',
      does: c => (c.supportTier === 'hard' ? 'Opens an easier tower first: both settings free to change.'
        : 'Opens an easier tower first: one step up on either setting is enough.') + ' It is not graded; the full item comes back after it.',
      content: c => practiceItem(c) },
  ],
});
