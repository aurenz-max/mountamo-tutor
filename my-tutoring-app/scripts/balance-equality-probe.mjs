// Real production generation plus deterministic model/cue verification.
// Does not submit student data or simulate a live microphone session.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.argv.includes('--run')) {
  console.log('Pass --run to generate all six weight modes at easy, medium and hard.');
  process.exit(0);
}
if (!process.env.GEMINI_API_KEY) {
  const match = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
if (!process.env.GEMINI_API_KEY) throw new Error('Missing Gemini key');
const clean = (value) => String(value).replaceAll(process.env.GEMINI_API_KEY, '[REDACTED]');
const logs = [];
for (const method of ['log', 'warn', 'error', 'info', 'debug']) console[method] = (...args) => logs.push(clean(format(...args)));
const root = process.cwd();
const out = resolve(root, 'qa/balance-workshop');
mkdirSync(out, { recursive: true });
const server = await vite.createServer({ root, configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateBalanceScale } = await loader.import('/src/components/lumina/service/math/gemini-balance-scale.ts');
  const model = await loader.import('/src/components/lumina/primitives/visual-primitives/math/balanceEqualityModel.ts');
  const script = await loader.import('/src/components/lumina/primitives/visual-primitives/math/balanceEqualityScript.ts');
  const { validateJudgedScriptPack } = await loader.import('/src/components/lumina/hooks/judgedScriptContract.ts');
  const workshop = await loader.import('/src/components/lumina/primitives/visual-primitives/math/balanceWorkshopModel.ts');
  const workshopScript = await loader.import('/src/components/lumina/primitives/visual-primitives/math/balanceWorkshopScript.ts');
  for (const mode of ['equality', 'equality_hard', 'one_step', 'one_step_hard', 'two_step_intro', 'two_step']) for (const difficulty of ['easy', 'medium', 'hard']) {
    const data = await generateBalanceScale({ componentId: 'balance-scale', instanceId: `equality-${difficulty}`,
      topic: 'Match a weight, add chosen weights and infer equality', grade: '2', gradeLevel: 'elementary',
      gradeContext: 'Grade 2', objective: { text: 'Use equal balance to infer the weight of an unnumbered block.' },
      scope: {}, raw: { targetEvalMode: mode, difficulty, instanceCount: 3 } });
    const basic = mode === 'equality';
    const problems = data.challenges.map(basic ? model.equalityProblem : workshop.workshopProblem);
    const items = basic ? script.equalityItems(problems) : workshopScript.workshopItems(problems);
    const issues = validateJudgedScriptPack({ primitiveType: 'balance-scale', activityLine: 'weights', items,
      itemCue: basic ? script.equalityItemCue : workshopScript.workshopItemCue,
      moveOnCue: (item, next) => basic ? script.equalityMoveCue(item, next)
        : workshopScript.workshopMoveCue(item, next, workshop.initialWorkshopBoard(next?.problem ?? item.problem)),
      completeCue: basic ? script.equalityCompleteCue : workshopScript.workshopCompleteCue, contextFor: () => ({}) });
    if (issues.length) throw new Error(issues.join('; '));
    const traces = problems.map((problem, index) => {
      if (!basic) {
        let board = workshop.initialWorkshopBoard(problem);
        const stages = [];
        for (const step of workshop.STAGES[mode]) {
          board = workshop.enterWorkshopStage(problem, step, board).board;
          if (workshop.isHands(step)) {
            // Deterministic reference construction; component tests exercise actual unit moves.
            board = workshop.modelStage(problem, step, board);
            if (!workshop.stageSolved(problem, step, board)) throw new Error('Workshop stage unsolvable');
          }
          const item = items.find((entry) => entry.problem.id === problem.id && entry.step === step);
          stages.push({ step, board, cue: workshopScript.workshopItemCue(item, {}, board) });
        }
        return { id: problem.id, stages };
      }
      let board = model.initialBoard(problem);
      const moves = [];
      let remaining = problem.target;
      let id = 0;
      while (remaining > 0) {
        const amount = [...model.WEIGHTS].reverse().find((weight) => weight <= remaining);
        board = model.addWeight(board, amount, id++);
        if (!board) throw new Error('Legal weight placement rejected');
        remaining -= amount;
        moves.push({ amount, board, feedback: model.equalityFeedback(problem, board) });
      }
      if (!model.isMatched(problem, board)) throw new Error('Weight matching failed');
      return { id: problem.id, moves, commit: script.equalityCheckCue(items[index * 3], board) };
    });
    writeFileSync(resolve(out, `${mode}-${difficulty}.json`), clean(JSON.stringify({ generatedAt: new Date().toISOString(), data, traces, issues }, null, 2)) + '\n');
    process.stdout.write(JSON.stringify({ mode, difficulty, equations: problems.length, steps: items.length, issues }) + '\n');
  }
} catch (error) {
  process.stderr.write(clean(error?.message ?? error) + '\n');
  process.exitCode = 1;
} finally {
  writeFileSync(resolve(out, 'generation.log'), logs.join('\n') + '\n');
  await server.close();
}
