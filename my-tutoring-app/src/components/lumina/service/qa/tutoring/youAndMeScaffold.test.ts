import { describe, expect, it } from 'vitest';
import { getComponentById } from '../../manifest/catalog';
import { auditScaffold, buildSourceIndex, buildScaffoldPromptPreview, collectTemplateVars } from './scaffoldAudit';
import { buildYouAndMeItems, youAndMePack, modelSentence } from '../../../primitives/visual-primitives/literacy/youAndMeScript';
import type { YouAndMeChallenge } from '../../../primitives/visual-primitives/literacy/YouAndMe';

const entry = getComponentById('you-and-me')!;
const index = buildSourceIndex();
const scene: YouAndMeChallenge = { id: 'one', sceneId: 'bag', type: 'describe_action',
  participants: [{ name: 'Mina', emoji: '👧' }, { name: 'Leo', emoji: '👦' }],
  actor: 0, speaker: 0, action: 'packed the bag', object: 'bag', objectEmoji: '🎒' };

describe('You & Me tutoring connection', () => {
  it('traces the real pack through the runner and finds all silent moments', () => {
    const result = auditScaffold(entry, index);
    expect(result.status).toBe('pass');
    expect(result.findings).toEqual([]);
    expect(result.dataBagKeys).toEqual(expect.arrayContaining(entry.tutoring!.contextKeys!));
    expect(result.sendTextTags).toEqual(expect.arrayContaining(['YOU_AND_ME_ITEM', 'YOU_AND_ME_HEAR', 'YOU_AND_ME_MOVE_ON', 'YOU_AND_ME_COMPLETE']));
  });
  it('does not infer connection from an unconsumed script', () => {
    const files = new Map(index.files);
    files.delete('src/components/lumina/primitives/visual-primitives/literacy/YouAndMe.tsx');
    expect(auditScaffold(entry, { ...index, files }).dataBagKeys).toBeNull();
  });
  it('detects a missing context key and a non-silent shared transport', () => {
    const badEntry = { ...entry, tutoring: { ...entry.tutoring!, contextKeys: ['missingRole'] } };
    expect(auditScaffold(badEntry, index).findings).toContainEqual(expect.objectContaining({ check: 'context-key-unresolvable', severity: 'HIGH' }));
    const files = new Map(index.files);
    const loop = 'src/components/lumina/hooks/useJudgedSpeechLoop.ts';
    files.set(loop, files.get(loop)!.replaceAll('silent: true', 'silent: false'));
    expect(auditScaffold(entry, { ...index, files }).findings).toContainEqual(expect.objectContaining({ check: 'tagged-sendtext-not-silent', severity: 'HIGH' }));
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
