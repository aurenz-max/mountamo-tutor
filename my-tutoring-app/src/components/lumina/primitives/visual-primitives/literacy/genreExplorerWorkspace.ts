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
import {
  ALL_GENRE_IDS,
  askFor,
  GENRE_ALTERNATES,
  GENRE_LABEL,
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
  return { id: item.id, task: ask(item), response: 'speech', expectedAnswer };
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
