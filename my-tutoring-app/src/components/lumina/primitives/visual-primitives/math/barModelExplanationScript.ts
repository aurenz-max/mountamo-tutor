import type { BarModelChallenge } from './BarModel';
import type { JudgedScriptItem, JudgedScriptPack } from '../../../hooks/judgedScriptContract';

export interface GraphExplanationItem extends JudgedScriptItem {
  challenge: BarModelChallenge;
  facts: string[];
}

/** The judge gets facts computed from the displayed rows, never a generated key. */
export function graphComparisonFacts(ch: BarModelChallenge): string[] {
  const facts: string[] = [];
  if (ch.evalMode === 'compare_two_graphs') {
    if (!ch.secondValues || ch.secondValues.length !== ch.values.length) return [];
    ch.values.forEach((row, i) => {
      const other = ch.secondValues![i];
      if (other.label !== row.label) return;
      if (ch.comparisonFocus === 'same' && row.value !== other.value) return;
      if (ch.comparisonFocus === 'different' && row.value === other.value) return;
      const relation = row.value === other.value ? 'the same number of' : row.value > other.value ? 'more' : 'fewer';
      facts.push(`${ch.graphLabel} has ${relation} ${row.label} ${row.value === other.value ? 'as' : 'than'} ${ch.secondGraphLabel}.`);
    });
  } else {
    ch.values.forEach((a, i) => ch.values.slice(i + 1).forEach((b) => {
      facts.push(a.value === b.value ? `${a.label} and ${b.label} have the same number.`
        : `${a.value > b.value ? a.label : b.label} have more than ${a.value > b.value ? b.label : a.label}.`);
    }));
    const max = Math.max(...ch.values.map((v) => v.value));
    const min = Math.min(...ch.values.map((v) => v.value));
    if (ch.values.filter((v) => v.value === max).length === 1) facts.push(`${ch.values.find((v) => v.value === max)!.label} have the most.`);
    if (ch.values.filter((v) => v.value === min).length === 1) facts.push(`${ch.values.find((v) => v.value === min)!.label} have the fewest.`);
  }
  return facts;
}

const ask = (item: GraphExplanationItem) => {
  const ch = item.challenge;
  const labels = ch.values.map((v) => v.label).join(', ');
  return `The rows show ${labels}. ${ch.prompt}${ch.supportTier !== 'hard' ? ' You can use more, fewer, or the same.' : ''}`;
};

/** Count together only in the post-attempt affirmation, never in an ask. */
const countTogether = (item: GraphExplanationItem) => {
  const words = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  const count = (n: number) => words.slice(0, n).join(', ');
  const ch = item.challenge;
  if (ch.secondValues) {
    const index = ch.values.findIndex((v, i) => ch.comparisonFocus === 'different'
      ? v.value !== ch.secondValues![i].value : v.value === ch.secondValues![i].value);
    const i = Math.max(0, index);
    return `Let's count ${ch.values[i].label}. ${ch.graphLabel}: ${count(ch.values[i].value)}. ${ch.secondGraphLabel}: ${count(ch.secondValues[i].value)}.`;
  }
  return `Let's count. ${ch.values.slice(0, 2).map((v) => `${v.label}: ${count(v.value)}.`).join(' ')}`;
};

const contract = (item: GraphExplanationItem) => {
  const ch = item.challenge;
  return `This is the only active item. Discard earlier graphs and verdicts. PRIVATE graph facts: ${item.facts.join(' ')}
${ch.comparisonFocus ? `This turn asks for a ${ch.comparisonFocus === 'same' ? 'similarity' : 'difference'}; the claim must meet that request.` : ''}
Judge MEANING from the learner's audio, not keyword matching. Accept any true comparative claim supported by these facts,
including reversed equivalents (fewer versus more), informal most/least language, and natural paraphrases with none of the exact words.
${ch.evalMode === 'compare_two_graphs' ? 'The claim MUST compare the morning and afternoon data sets, not two categories within just one graph.' : 'The claim must compare categories or identify a most/fewest group.'}
Accept short forms when their referent is clear, and longer correct explanations. Do not demand a full sentence or exact grammar.
Refuse echoing the question; a bare number or category name without a comparison; a claim about color or preference rather than quantities;
reversed or negated facts even if they contain matching keywords; off-task speech. Silence is not a wrong answer; wait.
If right, say exactly: "Yes, you explained what the graph shows. ${countTogether(item)} ${item.facts[0]}"
If wrong, say exactly: "My turn: ${item.facts[0]} Now tell me a comparison."
Use only these two verdict branches; repeat the same correction on repeated errors. Never speak private facts before an attempt.
Never read stage directions aloud. The verdict ends the turn; stop speaking after it.`;
};

export function graphExplanationPack(challenge: BarModelChallenge): JudgedScriptPack<GraphExplanationItem> {
  const item: GraphExplanationItem = { id: challenge.id, answerKind: 'voice', responseClass: 'concept_statement',
    action: challenge.evalMode, challenge, facts: graphComparisonFacts(challenge) };
  return {
    primitiveType: 'bar-model', activityLine: 'Explain a graph comparison in your own words',
    items: item.facts.length ? [item] : [], maxCorrections: 2,
    itemCue: (current) => `[GRAPH_ITEM] Say exactly: "${ask(current)}" ${contract(current)}`,
    pronounceCue: (current) => `[GRAPH_HEAR] Say exactly: "${ask(current)}" Then stop. Never say an answer or grade your own words.`,
    moveOnCue: () => '[GRAPH_MOVE] Say exactly: "Good try. We can practice that comparison again." Then stop.',
    completeCue: () => '[GRAPH_DONE] Say exactly: "We have finished this graph." Then stop.',
    contextFor: (current) => ({
      title: 'Our graphs', evalMode: current.challenge.evalMode, graphStyle: 'picture',
      values: 'Private facts are in the active judging contract; do not read totals aloud.',
      value1: 'hidden', value2: 'hidden', barCount: String(current.challenge.values.length),
      scaleStep: '1', iconEmoji: 'picture', iconValue: '1', currentPrompt: current.challenge.prompt,
      attemptNumber: '0', currentChallengeIndex: '1', totalChallenges: '1',
    }),
    statusLines: { ready: () => 'Tell me a comparison.', retry: () => 'Try a comparison again.', done: 'Graph finished.' },
    diagnosisObservation: (current, { lastHeard }) => ({ challenge: current.challenge.prompt,
      expected: current.facts.join(' '), observed: lastHeard || 'The comparison was not heard correctly.' }),
  };
}
