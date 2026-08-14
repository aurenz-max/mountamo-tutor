/**
 * judgedScriptContract — the standing gates as code.
 *
 * What this locks in:
 *  1. Sentinel collisions (standing gate 2): a sentence OPENING with an
 *     affirm/correct sentinel is flagged; mid-sentence mentions are not — the
 *     verdict scan only classifies sentence openers.
 *  2. Response-class gating (standing gate 1): blocked classes (letter names,
 *     open-set production) are refused with the ruling pointer; benched
 *     classes pass.
 *  3. Template-key hygiene: `{{key}}`s a pack never pushes are named — an
 *     unpushed key renders "(not set)" into the prompt and gets read aloud.
 *  4. The ONE spoken-line parser reads every anchor the family actually ships,
 *     across both eras — the gate that subtracts spoken spans is only as
 *     honest as the anchor list.
 */
import { describe, expect, it } from 'vitest';
import {
  extractTemplateKeys,
  findPerformedStageDirections,
  findRepeatedConsecutiveAsks,
  findSentinelCollisions,
  findUnresolvedTemplateKeys,
  judgedAnswerMix,
  spokenSpanOf,
  spokenSpansOf,
  validateJudgedScriptPack,
  RESPONSE_CLASSES,
  type JudgedScriptItem,
  type JudgedScriptPack,
} from './judgedScriptContract';

describe('spokenSpanOf', () => {
  // One row per anchor SHIPPED in a pack. A parser that misses an anchor
  // treats the spoken line as judge-side prose, which both weakens the
  // answer-leak asserts (they read "") and makes findPerformedStageDirections
  // scan text the tutor is supposed to say.
  it.each([
    ['runner era', 'Say exactly: "How many counters?" Then judge.', 'How many counters?'],
    ['di-bench era', 'Speak exactly:\n"Sound it out." Wait for the answer.', 'Sound it out.'],
    ['dual anchor', 'Say ONLY this, warmly, then wait: "Your turn." Nothing else.', 'Your turn.'],
    ['pronounce', 'Say ONLY this word, once, clearly: "cat" Add nothing.', 'cat'],
  ])('reads the %s anchor', (_label, cue, expected) => {
    expect(spokenSpanOf(cue)).toBe(expected);
  });

  it('reads BOTH spans of a dual-anchor cue, in order', () => {
    const cue = 'Say exactly: "My turn: cat." Then, after a beat, say ONLY this, warmly, then wait: "Your turn."';
    expect(spokenSpansOf(cue)).toEqual(['My turn: cat.', 'Your turn.']);
  });

  it('returns empty for a cue with no speak anchor, rather than guessing', () => {
    expect(spokenSpanOf('The learner tapped "b". Do not judge it.')).toBe('');
  });

  it('subtracts every anchor era before hunting performed stage directions', () => {
    // A cue may legally QUOTE the words inside its spoken line; the defect is
    // an imperative sitting outside it. Both halves are pinned here because the
    // anchor list is what separates them.
    expect(
      findPerformedStageDirections([
        { label: 'quoted', text: 'Speak exactly: "Then wait for the bus." Judge what you hear.' },
      ]),
    ).toEqual([]);
    expect(
      findPerformedStageDirections([
        { label: 'performed', text: 'Speak exactly: "Your turn." Then WAIT silently — they are thinking.' },
      ]),
    ).toEqual([{ cueLabel: 'performed', match: 'Then WAIT' }]);
  });
});

describe('findSentinelCollisions', () => {
  it('flags a sentence that opens with the affirm sentinel', () => {
    const collisions = findSentinelCollisions([
      { label: 'cue', text: 'Listen: cat. Yes, that is the word. Your turn.' },
    ]);
    expect(collisions).toHaveLength(1);
    expect(collisions[0].opener).toBe('yes');
    expect(collisions[0].cueLabel).toBe('cue');
  });

  it('flags a sentence that opens with the correction sentinel', () => {
    const collisions = findSentinelCollisions([
      { label: 'model', text: 'My turn: watch me first.' },
    ]);
    expect(collisions).toHaveLength(1);
    expect(collisions[0].opener).toBe('my turn');
  });

  it('does not flag mid-sentence mentions (only openers classify)', () => {
    expect(findSentinelCollisions([
      { label: 'contract', text: 'If the sound is right, begin with Yes. If wrong, begin with My turn.' },
    ])).toEqual([]);
  });

  it('checks the unterminated tail sentence too', () => {
    expect(findSentinelCollisions([
      { label: 'tail', text: 'Say the word. Yes' },
    ])).toHaveLength(1);
  });

  it('passes the family cue shape', () => {
    expect(findSentinelCollisions([
      { label: 'ask', text: 'Listen: one dog. Now there are three. Your turn. Three what?' },
    ])).toEqual([]);
  });

  it('is punctuation/case-insensitive the way the verdict scan is', () => {
    expect(findSentinelCollisions([
      { label: 'sneaky', text: '  YES, friend!' },
    ])).toHaveLength(1);
  });
});

describe('template keys', () => {
  it('extracts {{key}}s', () => {
    expect(extractTemplateKeys('Word: {{word}}. Sound: {{ middleSound }}.')).toEqual([
      'word',
      'middleSound',
    ]);
  });

  it('names keys the pack never pushes', () => {
    expect(
      findUnresolvedTemplateKeys('Ask about {{word}} and {{answer}}.', ['word']),
    ).toEqual(['answer']);
    expect(
      findUnresolvedTemplateKeys('Ask about {{word}}.', ['word', 'extra']),
    ).toEqual([]);
  });
});

// ── validateJudgedScriptPack ─────────────────────────────────────────────────

interface TestItem extends JudgedScriptItem {
  word: string;
}

const makePack = (
  overrides: Partial<JudgedScriptPack<TestItem>> = {},
  items?: TestItem[],
): JudgedScriptPack<TestItem> => ({
  primitiveType: 'test-pack',
  activityLine: 'test activity',
  items: items ?? [
    { id: 'a', answerKind: 'voice', responseClass: 'short_spoken_word', word: 'cat' },
    { id: 'b', answerKind: 'voice', responseClass: 'short_spoken_word', word: 'dog' },
  ],
  itemCue: (item, opts) => `[TEST_ITEM]${opts.opening ? ' Opening.' : ''} Listen: ${item.word}. Your turn. What word?`,
  moveOnCue: (item, next) => `[TEST_MOVE] Good try. ${next ? `Next: ${next.word}.` : 'That was the last one.'}`,
  completeCue: () => '[TEST_DONE] All done today.',
  contextFor: (item) => ({ word: item.word }),
  ...overrides,
});

describe('validateJudgedScriptPack', () => {
  it('passes a clean pack', () => {
    expect(validateJudgedScriptPack(makePack())).toEqual([]);
  });

  it('admits letter_name, and keeps the homophone constraint on the record', () => {
    // UNBLOCKED 2026-08-13 by user ruling (letter-spotter drive 6ada8c0a1bcf):
    // the block had pushed that primitive to an all-tap pack, and the judge is
    // never asked to classify across 26 letters — it is handed ONE target.
    //
    // What must NOT be lost with the block is the reason it existed. The
    // clusters are a per-ITEM constraint a pack author has to design around, so
    // they are pinned here: dropping them from the notes would leave the next
    // author with an unqualified green light.
    const issues = validateJudgedScriptPack(makePack({}, [
      { id: 'a', answerKind: 'voice', responseClass: 'letter_name', word: 'b' },
    ]));
    expect(issues).toEqual([]);

    const record = RESPONSE_CLASSES.letter_name;
    expect(record.status).toBe('accepted-build-ahead');
    expect(record.notes).toContain('ACCEPT THE SOUND TOO');
    expect(record.notes).toContain('b c d e g p t v z');
  });

  it('refuses open-set production (the rhyme-studio block)', () => {
    const issues = validateJudgedScriptPack(makePack({}, [
      { id: 'a', answerKind: 'voice', responseClass: 'open_set_word', word: 'rhyme' },
    ]));
    expect(issues.some((i) => i.includes('BLOCKED'))).toBe(true);
  });

  it('requires gesture items to declare the manipulation class', () => {
    const issues = validateJudgedScriptPack(makePack({}, [
      { id: 'a', answerKind: 'gesture', responseClass: 'short_spoken_word', word: 'cat' },
    ]));
    expect(issues.some((i) => i.includes("responseClass 'manipulation'"))).toBe(true);
  });

  it('flags duplicate item ids', () => {
    const issues = validateJudgedScriptPack(makePack({}, [
      { id: 'a', answerKind: 'voice', responseClass: 'short_spoken_word', word: 'cat' },
      { id: 'a', answerKind: 'voice', responseClass: 'short_spoken_word', word: 'dog' },
    ]));
    expect(issues.some((i) => i.includes('duplicate'))).toBe(true);
  });

  it('finds sentinel collisions across every cue the pack can emit', () => {
    const issues = validateJudgedScriptPack(makePack({
      moveOnCue: () => 'My turn: we will come back to that one.',
    }));
    expect(issues.some((i) => i.includes('sentinel collision') && i.includes('moveOnCue'))).toBe(true);
  });

  it('reports a cue builder that throws instead of crashing the check', () => {
    const issues = validateJudgedScriptPack(makePack({
      completeCue: () => { throw new Error('boom'); },
    }));
    expect(issues.some((i) => i.includes('cue builder threw') && i.includes('boom'))).toBe(true);
  });
});

// ── findRepeatedConsecutiveAsks ──────────────────────────────────────────────

/** Two same-action items whose plain ask is exactly `spoken`, both times. */
const invariantPack = (spoken: string) =>
  makePack(
    { itemCue: () => `[TEST_ITEM] Say exactly: "${spoken}"` },
    [
      { id: 'a', action: 'ask', answerKind: 'voice', responseClass: 'short_spoken_word', word: 'cat' },
      { id: 'b', action: 'ask', answerKind: 'voice', responseClass: 'short_spoken_word', word: 'dog' },
    ],
  );

describe('findRepeatedConsecutiveAsks', () => {
  // THE CALIBRATION, from all four spans the 2026-08-13 drives produced. DI
  // runs on invariant signals, so "repeated" alone cannot be the finding — the
  // struck defect was a long block re-recited per item, and a gate that also
  // refused "Your turn." would push packs to rotate wording and teach worse.
  it('flags rhyme-studio’s per-item rule model — the span the user ruling struck', () => {
    const issues = findRepeatedConsecutiveAsks(invariantPack(
      'Words rhyme when they end the same way. Listen: bee, tree — both end with -ee.',
    ));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('byte-identical');
  });

  it('flags letter-spotter’s full match-it frame', () => {
    expect(findRepeatedConsecutiveAsks(invariantPack(
      'Look at the big letter. Your turn. Tap the little letter that is the same letter.',
    ))).toHaveLength(1);
  });

  it('PASSES the short repeat that same drive shipped as the fix', () => {
    expect(findRepeatedConsecutiveAsks(invariantPack(
      'Your turn. Tap the little letter that is the same.',
    ))).toEqual([]);
  });

  it('PASSES a bare DI signal — decodable-reader asks it once per sentence', () => {
    // Nothing in it can vary without inventing content, and repeating the
    // signal is the method, not a defect.
    expect(findRepeatedConsecutiveAsks(invariantPack('Your turn. Read it.'))).toEqual([]);
  });

  it('never compares across a change of action, or an item with itself', () => {
    const pack = invariantPack('Words rhyme when they end the same way. Listen and tell me.');
    expect(findRepeatedConsecutiveAsks({
      ...pack,
      items: [{ ...pack.items[0], action: 'recognise' }, { ...pack.items[1], action: 'produce' }],
    })).toEqual([]);
    expect(findRepeatedConsecutiveAsks({
      ...pack,
      items: [pack.items[0], pack.items[0]],
    })).toEqual([]);
  });
});

describe('judgedAnswerMix — what the completion copy may claim', () => {
  const item = (answerKind: 'voice' | 'gesture') => ({ answerKind });

  it('calls a run of tapped items GESTURE, which is the case that shipped a lie', () => {
    // letter-sound-link, six `hear-see` items, user drive 2026-08-13: the panel
    // congratulated the child for using "your own voice" over six taps.
    expect(judgedAnswerMix([item('gesture'), item('gesture'), item('gesture')])).toBe('gesture');
  });

  it('calls an all-spoken run VOICE and any blend MIXED', () => {
    expect(judgedAnswerMix([item('voice'), item('voice')])).toBe('voice');
    expect(judgedAnswerMix([item('voice'), item('gesture')])).toBe('mixed');
    expect(judgedAnswerMix([item('gesture'), item('voice')])).toBe('mixed');
  });

  it('treats an empty run as the family default rather than throwing', () => {
    expect(judgedAnswerMix([])).toBe('voice');
  });
});
