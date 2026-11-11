import { describe, expect, it } from 'vitest';
import { blockIssues, blockTools, buildBlock, visibleText, type BlockContext } from './blocks';
import { drawShapes, lessonChecks } from './lesson';
import { readerChoice, readVerdicts, studentView } from './review';
import { choiceOf, drawnValues, isEvaluableBlock } from '../../../primitives/visual-primitives/core/deep-dive/deepDiveWorkspace';
import type { ChartBlockData, CheckBlockData, DeepDiveBlock, FillInBlankBlockData, MultipleChoiceBlockData, TimelineBlockData } from '../../../primitives/visual-primitives/core/deep-dive/types';

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

  it('a chart can carry a question answered by reading it, and then counts as a check', () => {
    const points = [{ label: '1960', value: 317 }, { label: '1990', value: 354 }, { label: '2020', value: 414 }];
    const check = { question: 'About how much did CO2 rise from 1960 to 2020?', answer: 'About 97 ppm', distractors: ['About 37 ppm', 'About 60 ppm', 'About 414 ppm'], explanation: 'The line goes from 317 to 414.' };
    const chart = (extra: Record<string, unknown>) => buildBlock('chart', { ...common, chartType: 'line', title: 'CO2 (ppm)', caption: 'NOAA', data: points, ...extra }, ctx);
    const plain = built<ChartBlockData>(chart({ patternCheck: null }));
    expect(plain.patternCheck).toBeUndefined();
    expect(isEvaluableBlock(plain)).toBe(false);

    const asked = built<ChartBlockData>(chart({ patternCheck: check }));
    expect(asked.patternCheck!.options[asked.patternCheck!.correctIndex]).toBe('About 97 ppm');
    expect(isEvaluableBlock(asked)).toBe(true);
    expect(choiceOf(asked)).toMatchObject({ question: check.question });
    expect(blockIssues(asked, ctx).blocking).toEqual([]);
    expect(chart({ patternCheck: { question: 'q?', answer: 'a' } })).toMatchObject({ error: expect.stringMatching(/^patternCheck/) });

    const leaked = built<ChartBlockData>(chart({ caption: 'NOAA: about 97 ppm since 1960.', patternCheck: check }));
    expect(blockIssues(leaked, ctx).blocking.join()).toMatch(/caption names the answer/);
  });

  it('the blind reader gets a chart\'s values, and never its key', () => {
    const asked = built<ChartBlockData>(buildBlock('chart', { ...common, chartType: 'bar', title: 'Rain', caption: 'NOAA', data: [{ label: 'Miami', value: 62 }, { label: 'Boston', value: 43 }], patternCheck: { question: 'Which city had less rain?', answer: 'Boston', distractors: ['Miami', 'Neither', 'Both the same'], explanation: 'Its bar is shorter.' } }, ctx));
    const view = studentView([asked]);
    expect(view).toContain('Miami 62, Boston 43');
    expect(view).toContain('QUESTION: Which city had less rain?');
    expect(view).not.toContain('Its bar is shorter');
  });

  it('the reader and tutor get the numbers a number line and a kit figure draw', () => {
    const line = built<DeepDiveBlock>(buildBlock('number-line', { ...common, min: 0, max: 10, step: 1, points: [{ value: 3, label: 'A' }], caption: 'A line.' }, ctx));
    expect(drawnValues(line)).toBe('a number line from 0 to 10, marked A at 3');
    const coins = built<DeepDiveBlock>(buildBlock('figure', { ...common, display: JSON.stringify({ kind: 'coins', coins: ['dime', 'penny'] }), caption: 'c', altText: 'a' }, ctx));
    expect(drawnValues(coins)).toMatch(/dime/);
    expect(studentView([line])).toContain('marked A at 3');
    expect(visibleText(line)).not.toContain('A at 3');
  });

  it('refuses options too close to tell apart on the chart', () => {
    const data = [{ label: 'Week 1', value: 4 }, { label: 'Week 2', value: 14 }, { label: 'Week 3', value: 20 }];
    const asked = (answer: string, distractors: string[]) => built<ChartBlockData>(buildBlock('chart', { ...common, chartType: 'line', title: 'Height', caption: 'Garden log', data, patternCheck: { question: 'How tall in Week 2?', answer, distractors, explanation: 'Read the line.' } }, ctx));
    expect(blockIssues(asked('14 cm', ['13 cm', '20 cm', '4 cm']), ctx).blocking.join()).toMatch(/too close/);
    expect(blockIssues(asked('14 cm', ['12 cm', '20 cm', '4 cm']), ctx).blocking.join()).not.toMatch(/too close/);
    expect(blockIssues(asked('20 cm', ['19 cm', '14 cm', '4 cm']), ctx).blocking.join()).not.toMatch(/too close/);
  });

  it('builds charts, number lines, definitions and passages, and rejects bad ones', () => {
    const chart = (extra: Record<string, unknown>) => buildBlock('chart', { ...common, chartType: 'line', title: 'CO2 (ppm)', caption: 'NOAA', data: [{ label: '1960', value: 317 }, { label: '1990', value: 354 }, { label: '2020', value: 414 }], ...extra }, ctx);
    expect('error' in chart({})).toBe(false);
    expect(chart({ data: [{ label: 'a', value: 1 }, { label: 'b', value: 2 }] })).toMatchObject({ error: /at least 3 points/ });
    expect(chart({ title: 'Growth of $x^2$' })).toMatchObject({ error: /plain text/ });

    const points = (group: string, labels: string[]) => labels.map((label, i) => ({ label, value: i + 1, group }));
    const twoCities = [...points('Boston', ['1990', '2000', '2010']), ...points('Miami', ['1990', '2000', '2010'])];
    expect(built<ChartBlockData>(chart({ data: twoCities })).inset.data[3]).toEqual({ label: '1990', value: 1, group: 'Miami' });
    expect(chart({ chartType: 'pie', data: twoCities })).toMatchObject({ error: /leave group out/ });
    expect(chart({ data: [...twoCities, { label: '2020', value: 9 }] })).toMatchObject({ error: /every point a group/ });
    expect(chart({ data: points('Boston', ['1', '2', '3']) })).toMatchObject({ error: /2-4 groups/ });
    expect(chart({ data: [...points('A', ['1', '2', '3']), ...points('B', ['1', '2'])] })).toMatchObject({ error: /at least 3 points per group/ });
    expect('error' in chart({ data: [...points('A', ['1', '2', '3']), ...points('B', ['1', '2', '4'])] })).toBe(false);
    expect(chart({ data: [...points('A', ['1', '2', '2']), ...points('B', ['1', '2', '3'])] })).toMatchObject({ error: /in one group share a label/ });
    expect(chart({ chartType: 'bar', data: [...points('A', ['x', 'y']), ...points('B', ['x', 'z'])] })).toMatchObject({ error: /missing bar/ });
    const many = Array.from({ length: 9 }, (_, i) => `L${i}`);
    expect(chart({ chartType: 'bar', data: ['A', 'B', 'C'].flatMap((g) => points(g, many)) })).toMatchObject({ error: /at most 24 bars/ });
    expect(chart({ data: [...points('$a$', ['1', '2', '3']), ...points('B', ['1', '2', '3'])] })).toMatchObject({ error: /plain text/ });

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

  it('lets a hero image sit above any shape\'s opening, and still checks the block after it', () => {
    const offered = drawShapes(() => 0.99, 9);
    const hero = built(buildBlock('hero-image', { ...common, label: 'Otters', imagePrompt: 'A sea otter floating on its back.', caption: 'A sea otter.', altText: 'A sea otter floating.' }, ctx));
    const opens = (blocks: DeepDiveBlock[]) => lessonChecks({ ctx, planned: true, blocks, shape: 'story-first', offered }).blocking.join();
    expect(opens([hero, prose])).not.toMatch(/shape opens with/);
    expect(opens([hero, facts])).toMatch(/story-first shape opens with .*the lesson opens with key-facts/);
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

describe('write_check: a check on a kit answer surface', () => {
  const chart = { kind: 'chart', chart_type: 'line', title: 'CO2 in the air', x_label: 'Year', y_label: 'ppm',
    points: [{ label: '1960', value: 317 }, { label: '1980', value: 339 }, { label: '2000', value: 370 }, { label: '2020', value: 414 }] };
  const pointItem = { surface: 'point', prompt: 'Tap the first year the line is above 350.', board: chart, key: '2000', misconceptions: { '1980': 'Read that point against the axis.' } };
  const check = (item: unknown, extra: Record<string, unknown> = {}) =>
    buildBlock('check', { ...common, item: typeof item === 'string' ? item : JSON.stringify(item), explanation: 'The point for 2000 is the first one above the 350 line.', ...extra }, ctx);

  it('is offered to the author, builds a point item on a chart and is a graded block', () => {
    expect(blockTools(ctx).map((t) => t.name)).toContain('write_check');
    const b = built<CheckBlockData>(check(pointItem));
    expect(b.item.surface).toBe('point');
    expect(b.item.key).toBe('2000');
    expect(b.item.difficulty.band).toBe('medium');
    expect(isEvaluableBlock(b)).toBe(true);
    expect(choiceOf(b)).toBeNull();
    expect(blockIssues(b, ctx).blocking).toEqual([]);
  });

  it('builds the card surfaces with displays on the cards, a make and a set', () => {
    const sort = built<CheckBlockData>(check({ surface: 'categorize', prompt: 'Sort each animal by what it eats.', categories: ['Plants', 'Animals'],
      options: [{ id: 'a', label: 'rabbit' }, { id: 'b', label: 'hawk' }, { id: 'c', label: 'deer' }], key: { a: 'Plants', b: 'Animals', c: 'Plants' } }));
    expect(blockIssues(sort, ctx).blocking).toEqual([]);
    const clocks = built<CheckBlockData>(check({ surface: 'choose', prompt: 'Which clock shows when school starts, at half past eight?',
      options: [{ id: 'a', display: { kind: 'clock', hour: 8, minute: 30 } }, { id: 'b', display: { kind: 'clock', hour: 6, minute: 40 } }, { id: 'c', display: { kind: 'clock', hour: 9, minute: 30 } }], key: 'a' }));
    expect(clocks.item.options.every((o) => o.display?.kind === 'clock')).toBe(true);
    const set = built<CheckBlockData>(check({ surface: 'set', prompt: 'Make the array show 12 in 3 rows.', board: { kind: 'array', rows: 2, columns: 2 },
      controls: [{ field: 'rows', label: 'rows', min: 1, max: 6 }, { field: 'columns', label: 'columns', min: 1, max: 6 }], goal: { value: 12, rows: 3 } }));
    expect(blockIssues(set, ctx).blocking).toEqual([]);
  });

  it('refuses what cannot run, with a sentence the author can act on', () => {
    const err = (b: DeepDiveBlock | { error: string }) => ('error' in b ? b.error : '');
    expect(err(check('{not json'))).toMatch(/JSON text/);
    expect(err(check({ ...pointItem, key: '1990' }))).toMatch(/the key is the name of one part/);
    expect(err(check({ ...pointItem, board: { kind: 'clock', hour: 3, minute: 0 } }))).toMatch(/no parts to tap/);
    expect(err(check({ surface: 'choose', prompt: 'Which?', options: [{ id: 'a', label: '$x$' }, { id: 'b', label: 'two' }], key: 'a' }))).toMatch(/plain text/);
    expect(err(check({ surface: 'choose', prompt: 'Which one is drawn?', stimulus: [{ kind: 'svg', svg: '<svg viewBox="0 0 9 9"></svg>' }], options: [{ id: 'a', label: 'one' }, { id: 'b', label: 'two' }], key: 'a' }))).toMatch(/svg display is not offered/);
    expect(err(check(pointItem, { explanation: '' }))).toMatch(/needs its explanation/);
    expect(err(check({ surface: 'choose', prompt: 'Where is nectar stored?', options: [{ id: 'a', label: 'legs' }, { id: 'b', label: 'wings' }, { id: 'c', label: 'stomach' }], key: 'c' }))).toMatch(/use write_multiple_choice/);
  });

  it('blocks a shortcut code can see, and a label that names the part to tap', () => {
    const named = built(check({ ...pointItem, prompt: 'Tap the point for 2000.' }));
    expect(blockIssues(named, ctx).blocking.join()).toMatch(/name written on the part/);
    const labelled = built(check(pointItem, { label: 'The year 2000' }));
    expect(blockIssues(labelled, ctx).blocking.join()).toMatch(/names the answer/);
  });

  it('reaches the blind reader as words with no key, and code compares its pick', () => {
    const b = { ...built<CheckBlockData>(check(pointItem)), id: 'k' };
    const view = studentView([b]);
    expect(view).toMatch(/\(CHECK\)/);
    expect(view).toContain('OPTIONS: 1960 | 1980 | 2000 | 2020');
    expect(view).toContain('317');
    expect(view).not.toMatch(/Read that point against the axis|first one above the 350 line/);
    expect(readerChoice(b)).toMatchObject({ correctIndex: 2 });
    const raw = { blockIndex: 0, answerable: true, givenAway: false, weakDistractors: ['1960'], note: '' };
    expect(readVerdicts([{ ...raw, answer: '1980' }], [b])[0]).toMatchObject({ disagreed: '1980', weakDistractors: [] });
    expect(readVerdicts([{ ...raw, answer: '2000' }], [b])[0].disagreed).toBeUndefined();
  });

  it('keeps a passage from a pre-reader and holds it to the grade limit', () => {
    const sentence = 'one two three four five six seven eight nine ten eleven twelve';
    const board = { kind: 'passage', sentences: Array.from({ length: 12 }, () => sentence) };
    const item = { surface: 'point', prompt: 'Tap the claim.', board, key: 'Sentence 2' };
    expect(buildBlock('check', { ...common, item: JSON.stringify(item), explanation: 'It is the claim.' }, { ...ctx, preReader: true })).toMatchObject({ error: /pre-readers/ });
    const b = built<CheckBlockData>(buildBlock('check', { ...common, item: JSON.stringify(item), explanation: 'It is the claim.' }, { ...ctx, grade: 3 }));
    expect(blockIssues({ ...b, id: 'x' }, { ...ctx, grade: 3 }).blocking.join()).toMatch(/the passage is 144 words/);
  });

  it('counts as a check in the lesson, and a lesson of only pick-one checks is pointed at it', () => {
    const teach = built(buildBlock('prose', { ...common, paragraphs: ['Carbon dioxide in the air has risen every decade since 1960.'] }, ctx));
    const outline = [{ heading: 'A rising line', ideas: ['Carbon dioxide in the air has risen since 1960.'] }];
    const pick = (q: string) => built(mc('the leaves', ['the roots', 'the stem', 'the flower'], q));
    const input = { ctx, planned: true, outline, seeAlso: null };
    const all = lessonChecks({ ...input, blocks: [teach, pick('Which part makes food?'), teach, pick('Which part makes sugar?'), teach, pick('Which part is green?')] });
    expect(all.advisory.join()).toMatch(/every check is a pick-one question/);
    const mixed = lessonChecks({ ...input, blocks: [teach, pick('Which part makes food?'), teach, pick('Which part makes sugar?'), teach, built(check(pointItem))] });
    expect(mixed.advisory.join()).not.toMatch(/pick-one/);
    expect(mixed.blocking.join()).not.toMatch(/evaluable block/);
  });
});
