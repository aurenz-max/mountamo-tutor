import type { RuntimeSnapshot } from './contract';
import type { LearnerIntentFlags, LearnerObservation } from './learnerIntentContract';
import { snapshotScopeKey } from './observationContract';

/**
 * Facts about the learner's stretch on ONE item, computed by code from events the
 * runtime already receives. No model call, no threshold that acts, no timer that
 * speaks: the tutor reads these when it next has a turn and decides what to do.
 *
 * They exist because the tutor sees one packet at a time and the dialogue observer
 * sees one exchange at a time, so nothing else holds "the last ninety seconds".
 * Elapsed time is reported as a fact. Silence alone establishes neither
 * frustration nor a misconception (LIVE_LESSON_ROADMAP, Help and frustration).
 */
export interface LearnerSignals {
  itemId: string;
  secondsOnItem: number;
  /** Null while the task is not ready for a response, e.g. a timed stimulus is pending. */
  secondsSinceReady: number | null;
  /** Null until a tutor turn has settled on this item. */
  secondsSinceTutorSettled: number | null;
  /** Null until the learner has finished a turn on this item. */
  secondsSinceLearnerSpoke: number | null;
  learnerTurns: number;
  tutorTurns: number;
  attempts: number;
  wrongAttempts: number;
  /** The last two recorded wrong responses on this item are the same text. */
  repeatedWrongResponse: boolean;
  /** Assistance was recorded by an explicit tutor action. False is not proof of independence. */
  helpRecorded: boolean;
  /** Learner turns on this item that the intent observation classified as asking for help. */
  helpRequests: number;
  stopRequests: number;
  /** Consecutive classified learner turns that offered no answer. An unclear turn changes nothing. */
  turnsWithoutAnswer: number;
}

/**
 * Travels inside the packet, so the instruction arrives with the data on every host and
 * no adapter has to restate it. Adapter guidance is capped at 2000 characters and the shared
 * WORKSPACE_DOCTRINE already takes 900 of it, so this cannot live there.
 */
export const LEARNER_FACTS_NOTE = 'Facts about the learner on this item, for choosing between waiting, helping and offering a break. '
  + 'They never grade an answer. Quiet time alone is not a reason to interrupt.';

const seconds = (from: number | null, now: number) => from === null ? null : Math.max(0, Math.round((now - from) / 1000));
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Lives on the runtime, like its speech clock and trace, so it survives a transport recreate. */
export class LearnerSignalTracker {
  private key = '';
  private openedAt = 0;
  private readyAt: number | null = null;
  private settledAt: number | null = null;
  private spokeAt: number | null = null;
  private learnerTurns = 0;
  private tutorTurns = 0;
  private helpRequests = 0;
  private stopRequests = 0;
  private turnsWithoutAnswer = 0;
  private observed: LearnerObservation[] = [];
  constructor(private now: () => number = Date.now) {}

  /** Call on every runtime publish. A new item starts every count again. */
  observe(state: RuntimeSnapshot) {
    const key = state.task ? snapshotScopeKey(state) : '';
    if (key !== this.key) {
      this.key = key; this.openedAt = this.now(); this.readyAt = this.settledAt = this.spokeAt = null;
      this.learnerTurns = this.tutorTurns = this.helpRequests = this.stopRequests = this.turnsWithoutAnswer = 0;
      this.observed = [];
    }
    // An adapter that does not report presentation readiness is ready once mounted.
    const ready = !!state.task && state.task.demand.presentation !== 'not ready';
    if (ready && this.readyAt === null) this.readyAt = this.now();
    if (!ready) this.readyAt = null;
  }
  learnerFinished() { if (this.key) { this.learnerTurns++; this.spokeAt = this.now(); } }
  tutorSettled() { if (this.key) { this.tutorTurns++; this.settledAt = this.now(); } }

  /** Returns true when this observation newly raises a request the tutor should see now. */
  intent(scopeKey: string, observation: LearnerObservation, flags: LearnerIntentFlags) {
    if (scopeKey !== this.key) return false;
    this.observed = [...this.observed.slice(-4), observation];
    if (flags.helpRequested) this.helpRequests++;
    if (flags.stopRequested) this.stopRequests++;
    if (flags.attemptedAnswer === true) this.turnsWithoutAnswer = 0;
    if (flags.attemptedAnswer === false) this.turnsWithoutAnswer++;
    return flags.helpRequested || flags.stopRequested;
  }
  scopeKey = () => this.key;
  observations = (): readonly LearnerObservation[] => this.observed;

  read(state: RuntimeSnapshot): LearnerSignals | null {
    const task = state.task;
    if (!task || !this.key || !['active', 'support', 'closing'].includes(state.status)) return null;
    const now = this.now();
    const wrong = (task.workspace?.attempts ?? []).filter(a => a.itemId === task.itemId && !a.correct);
    return { itemId: task.itemId, secondsOnItem: seconds(this.openedAt, now)!, secondsSinceReady: seconds(this.readyAt, now),
      secondsSinceTutorSettled: seconds(this.settledAt, now), secondsSinceLearnerSpoke: seconds(this.spokeAt, now),
      learnerTurns: this.learnerTurns, tutorTurns: this.tutorTurns, attempts: task.evidence.attemptNumber,
      wrongAttempts: wrong.length,
      repeatedWrongResponse: wrong.length >= 2 && same(wrong.at(-1)!.response, wrong.at(-2)!.response),
      helpRecorded: task.support.level > 0, helpRequests: this.helpRequests, stopRequests: this.stopRequests,
      turnsWithoutAnswer: this.turnsWithoutAnswer };
  }
}
