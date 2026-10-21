/**
 * story-map's boss (`components/live-activity/boss.ts`), bespoke because every step is a board or a tap the activity
 * checks: the card is `storyMap.card.ts`; this file validates a lesson, lists its steps, asks one, carries the lever
 * set and plays the harness.
 */
import type { StoryMapData } from './StoryMap';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { bossAssignment, defineBoss, hasText } from '../../../components/live-activity/boss';
import { storyMapCard, type StoryMapMiss } from './storyMap.card';
import { STORY_MAP_LEVERS, practiceItem, practicePhase } from './storyMapLevers';
import {
  CONFLICT_LABELS, arcLabels, eventBank, settingChoices, storyMapAsk, storyMapItems, type StoryMapItem,
} from './storyMapWorkspace';

const STRUCTURES = ['bme', 'story-mountain', 'plot-diagram', 'heros-journey'];

/**
 * Reject a story map whose steps cannot be answered: a story, at least one named character and a setting to pick,
 * two or more events each in a part the structure draws.
 */
export function validateStoryMapData(value: unknown): StoryMapData {
  const d = value as StoryMapData;
  if (!d || !hasText(d.title) || !STRUCTURES.includes(d.structureType) || !d.passage || !hasText(d.passage.text)
      || !d.elements || !Array.isArray(d.elements.characters) || !d.elements.characters.length
      || d.elements.characters.some(c => !c || !hasText(c.name))
      || new Set(d.elements.characters.map(c => c.name)).size !== d.elements.characters.length
      || !d.elements.setting || !hasText(d.elements.setting.place) || !Array.isArray(d.events) || d.events.length < 2
      || new Set(d.events.map(e => e?.id)).size !== d.events.length)
    throw new Error('Generated story map has invalid lesson content.');
  const parts = new Set(arcLabels(d).map(z => z.key));
  if (d.events.some(e => !hasText(e.id) || !hasText(e.text) || !parts.has(e.arcPosition)))
    throw new Error(`A story-map ${d.structureType} event sits in a part the arc does not draw.`);
  return d;
}

const check: DriverInput = { type: 'check' };

export const storyMapBoss = defineBoss<StoryMapData, StoryMapItem, StoryMapMiss>({
  card: storyMapCard,
  validate: validateStoryMapData,
  items: storyMapItems,
  ask: storyMapAsk,
  // Every step is a board or a tap the activity checks: no key reaches the tutor.
  assignment: item => bossAssignment(item.id, storyMapAsk(item), null),
  levers: STORY_MAP_LEVERS,
  stepOf: item => item.phase,
  drive: {
    component: 'primitives/visual-primitives/literacy/StoryMap.tsx',
    instanceId: 'storymap',
    defaults: { grade: 'Grade 2', mode: 'story_mountain', topic: 'A lost puppy finds its way home' },
    mounted: '[data-pip-object="workspace"]',
    // The session step, or the practice story a simplify lever opened (`<step>~simpler`), rebuilt from the session's.
    current: ctx => {
      const data = ctx.data as StoryMapData;
      const id = String(ctx.itemId ?? ''), phase = practicePhase(id);
      const steps = storyMapItems(data);
      if (!phase) return steps.find(i => i.id === id);
      const parent = steps.find(i => i.id === phase);
      return parent ? practiceItem(parent, data) ?? undefined : undefined;
    },
    // Each step through its real controls. identify: tap every character and the setting, then Check; a wrong one
    // leaves out a character (`missed_character`), or with one character picks another setting. sequence: tap each
    // card, then its part of the arc, then Check; a wrong one puts the first event in the last part. analyze: tap the
    // conflict, then Check; a wrong one crosses inside and outside (`inside_outside`).
    play: (right, item, ctx) => {
      const d = item.story ?? (ctx.data as StoryMapData);
      if (item.phase === 'identify') {
        const names = d.elements.characters.map(c => c.name);
        const setting = settingChoices(d);
        const good = setting.find(s => s.isCorrect)!, other = setting.find(s => !s.isCorrect)!;
        const picked = !right && names.length > 1 ? names.slice(1) : names;
        const where = !right && names.length === 1 ? other : good;
        return [...picked.map((label): DriverInput => ({ type: 'choose', label })), { type: 'choose', label: where.text }, check];
      }
      if (item.phase === 'sequence') {
        const parts = arcLabels(d).map(z => z.key);
        const first = [...d.events].sort((a, b) => a.order - b.order)[0];
        return [...eventBank(d).flatMap((e): DriverInput[] => [{ type: 'choose', label: e.text },
          { type: 'touch', target: `zone-${!right && e.id === first.id ? parts[parts.length - 1] : e.arcPosition}` }]), check];
      }
      const type = d.elements.conflict?.type;
      if (!type) throw new Error('story-map analyze: the story has no conflict');
      // A practice story prints three choices; the crossed one (inside for outside) is always among them.
      const pick = right ? type : type === 'person-vs-self' ? 'person-vs-nature' : 'person-vs-self';
      return [{ type: 'choose', label: CONFLICT_LABELS[pick] }, check];
    },
    // The replay's word check. identify's key is a character's name, which the story itself says, so reading the
    // story (allowed, required at K-1) reads as the key: identify's replies are read by hand. sequence's touches
    // name no word. analyze: the conflict's printed label, on the session story only.
    replayKeys: ctx => {
      const type = (ctx.data as StoryMapData).elements?.conflict?.type;
      return ctx.itemId === 'analyze' && type ? [CONFLICT_LABELS[type]] : [];
    },
  },
});
