import { describe, expect, it } from 'vitest';
import { lessonPrimitiveContext, lessonWorkspaceItems } from './lessonWorkspacePlan';
const section = { componentId: 'counting-board', instanceId: 'one', title: 'Count', objectiveIds: ['objective'], data: {
  title: 'Count', gradeBand: 'K', objects: { type: 'blocks' }, challenges: [
    { id: 'c', type: 'count_all', count: 3, targetAnswer: 3, arrangement: 'scattered', instruction: 'Count.', hint: '', narration: '' }] } };
function exhibit(mode: unknown = 'count', part: any = section) { return { orderedComponents: [part], manifest: { layout: [
  { instanceId: part.instanceId, config: { targetEvalMode: mode } }] } } as any; }
describe('ordinary lesson workspace eligibility', () => {
  it('preserves manifest identity and explicitly disables scripted opening metadata', () => {
    const binding = lessonWorkspaceItems(exhibit()).get('one')!;
    expect(binding).toMatchObject({ objectiveId: 'objective', evalMode: 'count', planItemId: 'one' });
    expect(lessonPrimitiveContext(section as any, binding)).toMatchObject({ tutoring: null, owns_opening: true });
  });
  it.each([undefined, 'mixed', 'count|compare', 'compare'])('does not guess unsupported/missing mode %s', mode => {
    const data = exhibit(); data.manifest.layout[0].config.targetEvalMode = mode;
    expect(lessonWorkspaceItems(data).size).toBe(0);
  });
  it('leaves caregiver, ambiguous-objective and incompatible payload paths on their existing controller', () => {
    for (const patch of [{ audience: 'caregiver' }, { objectiveIds: [] }, { objectiveIds: ['one', 'two'] }, { data: {} }]) {
      expect(lessonWorkspaceItems(exhibit('count', { ...section, ...patch })).size).toBe(0);
    }
  });
});
