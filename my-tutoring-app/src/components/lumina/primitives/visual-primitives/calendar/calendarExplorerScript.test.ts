import { describe, expect, it } from 'vitest';
import { CALENDAR_CATALOG } from '../../../service/manifest/catalog/calendar';
import {
  spokenSpansOf,
  type JudgedScriptPack,
} from '../../../hooks/judgedScriptContract';
import {
  checkDiCatalogEntry,
  checkPackGates,
} from '../../../hooks/judgedScriptContract.testkit';
import {
  calendarExplorerSequencePackBase,
  calendarSequenceHarnessAnswers,
  type CalendarDaySequenceItem,
  type CalendarMonthSequenceItem,
} from './calendarExplorerScript';

const ITEMS: CalendarDaySequenceItem[] = [
  {
    id: 'day-1',
    type: 'day_sequence',
    answerKind: 'voice',
    responseClass: 'short_spoken_word',
    action: 'day_sequence',
    currentDay: 'Tuesday',
    expectedDay: 'Wednesday',
    chainPosition: 1,
  },
  {
    id: 'day-2',
    type: 'day_sequence',
    answerKind: 'voice',
    responseClass: 'short_spoken_word',
    action: 'day_sequence',
    currentDay: 'Wednesday',
    expectedDay: 'Thursday',
    chainPosition: 2,
  },
];

const pack = calendarExplorerSequencePackBase(ITEMS, {
  title: 'Days in Order',
  gradeBand: 'K',
}) as JudgedScriptPack<CalendarDaySequenceItem>;

describe('calendar-explorer spoken day chain', () => {
  it('passes the judged-script and catalog wiring gates', () => {
    expect(checkPackGates(pack)).toEqual([]);
    const entry = CALENDAR_CATALOG.find((candidate) => candidate.id === 'calendar-explorer')!;
    expect(checkDiCatalogEntry(entry, pack, ITEMS[0])).toEqual([]);
  });

  it('keeps the answer out of the independent ask', () => {
    const [ask] = spokenSpansOf(pack.itemCue(ITEMS[0], { opening: true, howToPlay: true }));
    expect(ask).toContain('Listen: Tuesday.');
    expect(ask).not.toContain('Wednesday');
  });

  it('says the full week from Sunday after an error, then asks the same turn again', () => {
    const spans = spokenSpansOf(pack.itemCue(ITEMS[0], { opening: false, howToPlay: false }));
    const correction = spans.find((line) => line.startsWith('My turn:')) ?? '';
    expect(correction).toContain(
      'Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday',
    );
    expect(correction).toContain('What day comes after Tuesday?');
  });

  it('exports harness answers paired with the successor contract', () => {
    expect(calendarSequenceHarnessAnswers(ITEMS[0])).toMatchObject({
      correct: 'Wednesday',
      plainWrong: 'Tuesday',
    });
  });
});

describe('calendar-explorer spoken month chain', () => {
  const monthItem: CalendarMonthSequenceItem = {
    id: 'month-1',
    type: 'month_sequence',
    answerKind: 'voice',
    responseClass: 'short_spoken_word',
    action: 'month_sequence',
    currentMonth: 'December',
    expectedMonth: 'January',
    chainPosition: 1,
  };
  const monthPack = calendarExplorerSequencePackBase([monthItem], {
    title: 'Months in Order',
    gradeBand: 'K',
  });

  it('keeps the successor out of the independent month ask', () => {
    const [ask] = spokenSpansOf(monthPack.itemCue(monthItem, { opening: true, howToPlay: true }));
    expect(ask).toContain('Listen: December.');
    expect(ask).not.toContain('January');
  });

  it('recites the full year from January after an error and retries the same month', () => {
    const spans = spokenSpansOf(monthPack.itemCue(monthItem, { opening: false, howToPlay: false }));
    const correction = spans.find((line) => line.startsWith('My turn:')) ?? '';
    expect(correction).toContain(
      'January, February, March, April, May, June, July, August, September, October, November, December',
    );
    expect(correction).toContain('What month comes after December?');
  });

  it('exports month harness answers paired with the successor contract', () => {
    expect(calendarSequenceHarnessAnswers(monthItem)).toMatchObject({
      correct: 'January',
      plainWrong: 'December',
    });
  });
});
