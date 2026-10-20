/**
 * fact-file's boss, on the spoken preset (`components/live-activity/boss.ts`): every mode is SAY_OR_SHOW, split per
 * item. A check whose choices can all be said has a key (`factFileKey`): the learner says a choice (the tutor judges it)
 * or taps it (the activity checks it). A check with a choice that cannot be said has no key, gets the gesture
 * assignment, and plays through `show`. On a recall or apply file the learner first reads it: every tab opened, then
 * Start questions. The card is `factFile.card.ts`; this file holds the content check, the items, the ask and key, the
 * levers and the harness play.
 */
import type { FactFileData } from './FactFile';
import type { DriverInput, JourneyContext } from '../../../components/live-activity/liveJourneySpec';
import { spokenBoss, hasText } from '../../../components/live-activity/boss';
import { factFileCard, type FactFileMiss } from './factFile.card';
import { FACT_FILE_LEVERS } from './factFileLevers';
import {
  SECTION_LABEL, factChecks, factFileHarnessAnswers, factFileKey, factFileSpokenMisses, factItems, fileTabs, type FactFileItem,
} from './factFileWorkspace';

/** A question with at least two distinct choices and a key that points at one of them. */
function answerable(c: { question?: unknown; options?: unknown; correctIndex?: unknown }): boolean {
  const options = Array.isArray(c.options) ? c.options.filter(o => typeof o === 'string' && o.trim()) : [];
  return hasText(c.question) && Array.isArray(c.options) && options.length === c.options.length
    && options.length >= 2 && new Set(options.map(o => o.trim().toLowerCase())).size === options.length
    && Number.isInteger(c.correctIndex) && (c.correctIndex as number) >= 0 && (c.correctIndex as number) < options.length;
}

/** Reject a fact file whose self-checks cannot be attempted: the self-checks are the items. */
export function validateFactFileData(value: unknown): FactFileData {
  const d = value as FactFileData;
  if (!d || !hasText(d.title) || !Array.isArray(d.selfChecks) || !d.selfChecks.length || d.selfChecks.length > 8)
    throw new Error('Generated fact file has invalid lesson content.');
  const checks = factChecks(d);
  if (new Set(checks.map(c => c.id)).size !== checks.length) throw new Error('Generated fact file checks repeat an id.');
  for (const c of checks) if (!answerable(c)) throw new Error('A fact-file self-check cannot be answered as generated.');
  return d;
}

/** While a recall or apply file is being read: open every tab, then Start questions. */
const readFirst = (ctx: JourneyContext): DriverInput[] => (String(ctx.demand?.phase ?? '').startsWith('reading')
  ? [...fileTabs(ctx.data as FactFileData).map(t => ({ type: 'choose' as const, label: SECTION_LABEL[t] })),
    { type: 'choose', label: 'Start questions' }]
  : []);

export const factFileBoss = spokenBoss<FactFileData, FactFileItem, FactFileMiss>({
  card: factFileCard,
  validate: validateFactFileData,
  items: factItems,
  levers: FACT_FILE_LEVERS,
  speech: {
    ask: c => c.question,
    // A tap-only check (a choice that cannot be said, or a question that prints its answer) has no key.
    key: factFileKey,
    misses: c => factFileSpokenMisses(c, c.fileText),
    say: c => { const { correct, wrong } = factFileHarnessAnswers(c, c.fileText); return { correct, plainWrong: wrong }; },
    before: (_c, ctx) => readFirst(ctx),
    // Every mode is SAY_OR_SHOW; recall and apply are wired alike (the file closed), so a closed check reads as recall.
    modeOf: c => (c.fileOpen ? 'explore' : 'recall'),
    // A tap-only check through its real choice button; the wrong tap is a choice the file states elsewhere when there is one.
    show: (right, c, ctx) => {
      const { correct, wrong } = factFileHarnessAnswers(c, c.fileText);
      return [...readFirst(ctx), { type: 'choose', label: right ? correct : wrong }];
    },
  },
  drive: {
    component: 'primitives/visual-primitives/core/FactFile.tsx',
    instanceId: 'fact-file',
    defaults: { grade: 'Grade 3', mode: 'recall', topic: 'Volcanoes' },
    mounted: '[data-pip-object="workspace"]',
  },
});
