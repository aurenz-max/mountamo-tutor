/**
 * dump-truck-loader — the code-owned job pool and its eval-mode selectors.
 *
 * Lives apart from DumpTruckLoader.tsx on purpose: the generator needs the
 * selectors, and importing them through the component would drag React (and
 * through the evaluation barrel, Firebase) into the generation path and into
 * any test of this contract.
 */

export type MaterialType = 'dirt' | 'gravel' | 'sand' | 'debris';

export const DENSITY_BY_MATERIAL: Record<MaterialType, number> = {
  debris: 1.0, // light & fluffy → bed fills first (volume-limited)
  dirt: 1.5,   // medium → bed fills first, just under weight
  gravel: 1.8, // heavy → weight-limited, ~27.8 units/load, bed ~93% full
  sand: 2.5,   // wet sand, really heavy → weight-limited, bed ~67% full
};

export const MATERIAL_LABEL: Record<MaterialType, string> = {
  debris: 'light debris',
  dirt: 'dirt',
  gravel: 'gravel',
  sand: 'wet sand',
};

/**
 * Task identity of a job — the eval-mode ladder (catalog `evalModes`).
 * These are distinct SKILLS, not difficulty dials:
 *   load       — haul N loads; find the binding meter BY DOING
 *   predict    — commit to which meter fills first BEFORE any evidence
 *   plan_trips — clear a whole pile; density decides the trip count
 */
export type DumpTruckJobMode = 'load' | 'predict' | 'plan_trips';

export interface DumpTruckJob {
  id: string;
  title: string;
  mode: DumpTruckJobMode;      // which eval-mode ladder rung this job belongs to
  material: MaterialType;
  sourceSize: number;          // units of material at the pile for this job
  goal: 'complete_loads' | 'clear_source';
  targetLoads?: number;        // for 'complete_loads'
  predict?: boolean;           // ask "which fills first?" before solving
  brief: string;               // kid-friendly job description
  hint: string;                // shown only on request
  explainOnSolve: string;      // the density "why it worked" payoff
}

// The pool is CODE-OWNED: with bedVolume 30 and truckCapacity 50 the binding
// meter is pure arithmetic — full-bed weight = 30 × density.
//   debris 1.0 -> 30  <= 50  VOLUME-limited, 30 units/load, bed 100%
//   dirt   1.5 -> 45  <= 50  VOLUME-limited, 30 units/load, bed 100%
//   gravel 1.8 -> 54  >  50  WEIGHT-limited, ~27.8 units/load, bed ~93%
//   sand   2.5 -> 75  >  50  WEIGHT-limited, 20 units/load, bed ~67%
// Every number below is derived from that table. A brief must NEVER name the
// binding meter on a `predict` job — that IS the question. Hints may (support
// tier, shown on request only); explainOnSolve fires after the solve.
const JOB_POOL: DumpTruckJob[] = [
  // ---- load: find the binding meter BY DOING ----------------------------
  {
    id: 'load-debris',
    title: 'Light & Fluffy',
    mode: 'load',
    material: 'debris',
    sourceSize: 60,
    goal: 'complete_loads',
    targetLoads: 2,
    brief: "First job: haul this pile of light packing debris. Fill the bed right up and dump it at the dump zone — twice. Watch the two meters as you load: which one fills up first?",
    hint: "Debris is light. Keep scooping — you'll fill the BED to the top long before the truck gets heavy.",
    explainOnSolve: "Light debris is fluffy — the BED filled to the top while the weight scale barely moved. When material is light, the SIZE of the bed is your limit.",
  },
  {
    id: 'load-dirt',
    title: 'Dirt Detail',
    mode: 'load',
    material: 'dirt',
    sourceSize: 60,
    goal: 'complete_loads',
    targetLoads: 2,
    brief: "Two loads of plain dirt. Fill the bed and haul it over. Keep an eye on both meters as the bed fills up.",
    hint: "Dirt is middling. A completely full bed comes to 45 on the scale — close to the 50 limit, but the bed still runs out of room first.",
    explainOnSolve: "A full bed of dirt weighs 45, just under the 50 limit — so the BED filled first again, but only barely. Dirt sits right on the edge between the two limits.",
  },
  {
    id: 'load-sand',
    title: 'One Heavy Load',
    mode: 'load',
    material: 'sand',
    sourceSize: 40,
    goal: 'complete_loads',
    targetLoads: 1,
    brief: "Wet sand this time. Load as much as the truck will safely take, then dump it. Notice when the truck starts refusing more.",
    hint: "The truck stops accepting sand at about 20 units — the bed still looks part-empty when it does.",
    explainOnSolve: "Wet sand is heavy! The SCALE hit 50 when the bed was only about two-thirds full. With heavy material, WEIGHT is your limit — the bed can't fill all the way.",
  },
  {
    id: 'load-gravel',
    title: 'Gravel Run',
    mode: 'load',
    material: 'gravel',
    sourceSize: 56,
    goal: 'complete_loads',
    targetLoads: 2,
    brief: "Two loads of gravel. Fill up and haul — and watch closely, because this one is a close call between the two meters.",
    hint: "Gravel is heavy enough that the scale wins, but only just: the bed gets to about 93% before the truck refuses more.",
    explainOnSolve: "Gravel is heavy, so the SCALE was your limit — but it's lighter than wet sand, so the bed got almost full (about 93%) before the scale maxed out. Heavier material = less you can fit.",
  },

  // ---- predict: commit BEFORE any evidence ------------------------------
  {
    id: 'predict-debris',
    title: 'Call It: Packing Peanuts',
    mode: 'predict',
    material: 'debris',
    sourceSize: 40,
    goal: 'complete_loads',
    targetLoads: 1,
    predict: true,
    brief: "A pile of light packing debris. Before you scoop a single load, make your call below — then load up and see if you were right.",
    hint: "Think about how much a bag of packing peanuts weighs compared to how much room it takes up.",
    explainOnSolve: "Debris takes up lots of room but weighs almost nothing, so the BED runs out first — the scale barely moved.",
  },
  {
    id: 'predict-sand',
    title: 'Call It: Wet Sand',
    mode: 'predict',
    material: 'sand',
    sourceSize: 40,
    goal: 'complete_loads',
    targetLoads: 1,
    predict: true,
    brief: "New job: wet sand. Make your prediction below first, then load as much as you can safely carry and dump it.",
    hint: "Wet sand is the heaviest material on this site. A scoop of it weighs two and a half times what the same scoop of debris weighs.",
    explainOnSolve: "Wet sand is heavy! The SCALE hit the limit when the bed was only about two-thirds full. With heavy material, WEIGHT is your limit — not space.",
  },
  {
    id: 'predict-gravel',
    title: 'Call It: Gravel',
    mode: 'predict',
    material: 'gravel',
    sourceSize: 50,
    goal: 'complete_loads',
    targetLoads: 1,
    predict: true,
    brief: "Gravel is heavier than dirt but lighter than wet sand. Make your call, then load a full safe load and dump it. This one is close.",
    hint: "A completely full bed of gravel would weigh 54 — and the truck's limit is 50. Which meter runs out first?",
    explainOnSolve: "Gravel is heavy, so WEIGHT was still your limit — but only just. The bed reached about 93% before the scale maxed out, much fuller than the wet sand managed.",
  },
  {
    id: 'predict-dirt',
    title: 'Call It: Two Loads of Dirt',
    mode: 'predict',
    material: 'dirt',
    sourceSize: 60,
    goal: 'complete_loads',
    targetLoads: 2,
    predict: true,
    brief: "Two loads of plain dirt. Predict which meter stops you first, then haul both loads and check yourself.",
    hint: "A completely full bed of dirt weighs 45. The truck's limit is 50.",
    explainOnSolve: "A full bed of dirt weighs 45 — just under the 50 limit — so the BED filled first. Dirt is the closest call on the site: five more units of weight and the answer would flip.",
  },

  // ---- plan_trips: same 90-unit pile, different trip counts -------------
  {
    id: 'trips-debris',
    title: 'Clear the Debris Pile',
    mode: 'plan_trips',
    material: 'debris',
    sourceSize: 90,
    goal: 'clear_source',
    brief: "Big job: move ALL 90 units of light debris to the dump zone. How many trips will it take? Work it out as you go.",
    hint: "Debris fills the bed — 30 units per trip. 90 units ÷ 30 per trip = 3 trips.",
    explainOnSolve: "Light material means FULL loads, which means FEWER trips. Debris fills the 30-unit bed every time, so 90 units took just 3 trips.",
  },
  {
    id: 'trips-dirt',
    title: 'Clear the Dirt Pile',
    mode: 'plan_trips',
    material: 'dirt',
    sourceSize: 90,
    goal: 'clear_source',
    brief: "Same size pile — 90 units — but this time it's dirt. Move all of it. Will it take more trips than the debris did?",
    hint: "Dirt still fills the bed before it hits the weight limit: 30 units per trip. 90 ÷ 30 = 3 trips.",
    explainOnSolve: "Dirt is heavier than debris, but a full bed still weighs only 45 — under the limit. So it's still 30 units a trip and still 3 trips. Weight only costs you trips once it passes the limit.",
  },
  {
    id: 'trips-gravel',
    title: 'Clear the Gravel Pile',
    mode: 'plan_trips',
    material: 'gravel',
    sourceSize: 90,
    goal: 'clear_source',
    brief: "Another 90-unit pile, this time gravel. Move all of it to the dump zone and count what it costs you.",
    hint: "Gravel is weight-limited: about 27.8 units per trip. Three trips carry about 83 — not quite enough, so it takes 4.",
    explainOnSolve: "Gravel is heavy enough that the scale stops you at about 27.8 units. Three trips only move 83 of the 90, so you needed a 4th. Same pile as the dirt, one extra trip — that's density.",
  },
  {
    id: 'trips-sand',
    title: 'Clear the Sand Pile',
    mode: 'plan_trips',
    material: 'sand',
    sourceSize: 90,
    goal: 'clear_source',
    brief: "Last job, and the heaviest: 90 units of wet sand. Move the whole pile. How many trips does the heaviest material cost you?",
    hint: "Wet sand is capped at 20 units a trip. Four trips move 80 — 10 short — so it takes 5.",
    explainOnSolve: "Wet sand only lets you carry 20 units per trip, so the same 90-unit pile took 5 trips instead of the debris pile's 3. Density decides your trip count.",
  },
];

/** Jobs for one or more eval-mode rungs, in pool order. */
export const selectDumpTruckJobs = (
  modes: readonly string[],
  count = 4,
): DumpTruckJob[] => {
  const wanted = new Set(modes);
  const picked = JOB_POOL.filter((j) => wanted.has(j.mode));
  return (picked.length > 0 ? picked : JOB_POOL).slice(0, count);
};

/**
 * The unconstrained ("mixed") path. Rotates the rungs so every task identity
 * appears before any repeats — a mixed session that silently ran a single rung
 * would make the "mixed" label a lie (EVAL_TRACKER SP-21).
 */
export const selectMixedDumpTruckJobs = (count = 6): DumpTruckJob[] => {
  const order: DumpTruckJobMode[] = ['load', 'predict', 'plan_trips'];
  const byMode = order.map((m) => JOB_POOL.filter((j) => j.mode === m));
  const out: DumpTruckJob[] = [];
  for (let round = 0; out.length < count; round += 1) {
    let addedThisRound = false;
    for (const bucket of byMode) {
      if (round < bucket.length && out.length < count) {
        out.push(bucket[round]);
        addedThisRound = true;
      }
    }
    if (!addedThisRound) break;
  }
  return out;
};

/** Shown when no generator-selected jobs arrive — one rung of each, easiest first. */
export const DEFAULT_JOBS: DumpTruckJob[] = selectMixedDumpTruckJobs(6);

