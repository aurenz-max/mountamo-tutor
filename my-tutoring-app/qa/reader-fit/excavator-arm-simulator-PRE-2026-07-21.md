# Reader Fit: excavator-arm-simulator @ PRE (young-learner band) — 2026-07-21

Modes audited: unmoded (5-job Dig Site board: rookie / reach / fuel / pipe / jammed; L2 tutor-scaffold path) | Probes: component census + jsdom behavioral ✓ | live — (needs browser)

Third engineering primitive to get the young-learner read-aloud capability, after
[[vehicle-comparison-lab]] and [[propulsion-timeline]] (both 2026-07-21). Same
finding class, same fix. This is a job-board dig-site sim where the **geometry
engine is the judge** (jobs/goals computed from the arm's actual reach, solution =
which joint angles — never surfaced as text). Its load-bearing prose = the site
intro, each job **brief** (the spine — what to do), the on-request **hint**, and
the post-attempt **feedback / solve explanations**. The manipulation (drag joints,
Dig, Dump) is bespoke canvas the tutor never has to narrate to make legal; the
words a K–2 reader cannot decode are the briefs, hints, and explanations.

## Audit A — text census
| String (abridged) | Where | Class | Spoken twin (before) | Verdict |
|---|---|---|---|---|
| `description` ("Drive a real digging machine…") | top intro `<p>` | Load-bearing (orient) | none | UNCOVERED → **COVERED** (intro 🔊, `[READ_INTRO]`) |
| job `brief` ("Rain! The tracks are stuck…stretch the arm") | job briefing, the spine | Load-bearing (the task) | sent silent to tutor on `[ACTIVITY_START]`/`[NEXT_JOB]` once; on-card text never replayable | UNCOVERED → **COVERED** (`ReadMeButton`, `[READ_JOB]`: brief verbatim + answer-free ask) |
| job `successHint` ("Push the bucket tip deep…") | hint block, on request | Load-bearing (guidance, revealed) | sent silent on `[HINT_REQUESTED]`; on-card text unreadable, no replay | UNCOVERED → **COVERED** (hint 🔊, `[READ_HINT]`) |
| pipe-strike feedback ("You hit the gas pipe!…never dig deep twice") | strike block | Load-bearing (recover) | sent silent on `[PIPE_STRIKE]`; on-card text unreadable | UNCOVERED → **COVERED** (strike 🔊, `[READ_STRIKE]`) |
| out-of-fuel feedback ("Out of fuel…every scoop has to be a FULL one") | fuel block | Load-bearing (recover) | sent silent on `[OUT_OF_FUEL]`; on-card unreadable | UNCOVERED → **COVERED** (fuel 🔊, `[READ_FUEL]`) |
| job `explainOnSolve` ("That dashed circle is the REACH ENVELOPE…") | solve card, after solve | Load-bearing (the payoff) | sent silent on `[JOB_SOLVED]`; on-card unreadable | UNCOVERED → **COVERED** (solve 🔊, `[READ_SOLVE]`) |
| "The big idea… kinematic chain" | Operator's Debrief, after all jobs | Load-bearing (synthesis) | none | UNCOVERED → **COVERED** (big-idea 🔊, `[READ_BIGIDEA]`) |
| joint solution (which boom/stick/bucket angle) | canvas / engine only | **Answer — protected** | never text | NOT read — correctly never surfaced as prose |
| Job N/5 counter, badge, goal "units", fuel ⛽ gauge, Dig/Dump labels, Total/Digs/Dumps stats | chrome | Load-bearing chrome | none | Residual (band chrome — Audit C) |

Answer-safety: the seven read blocks are all orient / task-brief / revealed-hint /
post-attempt-feedback / synthesis — none names the correct joint configuration
(the only "answer" here). The brief is an answer-free ask by construction; the hint,
strike, fuel, and solve texts are only reachable **after** the relevant event.

## Audit B — sufficiency contract
| Beat | Before | After |
|---|---|---|
| ORIENT | FAIL — intro + brief text-only | PASS (intro 🔊 + job `ReadMeButton`) |
| STIMULUS | FAIL — the job (what to move toward) unreadable | PASS (brief voiced verbatim + answer-free ask) |
| DISAMBIGUATE | PARTIAL — hint sent to tutor once, no replay | PASS (hint 🔊 replayable on request) |
| FEEDBACK | PARTIAL — strike/fuel/solve narrated once silently, on-card text unreadable | PASS (each block has a 🔊) |
| RECOVER | FAIL — recovery coaching unreadable on-card | PASS (strike + fuel 🔊 voice the fix) |

## Audit C — band contract (strict PRE)
| Rule | PASS/FAIL | Offender |
|---|---|---|
| 1 Audio is instruction channel | FAIL→**mitigated** | Was text-only; seven 🔊 now voice all load-bearing prose on demand |
| 2 Tap = choose | FAIL | Core loop is drag-joints + Dig/Dump actuators, not tap-to-choose |
| 3 Pictures are answer surface | PARTIAL | The canvas dig-site IS a pictorial manipulative; briefs/hints are text |
| 4 One thing per screen (≤5) | FAIL | Job panel + canvas + fuel/goal gauges + Dig/Dump + 3 stat tiles |
| 7 No adult chrome | FAIL | "Job N/5", goal "units", angle HUD (°), Total/Digs/Dumps counters |
| 8 Assessment hides in mechanics | PASS | Engine-judged: no submit-answer quiz; solving is the manipulation |

**Overall: PRIMITIVE-GAP (read-aloud gap) — RESOLVED for the load-bearing-text
blocker.** At strict eyes-free-PRE this remains a DEVELOPING/grades-2-5 instrument
(drag-joint control, °-angle HUD, unit counters, multi-gauge panel = Audit C FAILs
read-aloud does not fix); a full eyes-free-K rebuild would be a REBUILD, out of
scope. For the realistic K-2 audience — young learners who can operate the arm and
watch the truck fill but cannot decode the briefs, hints, and explanations — the
blocker was unreadable load-bearing prose, now unblocked across intro, every job
brief, hint, both recovery paths, the per-job payoff, and the closing synthesis.

Findings → fix layer:
- **[DONE] Load-bearing prose unvoiced → COMPONENT (Tier 2).** Wired
  `LuminaReadAloud` (intro, hint, pipe-strike, out-of-fuel, solve card, debrief
  big idea) + shared `ReadMeButton` (job brief + answer-free ask). All route to a
  non-silent `sendText` via `readBlockAloud`; glyph ripples on `isAudioPlaying`.
  Cyan audio-out mark, learned once. No `<button>`-in-`<button>`: every read block
  is a `<div>`/`<p>` (the "Stuck? Get a hint" reveal is a separate sibling
  `<button>`, not a parent), so no `role="button"` conversion was needed.
- **[RESIDUAL, systemic] Audit C chrome at strict PRE.** Shared "K-stage"
  presentation-mode case (drag control, angle HUD, unit counters); recorded, not
  fixed inline (no design-system fork).

## [--fix] Loop log
| Iter | Change | Type check | Runtime check | Re-audit |
|---|---|---|---|---|
| 1 | Seven 🔊 across intro / job / hint / strike / fuel / solve / debrief; `ReadMeButton` for the job brief; non-silent `sendText`; `isAudioPlaying` ripple | 0 errors on file; `typecheck:lumina` 0 | **PASS** — jsdom reader-fit test (`__tests__/ExcavatorArmSimulator.reader-fit.test.tsx`, 3/3): intro 🔊 reads description; job `ReadMeButton` reads brief + answer-free ask; hint 🔊 reads the hint verbatim | Audit A load-bearing strings COVERED; Audit B STIMULUS PASS |

**Verification status:** type-checked (0 new errors) + Lumina gate clean + **3/3
behavioral tests**. The three canvas-gated placements exercised in jsdom (intro,
job, hint) cover the spine; the four remaining 🔊 (pipe-strike, out-of-fuel, solve
card, debrief) are reachable only through dig geometry the jsdom canvas can't drive
— they are wired identically and verified by tsc + census, and want one browser
pass on the Engineering tester to hear the live tutor voice (logged to HUMAN-CHECKS
scope; not edited here). Message shape, targeting, and answer-safety are
runtime-verified for the reachable placements.
