import { describe, expect, it } from 'vitest';
import { LIVE_ADAPTERS, type LiveActivityAdapter } from './activityContract';
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
  it.each(['count|not_a_mode', 'not_a_mode'])('does not bind an unknown mode %s', mode => {
    const data = exhibit(); data.manifest.layout[0].config.targetEvalMode = mode;
    expect(lessonWorkspaceItems(data).size).toBe(0);
  });
  it.each(['count|compare', 'mixed'])('binds a %s pin whose every mode the family binds, keeping the pin verbatim', mode => {
    expect(lessonWorkspaceItems(exhibit(mode)).get('one')).toMatchObject({ evalMode: mode, objectiveId: 'objective' });
  });
  it('binds a section with no pin as mixed: the generator chose across the family, as an Auto tester does', () => {
    for (const mode of [undefined, '']) {
      const data = exhibit(); data.manifest.layout[0].config.targetEvalMode = mode;
      expect(lessonWorkspaceItems(data).get('one')).toMatchObject({ evalMode: 'mixed' });
    }
  });

  it('leaves a blend on the scripted drill when its generated content does not match the pin', () => {
    // Shape Sorter binds every catalog mode now, but this fixture's `data` is still
    // `section`'s counting-board challenges, so validation fails and it stays scripted.
    const shapes = { ...section, componentId: 'shape-sorter' };
    expect(lessonWorkspaceItems(exhibit('identify|count', shapes)).size).toBe(0);
    expect(lessonWorkspaceItems(exhibit('mixed', shapes)).size).toBe(0);
  });
  it('leaves caregiver, ambiguous-objective and incompatible payload paths on their existing controller', () => {
    for (const patch of [{ audience: 'caregiver' }, { objectiveIds: [] }, { objectiveIds: ['one', 'two'] }, { data: {} }]) {
      expect(lessonWorkspaceItems(exhibit('count', { ...section, ...patch })).size).toBe(0);
    }
  });

  const train = (type: string, challenge: Record<string, unknown>) => ({ componentId: 'number-sequencer',
    instanceId: 'one', title: 'Train', objectiveIds: ['objective'], data: { title: 'Trains', gradeBand: 'K',
      challenges: [{ id: 'c', type, instruction: '', ...challenge }] } });
  const beforeAfter = train('before-after', { sequence: [7, null], correctAnswers: [8], rangeMin: 7, rangeMax: 8 });

  it('binds a spoken number-train mode when the payload matches the manifest mode', () => {
    const binding = lessonWorkspaceItems(exhibit('before_after', beforeAfter)).get('one')!;
    expect(binding).toMatchObject({ primitiveId: 'number-sequencer', evalMode: 'before_after', objectiveId: 'objective' });
  });

  it('binds the card-ordering mode: a checked arrangement is reopened by the shell, not withheld from lessons', () => {
    const cards = train('order-cards', { sequence: [7, 3, 5], correctAnswers: [3, 5, 7], rangeMin: 3, rangeMax: 7 });
    expect(lessonWorkspaceItems(exhibit('order_cards', cards)).get('one'))
      .toMatchObject({ primitiveId: 'number-sequencer', evalMode: 'order_cards' });
  });

  it('refuses a number train the adapter rejects', () => {
    const broken = train('before-after', { sequence: [7, null], correctAnswers: [9], rangeMin: 7, rangeMax: 9 });
    expect(lessonWorkspaceItems(exhibit('before_after', broken)).size).toBe(0);
  });

  it('binds the shape-naming mode from the adapter declaration, not a list kept here', () => {
    const shapes = { componentId: 'shape-sorter', instanceId: 'one', title: 'Shapes', objectiveIds: ['objective'],
      data: { title: 'Shapes', gradeBand: 'K', challenges: [{ id: 'c1', type: 'identify', ruleAttribute: 'shape',
        instruction: 'Name it.', shapes: [{ shape: 'triangle', color: 'red', size: 'medium', rotation: 0 }] }] } };
    expect(lessonWorkspaceItems(exhibit('identify', shapes)).get('one'))
      .toMatchObject({ primitiveId: 'shape-sorter', evalMode: 'identify' });
  });

  const facts = { componentId: 'di-math-facts', instanceId: 'one', title: 'Facts', objectiveIds: ['objective'],
    data: { title: 'Facts', challenges: [{ id: 'a1', challengeType: 'answer_fact', a: 2, b: 1, display: '2 + 1',
      problem: 'two plus one', answerWord: 'three', answerNumeral: 3, solvedDisplay: '2 + 1 = 3' }] } };

  it('binds a DI pack', () => {
    expect(lessonWorkspaceItems(exhibit('answer_fact', facts)).get('one'))
      .toMatchObject({ primitiveId: 'di-math-facts', evalMode: 'answer_fact', objectiveId: 'objective' });
  });

  it('every family that binds the workspace admits every one of its modes; no mode is withheld from lessons', () => {
    const bound = Object.entries(LIVE_ADAPTERS).filter(([, adapter]) => (adapter as LiveActivityAdapter).bindsTeachingWorkspace);
    expect(bound.map(([id]) => id).sort()).toEqual(['3d-shape-explorer', 'adaptation-investigator', 'addition-subtraction-scene', 'balance-scale', 'bar-model', 'base-ten-blocks', 'calendar-explorer', 'compare-objects',
      'comparison-builder', 'counting-board', 'cvc-speller', 'decodable-reader', 'di-letter-sounds', 'di-math-facts', 'di-sentence-reading', 'di-shapes',
      'di-word-reading', 'fraction-circles', 'habitat-diorama', 'interactive-book', 'letter-sound-link', 'letter-spotter', 'matter-explorer', 'number-bond', 'number-line', 'number-sequencer', 'number-tracer', 'ordinal-line', 'phoneme-explorer',
      'phonics-blender', 'picture-vocabulary', 'place-value-chart', 'push-pull-arena', 'ramp-lab', 'rhyme-studio', 'shape-sorter', 'sorting-station', 'sound-swap', 'spatial-scene', 'states-of-matter', 'story-bridge', 'story-ribbon', 'syllable-clapper', 'ten-frame', 'word-builder', 'word-flip', 'word-sorter', 'word-workout',
      'you-and-me']);
    // A component with no workspace binding keeps its lesson path and its catalog tutoring.
    const chart = { componentId: 'hundreds-chart', instanceId: 'one', title: 'Chart', objectiveIds: ['objective'], data: {} };
    expect(lessonWorkspaceItems(exhibit('count', chart)).size).toBe(0);
  });
});
