import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';
if (!process.env.GEMINI_API_KEY) {
  const match = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
if (!process.env.GEMINI_API_KEY) throw new Error('Missing Gemini key');
const clean = value => String(value).replaceAll(process.env.GEMINI_API_KEY, '[REDACTED]');
const logs = [];
for (const method of ['log', 'warn', 'error', 'info', 'debug']) console[method] = (...args) => logs.push(clean(format(...args)));
const round = process.argv.find(arg => arg.startsWith('--round='))?.split('=')[1] || 'initial';
if (!/^[a-z0-9-]+$/.test(round)) throw new Error('Invalid round name');
const root = process.cwd(), out = resolve(root, 'qa/annotated-example-presentation/fixes', round);
mkdirSync(out, { recursive: true });
const save = (name, value) => writeFileSync(resolve(out, `${name}.json`), clean(JSON.stringify(value, null, 2)));
const server = await vite.createServer({ root, configFile: false, appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false, watch: null }, resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } } });
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { reviewStepContent } = await loader.import('/src/components/lumina/service/annotated-example/content-review.ts');
  const { reviewPredictions } = await loader.import('/src/components/lumina/service/annotated-example/prediction-review.ts');
  const { tablePrimitive } = await loader.import('/src/components/lumina/service/annotated-example/generators/table.ts');
  const { diagramPrimitive } = await loader.import('/src/components/lumina/service/annotated-example/generators/diagram.ts');
  const original = JSON.parse(readFileSync('qa/annotated-example-presentation/grade-3-before.json', 'utf8')).fullData;
  const table = original.steps.find(s => s.content.type === 'table');
  const ctx = { topic: 'Equal groups', gradeContext: 'grade 3', problemStatement: original.problem.statement, solutionStrategy: 'Use the quantities given in the problem.', groundingProse: 'There are 3 bags of 4 apples. Each bag adds 4. The running totals are 4, 8, 12.', priorStepSummaries: [], pedagogicalGoal: 'Track apples added and running total.', seedNotes: 'Show every bag, apples added, and running total.' };
  const fixed = structuredClone(table); fixed.content.rows[1][1] = '$4$';
  const annotations = { steps: '', strategy: '', misconceptions: '', connections: '' };
  const checks = [
    ['recorded-wrong-table', ctx, table, false],
    ['corrected-table', ctx, fixed, true],
    ['wrong-neighbor-table', { ...ctx, problemStatement: 'Four bags each hold three buttons.', groundingProse: 'Each bag adds 3; totals 3, 6, 9, 12.' }, { content: { type: 'table', caption: 'Buttons', headers: ['Bag', 'Added', 'Total'], rows: [['1','3','3'],['2','6','6'],['3','3','9'],['4','3','12']] }, annotations }, false],
    ['valid-comparison-table', { ...ctx, problemStatement: 'Compare a red bag with 3 apples and a blue bag with 7 apples.', groundingProse: 'Red has 3, blue has 7. Blue has 4 more.', pedagogicalGoal: 'Compare two quantities.' }, { content: { type: 'table', caption: 'Apples', headers: ['Bag', 'Apples'], rows: [['Red','3'],['Blue','7']] }, annotations, result: '7-3=4' }, true],
    ['wrong-group-visual', { ...ctx, pedagogicalGoal: 'Show three equal groups of four apples.' }, { content: { type: 'diagram', visual: { kind: 'groups', counts: [4,4], itemLabel: 'apple' }, altText: 'Three bags of four apples', imagePrompt: '', labels: [] }, annotations }, false],
    ['valid-group-visual', { ...ctx, pedagogicalGoal: 'Show three equal groups of four apples.' }, { content: { type: 'diagram', visual: { kind: 'groups', counts: [4,4,4], itemLabel: 'apple' }, altText: 'Three bags of four apples', imagePrompt: '', labels: [] }, annotations }, true],
  ];
  for (const [name, context, candidate, expectedValid] of checks) {
    if (process.argv.includes('--diagrams-only')) continue;
    try {
      const issues = await reviewStepContent(context, candidate);
      const result = { name, context, candidate, expectedValid, issues, pass: (issues.length === 0) === expectedValid };
      save(name, result); process.stdout.write(JSON.stringify({ name, pass: result.pass, issues }) + '\n');
    } catch (error) { save(name, { error: clean(error.message) }); process.stdout.write(`${name}: ERROR\n`); }
  }
  const novel = { problemStatement: 'Solve 2x + 3 = 11.', problemTitle: 'Find x', solutionStrategy: 'Keep both sides equal.', steps: [{ id: 1, title: 'Subtract three', annotations, content: { type: 'algebra', transitions: [{ from: { latex: '2x+3=11' }, to: { latex: '2x=8' }, operation: 'subtract 3 from both sides' }], result: '2x=8' } }] };
  const assignment = { kind: 'transition', stepIndex: 0, transitionIndex: 0, hide: 'to', prompt: 'What equation remains after subtracting 3 from both sides?', acceptableAnswers: ['2x=8'], distractors: ['2x=14','2x=11'], rationale: 'Subtract 3 from each side.' };
  for (const [name, input, expectedSafe] of [['novel-prediction', novel, true], ['leaked-prediction', { ...novel, solutionStrategy: 'Subtract three first to get 2x = 8.' }, false]]) {
    if (process.argv.includes('--diagrams-only')) continue;
    const result = await reviewPredictions(input, [assignment]);
    save(name, { input, assignment, result, expectedSafe, pass: (result.safe.length === 1) === expectedSafe });
    process.stdout.write(JSON.stringify({ name, safe: result.safe.length, expectedSafe }) + '\n');
  }
  if (!process.argv.includes('--diagrams-only')) {
    const badOperation = { ...assignment, hide: 'operation', acceptableAnswers: ['subtract 3 from both sides'], prompt: 'Which inverse operation should come first?', distractors: ['divide both sides by 2', 'add 3 to both sides'], rationale: 'Subtracting first is required; dividing by 2 first violates the order of inverse operations.' };
    const result = await reviewPredictions(novel, [badOperation]);
    save('invalid-operation-rationale', { input: novel, assignment: badOperation, result, expectedSafe: false, pass: result.safe.length === 0 });
    process.stdout.write(JSON.stringify({ name: 'invalid-operation-rationale', safe: result.safe.length, expectedSafe: false }) + '\n');
  }
  const generations = [
    ['table-equal-groups', tablePrimitive, ctx],
    ['table-varying-increments', tablePrimitive, { ...ctx, problemStatement: 'A child finds 2 shells, then 5 shells, then 1 shell. Show how the total grows.', groundingProse: 'The added amounts are 2, 5, 1; the running totals are 2, 7, 8.', seedNotes: 'Show each find, added shells and total.' }],
    ['table-sign-control', tablePrimitive, { ...ctx, gradeContext: 'grade 10', problemStatement: 'Evaluate x squared minus one at -2, 0 and 2.', groundingProse: 'For x=-2, x^2-1=3; for x=0, -1; for x=2, 3.', pedagogicalGoal: 'Compare function values.', seedNotes: 'Show x and x squared minus one in a three-row table.' }],
    ['diagram-groups', diagramPrimitive, { ...ctx, pedagogicalGoal: 'See equal groups.', seedNotes: 'Draw all three groups of four.' }],
    ['diagram-number-line', diagramPrimitive, { ...ctx, gradeContext: 'grade 5', problemStatement: 'Show 0.4 plus 0.3 on a number line.', groundingProse: 'Start at zero, jump four tenths to 0.4, then three tenths to 0.7. Scale zero to one.', pedagogicalGoal: 'Combine decimal distances.', seedNotes: 'Draw both jumps on a scale marked in tenths.' }],
    ['diagram-fraction', diagramPrimitive, { ...ctx, gradeContext: 'grade 4', problemStatement: 'Show four eighths as half of a whole.', groundingProse: 'Divide one bar into eight equal pieces, shade four pieces. Four eighths equals one half.', pedagogicalGoal: 'See equivalent fractions.', seedNotes: 'Use a fraction bar.' }],
    ['diagram-geometry', diagramPrimitive, { ...ctx, gradeContext: 'grade 7', problemStatement: 'Show the perpendicular legs of a right triangle with legs 3 cm and 4 cm.', groundingProse: 'The 3 cm and 4 cm legs meet at a right angle. The hypotenuse is 5 cm.', pedagogicalGoal: 'Recognize perpendicular legs.', seedNotes: 'Draw a right triangle and label the three lengths.' }],
  ];
  for (let index = 0; index < generations.length; index += 2) await Promise.all(generations.slice(index, index + 2).map(async ([name, primitive, context]) => {
    if (process.argv.includes('--reviews-only') || (process.argv.includes('--diagrams-only') && !name.startsWith('diagram-'))) return;
    try {
      const generated = await primitive.generate({ ...context, topic: context.problemStatement });
      save(name, { context, generated });
      process.stdout.write(JSON.stringify({ name, status: 'generated', attempts: generated.generationReview?.attempts }) + '\n');
    } catch (error) { save(name, { context, error: clean(error.message) }); process.stdout.write(`${name}: ERROR\n`); }
  }));
} finally {
  writeFileSync(resolve(out, 'review-generation.log'), logs.join('\n'));
  await server.close();
}
