/**
 * Matter Explorer — the judged DI script (port 23, third chemistry port).
 *
 * ── THE MODALITY ────────────────────────────────────────────────────────────
 * ALL FOUR MODES ARE SPOKEN. Zero taps. The click era's whole surface — drag
 * an object into one of three bins, press Check, type a guess into a text box —
 * is deleted, because every answer this primitive wants is a thing a five-year-
 * old says out loud at a table: "solid", "it takes the shape of the cup",
 * "gas". Step 1's first question answers itself here, and the bins never get a
 * chance to become the second question.
 *
 * The sibling `states-of-matter` is the SAME answer vocabulary at Grade 3-5,
 * reasoned from melting and boiling points. This one is K-2 and reasons from
 * what you can SEE: does it hold its shape, does it pour, does it fill the
 * room. Keeping the two apart is a content decision, not a naming one — this
 * pack never speaks a temperature threshold and never asks for a phase-change
 * word, so the modes stay distinguishable in the manifest and in the ear.
 *
 * ── WHAT THE CLICK ERA WAS ACTUALLY MEASURING (read before "improving" this) ─
 * Four measurement fictions, all confirmed by reading the pre-port component:
 *   1. `handleCheckPredictChallenge` wrote `correct: true` UNCONDITIONALLY —
 *      no answer was consulted at all.
 *   2. `handleCheckCompareChallenge` did the same, gated only on two text
 *      boxes being non-empty.
 *   3. `describe` completed when properties had been VIEWED. Clicking earned
 *      the credit.
 *   4. `sort` graded all 6-10 objects as ONE all-or-nothing boolean, so a
 *      child who knew seven of eight scored exactly what a child who knew
 *      none did.
 * Defect class 1 in its purest form. Here one OBJECT is one judged item.
 *
 * ── THE EVAL-MODE FICTION THIS PORT CLOSES ──────────────────────────────────
 * The catalog declared `sort | property | mystery`; the generator's challenge
 * enum emits `sort | describe | predict | mystery | compare`. **`property` was
 * never generated** — a declared, IRT-weighted eval mode that could not be
 * produced, unroutable by difficulty and silently absent from every session.
 * The periodic-table port closed the same class. It is made REAL here rather
 * than deleted, bound to `properties.shape`, which the generator has always
 * emitted and nothing has ever read.
 *
 * ── THE ANSWER-MATERIAL FORK (standing gate 1 arithmetic) ───────────────────
 *   name_state    say the state of a NAMED object          short_spoken_word
 *   name_property say what the object DOES in a cup        closed_set_choice
 *   name_undo     say whether an everyday change to the    closed_set_choice
 *                 object can be undone
 *   mystery_state say the state from property clues,       short_spoken_word
 *                 with the object's name withheld
 * Every key is computed in code from the object's own enums. Nothing is read
 * off the LLM's free-text `targetAnswer`, which the click era substring-matched
 * against a typed guess and which remains the least trustworthy field here.
 * `name_undo` is the one mode whose answer cannot be computed from the object
 * at rest, so the LLM picks the CHANGE from a closed menu and `CHANGE_CATALOG`
 * owns whether that change undoes — see the block above it.
 *
 * ── WHY THE LEAK VOCABULARY IS **NOT** THE SHARED ONE ───────────────────────
 * `statesOfMatterScript.STATE_WORDS` includes `ice`, `steam`, `vapor` — correct
 * there, where substances are named by formula-ish keys and "ice" in a name
 * would disclose "solid". Here `ice` and `steam` are the primitive's two BEST
 * K-2 stimuli: the whole point is that a child looks at an ice cube and works
 * out it is a solid. Importing that gate wholesale would refuse this
 * primitive's strongest content. The list below is deliberately narrower —
 * the three answer words and their inflections and nothing else — and this
 * comment is the reason, so nobody "fixes" the divergence later.
 *
 * ── THE LEAK THIS PRIMITIVE'S DATA INVITES (defect 11, in its exact shape) ──
 * `properties.shape` is a 1:1 map onto the answer: keeps_shape → solid,
 * takes_container → liquid, fills_space → gas. So the property panel IS the
 * answer key for two of the three modes, and the stimulus channel must never
 * carry it. It is spoken in exactly one place — `name_property`, where it is
 * the answer being asked for and the menu is the ask (the mats rule).
 * `flexibility: 'flows'` is the same hazard one field over and is never spoken.
 *
 * ── SENTINELS ───────────────────────────────────────────────────────────────
 * Engine defaults ("Yes" / "My turn"). Object names are GENERATED here, unlike
 * the sibling's code-owned pool, so `itemFromChallenge` scans every one of them
 * and drops the item rather than reworking the name.
 */

import {
  opensWithSentinel,
  type JudgedCueSurface,
  type JudgedScriptItem,
  type ResponseClassId,
} from '../../../hooks/judgedScriptContract';

export { opensWithSentinel };

// ============================================================================
// Domain
// ============================================================================

export type MatterChallengeType = 'sort' | 'property' | 'mystery' | 'change';

export type MatterKind = 'name_state' | 'name_property' | 'mystery_state' | 'name_undo';

export type MatterState = 'solid' | 'liquid' | 'gas';
export type ShapeBehaviour = 'keeps_shape' | 'takes_container' | 'fills_space';
export type MatterBand = 'K-1' | '1-2';
export type MatterTier = 'easy' | 'medium' | 'hard';

/** The object as the generator emits it, duck-typed so this module never
 *  imports the component — the component imports us. */
export interface MatterObjectLike {
  id: string;
  name: string;
  state: string;
  /** Whether the object changes state at everyday temperatures (ice melts,
   *  juice freezes). Only the `change` mode's fit gate reads it. */
  canChangeState?: boolean;
  /** The ONE everyday change this object undergoes, as a key of the closed
   *  `CHANGE_CATALOG`. The generator picks WHICH change happens; whether that
   *  change can be undone is code-owned and never read off the payload. */
  everydayChange?: string;
  properties?: {
    color?: string;
    texture?: string;
    transparency?: string;
    flexibility?: string;
    shape?: string;
    weight?: string;
  };
}

/**
 * THE RULE, as code. `shape` is the observable and `state` is the name for it;
 * a payload where they disagree is not a harder item, it is a broken one, and
 * `itemFromChallenge` drops it. The click era never noticed because nothing
 * ever read `shape`.
 */
export const STATE_OF_SHAPE: Readonly<Record<ShapeBehaviour, MatterState>> = {
  keeps_shape: 'solid',
  takes_container: 'liquid',
  fills_space: 'gas',
};

export const SHAPE_OF_STATE: Readonly<Record<MatterState, ShapeBehaviour>> = {
  solid: 'keeps_shape',
  liquid: 'takes_container',
  gas: 'fills_space',
};

export const isMatterState = (v?: string): v is MatterState =>
  v === 'solid' || v === 'liquid' || v === 'gas';

export const isShapeBehaviour = (v?: string): v is ShapeBehaviour =>
  v === 'keeps_shape' || v === 'takes_container' || v === 'fills_space';

// ── The property menu: the three things an object can do in a cup ───────────
// Spoken as a menu in `name_property` (the mats rule — the ask names the
// groups, so the answer sits inside the question by construction). Each option
// carries a DISTINGUISHING NOUN that no other option uses — "own shape", "the
// cup", "the room" — and the accept clause is built around that noun rather
// than the full phrase, because a five-year-old never recites a proposition
// back. `keeps` and `takes` differ by one phoneme and are NOT relied on to
// separate the options; the nouns are.

export interface PropertyOption {
  shape: ShapeBehaviour;
  /** The full proposition, as the menu speaks it. */
  phrase: string;
  /** The short form a child actually says — the ear-separable part. */
  distinguisher: string;
  /** Extra short forms that count. Never overlapping across options. */
  alsoCounts: string[];
}

export const PROPERTY_OPTIONS: Readonly<Record<ShapeBehaviour, PropertyOption>> = {
  keeps_shape: {
    shape: 'keeps_shape',
    phrase: 'it keeps its own shape',
    distinguisher: 'own shape',
    alsoCounts: ['keeps', 'keeps its shape', 'stays the same'],
  },
  takes_container: {
    shape: 'takes_container',
    phrase: 'it takes the shape of the cup',
    distinguisher: 'the cup',
    alsoCounts: ['takes', 'the cup shape', 'like the cup'],
  },
  fills_space: {
    shape: 'fills_space',
    phrase: 'it spreads out and fills the whole room',
    distinguisher: 'the room',
    alsoCounts: ['spreads', 'spreads out', 'fills the room'],
  },
};

export const PROPERTY_MENU_CLAUSE =
  'does it keep its own shape, does it take the shape of the cup, or does it spread out and fill the whole room?';

/**
 * Ear-separability, run over the menu as it will actually be SPOKEN
 * (decodable-reader's `optionsEarSeparable`, this pack's shape). Every option
 * must own at least one content word no other option uses, or an utterance
 * fits two of them and there is no honest verdict. Runs on the pack side AND
 * the generator side.
 */
export interface EarSeparable {
  distinguisher: string;
  alsoCounts: string[];
}

export const optionsEarSeparable = (options: EarSeparable[]): boolean => {
  const words = options.map((o) =>
    [o.distinguisher, ...o.alsoCounts].join(' ').toLowerCase().split(/\s+/).filter(Boolean),
  );
  return options.every((_, i) =>
    words[i].some(
      (w) => w.length > 2 && words.every((other, j) => j === i || !other.includes(w)),
    ),
  );
};

// -- The change menu: can it go back, or is it changed for ever? -------------
// THE K-2 GAP THIS MODE CLOSES (queue item 28). `states-of-matter.predict` is
// the reversible half taught from THRESHOLDS - "it melts at zero degrees" - a
// Grade 3-5 ask, and wrong for K by construction: a five-year-old is not
// deriving anything from a melting point. Nothing in the catalog asked the
// OTHER half at all: ice melts and freezes back, and a cooked egg never goes
// back. That contrast is the K-2 standard, and it is one spoken mode over the
// everyday-object vocabulary this pack already owns.
//
// TWO options, not three, and the menu IS the ask - the same
// `closed_set_choice` arithmetic as `name_property`, because spoken FREE
// production of a proposition is open-set. The distinguishing content words
// are "back" and "ever", which share no phoneme run. Bare "yes" and "no" count
// as short forms: the ask's first clause is a yes/no question and a
// five-year-old answers the clause they heard first. That is the `yes_no`
// shape sitting INSIDE this closed set (its own record calls the pair the most
// separable there is), not a second response class - and the child's "yes" is
// not a sentinel hazard, because the verdict scan reads the TUTOR's output.
//
// THE ORDER IS FIXED: the ask always offers can-go-back first, so "yes" maps
// to it and "no" to the other. A menu that flipped per item would make the two
// commonest utterances a five-year-old produces unjudgeable.

export type Reversibility = 'can_go_back' | 'changed_for_ever';

export interface ChangeOption {
  reversibility: Reversibility;
  /** The full proposition, as the menu speaks it. */
  phrase: string;
  /** The short form a child actually says - the ear-separable part. */
  distinguisher: string;
  /** Extra short forms that count. Never overlapping across options. */
  alsoCounts: string[];
}

export const CHANGE_OPTIONS: Readonly<Record<Reversibility, ChangeOption>> = {
  can_go_back: {
    reversibility: 'can_go_back',
    phrase: 'it can go back the way it was',
    distinguisher: 'go back',
    alsoCounts: ['back', 'we can get it back', 'yes'],
  },
  changed_for_ever: {
    reversibility: 'changed_for_ever',
    phrase: 'it is changed for ever',
    distinguisher: 'for ever',
    alsoCounts: ['forever', 'never', 'no', 'it stays like that'],
  },
};

export const CHANGE_MENU_CLAUSE =
  'can it go back the way it was, or is it changed for ever?';

export const OTHER_REVERSIBILITY: Readonly<Record<Reversibility, Reversibility>> = {
  can_go_back: 'changed_for_ever',
  changed_for_ever: 'can_go_back',
};

/**
 * THE CHANGES, AND THEIR ANSWERS, IN CODE.
 *
 * Reversibility is not derivable from anything the generator already emits -
 * `state` and `shape` describe the object at rest, not what happened to it -
 * so the LLM has to supply something. What it supplies is a KEY FROM THIS
 * MENU and nothing else: which everyday change happened. Whether that change
 * can be undone is decided here ([[feedback_llm-window-code-builds-structure]]
 * - the LLM emits the window, code builds the answer). A free-text
 * "reversible: true" from a flash-lite model would be the click era's
 * `targetAnswer` wearing a new name.
 *
 * `states` + `needsChangeable` are the FIT GATE, and the equality on
 * `needsChangeable` does real work in BOTH directions:
 *  - a REVERSIBLE change needs an object that actually changes state at
 *    everyday temperatures, so "we melted the paper" cannot be built;
 *  - an IRREVERSIBLE one needs an object that does NOT, so "we cooked the ice
 *    cube" cannot be built either - and that is the pairing a K-2 generator
 *    reaches for, because ice is its favourite object.
 *
 * DELIBERATELY ABSENT: dissolving. Sugar in water is the classic contested
 * case (the water evaporates and the sugar comes back), and a contested item
 * in a judged loop is a FALSE key, not a hard one - the same reasoning that
 * keeps a gas named after its vessel out of the pack.
 */
export type EverydayChange =
  | 'melt'
  | 'freeze'
  | 'boil_to_steam'
  | 'cook'
  | 'bake'
  | 'burn'
  | 'tear'
  | 'rust';

export interface ChangeDefinition {
  /** THE ANSWER. Code-owned, never read off the payload. */
  reversibility: Reversibility;
  /** How the tutor SAYS the change happened - the premise of the ask. It is
   *  never the answer: knowing that melting undoes and cooking does not IS the
   *  skill being measured. */
  storyFor: (objectName: string) => string;
  /** The starting states the change is physically about. */
  states: readonly MatterState[];
  /** Whether the object must be one that changes state at everyday
   *  temperatures (`canChangeState`). Matched for EQUALITY, not implication. */
  needsChangeable: boolean;
  /** The clause the affirmation adds AFTER the verdict, so the child hears why. */
  because: string;
}

export const CHANGE_CATALOG: Readonly<Record<EverydayChange, ChangeDefinition>> = {
  melt: {
    reversibility: 'can_go_back',
    storyFor: (n) => `We left the ${n} somewhere warm until it melted`,
    states: ['solid'],
    needsChangeable: true,
    because: 'we can make it cold and get it just how it was',
  },
  freeze: {
    reversibility: 'can_go_back',
    storyFor: (n) => `We put the ${n} in the freezer until it went hard`,
    states: ['liquid'],
    needsChangeable: true,
    because: 'we can let it warm up and get it just how it was',
  },
  boil_to_steam: {
    reversibility: 'can_go_back',
    storyFor: (n) => `We heated the ${n} in a pan until it turned into steam`,
    states: ['liquid'],
    needsChangeable: true,
    because: 'when the steam cools down it turns into drops again',
  },
  cook: {
    reversibility: 'changed_for_ever',
    storyFor: (n) => `We cooked the ${n} in a hot pan`,
    states: ['solid', 'liquid'],
    needsChangeable: false,
    because: 'a cooked thing does not turn raw again, however cold it gets',
  },
  bake: {
    reversibility: 'changed_for_ever',
    storyFor: (n) => `We put the ${n} in a hot oven and baked it`,
    states: ['solid', 'liquid'],
    needsChangeable: false,
    because: 'what comes out of the oven is a new thing, and it stays that way',
  },
  burn: {
    reversibility: 'changed_for_ever',
    storyFor: (n) => `We burned the ${n} until it went black`,
    states: ['solid'],
    needsChangeable: false,
    because: 'burnt things stay burnt - nothing makes them new',
  },
  tear: {
    reversibility: 'changed_for_ever',
    storyFor: (n) => `We tore the ${n} into little pieces`,
    states: ['solid'],
    needsChangeable: false,
    because: 'the pieces will not join up into one whole piece',
  },
  rust: {
    reversibility: 'changed_for_ever',
    storyFor: (n) => `We left the ${n} out in the rain until it went rusty`,
    states: ['solid'],
    needsChangeable: false,
    because: 'the rust does not come off and leave it shiny',
  },
};

export const isEverydayChange = (v?: string): v is EverydayChange =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(CHANGE_CATALOG, v);

/**
 * Does this change belong to this object? Imported by the GENERATOR too, so a
 * pairing that would drop build-side is never emitted - the pack's standing
 * shape: one rule, two consumers, never two copies.
 */
export const changeFitsObject = (change: EverydayChange, obj: MatterObjectLike): boolean => {
  const def = CHANGE_CATALOG[change];
  if (!isMatterState(obj.state)) return false;
  if (!def.states.includes(obj.state)) return false;
  return (obj.canChangeState === true) === def.needsChangeable;
};

// ── The leak vocabulary (see the header for why it is not the shared list) ──

/** The three answer words and their inflections. `ice` and `steam` are
 *  deliberately ABSENT: they are objects here, not answers. */
export const STATE_ANSWER_WORDS = ['solid', 'liquid', 'gas', 'gases', 'gaseous', 'solids', 'liquids'] as const;

/** Words that name the shape BEHAVIOUR, i.e. the `name_property` answer and
 *  the route to the other two. An object whose NAME carries one of these
 *  answers its own question. */
export const SHAPE_ANSWER_WORDS = ['flows', 'flowing', 'pours', 'pouring'] as const;

/** Words that would put the `name_undo` ANSWER inside its own premise. The
 *  stories are code-owned, so this gate protects a future edit to them rather
 *  than a generated string — cheap, and it fails loudly by dropping the item. */
export const UNDO_ANSWER_WORDS = [
  'back', 'ever', 'forever', 'never', 'undone', 'again', 'unchanged',
] as const;

const containsWord = (text: string, words: readonly string[]): boolean => {
  const tokens = text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
  return tokens.some((t) => words.includes(t as (typeof words)[number]));
};

/**
 * Defect 11: the stimulus's own LABEL can be the answer. A button label is
 * scenery; a label the tutor READS ALOUD is the question. "liquid soap" and
 * "solid chocolate" are real household objects and a K-2 generator reaches for
 * them, at which point the tutor asks "is the liquid soap a solid, a liquid,
 * or a gas?" and the child never has to look at the screen.
 */
export const nameCarriesAnswer = (name: string): boolean =>
  containsWord(name, STATE_ANSWER_WORDS) || containsWord(name, SHAPE_ANSWER_WORDS);

/**
 * Vessels. A gas is invisible, so a K-2 generator reaches for the thing holding
 * it and names that instead — and the resulting key is FALSE, not merely loose.
 *
 * DEFECT 8, caught the only way it can be: by writing the spoken ask and
 * listening to it. The first drive said *"the inflated balloon spreads out and
 * fills the whole room"* and *"the party balloon is a gas"*. A balloon is
 * rubber. In a data field `{name: "party balloon", state: "gas"}` looks like a
 * reasonable shorthand; out loud it is a lie, and the child who says "solid"
 * — correctly, about the balloon — is corrected for being right.
 *
 * ⚠️ THIS IS IN CODE BECAUSE PROSE ALREADY FAILED. The prompt was given the
 * rule AND a worked counter-example naming "inflated balloon" specifically;
 * the very next generation shipped "party balloon". A rule that has been
 * ignored with a counter-example in front of it needs a different LEVER, not a
 * third paragraph (the fast-fact repair, 2026-09-02).
 *
 * NARROW ON PURPOSE — it fires only when the state is `gas`. A drinking glass
 * is a perfectly good solid and a cup of water a perfectly good liquid; it is
 * only the GAS named after its container that has no defensible answer. The
 * compare-objects exemption that got refuted by its very next draw is the
 * warning against widening this without a draw that demands it.
 */
export const GAS_VESSEL_WORDS = [
  'balloon', 'bottle', 'jar', 'can', 'canister', 'box', 'bag', 'cup', 'glass',
  'tank', 'tyre', 'tire', 'ball', 'straw', 'kettle', 'pot',
] as const;

export const gasNamesItsVessel = (name: string, state: string): boolean =>
  state === 'gas' && containsWord(name, GAS_VESSEL_WORDS);

// ============================================================================
// The split (standing gate 1 arithmetic, not a preference)
// ============================================================================

/** Every mode SPEAKS. There is no gesture item in this pack — see the header;
 *  the three bins were never the page, they were a menu with a drag on it. */
export const answerKindFor = (_kind: MatterKind): 'voice' | 'gesture' => 'voice';

export const responseClassFor = (kind: MatterKind): ResponseClassId => {
  switch (kind) {
    case 'name_state':
    case 'mystery_state':
      // One short word from a closed three-word set, ear-separable by
      // construction: solid / liquid / gas share no phoneme run.
      return 'short_spoken_word';
    case 'name_property':
      // A whole proposition picked from a menu the ask states. Free production
      // here would be open-set ("it goes squishy", "it runs away") — the menu
      // IS the ask, and the BUTTON is what the port deletes, not the menu.
      return 'closed_set_choice';
    case 'name_undo':
      // Two propositions, and the ask names both. Same arithmetic as the
      // sibling above: the judge classifies against a menu it was handed, so a
      // proposition-shaped answer stays spoken instead of becoming a button.
      return 'closed_set_choice';
  }
};

// ============================================================================
// Items
// ============================================================================

export interface MatterExplorerItem extends JudgedScriptItem {
  challengeType: MatterChallengeType;
  kind: MatterKind;
  tier: MatterTier;
  /** The object under the lens. Its name is WITHHELD on `mystery_state`. */
  objectName: string;
  objectId: string;
  /** The spoken answer for `name_state` / `mystery_state`. */
  answerState: MatterState;
  /** The spoken answer for `name_property`. */
  answerShape: ShapeBehaviour;
  /** `mystery_state` only: the clues the ask speaks, already leak-screened. */
  clues?: string[];
  /** `name_undo` only: WHICH everyday change happened, from the closed menu. */
  change?: EverydayChange;
  /** `name_undo` only: the answer, read from `CHANGE_CATALOG` and never from
   *  the payload — the LLM never says whether its change can be undone. */
  answerUndo?: Reversibility;
}

/** Structural challenge shape as the draw emits it. */
export interface MatterChallengeLike {
  id: string;
  challengeType: string;
  kind?: string;
  objectId?: string;
}

/** The clue vocabulary a mystery ask may speak. `shape` and `flexibility` are
 *  BANNED — they are the answer and the route to it. What is left is genuinely
 *  observational and genuinely under-determining, which is what makes the mode
 *  harder than `sort` rather than merely wordier. */
const CLUE_FIELDS = ['color', 'texture', 'transparency', 'weight'] as const;

const clueLine = (field: (typeof CLUE_FIELDS)[number], value: string): string => {
  switch (field) {
    case 'color': return `it looks ${value}`;
    case 'texture': return `it feels ${value}`;
    case 'transparency': return `it is ${value}`;
    case 'weight': return `it is ${value} to hold`;
  }
};

/**
 * One judged item, or null when the object cannot be ASKED. Keep-or-drop,
 * never backfill: a placeholder in a judged loop becomes a spoken ask the
 * tutor must judge, and there is no honest verdict behind it.
 *
 * The gates and what each protects:
 *  - `state` must be one of the three, and `shape` must AGREE with it — the
 *    self-contradiction gate the click era never needed because nothing read
 *    `shape`; a disagreeing payload has no defensible answer for at least one
 *    of the two modes that read it;
 *  - the object's NAME may not carry a state or flow word (defect 11), and a
 *    GAS may not be named after its vessel — "party balloon" is rubber, and
 *    the key that calls it a gas is false out loud (defect 8);
 *  - nothing speakable may open with a sentinel token — object names are
 *    GENERATED here, so this is a live risk rather than a formality;
 *  - `mystery_state` needs at least two leak-clean clues, or the ask
 *    under-determines to the point of being unanswerable rather than hard;
 *  - a clue value may not itself carry the answer vocabulary (a generator that
 *    writes `texture: "flows"` into a free-text colour field, say).
 */
export const itemFromChallenge = (
  ch: MatterChallengeLike,
  objects: MatterObjectLike[],
  opts: { band: MatterBand; tier?: MatterTier } = { band: 'K-1' },
): MatterExplorerItem | null => {
  const challengeType = normalizeChallengeType(ch.challengeType, ch.kind);
  if (!challengeType) return null;

  const obj = objects.find((o) => o.id === ch.objectId);
  if (!obj) return null;

  if (!isMatterState(obj.state)) return null;
  const shape = obj.properties?.shape;
  if (!isShapeBehaviour(shape)) return null;
  // The rule must hold in the DATA before it is taught in the ask.
  if (STATE_OF_SHAPE[shape] !== obj.state) return null;

  const name = (obj.name || '').trim();
  if (!name) return null;
  if (nameCarriesAnswer(name)) return null;
  // A gas named after the thing holding it has a FALSE key, not a hard one.
  if (gasNamesItsVessel(name, obj.state)) return null;
  if (opensWithSentinel(name)) return null;

  const kind: MatterKind =
    challengeType === 'sort' ? 'name_state'
      : challengeType === 'property' ? 'name_property'
        : challengeType === 'change' ? 'name_undo'
          : 'mystery_state';

  // `name_undo` is the one mode with a gate on a field the other three never
  // read. Keep-or-drop as everywhere else: a change that does not belong to
  // this object has no defensible answer, and there is nothing to backfill it
  // with — the object stays perfectly askable in the other three modes.
  let change: EverydayChange | undefined;
  let answerUndo: Reversibility | undefined;
  if (kind === 'name_undo') {
    const declared = obj.everydayChange;
    if (!isEverydayChange(declared)) return null;
    if (!changeFitsObject(declared, obj)) return null;
    const story = CHANGE_CATALOG[declared].storyFor(name);
    if (opensWithSentinel(story)) return null;
    if (containsWord(story, UNDO_ANSWER_WORDS)) return null;
    change = declared;
    answerUndo = CHANGE_CATALOG[declared].reversibility;
  }

  let clues: string[] | undefined;
  if (kind === 'mystery_state') {
    clues = CLUE_FIELDS
      .map((f) => {
        const value = (obj.properties?.[f] || '').trim();
        if (!value) return null;
        if (containsWord(value, STATE_ANSWER_WORDS) || containsWord(value, SHAPE_ANSWER_WORDS)) return null;
        if (opensWithSentinel(value)) return null;
        return clueLine(f, value);
      })
      .filter((c): c is string => c !== null);
    // Under two clues the ask is a guess, not a deduction. Drop it.
    if (clues.length < 2) return null;
    clues = clues.slice(0, 3);
  }

  return {
    id: ch.id,
    answerKind: answerKindFor(kind),
    responseClass: responseClassFor(kind),
    action: kind,
    challengeType,
    kind,
    tier: opts.tier ?? (opts.band === 'K-1' ? 'easy' : 'medium'),
    objectName: name,
    objectId: obj.id,
    answerState: obj.state,
    answerShape: shape,
    clues,
    change,
    answerUndo,
  };
};

/** The generator's challenge enum is WIDER than the eval modes and predates
 *  them. `describe` was a click-to-view credit and `predict`/`compare` were
 *  both scored unconditionally correct, so none of the three carries a real
 *  answer — they map onto the property mode, which asks the observational
 *  question they were gesturing at and can actually be judged. */
export const normalizeChallengeType = (
  challengeType: string,
  kind?: string,
): MatterChallengeType | null => {
  const v = (kind || challengeType || '').toLowerCase();
  if (v === 'sort') return 'sort';
  if (v === 'mystery') return 'mystery';
  if (v === 'change') return 'change';
  if (v === 'property' || v === 'describe' || v === 'predict' || v === 'compare') return 'property';
  return null;
};

/**
 * How many answers the mode has to choose between. The alternation rule below
 * reads it, and it is the whole reason `name_undo` needs a different rule from
 * its three siblings rather than the same one applied harder.
 */
export const ANSWER_SET_WIDTH: Readonly<Record<MatterKind, number>> = {
  name_state: 3,
  name_property: 3,
  mystery_state: 3,
  name_undo: 2,
};

export const answerTokenOf = (item: MatterExplorerItem): string =>
  item.kind === 'name_property' ? item.answerShape
    // A two-answer mode reaches "same answer twice in a row" far faster than a
    // three-answer one, so this token is what keeps a change run alternating.
    : item.kind === 'name_undo' ? (item.answerUndo ?? 'can_go_back')
      : item.answerState;

/**
 * Build the session — and this is where the port's biggest measurement change
 * lives (defect class 1). A click-era `sort` challenge was ONE screenful over
 * every object and ONE all-or-nothing boolean. A judged sort is one ask per
 * OBJECT, so a challenge naming eight objects becomes eight items and a child
 * who knows seven of them now scores seven.
 *
 * Three rules ride on top, and the third matters more here than in any sibling
 * port because THIS pack's answer set is three words wide:
 *  - defect 2: an object appears in ONE item per session, in any role. Every
 *    item closes by naming its object's state aloud, so a second item on the
 *    same object is recall, not classification.
 *  - consecutive items of the same ACTION may not share an answer. Six sort
 *    items in a row that are all "solid" teach a child to say "solid", and a
 *    one-in-three answer set reaches that state by accident constantly.
 *  - SELECT, never truncate (the word-sorter stranding): the cap keeps the
 *    first item of each state it can, so a shortened session still spans the
 *    three answers instead of stopping after the solids.
 */
export const itemsFromChallenges = (
  challenges: MatterChallengeLike[],
  objects: MatterObjectLike[],
  opts: { band: MatterBand; tier?: MatterTier; maxItems?: number } = { band: 'K-1' },
): MatterExplorerItem[] => {
  const expanded: MatterChallengeLike[] = [];
  for (const ch of challenges) {
    if (ch.objectId) { expanded.push(ch); continue; }
    // A challenge that names no object is a screenful over ALL of them.
    objects.forEach((o, i) => expanded.push({ ...ch, id: `${ch.id}::${i}`, objectId: o.id }));
  }

  const built: MatterExplorerItem[] = [];
  const usedObjects = new Set<string>();
  for (const ch of expanded) {
    const item = itemFromChallenge(ch, objects, opts);
    if (!item) continue;
    if (usedObjects.has(item.objectId)) continue;
    usedObjects.add(item.objectId);
    built.push(item);
  }

  const cap = opts.maxItems ?? 8;

  /**
   * GROUP EACH MODE INTO A RUN (defect class 13, caught on this port's first
   * headless drive, 2026-09-02).
   *
   * The runner re-speaks the how-to-play whenever `action` changes. An
   * interleaved draw — sort, property, sort, mystery — therefore makes EVERY
   * item an action change, and the child hears the full protocol plus the rule
   * clause before every single question. The first drive did exactly that on
   * 4 of 4 items:
   *   [ask:chal-2] "I name something you know — you say what it does when you
   *                 put it in a cup, out loud! Everything you can touch does…"
   *   [ask:chal-3] "I name something you know — you say what state it is, out
   *                 loud! A solid keeps its own shape…"
   * ~14s of recitation against a ~3s answer, per round.
   *
   * `findRepeatedConsecutiveAsks` cannot see this: consecutive items have
   * different actions by construction, which is the gate's own precondition.
   * The tell is in the drive transcript and nowhere else, which is why this is
   * fixed in the DRAW rather than in a cue.
   *
   * So the modes ship as RUNS in ladder order (sort → property → mystery,
   * easy → hard), and the no-repeated-answer rule applies WITHIN a run, where
   * it is doing the work it was written for: back-to-back sort items that are
   * all "solid" teach a child to say "solid".
   */
  // Ladder order, which is also catalog beta order: sort -1.0, property 0.5,
  // change 1.2, mystery 2.0.
  const MODE_ORDER: MatterKind[] = ['name_state', 'name_property', 'name_undo', 'mystery_state'];
  const runs = MODE_ORDER.map((kind) => built.filter((i) => i.kind === kind));

  const selected: MatterExplorerItem[] = [];
  for (const run of runs) {
    const pending = [...run];
    while (pending.length && selected.length < cap) {
      const prev = selected[selected.length - 1];
      // Only the ANSWER may not repeat back to back; the action deliberately
      // does, because that is what buys the run.
      let idx = pending.findIndex(
        (c) => !prev || prev.action !== c.action || answerTokenOf(prev) !== answerTokenOf(c),
      );
      if (idx === -1) {
        /**
         * NOTHING LEFT THAT ALTERNATES. What happens next depends on how wide
         * the mode's answer set is, and the difference is not a preference —
         * it is arithmetic caught on the FIRST live probe of `change`
         * (2026-09-03), where the machine gates were all green:
         *
         *   4 generated challenges -> 2 items. One melt against a tear, a burn
         *   and a bake; after ice(go back) and paper(for ever) every remaining
         *   item repeated the previous answer, so the run stopped and two
         *   perfectly good asks were stranded.
         *
         * With three answers that case is rare and stopping is the right
         * trade. With two it is the COMMON case, because any draw that is not
         * near-balanced reaches it immediately. So a two-wide mode takes the
         * repeat: "SELECT, never truncate" (the word-sorter stranding) is the
         * law, and the alternation is a preference sitting under it. The
         * three-answer modes keep the hard stop, byte-for-byte.
         */
        if (ANSWER_SET_WIDTH[pending[0].kind] > 2) break;
        idx = 0;
      }
      selected.push(pending.splice(idx, 1)[0]);
    }
  }
  return selected;
};

// ============================================================================
// How to play, lead-in, asks
// ============================================================================

export const howToPlayFor = (item: MatterExplorerItem): string => {
  switch (item.kind) {
    case 'name_state':
      return 'I name something you know — you say what state it is, out loud! ';
    case 'name_property':
      return 'I name something you know — you say what it does when you put it in a cup, out loud! ';
    case 'name_undo':
      // Says the QUESTION and neither option: the menu is the ask and lives
      // there. "put it back" deliberately avoids the answer token "go back",
      // which the drive harness scans this line for.
      return 'I tell you what happened to something — you say if we could put it back the way it was, out loud! ';
    case 'mystery_state':
      return 'I give you clues about a secret thing — you say what state it is, out loud! ';
  }
};

/**
 * The two model lines that NAME ALL THREE STATES. The mats rule in lead-in
 * form: a rule that maps every state cannot disclose which one is the answer,
 * and the mapping IS the lesson. Both are exported and subtracted as
 * leak-exempt spans, tier-conditionally — `hard` speaks no lead-in at all, so
 * the tier is a real spoken lever and not a change of tone.
 */
export const STATE_RULE_CLAUSE =
  'A solid keeps its own shape, a liquid takes the shape of whatever you pour it into, and a gas spreads out to fill the whole room.';
export const PROPERTY_RULE_CLAUSE =
  'Everything you can touch does one of three things in a cup: keeps its own shape, takes the cup\'s shape, or spreads out and fills the room.';
/** Names BOTH classes, so it cannot disclose which one this item is — the mats
 *  rule in lead-in form, and the mapping IS the lesson. */
export const CHANGE_RULE_CLAUSE =
  'Some changes can go back the way they were, and some changes are for ever.';

const modelLine = (item: MatterExplorerItem): string => {
  switch (item.kind) {
    case 'name_state':
    case 'mystery_state':
      return STATE_RULE_CLAUSE;
    case 'name_property':
      return PROPERTY_RULE_CLAUSE;
    case 'name_undo':
      return CHANGE_RULE_CLAUSE;
  }
};

const guideLine = (item: MatterExplorerItem): string => {
  switch (item.kind) {
    case 'name_state': return 'Picture it in your hands before you answer.';
    case 'name_property': return 'Picture pouring it into a cup.';
    case 'name_undo': return 'Picture how it was before, and how it is now.';
    case 'mystery_state': return 'Listen to all the clues before you answer.';
  }
};

/** Speaks ONLY where the how-to-play does (the introduction of an action),
 *  never per item — DISTAR fades the model, it does not re-read it. */
const leadInFor = (item: MatterExplorerItem): string => {
  switch (item.tier) {
    case 'hard': return '';
    case 'easy': return `${modelLine(item)} ${guideLine(item)} `;
    case 'medium':
    default: return `${modelLine(item)} `;
  }
};

/** The three-way menu, spoken ONLY at the easy tier — naming the options turns
 *  production into a one-in-three pick, so the supported tier gets it and
 *  `hard` becomes a real spoken lever. `name_property` is the exception: its
 *  menu is the ask itself (the mats rule) and is spoken at every tier, because
 *  free production there would be open-set. */
export const namesTheStateMenu = (item: MatterExplorerItem): boolean =>
  (item.kind === 'name_state' || item.kind === 'mystery_state') && item.tier === 'easy';

export const STATE_MENU_CLAUSE = 'solid, liquid, or gas?';

const askFor = (item: MatterExplorerItem): string => {
  switch (item.kind) {
    case 'name_state': {
      const head = `Think about the ${item.objectName}. Your turn. Say what state it is`;
      return namesTheStateMenu(item) ? `${head} — ${STATE_MENU_CLAUSE}` : `${head}.`;
    }
    case 'name_property': {
      // The menu IS the ask. Spoken at every tier and leak-exempt by
      // construction; without it the answer set is open and unjudgeable.
      return `Think about the ${item.objectName} going into a cup. Your turn. Tell me what it does — ${PROPERTY_MENU_CLAUSE}`;
    }
    case 'name_undo': {
      // The change is the PREMISE, not a leak: knowing that melting undoes and
      // cooking does not IS the mode. The menu is the ask (the mats rule) and
      // is spoken at every tier, because free production here would be open-set.
      return `${CHANGE_CATALOG[item.change!].storyFor(item.objectName)}. Your turn. Tell me — ${CHANGE_MENU_CLAUSE}`;
    }
    case 'mystery_state': {
      // The object's NAME is withheld — that withholding is the whole mode.
      const head = `I am thinking of something secret. Here are the clues: ${item.clues!.join(', ')}. Your turn. Say what state my secret thing is`;
      return namesTheStateMenu(item) ? `${head} — ${STATE_MENU_CLAUSE}` : `${head}.`;
    }
  }
};

// ============================================================================
// Corrections and affirmations — DISTAR re-model then re-elicit
// ============================================================================
// Every one re-models the RULE and hands the question back; none of them lands
// the answer, so the correction teaches the route and the child still earns it.

const correctionFor = (item: MatterExplorerItem): string => {
  switch (item.kind) {
    case 'name_state':
      return `My turn: ${STATE_RULE_CLAUSE} Your turn. Think about the ${item.objectName} again and say what state it is.`;
    case 'name_property':
      return `My turn: some things hold their own shape however you move them, some things run into the corners of whatever holds them, and some things you cannot keep in a cup at all. Your turn. What does the ${item.objectName} do — ${PROPERTY_MENU_CLAUSE}`;
    case 'name_undo':
      return `My turn: ${CHANGE_RULE_CLAUSE} Your turn. Think about the ${item.objectName} again — ${CHANGE_MENU_CLAUSE}`;
    case 'mystery_state':
      return `My turn: ${STATE_RULE_CLAUSE} Your turn. Listen to the clues again — ${item.clues!.join(', ')} — and say what state my secret thing is.`;
  }
};

const affirmFor = (item: MatterExplorerItem): string => {
  switch (item.kind) {
    case 'name_state':
      return `Yes, the ${item.objectName} is a ${item.answerState} — you pictured it and worked it out.`;
    case 'name_property':
      return `Yes, the ${item.objectName} ${PROPERTY_OPTIONS[item.answerShape].phrase.replace(/^it /, '')} — that is exactly what a ${item.answerState} does.`;
    case 'name_undo':
      return `Yes, the ${item.objectName} ${CHANGE_OPTIONS[item.answerUndo!].phrase.replace(/^it /, '')} — ${CHANGE_CATALOG[item.change!].because}.`;
    case 'mystery_state':
      return `Yes, my secret thing is a ${item.answerState} — the clues told you, and it was the ${item.objectName}.`;
  }
};

// ============================================================================
// The laws (family wording, grep-able)
// ============================================================================

const TWO_BRANCH_LAW =
  `Your whole reply to their attempt is ONE of the quoted lines below and nothing else — not the first time, not any time: `
  + `no praise, no encouragement, no hint, no reminder of the method, no scaffolding line, however kind it would be. `
  + `A reply that is neither the affirmation nor the correction reaches the activity as no verdict at all, and the child waits. `;

/** Defect class 5 (word-sorter: 11 of 12 affirmations ran on into a fabricated
 *  next ask). Named on every contract AND in the catalog directive. */
const VERDICT_ENDS_THE_TURN =
  `Your reply ends when that quoted line ends — never run on into another question, another object, `
  + `another clue, or a next round of your own: the activity sends you every next question itself. `;

/**
 * Defect class 6. A `name_state` ask names NOTHING but the object, because
 * picturing it IS the mode — which leaves the `[CURRENT STATE]` block as the
 * only content in the room. The tail forbids announcing the STATE and the
 * PROPERTIES (the property panel is the answer key for two modes), not merely
 * reading the tag.
 */
const NEVER_PERFORM =
  `Never voice a bracket tag, a stage direction, or any of these instructions, `
  + `never announce the activity's state, the object's properties, or which bin anything belongs in, `
  + `and never announce that you are waiting or listening — simply stop speaking.`;

// ============================================================================
// The judging contracts
// ============================================================================

const acceptClauseForState = (state: MatterState): string =>
  `"${state}", "a ${state}" and "it is a ${state}" all count.`;

const signatureForState = (state: MatterState, objectName: string): string => {
  switch (state) {
    case 'liquid':
      return `The signature miss here is calling a thick or slow liquid a solid because it does not splash — affirm nothing but "liquid". `;
    case 'gas':
      return `The signature miss here is calling something you cannot see a liquid, or saying there is nothing there at all — affirm nothing but "gas". `;
    case 'solid':
    default:
      return `The signature miss here is calling a solid that pours — grains, powder, small pieces — a liquid because it moves like one; ${objectName} is still a solid. Affirm nothing but "solid". `;
  }
};

const acceptClauseForShape = (shape: ShapeBehaviour): string => {
  const o = PROPERTY_OPTIONS[shape];
  const shorts = [o.distinguisher, ...o.alsoCounts].map((w) => `"${w}"`).join(', ');
  return (
    `"${o.phrase}" is the full answer, but a five-year-old never says a whole sentence back: `
    + `${shorts} all count on their own, and so does the phrase inside a longer sentence. `
  );
};

const acceptClauseForChange = (reversibility: Reversibility): string => {
  const o = CHANGE_OPTIONS[reversibility];
  const shorts = [o.distinguisher, ...o.alsoCounts].map((w) => `"${w}"`).join(', ');
  return (
    `"${o.phrase}" is the full answer, but a five-year-old answers the yes-or-no they heard first: `
    + `${shorts} all count on their own, and so does the phrase inside a longer sentence. `
  );
};

/** The two misses, and they are opposite errors rather than one error twice —
 *  which is what stops this two-answer mode being scored as a coin flip. */
const signatureForChange = (reversibility: Reversibility): string =>
  reversibility === 'can_go_back'
    ? `The signature miss here is deciding that anything which LOOKS different must be gone for good — `
      + `a change you can undo is still a change, and this one undoes. `
    : `The signature miss here is deciding every change can be undone because the thing is still there `
      + `in front of you — being able to see it does not make it what it was. `;

const judgingContract = (item: MatterExplorerItem): string => {
  const head =
    `The quoted line is the ONLY thing you say on this turn; you then stay silent while the learner `
    + `pictures it and thinks, and their think time is unbounded. Never say the answer during their turn. `;

  let body = '';
  switch (item.kind) {
    case 'name_state': {
      body =
        `The correct answer is "${item.answerState}". ${acceptClauseForState(item.answerState)} `
        + `Saying the object's own name back — "${item.objectName}" — is NOT an answer however confidently it is said: `
        + `the question asks what STATE it is in, not what it is called. `
        + signatureForState(item.answerState, item.objectName)
        + `Any other state word is wrong. `;
      break;
    }
    case 'name_property': {
      const o = PROPERTY_OPTIONS[item.answerShape];
      const others = (Object.keys(PROPERTY_OPTIONS) as ShapeBehaviour[])
        .filter((s) => s !== item.answerShape)
        .map((s) => `"${PROPERTY_OPTIONS[s].distinguisher}"`)
        .join(' or ');
      body =
        `The learner picks ONE of the three things the question offered. The correct one is "${o.phrase}". `
        + acceptClauseForShape(item.answerShape)
        + `Picking ${others} is wrong. `
        + `Naming the STATE instead — saying "${item.answerState}" — is the signature miss: it is the right idea `
        + `answering a different question, and this mode asks what the thing DOES, not what it is called. `
        + `Count it wrong and correct it. `
        + `If what they said does not clearly pick one of the three, it is wrong. `;
      break;
    }
    case 'name_undo': {
      const answer = CHANGE_OPTIONS[item.answerUndo!];
      const other = CHANGE_OPTIONS[OTHER_REVERSIBILITY[item.answerUndo!]];
      body =
        `The learner picks ONE of the two things the question offered. The correct one is "${answer.phrase}". `
        + acceptClauseForChange(item.answerUndo!)
        + `Picking "${other.distinguisher}" is wrong. `
        + `Naming the STATE — saying "solid", "liquid" or "gas" — is not an answer to this question: `
        + `it asks whether the change can be undone, not what the thing is made of. Count it wrong and correct it. `
        + `Saying the change back — "it melted", "it got burnt" — repeats the question and is not an answer either. `
        + signatureForChange(item.answerUndo!)
        + `If what they said does not clearly pick one of the two, it is wrong. `;
      break;
    }
    case 'mystery_state': {
      body =
        `The correct answer is "${item.answerState}". ${acceptClauseForState(item.answerState)} `
        + `Naming the object itself — guessing "${item.objectName}" or any other thing — is NOT an answer: `
        + `the question asks for the STATE, and a learner who names the object has still not said one. `
        + `Treat a named object with no state word as wrong and correct it. `
        + signatureForState(item.answerState, 'a secret thing')
        + `Any other state word is wrong. `;
      break;
    }
  }

  return (
    head + body + TWO_BRANCH_LAW + VERDICT_ENDS_THE_TURN
    + `If the answer is right, say exactly: "${affirmFor(item)}" `
    + `If it is wrong, say exactly: "${correctionFor(item)}"`
  );
};

// ============================================================================
// Cues
// ============================================================================

export interface MatterCueOptions {
  opening?: boolean;
  howToPlay?: boolean;
}

export const itemCue = (
  item: MatterExplorerItem,
  opts: MatterCueOptions = {},
): string => {
  const greeting = opts.opening ? 'Hi! Time to find out what everything around us is made of! ' : '';
  const introducing = !!(opts.opening || opts.howToPlay);
  const how = introducing ? howToPlayFor(item) : '';
  const lead = introducing ? leadInFor(item) : '';
  const spoken = `${greeting}${how}${lead}${askFor(item)}`;
  return `[MEX_ITEM] Say exactly: "${spoken}" ${judgingContract(item)} ${NEVER_PERFORM}`;
};

/** Correction cap reached: acknowledge warmly, CLOSE THE LINK by naming what
 *  the corrections could not, and carry the lesson forward. */
const closeLineFor = (item: MatterExplorerItem): string => {
  switch (item.kind) {
    case 'name_state':
      return `The ${item.objectName} is a ${item.answerState}. `;
    case 'name_property':
      return `The ${item.objectName} ${PROPERTY_OPTIONS[item.answerShape].phrase.replace(/^it /, '')}. `;
    case 'name_undo':
      return `The ${item.objectName} ${CHANGE_OPTIONS[item.answerUndo!].phrase.replace(/^it /, '')}. `;
    case 'mystery_state':
      return `My secret thing was the ${item.objectName}, and it is a ${item.answerState}. `;
  }
};

export const moveOnCue = (
  item: MatterExplorerItem,
  next: MatterExplorerItem | null,
  opts: MatterCueOptions = {},
): string => {
  const closeLine = closeLineFor(item);
  if (!next) {
    return (
      `[MEX_MOVE] Say exactly: "Good try! ${closeLine}Sorting the world takes practice — we will hunt for more another day." `
      + `Then stop.`
    );
  }
  const introducing = !!opts.howToPlay;
  const how = introducing ? howToPlayFor(next) : '';
  const lead = introducing ? leadInFor(next) : '';
  return (
    `[MEX_MOVE] Say exactly: "Good try! ${closeLine}Here comes the next one. ${how}${lead}${askFor(next)}" `
    + `${judgingContract(next)} ${NEVER_PERFORM}`
  );
};

export const completeCue = (): string =>
  `[MEX_COMPLETE] Say exactly: "What great science today! You looked at ordinary things and worked out what they are made of. See you next time!" Then stop — the activity is over.`;

/** Tap-to-hear re-speaks the QUESTION, never the answer. Never withdrawn. */
export const pronounceCue = (item: MatterExplorerItem): string => {
  const line = (() => {
    switch (item.kind) {
      case 'name_state': {
        const head = `Think about the ${item.objectName}. Say what state it is`;
        return namesTheStateMenu(item) ? `${head} — ${STATE_MENU_CLAUSE}` : `${head}.`;
      }
      case 'name_property':
        return `The ${item.objectName} goes into a cup. What does it do — ${PROPERTY_MENU_CLAUSE}`;
      case 'name_undo':
        return `${CHANGE_CATALOG[item.change!].storyFor(item.objectName)}. Tell me — ${CHANGE_MENU_CLAUSE}`;
      case 'mystery_state': {
        const head = `The clues are: ${item.clues!.join(', ')}. Say what state my secret thing is`;
        return namesTheStateMenu(item) ? `${head} — ${STATE_MENU_CLAUSE}` : `${head}.`;
      }
    }
  })();
  return (
    `[MEX_HEAR] The learner tapped to hear the question again. Say ONLY this, warmly, then wait: "${line}" `
    + `Do not treat anything you just heard as an answer, add nothing, and never say the answer. `
    + NEVER_PERFORM
  );
};

/**
 * Runtime state pushed through the context channel — STIMULUS-SIDE ONLY, and
 * answer-free by construction. NEVER the object's `shape` or `flexibility`
 * (those are the answer key for two modes), never which bin it belongs in, and
 * on `mystery_state` never the object's NAME.
 *
 * Defect 12: this string goes LAST in the catalog's `taskDescription`, with the
 * never-read-aloud clause IMMEDIATELY before it. The `name_state` line states
 * its own non-speakability inline as well — that ask names nothing but the
 * object BY DESIGN, which is the exact shape that turns the state block into a
 * live audio channel.
 */
export const stimulusFor = (item: MatterExplorerItem): string => {
  switch (item.kind) {
    case 'name_state':
      return `a picture of the ${item.objectName} beside three empty bins, waiting to be named; `
        + `this state line is for you alone and is never spoken to the learner`;
    case 'name_property':
      return `a picture of the ${item.objectName} beside an empty cup`;
    case 'name_undo':
      // What HAPPENED is on screen; whether it undoes is not, in any field.
      return `a picture of the ${item.objectName} beside a line saying what happened to it`;
    case 'mystery_state':
      // The NAME is the answer's giveaway here and never crosses the wire.
      return 'a covered box with a question mark on it, and the clues written beside it';
  }
};

// ============================================================================
// THE WIRE — what the tutor is told, shared with the DI drive harness
// ============================================================================

export const matterExplorerPackBase = (
  items: MatterExplorerItem[],
): JudgedCueSurface<MatterExplorerItem> => ({
  primitiveType: 'matter-explorer',
  activityLine: 'live direct instruction matter classification practice',
  items,
  itemCue,
  moveOnCue,
  completeCue,
  pronounceCue,
  contextFor: (item) => ({
    challengeType: item.challengeType,
    stimulus: stimulusFor(item),
  }),
});

// ============================================================================
// Harness answer material — what a right and a wrong child sound like
// ============================================================================

const OTHER_STATE: Record<MatterState, MatterState> = {
  solid: 'gas',
  liquid: 'solid',
  gas: 'solid',
};

const OTHER_SHAPE: Record<ShapeBehaviour, ShapeBehaviour> = {
  keeps_shape: 'fills_space',
  takes_container: 'keeps_shape',
  fills_space: 'keeps_shape',
};

export const matterExplorerHarnessAnswers = (item: MatterExplorerItem) => {
  switch (item.kind) {
    case 'name_state':
      return {
        correct: item.answerState,
        plainWrong: OTHER_STATE[item.answerState],
        signatureWrong: {
          text: item.objectName,
          why: 'the object said back instead of its state — fluent, confident, and answering a question that was not asked; the contract names this miss',
        },
        leakTokens: [item.answerState],
        // Two tier-conditional exemptions and nothing else: the RULE clause in
        // the lead-in (it names all three states by construction, which is why
        // it can disclose none) and the three-way MENU at the end of the easy
        // ask. At `hard` the list is EMPTY and the whole cue is governed flat.
        leakExemptSpan: [
          ...(item.tier === 'hard' ? [] : [STATE_RULE_CLAUSE]),
          ...(namesTheStateMenu(item) ? [STATE_MENU_CLAUSE] : []),
        ],
      };
    case 'name_property':
      return {
        correct: PROPERTY_OPTIONS[item.answerShape].distinguisher,
        plainWrong: PROPERTY_OPTIONS[OTHER_SHAPE[item.answerShape]].distinguisher,
        signatureWrong: {
          text: item.answerState,
          why: 'the STATE named instead of what the thing does — the right idea answering a different question, and the likeliest confident miss on a mode that sits one step before classification',
        },
        leakTokens: [PROPERTY_OPTIONS[item.answerShape].distinguisher],
        // The menu is the ask (the mats rule): all three options are a legal
        // part of the question by construction, at every tier. The rule clause
        // joins them wherever the lead-in speaks.
        leakExemptSpan: [
          PROPERTY_MENU_CLAUSE,
          ...(item.tier === 'hard' ? [] : [PROPERTY_RULE_CLAUSE]),
        ],
      };
    case 'name_undo': {
      const answer = CHANGE_OPTIONS[item.answerUndo!];
      return {
        correct: answer.distinguisher,
        plainWrong: CHANGE_OPTIONS[OTHER_REVERSIBILITY[item.answerUndo!]].distinguisher,
        signatureWrong: {
          text: item.answerState,
          why: 'the STATE named instead of whether the change undoes — the answer this pack has been '
            + 'asking for all session, arriving on the one mode that does not want it',
        },
        leakTokens: [answer.distinguisher],
        // The menu is the ask (the mats rule): both options are a legal part of
        // the question at every tier, and the rule clause joins them wherever
        // the lead-in speaks. Outside those two spans the ask must not assert
        // either answer.
        leakExemptSpan: [
          CHANGE_MENU_CLAUSE,
          ...(item.tier === 'hard' ? [] : [CHANGE_RULE_CLAUSE]),
        ],
      };
    }
    case 'mystery_state':
      return {
        correct: item.answerState,
        plainWrong: OTHER_STATE[item.answerState],
        signatureWrong: {
          text: item.objectName,
          why: 'the OBJECT guessed instead of its state — the mode withholds the name, so naming it feels like winning; it is still not an answer to the question asked',
        },
        leakTokens: [item.answerState, item.objectName.toLowerCase()],
        leakExemptSpan: [
          ...(item.tier === 'hard' ? [] : [STATE_RULE_CLAUSE]),
          ...(namesTheStateMenu(item) ? [STATE_MENU_CLAUSE] : []),
        ],
      };
  }
};
