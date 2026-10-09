/**
 * The in-item levers on states-of-matter (`/add-support-tiers`, report qa/eval-reports/states-of-matter-levers-2026-10-08.md).
 * No real-learner evidence: the misses are what `statesSpokenMisses` names on each mode's spoken answer.
 *
 * Every answer is spoken and computed from the substance table, and nothing on screen may print this item's state,
 * target temperature or winner. So:
 * - observe: `particle_models` (help) three model particle boxes in a neutral colour, one per state, each tagged with
 *   how its particles move. Nothing marks which one the beaker's particles move like. `three_named` (simplify) a practice
 *   item on another substance whose ask names "solid, liquid, or gas?". None on an item already asked at the easy tier.
 * - predict: `temperature_strip` (help) a strip with the substance's melting and boiling points marked, the zones (or,
 *   on a change question, the four change names on the crossings) labelled and a "now" pointer at the start
 *   temperature. The temperature the tutor is going to is never marked. `one_point` (simplify) the same question on a
 *   substance that does not boil, so only one point is compared. None when the item's substance already has one point.
 * - compare: `model_pair` (help) two model substances that are not this item's pair, heated to one temperature between
 *   their melting points, each tagged with its melting point and what it did. `far_pair` (simplify) a which-melts-first
 *   practice item on a pair whose melting points are far apart. None when no such pair is left in the band.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import {
  bandPool,
  isConfusablePair,
  itemFromChallenge,
  stateAt,
  tempIsClearOfThresholds,
  tempSpoken,
  TEMP_MARGIN,
  type MatterState,
  type StatesBand,
  type StatesOfMatterItem,
  type SubstanceFacts,
} from './statesOfMatterScript';
import type { SpokenStatesMiss } from './statesOfMatterWorkspace';

export const PARTICLE_MODELS_LEVER = 'particle_models';
export const TEMPERATURE_STRIP_LEVER = 'temperature_strip';
export const MODEL_PAIR_LEVER = 'model_pair';
export const THREE_NAMED_LEVER = 'three_named';
export const ONE_POINT_LEVER = 'one_point';
export const FAR_PAIR_LEVER = 'far_pair';
export const PRACTICE_SUFFIX = '~simpler';

/** What a lever reads beyond the item: the band, and every substance the lesson carries in any role. */
export interface StatesLeverSession { band: StatesBand; keys: readonly string[] }

export const statesLeverSession = (items: readonly StatesOfMatterItem[], band: StatesBand): StatesLeverSession => ({
  band,
  keys: items.flatMap(i => (i.pair ? i.pair.map(s => s.key) : i.substance ? [i.substance.key] : [])),
});

const seedOf = (id: string) => Array.from(id).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const rotate = <T,>(list: readonly T[], id: string) => {
  if (!list.length) return [];
  const at = seedOf(id) % list.length;
  return [...list.slice(at), ...list.slice(0, at)];
};
const keysOf = (item: StatesOfMatterItem) => (item.pair ? item.pair.map(s => s.key) : item.substance ? [item.substance.key] : []);
/** Candidates the lesson does not carry first, then the rest; never the item's own substances. */
const preferFree = <T,>(list: readonly T[], keys: (t: T) => string[], item: StatesOfMatterItem, s: StatesLeverSession) => {
  const own = new Set(keysOf(item));
  const usable = list.filter(t => !keys(t).some(k => own.has(k)));
  const free = usable.filter(t => !keys(t).some(k => s.keys.includes(k)));
  return [...rotate(free, item.id), ...rotate(usable.filter(t => !free.includes(t)), item.id)];
};

// ── particle_models (observe) ──────────────────────────────────────────────

export interface ParticleModel { state: MatterState; tag: string }

/** A colour no substance in the table uses, so a model cannot be matched to the beaker by colour. */
export const MODEL_COLOR = '#e879f9';

export const PARTICLE_MODELS: readonly ParticleModel[] = [
  { state: 'solid', tag: 'only shake in place' },
  { state: 'liquid', tag: 'slide past each other' },
  { state: 'gas', tag: 'fly apart' },
];

/** The model tag as drawn under each box: how the particles move, then the state. */
export const modelTag = (m: ParticleModel) => `particles ${m.tag}: a ${m.state}`;

/** Leak rule for the particle models: exactly one per state, and a colour the item's substance never shows. */
export const particleModelsLeak = (models: readonly ParticleModel[], color: string, item: StatesOfMatterItem) =>
  (['solid', 'liquid', 'gas'] as const).some(st => models.filter(m => m.state === st).length !== 1)
  || Object.values(item.substance?.color ?? {}).some(c => c.toLowerCase() === color.toLowerCase());

// ── temperature_strip (predict) ────────────────────────────────────────────

export interface StripMark { temp: number; label: string }
export interface TemperatureStrip {
  substance: SubstanceFacts;
  /** The melting point, and the boiling point where boiling is real. */
  marks: StripMark[];
  /** Zone labels bottom to top (predict_state) or crossing labels (predict_change). */
  labels: string[];
  /** The start temperature: where it sits now. */
  now: number;
}

export function stripFor(item: StatesOfMatterItem): TemperatureStrip | null {
  const s = item.substance;
  if ((item.kind !== 'predict_state' && item.kind !== 'predict_change') || !s || item.startTemp === undefined) return null;
  const marks: StripMark[] = [{ temp: s.meltingPoint, label: item.kind === 'predict_change' ? 'solid ↔ liquid' : 'melts' }];
  if (s.boilingIsReal) marks.push({ temp: s.boilingPoint, label: item.kind === 'predict_change' ? 'liquid ↔ gas' : 'boils' });
  const labels = item.kind === 'predict_change'
    ? ['melting going up, freezing coming down', ...(s.boilingIsReal ? ['boiling going up, condensing coming down'] : [])]
    : ['solid below the melting point', s.boilingIsReal ? 'liquid between the two points' : 'liquid above it',
      ...(s.boilingIsReal ? ['gas above the boiling point'] : [])];
  return { substance: s, marks, labels, now: item.startTemp };
}

/** Leak rule for the strip: no mark or pointer at the target temperature, and every zone or crossing labelled (none singled out). */
export function stripLeaks(strip: TemperatureStrip, item: StatesOfMatterItem): boolean {
  if (item.targetTemp === undefined) return true;
  if (strip.now === item.targetTemp || strip.marks.some(m => m.temp === item.targetTemp)) return true;
  const points = strip.substance.boilingIsReal ? 2 : 1;
  return strip.marks.length !== points || strip.labels.length !== (item.kind === 'predict_change' ? points : points + 1);
}

// ── model_pair (compare) ───────────────────────────────────────────────────

export interface ModelPair { pair: [SubstanceFacts, SubstanceFacts]; temp: number }

const pairsOf = (pool: readonly SubstanceFacts[]) =>
  pool.flatMap((a, i) => pool.slice(i + 1).map(b => [a, b] as [SubstanceFacts, SubstanceFacts]));

/** The temperature a model pair is heated to: between the two melting points, clear of every threshold. */
const modelTempFor = ([a, b]: [SubstanceFacts, SubstanceFacts], band: StatesBand): number | null => {
  const lo = Math.min(a.meltingPoint, b.meltingPoint), hi = Math.max(a.meltingPoint, b.meltingPoint);
  if (hi - lo < 2 * TEMP_MARGIN) return null;
  const t = Math.round((lo + hi) / 2);
  if (band === 'K-2' && t < 0) return null;
  if (!tempIsClearOfThresholds(a, t) || !tempIsClearOfThresholds(b, t)) return null;
  // The one that melted is a liquid, not a gas: the model shows melting and nothing else.
  return stateAt(a, t) !== 'gas' && stateAt(b, t) !== 'gas' ? t : null;
};

/** Two model substances that are not this item's pair, heated to one temperature where exactly one has melted. */
export function modelPairFor(item: StatesOfMatterItem, s: StatesLeverSession): ModelPair | null {
  if (!item.pair) return null;
  for (const pair of preferFree(pairsOf(bandPool(s.band)), p => p.map(x => x.key), item, s)) {
    const temp = modelTempFor(pair, s.band);
    if (temp !== null) return { pair: [...pair].sort((x, y) => x.meltingPoint - y.meltingPoint) as [SubstanceFacts, SubstanceFacts], temp };
  }
  return null;
}

/** Leak rule for the model pair: neither model is in the item's pair, and exactly one of them has melted at the model temperature. */
export const modelPairLeaks = (m: ModelPair, item: StatesOfMatterItem) =>
  m.pair[0].key === m.pair[1].key
  || m.pair.some(x => (item.pair ?? []).some(p => p.key === x.key))
  || m.pair.filter(x => stateAt(x, m.temp) === 'solid').length !== 1;

export const modelPairTag = (x: SubstanceFacts, temp: number) =>
  `melts at ${tempSpoken(x.meltingPoint)}: ${stateAt(x, temp) === 'solid' ? 'still solid' : 'melted'}`;

// ── practice items (simplify) ──────────────────────────────────────────────

/** How far apart a far pair's melting points must be (and at least twice the item's own gap). */
export const FAR_GAP = 25;

const clear = (s: SubstanceFacts, t: number, band: StatesBand) => (band !== 'K-2' || t >= 0) && tempIsClearOfThresholds(s, t);

/** A temperature well inside each state a substance can reach in the band. */
function stateTemps(s: SubstanceFacts, band: StatesBand): { state: MatterState; temp: number }[] {
  const out: { state: MatterState; temp: number }[] = [];
  const solid = s.meltingPoint - 20;
  const liquid = s.meltingPoint + Math.min(20, Math.floor((s.boilingPoint - s.meltingPoint) / 2));
  const gas = s.boilingPoint + 30;
  if (clear(s, solid, band)) out.push({ state: 'solid', temp: solid });
  if (clear(s, liquid, band)) out.push({ state: 'liquid', temp: liquid });
  if (s.boilingIsReal && clear(s, gas, band)) out.push({ state: 'gas', temp: gas });
  return out;
}

const practiceId = (item: StatesOfMatterItem) => `${item.id}${PRACTICE_SUFFIX}`;

/**
 * The practice item a simplify lever opens, or null when the item is already the plainest of its kind:
 * observe asked at the easy tier, predict on a substance with one point, compare with no far pair left in the band.
 */
export function practiceItem(item: StatesOfMatterItem, s: StatesLeverSession): StatesOfMatterItem | null {
  const opts = { band: s.band, tier: 'easy' as const };
  const id = practiceId(item);
  let built: StatesOfMatterItem | null = null;
  if (item.kind === 'name_state') {
    if (item.tier === 'easy') return null;
    // Everyday substances first (the K-2 half of the table), at a temperature well inside the state.
    const optionsIn = (pool: readonly SubstanceFacts[]) => pool.flatMap(x => stateTemps(x, s.band).map(st => ({ x, ...st })));
    const everyday = bandPool('K-2').filter(x => x.bands.includes(s.band));
    const rest = bandPool(s.band).filter(x => !everyday.includes(x));
    for (const o of [...preferFree(optionsIn(everyday), c => [c.x.key], item, s), ...preferFree(optionsIn(rest), c => [c.x.key], item, s)]) {
      built = itemFromChallenge({ id, challengeType: 'observe', substanceKey: o.x.key, startTemp: o.temp }, opts);
      if (built) break;
    }
  } else if (item.kind === 'predict_state' || item.kind === 'predict_change') {
    if (!item.substance?.boilingIsReal || item.startTemp === undefined || item.targetTemp === undefined) return null;
    const heating = item.targetTemp > item.startTemp;
    const onePoint = bandPool(s.band).filter(x => !x.boilingIsReal);
    for (const x of preferFree(onePoint, c => [c.key], item, s)) {
      const below = x.meltingPoint - 15, above = x.meltingPoint + 20;
      built = itemFromChallenge({ id, challengeType: 'predict', kind: item.kind, substanceKey: x.key,
        startTemp: heating ? below : above, targetTemp: heating ? above : below }, opts);
      if (built) break;
    }
  } else if (item.pair) {
    const [a, b] = item.pair;
    const need = item.kind === 'melt_first' ? Math.max(FAR_GAP, 2 * Math.abs(a.meltingPoint - b.meltingPoint)) : FAR_GAP;
    const far = pairsOf(bandPool(s.band)).filter(([x, y]) => Math.abs(x.meltingPoint - y.meltingPoint) >= need && !isConfusablePair(x.key, y.key));
    for (const [x, y] of preferFree(far, p => p.map(q => q.key), item, s)) {
      built = itemFromChallenge({ id, challengeType: 'compare', kind: 'melt_first', pairKeys: [x.key, y.key],
        startTemp: Math.min(x.meltingPoint, y.meltingPoint) - 15 }, opts);
      if (built) break;
    }
  }
  return built && !practiceLeaks(built, item) ? built : null;
}

/** The session item a practice id stands in for. */
export const practiceParent = (id: string, items: readonly StatesOfMatterItem[]) =>
  items.find(i => practiceId(i) === id) ?? null;

/**
 * Leak rule for a practice item: a new id, the same mode, none of the item's own substances, and one step simpler in
 * shape (observe: the three states named; predict: one point; compare: a which-melts-first pair at least `FAR_GAP` apart).
 */
export function practiceLeaks(p: StatesOfMatterItem, item: StatesOfMatterItem): boolean {
  if (p.id === item.id || p.challengeType !== item.challengeType) return true;
  if (keysOf(p).some(k => keysOf(item).includes(k))) return true;
  if (item.kind === 'name_state') return p.kind !== 'name_state' || p.tier !== 'easy';
  if (item.kind === 'predict_state' || item.kind === 'predict_change') return p.kind !== item.kind || !!p.substance?.boilingIsReal;
  if (!p.pair || p.kind !== 'melt_first') return true;
  return Math.abs(p.pair[0].meltingPoint - p.pair[1].meltingPoint) < FAR_GAP;
}

// ── what is on screen ──────────────────────────────────────────────────────

/** What the pulled levers put on screen, for the tutor and JEV: what is drawn, never this item's answer. */
export function leversOnScreen(item: StatesOfMatterItem, on: readonly string[], s: StatesLeverSession): string | null {
  const parts: string[] = [];
  if (on.includes(PARTICLE_MODELS_LEVER) && item.kind === 'name_state') {
    parts.push(`beside the beaker, three model particle boxes that are not the ${item.substance!.name}, in a colour of their own, `
      + `each tagged: ${PARTICLE_MODELS.map(modelTag).join('; ')}. Nothing marks which box the beaker's particles move like`);
  }
  const strip = on.includes(TEMPERATURE_STRIP_LEVER) ? stripFor(item) : null;
  if (strip) {
    parts.push(`beside the beaker, a temperature strip for the ${strip.substance.name}: `
      + `${strip.marks.map(m => `a mark at ${tempSpoken(m.temp)} (${m.label})`).join(' and ')}, labelled ${strip.labels.join('; ')}, `
      + `and a "now" pointer at ${tempSpoken(strip.now)}. The temperature it is going to is not marked`);
  }
  const model = on.includes(MODEL_PAIR_LEVER) ? modelPairFor(item, s) : null;
  if (model) {
    parts.push(`under the two beakers, a model pair that is not this item, both heated to ${tempSpoken(model.temp)}: `
      + `${model.pair.map(x => `${x.name} (${modelPairTag(x, model.temp)})`).join('; ')}. Nothing marks which of this item's two is like which model`);
  }
  return parts.length ? parts.join('; ') : null;
}

// ── the levers ─────────────────────────────────────────────────────────────

const MISSES: Record<StatesOfMatterItem['kind'], SpokenStatesMiss[]> = {
  name_state: ['other_state', 'said_substance_back'],
  predict_state: ['said_start_state', 'other_state'],
  predict_change: ['said_end_state', 'opposite_change'],
  melt_first: ['other_of_pair'],
  stay_solid: ['other_of_pair'],
};

export function statesLevers(item: StatesOfMatterItem | null, s: StatesLeverSession, pulled: readonly string[]): WorkspaceLever[] {
  if (!item) return [];
  const answers = MISSES[item.kind];
  const levers: WorkspaceLever[] = [];
  const add = (id: string, kind: WorkspaceLever['kind'], when: string, does: string) =>
    levers.push({ id, kind, carrier: 'both', pulled: pulled.includes(id), answers, when, does });
  const simplify = practiceItem(item, s);
  const practiceDoes = 'Once it is on screen, ask its question as shown; never make one up. Not graded; the full item comes back after it.';
  switch (item.kind) {
    case 'name_state':
      add(PARTICLE_MODELS_LEVER, 'help', 'The learner names another state, or says the substance\'s name back.',
        'Draws three model particle boxes beside the beaker, in a colour of their own, one moving like a solid, one like a liquid, '
        + 'one like a gas, each tagged with how its particles move. Read the tags if you like. Never say which box the beaker\'s '
        + 'particles move like, or what state the substance is.');
      if (simplify) add(THREE_NAMED_LEVER, 'simplify', 'The learner still cannot answer after help.',
        `Opens an easier practice item first: another substance, and the question names the three states. ${practiceDoes}`);
      break;
    case 'predict_state':
    case 'predict_change':
      add(TEMPERATURE_STRIP_LEVER, 'help', item.kind === 'predict_change'
        ? 'The learner says the state it ends up in, or the opposite change.' : 'The learner says the state it is in now, or another state.',
        `Draws a temperature strip beside the beaker with the points from the question marked, ${item.kind === 'predict_change'
          ? 'each crossing labelled with its change going up and coming down' : 'each zone labelled with its state'}, and a "now" `
        + 'pointer where it sits. The temperature it is going to is not marked: the learner places it. Never say which zone or '
        + 'crossing the new temperature lands in, and never compare it with a marked point (above, below, past or under it): '
        + 'that comparison is the learner\'s step.');
      if (simplify) add(ONE_POINT_LEVER, 'simplify', 'The learner still cannot answer after help.',
        `Opens an easier practice item first: the same question on a substance that does not boil, so there is only one point to compare. ${practiceDoes}`);
      break;
    case 'melt_first':
    case 'stay_solid':
      if (modelPairFor(item, s)) add(MODEL_PAIR_LEVER, 'help', 'The learner names the other one of the two.',
        'Draws a model pair under the beakers, two other substances heated to one temperature, each tagged with its melting point and '
        + 'whether it melted or is still solid. Read the model if you like. Never put the learner\'s two numbers beside the model\'s, '
        + 'and never say which of the learner\'s two melts first or stays solid, or which model it is like.');
      if (simplify) add(FAR_PAIR_LEVER, 'simplify', 'The learner still cannot answer after help.',
        `Opens an easier practice item first: which of two substances melts first, with melting points far apart. ${practiceDoes}`);
      break;
  }
  return levers;
}
