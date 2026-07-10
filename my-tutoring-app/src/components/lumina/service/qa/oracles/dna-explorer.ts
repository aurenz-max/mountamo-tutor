import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray, checkAnswerVariety, containsWord } from './helpers';

/**
 * DNA-explorer oracle. Base pairing is deterministic (A↔T, C↔G), which makes
 * this primitive fully solvable independently of the generator's LLM output —
 * the strongest kind of oracle target.
 *
 * The component judges a build challenge by string-comparing the student's
 * complementary strand to `challenge.correctAnswer` (DnaExplorer.tsx handleCheck:
 * uppercase + strip whitespace, then ===). So the desync bug is: correctAnswer
 * is NOT the true complement of givenStrand — a student who applies base pairing
 * correctly gets marked wrong. This oracle re-derives every complement from the
 * pairing rules and never trusts the shipped correctAnswer.
 *
 * Checks:
 * - answer-key-desync: each buildChallenge.correctAnswer must equal the
 *   position-wise complement of its givenStrand; sequence.complementaryStrand
 *   must complement templateStrand; each nucleotide.pairsWith / type must follow
 *   the fixed base rules (all displayed as ground truth to the student).
 * - answer-leak: a build challenge whose givenStrand is the Explore-tab
 *   templateStrand (or whose correctAnswer is the visible complementaryStrand)
 *   lets the student read the answer straight off the Explore tab; the task text
 *   must not spell out the answer.
 * - clustering: correctAnswers across the challenge set must vary.
 * - schema: bases must be A/T/C/G; strand lengths must match; ≥2 challenges.
 *
 * Free-text structural descriptions and zoom-level copy are not answer-bearing,
 * so their factual accuracy is left to /eval-test (reported in uncheckedTypes).
 */

const COMPLEMENT: Record<string, string> = { A: 'T', T: 'A', C: 'G', G: 'C' };
const PURINES = new Set(['A', 'G']);

/** Normalize a strand the way the component does before comparing (uppercase, no whitespace). */
function norm(s: unknown): string {
  return String(s ?? '').toUpperCase().replace(/\s/g, '');
}

export const dnaExplorerOracle: ContentOracle = {
  componentId: 'dna-explorer',
  verify(data, _ctx): OracleResult {
    const violations: OracleViolation[] = [];
    const uncheckedTypes = new Set<string>();
    let checked = 0;

    // --- Sequence: displayed complementary strand must pair with the template. ---
    const sequence = (typeof data.sequence === 'object' && data.sequence !== null)
      ? (data.sequence as Record<string, unknown>)
      : {};
    const template = norm(sequence.templateStrand);
    const complementary = norm(sequence.complementaryStrand);
    if (template) {
      checked++;
      if (complementary.length !== template.length) {
        violations.push({
          check: 'answer-key-desync',
          where: 'sequence',
          detail: `complementaryStrand length ${complementary.length} != templateStrand length ${template.length}`,
        });
      }
      for (let i = 0; i < template.length; i++) {
        const base = template[i];
        if (!COMPLEMENT[base]) {
          violations.push({ check: 'schema', where: 'sequence', detail: `templateStrand has non-DNA base "${base}" at position ${i}` });
          continue;
        }
        if (complementary[i] && complementary[i] !== COMPLEMENT[base]) {
          violations.push({
            check: 'answer-key-desync',
            where: 'sequence',
            detail: `position ${i}: template ${base} must pair with ${COMPLEMENT[base]}, but complementaryStrand shows ${complementary[i]}`,
          });
        }
      }
    }

    // --- Nucleotide reference facts are deterministic. ---
    for (const nuc of asRecordArray(data.nucleotides)) {
      const base = norm(nuc.base);
      if (!COMPLEMENT[base]) continue; // enum-constrained; skip anything unexpected
      checked++;
      const pairsWith = norm(nuc.pairsWith);
      if (pairsWith !== COMPLEMENT[base]) {
        violations.push({
          check: 'answer-key-desync',
          where: `nucleotide(${base})`,
          detail: `pairsWith="${pairsWith}" but ${base} pairs with ${COMPLEMENT[base]}`,
        });
      }
      const type = String(nuc.type ?? '').toLowerCase();
      const expectedType = PURINES.has(base) ? 'purine' : 'pyrimidine';
      if (type && type !== expectedType) {
        violations.push({
          check: 'answer-key-desync',
          where: `nucleotide(${base})`,
          detail: `type="${type}" but ${base} is a ${expectedType}`,
        });
      }
      // Bond count is factual: A-T = 2 hydrogen bonds, C-G = 3. Only flag a clearly wrong count.
      const bond = String(nuc.bondType ?? '');
      const wantsTwo = base === 'A' || base === 'T';
      if (wantsTwo && /\b3\b/.test(bond) && !/\b2\b/.test(bond)) {
        violations.push({ check: 'answer-key-desync', where: `nucleotide(${base})`, detail: `bondType="${bond}" but ${base}-${COMPLEMENT[base]} has 2 hydrogen bonds` });
      }
      if (!wantsTwo && /\b2\b/.test(bond) && !/\b3\b/.test(bond)) {
        violations.push({ check: 'answer-key-desync', where: `nucleotide(${base})`, detail: `bondType="${bond}" but ${base}-${COMPLEMENT[base]} has 3 hydrogen bonds` });
      }
    }

    // --- Build challenges: the core interactive answer key. ---
    const challenges = asRecordArray(data.buildChallenges);
    if (challenges.length < 2) {
      violations.push({
        check: 'schema',
        where: 'buildChallenges',
        detail: `only ${challenges.length} build challenge(s); the primitive expects 2-4 (mastery over demo)`,
      });
    }
    const correctAnswers: string[] = [];
    for (let i = 0; i < challenges.length; i++) {
      const c = challenges[i];
      const where = `buildChallenge#${i + 1}`;
      const given = norm(c.givenStrand);
      const answer = norm(c.correctAnswer);
      checked++;
      correctAnswers.push(answer);

      // Blanks contradict the no-blank contract and break the fixed-length input.
      if (/[^ATCG]/.test(given)) {
        violations.push({ check: 'schema', where, detail: `givenStrand "${given}" has non-DNA/blank characters (contract: full A/T/C/G template)` });
      }
      if (/[^ATCG]/.test(answer)) {
        violations.push({ check: 'schema', where, detail: `correctAnswer "${answer}" has non-DNA characters` });
      }
      if (given.length !== answer.length) {
        violations.push({ check: 'answer-key-desync', where, detail: `correctAnswer length ${answer.length} != givenStrand length ${given.length}` });
      }
      // The desync check: independently complement the template, compare to shipped key.
      const expected = given.split('').map((b) => COMPLEMENT[b] ?? '?').join('');
      if (!/\?/.test(expected) && expected !== answer) {
        violations.push({
          check: 'answer-key-desync',
          where,
          detail: `oracle complements "${given}" to "${expected}" but shipped correctAnswer="${answer}"`,
        });
      }
      // Leak: the answer is visible on the Explore tab if this challenge reuses the sequence strands.
      if (given && given === template) {
        violations.push({ check: 'answer-leak', where, detail: `givenStrand equals the Explore-tab templateStrand — its answer is displayed as complementaryStrand` });
      } else if (answer && answer === complementary) {
        violations.push({ check: 'answer-leak', where, detail: `correctAnswer equals the visible complementaryStrand — readable off the Explore tab` });
      }
      // Leak: the task text must not spell out the answer.
      const task = String(c.task ?? '');
      if (answer && containsWord(task, answer)) {
        violations.push({ check: 'answer-leak', where, detail: `task text contains the answer "${answer}"` });
      }
    }

    const cluster = checkAnswerVariety(correctAnswers, 'buildChallenges');
    if (cluster) violations.push(cluster);

    // Answer-bearing content is fully checked; free-text copy is /eval-test's job.
    if (asRecordArray(data.zoomLevels).length > 0) uncheckedTypes.add('zoomLevels(descriptive text)');
    if (data.structuralFeatures) uncheckedTypes.add('structuralFeatures(descriptive text)');

    return { violations, uncheckedTypes: Array.from(uncheckedTypes), checkedChallenges: checked };
  },
};
