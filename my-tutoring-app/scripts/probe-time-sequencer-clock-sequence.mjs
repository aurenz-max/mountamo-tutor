// time-sequencer `clock-sequence` probe (2026-09-09) — the K home built for
// TIME001-03-G, the third row the 2026-09-08 band-floor re-audit left homeless
// (qa/reader-fit/k-band-floor-2026-09-08.md).
//
// The row asks the child to connect whole-hour times to daily activities IN
// SEQUENCE. The review redirected it to analog-clock `read` for the reading half
// and sequence-5 for the ordering half; a 2026-09-09 probe of both showed
// neither carries it (read has no sequence and answers with printed digital
// times; sequence-5 bans clock times at K by design). This mode puts the two
// halves on one card.
//
// The checks are all integrity checks on the FACE, because the face is the only
// cue the child has: whole hours, distinct hours, one half of the day, and hours
// that rise along correctOrder.
//
//   node scripts/probe-time-sequencer-clock-sequence.mjs [out.json] [--draws=3]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createServer, createServerModuleRunner } from 'vite';

const root = process.cwd();
if (!process.env.GEMINI_API_KEY) {
  const match = readFileSync(resolve(root, '.env.local'), 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (match) process.env.GEMINI_API_KEY = match[1].trim().replace(/^["']|["']$/g, '');
}
const args = process.argv.slice(2);
const output = resolve(
  root,
  args.find((a) => a.endsWith('.json') && !a.startsWith('--'))
    || 'qa/eval-reports/time-sequencer-clock-sequence-2026-09-09.json',
);
const draws = Number((args.find((a) => a.startsWith('--draws=')) || '--draws=3').slice(8));

const TOPIC = 'Connect whole-hour times to daily activities in sequence';
const CASES = [
  { row: 'TIME001-03-G', grade: 'Kindergarten', band: 'K', tier: '' },
  { row: 'TIME001-03-G', grade: 'Kindergarten', band: 'K', tier: 'easy' },
  { row: 'TIME001-03-G', grade: 'Kindergarten', band: 'K', tier: 'hard' },
  { row: 'G1-control', grade: 'Grade 1', band: '1', tier: '' },
];

// A printed clock time is the reading demand the FACE exists to replace. The
// face itself is not text, so it is not matched here.
const PRINTED_TIME = /\d{1,2}\s*:\s*\d{2}/;

const server = await createServer({
  configFile: false, root, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});

const evidence = { startedAt: new Date().toISOString(), mode: 'clock-sequence', topic: TOPIC, draws: [] };
const save = () => { mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(evidence, null, 2)); };

try {
  const runner = createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { generateTimeSequencer } = await runner.import('/src/components/lumina/service/math/gemini-time-sequencer.ts');

  for (const kase of CASES) {
    for (let i = 1; i <= draws; i++) {
      const label = kase.row + ' ' + kase.band + (kase.tier ? '/' + kase.tier : '/none') + ' draw ' + i;
      const failures = [];
      const note = (ok, msg) => { if (!ok) failures.push(msg); };

      let data;
      try {
        data = await generateTimeSequencer({
          topic: TOPIC,
          gradeContext: kase.grade,
          intent: TOPIC,
          scope: { topic: TOPIC, objectiveText: TOPIC, intent: TOPIC },
          raw: {
            targetEvalMode: 'clock-sequence',
            gradeBand: kase.band,
            objectiveText: TOPIC,
            ...(kase.tier ? { difficulty: kase.tier } : {}),
          },
        });
      } catch (err) {
        evidence.draws.push({ label, error: String(err) });
        console.log('x ' + label + ': threw ' + err);
        save();
        continue;
      }

      const challenges = data.challenges ?? [];
      note(challenges.length >= 3, 'only ' + challenges.length + ' challenge(s) — mastery needs 3+');
      note(data.gradeBand === kase.band, 'gradeBand is ' + data.gradeBand + ', expected ' + kase.band);
      note(!PRINTED_TIME.test(data.title || ''), 'the title prints a clock time: ' + data.title);
      note(!PRINTED_TIME.test(data.description || ''), 'the description prints a clock time');

      for (const c of challenges) {
        note(c.type === 'clock-sequence', c.id + ' is ' + c.type + ', not the pinned type');
        if (c.type !== 'clock-sequence') continue;

        // The face is structural: no tier may withdraw it.
        note(c.showClockFace === true, c.id + ': showClockFace is not set — the cards carry no clock');
        note(c.showTimeAnchors !== true, c.id + ': printed time anchors are on, which is the reading demand the face replaces');
        note(c.showSkyCue !== true, c.id + ': the sun strip is on, so the child can order without reading a hand');

        const events = c.events ?? [];
        note(events.length >= 3, c.id + ': only ' + events.length + ' card(s)');
        note(events.length <= 4, c.id + ': ' + events.length + ' cards exceeds the four-card window');

        const hours = [];
        for (const ev of events) {
          note(ev.clockHour !== undefined && ev.clockHour !== null,
            c.id + '/' + ev.id + ': no clockHour — nothing to draw the face from');
          note(/^\s*\d{1,2}:00\s*(AM|PM)?\s*$/i.test(ev.typicalTime || ''),
            c.id + '/' + ev.id + ': typicalTime ' + JSON.stringify(ev.typicalTime) + ' is not a whole hour');
          hours.push(ev.clockHour);
        }
        note(new Set(hours).size === hours.length,
          c.id + ': two cards share a dial hour, so their faces are identical');

        // One half of the day: a 12-hour face cannot separate 8 AM from 8 PM.
        const halves = events.map((ev) => /pm/i.test(ev.typicalTime || '') ? 'pm' : 'am');
        note(new Set(halves).size === 1, c.id + ': the set crosses noon — two faces could mean either half');

        // THE FACE MUST NOT LIE: the hours have to rise along correctOrder.
        const byId = new Map(events.map((ev) => [ev.id, ev.clockHour]));
        const ordered = (c.correctOrder || []).map((id) => byId.get(id));
        note(ordered.length === events.length, c.id + ': correctOrder does not cover every card');
        note(ordered.every((h, j) => j === 0 || (h > ordered[j - 1])),
          c.id + ': the clock hours do not rise along correctOrder — the face contradicts the answer');

        note(!PRINTED_TIME.test(c.instruction || ''), c.id + ': the instruction prints a clock time');
        note(!PRINTED_TIME.test(c.hint || ''), c.id + ': the hint prints a clock time');
      }

      const keys = challenges.map((c) => (c.events || []).map((e) => e.label).join('>'));
      note(new Set(keys).size >= Math.min(3, keys.length),
        'only ' + new Set(keys).size + ' distinct card set(s) across ' + keys.length + ' challenges');

      evidence.draws.push({
        label, failures, title: data.title, description: data.description, gradeBand: data.gradeBand,
        challenges: challenges.map((c) => ({
          id: c.id, type: c.type, instruction: c.instruction, hint: c.hint,
          showClockFace: c.showClockFace, showTimeAnchors: c.showTimeAnchors, showSkyCue: c.showSkyCue,
          prelabelFirstSlot: c.prelabelFirstSlot,
          events: (c.events || []).map((e) => ({ id: e.id, label: e.label, emoji: e.emoji, typicalTime: e.typicalTime, clockHour: e.clockHour })),
          correctOrder: c.correctOrder,
        })),
      });
      console.log((failures.length === 0 ? 'PASS ' : 'FAIL ') + label + ': ' + challenges.length + ' challenges, ' + failures.length + ' failure(s)');
      for (const f of failures.slice(0, 6)) console.log('    - ' + f);
      save();
    }
  }
} finally {
  await server.close();
}

const failed = evidence.draws.filter((d) => d.error || (d.failures || []).length > 0);
evidence.summary = { draws: evidence.draws.length, failedDraws: failed.length };
save();
console.log('\n' + (evidence.draws.length - failed.length) + '/' + evidence.draws.length + ' draws clean -> ' + output);
process.exit(failed.length === 0 ? 0 : 1);
