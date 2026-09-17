/** Development-only executable reference adapter. Not a catalog primitive or assessment. */
import type { ExecutableAffordance, RuntimeMount, TutorPrimitiveState } from './contract';

export function createRuntimeFixture(instanceId = 'reference-instance') {
  let index = 0;
  let suspended = false;
  let generation = 0;
  let replays = 0;
  let pointed = false;
  let state: TutorPrimitiveState = initial();
  function initial(): TutorPrimitiveState {
    return { itemId: `reference-item-${index + 1}`, phase: 'answer', task: index === 0 ? 'Find 8 minus 3.' : 'Find 9 minus 2.',
      completed: false, evidence: { attemptNumber: 1, correctness: 'unknown', recentResponses: [] },
      demand: { operation: 'subtraction', steps: 1 }, support: { level: 0, answerExposure: 'none' } };
  }
  const mount: RuntimeMount = {
    instanceId, planItemId: 'reference-plan-item', primitiveId: 'runtime-reference', objectiveId: 'subtract-within-10', evalMode: 'reference-only',
    adapter: {
      getTutorState: () => state,
      getAffordances: () => {
        if (suspended || state.completed) return [];
        const actions: ExecutableAffordance[] = [
          { action: { type: 'replay' }, description: 'Repeat the task', assistance: { level: 1, answerExposure: 'none' }, execute: () => { replays++; return true; } },
          { action: { type: 'point', targetId: 'start' }, description: 'Point to the starting quantity', assistance: { level: 2, answerExposure: 'none' }, execute: () => { pointed = true; return true; } },
          { action: { type: 'scaffold', strategyId: 'direction', direction: state.support.level ? -1 : 1 },
            description: state.support.level ? 'Fade direction hint' : 'Show direction hint',
            assistance: { level: state.support.level ? 0 : 3, answerExposure: 'none' },
            execute: () => { state = { ...state, support: { level: state.support.level ? 0 : 3, answerExposure: 'none' } }; return true; } },
        ];
        if (state.evidence.correctness === 'incorrect') actions.push({ action: { type: 'retry' }, description: 'Try the same task again', execute: () => {
          state = { ...state, evidence: { ...state.evidence, correctness: 'unknown', attemptNumber: state.evidence.attemptNumber + 1 } };
          return true;
        } });
        if (state.evidence.correctness === 'correct' && index === 0) actions.push({ action: { type: 'advance' }, description: 'Try a fresh transfer item', execute: () => {
          index++; pointed = false; generation++; state = initial();
          return true;
        } });
        return actions;
      },
      suspension: { suspend: () => { suspended = true; generation++; }, resume: () => { suspended = false; generation++; } },
      supportArtifacts: [{ id: 'seven-take-two', kind: 'counter-example', title: 'A different subtraction example', total: 7, removed: 2,
        altText: 'Seven counters with two crossed out, leaving five.', answerExposure: 'full', provenance: 'prepared' }],
    },
  };
  return {
    mount,
    get replays() { return replays; },
    get pointed() { return pointed; },
    get suspended() { return suspended; },
    respond(response: string) {
      if (suspended || state.completed) return false;
      const correct = response.trim() === (index === 0 ? '5' : '7');
      state = { ...state, completed: correct && index === 1, evidence: { ...state.evidence,
        attemptNumber: state.evidence.attemptNumber + (state.evidence.correctness === 'unknown' ? 0 : 1),
        correctness: correct ? 'correct' : 'incorrect',
        recentResponses: [...state.evidence.recentResponses, { response, source: 'gesture' as const, recognition: 'not-applicable' as const }].slice(-5) } };
      return true;
    },
    /** Example cancellation lease for late async verdicts: invalid across suspend/resume and item changes. */
    pendingResponse(response: string) {
      const opened = generation;
      return () => opened === generation && !suspended ? this.respond(response) : false;
    },
  };
}
