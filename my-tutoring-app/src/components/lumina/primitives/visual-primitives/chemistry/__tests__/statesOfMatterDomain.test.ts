/**
 * states-of-matter's domain: what is this primitive's own pedagogy, kept from the judged-pack tests when the cue
 * protocol went with the move to the boss (2026-10-19). The boss guards (`boss.test.ts`) run the shared checks.
 *  - every mode speaks, and the response class follows the answer set;
 *  - the asks: an observe ask never names the state below easy, a predict ask speaks its thresholds and never the
 *    state, a change ask speaks transitions, a compare ask names both options; each passes `askLeaks` with its key;
 *  - the science build gates and the session invariant;
 *  - the key and the harness answers.
 */

import { describe, expect, it } from 'vitest';
import { askLeaks, spokenKeyText } from '../../../../components/live-activity/spokenKey';
import { CHEMISTRY_CATALOG } from '../../../../service/manifest/catalog/chemistry';
import {
  STATE_MENU_CLAUSE,
  askFor,
  itemFromChallenge,
  itemsFromChallenges,
  responseClassFor,
  statesKey,
  statesOfMatterHarnessAnswers,
  type StatesChallengeLike,
  type StatesOfMatterItem,
  type StatesTier,
} from '../statesOfMatterDomain';

// Every substance distinct: the session invariant would drop reuse.
const FULL_SPREAD: StatesChallengeLike[] = [
  // water mp 0 / bp 100: 50°C is a liquid
  { id: 'o1', challengeType: 'observe', substanceKey: 'water', startTemp: 50 },
  // iron mp 1538: 20°C is a solid
  { id: 'o2', challengeType: 'observe', substanceKey: 'iron', startTemp: 20 },
  // wax mp 60 / bp 370: solid at 20, liquid at 200
  { id: 'p1', challengeType: 'predict', kind: 'predict_state', substanceKey: 'wax', startTemp: 20, targetTemp: 200 },
  // mercury mp -39 / bp 357: liquid at 100, gas at 400 = boiling
  { id: 'p2', challengeType: 'predict', kind: 'predict_change', substanceKey: 'mercury', startTemp: 100, targetTemp: 400 },
  // coconut oil (24) vs butter (32), both solid at 4°C
  { id: 'c1', challengeType: 'compare', kind: 'melt_first', pairKeys: ['coconutOil', 'butter'], startTemp: 4 },
  // chocolate (34) vs aluminum (660): at 200°C only aluminum is still solid
  { id: 'c2', challengeType: 'compare', kind: 'stay_solid', pairKeys: ['chocolate', 'aluminum'], startTemp: 14, targetTemp: 200 },
];

const itemsOf = (challenges: StatesChallengeLike[], tier: StatesTier = 'medium'): StatesOfMatterItem[] =>
  itemsFromChallenges(challenges, { band: '3-5', tier });

const byId = (items: StatesOfMatterItem[], id: string): StatesOfMatterItem => {
  const item = items.find((i) => i.id === id);
  if (!item) throw new Error(`fixture item ${id} was dropped`);
  return item;
};

const one = (ch: StatesChallengeLike, band: 'K-2' | '3-5' = '3-5', tier: StatesTier = 'medium') =>
  itemFromChallenge(ch, { band, tier });

describe('every mode speaks', () => {
  it('the full spread builds, every item voice, states and changes short words, a two-name menu a closed set', () => {
    const items = itemsOf(FULL_SPREAD);
    expect(items).toHaveLength(FULL_SPREAD.length);
    for (const item of items) {
      expect(item.answerKind).toBe('voice');
      expect(item.responseClass).toBe(responseClassFor(item.kind));
    }
    expect(['o1', 'p1', 'p2'].map((id) => byId(items, id).responseClass)).toEqual(Array(3).fill('short_spoken_word'));
    expect(['c1', 'c2'].map((id) => byId(items, id).responseClass)).toEqual(Array(2).fill('closed_set_choice'));
  });
});

describe('the asks', () => {
  it('no ask at any tier says its answer, and none hands over with "Your turn"', () => {
    for (const tier of ['easy', 'medium', 'hard'] as StatesTier[]) {
      for (const item of itemsOf(FULL_SPREAD, tier)) {
        expect(askLeaks(askFor(item), statesKey(item)), `${item.id}/${tier}`).toEqual([]);
        expect(askFor(item)).not.toMatch(/Your turn/);
      }
    }
  });

  it('an observe ask never names a state at medium or hard; easy alone names the menu, as a menu key', () => {
    for (const tier of ['medium', 'hard'] as StatesTier[]) {
      const item = byId(itemsOf(FULL_SPREAD, tier), 'o1');
      expect(askFor(item).toLowerCase()).not.toMatch(/solid|liquid|gas/);
      expect(statesKey(item).menu).toBeUndefined();
    }
    const easy = byId(itemsOf(FULL_SPREAD, 'easy'), 'o1');
    expect(askFor(easy)).toContain(STATE_MENU_CLAUSE);
    expect(statesKey(easy).menu).toEqual(['solid', 'liquid', 'gas']);
  });

  it('a predict ask states the thresholds aloud but never the state', () => {
    const ask = askFor(byId(itemsOf(FULL_SPREAD), 'p1')).toLowerCase();
    expect(ask).toContain('melts at 60 degrees');
    expect(ask).toContain('boils at 370 degrees');
    expect(ask).not.toMatch(/liquid|solid/);
  });

  it('a change ask speaks its thresholds as transitions, and a negative temperature in words', () => {
    const ask = askFor(byId(itemsOf(FULL_SPREAD), 'p2')).toLowerCase();
    expect(ask).toContain('turns from solid to liquid at minus 39 degrees');
    expect(ask).not.toMatch(/melt|boil|freez|condens|-39/);
  });

  it('a compare ask names both options, and the key is a menu of the two', () => {
    const item = byId(itemsOf(FULL_SPREAD), 'c1');
    expect(askFor(item)).toMatch(/Coconut Oil, or Butter\?$/);
    expect(statesKey(item)).toMatchObject({ answer: 'Coconut Oil', menu: ['Coconut Oil', 'Butter'] });
  });
});

describe('science build gates', () => {
  it('drops an unresolvable substance', () => {
    expect(one({ id: 'x', challengeType: 'observe', substanceKey: 'unobtanium', startTemp: 20 })).toBeNull();
  });

  it('drops a gas answer on a substance that scorches rather than boils, and never speaks its boiling point', () => {
    expect(one({ id: 'x', challengeType: 'observe', substanceKey: 'chocolate', startTemp: 400 })).toBeNull();
    expect(one({ id: 'x', challengeType: 'predict', kind: 'predict_state', substanceKey: 'chocolate', startTemp: 10, targetTemp: 400 })).toBeNull();
    const ask = askFor(one({ id: 'x', challengeType: 'predict', kind: 'predict_state', substanceKey: 'chocolate', startTemp: 10, targetTemp: 100 })!);
    expect(ask).toContain('melts at 34 degrees');
    expect(ask).not.toContain('boils at');
  });

  it('drops anything asked from inside the margin around a threshold', () => {
    expect(one({ id: 'x', challengeType: 'observe', substanceKey: 'water', startTemp: 3 })).toBeNull();
    expect(one({ id: 'x', challengeType: 'observe', substanceKey: 'water', startTemp: 50 })).not.toBeNull();
  });

  it('K-2 never hears a below-zero temperature, and never draws an off-band substance', () => {
    expect(one({ id: 'x', challengeType: 'observe', substanceKey: 'water', startTemp: -20 }, 'K-2')).toBeNull();
    expect(one({ id: 'x', challengeType: 'observe', substanceKey: 'iron', startTemp: 20 }, 'K-2')).toBeNull();
    expect(one({ id: 'x', challengeType: 'observe', substanceKey: 'wax', startTemp: 20 }, 'K-2')).not.toBeNull();
  });

  it('predict_change is Grade 3-5 only, and needs a real change', () => {
    const ch: StatesChallengeLike = { id: 'x', challengeType: 'predict', kind: 'predict_change', substanceKey: 'wax', startTemp: 20, targetTemp: 200 };
    expect(one(ch)!.answerChange).toBe('melting');
    expect(one(ch, 'K-2')).toBeNull();
    expect(one({ ...ch, targetTemp: 40 })).toBeNull();
  });

  it('drops a compare pair whose beakers do not match at the start, or that is not ear-separable', () => {
    expect(one({ id: 'x', challengeType: 'compare', kind: 'melt_first', pairKeys: ['chocolate', 'wax'], startTemp: 40 })).toBeNull();
    expect(one({ id: 'x', challengeType: 'compare', kind: 'melt_first', pairKeys: ['chocolate', 'wax'], startTemp: 14 })).not.toBeNull();
    expect(one({ id: 'x', challengeType: 'compare', kind: 'melt_first', pairKeys: ['water', 'butter'], startTemp: -20 })).toBeNull();
    expect(one({ id: 'x', challengeType: 'compare', kind: 'melt_first', pairKeys: ['nitrogen', 'oxygen'], startTemp: -240 })).toBeNull();
  });

  it('drops a stay_solid whose target leaves both survivors or none', () => {
    const base: StatesChallengeLike = { id: 'x', challengeType: 'compare', kind: 'stay_solid', pairKeys: ['chocolate', 'aluminum'], startTemp: 14 };
    expect(one({ ...base, targetTemp: 200 })!.answerName).toBe('Aluminum');
    expect(one({ ...base, targetTemp: 20 })).toBeNull();
    expect(one({ ...base, targetTemp: 800 })).toBeNull();
  });
});

describe('the session invariant', () => {
  it('a substance appears in ONE item per session, in any role', () => {
    const items = itemsOf([
      { id: 'a', challengeType: 'observe', substanceKey: 'wax', startTemp: 200 },
      { id: 'b', challengeType: 'predict', kind: 'predict_state', substanceKey: 'wax', startTemp: 20, targetTemp: 200 },
      { id: 'c', challengeType: 'compare', kind: 'melt_first', pairKeys: ['wax', 'iron'], startTemp: 20 },
      { id: 'd', challengeType: 'observe', substanceKey: 'iron', startTemp: 20 },
    ]);
    expect(items.map((i) => i.id)).toEqual(['a', 'd']);
  });

  it('consecutive same-action items may not share an answer', () => {
    const items = itemsOf([
      { id: 'a', challengeType: 'observe', substanceKey: 'iron', startTemp: 20 },
      { id: 'b', challengeType: 'observe', substanceKey: 'aluminum', startTemp: 20 },
      { id: 'c', challengeType: 'observe', substanceKey: 'water', startTemp: 50 },
    ]);
    expect(items.map((i) => i.id)).toEqual(['a', 'c']);
  });
});

describe('the key and the harness answers', () => {
  it('observe: the state, the substance said back is the signature miss', () => {
    const item = byId(itemsOf(FULL_SPREAD), 'o1');
    expect(statesOfMatterHarnessAnswers(item)).toEqual({ correct: 'liquid', plainWrong: 'solid' });
    expect(spokenKeyText(statesKey(item))).toMatch(/^"liquid".*\("Water"\) with no state word is not it\.$/);
  });

  it('observe accepts the honest synonym for water only: "ice", "steam"', () => {
    expect(statesKey(one({ id: 'x', challengeType: 'observe', substanceKey: 'water', startTemp: -20 })!).alsoAccept).toContain('ice');
    expect(statesKey(one({ id: 'x', challengeType: 'observe', substanceKey: 'water', startTemp: 150 })!).alsoAccept).toContain('steam');
    expect(statesKey(byId(itemsOf(FULL_SPREAD), 'o2')).alsoAccept).toEqual(['a solid', 'it is a solid']);
  });

  it('predict_state: the state it is in now is the signature miss; a no-change item says the state holds', () => {
    const item = byId(itemsOf(FULL_SPREAD), 'p1');
    expect(statesKey(item).signatureError).toBe('"solid", the state it is in now, is not it.');
    const still = one({ id: 'x', challengeType: 'predict', kind: 'predict_state', substanceKey: 'wax', startTemp: 100, targetTemp: 200 })!;
    expect(statesKey(still).answer).toBe('liquid');
    expect(statesKey(still).signatureError).toMatch(/never crosses a threshold/);
    expect(statesOfMatterHarnessAnswers(still).plainWrong).not.toBe('liquid');
  });

  it('predict_change: the change word; the end state and the opposite change are not it', () => {
    const item = byId(itemsOf(FULL_SPREAD), 'p2');
    expect(statesOfMatterHarnessAnswers(item)).toEqual({ correct: 'boiling', plainWrong: 'condensing' });
    expect(statesKey(item)).toMatchObject({ answer: 'boiling', alsoAccept: ['boil'] });
    expect(statesKey(item).signatureError).toBe('The state it ends up in ("gas") is not it, and neither is the opposite change ("condensing").');
  });

  it('compare: the other name, the comparison read backwards', () => {
    expect(statesOfMatterHarnessAnswers(byId(itemsOf(FULL_SPREAD), 'c2'))).toEqual({ correct: 'Aluminum', plainWrong: 'Chocolate' });
  });
});

describe('catalog steering', () => {
  const entry = CHEMISTRY_CATALOG.find((c) => c.id === 'states-of-matter')!;

  it('routes as a spoken surface with a microphone, and forbids manifest answer keys', () => {
    expect(entry.description).toContain('DIRECT INSTRUCTION');
    expect(entry.constraints).toContain('microphone');
    expect(entry.constraints).toContain('must NOT supply substances');
    const prose = `${entry.description} ${entry.constraints}`.toLowerCase();
    expect(prose).not.toMatch(/multiple choice|tap the|true\/false/);
  });

  it('keeps the three eval-mode identities and their betas', () => {
    expect((entry.evalModes ?? []).map((m) => [m.evalMode, m.beta])).toEqual([['observe', -1.0], ['predict', 0.5], ['compare', 2.0]]);
  });
});
