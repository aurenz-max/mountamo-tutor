import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgeCheckProblemPlan } from '../../types';

vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: vi.fn() } },
}));

import { ai } from '../geminiClient';
import { generateKnowledgeCheck, generateMatchingProblems } from './gemini-knowledge-check';
import { applyVisualTaskPolicy, requiresVisualSupport } from './gemini-knowledge-check-orchestrator';

const generateContent = vi.mocked(ai.models.generateContent);

function plan(overrides: Partial<KnowledgeCheckProblemPlan> = {}): KnowledgeCheckProblemPlan {
  return {
    index: 0,
    problemType: 'matching_activity',
    difficulty: 'medium',
    insetType: null,
    visualType: null,
    brief: 'Assess the lesson objective.',
    cognitiveNote: 'Checks understanding.',
    objectiveId: null,
    ...overrides,
  };
}

function orchestratorResponse(problem: KnowledgeCheckProblemPlan) {
  return {
    text: JSON.stringify({
      subject: 'SOCIAL_STUDIES',
      assessmentArc: 'Look, then explain.',
      problems: [problem],
    }),
  } as never;
}

function mcResponse(options: { withVisual: boolean; withEmoji?: boolean; optionCount?: 3 | 4 }) {
  return {
    text: JSON.stringify({
      problems: [{
        id: 'mc_1',
        difficulty: 'medium',
        question: 'Which symbol shows the park?',
        options: [
          { id: 'A', text: 'Tree', ...(options.withEmoji ? { emoji: '🌳' } : {}) },
          { id: 'B', text: 'School', ...(options.withEmoji ? { emoji: '🏫' } : {}) },
          { id: 'C', text: 'Bus', ...(options.withEmoji ? { emoji: '🚌' } : {}) },
          { id: 'D', text: 'Home', ...(options.withEmoji ? { emoji: '🏠' } : {}) },
        ].slice(0, options.optionCount ?? 4),
        correctOptionId: 'A',
        rationale: 'The tree marks the park.',
        teachingNote: '',
        successCriteria: ['Use a map key.'],
        ...(options.withVisual ? {
          visualInstruction: 'Use the map key.',
          visualItem0Name: 'Park',
          visualItem0Icon: '🌳',
          visualItem0Count: 1,
          visualItem1Name: 'School',
          visualItem1Icon: '🏫',
          visualItem1Count: 1,
          visualItem2Name: 'Bus stop',
          visualItem2Icon: '🚌',
          visualItem2Count: 1,
        } : {}),
      }],
    }),
  } as never;
}

function comparisonMcResponse() {
  return {
    text: JSON.stringify({
      problems: [{
        id: 'mc_1',
        difficulty: 'medium',
        question: 'How did the wheel help?',
        options: [
          { id: 'A', text: 'Moved loads' },
          { id: 'B', text: 'Made rain' },
          { id: 'C', text: 'Grew food' },
          { id: 'D', text: 'Made light' },
        ],
        correctOptionId: 'A',
        rationale: 'The wheel made loads easier to move.',
        teachingNote: '',
        successCriteria: ['Compare life before and after.'],
        visualInstruction: 'Compare before and after.',
        visualLeftLabel: 'Before',
        visualLeftName: 'Heavy load',
        visualLeftIcon: '🪨',
        visualRightLabel: 'After',
        visualRightName: 'Wheel cart',
        visualRightIcon: '🛒',
      }],
    }),
  } as never;
}

function matchingResponse() {
  return {
    text: JSON.stringify({
      problems: [{
        id: 'match_1',
        difficulty: 'medium',
        prompt: 'Match each noun.',
        leftItems: [
          { id: 'L1', text: 'dog' },
          { id: 'L2', text: 'park' },
          { id: 'L3', text: 'teacher' },
        ],
        rightItems: [
          { id: 'R1', text: 'animal' },
          { id: 'R2', text: 'place' },
          { id: 'R3', text: 'person' },
        ],
        mappings: [
          { leftId: 'L1', rightIds: ['R1'] },
          { leftId: 'L2', rightIds: ['R2'] },
          { leftId: 'L3', rightIds: ['R3'] },
        ],
        rationale: 'Each noun names an animal, place, or person.',
        teachingNote: '',
        successCriteria: ['Sort common nouns.'],
      }],
    }),
  } as never;
}

describe('knowledge-check Grade-1 reader fit', () => {
  beforeEach(() => {
    generateContent.mockReset();
  });

  it('threads precise Grade 1 and turns one visual task into schema-backed MCQ evidence', async () => {
    generateContent
      .mockResolvedValueOnce(orchestratorResponse(plan()))
      .mockResolvedValueOnce(mcResponse({ withVisual: true }));

    const problems = await generateKnowledgeCheck('Interpret neighborhood map symbols', 'elementary', {
      useOrchestrator: true,
      count: 1,
      bloomsTier: 'analyze',
      preciseGrade: '1',
      context: 'Use a map legend with picture support.',
    });

    const orchestratorCall = generateContent.mock.calls[0][0];
    const orchestratorPrompt = String(orchestratorCall.contents);
    expect(orchestratorPrompt).toContain('PRECISE GRADE 1 / EMERGING READER PROFILE');
    expect(orchestratorPrompt).toContain('VISUAL EVIDENCE REQUIRED FOR THIS GRADE-1 TASK');

    const generatorCall = generateContent.mock.calls[1][0];
    const generatorPrompt = String(generatorCall.contents);
    expect(generatorPrompt).toContain('PRECISE GRADE 1 / EMERGING READER — HARD CONSTRAINT');
    expect(generatorPrompt).toContain('REQUIRED VISUAL: OBJECT COLLECTION');

    const responseSchema = generatorCall.config?.responseSchema as any;
    const itemSchema = responseSchema.properties.problems.items;
    expect(itemSchema.required).toContain('visualItem2Icon');
    expect(itemSchema.properties.options.maxItems).toBe('4');

    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({
      type: 'multiple_choice',
      gradeLevel: 'elementary',
      visual: {
        type: 'object-collection',
        data: {
          items: [
            { name: 'Park', icon: '🌳', count: 1 },
            { name: 'School', icon: '🏫', count: 1 },
            { name: 'Bus stop', icon: '🚌', count: 1 },
          ],
        },
      },
    });
  });

  it('rejects a visual plan whose generated payload omits the required picture evidence', async () => {
    generateContent
      .mockResolvedValueOnce(orchestratorResponse(plan()))
      .mockResolvedValueOnce(mcResponse({ withVisual: false }));

    await expect(generateKnowledgeCheck('Interpret neighborhood map symbols', 'elementary', {
      useOrchestrator: true,
      count: 1,
      preciseGrade: '1',
      context: 'Use picture symbols from a map key.',
    })).rejects.toThrow('All generators failed');
  });

  it('renders the invention before/after task as a comparison panel', async () => {
    generateContent
      .mockResolvedValueOnce(orchestratorResponse(plan({ brief: 'Compare life before and after the invention.' })))
      .mockResolvedValueOnce(comparisonMcResponse());

    const problems = await generateKnowledgeCheck('How inventions change daily life', 'elementary', {
      useOrchestrator: true,
      count: 1,
      bloomsTier: 'analyze',
      preciseGrade: '1',
      context: 'Use picture support to compare life before and after an invention.',
    });

    expect(problems[0]).toMatchObject({
      type: 'multiple_choice',
      visual: {
        type: 'comparison-panel',
        data: {
          panels: [
            {
              label: 'Before',
              collection: { items: [{ name: 'Heavy load', icon: '🪨', count: 1 }] },
            },
            {
              label: 'After',
              collection: { items: [{ name: 'Wheel cart', icon: '🛒', count: 1 }] },
            },
          ],
        },
      },
    });
  });

  it('bounds Grade-1 matching at three short pairs even for analyze', async () => {
    generateContent.mockResolvedValueOnce(matchingResponse());

    const problems = await generateMatchingProblems(
      'Common nouns',
      'elementary',
      1,
      'Match familiar examples.',
      'analyze',
      undefined,
      '1',
    );

    const generatorCall = generateContent.mock.calls[0][0];
    const generatorPrompt = String(generatorCall.contents);
    const itemSchema = (generatorCall.config?.responseSchema as any).properties.problems.items;
    expect(generatorPrompt).toContain('PRECISE GRADE 1 / EMERGING READER');
    expect(itemSchema.properties.leftItems).toMatchObject({ minItems: '3', maxItems: '3' });
    expect(itemSchema.properties.rightItems).toMatchObject({ minItems: '3', maxItems: '3' });
    expect(itemSchema.properties.mappings).toMatchObject({ minItems: '3', maxItems: '3' });
    expect(problems[0].leftItems).toHaveLength(3);
    expect(problems[0].rightItems).toHaveLength(3);
    expect(problems[0].mappings).toHaveLength(3);
  });

  it('keeps the K picture-option floor and does not attach the Grade-1 visual panel', async () => {
    generateContent
      .mockResolvedValueOnce(orchestratorResponse(plan({ visualType: 'object-collection' })))
      .mockResolvedValueOnce(mcResponse({ withVisual: false, withEmoji: true, optionCount: 3 }));

    const problems = await generateKnowledgeCheck('Map symbols', 'kindergarten', {
      useOrchestrator: true,
      count: 1,
      preciseGrade: 'K',
    });

    const responseSchema = generateContent.mock.calls[1][0].config?.responseSchema as any;
    const itemSchema = responseSchema.properties.problems.items;
    expect(itemSchema.properties.options.items.required).toContain('emoji');
    expect(itemSchema.properties.visualItem0Icon).toBeUndefined();
    expect(problems[0].type).toBe('multiple_choice');
    expect((problems[0] as any).visual).toBeUndefined();
    expect((problems[0] as any).options.every((option: any) => option.emoji)).toBe(true);
  });
});

describe('knowledge-check visual task policy', () => {
  it('treats Grade-1 invention change as comparison evidence even without a picture keyword', () => {
    expect(requiresVisualSupport('Explain how an invention changed daily life.')).toBe(true);
  });

  it('converts only one problem and preserves its mixed-set siblings', () => {
    const problems = [
      plan({ problemType: 'matching_activity' }),
      plan({ index: 1, problemType: 'sequencing_activity', brief: 'Sequence the taught steps.' }),
    ];

    applyVisualTaskPolicy(problems, {
      required: true,
      taskText: 'Compare an invention before and after it changed daily life.',
    });

    expect(problems[0]).toMatchObject({
      problemType: 'multiple_choice',
      visualType: 'comparison-panel',
      insetType: null,
    });
    expect(problems[1]).toMatchObject({
      problemType: 'sequencing_activity',
      visualType: null,
    });
  });

  it('does not let a visual sibling mask a text-only matching failure', () => {
    const problems = [
      plan({ problemType: 'multiple_choice', visualType: 'object-collection' }),
      plan({ index: 1, problemType: 'matching_activity', brief: 'Match each map symbol to its place.' }),
      plan({ index: 2, problemType: 'true_false', brief: 'A key tells what symbols mean.' }),
    ];

    applyVisualTaskPolicy(problems, {
      required: true,
      taskText: 'Interpret neighborhood map symbols using a picture key.',
    });

    expect(problems[0]).toMatchObject({ problemType: 'multiple_choice', visualType: 'object-collection' });
    expect(problems[1]).toMatchObject({ problemType: 'multiple_choice', visualType: 'object-collection' });
    expect(problems[2]).toMatchObject({ problemType: 'true_false', visualType: null });
  });

  it('does not add pictures to a non-visual Grade-1 task', () => {
    const problems = [plan({ problemType: 'matching_activity' })];
    applyVisualTaskPolicy(problems, { required: false, taskText: 'Identify common nouns.' });
    expect(problems[0]).toMatchObject({ problemType: 'matching_activity', visualType: null });
  });
});
