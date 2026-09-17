import { LIVE_ADAPTERS, type LivePrimitiveId } from './activityContract';
import { DIRECT_VISUAL_OFFERS } from './directVisualContract';

/** Host-owned descriptions. Python validates/transports this envelope; it has no primitive catalog. */
export interface LiveActivitySpec {
  activities: Array<{ primitiveId: string; modes: string[]; teachingOwner: 'tutor' | 'di-runner'; canAdvance: boolean; guidance: string }>;
  visuals: Array<{ name: string; primitiveId: string; description: string; parameters: Record<string, unknown> }>;
  plan?: { topic: string; items: Array<{ itemId: string; primitiveId: string; title: string; evalMode: string; objective: string }> };
}

export function buildLiveActivitySpec(primitives: LivePrimitiveId[], directVisuals = false,
  plan?: LiveActivitySpec['plan']): LiveActivitySpec {
  if (plan && directVisuals) throw new Error('A planned lesson cannot enable workspace-replacing visuals.');
  return { activities: Array.from(new Set(primitives)).map(primitiveId => {
    const adapter = LIVE_ADAPTERS[primitiveId];
    if (!adapter) throw new Error('Unsupported live activity.');
    return { primitiveId, modes: [...adapter.modes], teachingOwner: adapter.teachingOwner,
      canAdvance: adapter.canAdvance, guidance: adapter.guidance };
  }), visuals: directVisuals ? DIRECT_VISUAL_OFFERS : [], ...(plan ? { plan } : {}) };
}
