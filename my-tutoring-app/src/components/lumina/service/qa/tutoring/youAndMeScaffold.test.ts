import { describe, expect, it } from 'vitest';
import { getComponentById } from '../../manifest/catalog';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { auditScaffold, buildSourceIndex, buildScaffoldPromptPreview, collectTemplateVars } from './scaffoldAudit';
import { buildYouAndMeItems, youAndMePack, modelSentence } from '../../../primitives/visual-primitives/literacy/youAndMeScript';
import type { YouAndMeChallenge } from '../../../primitives/visual-primitives/literacy/YouAndMe';

const entry = getComponentById('you-and-me')!;
const index = buildSourceIndex();
const scene: YouAndMeChallenge = { id: 'one', sceneId: 'bag', type: 'describe_action',
  participants: [{ name: 'Mina', emoji: '👧' }, { name: 'Leo', emoji: '👦' }],
  actor: 0, speaker: 0, action: 'packed the bag', object: 'bag', objectEmoji: '🎒' };

describe('You & Me tutoring connection', () => {
  // You & Me runs on the teaching workspace (rollout B3): the live path sends the tutor no catalog tutoring
  // block (the adapter's `tutoring: null`), and the scripted pack no longer runs, so nothing traces it.
  it('the workspace sends the tutor no catalog tutoring block', () => {
    expect(LIVE_ADAPTERS['you-and-me']).toMatchObject({ tutoring: null, teachingOwner: 'tutor', bindsTeachingWorkspace: true });
    expect(auditScaffold(entry, index).dataBagKeys).toBeNull();
  });
  it('does not infer connection from an unconsumed script', () => {
    const files = new Map(index.files);
    files.delete('src/components/lumina/primitives/visual-primitives/literacy/YouAndMe.tsx');
    expect(auditScaffold(entry, { ...index, files }).dataBagKeys).toBeNull();
  });
  it('resolves all templates across speaker and mode transitions without giving a model', () => {
    const items = buildYouAndMeItems([
      scene, { ...scene, id: 'two', speaker: 1 },
      { ...scene, id: 'three', type: 'describe_independent_action' },
      { ...scene, id: 'four', type: 'describe_independent_action', speaker: 1 },
    ]);
    const pack = youAndMePack(items);
    items.forEach((item, turn) => {
      const bag = pack.contextFor(item);
      for (const key of Array.from(collectTemplateVars(entry.tutoring))) expect(bag[key]).toBeTruthy();
      expect(bag.currentTurn).toBe(String(turn + 1));
      expect(bag.totalTurns).toBe('4');
      expect(bag.speaker).toBe(item.participants[item.speaker].name);
      const preview = buildScaffoldPromptPreview('you-and-me', bag, entry.tutoring!);
      expect(preview).not.toMatch(/\{\{|not set|runtime:/);
      expect(preview).not.toContain(modelSentence(item));
      expect(bag.modeHint.includes('self word')).toBe(item.type === 'describe_independent_action');
      for (const line of Object.values(entry.tutoring!.scaffoldingLevels)) {
        const spoken = line.replace(/\{\{(\w+)\}\}/g, (_, key) => bag[key]);
        expect(spoken).not.toMatch(/\b(?:I|you|myself|yourself)\b/);
      }
    });
  });
});
