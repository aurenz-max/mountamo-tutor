import { expect, it } from 'vitest';
import { eraSpokenMisses } from './eraExplorerWorkspace';
import type { EraExplorerItem } from './eraExplorerScript';

// era-explorer's known wrong picks (handoff 20 Part B): each other choice named for what it is; no example is accepted.
const choice = (phrase: string, distinguisher: string, alsoCounts: string[] = []) => ({ label: phrase, phrase, closeForm: phrase, distinguisher, alsoCounts });
const SORT = [choice('only back then in Pioneer Times', 'back then', ['long ago']), choice('only today in your own life', 'today', ['now']),
  choice('true in both times', 'both', ['both times'])];
const sort = (correctIndex: number) => ({ id: 's', kind: 'era_sort', statement: 'Children play games.', choices: SORT, correctIndex }) as unknown as EraExplorerItem;
const cause = { id: 'c', kind: 'cause_of_change', statement: 'Families stopped using washboards.', correctIndex: 0,
  choices: [choice('because washing machines were invented', 'washing machines', ['invented']), choice('because laws banned washing', 'laws'),
    choice('because stores sold paper clothes', 'paper clothes')] } as unknown as EraExplorerItem;

it.each([
  [sort(2), ['said_back_then', 'said_today'], ['both', 'both times']],
  [sort(1), ['said_back_then', 'said_both'], ['today', 'now']],
  [sort(0), ['said_today', 'said_both'], ['back then', 'long ago']],
  [cause, ['other_cause', 'said_what_changed'], ['washing machines', 'invented']],
  [{ ...cause, kind: 'lens_id' } as EraExplorerItem, [], []],
] as const)('row %#', (item, ids, accepted) => {
  const misses = eraSpokenMisses(item);
  expect(misses.map(m => m.id)).toEqual(ids);
  const ok = accepted.map(a => a.toLowerCase());
  for (const m of misses) for (const e of m.examples ?? []) expect(ok).not.toContain(e.toLowerCase());
});
