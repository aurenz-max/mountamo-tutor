/**
 * Volcano Island's runny-or-sticky test, pure: the magmas of real volcanoes, what kind of eruption each makes, the items
 * code builds, and the check. The 3D island (`volcano3d.ts`) erupts each magma the way this file says.
 *
 * How a volcano erupts depends on its magma. Runny magma (thin like syrup) lets gas bubble out easily, so lava pours
 * out and flows far down the mountain in rivers. Thick, sticky magma (like peanut butter) traps its gas: with lots of gas
 * it bursts in an explosion and an ash cloud; with little gas it oozes out and piles up into a lumpy dome at the top.
 * The learner tests magmas, then decides about a new one from what it is like, not from how big the volcano is.
 */
import type { Rng, Tier } from './volcanoModel';

export type Outcome = 'flows' | 'explodes' | 'dome';
export interface Magma {
  key: string;
  /** The volcano it comes from. */
  name: string;
  thick: boolean;
  gas: 'lots' | 'little';
}

export const MAGMAS: readonly Magma[] = [
  { key: 'kilauea', name: 'Kīlauea in Hawaiʻi', thick: false, gas: 'little' },
  { key: 'mauna-loa', name: 'Mauna Loa in Hawaiʻi', thick: false, gas: 'little' },
  { key: 'fagradalsfjall', name: 'Fagradalsfjall in Iceland', thick: false, gas: 'lots' },
  { key: 'st-helens', name: 'Mount St. Helens', thick: true, gas: 'lots' },
  { key: 'pinatubo', name: 'Mount Pinatubo', thick: true, gas: 'lots' },
  { key: 'vesuvius', name: 'Mount Vesuvius', thick: true, gas: 'lots' },
  { key: 'soufriere', name: 'Soufrière Hills', thick: true, gas: 'little' },
  { key: 'lassen', name: 'Lassen Peak', thick: true, gas: 'little' },
];
export const magmaByKey = (k: string) => MAGMAS.find(m => m.key === k);
export const outcomeOf = (m: Magma): Outcome => (!m.thick ? 'flows' : m.gas === 'lots' ? 'explodes' : 'dome');
export const kindOf = (m: Magma) => (!m.thick ? 'runny' : m.gas === 'lots' ? 'thick-gassy' : 'thick-calm');

export const OUTCOME_WORDS: Record<Outcome, string> = {
  flows: 'lava flows far in rivers', explodes: 'it explodes with an ash cloud', dome: 'lava piles up into a dome',
};
export const magmaLooks = (m: Magma) =>
  `${m.thick ? 'thick and sticky, like peanut butter' : 'runny, like syrup'}, with ${m.gas === 'lots' ? 'lots of' : 'few'} gas bubbles`;

export interface MagmaChallenge {
  id: string;
  type: 'runny_or_sticky';
  instruction: string;
  /** The magmas the learner erupts first, left to right. */
  tested: Magma[];
  /** The new volcano's magma, decided about from what it is like. Erupted only after a right call. */
  mystery: Magma;
  /** The calls the learner may make (two below hard, three at hard). */
  outcomes: Outcome[];
  supportTier?: Tier;
  startLevers?: string[];
}

export const magmaInstruction = (tested: readonly Magma[], mystery: Magma) =>
  `Erupt the magma from ${tested.map(t => t.name).join(' and from ')}. Then decide: what will ${mystery.name}'s magma do?`;

export function makeMagma(id: string, tested: Magma[], mystery: Magma, outcomes: Outcome[]): MagmaChallenge {
  return { id, type: 'runny_or_sticky', instruction: magmaInstruction(tested, mystery), tested, mystery, outcomes };
}

/** Fair: the tests show every outcome on offer, the mystery's kind is among the tests, and it is not itself a test. */
export function magmaFair(c: Pick<MagmaChallenge, 'tested' | 'mystery' | 'outcomes'>): boolean {
  const shown = new Set(c.tested.map(outcomeOf));
  return c.outcomes.every(o => shown.has(o)) && c.outcomes.includes(outcomeOf(c.mystery))
    && c.tested.some(t => kindOf(t) === kindOf(c.mystery)) && !c.tested.some(t => t.key === c.mystery.key);
}

const shuffle = <T,>(xs: readonly T[], rng: Rng): T[] => {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
};

/**
 * One item. Easy and medium: a runny test and a thick-gassy test, two calls (flows or explodes); easy's mystery is
 * like a test in thickness and gas, medium's only in kind. Hard: one test of each kind and three calls, so the learner must use thickness and gas.
 */
export function buildMagma(tier: Tier, rng: Rng, id: string): MagmaChallenge | null {
  const kinds = tier === 'hard' ? ['runny', 'thick-gassy', 'thick-calm'] : ['runny', 'thick-gassy'];
  const outcomes: Outcome[] = tier === 'hard' ? ['flows', 'explodes', 'dome'] : ['flows', 'explodes'];
  for (let attempt = 0; attempt < 40; attempt++) {
    const tested = kinds.map(k => shuffle(MAGMAS.filter(m => kindOf(m) === k), rng)[0]);
    const pick = tested[Math.floor(rng() * tested.length)];
    // Easy: the mystery is like a test in both ways. Above: the same kind only (a gassy runny magma still flows).
    const like = (m: Magma) => (tier === 'easy' ? m.thick === pick.thick && m.gas === pick.gas : kindOf(m) === kindOf(pick));
    const mystery = shuffle(MAGMAS.filter(m => like(m) && !tested.includes(m)), rng)[0];
    if (!mystery) continue;
    const c = makeMagma(id, shuffle(tested, rng), mystery, outcomes);
    if (magmaFair(c)) return c;
  }
  return null;
}

export function pickMagmas(n: number, tier: Tier, rng: Rng, idPrefix = 'magma'): MagmaChallenge[] {
  const out: MagmaChallenge[] = [];
  for (let i = 0; out.length < n && i < n * 20; i++) {
    const c = buildMagma(tier, rng, `${idPrefix}-${out.length + 1}`);
    if (c && (i >= n * 10 || !out.some(x => x.mystery.key === c.mystery.key))) out.push(c);
  }
  return out;
}

// ============================================================================
// The check
// ============================================================================

export type MagmaMiss = 'missed_thickness' | 'missed_gas';

export const magmaMatches = (c: MagmaChallenge, call: Outcome | null) => call === outcomeOf(c.mystery);

/** The named miss: a call that gets runny versus thick wrong, else one that gets the gas wrong. */
export function magmaMiss(c: MagmaChallenge, call: Outcome | null): MagmaMiss | undefined {
  if (magmaMatches(c, call)) return undefined;
  return (call === 'flows') !== !c.mystery.thick ? 'missed_thickness' : 'missed_gas';
}

export const describeMagma = (c: MagmaChallenge, call: Outcome | null) =>
  `said ${c.mystery.name}'s magma: ${call ? OUTCOME_WORDS[call] : 'no call yet'}`;

export function magmaFeedback(c: MagmaChallenge, call: Outcome | null): string {
  const miss = magmaMiss(c, call);
  if (!miss) {
    const o = outcomeOf(c.mystery);
    return o === 'flows' ? 'Yes! Runny magma lets its gas bubble out, so the lava pours out and flows far.'
      : o === 'explodes' ? 'Yes! Thick magma traps its gas until it bursts: an explosion and an ash cloud.'
        : 'Yes! Thick magma with little gas just oozes out and piles up into a dome.';
  }
  if (miss === 'missed_thickness') return 'Look at your tests: what did the runny magma do, and what did the thick magma do? Is this one runny or thick?';
  return 'Thick magma can do two things. Look at the gas bubbles in your tests: what did the magma with lots of gas do?';
}
