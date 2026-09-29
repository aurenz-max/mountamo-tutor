import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../components/live-activity/runtime/observerLever';
import type { KnowledgeCheckItem } from './knowledgeCheckScript';
import { CUE_LEVER, DROP_LEVER, NO_LEVERS, cueLeak, farChoice, knowledgeCheckLevers, leversOnScreen,
  type KnowledgeCheckLeverState } from './knowledgeCheckLevers';

const choice = (texts: string[], correct: number, extra: Partial<KnowledgeCheckItem> = {}, distances?: ('near' | 'far')[]) => ({
  id: 'p0-mc', kind: 'choice', problemIndex: 0, prompt: 'Which one?', correctOptionId: String.fromCharCode(65 + correct),
  options: texts.map((text, i) => ({ id: String.fromCharCode(65 + i), text,
    distance: i === correct ? 'key' : distances?.[i < correct ? i : i - 1] })),
  ...extra }) as KnowledgeCheckItem;
const honey = choice(['a bee', 'an ant', 'a cow'], 0, { cue: { picture: '🍯', shows: 'a jar of honey' } }, ['near', 'far']);
const stars = choice(['4', '5', '6', '9'], 1);
const state = (s: Partial<KnowledgeCheckLeverState>) => ({ ...NO_LEVERS, ...s });

describe('which lever answers a miss (nextLever over the declared levers)', () => {
  it.each([
    ['text: other_choice, nothing pulled', honey, NO_LEVERS, 'other_choice', CUE_LEVER],
    ['text: other_choice, cue pulled', honey, state({ pulled: [CUE_LEVER] }), 'other_choice', DROP_LEVER],
    ['number: one_less', stars, NO_LEVERS, 'one_less', DROP_LEVER],
    ['number: one_more', stars, NO_LEVERS, 'one_more', DROP_LEVER],
    ['number: other_number', stars, NO_LEVERS, 'other_number', DROP_LEVER],
    ['number: both pulled', stars, state({ pulled: [DROP_LEVER], dropped: ['D'] }), 'one_less', null],
  ] as const)('%s', (_n, item, s, miss, lever) => {
    expect(nextLever(knowledgeCheckLevers(item, s), miss)).toBe(lever);
  });

  it('true/false, blank, match, sort and the production kinds declare no lever', () => {
    for (const kind of ['true_false', 'blank', 'match', 'sort', 'say_it', 'how_many', 'point_to'] as const) {
      expect(knowledgeCheckLevers({ ...honey, kind }, NO_LEVERS)).toEqual([]);
    }
  });
});

describe('drop_far_choice', () => {
  it('numbers: the farthest wrong choice; text: a choice tagged far; untagged text: none', () => {
    expect(farChoice(stars, NO_LEVERS)).toBe('D');
    expect(farChoice(honey, NO_LEVERS)).toBe('C');
    expect(farChoice(choice(['a bee', 'an ant', 'a cow'], 0), NO_LEVERS)).toBeNull();
    expect(knowledgeCheckLevers(choice(['a bee', 'an ant', 'a cow'], 0), NO_LEVERS)).toEqual([]);
  });

  it('keeps two untried choices: a 3-choice menu only before a wrong answer; a picked choice never goes', () => {
    expect(farChoice(honey, state({ wrongs: 1 }))).toBeNull();
    expect(knowledgeCheckLevers(honey, state({ wrongs: 1 })).map(l => l.id)).toEqual([CUE_LEVER]);
    expect(farChoice(stars, state({ wrongs: 1, picked: ['D'] }))).toBe('A');
    expect(farChoice(stars, state({ wrongs: 2, picked: ['D', 'A'] }))).toBeNull();
    expect(farChoice({ ...stars, kind: 'choice_tap' }, state({ picked: ['C', 'C'] }))).toBe('D');
  });

  it('never the key, and never fewer than two untried choices left, over random menus', () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let n = 0; n < 500; n++) {
      const size = 2 + Math.floor(rnd() * 4), key = Math.floor(rnd() * size);
      const numeric = rnd() < 0.5;
      const texts = Array.from({ length: size }, (_, i) => (numeric ? String(10 + i * (1 + Math.floor(rnd() * 3))) : `word${i}`));
      const item = choice(texts, key, {}, Array.from({ length: size - 1 }, () => (rnd() < 0.5 ? 'far' : 'near')));
      const wrongs = Math.floor(rnd() * 3);
      const picked = item.options!.filter(o => o.id !== item.correctOptionId).slice(0, wrongs).map(o => o.id);
      const s = state({ wrongs, picked });
      const drop = farChoice(item, s);
      if (!drop) continue;
      expect(drop).not.toBe(item.correctOptionId);
      expect(picked).not.toContain(drop);
      expect(size - 1 - Math.max(wrongs, picked.length)).toBeGreaterThanOrEqual(2);
      expect(leversOnScreen(item, { ...s, pulled: [DROP_LEVER], dropped: [drop] })).not.toContain(`"${texts[key]}"`);
    }
  });
});

describe('cue_picture leak rule', () => {
  it.each([
    ['a picture of the subject', honey, null],
    ['names a choice', { ...honey, cue: { picture: '🌼', shows: 'a bee on a flower' } }, 'names a choice'],
    ['names a choice in the plural', { ...honey, cue: { picture: '🌼', shows: 'flowers and cows' } }, 'names a choice'],
    // Saved apply.science payload: the key is "Pot A, because plants need water and sun".
    ['shares a word start with a choice', choice(['Pot A, because plants need water and sun', 'Pot B, because plants grow in the dark'], 0,
      { cue: { picture: '🪟', shows: 'sunny window' } }), 'names a choice'],
    ['a word every choice shares', choice(['Plant A gets sun', 'Plant B gets rain'], 0, { cue: { picture: '🪴', shows: 'a potted plant' } }), null],
    ['pictures a choice', choice(['cow', 'duck'], 0, { options: [{ id: 'A', text: 'cow', emoji: '🐄' }, { id: 'B', text: 'duck', emoji: '🦆' }],
      cue: { picture: '🐄', shows: 'a farm animal' } }), 'pictures a choice'],
    ['the key is a number', { ...stars, cue: { picture: '⭐', shows: 'a star' } }, 'the answer is a number: pictures beside it are a count'],
    ['too many pictures', { ...honey, cue: { picture: '🍯🍯🍯🍯', shows: 'honey' } }, 'more than three pictures'],
    ['no cue', { ...honey, cue: undefined }, 'no cue'],
  ] as const)('%s', (_n, item, reason) => {
    expect(cueLeak(item as KnowledgeCheckItem)).toBe(reason);
    expect(knowledgeCheckLevers(item as KnowledgeCheckItem, NO_LEVERS).some(l => l.id === CUE_LEVER)).toBe(reason === null);
  });
});

// Saved Flash payloads (handoff 25), one per mode per subject: the tags are present, the rules hold on real content.
// The sweep drives the ones the judged build accepts (w1-payloads); the probe folder keeps the ones it drops.
const DIRS = [join(__dirname, '../components/live-activity/runtime/testing/w1-payloads'),
  join(__dirname, '../../../../qa/eval-reports/knowledge-check-levers-probe')];
const SAVED = DIRS.flatMap(dir => readdirSync(dir).filter(f => /^knowledge-check\.\w+\.[\w-]+\.json$/.test(f)).map(f => join(dir, f)));

it('twelve or more saved generations carry the tags', () => { expect(SAVED.length).toBeGreaterThanOrEqual(12); });

describe.each(SAVED)('%s', (path) => {
  // Every generated choice problem, built as the judged build would ask it (gates bypassed: one problem at a time).
  const problems = JSON.parse(readFileSync(path, 'utf8')).data.problems.filter((p: { type: string }) => p.type === 'multiple_choice');
  const items: KnowledgeCheckItem[] = problems.map((p: { question: string; options: { id: string; text: string; distance?: string }[]; correctOptionId: string; cue?: unknown }, i: number) =>
    ({ id: `p${i}`, kind: 'choice', problemIndex: i, prompt: p.question, options: p.options, correctOptionId: p.correctOptionId,
      ...(p.cue ? { cue: p.cue } : {}) }) as KnowledgeCheckItem);

  it('every generated choice carries a distance tag, and the key is tagged key', () => {
    for (const item of items) {
      for (const o of item.options!) {
        if (o.id === item.correctOptionId) expect(o.distance, `${item.id} ${o.text}`).toBe('key');
        else expect(['near', 'far'], `${item.id} ${o.text}`).toContain(o.distance);
      }
    }
  });

  it('no pulled lever shows or names the key', () => {
    for (const item of items) {
      const key = item.options!.find(o => o.id === item.correctOptionId)!.text.toLowerCase();
      const drop = farChoice(item, NO_LEVERS);
      if (drop) expect(drop).not.toBe(item.correctOptionId);
      const s = { ...NO_LEVERS, pulled: [CUE_LEVER, DROP_LEVER], dropped: drop ? [drop] : [] };
      const facts = (leversOnScreen(item, s) ?? '').toLowerCase();
      expect(facts).not.toContain(`"${key}"`);
      if (!cueLeak(item)) expect(item.cue!.shows.toLowerCase().split(/\W+/).filter(w => w.length > 3)
        .some(w => key.split(/\W+/).includes(w))).toBe(false);
    }
  });
});
