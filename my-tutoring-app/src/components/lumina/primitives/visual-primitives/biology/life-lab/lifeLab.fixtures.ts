/**
 * One hand-built world per Life Lab mode: the coverage table (`/agent-primitive` I2). Each must pass every check,
 * carry the mode code names for it, and be solvable by the harness's taps. Tests and the workspace test read these;
 * the tester and lessons never do (their content comes from the author agent).
 */
import type { ItemDraft, LifeLabMode } from './lifeLabWorld';

export const COVERAGE: Record<LifeLabMode, ItemDraft & { grade: number }> = {
  where_it_lives: { grade: 0,
    ask: 'These animals are in the wrong homes. Move each one to a place where it can live.',
    why: 'Look at what each place is like. Is it cold or hot? Wet or dry?',
    world: {
      zones: [
        { id: 'ice', label: 'Icy sea', kind: 'ice', cond: { temp: 0, water: 2 } },
        { id: 'desert', label: 'Desert', kind: 'desert', cond: { temp: 2, water: 0 } },
        { id: 'pond', label: 'Pond', kind: 'pond', cond: { temp: 1, water: 2 } }],
      beings: [{ id: 'bear', subject: 'polar_bear', zone: 'desert' }, { id: 'camel', subject: 'camel', zone: 'pond' }, { id: 'frog', subject: 'frog', zone: 'ice' }],
      rules: [{ kind: 'needs', beings: ['bear', 'camel', 'frog'] }],
      controls: [{ type: 'move', beings: ['bear', 'camel', 'frog'], zones: ['ice', 'desert', 'pond'] }],
      goal: { kind: 'all_thrive' }, steps: 3 } },
  what_it_needs: { grade: 0,
    ask: 'This sunflower is not growing. Change its light and water so it can grow.',
    why: 'Plants need the right amount of light and water. Try a little more, or a little less.',
    world: {
      zones: [{ id: 'pot', label: 'Sunflower pot', kind: 'pot', cond: { light: 0, water: 0 } }],
      beings: [{ id: 'sun', subject: 'sunflower', zone: 'pot' }],
      rules: [{ kind: 'needs', beings: ['sun'] }],
      controls: [{ type: 'condition', zones: ['pot'], keys: ['light', 'water'] }],
      goal: { kind: 'all_thrive' }, steps: 5 } },
  part_for_the_job: { grade: 1,
    ask: 'This bird lives where the only food is hard seeds. Give it a beak, then let it eat.',
    why: 'Think about what each beak could do. Which one could crack something hard?',
    world: {
      zones: [{ id: 'meadow', label: 'Seed meadow', kind: 'meadow', cond: { food: 'hard_seeds' } }],
      beings: [{ id: 'finch', subject: 'bird', zone: 'meadow', traits: { beak: 'long' } }],
      rules: [{ kind: 'part_enables', being: 'finch', part: 'beak' }],
      controls: [{ type: 'trait', being: 'finch', part: 'beak', options: ['long', 'hook', 'thick', 'spear'] }],
      goal: { kind: 'action' } } },
  hide_from_the_hunter: { grade: 1,
    ask: 'A bird hunts moths on this tree. Pick wings that will keep the moth safe.',
    why: 'The bird finds moths with its eyes. Look at the bark.',
    world: {
      zones: [{ id: 'bark', label: 'Birch tree', kind: 'bark', cond: { color: 'light' } }],
      beings: [{ id: 'moth', subject: 'moth', zone: 'bark', traits: { color: 'dark' } }, { id: 'hunter', subject: 'bird', zone: 'bark' }],
      rules: [{ kind: 'spots', predator: 'hunter', prey: 'moth' }],
      controls: [{ type: 'trait', being: 'moth', part: 'color', options: ['dark', 'light'] }],
      goal: { kind: 'survives' } } },
  whose_baby: { grade: 1,
    ask: 'Here are a mother dog and a father dog. Which puppy could be theirs?',
    why: 'A puppy gets each of its looks from its mother or its father. Check one thing at a time.',
    world: {
      zones: [{ id: 'parents', label: 'The parents', kind: 'plain', cond: {} }, { id: 'litter', label: 'Three puppies', kind: 'plain', cond: {} }],
      beings: [
        { id: 'mom', subject: 'dog', zone: 'parents', traits: { ears: 'floppy', coat: 'spots', color: 'brown' } },
        { id: 'dad', subject: 'dog', zone: 'parents', traits: { ears: 'pointy', coat: 'plain', color: 'black' } },
        { id: 'pupA', subject: 'dog', zone: 'litter', traits: { ears: 'pointy', coat: 'spots', color: 'white' } },
        { id: 'pupB', subject: 'dog', zone: 'litter', traits: { ears: 'floppy', coat: 'plain', color: 'black' } },
        { id: 'pupC', subject: 'dog', zone: 'litter', traits: { ears: 'floppy', coat: 'stripes', color: 'brown' } }],
      rules: [{ kind: 'inherits', parents: ['mom', 'dad'], traits: ['ears', 'coat', 'color'] }],
      controls: [{ type: 'choose', among: ['pupA', 'pupB', 'pupC'] }],
      goal: { kind: 'choose' } } },
  spread_the_seeds: { grade: 2,
    ask: 'A fox walks through this patch every day and then far away. Pick a seed the fox could carry to the far meadow.',
    why: 'Think about how a seed could hold on to something that moves.',
    world: {
      zones: [{ id: 'patch', label: 'The plant patch', kind: 'meadow', cond: { carrier: 'fur' } }, { id: 'far', label: 'Far meadow', kind: 'field', cond: {} }],
      beings: [{ id: 'seed', subject: 'plant_seed', zone: 'patch', traits: { seed: 'plain' } }, { id: 'fox', subject: 'fox', zone: 'patch' }],
      rules: [{ kind: 'part_enables', being: 'seed', part: 'seed', moveTo: 'far' }],
      controls: [{ type: 'trait', being: 'seed', part: 'seed', options: ['wings', 'plain', 'fluff', 'hooks'] }],
      goal: { kind: 'action' } } },
  life_cycle: { grade: 3,
    ask: 'These pictures show a butterfly\'s life. Put them in order, from the start of its life.',
    why: 'Think about what comes out of what. Which one is first?',
    world: {
      zones: [], beings: [],
      rules: [{ kind: 'stages', subject: 'butterfly' }],
      controls: [{ type: 'order', slots: 4, items: ['chrysalis', 'butterfly', 'egg', 'caterpillar', 'tadpole'] }],
      goal: { kind: 'order' } } },
  follow_the_path: { grade: 4,
    ask: 'This fish lives in a river. Build the path that gets oxygen from the water into its blood.',
    why: 'Watch where the breath stops. What can that part take in?',
    world: {
      zones: [{ id: 'river', label: 'River', kind: 'river', cond: { medium: 'water' } }],
      beings: [{ id: 'fish', subject: 'fish', zone: 'river' }],
      rules: [{ kind: 'flows', being: 'fish' }],
      controls: [{ type: 'order', slots: 3, items: ['lungs', 'nose', 'gills', 'mouth', 'stomach'] }],
      goal: { kind: 'flow' } } },
  survive_and_change: { grade: 3,
    ask: 'Smoke from a new mill has turned the tree bark dark. A bird hunts moths on the bark. After 4 moth families, will there be more light moths or more dark moths?',
    why: 'The bird can only eat the moths it can see.',
    world: {
      zones: [{ id: 'bark', label: 'Tree bark', kind: 'bark', cond: { color: 'dark' } }],
      beings: [{ id: 'moths', subject: 'moth', zone: 'bark', variants: [{ value: 'light', count: 6 }, { value: 'dark', count: 6 }] }, { id: 'hunter', subject: 'bird', zone: 'bark' }],
      rules: [{ kind: 'spots', predator: 'hunter', prey: 'moths' }],
      controls: [{ type: 'predict', of: 'moths' }],
      goal: { kind: 'prediction' }, steps: 4 } },
  fair_test: { grade: 2,
    ask: 'Do bean plants need light to grow? Set up two pots so that light is the only thing that is different. Then grow them.',
    why: 'In a fair test, only one thing changes. Everything else stays the same.',
    world: {
      zones: [
        { id: 'pot1', label: 'Pot 1', kind: 'pot', cond: { light: 2, water: 1 } },
        { id: 'pot2', label: 'Pot 2', kind: 'pot', cond: { light: 2, water: 1 } },
        { id: 'pot3', label: 'Pot 3', kind: 'pot', cond: { light: 0, water: 0 } }],
      beings: [{ id: 'bean1', subject: 'bean', zone: 'pot1' }, { id: 'bean2', subject: 'bean', zone: 'pot2' }, { id: 'bean3', subject: 'bean', zone: 'pot3' }],
      rules: [{ kind: 'needs', beings: ['bean1', 'bean2', 'bean3'] }],
      controls: [{ type: 'condition', zones: ['pot1', 'pot2', 'pot3'], keys: ['light', 'water'] }],
      goal: { kind: 'fair_test', variable: 'light' }, steps: 5 } },
};
