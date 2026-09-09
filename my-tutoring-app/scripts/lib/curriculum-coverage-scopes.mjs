// Reviewed curriculum-coverage scopes. Each scope is a separately authored review:
// decisions, probes and checks never inherit across scopes. `la-k` is the original
// pilot and keeps its output directory, probe list and source-hash list verbatim so its
// frozen review basis and cached evidence stay byte-stable.
const CATALOG = 'src/components/lumina/service/manifest/catalog';
const MATH_GEN = 'src/components/lumina/service/math';
const MATH_UI = 'src/components/lumina/primitives/visual-primitives/math';
const math = (gen, ui) => [`${MATH_GEN}/gemini-${gen}.ts`, `${MATH_UI}/${ui}.tsx`];
/** Shared by ten-frame and number-bond only — the K.NBT.1 teen-window resolver. */
const TEEN_WINDOW = `${MATH_GEN}/teenWindow.ts`;

export const SCOPES = {
  'la-k': {
    id: 'la-k', subject: 'LANGUAGE_ARTS', grade: 'K', gradeLevel: 'kindergarten',
    dir: 'qa/curriculum-coverage', title: 'K Language Arts',
    review: 'python scripts/curriculum-coverage-review.py',
    checks: './lib/curriculum-coverage-checks/la-k.mjs',
    // Six pairs, two draws each; the LA pilot hashed one fixed source list into every draw.
    cases: [
      ['LA005-01-H', 'picture-vocabulary', 'gradable_scale'],
      ['LA005-03-A', 'picture-vocabulary', 'association'],
      ['LA005-02-I', 'di-spoken-practice', 'say_answer'],
      ['LA004-06-E', 'di-spoken-practice', 'say_answer'],
      ['LA004-01-A', 'word-sorter', 'binary_sort'],
      ['LA005-02-H', 'picture-vocabulary', 'sentence_frame'],
    ],
    commonSources: [
      'src/app/api/lumina/eval-test/route.ts',
      `${CATALOG}/literacy.ts`,
      `${CATALOG}/di.ts`,
      'src/components/lumina/service/literacy/gemini-picture-vocabulary.ts',
      'src/components/lumina/service/literacy/gemini-word-sorter.ts',
      'src/components/lumina/service/direct-instruction/gemini-di-spoken-practice.ts',
      'src/components/lumina/primitives/visual-primitives/literacy/PictureVocabulary.tsx',
      'src/components/lumina/primitives/visual-primitives/literacy/WordSorter.tsx',
      'src/components/lumina/primitives/visual-primitives/direct-instruction/DiSpokenPractice.tsx',
    ],
    sources: {},
    probeSummary: 'Six pairs have two saved generation draws each; live interaction remains untested.',
    // The pilot froze every catalog file, so any subject's catalog edit stales its review.
    catalogFiles: null,
    verification: { tests: 183, suites: 6, note: 'Generator, script-contract and mocked render tests passed. Live voice not driven.' },
  },
  'math-k': {
    id: 'math-k', subject: 'MATHEMATICS', grade: 'K', gradeLevel: 'kindergarten',
    dir: 'qa/curriculum-coverage/math-k', title: 'K Mathematics',
    review: 'python scripts/curriculum-coverage-review-math-k.py',
    checks: './lib/curriculum-coverage-checks/math-k.mjs',
    // Twenty pairs chosen from the review's own "probe" next actions: every K math family
    // gets at least one draw, and every suspected cap-below-objective gets the exact text.
    cases: [
      ['COUNT001-01-C', 'counting-board', 'count'],
      ['COUNT001-01-E', 'hundreds-chart', 'highlight_sequence'],
      ['COUNT001-01-H', 'number-sequencer', 'fill_missing'],
      ['COUNT001-01-I', 'number-sequencer', 'count_from'],
      ['COUNT001-03-A', 'comparison-builder', 'compare_groups'],
      ['COUNT001-03-E', 'comparison-builder', 'compare_numbers'],
      ['COUNT001-04-D', 'ordinal-line', 'identify'],
      ['COUNT001-05-B', 'ten-frame', 'build_teen'],
      ['COUNT001-05-D', 'number-bond', 'ten_and_ones'],
      ['COUNT001-05-E', 'ten-frame', 'decompose_teen'],
      ['OPS001-01-E', 'addition-subtraction-scene', 'solve_story'],
      ['OPS001-02-F', 'math-fact-fluency', 'missing_number'],
      ['GEOM001-01-D', '3d-shape-explorer', 'identify_3d'],
      ['PTRN001-01-D', 'pattern-builder', 'create'],
      ['MEAS001-01-A', 'compare-objects', 'identify_attribute'],
      ['MEAS001-02-B', 'comparison-builder', 'compare_groups'],
      ['MEAS001-03-E', 'bar-model', 'compare_bars'],
      ['MEAS001-06-B', 'sorting-station', 'sort_one'],
      ['PTRN001-03-C', 'time-sequencer', 'sequence-3'],
      ['TIME001-02-B', 'calendar-explorer', 'identify'],
      ['TIME001-03-C', 'analog-clock', 'read'],
      // Slice-7 modes, one pair per shipped family (added 2026-09-09).
      ['MEAS001-03-D', 'bar-model', 'build_one_to_one'],
      ['COUNT001-02-D', 'counting-board', 'give_me_n'],
      ['MEAS001-04-D', 'measure-lab', 'balance_predict'],
      ['TIME001-03-A', 'analog-clock', 'hand_name'],
      ['MEAS001-04-B', 'length-lab', 'estimate_then_tile'],
    ],
    // The dispatcher route is the only file every draw shares. Catalog provenance is the
    // primitive's OWN entry (catalogEntryHashing), not the catalog file: a sibling primitive's
    // birth in math.ts cannot change this primitive's generation.
    commonSources: ['src/app/api/lumina/eval-test/route.ts'],
    catalogEntryHashing: true,
    // Per-primitive sources: a generator/component edit stales only that primitive's draws.
    sources: {
      'counting-board': math('counting-board', 'CountingBoard'),
      'hundreds-chart': math('hundreds-chart', 'HundredsChart'),
      'number-sequencer': math('number-sequencer', 'NumberSequencer'),
      'comparison-builder': math('comparison-builder', 'ComparisonBuilder'),
      'ordinal-line': math('ordinal-line', 'OrdinalLine'),
      // `teenWindow.ts` is listed on BOTH because both teen generators read it —
      // per-primitive rather than common, so a change to the window resolver
      // stales exactly the two primitives that depend on it and no others.
      'ten-frame': [...math('ten-frame', 'TenFrame'), TEEN_WINDOW],
      'number-bond': [...math('number-bond', 'NumberBond'), TEEN_WINDOW],
      'addition-subtraction-scene': math('addition-subtraction-scene', 'AdditionSubtractionScene'),
      'math-fact-fluency': math('math-fact-fluency', 'MathFactFluency'),
      '3d-shape-explorer': math('3d-shape-explorer', 'ThreeDShapeExplorer'),
      'pattern-builder': math('pattern-builder', 'PatternBuilder'),
      'compare-objects': math('compare-objects', 'CompareObjects'),
      'bar-model': math('bar-model', 'BarModel'),
      'sorting-station': math('sorting-station', 'SortingStation'),
      'time-sequencer': math('time-sequencer', 'TimeSequencer'),
      'calendar-explorer': ['src/components/lumina/service/calendar/gemini-calendar-explorer.ts', 'src/components/lumina/primitives/visual-primitives/calendar/CalendarExplorer.tsx'],
      'analog-clock': math('analog-clock', 'AnalogClock'),
      'measure-lab': math('measure-lab', 'MeasureLab'),
      'length-lab': math('length-lab', 'LengthLab'),
    },
    probeSummary: 'Twenty-six pairs have two saved generation draws each (all redrawn 2026-09-09); live tutor interaction remains untested.',
    // Only the catalog files this review's edges can cite are frozen: a literacy-only edit
    // (another subject's birth) cannot change a K Math decision. The review asserts every edge
    // source is in this list, so the scoping is checked, not assumed.
    catalogFiles: ['math.ts', 'di.ts', 'calendar.ts', 'assessment.ts', 'core.ts', 'index.ts'].map(f => `${CATALOG}/${f}`),
  },
};

export function scopeFromArgv(argv = process.argv.slice(2)) {
  const i = argv.indexOf('--scope');
  const id = i >= 0 ? argv[i + 1] : (process.env.COVERAGE_SCOPE || 'la-k');
  const scope = SCOPES[id];
  if (!scope) throw new Error(`Unknown coverage scope "${id}". Known: ${Object.keys(SCOPES).join(', ')}`);
  return scope;
}
export const curriculumUrl = s => `http://127.0.0.1:8000/api/curriculum/curriculum/${s.subject}?grade=${s.grade}`;
export const sourcesFor = (scope, primitive) => [...scope.commonSources, ...(scope.sources[primitive] ?? [])];
