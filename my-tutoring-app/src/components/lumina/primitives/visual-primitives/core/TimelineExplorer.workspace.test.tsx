// @vitest-environment jsdom
/**
 * timeline-explorer on its boss (`timelineExplorer.card.ts` + `.boss.ts`) and its lever set: what is its own. The generic
 * W1 contract (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 * The learner reads every event first (not ready for a response), then code-keyed items: identify and date are
 * closed choices said or tapped (the key published only as the spoken expectedAnswer); order and cause_effect are
 * gestures checked by code. A wrong answer names its miss, and every miss has a help lever first.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import type { TimelineExplorerData } from './TimelineExplorer';
import {
  buildTimelineItems, clueLeaks, deckOf, emptyWork, KIND_MISSES, linksOf, MODE_KINDS, movesTo, orderKey, redactDates,
  seededRng, timelineCorrect, timelineHarnessAnswers, timelineItems, timelineMiss, validTimelineItem, asCheck, modeOfKind,
  type ChoiceItem, type LinkItem, type OrderItem, type TimelineEvent, type TimelineItem, type TimelineMode, type TimelineTier,
} from './timelineExplorerWorkspace';
import {
  BEFORE_AFTER_LEVER, cardLines, choiceLineLeaks, DATE_LINE_LEVER, datesLeaveDoubt, FEWER_CARDS_LEVER, LED_TO_LEVER, ledToArrows,
  linksLeaveDoubt, possibleMisses, READ_CARDS_LEVER, SHOW_DATES_LEVER, SHOW_TIMELINE_LEVER, simplerItem, TIMELINE_LEVERS,
  TWO_CHOICES_LEVER, TWO_DATES_LEVER, TWO_LINKS_LEVER, beforeAfterLines,
} from './timelineExplorerLevers';
import { timelineExplorerBoss } from './timelineExplorer.boss';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const MODES: TimelineMode[] = ['explore', 'order', 'connect'];
const TIERS: TimelineTier[] = ['easy', 'medium', 'hard'];

// Seven events of the road to American independence. Links: Stamp Act → Tea Party → Intolerable Acts →
// Lexington and Concord → Declaration.
const EVENTS: TimelineEvent[] = [
  { id: 'e1', date: '1765', sortOrder: 1, title: 'The Stamp Act', description: 'Britain taxed printed paper in the colonies in 1765, and colonists protested.', clue: 'Colonists had to pay a new tax on newspapers and printed documents.', ledTo: 'e3', impact: 'It united the colonies in protest.' },
  { id: 'e2', date: 'March 5, 1770', sortOrder: 2, title: 'The Boston Massacre', description: 'British soldiers fired into a crowd, killing five colonists.', clue: 'Soldiers fired into an angry crowd on a snowy street.' },
  { id: 'e3', date: 'December 16, 1773', sortOrder: 3, title: 'The Boston Tea Party', description: 'Protesters dumped chests of tea into the harbor.', clue: 'Protesters dumped crates of a drink into the harbor at night.', ledTo: 'e4' },
  { id: 'e4', date: '1774', sortOrder: 4, title: 'The Intolerable Acts', description: 'Parliament closed the harbor and punished Massachusetts.', clue: 'Parliament closed a busy harbor to punish a whole colony.', ledTo: 'e5' },
  { id: 'e5', date: 'April 1775', sortOrder: 5, title: 'Lexington and Concord', description: 'The first battles of the war were fought.', clue: 'Minutemen and redcoats traded the first shots of the war.', ledTo: 'e6' },
  { id: 'e6', date: 'July 4, 1776', sortOrder: 6, title: 'The Declaration of Independence', description: 'The colonies declared themselves free of Britain.', clue: 'Leaders signed a paper saying the colonies were free.' },
  { id: 'e7', date: '1781', sortOrder: 7, title: 'Victory at Yorktown', description: 'The British army surrendered to Washington.', clue: 'A trapped British army gave up to Washington.' },
];
const deck = deckOf(EVENTS);
/** An item as the boss carries it (its mode and the events), and the lever set read on it with no pull. */
const chk = (i: TimelineItem, mode: TimelineMode) => asCheck(i, modeOfKind(i.kind, MODE_KINDS[mode]), EVENTS);
const leversOn = (i: TimelineItem, mode: TimelineMode, pulled: string[] = []) => TIMELINE_LEVERS.declare(chk(i, mode), { session: [] }, pulled);

const IDENTIFY: ChoiceItem = { id: 'identify-1', kind: 'identify', eventId: 'e3', options: ['e1', 'e3', 'e4', 'e6'] };
const IDENTIFY2: ChoiceItem = { id: 'identify-2', kind: 'identify', eventId: 'e5', options: ['e5', 'e2', 'e7'] };
const DATE: ChoiceItem = { id: 'date-1', kind: 'date', eventId: 'e4', options: ['e3', 'e4', 'e5', 'e7'] };
const ORDER: OrderItem = { id: 'order-1', kind: 'order', cards: ['e4', 'e1', 'e3', 'e2'] };
const LINK: LinkItem = { id: 'cause_effect-1', kind: 'cause_effect', causes: ['e1', 'e3', 'e5'], effects: ['e6', 'e3', 'e4'] };
const BY_MODE: Record<TimelineMode, TimelineItem[]> = { explore: [IDENTIFY, IDENTIFY2], order: [ORDER, IDENTIFY], connect: [LINK, DATE] };

const data = (mode: TimelineMode, items = BY_MODE[mode]): TimelineExplorerData => ({
  title: 'The Road to Independence', subtitle: 'From protest to a new nation', overview: 'Read how thirteen colonies broke away.',
  timeSpan: { start: '1765', end: '1781' }, events: EVENTS, summary: { text: 'Protest grew into war.', keyTheme: 'Independence' },
  challengeTypes: MODE_KINDS[mode], difficulty: 'medium', items,
});
const mount = (mode: TimelineMode, items = BY_MODE[mode]) => {
  const h = mountWorkspace({ primitiveId: 'timeline-explorer', evalMode: mode, instanceId: 'timeline-explorer', data: data(mode, items) as never });
  h.settle(1000);
  return h;
};
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1);
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.kind, l.pulled]);
const text = (h: WorkspaceHarness) => h.view.container.textContent ?? '';
const read = (h: WorkspaceHarness) => { EVENTS.forEach((_, i) => h.press(`Event ${i + 1}`)); h.press('Begin the questions'); h.settle(); };
const tap = (h: WorkspaceHarness, label: string) => { h.press(label); h.press(/Check Answer/); h.settle(); };
const reorder = (h: WorkspaceHarness, item: OrderItem, to: string[]) => { for (const l of movesTo(deck, item.cards, to)) h.press(l); h.press(/Check Order/); h.settle(); };
const match = (h: WorkspaceHarness, pairs: Record<string, string>) => {
  for (const [c, e] of Object.entries(pairs)) { h.press(`Cause: ${deck.byId.get(c)!.title}`); h.press(`Effect: ${deck.byId.get(e)!.title}`); }
  h.press(/Check Matches/); h.settle();
};
const flush = () => act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); });

it.each(MODES)('%s: reading first (not ready), then binds with its key out of the scene and off the screen', mode => {
  const h = mount(mode);
  const item = BY_MODE[mode][0];
  expect(getComponentById('timeline-explorer')!.evalModes!.map(m => m.evalMode)).toEqual(MODES);
  expect(h.state().owner).toBe('tutor');
  expect(seam.legacyAI).not.toHaveBeenCalled();
  expect(demand(h)).toMatchObject({ kind: 'reading', presentation: 'not ready' });
  expect(text(h)).not.toMatch(/Begin the questions/);
  read(h);
  expect(demand(h).presentation).toBe('ready');
  expect(h.state().task!.task).toBe(timelineExplorerBoss.assignment(chk(item, mode)).task);
  // The timeline is gone, no card shows a date, and nothing is marked or credited.
  expect(h.view.container.querySelector('[aria-label="Event 1"]')).toBeNull();
  expect(h.view.container.querySelector('[data-lever]')).toBeNull();
  expect(text(h)).not.toMatch(/Next Question|See Results|Correct!/);
  expect(JSON.stringify(demand(h))).not.toMatch(/answerShown/);
  if (item.kind === 'order' || item.kind === 'cause_effect') {
    expect(demand(h).response).toBe('gesture');
    expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
    for (const e of EVENTS) expect(text(h)).not.toContain(e.date);
  } else {
    expect(demand(h).response).toBe('speech');
    expect(h.state().task!.workspace!.expectedAnswer).toContain(`"${deck.byId.get(item.eventId)!.title}"`);
  }
  h.close();
});

it('explore: a wrong tap names its miss and closes the choices; Try again reopens; right, then spoken, submits once', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('explore');
  read(h);
  tap(h, 'The Intolerable Acts');
  expect(last(h)).toMatchObject({ correct: false, miss: 'adjacent_event' });
  expect(demand(h).learnerWork).toBe('Chose "The Intolerable Acts"');
  expect(demand(h).answerShown).toBeUndefined();
  expect(h.view.container.querySelector('button[aria-label="The Boston Tea Party"]')!.hasAttribute('disabled')).toBe(true);
  expect(nextLever(h.state().task!.workspace!.levers!, 'adjacent_event')).toBe(SHOW_TIMELINE_LEVER);
  h.dispatch('retry'); h.confirmVisible();
  expect(demand(h)).toMatchObject({ learnerWork: 'Nothing chosen yet' });
  tap(h, 'The Boston Tea Party');
  expect(last(h)).toMatchObject({ correct: true });
  expect(String(demand(h).answerShown)).toMatch(/December 16, 1773/);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('identify-2');
  h.say('Lexington and Concord'); await flush(); h.feedback('correct', 'advance'); h.confirmVisible(); h.settle(); await flush(); h.settle();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [, , metrics, work] = seam.submit.mock.calls[0];
  expect(metrics).toMatchObject({ type: 'timeline-explorer', eventsExplored: 7, totalEvents: 7 });
  expect(work.teachingAttempts.map((a: { correct: boolean; miss?: string }) => [a.correct, a.miss ?? null]))
    .toEqual([[false, 'adjacent_event'], [true, null], [true, null]]);
  h.close();
});

it('explore: show_timeline brings the strip back; two_choices opens another event and the full item comes back', () => {
  const h = mount('explore');
  read(h);
  expect(levers(h)).toEqual([[SHOW_TIMELINE_LEVER, 'help', false], [TWO_CHOICES_LEVER, 'simplify', false]]);
  const receipt = h.dispatch('pull_lever', { lever: SHOW_TIMELINE_LEVER });
  expect(receipt.status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="show-timeline"]')!.textContent).toMatch(/1773.*Boston Tea Party/);
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/Nothing marks the clue's event/);
  tap(h, 'The Boston Tea Party');
  expect(last(h)).toMatchObject({ correct: true, assisted: true, levers: [SHOW_TIMELINE_LEVER] });
  h.dispatch('advance'); h.confirmVisible();
  const step = h.dispatch('pull_lever', { lever: TWO_CHOICES_LEVER });
  expect(step.state.task).toMatchObject({ itemId: 'identify-2~simpler' });
  const practice = simplerItem(deck, IDENTIFY2, BY_MODE.explore) as ChoiceItem;
  expect(practice.eventId).not.toBe(IDENTIFY2.eventId);
  expect(h.view.container.querySelectorAll('button[aria-label]').length).toBeGreaterThanOrEqual(2);
  tap(h, deck.byId.get(practice.eventId)!.title);
  expect(last(h)).toMatchObject({ itemId: 'identify-2~simpler', correct: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: 'identify-2' });
  tap(h, 'Lexington and Concord');
  expect(last(h)).toMatchObject({ itemId: 'identify-2', correct: true });
  h.close();
});

it('order: Move presses and Check Order; a neighbour swap is named; read_cards and led_to draw; fewer_cards opens three other events', () => {
  const h = mount('order');
  read(h);
  expect(levers(h).map(([id]) => id)).toEqual([READ_CARDS_LEVER, LED_TO_LEVER, FEWER_CARDS_LEVER]);
  const key = orderKey(deck, ORDER);
  reorder(h, ORDER, [key[1], key[0], ...key.slice(2)]);
  expect(last(h)).toMatchObject({ correct: false, miss: 'adjacent_swap' });
  expect(h.view.container.querySelector(`button[aria-label="Move The Stamp Act up"]`)!.hasAttribute('disabled')).toBe(true);
  expect(h.dispatch('pull_lever', { lever: READ_CARDS_LEVER }).status).toBe('committed');
  const lines = Array.from(h.view.container.querySelectorAll('[data-lever="read-cards"]')).map(n => n.textContent ?? '');
  expect(lines.length).toBe(4);
  for (const l of lines) expect(l).not.toMatch(/\b1[67]\d\d\b/);
  expect(h.dispatch('pull_lever', { lever: LED_TO_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="led-to"]')!.textContent).toMatch(/The Stamp Act → led to → The Boston Tea Party/);
  h.dispatch('retry'); h.confirmVisible();
  expect(String(demand(h).learnerWork)).toMatch(/^Cards, top to bottom: 1\) The Intolerable Acts/);
  reorder(h, ORDER, key);
  expect(last(h)).toMatchObject({ correct: true, levers: [READ_CARDS_LEVER, LED_TO_LEVER] });
  h.close();

  const g = mount('order');
  read(g);
  const fewer = g.dispatch('pull_lever', { lever: FEWER_CARDS_LEVER });
  expect(fewer.state.task).toMatchObject({ itemId: 'order-1~simpler' });
  const practice = simplerItem(deck, ORDER) as OrderItem;
  expect(practice.cards.filter(c => ORDER.cards.includes(c)).length).toBeLessThanOrEqual(1);
  reorder(g, practice, orderKey(deck, practice));
  expect(last(g)).toMatchObject({ itemId: 'order-1~simpler', correct: true });
  g.close();
});

it('connect: matching is the check; a swapped pair is named; read_cards and show_dates draw; date levers', () => {
  const h = mount('connect');
  read(h);
  const key = { e1: 'e3', e3: 'e4', e5: 'e6' };
  match(h, { e1: 'e4', e3: 'e3', e5: 'e6' });
  expect(last(h)).toMatchObject({ correct: false, miss: 'pairs_swapped' });
  // The dates would decide every pair here, so show_dates is not offered.
  expect(levers(h).map(([id]) => id)).toEqual([READ_CARDS_LEVER]);
  expect(nextLever(h.state().task!.workspace!.levers!, 'pairs_swapped')).toBe(READ_CARDS_LEVER);
  expect(h.dispatch('pull_lever', { lever: READ_CARDS_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelectorAll('[data-lever="read-cards"]').length).toBeGreaterThan(0);
  h.dispatch('retry'); h.confirmVisible();
  expect(demand(h).learnerWork).toBe('No pair matched yet');
  match(h, key);
  expect(last(h)).toMatchObject({ correct: true });
  expect(String(demand(h).answerShown)).toMatch(/The Stamp Act led to The Boston Tea Party/);
  h.dispatch('advance'); h.confirmVisible();
  expect(levers(h).map(([id]) => id)).toEqual([BEFORE_AFTER_LEVER, DATE_LINE_LEVER, TWO_DATES_LEVER]);
  tap(h, '1781');
  expect(last(h)).toMatchObject({ correct: false, miss: 'distant_date' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'distant_date')).toBe(BEFORE_AFTER_LEVER);
  expect(h.dispatch('pull_lever', { lever: BEFORE_AFTER_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelector('[data-lever="before-after"]')!.textContent).toMatch(/Just before it: The Boston Tea Party\..*Just after it: Lexington and Concord/);
  expect(h.dispatch('pull_lever', { lever: DATE_LINE_LEVER }).status).toBe('committed');
  expect(String(demand(h).onScreen)).toMatch(/December 16, 1773, 1774, April 1775, 1781/);
  h.dispatch('retry'); h.confirmVisible();
  tap(h, '1774');
  expect(last(h)).toMatchObject({ correct: true, levers: [BEFORE_AFTER_LEVER, DATE_LINE_LEVER] });
  h.close();
});

describe('the pure rules', () => {
  const all = (mode: TimelineMode) => TIERS.flatMap(tier => [1, 2, 3].flatMap(seed =>
    buildTimelineItems({ events: EVENTS, kinds: MODE_KINDS[mode], tier, rng: seededRng(`${mode}${tier}${seed}`) }).map(i => ({ i, tier }))));

  it.each(MODES)('%s builds valid, keyed items of its kinds at every tier', mode => {
    for (const { i, tier } of all(mode)) {
      expect(validTimelineItem(deck, i), `${mode} ${tier} ${i.id}`).toBe(true);
      expect(MODE_KINDS[mode]).toContain(i.kind);
      if (i.kind === 'order') expect(i.cards).not.toEqual(orderKey(deck, i));
    }
    for (const tier of TIERS) expect(all(mode).filter(x => x.tier === tier).length).toBe(9);
  });

  it('the tiers are structural', () => {
    for (const mode of MODES) for (const { i, tier } of all(mode)) {
      const r = (id: string) => deck.rank.get(id)!;
      if (i.kind === 'identify' || i.kind === 'date') {
        expect(i.options.length).toBe(tier === 'easy' ? 3 : 4);
        const near = i.options.filter(o => Math.abs(r(o) - r(i.eventId)) === 1).length;
        if (tier === 'easy') expect(near).toBe(0);
        if (tier === 'hard') expect(near).toBeGreaterThanOrEqual(1);
      }
      if (i.kind === 'order') {
        expect(i.cards.length).toBe(tier === 'easy' ? 3 : tier === 'medium' ? 4 : 5);
        const ranks = orderKey(deck, i).map(r);
        if (tier === 'easy') expect(ranks.every((x, k) => k === 0 || x - ranks[k - 1] >= 2)).toBe(true);
        if (tier === 'hard') expect(ranks.every((x, k) => k === 0 || x - ranks[k - 1] === 1)).toBe(true);
      }
      if (i.kind === 'cause_effect') {
        expect(i.causes.length).toBe(tier === 'easy' ? 2 : 3);
        if (tier === 'hard') expect(i.effects.length).toBe(4);
      }
    }
  });

  it('every wrong answer names a catalog miss, and every miss an item can show is answered by a help lever first', () => {
    const entry = getComponentById('timeline-explorer')!;
    expect(entry.teachingWorkspace!.levers).toBe(true);
    for (const mode of MODES) {
      expect([...entry.teachingWorkspace!.misses![mode]].sort()).toEqual(MODE_KINDS[mode].flatMap(k => [...KIND_MISSES[k]]).sort());
      for (const { i } of all(mode)) {
        const ls = leversOn(i, mode);
        const misses = possibleMisses(deck, i, w => timelineMiss(deck, i, w));
        expect(misses.length, i.id).toBeGreaterThan(0);
        for (const m of misses) {
          expect(KIND_MISSES[i.kind]).toContain(m);
          expect(ls.find(l => l.id === nextLever(ls, m))?.kind, `${i.id} ${m}`).toBe('help');
        }
        const a = timelineHarnessAnswers(deck, i);
        expect(timelineCorrect(deck, i, a.correct), i.id).toBe(true);
        expect(timelineCorrect(deck, i, a.plainWrong), i.id).toBe(false);
        expect(timelineMiss(deck, i, a.plainWrong), i.id).toBeDefined();
      }
    }
  });

  it('no lever line says the key', () => {
    for (const mode of MODES) for (const { i } of all(mode)) {
      if (i.kind === 'identify' || i.kind === 'date') {
        // The card never says an event is the first or the last: that picks the earliest or latest date choice.
        if (i.kind === 'date') for (const l of beforeAfterLines(deck, i)) { expect(choiceLineLeaks(deck, i, l), l).toBe(false); expect(l).not.toMatch(/nothing|first|last/i); }
        if (i.kind === 'identify') expect(clueLeaks(deck, i.eventId)).toBe(false);
      }
      if (i.kind === 'order') {
        for (const l of Object.values(cardLines(deck, i))) expect(l).not.toMatch(/\b\d{3,4}\b/);
        expect(linksLeaveDoubt(i, ledToArrows(deck, i))).toBe(true);
      }
      if (i.kind === 'cause_effect') {
        for (const l of Object.values(cardLines(deck, i))) expect(l).not.toMatch(/\b\d{3,4}\b/);
        if (leversOn(i, mode).some(l => l.id === SHOW_DATES_LEVER)) expect(datesLeaveDoubt(deck, i)).toBe(true);
      }
      expect(TIMELINE_LEVERS.onScreen(chk(i, mode), { session: [] }, leversOn(i, mode).filter(l => l.kind === 'help').map(l => l.id))).not.toMatch(/answer|correct/i);
    }
  });

  it('the simpler item stays in its kind, never repeats the key, and never shrinks twice', () => {
    for (const mode of MODES) for (const { i } of all(mode)) {
      const s = simplerItem(deck, i);
      if (!s) continue;
      expect(s.kind).toBe(i.kind);
      expect(simplerItem(deck, s)).toBeNull();
      expect(leversOn(s, mode)).toEqual([]);
      if ((s.kind === 'identify' || s.kind === 'date') && (i.kind === 'identify' || i.kind === 'date')) {
        expect(s.eventId).not.toBe(i.eventId);
        expect(s.options).toHaveLength(2);
      }
      if (s.kind === 'order' && i.kind === 'order') expect(s.cards.filter(c => i.cards.includes(c)).length).toBeLessThanOrEqual(1);
      if (s.kind === 'cause_effect' && i.kind === 'cause_effect') expect(s.causes.some(c => i.causes.includes(c) || i.effects.includes(c))).toBe(false);
      expect(validTimelineItem(deck, { ...s, id: 'x' })).toBe(true);
    }
  });

  it('clues and cards: a clue naming its title or date is not asked; dates are taken out of card lines', () => {
    const leaky = deckOf([...EVENTS.slice(0, 6), { ...EVENTS[6], clue: 'In 1781 the war ended at Yorktown.' }]);
    expect(clueLeaks(leaky, 'e7')).toBe(true);
    expect(clueLeaks(deck, 'e3')).toBe(false);
    expect(redactDates('On July 4, 1776, in the 18th century, leaders met in 1770s Philadelphia.')).not.toMatch(/\d|July/);
    expect(linksOf(deck)).toEqual([['e1', 'e3'], ['e3', 'e4'], ['e4', 'e5'], ['e5', 'e6']]);
  });

  it('a legacy lesson (model-written challenges) still builds code items in its kinds', () => {
    const legacy = { title: 'Revolution', events: EVENTS.map(({ clue, ledTo, ...e }) => e), challenges: [{ type: 'order' }, { type: 'date' }] };
    const items = timelineItems(legacy);
    expect(new Set(items.map(i => i.kind))).toEqual(new Set(['order', 'date']));
    expect(timelineItems(legacy)).toEqual(items);
    expect(emptyWork(ORDER).order).toEqual(ORDER.cards);
  });
});
