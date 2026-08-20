import { describe, expect, it } from 'vitest';
import { checkDiCatalogEntry, checkPackGates } from '../../../../hooks/judgedScriptContract.testkit';
import { spokenSpansOf } from '../../../../hooks/judgedScriptContract';
import { BIOLOGY_CATALOG } from '../../../../service/manifest/catalog/biology';
import { buildDiDrivePlan } from '../../../../service/qa/di/diDrivePlan';
import type { HabitatChallenge, HabitatDioramaData } from '../HabitatDiorama';
import {
  answerKindFor,
  askFor,
  gestureVerdictCue,
  habitatDioramaPackBase,
  itemCue,
  itemFromChallenge,
  itemsFromChallenges,
  pronounceCue,
  responseClassFor,
} from '../habitatDioramaScript';

const organisms: HabitatDioramaData['organisms'] = [
  { id: 'oak', commonName: 'Oak Tree', role: 'producer', imagePrompt: 'oak', position: { x: '18%', y: '30%' }, description: 'Makes food from sunlight.', adaptations: ['broad leaves'] },
  { id: 'hare', commonName: 'Snowshoe Hare', role: 'primary-consumer', imagePrompt: 'hare', position: { x: '42%', y: '65%' }, description: 'Eats leaves.', adaptations: ['wide feet'] },
  { id: 'fox', commonName: 'Red Fox', role: 'secondary-consumer', imagePrompt: 'fox', position: { x: '68%', y: '58%' }, description: 'Hunts small animals.', adaptations: ['keen hearing'] },
  { id: 'fungus', commonName: 'Shelf Fungus', role: 'decomposer', imagePrompt: 'fungus', position: { x: '26%', y: '78%' }, description: 'Breaks down dead wood.', adaptations: ['digestive enzymes'] },
  { id: 'beaver', commonName: 'River Beaver', role: 'primary-consumer', imagePrompt: 'beaver', position: { x: '82%', y: '70%' }, description: 'Builds dams.', adaptations: ['flat tail'] },
];

const relationships: HabitatDioramaData['relationships'] = [
  { fromId: 'hare', toId: 'oak', type: 'predation', description: 'The hare eats oak leaves.' },
  { fromId: 'fox', toId: 'hare', type: 'predation', description: 'The fox hunts the hare.' },
  { fromId: 'fungus', toId: 'oak', type: 'symbiosis-commensalism', description: 'The fungus uses fallen oak wood.' },
  { fromId: 'beaver', toId: 'oak', type: 'predation', description: 'The beaver eats bark and twigs.' },
];

const challenges: HabitatChallenge[] = [
  { id: 'observe-1', type: 'observe', prompt: 'It captures sunlight and starts the food chain.', explanation: 'The oak makes food that supports consumers.', focusOrganismId: 'oak', optionOrganismIds: ['oak', 'hare', 'fox', 'fungus'] },
  { id: 'connect-1', type: 'connect', prompt: 'Complete the fox feeding relationship.', explanation: 'The fox gets energy by hunting the hare.', fromId: 'fox', toId: 'hare' },
  { id: 'predict-1', type: 'predict', prompt: 'Trace the first population response.', explanation: 'With fewer foxes hunting them, more hares survive.', disruptionEvent: 'The fox population becomes much smaller.', affectedOrganismId: 'hare', expectedTrend: 'increase', optionOrganismIds: ['hare', 'oak', 'fungus', 'beaver'] },
  { id: 'restore-1', type: 'restore', prompt: 'Return the decomposer to a viable layer.', explanation: 'Dead wood collects near the soil where the fungus can break it down.', restorationEntityId: 'fungus', restorationZone: 'ground' },
  { id: 'defend-1', type: 'defend', prompt: 'The beaver can change habitat for many other species', explanation: 'A dam redirects water and creates new wet areas.', evidenceChoices: [
    { id: 'dam', text: 'Its dam redirects flowing water into a pond.' },
    { id: 'fur', text: 'Its thick fur traps warm air near its skin.' },
    { id: 'teeth', text: 'Its orange front teeth keep growing.' },
  ], correctEvidenceId: 'dam' },
];

const built = itemsFromChallenges(challenges, { organisms, relationships }).items;
const pack = habitatDioramaPackBase(built);

describe('habitat-diorama DI contract', () => {
  it('builds all five modes and passes the shared pack and catalog gates', () => {
    expect(built).toHaveLength(5);
    expect(checkPackGates(pack)).toEqual([]);
    const entry = BIOLOGY_CATALOG.find((candidate) => candidate.id === 'habitat-diorama')!;
    expect(checkDiCatalogEntry(entry, pack, built[0])).toEqual([]);
  });

  it('uses speech only when the answer material is a visible named choice', () => {
    expect(answerKindFor('observe')).toBe('voice');
    expect(answerKindFor('predict')).toBe('voice');
    expect(answerKindFor('defend')).toBe('voice');
    expect(answerKindFor('connect')).toBe('gesture');
    expect(answerKindFor('restore')).toBe('gesture');
    expect(responseClassFor('observe')).toBe('closed_set_choice');
    expect(responseClassFor('connect')).toBe('manipulation');
  });

  it('keeps spoken keys out of the ask and tap-to-hear cue', () => {
    for (const item of built.filter((candidate) => candidate.answerKind === 'voice')) {
      expect(askFor(item).toLowerCase()).not.toContain(item.answerText.toLowerCase());
      expect(pronounceCue(item).toLowerCase()).not.toContain(item.answerText.toLowerCase());
    }
  });

  it('uses terminal sentinel verdicts for spoken and gesture turns', () => {
    for (const item of built.filter((candidate) => candidate.answerKind === 'voice')) {
      const spans = spokenSpansOf(itemCue(item));
      expect(spans[1].startsWith('Yes,')).toBe(true);
      expect(spans[2].startsWith('My turn:')).toBe(true);
    }
    const connect = built.find((item) => item.kind === 'connect')!;
    expect(gestureVerdictCue(connect, { fromId: 'fox', toId: 'hare' })).toContain('Say exactly: "Yes,');
    expect(gestureVerdictCue(connect, { fromId: 'fox', toId: 'oak' })).toContain('Say exactly: "My turn:');
  });

  it('drops leaked, broken, and duplicate-answer challenges instead of repairing them', () => {
    const leaked = itemFromChallenge({ ...challenges[0], prompt: 'The Oak Tree starts this food chain.' }, { organisms, relationships });
    const broken = itemFromChallenge({ ...challenges[1], toId: 'beaver' }, { organisms, relationships });
    const duplicate = itemsFromChallenges([challenges[0], { ...challenges[0], id: 'observe-2' }], { organisms, relationships });
    expect(leaked).toBeNull();
    expect(broken).toBeNull();
    expect(duplicate.items).toHaveLength(1);
    expect(duplicate.dropped).toBe(1);
  });

  it('registers the same cue surface with the headless DI drive', () => {
    const plan = buildDiDrivePlan('habitat-diorama', {
      organisms,
      relationships,
      challenges,
      gradeBand: '3-5',
    }, '4');
    expect(plan.items).toHaveLength(5);
    expect(plan.packGateIssues).toEqual([]);
    expect(plan.items.find((item) => item.id === 'connect-1')?.gestureVerdict?.correct).toContain('MATCHES');
    expect(plan.items.find((item) => item.id === 'restore-1')?.gestureVerdict?.wrong).toContain('does NOT match');
  });
});
