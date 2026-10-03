import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { DI_CATALOG } from '../../../service/manifest/catalog/di';
import { FRAME_IDS, themeUsable, type StoryTheme } from './diWordProblemPlan';
import { itemsFromProblems, type WordProblemItem, type WordProblemProblemSpec } from './diWordProblemScript';
import { wordProblemSpokenMisses } from './diWordProblemWorkspace';
import { COUNT_DOTS, MODEL_STORY, READ_ALONG, STORY_LINKS, WITHIN_TEN, countDotsFor, modelStoriesFor, startingLevers, storyLeaks,
  storySentences, withinTenFor, withinTenSteps, wordProblemLeverFacts, wordProblemLevers } from './diWordProblemLevers';
import findP from '../../../components/live-activity/runtime/testing/w1-payloads/di-word-problem-setup.find_big_number.json';
import buildP from '../../../components/live-activity/runtime/testing/w1-payloads/di-word-problem-setup.build_family.json';
import classifyP from '../../../components/live-activity/runtime/testing/w1-payloads/di-word-problem-setup.classify_and_build.json';

const THEME: StoryTheme = { nameA: 'Jen', nameB: 'Sam', nounPlural: 'stickers', gainPast: 'got more', gainBase: 'get more',
  losePast: 'gave away', loseBase: 'give away' };
const steps = (frameId: WordProblemProblemSpec['frameId'], first: number, second: number, mode: WordProblemProblemSpec['challengeType'] = 'build_family',
  max = 20, tier?: WordProblemProblemSpec['supportTier']) =>
  itemsFromProblems([{ id: `p-${frameId}-${first}-${second}`, frameId, theme: THEME, first, second, challengeType: mode, maxNumber: max,
    ...(tier ? { supportTier: tier } : {}) }]).items;
type Payload = { data: { problems: WordProblemProblemSpec[] } };
const SAVED = ([findP, buildP, classifyP] as unknown as Payload[]).map(p => itemsFromProblems(p.data.problems).items);
const CATALOG = DI_CATALOG.find(c => c.id === 'di-word-problem-setup')!.teachingWorkspace!;
const amounts = (i: WordProblemItem) => i.plan.quantities.map(q => q.value);

describe('model_story (R1): an add and a subtract (or one of each kind), never the item\'s numbers', () => {
  it('every frame on a dense grid within 20 has a pair with one add and one subtract, leak-free', () => {
    let checked = 0;
    for (const frame of FRAME_IDS) for (const a of [3, 7, 12, 15]) for (const b of [2, 5, 9]) {
      const built = steps(frame, a, b);
      if (!built.length) continue;
      const models = modelStoriesFor(built[0])!;
      expect(models, `${frame} ${a} ${b}`).not.toBeNull();
      expect(models.map(m => m.operation).sort()).toEqual(['add', 'subtract']);
      for (const m of models) expect(storyLeaks(m, built[0].plan)).toBe(false);
      checked++;
    }
    expect(checked).toBeGreaterThan(40);
  });

  it('classify_and_build shows three, one of each kind, with both operations', () => {
    const [first] = steps('change:gain_end', 8, 5, 'classify_and_build');
    const models = modelStoriesFor(first)!;
    expect(models.map(m => m.shape)).toEqual(['comparison', 'change', 'part_whole']);
    expect(new Set(models.map(m => m.operation))).toEqual(new Set(['add', 'subtract']));
  });

  it('the model is the same across the steps of one story, and its fact never gives this story\'s amounts', () => {
    const all = steps('part_whole:whole', 9, 6);
    const first = JSON.stringify(modelStoriesFor(all[0])), last = JSON.stringify(modelStoriesFor(all[all.length - 1]));
    expect(first).toBe(last);
    for (const session of SAVED) for (const it0 of session) {
      const models = modelStoriesFor(it0)!;
      expect(models, it0.id).not.toBeNull();
      for (const m of models) expect(m.quantities.map(q => q.value).some(v => amounts(it0).includes(v))).toBe(false);
      expect(wordProblemLeverFacts(it0, [MODEL_STORY])).not.toContain(it0.plan.story);
    }
  });

  it('the code themes are usable', () => {
    // The module's themes are used through modelStoriesFor; a theme that failed would build no plan at all.
    expect(themeUsable(THEME)).toBe(true);
  });
});

describe('help per step', () => {
  it('story_links on the placement step: each story part maps to a sentence, the box to the question', () => {
    const [big] = steps('change:gain_end', 8, 5);
    const { sentences, sentenceOf } = storySentences(big.plan);
    for (const q of big.plan.quantities) {
      if (q.known) expect(sentences[sentenceOf[q.id]]).toMatch(new RegExp(`\\b${q.value}\\b`));
      else expect(sentences[sentenceOf[q.id]].endsWith('?')).toBe(true);
    }
    expect(wordProblemLevers(big, []).map(l => l.id)).toEqual([MODEL_STORY, STORY_LINKS]);
  });

  it('read_along on the family step; count_dots and within_ten on the solve step', () => {
    const all = steps('change:gain_end', 14, 5);
    expect(wordProblemLevers(all.find(i => i.kind === 'family')!, []).map(l => l.id)).toEqual([MODEL_STORY, READ_ALONG]);
    expect(wordProblemLevers(all.find(i => i.kind === 'solve')!, []).map(l => l.id)).toEqual([MODEL_STORY, COUNT_DOTS, WITHIN_TEN]);
    expect(wordProblemLevers(all.find(i => i.kind === 'operation')!, []).map(l => l.id)).toEqual([MODEL_STORY]);
  });

  it('count_dots: add draws each known small amount; subtract crosses the known part out of the big amount; none above 20', () => {
    const add = steps('change:gain_end', 8, 5).find(i => i.kind === 'solve')!;
    expect(countDotsFor(add.plan)).toEqual({ kind: 'add', rows: [8, 5] });
    const sub = steps('change:loss_end', 12, 5).find(i => i.kind === 'solve')!;
    expect(countDotsFor(sub.plan)).toEqual({ kind: 'subtract', total: 12, crossed: 5 });
    const big = steps('change:gain_end', 43, 31, 'build_family', 100).find(i => i.kind === 'solve')!;
    expect(countDotsFor(big.plan)).toBeNull();
  });
});

describe('within_ten: the same frame with small numbers, sharing none of the item\'s', () => {
  it('builds the same frame and mode, every amount at most 10, no shared amount, a different answer', () => {
    const solve = steps('change:gain_end', 14, 5).find(i => i.kind === 'solve')!;
    const easier = withinTenFor(solve)!;
    expect(easier.plan.frameId).toBe(solve.plan.frameId);
    expect(easier.kind).toBe('solve');
    expect(easier.id.startsWith(`${solve.id}~simpler`)).toBe(true);
    expect(Math.max(...amounts(easier))).toBeLessThanOrEqual(10);
    expect(amounts(easier).some(v => amounts(solve).includes(v))).toBe(false);
    expect(easier.plan.answer).not.toBe(solve.plan.answer);
    expect(withinTenSteps(solve)!.map(s => s.kind)).toEqual(['big_number', 'family', 'operation', 'solve']);
  });

  it('is refused off the solve step and when the story is already within ten; a within-100 story drops to 20', () => {
    expect(withinTenFor(steps('change:gain_end', 4, 3).find(i => i.kind === 'solve')!)).toBeNull();
    expect(withinTenFor(steps('change:gain_end', 14, 5)[0])).toBeNull();
    const hundred = steps('change:gain_end', 43, 31, 'build_family', 100).find(i => i.kind === 'solve')!;
    expect(Math.max(...amounts(withinTenFor(hundred)!))).toBeLessThanOrEqual(20);
  });
});

describe('starting positions and which lever answers which miss', () => {
  it('only easy starts with the model (no tier is medium)', () => {
    expect(startingLevers(steps('change:gain_end', 8, 5, 'build_family', 20, 'easy')[0])).toEqual([MODEL_STORY]);
    expect(startingLevers(steps('change:gain_end', 8, 5)[0])).toEqual([]);
  });

  it.each([
    ['printed_small_in_big', 'big_number', [MODEL_STORY], STORY_LINKS],
    ['big_in_small_slot', 'family', [MODEL_STORY], READ_ALONG],
    ['wrong_way', 'solve', [MODEL_STORY], COUNT_DOTS],
    ['one_over', 'solve', [MODEL_STORY, COUNT_DOTS], WITHIN_TEN],
  ] as const)('%s on the %s step with %j → %s', (miss, kind, pulled, expected) => {
    const it0 = steps('change:gain_end', 14, 5).find(i => i.kind === kind)!;
    expect(nextLever(wordProblemLevers(it0, pulled), miss)).toBe(expected);
  });

  it('every catalog miss is answered on every saved payload, and every named spoken miss is listed', () => {
    for (const session of SAVED) {
      const mode = session[0].challengeType;
      const answered = new Set(session.flatMap(i => wordProblemLevers(i, []).flatMap(l => l.answers ?? [])));
      for (const miss of CATALOG.misses![mode]) expect(answered.has(miss), `${mode}: ${miss}`).toBe(true);
      for (const i of session) for (const m of wordProblemSpokenMisses(i)) expect(CATALOG.misses![mode], `${i.id} ${m.id}`).toContain(m.id);
    }
  });
});
