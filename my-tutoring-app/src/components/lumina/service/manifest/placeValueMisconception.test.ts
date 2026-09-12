import { expect, it } from 'vitest';
import type { ExhibitManifest } from '../../types';
import { flattenManifestToLayout } from './flattenManifest';
import { resolveGenerationContext } from '../generation/resolveGenerationContext';
import { resolveRemediationIdentity } from '../../evaluation/remediation/remediationTransport';
it('keeps place-value focus and resolution tags inside their skill and primitive', () => {
  const manifest: ExhibitManifest = { topic: 'Digit worth', gradeLevel: 'Grade 3', themeColor: 'blue', objectiveBlocks: [{ objectiveId: 'o', objectiveText: 'Digit worth', objectiveVerb: 'identify', components: [{ componentId: 'place-value-chart', instanceId: 'p', title: 'Place value', intent: 'Digit worth' }] }] };
  for (const skillId of ['NBT003-02', 'OTHER']) {
    const layout = flattenManifestToLayout(manifest, [{ id: 'o', text: 'Digit worth', verb: 'identify', grade: '3', skillId, subskillId: 'NBT003-02-a' }], { available: true, objectives: [], activeMisconceptions: [{ text: 'The student gives the bare digit for worth.', primitiveType: 'place-value-chart', scope: 'skill', skillId: 'NBT003-02' }] });
    const ctx = resolveGenerationContext(layout[0], manifest.topic, 'Grade 3', 'Grade 3');
    expect(!!ctx.remediationFocus).toBe(skillId === 'NBT003-02');
    expect(resolveRemediationIdentity(layout, 'p', 'tape-diagram', skillId)).toBeUndefined();
    expect(!!resolveRemediationIdentity(layout, 'p', 'place-value-chart', skillId)).toBe(skillId === 'NBT003-02');
  }
});
