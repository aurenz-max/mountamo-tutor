/**
 * you-and-me's levers (`/add-support-tiers`, handoff 22 L4): offered only where the tier withdrew the aid, never
 * naming a pronoun, and every catalog miss answered by some lever on a hard item.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { LITERACY_CATALOG } from '../../../service/manifest/catalog/literacy';
import type { YouAndMeChallenge } from './YouAndMe';
import { ACTOR_LEVER, SPEAKER_LEVER, aidsOnScreen, leverTextLeak, leversOnScreen, youAndMeLevers } from './youAndMeLevers';

const saved: YouAndMeChallenge[] = JSON.parse(readFileSync(join(__dirname,
  '../../../components/live-activity/runtime/testing/w1-payloads/you-and-me.describe_action.json'), 'utf8')).data.challenges;
const tiered = (supportTier: 'easy' | 'medium' | 'hard', type: YouAndMeChallenge['type'] = 'describe_action') =>
  saved.map(item => ({ ...item, type, supportTier }));

describe('you-and-me levers', () => {
  it('the tier is the starting position: only withdrawn aids are levers; an untiered payload keeps both aids', () => {
    expect(youAndMeLevers(saved[0], [])).toEqual([]);
    expect(youAndMeLevers(tiered('easy')[0], [])).toEqual([]);
    expect(youAndMeLevers(tiered('medium')[0], []).map(l => l.id)).toEqual([ACTOR_LEVER]);
    expect(youAndMeLevers(tiered('hard')[0], []).map(l => l.id)).toEqual([SPEAKER_LEVER, ACTOR_LEVER]);
    expect(aidsOnScreen(tiered('hard')[0], [ACTOR_LEVER])).toEqual({ speaker: false, actor: true });
  });

  it.each(['describe_action', 'describe_independent_action'] as const)('%s: no lever text or scene fact names a pronoun', type => {
    for (const item of tiered('hard', type)) {
      const levers = youAndMeLevers(item, []);
      for (const l of levers) {
        expect(leverTextLeak(`${l.when} ${l.does}`), l.id).toBe(false);
        expect(l.carrier).toBe('shown');
      }
      expect(leverTextLeak(leversOnScreen(item, [SPEAKER_LEVER, ACTOR_LEVER])!)).toBe(false);
    }
    expect(leverTextLeak('You washed it')).toBe(true);
  });

  it('every catalog miss is answered on a hard item; a named miss picks its lever', () => {
    const entry = LITERACY_CATALOG.find(x => x.id === 'you-and-me')!.teachingWorkspace!;
    expect(entry.levers).toBe(true);
    const levers = youAndMeLevers(tiered('hard')[0], []);
    for (const mode of ['describe_action', 'describe_independent_action'])
      for (const miss of entry.misses![mode]) expect(levers.some(l => l.answers?.includes(miss)), miss).toBe(true);
    expect(nextLever(levers, 'swapped_pronoun')).toBe(ACTOR_LEVER);
    expect(nextLever(levers, 'said_name')).toBe(SPEAKER_LEVER);
    expect(nextLever(levers, 'said_he_she')).toBe(SPEAKER_LEVER);
  });
});
