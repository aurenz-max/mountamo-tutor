# Reader Fit: transport-challenge @ PRE (young-learner band) — 2026-07-21

Modes audited: unmoded (per-scenario flow: pick → simulate → results → question → answered; `single_/multi_/full_` phase types) | Probes: jsdom behavioral ✓ (4/4) | live — (needs browser)

Catalog claims K-5, so lowest claimed band = K/PRE. Audited at the young-learner
band. The core manipulative (pick a vehicle, watch the sim, read the constraint
bars) is operable by a non-reader, but **every load-bearing prose string a K–2
reader must comprehend is text they cannot decode** — the lesson intro, the
scenario setup, the trade-off QUESTION, and the post-answer explanation.

Third engineering primitive to get the young-learner read-aloud capability —
same finding class and fix as [[vehicle-comparison-lab]] and [[propulsion-timeline]]
(both 2026-07-21).

## Audit A — text census
| String (abridged) | Where | Class | Spoken twin (before) | Verdict |
|---|---|---|---|---|
| `description` (lesson intro, e.g. "Plan the smartest way to move people…") | card header | Load-bearing (orient) | none | UNCOVERED → **COVERED** ([READ_INTRO] plain 🔊, non-graded) |
| scenario `title` + "Transport N people from A to B (km)" + constraint badges | scenario header, picking on | Load-bearing (the task) | none | UNCOVERED → **COVERED** ([READ_SCENARIO] ReadMeButton — reads setup + answer-free ask) |
| `tradeOffQuestion` | question/answered phase | Load-bearing (THE question) | none — question text only | UNCOVERED → **COVERED** ([READ_QUESTION] ReadMeButton — verbatim question + answer-free ask, never the correct option) |
| `explanation` | answered phase (LuminaFeedbackCard) | Load-bearing (feedback) | sent to tutor via silent `[ANSWER_*]`, on-card text unreadable | Partially → **COVERED** ([READ_EXPLANATION] plain 🔊, reads only what is already revealed) |
| vehicle cards (name/emoji/capacity/speed/cost/CO₂/trips) | picking phase | Answer surface (choice IS graded) | none | Protected — NOT read (would voice the decision surface) |
| comparison table (trips/time/cost/CO₂/status per vehicle) | results phase | Structured data | none | Left as-is (numeric grid, not prose) |
| constraint bars, trip counter, "N / M", status badges, phase icons | chrome | Load-bearing chrome | none | Residual (band chrome — Audit C) |

## Audit B — sufficiency contract
| Beat | Before | After |
|---|---|---|
| ORIENT | FAIL (intro + scenario setup text-only) | PASS ([READ_INTRO] + [READ_SCENARIO] 🔊) |
| STIMULUS | FAIL (task framing never voiced) | PASS (scenario 🔊 voices who/where/how-far + rules) |
| DISAMBIGUATE | FAIL (question text-only) | PASS ([READ_QUESTION] reads the ask + answer-free "read the choices and tap the best") |
| FEEDBACK | PARTIAL (explanation sent silently to tutor, on-card text unreadable) | PASS ([READ_EXPLANATION] replays the revealed explanation) |
| RECOVER | PARTIAL | PASS (all four 🔊 are on-demand, replayable) |

## Audit C — band contract (strict PRE)
| Rule | PASS/FAIL | Offender |
|---|---|---|
| 1 Audio is instruction channel | FAIL→**mitigated** | Was text-only; four 🔊 buttons now voice all load-bearing prose on demand |
| 2 Tap = choose | PARTIAL | Vehicle pick + answer choice are choose ✓; "Start Transport", "Answer Question", "Submit", "Next" are extra step buttons |
| 3 Pictures are answer surface | PARTIAL | Vehicle cards carry emoji but the decision rides numeric stats (capacity/cost/CO₂) |
| 4 One thing per screen (≤5) | FAIL | Scenario header + constraint badges + 2–4 vehicle cards + start button on one screen; results shows a full comparison table |
| 7 No adult chrome | FAIL | "N / M" scenario counter, constraint bars with $/kg/min, comparison table, phase-type icons |
| 8 Assessment hides in mechanics | PARTIAL | Trade-off question is an explicit MCQ after the sim |

**Overall: PRIMITIVE-GAP (read-aloud gap) — RESOLVED for the load-bearing-text
blocker.** As with the two prior engineering primitives, at strict eyes-free-PRE
this remains a DEVELOPING/grades-2-5 instrument (numeric constraint bars, a
multi-column comparison table, dollar/CO₂/minute quantities, and a post-sim MCQ =
Audit C FAILs that read-aloud does not fix); a full eyes-free-K rebuild would be a
REBUILD, out of scope, and is the shared systemic K-stage presentation-mode case.
For the realistic K-2 audience — young learners who can operate the sim but not
decode the prose — the blocker was unreadable load-bearing text, now unblocked at
intro, scenario, question, and explanation.

Findings → fix layer:
- **[DONE] Load-bearing prose unvoiced → COMPONENT (Tier 2).** Wired four 🔊:
  `LuminaReadAloud` for the lesson intro ([READ_INTRO]) and the revealed
  explanation ([READ_EXPLANATION]); shared `ReadMeButton` for the scenario task
  ([READ_SCENARIO]) and the trade-off question ([READ_QUESTION]) — both answer-free
  by construction. All route to non-silent `sendText`; glyph ripples on
  `isAudioPlaying`. Cyan audio-out mark, learned once. No nested-button conversions
  were needed (every target string sits in a `<p>`/card context, not inside a
  `<button>`).
- **[RESIDUAL, systemic] Audit C chrome/quantities at strict PRE.** Shared
  "K-stage" presentation-mode case (numeric bars, comparison table, MCQ, counters);
  recorded, not fixed inline (no design-system fork).

## [--fix] Loop log
| Iter | Change | Type check | Runtime check | Re-audit |
|---|---|---|---|---|
| 1 | Four 🔊 across intro/scenario/question/explanation; non-silent `sendText`; `isAudioPlaying` ripple; `ReadMeButton` protects the question answer | 0 new errors for TransportChallenge.tsx; `typecheck:lumina` clean for this file (1 pre-existing error in unrelated `gemini-sorting-station.ts` from other uncommitted work) | **PASS** — jsdom reader-fit test (`__tests__/TransportChallenge.reader-fit.test.tsx`, 4/4): intro 🔊 reads description; scenario 🔊 reads setup + answer-free ask and does NOT name the best vehicle; question 🔊 reads the question and NEVER the correct option; explanation 🔊 reads the revealed feedback | Audit A load-bearing strings COVERED; Audit B all beats PASS |

**Verification status:** type-checked (0 new errors for this file) + **4/4 behavioral
tests**. Answer-safety (question read-aloud never leaks the correct option; scenario
read-aloud never names the best vehicle) is runtime-verified. Residual: hearing the
live tutor voice wants one browser pass on the Engineering tester — systemic
HUMAN-CHECKS item, not edited here.
