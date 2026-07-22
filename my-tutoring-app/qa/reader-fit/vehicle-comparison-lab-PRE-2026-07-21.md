# Reader Fit: vehicle-comparison-lab @ PRE (young-learner band) — 2026-07-21

Modes audited: unmoded (single core; K-2 config path) | Probes: eval-test ✓ (K, real content) | tutor-test --probe — (scaffold read from catalog) | live — (needs browser)

Catalog claims **K-5** ("Perfect for K-5 data analysis"; "ESSENTIAL for answering
'Which is faster, a train or a plane?'"), so lowest claimed band = K/PRE. Audited
at the young-learner band. Real K draw ("Super Cool Vehicle Races"): School Bus,
Bicycle, Boeing 747, Space Shuttle — friendly in spirit, but **every load-bearing
string is unreadable text with no spoken twin**.

## Audit A — text census
| String (abridged) | Where | Class | Spoken twin (before) | Verdict |
|---|---|---|---|---|
| "Let's explore how different machines move! … Click on the vehicles…" | header instructions | Load-bearing (orient) | none | UNCOVERED → **COVERED** (header 🔊) |
| "Getting to school with your friends." | challenge scenario | Load-bearing (the task) | referenced in `currentChallenge` primitiveData only (tutor-reference, never voiced) | UNCOVERED → **COVERED** (ReadMeButton 🔊) |
| "The school bus is the best because it is the only vehicle…" | challenge explanation | Load-bearing (feedback) | tutor reacts via silent `[CHALLENGE_*]` sendText, but the card text is never read verbatim | UNCOVERED → **COVERED** (feedback 🔊) |
| funFact / surprisingFact | compare phase | Supportive / discovery | surprisingFact narrates on tap (silent sendText → tutor reacts) | Supportive — left as-is |
| Vehicle names (School Bus, Bicycle…) | selector / answer buttons | Load-bearing labels | category icon (plane/car/ship) + color | Partially covered by icon; residual |
| "Top Speed / Weight / Passengers", "Bar Chart / Table", phase stepper | chrome | Load-bearing chrome | none | Residual (band chrome — see Audit C) |

## Audit B — sufficiency contract
| Mode | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| core (K-2) | before: partial (`[CHALLENGE_STARTED]` fires but instructions never read) → **after: PASS** (header 🔊 re-voices the orient) | before: **FAIL** (scenario referenced, never read) → **after: PASS** (scenario 🔊 reads it verbatim + states the constraint ask) | after: PASS (scenario 🔊 `ask` clause states "carry N friends, travel N km, tap the vehicle that fits") | PASS (color states on buttons + `[CHALLENGE_*]` spoken reaction + explanation 🔊) | PASS-ish (`commonStruggles` spoken; on-demand replay now exists via the three 🔊 buttons) |

## Audit C — band contract (strict PRE)
| Rule | PASS/FAIL | Offender |
|---|---|---|
| 1 Audio is instruction channel | FAIL→**mitigated** | Was text-only; 🔊 buttons now voice all load-bearing text on demand |
| 2 Tap = choose | PARTIAL | Challenge answers are tap=choose ✓; but phase stepper + metric/chart toggles are a multi-tap protocol |
| 3 Pictures are answer surface | FAIL | Selector + answer buttons are text names (category icon only); charts/table are numeric-label surfaces |
| 4 One thing per screen (≤5) | FAIL | Compare phase = metric toggles + chart toggle + bars + fun facts + surprising facts + button |
| 5 Feedback on touched object | PASS | Answer buttons color to correct/incorrect instantly |
| 7 No adult chrome | FAIL | gradeBand badge, "Challenge 1 of 3" counter, phase stepper, metric/chart toggles, data table |
| 8 Assessment hides in mechanics | PARTIAL | Challenge is a picture-ish MCQ, not an instrument |

**Overall: PRIMITIVE-GAP (read-aloud gap) — RESOLVED for the load-bearing-text
blocker.** For a true eyes-free K child, this remains a DEVELOPING/grades-2-5
data-analysis instrument (charts, tables, toggles, multi-phase nav = Audit C
FAILs that read-aloud does not fix). A full eyes-free-K rebuild would be a REBUILD
and is out of scope. But for the realistic K-2 audience of a *data* primitive —
EMERGING/DEVELOPING young learners who can operate the workspace but not decode the
prose — the blocking issue was unreadable load-bearing text, now unblocked.

Findings → fix layer:
- **[DONE] Load-bearing text unvoiced → COMPONENT (Tier 2).** Wired `LuminaReadAloud`
  (header instructions, challenge explanation) + shared `ReadMeButton` (challenge
  scenario, with a constraint-stating answer-free `ask`). All route to non-silent
  `sendText` (tutor voice); glyph ripples on `isAudioPlaying`. Cyan audio-out mark,
  learned once.
- **[RESIDUAL, systemic] Audit C chrome (badge/counter/stepper/toggles/table) at
  strict PRE.** Do NOT fork the design system per-primitive — this is the shared
  "K-stage" full-bleed presentation-mode case. Recorded here so it keeps
  accumulating; not fixed inline.

## [--fix] Loop log
| Iter | Change | Type check | Runtime check | Re-audit |
|---|---|---|---|---|
| 1 | Header instructions 🔊 + scenario ReadMeButton 🔊 + explanation 🔊; non-silent `sendText`; `isAudioPlaying` ripple | 0 new errors; `typecheck:lumina` 0 | **PASS** — new jsdom reader-fit test (`__tests__/VehicleComparisonLab.reader-fit.test.tsx`, 3/3): each 🔊 renders and taps `sendText` the verbatim string; scenario ask is answer-free (states "50 friends / 5 km", never names the answer vehicle) | Audit A load-bearing strings COVERED; Audit B STIMULUS/ORIENT PASS |

**Verification status:** type-checked + Lumina gate clean + **3/3 behavioral
tests** exercising the button render + tap → `sendText` wiring (the behavior tsc
can't see). Residual: the audio itself (hearing the tutor voice) still wants one
browser pass on the Engineering tester with a live Gemini session — logged to
HUMAN-CHECKS. The read-aloud message shape, targeting, and answer-safety are
runtime-verified.
