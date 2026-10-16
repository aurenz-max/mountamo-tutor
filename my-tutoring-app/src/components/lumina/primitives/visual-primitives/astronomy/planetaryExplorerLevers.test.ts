/**
 * planetary-explorer levers, pure: each leak rule, the choice `drop_far_choice` greys out, and which lever answers which
 * miss, over hand-built items and every saved payload.
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { PlanetQuestion, PlanetStop } from './PlanetaryExplorer';
import { planetItems, planetMiss, type PlanetItem } from './planetaryExplorerWorkspace';
import { CARD_LEVER, DROP_LEVER, NO_LEVERS, cardLeak, cardText, farChoice, leverFacts, planetLevers } from './planetaryExplorerLevers';

const q = (question: string, options: string[], correctIndex: number, questionType: PlanetQuestion['questionType'] = 'mc'): PlanetQuestion =>
  ({ question, options, correctIndex, questionType, explanation: '', difficulty: 'easy' });
const stop = (planetId: string, stats: Array<[string, string, string?]>, questions: PlanetQuestion[]): PlanetStop =>
  ({ planetId, focusTheme: '', description: '', funFact: '', transition: '', questions,
    keyStats: stats.map(([label, value, unit]) => ({ label, value, ...(unit ? { unit } : {}) })) });
const one = (planets: PlanetStop[], at = 0): PlanetItem => planetItems(planets).filter(i => i.planetIndex === planets.length - 1)[at];

describe('cardLeak', () => {
  const mars = (question: PlanetQuestion) => [stop('mars', [['Colour', 'Red'], ['Moons', '2'], ['Day', '24.6', 'hours']], [question])];
  it.each([
    ['a choice printed on a card', q('What colour is Mars?', ['Blue', 'Green', 'Red', 'Yellow'], 2), /printed on a card/],
    ['a number on a card', q('How many moons?', ['0', '1', '2', '4'], 2), /printed on a card/],
    ['a true-false statement', q('Mars is red.', ['True', 'False'], 0, 'true-false'), /true-false/],
    ['no choice on a card', q('Why is Mars cold?', ['It is far from the Sun', 'It is made of ice', 'It has no light', 'It spins fast'], 0), null],
    // The labels name what is asked about, never the answer: "Day" on a card does not withhold "a longer day".
    ['a label, not a value', q('Which has a longer day?', ['Mars has a longer day', 'Earth', 'Both the same', 'Neither'], 0), null],
  ] as const)('%s', (_name, question, want) => {
    const planets = mars(question);
    const why = cardLeak(one(planets), planets);
    if (want === null) expect(why).toBeNull(); else expect(why).toMatch(want);
    // Withheld means not offered; offered means the card's words carry no choice.
    const offered = planetLevers(one(planets), NO_LEVERS, planets).some(l => l.id === CARD_LEVER);
    expect(offered).toBe(want === null);
    if (offered) for (const o of question.options) expect(` ${cardText(planets[0]).toLowerCase()} `).not.toContain(` ${o.toLowerCase()} `);
  });
});

describe('drop_far_choice', () => {
  const quiz = (options: string[], key: number) => planetItems([], [q('Which planet?', options, key)])[0];
  it.each([
    ['planets: the farthest from the answer in order from the Sun', quiz(['Mars', 'Jupiter', 'Neptune', 'Mercury'], 1), [], 3],
    ['planets: the farthest untried one', quiz(['Mars', 'Jupiter', 'Neptune', 'Mercury'], 1), [3], 2],
    ['numbers: the farthest number', one([stop('mars', [], [q('How many?', ['0', '1', '2', '40'], 2)])]), [], 3],
    ['numbers with a unit', one([stop('earth', [], [q('Day?', ['365 hours', '12 hours', '24 hours', '48 hours'], 2)])]), [], 0],
    ['words: the choice sharing fewest words with the answer', one([stop('saturn', [], [q('Rings?', ['Hot fire', 'Ice and rock', 'Rock dust', 'Soft fluff'], 1)])]), [], 3],
  ] as const)('%s', (_name, item, picked, want) => {
    expect(farChoice(item, { ...NO_LEVERS, picked, wrongs: picked.length })).toBe(want);
  });

  it('never the key, and never when fewer than two untried choices would be left', () => {
    const item = quiz(['Mars', 'Jupiter', 'Neptune', 'Mercury'], 1);
    for (let k = 0; k < 4; k++) expect(farChoice({ ...item, question: { ...item.question, correctIndex: k } }, NO_LEVERS)).not.toBe(k);
    expect(farChoice(item, { ...NO_LEVERS, picked: [0, 2], wrongs: 2 })).toBeNull();
    expect(farChoice(quiz(['Mars', 'Jupiter', 'Venus'], 1), { ...NO_LEVERS, picked: [0], wrongs: 1 })).toBeNull();
    expect(farChoice(one([stop('mars', [], [q('Red?', ['True', 'False'], 0, 'true-false')])]), NO_LEVERS)).toBeNull();
  });

  it('the scene fact names the greyed choice, never the key', () => {
    const item = quiz(['Mars', 'Jupiter', 'Neptune', 'Mercury'], 1);
    const fact = leverFacts(item, [DROP_LEVER], [2], [])!;
    expect(fact).toContain('"Neptune", is greyed out');
    expect(fact).not.toContain('Jupiter');
  });
});

describe('miss -> lever', () => {
  it.each([
    ['other_family_planet', 'family_model'],
    ['neighbour_planet', 'drop_far_choice'],
    ['same_family_planet', 'drop_far_choice'],
  ])('quiz: %s -> %s', (miss, lever) => {
    const item = planetItems([], [q('Which planet is the biggest?', ['Mars', 'Jupiter', 'Neptune', 'Mercury'], 1)])[0];
    expect(nextLever(planetLevers(item, NO_LEVERS, []), miss)).toBe(lever);
  });

  it('a stop question with no choice on its card: the card first, then the other levers', () => {
    const planets = [stop('mars', [['Moons', '2']], []), stop('jupiter', [['Moons', '95']],
      [q('Which planet has more moons?', ['Mars', 'Both the same', 'Jupiter', 'Neither'], 2, 'compare')])];
    const item = one(planets);
    expect(planetMiss(item, 0, planets)).toBe('other_planet');
    expect(nextLever(planetLevers(item, NO_LEVERS, planets), 'other_planet')).toBe('planet_card');
    expect(nextLever(planetLevers(item, { ...NO_LEVERS, pulled: ['planet_card'] }, planets), 'other_planet')).toBe('visited_cards');
  });

  it('a value from another planet\'s card is other_planet_fact', () => {
    const planets = [stop('mars', [['Moons', '2']], []), stop('jupiter', [['Moons', '95']], [q('How many moons?', ['2', '95', '12', '40'], 1)])];
    expect(planetMiss(one(planets), 0, planets)).toBe('other_planet_fact');
    expect(planetMiss(one(planets), 2, planets)).toBe('other_number');
  });
});

describe('saved payloads', () => {
  it('no offered card lever on any payload item carries a choice on its cards', () => {
    for (const mode of ['explore', 'identify', 'compare', 'apply']) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { data } = require(`../../../components/live-activity/runtime/testing/w1-payloads/planetary-explorer.${mode}.json`);
      for (const item of planetItems(data.planets, data.quizQuestions ?? [])) {
        const offered = planetLevers(item, NO_LEVERS, data.planets).map(l => l.id);
        if (offered.includes(CARD_LEVER)) expect(cardLeak(item, [data.planets[item.planetIndex]]), `${mode} ${item.id}`).toBeNull();
        if (item.question.questionType === 'true-false') expect(offered, `${mode} ${item.id}`).toEqual([]);
      }
    }
  });
});
