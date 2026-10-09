import { expect, it } from 'vitest';
import { eraSpokenMisses } from './eraExplorerWorkspace';
import type { EraExplorerItem } from './eraExplorerScript';

// era-explorer's known wrong picks (handoff 20 Part B): each other choice named for what it is; no example is accepted.
const choice = (phrase: string, distinguisher: string, alsoCounts: string[] = []) => ({ label: phrase, phrase, closeForm: phrase, distinguisher, alsoCounts });
const SORT = [choice('only back then in Pioneer Times', 'back then', ['long ago']), choice('only today in your own life', 'today', ['now']),
  choice('true in both times', 'both', ['both times'])];
const sort = (correctIndex: number) => ({ id: 's', kind: 'era_sort', statement: 'Children play games.', choices: SORT, correctIndex }) as unknown as EraExplorerItem;
const COMPARE = [choice('only in Colonial Times', 'Colonial Times', ['colonial', 'the earlier one']),
  choice('only in Pioneer Times', 'Pioneer Times', ['pioneer', 'the later one']), choice('true in both of those times', 'both', ['both times', 'both of them'])];
const compare = (correctIndex: number) => ({ id: 'm', kind: 'era_compare', statement: 'Families cook over a fire.', choices: COMPARE, correctIndex }) as unknown as EraExplorerItem;
const cause = { id: 'c', kind: 'cause_of_change', statement: 'Families stopped using washboards.', correctIndex: 0,
  choices: [choice('because washing machines were invented', 'washing machines', ['invented']), choice('because laws banned washing', 'laws'),
    choice('because stores sold paper clothes', 'paper clothes')] } as unknown as EraExplorerItem;

it.each([
  [sort(2), ['said_back_then', 'said_today'], ['both', 'both times']],
  [sort(1), ['said_back_then', 'said_both'], ['today', 'now']],
  [sort(0), ['said_today', 'said_both'], ['back then', 'long ago']],
  [cause, ['other_cause', 'said_what_changed'], ['washing machines', 'invented']],
  [{ ...cause, kind: 'lens_id' } as EraExplorerItem, ['other_lens', 'named_a_thing'], ['washing machines', 'invented']],
  [compare(2), ['said_earlier', 'said_later', 'said_today'], ['both', 'both times', 'both of them']],
  [compare(0), ['said_later', 'said_both', 'said_today'], ['colonial times', 'colonial', 'the earlier one']],
] as const)('row %#', (item, ids, accepted) => {
  const misses = eraSpokenMisses(item);
  expect(misses.map(m => m.id)).toEqual(ids);
  const ok = accepted.map(a => a.toLowerCase());
  for (const m of misses) for (const e of m.examples ?? []) expect(ok).not.toContain(e.toLowerCase());
});
