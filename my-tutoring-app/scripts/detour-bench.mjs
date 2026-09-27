// LA-15 D0: detour pedagogy bench.
// For each stuck-learner scenario, two arms pick and generate a detour activity:
//   sandbox  — today's request_activity path: the tutor model picks primitiveId + mode
//              from the live-adapter enum, and the route generates at 'easy'.
//   resolver — resolveDetour(): catalog-wide pick from the tutor's stated need,
//              then resolveLessonEvalModes, then the same generator.
// A judge (gemini-flash-latest, blind to arm) scores each pick + generated content.
// Usage: node scripts/detour-bench.mjs --run [--only id,id] [--reps N]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = process.cwd();
const argv = process.argv.slice(2);
const arg = name => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const out = resolve(root, arg('--out') ?? `qa/tutor-reports/detour-bench-${new Date().toISOString().slice(0, 10)}`);
const reps = Number(arg('--reps') ?? 1);
const arms = (arg('--arms') ?? 'sandbox,resolver,demo').split(',');

const SCENARIOS = [
  { id: 'g4-fraction-add', grade: '4', gradeLevel: 'elementary', topic: 'Adding fractions with like denominators',
    objectiveText: 'Add fractions with like denominators', parent: 'fraction-bar',
    need: { obstacle: 'adds both the numerators and the denominators', evidence: 'For 2/5 + 1/5 the student answered 3/10.',
      purpose: 'see that the size of the parts stays the same when you add fifths' } },
  { id: 'g2-regroup', grade: '2', gradeLevel: 'elementary', topic: 'Two-digit addition with regrouping',
    objectiveText: 'Add two-digit numbers with regrouping', parent: 'regrouping-workbench',
    need: { obstacle: 'writes the whole ones sum in the ones place instead of making a ten', evidence: 'For 37 + 26 the student wrote 513.',
      purpose: 'see that 13 ones is 1 ten and 3 ones' } },
  { id: 'g1-subtract-hops', grade: '1', gradeLevel: 'elementary', topic: 'Subtraction within 20 on a number line',
    objectiveText: 'Subtract within 20 by counting back', parent: 'number-line',
    need: { obstacle: 'counts the starting number as the first hop when counting back', evidence: '12 - 3: "12, 11, 10... it is 10."',
      purpose: 'practise that each hop is a move, so counting starts on the next number' } },
  { id: 'g3-mult-groups', grade: '3', gradeLevel: 'elementary', topic: 'Multiplication as equal groups',
    objectiveText: 'Interpret products of whole numbers as equal groups', parent: 'array-grid',
    need: { obstacle: 'adds the two factors instead of multiplying', evidence: 'Said 4 x 3 is 7.',
      purpose: 'see 4 x 3 as 4 groups of 3 things' } },
  { id: 'k-count-tracking', grade: 'K', gradeLevel: 'kindergarten', topic: 'Counting objects to 10',
    objectiveText: 'Count to tell how many objects, up to 10', parent: 'counting-board',
    need: { obstacle: 'counts some objects twice and skips others', evidence: 'Counted 8 bears as 10, touching the same bear twice.',
      purpose: 'practise one number for each object, keeping track of which are counted' } },
  { id: 'g1-cvc-blend', grade: '1', gradeLevel: 'elementary', topic: 'Reading short-vowel CVC words',
    objectiveText: 'Decode regularly spelled one-syllable words', parent: 'decodable-reader',
    need: { obstacle: 'says each letter sound separately but cannot blend them into a word', evidence: 'Read "mat" as "/m/ /a/ /t/" and stopped.',
      purpose: 'practise blending three sounds into one word' } },
  { id: 'g2-main-idea', grade: '2', gradeLevel: 'elementary', topic: 'Finding the main idea',
    objectiveText: 'Identify the main topic of a multi-paragraph text', parent: 'passage-studio',
    need: { obstacle: 'picks an interesting detail as the main idea', evidence: 'For a passage about how bees help plants, said the main idea is "bees are yellow".',
      purpose: 'tell a main idea apart from a detail that supports it' } },
  { id: 'g5-particles', grade: '5', gradeLevel: 'elementary', topic: 'States of matter and particles',
    objectiveText: 'Describe how particles move in solids, liquids and gases', parent: 'states-of-matter',
    need: { obstacle: 'believes particles in a solid do not move at all', evidence: '"In ice the tiny bits are frozen still."',
      purpose: 'see that particles in a solid vibrate in place' } },
  { id: 'g3-clock-minutes', grade: '3', gradeLevel: 'elementary', topic: 'Telling time to the nearest 5 minutes',
    objectiveText: 'Tell and write time to the nearest five minutes', parent: 'analog-clock',
    need: { obstacle: 'reads the number the minute hand points to as the minutes', evidence: 'Minute hand on the 4: "it is 3:04".',
      purpose: 'practise that each number on the clock means 5 more minutes' } },
  { id: 'g4-compare-digits', grade: '4', gradeLevel: 'elementary', topic: 'Comparing multi-digit numbers',
    objectiveText: 'Compare two multi-digit numbers using place value', parent: 'place-value-chart',
    need: { obstacle: 'thinks the number with bigger digits is larger regardless of place', evidence: 'Said 3,999 is more than 4,001 "because it has nines".',
      purpose: 'compare the largest place first' } },
];

if (!argv.includes('--run')) { console.log(JSON.stringify({ scenarios: SCENARIOS.map(s => s.id), reps, out })); process.exit(0); }
if (!process.env.GEMINI_API_KEY) {
  const match = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
if (!process.env.GEMINI_API_KEY) throw new Error('Missing Gemini key');
mkdirSync(join(out, 'runs'), { recursive: true });

const only = arg('--only')?.split(',');
const scenarios = only ? SCENARIOS.filter(s => only.includes(s.id)) : SCENARIOS;
const quiet = {};
for (const name of ['log', 'warn', 'debug', 'info']) { quiet[name] = console[name]; console[name] = () => {}; }
const say = (...a) => quiet.log(...a);

const vite = await import('vite');
const server = await vite.createServer({ configFile: false, root, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } } });

try {
  const runner = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const [{ ai }, { Type, ThinkingLevel }, service, { resolveDetour }, { buildLiveActivitySpec }, { LIVE_ADAPTERS }, catalog, { composeDemonstration }] = await Promise.all([
    runner.import('/src/components/lumina/service/geminiClient.ts'),
    import('@google/genai'),
    runner.import('/src/components/lumina/service/geminiService.ts'),
    runner.import('/src/components/lumina/service/manifest/resolveDetour.ts'),
    runner.import('/src/components/lumina/components/live-activity/liveActivitySpec.ts'),
    runner.import('/src/components/lumina/components/live-activity/activityContract.ts'),
    runner.import('/src/components/lumina/service/manifest/catalog/index.ts'),
    runner.import('/src/components/lumina/service/manifest/composeDemonstration.ts'),
  ]);
  const describe = id => id?.startsWith('demo:')
    ? 'A short worked demonstration: a sequence of drawn frames with captions, shown to the student while the tutor narrates. Ungraded.'
    : catalog.UNIVERSAL_CATALOG.find(c => c.id === id)?.description ?? '';
  const spec = buildLiveActivitySpec(Object.keys(LIVE_ADAPTERS));
  const json = async (contents, schema, model = 'gemini-flash-latest') => {
    if (argv.includes('--debug')) writeFileSync(join(out, `schema-${Date.now()}.json`), JSON.stringify({ schema, contents }, null, 2));
    const r = await ai.models.generateContent({ model, contents,
      config: { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }, responseMimeType: 'application/json', responseSchema: schema, temperature: 0.2 } });
    return JSON.parse(r.text ?? '{}');
  };

  // Sandbox arm: the request_activity declaration and "Available activities" the tutor sees today.
  async function sandboxPick(s) {
    const schema = { type: Type.OBJECT, required: ['primitiveId', 'mode', 'topic', 'intent'], properties: {
      primitiveId: { type: Type.STRING, enum: spec.activities.map(a => a.primitiveId) },
      // The full mode list (255 keys) exceeds Gemini's enum budget as a response schema; validated below instead.
      mode: { type: Type.STRING, description: 'One of the modes listed for the chosen activity.' },
      topic: { type: Type.STRING, description: "The learner's specific topic." },
      intent: { type: Type.STRING, description: 'Teaching objective, operation and numeric constraints.' } } };
    const prompt = `You are a live tutor. The student is on "${s.parent}" in a Grade ${s.grade} lesson: ${s.objectiveText}.
They are stuck: ${s.need.obstacle}. Evidence: ${s.need.evidence}. You want to: ${s.need.purpose}.
Call request_activity to generate an advertised activity. Use its supported mode and teaching owner from Available activities.
Available activities: ${JSON.stringify(spec.activities)}
Return the request_activity arguments.`;
    const args = await json(prompt, schema);
    const modes = LIVE_ADAPTERS[args.primitiveId]?.modes ?? [];
    return { componentId: args.primitiveId, modeValid: modes.includes(args.mode), rationale: '',
      item: { componentId: args.primitiveId, instanceId: `sandbox-${s.id}`, title: args.primitiveId, intent: args.intent,
        config: { intent: args.intent, targetEvalMode: args.mode, difficulty: 'easy', objectiveGrade: s.grade } }, topic: args.topic };
  }
  async function resolverPick(s) {
    const r = await resolveDetour({ componentId: s.parent, objectiveText: s.objectiveText, grade: s.grade, topic: s.topic,
      gradeLevel: s.gradeLevel, objectiveId: s.id }, s.need);
    return { componentId: r.item.componentId, modeKind: r.modeKind, shortlist: r.shortlist, rationale: r.rationale, item: r.item, topic: s.topic };
  }

  // Demo arm: a composed demonstration; code builds the frames, so there is no generator call.
  async function demoPick(s) {
    const r = await composeDemonstration({ componentId: s.parent, objectiveText: s.objectiveText, grade: s.grade, topic: s.topic,
      gradeLevel: s.gradeLevel, objectiveId: s.id }, s.need);
    if (r.kind === 'none') return { none: true, rationale: r.rationale };
    const d = r.demonstration;
    return { componentId: `demo:${d.piece}/${d.operation}`, rationale: r.rationale, topic: s.topic, script: r.script,
      item: { intent: `Demonstrate ${d.operation} on the ${d.piece} with values ${JSON.stringify(r.script.values)}${r.script.denominator > 1 ? ` (unit 1/${r.script.denominator})` : ''}. Tutor points at: ${d.focus}` },
      content: { title: d.title, frames: d.frames } };
  }

  const judgeSchema = { type: Type.OBJECT, required: ['reasoning', 'targetsObstacle', 'easierOrPrerequisite', 'differentRepresentation', 'inScope', 'contentUsable', 'leaksCurrentAnswer', 'verdict'],
    propertyOrdering: ['reasoning', 'targetsObstacle', 'easierOrPrerequisite', 'differentRepresentation', 'inScope', 'contentUsable', 'leaksCurrentAnswer', 'verdict'],
    properties: {
      reasoning: { type: Type.STRING },
      targetsObstacle: { type: Type.INTEGER, description: '0 = does not touch the obstacle, 1 = related topic only, 2 = the activity makes the specific missing step visible or practised' },
      easierOrPrerequisite: { type: Type.INTEGER, description: '0 = as hard or harder than the current activity, 1 = similar, 2 = clearly simpler or the prerequisite step' },
      differentRepresentation: { type: Type.INTEGER, description: '0 = same representation as the current activity, 1 = slight change, 2 = a genuinely different view of the idea' },
      inScope: { type: Type.INTEGER, description: '0 = off topic or wrong grade, 1 = drifts, 2 = inside the objective and grade' },
      contentUsable: { type: Type.INTEGER, description: '0 = broken/empty/wrong, 1 = usable with flaws, 2 = correct and age-appropriate' },
      leaksCurrentAnswer: { type: Type.BOOLEAN, description: "true if the content contains the student's current problem with its answer" },
      verdict: { type: Type.STRING, description: 'one sentence: would a teacher use this detour for this student right now?' } } };
  async function judge(s, pick, content) {
    const body = JSON.stringify(content ?? null).slice(0, 9000);
    return json(`You are an experienced elementary teacher reviewing a short teaching detour chosen for a stuck student.
LESSON: ${s.topic} (Grade ${s.grade}). OBJECTIVE: ${s.objectiveText}.
CURRENT ACTIVITY: ${s.parent} — ${describe(s.parent)}
STUDENT OBSTACLE: ${s.need.obstacle}. EVIDENCE: ${s.need.evidence}. TUTOR'S PURPOSE: ${s.need.purpose}.

DETOUR ACTIVITY CHOSEN: ${pick.componentId} — ${describe(pick.componentId)}
GENERATOR INSTRUCTIONS: ${pick.item.intent}
GENERATED CONTENT (JSON, may be truncated):
${body}

Score strictly. The detour succeeds only if a student with THIS obstacle would, by doing this activity, see or practise the specific missing step.`, judgeSchema);
  }

  async function arm(s, name, pickFn) {
    const t0 = Date.now();
    const rec = { scenario: s.id, arm: name };
    try {
      const pick = await pickFn(s);
      if (pick.none) { Object.assign(rec, { none: true, rationale: pick.rationale, pickMs: Date.now() - t0 }); say(`${s.id} ${name}: NONE (${pick.rationale})`); return rec; }
      Object.assign(rec, { componentId: pick.componentId, shortlist: pick.shortlist, modeKind: pick.modeKind, modeValid: pick.modeValid, rationale: pick.rationale,
        targetEvalMode: pick.item.config?.targetEvalMode, script: pick.script, intent: pick.item.intent, pickMs: Date.now() - t0 });
      const t1 = Date.now();
      if (pick.content) rec.content = pick.content;
      else try { rec.content = await service.generateComponentContent(pick.item, pick.topic, s.gradeLevel); }
      catch (e) { rec.generationError = String(e?.message ?? e); }
      rec.generateMs = Date.now() - t1;
      rec.judgement = await judge(s, pick, rec.content?.data ?? rec.content);
    } catch (e) { rec.error = String(e?.message ?? e); }
    say(`${s.id} ${name}: ${rec.componentId ?? 'ERR'} ${rec.targetEvalMode ?? ''} ${rec.judgement ? JSON.stringify({ t: rec.judgement.targetsObstacle, e: rec.judgement.easierOrPrerequisite, r: rec.judgement.differentRepresentation, s: rec.judgement.inScope, u: rec.judgement.contentUsable, leak: rec.judgement.leaksCurrentAnswer }) : rec.error ?? ''}`);
    return rec;
  }

  const jobs = [];
  for (let rep = 0; rep < reps; rep++) for (const s of scenarios)
    for (const [name, fn] of [['sandbox', sandboxPick], ['resolver', resolverPick], ['demo', demoPick]].filter(([n]) => arms.includes(n))) jobs.push(() => arm(s, name, fn).then(r => ({ ...r, rep })));
  const results = [];
  const pool = Array.from({ length: 4 }, async () => { while (jobs.length) results.push(await jobs.shift()()); });
  await Promise.all(pool);

  for (const r of results) writeFileSync(join(out, 'runs', `${r.scenario}-${r.arm}-${r.rep}.json`), JSON.stringify(r, null, 2));
  const keys = ['targetsObstacle', 'easierOrPrerequisite', 'differentRepresentation', 'inScope', 'contentUsable'];
  const summary = {};
  // demo+fallback: the demonstration where one was composed, else the resolver's pick for that scenario.
  if (arms.includes('demo') && arms.includes('resolver')) for (const r of results.filter(r => r.arm === 'demo')) {
    const src = r.none ? results.find(x => x.arm === 'resolver' && x.scenario === r.scenario && x.rep === r.rep) : r;
    if (src) results.push({ ...src, arm: 'demo+fallback', fallback: !!r.none, pickMs: (r.none ? r.pickMs : 0) + (src.pickMs ?? 0) });
  }
  for (const name of [...arms, ...(arms.includes('demo') && arms.includes('resolver') ? ['demo+fallback'] : [])]) {
    const rs = results.filter(r => r.arm === name && r.judgement);
    const ms = results.filter(r => r.arm === name && r.pickMs).map(r => r.pickMs + (r.generateMs ?? 0)).sort((a, b) => a - b);
    summary[name] = { n: rs.length, medianReadyMs: ms[Math.floor(ms.length / 2)] ?? null, maxReadyMs: ms.at(-1) ?? null, errors: results.filter(r => r.arm === name && (r.error || r.generationError)).length,
      ...Object.fromEntries(keys.map(k => [k, +(rs.reduce((a, r) => a + r.judgement[k], 0) / Math.max(rs.length, 1)).toFixed(2)])),
      leaks: rs.filter(r => r.judgement.leaksCurrentAnswer).length,
      nonSingleMode: results.filter(r => r.arm === name && (r.modeKind === 'blend' || r.modeKind === 'mixed')).length,
      none: results.filter(r => r.arm === name && r.none).length };
  }
  const rows = results.filter(r => r.arm !== 'demo+fallback').sort((a, b) => a.scenario.localeCompare(b.scenario) || a.arm.localeCompare(b.arm)).map(r =>
    `| ${r.scenario} | ${r.arm} | ${r.componentId ?? 'ERR'} | ${r.targetEvalMode ?? ''} | ${r.judgement ? keys.map(k => r.judgement[k]).join('/') : '—'} | ${r.judgement?.leaksCurrentAnswer ? 'LEAK' : ''} | ${(r.judgement?.verdict ?? r.error ?? r.generationError ?? '').replace(/\|/g, '/')} |`);
  writeFileSync(join(out, 'summary.json'), JSON.stringify(summary, null, 2));
  writeFileSync(join(out, 'results.md'), `# Detour bench (LA-15 D0) — raw results\n\nScores: obstacle/easier/representation/scope/usable, each 0-2.\n\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\`\n\n| scenario | arm | pick | mode | scores | leak | judge verdict |\n|---|---|---|---|---|---|---|\n${rows.join('\n')}\n`);
  say(JSON.stringify(summary, null, 2));
} finally {
  await server.close();
}
