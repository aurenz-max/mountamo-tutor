/**
 * Templated sentences for the progress report. Every number comes from the
 * report payload; the wording changes with what the numbers say, so a learner
 * who struggles never reads "ready for harder material". PR-3 replaces these
 * with Gemini prose over the same payload (my-tutoring-app/qa/parent-report/ROADMAP.md).
 */

import type { ProgressReportResponse } from '@/lib/studentAnalyticsAPI';

/** 70-85% correct is the band where practice is hard enough to stretch. */
export const LEARNING_BAND = { low: 70, high: 85 } as const;
/** A difficulty verdict needs this much recent evidence (mirrors the backend digest). */
export const MIN_VERDICT = { weeks: 3, answers: 30 } as const;

const gradeNumber = (g: string | null | undefined) =>
  g === 'PK' ? -1 : g === 'K' ? 0 : g && /^\d+$/.test(g) ? Number(g) : null;

export const gradeName = (g: string) =>
  g === 'K' ? 'Kindergarten' : g === 'PK' ? 'Pre-K' : `Grade ${g}`;

/** True when a skill row is above the report's grade. */
export const isAboveGrade = (rowGrade: string | null | undefined, reportGrade: string) => {
  const a = gradeNumber(rowGrade);
  const b = gradeNumber(reportGrade);
  return a != null && b != null && a > b;
};

export interface ReportText {
  shortAnswer: string;
  learningHeadline: string;
  learningLede: string;
  yearHeadline: string;
  yearLede: string;
  helpHeadline: string;
  helpLede: string;
  aheadShare: number; // 0-100, share of answers above grade
  aheadLine: string;
}

export function buildReportText(r: ProgressReportResponse, name: string): ReportText {
  const active = r.weeks.filter((w) => w.answers > 0);
  const recentActive = active.slice(-8);
  const acc = r.accuracy_recent_weeks;
  const aboveBand = recentActive.filter((w) => (w.accuracy ?? 0) > LEARNING_BAND.high).length;
  const belowBand = recentActive.filter((w) => (w.accuracy ?? 100) < LEARNING_BAND.low).length;
  const steady = active.length >= r.weeks.length * 0.6;

  const mastered = r.grade_map.reduce((a, s) => a + s.mastered, 0);
  const learning = r.grade_map.reduce((a, s) => a + s.learning, 0);
  const total = r.grade_map.reduce((a, s) => a + s.total, 0);
  const topUnits = r.grade_map
    .flatMap((s) => s.units)
    .filter((u) => u.mastered > 0)
    .sort((a, b) => b.mastered / b.total - a.mastered / a.total)
    .slice(0, 2)
    .map((u) => u.title.toLowerCase());

  const mixTotal = r.grade_mix.reduce((a, g) => a + g.answers, 0);
  const aheadN = r.grade_mix.filter((g) => isAboveGrade(g.grade, r.grade)).reduce((a, g) => a + g.answers, 0);
  const aheadShare = mixTotal ? Math.round((aheadN / mixTotal) * 100) : 0;

  const enough = recentActive.length >= MIN_VERDICT.weeks
    && recentActive.reduce((a, w) => a + w.answers, 0) >= MIN_VERDICT.answers;
  const tooEasy = enough && acc != null && acc > LEARNING_BAND.high && aboveBand >= recentActive.length / 2;
  const tooHard = enough && acc != null && acc < LEARNING_BAND.low;
  const patterns = r.misconceptions.length;
  const practice = r.needs_practice.filter((p) => !r.misconceptions.some((m) => m.subskill_id === p.subskill_id)).length;

  const sessionBit = r.typical_session_minutes ? ` in short sessions (about ${r.typical_session_minutes} minutes each)` : '';
  const accBit = acc != null ? ` and gets ${acc}% of answers right` : '';
  const masteredBit = `${name} has mastered ${mastered} ${gradeName(r.grade)} skill${mastered === 1 ? '' : 's'}${
    topUnits.length ? `, mostly in ${topUnits.join(' and ')}` : ''
  }, and is partway through ${learning} more.`;
  const aheadBit = aheadShare >= 10 ? ` ${aheadShare}% of their practice is above ${gradeName(r.grade)} level.` : '';
  const nextBit = tooEasy
    ? ' Because they almost never miss, the main opportunity is harder lessons, not more help.'
    : tooHard
      ? ' Lessons are hard right now, so short, frequent practice on the skills below will help most.'
      : enough
        ? ' The lessons are at about the right difficulty.'
        : ' There is not enough recent practice yet to say how hard the lessons are.';
  const helpBit = patterns ? ` ${patterns === 1 ? 'One mistake pattern is' : `${patterns} mistake patterns are`} worth a few minutes at home.` : '';

  return {
    shortAnswer: `${name} practices ${steady ? 'most weeks' : 'some weeks'}${sessionBit}${accBit}. ${masteredBit}${aheadBit}${nextBit}${helpBit}`,
    learningHeadline: `${steady ? 'Practice is steady' : 'Practice has been occasional'}, ${
      tooEasy ? 'and the work is almost always right' : tooHard ? 'and the work is hard right now'
        : enough ? 'and the work is at the right difficulty' : 'with too little recent work to judge difficulty'
    }`,
    learningLede: `Over the last ${r.weeks.length} weeks, ${name} practiced in ${active.length} of them and passed ${r.weeks.reduce(
      (a, w) => a + w.checks_passed, 0,
    )} mastery checks.${
      recentActive.length
        ? ` In ${aboveBand} of the last ${recentActive.length} active weeks they got more than ${LEARNING_BAND.high}% right${
            belowBand ? `, and in ${belowBand} less than ${LEARNING_BAND.low}%` : ''
          }.`
        : ''
    }${tooEasy ? " That says they're ready for harder material." : ''}`,
    yearHeadline: topUnits.length ? `Furthest along in ${topUnits.join(' and ')}` : `Just getting started in ${gradeName(r.grade)}`,
    yearLede: `The ${gradeName(r.grade)} map has ${total} skills across ${r.grade_map.length} subjects. ${name} has mastered ${mastered} and is learning ${learning}. Each square below is one skill.`,
    helpHeadline:
      patterns + practice === 0
        ? 'No struggles recorded'
        : [
            patterns ? `${patterns === 1 ? 'One mistake pattern' : `${patterns} mistake patterns`}` : '',
            practice ? `${practice === 1 ? 'one skill that needs' : `${practice} skills that need`} more practice` : '',
          ].filter(Boolean).join(', and ').replace(/^./, (c) => c.toUpperCase()),
    helpLede:
      patterns + practice === 0
        ? `The tutor has not recorded a repeated mistake for ${name}.`
        : `These are the specific patterns the tutor recorded and the skills where answers are mostly wrong.`,
    aheadShare,
    aheadLine: `${aheadN} of ${mixTotal} answers (${aheadShare}%) came from material above ${gradeName(r.grade)}.`,
  };
}
