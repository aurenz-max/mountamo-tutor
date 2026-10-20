/**
 * interactiveBookDomain: the build gates, the asks, the key and the tap's check, pure. Moved from the retired
 * script test (its still-true assertions: the split, the leak rules, the gates) and the workspace miss test.
 */
import { describe, expect, it } from 'vitest';
import { askLeaks } from '../../../components/live-activity/spokenKey';
import {
  askFor, challengeAskable, interactiveBookKey, interactiveBookMiss, interactiveBookScene, itemFromChallenge,
  itemsFromChallenges, MIN_LEAD_WORDS, type BookHotspot, type InteractiveBookItem,
} from './interactiveBookDomain';

const WORD_RAW = { id: 'ib-w1', type: 'read-focus-word', targetPageId: 'p1', targetFeature: 'focus-word',
  targetText: 'frog', optionTexts: ['frog', 'pond'], readLead: 'The green', readTail: 'can hop by the pond.' };
const TITLE_RAW = { id: 'ib-f1', type: 'find-feature', targetPageId: 'cover', targetFeature: 'title',
  targetText: 'Pond Neighbors', optionTexts: ['Pond Neighbors', 'Mia Lee'] };
const CAPTION_RAW = { id: 'ib-f2', type: 'find-feature', targetPageId: 'p2', targetFeature: 'caption',
  targetText: 'Nest Above', optionTexts: ['Safe Nests', 'Nest Above', 'Page 2'] };
const WORD = itemFromChallenge(WORD_RAW)!, TITLE = itemFromChallenge(TITLE_RAW)!, CAPTION = itemFromChallenge(CAPTION_RAW)!;

describe('interactive-book domain', () => {
  it('reads the glowing word out loud and taps the book part, whose answer is a position', () => {
    expect(WORD).toMatchObject({ answerKind: 'voice', responseClass: 'short_spoken_word', tier: 'medium' });
    expect(TITLE).toMatchObject({ answerKind: 'gesture', responseClass: 'manipulation' });
    expect(interactiveBookKey(TITLE)).toBeNull();
    expect(interactiveBookKey(WORD)).toMatchObject({ answer: 'frog' });
    expect(itemsFromChallenges([WORD_RAW], 'easy')[0].tier).toBe('easy');
  });

  it('the reading ask says the lead-in and never the word; the find ask names the part, never the printed text', () => {
    expect(askFor(WORD)).toBe('Listen: The green — hmm. Read the glowing word.');
    expect(askLeaks(askFor(WORD), interactiveBookKey(WORD)!)).toEqual([]);
    expect(askFor(TITLE)).toBe('Find the title. Tap the title.');
    expect(askFor(CAPTION)).toContain('picture caption');
    for (const item of [TITLE, CAPTION]) expect(askFor(item).toLowerCase()).not.toContain(item.targetText.toLowerCase());
    expect(JSON.stringify(interactiveBookScene(CAPTION))).not.toContain('Nest Above');
    expect(JSON.stringify(interactiveBookScene(WORD)).toLowerCase()).not.toMatch(/\bfrog\b/);
  });

  it('drops what cannot be asked, never repairs it', () => {
    expect(MIN_LEAD_WORDS).toBe(2);
    expect(itemFromChallenge({ ...WORD_RAW, readLead: 'The' })).toBeNull();
    for (const word of ['yes', 'no', 'Yes']) expect(itemFromChallenge({ ...WORD_RAW, targetText: word })).toBeNull();
    expect(itemFromChallenge({ ...WORD_RAW, targetText: 'frog-is-fine-wait-frog' })).toBeNull();
    expect(itemFromChallenge({ ...WORD_RAW, targetText: 'two words' })).toBeNull();
    expect(itemFromChallenge({ ...WORD_RAW, readLead: `The very ${'green and slippery '.repeat(6)}little` })).toBeNull();
    expect(itemFromChallenge({ ...WORD_RAW, readLead: 'The "green"' })).toBeNull();
    expect(itemFromChallenge({ ...WORD_RAW, readLead: 'The frog sees the' })).toBeNull();
    expect(itemFromChallenge({ ...WORD_RAW, readTail: 'and the frog hops.' })).toBeNull();
    expect(itemFromChallenge({ ...CAPTION_RAW, optionTexts: ['Safe Nests', 'Page 2'] })).toBeNull();
    expect(itemFromChallenge({ ...CAPTION_RAW, optionTexts: ['Nest Above', 'Nest Above', 'Page 2'] })).toBeNull();
    expect(itemFromChallenge({ ...CAPTION_RAW, optionTexts: ['Nest Above'] })).toBeNull();
    expect(itemFromChallenge({ ...CAPTION_RAW, targetFeature: 'focus-word' })).toBeNull();
    expect(itemsFromChallenges([WORD_RAW, { ...WORD_RAW, id: 'bad', readLead: 'The' }, CAPTION_RAW]).map(i => i.id))
      .toEqual(['ib-w1', 'ib-f2']);
    expect(challengeAskable(WORD_RAW)).toBe(true);
    expect(challengeAskable({ ...WORD_RAW, readLead: 'The' })).toBe(false);
  });
});

const find = (targetText: string) => ({ id: 'b', mode: 'find-feature', targetPageId: 'p1', targetText }) as InteractiveBookItem;
const spot = (feature: BookHotspot['feature'], text: string): BookHotspot => ({ id: feature, feature, text });
it.each([
  [find('Frogs Grow Up'), spot('heading', 'Frogs Grow Up'), undefined],
  [find('Frogs Grow Up'), spot('caption', 'A tadpole swims.'), 'tapped_caption'],
  [find('A tadpole swims.'), spot('heading', 'Frogs Grow Up'), 'tapped_heading'],
  [find('A tadpole swims.'), spot('page-number', 'Page 2'), 'tapped_page_number'],
  [find('Pond Life'), spot('author', 'Ana Ruiz'), 'tapped_author'], [find('Ana Ruiz'), spot('title', 'Pond Life'), 'tapped_title'],
  [{ ...find('swims'), mode: 'read-focus-word' } as InteractiveBookItem, spot('caption', 'x'), undefined],
] as const)('a wrong tap names the part tapped (%#)', (item, hotspot, miss) => {
  expect(interactiveBookMiss(item, hotspot)).toBe(miss);
});
