// Real HTTP judge + adult synthetic WAVs. Does not establish child-voice validity.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';
const root = resolve('../artifacts/literacy-grade2-design');
const cases = [
  ['accurate', 'Yesterday, Sam rode to the pond.', 'matched'],
  ['substitution', 'Yesterday, Sam rode to the pond.', 'mismatch'],
  ['synonym', 'The small duck swam away.', 'mismatch'],
  ['homophone', 'I read the red book.', 'uncertain-or-matched'],
  ['incomplete', 'Yesterday, Sam rode to the pond.', 'uncertain'],
  ['silence', 'Yesterday, Sam rode to the pond.', 'uncertain'],
];
// A valid two-second mono PCM WAV containing only silence.
const silence = Buffer.alloc(44 + 16000 * 2 * 2);
silence.write('RIFF'); silence.writeUInt32LE(silence.length - 8, 4); silence.write('WAVEfmt ', 8);
silence.writeUInt32LE(16, 16); silence.writeUInt16LE(1, 20); silence.writeUInt16LE(1, 22);
silence.writeUInt32LE(16000, 24); silence.writeUInt32LE(32000, 28); silence.writeUInt16LE(2, 32);
silence.writeUInt16LE(16, 34); silence.write('data', 36); silence.writeUInt32LE(silence.length - 44, 40);
const results = [];
for (const [name, text, expected] of process.argv.includes('--analyze-saved') ? [] : cases) {
  const audio = name === 'silence' ? silence : readFileSync(resolve(root, `reading-repair-audio/${name}.wav`));
  const start = Date.now();
  const response = await fetch('http://localhost:3000/api/lumina/reading-repair-judge', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, audioBase64: audio.toString('base64') }),
    signal: AbortSignal.timeout(60000) });
  const verdict = await response.json();
  const pass = expected === 'uncertain-or-matched' ? verdict.status !== 'mismatch' : verdict.status === expected;
  results.push({ name, expected, httpStatus: response.status, latencyMs: Date.now() - start, verdict, pass });
  console.log(JSON.stringify(results.at(-1)));
}
if (process.argv.includes('--analyze-saved')) results.push(...JSON.parse(readFileSync(resolve(root, 'reading-repair-audio-results.json'), 'utf8')).results);
const compiled = ts.transpileModule(readFileSync('src/components/lumina/primitives/visual-primitives/literacy/readingRepairEvidence.ts', 'utf8'),
  { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020 } }).outputText;
const { classifyReadingRepair } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const attempt = (name, selectedIndexes = [], supportBeforeReading = false) => ({ verdict: results.find(row => row.name === name).verdict,
  selectedIndexes, supportBeforeReading, durationMs: 4000, capturedAt: new Date().toISOString() });
const outcomeChecks = [
  ['accurate_first_read', [attempt('accurate')]],
  ['independent_repair', [attempt('substitution'), attempt('accurate', [2])]],
  ['supported_repair', [attempt('substitution'), attempt('accurate', [2], true)]],
  ['unresolved_error', [attempt('substitution')]],
  ['unassessable', [attempt('silence'), attempt('accurate', [2])]],
].map(([expected, attempts]) => ({ expected, actual: classifyReadingRepair(attempts) }));
writeFileSync(resolve(root, 'reading-repair-audio-results.json'), JSON.stringify({ source: 'Windows adult synthetic speech; not child voices', results, outcomeChecks }, null, 2));
assert(outcomeChecks.every(row => row.actual === row.expected), 'Real-audio evidence classification finding');
console.log(JSON.stringify({ outcomeChecks }));
assert(results.every(row => row.pass && row.httpStatus === 200), 'Audio bench finding; inspect saved results');
