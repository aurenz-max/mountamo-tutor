import type { TenFrameData } from '../../../primitives/visual-primitives/math/TenFrame';
import { askFor, itemsFromChallenges } from '../../../primitives/visual-primitives/math/tenFrameScript';
import { TEN_FRAME_WORKSPACE_MODES } from '../../../primitives/visual-primitives/math/tenFrameWorkspace';
import { workspaceGuidance, workspaceLessonStart, type LiveActivityAdapter } from './adapterContract';

export const TEN_FRAME_MODES = TEN_FRAME_WORKSPACE_MODES;

export function validateTenFrameData(value: unknown): TenFrameData {
  const d = value as TenFrameData;
  if (!d || typeof d.title !== 'string' || !['single', 'double'].includes(d.mode)
      || !['K', '1-2'].includes(d.gradeBand ?? '') || !Array.isArray(d.challenges)
      || !d.challenges.length || d.challenges.length > 12 || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || typeof c.instruction !== 'string'))
    throw new Error('Generated ten frame has invalid lesson content.');
  const items = itemsFromChallenges(d.challenges, { capacity: d.mode === 'double' ? 20 : 10, band: d.gradeBand! });
  if (items.length !== d.challenges.length) throw new Error('A ten-frame challenge cannot run in the lesson.');
  return d;
}

function tenFrameState(frame: TenFrameData) {
  const items = itemsFromChallenges(frame.challenges, { capacity: frame.mode === 'double' ? 20 : 10, band: frame.gradeBand! });
  return { title: frame.title, instruction: askFor(items[0]), teachingOwner: 'tutor', totalChallenges: items.length,
    interaction: 'Teach from liveRuntime.task and its workspace. Judge spoken answers naturally; the host records '
      + 'your completed feedback and handles retry/advance. The frame checks a placement itself.' };
}

export const tenFrameLive: LiveActivityAdapter<TenFrameData> = {
  tutoring: null,
  teachingOwner: 'tutor',
  modes: TEN_FRAME_MODES,
  bindsTeachingWorkspace: true,
  canAdvance: false, // The dialogue observer owns checked progression.
  grades: ['Kindergarten', 'Grade 1', 'Grade 2'],
  copy: {
    label: 'Ten Frame', checkbox: 'Ten Frame', title: 'Learn with Ten Frame',
    lessons: [['make_ten', 'Make ten'], ['build', 'Build numbers'], ['subitize', 'Recognize quantities'], ['operate', 'Add and subtract'],
      ['decompose', 'Split into two groups'], ['build_teen', 'Build teen numbers'], ['decompose_teen', 'Find the ten']],
  },
  lessonStart: workspaceLessonStart('ten-frame', 'ten-frame'),
  // W1 minimal binding: the domain's own facts only; WORKSPACE_DOCTRINE carries the rest.
  guidance: workspaceGuidance('The frame checks placed or flipped counters itself once the learner stops; '
    + 'talk about a part-built frame is teaching, not a verdict. On a quick-look item, call present when the learner '
    + 'is ready: the counters show briefly, then hide. Never count them out. You cannot place, remove or flip counters.'),
  validate: validateTenFrameData,
  initialState: tenFrameState,
};
