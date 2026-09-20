import type { TenFrameData } from '../../../primitives/visual-primitives/math/TenFrame';
import { itemsFromChallenges, tenFramePackBase } from '../../../primitives/visual-primitives/math/tenFrameScript';
import { RUNNER_GUIDANCE, runnerLessonStart, type LiveActivityAdapter } from './adapterContract';

export const TEN_FRAME_MODES = ['build', 'make_ten', 'subitize', 'decompose', 'build_teen', 'decompose_teen', 'operate'] as const;

export function validateTenFrameData(value: unknown): TenFrameData {
  const d = value as TenFrameData;
  if (!d || typeof d.title !== 'string' || !['single', 'double'].includes(d.mode)
      || !['K', '1-2'].includes(d.gradeBand ?? '') || !Array.isArray(d.challenges)
      || !d.challenges.length || d.challenges.length > 12 || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || typeof c.instruction !== 'string'))
    throw new Error('Generated ten frame has invalid lesson content.');
  const items = itemsFromChallenges(d.challenges, { capacity: d.mode === 'double' ? 20 : 10, band: d.gradeBand! });
  if (items.length !== d.challenges.length) throw new Error('A ten-frame challenge cannot run in the DI lesson.');
  return d;
}

function tenFrameState(frame: TenFrameData) {
  const items = itemsFromChallenges(frame.challenges, { capacity: frame.mode === 'double' ? 20 : 10, band: frame.gradeBand! });
  return { ...frame, ...tenFramePackBase(items).contextFor(items[0]), teachingOwner: 'ten-frame-di', totalChallenges: items.length };
}

export const tenFrameLive: LiveActivityAdapter<TenFrameData> = {
  teachingOwner: 'di-runner',
  modes: TEN_FRAME_MODES,
  canAdvance: false,
  grades: ['Kindergarten', 'Grade 1', 'Grade 2'],
  copy: {
    label: 'Ten Frame', checkbox: 'Ten Frame', title: 'Learn with Ten Frame',
    lessons: [['make_ten', 'Make ten'], ['build', 'Build numbers'], ['subitize', 'Recognize quantities'], ['operate', 'Add and subtract'],
      ['decompose', 'Split into two groups'], ['build_teen', 'Build teen numbers'], ['decompose_teen', 'Find the ten']],
  },
  lessonStart: runnerLessonStart('ten-frame'),
  guidance: RUNNER_GUIDANCE,
  validate: validateTenFrameData,
  initialState: tenFrameState,
};
