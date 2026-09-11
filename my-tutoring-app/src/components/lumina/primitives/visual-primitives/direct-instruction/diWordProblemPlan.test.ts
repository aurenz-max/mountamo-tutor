/**
 * The story, family and answer are the pedagogy's ground truth, so their gates
 * are pinned here rather than trusted: a story that slips one of them hands the
 * judge a discrimination the bench never measured.
 */

import { describe, it, expect } from 'vitest';
import {
  bigNumberWrongPlacement,
  drawNumbersFor,
  equationSpoken,
  familyAsSubtraction,
  familyIncomplete,
  familyMisplaced,
  familySolved,
  familySpoken,
  familySpokenSwapped,
  FRAME_IDS,
  planWordProblem,
  reseedWordProblemPool,
  themeUsable,
  wrongWayAnswer,
  type StoryTheme,
  type WordProblemSpec,
} from './diWordProblemPlan';

const THEME: StoryTheme = {
  nameA: 'Jen', nameB: 'Tom', nounPlural: 'stickers',
  gainPast: 'found', gainBase: 'find', losePast: 'lost', loseBase: 'lose',
};

const spec = (partial: Partial<WordProblemSpec> & Pick<WordProblemSpec, 'frameId' | 'first' | 'second'>): WordProblemSpec => ({
  id: 't', theme: THEME, ...partial,
});

describe('planWordProblem — every frame, shape × unknown pinned', () => {
  it('comparison, big unknown: Jen 12, Tom 8 more → Tom is the big number, an addition family', () => {
    const p = planWordProblem(spec({ frameId: 'comparison:more_person', first: 12, second: 8 }))!;
    expect(p).not.toBeNull();
    expect(p.story).toBe('Jen has 12 stickers. Tom has 8 more stickers than Jen. How many stickers does Tom have?');
    expect(p.storySpoken).toBe('Jen has twelve stickers. Tom has eight more stickers than Jen. How many stickers does Tom have?');
    expect(p.answer).toBe(20);
    expect(p.big.label).toBe("Tom's stickers");
    expect(p.big.known).toBe(false);
    expect(p.operation).toBe('add');
    expect(familySpoken(p)).toBe('twelve plus eight equals box');
    expect(familySpokenSwapped(p)).toBe('eight plus twelve equals box');
    expect(familyMisplaced(p)).toBe('eight plus box equals twelve');
    expect(familyAsSubtraction(p)).toBeNull();
    expect(familyIncomplete(p)).toBe('twelve plus box');
    expect(familySolved(p)).toBe('twelve plus eight equals twenty');
    expect(equationSpoken(p)).toBe('twelve plus eight equals twenty');
    expect(bigNumberWrongPlacement(p).label).toBe("Jen's stickers"); // the biggest number seen
    expect(wrongWayAnswer(p)).toBe(4);
    expect(p.verbCueOperation).toBe('add');
  });

  it('comparison, difference unknown: Jen 20, Tom 12 → Jen is the big number, a subtraction family', () => {
    const p = planWordProblem(spec({ frameId: 'comparison:difference', first: 20, second: 12 }))!;
    expect(p.answer).toBe(8);
    expect(p.big.label).toBe("Jen's stickers");
    expect(p.big.known).toBe(true);
    expect(p.unknown.label).toBe('how many more');
    expect(p.operation).toBe('subtract');
    expect(p.verbCueOperation).toBe('add'); // "more" — the signature disagreement
    expect(familySpoken(p)).toBe('twelve plus box equals twenty');
    expect(familyMisplaced(p)).toBe('twenty plus twelve equals box');
    expect(familyAsSubtraction(p)).toBe('twenty minus twelve equals box');
    expect(familyIncomplete(p)).toBe('box equals twenty');
    expect(equationSpoken(p)).toBe('twenty minus twelve equals eight');
    expect(bigNumberWrongPlacement(p).label).toBe("Tom's stickers");
    expect(wrongWayAnswer(p)).toBe(32);
    expect(p.answerSentence).toBe('Jen has eight more stickers than Tom.');
  });

  it('comparison, fewer: Jen 15, Tom 6 fewer → Jen is the big number', () => {
    const p = planWordProblem(spec({ frameId: 'comparison:fewer_person', first: 15, second: 6 }))!;
    expect(p.answer).toBe(9);
    expect(p.big.label).toBe("Jen's stickers");
    expect(p.unknown.label).toBe("Tom's stickers");
    expect(familySpoken(p)).toBe('six plus box equals fifteen');
    expect(p.verbCueOperation).toBe('subtract');
  });

  it('change, gain, end unknown: had 9, found 6 → "now" is the big number', () => {
    const p = planWordProblem(spec({ frameId: 'change:gain_end', first: 9, second: 6 }))!;
    expect(p.story).toBe('Jen had 9 stickers. Then Jen found 6 more. How many stickers does Jen have now?');
    expect(p.answer).toBe(15);
    expect(p.big.label).toBe('what Jen has now');
    expect(p.big.known).toBe(false);
    expect(familySpoken(p)).toBe('nine plus six equals box');
    expect(bigNumberWrongPlacement(p).label).toBe('what Jen started with');
  });

  it('change, loss, end unknown: had 15, lost 6 → the start is the big number', () => {
    const p = planWordProblem(spec({ frameId: 'change:loss_end', first: 15, second: 6 }))!;
    expect(p.answer).toBe(9);
    expect(p.big.label).toBe('what Jen started with');
    expect(familySpoken(p)).toBe('six plus box equals fifteen');
    expect(familyAsSubtraction(p)).toBe('fifteen minus six equals box');
    expect(p.operation).toBe('subtract');
    expect(p.verbCueOperation).toBe('subtract');
  });

  it('change, gain, change unknown: had 9, now 15 → "found" sounds like add, the family says subtract', () => {
    const p = planWordProblem(spec({ frameId: 'change:gain_change', first: 9, second: 15 }))!;
    expect(p.story).toBe('Jen had 9 stickers. Then Jen found some more. Now Jen has 15 stickers. How many stickers did Jen find?');
    expect(p.answer).toBe(6);
    expect(p.big.label).toBe('what Jen has now');
    expect(p.unknown.label).toBe('what Jen found');
    expect(p.operation).toBe('subtract');
    expect(p.verbCueOperation).toBe('add');
    expect(p.verbCueWord).toBe('found');
    expect(familySpoken(p)).toBe('nine plus box equals fifteen');
    expect(p.answerSentence).toBe('Jen found six stickers.');
  });

  it('change, loss, change unknown: had 15, now 9 → the start is the big number', () => {
    const p = planWordProblem(spec({ frameId: 'change:loss_change', first: 15, second: 9 }))!;
    expect(p.answer).toBe(6);
    expect(p.big.label).toBe('what Jen started with');
    expect(familySpoken(p)).toBe('nine plus box equals fifteen');
    expect(p.answerSentence).toBe('Jen lost six stickers.');
  });

  it('part-whole, whole unknown: 7 red and 5 blue → all is the big number', () => {
    const p = planWordProblem(spec({ frameId: 'part_whole:whole', first: 7, second: 5 }))!;
    expect(p.story).toBe('There are 7 red stickers and 5 blue stickers. How many stickers are there in all?');
    expect(p.answer).toBe(12);
    expect(p.big.label).toBe('all the stickers');
    expect(familySpoken(p)).toBe('seven plus five equals box');
    expect(familyMisplaced(p)).toBe('five plus box equals seven');
    expect(bigNumberWrongPlacement(p).label).toBe('red stickers');
  });

  it('part-whole, part unknown: 12 in all, 7 red → blue is the box, all is the big number', () => {
    const p = planWordProblem(spec({ frameId: 'part_whole:part', first: 12, second: 7 }))!;
    expect(p.story).toBe('There are 12 stickers. 7 of them are red. The rest are blue. How many stickers are blue?');
    expect(p.answer).toBe(5);
    expect(p.big.label).toBe('all the stickers');
    expect(p.unknown.label).toBe('blue stickers');
    expect(familySpoken(p)).toBe('seven plus box equals twelve');
    expect(p.answerSentence).toBe('Five stickers are blue.');
  });

  it('a second adjective pair changes the parts, never the numbers', () => {
    const p = planWordProblem(spec({ frameId: 'part_whole:whole', first: 7, second: 5, adjectivePair: 1 }))!;
    expect(p.story).toContain('green stickers');
    expect(p.answer).toBe(12);
  });
});

describe('planWordProblem — the pilot gates refuse, never repair', () => {
  it('refuses a zero, one, or negative answer and an answer above the ceiling', () => {
    expect(planWordProblem(spec({ frameId: 'comparison:difference', first: 12, second: 12 }))).toBeNull();
    expect(planWordProblem(spec({ frameId: 'comparison:difference', first: 8, second: 12 }))).toBeNull();
    // 17 − 16 = 1: "one shells are spotted" — refused, every quantity is ≥ 2.
    expect(planWordProblem(spec({ frameId: 'part_whole:part', first: 17, second: 16 }))).toBeNull();
    expect(planWordProblem(spec({ frameId: 'comparison:fewer_person', first: 10, second: 9 }))).toBeNull();
    expect(planWordProblem(spec({ frameId: 'comparison:more_person', first: 15, second: 8 }))).toBeNull();
    expect(planWordProblem(spec({ frameId: 'comparison:more_person', first: 15, second: 8 }), 100)).not.toBeNull();
  });

  it('refuses an answer that equals a printed number (12 − 6 = 6)', () => {
    expect(planWordProblem(spec({ frameId: 'comparison:difference', first: 12, second: 6 }))).toBeNull();
    expect(planWordProblem(spec({ frameId: 'part_whole:part', first: 10, second: 5 }))).toBeNull();
  });

  it('refuses printed numbers below two (a plural noun with "1") and equal printed numbers', () => {
    expect(planWordProblem(spec({ frameId: 'part_whole:whole', first: 1, second: 5 }))).toBeNull();
    expect(planWordProblem(spec({ frameId: 'part_whole:whole', first: 5, second: 5 }))).toBeNull();
  });

  it('refuses an answer whose number word is a token of the story (twenty vs twenty-two)', () => {
    // 22 − 2 = 20: "twenty-two" carries "twenty".
    expect(planWordProblem(spec({ frameId: 'comparison:difference', first: 22, second: 2 }), 100)).toBeNull();
    // 24 − 4 = 20 is refused for the same reason, and so is 24 − 3 = 21
    // ("twenty-one" shares "twenty" with "twenty-four"); 30 − 9 = 21 is not.
    expect(planWordProblem(spec({ frameId: 'comparison:difference', first: 24, second: 4 }), 100)).toBeNull();
    expect(planWordProblem(spec({ frameId: 'comparison:difference', first: 24, second: 3 }), 100)).toBeNull();
    expect(planWordProblem(spec({ frameId: 'comparison:difference', first: 30, second: 9 }), 100)).not.toBeNull();
  });

  it('refuses an unusable theme rather than repairing it', () => {
    expect(themeUsable({ ...THEME, nounPlural: 'dozen' })).toBe(false);
    expect(themeUsable({ ...THEME, nounPlural: 'pairs' })).toBe(false);
    expect(themeUsable({ ...THEME, nounPlural: 'sticker' })).toBe(false); // not plural
    expect(themeUsable({ ...THEME, nameA: 'jen' })).toBe(false);
    expect(themeUsable({ ...THEME, nameA: 'Mary Ann' })).toBe(false);
    expect(themeUsable({ ...THEME, nameB: 'Jen' })).toBe(false); // same name twice
    expect(themeUsable({ ...THEME, losePast: 'shared', loseBase: 'share' })).toBe(false);
    expect(themeUsable({ ...THEME, gainPast: 'Yes', gainBase: 'yes' })).toBe(false);
    expect(themeUsable({ ...THEME, losePast: 'gave away', loseBase: 'give away' })).toBe(true);
    expect(themeUsable(THEME)).toBe(true);
    expect(planWordProblem(spec({ frameId: 'part_whole:whole', first: 7, second: 5, theme: { ...THEME, nounPlural: 'dozen' } }))).toBeNull();
  });

  it('refuses an unknown frame', () => {
    expect(planWordProblem(spec({ frameId: 'comparison:nothing' as never, first: 7, second: 5 }))).toBeNull();
  });
});

describe('drawNumbersFor — the code-owned pool', () => {
  it('fills every frame inside the default ceiling, and every draw re-plans clean', () => {
    reseedWordProblemPool(4242);
    for (const frameId of FRAME_IDS) {
      const drawn = drawNumbersFor(frameId, THEME, 20);
      expect(drawn, frameId).not.toBeNull();
      const p = planWordProblem(spec({ frameId, first: drawn!.first, second: drawn!.second }), 20)!;
      expect(p, frameId).not.toBeNull();
      expect(p.answer).toBeGreaterThanOrEqual(2);
      expect(p.answer).toBeLessThanOrEqual(20);
      for (const x of p.quantities) expect(x.value).toBeGreaterThanOrEqual(2);
    }
  });

  it('honours the avoid set and the within-100 ceiling', () => {
    reseedWordProblemPool(99);
    const avoid = new Set<string>();
    const seen = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const d = drawNumbersFor('part_whole:whole', THEME, 100, avoid)!;
      const key = `${d.first}-${d.second}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      avoid.add(key);
      expect(d.first + d.second).toBeLessThanOrEqual(100);
    }
  });
});
