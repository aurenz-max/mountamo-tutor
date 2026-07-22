# Reader Fit: vehicle-design-studio @ PRE (young-learner band) — 2026-07-21

Modes audited: unmoded (Free Design + challenge missions; grades 2-5 config path) | Probes: component read + jsdom behavioral ✓ | live — (needs browser)

Component `gradeBand` is **'2-3' | '4-5'** — this is the third engineering
primitive to get the young-learner read-aloud capability, following
[[vehicle-comparison-lab]] and [[propulsion-timeline]] (both 2026-07-21). Even at
its lowest claimed band (grade 2-3) the design-studio prose — a build-test-iterate
mission with dense stat labels — is only partly decodable by an early reader, so
the same load-bearing-text audit applies. Same finding class and fix as the two
pilots.

## Audit A — text census
| String (abridged) | Where | Class | Spoken twin (before) | Verdict |
|---|---|---|---|---|
| `description` ("Build your very own race car and test how fast it can go!") | studio intro, top | Load-bearing (orient) | none | UNCOVERED → **COVERED** (intro 🔊 reads it verbatim) |
| `activeChallenge.description` ("Make a car that is light and speedy…") + its constraints | challenge mission banner | Load-bearing (the task) | none — constraints only shown as badges | UNCOVERED → **COVERED** (ReadMeButton reads the mission + an answer-free ask that voices the constraint numbers in kid words) |
| `designTips[].tip` ("Add a stabilizer to keep it steady.") | post-test active-tip cards | Load-bearing (feedback/hint) | none — the physics-conditioned tip is on-card text only | UNCOVERED → **COVERED** (per-tip 🔊, replayable, reads what is already revealed) |
| Engineering Design Tips panel (3 static paragraphs: the design cycle, change-one-thing, trade-offs) | bottom explainer | Load-bearing (explanation) | none | UNCOVERED → **COVERED** (design-tips 🔊 reads the combined guidance) |
| part stat rows (Weight/Drag/Capacity/Cost; Thrust/Efficiency; Stability/Drag) | parts palette | Load-bearing chrome | none | Residual (band chrome — Audit C) |
| constraint badges (Max Weight, Min Speed, …) | header | Load-bearing chrome | none (voiced inside the mission ask when a challenge is active) | Partial — voiced via mission ask; standalone Free-Design badges Residual |
| radar-chart metric labels, "Current Design" summary, "Design Iterations", Design Log | performance panel | chrome / data readout | none | Residual (band chrome — Audit C) |
| AI [PRE_TEST]/[FIRST_TEST]/[IMPROVEMENT]/… analysis | on test | Supportive (tutor narrates on tap) | narrates on tap (silent → tutor) | Supportive — left as-is |

## Audit B — sufficiency contract
| Beat | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| Free Design | after: PASS (intro 🔊 + design-tips 🔊) | after: PASS (intro voiced) | n/a (open build) | PASS (spoken analysis on test + tip 🔊) | PASS (🔊 replay, tip 🔊) |
| Challenge mission | after: PASS (mission 🔊) | after: PASS (mission + constraints voiced via answer-free ask) | after: PASS (ask says "pick a body, a motor, controls, then Test Design") | PASS (spoken analysis + constraints-met badge + tip 🔊) | PASS (post-test tip 🔊 replayable) |

## Audit C — band contract (strict PRE)
| Rule | PASS/FAIL | Offender |
|---|---|---|
| 1 Audio is instruction channel | FAIL→**mitigated** | Was text-only; four 🔊 placements now voice all load-bearing prose on demand |
| 2 Tap = choose | PARTIAL | Part selection is tap-to-choose ✓; but Test Design / Submit / accordion / challenge stepper are multi-control |
| 3 Pictures are answer surface | FAIL | Parts are text+stat cards (domain emoji only); radar chart & stat readouts are numeric |
| 4 One thing per screen (≤5) | FAIL | Palette (bodies+propulsion+controls accordions) + performance panel + constraint badges + tips all co-render |
| 7 No adult chrome | FAIL | domain badge, ★ difficulty, kg/$/km stat rows, radar chart, "Design Iterations" counter, Design Log |
| 8 Assessment hides in mechanics | PASS | Evaluation is emergent from the build-test-iterate loop (physics-judged), not a quiz |

**Overall: PRIMITIVE-GAP (read-aloud gap) — RESOLVED for the load-bearing-text
blocker.** As with the two engineering pilots, at strict eyes-free-PRE this remains
a DEVELOPING/grades-2-5 instrument (stat-dense part cards, radar chart, numeric
readouts, accordion + challenge stepper = Audit C FAILs read-aloud does not fix); a
full eyes-free-K rebuild would be a REBUILD, out of scope and off-band for a 2-5
primitive. For the realistic audience — young learners who can operate the studio
but not fluently decode the mission prose, tips, and guidance — the blocker was
unreadable load-bearing text, now unblocked across intro, mission, tips, and the
design-cycle explainer.

Findings → fix layer:
- **[DONE] Load-bearing prose unvoiced → COMPONENT (Tier 2).** Wired
  `LuminaReadAloud` (studio intro, per active-tip, engineering-design-tips panel)
  + shared `ReadMeButton` (challenge mission + answer-free constraint ask). All
  route to non-silent `sendText`; glyph ripples on `isAudioPlaying`. Cyan
  audio-out mark, learned once. The mission ask voices the constraint numbers in
  kid words but never names the winning parts (answer-safe). All four placements
  sit outside existing `<button>`s, so **no nested-button conversion was needed**.
- **[RESIDUAL, systemic] Audit C chrome at strict PRE.** Shared "K-stage"
  presentation-mode case (stat cards, radar chart, counters, accordion); recorded,
  not fixed inline (no design-system fork; also off-band for a grades 2-5 primitive).

## [--fix] Loop log
| Iter | Change | Type check | Runtime check | Re-audit |
|---|---|---|---|---|
| 1 | Four 🔊 across intro/mission/tips/design-guidance; non-silent `sendText`; `isAudioPlaying` ripple; mission ask answer-free (constraints in kid words, no winning parts) | 0 errors in VehicleDesignStudio; `typecheck:lumina` 0 | **PASS** — jsdom reader-fit test (`__tests__/VehicleDesignStudio.reader-fit.test.tsx`, 4/4): intro 🔊 reads description; mission 🔊 reads mission + voices constraints and never names winning parts; active-tip 🔊 reads the tip (timer-driven sim advanced); design-tips 🔊 reads the static guidance | Audit A load-bearing strings COVERED; Audit B STIMULUS PASS both beats |

**Verification status:** type-checked + Lumina gate clean + **4/4 behavioral
tests**. Residual: hearing the live tutor voice wants one browser pass on the
Engineering tester — logged systemically to HUMAN-CHECKS (shared with the two
pilots). Message shape, targeting, and answer-safety are runtime-verified.
