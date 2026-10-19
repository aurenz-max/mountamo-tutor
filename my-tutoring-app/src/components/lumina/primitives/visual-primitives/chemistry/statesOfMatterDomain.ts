/**
 * States of matter's domain: the substance table, the items and their code-computed answers, the ask, the spoken
 * key, the known misses and the scene. Pure; the boss (`statesOfMatter.boss.ts`), the levers, the component and the
 * generator read it. It was the judged DI script (third science port, second chemistry port); the cue protocol went
 * with the move to the boss (2026-10-19).
 *
 * ── EVERY MODE SPEAKS, ZERO TAPS ────────────────────────────────────────────
 * The table picture (user ruling 2026-08-13): a teacher, one child, and a beaker on a hot plate.
 *
 *   observe  → the state          say "solid" / "liquid" / "gas"
 *   predict  → the state it WILL be, or the CHANGE it goes through
 *   compare  → one of two substances, both named in the ask
 *
 * The click era answered all of it with multiple-choice tiles, a True/False pair and a free-text box; a child who
 * cannot read a particle view can still click one of three tiles. The temperature slider is hidden on the judged
 * surface for the same reason: beside a live beaker it answers "what state WILL it be" by experiment. The experiment
 * runs on the credit, as the reveal (component, `revealHeld`).
 *
 * ── CONTENT IS CODE, NOT GEMINI ─────────────────────────────────────────────
 * `SUBSTANCES` holds every substance a judged session can draw, with real melting and boiling points, and every
 * answer key is computed from it. Chocolate and butter have NO honest boiling point (they scorch and decompose), so
 * `boilingIsReal` gates every boil ask: "chocolate boils at 350 degrees" is never said.
 *
 * ── WHAT EACH ASK SAYS ──────────────────────────────────────────────────────
 *   name_state      names only the substance; the easy tier alone names the three-way MENU, so `hard` is a real
 *                   spoken lever and not a change of tone.
 *   predict_state   the THRESHOLDS are the given and are always spoken; the resulting state never is.
 *   predict_change  the thresholds are spoken as TRANSITIONS ("turns from solid to liquid at 60 degrees"): "melts at
 *                   60 degrees" would say the answer word.
 *   compare         both names ARE the menu, spoken by construction. The winner is never said.
 */

import {
  opensWithSentinel,
  type JudgedScriptItem,
  type ResponseClassId,
} from '../../../hooks/judgedScriptContract';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import type { SceneOf } from '../../../components/live-activity/bossLevers';

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

export const CHANGE_VERB: Record<PhaseChange, string> = {
  melting: 'melt',
  freezing: 'freeze',
  boiling: 'boil',
  condensing: 'condense',
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
 * A credited item reveals its substance's behaviour on screen, and every
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

// ── The rule a supported tier may hear before the ask ──────────────────────

/**
 * The rule each kind's scene offers below the hard tier (`statesScene`). The two state rules NAME ALL THREE STATES:
 * a rule that maps every state cannot disclose which one is the answer, and the mapping IS the lesson. At hard
 * there is none, so the tier is a real lever and not a change of tone.
 */
export const STATE_RULE_CLAUSE =
  'Particles that only shake in place are a solid; particles that slide past each other are a liquid; particles that fly apart are a gas.';
export const PREDICT_RULE_CLAUSE =
  'Below the melting point it stays solid, between the two points it is a liquid, and above the boiling point it is a gas.';

export const modelLine = (item: StatesOfMatterItem): string => {
  switch (item.kind) {
    case 'name_state':
      return STATE_RULE_CLAUSE;
    case 'predict_state':
      return PREDICT_RULE_CLAUSE;
    case 'predict_change':
      // Deliberately names NO threshold and NO change word: "going up past the MELTING point" would say a melting
      // item's answer, the same reason this mode speaks its thresholds as transitions.
      return 'Every step from one state to the next has its own name, and going up the scale has different names from coming back down.';
    case 'melt_first':
      return 'The lower the melting point, the sooner something gives in to the heat.';
    case 'stay_solid':
      return 'Something holds its shape right up until the heat climbs past its own melting point.';
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

export const askFor = (item: StatesOfMatterItem): string => {
  switch (item.kind) {
    case 'name_state': {
      const s = item.substance!;
      const head = `Look at the ${s.name} in the beaker and watch its tiny particles. Say what state it is`;
      return namesTheStateMenu(item) ? `${head} — ${STATE_MENU_CLAUSE}` : `${head}.`;
    }
    case 'predict_state': {
      const s = item.substance!;
      const dir = item.targetTemp! > item.startTemp! ? 'heat it up to' : 'cool it down to';
      return `${thresholdsSpoken(s)} Right now it sits at ${tempSpoken(item.startTemp!)}. I am about to ${dir} ${tempSpoken(item.targetTemp!)}. Say what state the ${s.name} will be then.`;
    }
    case 'predict_change': {
      const s = item.substance!;
      const dir = item.targetTemp! > item.startTemp! ? 'heat it up to' : 'cool it down to';
      return `${thresholdsAsTransitions(s)} Right now it sits at ${tempSpoken(item.startTemp!)}. I am about to ${dir} ${tempSpoken(item.targetTemp!)}. Name the change the ${s.name} goes through.`;
    }
    case 'melt_first': {
      const [a, b] = item.pair!;
      return `${a.name} melts at ${tempSpoken(a.meltingPoint)}. ${b.name} melts at ${tempSpoken(b.meltingPoint)}. Both beakers are solid at ${tempSpoken(item.startTemp!)}. If I heat them both slowly, which one melts first — ${a.name}, or ${b.name}?`;
    }
    case 'stay_solid': {
      const [a, b] = item.pair!;
      return `${a.name} melts at ${tempSpoken(a.meltingPoint)}. ${b.name} melts at ${tempSpoken(b.meltingPoint)}. Both are solid right now. I am about to heat them both to ${tempSpoken(item.targetTemp!)}. Which one is still solid then — ${a.name}, or ${b.name}?`;
    }
  }
};

// ── The spoken key ──────────────────────────────────────────────────────────

const STATES: readonly MatterState[] = ['solid', 'liquid', 'gas'];

const OPPOSITE_CHANGE: Record<PhaseChange, PhaseChange> = {
  melting: 'freezing',
  freezing: 'melting',
  boiling: 'condensing',
  condensing: 'boiling',
};

/** The other substance of a compare item's pair. */
const otherOfPair = (item: StatesOfMatterItem): string => {
  const [a, b] = item.pair!;
  return item.answerName === a.name ? b.name : a.name;
};

/**
 * The key the tutor judges each item with. observe and predict_state: the state word, with "ice" and "steam" for
 * water, and a menu key where the easy observe ask says all three states. predict_change: the change word. compare:
 * one of the two names the ask says in full.
 */
export function statesKey(item: StatesOfMatterItem): SpokenKey {
  switch (item.kind) {
    case 'name_state':
    case 'predict_state': {
      const s = item.substance!;
      const state = item.answerState!;
      return {
        answer: state, alsoAccept: [`a ${state}`, `it is a ${state}`, ...stateSynonymsFor(s, state)],
        ...(namesTheStateMenu(item) ? { menu: [...STATES] } : {}),
        signatureError: item.kind === 'name_state'
          ? `Saying the substance's name back ("${s.name}") with no state word is not it.`
          : item.startState === state
            ? 'The temperature never crosses a threshold, so the state does not change; another state is not it.'
            : `"${item.startState}", the state it is in now, is not it.`,
      };
    }
    case 'predict_change': {
      const change = item.answerChange!;
      return {
        answer: change, alsoAccept: [CHANGE_VERB[change]],
        signatureError: `The state it ends up in ("${stateAt(item.substance!, item.targetTemp!)}") is not it, and neither is `
          + `the opposite change ("${OPPOSITE_CHANGE[change]}").`,
      };
    }
    case 'melt_first':
    case 'stay_solid': {
      const [a, b] = item.pair!;
      return {
        answer: item.answerName!, alsoAccept: [], menu: [a.name, b.name],
        acceptRule: 'The name inside a short phrase counts.',
        signatureError: `"${otherOfPair(item)}", the comparison read backwards, is not it.`,
      };
    }
  }
}

// ── Known misses ────────────────────────────────────────────────────────────

/** What a wrong spoken answer shows (handoff 20 Part B). */
export type SpokenStatesMiss = 'said_start_state' | 'other_state' | 'said_substance_back' | 'said_end_state' | 'opposite_change'
  | 'other_of_pair';

/**
 * An item's known wrong answers, in precedence order, for the `spoken_miss` observer: the state it is in now, then
 * another state (predict_state); another state or the substance's name (name_state); the state it ends in, then the
 * opposite change (predict_change); the other substance (melt_first, stay_solid).
 */
export function statesSpokenMisses(item: StatesOfMatterItem): KnownMiss[] {
  const s = item.substance;
  switch (item.kind) {
    case 'name_state':
    case 'predict_state': {
      if (!s || !item.answerState) return [];
      const answer = item.answerState, start = item.kind === 'predict_state' && item.startState !== answer ? item.startState : undefined;
      const fact = item.kind === 'name_state' ? `The ${s.name} in the beaker is a ${answer}.` : `At ${item.targetTemp} degrees the ${s.name} will be a ${answer}.`;
      const others = STATES.filter(x => x !== answer && x !== start);
      return [
        ...(start ? [{ id: 'said_start_state', pattern: `${fact} The learner's answer is "${start}", the state it is in now, before the change.`, examples: [start] }] : []),
        { id: 'other_state', pattern: `${fact} The learner's answer is ${others.map(x => `"${x}"`).join(' or ')}, another state.`, examples: [...others] },
        ...(item.kind === 'name_state' ? [{ id: 'said_substance_back', pattern: `The learner says "${s.name}" back and no state word.`, examples: [s.name] }] : []),
      ];
    }
    case 'predict_change': {
      if (!s || !item.answerChange || item.targetTemp === undefined) return [];
      const end = stateAt(s, item.targetTemp), change = item.answerChange, opposite = OPPOSITE_CHANGE[change];
      const fact = `The ${s.name} goes through ${change} and ends up a ${end}.`;
      return [
        { id: 'said_end_state', pattern: `${fact} The learner's answer is "${end}", the state it ends up in, not the change.`, examples: [end] },
        { id: 'opposite_change', pattern: `${fact} The learner's answer is "${opposite}", the opposite change.`, examples: [opposite] },
      ];
    }
    case 'melt_first':
    case 'stay_solid': {
      if (!item.pair || !item.answerName) return [];
      const [a, b] = item.pair, other = otherOfPair(item);
      return [{ id: 'other_of_pair', pattern: `Of ${a.name} and ${b.name}, the answer is ${item.answerName}. The learner's answer is ${other}, the other one.`, examples: [other] }];
    }
  }
}

// ── Scene ───────────────────────────────────────────────────────────────────

/** What is drawn and asked. Never the state on screen, the temperature it is going to, or the winner. */
export function statesScene(item: StatesOfMatterItem, view: { practice?: boolean } = {}): SceneOf {
  const facts: Record<string, string> = {
    shown: item.pair ? `Two beakers with their particle views: ${item.pair[0].name} and ${item.pair[1].name}.`
      : `A beaker of ${item.substance!.name} with its particle view.`,
    // The tier lever: below hard, the rule that names every option may be said before the ask.
    ...(item.tier !== 'hard' ? { rule: `You may say this before the ask: ${modelLine(item)}` } : {}),
    constraints: 'No temperature, state label or particle caption is printed until the answer is credited'
      + (item.kind === 'name_state' ? '.' : '; then the beaker runs to the new temperature.'),
  };
  if (view.practice) facts.practice = 'An easier practice item, ungraded, on another substance. The full item comes back after it.';
  return { objects: [], facts };
}

// ── Harness answers ─────────────────────────────────────────────────────────

const OTHER_STATE: Record<MatterState, MatterState> = { solid: 'gas', liquid: 'solid', gas: 'solid' };

/** The harness's answers: the key's own word, or a plainly different answer of the same kind. */
export const statesOfMatterHarnessAnswers = (item: StatesOfMatterItem): { correct: string; plainWrong: string } => {
  switch (item.kind) {
    case 'name_state':
    case 'predict_state':
      return { correct: item.answerState!, plainWrong: OTHER_STATE[item.answerState!] };
    case 'predict_change':
      return { correct: item.answerChange!, plainWrong: OPPOSITE_CHANGE[item.answerChange!] };
    case 'melt_first':
    case 'stay_solid':
      return { correct: item.answerName!, plainWrong: otherOfPair(item) };
  }
};
