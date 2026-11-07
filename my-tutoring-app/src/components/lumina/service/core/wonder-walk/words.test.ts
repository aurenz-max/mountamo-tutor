/**
 * The Wonder Walk language world, against the agent-primitive invariants: one hand-built world per K language
 * standard passes every check, builds, validates and is solved by the harness's taps (I2, the coverage table); code
 * derives the key and names the mode (I4, I9); shortcuts are blocked (I5); difficulty comes from the structure (I6);
 * variety and tier hold (I7).
 */
import { describe, expect, it } from 'vitest';
import { buildStops, stopChecks, walkChecks, type StopDraft, type WordScope } from './checks';
import { WORD_MODES, fillSounds, readWords, wordDifficulty, wordModeOf, type RuleDraft, type ThingDraft, type WordDraft } from './words';
import { validateWonderWalkData } from '../../../primitives/visual-primitives/core/wonder-walk/wonderWalk.boss';
import { stopHarnessTaps, stopMatches, wordMatches, workspaceScene } from '../../../primitives/visual-primitives/core/wonder-walk/wonderWalkWorkspace';
import type { WonderWalkStop } from '../../../primitives/visual-primitives/core/wonder-walk/WonderWalk';

const ALL: WordScope = { openModes: WORD_MODES };
const p = (id: string, word: string, extra: Partial<ThingDraft> = {}): ThingDraft => ({ id, word, ...extra });
const L = (id: string, letter: string): ThingDraft => ({ id, letter });
const tap = (refs: ThingDraft[], things: ThingDraft[], rule: RuleDraft, story?: WordDraft['story']): WordDraft => ({ refs, things, ...(story ? { story } : {}), answer: { kind: 'tap', rule } });
const stop = (words: WordDraft, ask: string, narration = 'Listen carefully with me.', why = 'Say each word slowly and listen.'): StopDraft =>
  ({ kind: wordModeOf(readWords(words).world), ideaIndex: 0, sceneWords: [], imagePrompt: '', correctWord: '', wrongWords: [], narration, ask, why, words });
const blocking = (d: StopDraft, scope = ALL) => stopChecks(d, 1, undefined, scope).blocking.join(' | ');

const STORY = [{ who: 'fox', did: 'go to', where: 'house' }, { who: 'fox', did: 'eat', what: 'apple' }, { who: 'fox', did: 'sleep in', where: 'bed' }];
const TOLD = 'A fox went to a house. Then he ate an apple. Then he slept in a bed.';

/** One world per standard. Each must pass, build, validate, and be solved by the harness's taps. */
const COVERAGE: Array<{ standard: string; mode: string; draft: StopDraft }> = [
  { standard: 'RF.K.2a rhyme: tap the one that rhymes', mode: 'rhyme',
    draft: stop(tap([p('r', 'cat')], [p('a', 'hat'), p('b', 'dog'), p('c', 'sun')], { type: 'rhymes', ref: 'r' }), 'Which one rhymes with cat?', 'Here is a cat. Rhyming words sound the same at the end.', 'Rhyming words end the same way. Say them with cat.') },
  { standard: 'RF.K.2a rhyme: sort by rhyme', mode: 'rhyme',
    draft: stop({ refs: [p('r1', 'cat'), p('r2', 'sun')], things: [p('a', 'hat'), p('b', 'rat'), p('c', 'bun')],
      answer: { kind: 'sort', baskets: [{ id: 'k1', label: 'r1', rule: { type: 'rhymes', ref: 'r1' } }, { id: 'k2', label: 'r2', rule: { type: 'rhymes', ref: 'r2' } }] } },
      'Can you put each picture with the word it rhymes with?', 'Here is a cat and here is the sun.', 'Say the word with cat, then with sun. Which sounds the same at the end?') },
  { standard: 'RF.K.2b count syllables', mode: 'syllables',
    draft: stop(tap([], [p('a', 'bunny'), p('b', 'dog'), p('c', 'butterfly')], { type: 'syllables', n: 2 }), 'Which word has two claps?', 'Let us clap the parts of words.', 'Clap each word. Count the claps.') },
  { standard: 'RF.K.2b-d blend onset and rime', mode: 'blend',
    draft: stop(tap([], [p('a', 'cat'), p('b', 'cap'), p('c', 'sun')], { type: 'blend', word: 'cat', parts: 'onset-rime' }), 'Listen, [sounds], which picture is it?', 'I will say a word in parts.', 'Put the parts together fast.') },
  { standard: 'RF.K.2d blend every sound', mode: 'blend',
    draft: stop(tap([], [p('a', 'pig'), p('b', 'pen'), p('c', 'map')], { type: 'blend', word: 'pig', parts: 'phonemes' }), 'Listen, [sounds], what word is it?', 'I will say each sound.', 'Say the sounds faster and faster.') },
  { standard: 'RF.K.2d first sound', mode: 'first-sound',
    draft: stop(tap([], [p('a', 'sock'), p('b', 'map'), p('c', 'dog')], { type: 'sound', at: 'first', sound: 's' }), 'Which one starts with [sound]?', 'Listen to the start of each word.', 'Say each word. Listen to the very first sound.') },
  { standard: 'RF.K.2d first sound: sort by a heard word', mode: 'first-sound',
    draft: stop({ refs: [p('r1', 'sun'), p('r2', 'moon')], things: [p('a', 'sock'), p('b', 'seal'), p('c', 'mop'), p('d', 'map')],
      answer: { kind: 'sort', baskets: [{ id: 'k1', label: 'r1', rule: { type: 'same-sound', at: 'first', ref: 'r1' } }, { id: 'k2', label: 'r2', rule: { type: 'same-sound', at: 'first', ref: 'r2' } }] } },
      'Can you put each one with sun or moon?', 'Here are the sun and the moon. Listen to how they start.', 'Say the word, then sun, then moon. Which starts the same?') },
  { standard: 'RF.K.2d last sound', mode: 'last-sound',
    draft: stop(tap([], [p('a', 'hat'), p('b', 'bus'), p('c', 'pig')], { type: 'sound', at: 'last', sound: 't' }), 'Which one ends with [sound]?', 'Listen to the end of each word.', 'Say each word slowly. Listen to the very last sound.') },
  { standard: 'RF.K.2d middle sound', mode: 'middle-sound',
    draft: stop(tap([], [p('a', 'pig'), p('b', 'cat'), p('c', 'sun')], { type: 'sound', at: 'middle', sound: 'i' }), 'Which one has [sound] in the middle?', 'Listen to the middle of each word.', 'Stretch each word. Listen to the middle.') },
  { standard: 'RF.K.2e change a sound', mode: 'change-sound',
    draft: stop(tap([p('r', 'cat')], [p('a', 'hat'), p('b', 'bat'), p('c', 'sun')], { type: 'change', ref: 'r', at: 'first', to: 'h' }), 'Say cat, change [from] to [to], which picture is it now?', 'Here is a cat. We can change a sound.', 'Say the new start, then the rest of the word.') },
  { standard: 'RF.K.1d name a capital letter', mode: 'letter-name',
    draft: stop(tap([], [L('a', 'M'), L('b', 'N'), L('c', 'W')], { type: 'letter-name', letter: 'M' }), 'Which one is the letter M?', 'Letters have names. Let us find one.', 'Look at the shape. M has two tall hills.') },
  { standard: 'RF.K.1d match capital and small letters', mode: 'letter-name',
    draft: stop(tap([L('r', 'B')], [L('a', 'b'), L('b', 'd'), L('c', 'p')], { type: 'same-letter', ref: 'r' }), 'Which small letter goes with this big letter?', 'Here is a big letter.', 'Look where the bump is. Small b has its bump on the right.') },
  { standard: 'RF.K.3a letter for a sound', mode: 'letter-sound',
    draft: stop(tap([], [L('a', 'm'), L('b', 's'), L('c', 't')], { type: 'letter-sound', sound: 'm' }), 'Which letter says [sound]?', 'Each letter makes a sound.', 'Say the sound of each letter.') },
  { standard: 'RF.K.3a first letter of a picture', mode: 'letter-sound',
    draft: stop(tap([p('r', 'sun')], [L('a', 's'), L('b', 'm'), L('c', 't')], { type: 'first-letter', ref: 'r' }), 'Which letter does sun start with?', 'Here is the sun.', 'Say the word and listen to the first sound. Find its letter.') },
  { standard: 'L.K.2d spell a CVC word', mode: 'spell-word',
    draft: stop({ refs: [p('r', 'cat')], things: [L('a', 'c'), L('b', 'a'), L('c', 't'), L('d', 'm')], answer: { kind: 'order', by: 'spelling', of: 'r' } },
      'Can you spell cat with the letters?', 'Here is a cat. Let us spell it.', 'Say the word slowly. Find a letter for each sound.') },
  { standard: 'L.K.5a sort by kind', mode: 'word-kinds',
    draft: stop({ refs: [p('r1', 'apple'), p('r2', 'dog')], things: [p('a', 'banana'), p('b', 'frog'), p('c', 'pear'), p('d', 'pig')],
      answer: { kind: 'sort', baskets: [{ id: 'k1', label: 'r1', rule: { type: 'kind', kind: 'food' } }, { id: 'k2', label: 'r2', rule: { type: 'kind', kind: 'animal' } }] } },
      'Can you put food with the apple, animals with the dog?', 'Some things are food. Some are animals.', 'Ask: can I eat it? Or is it alive?') },
  { standard: 'L.K.1b doing-words and things', mode: 'word-kinds',
    draft: stop(tap([], [p('a', 'run'), p('b', 'ball'), p('c', 'box')], { type: 'kind', kind: 'action' }), 'Which one is something you do?', 'Some words are things. Some words are things we do.', 'Can you do it with your body? That is a doing word.') },
  { standard: 'L.K.1c one and many', mode: 'one-many',
    draft: stop(tap([], [p('a', 'cat', { count: 3 }), p('b', 'cat'), p('c', 'dog', { count: 3 })], { type: 'number', number: 'many', word: 'cat' }), 'Where are the cats?', 'Listen for the end of the word.', 'Cats with an s at the end means more than one.') },
  { standard: 'L.K.1e in, on, under, next to', mode: 'where-is',
    draft: stop(tap([], [p('a', 'cat', { rel: 'under', landmark: 'box' }), p('b', 'cat', { rel: 'in', landmark: 'box' }), p('c', 'cat', { rel: 'on', landmark: 'box' })], { type: 'where', rel: 'under' }),
      'Which picture shows the cat under the box?', 'The cat likes to play with the box.', 'Under means below it.') },
  { standard: 'RL.K.1 / SL.K.2 key detail', mode: 'story-detail',
    draft: stop(tap([p('r', 'fox')], [p('a', 'apple'), p('b', 'pear'), p('c', 'bed')], { type: 'story', event: 1, role: 'what' }, STORY), 'What did the fox eat?', TOLD, 'Think back to the story. What did he have to eat?') },
  { standard: 'RL.K.2 story order', mode: 'story-order',
    draft: stop({ refs: [p('r', 'fox')], things: [p('a', 'house'), p('b', 'apple'), p('c', 'bed')], story: STORY, answer: { kind: 'order', by: 'story' } },
      'Can you put the pictures in story order?', TOLD, 'Tell the story again. What came first?') },
];

/** Play a stop with its harness taps through the activity's own grading. */
function solves(s: WonderWalkStop, right: boolean): boolean {
  const taps = stopHarnessTaps(s);
  const seq = right ? taps.correct : taps.wrong!;
  const w = s.words!;
  if (w.answer.kind === 'tap') return stopMatches(s, seq[0]);
  const basketOf: Record<string, string> = {};
  const track: string[] = [];
  let held: string | null = null;
  for (const t of seq) {
    if (t === 'done') break;
    if (t.startsWith('thing-')) { if (w.answer.kind === 'order') track.push(t.slice(6)); else held = t.slice(6); }
    if (t.startsWith('basket-') && held) { basketOf[held] = t.slice(7); held = null; }
  }
  return wordMatches(s, { basketOf, track });
}

describe('coverage: one world per K language standard (I2)', () => {
  for (const row of COVERAGE) {
    it(row.standard, () => {
      expect(blocking(row.draft)).toBe('');
      expect(wordModeOf(readWords(row.draft.words!).world)).toBe(row.mode);
      const [s] = buildStops([row.draft], ['an idea'], 7, []);
      expect(s.challengeType).toBe(row.mode);
      expect(s.ask).not.toMatch(/\[(sound|sounds|from|to)\]/);
      validateWonderWalkData({ title: 't', bigIdea: 'b', domain: 'language', gradeBand: 'K', challengeType: s.challengeType, challenges: [s, { ...s, id: 'stop-2' }] });
      expect(solves(s, true)).toBe(true);
      expect(solves(s, false)).toBe(false);
    });
  }
  it('covers every language mode', () => {
    expect(new Set(COVERAGE.map(r => r.mode))).toEqual(new Set(WORD_MODES));
  });
});

const row = (mode: string, i = 0) => COVERAGE.filter(r => r.mode === mode)[i].draft;
const withWords = (d: StopDraft, words: WordDraft, ask = d.ask, extra: Partial<StopDraft> = {}): StopDraft => ({ ...d, words, ask, ...extra });

describe('code derives the key and says the sounds (I4)', () => {
  it('fills the sounds from the library, not from the author', () => {
    const w = readWords(row('blend', 1).words!).world;
    expect(fillSounds('Listen, [sounds], what word is it?', w).text).toBe('Listen, puh - ihh - guh, what word is it?');
    expect(fillSounds('Listen, [sounds], which picture is it?', readWords(row('blend').words!).world).text).toContain('kuh - at');
  });
  it('blocks an ask without the token code fills', () => {
    expect(blocking(withWords(row('first-sound'), row('first-sound').words!, 'Which one starts with s?'))).toMatch(/write \[sound\]/);
  });
  it('finds the changed word itself (cat, h for k: hat)', () => {
    const [s] = buildStops([row('change-sound')], ['x'], 3, []);
    const k = s.correctOptionId.slice(6);
    expect(s.words!.things.find(t => t.id === k)!.word).toBe('hat');
    expect(s.ask).toMatch(/kuh to hhh/);
  });
  it('blocks two right answers', () => {
    const d = row('rhyme');
    const two = { ...d.words!, things: [p('a', 'hat'), p('b', 'bat'), p('c', 'sun')] };
    expect(blocking(withWords(d, two))).toMatch(/2 things fit/);
  });
  it('the boss rejects a stored key that is not the derived one', () => {
    const [s] = buildStops([row('rhyme')], ['x'], 1, []);
    const wrong = s.words!.things.find(t => `thing-${t.id}` !== s.correctOptionId)!;
    const bad = { ...s, correctOptionId: `thing-${wrong.id}` };
    expect(() => validateWonderWalkData({ title: 't', bigIdea: 'b', domain: 'language', gradeBand: 'K', challengeType: 'rhyme', challenges: [bad, { ...s, id: 'stop-2' }] })).toThrow(/key/);
  });
});

describe('shortcuts are blocked (I5)', () => {
  it('pick by meaning: the right picture is the only one that goes with the heard word', () => {
    const d = row('rhyme');
    // rhymes with cat: rat (an animal like the cat), with no other animal to pick instead.
    expect(blocking(withWords(d, { ...d.words!, things: [p('a', 'rat'), p('b', 'cup'), p('c', 'sun')] }))).toMatch(/only animal like the cat/);
  });
  it('odd one out: the right picture is the only one of another kind', () => {
    const d = row('first-sound');
    expect(blocking(withWords(d, { ...d.words!, things: [p('a', 'sock'), p('b', 'dog'), p('c', 'pig')] }))).toMatch(/odd one out/);
  });
  it('blend: only the right picture starts with the first sound', () => {
    const d = row('blend');
    expect(blocking(withWords(d, { ...d.words!, things: [p('a', 'cat'), p('b', 'map'), p('c', 'sun')] }))).toMatch(/without blending/);
  });
  it('story: the only thing heard, and the only one of its kind', () => {
    const d = row('story-detail');
    expect(blocking(withWords(d, { ...d.words!, things: [p('a', 'apple'), p('b', 'pear'), p('c', 'cup')] }))).toMatch(/only thing they heard/);
    expect(blocking(withWords(d, { ...d.words!, things: [p('a', 'apple'), p('b', 'house'), p('c', 'bed')] }))).toMatch(/pick by kind/);
  });
  it('one and many: the ask says how many', () => {
    expect(blocking(withWords(row('one-many'), row('one-many').words!, 'Where are the many cats?'))).toMatch(/hear the -s/);
  });
  it('one and many: only the right card shows that picture', () => {
    const d = row('one-many');
    expect(blocking(withWords(d, { ...d.words!, things: [p('a', 'cat', { count: 3 }), p('b', 'dog'), p('c', 'pig', { count: 3 })] }))).toMatch(/pick by the word/);
  });
  it('sort by sound that is a sort by kind', () => {
    const d = row('first-sound', 1);
    expect(blocking(withWords(d, { ...d.words!, things: [p('a', 'seal'), p('b', 'snake'), p('c', 'melon'), p('d', 'mango')] }))).toMatch(/sort by kind, not by sound/);
  });
  it('a card that fits no basket must be announced', () => {
    const d = row('rhyme', 1);
    const extra = { ...d.words!, things: [...d.words!.things, p('d', 'lock')] };
    expect(blocking(withWords(d, extra))).toMatch(/fits no basket: say so/);
    expect(blocking(withWords(d, extra, d.ask, { narration: 'Here is a cat and here is the sun. One picture goes in neither basket.' }))).toBe('');
  });
  it('a card that matches a ref by sight, a sort by an identity condition, two labels alike', () => {
    const blend = row('blend');
    expect(blocking(withWords(blend, { refs: [p('r1', 'cat'), p('r2', 'pig')], things: [p('a', 'cat'), p('b', 'pig'), p('c', 'cup')],
      answer: { kind: 'sort', baskets: [{ id: 'k1', label: 'r1', rule: { type: 'blend', word: 'cat' } }, { id: 'k2', label: 'r2', rule: { type: 'blend', word: 'pig' } }] } },
      'Can you sort by [sounds]?', { narration: 'One picture goes in neither basket.' }))).toMatch(/same picture as a ref.*sort by blend/);
    const letters = row('letter-name');
    expect(blocking(withWords(letters, { refs: [L('r1', 'm'), L('r2', 't')], things: [L('a', 'm'), L('b', 't')],
      answer: { kind: 'sort', baskets: [{ id: 'k1', label: 'r1', rule: { type: 'letter-name', letter: 'm' } }, { id: 'k2', label: 'r2', rule: { type: 'letter-name', letter: 't' } }] } },
      'Can you sort the letters?'))).toMatch(/same letter as a ref/);
  });
  it('a letter can label a first-sound basket (pictures into s and m)', () => {
    const d = row('first-sound', 1);
    expect(blocking(withWords(d, { refs: [L('r1', 's'), L('r2', 'm')], things: [p('a', 'sock'), p('b', 'seal'), p('c', 'mop'), p('d', 'map')],
      answer: { kind: 'sort', baskets: [{ id: 'k1', label: 'r1', rule: { type: 'sound', at: 'first', sound: 's' } }, { id: 'k2', label: 'r2', rule: { type: 'sound', at: 'first', sound: 'm' } }] } },
      'Can you put each picture with its first letter?', { narration: 'Here are two letters.', why: 'Say the word. Listen to the first sound.' }))).toBe('');
  });
  it('fills sounds in the why-card; blocks looking at what is not on screen', () => {
    const d = { ...row('letter-sound'), why: 'Say [sound] with your lips together.' };
    expect(blocking(d)).toBe('');
    expect(buildStops([d], ['x'], 1, [])[0].why).toBe('Say mmm with your lips together.');
    expect(blocking({ ...row('middle-sound'), narration: 'Look at the tall green tree.' })).toMatch(/look at the tree/);
  });
  it('says the answer word', () => {
    expect(blocking(withWords(row('rhyme'), row('rhyme').words!, 'Does hat rhyme with cat?'))).toMatch(/says "hat"/);
    expect(blocking(withWords(row('blend'), row('blend').words!, 'Listen, [sounds], is it the cat?'))).toMatch(/says "cat"|whole/);
  });
  it('the child must hear the word they compare with', () => {
    expect(blocking(withWords(row('rhyme'), row('rhyme').words!, 'Which one rhymes?', { narration: 'Listen for the end.' }))).toMatch(/must say "cat"/);
  });
  it('the story told aloud is the story the structure holds', () => {
    expect(blocking({ ...row('story-detail'), narration: 'A fox went to a house. Then he slept in a bed. He ate an apple.' })).toMatch(/out of order/);
  });
  it('two cards that share one picture', () => {
    const d = row('syllables');
    expect(blocking(withWords(d, { ...d.words!, things: [p('a', 'bunny'), p('b', 'hop'), p('c', 'butterfly')] }))).toMatch(/share one picture/);
  });
});

describe('difficulty from structure (I6) and the tutor scene', () => {
  it('a first sound with two choices is easy; changing a middle sound is hard', () => {
    const easy = { refs: [], things: [p('a', 'sock'), p('b', 'map')], answer: { kind: 'tap' as const, rule: { type: 'sound', at: 'first' as const, sound: 's' } } };
    expect(wordDifficulty(easy).band).toBe('easy');
    expect(wordDifficulty(tap([p('r', 'cat')], [p('a', 'cot'), p('b', 'cut'), p('c', 'kit')], { type: 'change', ref: 'r', at: 'middle', to: 'o' })).band).toBe('hard');
  });
  it('a near-sound distractor raises the score', () => {
    const a = wordDifficulty(tap([], [p('a', 'pig'), p('b', 'sun'), p('c', 'map')], { type: 'sound', at: 'first', sound: 'p' }));
    const b = wordDifficulty(tap([], [p('a', 'pig'), p('b', 'bus'), p('c', 'map')], { type: 'sound', at: 'first', sound: 'p' }));
    expect(b.score).toBeGreaterThan(a.score);
    expect(b.reasons.join()).toMatch(/sounds close/);
  });
  it('the scene names the pictures but never which is right; letters are not in screen order', () => {
    for (const r of COVERAGE) {
      const [s] = buildStops([r.draft], ['idea'], 5, []);
      const facts = JSON.stringify(workspaceScene({ bigIdea: 'b' }, s, { pickedId: null, placed: [], whyShown: false }).facts);
      expect(facts).not.toContain(s.correctOptionId || '~none~');
    }
    const [w] = buildStops([row('where-is')], ['idea'], 5, []);
    expect(JSON.stringify(workspaceScene({ bigIdea: 'b' }, w, { pickedId: null, placed: [], whyShown: false }).facts)).not.toMatch(/under the box/);
  });
});

describe('the walk (I7)', () => {
  const scope: WordScope = { openModes: ['rhyme', 'first-sound'] };
  it('every stop the same mode is blocked when two are open', () => {
    const r = row('rhyme');
    const r2 = withWords(r, { ...r.words!, refs: [p('r', 'sun')], things: [p('a', 'bun'), p('b', 'dog'), p('c', 'hat')] }, 'Which one rhymes with sun?', { narration: 'Here is the sun. Rhyming words sound the same at the end.', why: 'Rhyming words end the same way.' });
    const r3 = withWords(r, { ...r.words!, refs: [p('r', 'goat')], things: [p('a', 'boat'), p('b', 'dog'), p('c', 'sun')] }, 'Which one rhymes with goat?', { narration: 'Here is a goat. Rhyming words sound the same at the end.', why: 'Rhyming words end the same way.' });
    const c = walkChecks({ planned: true, ideas: ['x'], stops: [r, r2, r3], words: scope });
    expect(c.blocking.join()).toMatch(/every language stop is rhyme/);
  });
  it('a tap-only mode walk ships when each stop asks for something different (the 11-06 declines)', () => {
    const w = row('where-is');
    const at = (rel: 'in' | 'on' | 'under' | 'next-to', ask: string, word = 'cat') => withWords(w, tap([], (['under', 'in', 'on'] as const).map((r, i) => p(`t${i}`, word, { rel: r, landmark: 'box' }))
      .map((t, i) => (i === 0 ? { ...t, rel } : t.rel === rel ? { ...t, rel: 'next-to' as const } : t)), { type: 'where', rel }), ask);
    const three = [at('under', 'Which picture shows the cat under the box?'), at('on', 'Which picture shows the dog on the box?', 'dog'), at('in', 'Which picture shows the pig in the box?', 'pig')];
    const scope: WordScope = { openModes: ['where-is'] };
    expect(walkChecks({ planned: true, ideas: ['x'], stops: three, words: scope }).blocking).toEqual([]);
    const twice = [three[0], three[1], at('under', 'Which picture shows the pig under the box?', 'pig')];
    expect(walkChecks({ planned: true, ideas: ['x'], stops: twice, words: scope }).blocking.join()).toMatch(/ask for the same thing/);
  });
  it('a stop off the tier is blocked', () => {
    const c = walkChecks({ planned: true, ideas: ['x'], stops: [row('first-sound'), row('change-sound'), row('rhyme')], words: { ...ALL, tier: 'easy' } });
    expect(c.blocking.join()).toMatch(/language stop 1 is (medium|hard)/);
  });
});
