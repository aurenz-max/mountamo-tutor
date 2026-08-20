/**
 * statesOfMatterScript — HAND-AUTHORED judged-loop script for states-of-matter
 * (THIRD science port, SECOND chemistry port; qa/di/BACKLOG.md item 25). The
 * exact wording IS the pedagogy; these lines are authored per pack, never
 * generated.
 *
 * ── THE FORK: EVERY MODE SPEAKS, ZERO TAPS ──────────────────────────────────
 * The table picture (user ruling 2026-08-13): a teacher, one child, and a
 * beaker on a hot plate. Every question this primitive has ever graded is
 * answered OUT LOUD at that table —
 *
 *   observe  → the state          say "solid" / "liquid" / "gas"
 *   predict  → the state it WILL be, or the CHANGE it goes through
 *   compare  → one of two substances, both named in the ask
 *
 * — so all three modes are `voice`. The click era answered all of it with
 * multiple-choice tiles, a True/False pair and a free-text box; the costume
 * test cleared the whole board in one pass, because a child who cannot read a
 * particle view can still click one of three tiles.
 *
 * WHAT THE CHILD'S HANDS LOSE, AND WHY THAT IS NOT THE R6 MISTAKE. ten-frame's
 * frame was the student's PAPER, and deleting it would have deleted the work.
 * The temperature slider is not paper: the ask is "what state WILL it be", and
 * a slider beside a live beaker answers that by experiment — drag until the
 * picture changes, no science required. It is a Check button wearing a range
 * input's clothes, so the judged surface hands the slider to the TUTOR: the
 * experiment runs on the affirmation, as the reveal (component, `revealHeld`).
 *
 * ── CONTENT IS CODE, NOT GEMINI ─────────────────────────────────────────────
 * `SUBSTANCES` below holds every substance a judged session can draw, with real
 * melting and boiling points. Every answer key is COMPUTED from it, so the
 * flash-lite failure family (truncated schemas, invented keys) is structurally
 * absent from the answer path — the periodic-table rule, one port later. What
 * remains gate-worthy is the SCIENCE, and writing the asks aloud audited it
 * (defect 8): chocolate and butter have NO honest boiling point — they scorch
 * and decompose, they do not boil — so `boilingIsReal` gates every boil ask.
 * "Chocolate boils at 350 degrees" is a sentence the click-era generator was
 * happy to key and this port refuses to put in a tutor's mouth.
 *
 * ── REVEAL POLICIES ─────────────────────────────────────────────────────────
 *   name_state      the state is the ANSWER → no cue says it before the verdict.
 *                   The easy tier alone may name the three-way MENU, and that
 *                   clause is the one leak-exempt span — tier-CONDITIONAL, so
 *                   `hard` is a real spoken lever and not a change of tone.
 *   predict_state   the THRESHOLDS are the given and are always spoken (an ask
 *                   whose problem is not stated aloud is broken, not harder);
 *                   the resulting state is never said.
 *   predict_change  same, but the thresholds are spoken as TRANSITIONS ("turns
 *                   from solid to liquid at 60 degrees") — the ordinary
 *                   "melts at 60 degrees" phrasing hands over the answer word.
 *   compare         both names ARE the menu, spoken by construction (the mats
 *                   rule). The WINNER is never said.
 *
 * ── SENTINELS ───────────────────────────────────────────────────────────────
 * Engine defaults ("Yes" / "My turn"). Substance names are code-owned and none
 * opens with a sentinel token; `itemFromChallenge` scans them anyway.
 */

import {
  opensWithSentinel,
  type JudgedCueSurface,
  type JudgedScriptItem,
  type ResponseClassId,
} from '../../../hooks/judgedScriptContract';

export { opensWithSentinel };

export type StatesChallengeType = 'observe' | 'predict' | 'compare';
export type StatesKind =
  | 'name_state'
  | 'predict_state'
  | 'predict_change'
  | 'melt_first'
  | 'stay_solid';
export type MatterState = 'solid' | 'liquid' | 'gas';
export type PhaseChange = 'melting' | 'freezing' | 'boiling' | 'condensing';
export type StatesBand = 'K-2' | '3-5';
export type StatesTier = 'easy' | 'medium' | 'hard';

// ── The code-owned substance table ──────────────────────────────────────────

export interface SubstanceFacts {
  key: string;
  name: string;
  meltingPoint: number;
  boilingPoint: number;
  /**
   * Does this substance actually BOIL, or does it scorch and fall apart?
   * Chocolate, butter and coconut oil do the second, and the click-era
   * generator was happy to print a boiling point for all three. A spoken ask
   * cannot hedge: it either says "chocolate boils at 350 degrees" or the ask
   * does not exist. Gates every gas answer and every threshold sentence.
   */
  boilingIsReal: boolean;
  /** K-2 draws only from the everyday, above-freezing half of the table. */
  bands: readonly StatesBand[];
  color: { solid: string; liquid: string; gas: string };
}

export const SUBSTANCES: Readonly<Record<string, SubstanceFacts>> = {
  water: {
    key: 'water', name: 'Water', meltingPoint: 0, boilingPoint: 100, boilingIsReal: true,
    bands: ['K-2', '3-5'],
    color: { solid: '#93c5fd', liquid: '#3b82f6', gas: '#e2e8f0' },
  },
  wax: {
    key: 'wax', name: 'Wax', meltingPoint: 60, boilingPoint: 370, boilingIsReal: true,
    bands: ['K-2', '3-5'],
    color: { solid: '#fde68a', liquid: '#f59e0b', gas: '#fef3c7' },
  },
  chocolate: {
    key: 'chocolate', name: 'Chocolate', meltingPoint: 34, boilingPoint: 350, boilingIsReal: false,
    bands: ['K-2', '3-5'],
    color: { solid: '#78350f', liquid: '#92400e', gas: '#d6d3d1' },
  },
  butter: {
    key: 'butter', name: 'Butter', meltingPoint: 32, boilingPoint: 250, boilingIsReal: false,
    bands: ['K-2', '3-5'],
    color: { solid: '#fde047', liquid: '#facc15', gas: '#fef9c3' },
  },
  coconutOil: {
    key: 'coconutOil', name: 'Coconut Oil', meltingPoint: 24, boilingPoint: 300, boilingIsReal: false,
    bands: ['K-2', '3-5'],
    color: { solid: '#f8fafc', liquid: '#fbbf24', gas: '#fef3c7' },
  },
  iron: {
    key: 'iron', name: 'Iron', meltingPoint: 1538, boilingPoint: 2862, boilingIsReal: true,
    bands: ['3-5'],
    color: { solid: '#94a3b8', liquid: '#ef4444', gas: '#fca5a5' },
  },
  aluminum: {
    key: 'aluminum', name: 'Aluminum', meltingPoint: 660, boilingPoint: 2470, boilingIsReal: true,
    bands: ['3-5'],
    color: { solid: '#cbd5e1', liquid: '#f97316', gas: '#fed7aa' },
  },
  mercury: {
    key: 'mercury', name: 'Mercury', meltingPoint: -39, boilingPoint: 357, boilingIsReal: true,
    bands: ['3-5'],
    color: { solid: '#a1a1aa', liquid: '#71717a', gas: '#e4e4e7' },
  },
  nitrogen: {
    key: 'nitrogen', name: 'Nitrogen', meltingPoint: -210, boilingPoint: -196, boilingIsReal: true,
    bands: ['3-5'],
    color: { solid: '#c4b5fd', liquid: '#818cf8', gas: '#e0e7ff' },
  },
  oxygen: {
    key: 'oxygen', name: 'Oxygen', meltingPoint: -218, boilingPoint: -183, boilingIsReal: true,
    bands: ['3-5'],
    color: { solid: '#bae6fd', liquid: '#38bdf8', gas: '#e0f2fe' },
  },
};

export const substanceFactsOf = (key?: string): SubstanceFacts | null =>
  (key && SUBSTANCES[key]) || null;

/** Every substance a band may draw — ONE address, read by both sides of the
 *  wire (the letter-spotter rule: the draw imports this, never a copy). */
export const bandPool = (band: StatesBand): SubstanceFacts[] =>
  Object.values(SUBSTANCES).filter((s) => s.bands.includes(band));

export const stateAt = (s: SubstanceFacts, temp: number): MatterState => {
  if (temp < s.meltingPoint) return 'solid';
  if (temp < s.boilingPoint) return 'liquid';
  return 'gas';
};

/**
 * Ear-separability blocklist for compare menus (the `closed_set_choice` class
 * rule): both names ARE the menu, so a pair a child's utterance could fit BOTH
 * of is DROPPED, never judged leniently. `water`/`butter` rhyme outright;
 * `water`/`wax` share their onset inside a two-item menu; `nitrogen`/`oxygen`
 * share everything past the first syllable.
 */
export const CONFUSABLE_SUBSTANCE_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['water', 'butter'],
  ['water', 'wax'],
  ['nitrogen', 'oxygen'],
];

export const isConfusablePair = (a: string, b: string): boolean =>
  CONFUSABLE_SUBSTANCE_PAIRS.some(
    ([x, y]) => (x === a && y === b) || (x === b && y === a),
  );

/**
 * Defect 11 in this port's exact shape: THE STIMULUS'S OWN LABEL CAN BE THE
 * ANSWER. Every ask reads a substance's name aloud, so a substance called
 * "Ice", "Steam" or "Meltwater" answers an observe item before the child has
 * looked at anything. The code table carries none of these — and the gate runs
 * anyway, over the table AND over the generated lesson TITLE, which the judged
 * stage prints above the beaker. (A label on a button is scenery; a label the
 * tutor READS ALOUD is the question.)
 */
export const STATE_WORDS = ['solid', 'liquid', 'gas', 'ice', 'steam', 'vapor', 'vapour'] as const;
export const CHANGE_WORDS = ['melt', 'freez', 'boil', 'condens', 'frozen', 'molten'] as const;

export const carriesAnswerVocabulary = (text: string): boolean => {
  const low = text.toLowerCase();
  return STATE_WORDS.some((w) => low.includes(w)) || CHANGE_WORDS.some((w) => low.includes(w));
};

/**
 * How far a drawn temperature must sit from every threshold of its substance.
 * At exactly the melting point the component reads "liquid" while a child
 * reads "it is turning" — an ambiguous ask is not a harder task, it is a broken
 * one, so nothing is ever asked from inside the margin.
 */
export const TEMP_MARGIN = 5;

export const tempIsClearOfThresholds = (s: SubstanceFacts, temp: number): boolean =>
  Math.abs(temp - s.meltingPoint) >= TEMP_MARGIN
  && (!s.boilingIsReal || Math.abs(temp - s.boilingPoint) >= TEMP_MARGIN);

/** A state a substance can honestly REACH: gas only where boiling is real. */
export const reachableState = (s: SubstanceFacts, temp: number): MatterState | null => {
  const state = stateAt(s, temp);
  if (state === 'gas' && !s.boilingIsReal) return null;
  return state;
};

export const phaseChangeBetween = (from: MatterState, to: MatterState): PhaseChange | null => {
  if (from === 'solid' && to === 'liquid') return 'melting';
  if (from === 'liquid' && to === 'solid') return 'freezing';
  if (from === 'liquid' && to === 'gas') return 'boiling';
  if (from === 'gas' && to === 'liquid') return 'condensing';
  return null; // same state, or a sublimation this primitive does not teach
};

// ── Spoken forms ────────────────────────────────────────────────────────────

/**
 * A temperature as the tutor SAYS it. Left raw, a negative reads as "dash 210"
 * — this port's member of the `phonemeVoice` family: every number that reaches
 * a spoken line goes through here.
 */
export const tempSpoken = (t: number): string =>
  t < 0 ? `minus ${Math.abs(t)} degrees` : `${t} degrees`;

/**
 * Honest state words a child may use INSTEAD of the taught one. "Ice" for solid
 * water and "steam" for water vapour are right answers from a five-year-old,
 * and a contract that refuses them fails a child who has done the skill. Per
 * SUBSTANCE, because "ice" is not a word for solid iron.
 */
export const stateSynonymsFor = (s: SubstanceFacts, state: MatterState): string[] => {
  if (s.key !== 'water') return [];
  if (state === 'solid') return ['ice'];
  if (state === 'gas') return ['steam', 'water vapour'];
  return [];
};

const CHANGE_VERB: Record<PhaseChange, string> = {
  melting: 'melt',
  freezing: 'freeze',
  boiling: 'boil',
  condensing: 'condense',
};

const CHANGE_STORY: Record<PhaseChange, string> = {
  melting: 'the particles broke out of their fixed spots and started sliding',
  freezing: 'the particles slowed right down and locked back into place',
  boiling: 'the particles got so much energy they flew apart',
  condensing: 'the particles slowed down and pulled back together',
};

// ── The split (standing gate 1 arithmetic, not a preference) ────────────────

/** Every mode SPEAKS. There is no gesture item in this pack, and the absence is
 *  the port's whole point — see the header. */
export const answerKindFor = (_kind: StatesKind): 'voice' | 'gesture' => 'voice';

export const responseClassFor = (kind: StatesKind): ResponseClassId => {
  switch (kind) {
    case 'name_state':
    case 'predict_state':
    case 'predict_change':
      return 'short_spoken_word';
    case 'melt_first':
    case 'stay_solid':
      return 'closed_set_choice';
  }
};

// ── Items ───────────────────────────────────────────────────────────────────

export interface StatesOfMatterItem extends JudgedScriptItem {
  challengeType: StatesChallengeType;
  kind: StatesKind;
  tier: StatesTier;
  /** observe / predict: the substance under the lens. */
  substance?: SubstanceFacts;
  /** The temperature the beaker sits at while the child answers. */
  startTemp?: number;
  /** predict: where the tutor takes it. The REVEAL runs this, never the ask. */
  targetTemp?: number;
  startState?: MatterState;
  /** observe / predict_state: the spoken answer. */
  answerState?: MatterState;
  /** predict_change: the spoken answer. */
  answerChange?: PhaseChange;
  /** compare: the two substances ON OFFER, in ask order. */
  pair?: [SubstanceFacts, SubstanceFacts];
  /** compare: the spoken answer — one name from the pair. */
  answerName?: string;
}

/** Structural challenge shape as the draw emits it (duck-typed so this module
 *  never imports the component — the component imports us). */
export interface StatesChallengeLike {
  id: string;
  challengeType: string;
  kind?: string;
  substanceKey?: string;
  startTemp?: number;
  targetTemp?: number;
  pairKeys?: string[];
}

/**
 * One judged item, or null when the challenge cannot be ASKED. The gates and
 * what each protects:
 *  - every referenced substance must resolve, sit in the session's BAND, and
 *    carry no state/change word in its own name (defect 11);
 *  - every temperature must clear each threshold by `TEMP_MARGIN` — nothing is
 *    ever asked from inside the ambiguous band around a phase change;
 *  - a gas answer requires `boilingIsReal` — chocolate does not boil;
 *  - K-2 never hears a temperature below zero (its band pool is already
 *    above-freezing; this catches a hand-authored or cached payload);
 *  - `predict_change` needs a real four-way change — same state in and out, or
 *    a sublimation, is dropped rather than reworded — and is Grade 3-5 only;
 *  - compare pairs must be distinct, ear-separable, and BOTH SOLID at the start
 *    temperature: if one beaker is already a puddle the picture answers the
 *    question and the reasoning is optional (defect 11, in pixels);
 *  - `stay_solid` needs exactly ONE survivor at the target temperature, or the
 *    question has two answers or none;
 *  - nothing speakable may open with a sentinel token.
 */
export const itemFromChallenge = (
  ch: StatesChallengeLike,
  opts: { band: StatesBand; tier?: StatesTier } = { band: '3-5' },
): StatesOfMatterItem | null => {
  const band = opts.band;
  const tier = opts.tier ?? 'medium';
  const k2 = band === 'K-2';

  const usable = (s: SubstanceFacts | null): s is SubstanceFacts =>
    !!s && s.bands.includes(band) && !carriesAnswerVocabulary(s.name) && !opensWithSentinel(s.name);

  if (ch.challengeType === 'observe') {
    const s = substanceFactsOf(ch.substanceKey);
    if (!usable(s)) return null;
    const at = ch.startTemp;
    if (at == null || !Number.isFinite(at)) return null;
    if (k2 && at < 0) return null;
    if (!tempIsClearOfThresholds(s, at)) return null;
    const answerState = reachableState(s, at);
    if (!answerState) return null;
    return {
      id: ch.id,
      challengeType: 'observe',
      kind: 'name_state',
      action: 'name_state',
      answerKind: 'voice',
      responseClass: 'short_spoken_word',
      tier,
      substance: s,
      startTemp: at,
      startState: answerState,
      answerState,
    };
  }

  if (ch.challengeType === 'predict') {
    const s = substanceFactsOf(ch.substanceKey);
    if (!usable(s)) return null;
    const from = ch.startTemp;
    const to = ch.targetTemp;
    if (from == null || to == null || !Number.isFinite(from) || !Number.isFinite(to)) return null;
    if (from === to) return null;
    if (k2 && (from < 0 || to < 0)) return null;
    if (!tempIsClearOfThresholds(s, from) || !tempIsClearOfThresholds(s, to)) return null;
    const startState = reachableState(s, from);
    const endState = reachableState(s, to);
    if (!startState || !endState) return null;

    if (ch.kind === 'predict_change') {
      // The phase-change VOCABULARY is a Grade 3-5 target; a K-2 child names
      // the state, which is the K standard. A curriculum boundary, not a
      // difficulty knob — so it gates rather than degrades.
      if (k2) return null;
      const change = phaseChangeBetween(startState, endState);
      if (!change) return null;
      return {
        id: ch.id,
        challengeType: 'predict',
        kind: 'predict_change',
        action: 'predict_change',
        answerKind: 'voice',
        responseClass: 'short_spoken_word',
        tier,
        substance: s,
        startTemp: from,
        targetTemp: to,
        startState,
        answerChange: change,
      };
    }

    return {
      id: ch.id,
      challengeType: 'predict',
      kind: 'predict_state',
      action: 'predict_state',
      answerKind: 'voice',
      responseClass: 'short_spoken_word',
      tier,
      substance: s,
      startTemp: from,
      targetTemp: to,
      startState,
      answerState: endState,
    };
  }

  if (ch.challengeType !== 'compare') return null;

  const [aKey, bKey] = ch.pairKeys ?? [];
  const a = substanceFactsOf(aKey);
  const b = substanceFactsOf(bKey);
  if (!usable(a) || !usable(b)) return null;
  if (a.key === b.key) return null;
  if (a.meltingPoint === b.meltingPoint) return null;
  if (isConfusablePair(a.key, b.key)) return null;

  const start = ch.startTemp;
  if (start == null || !Number.isFinite(start)) return null;
  if (k2 && start < 0) return null;
  // BOTH beakers must look the same when the question is asked, or the answer
  // is on screen and the reasoning is optional.
  if (!tempIsClearOfThresholds(a, start) || !tempIsClearOfThresholds(b, start)) return null;
  if (stateAt(a, start) !== 'solid' || stateAt(b, start) !== 'solid') return null;

  if (ch.kind === 'stay_solid') {
    const at = ch.targetTemp;
    if (at == null || !Number.isFinite(at)) return null;
    if (k2 && at < 0) return null;
    if (!tempIsClearOfThresholds(a, at) || !tempIsClearOfThresholds(b, at)) return null;
    const aSolid = stateAt(a, at) === 'solid';
    const bSolid = stateAt(b, at) === 'solid';
    if (aSolid === bSolid) return null;
    return {
      id: ch.id,
      challengeType: 'compare',
      kind: 'stay_solid',
      action: 'stay_solid',
      answerKind: 'voice',
      responseClass: 'closed_set_choice',
      tier,
      pair: [a, b],
      startTemp: start,
      targetTemp: at,
      answerName: aSolid ? a.name : b.name,
    };
  }

  return {
    id: ch.id,
    challengeType: 'compare',
    kind: 'melt_first',
    action: 'melt_first',
    answerKind: 'voice',
    responseClass: 'closed_set_choice',
    tier,
    pair: [a, b],
    startTemp: start,
    answerName: (a.meltingPoint < b.meltingPoint ? a : b).name,
  };
};

/** The canonical answer as one token — used by the no-two-in-a-row rule below
 *  and by the component's diagnosis ledger. */
export const answerTokenOf = (item: StatesOfMatterItem): string =>
  item.answerState ?? item.answerChange ?? item.answerName ?? '';

/**
 * Build the session, dropping what cannot be asked — AND what cannot be asked
 * SECOND (defect class 2, both halves).
 *
 * Every item CLOSES by naming its substance's behaviour aloud, and every
 * predict and compare ask SPEAKS that substance's thresholds as its given. So a
 * second item on the same substance is recall — and worse, a compare item whose
 * loser was named an item ago is answered from memory rather than from the
 * numbers. One rule covers both halves: A SUBSTANCE APPEARS IN ONE ITEM PER
 * SESSION, IN ANY ROLE. The pool is ten wide, five at K-2 — which is what caps
 * a K-2 session length, and is stated in the draw rather than discovered.
 *
 * A second, cheaper rule rides along, because this pack's answer SET is tiny
 * where every other port's is wide: consecutive items of the same ACTION may
 * not share an answer. Six observe items in a row that are all "solid" teach a
 * child to say "solid", and a click loop had no way to notice.
 */
export const itemsFromChallenges = (
  challenges: StatesChallengeLike[],
  opts: { band: StatesBand; tier?: StatesTier } = { band: '3-5' },
): StatesOfMatterItem[] => {
  const usedKeys = new Set<string>();
  const items: StatesOfMatterItem[] = [];
  for (const ch of challenges) {
    const item = itemFromChallenge(ch, opts);
    if (!item) continue;
    const touched = item.pair
      ? item.pair.map((s) => s.key)
      : item.substance ? [item.substance.key] : [];
    if (touched.length === 0 || touched.some((k) => usedKeys.has(k))) continue;

    const prev = items[items.length - 1];
    if (prev && prev.action === item.action && answerTokenOf(prev) === answerTokenOf(item)) continue;

    touched.forEach((k) => usedKeys.add(k));
    items.push(item);
  }
  return items;
};

// ── How-to-play — inside the quoted line (SWAP-1), re-spoken on action change ─

export const howToPlayFor = (item: StatesOfMatterItem): string => {
  switch (item.kind) {
    case 'name_state':
      return 'I show you something in a beaker beside its tiny particles — you say what state it is, out loud! ';
    case 'predict_state':
      return 'I tell you how hot or cold I am about to make something — you say what state it will be, out loud! ';
    case 'predict_change':
      return 'I tell you how hot or cold I am about to make something — you name the change it goes through, out loud! ';
    case 'melt_first':
      return 'I show you two things and tell you when each one melts — you say which melts first, out loud! ';
    case 'stay_solid':
      return 'I show you two things and heat them both — you say which one is still solid, out loud! ';
  }
};

// ── The DISTAR lead-in, composed from the SUPPORT TIER ──────────────────────
// easy = model + guide, medium = model, hard = nothing — and it speaks ONLY
// where the how-to-play does (the introduction of an action), never per item.
// The model states the RULE, which is the route to the answer and never the
// answer itself: the supported tier hears the rule before the first ask, the
// hard tier derives it, and no tier hears it re-recited every round.

/**
 * The two model lines that NAME ALL THREE STATES. They are the mats rule in
 * lead-in form: a rule that maps every state cannot disclose which one is the
 * answer, and the mapping IS the lesson — but the harness leak scan sees the
 * answer word inside a cue, so both are exported and subtracted as leak-exempt
 * spans (tier-conditionally, since `hard` speaks no lead-in at all). Nothing
 * else in a cue may carry a state word.
 */
export const STATE_RULE_CLAUSE =
  'Particles that only shake in place are a solid; particles that slide past each other are a liquid; particles that fly apart are a gas.';
export const PREDICT_RULE_CLAUSE =
  'Below the melting point it stays solid, between the two points it is a liquid, and above the boiling point it is a gas.';

const modelLine = (item: StatesOfMatterItem): string => {
  switch (item.kind) {
    case 'name_state':
      return STATE_RULE_CLAUSE;
    case 'predict_state':
      return PREDICT_RULE_CLAUSE;
    case 'predict_change':
      // Deliberately names NO threshold and NO change word. "Going up past the
      // MELTING point" would hand a melting item its answer inside its own
      // lead-in — the same reason this mode speaks its thresholds as
      // transitions rather than as "melts at 60 degrees". The four names are
      // earned in the correction, which is where DISTAR puts them.
      return 'Every step from one state to the next has its own name, and going up the scale has different names from coming back down.';
    case 'melt_first':
      return 'The lower the melting point, the sooner something gives in to the heat.';
    case 'stay_solid':
      return 'Something holds its shape right up until the heat climbs past its own melting point.';
  }
};

const guideLine = (item: StatesOfMatterItem): string => {
  switch (item.kind) {
    case 'name_state': return 'Watch how the tiny bits move before you answer.';
    case 'predict_state': return 'Compare the new temperature with both points.';
    case 'predict_change': return 'Work out the state before, then the state after.';
    case 'melt_first': return 'Compare the two melting points.';
    case 'stay_solid': return 'Check each melting point against the new temperature.';
  }
};

const leadInFor = (item: StatesOfMatterItem): string => {
  switch (item.tier) {
    case 'hard': return '';
    case 'easy': return `${modelLine(item)} ${guideLine(item)} `;
    case 'medium':
    default: return `${modelLine(item)} `;
  }
};

// ── The asks — the problem STATED aloud, one defensible answer ──────────────

/** The thresholds an ask must SPEAK for its question to be answerable at all.
 *  A boil-less substance names only its melting point — see `boilingIsReal`. */
const thresholdsSpoken = (s: SubstanceFacts): string =>
  s.boilingIsReal
    ? `${s.name} melts at ${tempSpoken(s.meltingPoint)} and boils at ${tempSpoken(s.boilingPoint)}.`
    : `${s.name} melts at ${tempSpoken(s.meltingPoint)}.`;

/**
 * The same thresholds, phrased as TRANSITIONS. `predict_change` asks for the
 * word "melting" and cannot be handed "melts at 60 degrees" in its own question
 * — the answer would sit inside the ask with nothing exempting it. Saying
 * "turns from solid to liquid at 60 degrees" states the identical fact and
 * leaves the naming to the child, which is the whole skill of that mode.
 */
const thresholdsAsTransitions = (s: SubstanceFacts): string =>
  s.boilingIsReal
    ? `${s.name} turns from solid to liquid at ${tempSpoken(s.meltingPoint)}, and from liquid to gas at ${tempSpoken(s.boilingPoint)}.`
    : `${s.name} turns from solid to liquid at ${tempSpoken(s.meltingPoint)}.`;

/**
 * The three-way menu, spoken ONLY at the easy tier. The mats rule made
 * tier-conditional: naming the options turns production into a one-in-three
 * pick, so the supported tier gets it and `hard` becomes a real spoken lever.
 */
export const namesTheStateMenu = (item: StatesOfMatterItem): boolean =>
  item.kind === 'name_state' && item.tier === 'easy';

export const STATE_MENU_CLAUSE = 'solid, liquid, or gas?';

const askFor = (item: StatesOfMatterItem): string => {
  switch (item.kind) {
    case 'name_state': {
      const s = item.substance!;
      const head = `Look at the ${s.name} in the beaker and watch its tiny particles. Your turn. Say what state it is`;
      return namesTheStateMenu(item) ? `${head} — ${STATE_MENU_CLAUSE}` : `${head}.`;
    }
    case 'predict_state': {
      const s = item.substance!;
      const dir = item.targetTemp! > item.startTemp! ? 'heat it up to' : 'cool it down to';
      return `${thresholdsSpoken(s)} Right now it sits at ${tempSpoken(item.startTemp!)}. I am about to ${dir} ${tempSpoken(item.targetTemp!)}. Your turn. Say what state the ${s.name} will be then.`;
    }
    case 'predict_change': {
      const s = item.substance!;
      const dir = item.targetTemp! > item.startTemp! ? 'heat it up to' : 'cool it down to';
      return `${thresholdsAsTransitions(s)} Right now it sits at ${tempSpoken(item.startTemp!)}. I am about to ${dir} ${tempSpoken(item.targetTemp!)}. Your turn. Name the change the ${s.name} goes through.`;
    }
    case 'melt_first': {
      const [a, b] = item.pair!;
      return `${a.name} melts at ${tempSpoken(a.meltingPoint)}. ${b.name} melts at ${tempSpoken(b.meltingPoint)}. Both beakers are solid at ${tempSpoken(item.startTemp!)}. Your turn. If I heat them both slowly, which one melts first — ${a.name}, or ${b.name}?`;
    }
    case 'stay_solid': {
      const [a, b] = item.pair!;
      return `${a.name} melts at ${tempSpoken(a.meltingPoint)}. ${b.name} melts at ${tempSpoken(b.meltingPoint)}. Both are solid right now. I am about to heat them both to ${tempSpoken(item.targetTemp!)}. Your turn. Which one is still solid then — ${a.name}, or ${b.name}?`;
    }
  }
};

// ── Corrections — DISTAR re-model then re-elicit (standing gate 3) ──────────
// Every one re-models the RULE and hands the question back; none of them lands
// the answer, so the correction teaches the route and the child still earns it.

const correctionFor = (item: StatesOfMatterItem): string => {
  switch (item.kind) {
    case 'name_state': {
      const s = item.substance!;
      return `My turn: a solid holds its shape and its particles only shake in place; a liquid flows and its particles slide past each other; a gas spreads out and its particles fly apart. Your turn. Look at the ${s.name} again and say what state it is.`;
    }
    case 'predict_state': {
      const s = item.substance!;
      const upper = s.boilingIsReal
        ? ` and below ${tempSpoken(s.boilingPoint)} it is a liquid, and above that it is a gas`
        : ' it is a liquid';
      return `My turn: ${thresholdsSpoken(s)} Below ${tempSpoken(s.meltingPoint)} it is solid, above${upper}. Your turn. Say what state the ${s.name} will be at ${tempSpoken(item.targetTemp!)}.`;
    }
    case 'predict_change': {
      const s = item.substance!;
      return `My turn: going up past the melting point is called melting, and going up past the boiling point is called boiling; coming back down past the boiling point is condensing, and down past the melting point is freezing. Your turn. Name the change the ${s.name} goes through at ${tempSpoken(item.targetTemp!)}.`;
    }
    case 'melt_first': {
      const [a, b] = item.pair!;
      return `My turn: the one with the lower melting point gives in to the heat first — put ${tempSpoken(a.meltingPoint)} next to ${tempSpoken(b.meltingPoint)} and find the smaller one. Your turn. Which one melts first — ${a.name}, or ${b.name}?`;
    }
    case 'stay_solid': {
      const [a, b] = item.pair!;
      return `My turn: something stays solid until the heat climbs past its own melting point — check ${tempSpoken(item.targetTemp!)} against ${tempSpoken(a.meltingPoint)}, then against ${tempSpoken(b.meltingPoint)}. Your turn. Which one is still solid — ${a.name}, or ${b.name}?`;
    }
  }
};

const affirmFor = (item: StatesOfMatterItem): string => {
  switch (item.kind) {
    case 'name_state': {
      const s = item.substance!;
      return `Yes, the ${s.name} is a ${item.answerState} — you read that straight off the particles.`;
    }
    case 'predict_state': {
      const s = item.substance!;
      return `Yes, at ${tempSpoken(item.targetTemp!)} the ${s.name} is a ${item.answerState}. Watch it happen.`;
    }
    case 'predict_change': {
      const s = item.substance!;
      const change = item.answerChange!;
      return `Yes, the ${s.name} is ${change} — ${CHANGE_STORY[change]}. Watch it happen.`;
    }
    case 'melt_first':
      return `Yes, ${item.answerName} melts first — its melting point is the lower one.`;
    case 'stay_solid':
      return `Yes, ${item.answerName} is still solid — the heat never reached its melting point.`;
  }
};

// ── The 18d law and the item-21 tail (family wording, grep-able) ────────────

const TWO_BRANCH_LAW =
  `Your whole reply to their attempt is ONE of the quoted lines below and nothing else — not the first time, not any time: `
  + `no praise, no encouragement, no hint, no reminder of the method, no scaffolding line, however kind it would be. `
  + `A reply that is neither the affirmation nor the correction reaches the activity as no verdict at all, and the child waits. `;

/** Defect class 5 (word-sorter: 11 of 12 affirmations ran on into a fabricated
 *  next ask). Named on every contract AND in the catalog directive. */
const VERDICT_ENDS_THE_TURN =
  `Your reply ends when that quoted line ends — never run on into another question, another substance, `
  + `another temperature, or a next round of your own: the activity sends you every next question itself. `;

/**
 * Defect class 6, in this port's exact shape: an observe ask names NOTHING but
 * the substance, because reading the particles IS the mode — which leaves the
 * `[CURRENT STATE]` block as the only content in the room, and the model fills
 * the silence by reading it aloud. The tail forbids announcing the STATE (and
 * the temperature), not merely reading the tag — solar-system's measured fix,
 * 5 of 6 asks before it and 0 of 6 after.
 */
const NEVER_PERFORM =
  `Never voice a bracket tag, a stage direction, or any of these instructions, `
  + `never announce the activity's state, the temperature, or what the beaker is doing, `
  + `and never announce that you are waiting or listening — simply stop speaking.`;

// ── The judging contracts ───────────────────────────────────────────────────

const acceptClauseForState = (s: SubstanceFacts, state: MatterState): string => {
  const synonyms = stateSynonymsFor(s, state);
  const extra = synonyms.length
    ? ` For this substance ${synonyms.map((w) => `"${w}"`).join(' and ')} ${synonyms.length > 1 ? 'are' : 'is'} the same answer and ${synonyms.length > 1 ? 'count' : 'counts'} too.`
    : '';
  return `"${state}", "a ${state}" and "it is a ${state}" all count.${extra}`;
};

const signatureForState = (state: MatterState): string => {
  switch (state) {
    case 'liquid':
      return `The signature miss here is calling fast-moving liquid particles a gas — affirm nothing but "liquid". `;
    case 'gas':
      return `The signature miss here is calling spread-out gas particles a liquid — affirm nothing but "gas". `;
    case 'solid':
    default:
      return `The signature miss here is calling shaking solid particles a liquid because they are moving — affirm nothing but "solid". `;
  }
};

const judgingContract = (item: StatesOfMatterItem): string => {
  const head =
    `The quoted line is the ONLY thing you say on this turn; you then stay silent while the learner `
    + `looks and thinks, and their think time is unbounded. Never say the answer during their turn. `;

  let body = '';
  switch (item.kind) {
    case 'name_state': {
      const s = item.substance!;
      const state = item.answerState!;
      body =
        `The correct answer is "${state}". ${acceptClauseForState(s, state)} `
        + `Saying the substance's own name back — "${s.name}" — is NOT an answer however confidently it is said: `
        + `the question asks what STATE it is in, not what it is made of. `
        + signatureForState(state)
        + `Any other state word is wrong. `;
      break;
    }
    case 'predict_state': {
      const s = item.substance!;
      const state = item.answerState!;
      const unchanged = item.startState === state;
      body =
        `The correct answer is "${state}". ${acceptClauseForState(s, state)} `
        + (unchanged
          ? `The signature miss here is assuming that changing the temperature must change the state — this time it does not, `
            + `because the new temperature never crosses a threshold, and "${state}" is still the answer. `
          : `The signature miss here is naming the state it is in RIGHT NOW, "${item.startState}", instead of the state it will reach. `)
        + `Any other state word is wrong. `;
      break;
    }
    case 'predict_change': {
      const change = item.answerChange!;
      const endState = stateAt(item.substance!, item.targetTemp!);
      body =
        `The correct answer is "${change}". "${CHANGE_VERB[change]}", "it ${CHANGE_VERB[change]}s" and `
        + `"it will ${CHANGE_VERB[change]}" all count. `
        + `The signature miss here is naming the STATE it ends up in — "${endState}" — instead of the change: `
        + `that is an observation where the question asks for the change word, and it is wrong. `
        + `The opposite change is wrong, and so is any other change word. `;
      break;
    }
    case 'melt_first':
    case 'stay_solid': {
      const [a, b] = item.pair!;
      const loser = item.answerName === a.name ? b.name : a.name;
      body =
        `The learner answers with ONE of the two names on offer: "${a.name}" or "${b.name}". `
        + `The correct answer is "${item.answerName}". The name alone counts, and so does the name inside a short phrase — `
        + `but if what they said does not clearly pick one of the two, it is wrong. "${loser}" is wrong, and it is the `
        + `signature miss: it is what a learner says who compares the two numbers and reads the comparison backwards. `;
      break;
    }
  }

  return (
    head + body + TWO_BRANCH_LAW + VERDICT_ENDS_THE_TURN
    + `If the answer is right, say exactly: "${affirmFor(item)}" `
    + `If it is wrong, say exactly: "${correctionFor(item)}"`
  );
};

// ── Cues ────────────────────────────────────────────────────────────────────

export interface StatesCueOptions {
  opening?: boolean;
  howToPlay?: boolean;
}

export const itemCue = (
  item: StatesOfMatterItem,
  opts: StatesCueOptions = {},
): string => {
  const greeting = opts.opening ? 'Hi! Time to find out what heat does to things! ' : '';
  const introducing = !!(opts.opening || opts.howToPlay);
  const how = introducing ? howToPlayFor(item) : '';
  const lead = introducing ? leadInFor(item) : '';
  const spoken = `${greeting}${how}${lead}${askFor(item)}`;
  return `[SOM_ITEM] Say exactly: "${spoken}" ${judgingContract(item)} ${NEVER_PERFORM}`;
};

/** Correction cap reached: acknowledge warmly, CLOSE THE LINK by naming what
 *  the corrections could not, and carry the lesson forward. */
const closeLineFor = (item: StatesOfMatterItem): string => {
  switch (item.kind) {
    case 'name_state':
      return `That ${item.substance!.name} is a ${item.answerState}. `;
    case 'predict_state':
      return `At ${tempSpoken(item.targetTemp!)} the ${item.substance!.name} is a ${item.answerState}. `;
    case 'predict_change':
      return `That change is called ${item.answerChange}. `;
    case 'melt_first':
      return `${item.answerName} melts first — it has the lower melting point. `;
    case 'stay_solid':
      return `${item.answerName} is the one still solid. `;
  }
};

export const moveOnCue = (
  item: StatesOfMatterItem,
  next: StatesOfMatterItem | null,
  opts: StatesCueOptions = {},
): string => {
  const closeLine = closeLineFor(item);
  if (!next) {
    return (
      `[SOM_MOVE] Say exactly: "Good try! ${closeLine}Heat and cold take practice — we will run this experiment again another day." `
      + `Then stop.`
    );
  }
  const introducing = !!opts.howToPlay;
  const how = introducing ? howToPlayFor(next) : '';
  const lead = introducing ? leadInFor(next) : '';
  return (
    `[SOM_MOVE] Say exactly: "Good try! ${closeLine}Here comes the next one. ${how}${lead}${askFor(next)}" `
    + `${judgingContract(next)} ${NEVER_PERFORM}`
  );
};

export const completeCue = (): string =>
  `[SOM_COMPLETE] Say exactly: "What great science today! You watched the tiny particles and worked out what heat does to them. See you next time!" Then stop — the activity is over.`;

/** Tap-to-hear re-speaks the QUESTION, never the answer. Never withdrawn. */
export const pronounceCue = (item: StatesOfMatterItem): string => {
  const line = (() => {
    switch (item.kind) {
      case 'name_state': {
        const s = item.substance!;
        const head = `Look at the ${s.name} and its particles. Say what state it is`;
        return namesTheStateMenu(item) ? `${head} — ${STATE_MENU_CLAUSE}` : `${head}.`;
      }
      case 'predict_state':
        return `${thresholdsSpoken(item.substance!)} I am taking it to ${tempSpoken(item.targetTemp!)}. Say what state it will be.`;
      case 'predict_change':
        return `${thresholdsAsTransitions(item.substance!)} I am taking it to ${tempSpoken(item.targetTemp!)}. Name the change it goes through.`;
      case 'melt_first': {
        const [a, b] = item.pair!;
        return `Which one melts first — ${a.name}, or ${b.name}?`;
      }
      case 'stay_solid': {
        const [a, b] = item.pair!;
        return `At ${tempSpoken(item.targetTemp!)}, which one is still solid — ${a.name}, or ${b.name}?`;
      }
    }
  })();
  return (
    `[SOM_HEAR] The learner tapped to hear the question again. Say ONLY this, warmly, then wait: "${line}" `
    + `Do not treat anything you just heard as an answer, add nothing, and never say the answer. `
    + NEVER_PERFORM
  );
};

/**
 * Runtime state pushed through the context channel — STIMULUS-SIDE ONLY, and
 * answer-free by construction. Never the state on screen (that is the observe
 * answer), never the temperature the beaker is about to reach.
 */
export const stimulusFor = (item: StatesOfMatterItem): string => {
  switch (item.kind) {
    case 'name_state':
      // STATES ITS OWN NON-SPEAKABILITY (solar-system's measured fix, and this
      // port's first drive reproduced the defect it was written for: on 3 of 6
      // observe asks the tutor read the [CURRENT STATE] preamble aloud, its own
      // "never read it aloud" sentence included). An observe ask names nothing
      // but the substance BY DESIGN — reading the particles is the mode — so a
      // model handed a near-empty line and a state block fills the silence from
      // the state block unless the block itself says it is not content.
      return `a beaker of ${item.substance!.name} beside its particle view, waiting to be named; `
        + `this state line is for you alone and is never spoken to the learner`;
    case 'predict_state':
    case 'predict_change':
      return `${item.substance!.name} in the beaker, before the temperature is changed`;
    case 'melt_first':
    case 'stay_solid': {
      const [a, b] = item.pair!;
      return `${a.name} and ${b.name} side by side in two beakers, both still cold`;
    }
  }
};

// ── THE WIRE — what the tutor is told, shared with the DI drive harness ──────

export const statesOfMatterPackBase = (
  items: StatesOfMatterItem[],
): JudgedCueSurface<StatesOfMatterItem> => ({
  primitiveType: 'states-of-matter',
  activityLine: 'live direct instruction states of matter practice',
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

// ── Harness answer material — what a right and a wrong child sound like ──────

const OTHER_STATE: Record<MatterState, MatterState> = {
  solid: 'gas',
  liquid: 'solid',
  gas: 'solid',
};

const OPPOSITE_CHANGE: Record<PhaseChange, PhaseChange> = {
  melting: 'freezing',
  freezing: 'melting',
  boiling: 'condensing',
  condensing: 'boiling',
};

/** The state a "heat always changes it" learner names on a no-change predict:
 *  one step in the direction the tutor is moving. Guarded so it can never
 *  collide with the correct answer. */
const stateOneStep = (state: MatterState, heating: boolean): MatterState => {
  if (heating) return state === 'solid' ? 'liquid' : state === 'liquid' ? 'gas' : 'liquid';
  return state === 'gas' ? 'liquid' : state === 'liquid' ? 'solid' : 'liquid';
};

export const statesOfMatterHarnessAnswers = (item: StatesOfMatterItem) => {
  switch (item.kind) {
    case 'name_state': {
      const s = item.substance!;
      const state = item.answerState!;
      return {
        correct: state,
        plainWrong: OTHER_STATE[state],
        signatureWrong: {
          text: s.name,
          why: 'the substance said back instead of its state — fluent, confident, and answering a question that was not asked; the contract names this miss',
        },
        leakTokens: [state],
        // Two tier-conditional exemptions, and nothing else: the RULE clause in
        // the lead-in (spoken at easy and medium, and it names all three states
        // by construction) and the three-way MENU at the end of the easy ask.
        // At `hard` the list is EMPTY and the whole cue is governed flat, which
        // is what makes the tier a real spoken lever rather than a tone change.
        leakExemptSpan: [
          ...(item.tier === 'hard' ? [] : [STATE_RULE_CLAUSE]),
          ...(namesTheStateMenu(item) ? [STATE_MENU_CLAUSE] : []),
        ],
      };
    }
    case 'predict_state': {
      const state = item.answerState!;
      const startState = item.startState!;
      const heating = item.targetTemp! > item.startTemp!;
      const assumed = stateOneStep(state, heating);
      return {
        correct: state,
        plainWrong: OTHER_STATE[state],
        signatureWrong: startState === state
          ? {
              text: assumed === state ? OTHER_STATE[state] : assumed,
              why: 'the assumption that changing the temperature must change the state — this time the substance never crosses a threshold, so the state holds',
            }
          : {
              text: startState,
              why: 'the state it is in RIGHT NOW, read off the beaker in front of them instead of predicted — the exact confusion this mode teaches through',
            },
        leakTokens: [state],
        // The lead-in rule clause names all three states so it can disclose
        // none of them; `hard` speaks no lead-in and is governed flat.
        leakExemptSpan: item.tier === 'hard' ? [] : [PREDICT_RULE_CLAUSE],
      };
    }
    case 'predict_change': {
      const change = item.answerChange!;
      return {
        correct: change,
        plainWrong: OPPOSITE_CHANGE[change],
        signatureWrong: {
          text: stateAt(item.substance!, item.targetTemp!),
          why: 'the resulting STATE named instead of the change — an observation where the mode asks for the phase-change word, and the likeliest confident miss',
        },
        leakTokens: [change, CHANGE_VERB[change]],
      };
    }
    case 'melt_first':
    case 'stay_solid': {
      const [a, b] = item.pair!;
      const winner = item.answerName!;
      const loser = winner === a.name ? b.name : a.name;
      return {
        correct: winner,
        plainWrong: loser,
        signatureWrong: {
          text: loser,
          why: 'the direction reversal — both melting points compared and the comparison read backwards, which is the only wrong answer a two-name menu has',
        },
        leakTokens: [winner.toLowerCase()],
        // The menu clauses: both names are a legal part of the ask by
        // construction (the mats rule). The question core between them stays
        // governed.
        leakExemptSpan: [
          `${a.name} melts at`,
          `${b.name} melts at`,
          `${a.name}, or ${b.name}?`,
        ],
      };
    }
  }
};
