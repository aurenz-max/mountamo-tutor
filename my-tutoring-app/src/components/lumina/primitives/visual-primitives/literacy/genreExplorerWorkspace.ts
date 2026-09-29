/**
 * Genre explorer on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch C7). Its only teaching path: the scripted
 * runner was retired (LA-14, user ruling 09-23: one path).
 *
 * Pure: the component and the journey read the same assignment and scene. Every item is one
 * spoken answer computed by the build gates: yes or no about one text (check-feature), which
 * of two texts something is true of (pick-excerpt), or what kind of writing a text is from the
 * printed menu (name-genre). At the band floor the ask carries the text, which the tutor reads
 * aloud: the answer is a category name that no excerpt contains (`namesAGenre`).
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { textFacts } from '../../../components/live-activity/runtime/sceneFacts';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import {
  ALL_GENRE_IDS,
  askFor,
  GENRE_ALTERNATES,
  GENRE_LABEL,
  GENRE_SIBLING,
  genreExplorerHarnessAnswers,
  type GenreExplorerItem,
  type ResolvedExcerpt,
} from './genreExplorerScript';

/** The pack's own ask, without its "Your turn." hand-over. */
const ask = (item: GenreExplorerItem) => askFor(item).replace(/\s*Your turn\.\s*/, ' ').replace(/\s+/g, ' ').trim();

const quoted = (words: readonly string[]) => words.map(w => `"${w}"`).join(', ');

export function genreAssignment(item: GenreExplorerItem): TeachingAssignment {
  let expectedAnswer: string;
  switch (item.action) {
    case 'check-feature':
      expectedAnswer = `${item.answer}: ${item.excerptOrdinal} ${item.answer === 'yes' ? 'does' : 'does not'} ${item.predicate}. `
        + `Any natural form of that verdict counts (${item.answer === 'yes' ? '"yeah", "it does"' : '"nope", "it does not"'}). `
        + `Saying the feature back ("${item.predicate}") gives no verdict and is not it.`;
      break;
    case 'pick-excerpt':
      expectedAnswer = `${item.answer}. The position alone ("first", "second") counts. The other text is wrong, and so are `
        + '"both" and "neither": the feature is true of exactly one of the two.';
      break;
    case 'name-genre': {
      const id = ALL_GENRE_IDS.find(g => GENRE_LABEL[g] === item.answer);
      const alternates = id ? GENRE_ALTERNATES[id] : [];
      expectedAnswer = `${item.answer}. The part of the label that tells it apart from the other choices counts, and so does `
        + `its place in the printed list${alternates.length ? `, or ${quoted(alternates)}` : ''}. Another kind of writing is `
        + `wrong even when it is a close relative (choices: ${item.choices.join(', ')}).`;
      break;
    }
  }
  const misses = genreSpokenMisses(item);
  return { id: item.id, task: ask(item), response: 'speech', expectedAnswer, ...(misses.length ? { misses } : {}) };
}

/** What a wrong spoken answer shows (handoff 20 Part B), by action. */
export type SpokenGenreMiss = 'opposite_verdict' | 'said_feature_back' | 'other_text' | 'said_both' | 'close_relative' | 'other_genre';

/**
 * An item's known wrong answers, in precedence order, for the `spoken_miss` observer: the other verdict or the
 * feature said back (check-feature), the other text or "both" (pick-excerpt), a close relative from the menu, then
 * any other printed kind (name-genre).
 */
export function genreSpokenMisses(item: GenreExplorerItem): KnownMiss[] {
  switch (item.action) {
    case 'check-feature': {
      const does = item.answer === 'yes';
      return [
        { id: 'opposite_verdict', pattern: `The right verdict is "${item.answer}": ${item.excerptOrdinal} ${does ? 'does' : 'does not'} ${item.predicate}. `
          + `The learner gives the opposite verdict, ${does ? '"no" (or "nope", "it does not")' : '"yes" (or "yeah", "it does")'}.`,
          examples: [does ? 'no' : 'yes', does ? 'it does not' : 'it does'] },
        { id: 'said_feature_back', pattern: `The learner says the feature back ("${item.predicate}") with no yes or no.`, examples: [item.predicate] },
      ];
    }
    case 'pick-excerpt': {
      const other = item.choices.find(c => c !== item.answer);
      return [
        ...(other ? [{ id: 'other_text', pattern: `The feature is true of ${item.answer}, not ${other}. The learner's answer is ${other}.`, examples: [other] }] : []),
        { id: 'said_both', pattern: 'The feature is true of exactly one of the two texts. The learner\'s answer is "both" or "neither".', examples: ['both of them', 'neither'] },
      ];
    }
    case 'name-genre': {
      const id = ALL_GENRE_IDS.find(g => GENRE_LABEL[g] === item.answer);
      const others = item.choices.filter(c => c !== item.answer);
      const close = (id ? GENRE_SIBLING[id] ?? [] : []).map(g => GENRE_LABEL[g]).filter(label => others.includes(label));
      const rest = others.filter(c => !close.includes(c));
      const quote = (xs: string[]) => xs.map(x => `"${x}"`).join(' or ');
      return [
        ...(close.length ? [{ id: 'close_relative', pattern: `This text is ${item.answer}. The learner's answer is ${quote(close)}, a kind of writing close to ${item.answer} on the printed list.`,
          examples: close.slice(0, 2) }] : []),
        ...(rest.length ? [{ id: 'other_genre', pattern: `This text is ${item.answer}. The learner's answer is ${quote(rest)}, another kind of writing on the printed list.`,
          examples: rest.slice(0, 2) }] : []),
      ];
    }
  }
}

export function genreScene(item: GenreExplorerItem, excerpts: readonly ResolvedExcerpt[], menu: readonly string[],
  readsAloud: boolean): WorkspaceScene {
  const shown = item.excerptIndex < 0 ? excerpts : excerpts.filter(e => e.index === item.excerptIndex);
  const facts: Record<string, string> = {};
  for (const excerpt of shown) Object.assign(facts, textFacts(shown.length > 1 ? `text${excerpt.index + 1}` : 'text',
    `${excerpts.length > 1 ? `${excerpt.ordinal}: ` : ''}${excerpt.text}`));
  if (menu.length) facts.menu = `Printed kinds of writing: ${menu.join(', ')}.`;
  facts.constraints = 'The learner answers out loud; nothing on screen marks a genre or a feature until the answer is credited.'
    + (readsAloud ? ' The learner does not read yet: read the text aloud when the ask carries it.' : '');
  return { objects: [], facts };
}

/** The journey's answers: the code-computed answer, or a plain wrong one. */
export function genreJourneyAnswers(item: GenreExplorerItem): { correct: string; plainWrong: string } {
  const { correct, plainWrong } = genreExplorerHarnessAnswers(item);
  return { correct, plainWrong };
}
