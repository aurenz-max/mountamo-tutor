/**
 * spelling-pattern-explorer's boss (`components/live-activity/boss.ts`), bespoke because no mode is spoken or one tap:
 * a classic item is a typed spelling the activity checks, and pattern_build is a letter build the activity checks
 * (then the shared word judge). The card is `spellingPatternExplorer.card.ts`; this file validates a lesson, lists its
 * items, asks one, carries the lever set and plays the harness.
 */
import type { SpellingPatternExplorerData } from './SpellingPatternExplorer';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { letterItemsFrom } from './letterBuild';
import { spellingPatternExplorerCard, type SpellingPatternMiss } from './spellingPatternExplorer.card';
import { SIMPLER_LEVER, SPELLING_LEVERS, practiceParent } from './spellingPatternLevers';
import {
  dictationItems, isPatternBuild, spellingAsk, spellingHarnessAnswers, spellingItems, spellingWords, type SpellingItem,
} from './spellingPatternExplorerWorkspace';

/**
 * Every mode binds. The classic modes: a title, pattern words and 1-10 dictation words of letters (each word is one
 * item). The open build (`pattern_build`): every ask passes the letter surface's own gate.
 */
export function validateSpellingPatternExplorerData(value: unknown): SpellingPatternExplorerData {
  const d = value as SpellingPatternExplorerData;
  if (!d || typeof d.title !== 'string') throw new Error('Generated spelling pattern explorer has invalid lesson content.');
  if (d.task === 'letter_build') {
    if (!Array.isArray(d.buildItems) || !d.buildItems.length || d.buildItems.length > 12
        || letterItemsFrom(d.buildItems, d.supportTier).length !== d.buildItems.length)
      throw new Error('Generated spelling pattern build has an ask the board cannot run.');
    return d;
  }
  if (!Array.isArray(d.patternWords) || !d.patternWords.length || typeof d.highlightPattern !== 'string'
      || !Array.isArray(d.dictationWords) || !d.dictationWords.length || d.dictationWords.length > 10
      || dictationItems(d.dictationWords).length !== d.dictationWords.length)
    throw new Error('Generated spelling pattern explorer has invalid lesson content.');
  return d;
}

/** The lesson context the classic levers read. */
export const spellingSession = (d: SpellingPatternExplorerData) => ({ patternWords: d.patternWords ?? [],
  highlightPattern: d.highlightPattern ?? '', items: dictationItems(d.dictationWords, d.dictationHints), supportTier: d.supportTier });

export const spellingPatternExplorerBoss = defineBoss<SpellingPatternExplorerData, SpellingItem, SpellingPatternMiss>({
  card: spellingPatternExplorerCard,
  validate: validateSpellingPatternExplorerData,
  items: spellingItems,
  ask: spellingAsk,
  // A typed spelling or a build the activity checks: no key reaches the tutor.
  assignment: item => bossAssignment(item.id, spellingAsk(item), null),
  levers: SPELLING_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/literacy/SpellingPatternExplorer.tsx',
    instanceId: 'spe',
    defaults: { grade: 'Grade 2', mode: 'long_vowel', topic: 'Long vowel spelling patterns: vowel teams and silent e' },
    mounted: '[data-pip-object="workspace"]',
    // The credited spelling, counted so a transcript inspection can check it never shows before a credit.
    probes: { reward: { selector: '[data-spe-reward]', kind: 'count' } },
    // The session item, or the shorter practice word a simplify lever opened (`~simpler`), rebuilt from its parent.
    current: ctx => {
      const data = ctx.data as SpellingPatternExplorerData;
      const items = spellingItems(data);
      const found = items.find(i => i.id === ctx.itemId);
      if (found) return found;
      const parent = practiceParent(ctx.itemId, spellingWords(data));
      return parent ? SPELLING_LEVERS.simpler(parent, spellingSession(data), SIMPLER_LEVER) ?? undefined : undefined;
    },
    // Classic: on the first word, look at the pattern words and write a rule first; then type the word (or the word with
    // its pattern's letters swapped) and press Check spelling. A pattern_build's last check is the shared word judge (a
    // model call), so the dry journey cannot commit it; SpellingPatternExplorer.workspace.test.tsx drives it with a
    // stubbed judge (journey-sweep baseline: J1-drivable, by design).
    play: (right, item, ctx) => {
      if (isPatternBuild(item)) throw new Error('spelling-pattern-explorer pattern_build is judged by the word judge, not driven at W1');
      const phase = ctx.demand?.phase;
      const rule: DriverInput[] = [{ type: 'write', label: 'Your spelling rule', text: 'The words share the same spelling pattern.' },
        { type: 'choose', label: 'Next: Apply the Rule' }];
      const lead: DriverInput[] = phase === 'observe' ? [{ type: 'choose', label: 'I see the pattern! Next: Write the Rule' }, ...rule]
        : phase === 'rule' ? rule : [];
      const answers = spellingHarnessAnswers(item, String((ctx.data as SpellingPatternExplorerData).highlightPattern ?? ''));
      return [...lead, { type: 'write', label: 'Your spelling', text: right ? answers.correct : answers.plainWrong },
        { type: 'choose', label: 'Check spelling' }];
    },
  },
});
