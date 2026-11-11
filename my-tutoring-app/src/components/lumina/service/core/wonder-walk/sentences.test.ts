/**
 * Sentence stops in the Wonder Walk word world (USER 2026-11-10, K grammar), against the agent-primitive invariants:
 * shortcuts are blocked (I5), difficulty comes from the structure and every band is reachable (I6), the tutor's scene
 * never holds the key (I8), and code derives how the answer is said (I11). The coverage rows are in `words.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { buildStops, stopChecks, type StopDraft, type WordScope } from './checks';
import { WORD_MODES, readWords, wordDifficulty, wordModeOf, wordWalkChecks, type ThingDraft, type WordDraft } from './words';
import { stopAsk, stopCardsLine, workspaceScene } from '../../../primitives/visual-primitives/core/wonder-walk/wonderWalkWorkspace';
import { respondError, respondOf, stopSpokenKey, stopSpokenMisses } from '../../../primitives/visual-primitives/core/wonder-walk/wonderWalkSpoken';

const ALL: WordScope = { openModes: WORD_MODES };
const T = (id: string, tile: string, word?: string): ThingDraft => ({ id, tile, ...(word ? { word } : {}) });
const S = (say: string, role: string, card?: string) => ({ say, role, ...(card ? { card } : {}) });
const stop = (words: WordDraft, ask: string, narration = 'Let us make a sentence together.', why = 'Who is it about? What do they do?'): StopDraft =>
  ({ kind: wordModeOf(readWords(words).world), ideaIndex: 0, sceneWords: [], imagePrompt: '', correctWord: '', wrongWords: [], narration, ask, why, words });
const blocking = (d: StopDraft) => stopChecks(d, 1, undefined, ALL).blocking.join(' | ');
const built = (d: StopDraft) => buildStops([d], ['an idea'], 5, [])[0];
const VIEW = { pickedId: null, placed: [], whyShown: false };

const BUILD: WordDraft = { refs: [], things: [T('a', 'cat', 'cat'), T('b', 'drinks', 'drink'), T('c', 'milk', 'milk')],
  sentence: [S('the', 'small'), S('cat', 'who', 'a'), S('drinks', 'does', 'b'), S('milk', 'what', 'c'), S('.', 'end')], answer: { kind: 'order', by: 'sentence' } };
const FILL: WordDraft = { refs: [], things: [T('a', 'runs', 'run'), T('b', 'cat', 'cat'), T('c', 'and')],
  sentence: [S('the', 'small'), S('dog', 'who'), S('runs', 'does', 'a')], answer: { kind: 'tap', rule: { type: 'fills' } } };
const JOIN: WordDraft = { refs: [], things: [T('a', 'but'), T('b', 'and'), T('c', 'hat', 'hat')],
  sentence: [S('the', 'small'), S('cat', 'who'), S('runs', 'does'), S('but', 'joins', 'a'), S('the', 'small'), S('dog', 'who'), S('sleeps', 'does')], answer: { kind: 'tap', rule: { type: 'fills' } } };
const PARTS: WordDraft = { refs: [], things: [T('a', 'dog', 'dog'), T('b', 'chases'), T('c', 'ball', 'ball')],
  sentence: [S('the', 'small'), S('dog', 'who', 'a'), S('chases', 'does', 'b'), S('the', 'small'), S('ball', 'what', 'c')], answer: { kind: 'tap', rule: { type: 'part', role: 'does' } } };
const ASK_BUILD = 'Can you put the cards in order to make a sentence?';
const ASK_FILL = 'Which word makes it a whole sentence?';

describe('a sentence world is read from its structure', () => {
  it('every sentence world is one mode, a capability and not a task (I9)', () => {
    for (const d of [BUILD, FILL, JOIN, PARTS]) expect(wordModeOf(readWords(d).world)).toBe('sentence');
  });
  it('three sentence stops that all do the same thing are sent back (I7)', () => {
    const fill2: WordDraft = { ...FILL, things: [T('a', 'sleeps', 'sleep'), T('b', 'hat', 'hat'), T('c', 'but')], sentence: [S('the', 'small'), S('cat', 'who'), S('sleeps', 'does', 'a')] };
    const fill3: WordDraft = { ...FILL, things: [T('a', 'hops', 'hop'), T('b', 'sun', 'sun'), T('c', 'or')], sentence: [S('the', 'small'), S('frog', 'who'), S('hops', 'does', 'a')] };
    expect(wordWalkChecks([FILL, fill2, fill3], { openModes: ['sentence'] }).join(' ')).toMatch(/every sentence stop is a fill/);
    expect(wordWalkChecks([FILL, BUILD, PARTS], { openModes: ['sentence'] }).join(' ')).not.toMatch(/every sentence stop/);
  });
  it('derives the order from the sentence, with words that are not cards left in place', () => {
    const s = built(stop(BUILD, ASK_BUILD, 'Somebody is thirsty this morning!'));
    expect(blocking(stop(BUILD, ASK_BUILD, 'Somebody is thirsty this morning!'))).toBe('');
    const key = s.words!.sentence!.filter(k => k.card).map(k => s.words!.things.find(t => t.id === k.card)!.tile);
    expect(key).toEqual(['cat', 'drinks', 'milk']);
  });
  it('refuses a card whose word is not its sentence word', () => {
    expect(blocking(stop({ ...BUILD, things: [T('a', 'dog', 'dog'), T('b', 'drinks', 'drink'), T('c', 'milk', 'milk')] }, ASK_BUILD))).toMatch(/says "dog" but its sentence word is "cat"/);
  });
  it('the role the author gives stands where the library knows the word as another kind; the mismatch is a note (I12)', () => {
    const c = stopChecks(stop(BUILD, ASK_BUILD, 'Somebody is thirsty this morning!'), 1, undefined, ALL);
    expect(c.blocking).toEqual([]);
    expect(c.advisory.join(' ')).toMatch(/"drinks" is a naming word in the word library but the does here/);
  });
  it('a tile takes its kind and picture from the library when it has them, and needs neither', () => {
    const w = readWords({ refs: [], things: [T('a', 'runs', 'run'), T('b', 'zooms'), T('c', 'dog')], sentence: [S('dog', 'who', 'c'), S('zooms', 'does', 'b')], answer: { kind: 'order', by: 'sentence' } });
    expect(w.errors).toEqual([]);
    expect(w.world.things.map(t => [t.tile, !!t.emoji, t.category])).toEqual([['runs', true, 'action'], ['zooms', false, undefined], ['dog', true, 'animal']]);
  });
  it('a question starts with a question word', () => {
    const q: WordDraft = { refs: [], things: [T('a', 'I'), T('b', 'play', 'play'), T('c', '?')], sentence: [S('I', 'who', 'a'), S('play', 'does', 'b'), S('?', 'end', 'c')], answer: { kind: 'order', by: 'sentence' } };
    expect(blocking(stop(q, ASK_BUILD))).toMatch(/starts with a question word/);
  });
});

describe('shortcuts are blocked (I5)', () => {
  it('a sentence to build is never said in order', () => {
    expect(blocking(stop(BUILD, ASK_BUILD, 'The cat drinks milk every morning.'))).toMatch(/two words of the sentence in order/);
  });
  it('the cards are never named in the order they go, in the why-card either', () => {
    expect(blocking(stop(BUILD, ASK_BUILD, 'Somebody is thirsty this morning!', 'First is cat, then drinks, then milk.'))).toMatch(/names the cards in the order they go/);
    expect(blocking(stop(BUILD, ASK_BUILD, 'Somebody is thirsty this morning!', 'Start with who it is about. Then say what they do.'))).toBe('');
  });
  it('an end mark is never a choice when finding a part', () => {
    expect(blocking(stop({ ...PARTS, things: [...PARTS.things, T('d', '.')], sentence: [...PARTS.sentence!, S('.', 'end', 'd')] }, 'What does the dog do?', 'The dog chases the ball.'))).toMatch(/an end mark is not a part to find/);
  });
  it('a missing word two cards could both be', () => {
    expect(blocking(stop({ ...FILL, things: [T('a', 'runs', 'run'), T('b', 'jumps', 'jump'), T('c', 'and')] }, ASK_FILL))).toMatch(/could go in the gap too/);
  });
  it('a missing word with no wrong card of another kind', () => {
    expect(blocking(stop({ ...JOIN, things: [T('a', 'but'), T('b', 'and')] }, 'Which word joins the two parts?'))).toMatch(/no wrong card is another kind of word/);
  });
  it('the missing word said aloud, alone or in its place', () => {
    expect(blocking(stop(FILL, 'Which card says runs?'))).toMatch(/says "runs", the missing word/);
    expect(blocking(stop({ ...FILL, sentence: [S('the', 'small'), S('dog', 'who', 'a'), S('runs', 'does')], things: [T('a', 'dog', 'dog'), T('b', 'jumps', 'jump'), T('c', 'and')] }, ASK_FILL, 'Listen. The dog runs away.')))
      .toMatch(/the narration says "dog"|"the dog" is said aloud|"dog runs" is said aloud/);
  });
  it('a period and an exclamation mark never compete', () => {
    const end: WordDraft = { refs: [], things: [T('a', '.'), T('b', '!')], sentence: [S('the', 'small'), S('dog', 'who'), S('runs', 'does'), S('.', 'end', 'a')], answer: { kind: 'tap', rule: { type: 'fills' } } };
    expect(blocking(stop(end, 'Which mark goes at the end?'))).toMatch(/cannot both be cards/);
  });
  it('a part is found in a sentence the child heard, among its other words', () => {
    expect(blocking(stop(PARTS, 'What does the dog do?', 'A dog is playing outside.'))).toMatch(/must say the sentence as written/);
    expect(blocking(stop({ ...PARTS, sentence: [S('the', 'small'), S('dog', 'who'), S('chases', 'does', 'b'), S('the', 'small'), S('ball', 'what')], things: [T('b', 'chases'), T('x', 'hat', 'hat'), T('y', 'sun', 'sun')] }, 'What does the dog do?', 'The dog chases the ball.')))
      .toMatch(/at least two words of the sentence are cards/);
  });
  it('word tiles belong to sentence stops only', () => {
    expect(blocking(stop({ refs: [], things: [T('a', 'runs', 'run'), T('b', 'cat', 'cat')], answer: { kind: 'tap', rule: { type: 'kind', kind: 'action' } } }, 'Which one is something you do?'))).toMatch(/word tiles are the cards of a sentence stop/);
  });
});

describe('difficulty comes from the structure and reaches every band (I6)', () => {
  const two: WordDraft = { refs: [], things: [T('a', 'dog', 'dog'), T('b', 'runs', 'run')], sentence: [S('dog', 'who', 'a'), S('runs', 'does', 'b')], answer: { kind: 'order', by: 'sentence' } };
  const five: WordDraft = { refs: [], things: [T('a', 'big'), T('b', 'cat', 'cat'), T('c', 'drinks', 'drink'), T('d', 'milk', 'milk'), T('e', 'and'), T('f', 'hat', 'hat')],
    sentence: [S('the', 'small'), S('big', 'describes', 'a'), S('cat', 'who', 'b'), S('drinks', 'does', 'c'), S('milk', 'what', 'd')], answer: { kind: 'order', by: 'sentence' } };
  it('build: two cards are easy, three medium, four with a spare and a describing word hard', () => {
    expect(wordDifficulty(two).band).toBe('easy');
    expect(wordDifficulty({ ...BUILD }).band).toBe('easy');
    expect(wordDifficulty({ ...BUILD, things: [...BUILD.things, T('d', 'and')] }).band).toBe('medium');
    expect(wordDifficulty({ ...five, things: five.things.slice(0, 5) }).band).toBe('hard');
  });
  it('fill: an end mark is easy, a doing-word medium, a joining word among four hard', () => {
    const end: WordDraft = { refs: [], things: [T('a', '?'), T('b', '.')], sentence: [S('can', 'small'), S('I', 'who'), S('play', 'does'), S('?', 'end', 'a')], answer: { kind: 'tap', rule: { type: 'fills' } } };
    expect(wordDifficulty(end).band).toBe('easy');
    expect(wordDifficulty(FILL).band).toBe('medium');
    expect(wordDifficulty({ ...JOIN, things: [...JOIN.things, T('d', 'runs', 'run')] }).band).toBe('hard');
  });
  it('parts: who among two is easy, the does among four in a long sentence is hard', () => {
    expect(wordDifficulty({ ...PARTS, things: PARTS.things.slice(0, 2), sentence: [S('the', 'small'), S('dog', 'who', 'a'), S('chases', 'does', 'b')], answer: { kind: 'tap', rule: { type: 'part', role: 'who' } } }).band).toBe('easy');
    expect(wordDifficulty({ ...PARTS, things: [...PARTS.things, T('d', 'hat', 'hat')] }).band).toBe('hard');
  });
});

describe('the tutor is told the task and never the key (I8)', () => {
  it('a fill is read with a blank, and every tile is named for a child who cannot read', () => {
    const s = built(stop(FILL, ASK_FILL));
    expect(stopAsk(s)).toContain('The sentence is: the dog blank');
    expect(stopCardsLine(s)).toMatch(/^The cards say /);
    const facts = workspaceScene({ bigIdea: 'b' }, s, VIEW).facts as Record<string, string>;
    expect(facts.sentence).toContain('the dog blank');
    expect(facts.sentence).not.toContain('runs');
  });
  it('a build tells how long the sentence is and which words are in place, never the order of the cards', () => {
    const s = built(stop(BUILD, ASK_BUILD, 'Somebody is thirsty this morning!'));
    const facts = workspaceScene({ bigIdea: 'b' }, s, VIEW).facts as Record<string, string>;
    expect(facts.sentence).toContain('a sentence of 4 words');
    expect(facts.sentence).toContain('"the"');
    expect(facts.sentence).not.toMatch(/cat drinks|drinks milk/);
  });
  it('an end mark is named, not printed, in the cards line', () => {
    const end: WordDraft = { refs: [], things: [T('a', '?'), T('b', '.')], sentence: [S('can', 'small'), S('I', 'who'), S('play', 'does'), S('?', 'end', 'a')], answer: { kind: 'tap', rule: { type: 'fills' } } };
    const s = built(stop(end, 'Which mark goes at the end?', 'Listen to my voice as I read it.', 'Does it ask or does it tell?'));
    expect(stopCardsLine(s)).toMatch(/a question mark/);
    expect(stopAsk(s)).toContain('The sentence is: can I play');
  });
});

describe('code derives how the answer is said (I11)', () => {
  it('a missing word is said as the tile word, exactly; its wrong cards are named misses', () => {
    const s = built(stop(FILL, ASK_FILL));
    expect(respondOf(s)).toBe('say');
    expect(respondError(s)).toBeNull();
    expect(stopSpokenKey(s)).toEqual({ answer: 'runs', alsoAccept: [] });
    expect(stopSpokenMisses(s).map(m => m.id)).toEqual(['wrong_kind']);
  });
  it('and for but is its own miss', () => {
    const s = built(stop(JOIN, 'Which word joins the two parts?', 'One runs. One does not.', 'Do the two parts go together, or are they different?'));
    expect(stopSpokenKey(s)?.answer).toBe('but');
    expect(stopSpokenMisses(s).map(m => m.id).sort()).toEqual(['other_join', 'wrong_kind']);
  });
  it('an end mark and a built sentence are shown, never said', () => {
    const end: WordDraft = { refs: [], things: [T('a', '?'), T('b', '.')], sentence: [S('can', 'small'), S('I', 'who'), S('play', 'does'), S('?', 'end', 'a')], answer: { kind: 'tap', rule: { type: 'fills' } } };
    expect(stopSpokenKey(built(stop(end, 'Which mark goes at the end?', 'Listen to my voice as I read it.', 'Does it ask or does it tell?')))).toBeNull();
    expect(stopSpokenKey(built(stop(BUILD, ASK_BUILD, 'Somebody is thirsty this morning!')))).toBeNull();
    expect(respondError({ ...built(stop(BUILD, ASK_BUILD, 'Somebody is thirsty this morning!')), respond: 'say' })).toMatch(/respond show/);
  });
});
