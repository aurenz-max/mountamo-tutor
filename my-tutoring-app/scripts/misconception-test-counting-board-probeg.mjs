// /misconception-test Probe G for counting-board (consumer architecture).
// Enters at resolveGenerationContext -> generateCountingBoard (3a-consumer),
// the planner + selector + telemetry segment this probe owns.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.env.GEMINI_API_KEY) {
  const m = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (m) process.env.GEMINI_API_KEY = m[1].trim().replace(/^["']|["']$/g, '');
}
if (!process.env.GEMINI_API_KEY) throw new Error('Missing Gemini key');
const clean = (v) => String(v).replaceAll(process.env.GEMINI_API_KEY, '[REDACTED]');
const logs = [];
for (const m of ['log', 'warn', 'error', 'info', 'debug']) console[m] = (...a) => logs.push(clean(format(...a)));

const root = process.cwd();
const out = resolve(root, 'qa/misconception');
mkdirSync(out, { recursive: true });
const draws = Number(process.argv.find((a) => a.startsWith('--draws='))?.slice(8) ?? 2);

const server = await vite.createServer({
  root, configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});

const results = { takeAway: [], countOn: [], negativeControls: [] };
try {
  const L = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const S = '/src/components/lumina/service';
  const { resolveGenerationContext } = await L.import(S + '/generation/resolveGenerationContext.ts');
  const { generateCountingBoard } = await L.import(S + '/math/gemini-counting-board.ts');
  const { compiledSameStartContrast, compiledOneMoreCountOn } = await L.import(S + '/math/countingBoardRemediation.ts');

  // Our own Probe D diagnoses. TAKE_AWAY_FOCUS / COUNT_ON_FOCUS match what the shipped move
  // (contrast_same_start_different_change / count_on_exactly_one_more) actually targets: reporting
  // the START, not the change or answer. TAKE_AWAY_FOCUS_OFFTARGET / COUNT_ON_FOCUS_OFFTARGET are
  // real, GENERATIVE Probe D diagnoses for a DIFFERENT wrong rule the move does not address —
  // semantic negative controls (same primitive, same mode, wrong observation).
  const TAKE_AWAY_FOCUS = 'The student interprets the question about how many are left as asking for the initial total quantity on the board, so they state the starting amount instead of counting the items that remain.';
  const COUNT_ON_FOCUS = 'The student treats the stated hidden starting quantity as the total amount rather than counting on the additional visible objects.';
  const TAKE_AWAY_FOCUS_OFFTARGET = 'The student interprets the question asking how many are left as asking for the count of items that were taken away, so they report the number removed.';
  const COUNT_ON_FOCUS_OFFTARGET = 'The student counts only the visible items on the board, ignoring the hidden starting amount when asked for the total.';
  const RECOUNT_MOVED_FOCUS = 'The student treats the prompt asking for the total after objects are moved as an instruction to continue counting, producing the next word in the number sequence.';

  const CROSS_FAMILY = 'The student treats the bottom number of a fraction as the numerator and the top number as the denominator, subsequently shading the count indicated by the bottom number.';
  const UNRELATED = 'The student reliably reads three-letter words with short vowel sounds and blends onset and rime without prompting.';
  const UNRELIABLE = 'The evidence is contradictory: some attempts suggest the student names a number one too high, others one too low, with no consistent rule across boards.';
  const STRENGTH = 'The student consistently counts sets using correct one-to-one correspondence and self-corrects without help.';

  const run = async (label, mode, gradeText, objectiveGrade, observations) => {
    const item = {
      componentId: 'counting-board', instanceId: 'pg-cb-' + label + '-' + Date.now(),
      config: { targetEvalMode: mode, difficulty: 'medium', objectiveGrade,
        ...(observations ? { learningObservations: observations } : {}) },
    };
    const ctx = resolveGenerationContext(item, 'counting to twenty', gradeText, objectiveGrade);
    const t = Date.now();
    try {
      const d = await generateCountingBoard(ctx);
      const oracle = mode === 'count_on' ? compiledOneMoreCountOn(d.challenges) : compiledSameStartContrast(d.challenges);
      return {
        label, ms: Date.now() - t,
        learningAdaptation: d.learningAdaptation ?? null,
        oracle,
        n: d.challenges.length,
        types: [...new Set(d.challenges.map((c) => c.type))],
        items: d.challenges.map((c) => mode === 'count_on'
          ? `start=${c.startFrom} count=${c.count} target=${c.targetAnswer}`
          : `count=${c.count} changeBy=${c.changeBy} target=${c.targetAnswer}`),
        instructions: d.challenges.map((c) => c.instruction),
        hints: d.challenges.map((c) => c.hint),
        narrations: d.challenges.map((c) => c.narration),
      };
    } catch (e) { return { label, ms: Date.now() - t, error: clean(e && e.message ? e.message : e) }; }
  };

  // ── take_away: null baseline + remediation + negative controls ──
  for (let i = 0; i < draws; i++) results.takeAway.push(await run('ta-null' + (i + 1), 'take_away', 'Kindergarten', 'K', null));
  for (let i = 0; i < draws; i++) results.takeAway.push(await run('ta-rem' + (i + 1), 'take_away', 'Kindergarten', 'K', [{ id: 'obs-ta', summary: TAKE_AWAY_FOCUS }]));

  // ── count_on: null baseline + remediation ──
  for (let i = 0; i < draws; i++) results.countOn.push(await run('co-null' + (i + 1), 'count_on', 'Grade 1', '1', null));
  for (let i = 0; i < draws; i++) results.countOn.push(await run('co-rem' + (i + 1), 'count_on', 'Grade 1', '1', [{ id: 'obs-co', summary: COUNT_ON_FOCUS }]));

  // ── Negative controls (take_away generating; each observation must NOT move content) ──
  const controls = [
    ['own-positive-control', TAKE_AWAY_FOCUS],
    ['same-primitive-offtarget-signature', TAKE_AWAY_FOCUS_OFFTARGET],
    ['recount-moved-same-primitive-no-capability', RECOUNT_MOVED_FOCUS],
    ['cross-family-fraction-bar', CROSS_FAMILY],
    ['unrelated-domain', UNRELATED],
    ['unreliable-evidence', UNRELIABLE],
    ['strength-observation', STRENGTH],
  ];
  for (const [label, focus] of controls) {
    for (let i = 0; i < 2; i++) {
      results.negativeControls.push({ control: label, mode: 'take_away', ...(await run('ctrl-' + label + i, 'take_away', 'Kindergarten', 'K', [{ id: 'obs-ctrl', summary: focus }])) });
    }
  }
  // count_on off-target: a real, generative diagnosis for a DIFFERENT count_on wrong rule than the shipped move targets.
  for (let i = 0; i < 2; i++) {
    results.negativeControls.push({ control: 'count-on-offtarget-signature', mode: 'count_on', ...(await run('ctrl-co-offtarget' + i, 'count_on', 'Grade 1', '1', [{ id: 'obs-ctrl', summary: COUNT_ON_FOCUS_OFFTARGET }])) });
  }

  writeFileSync(resolve(out, 'probe-g-counting-board.json'), JSON.stringify(results, null, 2));
} finally {
  await server.close();
  writeFileSync(resolve(out, 'probe-g-counting-board-logs.txt'), logs.join('\n'));
}
process.stdout.write('done\n');
process.exit(0);
