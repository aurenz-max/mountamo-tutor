/**
 * The real machines Machine Workshop can check, and what each one is really made of. This is the ORACLE the author
 * agent's work is tested against, not the agent's input: the agent is told only each machine's name and where it
 * works, and must name the parts and their order itself. `fidelityErrors` then compares its chain with the real one.
 * When the agent fails, the atlas also supplies the words, so a lesson never breaks.
 *
 * Every machine here turns spinning into up-and-down (the spin_to_push principle). `required` is the chain in order;
 * `optional` parts may appear in a real one of these machines and are accepted where `after` says.
 */
import {
  KIND_NAMES, isConverter, type ChainKind, type ConverterKind, type ItemWords, type LoadKind, type SourceKind, type Stage,
} from './machineModel';

export interface AtlasMachine {
  id: string;
  name: string;
  where: string;
  required: readonly ChainKind[];
  /** Optional stages and the required stage each one comes straight after. */
  optional?: ReadonlyArray<{ kind: ChainKind; after: ChainKind }>;
  source: SourceKind;
  converter: ConverterKind;
  load: LoadKind;
  fluid?: 'oil' | 'water' | 'air';
  doesWord: string;
  /** Lesson words this machine fits, for the fallback pick. */
  topics: readonly string[];
  /** Fallback words when the agent's are rejected. */
  intro: string;
  principle: string;
  jobs: Partial<Record<ChainKind, string>>;
}

export const MACHINE_ATLAS: readonly AtlasMachine[] = [
  {
    id: 'pump_jack', name: 'Pump jack', where: 'an oil field',
    required: ['motor', 'belt', 'gearbox', 'crank_rod', 'walking_beam', 'pump'],
    source: 'motor', converter: 'crank_rod', load: 'pump', fluid: 'oil', doesWord: 'pumps oil up from deep underground',
    topics: ['oil', 'energy', 'fuel', 'pump', 'underground', 'drill'],
    intro: 'A pump jack nods up and down all day to pull oil out of the ground.',
    principle: 'The crank\'s pin goes round in a circle, and the rod turns that circle into a push and a pull that rocks the beam up and down.',
    jobs: { motor: 'Spins fast to power the machine.', belt: 'Carries the spin from the motor to the gearbox.',
      gearbox: 'Slows the spin down and makes it stronger.', walking_beam: 'Rocks like a seesaw: one end up, the other end down.',
      pump: 'Its rod goes down and up in the well to lift oil.' },
  },
  {
    id: 'windmill_pump', name: 'Windmill water pump', where: 'a farm',
    required: ['windmill', 'crank_rod', 'pump'], optional: [{ kind: 'gearbox', after: 'windmill' }],
    source: 'windmill', converter: 'crank_rod', load: 'pump', fluid: 'water', doesWord: 'pumps water up for the animals',
    topics: ['wind', 'farm', 'water', 'weather', 'renewable', 'animals'],
    intro: 'On a windy farm, a windmill pumps water up from a well into a tank for the animals.',
    principle: 'The wind spins the wheel; the crank\'s pin goes round, and the rod turns that into the up-and-down push the pump needs.',
    jobs: { windmill: 'Catches the wind and spins.', gearbox: 'Slows the spin down and makes it stronger.',
      pump: 'Its rod goes up and down to lift water from the well.' },
  },
  {
    id: 'sewing_machine', name: 'Sewing machine', where: 'a tailor\'s shop',
    required: ['motor', 'belt', 'crank_rod', 'needle'],
    source: 'motor', converter: 'crank_rod', load: 'needle', doesWord: 'stitches the cloth',
    topics: ['cloth', 'clothes', 'sewing', 'fabric', 'textile', 'home'],
    intro: 'A sewing machine moves its needle up and down hundreds of times a minute.',
    principle: 'The crank goes round and round, and the rod turns each turn into one trip down and up for the needle.',
    jobs: { motor: 'Spins to power the machine.', belt: 'Carries the spin up to the main shaft.',
      needle: 'Goes down through the cloth and back up to make a stitch.' },
  },
  {
    id: 'jigsaw', name: 'Jigsaw', where: 'a workshop',
    required: ['motor', 'gearbox', 'crank_rod', 'saw'],
    source: 'motor', converter: 'crank_rod', load: 'saw', doesWord: 'cuts through the wood',
    topics: ['wood', 'tools', 'cutting', 'building', 'workshop', 'carpentry'],
    intro: 'A jigsaw cuts curves in wood by moving a thin blade up and down very fast.',
    principle: 'The crank\'s pin goes round, and the rod turns that circle into the up-and-down strokes that saw the wood.',
    jobs: { motor: 'Spins very fast.', gearbox: 'Slows the spin down and makes it stronger.',
      saw: 'Moves up and down, cutting a little more each stroke.' },
  },
  {
    id: 'air_compressor', name: 'Air compressor', where: 'a garage',
    required: ['motor', 'belt', 'crank_rod', 'pump'],
    source: 'motor', converter: 'crank_rod', load: 'pump', fluid: 'air', doesWord: 'squeezes air into the tank',
    topics: ['air', 'tires', 'pressure', 'gas', 'garage', 'car'],
    intro: 'An air compressor squeezes air into a tank to fill tires and run air tools.',
    principle: 'The crank goes round, and the rod pushes the piston up and pulls it down, squeezing air on every push.',
    jobs: { motor: 'Spins to power the machine.', belt: 'Carries the spin to the pump\'s shaft.',
      pump: 'Its piston goes up and down to squeeze air into the tank.' },
  },
  {
    id: 'stamp_mill', name: 'Stamp mill', where: 'an old gold mine',
    required: ['water_wheel', 'cam_follower', 'stamp'],
    source: 'water_wheel', converter: 'cam_follower', load: 'stamp', doesWord: 'crushes the rock to find the gold',
    topics: ['rock', 'gold', 'mining', 'history', 'river', 'minerals'],
    intro: 'Long ago, miners used a river to work a stamp mill that crushed rock to get the gold out.',
    principle: 'The cam\'s bump lifts the follower up as it turns, then lets it drop, so the stamp falls and crushes the rock every turn.',
    jobs: { water_wheel: 'The river pushes it round.', stamp: 'Is lifted up and dropped to crush the rock.' },
  },
  {
    id: 'trip_hammer', name: 'Trip hammer', where: 'a blacksmith\'s forge',
    required: ['water_wheel', 'cam_follower', 'walking_beam', 'stamp'],
    source: 'water_wheel', converter: 'cam_follower', load: 'stamp', doesWord: 'hammers the hot iron',
    topics: ['iron', 'metal', 'blacksmith', 'history', 'river', 'forge'],
    intro: 'A blacksmith\'s trip hammer uses a river\'s power to pound hot iron into shape.',
    principle: 'The cam\'s bump pushes one end of the beam up as it turns; the other end lifts the hammer, then drops it on the iron.',
    jobs: { water_wheel: 'The river pushes it round.', walking_beam: 'Tips like a seesaw to lift the hammer.',
      stamp: 'Is lifted and dropped to pound the iron.' },
  },
  {
    id: 'toy_automaton', name: 'Toy automaton', where: 'a toy maker\'s bench',
    required: ['hand_crank', 'cam_follower', 'figure'],
    source: 'hand_crank', converter: 'cam_follower', load: 'figure', doesWord: 'makes the bird hop up and down',
    topics: ['toy', 'play', 'art', 'birds', 'simple machines', 'design'],
    intro: 'A toy automaton is a little machine: turn its handle and a wooden bird hops.',
    principle: 'The cam\'s bump lifts the follower as it turns and lets it fall, so the bird hops once every turn of the handle.',
    jobs: { hand_crank: 'You turn it round with your hand.', figure: 'A wooden bird that hops up and down.' },
  },
];

export const ATLAS_IDS = MACHINE_ATLAS.map(m => m.id);
export const atlasMachine = (id: string) => MACHINE_ATLAS.find(m => m.id === id) ?? null;

/** The real chains this machine can have: required, plus any optional stages in their places. */
export function realChains(m: AtlasMachine): ChainKind[][] {
  let chains: ChainKind[][] = [[...m.required]];
  for (const o of m.optional ?? []) {
    chains = chains.flatMap(ch => {
      const at = ch.indexOf(o.after);
      return at < 0 ? [ch] : [ch, [...ch.slice(0, at + 1), o.kind, ...ch.slice(at + 1)]];
    });
  }
  return chains;
}

const name = (k: ChainKind) => KIND_NAMES[k].toLowerCase();

/** Is this chain how the real machine is built? Empty means yes. Messages say what a real one has, to repair from. */
export function fidelityErrors(m: AtlasMachine, chain: readonly ChainKind[]): string[] {
  const chains = realChains(m);
  if (chains.some(ch => ch.length === chain.length && ch.every((k, i) => k === chain[i]))) return [];
  const errs: string[] = [];
  const conv = chain.find(isConverter);
  if (conv && conv !== m.converter) errs.push(`a real ${m.name.toLowerCase()} turns spinning into up-and-down with a ${name(m.converter)}, not a ${name(conv)}`);
  if (chain[0] !== m.source) errs.push(`a real ${m.name.toLowerCase()} is powered by a ${name(m.source)}`);
  const allowed = new Set<ChainKind>([...m.required, ...(m.optional ?? []).map(o => o.kind)]);
  for (const k of m.required) if (!chain.includes(k)) errs.push(`a real ${m.name.toLowerCase()} has a ${name(k)}`);
  for (const k of chain) if (!allowed.has(k)) errs.push(`a real ${m.name.toLowerCase()} has no ${name(k)}`);
  if (!errs.length) errs.push(`the parts of a real ${m.name.toLowerCase()} are in a different order: power flows ${realChains(m)[0].map(name).join(' → ')}`);
  return errs;
}

/** The atlas's own words for a machine, used when the agent's are rejected. */
export function atlasWords(m: AtlasMachine): ItemWords {
  const stages: Stage[] = m.required.map(kind => ({ kind, job: isConverter(kind) ? 'Turns spinning into up-and-down.' : m.jobs[kind] ?? KIND_NAMES[kind] }));
  return { machine: m.id, name: m.name, where: m.where, intro: m.intro, principle: m.principle, doesWord: m.doesWord,
    ...(m.fluid ? { fluid: m.fluid } : {}), stages, real: m.converter };
}
