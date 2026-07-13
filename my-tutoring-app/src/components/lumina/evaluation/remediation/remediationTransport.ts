import type { ManifestItem } from '../../types';

export interface RemediationIdentity {
  primitiveType: string;
  skillId?: string;
}

export function resolveRemediationIdentity(
  manifestItems: ManifestItem[],
  instanceId: string,
  primitiveType: string,
  resolvedSkillId?: string,
  evalMode?: string,
): RemediationIdentity | undefined {
  const item = manifestItems.find(candidate => candidate.instanceId === instanceId);
  if (item?.componentId !== primitiveType || typeof item.config?.remediationFocus !== 'string'
      || !item.config.remediationFocus.trim()) return undefined;
  const taggedPrimitive = item.config.remediationForPrimitiveType;
  const taggedSkill = item.config.remediationForSkillId;
  if (taggedPrimitive !== primitiveType) return undefined;
  // TapeDiagram explicitly abstains in part-whole mode: the diagnosed
  // comparison distinction has no structural affordance there.
  if (primitiveType === 'tape-diagram' && evalMode === 'solve_part_whole') return undefined;
  if (taggedSkill && taggedSkill !== resolvedSkillId) return undefined;
  return { primitiveType, skillId: taggedSkill || undefined };
}

export function buildRemediationProblemMetadata(
  remediation?: RemediationIdentity,
): { metadata: { remediation_for_primitive_type: string; remediation_for_skill_id?: string } } | Record<string, never> {
  return remediation
    ? {
        metadata: {
          remediation_for_primitive_type: remediation.primitiveType,
          ...(remediation.skillId ? { remediation_for_skill_id: remediation.skillId } : {}),
        },
      }
    : {};
}
