/**
 * vocabulary-explorer's boss, on the spoken preset (`components/live-activity/boss.ts`): apply is SAY_OR_SHOW, recall
 * is SAY_OR_SHOW split per item, and explore is a board. A sentence or situation item has a key (`vocabKey`): the
 * learner says the word (the tutor judges it) or taps it and presses Check Answer (the activity checks it). A match has
 * no key, gets the gesture assignment, and plays through `show`. Before the first item the learner studies the word
 * cards, then presses Start the check. The card is `vocabularyExplorer.card.ts`; this file holds the content check, the
 * items, the ask and key, the levers and the harness play.
 */
import type { VocabularyExplorerData } from './VocabularyExplorer';
import type { DriverInput, JourneyContext } from '../../../components/live-activity/liveJourneySpec';
import { spokenBoss, hasText } from '../../../components/live-activity/boss';
import { vocabularyExplorerCard, type VocabMiss } from './vocabularyExplorer.card';
import { VOCAB_LEVERS, practiceParent, simplerMatch } from './vocabularyExplorerLevers';
import {
  askOf, asCheck, resolveKinds, validVocabItem, vocabChecks, vocabHarnessAnswers, vocabKey, vocabSpokenMisses,
  type VocabCheck,
} from './vocabularyExplorerWorkspace';

/**
 * Reject a word set a mode cannot be asked on: no title or words, a stored item code could not have built from this
 * bank (every key is a word's id, so nothing else is trusted), repeated ids, or a requested kind with no item.
 */
export function validateVocabularyExplorerData(value: unknown): VocabularyExplorerData {
  const d = value as VocabularyExplorerData;
  if (!d || !hasText(d.title) || !Array.isArray(d.terms) || d.terms.length < 3
      || d.terms.some(t => !t || typeof t.id !== 'string' || !hasText(t.word) || typeof t.definition !== 'string')
      || new Set(d.terms.map(t => t.id)).size !== d.terms.length)
    throw new Error('Generated vocabulary explorer has invalid lesson content.');
  if (Array.isArray(d.items) && d.items.some(i => !validVocabItem(i, d.terms))) throw new Error('A generated vocabulary item is not one code can key.');
  const items = vocabChecks(d);
  if (!items.length || new Set(items.map(i => i.id)).size !== items.length) throw new Error('Generated vocabulary items are missing or repeat an id.');
  for (const kind of resolveKinds(d)) {
    if (!items.some(i => i.kind === kind)) throw new Error(`The vocabulary ${kind} task has no item this word set can build.`);
  }
  return d;
}

/** While the word cards are open (the scene is not ready): press Start the check. */
const studyFirst = (ctx: JourneyContext): DriverInput[] =>
  (ctx.demand?.presentation !== 'ready' ? [{ type: 'choose', label: 'Start the check' }] : []);

const wordOf = (c: VocabCheck, id: string | null) => {
  const word = c.bank.find(t => t.id === id)?.word;
  if (!word) throw new Error(`vocabulary-explorer ${c.id}: no word for choice ${id}`);
  return word;
};

export const vocabularyExplorerBoss = spokenBoss<VocabularyExplorerData, VocabCheck, VocabMiss>({
  card: vocabularyExplorerCard,
  validate: validateVocabularyExplorerData,
  items: vocabChecks,
  levers: VOCAB_LEVERS,
  speech: {
    ask: c => askOf(c, c.bank),
    // A match has no key: the activity checks the pairs.
    key: vocabKey,
    misses: c => (c.kind === 'match' ? [] : vocabSpokenMisses(c, c.bank)),
    // The word, or the most telling other word on screen.
    say: c => {
      const { correct, plainWrong } = vocabHarnessAnswers(c, c.bank);
      if (c.kind === 'match') throw new Error(`vocabulary-explorer ${c.id}: a match is not said`);
      return { correct: wordOf(c, correct.picked), plainWrong: wordOf(c, plainWrong.picked) };
    },
    before: (_c, ctx) => studyFirst(ctx),
    modeOf: c => c.mode,
    // A match through its real controls: each word (`term-<n>`), then its meaning (`meaning-<n>`, by its place in the
    // meaning column), then Check Matches. A wrong answer swaps the first two words' meanings.
    show: (right, c, ctx) => {
      if (c.kind !== 'match') throw new Error(`vocabulary-explorer ${c.kind}: a word is said or tapped, not shown`);
      const answers = vocabHarnessAnswers(c, c.bank), work = right ? answers.correct : answers.plainWrong;
      return [...studyFirst(ctx), ...c.terms.flatMap((t, i): DriverInput[] => [{ type: 'touch', target: `term-${i + 1}` },
        { type: 'touch', target: `meaning-${c.defs.indexOf(work.pairs[t]) + 1}` }]), { type: 'check' }];
    },
  },
  drive: {
    component: 'primitives/visual-primitives/core/VocabularyExplorer.tsx',
    instanceId: 'vocabulary-explorer',
    defaults: { grade: 'Grade 4', mode: 'recall', topic: 'The water cycle' },
    // The old journey row's mounted probe: the word cards, or the check's workspace.
    mounted: '[data-study="cards"], [data-pip-object="workspace"]',
    // The session item, or the smaller practice match a simplify lever opened (`~simpler`), rebuilt from its parent.
    current: ctx => {
      const items = vocabChecks(ctx.data as VocabularyExplorerData);
      const parent = practiceParent(String(ctx.itemId ?? ''));
      const full = items.find(i => i.id === (parent ?? ctx.itemId));
      if (!parent || !full) return full;
      const easier = simplerMatch(full, full.bank);
      return easier ? asCheck(easier, full.mode, full.bank) : undefined;
    },
  },
});
