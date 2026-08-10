/**
 * soundSwapScript — the DI cue script for sound-swap (second literacy port,
 * qa/di/BACKLOG.md item 16).
 *
 * These are PURE tests against the exact wording the tutor speaks. That is
 * deliberate: in this family the wording IS the pedagogy (DISTAR), the script
 * has no dependencies, and a render test could only observe it second-hand
 * through an async live session — which the pilot proved cannot be done
 * honestly in jsdom (the mic never opens, the context refs never re-render).
 * So the judging contract's branches are asserted here, where they are real.
 *
 * Re-based 2026-08-09 after the first live run. The shipped ask walked the
 * starting word sound by sound ("Listen: an. /æ/ … /n/. Add /p/…") and the
 * tutor's voice could not say the glyphs. User ruling: delete the walk rather
 * than make it sayable — *"the 'an… Add /p/' works great and the student can
 * clearly hear the instructions, but the gibberish comes across as a
 * distraction."* The three-beat ask is now a pinned contract, and the phonemes
 * that CANNOT be removed (the ask's own target sound) go through `phonemeVoice`.
 */
import { describe, it, expect } from 'vitest';
import {
  completeCue,
  HOW_TO_PLAY,
  itemCue,
  judgingContract,
  moveAsk,
  moveModel,
  moveOnCue,
  type SwapItem,
} from '../soundSwapScript';

/** deletion: cat − /k/ → at */
const DEL: SwapItem = {
  id: 'c1',
  operation: 'deletion',
  originalWord: 'cat',
  originalPhonemes: ['/k/', '/a/', '/t/'],
  resultWord: 'at',
  deletePhoneme: '/k/',
};
/** addition: at + /k/ → cat */
const ADD: SwapItem = {
  id: 'c2',
  operation: 'addition',
  originalWord: 'at',
  originalPhonemes: ['/a/', '/t/'],
  resultWord: 'cat',
  addPhoneme: '/k/',
  addPosition: 'beginning',
};
/** substitution: cat with /b/ for /k/ → bat */
const SUB: SwapItem = {
  id: 'c3',
  operation: 'substitution',
  originalWord: 'cat',
  originalPhonemes: ['/k/', '/a/', '/t/'],
  resultWord: 'bat',
  oldPhoneme: '/k/',
  newPhoneme: '/b/',
};
/** A MEDIAL VOWEL swap — the hard structural position, and the one item shape
 *  whose ask cannot avoid an IPA vowel glyph. bit → bat. */
const VOWEL: SwapItem = {
  id: 'c4',
  operation: 'substitution',
  originalWord: 'bit',
  originalPhonemes: ['/b/', '/ɪ/', '/t/'],
  resultWord: 'bat',
  oldPhoneme: '/ɪ/',
  newPhoneme: '/æ/',
};

/** The line the tutor is told to SPEAK — the quote right after "Speak
 *  exactly:". Everything else a cue contains is instruction ABOUT speech,
 *  including the contract's own "Yes" / "My turn" anti-collision quotes, which
 *  are the rule and not an utterance. */
const spokenLine = (cue: string) =>
  (cue.match(/Speak exactly:\s*\n?"([^"]*)"/) ?? [])[1] ?? '';

describe('sound-swap script · the ask names the move (all three operations)', () => {
  it('deletion names the sound to take away', () => {
    expect(moveAsk(DEL)).toBe('Take away /k/.');
    expect(spokenLine(itemCue(DEL))).toBe('Listen: cat. Take away /k/. Your turn. What word?');
  });

  it('addition names the sound AND where it goes', () => {
    expect(moveAsk(ADD)).toBe('Add /k/ at the beginning.');
    expect(spokenLine(itemCue(ADD))).toBe('Listen: at. Add /k/ at the beginning. Your turn. What word?');
  });

  it('substitution names both the old sound and the new one', () => {
    expect(moveAsk(SUB)).toBe('Change /k/ to /b/.');
    expect(spokenLine(itemCue(SUB))).toBe('Listen: cat. Change /k/ to /b/. Your turn. What word?');
  });

  it('the ask NEVER contains the answer — the new word is what the child produces', () => {
    // Word-boundary matched on purpose: "cat" legitimately CONTAINS the
    // deletion answer "at", and a substring assertion would either fail on a
    // correct script or have to be weakened until it proved nothing.
    for (const item of [DEL, ADD, SUB, VOWEL]) {
      const line = spokenLine(itemCue(item));
      expect(line).not.toMatch(new RegExp(`\\b${item.resultWord}\\b`));
    }
  });
});

describe('sound-swap script · THREE BEATS, at every tier (the live-run ruling)', () => {
  it('there is no sound-by-sound walk between the word and the move', () => {
    for (const item of [DEL, ADD, SUB, VOWEL]) {
      expect(spokenLine(itemCue(item))).not.toContain('…');
    }
  });

  it('the ask is exactly: starting word · the move · Your turn · What word?', () => {
    for (const item of [DEL, ADD, SUB]) {
      const beats = spokenLine(itemCue(item)).split('.').map(b => b.trim()).filter(Boolean);
      expect(beats).toHaveLength(4);
      expect(beats[0]).toBe(`Listen: ${item.originalWord}`);
      expect(`${beats[1]}.`).toBe(moveAsk(item));
      expect(beats[2]).toBe('Your turn');
      expect(beats[3]).toBe('What word?');
    }
  });

  it('the NEXT challenge gets the same three beats — no tier, no walk, no variant', () => {
    const line = spokenLine(moveOnCue(DEL, SUB));
    expect(line).toContain('Listen: cat. Change /k/ to /b/. Your turn. What word?');
    expect(line).not.toContain('…');
  });

  it('the ask carries no tier parameter at all — one spoken line for every child', () => {
    // itemCue's only option is `opening`. If a tier ever re-enters the SPOKEN
    // channel it has to come through here, and this assertion is what notices.
    expect(itemCue(DEL)).toBe(itemCue(DEL, {}));
    expect(spokenLine(itemCue(DEL, { opening: true }))).toBe(spokenLine(itemCue(DEL)));
  });
});

describe('sound-swap script · the OPENING line says how to play (residual SWAP-1)', () => {
  // THIS IS THE PRIMITIVE THE RESIDUAL WAS FOUND ON, live 2026-08-09. The
  // how-to-play was a CATALOG DIRECTIVE — "before the scripted line, tell them
  // HOW TO PLAY in kid words" — so the opening turn had two jobs. Verbatim from
  // the run: greeting → how-to-play → the literal string "[DI_SWAP_ITEM]" →
  // *"Now, let's try one. Start with 'at'. Add /k/ to the beginning. What
  // word?"* — not the scripted line — reaching "Listen: at." only after a
  // barge-in. Item 1 ran without its model. The anti-echo warning was already
  // in the opening cue and did not hold, because the fault was the two-job
  // turn, not the warning.
  it('how-to-play is INSIDE the quote, not a directive to compose one', () => {
    const line = spokenLine(itemCue(ADD, { opening: true, howToPlay: true }));
    expect(line.startsWith(HOW_TO_PLAY)).toBe(true);
    expect(line.endsWith('Listen: at. Add /k/ at the beginning. Your turn. What word?')).toBe(true);
  });

  it('the opener tells the tutor to add nothing of its own', () => {
    const cue = itemCue(ADD, { opening: true, howToPlay: true });
    expect(cue).toContain('it already contains how to play, so do not add your own');
    expect(cue).toContain('Never say, reproduce, or invent text inside square brackets');
  });

  it('how-to-play is band-gated, and never reaches a later cue', () => {
    // Reader grades have the same protocol printed under the tiles, so they do
    // not get it spoken. Either way it exists only on the OPENING cue.
    expect(spokenLine(itemCue(ADD, { opening: true }))).toBe(spokenLine(itemCue(ADD)));
    expect(spokenLine(itemCue(ADD, { howToPlay: true }))).toBe(spokenLine(itemCue(ADD)));
  });

  it('the how-to-play never names an answer', () => {
    for (const item of [DEL, ADD, SUB, VOWEL]) {
      const line = spokenLine(itemCue(item, { opening: true, howToPlay: true }));
      expect(line).not.toMatch(new RegExp(`\\b${item.resultWord}\\b`));
    }
  });

  it('and it still does not open with a sentinel (standing gate 2)', () => {
    const lower = spokenLine(itemCue(ADD, { opening: true, howToPlay: true })).toLowerCase();
    expect(lower.startsWith('yes')).toBe(false);
    expect(lower.startsWith('my turn')).toBe(false);
  });
});

describe('sound-swap script · phonemes the ask cannot drop are made sayable', () => {
  it('a medial-vowel swap speaks the SOUNDS, never the IPA glyphs', () => {
    // "Change /ɪ/ to /æ/" is the whole instruction — the glyph cannot be
    // deleted the way the walk was, so it is rendered in di-letter-sounds'
    // own spellings instead.
    expect(moveAsk(VOWEL)).toBe('Change iii to aaa.');
    const line = spokenLine(itemCue(VOWEL));
    expect(line).toBe('Listen: bit. Change iii to aaa. Your turn. What word?');
    expect(line).not.toContain('ɪ');
    expect(line).not.toContain('æ');
  });

  it('the CORRECTION is rendered for the voice too', () => {
    expect(moveModel(VOWEL)).toBe('bit with aaa instead of iii — bat.');
    expect(judgingContract(VOWEL)).not.toContain('ɪ');
  });

  it('Latin-letter phonemes are left EXACTLY as authored — those already read well', () => {
    // The user confirmed "Add /p/" reads correctly. Rewriting it would mean
    // guessing which sound an ambiguous letter meant.
    expect(moveAsk(ADD)).toContain('/k/');
    expect(moveAsk(SUB)).toBe('Change /k/ to /b/.');
  });
});

describe('sound-swap script · the judging contract (what counts as the answer)', () => {
  it('the new word is correct whether it arrives whole or is sounded out first', () => {
    const contract = judgingContract(DEL);
    expect(contract).toContain('sounded it out and then said it fast');
    expect(contract).toContain('Sounding it out first is correct, not a fault.');
  });

  it('SAYING THE STARTING WORD BACK is named as wrong — the signature error of this skill', () => {
    // It is fluent, confident, and completely unchanged. Every operation's
    // contract has to name it or the tutor will hear a word and affirm it.
    for (const item of [DEL, ADD, SUB]) {
      const contract = judgingContract(item);
      expect(contract).toContain(`saying "${item.originalWord}" back unchanged`);
      expect(contract).toContain('Saying the starting word back is not the answer');
    }
  });

  it('a near neighbour is wrong, judged on the FINAL word', () => {
    expect(judgingContract(SUB)).toContain('even one that sounds close to bat');
    expect(judgingContract(SUB)).toContain('Judge strictly on the FINAL word');
  });

  it('separate sounds with no word at the end is not the answer', () => {
    expect(judgingContract(ADD)).toContain('only separate sounds with no word at the end');
  });

  it('both branches carry their exact sentinel opener, per operation', () => {
    expect(judgingContract(DEL)).toContain('say exactly "Yes, at." and stop');
    expect(judgingContract(DEL)).toContain('say exactly "My turn: cat without /k/ — at. Your turn. What word?"');
    expect(judgingContract(ADD)).toContain('say exactly "My turn: at with /k/ at the beginning — cat. Your turn. What word?"');
    expect(judgingContract(SUB)).toContain('say exactly "My turn: cat with /b/ instead of /k/ — bat. Your turn. What word?"');
  });

  it('the correction always carries the change THROUGH to the new word (gate 3)', () => {
    for (const item of [DEL, ADD, SUB, VOWEL]) {
      expect(moveModel(item).endsWith(`— ${item.resultWord}.`)).toBe(true);
      expect(itemCue(item)).toContain(`My turn: ${moveModel(item)}`);
    }
  });
});

describe('sound-swap script · DI sentinel discipline (standing gate 2)', () => {
  const everyCue = [
    itemCue(ADD, { opening: true }),
    itemCue(DEL),
    itemCue(SUB),
    itemCue(VOWEL),
    moveOnCue(DEL, SUB),
    moveOnCue(DEL, null),
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

  it("the model line opens with 'Listen' — classic DISTAR's 'My turn.' opener is forbidden here", () => {
    for (const item of [DEL, ADD, SUB, VOWEL]) {
      expect(spokenLine(itemCue(item)).startsWith('Listen')).toBe(true);
    }
  });

  it('every item cue carries the judging contract, so no attempt can land unjudged', () => {
    for (const cue of [itemCue(DEL), itemCue(SUB), moveOnCue(DEL, ADD)]) {
      expect(cue).toContain('Then wait for the learner to speak.');
      expect(cue).toContain('Never begin any other sentence with the word "Yes"');
    }
  });

  it('the final move-on has no next challenge and therefore no contract to wait on', () => {
    const cue = moveOnCue(DEL, null);
    expect(cue).toContain("That's the end of our sound-changing practice.");
    expect(cue).not.toContain('Then wait for the learner to speak.');
  });

  it('the opening cue tells the tutor the bracket labels are private metadata', () => {
    // The first live run had the model emit the literal "[DI_SWAP_ITEM]" into
    // its own speech and then improvise an ask. This is the line that forbids
    // it — pinned so nobody trims it as boilerplate.
    expect(itemCue(DEL, { opening: true }))
      .toContain('Never say, reproduce, or invent text inside square brackets');
    // …and only on the opener, so every later cue stays short.
    expect(itemCue(DEL)).not.toContain('private application metadata');
  });
});
