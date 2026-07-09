import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkAnswerVariety, checkUniqueOptions } from './helpers';

/**
 * Analog-clock oracle — a CALCULATION oracle for the tell-time family (read,
 * match, elapsed, set_time). Its flagship guarantee is answer-key-desync: the
 * multiple-choice option the student is graded against must actually READ as the
 * time the clock shows (read/match) or equal the true elapsed duration (elapsed) —
 * the vocabulary-explorer class (a correct read marked wrong) fused with the
 * "correct answer isn't among the options" class (correctOptionIndex points at the
 * wrong / a missing option).
 *
 * The component (AnalogClock.tsx) judges correctness in handleCheckAnswer (:661):
 *  - read / match (:667-669): correct = selectedOption === correctOptionIndex,
 *    options rendered from option0..option3. The clock displays targetHour:
 *    targetMinute (formatTime, :130-133), so the real contract is that the option
 *    at correctOptionIndex PARSES to (targetHour, targetMinute) — reading the clock
 *    correctly must select it.
 *  - elapsed (:675-677): correct = selectedOption === correctOptionIndex. The
 *    generator frames this TWO ways (both graded by index, NOT disambiguable from
 *    the data alone — only the question text separates them): "how much time
 *    passed?" → the option is a DURATION (words "30 minutes" OR stopwatch "H:MM"
 *    where "1:15" = 75 min); "what time is it after…?" → the option is the END CLOCK
 *    TIME (== target). target/start hold the END/START clock times, so the correct
 *    option is valid iff it reads as the end time OR equals the elapsed Δ minutes on
 *    a 12-hour dial; an option matching NEITHER is a genuine desync. elapsedDescription
 *    (always a duration) must corroborate Δ. Because the two framings share the
 *    "H:MM" surface, the residual "which framing did the QUESTION intend" contract is
 *    recorded in uncheckedTypes — the union check is the sound, false-positive-free floor.
 *  - set_time (:670-674): correct = the DIALED time (displayHour%12, displayMinute)
 *    === (targetHour%12, targetMinute). No answer key beyond the target and no MC —
 *    the student manipulates the clock, so nothing can desync; only schema + scope
 *    (minute granularity) apply.
 *
 * THE INDEPENDENCE RULE: the oracle never trusts correctOptionIndex by itself. For
 * read/match it re-parses the option string at that index into (h, m) and checks it
 * equals the target the clock shows. For elapsed it recomputes the duration from the
 * start & end times the same way a student counts around the dial (Δ minutes mod
 * 12h) and checks the pointed-at option parses to that many minutes. A generator
 * that stamped the wrong index, listed an option that misreads the dial, or stored a
 * duration that doesn't match start→end can no longer false-pass.
 *
 * Checks:
 *  - answer-key-desync : correctOptionIndex references a present option; read/match —
 *    that option parses to (targetHour, targetMinute); elapsed — that option parses
 *    to (target − start) minutes AND elapsedDescription agrees.
 *  - scope             : minute granularity honors the objective. A "to the hour"
 *    topic must have targetMinute 0; "to the half hour" → {0,30}; "to five minutes"
 *    / "nearest five" → a multiple of 5. Only bites when the topic NAMES a
 *    granularity (else there is nothing to check — documented, not a silent skip).
 *  - clustering        : the produced answers spread (read/match times, elapsed
 *    durations don't all collapse to one), and no exact-duplicate card.
 *  - schema            : ≥3 challenges (mastery-over-demo); targetHour 1-12,
 *    targetMinute 0-59 integers; MC modes have ≥2 present, duplicate-free options and
 *    an in-range correctOptionIndex; elapsed carries numeric start hour/minute.
 *
 * Deliberately NOT checked: answer-leak. read/match/elapsed prompts describe the
 * task ("What time is shown?") and never state the answer, while set_time is TOLD
 * the target by design (the student's job is to dial it). The digital-echo leak
 * lever is a support-tier decision the generator already gates (showDigitalEcho only
 * on set_time), which /eval-test owns. A data-level leak test would have nothing
 * honest to bite on here.
 */

const KNOWN_TYPES = new Set(['read', 'match', 'elapsed', 'set_time']);
const MC_TYPES = new Set(['read', 'match', 'elapsed']);

function isInt(v: unknown): v is number {
  return Number.isInteger(v);
}

/** Minutes-since-12 on a 12-hour dial (12/0 collapse). */
function dialMinutes(hour: number, minute: number): number {
  return (((hour % 12) + 12) % 12) * 60 + minute;
}

/** Parse an "H:MM" option into dial minutes, or null. */
function parseClockOption(s: unknown): number | null {
  if (typeof s !== 'string') return null;
  const m = s.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (min > 59) return null;
  return dialMinutes(h, min);
}

/**
 * Parse a duration option → minutes, or null. The generator writes elapsed
 * durations two ways: words ("1 hour 15 minutes", "45 minutes", "2 hours") AND a
 * stopwatch "H:MM" form where the value is H hours + MM minutes ("0:30" = 30,
 * "1:15" = 75, "1:00" = 60) — NOT a clock time. Both are handled here.
 */
function parseDurationOption(s: unknown): number | null {
  if (typeof s !== 'string') return null;
  const lower = s.toLowerCase();
  let total = 0;
  let matched = false;
  const hourMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/);
  if (hourMatch) { total += parseFloat(hourMatch[1]) * 60; matched = true; }
  const minMatch = lower.match(/(\d+)\s*(?:minutes?|mins?|m)\b/);
  if (minMatch) { total += parseInt(minMatch[1], 10); matched = true; }
  // "half hour" / "quarter hour" fallbacks.
  if (!matched && /half\s+(?:an?\s+)?hour/.test(lower)) { total = 30; matched = true; }
  if (!matched && /quarter\s+(?:of\s+an?\s+)?hour/.test(lower)) { total = 15; matched = true; }
  // Stopwatch "H:MM" duration (hours:minutes), e.g. "1:15" = 75 min.
  if (!matched) {
    const hmm = s.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (hmm && parseInt(hmm[2], 10) <= 59) { total = parseInt(hmm[1], 10) * 60 + parseInt(hmm[2], 10); matched = true; }
  }
  return matched ? total : null;
}

/** Minute granularity the topic demands, or null when it names none. */
function granularityFromTopic(topic: string): { label: string; ok: (m: number) => boolean } | null {
  const t = topic.toLowerCase();
  if (/\bto the (?:nearest )?minute\b|\bnearest minute\b/.test(t)) return null; // any minute allowed
  if (/\bhalf[- ]hour\b|\bhalf hours?\b|\bto the half\b/.test(t)) return { label: 'half hour (0 or 30)', ok: (m) => m === 0 || m === 30 };
  if (/\bfive minutes?\b|\bnearest five\b|\bby fives?\b/.test(t)) return { label: 'five minutes (multiple of 5)', ok: (m) => m % 5 === 0 };
  if (/\bquarter hours?\b|\bnearest quarter\b/.test(t)) return { label: 'quarter hour (0/15/30/45)', ok: (m) => m % 15 === 0 };
  if (/\bto the hour\b|\bwhole hours?\b|\bo'?clock\b/.test(t)) return { label: 'the hour (0)', ok: (m) => m === 0 };
  return null;
}

export const analogClockOracle: ContentOracle = {
  componentId: 'analog-clock',
  verify(data, ctx): OracleResult {
    const violations: OracleViolation[] = [];
    const uncheckedTypes = new Set<string>();
    const challenges = asRecordArray(data.challenges);

    const grain = granularityFromTopic(ctx.topic);

    if (challenges.length < 3) {
      violations.push({
        check: 'schema',
        where: 'challenges',
        detail: `only ${challenges.length} challenge(s) — mastery-over-demo requires 3-6+`,
      });
    }

    const answersByMode: Record<string, Array<string | number>> = {};
    const cardSeen = new Map<string, number>();
    let checked = 0;

    for (let i = 0; i < challenges.length; i++) {
      const c = challenges[i];
      const id = String(c.id ?? `#${i + 1}`);
      const type = String(c.type ?? '');
      if (!KNOWN_TYPES.has(type)) {
        uncheckedTypes.add(type || '(missing type)');
        continue;
      }

      const th = c.targetHour;
      const tm = c.targetMinute;
      if (!isInt(th) || (th as number) < 1 || (th as number) > 12) {
        violations.push({ check: 'schema', where: id, detail: `targetHour must be an integer 1-12; got ${JSON.stringify(th)}` });
        continue;
      }
      if (!isInt(tm) || (tm as number) < 0 || (tm as number) > 59) {
        violations.push({ check: 'schema', where: id, detail: `targetMinute must be an integer 0-59; got ${JSON.stringify(tm)}` });
        continue;
      }
      const targetHour = th as number;
      const targetMinute = tm as number;

      // ── scope: minute granularity honors a topic that names one ──
      if (grain && !grain.ok(targetMinute)) {
        violations.push({
          check: 'scope',
          where: id,
          detail: `targetMinute ${targetMinute} violates the objective granularity "${grain.label}" (topic "${ctx.topic}")`,
        });
      }

      if (type === 'set_time') {
        // No MC key — the student dials the target. Schema + scope only.
        checked++;
        (answersByMode.set_time ??= []).push(`${targetHour}:${targetMinute}`);
        bump(cardSeen, `set_time|${targetHour}:${targetMinute}`);
        continue;
      }

      // MC modes: read/match/elapsed.
      const options = [c.option0, c.option1, c.option2, c.option3];
      const present = options.filter((o) => o !== undefined && o !== null) as unknown[];
      if (present.length < 2) {
        violations.push({ check: 'schema', where: id, detail: `${type} needs ≥2 options (option0..option3); got ${JSON.stringify(options)}` });
        continue;
      }
      const dup = checkUniqueOptions(present, id);
      if (dup) violations.push(dup);

      const coi = c.correctOptionIndex;
      if (!isInt(coi) || (coi as number) < 0 || (coi as number) > 3 || options[coi as number] === undefined || options[coi as number] === null) {
        violations.push({
          check: 'answer-key-desync',
          where: id,
          detail: `correctOptionIndex ${JSON.stringify(coi)} does not reference a present option (option0..option3=${JSON.stringify(options)}) — the correct answer can never be selected`,
        });
        continue;
      }
      const correctOption = options[coi as number];
      checked++;

      if (MC_TYPES.has(type) && type !== 'elapsed') {
        // ── read / match: the pointed-at option must READ as the shown time. ──
        const parsed = parseClockOption(correctOption);
        if (parsed === null) {
          violations.push({ check: 'schema', where: id, detail: `${type} correct option "${String(correctOption)}" is not an "H:MM" time string` });
        } else if (parsed !== dialMinutes(targetHour, targetMinute)) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `correct option "${String(correctOption)}" does not read as the shown time ${targetHour}:${String(targetMinute).padStart(2, '0')} — reading the clock correctly would be marked wrong`,
          });
        }
        (answersByMode[type] ??= []).push(dialMinutes(targetHour, targetMinute));
        bump(cardSeen, `${type}|${targetHour}:${targetMinute}`);
      } else {
        // ── elapsed: the generator frames this TWO ways, both graded by index and
        //    NOT disambiguable from the data alone (only the question text tells them
        //    apart): "how much time passed?" → the option is the DURATION (words
        //    "30 minutes" OR stopwatch "H:MM" where "1:15" = 75 min), and "what time
        //    is it after…?" → the option is the END CLOCK TIME (== target). So the
        //    correct option is valid iff it reads as the end time OR equals the
        //    elapsed Δ minutes; an option matching NEITHER is a genuine desync. ──
        const endDial = dialMinutes(targetHour, targetMinute);
        const sh = c.startHour;
        const sm = c.startMinute;
        const haveStart = isInt(sh) && (sh as number) >= 1 && (sh as number) <= 12 && isInt(sm) && (sm as number) >= 0 && (sm as number) <= 59;
        const delta = haveStart ? ((endDial - dialMinutes(sh as number, sm as number)) % 720 + 720) % 720 : null;

        const asEndTime = parseClockOption(correctOption);      // "H:MM" read as a clock time
        const asDuration = parseDurationOption(correctOption);  // words or "H:MM" read as a duration
        const endTimeOk = asEndTime !== null && asEndTime === endDial;
        const durationOk = delta !== null && asDuration !== null && asDuration === delta;
        // An "H:MM" option is BOTH a plausible clock time and a plausible duration —
        // which one the QUESTION intends isn't recoverable from the data.
        if (asEndTime !== null && asDuration !== null) uncheckedTypes.add('elapsed(H:MM framing — see question text)');

        if (asEndTime === null && asDuration === null) {
          violations.push({ check: 'schema', where: id, detail: `elapsed correct option "${String(correctOption)}" is neither an "H:MM" time nor a parseable duration` });
        } else if (delta === null && asEndTime === null) {
          // Duration-framed with no start time to check against.
          uncheckedTypes.add('elapsed(no start time)');
        } else if (!endTimeOk && !durationOk) {
          const durMsg = delta !== null ? `the true elapsed ${delta} min` : 'the elapsed duration (no start time)';
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `correct option "${String(correctOption)}" is neither the end time ${targetHour}:${String(targetMinute).padStart(2, '0')} nor ${durMsg} from ${String(sh)}:${String(sm).padStart(2, '0')} — a correct answer would be marked wrong`,
          });
        }
        // elapsedDescription (always a duration) must corroborate the true Δ.
        const descDur = parseDurationOption(c.elapsedDescription);
        if (delta !== null && descDur !== null && descDur !== delta) {
          violations.push({
            check: 'answer-key-desync',
            where: id,
            detail: `elapsedDescription "${String(c.elapsedDescription)}" (${descDur} min) disagrees with the true elapsed ${delta} min`,
          });
        }
        (answersByMode.elapsed ??= []).push(delta ?? endDial);
        bump(cardSeen, `elapsed|${String(c.startHour)}:${String(c.startMinute)}>${targetHour}:${targetMinute}`);
      }
    }

    // ── clustering: answers spread within each mode ──
    for (const [mode, vals] of Object.entries(answersByMode)) {
      const variety = checkAnswerVariety(vals, `${mode}[].answer`);
      if (variety) violations.push(variety);
    }
    // ── clustering: no exact-duplicate card ──
    cardSeen.forEach((count, key) => {
      if (count > 1) {
        violations.push({ check: 'clustering', where: 'challenges[]', detail: `identical card "${key}" appears ${count}× — a duplicated challenge` });
      }
    });

    return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
  },
};

function bump(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}
