# Reader Fit: construction-sequence-planner @ PRE (young-learner band) — 2026-07-21

Modes audited: unmoded (plan / build / results; K-2 config path) | Probes: static (real data interface) ✓ | live — (needs browser)

Catalog serves grades K-5 (`gradeLevel: 'K'..'5'` on the data), so the lowest
served band = K/PRE. Audited at the young-learner band. The core loop — drag
construction tasks into a build order, watch the build succeed or collapse, read
the feedback — leans on prose the primitive itself never voices: a project intro
paragraph, the ordering instruction, the after-build feedback/hint, and (grades
3+) a critical-path explanation. **Every one is load-bearing text a K–2 reader
cannot decode.**

Third engineering primitive to get the young-learner read-aloud capability —
same finding class and fix as [[vehicle-comparison-lab]] and [[propulsion-timeline]]
(both 2026-07-21).

## Audit A — text census
| String (abridged) | Where | Class | Spoken twin (before) | Verdict |
|---|---|---|---|---|
| project `description` ("Plan the jobs to build a house…") | header, plan phase | Load-bearing (orient) | only a silent `[INTRO]` sent once to the tutor on connect; on-screen text never replayable | UNCOVERED → **COVERED** (intro 🔊 reads title + description) |
| "Drag tasks into the correct construction order:" | plan, task-list header | Load-bearing (the task) | none | UNCOVERED → **COVERED** (ReadMeButton reads the task + an answer-free ask) |
| post-attempt `feedback` (hint / build-failure / completion) | feedback banner | Load-bearing (guidance/result) | sent to tutor via silent `[HINT_REQUESTED]`/`[BUILD_FAILURE]`/`[ALL_COMPLETE]`; on-banner text unreadable, no replay | UNCOVERED → **COVERED** (feedback 🔊, reads what is already revealed) |
| critical-path explanation ("the longest chain of tasks that can't be done in parallel…") | plan, grades 3+ (`parallelAllowed`) | Load-bearing (concept) | none | UNCOVERED → **COVERED** (critical-path 🔊) |
| task rows (name, "Needs: X", `Nw` duration) | plan, schedule list | Load-bearing chrome / **answer-adjacent** | none | Left unvoiced BY DESIGN — reading each "Needs: …" aloud would dictate the dependency order (the answer). The task-prompt ask stays answer-free instead. |
| Gantt legend, week headers, badges, `{scheduleWeeks}w/{targetWeeks}w`, phase status | chrome | Load-bearing chrome | none | Residual (band chrome — Audit C) |
| `challenges[]` (question/hint) | data interface | — | — | Not rendered by the component; no read site |

## Audit B — sufficiency contract
| Phase | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| plan | before: **FAIL** (intro/task never read) → after: PASS (intro 🔊 + task 🔊) | after: PASS (task voiced via ask) | after: PASS (ask states "drag each into the order you think, first job at top") | PASS (feedback banner now has a 🔊; tutor also speaks on hint/build) | PASS (feedback 🔊 replay; "Fix My Plan") |
| build | after: PASS (feedback 🔊 on success/failure) | PASS (canvas build/collapse is visual) | n/a | PASS (spoken `[BUILD_FAILURE]`/`[ALL_COMPLETE]` + banner 🔊) | PASS ("Fix My Plan"/"Optimize") |
| critical-path (3+) | after: PASS (🔊) | after: PASS | n/a | n/a | PASS |

## Audit C — band contract (strict PRE)
| Rule | PASS/FAIL | Offender |
|---|---|---|
| 1 Audio is instruction channel | FAIL→**mitigated** | Was text-only; four 🔊 buttons now voice all load-bearing text on demand |
| 2 Tap = choose | FAIL | Core loop is drag-to-reorder + "Start Building", not single-tap choose |
| 3 Pictures are answer surface | PARTIAL | Task rows carry an icon but decision rides on the name + "Needs:" text |
| 4 One thing per screen (≤5) | FAIL | Plan shows N task rows + Gantt + actions + critical-path panel at once |
| 7 No adult chrome | FAIL | Week/Gantt timeline, `{weeks}w/{target}w` badge, critical-path jargon, "Needs:" labels |
| 8 Assessment hides in mechanics | PARTIAL | Order-and-build is a graded sequencing quiz |

**Overall: PRIMITIVE-GAP (read-aloud gap) — RESOLVED for the load-bearing-text
blocker.** As with the two prior engineering pilots, at strict eyes-free-PRE this
stays a DEVELOPING/grades-2-5 instrument (drag-reorder, Gantt timeline, week
badges, critical-path jargon = Audit C FAILs that read-aloud does not fix); a full
eyes-free-K rebuild would be a REBUILD, out of scope. For the realistic K-2
audience — young learners who can drag the tasks but not decode the prose — the
blocker was unreadable load-bearing text, now unblocked across intro, task,
feedback, and critical-path.

Findings → fix layer:
- **[DONE] Load-bearing text unvoiced → COMPONENT (Tier 2).** Wired
  `LuminaReadAloud` (project intro, post-attempt feedback, critical-path
  explanation) + shared `ReadMeButton` (ordering task, answer-free ask). All route
  to non-silent `sendText` via a `readBlockAloud` helper; glyph ripples on
  `isAudioPlaying`. Cyan audio-out mark, learned once. No nested-button
  conversions were needed — every 🔊 sits beside a `<p>`/`<h3>`/banner text, none
  inside another `<button>` (the draggable task rows are `LuminaDropZone`s and were
  deliberately left unvoiced to avoid dictating the dependency order).
- **[HELD, answer-safety] Per-row "Needs: X" not voiced.** Reading each row's
  dependency aloud would hand the student the build order; the answer-free task
  ask covers "what to do" without naming the sequence.
- **[RESIDUAL, systemic] Audit C chrome at strict PRE.** Shared "K-stage"
  presentation-mode case (Gantt/week timeline, weeks badge, critical-path jargon);
  recorded, not fixed inline (no design-system fork).

## [--fix] Loop log
| Iter | Change | Type check | Runtime check | Re-audit |
|---|---|---|---|---|
| 1 | Four 🔊 across intro/task/feedback/critical-path; non-silent `sendText` via `readBlockAloud`; `isAudioPlaying` ripple; task prompt = answer-free `ReadMeButton` | 0 new errors (tsc filtered `ConstructionSequencePlanner` = 0 lines); `typecheck:lumina` 0 | **PASS** — jsdom reader-fit test (`__tests__/ConstructionSequencePlanner.reader-fit.test.tsx`, 4/4): intro 🔊 reads title+description; task 🔊 answer-free (excludes build order); feedback 🔊 reads revealed hint; critical-path 🔊 reads concept | Audit A load-bearing strings COVERED; Audit B ORIENT/STIMULUS PASS |

**Verification status:** type-checked + Lumina gate clean + **4/4 behavioral
tests**. Residual: hearing the live tutor voice wants one browser pass on the
Engineering tester — carried on the shared engineering read-aloud HUMAN-CHECKS
item. Message shape, targeting, tag routing, and answer-safety are runtime-verified.
