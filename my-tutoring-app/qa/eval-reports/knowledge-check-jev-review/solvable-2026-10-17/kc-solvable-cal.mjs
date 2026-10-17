// Calibrate solvable + pictures_mismatch: saved 64 views (must-pass = review passed) + labelled held-out cases.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = process.cwd();
const m = readFileSync('.env.local', 'utf8').match(/^TYPESAFE_API_KEY=(.*)$/m);
if (m) process.env.TYPESAFE_API_KEY = m[1].trim().replace(/^["']|["']$/g, '');
const vite = await import(pathToFileURL(resolve(root, 'node_modules/vite/dist/node/index.js')).href);
const server = await vite.createServer({ root, configFile: false, appType: 'custom', logLevel: 'error',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } } });
const L = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
const R = await L.import('/src/components/lumina/service/knowledge-check/reviewKnowledgeCheck.ts');
const { systemOne } = await L.import('/src/components/lumina/service/manifest/typesafe/typesafeClient.ts');

const mc = (ask, choices, key, shown = 'nothing besides the text') => ({ type: 'multiple_choice', shown_on_screen: shown, ask,
  choices, correct_answer: choices[key], wrong_answers: choices.filter((_, i) => i !== key) });
const held = [
  // [label, topic, view, expected: {solv: 'ok'|'bad', pic: 'ok'|'bad'}]
  ['F1 reported hands', 'Measuring length with hands', mc('How many hands long is a row of four small blocks?', ['✌️ Two hands', '🖐 Five hands', '👐 Twenty hands'], 0), 'bad', 'bad'],
  ['F2 reported handle', 'Wheels and axles', mc('Which handle needs more muscle to twist around?', ['🚰 Tiny sink knob', '🪣 Long well crank', '🛋️🪔 Soft bed pillow'], 1), 'bad', 'bad'],
  ['F3 rug steps', 'Measuring length with steps', mc('How many steps long is the rug?', ['👣 Three steps', '👣 Six steps', '👣 Ten steps'], 1), 'bad', 'ok'],
  ['F4 jar vs bowl', 'Comparing capacity', mc('Which one holds more water?', ['🫙 Tall jar', '🥣 Wide bowl', '🧦 Sock'], 0), 'bad', 'ok'],
  ['F5 pig for cow', 'Farm animal sounds', mc('Which animal says moo?', ['🐷 Cow', '🐶 Dog', '🐱 Cat'], 0), 'ok', 'bad'],
  ['F6 fingers for feet', 'Measuring with feet', mc('Which do we use to walk heel to toe across a room?', ['✌️ Feet', '👂 Ears', '👃 Nose'], 0), 'ok', 'bad'],
  ['P1 snake longer', 'Comparing length', mc('Which animal is the longest?', ['🐍 Snake', '🐜 Ant', '🐞 Ladybug'], 0), 'ok', 'ok'],
  ['P2 elephant heavier', 'Comparing weight', mc('Which animal is the heaviest?', ['🐘 Elephant', '🐭 Mouse', '🐦 Bird'], 0), 'ok', 'ok'],
  ['P3 counted apples', 'Counting to 10', mc('How many apples are there?', ['🍎 Four apples', '🍎 Five apples', '🍎 Six apples'], 1, 'An arrangement of 5 apples 🍎'), 'ok', 'ok'],
  ['P4 longer crank same bucket', 'Wheels and axles', mc('Both cranks lift the same full bucket. Which crank is easier to turn?', ['📏 Long crank', '📌 Short crank', '🎈 Balloon'], 0), 'ok', 'bad'],
  ['P7 tall glass', 'Comparing capacity', mc('Which holds more water, a bathtub or a cup?', ['🛁 Bathtub', '☕ Cup', '🥄 Spoon'], 0), 'ok', 'ok'],
  ['F7 shoes count', 'Counting', mc('How many shoes are in a pair?', ['👟 Two shoes', '🖐 Five shoes', '🔟 Ten shoes'], 0), 'ok', 'bad'],
  ['P5 blocks drawn', 'Measuring length with blocks', mc('How many blocks long is the pencil?', ['🧱 Three blocks', '🧱 Five blocks', '🧱 Seven blocks'], 1, 'A pencil ✏️ lying next to a row of 5 blocks 🧱 end to end'), 'ok', 'ok'],
  ['P6 shapes', 'Shapes', mc('Which shape has three sides?', ['🔺 Triangle', '🟦 Square', '🔴 Circle'], 0), 'ok', 'ok'],
];
const saved = JSON.parse(readFileSync('qa/eval-reports/knowledge-check-jev-review/calibration-2026-10-06.json', 'utf8'));
const rows = [];
const run = async (id, topic, grade, view, exp) => {
  const lesson = { topic, grade };
  const q = R.reviewQuestions(view, 0);
  const keep = Object.fromEntries(Object.entries(q).filter(([k]) => k === 'solvable' || k.startsWith('picture_')));
  if (!Object.keys(keep).length) return;
  const { answers } = await systemOne({ lesson, problem: view }, keep);
  const s = answers.solvable;
  rows.push({ id, ask: view.ask, choices: view.choices, exp,
    solvable: s ? `${s.choice}:${s.probabilities[s.choice].toFixed(2)}` : '-',
    solvableProbs: s?.probabilities, pictures: (view.choices ?? []).map((c, i) => answers[`picture_${i}`] ? +answers[`picture_${i}`].noul.toFixed(2) : null), decision: R.decideReview(view, answers, [view]) });
};
const jobs = [
  ...held.map(([id, topic, v, solv, pic]) => () => run(id, topic, 'Kindergarten', v, { solv, pic })),
  ...saved.map((r) => () => {
    const g = r.id.match(/ G(\w+) P/)[1];
    const topic = r.id.replace(/ G\w+ P\d+$/, '');
    return run(r.id, topic, g === 'K' ? 'Kindergarten' : `Grade ${g}`, r.view, { reviewPassed: r.pass });
  }),
];
for (let i = 0; i < jobs.length; i += 8) await Promise.all(jobs.slice(i, i + 8).map((j) => j()));
for (const r of rows) { const pr = r.solvableProbs ?? {}; const un = ((pr.missing_information ?? 0) + (pr.several_answers ?? 0)).toFixed(2); console.log(`${r.id.padEnd(46)} un=${un} blocking=${r.decision.blocking} pic=[${r.pictures.join(',')}]  exp=${JSON.stringify(r.exp)}  | ${r.ask?.slice(0, 70)} :: ${(r.choices ?? []).join(' | ')}`); }
writeFileSync(process.env.OUTFILE, JSON.stringify(rows, null, 1));
await server.close();
