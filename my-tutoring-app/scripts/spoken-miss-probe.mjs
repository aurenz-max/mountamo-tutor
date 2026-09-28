#!/usr/bin/env node
/**
 * Real-model case set for the `spoken_miss` observation kind (handoff 20 Part B, phase 1): which of this item's
 * known wrong answers did the learner say? Pilot families: counting-board count, ten-frame subitize,
 * letter-sound-link see_hear.
 *
 *   node scripts/spoken-miss-probe.mjs [--runs N] [--only counting-board] [out.json]
 *
 * Needs TYPESAFE_API_KEY in .env.local; no dev server (the kind runs in-process through vite's module runner,
 * the same loader vitest uses), no Gemini call. Items, tasks and expected answers come from the saved W1 payloads
 * and the families' own domain functions; wrong answers from their harness `plainWrong`/`signatureWrong` and the
 * liveJourneySpec wrong input, plus transcripts seen on saved Live audio runs and constructed noisy forms.
 *
 * The per-item miss lists below are the PILOT FIXTURE of what each family's domain will export at wiring
 * (`<x>SpokenMisses(item)` beside `countMiss`/`frameMiss`); they are here only because primitives/ is frozen.
 * Gold labels are computed by one function per family from the answer's value, with the same precedence as the
 * miss list, so a case writer cannot drift from the list the model sees.
 *
 * Reported: accuracy per miss id, and the false-positive count (a correct answer named as a miss), which must be 0.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
if (!existsSync(join(ROOT, 'node_modules', 'vite'))) { console.error('run from my-tutoring-app'); process.exit(1); }
for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^(TYPESAFE_[A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const argv = process.argv.slice(2);
const opt = (name, dflt) => argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : dflt;
const RUNS = Number(opt('runs', 3));
const ONLY = opt('only', null);
const OUT = argv.find(a => a.endsWith('.json'));
// Held-out phrasings, written after the decision policy was fixed on the main set: the policy is judged on these.
const HELD = argv.includes('--heldout');

const vite = await import(pathToFileURL(join(ROOT, 'node_modules/vite/dist/node/index.js')).href);
const server = await vite.createServer({ configFile: false, root: ROOT, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(ROOT, 'src'), 'server-only': resolve(ROOT, 'vitest.stubs/server-only.ts') } } });
const runner = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
const L = '/src/components/lumina';
const cb = await runner.import(`${L}/primitives/visual-primitives/math/countingBoardDomain.ts`);
const tfs = await runner.import(`${L}/primitives/visual-primitives/math/tenFrameScript.ts`);
const tfw = await runner.import(`${L}/primitives/visual-primitives/math/tenFrameWorkspace.ts`);
const lss = await runner.import(`${L}/primitives/visual-primitives/literacy/letterSoundLinkScript.ts`);
const { runObservation } = await runner.import(`${L}/service/typesafe/observationKinds.ts`);
const { spokenMissKind } = await runner.import(`${L}/service/typesafe/observeSpokenMiss.ts`);
const { validSpokenMissRequest } = await runner.import(`${L}/service/typesafe/spokenMissContract.ts`);
const payload = name => JSON.parse(readFileSync(join(ROOT, `src/components/lumina/components/live-activity/runtime/testing/w1-payloads/${name}.json`), 'utf8')).data;

const W = cb.numberWordFor;
const digitWalk = n => Array.from({ length: n }, (_, i) => i + 1).join(' ');
const uniqueBy = (xs, key) => xs.filter((x, i) => xs.findIndex(y => key(y) === key(x)) === i);

// ── counting-board count (count_all) ────────────────────────────────────────
function countingMisses(t, noun) {
  return [
    { id: 'skipped_a_number', pattern: 'The learner counts aloud and leaves a number out of the counting sequence, whatever number they end on.', examples: ['one, two, four'] },
    { id: 'one_short', pattern: `The learner's answer is ${t - 1}, one fewer than the ${t} ${noun} on the board.`, examples: [W(t - 1)] },
    { id: 'one_over', pattern: `The learner's answer is ${t + 1}, one more than the ${t} ${noun} on the board.`, examples: [W(t + 1)] },
    ...(t - 2 >= 1 ? [{ id: 'short_by_more', pattern: `The learner's answer is ${t - 2} or fewer (but more than zero), two or more fewer than the ${t} ${noun}.`, examples: [W(t - 2)] }] : []),
    { id: 'over_by_more', pattern: `The learner's answer is ${t + 2} or more, two or more more than the ${t} ${noun}.`, examples: [W(t + 2)] },
  ];
}
const countingGold = (t, value, skipped = false) => skipped ? 'skipped_a_number' : value === t ? null
  : value === t - 1 ? 'one_short' : value === t + 1 ? 'one_over' : value < t ? 'short_by_more' : 'over_by_more';
const HOMOPHONE = { 2: 'too', 4: 'for', 5: "It's 5:00.", 6: 'sicks', 8: 'ate', 9: 'nueve', 7: 'Seven?' };
const NO_ANSWER = ["I don't know", 'Can you help me?', 'What do I do?', 'um', 'Can you show me what you mean?', 'I am ready for the next one.'];

function countingCases() {
  const d = payload('counting-board.count');
  const items = uniqueBy(cb.itemsFromChallenges(d.challenges, { objectWord: cb.objectWordFor(d.objects.type) }), i => i.target);
  return items.flatMap((item, k) => {
    const t = item.target, a = cb.workspaceAssignment(item), h = cb.countingBoardHarnessAnswers(item);
    const skipWalk = [1, 2, ...Array.from({ length: t - 1 }, (_, i) => i + 4)].slice(0, t).join(' ');
    const noun = item.objectWord, skipLast = [...Array.from({ length: t - 1 }, (_, i) => i + 1), t + 1].join(' ');
    const rows = HELD ? [
      ['correct_with_noun', `${W(t)} ${noun}`, null, 'heldout'],
      ['correct_hesitant', `uh, ${W(t)}`, null, 'heldout'],
      ['correct_sentence', `I counted ${t}`, null, 'heldout'],
      ['correct_walk_then_total', `${digitWalk(t)}. ${cb.cap(W(t))}!`, null, 'heldout'],
      ['wrong_i_think', `I think it's ${W(t + 1)}`, countingGold(t, t + 1), 'heldout'],
      ['wrong_there_are', `there are ${W(t - 1)} ${noun}`, countingGold(t, t - 1), 'heldout'],
      ['wrong_digit', `${t + 1}!`, countingGold(t, t + 1), 'heldout'],
      ['skipped_last', skipLast, countingGold(t, 0, true), 'heldout'],
      ['far_over', W(t + 4), countingGold(t, t + 4), 'heldout'],
      ['far_short', `only ${W(1)}`, countingGold(t, 1), 'heldout'],
      ['no_answer', ['hold on', 'I like butterflies', 'wait what'][k % 3], null, 'heldout'],
    ] : [
      ['correct_word', W(t), countingGold(t, t), 'harness-correct'],
      ['correct_walk_digits', digitWalk(t), countingGold(t, t), 'live-transcript'],
      ['correct_could_it_be', `Could it be ${digitWalk(t)}?`, null, 'live-transcript'],
      ['correct_lets_try', `Okay, let's try it. ${digitWalk(t)}`, null, 'live-transcript'],
      ['correct_noisy', HOMOPHONE[t] ?? String(t), null, 'constructed-noisy'],
      ['correct_self_corrected', `${W(t + 1)}, no, ${W(t)}`, null, 'constructed'],
      ['plain_wrong', h.plainWrong, countingGold(t, t - 1), 'harness-plainWrong'],
      ['signature_walk_past', h.signatureWrong.text, countingGold(t, t + 1), 'harness-signatureWrong'],
      ['journey_wrong', digitWalk(t + 1), countingGold(t, t + 1), 'journey-wrong'],
      ['wrong_could_it_be', `Could it be ${digitWalk(t + 1)}?`, countingGold(t, t + 1), 'live-transcript'],
      ['skipped_walk', skipWalk, countingGold(t, 0, true), 'constructed'],
      ['far_over', W(t + 3), countingGold(t, t + 3), 'constructed'],
      ['far_short', W(t - 2), countingGold(t, t - 2), 'constructed'],
      ['no_answer', NO_ANSWER[k % NO_ANSWER.length], null, 'live-transcript'],
    ];
    return rows.map(([name, learner, gold, source]) => ({ family: 'counting-board.count', item: `${item.id}(${t})`, name, source, gold,
      correctAnswer: name.startsWith('correct'),
      request: { task: a.task, expectedAnswer: a.expectedAnswer, learner, misses: countingMisses(t, item.objectWord) } }));
  });
}

// ── ten-frame subitize ──────────────────────────────────────────────────────
function frameMisses(n) {
  const empty = 10 - n;
  return [
    ...(empty > 0 && empty !== n ? [{ id: 'empty_count', pattern: `The learner's answer is ${empty}, the number of EMPTY boxes on the frame rather than the counters.`, examples: [W(empty)] }] : []),
    ...(n - 1 >= 1 ? [{ id: 'one_short', pattern: `The learner's answer is ${n - 1}, one fewer than the ${n} counters shown.`, examples: [W(n - 1)] }] : []),
    { id: 'one_over', pattern: `The learner's answer is ${n + 1}, one more than the ${n} counters shown.`, examples: [W(n + 1)] },
    ...(n - 2 >= 1 ? [{ id: 'short_by_more', pattern: `The learner's answer is ${n - 2} or fewer (but more than zero), two or more fewer than the ${n} counters shown.`, examples: [W(n - 2)] }] : []),
    { id: 'over_by_more', pattern: `The learner's answer is ${n + 2} or more, two or more more than the ${n} counters shown.`, examples: [W(n + 2)] },
  ];
}
const frameGold = (n, v) => v === n ? null : (10 - n > 0 && 10 - n !== n && v === 10 - n) ? 'empty_count'
  : v === n - 1 ? 'one_short' : v === n + 1 ? 'one_over' : v < n ? 'short_by_more' : 'over_by_more';
const SPANISH = { 2: 'dos', 3: 'tres', 4: 'cuatro', 5: 'cinco', 6: 'seis', 8: 'ocho', 10: 'diez' };

function frameCases() {
  const d = payload('ten-frame.subitize');
  const items = tfs.itemsFromChallenges(d.challenges, { capacity: 10, band: d.gradeBand ?? 'K' }).filter(i => i.kind === 'subitize');
  return items.flatMap((item, k) => {
    const n = item.answer, a = tfw.workspaceAssignment(item), h = tfs.tenFrameHarnessAnswers(item);
    const plainValue = Array.from({ length: 30 }, (_, i) => i + 1).find(v => W(v) === h.plainWrong);
    const hasEmpty = 10 - n > 0 && 10 - n !== n;
    const rows = HELD ? [
      ['correct_it_was', `it was ${W(n)}`, null, 'heldout'],
      ['correct_exclaim', `${cb.cap(W(n))}!`, null, 'heldout'],
      ['correct_hesitant', `uh, ${n}`, null, 'heldout'],
      ['wrong_maybe', `maybe ${W(n + 1)}`, frameGold(n, n + 1), 'heldout'],
      ...(hasEmpty ? [['empty_there_were', `there were ${W(10 - n)}`, frameGold(n, 10 - n), 'heldout']] : []),
      ...(n - 1 >= 1 ? [['one_short_digit', String(n - 1), frameGold(n, n - 1), 'heldout']] : []),
      ['plus_two', W(n + 2), frameGold(n, n + 2), 'heldout'],
      ['no_answer', ['it went too fast', 'what?', 'I was not looking'][k % 3], null, 'heldout'],
    ] : [
      ['correct_word', W(n), null, 'harness-correct'],
      ['correct_digit', String(n), null, 'live-transcript'],
      ['correct_spanish', SPANISH[n] ?? W(n), null, 'live-transcript'],
      ['correct_sentence', `I saw ${W(n)}`, null, 'constructed'],
      // The DI pack's signature route (counted one at a time) lands on the key; the workspace key is the number,
      // so it is a correct answer here, not a miss.
      ['correct_counted_walk', h.signatureWrong.text, null, 'harness-signatureWrong'],
      ...(HOMOPHONE[n] && n !== 5 && n !== 7 ? [['correct_noisy', HOMOPHONE[n], null, 'constructed-noisy']] : []),
      ['plain_wrong', h.plainWrong, frameGold(n, plainValue), 'harness-plainWrong'],
      ...(10 - n > 0 && 10 - n !== n ? [['empty_count', W(10 - n), frameGold(n, 10 - n), 'constructed']] : []),
      ...(n - 1 >= 1 ? [['one_short', W(n - 1), frameGold(n, n - 1), 'constructed']] : []),
      ['over_by_three', `I saw ${W(n + 3)}`, frameGold(n, n + 3), 'constructed'],
      ...(n - 2 >= 1 ? [['short_by_two_digit', String(n - 2), frameGold(n, n - 2), 'constructed']] : []),
      ['no_answer', ['Let me try that again.', "I didn't see it", 'um', 'Show me again'][k % 4], null, 'live-transcript'],
    ];
    return rows.map(([name, learner, gold, source]) => ({ family: 'ten-frame.subitize', item: `${item.id}(${n})`, name, source, gold,
      correctAnswer: name.startsWith('correct'),
      request: { task: a.task, expectedAnswer: a.expectedAnswer, learner, misses: frameMisses(n) } }));
  });
}

// ── letter-sound-link see_hear ──────────────────────────────────────────────
const CONTINUOUS = new Set(['s', 'n', 'm', 'f', 'l', 'r', 'v', 'z']);
function letterMisses(item) {
  const l = item.letter.toLowerCase(), clipped = lss.isClippedSound(l);
  const decoys = ['mmm', 'fff', 'lll', 'sss'].filter(s => s !== item.spoken).slice(0, 2);
  return [
    { id: 'letter_name', pattern: `The learner says the NAME of the letter, "${lss.letterNameFor(l)}", instead of the sound it makes.`, examples: [lss.letterNameFor(l)] },
    ...(!clipped ? [{ id: 'keyword_word', pattern: `The learner says a whole word instead of the sound on its own: the picture word "${item.keyword}" or any other word, even one that starts with the right sound.`, examples: [item.keyword] }] : []),
    ...(CONTINUOUS.has(l) ? [{ id: 'added_vowel', pattern: `The learner says the sound with a vowel after it, "${l}uh", instead of holding the sound on its own.`, examples: [`${l}uh`] }] : []),
    { id: 'other_sound', pattern: 'The learner says the sound of a different letter. A held consonant such as "mmm" or "nnn" is a letter sound, not filler.', examples: decoys },
  ];
}
const CHILD_CORRECT = { s: ['sss', 'ssss', 's'], n: ['nnn', 'nnnn'], a: ['aaa', 'ah', 'a like in apple'], i: ['iii', 'ih'],
  t: ['t', 'tuh'], p: ['p', 'puh'] };

const HELD_LETTER = {
  s: [['correct_snake', 'sssss like a snake', null], ['keyword_other', 'snake', 'keyword_word'], ['name_the_letter', 'the letter ess', 'letter_name'],
    ['other', 'fff', 'other_sound'], ['added_twice', 'suh suh', 'added_vowel'], ['no_answer', 'hmm let me think', null]],
  a: [['correct_aah', 'aah', null], ['correct_twice', 'ah ah', null], ['name_says', 'it says ay', 'letter_name'], ['keyword_other', 'ant', 'keyword_word'],
    ['other', 'ooo', 'other_sound']],
  t: [['correct_tripled', 't t t', null], ['correct_twice', 'tuh tuh', null], ['name_says', 'it says tee', 'letter_name'], ['other', 'sss', 'other_sound']],
  i: [['correct_twice', 'ih ih', null], ['name_says', 'it says eye', 'letter_name'], ['keyword_other', 'insect', 'keyword_word'], ['other', 'ooo', 'other_sound']],
  p: [['correct_twice', 'puh puh', null], ['name_says', 'it says pee', 'letter_name'], ['other', 'nnn', 'other_sound'], ['no_answer', 'is it the pig one?', null]],
  n: [['correct_long', 'nnnnn', null], ['correct_like', 'nnn like net', null], ['name_says', 'it says en', 'letter_name'],
    ['keyword_other', 'nose', 'keyword_word'], ['added_twice', 'nuh nuh', 'added_vowel'], ['other', 'sss', 'other_sound']],
};

function letterCases() {
  const d = payload('letter-sound-link.see_hear');
  const items = lss.buildLetterSoundLinkItems(d.challenges, 'medium').filter(i => i.mode === 'see-hear');
  return items.flatMap((item, k) => {
    const l = item.letter.toLowerCase(), clipped = lss.isClippedSound(l), a = lss.workspaceAssignment(item);
    const h = lss.letterSoundLinkHarnessAnswers(item), name = lss.letterNameFor(l);
    const otherName = lss.letterNameFor(l === 'm' ? 'f' : 'm');
    const rows = HELD ? (HELD_LETTER[l] ?? []).map(([nm, learner, gold]) => [nm, learner, gold, 'heldout']) : [
      ...(CHILD_CORRECT[l] ?? [h.correct]).map((w, i) => [`correct_${i}`, w, null, i === 0 ? 'harness-correct' : 'constructed-noisy']),
      ['plain_wrong', h.plainWrong, 'other_sound', 'harness-plainWrong'],
      ['signature_name', h.signatureWrong?.text ?? name, 'letter_name', 'harness-signatureWrong'],
      ['name_sentence', `it's ${name}`, 'letter_name', 'constructed'],
      [`keyword${clipped ? '_accepted' : ''}`, item.keyword, clipped ? null : 'keyword_word', 'constructed'],
      ...(CONTINUOUS.has(l) ? [['added_vowel', `${l}uh`, 'added_vowel', 'constructed']] : []),
      // Another letter's NAME: unlisted, but "em" also reads as the /m/ sound, so other_sound is fair too.
      ['other_letter_name', otherName, null, 'constructed-unlisted', ['other_sound']],
      ['no_answer', ["I don't know", 'which one?', 'um', 'can you say it first?'][k % 4], null, 'constructed'],
    ];
    return rows.map(([nm, learner, gold, source, alsoFair = []]) => ({ family: 'letter-sound-link.see_hear', item: `${item.id}(${l})`, name: nm, source, gold, alsoFair,
      correctAnswer: nm.startsWith('correct') || nm === 'keyword_accepted',
      request: { task: a.task, expectedAnswer: a.expectedAnswer, learner, misses: letterMisses(item) } }));
  });
}

const cases = [...countingCases(), ...frameCases(), ...letterCases()].filter(c => !ONLY || c.family.startsWith(ONLY));
const invalid = cases.filter(c => !validSpokenMissRequest({ scope: { sessionEpoch: 'probe', instanceId: 'probe', itemId: c.item }, ...c.request }));
if (invalid.length) { console.error('invalid requests:', invalid.map(c => `${c.family} ${c.item} ${c.name}`)); process.exit(1); }
console.log(`${cases.length} cases x ${RUNS} runs`);
if (argv.includes('--dry')) {
  for (const c of cases) console.log(c.family.padEnd(28), c.item.padEnd(8), c.name.padEnd(24), JSON.stringify(c.request.learner).padEnd(40), c.gold,
    c.request.misses.map(m => m.id).join(','));
  console.log(JSON.stringify(cases[0].request, null, 1));
  await server.close(); process.exit(0);
}

const jobs = [];
for (let rep = 1; rep <= RUNS; rep++) for (const c of cases) jobs.push({ rep, c });
const results = [];
let next = 0;
async function worker() {
  while (next < jobs.length) {
    const { rep, c } = jobs[next++];
    const d = await runObservation(spokenMissKind, { scope: { sessionEpoch: 'probe', instanceId: 'probe', itemId: c.item }, ...c.request });
    const r = { rep, family: c.family, item: c.item, name: c.name, source: c.source, learner: c.request.learner, gold: c.gold,
      correctAnswer: c.correctAnswer, miss: d.miss, reading: d.reading, p: d.p, reason: d.reason, ms: d.ms, answers: d.assessment?.answers,
      pass: d.accepted && (d.miss === c.gold || (c.alsoFair ?? []).includes(d.miss)), falsePositive: c.correctAnswer && d.miss !== null };
    results.push(r);
    if (!r.pass) console.log('MISS', rep, c.family.padEnd(28), c.item.padEnd(8), c.name.padEnd(24), JSON.stringify(c.request.learner).padEnd(34),
      `gold=${c.gold} got=${d.miss} reading=${d.reading} p=${d.p?.toFixed(2)} ${d.reason}`);
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
await server.close();

// ── Report ──────────────────────────────────────────────────────────────────
const byFamily = {};
for (const r of results) {
  const f = byFamily[r.family] ??= { total: 0, pass: 0, falsePositive: 0, abstained: 0, perGold: {} };
  f.total++; if (r.pass) f.pass++; if (r.falsePositive) f.falsePositive++; if (r.reason !== 'named' && r.miss === null && !r.reading) f.abstained++;
  const g = f.perGold[r.gold ?? 'none'] ??= { n: 0, right: 0, otherMiss: 0, unnamed: 0 };
  g.n++; if (r.pass) g.right++; else if (r.miss) g.otherMiss++; else g.unnamed++;
}
console.log();
for (const [fam, f] of Object.entries(byFamily)) {
  console.log(`${fam}: ${f.pass}/${f.total} pass, false positives ${f.falsePositive}, abstained ${f.abstained}`);
  for (const [g, s] of Object.entries(f.perGold)) console.log(`  ${g.padEnd(18)} ${s.right}/${s.n}  wrong-miss ${s.otherMiss}  unnamed ${s.unnamed}`);
}
const fp = results.filter(r => r.falsePositive).length;
console.log(`\nALL: ${results.filter(r => r.pass).length}/${results.length} pass, false positives ${fp}`);
if (OUT) { mkdirSync(dirname(OUT), { recursive: true }); writeFileSync(OUT, JSON.stringify({ runs: RUNS, byFamily, results }, null, 2)); }
