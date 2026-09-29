# RP-2: a wrong spoken answer recorded from the learner's words (handoff 27)

Date: 2026-09-29 · `/add-live-tutor-tools` · Text calls only (TypeSafe/JEV, Gemini text replay). **No Live session.** Shipped `c7caf1db` (RP-2), `50c9730b` (LB-15).

## Result

Two modes now record a wrong spoken answer when the tutor's reply credits nothing: **counting-board `count`** and
**ten-frame `subitize`**. The allow list is catalog data (`teachingWorkspace.missFromWords`). Every other mode behaves
as before.

| Gate | Result |
|---|---|
| Pilot on real Live input transcripts, with the tutor's prior line (`rp2-pilot-prior-2026-09-29.*`, 2 runs) | counting `count`: right answers named wrong **0/340**, non-answers **0/262**, sub-step answers **0/4**, wrong named 194/196 · ten-frame `subitize`: right named wrong **0/100**, wrong named 30/36 |
| Replay `--observe`, counting `count` + ten-frame `subitize`, 10 samples each (`replay/rp2-words-2026-09-29.json`) | wrong answers recorded **20/20**: 9 by the reply's own verdict, 11 from the words (counting 1/10, subitize 10/10; the subitize replies were bare re-asks, "Watch closely! How many counters did you see?", which recorded nothing before) · credits still credited 10/10 |
| Wired-family `spoken_miss` regression after the wording change (2,416 requests x 2) | before 4797/4832, after 4801/4832; **0 false positives** both |
| Vitest `components/live-activity` + `service/typesafe` + `catalog/misses` (incl. dry sweep J1-J11) | 39 files, 2044 passed |
| Backend `test_lumina_tutor_session_units.py` | 60 passed |
| `typecheck:lumina` / full tsc | 2 errors, both in `gemini-word-sorter.test.ts` (unmodified in git, not this change) / 773 (baseline 773) |

Live spend: $0. Ten-frame `subitize` had 70 real turns, above the ~20 floor, so no `--audio` runs were needed.

## The transcripts (step 1)

`spoken-miss/rp2-transcripts-2026-09-29.json`: 579 turns, each with the item's key, the ASR text, the label and its
source reference.

- **Harness audio runs** (`qa/tutor-reports/*.json`, `learner_audio` + `provider_transcript`): the truth is the text the
  Azure voice said. Azure TTS transcribes almost verbatim ("1 2 3 4 5"). The harness gives little variety and almost
  none of the fiction the ruling warns about.
- **Session logs no report covers** (`backend/logs/lumina-sessions/`, human mic sittings 08-13 to 09-23 and unreported
  09-19 harness runs): the truth is the tutor's reply, since it heard the audio ("Yes, six counters." / "My turn: it was
  five."). Hand labels were used where the reply was not a verdict. This is where the ASR fiction is: "sex", "sechs",
  "saben", "Nein.", "Ciao.", "Still?", "A", "ri", "tent" and "¿Qué?" for right answers, and "¿Qué?" as the transcript of
  most non-answers.

| Mode | Right | Wrong | Non-answer | Sub-step |
|---|---|---|---|---|
| counting-board `count` | 170 | 98 | 235 | 2 |
| ten-frame `subitize` | 50 | 18 | 2 | 0 |

One labelling defect was found and fixed: at an item boundary, the state beside a harness answer can belong to either
item. The first run's 6 "false positives" were "1 2 3 4 5 6 7" scored against key 5 when the learner was on key 7.
Harness counting keys now come from the harness itself: a correct walk ends on the key, and the scripted wrong walk
ends one past it.

Unnamed wrong answers are ASR fiction ("sexo", "sex" for a wrong six, "¿Qué?", "1.5"). They record nothing, as before.

## What was built

- `observeDialogue.ts`: a spoken reply with no gated verdict whose likeliest reading is not "credited" reports
  `creditsNothing`. It commits nothing by itself.
- `DialogueObserver.ts`: after such a reply, it asks the mounted workspace, read-only, whether a verdict from the words
  would stand (`acceptsMissFromWords(responseId)`). Only then does it send `apply_tutor_verdict` `{ verdict: incorrect,
  transition: retry, fromWords: true }`. It asks first because a refused transition bumps the revision and republishes
  a packet to the tutor. The item reopens; the S2 trigger ladder and the lever pull follow from the committed wrong.
- `useTeachingWorkspace.ts`: the gate. The mode pin must be on the catalog allow list (a blend or `mixed` pin that
  includes any other mode does not qualify), and `spoken_miss` must have named a miss for exactly this response. The
  attempt records that miss. The command contract accepts `fromWords` only with `incorrect` and `retry`.
- `spoken_miss` gets the tutor's prior line (`priorTutor`, already in its contract, never sent before). Its wording now
  treats an answer to a different question the tutor just asked as no answer to the task. This was needed because the
  dialogue observer's verdict probabilities do not separate a bare re-ask from praise of a sub-step (09-29 probe: "Yes,
  you counted the first row perfectly! Now let's count them all again" read none .94 / correct .03). Without the prior
  line, a real human's "ocho" to "how many bears in the first row?" (key 18) was named `short_by_more` in 1 of 3 runs.
  With it, 0 of 4.
- The first rule, `P(incorrect) > P(correct)`, was dropped. The same RP-2 reply ("Let's count them together and touch
  each butterfly") read incorrect .63 in the 09-29 session and none .98 in the probe, and bare re-asks never lean
  incorrect.
- The tutor's affirmation still credits: a reply whose likeliest reading is "credited" never takes this path. The miss
  never enters the tutor packet.
- Probe `--transcripts <file> [--prior]` (weighted by occurrence). The sweep's replay moments carry the item's
  `spoken_miss` request and allow flag. `tutor_replay.py --observe` emulates the words path and adds a `miss_recorded`
  check.

## LB-15 (same slice)

Scan of all 181,528 output-transcript chunks: **36 of 22,336 tutor turns** (32 since 09-19) carried text no audio
carries. Most were a bare `---`. Others were the model's reasoning after one ("I need to perform the workspace action",
"The above response complies with the instructions"), the lesson system instruction ("LESSON ACTIVITIES", "YOUR
ROLE"), a table bar, Chinese prose in a bold list, and one **answer key** ("Correct Answer: Bowl", 09-24-230229).

Fix at the source, where the chunk enters the backend (`OutputTranscriptBoundary`, `lumina_tutor.py`): a chunk with
markdown structure that arrives with no audio since the previous chunk is dropped, and so is the rest of that turn's
transcript. That structure means a rule, heading or table bar at a line start, or bold or a list item after a line
break. Dropped chunks are ledgered as `ai-transcript-unspoken`. Audio is never touched. Inline bold on a spoken word
(DI era " **ant**") and line breaks inside speech are kept; tests use the real sequences. Re-count after a week of
sessions: `grep -c ai-transcript-unspoken backend/logs/lumina-sessions/*.jsonl`.

## Not done / next

- Other modes need their own transcript pilot before they are listed. Real turns on file: shape-sorter `identify` 231,
  di-word-reading `cvc_reading` 187, di-letter-sounds 175 (letters last), di-math-facts `answer_fact` 140,
  number-sequencer `before_after` 107. Knowledge-check (LB-21) has too few; it needs `--audio` runs.
- Browser/microphone acceptance of the words path: HUMAN-CHECKS #167.
- Tutor-side wording was not changed, and no Live run was made. The replay is text; turn timing with a real spoken
  wrong answer is unmeasured.
