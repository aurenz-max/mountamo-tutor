export type DIItemKind = 'sound' | 'word';

export interface DIItem {
  id: string;
  kind: DIItemKind;
  display: string;
  spoken: string;
  keyword?: string;
  elicitation?: 'isolated' | 'keyword';
  reference: string;
  /** Common text tokens produced when Live ASR hears the intended response. */
  asrAliases?: string[];
}

/**
 * Corrections the Live tutor may run on one item before the bench moves the
 * lesson forward anyway. Per-turn judging is deliberately permissive: a weak
 * sound resurfaces through distributed review, not through drilling a
 * frustrated five-year-old in place.
 */
export const MAX_CORRECTIONS_PER_ITEM = 2;

const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * The Live tutor judges each attempt in-band and reports through a canonical
 * branch pair in its own generated speech: affirmations begin "Yes," and
 * corrections begin "My turn." (the classic DISTAR correction opener — chosen
 * because no other scripted line starts with it). Output transcription is
 * model-generated text, not lossy ASR, so a whole-token check on the opening
 * words is reliable.
 */
export type LiveJudgment = 'affirmed' | 'corrected' | 'off-script' | 'pending';

export function classifyTutorJudgment(turnText: string): LiveJudgment {
  const tokens = normalized(turnText).split(' ').filter(Boolean);
  if (tokens.length === 0) return 'pending';
  const [first, second] = tokens;
  if (first === 'yes') return 'affirmed';
  if (first === 'my') {
    if (tokens.length === 1) return 'pending';
    return second === 'turn' ? 'corrected' : 'off-script';
  }
  // A lone partial chunk ("Ye") may still be completing a sentinel.
  if (tokens.length === 1 && ('yes'.startsWith(first) || 'my'.startsWith(first))) {
    return 'pending';
  }
  return 'off-script';
}

/**
 * Passive cross-check only: whole-token alias match on the learner's lossy
 * input transcript. Never authoritative — it exists to measure how often the
 * Live judge and the transcript disagree.
 */
export function matchesAsrAliases(heard: string, item: DIItem): boolean {
  const expected = item.elicitation === 'keyword' ? item.keyword : item.spoken;
  const candidates = [expected ?? '', ...(item.asrAliases ?? [])]
    .map(normalized)
    .filter(Boolean);
  const heardText = normalized(heard);
  if (!heardText) return false;
  const padded = ` ${heardText} `;
  return candidates.some((candidate) => padded.includes(` ${candidate} `));
}

export type DIProgressDecision =
  | { kind: 'advance'; nextItemId: string }
  | { kind: 'complete' }
  | { kind: 'retry'; correctionsUsed: number }
  | { kind: 'move-on'; nextItemId: string | null }
  | { kind: 'stay'; reason: 'off-script' };

/**
 * Progression authority stays in the bench. The Live tutor only ever judges
 * the current attempt; which item comes next, when to stop correcting, and
 * when the run ends are decided here, deterministically.
 */
export function resolveLiveJudgment(
  judgment: Exclude<LiveJudgment, 'pending'>,
  activeItemId: string,
  items: DIItem[],
  correctionsUsed: number,
): DIProgressDecision {
  const index = items.findIndex((item) => item.id === activeItemId);
  const nextItemId = index >= 0 && index < items.length - 1 ? items[index + 1].id : null;

  if (judgment === 'off-script') return { kind: 'stay', reason: 'off-script' };
  if (judgment === 'affirmed') {
    return nextItemId ? { kind: 'advance', nextItemId } : { kind: 'complete' };
  }
  if (correctionsUsed >= MAX_CORRECTIONS_PER_ITEM) return { kind: 'move-on', nextItemId };
  return { kind: 'retry', correctionsUsed };
}

export type BenchSpeaker = 'tutor' | 'learner' | 'judge' | 'mic';

export interface BenchEvent {
  n: number;
  speaker: BenchSpeaker;
  text: string;
  /** Browser-relative time from Start run to receipt of this event. */
  atMs: number;
  /** Tutor audio fall -> Live input transcription received in this browser. */
  responseMs?: number | null;
  /** Local amplitude-VAD utterance length ('mic' events). */
  durationMs?: number;
  /** Peak RMS of the local utterance ('mic' events). */
  peakLevel?: number;
  /** Turn opened while tutor audio was playing ('mic' events) — either a
   *  genuine barge-in or speaker echo that survived AEC. The speaker-run
   *  readout for whether open-mic (no echo gate) holds on this hardware. */
  duringTutorAudio?: boolean;
  /** Local voice start -> Live input transcription arrival ('learner' events).
   *  The direct measurement of "did Gemini hear me, and how late". */
  commitLagMs?: number | null;
  /** Transcript logged but excluded from judging (e.g. no local voice backed
   *  it — a phantom commit from noise, echo, or stale pre-run audio). */
  ignored?: 'no-local-voice';
  /** Item the event belongs to (learner attempts and judge verdicts). */
  itemId?: string;
  /** Item mentioned by Live output transcription. Diagnostic only. */
  detectedItemId?: string;
  judgment?: Exclude<LiveJudgment, 'pending'>;
  /** Sentinel verdict that arrived with NO transcript-backed attempt pending
   *  (judge events). The DI-1 failure shape: Live judged audio it heard, but
   *  the input transcription never arrived, so the bench had nothing to bind
   *  the verdict to. Logged, never drives progression. */
  unanchored?: boolean;
  /** Whole-token alias match on the learner transcript. Cross-check only. */
  aliasMatch?: boolean;
  /** What the bench did with the verdict. */
  action?: DIProgressDecision['kind'];
}

export interface BenchSummary {
  tutorEvents: number;
  learnerEvents: number;
  judgeEvents: number;
  /** Locally detected utterances. micEvents > learnerEvents ⇒ Gemini dropped attempts. */
  micEvents: number;
  /** Turns opened while tutor audio played. On a headset ≈ true barge-ins;
   *  on speakers, the excess over intentional interruptions ≈ echo leakage. */
  turnsOverTutorAudio: number;
  timedResponses: number;
  meanFrontendResponseMs: number | null;
  meanCommitLagMs: number | null;
  affirmed: number;
  corrected: number;
  offScript: number;
  /** Sentinel verdicts with no pending attempt to bind to (DI-1 detector).
   *  Nonzero ⇒ Live judged an attempt whose transcript was lost — the bench
   *  and the model may have diverged right there. */
  unanchoredVerdicts: number;
  /** Judge verdicts where the transcript alias check agreed / disagreed. */
  aliasAgree: number;
  aliasDisagree: number;
}

const mean = (values: number[]): number | null =>
  values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;

export function summarizeEvents(events: BenchEvent[]): BenchSummary {
  const responses = events
    .map((event) => event.responseMs)
    .filter((value): value is number => value != null);
  const commitLags = events
    .map((event) => event.commitLagMs)
    .filter((value): value is number => value != null);
  const verdicts = events.filter((event) => event.speaker === 'judge');
  const anchored = verdicts.filter((event) => !event.unanchored);
  const judged = anchored.filter(
    (event) => event.judgment !== 'off-script' && event.aliasMatch !== undefined,
  );
  const aliasAgree = judged.filter(
    (event) => (event.judgment === 'affirmed') === event.aliasMatch,
  ).length;
  return {
    tutorEvents: events.filter((event) => event.speaker === 'tutor').length,
    learnerEvents: events.filter((event) => event.speaker === 'learner').length,
    judgeEvents: verdicts.length,
    micEvents: events.filter((event) => event.speaker === 'mic').length,
    turnsOverTutorAudio: events.filter(
      (event) => event.speaker === 'mic' && event.duringTutorAudio === true,
    ).length,
    timedResponses: responses.length,
    meanFrontendResponseMs: mean(responses),
    meanCommitLagMs: mean(commitLags),
    affirmed: anchored.filter((event) => event.judgment === 'affirmed').length,
    corrected: anchored.filter((event) => event.judgment === 'corrected').length,
    offScript: anchored.filter((event) => event.judgment === 'off-script').length,
    unanchoredVerdicts: verdicts.filter((event) => event.unanchored === true).length,
    aliasAgree,
    aliasDisagree: judged.length - aliasAgree,
  };
}

/** Diagnostic display hint from Live output transcription; never authoritative. */
export function detectDIItemFromTutorText(text: string, items: DIItem[]): DIItem | null {
  const transcript = normalized(text);
  let best: { item: DIItem; position: number } | null = null;

  for (const item of items) {
    const spoken = normalized(item.spoken);
    const keyword = normalized(item.keyword ?? '');
    const patterns = item.kind === 'word'
      ? [`this word is ${spoken}`, `that word is ${spoken}`]
      : item.elicitation === 'keyword'
        ? [`this sound is ${spoken}`, `that sound is ${spoken}`, `first sound in ${keyword}`, `say ${keyword}`]
        : [`this sound is ${spoken}`, `that sound is ${spoken}`];
    for (const pattern of patterns) {
      const position = transcript.lastIndexOf(pattern);
      if (position >= 0 && (!best || position > best.position)) best = { item, position };
    }
  }
  return best?.item ?? null;
}
