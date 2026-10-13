/**
 * Drawers: ungraded displays that show one idea in the best visual form for it, with a control
 * or two the learner can move. Gemini writes a small spec; a fixed renderer draws it; code checks
 * the spec (drawerSpecs.ts) and computes every number shown. No eval modes and no score.
 */
import { ComponentDefinition } from '../../../types';

export const DRAWER_CATALOG: ComponentDefinition[] = [
  {
    id: 'drawer-model-slider',
    description: 'Ungraded explorable model: 1-3 sliders for the quantities in an established formula, with the results recomputed '
      + 'live and an optional stacked bar. The learner moves one quantity and sees the consequence. Use when the lesson '
      + 'has a cause-and-effect relationship that a formula describes: stopping distance and speed, area from length and '
      + 'width, density from mass and volume, interest over time, unit rates and prices, speed = distance / time, '
      + 'Ohm\'s law. Grades 3-12, math and science.',
    constraints: 'Needs an established formula from physics, chemistry, geometry, measurement or finance, with at most 3 '
      + 'inputs. Not for counting or place value, and not for qualitative ideas with no standard formula (a market, a '
      + 'habitat, a historical trend): use drawer-cause-chain for those. Ungraded: pair it with a graded primitive when evidence is needed. The generator writes the formula and '
      + 'one known fact it must reproduce; a spec that fails is dropped.',
    affordances: { representation: 'symbolic', reader: 'developing', answers: ['manipulate'], role: 'visualize', minutes: 3 },
  },
  {
    id: 'drawer-part-whole',
    description: 'Ungraded display of a whole split into named parts on a 100-square grid; a part can open its own '
      + 'breakdown so a tiny share is readable. Use when proportion or composition is the point: what air or the body is '
      + 'made of, where Earth\'s water is, how land or a budget or a day is divided, shares of a population, percentages '
      + 'and fractions of a real total. Grades 2-12, science, social studies and math.',
    constraints: 'Needs real, sourced amounts that add up to a known whole (2-6 parts). Not for comparing unrelated '
      + 'quantities. Ungraded.',
    affordances: { representation: 'pictorial', reader: 'developing', answers: ['tap'], role: 'visualize', minutes: 3 },
  },
  {
    id: 'drawer-cause-chain',
    description: 'Ungraded chain of 3-5 linked effects: the learner starts a change at one end (increase or decrease) and '
      + 'reveals each effect one link at a time, predicting before each reveal. Use for systems where one change '
      + 'travels: food chains and trophic cascades, supply and demand, erosion and deforestation, the water cycle\'s '
      + 'effects, causes and consequences in history, body systems. Grades 2-12, science and social studies.',
    constraints: 'Needs a linear chain where each link pushes the next thing the same way or the opposite way. Not for '
      + 'branching webs or step-by-step procedures. Ungraded.',
    affordances: { representation: 'pictorial', reader: 'emerging', answers: ['tap'], role: 'visualize', minutes: 3 },
  },
  {
    id: 'drawer-magnitude-ladder',
    description: 'Ungraded ladder of 4-8 real things of very different sizes in one unit, shown first on an ordinary scale (where '
      + 'all but the largest vanish) and then on a powers-of-ten scale. Use when the size of numbers is the point: sizes from '
      + 'a cell to a planet, ages from a day to the universe, populations, distances in space, speeds from a snail to light, '
      + 'scientific notation. Grades 4-12, science and math.',
    constraints: 'Needs real figures spanning at least a factor of 1000 in one unit. Not for comparing a few similar amounts. Ungraded.',
    affordances: { representation: 'pictorial', reader: 'developing', answers: ['tap'], role: 'visualize', minutes: 2 },
  },
  {
    id: 'drawer-band-scale',
    description: 'Ungraded slider along one quantity divided into named zones, with familiar examples marked; the readout names '
      + 'the zone and explains the value. Use when named ranges of a scale matter more than the number: the pH scale, states '
      + 'of water by temperature, the Beaufort wind scale, decibels and hearing safety, the UV index, body temperature, the '
      + 'electromagnetic spectrum. Grades 2-12, science.',
    constraints: 'Needs a real scale with standard named zones. Ungraded.',
    affordances: { representation: 'pictorial', reader: 'developing', answers: ['manipulate'], role: 'visualize', minutes: 2 },
  },
  {
    id: 'drawer-range-bars',
    description: 'Ungraded set of 2-8 things, each with a range on one shared scale, and a slider that sweeps across it naming '
      + 'who covers the current value (log scale when ranges span powers of ten). Use for overlapping ranges: hearing ranges '
      + 'of animals, temperatures where animals or plants survive, wavelengths of light and other waves, growing seasons, '
      + 'lifespans, when historical periods overlapped. Grades 3-12, science and social studies.',
    constraints: 'Needs real ranges of one quantity. Ungraded.',
    affordances: { representation: 'pictorial', reader: 'developing', answers: ['manipulate'], role: 'visualize', minutes: 2 },
  },
  {
    id: 'drawer-metric-switch',
    description: 'Ungraded ranking of 3-10 things by a measure the learner picks; switching the measure reorders the list, '
      + 'and one item is followed through every ranking. Use when "biggest" or "best" depends on what you measure: planets by '
      + 'size, mass, distance or day length; animals by weight, speed or lifespan; countries by area or population; '
      + 'elements by mass or abundance. Grades 3-12, science, social studies and math.',
    constraints: 'Needs real values for 2-4 measures that rank the items differently. Ungraded.',
    affordances: { representation: 'pictorial', reader: 'developing', answers: ['tap'], role: 'visualize', minutes: 2 },
  },
  {
    id: 'drawer-unit-chain',
    description: 'Ungraded chain that multiplies a small familiar rate step by step into a large total, each step showing its '
      + 'multiplier and why (60 minutes in an hour, 24 hours in a day); the learner changes the starting rate on a slider. '
      + 'Use for unit conversion and rates over time: heartbeats in a lifetime, water from a dripping tap in a year, seconds '
      + 'in a year, a light-year in kilometres, breaths or steps per day. Grades 4-8, math and science.',
    constraints: 'Needs a rate and plain multiplications by real conversion factors. Ungraded.',
    affordances: { representation: 'symbolic', reader: 'developing', answers: ['manipulate'], role: 'visualize', minutes: 3 },
  },
  {
    id: 'drawer-ratio-scaler',
    description: 'Ungraded recipe or mixture whose amounts all scale by one factor as the learner changes how much to make; the '
      + 'factor shows as a fraction and the proportion bar keeps its shape. Use for ratios and proportional reasoning: scaling '
      + 'a recipe, mixing paint or concrete, a drink mix, map scale, equivalent ratios. Grades 4-8, math.',
    constraints: 'Needs a realistic base recipe with 2-7 amounts. Ungraded.',
    affordances: { representation: 'pictorial', reader: 'developing', answers: ['manipulate'], role: 'visualize', minutes: 2 },
  },
  {
    id: 'drawer-growth-race',
    description: 'Ungraded race between two quantities over time, one growing by adding and one by multiplying, charted up to '
      + 'the step the learner picks, with the crossing marked. Use for linear against exponential growth: a fixed daily amount '
      + 'against a doubling penny, bacteria doubling, simple against compound interest, a rumour or virus spreading, '
      + 'population growth. Grades 5-12, math and science.',
    constraints: 'Needs one adding and one multiplying quantity that cross within 200 steps. Ungraded.',
    affordances: { representation: 'symbolic', reader: 'developing', answers: ['manipulate'], role: 'visualize', minutes: 3 },
  },
  {
    id: 'drawer-chance-run',
    description: 'Ungraded chance experiment the learner runs once or 10, 100 or 1000 times at a stroke, watching the counts '
      + 'settle toward the exact expected result. Use for probability and the law of large numbers: sums of two dice, coin '
      + 'flips, spinners, drawing from a bag, a Punnett-square genetics cross. Grades 3-12, math and science.',
    constraints: 'Needs 1-3 sources with equally likely outcomes (repeat one to weight it), at most 24 possible results. Ungraded.',
    affordances: { representation: 'pictorial', reader: 'developing', answers: ['tap'], role: 'visualize', minutes: 3 },
  },
  {
    id: 'drawer-cycle-wheel',
    description: 'Ungraded loop of 3-8 stages with no first or last step; the learner steps round it or taps a stage and is '
      + 'asked what comes next. Use for cycles: the water cycle, life cycles of a butterfly, frog or plant, the seasons, the '
      + 'rock cycle, the phases of the moon, the carbon cycle, day and night. Grades K-8 with read-aloud, science.',
    constraints: 'Needs a true cycle where the last stage leads back to the first. Not for one-way sequences or procedures. Ungraded.',
    affordances: { representation: 'pictorial', reader: 'emerging', answers: ['tap'], role: 'visualize', minutes: 2 },
  },
  {
    id: 'drawer-story-arc',
    description: 'Ungraded plot mountain with one story in five stages (beginning, problem grows, big moment, problem solved, '
      + 'ending); the learner steps up and down and retells each part. Use for story structure and retelling: folk tales and '
      + 'fables, picture books, chapter books, a historical event told as a story. Grades K-6 with read-aloud, literacy.',
    constraints: 'Needs one story with a clear problem and resolution. Ungraded.',
    affordances: { representation: 'pictorial', reader: 'emerging', answers: ['tap'], role: 'visualize', minutes: 3 },
  },
  {
    id: 'drawer-then-and-now',
    description: 'Ungraded comparison of one place or activity at two times, aspect by aspect, viewed one time at a time and '
      + 'then side by side, with unchanged aspects marked. Use for change over time: daily life long ago and today, school '
      + 'then and now, transportation or communication over time, a town before and after the railroad. Grades K-8 with '
      + 'read-aloud, social studies.',
    constraints: 'Needs 3-7 historically accurate aspects, at least one changed. Ungraded.',
    affordances: { representation: 'pictorial', reader: 'emerging', answers: ['tap'], role: 'visualize', minutes: 3 },
  },
  {
    id: 'drawer-perspective-lens',
    description: 'Ungraded view of one event through 2-4 people or groups who were part of it, each answering the same '
      + 'questions; viewpoints open one at a time and then sit side by side. Use for point of view and historical perspective: '
      + 'the Boston Tea Party, a fable told from the other side, a school rule from student and teacher, the Columbian '
      + 'Exchange, westward expansion, a debate in civics. Grades 2-12, social studies and literacy.',
    constraints: 'Needs an event with real, distinct viewpoints. Ungraded.',
    affordances: { representation: 'symbolic', reader: 'developing', answers: ['tap'], role: 'visualize', minutes: 4 },
  },
  {
    id: 'drawer-word-anatomy',
    description: 'Ungraded word split into prefix, root and suffix; the learner switches the parts on and off and sees which '
      + 'combinations are real words and what they mean. Use for morphology: prefixes like un-, re-, dis-; suffixes like '
      + '-able, -ness, -ful; Greek and Latin roots; how affixes change meaning. Grades 2-8, literacy.',
    constraints: 'Needs one root and 1-4 affixes that make at least two real words. Ungraded.',
    affordances: { representation: 'symbolic', reader: 'developing', answers: ['tap'], role: 'visualize', minutes: 2 },
  },
  {
    id: 'drawer-shades-of-meaning',
    description: 'Ungraded scale of 4-7 words for one idea from weakest to strongest, each dropped into the same sentence as a '
      + 'circle grows with it. Use for shades of meaning and word choice: size words, feeling words (annoyed to furious), '
      + 'volume words (whisper to roar), temperature words, verbs like walk, stroll, march. Grades K-5 with read-aloud, '
      + 'literacy and SEL.',
    constraints: 'Needs words that differ in strength, not in kind. Ungraded.',
    affordances: { representation: 'pictorial', reader: 'emerging', answers: ['manipulate'], role: 'visualize', minutes: 2 },
  },
  {
    id: 'drawer-rhythm-grid',
    description: 'Ungraded beat on a grid of steps, one row per sound (stomp, clap, snap, tap, bell), that the learner plays, '
      + 'speeds up or slows down, and edits by tapping squares; the browser makes the sounds. Use for rhythm and pattern: '
      + 'steady beat against rhythm, quarter and eighth notes, the syllables of words and names, repeating patterns. Grades '
      + 'K-6, music (also literacy syllables and math patterns).',
    constraints: 'Needs a short rhythm of 2-8 beats. Ungraded.',
    affordances: { representation: 'concrete', reader: 'emerging', answers: ['tap'], role: 'visualize', minutes: 3 },
  },
];
