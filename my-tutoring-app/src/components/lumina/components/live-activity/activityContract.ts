import type { NumberLineData } from '../../primitives/visual-primitives/math/NumberLine';
import type { TenFrameData } from '../../primitives/visual-primitives/math/TenFrame';
import { itemsFromChallenges, tenFramePackBase } from '../../primitives/visual-primitives/math/tenFrameScript';

export const ACTIVITY_MODES = ['identify', 'plot', 'jump', 'order', 'between'] as const;
export const TEN_FRAME_MODES = ['build', 'make_ten', 'subitize', 'decompose', 'build_teen', 'decompose_teen', 'operate'] as const;
export interface ActivityRequest {
  primitiveId: 'number-line' | 'ten-frame';
  topic: string;
  intent: string;
  mode: typeof ACTIVITY_MODES[number] | typeof TEN_FRAME_MODES[number];
}
export interface MountedActivity {
  callId: string;
  instanceId: string;
  request: Pick<ActivityRequest, 'primitiveId'> & Partial<ActivityRequest>;
  data: NumberLineData | TenFrameData;
  /** Set when the activity came from a prepared lesson plan rather than a generation request. */
  planItemId?: string;
  /** Preserve the resolved plan mode, including blends. */
  resolvedEvalMode?: string;
}

export function parseActivityRequest(value: unknown): ActivityRequest {
  const v = value as Record<string, unknown> | null;
  const modes: readonly string[] = v?.primitiveId === 'ten-frame' ? TEN_FRAME_MODES : ACTIVITY_MODES;
  if (!v || !['number-line', 'ten-frame'].includes(v.primitiveId as string) || !modes.includes(v.mode as string)
      || ['topic', 'intent'].some(k => typeof v[k] !== 'string' || !(v[k] as string).trim()
        || (v[k] as string).length > 1000)) throw new Error('Unsupported activity request');
  return { primitiveId: v.primitiveId as ActivityRequest['primitiveId'], topic: (v.topic as string).trim(),
    intent: (v.intent as string).trim(), mode: v.mode as ActivityRequest['mode'] };
}

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

export type LivePrimitiveId = ActivityRequest['primitiveId'];
export type LiveActivityData = NumberLineData | TenFrameData;

/**
 * What the live session needs from each primitive family (LA-03). Rendering
 * stays in the sandbox so this module remains importable by the server route.
 */
export interface LiveActivityAdapter {
  modes: readonly string[];
  canAdvance: boolean;
  guidance: string;
  /** The tutor leads a number line; the ten-frame DI runner owns its own asks and progression. */
  teachingOwner: 'tutor' | 'di-runner';
  validate: (value: unknown) => LiveActivityData;
  initialState: (data: LiveActivityData) => Record<string, unknown>;
}

function tenFrameState(data: LiveActivityData) {
  const frame = data as TenFrameData;
  const items = itemsFromChallenges(frame.challenges, { capacity: frame.mode === 'double' ? 20 : 10, band: frame.gradeBand! });
  return { ...frame, ...tenFramePackBase(items).contextFor(items[0]), teachingOwner: 'ten-frame-di', totalChallenges: items.length };
}

export const LIVE_ADAPTERS: Record<LivePrimitiveId, LiveActivityAdapter> = {
  'number-line': { teachingOwner: 'tutor', modes: ACTIVITY_MODES, canAdvance: true,
    guidance: 'Use the first challenge instruction. Targets and operations are tutor reference: do not reveal answers. After [ANSWER_CORRECT], use the advertised runtime advance action when available; wait for its visible receipt before asking the next challenge. The final checked item completes automatically. Use replay to repeat the instruction, retry to clear an incorrect response, and advertised reminders or examples when the learner asks for help. Return keeps the original work. Never claim to move or highlight points. Legacy advance_activity is only for hosts without runtime choices. Component feedback is correctness evidence.',
    validate: v => validateActivityData(v),
    initialState: d => initialActivityState(d as NumberLineData) },
  'ten-frame': { teachingOwner: 'di-runner', modes: TEN_FRAME_MODES, canAdvance: false,
    guidance: 'The mounted runner supplies the exact opening, question, correction, affirmation and closing cues. Follow those cues and their judging contract. Wait for its opening cue; do not invent a greeting, answer, verdict or progression.',
    validate: v => validateTenFrameData(v), initialState: tenFrameState },
};

export const isLivePrimitive = (id: string): id is LivePrimitiveId => Object.hasOwn(LIVE_ADAPTERS, id);

export function validateGeneratedActivity(primitiveId: LivePrimitiveId, value: unknown) {
  return LIVE_ADAPTERS[primitiveId].validate(value);
}

export function generatedActivityState(primitiveId: LivePrimitiveId, data: LiveActivityData) {
  return LIVE_ADAPTERS[primitiveId].initialState(data);
}

/** Validate the renderer contract at the service boundary, including jump arithmetic. */
export function validateActivityData(value: unknown): NumberLineData {
  const d = value as NumberLineData | null;
  const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  if (!d || typeof d.title !== 'string' || !d.range || !finite(d.range.min) || !finite(d.range.max)
      || d.range.min >= d.range.max || !Array.isArray(d.challenges) || !d.challenges.length
      || d.challenges.length > 12) throw new Error('Generated number line has no valid challenges or range');
  const inRange = (v: unknown) => finite(v) && v >= d.range.min && v <= d.range.max;
  for (const c of d.challenges) {
    if (!c || typeof c.id !== 'string' || typeof c.instruction !== 'string' || typeof c.hint !== 'string'
        || !['plot_point', 'show_jump', 'order_values', 'find_between'].includes(c.type)
        || !Array.isArray(c.targetValues) || !c.targetValues.length || !c.targetValues.every(inRange))
      throw new Error('Generated number line has an invalid challenge');
    if (c.exactTargetValue !== undefined && !inRange(c.exactTargetValue)) throw new Error('Invalid missing value');
    if (c.type === 'show_jump') {
      if (!inRange(c.startValue) || !Array.isArray(c.operations) || !c.operations.length) throw new Error('Missing jump operations');
      let landing = c.startValue!;
      for (const [index, op] of Array.from(c.operations.entries())) {
        if (!op || !['add', 'subtract'].includes(op.type) || !finite(op.changeValue) || op.changeValue < 0
            || !finite(op.startValue) || Math.abs(op.startValue - landing) > 0.0001) throw new Error('Invalid jump operation');
        landing += op.type === 'add' ? op.changeValue : -op.changeValue;
        if (!inRange(landing)) throw new Error('Jump leaves the number line');
        if (Math.abs(landing - c.targetValues[index]) > 0.0001) throw new Error('Jump answer does not match its operations');
      }
      if (c.targetValues.length !== c.operations.length) throw new Error('Missing jump answer');
    }
  }
  return d;
}

export function initialActivityState(data: NumberLineData) {
  const first = data.challenges![0];
  return {
    ...data, rangeMin: data.range.min, rangeMax: data.range.max,
    visibleMin: data.range.min, visibleMax: data.range.max,
    numberType: data.numberType ?? 'integer', interactionMode: data.interactionMode ?? 'plot',
    gradeBand: data.gradeBand ?? 'K-2', totalChallenges: data.challenges!.length,
    currentChallengeIndex: 0, instruction: first.instruction, challengeType: first.type,
    targetValues: first.targetValues, exactTargetValue: first.exactTargetValue,
    placedPoints: [], jumpEndPoints: [], orderedPlacements: [], attemptNumber: 1, zoomLevel: 1,
    currentPhase: first.type === 'show_jump' ? 'operate' : first.type === 'order_values' ? 'compare' : 'plot',
    supportTier: data.supportTier ?? 'easy',
  };
}
