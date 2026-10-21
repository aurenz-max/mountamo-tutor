/**
 * digital-skills-sim's boss (`components/live-activity/boss.ts`), bespoke because its modes mix a tapped picture, a
 * dragged picture and pressed keys, every one checked by the activity: the card is `digitalSkillsSim.card.ts`; this file
 * validates a lesson, lists its items, asks one, carries the lever set and plays the harness.
 */
import type { DigitalSkillsSimData } from './DigitalSkillsSim';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import type { DriverInput, JourneyContext } from '../../../components/live-activity/liveJourneySpec';
import {
  askOf, keyLabel, resolveSkillModes, skillHarnessAnswers, skillItems, validSkillItem, type Point, type SkillItem,
} from './digitalSkillsWorkspace';
import { SKILL_LEVERS, practiceParent, simplerItem } from './digitalSkillsLevers';
import { digitalSkillsSimCard, type SkillMiss } from './digitalSkillsSim.card';

/**
 * Reject a practice set a mode cannot be asked on: no title, a stored item code could not have built (every key is
 * computed from the item's pictures, boxes or letters, so nothing else is trusted), or a requested mode with no item.
 */
export function validateDigitalSkillsData(value: unknown): DigitalSkillsSimData {
  const d = value as DigitalSkillsSimData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated digital skills practice has invalid lesson content.');
  if (Array.isArray(d.items) && d.items.some(i => !validSkillItem(i))) throw new Error('A generated digital skills item is not one code can key.');
  const items = skillItems(d);
  if (new Set(items.map(i => i.id)).size !== items.length) throw new Error('Generated digital skills items repeat an id.');
  for (const mode of resolveSkillModes(d)) {
    if (!items.some(i => i.mode === mode)) throw new Error(`The digital-skills ${mode} mode has no item.`);
  }
  return d;
}

/** The session item, or the simpler practice item a simplify lever opened (`~simpler`), rebuilt from its parent. */
function currentItem(ctx: JourneyContext): SkillItem | undefined {
  const items = skillItems(ctx.data as DigitalSkillsSimData);
  const parent = practiceParent(String(ctx.itemId ?? ''));
  const full = items.find(i => i.id === (parent ?? ctx.itemId));
  return parent && full ? simplerItem(full) ?? undefined : full;
}

export const digitalSkillsSimBoss = defineBoss<DigitalSkillsSimData, SkillItem, SkillMiss>({
  card: digitalSkillsSimCard,
  validate: validateDigitalSkillsData,
  items: d => skillItems(d),
  ask: item => askOf(item),
  // A click, a drop or keys the activity checks: no key reaches the tutor.
  assignment: item => bossAssignment(item.id, askOf(item), null),
  levers: SKILL_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/core/DigitalSkillsSim.tsx',
    instanceId: 'digital-skills-sim',
    defaults: { grade: 'Grade 1', mode: 'click', topic: 'Using a mouse and keyboard on a farm' },
    mounted: '[data-pip-object="workspace"]',
    current: currentItem,
    // click is a press and release on the arena SVG at a picture's centre; drag a stroke from the picture's start to a
    // box's centre (both `draw` on `arena`, in viewBox units); type presses the keys ("Tap M"). The wrong click lands on
    // another picture, the wrong drop in another box, the wrong key far from the letter.
    play: (right, item): DriverInput[] => {
      const answers = skillHarnessAnswers(item), work = right ? answers.correct : answers.plainWrong;
      if (item.mode === 'type') return (work as string[]).map((k): DriverInput => ({ type: 'choose', label: keyLabel(k) }));
      return [{ type: 'draw', target: 'arena', strokes: [work as Point[]] }];
    },
  },
});
