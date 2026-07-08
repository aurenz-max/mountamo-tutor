import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkAnswerVariety, parseScopeCeiling } from './helpers';

/**
 * Tape-diagram oracle — a CALCULATION oracle for the part-part-whole / comparison
 * tape family. Its flagship check is the parts-sum-to-whole desync: the primitive
 * ships a `totalLabel` ("Total = N") on each partition bar, but the COMPONENT never
 * trusts that label — every answer it grades is derived live from the segment
 * `value`s. So a stored whole that disagrees with Σ segments is a real desync: the
 * apply-phase bracket (and the mental model the student builds) shows a total the
 * parts do not add up to.
 *
 * The component (TapeDiagram.tsx) judges correctness segment-by-segment — there is
 * NO stored per-segment answer key; the segment's own `value` IS the key:
 *  - represent       (handleRepresentSubmit, :798):  isCorrect = |userVal - segment.value| < 0.01
 *  - solve_part_whole (handlePartWholeSubmit, :918):  same tolerance test per unknown segment;
 *    the Explore "find the whole" step (handleCheckWhole, :889-898) computes
 *    actualTotal = segment[0].value + segment[1].value (the first two known parts)
 *    LIVE and grades |inputWhole - actualTotal| < 0.01 — never reading totalLabel.
 *  - solve_comparison (handleComparisonSubmit, :1069): same tolerance test per unknown segment.
 *  - multi_step       (handleMultiStepSubmit, :1174):  same tolerance test per solve-order segment.
 *  In every mode: `if (segment?.value === undefined) return;` — an UNKNOWN segment
 *  with no value can never be submitted, so its correct state is unreachable (the
 *  array-grid "unreachable correct state" class). And with zero unknown segments a
 *  challenge has no gradable task at all.
 *
 * THE INDEPENDENCE RULE: the oracle re-derives the whole a DIFFERENT way than any
 * shipped field — it sums the segment `value`s itself and checks that the stored
 * `totalLabel` number equals that sum (parts-sum-to-whole), never trusting the
 * label. For comparison it re-derives difference = quantity1 - quantity2 from the
 * two quantities and checks the stored `comparisonData.difference` agrees, and that
 * the unknown segment's value is the quantity `unknownPart` names. A generator that
 * stored a whole/difference with a shared arithmetic bug can no longer false-pass.
 *
 * Checks:
 *  - answer-key-desync : (1) each segment `value` is a finite non-negative number;
 *    an UNKNOWN segment missing its value is unsolvable. (2) every challenge has
 *    ≥1 unknown segment (else nothing to grade). (3) each "Total = N" label equals
 *    Σ of that bar's segment values. (4) comparison — difference = q1 - q2, q1 ≥ q2,
 *    and the unknown segment value matches the quantity `unknownPart` selects.
 *  - scope             : every magnitude the student reads OR produces honors the
 *    objective ceiling — each segment value, the part-whole Explore total
 *    (seg0 + seg1, the whole the student types), and the comparison quantities.
 *    Ceiling = ctx.scopeMax ?? topic ceiling ("within 100") ?? a grade-band intrinsic.
 *    (Multi-step's Σ-of-segments is NOT scoped — it double-counts intermediates and
 *    is not a magnitude the student ever produces; only the individual values are.)
 *  - clustering        : no exact-duplicate diagram (same ordered segments+flags per
 *    bar twice — a byte-identical card), and — for 4+ challenge sets — the per-
 *    challenge whole must spread (checkAnswerVariety). The variety check is gated to
 *    ≥4 challenges because part_whole/multi_step sessions ship only 3, where a single
 *    legitimately-repeated total is 67% and would false-fire.
 *  - schema            : ≥3 challenges (mastery-over-demo); known challengeType; each
 *    bar non-empty; ≥2 segments total per challenge, and for the single-bar modes
 *    (represent/part_whole/multi_step) ≥2 segments in that bar (a partition needs ≥2
 *    parts). Comparison bars legitimately carry a SINGLE segment (find-larger /
 *    find-smaller modes put one quantity per bar), so the ≥2-per-bar rule is applied
 *    to the whole challenge, not each comparison bar.
 *
 * Deliberately NOT checked: answer-leak. Every mode states its stimulus by design —
 * represent/comparison/multi_step print the word problem (the numbers ARE the task
 * the student must extract and place), and the segment values render on known parts
 * as the scaffold for finding the unknown. The unknown/answer segment is hidden by
 * the component at every tier regardless of the data, so there is no textual answer
 * field to leak. A leak test would fire on the intended stimulus — worse than an
 * honest gap. Leak/tone/quality stays with /eval-test.
 */

const KNOWN_TYPES = new Set(['represent', 'solve_part_whole', 'solve_comparison', 'multi_step']);

// Grade-band intrinsic ceiling when neither the harness nor the topic names one.
// Generous (must accommodate a legitimate multi-part Explore sum) — the scope
// check gets its teeth from a scope-bearing topic ("within 100"), per the skill.
function intrinsicCeiling(gradeLevel: string): number {
  if (/\b(k|kindergarten|[0-2])\b/i.test(gradeLevel)) return 40;
  if (/[3-5]/.test(gradeLevel)) return 200;
  return 1000;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** Parse the numeric total out of a "Total = N" label; undefined for text/"Total = ?". */
function parseStoredTotal(label: unknown): number | undefined {
  if (typeof label !== 'string') return undefined;
  const m = label.match(/^\s*total\s*=\s*(-?\d+(?:\.\d+)?)\s*$/i);
  return m ? parseFloat(m[1]) : undefined;
}

export const tapeDiagramOracle: ContentOracle = {
  componentId: 'tape-diagram',
  verify(data, ctx): OracleResult {
    const violations: OracleViolation[] = [];
    const uncheckedTypes = new Set<string>();
    const challenges = asRecordArray(data.challenges);

    const ceiling = ctx.scopeMax ?? parseScopeCeiling(ctx.topic) ?? intrinsicCeiling(ctx.gradeLevel);

    if (challenges.length < 3) {
      violations.push({
        check: 'schema',
        where: 'challenges',
        detail: `only ${challenges.length} challenge(s) — mastery-over-demo requires 3-6+`,
      });
    }

    const wholes: number[] = [];
    const cardSeen = new Map<string, number>();
    let checked = 0;

    for (let i = 0; i < challenges.length; i++) {
      const c = challenges[i];
      const id = String(c.id ?? `#${i + 1}`);
      const type = String(c.challengeType ?? '');
      const isComparison = type === 'solve_comparison';

      if (!KNOWN_TYPES.has(type)) {
        uncheckedTypes.add(type || '(missing challengeType)');
        continue;
      }

      const bars = asRecordArray(c.bars);
      if (bars.length === 0) {
        violations.push({ check: 'schema', where: id, detail: `no bars — a tape diagram needs at least one bar` });
        continue;
      }

      // Gather every segment across the bars; validate each value.
      let totalSegs = 0;
      let unknownCount = 0;
      const magnitudes: number[] = [];
      let anyBadValue = false;

      for (let b = 0; b < bars.length; b++) {
        const segs = asRecordArray(bars[b].segments);
        if (segs.length === 0) {
          violations.push({ check: 'schema', where: `${id}.bar${b}`, detail: `bar has no segments` });
          continue;
        }
        totalSegs += segs.length;
        for (let s = 0; s < segs.length; s++) {
          const seg = segs[s];
          const isUnknown = seg.isUnknown === true;
          if (isUnknown) unknownCount++;
          const val = seg.value;
          if (typeof val !== 'number' || !Number.isFinite(val)) {
            anyBadValue = true;
            if (isUnknown) {
              violations.push({
                check: 'answer-key-desync',
                where: `${id}.bar${b}.seg${s}`,
                detail: `unknown segment "${String(seg.label)}" has no numeric value (${JSON.stringify(val)}) — the component returns early on undefined, so its correct state is unreachable`,
              });
            } else {
              violations.push({ check: 'schema', where: `${id}.bar${b}.seg${s}`, detail: `segment value is not a finite number: ${JSON.stringify(val)}` });
            }
            continue;
          }
          if (val < 0) {
            anyBadValue = true;
            violations.push({ check: 'schema', where: `${id}.bar${b}.seg${s}`, detail: `negative segment value ${val}` });
            continue;
          }
          magnitudes.push(val);
        }
      }

      // ── schema: segment-count floors ──
      if (totalSegs < 2) {
        violations.push({ check: 'schema', where: id, detail: `only ${totalSegs} segment(s) — a partition needs ≥2 parts` });
      }
      if (!isComparison) {
        const primary = asRecordArray(bars[0].segments);
        if (primary.length < 2) {
          violations.push({ check: 'schema', where: id, detail: `${type} primary bar has ${primary.length} segment(s) — a partition needs ≥2 parts` });
        }
      }

      // ── answer-key-desync: at least one unknown to grade against ──
      if (unknownCount === 0) {
        violations.push({
          check: 'answer-key-desync',
          where: id,
          detail: `no unknown segment — nothing for the student to solve or the component to grade`,
        });
      }

      // ── answer-key-desync (independence): stored "Total = N" must equal Σ segments ──
      if (!anyBadValue) {
        for (let b = 0; b < bars.length; b++) {
          const stored = parseStoredTotal(bars[b].totalLabel);
          if (stored === undefined) continue; // text label (comparison) or "Total = ?" (unlabeled tier)
          const segs = asRecordArray(bars[b].segments);
          const sum = segs.reduce((acc, seg) => acc + (typeof seg.value === 'number' ? seg.value : 0), 0);
          if (Math.abs(stored - sum) >= 0.01) {
            violations.push({
              check: 'answer-key-desync',
              where: `${id}.bar${b}`,
              detail: `totalLabel says ${stored} but the segments sum to ${sum} — the stored whole disagrees with parts-sum-to-whole`,
            });
          }
        }
      }

      // ── comparison-specific desync + scope inputs ──
      if (isComparison) {
        const cd = c.comparisonData;
        if (!isRecord(cd)) {
          violations.push({ check: 'schema', where: id, detail: `solve_comparison has no comparisonData` });
        } else {
          const q1 = cd.quantity1;
          const q2 = cd.quantity2;
          const storedDiff = cd.difference;
          const unknownPart = String(cd.unknownPart ?? '');
          if (typeof q1 !== 'number' || typeof q2 !== 'number' || typeof storedDiff !== 'number') {
            violations.push({ check: 'schema', where: id, detail: `comparisonData quantities/difference not all numbers: ${JSON.stringify({ q1, q2, storedDiff })}` });
          } else {
            if (q1 < q2) {
              violations.push({ check: 'answer-key-desync', where: id, detail: `quantity1 ${q1} < quantity2 ${q2} — quantity1 must be the larger quantity (the bar assembly assumes q1 = max)` });
            }
            // Independence: derive the difference from the two quantities.
            const expectedDiff = q1 - q2;
            if (Math.abs(storedDiff - expectedDiff) >= 0.01) {
              violations.push({
                check: 'answer-key-desync',
                where: id,
                detail: `difference ${storedDiff} ≠ quantity1 ${q1} − quantity2 ${q2} = ${expectedDiff} — a correct student answer would be marked wrong`,
              });
            }
            // The unknown segment's value must be the quantity unknownPart names.
            const expectedUnknownVal =
              unknownPart === 'difference' ? storedDiff
              : unknownPart === 'quantity1' ? q1
              : unknownPart === 'quantity2' ? q2
              : undefined;
            if (expectedUnknownVal !== undefined) {
              const unknownSeg = bars
                .flatMap((bar) => asRecordArray(bar.segments))
                .find((seg) => seg.isUnknown === true);
              const uv = unknownSeg?.value;
              if (typeof uv === 'number' && Math.abs(uv - expectedUnknownVal) >= 0.01) {
                violations.push({
                  check: 'answer-key-desync',
                  where: id,
                  detail: `unknownPart "${unknownPart}" ⇒ answer ${expectedUnknownVal}, but the unknown segment value is ${uv} — the graded segment disagrees with comparisonData`,
                });
              }
            }
            magnitudes.push(q1, q2, storedDiff);
          }
        }
      }

      // ── scope input: part-whole Explore total (the whole the student types) ──
      if (type === 'solve_part_whole') {
        const primary = asRecordArray(bars[0].segments);
        if (primary.length >= 2 && typeof primary[0].value === 'number' && typeof primary[1].value === 'number') {
          magnitudes.push(primary[0].value + primary[1].value);
        }
      }

      // ── scope: no magnitude the student reads or produces exceeds the ceiling ──
      const maxMag = magnitudes.length ? Math.max(...magnitudes) : 0;
      if (maxMag > ceiling) {
        violations.push({
          check: 'scope',
          where: id,
          detail: `a magnitude ${maxMag} exceeds objective ceiling ${ceiling} (topic "${ctx.topic}")`,
        });
      }

      // whole (clustering signal): comparison → the larger quantity; else Σ primary bar.
      if (isComparison && isRecord(c.comparisonData) && typeof c.comparisonData.quantity1 === 'number') {
        wholes.push(c.comparisonData.quantity1 as number);
      } else {
        const primary = asRecordArray(bars[0].segments);
        wholes.push(primary.reduce((acc, seg) => acc + (typeof seg.value === 'number' ? seg.value : 0), 0));
      }

      // Exact-duplicate diagram key: type + each bar's ordered (value, unknown) list.
      const cardKey = `${type}|` + bars
        .map((bar) => asRecordArray(bar.segments).map((seg) => `${seg.value}${seg.isUnknown === true ? '?' : ''}`).join(','))
        .join(';');
      cardSeen.set(cardKey, (cardSeen.get(cardKey) ?? 0) + 1);

      checked++;
    }

    // ── clustering: whole spread (only for 4+ challenge sets — see header) ──
    if (wholes.length >= 4) {
      const variety = checkAnswerVariety(wholes, 'challenges[].whole');
      if (variety) violations.push(variety);
    }
    // ── clustering: no byte-identical diagram card ──
    cardSeen.forEach((count, key) => {
      if (count > 1) {
        violations.push({ check: 'clustering', where: 'challenges[]', detail: `identical diagram "${key}" appears ${count}× — a duplicated card` });
      }
    });

    return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
  },
};
