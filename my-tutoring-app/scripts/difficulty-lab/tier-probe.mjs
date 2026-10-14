// Generic tier probe: any primitive through the real registry generator, easy / medium / hard plus a
// no-tier run, for each topic. Prints each challenge as a compact line (a per-primitive printer when
// one exists below, else the challenge's numeric fields) and any item-space log line. /add-item-space
// step 0b and step 5.
//
//   node scripts/difficulty-lab/tier-probe.mjs --run --component math-fact-fluency --mode speed_round \
//     --grade 1 --topic "Add and subtract within 20" [--topic "..."] [--runs 2] [--no-none]
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.argv.includes('--run')) { console.log('Pass --run.'); process.exit(0); }
if (!process.env.GEMINI_API_KEY) {
  const m = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (m) process.env.GEMINI_API_KEY = m[1].trim().replace(/^["']|["']$/g, '');
}
process.env.LUMINA_FIT_GATE = 'off';
const argv = process.argv;
const arg = (name, dflt) => { const i = argv.indexOf(name); return i > 0 ? argv[i + 1] : dflt; };
const all = (name) => argv.flatMap((a, i) => (a === name ? [argv[i + 1]] : []));
const COMPONENT = arg('--component');
const MODE = arg('--mode');
const GRADE = arg('--grade', '1');
const RUNS = Number(arg('--runs', 2));
const TOPICS = all('--topic');
const TIERS = ['easy', 'medium', 'hard', ...(argv.includes('--no-none') ? [] : [undefined])];
const out = console.log.bind(console);
const logs = [];
for (const m of ['log', 'warn', 'error', 'info', 'debug']) console[m] = (...a) => logs.push(format(...a));

const PRINTERS = {
  'math-fact-fluency': (c) => {
    const eq = `${c.unknownPosition === 'operand1' ? '?' : c.operand1} ${c.operation === 'subtraction' ? '−' : '+'} `
      + `${c.unknownPosition === 'operand2' ? '?' : c.operand2} = ${c.unknownPosition === 'result' ? '?' : c.result}`;
    return `${eq.padEnd(14)} ans ${String(c.correctAnswer).padStart(2)}${c.options ? ` opts ${c.options.join(',')}` : ''}`
      + `${c.equationOptions ? ` eqs ${c.equationOptions.join(' | ')}` : ''}${c.visualCount != null ? ` vis ${c.visualType}:${c.visualCount}` : ''}`;
  },
};
PRINTERS['bar-model'] = (c) => `[${(c.values ?? []).map((v) => v.value).join(',')}]`
  + `${c.scale ? ` step ${c.scale.step}${c.scale.iconValue ? ` icon ${c.scale.iconValue}` : ''}` : ''}`
  + `${c.expectedValue != null ? ` ans ${c.expectedValue}` : ''}${c.targetBarIndex != null ? ` tgt ${c.targetBarIndex}` : ''}`
  + `${c.stimulusCount != null ? ` stim ${c.stimulusCount}` : ''}${c.expectedCounts ? ` counts ${c.expectedCounts.join(',')}` : ''}`
  + `${c.expectedScaleStep != null ? ` scale ${c.expectedScaleStep}` : ''}  Q: ${String(c.prompt ?? '').slice(0, 90)}`;
PRINTERS['balance-scale'] = (c) => {
  const side = (s) => { const v = s.filter((o) => o.isVariable).length;
    return [v ? (v > 1 ? `${v}x` : 'x') : '', ...s.filter((o) => !o.isVariable).map((o) => o.value)].filter(Boolean).join(' + '); };
  return `${side(c.leftSide ?? [])} = ${side(c.rightSide ?? [])}`.padEnd(18) + ` ans ${c.variableValue}`;
};
PRINTERS['equation-builder'] = (c) => c.type === 'balance' ? `${c.leftSide} = ${c.rightSide}`.padEnd(18) + ` ans ${c.correctAnswer}`
  : JSON.stringify(c).slice(0, 200);
PRINTERS['area-model'] = (c) => {
  const n = (ps) => (ps ?? []).reduce((s, v) => s + v, 0);
  return `${n(c.factor1Parts)} × ${n(c.factor2Parts)}`.padEnd(12) + ` parts [${c.factor1Parts}]×[${c.factor2Parts}]`
    + ` = ${n(c.factor1Parts) * n(c.factor2Parts)}`;
};
PRINTERS['phoneme-explorer'] = (c) => {
  const menu = (c.choices ?? []).map((x) => `${x.correct ? '*' : ''}${x.word}`).join(',');
  const tag = c.wordSpace ? `  [${c.wordSpace.structure} β${c.wordSpace.beta}]` : '';
  switch (c.mode) {
    case 'isolate': return `/${c.phoneme}/ ex ${c.exampleWord} -> ${menu}${tag}`;
    case 'ending': case 'medial': return `${c.targetWord}${c.vowel ? ` (${c.vowel})` : ''} -> ${menu}${tag}`;
    case 'blend': return `${(c.phonemeSequence ?? []).join('-')} = ${c.word}${tag}`;
    case 'segment': return `${c.targetWord} = ${(c.segments ?? []).length} [${(c.segments ?? []).join(' ')}]${tag}`;
    case 'manipulate': return `${c.originalWord}: ${c.operationDescription} -> ${c.resultWord}${tag}`;
    default: return JSON.stringify(c).slice(0, 160);
  }
};
PRINTERS['phonics-blender'] = (c) => `${c.targetWord}${c.emoji ? ` ${c.emoji}` : ''} = ${(c.phonemes ?? []).map((p) => `${p.letters}${p.sound}`).join(' ')}`
  + `${c.wordSpace ? `  [${c.wordSpace.structure} β${c.wordSpace.beta}]` : ''}${c.ask ? JSON.stringify(c).slice(0, 160) : ''}`;
PRINTERS['cvc-speller'] = (c) => `${c.taskType} ${c.targetWord}${c.emoji ? ` ${c.emoji}` : ''} [${(c.targetPhonemes ?? []).join(' ')}]`
  + `${c.distractorLetters?.length ? ` bank+${c.distractorLetters.join('')}` : ''}${c.wordSpace ? `  [${c.wordSpace.structure} β${c.wordSpace.beta}]` : ''}${c.ask ? JSON.stringify(c).slice(0, 160) : ''}`;
PRINTERS['sound-swap'] = (c) => `${c.operation} ${c.originalWord} -> ${c.resultWord} (${c.addPosition ?? c.deletePosition ?? c.substitutePosition ?? '?'}`
  + ` ${c.addPhoneme ?? c.deletePhoneme ?? `${c.oldPhoneme}>${c.newPhoneme}`})${c.wordSpace ? `  [${c.wordSpace.structure} β${c.wordSpace.beta}]` : ''}${c.ask ? JSON.stringify(c).slice(0, 160) : ''}`;
PRINTERS['rhyme-studio'] = (c) => `${c.mode} ${c.targetWord}${c.targetWordEmoji ?? ''} ${c.rhymeFamily}`
  + `${c.comparisonWord ? ` ? ${c.comparisonWord}${c.comparisonWordEmoji ?? ''} ${c.doesRhyme ? 'YES' : 'NO'}` : ''}`
  + `${c.options ? ` -> ${c.options.map((o) => `${o.isCorrect ? '*' : ''}${o.word}${o.image?.length <= 4 ? o.image : ''}`).join(',')}` : ''}`
  + `${c.wordSpace ? `  [${c.wordSpace.structure} β${c.wordSpace.beta}]` : ''}${c.pairItems || c.board ? JSON.stringify(c).slice(0, 160) : ''}`;
const TEXT = new Set(['id', 'title', 'description', 'instruction', 'hint', 'narration', 'storyText', 'feedback', 'explanation']);
const fallback = (c) => JSON.stringify(Object.fromEntries(Object.entries(c).filter(([k]) => !TEXT.has(k)))).slice(0, 420);

const root = process.cwd();
const server = await vite.createServer({
  root, configFile: false, appType: 'custom', logLevel: 'error',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateComponentContent } = await loader.import('/src/components/lumina/service/geminiService.ts');
  for (const topic of TOPICS) for (const difficulty of TIERS) for (let run = 0; run < RUNS; run++) {
    const item = { componentId: COMPONENT, instanceId: `p-${run}`, title: topic, intent: topic,
      config: { intent: topic, targetEvalMode: MODE, objectiveGrade: GRADE, ...(difficulty ? { difficulty } : {}) } };
    const start = logs.length;
    let d = {};
    try { d = (await generateComponentContent(item, topic, `Grade ${GRADE}`))?.data ?? {}; } catch (e) { out(`  ERROR ${e.message}`); }
    const spaceLogs = logs.slice(start).filter((l) => l.includes('Item space') || l.includes('Word space'));
    const list = d.challenges ?? d.words ?? d.items ?? d.nouns ?? d.buildItems ?? d.pairItems ?? d.rounds ?? [];
    const onSpace = list.some((c) => c.itemSpace || c.wordSpace);
    out(`\n${topic} | ${MODE} | difficulty=${difficulty ?? '(none)'} | run ${run + 1} | ${onSpace ? 'code space' : 'own path'}`
      + `${d.maxNumber != null ? ` | max ${d.maxNumber}` : ''}`);
    for (const l of spaceLogs) out(`  ${l.slice(0, 400)}`);
    const print = PRINTERS[COMPONENT] ?? fallback;
    for (const c of list) {
      out(`  ${c.itemSpace ? `[β ${String(c.itemSpace.beta).padStart(5)} ${c.itemSpace.structure.padEnd(14)}] ` : '[                      ] '}`
        + `${print(c)}  "${String(c.instruction ?? '').slice(0, 70)}"`);
    }
  }
} finally { await server.close(); }
