import { expect, it } from 'vitest';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import { matterSpokenMisses } from './matterExplorerWorkspace';
import type { MatterExplorerItem } from './matterExplorerScript';
import { statesSpokenMisses } from './statesOfMatterWorkspace';
import type { StatesOfMatterItem } from './statesOfMatterScript';

// matter-explorer and states-of-matter's known wrong answers (handoff 20 Part B): ids in precedence order, and no
// example is an accepted answer.
const matter = (extra: Partial<MatterExplorerItem>) => ({ id: 'm', objectName: 'ice cube', answerState: 'solid', ...extra }) as MatterExplorerItem;
const water = { key: 'water', name: 'Water', meltingPoint: 0, boilingPoint: 100 };
const states = (extra: Partial<StatesOfMatterItem>) => ({ id: 's', substance: water, ...extra }) as unknown as StatesOfMatterItem;

it.each([
  ['name_state', matterSpokenMisses(matter({ kind: 'name_state' })), ['other_state', 'said_object_back'], ['solid', 'a solid']],
  ['mystery', matterSpokenMisses(matter({ kind: 'mystery_state' })), ['other_state'], ['solid']],
  ['property', matterSpokenMisses(matter({ kind: 'name_property', answerShape: 'keeps_shape' })), ['other_shape', 'state_word'],
    ['own shape', 'keeps', 'keeps its shape', 'stays the same']],
  ['property, two options', matterSpokenMisses(matter({ kind: 'name_property', answerShape: 'keeps_shape', menu: ['keeps_shape', 'fills_space'] })),
    ['other_shape', 'state_word'], ['own shape', 'keeps', 'keeps its shape', 'stays the same', 'the cup']],
  ['melt', matterSpokenMisses(matter({ kind: 'name_undo', change: 'melt', answerUndo: 'can_go_back' })),
    ['other_way', 'said_change_back', 'state_word'], ['go back', 'back', 'we can get it back', 'yes']],
  ['burn', matterSpokenMisses(matter({ kind: 'name_undo', objectName: 'paper', change: 'burn', answerUndo: 'changed_for_ever' })),
    ['other_way', 'said_change_back', 'state_word'], ['for ever', 'forever', 'never', 'no']],
  ['observe', statesSpokenMisses(states({ kind: 'name_state', answerState: 'liquid' })), ['other_state', 'said_substance_back'], ['liquid']],
  ['predict across', statesSpokenMisses(states({ kind: 'predict_state', startState: 'liquid', answerState: 'gas', targetTemp: 130 })),
    ['said_start_state', 'other_state'], ['gas', 'steam', 'water vapour']],
  ['predict, no crossing', statesSpokenMisses(states({ kind: 'predict_state', startState: 'gas', answerState: 'gas', targetTemp: 140 })),
    ['other_state'], ['gas']],
  ['change', statesSpokenMisses(states({ kind: 'predict_change', answerChange: 'freezing', targetTemp: -10 })),
    ['said_end_state', 'opposite_change'], ['freezing', 'freeze']],
  ['pair', statesSpokenMisses(states({ kind: 'melt_first', pair: [water, { ...water, name: 'Wax' }], answerName: 'Water' } as never)),
    ['other_of_pair'], ['Water']],
] as const)('%s: spoken misses', (_name, misses: KnownMiss[], ids, accepted) => {
  expect(misses.map(m => m.id)).toEqual(ids);
  const ok = accepted.map(a => a.toLowerCase());
  for (const m of misses) for (const e of m.examples ?? []) expect(ok).not.toContain(e.toLowerCase());
});
