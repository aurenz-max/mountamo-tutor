/** habitat-diorama's domain: the item gates, the ask, the key, the activity's miss and the spoken miss. */
import { describe, expect, it } from 'vitest';
import { askLeaks } from '../../../components/live-activity/spokenKey';
import type { HabitatChallenge, HabitatDioramaData, Relationship } from './HabitatDiorama';
import {
  answerKindFor, askFor, habitatKey, habitatMiss, habitatSpokenMisses, itemFromChallenge, itemsFromChallenges,
  predationDirectionOk, responseClassFor, type HabitatItem,
} from './habitatDioramaDomain';

const item = (extra: Partial<HabitatItem>) => ({ id: 'h', organismNames: {}, ...extra }) as HabitatItem;
const rel = (fromId: string, toId: string, type: Relationship['type'] = 'predation'): Relationship => ({ fromId, toId, type, description: '' });
// The heron eats the frog; it competes with the otter; the fox eats the heron; the lily is unconnected.
const web = [rel('heron', 'frog'), rel('heron', 'otter', 'competition'), rel('fox', 'heron')];
const connect = item({ kind: 'connect', fromId: 'heron', toId: 'frog', relationshipType: 'predation' });
const toLand = item({ kind: 'restore', restorationZone: 'ground' });
const toWater = item({ kind: 'restore', restorationZone: 'water' });
const toShore = item({ kind: 'restore', restorationZone: 'shoreline' });

it.each([
  [connect, { toId: 'frog' }, undefined], [connect, { toId: 'otter' }, 'other_kind_link'],
  [connect, { toId: 'fox' }, 'leads_to_start'], [connect, { toId: 'lily' }, 'unconnected'],
  [toLand, { zone: 'ground' }, undefined], [toLand, { zone: 'water' }, 'water_for_land'], [toLand, { zone: 'canopy' }, 'other_land_zone'],
  [toLand, { zone: 'shoreline' }, 'other_land_zone'], [toShore, { zone: 'water' }, 'water_for_land'],
  [toWater, { zone: 'shoreline' }, 'land_for_water'], [toWater, { zone: 'underground' }, 'land_for_water'],
] as const)('row %#', (it_, move, miss) => {
  expect(habitatMiss(it_, move, web)).toBe(miss);
});

// A spoken choice's known wrong answer (handoff 20 Part B): another choice on screen, never the answer.
it.each([
  [item({ kind: 'observe', answerKind: 'voice', answerText: 'Cattail', optionTexts: ['Cattail', 'Tadpole', 'Pond Snail'] }), ['other_choice'], ['Cattail']],
  [item({ kind: 'connect', answerKind: 'gesture', answerText: 'Frog', optionTexts: [] }), [], []],
] as const)('spoken row %#', (it_, ids, accepted) => {
  const misses = habitatSpokenMisses(it_);
  expect(misses.map(m => m.id)).toEqual(ids);
  const ok = accepted.map(a => a.toLowerCase());
  for (const m of misses) for (const e of m.examples ?? []) expect(ok).not.toContain(e.toLowerCase());
});

// ── The item gates (moved from the retired DI-script suite) ─────────────────

const organisms: HabitatDioramaData['organisms'] = [
  { id: 'oak', commonName: 'Oak Tree', role: 'producer', imagePrompt: 'oak', position: { x: '18%', y: '30%' }, description: 'Makes food from sunlight.', adaptations: ['broad leaves'] },
  { id: 'hare', commonName: 'Snowshoe Hare', role: 'primary-consumer', imagePrompt: 'hare', position: { x: '42%', y: '65%' }, description: 'Eats leaves.', adaptations: ['wide feet'] },
  { id: 'fox', commonName: 'Red Fox', role: 'secondary-consumer', imagePrompt: 'fox', position: { x: '68%', y: '58%' }, description: 'Hunts small animals.', adaptations: ['keen hearing'] },
  { id: 'fungus', commonName: 'Shelf Fungus', role: 'decomposer', imagePrompt: 'fungus', position: { x: '26%', y: '78%' }, description: 'Breaks down dead wood.', adaptations: ['digestive enzymes'] },
  { id: 'beaver', commonName: 'River Beaver', role: 'primary-consumer', imagePrompt: 'beaver', position: { x: '82%', y: '70%' }, description: 'Builds dams.', adaptations: ['flat tail'] },
];
const relationships: HabitatDioramaData['relationships'] = [
  { fromId: 'oak', toId: 'hare', type: 'predation', description: 'The hare eats oak leaves.' },
  { fromId: 'hare', toId: 'fox', type: 'predation', description: 'The fox hunts the hare.' },
  { fromId: 'fungus', toId: 'oak', type: 'symbiosis-commensalism', description: 'The fungus uses fallen oak wood.' },
  { fromId: 'oak', toId: 'beaver', type: 'predation', description: 'The beaver eats bark and twigs.' },
];
const challenges: HabitatChallenge[] = [
  { id: 'observe-1', type: 'observe', prompt: 'It captures sunlight and starts the food chain.', explanation: 'The oak makes food that supports consumers.', focusOrganismId: 'oak', optionOrganismIds: ['oak', 'hare', 'fox', 'fungus'] },
  { id: 'connect-1', type: 'connect', prompt: 'Complete the hare feeding relationship.', explanation: 'The fox gets energy by hunting the hare.', fromId: 'hare', toId: 'fox' },
  { id: 'predict-1', type: 'predict', prompt: 'Trace the first population response.', explanation: 'With fewer foxes hunting them, more hares survive.', disruptionEvent: 'The fox population becomes much smaller.', affectedOrganismId: 'hare', expectedTrend: 'increase', optionOrganismIds: ['hare', 'oak', 'fungus', 'beaver'] },
  { id: 'restore-1', type: 'restore', prompt: 'Return the decomposer to a viable layer.', explanation: 'Dead wood collects near the soil where the fungus can break it down.', restorationEntityId: 'fungus', restorationZone: 'ground' },
  { id: 'defend-1', type: 'defend', prompt: 'The beaver can change habitat for many other species', explanation: 'A dam redirects water and creates new wet areas.', evidenceChoices: [
    { id: 'dam', text: 'Its dam redirects flowing water into a pond.' },
    { id: 'fur', text: 'Its thick fur traps warm air near its skin.' },
    { id: 'teeth', text: 'Its orange front teeth keep growing.' },
  ], correctEvidenceId: 'dam' },
];
const habitat = { organisms, relationships };
const built = itemsFromChallenges(challenges, habitat).items;

describe('the item gates', () => {
  it('builds all five kinds; said only when the answer is a choice on screen; each item carries the lesson tier', () => {
    expect(built.map(i => i.kind)).toEqual(['observe', 'connect', 'predict', 'restore', 'defend']);
    expect(['observe', 'predict', 'defend'].map(k => answerKindFor(k as never))).toEqual(['voice', 'voice', 'voice']);
    expect(['connect', 'restore', 'build_habitat'].map(k => answerKindFor(k as never))).toEqual(['gesture', 'gesture', 'gesture']);
    expect(responseClassFor('observe')).toBe('closed_set_choice');
    expect(responseClassFor('connect')).toBe('manipulation');
    expect(built.every(i => i.supportTier === 'medium')).toBe(true);
    expect(itemsFromChallenges(challenges, { ...habitat, supportTier: 'easy' }).items[1].supportTier).toBe('easy');
  });

  it('a said item has a key the ask never says; a tapped or built one has none', () => {
    for (const i of built) {
      const key = habitatKey(i);
      if (i.answerKind === 'gesture') { expect(key).toBeNull(); continue; }
      expect(key!.answer).toBe(i.answerText);
      expect(askLeaks(askFor(i), key!)).toEqual([]);
    }
    expect(habitatKey(built[4])!.acceptRule).toContain('"evidence 1"');
  });

  it('drops leaked, broken, and duplicate-answer challenges instead of repairing them', () => {
    expect(itemFromChallenge({ ...challenges[0], prompt: 'The Oak Tree starts this food chain.' }, habitat)).toBeNull();
    expect(itemFromChallenge({ ...challenges[1], toId: 'beaver' }, habitat)).toBeNull();
    const duplicate = itemsFromChallenges([challenges[0], { ...challenges[0], id: 'observe-2' }], habitat);
    expect(duplicate.items).toHaveLength(1);
    expect(duplicate.dropped).toBe(1);
  });

  it('drops a said item whose ask says the answer\'s own word (repeating the ask would solve it)', () => {
    expect(itemFromChallenge({ ...challenges[0], prompt: 'It is the tallest tree in this forest.' }, habitat)).toBeNull();
    expect(itemFromChallenge({ ...challenges[2], disruptionEvent: 'Foxes hunt fewer hares this year.' }, habitat)).toBeNull();
    // A defend claim may share words with its card: those words are not accepted as a short form.
    const shared = itemFromChallenge({ ...challenges[4], prompt: 'The beaver dam changes the habitat.' }, habitat)!;
    expect(shared).not.toBeNull();
    expect(habitatKey(shared)!.alsoAccept).not.toContain('dam');
    expect(askLeaks(askFor(shared), habitatKey(shared)!)).toEqual([]);
  });

  it('speaks the pinned relationship direction, and drops an inverted predation edge', () => {
    const c = itemFromChallenge(challenges[1], habitat)!;
    expect(askFor(c)).toContain('Find Snowshoe Hare.');
    expect(askFor(c)).toContain('the living thing that eats it');
    const inverted = itemFromChallenge(
      { id: 'connect-bad', type: 'connect', prompt: 'Complete the oak feeding relationship.', explanation: 'The hare eats oak leaves.', fromId: 'hare', toId: 'oak' },
      { organisms, relationships: [...relationships, { fromId: 'hare', toId: 'oak', type: 'predation', description: 'The hare eats oak leaves.' }] },
    );
    expect(inverted).toBeNull();
    expect(predationDirectionOk(organisms[0], organisms[1])).toBe(true);
    expect(predationDirectionOk(organisms[1], organisms[0])).toBe(false);
    expect(predationDirectionOk(organisms[1], organisms[3])).toBe(false);
  });

  it('keys restore uniqueness on the organism, not the six-value zone', () => {
    const sameZone = itemsFromChallenges([challenges[3],
      { ...challenges[3], id: 'restore-2', restorationEntityId: 'beaver', explanation: 'The beaver works where land meets water.' }], habitat);
    expect(sameZone.items).toHaveLength(2);
    expect(itemsFromChallenges([challenges[3], { ...challenges[3], id: 'restore-3' }], habitat).items).toHaveLength(1);
  });

  it('asks a defend item in one frame and never doubles a full stop', () => {
    const defend = itemFromChallenge(challenges[4], habitat)!;
    expect(askFor(defend)).not.toContain('Which evidence best supports this claim');
    expect(askFor(defend)).not.toMatch(/[.?!]\s*\?/);
    expect(askFor(defend)).toContain('Say the evidence that fits.');
    const instructionShaped = itemFromChallenge({ ...challenges[4], id: 'defend-2', prompt: 'Evaluate the claim that the beaver reshapes this habitat.' }, habitat)!;
    expect(askFor(instructionShaped)).toContain('Evaluate the claim that the beaver reshapes this habitat. Say the evidence that fits.');
  });
});
