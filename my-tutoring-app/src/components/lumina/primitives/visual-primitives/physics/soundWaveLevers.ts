/**
 * The in-item levers on sound-wave-explorer, as one lever set (`bossLevers.ts`; `/add-support-tiers`, report
 * qa/eval-reports/sound-wave-explorer-levers-2026-10-15.md).
 * No real-learner evidence: the misses are what `soundMiss` observes; the failures behind them come from the catalog's
 * old commonStruggles (pitch and loudness confused, sound without vibration, sound in a vacuum, louder read as faster)
 * and the task itself. Every lever starts released; `config.difficulty` changes the items, not the levers.
 *
 * - `shake_card` (help; observe): a model outside the item. Forward items: hum with a hand on your throat (the shaking
 *   and the sound go together). Hard items: a loud sound makes something light shake (a window rattles when a truck
 *   goes past). It names neither the item's sound maker nor a choice.
 * - `change_card` (help; predict and apply with physical changes): what each change does to the shaking (swings
 *   farther, shakes faster), never a sound word (louder, higher, the same).
 * - `feature_card` (help; predict, classify, apply): the rule, with two small wave pictures: bigger shakes and a taller
 *   wave are a louder sound; faster shakes and crests packed closer are a higher sound. Names no wave and no choice.
 *   On a predict item with a physical change it is offered only once change_card is up.
 * - `crest_marks` (help; classify, apply): numbers the crests of every wave and draws a line at every wave's top, both
 *   features on every wave, so it does not point at the asked one.
 * - `plain_link` (simplify; observe medium and hard): a forward item (the maker is played and shakes, or is held
 *   still) the other way round from the full item, ungraded, then the full item back.
 * - `easier_change` (simplify; predict medium and hard): the same maker and question with a change to the asked
 *   feature named in shaking words, the other way from the full item's answer.
 * - `one_difference` (simplify; classify medium and hard): two waves that differ only in the asked feature, the key
 *   at a different label from the full item's.
 * - `one_change` (simplify; apply medium and hard): hard, only the loudness change of the two; medium, the same
 *   change kind in shaking words, the other way round.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { keyAnswers } from '../../../components/live-activity/spokenKey';
import { SOUND_MISSES } from './soundWaveExplorer.card';
import {
  afterWave, choicesOf, keyChoice, MAKER_NAME, soundKey, soundMiss,
  type ApplyItem, type Change, type Feature, type ObserveItem, type PredictItem, type SoundItem, type SoundWaveMiss,
} from './soundWaveWorkspace';

export const SHAKE_LEVER = 'shake_card';
export const CHANGE_LEVER = 'change_card';
export const FEATURE_LEVER = 'feature_card';
export const CREST_LEVER = 'crest_marks';
export const PLAIN_LINK_LEVER = 'plain_link';
export const EASIER_CHANGE_LEVER = 'easier_change';
export const ONE_DIFFERENCE_LEVER = 'one_difference';
export const ONE_CHANGE_LEVER = 'one_change';

const FORWARD = ['struck', 'held', 'heard_start', 'heard_stop'];

/** shake_card: the model outside the item. */
export function shakeLines(item: ObserveItem): string[] {
  return FORWARD.includes(item.event)
    ? ['Hum with your hand on your throat: you feel it shake while you hear the hum.', 'Stop humming: the shaking and the sound stop together.']
    : ['A sound is shaking passed along through the air.', 'When a strong sound reaches something light, it can make it shake too, like a window rattling when a big truck goes past.'];
}

const SHAKING: Record<Change, (m: string) => string> = {
  force_up: () => 'Played harder: it swings farther each time it shakes.',
  force_down: () => 'Played more gently: it swings less far each time it shakes.',
  speed_up: m => `Made tighter: the ${m} shakes back and forth faster.`,
  speed_down: m => `Made looser: the ${m} shakes back and forth more slowly.`,
  farther: () => 'Walking away: the shaking spreads out as it travels, so less of it reaches you.',
  air_out: () => 'Pumping the air out: sound is shaking passed along by the air, and there is less and less air to pass it on.',
};

/** change_card: what the item's change (predict) or each kind of change (apply) does to the shaking. */
export function changeLines(item: PredictItem | ApplyItem): string[] {
  const m = MAKER_NAME[item.maker];
  if (item.mode === 'predict') return [SHAKING[item.change](m)];
  return (['force_up', 'force_down', 'speed_up', 'speed_down'] as Change[]).map(c => SHAKING[c](m));
}

export const FEATURE_LINES = [
  'Loudness is how big the shakes are: bigger shakes draw a taller wave and make a louder sound.',
  'Pitch is how fast the shakes are: faster shakes pack the crests closer together and make a higher sound.',
];

/** The leak rule for shake_card and change_card: no sound word that could be an answer, no choice label. */
export function soundWordLeak(line: string, item: SoundItem): boolean {
  if (/\b(louder|quieter|softer|higher|lower|deeper|the same|loud|quiet|pitch|loudness)\b/i.test(line)) return true;
  return choicesOf(item).some(c => line.toLowerCase().includes(c.toLowerCase()));
}

// ── Simplify: practice items ─────────────────────────────────────────────────────────────

const PRACTICE = '~simpler';
export const isPractice = (item: Pick<SoundItem, 'id'>) => item.id.endsWith(PRACTICE);
export const practiceParent = (id: string) => (id.endsWith(PRACTICE) ? id.slice(0, -PRACTICE.length) : null);

const valid = (w: { amp: number; crests: number }) => w.amp >= 1 && w.amp <= 5 && w.crests >= 1 && w.crests <= 5;

/** The simpler item of the same mode, or null when the item is already the easy shape. Never the learner's own key. */
export function simplerItem(item: SoundItem): SoundItem | null {
  if (isPractice(item)) return null;
  const id = `${item.id}${PRACTICE}`;
  let practice: SoundItem | null = null;
  if (item.mode === 'observe') {
    if (item.event === 'struck' || item.event === 'held') return null;
    const starts = item.event === 'heard_start' || item.event === 'speaker_on' || item.event === 'fork_water';
    practice = { id, mode: 'observe', maker: item.maker, event: starts ? 'held' : 'struck' };
  } else if (item.mode === 'predict') {
    if (item.wording === 'shaking') return null;
    const asked: Feature = item.asked;
    const key = keyChoice(item);
    const up = key === 'Stays the same' ? true : !(key === 'Louder' || key === 'Higher');
    const change: Change = asked === 'loudness' ? (up ? 'force_up' : 'force_down') : (up ? 'speed_up' : 'speed_down');
    const maker = asked === 'pitch' && !['guitar_string', 'rubber_band', 'drum'].includes(item.maker) ? 'guitar_string' : item.maker;
    const before = { amp: 3, crests: 3 };
    practice = { id, mode: 'predict', maker, before, change, asked, wording: 'shaking' };
  } else if (item.mode === 'classify') {
    const sameOther = item.waves.length === 2 && item.waves[0][otherKey(item.asked)] === item.waves[1][otherKey(item.asked)];
    if (sameOther) return null;
    const fullKey = keyChoice(item);
    const keyAt = fullKey === 'Sound A' ? 1 : 0;
    const winner = item.ask === 'most' ? 4 : 2, loser = item.ask === 'most' ? 2 : 4;
    const wave = (a: number) => (item.asked === 'loudness' ? { amp: a, crests: 3 } : { amp: 3, crests: a });
    const waves = keyAt === 0 ? [wave(winner), wave(loser)] : [wave(loser), wave(winner)];
    practice = { id, mode: 'classify', maker: item.maker, asked: item.asked, ask: item.ask, waves };
  } else {
    if (item.wording === 'shaking') return null;
    if (item.changes.length === 2) {
      practice = { id, mode: 'apply', maker: item.maker, before: item.before, changes: [item.changes[0]], wording: 'physical' };
    } else {
      const flipped: Change = ({ force_up: 'force_down', force_down: 'force_up', speed_up: 'speed_down', speed_down: 'speed_up' } as Record<string, Change>)[item.changes[0]];
      const before = { amp: 3, crests: 3 };
      practice = { id, mode: 'apply', maker: item.maker, before, changes: [flipped], wording: 'shaking' };
    }
  }
  if (!practice) return null;
  if (practice.mode === 'predict' || practice.mode === 'apply') {
    const w = afterWave(practice);
    if (!valid(w) || !valid(practice.before)) return null;
  }
  return keyChoice(practice) !== keyChoice(item) ? practice : null;
}
const otherKey = (f: Feature): 'amp' | 'crests' => (f === 'loudness' ? 'crests' : 'amp');

// ── The lever set ────────────────────────────────────────────────────────────────────────

/** What the levers read beside the item: the levers already pulled on it (feature_card waits for change_card). */
export interface SoundLeverContext { pulled: readonly string[] }

const physicalPredict = (item: SoundItem) => item.mode === 'predict' && item.wording === 'physical';
const PRACTICE_NOTE = 'It is not graded; this item comes back after it.';
const simplerSpec = (id: string, mode: SoundItem['mode'], does: (item: SoundItem) => string) => ({
  id, type: 'easier' as const, modes: [mode], answers: 'all' as const,
  when: mode === 'observe' ? 'The learner cannot work it out the way round this item asks.' : 'The learner cannot do this item even with the cards.',
  does: (item: SoundItem) => `Opens a simpler item first: ${does(item)} ${PRACTICE_NOTE}`,
  content: (item: SoundItem) => simplerItem(item),
});

export const SOUND_LEVERS = leverSet<SoundItem, SoundLeverContext>({
  modeOf: item => item.mode,
  missesOf: mode => SOUND_MISSES[mode as SoundItem['mode']] ?? [],
  // No card names the key or a way of saying it.
  answersOf: item => keyAnswers(soundKey(item)),
  specs: [
    { id: SHAKE_LEVER, type: 'clue', modes: ['observe'], answers: 'all',
      when: 'The learner does not connect the shaking and the sound.',
      does: item => (FORWARD.includes((item as ObserveItem).event)
        ? 'Shows a card with a picture of a child humming with a hand on the throat: the throat shakes while the hum sounds, and both stop together. It is not about this item\'s sound maker.'
        : 'Shows a card with a picture of a window rattling as a loud truck goes past: a strong sound can make something light shake. It is not about this item\'s objects.'),
      content: item => (item.mode === 'observe' ? shakeLines(item) : null),
      fact: (lines: string[]) => `A card: ${lines.join(' ')}` },
    { id: CHANGE_LEVER, type: 'clue', modes: ['predict', 'apply'], answers: 'all',
      when: 'The learner cannot tell what the change does to the shaking.',
      does: item => (item.mode === 'predict'
        ? 'Shows a card saying what this change does to the shaking (it swings farther, it shakes faster). It names no sound word.'
        : 'Shows a card saying what each kind of change does to the shaking. It names no sound word and no wave.'),
      // Only where the change is named physically: in shaking words the ask already says it.
      content: item => ((item.mode === 'predict' || item.mode === 'apply') && item.wording === 'physical' ? changeLines(item) : null),
      fact: (lines: string[]) => `A card: ${lines.join(' ')}` },
    { id: FEATURE_LEVER, type: 'custom', carrier: 'both', modes: ['predict', 'classify', 'apply'], answers: 'all',
      why: 'It states the general rule linking each wave feature to a sound word, so it names "louder" and "higher" by '
        + 'design; the clue and meaning leak check would drop it on every item keyed by one of those words.',
      when: item => (item.mode === 'predict'
        ? 'The learner knows what the change does to the shaking but not what that does to the sound, or mixes up loudness and pitch.'
        : 'The learner mixes up loudness and pitch, or does not know what part of the wave shows each.'),
      does: 'Shows a card with two small waves: bigger shakes draw a taller wave and are louder; faster shakes pack the crests closer and are higher. It names no wave and no choice of this item.',
      // A physical predict item goes shaking first, then sound: offered once change_card is up, so a reply never has
      // to state what the change does to the shaking to use it (replay r3, 10-15).
      offer: (item, { pulled }) => !physicalPredict(item) || pulled.includes(CHANGE_LEVER),
      fact: `A card with two small waves: ${FEATURE_LINES.join(' ')} Read it whole or not at all: never only the half `
        + 'about the asked feature, never a question about that half ("which wave is taller?" on a loudness question), '
        + 'and never the step it leaves ("so plucking harder makes it louder"); ask what it tells them.' },
    { id: CREST_LEVER, type: 'marks', modes: ['classify', 'apply'], answers: 'all',
      when: 'The learner cannot compare the waves by eye.',
      does: 'Numbers the crests of every wave and draws a line at every wave\'s top, on every wave at once.',
      fact: 'Every wave now has its crests numbered and a line at its top (you are not told the counts). The marks show '
        + 'height and spacing on every wave: never ask about only the one the question needs.' },
    simplerSpec(PLAIN_LINK_LEVER, 'observe', item => {
      const s = simplerItem(item) as ObserveItem | null;
      return `the ${MAKER_NAME[(s ?? item).maker]} is ${s?.event === 'struck' ? 'played and starts to shake' : 'held still'}, `
        + 'and the learner says what happens to the sound.';
    }),
    simplerSpec(EASIER_CHANGE_LEVER, 'predict', () => 'the same kind of question with the change named in shaking words.'),
    simplerSpec(ONE_DIFFERENCE_LEVER, 'classify', () => 'two waves that differ in only one way.'),
    simplerSpec(ONE_CHANGE_LEVER, 'apply', item => ((item as ApplyItem).changes.length === 2
      ? 'the same sound maker with only one thing done differently.'
      : 'the same sound maker with the changes named in shaking words.')),
  ],
});

/** For tests: every miss this item's choices can show. */
export const possibleMisses = (item: SoundItem): SoundWaveMiss[] =>
  Array.from(new Set(choicesOf(item).map(c => soundMiss(item, c)).filter((m): m is SoundWaveMiss => !!m)));
