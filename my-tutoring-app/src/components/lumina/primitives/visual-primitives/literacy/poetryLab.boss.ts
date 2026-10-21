/**
 * poetry-lab's boss (`components/live-activity/boss.ts`), bespoke because every step is a tap, a board or typed lines
 * the activity checks: the card is `poetryLab.card.ts`; this file validates a lesson, lists its items, asks one,
 * carries the lever set and plays the harness.
 */
import type { PoetryLabData } from './PoetryLab';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { bossAssignment, defineBoss, hasText } from '../../../components/live-activity/boss';
import { poetryLabCard, type PoetryMiss } from './poetryLab.card';
import { POETRY_LEVERS, practiceFor, practiceSource } from './poetryLabLevers';
import { itemData, lineCount, poetryAsk, poetryHarnessWork, poetryItems, type PoetryItem } from './poetryLabWorkspace';

/**
 * Reject a poetry lab whose items cannot be answered: rhyme rounds with four distinct cards holding the pair; an
 * analysis poem with at least one phase whose key is among its choices (a figurative phrase located in the poem);
 * a composition prompt with a line count (and an acrostic word as long as the poem).
 */
export function validatePoetryLabData(value: unknown): PoetryLabData {
  const d = value as PoetryLabData;
  if (!d || !hasText(d.title) || !['rhyme_hunt', 'analysis', 'composition'].includes(d.mode))
    throw new Error('Generated poetry lab has invalid lesson content.');
  if (d.mode === 'rhyme_hunt') {
    const rounds = d.rounds ?? [];
    if (!rounds.length || rounds.length > 12 || new Set(rounds.map(r => r?.id)).size !== rounds.length
        || rounds.some(r => !r || !hasText(r.id) || r.poemLines?.length !== 4 || r.candidates?.length !== 4
          || new Set(r.candidates.map(c => c.word.toLowerCase())).size !== 4
          || ![r.rhymeWordA, r.rhymeWordB].every(w => r.candidates.some(c => c.word.toLowerCase() === String(w).toLowerCase()))))
      throw new Error('A poetry-lab rhyme_hunt round cannot be answered as generated.');
    return d;
  }
  if (d.mode === 'analysis') {
    if (!d.poemLines?.length) throw new Error('A poetry-lab analysis has no poem.');
    if (d.moodOptions?.length && d.correctMood && !d.moodOptions.some(m => m.toLowerCase() === d.correctMood!.toLowerCase()))
      throw new Error('A poetry-lab analysis mood is not among its choices.');
    if (d.rhymeSchemeOptions?.length && d.rhymeScheme && !d.rhymeSchemeOptions.includes(d.rhymeScheme))
      throw new Error('A poetry-lab analysis rhyme scheme is not among its choices.');
    const poem = d.poem ?? d.poemLines.join('\n');
    if ((d.figurativeInstances ?? []).some(f => !(f.startIndex >= 0 && f.endIndex > f.startIndex && f.endIndex <= poem.length)))
      throw new Error('A poetry-lab figurative phrase is not located in the poem.');
  } else {
    const tc = d.templateConstraints;
    if (!hasText(d.compositionPrompt) || !tc || !(tc.lineCount >= 1)
        || (tc.acrosticWord && tc.acrosticWord.length !== tc.lineCount))
      throw new Error('A poetry-lab composition cannot be answered as generated.');
  }
  if (!poetryItems(d).length) throw new Error('A poetry-lab lesson has nothing to check.');
  return d;
}

const check: DriverInput = { type: 'check' };

export const poetryLabBoss = defineBoss<PoetryLabData, PoetryItem, PoetryMiss>({
  card: poetryLabCard,
  validate: validatePoetryLabData,
  items: poetryItems,
  ask: poetryAsk,
  // Every step is a tap, a board or typed lines the activity checks: no key reaches the tutor.
  assignment: item => bossAssignment(item.id, poetryAsk(item), null),
  levers: POETRY_LEVERS,
  stepOf: item => item.kind,
  drive: {
    component: 'primitives/visual-primitives/literacy/PoetryLab.tsx',
    instanceId: 'poetry',
    defaults: { grade: 'Grade 4', mode: 'analysis', topic: 'A rainy day at the pond' },
    mounted: '[data-pip-object="workspace"]',
    // The session item, or the practice item a simplify lever opened (`<id>~simpler`), rebuilt from the session's.
    current: ctx => {
      const data = ctx.data as PoetryLabData;
      const source = practiceSource(ctx.itemId);
      const session = poetryItems(data).find(i => i.id === (source ?? ctx.itemId));
      return session && source ? practiceFor(session, data) ?? undefined : session;
    },
    // Every item through its real controls, from `poetryHarnessWork`. rhyme_hunt: tap two cards (the second tap
    // checks); a wrong pair is one rhyme word and a card outside the pair. mood and rhyme scheme: tap a choice, then
    // Check; a wrong one is another printed choice. figurative: touch a word of each phrase, then Check; a wrong one
    // adds a word in no phrase. composition: write each line, then Check Poem; a wrong one breaks the form.
    play: (right, item, ctx) => {
      const d = itemData(item, ctx.data as PoetryLabData);
      const work = poetryHarnessWork(item, d, !right);
      if (item.kind === 'rhyme_hunt') return work.picked.map((label): DriverInput => ({ type: 'choose', label }));
      if (item.kind === 'mood') return [{ type: 'choose', label: work.mood! }, check];
      if (item.kind === 'rhyme') return [{ type: 'choose', label: work.scheme! }, check];
      if (item.kind === 'figurative') return [...work.tapped.map((target): DriverInput => ({ type: 'touch', target })), check];
      return [...Array.from({ length: lineCount(d) }, (_, i): DriverInput =>
        ({ type: 'write', label: `Line ${i + 1}`, text: work.lines[i] ?? '' })), check];
    },
    // The replay's word check: the mood and the scheme letters. A rhyme pair and a figurative phrase are words of the
    // poem the tutor reads aloud, so those replies are read by hand.
    replayKeys: ctx => {
      const d = ctx.data as PoetryLabData;
      return ctx.itemId === 'mood' && d.correctMood ? [d.correctMood]
        : ctx.itemId === 'rhyme' && d.rhymeScheme ? [d.rhymeScheme] : [];
    },
  },
});
