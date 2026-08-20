/**
 * states-of-matter-challenges — the judged-session DRAW for states-of-matter.
 *
 * Deliberately NOT a Gemini generator (no `gemini-` prefix): every melting and
 * boiling point this primitive can ask about lives in code, so an LLM in this
 * path could only add hallucination risk to facts we already hold. The draw
 * picks WHICH substances and WHICH temperatures; every answer key is computed
 * by the script module's build gates (`statesOfMatterScript.itemFromChallenge`),
 * which re-validate every challenge emitted here — both sides of the wire
 * import the same pools and the same threshold gate from ONE address (the
 * letter-spotter rule; hand-synced copies drift).
 *
 * Session invariant, generator-side half: a substance appears in at most ONE
 * challenge per session. The script's `itemsFromChallenges` enforces the same
 * rule on whatever actually arrives, covering cached or hand-authored payloads.
 *
 * ⚠️ K-2 SESSIONS ARE SHORTER BY CONSTRUCTION, and that is stated here rather
 * than discovered in a drive: the K-2 pool is five substances wide (everything
 * with an above-freezing, everyday threshold), and the substance-once rule caps
 * a K-2 observe/predict session at five items — fewer once compare consumes two
 * per item. The draw returns what it can honestly fill; it never pads.
 */

import {
  SUBSTANCES,
  TEMP_MARGIN,
  bandPool,
  isConfusablePair,
  reachableState,
  stateAt,
  tempIsClearOfThresholds,
  type MatterState,
  type StatesBand,
  type StatesChallengeType,
  type SubstanceFacts,
} from '../../primitives/visual-primitives/chemistry/statesOfMatterScript';
import type { StatesOfMatterChallenge } from '../../types';

const SESSION_LENGTH = 6;

/**
 * How many CONSECUTIVE items share a facet before the rotation moves on.
 *
 * ⚠️ NOT a cosmetic choice — the first compare drive found it. The runner
 * re-speaks the how-to-play whenever the ACTION changes (a non-reader cannot
 * look the protocol up), so a draw that alternates facets item by item makes
 * EVERY item an action change and re-recites ~14 seconds of protocol per round
 * — the recitation the 2026-08-13 rulings struck, arriving through the DRAW
 * instead of through `leadInFor`. `findRepeatedConsecutiveAsks` cannot see it,
 * because consecutive items have different actions by construction.
 *
 * Runs of two keep both task identities in a 4-6 item session while halving the
 * protocol speech.
 */
const FACET_RUN = 2;

const shuffle = <T,>(values: readonly T[]): T[] => {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const randInt = (min: number, max: number): number =>
  min + Math.floor(Math.random() * (max - min + 1));

/** Temperatures are SPOKEN, so they are rounded to something a tutor says
 *  without sounding like a readout: whole tens once the numbers get large. */
const speakableRound = (t: number): number => {
  const abs = Math.abs(t);
  if (abs >= 200) return Math.round(t / 10) * 10;
  if (abs >= 20) return Math.round(t / 5) * 5;
  return Math.round(t);
};

/**
 * A temperature at which `s` is honestly in `state`, clear of every threshold
 * by `TEMP_MARGIN`, and (at K-2) never below zero. Returns null when the
 * combination cannot be asked — solid WATER at K-2, for instance, needs a
 * below-zero temperature this band never speaks.
 */
const tempForState = (
  s: SubstanceFacts,
  state: MatterState,
  band: StatesBand,
): number | null => {
  const floor = band === 'K-2' ? 0 : -Infinity;
  const candidates: number[] = [];

  if (state === 'solid') {
    for (const drop of [20, 35, 50, 10]) candidates.push(s.meltingPoint - drop);
  } else if (state === 'liquid') {
    if (s.boilingIsReal) {
      const span = s.boilingPoint - s.meltingPoint;
      for (const frac of [0.5, 0.3, 0.7, 0.15]) candidates.push(s.meltingPoint + span * frac);
    } else {
      for (const rise of [20, 35, 50, 10]) candidates.push(s.meltingPoint + rise);
    }
  } else {
    if (!s.boilingIsReal) return null;
    for (const rise of [30, 60, 100, 15]) candidates.push(s.boilingPoint + rise);
  }

  for (const raw of candidates) {
    const t = speakableRound(raw);
    if (t < floor) continue;
    if (!tempIsClearOfThresholds(s, t)) continue;
    if (reachableState(s, t) !== state) continue;
    return t;
  }
  return null;
};

/** States a substance can honestly be SHOWN in for this band. */
const askableStates = (s: SubstanceFacts, band: StatesBand): MatterState[] =>
  (['solid', 'liquid', 'gas'] as MatterState[]).filter(
    (state) => tempForState(s, state, band) != null,
  );

export interface StatesChallengeOptions {
  band: StatesBand;
  count?: number;
}

/**
 * Build one judged session's challenges across the requested eval modes
 * (round-robin when more than one). Within `predict` and `compare` the draw
 * ROTATES the facet, so a single-mode session still varies its task identity —
 * which is also what keeps consecutive asks from reciting the same line
 * (`findRepeatedConsecutiveAsks`).
 *
 * Every challenge is re-validated by the script module's gates before it
 * becomes an item, so this builder aims for a zero drop rate rather than
 * relying on one.
 */
export const buildStatesOfMatterChallenges = (
  types: StatesChallengeType[],
  opts: StatesChallengeOptions,
): StatesOfMatterChallenge[] => {
  const band = opts.band;
  const count = opts.count ?? SESSION_LENGTH;
  const pool = bandPool(band);
  const used = new Set<string>();
  const challenges: StatesOfMatterChallenge[] = [];
  /** The previous kept answer per action — mirrors the script's
   *  no-two-in-a-row rule so the draw does not emit what the gate will drop. */
  const lastAnswer = new Map<string, string>();

  const free = (): SubstanceFacts[] => pool.filter((s) => !used.has(s.key));

  const claim = (...keys: string[]) => keys.forEach((k) => used.add(k));

  // ── observe ───────────────────────────────────────────────────────────────
  const drawObserve = (id: string): StatesOfMatterChallenge | null => {
    for (const s of shuffle(free())) {
      const states = shuffle(askableStates(s, band)).filter(
        (state) => lastAnswer.get('name_state') !== state,
      );
      for (const state of states) {
        const at = tempForState(s, state, band);
        if (at == null) continue;
        claim(s.key);
        lastAnswer.set('name_state', state);
        return { id, challengeType: 'observe', kind: 'name_state', substanceKey: s.key, startTemp: at };
      }
    }
    return null;
  };

  // ── predict ───────────────────────────────────────────────────────────────
  /** `changeOnly` forbids the no-change item: `predict_change` needs a real
   *  four-way transition, so there is nothing to name without one. */
  const drawPredict = (
    id: string,
    kind: 'predict_state' | 'predict_change',
    allowNoChange: boolean,
  ): StatesOfMatterChallenge | null => {
    for (const s of shuffle(free())) {
      const states = askableStates(s, band);
      if (states.length === 0) continue;

      const transitions: Array<[MatterState, MatterState]> = [];
      for (const from of states) {
        for (const to of states) {
          if (from === to) continue;
          // Only ADJACENT states — solid straight to gas is sublimation, which
          // this primitive does not teach and the script gate drops.
          const gap = Math.abs(['solid', 'liquid', 'gas'].indexOf(from) - ['solid', 'liquid', 'gas'].indexOf(to));
          if (gap !== 1) continue;
          transitions.push([from, to]);
        }
      }
      if (allowNoChange) {
        for (const state of states) transitions.push([state, state]);
      }

      for (const [from, to] of shuffle(transitions)) {
        const startTemp = tempForState(s, from, band);
        if (startTemp == null) continue;
        let targetTemp: number | null = null;
        if (from === to) {
          // A second, DIFFERENT temperature inside the same state — the item
          // whose honest answer is "nothing changed".
          const alt = from === 'solid'
            ? speakableRound(startTemp - 15)
            : speakableRound(startTemp + 15);
          if (
            alt !== startTemp
            && (band !== 'K-2' || alt >= 0)
            && tempIsClearOfThresholds(s, alt)
            && reachableState(s, alt) === to
          ) targetTemp = alt;
        } else {
          targetTemp = tempForState(s, to, band);
        }
        if (targetTemp == null || targetTemp === startTemp) continue;
        const answer = kind === 'predict_change'
          ? `${from}->${to}`
          : to;
        if (lastAnswer.get(kind) === answer) continue;
        claim(s.key);
        lastAnswer.set(kind, answer);
        return { id, challengeType: 'predict', kind, substanceKey: s.key, startTemp, targetTemp };
      }
    }
    return null;
  };

  // ── compare ───────────────────────────────────────────────────────────────
  const drawCompare = (
    id: string,
    kind: 'melt_first' | 'stay_solid',
  ): StatesOfMatterChallenge | null => {
    const candidates = shuffle(free());
    for (const a of candidates) {
      for (const b of shuffle(candidates)) {
        if (a.key === b.key) continue;
        if (a.meltingPoint === b.meltingPoint) continue;
        if (isConfusablePair(a.key, b.key)) continue;

        const lower = Math.min(a.meltingPoint, b.meltingPoint);
        const higher = Math.max(a.meltingPoint, b.meltingPoint);
        // Both beakers must READ THE SAME when the question is asked.
        const startTemp = speakableRound(lower - (TEMP_MARGIN * 4));
        if (band === 'K-2' && startTemp < 0) continue;
        if (!tempIsClearOfThresholds(a, startTemp) || !tempIsClearOfThresholds(b, startTemp)) continue;
        if (stateAt(a, startTemp) !== 'solid' || stateAt(b, startTemp) !== 'solid') continue;

        if (kind === 'melt_first') {
          const answer = (a.meltingPoint < b.meltingPoint ? a : b).name;
          if (lastAnswer.get(kind) === answer) continue;
          claim(a.key, b.key);
          lastAnswer.set(kind, answer);
          return { id, challengeType: 'compare', kind, pairKeys: [a.key, b.key], startTemp };
        }

        // stay_solid: land strictly between the two melting points, clear of
        // every threshold, so exactly one survivor remains.
        if (higher - lower < TEMP_MARGIN * 3) continue;
        const targetTemp = speakableRound((lower + higher) / 2);
        if (band === 'K-2' && targetTemp < 0) continue;
        if (!tempIsClearOfThresholds(a, targetTemp) || !tempIsClearOfThresholds(b, targetTemp)) continue;
        const aSolid = stateAt(a, targetTemp) === 'solid';
        if (aSolid === (stateAt(b, targetTemp) === 'solid')) continue;
        const answer = aSolid ? a.name : b.name;
        if (lastAnswer.get(kind) === answer) continue;
        claim(a.key, b.key);
        lastAnswer.set(kind, answer);
        return { id, challengeType: 'compare', kind, pairKeys: [a.key, b.key], startTemp, targetTemp };
      }
    }
    return null;
  };

  let index = 0;
  let predictIdx = 0;
  let compareIdx = 0;
  let attempts = 0;
  while (challenges.length < count && attempts < count * 4) {
    attempts += 1;
    const type = types[index % types.length];
    index += 1;
    const id = `som-${challenges.length + 1}-${type}`;

    let drawn: StatesOfMatterChallenge | null = null;
    if (type === 'observe') {
      drawn = drawObserve(id);
    } else if (type === 'predict') {
      // Rotate state → change → state (no-change) → … The change facet is
      // Grade 3-5 only; at K-2 the rotation collapses to the state facet, and
      // every third run is the no-change one.
      const slot = Math.floor(predictIdx / FACET_RUN) % 3;
      predictIdx += 1;
      drawn = slot === 1 && band !== 'K-2'
        ? drawPredict(id, 'predict_change', false)
        : drawPredict(id, 'predict_state', slot === 2);
    } else {
      const slot = Math.floor(compareIdx / FACET_RUN) % 2;
      compareIdx += 1;
      drawn = drawCompare(id, slot === 0 ? 'melt_first' : 'stay_solid');
    }
    if (drawn) challenges.push(drawn);
  }

  return challenges;
};

/** Substance keys the exploration surface may offer, per band — the switcher's
 *  pool, kept on the same table so a lesson never explores a substance the
 *  judged session cannot ask about. */
export const explorationSubstanceKeys = (band: StatesBand): string[] =>
  bandPool(band).map((s) => s.key).filter((k) => k in SUBSTANCES);
