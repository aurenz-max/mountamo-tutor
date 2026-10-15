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
PRINTERS['addition-fact-strategies'] = (c) => `${c.a} + ${c.b} = ${c.sum}`;
PRINTERS['tape-diagram'] = (c) => {
  const bars = (c.bars ?? []).map((b) => '[' + b.segments.map((s) => (s.isUnknown ? `?${s.value}` : s.value)).join('|') + ']').join(' ');
  const cd = c.comparisonData ? ` ${c.comparisonData.unknownPart}/${c.comparisonData.comparisonWord}` : '';
  return `${bars}${cd}  Q: ${String(c.wordProblem ?? '').slice(0, 150)}`;
};
PRINTERS['comparison-builder'] = (c) => c.type === 'compare-numbers' ? `${c.leftNumber} ${c.correctSymbol} ${c.rightNumber}`
  : c.type === 'order' ? `[${(c.numbers ?? []).join(',')}] ${c.direction}`
  : c.type === 'one-more-one-less' ? `${c.targetNumber} ${c.askFor}`
  : `${c.leftGroup?.count} v ${c.rightGroup?.count} ${c.correctAnswer}`;
PRINTERS['place-value-chart'] = (c) => `${c.targetNumber} place ${c.highlightedDigitPlace} cols ${c.minPlace}-${c.maxPlace}`
  + ` names [${(c.placeNameChoices ?? []).join('/')}] values [${(c.digitValueChoices ?? []).map((v) => v.value).join('/')}]`;
PRINTERS['measurement-tools'] = (c) => `${c.widthInches}in ${c.shapeType}`;
PRINTERS['ratio-table'] = (c) => {
  const [a, b] = c.baseRatio, m = c.targetMultiplier;
  const sc = [a * m, b * m].map((v) => Math.round(v * 100) / 100);
  const ask = c.type === 'unit-rate' ? `${b}/${a} per 1` : c.hiddenValue === 'scaled-first' ? `?:${sc[1]}` : `${sc[0]}:?`;
  return `${a}:${b} -> ${ask} (x${Math.round(m * 1000) / 1000})  Q: ${String(c.instruction ?? '').slice(0, 110)}`;
};
PRINTERS['double-number-line'] = (c) => {
  const g = (c.givenPoints ?? []).filter((p) => p.topValue !== 0).map((p) => `${p.topValue}->${p.bottomValue}`).join(',');
  const t = (c.targetPoints ?? []).map((p) => `${p.topValue}->?${p.bottomValue}`).join(',');
  return `given ${g} find ${t} top max ${c.topScale?.max}  Q: ${String(c.prompt ?? '').slice(0, 90)}`;
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
PRINTERS['syllable-clapper'] = (c) => `${c.challengeType} ${c.word} = ${(c.syllables ?? []).join('-')} (${c.syllableCount})`
  + `${c.residue ? ` without ${c.removePart} -> ${c.residue}` : ''}${c.wordSpace ? `  [${c.wordSpace.structure} β${c.wordSpace.beta}]` : ''}${c.bank ? JSON.stringify(c).slice(0, 160) : ''}`;
PRINTERS['letter-sound-link'] = (c) => `${c.mode} ${c.targetLetter} ${c.targetSound} (${c.keywordWord})`
  + `${c.options?.length ? ` -> ${c.options.map((o) => `${o.isCorrect ? '*' : ''}${o.letter ?? o.sound}`).join(',')}` : ''}`
  + `${c.wordSpace ? `  [${c.wordSpace.structure} β${c.wordSpace.beta}]` : ''}`;
PRINTERS['word-workout'] = (c) => `${c.mode} ${c.realWord ? `${c.realWord} vs ${c.nonsenseWord}` : c.targetWord ? `${c.targetWord}${c.targetImage ?? ''}${c.distractorImages ? ` vs ${c.distractorImages.map((d) => d.word + d.image).join(',')}` : ''}` : c.chain ? c.chain.join('>') : c.contextTrialId ?? c.sentence ?? ''}`
  + `${c.wordSpace ? `  [${c.wordSpace.structure} β${c.wordSpace.beta}]` : ''}`;
PRINTERS['letter-spotter'] = (c) => `${c.mode} ${c.targetLetter}${c.targetWord ? ` (${c.targetWord}) "${c.spokenSentence}"` : ''}`
  + `${c.options ? ` opts ${c.options.join('')}` : ''}${c.letterGrid ? ` grid ${c.letterGrid.join('')}` : ''}${c.wordSpace ? `  [${c.wordSpace.structure} β${c.wordSpace.beta}]` : ''}`;
PRINTERS['picture-vocabulary'] = (c) => `${c.type} ${c.word}${c.emoji ?? ''}${c.options ? ` among ${c.options.filter((o) => o.word !== c.word).map((o) => o.word + o.emoji).join(',')}` : ''}`
  + `${c.clue ? ` clue "${c.clue}"` : ''}${c.baseWord ? ` base ${c.baseWord}` : ''}${c.wordSpace ? `  [${c.wordSpace.structure} β${c.wordSpace.beta}]` : ''}`;
PRINTERS['word-sorter'] = (c) => `${c.type} [${(c.bucketLabels ?? []).join(' | ')}] ${(c.words ?? []).map((w) => `${w.word}${w.emoji ?? ''}`).join(',')}${c.pairs ? JSON.stringify(c.pairs).slice(0, 120) : ''}`
  + `${c.wordSpace ? `  [${c.wordSpace.structure} β${c.wordSpace.beta}]` : ''}`;
PRINTERS['word-flip'] = (c) => `${c.type} ${c.sourceWord}${c.emoji ?? ''} -> ${c.answer}${c.count ? ` x${c.count}` : ''}${c.wordSpace ? `  [${c.wordSpace.structure} β${c.wordSpace.beta}]` : ''}`;
PRINTERS['spelling-pattern-explorer'] = (c) => `${c.patternType} "${c.highlightPattern}" words ${(c.patternWords ?? []).join(',')}`
  + ` | dictate ${(c.dictationWords ?? []).join(',')} | rule "${String(c.correctRule ?? '').slice(0, 70)}"`
  + `${c.wordSpace ? `  [${c.wordSpace.structure} β${c.wordSpace.beta}]` : ''}`;
PRINTERS['interactive-book'] = (c) => `${c.type} ${c.type === 'read-focus-word' ? `"${c.readLead ?? ''} [${c.targetText}]"` : c.targetText}`
  + `${c.wordSpace ? `  [${c.wordSpace.structure} β${c.wordSpace.beta}]` : ''}`;
PRINTERS['decodable-reader'] = (c) => {
  const lines = (c.passage?.sentences ?? []).map((x) => x.words.map((w) => w.text).join(' '));
  const n = lines.map((l) => l.split(/\s+/).length);
  const w = c.sentenceWindow ?? { min: 3, max: 8 };
  const out = n.filter((k) => k < w.min || k > w.max).length;
  return `${lines.length} sentences, words [${n.join(',')}] window ${w.min}-${w.max}${out ? ` OUT ${out}` : ''}`
    + `${c.supportTier ? ` tier ${c.supportTier}` : ''}` + lines.map((l) => `\n      ${l}`).join('');
};
PRINTERS['di-word-reading'] = (c) => `${c.challengeType} ${c.word} (${c.wordType}${c.graphemes ? ` ${c.graphemes.join('|')}` : ''})${c.emoji ? ` ${c.emoji}` : ''}`
  + `${c.supportTier ? ` tier ${c.supportTier}` : ''}${c.wordSpace ? `  [${c.wordSpace.structure} β${c.wordSpace.beta}]` : ''}`;
PRINTERS['di-sentence-reading'] = (c) => `${c.challengeType} "${c.text}" (${c.wordCount}w)${c.supportTier ? ` tier ${c.supportTier}` : ''}`
  + `${c.wordSpace ? `  [${c.wordSpace.structure} β${c.wordSpace.beta}]` : ''}`;
PRINTERS['hundreds-chart'] =(c) => `${c.type} by ${c.skipValue} from ${c.startNumber}`
  + `${c.givenCells?.length ? ` given [${c.givenCells.join(',')}]` : ''} needs ${(c.correctCells ?? []).filter((n) => !(c.givenCells ?? []).includes(n)).slice(0, 6).join(',')}…`
  + `${c.options?.length ? ` opts ${c.options.join('/')} ans ${c.correctAnswer}` : ''}`;
PRINTERS['skip-counting-runner'] = (c) => `${c.type}${c.line ? ` line ${c.line.direction} by ${c.line.skipValue} ${c.line.startFrom}->${c.line.endAt}` : ''} at ${c.startPosition}${c.hiddenPositions?.length ? ` hide [${c.hiddenPositions}]` : ''}${c.targetFact ? ` fact ${c.targetFact}` : ''}`;
PRINTERS['fraction-circles'] = (c) => c.type === 'compare' ? `${c.numerator}/${c.denominator} vs ${c.compareFraction?.numerator}/${c.compareFraction?.denominator}`
  : `${c.type} ${c.numerator}/${c.denominator}`;
PRINTERS['length-lab'] = (c) => `${c.type} lengths ${[c.objectLength0, c.objectLength1, c.objectLength2].filter((x) => x != null).join(',')}`
  + ` ans ${c.correctAnswer}${c.estimateOptions ? ` est [${c.estimateOptions}]` : ''}${c.unitTypeB ? ` units ${c.unitType}/${c.unitTypeB}` : ''}`;
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
    const spaceLogs = logs.slice(start).filter((l) => l.includes('Item space') || l.includes('Word space') || l.includes(' targets ') || l.includes('objective range') || l.includes('No valid challenges'));
    // One-object payloads (spelling-pattern-explorer: one pattern per session) print as one row.
    const one = (Array.isArray(d.patternWords) && d.patternWords.length) || d.passage?.sentences ? [d] : null;
    const list = one ?? d.challenges ?? d.words ?? d.items ?? d.nouns ?? d.buildItems ?? d.pairItems ?? d.rounds ?? [];
    const onSpace = !!d.itemSpace || list.some((c) => c.itemSpace || c.wordSpace);
    out(`\n${topic} | ${MODE} | difficulty=${difficulty ?? '(none)'} | run ${run + 1} | ${onSpace ? 'code space' : 'own path'}`
      + `${d.maxNumber != null ? ` | max ${d.maxNumber}` : ''}`
      + `${d.skipValue != null ? ` | line ${d.direction} by ${d.skipValue} ${d.startFrom}->${d.endAt}${d.itemSpace ? ` [β ${d.itemSpace.beta} ${d.itemSpace.structure}]` : ''} "${d.title}"` : ''}`);
    for (const l of spaceLogs) out(`  ${l.slice(0, 400)}`);
    const print = PRINTERS[COMPONENT] ?? fallback;
    for (const c of list) {
      out(`  ${c.itemSpace ? `[β ${String(c.itemSpace.beta).padStart(5)} ${c.itemSpace.structure.padEnd(14)}] ` : '[                      ] '}`
        + `${print(c)}  "${String(c.instruction ?? '').slice(0, 70)}"`);
    }
  }
} finally { await server.close(); }
