import { describe, expect, it } from 'vitest';
import { blockIssues, blockTools, buildBlock, type BlockContext } from './blocks';
import { drawShapes, lessonChecks } from './lesson';
import type { DeepDiveBlock, FillInBlankBlockData, MultipleChoiceBlockData, TimelineBlockData } from '../../../primitives/visual-primitives/core/deep-dive/types';

const ctx: BlockContext = { evalMode: 'recall', preReader: false, grade: 4 };
const common = { label: 'Check', tutoringBrief: 'Ask it.', transitionCue: 'Next.', section: 1, ideas: ['1.1'] };
const mc = (answer: string, distractors: string[], question = 'Which part of the plant makes food?') =>
  buildBlock('multiple-choice', { ...common, check: { question, answer, distractors, explanation: 'Leaves make food.' } }, ctx);
const built = <T extends DeepDiveBlock>(b: DeepDiveBlock | { error: string }) => {
  if ('error' in b) throw new Error(b.error);
  return b as T;
};

describe('deep-dive agent blocks', () => {
  it('keeps the agent-given answer correct after code shuffles the options', () => {
    const b = built<MultipleChoiceBlockData>(mc('the leaves', ['the roots', 'the stem', 'the flower']));
    expect(b.options[b.correctIndex]).toBe('the leaves');
    expect(new Set(b.options).size).toBe(4);
  });

  it('flags a question that contains its answer and a right option picked by length', () => {
    const leak = built(mc('the leaves', ['the roots', 'the stem', 'the flower'], 'Do the leaves make food?'));
    expect(blockIssues(leak, ctx).blocking.join()).toMatch(/contains its own answer/);
    const long = built(mc('the green leaves, using sunlight, water and air', ['roots', 'stem', 'petals']));
    expect(blockIssues(long, ctx).blocking.join()).toMatch(/much longer/);
  });

  it('blocks math the page cannot typeset and passes math it can', () => {
    const bad = built(mc('$-3$', ['$3$', '$0$', '$1$'], 'What is 2(-1) - 1(1)? Use [2, 1; 1, -1].'));
    expect(blockIssues(bad, ctx).blocking.join()).toMatch(/math: .*types a matrix/);
    const broken = built(mc('$\\frac{1}{2$', ['$3$', '$0$', '$1$'], 'Which is half?'));
    expect(blockIssues(broken, ctx).blocking.join()).toMatch(/does not render/);
    const good = built(mc('$-3$', ['$3$', '$0$', '$1$'], 'What is the determinant of $\\begin{bmatrix} 2 & 1 \\\\ 1 & -1 \\end{bmatrix}$?'));
    expect(blockIssues(good, ctx).blocking.join()).not.toMatch(/math/);
  });

  it('builds a worked example with a try step at apply, and checks its arithmetic', () => {
    const apply: BlockContext = { ...ctx, evalMode: 'apply' };
    const steps = [{ work: '$2x + 3 = 11$', reason: 'Start from the equation.' }, { work: '$2x = 8$', reason: 'Subtract 3 from both sides.' }, { work: '$x = 4$', reason: 'Divide both sides by 2.' }];
    const args = { ...common, problem: 'Solve $2x + 3 = 11$.', steps, answer: '$x = 4$, because $2(4) + 3 = 11$.', tryStep: { step: 2, distractors: ['$2x = 14$', '$x + 3 = 11$', '$2x = 11$'], explanation: 'Subtracting 3 undoes the +3.' } };
    const b = built<DeepDiveBlock & { tryStep?: { options: string[]; correctIndex: number; index: number } }>(buildBlock('worked-example', args, apply));
    expect(b.tryStep!.options[b.tryStep!.correctIndex]).toBe('$2x = 8$');
    expect(b.tryStep!.index).toBe(1);
    expect(blockIssues(b, apply).blocking).toEqual([]);
    expect('tryStep' in built(buildBlock('worked-example', args, ctx))).toBe(false);
    expect(buildBlock('worked-example', { ...args, tryStep: { ...args.tryStep, distractors: ['$2x = 8$', '$a$', '$b$'] } }, apply)).toMatchObject({ error: /repeats the right line/ });
    const slip = built(buildBlock('worked-example', { ...args, answer: '$x = 4$, because $2(4) + 3 = 12$.' }, apply));
    expect(blockIssues(slip, apply).blocking.join()).toMatch(/"2\(4\) \+ 3 = 12" is false/);
  });

  it('builds a process and a misconception callout, and rejects bad ones', () => {
    const stage = (title: string) => ({ icon: '💧', title, description: `${title} happens.` });
    const steps = built(buildBlock('process', { ...common, stages: ['Introduced', 'Committee', 'Vote', 'Signed'].map(stage) }, ctx));
    expect(steps).toMatchObject({ blockType: 'process' });
    expect(buildBlock('process', { ...common, stages: ['A', 'B'].map(stage) }, ctx)).toMatchObject({ error: /3-6 stages/ });
    expect(buildBlock('process', { ...common, stages: ['A', 'B', 'a'].map(stage) }, ctx)).toMatchObject({ error: /share a title/ });
    expect(built(buildBlock('misconception', { ...common, belief: 'Heavy things fall faster.', actually: 'Without air, all things fall at the same rate.', why: 'On the Moon a hammer and a feather landed together.' }, ctx))).toMatchObject({ blockType: 'misconception' });
    expect(buildBlock('misconception', { ...common, belief: 'x', actually: 'x', why: 'y' }, ctx)).toMatchObject({ error: /same thing/ });
    expect(blockTools({ ...ctx, preReader: true }).map((t) => t.name)).not.toContain('write_misconception');
  });

  it('builds charts, number lines, definitions and passages, and rejects bad ones', () => {
    const chart = (extra: Record<string, unknown>) => buildBlock('chart', { ...common, chartType: 'line', title: 'CO2 (ppm)', caption: 'NOAA', data: [{ label: '1960', value: 317 }, { label: '1990', value: 354 }, { label: '2020', value: 414 }], ...extra }, ctx);
    expect('error' in chart({})).toBe(false);
    expect(chart({ data: [{ label: 'a', value: 1 }, { label: 'b', value: 2 }] })).toMatchObject({ error: /at least 3 points/ });
    expect(chart({ title: 'Growth of $x^2$' })).toMatchObject({ error: /plain text/ });

    const line = (extra: Record<string, unknown>) => buildBlock('number-line', { ...common, min: 0, max: 1, step: 0.25, caption: 'Quarters', points: [{ value: 0.5, label: '1/2' }], ...extra }, ctx);
    expect(line({})).toMatchObject({ inset: { ticks: [0, 0.25, 0.5, 0.75, 1] } });
    expect(line({ step: 0.3 })).toMatchObject({ error: /equal parts/ });
    expect(line({ points: [{ value: 2, label: 'two' }] })).toMatchObject({ error: /between 0 and 1/ });

    const def = built(buildBlock('definition', { ...common, term: 'slope', definition: 'The slope tells how steep a line is.', example: 'A ramp has a slope.' }, ctx));
    expect(blockIssues(def, ctx).blocking.join()).toMatch(/uses the word "slope"/);

    expect(buildBlock('passage', { ...common, format: 'source', text: 'Four score and seven years ago', attribution: '', intro: 'Read for the date.' }, ctx)).toMatchObject({ error: /attribution/ });
    const long = built(buildBlock('passage', { ...common, format: 'prose', text: 'word '.repeat(250), attribution: '', intro: 'Read it.' }, ctx));
    expect(blockIssues(long, ctx).blocking.join()).toMatch(/250 words; at grade 4 keep it to 200/);
    expect(blockTools({ ...ctx, preReader: true }).map((t) => t.name)).not.toContain('write_chart');
  });

  it('blanks the fill-in-blank answer and rejects an answer not in the sentence', () => {
    const b = built<FillInBlankBlockData>(buildBlock('fill-in-blank', { ...common, sentence: 'Plants make food in a process called photosynthesis.', answer: 'photosynthesis', distractors: ['respiration', 'digestion', 'erosion'] }, ctx));
    expect(b.sentence).toBe('Plants make food in a process called ______.');
    expect(b.wordBank).toContain('photosynthesis');
    expect(buildBlock('fill-in-blank', { ...common, sentence: 'Plants make food.', answer: 'sunlight', distractors: ['a', 'b', 'c'] }, ctx)).toHaveProperty('error');
  });

  it('sets interaction modes from the eval mode, not the agent', () => {
    const events = [{ date: '1903', title: 'First flight', description: 'Wright brothers fly.' }, { date: '1927', title: 'Atlantic', description: 'Lindbergh crosses.' }, { date: '1969', title: 'Moon', description: 'Then Apollo 11 lands.' }];
    const recall = built<TimelineBlockData>(buildBlock('timeline', { ...common, events }, ctx));
    expect(recall.interactionMode).toBe('static');
    const apply = built<TimelineBlockData>(buildBlock('timeline', { ...common, events }, { ...ctx, evalMode: 'apply' }));
    expect(apply.interactionMode).toBe('order');
    expect(blockIssues(apply, { ...ctx, evalMode: 'apply' }).blocking.join()).toMatch(/sequence word/);
  });

  it('rejects a hypothesis lab without exactly one iv and one dv', () => {
    const variables = [{ label: 'water', role: 'iv' }, { label: 'sunlight', role: 'iv' }, { label: 'height', role: 'dv' }, { label: 'soil', role: 'control' }];
    expect(buildBlock('hypothesis-lab', { ...common, scenario: 'Maya grows beans.', variables, explanation: 'x' }, ctx)).toHaveProperty('error');
  });

  it('hides text-heavy block tools from pre-readers', () => {
    const names = blockTools({ preReader: true }).map((t) => t.name);
    expect(names).not.toContain('write_fill_in_blank');
    expect(names).toContain('write_mini_sim');
  });
});

describe('deep-dive agent lesson checks', () => {
  const facts = built(buildBlock('key-facts', { ...common, label: 'Facts', facts: [{ icon: '🌱', headline: 'Green power', text: 'Leaves catch sunlight.' }, { icon: '💧', headline: 'Thirsty', text: 'Roots drink water.' }, { icon: '🌬️', headline: 'Air food', text: 'Leaves take in air.' }] }, ctx));
  const prose = built(buildBlock('prose', { ...common, label: 'Why', paragraphs: ['Leaves use sunlight to make sugar.'] }, ctx));
  const quiz = (a: string) => built(mc(a, ['the roots', 'the stem', 'the flower']));

  it('requires the level\'s evaluable count and forbids two adjacent blocks of a type', () => {
    const r = lessonChecks({ ctx, planned: true, blocks: [facts, prose, quiz('the leaves'), quiz('the green leaves'), prose] });
    expect(r.blocking.join()).toMatch(/both multiple-choice/);
    const few = lessonChecks({ ctx, planned: true, blocks: [facts, prose, quiz('the leaves'), facts, prose] });
    expect(few.blocking.join()).toMatch(/needs at least 3/);
  });

  describe('outline coverage', () => {
    const outline = [
      { heading: 'What leaves do', ideas: ['Leaves make food from sunlight.'] },
      { heading: 'Roots', ideas: ['Roots take in water.', 'Roots hold the plant up.'] },
      { heading: 'Stems', ideas: ['Stems carry water up.'] },
    ];
    const at = (b: DeepDiveBlock, section: number, ideas: string[]): DeepDiveBlock => ({ ...b, section, ideas });
    const run = (blocks: DeepDiveBlock[]) => lessonChecks({ ctx, planned: true, blocks, outline, seeAlso: null }).blocking.join(' | ');

    it('passes a lesson that teaches every idea before testing it', () => {
      const blocks = [
        at(facts, 0, ['1.1']), at(quiz('the leaves'), 0, ['1.1']),
        at(prose, 1, ['2.1', '2.2']), at(quiz('the petals'), 1, ['2.1']),
        at(facts, 2, ['3.1']), at(quiz('the seeds'), 2, ['3.1']),
      ];
      expect(run(blocks)).toBe('');
    });

    it('flags an untaught idea, a check before its teaching, and a missing plan outline', () => {
      const blocks = [
        at(quiz('the leaves'), 0, ['1.1']), at(facts, 0, ['1.1']),
        at(prose, 1, ['2.1']), at(quiz('the petals'), 1, ['2.1']),
        at(facts, 2, ['3.1']), at(quiz('the seeds'), 2, ['3.1']),
      ];
      const out = run(blocks);
      expect(out).toMatch(/block 0 tests 1\.1 before any block teaches it/);
      expect(out).toMatch(/idea 2\.2 .* is not taught/);
      expect(lessonChecks({ ctx, planned: true, blocks }).blocking.join()).toMatch(/needs the outline/);
    });

    it('holds blocks in section order and each section to 2-4 blocks', () => {
      const out = run([at(facts, 1, ['2.1']), at(prose, 0, ['1.1']), at(quiz('the leaves'), 0, ['1.1'])]);
      expect(out).toMatch(/keep blocks in section order/);
      expect(out).toMatch(/section 3 "Stems" has 0 blocks/);
    });
  });

  it('holds an instructor template sequence', () => {
    const r = lessonChecks({ ctx, planned: true, blocks: [facts, prose], requiredSequence: ['prose', 'key-facts'] });
    expect(r.blocking.join()).toMatch(/template requires/);
  });

  it('holds the lesson to its chosen shape\'s opening', () => {
    const offered = drawShapes(() => 0.99, 9);
    const story = lessonChecks({ ctx, planned: true, blocks: [facts, prose], shape: 'story-first', offered });
    expect(story.blocking.join()).toMatch(/story-first shape opens with/);
    const own = lessonChecks({ ctx, planned: true, blocks: [facts, prose], shape: 'own', offered });
    expect(own.blocking.join()).not.toMatch(/opens with/);
  });

  it('draws three distinct shapes', () => {
    const ids = drawShapes().map((s) => s.id);
    expect(new Set(ids).size).toBe(3);
  });
});
