/**
 * Drawer primitives as DeepDive sections. The menu is the catalog's drawer family, filtered by
 * its affordance facts (a pre-reader lesson gets only drawers that need no reading); the content
 * comes from the drawer's own registered generator, which checks its spec in code and throws
 * rather than ship a wrong number. DeepDive renders the block with the drawer's registered
 * component.
 */

import { DRAWER_CATALOG } from '../../manifest/catalog/drawers';
import { DRAWER_GENERATORS } from '../../drawers';
import type { DrawerBlockData } from '../../../primitives/visual-primitives/core/deep-dive/types';

export interface DrawerOption {
  id: string;
  description: string;
  constraints: string;
}

/** Drawers this audience can use, in catalog order. */
export function drawerMenu(preReader: boolean): DrawerOption[] {
  return DRAWER_CATALOG
    .filter((d) => DRAWER_GENERATORS[d.id] && (!preReader || d.affordances?.reader === 'none'))
    .map((d) => ({ id: d.id, description: d.description, constraints: d.constraints ?? '' }));
}

/** First sentence only, for the follow-up planner's shorter menu. */
export const drawerMenuLine = (d: DrawerOption) => `${d.id}: ${d.description.split(/(?<=\.)\s/)[0]}`;

/** Run the drawer's generator for this section. Throws when no spec passes the drawer's checks. */
export async function generateDrawerBlock(input: {
  drawerId: string;
  intent: string;
  topic: string;
  gradeLevel: string;
  label: string;
  tutoringBrief?: string;
  transitionCue?: string;
}): Promise<DrawerBlockData> {
  const generate = DRAWER_GENERATORS[input.drawerId];
  if (!generate) throw new Error(`unknown drawer ${input.drawerId}`);
  const spec = await generate({ topic: input.topic, gradeContext: input.gradeLevel, intent: input.intent, title: input.label });
  return {
    id: '', blockType: 'drawer', drawerId: input.drawerId, spec,
    label: input.label || ((spec as { title?: string }).title ?? input.drawerId),
    tutoringBrief: input.tutoringBrief, transitionCue: input.transitionCue,
  };
}
