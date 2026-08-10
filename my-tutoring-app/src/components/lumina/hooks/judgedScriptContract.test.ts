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
 */
import { describe, expect, it } from 'vitest';
import {
  extractTemplateKeys,
  findSentinelCollisions,
  findUnresolvedTemplateKeys,
  validateJudgedScriptPack,
  type JudgedScriptItem,
  type JudgedScriptPack,
} from './judgedScriptContract';

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

  it('refuses a BLOCKED response class, naming the ruling', () => {
    const issues = validateJudgedScriptPack(makePack({}, [
      { id: 'a', answerKind: 'voice', responseClass: 'letter_name', word: 'b' },
    ]));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('BLOCKED');
    expect(issues[0]).toContain('homophonic');
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
