/** habitat-diorama's lever set: the leak rules, the simpler-item builders, and miss → lever. */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { HabitatChallenge, Organism, Relationship } from './HabitatDiorama';
import { habitatMiss, itemFromChallenge, type HabitatItem } from './habitatDioramaDomain';
import {
  BODY_CLUES_LEVER, CARD_PICTURES_LEVER, CHANGE_MARK_LEVER, DIRECTION_MODEL_LEVER, EASIER_CHANGE_LEVER, EASIER_CLAIM_LEVER,
  EASIER_CLUE_LEVER, EASIER_LINK_LEVER, FOOD_LINES_LEVER, ITS_PARTNERS_LEVER, PLAIN_CLUE, START_LINES_LEVER, ZONE_PICTURES_LEVER,
  bodyClues, cardPictures, changeMarks, directionModel, easierConnectItem, easierDefendItem, easierObserveItem,
  easierPredictItem, foodLinesLeak, HABITAT_LEVERS, namedIds, organismEmoji,
  restorePartners, simplerLeaks, startPartners,
} from './habitatDioramaLevers';

type Data = { organisms: Organism[]; relationships: Relationship[] };
/** The levers offered on a session item (`HABITAT_LEVERS.declare`) and the scene fact of the pulled ones. */
const levers = (item: HabitatItem, data: Data, shown: readonly string[], pulled: readonly string[]) =>
  HABITAT_LEVERS.declare(item, { data, shownEmojis: shown }, pulled);
const facts = (item: HabitatItem, pulled: readonly string[], shown: readonly string[], data: Data) =>
  HABITAT_LEVERS.onScreen(item, { data, shownEmojis: shown }, pulled);

const org = (id: string, commonName: string, role: Organism['role']): Organism =>
  ({ id, commonName, role, imagePrompt: id, position: { x: '50%', y: '50%' }, description: `${commonName}.`, adaptations: [] });
const pred = (fromId: string, toId: string): Relationship => ({ fromId, toId, type: 'predation', description: `${toId} eats ${fromId}.` });

const FOREST: { organisms: Organism[]; relationships: Relationship[] } = {
  organisms: [org('oak', 'Oak Tree', 'producer'), org('hare', 'Snowshoe Hare', 'primary-consumer'),
    org('fox', 'Red Fox', 'secondary-consumer'), org('fungus', 'Shelf Fungus', 'decomposer')],
  relationships: [pred('hare', 'fox'), pred('oak', 'hare')],
};
const POND: { organisms: Organism[]; relationships: Relationship[] } = {
  organisms: [org('algae', 'Green Algae', 'producer'), org('lily', 'Water Lily', 'producer'),
    org('snail', 'Pond Snail', 'primary-consumer'), org('tadpole', 'Tadpole', 'primary-consumer'),
    org('fish', 'Sunfish', 'secondary-consumer'), org('heron', 'Grey Heron', 'tertiary-consumer'),
    org('bacteria', 'Mud Bacteria', 'decomposer'), org('worm', 'Sludge Worm', 'decomposer')],
  relationships: [pred('algae', 'snail'), pred('lily', 'tadpole'), pred('snail', 'fish'), pred('tadpole', 'heron'),
    pred('fish', 'heron'), { fromId: 'lily', toId: 'snail', type: 'symbiosis-commensalism', description: 'Snails rest on lilies.' },
    { fromId: 'fish', toId: 'tadpole', type: 'competition', description: 'They want the same food.' }],
};
type Habitat = typeof FOREST;
const build = (c: Partial<HabitatChallenge>, h: Habitat = FOREST) =>
  itemFromChallenge({ id: 'x', prompt: 'Look closely.', explanation: 'Because.', type: 'observe', ...c } as HabitatChallenge, h)!;
const observe = (focus: string, h: Habitat = FOREST, prompt = 'It is the clue.') => build({ id: `obs-${focus}`, type: 'observe', focusOrganismId: focus, prompt }, h);
const connect = (r: Relationship, h: Habitat = FOREST) => itemFromChallenge(
  { id: `con-${r.fromId}`, type: 'connect', prompt: 'Make it.', explanation: 'Because.', fromId: r.fromId, toId: r.toId }, h);

describe('observe', () => {
  it('food_lines leak rule: none drawn, or every line touching the answer, is a leak', () => {
    const oak = observe('oak');
    expect(foodLinesLeak(oak, [])).toBe(true);
    expect(foodLinesLeak(oak, [pred('oak', 'hare')])).toBe(true);
    expect(foodLinesLeak(oak, FOREST.relationships)).toBe(false);
    expect(levers(observe('hare'), FOREST, [], []).map(l => l.id)).not.toContain(FOOD_LINES_LEVER);
  });

  it('the easier clue: two choices, a plain role clue of another role, never the stuck answer', () => {
    const easier = easierObserveItem(observe('oak', FOREST, 'It makes its own food from sunlight.'), FOREST)!;
    expect(easier).toMatchObject({ id: 'obs-oak~simpler', kind: 'observe', answerText: 'Snowshoe Hare',
      optionTexts: ['Snowshoe Hare', 'Shelf Fungus'], prompt: PLAIN_CLUE.eats });
    expect(easier.organismNames.oak).toBe('Oak Tree');
    expect(easierObserveItem(easier, FOREST)).toBeNull();
  });

  it.each(POND.organisms.map(o => o.id))('builder over the pond, stuck on %s: shape, solvable, never the source', focus => {
    const stuck = observe(focus, POND);
    const easier = easierObserveItem(stuck, POND);
    if (!easier) return;
    expect(easier.optionTexts).toHaveLength(2);
    expect(easier.optionTexts).toContain(easier.answerText);
    expect(easier.optionTexts).not.toContain(stuck.answerText);
    expect(Object.values(PLAIN_CLUE)).toContain(easier.prompt);
    expect(easier.focusRole === 'producer' ? 'p' : easier.focusRole === 'decomposer' ? 'd' : 'c')
      .not.toBe(stuck.focusRole === 'producer' ? 'p' : stuck.focusRole === 'decomposer' ? 'd' : 'c');
    expect(simplerLeaks(stuck, easier)).toBe(false);
  });

  it('no easier clue on an item that already has two choices', () => {
    const two = build({ id: 'two', type: 'observe', focusOrganismId: 'oak', optionOrganismIds: ['oak', 'fox'] },
      { ...FOREST, organisms: FOREST.organisms.slice(0, 3).filter(o => o.id !== 'hare') });
    expect(two.optionTexts).toHaveLength(2);
    expect(easierObserveItem(two, FOREST)).toBeNull();
  });
});

describe('connect', () => {
  const hareFox = connect(pred('hare', 'fox'))!;

  it('direction_model leak rule: never a picture a living thing on screen wears', () => {
    const shown = FOREST.organisms.map(organismEmoji);
    const model = directionModel('predation', shown)!;
    expect(model.some(p => shown.includes(p))).toBe(false);
    expect(directionModel('predation', ['🌾', '🍎', '🐛'])).toBeNull();
  });

  it('start_lines leak rule: two or more partners, else none', () => {
    expect(startPartners(hareFox, FOREST.relationships).sort()).toEqual(['fox', 'oak']);
    expect(startPartners(hareFox, [pred('hare', 'fox')])).toEqual([]);
  });

  it('the easier link is plainer, from another start, never touching the stuck answer', () => {
    const easier = easierConnectItem(hareFox, FOREST)!;
    expect(easier).toMatchObject({ id: 'con-hare~simpler', kind: 'connect', fromId: 'oak', toId: 'hare', relationshipType: 'predation' });
    expect(easierConnectItem(easier, FOREST)).toBeNull();
    expect(easierConnectItem(connect(pred('oak', 'hare'))!, FOREST)).toBeNull();
  });

  it.each(POND.relationships.map(r => [`${r.fromId}→${r.toId}`, r] as const))('builder over the pond, stuck on %s', (_n, r) => {
    const stuck = connect(r, POND);
    if (!stuck) return;
    const easier = easierConnectItem(stuck, POND);
    if (!easier) return;
    expect(POND.relationships.some(x => x.fromId === easier.fromId && x.toId === easier.toId)).toBe(true);
    expect([easier.fromId, easier.toId]).not.toContain(stuck.toId);
    expect(easier.fromId).not.toBe(stuck.fromId);
    expect(simplerLeaks(stuck, easier)).toBe(false);
  });

  it('the scene facts name the start and the model, never the destination', () => {
    const said = facts(hareFox, [DIRECTION_MODEL_LEVER, START_LINES_LEVER], FOREST.organisms.map(organismEmoji), FOREST);
    expect(said).toMatch(/Snowshoe Hare/);
    expect(said).not.toMatch(/Red Fox/);
  });
});

describe('a miss, then the lever', () => {
  const shown = FOREST.organisms.map(organismEmoji);
  const hareFox = connect(pred('hare', 'fox'))!;
  it.each([
    ['oak', 'leads_to_start', DIRECTION_MODEL_LEVER],
    ['fungus', 'unconnected', START_LINES_LEVER],
  ])('connect: tapping %s is %s, then %s', (toId, miss, lever) => {
    const m = habitatMiss(hareFox, { toId }, FOREST.relationships);
    expect(m).toBe(miss);
    expect(nextLever(levers(hareFox, FOREST, shown, []), m)).toBe(lever);
  });
  it('connect: with the help pulled, the simpler link comes next', () => {
    expect(nextLever(levers(hareFox, FOREST, shown, [START_LINES_LEVER, DIRECTION_MODEL_LEVER]), 'unconnected'))
      .toBe(EASIER_LINK_LEVER);
  });
  it('observe: another choice is answered by the lines, then the easier clue', () => {
    const oak = observe('oak');
    expect(nextLever(levers(oak, FOREST, shown, []), 'other_choice')).toBe(FOOD_LINES_LEVER);
    expect(nextLever(levers(oak, FOREST, shown, [FOOD_LINES_LEVER]), 'other_choice')).toBe(EASIER_CLUE_LEVER);
  });
});

it('the pond sweeps are not vacuous: several stuck items get a simpler one', () => {
  const observes = POND.organisms.map(o => easierObserveItem(observe(o.id, POND), POND)).filter(Boolean);
  const connects = POND.relationships.map(r => connect(r, POND)).filter((i): i is HabitatItem => !!i)
    .map(i => easierConnectItem(i, POND)).filter(Boolean);
  expect(observes.length).toBeGreaterThanOrEqual(4);
  expect(connects.length).toBeGreaterThanOrEqual(1);
});

// ── predict, restore, defend (2026-10-09) ───────────────────────────────────

const POND_NAMES = Object.fromEntries(POND.organisms.map(o => [o.id, o.commonName]));
const predict = (answer: string, event: string, h: Habitat = POND) =>
  build({ id: `pre-${answer}`, type: 'predict', affectedOrganismId: answer, expectedTrend: 'increase', disruptionEvent: event }, h);

describe('predict', () => {
  const stuck = predict('fish', 'Every Grey Heron leaves the pond');

  it('names in text: full name or head noun, plural too', () => {
    expect(namedIds('The herons and pond snails leave.', POND_NAMES).sort()).toEqual(['heron', 'snail']);
    expect(namedIds('Nothing here.', POND_NAMES)).toEqual([]);
  });

  it('change_mark leak rule: rings what the change names, never the answer; refused when it names only the answer', () => {
    expect(changeMarks(stuck)).toEqual(['heron']);
    // The item gate now drops a change that names the answer (`askNamesAnswer`); the lever's own rule still holds.
    expect(itemFromChallenge({ id: 'p', type: 'predict', prompt: 'Look.', explanation: 'Because.', affectedOrganismId: 'heron',
      expectedTrend: 'increase', disruptionEvent: 'A storm scares the herons' } as HabitatChallenge, POND)).toBeNull();
    const onlyAnswer: HabitatItem = { ...stuck, focusOrganismId: 'heron', answerText: 'Grey Heron', disruptionEvent: 'A storm scares the herons' };
    expect(changeMarks(onlyAnswer)).toEqual([]);
    expect(levers(onlyAnswer, POND, [], []).map(l => l.id)).not.toContain(CHANGE_MARK_LEVER);
  });

  it('the easier change: one step, two choices, a far foil, never the stuck answer or cause', () => {
    const easier = easierPredictItem(stuck, POND)!;
    expect(easier).toMatchObject({ id: 'pre-fish~simpler', kind: 'predict', disruptionEvent: 'Every Pond Snail leaves the habitat',
      answerText: 'Green Algae', expectedTrend: 'increase', optionTexts: ['Green Algae', 'Mud Bacteria'] });
    expect(easier.organismNames.heron).toBe('Grey Heron');
    expect(simplerLeaks(stuck, easier)).toBe(false);
    expect(easierPredictItem(easier, POND)).toBeNull();
  });

  it.each(POND.relationships.filter(r => r.type === 'predation').map(r => [r.toId, r.fromId] as const))(
    'builder over the pond, every %s leaves, %s is the answer', (cause, answer) => {
      const item = predict(answer, `Every ${POND_NAMES[cause]} leaves`);
      const easier = easierPredictItem(item, POND);
      if (!easier) return;
      expect(easier.optionTexts).toHaveLength(2);
      expect(easier.optionTexts).not.toContain(item.answerText);
      expect(easier.disruptionEvent).not.toContain(POND_NAMES[cause]);
      const prey = easier.focusOrganismId!;
      const predator = POND.relationships.find(r => r.fromId === prey && r.type === 'predation' && easier.disruptionEvent!.includes(POND_NAMES[r.toId]))!.toId;
      const foil = easier.optionOrganismIds!.find(id => id !== prey)!;
      expect(POND.relationships.some(r => [r.fromId, r.toId].includes(foil) && [r.fromId, r.toId].some(x => x === prey || x === predator))).toBe(false);
      expect(simplerLeaks(item, easier)).toBe(false);
    });

  it('the pond predict sweep is not vacuous', () => {
    const built = POND.relationships.filter(r => r.type === 'predation')
      .map(r => easierPredictItem(predict(r.fromId, `Every ${POND_NAMES[r.toId]} leaves`), POND)).filter(Boolean);
    expect(built.length).toBeGreaterThanOrEqual(3);
  });

  it('another choice gets the ring, then the arrows, then the easier change', () => {
    const offered = (pulled: string[]) => levers(stuck, POND, [], pulled);
    expect(offered([]).map(l => l.id)).toEqual([CHANGE_MARK_LEVER, FOOD_LINES_LEVER, EASIER_CHANGE_LEVER]);
    expect(nextLever(offered([]), 'other_choice')).toBe(CHANGE_MARK_LEVER);
    expect(nextLever(offered([CHANGE_MARK_LEVER, FOOD_LINES_LEVER]), 'other_choice')).toBe(EASIER_CHANGE_LEVER);
    expect(facts(stuck, [CHANGE_MARK_LEVER], [], POND)).toMatch(/Grey Heron/);
    expect(facts(stuck, [CHANGE_MARK_LEVER, FOOD_LINES_LEVER], [], POND)).not.toMatch(/Sunfish/);
  });
});

const HERON = { ...POND.organisms.find(o => o.id === 'heron')!,
  adaptations: ['Long legs for wading', 'A sharp beak like a spear', 'Feathers that stay dry in the water'] };
const POND_B: Habitat = { ...POND, organisms: POND.organisms.map(o => o.id === 'heron' ? HERON : o) };
const restore = (id: string, zone: string) =>
  build({ id: `res-${id}`, type: 'restore', restorationEntityId: id, restorationZone: zone as never }, POND_B);

describe('restore', () => {
  const heron = restore('heron', 'shoreline');
  it('its_partners: every living thing it has a relationship with; none means refused', () => {
    expect(restorePartners(heron, POND.relationships).sort()).toEqual(['fish', 'tadpole']);
    expect(restorePartners(restore('worm', 'underground'), POND.relationships)).toEqual([]);
  });
  it('body_clues leak rule: an adaptation that names a place is never shown', () => {
    expect(bodyClues(heron, POND_B.organisms)).toEqual(['Long legs for wading', 'A sharp beak like a spear']);
    expect(bodyClues(restore('snail', 'water'), POND_B.organisms)).toEqual([]);
  });
  it('zone_pictures is always offered; the facts never name the zone', () => {
    expect(levers(restore('worm', 'underground'), POND_B, [], []).map(l => l.id)).toEqual([ZONE_PICTURES_LEVER]);
    expect(levers(heron, POND_B, [], []).map(l => l.id)).toEqual([ZONE_PICTURES_LEVER, ITS_PARTNERS_LEVER, BODY_CLUES_LEVER]);
    const said = facts(heron, [ZONE_PICTURES_LEVER, ITS_PARTNERS_LEVER, BODY_CLUES_LEVER], [], POND_B);
    expect(said).toMatch(/Sunfish/);
    expect(said).toMatch(/Long legs for wading/);
    expect(said).not.toMatch(/shore/i);
  });
  it.each([['water', 'water_for_land'], ['canopy', 'other_land_zone']] as const)('a tap in %s is %s, then zone_pictures, then its_partners', (zone, miss) => {
    const m = habitatMiss(heron, { zone }, POND.relationships);
    expect(m).toBe(miss);
    expect(nextLever(levers(heron, POND_B, [], []), m)).toBe(ZONE_PICTURES_LEVER);
    expect(nextLever(levers(heron, POND_B, [], [ZONE_PICTURES_LEVER]), m)).toBe(ITS_PARTNERS_LEVER);
  });
});

const defend = (cards: Array<[string, string]>, key: string, claim = 'Herons depend on fish in the pond.') =>
  build({ id: 'def', type: 'defend', prompt: claim, evidenceChoices: cards.map(([id, text]) => ({ id, text })), correctEvidenceId: key }, POND);

describe('defend', () => {
  const onlyKey = defend([['a', 'The heron catches sunfish with its beak.'], ['b', 'Pond snails scrape algae off rocks.'],
    ['c', 'Mud bacteria live in the mud.']], 'a');
  const shared = defend([['a', 'The heron catches sunfish with its beak.'], ['b', 'The heron stands still for a long time.'],
    ['c', 'Mud bacteria live in the mud.']], 'a');

  it('card_pictures leak rule: refused when only the key shares a living thing with the claim', () => {
    expect(cardPictures(onlyKey)).toBeNull();
    expect(cardPictures(shared)).toEqual([['fish', 'heron'], ['heron'], ['bacteria']]);
    expect(levers(onlyKey, POND, [], []).map(l => l.id)).not.toContain(CARD_PICTURES_LEVER);
  });

  it('the easier claim: two cards, a link the stuck item never names, the supporting card is the key', () => {
    const easier = easierDefendItem(onlyKey, POND)!;
    expect(easier).toMatchObject({ id: 'def~simpler', kind: 'defend', prompt: 'The Tadpole needs other living things for its food.',
      answerText: 'The Tadpole eats the Water Lily.' });
    expect(easier.optionTexts).toEqual(['The Tadpole lives in this habitat.', 'The Tadpole eats the Water Lily.']);
    expect(simplerLeaks(onlyKey, easier)).toBe(false);
    expect(easierDefendItem(easier, POND)).toBeNull();
  });

  it('another card, then card pictures, then the arrows, then the easier claim', () => {
    const offered = (pulled: string[]) => levers(shared, POND, [], pulled);
    expect(nextLever(offered([]), 'other_choice')).toBe(CARD_PICTURES_LEVER);
    expect(nextLever(offered([CARD_PICTURES_LEVER]), 'other_choice')).toBe(FOOD_LINES_LEVER);
    expect(nextLever(offered([CARD_PICTURES_LEVER, FOOD_LINES_LEVER]), 'other_choice')).toBe(EASIER_CLAIM_LEVER);
  });
});
