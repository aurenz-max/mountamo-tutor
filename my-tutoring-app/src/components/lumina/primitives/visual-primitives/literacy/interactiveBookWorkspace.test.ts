import { expect, it } from 'vitest';
import { interactiveBookMiss, type BookHotspot } from './interactiveBookWorkspace';
import type { InteractiveBookItem } from './interactiveBookScript';

const find = (targetText: string) => ({ id: 'b', mode: 'find-feature', targetPageId: 'p1', targetText }) as InteractiveBookItem;
const spot = (feature: BookHotspot['feature'], text: string): BookHotspot => ({ id: feature, feature, text });
it.each([
  [find('Frogs Grow Up'), spot('heading', 'Frogs Grow Up'), undefined],
  [find('Frogs Grow Up'), spot('caption', 'A tadpole swims.'), 'tapped_caption'],
  [find('A tadpole swims.'), spot('heading', 'Frogs Grow Up'), 'tapped_heading'],
  [find('A tadpole swims.'), spot('page-number', 'Page 2'), 'tapped_page_number'],
  [find('Pond Life'), spot('author', 'Ana Ruiz'), 'tapped_author'], [find('Ana Ruiz'), spot('title', 'Pond Life'), 'tapped_title'],
  [{ ...find('swims'), mode: 'read-focus-word' } as InteractiveBookItem, spot('caption', 'x'), undefined],
] as const)('%#', (item, hotspot, miss) => {
  expect(interactiveBookMiss(item, hotspot)).toBe(miss);
});
