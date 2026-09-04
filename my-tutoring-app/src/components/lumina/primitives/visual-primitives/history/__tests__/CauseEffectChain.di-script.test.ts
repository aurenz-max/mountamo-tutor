/**
 * cause-effect-chain — the judged DI pack's gate (port 25, second history port).
 *
 * The click era had no component suite (its 27-test audit gate lives with the
 * generator and still runs). What this file pins is the judged surface:
 *
 *   the split          identify_cause = spoken yes/no per card, build_chain =
 *                      hands, root_vs_proximate = spoken pick — both directions
 *   the leaks          no spoken ask carries its own answer outside the spans
 *                      the mats rule exempts
 *   the build gates    keep-or-drop, never backfill — and the SAME predicates
 *                      the generator imports
 *   the session shape  runs in ladder order (defect 13), balanced yes/no runs,
 *                      coverage before depth under the cap
 *   the tier           the lead-in ladder is the spoken lever (re-based L3)
 *   the hands close    `chainVerdictCue` computes the match in code
 */
import { describe, it, expect } from 'vitest';
import {
  checkDiCatalogEntry,
  checkPackGates,
  type DiCatalogEntryLike,
} from '../../../../hooks/judgedScriptContract.testkit';
import {
  spokenSpanOf,
  spokenSpansOf,
  type JudgedScriptPack,
} from '../../../../hooks/judgedScriptContract';
import { HISTORY_CATALOG } from '../../../../service/manifest/catalog/history';
import {
  answerKindFor,
  cardSpeakable,
  causeEffectChainHarnessAnswers,
  causeEffectChainPackBase,
  chainEarSeparable,
  chainVerdictCue,
  CHAIN_KINDS,
  contextCue,
  correctChoiceOf,
  guideLineFor,
  itemsFromChallenge,
  itemsFromChallenges,
  leadInFor,
  modelLineFor,
  responseClassFor,
  stimulusFor,
  type CauseEffectChainItem,
  type ChainChallengeLike,
  type ChainSessionLike,
  type ChainTier,
} from '../causeEffectChainScript';
import {
  assignModes,
  buildChallenge,
  validateResponse,
  type BuiltChallenge,
  type RawChallenge,
} from '../../../../service/history/gemini-cause-effect-chain';

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

const buildPack = (tier: ChainTier = 'medium', session = SESSION): JudgedScriptPack<CauseEffectChainItem> =>
  causeEffectChainPackBase(buildItems(tier, session)) as JudgedScriptPack<CauseEffectChainItem>;

const CATALOG = HISTORY_CATALOG.find((c) => c.id === 'cause-effect-chain') as unknown as DiCatalogEntryLike;

const plainAsk = (pack: JudgedScriptPack<CauseEffectChainItem>, item: CauseEffectChainItem) =>
  spokenSpanOf(pack.itemCue(item, { opening: false, howToPlay: false }));

// ---------------------------------------------------------------------------
// The shared gates
// ---------------------------------------------------------------------------

describe('cause-effect-chain pack gates', () => {
  it('builds a real session and passes every structural gate', () => {
    const pack = buildPack();
    // 2 identify units of 4 (2 causes + 2 non-causes), 2 chains, 2 picks = 12,
    // capped at 10 round-robin with room held for the other modes: identify
    // 4 + 2 (a balanced pair), chain 2, pick 2.
    expect(pack.items.length).toBe(10);
    expect(pack.items.filter((i) => i.kind === 'identify_cause')).toHaveLength(6);
    expect(pack.items.filter((i) => i.kind === 'build_chain')).toHaveLength(2);
    expect(pack.items.filter((i) => i.kind === 'root_vs_proximate')).toHaveLength(2);
    expect(checkPackGates(pack)).toEqual([]);
  });

  it('passes the gates at every tier and at both reading bands', () => {
    for (const tier of ['easy', 'medium', 'hard'] as ChainTier[]) {
      expect(checkPackGates(buildPack(tier))).toEqual([]);
      expect(checkPackGates(buildPack(tier, YOUNG))).toEqual([]);
    }
  });

  it('matches its catalog entry', () => {
    const pack = buildPack();
    expect(checkDiCatalogEntry(CATALOG, pack, pack.items[0])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The answer-material fork — pinned in BOTH directions
// ---------------------------------------------------------------------------

describe('the split (standing gate 1)', () => {
  it('identify_cause and root_vs_proximate are spoken; build_chain is hands', () => {
    expect(answerKindFor('identify_cause')).toBe('voice');
    expect(answerKindFor('root_vs_proximate')).toBe('voice');
    expect(answerKindFor('build_chain')).toBe('gesture');
    expect(responseClassFor('identify_cause')).toBe('yes_no');
    expect(responseClassFor('root_vs_proximate')).toBe('closed_set_choice');
    expect(responseClassFor('build_chain')).toBe('manipulation');
    for (const item of buildItems()) {
      expect(item.answerKind).toBe(answerKindFor(item.kind));
      expect(item.responseClass).toBe(responseClassFor(item.kind));
    }
  });

  it('a spoken item carries both verdict lines and is never told to ignore the microphone', () => {
    const pack = buildPack();
    for (const item of pack.items.filter((i) => i.answerKind === 'voice')) {
      const cue = pack.itemCue(item, { opening: false, howToPlay: false });
      const spans = spokenSpansOf(cue);
      expect(spans, item.id).toHaveLength(3);
      expect(spans[1].startsWith('Yes,')).toBe(true);
      expect(spans[2].startsWith('My turn:')).toBe(true);
      expect(cue).toContain('If the answer is right');
      expect(cue).not.toMatch(/stay completely silent/);
    }
  });

  it('a hands item carries the silence contract and no spoken verdict', () => {
    const pack = buildPack();
    for (const item of pack.items.filter((i) => i.answerKind === 'gesture')) {
      const cue = pack.itemCue(item, { opening: false, howToPlay: false });
      expect(spokenSpansOf(cue)).toHaveLength(1);
      expect(cue).toContain('answers with their HANDS');
      expect(cue).not.toContain('If the answer is right');
    }
  });

  it('the hands close is computed in CODE — the tutor is handed its line', () => {
    const item = buildItems().find((i) => i.kind === 'build_chain')!;
    if (item.kind !== 'build_chain') throw new Error('shape');
    const right = chainVerdictCue(item, item.correctOrder.join(','));
    const wrong = chainVerdictCue(item, [...item.correctOrder].reverse().join(','));
    expect(right).toContain('MATCHES');
    expect(spokenSpanOf(right).startsWith('Yes,')).toBe(true);
    expect(wrong).toContain('does NOT match');
    expect(spokenSpanOf(wrong).startsWith('My turn:')).toBe(true);
    // Neither branch names a card or a slot.
    for (const cue of [right, wrong]) {
      for (const card of item.cards) expect(cue).not.toContain(card.text);
    }
    // A short chain is not a match even if its prefix is right.
    expect(chainVerdictCue(item, item.correctOrder.slice(0, 2).join(','))).toContain('does NOT match');
  });
});

// ---------------------------------------------------------------------------
// Leaks — the ask never hands over its own answer
// ---------------------------------------------------------------------------

describe('answer-leak discipline', () => {
  it('a reader\'s root ask never carries the answer card', () => {
    const pack = buildPack();
    for (const item of pack.items) {
      if (item.kind !== 'root_vs_proximate') continue;
      const ask = plainAsk(pack, item);
      expect(ask).not.toContain(correctChoiceOf(item).card.text);
      expect(ask).toContain('The events are on the cards.');
    }
  });

  it('a young reader hears every card in page order — never the answer order', () => {
    const pack = buildPack('medium', YOUNG);
    for (const item of pack.items) {
      if (item.kind === 'identify_cause') continue;
      const ask = plainAsk(pack, item);
      const positions = item.cards.map((c) => ask.indexOf(c.text));
      expect(positions.every((p) => p >= 0)).toBe(true);
      const readOrder = [...item.cards].sort((a, b) => ask.indexOf(a.text) - ask.indexOf(b.text)).map((c) => c.id);
      const answer = item.kind === 'build_chain' ? item.correctOrder : item.correctOrder;
      expect(readOrder).not.toEqual(answer);
    }
  });

  it('an identify ask states the ending and ONE card, and never its role', () => {
    const pack = buildPack();
    for (const item of pack.items) {
      if (item.kind !== 'identify_cause') continue;
      const ask = plainAsk(pack, item);
      expect(ask).toContain(item.outcome.text);
      expect(ask).toContain(item.card.text);
      for (const other of item.cards) {
        if (other.id !== item.card.id) expect(ask).not.toContain(other.text);
      }
      expect(ask.toLowerCase()).not.toMatch(/not a cause|is a cause|came after|true at the time/);
    }
  });

  it('the correction re-models the rule and re-elicits without landing the answer', () => {
    const pack = buildPack();
    for (const item of pack.items.filter((i) => i.answerKind === 'voice')) {
      const [, , correction] = spokenSpansOf(pack.itemCue(item, { opening: false, howToPlay: false }));
      expect(correction).toContain(modelLineFor(item));
      if (item.kind === 'root_vs_proximate') {
        expect(correction).not.toContain(correctChoiceOf(item).card.text);
      } else if (item.kind === 'identify_cause') {
        expect(correction.toLowerCase()).not.toMatch(/the answer is|say yes|say no/);
      }
    }
  });

  it('the printed teaching note never reaches a spoken line', () => {
    const pack = buildPack();
    for (const item of pack.items) {
      if (!item.explanation) continue;
      const spoken = spokenSpansOf(pack.itemCue(item, { opening: true, howToPlay: true })).join(' ');
      expect(spoken).not.toContain(item.explanation);
    }
  });

  it('the context stimulus names no card, no order and no count', () => {
    for (const item of buildItems()) {
      const stimulus = stimulusFor(item).toLowerCase();
      for (const card of item.cards) expect(stimulus).not.toContain(card.text.toLowerCase());
      expect(stimulus).not.toMatch(/\b(first|last|root|three|four)\b/);
    }
  });

  it('the move-on close names the answer — and nowhere before it', () => {
    const pack = buildPack();
    const root = pack.items.find((i) => i.kind === 'root_vs_proximate')!;
    const close = spokenSpanOf(pack.moveOnCue(root, null, { opening: false, howToPlay: false }));
    if (root.kind !== 'root_vs_proximate') throw new Error('shape');
    expect(close).toContain(correctChoiceOf(root).card.text);
    const build = pack.items.find((i) => i.kind === 'build_chain')!;
    if (build.kind !== 'build_chain') throw new Error('shape');
    const chainClose = spokenSpanOf(pack.moveOnCue(build, null, { opening: false, howToPlay: false }));
    const byId = new Map(build.cards.map((c) => [c.id, c.text.replace(/\.$/, '')]));
    const order = build.correctOrder.map((id) => chainClose.indexOf(byId.get(id)!));
    expect(order).toEqual([...order].sort((a, b) => a - b));
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

  it('the background read-aloud refuses a paragraph it cannot safely speak', () => {
    expect(contextCue('Yes, the West was wide.')).toBeNull();
    expect(contextCue('They called it the "iron road".')).toBeNull();
    expect(contextCue('')).toBeNull();
    const cue = contextCue('Towns appeared where there had been open grass.')!;
    expect(spokenSpanOf(cue)).toBe('Towns appeared where there had been open grass.');
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
    const pack = buildPack();
    const run = pack.items.filter((i) => i.kind === 'identify_cause');
    expect(plainAsk(pack, run[0])).toContain('In the end:');
    expect(plainAsk(pack, run[1])).toContain('Same ending:');
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
// The tier — RE-BASED from the deleted render levers
// ---------------------------------------------------------------------------

describe('support tier (re-based: the lead-in ladder is the spoken lever)', () => {
  const first = (tier: ChainTier) => buildItems(tier)[0];

  it('easy speaks the model AND the historian move; medium the model only; hard nothing', () => {
    expect(leadInFor(first('easy'))).toContain(guideLineFor(first('easy')));
    expect(leadInFor(first('easy'))).toContain(modelLineFor(first('easy')));
    expect(leadInFor(first('medium'))).toContain(modelLineFor(first('medium')));
    expect(leadInFor(first('medium'))).not.toContain(guideLineFor(first('medium')));
    expect(leadInFor(first('hard'))).toBe('');
  });

  it('the lead-in speaks only where the how-to-play does — never per item', () => {
    const pack = buildPack('easy');
    for (const item of pack.items) {
      const repeat = plainAsk(pack, item);
      expect(repeat).not.toContain(modelLineFor(item));
      expect(repeat).not.toContain(guideLineFor(item));
      const opening = spokenSpanOf(pack.itemCue(item, { opening: true, howToPlay: true }));
      expect(opening).toContain(guideLineFor(item));
    }
  });

  it('the correction re-models at EVERY tier — the tutor cannot withhold the rule', () => {
    for (const tier of ['easy', 'medium', 'hard'] as ChainTier[]) {
      const pack = buildPack(tier);
      for (const item of pack.items.filter((i) => i.answerKind === 'voice')) {
        const [, , correction] = spokenSpansOf(pack.itemCue(item, { opening: false, howToPlay: false }));
        expect(correction).toContain(modelLineFor(item));
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Harness answer material — the claims the contract makes, made drivable
// ---------------------------------------------------------------------------

describe('harness answers', () => {
  it('identify: the opposite word is wrong, and the signature is the rationalised opposite', () => {
    for (const item of buildItems().filter((i) => i.kind === 'identify_cause')) {
      if (item.kind !== 'identify_cause') continue;
      const a = causeEffectChainHarnessAnswers(item);
      expect(a.correct).toBe(item.isCause ? 'yes' : 'no');
      expect(a.plainWrong).toBe(item.isCause ? 'no' : 'yes');
      expect(a.signatureWrong!.text.startsWith(a.plainWrong)).toBe(true);
    }
  });

  it('root: the signature wrong is the OTHER END of the chain', () => {
    for (const item of buildItems().filter((i) => i.kind === 'root_vs_proximate')) {
      if (item.kind !== 'root_vs_proximate') continue;
      const a = causeEffectChainHarnessAnswers(item);
      const otherEndId = item.ask === 'root'
        ? item.correctOrder[item.correctOrder.length - 1]
        : item.correctOrder[0];
      const otherEnd = item.choices.find((c) => c.card.id === otherEndId)!;
      expect(a.signatureWrong!.text).toBe(otherEnd.distinguisher);
      expect(a.correct).toBe(correctChoiceOf(item).distinguisher);
      expect(a.plainWrong).not.toBe(a.correct);
      expect(a.plainWrong).not.toBe(a.signatureWrong!.text);
      // Every short form is a SURFACE word from the card, never a folded one.
      for (const c of item.choices) {
        for (const token of [c.distinguisher, ...c.alsoCounts]) {
          for (const w of token.split(' ')) expect(c.card.text.toLowerCase()).toContain(w);
        }
      }
    }
  });

  it('build: the gesture carries the correct order and its reverse', () => {
    const item = buildItems().find((i) => i.kind === 'build_chain')!;
    if (item.kind !== 'build_chain') throw new Error('shape');
    const a = causeEffectChainHarnessAnswers(item);
    expect(a.tapped!.correct).toBe(item.correctOrder.join(','));
    expect(a.tapped!.wrong).toBe([...item.correctOrder].reverse().join(','));
  });
});
