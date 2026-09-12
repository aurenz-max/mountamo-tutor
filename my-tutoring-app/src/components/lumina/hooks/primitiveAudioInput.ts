import type { AudioInputConfig, ComponentDefinition } from '../types';

/** Resolve from hydrated task data, not a component-wide assumption. */
export function resolvePrimitiveAudioInput(
  definition: Pick<ComponentDefinition, 'audioInput' | 'audioInputByMode'> | undefined,
  data: unknown,
): AudioInputConfig | undefined {
  if (!definition?.audioInputByMode || !data || typeof data !== 'object') return definition?.audioInput;
  const fields = data as Record<string, unknown>;
  const challenges = Array.isArray(fields.challenges) ? fields.challenges : [];
  const types = challenges.map((challenge: unknown) => challenge && typeof challenge === 'object'
    ? (challenge as Record<string, unknown>).type : undefined);
  // Hydrated challenge types override potentially stale wrapper/config fields.
  const mode = types.length
    ? types.every((type) => type === types[0]) ? types[0] : undefined
    : fields.challengeType ?? fields.evalMode ?? fields.fluencyFocus ?? fields.targetEvalMode;
  return typeof mode === 'string' ? definition.audioInputByMode[mode] ?? definition.audioInput : definition.audioInput;
}
