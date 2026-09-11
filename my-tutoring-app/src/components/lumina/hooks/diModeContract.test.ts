import { describe, expect, it } from 'vitest';
import {
  buildDiModePlan,
  challengeTypeDocsFromDiModes,
  defineDiMode,
  defineDiModes,
  evalModeDefinitionsFromDiModes,
  supportForSingleDiMode,
  type DiModeDefinition,
} from './diModeContract';

interface Item { id: string; challengeType: string }
const mode = defineDiMode<Item>();

const valid = () => mode({
  evalMode: 'build_then_say',
  label: 'Build Then Say',
  beta: 2.5,
  discrimination: 1.6,
  scaffoldingMode: 2,
  challengeTypes: ['build_then_say'],
  description: 'Build a quantity, then say the equation.',
  challengeDocs: {
    build_then_say: {
      promptDoc: '"build_then_say": build the quantity, then say the equation.',
      schemaDescription: "'build_then_say' (build, then say)",
    },
  },
  responseClass: 'equation_statement',
  answerStepId: 'say',
  steps: [
    { id: 'build', label: 'Build it', icon: '🧩', answerKind: 'gesture', responseClass: 'manipulation', instruction: 'Drag the cards into place.', checkingInstruction: 'Checking the cards.' },
    { id: 'say', label: 'Say it', icon: '🎙️', answerKind: 'voice', instruction: 'Say the equation aloud.', checkingInstruction: 'Listening to the equation.' },
  ],
});

describe('defineDiMode', () => {
  it('only applies structural support to a single resolved mode', () => {
    expect(supportForSingleDiMode({ modes: [{}] }, 'easy')).toBe('easy');
    expect(supportForSingleDiMode({ modes: [{}, {}] }, 'easy')).toBeUndefined();
    expect(supportForSingleDiMode(null, 'easy')).toBeUndefined();
  });

  it('projects one declaration into catalog, generator, and runtime action contracts', () => {
    const modes = defineDiModes<Item>(valid());
    const catalog = evalModeDefinitionsFromDiModes(modes);
    const docs = challengeTypeDocsFromDiModes(modes);
    const plan = buildDiModePlan(modes, { id: 'item-1', challengeType: 'build_then_say' });

    expect(catalog).toEqual([{
      evalMode: 'build_then_say', label: 'Build Then Say', beta: 2.5,
      discrimination: 1.6, scaffoldingMode: 2,
      challengeTypes: ['build_then_say'],
      description: 'Build a quantity, then say the equation.',
    }]);
    expect(docs.build_then_say.schemaDescription).toContain('build, then say');
    expect(plan.groupingKey).toBe('build_then_say');
    expect(plan.steps.map((step) => step.id)).toEqual(['item-1-build', 'item-1-say']);
    expect(plan.steps.map((step) => step.key)).toEqual(['build', 'say']);
    expect(plan.steps.map((step) => step.responseClass)).toEqual(['manipulation', 'equation_statement']);
    expect(plan.answerStep.actionContract.instruction).toBe('Say the equation aloud.');
    expect(plan.responseClass).toBe('equation_statement');
  });

  it('rejects incomplete definitions before a primitive can ship them', () => {
    expect(() => mode({
      ...valid(),
      challengeDocs: {},
    })).toThrow('missing docs');
    expect(() => mode({
      ...valid(),
      answerStepId: 'missing',
    })).toThrow('does not exist');
    expect(() => mode({
      ...valid(),
      answerStepId: 'build',
    })).toThrow('must be the final step');
  });

  it('rejects duplicate mode keys and challenge-type ownership', () => {
    expect(() => defineDiModes<Item>(valid(), valid())).toThrow('Duplicate DI eval mode');
    const second = {
      ...valid(),
      evalMode: 'another_mode',
    } as DiModeDefinition<Item>;
    expect(() => defineDiModes<Item>(valid(), second)).toThrow('belongs to more than one mode');
  });

  it('requires the response class to match the assessed action modality', () => {
    const bad = mode({ ...valid(), responseClass: 'manipulation' });
    expect(() => buildDiModePlan([bad], { id: 'item-1', challengeType: 'build_then_say' }))
      .toThrow('voice step say cannot use responseClass manipulation');
  });

  it('rejects a per-step response class that disagrees with its modality', () => {
    const baseline = valid();
    const bad = mode({
      ...baseline,
      steps: [
        { ...baseline.steps[0], responseClass: 'closed_set_choice' as const },
        baseline.steps[1],
      ],
    });
    expect(() => buildDiModePlan([bad], { id: 'item-1', challengeType: 'build_then_say' }))
      .toThrow('gesture step build must use responseClass manipulation');
  });
});
