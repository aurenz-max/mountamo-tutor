/**
 * sound-wave-explorer's boss, on the spoken preset (`components/live-activity/boss.ts`): every item is one closed choice
 * the learner says (the tutor judges the words against the key) or taps and checks (the activity judges the tap), a
 * SAY_OR_SHOW card. The card is `soundWaveExplorer.card.ts`; this file holds the content check, the items, the ask and
 * key, the levers and the harness play.
 */
import type { SoundWaveExplorerData } from './SoundWaveExplorer';
import { spokenBoss } from '../../../components/live-activity/boss';
import { soundWaveExplorerCard } from './soundWaveExplorer.card';
import { practiceParent, simplerItem, SOUND_LEVERS } from './soundWaveLevers';
import {
  askOf, resolveSoundModes, soundAskGiven, soundHarnessAnswers, soundItems, soundKey, soundSpokenMisses, validSoundItem,
  type SoundItem, type SoundWaveMiss,
} from './soundWaveWorkspace';

/**
 * Reject a sound lab a mode cannot be asked on: no title, a stored item code could not have built (its key is computed
 * from the sound maker, the waves and the change, so nothing else is trusted), or a requested mode with no item.
 */
export function validateSoundWaveData(value: unknown): SoundWaveExplorerData {
  const d = value as SoundWaveExplorerData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated sound lab has invalid lesson content.');
  if (Array.isArray(d.items) && d.items.some(i => !validSoundItem(i))) throw new Error('A generated sound-wave item is not one code can key.');
  const items = soundItems(d);
  if (new Set(items.map(i => i.id)).size !== items.length) throw new Error('Generated sound-wave items repeat an id.');
  for (const mode of resolveSoundModes(d)) {
    if (!items.some(i => i.mode === mode)) throw new Error(`The sound-wave ${mode} mode has no item.`);
  }
  return d;
}

export const soundWaveExplorerBoss = spokenBoss<SoundWaveExplorerData, SoundItem, SoundWaveMiss>({
  card: soundWaveExplorerCard,
  validate: validateSoundWaveData,
  items: soundItems,
  levers: SOUND_LEVERS,
  speech: {
    ask: askOf,
    key: soundKey,
    given: soundAskGiven,
    misses: soundSpokenMisses,
    say: soundHarnessAnswers,
    modeOf: item => item.mode,
  },
  drive: {
    component: 'primitives/visual-primitives/physics/SoundWaveExplorer.tsx',
    instanceId: 'sound-wave-explorer',
    defaults: { grade: 'Grade 2', mode: 'predict', topic: 'Sound: vibrations, loudness and pitch' },
    mounted: '[data-pip-object="workspace"]',
    // The session item, or the simpler practice item (`~simpler`) rebuilt from its parent with the same builder.
    current: ctx => {
      const items = soundItems(ctx.data as SoundWaveExplorerData);
      const parent = practiceParent(ctx.itemId ?? '');
      const full = items.find(i => i.id === (parent ?? ctx.itemId));
      return parent && full ? simplerItem(full) ?? undefined : full;
    },
  },
});
