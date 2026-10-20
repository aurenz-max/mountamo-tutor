/**
 * cause-effect-chain's domain (`causeEffectChainDomain.ts`): the build gates the generator shares, the session
 * shape, the ask (never its answer), the spoken key, the known misses and the board's own check. Moved from the
 * retired DI pack's gate (`__tests__/CauseEffectChain.di-script.test.ts`) and the workspace module's test when the
 * family moved onto its boss; the scripted cue, correction and tier lead-in assertions went with the script.
 */
import { describe, it, expect } from 'vitest';
import { askLeaks, spokenKeyText } from '../../../components/live-activity/spokenKey';
import {
  askFor,
  askGiven,
  cardSpeakable,
  causeEffectKey,
  causeEffectSpokenMisses,
  chainEarSeparable,
  chainMiss,
  CHAIN_KINDS,
  correctChoiceOf,
  itemsFromChallenge,
  itemsFromChallenges,
  type BuildChainItem,
  type CauseEffectChainItem,
  type ChainChallengeLike,
  type ChainSessionLike,
  type ChainTier,
} from './causeEffectChainDomain';
import {
  assignModes,
  buildChallenge,
  validateResponse,
  type BuiltChallenge,
  type RawChallenge,
} from '../../../service/history/gemini-cause-effect-chain';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SESSION: ChainSessionLike = { periodLabel: 'the 1800s West', gradeLevel: '3' };
const YOUNG: ChainSessionLike = { periodLabel: 'the 1800s West', gradeLevel: '1' };

const node = (id: string, text: string, category = 'social') => ({ id, text, category, icon: '👥' });

/** A chain whose page order is provably NOT the answer order. */
const town = (n: number, over: Partial<ChainChallengeLike> = {}): ChainChallengeLike => ({
  id: `cec-${n}`,
  type: 'build_chain',
  outcome: node(`cec-${n}-outcome`, 'A busy town grows up where the tracks cross the river'),
  nodes: [
    node(`cec-${n}-2`, 'Trains carry crops and cattle to city markets in a few days', 'economic'),
    node(`cec-${n}-3`, 'Storekeepers and blacksmiths open shops beside the station', 'economic'),
    node(`cec-${n}-1`, 'Engineers build a railroad line across the open plains', 'technological'),
  ],
  correctOrder: [`cec-${n}-1`, `cec-${n}-2`, `cec-${n}-3`],
  explanation: 'The tracks came before the trade, and the trade came before the shops.',
  ...over,
});

/** A second, DIFFERENT chain — the generator refuses duplicate outcomes, so
 *  two consecutive chains in a real draw never read the same. */
const news = (n: number, over: Partial<ChainChallengeLike> = {}): ChainChallengeLike => ({
  id: `cec-${n}`,
  type: 'build_chain',
  outcome: node(`cec-${n}-outcome`, 'Letters reach the far side of the country in a single day'),
  nodes: [
    node(`cec-${n}-3`, 'Post offices hire operators to pass on urgent news', 'economic'),
    node(`cec-${n}-1`, 'Workers string wire along poles from town to town', 'technological'),
    node(`cec-${n}-2`, 'Messages travel the wire as clicks an operator can read', 'technological'),
  ],
  correctOrder: [`cec-${n}-1`, `cec-${n}-2`, `cec-${n}-3`],
  explanation: 'The wire had to exist before a message could run along it.',
  ...over,
});

const chain = town;

/** A chain with its two non-causes on the page — the identify shape. */
const identify = (n: number, base: (n: number, o?: Partial<ChainChallengeLike>) => ChainChallengeLike = town): ChainChallengeLike => {
  const b = base(n, { type: 'identify_cause' });
  const consequence = base === town
    ? 'The town council hires a teacher for the new schoolhouse'
    : 'Newspapers print the same story in cities a thousand miles apart';
  const background = base === town
    ? 'Tall grass covers the plains for miles in every direction'
    : 'Most families keep a horse and a wagon in the barn';
  return {
    ...b,
    nodes: [
      b.nodes[0],
      node(`cec-${n}-d2`, background),
      b.nodes[1],
      node(`cec-${n}-d1`, consequence, 'political'),
      b.nodes[2],
    ],
  };
};

const school = (n: number, over: Partial<ChainChallengeLike> = {}): ChainChallengeLike => ({
  id: `cec-${n}`,
  type: 'root_vs_proximate',
  ask: 'root',
  outcome: node(`cec-${n}-outcome`, 'Children spend their days in a schoolhouse instead of the fields'),
  nodes: [
    node(`cec-${n}-3`, 'Lawmakers require every child to attend school', 'political'),
    node(`cec-${n}-1`, 'New machines do the heaviest work on the farm', 'technological'),
    node(`cec-${n}-2`, 'Families need fewer hands to bring in the harvest', 'economic'),
  ],
  correctOrder: [`cec-${n}-1`, `cec-${n}-2`, `cec-${n}-3`],
  explanation: 'Machines freed the children from farm work, and only then could a school law be followed.',
  ...over,
});

const west = (n: number, over: Partial<ChainChallengeLike> = {}): ChainChallengeLike => ({
  id: `cec-${n}`,
  type: 'root_vs_proximate',
  ask: 'proximate',
  outcome: node(`cec-${n}-outcome`, 'Families pack wagons and move west together'),
  nodes: [
    node(`cec-${n}-2`, 'Newspapers print stories of good farmland out west', 'social'),
    node(`cec-${n}-3`, 'Neighbors gather into wagon trains for the journey', 'social'),
    node(`cec-${n}-1`, 'Explorers map a route through the mountain passes', 'technological'),
  ],
  correctOrder: [`cec-${n}-1`, `cec-${n}-2`, `cec-${n}-3`],
  explanation: 'A route had to be found before anyone could describe the land.',
  ...over,
});

/**
 * A REAL SESSION SHAPE, deliberately INTERLEAVED the way a mixed draw arrives.
 * A pre-grouped fixture makes the defect-13 assertion vacuous.
 */
const CHALLENGES: ChainChallengeLike[] = [
  town(1),
  identify(2),
  school(3, { ask: 'root' }),
  news(4),
  identify(5, news),
  west(6, { ask: 'proximate' }),
];

const buildItems = (tier: ChainTier = 'medium', session = SESSION, maxItems?: number) =>
  itemsFromChallenges(CHALLENGES, session, { tier, maxItems });

describe('answer-leak discipline', () => {
  it('a reader\'s root ask never carries the answer card', () => {
    for (const item of buildItems()) {
      if (item.kind !== 'root_vs_proximate') continue;
      const ask = askFor(item);
      expect(ask).not.toContain(correctChoiceOf(item).card.text);
      expect(ask).toContain('The events are on the cards.');
    }
  });

  it('a young reader hears every card in page order — never the answer order', () => {
    for (const item of buildItems('medium', YOUNG)) {
      if (item.kind === 'identify_cause') continue;
      const ask = askFor(item);
      const positions = item.cards.map((c) => ask.indexOf(c.text));
      expect(positions.every((p) => p >= 0)).toBe(true);
      const readOrder = [...item.cards].sort((a, b) => ask.indexOf(a.text) - ask.indexOf(b.text)).map((c) => c.id);
      const answer = item.kind === 'build_chain' ? item.correctOrder : item.correctOrder;
      expect(readOrder).not.toEqual(answer);
    }
  });

  it('an identify ask states the ending and ONE card, and never its role', () => {
    for (const item of buildItems()) {
      if (item.kind !== 'identify_cause') continue;
      const ask = askFor(item);
      expect(ask).toContain(item.outcome.text);
      expect(ask).toContain(item.card.text);
      for (const other of item.cards) {
        if (other.id !== item.card.id) expect(ask).not.toContain(other.text);
      }
      expect(ask.toLowerCase()).not.toMatch(/not a cause|is a cause|came after|true at the time/);
    }
  });
});

// ---------------------------------------------------------------------------
// Build gates — keep-or-drop, never backfill (and the generator's copy)
// ---------------------------------------------------------------------------

describe('build gates', () => {
  it('drops a page carrying a card that cannot be read aloud', () => {
    expect(cardSpeakable('Yes, the trains came through the valley')).toBe(false);
    expect(cardSpeakable('Settlers call it the "iron horse" for years')).toBe(false);
    expect(cardSpeakable('Rains come')).toBe(false);
    const quoted = chain(9, { nodes: [
      node('cec-9-2', 'Trains carry crops and cattle to city markets in a few days'),
      node('cec-9-3', 'Storekeepers call the platform the "front porch" of town'),
      node('cec-9-1', 'Engineers build a railroad line across the open plains'),
    ] });
    expect(itemsFromChallenge(quoted, SESSION)).toEqual([]);
    const sentinel = chain(9, { outcome: node('cec-9-outcome', 'Yes, a busy town grows where the tracks cross') });
    expect(itemsFromChallenge(sentinel, SESSION)).toEqual([]);
  });

  it('drops a spoken pick whose cards are not separable by ear — the generator refuses the same chain', () => {
    const muddled = [
      'Workers lay tracks across the plains',
      'Workers lay tracks across the plains and hills',
      'Hills rise across the plains',
    ];
    expect(chainEarSeparable(muddled)).toBe(false);
    expect(chainEarSeparable(chain(1).nodes.map((n) => n.text))).toBe(true);
    const inseparable = school(9, { nodes: [
      node('cec-9-2', muddled[1]), node('cec-9-3', muddled[2]), node('cec-9-1', muddled[0]),
    ] });
    expect(itemsFromChallenge(inseparable, SESSION)).toEqual([]);
    // Generator side: the SAME chain is never STAMPED with the spoken pick.
    const built: BuiltChallenge = {
      challenge: { ...inseparable, type: 'build_chain', chainTheme: 'tracks', explanation: 'x', outcome: { ...inseparable.outcome, category: 'social', icon: '👥' }, nodes: inseparable.nodes.map((n) => ({ ...n, category: 'social' as const, icon: '👥' })) },
      distractors: [],
    };
    const stamped = assignModes([built, built, built], ['root_vs_proximate', 'build_chain']);
    expect(stamped.every((c) => c.type === 'build_chain')).toBe(true);
  });

  it('a session PINNED to the spoken pick fails rather than substituting a rung', () => {
    const raw = {
      title: 'T', description: 'D', context: 'Wide plains.', periodLabel: 'the West',
      challenges: [1, 2, 3].map((i) => ({
        chainTheme: `theme ${i}`, outcome: `Outcome number ${['one', 'two', 'three'][i - 1]} happens on the plains`, outcomeCategory: 'social',
        cause0Text: `Workers lay ${['tracks', 'rails', 'ties'][i - 1]} across the plains`, cause0Category: 'technological',
        cause1Text: `Workers lay ${['tracks', 'rails', 'ties'][i - 1]} across the plains and hills`, cause1Category: 'economic',
        cause2Text: 'Hills rise across the plains', cause2Category: 'social',
        explanation: 'because', hint: 'look',
      })),
    };
    expect(validateResponse(raw, '3', 3, ['root_vs_proximate'])).toBeNull();
  });

  it('the generator rejects a card it could not read aloud, from the SAME predicate', () => {
    const raw: RawChallenge = {
      chainTheme: 'town', outcome: 'A town grows by the river', outcomeCategory: 'social',
      cause0Text: 'Yes, engineers build a railroad line', cause0Category: 'technological',
      cause1Text: 'Trains carry crops to market', cause1Category: 'economic',
      cause2Text: 'Shops open beside the station', cause2Category: 'economic',
      explanation: 'x', hint: 'y',
    };
    const built = buildChallenge(raw, 0, 3);
    expect('reject' in built && built.reject).toMatch(/not speakable/);
  });

  it('drops an identify page with no non-cause on it, and a chain page with one', () => {
    expect(itemsFromChallenge(chain(9, { type: 'identify_cause' }), SESSION)).toEqual([]);
    const stray = { ...identify(9), type: 'build_chain' };
    expect(itemsFromChallenge(stray, SESSION)).toEqual([]);
    const strayPick = { ...identify(9), type: 'root_vs_proximate' };
    expect(itemsFromChallenge(strayPick, SESSION)).toEqual([]);
  });

  it('drops a two-card pick and a key that names a card not on the page', () => {
    const two = school(9, { nodes: school(9).nodes.slice(0, 2), correctOrder: ['cec-9-3', 'cec-9-1'] });
    expect(itemsFromChallenge(two, SESSION)).toEqual([]);
    expect(itemsFromChallenge(chain(9, { correctOrder: ['cec-9-1', 'cec-9-2', 'ghost'] }), SESSION)).toEqual([]);
  });

});

// ---------------------------------------------------------------------------
// Session shape — defects 1, 2 and 13
// ---------------------------------------------------------------------------

describe('session shape', () => {
  it('ships the modes as RUNS in ladder order (defect 13)', () => {
    const kinds = buildItems().map((i) => i.kind);
    const firstIndex = CHAIN_KINDS.map((k) => kinds.indexOf(k)).filter((i) => i >= 0);
    expect(firstIndex).toEqual([...firstIndex].sort((a, b) => a - b));
    for (const kind of CHAIN_KINDS) {
      const idx = kinds.map((k, i) => (k === kind ? i : -1)).filter((i) => i >= 0);
      if (idx.length < 2) continue;
      expect(idx[idx.length - 1] - idx[0]).toBe(idx.length - 1);
    }
  });

  it('an identify challenge expands into a balanced run of one ask per card (defect 1)', () => {
    const run = itemsFromChallenge(identify(2), SESSION);
    expect(run).toHaveLength(4);
    const yes = run.filter((i) => i.kind === 'identify_cause' && i.isCause).length;
    expect(yes).toBe(2);
    // Each card asked once; the two non-causes are both asked.
    expect(new Set(run.map((i) => i.kind === 'identify_cause' ? i.card.id : '')).size).toBe(4);
    expect(run.some((i) => i.kind === 'identify_cause' && i.role === 'consequence')).toBe(true);
    expect(run.some((i) => i.kind === 'identify_cause' && i.role === 'background')).toBe(true);
    // Page order, so the run reads the screen top to bottom.
    const page = identify(2).nodes.map((n) => n.id);
    const asked = run.map((i) => (i.kind === 'identify_cause' ? i.card.id : ''));
    expect([...asked].sort((a, b) => page.indexOf(a) - page.indexOf(b))).toEqual(asked);
  });

  it('the first ask of a run states the ending in full; later asks say "same ending"', () => {
    const run = buildItems().filter((i) => i.kind === 'identify_cause');
    expect(askFor(run[0])).toContain('In the end:');
    expect(askFor(run[1])).toContain('Same ending:');
  });

  it('under the cap every mode present keeps its first unit — coverage before depth', () => {
    const items = buildItems('medium', SESSION, 6);
    expect(items).toHaveLength(6);
    for (const kind of CHAIN_KINDS) expect(items.some((i) => i.kind === kind)).toBe(true);
    // A cap too small for a whole identify unit ships balanced PAIRS, not a slice.
    const tight = buildItems('medium', SESSION, 4);
    const ids = tight.filter((i) => i.kind === 'identify_cause');
    expect(ids.length).toBe(2);
    expect(ids.filter((i) => i.kind === 'identify_cause' && i.isCause).length).toBe(1);
    expect(ids.every((i) => i.kind === 'identify_cause' && i.runSize === 2)).toBe(true);
  });

  it('every challenge serves exactly one rung, so no answer is asked twice (defect 2)', () => {
    const items = buildItems();
    const spokenAnswers = items.map((i) => (i.kind === 'root_vs_proximate' ? correctChoiceOf(i).card.id : i.id));
    expect(new Set(spokenAnswers).size).toBe(spokenAnswers.length);
  });
});

// ---------------------------------------------------------------------------
// The spoken key
// ---------------------------------------------------------------------------

describe('the spoken key', () => {
  it.each([['a reader', SESSION], ['a young reader', YOUNG]] as const)('%s: no ask says its answer; a chain has no key', (_n, session) => {
    for (const item of buildItems('medium', session)) {
      const key = causeEffectKey(item);
      if (item.kind === 'build_chain') { expect(key).toBeNull(); continue; }
      expect(askLeaks(askFor(item), key!, askGiven(item))).toEqual([]);
    }
  });

  it('identify: a yes/no menu the ask says, the verdict, and why', () => {
    for (const item of buildItems().filter((i) => i.kind === 'identify_cause')) {
      if (item.kind !== 'identify_cause') continue;
      const key = causeEffectKey(item)!;
      expect(key.menu).toEqual(['yes', 'no']);
      expect(key.answer).toBe(item.isCause ? 'yes' : 'no');
      expect(spokenKeyText(key)).toContain(item.card.text.replace(/\.$/, ''));
    }
  });

  it('root: the card, its own words and its place; never a word the ask itself says', () => {
    const item = itemsFromChallenge(school(3), SESSION)[0];
    if (item.kind !== 'root_vs_proximate') throw new Error('shape');
    const key = causeEffectKey(item)!;
    expect(key.answer).toBe(correctChoiceOf(item).card.text.replace(/\.$/, ''));
    expect(key.alsoAccept).toContain(correctChoiceOf(item).distinguisher);
    expect(key.alsoAccept).toContain(['the first one', 'the second one', 'the third one'][item.correctIndex]);
    // A card's own word the ending also says ("schoolhouse" / "school") picks no card: it is not a short form.
    const echo = itemsFromChallenge(school(4, { nodes: [
      node('cec-4-3', 'Lawmakers require every child to attend a schoolhouse', 'political'),
      node('cec-4-1', 'New machines do the heaviest work on the farm', 'technological'),
      node('cec-4-2', 'Families need fewer hands to bring in the harvest', 'economic'),
    ], ask: 'proximate' }), SESSION)[0];
    const echoKey = causeEffectKey(echo)!;
    expect(echoKey.alsoAccept).not.toContain('schoolhouse');
    expect(askLeaks(askFor(echo), echoKey)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Known misses and the board's own check
// ---------------------------------------------------------------------------

describe('misses', () => {
  const board = { id: 'c', kind: 'build_chain', correctOrder: ['a', 'b', 'c', 'd'] } as BuildChainItem;
  it.each([
    [['a', 'b', 'c', 'd'], undefined], [['d', 'c', 'b', 'a'], 'reversed'], [['b', 'a', 'c', 'd'], 'two_swapped'],
    [['a', 'd', 'c', 'b'], 'two_swapped'], [['b', 'c', 'a', 'd'], 'other_order'], [['a', 'b', null, 'd'], 'other_order'],
  ] as const)('chainMiss %j', (placed, miss) => {
    expect(chainMiss(board, placed)).toBe(miss);
  });

  // identify_cause's known wrong verdict, by the event's role (handoff 20 Part B); never an answer the key accepts.
  it('identify: one miss per role, never an accepted answer', () => {
    for (const item of buildItems().filter((i) => i.kind === 'identify_cause')) {
      if (item.kind !== 'identify_cause') continue;
      const misses = causeEffectSpokenMisses(item);
      expect(misses.map((m) => m.id)).toEqual([item.isCause ? 'cause_denied'
        : item.role === 'consequence' ? 'consequence_as_cause' : 'background_as_cause']);
      const key = causeEffectKey(item)!;
      const ok = [key.answer, ...key.alsoAccept].map((a) => a.toLowerCase());
      for (const m of misses) for (const e of m.examples ?? []) expect(ok).not.toContain(e.toLowerCase());
    }
  });

  it('a chain has no spoken miss', () => {
    expect(causeEffectSpokenMisses(board as unknown as CauseEffectChainItem)).toEqual([]);
  });
});
