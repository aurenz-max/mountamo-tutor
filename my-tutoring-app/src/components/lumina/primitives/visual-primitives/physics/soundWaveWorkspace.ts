/**
 * sound-wave-explorer on the shared tutor/JEV teaching workspace (W1, plain shape; ROLLOUT C28).
 *
 * Every item is built and keyed by code from a small set of sound facts (a vibration makes the sound; bigger shakes
 * are louder, a taller wave; faster shakes are higher, crests packed closer; moving away and pumping the air out make
 * a sound quieter and leave its pitch alone). Each mode is one closed choice the learner taps and checks, or says (J14):
 * - observe: a sound maker starts or stops shaking, or a sound starts or stops; say what happens to the other half
 *   (the sound, or the shaking). Hard: a loud sound makes something else shake (rice on a drum beside a speaker).
 * - predict: one sound maker played once (its wave drawn, its sound playable); one change; predict what happens to the
 *   loudness or the pitch. The after wave and sound appear only once the answer is credited.
 * - classify: two or three waves drawn at one scale; which sound is louder, quieter, higher or lower. The sounds play
 *   only once the answer is credited, so the learner reads the drawing, not the speaker.
 * - apply: a before wave and an after wave; which change to the sound maker made the after sound.
 * Difficulty (`config.difficulty`) is structural: easy names the change in shaking words and differs in one feature;
 * medium names physical changes (tighten the string, walk away) or crosses the two features (the taller wave is the
 * lower sound); hard asks about the feature a change leaves alone ("stays the same" keys), three waves, or two changes.
 *
 * Pure: the component, the generator, the adapter, the journey row and the tests read the same items, checks, misses
 * and scene.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';

export type SoundMode = 'observe' | 'predict' | 'classify' | 'apply';
export const SOUND_MODES: SoundMode[] = ['observe', 'predict', 'classify', 'apply'];
export type SoundTier = 'easy' | 'medium' | 'hard';
/** What the lesson is about (the model's reading of the topic). Observe always teaches vibration. */
export type SoundFocus = 'vibration' | 'loudness' | 'pitch' | 'both';
export type Feature = 'loudness' | 'pitch';
export type Maker = 'drum' | 'guitar_string' | 'rubber_band' | 'bell' | 'tuning_fork';
/** One drawn wave: `amp` 0 (flat, no sound) to 5 (tallest); `crests` 1 (spread out) to 5 (packed closest). */
export interface Wave { amp: number; crests: number }

/** observe: what happens first; the ask is about the other half of the vibration-sound link. */
export type ObserveEvent = 'struck' | 'held' | 'heard_start' | 'heard_stop' | 'speaker_on' | 'speaker_off' | 'fork_water';
/** One change to how a sound maker is played or heard. */
export type Change = 'force_up' | 'force_down' | 'speed_up' | 'speed_down' | 'farther' | 'air_out';
/** How a change is named: in shaking words ("it shakes faster") or as the physical change ("the string is tightened"). */
export type Wording = 'shaking' | 'physical';

interface Base { id: string; maker: Maker }
export interface ObserveItem extends Base { mode: 'observe'; event: ObserveEvent }
export interface PredictItem extends Base { mode: 'predict'; before: Wave; change: Change; asked: Feature; wording: Wording }
export interface ClassifyItem extends Base { mode: 'classify'; waves: Wave[]; asked: Feature; ask: 'most' | 'least' }
export interface ApplyItem extends Base { mode: 'apply'; before: Wave; changes: Change[]; wording: Wording }
export type SoundItem = ObserveItem | PredictItem | ClassifyItem | ApplyItem;

export const MAKER_NAME: Record<Maker, string> = {
  drum: 'drum', guitar_string: 'guitar string', rubber_band: 'rubber band', bell: 'bell', tuning_fork: 'tuning fork',
};
const PLAY: Record<Maker, { verb: string; past: string }> = {
  drum: { verb: 'hit', past: 'hit' }, guitar_string: { verb: 'pluck', past: 'plucked' }, rubber_band: { verb: 'pluck', past: 'plucked' },
  bell: { verb: 'ring', past: 'rung' }, tuning_fork: { verb: 'strike', past: 'struck' },
};
/** Makers whose shaking speed a learner can change (tension). */
const TUNABLE: Maker[] = ['guitar_string', 'rubber_band', 'drum'];
const TIGHTEN: Record<string, { up: string; down: string; upLabel: string; downLabel: string }> = {
  guitar_string: { up: 'The string is tightened.', down: 'The string is loosened.', upLabel: 'Tightened the string', downLabel: 'Loosened the string' },
  rubber_band: { up: 'The band is stretched tighter.', down: 'The band is let go looser.', upLabel: 'Stretched the band tighter', downLabel: 'Let the band go looser' },
  drum: { up: 'The drum skin is tightened.', down: 'The drum skin is loosened.', upLabel: 'Tightened the drum skin', downLabel: 'Loosened the drum skin' },
};

// ── Physics ──────────────────────────────────────────────────────────────────────────────

export const FEATURE_OF: Record<Change, Feature> = {
  force_up: 'loudness', force_down: 'loudness', farther: 'loudness', air_out: 'loudness', speed_up: 'pitch', speed_down: 'pitch',
};
const UP: Record<Change, boolean> = { force_up: true, speed_up: true, force_down: false, speed_down: false, farther: false, air_out: false };

export function applyChange(w: Wave, c: Change): Wave {
  if (c === 'air_out') return { amp: 0, crests: w.crests };
  if (FEATURE_OF[c] === 'loudness') return { ...w, amp: w.amp + (UP[c] ? 2 : -2) };
  return { ...w, crests: w.crests + (UP[c] ? 2 : -2) };
}
export const afterWave = (item: PredictItem | ApplyItem): Wave =>
  (item.mode === 'predict' ? [item.change] : item.changes).reduce(applyChange, item.before);

const level = (w: Wave, f: Feature) => (f === 'loudness' ? w.amp : w.crests);
const validWave = (w: Wave | undefined, flatOk = false) => !!w && Number.isInteger(w.amp) && Number.isInteger(w.crests)
  && w.amp >= (flatOk ? 0 : 1) && w.amp <= 5 && w.crests >= 1 && w.crests <= 5;

// ── Choices, keys, misses ────────────────────────────────────────────────────────────────

export const SOUND_CHOICES = ['A sound starts', 'The sound stops', 'Nothing changes'] as const;
export const SHAKE_CHOICES = ['Starts to shake', 'Stops shaking', 'Nothing changes'] as const;
export const LOUDNESS_CHOICES = ['Louder', 'Quieter', 'Stays the same'] as const;
export const PITCH_CHOICES = ['Higher', 'Lower', 'Stays the same'] as const;
export const SAME_WAVES = 'They are the same';
export const WAVE_LABELS = ['Sound A', 'Sound B', 'Sound C'];

export type ObserveMiss = 'start_stop_swapped' | 'said_no_change';
export type PredictMiss = 'opposite_direction' | 'said_same' | 'mixed_up_features';
export type ClassifyMiss = 'read_other_feature' | 'opposite_end' | 'said_same' | 'missed_same';
export type ApplyMiss = 'opposite_change' | 'wrong_feature' | 'loudness_misread' | 'pitch_misread' | 'both_misread';
export type SoundWaveMiss = ObserveMiss | PredictMiss | ClassifyMiss | ApplyMiss;
export const SOUND_MISSES: Record<SoundMode, readonly SoundWaveMiss[]> = {
  observe: ['start_stop_swapped', 'said_no_change'],
  predict: ['mixed_up_features', 'opposite_direction', 'said_same'],
  classify: ['read_other_feature', 'opposite_end', 'missed_same', 'said_same'],
  apply: ['wrong_feature', 'opposite_change', 'loudness_misread', 'pitch_misread', 'both_misread'],
};

/** observe: whether the ask is about the sound or the shaking, and whether the asked half starts or stops. */
const OBSERVE: Record<ObserveEvent, { asks: 'sound' | 'shake'; starts: boolean }> = {
  struck: { asks: 'sound', starts: true }, held: { asks: 'sound', starts: false },
  heard_start: { asks: 'shake', starts: true }, heard_stop: { asks: 'shake', starts: false },
  speaker_on: { asks: 'shake', starts: true }, speaker_off: { asks: 'shake', starts: false }, fork_water: { asks: 'shake', starts: true },
};
export const observeAsks = (item: ObserveItem) => OBSERVE[item.event].asks;

/** apply: the label of one change (or of two together) for this maker and wording. */
function changeLabel(maker: Maker, c: Change, wording: Wording): string {
  const p = PLAY[maker].past;
  const cap = `${p.charAt(0).toUpperCase()}${p.slice(1)}`;
  if (FEATURE_OF[c] === 'loudness') return c === 'force_up' ? `${cap} harder` : `${cap} more gently`;
  if (wording === 'shaking' || !TIGHTEN[maker]) return c === 'speed_up' ? 'Made to shake faster' : 'Made to shake slower';
  return c === 'speed_up' ? TIGHTEN[maker].upLabel : TIGHTEN[maker].downLabel;
}
const comboLabel = (maker: Maker, cs: Change[], wording: Wording) => {
  const [a, b] = cs.map(c => changeLabel(maker, c, wording));
  return `${a} and ${b.charAt(0).toLowerCase()}${b.slice(1)}`;
};
const FLIP: Record<Change, Change> = { force_up: 'force_down', force_down: 'force_up', speed_up: 'speed_down', speed_down: 'speed_up', farther: 'farther', air_out: 'air_out' };

/** apply: every choice with what it stands for, in a fixed order (loudness changes first). */
export function applyChoices(item: ApplyItem): Array<{ label: string; changes: Change[] }> {
  if (item.changes.length === 2) {
    return (['force_up', 'force_down'] as Change[]).flatMap(f => (['speed_up', 'speed_down'] as Change[])
      .map(s => ({ label: comboLabel(item.maker, [f, s], item.wording), changes: [f, s] })));
  }
  return (['force_up', 'force_down', 'speed_up', 'speed_down'] as Change[]).map(c => ({ label: changeLabel(item.maker, c, item.wording), changes: [c] }));
}

export function choicesOf(item: SoundItem): string[] {
  if (item.mode === 'observe') return [...(observeAsks(item) === 'sound' ? SOUND_CHOICES : SHAKE_CHOICES)];
  if (item.mode === 'predict') return [...(item.asked === 'loudness' ? LOUDNESS_CHOICES : PITCH_CHOICES)];
  if (item.mode === 'classify') return [...WAVE_LABELS.slice(0, item.waves.length), ...(item.waves.length === 2 ? [SAME_WAVES] : [])];
  return applyChoices(item).map(c => c.label);
}

/** classify: the index of the wave that is most (or least) on a feature, or null when no single one is. */
function extreme(item: ClassifyItem, f: Feature): number | null {
  const vals = item.waves.map(w => level(w, f));
  const best = item.ask === 'most' ? Math.max(...vals) : Math.min(...vals);
  const at = vals.flatMap((v, i) => (v === best ? [i] : []));
  return at.length === 1 ? at[0] : null;
}
const otherFeature = (f: Feature): Feature => (f === 'loudness' ? 'pitch' : 'loudness');

export function keyChoice(item: SoundItem): string {
  if (item.mode === 'observe') {
    const { asks, starts } = OBSERVE[item.event];
    return asks === 'sound' ? (starts ? SOUND_CHOICES[0] : SOUND_CHOICES[1]) : (starts ? SHAKE_CHOICES[0] : SHAKE_CHOICES[1]);
  }
  if (item.mode === 'predict') {
    const choices = choicesOf(item);
    if (FEATURE_OF[item.change] !== item.asked) return choices[2];
    return UP[item.change] ? choices[0] : choices[1];
  }
  if (item.mode === 'classify') {
    const at = extreme(item, item.asked);
    return at === null ? SAME_WAVES : WAVE_LABELS[at];
  }
  return item.changes.length === 2 ? comboLabel(item.maker, item.changes, item.wording) : changeLabel(item.maker, item.changes[0], item.wording);
}

export const soundCorrect = (item: SoundItem | undefined, choice: string | null) => !!item && choice !== null && choice === keyChoice(item);

export function soundMiss(item: SoundItem | undefined, choice: string | null): SoundWaveMiss | undefined {
  if (!item || choice === null || soundCorrect(item, choice) || !choicesOf(item).includes(choice)) return undefined;
  if (item.mode === 'observe') return choice === 'Nothing changes' ? 'said_no_change' : 'start_stop_swapped';
  if (item.mode === 'predict') {
    if (keyChoice(item) === 'Stays the same') return 'mixed_up_features';
    return choice === 'Stays the same' ? 'said_same' : 'opposite_direction';
  }
  if (item.mode === 'classify') {
    if (choice === SAME_WAVES) return 'said_same';
    const at = WAVE_LABELS.indexOf(choice);
    if (at === extreme(item, otherFeature(item.asked))) return 'read_other_feature';
    return keyChoice(item) === SAME_WAVES ? 'missed_same' : 'opposite_end';
  }
  const picked = applyChoices(item).find(c => c.label === choice)!.changes;
  if (item.changes.length === 2) {
    const loud = picked[0] !== item.changes[0], pitch = picked[1] !== item.changes[1];
    return loud && pitch ? 'both_misread' : loud ? 'loudness_misread' : 'pitch_misread';
  }
  return FEATURE_OF[picked[0]] === FEATURE_OF[item.changes[0]] ? 'opposite_change' : 'wrong_feature';
}

// ── The ask ──────────────────────────────────────────────────────────────────────────────

const cap = (s: string) => `${s.charAt(0).toUpperCase()}${s.slice(1)}`;

function observeSetup(item: ObserveItem): string {
  const m = MAKER_NAME[item.maker], past = PLAY[item.maker].past;
  switch (item.event) {
    case 'struck': return `The ${m} is still and quiet. It is ${past}, and it starts to shake.`;
    case 'held': return `The ${m} is shaking and making a sound. A hand holds it tight, and it stops shaking.`;
    case 'heard_start': return `The ${m} is quiet. Then you start to hear the ${m}.`;
    case 'heard_stop': return `You can hear the ${m}. Then its sound stops.`;
    case 'speaker_on': return 'Rice grains lie still on top of a drum. A loud speaker right next to the drum is switched on.';
    case 'speaker_off': return 'Rice grains bounce on top of a drum while a loud speaker right next to it plays. The speaker is switched off.';
    case 'fork_water': return 'A tuning fork is struck and is shaking. Its tip is dipped into a bowl of still water.';
  }
}
const OBSERVE_Q: Record<ObserveEvent, string> = {
  struck: 'What happens to the sound?', held: 'What happens to the sound?',
  heard_start: 'What does the {m} do?', heard_stop: 'What does the {m} do?',
  speaker_on: 'What do the rice grains do?', speaker_off: 'What do the rice grains do?', fork_water: 'What does the water do?',
};

/** One change in words, for predict. */
function predictChange(item: PredictItem): string {
  const m = MAKER_NAME[item.maker], { past } = PLAY[item.maker], c = item.change;
  if (c === 'farther') return `You walk far away from the ${m} while it is ${past} the same way.`;
  if (c === 'air_out') return `The ${m} is inside a glass jar and is ${past} the same way, while the air is pumped out of the jar.`;
  if (item.wording === 'shaking') {
    if (c === 'force_up') return `It is ${past} harder, so it shakes with bigger swings.`;
    if (c === 'force_down') return `It is ${past} more gently, so it shakes with smaller swings.`;
    return c === 'speed_up' ? 'Now it shakes back and forth faster.' : 'Now it shakes back and forth slower.';
  }
  if (c === 'force_up') return `It is ${past} harder.`;
  if (c === 'force_down') return `It is ${past} more gently.`;
  return c === 'speed_up' ? TIGHTEN[item.maker].up : TIGHTEN[item.maker].down;
}

const CLASSIFY_Q: Record<Feature, Record<'most' | 'least', [string, string]>> = {
  loudness: { most: ['louder', 'the loudest'], least: ['quieter', 'the quietest'] },
  pitch: { most: ['higher', 'the highest'], least: ['lower', 'the lowest'] },
};

export function askOf(item: SoundItem): string {
  const m = MAKER_NAME[item.maker];
  if (item.mode === 'observe') return `${observeSetup(item)} ${OBSERVE_Q[item.event].replace('{m}', m)}`;
  if (item.mode === 'predict') {
    return `A ${m} is ${PLAY[item.maker].past}, and its wave is drawn. ${predictChange(item)} What happens to the ${item.asked === 'loudness' ? 'loudness' : 'pitch'}?`;
  }
  if (item.mode === 'classify') {
    const [two, three] = CLASSIFY_Q[item.asked][item.ask];
    return item.waves.length === 2 ? `Here are the waves of two sounds. Which sound is ${two}?`
      : `Here are the waves of three sounds. Which sound is ${three}?`;
  }
  return item.changes.length === 2
    ? `A ${m} is ${PLAY[item.maker].past} (the Before wave). Then it is played again, with two things done differently (the After wave). What was done?`
    : `A ${m} is ${PLAY[item.maker].past} (the Before wave). Then it is played again, one way differently (the After wave). What was done?`;
}

// ── Item space ───────────────────────────────────────────────────────────────────────────

export type Rng = () => number;
/** A seeded generator, so a lesson without stored items still builds the same items everywhere. */
export function seededRng(seed: string): Rng {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a += 0x6d2b79f5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const shuffle = <T,>(xs: T[], rng: Rng): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

const ALL_MAKERS: Maker[] = ['drum', 'guitar_string', 'rubber_band', 'bell', 'tuning_fork'];
const LEVELS = [1, 2, 3, 4, 5];
const featuresFor = (focus: SoundFocus): Feature[] => (focus === 'loudness' ? ['loudness'] : focus === 'pitch' ? ['pitch'] : ['loudness', 'pitch']);

function observeCandidates(tier: SoundTier): ObserveItem[] {
  const events: ObserveEvent[] = tier === 'easy' ? ['struck', 'held'] : tier === 'medium' ? ['heard_start', 'heard_stop'] : ['speaker_on', 'speaker_off', 'fork_water'];
  return events.flatMap(event => (event === 'speaker_on' || event === 'speaker_off' ? ['drum' as Maker] : event === 'fork_water' ? ['tuning_fork' as Maker] : ALL_MAKERS)
    .map(maker => ({ id: '', mode: 'observe' as const, maker, event })));
}

function predictCandidates(tier: SoundTier, focus: SoundFocus): PredictItem[] {
  const out: PredictItem[] = [];
  const asks = featuresFor(focus);
  const changes: Change[] = tier === 'easy' ? ['force_up', 'force_down', 'speed_up', 'speed_down']
    : tier === 'medium' ? ['force_up', 'force_down', 'speed_up', 'speed_down', 'farther'] : ['force_up', 'force_down', 'speed_up', 'speed_down', 'farther', 'air_out'];
  for (const maker of ALL_MAKERS) for (const change of changes) for (const asked of (['loudness', 'pitch'] as Feature[])) {
    if (FEATURE_OF[change] === 'pitch' && !TUNABLE.includes(maker)) continue;
    if (change === 'air_out' && maker !== 'bell') continue;
    const affected = FEATURE_OF[change] === asked;
    // easy and medium ask the feature the change moves; hard also asks the one it leaves alone.
    if (!affected && tier !== 'hard') continue;
    if (!asks.includes(asked)) continue;
    for (const amp of [2, 3, 4]) for (const crests of [2, 3, 4]) {
      const before = { amp, crests };
      const item: PredictItem = { id: '', mode: 'predict', maker, before, change, asked, wording: tier === 'easy' ? 'shaking' : 'physical' };
      if (!validWave(afterWave(item), change === 'air_out')) continue;
      out.push(item);
    }
  }
  return out;
}

function classifyCandidates(tier: SoundTier, focus: SoundFocus): ClassifyItem[] {
  const out: ClassifyItem[] = [];
  for (const asked of featuresFor(focus)) for (const ask of (['most', 'least'] as const)) {
    const other = otherFeature(asked);
    const make = (lv: Array<[number, number]>): Wave[] => lv.map(([a, o]) => (asked === 'loudness' ? { amp: a, crests: o } : { amp: o, crests: a }));
    if (tier === 'easy') {
      for (const a1 of LEVELS) for (const a2 of LEVELS) for (const o of LEVELS) {
        if (Math.abs(a1 - a2) < 2) continue;
        out.push({ id: '', mode: 'classify', maker: 'drum', asked, ask, waves: make([[a1, o], [a2, o]]) });
      }
    } else if (tier === 'medium') {
      // Crossed: the wave that wins on the asked feature loses on the other one.
      for (const a1 of LEVELS) for (const a2 of LEVELS) for (const o1 of LEVELS) for (const o2 of LEVELS) {
        if (Math.abs(a1 - a2) < 1 || Math.abs(o1 - o2) < 2 || (a1 - a2) * (o1 - o2) >= 0) continue;
        out.push({ id: '', mode: 'classify', maker: 'drum', asked, ask, waves: make([[a1, o1], [a2, o2]]) });
      }
    } else {
      // The trap: the asked feature is the same, the other differs (key "They are the same").
      for (const a of LEVELS) for (const o1 of LEVELS) for (const o2 of LEVELS) {
        if (Math.abs(o1 - o2) < 2) continue;
        out.push({ id: '', mode: 'classify', maker: 'drum', asked, ask, waves: make([[a, o1], [a, o2]]) });
      }
      // Three waves: the key, the other feature's extreme, and the asked feature's opposite end, all different.
      for (const [lo, mid, hi] of [[1, 3, 5], [1, 2, 4], [2, 3, 5], [1, 3, 4], [2, 4, 5]]) for (const [oLo, oMid, oHi] of [[1, 3, 5], [2, 3, 4], [1, 2, 4], [2, 4, 5]]) {
        const key = ask === 'most' ? hi : lo, opp = ask === 'most' ? lo : hi;
        const oKey = ask === 'most' ? oHi : oLo;
        // middle-asked wave takes the other feature's extreme in the asked direction; the other two share the rest.
        const rest = [oLo, oMid, oHi].filter(x => x !== oKey);
        out.push({ id: '', mode: 'classify', maker: 'drum', asked, ask, waves: make([[key, rest[0]], [mid, oKey], [opp, rest[1]]]) });
        out.push({ id: '', mode: 'classify', maker: 'drum', asked, ask, waves: make([[key, rest[1]], [mid, oKey], [opp, rest[0]]]) });
      }
    }
  }
  return out;
}

function applyCandidates(tier: SoundTier, focus: SoundFocus): ApplyItem[] {
  const out: ApplyItem[] = [];
  const feats = featuresFor(focus);
  for (const maker of TUNABLE) for (const amp of [2, 3, 4]) for (const crests of [2, 3, 4]) {
    const before = { amp, crests };
    const sets: Change[][] = tier === 'hard'
      ? [['force_up', 'speed_up'], ['force_up', 'speed_down'], ['force_down', 'speed_up'], ['force_down', 'speed_down']]
      : (['force_up', 'force_down', 'speed_up', 'speed_down'] as Change[]).filter(c => feats.includes(FEATURE_OF[c])).map(c => [c]);
    for (const changes of sets) {
      const item: ApplyItem = { id: '', mode: 'apply', maker, before, changes, wording: tier === 'easy' ? 'shaking' : 'physical' };
      if (validWave(afterWave(item))) out.push(item);
    }
  }
  return out;
}

/** Shuffle the wave order of a classify item so the key is not always Sound A. */
function placeWaves(item: ClassifyItem, rng: Rng): ClassifyItem {
  return { ...item, waves: shuffle(item.waves, rng) };
}

/** The structural shape of an item, so a session spreads over makers, changes, asks and keys. */
function shapeKey(i: SoundItem): string {
  if (i.mode === 'observe') return i.event;
  if (i.mode === 'predict') return `${i.change}:${i.asked}`;
  if (i.mode === 'classify') return `${i.asked}:${i.ask}:${i.waves.length}:${keyChoice(i) === SAME_WAVES}`;
  return i.changes.join('+');
}

export const ITEM_COUNT: Record<SoundMode, [number, number]> = { observe: [4, 2], predict: [4, 2], classify: [4, 2], apply: [3, 2] };

function candidates(mode: SoundMode, tier: SoundTier, focus: SoundFocus): SoundItem[] {
  if (mode === 'observe') return observeCandidates(tier);
  if (mode === 'predict') return predictCandidates(tier, focus);
  if (mode === 'classify') return classifyCandidates(tier, focus);
  return applyCandidates(tier, focus);
}

/** The items of one mode at one tier: distinct shapes and makers first; hard predict and classify open on a "same" key. */
export function buildModeItems(mode: SoundMode, tier: SoundTier, focus: SoundFocus, count: number, rng: Rng): SoundItem[] {
  const pool = shuffle(candidates(mode, tier, focus), rng);
  const picked: SoundItem[] = [];
  const shapes = new Set<string>(), makers = new Set<string>();
  const sameKey = (i: SoundItem) => keyChoice(i) === 'Stays the same' || keyChoice(i) === SAME_WAVES;
  const defining = tier === 'hard' && (mode === 'predict' || mode === 'classify') ? pool.find(sameKey) : undefined;
  // At most half the items have a "same" key, so always answering it cannot pass the session.
  const sameCap = Math.max(1, Math.floor(count / 2));
  const take = (i: SoundItem) => { picked.push(i); shapes.add(shapeKey(i)); makers.add(i.maker); };
  const fits = (i: SoundItem) => !picked.includes(i) && (!sameKey(i) || picked.filter(sameKey).length < sameCap);
  if (defining) take(defining);
  for (const i of pool) { if (picked.length >= count) break; if (fits(i) && !shapes.has(shapeKey(i)) && !makers.has(i.maker)) take(i); }
  for (const i of pool) { if (picked.length >= count) break; if (fits(i) && !shapes.has(shapeKey(i))) take(i); }
  for (const i of pool) { if (picked.length >= count) break; if (fits(i) && !picked.some(p => JSON.stringify({ ...p, id: '' }) === JSON.stringify({ ...i, id: '' }))) take(i); }
  return picked.map(i => (i.mode === 'classify' ? placeWaves(i, rng) : i));
}

export function buildSoundItems(opts: { modes: SoundMode[]; tier: SoundTier; focus: SoundFocus; rng: Rng }): SoundItem[] {
  const out: SoundItem[] = [];
  for (const mode of opts.modes) out.push(...buildModeItems(mode, opts.tier, opts.focus, ITEM_COUNT[mode][opts.modes.length === 1 ? 0 : 1], opts.rng));
  return out.map((item, i) => ({ ...item, id: `${item.mode}-${i + 1}` }));
}

// ── Lesson data → items ──────────────────────────────────────────────────────────────────

export interface SoundItemsSource {
  title?: string;
  challengeTypes?: string[];
  difficulty?: string;
  supportTier?: string;
  soundFocus?: string;
  gradeLevel?: string;
  items?: SoundItem[];
  /** Legacy generations (before 2026-10-15): read only for the modes. */
  challenges?: Array<{ type?: string }>;
}

const FOCI: SoundFocus[] = ['vibration', 'loudness', 'pitch', 'both'];
export const resolveFocus = (d: SoundItemsSource): SoundFocus => (FOCI as string[]).includes(d.soundFocus ?? '') ? d.soundFocus as SoundFocus : 'both';
export const resolveTier = (d: SoundItemsSource): SoundTier => {
  const t = (d.difficulty ?? d.supportTier ?? '').toLowerCase();
  return t === 'easy' || t === 'hard' ? t : 'medium';
};
export const DEFAULT_MODES: Record<string, SoundMode[]> = { K: ['observe'], '1': ['observe', 'predict'], '2': ['predict', 'classify'], '3': ['classify', 'apply'] };

/** The modes a lesson asks: its pin, else the legacy challenges' types, else by grade. */
export function resolveSoundModes(d: SoundItemsSource): SoundMode[] {
  const asked = (d.challengeTypes ?? []).filter((m): m is SoundMode => (SOUND_MODES as string[]).includes(m));
  if (asked.length) return SOUND_MODES.filter(m => asked.includes(m));
  const legacy = (d.challenges ?? []).map(c => c?.type).filter((m): m is SoundMode => (SOUND_MODES as string[]).includes(m ?? ''));
  if (legacy.length) return SOUND_MODES.filter(m => legacy.includes(m));
  return DEFAULT_MODES[d.gradeLevel ?? '1'] ?? DEFAULT_MODES['1'];
}

const EVENTS: ObserveEvent[] = ['struck', 'held', 'heard_start', 'heard_stop', 'speaker_on', 'speaker_off', 'fork_water'];
const CHANGES: Change[] = ['force_up', 'force_down', 'speed_up', 'speed_down', 'farther', 'air_out'];
const FEATURES: Feature[] = ['loudness', 'pitch'];

/** False when a stored item is not one code could have built (its key would not be computable). */
export function validSoundItem(i: SoundItem | undefined): i is SoundItem {
  if (!i || typeof i.id !== 'string' || !ALL_MAKERS.includes(i.maker)) return false;
  if (i.mode === 'observe') return EVENTS.includes(i.event);
  if (i.mode === 'predict') {
    return validWave(i.before) && CHANGES.includes(i.change) && FEATURES.includes(i.asked) && (i.wording === 'shaking' || i.wording === 'physical')
      && validWave(afterWave(i), i.change === 'air_out') && (FEATURE_OF[i.change] !== 'pitch' || TUNABLE.includes(i.maker))
      && (i.change !== 'air_out' || i.maker === 'bell');
  }
  if (i.mode === 'classify') {
    return Array.isArray(i.waves) && (i.waves.length === 2 || i.waves.length === 3) && i.waves.every(w => validWave(w))
      && FEATURES.includes(i.asked) && (i.ask === 'most' || i.ask === 'least') && (i.waves.length === 2 || extreme(i, i.asked) !== null);
  }
  if (i.mode === 'apply') {
    if (!validWave(i.before) || !Array.isArray(i.changes) || !(i.changes.length === 1 || i.changes.length === 2) || !TUNABLE.includes(i.maker)) return false;
    if (!i.changes.every(c => ['force_up', 'force_down', 'speed_up', 'speed_down'].includes(c))) return false;
    if (i.changes.length === 2 && (FEATURE_OF[i.changes[0]] !== 'loudness' || FEATURE_OF[i.changes[1]] !== 'pitch')) return false;
    return validWave(afterWave(i));
  }
  return false;
}

/** Every item of the session: the stored, code-built items when valid, else built from the lesson's own fields. */
export function soundItems(d: SoundItemsSource): SoundItem[] {
  const stored = Array.isArray(d.items) ? d.items.filter(validSoundItem) : [];
  if (stored.length && stored.length === (d.items ?? []).length) return stored;
  return buildSoundItems({ modes: resolveSoundModes(d), tier: resolveTier(d), focus: resolveFocus(d), rng: seededRng(`${d.title ?? 'sound'}:${resolveFocus(d)}`) });
}

// ── Assignment, spoken answers ───────────────────────────────────────────────────────────

const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth'];
const SAY: Record<string, string> = {
  'A sound starts': '"a sound starts", "it makes a sound", "you hear it", "it rings"',
  'The sound stops': '"the sound stops", "it goes quiet", "no more sound", "it stops"',
  'Starts to shake': '"it starts to shake", "it shakes", "it vibrates", "they bounce", "they jump", "it wiggles", "ripples" or "splashes"',
  'Stops shaking': '"it stops shaking", "it stops vibrating", "it goes still", "they stop bouncing"',
  Louder: '"louder", "it gets louder", "more loud"',
  Quieter: '"quieter", "softer", "it gets quieter", "less loud"',
  Higher: '"higher", "a higher sound", "higher pitch", "squeakier"',
  Lower: '"lower", "deeper", "a lower sound", "lower pitch"',
  'Stays the same': '"it stays the same", "it does not change", "the same"',
  [SAME_WAVES]: '"they are the same", "both the same", "neither"',
};

/** The answer a spoken reply is judged against, with the ways a learner says it. */
export function soundExpectedAnswer(item: SoundItem): string {
  const key = keyChoice(item), choices = choicesOf(item), at = choices.indexOf(key);
  const place = `its place in the list ("the ${ORDINAL[at]} one")`;
  const others = choices.filter(c => c !== key).map(c => `"${c}"`).join(', ');
  const ways = SAY[key] ?? (item.mode === 'classify' ? `"${key}", "${key.slice(-1)}"` : `"${key}" or the same change in other words`);
  return `"${key}": ${ways}, or ${place}, counts. ${others} are wrong, and so is naming two or hedging between them.`;
}

const WHAT: Record<SoundWaveMiss, string> = {
  start_stop_swapped: 'has it the wrong way round (starting when it stops, or stopping when it starts)',
  said_no_change: 'says nothing changes',
  opposite_direction: 'moves the other way',
  said_same: 'says it stays the same',
  mixed_up_features: 'says it changes, when this change moves the other feature',
  read_other_feature: 'picks the wave that wins on the other feature (height for pitch, or crest spacing for loudness)',
  opposite_end: 'picks the wave at the other end',
  missed_same: 'picks one wave when they are the same on this feature',
  opposite_change: 'names the right kind of change the wrong way round',
  wrong_feature: 'names a change to the other feature',
  loudness_misread: 'gets the loudness part wrong',
  pitch_misread: 'gets the pitch part wrong',
  both_misread: 'gets both parts wrong',
};

/** A spoken item's known wrong answers, most specific first, with the tap's miss ids. */
export function soundSpokenMisses(item: SoundItem): KnownMiss[] {
  const groups = new Map<SoundWaveMiss, string[]>();
  for (const c of choicesOf(item)) {
    const m = soundMiss(item, c);
    if (m) groups.set(m, [...(groups.get(m) ?? []), c]);
  }
  const fact = `The right answer is "${keyChoice(item)}".`;
  return SOUND_MISSES[item.mode].filter(m => groups.has(m)).map(m => ({ id: m,
    pattern: `${fact} The learner's answer ${WHAT[m]}: ${groups.get(m)!.map(x => `"${x}"`).join(', ')}.`, examples: groups.get(m)! }));
}

const HOW = 'The learner answers by saying it, or tapping one choice and pressing Check Answer.';

export function workspaceAssignment(item: SoundItem): TeachingAssignment {
  const misses = soundSpokenMisses(item);
  return { id: item.id, task: `${askOf(item)} ${HOW}`, response: 'speech', acceptsGesture: true,
    expectedAnswer: soundExpectedAnswer(item), ...(misses.length ? { misses } : {}) };
}

// ── Scene ────────────────────────────────────────────────────────────────────────────────

export interface SoundView {
  choice: string | null;
  /** The item is credited and the change has been run on screen. */
  solved: boolean;
}

export const describeSoundWork = (item: SoundItem | undefined, view: Pick<SoundView, 'choice'>) =>
  item && view.choice ? `Chose "${view.choice}"` : 'Nothing chosen yet';

const OBSERVE_DRAWN: Record<ObserveEvent, string> = {
  struck: 'the {m}, drawn still, before it is played', held: 'the {m}, drawn shaking, before the hand holds it',
  heard_start: 'the {m}, drawn with no sound mark', heard_stop: 'the {m}, drawn with a sound mark beside it',
  speaker_on: 'a drum with rice grains on top and a speaker beside it, switched off', speaker_off: 'a drum with rice grains on top and a speaker beside it, playing',
  fork_water: 'a shaking tuning fork above a bowl of still water',
};

/** What is drawn and asked, never which choice is right, nor which wave is taller or more tightly packed. */
function shownFact(item: SoundItem): string {
  const m = MAKER_NAME[item.maker];
  if (item.mode === 'observe') return `A picture of ${OBSERVE_DRAWN[item.event].replace('{m}', m)}. Nothing moves or plays until the answer is credited.`;
  if (item.mode === 'predict') {
    return `The Before wave of the ${m}, and a Hear before button that plays that sound. The After panel shows "?": its wave `
      + 'and its sound appear only once the answer is credited.';
  }
  if (item.mode === 'classify') {
    return `${item.waves.length} waves drawn at one scale, labelled ${WAVE_LABELS.slice(0, item.waves.length).join(', ')} from the top. `
      + 'You are not told how tall each wave is or how close its crests are: reading that is the task. The sounds do not play until the answer is credited.';
  }
  return `The Before wave and the After wave of the ${m}, drawn at one scale, and a Hear before button. You are not told how the two waves differ: `
    + 'reading that is the task. The After sound plays only once the answer is credited.';
}

const CONSTRAINTS = 'The learner answers by saying it, or by tapping one choice and checking it; the activity judges the tap. '
  + 'Nothing is run or played for the answer until it is credited. You cannot tap, check, play or run anything for the learner.';

/** What the observe picture shows once the change has run. */
const OBSERVE_AFTER: Record<ObserveEvent, string> = {
  struck: 'the {m} is now drawn shaking, with sound marks beside it, and a tone plays.',
  heard_start: 'the {m} is now drawn shaking, with sound marks beside it, and a tone plays.',
  held: 'the {m} is now drawn still, with no sound marks.',
  heard_stop: 'the {m} is now drawn still, with no sound marks.',
  speaker_on: 'the speaker now has sound marks and the rice grains are drawn bouncing.',
  speaker_off: 'the speaker has no sound marks now and the rice grains are drawn lying still.',
  fork_water: 'the water now has rings of ripples around the fork tip (no splash is drawn).',
};

/** What the run shows once credited. */
function runFact(item: SoundItem): string {
  if (item.mode === 'observe') return `The change has run: ${OBSERVE_AFTER[item.event].replace('{m}', MAKER_NAME[item.maker])}`;
  if (item.mode === 'predict') return `The After wave is now drawn beside the Before wave, and Hear after plays it: ${keyChoice(item).toLowerCase()}.`;
  if (item.mode === 'classify') return 'Each wave now has a Hear button that plays its sound.';
  return 'Hear after now plays the After sound.';
}

export function workspaceScene(item: SoundItem, view: SoundView): WorkspaceScene {
  const facts: Record<string, string> = {
    kind: item.mode,
    question: askOf(item),
    choices: choicesOf(item).map((c, i) => `${i + 1}) ${c}`).join('  '),
    shown: shownFact(item),
  };
  if (view.solved) facts.run = runFact(item);
  facts.learnerWork = describeSoundWork(item, view);
  facts.constraints = CONSTRAINTS;
  return { objects: [], facts };
}

// ── The journey's learner (liveJourneySpec row, the dry sweep) ───────────────────────────

/** The journey's answers: the key, and the wrong choice that shows the mode's first-listed miss it can. */
export function soundHarnessAnswers(item: SoundItem): { correct: string; plainWrong: string } {
  const rank = SOUND_MISSES[item.mode];
  const wrong = choicesOf(item).filter(c => !soundCorrect(item, c))
    .sort((a, b) => rank.indexOf(soundMiss(item, a)!) - rank.indexOf(soundMiss(item, b)!));
  return { correct: keyChoice(item), plainWrong: wrong[0] ?? '' };
}

/** For the component: a wave level as drawn pixels and a tone. */
export const AMP_PX = [0, 10, 20, 32, 46, 60];
export const CREST_COUNT = [0, 2, 3, 4, 6, 8];
export const CREST_HZ = [0, 220, 300, 400, 530, 700];
export const capFirst = cap;
