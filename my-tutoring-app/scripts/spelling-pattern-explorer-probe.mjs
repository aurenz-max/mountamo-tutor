// spelling-pattern-explorer: real production generation (pattern_build, code-owned asks; classic modes, one Gemini call
// each), checked by the oracle, the live adapter and the build's own check; then a labelled set of made words through
// the real build check (code) and the real word judge (judgeWordBuild, only: 'real_word').
// Usage: node scripts/spelling-pattern-explorer-probe.mjs --run [--payloads] [--judge]
// Keys: GEMINI_API_KEY / TYPESAFE_API_KEY from the env, or from the file LUMINA_ENV_FILE names.
// Writes qa/open-build/spelling-pattern-explorer-2026-10-08/{generations,judge-labelled}.json.
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'node:util';
import * as vite from 'vite';

if (!process.argv.includes('--run')) {
  console.log('Pass --run (add --payloads to save W1 payloads, --judge to run the labelled set through the word judge).');
  process.exit(0);
}
for (const envFile of ['.env.local', process.env.LUMINA_ENV_FILE].filter(Boolean)) {
  if (!existsSync(envFile)) continue;
  const text = readFileSync(envFile, 'utf8');
  for (const key of ['GEMINI_API_KEY', 'TYPESAFE_API_KEY', 'TYPESAFE_ENDPOINT', 'TYPESAFE_MODEL']) {
    const m = text.match(new RegExp(`^${key}=(.*)$`, 'm'));
    if (m && !process.env[key]) process.env[key] = m[1].trim().replace(/^["']|["']$/g, '');
  }
}
if (!process.env.GEMINI_API_KEY) throw new Error('Missing Gemini key (set GEMINI_API_KEY or LUMINA_ENV_FILE)');
const secrets = [process.env.GEMINI_API_KEY, process.env.TYPESAFE_API_KEY].filter(Boolean);
const redact = s => secrets.reduce((t, k) => t.replaceAll(k, '[REDACTED]'), s);
const log = (...a) => process.stdout.write(redact(format(...a)) + '\n');
const logs = [];
for (const method of ['log', 'warn', 'error', 'info', 'debug']) console[method] = (...args) => logs.push(redact(format(...args)));
const root = process.cwd();
const out = resolve(root, 'qa/open-build/spelling-pattern-explorer-2026-10-08');
const payloadDir = resolve(root, 'src/components/lumina/components/live-activity/runtime/testing/w1-payloads');
mkdirSync(out, { recursive: true });
const server = await vite.createServer({ root, configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
const LESSONS = [
  { mode: 'pattern_build', grade: '2', topic: 'Long a vowel teams', intent: 'Spell words with long a spelled ai' },
  { mode: 'pattern_build', grade: '1', topic: 'Silent e words', intent: 'Read and spell CVCe words', difficulty: 'easy' },
  { mode: 'pattern_build', grade: '3', topic: 'R-controlled vowels', intent: 'Spell words with ar, or, ir and ur' },
  { mode: 'pattern_build', grade: '3', topic: 'Silent letters', intent: 'Spell words with a silent k (kn) and silent w (wr)' },
  { mode: 'pattern_build', grade: '2', topic: 'Spelling patterns', intent: 'Use spelling patterns to spell words' },
  { mode: 'long_vowel', grade: '2', topic: 'Long vowel spelling patterns', intent: 'Spell words with the vowel team ai' },
  { mode: 'r_controlled', grade: '3', topic: 'R-controlled vowels', intent: 'Spell words with ar and or' },
];
const MODE_TYPE = { short_vowel: 'short-vowel', long_vowel: 'long-vowel', r_controlled: 'r-controlled', silent_letter: 'silent-letter', morphological: 'suffix-change' };

// The labelled set: [pattern, made, expected]. Expected is the whole build's verdict: pass, a code miss, or not_a_word.
const LABELLED = [
  ['ai', 'rain', 'pass'], ['ai', 'paint', 'pass'], ['ai', 'chain', 'pass'], ['ai', 'brain', 'pass'], ['ai', 'snail', 'pass'],
  ['ai', 'said', 'not_the_sound'], ['ai', 'hair', 'not_the_sound'], ['ai', 'rane', 'other_spelling'], ['ai', 'play', 'other_spelling'],
  ['ai', 'rian', 'wrong_place'], ['ai', 'mait', 'not_a_word'], ['ai', 'taip', 'not_a_word'], ['ai', 'ran', 'no_pattern'],
  ['a_e', 'cake', 'pass'], ['a_e', 'grape', 'pass'], ['a_e', 'have', 'not_the_sound'], ['a_e', 'care', 'not_the_sound'],
  ['a_e', 'rain', 'other_spelling'], ['a_e', 'caek', 'wrong_place'], ['a_e', 'kace', 'not_a_word'], ['a_e', 'mabe', 'not_a_word'],
  ['ar', 'car', 'pass'], ['ar', 'farm', 'pass'], ['ar', 'shark', 'pass'], ['ar', 'warm', 'not_the_sound'], ['ar', 'crab', 'wrong_place'],
  ['ar', 'cat', 'no_pattern'], ['ar', 'darp', 'not_a_word'], ['ar', 'scary', 'not_the_sound'],
  ['kn', 'knot', 'pass'], ['kn', 'knee', 'pass'], ['kn', 'knit', 'pass'], ['kn', 'not', 'other_spelling'], ['kn', 'sink', 'wrong_place'],
  ['kn', 'knat', 'not_a_word'],
  ['igh', 'light', 'pass'], ['igh', 'night', 'pass'], ['igh', 'height', 'pass'], ['igh', 'eight', 'not_the_sound'], ['igh', 'bite', 'other_spelling'],
  ['igh', 'ligh', 'not_a_word'],
  ['ee', 'tree', 'pass'], ['ee', 'sheep', 'pass'], ['ee', 'deer', 'not_the_sound'], ['ee', 'seat', 'other_spelling'], ['ee', 'bleem', 'not_a_word'],
  ['ea', 'leaf', 'pass'], ['ea', 'beak', 'pass'], ['ea', 'bread', 'not_the_sound'], ['ea', 'heart', 'not_the_sound'], ['ea', 'feel', 'other_spelling'],
  ['oa', 'boat', 'pass'], ['oa', 'road', 'pass'], ['oa', 'board', 'not_the_sound'], ['oa', 'home', 'other_spelling'], ['oa', 'toab', 'not_a_word'],
  ['o_e', 'home', 'pass'], ['o_e', 'stone', 'pass'], ['o_e', 'come', 'not_the_sound'], ['o_e', 'more', 'not_the_sound'], ['o_e', 'hoem', 'wrong_place'],
  ['ir', 'bird', 'pass'], ['ir', 'girl', 'pass'], ['ir', 'fire', 'not_the_sound'], ['ir', 'brid', 'wrong_place'], ['ir', 'hurt', 'other_spelling'],
  ['ur', 'turn', 'pass'], ['ur', 'purr', 'pass'], ['ur', 'pure', 'not_the_sound'], ['ur', 'burd', 'not_a_word'],
  ['mb', 'lamb', 'pass'], ['mb', 'thumb', 'pass'], ['mb', 'lam', 'other_spelling'],
  ['wr', 'wrap', 'pass'], ['wr', 'write', 'pass'], ['wr', 'rap', 'other_spelling'],
  ['ay', 'play', 'pass'], ['ay', 'stay', 'pass'], ['ay', 'says', 'not_the_sound'], ['ay', 'rain', 'other_spelling'],
];

try {
  const loader = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateSpellingPatternExplorer } = await loader.import('/src/components/lumina/service/literacy/gemini-spelling-pattern-explorer.ts');
  const { spellingPatternExplorerOracle } = await loader.import('/src/components/lumina/service/qa/oracles/spelling-pattern-explorer.ts');
  const { validateSpellingPatternExplorerData } = await loader.import('/src/components/lumina/components/live-activity/adapters/spellingPatternExplorerLive.ts');
  const lb = await loader.import('/src/components/lumina/primitives/visual-primitives/literacy/letterBuild.ts');
  const sp = await loader.import('/src/components/lumina/primitives/visual-primitives/literacy/spellingPatternBuild.ts');
  const results = [];
  const saved = new Set();
  for (const lesson of LESSONS) {
    const raw = { targetEvalMode: lesson.mode, intent: lesson.intent, difficulty: lesson.difficulty };
    const data = await generateSpellingPatternExplorer({ componentId: 'spelling-pattern-explorer', instanceId: lesson.mode, topic: lesson.topic,
      grade: lesson.grade, gradeLevel: 'elementary', gradeContext: `Grade ${lesson.grade}`, intent: lesson.intent,
      scope: { topic: lesson.topic, intent: lesson.intent }, raw });
    const oracle = spellingPatternExplorerOracle.verify(data, { componentId: 'spelling-pattern-explorer', evalMode: lesson.mode, topic: lesson.topic, gradeLevel: `grade ${lesson.grade}` });
    let adapter = 'ok';
    try { validateSpellingPatternExplorerData(data); } catch (e) { adapter = String(e.message ?? e); }
    let items;
    if (data.task === 'letter_build') {
      // Every seed word passes the build's own check; a same-sound spelling of another pattern misses other_spelling.
      items = lb.letterItemsFrom(data.buildItems, data.supportTier).map(it => ({ id: it.id, pattern: it.pattern, ask: it.ask, ways: it.ways,
        bank: it.bank.join(' '), boxes: lb.startRow(it).length, examples: it.examples,
        examplesPass: it.examples.every(w => lb.letterShapeMiss(it, w.split('')) === undefined),
        card: lb.patternFor(it), model: lb.modelFor(it), smallBank: lb.smallBankFor(it)?.bank.join(' ') ?? null,
        levers: lb.letterBuildLevers(it, []).map(l => `${l.id}:${l.answers.join('/')}`) }));
    } else {
      items = { patternType: data.patternType, highlightPattern: data.highlightPattern, patternWords: data.patternWords,
        dictationWords: data.dictationWords, dictationHints: data.dictationHints, supportTier: data.supportTier };
    }
    results.push({ lesson, title: data.title, oracle: oracle.violations, uncheckedTypes: oracle.uncheckedTypes, checked: oracle.checkedChallenges, adapter, items, data });
    log(`${lesson.mode} G${lesson.grade} | ${data.title} | ${Array.isArray(items) ? items.map(i => `${i.pattern}${i.ways === 2 ? 'x2' : ''} [${i.examples.join(',')}] ${i.examplesPass ? 'ok' : 'EXAMPLE FAILS'}`).join(' | ')
      : `${items.patternType} "${items.highlightPattern}" dict=${items.dictationWords.join(',')}`} | oracle ${oracle.violations.length}${oracle.violations.length ? ' ' + JSON.stringify(oracle.violations) : ''} | adapter ${adapter}`);
    const wantPayload = process.argv.includes('--payloads') && adapter === 'ok' && oracle.violations.length === 0 && !saved.has(lesson.mode)
      && (!Array.isArray(items) || items.every(i => i.examplesPass));
    if (wantPayload) {
      saved.add(lesson.mode);
      writeFileSync(resolve(payloadDir, `spelling-pattern-explorer.${lesson.mode}.json`), JSON.stringify({
        source: 'qa/open-build/spelling-pattern-explorer-2026-10-08/generations.json', primitiveId: 'spelling-pattern-explorer', evalMode: lesson.mode, data }, null, 1) + '\n');
    }
    void MODE_TYPE;
  }
  writeFileSync(resolve(out, 'generations.json'), JSON.stringify({ results, logs: logs.filter(l => l.includes('[SpellingPatternExplorer]')) }, null, 1));

  if (process.argv.includes('--judge')) {
    const { judgeWordBuild } = await loader.import('/src/components/lumina/service/build-layer/word-build-judge.ts');
    const rows = [];
    for (const [pattern, made, expect] of LABELLED) {
      const p = sp.PATTERNS[pattern];
      const item = { id: 'x', kind: 'pattern', pattern, ask: p.ask, bank: [], examples: [], ways: 1 };
      const code = lb.letterShapeMiss(item, made.split('')) ?? null;
      let judge = null;
      if (!code) {
        try { judge = await judgeWordBuild(lb.letterJudgeRequest(item, made.split(''), 'Grade 2')); } catch (e) { judge = { error: String(e.message ?? e) }; }
      }
      const got = code ?? (judge?.error ? 'error' : judge?.met ? 'pass' : judge?.miss ?? 'error');
      rows.push({ pattern, made, expect, got, ok: got === expect, code, judge,
        words: code ? lb.letterMissWords(code, item, made) : null });
      log(`${got === expect ? 'ok ' : 'XX '} ${pattern.padEnd(4)} ${made.padEnd(7)} expect=${expect.padEnd(14)} got=${got}${judge && !judge.error ? ` (rw=${judge.realWord?.toFixed?.(2)} ${judge.judge})` : ''}`);
    }
    const by = k => rows.filter(r => k(r));
    const summary = { total: rows.length, agree: by(r => r.ok).length,
      code: { cases: by(r => r.expect !== 'pass' && r.expect !== 'not_a_word').length, agree: by(r => r.expect !== 'pass' && r.expect !== 'not_a_word' && r.ok).length },
      judge: { realWords: by(r => r.expect === 'pass').length, passed: by(r => r.expect === 'pass' && r.got === 'pass').length,
        madeUp: by(r => r.expect === 'not_a_word').length, rejected: by(r => r.expect === 'not_a_word' && r.got === 'not_a_word').length } };
    log(JSON.stringify(summary));
    writeFileSync(resolve(out, 'judge-labelled.json'), JSON.stringify({ summary, rows }, null, 1));
  }
} finally {
  await server.close();
}
