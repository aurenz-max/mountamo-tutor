/**
 * Matter Explorer — judged DI script pins (port 23).
 *
 * The plumbing is `checkPackGates` / `checkDiCatalogEntry`; what lives here is
 * the pedagogy: the answer-material fork, the leak asserts, the build-gate
 * drops, and the two content gates this primitive's DATA specifically invites
 * (a name that carries its own answer; a `shape` that disagrees with `state`).
 */

import { describe, it, expect } from 'vitest';
import {
  checkPackGates,
  checkDiCatalogEntry,
} from '../../../../hooks/judgedScriptContract.testkit';
import { spokenSpanOf, type JudgedScriptPack } from '../../../../hooks/judgedScriptContract';
import { CHEMISTRY_CATALOG } from '../../../../service/manifest/catalog/chemistry';
import {
  answerKindFor,
  responseClassFor,
  itemFromChallenge,
  itemsFromChallenges,
  matterExplorerPackBase,
  matterExplorerHarnessAnswers,
  normalizeChallengeType,
  nameCarriesAnswer,
  gasNamesItsVessel,
  changeFitsObject,
  isEverydayChange,
  optionsEarSeparable,
  namesTheStateMenu,
  stimulusFor,
  CHANGE_CATALOG,
  CHANGE_MENU_CLAUSE,
  CHANGE_OPTIONS,
  CHANGE_RULE_CLAUSE,
  PROPERTY_OPTIONS,
  PROPERTY_MENU_CLAUSE,
  STATE_MENU_CLAUSE,
  STATE_RULE_CLAUSE,
  STATE_OF_SHAPE,
  type MatterExplorerItem,
  type MatterObjectLike,
  type MatterKind,
} from '../matterExplorerScript';

// ── Fixtures — shaped like the generator's real output ──────────────────────

const OBJECTS: MatterObjectLike[] = [
  {
    id: 'obj-rock', name: 'rock', state: 'solid', canChangeState: false,
    properties: { color: 'grey', texture: 'rough', transparency: 'opaque', flexibility: 'rigid', shape: 'keeps_shape', weight: 'heavy' },
  },
  {
    id: 'obj-milk', name: 'milk', state: 'liquid', canChangeState: false,
    properties: { color: 'white', texture: 'smooth', transparency: 'opaque', flexibility: 'flows', shape: 'takes_container', weight: 'medium' },
  },
  {
    id: 'obj-air', name: 'air', state: 'gas', canChangeState: false,
    properties: { color: 'clear', texture: 'smooth', transparency: 'transparent', flexibility: 'flows', shape: 'fills_space', weight: 'light' },
  },
  {
    id: 'obj-ice', name: 'ice cube', state: 'solid', canChangeState: true, everydayChange: 'melt',
    properties: { color: 'clear', texture: 'smooth', transparency: 'translucent', flexibility: 'rigid', shape: 'keeps_shape', weight: 'light' },
  },
  {
    id: 'obj-juice', name: 'juice', state: 'liquid', canChangeState: true, everydayChange: 'freeze',
    properties: { color: 'orange', texture: 'smooth', transparency: 'translucent', flexibility: 'flows', shape: 'takes_container', weight: 'medium' },
  },
  // The irreversible half. These two are the whole reason the mode exists:
  // nothing in the catalog asked about a change that does NOT go back.
  {
    id: 'obj-paper', name: 'paper', state: 'solid', canChangeState: false, everydayChange: 'tear',
    properties: { color: 'white', texture: 'smooth', transparency: 'opaque', flexibility: 'flexible', shape: 'keeps_shape', weight: 'light' },
  },
  {
    id: 'obj-egg', name: 'egg', state: 'solid', canChangeState: false, everydayChange: 'cook',
    properties: { color: 'brown', texture: 'smooth', transparency: 'opaque', flexibility: 'rigid', shape: 'keeps_shape', weight: 'light' },
  },
];

const ch = (id: string, challengeType: string, objectId?: string) => ({ id, challengeType, objectId });

const buildItems = (
  challengeType: string,
  ids: string[],
  tier: 'easy' | 'medium' | 'hard' = 'medium',
): MatterExplorerItem[] =>
  ids
    .map((oid) => itemFromChallenge(ch(`${challengeType}-${oid}`, challengeType, oid), OBJECTS, { band: '1-2', tier }))
    .filter((x): x is MatterExplorerItem => x !== null);

const packOf = (items: MatterExplorerItem[]): JudgedScriptPack<MatterExplorerItem> =>
  matterExplorerPackBase(items) as JudgedScriptPack<MatterExplorerItem>;

const ALL_MODES = buildItems('sort', ['obj-rock'])
  .concat(buildItems('property', ['obj-milk']))
  .concat(buildItems('change', ['obj-ice']))
  .concat(buildItems('mystery', ['obj-air']));

// Both answers of the two-answer mode, and both halves of the K-2 contrast.
const CHANGE_REVERSIBLE = buildItems('change', ['obj-ice', 'obj-juice']);
const CHANGE_FOR_EVER = buildItems('change', ['obj-paper', 'obj-egg']);

// THE REAL SESSION SHAPE — several items of ONE mode back to back. The
// one-item-per-mode fixture above cannot trigger `findRepeatedConsecutiveAsks`
// at all (consecutive items differ by action by construction), which is how
// that gate sat asleep in all 12 earlier suites.
const SAME_MODE_RUN = buildItems('sort', ['obj-rock', 'obj-milk', 'obj-air', 'obj-ice']);

// ── The shared gates ────────────────────────────────────────────────────────

describe('pack gates', () => {
  it('passes every structural gate across all four modes', () => {
    expect(checkPackGates(packOf(ALL_MODES))).toEqual([]);
  });

  it('passes the repeat-ask gate on a REAL same-mode run, not just the fork fixture', () => {
    expect(SAME_MODE_RUN.length).toBeGreaterThanOrEqual(3);
    expect(checkPackGates(packOf(SAME_MODE_RUN))).toEqual([]);
  });

  it('passes at every support tier', () => {
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      expect(checkPackGates(packOf(buildItems('sort', ['obj-rock', 'obj-milk', 'obj-air'], tier)))).toEqual([]);
      expect(checkPackGates(packOf(buildItems('property', ['obj-rock', 'obj-milk', 'obj-air'], tier)))).toEqual([]);
      expect(checkPackGates(packOf(buildItems('mystery', ['obj-rock', 'obj-milk', 'obj-air'], tier)))).toEqual([]);
      expect(checkPackGates(packOf(buildItems('change', ['obj-ice', 'obj-paper', 'obj-juice'], tier)))).toEqual([]);
    }
  });

  it('matches the catalog entry exactly', () => {
    const entry = CHEMISTRY_CATALOG.find((p) => p.id === 'matter-explorer');
    expect(entry).toBeDefined();
    expect(checkDiCatalogEntry(entry!, packOf(ALL_MODES), ALL_MODES[0])).toEqual([]);
  });
});

// ── Step 1: the answer-material fork, pinned BOTH directions ────────────────

describe('the answer-material fork', () => {
  it('every mode SPEAKS — there is no gesture item in this pack', () => {
    const kinds: MatterKind[] = ['name_state', 'name_property', 'name_undo', 'mystery_state'];
    for (const k of kinds) expect(answerKindFor(k)).toBe('voice');
    expect(ALL_MODES.every((i) => i.answerKind === 'voice')).toBe(true);
  });

  it('binds each mode to its benched response class', () => {
    expect(responseClassFor('name_state')).toBe('short_spoken_word');
    expect(responseClassFor('mystery_state')).toBe('short_spoken_word');
    // A whole proposition from a menu the ask states — the BUTTON is what the
    // port deletes, never the menu.
    expect(responseClassFor('name_property')).toBe('closed_set_choice');
    // Two propositions, both named by the ask. Same arithmetic, shorter menu:
    // it is NOT a bare yes_no item, because what the child picks is a
    // proposition and "yes"/"no" are only its short forms.
    expect(responseClassFor('name_undo')).toBe('closed_set_choice');
  });

  it('never tells a spoken item to ignore the microphone', () => {
    for (const item of ALL_MODES) {
      const cue = packOf(ALL_MODES).itemCue(item, { opening: false, howToPlay: false });
      expect(cue).not.toMatch(/ignore (anything|what) you hear/i);
      expect(cue).toContain('If the answer is right, say exactly:');
      expect(cue).toContain('If it is wrong, say exactly:');
    }
  });

  it('keeps the closed-set options ear-separable', () => {
    expect(optionsEarSeparable(Object.values(PROPERTY_OPTIONS))).toBe(true);
    // "back" against "ever"/"forever"/"never": the two-option menu has to clear
    // the same bar as the three-option one, or an utterance fits both.
    expect(optionsEarSeparable(Object.values(CHANGE_OPTIONS))).toBe(true);
  });
});

// ── Leaks: nothing spoken may carry the answer ──────────────────────────────

describe('answer leaks', () => {
  const spokenOf = (item: MatterExplorerItem) =>
    spokenSpanOf(packOf([item]).itemCue(item, { opening: false, howToPlay: false })).toLowerCase();

  it('a hard-tier ask never speaks a state word', () => {
    for (const item of buildItems('sort', ['obj-rock', 'obj-milk', 'obj-air'], 'hard')) {
      const spoken = spokenOf(item);
      expect(spoken).not.toContain('solid');
      expect(spoken).not.toContain('liquid');
      expect(spoken).not.toContain(' gas');
    }
  });

  it('a hard-tier mystery ask never names the object it withholds', () => {
    for (const item of buildItems('mystery', ['obj-rock', 'obj-milk', 'obj-juice'], 'hard')) {
      expect(spokenOf(item)).not.toContain(item.objectName.toLowerCase());
    }
  });

  it('the easy tier leaks a state word ONLY inside the two exempt spans', () => {
    for (const item of buildItems('sort', ['obj-rock', 'obj-milk', 'obj-air'], 'easy')) {
      const { leakExemptSpan } = matterExplorerHarnessAnswers(item);
      let governed = spokenOf(item);
      for (const span of leakExemptSpan ?? []) governed = governed.split(span.toLowerCase()).join(' ');
      expect(governed).not.toContain(item.answerState);
    }
    // ...and the exemptions are the rule clause and the menu, nothing else.
    const easy = buildItems('sort', ['obj-rock'], 'easy')[0];
    expect(matterExplorerHarnessAnswers(easy).leakExemptSpan).toEqual([STATE_RULE_CLAUSE, STATE_MENU_CLAUSE]);
  });

  it('makes the three-way menu a real TIER lever, not a tone change', () => {
    expect(namesTheStateMenu(buildItems('sort', ['obj-rock'], 'easy')[0])).toBe(true);
    expect(namesTheStateMenu(buildItems('sort', ['obj-rock'], 'medium')[0])).toBe(false);
    expect(namesTheStateMenu(buildItems('sort', ['obj-rock'], 'hard')[0])).toBe(false);
    // The property menu is the ASK (the mats rule) and survives every tier —
    // without it that mode's answer set is open and unjudgeable.
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      expect(spokenOf(buildItems('property', ['obj-milk'], tier)[0])).toContain(
        PROPERTY_MENU_CLAUSE.toLowerCase(),
      );
    }
  });

  it('never pushes the property panel or the bin through the stimulus channel', () => {
    for (const item of ALL_MODES) {
      const s = stimulusFor(item).toLowerCase();
      // `shape` and `flexibility` are the answer key for two of three modes.
      expect(s).not.toContain('keeps_shape');
      expect(s).not.toContain('takes_container');
      expect(s).not.toContain('fills_space');
      expect(s).not.toContain('flows');
      if (item.kind !== 'name_property') expect(s).not.toContain(item.answerState);
    }
  });

  it('withholds the mystery object NAME from the stimulus channel', () => {
    const item = buildItems('mystery', ['obj-juice'])[0];
    expect(stimulusFor(item)).not.toContain(item.objectName);
  });

  it('re-speaks the QUESTION on tap-to-hear and never the answer', () => {
    for (const item of buildItems('sort', ['obj-rock', 'obj-milk', 'obj-air'], 'hard')) {
      const line = spokenSpanOf(packOf([item]).pronounceCue!(item)).toLowerCase();
      expect(line).not.toContain(item.answerState);
    }
  });
});

// ── Build gates: keep-or-drop, never backfill ───────────────────────────────

describe('build gates', () => {
  it('drops an object whose NAME carries its own answer (defect 11)', () => {
    expect(nameCarriesAnswer('liquid soap')).toBe(true);
    expect(nameCarriesAnswer('solid chocolate')).toBe(true);
    // ...and does NOT refuse this primitive's best K-2 stimuli, which is why
    // the shared states-of-matter vocabulary is deliberately not imported.
    expect(nameCarriesAnswer('ice cube')).toBe(false);
    expect(nameCarriesAnswer('steam')).toBe(false);

    const leaky = [{ ...OBJECTS[1], id: 'obj-soap', name: 'liquid soap' }];
    expect(itemFromChallenge(ch('c', 'sort', 'obj-soap'), leaky, { band: '1-2' })).toBeNull();
  });

  it('drops a GAS named after its vessel (defect 8, caught live)', () => {
    // "party balloon" is rubber. The key that calls it a gas is not a harder
    // item, it is a false one — and a child who says "solid" about the balloon
    // gets corrected for being right.
    expect(gasNamesItsVessel('party balloon', 'gas')).toBe(true);
    expect(gasNamesItsVessel('fizzy bottle', 'gas')).toBe(true);
    // NARROW: the same words are fine when they are not the gas.
    expect(gasNamesItsVessel('drinking glass', 'solid')).toBe(false);
    expect(gasNamesItsVessel('cup of water', 'liquid')).toBe(false);
    // ...and a gas named as itself passes.
    expect(gasNamesItsVessel('steam', 'gas')).toBe(false);
    expect(gasNamesItsVessel('morning fog', 'gas')).toBe(false);

    const vessel = [{
      id: 'obj-bal', name: 'party balloon', state: 'gas',
      properties: { ...OBJECTS[2].properties, shape: 'fills_space' },
    }];
    expect(itemFromChallenge(ch('c', 'sort', 'obj-bal'), vessel, { band: '1-2' })).toBeNull();
  });

  it('drops an object whose shape DISAGREES with its state', () => {
    const contradictory = [{
      ...OBJECTS[0],
      state: 'liquid',
      properties: { ...OBJECTS[0].properties, shape: 'keeps_shape' },
    }];
    expect(itemFromChallenge(ch('c', 'sort', 'obj-rock'), contradictory, { band: '1-2' })).toBeNull();
    // The rule the gate enforces, stated once in code.
    expect(STATE_OF_SHAPE.keeps_shape).toBe('solid');
    expect(STATE_OF_SHAPE.takes_container).toBe('liquid');
    expect(STATE_OF_SHAPE.fills_space).toBe('gas');
  });

  it('drops a mystery item with fewer than two leak-clean clues', () => {
    const thin = [{ id: 'obj-x', name: 'thing', state: 'solid', properties: { shape: 'keeps_shape', color: 'red' } }];
    expect(itemFromChallenge(ch('c', 'mystery', 'obj-x'), thin, { band: '1-2' })).toBeNull();
    // ...but the same object is perfectly askable in the modes that name it.
    expect(itemFromChallenge(ch('c', 'sort', 'obj-x'), thin, { band: '1-2' })).not.toBeNull();
  });

  it('never speaks shape or flexibility as a mystery CLUE', () => {
    const item = buildItems('mystery', ['obj-milk'])[0];
    const clues = item.clues!.join(' ').toLowerCase();
    expect(clues).not.toContain('flows');
    expect(clues).not.toContain('takes_container');
  });

  it('drops an unresolvable object and an unknown challenge type', () => {
    expect(itemFromChallenge(ch('c', 'sort', 'nope'), OBJECTS, { band: '1-2' })).toBeNull();
    expect(itemFromChallenge(ch('c', 'nonsense', 'obj-rock'), OBJECTS, { band: '1-2' })).toBeNull();
  });
});

// ── The eval-mode fiction this port closes ──────────────────────────────────

describe('challenge-type normalization', () => {
  it('makes `property` REAL — it was declared in the catalog and never generated', () => {
    expect(normalizeChallengeType('property')).toBe('property');
    // The three generator types that carried no judgeable answer at all
    // (describe = click-to-view credit; predict and compare were both scored
    // `correct: true` unconditionally) map onto the mode that can be judged.
    expect(normalizeChallengeType('describe')).toBe('property');
    expect(normalizeChallengeType('predict')).toBe('property');
    expect(normalizeChallengeType('compare')).toBe('property');
  });

  it('keeps sort and mystery as themselves', () => {
    expect(normalizeChallengeType('sort')).toBe('sort');
    expect(normalizeChallengeType('mystery')).toBe('mystery');
  });

  it('adds `change` as its own identity and leaves the legacy folds alone', () => {
    expect(normalizeChallengeType('change')).toBe('change');
    // `predict` still folds onto property. Re-pointing it at the new mode
    // would silently re-key every cached payload that carries one.
    expect(normalizeChallengeType('predict')).toBe('property');
  });
});

// ── Defect class 1 + 2: one OBJECT is one item ──────────────────────────────

describe('session building', () => {
  it('expands a whole-screen sort challenge into one item per object', () => {
    // The click era graded all N objects as ONE all-or-nothing boolean.
    const items = itemsFromChallenges([{ id: 'sort-1', challengeType: 'sort' }], OBJECTS, { band: '1-2' });
    expect(items.length).toBeGreaterThan(1);
    expect(new Set(items.map((i) => i.objectId)).size).toBe(items.length);
  });

  it('asks each object ONCE per session, in any role (defect 2)', () => {
    const items = itemsFromChallenges(
      [{ id: 'a', challengeType: 'sort' }, { id: 'b', challengeType: 'mystery' }],
      OBJECTS,
      { band: '1-2' },
    );
    expect(new Set(items.map((i) => i.objectId)).size).toBe(items.length);
  });

  it('never lets two consecutive same-action items share an answer', () => {
    const items = itemsFromChallenges([{ id: 'sort-1', challengeType: 'sort' }], OBJECTS, { band: '1-2' });
    for (let i = 1; i < items.length; i++) {
      if (items[i].action === items[i - 1].action) {
        expect(items[i].answerState).not.toBe(items[i - 1].answerState);
      }
    }
  });

  it('SELECTS under a cap rather than truncating, so no state is stranded', () => {
    const items = itemsFromChallenges([{ id: 'sort-1', challengeType: 'sort' }], OBJECTS, { band: '1-2', maxItems: 3 });
    expect(items).toHaveLength(3);
    // A blind slice of this pool would have shipped solid, liquid, gas anyway —
    // so pin the property that matters: the cap spans more than one answer.
    expect(new Set(items.map((i) => i.answerState)).size).toBeGreaterThan(1);
  });
});

// ── Corrections and affirmations ────────────────────────────────────────────

describe('correction and affirmation wording', () => {
  const cueOf = (item: MatterExplorerItem) =>
    packOf([item]).itemCue(item, { opening: false, howToPlay: false });

  it('opens corrections with "My turn:" and affirmations with "Yes,"', () => {
    for (const item of ALL_MODES) {
      const cue = cueOf(item);
      expect(cue).toMatch(/If the answer is right, say exactly: "Yes,/);
      expect(cue).toMatch(/If it is wrong, say exactly: "My turn:/);
    }
  });

  it('re-elicits in every correction instead of landing the answer', () => {
    for (const item of ALL_MODES) {
      const correction = cueOf(item).split('If it is wrong, say exactly: "')[1];
      expect(correction).toContain('Your turn.');
    }
  });

  it('carries the two laws on every cue', () => {
    for (const item of ALL_MODES) {
      const cue = cueOf(item);
      expect(cue).toContain('never run on into another question');
      expect(cue).toContain('never announce that you are waiting or listening');
    }
  });

  it('names the signature miss the judge must refuse', () => {
    const sort = buildItems('sort', ['obj-rock'])[0];
    expect(cueOf(sort)).toContain('is NOT an answer however confidently it is said');
    // The property mode's signature miss is the STATE — the right idea
    // answering a different question.
    const prop = buildItems('property', ['obj-milk'])[0];
    expect(cueOf(prop)).toContain('Naming the STATE instead');
  });
});

// ── The fourth mode: can this change go back? ───────────────────────────────
// Queue item 28. `sort`, `property` and `mystery` all ask what a thing IS;
// this one asks what a CHANGE did, which is the K-2 half of the standard the
// catalog had no home for — the sibling `states-of-matter` covers the
// reversible half only, and from thresholds.

describe('the change mode', () => {
  const spokenOf = (item: MatterExplorerItem) =>
    spokenSpanOf(packOf([item]).itemCue(item, { opening: false, howToPlay: false })).toLowerCase();
  const cueOf = (item: MatterExplorerItem) =>
    packOf([item]).itemCue(item, { opening: false, howToPlay: false });

  it('computes the answer in CODE from the change, never from the payload', () => {
    // The generator picks WHICH change happened and nothing else. A generated
    // "reversible: true" would be the click era's free-text `targetAnswer`
    // wearing new clothes.
    const [ice, juice] = CHANGE_REVERSIBLE;
    expect(ice.change).toBe('melt');
    expect(ice.answerUndo).toBe('can_go_back');
    expect(juice.answerUndo).toBe('can_go_back');
    for (const item of CHANGE_FOR_EVER) expect(item.answerUndo).toBe('changed_for_ever');
    for (const item of [...CHANGE_REVERSIBLE, ...CHANGE_FOR_EVER]) {
      expect(item.answerUndo).toBe(CHANGE_CATALOG[item.change!].reversibility);
    }
  });

  it('drops a change that does not belong to its object, BOTH directions', () => {
    // "we melted the paper" — a reversible change needs an object that really
    // changes state at everyday temperatures...
    const meltedPaper = [{ ...OBJECTS[5], everydayChange: 'melt' }];
    expect(itemFromChallenge(ch('c', 'change', 'obj-paper'), meltedPaper, { band: '1-2' })).toBeNull();
    // ...and "we cooked the ice cube" is the pairing a K-2 generator actually
    // reaches for, because ice is its favourite object.
    const cookedIce = [{ ...OBJECTS[3], everydayChange: 'cook' }];
    expect(itemFromChallenge(ch('c', 'change', 'obj-ice'), cookedIce, { band: '1-2' })).toBeNull();
    expect(changeFitsObject('melt', OBJECTS[3])).toBe(true);
    expect(changeFitsObject('cook', OBJECTS[3])).toBe(false);
    expect(changeFitsObject('freeze', OBJECTS[5])).toBe(false);
  });

  it('drops an object carrying no change, or an unknown one', () => {
    expect(itemFromChallenge(ch('c', 'change', 'obj-rock'), OBJECTS, { band: '1-2' })).toBeNull();
    const nonsense = [{ ...OBJECTS[3], everydayChange: 'unfry' }];
    expect(itemFromChallenge(ch('c', 'change', 'obj-ice'), nonsense, { band: '1-2' })).toBeNull();
    expect(isEverydayChange('unfry')).toBe(false);
    // ...and every one of them stays perfectly askable in the other modes.
    expect(itemFromChallenge(ch('c', 'sort', 'obj-rock'), OBJECTS, { band: '1-2' })).not.toBeNull();
  });

  it('speaks the menu at every tier — free production here would be open-set', () => {
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      expect(spokenOf(buildItems('change', ['obj-ice'], tier)[0])).toContain(
        CHANGE_MENU_CLAUSE.toLowerCase(),
      );
    }
  });

  it('never asserts either answer outside the menu and the rule clause', () => {
    for (const item of [...CHANGE_REVERSIBLE, ...CHANGE_FOR_EVER]) {
      const { leakTokens, leakExemptSpan } = matterExplorerHarnessAnswers(item);
      let governed = spokenOf(item);
      for (const span of leakExemptSpan ?? []) governed = governed.split(span.toLowerCase()).join(' ');
      for (const token of leakTokens ?? []) expect(governed).not.toContain(token);
    }
    // At `hard` the lead-in is gone, so the menu is the ONLY exemption left.
    expect(matterExplorerHarnessAnswers(buildItems('change', ['obj-ice'], 'hard')[0]).leakExemptSpan)
      .toEqual([CHANGE_MENU_CLAUSE]);
    expect(matterExplorerHarnessAnswers(buildItems('change', ['obj-ice'], 'medium')[0]).leakExemptSpan)
      .toEqual([CHANGE_MENU_CLAUSE, CHANGE_RULE_CLAUSE]);
  });

  it('keeps the how-to-play clean of both answers', () => {
    // It is re-spoken on every action change, so a how-to-play naming one side
    // would prime it every round — and the drive harness scans this line.
    for (const item of [...CHANGE_REVERSIBLE, ...CHANGE_FOR_EVER]) {
      const { leakTokens, leakExemptSpan } = matterExplorerHarnessAnswers(item);
      let governed = spokenSpanOf(
        packOf([item]).itemCue(item, { opening: true, howToPlay: true }),
      ).toLowerCase();
      for (const span of leakExemptSpan ?? []) governed = governed.split(span.toLowerCase()).join(' ');
      for (const token of leakTokens ?? []) expect(governed).not.toContain(token);
    }
  });

  it('names the two misses, and they are OPPOSITE errors', () => {
    // Which is what stops a two-answer mode being judged as one error twice.
    const forEver = cueOf(CHANGE_FOR_EVER[0]);
    expect(forEver).toContain('Naming the STATE');
    expect(forEver).toContain('repeats the question');
    expect(forEver).toContain('every change can be undone');
    expect(cueOf(CHANGE_REVERSIBLE[0])).toContain('must be gone for good');
  });

  it('accepts the short forms a five-year-old actually says', () => {
    const cue = cueOf(CHANGE_REVERSIBLE[0]);
    expect(cue).toContain('"go back"');
    // The ask's first clause is a yes/no question and a child answers the
    // clause they heard first — so the yes_no pair rides INSIDE this closed set.
    expect(cue).toContain('"yes"');
    expect(cueOf(CHANGE_FOR_EVER[0])).toContain('"no"');
  });

  it('keeps the answer out of the stimulus channel', () => {
    for (const item of [...CHANGE_REVERSIBLE, ...CHANGE_FOR_EVER]) {
      const stim = stimulusFor(item).toLowerCase();
      expect(stim).not.toContain('go back');
      expect(stim).not.toContain('for ever');
    }
  });

  it('alternates the two answers within a run', () => {
    // A two-answer set reaches "same answer twice" far faster than a
    // three-answer one, so this is the rule doing more work than it does for sort.
    const items = itemsFromChallenges([{ id: 'change-1', challengeType: 'change' }], OBJECTS, { band: '1-2' });
    expect(items.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < items.length; i++) {
      expect(items[i].answerUndo).not.toBe(items[i - 1].answerUndo);
    }
  });

  it('ships an imbalanced draw WHOLE instead of stranding it', () => {
    // The first live probe of this mode, 2026-09-03: one melt against a tear,
    // a burn and a bake. Every machine gate was green and the session still
    // came back 2 items out of 4 — strict alternation had nothing left to
    // alternate with and stopped. Two answers reach that case constantly.
    const imbalanced = [
      OBJECTS[3],                                                        // ice cube — melt
      OBJECTS[5],                                                        // paper — tear
      OBJECTS[6],                                                        // egg — cook
      { ...OBJECTS[5], id: 'obj-log', name: 'log', everydayChange: 'burn' },
    ];
    const items = itemsFromChallenges([{ id: 'change-1', challengeType: 'change' }], imbalanced, { band: '1-2' });
    expect(items).toHaveLength(4);
    // ...and it still alternates as far as the draw allows.
    expect(items[0].answerUndo).not.toBe(items[1].answerUndo);
  });

  it('leaves the three-answer modes on the HARD no-repeat rule', () => {
    // Same stranding shape with three answers: the run stops rather than
    // repeating, exactly as before this mode existed.
    const twoSolids = [OBJECTS[0], OBJECTS[5]];
    expect(itemsFromChallenges([{ id: 'sort-1', challengeType: 'sort' }], twoSolids, { band: '1-2' }))
      .toHaveLength(1);
  });

  it('runs the modes in ladder order when a session mixes them', () => {
    const items = itemsFromChallenges(
      [{ id: 'a', challengeType: 'change' }, { id: 'b', challengeType: 'sort' }],
      OBJECTS,
      { band: '1-2' },
    );
    const kinds = items.map((i) => i.kind);
    expect(kinds).toContain('name_undo');
    expect(kinds.indexOf('name_state')).toBeLessThan(kinds.indexOf('name_undo'));
  });

  it('is declared in the catalog, in beta order, with a producible type', () => {
    const entry = CHEMISTRY_CATALOG.find((p) => p.id === 'matter-explorer')!;
    const modes = entry.evalModes ?? [];
    expect(modes.map((m) => m.evalMode)).toEqual(['sort', 'property', 'change', 'mystery']);
    expect(modes.map((m) => m.beta)).toEqual([-1.0, 0.5, 1.2, 2.0]);
    // The eval-mode FICTION this port closed, re-pinned for the new mode: a
    // declared type nothing can emit is IRT-weighted and unroutable.
    for (const m of modes) {
      for (const t of m.challengeTypes) expect(normalizeChallengeType(t)).toBe(t);
    }
  });
});

// ── Harness answer material ─────────────────────────────────────────────────

describe('harness answers', () => {
  it('gives every item a correct, a plain wrong, and a SIGNATURE wrong', () => {
    for (const item of ALL_MODES) {
      const a = matterExplorerHarnessAnswers(item);
      expect(a.correct).toBeTruthy();
      expect(a.plainWrong).toBeTruthy();
      expect(a.plainWrong).not.toBe(a.correct);
      expect(a.signatureWrong.text).toBeTruthy();
      expect(a.signatureWrong.text).not.toBe(a.correct);
      expect(a.signatureWrong.why).toBeTruthy();
    }
  });

  it('makes the signature wrong the one the contract CLAIMS to refuse', () => {
    const sort = buildItems('sort', ['obj-rock'])[0];
    expect(matterExplorerHarnessAnswers(sort).signatureWrong.text).toBe('rock');
    const mystery = buildItems('mystery', ['obj-air'])[0];
    expect(matterExplorerHarnessAnswers(mystery).signatureWrong.text).toBe('air');
    const prop = buildItems('property', ['obj-milk'])[0];
    expect(matterExplorerHarnessAnswers(prop).signatureWrong.text).toBe('liquid');
    // The change mode's signature miss is the answer the pack has been asking
    // for all session, arriving on the one mode that does not want it.
    const change = CHANGE_FOR_EVER[0];
    expect(matterExplorerHarnessAnswers(change).signatureWrong.text).toBe('solid');
    expect(matterExplorerHarnessAnswers(change).correct).toBe('for ever');
    expect(matterExplorerHarnessAnswers(change).plainWrong).toBe('go back');
  });
});
