/**
 * wordFlipScript — the DI cue script for word-flip (third literacy port,
 * qa/di/BACKLOG.md item 16).
 *
 * These are PURE tests against the exact wording the tutor speaks. That is
 * deliberate: in this family the wording IS the pedagogy (DISTAR), the script
 * has no dependencies, and a render test could only observe it second-hand
 * through an async live session — which the pilot proved cannot be done
 * honestly in jsdom (the mic never opens, the context refs never re-render).
 * So the judging contract's branches are asserted here, where they are real.
 *
 * TWO THINGS ARE NEW AT THIS PORT and both are pinned below:
 *  1. The opening line carries the greeting + how-to-play INSIDE its quoted
 *     text (residual SWAP-1 — ports 1 and 2 asked the tutor to compose one,
 *     and live it improvised its own ask instead of speaking the scripted one).
 *  2. The hand-over is "{Count} what?", not the family's "What word?". After
 *     "Now there are three", "What word?" is answered honestly by "dog" — the
 *     child names the picture and is technically right. An ambiguous ask is not
 *     a harder task, it is a broken one.
 */
import { describe, it, expect } from 'vitest';
import {
  askLine,
  completeCue,
  countWord,
  countWordCapitalized,
  itemCue,
  judgingContract,
  moveOnCue,
  pairModel,
  pickModelNoun,
  pronounceCue,
  ruleModel,
  type FlipItem,
} from '../wordFlipScript';

const DOG: FlipItem = { id: 'wf1', singular: 'dog', plural: 'dogs', count: 3 };
const CAT: FlipItem = { id: 'wf2', singular: 'cat', plural: 'cats', count: 2 };
/** A five-count item — the other end of the generator's 2-5 range. */
const STAR: FlipItem = { id: 'wf3', singular: 'star', plural: 'stars', count: 5 };

/** The line the tutor is told to SPEAK — the quote right after "Speak
 *  exactly:". Everything else a cue contains is instruction ABOUT speech,
 *  including the contract's own "Yes" / "My turn" anti-collision quotes, which
 *  are the rule and not an utterance. */
const spokenLine = (cue: string) =>
  (cue.match(/Speak exactly:\s*\n?"([^"]*)"/) ?? [])[1] ?? '';

describe('word-flip script · the ask (three beats, answer nowhere in it)', () => {
  it('names the one thing, then how many there are now, then hands over', () => {
    expect(askLine(DOG)).toBe('Listen: one dog. Now there are three. Your turn. Three what?');
    expect(spokenLine(itemCue(DOG))).toBe(askLine(DOG));
  });

  it('the count word is spoken, not the digit, across the generator’s whole 2-5 range', () => {
    expect(countWord(2)).toBe('two');
    expect(countWord(5)).toBe('five');
    expect(countWordCapitalized(5)).toBe('Five');
    expect(askLine(STAR)).toBe('Listen: one star. Now there are five. Your turn. Five what?');
  });

  it('the ask NEVER contains the answer — the plural is what the child produces', () => {
    // Word-boundary matched on purpose: the ask legitimately CONTAINS the
    // singular "dog", which is a prefix of the answer "dogs", and a substring
    // assertion would either fail on a correct script or be weakened until it
    // proved nothing.
    for (const item of [DOG, CAT, STAR]) {
      expect(spokenLine(itemCue(item))).not.toMatch(new RegExp(`\\b${item.plural}\\b`));
    }
  });

  it('the SINGULAR is spoken on purpose — it is the stimulus, and the catalog law says so', () => {
    for (const item of [DOG, CAT, STAR]) {
      expect(spokenLine(itemCue(item))).toContain(`one ${item.singular}`);
    }
  });

  it('the ask is exactly: the one thing · how many now · Your turn · {Count} what?', () => {
    for (const item of [DOG, CAT, STAR]) {
      const beats = spokenLine(itemCue(item)).split('.').map(b => b.trim()).filter(Boolean);
      expect(beats).toHaveLength(4);
      expect(beats[0]).toBe(`Listen: one ${item.singular}`);
      expect(beats[1]).toBe(`Now there are ${countWord(item.count)}`);
      expect(beats[2]).toBe('Your turn');
      expect(beats[3]).toBe(`${countWordCapitalized(item.count)} what?`);
    }
  });

  it('the hand-over is "{Count} what?" — "What word?" would be answerable with the singular', () => {
    for (const item of [DOG, CAT, STAR]) {
      const line = spokenLine(itemCue(item));
      expect(line.endsWith(`${countWordCapitalized(item.count)} what?`)).toBe(true);
      expect(line).not.toContain('What word?');
    }
  });
});

describe('word-flip script · the OPENING line does its own teaching (residual SWAP-1)', () => {
  const opener = itemCue(DOG, { opening: true, modelNoun: 'hat' });

  it('the greeting + how-to-play are INSIDE the quote, not a directive to compose one', () => {
    const line = spokenLine(opener);
    expect(line).toContain(ruleModel('hat'));
    expect(line.startsWith('One hat, two hats —')).toBe(true);
    // …and the item's own ask still closes it, so the first item is never asked
    // in the tutor's own words. This is the exact failure the residual names.
    expect(line.endsWith(askLine(DOG))).toBe(true);
  });

  it('the opener tells the tutor to add nothing of its own', () => {
    expect(opener).toContain('it already contains the greeting and how to play, so do not add your own');
    expect(opener).toContain('Never say, reproduce, or invent text inside square brackets');
    // …and only on the opener, so every later cue stays short.
    expect(itemCue(DOG)).not.toContain('private application metadata');
  });

  it('the model noun is NOT the answer — the rule is taught on a word this session never asks', () => {
    const line = spokenLine(opener);
    expect(line).not.toMatch(/\bdogs\b/);
    expect(pickModelNoun([DOG, CAT, STAR])).toBe('hat');
  });

  it('pickModelNoun steps over a session that HAS the default model noun', () => {
    const hat: FlipItem = { id: 'wf9', singular: 'hat', plural: 'hats', count: 2 };
    expect(pickModelNoun([hat])).not.toBe('hat');
    // A full session is 5 items against 8 model nouns, so one is always free.
    const cup: FlipItem = { id: 'wf8', singular: 'cup', plural: 'cups', count: 2 };
    const bug: FlipItem = { id: 'wf7', singular: 'bug', plural: 'bugs', count: 2 };
    const pen: FlipItem = { id: 'wf6', singular: 'pen', plural: 'pens', count: 2 };
    const mug: FlipItem = { id: 'wf5', singular: 'mug', plural: 'mugs', count: 2 };
    const picked = pickModelNoun([hat, cup, bug, pen, mug]);
    expect(['hat', 'cup', 'bug', 'pen', 'mug']).not.toContain(picked);
  });

  it('a non-opening cue carries no how-to-play at all', () => {
    expect(spokenLine(itemCue(DOG))).toBe(askLine(DOG));
    // Guard the option shape too: an opener without a model noun degrades to
    // the bare ask rather than emitting a half-built sentence.
    expect(spokenLine(itemCue(DOG, { opening: true }))).toBe(askLine(DOG));
  });
});

describe('word-flip script · the judging contract (what counts as the answer)', () => {
  it('the plural is correct alone OR inside the phrase a child actually says', () => {
    const contract = judgingContract(DOG);
    expect(contract).toContain('on its own, or inside a short phrase like "three dogs"');
    expect(contract).toContain('say exactly "Yes, dogs." and stop');
  });

  it('SAYING THE ONE-THING WORD BACK is named as wrong — the signature error of this skill', () => {
    // It is fluent, confident, and completely unchanged. Every item's contract
    // has to name it or the tutor will hear a real word and affirm it.
    for (const item of [DOG, CAT, STAR]) {
      const contract = judgingContract(item);
      expect(contract).toContain(`saying "${item.singular}" back with no ending added`);
      expect(contract).toContain('Saying the one-thing word back is not the answer');
    }
  });

  it('the OVER-REGULARIZED form is named as wrong too, per word', () => {
    expect(judgingContract(DOG)).toContain('adding too much ending like "dogses"');
    expect(judgingContract(CAT)).toContain('adding too much ending like "catses"');
    expect(judgingContract(STAR)).toContain('An extra syllable on the end is not the answer either.');
  });

  it('the NUMBER alone is not an answer', () => {
    expect(judgingContract(DOG)).toContain('saying only the number');
  });

  it('the correction always carries the pair THROUGH to the answer (gate 3)', () => {
    for (const item of [DOG, CAT, STAR]) {
      expect(pairModel(item)).toBe(`one ${item.singular}, ${countWord(item.count)} ${item.plural}.`);
      expect(judgingContract(item)).toContain(`My turn: ${pairModel(item)}`);
      // …and re-elicits, rather than ending on the answer.
      expect(judgingContract(item))
        .toContain(`${pairModel(item)} Your turn. ${countWordCapitalized(item.count)} what?`);
    }
  });
});

describe('word-flip script · DI sentinel discipline (standing gate 2)', () => {
  const everyCue = [
    itemCue(DOG, { opening: true, modelNoun: 'hat' }),
    itemCue(CAT),
    itemCue(STAR),
    moveOnCue(DOG, CAT),
    moveOnCue(DOG, null),
    completeCue(),
  ];

  it('no spoken line opens with a sentinel — only the in-band verdict branches may', () => {
    const lines = everyCue.map(spokenLine);
    expect(lines.every(l => l.length > 0)).toBe(true);   // extraction really found them
    for (const line of lines) {
      const lower = line.trimStart().toLowerCase();
      expect(lower.startsWith('yes')).toBe(false);
      expect(lower.startsWith('my turn')).toBe(false);
    }
  });

  it("the ask opens with 'Listen' — classic DISTAR's 'My turn.' opener is forbidden here", () => {
    for (const item of [DOG, CAT, STAR]) {
      expect(askLine(item).startsWith('Listen')).toBe(true);
    }
  });

  it('every item cue carries the judging contract, so no attempt can land unjudged', () => {
    for (const cue of [itemCue(DOG), itemCue(STAR), moveOnCue(DOG, CAT)]) {
      expect(cue).toContain('Then wait for the learner to speak.');
      expect(cue).toContain('Never begin any other sentence with the word "Yes"');
    }
  });

  it('the final move-on has no next item and therefore no contract to wait on', () => {
    const cue = moveOnCue(DOG, null);
    expect(cue).toContain("That's the end of our word game.");
    expect(cue).not.toContain('Then wait for the learner to speak.');
  });

  it('the move-on hands the NEXT item its full ask, with no answer in it', () => {
    const line = spokenLine(moveOnCue(DOG, CAT));
    expect(line).toContain(askLine(CAT));
    expect(line).not.toMatch(/\bcats\b/);
  });
});

describe('word-flip script · tap-to-hear never leaks the answer', () => {
  it('speaks the ONE-THING word and forbids the ending', () => {
    const cue = pronounceCue('dog');
    expect(cue.startsWith('[SAY_WORD]')).toBe(true);
    expect(cue).toContain('"dog"');
    expect(cue).not.toMatch(/\bdogs\b/);
    expect(cue).toContain('Do NOT add the ending that means more than one');
  });

  it('is never routed through the judge', () => {
    expect(pronounceCue('cat')).toContain('do not treat this as an attempt to judge');
  });
});
